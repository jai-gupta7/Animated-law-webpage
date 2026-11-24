/* First Light: the HTML layer. It works on its own (lite mode, no WebGL) and talks to the 3D world
   through a small event bus. All content, the form and every action live here, never in the canvas. */

export const bus = new EventTarget();
export const emit = (type, detail = {}) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, (e) => fn(e.detail));

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = root.classList.contains('lite');

export const state = { sceneT: 0, target: 0, last: 0, stage: null, day: 0 };
export const dawnAt = (t) => clamp((t - 1) / 5) ** 1.2; // 0 night (kitchen, street) → 1 sunrise (the door)

// ---------- scroll: where on the road are we ----------
const beats = $$('.beat');
state.last = beats.length - 1;
let centers = [];
function readScroll() {
  const vc = scrollY + innerHeight / 2;
  let k = 0;
  while (k < centers.length - 2 && vc >= centers[k + 1]) k++;
  state.sceneT = clamp(k + (vc - centers[k]) / (centers[k + 1] - centers[k]), 0, state.last);
  state.target = state.sceneT;
  updateRoad();
}
function measure() {
  // the last beat (the form) counts as reached when its first screen is centred
  centers = beats.map((b, i) => b.offsetTop + (i === state.last ? Math.min(b.offsetHeight, innerHeight) : b.offsetHeight) / 2);
  readScroll();
}
addEventListener('scroll', readScroll, { passive: true });
addEventListener('resize', measure);
new ResizeObserver(measure).observe(document.body);

export function scrollToBeat(k) {
  const header = $('.topbar').offsetHeight;
  const top = k === state.last ? beats[k].offsetTop - header : centers[k] - innerHeight / 2;
  scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
}

// ---------- the road rail ----------
const stops = $$('.road button');
const roadFill = $('.road__fill');
let shown = -1;
function updateRoad() {
  const k = Math.round(state.sceneT);
  roadFill?.style.setProperty('--p', (state.sceneT / state.last).toFixed(4));
  if (k === shown) return;
  shown = k;
  document.body.dataset.scene = k;
  stops.forEach((b, j) => b.setAttribute('aria-current', j === k ? 'step' : 'false'));
}
stops.forEach((b) => b.addEventListener('click', () => scrollToBeat(+b.dataset.go)));

// ---------- reveal each panel once, then leave it still ----------
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -18% 0px' });
$$('.panel, .card').forEach((p) => io.observe(p));

// ---------- phone call bar: after the hero, hidden while the form is on screen (D108) ----------
{
  const flags = { hero: true, form: false };
  const sync = () => document.body.classList.toggle('show-bar', !flags.hero && !flags.form);
  new IntersectionObserver(([e]) => { flags.hero = e.isIntersecting; sync(); }).observe($('#top'));
  new IntersectionObserver(([e]) => { flags.form = e.isIntersecting; sync(); }, { rootMargin: '0px 0px -30% 0px' }).observe($('#review'));
}

const announce = (msg) => { const a = $('#announce'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 30); };

// ---------- hero: where are you in your claim? ----------
const STAGES = {
  'not-applied': { beat: 2, text: 'You haven’t applied yet. Start by choosing the right benefit.' },
  denied: { beat: 1, text: 'Your application was denied. Here is what a denial means.' },
  'appeal-denied': { beat: 3, text: 'Your appeal was denied. The next step is a hearing.' },
  hearing: { beat: 3, text: 'You have a hearing date. Here is who prepares you.' },
};
const stageSelect = $('#f-stage');
$$('.qbar [data-stage]').forEach((b) => b.addEventListener('click', () => {
  const key = b.dataset.stage, st = STAGES[key];
  state.stage = key;
  $$('.qbar [data-stage]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  stageSelect.value = key;
  $$('.here').forEach((h) => { h.hidden = +h.closest('.beat').dataset.beat !== st.beat; });
  announce(`${st.text} Your answer is saved in the form.`);
  emit('stage', { key, beat: st.beat });
  scrollToBeat(st.beat);
}));

// ---------- the letter: turn it over (button alternative to clicking it) ----------
const flipBtn = $('#flipBtn');
let flipped = false;
function setFlipped(v) {
  flipped = v;
  flipBtn.setAttribute('aria-pressed', String(v));
  flipBtn.textContent = v ? 'Turn the letter back' : 'Turn the letter over';
  $('#letterBack').hidden = !v;
  emit('flip', { on: v });
}
flipBtn.addEventListener('click', () => setFlipped(!flipped));
on('pick-letter', () => setFlipped(!flipped));

// ---------- linked lists: practice signposts and attorneys' windows ----------
function linkList(sel, hoverEvt, pickEvt) {
  const btns = $$(sel);
  const open = (i, focus) => {
    btns.forEach((b, j) => {
      const isOpen = j === i ? b.getAttribute('aria-expanded') !== 'true' : false;
      b.setAttribute('aria-expanded', String(isOpen));
      $('#' + b.getAttribute('aria-controls')).hidden = !isOpen;
    });
    if (focus) btns[i].focus({ preventScroll: true });
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => open(i));
    for (const [ev, v] of [['pointerenter', true], ['pointerleave', false], ['focus', true], ['blur', false]]) {
      b.addEventListener(ev, () => emit(hoverEvt, { i, on: v }));
    }
  });
  on(pickEvt, ({ i }) => open(i, true));
  on(hoverEvt + '-3d', ({ i }) => btns.forEach((b, j) => b.classList.toggle('is-lit', j === i)));
}
linkList('.paths [aria-controls]', 'sign', 'pick-sign');
linkList('.team [aria-controls]', 'attorney', 'pick-attorney');

// ---------- where we help: state finder ----------
import('./us-map.js').then(({ STATES, OFFICES, SERVED }) => {
  const sel = $('#f-state'), out = $('#stateResult');
  for (const [code, [name]] of Object.entries(STATES).sort((a, b) => a[1][0].localeCompare(b[1][0]))) {
    sel.add(new Option(name, code));
  }
  sel.addEventListener('change', () => {
    const code = sel.value;
    if (!code) { out.textContent = ''; emit('state', { code: null }); return; }
    const name = STATES[code][0], o = OFFICES[SERVED[code]];
    out.innerHTML = o
      ? `<strong>Yes, we help people in ${name}.</strong> Your nearest office is ${o.city}, ${o.state}. Hearings can be in person, by phone or by video.`
      : `<strong>We may still be able to help in ${name}.</strong> Social Security Disability is a federal program, so ask in your free case review.`;
    emit('state', { code, served: !!o });
  });
});

// ---------- the form ----------
const form = $('#reviewForm');
const RULES = {
  name: (v) => (v.trim().length >= 2 ? '' : 'Enter your name.'),
  phone: (v) => (v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a phone number with area code, for example (555) 010-0123.'),
  email: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter an email like name@example.com, or leave it empty.'),
  stage: (v) => (v ? '' : 'Choose where you are in your claim.'),
  consent: (_, el) => (el.checked ? '' : 'Tick the box so we can call you back.'),
};
function check(el) {
  const msg = RULES[el.name]?.(el.value, el) ?? '';
  const err = $('#' + el.name + '-err');
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  err.textContent = msg;
  err.hidden = !msg;
  return !msg;
}
Object.keys(RULES).forEach((n) => {
  const el = form.elements[n];
  el.addEventListener('blur', () => { if (el.getAttribute('aria-invalid') === 'true' || el.value) check(el); });
  el.addEventListener('change', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
});
const done = $('#reviewDone'), submitBtn = $('#submitBtn');
form.addEventListener('submit', (e) => {
  e.preventDefault(); // prototype: nothing is sent anywhere
  const bad = Object.keys(RULES).map((n) => form.elements[n]).filter((el) => !check(el));
  if (bad.length) { bad[0].focus(); announce(`${bad.length} ${bad.length === 1 ? 'field needs' : 'fields need'} attention.`); return; }
  submitBtn.disabled = true;
  submitBtn.setAttribute('aria-busy', 'true');
  submitBtn.textContent = 'Sending…';
  const first = form.elements.name.value.trim().split(/\s+/)[0];
  setTimeout(() => {
    const swap = () => {
      form.hidden = true;
      done.hidden = false;
      $('#doneName').textContent = first;
    };
    if (document.startViewTransition && !reduce && !document.hidden) {
      const vt = document.startViewTransition(swap); // can be skipped (e.g. tab hidden): the swap still runs
      vt.ready.catch(() => {});
      vt.updateCallbackDone.catch(() => {});
      vt.finished.catch(() => {}).then(() => $('#doneTitle').focus());
    }
    else { swap(); $('#doneTitle').focus(); }
    state.day = 1;
    emit('submit', { first });
  }, reduce ? 300 : 900);
});
$('#againBtn').addEventListener('click', () => {
  form.reset();
  Object.keys(RULES).forEach((n) => { const el = form.elements[n]; el.removeAttribute('aria-invalid'); $('#' + n + '-err').hidden = true; });
  submitBtn.disabled = false;
  submitBtn.removeAttribute('aria-busy');
  submitBtn.textContent = 'Request my free case review';
  if (state.stage) stageSelect.value = state.stage;
  done.hidden = true;
  form.hidden = false;
  state.day = 0;
  emit('reset');
  form.elements.name.focus();
});

// ---------- sound (off by default) ----------
const soundBtn = $('#soundBtn');
let audio = null;
soundBtn.addEventListener('click', async () => {
  const onNow = soundBtn.getAttribute('aria-pressed') !== 'true';
  soundBtn.setAttribute('aria-pressed', String(onNow));
  soundBtn.querySelector('span').textContent = onNow ? 'Sound on' : 'Sound off';
  if (!audio) audio = (await import('./audio.js')).createAudio();
  audio.enable(onNow);
});
setInterval(() => audio?.set(dawnAt(state.sceneT), state.day), 120);

// ---------- 3D on/off ----------
$$('[data-lite-toggle]').forEach((b) => {
  b.textContent = lite ? 'Turn on the 3D view' : 'Turn off the 3D view';
  b.addEventListener('click', () => {
    try { localStorage.setItem('fl-lite', lite ? '0' : '1'); } catch { /* storage blocked: still switch for this load */ }
    location.hash = '';
    location.reload();
  });
});

const status = $('#glStatus');
function showStatus(msg) { status.querySelector('p').textContent = msg; status.hidden = false; }
on('webgl-fail', () => {
  root.classList.add('lite');
  showStatus('The 3D scene could not start in this browser, so you are seeing the simplified view. Everything on the page still works.');
});
on('ready', () => root.classList.add('ready'));

measure();
if (!lite) {
  import('./world.js').catch(() => emit('webgl-fail'));
  setTimeout(() => {
    if (!root.classList.contains('ready') && !root.classList.contains('lite')) {
      showStatus('The 3D scene is taking a while to load. The page works without it.');
    }
  }, 20000);
}
