"""End-to-end, as on stage: seeded month -> simulator -> spike -> alert and tip.

Also the night-flow leak through the simulator, and the seed script itself.
"""

from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.models import Device, Reading, User
from scripts import seed_demo
from simulator.simulator import Simulator
from tests.conftest import SIM_KEY


def test_spike_to_alert_and_tip(client, home, auth, db, frozen):
    count = seed_demo.backfill_history(db, home, "sim-001", target_ratio=0.75)
    db.commit()
    assert count > 1000  # 20 days of 15-min readings

    before = client.get("/api/dashboard", headers=auth).json()["electricity"]
    assert before["forecast"]["qty"] < 200  # demo starts below the threshold...
    assert not client.get("/api/alerts", headers=auth).json()  # ...with no alert

    sim = Simulator("sim-001", seed=1)
    frozen.advance(seconds=5)
    sim.send(client, SIM_KEY, now=frozen.now)  # first live reading (counter reset accepted)

    spike = client.post("/api/demo/spike", headers=auth)
    assert spike.status_code == 202 and spike.json()["simulator_online"] is True
    needed = spike.json()["energy_kwh"]
    assert needed > 10

    frozen.advance(seconds=5)
    assert sim.send(client, SIM_KEY, now=frozen.now) is True  # got the command -> send again at once
    frozen.advance(seconds=1)
    sim.send(client, SIM_KEY, now=frozen.now)  # spike reading

    dashboard = client.get("/api/dashboard", headers=auth).json()
    assert dashboard["live"]["electricity"]["power_w"] > 3500  # visible on the live curve
    alert = next(a for a in dashboard["active_alerts"] if a["type"] == "threshold")
    assert alert["extra_cost_dt"] == pytest.approx(9.231, abs=0.001)
    tips = client.get("/api/tips", headers=auth).json()
    assert tips[0]["code"] in {"threshold", "keep_pace"} and tips[0]["saving_dt"] > 0


def test_spike_needs_demo_mode_and_a_simulator(client, home, auth, db, monkeypatch):
    client.put("/api/settings", headers=auth, json={"active_device_id": "tg-001"})
    assert client.post("/api/demo/spike", headers=auth).status_code == 409
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "demo_mode", False)
    assert client.post("/api/demo/spike", headers=auth).status_code == 403


def test_simulated_night_leak(client, home, auth, db, frozen):
    # Demo trick from the blueprint: the leak window is adjustable. Make "now" the night.
    client.put("/api/settings", headers=auth, json={"leak_start_hour": 15, "leak_end_hour": 23, "leak_min_minutes": 2})
    sim = Simulator("sim-001", scenario="leak", seed=3)
    for _ in range(30):  # 2.5 min of constant flow
        frozen.advance(seconds=5)
        sim.send(client, SIM_KEY, now=frozen.now)
    leak = [a for a in client.get("/api/alerts", headers=auth).json() if a["type"] == "leak"]
    assert len(leak) == 1
    assert client.get("/api/dashboard", headers=auth).json()["water"]["leak_suspected"] is True
    assert any(t["code"] == "leak" for t in client.get("/api/tips", headers=auth).json())


def test_seed_script_is_idempotent(db, frozen, capsys):
    assert seed_demo.main(["--email", "demo@example.tn", "--password", "demo-pass-123", "--admin-email", "admin@example.tn"]) == 0
    assert seed_demo.main(["--email", "demo@example.tn"]) == 0
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(User)) == 2
    assert db.scalar(select(func.count()).select_from(Device)) == 2
    readings = db.scalar(select(func.count()).select_from(Reading))
    assert readings > 1000
    out = capsys.readouterr().out
    assert "tg-001 (esp32): key = " in out  # ESP32 key printed once, at creation
    assert out.count("tg-001 (esp32): key = ") == 1

    assert seed_demo.main(["--email", "demo@example.tn", "--reset"]) == 0
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Reading)) == readings  # wiped then re-seeded
