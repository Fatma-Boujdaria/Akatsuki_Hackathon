# Cartheco 3D

The 3D simulation of a Tunisian home with the Cartheco box: where the sensors go, then a full day
of the scenario catalogue played in the house, with the Cartheco app on a phone.

**Open it:** double-click `dist/cartheco-3d.html` (one offline file, no server needed).

**Watch it:** [cartheco-3d.mp4](cartheco-3d.mp4) is a recording of the full tour (2 min 35 s, 1080p).

## What plays

The auto tour loops over two parts (about 2 min 40 s). The **Story** buttons jump to either one.

1. **Installation** (0 to 57 s): STEG meter, current clamp on the phase wire, PZEM-004T and ESP32,
   SONEDE meter, YF-S201 flow sensor. Nothing touched on the STEG or SONEDE side.
2. **A day with Cartheco** (57 s to 159 s): Saturday 28 November, 06:00 to 07:30 the next day,
   1 s on screen = 15 min of the day. The sky goes dark at night.

| Day time | Catalogue | In the house | On the phone |
|---|---|---|---|
| 07:00 | A4, C1 | kettle +2 100 W, tap 4 L/min | step "Chauffe-eau électrique ou bouilloire" |
| 13:00 | A3, B2 | AC +1 350 W all afternoon | about 14:45 the forecast passes 200 kWh: tranche alert, **attention** |
| 19:00 | A6, B3 | oven + heater + water heater, ≈ 6.4 kW (over 6 kVA) | step "Plusieurs gros appareils"; ≈ 19:35 inside the 10 kWh margin: **warning** |
| 21:00 | B4 | one more hour of AC | ≈ 21:25 200 kWh crossed: **critical**, next kWh dearer |
| 22:00 | D1 | PZEM wire loose for 40 min | ESP32 sends `"electricity": null`, alert "Capteur muet" |
| 01:00 | C4 | toilet leaks 0.4 L/min | 03:00 leak alert, "depuis 01:00 (2 h 00), environ 48 L" |
| 04:00 | E2, E3, E4 | power cut for 40 min | **unavailable** after 30 s, offline alert at 04:05, closed when power is back |
| 07:00 | F5, A9 | flapper replaced, alerts "Vu" | **ok**, tips: leak ≈ 20 DT/month, standby |

The rules mirror the backend (`alerts.py`, `insights.py`, `tips.py`, `tariff.py`): one tranche alert
per threshold and month, leak after 2 h of non-stop flow in 01:00 to 05:00, offline after 30 s and
alert after 5 min, status order unavailable > critical > warning > attention > ok, STEG 2022 grid with
VAT 13 % (19 % on the kVA fee). The month starts the day at 175.3 kWh.

## Code

| File | Role |
|---|---|
| `src/day.js` | the day plan, the rule engine, the captions of the day |
| `src/model.js` | appliances, Cartheco tariff, payload (null blocks for a sensor that does not answer) |
| `src/tour.js` | camera moves and captions (installation + day) |
| `src/live.js` | the state stepped in time, the ESP32 posts, night lighting |
| `src/ui.js` | panels, controls, the day clock and the phone running the Cartheco app |
| `src/house.js`, `src/stage.js` | the 3D house and the scene |

## Build after a change

```bash
cd sim3d
npm install
node build.mjs
```

`build.mjs` bundles Three.js r186 and `src/` with esbuild into `dist/cartheco-3d.html`.
`kit/warm.js` replaces the original `teardown-kit` shader warm-up helper.
Check a moment of the day without waiting: open `dist/cartheco-3d.html?render`, then in the
browser console `seek(t)` with `t` in seconds of the tour.
