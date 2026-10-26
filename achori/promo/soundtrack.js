// The promo's soundtrack, rendered offline (OfflineAudioContext) so it lines up with the
// picture to the sample. Everything is synthesised, in the same spirit as the game's sounds.
// renderSoundtrack(cues) -> Promise<AudioBuffer>; cues come from timeline.js.

export async function renderSoundtrack(T, sfxCues) {
  const SR = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * T.length), SR);
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.15;
  master.connect(comp).connect(ctx.destination);
  const music = ctx.createGain(); music.gain.value = 0.8; music.connect(master);
  const sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
  // a little room on everything
  const verb = ctx.createConvolver();
  const ir = ctx.createBuffer(2, SR * 1.6, SR);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  verb.buffer = ir;
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.16; verb.connect(verbGain).connect(master);
  music.connect(verb); sfx.connect(verb);

  const noise = ctx.createBuffer(1, SR * 2, SR);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  const env = (g, t, a, peak, d, hold = 0) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    if (hold) g.gain.setValueAtTime(Math.max(peak, 0.0002), t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  };
  const tone = (out, type, f0, f1, t, dur, vol, { a = 0.005, hold = 0, pan = 0, detune = 0 } = {}) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur + hold);
    env(g, t, a, vol, dur, hold);
    p.pan.value = pan;
    o.connect(g).connect(p).connect(out);
    o.start(t); o.stop(t + a + hold + dur + 0.05);
  };
  const burst = (out, t, dur, vol, freq, q = 1, type = 'bandpass', { a = 0.002, f1 = null, pan = 0 } = {}) => {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, a, vol, dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    s.connect(f).connect(g).connect(p).connect(out);
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  };

  // ---------- music ----------
  const BPM = 140, B = 60 / BPM;
  const kick = (t, v = 1) => { tone(music, 'sine', 150, 42, t, 0.22, 0.95 * v, { a: 0.002 }); burst(music, t, 0.02, 0.35 * v, 3000, 0.8, 'highpass'); };
  const snare = (t, v = 1) => { burst(music, t, 0.16, 0.6 * v, 1900, 0.7); tone(music, 'triangle', 220, 160, t, 0.08, 0.3 * v); };
  const hat = (t, v = 1, open = false) => burst(music, t, open ? 0.14 : 0.03, 0.22 * v, 9000, 1, 'highpass', { pan: 0.25 });
  const clap = (t, v = 1) => { for (let k = 0; k < 3; k++) burst(music, t + k * 0.012, 0.09, 0.4 * v, 1400, 1.2); };
  const bassNote = (t, f, len, v = 1) => { tone(music, 'sawtooth', f, f, t, len * 0.8, 0.22 * v, { a: 0.004 }); tone(music, 'sine', f / 2, f / 2, t, len * 0.9, 0.35 * v, { a: 0.004 }); };
  const stab = (t, freqs, v = 1, len = 0.22) => freqs.forEach((f, i) => { tone(music, 'sawtooth', f, f, t, len, 0.07 * v, { pan: (i - 1) * 0.4, detune: (i - 1) * 9 }); tone(music, 'square', f * 2, f * 2, t, len * 0.6, 0.03 * v, { pan: -(i - 1) * 0.3 }); });
  const riser = (t, dur, v = 1) => { burst(music, t, dur, 0.35 * v, 300, 2, 'bandpass', { a: dur * 0.9, f1: 9000 }); tone(music, 'sawtooth', 110, 880, t, dur * 0.1, 0.06 * v, { a: dur * 0.9 }); };
  const impact = (t, v = 1) => { tone(music, 'sine', 90, 30, t, 1.3, 1.0 * v, { a: 0.003 }); burst(music, t, 1.2, 0.5 * v, 400, 0.5, 'lowpass'); burst(music, t, 0.05, 0.5 * v, 5000, 0.7, 'highpass'); };
  const drone = (t, dur, f, v = 1) => { tone(music, 'sawtooth', f, f, t, 0.6, 0.05 * v, { a: 0.8, hold: dur - 1.4, detune: -8 }); tone(music, 'sawtooth', f * 1.5, f * 1.5, t, 0.6, 0.03 * v, { a: 0.8, hold: dur - 1.4, detune: 7 }); };

  const E = 82.41, G = 98.0, A = 110.0, D = 73.42, C = 65.41; // the riff lives in E minor
  const riff = [E, E, G, E, A, E, G, D];
  const chords = { Em: [329.6, 392, 493.9], C: [261.6, 329.6, 392], D: [293.7, 370, 440], Bm: [246.9, 293.7, 370] };

  // intro: dark drone and a heartbeat kick
  drone(0.0, 9.6, E);
  for (let t = T.cut.lior; t < T.cut.ido; t += B * 2) kick(t, 0.55);
  for (let t = T.cut.ofek; t < T.cut.ido; t += B) hat(t + B / 2, 0.5);
  // the Ido memo: everything drops to a tick-tock
  for (let t = T.cut.ido; t < T.cut.wipe; t += B / 2) tone(music, 'square', 1800, 1800, t, 0.015, 0.05);
  // build: kicks, a snare roll that speeds up, the riff in the bass, a riser
  for (let t = T.cut.plan; t < T.drop; t += B) kick(t, 0.85);
  for (let t = T.cut.plan, k = 0; t < T.drop; k++) { snare(t, 0.25 + 0.6 * (t - T.cut.plan) / (T.drop - T.cut.plan)); t += (t < T.drop - 1.0 ? B : B / 4); }
  for (let t = T.cut.plan, i = 0; t < T.drop; t += B / 2, i++) bassNote(t, riff[i % 8], B / 2, 0.7);
  riser(T.drop - 2.0, 2.0);
  // the drop: full groove until the flip-flop
  impact(T.drop, 1.1);
  const prog = ['Em', 'C', 'D', 'Bm'];
  for (let t = T.drop, i = 0; t < T.cut.slipper; t += B / 2, i++) {
    const beat = i % 2 === 0;
    if (beat) kick(t);
    if (i % 4 === 2) { snare(t); clap(t, 0.7); }
    hat(t + B / 4, 0.7, i % 4 === 3);
    hat(t, 0.4);
    bassNote(t, riff[i % 8], B / 2);
    if (i % 4 === 0) stab(t, chords[prog[Math.floor(i / 8) % 4]], 1, 0.18);
    if (i % 8 === 7) stab(t + B / 4, chords[prog[Math.floor(i / 8) % 4]].map((f) => f * 2), 0.6, 0.08);
  }
  // the flip-flop: a stop, then the anthem under the logo
  impact(T.cut.slipper, 0.9);
  riser(T.logo - 1.0, 1.0, 0.8);
  impact(T.logo, 1.2);
  for (let t = T.logo, i = 0; t < T.cut.end; t += B / 2, i++) {
    if (i % 2 === 0) kick(t, 0.9);
    if (i % 4 === 2) snare(t, 0.8);
    hat(t + B / 4, 0.5);
    if (i % 4 === 0) {
      const ch = chords[['Em', 'C', 'D', 'D'][Math.floor(i / 4) % 4]];
      ch.forEach((f, k) => tone(music, 'sawtooth', f, f, t, B * 1.6, 0.06, { a: 0.02, pan: (k - 1) * 0.5, detune: (k - 1) * 10 }));
      bassNote(t, ch[0] / 4, B * 2, 0.9);
    }
  }
  // end card: one big hit, then a ringing chord that fades out
  impact(T.cut.end, 1.0);
  chords.Em.concat(chords.Em.map((f) => f * 2)).forEach((f, k) => tone(music, k % 2 ? 'triangle' : 'sawtooth', f, f, T.cut.end, 3.5, 0.045, { a: 0.01, pan: (k % 3 - 1) * 0.5 }));
  for (let t = T.cut.end; t < T.cut.end + 2.6; t += B) { kick(t, 0.5); hat(t + B / 2, 0.3); }

  // ---------- sound effects ----------
  const S = {
    squeak: (t, p = 1) => { const f = 2300 * p; tone(sfx, 'sine', f, f * 1.6, t, 0.07, 0.25); tone(sfx, 'sine', f * 1.3, f * 0.9, t + 0.08, 0.09, 0.2); },
    whoosh: (t, v = 1) => burst(sfx, t, 0.35, 0.45 * v, 500, 0.8, 'bandpass', { a: 0.15, f1: 4500 }),
    swish: (t, v = 1) => burst(sfx, t, 0.18, 0.4 * v, 3000, 0.7, 'bandpass', { a: 0.05, f1: 900 }),
    boom: (t, v = 1) => { tone(sfx, 'sine', 120, 35, t, 0.7, 0.9 * v); burst(sfx, t, 0.4, 0.6 * v, 600, 0.6, 'lowpass'); },
    slam: (t, v = 1) => { tone(sfx, 'sine', 160, 45, t, 0.3, 0.9 * v); burst(sfx, t, 0.12, 0.8 * v, 900, 0.7, 'lowpass'); burst(sfx, t, 0.04, 0.5 * v, 4000, 1, 'highpass'); },
    pop: (t, v = 1) => { tone(sfx, 'sine', 500, 1200, t, 0.06, 0.25 * v); burst(sfx, t, 0.03, 0.25 * v, 3000, 2); },
    stamp: (t) => { tone(sfx, 'sine', 110, 45, t, 0.25, 1); burst(sfx, t, 0.08, 0.9, 700, 0.6, 'lowpass'); burst(sfx, t + 0.01, 0.25, 0.25, 2500, 0.8); },
    paper: (t) => { for (let k = 0; k < 6; k++) burst(sfx, t + k * 0.035, 0.05, 0.18, 4000 + k * 300, 1.5); },
    scream: (t) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
      const lg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o2.type = 'square';
      o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(1250, t + 0.25); o.frequency.linearRampToValueAtTime(1080, t + 1.3);
      o2.frequency.setValueAtTime(706, t); o2.frequency.linearRampToValueAtTime(1262, t + 0.25); o2.frequency.linearRampToValueAtTime(1066, t + 1.3);
      lfo.frequency.value = 9; lg.gain.value = 45; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.3;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.42, t + 0.05); g.gain.setValueAtTime(0.42, t + 1.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(f); o2.connect(f); f.connect(g).connect(sfx);
      [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + 1.45); });
    },
    place: (t) => { burst(sfx, t, 0.08, 0.5, 300, 1.2); tone(sfx, 'triangle', 180, 90, t, 0.12, 0.4); },
    snap: (t) => { burst(sfx, t, 0.05, 1, 3500, 0.7, 'highpass'); tone(sfx, 'square', 120, 50, t, 0.12, 0.55); burst(sfx, t + 0.02, 0.2, 0.4, 900, 2); },
    whack: (t, n = 0) => { const up = Math.pow(1.035, Math.min(n, 24)); burst(sfx, t, 0.09, 0.8, 700 * up, 0.8, 'lowpass'); tone(sfx, 'sine', 140 * up, 45 * up, t, 0.16, 0.65); burst(sfx, t, 0.04, 0.45, 2500 * up, 1.5); },
    kill: (t, big = false) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.frequency.setValueAtTime(2700, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.55);
      lfo.frequency.value = 16; lg.gain.value = 120; lfo.connect(lg).connect(o.frequency);
      env(g, t, 0.02, 0.35, 0.58); o.connect(g).connect(sfx); o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
      burst(sfx, t + 0.05, 0.22, 1, 420, 0.6, 'lowpass'); tone(sfx, 'sine', 110, 38, t + 0.05, 0.25, 0.85);
      const bell = (w) => { tone(sfx, 'triangle', 1568, 1560, t + w, 0.7, 0.24); tone(sfx, 'sine', 2350, 2340, t + w, 0.5, 0.1); };
      bell(0.42); if (big) { bell(0.62); bell(0.82); burst(sfx, t + 0.5, 1.4, 0.4, 1100, 0.45); burst(sfx, t + 0.7, 1.0, 0.22, 2400, 0.8); }
    },
    coin: (t, n = 0) => { const f = 1320 * Math.pow(1.06, n % 8); tone(sfx, 'square', f, f, t, 0.05, 0.06); tone(sfx, 'square', f * 1.5, f * 1.5, t + 0.05, 0.12, 0.06); },
    multi: (t, n = 3) => { const base = 392 * Math.pow(1.12, Math.min(n, 5) - 2); tone(sfx, 'sine', 90, 35, t, 0.5, 0.8); [[0, 1], [0.12, 1.26], [0.24, 1.5], [0.36, 2]].forEach(([w, k]) => { tone(sfx, 'sawtooth', base * k, base * k, t + w, 0.22, 0.08); tone(sfx, 'square', base * k * 1.005, base * k, t + w, 0.22, 0.05); }); },
    slap: (t) => { burst(sfx, t, 0.06, 1, 2500, 0.5, 'highpass'); tone(sfx, 'sine', 200, 40, t, 0.4, 1); burst(sfx, t, 0.5, 0.6, 500, 0.5, 'lowpass'); },
    boing: (t) => { const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.5); l.frequency.value = 22; lg.gain.value = 40; l.connect(lg).connect(o.frequency); env(g, t, 0.01, 0.3, 0.6); o.connect(g).connect(sfx); o.start(t); l.start(t); o.stop(t + 0.7); l.stop(t + 0.7); },
    tweet: (t) => { for (let k = 0; k < 4; k++) tone(sfx, 'sine', 3200 + (k % 2) * 600, 4200, t + k * 0.11, 0.06, 0.08); },
    sparkle: (t) => { [2093, 2637, 3136, 4186].forEach((f, k) => tone(sfx, 'triangle', f, f, t + k * 0.06, 0.25, 0.06, { pan: (k - 1.5) * 0.4 })); },
    ding: (t) => { tone(sfx, 'triangle', 1760, 1760, t, 1.2, 0.18); tone(sfx, 'sine', 3520, 3520, t, 0.8, 0.07); },
    type: (t) => { burst(sfx, t, 0.02, 0.25, 2500, 3); tone(sfx, 'square', 900, 900, t, 0.01, 0.03); },
    glue: (t) => { tone(sfx, 'sine', 300, 90, t, 0.25, 0.25); burst(sfx, t, 0.25, 0.25, 400, 4); },
  };
  for (const [time, name, arg] of sfxCues) { if (S[name]) S[name](time, arg); }

  return ctx.startRendering();
}

export function wav(buffer) {
  const ch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Uint8Array(out.buffer);
}
