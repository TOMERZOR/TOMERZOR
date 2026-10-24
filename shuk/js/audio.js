// All sound is synthesized with WebAudio: no audio files to download.
// Music is a Middle-Eastern groove (darbuka maqsum rhythm, bass, plucked oud in
// the Hijaz scale) generated live, so its tempo can follow the run speed.

let ctx = null, master, sfxBus, musicBus, noiseBuf, comp;
const settings = { music: true, sfx: true };
const oudCache = new Map();

export function initAudio() {
  if (ctx) { if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
  master = ctx.createGain(); master.gain.value = 0.9;
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? 0.8 : 0;
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? 0.42 : 0;
  sfxBus.connect(comp); musicBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
  const len = ctx.sampleRate * 1.5;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });
}

export function setAudioSettings(s) {
  settings.music = !!s.music; settings.sfx = !!s.sfx;
  if (!ctx) return;
  const t = ctx.currentTime;
  musicBus.gain.setTargetAtTime(settings.music ? 0.42 : 0, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx ? 0.8 : 0, t, 0.02);
}

const ok = () => ctx && ctx.state === 'running' && settings.sfx;

function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}

function tone(type, f0, f1, t, dur, vol, dest = sfxBus, attack = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, attack, vol, dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + attack + dur + 0.05);
}

function noise(t, dur, vol, ftype, f0, f1, q = 1, dest = sfxBus, attack = 0.004) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, attack, vol, dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + attack + dur + 0.05);
}

// ---------- sound effects ----------
let lastCoin = 0;
export const sfx = {
  coin(combo = 0) {
    if (!ok()) return;
    const t = ctx.currentTime;
    if (t - lastCoin < 0.035) return; // avoid machine-gun stacking with the magnet
    lastCoin = t;
    const step = [0, 2, 4, 5, 7, 9, 11, 12][combo % 8];
    const f = 1318.5 * Math.pow(2, step / 12);
    tone('sine', f, f, t, 0.16, 0.18);
    tone('sine', f * 2.01, f * 2.01, t + 0.005, 0.09, 0.06);
    tone('triangle', f * 1.5, f * 1.5, t + 0.045, 0.14, 0.08);
  },
  jump() { if (!ok()) return; const t = ctx.currentTime;
    noise(t, 0.22, 0.22, 'bandpass', 600, 2400, 1.2); tone('sine', 260, 520, t, 0.14, 0.12); },
  superJump() { if (!ok()) return; const t = ctx.currentTime;
    tone('square', 180, 720, t, 0.3, 0.07); tone('sine', 360, 1440, t, 0.32, 0.12); noise(t, 0.35, 0.18, 'bandpass', 500, 3000, 1); },
  roll() { if (!ok()) return; const t = ctx.currentTime;
    noise(t, 0.28, 0.25, 'bandpass', 2200, 400, 1.4); tone('sine', 220, 110, t, 0.16, 0.08); },
  swipe(dir = 1) { if (!ok()) return; const t = ctx.currentTime;
    noise(t, 0.12, 0.16, 'bandpass', dir > 0 ? 1400 : 1800, dir > 0 ? 2600 : 1000, 2); },
  land() { if (!ok()) return; const t = ctx.currentTime;
    noise(t, 0.08, 0.2, 'lowpass', 500, 200, 0.7); tone('sine', 120, 60, t, 0.08, 0.15); },
  stumble() { if (!ok()) return; const t = ctx.currentTime;
    tone('sine', 140, 50, t, 0.25, 0.4); noise(t, 0.25, 0.35, 'lowpass', 900, 150, 0.8);
    tone('triangle', 900, 300, t + 0.08, 0.35, 0.09); // comic slide whistle
    crateBreak(t + 0.02, 0.6); },
  crash() { if (!ok()) return; const t = ctx.currentTime;
    tone('sine', 110, 35, t, 0.5, 0.55); noise(t, 0.45, 0.5, 'lowpass', 1600, 120, 0.7);
    crateBreak(t, 1);
    tone('triangle', 1100, 180, t + 0.15, 0.7, 0.1); },
  powerup() { if (!ok()) return; const t = ctx.currentTime;
    [0, 4, 7, 12, 16].forEach((s, i) => tone('triangle', 523.25 * Math.pow(2, s / 12), 523.25 * Math.pow(2, s / 12), t + i * 0.055, 0.22, 0.12));
    noise(t, 0.4, 0.08, 'highpass', 5000, 9000, 0.7); },
  shieldBreak() { if (!ok()) return; const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) tone('sine', 2000 + Math.random() * 3000, 1500, t + i * 0.025, 0.25, 0.06);
    noise(t, 0.3, 0.25, 'highpass', 3000, 6000, 0.8); },
  powerEnd() { if (!ok()) return; const t = ctx.currentTime;
    tone('triangle', 660, 330, t, 0.25, 0.1); tone('triangle', 495, 247, t + 0.1, 0.25, 0.08); },
  click() { if (!ok()) return; const t = ctx.currentTime; tone('sine', 900, 600, t, 0.05, 0.12); noise(t, 0.03, 0.08, 'highpass', 3000, 3000, 1); },
  buy() { if (!ok()) return; const t = ctx.currentTime; // cash register "ka-ching"
    noise(t, 0.06, 0.25, 'bandpass', 2500, 2500, 3); tone('square', 1568, 1568, t + 0.06, 0.08, 0.05);
    tone('sine', 2093, 2093, t + 0.1, 0.5, 0.18); tone('sine', 2637, 2637, t + 0.1, 0.45, 0.1); },
  denied() { if (!ok()) return; const t = ctx.currentTime; tone('square', 220, 200, t, 0.12, 0.06); tone('square', 180, 160, t + 0.13, 0.16, 0.06); },
  levelUp() { if (!ok()) return; const t = ctx.currentTime;
    [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => tone('triangle', 392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12), t + i * 0.08, 0.3, 0.12)); },
  mission() { if (!ok()) return; const t = ctx.currentTime;
    [0, 7, 12].forEach((s, i) => tone('sine', 784 * Math.pow(2, s / 12), 784 * Math.pow(2, s / 12), t + i * 0.07, 0.3, 0.14)); },
  horn() { if (!ok()) return; const t = ctx.currentTime;
    tone('square', 420, 410, t, 0.18, 0.05); tone('square', 520, 505, t, 0.18, 0.04);
    tone('square', 420, 410, t + 0.22, 0.25, 0.05); tone('square', 520, 505, t + 0.22, 0.25, 0.04); },
  zone() { if (!ok()) return; const t = ctx.currentTime;
    [0, 3, 7, 10, 12].forEach((s, i) => tone('triangle', 293.66 * Math.pow(2, s / 12), 293.66 * Math.pow(2, s / 12), t + i * 0.09, 0.4, 0.1)); },
  whistle() { if (!ok()) return; const t = ctx.currentTime; // inspector's whistle
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 2600; lfo.frequency.value = 38; lg.gain.value = 140;
    lfo.connect(lg); lg.connect(o.frequency); env(g, t, 0.01, 0.12, 0.5);
    o.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6); },
  countdown(final) { if (!ok()) return; const t = ctx.currentTime; tone('sine', final ? 1046 : 784, final ? 1046 : 784, t, final ? 0.4 : 0.15, 0.16); },
};

function crateBreak(t, amt) {
  for (let i = 0; i < 4; i++) noise(t + i * 0.03 + Math.random() * 0.02, 0.07, 0.2 * amt, 'bandpass', 700 + Math.random() * 900, 400, 3);
}

// ---------- recorded voice lines (Hebrew shouts) ----------
const voices = {};
let lastVoice = -10;
export function loadVoices(names) {
  if (!ctx) return;
  for (const n of names) {
    if (voices[n]) continue;
    fetch(`audio/${n}.mp3`).then(r => { if (!r.ok) throw new Error(n); return r.arrayBuffer(); })
      .then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then(buf => { voices[n] = buf; }).catch(() => { /* optional asset */ });
  }
}
// returns true if the line was played; lines don't overlap each other
export function voice(name, pan = 0, vol = 1, force = false) {
  if (!ok() || !voices[name]) return false;
  const t = ctx.currentTime;
  if (!force && t - lastVoice < 2.8) return false;
  lastVoice = t;
  const s = ctx.createBufferSource(); s.buffer = voices[name];
  const g = ctx.createGain(); g.gain.value = 0.9 * vol;
  let out = g;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  s.connect(g); out.connect(sfxBus);
  s.start(t);
  return true;
}

// ---------- music ----------
// Hijaz on D: D Eb F# G A Bb C
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

function oudBuffer(midi) {
  if (oudCache.has(midi)) return oudCache.get(midi);
  // Karplus-Strong plucked string, rendered once per pitch.
  const sr = ctx.sampleRate, dur = 1.1, n = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / midiHz(midi)));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / period * Math.PI));
  let idx = 0, prev = 0;
  const decay = 0.996 - (midi - 50) * 0.0004;
  for (let i = 0; i < n; i++) {
    const cur = ring[idx];
    const next = ring[(idx + 1) % period];
    const v = decay * 0.5 * (cur + next);
    ring[idx] = v;
    out[i] = cur * 0.7 + prev * 0.3; prev = cur;
    idx = (idx + 1) % period;
  }
  // gentle fade to avoid clicks
  for (let i = n - 2000; i < n; i++) out[i] *= (n - i) / 2000;
  oudCache.set(midi, buf);
  return buf;
}

function pluck(t, midi, vol) {
  const s = ctx.createBufferSource(); s.buffer = oudBuffer(midi);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(musicBus);
  s.start(t); s.stop(t + 1.1);
}

function dum(t, v) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.18);
  env(g, t, 0.004, 0.55 * v, 0.32); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.4);
  noise(t, 0.05, 0.12 * v, 'lowpass', 400, 200, 0.7, musicBus);
}
function tek(t, v) {
  noise(t, 0.045, 0.26 * v, 'bandpass', 3800, 3000, 1.6, musicBus, 0.002);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 1900; env(g, t, 0.002, 0.05 * v, 0.03); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.06);
}
function ka(t, v) { noise(t, 0.035, 0.16 * v, 'bandpass', 2600, 2200, 1.5, musicBus, 0.002); }
function bass(t, midi, dur, v) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = midiHz(midi);
  f.type = 'lowpass'; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(180, t + dur); f.Q.value = 3;
  env(g, t, 0.01, 0.2 * v, dur); o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
}
function pad(t, midis, dur, v) {
  for (const m of midis) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = midiHz(m); o.detune.value = (Math.random() - 0.5) * 12;
    f.type = 'lowpass'; f.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 * v, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.1);
  }
}

const music = {
  on: false, mode: 'menu', bpm: 96, nextTime: 0, step: 0, timer: null, intensity: 0,
  melody: [], rnd: 1,
};

function scaleNote(deg, base = 62) { // base D4
  const oct = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7;
  return base + oct * 12 + HIJAZ[i];
}

function makeMelody() {
  // 16-step phrase over 2 bars, call-and-response shaped
  const m = []; let deg = 4;
  for (let i = 0; i < 32; i++) {
    const strong = i % 4 === 0;
    if (Math.random() < (strong ? 0.85 : 0.45)) {
      deg += [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)];
      deg = Math.max(0, Math.min(10, deg));
      m.push(deg);
    } else m.push(null);
  }
  // resolve phrase ends on the tonic / dominant
  m[15] = 4; m[31] = 0; m[30] = null;
  return m;
}

// maqsum: D T - T D - T -  (8 eighths per bar)
const MAQSUM = ['D', 'T', '', 'T', 'D', '', 'T', ''];
const CHORDS = [0, 0, -2, -2, -4, -4, -5, -3]; // per half-bar scale degree of the bass

function schedule() {
  if (!ctx || !music.on) return;
  const ahead = 0.15;
  while (music.nextTime < ctx.currentTime + ahead) {
    playStep(music.nextTime, music.step);
    const sixteenth = 60 / music.bpm / 4;
    music.nextTime += sixteenth;
    music.step = (music.step + 1) % 64;
  }
}

function playStep(t, step) {
  const inten = music.mode === 'run' ? 1 : 0.55;
  const s16 = step % 16; // one bar = 16 sixteenths
  const eighth = s16 / 2;
  // drums
  if (s16 % 2 === 0) {
    const hit = MAQSUM[eighth];
    if (hit === 'D') dum(t, inten);
    else if (hit === 'T') tek(t, inten);
    else if (music.mode === 'run' && Math.random() < 0.5) ka(t, 0.6);
  } else if (music.mode === 'run' && Math.random() < 0.28 + music.intensity * 0.3) ka(t, 0.45);
  // bass on beats 1 and 3
  const bar = Math.floor(step / 16) % 4;
  if (s16 === 0 || s16 === 8) {
    const deg = CHORDS[(bar * 2 + (s16 === 8 ? 1 : 0)) % CHORDS.length];
    bass(t, scaleNote(deg, 38), 60 / music.bpm * 0.9, inten);
  }
  if (s16 === 0 && bar % 2 === 0) {
    const root = scaleNote(CHORDS[bar * 2], 50);
    pad(t, [root, root + 7, root + 12], 60 / music.bpm * 8, music.mode === 'menu' ? 1.2 : 0.8);
  }
  // melody on eighths (and some sixteenth ornaments in the run)
  if (s16 % 2 === 0) {
    const mi = (Math.floor(step / 2)) % 32;
    if (mi === 0 && Math.random() < 0.35) music.melody = makeMelody();
    const deg = music.melody[mi];
    if (deg !== null && deg !== undefined) {
      pluck(t, scaleNote(deg, 62), 0.5 * inten + 0.1);
      if (music.mode === 'run' && Math.random() < 0.25) pluck(t + 60 / music.bpm / 4, scaleNote(deg + 1, 62), 0.25);
    }
  }
}

export function startMusic(mode = 'menu') {
  if (!ctx) return;
  music.mode = mode;
  music.bpm = mode === 'run' ? 112 : 92;
  if (!music.melody.length) music.melody = makeMelody();
  if (music.on) return;
  music.on = true; music.step = 0; music.nextTime = ctx.currentTime + 0.08;
  music.timer = setInterval(schedule, 25);
}
export function setMusicMode(mode) { if (!ctx) return; music.mode = mode; if (mode === 'menu') music.bpm = 92; }
export function setMusicIntensity(x) { // 0..1 with run speed
  music.intensity = x;
  if (music.mode === 'run') music.bpm = 112 + x * 30;
}
export function stopMusic() { music.on = false; if (music.timer) clearInterval(music.timer); music.timer = null; }
export function duckMusic(on) { if (!ctx) return; musicBus.gain.setTargetAtTime(settings.music ? (on ? 0.12 : 0.42) : 0, ctx.currentTime, 0.15); }
