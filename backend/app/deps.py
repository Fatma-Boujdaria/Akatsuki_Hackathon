"""FastAPI dependencies: "who is calling?" checks reused by every endpoint.

An endpoint that declares `household: Household = Depends(current_household)`
only runs for a logged-in user, and only ever sees that user's household.
This is the access-control table of the blueprint, enforced in code.
"""

import uuid

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Device, Household, User
from app.ratelimit import RateLimiter
from app.security import decode_access_token, hash_api_key

bearer_scheme = HTTPBearer(auto_error=False)

login_limiter = RateLimiter(get_settings().login_rate_limit_per_min)
ingest_limiter = RateLimiter(get_settings().ingest_rate_limit_per_min)
# Sign-up, codes, password reset: per IP and per email address.
sensitive_limiter = RateLimiter(10)
email_limiter = RateLimiter(get_settings().email_rate_limit_per_hour, window_s=3600)
assistant_limiter = RateLimiter(20)


def _unauthorized(detail: str = "Connexion requise") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized()
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise _unauthorized("Session invalide ou expirée") from None
    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized("Compte introuvable")
    # A password change or "log out everywhere" bumps token_version: older tokens die.
    if int(payload.get("ver", 0)) != (user.token_version or 0):
        raise _unauthorized("Session expirée, reconnecte-toi")
    if user.status == "suspended":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Compte suspendu. Contacte le support.")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé à l'administrateur")
    return user


def owned_household(db: Session, user: User, household_id: uuid.UUID) -> Household:
    """A household of this user, or 404 (another user's home is never revealed)."""
    household = db.get(Household, household_id)
    if household is None or household.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foyer introuvable")
    return household


def current_household(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    x_household_id: str | None = Header(default=None, alias="X-Household-Id"),
) -> Household:
    """The home the app is looking at: the X-Household-Id header, else the first one.

    An account can manage several homes; every household endpoint only ever
    sees the one chosen here, and only if it belongs to the caller.
    """
    if x_household_id:
        try:
            wanted = uuid.UUID(x_household_id)
        except ValueError:
            raise HTTPException(422, "X-Household-Id invalide") from None
        return owned_household(db, user, wanted)
    household = db.scalar(
        select(Household).where(Household.user_id == user.id).order_by(Household.created_at).limit(1)
    )
    if household is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun foyer lié à ce compte")
    return household


def current_device(
    x_device_key: str | None = Header(default=None, alias="X-Device-Key"),
    db: Session = Depends(get_db),
) -> Device:
    """Device authentication for POST /api/readings (separate from user logins)."""
    if not x_device_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-Device-Key header")
    key_hash = hash_api_key(x_device_key)
    if not ingest_limiter.allow(key_hash):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many readings, slow down")
    # Lookup by hash: the unique index makes this a single indexed read.
    device = db.scalar(select(Device).where(Device.api_key_hash == key_hash))
    if device is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown device key")
    return device


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
