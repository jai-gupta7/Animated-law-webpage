/* Ambient sound, generated in the browser (no audio files): rain at night, birds at first light.
   Off until the visitor turns it on. */
export function createAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // rain: looped noise, band-limited
  const len = ctx.sampleRate * 3, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b = 0;
    for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 + (Math.random() * 2 - 1) * 0.08; }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280;
  const rain = ctx.createGain(); rain.gain.value = 0;
  src.connect(hp).connect(lp).connect(rain).connect(master);
  src.start();

  function chirp(when, pan) {
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
    const f = 2600 + Math.random() * 1600;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, when);
    o.frequency.exponentialRampToValueAtTime(f * (1.25 + Math.random() * 0.3), when + 0.06);
    o.frequency.exponentialRampToValueAtTime(f * 0.9, when + 0.13);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.05, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
    p.pan.value = pan;
    o.connect(g).connect(p).connect(master);
    o.start(when); o.stop(when + 0.2);
  }

  let enabled = false, dawn = 0, nextBird = 0;
  function tick() {
    if (!enabled) return;
    const t = ctx.currentTime;
    if (dawn > 0.55 && t > nextBird) {
      const pan = Math.random() * 1.6 - 0.8, n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) chirp(t + i * (0.16 + Math.random() * 0.08), pan);
      nextBird = t + (3.2 - 2.4 * dawn) + Math.random() * 2.5;
    }
  }
  setInterval(tick, 200);

  return {
    enable(v) {
      enabled = v;
      if (v && ctx.state === 'suspended') ctx.resume();
      master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.4);
    },
    set(d, day) {
      dawn = Math.min(1, d + day * 0.3);
      rain.gain.setTargetAtTime(0.32 * Math.max(0, 1 - dawn * 1.6) ** 1.2, ctx.currentTime, 0.5);
    },
  };
}
