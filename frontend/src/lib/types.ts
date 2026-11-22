// Mirrors backend/app/schemas.py. Dates are ISO 8601 strings (UTC).

export type Resource = "electricity" | "water";

export type Lang = "fr" | "en" | "ar";

export interface NotifyPrefs {
  threshold: boolean;
  leak: boolean;
  device: boolean;
  tips: boolean;
  push: boolean;
}

export interface User {
  id: string;
  email: string;
  role: "household" | "admin" | string;
  full_name?: string | null;
  language?: Lang | string;
  status?: "active" | "suspended" | string;
  email_verified?: boolean;
  notify_prefs?: NotifyPrefs | null;
  created_at?: string | null;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface DeviceStatus {
  id: string;
  kind: "simulator" | "esp32" | string;
  last_seen_at: string | null;
  online: boolean;
  calib_pulses_per_l: number;
}

export interface LiveElectricity {
  reliable: boolean;
  fault: boolean;
  power_w: number | null;
  voltage_v: number | null;
  current_a: number | null;
  power_factor: number | null;
  frequency_hz: number | null;
}

export interface LiveWater {
  reliable: boolean;
  fault: boolean;
  flow_l_min: number | null;
  total_l: number | null;
}

export interface Live {
  ts: string;
  age_s: number;
  stale: boolean;
  electricity: LiveElectricity;
  water: LiveWater;
}

export interface Tranche {
  index: number;
  min_qty: number;
  max_qty: number | null;
  price_millimes: number;
  vat_rate: number;
}

export interface Bill {
  qty: number;
  tranche_index: number;
  energy_dt: number;
  vat_dt: number;
  fixed_dt: number;
  taxes_dt: number;
  total_dt: number;
  is_estimate: boolean;
}

export interface Forecast {
  available: boolean;
  qty: number | null;
  bill: Bill | null;
  assumption: string;
}

export interface ElectricitySummary {
  month: string;
  month_kwh: number;
  thresholds_kwh: number[];
  tranche: Tranche | null;
  next_threshold_kwh: number | null;
  kwh_to_next_threshold: number | null;
  next_kwh_price_dt: number | null;
  crossing_extra_cost_dt: number | null;
  bill_to_date: Bill | null;
  forecast: Forecast;
  is_estimate: boolean;
}

export interface WaterSummary {
  month: string;
  month_l: number;
  tariff_configured: boolean;
  tranche: Tranche | null;
  next_threshold_m3: number | null;
  bill_to_date: Bill | null;
  forecast: Forecast;
  leak_suspected: boolean;
  is_estimate: boolean;
}

export type AlertType = "threshold" | "leak" | "device_offline" | "sensor_fault";

export interface Alert {
  id: string;
  type: AlertType | string;
  resource: Resource | null;
  severity: "info" | "warning" | "critical" | string;
  message: string;
  extra_cost_dt: number | null;
  is_estimate: boolean;
  created_at: string;
  acknowledged_at: string | null;
  params?: Record<string, unknown> | null;
  household_id?: string | null;
}

export interface Notification extends Alert {
  household_name: string;
}

export interface HeavyConsumer {
  label: string;
  typical_w: number;
  starts_today: number;
  last_seen_at: string;
}

export interface Dashboard {
  generated_at: string;
  state: "empty" | "ok";
  household_id?: string | null;
  household_name: string;
  subscribed_kva: number;
  device: DeviceStatus | null;
  live: Live | null;
  electricity: ElectricitySummary;
  water: WaterSummary;
  active_alerts: Alert[];
  heavy_consumers: HeavyConsumer[];
}

export type Bucket = "raw" | "minute" | "hour" | "day";

export interface SeriesPoint {
  ts: string;
  power_w: number | null;
  max_power_w: number | null;
  energy_kwh: number | null;
  flow_l_min: number | null;
  volume_l: number | null;
  reliable: boolean;
}

export interface Series {
  resource: Resource;
  bucket: Bucket;
  start: string;
  end: string;
  points: SeriesPoint[];
}

export interface Tip {
  id: string;
  code: "threshold" | "keep_pace" | "leak" | "appliance" | "standby" | "offpeak" | string;
  text: string;
  saving_dt: number | null;
  source: "rule" | "llm" | string;
  is_estimate: boolean;
  created_at: string;
  params?: Record<string, unknown> | null;
}

export interface DayScore {
  day: string; // YYYY-MM-DD
  score: number;
  kwh: number;
  budget_kwh: number | null;
}

export interface Badge {
  code: string;
  label: string;
  description: string;
  earned: boolean;
  earned_at: string | null;
}

export interface Ranking {
  is_mock: boolean;
  similar_homes: number;
  better_than_pct: number;
  label: string;
}

export interface Challenge {
  title: string;
  description: string;
  target_kwh: number | null;
  current_kwh: number;
  progress_pct: number;
  status: "en_cours" | "reussi" | "pas_assez_de_donnees";
}

export interface Score {
  today: DayScore | null;
  history: DayScore[];
  badges: Badge[];
  ranking: Ranking;
  weekly_challenge: Challenge;
}

export interface Settings {
  household_id: string;
  name: string;
  subscribed_kva: number;
  alert_margin_kwh: number;
  leak_start_hour: number;
  leak_end_hour: number;
  leak_min_minutes: number;
  active_device_id: string | null;
  devices: DeviceStatus[];
  demo_mode: boolean;
  address?: string | null;
  occupants?: number | null;
  onboarding_done?: boolean;
}

export type SettingsIn = Partial<
  Pick<
    Settings,
    "name" | "subscribed_kva" | "alert_margin_kwh" | "leak_start_hour" | "leak_end_hour" | "leak_min_minutes"
  >
> & { active_device_id?: string; clear_active_device?: boolean };

export interface TrancheRow {
  id?: number | null;
  resource: Resource;
  min_qty: number;
  max_qty: number | null;
  price_millimes: number;
  vat_rate: number;
  valid_from: string;
}

export interface FeeRow {
  id?: number | null;
  key: string;
  value_millimes: number;
  valid_from: string;
}

export interface Tariffs {
  tranches: TrancheRow[];
  fees: FeeRow[];
  pricing_mode?: string | null;
}

export interface SpikeOut {
  status: "queued";
  device_id: string;
  simulator_online: boolean;
  extra_w: number;
  duration_s: number;
  energy_kwh: number;
  message: string;
}

// ---- Device payload (POST /api/readings), as the ESP32 sends it ----------------------

export interface ReadingIn {
  device_id: string;
  timestamp: string; // ISO 8601 with time zone
  electricity: {
    voltage_v: number;
    current_a: number;
    power_w: number;
    energy_kwh: number; // cumulative, never goes down
    frequency_hz: number;
    power_factor: number;
  } | null; // null = the sensor did not answer
  water: {
    flow_l_min: number;
    total_l: number; // cumulative, never goes down
    pulses_delta: number;
    calib_pulses_per_l: number;
  } | null;
  signal_ok: boolean;
}

export interface DemoCommand {
  type: "spike";
  extra_w: number;
  duration_s: number;
  energy_kwh: number;
}

export interface IngestOut {
  id: number;
  device_id: string;
  ts: string;
  alerts_created: number;
  commands: DemoCommand[];
}

// ---- Phase 2: accounts, households, appliances, assistant, history, support, admin ----

export interface CodeSent {
  status: "sent";
  email: string;
  expires_in_min: number;
  /** Demo without SMTP: the code is shown on screen. */
  dev_code: string | null;
}

export interface Household {
  id: string;
  name: string;
  address: string | null;
  occupants: number | null;
  subscribed_kva: number;
  alert_margin_kwh: number;
  onboarding_done: boolean;
  created_at: string;
  devices: DeviceStatus[];
  appliance_count: number;
  unread_alerts: number;
}

export interface HouseholdIn {
  name: string;
  address?: string | null;
  occupants?: number | null;
  subscribed_kva: number;
  alert_margin_kwh: number;
}

export interface DeviceCreated {
  device: DeviceStatus;
  api_key: string;
}

export interface ApplianceIn {
  category: string;
  name: string;
  quantity: number;
  power_w: number | null;
  hours_per_day: number | null;
  start_hour?: number | null;
  end_hour?: number | null;
}

export interface Appliance extends ApplianceIn {
  id: string;
  effective_power_w: number;
  effective_hours_per_day: number;
  estimated_kwh_month: number;
}

export interface ApplianceCatalogItem {
  category: string;
  typical_power_w: number;
  typical_hours_per_day: number;
  icon: string;
}

export interface ApplianceShare {
  id: string | null;
  category: string;
  name: string;
  kwh_month: number;
  share_pct: number;
  cost_dt: number | null;
}

export type ConsumptionStatus = "normal" | "attention" | "warning" | "critical" | "unavailable";

export interface Insights {
  generated_at: string;
  profile_kwh_month: number | null;
  measured_month_kwh: number;
  forecast_kwh: number | null;
  forecast_bill_dt: number | null;
  breakdown: ApplianceShare[];
  last7_kwh_per_day: number | null;
  previous_kwh_per_day: number | null;
  trend_pct: number | null;
  unusual_increase: boolean;
  water_last7_l_per_day: number | null;
  water_previous_l_per_day: number | null;
  water_trend_pct: number | null;
  water_forecast_l: number | null;
  status: ConsumptionStatus;
  status_reasons: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatFact {
  label: string;
  value: string;
  kind: "measured" | "forecast" | "assumption" | "profile";
}

export interface ChatOut {
  intent: string;
  answer: string;
  facts: ChatFact[];
  suggestions: string[];
  source: "rule" | "llm";
}

export interface HistoryMonth {
  month: string;
  kwh: number;
  litres: number;
  bill_dt: number | null;
  water_bill_dt: number | null;
  tranche_index: number | null;
  partial: boolean;
}

export interface Ticket {
  id: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: "open" | "answered" | "closed" | string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  email_verified: boolean;
  language: string;
  created_at: string;
  last_login_at: string | null;
  households: number;
}

export interface AdminDevice {
  id: string;
  kind: string;
  household_id: string;
  household_name: string;
  owner_email: string;
  online: boolean;
  last_seen_at: string | null;
  last_reading_at: string | null;
  last_signal_ok: boolean | null;
  sensor_faults_7d: number;
}

export interface AdminHousehold {
  id: string;
  name: string;
  owner_email: string;
  subscribed_kva: number;
  devices: number;
  devices_online: number;
  appliances: number;
  unread_alerts: number;
  created_at: string;
}

export interface AdminSystem {
  generated_at: string;
  uptime_s: number;
  database: string;
  database_ok: boolean;
  database_latency_ms: number | null;
  requests_total: number;
  errors_5xx: number;
  readings_rejected: number;
  readings_last_hour: number;
  devices_total: number;
  devices_online: number;
  alerts_24h: number;
  emails_sent: number;
  emails_failed: number;
  emails_logged: number;
  email_mode: "smtp" | "log";
  llm_configured: boolean;
  open_tickets: number;
  users_total: number;
  households_total: number;
  recent_errors: string[];
}

export interface TariffAudit {
  id: number;
  admin_email: string;
  summary: string;
  before: Tariffs | null;
  after: Tariffs | null;
  created_at: string;
}
