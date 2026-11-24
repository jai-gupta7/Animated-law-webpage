/* First Light R2 style test: one world, rendered in look A (ink) or C (paper).
   Shared motion upgrades: a spring-damped camera with a slight handheld drift, a letter that follows on a
   spring and sways with its own speed, curtains the draught blows in, angled rain with splashes. */
import * as THREE from 'three';
import { createLetter } from '../first-light/letter.js';
import { buildWorld } from './build.js';
import * as ink from './ink.js';
import * as paper from './paper.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const UP = new THREE.Vector3(0, 1, 0);
const v3 = (a) => new THREE.Vector3(...a);

// camera stations: 0 kitchen, (window), 1 street, 2 further down toward the crossroads
const STATIONS = [
  { p: [0, 1.55, 2.6], l: [0.3, 0.85, -0.6], s: true },
  { p: [0.05, 1.68, -2.4], l: [0.5, 1.6, -30] },
  { p: [0.6, 1.75, -11], l: [1.4, 1.75, -40], s: true },
  { p: [-1.6, 1.95, -42], l: [7.5, 2.6, -64], s: true }, // toward the porches on the right
];
export const LAST = 2;

export function createWorld(canvas, { style = 'ink', panels = false, onReady } = {}) {
  const look = style === 'paper' ? paper : ink;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(DPR);
  let W = canvas.clientWidth || innerWidth, Hh = canvas.clientHeight || innerHeight;
  renderer.setSize(W, Hh, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMappingExposure = look.EXPOSURE;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(look.FOG.color, look.FOG.density);
  scene.background = new THREE.Color(look.FOG.color);
  const camera = new THREE.PerspectiveCamera(46, W / Hh, 0.05, 900);

  // sky, moon, stars
  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  skyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(look.SKY.top) }, uHor: { value: new THREE.Color(look.SKY.hor) } },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`uniform vec3 uTop, uHor; varying vec3 vDir;
      void main(){ float h = clamp(normalize(vDir).y, 0.0, 1.0); gl_FragColor = vec4(mix(uHor, uTop, pow(h, 0.55)), 1.0); }`,
  })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(10, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(look.NAME === 'paper' ? '#f4ecd8' : '#e6ecff').multiplyScalar(look.SKY.moon), fog: false }));
  moon.position.set(-70, 62, -330);
  scene.add(moon);
  if (look.NAME === 'paper') { // paper halo rings around the moon
    [[14, 0.25], [19, 0.12]].forEach(([r, o], i) => {
      const ring = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: '#c9d2ea', transparent: true, opacity: o, fog: false, depthWrite: false }));
      ring.position.copy(moon.position).add(new THREE.Vector3(0, 0, -1 - i));
      scene.add(ring);
    });
  }
  {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, y = 0.12 + Math.random() * 0.88, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 450, y * 450, Math.sin(a) * r * 450 - 60], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    skyGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#e6ebff', size: (look.NAME === 'paper' ? 2.2 : 1.5) * DPR, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false })));
  }

  // night light: sky fill and a moon that casts soft shadows around the camera
  scene.add(new THREE.HemisphereLight('#5466a0', '#14141c', look.NAME === 'paper' ? 1.0 : 0.75));
  const moonLight = new THREE.DirectionalLight('#9fb3e0', look.NAME === 'paper' ? 1.0 : 1.3);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  Object.assign(moonLight.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 160 });
  moonLight.shadow.bias = -0.0005;
  moonLight.shadow.radius = 4;
  scene.add(moonLight, moonLight.target);

  const H = buildWorld(scene, look.M, look.S);

  // rain: angled streaks in a box that follows the camera, kept out of the kitchen; plus splashes on the ground
  const rainU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(look.RAIN.color) }, uOp: { value: look.RAIN.opacity } };
  {
    const n = 2200, off = new Float32Array(n * 6), end = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const a = [Math.random(), Math.random(), Math.random()]; off.set([...a, ...a], i * 6); end[i * 2 + 1] = 1; }
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
          p.x = uCam.x + (fract(position.x - uCam.x / box.x) - 0.5) * box.x + (1.0 - fall) * 1.6; // wind: drops drift as they fall
          p.z = uCam.z - 5.0 + (fract(position.z - uCam.z / box.z) - 0.5) * box.z;
          p.y -= aEnd * 0.5; p.x -= aEnd * 0.09;
          bool indoors = abs(p.x) < 3.6 && p.z > -3.1 && p.z < 4.6 && p.y < 3.4;
          vA = indoors ? 0.0 : mix(0.15, 1.0, aEnd) * (0.5 + 0.5 * position.z);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`uniform vec3 uCol; uniform float uOp; varying float vA;
        void main(){ if (vA <= 0.0) discard; gl_FragColor = vec4(uCol, vA * uOp); }`,
    }));
    rain.frustumCulled = false;
    rain.layers.set(1);
    scene.add(rain);

    const sn = 260, seeds = new Float32Array(sn * 3);
    for (let i = 0; i < sn * 3; i++) seeds[i] = Math.random();
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
          vec2 r = fract(aSeed.xy + cyc * vec2(0.618, 0.382));           // a new spot every cycle
          vec3 c = vec3(uCam.x + (r.x - 0.5) * 22.0, 0.03, uCam.z - 4.0 - r.y * 22.0);
          c.y = abs(c.x) < 3.0 ? 0.025 : (abs(c.x) < 5.3 ? 0.155 : 0.03); // road, sidewalk, grass
          vIn = (abs(c.x) < 3.6 && c.z > -3.2) ? 0.0 : 1.0;
          float s = 0.05 + vLife * 0.2;
          gl_Position = projectionMatrix * viewMatrix * vec4(c + position * s, 1.0);
        }`,
      fragmentShader: /* glsl */`uniform vec3 uCol; uniform float uOp; varying vec2 vUv; varying float vLife; varying float vIn;
        void main(){ float d = length(vUv - 0.5) * 2.0; float ring = smoothstep(0.75, 0.88, d) * (1.0 - smoothstep(0.9, 1.0, d));
          float a = ring * (1.0 - vLife) * vIn * uOp * 0.8; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }`,
    }));
    splash.frustumCulled = false;
    splash.layers.set(1);
    scene.add(splash);
  }
  camera.layers.enable(1);

  // the letter
  const letter = createLetter();
  scene.add(letter.group);
  const TABLE_POS = new THREE.Vector3(0.32, 0.795, -0.42);
  const TABLE_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.22, 'XYZ'));
  const lt = { pos: TABLE_POS.clone(), vel: new THREE.Vector3(), q: TABLE_Q.clone() };

  const post = look.post(renderer, scene, camera, W, Hh);

  // camera curves
  const posCurve = new THREE.CatmullRomCurve3(STATIONS.map((s) => v3(s.p)), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(STATIONS.map((s) => v3(s.l)), false, 'centripetal');
  const stationT = STATIONS.map((s, i) => (s.s ? i / (STATIONS.length - 1) : -1)).filter((t) => t >= 0);
  const curveT = (u) => { const k = Math.min(Math.floor(u), LAST - 1), f = smooth(clamp(u - k)); return lerp(stationT[k], stationT[k + 1], f); };

  // letter placement per station: R/U in half-widths/heights of the view, S its scale
  const LAY = panels ? [[0.36, -0.05, 0.7], [0.36, -0.05, 0.7], [0.42, 0.2, 0.45]] : [[0.2, -0.1, 0.62], [0.22, -0.08, 0.62], [-0.28, 0.12, 0.42]];
  const OFF = panels ? [-0.2, -0.14, -0.14] : [0, 0, 0];

  const st = { target: 0, p: 0, v: 0, time: 0, ptrX: 0, ptrY: 0, sx: 0, sy: 0, wo: 0 };
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), camUp = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3();
  let then = performance.now(), ready = false, raf = 0;

  function updateCamera(dt) {
    // spring-damped progress: eases in and settles, never snaps
    const k = 16, c = 2 * Math.sqrt(k);
    if (reduce) { st.p = st.target; st.v = 0; } else { st.v += (k * (st.target - st.p) - c * st.v) * dt; st.p += st.v * dt; }
    const t = curveT(clamp(st.p, 0, LAST));
    posCurve.getPoint(t, camPos);
    lookCurve.getPoint(t, camLook);
    st.sx += (st.ptrX - st.sx) * (1 - Math.exp(-dt * 2));
    st.sy += (st.ptrY - st.sy) * (1 - Math.exp(-dt * 2));
    fwd.subVectors(camLook, camPos).normalize();
    right.crossVectors(fwd, UP).normalize();
    const T = st.time, hand = reduce ? 0 : 1, indoor = st.p < 0.5 ? 0.4 : 1;
    camPos.addScaledVector(right, (st.sx * 0.35 * indoor) + hand * (Math.sin(T * 0.71) + Math.sin(T * 1.33 + 1.7)) * 0.012)
      .addScaledVector(UP, st.sy * 0.18 * indoor + hand * (Math.sin(T * 0.53 + 0.4) + Math.sin(T * 1.17)) * 0.01);
    camera.position.copy(camPos);
    camera.up.set(hand * Math.sin(T * 0.37) * 0.006, 1, 0).normalize(); // a breath of roll, like a held camera
    camera.lookAt(camLook);
    const a = Math.min(Math.floor(st.p), LAST - 1), f = smooth(clamp(st.p - a));
    camera.setViewOffset(W, Hh, lerp(OFF[a], OFF[a + 1], f) * W, 0, W, Hh);
    camera.updateMatrixWorld();
    skyGroup.position.copy(camera.position);
    moonLight.position.copy(camera.position).add(tmpV.set(-30, 45, 10));
    moonLight.target.position.copy(camera.position).add(tmpV.set(0, 0, -12));
  }

  function updateLetter(dt) {
    const b = smooth(clamp((st.p - 0.06) / 0.8));
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const cf = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const a = Math.min(Math.floor(st.p), LAST - 1), f = smooth(clamp(st.p - a));
    const L = LAY[a].map((x, i) => lerp(x, LAY[a + 1][i], f));
    const F = 2.8, halfH = F * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * camera.aspect;
    const comp = camera.position.clone().addScaledVector(right, L[0] * halfW).addScaledVector(camUp, L[1] * halfH).addScaledVector(cf, F);
    const target = TABLE_POS.clone().lerp(comp, b);
    target.y += Math.sin(b * Math.PI) * 0.45;
    // spring follow: the letter lags a little and overshoots softly, like paper carried by air
    if (b < 0.02 || reduce) { lt.pos.copy(target); lt.vel.set(0, 0, 0); } else {
      const k = 34, c = 2 * Math.sqrt(k) * 0.55;
      lt.vel.addScaledVector(tmpV.subVectors(target, lt.pos).multiplyScalar(k).addScaledVector(lt.vel, -c), dt);
      lt.pos.addScaledVector(lt.vel, dt);
    }
    const side = lt.vel.dot(right), lift = lt.vel.dot(camUp);
    const sway = reduce ? 0 : 1, T = st.time;
    const compQ = camera.quaternion.clone().multiply(tmpQ.setFromEuler(tmpE.set(
      -0.14 + sway * (Math.sin(T * 1.1) * 0.05 - lift * 0.12), -0.35 + sway * Math.sin(T * 0.8) * 0.07, 0.06 - side * 0.25 * sway)));
    const goal = TABLE_Q.clone().slerp(compQ, b);
    lt.q.slerp(goal, b < 0.02 ? 1 : 1 - Math.exp(-dt * 7));
    letter.group.position.copy(lt.pos);
    letter.group.quaternion.copy(lt.q);
    letter.group.scale.setScalar(lerp(1, L[2], b));
    const speed = Math.abs(st.v);
    letter.update(dt, T, { flutter: b < 0.03 ? 0 : 0.05 + Math.min(0.28, speed * 0.35 + lt.vel.length() * 0.05), reduce });
    const night = smooth(clamp(st.p / 0.8));
    letter.uniforms.uKey.value.set(look.LETTER.key).lerp(new THREE.Color(look.LETTER.keyNight), night).multiplyScalar(look.NAME === 'paper' ? 0.75 : 0.55);
    letter.uniforms.uAmb.value.setScalar(look.LETTER.amb);
    post.focus(camera.position.distanceTo(lt.pos), dt);
  }

  function updateRoom(dt) {
    st.wo += ((reduce ? (st.p > 0.05 ? 1 : 0) : smooth(clamp(st.p / 0.4))) - st.wo) * (1 - Math.exp(-dt * 6));
    for (const s of H.sashes) s.pivot.rotation.y = -s.side * st.wo * 1.45 * (1 + (reduce ? 0 : Math.sin(st.time * 1.7 + s.side) * 0.03));
    // curtains: folds, and a billow into the room once the window opens
    const T = st.time;
    for (const c of H.curtains) {
      const p = c.mesh.geometry.attributes.position, b = c.base;
      for (let i = 0; i < p.count; i++) {
        const x = b[i * 3], y = b[i * 3 + 1];
        const down = clamp((1.0 - y) / 2.0); // 0 at the top, 1 at the hem
        const folds = Math.sin(x * 22 + c.side) * 0.035;
        const gust = reduce ? 0.5 : 0.65 + 0.35 * Math.sin(T * 2.1 + y * 2.6 + x * 3 + c.side);
        p.setXYZ(i, x + c.side * st.wo * down * 0.18 * gust, y + st.wo * down * down * 0.25 * gust, folds + st.wo * Math.pow(down, 1.4) * 0.75 * gust);
      }
      p.needsUpdate = true;
      c.mesh.geometry.computeVertexNormals();
    }
  }

  function frame(now) {
    const dt = Math.min((now - then) / 1000, 0.05);
    then = now;
    st.time += reduce ? dt * 0.3 : dt;
    updateCamera(dt);
    updateRoom(dt);
    updateLetter(dt);
    rainU.uTime.value = st.time;
    rainU.uCam.value.copy(camera.position);
    post.render(dt, st.time);
    if (!ready) { ready = true; onReady?.(); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setTarget(p) { st.target = clamp(p, 0, LAST); },
    setPointer(x, y) { st.ptrX = x; st.ptrY = y; },
    flip(on) { letter.setFlip(on); },
    resize() {
      W = canvas.clientWidth; Hh = canvas.clientHeight;
      renderer.setSize(W, Hh, false);
      camera.aspect = W / Hh;
      camera.updateProjectionMatrix();
      post.resize(W, Hh);
    },
    get progress() { return st.p; },
    debug: { renderer, scene, camera, letter, st },
    stop() { cancelAnimationFrame(raf); },
  };
}
