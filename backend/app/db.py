"""Database connection: one SQLAlchemy engine, one session per request.

The same code talks to Supabase PostgreSQL (demo and team) and to SQLite
(automatic tests, quick local start). The ORM hides the differences.
"""

import logging
from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy import DateTime, Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import get_settings

SQLITE_DEFAULT_URL = "sqlite:///./tranche_guard.db"
SESSION_POOLER_PORT = 5432  # Supabase "Session pooler": max 15 clients for the WHOLE project
TRANSACTION_POOLER_PORT = 6543  # Supabase "Transaction pooler": shares connections, ~200 clients

log = logging.getLogger(__name__)


def normalize_database_url(url: str) -> str:
    """Turn the URL copied from Supabase into one SQLAlchemy understands.

    Supabase shows "postgresql://user:pass@host:5432/postgres". SQLAlchemy
    needs the driver name, so we rewrite it to "postgresql+psycopg://...".
    """
    if not url:
        return SQLITE_DEFAULT_URL
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def use_transaction_pooler(url: str) -> str:
    """Move a Supabase Session-pooler URL (port 5432) to the Transaction pooler (6543).

    In session mode every open connection of every running backend holds one of
    only 15 slots, and the next one fails with "EMAXCONNSESSION max clients
    reached". The transaction pooler shares a few database connections between
    many clients. It works with this code because prepared statements are off
    (see make_engine) and nothing here relies on session state.
    """
    parsed = make_url(url)
    if (parsed.host or "").endswith(".pooler.supabase.com") and (parsed.port or SESSION_POOLER_PORT) == SESSION_POOLER_PORT:
        log.warning(
            "DATABASE_URL uses Supabase's Session pooler (port 5432, max 15 connections for the whole team). "
            "Using the Transaction pooler (port 6543) instead. Put :6543 in .env to make this explicit."
        )
        return parsed.set(port=TRANSACTION_POOLER_PORT).render_as_string(hide_password=False)
    return url


def make_engine(url: str) -> Engine:
    url = normalize_database_url(url)
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_conn, _record):  # SQLite ignores FKs unless asked
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine
    settings = get_settings()
    return create_engine(
        use_transaction_pooler(url),
        pool_pre_ping=True,  # reconnect quietly if Supabase closed an idle connection
        pool_size=settings.db_pool_size,  # small on purpose: the team shares the pooler
        max_overflow=settings.db_max_overflow,
        pool_timeout=10,  # wait at most 10 s for a free connection, then fail clearly
        # Supabase poolers (PgBouncer/Supavisor in transaction mode) do not support
        # server-side prepared statements; disabling them works with every pooler.
        connect_args={"prepare_threshold": None},
    )


class Base(DeclarativeBase):
    """Parent class of every table in app/models.py."""


class UTCDateTime(TypeDecorator):
    """Timestamps are always stored and returned in UTC, with a time zone.

    PostgreSQL has real "timestamptz"; SQLite stores text without zone. This
    type makes both behave the same: aware UTC datetimes in, aware UTC out.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetime: always pass a time zone")
        value = value.astimezone(timezone.utc)
        return value.replace(tzinfo=None) if dialect.name == "sqlite" else value

    def process_result_value(self, value: datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


_engine: Engine | None = None
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)


def init_engine(url: str | None = None) -> Engine:
    """Create the engine (called once at startup, or by tests with their own URL)."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = make_engine(get_settings().database_url if url is None else url)
    SessionLocal.configure(bind=_engine)
    return _engine


def get_engine() -> Engine:
    return _engine if _engine is not None else init_engine()


def get_db() -> Iterator[Session]:
    """FastAPI dependency: opens a session for one request and always closes it."""
    get_engine()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
