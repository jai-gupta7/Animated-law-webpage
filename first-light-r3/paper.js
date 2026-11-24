/* First Light R3 · the paper world look (from the R2 style test, D219/D220).
   Card and paper materials with visible fibre, soft shadows, ambient occlusion for the diorama contact shadows,
   shallow depth of field, cut-card trees and clouds hung on threads, light glowing through paper windows. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COLORS, V2 } from './build.js';
export { fibre };

export const NAME = 'paper';
export const FOG = { color: '#1c2640', density: 0.022 };
export const SKY = { top: '#0e1630', hor: '#2f3a5e', moon: 1.15 };
export const RAIN = { color: '#c9d4ea', opacity: 0.4 };
export const LETTER = { key: '#ffcf9a', keyNight: '#aebde0', amb: 0.3 };
export const EXPOSURE = 1.35;

// paper fibre: a tiling grey texture every material multiplies its colour by
const fibre = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    g.strokeStyle = `rgba(${90 + Math.random() * 60},${80 + Math.random() * 50},${60 + Math.random() * 40},${Math.random() * 0.16})`;
    g.lineWidth = Math.random() * 1.2;
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * Math.PI, l = 3 + Math.random() * 14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.repeat.set(3, 3);
  return t;
})();

const cache = new Map();
const card = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, map: fibre, bumpMap: fibre, bumpScale: 2.2, roughness: 0.92, metalness: 0, ...extra }); // the paper's tooth catches raking light
export function M(role, opts = {}) {
  const key = role + (opts.color || '') + (opts.side || '');
  if (cache.has(key)) return cache.get(key);
  let m;
  const c = opts.color || COLORS[role] || '#888888';
  if (role === 'glass') m = new THREE.MeshBasicMaterial({ color: '#d8e2ee', transparent: true, opacity: 0.1, depthWrite: false });
  else if (role === 'bulb') m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b8').multiplyScalar(3) });
  else if (role === 'puddle') m = new THREE.MeshStandardMaterial({ color: '#1a2030', roughness: 0.06, metalness: 0.6 });
  else if (role === 'wire') m = new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.8 }); // thread
  else if (role === 'carGlass') m = card('#26303f', { side: opts.side ?? THREE.FrontSide });
  else if (role === 'metal') m = card('#5a5d63', { roughness: 0.55 });
  else m = card(c, { side: opts.side ?? THREE.FrontSide });
  cache.set(key, m);
  return m;
}

// light glowing through thin paper
const litWindow = card('#ffe3b5', { emissive: '#ffb45a', emissiveIntensity: 1.1, emissiveMap: fibre });
const dimWindow = card('#2b3346');
const lampGlass = card('#fff0d0', { emissive: '#ffc070', emissiveIntensity: 2.2, emissiveMap: fibre });

// a hand-cut silhouette for one tree layer: a tiered conifer or a bumpy round crown, both on a trunk
function treeShape(w, h, rand, conifer) {
  const tw = 0.07 * w, th = h * 0.22, ch = h - th;
  const pts = [V2(-tw, 0), V2(tw, 0), V2(tw, th)];
  if (conifer) {
    const tiers = 4, side = [];
    for (let i = 0; i < tiers; i++) {
      const y0 = th + (ch * i) / tiers, y1 = th + (ch * (i + 1)) / tiers, ww = w * 0.5 * (1 - (i / tiers) * 0.72);
      side.push([ww * (0.95 + rand() * 0.1), y0 + (y1 - y0) * 0.08], [ww * 0.42, y1 - (y1 - y0) * 0.12]);
    }
    side.forEach(([x, y]) => pts.push(V2(x, y)));
    pts.push(V2(0, h));
    side.reverse().forEach(([x, y]) => pts.push(V2(-x, y)));
  } else {
    const cy = th + ch * 0.5, rx = w * 0.5, ry = ch * 0.5;
    for (let i = 0; i <= 32; i++) {
      const a = -Math.PI / 2 + 0.3 + ((Math.PI * 2 - 0.6) * i) / 32;
      const k = 0.88 + 0.12 * Math.abs(Math.sin(a * 3.5)) + (rand() - 0.5) * 0.05;
      pts.push(V2(Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k));
    }
  }
  pts.push(V2(-tw, th));
  return new THREE.Shape(pts);
}
const GREENS = ['#3d6b52', '#4a7a5c', '#58886a', '#36604a'];

export const S = {
  jitter: 0.02,
  litWindow, dimWindow, lampGlass,
  // materials a porch house switches on as you arrive (emissiveIntensity 0 = off)
  windowMat: () => card('#ffe3b5', { emissive: '#ffb45a', emissiveIntensity: 0, emissiveMap: fibre }),
  lampMat: () => card('#fff0d0', { emissive: '#ffc070', emissiveIntensity: 0, emissiveMap: fibre }),
  tree(x, z, h, { rand, rnd }) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = -Math.sign(x) * Math.PI / 4 + rnd(-0.15, 0.15); // flats angled toward the road, like theatre scenery
    const kind = rand() < 0.5;
    for (let l = 0; l < 3; l++) {
      const geo = new THREE.ExtrudeGeometry(treeShape(h * rnd(0.55, 0.75) * (1 - l * 0.12), h * (1 - l * 0.1), rand, kind), { depth: 0.03, bevelEnabled: false });
      const m = new THREE.Mesh(geo, card(GREENS[(l + ((rand() * 4) | 0)) % 4]));
      m.position.set(rnd(-0.2, 0.2), 0, (l - 1) * 0.35);
      m.rotation.z = rnd(-0.03, 0.03);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.9), card('#6b5a45'));
    stand.position.y = 0.03; stand.receiveShadow = true;
    g.add(stand);
    return g;
  },
  cloud(x, y, z, w, { rnd }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const pts = [];
    const bumps = 5 + ((rnd(0, 3)) | 0);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = Math.PI * t;
      const bump = Math.abs(Math.sin(t * Math.PI * bumps)) * 0.35 + 0.65;
      pts.push(V2(-Math.cos(a) * w * 0.5, Math.sin(a) * w * 0.28 * bump));
    }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.6, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#56618a', map: fibre, roughness: 1, fog: false }));
    g.add(m);
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 120, 4), new THREE.MeshBasicMaterial({ color: '#141a2c', fog: false }));
    thread.position.set(0, w * 0.2 + 60, 0.3); // the cloud hangs from the "ceiling" on a thread
    g.add(thread);
    return g;
  },
};

const FinishShader = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.05 }, uFar: { value: 900 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    #include <packing>
    uniform sampler2D tDiffuse, tDepth; uniform float uTime, uNear, uFar; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float dep(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // cut-card edges: a thin pale core where a nearer layer ends, a soft shadow just behind it
      vec2 px = 1.0 / uRes;
      float d0 = dep(vUv);
      float nearEdge = 0.0, shadow = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 o = vec2(i == 0 ? 1.5 : i == 1 ? -1.5 : 0.0, i == 2 ? 1.5 : i == 3 ? -1.5 : 0.0) * px;
        float dn = dep(vUv + o);
        nearEdge = max(nearEdge, smoothstep(0.04, 0.12, (dn - d0) / max(d0, 0.5)));
      }
      for (int i = 1; i <= 4; i++) { // a layer up and to the left of this pixel casts a little shadow onto it
        float dn = dep(vUv + vec2(-1.0, 1.0) * px * float(i) * 2.0);
        shadow = max(shadow, smoothstep(0.05, 0.15, (d0 - dn) / max(d0, 0.5)) * (1.0 - float(i) * 0.2));
      }
      float fade = 1.0 - smoothstep(20.0, 70.0, d0);
      c *= 1.0 - shadow * 0.35 * fade;
      c = mix(c, vec3(0.93, 0.9, 0.84), nearEdge * 0.55 * fade);
      c = mix(c, c * vec3(1.04, 1.0, 0.94), 0.6);                 // warm grade
      c = (c - 0.5) * 1.06 + 0.5;                                    // a little contrast
      vec2 v = vUv - 0.5; c *= 1.0 - dot(v, v) * 0.7;               // vignette
      c += (hash(vUv * uRes + fract(uTime * 7.0)) - 0.5) * 0.035;    // film grain
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function post(renderer, scene, camera, w, h) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, w, h);
  gtao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 12 });
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
  const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.003, maxblur: 0.009 });
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  const fin = new ShaderPass(FinishShader);
  composer.addPass(fin);
  const pr = renderer.getPixelRatio();
  const depthTex = new THREE.DepthTexture(w, h);
  const depthRT = new THREE.WebGLRenderTarget(w, h, { depthTexture: depthTex });
  const depthMat = new THREE.MeshBasicMaterial();
  fin.uniforms.tDepth.value = depthTex;
  function size(W, Hh) {
    composer.setSize(W, Hh);
    gtao.setSize(W * pr, Hh * pr);
    depthRT.setSize(W * pr, Hh * pr);
    fin.uniforms.uRes.value.set(W * pr, Hh * pr);
  }
  size(w, h);
  let focusNow = 3;
  return {
    render(dt, t) {
      // depth of the opaque layers (rain and splashes left out) for the cut-card edges
      camera.layers.disable(1);
      scene.overrideMaterial = depthMat;
      renderer.setRenderTarget(depthRT);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      scene.overrideMaterial = null;
      camera.layers.enable(1);
      fin.uniforms.uNear.value = camera.near; fin.uniforms.uFar.value = camera.far;
      fin.uniforms.uTime.value = t;
      bokeh.uniforms.focus.value = focusNow;
      composer.render(dt);
    },
    resize: size,
    focus(d, dt, k = 1) { // rack focus, eased; the aperture narrows with distance (and by k) so far views stay sharp
      focusNow += (d - focusNow) * (1 - Math.exp(-dt * 4));
      bokeh.uniforms.aperture.value = 0.003 * k * Math.min(1, Math.max(0.03, 4 / focusNow));
    },
  };
}
