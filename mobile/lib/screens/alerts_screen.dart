import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'shell.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  late final Poll<List<Alert>> _alerts;
  late final Poll<List<Tip>> _tips;
  String? _busy;

  @override
  void initState() {
    super.initState();
    final api = AppScope.read(context).api;
    _alerts = Poll(api.alerts, interval: const Duration(seconds: 10));
    _tips = Poll(api.tips, interval: const Duration(seconds: 30));
  }

  @override
  void dispose() {
    _alerts.dispose();
    _tips.dispose();
    super.dispose();
  }

  Future<void> _ack(Alert a) async {
    final app = AppScope.read(context);
    setState(() => _busy = a.id);
    try {
      await app.api.ackAlert(a.id);
      await Future.wait([_alerts.refresh(), app.refreshDashboard()]);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  static IconData _tipIcon(String code) => switch (code) {
        'threshold' || 'keep_pace' => LucideIcons300.trendingUp,
        'leak' => LucideIcons300.droplet,
        'standby' => LucideIcons300.moon,
        'appliance' => LucideIcons300.plug,
        _ => LucideIcons300.lightbulb,
      };

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;

    return ListenableBuilder(
      listenable: Listenable.merge([_alerts, _tips]),
      builder: (context, _) {
        final all = _alerts.data;
        final active = sortAlerts((all ?? const <Alert>[]).where((a) => a.acknowledgedAt == null));
        final past = (all ?? const <Alert>[]).where((a) => a.acknowledgedAt != null).take(20).toList();

        return PageList(
          onRefresh: () => Future.wait([_alerts.refresh(), _tips.refresh()]),
          children: [
            PageHeader(label: dateLabel(DateTime.now()), title: 'Alertes et conseils'),
            Text('En cours', style: T.h2(tg.ink)),
            if (all == null)
              _alerts.error != null
                  ? TgBanner(tone: BannerTone.broken, title: 'Impossible de charger les alertes', child: Text(_alerts.error!))
                  : const Skeleton(height: 110)
            else if (active.isEmpty)
              TgCard(
                child: Row(children: [
                  const IconTile(icon: LucideIcons300.check, tone: Tone.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Rien à signaler', style: T.h3(tg.ink)),
                      Text('Aucune alerte active. Tranche Guard veille.', style: T.small(tg.mute)),
                    ]),
                  ),
                ]),
              )
            else
              for (final a in active)
                Builder(builder: (context) {
                  final look = alertLook(a, app.tranche);
                  return TgBanner(
                    tone: look.tone,
                    title: look.title,
                    icon: look.icon,
                    actions: [Btn('Marquer comme vu', kind: BtnKind.secondary, onPressed: _busy == a.id ? null : () => _ack(a))],
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(a.message),
                      const SizedBox(height: 6),
                      Text(dateTime(a.createdAt), style: T.label(tg.mute).copyWith(letterSpacing: 0)),
                    ]),
                  );
                }),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: Text('Conseils', style: T.h2(tg.ink))),
              const Label('DT · estimation'),
            ]),
            if (_tips.data == null)
              const Skeleton(height: 160)
            else if (_tips.data!.isEmpty)
              Text('Les conseils arrivent après les premières mesures.', style: T.small(tg.mute))
            else
              for (final t in _tips.data!)
                TgCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    IconTile(icon: _tipIcon(t.code), tone: t.code == 'leak' ? Tone.water : Tone.neutral),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(t.text, style: T.body(tg.body)),
                        if ((t.savingDt ?? 0) > 0) ...[
                          const SizedBox(height: 8),
                          Text.rich(TextSpan(children: [
                            TextSpan(
                              text: '${t.code == 'keep_pace' ? 'Surcoût évité' : 'Économie'} ≈ ${dt(t.savingDt!)} ',
                              style: T.small(tg.primary).copyWith(fontWeight: FontWeight.w600),
                            ),
                            TextSpan(text: 'estimation', style: T.small(tg.mute)),
                          ])),
                        ] else if (t.code == 'offpeak') ...[
                          const SizedBox(height: 8),
                          Text('Ne change pas ta facture', style: T.small(tg.mute)),
                        ],
                        if (t.source == 'llm') ...[
                          const SizedBox(height: 6),
                          Row(children: [
                            Icon(LucideIcons300.sparkles, size: 12, color: tg.mute),
                            const SizedBox(width: 4),
                            Text('REFORMULÉ PAR IA · CHIFFRES CALCULÉS', style: T.label(tg.mute).copyWith(fontSize: 10)),
                          ]),
                        ],
                      ]),
                    ),
                  ]),
                ),
            Text('Les économies sont calculées avec la grille tarifaire, jamais inventées. Elles restent des estimations.',
                style: T.small(tg.mute).copyWith(fontSize: 13)),
            const SizedBox(height: 10),
            Text('Historique', style: T.h2(tg.ink)),
            if (past.isEmpty)
              Row(children: [
                Icon(LucideIcons300.bellOff, size: 16, color: tg.mute),
                const SizedBox(width: 8),
                Text('Aucune alerte passée.', style: T.small(tg.mute)),
              ])
            else
              TgCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final (i, a) in past.indexed) ...[
                    if (i > 0) const Divider(),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(alertLook(a).icon, size: 18, color: tg.mute),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Expanded(child: Text(alertKind(a), style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w600, fontSize: 15))),
                              Text(dateTime(a.createdAt), style: T.label(tg.mute).copyWith(letterSpacing: 0)),
                            ]),
                            const SizedBox(height: 2),
                            Text(a.message, style: T.small(tg.body)),
                          ]),
                        ),
                      ]),
                    ),
                  ],
                ]),
              ),
            Center(child: Btn('Retour au tableau de bord', kind: BtnKind.ghost, onPressed: () => Shell.of(context).go(0))),
          ],
        );
      },
    );
  }
}
