"""Daily score 0-100, badges, ranking mock-up and weekly challenge.

Score of a day: the "budget" is the kWh per day that keeps the month under
the next threshold, given what was used before that day:

    budget = (next_threshold - used_before_the_day) / days_left_in_month

    score = 100 if the day used <= budget, else 100 x budget / used,
            never below 20 (realistic goals, never punitive).

Today is scored on a projection: kWh so far x 24 / hours elapsed.
"""

import hashlib
import random
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock
from app.models import Alert, BadgeEarned, Household, Reading, Score
from app.schemas import BadgeOut, ChallengeOut, DayScore, RankingOut, ScoreOut
from app.services import consumption, fmt
from app.services import tariff as tariff_engine
from app.services.tips import standby_watts

SCORE_FLOOR = 20
HISTORY_DAYS = 7

BADGES: list[tuple[str, str, str]] = [
    ("premiere_mesure", "Première mesure", "Ta box a envoyé sa première mesure."),
    ("journee_sobre", "Journée sobre", "Une journée terminée avec un score d'au moins 80."),
    ("semaine_sobre", "Semaine sobre", "7 jours d'affilée avec un score d'au moins 70."),
    ("zero_veille", "Zéro veille", "Moins de 50 W consommés en permanence sur 24 h."),
    ("sous_le_seuil", "Sous le seuil", "Après 7 jours, ta prévision du mois reste sous la tranche suivante."),
    ("zero_fuite", "Zéro fuite", "7 jours de mesures d'eau sans alerte de fuite."),
]


def day_score(used_kwh: float, budget_kwh: float | None) -> int:
    if budget_kwh is None or used_kwh <= budget_kwh:
        return 100
    return max(SCORE_FLOOR, round(100 * budget_kwh / used_kwh))


def daily_budget(db: Session, device_ids: list[str], tariff: tariff_engine.Tariff | None, day: date) -> float | None:
    day_start, _ = clock.day_bounds(day)
    month_start, month_end = clock.month_bounds(day_start)
    used_before = consumption.sum_readings(db, device_ids, Reading.energy_delta_kwh, month_start, day_start)
    days_left = max(1.0, (month_end - day_start).total_seconds() / 86400)
    threshold = tariff.next_threshold(used_before) if tariff else None
    if threshold is None:
        # Above the last threshold (or no grid): keep this month's own average as the goal.
        elapsed = (day_start - month_start).total_seconds() / 86400
        return round(used_before / elapsed, 3) if elapsed >= 1 and used_before > 0 else None
    return round(max(0.1, (threshold - used_before) / days_left), 3)


def compute_scores(db: Session, household: Household, now: datetime) -> list[Score]:
    """Score the last 7 days (today included) and upsert them in the scores table."""
    device_ids = consumption.household_device_ids(db, household)
    first = db.scalar(select(func.min(Reading.ts)).where(Reading.device_id.in_(device_ids or [""])))
    if first is None:
        return []
    tariff = tariff_engine.load_tariff(db, "electricity", clock.local_date(now))
    today = clock.local_date(now)
    scores = []
    for offset in range(HISTORY_DAYS - 1, -1, -1):
        day = today - timedelta(days=offset)
        start, end = clock.day_bounds(day)
        if end <= first:
            continue  # before the first reading: nothing to score
        used = consumption.sum_readings(db, device_ids, Reading.energy_delta_kwh, start, min(end, now))
        projected = used
        if day == today:
            hours = max(1.0, clock.hours_between(start, now))
            projected = used * 24 / hours
        budget = daily_budget(db, device_ids, tariff, day)

        row = db.scalar(select(Score).where(Score.household_id == household.id, Score.day == day))
        if row is None:
            row = Score(household_id=household.id, day=day)
            db.add(row)
        row.score = day_score(projected, budget)
        row.kwh = round(used, 3)
        row.budget_kwh = budget
        scores.append(row)
    db.flush()
    return scores


def _earn(db: Session, household: Household, code: str, now: datetime, earned: dict[str, BadgeEarned]) -> None:
    if code not in earned:
        badge = BadgeEarned(household_id=household.id, badge_code=code, earned_at=now)
        db.add(badge)
        earned[code] = badge


def update_badges(db: Session, household: Household, now: datetime, scores: list[Score]) -> dict[str, BadgeEarned]:
    earned = {b.badge_code: b for b in db.scalars(select(BadgeEarned).where(BadgeEarned.household_id == household.id))}
    device_ids = consumption.household_device_ids(db, household)
    today = clock.local_date(now)
    finished = [s for s in scores if s.day < today]

    if scores:
        _earn(db, household, "premiere_mesure", now, earned)
    if any(s.score >= 80 for s in finished):
        _earn(db, household, "journee_sobre", now, earned)
    if len(scores) == HISTORY_DAYS and all(s.score >= 70 for s in scores):
        _earn(db, household, "semaine_sobre", now, earned)

    base_w = standby_watts(db, device_ids, now)
    if base_w is not None and base_w < 50:
        _earn(db, household, "zero_veille", now, earned)

    elec = consumption.resource_status(db, household, "electricity", now)
    if (
        clock.local_date(now).day >= 8
        and elec.next_threshold is not None
        and elec.usage.forecast_qty is not None
        and elec.usage.forecast_qty <= elec.next_threshold
    ):
        _earn(db, household, "sous_le_seuil", now, earned)

    first_water = db.scalar(
        select(func.min(Reading.ts)).where(Reading.device_id.in_(device_ids or [""]), Reading.water_total_l.is_not(None))
    )
    if first_water is not None:
        if first_water.tzinfo is None:
            first_water = first_water.replace(tzinfo=now.tzinfo)
        week_ago = now - timedelta(days=7)
        recent_leak = db.scalar(
            select(Alert.id).where(Alert.household_id == household.id, Alert.type == "leak", Alert.created_at >= week_ago)
        )
        if first_water <= week_ago and recent_leak is None:
            _earn(db, household, "zero_fuite", now, earned)
    db.flush()
    return earned


def mock_ranking(household: Household, scores: list[Score]) -> RankingOut:
    """Pitch mock-up: compares the 7-day average with 50 simulated similar homes.

    The simulated homes are drawn around a fixed reference (the household's
    own daily budget), seeded by the household id so the number is stable.
    Real anonymized ranking needs many households: out of scope for v1.
    """
    finished = [s for s in scores if s.kwh is not None]
    if not finished:
        return RankingOut(is_mock=True, similar_homes=50, better_than_pct=50, label="Classement disponible après une journée de mesures.")
    avg_kwh = sum(float(s.kwh) for s in finished) / len(finished)
    reference = next((float(s.budget_kwh) for s in reversed(finished) if s.budget_kwh), avg_kwh) or 1.0
    seed = int(hashlib.sha256(str(household.id).encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    others = [max(0.5, rng.gauss(reference * 1.1, reference * 0.3)) for _ in range(50)]
    better = round(100 * sum(1 for o in others if o > avg_kwh) / len(others))
    return RankingOut(
        is_mock=True,
        similar_homes=len(others),
        better_than_pct=better,
        label=f"Tu consommes moins que {better} % des foyers similaires (simulation).",
    )


def weekly_challenge(db: Session, household: Household, now: datetime) -> ChallengeOut:
    """'Consomme 5 % de moins que la semaine dernière', same elapsed time compared."""
    device_ids = consumption.household_device_ids(db, household)
    today = clock.local_date(now)
    monday = today - timedelta(days=today.weekday())
    week_start, _ = clock.day_bounds(monday)
    elapsed = now - week_start
    current = consumption.sum_readings(db, device_ids, Reading.energy_delta_kwh, week_start, now)
    last_week = consumption.sum_readings(
        db, device_ids, Reading.energy_delta_kwh, week_start - timedelta(days=7), week_start - timedelta(days=7) + elapsed
    )
    title = "Défi de la semaine : -5 %"
    if last_week <= 0:
        return ChallengeOut(
            title=title,
            description="Consomme 5 % de moins que la semaine dernière. Il faut une semaine de mesures pour commencer.",
            target_kwh=None,
            current_kwh=round(current, 2),
            progress_pct=0,
            status="pas_assez_de_donnees",
        )
    target = round(last_week * 0.95, 2)
    ok = current <= target
    return ChallengeOut(
        title=title,
        description=(
            f"À ce stade de la semaine dernière tu étais à {fmt.kwh(last_week)}. "
            f"Objectif : rester sous {fmt.kwh(target)}."
        ),
        target_kwh=target,
        current_kwh=round(current, 2),
        progress_pct=min(100, round(100 * current / target)) if target > 0 else 0,
        status="reussi" if ok else "en_cours",
    )


def build_score(db: Session, household: Household, now: datetime) -> ScoreOut:
    scores = compute_scores(db, household, now)
    earned = update_badges(db, household, now, scores)
    db.commit()
    history = [
        DayScore(day=s.day, score=s.score, kwh=float(s.kwh or 0), budget_kwh=s.budget_kwh) for s in scores
    ]
    today = clock.local_date(now)
    return ScoreOut(
        today=next((d for d in history if d.day == today), None),
        history=history,
        badges=[
            BadgeOut(
                code=code,
                label=label,
                description=description,
                earned=code in earned,
                earned_at=earned[code].earned_at if code in earned else None,
            )
            for code, label, description in BADGES
        ],
        ranking=mock_ranking(household, [s for s in scores if s.day < today] or scores),
        weekly_challenge=weekly_challenge(db, household, now),
    )
