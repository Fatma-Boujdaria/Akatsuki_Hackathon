import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tranche_guard/api/models.dart';
import 'package:tranche_guard/main.dart';
import 'package:tranche_guard/state/app_state.dart';
import 'package:tranche_guard/theme.dart';
import 'package:tranche_guard/util/i18n.dart';
import 'package:tranche_guard/util/tranche.dart';
import 'package:tranche_guard/widgets/hero_card.dart';
import 'package:tranche_guard/widgets/status.dart';
import 'package:tranche_guard/widgets/ui.dart';

/// A /api/dashboard answer like the backend's, in the "near" state of the demo.
Json dashboardJson({bool fault = false}) => {
      'generated_at': '2026-11-21T19:59:00Z',
      'state': 'ok',
      'household_name': 'Maison démo',
      'subscribed_kva': 6.0,
      'device': {'id': 'sim-001', 'kind': 'simulator', 'last_seen_at': '2026-11-21T19:58:58Z', 'online': true, 'calib_pulses_per_l': 450},
      'live': {
        'ts': '2026-11-21T19:58:58Z',
        'age_s': 2.0,
        'stale': false,
        'electricity': fault
            ? {'reliable': false, 'fault': true}
            : {'reliable': true, 'fault': false, 'power_w': 1380.0, 'voltage_v': 231.2, 'current_a': 6.4, 'power_factor': 0.93, 'frequency_hz': 50.0},
        'water': {'reliable': true, 'fault': false, 'flow_l_min': 6.2, 'total_l': 18420.5},
      },
      'electricity': {
        'month': '2026-11',
        'month_kwh': 191.0,
        'thresholds_kwh': [200.0, 300.0, 500.0],
        'tranche': {'index': 1, 'min_qty': 0.0, 'max_qty': 200.0, 'price_millimes': 176, 'vat_rate': 0.07},
        'next_threshold_kwh': 200.0,
        'kwh_to_next_threshold': 9.0,
        'next_kwh_price_dt': 0.198,
        'crossing_extra_cost_dt': 9.231,
        'bill_to_date': null,
        'forecast': {
          'available': true,
          'qty': 350.0,
          'bill': {'qty': 350, 'tranche_index': 3, 'energy_dt': 119.35, 'vat_dt': 15.5, 'fixed_dt': 4.2, 'taxes_dt': 3.5, 'total_dt': 142.4, 'is_estimate': true},
          'assumption': 'Estimation de fin de mois au rythme moyen des 7 derniers jours.',
        },
      },
      'water': {
        'month': '2026-11',
        'month_l': 6289.0,
        'tariff_configured': false,
        'tranche': null,
        'next_threshold_m3': null,
        'bill_to_date': null,
        'forecast': {'available': true, 'qty': 8963.0, 'bill': null, 'assumption': ''},
        'leak_suspected': false,
      },
      'active_alerts': [
        {
          'id': 'a1',
          'type': 'threshold',
          'resource': 'electricity',
          'severity': 'warning',
          'message': 'Encore 9,0 kWh avant la tranche suivante (200 kWh).',
          'extra_cost_dt': 9.231,
          'is_estimate': true,
          'created_at': '2026-11-21T19:54:00Z',
          'acknowledged_at': null,
        },
      ],
      'heavy_consumers': [],
    };

Widget wrap(Widget child, {TG tg = TG.light}) => MaterialApp(
      theme: buildTheme(tg),
      home: Scaffold(body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: child)),
    );

void main() {
  testWidgets('login screen asks for email and password, shows the server', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(TrancheGuardApp(state: AppState(prefs)));
    await tester.pump();
    expect(find.text('Ta facture, sans surprise'), findsOneWidget);
    expect(find.text('E-mail'), findsOneWidget);
    expect(find.text('Mot de passe'), findsOneWidget);
    expect(find.text('Se connecter'), findsOneWidget);
    expect(find.text(kDefaultApiUrl), findsOneWidget);
  });

  testWidgets('language switch: English texts, Arabic right to left', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final state = AppState(prefs);
    await tester.pumpWidget(TrancheGuardApp(state: state));
    await tester.pump();
    await tester.tap(find.text('EN'));
    await tester.pumpAndSettle();
    expect(find.text('Log in'), findsOneWidget);
    expect(prefs.getString('lang'), 'en');
    await tester.tap(find.text('تونسي'));
    await tester.pumpAndSettle();
    expect(find.text('ادخل'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('ادخل'))), TextDirection.rtl);
    state.setLanguage(Lang.fr); // global language back to French for the next tests
  });

  testWidgets('hero card: one number leads, every DT carries « estimation »', (tester) async {
    final d = Dashboard.fromJson(dashboardJson());
    final v = TrancheView.from(d.electricity, now: d.generatedAt);
    await tester.pumpWidget(wrap(HeroCard(data: d, view: v)));
    expect(v.state, TrancheState.near);
    expect(find.text('9 kWh'), findsOneWidget);
    expect(find.text('avant la tranche 201–300 kWh'), findsOneWidget);
    expect(find.text('0,198 DT'), findsOneWidget);
    expect(find.text('≈ 142 DT'), findsOneWidget);
    expect(find.text('estimation'), findsOneWidget);
  });

  testWidgets('a dead sensor shows "Capteur en panne", never a value', (tester) async {
    final d = Dashboard.fromJson(dashboardJson(fault: true));
    await tester.pumpWidget(wrap(LiveCard(
      tone: Tone.elec,
      icon: Icons.bolt,
      label: 'Puissance',
      value: d.live!.electricity.powerW?.toString(),
      status: liveStatus(d.live, water: false),
      live: d.live,
    )));
    expect(find.text('Capteur en panne'), findsOneWidget);
    expect(find.text('jamais de valeur inventée'), findsOneWidget);
  });

  testWidgets('threshold alert is a Harissa heads-up, not red', (tester) async {
    final d = Dashboard.fromJson(dashboardJson());
    final v = TrancheView.from(d.electricity, now: d.generatedAt);
    final look = alertLook(d.activeAlerts.first, v);
    expect(look.tone, BannerTone.headsup);
    expect(look.title, 'Tranche suivante bientôt');
    await tester.pumpWidget(wrap(TgBanner(tone: look.tone, title: look.title, child: Text(d.activeAlerts.first.message)), tg: TG.dark));
    final title = tester.widget<Text>(find.text('Tranche suivante bientôt'));
    expect(title.style?.color, TG.dark.harissa);
  });
}
