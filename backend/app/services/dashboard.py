"""Builds the GET /api/dashboard answer: live values, tranche, forecast, alerts.

One call gives the main screen everything it needs. The frontend polls it
every 2-3 s, which keeps "new reading visible within 5 s".
"""

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock
from app.config import get_settings
from app.models import Alert, Device, Household, Reading
from app.schemas import (
    AlertOut,
    BillOut,
    DashboardOut,
    DeviceStatus,
    ElectricitySummary,
    ForecastOut,
    HeavyConsumer,
    LiveElectricity,
    LiveOut,
    LiveWater,
    TrancheOut,
    WaterSummary,
)
from app.services import alerts as alert_rules
from app.services import consumption
from app.services.consumption import ResourceStatus


def device_status(device: Device, now: datetime) -> DeviceStatus:
    window = timedelta(seconds=get_settings().device_online_window_s)
    online = device.last_seen_at is not None and now - device.last_seen_at <= window
    return DeviceStatus(
        id=device.id,
        kind=device.kind,
        last_seen_at=device.last_seen_at,
        online=online,
        calib_pulses_per_l=device.calib_pulses_per_l,
    )


def _bill(bill) -> BillOut | None:
    return None if bill is None else BillOut(**bill.__dict__)


def _tranche(t) -> TrancheOut | None:
    return None if t is None else TrancheOut(**t.__dict__)


def _forecast(status: ResourceStatus) -> ForecastOut:
    usage = status.usage
    if not usage.forecast_available:
        return ForecastOut(
            available=False, qty=None, bill=None, assumption="Pas encore assez de mesures (1 h minimum)."
        )
    if usage.window_hours >= 48:
        basis = f"au rythme moyen des {round(usage.window_hours / 24)} derniers jours"
    else:
        basis = f"au rythme moyen des {max(1, round(usage.window_hours))} dernières heures"
    return ForecastOut(
        available=True,
        qty=usage.forecast_qty,
        bill=_bill(status.forecast_bill),
        assumption=f"Estimation de fin de mois {basis}.",
    )


def _live(reading: Reading, now: datetime) -> LiveOut:
    age = (now - reading.ts).total_seconds()
    elec_fault = reading.power_w is None and reading.energy_kwh is None
    water_fault = reading.flow_l_min is None and reading.water_total_l is None
    elec_ok = reading.signal_ok and not elec_fault
    water_ok = reading.signal_ok and not water_fault
    # Unreliable or missing: values stay null ("mesure peu fiable", never a made-up value).
    return LiveOut(
        ts=reading.ts,
        age_s=round(max(0.0, age), 1),
        stale=age > get_settings().device_online_window_s,
        electricity=LiveElectricity(
            reliable=elec_ok,
            fault=elec_fault,
            power_w=reading.power_w if elec_ok else None,
            voltage_v=reading.voltage_v if elec_ok else None,
            current_a=reading.current_a if elec_ok else None,
            power_factor=reading.power_factor if elec_ok else None,
            frequency_hz=reading.frequency_hz if elec_ok else None,
        ),
        water=LiveWater(
            reliable=water_ok,
            fault=water_fault,
            flow_l_min=reading.flow_l_min if water_ok else None,
            total_l=reading.water_total_l if water_ok else None,
        ),
    )


def heavy_consumers(db: Session, device_ids: list[str], now: datetime) -> list[HeavyConsumer]:
    if not device_ids:
        return []
    day_start, _ = clock.day_bounds(clock.local_date(now))
    rows = db.execute(
        select(
            Reading.appliance_hint,
            func.count(),
            func.avg(Reading.step_w),
            func.max(Reading.ts),
        )
        .where(Reading.device_id.in_(device_ids), Reading.ts >= day_start, Reading.appliance_hint.is_not(None))
        .group_by(Reading.appliance_hint)
        .order_by(func.count().desc())
        .limit(5)
    ).all()
    return [
        HeavyConsumer(label=label, typical_w=round(float(avg_w), 0), starts_today=count, last_seen_at=last)
        for label, count, avg_w, last in rows
    ]


def active_alerts(db: Session, household: Household, limit: int = 10) -> list[Alert]:
    return list(
        db.scalars(
            select(Alert)
            .where(Alert.household_id == household.id, Alert.acknowledged_at.is_(None))
            .order_by(Alert.created_at.desc())
            .limit(limit)
        )
    )


def build_dashboard(db: Session, household: Household, now: datetime) -> DashboardOut:
    alert_rules.check_devices_offline(db, household, now)
    db.commit()

    device_ids = consumption.household_device_ids(db, household)
    latest = consumption.latest_reading(db, device_ids)
    device = db.get(Device, latest.device_id if latest else (device_ids[0] if device_ids else ""))

    statuses = consumption.household_status(db, household, now)
    elec, water = statuses["electricity"], statuses["water"]
    alerts = active_alerts(db, household)

    return DashboardOut(
        generated_at=now,
        state="ok" if latest else "empty",
        household_id=household.id,
        household_name=household.name,
        subscribed_kva=float(household.subscribed_kva),
        device=device_status(device, now) if device else None,
        live=_live(latest, now) if latest else None,
        electricity=ElectricitySummary(
            month=elec.month,
            month_kwh=round(elec.usage.month_qty, 2),
            thresholds_kwh=elec.tariff.thresholds if elec.tariff else [],
            tranche=_tranche(elec.tranche),
            next_threshold_kwh=elec.next_threshold,
            kwh_to_next_threshold=elec.to_next_threshold,
            next_kwh_price_dt=elec.unit_price_dt,
            crossing_extra_cost_dt=elec.crossing_extra_cost_dt,
            bill_to_date=_bill(elec.bill_to_date),
            forecast=_forecast(elec),
        ),
        water=WaterSummary(
            month=water.month,
            month_l=round(water.usage.month_qty, 1),
            tariff_configured=water.tariff is not None,
            tranche=_tranche(water.tranche),
            next_threshold_m3=water.next_threshold,
            bill_to_date=_bill(water.bill_to_date),
            forecast=_forecast(water),
            leak_suspected=any(a.type == "leak" for a in alerts),
        ),
        active_alerts=[AlertOut.model_validate(a) for a in alerts],
        heavy_consumers=heavy_consumers(db, device_ids, now),
    )
