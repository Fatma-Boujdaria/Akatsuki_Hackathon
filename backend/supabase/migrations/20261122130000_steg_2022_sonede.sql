-- STEG low-voltage residential table of 1 May 2022 (tarifsbt_fr.pdf, "hors taxes") and the
-- SONEDE drinking-water grid. Data only: new rows, valid from 1 November 2026, so earlier
-- months keep the grid they were billed with.
--
-- Electricity, "la tranche atteinte s'applique a tout le mois" (pricing mode all_kwh):
--   1-50 kWh 62, 51-100 kWh 96   tranche economique, 1 and 2 kVA only (see Tariff.for_home)
--   101-200 kWh 176, 201-300 kWh 218, 301-500 kWh 341, over 500 kWh 414 millimes/kWh
--   VAT 13 % on residential energy; power fee 700 millimes/kVA/month with 19 % VAT;
--   5 millimes/kWh for local authorities, 1 millime/kWh for the energy transition fund
--   (waived for economique homes up to 100 kWh a month).
--
-- Water (SONEDE), bands per quarter, each band at its own price (progressive):
--   0-20 m3 200, 21-40 740, 41-70 1040, 71-100 1490, 101-150 1770, over 150 2310 millimes/m3,
--   before taxes (no VAT or fixed SONEDE fee given in the source grid).

insert into tariff_tranches (resource, min_qty, max_qty, price_millimes, vat_rate, valid_from) values
    ('electricity',   0,   50,   62, 0.13, '2026-11-01'),
    ('electricity',  50,  100,   96, 0.13, '2026-11-01'),
    ('electricity', 100,  200,  176, 0.13, '2026-11-01'),
    ('electricity', 200,  300,  218, 0.13, '2026-11-01'),
    ('electricity', 300,  500,  341, 0.13, '2026-11-01'),
    ('electricity', 500, null,  414, 0.13, '2026-11-01'),
    ('water',         0,   20,  200, 0,    '2026-11-01'),
    ('water',        20,   40,  740, 0,    '2026-11-01'),
    ('water',        40,   70, 1040, 0,    '2026-11-01'),
    ('water',        70,  100, 1490, 0,    '2026-11-01'),
    ('water',       100,  150, 1770, 0,    '2026-11-01'),
    ('water',       150, null, 2310, 0,    '2026-11-01');

insert into tariff_fees (key, value_millimes, valid_from) values
    ('elec_power_fee_per_kva', 700, '2026-11-01'),
    ('elec_power_fee_vat_permille', 190, '2026-11-01'),
    ('elec_municipal_surtax_per_kwh', 5, '2026-11-01'),
    ('elec_energy_transition_fund_per_kwh', 1, '2026-11-01'),
    ('water_billing_period_months', 3, '2026-11-01');
