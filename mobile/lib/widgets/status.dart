import 'package:lucide_icons_flutter/lucide_icons_300.dart';
import 'package:material_ui/material_ui.dart';

import '../api/models.dart';
import '../theme.dart';
import '../util/format.dart';
import '../util/i18n.dart';
import '../util/tranche.dart';
import 'ui.dart';

// ---- Device status pills ------------------------------------------------------------

enum PillTone { live, neutral, headsup, broken, success }

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, required this.tone, this.icon});
  final String text;
  final PillTone tone;
  final Widget? icon;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final (bg, fg) = switch (tone) {
      PillTone.live => (tg.waterSoft, tg.waterInk),
      PillTone.neutral => (tg.sunken, tg.body),
      PillTone.headsup => (tg.harissaSoft, tg.harissa),
      PillTone.broken => (tg.grenadeSoft, tg.grenade),
      PillTone.success => (tg.successSoft, tg.success),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[IconTheme(data: IconThemeData(color: fg, size: 14), child: icon!), const SizedBox(width: 6)],
          Flexible(
            child: Text(text,
                style: T.small(fg).copyWith(fontSize: 12, fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}

class Dot extends StatelessWidget {
  const Dot({super.key, this.size = 8, this.color});
  final double size;
  final Color? color;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color ?? context.tg.success, shape: BoxShape.circle),
      );
}

/// "● il y a 4 s" / "Ancien · 3 min" / "Appareil hors ligne · vu à 14:02".
class DevicePill extends StatelessWidget {
  const DevicePill({super.key, required this.live, required this.device, this.ageS, this.compact = false});
  final Live? live;
  final DeviceStatus? device;
  final double? ageS;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (live == null || device == null) {
      return Pill(L('En attente', 'Waiting', 'نستنّاو'), tone: PillTone.neutral, icon: const Icon(LucideIcons300.clock));
    }
    if (!device!.online) {
      final seen = device!.lastSeenAt != null ? ' · ${L('vu à', 'seen at', 'آخر مرة')} ${time(device!.lastSeenAt!)}' : '';
      return Pill(
        compact ? L('Hors ligne', 'Offline', 'مقطوع') : '${L('Appareil hors ligne', 'Device offline', 'البواطة مقطوعة')}$seen',
        tone: PillTone.neutral,
        icon: const Icon(LucideIcons300.wifiOff),
      );
    }
    final age = ageS ?? live!.ageS;
    if (live!.stale) {
      return Pill('${L('Ancien', 'Old', 'قديم')} · ${shortAge(age)}', tone: PillTone.neutral, icon: const Icon(LucideIcons300.clock));
    }
    return Pill(compact ? shortAge(age) : '${L('En direct', 'Live', 'مباشر')} · ${ago(age)}', tone: PillTone.success, icon: const Dot(size: 7));
  }
}

// ---- Live cards: normal, stale, fault ------------------------------------------------

enum LiveStatus { ok, stale, unreliable, fault }

LiveStatus liveStatus(Live? live, {required bool water}) {
  if (live == null) return LiveStatus.stale;
  final fault = water ? live.water.fault : live.electricity.fault;
  final reliable = water ? live.water.reliable : live.electricity.reliable;
  if (fault) return LiveStatus.fault;
  if (!reliable) return LiveStatus.unreliable;
  if (live.stale) return LiveStatus.stale;
  return LiveStatus.ok;
}

class LiveCard extends StatelessWidget {
  const LiveCard({
    super.key,
    required this.tone,
    required this.icon,
    required this.label,
    required this.value,
    required this.status,
    required this.live,
  });

  final Tone tone;
  final IconData icon;
  final String label;
  final String? value;
  final LiveStatus status;
  final Live? live;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final problem = status == LiveStatus.unreliable || status == LiveStatus.fault;
    final note = T.caption(tg.mute).copyWith(fontSize: 12);
    final footer = switch (status) {
      _ when live == null => Text(L('en attente de mesure', 'waiting for a reading', 'نستنّاو في قياس'), style: note),
      LiveStatus.unreliable || LiveStatus.fault => Text(L('jamais de valeur inventée', 'never a made-up value', 'عمرنا ما نخترعو رقم'), style: note),
      LiveStatus.stale => Text('${L('ancien', 'old', 'قديم')} · ${time(live!.ts)}', style: note),
      LiveStatus.ok => Row(children: [const Dot(size: 6), const SizedBox(width: 6), Text(ago(live!.ageS), style: note)]),
    };
    return TgCard(
      dashed: problem,
      color: status == LiveStatus.stale ? tg.sunken : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            IconTile(icon: icon, tone: status == LiveStatus.stale ? Tone.neutral : tone, size: 32),
            const SizedBox(width: 10),
            Flexible(child: Label(label)),
          ]),
          const SizedBox(height: 12),
          if (problem)
            Text(
              status == LiveStatus.fault
                  ? L('Capteur en panne', 'Sensor fault', 'كابتور معطّل')
                  : L('Mesure peu fiable', 'Unreliable reading', 'قياس موش مضمون'),
              style: T.h1(status == LiveStatus.fault ? tg.grenade : tg.harissa).copyWith(fontSize: 20, height: 1.25),
            )
          else
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: Text(value ?? '—', style: T.metric(status == LiveStatus.stale ? tg.mute : tg.ink)),
            ),
          const SizedBox(height: 8),
          footer,
        ],
      ),
    );
  }
}

// ---- Alert banners: info, heads-up, broken -------------------------------------------

enum BannerTone { info, headsup, broken, success }

class TgBanner extends StatelessWidget {
  const TgBanner({super.key, required this.tone, this.title, this.child, this.icon, this.actions});
  final BannerTone tone;
  final String? title;
  final Widget? child;
  final IconData? icon;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final tg = context.tg;
    final (bg, line, fg, body, defIcon) = switch (tone) {
      BannerTone.info => (tg.surface, tg.hairline, tg.ink, tg.body, LucideIcons300.info),
      BannerTone.headsup => (tg.harissaSoft, tg.harissaLine, tg.harissa, tg.harissaBody, LucideIcons300.triangleAlert),
      BannerTone.broken => (tg.grenadeSoft, tg.grenadeLine, tg.grenade, tg.body, LucideIcons300.circleAlert),
      BannerTone.success => (tg.successSoft, tg.successSoft, tg.success, tg.body, LucideIcons300.circleCheck),
    };
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(kRadiusCard),
        border: Border.all(color: line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon ?? defIcon, size: 20, color: fg)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) Text(title!, style: T.h3(fg)),
                if (child != null)
                  Padding(
                    padding: EdgeInsets.only(top: title != null ? 4 : 0),
                    child: DefaultTextStyle.merge(style: T.small(body).copyWith(fontSize: 14, height: 1.45), child: child!),
                  ),
                if (actions != null && actions!.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Wrap(spacing: 10, runSpacing: 10, children: actions!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---- Alert and tip texts ----------------------------------------------------------------
// Same rules as frontend/src/components/alerts.tsx. Red means broken (leaks, sensor
// faults); a near or crossed tranche is a heads-up; an offline box is neutral info.
// Texts come in three languages, rebuilt from the numbers stored with each alert (params).

/// A param as a number (ints, doubles or numeric strings).
double _dbl(Object? v) => v is int ? v.toDouble() : v is double ? v : double.tryParse('${v ?? ''}') ?? 0;
String _n(Object? v, [int d = 0]) => num(_dbl(v), decimals: d, fixed: false);
String _unit(Json p) => p['unit'] == 'm3' ? 'm³' : 'kWh';

String alertTitle(Alert a) {
  switch (a.type) {
    case 'leak':
      return L('Fuite probable', 'Probable leak', 'تسريب ماء محتمل');
    case 'sensor_fault':
      return a.resource == 'water'
          ? L('Capteur d\'eau en panne', 'Water sensor fault', 'الكابتور متاع الماء معطّل')
          : L('Capteur d\'électricité en panne', 'Electricity sensor fault', 'الكابتور متاع الضو معطّل');
    case 'threshold':
      final p = a.params;
      if (p['threshold'] != null && p['left'] != null && p['variant'] == 'near') {
        final left = _dbl(p['left']);
        final u = _unit(p);
        final l = _n(p['left'], left < 10 ? 1 : 0);
        return L('Tranche ${_n(p['threshold'])} $u dans $l $u', '${_n(p['threshold'])} $u tranche in $l $u',
            'شريحة ${_n(p['threshold'])} $u بعد $l $u');
      }
      return a.resource == 'water'
          ? L('Tranche d\'eau suivante en vue', 'Next water tranche ahead', 'الشريحة الجاية متاع الماء قريبة')
          : L('Tranche suivante en vue', 'Next tranche ahead', 'الشريحة الجاية قريبة');
    case 'device_offline':
      return L('Appareil hors ligne', 'Device offline', 'البواطة مقطوعة');
    default:
      return L('Information', 'Information', 'معلومة');
  }
}

/// Alert body in the current language (French keeps the backend's text).
String alertText(Alert a) {
  final p = a.params;
  if (lang == Lang.fr || p.isEmpty) return a.message;
  switch (a.type) {
    case 'threshold':
      final u = _unit(p);
      final extra = dt(_dbl(p['extra_dt'] ?? a.extraCostDt));
      if (p['variant'] == 'near') {
        return L(
          a.message,
          '${_n(p['left'], 1)} $u left before the next tranche (${_n(p['threshold'])} $u). Crossing it would add about $extra to this month\'s bill (estimate).',
          'باقي ${_n(p['left'], 1)} $u قبل الشريحة الجاية (${_n(p['threshold'])} $u). كان تتعدّاها، الفاتورة تزيد قريب $extra (تقدير).',
        );
      }
      return L(
        a.message,
        'At the current pace you will go over ${_n(p['threshold'])} $u this month (forecast ${_n(p['forecast'])} $u). That tranche would cost about $extra more (estimate).',
        'بالريتم هذا باش تتعدّى ${_n(p['threshold'])} $u هالشهر (التوقع ${_n(p['forecast'])} $u). هذا يزيد قريب $extra (تقدير).',
      );
    case 'leak':
      return L(
        a.message,
        'Water has been flowing non-stop since ${p['since']} (${_n(p['minutes'])} min), about ${_n(p['litres'])} L. Check the toilet flush and taps.',
        'الماء يجري بلا وقفة من ${p['since']} (${_n(p['minutes'])} دقيقة)، قريب ${_n(p['litres'])} لتر. ثبّت في السيفون والروبينيات.',
      );
    case 'sensor_fault':
      return L(
        a.message,
        'The ${p['sensor'] == 'water' ? 'water (YF-S201)' : 'electricity (PZEM-004T)'} sensor of device ${p['device']} does not answer. Check its wiring.',
        'الكابتور متاع ${p['sensor'] == 'water' ? 'الماء' : 'الضو'} في ${p['device']} ما يجاوبش. ثبّت في الخيوط.',
      );
    case 'device_offline':
      final since = p['since'] != null ? dateTime(DateTime.parse('${p['since']}')) : '';
      return L(
        a.message,
        'Device ${p['device']} offline since $since. Check its Wi-Fi and power supply.',
        'البواطة ${p['device']} مقطوعة من $since. ثبّت في الويفي والكورون.',
      );
    default:
      return a.message;
  }
}

class AlertLook {
  AlertLook(this.tone, this.title, this.icon, this.rank);
  final BannerTone tone;
  final String title;
  final IconData icon;

  /// Order on screen: broken first.
  final int rank;
}

AlertLook alertLook(Alert a, [TrancheView? tranche]) {
  switch (a.type) {
    case 'leak':
      return AlertLook(BannerTone.broken, alertTitle(a), LucideIcons300.droplet, 0);
    case 'sensor_fault':
      return AlertLook(BannerTone.broken, alertTitle(a), LucideIcons300.circleAlert, 1);
    case 'threshold':
      var title = alertTitle(a);
      if (a.resource == 'electricity' && tranche != null) {
        if (tranche.crossingDate != null && tranche.state != TrancheState.near) {
          final d = dayMonth(tranche.crossingDate!);
          title = L('Tranche suivante vers le $d', 'Next tranche around $d', 'الشريحة الجاية حوالي $d');
        } else if (tranche.state == TrancheState.crossed) {
          title = L('Tranche dépassée', 'Tranche crossed', 'تعدّيت الشريحة');
        }
      }
      return AlertLook(BannerTone.headsup, title, LucideIcons300.triangleAlert, 2);
    case 'device_offline':
      return AlertLook(BannerTone.info, alertTitle(a), LucideIcons300.wifiOff, 3);
    default:
      return AlertLook(BannerTone.info, alertTitle(a), LucideIcons300.info, 4);
  }
}

/// Short title for lists, independent of the current tranche state.
String alertKind(Alert a) => switch (a.type) {
      'leak' => L('Fuite probable', 'Probable leak', 'تسريب'),
      'sensor_fault' => L('Capteur en panne', 'Sensor fault', 'كابتور معطّل'),
      'threshold' => a.resource == 'water' ? L('Tranche d\'eau', 'Water tranche', 'شريحة الماء') : L('Tranche STEG', 'STEG tranche', 'شريحة STEG'),
      'device_offline' => L('Appareil hors ligne', 'Device offline', 'البواطة مقطوعة'),
      _ => L('Alerte', 'Alert', 'تنبيه'),
    };

List<Alert> sortAlerts(Iterable<Alert> alerts) {
  final l = alerts.toList();
  l.sort((a, b) {
    final r = alertLook(a).rank.compareTo(alertLook(b).rank);
    return r != 0 ? r : b.createdAt.compareTo(a.createdAt);
  });
  return l;
}

/// Tip text in the current language. French (or an AI rewording) keeps the backend text.
String tipText(Tip t) {
  if (lang == Lang.fr) return t.text;
  final p = t.params;
  if (p.isEmpty && t.code != 'offpeak') return t.text; // older tips, stored before params existed
  return switch (t.code) {
    'threshold' => L(
        t.text,
        'To stay under ${_n(p['threshold'])} kWh this month, cut about ${_n(p['cut_kwh'], 1)} kWh by month end (≈ ${_n(p['per_day_kwh'], 1)} kWh a day).',
        'باش تبقى تحت ${_n(p['threshold'])} kWh هالشهر، نقّص قريب ${_n(p['cut_kwh'], 1)} kWh قبل آخر الشهر (≈ ${_n(p['per_day_kwh'], 1)} kWh في النهار).',
      ),
    'keep_pace' => L(
        t.text,
        'Well done: at this pace you stay under ${_n(p['threshold'])} kWh (forecast ${_n(p['forecast_kwh'])} kWh). Keep it up to avoid the jump.',
        'برافو: بالريتم هذا تبقى تحت ${_n(p['threshold'])} kWh (التوقع ${_n(p['forecast_kwh'])} kWh). كمّل هكّا.',
      ),
    'leak' => L(t.text, 'Fix the detected leak: at this flow it wastes about ${_n(p['litres_day'])} L a day.',
        'صلّح التسريب: بهالدبي يضيّع قريب ${_n(p['litres_day'])} لتر في النهار.'),
    'appliance' => L(
        t.text,
        'An appliance of about ${_n(p['kw'], 1)} kW starts often. Using it 1 h less a day saves ≈ ${_n(p['save_kwh'], 1)} kWh.',
        'فما آلة قريب ${_n(p['kw'], 1)} kW تشعل برشا. ساعة أقل في النهار توفّر ≈ ${_n(p['save_kwh'], 1)} kWh.',
      ),
    'standby' => L(
        t.text,
        'Your home draws at least ${_n(p['base_w'])} W all the time (standby). Unplug the box, TV and chargers at night: ≈ ${_n(p['save_kwh'], 1)} kWh less.',
        'الدار تاكل على الأقل ${_n(p['base_w'])} W ديما (veille). فصّل البوكس والتلفزة والشارجورات في الليل: ≈ ${_n(p['save_kwh'], 1)} kWh أقل.',
      ),
    'ac' => L(
        t.text,
        'Set your air conditioner to 26 °C instead of 22 °C: you stay cool and, from your profile, save ≈ ${_n(p['save_kwh'], 1)} kWh.',
        'حط الكليماتيزور على 26 درجة عوض 22: تبقى في البرودة وحسب البروفيل توفّر ≈ ${_n(p['save_kwh'], 1)} kWh.',
      ),
    'water_heater' => L(
        t.text,
        'Lower the water heater to 50 °C and put it on a timer: ≈ ${_n(p['save_kwh'], 1)} kWh less (profile estimate).',
        'نقّص السخّان لـ 50 درجة وحطّو على مينوتري: ≈ ${_n(p['save_kwh'], 1)} kWh أقل (تقدير).',
      ),
    'lighting' => L(
        t.text,
        'Replace your ${_n(p['bulbs'])} classic bulbs with ${_n(p['led_w'])} W LEDs: ≈ ${_n(p['save_kwh'], 1)} kWh less.',
        'بدّل ${_n(p['bulbs'])} لمبة عادية بـ LED متاع ${_n(p['led_w'])} W: ≈ ${_n(p['save_kwh'], 1)} kWh أقل.',
      ),
    'offpeak' => L(
        t.text,
        'If you can, run the washing machine and water heater outside the evening peak. It relieves the STEG grid, but does not change your bill.',
        'كان تنجم، شعّل الماكينة والسخّان برّا وقت الذروة متاع العشية. هذا يعاون STEG، أما ما يبدّلش الفاتورة.',
      ),
    _ => t.text,
  };
}
