import 'dart:async';

import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../util/tranche.dart';
import '../widgets/house_scene.dart';
import '../widgets/logo.dart';
import '../widgets/status.dart';
import '../widgets/ui.dart';
import 'alerts_screen.dart';
import 'assistant_screen.dart';
import 'households_screen.dart';
import 'onboarding_screen.dart';
import 'settings_screen.dart';
import 'shell.dart';

// "Accueil" artboard of the design (frontend/src/pages/Home.tsx).

(String, Color, Color) statusLook(TG tg, String status) => switch (status) {
      'attention' => (L('Attention', 'Attention', 'رد بالك'), tg.waterSoft, tg.waterInk),
      'warning' => (L('Avertissement', 'Warning', 'تحذير'), tg.harissaSoft, tg.harissa),
      'critical' => (L('Critique', 'Critical', 'خطير'), tg.grenadeSoft, tg.grenade),
      'unavailable' => (L('Mesure indisponible', 'Reading unavailable', 'القياس موش متوفر'), tg.sunken, tg.mute),
      _ => (L('Normal', 'Normal', 'عادي'), tg.successSoft, tg.success),
    };

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final (label, bg, fg) = statusLook(context.tg, status);
    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: fg, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: T.caption(fg).copyWith(fontSize: 12, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

String? statusMessage(Insights? i, TrancheView? view) {
  if (i == null) return null;
  final r = i.statusReasons.toSet();
  if (r.contains('no_data')) return L('En attente de la première mesure.', 'Waiting for the first reading.', 'نستنّاو في أول قياس.');
  if (r.contains('offline')) {
    return L('Le boîtier ne répond plus : les valeurs affichées sont anciennes.', 'The box is not answering: values shown are old.',
        'البواطة ما تجاوبش: الأرقام قديمة.');
  }
  if (r.contains('unreliable')) {
    return L('Dernière mesure peu fiable : aucune valeur inventée.', 'Last reading unreliable: no made-up value.', 'آخر قياس موش مضمون: ما نخترعو حتى رقم.');
  }
  if (r.contains('leak')) return L('Fuite d\'eau probable : vérifie tes robinets.', 'Probable water leak: check your taps.', 'تسريب ماء محتمل: ثبّت في الروبينيات.');
  if (r.contains('crossed')) return L('Un seuil de tranche est franchi ce mois-ci.', 'A tranche threshold was crossed this month.', 'تعدّيت شريحة هالشهر.');
  if (r.contains('near_threshold') && view?.left != null) {
    final k = kwh(view!.left!);
    return L('Plus que $k avant la tranche suivante.', 'Only $k before the next tranche.', 'باقي كان $k قبل الشريحة الجاية.');
  }
  if (r.contains('forecast_crosses')) {
    return L('À ce rythme, la prévision dépasse le prochain seuil.', 'At this pace, the forecast goes over the next threshold.',
        'بالريتم هذا، التوقع يفوت الشريحة الجاية.');
  }
  if (r.contains('increase') && i.trendPct != null) {
    final t = num(i.trendPct!);
    return L('Consommation en hausse de $t % sur 7 jours.', 'Consumption up $t % over 7 days.', 'الاستهلاك زاد $t % في 7 أيام.');
  }
  return L('Tout est sous contrôle.', 'Everything is under control.', 'كل شي تحت السيطرة.');
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final Poll<Series> _power;
  late final Poll<Series> _water;
  late final Poll<List<Tip>> _tips;
  String _alertKey = '';
  String? _acking;
  SceneFocus _focus = SceneFocus.all;

  @override
  void initState() {
    super.initState();
    final api = AppScope.read(context).api;
    _power = Poll(() => api.readings('electricity', from: todayStartIso(), bucket: 'minute'), interval: const Duration(seconds: 15));
    _water = Poll(() => api.readings('water', from: todayStartIso(), bucket: 'minute'), interval: const Duration(seconds: 15));
    _tips = Poll(api.tips, interval: const Duration(seconds: 20));
  }

  @override
  void dispose() {
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

  void _push(Widget w) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final tg = context.tg;
    final d = app.dashboard;
    Future<void> refresh() =>
        Future.wait([app.refreshDashboard(), app.refreshInsights(), _power.refresh(), _water.refresh(), _tips.refresh()]);

    if (d == null) {
      return PageList(onRefresh: refresh, children: [
        if (app.dashboardError != null)
          TgBanner(
            tone: BannerTone.broken,
            title: L('Impossible de charger le tableau de bord', 'Could not load the dashboard', 'ما نجّمناش نحمّلو الداشبورد'),
            actions: [Btn(L('Réessayer', 'Try again', 'عاود'), icon: LucideIcons300.refreshCw, onPressed: app.refreshDashboard)],
            child: Text(app.dashboardError!),
          )
        else ...[
          const Skeleton(height: 88),
          const Skeleton(height: 290),
          const Skeleton(height: 120),
        ],
      ]);
    }

    final current = app.currentHousehold;
    final onboardingBanner = current != null && !current.onboardingDone
        ? TgBanner(
            tone: BannerTone.info,
            title: L('Termine la configuration de ton foyer', 'Finish setting up your home', 'كمّل إعداد الدار متاعك'),
            actions: [
              Btn(L('Ajouter mes appareils', 'Add my appliances', 'زيد الآلات متاعي'),
                  onPressed: () => _push(const OnboardingScreen(resumeAppliances: true))),
            ],
            child: Text(L('Déclare tes appareils pour des conseils et des prévisions adaptés.',
                'Declare your appliances for tailored tips and forecasts.', 'صرّح بالآلات متاعك باش تاخذ نصائح وتوقعات على قياسك.')),
          )
        : null;

    if (d.empty) {
      return PageList(onRefresh: refresh, children: [
        ?onboardingBanner,
        TgCard(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 44),
          child: Column(children: [
            const LogoMark(size: 64, state: LogoState.loading),
            const SizedBox(height: 20),
            Text(L('En attente de la première mesure', 'Waiting for the first reading', 'نستنّاو في أول قياس'),
                textAlign: TextAlign.center, style: T.h2(tg.ink)),
            const SizedBox(height: 8),
            Text(
              L('Branche ton boîtier Cartheco ou lance le simulateur. Le tableau de bord se remplit dès que la première mesure arrive.',
                  'Plug in your Cartheco box or start the simulator. The dashboard fills in as soon as the first reading arrives.',
                  'ركّب البواطة متاع Cartheco ولا شعّل السيمولاتور. الداشبورد يتعبّى كيف يوصل أول قياس.'),
              textAlign: TextAlign.center,
              style: T.body(tg.body),
            ),
            const SizedBox(height: 22),
            Btn(L('Ajouter un appareil', 'Add a device', 'زيد بواطة'), kind: BtnKind.secondary, onPressed: () => _push(const HouseholdsScreen())),
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

    final e = d.electricity;
    final tranche = app.tranche;
    final insights = app.insights;
    final live = d.live;
    final unreliable = live != null && (!live.electricity.reliable || !live.water.reliable);
    final bill = e.forecast.available && e.forecast.bill != null ? e.forecast.bill!.totalDt : e.billToDate?.totalDt;
    final banners = sortAlerts(d.activeAlerts.where((a) => !app.snoozed.contains(a.id))).take(2);
    final msg = statusMessage(insights, tranche);

    return ListenableBuilder(
      listenable: Listenable.merge([_power, _water, _tips]),
      builder: (context, _) {
        final tips = _tips.data ?? const <Tip>[];
        final topTip = tips.where((t) => t.code != 'offpeak').firstOrNull ?? tips.firstOrNull;
        double sum(Iterable<double?> v) => v.fold(0, (s, x) => s + (x ?? 0));
        final todayKwh = sum((_power.data?.points ?? const []).map((p) => p.energyKwh));
        final todayL = sum((_water.data?.points ?? const []).map((p) => p.volumeL));
        final powerSpark = downsample([for (final p in _power.data?.points ?? const <SeriesPoint>[]) p.powerW ?? 0]);
        final waterSpark = downsample([for (final p in _water.data?.points ?? const <SeriesPoint>[]) p.flowLMin ?? 0]);

        return PageList(onRefresh: refresh, top: 8, children: [
          ?onboardingBanner,
          _Stats(monthKwh: e.monthKwh, bill: bill, waterL: d.water.monthL),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            child: Row(children: [
              TgChip(L('Vue d\'ensemble', 'Overview', 'نظرة عامة'), active: _focus == SceneFocus.all, onTap: () => setState(() => _focus = SceneFocus.all)),
              const SizedBox(width: 8),
              TgChip(L('Électricité', 'Electricity', 'الضو'),
                  active: _focus == SceneFocus.electricity, onTap: () => setState(() => _focus = SceneFocus.electricity)),
              const SizedBox(width: 8),
              TgChip(L('Eau', 'Water', 'الماء'), active: _focus == SceneFocus.water, onTap: () => setState(() => _focus = SceneFocus.water)),
            ]),
          ),
          HouseScene(
            powerW: live?.electricity.powerW,
            flowLMin: live?.water.flowLMin,
            appliances: insights?.breakdown ?? const [],
            focus: _focus,
            unreliable: unreliable,
            stale: live == null || live.stale || d.device?.online != true,
          ),
          if (_focus != SceneFocus.water && tranche != null) TrancheCard(view: tranche, d: d, insights: insights),
          if (_focus == SceneFocus.electricity) _BillCard(e: e),
          if (_focus == SceneFocus.water) _WaterCard(d: d),
          Row(children: [
            Expanded(
              child: _SparkCard(
                icon: LucideIcons300.zap,
                label: L('Électricité', 'Electricity', 'الضو'),
                value: kwh(todayKwh),
                values: powerSpark,
                iconColor: tg.elecInk,
                color: tg.isDark ? TG.chams : const Color(0xFFE0A000),
                onTap: () => Shell.of(context).go(1),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _SparkCard(
                icon: LucideIcons300.droplet,
                label: L('Eau', 'Water', 'الماء'),
                value: litres(todayL),
                values: waterSpark,
                iconColor: tg.waterInk,
                color: tg.isDark ? TG.ciel : TG.bahr,
                onTap: () => Shell.of(context).go(2),
              ),
            ),
          ]),
          if (msg != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                '$msg · ${L('Mesures du boîtier', 'Box readings', 'قياسات البواطة')}${d.device?.kind == 'simulator' ? ' ${L('(simulées)', '(simulated)', '(محاكاة)')}' : ''}',
                style: T.caption(tg.mute).copyWith(fontSize: 12),
              ),
            ),
          for (final a in banners) _banner(a),
          if (topTip != null) _TipCard(tip: topTip),
          LinkCard(
            icon: LucideIcons300.sparkles,
            tone: Tone.elec,
            title: L('Demande à l\'assistant', 'Ask the assistant', 'اسأل المساعد'),
            sub: L('« Combien vais-je payer ce mois-ci ? »', '"How much will I pay this month?"', '« قداش باش نخلص الشهر هذا؟ »'),
            onTap: () => _push(const AssistantScreen()),
          ),
          LinkCard(
            icon: LucideIcons300.trophy,
            tone: Tone.success,
            title: L('Petit défi, bel impact', 'Small challenge, big impact', 'تحدّي صغير، أثر كبير'),
            sub: L('Ta semaine éco commence ici', 'Your eco week starts here', 'الجمعة الإيكو متاعك تبدا هوني'),
            onTap: () => Shell.of(context).go(3),
          ),
        ]);
      },
    );
  }

  Widget _banner(Alert a) {
    final app = AppScope.read(context);
    final look = alertLook(a, app.tranche);
    final later = L('Plus tard', 'Later', 'من بعد');
    final List<Widget> actions = switch (a.type) {
      'threshold' => [
          Btn(L('Voir le conseil', 'See the tip', 'شوف النصيحة'), onPressed: () => Shell.of(context).openAlerts(tips: true)),
          Btn(later, kind: BtnKind.secondary, onPressed: () => app.snooze(a.id)),
        ],
      'leak' => [
          Btn(L('Voir l\'eau', 'See water', 'شوف الماء'), onPressed: () => Shell.of(context).go(2)),
          Btn(L('J\'ai vérifié', 'I checked', 'ثبّتت'), kind: BtnKind.secondary, onPressed: _acking == a.id ? null : () => _ack(a)),
        ],
      _ => [
          Btn(L('Voir l\'appareil', 'See the device', 'شوف البواطة'), kind: BtnKind.secondary, onPressed: () => _push(const SettingsScreen())),
          Btn(later, kind: BtnKind.ghost, onPressed: () => app.snooze(a.id)),
        ],
    };
    return TgBanner(tone: look.tone, title: look.title, icon: look.icon, actions: actions, child: Text(alertText(a)));
  }
}

/// 168 kWh ce mois | ≈ 58 DT facture estimée | 4,2 m³ eau ce mois
class _Stats extends StatelessWidget {
  const _Stats({required this.monthKwh, required this.bill, required this.waterL});
  final double monthKwh, waterL;
  final double? bill;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    Widget cell(String v, String label, Color c) => Expanded(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(v, textDirection: TextDirection.ltr, style: T.h1(c).copyWith(height: 28 / 22)),
            ),
            Text(label, textAlign: TextAlign.center, style: T.caption(tg.mute).copyWith(fontSize: 12)),
          ]),
        );
    Widget sep() => Container(width: 1, height: 44, color: tg.hairline);
    return Container(
      height: 88,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(color: tg.surface, borderRadius: BorderRadius.circular(kRadiusCard)),
      child: Row(children: [
        cell(kwhValue(monthKwh), L('kWh ce mois', 'kWh this month', 'kWh هالشهر'), tg.ink),
        sep(),
        cell(bill != null ? dtRound(bill!) : '—', L('facture estimée', 'estimated bill', 'الفاتورة المقدّرة'), tg.elecInk),
        sep(),
        cell(m3(waterL / 1000), L('eau ce mois', 'water this month', 'الماء هالشهر'), tg.waterInk),
      ]),
    );
  }
}

/// "Encore 32 kWh avant la tranche suivante" with the bar and its forecast hatching.
class TrancheCard extends StatelessWidget {
  const TrancheCard({super.key, required this.view, required this.d, this.insights});
  final TrancheView view;
  final Dashboard d;
  final Insights? insights;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final near = view.state == TrancheState.near || view.state == TrancheState.crossed;
    final e = d.electricity;
    final title = switch (view.state) {
      TrancheState.top => Text(L('Dernière tranche STEG ce mois-ci', 'Last STEG tranche this month', 'آخر شريحة STEG هالشهر'), style: T.h3(tg.ink)),
      TrancheState.none => Text(L('Grille tarifaire non configurée', 'Tariff grid not configured', 'جدول الأسوام موش معمول'), style: T.h3(tg.ink)),
      _ => Text.rich(TextSpan(style: T.h3(tg.ink), children: [
          if (lang != Lang.en) TextSpan(text: '${L('Encore', '', 'باقي')} '),
          TextSpan(text: kwh(view.left ?? 0), style: TextStyle(color: near ? tg.harissa : tg.elecInk)),
          TextSpan(text: ' ${L('avant la tranche suivante', 'left before the next tranche', 'قبل الشريحة الجاية')}'),
        ])),
    };
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: title),
          if (insights != null) ...[const SizedBox(width: 8), StatusBadge(status: insights!.status)],
        ]),
        const SizedBox(height: 12),
        SizedBox(
          height: 10,
          child: CustomPaint(
            painter: _TrancheBarPainter(view: view, near: near, track: tg.barTrack, fill: near ? TG.chams : tg.bar, mark: tg.canvas),
          ),
        ),
        const SizedBox(height: 10),
        Wrap(alignment: WrapAlignment.spaceBetween, spacing: 12, children: [
          Text(ltr('${kwhValue(view.used)}${view.next != null ? ' / ${num(view.next!)}' : ''} kWh'), style: T.caption(tg.mute).copyWith(fontSize: 12)),
          Text(
            view.forecast != null
                ? '${L('Prévision fin du mois', 'End-of-month forecast', 'التوقع آخر الشهر')} : ${kwh(view.forecast!)}'
                : L('Prévision : pas encore assez de mesures', 'Forecast: not enough readings yet', 'التوقع: مازال ما فماش قياسات كافية'),
            style: T.caption(tg.mute).copyWith(fontSize: 12),
          ),
        ]),
        if (e.nextKwhPriceDt != null) ...[
          const SizedBox(height: 12),
          Divider(color: tg.hairline, height: 1),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: Text(L('Prix du prochain kWh', 'Price of the next kWh', 'سوم الـ kWh الجاي'), style: T.small(tg.mute))),
            Text(dtUnit(e.nextKwhPriceDt!), style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w700)),
          ]),
          if (e.crossingExtraCostDt != null && view.next != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                L('Franchir ${kwh(view.next!)} ajouterait ≈ ${dt(e.crossingExtraCostDt!)} (estimation).',
                    'Crossing ${kwh(view.next!)} would add ≈ ${dt(e.crossingExtraCostDt!)} (estimate).',
                    'كان تتعدّى ${kwh(view.next!)} تزيد ≈ ${dt(e.crossingExtraCostDt!)} (تقدير).'),
                style: T.caption(tg.mute).copyWith(fontSize: 12),
              ),
            ),
        ],
      ]),
    );
  }
}

/// Used part, Chams-hatched forecast part and threshold marks; always left to right.
class _TrancheBarPainter extends CustomPainter {
  _TrancheBarPainter({required this.view, required this.near, required this.track, required this.fill, required this.mark});
  final TrancheView view;
  final bool near;
  final Color track, fill, mark;

  @override
  void paint(Canvas canvas, Size size) {
    double x(double v) => (v / view.scaleMax).clamp(0.0, 1.0) * size.width;
    final r = Radius.circular(size.height / 2);
    final full = RRect.fromRectAndRadius(Offset.zero & size, r);
    canvas.save();
    canvas.clipRRect(full);
    canvas.drawRect(Offset.zero & size, Paint()..color = track);
    final used = x(view.used);
    final fc = view.forecast != null ? x(view.forecast!) : used;
    if (fc > used) {
      canvas.save();
      canvas.clipRect(Rect.fromLTWH(used, 0, fc - used, size.height));
      final p = Paint()
        ..color = TG.chams
        ..strokeWidth = 4;
      for (var s = used - size.height; s < fc + size.height; s += 7) {
        canvas.drawLine(Offset(s, size.height), Offset(s + size.height, 0), p);
      }
      canvas.restore();
    }
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, used, size.height), r), Paint()..color = fill);
    for (final m in view.marks) {
      canvas.drawRect(Rect.fromLTWH(x(m) - 1, 0, 2, size.height), Paint()..color = mark.withValues(alpha: 0.8));
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_TrancheBarPainter o) =>
      o.view.used != view.used || o.view.forecast != view.forecast || o.near != near || o.fill != fill || o.track != track;
}

class _BillCard extends StatelessWidget {
  const _BillCard({required this.e});
  final ElectricitySummary e;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text(L('Facture STEG estimée', 'Estimated STEG bill', 'فاتورة STEG المقدّرة'), style: T.h3(tg.ink))),
          const Estimation(),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: _Fig(L('À ce jour', 'So far', 'لتوّا'), e.billToDate != null ? dt(e.billToDate!.totalDt) : '—', tg.ink)),
          Expanded(child: _Fig(L('Fin du mois', 'End of month', 'آخر الشهر'), e.forecast.bill != null ? dtRound(e.forecast.bill!.totalDt) : '—', tg.elecInk)),
        ]),
        const SizedBox(height: 8),
        Text(
          e.forecast.available
              ? e.forecast.assumption
              : L('Pas encore assez de mesures (1 h minimum).', 'Not enough readings yet (1 h minimum).', 'مازال ما فماش قياسات كافية (ساعة على الأقل).'),
          style: T.caption(tg.mute).copyWith(fontSize: 12),
        ),
      ]),
    );
  }
}

class _WaterCard extends StatelessWidget {
  const _WaterCard({required this.d});
  final Dashboard d;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final w = d.water;
    return TgCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text(L('Eau ce mois', 'Water this month', 'الماء هالشهر'), style: T.h3(tg.ink))),
          Text(
            w.leakSuspected ? L('Fuite probable', 'Probable leak', 'تسريب محتمل') : L('Aucune fuite détectée', 'No leak detected', 'ما فماش تسريب'),
            style: T.caption(w.leakSuspected ? tg.grenade : tg.success).copyWith(fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: _Fig(L('Mesuré', 'Measured', 'مقاس'), m3(w.monthL / 1000), tg.ink)),
          Expanded(child: _Fig(L('Prévision', 'Forecast', 'التوقع'), w.forecast.qty != null ? m3(w.forecast.qty! / 1000) : '—', tg.waterInk)),
        ]),
        if (!w.tariffConfigured) ...[
          const SizedBox(height: 8),
          Text(
            L('Tarifs SONEDE pas encore vérifiés : pas de montant ni d\'alerte de tranche pour l\'eau.',
                'SONEDE prices not verified yet: no amount or tranche alert for water.',
                'أسوام SONEDE مازالت ما تثبّتتش: ما فماش مبلغ ولا تنبيه شريحة للماء.'),
            style: T.caption(tg.mute).copyWith(fontSize: 12),
          ),
        ],
      ]),
    );
  }
}

class _Fig extends StatelessWidget {
  const _Fig(this.label, this.value, this.color);
  final String label, value;
  final Color color;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: T.small(context.tg.mute)),
        Text(value, style: T.h2(color)),
      ]);
}

class _SparkCard extends StatelessWidget {
  const _SparkCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.values,
    required this.iconColor,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label, value;
  final List<double> values;
  final Color iconColor, color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: SizedBox(
        height: 76,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            Icon(icon, size: 14, color: iconColor),
            const SizedBox(width: 4),
            Expanded(child: Text(label, overflow: TextOverflow.ellipsis, style: T.small(tg.mute))),
            Text(value, style: T.small(tg.ink).copyWith(fontWeight: FontWeight.w700)),
          ]),
          Sparkline(values: values, color: color),
        ]),
      ),
    );
  }
}

class _TipCard extends StatelessWidget {
  const _TipCard({required this.tip});
  final Tip tip;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgCard(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const IconTile(icon: LucideIcons300.lightbulb, tone: Tone.tile),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tipText(tip), style: T.small(tg.ink).copyWith(fontSize: 14, height: 1.5, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            tipSaving(context, tip),
            TextLink('${L('Tous les conseils', 'All tips', 'النصائح الكل')} ${isRtl ? '←' : '→'}',
                bold: true, onTap: () => Shell.of(context).openAlerts(tips: true)),
          ]),
        ),
      ]),
    );
  }
}

/// A card that opens another screen (assistant, challenges).
class LinkCard extends StatelessWidget {
  const LinkCard({super.key, required this.icon, required this.tone, required this.title, required this.sub, required this.onTap});
  final IconData icon;
  final Tone tone;
  final String title, sub;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    return TgCard(
      onTap: onTap,
      child: Row(children: [
        IconTile(icon: icon, tone: tone),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: T.h3(tg.ink)),
            Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small(tg.mute)),
          ]),
        ),
        Icon(isRtl ? LucideIcons300.arrowLeft : LucideIcons300.arrowRight, size: 18, color: tg.mute),
      ]),
    );
  }
}

