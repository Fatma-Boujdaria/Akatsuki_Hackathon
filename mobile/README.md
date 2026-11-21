# Tranche Guard — Android app (Flutter)

The same dashboard as `frontend/`, as a native Android app, built to the **Graphic
Charter V1** (Sicily palette, Space Grotesk / Inter / JetBrains Mono, flat hairlined
components, light and dark themes). It talks to the same FastAPI backend.

Screens: login · **Accueil** (kWh left before the next tranche, tranche bar, next kWh
price, end-of-month estimate, alert banners, live power and flow, tip, today's curves) ·
**Électricité** · **Eau** · **Alertes** (alerts and tips) · **Défis** (score, badges,
weekly challenge) · **Réglages** (kVA, alert margin, leak window, active device,
*Simuler un pic*, theme, logout).

## Build the APK in Android Studio

You need Flutter 3.50 or newer and Android Studio with the **Flutter** and **Dart**
plugins (Settings → Plugins). Check with `flutter doctor`.

1. Get the code: `git pull` on the `frontend` branch.
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

Then, on the login screen, set **Serveur** to:

| Where the app runs | Serveur |
|---|---|
| Android emulator on the same PC | `http://10.0.2.2:8000` (the default) |
| Real phone | `http://<the PC's Wi-Fi IP>:8000`, e.g. `http://192.168.1.20:8000` — same Wi-Fi as the PC |

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

## How it maps to the charter and the backend

| Part | File |
|---|---|
| Colour tokens (light and dark), type scale, radii | `lib/theme.dart` |
| Writing numbers in French (`1 380 W`, `0,176 DT`, `≈ 66 DT`, `21 nov. · 14:02`), Tunisian time | `lib/util/format.dart` |
| Tranche states (safe, near, crossed), crossing date | `lib/util/tranche.dart` |
| Logo "toit-garde" and the living logo in the top bar | `lib/widgets/logo.dart` |
| Buttons 44 px, cards, labels, segmented control | `lib/widgets/ui.dart` |
| Device pills, live cards (normal, stale, fault), alert banners | `lib/widgets/status.dart` |
| The tranche bar | `lib/widgets/tranche_bar.dart` |
| Charts: month cumulative with forecast and threshold, power and flow on one time axis, litres per day | `lib/widgets/charts.dart` |
| API client and models (mirror `backend/app/schemas.py`) | `lib/api/` |
| Session, server address, 2.5 s dashboard polling (paused in the background), theme | `lib/state/app_state.dart` |
| Fonts (SIL OFL, bundled so it works offline) and app icon | `assets/` |

The three principles hold here too: every screen opens on the kWh left before the next
tranche; Grenade red only for leaks, sensor faults and errors (a near tranche is Harissa
orange); every DT amount carries « estimation ». A dead or unreliable sensor shows
"Capteur en panne" / "Mesure peu fiable", never a made-up value.

## Checks

```bash
flutter analyze
```

```bash
flutter test
```

`flutter run -d chrome` also works for a quick look without a phone (add
`http://localhost:<port>` to `CORS_ORIGINS` in `backend/.env`).

## Regenerate the app icon

The launcher icons come from `assets/icon/` (navy tile, Bahr house, Chams roof):

```bash
dart run flutter_launcher_icons
```
