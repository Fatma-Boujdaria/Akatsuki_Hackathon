"""Appliance profiles: what the household declared, turned into kWh estimates.

A whole-house meter cannot tell which appliance used what. These numbers are
a PROFILE (quantity x power x hours a day x 30 days), labelled as such
everywhere, never shown as a measurement of one appliance. When the user does
not know the power or the hours, a typical value from CATALOG is used and the
app says so.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Appliance, Household

DAYS_PER_MONTH = 30

# category: (typical power in W, typical hours of use per day, lucide icon name)
# Typical values for a Tunisian home; a fridge's hours are its compressor duty cycle.
CATALOG: dict[str, tuple[float, float, str]] = {
    "air_conditioner": (1200, 5, "air-vent"),
    "refrigerator": (150, 10, "refrigerator"),
    "washing_machine": (2000, 0.5, "washing-machine"),
    "television": (100, 5, "tv"),
    "water_heater": (2000, 2, "heater"),
    "oven": (2000, 0.5, "cooking-pot"),
    "microwave": (1000, 0.2, "microwave"),
    "dishwasher": (1800, 0.7, "utensils"),
    "computer": (100, 5, "laptop"),
    "lighting": (10, 5, "lamp"),  # per bulb (LED)
    "electric_heater": (2000, 3, "flame"),
    "fan": (50, 6, "fan"),
    "iron": (1200, 0.2, "shirt"),
    "kettle": (2000, 0.15, "coffee"),
    "router": (10, 24, "router"),
    "water_pump": (750, 1, "waves"),
    "custom": (100, 1, "plug"),
}


@dataclass
class Estimate:
    appliance: Appliance
    power_w: float
    hours_per_day: float
    kwh_month: float


def typical(category: str) -> tuple[float, float]:
    power, hours, _ = CATALOG.get(category, CATALOG["custom"])
    return power, hours


def estimate(appliance: Appliance) -> Estimate:
    power_default, hours_default = typical(appliance.category)
    power = appliance.power_w if appliance.power_w else power_default
    hours = appliance.hours_per_day if appliance.hours_per_day is not None else hours_default
    kwh = appliance.quantity * power * hours / 1000 * DAYS_PER_MONTH
    return Estimate(appliance, power, hours, round(kwh, 2))


def household_appliances(db: Session, household: Household) -> list[Appliance]:
    return list(
        db.scalars(
            select(Appliance).where(Appliance.household_id == household.id).order_by(Appliance.created_at)
        )
    )


def estimates(db: Session, household: Household) -> list[Estimate]:
    return sorted((estimate(a) for a in household_appliances(db, household)), key=lambda e: -e.kwh_month)


def by_category(items: list[Estimate], category: str) -> list[Estimate]:
    return [e for e in items if e.appliance.category == category]


def profile_kwh_month(items: list[Estimate]) -> float | None:
    return round(sum(e.kwh_month for e in items), 1) if items else None
