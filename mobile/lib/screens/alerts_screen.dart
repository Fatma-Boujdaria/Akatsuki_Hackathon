import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/fields.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';

// "Alertes et conseils" artboard (frontend/src/pages/Alerts.tsx): chips Tout · Alertes ·
// Conseils · Historique; the history lists the notifications of every home.

enum _View { all, alerts, tips, history }

IconData tipIcon(String code) => switch (code) {
      'threshold' || 'keep_pace' => LucideIcons300.trendingUp,
      'leak' => LucideIcons300.droplet,
      'standby' => LucideIcons300.moon,
      'appliance' => LucideIcons300.plug,
      'ac' || 'water_heater' => LucideIcons300.thermometer,
      _ => LucideIcons300.lightbulb,
    };

/// "≈ 9 DT gagnés ce mois · estimation" under a tip.
Widget tipSaving(BuildContext context, Tip t) {
  final tg = context.tg;
  final saving = t.savingDt ?? 0;
  if (saving > 0) {
    return Text.rich(TextSpan(style: T.small(tg.success).copyWith(fontWeight: FontWeight.w700), children: [
      TextSpan(
          text: '≈ ${dt(saving)} ${t.code == 'keep_pace' ? L('de surcoût évité', 'extra cost avoided', 'زيادة تتفادى') : L('gagnés ce mois', 'saved this month', 'توفير هالشهر')} '),
      TextSpan(text: '· ${L('estimation', 'estimate', 'تقدير')}', style: TextStyle(color: tg.mute, fontWeight: FontWeight.w500)),
    ]));
  }
  if (t.code == 'offpeak') {
    return Text(L('Pas d\'économie sur ta facture.', 'No saving on your bill.', 'ما يوفّرش في الفاتورة.'), style: T.small(tg.mute));
  }
  return const SizedBox.shrink();
}

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key, this.showTips = false});
  final bool showTips;
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  late _View _view = widget.showTips ? _View.tips : _View.all;
  late final Poll<List<Tip>> _tips;
  String? _acking;

  @override
  void initState() {
    super.initState();
    _tips = Poll(AppScope.read(context).api.tips, interval: const Duration(seconds: 30));
  }

  @override
  void dispose() {
    _tips.dispose();
    super.dispose();
  }

  Future<void> _ack(Alert a) async {
    final app = AppScope.read(context);
    setState(() => _acking = a.id);
    try {
      await app.api.ackAlert(a.id);
      await app.refreshDashboard();
      await app.refreshHouseholds();
      _tips.refresh();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _acking = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final active = sortAlerts(app.dashboard?.activeAlerts ?? const <Alert>[]);
    return Scaffold(
      body: SafeArea(
        child: ListenableBuilder(
          listenable: _tips,
          builder: (context, _) {
            final tips = _tips.data ?? const <Tip>[];
            return RefreshIndicator(
              onRefresh: () => Future.wait([app.refreshDashboard(), _tips.refresh()]),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(kGutter, 12, kGutter, 40),
                children: [
                  PageHeader(back: true, title: L('Alertes et conseils', 'Alerts and tips', 'التنبيهات والنصائح')),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(children: [
                      TgChip(L('Tout', 'All', 'الكل'), active: _view == _View.all, onTap: () => setState(() => _view = _View.all)),
                      const SizedBox(width: 8),
                      TgChip('${L('Alertes', 'Alerts', 'التنبيهات')} · ${active.length}',
                          active: _view == _View.alerts, onTap: () => setState(() => _view = _View.alerts)),
                      const SizedBox(width: 8),
                      TgChip('${L('Conseils', 'Tips', 'النصائح')} · ${tips.length}',
                          active: _view == _View.tips, onTap: () => setState(() => _view = _View.tips)),
                      const SizedBox(width: 8),
                      TgChip(L('Historique', 'History', 'التاريخ'),
                          active: _view == _View.history, onTap: () => setState(() => _view = _View.history)),
                    ]),
                  ),
                  const SizedBox(height: 14),
                  if (_view == _View.history)
                    const NotificationHistory()
                  else ...[
                    if (_view != _View.tips) ...[
                      if (active.isEmpty)
                        TgCard(
                          child: Row(children: [
                            const IconTile(icon: LucideIcons300.checkCheck, tone: Tone.success),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(L('Aucune alerte en cours. Tout va bien.', 'No active alert. All good.', 'ما فماش تنبيه. كل شي لاباس.'),
                                  style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
                            ),
                          ]),
                        )
                      else
                        for (final a in active) ...[_activeAlert(a), const SizedBox(height: 12)],
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: TextLink(
                          L('Voir l\'historique des notifications', 'See the notification history', 'شوف تاريخ الإشعارات'),
                          bold: true,
                          onTap: () => setState(() => _view = _View.history),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                    if (_view != _View.alerts) ...[
                      if (_tips.data == null)
                        _tips.error != null
                            ? TgBanner(tone: BannerTone.broken, child: Text(_tips.error!))
                            : const Skeleton(height: 160)
                      else if (tips.isEmpty)
                        Text(L('Les conseils arrivent après les premières mesures.', 'Tips come after the first readings.',
                            'النصائح تجي بعد أول القياسات.'), style: T.small(tg.mute))
                      else
                        for (final t in tips) ...[_tipCard(t), const SizedBox(height: 12)],
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text(
                          L('Les économies sont calculées avec les tarifs enregistrés, jamais par l\'IA. Les conseils « profil » se basent sur les appareils que tu as déclarés.',
                              'Savings are computed with the stored tariffs, never by the AI. "Profile" tips are based on the appliances you declared.',
                              'التوفير محسوب بالأسوام المسجّلة، موش بالذكاء الاصطناعي. نصائح البروفيل على حساب الآلات اللي صرّحت بيها.'),
                          style: T.caption(tg.mute).copyWith(fontSize: 12),
                        ),
                      ),
                    ],
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _activeAlert(Alert a) {
    final app = AppScope.read(context);
    final look = alertLook(a, app.tranche);
    return TgBanner(
      tone: look.tone,
      title: look.title,
      icon: look.icon,
      actions: [
        if (a.type == 'threshold') Btn(L('Voir le conseil', 'See the tip', 'شوف النصيحة'), onPressed: () => setState(() => _view = _View.tips)),
        Btn(
          a.type == 'leak' ? L('J\'ai vérifié', 'I checked', 'ثبّتت') : L('Marquer comme lu', 'Mark as read', 'علّم مقري'),
          kind: BtnKind.secondary,
          onPressed: _acking == a.id ? null : () => _ack(a),
        ),
      ],
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(alertText(a)),
        if ((a.extraCostDt ?? 0) > 0)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('${L('Surcoût estimé', 'Estimated extra cost', 'الزيادة المقدّرة')} : ≈ ${dt(a.extraCostDt!)}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Opacity(opacity: 0.8, child: Text(dateTime(a.createdAt), style: const TextStyle(fontSize: 12))),
        ),
      ]),
    );
  }

  Widget _tipCard(Tip t) {
    final tg = context.tg;
    return TgCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(children: [
        IconTile(icon: tipIcon(t.code), tone: Tone.tile),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tipText(t), style: T.small(tg.ink).copyWith(fontSize: 14, height: 1.5, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            tipSaving(context, t),
            if (t.source == 'llm')
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(children: [
                  Icon(LucideIcons300.sparkles, size: 12, color: tg.mute),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(L('reformulé par IA · chiffres calculés', 'worded by AI · figures computed', 'صياغة بالذكاء الاصطناعي · الأرقام محسوبة'),
                        style: T.caption(tg.mute)),
                  ),
                ]),
              ),
          ]),
        ),
      ]),
    );
  }
}

/// Notifications of every home, newest first, with "read" and "mark all as read".
class NotificationHistory extends StatefulWidget {
  const NotificationHistory({super.key});
  @override
  State<NotificationHistory> createState() => _NotificationHistoryState();
}

class _NotificationHistoryState extends State<NotificationHistory> {
  bool _unreadOnly = false;
  String _type = 'all';
  String? _busy;
  Poll<List<AppNotification>>? _list;

  void _load() {
    _list?.dispose();
    final api = AppScope.read(context).api;
    _list = Poll(() => api.notifications(status: _unreadOnly ? 'unread' : 'all', type: _type), interval: const Duration(seconds: 30))
      ..addListener(() => mounted ? setState(() {}) : null);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _list?.dispose();
    super.dispose();
  }

  Future<void> _do(String key, Future<void> Function() f) async {
    final app = AppScope.read(context);
    setState(() => _busy = key);
    try {
      await f();
      await Future.wait([_list!.refresh(), app.refreshDashboard(), app.refreshHouseholds()]);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final app = AppScope.of(context);
    final types = [
      ('all', L('Tous types', 'All types', 'الكل')),
      ('threshold', L('Tranches', 'Tranches', 'الشرائح')),
      ('leak', L('Fuites', 'Leaks', 'التسريبات')),
      ('device_offline', L('Boîtier', 'Box', 'البواطة')),
      ('sensor_fault', L('Capteurs', 'Sensors', 'الكابتورات')),
    ];
    final list = _list!;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          for (final (v, label) in types) ...[
            TgChip(label, active: _type == v, onTap: () => setState(() {
              _type = v;
              _load();
            })),
            const SizedBox(width: 8),
          ],
        ]),
      ),
      const SizedBox(height: 8),
      Wrap(alignment: WrapAlignment.spaceBetween, crossAxisAlignment: WrapCrossAlignment.center, children: [
        CheckboxField(
          label: L('Non lues seulement', 'Unread only', 'غير المقروّة برك'),
          value: _unreadOnly,
          onChanged: (v) => setState(() {
            _unreadOnly = v;
            _load();
          }),
        ),
        Btn(L('Tout marquer comme lu', 'Mark all as read', 'علّم الكل مقري'),
            kind: BtnKind.ghost, icon: LucideIcons300.checkCheck, onPressed: _busy == 'all' ? null : () => _do('all', () => app.api.readAll())),
      ]),
      const SizedBox(height: 8),
      if (list.data == null)
        list.error != null ? TgBanner(tone: BannerTone.broken, child: Text(list.error!)) : const Skeleton(height: 160)
      else if (list.data!.isEmpty)
        TgCard(
          padding: const EdgeInsets.symmetric(vertical: 36),
          child: Column(children: [
            Icon(LucideIcons300.bellOff, size: 28, color: tg.mute),
            const SizedBox(height: 10),
            Text(L('Aucune notification.', 'No notifications.', 'ما فماش إشعارات.'), style: T.small(tg.mute).copyWith(fontSize: 14)),
          ]),
        )
      else
        ListGroup(children: [
          for (final n in list.data!)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: n.acknowledged ? Colors.transparent : TG.chams, shape: BoxShape.circle),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text.rich(TextSpan(children: [
                      TextSpan(
                        text: alertKind(n),
                        style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: n.acknowledged ? FontWeight.w600 : FontWeight.w700),
                      ),
                      if (app.households.length > 1) TextSpan(text: '  · ${n.householdName}', style: T.caption(tg.mute).copyWith(fontSize: 12)),
                    ])),
                    const SizedBox(height: 2),
                    Text(alertText(n), style: T.small(tg.body)),
                    const SizedBox(height: 4),
                    Text(
                      '${dateTime(n.createdAt)} · ${n.acknowledged ? L('lue', 'read', 'مقروّة') : L('non lue', 'unread', 'غير مقروّة')}',
                      style: T.caption(tg.mute).copyWith(fontSize: 12),
                    ),
                  ]),
                ),
                if (!n.acknowledged)
                  IconButton(
                    tooltip: L('Marquer comme lu', 'Mark as read', 'علّم مقري'),
                    onPressed: _busy == n.id ? null : () => _do(n.id, () => app.api.readNotification(n.id)),
                    icon: Icon(LucideIcons300.checkCheck, size: 18, color: tg.link),
                  ),
              ]),
            ),
        ]),
    ]);
  }
}
