# Mobile app: catch up with the full web app (442a1c1)

## Goal
The Flutter app in `mobile/` gives a household user everything the web app gives them,
with the web's new "App Screens" look, in French, English and Tunisian Arabic (RTL),
against the same FastAPI backend.

## In scope / Out of scope
In scope (household features):
- Auth: login with "remember me", sign-up with email code (code shown on screen in demo
  mode), resend code, forgot / reset password, change password, log out everywhere,
  delete account.
- First-time setup (onboarding): home details, appliance profile, box or simulator.
- Several homes: list, add, edit, delete, switch from the top bar (`X-Household-Id`).
- Dashboard (Accueil) as on the web: kWh this month, estimated bill, water, tranche bar,
  kWh left before the next tranche with forecast, status, alerts, tip, assistant entry.
- Electricity, Water, History (monthly kWh and bills), Challenges (score, badges).
- AI assistant chat. Alerts and tips. Notification history (all homes, mark read).
- Appliances editor. Settings. Profile. Help and support (FAQ, contact form).
- Language switch FR / EN / AR with right-to-left layout; dark and light themes.
- In-app notifications: history screen plus a banner for new alerts while the app is open.

Out of scope: admin panel, ESP control page, push notifications when the app is closed
(no Firebase), iOS build, backend changes.

## Platform & constraints
Flutter (SDK constraint `^3.13.0` as in the local pubspec), Android, existing packages
(http, shared_preferences, fl_chart, lucide_icons_flutter). New packages only if needed
(for example `flutter_localizations` for RTL and Arabic date formats).
Backend: `backend/` on main, unchanged. Design source of truth: `DESIGN.md` at the repo root,
written from `frontend/src/index.css` (Sicily palette, Plus Jakarta Sans, dark first).

## Interfaces
Endpoints used by the web app (`frontend/src/lib/api.ts`), minus `/api/admin/*` and
`/api/demo/*` except `demo/spike` which Settings already uses. Texts copied from the web
pages so both apps say the same thing (`L(fr, en, ar)` helper, like `frontend/src/lib/i18n.tsx`).

## Acceptance criteria
- [ ] `flutter analyze` reports no errors; `flutter test` passes.
- [ ] A new account can register, enter the code, finish onboarding and reach the dashboard.
- [ ] Forgot password: code, new password, login works with it.
- [ ] Demo account logs in; dashboard numbers match the web dashboard for the same home.
- [ ] Adding a second home and switching to it changes the dashboard; switching back restores it.
- [ ] Assistant answers "Combien vais-je payer ce mois-ci ?" with a DT amount.
- [ ] Notifications screen lists the same items as the web; "mark all read" clears the badge.
- [ ] History shows monthly bars and bills; Appliances can add, edit and delete an item.
- [ ] Switching to Arabic flips the layout right to left on every screen; EN shows English.
- [ ] Light and dark themes both readable (no text on same-colour background).
- [ ] Every screen has a loading state and an error state with retry (API stopped = error shown, no crash).

## Verification plan
- Static: `flutter analyze`, `flutter test` (existing tests updated, plus tests for the
  `L()` helper and model parsing of the new endpoints).
- On the USB phone (SM A175F): `adb reverse tcp:8000 tcp:8000`, server address
  `http://localhost:8000`, walk every criterion above, screenshots of key screens in FR,
  EN and AR, dark and light.
- Compare dashboard figures with the web app open on the same account.

## Assumptions & open questions
- Assumed: Help/FAQ texts copied from the web; no separate mobile content.
- Assumed: the server address field stays on the login screen (as today).
- Assumed: sign-up on the shared Supabase is fine for testing; test accounts are deleted
  at the end with the app's own "delete account".
