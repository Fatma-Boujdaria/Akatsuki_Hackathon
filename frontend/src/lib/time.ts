import { TZ } from "./format";

/** Year, month (1-12), day, hour, minute of an instant in Tunisian local time. */
export function localParts(d: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/** "+01:00" for Africa/Tunis (no DST since 2009); computed, with a safe fallback. */
export function tzOffset(d: Date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = name?.match(/GMT([+-]\d{2}:\d{2})/);
    if (m) return m[1];
    if (name === "GMT") return "+00:00";
  } catch {
    /* older browser */
  }
  return "+01:00";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO string of local midnight, e.g. 2026-11-21T00:00:00+01:00 */
export function localMidnightIso(y: number, mo: number, d: number): string {
  return `${y}-${pad(mo)}-${pad(d)}T00:00:00${tzOffset()}`;
}

export function todayStartIso(now = new Date()): string {
  const p = localParts(now);
  return localMidnightIso(p.y, p.mo, p.d);
}

export function monthStartIso(now = new Date()): string {
  const p = localParts(now);
  return localMidnightIso(p.y, p.mo, 1);
}

export function daysInMonth(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Whole days left after today in the local month (21 nov. -> 9). */
export function daysLeftInMonth(now = new Date()): number {
  const p = localParts(now);
  return daysInMonth(p.y, p.mo) - p.d;
}

/** Fractional local day of month (1.0 = 1st at 00:00). */
export function fractionalDay(now = new Date()): number {
  const p = localParts(now);
  return p.d + (p.h + p.mi / 60) / 24;
}

/** Fractional local hour of day (0-24). */
export function fractionalHour(d: Date): number {
  const p = localParts(d);
  return p.h + p.mi / 60;
}
