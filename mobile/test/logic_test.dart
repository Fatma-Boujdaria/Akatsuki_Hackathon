import 'package:flutter_test/flutter_test.dart';
import 'package:tranche_guard/api/models.dart';
import 'package:tranche_guard/util/format.dart';
import 'package:tranche_guard/util/tranche.dart';

ElectricitySummary elec({
  required double used,
  double? next = 200,
  double? left,
  double? forecast,
  List<double> thresholds = const [200, 300, 500],
}) =>
    ElectricitySummary.fromJson({
      'month': '2026-11',
      'month_kwh': used,
      'thresholds_kwh': thresholds,
      'tranche': null,
      'next_threshold_kwh': next,
      'kwh_to_next_threshold': left ?? (next == null ? null : next - used),
      'next_kwh_price_dt': 0.198,
      'crossing_extra_cost_dt': 9.231,
      'bill_to_date': null,
      'forecast': {'available': forecast != null, 'qty': forecast, 'bill': null, 'assumption': ''},
    });

void main() {
  group('French number writing (charter board 04)', () {
    test('space for thousands, decimal comma', () {
      expect(watts(1380), '1 380 W');
      expect(flow(6.2), '6,2 L/min');
      expect(num(1234567), '1 234 567');
    });
    test('unit price: 3 decimals, DT after', () => expect(dtUnit(0.176), '0,176 DT'));
    test('forecast: ≈, rounded', () => expect(dtRound(65.6), '≈ 66 DT'));
    test('estimates: precision follows the size', () {
      expect(dt(9.231), '9,23 DT');
      expect(dt(11.7), '11,7 DT');
      expect(dt(142.4), '142 DT');
    });
    test('kWh: integer from 10, one decimal below', () {
      expect(kwh(18.4), '18 kWh');
      expect(kwh(9.0), '9 kWh');
      expect(kwh(5.25), '5,3 kWh');
    });
    test('24-hour clock in Tunisian time (UTC+1)', () {
      final t = DateTime.utc(2026, 11, 21, 13, 2);
      expect(time(t), '14:02');
      expect(dateTime(t), '21 nov. · 14:02');
      expect(weekdayDayMonth(t), 'sam. 21 nov.');
      expect(dateLabel(t), 'SAM. 21 NOV. · ENCORE 9 JOURS');
    });
    test('local midnight query bounds', () {
      final t = DateTime.utc(2026, 11, 20, 23, 30); // 00:30 on the 21st in Tunis
      expect(todayStartIso(t), '2026-11-21T00:00:00+01:00');
      expect(monthStartIso(t), '2026-11-01T00:00:00+01:00');
    });
  });

  group('Tranche view', () {
    final now = DateTime.utc(2026, 11, 21, 12);

    test('safe: 18 kWh left before 201–300, scale 0–300', () {
      final v = TrancheView.from(elec(used: 182, forecast: 260), now: now);
      expect(v.state, TrancheState.safe);
      expect(v.left, 18);
      expect(v.nextBandLabel, '201–300 kWh');
      expect(v.scaleMax, 300);
      expect(v.marks, [200, 300]);
      expect(v.crossingDate, isNotNull); // forecast 260 crosses 200 this month
    });

    test('near: within the alert margin', () {
      final v = TrancheView.from(elec(used: 195, forecast: 230), margin: 10, now: now);
      expect(v.state, TrancheState.near);
    });

    test('crossed: hatched extra after the 200 mark', () {
      final v = TrancheView.from(elec(used: 212, next: 300), now: now);
      expect(v.state, TrancheState.crossed);
      expect(v.crossedAt, 200);
      expect(v.currentBandLabel, '201–300 kWh');
      expect(v.scaleMax, 300);
    });

    test('top: above the last threshold', () {
      final v = TrancheView.from(elec(used: 540, next: null), now: now);
      expect(v.state, TrancheState.top);
      expect(v.currentBandLabel, 'plus de 500 kWh');
    });

    test('no grid', () {
      final v = TrancheView.from(elec(used: 40, next: null, thresholds: const []), now: now);
      expect(v.state, TrancheState.none);
    });
  });
}
