// Sound: the recorded voice lines (voice/*.mp3) plus effects and music made
// on the fly with Web Audio, so nothing else needs downloading.

let ctx = null, master = null, sfxBus = null, musicBus = null, voiceBus = null;
const buffers = new Map();
let muted = false;
try { muted = localStorage.getItem("ok_muted") === "1"; } catch {}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(comp);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.15; voiceBus.connect(comp);
    noiseBuf = makeNoise();
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem("ok_muted", m ? "1" : "0"); } catch {}
  if (master) master.gain.value = m ? 0 : 0.9;
}

async function load(name) {
  if (buffers.has(name)) return buffers.get(name);
  const p = fetch(`voice/${name}.mp3`).then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).catch(() => null);
  buffers.set(name, p);
  return p;
}
export function preloadVoices(names) { if (ctx) for (const n of names) load(n); }

let lastVoice = null;
// cut: stop the previous line (announcer interrupts taunts)
export async function voice(name, { cut = false, gain = 1 } = {}) {
  if (!ctx) return;
  const buf = await load(name);
  if (!buf) return;
  if (cut && lastVoice) { try { lastVoice.stop(); } catch {} }
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(g); g.connect(voiceBus);
  src.start();
  lastVoice = src;
  // duck the music under speech
  if (musicBus) {
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(0.14, t, 0.05);
    musicBus.gain.setTargetAtTime(0.32, t + buf.duration, 0.3);
  }
}

// ---------- effects ----------
let noiseBuf = null;
function makeNoise() {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function noise(t, dur, { type = "bandpass", f = 1000, q = 1, gain = 0.5, f2 = null, attack = 0.002 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxBus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(t, dur, { type = "sine", f = 200, f2 = null, gain = 0.4, attack = 0.003, bus = sfxBus } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}

export function sfx(kind, opt = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + 0.005;
  const v = 0.9 + Math.random() * 0.2;
  switch (kind) {
    case "hit": {
      const big = opt.big;
      tone(t, big ? 0.22 : 0.13, { f: (big ? 120 : 170) * v, f2: 45, gain: big ? 0.9 : 0.6 });
      noise(t, big ? 0.16 : 0.08, { f: 1800 * v, q: 0.8, gain: big ? 0.7 : 0.5, f2: 500 });
      noise(t, 0.03, { type: "highpass", f: 4000, gain: 0.35 });
      break;
    }
    case "slap": {
      noise(t, 0.09, { type: "highpass", f: 1800 * v, gain: 0.8 });
      tone(t, 0.08, { f: 260 * v, f2: 120, gain: 0.3 });
      break;
    }
    case "block": {
      noise(t, 0.05, { f: 3200, q: 3, gain: 0.45 });
      tone(t, 0.06, { type: "square", f: 900, f2: 500, gain: 0.12 });
      break;
    }
    case "whoosh": {
      noise(t, 0.2, { f: 600, q: 0.7, gain: 0.25, f2: 2400, attack: 0.06 });
      break;
    }
    case "jump": noise(t, 0.12, { f: 400, q: 0.6, gain: 0.2, f2: 1200 }); break;
    case "land": tone(t, 0.12, { f: opt.hard ? 90 : 120, f2: 40, gain: opt.hard ? 0.8 : 0.3 }); if (opt.hard) noise(t, 0.2, { type: "lowpass", f: 600, gain: 0.5 }); break;
    case "chair": {
      // cheap plastic smashing: hollow knocks and a crackle
      for (let i = 0; i < 4; i++) tone(t + i * 0.03, 0.09, { type: "triangle", f: (520 - i * 60) * v, f2: 200, gain: 0.5 });
      noise(t, 0.35, { f: 2600, q: 0.6, gain: 0.8, f2: 700 });
      tone(t, 0.3, { f: 80, f2: 35, gain: 0.9 });
      break;
    }
    case "phone": {
      // glass crack
      for (let i = 0; i < 5; i++) noise(t + i * 0.018, 0.05, { type: "highpass", f: 5000 + i * 600, gain: 0.5 });
      tone(t, 0.2, { type: "sine", f: 2400, f2: 1800, gain: 0.08 });
      break;
    }
    case "bag": tone(t, 0.2, { f: 110, f2: 50, gain: 0.8 }); noise(t, 0.15, { type: "lowpass", f: 900, gain: 0.5 }); break;
    case "throw": noise(t, 0.25, { f: 900, q: 0.8, gain: 0.3, f2: 2000, attack: 0.05 }); break;
    case "flash": tone(t, 0.25, { type: "sine", f: 3000, f2: 6000, gain: 0.12 }); noise(t, 0.08, { type: "highpass", f: 6000, gain: 0.4 }); break;
    case "puff": noise(t, 0.6, { type: "lowpass", f: 900, gain: 0.35, attack: 0.08, f2: 300 }); break;
    case "super": {
      tone(t, 0.9, { type: "sawtooth", f: 80, f2: 400, gain: 0.25 });
      noise(t, 0.8, { f: 300, q: 0.5, gain: 0.35, f2: 3000, attack: 0.3 });
      break;
    }
    case "ko": {
      tone(t, 1.2, { f: 60, f2: 30, gain: 1 });
      noise(t, 0.6, { type: "lowpass", f: 400, gain: 0.7 });
      break;
    }
    case "select": tone(t, 0.08, { type: "square", f: 660, gain: 0.08 }); tone(t + 0.05, 0.1, { type: "square", f: 990, gain: 0.08 }); break;
    case "move": tone(t, 0.05, { type: "triangle", f: 520, gain: 0.08 }); break;
    case "bell": for (const f of [523, 659, 784]) tone(t, 1.2, { type: "triangle", f, gain: 0.12 }); break;
  }
}

// ---------- music: a looping hijaz trap beat ----------
let musicTimer = null, musicStep = 0, nextTime = 0, musicOn = false, songIntensity = 1;
const BPM = 140;
const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12];
const ROOT = 146.83; // D3
const MELODY = [7, -1, 8, 7, 5, -1, 4, 5, 4, 1, 0, -1, 1, 4, 5, -1, 7, -1, 8, 10, 8, 7, 5, 4, 5, 4, 1, -1, 0, -1, -1, -1];
const BASS = [0, -1, -1, 0, -1, -1, 0, -1, 5, -1, -1, 5, -1, -1, 4, -1];
// darbuka: d = doum (low), t = tek (high), k = ka
const DARB = "d..t.kt.d.dt.kt.";

function noteHz(semi) { return ROOT * Math.pow(2, semi / 12); }

function scheduleStep(step, t) {
  const sixteenth = 60 / BPM / 4;
  const s16 = step % 16;
  const d = DARB[s16];
  if (d === "d") { tone(t, 0.25, { f: 110, f2: 55, gain: 0.55, bus: musicBus }); }
  if (d === "t") { noise(t, 0.06, { f: 3500, q: 2, gain: 0.32, attack: 0.001 }); }
  if (d === "k") { noise(t, 0.04, { f: 2500, q: 3, gain: 0.18, attack: 0.001 }); }
  // trap hats
  if (songIntensity > 0 && step % 2 === 0) noise(t, 0.025, { type: "highpass", f: 8000, gain: 0.08 });
  if (songIntensity > 1 && step % 32 > 27) noise(t + sixteenth / 2, 0.02, { type: "highpass", f: 8000, gain: 0.07 });
  // 808 bass
  const b = BASS[s16];
  if (b >= 0) {
    const o = ctx.createOscillator(); o.type = "sine";
    const hz = noteHz(b) / 2;
    o.frequency.setValueAtTime(hz * 1.6, t); o.frequency.exponentialRampToValueAtTime(hz, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + sixteenth * 2.8);
    const sh = ctx.createWaveShaper(); sh.curve = satCurve;
    o.connect(sh); sh.connect(g); g.connect(musicBus); o.start(t); o.stop(t + sixteenth * 3);
  }
  // lead (every 2 bars)
  const m = MELODY[step % 32];
  if (m >= 0 && songIntensity > 0) {
    const o = ctx.createOscillator(); o.type = "sawtooth";
    const o2 = ctx.createOscillator(); o2.type = "square";
    const hz = noteHz(m + 12);
    o.frequency.setValueAtTime(hz, t); o2.frequency.setValueAtTime(hz * 1.004, t);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 2400; f.Q.value = 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + sixteenth * 1.8);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o2.start(t); o.stop(t + sixteenth * 2); o2.stop(t + sixteenth * 2);
  }
}
let satCurve = null;
function makeSat() { const n = 256, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 2.5); } return c; }

export function music(on, intensity = 1) {
  songIntensity = intensity;
  if (!ctx) return;
  if (!satCurve) satCurve = makeSat();
  if (on && !musicOn) {
    musicOn = true; nextTime = ctx.currentTime + 0.1; musicStep = 0;
    musicTimer = setInterval(() => {
      const sixteenth = 60 / BPM / 4;
      while (nextTime < ctx.currentTime + 0.25) {
        if (!muted) scheduleStep(musicStep, nextTime);
        nextTime += sixteenth; musicStep += 1;
      }
    }, 60);
  } else if (!on && musicOn) {
    musicOn = false; clearInterval(musicTimer);
  }
}
