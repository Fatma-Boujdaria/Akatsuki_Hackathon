// Writing numbers in French (charter board 04):
//   1 380 W       thin space for thousands
//   6,2 L/min     decimal comma
//   0,176 DT      unit price: 3 decimals, DT after
//   ≈ 66 DT       forecast: ≈, rounded
//   21 nov. · 14:02   24-hour clock

export const TZ = "Africa/Tunis";
const NBSP = " "; // between a number and its unit, so they never wrap apart

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}-${max}`;
  let f = nfCache.get(key);
  if (!f) {
    // fr-FR groups thousands with a narrow no-break space (U+202F).
    f = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max });
    nfCache.set(key, f);
  }
  return f;
}

export function num(value: number, decimals = 0, fixed = true): string {
  // Intl groups with U+202F, which Space Grotesk draws almost zero-wide once the hero
  // tracking is applied ("6289"). A no-break space keeps "6 289" readable and unbroken.
  return nf(fixed ? decimals : 0, decimals).format(value).replace(/\u202f/g, NBSP);
}

/** kWh left / used: integer from 10, one decimal below (dropped when round). */
export function kwhValue(value: number): string {
  return Math.abs(value) >= 10 ? num(Math.round(value)) : num(value, 1, false);
}
export const kwh = (v: number) => `${kwhValue(v)}${NBSP}kWh`;
export const watts = (v: number) => `${num(Math.round(v))}${NBSP}W`;
export const flow = (v: number) => `${num(v, 1)}${NBSP}L/min`;
export const litres = (v: number) => `${num(Math.round(v))}${NBSP}L`;
export const m3 = (v: number) => `${num(v, v < 10 ? 2 : 1, false)}${NBSP}m³`;
export const volts = (v: number) => `${num(v, 1)}${NBSP}V`;
export const amps = (v: number) => `${num(v, 2)}${NBSP}A`;
export const hertz = (v: number) => `${num(v, 1)}${NBSP}Hz`;

/** Unit price: 3 decimals, DT after. */
export const dtUnit = (v: number) => `${num(v, 3)}${NBSP}DT`;
/** Forecast amount: rounded, with ≈. */
export const dtRound = (v: number) => `≈${NBSP}${num(Math.round(v))}${NBSP}DT`;
/** An estimated amount (cost of a jump, a saving): precision follows the size. */
export function dt(v: number): string {
  const a = Math.abs(v);
  const decimals = a < 10 ? 2 : a < 100 ? 1 : 0;
  return `${num(v, decimals, false)}${NBSP}DT`;
}
export const dtApprox = (v: number) => `≈${NBSP}${dt(v)}`;

// ---- Dates, always in Tunisian local time ------------------------------------------

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts);
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...opts });
    dtfCache.set(key, f);
  }
  return f;
}

const toDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

/** 14:02 */
export const time = (d: Date | string) => dtf({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(toDate(d));
/** 21 nov. */
export const dayMonth = (d: Date | string) => dtf({ day: "numeric", month: "short" }).format(toDate(d));
/** 21 nov. · 14:02 */
export const dateTime = (d: Date | string) => `${dayMonth(d)} · ${time(d)}`;
/** sam. 21 nov. */
export const weekdayDayMonth = (d: Date | string) =>
  dtf({ weekday: "short", day: "numeric", month: "short" }).format(toDate(d));
/** novembre */
export const monthName = (d: Date | string) => dtf({ month: "long" }).format(toDate(d));
/** sam. */
export const weekdayShort = (d: Date | string) => dtf({ weekday: "short" }).format(toDate(d));

/** "il y a 4 s", "il y a 3 min", "il y a 2 h", "le 21 nov." */
export function ago(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `il y a ${s}${NBSP}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m}${NBSP}min`;
  const h = Math.round(m / 60);
  if (h < 48) return `il y a ${h}${NBSP}h`;
  return `il y a ${Math.round(h / 24)}${NBSP}jours`;
}

/** "4 s", "3 min", "2 h": compact age for pills. */
export function shortAge(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}${NBSP}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}${NBSP}min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}${NBSP}h`;
  return `${Math.round(h / 24)}${NBSP}j`;
}

export function hourLabel(h: number): string {
  return `${h}${NBSP}h`;
}
