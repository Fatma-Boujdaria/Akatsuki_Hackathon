"""POST /api/demo/spike: the jury demo button (logged-in, DEMO_MODE=true)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import current_household
from app.models import Household
from app.schemas import SpikeIn, SpikeOut
from app.services import demo

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/spike", response_model=SpikeOut, status_code=status.HTTP_202_ACCEPTED)
def simulate_spike(
    body: SpikeIn | None = None, household: Household = Depends(current_household), db: Session = Depends(get_db)
) -> dict:
    body = body or SpikeIn()
    try:
        return demo.start_spike(db, household, clock.now_utc(), body.extra_w, body.duration_s, body.energy_kwh)
    except demo.DemoError as exc:
        raise HTTPException(exc.status_code, exc.message) from None
