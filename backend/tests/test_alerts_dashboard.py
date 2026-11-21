"""Threshold, leak and offline alerts; acknowledgement; dashboard; chart series."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import Alert, Reading
from tests.conftest import login, make_user, payload, post_reading


def seed_month(db, start_kwh_per_slot: float, frozen, hours: int = 72, flow: float = 0.0) -> None:
    """Readings every 15 min for `hours` before now, each adding `start_kwh_per_slot`."""
    ts = frozen.now - timedelta(hours=hours)
    energy, water = 0.0, 0.0
    first = True
    while ts < frozen.now - timedelta(minutes=1):
        db.add(
            Reading(
                device_id="sim-001",
                ts=ts,
                power_w=start_kwh_per_slot * 4000,
                energy_kwh=energy,
                flow_l_min=flow,
                water_total_l=water,
                signal_ok=True,
                energy_delta_kwh=0.0 if first else start_kwh_per_slot,
                water_delta_l=0.0,
            )
        )
        energy += start_kwh_per_slot
        first = False
        ts += timedelta(minutes=15)
    db.commit()


def last_counters(db):
    r = db.scalar(select(Reading).order_by(Reading.ts.desc()))
    return r.energy_kwh, r.water_total_l


def test_threshold_alert_in_margin_fires_once(client, home, auth, db, frozen):
    # 191.5 kWh since 18 Nov (this month): within 10 kWh of 200.
    seed_month(db, 0.665, frozen, hours=72)
    energy, water = last_counters(db)
    post_reading(client, payload(frozen.now, energy_kwh=energy + 0.1, total_l=water))
    post_reading(client, payload(frozen.now + timedelta(seconds=5), energy_kwh=energy + 0.2, total_l=water))

    alerts = client.get("/api/alerts", headers=auth).json()
    threshold = [a for a in alerts if a["type"] == "threshold"]
    assert len(threshold) == 1
    assert threshold[0]["extra_cost_dt"] == pytest.approx(9.231, abs=0.001)
    assert "200 kWh" in threshold[0]["message"] and "estimation" in threshold[0]["message"]
    assert threshold[0]["is_estimate"] is True


def test_forecast_crossing_fires_before_the_margin(client, home, auth, db, frozen):
    # 3 days at ~1.6 kWh/h -> ~115 kWh now, forecast far above 200.
    seed_month(db, 0.4, frozen, hours=72)
    energy, water = last_counters(db)
    post_reading(client, payload(frozen.now, energy_kwh=energy + 0.1, total_l=water))
    alert = client.get("/api/alerts?status=active", headers=auth).json()[0]
    assert alert["type"] == "threshold" and "Au rythme actuel" in alert["message"]


def test_leak_alert_after_two_hours_of_night_flow(client, home, auth, db, frozen):
    # 03:30 local (02:30 UTC): flow since 01:00 local without a single zero.
    frozen.now = datetime(2026, 11, 21, 2, 30, tzinfo=timezone.utc)
    t = datetime(2026, 11, 20, 23, 0, tzinfo=timezone.utc)  # 00:00 local, flow still 0
    db.add(Reading(device_id="sim-001", ts=t, flow_l_min=0.0, water_total_l=100.0, signal_ok=True, water_delta_l=0.0))
    t += timedelta(minutes=15)
    total = 100.0
    while t < frozen.now:
        total += 0.5 * 15
        db.add(Reading(device_id="sim-001", ts=t, flow_l_min=0.5, water_total_l=total, signal_ok=True, water_delta_l=7.5))
        t += timedelta(minutes=15)
    db.commit()
    post_reading(client, payload(frozen.now, flow_l_min=0.5, total_l=total + 1))

    leak = [a for a in client.get("/api/alerts", headers=auth).json() if a["type"] == "leak"]
    assert len(leak) == 1 and leak[0]["severity"] == "critical"
    assert "00:15" in leak[0]["message"]  # flowing since 00:15 local


def test_no_leak_alert_during_the_day(client, home, auth, db, frozen):
    t = frozen.now - timedelta(hours=3)  # 13:00-16:00 local
    total = 0.0
    while t < frozen.now:
        total += 5
        db.add(Reading(device_id="sim-001", ts=t, flow_l_min=0.5, water_total_l=total, signal_ok=True, water_delta_l=5))
        t += timedelta(minutes=10)
    db.commit()
    post_reading(client, payload(frozen.now, flow_l_min=0.5, total_l=total + 1))
    assert not [a for a in client.get("/api/alerts", headers=auth).json() if a["type"] == "leak"]


def test_offline_device_alert_once_per_episode(client, home, auth, frozen):
    post_reading(client, payload(frozen.now))
    frozen.advance(minutes=10)
    first = client.get("/api/dashboard", headers=auth).json()
    assert first["device"]["online"] is False and first["live"]["stale"] is True
    client.get("/api/dashboard", headers=auth)
    offline = [a for a in client.get("/api/alerts", headers=auth).json() if a["type"] == "device_offline"]
    assert len(offline) == 1 and offline[0]["acknowledged_at"] is None
    post_reading(client, payload(frozen.now, energy_kwh=10.1))  # device back online
    active = client.get("/api/alerts?status=active", headers=auth).json()
    assert not [a for a in active if a["type"] == "device_offline"]


def test_acknowledge_only_own_alerts(client, home, auth, db, frozen):
    post_reading(client, payload(frozen.now, electricity=False))
    alert_id = client.get("/api/alerts", headers=auth).json()[0]["id"]

    make_user(db, "voisin@example.tn")
    other = login(client, "voisin@example.tn")
    assert client.post(f"/api/alerts/{alert_id}/ack", headers=other).status_code == 404
    assert client.get("/api/alerts", headers=other).json() == []

    acked = client.post(f"/api/alerts/{alert_id}/ack", headers=auth)
    assert acked.status_code == 200 and acked.json()["acknowledged_at"] is not None
    assert client.get("/api/alerts?status=active", headers=auth).json() == []


def test_dashboard_empty_state(client, home, auth):
    body = client.get("/api/dashboard", headers=auth).json()
    assert body["state"] == "empty" and body["live"] is None
    assert body["electricity"]["month_kwh"] == 0
    assert body["electricity"]["forecast"]["available"] is False


def test_dashboard_with_data(client, home, auth, db, frozen):
    seed_month(db, 0.1, frozen, hours=48)  # ~19 kWh in 2 days
    energy, water = last_counters(db)
    post_reading(client, payload(frozen.now, power_w=1380, energy_kwh=energy + 0.1, total_l=water))
    body = client.get("/api/dashboard", headers=auth).json()

    assert body["state"] == "ok" and body["device"]["online"] is True
    assert body["live"]["electricity"]["power_w"] == 1380 and body["live"]["electricity"]["reliable"]
    elec = body["electricity"]
    assert elec["tranche"]["index"] == 1 and elec["next_threshold_kwh"] == 200
    assert elec["kwh_to_next_threshold"] == pytest.approx(200 - elec["month_kwh"], abs=0.01)
    assert elec["next_kwh_price_dt"] == pytest.approx(0.198, abs=0.001)
    assert elec["crossing_extra_cost_dt"] == pytest.approx(9.231, abs=0.001)
    assert elec["bill_to_date"]["is_estimate"] is True and elec["is_estimate"] is True
    assert elec["forecast"]["available"] and elec["forecast"]["qty"] > elec["month_kwh"]
    assert "Estimation" in elec["forecast"]["assumption"]
    assert body["water"]["tariff_configured"] is False


def test_dashboard_never_shows_unreliable_values(client, home, auth, frozen):
    post_reading(client, payload(frozen.now, power_w=999, signal_ok=False))
    live = client.get("/api/dashboard", headers=auth).json()["live"]
    assert live["electricity"]["reliable"] is False and live["electricity"]["power_w"] is None
    assert live["water"]["flow_l_min"] is None


def test_series_raw_and_bucketed(client, home, auth, db, frozen):
    seed_month(db, 0.1, frozen, hours=48)
    raw = client.get("/api/readings?resource=electricity", headers=auth,
                     params={"from": (frozen.now - timedelta(hours=2)).isoformat()}).json()
    assert raw["bucket"] == "raw" and len(raw["points"]) == 8

    hourly = client.get("/api/readings", headers=auth, params={
        "resource": "electricity",
        "from": (frozen.now - timedelta(hours=24)).isoformat(),
        "to": frozen.now.isoformat(),
        "bucket": "hour",
    }).json()
    assert hourly["bucket"] == "hour" and len(hourly["points"]) == 24
    assert hourly["points"][0]["energy_kwh"] == pytest.approx(0.4)  # 4 slots of 0.1 kWh
    assert hourly["points"][0]["ts"].endswith("Z") or "+00:00" in hourly["points"][0]["ts"]

    daily = client.get("/api/readings", headers=auth, params={
        "resource": "water", "from": (frozen.now - timedelta(days=3)).isoformat(), "bucket": "day"}).json()
    assert daily["bucket"] == "day" and 2 <= len(daily["points"]) <= 3


def test_series_validation(client, home, auth, frozen):
    assert client.get("/api/readings", headers=auth, params={"from": "2026-01-01T00:00:00+01:00"}).status_code == 422
    assert client.get("/api/readings", headers=auth, params={"from": "2026-11-21T00:00:00"}).status_code == 422
