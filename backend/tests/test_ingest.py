"""POST /api/readings: authentication, validation rules, deltas, appliance steps."""

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.models import Alert, Device, Reading
from tests.conftest import ESP_KEY, SIM_KEY, payload, post_reading


def test_valid_reading_is_stored(client, home, db, frozen):
    response = post_reading(client, payload(frozen.now, energy_kwh=142.37, total_l=18420.5))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["device_id"] == "sim-001" and body["commands"] == []
    reading = db.scalar(select(Reading))
    assert reading.energy_kwh == 142.37 and reading.energy_delta_kwh == 0.0  # first reading: no baseline
    assert db.get(Device, "sim-001").last_seen_at == frozen.now


def test_blueprint_example_payload_is_accepted(client, home, frozen):
    example = {
        "device_id": "sim-001",
        "timestamp": "2026-11-21T16:00:00+01:00",
        "electricity": {
            "voltage_v": 231.2,
            "current_a": 6.4,
            "power_w": 1380,
            "energy_kwh": 142.37,
            "frequency_hz": 50.0,
            "power_factor": 0.93,
        },
        "water": {"flow_l_min": 6.2, "total_l": 18420.5, "pulses_delta": 230, "calib_pulses_per_l": 450},
        "signal_ok": True,
    }
    assert post_reading(client, example).status_code == 201


@pytest.mark.parametrize(
    ("headers", "code"),
    [({}, 401), ({"X-Device-Key": "wrong"}, 401)],
)
def test_device_key_is_required(client, home, frozen, headers, code):
    assert client.post("/api/readings", json=payload(frozen.now), headers=headers).status_code == code


def test_key_of_another_device_is_refused(client, home, frozen):
    # The ESP32's key cannot write readings for the simulator.
    response = post_reading(client, payload(frozen.now, device_id="sim-001"), key=ESP_KEY)
    assert response.status_code == 403


@pytest.mark.parametrize(
    ("block", "field", "value"),
    [
        ("electricity", "voltage_v", 301),
        ("electricity", "current_a", -1),
        ("electricity", "power_w", 23001),
        ("electricity", "frequency_hz", 44),
        ("electricity", "power_factor", 1.2),
        ("water", "flow_l_min", 61),
        ("water", "pulses_delta", -5),
        ("water", "total_l", -1),
    ],
)
def test_out_of_range_values_are_rejected(client, home, frozen, block, field, value):
    body = payload(frozen.now)
    body[block][field] = value
    assert post_reading(client, body).status_code == 422


def test_signal_ok_must_be_a_real_boolean_and_timestamp_needs_a_zone(client, home, frozen):
    body = payload(frozen.now)
    body["signal_ok"] = "true"
    assert post_reading(client, body).status_code == 422
    body = payload(frozen.now)
    body["timestamp"] = "2026-11-21T16:00:00"
    assert post_reading(client, body).status_code == 422


def test_future_and_duplicate_timestamps(client, home, frozen):
    assert post_reading(client, payload(frozen.now + timedelta(minutes=6))).status_code == 422
    assert post_reading(client, payload(frozen.now + timedelta(minutes=4))).status_code == 201
    assert post_reading(client, payload(frozen.now)).status_code == 409  # older than the last one


def test_counters_never_go_down_unless_reset(client, home, db, frozen):
    t = frozen.now
    assert post_reading(client, payload(t, energy_kwh=100.0, total_l=500)).status_code == 201
    assert post_reading(client, payload(t + timedelta(seconds=5), energy_kwh=100.5, total_l=503)).status_code == 201
    rejected = post_reading(client, payload(t + timedelta(seconds=10), energy_kwh=90.0, total_l=503))
    assert rejected.status_code == 422 and rejected.json()["detail"]["code"] == "counter_went_backwards"
    # Counter back near zero = meter reset: accepted, consumption since reset counted.
    assert post_reading(client, payload(t + timedelta(seconds=15), energy_kwh=0.2, total_l=1.0)).status_code == 201
    deltas = db.scalars(select(Reading.energy_delta_kwh).order_by(Reading.ts)).all()
    assert deltas == pytest.approx([0.0, 0.5, 0.2])
    water = db.scalars(select(Reading.water_delta_l).order_by(Reading.ts)).all()
    assert water == pytest.approx([0.0, 3.0, 1.0])


def test_unreliable_reading_is_kept_out_of_totals(client, home, db, frozen):
    t = frozen.now
    post_reading(client, payload(t, energy_kwh=10.0))
    post_reading(client, payload(t + timedelta(seconds=5), energy_kwh=55.0, signal_ok=False))  # garbage
    post_reading(client, payload(t + timedelta(seconds=10), energy_kwh=10.4))
    deltas = db.scalars(select(Reading.energy_delta_kwh).order_by(Reading.ts)).all()
    assert deltas[1] is None  # bad reading: no delta
    assert deltas[2] == pytest.approx(0.4)  # measured against the last GOOD reading


def test_missing_sensor_raises_one_fault_alert_per_day(client, home, db, frozen):
    t = frozen.now
    post_reading(client, payload(t, electricity=False))
    post_reading(client, payload(t + timedelta(seconds=5), electricity=False))
    alerts = db.scalars(select(Alert).where(Alert.type == "sensor_fault")).all()
    assert len(alerts) == 1 and alerts[0].resource == "electricity"


def test_power_step_is_labelled_as_probable_appliance(client, home, db, frozen):
    t = frozen.now
    post_reading(client, payload(t, power_w=300, energy_kwh=10.0))
    post_reading(client, payload(t + timedelta(seconds=5), power_w=2350, energy_kwh=10.01))
    last = db.scalar(select(Reading).order_by(Reading.ts.desc()))
    assert last.step_w == pytest.approx(2050)
    assert last.appliance_hint == "Chauffe-eau électrique ou bouilloire"


def test_ingest_is_rate_limited(client, home, frozen):
    codes = []
    for i in range(61):
        codes.append(post_reading(client, payload(frozen.now + timedelta(seconds=i), energy_kwh=10 + i / 100)).status_code)
    assert codes[-1] == 429 and set(codes[:-1]) == {201}


def test_non_active_device_is_recorded_without_alerts(client, home, db, frozen):
    # tg-001 is not the active device: its readings are stored but trigger nothing.
    body = payload(frozen.now, device_id="tg-001", electricity=False)
    assert post_reading(client, body, key=ESP_KEY).status_code == 201
    assert db.scalar(select(Alert)) is None
    assert post_reading(client, payload(frozen.now), key=SIM_KEY).status_code == 201
