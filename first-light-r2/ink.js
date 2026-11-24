/* Look A · Ink and watercolour.
   The scene renders with plain diffuse light; a post-process repaints it: ink lines from depth and normal
   breaks, watercolour washes that bleed and granulate, lights left as bare paper with a warm bleed, paper fibres. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { COLORS } from './build.js';

export const NAME = 'ink';
export const FOG = { color: '#1b2340', density: 0.03 };
export const SKY = { top: '#0a1024', hor: '#323a5c', moon: 2.2 };
export const RAIN = { color: '#dfe6f5', opacity: 0.3 };
export const LETTER = { key: '#ffffff', keyNight: '#c9d2f0', amb: 0.22 };
export const EXPOSURE = 1.0;

const cache = new Map();
export function M(role, opts = {}) {
  const key = role + (opts.color || '') + (opts.side || '');
  if (cache.has(key)) return cache.get(key);
  let m;
  const c = opts.color || COLORS[role] || '#888888';
  if (role === 'glass') m = new THREE.MeshBasicMaterial({ color: '#9fb4c9', transparent: true, opacity: 0.08, depthWrite: false });
  else if (role === 'bulb') m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b8').multiplyScalar(6) });
  else if (role === 'puddle') m = new THREE.MeshLambertMaterial({ color: '#4a5576', emissive: '#141a30' });
  else if (role === 'wire') m = new THREE.MeshBasicMaterial({ color: '#0d0f18' });
  else if (role === 'carGlass') m = new THREE.MeshLambertMaterial({ color: '#1d2433', side: opts.side ?? THREE.FrontSide });
  else m = new THREE.MeshLambertMaterial({ color: c, side: opts.side ?? THREE.FrontSide });
  cache.set(key, m);
  return m;
}

const litWindow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(2.2) });
const dimWindow = new THREE.MeshLambertMaterial({ color: '#2a3248' });
const lampGlass = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe0b0').multiplyScalar(3) });

export const S = {
  jitter: 0,
  litWindow, dimWindow, lampGlass,
  tree(x, z, h, { rand, rnd }) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, h * 0.55, 7), M('woodDark'));
    trunk.position.y = h * 0.27;
    trunk.castShadow = true;
    g.add(trunk);
    const leaf = M('leaf', { color: ['#2f4a3c', '#36543f', '#2a4236'][(rand() * 3) | 0] });
    for (let i = 0; i < 5; i++) {
      const r = h * rnd(0.16, 0.24);
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf);
      b.position.set(rnd(-0.5, 0.5) * h * 0.3, h * rnd(0.55, 0.85), rnd(-0.5, 0.5) * h * 0.3);
      b.castShadow = true; b.receiveShadow = true;
      g.add(b);
    }
    return g;
  },
  cloud(x, y, z, w, { rnd }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = new THREE.MeshBasicMaterial({ color: '#262d4a', fog: false });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(w * rnd(0.16, 0.26), 12, 8), mat);
      b.position.set(rnd(-0.5, 0.5) * w, rnd(-0.08, 0.1) * w, rnd(-0.1, 0.1) * w);
      b.scale.y = 0.45;
      g.add(b);
    }
    return g;
  },
};

const InkShader = {
  uniforms: {
    tDiffuse: { value: null }, tNormal: { value: null }, tDepth: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uExposure: { value: 1.6 },
    uNear: { value: 0.05 }, uFar: { value: 900 },
    uPaper: { value: new THREE.Color('#f2ead9') }, uInk: { value: new THREE.Color('#1c2547') },
    uLine: { value: new THREE.Color('#0f1328') }, uWarm: { value: new THREE.Color('#e8a64f') },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    #include <packing>
    uniform sampler2D tDiffuse, tNormal, tDepth;
    uniform vec2 uRes; uniform float uTime, uExposure, uNear, uFar;
    uniform vec3 uPaper, uInk, uLine, uWarm;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    vec3 tone(vec3 c) { return pow(aces(c * uExposure), vec3(1.0 / 2.2)); }
    float depthAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
    void main() {
      vec2 px = 1.0 / uRes, asp = vec2(uRes.x / uRes.y, 1.0);
      // watercolour bleed: colour sampled through a slow, paper-fixed wobble
      vec2 wob = (vec2(fbm(vUv * asp * 5.0), fbm(vUv * asp * 5.0 + 11.3)) - 0.5) * 0.016;
      vec3 c = tone(texture2D(tDiffuse, vUv + wob).rgb);
      vec3 wash = vec3(0.0); float bright = 0.0;
      for (int i = 0; i < 10; i++) {
        float a = float(i) * 0.6283 + 0.3;
        vec2 o = vec2(cos(a), sin(a)) * px * (6.0 + 5.0 * mod(float(i), 2.0));
        wash += tone(texture2D(tDiffuse, vUv + wob + o).rgb);
        vec3 sb = tone(texture2D(tDiffuse, vUv + o * 6.0).rgb);
        bright += max(0.0, dot(sb, vec3(0.333)) - 0.9) * 4.0;
      }
      wash /= 10.0; bright /= 10.0;
      c = mix(c, wash, 0.4);
      float lum = dot(c, vec3(0.299, 0.587, 0.114)), washLum = dot(wash, vec3(0.299, 0.587, 0.114));
      vec3 hue = clamp(mix(vec3(1.0), c / max(lum, 0.05), 1.25), 0.0, 2.2); // a little extra saturation, as pigment
      float q = lum * 4.0;
      float L = mix(lum, (floor(q) + smoothstep(0.3, 0.7, fract(q))) / 4.0, 0.55); // a few soft washes
      // gradient-map the light into two pigment ramps: cool indigo washes, and warm ochre where lamplight falls
      float warmth = clamp((c.r - c.b) * 3.0 + 0.1, 0.0, 1.0);
      float g = clamp(L * (0.92 + 0.16 * fbm(vUv * asp * 9.0)) + 0.04 * (noise(gl_FragCoord.xy * 0.25) - 0.5), 0.0, 1.0); // granulation
      vec3 cool = g < 0.35 ? mix(vec3(0.075, 0.095, 0.19), vec3(0.17, 0.21, 0.37), g / 0.35)
                : g < 0.7 ? mix(vec3(0.17, 0.21, 0.37), vec3(0.5, 0.55, 0.7), (g - 0.35) / 0.35)
                : mix(vec3(0.5, 0.55, 0.7), uPaper, (g - 0.7) / 0.3);
      vec3 warm = g < 0.35 ? mix(vec3(0.16, 0.1, 0.08), vec3(0.46, 0.27, 0.15), g / 0.35)
                : g < 0.7 ? mix(vec3(0.46, 0.27, 0.15), vec3(0.85, 0.6, 0.33), (g - 0.35) / 0.35)
                : mix(vec3(0.85, 0.6, 0.33), uPaper, (g - 0.7) / 0.3);
      vec3 col = mix(cool, warm, warmth);
      col *= 1.0 - clamp(abs(lum - washLum) * 1.6, 0.0, 0.28);          // pigment pools where washes meet
      col = mix(col, uPaper, smoothstep(0.86, 0.98, lum));              // lights stay bare paper
      col = mix(col, col * 0.55 + uWarm * 0.6, clamp(bright * 2.4, 0.0, 0.7)); // and bleed warm around
      // ink lines from depth and normal breaks, with a wobbling width and dry-brush gaps
      vec2 lw = px * (1.1 + 0.9 * noise(vUv * asp * 30.0 + 7.0));
      float d0 = depthAt(vUv); vec3 n0 = texture2D(tNormal, vUv).rgb;
      float dd = 0.0, nd = 0.0;
      vec2 o4[4]; o4[0] = vec2(lw.x, 0.0); o4[1] = vec2(-lw.x, 0.0); o4[2] = vec2(0.0, lw.y); o4[3] = vec2(0.0, -lw.y);
      for (int i = 0; i < 4; i++) { dd += abs(depthAt(vUv + o4[i]) - d0); nd += distance(texture2D(tNormal, vUv + o4[i]).rgb, n0); }
      float line = max(smoothstep(0.03, 0.1, dd / max(d0, 0.5)), smoothstep(0.3, 0.75, nd) * 0.85);
      line *= 0.5 + 0.5 * smoothstep(0.25, 0.6, noise(vUv * asp * 70.0));
      line *= 1.0 - smoothstep(25.0, 110.0, d0) * 0.75;
      col = mix(col, uLine, clamp(line, 0.0, 1.0) * 0.82);
      col *= 0.97 + 0.04 * fbm(gl_FragCoord.xy * vec2(0.5, 0.08));      // paper fibres, faint
      vec2 v = vUv - 0.5; col *= 1.0 - dot(v, v) * 0.5;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function post(renderer, scene, camera, w, h) {
  const depthTex = new THREE.DepthTexture(w, h);
  const normalRT = new THREE.WebGLRenderTarget(w, h, { depthTexture: depthTex });
  const normalMat = new THREE.MeshNormalMaterial();
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const pass = new ShaderPass(InkShader);
  pass.uniforms.tNormal.value = normalRT.texture;
  pass.uniforms.tDepth.value = depthTex;
  composer.addPass(pass);
  renderer.toneMapping = THREE.NoToneMapping;
  const pr = renderer.getPixelRatio();
  function size(W, Hh) {
    composer.setSize(W, Hh);
    normalRT.setSize(W * pr, Hh * pr);
    pass.uniforms.uRes.value.set(W * pr, Hh * pr);
  }
  size(w, h);
  return {
    render(dt, t) {
      // pass 1: normals and depth (rain and other layer-1 extras left out)
      camera.layers.disable(1);
      scene.overrideMaterial = normalMat;
      const fog = scene.fog; scene.fog = null;
      renderer.setRenderTarget(normalRT);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      scene.overrideMaterial = null; scene.fog = fog;
      camera.layers.enable(1);
      pass.uniforms.uTime.value = t;
      pass.uniforms.uNear.value = camera.near; pass.uniforms.uFar.value = camera.far;
      composer.render(dt);
    },
    resize: size,
    focus() {},
  };
}
