# Tranche Guard

Home box + web dashboard that measures a Tunisian household's electricity and
water use in real time, forecasts the end-of-month STEG bill and warns before a
tranche change. Built for the Kizuna hackathon (Esprit).

| Part      | Folder      | Branch     | Stack                                   |
|-----------|-------------|------------|-----------------------------------------|
| Backend   | `backend/`  | `backend`  | FastAPI (Python) + Supabase PostgreSQL  |
| Frontend  | `frontend/` | `frontend` | React + Vite + Tailwind + Recharts      |
| Mobile    | `mobile/`   | `frontend` | Flutter (Android APK)                   |
| Hardware  | `firmware/` | —          | ESP32 + PZEM-004T + YF-S201             |

The real ESP32 and the Python simulator send the same JSON to the backend, so
the dashboard works the same in the demo and with the hardware.

## Web app features

- Sign-up with email verification, login with "remember me", password recovery,
  password change, log out everywhere, account deletion.
- First-time setup: home details, appliance profile (quantity, power, hours a day),
  monitoring box or simulator. Several homes per account, switched from the header.
- Dashboard following the "Tranche Guard App Screens" design: monthly kWh, estimated
  bill, water, live STEG / SONEDE flows on the house, kWh left before the next tranche
  with the forecast, consumption status (normal → critical, or measurement unavailable).
- Electricity, water, history (monthly kWh and estimated bills), challenges.
- AI assistant: answers about the bill, the tranche, increases, appliances and savings;
  separates measured, forecast and profile figures; DT amounts always come from the tariff
  engine (Claude only rewords, when `LLM_API_KEY` is set).
- Alerts and tips, notification history of every home, browser / phone notifications
  while the app is open.
- Help & support (FAQ, tranche explanation, troubleshooting, contact form).
- Admin panel (`/admin`, admin role): users, homes, devices, system health, tariffs with
  audit log, support messages.
- French, English and Tunisian Arabic (right to left). Dark and light themes.
