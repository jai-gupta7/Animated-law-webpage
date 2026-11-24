/* First Light: one continuous 3D world, travelled by native scroll from night to dawn.
   0 kitchen → 1 rainy street → 2 crossroads → 3 offices → 4 porch lights → 5 map of lights → 6 the firm's door.
   The letter from the kitchen table travels the whole way and is sealed into an envelope at the end. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { state, emit, on, reduce, dawnAt } from './ui.js';
import { OUTLINE, STATES, OFFICES, SERVED, inOutline } from './us-map.js';
import { createLetter } from './letter.js';

const $ = (s) => document.querySelector(s);
let phone = innerWidth < 760;
const low = phone || (navigator.hardwareConcurrency || 8) <= 4;

// ---------- helpers (seeded: the world is identical on every visit) ----------
let seed = 20261124;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rnd = (a, b) => a + rand() * (b - a);
const pick = (a) => a[(rand() * a.length) | 0];
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpV = new THREE.Vector3();
const tmpE = new THREE.Euler(), tmpC = new THREE.Color();

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GLOW = glowTexture();
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  document.fonts?.ready.then(() => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; });
  return t;
}
const SERIF = '"Newsreader", Georgia, serif', SANS = '"Hanken Grotesk", Arial, sans-serif';

// ---------- renderer ----------
const canvas = $('#world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  emit('webgl-fail');
  throw err;
}
const DPR = Math.min(devicePixelRatio || 1, low ? 1.25 : 1.75);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(new THREE.Color('#0d1322'), 0.03);
scene.background = scene.fog.color;
const camera = new THREE.PerspectiveCamera(phone ? 62 : 46, innerWidth / innerHeight, 0.05, 900);

// ---------- the road ----------
const pathX = (z) => (z > -6 ? 0 : 2.2 * Math.sin((z + 6) * 0.035) * (1 - smooth(clamp((-z - 315) / 25))));
const MAP = { z: -255, k: 2.6, y: 0.3, from: -203, to: -303 }; // the map of lights lies flat between these z
const mapXY = (lon, lat) => [(lon + 96) * 0.788 * MAP.k, MAP.z - (lat - 38) * MAP.k];
const inMapZone = (z) => z < MAP.from + 6 && z > MAP.to - 6;
const SIGN = v3(pathX(-60) + 3.9, 0, -57.6);
const FIRM = { x: pathX(-102) + 6.8, z0: -94, z1: -110, h: 9.5 };
const HEAR = { x: pathX(-104) - 7.2, z0: -98, z1: -114, h: 7.5 };
const DOOR = v3(0, 0, -352);

// ---------- camera path: stations [position, look-at]; extras only shape the curve ----------
function stationList() {
  return [
    { p: [0, 1.55, 2.6], l: [0.25, 0.85, -0.6], s: true }, // 0 kitchen
    { p: [0.05, 1.68, -2.4], l: [0.5, 1.6, -30] }, // through the open window
    { p: [pathX(-10) + 0.3, 1.75, -10], l: [pathX(-40) + 0.8, 1.7, -40], s: true }, // 1 street
    { p: [pathX(-51) - 1.2, 2.0, -51], l: [SIGN.x - 0.9, 2.3, SIGN.z], s: true }, // 2 crossroads
    { p: [pathX(-88) - 2.0, 2.0, -88], l: [FIRM.x + 1.5, 4.2, -101], s: true }, // 3 offices
    { p: [pathX(-126) - 1.4, 2.1, -126], l: [pathX(-146) + 6.5, 2.0, -146], s: true }, // 4 porch lights
    phone ? { p: [16, 62, -204], l: [24, 0, -241], s: true } : { p: [-4, 104, -170], l: [-4, 0, -252], s: true }, // 5 map
    { p: [0, 22, -318], l: [0, 3, -352] }, // gliding down to the door
    { p: [0, 1.9, -334], l: [0, 2.7, -352], s: true }, // 6 the door
  ];
}
let posCurve, lookCurve, stationT;
function buildCurves() {
  const L = stationList();
  posCurve = new THREE.CatmullRomCurve3(L.map((s) => v3(...s.p)), false, 'centripetal');
  lookCurve = new THREE.CatmullRomCurve3(L.map((s) => v3(...s.l)), false, 'centripetal');
  stationT = L.map((s, i) => (s.s ? i / (L.length - 1) : -1)).filter((t) => t >= 0);
}
buildCurves();
const LAST = 6;

function groundH(x, z) {
  if (z > -4) return 0;
  const d = Math.abs(x - pathX(z));
  let h = Math.max(0, d - 9) ** 1.25 * 0.06 + 0.25 * Math.sin(x * 0.13 + 1) * Math.cos(z * 0.09) * smooth(clamp((d - 5) / 6));
  h *= 1 - smooth(clamp((-z - MAP.from + 10) / 10)) * (1 - smooth(clamp((-z + MAP.to + 10) / 10))) * 0.96; // flat under the map
  return h;
}

// ---------- sky, stars, sun ----------
const skyU = {
  uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, -0.1, -1) }, uSunCol: { value: new THREE.Color() },
};
const skyGroup = new THREE.Group();
scene.add(skyGroup);
skyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform vec3 uTop, uHor, uSunDir, uSunCol; varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(uHor, uTop, pow(h, 0.5));
      float m = max(dot(d, normalize(uSunDir)), 0.0);
      float band = exp(-abs(d.y - uSunDir.y) * 7.0);
      c += uSunCol * (pow(m, 420.0) * 6.0 + pow(m, 18.0) * 0.55 + pow(m, 3.0) * 0.18 * band);
      if (d.y < 0.0) c = mix(uHor, uHor * 0.6, clamp(-d.y * 4.0, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0);
    }`,
})));
const stars = (() => {
  const n = low ? 700 : 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), y = rnd(0.08, 1), r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 450, y * 450, Math.sin(a) * r * 450], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.4 * DPR, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
  skyGroup.add(p);
  return p;
})();
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ffcf8f', fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
sunGlow.scale.setScalar(110);
skyGroup.add(sunGlow);

// time-of-day keys: the light is the plot
const KEYS = [
  { t: 0.0, top: '#03050c', hor: '#0e1526', fog: '#0c1221', sun: '#000000', hemiS: '#3a4870', hemiG: '#07080c', hemi: 0.45, sunI: 0.0, moon: 0.5, exp: 1.0 },
  { t: 0.35, top: '#080d20', hor: '#262b47', fog: '#1d2238', sun: '#3a2c48', hemiS: '#4a5078', hemiG: '#0a0a10', hemi: 0.55, sunI: 0.05, moon: 0.35, exp: 1.02 },
  { t: 0.7, top: '#18264a', hor: '#7c5a6c', fog: '#4c4058', sun: '#ff9f6a', hemiS: '#8a7a9a', hemiG: '#141018', hemi: 0.75, sunI: 0.5, moon: 0.1, exp: 1.06 },
  { t: 1.0, top: '#34548a', hor: '#efae79', fog: '#b98c7c', sun: '#ffc98a', hemiS: '#c9b3a6', hemiG: '#2a2018', hemi: 0.7, sunI: 1.5, moon: 0.0, exp: 1.1 },
  { t: 1.35, top: '#5d8ec6', hor: '#f4ddbd', fog: '#d9c7b2', sun: '#fff0d0', hemiS: '#e6dccb', hemiG: '#3a3024', hemi: 0.95, sunI: 2.2, moon: 0.0, exp: 1.15 },
].map((k) => ({ ...k, top: new THREE.Color(k.top), hor: new THREE.Color(k.hor), fog: new THREE.Color(k.fog), sun: new THREE.Color(k.sun), hemiS: new THREE.Color(k.hemiS), hemiG: new THREE.Color(k.hemiG) }));
const sky = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), hemi: 0, sunI: 0, moon: 0, exp: 1 };
function skyAt(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1], f = clamp((t - a.t) / (b.t - a.t));
  for (const c of ['top', 'hor', 'fog', 'sun', 'hemiS', 'hemiG']) sky[c].copy(a[c]).lerp(b[c], f);
  for (const n of ['hemi', 'sunI', 'moon', 'exp']) sky[n] = lerp(a[n], b[n], f);
}
const FOG_D = [0.03, 0.042, 0.046, 0.03, 0.024, 0.0028, 0.0055];

// ---------- light ----------
const hemi = new THREE.HemisphereLight('#3a4870', '#07080c', 0.45);
const sunLight = new THREE.DirectionalLight('#ffc98a', 0);
const moonLight = new THREE.DirectionalLight('#8fa6d8', 0.5);
moonLight.position.set(-60, 120, 40);
scene.add(hemi, sunLight, moonLight, sunLight.target);

// ---------- ground and road ----------
{
  const g = new THREE.PlaneGeometry(360, 540, low ? 80 : 130, low ? 200 : 320);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -180);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3);
  const grass = new THREE.Color('#0e1611'), grass2 = new THREE.Color('#1a2419'), gravel = new THREE.Color('#1c1d21');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, groundH(x, z));
    const d = Math.abs(x - pathX(z));
    tmpC.copy(grass).lerp(grass2, 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.23));
    if (d < 4.2) tmpC.lerp(gravel, 1 - smooth(clamp((d - 3) / 1.2)));
    if (inMapZone(z)) tmpC.multiplyScalar(0.55);
    tmpC.toArray(cols, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
}
const roadMat = new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.26, metalness: 0.2 }); // wet asphalt
function roadStrip(z0, z1, half = 2.75, straightX = null) {
  const rows = Math.ceil(Math.abs(z1 - z0)) + 1, pos = [], idx = [];
  for (let r = 0; r < rows; r++) {
    const z = z0 + (z1 - z0) * (r / (rows - 1)), x = straightX ?? pathX(z);
    pos.push(x - half, groundH(x, z) + 0.02, z, x + half, groundH(x, z) + 0.02, z);
    if (r) idx.push(r * 2 - 2, r * 2, r * 2 - 1, r * 2 - 1, r * 2, r * 2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, roadMat);
}
scene.add(roadStrip(-5, MAP.from + 2), roadStrip(MAP.to - 2, -351.5));
{ // the cross street at the crossroads
  const g = new THREE.PlaneGeometry(140, 5.5).rotateX(-Math.PI / 2).translate(0, 0.025, -60);
  scene.add(new THREE.Mesh(g, roadMat));
}
{ // centre-line dashes
  const zs = [];
  for (let z = -6; z > -351; z -= 4) if (!inMapZone(z) && Math.abs(z + 60) > 4) zs.push(z);
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 1.5).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#8d8778', roughness: 0.6 }), zs.length);
  zs.forEach((z, i) => {
    const a = Math.atan(pathX(z - 0.5) - pathX(z + 0.5));
    m.setMatrixAt(i, tmpM.compose(tmpV.set(pathX(z), groundH(pathX(z), z) + 0.03, z), tmpQ.setFromAxisAngle(UP, -a), tmpS.set(1, 1, 1)));
  });
  scene.add(m);
}

// ---------- 0 · the kitchen ----------
const kitchen = new THREE.Group();
scene.add(kitchen);
const wallMat = new THREE.MeshStandardMaterial({ color: '#4a3e33', roughness: 0.95, side: THREE.DoubleSide });
const woodMat = new THREE.MeshStandardMaterial({ color: '#5c4130', roughness: 0.7 });
const darkMat = new THREE.MeshStandardMaterial({ color: '#1f1b18', roughness: 0.8 });
const box = (w, h, d, x, y, z, mat, parent = kitchen) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2e231c', roughness: 0.8 }));
  floor.position.set(0, 0.012, 0.75);
  kitchen.add(floor);
  // back wall with the window opening (x −1.1..1.1, y 0.95..2.45)
  box(2.4, 3.2, 0.2, -2.3, 1.6, -3, wallMat); box(2.4, 3.2, 0.2, 2.3, 1.6, -3, wallMat);
  box(2.2, 0.95, 0.2, 0, 0.475, -3, wallMat); box(2.2, 0.75, 0.2, 0, 2.825, -3, wallMat);
  box(0.2, 3.2, 7.5, -3.5, 1.6, 0.75, wallMat); box(0.2, 3.2, 7.5, 3.5, 1.6, 0.75, wallMat);
  box(7.2, 0.2, 7.5, 0, 3.25, 0.75, wallMat);
  box(2.5, 0.08, 0.36, 0, 0.92, -2.88, woodMat); // sill
  // table, mug, bills
  box(1.9, 0.06, 1.15, 0.2, 0.76, -0.5, woodMat);
  for (const [x, z] of [[-0.65, -0.97], [1.05, -0.97], [-0.65, -0.03], [1.05, -0.03]]) box(0.07, 0.74, 0.07, x, 0.37, z, woodMat);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 20), new THREE.MeshStandardMaterial({ color: '#7a2430', roughness: 0.5 }));
  mug.position.set(-0.35, 0.84, -0.75);
  kitchen.add(mug);
  const bills = new THREE.MeshStandardMaterial({ color: '#d4cbb8', roughness: 0.9 });
  box(0.32, 0.012, 0.44, -0.38, 0.796, -0.28, bills).rotation.y = 0.35;
  box(0.32, 0.012, 0.44, -0.33, 0.808, -0.3, bills).rotation.y = -0.1;
  // pendant lamp over the table
  box(0.015, 0.75, 0.015, 0.2, 2.78, -0.5, darkMat);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.26, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#2f3e36', roughness: 0.6, side: THREE.DoubleSide }));
  shade.position.set(0.2, 2.3, -0.5);
  kitchen.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0').multiplyScalar(5) }));
  bulb.position.set(0.2, 2.2, -0.5);
  kitchen.add(bulb);
  const lamp = new THREE.PointLight('#ffc78e', 7, 11, 1.6);
  lamp.position.set(0.2, 2.15, -0.5);
  kitchen.add(lamp);
}
// the casement window: two sashes the draught swings open
const sashes = [-1, 1].map((side) => {
  const pivot = new THREE.Group();
  pivot.position.set(side * 1.1, 0.95, -3.05);
  const frame = new THREE.MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.6 });
  const s = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), frame); m.position.set(x, y, 0); pivot.add(m); };
  const dir = -side; // sash extends from its hinge toward the centre
  s(0.06, 1.5, dir * 0.03, 0.75); s(0.06, 1.5, dir * 1.07, 0.75); s(1.1, 0.06, dir * 0.55, 0.03); s(1.1, 0.06, dir * 0.55, 1.47); s(1.1, 0.04, dir * 0.55, 0.75);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshStandardMaterial({ color: '#9fb4c9', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.14, depthWrite: false }));
  glass.position.set(dir * 0.55, 0.75, 0);
  pivot.add(glass);
  kitchen.add(pivot);
  return { pivot, side };
});

// ---------- houses (street and porch lights) ----------
const houses = [];
function addHouse(z, side, porch) {
  const w = rnd(5.5, 7), d = rnd(5.5, 7), h = rnd(3, 4.2);
  const x = pathX(z) + side * ((porch ? rnd(6.2, 7.2) : rnd(8.5, 10.5)) + w / 2);
  houses.push({ x, z, w, d, h, side, porch, on: 0, flick: 0, rh: rnd(1.6, 2.4), lit: [rand() < 0.45, rand() < 0.3] });
}
for (const z of [-13, -25, -37, -48]) { addHouse(z + rnd(-1, 1), -1, false); addHouse(z - 5 + rnd(-1, 1), 1, false); }
for (let z = -114; z > -172; z -= 9.5) { addHouse(z, -1, true); addHouse(z - 4.5, 1, true); }
const HOUSE_COLS = ['#2c2b2f', '#2f2925', '#262a2f', '#302f2a', '#33302d'].map((c) => new THREE.Color(c));
const houseBodies = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), houses.length);
const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#17181c', roughness: 0.85, flatShading: true }), houses.length);
const houseWins = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshBasicMaterial(), houses.length * 2);
const porchBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 10, 6), new THREE.MeshBasicMaterial(), houses.length);
const porchPools = new THREE.InstancedMesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), houses.length);
const WARM = new THREE.Color('#ffc98a'), DARKWIN = new THREE.Color('#0b0d12');
houses.forEach((hs, i) => {
  houseBodies.setMatrixAt(i, tmpM.compose(tmpV.set(hs.x, groundH(hs.x, hs.z) - 0.2, hs.z), tmpQ.identity(), tmpS.set(hs.w, hs.h + 0.2, hs.d)));
  houseBodies.setColorAt(i, pick(HOUSE_COLS));
  roofs.setMatrixAt(i, tmpM.compose(tmpV.set(hs.x, groundH(hs.x, hs.z) + hs.h, hs.z), tmpQ.identity(), tmpS.set(hs.w / 1.06 * 1.08, hs.rh, hs.d / 1.06 * 1.08)));
  const fx = hs.x - hs.side * (hs.w / 2 + 0.01), rot = hs.side > 0 ? -Math.PI / 2 : Math.PI / 2, gy = groundH(hs.x, hs.z);
  tmpQ.setFromAxisAngle(UP, rot);
  for (let k = 0; k < 2; k++) houseWins.setMatrixAt(i * 2 + k, tmpM.compose(tmpV.set(fx, gy + 1.6, hs.z + (k ? 1.6 : -1.6)), tmpQ, tmpS.set(1, 1, 1)));
  hs.bulb = v3(fx - hs.side * 0.25, gy + 2.3, hs.z + 0.1);
  porchBulbs.setMatrixAt(i, tmpM.compose(hs.bulb, tmpQ.identity(), tmpS.set(1, 1, 1)));
  porchPools.setMatrixAt(i, tmpM.compose(tmpV.set(fx - hs.side * 1.6, gy + 0.05, hs.z), tmpQ.identity(), tmpS.set(1, 1, 1)));
  if (hs.porch) {
    hs.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ffbf7a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    hs.sprite.position.copy(hs.bulb);
    hs.sprite.scale.setScalar(3.2);
    scene.add(hs.sprite);
  }
});
scene.add(houseBodies, roofs, houseWins, porchBulbs, porchPools);
function paintHouses() {
  houses.forEach((hs, i) => {
    const k = hs.porch ? hs.on * (reduce ? 1 : smooth(clamp(hs.flick / 0.5)) * (hs.flick < 0.7 && Math.sin(hs.flick * 45) < -0.4 ? 0.35 : 1)) : 0; // flickers on
    for (let j = 0; j < 2; j++) {
      const lit = hs.porch ? hs.on * (j ? 0.7 : 1) : hs.lit[j] ? 0.55 : 0;
      houseWins.setColorAt(i * 2 + j, tmpC.copy(DARKWIN).lerp(WARM, lit).multiplyScalar(1 + lit * 0.6));
    }
    porchBulbs.setColorAt(i, tmpC.copy(DARKWIN).lerp(WARM, k).multiplyScalar(1 + k * 3));
    porchPools.setColorAt(i, tmpC.copy(WARM).multiplyScalar(k * 0.5));
    if (hs.sprite) hs.sprite.material.opacity = k * 0.8;
  });
  houseWins.instanceColor.needsUpdate = true;
  porchBulbs.instanceColor.needsUpdate = true;
  porchPools.instanceColor.needsUpdate = true;
}
paintHouses();

// ---------- 2 · the crossroads signpost ----------
const SIGNS = [
  { t: 'SSDI', s: 'Disability Insurance', dir: 1, yaw: 0.1, y: 3.05 },
  { t: 'SSI', s: 'Supplemental Income', dir: -1, yaw: -0.1, y: 2.62 },
  { t: 'APPEALS', s: 'After a denial', dir: 1, yaw: 0.5, y: 2.19 },
  { t: 'HEARINGS', s: 'Before a judge', dir: -1, yaw: -0.5, y: 1.76 },
];
const signGroup = new THREE.Group();
signGroup.position.copy(SIGN);
scene.add(signGroup);
{
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.5, 10).translate(0, 1.75, 0), darkMat);
  signGroup.add(post);
}
SIGNS.forEach((sg, i) => {
  const tex = canvasTex(512, 116, (g, w, h) => {
    const tip = 46, r = sg.dir > 0;
    g.beginPath();
    if (r) { g.moveTo(4, 6); g.lineTo(w - tip, 6); g.lineTo(w - 4, h / 2); g.lineTo(w - tip, h - 6); g.lineTo(4, h - 6); }
    else { g.moveTo(w - 4, 6); g.lineTo(tip, 6); g.lineTo(4, h / 2); g.lineTo(tip, h - 6); g.lineTo(w - 4, h - 6); }
    g.closePath();
    g.fillStyle = '#ece5d6'; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#2a2a2e'; g.stroke();
    g.fillStyle = '#1d2026';
    g.font = `700 50px ${SANS}`;
    g.textBaseline = 'middle';
    const x0 = r ? 28 : tip + 22, tw = g.measureText(sg.t).width;
    g.fillText(sg.t, x0, h / 2 - 2);
    g.font = `500 22px ${SANS}`;
    g.fillStyle = '#4a4d55';
    g.fillText(sg.s, x0 + tw + 16, h / 2 + 2);
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#000000', transparent: true, alphaTest: 0.5, roughness: 0.7, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.43).translate(sg.dir * 0.95, 0, 0), mat);
  const pivot = new THREE.Group();
  pivot.position.y = sg.y;
  pivot.add(mesh);
  signGroup.add(pivot);
  mesh.userData = { kind: 'sign', i };
  Object.assign(sg, { mesh, pivot, swing: 0, hov: 0 });
});

// ---------- 3 · the firm's offices and the hearing office ----------
const offices = new THREE.Group();
scene.add(offices);
{
  const brick = new THREE.MeshStandardMaterial({ color: '#2f2622', roughness: 0.9 });
  const stone = new THREE.MeshStandardMaterial({ color: '#363a42', roughness: 0.85 });
  const fw = 9, hw = 12;
  box(fw, FIRM.h, FIRM.z0 - FIRM.z1, FIRM.x + fw / 2, FIRM.h / 2, (FIRM.z0 + FIRM.z1) / 2, brick, offices);
  box(0.4, 0.5, FIRM.z0 - FIRM.z1 + 0.4, FIRM.x + 0.1, FIRM.h + 0.2, (FIRM.z0 + FIRM.z1) / 2, darkMat, offices); // cornice
  box(hw, HEAR.h, HEAR.z0 - HEAR.z1, HEAR.x - hw / 2, HEAR.h / 2, (HEAR.z0 + HEAR.z1) / 2, stone, offices);
  // ordinary windows: instanced, some lit
  const wins = [];
  for (const z of [-96.5, -99.6, -102.7, -105.8, -108.6]) for (const y of [1.9, 7.4]) wins.push({ x: FIRM.x - 0.01, z, y, f: 1, lit: rand() < 0.6 });
  for (const z of [-100, -102.6, -105.2, -107.8, -110.4, -113]) for (const y of [1.8, 4.2, 6.4]) wins.push({ x: HEAR.x + 0.01, z, y, f: -1, lit: rand() < 0.22, cold: true });
  const wm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshBasicMaterial(), wins.length);
  wins.forEach((w, i) => {
    wm.setMatrixAt(i, tmpM.compose(tmpV.set(w.x, w.y, w.z), tmpQ.setFromAxisAngle(UP, w.f > 0 ? -Math.PI / 2 : Math.PI / 2), tmpS.set(1, 1, 1)));
    wm.setColorAt(i, w.lit ? tmpC.set(w.cold ? '#8fa3c7' : '#ffcf91').multiplyScalar(w.cold ? 0.45 : 0.7) : tmpC.copy(DARKWIN));
  });
  offices.add(wm);
  const plaque = (text, sub, x, y, z, f, wpx = 640) => {
    const t = canvasTex(wpx, 150, (g, w, h) => {
      g.fillStyle = '#e9e1d0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8a6526'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#1d2026'; g.textAlign = 'center';
      g.font = `500 54px ${SERIF}`; g.fillText(text, w / 2, 76);
      g.font = `600 22px ${SANS}`; g.fillStyle = '#4a4d55'; g.fillText(sub, w / 2, 118);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wpx / 200, 0.75), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    m.position.set(x, y, z);
    m.rotation.y = f > 0 ? -Math.PI / 2 : Math.PI / 2;
    offices.add(m);
  };
  plaque('Ashgrove & Penn', 'DISABILITY LAW · SECOND FLOOR', FIRM.x - 0.02, 3.0, -97.2, 1);
  plaque('Hearing Office', 'DISABILITY HEARINGS', HEAR.x + 0.02, 3.0, -99.5, -1, 560);
  const lobby = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0').multiplyScalar(0.9) }));
  lobby.position.set(FIRM.x - 0.02, 1.2, -100.3);
  lobby.rotation.y = -Math.PI / 2;
  offices.add(lobby);
}
// the attorneys' windows: lit early, each with someone at work
const ATTORNEY_WINS = [-99.6, -102.7, -105.8].map((z, i) => {
  const tex = canvasTex(256, 320, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#ffdcaa'); bg.addColorStop(1, '#c78550');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,55,30,0.45)'; // shelves
    for (let k = 0; k < 4; k++) g.fillRect(i === 1 ? 20 : 140, 40 + k * 46, 96, 8);
    g.fillStyle = 'rgba(110,60,30,0.35)';
    for (let k = 0; k < 14; k++) g.fillRect((i === 1 ? 22 : 142) + (k % 7) * 13, 16 + ((k / 7) | 0) * 46, 9, 24);
    g.fillStyle = '#3b2519'; // the person
    const cx = [92, 160, 110][i], cy = [150, 160, 140][i];
    g.beginPath(); g.arc(cx, cy, 30, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx, cy + 105, 64, 70, 0, Math.PI, 0); g.fill();
    g.fillRect(cx - 64, cy + 105, 128, 80);
    g.fillStyle = '#2a1a12'; g.fillRect(0, h - 70, w, 70); // desk
    g.fillStyle = '#fff0c8'; // desk lamp
    g.beginPath(); g.arc([200, 50, 190][i], h - 96, 18, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(30,20,14,0.9)'; // window bars
    g.fillRect(w / 2 - 4, 0, 8, h); g.fillRect(0, h / 2 - 4, w, 8);
    g.strokeStyle = 'rgba(30,20,14,0.95)'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1), mat);
  m.position.set(FIRM.x - 0.02, 4.65, z);
  m.rotation.y = -Math.PI / 2;
  m.userData = { kind: 'attorney', i };
  offices.add(m);
  return { mesh: m, mat, hov: 0 };
});

// ---------- street lamps ----------
const lamps = [];
for (let z = -9, k = 0; z > -340; z -= 12.5, k++) {
  if (inMapZone(z) || (z < -200 && z > -305)) continue;
  const side = k % 2 ? 1 : -1;
  lamps.push({ x: pathX(z) + side * 3.5, z, side });
}
const LAMP_COL = new THREE.Color('#ffd9a0');
const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 4.3, 8).translate(0, 2.15, 0), darkMat, lamps.length);
const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.06, 0.06).translate(-0.45, 0, 0), darkMat, lamps.length);
const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.1, 0.24), new THREE.MeshBasicMaterial(), lamps.length);
const lampPools = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), lamps.length);
lamps.forEach((l, i) => {
  const y = groundH(l.x, l.z);
  poles.setMatrixAt(i, tmpM.compose(tmpV.set(l.x, y, l.z), tmpQ.identity(), tmpS.set(1, 1, 1)));
  tmpQ.setFromAxisAngle(UP, l.side > 0 ? 0 : Math.PI);
  arms.setMatrixAt(i, tmpM.compose(tmpV.set(l.x, y + 4.25, l.z), tmpQ, tmpS.set(1, 1, 1)));
  l.head = v3(l.x - l.side * 0.85, y + 4.18, l.z);
  heads.setMatrixAt(i, tmpM.compose(l.head, tmpQ.identity(), tmpS.set(1, 1, 1)));
  lampPools.setMatrixAt(i, tmpM.compose(tmpV.set(l.head.x, y + 0.04, l.z), tmpQ.identity(), tmpS.set(1, 1, 1)));
  l.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ffcf8f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  l.sprite.position.copy(l.head).y -= 0.05;
  l.sprite.scale.setScalar(2.6);
  scene.add(l.sprite);
});
scene.add(poles, arms, heads, lampPools);
const lampLights = Array.from({ length: low ? 3 : 5 }, () => { const p = new THREE.PointLight('#ffc98a', 0, 16, 1.5); scene.add(p); return p; });
function paintLamps(on) {
  lamps.forEach((l, i) => {
    heads.setColorAt(i, tmpC.copy(LAMP_COL).multiplyScalar(0.15 + on * 3.2));
    lampPools.setColorAt(i, tmpC.copy(LAMP_COL).multiplyScalar(on * 0.32));
    l.sprite.material.opacity = on * 0.75;
  });
  heads.instanceColor.needsUpdate = true;
  lampPools.instanceColor.needsUpdate = true;
}
paintLamps(1);

// ---------- trees ----------
{
  const spots = [];
  const blocked = (x, z) => houses.some((h) => Math.abs(x - h.x) < h.w / 2 + 2 && Math.abs(z - h.z) < h.d / 2 + 2)
    || (x > FIRM.x - 1 && x < FIRM.x + 11 && z < FIRM.z0 + 2 && z > FIRM.z1 - 2)
    || (x < HEAR.x + 1 && x > HEAR.x - 14 && z < HEAR.z0 + 2 && z > HEAR.z1 - 2)
    || (Math.abs(z + 60) < 4.5) || (z < -108 && z > -178 && Math.abs(x - pathX(z)) < 24) || (Math.abs(x) < 10 && z < -342) || inMapZone(z) || z > -6;
  for (let k = 0; spots.length < (low ? 170 : 320) && k < 9000; k++) {
    const z = rnd(-350, -8), side = rand() < 0.5 ? -1 : 1;
    const x = pathX(z) + side * (6.5 + Math.abs(gauss()) * 30);
    if (Math.abs(x) > 80 || blocked(x, z)) continue;
    spots.push([x, z]);
  }
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), spots.length);
  spots.forEach(([x, z], i) => {
    const h = rnd(4, 9), r = h * rnd(0.22, 0.32);
    mesh.setMatrixAt(i, tmpM.compose(tmpV.set(x, groundH(x, z) - 0.3, z), tmpQ.setFromAxisAngle(UP, rnd(0, TAU)), tmpS.set(r, h, r)));
    mesh.setColorAt(i, tmpC.set(pick(['#0f1d16', '#13241a', '#0c1813', '#182a1e'])));
  });
  scene.add(mesh);
}

// ---------- mist (crossroads) ----------
const mist = [];
for (let i = 0; i < (low ? 10 : 18); i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#a9b4cc', transparent: true, depthWrite: false, opacity: 0.1 }));
  const z = rnd(-78, -42);
  s.position.set(pathX(z) + rnd(-16, 16), rnd(0.6, 2.4), z);
  s.scale.set(rnd(16, 28), rnd(5, 9), 1);
  s.userData = { x: s.position.x, ph: rnd(0, TAU) };
  mist.push(s);
  scene.add(s);
}

// ---------- rain (night only), wrapped in a box that follows the camera ----------
const rainU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 1 }, uCol: { value: new THREE.Color('#9fb1cc') } };
{
  const n = low ? 900 : 1800, off = new Float32Array(n * 6), end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = [rand(), rand(), rand()];
    off.set([...a, ...a], i * 6);
    end[i * 2] = 0; end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(off, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec3 uCam; attribute float aEnd; varying float vA;
      void main() {
        vec3 box = vec3(28.0, 12.0, 30.0);
        vec3 p;
        p.x = uCam.x + (fract(position.x - uCam.x / box.x) - 0.5) * box.x;
        p.z = uCam.z - 4.0 + (fract(position.z - uCam.z / box.z) - 0.5) * box.z;
        p.y = uCam.y - 5.0 + fract(position.y - uTime * 0.9) * box.y;
        p.y -= aEnd * 0.42; p.x += aEnd * 0.05;
        bool indoors = abs(p.x) < 3.6 && p.z > -3.1 && p.z < 4.6 && p.y < 3.4;
        vA = indoors ? 0.0 : (0.35 + 0.65 * aEnd);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uAmount; uniform vec3 uCol; varying float vA;
      void main() { if (vA <= 0.0) discard; gl_FragColor = vec4(uCol, vA * 0.38 * uAmount); }`,
  }));
  rain.frustumCulled = false;
  scene.add(rain);
}

// ---------- 5 · the map of lights ----------
const mapGroup = new THREE.Group();
scene.add(mapGroup);
const mapU = { uTime: { value: 0 }, uReveal: { value: 0 }, uPx: { value: DPR * innerHeight / 900 }, uDim: { value: 1 } };
{
  const METROS = [[-74, 40.7], [-118.2, 34], [-87.6, 41.9], [-95.4, 29.8], [-112, 33.4], [-75.2, 40], [-98.5, 29.4], [-117.2, 32.7],
    [-96.8, 32.8], [-80.2, 25.8], [-84.4, 33.75], [-122.3, 47.6], [-105, 39.7], [-71, 42.4], [-83, 42.3], [-93.3, 45], [-90.2, 38.6],
    [-82.46, 27.95], [-80.84, 35.23], [-86.8, 36.2], [-94.6, 39.1], [-111.9, 40.8], [-122.7, 45.5], [-122.4, 37.8], [-115.1, 36.2],
    [-90.1, 30], [-77, 38.9], [-81.4, 28.5], [-86.2, 39.8], [-82.99, 39.96], [-97.5, 35.5], [-106.6, 35.1], [-79.9, 40.4]];
  const n = low ? 1500 : 3000, pos = [], seeds = [], dist = [], cols = [];
  const offXY = OFFICES.map((o) => mapXY(o.lon, o.lat));
  while (seeds.length < n) {
    let lon, lat;
    if (rand() < 0.45) { const m = pick(METROS); lon = m[0] + gauss() * 0.9; lat = m[1] + gauss() * 0.7; }
    else { lon = rnd(-125, -67); lat = rnd(25, 49.2); }
    if (!inOutline(lon, lat)) continue;
    const [x, z] = mapXY(lon, lat);
    pos.push(x, MAP.y, z);
    seeds.push(rand());
    dist.push(Math.min(...offXY.map(([ox, oz]) => Math.hypot(x - ox, z - oz))));
    (rand() < 0.8 ? tmpC.set('#ffcc85') : tmpC.set('#dfe8ff')).toArray(cols, cols.length);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(cols, 3));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: mapU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uReveal, uPx, uDim; attribute float aSeed, aDist; attribute vec3 aCol;
      varying vec3 vCol; varying float vA;
      void main() {
        vCol = aCol;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float spread = uReveal * 150.0; // the lights spread out from the firm's offices
        float on = smoothstep(aDist - 6.0, aDist, spread);
        float tw = 0.75 + 0.25 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 40.0);
        vA = on * tw * uDim;
        gl_PointSize = clamp(uPx * (0.6 + aSeed) * 300.0 / -mv.z, 1.6, 9.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vCol * a * 1.8 * vA, a * vA); }`,
  }));
  pts.frustumCulled = false;
  mapGroup.add(pts);
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(OUTLINE.map(([lo, la]) => { const [x, z] = mapXY(lo, la); return v3(x, MAP.y, z); })),
    new THREE.LineBasicMaterial({ color: '#c99a4e', transparent: true, opacity: 0, fog: false, depthWrite: false }));
  mapGroup.add(line);
  mapGroup.userData.line = line;
}
const officeMarks = OFFICES.map((o) => {
  const [x, z] = mapXY(o.lon, o.lat);
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide };
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 18, 12, 1, true).translate(0, 9, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(2), opacity: 0, ...add }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.05, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(2), opacity: 0, ...add }));
  beam.position.set(x, MAP.y, z);
  ring.position.set(x, MAP.y + 0.05, z);
  mapGroup.add(beam, ring);
  return { beam, ring, x, z, boost: 0 };
});
const stateMark = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0d0').multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
mapGroup.add(stateMark);
let thread = null, threadT = 0, chosenOffice = -1;
on('state', ({ code }) => {
  if (thread) { mapGroup.remove(thread); thread.geometry.dispose(); thread = null; }
  chosenOffice = -1;
  const st = code && STATES[code];
  if (!st || st[1] == null) { stateMark.userData.on = false; return; }
  const [sx, sz] = mapXY(st[1], st[2]);
  stateMark.position.set(sx, MAP.y + 0.08, sz);
  stateMark.userData.on = true;
  stateMark.userData.t = 0;
  // the golden thread from your state to the office that serves it (or the nearest one)
  const oi = SERVED[code] ?? officeMarks.map((o, i) => [Math.hypot(o.x - sx, o.z - sz), i]).sort((a, b) => a[0] - b[0])[0][1];
  chosenOffice = oi;
  const o = officeMarks[oi], len = Math.hypot(o.x - sx, o.z - sz);
  if (len < 1) return;
  const curve = new THREE.QuadraticBezierCurve3(v3(sx, MAP.y, sz), v3((sx + o.x) / 2, MAP.y + Math.max(3, len * 0.35), (sz + o.z) / 2), v3(o.x, MAP.y, o.z));
  thread = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.12, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(2.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  thread.geometry.setDrawRange(0, 0);
  threadT = 0;
  mapGroup.add(thread);
});

// ---------- 6 · the firm's door at sunrise ----------
const doorGroup = new THREE.Group();
doorGroup.position.copy(DOOR);
scene.add(doorGroup);
let doorPivot, doorLight, doorGlowMat;
{
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#57493e', roughness: 0.9 });
  const trim = new THREE.MeshStandardMaterial({ color: '#d8cfbf', roughness: 0.7 });
  // facade around the door opening (x −0.85..0.85, y 0..2.7), depth 10 behind
  box(5.15, 5.2, 10, -3.425, 2.6, -5, stoneMat, doorGroup); box(5.15, 5.2, 10, 3.425, 2.6, -5, stoneMat, doorGroup);
  box(1.7, 2.5, 10, 0, 3.95, -5, stoneMat, doorGroup);
  box(2.3, 0.18, 0.3, 0, 2.8, 0.1, trim, doorGroup); box(0.18, 2.8, 0.3, -1.06, 1.4, 0.1, trim, doorGroup); box(0.18, 2.8, 0.3, 1.06, 1.4, 0.1, trim, doorGroup);
  box(3.2, 0.16, 1.2, 0, 0.08, 0.6, trim, doorGroup); box(2.6, 0.16, 0.8, 0, 0.24, 0.35, trim, doorGroup); // steps
  box(12.4, 0.3, 0.4, 0, 5.3, 0.05, trim, doorGroup); // cornice
  doorGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a8').multiplyScalar(1.3) });
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.7), doorGlowMat);
  inside.position.set(0, 1.35, -0.6);
  doorGroup.add(inside);
  box(1.7, 0.02, 0.6, 0, 0.01, -0.3, new THREE.MeshStandardMaterial({ color: '#6a5444' }), doorGroup); // threshold
  doorPivot = new THREE.Group();
  doorPivot.position.set(-0.85, 0, -0.05);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.7, 0.08).translate(0.85, 1.35, 0), new THREE.MeshStandardMaterial({ color: '#2f4038', roughness: 0.55 }));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: '#c9a063', metalness: 0.8, roughness: 0.3 }));
  knob.position.set(1.5, 1.25, 0.07);
  doorPivot.add(panel, knob);
  doorGroup.add(doorPivot);
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd09a').multiplyScalar(0.8) });
  for (const x of [-4.4, -2.5, 2.5, 4.4]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), winMat); w.position.set(x, 1.7, 0.01); doorGroup.add(w); }
  for (const x of [-4.4, -2.2, 0, 2.2, 4.4]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), winMat); w.position.set(x, 4.3, 0.01); doorGroup.add(w); }
  const sign = canvasTex(1024, 150, (g, w, h) => {
    g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2026'; g.textAlign = 'center';
    g.font = `400 78px ${SERIF}`; g.fillText('Ashgrove & Penn', w / 2, 88);
    g.font = `600 24px ${SANS}`; g.fillStyle = '#8a6526'; g.fillText('S O C I A L   S E C U R I T Y   D I S A B I L I T Y   L A W', w / 2, 130);
  });
  const signM = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.68), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.6 }));
  signM.position.set(0, 3.2, 0.27);
  doorGroup.add(signM);
  for (const x of [-1.5, 1.5]) {
    box(0.16, 0.3, 0.16, x, 2.3, 0.18, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.5) }), doorGroup);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ffcf8f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    s.position.set(x, 2.3, 0.3);
    s.scale.setScalar(1.6);
    doorGroup.add(s);
  }
  doorLight = new THREE.PointLight('#ffcf9a', 3, 14, 1.6);
  doorLight.position.set(0, 1.6, 1.2);
  doorGroup.add(doorLight);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: GLOW, color: new THREE.Color('#ffcf9a').multiplyScalar(0.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  spill.position.set(0, 0.06, 2.2);
  doorGroup.add(spill);
}

// ---------- the letter ----------
const letter = createLetter();
scene.add(letter.group);
const TABLE_POS = v3(0.32, 0.795, -0.42);
const TABLE_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.22, 'XYZ'));
const DOOR_IN = v3(0, 1.4, DOOR.z - 0.8);

// ---------- post-processing ----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: low ? 0 : 4 }));
composer.setPixelRatio(DPR);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 0.32);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- events from the page ----------
let htmlSign = -1, htmlAtt = -1, sealedAt = -1;
on('sign', ({ i, on: v }) => { htmlSign = v ? i : (htmlSign === i ? -1 : htmlSign); if (v) SIGNS[i].swing = Math.max(SIGNS[i].swing, 0.5); });
on('attorney', ({ i, on: v }) => { htmlAtt = v ? i : (htmlAtt === i ? -1 : htmlAtt); });
on('flip', ({ on: v }) => letter.setFlip(v));
on('submit', () => { letter.send(reduce); sealedAt = time; });
on('reset', () => { letter.reset(); letter.group.visible = true; sealedAt = -1; });

// ---------- pointer: parallax, hover, click and drag-to-look ----------
const ptr = { nx: 0, ny: 0, sx: 0, sy: 0, x: -1, y: -1, mouse: false };
const look = { yaw: 0, pitch: 0, drag: null };
const NOT_WORLD = 'a, button, input, select, textarea, label, .panel, .topbar, .road, .callbar, .foot, .gl-status, form';
addEventListener('pointermove', (e) => {
  ptr.nx = (e.clientX / innerWidth) * 2 - 1;
  ptr.ny = -((e.clientY / innerHeight) * 2 - 1);
  ptr.x = e.clientX; ptr.y = e.clientY;
  ptr.mouse = e.pointerType === 'mouse' && !e.target.closest(NOT_WORLD);
  const d = look.drag;
  if (d && d.id === e.pointerId) {
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    if (d.moved > 6) {
      look.yaw = clamp(d.yaw - dx * 0.0035, -0.7, 0.7);
      look.pitch = clamp(d.pitch + dy * 0.0025, -0.3, 0.3);
    }
  }
}, { passive: true });
addEventListener('pointerdown', (e) => {
  if (e.button > 0 || e.target.closest(NOT_WORLD)) return;
  look.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch, moved: 0, t: performance.now() };
});
function endDrag(e, cancelled) {
  const d = look.drag;
  if (!d || d.id !== e.pointerId) return;
  look.drag = null;
  if (cancelled || d.moved >= 6 || performance.now() - d.t > 500) return;
  const hit = pickAt(e.clientX, e.clientY); // a tap
  if (!hit) return;
  if (hit.kind === 'letter') emit('pick-letter');
  if (hit.kind === 'sign') { emit('pick-sign', { i: hit.i }); SIGNS[hit.i].swing = 1; }
  if (hit.kind === 'attorney') emit('pick-attorney', { i: hit.i });
}
addEventListener('pointerup', (e) => endDrag(e, false));
addEventListener('pointercancel', (e) => endDrag(e, true));
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { ptr.mouse = false; ptr.nx = ptr.ny = 0; } });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(x, y) {
  const t = state.sceneT, targets = [];
  if (t < 0.45 && letter.group.visible) targets.push(letter.sheet);
  if (Math.abs(t - 2) < 0.6) SIGNS.forEach((s) => targets.push(s.mesh));
  if (Math.abs(t - 3) < 0.6) ATTORNEY_WINS.forEach((a) => targets.push(a.mesh));
  if (!targets.length) return null;
  ray.setFromCamera(ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const hit = ray.intersectObjects(targets, false)[0];
  if (!hit) return null;
  return hit.object === letter.sheet ? { kind: 'letter' } : hit.object.userData;
}

addEventListener('resize', () => {
  const was = phone;
  phone = innerWidth < 760;
  if (phone !== was) buildCurves();
  camera.fov = phone ? 62 : 46;
  camera.aspect = innerWidth / innerHeight;
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  mapU.uPx.value = DPR * innerHeight / 900;
});

// ---------- per frame ----------
const LETTER_WIDE = [[0.36, -0.05, 0.7], [0.36, -0.05, 0.7], [0.56, 0.46, 0.36], [0.56, 0.46, 0.36], [0.56, 0.46, 0.36], [0.66, 0.6, 0.28], [-0.4, 0.45, 0.36]];
const LETTER_PHONE = [[0, 0.3, 0.62], [0, 0.3, 0.62], [0.6, 0.46, 0.3], [0.6, 0.46, 0.3], [0.6, 0.46, 0.3], [0.62, 0.48, 0.26], [0, 0.66, 0.45]];
const OFF_WIDE = [[-0.2, 0.03], [-0.14, 0], [-0.17, 0], [-0.16, 0], [-0.15, 0], [-0.13, 0], [0.18, 0]];
const OFF_PHONE = [[0, 0.3], [0, 0.17], [0, 0.18], [0, 0.18], [0, 0.17], [0, 0.2], [0, 0.22]];
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), camUp = new THREE.Vector3();
const sunDir = new THREE.Vector3();
let prog = state.target, lastProg = prog, time = 0, then = performance.now(), dayK = 0, hoverKind = '', hoverI = -1, started = false;

function curveT(u) {
  const k = Math.min(Math.floor(u), LAST - 1), f = smooth(clamp(u - k));
  return lerp(stationT[k], stationT[k + 1], f);
}

function updateCamera(dt) {
  const t = curveT(prog);
  posCurve.getPoint(t, camPos);
  lookCurve.getPoint(t, camLook);
  if (!reduce) {
    ptr.sx += ((ptr.mouse ? ptr.nx : 0) - ptr.sx) * damp(2, dt);
    ptr.sy += ((ptr.mouse ? ptr.ny : 0) - ptr.sy) * damp(2, dt);
  }
  if (!look.drag) { look.yaw *= Math.exp(-dt * 1.6); look.pitch *= Math.exp(-dt * 1.6); } // springs back
  fwd.subVectors(camLook, camPos);
  const dist = fwd.length();
  fwd.normalize();
  right.crossVectors(fwd, UP).normalize();
  const indoor = prog < 0.5 ? 0.35 : 1; // small moves inside the kitchen
  camPos.addScaledVector(right, ptr.sx * 0.4 * indoor).addScaledVector(UP, ptr.sy * 0.2 * indoor + (reduce ? 0 : Math.sin(time * 0.6) * 0.025));
  // drag to look around: turn the look-at point around the camera
  tmpV.subVectors(camLook, camPos).applyAxisAngle(UP, look.yaw);
  tmpV.applyAxisAngle(right, look.pitch);
  camLook.copy(camPos).add(tmpV.setLength(dist));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  const OFF = phone ? OFF_PHONE : OFF_WIDE, a = Math.min(Math.floor(prog), LAST - 1), f = smooth(clamp(prog - a));
  camera.setViewOffset(innerWidth, innerHeight,
    lerp(OFF[a][0], OFF[a + 1][0], f) * innerWidth, lerp(OFF[a][1], OFF[a + 1][1], f) * innerHeight, innerWidth, innerHeight);
  camera.updateMatrixWorld();
  skyGroup.position.copy(camera.position);
}

function updateLetter(dt, speed) {
  const b = smooth(clamp((prog - 0.06) / 0.8)); // leaves the table and follows you
  camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const cf = tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion);
  // where the letter rides on screen at each beat: R/U in half-widths/heights of the view, S its scale
  const lay = phone ? LETTER_PHONE : LETTER_WIDE, la = Math.min(Math.floor(prog), LAST - 1), lf = smooth(clamp(prog - la));
  const L0 = lay[la], L1 = lay[la + 1];
  const F = phone ? 2.9 : 2.8, halfH = F * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * camera.aspect;
  const R = lerp(L0[0], L1[0], lf) * halfW, U = lerp(L0[1], L1[1], lf) * halfH, S = lerp(L0[2], L1[2], lf);
  const comp = new THREE.Vector3().copy(camera.position).addScaledVector(right, R).addScaledVector(camUp, U).addScaledVector(cf, F);
  const wob = reduce ? 0 : 1;
  const compQ = camera.quaternion.clone().multiply(tmpQ.setFromEuler(tmpE.set(
    -0.12 + wob * Math.sin(time * 1.3) * 0.06, (phone ? 0 : -0.42 * Math.sign(R || 1)) + wob * Math.sin(time * 0.9) * 0.08, 0.08 + wob * Math.sin(time * 1.1) * 0.05)));
  const pos = new THREE.Vector3().copy(TABLE_POS).lerp(comp, b);
  pos.y += Math.sin(b * Math.PI) * 0.45;
  letter.group.quaternion.copy(TABLE_Q).slerp(compQ, b);
  letter.group.scale.setScalar(lerp(1, S, b));
  const flutter = b < 0.05 ? 0 : 0.05 + Math.min(0.22, speed * 0.5) + (b > 0.05 && b < 0.95 ? 0.18 : 0);
  const fly = letter.update(dt, time, { flutter, reduce, lift: b < 0.05 && letter.state.glow ? 0.03 : 0 });
  if (fly > 0) {
    const k = smooth(fly);
    pos.lerp(DOOR_IN, k);
    letter.group.scale.multiplyScalar(1 - 0.75 * k);
    if (fly >= 1) letter.group.visible = false;
  }
  letter.group.position.copy(pos);
  letter.uniforms.uKey.value.copy(prog < 0.6 ? tmpC.set('#ffc78e') : sky.sun).lerp(tmpC.set('#ffd9b0'), clamp(prog * 0.4)).multiplyScalar(0.5 + sky.sunI * 0.12);
  letter.uniforms.uAmb.value.copy(sky.hemiS).multiplyScalar(0.25 + sky.hemi * 0.22);
}

function frame(now) {
  const dt = Math.min((now - then) / 1000, 0.05);
  then = now;
  time += reduce ? dt * 0.3 : dt;
  prog += (state.target - prog) * (reduce ? 1 : damp(2.4, dt));
  const speed = Math.abs(prog - lastProg) / Math.max(dt, 1e-3);
  lastProg = prog;
  dayK += (state.day - dayK) * damp(reduce ? 20 : 0.9, dt);

  updateCamera(dt);

  // light and weather
  const dawn = dawnAt(prog);
  skyAt(dawn + dayK * 0.35);
  skyU.uTop.value.copy(sky.top);
  skyU.uHor.value.copy(sky.hor);
  skyU.uSunCol.value.copy(sky.sun);
  sunDir.set(-0.06, lerp(-0.1, 0.2, smooth(dawn)) + dayK * 0.1, -1).normalize(); // rises over the firm's roof
  skyU.uSunDir.value.copy(sunDir);
  sunGlow.position.copy(sunDir).multiplyScalar(440);
  sunGlow.material.opacity = clamp((dawn - 0.6) * 2.5) * 0.55 + dayK * 0.15;
  stars.material.opacity = clamp(1 - (dawn + dayK) * 1.5);
  scene.fog.color.copy(sky.fog);
  scene.background.copy(sky.fog);
  const fa = Math.min(Math.floor(prog), LAST - 1);
  scene.fog.density = lerp(FOG_D[fa], FOG_D[fa + 1], smooth(clamp(prog - fa))) * (1 - dayK * 0.4);
  hemi.color.copy(sky.hemiS); hemi.groundColor.copy(sky.hemiG); hemi.intensity = sky.hemi;
  sunLight.color.copy(sky.sun); sunLight.intensity = sky.sunI;
  sunLight.position.copy(camera.position).addScaledVector(sunDir, 120);
  sunLight.target.position.copy(camera.position);
  moonLight.intensity = sky.moon;
  renderer.toneMappingExposure = sky.exp;
  bloom.threshold = lerp(0.32, 0.9, smooth(clamp(dawn + dayK * 0.5)));
  bloom.strength = lerp(0.5, 0.32, smooth(clamp(dawn + dayK * 0.5)));
  rainU.uTime.value = time;
  rainU.uCam.value.copy(camera.position);
  rainU.uAmount.value = reduce ? 0 : 1 - smooth(clamp((prog - 2.2) / 1.3));
  rainU.uCol.value.copy(sky.hemiS).lerp(tmpC.set('#c8d4ea'), 0.5);
  for (const s of mist) {
    s.position.x = s.userData.x + (reduce ? 0 : Math.sin(time * 0.05 + s.userData.ph) * 3);
    s.material.color.copy(sky.fog).lerp(tmpC.set('#c5cde0'), 0.35);
    s.material.opacity = 0.1 * (1 - smooth(clamp((prog - 2.6) / 1.5)));
  }

  // street lamps: nearest few cast real light; all switch off after sunrise
  const lampOn = 1 - smooth(clamp((dawn + dayK * 0.5 - 0.9) / 0.15));
  paintLamps(lampOn);
  const ahead = tmpV.copy(camera.position).addScaledVector(fwd, 9);
  const near = lamps.map((l) => [l.head.distanceToSquared(ahead), l]).sort((a, b) => a[0] - b[0]);
  lampLights.forEach((p, i) => { p.position.copy(near[i][1].head); p.intensity = 9 * lampOn; });

  // window and door
  const wo = reduce ? (prog > 0.05 ? 1 : 0) : smooth(clamp(prog / 0.4));
  for (const s of sashes) s.pivot.rotation.y = -s.side * wo * 1.45; // both sashes swing outward
  doorPivot.rotation.y = smooth(clamp((prog - 5.2) / 0.75)) * 1.35;
  doorGlowMat.color.set('#ffd9a8').multiplyScalar(1.3 + dayK * 1.2);
  doorLight.intensity = 3 + dayK * 3;

  // porch lights come on as you pass
  if (prog > 3.4 && prog < 5.3) {
    const reach = camera.position.z - 6 - 34 * smooth(clamp((prog - 3.3) / 0.7)); // lights come on from near to far as you arrive
    for (const hs of houses) if (hs.porch && hs.on === 0 && hs.z > reach) { hs.on = 1; hs.flick = 0; }
  }
  for (const hs of houses) if (hs.porch && hs.on) hs.flick += dt;
  paintHouses();

  // the signpost: swings when you pass and when you point at it
  const hit = ptr.mouse && !look.drag ? pickAt(ptr.x, ptr.y) : null;
  const hk = hit?.kind || '', hi = hit?.i ?? -1;
  if (hk !== hoverKind || hi !== hoverI) {
    if (hoverKind === 'sign') emit('sign-3d', { i: -1 });
    if (hoverKind === 'attorney') emit('attorney-3d', { i: -1 });
    hoverKind = hk; hoverI = hi;
    if (hk === 'sign') { emit('sign-3d', { i: hi }); SIGNS[hi].swing = Math.max(SIGNS[hi].swing, 0.6); }
    if (hk === 'attorney') emit('attorney-3d', { i: hi });
    document.body.style.cursor = hk ? 'pointer' : '';
  }
  letter.state.glow = hk === 'letter';
  const passing = Math.abs(prog - 2) < 1 ? speed * 0.25 : 0;
  SIGNS.forEach((s, i) => {
    s.swing = Math.min(1, s.swing + passing * dt * 3);
    s.swing *= Math.exp(-dt * 0.9);
    const lit = (hk === 'sign' && hi === i) || htmlSign === i;
    s.hov += ((lit ? 1 : 0) - s.hov) * damp(8, dt);
    s.pivot.rotation.y = s.yaw + (reduce ? 0 : Math.sin(time * 2.3 + i * 1.7) * 0.22 * s.swing);
    s.mesh.material.emissive.setRGB(0.55, 0.42, 0.22).multiplyScalar(s.hov * 0.9);
  });
  ATTORNEY_WINS.forEach((a, i) => {
    const lit = (hk === 'attorney' && hi === i) || htmlAtt === i;
    a.hov += ((lit ? 1 : 0) - a.hov) * damp(7, dt);
    a.mat.color.setScalar(0.72 + a.hov * 0.8);
  });

  // the map of lights
  mapGroup.visible = prog > 3.6;
  if (mapGroup.visible) {
    const rev = smooth(clamp((prog - 4.25) / 0.75));
    mapU.uTime.value = time;
    mapU.uReveal.value = reduce ? (rev > 0 ? 1 : 0) : rev;
    mapU.uDim.value = 1 - 0.35 * dawn;
    mapGroup.userData.line.material.opacity = rev * 0.55;
    officeMarks.forEach((o, i) => {
      o.boost += ((chosenOffice === i ? 1 : 0) - o.boost) * damp(4, dt);
      const pulse = reduce ? 1 : 0.75 + 0.25 * Math.sin(time * 2.2 + i);
      o.beam.material.opacity = rev * (0.22 + 0.4 * o.boost) * pulse;
      o.ring.material.opacity = rev * (0.6 + 0.4 * o.boost);
      o.ring.scale.setScalar(1 + o.boost * 0.5 + (reduce ? 0 : 0.08 * Math.sin(time * 3 + i)));
    });
    const sm = stateMark.userData;
    if (sm.on) sm.t += dt;
    stateMark.material.opacity = sm.on ? rev * 0.9 : 0;
    stateMark.scale.setScalar(sm.on ? 1 + (reduce ? 0 : 0.12 * Math.sin(sm.t * 3)) : 1);
    if (thread) {
      threadT = reduce ? 1 : Math.min(1, threadT + dt / 1.2);
      thread.geometry.setDrawRange(0, Math.floor(thread.geometry.index.count * smooth(threadT) / 6) * 6);
    }
  }

  updateLetter(dt, speed);
  composer.render(dt);
  debug.frames++;
  if (!started) { started = true; emit('ready'); }
  requestAnimationFrame(frame);
}
// inspection hook for checks in the browser (read-only use)
const debug = { frames: 0, renderer, scene, camera, letter, get prog() { return prog; } };
window.__firstLight = debug;
requestAnimationFrame(frame);
