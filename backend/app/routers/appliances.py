"""Appliance profile of the current household (X-Household-Id), and the catalog.

| Method | Path                          | What                                          |
|--------|-------------------------------|-----------------------------------------------|
| GET    | /api/appliances/catalog       | typical power and hours per category          |
| GET    | /api/appliances               | the household's appliances with kWh estimates |
| POST   | /api/appliances               | add one (from the list or a custom one)       |
| PUT    | /api/appliances/{id}          | edit                                          |
| DELETE | /api/appliances/{id}          | remove                                        |
| POST   | /api/appliances/bulk          | replace the whole list (onboarding wizard)    |
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import current_household
from app.models import Appliance, Household
from app.schemas import ApplianceCatalogItem, ApplianceIn, ApplianceOut
from app.services import appliances as profile

router = APIRouter(prefix="/api/appliances", tags=["appliances"])
MAX_APPLIANCES = 60


class BulkIn(BaseModel):
    items: list[ApplianceIn] = Field(max_length=MAX_APPLIANCES)
    finish_onboarding: bool = True


def appliance_out(appliance: Appliance) -> ApplianceOut:
    e = profile.estimate(appliance)
    out = ApplianceOut.model_validate(appliance)
    out.effective_power_w = e.power_w
    out.effective_hours_per_day = e.hours_per_day
    out.estimated_kwh_month = e.kwh_month
    return out


def _owned(db: Session, household: Household, appliance_id: uuid.UUID) -> Appliance:
    appliance = db.get(Appliance, appliance_id)
    if appliance is None or appliance.household_id != household.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appareil introuvable")
    return appliance


def _check_category(category: str) -> None:
    if category not in profile.CATALOG:
        raise HTTPException(422, f"Catégorie inconnue : {category}")


@router.get("/catalog", response_model=list[ApplianceCatalogItem])
def catalog() -> list[ApplianceCatalogItem]:
    return [
        ApplianceCatalogItem(category=c, typical_power_w=p, typical_hours_per_day=h, icon=i)
        for c, (p, h, i) in profile.CATALOG.items()
    ]


@router.get("", response_model=list[ApplianceOut])
def list_appliances(household: Household = Depends(current_household), db: Session = Depends(get_db)) -> list[ApplianceOut]:
    return [appliance_out(a) for a in profile.household_appliances(db, household)]


@router.post("", response_model=ApplianceOut, status_code=status.HTTP_201_CREATED)
def add_appliance(
    body: ApplianceIn, household: Household = Depends(current_household), db: Session = Depends(get_db)
) -> ApplianceOut:
    _check_category(body.category)
    if len(profile.household_appliances(db, household)) >= MAX_APPLIANCES:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Maximum {MAX_APPLIANCES} appareils par foyer")
    appliance = Appliance(household_id=household.id, created_at=clock.now_utc(), **body.model_dump())
    db.add(appliance)
    db.commit()
    return appliance_out(appliance)


@router.put("/{appliance_id}", response_model=ApplianceOut)
def update_appliance(
    appliance_id: uuid.UUID,
    body: ApplianceIn,
    household: Household = Depends(current_household),
    db: Session = Depends(get_db),
) -> ApplianceOut:
    _check_category(body.category)
    appliance = _owned(db, household, appliance_id)
    for field, value in body.model_dump().items():
        setattr(appliance, field, value)
    db.commit()
    return appliance_out(appliance)


@router.delete("/{appliance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appliance(
    appliance_id: uuid.UUID, household: Household = Depends(current_household), db: Session = Depends(get_db)
) -> Response:
    db.delete(_owned(db, household, appliance_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/bulk", response_model=list[ApplianceOut])
def replace_appliances(
    body: BulkIn, household: Household = Depends(current_household), db: Session = Depends(get_db)
) -> list[ApplianceOut]:
    for item in body.items:
        _check_category(item.category)
    db.execute(delete(Appliance).where(Appliance.household_id == household.id))
    now = clock.now_utc()
    rows = [Appliance(household_id=household.id, created_at=now, **item.model_dump()) for item in body.items]
    db.add_all(rows)
    if body.finish_onboarding:
        household.onboarding_done = True
    db.commit()
    return [appliance_out(a) for a in rows]
