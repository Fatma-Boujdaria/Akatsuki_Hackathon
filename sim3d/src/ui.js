// The overlay on a fixed 1600 x 900 layout: readouts on the left, the ESP32 payload and the controls on the right,
// a caption at the bottom, the alert and the tour chip at the top, callouts with leaders into the 3D scene.
// update(s) redraws every live part from the frame's state; text nodes are only touched when their text changes.
import {SWITCHABLE, SUBSCRIBED_KVA} from './model.js';

export const C = {
  ink: '#16181D',
  body: '#3D424D',
  mute: '#6B7280',
  line: '#E4E4DE',
  surface: 'rgba(255,255,255,.94)',
  elec: '#4F46E5',
  water: '#0E7490',
  warnInk: '#9C5D00',
  warnSoft: '#FCEFD5',
  warn: '#C77700',
  ok: '#247934',
  bad: '#BF265C',
};
// Cartheco home status (insights.py), worst first; label in French like the app, color + text, never color alone
export const STATUS = {
  unavailable: {fr: 'Indisponible', fg: '#4B5563', bg: '#ECEDEF'},
  critical: {fr: 'Critique', fg: '#B42318', bg: '#FDE8E7'},
  warning: {fr: 'Avertissement', fg: '#9C5D00', bg: '#FCEFD5'},
  attention: {fr: 'Attention', fg: '#8A6100', bg: '#FBF3D4'},
  ok: {fr: 'Tout va bien', fg: '#247934', bg: '#DDF3E1'},
};
export const VIEWS = [
  ['house', 'House'],
  ['steg', 'STEG meter'],
  ['ct', 'Current clamp'],
  ['box', 'Sensor box'],
  ['sonede', 'SONEDE meter'],
  ['flow', 'Flow sensor'],
  ['esp', 'ESP32'],
];
export const WATER = [
  ['off', 'Off'],
  ['tap', 'Tap'],
  ['shower', 'Shower'],
  ['leak', 'Leak'],
];

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.tg-ui{position:absolute;inset:0;pointer-events:none}
.tg-pn{position:absolute;background:${C.surface};border:1px solid ${C.line};border-radius:10px}
.tg-ttl{position:absolute;font-size:13px;font-weight:650}
.tg-sub{position:absolute;font-size:12px;color:${C.mute}}
.tg-row{position:absolute;display:flex;justify-content:space-between;font-size:12.5px;color:${C.body}}
.tg-row b{font:500 12.5px 'JetBrains Mono',monospace;color:${C.ink}}
.tg-bt{position:absolute;height:24px;padding:0 9px;display:flex;align-items:center;font-size:12px;font-weight:550;border:1px solid #C9C9C1;border-radius:6px;background:#fff;color:${C.ink};white-space:nowrap;pointer-events:auto;cursor:pointer;user-select:none;transition:background-color .12s cubic-bezier(.2,0,0,1),color .12s cubic-bezier(.2,0,0,1)}
.tg-bt:hover{background:#F2F2EE}
.tg-bt.on{background:${C.ink};border-color:${C.ink};color:#fff}
.tg-bt.peak.on{background:${C.warn};border-color:${C.warn}}
.tg-sl{position:absolute;height:22px;pointer-events:auto;cursor:ew-resize}
.tg-call{position:absolute;white-space:nowrap;background:rgba(255,255,255,.92);padding:4px 8px;border-radius:6px;border:1px solid ${C.line}}
.tg-call b{display:block;font-size:13px;font-weight:650}
.tg-call span{display:block;font-size:11.5px;color:${C.mute};margin-top:1px}
.tg-cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.tg-ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2px solid ${C.elec};opacity:0;z-index:49}
pre.tg-js{position:absolute;margin:0;font:500 10.6px/12.6px 'JetBrains Mono',monospace;color:${C.body};white-space:pre}
pre.tg-js i{font-style:normal;color:${C.elec}}
pre.tg-js u{text-decoration:none;color:${C.water}}
.tg-chip{position:absolute;left:800px;top:18px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:26px;padding:0 12px;border:1px solid ${C.line};border-radius:6px;background:rgba(255,255,255,.95);font-size:12px;font-weight:550;white-space:nowrap;pointer-events:auto;cursor:pointer}
.tg-chip i{display:block;width:7px;height:7px;border-radius:50%;background:${C.elec}}
.tg-chip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.2}}
.tg-alert{position:absolute;left:800px;top:52px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:7px 12px;border-radius:8px;background:${C.warnSoft};color:${C.warnInk};font-size:13px;white-space:nowrap;border:1px solid #EBCB8B}
.tg-alert b{font-weight:650}
.tg-alert.crit{background:#FDE8E7;color:#B42318;border-color:#F4B4AE}
.tg-alert.wrap{white-space:normal;width:500px;left:676px}
.tg-clock{position:absolute;left:330px;top:18px;display:flex;gap:10px;align-items:center;height:26px;padding:0 12px;border-radius:6px;background:rgba(22,24,29,.86);color:#fff;font-size:12.5px;font-weight:600}
.tg-clock b{font:600 15px 'JetBrains Mono',monospace}
.ph{position:absolute;left:1034px;top:86px;width:240px;height:640px;border-radius:30px;background:#16181D;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.ph-s{position:absolute;left:1042px;top:94px;width:224px;height:624px;border-radius:23px;background:#F7F7F4;overflow:hidden}
.ph-s *{box-sizing:border-box}
.ph-top{display:flex;justify-content:space-between;align-items:center;padding:10px 14px 4px;font:600 11px Inter,sans-serif;color:#16181D}
.ph-brand{display:flex;align-items:center;gap:6px;padding:4px 14px 8px;font-size:15px;font-weight:700}
.ph-brand i{display:block;width:18px;height:18px;border-radius:5px;background:#0E7C74}
.ph-home{padding:0 14px 8px;font-size:11px;color:#6B7280;margin-top:-6px}
.ph-st{margin:0 10px 8px;border-radius:12px;padding:8px 10px}
.ph-st b{display:block;font-size:13px}
.ph-st span{display:block;font-size:11px;line-height:14px;margin-top:2px}
.ph-card{margin:0 10px 8px;background:#fff;border:1px solid #E4E4DE;border-radius:12px;padding:8px 10px}
.ph-k{font-size:10px;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:#6B7280}
.ph-big{font-size:22px;font-weight:700;letter-spacing:-.3px;margin-top:1px}
.ph-sm{font-size:11px;color:#3D424D;line-height:14px;margin-top:2px}
.ph-n{display:grid;gap:2px;padding:6px 0;border-top:1px solid #EEEEE8;font-size:10.5px;line-height:13px;color:#3D424D}
.ph-n:first-of-type{border-top:0}
.ph-n b{font-size:11px;color:#16181D;display:flex;justify-content:space-between}
.ph-n b em{font-style:normal;font-weight:500;color:#6B7280}
.ph-n.seen{opacity:.55}
.ph-n .m{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ph-n.crit b{color:#B42318}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});

export function createUI(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="tg-ui"></div>`);
  app.appendChild(ui);
  const add = (h, parent = ui) => {
    const n = el(h);
    parent.appendChild(n);
    return n;
  };
  const texts = new Map();
  const setText = (node, t) => {
    if (texts.get(node) !== t) {
      texts.set(node, t);
      node.textContent = t;
    }
  };
  const setHTML = (node, t) => {
    if (texts.get(node) !== t) {
      texts.set(node, t);
      node.innerHTML = t;
    }
  };

  // ------------------------------------------------------------ left: title, power, electricity, water, tranche
  const LX = 28;
  const LW = 272;
  add(`<div class="tg-pn" style="left:${LX - 10}px;top:14px;width:${LW + 20}px;height:178px"></div>`);
  add(`<div style="position:absolute;left:${LX}px;top:24px;font-size:25px;font-weight:700;letter-spacing:-0.3px">Cartheco</div>`);
  add(`<div class="tg-sub" style="left:${LX}px;top:58px;font-size:13px">Sensors and app in a Tunisian home</div>`);
  add(`<div class="tg-sub" style="left:${LX}px;top:94px">Power now</div>`);
  const powBig = add(`<div style="position:absolute;left:${LX - 2}px;top:108px;font-size:46px;font-weight:700;letter-spacing:-1px;color:${C.elec};line-height:1"></div>`);
  add(`<div style="position:absolute;left:${LX}px;top:166px;width:${LW}px;height:6px;border-radius:3px;background:#E8E8E2"></div>`);
  const powFill = add(`<div style="position:absolute;left:${LX}px;top:166px;height:6px;border-radius:3px;background:${C.elec}"></div>`);
  const powSub = add(`<div class="tg-sub" style="left:${LX}px;top:176px;font-size:11.5px"></div>`);

  const panel = (y, h, title, right) => {
    add(`<div class="tg-pn" style="left:${LX - 10}px;top:${y}px;width:${LW + 20}px;height:${h}px"></div>`);
    add(`<div class="tg-ttl" style="left:${LX}px;top:${y + 10}px">${title}</div>`);
    if (right) return add(`<div class="tg-sub" style="right:${1600 - LX - LW}px;top:${y + 11}px;text-align:right">${right}</div>`);
    return null;
  };
  const row = (y, label) => {
    const r = add(`<div class="tg-row" style="left:${LX}px;top:${y}px;width:${LW}px"><span>${label}</span><b></b></div>`);
    return r.querySelector('b');
  };
  panel(200, 170, 'Electricity', 'PZEM-004T');
  const eV = row(232, 'Voltage');
  const eI = row(253, 'Current');
  const ePF = row(274, 'Power factor');
  const eHz = row(295, 'Frequency');
  const eCT = row(316, 'Clamp output (I / 1000)');
  const eOK = row(337, 'Signal');
  panel(380, 130, 'Water', 'YF-S201');
  const wQ = row(412, 'Flow');
  const wHz = row(433, 'Pulse rate (7.5 × Q)');
  const wT = row(454, 'Sensor total');
  const wS = row(475, 'SONEDE meter');

  const ty = 520;
  panel(ty, 196, 'STEG tranche', 'this month');
  const tBig = add(`<div style="position:absolute;left:${LX}px;top:${ty + 32}px;font-size:26px;font-weight:700;letter-spacing:-0.4px"></div>`);
  const TB = {x: LX, y: ty + 72, w: LW, max: 520};
  const bx = (kwh) => TB.x + (Math.min(kwh, TB.max) / TB.max) * TB.w;
  add(`<div style="position:absolute;left:${TB.x}px;top:${TB.y}px;width:${TB.w}px;height:10px;border-radius:3px;background:#E8E8E2"></div>`);
  const tFill = add(`<div style="position:absolute;left:${TB.x}px;top:${TB.y}px;height:10px;border-radius:3px;background:${C.elec}"></div>`);
  for (const k of [200, 300, 500]) {
    add(`<div style="position:absolute;left:${bx(k) - 0.5}px;top:${TB.y - 3}px;width:1px;height:16px;background:${C.ink}"></div>`);
    add(`<div class="tg-sub" style="left:${bx(k) - 14}px;top:${TB.y + 15}px;font-size:11px;width:28px;text-align:center">${k}</div>`);
  }
  const tLeft = add(`<div style="position:absolute;left:${LX}px;top:${ty + 110}px;font-size:13px;font-weight:600;width:${LW}px"></div>`);
  const tPrice = add(`<div class="tg-sub" style="left:${LX}px;top:${ty + 131}px;width:${LW}px;font-size:12px;color:${C.body}"></div>`);
  const tBill = add(`<div class="tg-sub" style="left:${LX}px;top:${ty + 149}px;width:${LW}px;font-size:12px;color:${C.body}"></div>`);
  const tClock = add(`<div class="tg-sub" style="left:${LX}px;top:${ty + 172}px;font-size:11px"></div>`);

  // ------------------------------------------------------------ right: payload
  const RX = 1300;
  const RW = 272;
  add(`<div class="tg-pn" style="left:${RX - 10}px;top:18px;width:${RW + 20}px;height:300px"></div>`);
  add(`<div class="tg-ttl" style="left:${RX}px;top:28px">ESP32 reading</div>`);
  add(`<div class="tg-sub" style="right:${1600 - RX - RW}px;top:29px">POST every 5 s</div>`);
  const js = add(`<pre class="tg-js" style="left:${RX}px;top:50px"></pre>`);
  const post = add(`<div style="position:absolute;left:${RX}px;top:294px;font:500 11px 'JetBrains Mono',monospace;color:${C.mute}"></div>`);

  // ------------------------------------------------------------ right: controls
  const btn = {};
  const spots = {};
  let cy = 330;
  const ctlPanel = add(`<div class="tg-pn" style="left:${RX - 10}px;top:${cy}px;width:${RW + 20}px;height:400px"></div>`);
  cy += 10;
  const section = (title) => {
    add(`<div class="tg-ttl" style="left:${RX}px;top:${cy}px">${title}</div>`);
    cy += 22;
  };
  // buttons flow left to right and wrap
  const buttons = (items, cls = '') => {
    let x = RX;
    for (const [key, label] of items) {
      const w = Math.round(label.length * 6.7 + 20);
      if (x + w > RX + RW) {
        x = RX;
        cy += 29;
      }
      btn[key] = add(`<div class="tg-bt ${cls}" style="left:${x}px;top:${cy}px;width:${w}px">${label}</div>`);
      spots[key] = [x + w / 2, cy + 12];
      x += w + 6;
    }
    cy += 34;
  };
  section('View');
  buttons(VIEWS.map(([k, l]) => ['v_' + k, l]));
  section('Appliances');
  buttons([...SWITCHABLE.map((a) => ['a_' + a.id, a.id === 'ac' ? 'AC' : a.id === 'heater' ? 'Water heater' : a.name]), ['peak', 'Peak demo']]);
  btn.peak.classList.add('peak');
  section('Water');
  buttons(WATER.map(([k, l]) => ['w_' + k, l]));
  section('Install the sensors');
  const sliders = {};
  const slider = (key, label) => {
    add(`<div class="tg-sub" style="left:${RX}px;top:${cy}px;color:${C.body}">${label}</div>`);
    const val = add(`<div class="tg-sub" style="right:${1600 - RX - RW}px;top:${cy}px;font:500 11.5px 'JetBrains Mono',monospace;color:${C.ink}"></div>`);
    const y = cy + 24;
    add(`<div style="position:absolute;left:${RX}px;top:${y - 1}px;width:${RW}px;height:3px;border-radius:2px;background:#E4E4DE"></div>`);
    const fill = add(`<div style="position:absolute;left:${RX}px;top:${y - 1}px;height:3px;border-radius:2px;background:${C.ink}"></div>`);
    const knob = add(`<div style="position:absolute;top:${y - 7}px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;border:2px solid ${C.ink}"></div>`);
    const hit = add(`<div class="tg-sl" style="left:${RX - 8}px;top:${y - 11}px;width:${RW + 16}px"></div>`);
    sliders[key] = {val, fill, knob, hit, x0: RX, x1: RX + RW, y};
    cy += 40;
  };
  slider('poseE', 'Current clamp');
  slider('poseW', 'Flow sensor');
  cy += 4;
  buttons([['xray', 'X-ray walls'], ['field', 'Show current and field']]);
  section('Story');
  buttons([['s_install', 'Installation'], ['s_day', 'A day with Cartheco']]);
  ctlPanel.style.height = `${cy - 330 - 4}px`;
  const knobAt = (key, k) => [sliders[key].x0 + k * (sliders[key].x1 - sliders[key].x0), sliders[key].y];

  // ------------------------------------------------------------ caption, alert, tour chip
  const capBox = add(`<div class="tg-pn" style="left:360px;top:806px;width:880px;height:70px"></div>`);
  const capT = add(`<div style="position:absolute;left:378px;top:816px;font-size:14px;font-weight:650"></div>`);
  const capS = add(`<div style="position:absolute;left:378px;top:838px;width:846px;font-size:13.5px;line-height:18px;color:${C.body}"></div>`);
  void capBox;
  const alert = add(`<div class="tg-alert" style="display:none"></div>`);
  const chip = add(`<div class="tg-chip"></div>`);
  const clock = add(`<div class="tg-clock" style="display:none"><span></span><b></b></div>`);
  const clockDate = clock.querySelector('span');
  const clockTime = clock.querySelector('b');

  // ------------------------------------------------------------ the phone: the Cartheco app during the day story
  const phone = add(`<div style="display:none"><div class="ph"></div><div class="ph-s">
    <div class="ph-top"><span data-k="time"></span><span>5G ▮▮▮</span></div>
    <div class="ph-brand"><i></i>Cartheco</div>
    <div class="ph-home">Maison Ben Salah · 6 kVA</div>
    <div class="ph-st" data-k="st"><b data-k="stT"></b><span data-k="stS"></span></div>
    <div class="ph-card"><div class="ph-k">Ce mois · électricité</div><div class="ph-big" data-k="kwh"></div>
      <div class="ph-sm" data-k="left"></div><div class="ph-sm" data-k="bill"></div><div class="ph-sm" data-k="fc"></div></div>
    <div class="ph-card"><div class="ph-k">Maintenant</div><div class="ph-sm" data-k="now" style="font-size:12px;font-weight:600;color:#16181D"></div></div>
    <div class="ph-card"><div class="ph-k" data-k="listT">Alertes</div><div data-k="list"></div></div>
    <div class="ph-card"><div class="ph-k" data-k="list2T">Gros consommateurs aujourd'hui</div><div data-k="list2"></div></div>
  </div></div>`);
  const P = Object.fromEntries([...phone.querySelectorAll('[data-k]')].map((n) => [n.dataset.k, n]));

  // ------------------------------------------------------------ callouts
  const svg = add(`<svg style="position:absolute;left:0;top:0" width="1600" height="900"></svg>`);
  const NCALL = 5;
  const calls = Array.from({length: NCALL}, () => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', C.ink);
    line.setAttribute('stroke-width', '1');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '3.5');
    dot.setAttribute('fill', '#fff');
    dot.setAttribute('stroke', C.ink);
    dot.setAttribute('stroke-width', '1.5');
    svg.append(line, dot);
    const lab = add(`<div class="tg-call"><b></b><span></span></div>`);
    return {line, dot, lab, b: lab.querySelector('b'), s: lab.querySelector('span')};
  });

  // ------------------------------------------------------------ cursor
  const cur = add(`<svg class="tg-cur" width="22" height="24" viewBox="0 0 22 24"><path d="M2 2 L2 19 L6.6 14.8 L9.6 21.6 L12.6 20.3 L9.7 13.6 L16 13.4 Z" fill="#16181D" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
  const ring = add(`<div class="tg-ring"></div>`);

  // ------------------------------------------------------------ update
  const colorOf = (v) => (v ? C.ok : C.bad);
  const update = (s) => {
    const ok = s.signalOk && !s.pzemMute && !s.powerCut;
    setText(powBig, ok ? `${fmt(s.el.P)} W` : '-- W');
    powFill.style.width = ok ? `${(Math.min(s.el.S, SUBSCRIBED_KVA * 1000) / (SUBSCRIBED_KVA * 1000)) * LW}px` : '0px';
    powFill.style.background = ok && s.el.S > SUBSCRIBED_KVA * 1000 ? C.bad : C.elec;
    setText(
      powSub,
      s.powerCut
        ? 'Power cut: the ESP32 is off, nothing is sent'
        : s.pzemMute
          ? 'Capteur muet: the PZEM-004T does not answer'
          : ok
            ? `${fmt(s.el.S / 1000, 2)} kVA of ${SUBSCRIBED_KVA} kVA subscribed${s.el.S > SUBSCRIBED_KVA * 1000 ? ' (over!)' : ''}`
            : 'No reading while the clamp is off',
    );
    setText(eV, `${fmt(s.el.V, 1)} V`);
    setText(eI, ok ? `${fmt(s.el.I, 2)} A` : s.pzemMute ? 'capteur muet' : s.powerCut ? 'no power' : 'clamp not fitted');
    setText(ePF, ok ? fmt(s.el.pf, 2) : '--');
    setText(eHz, `${fmt(s.el.hz, 2)} Hz`);
    setText(eCT, ok ? `${fmt(s.el.ctmA, 2)} mA` : '--');
    setText(eOK, s.pzemMute ? 'electricity: null' : s.powerCut ? 'ESP32 off' : ok ? 'signal_ok: true' : 'signal_ok: false');
    eOK.style.color = colorOf(ok);
    setText(wQ, s.powerCut ? 'ESP32 off' : s.waterFitted ? `${fmt(s.Q, 2)} L/min` : 'sensor not fitted');
    setText(wHz, s.waterFitted ? `${fmt(s.wa.hz, 1)} Hz` : '--');
    setText(wT, `${fmt(s.waterTotal, 1)} L`);
    setText(wS, `${fmt(s.sonedeIndex, 3)} m³`);

    const t = s.tranche;
    setText(tBig, `${fmt(t.E, 1)} kWh`);
    tFill.style.width = `${bx(t.E) - TB.x}px`;
    tFill.style.background = t.alert ? C.warn : C.elec;
    setText(tLeft, t.next === null ? 'Top tranche reached' : `${fmt(t.left, 1)} kWh left before ${t.next} kWh`);
    tLeft.style.color = t.alert ? C.warnInk : C.ink;
    setText(tPrice, `Next kWh ${fmt(t.price, 3)} DT · tranche ${t.tr.name}`);
    setText(tBill, `Bill so far ≈ ${fmt(t.bill, 1)} DT (estimate)`);
    setText(tClock, s.day ? 'Day clock: 1 s on screen = 15 min of the day' : 'Demo clock: 1 s of energy = 10 min');

    setHTML(js, s.payloadHTML);
    setText(post, s.postText);

    for (const [k] of VIEWS) btn['v_' + k].classList.toggle('on', s.view === k);
    for (const a of SWITCHABLE) btn['a_' + a.id].classList.toggle('on', !!s.on[a.id]);
    btn.peak.classList.toggle('on', !!(s.on.ac && s.on.oven));
    for (const [k] of WATER) btn['w_' + k].classList.toggle('on', s.waterMode === k);
    btn.xray.classList.toggle('on', !!s.xray);
    btn.field.classList.toggle('on', !!s.showField);
    for (const key of ['poseE', 'poseW']) {
      const k = s[key];
      const [x] = knobAt(key, k);
      sliders[key].knob.style.left = `${x}px`;
      sliders[key].fill.style.width = `${x - sliders[key].x0}px`;
      setText(sliders[key].val, k >= 0.999 ? 'fitted' : k <= 0.001 ? 'removed' : `${Math.round(k * 100)} %`);
    }

    setText(capT, s.caption[0]);
    setText(capS, s.caption[1]);
    if (s.alertText) {
      alert.style.display = '';
      alert.classList.toggle('crit', s.alertSev === 'critical');
      alert.classList.toggle('wrap', !!s.day);
      setHTML(alert, s.alertText);
    } else alert.style.display = 'none';
    clock.style.display = s.day ? '' : 'none';
    phone.style.display = s.day ? '' : 'none';
    if (s.day) updatePhone(s, s.day);
    if (chip.classList.contains('on') !== s.touring || !chip.firstChild) {
      chip.classList.toggle('on', s.touring);
      chip.innerHTML = s.touring ? '<i></i>Auto tour · click anywhere to take over' : '▶ Resume the tour';
    }

    // callouts: label placed at anchor + offset, kept inside the free middle area, pushed clear of earlier labels
    const placed = [];
    calls.forEach((c, i) => {
      const k = s.callouts[i];
      if (!k || !k.at || k.o <= 0.01 || (s.day && k.at[0] > 1024)) {
        c.lab.style.display = 'none';
        c.line.style.display = 'none';
        c.dot.style.display = 'none';
        return;
      }
      const [ax, ay] = k.at;
      setText(c.b, k.name);
      setText(c.s, k.sub);
      c.lab.style.display = '';
      const w = c.lab.offsetWidth || 160;
      const h = c.lab.offsetHeight || 40;
      let lx = Math.min((s.day ? 1024 : 1268) - w, Math.max(320, ax + k.dx - (k.dx < 0 ? w : 0)));
      let ly = Math.min(790 - h, Math.max(92, ay + k.dy - h / 2));
      for (let pass = 0; pass < 3; pass++) {
        const hit = placed.find((p) => lx < p.x + p.w + 8 && lx + w + 8 > p.x && ly < p.y + p.h + 6 && ly + h + 6 > p.y);
        if (!hit) break;
        // move to whichever side of the other label has room
        ly = hit.y + hit.h + 6 + h <= 790 ? hit.y + hit.h + 6 : hit.y - h - 6;
      }
      placed.push({x: lx, y: ly, w, h});
      c.lab.style.left = `${lx}px`;
      c.lab.style.top = `${ly}px`;
      c.lab.style.opacity = k.o;
      // leader from the anchor to the nearest point of the label box
      const px = Math.min(lx + w, Math.max(lx, ax));
      const py = Math.min(ly + h, Math.max(ly, ay));
      c.line.setAttribute('x1', ax);
      c.line.setAttribute('y1', ay);
      c.line.setAttribute('x2', px);
      c.line.setAttribute('y2', py);
      c.line.style.display = '';
      c.line.style.opacity = k.o;
      c.dot.setAttribute('cx', ax);
      c.dot.setAttribute('cy', ay);
      c.dot.style.display = '';
      c.dot.style.opacity = k.o;
    });

    const cu = s.cursor;
    cur.style.display = cu && cu.x > 0 ? '' : 'none';
    if (cu) {
      cur.style.transform = `translate(${cu.x - 2}px,${cu.y - 2}px) scale(${cu.press ? 0.86 : 1})`;
      ring.style.left = `${cu.ringX}px`;
      ring.style.top = `${cu.ringY}px`;
      ring.style.opacity = cu.ring;
      ring.style.transform = `scale(${1.5 - cu.ring * 0.5})`;
    }
  };

  const frNum = (x, d = 0) => Number(x).toLocaleString('fr-FR', {minimumFractionDigits: d, maximumFractionDigits: d});
  const REASON = {
    offline: 'Appareil hors ligne : données « ancien »',
    leak: 'Fuite probable en cours',
    crossed: 'Un seuil de tranche est franchi ce mois-ci',
    near_threshold: 'Dans la marge d\'alerte de la tranche suivante',
    forecast_crosses: 'La prévision dépasse la tranche suivante',
  };
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]);
  function updatePhone(s, d) {
    setText(clockDate, d.date);
    setText(clockTime, d.clock);
    setText(P.time, d.clock);
    const st = STATUS[d.status];
    P.st.style.background = st.bg;
    P.st.style.color = st.fg;
    setText(P.stT, st.fr);
    setText(P.stS, d.reasons.length ? REASON[d.reasons[0]] : 'Consommation normale');
    setText(P.kwh, `${frNum(s.E, 1)} kWh`);
    setText(P.left, d.next ? `Encore ${frNum(d.left, 1)} kWh avant ${d.next} kWh` : 'Dernière tranche');
    setText(P.bill, `Facture ≈ ${frNum(d.billNow, 2)} DT (estimation)`);
    setText(P.fc, `Prévision fin de mois : ${frNum(d.forecast)} kWh`);
    setText(
      P.now,
      s.powerCut ? 'Hors ligne depuis ' + d.lastSeen : s.pzemMute ? 'Électricité : capteur muet' : `${frNum(s.el.P)} W · eau ${frNum(s.Q, 1)} L/min`,
    );
    const items = d.alerts.slice(0, d.tips.length ? 2 : 3);
    setHTML(
      P.list,
      items.length
        ? items
            .map((a) => `<div class="ph-n ${a.open ? '' : 'seen'} ${a.sev === 'critical' ? 'crit' : ''}"><b>${esc(a.title)}<em>${a.open ? a.time : a.time + ' · ' + (a.closedBy ? 'résolu' : 'Vu')}</em></b><span class="m">${esc(a.msg)}</span></div>`)
            .join('')
        : '<div class="ph-n">Aucune alerte</div>',
    );
    if (d.tips.length) {
      setText(P.list2T, 'Conseils');
      setHTML(P.list2, d.tips.map((t) => `<div class="ph-n">${esc(t)}</div>`).join(''));
    } else {
      setText(P.list2T, "Gros consommateurs aujourd'hui");
      setHTML(
        P.list2,
        d.steps.length
          ? d.steps.slice(0, 2).map((x) => `<div class="ph-n"><b>${esc(x.label)}<em>${x.time}</em></b>+${frNum(x.w)} W</div>`).join('')
          : '<div class="ph-n">Rien de notable pour l\'instant</div>',
      );
    }
  }

  return {root: ui, update, btn, spots, sliders, knobAt, chip};
}
