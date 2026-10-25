// All sound is synthesized with Web Audio: no files to download, crisp on every
// device, and pitched to the action (splashes climb in a combo).
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let sfxOn = true, musicOn = true, musicTimer = 0, musicStep = 0;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
  if (musicOn) startMusic();
}

export function setSfx(on) { sfxOn = on; }
export function setMusic(on) { musicOn = on; if (!ctx) return; if (on) startMusic(); else stopMusic(); }

export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

function tone({ f = 440, f2 = 0, type = 'sine', t = 0.15, v = 0.3, a = 0.005, when = 0, bus = sfxBus, q = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  let node = o;
  if (q) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = q; o.connect(fl); node = fl; }
  node.connect(g); g.connect(bus);
  o.start(t0); o.stop(t0 + t + 0.02);
}

function noise({ t = 0.1, v = 0.2, f = 1200, q = 1, type = 'bandpass', when = 0, f2 = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  s.connect(fl); fl.connect(g); g.connect(sfxBus);
  s.start(t0, Math.random() * 0.3); s.stop(t0 + t + 0.02);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const hz = (semi, base = 523.25) => base * Math.pow(2, semi / 12);

let lastSplat = 0;
export const sfx = {
  tap() { if (!sfxOn || !ensure()) return; tone({ f: 880, f2: 660, type: 'triangle', t: 0.06, v: 0.15 }); },
  launch() { if (!sfxOn || !ensure()) return; tone({ f: 260, f2: 620, type: 'sine', t: 0.16, v: 0.28 }); tone({ f: 520, f2: 900, type: 'triangle', t: 0.1, v: 0.08, when: 0.03 }); },
  blocked() { if (!sfxOn || !ensure()) return; tone({ f: 180, f2: 140, type: 'square', t: 0.12, v: 0.08, q: 900 }); },
  splat(combo = 0) {
    if (!sfxOn || !ensure()) return;
    const now = ctx.currentTime;
    if (now - lastSplat < 0.028) return; // keep dense volleys from turning into mush
    lastSplat = now;
    const semi = PENTA[Math.min(PENTA.length - 1, combo % PENTA.length)] + 12 * Math.floor(Math.min(combo, 27) / 14);
    noise({ t: 0.07, v: 0.16, f: 900 + Math.random() * 400, q: 0.8 });
    tone({ f: hz(semi, 392) * 1.0, f2: hz(semi, 392) * 0.7, type: 'sine', t: 0.09, v: 0.16 });
  },
  pop() {
    if (!sfxOn || !ensure()) return;
    tone({ f: 500, f2: 1400, type: 'sine', t: 0.09, v: 0.25 });
    tone({ f: 1568, type: 'triangle', t: 0.18, v: 0.08, when: 0.06 });
    tone({ f: 2093, type: 'triangle', t: 0.2, v: 0.06, when: 0.11 });
  },
  park() { if (!sfxOn || !ensure()) return; tone({ f: 420, f2: 300, type: 'triangle', t: 0.12, v: 0.15 }); },
  warn() { if (!sfxOn || !ensure()) return; tone({ f: 660, type: 'square', t: 0.08, v: 0.06, q: 1800 }); tone({ f: 660, type: 'square', t: 0.08, v: 0.06, q: 1800, when: 0.14 }); },
  coin(i = 0) { if (!sfxOn || !ensure()) return; tone({ f: 1318 + i * 40, type: 'square', t: 0.05, v: 0.05, q: 4000 }); tone({ f: 1975 + i * 60, type: 'square', t: 0.12, v: 0.05, q: 5000, when: 0.05 }); },
  win() {
    if (!sfxOn || !ensure()) return;
    [0, 4, 7, 12, 16].forEach((s, i) => tone({ f: hz(s), type: 'triangle', t: 0.35, v: 0.16, when: i * 0.09 }));
    [12, 16, 19, 24].forEach((s, i) => tone({ f: hz(s), type: 'sine', t: 0.5, v: 0.08, when: 0.5 + i * 0.05 }));
    noise({ t: 0.6, v: 0.05, f: 6000, q: 0.5, type: 'highpass', when: 0.45 });
  },
  fail() { if (!sfxOn || !ensure()) return; [7, 4, 0, -5].forEach((s, i) => tone({ f: hz(s, 392), type: 'triangle', t: 0.3, v: 0.14, when: i * 0.13 })); },
  whoosh() { if (!sfxOn || !ensure()) return; noise({ t: 0.25, v: 0.12, f: 400, f2: 2400, q: 1.2 }); },
  unlock() { if (!sfxOn || !ensure()) return; [0, 7, 12, 19].forEach((s, i) => tone({ f: hz(s), type: 'sine', t: 0.25, v: 0.12, when: i * 0.07 })); },
  heart() { if (!sfxOn || !ensure()) return; tone({ f: 70, f2: 50, type: 'sine', t: 0.14, v: 0.35 }); tone({ f: 66, f2: 46, type: 'sine', t: 0.16, v: 0.28, when: 0.2 }); },
  reveal() { if (!sfxOn || !ensure()) return; tone({ f: 700, f2: 1200, type: 'sine', t: 0.12, v: 0.12 }); },
};

// ---- music: a soft marimba loop over a warm pad, generated live ----
const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]; // C Am F G
const MELODY = [12, 9, 7, 9, 12, 14, 16, 14, 12, 9, 7, 4, 7, 9, 7, 4];

function musicTick(when = 0.05) {
  if (!ctx || !musicOn) return;
  const beat = 0.32;
  const chord = CHORDS[Math.floor(musicStep / 8) % CHORDS.length];
  if (musicStep % 8 === 0) chord.forEach((s) => tone({ f: hz(s - 12, 261.63), type: 'sine', t: beat * 8, v: 0.05, a: 0.4, when, bus: musicBus }));
  if (musicStep % 2 === 0) tone({ f: hz(chord[0] - 24, 261.63), type: 'triangle', t: 0.25, v: 0.08, when, bus: musicBus });
  const m = MELODY[musicStep % MELODY.length];
  if ((musicStep * 7) % 5 !== 1) tone({ f: hz(m + (chord[0] < -4 ? -1 : 0), 261.63), type: 'sine', t: 0.22, v: 0.07, when, bus: musicBus });
  musicStep++;
}

function startMusic() {
  if (!ensure() || musicTimer) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0.55, ctx.currentTime, 0.8);
  musicTimer = setInterval(musicTick, 320);
}

function stopMusic() {
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  clearInterval(musicTimer); musicTimer = 0;
}

// Renders the music loop offline (for trailers and store videos).
export async function renderMusic(seconds) {
  const sr = 44100;
  const off = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const saved = [ctx, master, sfxBus, musicBus, musicStep, musicOn];
  ctx = off; master = off.createGain(); master.connect(off.destination);
  musicBus = off.createGain(); musicBus.gain.value = 0.9; musicBus.connect(master);
  sfxBus = off.createGain(); sfxBus.connect(master);
  musicOn = true; musicStep = 0;
  for (let t = 0; t < seconds - 0.4; t += 0.32) musicTick(t);
  const buf = await off.startRendering();
  [ctx, master, sfxBus, musicBus, musicStep, musicOn] = saved;
  return buf;
}
