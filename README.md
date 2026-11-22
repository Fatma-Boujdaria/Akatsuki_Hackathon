# CarthEco (Tranche Guard)

Home box + web dashboard + Android app that measures a Tunisian household's electricity and
water use in real time, forecasts the end-of-month STEG bill and warns before a tranche change.
Built for the Kizuna hackathon (Esprit).

The ESP32 box (PZEM-004T for electricity, YF-S201 for water) and the Python simulator send the
same JSON to the backend, so the apps work the same in the demo and with the hardware.

## Repository

```
.
├── backend/     FastAPI (Python) + Supabase PostgreSQL: ingest, STEG/SONEDE tariffs,
│                forecast, alerts, tips, AI assistant, admin API, device simulator, tests
├── frontend/    React + Vite + Tailwind web app (dashboard, admin panel, Contrôle ESP)
├── mobile/      Flutter Android app (same features as the web app, FR / EN / AR)
├── sim3d/       3D simulation of the house and the box, plus its video (cartheco-3d.mp4)
├── docs/        Pitch deck (PDF), pitch pages and the scenario catalogue
├── brand/       CarthEco logo (SVG) and brand sheet
├── DESIGN.md    Design tokens shared by the web and the phone app
└── dev.cmd      One command to set up and run everything on Windows (calls dev.ps1)
```

| Part      | Stack                                   | Details                                  |
|-----------|-----------------------------------------|------------------------------------------|
| Backend   | FastAPI, SQLAlchemy, Supabase PostgreSQL | [backend/README.md](backend/README.md)   |
| Web app   | React 19, Vite, Tailwind, Recharts       | [frontend/README.md](frontend/README.md) |
| Phone app | Flutter (Android APK)                    | [mobile/README.md](mobile/README.md)     |
| 3D sim    | Three.js, one offline HTML file          | [sim3d/README.md](sim3d/README.md)       |

## Run it

On Windows, from the repo root:

```
dev.cmd            set up what is missing, then start the API and the web app
dev.cmd sim        start the device simulator (a reading every 5 s)
dev.cmd apk        build the phone app pointed at this PC and install it over USB
dev.cmd status     show what is running and the URLs
dev.cmd stop       stop everything
```

The web app opens on http://localhost:5173 and the API on http://localhost:8000
(interactive docs at http://localhost:8000/docs). Manual setup for each part, on any OS, is in
its own README.

## To look at first

- [docs/CarthEco-pitch.pdf](docs/CarthEco-pitch.pdf): the pitch deck (10 slides).
- [docs/scenario.html](docs/scenario.html): the pitch scenario, from installation to impact.
- [docs/cartheco-scenarios.html](docs/cartheco-scenarios.html) and
  [docs/SCENARIOS.md](docs/SCENARIOS.md): every situation the system handles and what the user sees.
- [sim3d/cartheco-3d.mp4](sim3d/cartheco-3d.mp4): video of the 3D simulation (2 min 35 s),
  from installing the box to a full day in the house.
- [sim3d/dist/cartheco-3d.html](sim3d/dist/cartheco-3d.html): the same simulation, interactive.
- [backend/docs/EXPLAINED.md](backend/docs/EXPLAINED.md): the backend code, file by file.

## Features

- Sign-up with email verification, login with "remember me", password recovery,
  password change, log out everywhere, account deletion.
- First-time setup: home details, appliance profile (quantity, power, hours a day),
  monitoring box or simulator. Several homes per account, switched from the header.
- Dashboard: monthly kWh, estimated bill, water, live STEG / SONEDE flows on the house,
  kWh left before the next tranche with the forecast, consumption status (normal to critical,
  or measurement unavailable).
- Electricity, water, history (monthly kWh and estimated bills), challenges.
- AI assistant: answers about the bill, the tranche, increases, appliances and savings;
  separates measured, forecast and profile figures; DT amounts always come from the tariff
  engine (Claude only rewords, when `LLM_API_KEY` is set).
- Alerts and tips (tranche, leak at night, sensor or box offline), notification history of
  every home, browser / phone notifications while the app is open.
- Help and support (FAQ, tranche explanation, troubleshooting, contact form).
- Admin panel (`/admin`, admin role): users, homes, devices, system health, tariffs with
  audit log, support messages.
- French, English and Tunisian Arabic (right to left). Dark and light themes.

## Tests

```bash
cd backend && python -m pytest -q        # 98 tests
cd frontend && npm run build             # type check + production build
cd mobile && flutter analyze && flutter test
```
