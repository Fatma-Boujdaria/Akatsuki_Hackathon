// Mirrors backend/app/schemas.py. Dates are ISO 8601 strings (UTC).

export type Resource = "electricity" | "water";

export interface User {
  id: string;
  email: string;
  role: "household" | "admin" | string;
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
