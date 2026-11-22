import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tranche_guard/api/models.dart';
import 'package:tranche_guard/state/app_state.dart';

http.Response _json(Object body) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), 200, headers: {'content-type': 'application/json'});

Json _alert(String id, String type) => {
      'id': id, 'type': type, 'resource': type == 'leak' ? 'water' : 'electricity', 'severity': 'warning',
      'message': 'm', 'created_at': '2026-11-21T19:00:00Z', 'acknowledged_at': null,
    };

Json _dashboard(String home, List<Json> alerts) => {
      'generated_at': '2026-11-21T20:00:00Z', 'state': 'ok', 'household_id': home, 'household_name': 'Maison $home',
      'subscribed_kva': 6, 'device': null, 'live': null,
      'electricity': {
        'month': '2026-11', 'month_kwh': 120, 'thresholds_kwh': [200, 300, 500],
        'forecast': {'available': false, 'assumption': ''},
      },
      'water': {'month_l': 0, 'tariff_configured': false, 'forecast': {'available': false, 'assumption': ''}, 'leak_suspected': false},
      'active_alerts': alerts,
      'heavy_consumers': [],
    };

Json _home(String id) => {
      'id': id, 'name': 'Maison $id', 'subscribed_kva': 6, 'alert_margin_kwh': 10, 'onboarding_done': true,
      'devices': [], 'appliance_count': 0, 'unread_alerts': 0,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('a new alert while the app is open is flagged once, and only if wanted', () async {
    SharedPreferences.setMockInitialValues({'server': 'http://api.test'});
    final prefs = await SharedPreferences.getInstance();
    var alerts = [_alert('a1', 'threshold')];
    final seenHomes = <String?>[];
    final app = AppState(prefs, client: MockClient((req) async {
      seenHomes.add(req.headers['X-Household-Id']);
      return switch (req.url.path) {
        '/api/households' => _json([_home('h1'), _home('h2')]),
        '/api/dashboard' => _json(_dashboard(req.headers['X-Household-Id'] ?? '?', alerts)),
        _ => _json({'detail': 'not found'}),
      };
    }));
    final user = User.fromJson({
      'id': 'u', 'email': 'a@b.tn', 'role': 'household',
      'notify_prefs': {'threshold': true, 'leak': false, 'device': true, 'tips': true, 'push': false},
    });
    app.user = user;
    app.api.token = 'tok';
    await app.refreshHouseholds();
    expect(app.currentHousehold?.id, 'h1');

    await app.refreshDashboard();
    expect(app.freshAlertSeq, 0, reason: 'alerts already there at first load are not "new"');

    alerts = [...alerts, _alert('a2', 'leak')];
    await app.refreshDashboard();
    expect(app.freshAlertSeq, 0, reason: 'leak notifications are switched off in the prefs');

    alerts = [...alerts, _alert('a3', 'threshold')];
    await app.refreshDashboard();
    expect(app.freshAlertSeq, 1);
    expect(app.freshAlert?.id, 'a3');

    await app.refreshDashboard();
    expect(app.freshAlertSeq, 1, reason: 'shown once');

    // Switching home: the next home's existing alerts are not "new", and calls carry its id.
    app.switchHousehold('h2'); // starts its own dashboard request
    await pumpEventQueue();
    expect(app.freshAlertSeq, 1);
    expect(app.dashboard?.householdId, 'h2');
    expect(seenHomes.last, 'h2');
    app.logout();
  });
}
