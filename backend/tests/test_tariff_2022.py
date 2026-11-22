"""STEG table of 1 May 2022 (tarifsbt_fr.pdf) and the SONEDE grid, as stored by the
20261122130000_steg_2022_sonede migration."""

from datetime import date

import pytest
from sqlalchemy import text

from app.services.tariff import Tariff, Tranche, clear_tariff_cache, compute_bill, load_tariff

STEG_2022 = Tariff(
    resource="electricity",
    valid_from=date(2026, 11, 1),
    tranches=(
        Tranche(1, 0, 50, 62, 0.13),
        Tranche(2, 50, 100, 96, 0.13),
        Tranche(3, 100, 200, 176, 0.13),
        Tranche(4, 200, 300, 218, 0.13),
        Tranche(5, 300, 500, 341, 0.13),
        Tranche(6, 500, None, 414, 0.13),
    ),
    fees={
        "elec_power_fee_per_kva": 700,
        "elec_power_fee_vat_permille": 190,
        "elec_municipal_surtax_per_kwh": 5,
        "elec_energy_transition_fund_per_kwh": 1,
    },
)


def test_economique_home_has_the_62_and_96_bands():
    t = STEG_2022.for_home(2)
    assert t.thresholds == [50, 100, 200, 300, 500]
    # 40 kWh at 62 mill, VAT 13 %, power fee 2 x 700 + 19 % VAT, 5 mill/kWh, fund waived (<= 100 kWh)
    bill = compute_bill(t, 40, 2)
    assert bill.tranche_index == 1
    assert bill.energy_dt == pytest.approx(2.480)
    assert bill.vat_dt == pytest.approx(round(2.480 * 0.13 + 1.4 * 0.19, 3))
    assert bill.fixed_dt == pytest.approx(1.4)
    assert bill.taxes_dt == pytest.approx(0.2)
    # 80 kWh: the whole month at 96 mill
    assert compute_bill(t, 80, 2).energy_dt == pytest.approx(7.68)


def test_economique_home_above_100_kwh_pays_the_fund():
    t = STEG_2022.for_home(1)
    assert compute_bill(t, 100, 1).taxes_dt == pytest.approx(0.5)  # 5 mill only
    assert compute_bill(t, 150, 1).taxes_dt == pytest.approx(0.9)  # 5 + 1 mill
    assert compute_bill(t, 150, 1).energy_dt == pytest.approx(150 * 0.176)


def test_home_above_2_kva_starts_at_176():
    t = STEG_2022.for_home(6)
    assert t.thresholds == [200, 300, 500]
    assert t.tranches[0].min_qty == 0 and t.tranches[0].price_millimes == 176
    assert [b.index for b in t.tranches] == [1, 2, 3, 4]
    bill = compute_bill(t, 40, 6)
    assert bill.energy_dt == pytest.approx(40 * 0.176)
    assert bill.taxes_dt == pytest.approx(40 * 0.006)  # no waiver above 2 kVA
    assert compute_bill(t, 350, 6).energy_dt == pytest.approx(350 * 0.341)


def test_old_grid_is_unchanged_by_for_home():
    old = Tariff(
        resource="electricity",
        valid_from=date(2026, 1, 1),
        tranches=(Tranche(1, 0, 200, 176, 0.07), Tranche(2, 200, None, 218, 0.07)),
        fees={"elec_power_fee_per_kva": 700},
    )
    assert old.for_home(6).tranches == old.tranches


def test_migration_rows_load_with_water_per_quarter(db):
    """The migration's rows, read back: water bands scaled to a month, progressive pricing."""
    clear_tariff_cache()
    for statement in filter(None, (s.strip() for s in _sql().split(";"))):
        db.execute(text(statement))
    db.flush()
    on = date(2026, 11, 15)

    elec = load_tariff(db, "electricity", on)
    assert elec is not None and [t.price_millimes for t in elec.tranches] == [62, 96, 176, 218, 341, 414]
    assert elec.for_home(6).thresholds == [200, 300, 500]

    water = load_tariff(db, "water", on)
    assert water is not None and water.pricing_mode == "progressive"
    # 0-20 m3 per quarter -> 0-6.667 m3 a month
    assert water.thresholds[0] == pytest.approx(20 / 3)
    # 15 m3 in a month = 45 m3 a quarter: 20 x 200 + 20 x 740 + 5 x 1040 = 24 000 mill a quarter
    assert compute_bill(water, 15).total_dt == pytest.approx(24.0 / 3, abs=0.002)
    clear_tariff_cache()


def _sql() -> str:
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20261122130000_steg_2022_sonede.sql"
    return "\n".join(l for l in path.read_text(encoding="utf-8").splitlines() if not l.strip().startswith("--"))


def test_tariffs_api_reads_and_saves_the_2022_rows(client, db):
    """GET /api/tariffs must serialise the setting keys of the migration (VAT on the kVA fee,
    SONEDE period), and the admin screen must be able to save them back unchanged."""
    from tests.conftest import login, make_user

    for statement in filter(None, (s.strip() for s in _sql().split(";"))):
        db.execute(text(statement))
    db.commit()
    make_user(db, "admin@example.tn", role="admin", with_household=False)
    admin_h = login(client, "admin@example.tn")
    res = client.get("/api/tariffs", headers=admin_h)
    assert res.status_code == 200
    keys = {f["key"] for f in res.json()["fees"]}
    assert {"elec_power_fee_vat_permille", "water_billing_period_months"} <= keys
    assert client.put("/api/tariffs", headers=admin_h, json=res.json()).status_code == 200
    clear_tariff_cache()
