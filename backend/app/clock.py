"""Time helpers. Bills are monthly in Tunisian local time (Africa/Tunis).

Readings are stored in UTC; months, days and the night leak window are
computed in local time. Always call `clock.now_utc()` (never datetime.now()
directly) so tests can freeze the time.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config import get_settings


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def local_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().timezone)


def to_local(dt: datetime) -> datetime:
    return dt.astimezone(local_tz())


def local_date(dt: datetime) -> date:
    return to_local(dt).date()


def local_midnight_utc(day: date) -> datetime:
    """UTC instant of 00:00 local time on `day`."""
    return datetime.combine(day, time.min, tzinfo=local_tz()).astimezone(timezone.utc)


def month_bounds(now: datetime) -> tuple[datetime, datetime]:
    """[start, end) of the local calendar month containing `now`, in UTC."""
    d = local_date(now)
    first = d.replace(day=1)
    next_first = (first + timedelta(days=32)).replace(day=1)
    return local_midnight_utc(first), local_midnight_utc(next_first)


def day_bounds(day: date) -> tuple[datetime, datetime]:
    """[start, end) of a local day, in UTC."""
    return local_midnight_utc(day), local_midnight_utc(day + timedelta(days=1))


def month_key(now: datetime) -> str:
    """'2026-11': identifies the billing month in alert de-duplication keys."""
    return local_date(now).strftime("%Y-%m")


def hours_between(a: datetime, b: datetime) -> float:
    return (b - a).total_seconds() / 3600.0
