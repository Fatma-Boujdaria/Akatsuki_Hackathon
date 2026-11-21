"""Test fixtures: a fresh database per test, a frozen clock, a demo household.

Runs on SQLite by default. To run the same tests on PostgreSQL (with the
real Supabase migration files applied):

    TEST_DATABASE_URL=postgresql://postgres@localhost:55432/tg_test pytest
"""

import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-123")
os.environ["DEVICE_API_KEY"] = "sim-key-for-tests"
os.environ["LLM_API_KEY"] = ""
os.environ["DEMO_MODE"] = "true"
_tmp = tempfile.mkdtemp(prefix="tg-tests-")
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_tmp}/test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete, text  # noqa: E402

from app import clock  # noqa: E402
from app.db import Base, SessionLocal, init_engine  # noqa: E402
from app.deps import ingest_limiter, login_limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Device, Household, User  # noqa: E402
from app.security import hash_api_key, hash_password  # noqa: E402
from app.services import demo  # noqa: E402
from app.services.tariff import clear_tariff_cache  # noqa: E402

MIGRATIONS = Path(__file__).resolve().parent.parent / "supabase" / "migrations"
SIM_KEY = "sim-key-for-tests"
ESP_KEY = "esp-key-for-tests"
PASSWORD = "motdepasse-test"
# Saturday 21 Nov 2026, 16:00 in Tunis (15:00 UTC).
DEFAULT_NOW = datetime(2026, 11, 21, 15, 0, tzinfo=timezone.utc)


def _run_sql_file(conn, path: Path) -> None:
    if conn.dialect.name == "postgresql":
        conn.exec_driver_sql(path.read_text())  # whole file at once, as Supabase applies it
        return
    body = "\n".join(line for line in path.read_text().splitlines() if not line.strip().startswith("--"))
    for statement in filter(None, (s.strip() for s in body.split(";"))):
        conn.execute(text(statement))


@pytest.fixture(scope="session")
def engine():
    engine = init_engine(os.environ["DATABASE_URL"])
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            # The real Supabase migrations, so tests prove the SQL matches the models.
            conn.execute(text("drop schema public cascade; create schema public"))
            _run_sql_file(conn, MIGRATIONS / "20261121183251_init_schema.sql")
        else:
            Base.metadata.create_all(conn)
    return engine


class FrozenClock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kwargs) -> datetime:
        self.now += timedelta(**kwargs)
        return self.now


@pytest.fixture
def frozen(monkeypatch) -> FrozenClock:
    fake = FrozenClock(DEFAULT_NOW)
    monkeypatch.setattr(clock, "now_utc", fake)
    return fake


@pytest.fixture(autouse=True)
def clean_state(engine, frozen):
    """Empty every table, reload the STEG tariff rows, reset in-memory state."""
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(delete(table))
        _run_sql_file(conn, MIGRATIONS / "20261121183806_seed_tariffs.sql")
    login_limiter.reset()
    ingest_limiter.reset()
    clear_tariff_cache()
    demo._pending.clear()
    yield


@pytest.fixture
def db(engine):
    session = SessionLocal()
    yield session
    session.close()


def make_user(db, email: str, role: str = "household", with_household: bool = True, kva: float = 6.0):
    user = User(email=email, password_hash=hash_password(PASSWORD), role=role)
    db.add(user)
    db.flush()
    household = None
    if with_household:
        household = Household(user_id=user.id, name=f"Maison {email}", subscribed_kva=kva)
        db.add(household)
        db.flush()
    db.commit()
    return user, household


@pytest.fixture
def home(db):
    """A household with a simulator (sim-001, active) and an ESP32 (tg-001)."""
    user, household = make_user(db, "foyer@example.tn")
    db.add(Device(id="sim-001", household_id=household.id, kind="simulator", api_key_hash=hash_api_key(SIM_KEY)))
    db.add(Device(id="tg-001", household_id=household.id, kind="esp32", api_key_hash=hash_api_key(ESP_KEY)))
    household.active_device_id = "sim-001"
    db.commit()
    return household


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def login(client, email: str, password: str = PASSWORD) -> dict:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def auth(client, home) -> dict:
    return login(client, "foyer@example.tn")


def payload(
    ts: datetime,
    *,
    power_w: float = 500.0,
    energy_kwh: float = 10.0,
    flow_l_min: float = 0.0,
    total_l: float = 100.0,
    signal_ok: bool = True,
    device_id: str = "sim-001",
    electricity: bool = True,
    water: bool = True,
) -> dict:
    body = {"device_id": device_id, "timestamp": ts.isoformat(), "signal_ok": signal_ok}
    body["electricity"] = (
        {
            "voltage_v": 230.0,
            "current_a": round(power_w / 230, 2),
            "power_w": power_w,
            "energy_kwh": energy_kwh,
            "frequency_hz": 50.0,
            "power_factor": 0.95,
        }
        if electricity
        else None
    )
    body["water"] = (
        {"flow_l_min": flow_l_min, "total_l": total_l, "pulses_delta": int(flow_l_min * 37.5), "calib_pulses_per_l": 450}
        if water
        else None
    )
    return body


def post_reading(client, body: dict, key: str = SIM_KEY):
    return client.post("/api/readings", json=body, headers={"X-Device-Key": key})
