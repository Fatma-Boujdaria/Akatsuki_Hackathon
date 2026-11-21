"""Tariff module: the three threshold crossings checked against the specification's table."""

from datetime import date

import pytest

from app.services.tariff import (
    Tariff,
    Tranche,
    compute_bill,
    crossing_extra_cost_dt,
    load_tariff,
    saving_dt,
    unit_price_dt,
)

KVA = 6.0
STEG = Tariff(
    resource="electricity",
    valid_from=date(2026, 1, 1),
    tranches=(
        Tranche(1, 0, 200, 176, 0.07),
        Tranche(2, 200, 300, 218, 0.07),
        Tranche(3, 300, 500, 341, 0.13),
        Tranche(4, 500, None, 414, 0.13),
    ),
    fees={
        "elec_power_fee_per_kva": 700,
        "elec_municipal_surtax_per_kwh": 5,
        "elec_energy_transition_fund_per_kwh": 5,
    },
)


def blueprint_formula(kwh: float, price_millimes: int, vat: float, kva: float = KVA) -> float:
    """bill = P_kVA x 0.700 + E x p_tranche x (1 + VAT) + E x 0.010 (in DT)."""
    return round(kva * 0.700 + kwh * price_millimes / 1000 * (1 + vat) + kwh * 0.010, 3)


@pytest.mark.parametrize(
    ("kwh", "price", "vat"),
    [
        (150, 176, 0.07),
        (200, 176, 0.07),  # last kWh of tranche 1
        (201, 218, 0.07),  # first kWh of tranche 2: every kWh now at 218
        (300, 218, 0.07),
        (301, 341, 0.13),  # tranche 3: price and VAT both jump
        (500, 341, 0.13),
        (501, 414, 0.13),
        (750, 414, 0.13),
    ],
)
def test_bill_matches_blueprint_formula(kwh, price, vat):
    assert compute_bill(STEG, kwh, KVA).total_dt == pytest.approx(blueprint_formula(kwh, price, vat), abs=0.001)


def test_three_threshold_crossings():
    assert compute_bill(STEG, 200, KVA).total_dt == pytest.approx(43.864, abs=0.001)
    assert compute_bill(STEG, 201, KVA).total_dt == pytest.approx(53.095, abs=0.001)
    assert crossing_extra_cost_dt(STEG, 200, KVA) == pytest.approx(9.231, abs=0.001)

    assert compute_bill(STEG, 300, KVA).total_dt == pytest.approx(77.178, abs=0.001)
    assert compute_bill(STEG, 301, KVA).total_dt == pytest.approx(123.194, abs=0.001)
    assert crossing_extra_cost_dt(STEG, 300, KVA) == pytest.approx(46.016, abs=0.001)

    assert compute_bill(STEG, 500, KVA).total_dt == pytest.approx(201.865, abs=0.001)
    assert compute_bill(STEG, 501, KVA).total_dt == pytest.approx(243.588, abs=0.001)
    assert crossing_extra_cost_dt(STEG, 500, KVA) == pytest.approx(41.723, abs=0.001)


def test_tranche_boundaries_and_next_threshold():
    assert STEG.thresholds == [200, 300, 500]
    assert STEG.tranche_for(0).index == 1
    assert STEG.tranche_for(200).index == 1
    assert STEG.tranche_for(200.01).index == 2
    assert STEG.tranche_for(9999).index == 4
    assert STEG.next_threshold(182) == 200
    assert STEG.next_threshold(200) == 200  # 0 kWh left: the next kWh crosses
    assert STEG.next_threshold(250) == 300
    assert STEG.next_threshold(600) is None


def test_bill_breakdown_parts_add_up():
    bill = compute_bill(STEG, 182, KVA)
    assert bill.tranche_index == 1
    assert bill.fixed_dt == pytest.approx(4.2)
    assert bill.taxes_dt == pytest.approx(1.82)
    assert bill.energy_dt + bill.vat_dt + bill.fixed_dt + bill.taxes_dt == pytest.approx(bill.total_dt, abs=0.002)


def test_unit_price_and_saving():
    # 176 millimes x 1.07 + 10 millimes of taxes = 0.198 DT for the next kWh
    assert unit_price_dt(STEG, 150) == pytest.approx(0.198, abs=0.0005)
    assert saving_dt(STEG, KVA, 230, 200) == pytest.approx(
        compute_bill(STEG, 230, KVA).total_dt - compute_bill(STEG, 200, KVA).total_dt, abs=0.001
    )
    assert saving_dt(STEG, KVA, 100, 150) == 0.0


def test_progressive_mode_has_no_threshold_effect():
    progressive = Tariff(**{**STEG.__dict__, "pricing_mode": "progressive"})
    energy_201 = (200 * 176 + 1 * 218) / 1000
    assert compute_bill(progressive, 201, KVA).energy_dt == pytest.approx(energy_201, abs=0.001)
    assert crossing_extra_cost_dt(progressive, 200, KVA) < 1.0


def test_load_tariff_reads_the_seeded_rows(db):
    tariff = load_tariff(db, "electricity", date(2026, 11, 21))
    assert [t.price_millimes for t in tariff.tranches] == [176, 218, 341, 414]
    assert tariff.thresholds == [200, 300, 500]
    assert compute_bill(tariff, 201, KVA).total_dt == pytest.approx(53.095, abs=0.001)
    assert load_tariff(db, "water", date(2026, 11, 21)) is None  # SONEDE grid not entered yet
    assert load_tariff(db, "electricity", date(2025, 6, 1)) is None  # before valid_from
