"""Admin panel API. Every endpoint requires role = admin.

| Method | Path                               | What                                         |
|--------|------------------------------------|----------------------------------------------|
| GET    | /api/admin/users?q=                | accounts (search by email), never a password |
| PATCH  | /api/admin/users/{id}              | suspend / reactivate an account              |
| GET    | /api/admin/households              | every household with device and alert counts |
| GET    | /api/admin/devices                 | devices, connection, last reading, faults    |
| GET    | /api/admin/system                  | API, database, devices, emails, errors       |
| GET    | /api/admin/tariff-audit            | who changed the tariffs, before / after      |
| GET    | /api/admin/tickets                 | support messages                             |
| PATCH  | /api/admin/tickets/{id}            | mark answered / closed                       |

Tariff edits themselves go through PUT /api/tariffs (admin only, audited).
"""

import time
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app import clock, monitor
from app.config import get_settings
from app.db import get_db
from app.deps import require_admin
from app.models import Alert, Appliance, Device, Household, Reading, SupportTicket, TariffAudit, User
from app.schemas import (
    AdminDeviceOut,
    AdminHouseholdOut,
    AdminSystemOut,
    AdminUserOut,
    AdminUserStatusIn,
    TariffAuditOut,
    TicketOut,
    TicketStatusIn,
)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _count(db: Session, query) -> int:
    return int(db.scalar(query) or 0)


def _user_out(db: Session, user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        email_verified=user.email_verified,
        language=user.language,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        households=_count(db, select(func.count()).select_from(Household).where(Household.user_id == user.id)),
    )


@router.get("/users", response_model=list[AdminUserOut])
def users(q: str | None = Query(default=None, max_length=255), db: Session = Depends(get_db)) -> list[AdminUserOut]:
    query = select(User).order_by(User.created_at.desc()).limit(200)
    if q:
        query = query.where(func.lower(User.email).contains(q.strip().lower()))
    return [_user_out(db, u) for u in db.scalars(query)]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def set_user_status(
    user_id: uuid.UUID, body: AdminUserStatusIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Compte introuvable")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Tu ne peux pas suspendre ton propre compte")
    user.status = body.status
    if body.status == "suspended":
        user.token_version = (user.token_version or 0) + 1  # ends their open sessions now
    db.commit()
    return _user_out(db, user)


@router.get("/households", response_model=list[AdminHouseholdOut])
def households(db: Session = Depends(get_db)) -> list[AdminHouseholdOut]:
    now = clock.now_utc()
    window = timedelta(seconds=get_settings().device_online_window_s)
    out = []
    rows = db.execute(select(Household, User.email).join(User, User.id == Household.user_id).order_by(Household.created_at.desc()).limit(300)).all()
    for household, email in rows:
        devices = db.scalars(select(Device).where(Device.household_id == household.id)).all()
        out.append(
            AdminHouseholdOut(
                id=household.id,
                name=household.name,
                owner_email=email,
                subscribed_kva=float(household.subscribed_kva),
                devices=len(devices),
                devices_online=sum(1 for d in devices if d.last_seen_at and now - d.last_seen_at <= window),
                appliances=_count(db, select(func.count()).select_from(Appliance).where(Appliance.household_id == household.id)),
                unread_alerts=_count(
                    db,
                    select(func.count()).select_from(Alert).where(Alert.household_id == household.id, Alert.acknowledged_at.is_(None)),
                ),
                created_at=household.created_at,
            )
        )
    return out


@router.get("/devices", response_model=list[AdminDeviceOut])
def devices(db: Session = Depends(get_db)) -> list[AdminDeviceOut]:
    now = clock.now_utc()
    window = timedelta(seconds=get_settings().device_online_window_s)
    week = now - timedelta(days=7)
    rows = db.execute(
        select(Device, Household.name, User.email)
        .join(Household, Household.id == Device.household_id)
        .join(User, User.id == Household.user_id)
        .order_by(Device.id)
    ).all()
    out = []
    for device, home_name, email in rows:
        last = db.scalar(select(Reading).where(Reading.device_id == device.id).order_by(Reading.ts.desc()).limit(1))
        faults = _count(
            db,
            select(func.count())
            .select_from(Alert)
            .where(
                Alert.household_id == device.household_id,
                Alert.type == "sensor_fault",
                Alert.created_at >= week,
                Alert.dedupe_key.contains(device.id),
            ),
        )
        out.append(
            AdminDeviceOut(
                id=device.id,
                kind=device.kind,
                household_id=device.household_id,
                household_name=home_name,
                owner_email=email,
                online=device.last_seen_at is not None and now - device.last_seen_at <= window,
                last_seen_at=device.last_seen_at,
                last_reading_at=last.ts if last else None,
                last_signal_ok=last.signal_ok if last else None,
                sensor_faults_7d=faults,
            )
        )
    return out


@router.get("/system", response_model=AdminSystemOut)
def system(db: Session = Depends(get_db)) -> AdminSystemOut:
    settings = get_settings()
    now = clock.now_utc()
    started = time.perf_counter()
    try:
        db.execute(text("select 1"))
        db_ok, latency = True, round((time.perf_counter() - started) * 1000, 1)
    except Exception:  # the screen must still answer when the database is down
        db_ok, latency = False, None
    window = timedelta(seconds=settings.device_online_window_s)
    all_devices = db.scalars(select(Device)).all() if db_ok else []
    return AdminSystemOut(
        generated_at=now,
        uptime_s=monitor.uptime_s(),
        database=db.get_bind().dialect.name,
        database_ok=db_ok,
        database_latency_ms=latency,
        requests_total=monitor.get("requests"),
        errors_5xx=monitor.get("errors_5xx"),
        readings_rejected=monitor.get("readings_rejected"),
        readings_last_hour=_count(db, select(func.count()).select_from(Reading).where(Reading.ts >= now - timedelta(hours=1))) if db_ok else 0,
        devices_total=len(all_devices),
        devices_online=sum(1 for d in all_devices if d.last_seen_at and now - d.last_seen_at <= window),
        alerts_24h=_count(db, select(func.count()).select_from(Alert).where(Alert.created_at >= now - timedelta(hours=24))) if db_ok else 0,
        emails_sent=monitor.get("emails_sent"),
        emails_failed=monitor.get("emails_failed"),
        emails_logged=monitor.get("emails_logged"),
        email_mode="smtp" if settings.email_configured else "log",
        llm_configured=bool(settings.llm_api_key),
        open_tickets=_count(db, select(func.count()).select_from(SupportTicket).where(SupportTicket.status == "open")) if db_ok else 0,
        users_total=_count(db, select(func.count()).select_from(User)) if db_ok else 0,
        households_total=_count(db, select(func.count()).select_from(Household)) if db_ok else 0,
        recent_errors=list(monitor.recent_errors),
    )


@router.get("/tariff-audit", response_model=list[TariffAuditOut])
def tariff_audit(db: Session = Depends(get_db)) -> list[TariffAudit]:
    return list(db.scalars(select(TariffAudit).order_by(TariffAudit.created_at.desc()).limit(100)))


@router.get("/tickets", response_model=list[TicketOut])
def tickets(db: Session = Depends(get_db)) -> list[SupportTicket]:
    return list(db.scalars(select(SupportTicket).order_by(SupportTicket.created_at.desc()).limit(200)))


@router.patch("/tickets/{ticket_id}", response_model=TicketOut)
def set_ticket_status(ticket_id: uuid.UUID, body: TicketStatusIn, db: Session = Depends(get_db)) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message introuvable")
    ticket.status = body.status
    db.commit()
    return ticket
