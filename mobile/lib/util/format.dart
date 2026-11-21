// Writing numbers in French (charter board 04):
//   1 380 W           space for thousands
//   6,2 L/min         decimal comma
//   0,176 DT          unit price: 3 decimals, DT after
//   ≈ 66 DT           forecast: ≈, rounded
//   21 nov. · 14:02   24-hour clock
//
// Tunisia is UTC+1 all year (no DST since 2009): local times are computed from
// UTC, so the app shows the household's time whatever the phone's time zone.

const nbsp = ' ';

String num(double value, {int decimals = 0, bool fixed = true}) {
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
    if (i > 0 && (intPart.length - i) % 3 == 0) buf.write(nbsp);
    buf.write(intPart[i]);
  }
  final sign = negative && (intPart != '0' || frac.replaceAll('0', '').isNotEmpty) ? '-' : '';
  return frac.isEmpty ? '$sign$buf' : '$sign$buf,$frac';
}

/// kWh left / used: integer from 10, one decimal below (dropped when round).
String kwhValue(double v) => v.abs() >= 10 ? num(v.roundToDouble()) : num(v, decimals: 1, fixed: false);
String kwh(double v) => '${kwhValue(v)}${nbsp}kWh';
String watts(double v) => '${num(v.roundToDouble())}${nbsp}W';
String flow(double v) => '${num(v, decimals: 1)}${nbsp}L/min';
String litres(double v) => '${num(v.roundToDouble())}${nbsp}L';
String m3(double v) => '${num(v, decimals: v < 10 ? 2 : 1, fixed: false)}${nbsp}m³';
String volts(double v) => '${num(v, decimals: 1)}${nbsp}V';
String amps(double v) => '${num(v, decimals: 2)}${nbsp}A';
String hertz(double v) => '${num(v, decimals: 1)}${nbsp}Hz';

/// Unit price: 3 decimals, DT after.
String dtUnit(double v) => '${num(v, decimals: 3)}${nbsp}DT';

/// Forecast amount: rounded, with ≈.
String dtRound(double v) => '≈$nbsp${num(v.roundToDouble())}${nbsp}DT';

/// An estimated amount (cost of a jump, a saving): precision follows the size.
String dt(double v) {
  final a = v.abs();
  final d = a < 10 ? 2 : (a < 100 ? 1 : 0);
  return '${num(v, decimals: d, fixed: false)}${nbsp}DT';
}

// ---- Dates -------------------------------------------------------------------------

const _weekdays = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const _monthsShort = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const _monthsLong = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
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
  return '${(h / 24).round()}${nbsp}j';
}

/// "SAM. 21 NOV. · ENCORE 9 JOURS"
String dateLabel(DateTime now) {
  final left = daysLeftInMonth(now);
  final rest = left == 0 ? 'dernier jour' : 'encore $left jour${left > 1 ? 's' : ''}';
  return '${weekdayDayMonth(now)} · $rest'.toUpperCase();
}

String hh(int h) => '${_two(h)}:00';
