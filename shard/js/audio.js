// Synthesized sound: every shatter is generated on the fly so no two sound alike.
let ctx = null, master, sfxBus, musicBus, comp, noiseBuf, reverb, reverbSend;
let enabled = { sfx: true, music: true };
let lastShatter = 0, shatterVoices = 0;
const PENTA = [0, 2, 4, 7, 9];

export function initAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.9;
  sfxBus = ctx.createGain(); sfxBus.gain.value = enabled.sfx ? 1 : 0;
  musicBus = ctx.createGain(); musicBus.gain.value = enabled.music ? 0.32 : 0;
  sfxBus.connect(comp); musicBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
  // noise
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // small airy reverb for sparkle
  reverb = ctx.createConvolver();
  const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  reverb.buffer = ir;
  reverbSend = ctx.createGain(); reverbSend.gain.value = 0.22;
  reverbSend.connect(reverb); reverb.connect(sfxBus);
  return ctx;
}

export function resumeAudio() {
  initAudio();
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
}
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
});

export function setSfx(on) { enabled.sfx = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02); }
export function setMusic(on) {
  enabled.music = on;
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.3);
  if (on) startMusic();
}

function out(pan = 0, wet = 0) {
  const g = ctx.createGain();
  let node = g;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.8, Math.min(0.8, pan)); g.connect(p); node = p; }
  node.connect(sfxBus);
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(reverbSend); }
  return g;
}
function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function noise(t, dur, type, freq, q, gain, dest, sweepTo) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain(); env(g, t, 0.002, gain, dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(t, freq, dur, gain, dest, type = 'sine', a = 0.002, glideTo) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + a + dur + 0.05);
}

// x in [0..1] across the screen for panning, size ~ object size, power 0..1
export function shatter(x = 0.5, size = 0.6, power = 0.6, combo = 1) {
  if (!ctx || !enabled.sfx) return;
  const now = ctx.currentTime;
  if (now - lastShatter < 0.02 && shatterVoices > 5) return;
  lastShatter = now;
  shatterVoices++;
  setTimeout(() => shatterVoices--, 300);
  const pan = (x - 0.5) * 1.4;
  const dest = out(pan, 0.5);
  dest.gain.value = 0.9;
  const t = now + 0.005;
  const big = Math.min(1, size);
  // the crack
  noise(t, 0.05 + 0.04 * big, 'highpass', 2500, 0.7, 0.55 * (0.6 + power * 0.5), dest);
  // the scatter: a dense hail of tiny noise grains
  const grains = 6 + Math.floor(power * 8);
  for (let i = 0; i < grains; i++) {
    const tt = t + 0.01 + Math.pow(Math.random(), 1.6) * (0.18 + big * 0.2);
    noise(tt, 0.012 + Math.random() * 0.03, 'bandpass', 3500 + Math.random() * 6000, 4 + Math.random() * 6, 0.12 + Math.random() * 0.16, dest);
  }
  // tinkles: inharmonic bell partials
  const base = 1700 + Math.random() * 1600 - big * 500;
  const n = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const tt = t + Math.random() * 0.22;
    const f = base * [1, 1.51, 2.37, 2.76, 3.9, 5.4][i % 6] * (0.97 + Math.random() * 0.06);
    tone(tt, f, 0.06 + Math.random() * 0.22, 0.035 + Math.random() * 0.04, dest, 'sine');
  }
  // body thunk
  tone(t, 210 - big * 80, 0.09, 0.22 * (0.4 + big), dest, 'sine', 0.002, 70);
  if (combo > 1) chime(combo);
}

export function chime(combo) {
  if (!ctx || !enabled.sfx) return;
  const step = Math.min(combo - 2, 11);
  const semis = PENTA[step % 5] + 12 * Math.floor(step / 5);
  const f = 659.25 * Math.pow(2, semis / 12);
  const dest = out(0, 0.6);
  const t = ctx.currentTime + 0.03;
  tone(t, f, 0.5, 0.11, dest, 'sine', 0.004);
  tone(t, f * 2, 0.3, 0.035, dest, 'sine', 0.004);
  tone(t, f * 3.01, 0.16, 0.015, dest, 'triangle', 0.004);
}

export function fire() {
  if (!ctx || !enabled.sfx) return;
  const t = ctx.currentTime + 0.002;
  const dest = out(0, 0.1);
  tone(t, 180, 0.14, 0.4, dest, 'sine', 0.002, 55);
  noise(t, 0.09, 'lowpass', 1400, 0.8, 0.35, dest, 200);
  noise(t, 0.04, 'bandpass', 4000, 2, 0.06, dest);
}

export function hit(kindA, kindB, speed, x = 0.5) {
  if (!ctx || !enabled.sfx) return;
  const t = ctx.currentTime + 0.002;
  const v = Math.min(1, speed / 12);
  if (v < 0.08) return;
  const dest = out((x - 0.5) * 1.2, 0.08);
  const k = kindA === 'ball' ? kindB : kindA;
  if (k === 'wood') { tone(t, 420 + Math.random() * 120, 0.06, 0.3 * v, dest, 'triangle'); noise(t, 0.04, 'bandpass', 1100, 3, 0.25 * v, dest); }
  else if (k === 'stone') { tone(t, 160 + Math.random() * 40, 0.08, 0.4 * v, dest, 'sine'); noise(t, 0.05, 'bandpass', 700, 2, 0.3 * v, dest); }
  else if (k === 'pad') { tone(t, 300, 0.18, 0.3 * v, dest, 'sine', 0.002, 620); }
  else if (k === 'ball') { tone(t, 900, 0.05, 0.2 * v, dest, 'sine'); }
  else { tone(t, 240 + Math.random() * 60, 0.07, 0.32 * v, dest, 'sine', 0.002, 140); noise(t, 0.03, 'lowpass', 900, 1, 0.2 * v, dest); }
}

export function boom(x = 0.5) {
  if (!ctx || !enabled.sfx) return;
  const t = ctx.currentTime + 0.002;
  const dest = out((x - 0.5), 0.35);
  tone(t, 90, 0.7, 0.9, dest, 'sine', 0.003, 32);
  noise(t, 0.6, 'lowpass', 2400, 0.7, 0.9, dest, 120);
  noise(t, 0.12, 'highpass', 3000, 0.7, 0.3, dest);
}

export function win() {
  if (!ctx || !enabled.sfx) return;
  const dest = out(0, 0.7);
  const t = ctx.currentTime + 0.05;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    tone(t + i * 0.085, f, 0.9 - i * 0.08, 0.09, dest, 'sine', 0.005);
    tone(t + i * 0.085, f * 2.0, 0.4, 0.025, dest, 'sine', 0.005);
  });
}
export function lose() {
  if (!ctx || !enabled.sfx) return;
  const dest = out(0, 0.4);
  const t = ctx.currentTime + 0.02;
  [392, 329.63].forEach((f, i) => tone(t + i * 0.16, f, 0.5, 0.08, dest, 'sine', 0.01));
}
export function star(i) {
  if (!ctx || !enabled.sfx) return;
  const dest = out(0, 0.6);
  const f = [880, 1108.73, 1318.51][i] || 1318.51;
  const t = ctx.currentTime + 0.01;
  tone(t, f, 0.45, 0.1, dest, 'sine', 0.004);
  tone(t, f * 2, 0.25, 0.03, dest, 'sine', 0.004);
  noise(t, 0.08, 'highpass', 6000, 0.7, 0.05, dest);
}
export function tap() {
  if (!ctx || !enabled.sfx) return;
  const dest = out(0, 0);
  tone(ctx.currentTime + 0.001, 1400, 0.03, 0.08, dest, 'sine');
}
export function coin(i = 0) {
  if (!ctx || !enabled.sfx) return;
  const dest = out(0, 0.3);
  const t = ctx.currentTime + 0.001;
  tone(t, 1567.98 + i * 30, 0.08, 0.05, dest, 'square', 0.002);
  tone(t + 0.05, 2093 + i * 30, 0.16, 0.05, dest, 'square', 0.002);
}
export function whoosh() {
  if (!ctx || !enabled.sfx) return;
  const dest = out(0, 0.2);
  noise(ctx.currentTime + 0.001, 0.25, 'bandpass', 600, 1.2, 0.12, dest, 3000);
}

// ---------- generative ambient music ----------
let musicOn = false, musicTimer = null;
const CHORDS = [
  [48, 55, 59, 64, 67], // Cmaj7
  [45, 52, 57, 60, 64], // Am9-ish
  [41, 48, 53, 57, 64], // Fmaj7
  [43, 50, 55, 59, 62], // G6
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function startMusic() {
  if (!ctx || musicOn || !enabled.music) return;
  musicOn = true;
  let bar = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 0.3; lp.connect(musicBus);
  const tick = () => {
    if (!enabled.music) { musicOn = false; return; }
    const ch = CHORDS[bar % CHORDS.length];
    const t = ctx.currentTime + 0.1;
    const dur = 8;
    for (const m of ch) {
      for (const det of [-4, 4]) {
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.value = mtof(m); o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.022, t + 2.5);
        g.gain.linearRampToValueAtTime(0.018, t + dur - 1);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 1.6);
      }
    }
    // soft plucks
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.55) {
        const m = ch[2 + Math.floor(Math.random() * 3)] + 12;
        const tt = t + 1 + i * 1.7 + Math.random() * 0.4;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
        const g = ctx.createGain(); env(g, tt, 0.005, 0.03, 1.6);
        o.connect(g); g.connect(musicBus); g.connect(reverbSend); o.start(tt); o.stop(tt + 1.8);
      }
    }
    bar++;
    musicTimer = setTimeout(tick, dur * 1000);
  };
  tick();
}
