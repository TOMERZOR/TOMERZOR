// Music and sound effects, synthesized live with the Web Audio API: no files
// to download, nothing to license. Three music moods (menu, game, duel)
// share one scheduler, so moving between screens never restarts the beat.

let ctx = null;
let master, musicBus, sfxBus, reverb, reverbSend, delay, delaySend, noiseBuf;
let musicOn = true, sfxOn = true;
let mood = "menu";
let playing = false;
let timer = null;
let nextTime = 0;
let step = 0;
let bar = 0;

const MOODS = {
  menu: { bpm: 84, prog: [[50, 57, 61, 64, 69], [47, 54, 57, 62, 66], [43, 50, 54, 59, 62], [45, 52, 55, 61, 64]], drums: 0, barsPerChord: 2, arp: 0.55 },
  game: { bpm: 96, prog: [[50, 57, 61, 64, 69], [47, 54, 57, 62, 66], [43, 50, 54, 59, 62], [45, 52, 57, 61, 64]], drums: 1, barsPerChord: 1, arp: 0.75 },
  duel: { bpm: 114, prog: [[45, 52, 55, 59, 64], [41, 48, 52, 57, 60], [48, 55, 59, 62, 67], [43, 50, 55, 59, 62]], drums: 2, barsPerChord: 1, arp: 0.9 },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: "interactive" });
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);

  musicBus = ctx.createGain();
  musicBus.gain.value = musicOn ? 0.3 : 0;
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxOn ? 0.85 : 0;
  sfxBus.connect(master);

  reverb = ctx.createConvolver();
  reverb.buffer = impulse(2.6, 2.4);
  reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.32;
  reverbSend.connect(reverb).connect(master);

  delay = ctx.createDelay(1);
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const dlp = ctx.createBiquadFilter();
  dlp.type = "lowpass";
  dlp.frequency.value = 2400;
  delay.connect(dlp).connect(fb).connect(delay);
  delaySend = ctx.createGain();
  delaySend.gain.value = 0.22;
  delaySend.connect(delay);
  dlp.connect(musicBus);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (playing || sfxOn) ctx.resume();
  });
  return ctx;
}

function impulse(seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// Browsers only allow sound after a tap; call this from the first gesture.
export function unlock() {
  const c = ensure();
  if (c && c.state !== "running") c.resume().catch(() => {});
  if (musicOn && !playing) startMusic();
}

export function setMusic(on) {
  musicOn = on;
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(on ? 0.3 : 0, ctx.currentTime, 0.25);
  if (on && !playing) startMusic();
}

export function setSfx(on) {
  sfxOn = on;
  if (ctx) sfxBus.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.05);
}

export function setMood(m) {
  if (MOODS[m]) mood = m;
}

// Duck the music under big moments.
export function duck(amount = 0.35, ms = 1400) {
  if (!ctx || !musicOn) return;
  const g = musicBus.gain, t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setTargetAtTime(0.3 * amount, t, 0.05);
  g.setTargetAtTime(0.3, t + ms / 1000, 0.4);
}

// ---------- music ----------

function startMusic() {
  if (!ctx || playing) return;
  playing = true;
  nextTime = ctx.currentTime + 0.1;
  step = 0;
  timer = setInterval(schedule, 25);
}

function schedule() {
  if (!ctx || ctx.state !== "running") return;
  if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05;
  const M = MOODS[mood];
  const sixteenth = 60 / M.bpm / 4;
  while (nextTime < ctx.currentTime + 0.14) {
    playStep(M, step % 16, nextTime, sixteenth);
    nextTime += sixteenth;
    step++;
    if (step % 16 === 0) bar++;
  }
}

function playStep(M, s, t, dur) {
  const chord = M.prog[Math.floor(bar / M.barsPerChord) % M.prog.length];
  const firstOfChord = s === 0 && bar % M.barsPerChord === 0;
  if (firstOfChord) pad(chord.slice(1), t, dur * 16 * M.barsPerChord);
  // bass
  if (M.drums === 2) {
    if (s % 2 === 0) bass(chord[0] - 12 + (s % 8 === 6 ? 12 : 0), t, dur * 1.6);
  } else if (s === 0 || (M.drums && s === 10)) bass(chord[0] - 12, t, dur * (s === 0 ? 7 : 5));
  // arpeggio
  if (s % 2 === 0 && Math.random() < M.arp) {
    const tones = [...chord.slice(1), ...chord.slice(1).map((n) => n + 12)];
    const idx = (s / 2 + bar * 3) % tones.length;
    pluck(tones[idx] + 12, t, 0.18 + Math.random() * 0.06);
  }
  // drums
  if (M.drums >= 1) {
    if (M.drums === 2 ? s % 4 === 0 : s === 0 || s === 8) kick(t);
    if (s === 4 || s === 12) snare(t, M.drums === 2 ? 0.28 : 0.16);
    if (M.drums === 2 ? true : s % 2 === 0) hat(t, s % 4 === 2 ? 0.07 : 0.035);
  } else if (s % 4 === 2) {
    hat(t, 0.02);
  }
}

function pad(notes, t, len) {
  const out = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.linearRampToValueAtTime(1400, t + len * 0.5);
  lp.frequency.linearRampToValueAtTime(800, t + len);
  lp.Q.value = 0.6;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.05, t + 0.9);
  out.gain.setValueAtTime(0.05, t + len - 0.6);
  out.gain.linearRampToValueAtTime(0, t + len + 0.6);
  lp.connect(out);
  out.connect(musicBus);
  out.connect(reverbSend);
  for (const n of notes) {
    for (const det of [-8, 7]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = mtof(n);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.7);
    }
  }
}

function pluck(n, t, vol = 0.2) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o2.type = "sine";
  o.frequency.value = mtof(n);
  o2.frequency.value = mtof(n) * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.3;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(musicBus);
  g.connect(delaySend);
  g.connect(reverbSend);
  o.start(t);
  o2.start(t);
  o.stop(t + 0.45);
  o2.stop(t + 0.45);
}

function bass(n, t, len) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  o.type = "triangle";
  o.frequency.value = mtof(n);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.32, t + 0.012);
  g.gain.setTargetAtTime(0.2, t + 0.05, 0.1);
  g.gain.setTargetAtTime(0, t + len * 0.85, 0.05);
  o.connect(lp).connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + len + 0.3);
}

function kick(t, bus = musicBus, vol = 0.75) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + 0.4);
}

function noise(t, len, { type = "highpass", freq = 7000, q = 0.7, vol = 0.05, bus = musicBus, attack = 0.001, send = null } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  s.connect(f).connect(g).connect(bus);
  if (send) g.connect(send);
  s.start(t, Math.random() * 0.5);
  s.stop(t + len + 0.05);
  return f;
}

function hat(t, vol) {
  noise(t, 0.05, { vol });
}

function snare(t, vol) {
  noise(t, 0.16, { type: "bandpass", freq: 1900, q: 0.8, vol, send: reverbSend });
  tone(190, t, 0.08, { type: "triangle", vol: vol * 0.6, bus: musicBus });
}

// ---------- sound effects ----------

function tone(freq, t, len, { type = "sine", vol = 0.2, bus = sfxBus, attack = 0.005, send = reverbSend, glide = null } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + len);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  o.connect(g).connect(bus);
  if (send) g.connect(send);
  o.start(t);
  o.stop(t + len + 0.05);
}

function bell(freq, t, vol = 0.16, len = 1.1) {
  tone(freq, t, len, { vol });
  tone(freq * 2.01, t, len * 0.6, { vol: vol * 0.35 });
  tone(freq * 3.98, t, len * 0.3, { vol: vol * 0.12 });
}

function fx(fn) {
  if (!sfxOn) return;
  const c = ensure();
  if (!c) return;
  if (c.state !== "running") c.resume().catch(() => {});
  try {
    fn(c.currentTime + 0.005);
  } catch {}
}

let lastTick = 0;
export const sfx = {
  tap: () => fx((t) => tone(1100, t, 0.05, { vol: 0.06, send: null })),
  tick: () => fx((t) => {
    if (t - lastTick < 0.025) return;
    lastTick = t;
    noise(t, 0.018, { type: "bandpass", freq: 3800, q: 2, vol: 0.22, bus: sfxBus });
    tone(2600, t, 0.015, { vol: 0.04, send: null });
  }),
  toggle: () => fx((t) => tone(1500, t, 0.04, { vol: 0.07, send: null })),
  whoosh: () => fx((t) => {
    const f = noise(t, 0.45, { type: "bandpass", freq: 400, q: 1.2, vol: 0.12, bus: sfxBus, attack: 0.12 });
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.4);
  }),
  lock: () => fx((t) => {
    tone(659, t, 0.18, { vol: 0.14, type: "triangle" });
    tone(988, t + 0.07, 0.3, { vol: 0.14, type: "triangle" });
  }),
  reveal: () => fx((t) => {
    const f = noise(t, 0.9, { type: "lowpass", freq: 300, q: 0.5, vol: 0.1, bus: sfxBus, attack: 0.6 });
    f.frequency.exponentialRampToValueAtTime(5000, t + 0.85);
    [62, 69, 74].forEach((n, i) => tone(mtof(n), t + 0.55, 0.9, { vol: 0.05, type: "sawtooth", attack: 0.2 + i * 0.02 }));
  }),
  count: (p) => fx((t) => {
    const scale = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
    const n = scale[Math.min(scale.length - 1, Math.floor(p * scale.length))];
    tone(mtof(n), t, 0.09, { vol: 0.07, type: "triangle", send: null });
  }),
  verdict: (score) => fx((t) => {
    if (score >= 5000) {
      [72, 76, 79, 84, 88, 91].forEach((n, i) => bell(mtof(n), t + i * 0.07, 0.13));
      noise(t + 0.4, 1.2, { type: "highpass", freq: 9000, vol: 0.04, bus: sfxBus, attack: 0.3 });
    } else if (score >= 3800) {
      [72, 76, 79, 84].forEach((n, i) => bell(mtof(n), t + i * 0.08, 0.12));
    } else if (score >= 2800) {
      [72, 76, 79].forEach((n, i) => bell(mtof(n), t + i * 0.09, 0.1));
    } else if (score >= 1500) {
      [67, 72].forEach((n, i) => bell(mtof(n), t + i * 0.1, 0.09));
    } else {
      tone(196, t, 0.25, { type: "triangle", vol: 0.16 });
      tone(147, t + 0.16, 0.4, { type: "triangle", vol: 0.16 });
    }
  }),
  damage: () => fx((t) => {
    kick(t, sfxBus, 1);
    noise(t, 0.35, { type: "lowpass", freq: 1200, vol: 0.3, bus: sfxBus });
    tone(110, t, 0.5, { type: "sawtooth", vol: 0.12, glide: 50 });
  }),
  hit: () => fx((t) => {
    tone(1318, t, 0.25, { type: "square", vol: 0.05 });
    tone(1760, t + 0.06, 0.4, { type: "triangle", vol: 0.1 });
    noise(t, 0.12, { type: "highpass", freq: 5000, vol: 0.08, bus: sfxBus });
  }),
  countdown: (last = false) => fx((t) => tone(last ? 1320 : 660, t, last ? 0.5 : 0.16, { type: "triangle", vol: 0.18 })),
  hurry: () => fx((t) => tone(880, t, 0.08, { type: "square", vol: 0.04, send: null })),
  match: () => fx((t) => {
    [57, 64, 69, 73, 76].forEach((n) => tone(mtof(n), t, 1.2, { type: "sawtooth", vol: 0.045, attack: 0.01 }));
    kick(t, sfxBus, 0.9);
    const f = noise(t, 0.6, { type: "bandpass", freq: 600, q: 1, vol: 0.12, bus: sfxBus, attack: 0.05 });
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.5);
  }),
  win: () => fx((t) => {
    const seq = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]];
    seq.forEach((ch, i) => ch.forEach((n) => tone(mtof(n), t + i * 0.16, i === 3 ? 1.6 : 0.2, { type: "sawtooth", vol: 0.05, attack: 0.01 })));
    [84, 88, 91, 96].forEach((n, i) => bell(mtof(n), t + 0.5 + i * 0.08, 0.1));
  }),
  lose: () => fx((t) => {
    [64, 62, 59, 55].forEach((n, i) => tone(mtof(n), t + i * 0.2, 0.5, { type: "triangle", vol: 0.14 }));
  }),
  error: () => fx((t) => {
    tone(220, t, 0.1, { type: "square", vol: 0.06, send: null });
    tone(220, t + 0.13, 0.12, { type: "square", vol: 0.06, send: null });
  }),
  streak: (n) => fx((t) => bell(mtof(72 + Math.min(n, 12) * 2), t, 0.12)),
};
