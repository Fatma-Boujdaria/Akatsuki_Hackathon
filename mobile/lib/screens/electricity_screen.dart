import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../widgets/charts.dart';
import '../widgets/status.dart';
import '../widgets/tranche_bar.dart';
import '../widgets/ui.dart';
import 'shell.dart';

class ElectricityScreen extends StatefulWidget {
  const ElectricityScreen({super.key});
  @override
  State<ElectricityScreen> createState() => _ElectricityScreenState();
}

class _ElectricityScreenState extends State<ElectricityScreen> {
  late final Poll<Series> _month;
  late final Poll<Series> _today;
  late final Poll<Tariffs> _tariffs;

  @override
  void initState() {
    super.initState();
    final api = AppScope.read(context).api;
    _month = Poll(() => api.readings('electricity', from: monthStartIso(), bucket: 'day'), interval: const Duration(minutes: 1));
    _today = Poll(() => api.readings('electricity', from: todayStartIso(), bucket: 'minute'), interval: const Duration(seconds: 15));
    _tariffs = Poll(api.tariffs);
  }

  @override
  void dispose() {
    _month.dispose();
    _today.dispose();
    _tariffs.dispose();
    super.dispose();
  }

  static IconData _applianceIcon(String label) {
    final l = label.toLowerCase();
    if (l.contains('chauffe-eau') || l.contains('bouilloire')) return LucideIcons300.thermometer;
    if (l.contains('four') || l.contains('radiateur') || l.contains('plaque')) return LucideIcons300.heater;
    if (l.contains('clim')) return LucideIcons300.airVent;
    if (l.contains('machine') || l.contains('lave')) return LucideIcons300.washingMachine;
    return LucideIcons300.plug;
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    final d = app.dashboard;
    final e = d?.electricity;
    final tranche = app.tranche;
    final now = DateTime.now();
    final live = d?.live;
    final L = live?.electricity;

    return ListenableBuilder(
      listenable: Listenable.merge([_month, _today, _tariffs]),
      builder: (context, _) => PageList(
        onRefresh: () => Future.wait([app.refreshDashboard(), _month.refresh(), _today.refresh(), _tariffs.refresh()]),
        children: [
          PageHeader(label: dateLabel(now), title: 'Électricité'),
          // Tranche
          if (e == null || tranche == null)
            const Skeleton(height: 200)
          else
            TgCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Expanded(child: Label('Tranche STEG · ${monthName(now)}')),
                  DevicePill(live: d!.live, device: d.device, compact: true),
                ]),
                const SizedBox(height: 16),
                TrancheBar(view: tranche, nextKwhPrice: e.nextKwhPriceDt, showHeader: true),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 16),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(child: _Stat('Ce mois-ci', kwh(e.monthKwh))),
                  Expanded(child: _Stat('Prochain kWh', e.nextKwhPriceDt != null ? dtUnit(e.nextKwhPriceDt!) : '—')),
                ]),
                const SizedBox(height: 14),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Label('Saut de tranche'),
                  const SizedBox(height: 4),
                  if (e.crossingExtraCostDt != null)
                    Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 6, children: [
                      Text('+${dt(e.crossingExtraCostDt!)}', style: T.h1(tg.ink)),
                      const Padding(padding: EdgeInsets.only(bottom: 4), child: Estimation()),
                    ])
                  else
                    Text('dernière tranche', style: T.small(tg.mute)),
                ]),
              ]),
            ),
          // Bill
          if (e?.billToDate != null) _BillCard(e: e!, kva: d!.subscribedKva),
          MonthChart(series: _month.data, elec: e, view: tranche, now: d?.generatedAt ?? now),
          ChartCard(
            title: 'Puissance aujourd\'hui',
            unit: 'PUISSANCE · W',
            child: _today.data == null
                ? const Skeleton(height: 180)
                : DayStrip(water: false, series: _today.data, live: L?.powerW, liveAt: live?.ts ?? now, height: 180),
          ),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: LiveCard(
                tone: Tone.elec,
                icon: LucideIcons300.zap,
                label: 'Puissance',
                value: L?.powerW != null ? watts(L!.powerW!) : null,
                status: liveStatus(live, water: false),
                live: live,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TgCard(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Label('PZEM-004T'),
                  const SizedBox(height: 8),
                  _Measure('Tension', L?.voltageV != null ? volts(L!.voltageV!) : '—'),
                  _Measure('Courant', L?.currentA != null ? amps(L!.currentA!) : '—'),
                  _Measure('Facteur P.', L?.powerFactor != null ? num(L!.powerFactor!, decimals: 2) : '—'),
                  _Measure('Fréquence', L?.frequencyHz != null ? hertz(L!.frequencyHz!) : '—'),
                ]),
              ),
            ),
          ]),
          // Heavy consumers
          TgCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const CardTitle('Gros consommateurs aujourd\'hui', aside: 'PROBABLE'),
              if (d == null || d.heavyConsumers.isEmpty)
                Text('Aucun gros appareil repéré aujourd\'hui.', style: T.small(tg.mute))
              else
                for (final (i, h) in d.heavyConsumers.indexed) ...[
                  if (i > 0) const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Divider()),
                  Row(children: [
                    IconTile(icon: _applianceIcon(h.label), tone: Tone.neutral),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(h.label, style: T.small(tg.ink).copyWith(fontSize: 15, fontWeight: FontWeight.w500)),
                        Text('${h.startsToday} démarrage${h.startsToday > 1 ? 's' : ''} · dernier à ${time(h.lastSeenAt)}',
                            style: T.label(tg.mute).copyWith(letterSpacing: 0)),
                      ]),
                    ),
                    Text('≈ ${watts(h.typicalW)}', style: T.data(tg.ink)),
                  ]),
                ],
            ]),
          ),
          _TariffCard(tariffs: _tariffs.data, error: _tariffs.error, currentIndex: e?.tranche?.index),
          Center(
            child: Btn('Voir les conseils', kind: BtnKind.ghost, onPressed: () => Shell.of(context).go(3)),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Label(label),
        const SizedBox(height: 4),
        FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: T.h1(context.tg.ink))),
      ]);
}

class _Measure extends StatelessWidget {
  const _Measure(this.k, this.v);
  final String k, v;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(k, style: T.small(context.tg.mute).copyWith(fontSize: 12, height: 1.3)),
          Text(v, style: T.data(context.tg.ink).copyWith(fontSize: 13)),
        ]),
      );
}

class _BillCard extends StatelessWidget {
  const _BillCard({required this.e, required this.kva});
  final ElectricitySummary e;
  final double kva;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final b = e.billToDate!;
    final fb = e.forecast.bill;
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const CardTitle('Facture du mois', aside: 'DT · ESTIMATION'),
        const Label('À ce jour'),
        const SizedBox(height: 6),
        DataRow2('Énergie · ${kwhValue(b.qty)} kWh', dt(b.energyDt)),
        DataRow2('TVA', dt(b.vatDt)),
        DataRow2('Redevance · ${num(kva, decimals: 1, fixed: false)} kVA', dt(b.fixedDt)),
        DataRow2('Taxes', dt(b.taxesDt)),
        const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider()),
        Row(children: [
          Expanded(child: Text('Total à ce jour', style: T.h3(tg.ink))),
          Text('≈ ${dt(b.totalDt)}', style: T.h1(tg.ink).copyWith(fontSize: 22)),
        ]),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: tg.sunken, borderRadius: BorderRadius.circular(kRadiusCtl)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              const Expanded(child: Label('Fin du mois')),
              if (fb != null) ...[Text(dtRound(fb.totalDt), style: T.h1(tg.ink)), const SizedBox(width: 6), const Estimation()]
              else Text('—', style: T.small(tg.mute)),
            ]),
            const SizedBox(height: 4),
            Text(e.forecast.assumption, style: T.small(tg.mute).copyWith(fontSize: 13)),
          ]),
        ),
      ]),
    );
  }
}

class _TariffCard extends StatelessWidget {
  const _TariffCard({required this.tariffs, required this.error, required this.currentIndex});
  final Tariffs? tariffs;
  final String? error;
  final int? currentIndex;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    if (tariffs == null) {
      return error != null
          ? TgBanner(tone: BannerTone.info, child: Text('Grille tarifaire indisponible : $error'))
          : const Skeleton(height: 160);
    }
    final rows = tariffs!.tranches.where((t) => t.resource == 'electricity').toList()
      ..sort((a, b) => a.minQty.compareTo(b.minQty));
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const CardTitle('Grille tarifaire', aside: 'STEG'),
        Row(children: [
          const Expanded(flex: 5, child: Label('Tranche')),
          const Expanded(flex: 4, child: Align(alignment: Alignment.centerRight, child: Label('Prix HT'))),
          const Expanded(flex: 2, child: Align(alignment: Alignment.centerRight, child: Label('TVA'))),
        ]),
        const SizedBox(height: 6),
        for (final (i, r) in rows.indexed)
          Container(
            margin: const EdgeInsets.only(top: 4),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
            decoration: BoxDecoration(
              color: currentIndex == i + 1 ? tg.elecSoft : null,
              borderRadius: BorderRadius.circular(8),
              border: currentIndex == i + 1 ? null : Border(top: BorderSide(color: tg.hairline)),
            ),
            child: Row(children: [
              Expanded(
                flex: 5,
                child: Text(
                  r.maxQty == null
                      ? '> ${num(r.minQty)} kWh'
                      : '${r.minQty == 0 ? 0 : num(r.minQty + 1)}–${num(r.maxQty!)} kWh',
                  style: T.data(currentIndex == i + 1 ? tg.ink : tg.body).copyWith(fontSize: 13),
                ),
              ),
              Expanded(
                flex: 4,
                child: Text(dtUnit(r.priceMillimes / 1000), textAlign: TextAlign.right, style: T.data(tg.ink).copyWith(fontSize: 13)),
              ),
              Expanded(
                flex: 2,
                child: Text('${num(r.vatRate * 100)} %', textAlign: TextAlign.right, style: T.data(tg.body).copyWith(fontSize: 13)),
              ),
            ]),
          ),
        const SizedBox(height: 10),
        Text(
          '${tariffs!.pricingMode == 'progressive' ? 'Chaque tranche de kWh est payée à son propre prix.' : 'La tranche atteinte s\'applique à tous les kWh du mois.'} '
          'Grille STEG basse tension, à vérifier sur une vraie facture.',
          style: T.small(tg.mute).copyWith(fontSize: 13),
        ),
      ]),
    );
  }
}
