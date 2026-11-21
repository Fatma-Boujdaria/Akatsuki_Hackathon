"""Tranche Guard simulator: sends the same JSON as the ESP32, every 5 s.

Usage (from the backend/ folder, with the API running):

    python -m simulator.simulator                      # normal home
    python -m simulator.simulator --scenario leak      # constant night flow
    python -m simulator.simulator --speed 60           # 1 real second = 1 simulated minute

The device key is read from DEVICE_API_KEY (environment or backend/.env).
Like the ESP32 keeps its water total in flash, the simulator keeps its
counters in .simulator_state.json so a restart does not reset them.

Demo spike: when the backend answers with a {"type": "spike"} command (after
someone pressed "Simulate spike"), the simulator sends a reading at once, adds
the extra power for the given duration and, so the alert shows within ~10 s,
adds the requested kWh on that first spike reading (time compressed for the demo).
"""

import argparse
import json
import math
import os
import random
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx

TZ = ZoneInfo("Africa/Tunis")
STATE_FILE = Path(".simulator_state.json")


def load_dotenv_value(name: str, env_file: Path = Path(".env")) -> str | None:
    if os.environ.get(name):
        return os.environ[name]
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip() == name:
                return value.strip().strip('"').strip("'") or None
    return None


@dataclass
class Spike:
    extra_w: float
    remaining_steps: int
    energy_kwh: float  # added at once on the first spike reading: alert within ~10 s


@dataclass
class HomeModel:
    """A plausible Tunisian home: standby, daily peaks, random big appliances."""

    rng: random.Random
    scenario: str = "normal"
    heater_steps_left: int = 0
    ac_steps_left: int = 0
    shower_steps_left: int = 0

    def power_w(self, now: datetime, interval_s: float) -> float:
        h = now.hour + now.minute / 60
        base = 110.0  # router, fridge average, standby
        daily = 250 * math.exp(-((h - 8) ** 2) / 2) + 450 * math.exp(-((h - 20.5) ** 2) / 3)
        # Water heater (2 kW) mornings, air conditioner (1.2 kW) afternoons/evenings.
        if self.heater_steps_left == 0 and 6 <= h < 9 and self.rng.random() < interval_s / 1800:
            self.heater_steps_left = int(900 / interval_s)
        if self.ac_steps_left == 0 and 13 <= h < 23 and self.rng.random() < interval_s / 3600:
            self.ac_steps_left = int(1200 / interval_s)
        heater = 2000.0 if self.heater_steps_left > 0 else 0.0
        ac = 1200.0 if self.ac_steps_left > 0 else 0.0
        self.heater_steps_left = max(0, self.heater_steps_left - 1)
        self.ac_steps_left = max(0, self.ac_steps_left - 1)
        return max(0.0, base + daily + heater + ac + self.rng.gauss(0, 15))

    def flow_l_min(self, now: datetime, interval_s: float) -> float:
        if self.scenario == "leak":
            return 0.4 + abs(self.rng.gauss(0, 0.05))  # never stops: the leak rule should fire
        h = now.hour + now.minute / 60
        if self.shower_steps_left == 0 and (6.5 <= h < 9 or 19 <= h < 23) and self.rng.random() < interval_s / 2400:
            self.shower_steps_left = int(420 / interval_s)  # 7 min shower
        if self.shower_steps_left > 0:
            self.shower_steps_left -= 1
            return 8.0 + self.rng.gauss(0, 0.4)
        if 7 <= h < 23 and self.rng.random() < 0.03:
            return 4.0 + self.rng.gauss(0, 0.5)  # a tap for a few seconds
        return 0.0


@dataclass
class Simulator:
    device_id: str
    interval_s: float = 5.0
    speed: float = 1.0  # simulated seconds per real second (counters only)
    scenario: str = "normal"
    calib_pulses_per_l: int = 450
    energy_kwh: float = 0.0
    water_total_l: float = 0.0
    seed: int | None = None
    spike: Spike | None = None
    model: HomeModel = field(init=False)

    def __post_init__(self) -> None:
        self.model = HomeModel(random.Random(self.seed), self.scenario)

    # --- state kept across restarts (like the ESP32 flash) ----------------------
    def load_state(self, path: Path = STATE_FILE) -> None:
        if path.exists():
            data = json.loads(path.read_text()).get(self.device_id, {})
            self.energy_kwh = data.get("energy_kwh", 0.0)
            self.water_total_l = data.get("water_total_l", 0.0)

    def save_state(self, path: Path = STATE_FILE) -> None:
        data = json.loads(path.read_text()) if path.exists() else {}
        data[self.device_id] = {"energy_kwh": self.energy_kwh, "water_total_l": self.water_total_l}
        path.write_text(json.dumps(data, indent=2))

    # --- one reading ----------------------------------------------------------------
    def next_payload(self, now: datetime | None = None) -> dict:
        now = now or datetime.now(TZ)
        sim_dt = self.interval_s * self.speed  # simulated seconds since the last reading
        power = self.model.power_w(now, self.interval_s)
        flow = max(0.0, self.model.flow_l_min(now, self.interval_s))

        self.energy_kwh += power * sim_dt / 3600 / 1000
        if self.spike is not None:
            power += self.spike.extra_w
            self.energy_kwh += self.spike.energy_kwh
            self.spike.energy_kwh = 0.0
            self.spike.remaining_steps -= 1
            if self.spike.remaining_steps <= 0:
                self.spike = None
        litres = flow * sim_dt / 60
        self.water_total_l += litres

        power = min(power, 23000.0)
        pf = 0.93
        voltage = 230 + self.model.rng.gauss(0, 1.5)
        return {
            "device_id": self.device_id,
            "timestamp": now.isoformat(timespec="milliseconds"),
            "electricity": {
                "voltage_v": round(voltage, 1),
                "current_a": round(power / (voltage * pf), 2),
                "power_w": round(power, 1),
                "energy_kwh": round(self.energy_kwh, 3),
                "frequency_hz": round(50 + self.model.rng.gauss(0, 0.02), 2),
                "power_factor": pf,
            },
            "water": {
                "flow_l_min": round(flow, 2),
                "total_l": round(self.water_total_l, 2),
                "pulses_delta": int(round(litres * self.calib_pulses_per_l)),
                "calib_pulses_per_l": self.calib_pulses_per_l,
            },
            "signal_ok": True,
        }

    def apply_commands(self, commands: list[dict]) -> bool:
        """Start a spike if the backend asked for one. True if something changed."""
        for cmd in commands:
            if cmd.get("type") == "spike":
                steps = max(1, round(cmd["duration_s"] / self.interval_s))
                self.spike = Spike(cmd["extra_w"], steps, cmd["energy_kwh"])
                print(f"  >> spike: +{cmd['extra_w']:.0f} W for {cmd['duration_s']} s, +{cmd['energy_kwh']} kWh (demo)")
                return True
        return False

    def send(self, client, key: str, now: datetime | None = None) -> bool:
        """POST one reading. Returns True when the next one should be sent right away."""
        payload = self.next_payload(now)
        response = client.post("/api/readings", json=payload, headers={"X-Device-Key": key})
        elec = payload["electricity"]
        if response.status_code == 201:
            body = response.json()
            print(
                f"{payload['timestamp'][11:19]}  {elec['power_w']:7.1f} W  {elec['energy_kwh']:9.3f} kWh  "
                f"{payload['water']['flow_l_min']:5.2f} L/min  alerts+{body['alerts_created']}"
            )
            return self.apply_commands(body.get("commands", []))
        print(f"rejected {response.status_code}: {response.text}")
        if response.status_code == 422 and "counter_went_backwards" in response.text:
            # The database holds bigger counters (e.g. seeded history): restart ours
            # from zero, which the backend accepts as a meter reset.
            self.energy_kwh = self.water_total_l = 0.0
            return True
        return False


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Tranche Guard device simulator")
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--device-id", default="sim-001")
    parser.add_argument("--key", default=None, help="device API key (default: DEVICE_API_KEY)")
    parser.add_argument("--interval", type=float, default=5.0)
    parser.add_argument("--speed", type=float, default=1.0, help="time compression for the counters")
    parser.add_argument("--scenario", choices=["normal", "leak"], default="normal")
    parser.add_argument("--count", type=int, default=0, help="stop after N readings (0 = forever)")
    args = parser.parse_args(argv)

    key = args.key or load_dotenv_value("DEVICE_API_KEY")
    if not key:
        print("No device key: set DEVICE_API_KEY in .env or pass --key", file=sys.stderr)
        return 1

    sim = Simulator(args.device_id, args.interval, args.speed, args.scenario)
    sim.load_state()
    print(f"Simulator {args.device_id} -> {args.url} every {args.interval:g} s ({args.scenario}). Ctrl+C to stop.")
    sent = 0
    with httpx.Client(base_url=args.url, timeout=10) as client:
        try:
            while args.count == 0 or sent < args.count:
                send_now = False
                try:
                    send_now = sim.send(client, key)
                except httpx.HTTPError as exc:
                    print(f"backend unreachable ({type(exc).__name__}), retrying; counters keep running")
                sim.save_state()
                sent += 1
                if not send_now:
                    time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
