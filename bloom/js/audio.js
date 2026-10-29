// All sounds are synthesised with Web Audio. Clears climb a pentatonic scale with the combo, so a
// streak literally sounds like it's going up.
let ctx = null, master = null, enabled = true;

export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 0.55 : 0; }

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.55 : 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const freq = (semi, base = 523.25) => base * Math.pow(2, semi / 12);

function tone(f, t, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(t, dur, { vol = 0.2, freq: f = 3000, q = 1 } = {}) {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(bp).connect(g).connect(master);
  src.start(t);
}

const ready = () => ctx && enabled;

export const sfx = {
  pick() { if (!ready()) return; const t = ctx.currentTime; tone(880, t, 0.06, { type: 'triangle', vol: 0.12 }); },
  place(n = 4) {
    if (!ready()) return;
    const t = ctx.currentTime;
    tone(200 - n * 6, t, 0.12, { vol: 0.35, slide: 0.6 });
    noise(t, 0.04, { vol: 0.15, freq: 1800 });
  },
  nope() { if (!ready()) return; const t = ctx.currentTime; tone(150, t, 0.12, { type: 'square', vol: 0.06 }); },
  clear(lines, combo) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const start = Math.min(SCALE.length - 4, Math.max(0, combo - 1));
    const notes = 2 + Math.min(4, lines);
    for (let i = 0; i < notes; i++) {
      const s = SCALE[Math.min(SCALE.length - 1, start + i)];
      tone(freq(s), t + i * 0.055, 0.32, { type: 'triangle', vol: 0.18 });
      tone(freq(s) * 2, t + i * 0.055, 0.18, { vol: 0.05 });
    }
    noise(t, 0.35 + lines * 0.08, { vol: 0.07 + lines * 0.02, freq: 6000, q: 0.7 });
  },
  big() {
    if (!ready()) return;
    const t = ctx.currentTime;
    [0, 4, 7, 12].forEach((s) => tone(freq(s, 392), t, 0.9, { type: 'sawtooth', vol: 0.045, attack: 0.02 }));
    tone(freq(24, 392), t + 0.1, 0.6, { vol: 0.08 });
  },
  allClear() {
    if (!ready()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 10; i++) tone(freq(SCALE[i]), t + i * 0.05, 0.4, { type: 'triangle', vol: 0.12 });
    noise(t, 1.2, { vol: 0.12, freq: 7000, q: 0.5 });
  },
  record() {
    if (!ready()) return;
    const t = ctx.currentTime;
    [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.5], [12, 0.62]].forEach(([s, d]) => tone(freq(s, 523), t + d, 0.35, { type: 'square', vol: 0.06 }));
    [0, 4, 7, 12].forEach((s) => tone(freq(s, 261), t + 0.62, 1.2, { type: 'triangle', vol: 0.1 }));
  },
  over() {
    if (!ready()) return;
    const t = ctx.currentTime;
    [7, 4, 0, -5].forEach((s, i) => tone(freq(s, 392), t + i * 0.16, 0.4, { type: 'triangle', vol: 0.14 }));
  },
  gem() {
    if (!ready()) return;
    const t = ctx.currentTime;
    tone(1318, t, 0.15, { type: 'triangle', vol: 0.12 });
    tone(1760, t + 0.07, 0.25, { type: 'triangle', vol: 0.12 });
  },
  level() {
    if (!ready()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 6; i++) tone(freq(SCALE[i + 2]), t + i * 0.07, 0.5, { type: 'triangle', vol: 0.12 });
  },
  weeds() {
    if (!ready()) return;
    const t = ctx.currentTime;
    tone(110, t, 0.35, { type: 'sawtooth', vol: 0.06, slide: 1.5 });
    noise(t, 0.3, { vol: 0.12, freq: 400, q: 0.8 });
  },
  tick() { if (!ready()) return; tone(1200, ctx.currentTime, 0.03, { type: 'square', vol: 0.03 }); },
};
