"""Monthly history: kWh, litres and the estimated bill of each past month.

One grouped query (per local calendar month) instead of one query per month,
then the tariff valid on the 1st of each month prices it.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock
from app.config import get_settings
from app.models import Household, Reading
from app.schemas import HistoryMonth, HistoryOut
from app.services import consumption
from app.services import tariff as tariff_engine


def _month_expr(dialect: str):
    if dialect == "postgresql":
        return func.to_char(func.timezone(get_settings().timezone, Reading.ts), "YYYY-MM")
    # SQLite (tests, local): UTC text + the fixed Tunisian offset (no DST).
    offset_h = int(clock.now_utc().astimezone(clock.local_tz()).utcoffset().total_seconds() // 3600)
    return func.strftime("%Y-%m", Reading.ts, f"{offset_h:+d} hours")


def month_keys(now: datetime, months: int) -> list[str]:
    first = clock.local_date(now).replace(day=1)
    keys = []
    for _ in range(months):
        keys.append(first.strftime("%Y-%m"))
        first = (first - timedelta(days=1)).replace(day=1)
    return list(reversed(keys))


def build_history(db: Session, household: Household, now: datetime, months: int = 12) -> HistoryOut:
    settings = get_settings()
    keys = month_keys(now, months)
    start_day = date.fromisoformat(f"{keys[0]}-01")
    start = clock.local_midnight_utc(start_day)
    device_ids = consumption.household_device_ids(db, household)

    totals: dict[str, tuple[float, float]] = {}
    if device_ids:
        expr = _month_expr(db.get_bind().dialect.name)
        rows = db.execute(
            select(
                expr,
                func.coalesce(func.sum(Reading.energy_delta_kwh), 0.0),
                func.coalesce(func.sum(Reading.water_delta_l), 0.0),
            )
            .where(Reading.device_id.in_(device_ids), Reading.ts >= start)
            .group_by(expr)
        ).all()
        totals = {str(m): (float(k or 0), float(w or 0)) for m, k, w in rows}

    current = clock.month_key(now)
    kva = float(household.subscribed_kva)
    out = []
    for key in keys:
        kwh, litres = totals.get(key, (0.0, 0.0))
        first = date.fromisoformat(f"{key}-01")
        elec_tariff = tariff_engine.load_tariff(db, "electricity", first, settings.tariff_pricing_mode)
        water_tariff = tariff_engine.load_tariff(db, "water", first, settings.tariff_pricing_mode)
        bill = tariff_engine.compute_bill(elec_tariff, kwh, kva) if elec_tariff and kwh > 0 else None
        water_bill = (
            tariff_engine.compute_bill(water_tariff, litres / 1000) if water_tariff and water_tariff.tranches and litres > 0 else None
        )
        out.append(
            HistoryMonth(
                month=key,
                kwh=round(kwh, 2),
                litres=round(litres, 1),
                bill_dt=bill.total_dt if bill else None,
                water_bill_dt=water_bill.total_dt if water_bill else None,
                tranche_index=bill.tranche_index if bill else None,
                partial=key == current,
            )
        )
    return HistoryOut(months=out)
