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
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
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


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} in ({', '.join(repr(v) for v in values)})"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(_in("role", ROLES), name="users_role_check"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="household")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.now_utc)

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
