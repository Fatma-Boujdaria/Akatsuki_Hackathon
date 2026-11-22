"""Supabase connection limits: the backend must not use the 15-client Session pooler."""

from sqlalchemy.engine import make_url

from app.db import make_engine, normalize_database_url, use_transaction_pooler
from scripts import setup_env

POOLER = "aws-0-eu-west-1.pooler.supabase.com"
PASSWORD = "p@ss#w/rd%1"


def _url(port: int, host: str = POOLER) -> str:
    encoded = "p%40ss%23w%2Frd%251"
    return normalize_database_url(f"postgresql://postgres.nkzfqdvhfhvtytmklenj:{encoded}@{host}:{port}/postgres")


def test_session_pooler_is_moved_to_transaction_pooler():
    fixed = make_url(use_transaction_pooler(_url(5432)))
    assert fixed.port == 6543 and fixed.host == POOLER
    assert fixed.password == PASSWORD  # special characters survive the rewrite


def test_other_urls_are_left_alone():
    for url in (_url(6543), _url(5432, host="db.nkzfqdvhfhvtytmklenj.supabase.co"), "postgresql+psycopg://postgres@localhost:5432/tg"):
        assert use_transaction_pooler(url) == url


def test_engine_keeps_few_connections():
    engine = make_engine(_url(5432))  # creating an engine does not connect
    assert engine.url.port == 6543
    assert engine.pool.size() == 3 and engine.pool._max_overflow == 2
    engine.dispose()


def test_setup_env_writes_the_transaction_pooler():
    assert all(":6543/" in u for u in setup_env.pooler_candidates("x"))
    pasted = f"postgresql://postgres.nkzfqdvhfhvtytmklenj:[YOUR-PASSWORD]@{POOLER}:5432/postgres"
    assert ":6543/" in setup_env.fill_password(pasted, "x")
