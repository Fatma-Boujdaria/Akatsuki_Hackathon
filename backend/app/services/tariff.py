"""Tariff engine: turns a monthly quantity (kWh or m3) into a bill in DT.

Blueprint formula (electricity, "all_kwh" mode):

    bill = P_kVA x 0.700 + E_kWh x p_tranche x (1 + VAT) + E_kWh x 0.010

All prices come from the tariff_tranches / tariff_fees tables, never from
this file. Amounts are computed in millimes (1 DT = 1000 millimes) and
returned in DT rounded to the millime.

Fee keys follow a naming rule so new fees need no code change:
  prefix  elec_ / water_          -> which resource it applies to
  suffix  _per_kva                -> x subscribed kVA, once a month
          _per_kwh / _per_m3      -> x quantity consumed
          _per_month              -> flat amount once a month
Two settings live in the same table (value in the value_millimes column):
  elec_power_fee_vat_permille     -> VAT on the kVA fee, per mille (190 = 19 %)
  water_billing_period_months     -> bands are written per billing period (3 for
                                     SONEDE's quarter); they are scaled to a month

STEG low-voltage table of 1 May 2022 (tarifsbt_fr.pdf): the "tranche economique"
bands (1-50 kWh at 62, 51-100 at 96 millimes) only exist for 1 and 2 kVA homes; above
2 kVA the first band is priced like 101-200 kWh. Tariff.for_home(kva) gives the grid of
one home. The energy transition fund (1 mill/kWh) is waived for economique homes
using 100 kWh or less in the month.
"""

import time
from dataclasses import dataclass, replace
from datetime import date
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TariffFee, TariffTranche

PricingMode = Literal["all_kwh", "progressive"]

FEE_PREFIX = {"electricity": "elec_", "water": "water_"}
PER_UNIT_SUFFIX = {"electricity": "_per_kwh", "water": "_per_m3"}
UNIT = {"electricity": "kWh", "water": "m3"}

ECONOMIC_MAX_KVA = 2.0  # tranche economique: 1 and 2 kVA
ECONOMIC_MAX_KWH = 100.0  # its own bands stop at 100 kWh a month
TRANSITION_FUND_KEY = "transition_fund"  # fee waived for small economique months
POWER_FEE_VAT_KEY = "elec_power_fee_vat_permille"
WATER_PERIOD_KEY = "water_billing_period_months"


@dataclass(frozen=True)
class Tranche:
    index: int  # 1 = first band
    min_qty: float
    max_qty: float | None  # None = no upper limit (last band)
    price_millimes: int
    vat_rate: float


@dataclass(frozen=True)
class Tariff:
    resource: str
    valid_from: date
    tranches: tuple[Tranche, ...]  # sorted by min_qty
    fees: dict[str, float]  # key -> millimes, only this resource's fees
    pricing_mode: PricingMode = "all_kwh"
    economic: bool = False  # set by for_home() for a 1-2 kVA home

    def for_home(self, subscribed_kva: float) -> "Tariff":
        """The grid of one home: economique bands only for 1 and 2 kVA."""
        if self.resource != "electricity":
            return self
        if subscribed_kva <= ECONOMIC_MAX_KVA:
            return replace(self, economic=True)
        kept = [t for t in self.tranches if t.max_qty is None or t.max_qty > ECONOMIC_MAX_KWH]
        if not kept or len(kept) == len(self.tranches):
            return self
        kept[0] = replace(kept[0], min_qty=0.0)
        return replace(self, tranches=tuple(replace(t, index=i + 1) for i, t in enumerate(kept)))

    @property
    def thresholds(self) -> list[float]:
        """Tranche limits where the price changes: [200, 300, 500] for STEG."""
        return [t.max_qty for t in self.tranches if t.max_qty is not None]

    def tranche_for(self, qty: float) -> Tranche:
        """Band of a monthly quantity. Exactly 200 kWh is still band 1; 200.01 is band 2."""
        for t in self.tranches:
            if t.max_qty is None or qty <= t.max_qty:
                return t
        return self.tranches[-1]

    def next_threshold(self, qty: float) -> float | None:
        """First threshold not yet crossed, or None above the last one."""
        return next((t for t in self.thresholds if qty <= t), None)

    def _fee_sum(self, suffix: str) -> float:
        return sum(v for k, v in self.fees.items() if k.endswith(suffix))

    @property
    def per_unit_fee_millimes(self) -> float:
        return self._fee_sum(PER_UNIT_SUFFIX[self.resource])

    def per_unit_fee_for(self, qty: float) -> float:
        """Per-unit taxes of a month of `qty`, with the small-economique-month waiver."""
        suffix = PER_UNIT_SUFFIX[self.resource]
        waive = self.economic and qty <= ECONOMIC_MAX_KWH
        return sum(v for k, v in self.fees.items() if k.endswith(suffix) and not (waive and TRANSITION_FUND_KEY in k))

    @property
    def power_fee_vat_rate(self) -> float:
        return self.fees.get(POWER_FEE_VAT_KEY, 0.0) / 1000.0

    @property
    def per_kva_fee_millimes(self) -> float:
        return self._fee_sum("_per_kva")

    @property
    def flat_fee_millimes(self) -> float:
        return self._fee_sum("_per_month")


@dataclass(frozen=True)
class Bill:
    qty: float
    tranche_index: int
    energy_dt: float  # quantity x price, before VAT
    vat_dt: float
    fixed_dt: float  # power fee (kVA) + flat monthly fees
    taxes_dt: float  # per-unit taxes (municipal surtax, energy transition fund)
    total_dt: float


def _dt(millimes: float) -> float:
    return round(millimes / 1000.0, 3)


def compute_bill(tariff: Tariff, qty: float, subscribed_kva: float = 0.0) -> Bill:
    qty = max(0.0, qty)
    reached = tariff.tranche_for(qty)

    if tariff.pricing_mode == "progressive":
        # Each band of kWh is paid at its own price.
        energy = 0.0
        for t in tariff.tranches:
            upper = qty if t.max_qty is None else min(qty, t.max_qty)
            if upper > t.min_qty:
                energy += (upper - t.min_qty) * t.price_millimes
    else:
        # Threshold effect: the band reached prices every unit of the month.
        energy = qty * reached.price_millimes

    power_fee = tariff.per_kva_fee_millimes * subscribed_kva
    # Energy VAT stored per band (13 % residential since 2022), VAT on the kVA fee from the fees.
    vat = energy * reached.vat_rate + power_fee * tariff.power_fee_vat_rate
    fixed = power_fee + tariff.flat_fee_millimes
    taxes = qty * tariff.per_unit_fee_for(qty)
    return Bill(
        qty=round(qty, 3),
        tranche_index=reached.index,
        energy_dt=_dt(energy),
        vat_dt=_dt(vat),
        fixed_dt=_dt(fixed),
        taxes_dt=_dt(taxes),
        total_dt=_dt(energy + vat + fixed + taxes),
    )


def unit_price_dt(tariff: Tariff, qty: float) -> float:
    """Cost of one more unit inside the current band, VAT and per-unit taxes included."""
    t = tariff.tranche_for(qty)
    return _dt(t.price_millimes * (1 + t.vat_rate) + tariff.per_unit_fee_for(qty))


def crossing_extra_cost_dt(tariff: Tariff, threshold: float, subscribed_kva: float) -> float:
    """Jump of the bill when one more unit crosses `threshold` (e.g. 200 -> 201 kWh)."""
    before = compute_bill(tariff, threshold, subscribed_kva).total_dt
    after = compute_bill(tariff, threshold + 1, subscribed_kva).total_dt
    return round(after - before, 3)


def saving_dt(tariff: Tariff, subscribed_kva: float, from_qty: float, to_qty: float) -> float:
    """DT saved by consuming `to_qty` instead of `from_qty` this month (never negative)."""
    if to_qty >= from_qty:
        return 0.0
    saved = compute_bill(tariff, from_qty, subscribed_kva).total_dt - compute_bill(
        tariff, max(0.0, to_qty), subscribed_kva
    ).total_dt
    return round(max(0.0, saved), 3)


# Tariffs change a few times a year; re-reading them on every reading would cost
# 3 queries each time. Cached for 5 minutes, cleared by PUT /api/tariffs.
_CACHE_TTL_S = 300.0
_cache: dict[tuple[str, date, str], tuple[float, "Tariff | None"]] = {}


def clear_tariff_cache() -> None:
    _cache.clear()


def load_tariff(db: Session, resource: str, on: date, pricing_mode: PricingMode = "all_kwh") -> Tariff | None:
    """Grid in force on `on` (rows with the latest valid_from <= on), cached.

    Returns None when no band exists (e.g. SONEDE water grid not entered yet).
    Water uses its own pricing mode (SONEDE: each band at its own price).
    """
    if resource == "water":
        from app.config import get_settings  # local import: settings read at call time

        pricing_mode = get_settings().water_pricing_mode
    key = (resource, on, pricing_mode)
    hit = _cache.get(key)
    if hit is not None and time.monotonic() - hit[0] < _CACHE_TTL_S:
        return hit[1]
    tariff = _read_tariff(db, resource, on, pricing_mode)
    _cache[key] = (time.monotonic(), tariff)
    return tariff


def _read_tariff(db: Session, resource: str, on: date, pricing_mode: PricingMode) -> Tariff | None:
    valid_from = db.scalar(
        select(TariffTranche.valid_from)
        .where(TariffTranche.resource == resource, TariffTranche.valid_from <= on)
        .order_by(TariffTranche.valid_from.desc())
        .limit(1)
    )
    if valid_from is None:
        return None
    rows = db.scalars(
        select(TariffTranche)
        .where(TariffTranche.resource == resource, TariffTranche.valid_from == valid_from)
        .order_by(TariffTranche.min_qty)
    ).all()
    tranches = tuple(
        Tranche(
            index=i + 1,
            min_qty=float(r.min_qty),
            max_qty=None if r.max_qty is None else float(r.max_qty),
            price_millimes=int(r.price_millimes),
            vat_rate=float(r.vat_rate),
        )
        for i, r in enumerate(rows)
    )

    # Latest value of each fee key of this resource.
    fees: dict[str, tuple[date, float]] = {}
    prefix = FEE_PREFIX[resource]
    for fee in db.scalars(select(TariffFee).where(TariffFee.valid_from <= on)):
        if fee.key.startswith(prefix) and (fee.key not in fees or fee.valid_from > fees[fee.key][0]):
            fees[fee.key] = (fee.valid_from, float(fee.value_millimes))

    fee_values = {k: v for k, (_, v) in fees.items()}

    # Bands written per billing period (SONEDE: per quarter) are scaled to one month, so
    # thresholds, alerts and bills stay monthly. With progressive pricing this is exact:
    # the bill of a month is a third of the bill of a quarter used at the same pace.
    period = fee_values.get(WATER_PERIOD_KEY, 1.0) if resource == "water" else 1.0
    if period and period != 1.0:
        tranches = tuple(
            replace(t, min_qty=t.min_qty / period, max_qty=None if t.max_qty is None else t.max_qty / period)
            for t in tranches
        )

    return Tariff(
        resource=resource,
        valid_from=valid_from,
        tranches=tranches,
        fees=fee_values,
        pricing_mode=pricing_mode,
    )
