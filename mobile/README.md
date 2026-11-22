# Tranche Guard: Android app (Flutter)

The same household app as `frontend/`, as a native Android app, built to the **"Tranche
Guard App Screens" design** (tokens in `DESIGN.md` at the repo root: Sicily palette, Plus
Jakarta Sans, dark first with a light twin). It talks to the same FastAPI backend, in
French, English and Tunisian Arabic (right to left).

Screens:

- **Accounts**: login with "Se souvenir de moi", sign-up with a 6-digit e-mail code (shown on
  screen in the demo without SMTP), forgot / reset password.
- **First-time setup**: the home, its appliances (estimated kWh a month), the ESP32 box or
  the simulator. **Several homes**, switched from the header; "Mes foyers" to add, edit,
  delete, add a box and edit the appliance profile.
- **Accueil**: kWh, estimated bill and water this month, the house with live STEG / SONEDE
  flows, kWh left before the next tranche with the forecast and consumption status, alerts,
  tip, assistant, weekly challenge.
- **Électricité**, **Eau**, **Défis**, **Profil** (bottom navigation), **Historique**,
  **Assistant IA**, **Alertes et conseils** with the notification history of every home,
  **Paramètres** (home, leak watch, active device, theme, account, notifications, password,
  log out everywhere, delete account), **Aide et support** (FAQ, contact form).
- New alerts show as a banner while the app is open (no push when it is closed).

The admin panel and the "Contrôle démo" page stay on the website.

## Build the APK in Android Studio

You need Flutter 3.47 or newer and Android Studio with the **Flutter** and **Dart**
plugins (Settings → Plugins). Check with `flutter doctor`.

1. Get the code: `git pull` on the `main` branch.
2. Android Studio → **File → Open** → select the `mobile/` folder (not the repo root).
3. Click **Pub get** in the banner (or run `flutter pub get` in the terminal).
4. Pick a device in the toolbar (an emulator from Device Manager, or a phone with USB
   debugging on) and press **Run ▶**.
5. For an installable file: **Build → Flutter → Build APK**, or in the terminal:

```bash
flutter build apk --release
```

The APK is at `build/app/outputs/flutter-apk/app-release.apk`. Copy it to a phone and
open it to install (allow "install unknown apps"). For smaller files, one APK per CPU
type:

```bash
flutter build apk --release --split-per-abi
```

The release build is signed with the debug key, which is fine to share at the
hackathon. The Play Store would need your own signing key
(https://docs.flutter.dev/deployment/android#sign-the-app).

## Connect the app to the backend

The phone has to reach the API over the network, so start the backend on all interfaces,
not only `localhost`:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then, on the login screen, tap the server address under the form and set it to:

| Where the app runs | Serveur |
|---|---|
| Android emulator on the same PC | `http://10.0.2.2:8000` (the default) |
| Real phone on Wi-Fi | `http://<the PC's Wi-Fi IP>:8000`, e.g. `http://192.168.1.20:8000` (same Wi-Fi as the PC) |
| Real phone on USB | `http://localhost:8000`, after `adb reverse tcp:8000 tcp:8000` (no firewall change) |

Find the PC's IP with `ipconfig` (Windows) or `ip addr` / `ifconfig` (Linux, macOS). On
Windows, allow port 8000 in the firewall if the phone can't connect. The address is
remembered after the first login.

To ship an APK that already points at the right address:

```bash
flutter build apk --release --dart-define=API_URL=http://192.168.1.20:8000
```

The app uses plain HTTP to the laptop on the local network, so `usesCleartextTraffic` is
on in `android/app/src/main/AndroidManifest.xml`. Put the API behind HTTPS before any
real deployment and turn it off.

## Where things are

| Part | File |
|---|---|
| Colour tokens (light and dark), type scale, radii (from `DESIGN.md`) | `lib/theme.dart` |
| Texts in three languages: `L('fr', 'en', 'ar')`, language saved and sent to the account | `lib/util/i18n.dart` |
| Numbers and dates per language (`1 380 W`, `0,176 DT`, `≈ 66 DT`), Tunisian time | `lib/util/format.dart` |
| Tranche states (safe, near, crossed), crossing date | `lib/util/tranche.dart` |
| Shield logo and wordmark, living logo | `lib/widgets/logo.dart` |
| Buttons, cards, chips, list rows, progress bars, page header | `lib/widgets/ui.dart` |
| Fields, language switch, login shell | `lib/widgets/fields.dart` |
| House illustration and sparklines | `lib/widgets/house_scene.dart` |
| Alert and tip texts (rebuilt from their params in each language), banners, pills | `lib/widgets/status.dart` |
| Appliance catalogue and editor | `lib/util/appliances.dart`, `lib/widgets/appliance_editor.dart` |
| Charts: month cumulative, power and flow per day, litres per day | `lib/widgets/charts.dart` |
| API client (`X-Household-Id` on every call) and models | `lib/api/` |
| Session, homes, polling (paused in the background), in-app alert banner | `lib/state/app_state.dart` |
| Fonts (SIL OFL, bundled so it works offline) and app icon | `assets/` |

The principles of the web app hold here too: the kWh left before the next tranche is on
the home screen; red only for leaks, sensor faults and errors (a near tranche is a Chams
heads-up); every DT amount is marked as an estimate. A dead or unreliable sensor shows
"Capteur en panne" / "Mesure peu fiable", never a made-up value.

## Checks

```bash
flutter analyze
```

```bash
flutter test
```

`flutter build web` also works for a quick look without a phone: serve `build/web` from an
address listed in `CORS_ORIGINS` of `backend/.env`, or through a proxy that forwards `/api`
to the API.

## Regenerate the app icon

The launcher icons come from `assets/icon/` (navy tile, Bahr house, Chams roof):

```bash
dart run flutter_launcher_icons
```
