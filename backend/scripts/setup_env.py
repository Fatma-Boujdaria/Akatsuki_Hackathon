"""Create backend/.env in one command.

    python -m scripts.setup_env            # Supabase: asks for the database password (hidden)
    python -m scripts.setup_env --sqlite   # offline: local SQLite file, no password needed

What it does:
1. Generates JWT_SECRET and DEVICE_API_KEY (long random strings). If .env already
   exists, keeps its secrets, so device keys and logins stay valid.
2. Builds DATABASE_URL for the Akatsuki_db Session pooler. The password is
   URL-encoded, so characters like @ # / % in it do not break the URL.
3. Connects to Supabase and checks the Tranche Guard tables are there.
4. Writes .env (from .env.example, comments kept). .env is git-ignored.

The password is typed hidden and only written to your local .env file.
"""

import argparse
import getpass
import os
import secrets
import sys
from pathlib import Path
from urllib.parse import quote

PROJECT_REF = "nkzfqdvhfhvtytmklenj"  # Akatsuki_db (not a secret: it is in the project URL)
REGION = "eu-west-1"
PLACEHOLDER = "[YOUR-PASSWORD]"
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"
EXAMPLE_FILE = BACKEND_DIR / ".env.example"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            key, sep, value = line.partition("=")
            if sep and not key.strip().startswith("#"):
                values[key.strip()] = value.strip()
    return values


def pooler_candidates(password: str) -> list[str]:
    """Session pooler URLs to try (Supabase uses aws-0 or aws-1 depending on the project)."""
    encoded = quote(password, safe="")
    return [
        f"postgresql://postgres.{PROJECT_REF}:{encoded}@{host}-{REGION}.pooler.supabase.com:5432/postgres"
        for host in ("aws-0", "aws-1")
    ]


def fill_password(pasted_url: str, password: str) -> str:
    """Put the URL-encoded password in the connection string copied from Supabase."""
    pasted_url = pasted_url.strip()
    if PLACEHOLDER in pasted_url:
        return pasted_url.replace(PLACEHOLDER, quote(password, safe=""))
    return pasted_url  # the pasted URL already contains a password


def hide_password(url: str) -> str:
    head, at, tail = url.rpartition("@")
    if not at:
        return url
    scheme_user, _, _ = head.rpartition(":")
    return f"{scheme_user}:****@{tail}"


def check_connection(url: str) -> tuple[bool, str]:
    """(ok, message). Fails fast on a wrong password, tries the next host on other errors."""
    import psycopg  # installed with requirements.txt

    try:
        with psycopg.connect(url, connect_timeout=10, prepare_threshold=None) as conn:
            tables = conn.execute(
                "select count(*) from information_schema.tables where table_schema = 'public' "
                "and table_name in ('users','households','devices','readings','alerts','tips',"
                "'scores','badges_earned','tariff_tranches','tariff_fees')"
            ).fetchone()[0]
            tranches = conn.execute("select count(*) from tariff_tranches").fetchone()[0] if tables == 10 else 0
        return True, f"connected: {tables}/10 Tranche Guard tables, {tranches} STEG tranches"
    except Exception as exc:  # noqa: BLE001 - we only report it
        return False, str(exc).strip().splitlines()[0][:200]


def render_env(template: str, values: dict[str, str]) -> str:
    """The .env.example text with our values on the KEY= lines (comments kept)."""
    lines, seen = [], set()
    for line in template.splitlines():
        key, sep, _ = line.partition("=")
        key = key.strip()
        if sep and not key.startswith("#") and key in values:
            lines.append(f"{key}={values[key]}")
            seen.add(key)
        else:
            lines.append(line)
    lines += [f"{k}={v}" for k, v in values.items() if k not in seen]
    return "\n".join(lines) + "\n"


def ask_database_url() -> str | None:
    print("\n1) Supabase database password")
    print("   (Supabase > Akatsuki_db > Project Settings > Database. Reset it there if nobody knows it.)")
    password = getpass.getpass("   Password (hidden, press Enter when done): ")
    if not password:
        print("   No password typed.")
        return None
    print("\n2) Optional: paste the Session pooler connection string from Supabase")
    print("   (project page > Connect > Session pooler). Press Enter to let the script find it.")
    pasted = input("   Connection string: ").strip()
    candidates = [fill_password(pasted, password)] if pasted else pooler_candidates(password)

    print("\n3) Testing the connection...")
    for url in candidates:
        ok, message = check_connection(url)
        print(f"   {hide_password(url)}\n   -> {message}")
        if ok:
            return url
        if "password authentication failed" in message:
            print("   The password is wrong. Check it (or reset it) in Supabase and run this again.")
            return None
    print("   Could not connect. Paste the exact connection string from Supabase (step 2) and retry.")
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create backend/.env")
    parser.add_argument("--sqlite", action="store_true", help="use a local SQLite file (no Supabase)")
    args = parser.parse_args(argv)

    existing = read_env(ENV_FILE)
    values = {
        "JWT_SECRET": existing.get("JWT_SECRET") or secrets.token_urlsafe(48),
        "DEVICE_API_KEY": existing.get("DEVICE_API_KEY") or secrets.token_urlsafe(32),
        "LLM_API_KEY": existing.get("LLM_API_KEY", ""),
        "DEMO_MODE": existing.get("DEMO_MODE", "true"),
        "CORS_ORIGINS": existing.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"),
    }
    if len(values["JWT_SECRET"]) < 32:
        values["JWT_SECRET"] = secrets.token_urlsafe(48)

    if args.sqlite:
        values["DATABASE_URL"] = ""
        print("Using a local SQLite file (backend/tranche_guard.db). No internet needed.")
    else:
        url = ask_database_url()
        if url is None:
            return 1
        values["DATABASE_URL"] = url

    template = EXAMPLE_FILE.read_text(encoding="utf-8") if EXAMPLE_FILE.exists() else ""
    ENV_FILE.write_text(render_env(template, values), encoding="utf-8")
    if os.name == "posix":
        ENV_FILE.chmod(0o600)  # readable by you only

    kept = [k for k in ("JWT_SECRET", "DEVICE_API_KEY") if existing.get(k)]
    print(f"\n.env written to {ENV_FILE}")
    print("   JWT_SECRET and DEVICE_API_KEY: " + ("kept from the old .env" if kept else "generated"))
    print("   .env is git-ignored: never commit it, never paste it in a chat.")
    print("\nNext:  python -m scripts.seed_demo --email demo@trancheguard.tn --password <choose-one>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
