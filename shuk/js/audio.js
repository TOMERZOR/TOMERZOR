// Music and sound effects are synthesized live with WebAudio (no files to download).

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

function panned(pan) {
  if (!ctx.createStereoPanner) return sfxBus;
  const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(sfxBus);
  return p;
}

// ---------- sound effects ----------
let lastCoin = 0;
// coins picked up in the air climb this scale (major pentatonic, two octaves), one note per coin
const AIR_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
let wind = null, engine = null;
export const sfx = {
  // On the ground every coin is the same bright ding. Strung together in one jump (or a carpet ride)
  // they climb a scale: pass air = how many coins this jump has already collected.
  coin(air = -1) {
    if (!ok()) return;
    const t = ctx.currentTime;
    if (t - lastCoin < 0.035) return; // avoid machine-gun stacking with the magnet
    lastCoin = t;
    const f = 1318.5 * Math.pow(2, (air < 0 ? 0 : AIR_STEPS[air % AIR_STEPS.length]) / 12);
    tone('sine', f, f, t, 0.15, 0.18);
    tone('sine', f * 2, f * 2, t, 0.07, 0.045);
    if (air >= 0) tone('triangle', f * 3, f * 3, t, 0.05, 0.025); // a little extra sparkle up there
  },
  // soft footfalls, alternating feet
  step(side = 1, v = 1) { if (!ok()) return; const t = ctx.currentTime, out = panned(side * 0.25);
    noise(t, 0.045, 0.07 * v, 'lowpass', 1100, 320, 0.8, out, 0.002); tone('sine', 95, 55, t, 0.05, 0.05 * v, out); },
  // air rushing past when a walker or a van just misses you
  whoosh(pan = 0) { if (!ok()) return; const t = ctx.currentTime;
    noise(t, 0.3, 0.2, 'bandpass', 2600, 500, 1.3, panned(pan), 0.06); },
  // a streak of coins pays out: a quick shower of coin notes
  streak() { if (!ok()) return; const t = ctx.currentTime;
    [0, 4, 7, 12, 16, 19, 24].forEach((st, i) => { const f = 1318.5 * Math.pow(2, st / 12); tone('sine', f, f, t + i * 0.045, 0.16, 0.12); });
    noise(t, 0.5, 0.06, 'highpass', 6000, 9000, 0.7); },
  // the mystery bag: paper rustle, a pop, a little fanfare
  bag() { if (!ok()) return; const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) noise(t + i * 0.035 + Math.random() * 0.01, 0.04, 0.12, 'bandpass', 2500 + Math.random() * 2000, 3000, 0.8);
    tone('sine', 900, 180, t + 0.19, 0.08, 0.2); noise(t + 0.19, 0.06, 0.2, 'lowpass', 2000, 400, 0.7);
    [0, 4, 7, 12].forEach((st, i) => tone('triangle', 659.25 * Math.pow(2, st / 12), 659.25 * Math.pow(2, st / 12), t + 0.26 + i * 0.06, 0.25, 0.1)); },
  // the magic carpet: lift-off with a harp run, wind while flying, a swoop down to land
  carpetUp() { if (!ok()) return; const t = ctx.currentTime;
    noise(t, 0.7, 0.2, 'bandpass', 300, 4000, 1.2, sfxBus, 0.25);
    [0, 2, 4, 7, 9, 12, 14, 16].forEach((st, i) => tone('triangle', 587.33 * Math.pow(2, st / 12), 587.33 * Math.pow(2, st / 12), t + i * 0.04, 0.35, 0.07)); },
  carpetDown() { if (!ok()) return; const t = ctx.currentTime; noise(t, 0.5, 0.18, 'bandpass', 3000, 350, 1.2, sfxBus, 0.05); },
  wind(on) {
    if (!ctx) return;
    if (on && !wind && ok()) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.5);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 260;
      lfo.connect(lg); lg.connect(f.frequency);
      s.connect(f); f.connect(g); g.connect(sfxBus); s.start(); lfo.start();
      wind = { s, g, lfo };
    } else if (!on && wind) {
      const w = wind, t = ctx.currentTime; wind = null;
      w.g.gain.cancelScheduledValues(t); w.g.gain.setTargetAtTime(0.0001, t, 0.15);
      w.s.stop(t + 0.8); w.lfo.stop(t + 0.8);
    }
  },
  // oncoming traffic: a two-note horn (a long, falling blast when you are still in its way)
  carHorn(pan = 0, long = false) { if (!ok()) return; const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.connect(panned(pan));
    const blast = (t0, dur) => { for (const [f, v] of [[349.2, 0.06], [440, 0.05], [698.5, 0.015]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0);
      if (long) { o.frequency.setValueAtTime(f, t0 + dur * 0.55); o.frequency.exponentialRampToValueAtTime(f * 0.93, t0 + dur); }
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.015);
      g.gain.setValueAtTime(v, t0 + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    } };
    if (long) blast(t, 0.8); else { blast(t, 0.15); blast(t + 0.2, 0.26); }
  },
  // dodged traffic at the last moment: it tears past, a thump, a bright rising chord
  closeCall(pan = 0, hair = false) { if (!ok()) return; const t = ctx.currentTime;
    noise(t, 0.6, 0.34, 'bandpass', 3800, 360, 1.1, panned(pan), 0.03);
    tone('sine', 120, 40, t, 0.45, 0.24);
    const base = hair ? 783.99 : 659.25;
    [0, 7, 12, 19].forEach((st, i) => { const f = base * Math.pow(2, st / 12); tone('triangle', f, f, t + 0.07 + i * 0.05, 0.45, 0.075); });
    noise(t + 0.07, 0.6, 0.05, 'highpass', 7000, 9000, 0.7);
  },
  // engine of the nearest oncoming vehicle: level 0..1, rate > 1 while it approaches (Doppler), < 1 once past
  engine(level, rate = 1, pan = 0) {
    if (!ctx) return;
    if (!engine) {
      if (level <= 0 || !ok()) return;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 2;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const oscs = [['sawtooth', 52], ['square', 104.6], ['sawtooth', 78.3]].map(([type, hz]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; o.connect(f); o.start(); return [o, hz];
      });
      f.connect(g);
      if (p) { g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus);
      engine = { g, f, p, oscs };
    }
    const t = ctx.currentTime, v = ok() ? level : 0;
    engine.g.gain.setTargetAtTime(Math.max(0.0001, v * 0.14), t, 0.05);
    for (const [o, hz] of engine.oscs) o.frequency.setTargetAtTime(hz * rate, t, 0.06);
    engine.f.frequency.setTargetAtTime(280 + 520 * v * rate, t, 0.06);
    if (engine.p) engine.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05);
  },
  // a power-up is about to run out
  tick() { if (!ok()) return; const t = ctx.currentTime; tone('square', 1760, 1760, t, 0.04, 0.035); },
  revive() { if (!ok()) return; const t = ctx.currentTime;
    noise(t, 0.6, 0.16, 'bandpass', 400, 5000, 1.4, sfxBus, 0.3);
    [0, 7, 12, 19].forEach((st, i) => tone('sine', 523.25 * Math.pow(2, st / 12), 523.25 * Math.pow(2, st / 12), t + 0.3 + i * 0.07, 0.45, 0.12)); },
  // the run is over: a sad trombone, or a fanfare for a new best
  gameOver(best = false) { if (!ok()) return; const t = ctx.currentTime;
    if (best) { [0, 4, 7, 12, 7, 12, 16].forEach((st, i) => tone('triangle', 523.25 * Math.pow(2, st / 12), 523.25 * Math.pow(2, st / 12), t + i * 0.09, i === 6 ? 0.7 : 0.25, 0.13)); return; }
    [[0, 0.32], [-1, 0.32], [-2, 0.32], [-3, 0.9]].forEach(([st, d], i) => {
      const at = t + i * 0.36, f = 233.08 * Math.pow(2, st / 12);
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.02, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.08);
      if (i === 3) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = f * 0.03; l.connect(lg); lg.connect(o.frequency); l.start(at + 0.15); l.stop(at + d + 0.1); }
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, at); lp.frequency.linearRampToValueAtTime(1300, at + 0.1); lp.frequency.linearRampToValueAtTime(600, at + d);
      env(g, at, 0.03, 0.09, d); o.connect(lp); lp.connect(g); g.connect(sfxBus); o.start(at); o.stop(at + d + 0.1);
    }); },
  swish() { if (!ok()) return; const t = ctx.currentTime; noise(t, 0.16, 0.08, 'bandpass', 1200, 3200, 1.2, sfxBus, 0.04); },
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

// ---------- music ----------
// A Mizrahi dance-pop groove in Hijaz on D: four-on-the-floor kick under a darbuka maqsum, claps on the
// backbeat, riq and hats, a syncopated 3-3-2 bass, offbeat keyboard stabs that duck under the kick, and a
// written two-phrase hook on a zurna-like lead (the oud plays it in the menu). Tempo follows the run speed.
// Hijaz on D: D Eb F# G A Bb C
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
const deg = (d, base = 62) => base + Math.floor(d / 7) * 12 + HIJAZ[((d % 7) + 7) % 7];

// one chord per bar over 8 bars: D  Eb  D  Cm  D  Gm  Eb  D  (bass root midi, triad)
const PROG = [[38, [0, 4, 7]], [39, [0, 4, 7]], [38, [0, 4, 7]], [36, [0, 3, 7]], [38, [0, 4, 7]], [43, [0, 3, 7]], [39, [0, 4, 7]], [38, [0, 4, 7]]];
// the hook: [16th step within a 2-bar phrase, scale degree]
const HOOK = {
  A: [[0, 4], [2, 4], [3, 5], [4, 4], [6, 3], [8, 2], [10, 3], [11, 2], [12, 1], [14, 0], [18, 2], [20, 3], [22, 4], [24, 5], [26, 4], [28, 3], [30, 4]],
  B: [[0, 7], [2, 6], [3, 7], [4, 5], [6, 4], [8, 5], [10, 4], [11, 3], [12, 4], [16, 3], [18, 2], [19, 3], [20, 4], [22, 2], [24, 1], [26, 2], [28, 0]],
};
// 16-bar song form, one entry per 2-bar phrase: which hook (null = darbuka break)
const FORM = ['A', 'A', 'B', 'A', 'B', 'A', null, 'A'];
// bass 3-3-2 with a pickup, in 16ths: [step, octave up?]
const BASS = [[0, 0], [3, 1], [6, 0], [8, 0], [11, 1], [14, 0]];
// darbuka maqsum on 16ths: D . . . T . T . D . . . T . . .
const MAQSUM = { 0: 'D', 4: 'T', 6: 'T', 8: 'D', 12: 'T' };

let synthBus = null, leadBus = null, delay = null;
function musicNodes() {
  if (synthBus) return;
  synthBus = ctx.createGain(); synthBus.connect(musicBus);
  leadBus = ctx.createGain(); leadBus.gain.value = 1; leadBus.connect(synthBus);
  // a dotted-eighth echo on the lead: space without a reverb's cost
  delay = ctx.createDelay(1); const fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain();
  fb.gain.value = 0.3; lp.type = 'lowpass'; lp.frequency.value = 2600; wet.gain.value = 0.22;
  leadBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(musicBus);
}

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
    ring[idx] = decay * 0.5 * (cur + next);
    out[i] = cur * 0.7 + prev * 0.3; prev = cur;
    idx = (idx + 1) % period;
  }
  for (let i = n - 2000; i < n; i++) out[i] *= (n - i) / 2000; // fade to avoid clicks
  oudCache.set(midi, buf);
  return buf;
}
function pluck(t, midi, vol) {
  const s = ctx.createBufferSource(); s.buffer = oudBuffer(midi);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(synthBus);
  s.start(t); s.stop(t + 1.1);
}

// ---- drums ----
function kick(t, v) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
  env(g, t, 0.002, 0.95 * v, 0.3); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.36);
  noise(t, 0.012, 0.18 * v, 'highpass', 3000, 3000, 0.7, musicBus, 0.001);
  // the stabs and lead breathe with the kick
  synthBus.gain.cancelScheduledValues(t);
  synthBus.gain.setValueAtTime(0.45, t); synthBus.gain.linearRampToValueAtTime(1, t + 0.16);
}
function clap(t, v) {
  for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.02, 0.22 * v, 'bandpass', 1300, 1100, 0.9, musicBus, 0.001);
  noise(t + 0.03, 0.14, 0.16 * v, 'bandpass', 1500, 900, 0.8, musicBus, 0.002);
}
function hat(t, v, open = false) { noise(t, open ? 0.13 : 0.035, (open ? 0.07 : 0.085) * v, 'highpass', 7500, 9000, 0.8, musicBus, 0.001); }
function riq(t, v) { noise(t, 0.07, 0.07 * v, 'bandpass', 8500, 7000, 5, musicBus, 0.001); }
function dum(t, v) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.16);
  env(g, t, 0.003, 0.38 * v, 0.24); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3);
}
function tek(t, v) {
  noise(t, 0.04, 0.24 * v, 'bandpass', 3900, 3100, 1.6, musicBus, 0.001);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 1950; env(g, t, 0.001, 0.05 * v, 0.03); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.06);
}
function ka(t, v) { noise(t, 0.03, 0.14 * v, 'bandpass', 2700, 2300, 1.5, musicBus, 0.001); }
function riser(t, dur, v) { noise(t, dur, 0.1 * v, 'bandpass', 500, 7000, 2.5, musicBus, dur * 0.95); }
function cymbal(t, v) { noise(t, 1.1, 0.07 * v, 'highpass', 5000, 9000, 0.6, musicBus, 0.002); }

// ---- pitched parts ----
function bass(t, midi, dur, v) {
  const o = ctx.createOscillator(), s = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = midiHz(midi);
  s.type = 'sine'; s.frequency.value = midiHz(midi);
  f.type = 'lowpass'; f.Q.value = 4; f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(220, t + dur * 0.9);
  env(g, t, 0.006, 0.24 * v, dur);
  o.connect(f); s.connect(g); f.connect(g); g.connect(musicBus);
  o.start(t); s.start(t); o.stop(t + dur + 0.05); s.stop(t + dur + 0.05);
}
function stab(t, midis, v) {
  for (const m of midis) for (const det of [-9, 9]) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = midiHz(m); o.detune.value = det;
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.16);
    env(g, t, 0.003, 0.028 * v, 0.17);
    o.connect(f); f.connect(g); g.connect(synthBus); o.start(t); o.stop(t + 0.24);
  }
}
let lastLead = 0;
function lead(t, midi, dur, v) {
  const f0 = midiHz(midi), from = lastLead ? midiHz(lastLead) : f0; lastLead = midi;
  const g = ctx.createGain(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9;
  lp.type = 'lowpass'; lp.frequency.value = 3600;
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f0 * 0.012, t + Math.min(0.25, dur));
  lfo.connect(lg);
  for (const [type, mul, vol] of [['sawtooth', 1, 1], ['square', 0.5, 0.35]]) {
    const o = ctx.createOscillator();
    o.type = type;
    // a quick slide from the previous note: the ornament that makes it sing like a zurna
    o.frequency.setValueAtTime(from * mul, t); o.frequency.exponentialRampToValueAtTime(f0 * mul, t + 0.035);
    lg.connect(o.frequency);
    const og = ctx.createGain(); og.gain.value = vol;
    o.connect(og); og.connect(bp); o.start(t); o.stop(t + dur + 0.12);
  }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1 * v, t + 0.012);
  g.gain.setValueAtTime(0.1 * v, t + Math.max(0.02, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  bp.connect(lp); lp.connect(g); g.connect(leadBus);
  lfo.start(t); lfo.stop(t + dur + 0.12);
}
function pad(t, midis, dur, v) {
  for (const m of midis) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = midiHz(m); o.detune.value = (Math.random() - 0.5) * 12;
    f.type = 'lowpass'; f.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 * v, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(synthBus); o.start(t); o.stop(t + dur + 0.1);
  }
}

const music = { on: false, mode: 'menu', bpm: 104, nextTime: 0, step: 0, timer: null, intensity: 0 };

function schedule() {
  if (!ctx || !music.on) return;
  while (music.nextTime < ctx.currentTime + 0.12) {
    playStep(music.nextTime, music.step);
    music.nextTime += 60 / music.bpm / 4;
    music.step = (music.step + 1) % 256; // 16 bars of 16ths
  }
}

function playStep(t, step) {
  const run = music.mode === 'run', x = music.intensity;
  const s = step % 16, bar = Math.floor(step / 16), phrase = Math.floor(bar / 2) % FORM.length;
  const hook = FORM[phrase], breakBar = hook === null;
  const [root, triad] = PROG[bar % PROG.length];
  const sixteenth = 60 / music.bpm / 4;
  // ---- drums ----
  if (run) {
    if (s % 4 === 0 && !(breakBar && bar % 2 === 1 && s >= 8)) kick(t, 1);
    if ((s === 4 || s === 12) && !breakBar) clap(t, 0.9);
    if (s % 2 === 1 || x > 0.45) hat(t, s % 4 === 2 ? 1 : 0.55, s === 14);
  } else {
    if (s === 0 || s === 8 || s === 11) kick(t, s === 11 ? 0.55 : 0.85);
    if (s % 4 === 2) riq(t, 1);
  }
  const hit = MAQSUM[s];
  if (hit === 'D') dum(t, run ? 0.9 : 1);
  else if (hit === 'T') tek(t, run ? 0.9 : 1);
  else if (run && Math.random() < 0.25 + x * 0.35) ka(t, 0.6);
  // darbuka roll into every fourth bar, and through the break
  if ((bar % 4 === 3 || breakBar) && s >= 12) { tek(t, 0.7); ka(t + sixteenth / 2, 0.55); }
  if (run && bar % 16 === 15 && s === 0) riser(t, sixteenth * 16, 1);
  if (run && bar % 16 === 0 && s === 0) cymbal(t, 1);
  // ---- bass and stabs ----
  for (const [bs, up] of BASS) if (bs === s && (run || bs % 4 !== 3)) bass(t, root + (up ? 12 : 0), sixteenth * (up ? 1.6 : 2.6), run ? 1 : 0.8);
  if (s % 4 === 2 && !(breakBar && run)) stab(t, triad.map(i => root + 24 + i), run ? 1 : 0.6);
  if (!run && s === 0 && bar % 2 === 0) pad(t, triad.map(i => root + 24 + i).concat(root + 36), sixteenth * 32, 1.1);
  // ---- the hook ----
  if (hook) {
    const notes = HOOK[hook], ps = (bar % 2) * 16 + s;
    const k = notes.findIndex(n => n[0] === ps);
    if (k >= 0) {
      const next = notes[k + 1] ? notes[k + 1][0] : 32;
      const len = Math.min(4, next - ps) * sixteenth;
      const up = run && x > 0.55 && phrase >= 4 ? 12 : 0;   // an octave higher once the run is flying
      const m = deg(notes[k][1]) + up;
      if (run) lead(t, m, len * 0.92, 0.85 + x * 0.3);
      else { pluck(t, m, 0.5); if (Math.random() < 0.3) pluck(t + sixteenth, deg(notes[k][1] + 1), 0.22); }
    }
  }
}

export function startMusic(mode = 'menu') {
  if (!ctx) return;
  musicNodes();
  setMusicMode(mode);
  if (music.on) return;
  music.on = true; music.step = 0; music.nextTime = ctx.currentTime + 0.08;
  music.timer = setInterval(schedule, 25);
}
export function setMusicMode(mode) {
  if (!ctx) return;
  musicNodes();
  if (mode !== music.mode) { music.step = 0; lastLead = 0; } // each mode starts from the top of the song
  music.mode = mode;
  music.bpm = mode === 'run' ? 126 + music.intensity * 22 : 104;
  delay.delayTime.setTargetAtTime(60 / music.bpm * 0.75, ctx.currentTime, 0.05);
}
export function setMusicIntensity(x) { // 0..1 with run speed
  music.intensity = x;
  if (music.mode !== 'run' || !ctx) return;
  music.bpm = 126 + x * 22;
  if (delay) delay.delayTime.setTargetAtTime(60 / music.bpm * 0.75, ctx.currentTime, 0.2);
}
export function stopMusic() { music.on = false; if (music.timer) clearInterval(music.timer); music.timer = null; }
export function duckMusic(on) { if (!ctx) return; musicBus.gain.setTargetAtTime(settings.music ? (on ? 0.12 : 0.42) : 0, ctx.currentTime, 0.15); }
