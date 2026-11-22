# Plan: mobile catch-up with the full web app

Spec: [SPEC.md](SPEC.md). Each slice: `flutter analyze` clean, `flutter test` green, then
checked on the USB phone (SM A175F) with `adb reverse tcp:8000 tcp:8000`.

- [x] 1. Foundation: web design tokens + Plus Jakarta Sans, `L(fr, en, ar)` helper, language
      saved in prefs, RTL for Arabic, language switch on the login screen
      | verify: analyze; login screen on phone in FR, EN, AR (RTL), dark and light
      | files: theme.dart, util/i18n.dart, state/app_state.dart, main.dart, login_screen.dart, pubspec.yaml
- [x] 2. API layer for the new endpoints (+ X-Household-Id, error codes) and models
      | verify: flutter test (model parsing tests)
      | files: api/api.dart, api/models.dart, test/
- [x] 3. Auth: login with "remember me" and unverified e-mail, register + code, resend,
      forgot / reset password
      | verify: on phone, register a test account with the on-screen demo code, reset its password
      | files: screens/auth/*
- [x] 4. Homes: list + switcher in the top bar, onboarding when there is no home
      (home details, appliances, box or simulator), Homes screen (add, edit, delete)
      | verify: test account finishes onboarding; demo account switches between two homes
      | files: state/app_state.dart, screens/onboarding_screen.dart, screens/households_screen.dart, screens/shell.dart
- [x] 5. Shell + dashboard as on the web: new nav, top bar (home, bell, avatar), Accueil with
      insights and consumption status
      | verify: demo dashboard figures equal the web's for the same home
      | files: screens/shell.dart, screens/home_screen.dart, widgets/*
- [x] 6. Électricité, Eau, Historique (monthly kWh and bills)
      | verify: screens load on phone, history bars match the web
- [x] 7. Assistant chat
      | verify: "Combien vais-je payer ce mois-ci ?" answers with a DT amount
- [x] 8. Alerts and tips (translated with params), notification history, in-app banner
      (alerts, tips and history done with slice 5)
      | verify: same list as the web; "tout marquer lu" clears the badge
- [x] 9. Appliances editor, Settings, Profile (name, language, password, logout everywhere,
      delete account), Help and support (FAQ, contact form)
      | verify: add / edit / delete an appliance; send a support message; delete the test account
- [ ] 10. Full walkthrough FR / EN / AR, light / dark, API stopped (error states); README update;
      pre-commit review
      | verify: every acceptance criterion in SPEC.md ticked

## Decisions
- 2026-11-22: texts written inline with `L(fr, en, ar)` like the web (not ARB files), so both
  apps can be compared screen by screen and stay in sync.
- 2026-11-22: Plus Jakarta Sans bundled as one variable TTF (google/fonts, OFL) instead of the
  google_fonts package: works offline and on networks that intercept HTTPS.
- 2026-11-22: Arabic uses Android's system Arabic font (Noto) rather than a bundled one.
- 2026-11-22: phone tests over USB with `adb reverse` so no firewall change is needed. While
  the phone is unplugged, screens are checked on a web build of the app (`flutter build web`,
  served on port 8090) at phone size.
- 2026-11-22: visual reference is the "Tranche Guard App Screens" design canvas, which the
  web app already follows; Flutter widgets are ported from the web components.
- 2026-11-22: Plus Jakarta Sans static weights (400-800) cut from the variable font with
  fontTools, because Flutter does not map fontWeight onto a variable font's wght axis.
- 2026-11-22: localizations come from material_ui (it already ships GlobalMaterialLocalizations);
  flutter_localizations would clash with it.
