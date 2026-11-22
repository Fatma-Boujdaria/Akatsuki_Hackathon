// The numbers. Every gauge, label and moving part reads from these functions, so the screen never disagrees with
// the motion. No three.js here. Sources: the Cartheco backend (tariff.py, alerts.py, insights.py), the blueprint
// payload, and the sensor datasheets (PZEM-004T 100 A with its 100 A : 100 mA clamp, YF-S201 with f = 7.5 x Q).

// ------------------------------------------------------------ electricity
// The house loads. The base set (fridge, standby, lights, water heater) gives the blueprint's sample reading:
// 1380 W at about 231 V and 6.4 A.
// Powers of the day story follow the scenario catalogue: AC 1 350 W (A3), kettle 2 100 W (A4), oven 3 000 W (A5).
export const APPLIANCES = [
  {id: 'fridge', name: 'Fridge', w: 150, pf: 0.8, fixed: true},
  {id: 'standby', name: 'Router and standby', w: 60, pf: 0.9, fixed: true},
  {id: 'lights', name: 'Lights', w: 120, pf: 0.95},
  {id: 'heater', name: 'Water heater', w: 1050, pf: 1.0},
  {id: 'ac', name: 'Air conditioner', w: 1350, pf: 0.9},
  {id: 'oven', name: 'Oven', w: 3000, pf: 1.0},
  {id: 'kettle', name: 'Kettle', w: 2100, pf: 1.0},
  {id: 'radiator', name: 'Heater', w: 2000, pf: 1.0},
];
export const SWITCHABLE = APPLIANCES.filter((a) => !a.fixed);
export const SUBSCRIBED_KVA = 6;
// split-core clamp of the PZEM-004T 100 A: 100 A in, 100 mA out
export const CT_RATIO = 1000;

/** levels: {id: 0..1} (an appliance ramps in), t: seconds (slow mains drift). */
export function electricity(levels, t) {
  let P = 0;
  let S = 0;
  for (const a of APPLIANCES) {
    const k = a.fixed ? 1 : levels[a.id] ?? 0;
    P += k * a.w;
    S += (k * a.w) / a.pf;
  }
  const V = 231.2 + 1.1 * Math.sin(0.21 * t) + 0.4 * Math.sin(0.047 * t + 1);
  const I = S / V;
  return {
    V,
    I,
    P,
    S,
    pf: S > 0 ? P / S : 1,
    hz: 50 + 0.02 * Math.sin(0.11 * t),
    ctmA: (I / CT_RATIO) * 1000,
  };
}

// ------------------------------------------------------------ STEG tariff, as stored in Cartheco (STEG grid of May 2022)
// Home over 2 kVA: 176 / 218 / 341 / 414 millimes per kWh, the tranche reached prices every kWh of the month.
// VAT 13 % on energy, 19 % on the kVA fee (700 millimes per kVA), taxes 5 + 1 millimes per kWh.
export const TRANCHES = [
  {from: 0, to: 200, p: 176, name: '0-200 kWh'},
  {from: 200, to: 300, p: 218, name: '201-300 kWh'},
  {from: 300, to: 500, p: 341, name: '301-500 kWh'},
  {from: 500, to: Infinity, p: 414, name: 'over 500 kWh'},
];
export const THRESHOLDS = [200, 300, 500];
export const ALERT_MARGIN = 10; // kWh, the Settings default
export const tranche = (E) => TRANCHES.find((t) => E <= t.to) ?? TRANCHES[3];

/** bill in DT, an estimate: kVA x 0.700 x 1.19 + E x p_tranche x 1.13 + E x 0.006 */
export function bill(E, kva = SUBSCRIBED_KVA) {
  return kva * 0.7 * 1.19 + E * (tranche(E).p / 1000) * 1.13 + E * 0.006;
}

/** The tranche panel: where the month stands, the next threshold, what crossing it costs. */
export function trancheInfo(E) {
  const tr = tranche(E);
  const next = THRESHOLDS.find((x) => x > E) ?? null;
  const left = next === null ? null : next - E;
  const jump = next === null ? 0 : bill(next + 1) - bill(next);
  return {E, tr, next, left, jump, bill: bill(E), price: (tr.p / 1000) * 1.13 + 0.006, alert: left !== null && left <= ALERT_MARGIN};
}

// The month runs fast in this demo: 1 s on screen is 10 min of energy. Water runs in real time.
export const ENERGY_CLOCK = 600;
export const STEG_INDEX_AT_MONTH_START = 12482; // kWh on the meter's display when the month began
export const E_START = 182.0; // kWh used this month when the tour starts (the blueprint's 182 / 200 example)

// ------------------------------------------------------------ water
export const WATER_MODES = {off: 0, tap: 4.0, shower: 9.0, leak: 0.4}; // L/min (catalogue C1, C2, C4)
// YF-S201: pulse frequency f (Hz) = 7.5 x Q (L/min), so 450 pulses per litre (to calibrate on the real pipe)
export const YF_K = 7.5;
export const PULSES_PER_L = 450;
// 1/2" pipe, about 16 mm inside: flow speed in m/s for Q in L/min
const PIPE_AREA = Math.PI * 0.008 * 0.008;
export const pipeSpeed = (Q) => Q / 60000 / PIPE_AREA;
export const WATER_TOTAL_START = 18420.5; // litres counted by the sensor so far (kept in flash)
export const SONEDE_INDEX_START = 184.205; // m3 on the SONEDE meter

export function water(Q) {
  return {Q, hz: YF_K * Q, v: pipeSpeed(Q)};
}

// ------------------------------------------------------------ the reading the ESP32 posts (blueprint payload)
export function payload(s) {
  const ok = s.signalOk;
  if (s.pzemMute || s.yfMute) return payloadWithFaults(s);
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  return {
    device_id: 'tg-001',
    timestamp: s.stamp,
    electricity: {
      voltage_v: r1(s.el.V),
      current_a: ok ? r2(s.el.I) : 0,
      power_w: ok ? Math.round(s.el.P) : 0,
      energy_kwh: r2(s.E),
      frequency_hz: r1(s.el.hz),
      power_factor: ok ? r2(s.el.pf) : 0,
    },
    water: {
      flow_l_min: r1(s.Q),
      total_l: r1(s.waterTotal),
      pulses_delta: s.pulsesDelta,
      calib_pulses_per_l: PULSES_PER_L,
    },
    signal_ok: ok,
  };
}

// D1 / D2: a sensor that does not answer is sent as null, never as a made-up value.
function payloadWithFaults(s) {
  const p = payload({...s, pzemMute: false, yfMute: false});
  if (s.pzemMute) p.electricity = null;
  if (s.yfMute) p.water = null;
  return p;
}
