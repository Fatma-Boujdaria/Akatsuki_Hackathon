import 'dart:math' as math;

import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart' hide Badge;

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'shell.dart';

// "Défis" artboard (frontend/src/pages/Challenges.tsx): score of the day, last 7 days,
// weekly challenge, ranking among similar homes, badges.

String _scoreWord(int score) => score >= 85
    ? L('Très bonne journée', 'Great day', 'نهار ممتاز')
    : score >= 70
        ? L('Bonne journée', 'Good day', 'نهار باهي')
        : score >= 40
            ? L('Peut mieux faire', 'Could do better', 'تنجم تعمل خير')
            : L('Journée chargée', 'Heavy day', 'نهار ثقيل');

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
        final today = sc?.today;
        return PageList(
          onRefresh: _score.refresh,
          children: [
            PageHeader(label: dateLabel(DateTime.now()), title: L('Défis', 'Challenges', 'التحديات')),
            if (sc == null)
              if (_score.error != null)
                TgBanner(
                  tone: BannerTone.broken,
                  title: L('Impossible de charger les défis', 'Could not load the challenges', 'ما نجّمناش نحمّلو التحديات'),
                  actions: [Btn(L('Réessayer', 'Try again', 'عاود'), icon: LucideIcons300.refreshCw, onPressed: _score.refresh)],
                  child: Text(_score.error!),
                )
              else ...[
                const Skeleton(height: 170),
                const Skeleton(height: 120),
              ]
            else ...[
              TgCard(
                child: today == null
                    ? Text(L('Le score arrive après la première mesure.', 'The score arrives after the first reading.', 'السكور يجي بعد أول قياس.'),
                        style: T.small(tg.mute))
                    : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Row(children: [
                          _ScoreRing(score: today.score),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(L('Score du jour', 'Today\'s score', 'سكور اليوم'), style: T.small(tg.mute)),
                              Text(_scoreWord(today.score), style: T.h2(tg.ink)),
                              const SizedBox(height: 4),
                              Text(
                                today.budgetKwh != null
                                    ? L('${kwh(today.kwh)} aujourd\'hui, budget ${kwh(today.budgetKwh!)} par jour.',
                                        '${kwh(today.kwh)} today, budget ${kwh(today.budgetKwh!)} a day.',
                                        '${kwh(today.kwh)} اليوم، الميزانية ${kwh(today.budgetKwh!)} في النهار.')
                                    : L('${kwh(today.kwh)} aujourd\'hui.', '${kwh(today.kwh)} today.', '${kwh(today.kwh)} اليوم.'),
                                style: T.small(tg.body),
                              ),
                            ]),
                          ),
                        ]),
                        const SizedBox(height: 12),
                        Text(
                          L('Le budget du jour est ce qui garde le mois sous la tranche suivante. Le score ne descend jamais sous 20.',
                              'The daily budget keeps the month under the next tranche. The score never drops below 20.',
                              'ميزانية النهار هي اللي تخلّي الشهر تحت الشريحة الجاية. السكور عمرو ما ينزل تحت 20.'),
                          style: T.small(tg.mute),
                        ),
                      ]),
              ),
              _challenge(sc.weeklyChallenge),
              TgCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CardTitle(L('Badges', 'Badges', 'الشارات'),
                      aside: '${sc.badges.where((b) => b.earned).length} / ${sc.badges.length} ${L('obtenus', 'earned', 'ربحتهم')}'),
                  LayoutBuilder(builder: (context, box) {
                    final w = (box.maxWidth - 2 * 12) / 3;
                    return Wrap(spacing: 12, runSpacing: 18, children: [
                      for (final b in sc.badges) SizedBox(width: w, child: _BadgeItem(badge: b)),
                    ]);
                  }),
                ]),
              ),
              _ranking(sc.rankingInfo),
              TgCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CardTitle(L('7 derniers jours', 'Last 7 days', 'آخر 7 أيام'), aside: 'kWh · score'),
                  for (final (i, d) in sc.history.indexed) ...[
                    if (i > 0) Divider(height: 1, color: tg.hairline),
                    _DayRow(day: d, isToday: d.day == today?.day),
                  ],
                ]),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _challenge(Challenge ch) {
    final tg = context.tg;
    final (label, tone) = switch (ch.status) {
      'reussi' => (L('Réussi pour l\'instant', 'On track so far', 'ماشي مليح لتوّا'), PillTone.success),
      'pas_assez_de_donnees' => (L('Pas encore assez de mesures', 'Not enough readings yet', 'مازال ما فماش قياسات كافية'), PillTone.neutral),
      _ => (L('En cours', 'In progress', 'جاري'), PillTone.neutral),
    };
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(L('Défi de la semaine', 'Weekly challenge', 'تحدّي الجمعة'), style: T.small(tg.mute)),
        const SizedBox(height: 2),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(ch.title, style: T.h2(tg.ink))),
          const SizedBox(width: 8),
          Pill(label, tone: tone),
        ]),
        const SizedBox(height: 6),
        Text(ch.description, style: T.small(tg.body).copyWith(fontSize: 14)),
        if (ch.targetKwh != null) ...[
          const SizedBox(height: 14),
          LayoutBuilder(builder: (context, box) {
            final max = math.max(ch.targetKwh!, ch.currentKwh) * 1.1;
            final w = box.maxWidth;
            return SizedBox(
              height: 22,
              child: Stack(clipBehavior: Clip.none, children: [
                Positioned(
                  left: 0,
                  right: 0,
                  top: 4,
                  child: ProgressBar(pct: ch.currentKwh / max * 100, color: tg.elec, height: 14),
                ),
                PositionedDirectional(
                  start: (ch.targetKwh! / max * w - 1).clamp(0, w - 2),
                  top: 0,
                  child: Container(width: 2, height: 22, decoration: BoxDecoration(color: tg.ink, borderRadius: BorderRadius.circular(1))),
                ),
              ]),
            );
          }),
          const SizedBox(height: 6),
          Row(children: [
            Expanded(child: Text('${kwh(ch.currentKwh)} ${L('cette semaine', 'this week', 'هالجمعة')}', style: T.small(tg.mute))),
            Text('${L('objectif', 'target', 'الهدف')} < ${kwh(ch.targetKwh!)}', style: T.small(tg.mute)),
          ]),
        ],
      ]),
    );
  }

  Widget _ranking(Ranking r) {
    final tg = context.tg;
    return TgCard(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: tg.primarySoft, shape: BoxShape.circle),
          child: Icon(LucideIcons300.users, size: 20, color: tg.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(L('Classement · foyers similaires', 'Ranking · similar homes', 'الترتيب · ديار شبيهة'), style: T.small(tg.mute)),
            Text('${L('mieux que', 'better than', 'خير من')} ${num(r.betterThanPct)} %', style: T.h1(tg.ink)),
            Text(r.label, style: T.small(tg.body)),
            if (r.isMock)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '${L('simulation', 'simulation', 'محاكاة')} · ${r.similarHomes} ${L('foyers fictifs, classement anonyme', 'fictional homes, anonymous ranking', 'ديار وهمية، ترتيب بلا أسامي')}',
                  style: T.caption(tg.mute).copyWith(fontWeight: FontWeight.w600),
                ),
              ),
          ]),
        ),
      ]),
    );
  }
}

/// Score ring of the design (124 px, coloured arc on the card colour).
class _ScoreRing extends StatelessWidget {
  const _ScoreRing({required this.score});
  final int score;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final color = score >= 70 ? tg.success : (score >= 40 ? TG.chams : tg.grenade);
    return Semantics(
      label: L('Score du jour $score sur 100', 'Today\'s score $score out of 100', 'سكور اليوم $score على 100'),
      child: SizedBox.square(
        dimension: 124,
        child: CustomPaint(
          painter: _RingPainter(score / 100, color, tg.hairline),
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('$score', style: T.hero(tg.ink).copyWith(fontSize: 34, height: 36 / 34)),
              Text(L('sur 100', 'out of 100', 'على 100'), style: T.caption(tg.mute).copyWith(fontSize: 12)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.v, this.color, this.track);
  final double v;
  final Color color, track;
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: 52);
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 12
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, 2 * math.pi, false, p..color = track);
    if (v > 0) canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * v.clamp(0, 1), false, p..color = color);
  }

  @override
  bool shouldRepaint(_RingPainter o) => o.v != v || o.color != color || o.track != track;
}

class _BadgeItem extends StatelessWidget {
  const _BadgeItem({required this.badge});
  final Badge badge;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final (icon, bg, fg) = switch (badge.code) {
      'premiere_mesure' => (LucideIcons300.activity, tg.primarySoft, tg.primary),
      'journee_sobre' => (LucideIcons300.sun, tg.elecSoft, tg.elecInk),
      'semaine_sobre' => (LucideIcons300.trophy, tg.elecSoft, tg.elecInk),
      'zero_veille' => (LucideIcons300.moon, tg.primarySoft, tg.primary),
      'sous_le_seuil' => (LucideIcons300.award, tg.elecSoft, tg.elecInk),
      'zero_fuite' => (LucideIcons300.droplet, tg.waterSoft, tg.waterInk),
      _ => (LucideIcons300.award, tg.primarySoft, tg.primary),
    };
    return Semantics(
      label: '${badge.label}, ${badge.earned ? L('obtenu', 'earned', 'ربحتو') : L('à débloquer', 'locked', 'مازال')}',
      excludeSemantics: true,
      child: Tooltip(
        message: badge.description,
        child: Column(children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: badge.earned ? bg : Colors.transparent,
              shape: BoxShape.circle,
              border: badge.earned ? null : Border.all(color: tg.control),
            ),
            child: Icon(badge.earned ? icon : LucideIcons300.lock, size: badge.earned ? 22 : 20, color: badge.earned ? fg : tg.mute),
          ),
          const SizedBox(height: 8),
          Text(badge.label,
              textAlign: TextAlign.center,
              style: T.small(badge.earned ? tg.ink : tg.mute).copyWith(fontSize: 13, fontWeight: badge.earned ? FontWeight.w600 : FontWeight.w500)),
        ]),
      ),
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
          width: 64,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(isToday ? L('auj.', 'today', 'اليوم') : weekdayShort(day.date),
                style: T.caption(isToday ? tg.ink : tg.mute).copyWith(fontSize: 12, fontWeight: isToday ? FontWeight.w700 : FontWeight.w500)),
            Text(dayMonth(day.date), style: T.caption(tg.mute).copyWith(fontSize: 12)),
          ]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            LayoutBuilder(builder: (context, box) {
              return SizedBox(
                height: 18,
                child: Stack(clipBehavior: Clip.none, children: [
                  Positioned(left: 0, right: 0, top: 4, child: ProgressBar(pct: day.kwh / max * 100, color: over ? tg.harissa : tg.elec, height: 10)),
                  if (budget != null)
                    PositionedDirectional(
                      start: (budget / max * box.maxWidth - 1).clamp(0, box.maxWidth - 2),
                      top: 0,
                      child: Container(width: 2, height: 18, color: tg.ink),
                    ),
                ]),
              );
            }),
            const SizedBox(height: 4),
            Text(
              '${kwhValue(day.kwh)} kWh${budget != null ? ' / ${L('budget', 'budget', 'الميزانية')} ${kwhValue(budget)}' : ''}${isToday ? ' · ${L('en cours', 'in progress', 'جاري')}' : ''}',
              style: T.caption(tg.mute).copyWith(fontSize: 12),
            ),
          ]),
        ),
        const SizedBox(width: 12),
        SizedBox(width: 40, child: Text('${day.score}', textAlign: TextAlign.end, style: T.h1(over ? tg.harissa : tg.ink).copyWith(fontSize: 20))),
      ]),
    );
  }
}
