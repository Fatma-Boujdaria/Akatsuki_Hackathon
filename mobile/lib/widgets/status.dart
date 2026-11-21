import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/tranche.dart';
import 'ui.dart';

// ---- Device status pills (board 05) ----------------------------------------------

enum PillTone { live, neutral, headsup, broken }

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, required this.tone, this.icon, this.mono = false});
  final String text;
  final PillTone tone;
  final Widget? icon;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final (bg, fg) = switch (tone) {
      PillTone.live => (tg.primarySoft, tg.primary),
      PillTone.neutral => (tg.sunken, tg.body),
      PillTone.headsup => (tg.harissaSoft, tg.harissa),
      PillTone.broken => (tg.grenadeSoft, tg.grenade),
    };
    final style = mono
        ? T.label(fg).copyWith(letterSpacing: 0.3, fontSize: 12)
        : T.small(fg).copyWith(fontSize: 13, fontWeight: FontWeight.w500);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[IconTheme(data: IconThemeData(color: fg, size: 14), child: icon!), const SizedBox(width: 6)],
          Flexible(child: Text(text, style: style, overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}

class Dot extends StatelessWidget {
  const Dot({super.key, this.size = 8, this.color});
  final double size;
  final Color? color;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color ?? context.tg.primary, shape: BoxShape.circle),
      );
}

/// "● 4 s" / "Ancien · 3 min" / "Appareil hors ligne · vu à 14:02".
class DevicePill extends StatelessWidget {
  const DevicePill({super.key, required this.live, required this.device, this.ageS, this.compact = false});
  final Live? live;
  final DeviceStatus? device;
  final double? ageS;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (live == null || device == null) {
      return const Pill('En attente', tone: PillTone.neutral, icon: Icon(LucideIcons300.clock));
    }
    if (!device!.online) {
      final seen = device!.lastSeenAt != null ? ' · vu à ${time(device!.lastSeenAt!)}' : '';
      return Pill(compact ? 'Hors ligne' : 'Appareil hors ligne$seen',
          tone: PillTone.neutral, icon: const Icon(LucideIcons300.wifiOff));
    }
    final age = ageS ?? live!.ageS;
    if (live!.stale) {
      return Pill('Ancien · ${shortAge(age)}', tone: PillTone.neutral, icon: const Icon(LucideIcons300.clock));
    }
    return Pill(compact ? shortAge(age) : 'En direct · il y a ${shortAge(age)}',
        tone: PillTone.live, mono: true, icon: const Dot(size: 7));
  }
}

// ---- Live cards: normal, stale, fault (board 05) ---------------------------------

enum LiveStatus { ok, stale, unreliable, fault }

LiveStatus liveStatus(Live? live, {required bool water}) {
  if (live == null) return LiveStatus.stale;
  final fault = water ? live.water.fault : live.electricity.fault;
  final reliable = water ? live.water.reliable : live.electricity.reliable;
  if (fault) return LiveStatus.fault;
  if (!reliable) return LiveStatus.unreliable;
  if (live.stale) return LiveStatus.stale;
  return LiveStatus.ok;
}

class LiveCard extends StatelessWidget {
  const LiveCard({
    super.key,
    required this.tone,
    required this.icon,
    required this.label,
    required this.value,
    required this.status,
    required this.live,
  });

  final Tone tone;
  final IconData icon;
  final String label;
  final String? value;
  final LiveStatus status;
  final Live? live;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final problem = status == LiveStatus.unreliable || status == LiveStatus.fault;
    final footer = switch (status) {
      _ when live == null => Text('en attente de mesure', style: T.label(tg.mute).copyWith(letterSpacing: 0)),
      LiveStatus.unreliable || LiveStatus.fault =>
        Text('jamais de valeur inventée', style: T.label(tg.mute).copyWith(letterSpacing: 0)),
      LiveStatus.stale => Text('ancien · ${time(live!.ts)}', style: T.label(tg.mute).copyWith(letterSpacing: 0)),
      LiveStatus.ok => Row(children: [
          const Dot(size: 6),
          const SizedBox(width: 6),
          Text('il y a ${shortAge(live!.ageS)}', style: T.label(tg.mute).copyWith(letterSpacing: 0)),
        ]),
    };
    return TgCard(
      padding: const EdgeInsets.all(16),
      dashed: problem,
      color: status == LiveStatus.stale ? tg.sunken : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            IconTile(icon: icon, tone: status == LiveStatus.stale ? Tone.neutral : tone, size: 32),
            const SizedBox(width: 10),
            Flexible(child: Label(label)),
          ]),
          const SizedBox(height: 12),
          if (problem)
            Text(
              status == LiveStatus.fault ? 'Capteur en panne' : 'Mesure peu fiable',
              style: T.h1(status == LiveStatus.fault ? tg.grenade : tg.harissa).copyWith(fontSize: 20, height: 1.25),
            )
          else
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value ?? '—', style: T.metric(status == LiveStatus.stale ? tg.mute : tg.ink)),
            ),
          const SizedBox(height: 8),
          footer,
        ],
      ),
    );
  }
}

// ---- Alert banners: info, heads-up, broken (board 05) -----------------------------

enum BannerTone { info, headsup, broken }

class TgBanner extends StatelessWidget {
  const TgBanner({super.key, required this.tone, this.title, this.child, this.icon, this.actions});
  final BannerTone tone;
  final String? title;
  final Widget? child;
  final IconData? icon;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final (bg, line, fg, defIcon) = switch (tone) {
      BannerTone.info => (tg.sunken, tg.hairline, tg.ink, LucideIcons300.info),
      BannerTone.headsup => (tg.harissaSoft, tg.harissaLine, tg.harissa, LucideIcons300.triangleAlert),
      BannerTone.broken => (tg.grenadeSoft, tg.grenadeLine, tg.grenade, LucideIcons300.circleAlert),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(kRadiusCard),
        border: Border.all(color: line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon ?? defIcon, size: 20, color: fg)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) Text(title!, style: T.h3(fg).copyWith(fontSize: 17)),
                if (child != null)
                  Padding(
                    padding: EdgeInsets.only(top: title != null ? 4 : 0),
                    child: DefaultTextStyle.merge(style: T.body(tg.body), child: child!),
                  ),
                if (actions != null && actions!.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Wrap(spacing: 10, runSpacing: 10, children: actions!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Principle 02, red means broken: Grenade for leaks and sensor faults, a near
/// tranche is a Harissa heads-up, an offline box is neutral info.
class AlertLook {
  AlertLook(this.tone, this.title, this.icon, this.rank);
  final BannerTone tone;
  final String title;
  final IconData icon;
  final int rank;
}

AlertLook alertLook(Alert a, [TrancheView? tranche]) {
  switch (a.type) {
    case 'leak':
      return AlertLook(BannerTone.broken, 'Fuite probable', LucideIcons300.droplet, 0);
    case 'sensor_fault':
      return AlertLook(BannerTone.broken,
          a.resource == 'water' ? 'Capteur d\'eau en panne' : 'Capteur d\'électricité en panne', LucideIcons300.circleAlert, 1);
    case 'threshold':
      var title = 'Tranche suivante en vue';
      if (a.resource == 'water') {
        title = 'Tranche d\'eau suivante bientôt';
      } else if (tranche != null) {
        if (tranche.state == TrancheState.near) {
          title = 'Tranche suivante bientôt';
        } else if (tranche.crossingDate != null) {
          title = 'Tranche suivante vers le ${dayMonth(tranche.crossingDate!)}';
        } else if (tranche.state == TrancheState.crossed) {
          title = 'Tranche dépassée';
        }
      }
      return AlertLook(BannerTone.headsup, title, LucideIcons300.triangleAlert, 2);
    case 'device_offline':
      return AlertLook(BannerTone.info, 'Appareil hors ligne', LucideIcons300.wifiOff, 3);
    default:
      return AlertLook(BannerTone.info, 'Information', LucideIcons300.info, 4);
  }
}

String alertKind(Alert a) => switch (a.type) {
      'leak' => 'Fuite probable',
      'sensor_fault' => 'Capteur en panne',
      'threshold' => a.resource == 'water' ? 'Tranche d\'eau' : 'Tranche STEG',
      'device_offline' => 'Appareil hors ligne',
      _ => 'Alerte',
    };

List<Alert> sortAlerts(Iterable<Alert> alerts) {
  final l = alerts.toList();
  l.sort((a, b) {
    final r = alertLook(a).rank.compareTo(alertLook(b).rank);
    return r != 0 ? r : b.createdAt.compareTo(a.createdAt);
  });
  return l;
}
