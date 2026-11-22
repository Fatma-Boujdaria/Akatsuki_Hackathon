// Mirrors backend/app/schemas.py. Dates arrive as ISO 8601 (UTC).

typedef Json = Map<String, dynamic>;

double? _d(Object? v) => v == null ? null : (v as num).toDouble();
double _d0(Object? v) => v == null ? 0 : (v as num).toDouble();
DateTime? _dt(Object? v) => v == null ? null : DateTime.parse(v as String);
List<T> _list<T>(Object? v, T Function(Json) f) => [for (final e in (v as List? ?? const [])) f(e as Json)];

int _i0(Object? v) => v == null ? 0 : (v as num).toInt();
int? _i(Object? v) => v == null ? null : (v as num).toInt();

/// Which notifications the user wants (Profile > Notifications).
class NotifyPrefs {
  NotifyPrefs({this.threshold = true, this.leak = true, this.device = true, this.tips = true, this.push = false});
  final bool threshold, leak, device, tips, push;
  factory NotifyPrefs.fromJson(Json? j) => j == null
      ? NotifyPrefs()
      : NotifyPrefs(
          threshold: j['threshold'] != false,
          leak: j['leak'] != false,
          device: j['device'] != false,
          tips: j['tips'] != false,
          push: j['push'] == true,
        );
  Json toJson() => {'threshold': threshold, 'leak': leak, 'device': device, 'tips': tips, 'push': push};
  NotifyPrefs copyWith({bool? threshold, bool? leak, bool? device, bool? tips, bool? push}) => NotifyPrefs(
        threshold: threshold ?? this.threshold,
        leak: leak ?? this.leak,
        device: device ?? this.device,
        tips: tips ?? this.tips,
        push: push ?? this.push,
      );
}

class User {
  User({
    required this.id,
    required this.email,
    required this.role,
    this.fullName,
    this.language,
    this.status = 'active',
    this.emailVerified = true,
    NotifyPrefs? notifyPrefs,
    this.createdAt,
  }) : notifyPrefs = notifyPrefs ?? NotifyPrefs();
  final String id, email, role, status;
  final String? fullName, language;
  final bool emailVerified;
  final NotifyPrefs notifyPrefs;
  final DateTime? createdAt;
  bool get isAdmin => role == 'admin';

  /// Name to show: the full name, else the e-mail.
  String get display => (fullName ?? '').trim().isNotEmpty ? fullName!.trim() : email;

  /// First letter for the round avatar.
  String get initial => display.isEmpty ? '?' : display.characters.first.toUpperCase();

  factory User.fromJson(Json j) => User(
        id: j['id'],
        email: j['email'],
        role: j['role'] ?? 'household',
        fullName: j['full_name'],
        language: j['language'],
        status: j['status'] ?? 'active',
        emailVerified: j['email_verified'] != false,
        notifyPrefs: NotifyPrefs.fromJson(j['notify_prefs'] as Json?),
        createdAt: _dt(j['created_at']),
      );
}

extension on String {
  Iterable<String> get characters => runes.map(String.fromCharCode);
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
    this.tranche,
    this.nextThresholdM3,
    this.billToDate,
    required this.forecast,
    required this.leakSuspected,
  });
  final double monthL;
  final bool tariffConfigured;
  final Tranche? tranche;
  final double? nextThresholdM3;
  final Bill? billToDate;
  final Forecast forecast;
  final bool leakSuspected;
  factory WaterSummary.fromJson(Json j) => WaterSummary(
        monthL: _d0(j['month_l']),
        tariffConfigured: j['tariff_configured'] == true,
        tranche: j['tranche'] == null ? null : Tranche.fromJson(j['tranche']),
        nextThresholdM3: _d(j['next_threshold_m3']),
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
    this.isEstimate = false,
    required this.createdAt,
    this.acknowledgedAt,
    this.params = const {},
    this.householdId,
  });
  final String id, type, severity, message;
  final String? resource, householdId;
  final double? extraCostDt;
  final bool isEstimate;
  final DateTime createdAt;
  final DateTime? acknowledgedAt;

  /// Values behind the message (kwh_left, crossing_day...), so the app can write it
  /// in the user's language instead of the stored French text.
  final Json params;
  bool get acknowledged => acknowledgedAt != null;
  factory Alert.fromJson(Json j) => Alert(
        id: j['id'],
        type: j['type'],
        resource: j['resource'],
        severity: j['severity'] ?? 'warning',
        message: j['message'] ?? '',
        extraCostDt: _d(j['extra_cost_dt']),
        isEstimate: j['is_estimate'] == true,
        createdAt: DateTime.parse(j['created_at']),
        acknowledgedAt: _dt(j['acknowledged_at']),
        params: (j['params'] as Json?) ?? const {},
        householdId: j['household_id'],
      );
}

/// An alert of any of the user's homes (notification history).
class AppNotification extends Alert {
  AppNotification({
    required super.id,
    required super.type,
    super.resource,
    required super.severity,
    required super.message,
    super.extraCostDt,
    super.isEstimate,
    required super.createdAt,
    super.acknowledgedAt,
    super.params,
    super.householdId,
    required this.householdName,
  });
  final String householdName;
  factory AppNotification.fromJson(Json j) {
    final a = Alert.fromJson(j);
    return AppNotification(
      id: a.id,
      type: a.type,
      resource: a.resource,
      severity: a.severity,
      message: a.message,
      extraCostDt: a.extraCostDt,
      isEstimate: a.isEstimate,
      createdAt: a.createdAt,
      acknowledgedAt: a.acknowledgedAt,
      params: a.params,
      householdId: a.householdId,
      householdName: j['household_name'] ?? '',
    );
  }
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
    this.householdId,
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
  final String? householdId;
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
        householdId: j['household_id'],
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
  Tip({
    required this.id,
    required this.code,
    required this.text,
    this.savingDt,
    required this.source,
    this.isEstimate = true,
    this.createdAt,
    this.params = const {},
  });
  final String id, code, text, source;
  final double? savingDt;
  final bool isEstimate;
  final DateTime? createdAt;
  final Json params;
  factory Tip.fromJson(Json j) => Tip(
        id: j['id'],
        code: j['code'],
        text: j['text'],
        savingDt: _d(j['saving_dt']),
        source: j['source'] ?? 'rule',
        isEstimate: j['is_estimate'] != false,
        createdAt: _dt(j['created_at']),
        params: (j['params'] as Json?) ?? const {},
      );
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
  Badge({required this.code, required this.label, required this.description, required this.earned, this.earnedAt});
  final String code, label, description;
  final bool earned;
  final DateTime? earnedAt;
  factory Badge.fromJson(Json j) => Badge(
        code: j['code'],
        label: j['label'],
        description: j['description'],
        earned: j['earned'] == true,
        earnedAt: _dt(j['earned_at']),
      );
}

class Ranking {
  Ranking(Json j)
      : isMock = j['is_mock'] == true,
        similarHomes = _i0(j['similar_homes']),
        betterThanPct = _d0(j['better_than_pct']),
        label = j['label'] ?? '';
  final bool isMock;
  final int similarHomes;
  final double betterThanPct;
  final String label;
}

class Challenge {
  Challenge(Json j)
      : title = j['title'] ?? '',
        description = j['description'] ?? '',
        targetKwh = _d(j['target_kwh']),
        currentKwh = _d0(j['current_kwh']),
        progressPct = _d0(j['progress_pct']),
        status = j['status'] ?? 'en_cours';
  final String title, description, status; // en_cours | reussi | pas_assez_de_donnees
  final double? targetKwh;
  final double currentKwh, progressPct;
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
  Ranking get rankingInfo => Ranking(ranking);
  Challenge get weeklyChallenge => Challenge(challenge);
}

class Settings {
  Settings({
    this.householdId = '',
    this.address,
    this.occupants,
    this.onboardingDone = true,
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
  final String householdId, name;
  final String? address;
  final int? occupants;
  final bool onboardingDone;
  final double subscribedKva;
  final int alertMarginKwh, leakStartHour, leakEndHour, leakMinMinutes;
  final String? activeDeviceId;
  final List<DeviceStatus> devices;
  final bool demoMode;
  factory Settings.fromJson(Json j) => Settings(
        householdId: j['household_id'] ?? '',
        address: j['address'],
        occupants: _i(j['occupants']),
        onboardingDone: j['onboarding_done'] != false,
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

// ---- Accounts, homes, appliances, assistant, history, support (full app) -----------------

/// A code was e-mailed (sign-up, resend, forgot password). In the demo without SMTP the
/// API also returns it so it can be shown on screen.
class CodeSent {
  CodeSent(Json j)
      : email = j['email'] ?? '',
        expiresInMin = _i0(j['expires_in_min']),
        devCode = j['dev_code'];
  final String email;
  final int expiresInMin;
  final String? devCode;
}

class Household {
  Household({
    required this.id,
    required this.name,
    this.address,
    this.occupants,
    required this.subscribedKva,
    required this.alertMarginKwh,
    required this.onboardingDone,
    this.createdAt,
    required this.devices,
    required this.applianceCount,
    required this.unreadAlerts,
  });
  final String id, name;
  final String? address;
  final int? occupants;
  final double subscribedKva;
  final int alertMarginKwh, applianceCount, unreadAlerts;
  final bool onboardingDone;
  final DateTime? createdAt;
  final List<DeviceStatus> devices;

  /// "Tunis" from "12 rue X, Tunis": the last part of the address, for the header.
  String? get city {
    final a = (address ?? '').trim();
    if (a.isEmpty) return null;
    return a.split(',').last.trim();
  }

  factory Household.fromJson(Json j) => Household(
        id: j['id'],
        name: j['name'] ?? '',
        address: j['address'],
        occupants: _i(j['occupants']),
        subscribedKva: _d0(j['subscribed_kva']),
        alertMarginKwh: _i0(j['alert_margin_kwh']),
        onboardingDone: j['onboarding_done'] != false,
        createdAt: _dt(j['created_at']),
        devices: _list(j['devices'], DeviceStatus.fromJson),
        applianceCount: _i0(j['appliance_count']),
        unreadAlerts: _i0(j['unread_alerts']),
      );
}

/// Body of POST / PUT /api/households.
class HouseholdIn {
  HouseholdIn({required this.name, this.address, this.occupants, required this.subscribedKva, required this.alertMarginKwh});
  final String name;
  final String? address;
  final int? occupants;
  final double subscribedKva;
  final int alertMarginKwh;
  Json toJson() => {
        'name': name,
        'address': (address ?? '').trim().isEmpty ? null : address!.trim(),
        'occupants': occupants,
        'subscribed_kva': subscribedKva,
        'alert_margin_kwh': alertMarginKwh,
      };
}

/// A box or simulator added to a home: the key is shown once.
class DeviceCreated {
  DeviceCreated(Json j)
      : device = DeviceStatus.fromJson(j['device']),
        apiKey = j['api_key'] ?? '';
  final DeviceStatus device;
  final String apiKey;
}

/// Body of POST / PUT /api/appliances (power and hours: null = catalogue typical value).
class ApplianceIn {
  ApplianceIn({
    required this.category,
    required this.name,
    this.quantity = 1,
    this.powerW,
    this.hoursPerDay,
    this.startHour,
    this.endHour,
  });
  final String category, name;
  final int quantity;
  final double? powerW, hoursPerDay;
  final int? startHour, endHour;
  Json toJson() => {
        'category': category,
        'name': name,
        'quantity': quantity,
        'power_w': powerW,
        'hours_per_day': hoursPerDay,
        'start_hour': startHour,
        'end_hour': endHour,
      };
}

class Appliance extends ApplianceIn {
  Appliance(Json j)
      : id = j['id'],
        effectivePowerW = _d0(j['effective_power_w']),
        effectiveHoursPerDay = _d0(j['effective_hours_per_day']),
        estimatedKwhMonth = _d0(j['estimated_kwh_month']),
        super(
          category: j['category'] ?? 'other',
          name: j['name'] ?? '',
          quantity: _i(j['quantity']) ?? 1,
          powerW: _d(j['power_w']),
          hoursPerDay: _d(j['hours_per_day']),
          startHour: _i(j['start_hour']),
          endHour: _i(j['end_hour']),
        );
  final String id;
  final double effectivePowerW, effectiveHoursPerDay, estimatedKwhMonth;
}

class ApplianceCatalogItem {
  ApplianceCatalogItem(Json j)
      : category = j['category'],
        typicalPowerW = _d0(j['typical_power_w']),
        typicalHoursPerDay = _d0(j['typical_hours_per_day']),
        icon = j['icon'] ?? '';
  final String category, icon;
  final double typicalPowerW, typicalHoursPerDay;
}

class ApplianceShare {
  ApplianceShare(Json j)
      : id = j['id'],
        category = j['category'] ?? 'other',
        name = j['name'] ?? '',
        kwhMonth = _d0(j['kwh_month']),
        sharePct = _d0(j['share_pct']),
        costDt = _d(j['cost_dt']);
  final String? id;
  final String category, name;
  final double kwhMonth, sharePct;
  final double? costDt;
}

/// Consumption insights: status is normal | attention | warning | critical | unavailable.
class Insights {
  Insights(Json j)
      : generatedAt = DateTime.parse(j['generated_at']),
        profileKwhMonth = _d(j['profile_kwh_month']),
        measuredMonthKwh = _d0(j['measured_month_kwh']),
        forecastKwh = _d(j['forecast_kwh']),
        forecastBillDt = _d(j['forecast_bill_dt']),
        breakdown = _list(j['breakdown'], ApplianceShare.new),
        last7KwhPerDay = _d(j['last7_kwh_per_day']),
        previousKwhPerDay = _d(j['previous_kwh_per_day']),
        trendPct = _d(j['trend_pct']),
        unusualIncrease = j['unusual_increase'] == true,
        waterLast7LPerDay = _d(j['water_last7_l_per_day']),
        waterPreviousLPerDay = _d(j['water_previous_l_per_day']),
        waterTrendPct = _d(j['water_trend_pct']),
        waterForecastL = _d(j['water_forecast_l']),
        status = j['status'] ?? 'normal',
        statusReasons = [for (final r in (j['status_reasons'] as List? ?? const [])) '$r'];
  final DateTime generatedAt;
  final double? profileKwhMonth, forecastKwh, forecastBillDt, last7KwhPerDay, previousKwhPerDay, trendPct;
  final double measuredMonthKwh;
  final List<ApplianceShare> breakdown;
  final bool unusualIncrease;
  final double? waterLast7LPerDay, waterPreviousLPerDay, waterTrendPct, waterForecastL;
  final String status;
  final List<String> statusReasons;
}

class ChatTurn {
  ChatTurn(this.role, this.text);
  final String role; // user | assistant
  final String text;
  Json toJson() => {'role': role, 'text': text};
}

class ChatFact {
  ChatFact(Json j)
      : label = j['label'] ?? '',
        value = j['value'] ?? '',
        kind = j['kind'] ?? 'measured';
  final String label, value, kind; // measured | forecast | assumption | profile
}

class ChatOut {
  ChatOut(Json j)
      : intent = j['intent'] ?? '',
        answer = j['answer'] ?? '',
        facts = _list(j['facts'], ChatFact.new),
        suggestions = [for (final s in (j['suggestions'] as List? ?? const [])) '$s'],
        source = j['source'] ?? 'rule';
  final String intent, answer, source;
  final List<ChatFact> facts;
  final List<String> suggestions;
}

class HistoryMonth {
  HistoryMonth(Json j)
      : month = j['month'] ?? '',
        kwh = _d0(j['kwh']),
        litres = _d0(j['litres']),
        billDt = _d(j['bill_dt']),
        waterBillDt = _d(j['water_bill_dt']),
        trancheIndex = _i(j['tranche_index']),
        partial = j['partial'] == true;
  final String month; // YYYY-MM
  final double kwh, litres;
  final double? billDt, waterBillDt;
  final int? trancheIndex;
  final bool partial;
}

class History {
  History(Json j)
      : months = _list(j['months'], HistoryMonth.new),
        isEstimate = j['is_estimate'] != false;
  final List<HistoryMonth> months;
  final bool isEstimate;
}

class Ticket {
  Ticket(Json j)
      : id = j['id'],
        email = j['email'] ?? '',
        category = j['category'] ?? '',
        subject = j['subject'] ?? '',
        message = j['message'] ?? '',
        status = j['status'] ?? 'open',
        createdAt = DateTime.parse(j['created_at']);
  final String id, email, category, subject, message, status;
  final DateTime createdAt;
}
