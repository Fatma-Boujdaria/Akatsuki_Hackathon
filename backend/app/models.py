"""The 10 tables of the Backend Schema Document, as SQLAlchemy classes.

Everything hangs off a household; readings come from its devices. Tariff
prices sit in their own tables so they change without touching code.

The SQL version of the same schema, applied to Supabase, is in
supabase/migrations/. Keep both in sync (tests check it).

A few columns were added to the blueprint, each marked "(added)":
- readings.energy_delta_kwh / water_delta_l: consumption since the previous
  reading, computed at ingest. Monthly totals become a fast SUM().
- readings.step_w / appliance_hint: heavy-consumer detection (power steps).
- households.leak_* and active_device_id: adjustable leak rule, demo switch.
- alerts.severity / dedupe_key: banner level, "fires once per threshold".
- tips.code, scores.kwh / budget_kwh: let the frontend pick icons and explain.

Second phase (full application, see supabase/migrations/20261122010811_full_app.sql):
- users: full name, language, account status, email verification, token
  version (log out everywhere), notification preferences.
- households: address, occupants, onboarding flag (several homes per account).
- alerts.params / tips.params: the numbers of the message, so the app can
  show it in French, English or Tunisian Arabic.
- appliances, auth_codes, support_tickets, tariff_audit: new tables.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app import clock
from app.db import Base, UTCDateTime

# Enumerations, stored as short strings with a CHECK constraint.
ROLES = ("admin", "household")
DEVICE_KINDS = ("esp32", "simulator")
RESOURCES = ("electricity", "water")
ALERT_TYPES = ("threshold", "leak", "device_offline", "sensor_fault")
SEVERITIES = ("info", "warning", "critical")
TIP_SOURCES = ("rule", "llm")
LANGUAGES = ("fr", "en", "ar")
USER_STATUSES = ("active", "suspended")
CODE_PURPOSES = ("verify_email", "reset_password")
TICKET_STATUSES = ("open", "answered", "closed")
# jsonb on PostgreSQL (Supabase), JSON text on SQLite.
JsonType = JSON().with_variant(JSONB(), "postgresql")
DEFAULT_NOTIFY_PREFS = {"threshold": True, "leak": True, "device": True, "tips": True, "push": False}


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} in ({', '.join(repr(v) for v in values)})"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(_in("role", ROLES), name="users_role_check"),
        CheckConstraint(_in("language", LANGUAGES), name="users_language_check"),
        CheckConstraint(_in("status", USER_STATUSES), name="users_status_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="household")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)
    # (added, phase 2)
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    language: Mapped[str] = mapped_column(String(2), default="fr")
    status: Mapped[str] = mapped_column(String(12), default="active")  # admin can suspend
    # Accounts created before sign-up existed (seed, tests) count as verified.
    email_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    # Bumped on password change / "log out everywhere": older tokens stop working.
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    notify_prefs: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    households: Mapped[list["Household"]] = relationship(back_populates="user")


class Household(Base):
    __tablename__ = "households"
    __table_args__ = (
        CheckConstraint("subscribed_kva > 0", name="households_kva_check"),
        CheckConstraint("alert_margin_kwh >= 0", name="households_margin_check"),
        CheckConstraint("leak_start_hour between 0 and 23", name="households_leak_start_check"),
        CheckConstraint("leak_end_hour between 0 and 23", name="households_leak_end_check"),
        CheckConstraint("leak_min_minutes > 0", name="households_leak_minutes_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    subscribed_kva: Mapped[float] = mapped_column(Numeric(5, 1, asdecimal=False))
    alert_margin_kwh: Mapped[int] = mapped_column(Integer, default=10)
    leak_start_hour: Mapped[int] = mapped_column(Integer, default=1)  # (added) 01:00
    leak_end_hour: Mapped[int] = mapped_column(Integer, default=5)  # (added) 05:00
    leak_min_minutes: Mapped[int] = mapped_column(Integer, default=120)  # (added) 2 h
    # (added) Which device feeds the dashboard. NULL = all devices of the home.
    active_device_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)
    # (added, phase 2)
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    occupants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    onboarding_done: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[User] = relationship(back_populates="households")
    devices: Mapped[list["Device"]] = relationship(back_populates="household")


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (CheckConstraint(_in("kind", DEVICE_KINDS), name="devices_kind_check"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # e.g. "tg-001"
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))
    # SHA-256 of the device API key. The key itself is never stored.
    api_key_hash: Mapped[str] = mapped_column(String(64), unique=True)
    calib_pulses_per_l: Mapped[int] = mapped_column(Integer, default=450)
    last_seen_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)

    household: Mapped[Household] = relationship(back_populates="devices")


class Reading(Base):
    """One JSON payload from the ESP32 or the simulator, stored flat."""

    __tablename__ = "readings"
    __table_args__ = (Index("readings_device_ts_idx", "device_id", "ts"),)

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(UTCDateTime)
    # Electricity (PZEM-004T). NULL when the sensor did not answer.
    voltage_v: Mapped[float | None] = mapped_column(Float)
    current_a: Mapped[float | None] = mapped_column(Float)
    power_w: Mapped[float | None] = mapped_column(Float)
    energy_kwh: Mapped[float | None] = mapped_column(Float)  # cumulative meter value
    frequency_hz: Mapped[float | None] = mapped_column(Float)
    power_factor: Mapped[float | None] = mapped_column(Float)
    # Water (YF-S201). NULL when the sensor did not answer.
    flow_l_min: Mapped[float | None] = mapped_column(Float)
    water_total_l: Mapped[float | None] = mapped_column(Float)  # cumulative, kept in flash
    pulses_delta: Mapped[int | None] = mapped_column(Integer)
    signal_ok: Mapped[bool] = mapped_column(Boolean)
    # (added) Consumption since the previous good reading of the same device.
    energy_delta_kwh: Mapped[float | None] = mapped_column(Float)
    water_delta_l: Mapped[float | None] = mapped_column(Float)
    # (added) Power step vs previous reading and the probable appliance.
    step_w: Mapped[float | None] = mapped_column(Float)
    appliance_hint: Mapped[str | None] = mapped_column(String(60))


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(_in("type", ALERT_TYPES), name="alerts_type_check"),
        CheckConstraint(f"resource is null or {_in('resource', RESOURCES)}", name="alerts_resource_check"),
        CheckConstraint(_in("severity", SEVERITIES), name="alerts_severity_check"),
        UniqueConstraint("household_id", "dedupe_key", name="alerts_household_dedupe_key"),
        Index("alerts_household_created_idx", "household_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(20))
    resource: Mapped[str | None] = mapped_column(String(20), nullable=True)  # NULL for device_offline
    severity: Mapped[str] = mapped_column(String(10), default="warning")  # (added)
    message: Mapped[str] = mapped_column(Text)
    extra_cost_dt: Mapped[float | None] = mapped_column(Numeric(10, 3, asdecimal=False), nullable=True)
    # (added) e.g. "threshold:electricity:200:2026-11" -> one alert per threshold per month.
    dedupe_key: Mapped[str | None] = mapped_column(String(160), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)
    acknowledged_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    # (added, phase 2) Numbers of the message, for the translated text in the app.
    params: Mapped[dict | None] = mapped_column(JsonType, nullable=True)


class Tip(Base):
    __tablename__ = "tips"
    __table_args__ = (CheckConstraint(_in("source", TIP_SOURCES), name="tips_source_check"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(40))  # (added) threshold, standby, appliance...
    text: Mapped[str] = mapped_column(Text)
    saving_dt: Mapped[float | None] = mapped_column(Numeric(10, 3, asdecimal=False), nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="rule")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)
    params: Mapped[dict | None] = mapped_column(JsonType, nullable=True)  # (added, phase 2)


class Score(Base):
    __tablename__ = "scores"
    __table_args__ = (
        UniqueConstraint("household_id", "day", name="scores_household_day_key"),
        CheckConstraint("score between 0 and 100", name="scores_score_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"))
    day: Mapped[date] = mapped_column(Date)
    score: Mapped[int] = mapped_column(Integer)
    kwh: Mapped[float | None] = mapped_column(Numeric(10, 3, asdecimal=False))  # (added)
    budget_kwh: Mapped[float | None] = mapped_column(Numeric(10, 3, asdecimal=False))  # (added)


class BadgeEarned(Base):
    __tablename__ = "badges_earned"

    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), primary_key=True
    )
    badge_code: Mapped[str] = mapped_column(String(40), primary_key=True)
    earned_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)


class TariffTranche(Base):
    """One price band. No foreign key: the tariff engine reads these rows."""

    __tablename__ = "tariff_tranches"
    __table_args__ = (
        CheckConstraint(_in("resource", RESOURCES), name="tariff_tranches_resource_check"),
        CheckConstraint("min_qty >= 0", name="tariff_tranches_min_check"),
        CheckConstraint("max_qty is null or max_qty > min_qty", name="tariff_tranches_max_check"),
        CheckConstraint("price_millimes >= 0", name="tariff_tranches_price_check"),
        CheckConstraint("vat_rate >= 0 and vat_rate < 1", name="tariff_tranches_vat_check"),
        # The unique constraint also indexes (resource, valid_from) for the engine.
        UniqueConstraint("resource", "valid_from", "min_qty", name="tariff_tranches_unique_band"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resource: Mapped[str] = mapped_column(String(20))
    min_qty: Mapped[float] = mapped_column(Numeric(12, 3, asdecimal=False))  # kWh or m3
    max_qty: Mapped[float | None] = mapped_column(Numeric(12, 3, asdecimal=False), nullable=True)
    price_millimes: Mapped[int] = mapped_column(Integer)  # per kWh or per m3
    vat_rate: Mapped[float] = mapped_column(Numeric(5, 4, asdecimal=False))  # 0.07 = 7 %
    valid_from: Mapped[date] = mapped_column(Date)


class TariffFee(Base):
    """A fee or tax. The key says what it applies to (see services/tariff.py)."""

    __tablename__ = "tariff_fees"
    __table_args__ = (UniqueConstraint("key", "valid_from", name="tariff_fees_key_valid_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(80))
    value_millimes: Mapped[float] = mapped_column(Numeric(12, 3, asdecimal=False))
    valid_from: Mapped[date] = mapped_column(Date)


# --- Phase 2 tables ----------------------------------------------------------------------


class Appliance(Base):
    """An appliance the household declared. A profile, never a measurement."""

    __tablename__ = "appliances"
    __table_args__ = (
        CheckConstraint("quantity between 1 and 100", name="appliances_quantity_check"),
        CheckConstraint("power_w is null or (power_w > 0 and power_w <= 20000)", name="appliances_power_check"),
        CheckConstraint(
            "hours_per_day is null or (hours_per_day >= 0 and hours_per_day <= 24)", name="appliances_hours_check"
        ),
        CheckConstraint("start_hour is null or start_hour between 0 and 23", name="appliances_start_check"),
        CheckConstraint("end_hour is null or end_hour between 0 and 23", name="appliances_end_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(40))  # air_conditioner, fridge... or "custom"
    name: Mapped[str] = mapped_column(String(80))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    power_w: Mapped[float | None] = mapped_column(Float, nullable=True)  # NULL: typical value used
    hours_per_day: Mapped[float | None] = mapped_column(Float, nullable=True)  # NULL: typical value used
    start_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)  # typical operating hours
    end_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)


class AuthCode(Base):
    """One-time code sent by email (verify the address, reset the password). Stored hashed."""

    __tablename__ = "auth_codes"
    __table_args__ = (
        CheckConstraint(_in("purpose", CODE_PURPOSES), name="auth_codes_purpose_check"),
        Index("auth_codes_user_purpose_idx", "user_id", "purpose"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    purpose: Mapped[str] = mapped_column(String(20))
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        CheckConstraint(_in("status", TICKET_STATUSES), name="support_tickets_status_check"),
        Index("support_tickets_created_idx", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # SET NULL: a ticket stays readable for support after the account is deleted.
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    email: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(30))  # problem, question, feedback, device
    subject: Mapped[str] = mapped_column(String(150))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="open")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)


class TariffAudit(Base):
    """Every tariff change: who made it, before and after (blueprint: audit log)."""

    __tablename__ = "tariff_audit"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    admin_email: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    before: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    after: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)
