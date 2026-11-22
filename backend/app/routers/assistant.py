"""AI assistant, insights (status, trends, profile breakdown) and monthly history.

| Method | Path                    | What                                                   |
|--------|-------------------------|--------------------------------------------------------|
| POST   | /api/assistant/chat     | answer a question about the current household           |
| GET    | /api/insights           | status (normal...critical), trends, appliance breakdown |
| GET    | /api/history?months=12  | kWh, litres and estimated bill per month                |
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import assistant_limiter, current_household, current_user
from app.models import Household, User
from app.schemas import ChatIn, ChatOut, HistoryOut, InsightsOut
from app.services import assistant
from app.services.history import build_history
from app.services.insights import build_insights

router = APIRouter(prefix="/api", tags=["assistant and insights"])


@router.post("/assistant/chat", response_model=ChatOut)
def chat(
    body: ChatIn,
    user: User = Depends(current_user),
    household: Household = Depends(current_household),
    db: Session = Depends(get_db),
) -> ChatOut:
    if not assistant_limiter.allow(str(user.id)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Trop de questions d'un coup, attends une minute")
    return assistant.answer(db, household, body, clock.now_utc())


@router.get("/insights", response_model=InsightsOut)
def insights(household: Household = Depends(current_household), db: Session = Depends(get_db)) -> InsightsOut:
    return build_insights(db, household, clock.now_utc())


@router.get("/history", response_model=HistoryOut)
def history(
    months: int = Query(default=12, ge=1, le=24),
    household: Household = Depends(current_household),
    db: Session = Depends(get_db),
) -> HistoryOut:
    return build_history(db, household, clock.now_utc(), months)
