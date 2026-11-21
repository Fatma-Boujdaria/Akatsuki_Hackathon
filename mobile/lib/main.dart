import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'state/app_state.dart';
import 'theme.dart';
import 'screens/login_screen.dart';
import 'screens/shell.dart';
import 'widgets/logo.dart';
import 'widgets/ui.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final state = AppState(prefs);
  runApp(TrancheGuardApp(state: state));
  state.restore();
}

class TrancheGuardApp extends StatelessWidget {
  const TrancheGuardApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: ListenableBuilder(
        listenable: state,
        builder: (context, _) => MaterialApp(
          title: 'Tranche Guard',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(TG.light),
          darkTheme: buildTheme(TG.dark),
          themeMode: state.themeMode,
          locale: const Locale('fr', 'TN'),
          builder: (context, child) {
            final tg = context.tg;
            // Status and navigation bars follow the canvas, light or dark.
            return AnnotatedRegion<SystemUiOverlayStyle>(
              value: (tg.isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark).copyWith(
                statusBarColor: Colors.transparent,
                systemNavigationBarColor: tg.surface,
              ),
              child: child!,
            );
          },
          home: const _Gate(),
        ),
      ),
    );
  }
}

class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    if (app.checking) {
      return const Scaffold(body: Center(child: LogoMark(size: 56, state: LogoState.loading)));
    }
    if (!app.loggedIn) return const LoginScreen();
    if (app.dashboard == null && app.dashboardErrorStatus == 404) return _NoHousehold(message: app.dashboardError ?? '');
    return const Shell();
  }
}

/// An account without a household (e.g. the admin created by the seed script).
class _NoHousehold extends StatelessWidget {
  const _NoHousehold({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: TgCard(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Logo(size: 32),
                const SizedBox(height: 20),
                Text(message, textAlign: TextAlign.center, style: T.h2(tg.ink)),
                const SizedBox(height: 8),
                Text(
                  app.user?.isAdmin == true
                      ? 'Ce compte administrateur n\'a pas de foyer. Connecte-toi avec le compte d\'un foyer pour voir le tableau de bord.'
                      : 'Ton compte n\'est lié à aucun foyer. Demande à l\'administrateur de t\'en créer un.',
                  textAlign: TextAlign.center,
                  style: T.body(tg.body),
                ),
                const SizedBox(height: 20),
                Btn('Se déconnecter', kind: BtnKind.secondary, icon: LucideIcons300.logOut, onPressed: app.logout),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
