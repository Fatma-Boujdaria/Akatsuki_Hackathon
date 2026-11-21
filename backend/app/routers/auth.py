"""POST /api/auth/login (public, rate-limited) and GET /api/auth/me."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import client_ip, current_user, login_limiter
from app.models import User
from app.schemas import LoginIn, TokenOut, UserOut
from app.security import burn_password_check, create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    email = body.email.strip().lower()
    # 5 attempts per minute per IP and per email: slows down password guessing.
    if not (login_limiter.allow(f"ip:{client_ip(request)}") and login_limiter.allow(f"email:{email}")):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Trop de tentatives, réessaie dans une minute")

    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None:
        burn_password_check(body.password)  # same delay whether the account exists or not
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou mot de passe incorrect")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou mot de passe incorrect")

    token, expires_in = create_access_token(user.id, user.role)
    return TokenOut(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user
