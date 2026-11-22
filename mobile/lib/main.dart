import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'state/app_state.dart';
import 'theme.dart';
import 'util/i18n.dart';
import 'screens/login_screen.dart';
import 'screens/onboarding_screen.dart';
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
          // Keyed by language: every L(...) text is rebuilt when it changes.
          key: ValueKey(state.language),
          title: 'Cartheco',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(TG.light),
          darkTheme: buildTheme(TG.dark),
          themeMode: state.themeMode,
          // ar-TN lays the app out right to left (Directionality comes from the locale).
          locale: switch (state.language) {
            Lang.en => const Locale('en', 'GB'),
            Lang.ar => const Locale('ar', 'TN'),
            Lang.fr => const Locale('fr', 'TN'),
          },
          supportedLocales: const [Locale('fr', 'TN'), Locale('en', 'GB'), Locale('ar', 'TN')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
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
    if (!app.householdsLoaded) {
      return const Scaffold(body: Center(child: LogoMark(size: 56, state: LogoState.loading)));
    }
    if (app.households.isEmpty && app.householdsError != null) {
      return _Problem(message: app.householdsError!, onRetry: app.refreshHouseholds);
    }
    // No home yet: first-time setup (an admin without a home uses the web admin panel).
    if (app.onboarding || app.households.isEmpty) {
      if (app.user?.isAdmin == true && !app.onboarding) {
        return _Problem(
          message: L(
            'Ce compte administrateur n\'a pas de foyer. Le panneau d\'administration est sur le site web.',
            'This admin account has no home. The admin panel is on the website.',
            'الحساب الإداري هذا ما عندوش دار. لوحة الإدارة في الموقع.',
          ),
        );
      }
      return const OnboardingScreen();
    }
    return const Shell();
  }
}

/// Homes could not be loaded, or an admin account without a home.
class _Problem extends StatelessWidget {
  const _Problem({required this.message, this.onRetry});
  final String message;
  final Future<void> Function()? onRetry;

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
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Logo(size: 32),
                const SizedBox(height: 20),
                Text(message, textAlign: TextAlign.center, style: T.body(tg.body)),
                const SizedBox(height: 20),
                Wrap(spacing: 10, runSpacing: 10, alignment: WrapAlignment.center, children: [
                  if (onRetry != null)
                    Btn(L('Réessayer', 'Try again', 'عاود'), icon: LucideIcons300.refreshCw, onPressed: onRetry),
                  Btn(L('Se déconnecter', 'Log out', 'اخرج'), kind: BtnKind.secondary, icon: LucideIcons300.logOut, onPressed: app.logout),
                ]),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
