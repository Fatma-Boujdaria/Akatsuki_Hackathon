"""GET /api/alerts and POST /api/alerts/{id}/ack."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import current_household
from app.models import Alert, Household
from app.schemas import AlertOut
from app.services import alerts as alert_rules

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    status: Literal["active", "all"] = "all",
    limit: int = Query(default=50, ge=1, le=200),
    household: Household = Depends(current_household),
    db: Session = Depends(get_db),
) -> list[Alert]:
    alert_rules.check_devices_offline(db, household, clock.now_utc())
    db.commit()
    query = select(Alert).where(Alert.household_id == household.id)
    if status == "active":
        query = query.where(Alert.acknowledged_at.is_(None))
    return list(db.scalars(query.order_by(Alert.created_at.desc()).limit(limit)))


@router.post("/{alert_id}/ack", response_model=AlertOut)
def acknowledge_alert(
    alert_id: uuid.UUID, household: Household = Depends(current_household), db: Session = Depends(get_db)
) -> Alert:
    alert = db.get(Alert, alert_id)
    # Another household's alert answers 404 too: we never reveal that it exists.
    if alert is None or alert.household_id != household.id:
        raise HTTPException(404, "Alerte introuvable")
    if alert.acknowledged_at is None:
        alert.acknowledged_at = clock.now_utc()
        db.commit()
    return alert
