// The Cartheco day (scenario G of the catalogue): one Saturday in the Ben Salah home, 06:00 to 07:30 the next
// morning, played after the installation tour. The plan says what is on at each hour; the engine mirrors the
// backend rules (alerts.py, insights.py, tips.py) so the phone shows what the real app would show:
//   - one tranche alert per threshold and month (forecast or near, whichever comes first)
//   - leak: non-stop flow for 2 h inside the 01:00-05:00 window
//   - sensor fault: the ESP32 sends electricity: null
//   - offline after 30 s without a reading, alert after 5 min, closed when the device is back
//   - status, worst first: unavailable > critical > warning > attention > ok
// No three.js here.
import {ALERT_MARGIN, APPLIANCES, THRESHOLDS, WATER_MODES, bill} from './model.js';

export const DAY_T0 = 57; // tour time when the day starts (the installation tour lasts 57 s)
export const DAY_LEN = 102; // seconds on screen for the whole day
export const H0 = 6; // 06:00 on Saturday 28 November
export const H1 = 31.5; // 07:30 on Sunday 29 November
export const DAY_CLOCK = ((H1 - H0) * 3600) / DAY_LEN; // day seconds per screen second (900: 1 s = 15 min)
export const E_DAY_START = 175.3; // kWh this month at 06:00: enters the 10 kWh margin at about 19:30
export const hourAt = (t) => H0 + ((t - DAY_T0) / DAY_LEN) * (H1 - H0);
export const tAtHour = (h) => DAY_T0 + ((h - H0) / (H1 - H0)) * DAY_LEN;

// the 7-day moving average of the backend: the 6 previous days used 48 kWh (8 kWh a day)
const PAST_KWH = 48;
const PAST_HOURS = 144;
const MONTH_END_H = 72; // hours from Saturday 28 00:00 to the end of 30 November
const LEAK_START = 25; // 01:00 on Sunday
const LEAK_MIN_H = 2; // the leak rule: 2 h of non-stop flow inside the window
const between = (h, a, b) => h >= a && h < b;

export const clockText = (h) => {
  const m = Math.floor(((h % 24) + 24) % 24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const dateText = (h) => (h < 24 ? 'Samedi 28 novembre' : 'Dimanche 29 novembre');
export const isoStamp = (h) => `2026-11-${h < 24 ? '28' : '29'}T${clockText(h)}:00+01:00`;

/** What is on in the house at day hour h. */
export function planAt(h) {
  return {
    on: {
      lights: between(h, 6, 7.5) || between(h, 18, 23.5) || between(h, 30.5, 31.5) ? 1 : 0,
      heater: between(h, 19, 21) ? 1 : 0,
      ac: between(h, 13, 19) || between(h, 21, 22) ? 1 : 0,
      oven: between(h, 19, 21) ? 1 : 0,
      kettle: between(h, 7, 7.25) ? 1 : 0,
      radiator: between(h, 19, 21) ? 1 : 0,
    },
    water: between(h, 7, 7.12) ? 'tap' : between(h, LEAK_START, 30.75) ? 'leak' : 'off',
    pzemMute: between(h, 22, 22.67),
    powerCut: between(h, 28, 28.67),
    ack: h >= 31,
    leakFixed: h >= 30.75,
  };
}

/** 1 in daylight, 0 at night, smooth at dawn and dusk. */
export function daylightAt(h) {
  const d = ((h % 24) + 24) % 24;
  const s = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  return Math.min(s(6, 7.5, d), 1 - s(18.3, 19.8, d));
}

// appliance guess from a power rise >= 800 W (ingest.py, APPLIANCE_SIGNATURES)
export function guessAppliance(stepW) {
  if (stepW < 800) return null;
  if (stepW < 1300) return 'Climatiseur ou micro-ondes';
  if (stepW < 1800) return 'Climatiseur ou fer à repasser';
  if (stepW < 2600) return 'Chauffe-eau électrique ou bouilloire';
  if (stepW < 4000) return 'Four, radiateur ou plaque de cuisson';
  return 'Plusieurs gros appareils';
}

const num = (x, d = 0) => Number(x).toLocaleString('fr-FR', {minimumFractionDigits: d, maximumFractionDigits: d});
const dt = (x) => `${num(x, 2)} DT`;
const W_OF = Object.fromEntries(APPLIANCES.map((a) => [a.id, a.w]));

export function createDayEngine() {
  const D = {};
  const reset = (E) => {
    Object.assign(D, {
      active: true,
      h: H0,
      todayKwh: 0,
      startE: E,
      alerts: [],
      steps: [],
      prevOn: planAt(H0).on,
      lastSeenH: H0,
      tips: [],
      status: 'ok',
      reasons: [],
    });
  };
  const has = (key) => D.alerts.find((a) => a.key === key);
  const push = (key, a) => {
    if (has(key)) return null;
    const alert = {key, h: D.h, time: clockText(D.h), open: true, ...a};
    D.alerts.unshift(alert);
    return alert;
  };

  /** One step of the day. S is the live state (E, Q...), h the day hour now. */
  const tick = (S, h) => {
    const plan = planAt(h);
    D.h = h;
    D.todayKwh = S.E - D.startE;
    const next = THRESHOLDS.find((x) => x > S.E) ?? null;
    const left = next === null ? null : next - S.E;
    const rate = (PAST_KWH + D.todayKwh) / (PAST_HOURS + (h - H0));
    D.forecast = S.E + rate * Math.max(0, MONTH_END_H - h);
    D.next = next;
    D.left = left;
    D.billNow = bill(S.E);

    // big consumers: a step of >= 800 W when appliances switch on together
    let rise = 0;
    for (const k of Object.keys(plan.on)) rise += (plan.on[k] - (D.prevOn[k] ?? 0)) * W_OF[k];
    const guess = guessAppliance(rise);
    if (guess && !plan.powerCut) D.steps.unshift({h, time: clockText(h), w: rise, label: guess});
    D.prevOn = plan.on;

    // tranche: one alert per threshold and month, forecast or near
    const th200 = 200;
    if (S.E < th200 && (D.forecast > th200 || th200 - S.E <= ALERT_MARGIN)) {
      const near = th200 - S.E <= ALERT_MARGIN;
      const extra = bill(th200 + 1) - bill(th200);
      push(`threshold:200`, {
        type: 'threshold',
        sev: 'warning',
        title: 'Tranche',
        msg: near
          ? `Encore ${num(th200 - S.E, 0)} kWh avant la tranche suivante (200 kWh). La franchir coûterait environ ${dt(extra)} de plus sur ta facture du mois (estimation).`
          : `Au rythme actuel, tu vas dépasser 200 kWh ce mois-ci (prévision : ${num(D.forecast, 1)} kWh). Passer cette tranche coûterait environ ${dt(extra)} de plus (estimation).`,
      });
    }

    // sensor fault (D1): once per device and day
    if (plan.pzemMute)
      push('sensor:elec', {type: 'sensor_fault', sev: 'warning', title: 'Capteur muet', msg: "Le capteur électricité (PZEM-004T) de l'appareil tg-001 ne répond pas. Vérifie son câblage."});

    // leak (C4): flow since 01:00, window 01:00-05:00, 2 h
    if (plan.water === 'leak' && h >= LEAK_START + LEAK_MIN_H && h < LEAK_START + 4) {
      const hours = h - LEAK_START;
      push('leak', {
        type: 'leak',
        sev: 'critical',
        title: 'Fuite probable',
        msg: `Fuite probable : l'eau coule sans arrêt depuis 01:00 (${Math.floor(hours)} h ${String(Math.round((hours % 1) * 60)).padStart(2, '0')}), environ ${num(WATER_MODES.leak * 60 * hours)} L utilisés. Vérifie la chasse d'eau et les robinets.`,
      });
    }

    // connectivity (E2, E3, E4)
    if (!plan.powerCut) D.lastSeenH = h;
    D.lastSeen = clockText(Math.round(D.lastSeenH * 60) / 60);
    const silentS = (h - D.lastSeenH) * 3600;
    D.offline = silentS > 30;
    if (silentS > 300) push('offline', {type: 'device_offline', sev: 'warning', title: 'Hors ligne', msg: `Appareil tg-001 hors ligne depuis ${D.lastSeen}. Vérifie le Wi-Fi et l'alimentation.`});
    if (!plan.powerCut) {
      const off = has('offline');
      if (off && off.open) {
        off.open = false;
        off.closedBy = 'retour';
      }
    }

    // next morning: alerts seen ("Vu", F5)
    if (plan.ack) for (const a of D.alerts) a.open = false;

    // status, worst first (insights.py)
    const open = (type) => D.alerts.some((a) => a.type === type && a.open);
    const reasons = [];
    if (D.offline) reasons.push('offline');
    if (open('leak')) reasons.push('leak');
    if (S.E > 200 && open('threshold')) reasons.push('crossed');
    if (left !== null && left <= ALERT_MARGIN) reasons.push('near_threshold');
    if (next !== null && D.forecast > next) reasons.push('forecast_crosses');
    D.reasons = reasons;
    D.status = reasons.includes('offline')
      ? 'unavailable'
      : reasons.includes('leak') || reasons.includes('crossed')
        ? 'critical'
        : reasons.includes('near_threshold')
          ? 'warning'
          : reasons.includes('forecast_crosses')
            ? 'attention'
            : 'ok';

    // tips of the next morning, DT from the tariff (tips.py: leak, standby)
    D.tips = [];
    if (plan.leakFixed) {
      D.tips.push(`Fuite réparée : environ ${num(WATER_MODES.leak * 60 * 24)} L d'eau en moins par jour, soit ≈ 20 DT par mois sur la facture SONEDE (estimation).`);
      const baseW = W_OF.fridge + W_OF.standby;
      const saveKwh = (baseW / 2 / 1000) * Math.max(0, MONTH_END_H - h);
      D.tips.push(`Ta maison consomme au moins ${num(baseW)} W en permanence. En divisant cette veille par deux : ≈ ${num(saveKwh, 1)} kWh et ${dt(bill(D.forecast) - bill(D.forecast - saveKwh))} d'ici la fin du mois.`);
    }
    return plan;
  };
  return {D, reset, tick};
}

// Captions of the day, in the tour's [time, title, text] format (times are tour seconds).
export const DAY_CAPTIONS = [
  [tAtHour(6), 'Cartheco, one day at the Ben Salah home', 'Saturday 28 November, 06:00. The month stands at 175 kWh, the 200 kWh tranche is close. Only the fridge and the router run: about 210 W.'],
  [tAtHour(7), '07:00 Breakfast', 'Kettle on: +2,100 W. Cartheco tags the jump as "Chauffe-eau électrique ou bouilloire" in the day\'s big consumers. The tap runs at 4 L/min.'],
  [tAtHour(13), '13:00 The air conditioner all afternoon', '+1,350 W for hours. By mid-afternoon the month\'s forecast passes 200 kWh: one tranche alert, status "attention".'],
  [tAtHour(19), '19:00 Dinner', 'Oven, heater and water heater: about 6.4 kW, more than the 6 kVA subscribed. The month enters the 10 kWh margin: status "warning".'],
  [tAtHour(21), '21:00 The threshold is crossed', 'One more hour of AC: 200 kWh passed. Every kWh of the month is now at tranche 2, about 9.74 DT more on the bill: status "critical".'],
  [tAtHour(22), '22:00 The PZEM wire comes loose', 'The ESP32 sends electricity: null. Cartheco shows "capteur muet" and never invents a value. Plugged back 40 minutes later.'],
  [tAtHour(25), '01:00 A silent leak', 'The toilet leaks 0.4 L/min and the flow never drops to zero. The leak rule watches the 01:00 to 05:00 window.'],
  [tAtHour(27), '03:00 Leak alert', 'Two hours of non-stop flow: red alert on the phone, about 48 L lost so far, once for the night.'],
  [tAtHour(28), '04:00 Power cut', 'The ESP32 goes off too. After 30 s the data is "ancien" and the device offline, after 5 min an alert. Power back at 04:40: the alert closes by itself.'],
  [tAtHour(30.5), 'Next morning', 'The flapper is replaced, the alerts are marked "Vu", and the tips show the dinars saved: the leak, and halving the standby load.'],
];
