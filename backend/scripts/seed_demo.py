"""Create the demo accounts, household, devices and (optionally) a month of history.

Run from the backend/ folder, after filling .env:

    python -m scripts.seed_demo --email demo@trancheguard.tn
    python -m scripts.seed_demo --email demo@trancheguard.tn --admin-email admin@trancheguard.tn
    python -m scripts.seed_demo --email demo@trancheguard.tn --reset      # wipe and re-seed demo data

Safe to run twice: existing users, household and devices are kept.
Passwords and device keys are printed ONCE when created (not stored in clear).

History: readings every 15 min from the 1st of the month until now, sized so
the end-of-month forecast is about 75 % of the first threshold (150 kWh for
200). The demo then starts below the alert, and "Simulate spike" crosses it.
"""

import argparse
import math
import random
import sys
from datetime import timedelta
from pathlib import Path

from sqlalchemy import delete, insert, select, text
from sqlalchemy.orm import Session

from app import clock
from app.config import get_settings
from app.db import Base, SessionLocal, get_engine
from app.models import Alert, BadgeEarned, Device, Household, Reading, Score, TariffTranche, Tip, User
from app.security import generate_api_key, hash_api_key, hash_password
from app.services import tariff as tariff_engine

TARIFF_SEED_SQL = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20261121183806_seed_tariffs.sql"
SIM_DEVICE_ID = "sim-001"
ESP32_DEVICE_ID = "tg-001"
SLOT = timedelta(minutes=15)


def ensure_tariffs(db: Session) -> None:
    if db.scalar(select(TariffTranche.id).limit(1)) is not None:
        return
    sql = "\n".join(line for line in TARIFF_SEED_SQL.read_text().splitlines() if not line.strip().startswith("--"))
    for statement in filter(None, (s.strip() for s in sql.split(";"))):
        db.execute(text(statement))
    print("  tariffs: STEG grid inserted from the seed migration")


def ensure_user(db: Session, email: str, password: str | None, role: str) -> tuple[User, str | None]:
    email = email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        if password:
            user.password_hash = hash_password(password)
        return user, None
    shown = password or generate_api_key()[:16]
    user = User(email=email, password_hash=hash_password(shown), role=role)
    db.add(user)
    db.flush()
    return user, shown


def ensure_device(db: Session, household: Household, device_id: str, kind: str, key: str | None) -> str | None:
    """Create the device (or update its key). Returns the key if it must be shown."""
    device = db.get(Device, device_id)
    if device is not None:
        if key and device.api_key_hash != hash_api_key(key):
            device.api_key_hash = hash_api_key(key)
        return None
    shown = key or generate_api_key()
    db.add(Device(id=device_id, household_id=household.id, kind=kind, api_key_hash=hash_api_key(shown)))
    db.flush()
    return None if key else shown


def backfill_history(db: Session, household: Household, device_id: str, target_ratio: float, seed: int = 7) -> int:
    """Readings every 15 min since the 1st of the month, ending 15 min ago."""
    now = clock.now_utc()
    month_start, month_end = clock.month_bounds(now)
    month_hours = clock.hours_between(month_start, month_end)
    elapsed_hours = clock.hours_between(month_start, now)
    tariff = tariff_engine.load_tariff(db, "electricity", clock.local_date(now))
    first_threshold = tariff.thresholds[0] if tariff and tariff.thresholds else 200.0
    target_kwh = target_ratio * first_threshold * elapsed_hours / month_hours

    rng = random.Random(seed)
    slots = []
    ts = month_start
    while ts < now - SLOT:
        h = clock.to_local(ts).hour + clock.to_local(ts).minute / 60
        power = 110 + 250 * math.exp(-((h - 8) ** 2) / 2) + 450 * math.exp(-((h - 20.5) ** 2) / 3)
        heater = 7 <= h < 7.5  # water heater every morning: gives the "heavy consumer" data
        if heater:
            power += 2000
        power *= 1 + rng.gauss(0, 0.08)
        litres = 0.0
        if 7 <= h < 8 or 20 <= h < 21:
            litres = 30 + rng.gauss(0, 5)  # showers
        elif 8 <= h < 23 and rng.random() < 0.3:
            litres = 3 + abs(rng.gauss(0, 1))
        slots.append([ts, max(50.0, power), max(0.0, litres), heater])
        ts += SLOT
    if not slots:
        return 0

    scale = target_kwh / sum(p * 0.25 / 1000 for _, p, _, _ in slots)
    rows, energy, water, prev_power = [], 0.0, 0.0, None
    for i, (ts, power, litres, heater) in enumerate(slots):
        power *= scale
        delta_kwh = 0.0 if i == 0 else power * 0.25 / 1000
        delta_l = 0.0 if i == 0 else litres
        energy += delta_kwh
        water += delta_l
        step = None if prev_power is None else power - prev_power
        rows.append(
            {
                "device_id": device_id,
                "ts": ts,
                "voltage_v": 230.0,
                "current_a": round(power / (230 * 0.93), 2),
                "power_w": round(power, 1),
                "energy_kwh": round(energy, 3),
                "frequency_hz": 50.0,
                "power_factor": 0.93,
                "flow_l_min": round(litres / 15, 2),
                "water_total_l": round(water, 2),
                "pulses_delta": int(litres * 450),
                "signal_ok": True,
                "energy_delta_kwh": round(delta_kwh, 4),
                "water_delta_l": round(delta_l, 2),
                "step_w": round(step, 1) if heater and step and step >= 800 else None,
                "appliance_hint": "Chauffe-eau électrique ou bouilloire" if heater and step and step >= 800 else None,
            }
        )
        prev_power = power
    for chunk in range(0, len(rows), 500):
        db.execute(insert(Reading), rows[chunk : chunk + 500])
    # last_seen_at stays empty: history is not a live device, so no "offline" alert.
    return len(rows)


def reset_demo_data(db: Session, household: Household) -> None:
    device_ids = list(db.scalars(select(Device.id).where(Device.household_id == household.id)))
    if device_ids:
        db.execute(delete(Reading).where(Reading.device_id.in_(device_ids)))
    for model in (Alert, Tip, Score, BadgeEarned):
        db.execute(delete(model).where(model.household_id == household.id))
    print("  demo data wiped (readings, alerts, tips, scores, badges)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed Tranche Guard demo data")
    parser.add_argument("--email", required=True, help="household account email")
    parser.add_argument("--password", help="household password (default: generated and printed)")
    parser.add_argument("--admin-email", help="also create an admin account (can edit tariffs)")
    parser.add_argument("--admin-password")
    parser.add_argument("--household-name", default="Maison démo")
    parser.add_argument("--kva", type=float, default=6.0)
    parser.add_argument("--no-history", action="store_true", help="do not backfill this month's readings")
    parser.add_argument("--target-ratio", type=float, default=0.75, help="forecast / first threshold")
    parser.add_argument("--reset", action="store_true", help="wipe the demo household data first")
    args = parser.parse_args(argv)

    settings = get_settings()
    if not settings.device_api_key:
        print("Set DEVICE_API_KEY in .env first (the simulator uses the same key).", file=sys.stderr)
        return 1

    engine = get_engine()
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)
    print(f"Seeding {engine.dialect.name} database...")

    with SessionLocal() as db:
        ensure_tariffs(db)
        if args.admin_email:
            _, admin_pw = ensure_user(db, args.admin_email, args.admin_password, "admin")
            print(f"  admin: {args.admin_email}" + (f"  password: {admin_pw}" if admin_pw else " (existing)"))
        user, user_pw = ensure_user(db, args.email, args.password, "household")
        print(f"  household user: {args.email}" + (f"  password: {user_pw}" if user_pw else " (existing)"))

        household = db.scalar(select(Household).where(Household.user_id == user.id))
        if household is None:
            household = Household(user_id=user.id, name=args.household_name, subscribed_kva=args.kva)
            db.add(household)
            db.flush()
        if args.reset:
            reset_demo_data(db, household)

        ensure_device(db, household, SIM_DEVICE_ID, "simulator", settings.device_api_key)
        esp32_key = ensure_device(db, household, ESP32_DEVICE_ID, "esp32", None)
        print(f"  device {SIM_DEVICE_ID} (simulator): key = DEVICE_API_KEY from .env")
        if esp32_key:
            print(f"  device {ESP32_DEVICE_ID} (esp32): key = {esp32_key}   <- put it in the firmware, shown once")
        else:
            print(f"  device {ESP32_DEVICE_ID} (esp32): existing")
        if household.active_device_id is None:
            household.active_device_id = SIM_DEVICE_ID

        has_readings = db.scalar(select(Reading.id).where(Reading.device_id == SIM_DEVICE_ID).limit(1))
        if not args.no_history and has_readings is None:
            count = backfill_history(db, household, SIM_DEVICE_ID, args.target_ratio)
            print(f"  history: {count} readings (every 15 min since the 1st of the month)")
        db.commit()
    print("Done. Start the API (uvicorn app.main:app --reload) and the simulator (python -m simulator.simulator).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
