/* First Light R3: building blocks for the paper world (D220). Grown from the R2 style test's build.js and
   split into pieces so the full road (kitchen → door) can be laid out by world.js. All procedural. */
import * as THREE from 'three';

export const V2 = (x, y) => new THREE.Vector2(x, y);
export const ROAD = { half: 3, curb: 0.3, walk: 2 };
export const COLORS = {
  wall: '#c9b79c', wainscot: '#7f6650', trim: '#ece3d1', floorA: '#7a5a40', floorB: '#6c4f39',
  wood: '#8a603f', woodDark: '#5a3f2e', counter: '#d9d1c1', cabinet: '#5f7568', shade: '#3e5a4c',
  mug: '#9c3a36', bills: '#ece5d4', curtain: '#c4ad86', metal: '#4a4d52', jar: '#b9c9c4', plate: '#e8e1d2',
  grass: '#3b5444', road: '#363a42', curb: '#9b968b', walk: '#8c877d', fence: '#e6ddca',
  roofA: '#4a4e5a', roofB: '#5b3f37', doorA: '#5b3a3a', doorB: '#2f4a5a', pole: '#3c3834', lamp: '#2b2d31',
  car: '#7c3030', tire: '#1d1d21', hydrant: '#a8362f', mail: '#3a4a6a', brick: '#6b4a3c', stone: '#8c8a86',
  firmDoor: '#2f4a3e', step: '#cfc6b4', sign: '#d8cfbd',
  house: ['#b7c3cb', '#d6c6a4', '#9fb09f', '#c8a898', '#a9b7c6', '#d2bfa8'],
  hill: ['#2c3a55', '#3a4a66', '#4e5d79'],
};

export function makeRng(seed = 20261125) {
  let s = seed;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { rand, rnd: (a, b) => a + rand() * (b - a), pick: (a) => a[(rand() * a.length) | 0] };
}

export function createBuilder(scene, M, S, rng) {
  const { rand, rnd } = rng;
  const jit = (o) => { if (S.jitter) { o.rotation.z += (rand() - 0.5) * S.jitter; o.rotation.x += (rand() - 0.5) * S.jitter * 0.5; } return o; };
  const mat = (m) => (typeof m === 'string' ? M(m) : m);
  const mesh = (geo, m, parent = scene, shadow = true) => {
    const o = new THREE.Mesh(geo, mat(m));
    o.castShadow = shadow; o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (w, h, d, x, y, z, m, parent = scene, shadow = true) => { const o = mesh(new THREE.BoxGeometry(w, h, d), m, parent, shadow); o.position.set(x, y, z); return o; };
  const cyl = (r0, r1, h, x, y, z, m, parent = scene, seg = 14) => { const o = mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m, parent); o.position.set(x, y, z); return o; };
  const lathe = (pts, m, parent = scene, seg = 20) => mesh(new THREE.LatheGeometry(pts.map(([a, b]) => V2(a, b)), seg), m, parent);

  // ---------- 0 · the kitchen (interior x ±3.5, z −3..4.5) ----------
  function kitchen() {
    const K = new THREE.Group();
    scene.add(K);
    const H = { sashes: [], curtains: [] };
    for (let i = 0; i < 14; i++) box(0.5, 0.04, 7.5, -3.25 + i * 0.5, 0.0, 0.75, i % 2 ? 'floorA' : 'floorB', K, false);
    box(2.4, 3.2, 0.2, -2.3, 1.6, -3, 'wall', K); box(2.4, 3.2, 0.2, 2.3, 1.6, -3, 'wall', K);
    box(2.2, 0.95, 0.2, 0, 0.475, -3, 'wall', K); box(2.2, 0.75, 0.2, 0, 2.825, -3, 'wall', K);
    box(0.2, 3.2, 7.5, -3.5, 1.6, 0.75, 'wall', K); box(0.2, 3.2, 7.5, 3.5, 1.6, 0.75, 'wall', K);
    box(7.2, 0.2, 7.5, 0, 3.3, 0.75, 'wall', K, false);
    for (const [w, d, x, z] of [[6.8, 0.04, 0, -2.88], [0.04, 7.3, -3.38, 0.75], [0.04, 7.3, 3.38, 0.75]]) {
      box(w, 0.9, d, x, 0.45, z, 'wainscot', K, false);
      box(w + (d > 1 ? 0 : 0.02), 0.06, d + (d > 1 ? 0 : 0.02), x, 0.92, z, 'trim', K, false);
    }
    box(2.4, 0.1, 0.32, 0, 0.93, -2.86, 'trim', K); box(2.36, 0.08, 0.2, 0, 2.47, -2.92, 'trim', K);
    box(0.08, 1.56, 0.2, -1.14, 1.7, -2.92, 'trim', K); box(0.08, 1.56, 0.2, 1.14, 1.7, -2.92, 'trim', K);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.1, 0.95, -3.03);
      const dir = -side, frame = M('trim');
      const s = (w, h, x, y) => { const m = mesh(new THREE.BoxGeometry(w, h, 0.05), frame, pivot); m.position.set(x, y, 0); };
      s(0.06, 1.5, dir * 0.03, 0.75); s(0.06, 1.5, dir * 1.07, 0.75); s(1.1, 0.06, dir * 0.55, 0.03); s(1.1, 0.06, dir * 0.55, 1.47);
      s(1.1, 0.035, dir * 0.55, 0.75); s(0.035, 1.5, dir * 0.55, 0.75);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), M('glass'));
      glass.position.set(dir * 0.55, 0.75, 0);
      pivot.add(glass);
      K.add(pivot);
      H.sashes.push({ pivot, side });
    }
    for (const side of [-1, 1]) {
      const g = new THREE.PlaneGeometry(0.75, 2.0, 18, 12);
      const m = mesh(g, M('curtain', { side: THREE.DoubleSide }), K);
      m.position.set(side * 1.45, 1.62, -2.78);
      H.curtains.push({ mesh: m, base: Float32Array.from(g.attributes.position.array), side });
    }
    box(3.6, 0.04, 0.04, 0, 2.66, -2.76, 'metal', K);
    box(1.9, 0.06, 1.15, 0.2, 0.76, -0.5, 'wood', K);
    box(1.8, 0.1, 1.05, 0.2, 0.68, -0.5, 'woodDark', K);
    for (const [x, z] of [[-0.62, -0.95], [1.02, -0.95], [-0.62, -0.05], [1.02, -0.05]]) {
      lathe([[0.001, 0], [0.035, 0], [0.04, 0.1], [0.028, 0.3], [0.045, 0.45], [0.03, 0.6], [0.04, 0.7], [0.001, 0.72]], 'woodDark', K, 10).position.set(x, 0, z);
    }
    {
      const c = new THREE.Group();
      c.position.set(1.35, 0, 0.35); c.rotation.y = -0.5;
      K.add(c);
      box(0.46, 0.05, 0.44, 0, 0.46, 0, 'wood', c);
      for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) box(0.04, 0.46, 0.04, x, 0.23, z, 'woodDark', c);
      for (const x of [-0.2, 0.2]) box(0.04, 0.55, 0.04, x, 0.74, 0.2, 'woodDark', c);
      for (const y of [0.72, 0.86, 0.98]) box(0.44, 0.05, 0.03, 0, y, 0.2, 'wood', c);
    }
    lathe([[0.001, 0], [0.045, 0], [0.05, 0.02], [0.05, 0.1], [0.046, 0.1], [0.046, 0.012], [0.001, 0.012]], 'mug', K).position.set(-0.38, 0.79, -0.78);
    const handle = mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI), 'mug', K);
    handle.position.set(-0.33, 0.845, -0.78); handle.rotation.z = -Math.PI / 2;
    box(0.3, 0.008, 0.42, -0.42, 0.794, -0.3, 'bills', K).rotation.y = 0.35;
    box(0.3, 0.008, 0.42, -0.36, 0.803, -0.33, 'bills', K).rotation.y = -0.12;
    cyl(0.006, 0.006, 0.15, 0.75, 0.8, -0.62, 'metal', K, 6).rotation.set(Math.PI / 2, 0, 0.9);
    cyl(0.006, 0.006, 0.8, 0.2, 2.82, -0.5, 'metal', K, 5);
    lathe([[0.03, 0.3], [0.05, 0.28], [0.12, 0.18], [0.27, 0.02], [0.3, 0.0]], M('shade', { side: THREE.DoubleSide }), K, 28).position.set(0.2, 2.12, -0.5);
    mesh(new THREE.SphereGeometry(0.055, 14, 8), M('bulb'), K, false).position.set(0.2, 2.16, -0.5);
    for (let i = 0; i < 4; i++) {
      const z = -2.45 + i * 0.62;
      box(0.62, 0.86, 0.6, 3.08, 0.43, z, 'cabinet', K);
      box(0.02, 0.6, 0.48, 2.76, 0.42, z, 'trim', K, false);
    }
    box(0.7, 0.05, 2.6, 3.05, 0.885, -1.52, 'counter', K);
    lathe([[0.001, 0], [0.1, 0], [0.11, 0.06], [0.1, 0.16], [0.06, 0.22], [0.02, 0.24], [0.001, 0.24]], 'metal', K).position.set(3.0, 0.91, -1.0);
    box(0.24, 0.04, 1.6, -3.26, 1.7, -1.0, 'wood', K);
    for (let i = 0; i < 4; i++) { const hgt = rnd(0.14, 0.24); cyl(0.06, 0.06, hgt, -3.26, 1.72 + hgt / 2, -1.6 + i * 0.32, 'jar', K, 12); }
    for (let i = 0; i < 3; i++) { const p = cyl(0.12, 0.12, 0.015, -3.3, 1.86, -0.55 + i * 0.03, 'plate', K, 20); p.rotation.set(Math.PI / 2, Math.PI / 2, 0); }
    cyl(0.2, 0.2, 0.04, -3.37, 2.4, 0.4, 'trim', K, 32).rotation.z = Math.PI / 2;
    const hand = (len, ang) => { const h = box(0.012, len, 0.012, -3.34, 2.4, 0.4, 'woodDark', K, false); h.geometry.translate(0, len / 2, 0); h.rotation.x = ang; };
    hand(0.1, -Math.PI * 2 * (2 / 12 + 10 / 720)); hand(0.15, -Math.PI * 2 * (10 / 60));
    const spot = new THREE.SpotLight('#ffc78e', 26, 12, 1.25, 0.9, 2);
    spot.position.set(0.2, 2.15, -0.5);
    spot.target.position.set(0.2, 0, -0.5);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0008;
    K.add(spot, spot.target);
    const fill = new THREE.PointLight('#ffb977', 2.2, 7, 2);
    fill.position.set(0.2, 2.6, 0.6);
    K.add(fill);
    return H;
  }

  // ---------- road: asphalt, curbs, sidewalks and dashes along straight segments [z0, z1] (z0 > z1) ----------
  function road(segments, gaps = []) {
    const inGap = (z) => gaps.some(([a, b]) => z < a && z > b);
    for (const [z0, z1] of segments) {
      const len = z0 - z1, zc = (z0 + z1) / 2;
      box(ROAD.half * 2, 0.02, len, 0, 0.0, zc, 'road', scene, false);
      // curbs and walks, broken where a cross street passes
      let cuts = [z0, ...gaps.flat().filter((z) => z < z0 && z > z1).sort((a, b) => b - a), z1];
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1];
        if (inGap((a + b) / 2) || a - b < 0.5) continue;
        for (const s of [-1, 1]) {
          box(ROAD.curb, 0.15, a - b, s * (ROAD.half + ROAD.curb / 2), 0.075, (a + b) / 2, 'curb', scene, false);
          box(ROAD.walk, 0.12, a - b, s * (ROAD.half + ROAD.curb + ROAD.walk / 2), 0.06, (a + b) / 2, 'walk', scene, false);
        }
      }
      const n = Math.floor(len / 3) - 1, dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.012, 1.6), M('fence'), Math.max(n, 1));
      let k = 0;
      for (let i = 0; i < n; i++) { const z = z0 - 2 - i * 3; if (!inGap(z)) dash.setMatrixAt(k++, new THREE.Matrix4().makeTranslation(0, 0.012, z)); }
      dash.count = k;
      dash.receiveShadow = true;
      scene.add(dash);
    }
  }
  function crossStreet(z, half = 70) {
    box(half * 2, 0.022, ROAD.half * 2, 0, 0.0, z, 'road', scene, false);
    for (const s of [-1, 1]) for (const side of [-1, 1]) {
      const x0 = ROAD.half + ROAD.curb + ROAD.walk, len = half - x0;
      box(len, 0.12, ROAD.walk, side * (x0 + len / 2), 0.06, z + s * (ROAD.half + ROAD.curb + ROAD.walk / 2), 'walk', scene, false);
    }
  }
  function puddles(list) {
    for (const [x, z, w, d] of list) {
      const p = mesh(new THREE.CircleGeometry(0.5, 28).rotateX(-Math.PI / 2), 'puddle', scene, false);
      p.position.set(x, 0.022, z); p.scale.set(w, 1, d);
    }
  }

  // ---------- a gabled house facing the road; porch houses get their own light switch ----------
  function house(z, side, i, { porch = false, setback = 11 } = {}) {
    const w = rnd(6.4, 7.8), d = rnd(6.5, 8), h = rnd(3.2, 3.8), rh = rnd(2.0, 2.8);
    const g = new THREE.Group();
    g.position.set(side * (setback + d / 2), 0, z);
    g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(g);
    const shape = new THREE.Shape([V2(-w / 2, 0), V2(w / 2, 0), V2(w / 2, h), V2(0, h + rh), V2(-w / 2, h)]);
    const body = mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }), M('house', { color: COLORS.house[i % COLORS.house.length] }), g);
    body.position.z = -d / 2;
    jit(body);
    const roofMat = M(i % 2 ? 'roofA' : 'roofB');
    const slope = Math.hypot(w / 2, rh), ang = Math.atan2(rh, w / 2);
    for (const s of [-1, 1]) {
      const r = box(slope + 0.5, 0.14, d + 0.6, 0, 0, 0, roofMat, g);
      r.rotation.z = -s * ang;
      r.position.set(s * (w / 4) + s * Math.sin(ang) * 0.08, h + rh / 2 + Math.cos(ang) * 0.08, 0);
    }
    jit(box(0.6, 1.8, 0.6, -w * 0.22, h + rh * 0.6, -d * 0.2, roofMat, g));
    const fz = d / 2;
    const switchable = []; // materials that light up with the porch
    const win = (x, y, ww, wh, on) => {
      box(ww + 0.16, wh + 0.16, 0.08, x, y, fz + 0.03, 'trim', g, false);
      const m = porch ? S.windowMat() : on ? S.litWindow : S.dimWindow;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), m);
      pane.position.set(x, y, fz + 0.085);
      g.add(pane);
      if (porch) switchable.push(m);
      box(ww, 0.04, 0.04, x, y, fz + 0.09, 'trim', g, false); box(0.04, wh, 0.04, x, y, fz + 0.09, 'trim', g, false);
      box(ww + 0.3, 0.06, 0.18, x, y - wh / 2 - 0.1, fz + 0.1, 'trim', g, false);
    };
    const doorX = rand() < 0.5 ? -w * 0.22 : w * 0.22;
    win(-doorX, 1.45, 1.2, 1.3, rand() < 0.55);
    win(0, h + rh * 0.32, 0.8, 0.9, rand() < 0.35);
    box(0.95, 2.05, 0.08, doorX, 1.03, fz + 0.04, rand() < 0.5 ? 'doorA' : 'doorB', g);
    box(1.15, 0.08, 0.1, doorX, 2.1, fz + 0.06, 'trim', g, false);
    const pw = w * 0.5, px = doorX * 0.6;
    box(pw, 0.28, 1.7, px, 0.14, fz + 0.85, 'walk', g);
    box(1.1, 0.14, 0.4, doorX, 0.07, fz + 1.9, 'walk', g);
    for (const cx of [px - pw / 2 + 0.15, px + pw / 2 - 0.15]) cyl(0.07, 0.08, 2.3, cx, 1.43, fz + 1.55, 'trim', g, 10);
    box(pw + 0.3, 0.1, 1.95, px, 2.62, fz + 0.9, roofMat, g).rotation.x = 0.08;
    const porchMat = porch ? S.lampMat() : rand() < 0.5 ? S.lampGlass : M('lamp');
    box(0.12, 0.18, 0.1, doorX + 0.7, 2.05, fz + 0.1, porchMat, g, false);
    if (porch) switchable.push(porchMat);
    const fence = new THREE.Group();
    g.add(fence);
    const fenceZ = fz + 2.6;
    for (let x = -w / 2 - 1.5; x <= w / 2 + 1.5; x += 0.32) if (Math.abs(x - doorX) >= 0.7) jit(box(0.08, 0.95, 0.04, x, 0.47, fenceZ, 'fence', fence, true));
    for (const y of [0.35, 0.75]) for (const [a, b] of [[-w / 2 - 1.5, doorX - 0.7], [doorX + 0.7, w / 2 + 1.5]]) box(b - a, 0.06, 0.03, (a + b) / 2, y, fenceZ - 0.03, 'fence', fence, false);
    // the porch light's world position (for a real light) and the house footprint (to keep trees off it)
    const bulb = new THREE.Vector3(doorX + 0.7, 2.05, fz + 0.6).applyMatrix4(g.updateMatrixWorld() || g.matrixWorld);
    return { group: g, z, x: g.position.x, w, d, switchable, bulb, on: 0, flick: 0 };
  }

  // ---------- street furniture ----------
  function lamp(x, z) {
    const post = lathe([[0.001, 0], [0.16, 0], [0.16, 0.25], [0.09, 0.4], [0.06, 0.6], [0.05, 3.6], [0.08, 3.7], [0.08, 3.8], [0.001, 3.8]], 'lamp', scene, 12);
    post.position.set(x, 0.12, z);
    const lantern = new THREE.Group();
    lantern.position.set(x, 3.92, z);
    scene.add(lantern);
    const glass = mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.42, 6), S.lampGlass, lantern, false);
    glass.position.y = 0.21;
    mesh(new THREE.ConeGeometry(0.3, 0.22, 6), 'lamp', lantern).position.y = 0.53;
    return new THREE.Vector3(x, 4.05, z);
  }
  function poles(z0, z1, x) {
    const tops = [];
    for (let z = z0; z > z1; z -= 17) {
      cyl(0.11, 0.14, 8, x, 4, z, 'pole', scene, 8);
      box(1.8, 0.1, 0.1, x, 7.4, z, 'pole');
      tops.push(z);
    }
    for (let i = 0; i < tops.length - 1; i++) {
      for (const dx of [-0.75, 0, 0.75]) {
        const a = new THREE.Vector3(x + dx, 7.5, tops[i]), b = new THREE.Vector3(x + dx, 7.5, tops[i + 1]);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.7;
        mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.012, 4), 'wire', scene, false);
      }
    }
  }
  function car(x, z, color = 'car') {
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    c.rotation.y = Math.PI / 2;
    scene.add(c);
    const prof = new THREE.Shape([V2(-2.1, 0.35), V2(2.1, 0.35), V2(2.18, 0.78), V2(1.25, 0.92), V2(0.62, 1.42), V2(-0.92, 1.44), V2(-1.6, 0.95), V2(-2.16, 0.86)]);
    const bodyG = new THREE.ExtrudeGeometry(prof, { depth: 1.66, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    bodyG.translate(0, 0, -0.83);
    mesh(bodyG, color, c);
    const winShape = new THREE.Shape([V2(1.12, 0.95), V2(0.58, 1.36), V2(-0.86, 1.38), V2(-1.45, 0.97)]);
    for (const zz of [0.885, -0.885]) { const wm = new THREE.Mesh(new THREE.ShapeGeometry(winShape), M('carGlass', { side: THREE.DoubleSide })); wm.position.z = zz; c.add(wm); }
    for (const [wx, zz] of [[1.35, 0.8], [-1.35, 0.8], [1.35, -0.8], [-1.35, -0.8]]) cyl(0.34, 0.34, 0.24, wx, 0.34, zz, 'tire', c, 16).rotation.x = Math.PI / 2;
  }
  function hydrant(x, z) { lathe([[0.001, 0], [0.14, 0], [0.14, 0.08], [0.1, 0.1], [0.1, 0.5], [0.13, 0.55], [0.08, 0.68], [0.001, 0.72]], 'hydrant', scene, 12).position.set(x, 0.12, z); }
  function mailbox(x, z) { cyl(0.03, 0.03, 1.1, x, 0.6, z, 'pole', scene, 6); box(0.5, 0.32, 0.25, x, 1.25, z, 'mail', scene); }
  function hills() {
    COLORS.hill.forEach((c, i) => {
      const pts = [V2(-320, -5)], amp = 9 + i * 7;
      for (let x = -320; x <= 320; x += 12) pts.push(V2(x, amp * (0.55 + 0.45 * Math.sin(x * 0.012 + i * 2.1) * Math.cos(x * 0.031 + i)) + rnd(-0.6, 0.6)));
      pts.push(V2(320, -5));
      const m = mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.5, bevelEnabled: false }), M('hill', { color: c }), scene, false);
      m.position.set(0, 0, -420 - i * 50);
    });
  }

  return { kitchen, road, crossStreet, puddles, house, lamp, poles, car, hydrant, mailbox, hills, box, cyl, lathe, mesh, jit };
}
