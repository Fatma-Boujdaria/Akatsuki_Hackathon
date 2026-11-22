// The geometry, built from code in metres: a one-storey Tunisian house, the STEG meter niche and the SONEDE meter
// niche on its front wall, the consumer unit and the Cartheco box inside, the current clamp on the phase wire,
// the YF-S201 on the water pipe. update(s) poses everything from the frame's state; nothing is keyframed here.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

export const COL = {
  wall: '#f6f4ef',
  blue: '#2d6aa3',
  ground: '#d8d3c6',
  walk: '#c9c4b8',
  floor: '#d9ccb4',
  L: '#7a4524',
  N: '#2b5fbf',
  black: '#25282c',
  red: '#c8322b',
  yellow: '#e2b100',
  green: '#3c9a4a',
  elec: '#4F46E5',
  water: '#0E7490',
  brass: '#b8913a',
  pipe: '#e7e6e0',
};

const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.7, metalness: 0, ...o});

/** A polyline with rounded corners, as a curve a tube can follow. */
export function route(pts, rad = 0.02) {
  const P = pts.map((p) => V(...p));
  const path = new THREE.CurvePath();
  let cur = P[0].clone();
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1];
    const b = P[i];
    if (i < P.length - 1) {
      const c = P[i + 1];
      const d1 = b.clone().sub(a);
      const l1 = d1.length();
      d1.normalize();
      const d2 = c.clone().sub(b);
      const l2 = d2.length();
      d2.normalize();
      const r = Math.min(rad, l1 * 0.45, l2 * 0.45);
      const p1 = b.clone().addScaledVector(d1, -r);
      const p2 = b.clone().addScaledVector(d2, r);
      if (cur.distanceTo(p1) > 1e-6) path.add(new THREE.LineCurve3(cur.clone(), p1));
      path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
      cur = p2;
    } else path.add(new THREE.LineCurve3(cur.clone(), b.clone()));
  }
  return path;
}

/** A canvas texture with a redraw hook (meter displays, labels). */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const redraw = (...a) => {
    g.clearRect(0, 0, w, h);
    draw(g, w, h, ...a);
    tex.needsUpdate = true;
  };
  redraw();
  return {tex, redraw};
}
const labelPlane = (w, h, px, draw, parent, pos, rotY = 0) => {
  const t = canvasTex(Math.round(w * px), Math.round(h * px), draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: t.tex, transparent: true, toneMapped: false}));
  m.position.copy(pos);
  m.rotation.y = rotY;
  parent.add(m);
  return {mesh: m, ...t};
};

export function buildWorld() {
  const root = new THREE.Group();
  const anchors = {};

  // ------------------------------------------------------------ helpers bound to a parent
  const add = (geo, mat, x, y, z, parent = root, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, parent, shadow) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, shadow);
  // a cylinder along an axis ('x', 'y' or 'z')
  const cyl = (r, len, mat, axis, x, y, z, parent, seg = 24, shadow) => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    return add(g, mat, x, y, z, parent, shadow);
  };
  const tube = (path, r, mat, parent = root, radial = 8) => {
    const segs = Math.min(500, Math.max(8, Math.ceil(path.getLength() / 0.006)));
    const geo = new THREE.TubeGeometry(path, segs, r, radial, false);
    const m = add(geo, mat, 0, 0, 0, parent, r > 0.002);
    m.userData.grow = (k) => geo.setDrawRange(0, Math.floor(clamp01(k) * segs) * radial * 6);
    return m;
  };

  // ------------------------------------------------------------ ghosting: a wall fades when it hides the subject
  const ghostGroups = {front: [], back: [], left: [], right: [], roof: []};
  const gm = (group, color, o = {}) => {
    const m = std(color, {transparent: true, ...o});
    m.userData.base = o.opacity ?? 1;
    ghostGroups[group].push(m);
    return m;
  };
  const ghostMeshes = {front: [], back: [], left: [], right: [], roof: []};
  const gbox = (group, w, h, d, mat, x, y, z) => {
    const m = box(w, h, d, mat, x, y, z);
    ghostMeshes[group].push(m);
    return m;
  };

  // ------------------------------------------------------------ ground, street, floor
  const ground = add(new THREE.PlaneGeometry(90, 90), std(COL.ground, {roughness: 0.95}), 0, 0, 0, root, false);
  ground.rotation.x = -Math.PI / 2;
  box(90, 0.03, 2.6, std(COL.walk, {roughness: 0.95}), 0, 0.015, 5.0, root, false);
  const street = add(new THREE.PlaneGeometry(90, 6), std('#a9aaa7', {roughness: 0.9}), 0, 0.005, 9.3, root, false);
  street.rotation.x = -Math.PI / 2;
  box(7.6, 0.03, 6.6, std(COL.floor, {roughness: 0.8}), 0, 0.015, 0, root, false);

  // ------------------------------------------------------------ walls (outer box x -4..4, z -3.5..3.5, 3 m high)
  const wallMat = {front: gm('front', COL.wall, {roughness: 0.93}), back: gm('back', COL.wall, {roughness: 0.93}), left: gm('left', COL.wall, {roughness: 0.93}), right: gm('right', COL.wall, {roughness: 0.93})};
  {
    // front wall with the door, two windows and the two meter niches cut through
    const sh = new THREE.Shape();
    sh.moveTo(-4, 0);
    sh.lineTo(0.3, 0);
    sh.lineTo(0.3, 2.2);
    sh.lineTo(1.3, 2.2);
    sh.lineTo(1.3, 0);
    sh.lineTo(4, 0);
    sh.lineTo(4, 3);
    sh.lineTo(-4, 3);
    sh.lineTo(-4, 0);
    const hole = (x0, y0, x1, y1) => {
      const h = new THREE.Path();
      h.moveTo(x0, y0);
      h.lineTo(x0, y1);
      h.lineTo(x1, y1);
      h.lineTo(x1, y0);
      h.lineTo(x0, y0);
      sh.holes.push(h);
    };
    hole(-3.05, 0.85, -2.15, 1.85); // STEG niche
    hole(-1.5, 0.05, -0.85, 0.5); // SONEDE niche
    hole(-1.65, 1.1, -0.45, 2.1); // window left
    hole(2.0, 1.0, 3.2, 2.1); // window right
    const geo = new THREE.ExtrudeGeometry(sh, {depth: 0.2, bevelEnabled: false});
    const m = add(geo, wallMat.front, 0, 0, 3.3);
    ghostMeshes.front.push(m);
    // niche backs, 8 cm thick, 12 cm in from the face
    gbox('front', 0.9, 1.0, 0.08, wallMat.front, -2.6, 1.35, 3.34);
    gbox('front', 0.65, 0.45, 0.08, wallMat.front, -1.175, 0.275, 3.34);
    // door, frames, glass and the blue window grilles
    const blue = gm('front', COL.blue, {roughness: 0.55});
    const glass = gm('front', '#5f7f93', {roughness: 0.15, metalness: 0.1, opacity: 0.75, emissive: new THREE.Color('#ffcf8a'), emissiveIntensity: 0});
    gbox('front', 1.0, 2.2, 0.05, blue, 0.8, 1.1, 3.36);
    gbox('front', 0.04, 0.04, 0.03, std('#d9c27a', {metalness: 0.6, roughness: 0.35}), 1.18, 1.05, 3.4);
    const win = (x0, y0, x1, y1) => {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      gbox('front', x1 - x0, y1 - y0, 0.02, glass, cx, cy, 3.4);
      for (const [w, h, x, y] of [[x1 - x0, 0.05, cx, y0 + 0.025], [x1 - x0, 0.05, cx, y1 - 0.025], [0.05, y1 - y0, x0 + 0.025, cy], [0.05, y1 - y0, x1 - 0.025, cy]]) gbox('front', w, h, 0.06, blue, x, y, 3.42);
      for (let i = 1; i < 5; i++) gbox('front', 0.018, y1 - y0 - 0.06, 0.02, blue, x0 + ((x1 - x0) * i) / 5, cy, 3.47);
    };
    win(-1.65, 1.1, -0.45, 2.1);
    win(2.0, 1.0, 3.2, 2.1);
    anchors.glass = glass;
  }
  gbox('back', 8, 3, 0.2, wallMat.back, 0, 1.5, -3.4);
  gbox('left', 0.2, 3, 6.6, wallMat.left, -3.9, 1.5, 0);
  gbox('right', 0.2, 3, 6.6, wallMat.right, 3.9, 1.5, 0);
  // flat roof slab and parapet
  const roofMat = gm('roof', '#ece7dc', {roughness: 0.93});
  gbox('roof', 8.3, 0.2, 7.3, roofMat, 0, 3.1, 0);
  gbox('roof', 8.3, 0.4, 0.15, roofMat, 0, 3.4, 3.575);
  gbox('roof', 8.3, 0.4, 0.15, roofMat, 0, 3.4, -3.575);
  gbox('roof', 0.15, 0.4, 7.3, roofMat, -4.075, 3.4, 0);
  gbox('roof', 0.15, 0.4, 7.3, roofMat, 4.075, 3.4, 0);
  const lampMat = gm('roof', '#fff6e6', {emissive: new THREE.Color('#ffd9a3'), emissiveIntensity: 0});
  for (const x of [-1.6, 1.8]) ghostMeshes.roof.push(cyl(0.18, 0.03, lampMat, 'y', x, 2.985, 0.2, root, 24, false));

  // ------------------------------------------------------------ STEG meter niche (outside, back face at z 3.38)
  const greyPlastic = std('#e6e6e1', {roughness: 0.55});
  const darkPlastic = std('#2a2d31', {roughness: 0.5});
  box(0.17, 0.27, 0.1, greyPlastic, -2.8, 1.38, 3.435);
  box(0.172, 0.004, 0.102, std('#b9bab5'), -2.8, 1.31, 3.435);
  box(0.14, 0.09, 0.004, std('#30363c', {roughness: 0.2}), -2.8, 1.43, 3.486);
  const lcd = labelPlane(0.11, 0.032, 2400, (g, w, h, kwh = 0) => {
    g.fillStyle = '#b9c8a4';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2618';
    g.font = `600 ${h * 0.62}px "JetBrains Mono", monospace`;
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    g.fillText(kwh.toFixed(1).padStart(8, '0'), w * 0.8, h * 0.54);
    g.font = `600 ${h * 0.32}px Inter, sans-serif`;
    g.fillText('kWh', w * 0.97, h * 0.6);
  }, root, V(-2.8, 1.445, 3.4885));
  labelPlane(0.06, 0.014, 2400, (g, w, h) => {
    g.fillStyle = '#e6e6e1';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3b3f45';
    g.font = `700 ${h * 0.72}px Inter, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('STEG', w / 2, h * 0.55);
  }, root, V(-2.8, 1.36, 3.4855));
  const meterLed = new THREE.MeshStandardMaterial({color: '#5a1010', emissive: new THREE.Color('#ff2a1a'), emissiveIntensity: 0});
  add(new THREE.SphereGeometry(0.003, 12, 8), meterLed, -2.75, 1.405, 3.487);
  add(new THREE.SphereGeometry(0.004, 12, 8), std(COL.red), -2.74, 1.29, 3.487); // seal
  box(0.11, 0.19, 0.09, std('#f4f4f1', {roughness: 0.5}), -2.42, 1.38, 3.425);
  box(0.024, 0.04, 0.022, darkPlastic, -2.42, 1.4, 3.478);
  add(new THREE.SphereGeometry(0.004, 12, 8), std(COL.red), -2.45, 1.31, 3.472); // seal
  // supply from the street, meter to breaker, breaker through the wall
  const elecMat = {L: std(COL.L, {roughness: 0.55}), N: std(COL.N, {roughness: 0.55}), black: std(COL.black, {roughness: 0.6})};
  tube(route([[-2.8, 0.86, 3.44], [-2.8, 1.245, 3.44]]), 0.007, elecMat.black);
  const paths = {
    Llink: route([[-2.82, 1.245, 3.43], [-2.82, 1.17, 3.43], [-2.44, 1.17, 3.43], [-2.44, 1.285, 3.43]], 0.025),
    Nlink: route([[-2.79, 1.245, 3.445], [-2.79, 1.15, 3.445], [-2.38, 1.15, 3.445], [-2.38, 1.285, 3.445]], 0.025),
    Lin: route([[-2.44, 1.475, 3.43], [-2.44, 1.8, 3.43], [-2.44, 1.8, 3.24], [-2.44, 1.562, 3.24]], 0.03),
    Nin: route([[-2.38, 1.475, 3.445], [-2.38, 1.78, 3.445], [-2.38, 1.78, 3.24], [-2.38, 1.562, 3.24]], 0.03),
  };
  for (const k of ['Llink', 'Lin']) tube(paths[k], 0.004, elecMat.L);
  for (const k of ['Nlink', 'Nin']) tube(paths[k], 0.004, elecMat.N);
  anchors.stegMeter = V(-2.8, 1.445, 3.49);
  anchors.stegBreaker = V(-2.42, 1.42, 3.47);
  anchors.toHouse = V(-2.44, 1.78, 3.43);

  // ------------------------------------------------------------ consumer unit (inside, on the front wall, z 3.21..3.30)
  const white = std('#f3f3f0', {roughness: 0.45});
  box(0.36, 0.42, 0.09, white, -2.45, 1.35, 3.255);
  box(0.33, 0.1, 0.004, std('#d8dadb'), -2.45, 1.42, 3.208);
  box(0.33, 0.1, 0.004, std('#d8dadb'), -2.45, 1.26, 3.208);
  const modMat = std('#fbfbf9', {roughness: 0.4});
  const lever = std('#3a3f46');
  const module = (x, y, w = 0.0175) => {
    box(w, 0.085, 0.02, modMat, x, y, 3.198);
    box(w * 0.5, 0.018, 0.012, lever, x, y + 0.008, 3.186);
  };
  module(-2.59, 1.42, 0.036);
  box(0.006, 0.006, 0.004, std('#3d74c9'), -2.585, 1.395, 3.187);
  for (let i = 0; i < 8; i++) module(-2.555 + i * 0.0195, 1.42);
  for (let i = 0; i < 10; i++) module(-2.6 + i * 0.0195, 1.26);
  // the dedicated 2 A breaker that feeds the sensor box, with an indigo tag
  module(-2.31, 1.26);
  box(0.0176, 0.012, 0.0205, std(COL.elec, {roughness: 0.5}), -2.31, 1.29, 3.1975);
  anchors.panel = V(-2.5, 1.45, 3.2);
  anchors.breaker2A = V(-2.31, 1.28, 3.19);

  // ------------------------------------------------------------ the current clamp on L (split core, hinged at the wall side)
  const CT = {pos: V(-2.44, 1.685, 3.24), R: 0.0145, tube: 0.0065};
  const ctMat = std('#2b2e33', {roughness: 0.45, emissive: new THREE.Color(COL.elec), emissiveIntensity: 0});
  const ct = new THREE.Group();
  ct.position.copy(CT.pos);
  root.add(ct);
  const half = (sign) => {
    const g = new THREE.TorusGeometry(CT.R, CT.tube, 12, 28, Math.PI);
    g.rotateZ(sign > 0 ? -Math.PI / 2 : Math.PI / 2);
    g.rotateX(Math.PI / 2);
    g.scale(1, 1.6, 1);
    // the hinge is the point on the wall side (+z); pivot there, mesh offset back
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, CT.R);
    const m = new THREE.Mesh(g, ctMat);
    m.position.set(0, 0, -CT.R);
    m.castShadow = true;
    pivot.add(m);
    ct.add(pivot);
    return pivot;
  };
  const ctA = half(1);
  const ctB = half(-1);
  // a small housing at the latch with the lead
  const latch = new THREE.Group();
  ct.add(latch);
  anchors.ct = CT.pos.clone().add(V(0, 0.012, -0.02));
  anchors.phaseL = V(-2.44, 1.6, 3.236);
  anchors.neutralN = V(-2.38, 1.63, 3.236);

  // field rings: the magnetic field around the phase wire the clamp picks up
  const ringMat = new THREE.MeshBasicMaterial({color: COL.elec, transparent: true, opacity: 0, depthWrite: false});
  const rings = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 48), ringMat.clone());
    m.rotation.x = Math.PI / 2;
    m.position.set(-2.44, i < 2 ? 1.72 + i * 0.014 : 1.648, 3.24);
    root.add(m);
    return m;
  });

  // AC current as beads sliding back and forth on L and N (slowed to 1 Hz)
  const beadMat = new THREE.MeshStandardMaterial({color: '#8b85ff', emissive: new THREE.Color(COL.elec), emissiveIntensity: 0.9});
  const NB = 7;
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0047, 12, 8), beadMat, NB * 4);
  root.add(beads);
  const beadPaths = [paths.Lin, paths.Nin, paths.Llink, paths.Nlink];

  // ------------------------------------------------------------ the Cartheco box (inside, right of the panel)
  const BX = {x: -2.02, y: 1.33};
  box(0.26, 0.2, 0.006, std('#d4d7da', {roughness: 0.6}), BX.x, BX.y, 3.297);
  const shell = std('#e3e5e8', {roughness: 0.5});
  box(0.26, 0.004, 0.066, shell, BX.x, BX.y + 0.098, 3.261);
  box(0.26, 0.004, 0.066, shell, BX.x, BX.y - 0.098, 3.261);
  box(0.004, 0.2, 0.066, shell, BX.x - 0.128, BX.y, 3.261);
  box(0.004, 0.2, 0.066, shell, BX.x + 0.128, BX.y, 3.261);
  const lid = box(0.26, 0.2, 0.003, new THREE.MeshStandardMaterial({color: '#e8f0f4', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false}), BX.x, BX.y, 3.2265, root, false);
  lid.renderOrder = 2;
  labelPlane(0.1, 0.018, 3000, (g, w, h) => {
    g.fillStyle = '#16181d';
    g.font = `700 ${h * 0.62}px Inter, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('Cartheco', 2, h * 0.55);
  }, root, V(BX.x + 0.065, BX.y - 0.082, 3.2245));
  // PZEM-004T board
  const pcbBlue = std('#1f5fa8', {roughness: 0.5});
  box(0.072, 0.031, 0.0016, pcbBlue, -2.085, 1.38, 3.288);
  box(0.011, 0.031, 0.011, std('#2f8f4e', {roughness: 0.5}), -2.115, 1.38, 3.282);
  const screw = std('#c9ccd0', {metalness: 0.8, roughness: 0.35});
  const TERM = {}; // terminal points on the PZEM's screw block, top to bottom: L, N, CT+, CT-
  ['CTm', 'CTp', 'N', 'L'].forEach((k, i) => {
    const y = 1.3685 + i * 0.0075;
    cyl(0.0022, 0.002, screw, 'z', -2.115, y, 3.2763, root, 12, false);
    TERM[k] = [-2.1205, y, 3.282];
  });
  box(0.01, 0.008, 0.003, darkPlastic, -2.09, 1.386, 3.2855);
  box(0.006, 0.006, 0.003, darkPlastic, -2.074, 1.372, 3.2855);
  box(0.012, 0.01, 0.008, std('#f0efe9'), -2.098, 1.371, 3.283);
  box(0.0025, 0.011, 0.0025, darkPlastic, -2.052, 1.38, 3.2858);
  const HDR = {}; // TTL header: 5V, RX, TX, GND
  ['V5', 'RX', 'TX', 'GND'].forEach((k, i) => (HDR[k] = [-2.052, 1.3842 - i * 0.00254, 3.2845]));
  labelPlane(0.03, 0.007, 6000, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.font = `700 ${h * 0.8}px Inter, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('PZEM-004T', 1, h * 0.55);
  }, root, V(-2.082, 1.3925, 3.2869));
  // ESP32 DevKit
  box(0.054, 0.028, 0.0016, std('#1d1f22', {roughness: 0.5}), -1.965, 1.38, 3.288);
  box(0.018, 0.016, 0.0032, std('#b9bec4', {metalness: 0.8, roughness: 0.35}), -1.948, 1.38, 3.2855);
  box(0.006, 0.008, 0.003, std('#c9ccd0', {metalness: 0.8, roughness: 0.3}), -1.992, 1.38, 3.2865);
  box(0.044, 0.0025, 0.0025, darkPlastic, -1.967, 1.3675, 3.2858);
  box(0.044, 0.0025, 0.0025, darkPlastic, -1.967, 1.3925, 3.2858);
  labelPlane(0.014, 0.006, 8000, (g, w, h) => {
    g.fillStyle = '#4b5058';
    g.font = `700 ${h * 0.8}px Inter, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ESP32', w / 2, h * 0.55);
  }, root, V(-1.948, 1.38, 3.2838));
  const espLed = new THREE.MeshStandardMaterial({color: '#0b1a3a', emissive: new THREE.Color('#4aa3ff'), emissiveIntensity: 0});
  box(0.002, 0.0015, 0.001, espLed, -1.982, 1.373, 3.2867, root, false);
  const ESP = {VIN: [-1.989, 1.3675, 3.2845], GND: [-1.986, 1.3675, 3.2845], G16: [-1.975, 1.3675, 3.2845], G17: [-1.972, 1.3675, 3.2845], G27: [-1.978, 1.3925, 3.2845]};
  // 5 V supply and the divider board
  box(0.034, 0.02, 0.015, std('#2c2f33', {roughness: 0.5}), -2.1, 1.285, 3.2865);
  labelPlane(0.012, 0.006, 8000, (g, w, h) => {
    g.fillStyle = '#e8e8e8';
    g.font = `700 ${h * 0.8}px Inter, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('5 V', 1, h * 0.55);
  }, root, V(-2.1, 1.285, 3.2788));
  box(0.028, 0.018, 0.0016, std('#2f7d47', {roughness: 0.5}), -1.958, 1.282, 3.289);
  const resMat = std('#d9c7a0');
  cyl(0.0013, 0.007, resMat, 'x', -1.964, 1.286, 3.2865, root, 10, false);
  cyl(0.0013, 0.007, resMat, 'x', -1.952, 1.278, 3.2865, root, 10, false);
  // cable glands
  const gland = std('#9aa0a6', {roughness: 0.5});
  cyl(0.005, 0.008, gland, 'y', -2.12, 1.432, 3.262, root, 16, false);
  cyl(0.005, 0.008, gland, 'x', -2.152, 1.3, 3.262, root, 16, false);
  cyl(0.005, 0.008, gland, 'y', -1.93, 1.228, 3.262, root, 16, false);
  anchors.pzem = V(-2.085, 1.385, 3.286);
  anchors.esp = V(-1.95, 1.384, 3.283);
  anchors.supply = V(-2.1, 1.278, 3.279);
  anchors.divider = V(-1.958, 1.282, 3.286);
  anchors.uart = V(-2.02, 1.366, 3.275);

  // wires inside and to the box (thin: r 0.8 to 1.6 mm)
  const w = (pts, r, color, rad = 0.008) => tube(route(pts, rad), r, std(color, {roughness: 0.55}), root, 6);
  const ctLead = w([[-2.43, 1.68, 3.226], [-2.43, 1.66, 3.214], [-2.3, 1.66, 3.214], [-2.14, 1.6, 3.24], [-2.12, 1.5, 3.255], [-2.12, 1.432, 3.262], [-2.12, 1.4, 3.274], TERM.CTp], 0.0016, COL.black, 0.02);
  const tapL = w([[-2.313, 1.218, 3.203], [-2.313, 1.19, 3.203], [-2.255, 1.19, 3.203], [-2.2, 1.25, 3.235], [-2.165, 1.3, 3.262], [-2.14, 1.302, 3.268], [-2.128, 1.35, 3.278], TERM.L], 0.0012, COL.L, 0.012);
  const tapN = w([[-2.307, 1.218, 3.206], [-2.307, 1.195, 3.206], [-2.255, 1.195, 3.206], [-2.2, 1.255, 3.237], [-2.165, 1.296, 3.262], [-2.14, 1.297, 3.27], [-2.13, 1.345, 3.279], TERM.N], 0.0012, COL.N, 0.012);
  w([[-2.14, 1.302, 3.268], [-2.125, 1.29, 3.276], [-2.117, 1.289, 3.28]], 0.0009, COL.L);
  w([[-2.14, 1.297, 3.27], [-2.125, 1.284, 3.277], [-2.117, 1.282, 3.28]], 0.0009, COL.N);
  w([[-2.083, 1.29, 3.279], [-2.06, 1.31, 3.276], [-2.0, 1.345, 3.276], ESP.VIN], 0.0009, COL.red);
  w([[-2.083, 1.28, 3.279], [-2.055, 1.3, 3.277], [-1.998, 1.34, 3.277], ESP.GND], 0.0009, COL.black);
  // UART: PZEM TX to GPIO16, PZEM RX from GPIO17, plus its 5 V and GND
  const jump = (a, b, bulge, color) => w([a, [a[0] + 0.006, a[1], a[2] - 0.006], [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - bulge, 3.274], [b[0], b[1] - 0.004, b[2] - 0.006], b], 0.0008, color, 0.006);
  jump(HDR.TX, ESP.G16, 0.012, COL.yellow);
  jump(HDR.RX, ESP.G17, 0.016, COL.green);
  jump(HDR.V5, ESP.VIN, 0.02, COL.red);
  jump(HDR.GND, ESP.GND, 0.024, COL.black);
  // the flow sensor's three wires after the bottom gland: red 5 V, black GND, yellow through the divider to GPIO27
  w([[-1.93, 1.232, 3.262], [-1.925, 1.3, 3.272], [-1.99, 1.355, 3.276], ESP.VIN], 0.0008, COL.red);
  w([[-1.932, 1.232, 3.264], [-1.928, 1.296, 3.274], [-1.985, 1.352, 3.277], ESP.GND], 0.0008, COL.black);
  w([[-1.928, 1.232, 3.26], [-1.94, 1.262, 3.272], [-1.97, 1.28, 3.284]], 0.0008, COL.yellow);
  w([[-1.946, 1.287, 3.284], [-1.934, 1.31, 3.276], [-1.932, 1.401, 3.276], [-1.978, 1.399, 3.276], ESP.G27], 0.0008, '#e07a1f');

  // Wi-Fi arcs that pulse on each POST
  const wifiMat = new THREE.MeshBasicMaterial({color: COL.elec, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide});
  const wifi = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.012 + i * 0.009, 0.0012, 6, 32, Math.PI / 2), wifiMat.clone());
    m.rotation.z = Math.PI / 4;
    m.position.set(-1.94, 1.398, 3.222);
    root.add(m);
    return m;
  });

  // ------------------------------------------------------------ water: SONEDE niche outside, household pipe inside
  const pipeMat = std(COL.pipe, {roughness: 0.5});
  const brass = std(COL.brass, {metalness: 0.75, roughness: 0.38});
  const pipeR = 0.0105;
  const W1 = route([[-1.44, -0.05, 3.44], [-1.44, 0.2, 3.44], [-0.98, 0.2, 3.44], [-0.98, 0.2, 3.22], [-0.68, 0.2, 3.22]], 0.035);
  const W2 = route([[-0.56, 0.2, 3.22], [1.55, 0.2, 3.22], [1.55, 0.86, 3.22]], 0.05);
  tube(W1, pipeR, pipeMat, root, 16);
  tube(W2, pipeR, pipeMat, root, 16);
  // SONEDE stopcock, meter and check valve
  cyl(0.015, 0.03, brass, 'x', -1.36, 0.2, 3.44);
  box(0.006, 0.03, 0.006, brass, -1.36, 0.225, 3.44);
  box(0.04, 0.006, 0.01, std(COL.red), -1.36, 0.242, 3.44);
  cyl(0.017, 0.11, brass, 'x', -1.2, 0.2, 3.44);
  cyl(0.042, 0.04, brass, 'y', -1.2, 0.235, 3.44, root, 32);
  const dial = canvasTex(256, 256, (g, w, h, m3 = 0) => {
    g.fillStyle = '#f4f3ee';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2, 0, TAU);
    g.fill();
    g.strokeStyle = '#25282c';
    g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      g.beginPath();
      g.moveTo(w / 2 + Math.cos(a) * 112, h / 2 + Math.sin(a) * 112);
      g.lineTo(w / 2 + Math.cos(a) * 122, h / 2 + Math.sin(a) * 122);
      g.stroke();
    }
    const whole = Math.floor(m3);
    const litres = Math.floor((m3 - whole) * 1000 + 1e-6);
    g.fillStyle = '#16181d';
    g.fillRect(40, 70, 120, 40);
    g.fillStyle = COL.red;
    g.fillRect(160, 70, 60, 40);
    g.font = '600 30px "JetBrains Mono", monospace';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText(String(whole).padStart(5, '0'), 46, 92);
    g.fillText(String(litres).padStart(3, '0'), 164, 92);
    g.fillStyle = '#25282c';
    g.font = '600 22px Inter, sans-serif';
    g.fillText('m³', 112, 140);
    g.font = '700 18px Inter, sans-serif';
    g.fillText('SONEDE', 92, 196);
    g.font = '500 14px Inter, sans-serif';
    g.fillText('1 L per turn', 86, 170);
  });
  const dialFace = new THREE.Mesh(new THREE.CircleGeometry(0.036, 48), new THREE.MeshBasicMaterial({map: dial.tex, toneMapped: false}));
  dialFace.rotation.x = -Math.PI / 2;
  dialFace.position.set(-1.2, 0.2552, 3.44);
  root.add(dialFace);
  const pointer = new THREE.Group();
  pointer.position.set(-1.2, 0.2565, 3.44);
  root.add(pointer);
  const pm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0012, 0.003), new THREE.MeshBasicMaterial({color: COL.red}));
  pm.position.x = 0.009;
  pointer.add(pm);
  cyl(0.014, 0.025, brass, 'x', -1.06, 0.2, 3.44, root, 6);
  add(new THREE.SphereGeometry(0.004, 12, 8), std(COL.red), -1.17, 0.215, 3.482); // seal
  anchors.sonede = V(-1.2, 0.255, 3.44);
  anchors.stopcock = V(-1.36, 0.24, 3.44);
  anchors.toHouseWater = V(-0.98, 0.2, 3.4);

  // household ball valve, inside
  cyl(0.016, 0.04, brass, 'x', -0.85, 0.2, 3.22);
  add(new THREE.SphereGeometry(0.019, 20, 14), brass, -0.85, 0.2, 3.22);
  const valvePivot = new THREE.Group();
  valvePivot.position.set(-0.85, 0.224, 3.22);
  root.add(valvePivot);
  const valveLever = box(0.05, 0.006, 0.012, std(COL.red, {roughness: 0.5}), 0.022, 0, 0, valvePivot);
  void valveLever;
  anchors.valve = V(-0.85, 0.226, 3.22);

  // unions: tails fixed on the pipe ends, nuts that slide onto the sensor threads
  cyl(0.0125, 0.008, brass, 'x', -0.684, 0.2, 3.22, root, 6);
  cyl(0.0125, 0.008, brass, 'x', -0.556, 0.2, 3.22, root, 6);
  const nutA = cyl(0.016, 0.018, brass, 'x', -0.7, 0.2, 3.22, root, 6);
  const nutB = cyl(0.016, 0.018, brass, 'x', -0.54, 0.2, 3.22, root, 6);

  // ------------------------------------------------------------ YF-S201 (local x along the flow)
  const yf = new THREE.Group();
  root.add(yf);
  const YF0 = V(-0.62, 0.2, 3.22);
  const yfMat = std('#1d1f22', {roughness: 0.5, transparent: true});
  const YF_DARK = new THREE.Color('#1d1f22');
  const YF_GLASS = new THREE.Color('#56606e');
  cyl(0.0105, 0.012, yfMat, 'x', -0.038, 0, 0, yf, 20);
  cyl(0.0105, 0.012, yfMat, 'x', 0.038, 0, 0, yf, 20);
  cyl(0.0125, 0.064, yfMat, 'x', 0, 0, 0, yf, 24);
  cyl(0.0175, 0.03, yfMat, 'y', 0, 0, 0, yf, 28);
  cyl(0.0158, 0.008, yfMat, 'y', 0, 0.019, 0, yf, 28);
  box(0.012, 0.005, 0.009, std('#121315', {roughness: 0.5}), 0, 0.0255, 0, yf);
  const hallLed = new THREE.MeshStandardMaterial({color: '#3a0a0a', emissive: new THREE.Color('#ff3b2a'), emissiveIntensity: 0});
  add(new THREE.SphereGeometry(0.0018, 10, 8), hallLed, 0, 0.0262, -0.0047, yf, false);
  // the flow arrow on the face toward the room (-z). Drawn pointing left on the canvas: that is +x in the world.
  const arrow = labelPlane(0.044, 0.013, 4000, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffffff';
    g.lineWidth = h * 0.12;
    g.beginPath();
    g.moveTo(w * 0.42, h * 0.5);
    g.lineTo(w * 0.04, h * 0.5);
    g.stroke();
    g.beginPath();
    g.moveTo(w * 0.02, h * 0.5);
    g.lineTo(w * 0.13, h * 0.2);
    g.lineTo(w * 0.13, h * 0.8);
    g.fill();
    g.font = `700 ${h * 0.5}px Inter, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('YF-S201', w * 0.47, h * 0.55);
  }, yf, V(0, -0.004, -0.0179), Math.PI);
  // rotor: hub, six blades, one magnet
  const rotor = new THREE.Group();
  yf.add(rotor);
  const rotorMat = std('#ece9e0', {roughness: 0.45});
  cyl(0.003, 0.022, rotorMat, 'y', 0, 0, 0, rotor, 12, false);
  for (let i = 0; i < 6; i++) {
    const b = box(0.011, 0.02, 0.0012, rotorMat, 0, 0, 0, rotor, false);
    const a = (i / 6) * TAU;
    b.position.set(Math.cos(a) * 0.0078, 0, Math.sin(a) * 0.0078);
    b.rotation.y = -a;
  }
  box(0.003, 0.008, 0.003, std('#c8322b', {roughness: 0.4}), 0.0135, 0, 0, rotor, false);
  // water inside, seen through the x-ray body
  const dropMat = new THREE.MeshStandardMaterial({color: '#7fd3e6', emissive: new THREE.Color(COL.water), emissiveIntensity: 0.6, transparent: true, opacity: 0.9});
  const ND = 46;
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0012, 8, 6), dropMat, ND);
  yf.add(drops);
  const dropSeed = Array.from({length: ND}, (_, i) => [((i * 0.6180339) % 1), Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5]);
  anchors.yf = () => yf.position.clone().add(V(0, 0.004, -0.018));
  anchors.yfWire = () => yf.position.clone().add(V(0, 0.03, 0));

  // the sensor cable up the wall to the box (grows once the sensor is fitted)
  const yfCable = tube(route([[-0.62, 0.229, 3.22], [-0.62, 0.3, 3.22], [-0.62, 0.3, 3.288], [-1.93, 0.3, 3.288], [-1.93, 1.2, 3.288], [-1.93, 1.226, 3.262]], 0.03), 0.0022, std('#8a8f96', {roughness: 0.6}), root, 8);

  // flow chevrons sliding along the pipes at the real water speed
  const chevMat = new THREE.MeshStandardMaterial({color: '#9fdcea', emissive: new THREE.Color(COL.water), emissiveIntensity: 0.9});
  const chevGeo = new THREE.ConeGeometry(0.0038, 0.01, 10);
  chevGeo.rotateZ(-Math.PI / 2); // points along +x
  const SPACE = 0.07;
  const chevPaths = [W1, W2].map((p) => ({p, len: p.getLength()}));
  const NC = chevPaths.reduce((n, c) => n + Math.floor(c.len / SPACE), 0);
  const chev = new THREE.InstancedMesh(chevGeo, chevMat, NC);
  root.add(chev);

  // ------------------------------------------------------------ kitchen: counter, sink and tap, oven, fridge
  box(2.2, 0.9, 0.55, std('#ece8df', {roughness: 0.7}), 2.3, 0.45, 3.025);
  box(2.24, 0.03, 0.58, std('#b8ae9c', {roughness: 0.6}), 2.3, 0.915, 3.02);
  box(0.42, 0.02, 0.34, std('#8d9196', {metalness: 0.6, roughness: 0.35}), 1.55, 0.925, 3.02);
  const chrome = std('#d7dadd', {metalness: 0.9, roughness: 0.2});
  tube(route([[1.55, 0.93, 3.2], [1.55, 1.16, 3.2], [1.55, 1.16, 3.08], [1.55, 1.125, 3.07]], 0.04), 0.011, chrome);
  const streamMat = new THREE.MeshStandardMaterial({color: '#a9e2ee', emissive: new THREE.Color(COL.water), emissiveIntensity: 0.35, transparent: true, opacity: 0.75, roughness: 0.1});
  const stream = cyl(1, 1, streamMat, 'y', 1.55, 1.025, 3.07, root, 14, false);
  box(0.58, 0.58, 0.02, std('#2c2f33', {roughness: 0.4}), 2.75, 0.45, 2.74);
  const ovenGlass = new THREE.MeshStandardMaterial({color: '#20120a', emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 0, roughness: 0.2});
  box(0.42, 0.22, 0.004, ovenGlass, 2.75, 0.47, 2.728);
  box(0.65, 1.75, 0.62, std('#f2f2ef', {roughness: 0.45}), 3.43, 0.875, 2.0);
  anchors.tap = V(1.55, 1.12, 3.07);
  anchors.oven = V(2.75, 0.5, 2.72);

  // ------------------------------------------------------------ the other loads
  // water heater on the right wall
  cyl(0.22, 0.75, std('#f4f4f1', {roughness: 0.45}), 'y', 3.56, 1.95, -1.6);
  const heaterLed = new THREE.MeshStandardMaterial({color: '#3a0a0a', emissive: new THREE.Color('#ff3b2a'), emissiveIntensity: 0});
  add(new THREE.SphereGeometry(0.012, 12, 8), heaterLed, 3.34, 1.75, -1.6, root, false);
  // AC indoor unit on the back wall, outdoor unit on the right wall outside
  box(0.8, 0.27, 0.2, std('#f6f6f3', {roughness: 0.4}), 0.6, 2.45, -3.19);
  const louverPivot = new THREE.Group();
  louverPivot.position.set(0.6, 2.33, -3.09);
  root.add(louverPivot);
  box(0.74, 0.012, 0.06, std('#e6e6e2'), 0, 0, 0.03, louverPivot);
  const acLed = new THREE.MeshStandardMaterial({color: '#0b1a3a', emissive: new THREE.Color('#4aa3ff'), emissiveIntensity: 0});
  add(new THREE.SphereGeometry(0.006, 10, 8), acLed, 0.92, 2.4, -3.088, root, false);
  box(0.3, 0.6, 0.8, std('#ecece8', {roughness: 0.5}), 4.17, 0.32, 1.2);
  cyl(0.2, 0.01, std('#3b3f45', {roughness: 0.5}), 'x', 4.325, 0.34, 1.2, root, 32);
  const fan = new THREE.Group();
  fan.position.set(4.335, 0.34, 1.2);
  root.add(fan);
  for (let i = 0; i < 3; i++) {
    const b = box(0.004, 0.16, 0.06, std('#c9ccd0', {roughness: 0.4}), 0, 0, 0, fan, false);
    const a = (i / 3) * TAU;
    b.position.set(0, Math.cos(a) * 0.09, Math.sin(a) * 0.09);
    b.rotation.x = a;
  }
  anchors.acOut = V(4.33, 0.5, 1.2);
  // the room light
  const roomLight = new THREE.PointLight('#ffd9a3', 0, 12, 1.4);
  roomLight.position.set(0.2, 2.6, 0.4);
  root.add(roomLight);

  anchors.stegNiche = V(-2.6, 1.2, 3.5);
  anchors.sonedeNiche = V(-1.17, 0.3, 3.5);

  // ------------------------------------------------------------ pose everything from the state
  const M4 = new THREE.Matrix4();
  const Q4 = new THREE.Quaternion();
  const S1 = V(1, 1, 1);
  const P = V(0, 0, 0);
  const tan = V(0, 0, 0);
  const X = V(1, 0, 0);
  let lastKwh = -1;
  let lastM3 = -1;
  const update = (s) => {
    // walls
    for (const k of Object.keys(ghostGroups)) {
      const g = s.ghost[k] ?? 0;
      for (const m of ghostGroups[k]) {
        m.opacity = m.userData.base * (1 - 0.9 * g);
        m.depthWrite = g < 0.02;
      }
      for (const m of ghostMeshes[k]) m.castShadow = g < 0.5;
    }
    // x-ray overview: the water pipe and the mains wires light up so their routes read through the walls
    pipeMat.emissive.set(COL.water);
    pipeMat.emissiveIntensity = 0.55 * (s.xrayK ?? 0) * (s.view === 'house' ? 1 : 0);
    for (const m of [elecMat.L, elecMat.N]) {
      m.emissive.set(COL.elec);
      m.emissiveIntensity = 0.6 * (s.xrayK ?? 0) * (s.view === 'house' ? 1 : 0);
    }
    // loads
    const lv = s.levels;
    lampMat.emissiveIntensity = 1.6 * lv.lights;
    anchors.glass.emissiveIntensity = 0.12 * lv.lights;
    roomLight.intensity = 9 * lv.lights;
    heaterLed.emissiveIntensity = 2.5 * lv.heater;
    ovenGlass.emissiveIntensity = 1.6 * lv.oven;
    acLed.emissiveIntensity = 2.5 * lv.ac;
    louverPivot.rotation.x = -0.9 * lv.ac;
    fan.rotation.x = s.fanAngle;

    // STEG meter display and its LED (blinks with the energy)
    const kwh = Math.round((s.stegIndex) * 10) / 10;
    if (kwh !== lastKwh) {
      lcd.redraw(kwh);
      lastKwh = kwh;
    }
    meterLed.emissiveIntensity = s.meterBlink ? 3 : 0;

    // the clamp: slides in open from the room side, closes round L, then its lead and the voltage taps connect
    const pe = s.poseE;
    const kIn = smooth(pe / 0.35);
    const open = 1.25 * (1 - smooth((pe - 0.35) / 0.3));
    ct.position.set(CT.pos.x, CT.pos.y, CT.pos.z - 0.085 * (1 - kIn));
    ctA.rotation.y = -open;
    ctB.rotation.y = open;
    const closed = smooth((pe - 0.6) / 0.08);
    const ac = Math.sin(TAU * s.acPhase);
    const field = Math.min(1, s.el.I / 20);
    ctMat.emissiveIntensity = closed * Math.abs(ac) * (0.15 + 0.7 * field);
    ctLead.userData.grow(smooth((pe - 0.68) / 0.16));
    tapL.userData.grow(smooth((pe - 0.84) / 0.16));
    tapN.userData.grow(smooth((pe - 0.84) / 0.16));
    rings.forEach((m, i) => {
      const age = (s.acPhase * 2 + i / 3) % 1;
      const r = 0.024 + 0.03 * age;
      m.scale.set(r, r, r);
      m.material.opacity = s.showField * (0.3 + 0.7 * Math.abs(ac)) * (0.3 + 0.7 * field) * (1 - age) * 0.9;
    });
    const amp = Math.min(0.09, 0.0045 * s.el.I);
    let n = 0;
    beadPaths.forEach((p, pi) => {
      const len = p.getLength();
      const sign = pi % 2 === 0 ? 1 : -1;
      for (let i = 0; i < NB; i++) {
        let u = (i + 0.5) / NB + (sign * amp * ac) / len;
        u = ((u % 1) + 1) % 1;
        p.getPointAt(u, P);
        const sc = s.showBeads;
        M4.compose(P, Q4.identity(), S1.set(sc, sc, sc));
        beads.setMatrixAt(n++, M4);
      }
    });
    beads.instanceMatrix.needsUpdate = true;

    // Wi-Fi pulse on each POST and the ESP32 LED
    wifi.forEach((m, i) => {
      const k = s.postAge;
      const a = clamp01(1 - Math.abs(k * 3 - i * 0.55 - 0.3) * 1.6);
      m.material.opacity = k < 1.2 ? a * 0.9 : 0;
    });
    espLed.emissiveIntensity = s.postAge < 0.25 ? 3 : 0.2;

    // the water side
    const pw = s.poseW;
    const rise = smooth((pw - 0.22) / 0.36);
    yf.position.set(YF0.x, YF0.y - 0.12 * (1 - rise), YF0.z);
    const screwIn = smooth((pw - 0.6) / 0.2);
    nutA.position.x = -0.7 + 0.028 * screwIn;
    nutB.position.x = -0.54 - 0.028 * screwIn;
    nutA.rotation.x = screwIn * 9;
    nutB.rotation.x = -screwIn * 9;
    valvePivot.rotation.y = -(Math.PI / 2) * (1 - s.valveOpen);
    yfCable.userData.grow(smooth((pw - 0.62) / 0.22));
    const glass = s.yfGlass;
    yfMat.opacity = 1 - 0.62 * glass;
    yfMat.color.copy(YF_DARK).lerp(YF_GLASS, glass);
    yfMat.depthWrite = glass < 0.05;
    arrow.mesh.material.opacity = 1 - 0.5 * glass;
    rotor.rotation.y = -s.rotorAngle;
    hallLed.emissiveIntensity = s.hallOn ? 4 : 0;
    // drops: straight through the pipe ends, swirling round the rotor in the chamber
    const Qk = Math.min(1, s.Q / 6);
    for (let i = 0; i < ND; i++) {
      const [u0, a0, b0] = dropSeed[i];
      const u = (u0 + s.dropPhase) % 1;
      const x = -0.044 + 0.088 * u;
      const inCh = Math.abs(x) < 0.016;
      const ang = a0 * TAU + s.rotorAngle * 0.9;
      const rr = inCh ? 0.006 + 0.008 * b0 : 0.006 * b0;
      P.set(x, (inCh ? 0.008 : 0.006) * Math.sin(ang) * (inCh ? 1 : b0), rr * Math.cos(ang));
      const sc = s.Q > 0.05 ? 0.6 + 0.4 * Qk : 0;
      M4.compose(P, Q4.identity(), S1.set(sc, sc, sc));
      drops.setMatrixAt(i, M4);
    }
    drops.instanceMatrix.needsUpdate = true;
    // chevrons
    let c = 0;
    const show = s.Q > 0.02 ? Math.min(1, 0.4 + s.Q / 6) : 0;
    for (const {p, len} of chevPaths) {
      const nn = Math.floor(len / SPACE);
      for (let i = 0; i < nn; i++) {
        const d = (i * SPACE + s.flowDist) % len;
        const u = d / len;
        p.getPointAt(u, P);
        p.getTangentAt(u, tan);
        Q4.setFromUnitVectors(X, tan);
        P.y += pipeR + 0.0028;
        M4.compose(P, Q4, S1.set(show, show, show));
        chev.setMatrixAt(c++, M4);
      }
    }
    chev.instanceMatrix.needsUpdate = true;
    // SONEDE pointer turns once per litre; the dial counts the same water
    pointer.rotation.y = -s.sonedeTurn * TAU;
    const m3 = Math.floor(s.sonedeIndex * 1000) / 1000;
    if (m3 !== lastM3) {
      dial.redraw(m3);
      lastM3 = m3;
    }
    // tap stream
    const sr = s.tapFlow > 0.02 ? 0.0012 + 0.0028 * Math.sqrt(Math.min(1.5, s.tapFlow / 6.2)) : 0;
    stream.visible = sr > 0;
    stream.scale.set(sr, 0.2, sr);
  };

  return {root, update, anchors, ghostGroups};
}
