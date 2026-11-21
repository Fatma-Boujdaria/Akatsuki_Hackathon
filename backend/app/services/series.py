"""Chart data for GET /api/readings: raw points or per minute / hour / day.

At one reading every 5 s a month is ~500 000 rows, far too many for a chart.
The database groups them into buckets (local time) and returns averages and
sums, so a month view is ~30 points and stays fast.
"""

from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import case, func, select, text
from sqlalchemy.orm import Session

from app import clock
from app.config import get_settings
from app.models import Reading
from app.schemas import SeriesOut, SeriesPoint

Bucket = Literal["raw", "minute", "hour", "day"]
MAX_SPAN = timedelta(days=93)
MAX_RAW_POINTS = 5000


def auto_bucket(span: timedelta) -> Bucket:
    if span <= timedelta(hours=3):
        return "raw"
    if span <= timedelta(days=2):
        return "minute"
    if span <= timedelta(days=35):
        return "hour"
    return "day"


def _bucket_expr(dialect: str, unit: str):
    """SQL expression giving the local start of the bucket of each reading."""
    if dialect == "postgresql":
        return func.date_trunc(unit, func.timezone(get_settings().timezone, Reading.ts))
    # SQLite (tests): stored text in UTC + fixed offset. Tunisia has no DST.
    offset_h = int(clock.now_utc().astimezone(clock.local_tz()).utcoffset().total_seconds() // 3600)
    pattern = {"minute": "%Y-%m-%d %H:%M:00", "hour": "%Y-%m-%d %H:00:00", "day": "%Y-%m-%d 00:00:00"}[unit]
    return func.strftime(pattern, Reading.ts, f"{offset_h:+d} hours")


def _to_utc(local_value) -> datetime:
    """Bucket value (naive local time, or text on SQLite) -> aware UTC datetime."""
    if isinstance(local_value, str):
        local_value = datetime.fromisoformat(local_value)
    if local_value.tzinfo is None:
        local_value = local_value.replace(tzinfo=clock.local_tz())
    return local_value.astimezone(timezone.utc)


def get_series(
    db: Session,
    device_ids: list[str],
    resource: str,
    start: datetime,
    end: datetime,
    bucket: Bucket | Literal["auto"] = "auto",
) -> SeriesOut:
    if bucket == "auto":
        bucket = auto_bucket(end - start)
    in_range = (Reading.device_id.in_(device_ids or [""]), Reading.ts >= start, Reading.ts < end)
    good = Reading.signal_ok.is_(True)
    points: list[SeriesPoint] = []

    if bucket == "raw":
        rows = db.scalars(select(Reading).where(*in_range).order_by(Reading.ts).limit(MAX_RAW_POINTS))
        for r in rows:
            if resource == "electricity":
                ok = r.signal_ok and r.power_w is not None
                points.append(
                    SeriesPoint(
                        ts=r.ts,
                        power_w=r.power_w if ok else None,
                        max_power_w=r.power_w if ok else None,
                        energy_kwh=r.energy_delta_kwh,
                        reliable=ok,
                    )
                )
            else:
                ok = r.signal_ok and r.flow_l_min is not None
                points.append(
                    SeriesPoint(ts=r.ts, flow_l_min=r.flow_l_min if ok else None, volume_l=r.water_delta_l, reliable=ok)
                )
        return SeriesOut(resource=resource, bucket=bucket, start=start, end=end, points=points)

    value = Reading.power_w if resource == "electricity" else Reading.flow_l_min
    delta = Reading.energy_delta_kwh if resource == "electricity" else Reading.water_delta_l
    good_value = case((good, value))  # NULL for unreliable readings: ignored by AVG/MAX
    query = (
        select(
            _bucket_expr(db.get_bind().dialect.name, bucket).label("bucket"),
            func.avg(good_value),
            func.max(good_value),
            func.coalesce(func.sum(delta), 0.0),
        )
        .where(*in_range)
        .group_by(text("bucket"))
        .order_by(text("bucket"))
    )
    for bucket_start, avg_v, max_v, total in db.execute(query):
        reliable = avg_v is not None
        if resource == "electricity":
            point = SeriesPoint(
                ts=_to_utc(bucket_start),
                power_w=None if avg_v is None else round(float(avg_v), 1),
                max_power_w=None if max_v is None else round(float(max_v), 1),
                energy_kwh=round(float(total), 4),
                reliable=reliable,
            )
        else:
            point = SeriesPoint(
                ts=_to_utc(bucket_start),
                flow_l_min=None if avg_v is None else round(float(avg_v), 2),
                volume_l=round(float(total), 2),
                reliable=reliable,
            )
        points.append(point)
    return SeriesOut(resource=resource, bucket=bucket, start=start, end=end, points=points)
