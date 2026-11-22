"""POST /api/readings (device key) and GET /api/readings (curves for charts)."""

import logging
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import clock, monitor
from app.db import get_db
from app.deps import current_device, current_household
from app.models import Device, Household
from app.schemas import DemoCommand, IngestOut, ReadingIn, SeriesOut
from app.services import consumption, demo, series
from app.services.ingest import IngestError, ingest_reading

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/readings", tags=["readings"])


@router.post("", response_model=IngestOut, status_code=status.HTTP_201_CREATED)
def post_reading(payload: ReadingIn, device: Device = Depends(current_device), db: Session = Depends(get_db)):
    """Called by the ESP32 / simulator every 5 s with the reading JSON."""
    try:
        result = ingest_reading(db, device, payload, clock.now_utc())
    except IngestError as exc:
        db.rollback()
        log.warning("reading rejected from %s: %s (%s)", device.id, exc.code, exc.message)
        monitor.incr("readings_rejected")
        raise HTTPException(exc.status_code, {"code": exc.code, "message": exc.message}) from None

    # Demo only: hand a pending "spike" to the simulator in its own response.
    commands = [DemoCommand(**c) for c in demo.pop_commands(device.id)] if device.kind == "simulator" else []
    return IngestOut(
        id=result.reading.id,
        device_id=device.id,
        ts=result.reading.ts,
        alerts_created=len(result.alerts),
        commands=commands,
    )


@router.get("", response_model=SeriesOut)
def get_readings(
    resource: Literal["electricity", "water"] = "electricity",
    start: datetime | None = Query(default=None, alias="from", description="ISO 8601, default: 24 h ago"),
    end: datetime | None = Query(default=None, alias="to", description="ISO 8601, default: now"),
    bucket: Literal["auto", "raw", "minute", "hour", "day"] = "auto",
    household: Household = Depends(current_household),
    db: Session = Depends(get_db),
) -> SeriesOut:
    """Day curve: ?resource=electricity (last 24 h, per minute).
    Month curve: ?resource=electricity&from=2026-11-01T00:00:00+01:00&bucket=day."""
    now = clock.now_utc()
    end = end or now
    start = start or end - timedelta(hours=24)
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "from/to must include a time zone, e.g. 2026-11-01T00:00:00+01:00")
    if start >= end:
        raise HTTPException(422, "from must be before to")
    if end - start > series.MAX_SPAN:
        raise HTTPException(422, "period too long (93 days max)")
    device_ids = consumption.household_device_ids(db, household)
    return series.get_series(db, device_ids, resource, start, end, bucket)
