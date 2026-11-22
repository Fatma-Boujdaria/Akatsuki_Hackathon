import 'dart:async';
import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../util/i18n.dart';
import '../util/tranche.dart';

/// Default backend address. 10.0.2.2 is the computer running the Android emulator;
/// on a real phone, use the computer's Wi-Fi address (e.g. http://192.168.1.20:8000).
/// Can be set at build time: --dart-define=API_URL=http://192.168.1.20:8000
const String kDefaultApiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8000');

/// The dashboard is polled every 2.5 s: a new reading shows within 5 s.
const Duration kDashboardPoll = Duration(milliseconds: 2500);
const Duration kSnooze = Duration(hours: 2); // "Plus tard" hides a banner for 2 h

class AppState extends ChangeNotifier with WidgetsBindingObserver {
  AppState(this._prefs) {
    api = Api(
      baseUrl: _prefs.getString('server') ?? kDefaultApiUrl,
      token: _prefs.getString('token'),
      householdId: _prefs.getString('household'),
      onUnauthorized: _onUnauthorized,
    )..onHouseholdGone = () {
        _prefs.remove('household');
        refreshHouseholds();
      };
    language = Lang.parse(_prefs.getString('lang'));
    setCurrentLang(language);
    themeMode = switch (_prefs.getString('theme')) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    try {
      final raw = jsonDecode(_prefs.getString('snoozed') ?? '{}') as Map<String, dynamic>;
      final now = DateTime.now().millisecondsSinceEpoch;
      _snoozed = {for (final e in raw.entries) if ((e.value as num) > now) e.key: (e.value as num).toInt()};
    } catch (_) {
      _snoozed = {};
    }
    WidgetsBinding.instance.addObserver(this);
  }

  final SharedPreferences _prefs;
  late final Api api;

  User? user;
  bool checking = false;
  ThemeMode themeMode = ThemeMode.system;
  Lang language = Lang.fr;

  Dashboard? dashboard;
  String? dashboardError;
  int? dashboardErrorStatus;
  DateTime? dashboardAt;
  Settings? settings;
  late Map<String, int> _snoozed;

  Timer? _timer;
  bool _inFlight = false;
  bool _foreground = true;

  /// The account's homes; the chosen one is sent as X-Household-Id.
  List<Household> households = [];
  bool householdsLoaded = false;
  String? householdsError;

  /// Changes when the shown home changes: screens keyed by it reload their data.
  int householdEpoch = 0;

  /// First-time setup in progress: the gate keeps it on screen until its last step,
  /// even once the new home exists.
  bool onboarding = false;
  void setOnboarding(bool v) {
    if (v == onboarding) return;
    onboarding = v;
    notifyListeners();
  }

  String get server => api.baseUrl;
  bool get loggedIn => user != null;

  Household? get currentHousehold {
    for (final h in households) {
      if (h.id == api.householdId) return h;
    }
    return households.isEmpty ? null : households.first;
  }

  TrancheView? get tranche => dashboard == null
      ? null
      : TrancheView.from(dashboard!.electricity,
          margin: settings?.alertMarginKwh ?? 10, now: dashboard!.generatedAt);

  Set<String> get snoozed => _snoozed.keys.toSet();

  /// Check the saved session at start-up.
  Future<void> restore() async {
    if (api.token == null) return;
    checking = true;
    notifyListeners();
    try {
      _adoptUser(await api.me());
      await refreshHouseholds();
      _startPolling();
    } catch (_) {
      // Expired token or server unreachable: back to the login screen.
      user = null;
    } finally {
      checking = false;
      notifyListeners();
    }
  }

  /// Backend address typed on the login screen (saved for the next start).
  void setServer(String server) {
    final url = server.trim().replaceFirst(RegExp(r'/+$'), '');
    api.baseUrl = url.contains('://') ? url : 'http://$url';
    _prefs.setString('server', api.baseUrl);
    notifyListeners();
  }

  /// remember = false keeps the session until the app is closed ("Se souvenir de moi" off).
  Future<void> login(String email, String password, {bool remember = true}) async {
    final (token, u) = await api.login(email.trim(), password, remember: remember);
    acceptToken(token, u, remember: remember);
  }

  /// A token from the login, the e-mail check or a password change.
  void acceptToken(String token, User u, {bool remember = true}) {
    api.token = token;
    if (remember) {
      _prefs.setString('token', token);
    } else {
      _prefs.remove('token');
    }
    _adoptUser(u);
    householdsLoaded = false;
    notifyListeners();
    refreshHouseholds().then((_) => _startPolling());
  }

  /// Loads the homes and keeps the saved choice when it still exists (else the first one).
  Future<List<Household>> refreshHouseholds() async {
    try {
      final list = await api.households();
      households = list;
      householdsError = null;
      final saved = api.householdId;
      final valid = list.any((h) => h.id == saved) ? saved : (list.isEmpty ? null : list.first.id);
      if (valid != api.householdId) householdEpoch++;
      api.householdId = valid;
      if (valid == null) {
        _prefs.remove('household');
      } else {
        _prefs.setString('household', valid);
      }
    } on ApiException catch (e) {
      householdsError = e.message;
    } catch (e) {
      householdsError = '$e';
    } finally {
      householdsLoaded = true;
      notifyListeners();
    }
    return households;
  }

  /// Show another home: every screen reloads for it.
  void switchHousehold(String id) {
    if (id == api.householdId) return;
    api.householdId = id;
    _prefs.setString('household', id);
    householdEpoch++;
    dashboard = null;
    settings = null;
    dashboardError = null;
    dashboardErrorStatus = null;
    notifyListeners();
    _startPolling();
  }

  /// The account's language wins over the phone's last choice.
  void _adoptUser(User u) {
    user = u;
    final l = u.language;
    if (l == 'fr' || l == 'en' || l == 'ar') {
      final lang = Lang.parse(l);
      if (lang != language) {
        language = lang;
        setCurrentLang(lang);
        _prefs.setString('lang', lang.name);
      }
    }
  }

  void setUser(User u) {
    user = u;
    notifyListeners();
  }

  void logout() {
    _stopPolling();
    api.token = null;
    user = null;
    dashboard = null;
    settings = null;
    dashboardError = null;
    dashboardErrorStatus = null;
    households = [];
    householdsLoaded = false;
    _prefs.remove('token');
    notifyListeners();
  }

  void _onUnauthorized() {
    _prefs.remove('token');
    _stopPolling();
    user = null;
    dashboard = null;
    notifyListeners();
  }

  void setTheme(ThemeMode mode) {
    themeMode = mode;
    _prefs.setString('theme', switch (mode) { ThemeMode.light => 'light', ThemeMode.dark => 'dark', _ => 'system' });
    notifyListeners();
  }

  /// FR / EN / AR. The whole app rebuilds (MaterialApp is keyed by the language).
  void setLanguage(Lang l) {
    if (l == language) return;
    language = l;
    setCurrentLang(l);
    _prefs.setString('lang', l.name);
    notifyListeners();
    // Also saved in the account; the phone keeps the choice if that fails.
    if (user != null) {
      api.updateMe(language: l.name).then((u) => user = u).catchError((_) => user!);
    }
  }

  void snooze(String alertId) {
    _snoozed[alertId] = DateTime.now().add(kSnooze).millisecondsSinceEpoch;
    _prefs.setString('snoozed', jsonEncode(_snoozed));
    notifyListeners();
  }

  // ---- Polling ---------------------------------------------------------------------

  void _startPolling() {
    _stopPolling();
    if (!_foreground || user == null || api.householdId == null) return;
    refreshDashboard();
    refreshSettings();
    _timer = Timer.periodic(kDashboardPoll, (_) => refreshDashboard());
  }

  void _stopPolling() {
    _timer?.cancel();
    _timer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // No polling while the app is in the background: saves battery and data.
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) {
      _startPolling();
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      _stopPolling();
    }
  }

  Future<void> refreshDashboard() async {
    if (_inFlight || user == null || api.householdId == null) return;
    _inFlight = true;
    final epoch = householdEpoch;
    try {
      final d = await api.dashboard();
      if (epoch != householdEpoch) return; // answer for the home shown before a switch
      dashboard = d;
      dashboardAt = DateTime.now();
      dashboardError = null;
      dashboardErrorStatus = null;
    } on ApiException catch (e) {
      if (epoch != householdEpoch) return;
      dashboardError = e.message;
      dashboardErrorStatus = e.status;
    } catch (e) {
      if (epoch != householdEpoch) return;
      dashboardError = '$e';
      dashboardErrorStatus = null;
    } finally {
      _inFlight = false;
      notifyListeners();
    }
  }

  Future<void> refreshSettings() async {
    final epoch = householdEpoch;
    try {
      final s = await api.settings();
      if (epoch != householdEpoch) return;
      settings = s;
      notifyListeners();
    } catch (_) {
      // The settings screen shows its own error.
    }
  }

  void setSettings(Settings s) {
    settings = s;
    notifyListeners();
    refreshDashboard();
  }

  @override
  void dispose() {
    _stopPolling();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}

/// Makes the AppState reachable from any widget.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);

  /// Rebuilds the caller when the state changes.
  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  /// Reads without listening (for callbacks).
  static AppState read(BuildContext context) => context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}

/// A value fetched now and every [interval], keeping the last good data on error.
class Poll<T> extends ChangeNotifier {
  Poll(this._fetch, {this.interval}) {
    refresh();
    if (interval != null) _timer = Timer.periodic(interval!, (_) => refresh());
  }

  final Future<T> Function() _fetch;
  final Duration? interval;
  Timer? _timer;
  bool _busy = false;
  bool _disposed = false;

  T? data;
  String? error;
  bool get loading => data == null && error == null;

  Future<void> refresh() async {
    if (_busy || _disposed) return;
    _busy = true;
    try {
      data = await _fetch();
      error = null;
    } catch (e) {
      error = e is ApiException ? e.message : '$e';
    } finally {
      _busy = false;
      if (!_disposed) notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}
