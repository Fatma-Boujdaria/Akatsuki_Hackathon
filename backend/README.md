# Tranche Guard — Backend

FastAPI (Python) + Supabase PostgreSQL. Receives the readings of the ESP32 (or the
simulator), computes the STEG tranche, the end-of-month forecast, alerts and tips,
and serves them to the React dashboard.

> New to the code? Read **[docs/EXPLAINED.md](docs/EXPLAINED.md)**: it walks through
> every file, step by step.

```
backend/
├── app/
│   ├── main.py            # creates the FastAPI app, plugs in the routers
│   ├── config.py          # settings from .env
│   ├── db.py              # database connection (Supabase or SQLite)
│   ├── models.py          # the 10 tables
│   ├── schemas.py         # request/response formats + validation rules
│   ├── security.py        # passwords, login tokens, device keys
│   ├── deps.py            # "who is calling?" checks
│   ├── routers/           # one file per group of endpoints
│   └── services/          # the logic: tariff, ingest, alerts, tips, score, demo...
├── supabase/migrations/   # the same tables in SQL (already applied to Akatsuki_db)
├── simulator/             # sends the same JSON as the ESP32
├── scripts/seed_demo.py   # demo accounts, devices and a month of history
└── tests/                 # 66 automatic tests
```

## 1. Install (once)

Python 3.11 or newer.

```bash
cd backend
python -m venv .venv
```

```bash
source .venv/bin/activate        # Windows: .venv\Scripts\activate
```

```bash
pip install -r requirements-dev.txt
```

## 2. Configure `.env`

```bash
cp .env.example .env
```

Fill in:

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Supabase → project **Akatsuki_db** → **Connect** → *Session pooler* URI. Replace `[YOUR-PASSWORD]` with the database password. Leave empty to use a local SQLite file instead (no internet needed). |
| `JWT_SECRET` | Any long random string: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `DEVICE_API_KEY` | Another random string. Key of the simulator device `sim-001`. |
| `LLM_API_KEY` | Optional. Anthropic API key to reword tips. Empty = template tips (works fine). |
| `DEMO_MODE` | `true` during the hackathon (enables the *Simulate spike* button). |
| `CORS_ORIGINS` | URL of the React dev server, default `http://localhost:5173`. |

`.env` is git-ignored: **never commit it**.

The tables already exist on Supabase (migrations in `supabase/migrations/` were
applied). With SQLite they are created automatically at startup.

## 3. Create the demo data

```bash
python -m scripts.seed_demo --email demo@trancheguard.tn --password <choose-one> --admin-email admin@trancheguard.tn
```

It creates: a household account, an admin account (can edit tariffs), the household
"Maison démo" (6 kVA), the devices `sim-001` (simulator, active) and `tg-001` (ESP32),
and readings every 15 min since the 1st of the month. The ESP32 key is printed **once**:
give it to the hardware teammate. Before a rehearsal, `--reset` wipes and re-creates
the demo history.

## 4. Run

Terminal 1, the API:

```bash
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs: every endpoint, with a "Try it out" button.

Terminal 2, the simulator (the "fake ESP32"):

```bash
python -m simulator.simulator
```

Options: `--scenario leak` (constant water flow), `--speed 60` (counters run 60× faster),
`--url http://<laptop-ip>:8000`.

## 5. The jury demo (≈10 s from button to alert)

1. Log in, open the dashboard: about 100 kWh this month, forecast ~150 kWh, no alert.
2. Settings → Demo control → **Simulate spike** (`POST /api/demo/spike`).
3. On its next reading (≤5 s) the simulator gets the command and adds +3.5 kW for
   30 s. To fit a 30-second demo, it also adds the kWh needed to reach the alert margin.
4. The dashboard (polling every 2–3 s) shows the power jump, the banner
   *"Encore 9 kWh avant la tranche suivante… 9,23 DT de plus (estimation)"* and the tips.

Leak demo: in Settings set the leak window to the current hours and the duration to
2 minutes, then run the simulator with `--scenario leak`.

## 6. API (for the frontend)

Every call except login and `/api/readings` needs `Authorization: Bearer <access_token>`.
Every amount in DT is an estimate (`is_estimate: true`), so show the word *estimation*.

| Method | Endpoint | What for |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` → `{access_token, expires_in, user}`. 5 tries/min. |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard` | Main screen in one call: live values, tranche, kWh to next threshold, price of the next kWh, forecast, active alerts, heavy consumers. Poll every 2–3 s. |
| GET | `/api/readings?resource=electricity&from=&to=&bucket=` | Chart data. Default: last 24 h. `bucket` = `auto`, `raw`, `minute`, `hour`, `day`. Month chart: `from=<1st of month>&bucket=day`. |
| GET | `/api/alerts?status=active` | Alerts (`threshold`, `leak`, `device_offline`, `sensor_fault`) with `severity` info/warning/critical |
| POST | `/api/alerts/{id}/ack` | Mark an alert as seen |
| GET | `/api/tips` | Tips with `saving_dt` (computed by the tariff module) |
| GET | `/api/score` | Today's score, 7-day history, badges, ranking (mock-up), weekly challenge |
| GET / PUT | `/api/settings` | kVA, alert margin, leak window, active device (sim / real) |
| GET / PUT | `/api/tariffs` | Tariff grid. PUT = admin only, replaces all rows |
| POST | `/api/demo/spike` | Jury demo button (202) |
| GET | `/api/health` | Is the API up? |

Screen states from `/api/dashboard`:
- `state == "empty"` → "En attente de la première mesure" + link to Demo control.
- `device.online == false` → "Appareil hors ligne" + `device.last_seen_at`.
- `live.stale == true` → grey "ancien" label on the cards.
- `live.electricity.reliable == false` → "mesure peu fiable" (the values are `null`).
- `live.electricity.fault == true` → sensor fault notice on the card.

## 7. Device contract (for the hardware teammate)

`POST /api/readings` every 5 s, header `X-Device-Key: <key printed by the seed script>`:

```json
{
  "device_id": "tg-001",
  "timestamp": "2026-11-21T16:06:00+01:00",
  "electricity": {"voltage_v": 231.2, "current_a": 6.4, "power_w": 1380, "energy_kwh": 142.37,
                  "frequency_hz": 50.0, "power_factor": 0.93},
  "water": {"flow_l_min": 6.2, "total_l": 18420.5, "pulses_delta": 230, "calib_pulses_per_l": 450},
  "signal_ok": true
}
```

- The timestamp must include the time zone offset (`+01:00`), so sync the clock with NTP.
- If a sensor does not answer, send `"electricity": null` (or `"water": null`): the
  backend raises a *sensor fault* alert instead of inventing a value.
- `energy_kwh` and `total_l` are cumulative and must never go down. A counter that
  restarts near zero is accepted as a reset.
- Answers: `201` stored · `401` bad key · `403` key of another device · `409` timestamp
  not newer than the last one · `422` invalid value (the body says which) · `429` too fast.

## 8. Tests

```bash
pytest
```

Same tests on PostgreSQL, with the real migration files:

```bash
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/tg_test pytest
```

## 9. Assumptions to check (open questions of the PRD)

- **First STEG band**: the specification gives 176 millimes for "101 to 200 kWh" and
  nothing below 101 kWh. The seed starts that band at 0 kWh. Change the row if a real bill says otherwise.
- **Threshold effect**: by default the tranche reached prices *every* kWh of the month
  (blueprint formula). If a real bill shows progressive pricing, set
  `TARIFF_PRICING_MODE=progressive` in `.env`. No code change needed.
- **VAT base**: 7 % up to 300 kWh and 13 % above, on the energy amount only (not the kVA fee).
- **SONEDE water grid**: unknown, so it's left empty. Once you have the grid, add `water` rows
  (in m³) with `PUT /api/tariffs`. The water tranche alert and water DT then turn on by themselves.
- **Ranking**: a mock-up against 50 simulated homes (`is_mock: true`), as planned for the pitch.
- **Latency**: Supabase is in Ireland (eu-west-1). If the venue network is slow,
  empty `DATABASE_URL` to run the demo on a local SQLite file.
