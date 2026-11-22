# Tranche Guard: Frontend

React + Vite + Tailwind + Recharts dashboard for the Tranche Guard backend
(`backend/` in this repo). French UI, built to the **Graphic Charter V1**
(Sicily palette, Space Grotesk / Inter / JetBrains Mono, flat hairlined components).

## Run

Node 20 or newer. Start the backend first (see `backend/README.md`: API on
`http://localhost:8000`, simulator running, demo data seeded).

```bash
cd frontend
npm install
```

```bash
npm run dev
```

Open http://localhost:5173 and log in with the household account created by
`scripts/seed_demo.py` (for example `demo@trancheguard.tn`).

In dev, Vite proxies `/api` to the backend, so no CORS setup is needed. To reach a
backend on another machine (phone on the venue Wi-Fi, ESP32 laptop…):

```bash
VITE_BACKEND_URL=http://192.168.1.20:8000 npm run dev
```

`npm run dev` also listens on the local network, so a phone can open
`http://<laptop-ip>:5173`.

Production build: `npm run build` (type-check + bundle into `dist/`). If the built
files are served from another origin than the API, set `VITE_API_URL` at build time
and add that origin to `CORS_ORIGINS` in `backend/.env`.

## Screens

| Route | Screen | API |
|---|---|---|
| `/connexion` | Login | `POST /api/auth/login`, `GET /api/auth/me` |
| `/` | **Tableau de bord**: kWh left before the next tranche, tranche bar, next kWh price, end-of-month estimate, alert banners, live power and flow, tip, today's curves | `GET /api/dashboard` (every 2.5 s), `GET /api/readings`, `GET /api/tips` |
| `/electricite` | Tranche, bill breakdown, month cumulative chart with forecast and threshold, today's power, PZEM values, heavy consumers, STEG grid | `GET /api/readings?bucket=day`, `GET /api/tariffs` |
| `/eau` | Litres this month, leak status, live flow, today's flow, litres per day, SONEDE notice | `GET /api/readings?resource=water` |
| `/alertes` | Active alerts (mark as seen), history, tips with the DT saved | `GET /api/alerts`, `POST /api/alerts/{id}/ack`, `GET /api/tips` |
| `/defis` | Daily score, 7 days vs budget, weekly challenge, ranking (simulation), badges | `GET /api/score` |
| `/reglages` | Household, kVA, alert margin, leak window, active device, **demo spike**, theme, tariff grid (admin edits), logout | `GET/PUT /api/settings`, `POST /api/demo/spike`, `GET/PUT /api/tariffs` |
| `/esp` | **Contrôle ESP**: a virtual box in the browser. Sliders and presets for power and flow, kWh jumps ("enter the alert margin", "cross the tranche"), sensor-fault and unreliable-signal switches, spikes. Sends the ESP32 JSON every 2/5/10 s and keeps running while you browse the app | `POST /api/readings` with `X-Device-Key` |

### Contrôle ESP (virtual box)

Stop the Python simulator first (Ctrl+C), open **Réglages → Contrôle ESP** (or `/esp`),
paste `DEVICE_API_KEY` from `backend/.env`, press **Démarrer**. Every control changes the
next reading; the dashboard follows within a few seconds. The key stays in this browser
only. Cumulative counters never go down: the page picks up the meter's current value from
the API's answer, so the Python simulator can be restarted afterwards. "Simuler un pic"
in Réglages also works with it.

Screen states from `/api/dashboard` are all handled: `state == "empty"` (waiting for the
first reading), device offline, stale reading ("ancien · 14:02"), unreliable reading
("Mesure peu fiable") and sensor fault ("Capteur en panne"): never a made-up value.

## How the charter maps to the code

| Charter | Where |
|---|---|
| Colour tokens, light and dark (Bahr, Ciel, Sable, Chams, Harissa, Grenade, neutrals) | `src/index.css` (`:root` and `.dark`) |
| Type scale: hero, display, h1–h3, body, small, label, data | `src/index.css` (`t-*` utilities) |
| Writing numbers in French (`1 380 W`, `0,176 DT`, `≈ 66 DT`, `21 nov. · 14:02`) | `src/lib/format.ts` |
| Logo "toit-garde" and the living logo (sous le toit, toit proche, tranche dépassée, chargement) | `src/components/Logo.tsx`, `public/favicon.svg`, `public/app-icon.svg` |
| Buttons 44 px / radius 10, cards radius 14, no shadows | `src/components/ui.tsx` |
| Device pills, live cards (normal, stale, fault), alert banners (info, heads-up, broken) | `src/components/status.tsx` |
| Tranche bar, the signature (safe, near, crossed) | `src/components/TrancheBar.tsx`, `src/lib/tranche.ts` |
| Charts: electricity Chams on Sable, water Ciel ink, one shared time axis, forecast dotted, threshold dashed Harissa | `src/components/charts/` |
| Desktop 240 px sidebar, mobile bottom nav, settings in the top bar | `src/components/Layout.tsx` |

The three principles are enforced in code: every screen opens on the kWh left before
the next tranche; Grenade is only used for leaks, sensor faults and errors (a near
tranche is Harissa); every DT amount carries « estimation ».

## Notes

- The session token is kept in `localStorage` (one demo day without logging in again,
  matching the backend's 12 h token). "Plus tard" on a dashboard banner hides it on that
  device for 2 h; the alert stays active until "Marquer comme vu".
- The admin account created by the seed script has no household, so the backend
  answers 404 to every household endpoint for it, including `GET /api/tariffs`. The app
  shows a clear screen for that case. To edit tariffs from the UI, the admin account
  needs a household, or `GET /api/tariffs` needs to accept any logged-in user.
