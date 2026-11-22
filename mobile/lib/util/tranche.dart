import 'dart:math' as math;

import '../api/models.dart';
import 'format.dart';
import 'i18n.dart';

enum TrancheState { safe, near, crossed, top, none }

/// Everything the tranche bar and the hero number need, derived from /api/dashboard.
class TrancheView {
  TrancheView({
    required this.state,
    required this.used,
    this.next,
    this.crossedAt,
    this.left,
    this.nextBandLabel,
    this.currentBandLabel,
    this.forecast,
    required this.scaleMax,
    required this.marks,
    this.crossingDate,
  });

  final TrancheState state;
  final double used;

  /// Next threshold to watch (200, 300, 500), null above the last one.
  final double? next;

  /// Threshold already crossed this month (lower bound of the current band).
  final double? crossedAt;
  final double? left;

  /// "201–300 kWh": the band after the next threshold.
  final String? nextBandLabel;

  /// "1–200 kWh": the current band.
  final String? currentBandLabel;
  final double? forecast;

  /// Right end of the bar.
  final double scaleMax;

  /// Threshold marks drawn on the bar, in Encre.
  final List<double> marks;

  /// Forecast date of crossing the next threshold, when the pace says so.
  final DateTime? crossingDate;

  static String _band(double lo, double? hi) {
    if (hi == null) return '${L('plus de', 'over', 'أكثر من')} ${lo.round()} kWh';
    return '${lo.round() + (lo > 0 ? 1 : 0)}–${hi.round()} kWh';
  }

  /// [margin] is the alert margin from the settings (default 10 kWh): within it,
  /// the tranche is "near" and turns Harissa.
  factory TrancheView.from(ElectricitySummary e, {int margin = 10, required DateTime now}) {
    final used = e.monthKwh;
    final thresholds = [...e.thresholds]..sort();
    final next = e.nextThreshold;
    final forecast = e.forecast.available ? e.forecast.qty : null;
    double? crossedAt;
    for (final t in thresholds.reversed) {
      if (used > t) {
        crossedAt = t;
        break;
      }
    }

    if (thresholds.isEmpty) {
      return TrancheView(
        state: TrancheState.none,
        used: used,
        forecast: forecast,
        scaleMax: math.max(math.max(used, forecast ?? 0), 1) * 1.2,
        marks: const [],
      );
    }

    final nextIdx = next == null ? -1 : thresholds.indexOf(next);
    final after = (nextIdx >= 0 && nextIdx + 1 < thresholds.length) ? thresholds[nextIdx + 1] : null;
    final left = e.kwhToNext ?? (next != null ? math.max(0.0, next - used) : null);

    final TrancheState state;
    if (next == null) {
      state = TrancheState.top;
    } else if (left != null && left <= margin) {
      state = TrancheState.near;
    } else if (crossedAt != null) {
      state = TrancheState.crossed;
    } else {
      state = TrancheState.safe;
    }

    // Like the charter: 0–300 while watching 200; once 200 is crossed, up to the next threshold.
    double scaleMax;
    if (next == null) {
      scaleMax = math.max(used, forecast ?? 0) * 1.15;
    } else if (crossedAt != null) {
      scaleMax = next;
    } else {
      scaleMax = after ?? next * 1.5;
    }
    if (forecast != null && next != null && forecast > scaleMax) {
      scaleMax = math.max(scaleMax, math.min(forecast, scaleMax * 1.35));
    }

    DateTime? crossingDate;
    if (next != null && forecast != null && forecast > next) {
      final t = tunis(now);
      final daysLeft = math.max(0.01, daysInMonth(t.year, t.month) + 1 - fractionalDay(now));
      final perDay = (forecast - used) / daysLeft;
      if (perDay > 0) {
        crossingDate = now.add(Duration(milliseconds: ((next - used) / perDay * 86400000).round()));
      }
    }

    return TrancheView(
      state: state,
      used: used,
      next: next,
      crossedAt: crossedAt,
      left: left,
      nextBandLabel: next != null ? _band(next, after) : null,
      currentBandLabel: _band(crossedAt ?? 0, next),
      forecast: forecast,
      scaleMax: scaleMax,
      marks: [for (final t in thresholds) if (t > 0 && t <= scaleMax) t],
      crossingDate: crossingDate,
    );
  }
}
