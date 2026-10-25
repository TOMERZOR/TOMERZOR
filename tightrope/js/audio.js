// All sound is synthesised with Web Audio, so there are no files to load.
let ctx = null, master = null, noiseBuf = null;
let windSrc, windFilter, windGain, pourSrc, pourFilter, pourGain, rainSrc, rainFilter, rainGain;
let enabled = true;

function noise(seconds) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    // Slightly brown noise: softer than white, sounds more like air and water.
    last = (last + (Math.random() * 2 - 1) * 0.12) * 0.985;
    d[i] = last * 3 + (Math.random() * 2 - 1) * 0.15;
  }
  return b;
}

function loop(filterType, freq, q) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(master);
  src.start();
  return [src, f, g];
}

// Call from a tap (browsers only start audio after one).
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.8 : 0;
  master.connect(ctx.destination);
  noiseBuf = noise(3);
  [windSrc, windFilter, windGain] = loop('bandpass', 500, 0.7);
  [pourSrc, pourFilter, pourGain] = loop('bandpass', 1400, 1.2);
  [rainSrc, rainFilter, rainGain] = loop('highpass', 2500, 0.5);
}

export function setSound(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.05);
}

export function suspendAudio(yes) {
  if (!ctx) return;
  if (yes) ctx.suspend(); else ctx.resume();
}

// Continuous layers, updated every frame.
export function ambience(wind, spillRate, playing, rain = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const w = Math.min(1.5, Math.abs(wind));
  windGain.gain.setTargetAtTime(playing ? 0.05 + w * 0.22 : 0.03, t, 0.15);
  windFilter.frequency.setTargetAtTime(380 + w * 700, t, 0.2);
  pourGain.gain.setTargetAtTime(playing ? Math.min(0.5, spillRate * 0.9) : 0, t, 0.04);
  pourFilter.frequency.setTargetAtTime(900 + Math.random() * 900, t, 0.03);
  rainGain.gain.setTargetAtTime(playing ? rain * 0.35 : 0, t, 0.2);
}

function env(node, t, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(type, f0, f1, dur, vol, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.01, vol, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function burst(freq, q, dur, vol, sweepTo) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, dur * 0.3, vol, dur * 0.7);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 2);
  s.stop(t + dur + 0.05);
}

export const sfx = {
  // The rope creaks under each step.
  step() { tone('triangle', 95 + Math.random() * 40, 70, 0.12, 0.06); },
  splash() { burst(1800, 0.8, 0.35, 0.35, 600); },
  gustWarn(side) { burst(side > 0 ? 300 : 500, 1.5, 1.1, 0.25, side > 0 ? 900 : 250); },
  bird() {
    tone('sine', 2400, 3400, 0.08, 0.08);
    tone('sine', 2600, 3800, 0.07, 0.07, 0.12);
  },
  tick() { tone('square', 660, 660, 0.06, 0.05); },
  go() { tone('square', 990, 990, 0.18, 0.06); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.25, 0.12, i * 0.11));
  },
  fail() {
    tone('sawtooth', 330, 110, 0.7, 0.07);
    burst(700, 0.6, 0.6, 0.3, 200);
  },
  fall() {
    tone('sine', 900, 120, 1.2, 0.12);
    burst(400, 0.5, 1.2, 0.2, 2000);
  },
  click() { tone('sine', 700, 500, 0.06, 0.06); },
  coin() {
    tone('square', 1320, 1320, 0.06, 0.05);
    tone('square', 1760, 1760, 0.12, 0.05, 0.06);
  },
  orb() {
    tone('sine', 500, 1100, 0.18, 0.12);
    tone('sine', 700, 1500, 0.18, 0.08, 0.08);
  },
  mult(n) {
    for (let i = 0; i < n; i++) tone('triangle', 520 * Math.pow(1.26, i), 520 * Math.pow(1.26, i), 0.12, 0.09, i * 0.06);
  },
  multLost() { tone('triangle', 440, 260, 0.25, 0.06); },
  jump() { burst(500, 1.2, 0.25, 0.18, 1600); },
  land() { tone('sine', 140, 70, 0.15, 0.15); },
  knot() { tone('triangle', 160, 90, 0.18, 0.1); },
  trip() {
    tone('sine', 180, 60, 0.3, 0.2);
    burst(1200, 0.8, 0.3, 0.3, 500);
  },
  // An ibex's "meh": a buzzy tone with a fast wobble.
  bleat() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t0);
    o.frequency.linearRampToValueAtTime(430, t0 + 0.5);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 22;
    const lg = ctx.createGain();
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1200;
    f.Q.value = 2;
    const g = ctx.createGain();
    env(g, t0, 0.04, 0.12, 0.5);
    o.connect(f).connect(g).connect(master);
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + 0.6);
    lfo.stop(t0 + 0.6);
  },
  cheer() { [784, 988, 1175].forEach((f, i) => tone('triangle', f, f, 0.14, 0.08, i * 0.07)); },
  fish() { tone('sine', 900, 1400, 0.06, 0.06); },
  buy() { [523, 784, 1047, 1568].forEach((f, i) => tone('square', f, f, 0.12, 0.05, i * 0.07)); },
};
