// The auto tour: an operator walks the house, fits the current clamp on the phase wire, runs a consumption peak,
// then fits the flow sensor after the SONEDE meter and ends on the ESP32 posting its reading. Views are functions of
// u (seconds since the view came on); the tour's settings are pure functions of the tour time.

import {DAY_CAPTIONS, DAY_LEN, DAY_T0, tAtHour} from './day.js';

// Installation (0 to 57 s), then the Cartheco day (57 s to 159 s).
export const DURATION = DAY_T0 + DAY_LEN;
const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => sm((t - a) / (b - a));

// target, azimuth (deg, from +z toward +x), elevation (deg), distance (m), x-ray of the walls in front (0 or 1)
export const VIEW_FN = {
  house: (u) => ({tx: 0.2, ty: 1.2, tz: 0.8, az: 32 + 7 * Math.sin(u * 0.16), el: 18 + 2 * Math.sin(u * 0.1), d: 25, x: 0, sx: 0, sy: 30}),
  steg: (u) => ({tx: -2.61, ty: 1.34, tz: 3.44, az: 12 + 4 * Math.sin(u * 0.3), el: 9, d: 1.75, x: 0, sx: 0, sy: 26}),
  ct: (u) => ({tx: -2.42, ty: 1.655, tz: 3.24, az: 206 + 5 * Math.sin(u * 0.35), el: 13, d: 0.62, x: 1, sx: 0, sy: 26}),
  box: (u) => ({tx: -2.24, ty: 1.39, tz: 3.25, az: 176 + 4 * Math.sin(u * 0.3), el: 7, d: 1.45, x: 1, sx: 0, sy: 26}),
  sonede: (u) => ({tx: -1.17, ty: 0.25, tz: 3.44, az: 13 + 4 * Math.sin(u * 0.3), el: 30, d: 1.02, x: 0, sx: 0, sy: 26}),
  flow: (u) => ({tx: -0.68, ty: 0.21, tz: 3.22, az: 198 + 4 * Math.sin(u * 0.3), el: 22, d: 0.54, x: 1, sx: 0, sy: 26}),
  esp: (u) => ({tx: -2.02, ty: 1.335, tz: 3.27, az: 186 + 3 * Math.sin(u * 0.3), el: 4, d: 0.56, x: 1, sx: 0, sy: 24}),
};

export const SCRIPT = [
  {t: 0, view: 'house'},
  {t: 2.6, water: 'tap'},
  {t: 6.0, view: 'steg'},
  {t: 10.0, set: 'poseE', v: 0},
  {t: 10.4, view: 'ct'},
  {t: 11.8, slide: 'poseE', from: 0, to: 1, dur: 3.8},
  {t: 20.0, view: 'box'},
  {t: 24.6, peak: true},
  {t: 30.6, view: 'sonede'},
  {t: 31.8, peak: false},
  {t: 35.0, set: 'poseW', v: 0},
  {t: 35.4, view: 'flow'},
  {t: 36.8, slide: 'poseW', from: 0, to: 1, dur: 5.0},
  {t: 47.0, view: 'esp'},
  {t: 52.0, view: 'house'},
  {t: 53.6, xray: 1},
  // the Cartheco day: appliances, water and faults come from day.js; the tour only moves the camera
  {t: tAtHour(6), xray: 0},
  {t: tAtHour(6.8), xray: 1},
  {t: tAtHour(8.5), xray: 0},
  {t: tAtHour(19), view: 'box'},
  {t: tAtHour(20.4), view: 'house'},
  {t: tAtHour(21.8), view: 'box'},
  {t: tAtHour(23), view: 'house'},
  {t: tAtHour(25), view: 'flow'},
  {t: tAtHour(26.6), view: 'house'},
  {t: tAtHour(26.8), xray: 1},
  {t: tAtHour(27.8), view: 'esp'},
  {t: tAtHour(29.2), view: 'house'},
  {t: tAtHour(29.4), xray: 0},
];

export const CAPTIONS = [
  [0, 'The house', 'Cartheco adds one small box next to the electrical panel and one flow sensor on the water pipe.'],
  [6.0, 'STEG meter', 'The STEG meter and its main breaker stay sealed. Nothing is installed on the STEG side.'],
  [10.4, 'Fitting the current clamp', 'At the panel inside, a split-core clamp opens and closes around the phase wire (L) only, never around L and N together.'],
  [15.9, 'How the clamp measures', 'The wire is never cut. The AC current induces a copy 1000 times smaller in the clamp: 6.4 A in the wire, 6.4 mA out.'],
  [20.0, 'The sensor box', 'The PZEM-004T reads the clamp and the mains voltage from a dedicated 2 A breaker, then sends V, A, W and kWh to the ESP32 over serial.'],
  [24.6, 'Consumption peak', 'The AC and the oven switch on: the current jumps, the field around the wire grows, and the month gets close to the 200 kWh tranche.'],
  [30.6, 'SONEDE meter', 'Water side: the SONEDE meter and its stopcock stay sealed too. The flow sensor goes after them, on the household pipe.'],
  [35.4, 'Fitting the flow sensor', 'Close the household valve, open the pipe at the unions, fit the YF-S201 with its arrow pointing into the house, then reopen.'],
  [42.2, 'How the flow sensor counts', 'Water spins a rotor with a magnet; a Hall sensor makes 7.5 pulses per second per L/min (about 450 per litre, to calibrate). Rotor shown 10 times slower.'],
  [47.0, 'The ESP32', 'Every 5 s the ESP32 posts one JSON reading to the Cartheco backend, which works out the tranche, the forecast and the alerts.'],
  [52.0, 'Two sensors, one box', 'Neither the STEG side nor the SONEDE side is touched. With the walls in x-ray: the box by the panel, the sensor on the pipe.'],
  ...DAY_CAPTIONS,
];
// the caption a view shows when the visitor drives
export const VIEW_CAPTION = {
  house: CAPTIONS[0].slice(1),
  steg: CAPTIONS[1].slice(1),
  ct: CAPTIONS[3].slice(1),
  box: CAPTIONS[4].slice(1),
  sonede: CAPTIONS[6].slice(1),
  flow: CAPTIONS[8].slice(1),
  esp: CAPTIONS[9].slice(1),
};

// callouts per view: anchor key in the world, name, one line, label offset from the anchor (px)
export const CALLOUTS = {
  house: [
    ['stegNiche', 'STEG meter niche', 'Sealed, not touched', -150, -130],
    ['sonedeNiche', 'SONEDE meter niche', 'Sealed, not touched', -120, 110],
    ['acOut', 'AC outdoor unit', 'Runs when the AC is on', 120, -110],
  ],
  houseXray: [
    ['panel', 'Panel and sensor box', 'Inside, behind the STEG niche', -160, -150],
    ['yf', 'Flow sensor', 'On the pipe after the SONEDE meter', -90, 120],
    ['tap', 'Kitchen tap', 'Where the water goes', 140, -120],
  ],
  steg: [
    ['stegMeter', 'STEG meter', 'Counts the bill, sealed', -230, -150],
    ['stegBreaker', 'Main breaker', 'STEG side, sealed', 190, -170],
    ['toHouse', 'L and N into the house', 'Cartheco works after this point', 200, 10],
  ],
  ct: [
    ['ct', 'Current clamp (CT)', 'Split core, around L only', -250, -140],
    ['phaseL', 'Phase L', 'Brown wire, carries the current', -240, 130],
    ['neutralN', 'Neutral N', 'Stays outside the clamp', 230, 80],
  ],
  box: [
    ['panel', 'Consumer unit', 'The house breakers', -200, -170],
    ['breaker2A', 'Dedicated 2 A breaker', 'Feeds the voltage taps', -170, 150],
    ['pzem', 'PZEM-004T', 'Reads V, A, W and kWh', 30, -200],
    ['esp', 'ESP32', 'Reads the PZEM over serial', 200, -120],
  ],
  sonede: [
    ['sonede', 'SONEDE meter', 'The pointer turns once per litre', -230, -150],
    ['stopcock', 'SONEDE stopcock', 'Utility side', -190, 120],
    ['toHouseWater', 'Into the house', 'The flow sensor goes after this', 210, -40],
  ],
  flow: [
    ['valve', 'Household valve', 'Turned off while fitting', 200, -150],
    ['yf', 'YF-S201 flow sensor', 'Arrow points into the house', -150, 150],
    ['yfWire', 'Sensor cable', 'Red 5 V, black GND, yellow pulses', -200, -150],
  ],
  esp: [
    ['esp', 'ESP32', 'Posts a reading every 5 s', -170, -130],
    ['uart', 'Serial link to the PZEM', 'TX to GPIO16, RX from GPIO17', 60, -190],
    ['divider', 'Voltage divider', 'Sensor pulses 5 V down to 3.3 V', -200, 70],
    ['supply', '5 V supply', 'HLK-PM01, fed by the 2 A breaker', 200, 80],
  ],
};

// ------------------------------------------------------------ the tour's settings at tour time t
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
export const viewAt = (t) => VIEWS.filter(([t0]) => t0 <= t).pop();
export const captionAt = (t) => CAPTIONS.filter(([t0]) => t0 <= t).pop().slice(1);
export const poseAt = (key, t) => {
  const e = SCRIPT.filter((x) => (x.set === key || x.slide === key) && x.t <= t).pop();
  if (!e) return 1;
  if (e.set) return e.v;
  return e.from + (e.to - e.from) * ss(e.t, e.t + e.dur, t);
};
export const waterAt = (t) => SCRIPT.filter((e) => e.water && e.t <= t).pop()?.water ?? 'off';
export const xrayAt = (t) => SCRIPT.filter((e) => e.xray !== undefined && e.t <= t).pop()?.xray ?? 0;
export const peakAt = (t) => SCRIPT.filter((e) => e.peak !== undefined && e.t <= t).pop()?.peak ?? false;

// a camera move: every parameter eased, the azimuth the short way round, backing off through a wide swing
export function blend(a, b, k) {
  const o = {};
  const dAz = ((((b.az - a.az) % 360) + 540) % 360) - 180;
  for (const key in b) o[key] = key === 'az' ? a.az + dAz * k : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(dAz) / 90);
  o.d += Math.max(0, Math.max(a.d, b.d) * (1 + 0.5 * swing) - o.d) * Math.sin(Math.PI * k) * 0.5;
  return o;
}
export function camAt(t) {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const view = (j) => VIEW_FN[VIEWS[j][1]](t - VIEWS[j][0]);
  const cur = view(i);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 2.0, t);
  return k >= 1 ? cur : blend(view(i - 1), cur, k);
}

// ------------------------------------------------------------ the operator's pointer
const REST = [[1440, 790], [1380, 815], [1500, 800], [1420, 770]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0 && !e.set).map((e) => {
    if (e.slide) return {t: e.t, spot: ui.knobAt(e.slide, e.from), to: ui.knobAt(e.slide, e.to), drag: e.dur, key: e.slide, e};
    if (e.view) return {t: e.t, spot: ui.spots['v_' + e.view], drag: 0};
    if (e.water) return {t: e.t, spot: ui.spots['w_' + e.water], drag: 0};
    if (e.xray !== undefined) return {t: e.t, spot: ui.spots.xray, drag: 0};
    return {t: e.t, spot: ui.spots.peak, drag: 0};
  });
  const WP = [[0, 1440, 790]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.6, ...e.spot]);
    if (e.drag) {
      for (let k = 0; k <= 16; k++) {
        const tt = e.t + (k / 16) * e.drag;
        WP.push([tt + 0.01, ...ui.knobAt(e.key, poseAt(e.key, tt))]);
      }
      WP.push([e.t + e.drag + 0.3, ...e.to]);
    } else WP.push([e.t + 0.24, ...e.spot]);
    WP.push([e.t + e.drag + 1.5, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const lin = t1 - t0 < 0.4;
    const k = lin ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : ss(t0, t1, t);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + Math.max(0.1, e.drag + 0.1)) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, press, ring, ringX: rx, ringY: ry};
  };
}
