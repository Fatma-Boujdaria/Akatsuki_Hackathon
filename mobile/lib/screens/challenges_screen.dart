import 'dart:math' as math;

import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart' hide Badge;

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart' hide num;
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'shell.dart';

class ChallengesScreen extends StatefulWidget {
  const ChallengesScreen({super.key});
  @override
  State<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends State<ChallengesScreen> {
  late final Poll<Score> _score;

  @override
  void initState() {
    super.initState();
    _score = Poll(AppScope.read(context).api.score, interval: const Duration(minutes: 1));
  }

  @override
  void dispose() {
    _score.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return ListenableBuilder(
      listenable: _score,
      builder: (context, _) {
        final sc = _score.data;
        final header = PageHeader(label: dateLabel(DateTime.now()), title: 'Défis');
        if (sc == null) {
          return PageList(onRefresh: _score.refresh, children: [
            header,
            if (_score.error != null)
              TgBanner(tone: BannerTone.broken, title: 'Impossible de charger les défis', child: Text(_score.error!))
            else ...[
              const Skeleton(height: 180),
              const Skeleton(height: 280),
            ],
          ]);
        }
        final today = sc.today;
        final ch = sc.challenge;
        final rk = sc.ranking;
        final target = (ch['target_kwh'] as num?)?.toDouble();
        final current = (ch['current_kwh'] as num?)?.toDouble() ?? 0;
        final status = ch['status'] as String? ?? 'en_cours';

        return PageList(onRefresh: _score.refresh, children: [
          header,
          TgCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Label('Score du jour'),
              const SizedBox(height: 14),
              if (today == null)
                Text('Le score arrive après la première mesure.', style: T.small(tg.mute))
              else ...[
                Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Text('${today.score}', style: T.hero(tg.ink)),
                  const SizedBox(width: 4),
                  Text('/100', style: T.h1(tg.mute).copyWith(fontSize: 22)),
                ]),
                const SizedBox(height: 8),
                Text(
                  today.budgetKwh != null
                      ? '${kwh(today.kwh)} aujourd\'hui pour un budget de ${kwh(today.budgetKwh!)} par jour.'
                      : '${kwh(today.kwh)} aujourd\'hui.',
                  style: T.body(tg.body),
                ),
                const SizedBox(height: 8),
                Text('Le budget du jour est ce qui garde le mois sous la tranche suivante. Le score ne descend jamais sous 20.',
                    style: T.small(tg.mute)),
              ],
            ]),
          ),
          TgCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const CardTitle('7 derniers jours', aside: 'KWH · SCORE'),
              for (final (i, d) in sc.history.indexed) ...[
                if (i > 0) const Divider(),
                _DayRow(day: d, isToday: d.day == today?.day),
              ],
            ]),
          ),
          TgCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: Text(ch['title'] ?? 'Défi de la semaine', style: T.h2(tg.ink))),
                const SizedBox(width: 8),
                switch (status) {
                  'reussi' => const Pill('Réussi', tone: PillTone.live),
                  'pas_assez_de_donnees' => const Pill('Bientôt', tone: PillTone.neutral),
                  _ => const Pill('En cours', tone: PillTone.neutral),
                },
              ]),
              const SizedBox(height: 8),
              Text(ch['description'] ?? '', style: T.body(tg.body)),
              if (target != null) ...[
                const SizedBox(height: 16),
                _TargetBar(current: current, target: target),
                const SizedBox(height: 6),
                Row(children: [
                  Expanded(child: Text('${kwh(current)} cette semaine', style: T.data(tg.mute).copyWith(fontSize: 13))),
                  Text('objectif < ${kwh(target)}', style: T.data(tg.mute).copyWith(fontSize: 13)),
                ]),
              ],
            ]),
          ),
          TgCard(
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const IconTile(icon: LucideIcons300.users, tone: Tone.primary, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Label('Classement · foyers similaires'),
                  const SizedBox(height: 4),
                  Text('mieux que ${rk['better_than_pct']} %', style: T.h1(tg.ink)),
                  const SizedBox(height: 4),
                  Text(rk['label'] ?? '', style: T.small(tg.body)),
                  if (rk['is_mock'] == true) ...[
                    const SizedBox(height: 6),
                    Text('SIMULATION · ${rk['similar_homes']} FOYERS FICTIFS', style: T.label(tg.mute).copyWith(fontSize: 11)),
                  ],
                ]),
              ),
            ]),
          ),
          TgCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              CardTitle('Badges', aside: '${sc.badges.where((b) => b.earned).length} / ${sc.badges.length} OBTENUS'),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 14,
                crossAxisSpacing: 8,
                childAspectRatio: 0.78,
                children: [for (final b in sc.badges) _BadgeItem(badge: b)],
              ),
            ]),
          ),
        ]);
      },
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({required this.day, required this.isToday});
  final DayScore day;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final budget = day.budgetKwh;
    final max = math.max(math.max(day.kwh, budget ?? 0), 0.1) * 1.1;
    final over = budget != null && day.kwh > budget;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        SizedBox(
          width: 66,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text((isToday ? 'auj.' : weekdayShort(day.date)).toUpperCase(),
                style: T.label(isToday ? tg.ink : tg.mute).copyWith(letterSpacing: 0.4, fontWeight: isToday ? FontWeight.w600 : null)),
            Text(dayMonth(day.date), style: T.label(tg.mute).copyWith(letterSpacing: 0)),
          ]),
        ),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SizedBox(
              height: 18,
              child: LayoutBuilder(builder: (context, c) {
                final w = c.maxWidth;
                return Stack(clipBehavior: Clip.none, alignment: Alignment.centerLeft, children: [
                  Container(height: 10, decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(5))),
                  Container(
                    height: 10,
                    width: math.max(10, w * (day.kwh / max).clamp(0, 1)),
                    decoration: BoxDecoration(
                      color: over ? tg.harissa : tg.elec,
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(color: over ? tg.harissa : tg.elecStroke),
                    ),
                  ),
                  if (budget != null)
                    Positioned(
                      left: w * (budget / max).clamp(0, 1) - 1,
                      top: 0,
                      bottom: 0,
                      child: Container(width: 2, decoration: BoxDecoration(color: tg.ink, borderRadius: BorderRadius.circular(1))),
                    ),
                ]);
              }),
            ),
            const SizedBox(height: 2),
            Text(
              '${kwhValue(day.kwh)} kWh${budget != null ? ' / budget ${kwhValue(budget)}' : ''}${isToday ? ' · en cours' : ''}',
              style: T.label(tg.mute).copyWith(letterSpacing: 0),
            ),
          ]),
        ),
        SizedBox(
          width: 44,
          child: Text('${day.score}', textAlign: TextAlign.right, style: T.h1(over ? tg.harissa : tg.ink).copyWith(fontSize: 20)),
        ),
      ]),
    );
  }
}

/// Weekly challenge: same visual language as the tranche bar (Chams fill, Encre target mark).
class _TargetBar extends StatelessWidget {
  const _TargetBar({required this.current, required this.target});
  final double current, target;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final max = math.max(target, current) * 1.1;
    return SizedBox(
      height: 22,
      child: LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth;
        return Stack(alignment: Alignment.centerLeft, children: [
          Container(height: 14, decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(7))),
          Container(
            height: 14,
            width: math.max(14, w * (current / max).clamp(0, 1)),
            decoration: BoxDecoration(
              color: tg.elec,
              borderRadius: BorderRadius.circular(7),
              border: Border.all(color: tg.elecStroke),
            ),
          ),
          Positioned(
            left: w * (target / max) - 1,
            top: 0,
            bottom: 0,
            child: Container(width: 2, decoration: BoxDecoration(color: tg.ink, borderRadius: BorderRadius.circular(1))),
          ),
        ]);
      }),
    );
  }
}

class _BadgeItem extends StatelessWidget {
  const _BadgeItem({required this.badge});
  final Badge badge;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    // Badges reuse the icons inside a soft circle: earned in colour, locked as a dashed circle.
    final (icon, bg, fg) = switch (badge.code) {
      'premiere_mesure' => (LucideIcons300.activity, tg.primarySoft, tg.primary),
      'journee_sobre' => (LucideIcons300.sun, tg.elecSoft, tg.elecInk),
      'semaine_sobre' => (LucideIcons300.trophy, tg.elecSoft, tg.elecInk),
      'zero_veille' => (LucideIcons300.moon, tg.primarySoft, tg.primary),
      'sous_le_seuil' => (LucideIcons300.award, tg.elecSoft, tg.elecInk),
      'zero_fuite' => (LucideIcons300.droplet, tg.waterSoft, tg.waterInk),
      _ => (LucideIcons300.award, tg.primarySoft, tg.primary),
    };
    return Tooltip(
      message: badge.description,
      triggerMode: TooltipTriggerMode.tap,
      child: Semantics(
        label: '${badge.label}, ${badge.earned ? 'obtenu' : 'à débloquer'}. ${badge.description}',
        excludeSemantics: true,
        child: Column(children: [
          badge.earned
              ? Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
                  child: Icon(icon, size: 22, color: fg),
                )
              : CustomPaint(
                  painter: _DashedCircle(tg.control),
                  child: SizedBox(width: 52, height: 52, child: Icon(LucideIcons300.lock, size: 20, color: tg.mute)),
                ),
          const SizedBox(height: 8),
          Text(
            badge.label,
            textAlign: TextAlign.center,
            maxLines: 2,
            style: T.small(badge.earned ? tg.ink : tg.mute)
                .copyWith(fontSize: 13, height: 1.3, fontWeight: badge.earned ? FontWeight.w600 : FontWeight.w400),
          ),
        ]),
      ),
    );
  }
}

class _DashedCircle extends CustomPainter {
  _DashedCircle(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..addOval(Offset.zero & size);
    canvas.drawPath(
      dashPath(path, 3, 3),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(_DashedCircle old) => old.color != color;
}
