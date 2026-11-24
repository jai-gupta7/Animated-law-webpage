/* First Light R3 (D220): the full journey as a paper world, travelled by native scroll from night to dawn.
   0 kitchen → 1 rainy street → 2 crossroads → 3 offices → 4 porch lights → 5 map of lights → 6 the firm's door.
   R1's story and interactions, R2's detail and motion, look C: card, soft shadows, AO, depth of field, cut edges. */
import * as THREE from 'three';
import { state, emit, on, reduce, dawnAt } from './ui.js';
import { OUTLINE, STATES, OFFICES, SERVED, inOutline } from './us-map.js';
import { createLetter } from './letter.js';
import { createBuilder, makeRng, ROAD } from './build.js';
import * as look from './paper.js';

const $ = (s) => document.querySelector(s);
let phone = innerWidth < 760;
const low = phone || (navigator.hardwareConcurrency || 8) <= 4;
const rng = makeRng();
const { rand, rnd, pick } = rng;
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpE = new THREE.Euler(), tmpC = new THREE.Color();
const SERIF = '"Newsreader", Georgia, serif', SANS = '"Hanken Grotesk", Arial, sans-serif';
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

// ---------- renderer ----------
const canvas = $('#world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  emit('webgl-fail');
  throw err;
}
const DPR = Math.min(devicePixelRatio || 1, low ? 1.1 : 1.5);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(new THREE.Color(look.FOG.color), look.FOG.density);
scene.background = scene.fog.color.clone();
const camera = new THREE.PerspectiveCamera(phone ? 62 : 46, innerWidth / innerHeight, 0.05, 900);
camera.layers.enable(1); // layer 1: rain, splashes, sprites, map lights (left out of the depth pass)
const L1 = (o) => { o.layers.set(1); o.traverse?.((c) => c.layers.set(1)); return o; };

// ---------- layout ----------
const MAP = { z: -255, k: 2.6, y: 0.32, from: -203, to: -303 };
const mapXY = (lon, lat) => [(lon + 96) * 0.788 * MAP.k, MAP.z - (lat - 38) * MAP.k];
const inMapZone = (z) => z < MAP.from + 6 && z > MAP.to - 6;
const CROSS = -60;
const SIGN = v3(ROAD.half + ROAD.curb + 1.0, 0, CROSS + 5.2);
const FIRM = { x: 6.8, z0: -94, z1: -110, h: 9.5 };
const HEAR = { x: -7.2, z0: -98, z1: -114, h: 7.5 };
const DOOR = v3(0, 0, -352);

// ---------- camera path ----------
function stationList() {
  return [
    { p: [0, 1.55, 2.6], l: [0.3, 0.85, -0.6], s: true }, // 0 kitchen
    { p: [0.05, 1.68, -2.4], l: [0.5, 1.6, -30] }, // through the open window
    { p: [0.6, 1.75, -11], l: [1.4, 1.75, -40], s: true }, // 1 street
    { p: [-1.2, 2.0, -48], l: [SIGN.x - 0.9, 2.3, SIGN.z], s: true }, // 2 crossroads
    { p: [-2.0, 2.0, -88], l: [FIRM.x + 1.5, 4.2, -101], s: true }, // 3 offices
    { p: [-1.4, 2.1, -124], l: [7.0, 2.0, -144], s: true }, // 4 porch lights
    phone ? { p: [16, 62, -204], l: [24, 0, -241], s: true } : { p: [-4, 104, -170], l: [-4, 0, -252], s: true }, // 5 map
    { p: [0, 22, -318], l: [0, 3, -352] },
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

// ---------- sky: a gradient card, paper moon and sun, stars, clouds on threads ----------
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, -0.1, -1) }, uSunCol: { value: new THREE.Color() } };
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
      vec3 c = mix(uHor, uTop, pow(h, 0.55));
      float m = max(dot(d, normalize(uSunDir)), 0.0);
      c += uSunCol * (pow(m, 14.0) * 0.4 + pow(m, 3.0) * 0.12 * exp(-abs(d.y - uSunDir.y) * 6.0));
      if (d.y < 0.0) c = uHor * 0.7;
      gl_FragColor = vec4(c, 1.0);
    }`,
})));
const stars = (() => {
  const n = low ? 600 : 1100, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), y = rnd(0.1, 1), r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 450, y * 450, Math.sin(a) * r * 450], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#e6ebff', size: 2.2 * DPR, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
  skyGroup.add(L1(p));
  return p;
})();
function paperDisc(color, r, rings, glow = 1, haloColor = color) { // a paper disc with paper halo rings behind it
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(glow), fog: false, transparent: true }));
  g.add(disc);
  const halos = rings.map(([rr, o], i) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rr, 48), new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: o, fog: false, depthWrite: false }));
    m.position.z = -1 - i;
    m.userData.o = o;
    g.add(m);
    return m;
  });
  g.userData = { disc, halos };
  skyGroup.add(L1(g));
  return g;
}
const moon = paperDisc('#f4ecd8', 10, [[14, 0.22], [19, 0.1]]);
const sun = paperDisc('#fff1d6', 14, [[22, 0.45], [32, 0.25], [44, 0.12]], 2.2, '#ffb466');
const clouds = new THREE.Group();
scene.add(clouds);
for (let i = 0; i < (low ? 10 : 16); i++) {
  const z = rnd(-40, -470), side = rand() < 0.5 ? -1 : 1;
  clouds.add(look.S.cloud(side * rnd(25, 150), rnd(32, 70), z, rnd(28, 55), rng));
}

// time-of-day keys (R1): the light is the plot
const KEYS = [
  { t: 0.0, top: '#0e1630', hor: '#2f3a5e', fog: '#1c2640', sun: '#000000', hemiS: '#5466a0', hemiG: '#14141c', hemi: 1.0, sunI: 0.0, moon: 1.0, exp: 1.0 },
  { t: 0.35, top: '#131a38', hor: '#3a3d62', fog: '#262a48', sun: '#3a2c48', hemiS: '#5c6496', hemiG: '#16141c', hemi: 1.05, sunI: 0.05, moon: 0.75, exp: 1.0 },
  { t: 0.7, top: '#22305a', hor: '#8a6676', fog: '#56486a', sun: '#ff9f6a', hemiS: '#9a88aa', hemiG: '#1e1820', hemi: 1.1, sunI: 0.9, moon: 0.2, exp: 1.0 },
  { t: 1.0, top: '#3c5c92', hor: '#f0b27e', fog: '#c09484', sun: '#ffc98a', hemiS: '#d3bcae', hemiG: '#3a2c22', hemi: 1.0, sunI: 2.4, moon: 0.0, exp: 1.0 },
  { t: 1.35, top: '#6596cc', hor: '#f4dfc2', fog: '#dccbb6', sun: '#fff0d4', hemiS: '#e6dccb', hemiG: '#4a4030', hemi: 1.15, sunI: 3.0, moon: 0.0, exp: 1.02 },
].map((k) => ({ ...k, top: new THREE.Color(k.top), hor: new THREE.Color(k.hor), fog: new THREE.Color(k.fog), sun: new THREE.Color(k.sun), hemiS: new THREE.Color(k.hemiS), hemiG: new THREE.Color(k.hemiG) }));
const sky = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hemiS: new THREE.Color(), hemiG: new THREE.Color(), hemi: 0, sunI: 0, moon: 0, exp: 1 };
function skyAt(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1], f = clamp((t - a.t) / (b.t - a.t));
  for (const c of ['top', 'hor', 'fog', 'sun', 'hemiS', 'hemiG']) sky[c].copy(a[c]).lerp(b[c], f);
  for (const n of ['hemi', 'sunI', 'moon', 'exp']) sky[n] = lerp(a[n], b[n], f);
}
const FOG_D = [0.022, 0.026, 0.028, 0.02, 0.016, 0.0025, 0.005];

// ---------- light ----------
const hemi = new THREE.HemisphereLight('#5466a0', '#14141c', 1.0);
const skyLight = new THREE.DirectionalLight('#9fb3e0', 1.0); // the moon, then the sun: one shadow-casting light
skyLight.castShadow = true;
skyLight.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
Object.assign(skyLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 220 });
skyLight.shadow.bias = -0.0005;
skyLight.shadow.radius = 4;
scene.add(hemi, skyLight, skyLight.target);

// ---------- the world ----------
const B = createBuilder(scene, look.M, look.S, rng);
const K = B.kitchen();
B.road([[-5, MAP.from + 2], [MAP.to - 2, -351.5]], [[CROSS + 3.6, CROSS - 3.6]]);
B.crossStreet(CROSS);
B.puddles([[1.2, -13, 1.6, 0.9], [-1.5, -21, 2.2, 1.1], [0.6, -34, 1.3, 0.7], [-0.8, -47, 1.8, 0.8], [1.0, -78, 1.4, 0.8], [-1.2, -132, 1.7, 0.9]]);
const houses = [];
let hi = 0;
for (let z = -13; z > -50; z -= rnd(11, 13)) { houses.push(B.house(z, -1, hi++)); houses.push(B.house(z - rnd(4, 6), 1, hi++)); }
const porches = [];
for (let z = -117; z > -175; z -= 9.5) { porches.push(B.house(z, -1, hi++, { porch: true, setback: 9 })); porches.push(B.house(z - 4.75, 1, hi++, { porch: true, setback: 9 })); }
houses.push(...porches);
B.poles(-14, -52, ROAD.half + ROAD.curb + ROAD.walk - 0.3);
B.car(-2.1, -24.5);
B.car(2.1, -84, 'doorB');
B.hydrant(ROAD.half + 0.7, -17);
B.mailbox(-(ROAD.half + 2.0), -15.5);
B.hills();
const lamps = [];
for (let z = -9, k = 0; z > -342; z -= 12.5, k++) {
  if (inMapZone(z) || (z < -198 && z > -306) || Math.abs(z - CROSS) < 4) continue;
  const side = k % 2 ? 1 : -1;
  lamps.push({ head: B.lamp(side * (ROAD.half + ROAD.curb + 0.35), z), side });
}
lamps.push({ head: B.lamp(-(ROAD.half + ROAD.curb + 0.35), CROSS + 5.5), side: -1 }); // the corner lamp that lights the signpost
const lampSpots = Array.from({ length: low ? 3 : 4 }, (_, i) => {
  const s = new THREE.SpotLight('#ffcf94', 55, 22, 1.0, 0.75, 1.6);
  s.castShadow = i < (low ? 1 : 2);
  if (s.castShadow) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0006; }
  scene.add(s, s.target);
  return s;
});
const porchLights = Array.from({ length: 3 }, () => { const p = new THREE.PointLight('#ffc27a', 0, 9, 2); scene.add(p); return p; });

// trees: cut-card flats, kept off houses, buildings, the map and the kitchen
{
  const blocked = (x, z) => houses.some((h) => Math.abs(x - h.x) < h.d / 2 + 2.5 && Math.abs(z - h.z) < h.w / 2 + 2)
    || (x > FIRM.x - 1 && x < FIRM.x + 11 && z < FIRM.z0 + 2 && z > FIRM.z1 - 2)
    || (x < HEAR.x + 1 && x > HEAR.x - 14 && z < HEAR.z0 + 2 && z > HEAR.z1 - 2)
    || Math.abs(z - CROSS) < 5 || (Math.abs(x) < 10 && z < -340) || inMapZone(z) || z > -6
    || Math.abs(x) < ROAD.half + ROAD.curb + ROAD.walk + 0.6;
  let made = 0;
  for (let k = 0; made < (low ? 90 : 170) && k < 6000; k++) {
    const z = rnd(-350, -8), side = rand() < 0.5 ? -1 : 1;
    const x = side * (6 + Math.abs(gauss()) * 34);
    if (Math.abs(x) > 90 || blocked(x, z)) continue;
    const near = Math.abs(x) < 9;
    if (near && rand() < 0.6) continue; // few on the lawns, so porches stay in view
    scene.add(look.S.tree(x, z, near ? rnd(3.6, 5) : rnd(5, 10), rng));
    made++;
  }
}

// ---------- 2 · the crossroads signpost (R1 boards, on paper) ----------
const SIGNS = [
  { t: 'SSDI', s: 'Disability Insurance', dir: 1, yaw: 0.1, y: 3.05 },
  { t: 'SSI', s: 'Supplemental Income', dir: -1, yaw: -0.1, y: 2.62 },
  { t: 'APPEALS', s: 'After a denial', dir: 1, yaw: 0.5, y: 2.19 },
  { t: 'HEARINGS', s: 'Before a judge', dir: -1, yaw: -0.5, y: 1.76 },
];
const signGroup = new THREE.Group();
signGroup.position.copy(SIGN);
scene.add(signGroup);
B.cyl(0.06, 0.08, 3.5, 0, 1.75, 0, 'pole', signGroup, 10);
SIGNS.forEach((sg, i) => {
  const tex = canvasTex(512, 116, (g, w, h) => {
    const tip = 46, r = sg.dir > 0;
    g.beginPath();
    if (r) { g.moveTo(4, 6); g.lineTo(w - tip, 6); g.lineTo(w - 4, h / 2); g.lineTo(w - tip, h - 6); g.lineTo(4, h - 6); }
    else { g.moveTo(w - 4, 6); g.lineTo(tip, 6); g.lineTo(4, h / 2); g.lineTo(tip, h - 6); g.lineTo(w - 4, h - 6); }
    g.closePath();
    g.fillStyle = '#ece5d6'; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#2a2a2e'; g.stroke();
    g.fillStyle = '#1d2026'; g.font = `700 50px ${SANS}`; g.textBaseline = 'middle';
    const x0 = r ? 28 : tip + 22, tw = g.measureText(sg.t).width;
    g.fillText(sg.t, x0, h / 2 - 2);
    g.font = `500 22px ${SANS}`; g.fillStyle = '#4a4d55';
    g.fillText(sg.s, x0 + tw + 16, h / 2 + 2);
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#3a3226', transparent: true, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, -0.215), new THREE.Vector2(1.9, -0.215), new THREE.Vector2(1.9, 0.215), new THREE.Vector2(0, 0.215)]), { depth: 0.03, bevelEnabled: false }), [mat, look.M('sign')]);
  // card thickness: the face uses the painted board, the edges plain card
  mesh.geometry.computeBoundingBox();
  const uv = mesh.geometry.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 1.9, (uv.getY(k) + 0.215) / 0.43);
  if (sg.dir < 0) mesh.geometry.translate(-1.9, 0, 0), mesh.geometry.scale(1, 1, 1);
  mesh.castShadow = true;
  const pivot = new THREE.Group();
  pivot.position.y = sg.y;
  pivot.add(mesh);
  signGroup.add(pivot);
  mesh.userData = { kind: 'sign', i };
  Object.assign(sg, { mesh, mat, pivot, swing: 0, hov: 0 });
});

// ---------- 3 · the firm's offices and the hearing office ----------
{
  const fw = 9, hw = 12;
  B.box(fw, FIRM.h, FIRM.z0 - FIRM.z1, FIRM.x + fw / 2, FIRM.h / 2, (FIRM.z0 + FIRM.z1) / 2, 'brick');
  B.box(0.5, 0.5, FIRM.z0 - FIRM.z1 + 0.5, FIRM.x + 0.1, FIRM.h + 0.2, (FIRM.z0 + FIRM.z1) / 2, 'trim');
  B.box(hw, HEAR.h, HEAR.z0 - HEAR.z1, HEAR.x - hw / 2, HEAR.h / 2, (HEAR.z0 + HEAR.z1) / 2, 'stone');
  B.box(0.5, 0.5, HEAR.z0 - HEAR.z1 + 0.5, HEAR.x - 0.1, HEAR.h + 0.2, (HEAR.z0 + HEAR.z1) / 2, 'trim');
  for (const z of [-100.5, -103.5, -106.5, -109.5, -112.5]) B.cyl(0.22, 0.25, 3.0, HEAR.x + 0.5, 1.5, z, 'trim', scene, 12); // columns
  const wins = [];
  for (const z of [-96.5, -99.6, -102.7, -105.8, -108.6]) for (const y of [1.9, 7.4]) wins.push({ x: FIRM.x - 0.01, z, y, f: 1, lit: rand() < 0.6 });
  for (const z of [-101, -104, -107, -110, -113]) for (const y of [4.2, 6.2]) wins.push({ x: HEAR.x + 0.01, z, y, f: -1, lit: rand() < 0.25 });
  wins.forEach((w) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), w.lit ? look.S.litWindow : look.S.dimWindow);
    pane.position.set(w.x - w.f * 0.07, w.y, w.z); // in front of its frame card
    pane.rotation.y = w.f > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(pane);
    B.box(0.06, 1.6, 1.3, w.x - w.f * 0.02, w.y, w.z, 'trim', scene, false);
  });
  const plaque = (text, sub, x, y, z, f, wpx = 640) => {
    const t = canvasTex(wpx, 150, (g, w, h) => {
      g.fillStyle = '#e9e1d0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8a6526'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#1d2026'; g.textAlign = 'center';
      g.font = `500 54px ${SERIF}`; g.fillText(text, w / 2, 76);
      g.font = `600 22px ${SANS}`; g.fillStyle = '#4a4d55'; g.fillText(sub, w / 2, 118);
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(wpx / 200, 0.75, 0.04), [look.M('sign'), look.M('sign'), look.M('sign'), look.M('sign'), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), look.M('sign')]);
    m.position.set(x - f * 0.04, y, z);
    m.rotation.y = f > 0 ? -Math.PI / 2 : Math.PI / 2;
    m.castShadow = true;
    scene.add(m);
  };
  plaque('Ashgrove & Penn', 'DISABILITY LAW · SECOND FLOOR', FIRM.x, 3.0, -97.6, 1);
  plaque('Hearing Office', 'DISABILITY HEARINGS', HEAR.x, 3.4, -99.5, -1, 560);
  const lobby = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), look.S.litWindow);
  lobby.position.set(FIRM.x - 0.02, 1.2, -100.3);
  lobby.rotation.y = -Math.PI / 2;
  scene.add(lobby);
}
const ATTORNEY_WINS = [-99.6, -102.7, -105.8].map((z, i) => {
  const tex = canvasTex(256, 320, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#ffdcaa'); bg.addColorStop(1, '#c78550');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,55,30,0.45)';
    for (let k = 0; k < 4; k++) g.fillRect(i === 1 ? 20 : 140, 40 + k * 46, 96, 8);
    g.fillStyle = 'rgba(110,60,30,0.35)';
    for (let k = 0; k < 14; k++) g.fillRect((i === 1 ? 22 : 142) + (k % 7) * 13, 16 + ((k / 7) | 0) * 46, 9, 24);
    g.fillStyle = '#3b2519';
    const cx = [92, 160, 110][i], cy = [150, 160, 140][i];
    g.beginPath(); g.arc(cx, cy, 30, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx, cy + 105, 64, 70, 0, Math.PI, 0); g.fill();
    g.fillRect(cx - 64, cy + 105, 128, 80);
    g.fillStyle = '#2a1a12'; g.fillRect(0, h - 70, w, 70);
    g.fillStyle = '#fff0c8';
    g.beginPath(); g.arc([200, 50, 190][i], h - 96, 18, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(30,20,14,0.9)';
    g.fillRect(w / 2 - 4, 0, 8, h); g.fillRect(0, h / 2 - 4, w, 8);
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.9 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1), mat);
  m.position.set(FIRM.x - 0.1, 4.65, z);
  m.rotation.y = -Math.PI / 2;
  m.userData = { kind: 'attorney', i };
  scene.add(m);
  B.box(0.08, 2.3, 1.9, FIRM.x - 0.02, 4.65, z, 'trim', scene, false);
  return { mesh: m, mat, hov: 0 };
});

// ---------- rain (night) and splashes ----------
const rainU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(look.RAIN.color) }, uOp: { value: look.RAIN.opacity } };
{
  const n = low ? 1100 : 2000, off = new Float32Array(n * 6), end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const a = [rand(), rand(), rand()]; off.set([...a, ...a], i * 6); end[i * 2 + 1] = 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(off, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec3 uCam; attribute float aEnd; varying float vA;
      void main() {
        vec3 box = vec3(26.0, 12.0, 30.0);
        float fall = fract(position.y - uTime * (0.85 + position.x * 0.25));
        vec3 p;
        p.y = uCam.y - 5.0 + fall * box.y;
        p.x = uCam.x + (fract(position.x - uCam.x / box.x) - 0.5) * box.x + (1.0 - fall) * 1.6;
        p.z = uCam.z - 5.0 + (fract(position.z - uCam.z / box.z) - 0.5) * box.z;
        p.y -= aEnd * 0.5; p.x -= aEnd * 0.09;
        bool indoors = abs(p.x) < 3.6 && p.z > -3.1 && p.z < 4.6 && p.y < 3.4;
        vA = indoors ? 0.0 : mix(0.15, 1.0, aEnd) * (0.5 + 0.5 * position.z);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`uniform vec3 uCol; uniform float uOp; varying float vA;
      void main(){ if (vA <= 0.0 || uOp <= 0.0) discard; gl_FragColor = vec4(uCol, vA * uOp); }`,
  }));
  rain.frustumCulled = false;
  scene.add(L1(rain));
  const sn = 220, seeds = new Float32Array(sn * 3);
  for (let i = 0; i < sn * 3; i++) seeds[i] = rand();
  const sg = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  sg.instanceCount = sn;
  sg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
  const splash = new THREE.Mesh(sg, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec3 uCam; attribute vec3 aSeed; varying vec2 vUv; varying float vLife; varying float vIn;
      void main() {
        vUv = uv;
        float t = uTime * (1.3 + aSeed.z) + aSeed.x * 17.0;
        float cyc = floor(t); vLife = fract(t);
        vec2 r = fract(aSeed.xy + cyc * vec2(0.618, 0.382));
        vec3 c = vec3(uCam.x + (r.x - 0.5) * 22.0, 0.03, uCam.z - 4.0 - r.y * 22.0);
        c.y = abs(c.x) < 3.0 ? 0.025 : (abs(c.x) < 5.3 ? 0.155 : 0.03);
        vIn = (abs(c.x) < 3.6 && c.z > -3.2) ? 0.0 : 1.0;
        gl_Position = projectionMatrix * viewMatrix * vec4(c + position * (0.05 + vLife * 0.2), 1.0);
      }`,
    fragmentShader: /* glsl */`uniform vec3 uCol; uniform float uOp; varying vec2 vUv; varying float vLife; varying float vIn;
      void main(){ float d = length(vUv - 0.5) * 2.0; float ring = smoothstep(0.75, 0.88, d) * (1.0 - smoothstep(0.9, 1.0, d));
        float a = ring * (1.0 - vLife) * vIn * uOp * 0.8; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }`,
  }));
  splash.frustumCulled = false;
  scene.add(L1(splash));
}

// ---------- 5 · the map of lights: pinholes in a dark paper sheet ----------
const mapGroup = new THREE.Group();
scene.add(mapGroup);
const mapU = { uTime: { value: 0 }, uReveal: { value: 0 }, uPx: { value: DPR * innerHeight / 900 }, uDim: { value: 1 } };
{
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(140, 0.1, 82), look.M('mapSheet', { color: '#1d2338' }));
  sheet.position.set(0, 0.2, MAP.z - 3);
  sheet.receiveShadow = true;
  mapGroup.add(sheet);
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
        float on = smoothstep(aDist - 6.0, aDist, uReveal * 150.0);
        vA = on * (0.75 + 0.25 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 40.0)) * uDim;
        gl_PointSize = clamp(uPx * (0.6 + aSeed) * 300.0 / -mv.z, 1.6, 9.0);
      }`,
    fragmentShader: /* glsl */`varying vec3 vCol; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d); gl_FragColor = vec4(vCol * a * 2.2 * vA, a * vA); }`,
  }));
  pts.frustumCulled = false;
  mapGroup.add(L1(pts));
  // the coastline as a gold thread laid on the sheet
  const outline = new THREE.CatmullRomCurve3(OUTLINE.map(([lo, la]) => { const [x, z] = mapXY(lo, la); return v3(x, MAP.y, z); }), true);
  const line = new THREE.Mesh(new THREE.TubeGeometry(outline, 400, 0.12, 5, true), new THREE.MeshStandardMaterial({ color: '#c99a4e', roughness: 0.5, transparent: true, opacity: 0 }));
  line.castShadow = true;
  mapGroup.add(line);
  mapGroup.userData.line = line;
}
const officeMarks = OFFICES.map((o) => {
  const [x, z] = mapXY(o.lon, o.lat);
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide };
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 18, 12, 1, true).translate(0, 9, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(1.6), opacity: 0, ...add }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.05, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(1.6), opacity: 0, ...add }));
  beam.position.set(x, MAP.y, z);
  ring.position.set(x, MAP.y + 0.05, z);
  mapGroup.add(L1(beam), L1(ring));
  return { beam, ring, x, z, boost: 0 };
});
const stateMark = L1(new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0d0').multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
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
  const oi = SERVED[code] ?? officeMarks.map((o, i) => [Math.hypot(o.x - sx, o.z - sz), i]).sort((a, b) => a[0] - b[0])[0][1];
  chosenOffice = oi;
  const o = officeMarks[oi], len = Math.hypot(o.x - sx, o.z - sz);
  if (len < 1) return;
  const curve = new THREE.QuadraticBezierCurve3(v3(sx, MAP.y, sz), v3((sx + o.x) / 2, MAP.y + Math.max(3, len * 0.35), (sz + o.z) / 2), v3(o.x, MAP.y, o.z));
  thread = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.14, 6), new THREE.MeshStandardMaterial({ color: '#d9a64e', emissive: '#7a4a10', roughness: 0.5 }));
  thread.castShadow = true;
  thread.geometry.setDrawRange(0, 0);
  threadT = 0;
  mapGroup.add(thread);
});

// ---------- 6 · the firm's door at sunrise ----------
const doorGroup = new THREE.Group();
doorGroup.position.copy(DOOR);
scene.add(doorGroup);
let doorPivot, doorLight;
const doorGlow = look.S.windowMat();
{
  const D = doorGroup;
  B.box(5.15, 5.2, 10, -3.425, 2.6, -5, 'brick', D); B.box(5.15, 5.2, 10, 3.425, 2.6, -5, 'brick', D);
  B.box(1.7, 2.5, 10, 0, 3.95, -5, 'brick', D);
  B.box(2.3, 0.18, 0.3, 0, 2.8, 0.1, 'trim', D); B.box(0.18, 2.8, 0.3, -1.06, 1.4, 0.1, 'trim', D); B.box(0.18, 2.8, 0.3, 1.06, 1.4, 0.1, 'trim', D);
  B.box(3.2, 0.16, 1.2, 0, 0.08, 0.6, 'step', D); B.box(2.6, 0.16, 0.8, 0, 0.24, 0.35, 'step', D);
  B.box(12.4, 0.3, 0.5, 0, 5.3, 0.05, 'trim', D);
  for (const x of [-1.7, 1.7]) B.cyl(0.16, 0.18, 2.9, x, 1.45, 0.45, 'trim', D, 14); // columns either side of the door
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.7), doorGlow);
  inside.position.set(0, 1.35, -0.6);
  D.add(inside);
  doorPivot = new THREE.Group();
  doorPivot.position.set(-0.85, 0, -0.05);
  const panel = B.box(1.7, 2.7, 0.08, 0.85, 1.35, 0, 'firmDoor', doorPivot);
  void panel;
  B.lathe([[0.001, 0], [0.05, 0.02], [0.05, 0.06], [0.001, 0.08]], 'metal', doorPivot, 10).position.set(1.5, 1.25, 0.05);
  D.add(doorPivot);
  for (const x of [-4.4, -2.6, 2.6, 4.4]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), look.S.litWindow); w.position.set(x, 1.7, 0.07); D.add(w);
    B.box(1.3, 1.8, 0.08, x, 1.7, 0.0, 'trim', D, false);
  }
  for (const x of [-4.4, -2.2, 0, 2.2, 4.4]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), look.S.litWindow); w.position.set(x, 4.3, 0.07); D.add(w);
    B.box(1.2, 1.1, 0.08, x, 4.3, 0.0, 'trim', D, false);
  }
  const sign = canvasTex(1024, 150, (g, w, h) => {
    g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2026'; g.textAlign = 'center';
    g.font = `400 78px ${SERIF}`; g.fillText('Ashgrove & Penn', w / 2, 88);
    g.font = `600 24px ${SANS}`; g.fillStyle = '#8a6526'; g.fillText('S O C I A L   S E C U R I T Y   D I S A B I L I T Y   L A W', w / 2, 130);
  });
  const signM = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.68, 0.05), [look.M('sign'), look.M('sign'), look.M('sign'), look.M('sign'), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.8 }), look.M('sign')]);
  signM.position.set(0, 3.25, 0.3);
  signM.castShadow = true;
  D.add(signM);
  doorLight = new THREE.PointLight('#ffcf9a', 3, 14, 1.6);
  doorLight.position.set(0, 1.6, 1.2);
  D.add(doorLight);
}

// ---------- the letter ----------
const letter = createLetter();
scene.add(letter.group);
letter.sheet.castShadow = true;
const TABLE_POS = v3(0.32, 0.795, -0.42);
const TABLE_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.22, 'XYZ'));
const DOOR_IN = v3(0, 1.4, DOOR.z - 0.8);
const lt = { pos: TABLE_POS.clone(), vel: new THREE.Vector3(), q: TABLE_Q.clone() };

// ---------- post-processing ----------
const post = look.post(renderer, scene, camera, innerWidth, innerHeight);

// ---------- events from the page ----------
let htmlSign = -1, htmlAtt = -1;
on('sign', ({ i, on: v }) => { htmlSign = v ? i : (htmlSign === i ? -1 : htmlSign); if (v) SIGNS[i].swing = Math.max(SIGNS[i].swing, 0.5); });
on('attorney', ({ i, on: v }) => { htmlAtt = v ? i : (htmlAtt === i ? -1 : htmlAtt); });
on('flip', ({ on: v }) => letter.setFlip(v));
on('submit', () => letter.send(reduce));
on('reset', () => { letter.reset(); letter.group.visible = true; });

// ---------- pointer: parallax, hover, tap and drag-to-look ----------
const ptr = { nx: 0, ny: 0, sx: 0, sy: 0, x: -1, y: -1, mouse: false };
const lookDrag = { yaw: 0, pitch: 0, drag: null };
const NOT_WORLD = 'a, button, input, select, textarea, label, .panel, .topbar, .road, .callbar, .foot, .gl-status, form';
addEventListener('pointermove', (e) => {
  ptr.nx = (e.clientX / innerWidth) * 2 - 1;
  ptr.ny = -((e.clientY / innerHeight) * 2 - 1);
  ptr.x = e.clientX; ptr.y = e.clientY;
  ptr.mouse = e.pointerType === 'mouse' && !e.target.closest(NOT_WORLD);
  const d = lookDrag.drag;
  if (d && d.id === e.pointerId) {
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    if (d.moved > 6) { lookDrag.yaw = clamp(d.yaw - dx * 0.0035, -0.7, 0.7); lookDrag.pitch = clamp(d.pitch + dy * 0.0025, -0.3, 0.3); }
  }
}, { passive: true });
addEventListener('pointerdown', (e) => {
  if (e.button > 0 || e.target.closest(NOT_WORLD)) return;
  lookDrag.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: lookDrag.yaw, pitch: lookDrag.pitch, moved: 0, t: performance.now() };
});
function endDrag(e, cancelled) {
  const d = lookDrag.drag;
  if (!d || d.id !== e.pointerId) return;
  lookDrag.drag = null;
  if (cancelled || d.moved >= 6 || performance.now() - d.t > 500) return;
  const hit = pickAt(e.clientX, e.clientY);
  if (!hit) return;
  if (hit.kind === 'letter') emit('pick-letter');
  if (hit.kind === 'sign') { emit('pick-sign', { i: hit.i }); SIGNS[hit.i].swing = 1; }
  if (hit.kind === 'attorney') emit('pick-attorney', { i: hit.i });
}
addEventListener('pointerup', (e) => endDrag(e, false));
addEventListener('pointercancel', (e) => endDrag(e, true));
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { ptr.mouse = false; ptr.nx = ptr.ny = 0; } });

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
ray.layers.enableAll();
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
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  post.resize(innerWidth, innerHeight);
  mapU.uPx.value = DPR * innerHeight / 900;
});

// ---------- per frame ----------
const LETTER_WIDE = [[0.36, -0.05, 0.7], [0.36, -0.05, 0.7], [0.56, 0.46, 0.36], [0.56, 0.46, 0.36], [0.56, 0.46, 0.36], [0.66, 0.6, 0.28], [-0.4, 0.45, 0.36]];
const LETTER_PHONE = [[0, 0.3, 0.62], [0, 0.3, 0.62], [0.6, 0.46, 0.3], [0.6, 0.46, 0.3], [0.6, 0.46, 0.3], [0.62, 0.48, 0.26], [0, 0.66, 0.45]];
const OFF_WIDE = [[-0.2, 0.03], [-0.14, 0], [-0.17, 0], [-0.16, 0], [-0.15, 0], [-0.13, 0], [0.18, 0]];
const OFF_PHONE = [[0, 0.3], [0, 0.17], [0, 0.18], [0, 0.18], [0, 0.17], [0, 0.2], [0, 0.22]];
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), camUp = new THREE.Vector3();
const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(-0.45, 0.55, -1).normalize();
const st = { p: state.target, v: 0, time: 0, wo: 0, day: 0 };
let then = performance.now(), started = false, hoverKind = '', hoverI = -1, lookDist = 10;
const curveT = (u) => { const k = Math.min(Math.floor(u), LAST - 1), f = smooth(clamp(u - k)); return lerp(stationT[k], stationT[k + 1], f); };
const at = (arr, p) => { const a = Math.min(Math.floor(p), LAST - 1), f = smooth(clamp(p - a)); return arr[a].map((x, i) => lerp(x, arr[a + 1][i], f)); };

function updateCamera(dt) {
  const k = 16, c = 2 * Math.sqrt(k); // spring-damped progress: eases in and settles
  if (reduce) { st.p = state.target; st.v = 0; } else { st.v += (k * (state.target - st.p) - c * st.v) * dt; st.p += st.v * dt; }
  const p = clamp(st.p, 0, LAST);
  const t = curveT(p);
  posCurve.getPoint(t, camPos);
  lookCurve.getPoint(t, camLook);
  if (!reduce) {
    ptr.sx += ((ptr.mouse ? ptr.nx : 0) - ptr.sx) * damp(2, dt);
    ptr.sy += ((ptr.mouse ? ptr.ny : 0) - ptr.sy) * damp(2, dt);
  }
  if (!lookDrag.drag) { lookDrag.yaw *= Math.exp(-dt * 1.6); lookDrag.pitch *= Math.exp(-dt * 1.6); }
  fwd.subVectors(camLook, camPos);
  lookDist = fwd.length();
  fwd.normalize();
  right.crossVectors(fwd, UP).normalize();
  const T = st.time, hand = reduce ? 0 : 1, indoor = p < 0.5 ? 0.35 : 1;
  camPos.addScaledVector(right, ptr.sx * 0.4 * indoor + hand * (Math.sin(T * 0.71) + Math.sin(T * 1.33 + 1.7)) * 0.012)
    .addScaledVector(UP, ptr.sy * 0.2 * indoor + hand * (Math.sin(T * 0.53 + 0.4) + Math.sin(T * 1.17)) * 0.01);
  tmpV.subVectors(camLook, camPos).applyAxisAngle(UP, lookDrag.yaw).applyAxisAngle(right, lookDrag.pitch);
  camLook.copy(camPos).add(tmpV.setLength(lookDist));
  camera.position.copy(camPos);
  camera.up.set(hand * Math.sin(T * 0.37) * 0.006, 1, 0).normalize(); // a breath of roll, like a held camera
  camera.lookAt(camLook);
  const o = at(phone ? OFF_PHONE : OFF_WIDE, p);
  camera.setViewOffset(innerWidth, innerHeight, o[0] * innerWidth, o[1] * innerHeight, innerWidth, innerHeight);
  camera.updateMatrixWorld();
  skyGroup.position.copy(camera.position);
}

function updateLetter(dt) {
  const p = clamp(st.p, 0, LAST);
  const b = smooth(clamp((p - 0.06) / 0.8));
  camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const cf = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const L = at(phone ? LETTER_PHONE : LETTER_WIDE, p);
  const F = phone ? 2.9 : 2.8, halfH = F * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * camera.aspect;
  const comp = camera.position.clone().addScaledVector(right, L[0] * halfW).addScaledVector(camUp, L[1] * halfH).addScaledVector(cf, F);
  const target = TABLE_POS.clone().lerp(comp, b);
  target.y += Math.sin(b * Math.PI) * 0.45;
  if (b < 0.02 || reduce) { lt.pos.copy(target); lt.vel.set(0, 0, 0); } else { // spring follow: lags, overshoots softly
    const k = 34, c = 2 * Math.sqrt(k) * 0.55;
    lt.vel.addScaledVector(tmpV.subVectors(target, lt.pos).multiplyScalar(k).addScaledVector(lt.vel, -c), dt);
    lt.pos.addScaledVector(lt.vel, dt);
  }
  const side = lt.vel.dot(right), lift = lt.vel.dot(camUp), sway = reduce ? 0 : 1, T = st.time;
  const compQ = camera.quaternion.clone().multiply(tmpQ.setFromEuler(tmpE.set(
    -0.14 + sway * (Math.sin(T * 1.1) * 0.05 - lift * 0.12), (phone ? 0 : -0.35 * Math.sign(L[0] || 1)) + sway * Math.sin(T * 0.8) * 0.07, 0.06 - side * 0.25 * sway)));
  lt.q.slerp(TABLE_Q.clone().slerp(compQ, b), b < 0.02 ? 1 : 1 - Math.exp(-dt * 7));
  const pos = lt.pos.clone();
  letter.sheet.castShadow = b > 0.1; // flat on the table its (undeformed) shadow would show as dark wedges
  letter.group.quaternion.copy(lt.q);
  letter.group.scale.setScalar(lerp(1, L[2], b));
  const fly = letter.update(dt, T, { flutter: b < 0.03 ? 0 : 0.05 + Math.min(0.28, Math.abs(st.v) * 0.35 + lt.vel.length() * 0.05), reduce, lift: b < 0.05 && letter.state.glow ? 0.03 : 0 });
  if (fly > 0) {
    const k = smooth(fly);
    pos.lerp(DOOR_IN, k);
    letter.group.scale.multiplyScalar(1 - 0.75 * k);
    if (fly >= 1) letter.group.visible = false;
  }
  letter.group.position.copy(pos);
  const night = smooth(clamp(p / 0.8));
  const sunW = smooth(clamp((dawnAt(p) - 0.45) / 0.35) + st.day);
  letter.uniforms.uKey.value.set('#ffcf9a').lerp(tmpC.set('#d3dcf5'), night).lerp(sky.sun, sunW * 0.6).multiplyScalar(0.85 + sky.sunI * 0.05);
  letter.uniforms.uAmb.value.copy(sky.hemiS).multiplyScalar(0.22 + sky.hemi * 0.12);
  // rack focus: the letter in the kitchen, street and at the door; the scene itself in between
  const lookW = smooth(clamp((p - 1.3) / 0.6)); // from the crossroads on, focus on the place, not the letter
  post.focus(lerp(camera.position.distanceTo(pos), lookDist, lookW), dt);
}

function frame(now) {
  const dt = Math.min((now - then) / 1000, 0.05);
  then = now;
  st.time += reduce ? dt * 0.3 : dt;
  st.day += (state.day - st.day) * damp(reduce ? 20 : 0.9, dt);
  updateCamera(dt);
  const p = clamp(st.p, 0, LAST), T = st.time;

  // light and weather
  const dawn = dawnAt(p);
  skyAt(dawn + st.day * 0.35);
  skyU.uTop.value.copy(sky.top); skyU.uHor.value.copy(sky.hor); skyU.uSunCol.value.copy(sky.sun);
  sunDir.set(-0.06, lerp(-0.1, 0.3, smooth(dawn)) + st.day * 0.1, -1).normalize(); // clears the firm's roof at sunrise
  skyU.uSunDir.value.copy(sunDir);
  sun.position.copy(sunDir).multiplyScalar(420);
  sun.lookAt(camera.position);
  const sunVis = clamp((dawn - 0.55) * 2.5) + st.day * 0.3;
  sun.userData.disc.material.opacity = clamp(sunVis);
  sun.userData.halos.forEach((h) => { h.material.opacity = h.userData.o * clamp(sunVis); });
  moon.position.set(-0.45, 0.42, -1).normalize().multiplyScalar(420);
  moon.lookAt(camera.position);
  const moonVis = clamp(1 - dawn * 1.6);
  moon.userData.disc.material.opacity = moonVis;
  moon.userData.halos.forEach((h) => { h.material.opacity = h.userData.o * moonVis; });
  stars.material.opacity = clamp(1 - (dawn + st.day) * 1.5);
  scene.fog.color.copy(sky.fog);
  scene.background.copy(sky.fog);
  const fa = Math.min(Math.floor(p), LAST - 1);
  scene.fog.density = lerp(FOG_D[fa], FOG_D[fa + 1], smooth(clamp(p - fa))) * (1 - st.day * 0.4);
  hemi.color.copy(sky.hemiS); hemi.groundColor.copy(sky.hemiG); hemi.intensity = sky.hemi;
  // one shadow-casting light: the moon at night, the sun at dawn
  const sunW = smooth(clamp((dawn - 0.45) / 0.35) + st.day);
  skyLight.color.set('#9fb3e0').lerp(sky.sun, sunW);
  skyLight.intensity = lerp(sky.moon * 1.0, sky.sunI, sunW);
  skyLight.position.copy(camera.position).addScaledVector(tmpV.copy(moonDir).lerp(sunDir.clone().setY(Math.max(sunDir.y, 0.25)), sunW).normalize(), 90);
  skyLight.target.position.copy(camera.position).addScaledVector(fwd, 12);
  renderer.toneMappingExposure = look.EXPOSURE * sky.exp;
  rainU.uTime.value = T;
  rainU.uCam.value.copy(camera.position);
  rainU.uOp.value = reduce ? 0 : look.RAIN.opacity * (1 - smooth(clamp((p - 2.2) / 1.3)));

  // street lamps: the nearest few are real lights; all switch off after sunrise
  const lampOn = 1 - smooth(clamp((dawn + st.day * 0.5 - 0.9) / 0.15));
  look.S.lampGlass.emissiveIntensity = 0.3 + 1.9 * lampOn;
  const ahead = tmpV.copy(camera.position).addScaledVector(fwd, 9);
  const near = lamps.map((l) => [l.head.distanceToSquared(ahead), l]).sort((a, b) => a[0] - b[0]);
  lampSpots.forEach((s, i) => {
    const l = near[i][1];
    s.position.copy(l.head);
    s.target.position.set(l.head.x - l.side * 1.2, 0, l.head.z);
    s.intensity = 55 * lampOn;
  });

  // window and door
  st.wo += ((reduce ? (p > 0.05 ? 1 : 0) : smooth(clamp(p / 0.4))) - st.wo) * damp(6, dt);
  for (const s of K.sashes) s.pivot.rotation.y = -s.side * st.wo * 1.45 * (1 + (reduce ? 0 : Math.sin(T * 1.7 + s.side) * 0.03));
  if (p < 1.4) {
    for (const c of K.curtains) {
      const pa = c.mesh.geometry.attributes.position, b = c.base;
      for (let i = 0; i < pa.count; i++) {
        const x = b[i * 3], y = b[i * 3 + 1], down = clamp((1.0 - y) / 2.0);
        const gust = reduce ? 0.5 : 0.65 + 0.35 * Math.sin(T * 2.1 + y * 2.6 + x * 3 + c.side);
        pa.setXYZ(i, x + c.side * st.wo * down * 0.18 * gust, y + st.wo * down * down * 0.25 * gust, Math.sin(x * 22 + c.side) * 0.035 + st.wo * Math.pow(down, 1.4) * 0.75 * gust);
      }
      pa.needsUpdate = true;
      c.mesh.geometry.computeVertexNormals();
    }
  }
  doorPivot.rotation.y = smooth(clamp((p - 5.2) / 0.75)) * 1.35;
  doorGlow.emissiveIntensity = 1.2 + st.day * 1.5;
  doorLight.intensity = 3 + st.day * 3;

  // porch lights come on, near to far, as you arrive
  if (p > 3.3 && p < 5.4) {
    const reach = camera.position.z - 6 - 34 * smooth(clamp((p - 3.3) / 0.7));
    for (const hs of porches) if (hs.on === 0 && hs.z > reach) { hs.on = 1; hs.flick = 0; }
  }
  const litPorches = [];
  for (const hs of porches) {
    if (!hs.on) continue;
    hs.flick += dt;
    const k = reduce ? 1 : smooth(clamp(hs.flick / 0.5)) * (hs.flick < 0.7 && Math.sin(hs.flick * 45) < -0.4 ? 0.35 : 1);
    hs.switchable.forEach((m, j) => { m.emissiveIntensity = (j === hs.switchable.length - 1 ? 2.2 : 1.1) * k * (0.4 + 0.6 * lampOn); });
    litPorches.push([hs.bulb.distanceToSquared(ahead), hs, k]);
  }
  litPorches.sort((a, b) => a[0] - b[0]);
  porchLights.forEach((pl, i) => {
    const e = litPorches[i];
    if (!e) { pl.intensity = 0; return; }
    pl.position.copy(e[1].bulb);
    pl.intensity = 6 * e[2] * lampOn;
  });

  // hover, signposts, attorneys' windows
  const hit = ptr.mouse && !lookDrag.drag ? pickAt(ptr.x, ptr.y) : null;
  const hk = hit?.kind || '', hiI = hit?.i ?? -1;
  if (hk !== hoverKind || hiI !== hoverI) {
    if (hoverKind === 'sign') emit('sign-3d', { i: -1 });
    if (hoverKind === 'attorney') emit('attorney-3d', { i: -1 });
    hoverKind = hk; hoverI = hiI;
    if (hk === 'sign') { emit('sign-3d', { i: hiI }); SIGNS[hiI].swing = Math.max(SIGNS[hiI].swing, 0.6); }
    if (hk === 'attorney') emit('attorney-3d', { i: hiI });
    document.body.style.cursor = hk ? 'pointer' : '';
  }
  letter.state.glow = hk === 'letter';
  const passing = Math.abs(p - 2) < 1 ? Math.abs(st.v) * 0.25 : 0;
  SIGNS.forEach((s, i) => {
    s.swing = Math.min(1, s.swing + passing * dt * 3);
    s.swing *= Math.exp(-dt * 0.9);
    const litS = (hk === 'sign' && hiI === i) || htmlSign === i;
    s.hov += ((litS ? 1 : 0) - s.hov) * damp(8, dt);
    s.pivot.rotation.y = s.yaw + (reduce ? 0 : Math.sin(T * 2.3 + i * 1.7) * 0.22 * s.swing);
    s.mat.emissive.setRGB(0.23, 0.2, 0.15).lerp(tmpC.setRGB(0.55, 0.42, 0.22), s.hov).multiplyScalar(0.6 + s.hov * 0.4); // boards stay readable at night
  });
  ATTORNEY_WINS.forEach((a, i) => {
    const litA = (hk === 'attorney' && hiI === i) || htmlAtt === i;
    a.hov += ((litA ? 1 : 0) - a.hov) * damp(7, dt);
    a.mat.emissiveIntensity = 0.55 + a.hov * 0.8;
  });

  clouds.visible = camera.position.y < 26; // from above, the hung clouds would show their threads
  // the map of lights
  mapGroup.visible = p > 3.6;
  if (mapGroup.visible) {
    const rev = smooth(clamp((p - 4.25) / 0.75));
    mapU.uTime.value = T;
    mapU.uReveal.value = reduce ? (rev > 0 ? 1 : 0) : rev;
    mapU.uDim.value = 1 - 0.35 * dawn;
    mapGroup.userData.line.material.opacity = rev;
    officeMarks.forEach((o, i) => {
      o.boost += ((chosenOffice === i ? 1 : 0) - o.boost) * damp(4, dt);
      const pulse = reduce ? 1 : 0.75 + 0.25 * Math.sin(T * 2.2 + i);
      o.beam.material.opacity = rev * (0.2 + 0.35 * o.boost) * pulse;
      o.ring.material.opacity = rev * (0.6 + 0.4 * o.boost);
      o.ring.scale.setScalar(1 + o.boost * 0.5 + (reduce ? 0 : 0.08 * Math.sin(T * 3 + i)));
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

  updateLetter(dt);
  post.render(dt, T);
  debug.frames++;
  if (!started) { started = true; emit('ready'); }
  requestAnimationFrame(frame);
}
// inspection hook for checks in the browser (read-only use)
const debug = { frames: 0, renderer, scene, camera, letter, st, get prog() { return st.p; } };
window.__firstLight = debug;
requestAnimationFrame(frame);
