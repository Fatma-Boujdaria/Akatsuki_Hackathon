"""Database connection: one SQLAlchemy engine, one session per request.

The same code talks to Supabase PostgreSQL (demo and team) and to SQLite
(automatic tests, quick local start). The ORM hides the differences.
"""

from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy import DateTime, Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import get_settings

SQLITE_DEFAULT_URL = "sqlite:///./tranche_guard.db"


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


def make_engine(url: str) -> Engine:
    url = normalize_database_url(url)
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_conn, _record):  # SQLite ignores FKs unless asked
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine
    return create_engine(
        url,
        pool_pre_ping=True,  # reconnect quietly if Supabase closed an idle connection
        pool_size=5,
        max_overflow=5,
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
