"""Several households per account: list, create, edit, delete, add a device.

| Method | Path                               | What                                         |
|--------|------------------------------------|----------------------------------------------|
| GET    | /api/households                    | the caller's households                       |
| POST   | /api/households                    | create one (onboarding or "add a home")       |
| PUT    | /api/households/{id}               | edit name, address, occupants, kVA, margin    |
| DELETE | /api/households/{id}               | delete it with its devices, readings, alerts  |
| POST   | /api/households/{id}/devices       | register a device; its API key is shown once  |

The other household endpoints (dashboard, alerts, settings...) work on the
home chosen with the X-Household-Id header (see deps.current_household).
"""

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import current_user, owned_household
from app.models import Alert, Appliance, Device, Household, User
from app.schemas import DeviceCreatedOut, DeviceCreateIn, HouseholdIn, HouseholdOut
from app.security import generate_api_key, hash_api_key
from app.services.dashboard import device_status

router = APIRouter(prefix="/api/households", tags=["households"])
MAX_HOUSEHOLDS = 10


def household_out(db: Session, household: Household) -> HouseholdOut:
    now = clock.now_utc()
    devices = db.scalars(select(Device).where(Device.household_id == household.id).order_by(Device.id)).all()
    appliances = db.scalar(select(func.count()).select_from(Appliance).where(Appliance.household_id == household.id))
    unread = db.scalar(
        select(func.count())
        .select_from(Alert)
        .where(Alert.household_id == household.id, Alert.acknowledged_at.is_(None))
    )
    return HouseholdOut(
        id=household.id,
        name=household.name,
        address=household.address,
        occupants=household.occupants,
        subscribed_kva=float(household.subscribed_kva),
        alert_margin_kwh=household.alert_margin_kwh,
        onboarding_done=household.onboarding_done,
        created_at=household.created_at,
        devices=[device_status(d, now) for d in devices],
        appliance_count=appliances or 0,
        unread_alerts=unread or 0,
    )


@router.get("", response_model=list[HouseholdOut])
def list_households(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[HouseholdOut]:
    rows = db.scalars(select(Household).where(Household.user_id == user.id).order_by(Household.created_at)).all()
    return [household_out(db, h) for h in rows]


@router.post("", response_model=HouseholdOut, status_code=status.HTTP_201_CREATED)
def create_household(body: HouseholdIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> HouseholdOut:
    count = db.scalar(select(func.count()).select_from(Household).where(Household.user_id == user.id)) or 0
    if count >= MAX_HOUSEHOLDS:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Maximum {MAX_HOUSEHOLDS} foyers par compte")
    household = Household(
        user_id=user.id,
        name=body.name.strip(),
        address=(body.address or "").strip() or None,
        occupants=body.occupants,
        subscribed_kva=body.subscribed_kva,
        alert_margin_kwh=body.alert_margin_kwh,
        onboarding_done=False,  # the wizard continues with the appliances
        created_at=clock.now_utc(),
    )
    db.add(household)
    db.commit()
    return household_out(db, household)


@router.put("/{household_id}", response_model=HouseholdOut)
def update_household(
    household_id: uuid.UUID, body: HouseholdIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> HouseholdOut:
    household = owned_household(db, user, household_id)
    household.name = body.name.strip()
    household.address = (body.address or "").strip() or None
    household.occupants = body.occupants
    household.subscribed_kva = body.subscribed_kva
    household.alert_margin_kwh = body.alert_margin_kwh
    db.commit()
    return household_out(db, household)


@router.delete("/{household_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_household(household_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    household = owned_household(db, user, household_id)
    # Bulk delete so the database's ON DELETE CASCADE removes devices, readings,
    # alerts, tips, scores and appliances (the ORM would try to orphan them).
    db.execute(sa_delete(Household).where(Household.id == household.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{household_id}/devices", response_model=DeviceCreatedOut, status_code=status.HTTP_201_CREATED)
def add_device(
    household_id: uuid.UUID, body: DeviceCreateIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> DeviceCreatedOut:
    household = owned_household(db, user, household_id)
    prefix = "tg" if body.kind == "esp32" else "sim"
    device_id = body.device_id or f"{prefix}-{secrets.token_hex(3)}"
    if db.get(Device, device_id) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cet identifiant d'appareil existe déjà")
    api_key = generate_api_key()
    device = Device(
        id=device_id,
        household_id=household.id,
        kind=body.kind,
        api_key_hash=hash_api_key(api_key),
        created_at=clock.now_utc(),
    )
    db.add(device)
    db.commit()
    return DeviceCreatedOut(device=device_status(device, clock.now_utc()), api_key=api_key)
