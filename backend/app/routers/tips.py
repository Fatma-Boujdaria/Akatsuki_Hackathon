"""GET /api/tips: tips with the DT saved, and GET /api/score: score, badges, ranking."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import current_household
from app.models import Household, Tip
from app.schemas import ScoreOut, TipOut
from app.services.score import build_score
from app.services.tips import refresh_tips

router = APIRouter(prefix="/api", tags=["tips and score"])


@router.get("/tips", response_model=list[TipOut])
def get_tips(household: Household = Depends(current_household), db: Session = Depends(get_db)) -> list[Tip]:
    tips = refresh_tips(db, household, clock.now_utc())
    db.commit()
    return tips


@router.get("/score", response_model=ScoreOut)
def get_score(household: Household = Depends(current_household), db: Session = Depends(get_db)) -> ScoreOut:
    return build_score(db, household, clock.now_utc())
