import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/charts.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'settings_screen.dart';
import 'shell.dart';

class WaterScreen extends StatefulWidget {
  const WaterScreen({super.key});
  @override
  State<WaterScreen> createState() => _WaterScreenState();
}

class _WaterScreenState extends State<WaterScreen> {
  late final Poll<Series> _today;
  late final Poll<Series> _month;
  bool _acking = false;

  @override
  void initState() {
    super.initState();
    final api = AppScope.read(context).api;
    _today = Poll(() => api.readings('water', from: todayStartIso(), bucket: 'minute'), interval: const Duration(seconds: 15));
    _month = Poll(() => api.readings('water', from: monthStartIso(), bucket: 'day'), interval: const Duration(minutes: 1));
  }

  @override
  void dispose() {
    _today.dispose();
    _month.dispose();
    super.dispose();
  }

  Future<void> _ack(Alert a) async {
    final app = AppScope.read(context);
    setState(() => _acking = true);
    try {
      await app.api.ackAlert(a.id);
      await app.refreshDashboard();
    } finally {
      if (mounted) setState(() => _acking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    final d = app.dashboard;
    final w = d?.water;
    final s = app.settings;
    final now = DateTime.now();
    final leak = d?.activeAlerts.where((a) => a.type == 'leak').firstOrNull;
    final live = d?.live;

    return ListenableBuilder(
      listenable: Listenable.merge([_today, _month]),
      builder: (context, _) => PageList(
        onRefresh: () => Future.wait([app.refreshDashboard(), _today.refresh(), _month.refresh()]),
        children: [
          PageHeader(label: dateLabel(now), title: 'Eau'),
          if (leak != null)
            TgBanner(
              tone: BannerTone.broken,
              title: 'Fuite probable',
              icon: LucideIcons300.droplet,
              actions: [Btn('J\'ai vérifié', kind: BtnKind.secondary, onPressed: _acking ? null : () => _ack(leak))],
              child: Text(leak.message),
            ),
          if (w == null)
            const Skeleton(height: 220)
          else
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Expanded(child: Label('Eau · ${monthName(now)}')),
                  DevicePill(live: live, device: d!.device, compact: true),
                ]),
                const SizedBox(height: 18),
                Text('Ce mois-ci', style: T.body(tg.body).copyWith(fontSize: 19)),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(litres(w.monthL), style: T.hero(tg.ink)),
                ),
                const SizedBox(height: 6),
                Text('soit ${m3(w.monthL / 1000)}', style: T.body(tg.body)),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 16),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Label('Fin du mois'),
                      const SizedBox(height: 4),
                      Text(
                        w.forecast.available && w.forecast.qty != null ? '≈ ${num(w.forecast.qty!.roundToDouble())} L' : '—',
                        style: T.h1(tg.ink),
                      ),
                    ]),
                  ),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Label('Facture SONEDE'),
                      const SizedBox(height: 4),
                      if (w.tariffConfigured && w.forecast.bill != null) ...[
                        Text(dtRound(w.forecast.bill!.totalDt), style: T.h1(tg.ink)),
                        const Estimation(),
                      ] else
                        Text('grille pas encore saisie', style: T.small(tg.mute)),
                    ]),
                  ),
                ]),
              ]),
            ),
          LiveCard(
            tone: Tone.water,
            icon: LucideIcons300.droplet,
            label: 'Débit',
            value: live?.water.flowLMin != null ? flow(live!.water.flowLMin!) : null,
            status: liveStatus(live, water: true),
            live: live,
          ),
          TgCard(
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              IconTile(icon: leak != null ? LucideIcons300.moon : LucideIcons300.shieldCheck, tone: leak != null ? Tone.neutral : Tone.water),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(leak != null ? 'Surveillance de nuit : fuite signalée' : 'Aucune fuite détectée', style: T.h3(tg.ink)),
                  const SizedBox(height: 4),
                  Text(
                    s != null
                        ? 'Entre ${hh(s.leakStartHour)} et ${hh(s.leakEndHour)}, une eau qui coule sans arrêt pendant '
                            '${s.leakMinMinutes >= 60 ? '${num(s.leakMinMinutes / 60, decimals: 1, fixed: false)} h' : '${s.leakMinMinutes} min'} '
                            'déclenche une alerte.'
                        : 'La box surveille l\'eau la nuit, quand personne ne devrait en utiliser.',
                    style: T.small(tg.body),
                  ),
                  Transform.translate(
                    offset: const Offset(-12, 0),
                    child: Btn('Régler la surveillance',
                        kind: BtnKind.ghost,
                        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen()))),
                  ),
                ]),
              ),
            ]),
          ),
          if (live?.water.totalL != null)
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Label('Compteur YF-S201'),
                const SizedBox(height: 6),
                Text('${litres(live!.water.totalL!)} depuis l\'installation', style: T.data(tg.ink)),
                if (d?.device != null)
                  Text('${num(d!.device!.calibPulsesPerL.toDouble())} impulsions / L', style: T.label(tg.mute).copyWith(letterSpacing: 0)),
              ]),
            ),
          if (w != null && !w.tariffConfigured)
            const TgBanner(
              tone: BannerTone.info,
              child: Text(
                'La grille SONEDE n\'est pas encore saisie : les montants en DT de l\'eau et l\'alerte de tranche d\'eau '
                's\'activeront dès qu\'elle le sera.',
              ),
            ),
          ChartCard(
            title: 'Débit aujourd\'hui',
            unit: 'DÉBIT · L/MIN',
            child: _today.data == null
                ? const Skeleton(height: 180)
                : DayStrip(water: true, series: _today.data, live: live?.water.flowLMin, liveAt: live?.ts ?? now, height: 180),
          ),
          WaterBars(series: _month.data, now: now),
          Center(child: Btn('Alertes et conseils', kind: BtnKind.ghost, onPressed: () => Shell.of(context).go(3))),
        ],
      ),
    );
  }
}
