// Every sound is synthesised with WebAudio, so the game ships with no audio files.
let ctx, master, musicGain, sfxGain, noiseBuf;
let muted = false, musicOn = true;
try { muted = localStorage.getItem('mk_muted') === '1'; } catch {}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('mk_muted', m ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}

function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005, dest } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.3, at = 0, freq = 1200, q = 1, type = 'bandpass', slide = 1 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur);
}

// Bubbly pop: a sine whose pitch shoots up in a few ms, like a bubble bursting. n raises the pitch for chains.
function bubble(n = 0, vol = 0.32, at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const f = 300 * Math.pow(2, (Math.min(n, 14) * 2 + (Math.random() - 0.5)) / 12);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 3.2, t + 0.045);
  o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.12);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.16);
  // tiny wet "plip" on top
  const o2 = ctx.createOscillator(), g2 = ctx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(f * 4, t + 0.02); o2.frequency.exponentialRampToValueAtTime(f * 6, t + 0.05);
  g2.gain.setValueAtTime(0, t + 0.02); g2.gain.linearRampToValueAtTime(vol * 0.25, t + 0.024); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o2.connect(g2); g2.connect(sfxGain); o2.start(t + 0.02); o2.stop(t + 0.1);
}
// Bell-ish metallic ding: fundamental plus inharmonic partials
function bell(f, at = 0, vol = 0.12, dur = 0.45) {
  [[1, 1], [2.76, 0.45], [5.4, 0.2], [8.9, 0.08]].forEach(([m, v]) => tone(f * m, dur / Math.sqrt(m), { type: 'sine', vol: vol * v, at, attack: 0.002 }));
}

let lastCoin = 0, coinStep = 0;
export const sfx = {
  tap: () => tone(660, 0.07, { type: 'triangle', vol: 0.18 }),
  pick: n => bubble(n),
  bubble: (n, vol) => bubble(n, vol),
  drop: () => { bubble(-4, 0.28); noise(0.05, { vol: 0.08, freq: 900 }); },
  coin: () => {
    if (!ctx) return; const now = ctx.currentTime; if (now - lastCoin < 0.035) return;
    coinStep = now - lastCoin < 0.35 ? Math.min(coinStep + 1, 14) : 0; lastCoin = now;
    const f = 1046 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33][coinStep] / 12 / 2);
    bell(f, 0, 0.16, 0.35); tone(f * 2, 0.05, { type: 'square', vol: 0.025 });
  },
  bill: n => { noise(0.07, { vol: 0.16, freq: 3500, q: 0.8, slide: 1.6 }); bubble(n ?? 0, 0.2, 0.03); },
  kaching: () => {
    noise(0.05, { vol: 0.35, freq: 2500, q: 1.5 }); tone(160, 0.08, { type: 'square', vol: 0.12, slide: 0.5 });
    [2093, 2637, 3136].forEach((f, i) => bell(f, 0.07 + i * 0.015, 0.1, 0.9));
  },
  tip: () => [1568, 1976, 2349, 3136, 3951].forEach((f, i) => bell(f, i * 0.05, 0.07, 0.4)),
  streak: n => { const b = 523 * Math.pow(2, Math.min(n, 8) / 12); [0, 4, 7, 12].forEach((s, i) => tone(b * Math.pow(2, s / 12), 0.2, { type: 'triangle', vol: 0.16, at: i * 0.06 })); },
  moodUp: () => { bubble(6, 0.22); bubble(10, 0.18, 0.07); },
  moodDown: () => tone(330, 0.22, { type: 'triangle', vol: 0.16, slide: 0.6 }),
  send: () => { noise(0.12, { vol: 0.12, freq: 1800, q: 0.7, slide: 2.5 }); bubble(4, 0.18, 0.08); },
  sub: () => { tone(90, 0.18, { type: 'sine', vol: 0.45, slide: 0.5 }); noise(0.08, { vol: 0.25, freq: 500 }); bell(1319, 0.18, 0.14, 0.6); bell(1047, 0.42, 0.14, 0.9); },
  pay: () => { bell(1760, 0, 0.06, 0.18); },
  upgrade: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.22, at: i * 0.07 })),
  levelUp: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, { type: 'square', vol: 0.08, at: i * 0.09 })); [262, 392].forEach((f, i) => tone(f, 0.8, { type: 'triangle', vol: 0.2, at: 0.45 + i * 0.02 })); },
  job: () => { tone(988, 0.1, { type: 'sine', vol: 0.25 }); tone(1319, 0.16, { type: 'sine', vol: 0.25, at: 0.11 }); },
  success: () => { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.2, at: i * 0.08 })); },
  fail: () => { tone(330, 0.25, { type: 'sawtooth', vol: 0.12, slide: 0.7 }); tone(247, 0.4, { type: 'sawtooth', vol: 0.12, at: 0.22, slide: 0.6 }); },
  zap: () => { noise(0.35, { vol: 0.35, freq: 3000, q: 2, slide: 0.3 }); tone(90, 0.3, { type: 'sawtooth', vol: 0.2 }); },
  splash: () => { noise(0.4, { vol: 0.3, freq: 700, q: 0.7, type: 'lowpass', slide: 3 }); },
  pop: () => bubble(2, 0.26),
  click: () => { noise(0.03, { vol: 0.3, freq: 4000, q: 3 }); tone(1800, 0.03, { type: 'square', vol: 0.05 }); },
  clunk: () => { tone(110, 0.15, { type: 'square', vol: 0.15, slide: 0.5 }); noise(0.12, { vol: 0.25, freq: 400 }); },
  brush: () => noise(0.09, { vol: 0.07, freq: 2500, q: 0.6 }),
  mow: () => { tone(70 + Math.random() * 10, 0.08, { type: 'sawtooth', vol: 0.05 }); noise(0.08, { vol: 0.06, freq: 1800 }); },
  honk: () => { tone(392, 0.18, { type: 'square', vol: 0.08 }); tone(494, 0.18, { type: 'square', vol: 0.06 }); tone(392, 0.22, { type: 'square', vol: 0.08, at: 0.22 }); tone(494, 0.22, { type: 'square', vol: 0.06, at: 0.22 }); },
  meow: () => tone(700, 0.35, { type: 'triangle', vol: 0.12, slide: 0.55, attack: 0.05 }),
  whoosh: () => noise(0.3, { vol: 0.18, freq: 500, q: 0.8, slide: 4 }),
  phone: () => { [0, 0.18].forEach(a => { tone(1568, 0.08, { type: 'sine', vol: 0.18, at: a }); tone(2093, 0.08, { type: 'sine', vol: 0.12, at: a + 0.08 }); }); },
  kick: () => { tone(80, 0.25, { type: 'sine', vol: 0.5, slide: 0.4 }); noise(0.25, { vol: 0.45, freq: 300, q: 0.5 }); },
  pin: n => tone(900 + n * 120, 0.06, { type: 'square', vol: 0.08 }),
  hiss: () => noise(0.25, { vol: 0.12, freq: 6000, q: 0.4 }),
  step: () => noise(0.04, { vol: 0.04, freq: 600, q: 1 }),
  cash: () => sfx.kaching(),
};

// Cheerful procedural loop: marimba lead over a bouncing bass.
let musicTimer = null, step = 0, nextT = 0;
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
const PROG = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]];
const MEL = [0, 2, 4, 2, 5, 4, 2, -1, 4, 5, 7, 5, 4, 2, 1, -1];
function marimba(freq, t, vol) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 4;
  const g2 = ctx.createGain(); g2.gain.value = 0.25;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicGain);
  o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4);
}
export function startMusic() {
  if (!ctx || musicTimer) return;
  nextT = ctx.currentTime + 0.1;
  const bpm = 112, sp = 60 / bpm / 2;
  musicTimer = setInterval(() => {
    if (!musicOn) return;
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4, chord = PROG[bar], root = 196 * Math.pow(2, chord[0] / 12);
      if (step % 2 === 0) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
        o.frequency.value = root / (step % 4 === 0 ? 2 : 1);
        g.gain.setValueAtTime(0.5, nextT); g.gain.exponentialRampToValueAtTime(0.0001, nextT + sp * 1.8);
        o.connect(g); g.connect(musicGain); o.start(nextT); o.stop(nextT + sp * 2);
      }
      const m = MEL[step % 16];
      if (m >= 0 && (step % 32 < 24 || step % 2 === 0)) marimba(392 * Math.pow(2, (SCALE[m] + chord[0] * (bar === 2 ? 0 : 0)) / 12), nextT, 0.32);
      if (step % 4 === 2) { // off-beat chord stab
        for (const n of chord) marimba(392 * Math.pow(2, n / 12), nextT, 0.08);
      }
      if (step % 8 === 4 && ctx) { // shaker
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.15, nextT); g.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.06);
        s.connect(f); f.connect(g); g.connect(musicGain); s.start(nextT, Math.random()); s.stop(nextT + 0.07);
      }
      step++; nextT += sp;
    }
  }, 60);
}
export function duckMusic(on) { if (musicGain) musicGain.gain.setTargetAtTime(on ? 0.07 : 0.22, ctx.currentTime, 0.2); }

export function vibrate(ms) { try { navigator.vibrate?.(ms); } catch {} }
