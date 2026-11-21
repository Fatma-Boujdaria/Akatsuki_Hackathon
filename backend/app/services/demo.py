"""Jury demo: "Simulate spike" (POST /api/demo/spike).

The simulator stays the only writer of its readings (so its energy counter
never goes backwards). The backend just queues a command; the simulator
receives it in the response of its next POST /api/readings, adds the extra
power on the live curve and, because a 30 s demo cannot wait for real kWh
to pile up, compresses time: it adds enough kWh to enter the alert margin
of the next tranche. That is what makes the threshold alert and the tip
appear on stage, within ~10 s.
"""

import threading
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Device, Household
from app.services import consumption

MAX_DEMO_ENERGY_KWH = 150.0

_pending: dict[str, list[dict]] = {}
_lock = threading.Lock()


class DemoError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def queue_command(device_id: str, command: dict) -> None:
    with _lock:
        _pending.setdefault(device_id, []).append(command)


def pop_commands(device_id: str) -> list[dict]:
    with _lock:
        return _pending.pop(device_id, [])


def simulator_device(db: Session, household: Household) -> Device:
    """The simulator that feeds this household's dashboard."""
    if household.active_device_id:
        device = db.get(Device, household.active_device_id)
        if device is None or device.kind != "simulator":
            raise DemoError(409, "L'appareil actif est le vrai boîtier : choisis le simulateur dans les réglages.")
        return device
    device = db.scalar(
        select(Device).where(Device.household_id == household.id, Device.kind == "simulator").limit(1)
    )
    if device is None:
        raise DemoError(409, "Aucun simulateur enregistré pour ce foyer (lance scripts/seed_demo.py).")
    return device


def energy_to_reach_margin(db: Session, household: Household, now) -> float:
    """kWh needed so the month total enters the alert margin of the next threshold."""
    status = consumption.resource_status(db, household, "electricity", now)
    if status.next_threshold is None:
        return 1.0
    target = status.next_threshold - household.alert_margin_kwh + 1.0
    return round(min(MAX_DEMO_ENERGY_KWH, max(1.0, target - status.billed_qty)), 2)


def start_spike(
    db: Session, household: Household, now, extra_w: float, duration_s: int, energy_kwh: float | None
) -> dict:
    if not get_settings().demo_mode:
        raise DemoError(403, "Mode démo désactivé (DEMO_MODE=false).")
    device = simulator_device(db, household)
    energy = energy_kwh if energy_kwh is not None else energy_to_reach_margin(db, household, now)
    queue_command(device.id, {"type": "spike", "extra_w": extra_w, "duration_s": duration_s, "energy_kwh": energy})

    window = timedelta(seconds=get_settings().device_online_window_s)
    online = device.last_seen_at is not None and now - device.last_seen_at <= window
    message = (
        "Pic envoyé : il apparaîtra au prochain envoi du simulateur (5 s max)."
        if online
        else "Pic en attente : lance le simulateur (python -m simulator.simulator) pour le voir."
    )
    return {
        "status": "queued",
        "device_id": device.id,
        "simulator_online": online,
        "extra_w": extra_w,
        "duration_s": duration_s,
        "energy_kwh": energy,
        "message": message,
    }
