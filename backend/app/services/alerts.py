"""Alert rules. Run after every stored reading (and on dashboard reads for offline).

| Type           | Fires when                                                       | Once per            |
|----------------|------------------------------------------------------------------|---------------------|
| threshold      | month kWh within the margin (10 kWh) of 200/300/500, or the      | threshold and month |
|                | end-of-month forecast crosses it                                 |                     |
| leak           | water flows without a stop for 2 h inside the 01:00-05:00 window | device and night    |
| sensor_fault   | the payload says a sensor did not answer (block is null)         | device, sensor, day |
| device_offline | no reading for 5 min                                             | offline episode     |

"Once per" is enforced with a unique (household_id, dedupe_key) in the
database, so two readings arriving together can never create duplicates.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import clock
from app.config import get_settings
from app.models import Alert, Device, Household, Reading
from app.services import consumption, fmt

log = logging.getLogger(__name__)


def create_alert_once(
    db: Session,
    household: Household,
    *,
    type: str,
    resource: str | None,
    severity: str,
    message: str,
    dedupe_key: str,
    extra_cost_dt: float | None = None,
    params: dict | None = None,
) -> Alert | None:
    """Insert the alert unless one with the same dedupe_key exists. Returns it or None."""
    exists = db.scalar(
        select(Alert.id).where(Alert.household_id == household.id, Alert.dedupe_key == dedupe_key)
    )
    if exists is not None:
        return None
    alert = Alert(
        household_id=household.id,
        type=type,
        resource=resource,
        severity=severity,
        message=message,
        dedupe_key=dedupe_key,
        extra_cost_dt=extra_cost_dt,
        params=params,
        created_at=clock.now_utc(),
    )
    try:
        with db.begin_nested():  # savepoint: a duplicate only cancels this insert
            db.add(alert)
            db.flush()
    except IntegrityError:
        return None
    log.info("alert %s for household %s: %s", dedupe_key, household.id, message)
    return alert


# --- Threshold (tranche) alerts -------------------------------------------------------


def check_threshold(db: Session, household: Household, status: consumption.ResourceStatus) -> Alert | None:
    resource = status.resource
    if status.tariff is None or status.next_threshold is None:
        return None  # no grid (water not configured yet) or already above the last band

    threshold = status.next_threshold
    used = status.billed_qty
    forecast = status.billed_forecast
    unit = "kWh" if resource == "electricity" else "m3"
    # Electricity margin comes from the settings (default 10 kWh); water uses 5 %.
    margin = household.alert_margin_kwh if resource == "electricity" else 0.05 * threshold

    near = used >= threshold - margin
    forecast_crosses = forecast is not None and forecast > threshold
    if not (near or forecast_crosses):
        return None

    extra = status.crossing_extra_cost_dt or 0.0
    left = max(0.0, threshold - used)
    if near:
        message = (
            f"Encore {fmt.num(left, 1 if left < 10 else 0)} {unit} avant la tranche suivante "
            f"({fmt.num(threshold)} {unit}). La franchir coûterait environ {fmt.dt(extra)} "
            f"de plus sur ta facture du mois (estimation)."
        )
    else:
        message = (
            f"Au rythme actuel, tu vas dépasser {fmt.num(threshold)} {unit} ce mois-ci "
            f"(prévision : {fmt.num(forecast or 0)} {unit}). Passer cette tranche coûterait "
            f"environ {fmt.dt(extra)} de plus (estimation)."
        )
    return create_alert_once(
        db,
        household,
        type="threshold",
        resource=resource,
        severity="warning",
        message=message,
        dedupe_key=f"threshold:{resource}:{threshold:g}:{status.month}",
        extra_cost_dt=extra,
        params={
            "variant": "near" if near else "forecast",
            "unit": unit,
            "threshold": threshold,
            "used": round(used, 3),
            "left": round(left, 3),
            "forecast": None if forecast is None else round(forecast, 3),
            "extra_dt": extra,
            "next_unit_price_dt": status.unit_price_dt,
        },
    )


# --- Leak alert -------------------------------------------------------------------------


def in_window(hour: int, start: int, end: int) -> bool:
    """True if `hour` is inside [start, end), handling windows across midnight (23 -> 5)."""
    if start == end:
        return False
    return start <= hour < end if start < end else (hour >= start or hour < end)


def window_start(local_ts: datetime, start_hour: int, end_hour: int) -> datetime:
    """Local datetime when the current night window opened."""
    opened = local_ts.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    if start_hour > end_hour and local_ts.hour < end_hour:  # window started yesterday
        opened -= timedelta(days=1)
    return opened


def check_leak(db: Session, household: Household, device: Device, reading: Reading) -> Alert | None:
    if not reading.signal_ok or not reading.flow_l_min or reading.flow_l_min <= 0:
        return None
    local_ts = clock.to_local(reading.ts)
    start_h, end_h = household.leak_start_hour, household.leak_end_hour
    if not in_window(local_ts.hour, start_h, end_h):
        return None

    # When did the flow start? Just after the last reliable "zero flow" reading.
    last_zero = db.scalar(
        select(func.max(Reading.ts)).where(
            Reading.device_id == device.id,
            Reading.ts < reading.ts,
            Reading.signal_ok.is_(True),
            Reading.flow_l_min == 0,
        )
    )
    since_query = select(func.min(Reading.ts)).where(
        Reading.device_id == device.id, Reading.flow_l_min > 0, Reading.ts <= reading.ts
    )
    if last_zero is not None:
        since_query = since_query.where(Reading.ts > last_zero)
    since = db.scalar(since_query) or reading.ts

    opened = window_start(local_ts, start_h, end_h)
    flowing_in_window_min = (reading.ts - max(since, opened)).total_seconds() / 60
    if flowing_in_window_min < household.leak_min_minutes:
        return None

    litres = consumption.sum_readings(db, [device.id], Reading.water_delta_l, since)
    total_min = (reading.ts - since).total_seconds() / 60
    message = (
        f"Fuite probable : l'eau coule sans arrêt depuis {clock.to_local(since):%H:%M} "
        f"({fmt.duration(total_min)}), environ {fmt.litres(litres)} utilisés. "
        f"Vérifie la chasse d'eau et les robinets."
    )
    return create_alert_once(
        db,
        household,
        type="leak",
        resource="water",
        severity="critical",
        message=message,
        dedupe_key=f"leak:water:{device.id}:{window_start(local_ts, start_h, end_h).date().isoformat()}",
        params={
            "since": f"{clock.to_local(since):%H:%M}",
            "minutes": round(total_min),
            "litres": round(litres, 1),
            "device": device.id,
        },
    )


# --- Sensor fault and offline -----------------------------------------------------------


def check_sensor_faults(
    db: Session, household: Household, device: Device, now: datetime, electricity_missing: bool, water_missing: bool
) -> list[Alert]:
    day = clock.local_date(now).isoformat()
    created = []
    for resource, missing, label in (
        ("electricity", electricity_missing, "électricité (PZEM-004T)"),
        ("water", water_missing, "eau (YF-S201)"),
    ):
        if not missing:
            continue
        alert = create_alert_once(
            db,
            household,
            type="sensor_fault",
            resource=resource,
            severity="warning",
            message=f"Le capteur {label} de l'appareil {device.id} ne répond pas. Vérifie son câblage.",
            dedupe_key=f"sensor_fault:{resource}:{device.id}:{day}",
            params={"sensor": resource, "device": device.id},
        )
        if alert:
            created.append(alert)
    return created


def check_devices_offline(db: Session, household: Household, now: datetime) -> list[Alert]:
    """Called on dashboard/alerts reads: a silent device sends nothing we could react to."""
    limit = timedelta(seconds=get_settings().offline_alert_after_s)
    created = []
    for device_id in consumption.household_device_ids(db, household):
        device = db.get(Device, device_id)
        if device is None or device.last_seen_at is None or now - device.last_seen_at < limit:
            continue
        alert = create_alert_once(
            db,
            household,
            type="device_offline",
            resource=None,
            severity="warning",
            message=(
                f"Appareil {device.id} hors ligne depuis {clock.to_local(device.last_seen_at):%d/%m %H:%M}. "
                f"Vérifie le Wi-Fi et l'alimentation."
            ),
            dedupe_key=f"offline:{device.id}:{device.last_seen_at.isoformat()}",
            params={"device": device.id, "since": device.last_seen_at.isoformat()},
        )
        if alert:
            created.append(alert)
    return created


def evaluate_reading(
    db: Session,
    household: Household,
    device: Device,
    reading: Reading,
    now: datetime,
    *,
    electricity_missing: bool,
    water_missing: bool,
) -> list[Alert]:
    """All rules that can fire right after a new reading."""
    created = check_sensor_faults(db, household, device, now, electricity_missing, water_missing)
    for status in consumption.household_status(db, household, now).values():
        alert = check_threshold(db, household, status)
        if alert:
            created.append(alert)
    leak = check_leak(db, household, device, reading)
    if leak:
        created.append(leak)
    return created
