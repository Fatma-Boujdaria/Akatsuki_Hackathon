import type { ElectricitySummary } from "./types";
import { L } from "./i18n";
import { daysInMonth, fractionalDay, localParts } from "./time";

export type TrancheState = "safe" | "near" | "crossed" | "top" | "none";

export interface TrancheView {
  state: TrancheState;
  used: number;
  /** Next threshold to watch (200, 300, 500), null above the last one. */
  next: number | null;
  /** Threshold already crossed this month (lower bound of the current band), if any. */
  crossedAt: number | null;
  left: number | null;
  /** "201–300 kWh" (the band after the next threshold). */
  nextBandLabel: string | null;
  /** "1–200 kWh": the current band. */
  currentBandLabel: string | null;
  forecast: number | null;
  /** Right end of the bar. */
  scaleMax: number;
  /** Threshold marks drawn on the bar (Encre). */
  marks: number[];
  /** Forecast date of crossing the next threshold, if the pace says so this month. */
  crossingDate: Date | null;
  forecastCrosses: boolean;
}

function bandLabel(lo: number, hi: number | null): string {
  if (hi == null) return `${L("plus de", "over", "أكثر من")} ${Math.round(lo)} kWh`;
  return `${Math.round(lo) + (lo > 0 ? 1 : 0)}–${Math.round(hi)} kWh`;
}

/**
 * Everything the tranche bar and the hero number need, derived from /api/dashboard.
 * `margin` is the alert margin from the settings (default 10 kWh): within it, the
 * tranche is "near" and turns Harissa.
 */
export function trancheView(e: ElectricitySummary, margin = 10, now = new Date()): TrancheView {
  const used = e.month_kwh;
  const thresholds = [...e.thresholds_kwh].sort((a, b) => a - b);
  const next = e.next_threshold_kwh;
  const forecast = e.forecast.available ? e.forecast.qty : null;
  const crossedAt = [...thresholds].reverse().find((t) => used > t) ?? null;

  if (!thresholds.length) {
    return {
      state: "none",
      used,
      next: null,
      crossedAt: null,
      left: null,
      nextBandLabel: null,
      currentBandLabel: null,
      forecast,
      scaleMax: Math.max(used, forecast ?? 0, 1) * 1.2,
      marks: [],
      crossingDate: null,
      forecastCrosses: false,
    };
  }

  const nextIdx = next == null ? -1 : thresholds.indexOf(next);
  const after = nextIdx >= 0 ? (thresholds[nextIdx + 1] ?? null) : null;
  const left = e.kwh_to_next_threshold ?? (next != null ? Math.max(0, next - used) : null);

  let state: TrancheState;
  if (next == null) state = "top";
  else if (left != null && left <= margin) state = "near";
  else if (crossedAt != null) state = "crossed";
  else state = "safe";

  // Scale, like the charter: 0–300 while watching 200 (the next band is visible);
  // once 200 is crossed, 0–300 too, so the hatched extra sits right after the 200 mark.
  let scaleMax: number;
  if (next == null) scaleMax = Math.max(used, forecast ?? 0) * 1.15;
  else if (crossedAt != null) scaleMax = next;
  else scaleMax = after ?? next * 1.5;
  if (forecast != null && forecast > scaleMax && next != null) scaleMax = Math.max(scaleMax, Math.min(forecast, scaleMax * 1.35));
  const lo = crossedAt ?? 0;
  const marks = thresholds.filter((t) => t > 0 && t <= scaleMax);

  // When does the pace cross the next threshold? Linear between now and the month end.
  let crossingDate: Date | null = null;
  const forecastCrosses = next != null && forecast != null && forecast > next;
  if (forecastCrosses && next != null && forecast != null) {
    const p = localParts(now);
    const total = daysInMonth(p.y, p.mo);
    const daysLeft = Math.max(0.01, total + 1 - fractionalDay(now));
    const perDay = (forecast - used) / daysLeft;
    if (perDay > 0) crossingDate = new Date(now.getTime() + ((next - used) / perDay) * 86_400_000);
  }

  return {
    state,
    used,
    next,
    crossedAt,
    left,
    nextBandLabel: next != null ? bandLabel(next, after) : null,
    currentBandLabel: bandLabel(lo, next),
    forecast,
    scaleMax,
    marks,
    crossingDate,
    forecastCrosses,
  };
}
