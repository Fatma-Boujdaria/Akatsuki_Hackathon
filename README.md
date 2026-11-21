# Tranche Guard

Home box + web dashboard that measures a Tunisian household's electricity and
water use in real time, forecasts the end-of-month STEG bill and warns before a
tranche change. Built for the Kizuna hackathon (Esprit).

| Part      | Folder      | Branch     | Stack                                   |
|-----------|-------------|------------|-----------------------------------------|
| Backend   | `backend/`  | `backend`  | FastAPI (Python) + Supabase PostgreSQL  |
| Frontend  | `frontend/` | `frontend` | React + Vite + Tailwind + Recharts      |
| Hardware  | `firmware/` | —          | ESP32 + PZEM-004T + YF-S201             |

The real ESP32 and the Python simulator send the same JSON to the backend, so
the dashboard works the same in the demo and with the hardware.
