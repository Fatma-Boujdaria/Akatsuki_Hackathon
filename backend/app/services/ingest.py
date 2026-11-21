"""Storing one device reading: checks, deltas, appliance guess, alerts.

Order of operations for every POST /api/readings:
 1. Pydantic already checked types and ranges (schemas.ReadingIn) -> else 422.
 2. The key's device must be the payload's device_id                -> else 403.
 3. Timestamp at most 5 min in the future                          -> else 422.
 4. Timestamp newer than the device's last reading                 -> else 409.
 5. Cumulative counters (energy_kwh, total_l) never go down, unless
    they restarted near zero (meter or flash reset)                -> else 422.
 6. Compute deltas since the previous good reading (monthly totals).
 7. Detect a power step (probable appliance).
 8. Store the row, update device.last_seen_at, close its "offline" alerts.
 9. Run the alert rules; refresh tips if a threshold alert fired.

A rejected reading is logged and never reaches the tariff engine.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Alert, Device, Reading
from app.schemas import ReadingIn
from app.services import alerts as alert_rules

log = logging.getLogger(__name__)

MAX_FUTURE = timedelta(minutes=5)
ENERGY_RESET_TOLERANCE_KWH = 1.0  # a counter that drops to below 1 kWh was reset
WATER_RESET_TOLERANCE_L = 5.0
STEP_MIN_W = 800  # smaller power jumps are not "heavy consumers"
STEP_MAX_GAP = timedelta(seconds=60)  # compare only with a recent reading

# Probable appliance from the size of a power step (Should feature, a guess).
APPLIANCE_SIGNATURES: list[tuple[float, float, str]] = [
    (800, 1300, "Climatiseur ou micro-ondes"),
    (1300, 1800, "Climatiseur ou fer à repasser"),
    (1800, 2600, "Chauffe-eau électrique ou bouilloire"),
    (2600, 4000, "Four, radiateur ou plaque de cuisson"),
    (4000, float("inf"), "Plusieurs gros appareils"),
]


class IngestError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


@dataclass
class IngestResult:
    reading: Reading
    alerts: list[Alert] = field(default_factory=list)


def guess_appliance(step_w: float) -> str | None:
    for low, high, label in APPLIANCE_SIGNATURES:
        if low <= step_w < high:
            return label
    return None


def counter_delta(new: float, previous: float | None, reset_tolerance: float, name: str) -> float:
    """Consumption since the previous value of a cumulative counter."""
    if previous is None:
        return 0.0  # first reading of this device: nothing to compare with
    if new >= previous:
        return new - previous
    if new <= reset_tolerance:
        return new  # counter restarted from zero: everything counted since is new
    raise IngestError(422, "counter_went_backwards", f"{name} {new} is lower than the previous value {previous}")


def _previous_good(db: Session, device_id: str, column, last: Reading | None) -> Reading | None:
    """Latest reliable reading that has a value in `column` (usually just `last`)."""
    if last is not None and last.signal_ok and getattr(last, column.key) is not None:
        return last
    return db.scalar(
        select(Reading)
        .where(Reading.device_id == device_id, Reading.signal_ok.is_(True), column.is_not(None))
        .order_by(Reading.ts.desc())
        .limit(1)
    )


def ingest_reading(db: Session, device: Device, payload: ReadingIn, now: datetime) -> IngestResult:
    if payload.device_id != device.id:
        raise IngestError(403, "device_mismatch", "This API key belongs to another device")

    ts = payload.timestamp.astimezone(now.tzinfo)
    if ts > now + MAX_FUTURE:
        raise IngestError(422, "timestamp_in_future", "timestamp is more than 5 minutes in the future")

    last = db.scalar(select(Reading).where(Reading.device_id == device.id).order_by(Reading.ts.desc()).limit(1))
    if last is not None and ts <= last.ts:
        raise IngestError(409, "stale_timestamp", "timestamp is not newer than the last stored reading")

    elec, water = payload.electricity, payload.water
    reading = Reading(device_id=device.id, ts=ts, signal_ok=payload.signal_ok)
    if elec is not None:
        reading.voltage_v = elec.voltage_v
        reading.current_a = elec.current_a
        reading.power_w = elec.power_w
        reading.energy_kwh = elec.energy_kwh
        reading.frequency_hz = elec.frequency_hz
        reading.power_factor = elec.power_factor
    if water is not None:
        reading.flow_l_min = water.flow_l_min
        reading.water_total_l = water.total_l
        reading.pulses_delta = water.pulses_delta

    # Deltas and steps only from reliable readings: never build totals on bad data.
    if payload.signal_ok and elec is not None:
        prev = _previous_good(db, device.id, Reading.energy_kwh, last)
        reading.energy_delta_kwh = counter_delta(
            elec.energy_kwh, prev.energy_kwh if prev else None, ENERGY_RESET_TOLERANCE_KWH, "energy_kwh"
        )
        if prev is not None and prev.power_w is not None and ts - prev.ts <= STEP_MAX_GAP:
            step = elec.power_w - prev.power_w
            if step >= STEP_MIN_W:
                reading.step_w = round(step, 1)
                reading.appliance_hint = guess_appliance(step)
    if payload.signal_ok and water is not None:
        prev = _previous_good(db, device.id, Reading.water_total_l, last)
        reading.water_delta_l = counter_delta(
            water.total_l, prev.water_total_l if prev else None, WATER_RESET_TOLERANCE_L, "total_l"
        )

    db.add(reading)
    device.last_seen_at = now
    # The device is back: close its open "offline" alerts.
    db.execute(
        update(Alert)
        .where(
            Alert.household_id == device.household_id,
            Alert.type == "device_offline",
            Alert.dedupe_key.like(f"offline:{device.id}:%"),
            Alert.acknowledged_at.is_(None),
        )
        .values(acknowledged_at=now)
    )
    if water is not None and water.calib_pulses_per_l:
        device.calib_pulses_per_l = water.calib_pulses_per_l
    db.flush()

    result = IngestResult(reading=reading)
    household = device.household
    if household.active_device_id in (None, device.id):  # a non-active device is only recorded
        result.alerts = alert_rules.evaluate_reading(
            db,
            household,
            device,
            reading,
            now,
            electricity_missing=elec is None,
            water_missing=water is None,
        )
        if any(a.type == "threshold" for a in result.alerts):
            # New tranche warning: compute fresh tips now so "Voir le conseil" shows
            # one immediately. No LLM here: the device must get its answer fast.
            from app.services import tips  # imported here to avoid a circular import

            tips.refresh_tips(db, household, now, force=True, use_llm=False)
    db.commit()
    return result
