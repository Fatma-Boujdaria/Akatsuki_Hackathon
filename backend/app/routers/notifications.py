"""Notification history across ALL the caller's households, and "mark all as read".

| Method | Path                                  | What                                         |
|--------|---------------------------------------|----------------------------------------------|
| GET    | /api/notifications?status=&type=      | alerts of every household, newest first      |
| POST   | /api/notifications/{id}/read          | mark one alert (any of my homes) as read     |
| POST   | /api/notifications/read-all           | acknowledge every unread alert (one or all)  |

Per-household alerts stay at /api/alerts (X-Household-Id).
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import current_user, owned_household
from app.models import Alert, Household, User
from app.schemas import NotificationOut, ReadAllOut
from app.services import alerts as alert_rules

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    status: Literal["unread", "all"] = "all",
    type: Literal["threshold", "leak", "device_offline", "sensor_fault", "all"] = "all",
    household_id: uuid.UUID | None = None,
    limit: int = Query(default=100, ge=1, le=300),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[NotificationOut]:
    homes = {h.id: h for h in db.scalars(select(Household).where(Household.user_id == user.id))}
    if not homes:
        return []
    now = clock.now_utc()
    for home in homes.values():
        alert_rules.check_devices_offline(db, home, now)
    db.commit()

    ids = [household_id] if household_id is not None else list(homes)
    if household_id is not None:
        owned_household(db, user, household_id)
    query = select(Alert).where(Alert.household_id.in_(ids))
    if status == "unread":
        query = query.where(Alert.acknowledged_at.is_(None))
    if type != "all":
        query = query.where(Alert.type == type)
    rows = db.scalars(query.order_by(Alert.created_at.desc()).limit(limit)).all()
    return [NotificationOut(**_alert_dict(a), household_name=homes[a.household_id].name) for a in rows]


def _alert_dict(a: Alert) -> dict:
    return {
        "id": a.id,
        "type": a.type,
        "resource": a.resource,
        "severity": a.severity,
        "message": a.message,
        "extra_cost_dt": a.extra_cost_dt,
        "created_at": a.created_at,
        "acknowledged_at": a.acknowledged_at,
        "params": a.params,
        "household_id": a.household_id,
    }


@router.post("/{alert_id}/read", response_model=NotificationOut)
def read_one(alert_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)) -> NotificationOut:
    """Mark one alert of any of the caller's households as read."""
    alert = db.get(Alert, alert_id)
    home = db.get(Household, alert.household_id) if alert is not None else None
    if alert is None or home is None or home.user_id != user.id:
        raise HTTPException(404, "Alerte introuvable")
    if alert.acknowledged_at is None:
        alert.acknowledged_at = clock.now_utc()
        db.commit()
    return NotificationOut(**_alert_dict(alert), household_name=home.name)


@router.post("/read-all", response_model=ReadAllOut)
def read_all(
    household_id: uuid.UUID | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> ReadAllOut:
    if household_id is not None:
        ids = [owned_household(db, user, household_id).id]
    else:
        ids = list(db.scalars(select(Household.id).where(Household.user_id == user.id)))
    if not ids:
        return ReadAllOut(updated=0)
    result = db.execute(
        update(Alert)
        .where(Alert.household_id.in_(ids), Alert.acknowledged_at.is_(None))
        .values(acknowledged_at=clock.now_utc())
    )
    db.commit()
    return ReadAllOut(updated=result.rowcount or 0)
