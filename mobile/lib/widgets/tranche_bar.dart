import 'dart:math' as math;

import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../theme.dart';
import '../util/format.dart';
import '../util/tranche.dart';
import 'ui.dart';

// The signature (board 05): track Sunken · fill Chams with its stroke · forecast
// dashed · threshold marks in Encre · the number is always written next to the bar.
// Near (within the alert margin): Harissa fill. Crossed: the extra kWh are hatched.

class TrancheBar extends StatelessWidget {
  const TrancheBar({super.key, required this.view, this.nextKwhPrice, this.showHeader = false});

  final TrancheView view;
  final double? nextKwhPrice;
  final bool showHeader;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final v = view;
    final near = v.state == TrancheState.near;
    final crossedOrTop = v.state == TrancheState.crossed || v.state == TrancheState.top;

    final left = crossedOrTop
        ? kwh(v.used)
        : v.next != null
            ? '${kwhValue(v.used)} / ${num(v.next!)} kWh'
            : kwh(v.used);
    final right = v.state == TrancheState.crossed && nextKwhPrice != null
        ? 'kWh à ${dtUnit(nextKwhPrice!)}'
        : v.forecast != null
            ? 'prévision ≈ ${num(v.forecast!.roundToDouble())}'
            : '0 — ${num(v.scaleMax.roundToDouble())}';

    final headerText = crossedOrTop
        ? 'Tranche ${v.currentBandLabel?.replaceAll(' kWh', '') ?? ''}'
        : v.left != null
            ? 'Encore ${kwh(v.left!)}'
            : '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showHeader)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Expanded(
                  child: Label(switch (v.state) {
                    TrancheState.safe => 'sous la tranche',
                    TrancheState.near => 'tranche proche',
                    TrancheState.crossed => 'tranche dépassée',
                    _ => 'consommation',
                  }),
                ),
                if (near) ...[Icon(LucideIcons300.triangleAlert, size: 16, color: tg.harissa), const SizedBox(width: 4)],
                Text(
                  headerText,
                  style: T.h1(near || v.state == TrancheState.crossed ? tg.harissa : tg.ink).copyWith(fontSize: 17),
                ),
              ],
            ),
          ),
        Semantics(
          label: v.next != null
              ? '${kwhValue(v.used)} kWh consommés sur ${num(v.next!)} avant la tranche suivante'
              : '${kwhValue(v.used)} kWh consommés ce mois-ci',
          child: SizedBox(
            height: 26,
            child: CustomPaint(painter: _BarPainter(view: v, tg: tg), size: Size.infinite),
          ),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(child: Text(left, style: T.data(near || v.state == TrancheState.crossed ? tg.harissa : tg.mute).copyWith(fontSize: 13))),
            Text(right, style: T.data(tg.mute).copyWith(fontSize: 13)),
          ],
        ),
      ],
    );
  }
}

class _BarPainter extends CustomPainter {
  _BarPainter({required this.view, required this.tg});
  final TrancheView view;
  final TG tg;

  @override
  void paint(Canvas canvas, Size size) {
    const h = 14.0;
    final top = (size.height - h) / 2;
    final w = size.width;
    double x(double v) => (v / view.scaleMax).clamp(0.0, 1.0) * w;
    final r = const Radius.circular(h / 2);
    final near = view.state == TrancheState.near;

    // Track
    canvas.drawRRect(RRect.fromLTRBR(0, top, w, top + h, r), Paint()..color = tg.sunken);

    // Forecast: dashed outline from now to the end-of-month estimate
    final fc = view.forecast;
    if (fc != null && fc > view.used + 0.5) {
      final rr = RRect.fromLTRBR(0.5, top + 0.5, math.max(x(fc) - 0.5, 1), top + h - 0.5, r);
      canvas.drawPath(
        dashPath(Path()..addRRect(rr), 4, 3),
        Paint()
          ..color = tg.elecStroke
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }

    // Fill up to the crossed threshold (or the whole use)
    final crossed = view.crossedAt;
    final base = crossed != null ? math.min(view.used, crossed) : view.used;
    if (base > 0) {
      final fillW = math.max(x(base), h);
      final fill = RRect.fromLTRBR(0, top, fillW, top + h, r);
      canvas.drawRRect(fill, Paint()..color = near ? tg.harissa : tg.elec);
      canvas.drawRRect(
        fill.deflate(0.5),
        Paint()
          ..color = near ? tg.harissa : tg.elecStroke
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }

    // Crossed: the extra above the threshold, hatched Harissa
    if (crossed != null && !near && view.used > crossed) {
      final rect = Rect.fromLTRB(x(crossed), top, math.max(x(view.used), x(crossed) + 3), top + h);
      final clip = RRect.fromRectAndCorners(rect, topRight: r, bottomRight: r);
      canvas.save();
      canvas.clipRRect(clip);
      final p = Paint()
        ..color = tg.harissa
        ..strokeWidth = 1.6;
      for (var sx = rect.left - h; sx < rect.right + h; sx += 5) {
        canvas.drawLine(Offset(sx, rect.bottom), Offset(sx + h, rect.top), p);
      }
      canvas.restore();
      canvas.drawRRect(
        clip.deflate(0.5),
        Paint()
          ..color = tg.harissa
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }

    // Threshold marks, in Encre
    final mark = Paint()
      ..color = tg.ink
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (final m in view.marks) {
      if (m >= view.scaleMax - 0.01) continue;
      final mx = x(m);
      canvas.drawLine(Offset(mx, top - 5), Offset(mx, top + h + 5), mark);
    }
  }

  @override
  bool shouldRepaint(_BarPainter old) => true;
}
