// Writing numbers in French (charter board 04):
//   1 380 W           space for thousands
//   6,2 L/min         decimal comma
//   0,176 DT          unit price: 3 decimals, DT after
//   ≈ 66 DT           forecast: ≈, rounded
//   21 nov. · 14:02   24-hour clock
//
// Tunisia is UTC+1 all year (no DST since 2009): local times are computed from
// UTC, so the app shows the household's time whatever the phone's time zone.

import 'i18n.dart';

const nbsp = ' ';

// French and Tunisian Arabic write 1 234,5 (Latin digits, like the bills); English 1,234.5.
String num(double value, {int decimals = 0, bool fixed = true}) {
  final en = lang == Lang.en;
  final group = en ? ',' : nbsp;
  final point = en ? '.' : ',';
  final negative = value < 0;
  var text = value.abs().toStringAsFixed(decimals);
  var intPart = text;
  var frac = '';
  final dot = text.indexOf('.');
  if (dot >= 0) {
    intPart = text.substring(0, dot);
    frac = text.substring(dot + 1);
    if (!fixed) frac = frac.replaceFirst(RegExp(r'0+$'), '');
  }
  final buf = StringBuffer();
  for (var i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 == 0) buf.write(group);
    buf.write(intPart[i]);
  }
  final sign = negative && (intPart != '0' || frac.replaceAll('0', '').isNotEmpty) ? '-' : '';
  return frac.isEmpty ? '$sign$buf' : '$sign$buf$point$frac';
}

/// A number with its unit stays "100 kWh" inside Arabic text (Unicode isolate,
/// like <bdi dir="ltr"> on the web). Nothing changes in French and English.
String ltr(String s) => isRtl ? '\u2066$s\u2069' : s;

/// kWh left / used: integer from 10, one decimal below (dropped when round).
String kwhValue(double v) => v.abs() >= 10 ? num(v.roundToDouble()) : num(v, decimals: 1, fixed: false);
String kwh(double v) => ltr('${kwhValue(v)}${nbsp}kWh');
String watts(double v) => ltr('${num(v.roundToDouble())}${nbsp}W');
String flow(double v) => ltr('${num(v, decimals: 1)}${nbsp}L/min');
String litres(double v) => ltr('${num(v.roundToDouble())}${nbsp}L');
String m3(double v) => ltr('${num(v, decimals: v < 10 ? 2 : 1, fixed: false)}${nbsp}m³');
String volts(double v) => ltr('${num(v, decimals: 1)}${nbsp}V');
String amps(double v) => ltr('${num(v, decimals: 2)}${nbsp}A');
String hertz(double v) => ltr('${num(v, decimals: 1)}${nbsp}Hz');

/// Unit price: 3 decimals, DT after.
String dtUnit(double v) => ltr('${num(v, decimals: 3)}${nbsp}DT');

/// Forecast amount: rounded, with ≈.
String dtRound(double v) => ltr('≈$nbsp${num(v.roundToDouble())}${nbsp}DT');

/// An estimated amount (cost of a jump, a saving): precision follows the size.
String dt(double v) {
  final a = v.abs();
  final d = a < 10 ? 2 : (a < 100 ? 1 : 0);
  return ltr('${num(v, decimals: d, fixed: false)}${nbsp}DT');
}

// ---- Dates -------------------------------------------------------------------------

List<String> get _weekdays => pick(
      fr: const ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'],
      en: const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      ar: const ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
    );
List<String> get _monthsShort => pick(
      fr: const ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
      en: const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      ar: _monthsAr,
    );
List<String> get _monthsLong => pick(
      fr: const [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
      ],
      en: const [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ],
      ar: _monthsAr,
    );
// Month names used in Tunisia (جانفي، فيفري...), as on the bills.
const _monthsAr = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const tunisOffset = Duration(hours: 1);

/// The instant shifted to Tunisian wall-clock time (fields read as local time).
DateTime tunis(DateTime instant) => instant.toUtc().add(tunisOffset);

String _two(int n) => n.toString().padLeft(2, '0');

/// 14:02
String time(DateTime instant) {
  final t = tunis(instant);
  return '${_two(t.hour)}:${_two(t.minute)}';
}

/// 21 nov.
String dayMonth(DateTime instant) {
  final t = tunis(instant);
  return '${t.day} ${_monthsShort[t.month - 1]}';
}

/// 21 nov. · 14:02
String dateTime(DateTime instant) => '${dayMonth(instant)} · ${time(instant)}';

/// sam. 21 nov.
String weekdayDayMonth(DateTime instant) {
  final t = tunis(instant);
  return '${_weekdays[t.weekday - 1]} ${t.day} ${_monthsShort[t.month - 1]}';
}

String weekdayShort(DateTime instant) => _weekdays[tunis(instant).weekday - 1];

/// novembre
String monthName(DateTime instant) => _monthsLong[tunis(instant).month - 1];

/// "2026-10" -> "oct." (short) or "octobre 2026" (long), in the current language.
String monthKeyLabel(String key, {bool long = false}) {
  final parts = key.split('-');
  if (parts.length < 2) return key;
  final m = (int.tryParse(parts[1]) ?? 1).clamp(1, 12);
  return long ? '${_monthsLong[m - 1]} ${parts[0]}' : _monthsShort[m - 1];
}

int daysInMonth(int year, int month) => DateTime.utc(year, month + 1, 0).day;

/// Whole days left after today in the local month (21 nov. -> 9).
int daysLeftInMonth(DateTime instant) {
  final t = tunis(instant);
  return daysInMonth(t.year, t.month) - t.day;
}

/// Fractional local day of month (1.0 = the 1st at 00:00).
double fractionalDay(DateTime instant) {
  final t = tunis(instant);
  return t.day + (t.hour + t.minute / 60 + t.second / 3600) / 24;
}

/// Fractional local hour (0–24).
double fractionalHour(DateTime instant) {
  final t = tunis(instant);
  return t.hour + t.minute / 60 + t.second / 3600;
}

/// ISO string of local midnight, e.g. 2026-11-21T00:00:00+01:00
String localMidnightIso(int y, int m, int d) => '$y-${_two(m)}-${_two(d)}T00:00:00+01:00';

String todayStartIso([DateTime? now]) {
  final t = tunis(now ?? DateTime.now());
  return localMidnightIso(t.year, t.month, t.day);
}

String monthStartIso([DateTime? now]) {
  final t = tunis(now ?? DateTime.now());
  return localMidnightIso(t.year, t.month, 1);
}

/// "4 s", "3 min", "2 h": compact age for pills.
String shortAge(double seconds) {
  final s = seconds.round().clamp(0, 1 << 31);
  if (s < 60) return '$s${nbsp}s';
  final m = (s / 60).round();
  if (m < 60) return '$m${nbsp}min';
  final h = (m / 60).round();
  if (h < 48) return '$h${nbsp}h';
  return '${(h / 24).round()}$nbsp${L('j', 'd', 'يوم')}';
}

/// "il y a 4 s", "4 s ago", "قبل 4 s"
String ago(double seconds) {
  final v = shortAge(seconds);
  return L('il y a $v', '$v ago', 'قبل $v');
}

/// "SAM. 21 NOV. · ENCORE 9 JOURS"
String dateLabel(DateTime now) {
  final left = daysLeftInMonth(now);
  final rest = left == 0
      ? L('dernier jour', 'last day', 'آخر نهار')
      : L('encore $left jour${left > 1 ? 's' : ''}', '$left day${left > 1 ? 's' : ''} left', 'باقي $left يوم');
  return '${weekdayDayMonth(now)} · $rest'.toUpperCase();
}

String hh(int h) => '${_two(h)}:00';
