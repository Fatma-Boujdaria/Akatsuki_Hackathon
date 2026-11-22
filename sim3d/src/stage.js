// The stage: a pale studio sky, a warm sun whose shadow box follows the subject (sharp on a 2 cm sensor, wide on the
// whole house), soft fill from the room side for the indoor close-ups. frame(cam) places the camera and draws.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {buildWorld} from './house.js';

export const BG = '#e9ecea';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 38, 85);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();

  const sun = new THREE.DirectionalLight('#fff4e2', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const SUN_DIR = new THREE.Vector3(0.55, 1.15, 0.8).normalize();
  const hemi = new THREE.HemisphereLight('#ffffff', '#d6cfbf', 0.85);
  scene.add(hemi);
  // fill from inside the house toward the front wall, no shadow, for the indoor close-ups
  const fill = new THREE.DirectionalLight('#ffffff', 1.0);
  fill.position.set(0.4, 2.2, -3);
  scene.add(fill, fill.target);
  fill.target.position.set(0, 0.8, 3.3);

  const world = buildWorld();
  scene.add(world.root);

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 260);
  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const setShadow = (n) => {
    sun.shadow.mapSize.set(n, n);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  };

  // cam: target (tx, ty, tz), azimuth from +z toward +x, elevation, distance (degrees, metres), sx/sy screen shift (px)
  const D2R = Math.PI / 180;
  const frame = (cam) => {
    const {tx, ty, tz, d} = cam;
    const az = cam.az * D2R;
    const el = cam.el * D2R;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    // the shadow box follows the subject and scales with the view
    const half = Math.min(12, Math.max(0.25, d * 0.75));
    sun.target.position.set(tx, ty, tz);
    sun.position.set(tx, ty, tz).addScaledVector(SUN_DIR, half * 3 + 2);
    const sc = sun.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 0.05;
    sc.far = half * 6 + 6;
    sc.updateProjectionMatrix();
    sun.shadow.normalBias = half * 0.004;
    renderer.render(scene, camera);
  };
  const pv = new THREE.Vector3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  // Cartheco day story: k = 1 full day, 0 deep night (blue sky, dim sun, the house lamps carry the scene).
  const DAY_BG = new THREE.Color(BG);
  const NIGHT_BG = new THREE.Color('#1d2533');
  const setDaylight = (k) => {
    scene.background.copy(DAY_BG).lerp(NIGHT_BG, 1 - k);
    scene.fog.color.copy(scene.background);
    sun.intensity = 0.25 + 2.15 * k;
    hemi.intensity = 0.3 + 0.55 * k;
    scene.environmentIntensity = 0.2 + 0.35 * k;
  };
  return {renderer, scene, camera, world, resize, frame, project, size, setShadow, setDaylight};
}
