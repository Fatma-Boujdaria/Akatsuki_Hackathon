"""Rule-based tips with the DT saved. Every number comes from the tariff module.

| Code       | When                                    | Saving computed as                          |
|------------|-----------------------------------------|---------------------------------------------|
| threshold  | forecast above the next threshold       | bill(forecast) - bill(threshold)            |
| keep_pace  | forecast below the next threshold       | jump avoided at the threshold               |
| leak       | an unacknowledged leak alert            | litres/day (DT once the SONEDE grid is set) |
| appliance  | a heavy consumer starts often (7 days)  | bill(forecast) - bill(forecast - 1 h/day)   |
| standby    | permanent load >= 30 W over 24 h         | bill(forecast) - bill(forecast - half)      |
| offpeak    | always                                  | 0 DT: helps the grid, not the bill (said)   |

A batch of tips is stored in the tips table (one created_at per batch) and
reused for 60 s, so polling the endpoint does not recompute every time.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Alert, Household, Reading, Tip
from app.services import consumption, fmt, llm
from app.services import tariff as tariff_engine

PRIORITY = ["threshold", "keep_pace", "leak", "appliance", "standby", "offpeak"]
STANDBY_MIN_W = 30
KEEP_TIPS_DAYS = 7


@dataclass
class TipDraft:
    code: str
    text: str
    saving_dt: float | None


def standby_watts(db: Session, device_ids: list[str], now: datetime) -> float | None:
    """Lowest reliable power over the last 24 h: what the home draws all the time."""
    if not device_ids:
        return None
    since = now - timedelta(hours=24)
    low, first = db.execute(
        select(func.min(Reading.power_w), func.min(Reading.ts)).where(
            Reading.device_id.in_(device_ids), Reading.ts >= since, Reading.signal_ok.is_(True)
        )
    ).one()
    if low is None or first is None:
        return None
    if first.tzinfo is None:
        first = first.replace(tzinfo=now.tzinfo)
    if now - first < timedelta(hours=12):
        return None  # not enough data to be sure the minimum is a real baseline
    return float(low)


def top_appliance(db: Session, device_ids: list[str], now: datetime) -> tuple[str, float] | None:
    if not device_ids:
        return None
    row = db.execute(
        select(Reading.appliance_hint, func.avg(Reading.step_w))
        .where(
            Reading.device_id.in_(device_ids),
            Reading.ts >= now - timedelta(days=7),
            Reading.appliance_hint.is_not(None),
        )
        .group_by(Reading.appliance_hint)
        .order_by(func.count().desc())
        .limit(1)
    ).first()
    return None if row is None else (row[0], float(row[1]))


def build_tips(db: Session, household: Household, now: datetime) -> list[TipDraft]:
    statuses = consumption.household_status(db, household, now)
    elec, water = statuses["electricity"], statuses["water"]
    tariff = elec.tariff
    kva = float(household.subscribed_kva)
    forecast = elec.usage.forecast_qty
    days_left = max(elec.usage.hours_left / 24, 1 / 24)
    device_ids = consumption.household_device_ids(db, household)
    drafts: list[TipDraft] = []

    if tariff is not None and forecast is not None:
        threshold = tariff.next_threshold(elec.billed_qty)
        if threshold is not None and forecast > threshold:
            cut = forecast - threshold
            saving = tariff_engine.saving_dt(tariff, kva, forecast, threshold)
            drafts.append(
                TipDraft(
                    "threshold",
                    f"Pour rester sous {fmt.num(threshold)} kWh ce mois-ci, réduis d'environ {fmt.kwh(cut)} "
                    f"d'ici la fin du mois (≈ {fmt.num(cut / days_left, 1)} kWh par jour). "
                    f"Économie estimée : {fmt.dt(saving)}.",
                    saving,
                )
            )
        elif threshold is not None:
            avoided = elec.crossing_extra_cost_dt or 0.0
            drafts.append(
                TipDraft(
                    "keep_pace",
                    f"Bravo : à ce rythme tu restes sous {fmt.num(threshold)} kWh "
                    f"(prévision {fmt.kwh(forecast)}). Garde ce rythme pour éviter "
                    f"{fmt.dt(avoided)} de surcoût.",
                    avoided,
                )
            )

    leak = db.scalar(
        select(Alert).where(
            Alert.household_id == household.id, Alert.type == "leak", Alert.acknowledged_at.is_(None)
        )
    )
    if leak is not None:
        latest = consumption.latest_reading(db, device_ids)
        flow = latest.flow_l_min if latest and latest.signal_ok and latest.flow_l_min else 0.0
        litres_day = flow * 60 * 24
        saving = None
        if water.tariff is not None and water.billed_forecast is not None:
            saving = tariff_engine.saving_dt(
                water.tariff, 0.0, water.billed_forecast, water.billed_forecast - litres_day * days_left / 1000
            )
        text = (
            f"Répare la fuite détectée : à ce débit elle gaspille environ {fmt.litres(litres_day)} par jour."
            if litres_day > 0
            else "Une fuite a été détectée cette nuit : vérifie la chasse d'eau et les robinets."
        )
        if saving:
            text += f" Économie estimée : {fmt.dt(saving)} d'ici la fin du mois."
        drafts.append(TipDraft("leak", text, saving))

    if tariff is not None and forecast is not None:
        appliance = top_appliance(db, device_ids, now)
        if appliance is not None:
            label, step_w = appliance
            save_kwh = step_w / 1000 * 1.0 * days_left  # 1 h less per day until month end
            saving = tariff_engine.saving_dt(tariff, kva, forecast, forecast - save_kwh)
            drafts.append(
                TipDraft(
                    "appliance",
                    f"Un appareil d'environ {fmt.num(step_w / 1000, 1)} kW ({label.lower()}) démarre souvent. "
                    f"L'utiliser 1 h de moins par jour économise ≈ {fmt.kwh(save_kwh)}, "
                    f"soit {fmt.dt(saving)} d'ici la fin du mois.",
                    saving,
                )
            )

        base_w = standby_watts(db, device_ids, now)
        if base_w is not None and base_w >= STANDBY_MIN_W:
            save_kwh = base_w / 2 / 1000 * 24 * days_left
            saving = tariff_engine.saving_dt(tariff, kva, forecast, forecast - save_kwh)
            drafts.append(
                TipDraft(
                    "standby",
                    f"Ta maison consomme au moins {fmt.num(base_w)} W en permanence (veille). "
                    f"Débranche box, TV et chargeurs la nuit : diviser cette veille par deux "
                    f"économise ≈ {fmt.kwh(save_kwh)}, soit {fmt.dt(saving)} d'ici la fin du mois.",
                    saving,
                )
            )

    if elec.usage.month_qty > 0 or forecast is not None:
        drafts.append(
            TipDraft(
                "offpeak",
                "Si tu peux, lance la machine à laver et le chauffe-eau en dehors des heures de pointe "
                "du soir. Ça soulage le réseau STEG, mais ça ne change pas ta facture.",
                0.0,
            )
        )
    return drafts


def _batch(db: Session, household: Household, created_at: datetime) -> list[Tip]:
    tips = db.scalars(select(Tip).where(Tip.household_id == household.id, Tip.created_at == created_at)).all()
    return sorted(tips, key=lambda t: PRIORITY.index(t.code) if t.code in PRIORITY else len(PRIORITY))


def refresh_tips(
    db: Session, household: Household, now: datetime, force: bool = False, use_llm: bool = True
) -> list[Tip]:
    """Latest tip batch; recomputed when older than 60 s (or when forced)."""
    latest_at = db.scalar(select(func.max(Tip.created_at)).where(Tip.household_id == household.id))
    if latest_at is not None and latest_at.tzinfo is None:
        latest_at = latest_at.replace(tzinfo=now.tzinfo)
    if not force and latest_at is not None and now - latest_at < timedelta(seconds=get_settings().tips_refresh_s):
        return _batch(db, household, latest_at)

    drafts = build_tips(db, household, now)
    reworded = llm.reword_tips([d.text for d in drafts]) if use_llm else None
    tips = []
    for i, draft in enumerate(drafts):
        new_text = reworded[i] if reworded else None
        tips.append(
            Tip(
                household_id=household.id,
                code=draft.code,
                text=new_text or draft.text,
                saving_dt=draft.saving_dt,
                source="llm" if new_text else "rule",
                created_at=now,
            )
        )
    db.add_all(tips)
    # Keep a week of history, not every batch forever.
    db.execute(
        delete(Tip).where(Tip.household_id == household.id, Tip.created_at < now - timedelta(days=KEEP_TIPS_DAYS))
    )
    db.flush()
    return tips
