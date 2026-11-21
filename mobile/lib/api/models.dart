// Mirrors backend/app/schemas.py. Dates arrive as ISO 8601 (UTC).

typedef Json = Map<String, dynamic>;

double? _d(Object? v) => v == null ? null : (v as num).toDouble();
double _d0(Object? v) => v == null ? 0 : (v as num).toDouble();
DateTime? _dt(Object? v) => v == null ? null : DateTime.parse(v as String);
List<T> _list<T>(Object? v, T Function(Json) f) => [for (final e in (v as List? ?? const [])) f(e as Json)];

class User {
  User({required this.id, required this.email, required this.role});
  final String id, email, role;
  bool get isAdmin => role == 'admin';
  factory User.fromJson(Json j) => User(id: j['id'], email: j['email'], role: j['role']);
}

class DeviceStatus {
  DeviceStatus({required this.id, required this.kind, this.lastSeenAt, required this.online, required this.calibPulsesPerL});
  final String id, kind;
  final DateTime? lastSeenAt;
  final bool online;
  final int calibPulsesPerL;
  factory DeviceStatus.fromJson(Json j) => DeviceStatus(
        id: j['id'],
        kind: j['kind'],
        lastSeenAt: _dt(j['last_seen_at']),
        online: j['online'] == true,
        calibPulsesPerL: (j['calib_pulses_per_l'] as num?)?.toInt() ?? 450,
      );
}

class LiveElectricity {
  LiveElectricity(this.j);
  final Json j;
  bool get reliable => j['reliable'] == true;
  bool get fault => j['fault'] == true;
  double? get powerW => _d(j['power_w']);
  double? get voltageV => _d(j['voltage_v']);
  double? get currentA => _d(j['current_a']);
  double? get powerFactor => _d(j['power_factor']);
  double? get frequencyHz => _d(j['frequency_hz']);
}

class LiveWater {
  LiveWater(this.j);
  final Json j;
  bool get reliable => j['reliable'] == true;
  bool get fault => j['fault'] == true;
  double? get flowLMin => _d(j['flow_l_min']);
  double? get totalL => _d(j['total_l']);
}

class Live {
  Live({required this.ts, required this.ageS, required this.stale, required this.electricity, required this.water});
  final DateTime ts;
  final double ageS;
  final bool stale;
  final LiveElectricity electricity;
  final LiveWater water;
  factory Live.fromJson(Json j) => Live(
        ts: DateTime.parse(j['ts']),
        ageS: _d0(j['age_s']),
        stale: j['stale'] == true,
        electricity: LiveElectricity(j['electricity'] as Json),
        water: LiveWater(j['water'] as Json),
      );
}

class Tranche {
  Tranche({required this.index, required this.minQty, this.maxQty, required this.priceMillimes, required this.vatRate});
  final int index;
  final double minQty;
  final double? maxQty;
  final int priceMillimes;
  final double vatRate;
  factory Tranche.fromJson(Json j) => Tranche(
        index: (j['index'] as num).toInt(),
        minQty: _d0(j['min_qty']),
        maxQty: _d(j['max_qty']),
        priceMillimes: (j['price_millimes'] as num).toInt(),
        vatRate: _d0(j['vat_rate']),
      );
}

class Bill {
  Bill(this.j);
  final Json j;
  double get qty => _d0(j['qty']);
  double get energyDt => _d0(j['energy_dt']);
  double get vatDt => _d0(j['vat_dt']);
  double get fixedDt => _d0(j['fixed_dt']);
  double get taxesDt => _d0(j['taxes_dt']);
  double get totalDt => _d0(j['total_dt']);
}

class Forecast {
  Forecast({required this.available, this.qty, this.bill, required this.assumption});
  final bool available;
  final double? qty;
  final Bill? bill;
  final String assumption;
  factory Forecast.fromJson(Json j) => Forecast(
        available: j['available'] == true,
        qty: _d(j['qty']),
        bill: j['bill'] == null ? null : Bill(j['bill'] as Json),
        assumption: j['assumption'] ?? '',
      );
}

class ElectricitySummary {
  ElectricitySummary({
    required this.month,
    required this.monthKwh,
    required this.thresholds,
    this.tranche,
    this.nextThreshold,
    this.kwhToNext,
    this.nextKwhPriceDt,
    this.crossingExtraCostDt,
    this.billToDate,
    required this.forecast,
  });
  final String month;
  final double monthKwh;
  final List<double> thresholds;
  final Tranche? tranche;
  final double? nextThreshold, kwhToNext, nextKwhPriceDt, crossingExtraCostDt;
  final Bill? billToDate;
  final Forecast forecast;
  factory ElectricitySummary.fromJson(Json j) => ElectricitySummary(
        month: j['month'] ?? '',
        monthKwh: _d0(j['month_kwh']),
        thresholds: [for (final t in (j['thresholds_kwh'] as List? ?? const [])) (t as num).toDouble()],
        tranche: j['tranche'] == null ? null : Tranche.fromJson(j['tranche']),
        nextThreshold: _d(j['next_threshold_kwh']),
        kwhToNext: _d(j['kwh_to_next_threshold']),
        nextKwhPriceDt: _d(j['next_kwh_price_dt']),
        crossingExtraCostDt: _d(j['crossing_extra_cost_dt']),
        billToDate: j['bill_to_date'] == null ? null : Bill(j['bill_to_date']),
        forecast: Forecast.fromJson(j['forecast']),
      );
}

class WaterSummary {
  WaterSummary({
    required this.monthL,
    required this.tariffConfigured,
    this.billToDate,
    required this.forecast,
    required this.leakSuspected,
  });
  final double monthL;
  final bool tariffConfigured;
  final Bill? billToDate;
  final Forecast forecast;
  final bool leakSuspected;
  factory WaterSummary.fromJson(Json j) => WaterSummary(
        monthL: _d0(j['month_l']),
        tariffConfigured: j['tariff_configured'] == true,
        billToDate: j['bill_to_date'] == null ? null : Bill(j['bill_to_date']),
        forecast: Forecast.fromJson(j['forecast']),
        leakSuspected: j['leak_suspected'] == true,
      );
}

class Alert {
  Alert({
    required this.id,
    required this.type,
    this.resource,
    required this.severity,
    required this.message,
    this.extraCostDt,
    required this.createdAt,
    this.acknowledgedAt,
  });
  final String id, type, severity, message;
  final String? resource;
  final double? extraCostDt;
  final DateTime createdAt;
  final DateTime? acknowledgedAt;
  factory Alert.fromJson(Json j) => Alert(
        id: j['id'],
        type: j['type'],
        resource: j['resource'],
        severity: j['severity'] ?? 'warning',
        message: j['message'] ?? '',
        extraCostDt: _d(j['extra_cost_dt']),
        createdAt: DateTime.parse(j['created_at']),
        acknowledgedAt: _dt(j['acknowledged_at']),
      );
}

class HeavyConsumer {
  HeavyConsumer({required this.label, required this.typicalW, required this.startsToday, required this.lastSeenAt});
  final String label;
  final double typicalW;
  final int startsToday;
  final DateTime lastSeenAt;
  factory HeavyConsumer.fromJson(Json j) => HeavyConsumer(
        label: j['label'],
        typicalW: _d0(j['typical_w']),
        startsToday: (j['starts_today'] as num).toInt(),
        lastSeenAt: DateTime.parse(j['last_seen_at']),
      );
}

class Dashboard {
  Dashboard({
    required this.generatedAt,
    required this.empty,
    required this.householdName,
    required this.subscribedKva,
    this.device,
    this.live,
    required this.electricity,
    required this.water,
    required this.activeAlerts,
    required this.heavyConsumers,
  });
  final DateTime generatedAt;
  final bool empty;
  final String householdName;
  final double subscribedKva;
  final DeviceStatus? device;
  final Live? live;
  final ElectricitySummary electricity;
  final WaterSummary water;
  final List<Alert> activeAlerts;
  final List<HeavyConsumer> heavyConsumers;
  factory Dashboard.fromJson(Json j) => Dashboard(
        generatedAt: DateTime.parse(j['generated_at']),
        empty: j['state'] == 'empty',
        householdName: j['household_name'] ?? '',
        subscribedKva: _d0(j['subscribed_kva']),
        device: j['device'] == null ? null : DeviceStatus.fromJson(j['device']),
        live: j['live'] == null ? null : Live.fromJson(j['live']),
        electricity: ElectricitySummary.fromJson(j['electricity']),
        water: WaterSummary.fromJson(j['water']),
        activeAlerts: _list(j['active_alerts'], Alert.fromJson),
        heavyConsumers: _list(j['heavy_consumers'], HeavyConsumer.fromJson),
      );
}

class SeriesPoint {
  SeriesPoint(this.j) : ts = DateTime.parse(j['ts']);
  final Json j;
  final DateTime ts;
  bool get reliable => j['reliable'] != false;
  double? get powerW => _d(j['power_w']);
  double? get energyKwh => _d(j['energy_kwh']);
  double? get flowLMin => _d(j['flow_l_min']);
  double? get volumeL => _d(j['volume_l']);
}

class Series {
  Series({required this.bucket, required this.points});
  final String bucket;
  final List<SeriesPoint> points;
  factory Series.fromJson(Json j) =>
      Series(bucket: j['bucket'] ?? 'raw', points: [for (final p in (j['points'] as List)) SeriesPoint(p as Json)]);
}

class Tip {
  Tip({required this.id, required this.code, required this.text, this.savingDt, required this.source});
  final String id, code, text, source;
  final double? savingDt;
  factory Tip.fromJson(Json j) =>
      Tip(id: j['id'], code: j['code'], text: j['text'], savingDt: _d(j['saving_dt']), source: j['source'] ?? 'rule');
}

class DayScore {
  DayScore({required this.day, required this.score, required this.kwh, this.budgetKwh});
  final String day; // YYYY-MM-DD
  final int score;
  final double kwh;
  final double? budgetKwh;
  DateTime get date => DateTime.parse('${day}T11:00:00Z');
  factory DayScore.fromJson(Json j) => DayScore(
      day: j['day'], score: (j['score'] as num).toInt(), kwh: _d0(j['kwh']), budgetKwh: _d(j['budget_kwh']));
}

class Badge {
  Badge({required this.code, required this.label, required this.description, required this.earned});
  final String code, label, description;
  final bool earned;
  factory Badge.fromJson(Json j) =>
      Badge(code: j['code'], label: j['label'], description: j['description'], earned: j['earned'] == true);
}

class Score {
  Score(this.j)
      : today = j['today'] == null ? null : DayScore.fromJson(j['today']),
        history = _list(j['history'], DayScore.fromJson),
        badges = _list(j['badges'], Badge.fromJson);
  final Json j;
  final DayScore? today;
  final List<DayScore> history;
  final List<Badge> badges;
  Json get ranking => j['ranking'] as Json;
  Json get challenge => j['weekly_challenge'] as Json;
}

class Settings {
  Settings({
    required this.name,
    required this.subscribedKva,
    required this.alertMarginKwh,
    required this.leakStartHour,
    required this.leakEndHour,
    required this.leakMinMinutes,
    this.activeDeviceId,
    required this.devices,
    required this.demoMode,
  });
  final String name;
  final double subscribedKva;
  final int alertMarginKwh, leakStartHour, leakEndHour, leakMinMinutes;
  final String? activeDeviceId;
  final List<DeviceStatus> devices;
  final bool demoMode;
  factory Settings.fromJson(Json j) => Settings(
        name: j['name'],
        subscribedKva: _d0(j['subscribed_kva']),
        alertMarginKwh: (j['alert_margin_kwh'] as num).toInt(),
        leakStartHour: (j['leak_start_hour'] as num).toInt(),
        leakEndHour: (j['leak_end_hour'] as num).toInt(),
        leakMinMinutes: (j['leak_min_minutes'] as num).toInt(),
        activeDeviceId: j['active_device_id'],
        devices: _list(j['devices'], DeviceStatus.fromJson),
        demoMode: j['demo_mode'] == true,
      );
}

class TrancheRow {
  TrancheRow(this.j);
  final Json j;
  String get resource => j['resource'];
  double get minQty => _d0(j['min_qty']);
  double? get maxQty => _d(j['max_qty']);
  int get priceMillimes => (j['price_millimes'] as num).toInt();
  double get vatRate => _d0(j['vat_rate']);
}

class Tariffs {
  Tariffs(Json j)
      : tranches = [for (final t in (j['tranches'] as List)) TrancheRow(t as Json)],
        fees = [for (final f in (j['fees'] as List)) f as Json],
        pricingMode = j['pricing_mode'];
  final List<TrancheRow> tranches;
  final List<Json> fees;
  final String? pricingMode;
}

class SpikeOut {
  SpikeOut(this.j);
  final Json j;
  bool get simulatorOnline => j['simulator_online'] == true;
  String get message => j['message'] ?? '';
  String get deviceId => j['device_id'] ?? '';
  double get extraW => _d0(j['extra_w']);
  int get durationS => (j['duration_s'] as num?)?.toInt() ?? 0;
  double get energyKwh => _d0(j['energy_kwh']);
}
