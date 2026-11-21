import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../theme.dart';

// Foyer, "toit-garde" (charter boards 02 and 11): a Bahr house holding three white
// bars (the STEG tranches) under a detached Chams roof rail. Roof pitch 40°, only
// the base of the house is rounded, the tallest bar stays one bar-width under the roof.

enum LogoState { normal, near, crossed, loading }

const _harissa = Color(0xFFC2401B);

class LogoMark extends StatefulWidget {
  const LogoMark({super.key, this.size = 32, this.state = LogoState.normal, this.reversed = false});

  final double size;

  /// Living logo, app header only: near -> tallest bar Harissa and grows,
  /// crossed -> it breaks through the roof, loading -> bars rise in turn.
  final LogoState state;

  /// On Bahr grounds: the house turns white and the bars Bahr.
  final bool reversed;

  @override
  State<LogoMark> createState() => _LogoMarkState();
}

class _LogoMarkState extends State<LogoMark> with SingleTickerProviderStateMixin {
  AnimationController? _ctrl;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(LogoMark old) {
    super.didUpdateWidget(old);
    _sync();
  }

  void _sync() {
    if (widget.state == LogoState.loading) {
      _ctrl ??= AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();
    } else {
      _ctrl?.dispose();
      _ctrl = null;
    }
  }

  @override
  void dispose() {
    _ctrl?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Off with reduced motion.
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final ctrl = _ctrl;
    Widget paint(double t) => CustomPaint(
          size: Size.square(widget.size),
          painter: _LogoPainter(state: widget.state, reversed: widget.reversed, t: reduce ? -1 : t),
        );
    return Semantics(
      label: 'Tranche Guard',
      image: true,
      child: ctrl == null ? paint(-1) : AnimatedBuilder(animation: ctrl, builder: (_, _) => paint(ctrl.value)),
    );
  }
}

class _LogoPainter extends CustomPainter {
  _LogoPainter({required this.state, required this.reversed, required this.t});

  final LogoState state;
  final bool reversed;
  final double t; // animation phase 0–1, -1 = static

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 64;
    canvas.scale(s);

    final house = reversed ? Colors.white : TG.bahr;
    final bars = reversed ? TG.bahr : Colors.white;

    // Roof rail: the guard, held one gap away from the house
    final roof = Path()
      ..moveTo(8, 30)
      ..lineTo(32, 10)
      ..lineTo(56, 30);
    canvas.drawPath(
      roof,
      Paint()
        ..color = TG.chams
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    // House: pointed top, rounded base corners only
    final body = Path()
      ..moveTo(14, 33)
      ..lineTo(32, 18)
      ..lineTo(50, 33)
      ..lineTo(50, 50)
      ..arcToPoint(const Offset(46, 54), radius: const Radius.circular(4))
      ..lineTo(18, 54)
      ..arcToPoint(const Offset(14, 50), radius: const Radius.circular(4))
      ..close();
    canvas.drawPath(body, Paint()..color = house);

    // Three tranches
    double rise(int i) {
      if (t < 0) return 1;
      final phase = (t - i * 0.16) % 1.0;
      return 0.35 + 0.65 * (0.5 - 0.5 * math.cos(phase * 2 * math.pi));
    }

    void bar(double x, double top, Color c, double k) {
      final h = (50 - top) * k;
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x, 50 - h, 5.5, h), const Radius.circular(1.2)),
        Paint()..color = c,
      );
    }

    final loading = state == LogoState.loading;
    bar(20.5, 42, bars, loading ? rise(0) : 1);
    bar(29.25, 37, bars, loading ? rise(1) : 1);
    final tallTop = switch (state) { LogoState.near => 29.0, LogoState.crossed => 8.0, _ => 32.0 };
    final tallColor = (state == LogoState.near || state == LogoState.crossed) ? _harissa : bars;
    bar(38, tallTop, tallColor, loading ? rise(2) : 1);
  }

  @override
  bool shouldRepaint(_LogoPainter old) => old.state != state || old.t != t || old.reversed != reversed;
}

/// Horizontal lockup: mark + "Tranche Guard" in Grotesk.
class Logo extends StatelessWidget {
  const Logo({super.key, this.size = 30, this.state = LogoState.normal, this.fontSize = 19});

  final double size;
  final LogoState state;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        LogoMark(size: size, state: state),
        const SizedBox(width: 10),
        Text(
          'Tranche Guard',
          style: TextStyle(
            fontFamily: T.grotesk,
            fontWeight: FontWeight.w600,
            fontSize: fontSize,
            letterSpacing: -0.3,
            color: context.tg.ink,
          ),
        ),
      ],
    );
  }
}
