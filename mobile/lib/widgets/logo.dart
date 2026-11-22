import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import '../theme.dart';

// Shield logo of the "App Screens" design (same as frontend/src/components/Logo.tsx):
// four rising bars (Bahr, Ciel, Sable, Chams), the STEG tranches, clipped by a guard's
// shield. Wordmark "Tranche" + "Guard" in the accent colour.

enum LogoState { normal, near, crossed, loading }

class LogoMark extends StatefulWidget {
  const LogoMark({super.key, this.size = 32, this.state = LogoState.normal});

  final double size;

  /// Living logo: near -> the tallest bar pulses, crossed -> it turns red,
  /// loading -> the bars rise in turn.
  final LogoState state;

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
    final animated = widget.state == LogoState.loading || widget.state == LogoState.near;
    if (animated) {
      _ctrl ??= AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();
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
    // Static with reduced motion.
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final grenade = context.tg.grenade;
    final ctrl = _ctrl;
    Widget paint(double t) => CustomPaint(
          size: Size.square(widget.size),
          painter: _LogoPainter(state: widget.state, t: reduce ? -1 : t, grenade: grenade),
        );
    return Semantics(
      label: 'Tranche Guard',
      image: true,
      child: ctrl == null || reduce ? paint(-1) : AnimatedBuilder(animation: ctrl, builder: (_, _) => paint(ctrl.value)),
    );
  }
}

class _LogoPainter extends CustomPainter {
  _LogoPainter({required this.state, required this.t, required this.grenade});

  final LogoState state;
  final double t; // animation phase 0-1, -1 = static
  final Color grenade;

  static final Path _shield = Path()
    ..moveTo(50, 4)
    ..lineTo(90, 18)
    ..lineTo(90, 48)
    ..cubicTo(90, 74, 72, 90, 50, 97)
    ..cubicTo(28, 90, 10, 74, 10, 48)
    ..lineTo(10, 18)
    ..close();

  static const _bars = [(10.0, 62.0, 18.0), (30.0, 46.0, 18.0), (50.0, 30.0, 18.0), (70.0, 0.0, 20.0)];

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 100);
    canvas.clipPath(_shield);
    final colors = [TG.bahr, TG.ciel, TG.sable, state == LogoState.crossed ? grenade : TG.chams];
    for (var i = 0; i < _bars.length; i++) {
      final (x, y, w) = _bars[i];
      var top = y;
      var opacity = 1.0;
      if (t >= 0 && state == LogoState.loading) {
        // Bars rise in turn, 0.15 s apart.
        final phase = (t - i * 0.125) % 1.0;
        final k = 0.35 + 0.65 * (0.5 - 0.5 * math.cos(phase * 2 * math.pi));
        top = 102 - (102 - y) * k;
      } else if (t >= 0 && state == LogoState.near && i == 3) {
        opacity = 0.55 + 0.45 * (0.5 + 0.5 * math.cos(t * 2 * math.pi));
      }
      canvas.drawRect(Rect.fromLTWH(x, top, w, 102 - top), Paint()..color = colors[i].withValues(alpha: opacity));
    }
  }

  @override
  bool shouldRepaint(_LogoPainter old) => old.state != state || old.t != t || old.grenade != grenade;
}

/// "TrancheGuard", always left to right.
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.fontSize = 19});
  final double fontSize;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final style = TextStyle(
      fontFamily: T.sans,
      fontWeight: FontWeight.w800,
      fontSize: fontSize,
      letterSpacing: fontSize >= 28 ? -1 : -0.5,
      height: 1.1,
      color: tg.ink,
    );
    return Text.rich(
      TextSpan(text: 'Tranche', style: style, children: [TextSpan(text: 'Guard', style: style.copyWith(color: tg.brandAccent))]),
      textDirection: TextDirection.ltr,
    );
  }
}

/// Horizontal lockup: mark + wordmark.
class Logo extends StatelessWidget {
  const Logo({super.key, this.size = 30, this.state = LogoState.normal, this.fontSize = 19});

  final double size;
  final LogoState state;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      textDirection: TextDirection.ltr,
      children: [
        LogoMark(size: size, state: state),
        const SizedBox(width: 10),
        Wordmark(fontSize: fontSize),
      ],
    );
  }
}
