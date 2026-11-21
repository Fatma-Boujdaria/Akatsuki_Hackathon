-- STEG residential low-voltage tariff, as given in the specification (cahier des charges).
-- TO CHECK ON A REAL STEG BILL: the specification lists 176 millimes for "101 to 200 kWh"
-- and gives no price below 101 kWh; target homes are over 2 kVA, so the first band here
-- starts at 0 kWh. Edit the rows (or PUT /api/tariffs) once a real bill is checked.
--
-- Plain INSERT syntax on purpose: scripts/seed_demo.py also runs this file on SQLite.
-- Water (SONEDE) tranches are left empty: grid and billing period are still unknown.

insert into tariff_tranches (resource, min_qty, max_qty, price_millimes, vat_rate, valid_from) values
    ('electricity',   0, 200, 176, 0.07, '2026-01-01'),
    ('electricity', 200, 300, 218, 0.07, '2026-01-01'),
    ('electricity', 300, 500, 341, 0.13, '2026-01-01'),
    ('electricity', 500, null, 414, 0.13, '2026-01-01');

insert into tariff_fees (key, value_millimes, valid_from) values
    ('elec_power_fee_per_kva', 700, '2026-01-01'),
    ('elec_municipal_surtax_per_kwh', 5, '2026-01-01'),
    ('elec_energy_transition_fund_per_kwh', 5, '2026-01-01');
