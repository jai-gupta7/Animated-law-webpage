/* First Light R2: the shared world for the style test (scene 0 kitchen, scene 1 street, and the view further down).
   Geometry and layout are identical for both looks; each look supplies its own materials (M) and a few
   look-specific builders (S.tree, S.cloud). Everything is procedural: no downloaded assets. */
import * as THREE from 'three';

export const V2 = (x, y) => new THREE.Vector2(x, y);
export const ROAD = { half: 3, curb: 0.3, walk: 2 }; // the road runs straight along −z at x = 0

// colour roles shared by both looks (each look turns them into its own material)
export const COLORS = {
  wall: '#c9b79c', wainscot: '#7f6650', trim: '#ece3d1', floorA: '#7a5a40', floorB: '#6c4f39',
  wood: '#8a603f', woodDark: '#5a3f2e', counter: '#d9d1c1', cabinet: '#5f7568', shade: '#3e5a4c',
  mug: '#9c3a36', bills: '#ece5d4', curtain: '#c4ad86', metal: '#4a4d52', jar: '#b9c9c4', plate: '#e8e1d2',
  grass: '#3b5444', road: '#363a42', curb: '#9b968b', walk: '#8c877d', fence: '#e6ddca',
  roofA: '#4a4e5a', roofB: '#5b3f37', doorA: '#5b3a3a', doorB: '#2f4a5a', pole: '#3c3834', lamp: '#2b2d31',
  car: '#7c3030', tire: '#1d1d21', hydrant: '#a8362f', mail: '#3a4a6a', sign: '#d8cfbd',
  house: ['#b7c3cb', '#d6c6a4', '#9fb09f', '#c8a898', '#a9b7c6', '#d2bfa8'],
  hill: ['#2c3a55', '#3a4a66', '#4e5d79'],
};

export function makeRng(seed = 20261124) {
  let s = seed;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { rand, rnd: (a, b) => a + rand() * (b - a), pick: (a) => a[(rand() * a.length) | 0] };
}

/**
 * Builds the world into `scene`.
 * M(role, opts) → material. S = { tree(x, z, h, rng), cloud(x, y, z, w, rng), jitter, litWindow, dimWindow, lampGlass }.
 * Returns handles the frame loop animates.
 */
export function buildWorld(scene, M, S) {
  const { rand, rnd, pick } = makeRng();
  const jit = (o) => { if (S.jitter) { o.rotation.z += (rand() - 0.5) * S.jitter; o.rotation.x += (rand() - 0.5) * S.jitter * 0.5; } return o; };
  const mesh = (geo, mat, parent = scene, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, x, y, z, mat, parent = scene, shadow = true) => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), typeof mat === 'string' ? M(mat) : mat, parent, shadow);
    m.position.set(x, y, z);
    return m;
  };
  const cyl = (r0, r1, h, x, y, z, mat, parent = scene, seg = 14) => {
    const m = mesh(new THREE.CylinderGeometry(r0, r1, h, seg), typeof mat === 'string' ? M(mat) : mat, parent);
    m.position.set(x, y, z);
    return m;
  };
  const lathe = (pts, mat, parent = scene, seg = 20) => mesh(new THREE.LatheGeometry(pts.map(([a, b]) => V2(a, b)), seg), typeof mat === 'string' ? M(mat) : mat, parent);
  const H = { lights: [], sashes: [], curtains: [], lampSpots: [], wo: 0 };

  // ---------------- 0 · the kitchen (interior x ±3.5, z −3..4.5, ceiling 3.2) ----------------
  const K = new THREE.Group();
  scene.add(K);
  {
    // floor planks
    for (let i = 0; i < 14; i++) box(0.5, 0.04, 7.5, -3.25 + i * 0.5, 0.0, 0.75, i % 2 ? 'floorA' : 'floorB', K, false);
    // walls with the window opening (x −1.1..1.1, y 0.95..2.45) in the back wall at z −3
    box(2.4, 3.2, 0.2, -2.3, 1.6, -3, 'wall', K); box(2.4, 3.2, 0.2, 2.3, 1.6, -3, 'wall', K);
    box(2.2, 0.95, 0.2, 0, 0.475, -3, 'wall', K); box(2.2, 0.75, 0.2, 0, 2.825, -3, 'wall', K);
    box(0.2, 3.2, 7.5, -3.5, 1.6, 0.75, 'wall', K); box(0.2, 3.2, 7.5, 3.5, 1.6, 0.75, 'wall', K);
    box(7.2, 0.2, 7.5, 0, 3.3, 0.75, 'wall', K, false);
    // wainscot, rail and skirting on the three walls
    for (const [w, d, x, z] of [[6.8, 0.04, 0, -2.88], [0.04, 7.3, -3.38, 0.75], [0.04, 7.3, 3.38, 0.75]]) {
      box(w, 0.9, d, x, 0.45, z, 'wainscot', K, false);
      box(w + (d > 1 ? 0 : 0.02), 0.06, d + (d > 1 ? 0 : 0.02), x, 0.92, z, 'trim', K, false);
    }
    // window: frame, sill, two casement sashes with 2×2 panes (they swing outward)
    box(2.4, 0.1, 0.32, 0, 0.93, -2.86, 'trim', K); box(2.36, 0.08, 0.2, 0, 2.47, -2.92, 'trim', K);
    box(0.08, 1.56, 0.2, -1.14, 1.7, -2.92, 'trim', K); box(0.08, 1.56, 0.2, 1.14, 1.7, -2.92, 'trim', K);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 1.1, 0.95, -3.03);
      const dir = -side;
      const frame = M('trim');
      const s = (w, h, x, y) => { const m = mesh(new THREE.BoxGeometry(w, h, 0.05), frame, pivot); m.position.set(x, y, 0); };
      s(0.06, 1.5, dir * 0.03, 0.75); s(0.06, 1.5, dir * 1.07, 0.75); s(1.1, 0.06, dir * 0.55, 0.03); s(1.1, 0.06, dir * 0.55, 1.47);
      s(1.1, 0.035, dir * 0.55, 0.75); s(0.035, 1.5, dir * 0.55, 0.75);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), M('glass'));
      glass.position.set(dir * 0.55, 0.75, 0);
      pivot.add(glass);
      K.add(pivot);
      H.sashes.push({ pivot, side });
    }
    // curtains: cloth the draught blows into the room
    for (const side of [-1, 1]) {
      const g = new THREE.PlaneGeometry(0.75, 2.0, 18, 12);
      const m = mesh(g, M('curtain', { side: THREE.DoubleSide }), K);
      m.position.set(side * 1.45, 1.62, -2.78);
      H.curtains.push({ mesh: m, base: Float32Array.from(g.attributes.position.array), side });
    }
    box(3.6, 0.04, 0.04, 0, 2.66, -2.76, 'metal', K); // curtain rail
    // table, chair, things on the table
    box(1.9, 0.06, 1.15, 0.2, 0.76, -0.5, 'wood', K);
    box(1.8, 0.1, 1.05, 0.2, 0.68, -0.5, 'woodDark', K);
    for (const [x, z] of [[-0.62, -0.95], [1.02, -0.95], [-0.62, -0.05], [1.02, -0.05]]) {
      const leg = lathe([[0.001, 0], [0.035, 0], [0.04, 0.1], [0.028, 0.3], [0.045, 0.45], [0.03, 0.6], [0.04, 0.7], [0.001, 0.72]], 'woodDark', K, 10);
      leg.position.set(x, 0, z);
    }
    { // chair pulled out, facing the table
      const c = new THREE.Group();
      c.position.set(1.35, 0, 0.35); c.rotation.y = -0.5;
      K.add(c);
      box(0.46, 0.05, 0.44, 0, 0.46, 0, 'wood', c);
      for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) box(0.04, 0.46, 0.04, x, 0.23, z, 'woodDark', c);
      for (const x of [-0.2, 0.2]) box(0.04, 0.55, 0.04, x, 0.74, 0.2, 'woodDark', c);
      for (const y of [0.72, 0.86, 0.98]) box(0.44, 0.05, 0.03, 0, y, 0.2, 'wood', c);
    }
    const mug = lathe([[0.001, 0], [0.045, 0], [0.05, 0.02], [0.05, 0.1], [0.046, 0.1], [0.046, 0.012], [0.001, 0.012]], 'mug', K);
    mug.position.set(-0.38, 0.79, -0.78);
    const handle = mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI), M('mug'), K);
    handle.position.set(-0.33, 0.845, -0.78); handle.rotation.z = -Math.PI / 2;
    box(0.3, 0.008, 0.42, -0.42, 0.794, -0.3, 'bills', K).rotation.y = 0.35;
    box(0.3, 0.008, 0.42, -0.36, 0.803, -0.33, 'bills', K).rotation.y = -0.12;
    const pen = cyl(0.006, 0.006, 0.15, 0.75, 0.8, -0.62, 'metal', K, 6);
    pen.rotation.set(Math.PI / 2, 0, 0.9);
    // pendant lamp
    cyl(0.006, 0.006, 0.8, 0.2, 2.82, -0.5, 'metal', K, 5);
    const shade = lathe([[0.03, 0.3], [0.05, 0.28], [0.12, 0.18], [0.27, 0.02], [0.3, 0.0]], M('shade', { side: THREE.DoubleSide }), K, 28);
    shade.position.set(0.2, 2.12, -0.5);
    const bulb = mesh(new THREE.SphereGeometry(0.055, 14, 8), M('bulb'), K, false);
    bulb.position.set(0.2, 2.16, -0.5);
    // counter run on the right wall, with a kettle
    for (let i = 0; i < 4; i++) {
      const z = -2.45 + i * 0.62;
      box(0.62, 0.86, 0.6, 3.08, 0.43, z, 'cabinet', K);
      box(0.02, 0.6, 0.48, 2.76, 0.42, z, 'trim', K, false);
    }
    box(0.7, 0.05, 2.6, 3.05, 0.885, -1.52, 'counter', K);
    const kettle = lathe([[0.001, 0], [0.1, 0], [0.11, 0.06], [0.1, 0.16], [0.06, 0.22], [0.02, 0.24], [0.001, 0.24]], 'metal', K);
    kettle.position.set(3.0, 0.91, -1.0);
    // shelf with jars and plates on the left wall, and a clock at ten past two
    box(0.24, 0.04, 1.6, -3.26, 1.7, -1.0, 'wood', K);
    for (let i = 0; i < 4; i++) {
      const j = cyl(0.06, 0.06, rnd(0.14, 0.24), -3.26, 1.8, -1.6 + i * 0.32, 'jar', K, 12);
      j.position.y = 1.72 + j.geometry.parameters.height / 2;
    }
    for (let i = 0; i < 3; i++) { const p = cyl(0.12, 0.12, 0.015, -3.3, 1.86, -0.55 + i * 0.03, 'plate', K, 20); p.rotation.x = Math.PI / 2; p.rotation.y = Math.PI / 2; }
    const clock = cyl(0.2, 0.2, 0.04, -3.37, 2.4, 0.4, 'trim', K, 32);
    clock.rotation.z = Math.PI / 2;
    const hand = (len, ang) => { const h = box(0.012, len, 0.012, -3.34, 2.4, 0.4, 'woodDark', K, false); h.geometry.translate(0, len / 2, 0); h.position.set(-3.34, 2.4, 0.4); h.rotation.x = ang; };
    hand(0.1, -Math.PI * 2 * (2 / 12 + 10 / 720)); hand(0.15, -Math.PI * 2 * (10 / 60));
    // the room's light: the pendant (a spot, so it can cast one soft shadow) plus a little fill
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
    H.kitchen = { spot, fill, bulb };
  }

  // ---------------- 1 · the street ----------------
  const Z0 = -4, Z1 = -95;
  { // ground, road, curbs, sidewalks
    const ground = mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), M('grass'), scene, false);
    ground.position.set(0, -0.01, -150);
    const len = Z0 - Z1;
    box(ROAD.half * 2, 0.02, len, 0, 0.0, (Z0 + Z1) / 2, 'road', scene, false);
    for (const s of [-1, 1]) {
      box(ROAD.curb, 0.15, len, s * (ROAD.half + ROAD.curb / 2), 0.075, (Z0 + Z1) / 2, 'curb', scene, false);
      box(ROAD.walk, 0.12, len, s * (ROAD.half + ROAD.curb + ROAD.walk / 2), 0.06, (Z0 + Z1) / 2, 'walk', scene, false);
    }
    // centre dashes
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.012, 1.6), M('fence'), 30);
    for (let i = 0; i < 30; i++) dash.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, 0.012, -7 - i * 3));
    dash.receiveShadow = true;
    scene.add(dash);
    // puddles on the road
    for (const [x, z, w, d] of [[1.2, -13, 1.6, 0.9], [-1.5, -21, 2.2, 1.1], [0.6, -34, 1.3, 0.7], [-0.8, -47, 1.8, 0.8]]) {
      const p = mesh(new THREE.CircleGeometry(0.5, 28).rotateX(-Math.PI / 2), M('puddle'), scene, false);
      p.position.set(x, 0.022, z); p.scale.set(w, 1, d);
    }
  }

  // houses with gabled roofs, porches and lit windows
  const lit = [];
  const houseAt = (z, side, i) => {
    const w = rnd(6.4, 7.8), d = rnd(6.5, 8), h = rnd(3.2, 3.8), rh = rnd(2.0, 2.8);
    const g = new THREE.Group();
    g.position.set(side * (11 + d / 2), 0, z);
    g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // local +z (the front) faces the road
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
    const ch = box(0.6, 1.8, 0.6, -w * 0.22, h + rh * 0.6, -d * 0.2, roofMat, g);
    jit(ch);
    // front face (local z = d/2): windows, door, porch
    const fz = d / 2;
    const win = (x, y, ww, wh, on) => {
      box(ww + 0.16, wh + 0.16, 0.08, x, y, fz + 0.03, 'trim', g, false);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), on ? S.litWindow : S.dimWindow);
      pane.position.set(x, y, fz + 0.075);
      g.add(pane);
      box(ww, 0.04, 0.04, x, y, fz + 0.09, 'trim', g, false); box(0.04, wh, 0.04, x, y, fz + 0.09, 'trim', g, false);
      box(ww + 0.3, 0.06, 0.18, x, y - wh / 2 - 0.1, fz + 0.1, 'trim', g, false); // sill
      if (on) lit.push(pane);
    };
    const doorX = rand() < 0.5 ? -w * 0.22 : w * 0.22;
    win(-doorX, 1.45, 1.2, 1.3, rand() < 0.55);
    win(0, h + rh * 0.32, 0.8, 0.9, rand() < 0.35);
    box(0.95, 2.05, 0.08, doorX, 1.03, fz + 0.04, rand() < 0.5 ? 'doorA' : 'doorB', g);
    box(1.15, 0.08, 0.1, doorX, 2.1, fz + 0.06, 'trim', g, false);
    // porch
    const pw = w * 0.5, px = doorX * 0.6;
    box(pw, 0.28, 1.7, px, 0.14, fz + 0.85, 'walk', g);
    box(1.1, 0.14, 0.4, doorX, 0.07, fz + 1.9, 'walk', g);
    for (const cx of [px - pw / 2 + 0.15, px + pw / 2 - 0.15]) cyl(0.07, 0.08, 2.3, cx, 1.43, fz + 1.55, 'trim', g, 10);
    const pr = box(pw + 0.3, 0.1, 1.95, px, 2.62, fz + 0.9, roofMat, g);
    pr.rotation.x = 0.08;
    const porchOn = rand() < 0.6;
    const pl = box(0.12, 0.18, 0.1, doorX + 0.7, 2.05, fz + 0.1, porchOn ? S.lampGlass : 'lamp', g, false);
    if (porchOn) lit.push(pl);
    // picket fence along the front of the lawn, with a gap at the path
    const fence = new THREE.Group();
    g.add(fence);
    const fenceZ = fz + 2.6; // the fence line, 2.6 m in front of the house (toward the road)
    for (let x = -w / 2 - 1.5; x <= w / 2 + 1.5; x += 0.32) {
      if (Math.abs(x - doorX) < 0.7) continue;
      jit(box(0.08, 0.95, 0.04, x, 0.47, fenceZ, 'fence', fence, true));
    }
    for (const y of [0.35, 0.75]) {
      for (const [a, b] of [[-w / 2 - 1.5, doorX - 0.7], [doorX + 0.7, w / 2 + 1.5]]) box(b - a, 0.06, 0.03, (a + b) / 2, y, fenceZ - 0.03, 'fence', fence, false);
    }
    return g;
  };
  let hi = 0;
  for (let z = -12; z > -80; z -= rnd(11, 13)) { houseAt(z, -1, hi++); houseAt(z - rnd(4, 6), 1, hi++); }
  H.litWindows = lit;

  // street lamps (classic posts with a glass lantern) on the sidewalk edge
  const lampZ = [-9, -21, -33, -45, -57, -69, -81];
  lampZ.forEach((z, i) => {
    const side = i % 2 ? 1 : -1, x = side * (ROAD.half + ROAD.curb + 0.35);
    const post = lathe([[0.001, 0], [0.16, 0], [0.16, 0.25], [0.09, 0.4], [0.06, 0.6], [0.05, 3.6], [0.08, 3.7], [0.08, 3.8], [0.001, 3.8]], 'lamp', scene, 12);
    post.position.set(x, 0.12, z);
    const lantern = new THREE.Group();
    lantern.position.set(x, 3.92, z);
    scene.add(lantern);
    const glass = mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.42, 6), S.lampGlass, lantern, false);
    glass.position.y = 0.21;
    const cap = mesh(new THREE.ConeGeometry(0.3, 0.22, 6), M('lamp'), lantern);
    cap.position.y = 0.53;
    const s = new THREE.SpotLight('#ffcf94', 55, 22, 1.0, 0.75, 1.6);
    s.position.set(x, 4.0, z);
    s.target.position.set(x - side * 1.2, 0, z);
    s.castShadow = i < 3; // shadows from the nearest lamps only
    if (s.castShadow) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0006; }
    scene.add(s, s.target);
    H.lampSpots.push(s);
  });

  // utility poles with sagging wires (right sidewalk)
  {
    const tops = [];
    for (let z = -14; z > -95; z -= 17) {
      const x = ROAD.half + ROAD.curb + ROAD.walk - 0.3;
      cyl(0.11, 0.14, 8, x, 4, z, 'pole', scene, 8);
      box(1.8, 0.1, 0.1, x, 7.4, z, 'pole');
      tops.push([x, z]);
    }
    const wireMat = M('wire');
    for (let i = 0; i < tops.length - 1; i++) {
      for (const dx of [-0.75, 0, 0.75]) {
        const a = new THREE.Vector3(tops[i][0] + dx, 7.5, tops[i][1]), b = new THREE.Vector3(tops[i + 1][0] + dx, 7.5, tops[i + 1][1]);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.7;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        mesh(new THREE.TubeGeometry(curve, 24, 0.012, 4), wireMat, scene, false);
      }
    }
  }

  // a parked car, a hydrant, a mailbox
  {
    const car = new THREE.Group();
    car.position.set(-2.1, 0, -24.5);
    car.rotation.y = Math.PI / 2;
    scene.add(car);
    const prof = new THREE.Shape([V2(-2.1, 0.35), V2(2.1, 0.35), V2(2.18, 0.78), V2(1.25, 0.92), V2(0.62, 1.42), V2(-0.92, 1.44), V2(-1.6, 0.95), V2(-2.16, 0.86)]);
    const bodyG = new THREE.ExtrudeGeometry(prof, { depth: 1.66, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    bodyG.translate(0, 0, -0.83);
    mesh(bodyG, M('car'), car);
    const winShape = new THREE.Shape([V2(1.12, 0.95), V2(0.58, 1.36), V2(-0.86, 1.38), V2(-1.45, 0.97)]);
    for (const zz of [0.885, -0.885]) {
      const wm = new THREE.Mesh(new THREE.ShapeGeometry(winShape), M('carGlass', { side: THREE.DoubleSide }));
      wm.position.z = zz;
      car.add(wm);
    }
    for (const [x, zz] of [[1.35, 0.8], [-1.35, 0.8], [1.35, -0.8], [-1.35, -0.8]]) {
      const wh = cyl(0.34, 0.34, 0.24, x, 0.34, zz, 'tire', car, 16);
      wh.rotation.x = Math.PI / 2;
    }
    const hyd = lathe([[0.001, 0], [0.14, 0], [0.14, 0.08], [0.1, 0.1], [0.1, 0.5], [0.13, 0.55], [0.08, 0.68], [0.001, 0.72]], 'hydrant', scene, 12);
    hyd.position.set(ROAD.half + 0.7, 0.12, -17);
    cyl(0.03, 0.03, 1.1, -(ROAD.half + 2.0), 0.6, -15.5, 'pole', scene, 6);
    box(0.5, 0.32, 0.25, -(ROAD.half + 2.0), 1.25, -15.5, 'mail', scene);
  }

  // trees on the lawns and behind the houses (look-specific shapes)
  for (let z = -8; z > -92; z -= rnd(5, 8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.35) scene.add(S.tree(side * rnd(6.0, 7.0), z + rnd(-1.5, 1.5), rnd(3.6, 5), { rand, rnd }));
      if (rand() < 0.8) scene.add(S.tree(side * rnd(20, 34), z + rnd(-3, 3), rnd(6, 10), { rand, rnd }));
    }
  }

  // the crossroads signpost, far down the street
  {
    const sg = new THREE.Group();
    sg.position.set(ROAD.half + 1.4, 0, -88);
    scene.add(sg);
    cyl(0.06, 0.08, 3.4, 0, 1.7, 0, 'pole', sg, 8);
    [[3.0, 0.2], [2.6, -0.3], [2.2, 0.5], [1.8, -0.6]].forEach(([y, a]) => {
      const b = box(1.6, 0.34, 0.05, 0.8, y, 0, 'sign', sg);
      b.geometry.translate(0, 0, 0); b.position.x = Math.cos(a) * 0.8; b.position.z = -Math.sin(a) * 0.8; b.rotation.y = a;
    });
  }

  // distant hills: layered flats, nearer ones darker
  COLORS.hill.forEach((c, i) => {
    const zz = -140 - i * 55, base = 0, amp = 9 + i * 7;
    const pts = [V2(-300, -5)];
    for (let x = -300; x <= 300; x += 12) pts.push(V2(x, base + amp * (0.55 + 0.45 * Math.sin(x * 0.012 + i * 2.1) * Math.cos(x * 0.031 + i)) + rnd(-0.6, 0.6)));
    pts.push(V2(300, -5));
    const m = mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), M('hill', { color: c }), scene, false);
    m.position.set(0, 0, zz);
  });

  // sky: clouds and moon are look-specific
  for (let i = 0; i < 7; i++) scene.add(S.cloud(rnd(-160, 160), rnd(38, 75), rnd(-260, -320), rnd(30, 60), { rand, rnd }));

  return H;
}
