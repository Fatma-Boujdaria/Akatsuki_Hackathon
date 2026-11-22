import 'dart:async';
import 'dart:math' as math;

import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/charts.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'settings_screen.dart';
import 'shell.dart';

// "Eau" artboard (frontend/src/pages/Water.tsx).

enum _Period { day, month }

class WaterScreen extends StatefulWidget {
  const WaterScreen({super.key});
  @override
  State<WaterScreen> createState() => _WaterScreenState();
}

class _WaterScreenState extends State<WaterScreen> {
  late final Poll<Series> _today;
  late final Poll<Series> _month;
  Timer? _tick;
  _Period _period = _Period.day;
  bool _acking = false;

  @override
  void initState() {
    super.initState();
    final api = AppScope.read(context).api;
    _today = Poll(() => api.readings('water', from: todayStartIso(), bucket: 'minute'), interval: const Duration(seconds: 15));
    _month = Poll(() => api.readings('water', from: monthStartIso(), bucket: 'day'), interval: const Duration(minutes: 1));
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _today.dispose();
    _month.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    final d = app.dashboard;
    final w = d?.water;
    final live = d?.live?.water;
    final leak = d?.activeAlerts.where((a) => a.type == 'leak').firstOrNull;
    final s = app.settings;
    final stale = d?.live?.stale == true || d?.device?.online != true;
    final now = DateTime.now();
    final ageS = d?.live == null
        ? null
        : d!.live!.ageS + (app.dashboardAt == null ? 0 : now.difference(app.dashboardAt!).inMilliseconds / 1000).clamp(0, 1e9);

    return ListenableBuilder(
      listenable: Listenable.merge([_today, _month]),
      builder: (context, _) {
        final todayL = (_today.data?.points ?? const <SeriesPoint>[]).fold<double>(0, (sum, p) => sum + (p.volumeL ?? 0));
        return PageList(
          onRefresh: () => Future.wait([app.refreshDashboard(), _today.refresh(), _month.refresh()]),
          children: [
            PageHeader(
              title: L('Eau', 'Water', 'الماء'),
              aside: Segmented<_Period>(
                value: _period,
                onChanged: (v) => setState(() => _period = v),
                options: [(_Period.day, L('Jour', 'Day', 'نهار'), null), (_Period.month, L('Mois', 'Month', 'شهر'), null)],
              ),
            ),
            if (leak != null)
              TgBanner(
                tone: BannerTone.broken,
                title: L('Fuite probable', 'Probable leak', 'تسريب محتمل'),
                icon: LucideIcons300.droplet,
                actions: [
                  Btn(L('J\'ai vérifié', 'I checked', 'ثبّتت'),
                      kind: BtnKind.secondary,
                      onPressed: _acking
                          ? null
                          : () async {
                              setState(() => _acking = true);
                              try {
                                await app.api.ackAlert(leak.id);
                                await app.refreshDashboard();
                              } finally {
                                if (mounted) setState(() => _acking = false);
                              }
                            }),
                ],
                child: Text(alertText(leak)),
              ),
            TgCard(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(stale ? L('Dernier débit reçu', 'Last flow received', 'آخر دبي وصل') : L('Débit en direct', 'Live flow', 'الدبي مباشرة'),
                        style: T.small(tg.mute)),
                    if (live != null && !live.reliable)
                      Text(live.fault ? L('Capteur en panne', 'Sensor fault', 'الكابتور معطّل') : L('Mesure peu fiable', 'Unreliable reading', 'قياس موش مضمون'),
                          style: T.h1(tg.harissa).copyWith(height: 40 / 22))
                    else
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(live?.flowLMin != null ? '${num(live!.flowLMin!, decimals: 1)} L/min' : '—',
                            textDirection: TextDirection.ltr, style: T.hero(stale ? tg.mute : tg.waterInk).copyWith(fontSize: 36, height: 40 / 36)),
                      ),
                    Text(
                      ageS != null
                          ? L('Mis à jour il y a ${shortAge(ageS)}', 'Updated ${shortAge(ageS)} ago', 'تحدّث قبل ${shortAge(ageS)}')
                          : L('En attente de mesure', 'Waiting for a reading', 'نستنّاو في القياس'),
                      style: T.caption(tg.mute).copyWith(fontSize: 12),
                    ),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(L('Aujourd\'hui', 'Today', 'اليوم'), style: T.small(tg.mute)),
                  Text(litres(todayL), style: T.h1(tg.ink)),
                ]),
              ]),
            ),
            TgCard(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(children: [
                IconTile(icon: leak != null ? LucideIcons300.droplet : LucideIcons300.shieldCheck, tone: leak != null ? Tone.danger : Tone.success),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(
                      leak != null ? L('Fuite signalée cette nuit', 'Leak reported tonight', 'تسريب الليلة') : L('Aucune fuite détectée', 'No leak detected', 'ما فماش تسريب'),
                      style: T.h3(leak != null ? tg.grenade : tg.ink),
                    ),
                    Text(
                      s != null
                          ? L('Surveillance de ${hh(s.leakStartHour)} à ${hh(s.leakEndHour)}, alerte après ${s.leakMinMinutes} min de débit continu.',
                              'Watched from ${hh(s.leakStartHour)} to ${hh(s.leakEndHour)}, alert after ${s.leakMinMinutes} min of continuous flow.',
                              'مراقبة من ${hh(s.leakStartHour)} لـ ${hh(s.leakEndHour)}، تنبيه بعد ${s.leakMinMinutes} دقيقة دبي متواصل.')
                          : L('La box surveille l\'eau la nuit.', 'The box watches water at night.', 'البواطة تراقب الماء في الليل.'),
                      style: T.small(tg.mute),
                    ),
                  ]),
                ),
              ]),
            ),
            if (_period == _Period.day) ...[
              TgCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CardTitle(L('Litres par heure', 'Litres per hour', 'لترات في الساعة')),
                  _today.data == null ? const Skeleton(height: 110) : HourlyBars(points: _today.data!.points),
                ]),
              ),
              ChartCard(
                title: L('Débit aujourd\'hui', 'Flow today', 'الدبي اليوم'),
                unit: 'L/min',
                child: _today.data == null
                    ? const Skeleton(height: 160)
                    : DayStrip(water: true, series: _today.data, live: live?.flowLMin, liveAt: d?.live?.ts ?? now, height: 160),
              ),
            ] else
              WaterBars(series: _month.data, now: now),
            Row(children: [
              Expanded(child: _Fig(L('Ce mois', 'This month', 'هالشهر'), w != null ? m3(w.monthL / 1000) : '—', tg.ink)),
              const SizedBox(width: 12),
              Expanded(
                  child: _Fig(L('Prévision (estimation)', 'Forecast (estimate)', 'التوقّع (تقدير)'),
                      w?.forecast.qty != null ? m3(w!.forecast.qty! / 1000) : '—', tg.waterInk)),
            ]),
            if (w != null && w.tariffConfigured)
              TgCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CardTitle(L('Facture SONEDE', 'SONEDE bill', 'فاتورة SONEDE'), aside: L('estimation', 'estimate', 'تقدير')),
                  Text('${L('À ce jour', 'So far', 'لتوّا')} : ${w.billToDate != null ? '≈ ${dt(w.billToDate!.totalDt)}' : '—'}', style: T.small(tg.body)),
                  Text('${L('Fin du mois', 'End of month', 'آخر الشهر')} : ${w.forecast.bill != null ? dtRound(w.forecast.bill!.totalDt) : '—'}',
                      style: T.small(tg.waterInk).copyWith(fontWeight: FontWeight.w700)),
                ]),
              )
            else
              TgCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(L('Tranches SONEDE', 'SONEDE tranches', 'شرائح SONEDE'), style: T.h3(tg.ink)),
                  Text(
                    L('Grille pas encore vérifiée : pas de montant ni d\'alerte de tranche eau.', 'Grid not verified yet: no water amount or tranche alert.',
                        'الجدول مازال ما تثبّتش: ما فماش مبلغ ولا تنبيه شريحة.'),
                    style: T.small(tg.mute),
                  ),
                ]),
              ),
            if (live?.totalL != null)
              TgCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CardTitle(L('Compteur YF-S201', 'YF-S201 counter', 'كونتور YF-S201')),
                  Text('${litres(live!.totalL!)} ${L('depuis l\'installation', 'since installation', 'من التركيب')}',
                      style: T.small(tg.ink).copyWith(fontSize: 14, fontWeight: FontWeight.w700)),
                  if (d?.device != null)
                    Text('${num(d!.device!.calibPulsesPerL.toDouble())} ${L('impulsions / L', 'pulses / L', 'نبضة / لتر')}',
                        style: T.caption(tg.mute).copyWith(fontSize: 12)),
                ]),
              ),
            Btn(L('Régler la surveillance des fuites', 'Set up leak watch', 'اضبط مراقبة التسريب'),
                kind: BtnKind.secondary,
                expand: true,
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen()))),
          ],
        );
      },
    );
  }
}

class _Fig extends StatelessWidget {
  const _Fig(this.label, this.value, this.color);
  final String label, value;
  final Color color;
  @override
  Widget build(BuildContext context) => TgCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: T.small(context.tg.mute)),
          FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: T.h1(color))),
        ]),
      );
}

/// "Litres par heure" bars of the design (today, Tunisian hours); always left to right.
class HourlyBars extends StatelessWidget {
  const HourlyBars({super.key, required this.points});
  final List<SeriesPoint> points;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final hours = List<double>.filled(24, 0);
    for (final p in points) {
      hours[tunis(p.ts).hour] += p.volumeL ?? 0;
    }
    final max = math.max(1.0, hours.reduce(math.max));
    final nowH = tunis(DateTime.now()).hour;
    return Semantics(
      label: L('Consommation d\'eau par heure aujourd\'hui', 'Water use per hour today', 'استهلاك الماء في كل ساعة اليوم'),
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Column(children: [
          SizedBox(
            height: 96,
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (var h = 0; h < 24; h++) ...[
                if (h > 0) const SizedBox(width: 3),
                Expanded(
                  child: FractionallySizedBox(
                    heightFactor: hours[h] == 0 ? 0.04 : math.max(0.08, hours[h] / max),
                    alignment: Alignment.bottomCenter,
                    child: Container(
                      decoration: BoxDecoration(
                        color: hours[h] == 0 ? tg.hairline : (h == nowH ? TG.bahr : tg.water),
                        borderRadius: BorderRadius.circular(2),
                        border: h == nowH && hours[h] > 0 ? Border.all(color: tg.water, width: 1.5) : null,
                      ),
                    ),
                  ),
                ),
              ],
            ]),
          ),
          const SizedBox(height: 4),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            for (final l in ['00 h', '06 h', '12 h', '18 h', '24 h']) Text(l, style: T.axis(tg.mute)),
          ]),
        ]),
      ),
    );
  }
}
