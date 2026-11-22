import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:tranche_guard/api/api.dart';
import 'package:tranche_guard/api/models.dart';
import 'package:tranche_guard/widgets/power_picker.dart';

http.Response json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});

void main() {
  test('household calls carry the token and X-Household-Id', () async {
    late http.Request seen;
    final api = Api(
      baseUrl: 'http://api.test',
      token: 'tok',
      householdId: 'h2',
      client: MockClient((req) async {
        seen = req;
        return json([]);
      }),
    );
    await api.tips();
    expect(seen.headers['Authorization'], 'Bearer tok');
    expect(seen.headers['X-Household-Id'], 'h2');
  });

  test('an unverified e-mail keeps its machine code', () async {
    final api = Api(
      baseUrl: 'http://api.test',
      client: MockClient((_) async => json({
            'detail': {'code': 'email_not_verified', 'message': 'Confirme ton adresse e-mail.'},
          }, 403)),
    );
    await expectLater(
      api.login('a@b.tn', 'x'),
      throwsA(isA<ApiException>()
          .having((e) => e.code, 'code', 'email_not_verified')
          .having((e) => e.message, 'message', 'Confirme ton adresse e-mail.')),
    );
  });

  test('a deleted home is forgotten so the next call uses the first one', () async {
    var gone = false;
    final api = Api(
      baseUrl: 'http://api.test',
      token: 'tok',
      householdId: 'old',
      client: MockClient((_) async => json({'detail': 'Foyer introuvable'}, 404)),
    )..onHouseholdGone = () => gone = true;
    await expectLater(api.dashboard(), throwsA(isA<ApiException>()));
    expect(api.householdId, isNull);
    expect(gone, isTrue);
  });

  test('sign-up returns the demo code to show on screen', () async {
    late Map<String, dynamic> body;
    final api = Api(
      baseUrl: 'http://api.test',
      client: MockClient((req) async {
        body = jsonDecode(req.body) as Map<String, dynamic>;
        return json({'status': 'sent', 'email': 'a@b.tn', 'expires_in_min': 15, 'dev_code': '123456'});
      }),
    );
    final sent = await api.register(fullName: 'Salma', email: 'a@b.tn', password: 'secret123', language: 'ar');
    expect(body['language'], 'ar');
    expect(sent.devCode, '123456');
    expect(sent.expiresInMin, 15);
  });

  test('homes, history, chat and notifications parse', () async {
    final api = Api(
      baseUrl: 'http://api.test',
      token: 'tok',
      client: MockClient((req) async => switch (req.url.path) {
            '/api/households' => json([
                {
                  'id': 'h1', 'name': 'Ma maison', 'address': '12 rue de Marseille, Tunis', 'occupants': 4,
                  'subscribed_kva': 6, 'alert_margin_kwh': 10, 'onboarding_done': true,
                  'created_at': '2026-11-01T10:00:00Z', 'devices': [], 'appliance_count': 5, 'unread_alerts': 1,
                },
              ]),
            '/api/history' => json({
                'months': [
                  {'month': '2026-10', 'kwh': 231.4, 'litres': 5400, 'bill_dt': 58.2, 'water_bill_dt': null, 'tranche_index': 2, 'partial': false},
                ],
                'is_estimate': true,
              }),
            '/api/assistant/chat' => json({
                'intent': 'bill',
                'answer': 'Environ 58 DT ce mois-ci.',
                'facts': [{'label': 'Prévision', 'value': '≈ 58 DT', 'kind': 'forecast'}],
                'suggestions': ['Et le mois prochain ?'],
                'source': 'rule',
              }),
            '/api/notifications' => json([
                {
                  'id': 'n1', 'type': 'threshold', 'resource': 'electricity', 'severity': 'warning',
                  'message': 'Tranche bientôt', 'extra_cost_dt': 4.2, 'is_estimate': true,
                  'created_at': '2026-11-21T19:00:00Z', 'acknowledged_at': null,
                  'params': {'kwh_left': 9}, 'household_id': 'h1', 'household_name': 'Ma maison',
                },
              ]),
            _ => json({'detail': 'not found'}, 404),
          }),
    );
    final homes = await api.households();
    expect(homes.single.city, 'Tunis');
    expect(homes.single.unreadAlerts, 1);

    final history = await api.history(months: 6);
    expect(history.months.single.trancheIndex, 2);
    expect(history.months.single.waterBillDt, isNull);

    final chat = await api.chat('Combien ?', 'fr', [ChatTurn('user', 'Bonjour')]);
    expect(chat.facts.single.kind, 'forecast');
    expect(chat.answer, contains('DT'));

    final notes = await api.notifications();
    expect(notes.single.householdName, 'Ma maison');
    expect(notes.single.params['kwh_left'], 9);
    expect(notes.single.acknowledged, isFalse);
  });

  test('user display name and initial', () {
    final u = User.fromJson({'id': '1', 'email': 'salma@exemple.tn', 'role': 'household', 'full_name': 'salma ben ali'});
    expect(u.display, 'salma ben ali');
    expect(u.initial, 'S');
    final noName = User.fromJson({'id': '2', 'email': 'rim@exemple.tn', 'role': 'household'});
    expect(noName.initial, 'R');
    expect(noName.notifyPrefs.leak, isTrue);
  });

  test('the home form shows the STEG grid of the chosen power (as the backend)', () {
    Json row(num min, num? max, int price, String from) =>
        {'resource': 'electricity', 'min_qty': min, 'max_qty': max, 'price_millimes': price, 'vat_rate': 0.13, 'valid_from': from};
    final t = Tariffs({
      'tranches': [
        row(0, 200, 176, '2026-01-01'), // older grid, ignored
        row(0, 50, 62, '2026-11-01'), row(50, 100, 96, '2026-11-01'), row(100, 200, 176, '2026-11-01'),
        row(200, 300, 218, '2026-11-01'), row(300, 500, 341, '2026-11-01'), row(500, null, 414, '2026-11-01'),
      ],
      'fees': [],
    });
    expect([for (final r in stegBandsFor(t, 2)) r.priceMillimes], [62, 96, 176, 218, 341, 414]);
    final normal = stegBandsFor(t, 6);
    expect([for (final r in normal) r.priceMillimes], [176, 218, 341, 414]);
    expect(normal.first.minQty, 0);
    expect(isEconomic(2), isTrue);
    expect(isEconomic(3), isFalse);
  });
}
