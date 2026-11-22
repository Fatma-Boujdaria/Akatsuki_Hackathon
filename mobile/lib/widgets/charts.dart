import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../theme.dart';
import '../util/i18n.dart';
import '../util/format.dart';
import '../util/tranche.dart';
import 'ui.dart';

// Chart rules (charter board 06): electricity = Chams stroke on a soft fill, water =
// Ciel with lines in its ink; two resources, two charts, one shared time axis, never a
// dual axis; forecast dotted; threshold dashed Harissa, always labelled; hairline
// gridlines, no frame, axis text in Mono 11; lines labelled directly.

const double _leftAxis = 44;
const double _bottomAxis = 24;

class _Palette {
  _Palette(TG tg)
      : grid = tg.hairline,
        axis = tg.mute,
        ink = tg.ink,
        surface = tg.surface,
        elecStroke = tg.elecStroke,
        elecFill = tg.isDark ? const Color(0xFF34372A) : const Color(0xFFFEF3B3),
        waterStroke = tg.waterInk,
        waterFill = tg.waterSoft,
        harissa = tg.harissa;
  final Color grid, axis, ink, surface, elecStroke, elecFill, waterStroke, waterFill, harissa;
}

FlTitlesData _titles({
  required Widget Function(double, TitleMeta) left,
  required Widget Function(double, TitleMeta)? bottom,
  double bottomInterval = 1,
  double? leftInterval,
}) {
  return FlTitlesData(
    topTitles: const AxisTitles(),
    rightTitles: const AxisTitles(),
    leftTitles: AxisTitles(
      sideTitles: SideTitles(showTitles: true, reservedSize: _leftAxis, interval: leftInterval, getTitlesWidget: left),
    ),
    bottomTitles: bottom == null
        ? const AxisTitles()
        : AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: _bottomAxis,
              interval: bottomInterval,
              getTitlesWidget: bottom,
            ),
          ),
  );
}

Widget _axisText(String text, TitleMeta meta, Color color, {bool bold = false}) => SideTitleWidget(
      meta: meta,
      space: 6,
      child: Text(text, style: T.axis(color).copyWith(fontWeight: bold ? FontWeight.w600 : null)),
    );

LineTouchData _touch(_Palette p, String Function(double x, double y, int barIndex) text) => LineTouchData(
      handleBuiltInTouches: true,
      getTouchedSpotIndicator: (bar, idx) => [
        for (final _ in idx)
          TouchedSpotIndicatorData(
            FlLine(color: p.axis, strokeWidth: 1, dashArray: const [2, 3]),
            FlDotData(
              getDotPainter: (s, _, b, _) =>
                  FlDotCirclePainter(radius: 4, color: b.color ?? p.ink, strokeWidth: 2, strokeColor: p.surface),
            ),
          ),
      ],
      touchTooltipData: LineTouchTooltipData(
        getTooltipColor: (_) => p.surface,
        tooltipBorder: BorderSide(color: p.grid),
        tooltipBorderRadius: BorderRadius.circular(kRadiusCtl),
        fitInsideHorizontally: true,
        fitInsideVertically: true,
        getTooltipItems: (spots) => [
          for (final s in spots)
            s.barIndex == 0
                ? LineTooltipItem(text(s.x, s.y, s.barIndex), T.data(p.ink).copyWith(fontSize: 12))
                : null,
        ],
      ),
    );

/// Chart shell: title (Inter 600) and a Mono caps unit on the right.
class ChartCard extends StatelessWidget {
  const ChartCard({super.key, required this.title, this.unit, required this.child, this.footer});
  final String title;
  final String? unit;
  final Widget child;
  final String? footer;
  @override
  Widget build(BuildContext context) => TgCard(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CardTitle(title, aside: unit),
            child,
            if (footer != null) ...[const SizedBox(height: 10), Text(footer!, style: T.small(context.tg.mute).copyWith(fontSize: 13))],
          ],
        ),
      );
}

// ---- "Cumul du mois" ----------------------------------------------------------------

class MonthChart extends StatelessWidget {
  const MonthChart({super.key, required this.series, required this.elec, required this.view, required this.now});
  final Series? series;
  final ElectricitySummary? elec;
  final TrancheView? view;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final title = L('Cumul de ${monthName(now)}', '${monthName(now)} so far', 'المجموع متاع ${monthName(now)}');
    if (series == null || elec == null || view == null) {
      return ChartCard(title: title, unit: 'KWH · ESTIMATION', child: const Skeleton(height: 240));
    }
    final p = _Palette(context.tg);
    final local = tunis(now);
    final days = daysInMonth(local.year, local.month);
    final nowX = fractionalDay(now);
    final end = days + 1.0;
    final e = elec!;
    final v = view!;

    final perDay = <int, double>{};
    for (final pt in series!.points) {
      final t = tunis(pt.ts);
      if (t.month != local.month) continue;
      perDay[t.day] = (perDay[t.day] ?? 0) + (pt.energyKwh ?? 0);
    }
    final actual = <FlSpot>[];
    var cum = 0.0;
    for (var d = 1; d <= local.day; d++) {
      actual.add(FlSpot(d.toDouble(), cum));
      cum += perDay[d] ?? 0;
    }
    actual.add(FlSpot(nowX, e.monthKwh));
    final fc = e.forecast.available ? e.forecast.qty : null;

    final topVal = math.max(math.max(e.monthKwh, fc ?? 0), v.next ?? 0) * 1.08;
    final step = topVal <= 160 ? 25.0 : (topVal <= 320 ? 50.0 : 100.0);
    final yMax = math.max(step * 2, (topVal / step).ceil() * step);

    final xTicks = <int>{1, 15, local.day, days}.where((t) => t == local.day || (t - local.day).abs() >= 3).toSet();
    final crossX = v.crossingDate != null ? fractionalDay(v.crossingDate!) : null;
    final showCross = crossX != null && tunis(v.crossingDate!).month == local.month && crossX <= end;

    final bars = <LineChartBarData>[
      LineChartBarData(
        spots: actual,
        color: p.elecStroke,
        barWidth: 2,
        belowBarData: BarAreaData(show: true, color: p.elecFill),
        dotData: FlDotData(
          checkToShowDot: (s, b) => s == b.spots.last,
          getDotPainter: (_, _, _, _) =>
              FlDotCirclePainter(radius: 5.5, color: TG.chams, strokeWidth: 1.75, strokeColor: p.elecStroke),
        ),
      ),
      if (fc != null)
        LineChartBarData(
          spots: [FlSpot(nowX, e.monthKwh), FlSpot(end, fc)],
          color: p.elecStroke,
          barWidth: 2.5,
          dashArray: const [1, 5],
          isStrokeCapRound: true,
          dotData: const FlDotData(show: false),
        ),
      if (showCross)
        LineChartBarData(
          spots: [FlSpot(crossX, v.next!)],
          color: Colors.transparent,
          dotData: FlDotData(
            getDotPainter: (_, _, _, _) =>
                FlDotCirclePainter(radius: 5, color: p.surface, strokeWidth: 1.75, strokeColor: p.harissa),
          ),
        ),
    ];

    final nearLine = v.next != null && v.next! >= e.monthKwh && v.next! - e.monthKwh < yMax * 0.12;

    return ChartCard(
      title: title,
      unit: 'KWH · ESTIMATION',
      footer: e.forecast.available ? e.forecast.assumption : L('Prévision disponible après une heure de mesures.', 'Forecast available after one hour of readings.', 'التوقع يتوفّر بعد ساعة قياس.'),
      child: SizedBox(
        height: 240,
        child: LayoutBuilder(builder: (context, c) {
          final plotW = c.maxWidth - _leftAxis;
          final plotH = c.maxHeight - _bottomAxis;
          double px(double x) => _leftAxis + (x - 1) / (end - 1) * plotW;
          double py(double y) => plotH - y / yMax * plotH;
          return Stack(clipBehavior: Clip.none, children: [
            Positioned.fill(
              child: LineChart(
                LineChartData(
                  minX: 1,
                  maxX: end,
                  minY: 0,
                  maxY: yMax,
                  clipData: const FlClipData.none(),
                  borderData: FlBorderData(show: true, border: Border(bottom: BorderSide(color: p.grid))),
                  gridData: FlGridData(
                    drawVerticalLine: false,
                    horizontalInterval: step,
                    getDrawingHorizontalLine: (_) => FlLine(color: p.grid, strokeWidth: 1),
                  ),
                  titlesData: _titles(
                    leftInterval: step,
                    left: (val, meta) => val % step == 0 ? _axisText(num(val), meta, p.axis) : const SizedBox.shrink(),
                    bottom: (val, meta) {
                      final d = val.round();
                      if ((val - d).abs() > 0.01 || !xTicks.contains(d)) return const SizedBox.shrink();
                      return _axisText(d == 1 ? '1 ${dayMonth(now).split(' ').last}' : '$d', meta,
                          d == local.day ? p.ink : p.axis,
                          bold: d == local.day);
                    },
                  ),
                  extraLinesData: ExtraLinesData(
                    verticalLines: [VerticalLine(x: nowX, color: p.grid, strokeWidth: 1)],
                    horizontalLines: [
                      if (v.next != null)
                        HorizontalLine(
                          y: v.next!,
                          color: p.harissa,
                          strokeWidth: 1.5,
                          dashArray: const [6, 5],
                          label: HorizontalLineLabel(
                            show: true,
                            alignment: Alignment.topLeft,
                            padding: const EdgeInsets.only(bottom: 2, left: 4),
                            style: T.small(p.harissa).copyWith(fontSize: 12, fontWeight: FontWeight.w500),
                            labelResolver: (_) => '${num(v.next!)} kWh · tranche suivante',
                          ),
                        ),
                    ],
                  ),
                  lineTouchData: _touch(p, (x, y, _) {
                    if ((x - nowX).abs() < 0.01) return '${L('maintenant', 'now', 'توّا')}\n${kwh(y)}';
                    final d = x.floor();
                    return '${L('début du $d', 'start of the $d', 'بداية $d')}\n${kwh(y)}';
                  }),
                  lineBarsData: bars,
                ),
              ),
            ),
            // Direct labels: today's value, the forecast end, the crossing date
            Positioned(
              right: c.maxWidth - px(nowX) + 10,
              top: py(e.monthKwh) + (nearLine ? 6 : -22),
              child: Text('${kwhValue(e.monthKwh)} kWh ${L('aujourd\'hui', 'today', 'اليوم')}',
                  style: T.small(p.ink).copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
            if (fc != null)
              Positioned(
                right: 0,
                top: math.max(0, py(math.min(fc, yMax)) - (fc > (v.next ?? double.infinity) ? 22 : -4)),
                child: Text('${L('prévision', 'forecast', 'التوقع')} ≈ ${num(fc.roundToDouble())}', style: T.small(p.elecStroke).copyWith(fontSize: 12)),
              ),
            if (showCross)
              Positioned(
                left: px(crossX) + 6,
                top: py(v.next!) + 6,
                child: Text('≈ ${dayMonth(v.crossingDate!)}', style: T.axis(p.harissa)),
              ),
          ]);
        }),
      ),
    );
  }
}

// ---- "Aujourd'hui": power and flow on one shared time axis -----------------------------

class DayStrip extends StatelessWidget {
  const DayStrip({
    super.key,
    required this.water,
    required this.series,
    required this.live,
    required this.liveAt,
    required this.height,
    this.showAxis = true,
  });

  final bool water;
  final Series? series;
  final double? live;
  final DateTime liveAt;
  final double height;
  final bool showAxis;

  static double _niceMax(double max) {
    if (max <= 0) return 1;
    final mag = math.pow(10, (math.log(max) / math.ln10).floor()).toDouble();
    for (final s in const [1.0, 2.0, 2.5, 5.0, 10.0]) {
      if (s * mag >= max) return s * mag;
    }
    return 10 * mag;
  }

  @override
  Widget build(BuildContext context) {
    final p = _Palette(context.tg);
    final stroke = water ? p.waterStroke : p.elecStroke;
    final fill = water ? p.waterFill : p.elecFill;
    final fmt = water ? flow : watts;

    final spots = <FlSpot>[];
    for (final pt in series?.points ?? const <SeriesPoint>[]) {
      final val = water ? pt.flowLMin : pt.powerW;
      spots.add(pt.reliable && val != null ? FlSpot(fractionalHour(pt.ts), val) : FlSpot.nullSpot);
    }
    final liveX = fractionalHour(liveAt);
    if (live != null) spots.add(FlSpot(liveX, live!));
    final maxV = spots.where((s) => s != FlSpot.nullSpot).fold<double>(water ? 2 : 500, (m, s) => math.max(m, s.y));
    final yMax = _niceMax(maxV);
    const rightPad = 78.0;

    String hhmm(double x) {
      final h = x.floor();
      final m = ((x - h) * 60).round().clamp(0, 59);
      return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
    }

    return SizedBox(
      height: height,
      child: LayoutBuilder(builder: (context, c) {
        final plotW = c.maxWidth - _leftAxis - rightPad;
        final plotH = c.maxHeight - (showAxis ? _bottomAxis : 0);
        final dotX = _leftAxis + liveX / 24 * plotW;
        final dotY = live == null ? 0.0 : plotH - (live! / yMax) * plotH;
        return Stack(clipBehavior: Clip.none, children: [
          Positioned.fill(
            right: rightPad,
            child: LineChart(
              LineChartData(
                minX: 0,
                maxX: 24,
                minY: 0,
                maxY: yMax,
                clipData: const FlClipData.none(),
                borderData: FlBorderData(show: true, border: Border(bottom: BorderSide(color: p.grid))),
                gridData: FlGridData(
                  drawVerticalLine: false,
                  horizontalInterval: yMax / 2,
                  getDrawingHorizontalLine: (_) => FlLine(color: p.grid, strokeWidth: 1),
                ),
                titlesData: _titles(
                  left: (val, meta) {
                    if (val != 0 && val != yMax && val != yMax / 2) return const SizedBox.shrink();
                    return _axisText(water ? num(val, decimals: 2, fixed: false) : num(val), meta, p.axis);
                  },
                  bottom: showAxis
                      ? (val, meta) => val % 6 == 0 ? _axisText('${val.round()} h', meta, p.axis) : const SizedBox.shrink()
                      : null,
                  bottomInterval: 6,
                  leftInterval: yMax / 2,
                ),
                lineTouchData: _touch(p, (x, y, _) => '${hhmm(x)}\n${fmt(y)}'),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    curveSmoothness: 0.2,
                    preventCurveOverShooting: true,
                    color: stroke,
                    barWidth: 2,
                    belowBarData: BarAreaData(show: true, color: fill),
                    dotData: const FlDotData(show: false),
                  ),
                ],
              ),
            ),
          ),
          if (live != null) ...[
            // Circle for power, square for water: shape, not only colour, tells them apart.
            Positioned(
              left: dotX - 5,
              top: dotY - 5,
              child: Container(
                width: 10,
                height: 10,
                decoration: water
                    ? BoxDecoration(color: stroke, borderRadius: BorderRadius.circular(1.5))
                    : BoxDecoration(color: TG.chams, shape: BoxShape.circle, border: Border.all(color: stroke, width: 1.5)),
              ),
            ),
            Positioned(
              left: dotX + 10,
              top: dotY - 8,
              child: Text(fmt(live!), style: T.axis(p.ink).copyWith(fontSize: 12)),
            ),
          ],
        ]);
      }),
    );
  }
}

class DayCharts extends StatelessWidget {
  const DayCharts({super.key, required this.power, required this.water, this.livePower, this.liveFlow, required this.liveAt});
  final Series? power, water;
  final double? livePower, liveFlow;
  final DateTime liveAt;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    if (power == null || water == null) {
      return ChartCard(title: L('Aujourd\'hui', 'Today', 'اليوم'), unit: L('même axe du temps', 'same time axis', 'نفس محور الوقت'), child: const Skeleton(height: 250));
    }
    return ChartCard(
      title: L('Aujourd\'hui', 'Today', 'اليوم'),
      unit: L('même axe du temps', 'same time axis', 'نفس محور الوقت'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Label('${L('Puissance', 'Power', 'القوة')} · W', color: tg.elecInk),
          const SizedBox(height: 6),
          DayStrip(water: false, series: power, live: livePower, liveAt: liveAt, height: 104, showAxis: false),
          const SizedBox(height: 14),
          Label('${L('Débit', 'Flow', 'الدبي')} · L/min', color: tg.waterInk),
          const SizedBox(height: 6),
          DayStrip(water: true, series: water, live: liveFlow, liveAt: liveAt, height: 128),
        ],
      ),
    );
  }
}

// ---- Litres per day ------------------------------------------------------------------

class WaterBars extends StatelessWidget {
  const WaterBars({super.key, required this.series, required this.now});
  final Series? series;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    if (series == null) {
      return ChartCard(title: L('Litres par jour', 'Litres per day', 'لترات في النهار'), unit: L('L · ce mois-ci', 'L · this month', 'L · هالشهر'), child: const Skeleton(height: 200));
    }
    final p = _Palette(context.tg);
    final local = tunis(now);
    final points = [
      for (final pt in series!.points)
        if (tunis(pt.ts).month == local.month) (tunis(pt.ts).day, (pt.volumeL ?? 0).roundToDouble()),
    ];
    final avg = points.isEmpty ? 0.0 : points.map((e) => e.$2).reduce((a, b) => a + b) / points.length;
    final maxV = points.fold<double>(1, (m, e) => math.max(m, e.$2));
    final yMax = DayStrip._niceMax(maxV * 1.05);

    return ChartCard(
      title: L('Litres par jour', 'Litres per day', 'لترات في النهار'),
      unit: L('L · ce mois-ci', 'L · this month', 'L · هالشهر'),
      footer: points.isEmpty ? null : L('Moyenne : ${litres(avg)} par jour.', 'Average: ${litres(avg)} a day.', 'المعدّل: ${litres(avg)} في النهار.'),
      child: SizedBox(
        height: 200,
        child: BarChart(
          BarChartData(
            maxY: yMax,
            minY: 0,
            alignment: BarChartAlignment.spaceBetween,
            borderData: FlBorderData(show: true, border: Border(bottom: BorderSide(color: p.grid))),
            gridData: FlGridData(
              drawVerticalLine: false,
              horizontalInterval: yMax / 2,
              getDrawingHorizontalLine: (_) => FlLine(color: p.grid, strokeWidth: 1),
            ),
            titlesData: _titles(
              leftInterval: yMax / 2,
              left: (val, meta) =>
                  (val == 0 || val == yMax || val == yMax / 2) ? _axisText(num(val), meta, p.axis) : const SizedBox.shrink(),
              bottom: (val, meta) {
                final d = val.round();
                return (d == 1 || d % 5 == 0 || d == local.day) ? _axisText('$d', meta, p.axis) : const SizedBox.shrink();
              },
            ),
            barTouchData: BarTouchData(
              touchTooltipData: BarTouchTooltipData(
                getTooltipColor: (_) => p.surface,
                tooltipBorder: BorderSide(color: p.grid),
                tooltipBorderRadius: BorderRadius.circular(kRadiusCtl),
                fitInsideHorizontally: true,
                getTooltipItem: (group, _, rod, _) => BarTooltipItem(
                  '${group.x} ${dayMonth(now).split(' ').last}\n${litres(rod.toY)}',
                  T.data(p.ink).copyWith(fontSize: 12),
                ),
              ),
            ),
            barGroups: [
              for (final (day, l) in points)
                BarChartGroupData(x: day, barRods: [
                  BarChartRodData(
                    toY: l,
                    color: TG.ciel,
                    width: 7,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                  ),
                ]),
            ],
          ),
        ),
      ),
    );
  }
}
