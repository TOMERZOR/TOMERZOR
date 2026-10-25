// Every sound is synthesised with Web Audio: squeaks, the trap, the slipper, Ofek's
// scream, and a driving loop while the mice are out.

let ctx = null, master = null, musicGain = null, sfxGain = null;
let muted = false;
let music = null;

function noiseBuffer() {
  const b = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let noise = null;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    noise = noiseBuffer();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.03);
}
export const isMuted = () => muted;

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(type, f0, f1, dur, vol = 0.3, when = 0, out = sfxGain) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function burst(dur, vol, freq, q = 1, when = 0, type = 'bandpass', out = sfxGain) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.002, vol, dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

export const sfx = {
  tap() { tone('square', 900, 1200, 0.04, 0.06); },
  place() { burst(0.08, 0.5, 300, 1.2); tone('triangle', 180, 90, 0.12, 0.35); },
  remove() { tone('sine', 500, 260, 0.1, 0.18); },
  error() { tone('square', 220, 180, 0.12, 0.12); tone('square', 180, 150, 0.14, 0.12, 0.12); },
  squeak(p = 1) {
    const f = 2200 * p * (0.9 + Math.random() * 0.25);
    tone('sine', f, f * 1.6, 0.07, 0.18);
    tone('sine', f * 1.3, f * 0.9, 0.09, 0.14, 0.08);
  },
  snap() { burst(0.05, 1.0, 3500, 0.7, 0, 'highpass'); tone('square', 120, 50, 0.12, 0.5); burst(0.2, 0.4, 900, 2, 0.02); },
  // each hit in a combo lands a little higher, so a streak sounds like it's building
  whack(power = 1, n = 0) {
    const up = Math.pow(1.035, Math.min(n, 24));
    burst(0.09, 0.9 * power, 700 * up, 0.8, 0, 'lowpass');
    tone('sine', 140 * up, 45 * up, 0.16, 0.7 * power);
    burst(0.04, 0.5, 2500 * up, 1.5);
    if (n >= 4) tone('square', 520 * up, 780 * up, 0.05, 0.035);
  },
  clang() {
    [523, 787, 1290, 1873].forEach((f, i) => tone('triangle', f, f * 0.995, 0.9 - i * 0.15, 0.16 / (i + 1)));
    burst(0.06, 0.6, 3000, 1.2);
    tone('sine', 160, 60, 0.2, 0.5);
  },
  coin(n = 0) { const f = 1320 * Math.pow(1.06, n % 8); tone('square', f, f, 0.05, 0.05); tone('square', f * 1.5, f * 1.5, 0.12, 0.05, 0.05); },
  multi(n) {
    // a stab of brass and a boom, higher for bigger streaks
    const base = 392 * Math.pow(1.12, Math.min(n, 5) - 2);
    tone('sine', 90, 35, 0.5, 0.8);
    burst(0.4, 0.5, 300, 0.7, 0, 'lowpass');
    [[0, 1], [0.12, 1.26], [0.24, 1.5], [0.36, 2]].forEach(([w, k]) => { tone('sawtooth', base * k, base * k, 0.22, 0.07, w); tone('square', base * k * 1.005, base * k, 0.22, 0.04, w); });
  },
  whoosh() { burst(0.16, 0.25, 1200, 0.6); },
  glue() { tone('sine', 300, 90, 0.25, 0.25); burst(0.25, 0.25, 400, 4); },
  chomp() { for (let i = 0; i < 3; i++) burst(0.05, 0.35, 1800, 3, i * 0.12); },
  steal() { tone('sawtooth', 600, 300, 0.25, 0.12); this.squeak(1.2); },
  recovered() { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.12, 0.2, i * 0.07)); },
  // A mouse dies: a squeak that falls away, a splat, a boxing-ring bell, and for Lior the crowd goes wild
  kill(big = false) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(2700, t);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.55);
    lfo.frequency.value = 16; lg.gain.value = 120;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(sfxGain);
    o.start(t); lfo.start(t); o.stop(t + 0.65); lfo.stop(t + 0.65);
    // splat
    burst(0.22, 1.0, 420, 0.6, 0.05, 'lowpass');
    tone('sine', 110, 38, 0.25, 0.8, 0.05);
    burst(0.08, 0.4, 2600, 2, 0.06);
    // ding ding
    const bell = (w) => { tone('triangle', 1568, 1560, 0.7, 0.22, w); tone('sine', 2350, 2340, 0.5, 0.1, w); tone('sine', 3136, 3130, 0.3, 0.05, w); };
    bell(0.42);
    if (big) {
      bell(0.62); bell(0.82);
      // crowd cheer: swelling filtered noise with a few whistles
      burst(1.3, 0.35, 1100, 0.45, 0.5, 'bandpass');
      burst(1.0, 0.2, 2400, 0.8, 0.7, 'bandpass');
      tone('sine', 1900, 2600, 0.25, 0.08, 0.9);
      tone('sine', 2600, 1700, 0.35, 0.07, 1.15);
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.14, 0.07, 0.6 + i * 0.1));
    } else {
      [784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.06, 0.55 + i * 0.08));
    }
  },
  free() { this.squeak(1.4); tone('triangle', 400, 900, 0.18, 0.16); },
  scream() {
    // Ofek: a wobbly falsetto shriek
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
    const lg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(1250, t + 0.25); o.frequency.linearRampToValueAtTime(1100, t + 1.2);
    o2.frequency.setValueAtTime(705, t); o2.frequency.linearRampToValueAtTime(1262, t + 0.25); o2.frequency.linearRampToValueAtTime(1080, t + 1.2);
    lfo.frequency.value = 9; lg.gain.value = 40;
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    g.gain.setValueAtTime(0.35, t + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
    o.connect(f); o2.connect(f); f.connect(g).connect(sfxGain);
    [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + 1.4); });
  },
  disconnect() { [880, 660, 440, 220].forEach((f, i) => tone('square', f, f * 0.98, 0.09, 0.1, i * 0.09)); burst(0.3, 0.15, 3000, 0.5, 0.36); },
  ring() { [0, 0.25].forEach((w) => { tone('sine', 1300, 1300, 0.18, 0.12, w); tone('sine', 1650, 1650, 0.18, 0.08, w); }); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('square', f, f, i === 5 ? 0.4 : 0.12, 0.1, i * 0.11)); },
  lose() { [392, 370, 349, 294].forEach((f, i) => tone('sawtooth', f, f * (i === 3 ? 0.85 : 1), i === 3 ? 0.8 : 0.3, 0.12, i * 0.32)); },
  star(n) { tone('triangle', 880 * Math.pow(1.26, n), 1760 * Math.pow(1.26, n), 0.18, 0.18); },
  combo(n) { tone('square', 500 + n * 40, 700 + n * 50, 0.06, 0.06); },
};

// A loop that speeds up when you ask (adrenaline when Lior is caught)
export function startMusic(intensity = 1) {
  if (!ctx || music) return;
  const bpm = 132;
  const step = 60 / bpm / 4;
  let next = ctx.currentTime + 0.05;
  let n = 0;
  const bass = [0, 0, 12, 0, 3, 0, 15, 3, 5, 5, 17, 5, 3, 3, 15, 7];
  const root = 55;
  music = { stop: false, hot: 0 };
  const m = music;
  const tick = () => {
    if (m.stop || !ctx) return;
    while (next < ctx.currentTime + 0.12) {
      const s = n % 16;
      const t0 = next - ctx.currentTime;
      if (s % 4 === 0) { tone('sine', 120, 40, 0.14, 0.55, t0, musicGain); }
      if (s % 8 === 4) burst(0.1, 0.4, 1800, 0.8, t0, 'bandpass', musicGain);
      if (s % 2 === 1 || m.hot > 0) burst(0.025, m.hot > 0 ? 0.2 : 0.12, 8000, 1, t0, 'highpass', musicGain);
      const f = root * Math.pow(2, bass[(n >> 0) % 16] / 12) * (Math.floor(n / 64) % 2 ? 1.122 : 1);
      tone('sawtooth', f, f, step * 0.9, 0.11, t0, musicGain);
      if (m.hot > 0 && s % 2 === 0) tone('square', f * 4, f * 4, step * 0.5, 0.035, t0, musicGain);
      next += step / (m.hot > 0 ? 1.15 : 1) / intensity;
      n++;
    }
    m.timer = setTimeout(tick, 30);
  };
  tick();
}

export function heat(on) { if (music) music.hot = on ? 1 : 0; }

export function stopMusic() {
  if (music) { music.stop = true; clearTimeout(music.timer); music = null; }
}
