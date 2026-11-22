# Cartheco: every scenario the system can meet

For the 3D simulation. Each scenario says what happens in the house, what the ESP32 sends
(PZEM-004T for electricity, YF-S201 for water, one reading every 5 s), what the backend does,
what the user sees, and how to reproduce it with `test.html` (http://localhost:5173/test.html).

Numbers come from the code: alert rules in `backend/app/services/alerts.py`, ingest checks in
`ingest.py`, home status in `insights.py`, tips in `tips.py`, STEG/SONEDE grids in `tariff.py`.

**Key values**
- Online window 30 s: no reading for 30 s → data shown as "ancien" and the device as offline.
- Offline alert after 5 min without a reading.
- Electricity alert margin: 10 kWh by default (Settings), and water: 5 % of the threshold.
- Leak: water flowing without a stop for 2 h inside the night window 01:00 to 05:00 (both editable).
- STEG thresholds: homes ≤ 2 kVA 50 / 100 / 200 / 300 / 500 kWh (62, 96, 176, 218, 341, 414 millimes/kWh);
  homes > 2 kVA 200 / 300 / 500 kWh (176, 218, 341, 414 millimes/kWh). VAT 13 % (19 % on the kVA fee).
- SONEDE: progressive bands per quarter (200, 740, 1040, 1490, 1770, 2310 millimes/m³).
- Appliance guess from a sudden power rise ≥ 800 W within 60 s.
- Home status, from worst to best: `unavailable` > `critical` > `warning` > `attention` > `ok`.

---

## A. Normal life (electricity)

| # | In the house (3D) | ESP32 sends | System does | User sees | test.html |
|---|---|---|---|---|---|
| A1 | Night, only fridge, box and chargers on | 80 to 150 W, counter rises slowly | Stores readings, month total grows | Status "ok", live power ≈ 120 W | "Veille 120 W" |
| A2 | Evening: lights, TV, laptop | 500 to 700 W | Same | Live power, forecast for the month | "Soirée 650 W" |
| A3 | Someone turns on the air conditioner | jump of 800 to 1 800 W | Step detected: "Climatiseur ou micro-ondes" (800 to 1 300 W) or "Climatiseur ou fer à repasser" (1 300 to 1 800 W) | Appears in "gros consommateurs" of the day | "Clim 1 350 W" |
| A4 | Electric water heater or kettle | jump of 1 800 to 2 600 W | Step: "Chauffe-eau électrique ou bouilloire" | Same list, with times started today | "Chauffe-eau 2 100 W" |
| A5 | Oven, heater or hob | jump of 2 600 to 4 000 W | Step: "Four, radiateur ou plaque de cuisson" | Same | "Four 3 000 W" |
| A6 | Several big appliances at once | jump ≥ 4 000 W | Step: "Plusieurs gros appareils" | Same | "Tout 6 500 W" |
| A7 | Appliance turned on slowly, or rise < 800 W | small rise | No step, no guess | Only the live power changes | move the power slider by < 800 W |
| A8 | Short spike (motor start, a demo "Simuler un pic") | +3 500 W for 30 s then back | One step stored, energy counted | Live power jumps then falls | "Pic en plus" + "Lancer" |
| A9 | A permanent load ≥ 30 W all day (old fridge, box, TV on standby) | base never below 30 W over 24 h | Tip `standby` with the DT saved by halving it | Tip in Conseils | keep power ≥ 30 W for a day |
| A10 | A heavy appliance starts often over 7 days | repeated steps | Tip `appliance` (saving for 1 h less a day) | Tip in Conseils | several steps over days |

## B. Month, tranche and bill (electricity)

| # | Situation | System does | User sees | test.html |
|---|---|---|---|---|
| B1 | Calm month, forecast below the next threshold | Tip `keep_pace` (jump avoided) | Status "ok", tranche bar, bill to date | default |
| B2 | Forecast says the month will pass the next threshold | Alert `threshold`, variant "forecast": "Au rythme actuel, tu vas dépasser 200 kWh…" + tip `threshold` | Status "attention" | high power for a few hours, or a big target |
| B3 | Month total enters the margin (e.g. 190 kWh with threshold 200 and margin 10) | Alert `threshold`, variant "near": "Encore 10 kWh avant la tranche suivante… coûterait ≈ X DT de plus" | Status "warning", banner on the phone | "Entrer dans la marge d'alerte" |
| B4 | Total passes the threshold | The open threshold alert now counts as crossed | Status "critical" ("Un seuil de tranche est franchi ce mois-ci"), next kWh price goes up | "Dépasser la tranche" |
| B5 | Passes two thresholds at once (big jump) | One alert per threshold and month, never twice | Two alerts, highest tranche shown | target slider far above |
| B6 | Above the last threshold (500 kWh) | No next threshold, no more threshold alerts | Last tranche, 414 millimes/kWh | target 520 kWh |
| B7 | Home ≤ 2 kVA ("économique") stays ≤ 100 kWh | Bands 62 / 96 millimes, no energy transition fund | Cheapest bill | 2 kVA home, target 90 |
| B8 | Home ≤ 2 kVA goes above 100 kWh | Normal bands apply from 101 kWh, fund is charged | Bill jumps more than one band's price | 2 kVA home, target 110 |
| B9 | Home > 2 kVA | First band 0 to 200 kWh at 176 millimes, no 62/96 bands | Thresholds 200 / 300 / 500 | 6 kVA home |
| B10 | User changes the subscribed power (kVA) in Settings | Grid recomputed for that power, kVA fee changes | New thresholds and bill | Settings, web or app |
| B11 | User changes the alert margin | Next "near" alert fires earlier or later | Different alert moment | Settings |
| B12 | This week uses ≥ 25 % more than the previous weeks | Reason "increase" | Status "attention" | high power for days |
| B13 | New month starts (the 1st) | Totals restart from 0, threshold alerts can fire again | Bar empty, history keeps last month | wait for the 1st |
| B14 | Less than 1 h of data this month | No forecast, said clearly | "pas encore" for the forecast | new home |

## C. Water

| # | In the house (3D) | ESP32 sends | System does | User sees | test.html |
|---|---|---|---|---|---|
| C1 | Tap opened then closed | 4 L/min for a minute, then 0 | Litres added to the month | Water today, m³ this month, SONEDE bill | "Robinet 4" |
| C2 | Shower / bath | 8 to 12 L/min for 5 to 15 min | Same | Same | "Douche 8", "Bain 12" |
| C3 | Toilet flush | short flow, a few litres | Same | Same | flow 6 L/min for 10 s |
| C4 | Toilet or tap leaking at night (01:00 to 05:00) | small flow (0.4 L/min) never back to 0 for 2 h | Alert `leak`, critical, once per night: "Fuite probable : l'eau coule sans arrêt depuis 01:12 (2 h), environ 48 L…" + tip `leak` | Status "critical", red banner | Settings: window on the current hour, 2 min; then "Fuite 0,4" |
| C5 | Same small flow but during the day | flow outside the night window | No leak alert (people use water by day) | Nothing special | "Fuite 0,4" by day |
| C6 | Night flow that stops before 2 h (watering, washing machine) | flow returns to 0 | Leak timer restarts, no alert | Nothing | flow then "Fermé" |
| C7 | Water near the next SONEDE threshold (within 5 %) | Alert `threshold` for water | Warning | "Amener l'eau à" near a band |
| C8 | Water passes a SONEDE band | Next m³ more expensive (progressive per quarter) | Higher water bill | water target above a band |
| C9 | Meter calibration changed (pulses per litre) | `calib_pulses_per_l` stored with the device | Litres computed from the new value | "Impulsions par litre" slider |

## D. Sensor faults and bad data

| # | In the house (3D) | ESP32 sends | System does | User sees | test.html |
|---|---|---|---|---|---|
| D1 | PZEM-004T unplugged or broken | `electricity: null` | Alert `sensor_fault` (electricity), once per device and day: "Le capteur électricité (PZEM-004T)… ne répond pas" | "capteur muet", no live power | "Capteur d'électricité muet" |
| D2 | YF-S201 unplugged or stuck | `water: null` | Alert `sensor_fault` (water), once per day | "capteur muet" for water | "Capteur d'eau muet" |
| D3 | Both sensors dead, ESP32 still on Wi-Fi | both null | Two sensor alerts, device still online | Both muted | both boxes |
| D4 | Noisy wiring, values not trusted | `signal_ok: false` | Reading stored but never counted in totals, no step, no leak check | Status "unavailable", "Mesure peu fiable", no values | "Signal peu fiable" |
| D5 | Impossible value (230 V reads 400 V, power > 23 000 W, flow > 60 L/min, PF > 1) | out of range | Rejected 422, nothing stored | Nothing changes, ESP32 log shows the error | send with curl |
| D6 | PZEM energy counter reset to 0 (reset button, new sensor) | counter drops below 1 kWh (water below 5 L) | Treated as a restart: counts from the new value, no loss | Nothing visible | stop, restart, counter near 0 |
| D7 | Counter goes backwards (bug, wrong sensor swapped) | lower counter, above the reset tolerance | Rejected 422 `counter_went_backwards` | Nothing changes | the page handles it by itself |
| D8 | Two senders use the same device ID (two simulators, or simulator + ESP32) | mixed counters and times | Some readings 409/422, totals jump | Wrong totals | do not do it |

## E. Connectivity and security

| # | In the house (3D) | ESP32 sends | System does | User sees | test.html |
|---|---|---|---|---|---|
| E1 | Wi-Fi drops for < 30 s | nothing, then resumes | No effect | Nothing | "Arrêter" for 20 s |
| E2 | Wi-Fi down > 30 s | nothing | Device counted offline | Status "unavailable", data marked "ancien" | "Arrêter" for 40 s |
| E3 | Wi-Fi down > 5 min, or power cut in the house (ESP32 off too) | nothing | Alert `device_offline` once per outage: "Appareil sim-001 hors ligne depuis…" | Warning alert | "Arrêter" for 5 min |
| E4 | ESP32 comes back | readings again | Open offline alerts closed automatically | Back to normal | "Démarrer" |
| E5 | Server or internet down while the ESP32 runs | requests fail | Readings lost, unless the firmware keeps them and sends them later in time order | Gap in history | stop the API |
| E6 | ESP32 clock wrong, timestamp > 5 min in the future | future time | Rejected 422 `timestamp_in_future` | Nothing | curl |
| E7 | Same reading sent twice, or an older one | timestamp not newer than the last | Rejected 409 `stale_timestamp` | Nothing | curl |
| E8 | Wrong or missing device key | any | Rejected 401 | Nothing | wrong key in test.html |
| E9 | Key of another device | another device ID | Rejected 403 `device_mismatch` | Nothing | curl |

## F. Accounts, homes and settings

| # | Situation | System does | User sees |
|---|---|---|---|
| F1 | New account, home created, no reading yet | Dashboard state "empty" | Empty screens, status "unavailable" (no data) |
| F2 | User has several homes | Each home has its own devices, totals and alerts | Home switcher, alerts per home |
| F3 | Home has a simulator and an ESP32 | Only the active device feeds the dashboard | Device chosen in Settings |
| F4 | Leak window or duration changed | Leak rule uses the new values | Leak can be demonstrated at any hour |
| F5 | Alert acknowledged ("Vu") | Leaves the active list, stops counting in the status | Status improves |
| F6 | Notification preferences turn a type off | That type no longer shows as a banner | Still listed in Alertes |
| F7 | Appliance profile declared (AC, water heater, bulbs) | Tips `ac`, `water_heater`, `lighting` with saving estimates | Tips in Conseils |
| F8 | Phone app closed | Nothing is pushed (in-app notifications only) | Alerts seen at next opening |

## G. A full day for the 3D demo (story order)

1. 07:00 breakfast: kettle (A4), tap (C1), the step appears in "gros consommateurs".
2. 13:00 air conditioner (A3) for hours, the forecast passes 200 kWh: "attention" (B2).
3. 19:00 oven + heater + water heater (A6), total enters the margin: phone banner (B3).
4. 21:00 one more hour of AC: threshold crossed, "critical" (B4), next kWh more expensive.
5. 22:00 the PZEM wire comes loose: "capteur muet" (D1); fixed, values back.
6. 01:00 the toilet leaks at 0.4 L/min (C4); 03:00 leak alert, red.
7. 04:00 power cut: device offline after 30 s (E2), alert after 5 min (E3); power back (E4).
8. Next morning: alerts acknowledged (F5), tips show the DT saved by fixing the leak and the standby (A9).
