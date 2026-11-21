"""scripts/setup_env.py: password encoding and .env rendering (no network)."""

from sqlalchemy.engine import make_url

from app.db import normalize_database_url
from scripts import setup_env

TRICKY = "p@ss#w/rd%1 $x{y}:é"


def test_password_with_special_characters_survives_the_url():
    pasted = "postgresql://postgres.nkzfqdvhfhvtytmklenj:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
    url = setup_env.fill_password(pasted, TRICKY)
    parsed = make_url(normalize_database_url(url))
    assert parsed.password == TRICKY
    assert parsed.host == "aws-0-eu-west-1.pooler.supabase.com" and parsed.username == "postgres.nkzfqdvhfhvtytmklenj"
    for candidate in setup_env.pooler_candidates(TRICKY):
        assert make_url(normalize_database_url(candidate)).password == TRICKY


def test_password_is_hidden_in_messages():
    url = setup_env.pooler_candidates("secret123")[0]
    assert "secret123" not in setup_env.hide_password(url) and "****" in setup_env.hide_password(url)


def test_render_env_keeps_comments_and_fills_values():
    template = "# comment\nDATABASE_URL=old\nJWT_SECRET=\n# other\nDEMO_MODE=true\n"
    text = setup_env.render_env(template, {"DATABASE_URL": "new", "JWT_SECRET": "abc", "DEVICE_API_KEY": "k"})
    assert text == "# comment\nDATABASE_URL=new\nJWT_SECRET=abc\n# other\nDEMO_MODE=true\nDEVICE_API_KEY=k\n"


def test_sqlite_mode_keeps_existing_secrets(tmp_path, monkeypatch):
    env, example = tmp_path / ".env", tmp_path / ".env.example"
    example.write_text("DATABASE_URL=x\nJWT_SECRET=\nDEVICE_API_KEY=\n")
    env.write_text("JWT_SECRET=" + "j" * 40 + "\nDEVICE_API_KEY=keep-me\n")
    monkeypatch.setattr(setup_env, "ENV_FILE", env)
    monkeypatch.setattr(setup_env, "EXAMPLE_FILE", example)
    assert setup_env.main(["--sqlite"]) == 0
    values = setup_env.read_env(env)
    assert values["DEVICE_API_KEY"] == "keep-me" and values["JWT_SECRET"] == "j" * 40
    assert values["DATABASE_URL"] == ""


def test_new_env_gets_long_random_secrets(tmp_path, monkeypatch):
    monkeypatch.setattr(setup_env, "ENV_FILE", tmp_path / ".env")
    monkeypatch.setattr(setup_env, "EXAMPLE_FILE", tmp_path / "missing.example")
    assert setup_env.main(["--sqlite"]) == 0
    values = setup_env.read_env(tmp_path / ".env")
    assert len(values["JWT_SECRET"]) >= 60 and len(values["DEVICE_API_KEY"]) >= 40
