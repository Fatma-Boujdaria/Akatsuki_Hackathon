"""Consumption status, trends and the appliance-profile breakdown.

Status of the household (spec 4.3), from the most to the least urgent:

| Status      | When                                                                   |
|-------------|------------------------------------------------------------------------|
| unavailable | no reading yet, device offline, or the last reading is unreliable      |
| critical    | a leak alert is open, or a tranche threshold was crossed this month    |
| warning     | the month total is inside the alert margin of the next threshold       |
| attention   | the forecast crosses the next threshold, or use rose 25 % or more      |
| normal      | none of the above                                                      |

Trend: average kWh per day over the last 7 days vs the 21 days before.
Breakdown: the declared appliances (a profile, never a measurement), with
their share of the forecast bill computed from the tariff module's total.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Alert, Household, Reading
from app.schemas import ApplianceShare, InsightsOut
from app.services import appliances as profile
from app.services import consumption

UNUSUAL_INCREASE_PCT = 25
MIN_KWH_PER_DAY = 1.0  # below this, a % change means nothing


def _per_day(db: Session, device_ids: list[str], column, start: datetime, end: datetime) -> float | None:
    days = (end - start).total_seconds() / 86400
    if days <= 0 or not device_ids:
        return None
    first = db.scalar(
        select(Reading.ts)
        .where(Reading.device_id.in_(device_ids), Reading.ts >= start, Reading.ts < end, column.is_not(None))
        .order_by(Reading.ts)
        .limit(1)
    )
    if first is None:
        return None
    if first.tzinfo is None:
        first = first.replace(tzinfo=end.tzinfo)
    covered = (end - max(start, first)).total_seconds() / 86400
    if covered < 1:  # less than a day of data in the window: no average
        return None
    return consumption.sum_readings(db, device_ids, column, start, end) / covered


def _trend(last: float | None, previous: float | None, floor: float) -> int | None:
    if last is None or previous is None or previous < floor:
        return None
    return round((last - previous) / previous * 100)


def build_insights(db: Session, household: Household, now: datetime) -> InsightsOut:
    settings = get_settings()
    device_ids = consumption.household_device_ids(db, household)
    statuses = consumption.household_status(db, household, now)
    elec, water = statuses["electricity"], statuses["water"]

    # Trends ------------------------------------------------------------------------
    week = now - timedelta(days=7)
    month_ago = now - timedelta(days=28)
    last7 = _per_day(db, device_ids, Reading.energy_delta_kwh, week, now)
    prev = _per_day(db, device_ids, Reading.energy_delta_kwh, month_ago, week)
    trend = _trend(last7, prev, MIN_KWH_PER_DAY)
    w_last7 = _per_day(db, device_ids, Reading.water_delta_l, week, now)
    w_prev = _per_day(db, device_ids, Reading.water_delta_l, month_ago, week)
    w_trend = _trend(w_last7, w_prev, 10.0)
    unusual = trend is not None and trend >= UNUSUAL_INCREASE_PCT

    # Profile breakdown ---------------------------------------------------------------
    items = profile.estimates(db, household)
    total_profile = profile.profile_kwh_month(items)
    bill = elec.forecast_bill or elec.bill_to_date
    breakdown = []
    for e in items:
        share = e.kwh_month / total_profile if total_profile else 0.0
        breakdown.append(
            ApplianceShare(
                id=e.appliance.id,
                category=e.appliance.category,
                name=e.appliance.name,
                kwh_month=e.kwh_month,
                share_pct=round(share * 100),
                cost_dt=round(bill.total_dt * share, 2) if bill is not None else None,
            )
        )

    # Status --------------------------------------------------------------------------
    latest = consumption.latest_reading(db, device_ids)
    open_alerts = list(
        db.scalars(select(Alert).where(Alert.household_id == household.id, Alert.acknowledged_at.is_(None)))
    )
    reasons: list[str] = []
    window = timedelta(seconds=settings.device_online_window_s)
    if latest is None:
        reasons.append("no_data")
    else:
        if now - latest.ts > window:
            reasons.append("offline")
        if not latest.signal_ok:
            reasons.append("unreliable")

    crossed = any(
        a.type == "threshold"
        and a.resource == "electricity"
        and a.params
        and elec.billed_qty >= float(a.params.get("threshold", 1e12))
        for a in open_alerts
    )
    if any(a.type == "leak" for a in open_alerts):
        reasons.append("leak")
    if crossed:
        reasons.append("crossed")
    near = elec.to_next_threshold is not None and elec.to_next_threshold <= household.alert_margin_kwh
    if near:
        reasons.append("near_threshold")
    forecast_crosses = (
        elec.next_threshold is not None
        and elec.billed_forecast is not None
        and elec.billed_forecast > elec.next_threshold
    )
    if forecast_crosses:
        reasons.append("forecast_crosses")
    if unusual:
        reasons.append("increase")

    if {"no_data", "offline", "unreliable"} & set(reasons):
        state = "unavailable"
    elif {"leak", "crossed"} & set(reasons):
        state = "critical"
    elif near:
        state = "warning"
    elif forecast_crosses or unusual:
        state = "attention"
    else:
        state = "normal"

    return InsightsOut(
        generated_at=now,
        profile_kwh_month=total_profile,
        measured_month_kwh=round(elec.usage.month_qty, 2),
        forecast_kwh=elec.usage.forecast_qty,
        forecast_bill_dt=elec.forecast_bill.total_dt if elec.forecast_bill else None,
        breakdown=breakdown,
        last7_kwh_per_day=None if last7 is None else round(last7, 2),
        previous_kwh_per_day=None if prev is None else round(prev, 2),
        trend_pct=trend,
        unusual_increase=unusual,
        water_last7_l_per_day=None if w_last7 is None else round(w_last7, 1),
        water_previous_l_per_day=None if w_prev is None else round(w_prev, 1),
        water_trend_pct=w_trend,
        water_forecast_l=water.usage.forecast_qty,
        status=state,
        status_reasons=reasons,
    )
