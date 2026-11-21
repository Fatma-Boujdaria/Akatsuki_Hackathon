import 'package:material_ui/material_ui.dart';

import '../theme.dart';

// Flat, hairlined, 44 px to the thumb (charter board 05): no shadows, 1 px
// hairlines, radius 10 for controls, 14 for cards.

enum BtnKind { primary, secondary, ghost }

class Btn extends StatelessWidget {
  const Btn(this.label, {super.key, required this.onPressed, this.kind = BtnKind.primary, this.icon, this.expand = false});

  final String label;
  final VoidCallback? onPressed;
  final BtnKind kind;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final disabled = onPressed == null;
    final (bg, fg, border) = switch (kind) {
      BtnKind.primary => (tg.primary, tg.onPrimary, null),
      BtnKind.secondary => (tg.surface, tg.ink, BorderSide(color: tg.control.withValues(alpha: 0.7))),
      BtnKind.ghost => (Colors.transparent, tg.primary, null),
    };
    final child = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[Icon(icon, size: 18, color: fg), const SizedBox(width: 8)],
        Flexible(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(fontFamily: T.inter, fontWeight: FontWeight.w600, fontSize: 15, height: 1.3, color: fg),
          ),
        ),
      ],
    );
    return Opacity(
      opacity: disabled ? 0.4 : 1, // disabled 40%
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRadiusCtl),
          side: border ?? BorderSide.none,
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          overlayColor: WidgetStatePropertyAll(
            kind == BtnKind.primary ? Colors.black.withValues(alpha: 0.12) : tg.primarySoft,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kTap),
            child: Padding(padding: EdgeInsets.symmetric(horizontal: kind == BtnKind.ghost ? 12 : 20, vertical: 10), child: child),
          ),
        ),
      ),
    );
  }
}

class TgCard extends StatelessWidget {
  const TgCard({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.color, this.dashed = false});

  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  final bool dashed;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final box = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? tg.surface,
        borderRadius: BorderRadius.circular(kRadiusCard),
        border: dashed ? null : Border.all(color: tg.hairline),
      ),
      child: child,
    );
    if (!dashed) return box;
    return CustomPaint(foregroundPainter: _DashedBorder(tg.control, kRadiusCard), child: box);
  }
}

class _DashedBorder extends CustomPainter {
  _DashedBorder(this.color, this.radius);
  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)).deflate(0.5));
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawPath(dashPath(path, 4, 3), paint);
  }

  @override
  bool shouldRepaint(_DashedBorder old) => old.color != color;
}

/// A dashed copy of [source]: [dash] drawn, [gap] skipped.
Path dashPath(Path source, double dash, double gap) {
  final out = Path();
  for (final metric in source.computeMetrics()) {
    var d = 0.0;
    while (d < metric.length) {
      out.addPath(metric.extractPath(d, (d + dash).clamp(0, metric.length)), Offset.zero);
      d += dash + gap;
    }
  }
  return out;
}

/// Mono caps label: PUISSANCE · W
class Label extends StatelessWidget {
  const Label(this.text, {super.key, this.color});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: T.label(color ?? context.tg.mute));
}

class CardTitle extends StatelessWidget {
  const CardTitle(this.title, {super.key, this.aside});
  final String title;
  final String? aside;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(child: Text(title, style: T.h3(context.tg.ink).copyWith(fontSize: 17))),
          if (aside != null) Label(aside!),
        ],
      ),
    );
  }
}

/// "estimation": every DT amount carries it (principle 03).
class Estimation extends StatelessWidget {
  const Estimation({super.key});
  @override
  Widget build(BuildContext context) => Text('estimation', style: T.small(context.tg.mute));
}

enum Tone { elec, water, neutral, primary }

class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, required this.tone, this.size = 36});
  final IconData icon;
  final Tone tone;
  final double size;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final (bg, fg) = switch (tone) {
      Tone.elec => (tg.elecSoft, tg.elecInk),
      Tone.water => (tg.waterSoft, tg.waterInk),
      Tone.neutral => (tg.sunken, tg.ink),
      Tone.primary => (tg.primarySoft, tg.primary),
    };
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(kRadiusCtl)),
      child: Icon(icon, size: size * 0.5, color: fg),
    );
  }
}

/// Page title block: mono context label above a Grotesk display title.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.label, required this.title, this.aside});
  final String label, title;
  final Widget? aside;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Label(label),
                const SizedBox(height: 6),
                Text(title, style: T.display(context.tg.ink)),
              ],
            ),
          ),
          ?aside,
        ],
      ),
    );
  }
}

class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height = 120});
  final double height;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        decoration: BoxDecoration(color: context.tg.sunken, borderRadius: BorderRadius.circular(kRadiusCard)),
      );
}

class Gap extends StatelessWidget {
  const Gap([this.size = 16, Key? key]) : super(key: key);
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size);
}

class Segmented<V> extends StatelessWidget {
  const Segmented({super.key, required this.value, required this.options, required this.onChanged});
  final V value;
  final List<(V, String, IconData)> options;
  final ValueChanged<V> onChanged;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: tg.sunken,
        borderRadius: BorderRadius.circular(kRadiusCtl),
        border: Border.all(color: tg.hairline),
      ),
      child: Row(
        children: [
          for (final (v, label, icon) in options)
            Expanded(
              child: Semantics(
                selected: v == value,
                button: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(v),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    height: 40,
                    decoration: BoxDecoration(
                      color: v == value ? tg.surface : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: v == value ? tg.hairline : Colors.transparent),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(icon, size: 16, color: v == value ? tg.ink : tg.mute),
                        const SizedBox(width: 6),
                        Text(label,
                            style: T.small(v == value ? tg.ink : tg.mute).copyWith(fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Key/value row in Mono for measures.
class DataRow2 extends StatelessWidget {
  const DataRow2(this.k, this.v, {super.key});
  final String k, v;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          children: [
            Expanded(child: Text(k, style: T.small(context.tg.body))),
            Text(v, style: T.data(context.tg.ink)),
          ],
        ),
      );
}
