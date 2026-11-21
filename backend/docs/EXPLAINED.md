# The Tranche Guard backend, explained step by step

This guide follows the order the code was built in, and the order you should read it.
Each file gets three answers: **what it does**, **why it is built that way**, and
**the lines to look at**.

- [Step 0 — The big picture](#step-0--the-big-picture)
- [Step 1 — Settings, database, tables](#step-1--settings-database-tables)
- [Step 2 — The engine: tariff, ingest, alerts, dashboard](#step-2--the-engine)
- [Step 3 — Tips, score, settings, tariffs, demo](#step-3--tips-score-settings-tariffs-demo)
- [Step 4 — Simulator and seed script](#step-4--simulator-and-seed-script)
- [Step 5 — Tests](#step-5--tests)
- [Two stories: the life of a reading, and the demo spike](#two-stories)

---

## Step 0 — The big picture

```
 ESP32 or simulator                FastAPI backend                         Supabase PostgreSQL
 ──────────────────     POST      ┌───────────────────────────────┐       ┌──────────────────┐
 JSON every 5 s  ───────────────► │ routers/readings.py           │       │ users            │
 header X-Device-Key              │   └ services/ingest.py        │──────►│ households       │
                                  │       ├ checks + deltas       │       │ devices          │
                                  │       └ services/alerts.py    │       │ readings         │
                                  │                               │       │ alerts, tips     │
 React dashboard        GET       │ routers/dashboard.py ...      │◄──────│ scores, badges   │
 polls every 2-3 s ◄───────────── │   └ services/consumption.py   │       │ tariff_tranches  │
 header Authorization: Bearer     │       └ services/tariff.py    │       │ tariff_fees      │
                                  └───────────────────────────────┘       └──────────────────┘
```

Three rules from the blueprint shape everything:

1. **Tariff prices live in tables, never in code.** `services/tariff.py` reads them.
2. **Numbers in tips come from the tariff module, never from the AI.** The optional LLM
   only rewrites the sentences.
3. **Never show a made-up value.** If `signal_ok` is false or a sensor is missing,
   the API returns `null` plus a flag, and the screen says "mesure peu fiable".

The code is split in layers. Each layer only talks to the one below:

| Layer | Folder | Job |
|---|---|---|
| Routers | `app/routers/` | HTTP: read the request, check who is calling, return JSON |
| Services | `app/services/` | Business logic: tariff, forecast, alerts, tips... |
| Models | `app/models.py` | Python classes that map to database tables |
| Database | `app/db.py` | The connection to Supabase (or SQLite) |

---

## Step 1 — Settings, database, tables

### `app/config.py`: settings

**What.** One `Settings` class lists every setting with its default. pydantic-settings
fills it from environment variables or the `.env` file: `DATABASE_URL` becomes
`settings.database_url`.

**Why.** Secrets (database password, JWT secret, device key) must never be in the code
or on GitHub. `jwt_secret` has no default and needs 32+ characters, so the app refuses
to start without a real one.

**Look at.** `tariff_pricing_mode`. The PRD asks whether the tranche price applies to
*all* kWh of the month. Both answers are coded, and switching is one line in `.env`.

### `app/db.py`: the connection

**What.** Builds the SQLAlchemy *engine* (the connection pool) and gives each HTTP
request its own *session* through `get_db()`.

**Why each piece:**
- `normalize_database_url`: Supabase gives `postgresql://...`. SQLAlchemy needs to know
  the driver, so it becomes `postgresql+psycopg://...`.
- `prepare_threshold: None`: Supabase's connection pooler doesn't support "prepared
  statements". Turning them off makes every pooler mode work.
- `pool_pre_ping`: if Supabase closed an idle connection, reconnect quietly instead of crashing.
- `UTCDateTime`: every timestamp is stored in UTC and comes back *with* a time zone.
  PostgreSQL does this natively. SQLite (used by tests) does not, so this small type
  makes both behave the same.

### `app/clock.py`: time

**What.** `now_utc()`, plus helpers for "start of this month in Tunis time",
"start of this day", etc.

**Why.** Bills are monthly in **local** time (Africa/Tunis), but data is stored in UTC.
All code calls `clock.now_utc()` instead of `datetime.now()`, so tests can **freeze time**
(e.g. "pretend it is 03:30 at night" for the leak test).

### `app/models.py`: the 10 tables

**What.** One Python class per table of the Backend Schema Document: `User`, `Household`,
`Device`, `Reading`, `Alert`, `Tip`, `Score`, `BadgeEarned`, `TariffTranche`, `TariffFee`.

**Why the added columns** (marked "(added)" in the file):

| Column | Why |
|---|---|
| `readings.energy_delta_kwh`, `water_delta_l` | kWh / litres used *since the previous reading*. The month total becomes a simple `SUM()` and stays correct after a meter reset. |
| `readings.step_w`, `appliance_hint` | A power jump ≥ 800 W, labelled "Chauffe-eau électrique ou bouilloire" etc. (heavy consumers). |
| `households.leak_start_hour`, `leak_end_hour`, `leak_min_minutes` | The leak rule is "adjustable" (PRD). |
| `households.active_device_id` | Demo control: "switch between simulator and real device". |
| `alerts.severity` | The banner has info / warning / critical states. |
| `alerts.dedupe_key` | "Fires **once** per threshold": a unique key such as `threshold:electricity:200:2026-11`. |
| `tips.code`, `scores.kwh`, `scores.budget_kwh` | Let the frontend pick icons and explain the score. |

**Look at.** `Device.api_key_hash`. The device key is never stored, only its SHA-256 fingerprint.

### `supabase/migrations/*.sql`: the same tables in SQL

**What.** `..._init_schema.sql` creates the 10 tables, constraints and indexes.
`..._seed_tariffs.sql` inserts the STEG grid (176 / 218 / 341 / 414 millimes, VAT 7 % / 13 %,
700 millimes/kVA, 5 + 5 millimes/kWh of taxes). **Both are applied to Akatsuki_db.**

**Why RLS with no policy.** Supabase exposes every table through a public REST API.
Row Level Security turned on with zero policies means that public API can read nothing.
Only our backend, connecting as the `postgres` owner, can. The blueprint's access-control
table is enforced in Python (`deps.py`).

**Why both SQL and Python.** The SQL is what Supabase runs. The Python classes are what
the code uses. The test suite runs on PostgreSQL *with the SQL files* to prove they match.

---

## Step 2 — The engine

### `app/services/tariff.py`: from kWh to dinars

**What.** The blueprint formula:

```
bill = P_kVA × 0.700 + E_kWh × p_tranche × (1 + VAT) + E_kWh × 0.010
```

Worked example, 6 kVA:

| kWh | Tranche | Calculation (millimes) | Bill |
|---|---|---|---|
| 200 | 1 (176) | 6×700 + 200×176×1.07 + 200×10 = 4 200 + 37 664 + 2 000 | **43.864 DT** |
| 201 | 2 (218) | 4 200 + 201×218×1.07 + 2 010 | **53.095 DT** |

Crossing 200 kWh by **one** kWh costs **9.231 DT**: that's the "threshold effect" the
app warns about. At 300 → 301 it is 46.016 DT (price *and* VAT jump).

**Key functions:**
- `load_tariff()` reads the rows in force on a date (latest `valid_from`), cached for 5 minutes.
- `Tariff.tranche_for(qty)`, `next_threshold(qty)`: 200 kWh is still band 1, 200.01 is band 2.
- `compute_bill()` returns a `Bill` broken into energy, VAT, fixed fee, taxes and total.
- `crossing_extra_cost_dt()`: bill(T+1) − bill(T), the "extra cost in DT" of an alert.
- `saving_dt(from, to)`: what a tip saves, always computed here.

**Why fee keys have a naming rule.** `elec_power_fee_per_kva` is read as: `elec_` = electricity,
`_per_kva` = multiply by the subscribed kVA. A new tax added in the table works with
no code change.

### `app/services/consumption.py`: month total and forecast

**What.** For a household, `household_status()` returns, for electricity and water: kWh
(or L) this month, forecast, tranche, kWh to next threshold, price of the next kWh, bill
so far, forecast bill.

**The forecast** ("at the current rhythm", a moving average):

```
rate     = kWh used in the last 7 days / hours covered
forecast = kWh this month + rate × hours left in the month
```

With less than 1 hour of data the forecast is "not available", and the API says why.

**Why one big query.** Supabase is in Ireland. From Tunisia each query costs ~70 ms. Month
total, 7-day total and first data point, for both resources, come from **one** SQL query
using `SUM(CASE WHEN ...)`. Together with the tariff cache, the dashboard needs ~8 queries
instead of ~25.

### `app/schemas.py`: what goes in and out

**What.** Pydantic classes. `ReadingIn` *is* the blueprint's validation table:
`voltage_v: float = Field(ge=0, le=300)`, `power_w ≤ 23000`, `frequency_hz` 45–65, etc.
`signal_ok: StrictBool` rejects `"true"` (a string): it must be a real boolean.
`timestamp: AwareDatetime` rejects a timestamp without a time zone.

**Why.** FastAPI checks every request against these classes **before** our code runs and
answers 422 with the exact field in error. The response classes (`DashboardOut`...) also
generate the docs at `/docs`, a ready-made contract for the frontend team.

### `app/security.py`, `app/deps.py`, `app/ratelimit.py`: who is calling?

- **Passwords**: bcrypt, slow and salted on purpose. Unknown emails still run a bcrypt check
  (`burn_password_check`), so an attacker can't guess which emails exist by timing.
- **Login token**: a JWT signed with `JWT_SECRET`, valid 12 hours. The frontend sends
  it as `Authorization: Bearer ...`.
- **Device key**: random, sent in `X-Device-Key`. We look the device up by the key's SHA-256.
- **`deps.py`**: FastAPI "dependencies". An endpoint that asks for
  `household = Depends(current_household)` only runs for a logged-in user, and only ever gets
  **that user's** household. This is the access-control table: a member cannot see another
  home's data (tested: someone else's alert answers 404).
- **Rate limits**: 5 logins/min per IP and per email, 60 readings/min per device.

### `app/services/ingest.py`: storing a reading (the most important file)

`ingest_reading()` runs these steps in order:

1. *(already done by `ReadingIn`)* types and ranges → else **422**
2. the key's device must be the payload's `device_id` → else **403**
3. timestamp at most 5 min in the future → else **422**
4. timestamp newer than the device's last reading → else **409** (duplicate)
5. `energy_kwh` / `total_l` never go down, unless they restart near zero (reset) → else **422**
6. compute the deltas against the last **good** reading (`counter_delta`)
7. detect a power step ≥ 800 W → probable appliance (`guess_appliance`)
8. store the row, update `last_seen_at`, close this device's "offline" alerts
9. run the alert rules. If a threshold alert fires, recompute the tips right away

**Why deltas against the last *good* reading.** A reading with `signal_ok: false` may hold
garbage. It is stored (to keep a trace) but gets no delta. The next good reading is compared
with the previous good one, so no kWh is lost and none is invented.

### `app/services/alerts.py`: the four alert rules

| Type | Fires when | Once per |
|---|---|---|
| `threshold` | month kWh ≥ threshold − margin (10 kWh), **or** forecast > threshold | threshold and month |
| `leak` | water flows with no zero reading for ≥ 2 h inside 01:00–05:00 | device and night |
| `sensor_fault` | the payload has `"electricity": null` or `"water": null` | device, sensor, day |
| `device_offline` | no reading for 5 min (checked when the dashboard is read) | offline episode |

**Look at `create_alert_once`.** It checks the `dedupe_key`, then inserts inside a
*savepoint*. If two readings arrive at the same moment, the database's unique constraint
stops the second insert, and only that insert is cancelled.

**The leak rule in detail.** Find the last reading with flow = 0. The flow started just
after it. Count only the part inside the night window. The window can cross midnight (23 h → 5 h).
The message says since when and how many litres: *"l'eau coule sans arrêt depuis 00:15
(3 h 15), environ 97 L utilisés"*.

### `app/services/dashboard.py` and `series.py`: what the screens read

- `build_dashboard()` puts everything in one answer: device online?, live values (null if
  unreliable), electricity summary, water summary, active alerts, today's heavy consumers.
- `get_series()` feeds the charts. At one reading every 5 s a month is ~500 000 rows, too many
  for a chart. So the database groups them by minute / hour / day in Tunis time
  (`date_trunc` on PostgreSQL) and returns averages and sums. Buckets where every reading was
  unreliable come back as `power_w: null, reliable: false`.

### `app/routers/*.py` and `app/main.py`: the HTTP layer

Routers stay thin: check the caller, call a service, return a schema. `main.py`:
- creates the app and plugs in the 8 routers,
- sets CORS so the React dev server (`localhost:5173`) may call the API,
- logs every rejected reading (blueprint: "rejected with 422 and logged"),
- creates the tables automatically only on SQLite.

---

## Step 3 — Tips, score, settings, tariffs, demo

### `app/services/tips.py`: tips with the DT saved

| Code | When | Saving |
|---|---|---|
| `threshold` | forecast above the next threshold | bill(forecast) − bill(threshold) |
| `keep_pace` | forecast below it | the jump you avoid |
| `leak` | an open leak alert | litres/day (DT once the SONEDE grid exists) |
| `appliance` | a heavy consumer starts often | 1 h less per day until month end |
| `standby` | permanent load ≥ 30 W | half of it until month end |
| `offpeak` | always | **0 DT**. The text says it helps the grid, not the bill |

Every `saving_dt` comes from `tariff_engine.saving_dt()`. A batch is saved in `tips` and reused
for 60 s, so the frontend can poll without recomputing every time.

### `app/services/llm.py`: optional friendly wording

Only used when `LLM_API_KEY` is set. It sends the finished sentences to Claude and asks for
friendlier French with "tu", keeping every number. Then `same_numbers()` **checks** that the
new text has exactly the same numbers. If it doesn't, or if anything goes wrong (timeout,
no network), the template sentence is kept. The demo never depends on it.

### `app/services/score.py`: gamification

```
budget of the day = (next threshold − kWh used before that day) / days left in the month
score             = 100 if the day's kWh ≤ budget, else 100 × budget / kWh, never below 20
```

"Never below 20" is the PRD's "goals realistic, never punitive". Badges: *Première mesure,
Journée sobre, Semaine sobre, Zéro veille, Sous le seuil, Zéro fuite*. The ranking is a
**mock-up** (`is_mock: true`) against 50 simulated homes, as the implementation plan says.
The weekly challenge compares this week with the same moment of last week (−5 %).

### `app/routers/settings.py` and `tariffs.py`

- Settings: change kVA, alert margin, leak window, active device. Only the fields sent are changed.
- Tariffs: everyone can read them. Only an **admin** can replace them. The grid is checked
  first: starts at 0, no gaps or overlaps, last band open-ended. The tariff cache is cleared
  so new prices apply at once.

### `app/services/demo.py` and `routers/demo.py`: the jury button

See the second story below.

---

## Step 4 — Simulator and seed script

### `simulator/simulator.py`

Sends **exactly the ESP32 JSON** every 5 s, so nothing else changes between the demo and the
hardware. It models a home: ~110 W standby, morning and evening peaks, a 2 kW water heater in
the morning, a 1.2 kW air conditioner in the afternoon, showers. `--scenario leak` adds a flow
that never stops. Like the ESP32 keeps its water total in flash, the simulator keeps its counters
in `.simulator_state.json`.

### `scripts/seed_demo.py`

Creates the accounts, the household, both devices and a month of history (every 15 min). The
history is sized so the forecast is ~75 % of 200 kWh. The demo therefore starts **below** the
alert, and the spike crosses it. Running it twice changes nothing. Passwords and the ESP32 key
are printed once, at creation.

---

## Step 5 — Tests

66 tests in `tests/`, run on SQLite **and** on PostgreSQL with the real migration files.

| File | Checks |
|---|---|
| `test_tariff.py` | the formula for 8 quantities, the **three crossings 200→201, 300→301, 500→501** (blueprint testing strategy), progressive mode |
| `test_auth.py` | login, wrong password, rate limit, forged and expired tokens |
| `test_ingest.py` | every validation rule, 401/403/409/422/429, deltas, reset, unreliable readings, sensor fault, appliance step |
| `test_alerts_dashboard.py` | threshold alert once, forecast alert, night leak, no leak by day, offline, 404 on another home's alert, dashboard states, chart buckets |
| `test_tips_score_settings.py` | tip DT = tariff module, LLM number check, score floor, badges, settings, admin-only tariffs |
| `test_demo_e2e.py` | **simulator → API → spike → alert + tip** (the integration test of the plan), simulated leak, seed script |

`conftest.py` gives each test an empty database with the STEG rows, a frozen clock
(21 Nov 2026, 16:00 Tunis) and a demo household.

---

## Two stories

### The life of one reading

1. The ESP32 sends `POST /api/readings` with its JSON and `X-Device-Key`.
2. `deps.current_device` hashes the key, checks the rate limit, finds device `tg-001`.
3. FastAPI validates the JSON against `ReadingIn` (ranges, types, time zone).
4. `ingest_reading`: right device? not in the future? newer than the last one? counters not
   going down? → delta 0.004 kWh since 5 s ago → no big step → row stored, `last_seen_at` updated.
5. `alerts.evaluate_reading`: month = 191.0 kWh, next threshold 200, margin 10 → **threshold
   alert** "Encore 9 kWh… 9,23 DT de plus (estimation)", unless it already exists this month.
6. A threshold alert was created → `tips.refresh_tips` computes fresh tips.
7. Answer `201` with `alerts_created: 1`. Within 3 s the dashboard poll shows the banner.

### The demo spike (≈10 s on stage)

```
Presenter          Backend                              Simulator
   │  POST /api/demo/spike │                                 │
   │──────────────────────►│ queue {spike, +3500 W, 30 s,    │
   │◄──── 202 ─────────────│        +87 kWh}                 │
   │                       │◄──── POST reading (≤5 s later) ─│
   │                       │───── 201 + commands:[spike] ───►│ starts the spike,
   │                       │◄──── POST reading (at once) ────│ +3.5 kW, +87 kWh
   │                       │ month 191 kWh → threshold alert │
   │  GET /api/dashboard   │ + fresh tips                    │
   │◄──── banner + tip ────│                                 │
```

Why the command travels in the simulator's response: the simulator stays the **only** writer
of its counters, so they never go backwards. Why +87 kWh at once: a 30-second demo can't wait
for real kWh to add up. The backend computes just enough to enter the alert margin
(`demo.energy_to_reach_margin`). It's clearly a demo shortcut, and `DEMO_MODE=false` turns it off.
