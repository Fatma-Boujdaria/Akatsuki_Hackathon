"""Passwords, login tokens (JWT) and device API keys.

- Passwords: bcrypt (slow on purpose, salted). Never stored in clear.
- Login: a signed JWT the frontend sends as "Authorization: Bearer <token>".
- Devices: a random API key sent in the "X-Device-Key" header. We store only
  its SHA-256 hash; a long random key does not need a slow hash like bcrypt.
"""

import hashlib
import hmac
import secrets
import uuid
from datetime import timedelta

import bcrypt
import jwt

from app import clock
from app.config import get_settings

BCRYPT_MAX_BYTES = 72  # bcrypt ignores bytes past 72; we refuse them instead


def hash_password(password: str) -> str:
    raw = password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_BYTES:
        raise ValueError("password too long (max 72 bytes)")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    raw = password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_BYTES:
        return False
    try:
        return bcrypt.checkpw(raw, password_hash.encode("ascii"))
    except ValueError:  # malformed hash in the database
        return False


# A real hash to compare against when the email is unknown, so a login attempt
# takes the same time whether the account exists or not.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode("ascii")


def burn_password_check(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def create_access_token(user_id: uuid.UUID, role: str) -> tuple[str, int]:
    settings = get_settings()
    expires_in = settings.jwt_expire_minutes * 60
    now = clock.now_utc()
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), expires_in


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError when the token is invalid, tampered with or expired."""
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "exp"], "verify_exp": False},
    )
    # Expiry checked against the app clock (the same one the tests can freeze).
    if payload["exp"] < clock.now_utc().timestamp():
        raise jwt.ExpiredSignatureError("token expired")
    return payload


def generate_api_key() -> str:
    return secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def api_key_matches(api_key: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_api_key(api_key), stored_hash)
