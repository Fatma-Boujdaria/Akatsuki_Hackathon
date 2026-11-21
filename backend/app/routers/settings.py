"""GET / PUT /api/settings: subscribed kVA, alert margin, leak rule, device switch."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.config import get_settings
from app.db import get_db
from app.deps import current_household
from app.models import Device, Household
from app.schemas import SettingsIn, SettingsOut
from app.services.dashboard import device_status

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _settings_out(db: Session, household: Household) -> SettingsOut:
    now = clock.now_utc()
    devices = db.scalars(select(Device).where(Device.household_id == household.id).order_by(Device.id)).all()
    return SettingsOut(
        household_id=household.id,
        name=household.name,
        subscribed_kva=float(household.subscribed_kva),
        alert_margin_kwh=household.alert_margin_kwh,
        leak_start_hour=household.leak_start_hour,
        leak_end_hour=household.leak_end_hour,
        leak_min_minutes=household.leak_min_minutes,
        active_device_id=household.active_device_id,
        devices=[device_status(d, now) for d in devices],
        demo_mode=get_settings().demo_mode,
    )


@router.get("", response_model=SettingsOut)
def read_settings(household: Household = Depends(current_household), db: Session = Depends(get_db)) -> SettingsOut:
    return _settings_out(db, household)


@router.put("", response_model=SettingsOut)
def update_settings(
    body: SettingsIn, household: Household = Depends(current_household), db: Session = Depends(get_db)
) -> SettingsOut:
    changes = body.model_dump(exclude_unset=True, exclude={"active_device_id", "clear_active_device"})
    start = changes.get("leak_start_hour", household.leak_start_hour)
    end = changes.get("leak_end_hour", household.leak_end_hour)
    if start == end:
        raise HTTPException(422, "Le début et la fin de la fenêtre de fuite doivent être différents")

    if body.active_device_id is not None:
        device = db.get(Device, body.active_device_id)
        if device is None or device.household_id != household.id:
            raise HTTPException(422, "Cet appareil n'appartient pas à ton foyer")
        household.active_device_id = device.id
    elif body.clear_active_device:
        household.active_device_id = None

    for field, value in changes.items():
        setattr(household, field, value)
    db.commit()
    return _settings_out(db, household)
