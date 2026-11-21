"""GET /api/dashboard: the main screen in one call."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import current_household
from app.models import Household
from app.schemas import DashboardOut
from app.services.dashboard import build_dashboard

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(household: Household = Depends(current_household), db: Session = Depends(get_db)) -> DashboardOut:
    return build_dashboard(db, household, clock.now_utc())
