import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../theme.dart';
import '../util/format.dart' as f;
import '../util/i18n.dart';

// The design's home illustration (frontend/src/components/HouseScene.tsx): an isometric
// house fed by STEG (left, Chams) and SONEDE (right, Ciel), with dotted lines to the main
// appliances. The lines flow while power or water is measured. Appliance chips show the
// declared PROFILE (share of the month, estimate), never a per-appliance measurement.

enum SceneFocus { all, electricity, water }

class _Palette {
  const _Palette(this.elec, this.water, this.shadow, this.front, this.side, this.eave, this.window, this.door, this.box);
  final Color elec, water, shadow, front, side, eave, window, door, box;
  static const dark = _Palette(Color(0xFFFEBD19), Color(0xFF76B9FF), Color(0xFF0A1219), Color(0xFFE8EEF5), Color(0xFFAFC1D4),
      Color(0xFF2A3F55), Color(0xFFFEF3B3), Color(0xFF24384C), Color(0xFF0D1820));
  static const light = _Palette(Color(0xFFE0A000), Color(0xFF1D59BB), Color(0xFFD5E1EC), Color(0xFFFFFFFF), Color(0xFFC9D6E4),
      Color(0xFF0D1820), Color(0xFFFEBD19), Color(0xFF24384C), Color(0xFF0D1820));
}

class HouseScene extends StatefulWidget {
  const HouseScene({
    super.key,
    required this.powerW,
    required this.flowLMin,
    required this.appliances,
    this.focus = SceneFocus.all,
    this.unreliable = false,
    this.stale = false,
  });
  final double? powerW, flowLMin;
  final List<ApplianceShare> appliances;
  final SceneFocus focus;
  final bool unreliable;

  /// Device offline / last reading old: values shown grey as "last received".
  final bool stale;

  @override
  State<HouseScene> createState() => _HouseSceneState();
}

class _HouseSceneState extends State<HouseScene> with SingleTickerProviderStateMixin {
  late final AnimationController _flow = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));

  /// The lines only move while something flows: no 60 fps repaint (and battery) for a
  /// still picture.
  void _syncFlow(bool moving) {
    if (moving && !_flow.isAnimating) {
      _flow.repeat();
    } else if (!moving && _flow.isAnimating) {
      _flow.stop();
    }
  }

  @override
  void dispose() {
    _flow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final c = tg.isDark ? _Palette.dark : _Palette.light;
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final elecOn = !widget.stale && (widget.powerW ?? 0) > 0;
    final waterOn = !widget.stale && (widget.flowLMin ?? 0) > 0;
    final dimElec = widget.focus == SceneFocus.water;
    final dimWater = widget.focus == SceneFocus.electricity;
    _syncFlow(!reduce && (elecOn || waterOn));
    final top = widget.appliances.take(3).toList();
    final unreliable = L('peu fiable', 'unreliable', 'موش مضمون');

    return Semantics(
      image: true,
      label: L('Maison avec flux d\'électricité et d\'eau vers les appareils', 'House with electricity and water flowing to the appliances',
          'دار فيها الضو والماء ماشيين للآلات'),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: AspectRatio(
            aspectRatio: 390 / 290,
            child: LayoutBuilder(builder: (context, box) {
              final k = box.maxWidth / 390;
              return Directionality(
                textDirection: TextDirection.ltr,
                child: Stack(children: [
                  Positioned.fill(
                    child: AnimatedBuilder(
                      animation: _flow,
                      builder: (_, _) => CustomPaint(
                        painter: _ScenePainter(
                          c: c,
                          phase: reduce ? 0 : _flow.value,
                          elecOn: elecOn,
                          waterOn: waterOn,
                          dimElec: dimElec,
                          dimWater: dimWater,
                          lines: top.length,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 16 * k,
                    top: 6 * k,
                    child: _Chip(
                      label: L('STEG · réseau', 'STEG · grid', 'STEG · الشبكة'),
                      value: widget.unreliable
                          ? unreliable
                          : widget.powerW != null
                              ? '${f.num(widget.powerW! / 1000, decimals: 2)} kW'
                              : '—',
                      color: widget.stale ? tg.mute : tg.elecInk,
                      dim: dimElec,
                    ),
                  ),
                  Positioned(
                    right: 16 * k,
                    top: 6 * k,
                    child: _Chip(
                      label: L('SONEDE · eau', 'SONEDE · water', 'SONEDE · الماء'),
                      value: widget.unreliable
                          ? unreliable
                          : widget.flowLMin != null
                              ? '${f.num(widget.flowLMin!, decimals: 1)} L/min'
                              : '—',
                      color: widget.stale ? tg.mute : tg.waterInk,
                      dim: dimWater,
                      end: true,
                    ),
                  ),
                  Positioned(
                    left: 16 * k,
                    right: 16 * k,
                    top: 246 * k,
                    child: top.isEmpty
                        ? Padding(
                            padding: EdgeInsets.only(top: 6 * k),
                            child: Text(
                              L('Déclare tes appareils pour voir leur part estimée.', 'Declare your appliances to see their estimated share.',
                                  'صرّح بالآلات متاعك باش تشوف نسبتهم.'),
                              textAlign: TextAlign.center,
                              textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
                              style: T.caption(tg.mute).copyWith(fontSize: 12),
                            ),
                          )
                        : Row(children: [
                            for (var i = 0; i < top.length; i++) ...[
                              if (i > 0) const SizedBox(width: 8),
                              Expanded(
                                child: Opacity(
                                  opacity: dimElec ? 0.5 : 1,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(color: tg.surface, borderRadius: BorderRadius.circular(kRadiusChip)),
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                                      Text(top[i].name, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.caption(tg.mute)),
                                      Text('≈ ${f.num(top[i].sharePct)} %',
                                          style: T.data(tg.ink).copyWith(fontWeight: FontWeight.w700)),
                                    ]),
                                  ),
                                ),
                              ),
                            ],
                          ]),
                  ),
                ]),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.value, required this.color, required this.dim, this.end = false});
  final String label, value;
  final Color color;
  final bool dim, end;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Opacity(
      opacity: dim ? 0.5 : 1,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: tg.surface, borderRadius: BorderRadius.circular(kRadiusCtl)),
        child: Column(crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(label, style: T.caption(tg.mute), textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr),
          Text(value, style: T.h3(color).copyWith(fontSize: 17, height: 24 / 17, fontWeight: FontWeight.w800, fontFeatures: const [FontFeature.tabularFigures()])),
        ]),
      ),
    );
  }
}

class _ScenePainter extends CustomPainter {
  _ScenePainter({
    required this.c,
    required this.phase,
    required this.elecOn,
    required this.waterOn,
    required this.dimElec,
    required this.dimWater,
    required this.lines,
  });
  final _Palette c;
  final double phase;
  final bool elecOn, waterOn, dimElec, dimWater;
  final int lines;

  /// Dotted line (dash 2, gap 7 like the SVG), moving along the path while [on].
  void _dotted(Canvas canvas, Path path, Color color, double width, double gap, bool on, bool dim) {
    final paint = Paint()
      ..color = color.withValues(alpha: dim ? 0.25 : 1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round;
    const dash = 2.0;
    final period = dash + gap;
    final shift = on ? phase * period : 0.0;
    for (final m in path.computeMetrics()) {
      for (var d = shift - period; d < m.length; d += period) {
        final a = math.max(0.0, d), b = math.min(m.length, d + dash);
        if (b > a) canvas.drawPath(m.extractPath(a, b), paint);
      }
    }
  }

  Path _poly(List<double> xy, [double dx = 0, double dy = 0]) {
    final p = Path()..moveTo(xy[0] + dx, xy[1] + dy);
    for (var i = 2; i < xy.length; i += 2) {
      p.lineTo(xy[i] + dx, xy[i + 1] + dy);
    }
    return p..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 390);

    _dotted(canvas, Path()..moveTo(76, 60)..cubicTo(76, 100, 118, 104, 140, 140), c.elec, 2.5, 7, elecOn, dimElec);
    _dotted(canvas, Path()..moveTo(314, 60)..cubicTo(314, 110, 292, 124, 274, 166), c.water, 2.5, 7, waterOn, dimWater);
    final appl = [
      Path()..moveTo(150, 228)..cubicTo(150, 240, 80, 236, 70, 246),
      Path()..moveTo(195, 230)..lineTo(195, 246),
      Path()..moveTo(240, 228)..cubicTo(240, 240, 310, 236, 320, 246),
    ];
    for (var i = 0; i < math.min(lines, 3); i++) {
      _dotted(canvas, appl[i], c.elec, 2, 6, elecOn, dimElec);
    }

    canvas.drawOval(Rect.fromCenter(center: const Offset(195, 232), width: 236, height: 24), Paint()..color = c.shadow);

    const dx = 40.0, dy = 55.0;
    Paint fill(Color col, [double o = 1]) => Paint()..color = col.withValues(alpha: o);
    canvas.drawPath(_poly([60, 110, 110, 72, 160, 110, 160, 170, 60, 170], dx, dy), fill(c.front));
    canvas.drawPath(_poly([160, 110, 250, 92, 250, 152, 160, 170], dx, dy), fill(c.side));
    canvas.drawPath(_poly([110, 72, 200, 54, 250, 92, 160, 110], dx, dy), fill(TG.bahr));
    canvas.drawPath(_poly([110, 72, 200, 54, 204, 58, 114, 76], dx, dy), fill(TG.ciel));
    canvas.drawPath(_poly([56, 112, 110, 70, 114, 74, 60, 115], dx, dy), fill(c.eave));
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(98 + dx, 134 + dy, 24, 36), const Radius.circular(2)), fill(c.door));
    final lit = elecOn ? 1.0 : 0.45;
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(129 + dx, 120 + dy, 22, 18), const Radius.circular(2)), fill(c.window, lit));
    canvas.drawPath(_poly([178, 120, 204, 115, 204, 133, 178, 138], dx, dy), fill(TG.sable, lit));
    canvas.drawPath(_poly([216, 112, 238, 108, 238, 126, 216, 130], dx, dy), fill(TG.sable, lit));
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(226 + dx, 134 + dy, 14, 18), const Radius.circular(2)), fill(c.box));
    canvas.drawPath(_poly([234, 137, 230, 144, 233, 144, 231, 150, 236, 142, 233, 142], dx, dy), fill(TG.chams));
  }

  @override
  bool shouldRepaint(_ScenePainter o) =>
      o.phase != phase || o.elecOn != elecOn || o.waterOn != waterOn || o.dimElec != dimElec || o.dimWater != dimWater || o.lines != lines || o.c != c;
}

/// Tiny line chart of the design's two bottom cards.
class Sparkline extends StatelessWidget {
  const Sparkline({super.key, required this.values, required this.color, this.height = 44});
  final List<double> values;
  final Color color;
  final double height;
  @override
  Widget build(BuildContext context) => SizedBox(
        height: height,
        width: double.infinity,
        child: values.where((v) => v.isFinite).length < 2 ? null : CustomPaint(painter: _SparkPainter(values, color)),
      );
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.color);
  final List<double> values;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final pts = values.where((v) => v.isFinite).toList();
    final max = math.max(pts.reduce(math.max), 0.0001);
    final step = size.width / (pts.length - 1);
    final path = Path();
    for (var i = 0; i < pts.length; i++) {
      final x = i * step, y = size.height - 4 - (pts[i] / max) * (size.height - 10);
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_SparkPainter o) => o.values != values || o.color != color;
}

/// Group a per-minute series into ~24 points for a sparkline.
List<double> downsample(List<double> values, [int target = 24]) {
  if (values.length <= target) return values;
  final size = values.length / target;
  return [
    for (var i = 0; i < target; i++)
      () {
        final chunk = values.sublist((i * size).floor(), math.min(values.length, ((i + 1) * size).floor()));
        return chunk.isEmpty ? 0.0 : chunk.reduce((a, b) => a + b) / chunk.length;
      }(),
  ];
}
