import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../theme.dart';
import '../util/i18n.dart';

// "App Screens" design (DESIGN.md): borderless cards on a navy (or pale blue) ground,
// 20 px corners, pill chips, 44 px touch targets, Plus Jakarta Sans 700-800 for numbers.
// Same components as frontend/src/components/ui.tsx.

enum BtnKind { primary, secondary, ghost, danger }

class Btn extends StatelessWidget {
  const Btn(
    this.label, {
    super.key,
    required this.onPressed,
    this.kind = BtnKind.primary,
    this.icon,
    this.expand = false,
    this.large = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final BtnKind kind;
  final IconData? icon;
  final bool expand;

  /// 56 px main action (login, onboarding).
  final bool large;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final disabled = onPressed == null;
    final (bg, fg) = switch (kind) {
      BtnKind.primary => (tg.primary, tg.onPrimary),
      BtnKind.secondary => (tg.sunken, tg.ink),
      BtnKind.ghost => (Colors.transparent, tg.link),
      BtnKind.danger => (tg.grenadeSoft, tg.grenade),
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
            style: TextStyle(
              fontFamily: T.sans,
              fontWeight: kind == BtnKind.primary ? FontWeight.w800 : FontWeight.w700,
              fontSize: large ? 16 : 15,
              height: 1.3,
              color: fg,
            ),
          ),
        ),
      ],
    );
    return Opacity(
      opacity: disabled ? 0.4 : 1,
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(large ? 16 : kRadiusCtl)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          overlayColor: WidgetStatePropertyAll(
            kind == BtnKind.primary ? Colors.black.withValues(alpha: 0.10) : tg.hairline.withValues(alpha: 0.6),
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: large ? 56 : kTap),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: kind == BtnKind.ghost ? 12 : 20, vertical: 10),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

/// Text link in the link colour (Mot de passe oublié ?, Créer un compte).
class TextLink extends StatelessWidget {
  const TextLink(this.label, {super.key, required this.onTap, this.bold = false});
  final String label;
  final VoidCallback onTap;
  final bool bold;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kTap),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Align(
              widthFactor: 1,
              child: Text(label,
                  style: T.small(context.tg.link).copyWith(
                      fontSize: 14, fontWeight: bold ? FontWeight.w700 : FontWeight.w600)),
            ),
          ),
        ),
      );
}

/// Borderless card: surface on canvas, 20 px corners.
class TgCard extends StatelessWidget {
  const TgCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.color, this.dashed = false, this.onTap});

  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  final bool dashed;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    Widget box = Material(
      color: color ?? tg.surface,
      borderRadius: BorderRadius.circular(kRadiusCard),
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? Padding(padding: padding, child: child) : InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
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
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)).deflate(0.5));
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

/// Small muted label: "kWh ce mois", "Puissance en direct".
class Label extends StatelessWidget {
  const Label(this.text, {super.key, this.color});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) =>
      Text(text, style: T.small(color ?? context.tg.mute).copyWith(height: 18 / 13));
}

/// Card title with an optional small note on the other side.
class CardTitle extends StatelessWidget {
  const CardTitle(this.title, {super.key, this.aside});
  final String title;
  final String? aside;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(child: Text(title, style: T.h3(tg.ink))),
          if (aside != null) Text(aside!, style: T.caption(tg.mute).copyWith(fontSize: 12)),
        ],
      ),
    );
  }
}

/// "estimation": every DT amount carries it.
class Estimation extends StatelessWidget {
  const Estimation({super.key});
  @override
  Widget build(BuildContext context) =>
      Text(L('estimation', 'estimate', 'تقدير'), style: T.caption(context.tg.mute).copyWith(fontSize: 12));
}

enum Tone { elec, water, neutral, primary, tile, success, warning, danger }

(Color, Color) toneColors(TG tg, Tone tone) => switch (tone) {
      Tone.elec => (tg.elecSoft, tg.elecInk),
      Tone.water => (tg.waterSoft, tg.waterInk),
      Tone.neutral => (tg.sunken, tg.ink),
      Tone.primary => (tg.primarySoft, tg.primary),
      Tone.tile => (tg.tile, tg.waterInk),
      Tone.success => (tg.successSoft, tg.success),
      Tone.warning => (tg.harissaSoft, tg.harissa),
      Tone.danger => (tg.grenadeSoft, tg.grenade),
    };

class IconTile extends StatelessWidget {
  const IconTile({super.key, required this.icon, required this.tone, this.size = 44});
  final IconData icon;
  final Tone tone;
  final double size;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = toneColors(context.tg, tone);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(kRadiusCtl)),
      child: Icon(icon, size: size * 0.45, color: fg),
    );
  }
}

/// Round 44 px back button of the design (Alerts, sub-pages). Mirrored in Arabic.
class BackBtn extends StatelessWidget {
  const BackBtn({super.key, this.onPressed});
  final VoidCallback? onPressed;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Semantics(
      button: true,
      label: L('Retour', 'Back', 'رجوع'),
      excludeSemantics: true,
      child: Material(
        color: tg.surface,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed ?? () => Navigator.of(context).maybePop(),
          child: SizedBox.square(
            dimension: kTap,
            child: Icon(isRtl ? LucideIcons300.arrowRight : LucideIcons300.arrowLeft, size: 20, color: tg.ink),
          ),
        ),
      ),
    );
  }
}

/// Page title: 22 px / 800, optional back button and context line, control on the other side.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, this.label, required this.title, this.aside, this.back = false});
  final String? label;
  final String title;
  final Widget? aside;
  final bool back;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          if (back) ...[const BackBtn(), const SizedBox(width: 8)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (label != null) Text(label!, style: T.caption(tg.mute).copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
                Text(title, style: T.display(tg.ink)),
              ],
            ),
          ),
          ?aside,
        ],
      ),
    );
  }
}

/// Pill chip ("Vue d'ensemble · Électricité · Eau", "Tout · Alertes · Conseils").
class TgChip extends StatelessWidget {
  const TgChip(this.label, {super.key, required this.active, required this.onTap, this.icon});
  final String label;
  final bool active;
  final VoidCallback onTap;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final fg = active ? tg.onChipActive : tg.chip;
    return Semantics(
      selected: active,
      button: true,
      child: Material(
        color: active ? tg.chipActive : tg.surface,
        shape: const StadiumBorder(),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          // Sized by its label (no alignment: that would fill a Wrap's whole width).
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 16, color: fg), const SizedBox(width: 6)],
              Text(label,
                  style: T.small(fg).copyWith(fontSize: 14, fontWeight: active ? FontWeight.w700 : FontWeight.w600)),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Two-to-four option switch in a pill track ("Jour | Mois").
class Segmented<V> extends StatelessWidget {
  const Segmented({super.key, required this.value, required this.options, required this.onChanged, this.track});
  final V value;
  final List<(V, String, IconData?)> options;
  final ValueChanged<V> onChanged;

  /// Track colour: surface by default (sunken inside a card).
  final Color? track;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: track ?? tg.surface, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final (v, label, icon) in options)
            Semantics(
              selected: v == value,
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(v),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: v == value ? tg.chipActive : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (icon != null) ...[
                      Icon(icon, size: 15, color: v == value ? tg.onChipActive : tg.chip),
                      const SizedBox(width: 6),
                    ],
                    Text(label,
                        style: T.small(v == value ? tg.onChipActive : tg.chip)
                            .copyWith(fontWeight: v == value ? FontWeight.w700 : FontWeight.w600)),
                  ]),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Section title above a group of rows (Settings design).
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 16, 4, 6),
        child: Text(text, style: T.label(context.tg.mute)),
      );
}

/// A rounded group of 48 px rows separated by hairlines.
class ListGroup extends StatelessWidget {
  const ListGroup({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return Material(
      color: tg.surface,
      borderRadius: BorderRadius.circular(kRadiusCard),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) Divider(height: 1, thickness: 1, color: tg.hairline),
          children[i],
        ],
      ]),
    );
  }
}

class ListRow extends StatelessWidget {
  const ListRow({
    super.key,
    required this.label,
    this.value,
    this.valueWidget,
    this.onTap,
    this.icon,
    this.danger = false,
    this.chevron = true,
  });
  final String label;
  final String? value;
  final Widget? valueWidget;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool danger, chevron;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final row = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(children: [
          if (icon != null) ...[Icon(icon, size: 20, color: danger ? tg.grenade : tg.mute), const SizedBox(width: 12)],
          Expanded(
            child: Text(label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: T.small(danger ? tg.grenade : tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
          ?valueWidget,
          if (value != null) Text(value!, style: T.small(tg.mute)),
          if (onTap != null && chevron && !danger) ...[
            const SizedBox(width: 4),
            Icon(isRtl ? LucideIcons300.chevronLeft : LucideIcons300.chevronRight, size: 18, color: tg.mute),
          ],
        ]),
      ),
    );
    return onTap == null ? row : InkWell(onTap: onTap, child: row);
  }
}

/// Thin progress bar (tranche rows, consumers, challenges). Fills from the start side.
class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.pct, this.color, this.height = 8});
  final double pct;
  final Color? color;
  final double height;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final v = (pct.isNaN ? 0.0 : pct).clamp(0.0, 100.0) / 100;
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        height: height,
        child: Stack(children: [
          Positioned.fill(child: ColoredBox(color: tg.barTrack)),
          FractionallySizedBox(
            alignment: AlignmentDirectional.centerStart,
            widthFactor: v,
            child: DecoratedBox(
              decoration: BoxDecoration(color: color ?? tg.bar, borderRadius: BorderRadius.circular(999)),
              child: const SizedBox.expand(),
            ),
          ),
        ]),
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
        decoration: BoxDecoration(color: context.tg.surface, borderRadius: BorderRadius.circular(kRadiusCard)),
      );
}

class Gap extends StatelessWidget {
  const Gap([this.size = 16, Key? key]) : super(key: key);
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size);
}

/// Key/value row for measures.
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
