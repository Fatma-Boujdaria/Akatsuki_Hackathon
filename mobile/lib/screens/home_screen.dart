import 'dart:async';

import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/charts.dart';
import '../widgets/hero_card.dart';
import '../widgets/logo.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'settings_screen.dart';
import 'shell.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final Poll<Series> _power;
  late final Poll<Series> _water;
  late final Poll<List<Tip>> _tips;
  Timer? _tick;
  String _alertKey = '';
  String? _acking;

  @override
  void initState() {
    super.initState();
    final api = AppScope.read(context).api;
    _power = Poll(() => api.readings('electricity', from: todayStartIso(), bucket: 'minute'), interval: const Duration(seconds: 15));
    _water = Poll(() => api.readings('water', from: todayStartIso(), bucket: 'minute'), interval: const Duration(seconds: 15));
    _tips = Poll(api.tips, interval: const Duration(seconds: 20));
    // "il y a 4 s" keeps counting between two polls.
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _power.dispose();
    _water.dispose();
    _tips.dispose();
    super.dispose();
  }

  Future<void> _ack(Alert a) async {
    final app = AppScope.read(context);
    setState(() => _acking = a.id);
    try {
      await app.api.ackAlert(a.id);
      await app.refreshDashboard();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _acking = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    final d = app.dashboard;
    final now = DateTime.now();
    final header = PageHeader(label: dateLabel(now), title: 'Tableau de bord');

    Future<void> refresh() => Future.wait([app.refreshDashboard(), _power.refresh(), _water.refresh(), _tips.refresh()]);

    if (d == null) {
      return PageList(onRefresh: refresh, children: [
        header,
        if (app.dashboardError != null)
          TgBanner(tone: BannerTone.broken, title: 'Impossible de charger le tableau de bord', child: Text(app.dashboardError!))
        else ...[
          const Skeleton(height: 360),
          const Skeleton(height: 130),
        ],
      ]);
    }

    if (d.empty) {
      return PageList(onRefresh: refresh, children: [
        header,
        TgCard(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
          child: Column(children: [
            const LogoMark(size: 64, state: LogoState.loading),
            const SizedBox(height: 18),
            Text('En attente de la première mesure', textAlign: TextAlign.center, style: T.h2(tg.ink)),
            const SizedBox(height: 8),
            Text(
              'Branche ta box Tranche Guard ou lance le simulateur. Le tableau de bord se remplit dès que la première mesure arrive.',
              textAlign: TextAlign.center,
              style: T.body(tg.body),
            ),
            const SizedBox(height: 20),
            Btn('Contrôle démo',
                kind: BtnKind.secondary,
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen()))),
          ]),
        ),
      ]);
    }

    // Refresh the tips as soon as the set of active alerts changes.
    final key = d.activeAlerts.map((a) => a.id).join(',');
    if (key != _alertKey) {
      _alertKey = key;
      WidgetsBinding.instance.addPostFrameCallback((_) => _tips.refresh());
    }

    final ageS = d.live == null
        ? null
        : d.live!.ageS + (app.dashboardAt == null ? 0 : now.difference(app.dashboardAt!).inMilliseconds / 1000).clamp(0, 1e9);
    final tranche = app.tranche;
    final banners = sortAlerts(d.activeAlerts.where((a) => !app.snoozed.contains(a.id))).take(2);
    final tips = _tips.data ?? const <Tip>[];
    final topTip = tips.where((t) => t.code != 'offpeak').firstOrNull ?? tips.firstOrNull;
    final elecStatus = liveStatus(d.live, water: false);
    final waterStatus = liveStatus(d.live, water: true);

    return ListenableBuilder(
      listenable: Listenable.merge([_power, _water, _tips]),
      builder: (context, _) => PageList(onRefresh: refresh, children: [
        header,
        if (tranche != null) HeroCard(data: d, view: tranche, ageS: ageS),
        for (final a in banners) _banner(context, a),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: LiveCard(
              tone: Tone.elec,
              icon: LucideIcons300.zap,
              label: 'Puissance',
              value: d.live?.electricity.powerW != null ? watts(d.live!.electricity.powerW!) : null,
              status: elecStatus,
              live: d.live,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: LiveCard(
              tone: Tone.water,
              icon: LucideIcons300.droplet,
              label: 'Débit',
              value: d.live?.water.flowLMin != null ? flow(d.live!.water.flowLMin!) : null,
              status: waterStatus,
              live: d.live,
            ),
          ),
        ]),
        if (topTip != null) _TipCard(tip: topTip, onAll: () => Shell.of(context).go(3)),
        DayCharts(
          power: _power.data,
          water: _water.data,
          livePower: d.live?.electricity.powerW,
          liveFlow: d.live?.water.flowLMin,
          liveAt: d.live?.ts ?? d.generatedAt,
        ),
      ]),
    );
  }

  Widget _banner(BuildContext context, Alert a) {
    final app = AppScope.read(context);
    final look = alertLook(a, app.tranche);
    final List<Widget> actions = switch (a.type) {
      'threshold' => [
          Btn('Voir le conseil', onPressed: () => Shell.of(context).go(3)),
          Btn('Plus tard', kind: BtnKind.secondary, onPressed: () => app.snooze(a.id)),
        ],
      'leak' => [
          Btn('Voir l\'eau', onPressed: () => Shell.of(context).go(2)),
          Btn('J\'ai vérifié', kind: BtnKind.secondary, onPressed: _acking == a.id ? null : () => _ack(a)),
        ],
      _ => [
          Btn('Voir l\'appareil',
              kind: BtnKind.secondary,
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen()))),
          Btn('Plus tard', kind: BtnKind.ghost, onPressed: () => app.snooze(a.id)),
        ],
    };
    return TgBanner(tone: look.tone, title: look.title, icon: look.icon, actions: actions, child: Text(a.message));
  }
}

class _TipCard extends StatelessWidget {
  const _TipCard({required this.tip, required this.onAll});
  final Tip tip;
  final VoidCallback onAll;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final saving = tip.savingDt ?? 0;
    return TgCard(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(LucideIcons300.lightbulb, size: 20, color: tg.ink),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Label('Conseil du moment'),
            const SizedBox(height: 6),
            Text(tip.text, style: T.body(tg.body)),
            if (saving > 0) ...[
              const SizedBox(height: 8),
              Text.rich(TextSpan(children: [
                TextSpan(
                  text: '${tip.code == 'keep_pace' ? 'Surcoût évité' : 'Économie'} ≈ ${dt(saving)} ',
                  style: T.small(tg.primary).copyWith(fontWeight: FontWeight.w600),
                ),
                TextSpan(text: 'estimation', style: T.small(tg.mute)),
              ])),
            ],
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Transform.translate(offset: const Offset(-12, 0), child: Btn('Tous les conseils', kind: BtnKind.ghost, onPressed: onAll)),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}
