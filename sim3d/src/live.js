// The page you drive. One state, stepped in time: the appliances ramp, the month's energy and the water totals
// integrate, the clamp and the flow sensor follow their install sliders, the ESP32 posts every 5 s. Left alone the
// page plays the tour (tour.js) with the operator's cursor; a click, drag, wheel or key hands control over, and 25 s
// of quiet hands it back. With ?render the clock stops and window.seek(t) steps the tour to t (frame capture).
import {warmUp} from 'teardown-kit/warm.js';
import {APPLIANCES, E_START, ENERGY_CLOCK, SONEDE_INDEX_START, STEG_INDEX_AT_MONTH_START, SWITCHABLE, WATER_MODES, WATER_TOTAL_START, electricity, payload, trancheInfo, water} from './model.js';
import {createStage} from './stage.js';
import {CALLOUTS, DURATION, VIEW_CAPTION, VIEW_FN, camAt, captionAt, makeCursor, peakAt, poseAt, ss, viewAt, waterAt, xrayAt} from './tour.js';
import {VIEWS, WATER, createUI} from './ui.js';
import {DAY_CLOCK, DAY_T0, E_DAY_START, clockText, createDayEngine, dateText, daylightAt, hourAt, isoStamp, planAt} from './day.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = (x) => clamp(x, 0, 1);
const smooth = (x) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});

const CSS = `
html,body{background:#e9ecea;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
`;
const PORTRAIT = `
.tg-turn{position:fixed;left:0;right:0;bottom:16px;text-align:center;font:500 13px Inter,sans-serif;color:#6B7280;display:none}
@media (orientation:portrait) and (max-width:820px){.tg-turn{display:block}}
`;

export async function runLive() {
  const q = new URLSearchParams(location.search);
  const RENDER = q.has('render');
  const style = document.createElement('style');
  // frame capture jumps in time: no CSS transitions there, or a screenshot catches a button mid-fade
  style.textContent = CSS + (RENDER ? '.tg-bt{transition:none!important}' : '') + PORTRAIT;
  document.head.appendChild(style);
  document.title = 'Cartheco 3D';
  await Promise.all([
    document.fonts.load('600 20px Inter'),
    document.fonts.load('700 20px Inter'),
    document.fonts.load('500 20px "JetBrains Mono"'),
    document.fonts.load('600 20px "JetBrains Mono"'),
  ]).catch(() => {});
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage(canvas);
  const ui = createUI(app);
  const tourCursor = makeCursor(ui);
  const turn = document.createElement('div');
  turn.className = 'tg-turn';
  turn.textContent = 'Turn your phone sideways to see the whole console';
  document.body.appendChild(turn);

  // ------------------------------------------------------------ fit the 1600 x 900 layout to the window, quality tiers
  const TIERS = [{pr: 2, shadow: 2048}, {pr: 1.5, shadow: 2048}, {pr: 1, shadow: 1024}];
  let tier = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700 ? 2 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    const pr = RENDER ? devicePixelRatio || 1 : clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr);
    st.resize(W, H, pr);
  };
  const applyTier = () => {
    st.setShadow(TIERS[tier].shadow);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  // ------------------------------------------------------------ state
  const S = {};
  const reset = () => {
    Object.assign(S, {
      T: 0,
      on: {lights: 1, heater: 1, ac: 0, oven: 0, kettle: 0, radiator: 0},
      levels: {lights: 1, heater: 1, ac: 0, oven: 0, kettle: 0, radiator: 0},
      dayOn: false,
      dayH: 6,
      pzemMute: false,
      powerCut: false,
      waterMode: 'off',
      Q: 0,
      tapFlow: 0,
      poseE: 1,
      poseW: 1,
      E: E_START,
      waterTotal: WATER_TOTAL_START,
      sonedeIndex: SONEDE_INDEX_START,
      sonedeTurn: 0,
      rotorAngle: 0,
      dropPhase: 0,
      flowDist: 0,
      acPhase: 0,
      fanAngle: 0,
      lastPost: -99,
      pulsesWindow: 0,
      pulsesDelta: 0,
      post: null,
      xray: 0,
      xrayK: 0,
      showField: 1,
      yfGlass: 0,
      leakFor: 0,
      view: 'house',
      viewAt: 0,
      off: {az: 0, el: 0, k: 1},
      cam: {...VIEW_FN.house(0)},
      ring: {t: -9, x: 0, y: 0},
      tour: {on: true, t0: 0, loop: 0},
      lastInput: 0,
    });
  };
  reset();

  // ------------------------------------------------------------ handing control over and back
  const day = createDayEngine();
  const leaveDay = () => {
    S.dayOn = false;
    S.pzemMute = false;
    S.powerCut = false;
  };
  const startTour = () => {
    S.tour = {on: true, t0: S.T, loop: 0};
    S.off = {az: 0, el: 0, k: 1};
    S.xray = 0;
    S.showField = 1;
    S.E = E_START;
    leaveDay();
  };
  // jump straight to the Cartheco day (scenario G)
  const startDay = () => {
    startTour();
    S.tour.t0 = S.T - DAY_T0;
  };
  const tourTime = () => (S.T - S.tour.t0) % DURATION;
  const takeOver = () => {
    S.lastInput = S.T;
    if (!S.tour.on) return;
    const c = tourTime();
    S.tour.on = false;
    const [t0, v] = viewAt(c);
    S.view = v;
    S.viewAt = S.T - (c - t0);
  };
  if (!RENDER) {
    ui.chip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      S.lastInput = S.T;
      if (S.tour.on) takeOver();
      else startTour();
    });
    addEventListener('pointerdown', (e) => {
      if (e.target !== ui.chip) takeOver();
    });
  }

  // ------------------------------------------------------------ controls
  const pulseAt = (k) => (S.ring = {t: S.T, x: ui.spots[k][0], y: ui.spots[k][1]});
  const setView = (v) => {
    S.view = v;
    S.viewAt = S.T;
    S.off = {az: 0, el: 0, k: 1};
  };
  const click = (key, fn) =>
    ui.btn[key].addEventListener('click', () => {
      takeOver();
      pulseAt(key);
      fn();
    });
  for (const [v] of VIEWS) click('v_' + v, () => setView(v));
  for (const a of SWITCHABLE) click('a_' + a.id, () => (S.on[a.id] = S.on[a.id] ? 0 : 1));
  click('peak', () => {
    const v = S.on.ac && S.on.oven ? 0 : 1;
    S.on.ac = v;
    S.on.oven = v;
  });
  for (const [m] of WATER) click('w_' + m, () => (S.waterMode = m));
  click('s_install', () => startTour());
  click('s_day', () => startDay());
  click('xray', () => (S.xray = S.xray ? 0 : 1));
  click('field', () => (S.showField = S.showField ? 0 : 1));
  for (const key of ['poseE', 'poseW']) {
    const sl = ui.sliders[key];
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      S[key] = clamp01((x - sl.x0) / (sl.x1 - sl.x0));
      S.lastInput = S.T;
    };
    sl.hit.addEventListener('pointerdown', (e) => {
      takeOver();
      sl.hit.setPointerCapture(e.pointerId);
      // fitting a sensor is easier to watch from its own view
      if (key === 'poseE' && S.view !== 'ct' && S.view !== 'box') setView('ct');
      if (key === 'poseW' && S.view !== 'flow') setView('flow');
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const i = Number(e.key);
    if (i >= 1 && i <= VIEWS.length) {
      takeOver();
      setView(VIEWS[i - 1][0]);
    } else if (e.key.toLowerCase() === 'h') ui.root.style.display = ui.root.style.display ? '' : 'none';
    else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    S.off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    S.off.el = clamp(S.off.el + ((e.clientY - drag.y) / scale) * 0.2, -25, 60);
    drag = {x: e.clientX, y: e.clientY};
    S.lastInput = S.T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      S.off.k = clamp(S.off.k * Math.exp(e.deltaY * 0.0012), 0.4, 2.5);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ one step of the world
  const PLANES = {
    front: (p) => p.z - 3.5,
    back: (p) => -p.z - 3.5,
    left: (p) => -p.x - 4,
    right: (p) => p.x - 4,
  };
  let tgt = S.cam;
  let since = 0;
  let cursor = null;
  const step = (dt) => {
    S.T += dt;
    // what the tour or the visitor asks for
    if (S.tour.on) {
      const c = S.T - S.tour.t0;
      const loop = Math.floor(c / DURATION);
      if (loop > S.tour.loop) {
        S.tour.loop = loop;
        S.E = E_START;
        leaveDay();
      }
      const cyc = c - loop * DURATION;
      const [t0, v] = viewAt(cyc);
      S.view = v;
      since = cyc - t0;
      tgt = camAt(cyc);
      S.poseE = poseAt('poseE', cyc);
      S.poseW = poseAt('poseW', cyc);
      S.waterMode = waterAt(cyc);
      S.xray = xrayAt(cyc);
      if (cyc >= DAY_T0) {
        // the Cartheco day: the plan of the hour drives the house
        if (!S.dayOn) {
          S.dayOn = true;
          S.E = E_DAY_START;
          day.reset(S.E);
        }
        S.dayH = hourAt(cyc);
        const plan = planAt(S.dayH);
        Object.assign(S.on, plan.on);
        S.waterMode = plan.water;
        S.pzemMute = plan.pzemMute;
        S.powerCut = plan.powerCut;
      } else {
        if (S.dayOn) leaveDay();
        const pk = peakAt(cyc) ? 1 : 0;
        S.on.ac = pk;
        S.on.oven = pk;
        S.on.lights = 1;
        S.on.heater = 1;
        S.on.kettle = 0;
        S.on.radiator = 0;
      }
      cursor = tourCursor(cyc);
      if (S.tour.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
    } else {
      if (!RENDER && S.T - S.lastInput > IDLE) startTour();
      since = S.T - S.viewAt;
      tgt = {...VIEW_FN[S.view](since)};
      tgt.az += S.off.az;
      tgt.el = clamp(tgt.el + S.off.el, -20, 80);
      tgt.d *= S.off.k;
      const rk = Math.max(0, 1 - (S.T - S.ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: S.ring.x, ringY: S.ring.y};
    }
    // the camera eases toward its target: the tour's own moves pass through, a click glides
    const kc = 1 - Math.exp(-dt / (S.tour.on ? 0.16 : 0.45));
    S.cam.az += wrap(tgt.az - S.cam.az) * kc;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy', 'x']) S.cam[key] += (tgt[key] - S.cam[key]) * kc;

    // loads ramp in and out
    const kl = 1 - Math.exp(-dt / 0.35);
    for (const a of SWITCHABLE) S.levels[a.id] += ((S.on[a.id] ? 1 : 0) - S.levels[a.id]) * kl;
    S.el = electricity(S.levels, S.T);
    if (S.powerCut) S.el = {...S.el, V: 0, I: 0, P: 0, S: 0, ctmA: 0};
    // during the day story 1 s on screen is 15 min of the day, otherwise 10 min of energy
    const clockK = S.dayOn && S.tour.on ? DAY_CLOCK : ENERGY_CLOCK;
    S.E += (S.el.P / 1000) * ((dt * clockK) / 3600);

    // water: the household valve is part of fitting the sensor (it opens on the last fifth of the slider)
    S.valveOpen = smooth((S.poseW - 0.8) / 0.2);
    const want = WATER_MODES[S.waterMode] * S.valveOpen;
    S.Q += (want - S.Q) * (1 - Math.exp(-dt / 0.6));
    if (S.Q < 0.002) S.Q = 0;
    S.tapFlow = S.waterMode === 'leak' ? S.Q * 0.3 : S.Q;
    S.wa = water(S.Q);
    S.waterFitted = S.poseW >= 0.999 && !S.powerCut;
    const litres = (S.Q / 60) * dt * (S.dayOn && S.tour.on ? DAY_CLOCK : 1);
    if (S.waterFitted) S.waterTotal += litres;
    S.sonedeIndex += litres / 1000;
    S.sonedeTurn += (S.Q / 60) * dt; // the pointer turns at the real rate, readable even when the day runs fast
    // the rotor and the drops are shown 10 times slower than the real 7.5 x Q pulses
    const prevA = S.rotorAngle;
    S.rotorAngle += TAU * (S.wa.hz / 10) * dt;
    S.hallOn = S.Q > 0.01 && (S.rotorAngle % TAU) < 0.6;
    void prevA;
    S.dropPhase = (S.dropPhase + (S.wa.v / 10 / 0.088) * dt) % 1;
    S.flowDist += S.wa.v * dt;
    if (S.waterFitted) S.pulsesWindow += S.wa.hz * dt;
    S.leakFor = S.waterMode === 'leak' && S.Q > 0.1 ? S.leakFor + dt : 0;

    // the AC current shown at 1 Hz, the outdoor fan, the meter LED
    S.acPhase += dt;
    S.fanAngle += TAU * 4 * S.levels.ac * dt;
    S.stegIndex = STEG_INDEX_AT_MONTH_START + S.E;
    S.meterBlink = ((S.E * 10) % 1) < 0.15;

    S.signalOk = S.poseE >= 0.999;
    S.yfGlass += ((S.view === 'flow' ? 1 : 0) - S.yfGlass) * (1 - Math.exp(-dt / 0.4));
    S.xrayK += (S.xray - S.xrayK) * (1 - Math.exp(-dt / 0.3));

    // the Cartheco rules run on the day's clock
    if (S.dayOn && S.tour.on) day.tick(S, S.dayH);

    // the ESP32 posts every 5 s (nothing during a power cut: it is off too)
    // on the day's clock 5 s on screen would be 75 min, so the day story posts every 0.4 s (6 min of the day)
    const every = S.dayOn && S.tour.on ? 0.4 : 5;
    if (S.T - S.lastPost >= every && !S.powerCut) {
      S.lastPost = S.T;
      S.pulsesDelta = Math.round(S.pulsesWindow);
      S.pulsesWindow = 0;
      S.stamp = S.dayOn ? isoStamp(S.dayH) : stampAt(S.T);
      S.post = payload(S);
    }
  };
  const BASE_TIME = Date.UTC(2026, 10, 21, 15, 6, 0); // 16:06 in Tunis (UTC+1)
  const stampAt = (T) => {
    const d = new Date(BASE_TIME + Math.floor(T) * 1000 + 3600 * 1000);
    return d.toISOString().slice(0, 19) + '+01:00';
  };

  // ------------------------------------------------------------ draw one frame
  const camPos = {x: 0, y: 0, z: 0};
  const D2R = Math.PI / 180;
  const payloadHTML = (p) => {
    if (!p) return 'waiting for the first reading...';
    const e = p.electricity;
    const w = p.water;
    const n = (v) => (typeof v === 'number' ? String(v) : v);
    const lines = ['{', `  "device_id": "${p.device_id}",`, `  "timestamp": "${p.timestamp}",`];
    if (e)
      lines.push(
        '  "electricity": {',
        `    "voltage_v": <i>${n(e.voltage_v)}</i>,`,
        `    "current_a": <i>${n(e.current_a)}</i>,`,
        `    "power_w": <i>${n(e.power_w)}</i>,`,
        `    "energy_kwh": <i>${n(e.energy_kwh)}</i>,`,
        `    "frequency_hz": <i>${n(e.frequency_hz)}</i>,`,
        `    "power_factor": <i>${n(e.power_factor)}</i>`,
        '  },',
      );
    else lines.push('  "electricity": <b style="color:#BF265C">null</b>,', '', '', '', '', '', '', '');
    if (w)
      lines.push(
        '  "water": {',
        `    "flow_l_min": <u>${n(w.flow_l_min)}</u>,`,
        `    "total_l": <u>${n(w.total_l)}</u>,`,
        `    "pulses_delta": <u>${n(w.pulses_delta)}</u>,`,
        `    "calib_pulses_per_l": <u>${n(w.calib_pulses_per_l)}</u>`,
        '  },',
      );
    else lines.push('  "water": <b style="color:#BF265C">null</b>,');
    lines.push(`  "signal_ok": ${p.signal_ok}`, '}');
    return lines.join('\n');
  };
  const draw = () => {
    const c = S.cam;
    // walls fade when they stand between the camera and an indoor subject; the roof goes for any indoor view
    const az = c.az * D2R;
    const el = c.el * D2R;
    camPos.x = c.tx + c.d * Math.cos(el) * Math.sin(az);
    camPos.y = c.ty + c.d * Math.sin(el);
    camPos.z = c.tz + c.d * Math.cos(el) * Math.cos(az);
    const ghost = {roof: Math.max(S.xrayK * 0.95, c.x)};
    for (const k of Object.keys(PLANES)) ghost[k] = Math.max(S.xrayK * 0.85, c.x * smooth((PLANES[k](camPos) + 0.05) / 0.3));
    const tr = trancheInfo(S.E);
    const field = S.showField;
    st.world.update({
      ...S,
      ghost,
      showField: field,
      showBeads: field,
      postAge: S.T - S.lastPost,
    });
    st.frame(c);

    // callouts from the world anchors
    // the x-ray house swaps its outside callouts for the inside ones, fading across
    const inside = S.view === 'house' && S.xrayK > 0.5;
    const list = CALLOUTS[inside ? 'houseXray' : S.view] || [];
    const o = ss(1.1, 1.7, since) * (S.view === 'house' ? Math.abs(S.xrayK - 0.5) * 2 : 1);
    const callouts = list.map(([key, name, sub, dx, dy]) => {
      const a = st.world.anchors[key];
      if (!a) return null;
      const p = st.project(typeof a === 'function' ? a() : a);
      if (key === 'acOut' && S.levels.ac < 0.5) return null;
      return {at: p, name, sub, dx, dy, o: p ? o : 0};
    });
    st.setDaylight(S.dayOn ? daylightAt(S.dayH) : 1);
    let alertText = '';
    let alertSev = '';
    const lastOpen = S.dayOn ? day.D.alerts.find((a) => a.open) : null;
    if (S.dayOn) {
      if (lastOpen) {
        alertText = `<b>${lastOpen.title} · ${lastOpen.time}</b> ${lastOpen.msg}`;
        alertSev = lastOpen.sev;
      }
    } else if (S.leakFor > 3) alertText = `<b>Possible leak</b> Water has been flowing nonstop at ${fmt(S.Q, 2)} L/min. The real rule waits for 2 h of flow between 01:00 and 05:00.`;
    else if (tr.alert) alertText = `<b>Next tranche soon</b> ${fmt(tr.left, 1)} kWh left before ${tr.next} kWh. Crossing it adds ≈ ${fmt(tr.jump, 1)} DT this month (estimate).`;
    const age = Math.max(0, S.T - S.lastPost);
    ui.update({
      ...S,
      tranche: tr,
      payloadHTML: payloadHTML(S.post),
      postText: S.powerCut
        ? `No reading since ${day.D.lastSeen} (no power)`
        : S.post
          ? `POST /api/readings · 201 · ${age < 1 ? 'just now' : `${Math.floor(age)} s ago`}`
          : '',
      day: S.dayOn ? {...day.D, clock: clockText(S.dayH), date: dateText(S.dayH)} : null,
      alertSev,
      caption: S.tour.on ? captionAt(tourTime()) : VIEW_CAPTION[S.view],
      callouts,
      alertText,
      touring: S.tour.on,
      cursor,
    });
  };

  // ------------------------------------------------------------ run: live, or frame capture
  window.DURATION = DURATION;
  window.LIVE = {S, st, startTour, startDay, takeOver, day};
  window.FPS = 30;
  step(0);
  if (RENDER) {
    const STEP = 1 / 60;
    window.seek = (t) => {
      if (t < S.T - 1e-6) {
        reset();
        step(0);
      }
      while (S.T + STEP <= t + 1e-9) step(STEP);
      if (t - S.T > 1e-6) step(t - S.T);
      draw();
      return true;
    };
    window.seek(0);
    return;
  }
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 1) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.6 && perf.n >= 8) {
          perf.slow = perf.sum / perf.n > 0.024 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= 2) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }
    step(dt);
    draw();
    requestAnimationFrame(frame);
  };
  // every shader compiles at once before the first frame
  await warmUp(st.renderer, st.camera, [{scene: st.scene}]).catch(() => {});
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
  window.LIVE = {S, st, startTour, startDay, takeOver, day};
  void APPLIANCES;
}
