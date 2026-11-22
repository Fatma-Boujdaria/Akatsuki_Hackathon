"""Help & support: users send a problem or feedback, admins read and answer.

| Method | Path                     | Who        | What                         |
|--------|--------------------------|------------|------------------------------|
| POST   | /api/support/tickets     | logged in  | send a message to support    |
| GET    | /api/support/tickets     | logged in  | my messages and their status |
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.db import get_db
from app.deps import current_user, sensitive_limiter
from app.models import SupportTicket, User
from app.schemas import TicketIn, TicketOut

router = APIRouter(prefix="/api/support", tags=["support"])


@router.post("/tickets", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(body: TicketIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> SupportTicket:
    if not sensitive_limiter.allow(f"ticket:{user.id}"):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Trop de messages, réessaie dans une minute")
    ticket = SupportTicket(
        user_id=user.id,
        email=user.email,
        category=body.category,
        subject=body.subject.strip(),
        message=body.message.strip(),
        created_at=clock.now_utc(),
    )
    db.add(ticket)
    db.commit()
    return ticket


@router.get("/tickets", response_model=list[TicketOut])
def my_tickets(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[SupportTicket]:
    return list(
        db.scalars(
            select(SupportTicket).where(SupportTicket.user_id == user.id).order_by(SupportTicket.created_at.desc()).limit(50)
        )
    )
