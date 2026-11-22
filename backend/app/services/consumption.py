"""Monthly totals and end-of-month forecast, per household.

Totals are a SUM of the per-reading deltas computed at ingest (see
ingest.py), so they stay correct across meter resets and device reboots.

Forecast "at the current rhythm": average consumption per hour over the last
7 days (a moving average), projected over the hours left in the month:

    forecast = consumed_this_month + rate_per_hour x hours_left

Supabase is far from the demo laptop (~70 ms per query), so both resources
are summed in ONE query with conditional aggregates.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app import clock
from app.config import get_settings
from app.models import Device, Household, Reading
from app.services import tariff as tariff_engine

MIN_FORECAST_HOURS = 1.0  # less than 1 h of data: no forecast, and we say so

DELTA_COLUMN = {"electricity": Reading.energy_delta_kwh, "water": Reading.water_delta_l}


def household_device_ids(db: Session, household: Household) -> list[str]:
    """Devices that feed the dashboard: the active one, or all of the home."""
    if household.active_device_id:
        return [household.active_device_id]
    return list(db.scalars(select(Device.id).where(Device.household_id == household.id)))


def sum_readings(db: Session, device_ids: list[str], column, start: datetime, end: datetime | None = None) -> float:
    if not device_ids:
        return 0.0
    query = select(func.coalesce(func.sum(column), 0.0)).where(
        Reading.device_id.in_(device_ids), Reading.ts >= start
    )
    if end is not None:
        query = query.where(Reading.ts < end)
    return float(db.scalar(query) or 0.0)


def latest_reading(db: Session, device_ids: list[str]) -> Reading | None:
    if not device_ids:
        return None
    return db.scalar(
        select(Reading).where(Reading.device_id.in_(device_ids)).order_by(Reading.ts.desc()).limit(1)
    )


@dataclass
class Usage:
    """Consumption of one resource this month (kWh, or litres for water)."""

    month_qty: float
    rate_per_hour: float | None
    forecast_qty: float | None
    window_hours: float  # hours of data behind the moving average
    hours_left: float

    @property
    def forecast_available(self) -> bool:
        return self.forecast_qty is not None


def month_usages(db: Session, device_ids: list[str], now: datetime) -> dict[str, Usage]:
    """This month's total and forecast for electricity and water, in one query."""
    settings = get_settings()
    month_start, month_end = clock.month_bounds(now)
    window_floor = now - timedelta(days=settings.forecast_window_days)
    hours_left = max(0.0, clock.hours_between(now, month_end))

    columns = []
    for col in DELTA_COLUMN.values():
        columns += [
            func.sum(case((Reading.ts >= month_start, col))),  # this month
            func.sum(case((Reading.ts >= window_floor, col))),  # last 7 days
            func.min(case((col.is_not(None), Reading.ts))),  # first data point in range
        ]
    row = None
    if device_ids:
        row = db.execute(
            select(*columns).where(
                Reading.device_id.in_(device_ids),
                Reading.ts >= min(month_start, window_floor),
                Reading.ts < month_end,
            )
        ).one()

    usages: dict[str, Usage] = {}
    for i, resource in enumerate(DELTA_COLUMN):
        month_sum, window_sum, first = row[3 * i : 3 * i + 3] if row else (None, None, None)
        so_far = float(month_sum or 0.0)
        if first is None:
            usages[resource] = Usage(round(so_far, 3), None, None, 0.0, hours_left)
            continue
        if first.tzinfo is None:  # SQLite returns text-backed values without zone
            first = first.replace(tzinfo=now.tzinfo)
        window_start = max(window_floor, first)
        window_hours = clock.hours_between(window_start, now)
        if window_hours < MIN_FORECAST_HOURS:
            usages[resource] = Usage(round(so_far, 3), None, None, max(0.0, window_hours), hours_left)
            continue
        rate = float(window_sum or 0.0) / window_hours
        usages[resource] = Usage(
            month_qty=round(so_far, 3),
            rate_per_hour=rate,
            forecast_qty=round(so_far + rate * hours_left, 3),
            window_hours=window_hours,
            hours_left=hours_left,
        )
    return usages


@dataclass
class ResourceStatus:
    """Everything the dashboard, alerts and tips need about one resource."""

    resource: str
    month: str
    usage: Usage
    qty_unit: str  # unit of usage.month_qty: "kWh" or "L"
    tariff: tariff_engine.Tariff | None
    billed_qty: float  # month_qty in the tariff unit (kWh, or m3 for water)
    billed_forecast: float | None
    tranche: tariff_engine.Tranche | None = None
    next_threshold: float | None = None
    to_next_threshold: float | None = None
    unit_price_dt: float | None = None
    crossing_extra_cost_dt: float | None = None
    bill_to_date: tariff_engine.Bill | None = None
    forecast_bill: tariff_engine.Bill | None = None


def build_status(household: Household, resource: str, usage: Usage, now: datetime, db: Session) -> ResourceStatus:
    settings = get_settings()
    to_tariff_unit = 1.0 if resource == "electricity" else 1 / 1000.0  # SONEDE bills in m3
    tariff = tariff_engine.load_tariff(db, resource, clock.local_date(now), settings.tariff_pricing_mode)
    if tariff is not None:
        tariff = tariff.for_home(float(household.subscribed_kva))  # economique grid for 1-2 kVA
    billed = usage.month_qty * to_tariff_unit
    billed_forecast = None if usage.forecast_qty is None else usage.forecast_qty * to_tariff_unit
    status = ResourceStatus(
        resource=resource,
        month=clock.month_key(now),
        usage=usage,
        qty_unit="kWh" if resource == "electricity" else "L",
        tariff=tariff,
        billed_qty=billed,
        billed_forecast=billed_forecast,
    )
    if tariff is None or not tariff.tranches:
        return status

    kva = float(household.subscribed_kva) if resource == "electricity" else 0.0
    status.tranche = tariff.tranche_for(billed)
    status.next_threshold = tariff.next_threshold(billed)
    if status.next_threshold is not None:
        status.to_next_threshold = round(status.next_threshold - billed, 3)
        status.crossing_extra_cost_dt = tariff_engine.crossing_extra_cost_dt(tariff, status.next_threshold, kva)
    status.unit_price_dt = tariff_engine.unit_price_dt(tariff, billed)
    status.bill_to_date = tariff_engine.compute_bill(tariff, billed, kva)
    if billed_forecast is not None:
        status.forecast_bill = tariff_engine.compute_bill(tariff, billed_forecast, kva)
    return status


def household_status(db: Session, household: Household, now: datetime) -> dict[str, ResourceStatus]:
    """Status of both resources: {"electricity": ..., "water": ...}."""
    usages = month_usages(db, household_device_ids(db, household), now)
    return {r: build_status(household, r, usages[r], now, db) for r in DELTA_COLUMN}


def resource_status(db: Session, household: Household, resource: str, now: datetime) -> ResourceStatus:
    return household_status(db, household, now)[resource]
