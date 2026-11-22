import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/appliances.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../widgets/charts.dart';
import '../widgets/ui.dart';
import 'shell.dart';

// "Électricité" artboard (frontend/src/pages/Electricity.tsx).

enum _Period { day, month }

class ElectricityScreen extends StatefulWidget {
  const ElectricityScreen({super.key});
  @override
  State<ElectricityScreen> createState() => _ElectricityScreenState();
}

class _ElectricityScreenState extends State<ElectricityScreen> {
  late final Poll<Series> _month;
  late final Poll<Series> _today;
  late final Poll<Tariffs> _tariffs;
  Timer? _tick;
  _Period _period = _Period.day;

  @override
  void initState() {
    super.initState();
    final api = AppScope.read(context).api;
    _month = Poll(() => api.readings('electricity', from: monthStartIso(), bucket: 'day'), interval: const Duration(minutes: 1));
    _today = Poll(() => api.readings('electricity', from: todayStartIso(), bucket: 'minute'), interval: const Duration(seconds: 15));
    _tariffs = Poll(api.tariffs);
    // "il y a 4 s" keeps counting between two polls.
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _month.dispose();
    _today.dispose();
    _tariffs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    final d = app.dashboard;
    final e = d?.electricity;
    final live = d?.live?.electricity;
    final stale = d?.live?.stale == true || d?.device?.online != true;
    final now = DateTime.now();
    final ageS = d?.live == null
        ? null
        : d!.live!.ageS + (app.dashboardAt == null ? 0 : now.difference(app.dashboardAt!).inMilliseconds / 1000).clamp(0, 1e9);
    final consumers = d?.heavyConsumers ?? const <HeavyConsumer>[];
    final maxW = consumers.fold<double>(1, (m, c) => c.typicalW > m ? c.typicalW : m);
    final profile = app.insights?.breakdown ?? const <ApplianceShare>[];

    return ListenableBuilder(
      listenable: Listenable.merge([_month, _today, _tariffs]),
      builder: (context, _) {
        final todayKwh = (_today.data?.points ?? const <SeriesPoint>[]).fold<double>(0, (s, p) => s + (p.energyKwh ?? 0));
        return PageList(
          onRefresh: () => Future.wait([app.refreshDashboard(), _month.refresh(), _today.refresh(), _tariffs.refresh()]),
          children: [
            PageHeader(
              title: L('Électricité', 'Electricity', 'الضو'),
              aside: Segmented<_Period>(
                value: _period,
                onChanged: (v) => setState(() => _period = v),
                options: [(_Period.day, L('Jour', 'Day', 'نهار'), null), (_Period.month, L('Mois', 'Month', 'شهر'), null)],
              ),
            ),
            // Live power + today
            TgCard(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(stale ? L('Dernière puissance reçue', 'Last power received', 'آخر قوة وصلت') : L('Puissance en direct', 'Live power', 'القوة مباشرة'),
                        style: T.small(tg.mute)),
                    if (live != null && !live.reliable)
                      Text(live.fault ? L('Capteur en panne', 'Sensor fault', 'الكابتور معطّل') : L('Mesure peu fiable', 'Unreliable reading', 'قياس موش مضمون'),
                          style: T.h1(tg.harissa).copyWith(height: 40 / 22))
                    else
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(live?.powerW != null ? '${num(live!.powerW! / 1000, decimals: 2)} kW' : '—',
                            textDirection: TextDirection.ltr, style: T.hero(stale ? tg.mute : tg.elecInk).copyWith(fontSize: 36, height: 40 / 36)),
                      ),
                    Text(
                      ageS != null ? L('Mis à jour il y a ${shortAge(ageS)}', 'Updated ${shortAge(ageS)} ago', 'تحدّث قبل ${shortAge(ageS)}') : L('En attente de mesure', 'Waiting for a reading', 'نستنّاو في القياس'),
                      style: T.caption(tg.mute).copyWith(fontSize: 12),
                    ),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(L('Aujourd\'hui', 'Today', 'اليوم'), style: T.small(tg.mute)),
                  Text(kwh(todayKwh), style: T.h1(tg.ink)),
                  if (e?.nextKwhPriceDt != null) Text('≈ ${dt(todayKwh * e!.nextKwhPriceDt!)}', style: T.caption(tg.mute).copyWith(fontSize: 12)),
                ]),
              ]),
            ),
            if (_period == _Period.day)
              ChartCard(
                title: L('Puissance aujourd\'hui', 'Power today', 'القوة اليوم'),
                unit: 'W',
                child: _today.data == null
                    ? const Skeleton(height: 180)
                    : DayStrip(water: false, series: _today.data, live: live?.powerW, liveAt: d?.live?.ts ?? now, height: 180),
              )
            else
              MonthChart(series: _month.data, elec: e, view: app.tranche, now: d?.generatedAt ?? now),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                CardTitle(L('Tranches STEG', 'STEG tranches', 'شرائح STEG'), aside: L('prix par kWh', 'price per kWh', 'السوم لكل kWh')),
                _TrancheList(tariffs: _tariffs.data, error: _tariffs.error, currentIndex: e?.tranche?.index, used: e?.monthKwh ?? 0),
              ]),
            ),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                CardTitle(L('Facture du mois', 'This month\'s bill', 'فاتورة الشهر'), aside: L('estimation', 'estimate', 'تقدير')),
                if (e?.billToDate == null)
                  const Skeleton(height: 140)
                else ...[
                  _billRows(context, e!.billToDate!, d!.subscribedKva),
                  const SizedBox(height: 12),
                  Divider(color: tg.hairline, height: 1),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: Text(L('Total à ce jour', 'Total so far', 'المجموع لتوّا'), style: T.h3(tg.ink).copyWith(fontSize: 14))),
                    Text('≈ ${dt(e.billToDate!.totalDt)}', style: T.h1(tg.ink).copyWith(fontSize: 20)),
                  ]),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(kRadiusCtl)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Row(children: [
                        Expanded(child: Text(L('Fin du mois', 'End of month', 'آخر الشهر'), style: T.small(tg.mute).copyWith(fontWeight: FontWeight.w700))),
                        Text(e.forecast.bill != null ? dtRound(e.forecast.bill!.totalDt) : '—', style: T.h1(tg.elecInk).copyWith(fontSize: 20)),
                      ]),
                      const SizedBox(height: 4),
                      Text(e.forecast.assumption, style: T.caption(tg.mute).copyWith(fontSize: 12)),
                      if (e.crossingExtraCostDt != null && e.nextThreshold != null)
                        Text(
                          L('Passer ${num(e.nextThreshold!)} kWh : ≈ +${dt(e.crossingExtraCostDt!)}',
                              'Crossing ${num(e.nextThreshold!)} kWh: ≈ +${dt(e.crossingExtraCostDt!)}',
                              'تعدّي ${num(e.nextThreshold!)} kWh: ≈ +${dt(e.crossingExtraCostDt!)}'),
                          style: T.caption(tg.mute).copyWith(fontSize: 12),
                        ),
                    ]),
                  ),
                ],
              ]),
            ),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                CardTitle(L('Gros consommateurs (probables)', 'Heavy consumers (probable)', 'اللي ياكلو برشا (محتمل)'),
                    aside: L('aujourd\'hui', 'today', 'اليوم')),
                if (consumers.isEmpty)
                  Text(L('Aucun gros appareil repéré aujourd\'hui.', 'No large appliance spotted today.', 'ما تلقّاش آلة كبيرة اليوم.'), style: T.small(tg.mute))
                else
                  for (final (i, c) in consumers.indexed)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 5),
                      child: Row(children: [
                        SizedBox(width: 112, child: Text(c.label, overflow: TextOverflow.ellipsis, style: T.small(tg.ink))),
                        const SizedBox(width: 10),
                        Expanded(child: ProgressBar(pct: c.typicalW / maxW * 100, color: [tg.elec, TG.sable, tg.water][i % 3])),
                        const SizedBox(width: 10),
                        Text('${num(c.typicalW / 1000, decimals: 2)} kW', style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w700)),
                      ]),
                    ),
                const SizedBox(height: 10),
                Text(
                  L('Repérés aux sauts de puissance du compteur : un appareil probable, pas une mesure par appareil.',
                      'Spotted from power steps at the meter: a probable appliance, not a per-appliance measurement.',
                      'تلقيناهم من القفزات في القوة: آلة محتملة، موش قياس لكل آلة.'),
                  style: T.caption(tg.mute).copyWith(fontSize: 12),
                ),
              ]),
            ),
            if (profile.isNotEmpty)
              TgCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  CardTitle(L('Répartition d\'après ton profil', 'Split from your profile', 'التقسيم حسب البروفيل'), aside: L('estimation', 'estimate', 'تقدير')),
                  for (final p in profile.take(6))
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(children: [
                        Icon(applianceIcon(p.category), size: 16, color: tg.mute),
                        const SizedBox(width: 10),
                        Expanded(child: Text(p.name, overflow: TextOverflow.ellipsis, style: T.small(tg.ink))),
                        Text('${num(p.sharePct)} %', style: T.small(tg.mute)),
                        if (p.costDt != null)
                          SizedBox(
                            width: 72,
                            child: Text('≈ ${dt(p.costDt!)}', textAlign: TextAlign.end, style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w700)),
                          ),
                      ]),
                    ),
                ]),
              ),
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                CardTitle(L('Mesures PZEM-004T', 'PZEM-004T readings', 'قياسات PZEM-004T')),
                Row(children: [
                  Expanded(child: _Measure(L('Tension', 'Voltage', 'الجهد'), live?.voltageV != null ? volts(live!.voltageV!) : '—')),
                  Expanded(child: _Measure(L('Courant', 'Current', 'التيار'), live?.currentA != null ? amps(live!.currentA!) : '—')),
                ]),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                      child: _Measure(L('Facteur de puiss.', 'Power factor', 'معامل القوة'),
                          live?.powerFactor != null ? num(live!.powerFactor!, decimals: 2) : '—')),
                  Expanded(child: _Measure(L('Fréquence', 'Frequency', 'التردد'), live?.frequencyHz != null ? hertz(live!.frequencyHz!) : '—')),
                ]),
              ]),
            ),
            Center(
              child: Btn(L('Voir les conseils', 'See the tips', 'شوف النصائح'), kind: BtnKind.ghost, onPressed: () => Shell.of(context).openAlerts(tips: true)),
            ),
          ],
        );
      },
    );
  }

  Widget _billRows(BuildContext context, Bill b, double kva) {
    final tg = context.tg;
    final rows = [
      ('${L('Énergie', 'Energy', 'الطاقة')} · ${kwhValue(b.qty)} kWh', b.energyDt),
      (L('TVA', 'VAT', 'TVA'), b.vatDt),
      ('${L('Redevance puissance', 'Power fee', 'معلوم القوة')} · ${num(kva, decimals: 1, fixed: false)} kVA', b.fixedDt),
      (L('Taxes (municipale, transition)', 'Taxes (municipal, transition)', 'الأداءات (البلدية، الانتقال)'), b.taxesDt),
    ];
    return Column(children: [
      for (final (k, v) in rows)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            Expanded(child: Text(k, style: T.small(tg.body))),
            Text(dt(v), style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w700)),
          ]),
        ),
    ]);
  }
}

class _Measure extends StatelessWidget {
  const _Measure(this.k, this.v);
  final String k, v;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(k, style: T.caption(context.tg.mute).copyWith(fontSize: 12)),
        Text(v, style: T.data(context.tg.ink)),
      ]);
}

/// "Tranches STEG · prix par kWh": the current band framed in Chams with its progress.
class _TrancheList extends StatelessWidget {
  const _TrancheList({required this.tariffs, required this.error, required this.currentIndex, required this.used});
  final Tariffs? tariffs;
  final String? error;
  final int? currentIndex;
  final double used;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    if (tariffs == null) return error != null ? Text(error!, style: T.small(tg.grenade)) : const Skeleton(height: 160);
    final rows = tariffs!.tranches.where((t) => t.resource == 'electricity').toList()..sort((a, b) => a.minQty.compareTo(b.minQty));
    final latest = rows.fold<String>('', (a, r) => '${r.j['valid_from'] ?? ''}'.compareTo(a) > 0 ? '${r.j['valid_from']}' : a);
    final band = rows.where((r) => '${r.j['valid_from'] ?? ''}' == latest).toList();
    final mil = L('mil.', 'mill.', 'مليم');
    String label(TrancheRow r) => r.maxQty == null
        ? L('Plus de ${num(r.minQty)} kWh', 'Over ${num(r.minQty)} kWh', 'أكثر من ${num(r.minQty)} kWh')
        : '${r.minQty == 0 ? 0 : num(r.minQty + 1)} – ${num(r.maxQty!)} kWh';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final (i, r) in band.indexed)
        if (currentIndex == i + 1)
          Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(kRadiusChip), border: Border.all(color: TG.chams, width: 1.5)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text('${label(r)} · ${L('actuelle', 'current', 'الحالية')}', style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w700))),
                Text('${r.priceMillimes} $mil', style: T.small(tg.elecInk).copyWith(fontWeight: FontWeight.w700)),
              ]),
              const SizedBox(height: 6),
              ProgressBar(pct: r.maxQty == null ? 100 : (used - r.minQty) / (r.maxQty! - r.minQty) * 100),
            ]),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Row(children: [
              Expanded(child: Text(label(r), style: T.small(tg.body))),
              Text('${r.priceMillimes} $mil', style: T.small(tg.body)),
            ]),
          ),
      const SizedBox(height: 6),
      Text(
        '${tariffs!.pricingMode == 'progressive' ? L('Chaque tranche est payée à son prix.', 'Each tranche is paid at its own price.', 'كل شريحة بسومها.') : L('La tranche atteinte s\'applique à tout le mois.', 'The tranche reached applies to the whole month.', 'الشريحة اللي توصلها تتطبّق على الشهر الكل.')} '
        '${L('Hors TVA et taxes ; à vérifier sur une vraie facture.', 'Before VAT and taxes; to check on a real bill.', 'بلا TVA والأداءات؛ لازم يتثبّت في فاتورة.')}',
        style: T.caption(tg.mute).copyWith(fontSize: 12),
      ),
    ]);
  }
}
