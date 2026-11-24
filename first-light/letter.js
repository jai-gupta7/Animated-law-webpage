/* The letter: the one object that travels the whole road.
   A paper sheet with a fluttering, tri-folding vertex shader, a front (the decision) and a back (the plan),
   plus the envelope it is sealed into when the form is sent. */
import * as THREE from 'three';

const W = 1, H = 1.3; // sheet size in metres
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.redraw = () => { draw(g, w, h); t.needsUpdate = true; };
  return t;
}

function paper(g, w, h) {
  g.fillStyle = '#f3eee3';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { // fibre grain
    g.fillStyle = `rgba(90,70,40,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
  }
  const v = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(70,50,20,0.12)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}

function lines(g, x, y, w, n, gap = 20, last = 0.6) {
  g.fillStyle = 'rgba(40,40,48,0.42)';
  for (let i = 0; i < n; i++) {
    const lw = i === n - 1 ? w * last : w * (0.86 + Math.random() * 0.14);
    g.fillRect(x, y + i * gap, lw, 6);
  }
}

const SERIF = '"Newsreader", Georgia, serif';
const SANS = '"Hanken Grotesk", Arial, sans-serif';

// Front: a generic decision letter (deliberately not a copy of any agency's real notice).
function drawFront(g, w, h) {
  paper(g, w, h);
  g.fillStyle = '#23262d';
  g.beginPath(); g.arc(70, 72, 26, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f3eee3'; g.beginPath(); g.arc(70, 72, 17, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#23262d';
  g.font = `600 22px ${SANS}`;
  g.fillText('NOTICE OF DECISION', 112, 66);
  g.font = `400 17px ${SANS}`;
  g.fillStyle = '#4a4d55';
  g.fillText('Claim for disability benefits', 112, 92);
  g.fillRect(48, 122, w - 96, 2);
  lines(g, 48, 156, w - 96, 3, 22, 0.5);
  g.font = `600 19px ${SANS}`;
  g.fillStyle = '#23262d';
  g.fillText('About your claim', 48, 252);
  lines(g, 48, 276, w - 96, 6, 22, 0.7);
  lines(g, 48, 430, w - 96, 5, 22, 0.4);
  lines(g, 48, 560, w - 96, 4, 22, 0.55);
  // the stamp
  g.save();
  g.translate(w * 0.62, h * 0.47);
  g.rotate(-0.21);
  g.strokeStyle = 'rgba(163,38,42,0.82)';
  g.fillStyle = 'rgba(163,38,42,0.82)';
  g.lineWidth = 6;
  g.strokeRect(-150, -48, 300, 96);
  g.lineWidth = 2;
  g.strokeRect(-140, -38, 280, 76);
  g.font = `700 64px ${SANS}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DENIED', 0, 4);
  g.restore();
}

// Back: the plan, written by hand.
function drawBack(g, w, h) {
  paper(g, w, h);
  g.fillStyle = '#20232a';
  g.font = `italic 300 46px ${SERIF}`;
  g.fillText('What happens next', 56, 120);
  g.font = `italic 400 34px ${SERIF}`;
  const items = ['1.  Ask for a second look', '2.  Add the missing records', '3.  Get ready for your hearing'];
  items.forEach((s, i) => g.fillText(s, 64, 210 + i * 62));
  g.font = `italic 500 40px ${SERIF}`;
  g.fillStyle = '#7a2430';
  g.fillText('Start with a free case review', 56, 470);
  g.strokeStyle = '#b8873a';
  g.lineWidth = 4;
  g.beginPath(); // the gold thread underline, slightly hand-drawn
  g.moveTo(56, 492);
  g.bezierCurveTo(200, 484, 380, 502, w - 60, 488);
  g.stroke();
  g.fillStyle = '#4a4d55';
  g.font = `italic 300 30px ${SERIF}`;
  g.fillText('— Ashgrove & Penn', w - 300, 640);
}

function drawEnvelope(g, w, h) {
  g.fillStyle = '#efe6d4';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,95,60,0.35)';
  g.lineWidth = 3;
  g.beginPath(); // the folded side flaps
  g.moveTo(0, h); g.lineTo(w * 0.5, h * 0.42); g.lineTo(w, h);
  g.moveTo(0, 0); g.lineTo(w * 0.42, h * 0.5); g.lineTo(0, h);
  g.moveTo(w, 0); g.lineTo(w * 0.58, h * 0.5); g.lineTo(w, h);
  g.stroke();
}

function drawSeal(g, w, h) {
  const r = w / 2;
  const grad = g.createRadialGradient(r * 0.8, r * 0.7, r * 0.1, r, r, r);
  grad.addColorStop(0, '#e9c27a');
  grad.addColorStop(1, '#9a6a26');
  g.fillStyle = grad;
  g.beginPath(); g.arc(r, r, r - 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(80,50,10,0.5)';
  g.lineWidth = 4;
  g.beginPath(); g.arc(r, r, r * 0.72, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#5a3a10';
  g.font = `italic 500 ${w * 0.34}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('A&P', r, r + 3);
}

export function createLetter() {
  const front = canvasTex(600, 780, drawFront);
  const back = canvasTex(600, 780, drawBack);
  // Redraw once the web fonts arrive so the canvas text uses them.
  document.fonts?.ready.then(() => { front.userData.redraw(); back.userData.redraw(); seal.material.map.userData.redraw(); });

  const uniforms = {
    uFront: { value: front }, uBack: { value: back },
    uTime: { value: 0 }, uFlutter: { value: 0 }, uFold: { value: 0 },
    uKey: { value: new THREE.Color('#ffd2a0') }, uAmb: { value: new THREE.Color('#2a2e3e') }, uGlow: { value: 0 },
    uOpacity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, transparent: true,
    vertexShader: /* glsl */`
      uniform float uTime, uFlutter, uFold;
      varying vec2 vUv; varying vec3 vView;
      const float H = ${H.toFixed(3)};
      void main() {
        vUv = uv;
        vec3 p = position;
        float w = sin(uTime * 3.1 + p.y * 2.6 + p.x * 1.7) * 0.5 + sin(uTime * 5.3 + p.x * 3.1 - p.y) * 0.25;
        p.z += w * uFlutter * (0.3 + 0.7 * abs(p.x) + 0.3 * abs(p.y)) * (1.0 - uFold);
        p.z += -0.05 * p.x * p.x * (1.0 - uFold); // a soft curl, like paper that has been handled
        float h = H / 6.0;
        float aB = clamp(uFold * 2.0, 0.0, 1.0) * 3.1;       // bottom third folds up first
        float aT = clamp(uFold * 2.0 - 1.0, 0.0, 1.0) * 3.05; // then the top third folds down over it
        if (p.y < -h + 0.0005) { float d = p.y + h; p.y = -h + d * cos(aB); p.z += -d * sin(aB) + 0.003 * step(0.01, aB); }
        else if (p.y > h - 0.0005) { float d = p.y - h; p.y = h + d * cos(aT); p.z += d * sin(aT) + 0.006 * step(0.01, aT); }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vView = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uFront, uBack; uniform vec3 uKey, uAmb; uniform float uGlow, uOpacity;
      varying vec2 vUv; varying vec3 vView;
      void main() {
        vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
        if (!gl_FrontFacing) n = -n;
        vec3 base = gl_FrontFacing ? texture2D(uFront, vUv).rgb : texture2D(uBack, vec2(1.0 - vUv.x, vUv.y)).rgb;
        vec3 l = normalize(vec3(-0.4, 0.8, 0.6));
        float diff = abs(dot(n, l));
        vec3 c = base * (uAmb + uKey * (0.35 + 0.75 * diff)) + base * uGlow * 0.35;
        gl_FragColor = vec4(c, uOpacity);
      }`,
  });
  const geo = new THREE.PlaneGeometry(W, H, 14, 18);
  const sheet = new THREE.Mesh(geo, mat);
  sheet.frustumCulled = false;
  sheet.renderOrder = 2;

  const flipper = new THREE.Group(); // turns the letter over
  flipper.add(sheet);

  // the envelope (hidden until the form is sent)
  const env = new THREE.Group();
  const envMat = new THREE.MeshStandardMaterial({ map: canvasTex(512, 240, drawEnvelope), emissive: '#4a3e30', roughness: 0.85, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.52), envMat);
  body.position.z = 0.02;
  const flapShape = new THREE.Shape([new THREE.Vector2(-0.56, 0), new THREE.Vector2(0.56, 0), new THREE.Vector2(0, -0.3)]);
  const flapGeo = new THREE.ShapeGeometry(flapShape);
  const flapMat = new THREE.MeshStandardMaterial({ color: '#e7dcc6', emissive: '#4a3e30', roughness: 0.85, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const flap = new THREE.Mesh(flapGeo, flapMat);
  const flapPivot = new THREE.Group();
  flapPivot.position.set(0, 0.26, 0.025);
  flapPivot.add(flap);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(0.085, 40),
    new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, drawSeal), roughness: 0.4, metalness: 0.3, transparent: true, emissive: '#3a2408' }));
  seal.position.set(0, -0.04, 0.035);
  seal.scale.setScalar(0.001);
  env.add(body, flapPivot, seal);
  env.visible = false;

  const group = new THREE.Group();
  group.add(flipper, env);

  const s = { flip: 0, flipTo: 0, seal: -1, glow: 0, hover: 0 }; // seal: -1 idle, else seconds since sent

  function setFlip(on) { s.flipTo = on ? 1 : 0; }
  function send(instant) { s.seal = instant ? 2.6 : 0; s.instant = instant; } // reduced motion: sealed at once, stays put
  function reset() {
    s.seal = -1; s.instant = false; uniforms.uFold.value = 0; uniforms.uOpacity.value = 1;
    env.visible = false; envMat.opacity = 0; flapMat.opacity = 0; seal.scale.setScalar(0.001);
    sheet.visible = true; group.scale.setScalar(1);
  }

  // returns 0..1 how far the sealed letter has flown away (used to hand it to the door)
  function update(dt, time, { flutter = 0, reduce = false, lift = 0 }) {
    uniforms.uTime.value = time;
    uniforms.uFlutter.value = reduce ? 0 : flutter;
    s.flip += (s.flipTo - s.flip) * (reduce ? 1 : 1 - Math.exp(-dt * 5));
    flipper.rotation.y = Math.PI * ease(clamp(s.flip));
    flipper.position.z = Math.sin(Math.PI * clamp(s.flip)) * 0.25 + lift; // lifts as it turns
    s.hover += ((s.glow ? 1 : 0) - s.hover) * (1 - Math.exp(-dt * 8));
    uniforms.uGlow.value = s.hover;

    if (s.seal < 0) return 0;
    if (!s.instant) s.seal += dt;
    const t = s.seal;
    uniforms.uFold.value = ease(clamp(t / 1.3)); // fold into thirds
    if (t > 1.2) {
      env.visible = true;
      const k = clamp((t - 1.2) / 0.35);
      envMat.opacity = k; flapMat.opacity = k;
      if (k >= 1) sheet.visible = false; // the letter is inside
    }
    flapPivot.rotation.x = Math.PI * 0.92 * (1 - ease(clamp((t - 1.55) / 0.55))); // flap closes
    const sk = clamp((t - 2.05) / 0.3);
    seal.scale.setScalar(0.001 + (sk < 1 ? Math.sin(sk * Math.PI * 0.62) / Math.sin(Math.PI * 0.62) : 1));
    return clamp((t - 2.6) / 1.8); // then it travels to the door
  }

  return { group, sheet, uniforms, update, setFlip, send, reset, state: s, isFlipped: () => s.flipTo === 1 };
}
