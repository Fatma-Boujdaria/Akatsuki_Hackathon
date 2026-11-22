"""Accounts: login, sign-up with email verification, password reset, profile.

| Method | Path                        | Who        | What                                         |
|--------|-----------------------------|------------|----------------------------------------------|
| POST   | /api/auth/login             | public     | email + password (+ remember) -> token        |
| POST   | /api/auth/register          | public     | create the account, email a 6-digit code      |
| POST   | /api/auth/verify-email      | public     | code -> account verified, logged in           |
| POST   | /api/auth/resend-code       | public     | send a new verification code                  |
| POST   | /api/auth/forgot-password   | public     | email a reset code (same answer if unknown)   |
| POST   | /api/auth/reset-password    | public     | code + new password                           |
| GET    | /api/auth/me                | logged in  | the account                                   |
| PATCH  | /api/auth/me                | logged in  | name, language, notification preferences      |
| POST   | /api/auth/change-password   | logged in  | logs out every other session                  |
| POST   | /api/auth/logout-all        | logged in  | ends every session of the account             |
| DELETE | /api/auth/me                | logged in  | deletes the account and all its households    |

Every public endpoint is rate-limited per IP and per email address.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app import clock
from app.config import get_settings
from app.db import get_db
from app.deps import client_ip, current_user, email_limiter, login_limiter, sensitive_limiter
from app.models import AuthCode, User
from app.schemas import (
    ChangePasswordIn,
    CodeSentOut,
    DeleteAccountIn,
    EmailIn,
    LoginIn,
    ProfileIn,
    RegisterIn,
    ResetPasswordIn,
    TokenOut,
    UserOut,
    VerifyEmailIn,
)
from app.security import (
    burn_password_check,
    create_access_token,
    generate_code,
    hash_code,
    hash_password,
    verify_password,
)
from app.services.mailer import send_code_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_CODE_ATTEMPTS = 5


def _norm(email: str) -> str:
    return email.strip().lower()


def _find_user(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == _norm(email)))


def _limit(request: Request, email: str, limiter=sensitive_limiter) -> None:
    if not (limiter.allow(f"ip:{client_ip(request)}") and limiter.allow(f"email:{_norm(email)}")):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Trop de tentatives, réessaie dans une minute")


def _token(user: User, remember: bool = False) -> TokenOut:
    token, expires_in = create_access_token(user.id, user.role, user.token_version or 0, remember)
    return TokenOut(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))


def _issue_code(db: Session, user: User, purpose: str) -> CodeSentOut:
    """Invalidate older codes of this purpose, store a new one (hashed) and email it."""
    settings = get_settings()
    now = clock.now_utc()
    db.execute(
        update(AuthCode)
        .where(AuthCode.user_id == user.id, AuthCode.purpose == purpose, AuthCode.used_at.is_(None))
        .values(used_at=now)
    )
    code = generate_code()
    db.add(
        AuthCode(
            user_id=user.id,
            purpose=purpose,
            code_hash=hash_code(user.id, code),
            expires_at=now + timedelta(minutes=settings.email_code_minutes),
            created_at=now,
        )
    )
    db.commit()
    send_code_email(user.email, user.full_name, purpose, code, user.language)
    return CodeSentOut(
        email=user.email,
        expires_in_min=settings.email_code_minutes,
        dev_code=code if settings.show_dev_codes else None,
    )


def _check_code(db: Session, user: User, purpose: str, code: str) -> None:
    now = clock.now_utc()
    row = db.scalar(
        select(AuthCode)
        .where(AuthCode.user_id == user.id, AuthCode.purpose == purpose, AuthCode.used_at.is_(None))
        .order_by(AuthCode.created_at.desc())
        .limit(1)
    )
    if row is None or row.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code expiré. Demande un nouveau code.")
    row.attempts += 1
    if row.attempts > MAX_CODE_ATTEMPTS:
        row.used_at = now
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Trop d'essais. Demande un nouveau code.")
    if row.code_hash != hash_code(user.id, code):
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code incorrect")
    row.used_at = now


# --- Login and sign-up ----------------------------------------------------------------


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    email = _norm(body.email)
    # 5 attempts per minute per IP and per email: slows down password guessing.
    if not (login_limiter.allow(f"ip:{client_ip(request)}") and login_limiter.allow(f"email:{email}")):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Trop de tentatives, réessaie dans une minute")

    user = _find_user(db, email)
    if user is None:
        burn_password_check(body.password)  # same delay whether the account exists or not
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou mot de passe incorrect")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou mot de passe incorrect")
    if user.status == "suspended":
        raise HTTPException(status.HTTP_403_FORBIDDEN, {"code": "suspended", "message": "Compte suspendu. Contacte le support."})
    if not user.email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            {"code": "email_not_verified", "message": "Confirme d'abord ton adresse email avec le code reçu."},
        )

    user.last_login_at = clock.now_utc()
    db.commit()
    return _token(user, body.remember)


@router.post("/register", response_model=CodeSentOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)) -> CodeSentOut:
    _limit(request, body.email)
    email = _norm(body.email)
    existing = _find_user(db, email)
    if existing is not None:
        if existing.email_verified:
            raise HTTPException(status.HTTP_409_CONFLICT, "Cet email est déjà utilisé. Connecte-toi ou réinitialise ton mot de passe.")
        # Sign-up started but never confirmed: take the new details, send a new code.
        existing.full_name = body.full_name.strip()
        existing.password_hash = hash_password(body.password)
        existing.language = body.language
        user = existing
    else:
        user = User(
            email=email,
            password_hash=hash_password(body.password),
            role="household",
            full_name=body.full_name.strip(),
            language=body.language,
            email_verified=False,
            created_at=clock.now_utc(),
        )
        db.add(user)
    db.flush()
    if not email_limiter.allow(email):
        db.commit()
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Trop de codes envoyés. Réessaie dans une heure.")
    return _issue_code(db, user, "verify_email")


@router.post("/verify-email", response_model=TokenOut)
def verify_email(body: VerifyEmailIn, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    _limit(request, body.email)
    user = _find_user(db, body.email)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code incorrect")
    if not user.email_verified:
        _check_code(db, user, "verify_email", body.code)
        user.email_verified = True
    user.last_login_at = clock.now_utc()
    db.commit()
    return _token(user)


@router.post("/resend-code", response_model=CodeSentOut)
def resend_code(body: EmailIn, request: Request, db: Session = Depends(get_db)) -> CodeSentOut:
    _limit(request, body.email)
    user = _find_user(db, body.email)
    settings = get_settings()
    if user is None or user.email_verified or not email_limiter.allow(_norm(body.email)):
        # Same answer whether the address exists or not.
        return CodeSentOut(email=_norm(body.email), expires_in_min=settings.email_code_minutes)
    return _issue_code(db, user, "verify_email")


@router.post("/forgot-password", response_model=CodeSentOut)
def forgot_password(body: EmailIn, request: Request, db: Session = Depends(get_db)) -> CodeSentOut:
    _limit(request, body.email)
    user = _find_user(db, body.email)
    settings = get_settings()
    if user is None or user.status == "suspended" or not email_limiter.allow(_norm(body.email)):
        return CodeSentOut(email=_norm(body.email), expires_in_min=settings.email_code_minutes)
    return _issue_code(db, user, "reset_password")


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetPasswordIn, request: Request, db: Session = Depends(get_db)) -> Response:
    _limit(request, body.email)
    user = _find_user(db, body.email)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code incorrect")
    _check_code(db, user, "reset_password", body.code)
    user.password_hash = hash_password(body.new_password)
    user.token_version = (user.token_version or 0) + 1  # every open session ends
    user.email_verified = True  # the code proves the address
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- The logged-in account ------------------------------------------------------------


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.language is not None:
        user.language = body.language
    if body.notify_prefs is not None:
        user.notify_prefs = body.notify_prefs.model_dump()
    db.commit()
    return user


@router.post("/change-password", response_model=TokenOut)
def change_password(
    body: ChangePasswordIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> TokenOut:
    _limit(request, user.email, login_limiter)
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mot de passe actuel incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choisis un mot de passe différent de l'actuel")
    user.password_hash = hash_password(body.new_password)
    user.token_version = (user.token_version or 0) + 1  # other devices are logged out
    db.commit()
    return _token(user)  # this device stays logged in with a fresh token


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    body: DeleteAccountIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Response:
    """Deletes the account, its households, devices, readings, alerts, tips, scores and appliances.

    Support tickets are kept without the account link (user_id set to NULL).
    The last administrator cannot delete their own account.
    """
    _limit(request, user.email, login_limiter)
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mot de passe incorrect")
    if user.role == "admin":
        admins = db.scalar(select(func.count()).select_from(User).where(User.role == "admin")) or 0
        if admins <= 1:
            raise HTTPException(status.HTTP_409_CONFLICT, "Impossible de supprimer le dernier administrateur")
    db.execute(delete(User).where(User.id == user.id))  # ON DELETE CASCADE removes the rest
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
