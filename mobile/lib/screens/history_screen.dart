import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';

// "Historique" (frontend/src/pages/History.tsx): monthly kWh and water, estimated bills.

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  int _months = 6;
  Poll<History>? _history;

  void _load() {
    _history?.dispose();
    final api = AppScope.read(context).api;
    final n = _months;
    _history = Poll(() => api.history(months: n), interval: const Duration(minutes: 2))..addListener(() => mounted ? setState(() {}) : null);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _history?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final h = _history!;
    final rows = h.data?.months ?? const <HistoryMonth>[];
    final thresholds = app.dashboard?.electricity.thresholds ?? const <double>[];
    final done = rows.where((r) => !r.partial && r.kwh > 0).toList();
    final avg = done.isEmpty ? null : done.fold<double>(0, (s, r) => s + r.kwh) / done.length;
    final billed = done.where((r) => r.billDt != null).toList();
    final avgBill = billed.isEmpty ? null : billed.fold<double>(0, (s, r) => s + r.billDt!) / billed.length;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: h.refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 40),
            children: [
              PageHeader(
                back: true,
                title: L('Historique', 'History', 'التاريخ'),
                aside: Row(mainAxisSize: MainAxisSize.min, children: [
                  for (final n in [6, 12]) ...[
                    if (n == 12) const SizedBox(width: 8),
                    TgChip(L('$n mois', '$n months', '$n شهر'), active: _months == n, onTap: () => setState(() {
                      _months = n;
                      _load();
                    })),
                  ],
                ]),
              ),
              if (h.error != null && h.data == null)
                TgBanner(tone: BannerTone.broken, child: Text(h.error!))
              else if (h.data == null) ...[
                const Skeleton(height: 240),
                const SizedBox(height: 12),
                const Skeleton(height: 240),
              ] else ...[
                TgCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    CardTitle(L('Électricité par mois', 'Electricity per month', 'الضو في الشهر'), aside: 'kWh'),
                    _Bars(months: rows, value: (m) => m.kwh, color: tg.elec, thresholds: thresholds, unit: 'kWh'),
                    if (avg != null) ...[
                      const SizedBox(height: 12),
                      Text.rich(TextSpan(style: T.small(tg.mute), children: [
                        TextSpan(text: '${L('Moyenne des mois complets', 'Average of full months', 'معدّل الأشهر الكاملة')} : '),
                        TextSpan(text: '${kwhValue(avg)} kWh', style: TextStyle(color: tg.ink, fontWeight: FontWeight.w700)),
                        if (avgBill != null) TextSpan(text: ' · ≈ ${dt(avgBill)} (${L('estimation', 'estimate', 'تقدير')})'),
                      ])),
                    ],
                  ]),
                ),
                const SizedBox(height: 12),
                TgCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    CardTitle(L('Eau par mois', 'Water per month', 'الماء في الشهر'), aside: 'm³'),
                    _Bars(months: rows, value: (m) => m.litres / 1000, color: tg.water, unit: 'm³'),
                  ]),
                ),
                const SizedBox(height: 12),
                TgCard(
                  padding: EdgeInsets.zero,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    _row(context, [L('Mois', 'Month', 'الشهر'), 'kWh', L('Tranche', 'Tranche', 'الشريحة'), L('Facture STEG', 'STEG bill', 'فاتورة STEG'), L('Eau', 'Water', 'الماء')],
                        header: true),
                    for (final r in rows.reversed) ...[
                      Divider(height: 1, color: tg.hairline),
                      _row(context, [
                        '${monthKeyLabel(r.month, long: true)}${r.partial ? ' · ${L('en cours', 'in progress', 'جاري')}' : ''}',
                        r.kwh > 0 ? kwhValue(r.kwh) : '—',
                        r.trancheIndex?.toString() ?? '—',
                        r.billDt != null ? '≈ ${dt(r.billDt!)}' : '—',
                        r.litres > 0 ? m3(r.litres / 1000) : '—',
                      ]),
                    ],
                    Divider(height: 1, color: tg.hairline),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        L('Montants estimés avec la grille STEG en vigueur ce mois-là. Pas une facture officielle. L\'eau n\'a pas de montant tant que la grille SONEDE n\'est pas vérifiée.',
                            'Amounts estimated with the STEG grid in force that month. Not an official bill. Water has no amount until the SONEDE grid is verified.',
                            'المبالغ مقدّرة بجدول STEG متاع الشهر هذاكا. موش فاتورة رسمية. الماء ما عندوش مبلغ قبل ما يتثبّت جدول SONEDE.'),
                        style: T.caption(tg.mute).copyWith(fontSize: 12),
                      ),
                    ),
                  ]),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(BuildContext context, List<String> cells, {bool header = false}) {
    final tg = context.tg;
    final style = header ? T.small(tg.mute).copyWith(fontWeight: FontWeight.w600) : T.small(tg.ink);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(children: [
        Expanded(flex: 5, child: Text(cells[0], style: header ? style : style.copyWith(fontWeight: FontWeight.w600))),
        Expanded(flex: 3, child: Text(cells[1], textAlign: TextAlign.end, style: style)),
        Expanded(flex: 2, child: Text(cells[2], textAlign: TextAlign.end, style: style)),
        Expanded(flex: 4, child: Text(cells[3], textAlign: TextAlign.end, style: header ? style : style.copyWith(fontWeight: FontWeight.w700))),
        Expanded(flex: 3, child: Text(cells[4], textAlign: TextAlign.end, style: style)),
      ]),
    );
  }
}

/// Monthly bars with dashed threshold lines (kWh); always left to right.
class _Bars extends StatelessWidget {
  const _Bars({required this.months, required this.value, required this.color, required this.unit, this.thresholds = const []});
  final List<HistoryMonth> months;
  final double Function(HistoryMonth) value;
  final Color color;
  final String unit;
  final List<double> thresholds;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final top = months.isEmpty ? 0.0 : months.map(value).reduce(math.max);
    final max = [1.0, top, ...thresholds.where((t) => t < top * 1.4)].reduce(math.max);
    final lines = thresholds.where((t) => t <= max).toList();
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Column(children: [
        SizedBox(
          height: 176,
          child: LayoutBuilder(builder: (context, box) {
            return Stack(children: [
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                for (var i = 0; i < months.length; i++) ...[
                  if (i > 0) const SizedBox(width: 6),
                  Expanded(
                    child: Opacity(
                      opacity: months[i].partial ? 0.6 : 1,
                      child: Container(
                        height: math.max(2, value(months[i]) / max * box.maxHeight),
                        decoration: BoxDecoration(
                          color: value(months[i]) == 0 ? tg.hairline : color,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                        ),
                      ),
                    ),
                  ),
                ],
              ]),
              for (final t in lines)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: t / max * box.maxHeight,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text('${num(t)} $unit', style: T.caption(tg.harissa).copyWith(fontSize: 10, fontWeight: FontWeight.w700)),
                    CustomPaint(size: const Size(double.infinity, 1), painter: _Dashed(tg.harissa.withValues(alpha: 0.7))),
                  ]),
                ),
            ]);
          }),
        ),
        const SizedBox(height: 6),
        Row(children: [
          for (var i = 0; i < months.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: Text(monthKeyLabel(months[i].month),
                  textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.clip, style: T.caption(tg.mute).copyWith(fontSize: 10)),
            ),
          ],
        ]),
      ]),
    );
  }
}

class _Dashed extends CustomPainter {
  _Dashed(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 1;
    for (var x = 0.0; x < size.width; x += 7) {
      canvas.drawLine(Offset(x, 0), Offset(math.min(x + 4, size.width), 0), p);
    }
  }

  @override
  bool shouldRepaint(_Dashed o) => o.color != color;
}
