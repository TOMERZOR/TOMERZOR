// WebAudio synth: sound effects and generated background music, no audio files.
// Music and effects have separate on/off switches and volumes, saved per browser.
const Sound = (() => {
  let ctx = null;
  let master = null, sfxBus = null, musicBus = null;
  let siren = null;
  let noiseBuf = null;
  const prefs = { sfx: true, music: true, sfxVol: 0.8, musicVol: 0.55 };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('netibot.audio') || '{}')); } catch (e) { /* storage may be blocked */ }
  const savePrefs = () => { try { localStorage.setItem('netibot.audio', JSON.stringify(prefs)); } catch (e) { /* ignore */ } };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus.connect(master);
      applyVolumes();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function applyVolumes() {
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(prefs.sfx ? prefs.sfxVol : 0, ctx.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(prefs.music ? prefs.musicVol * 0.5 : 0, ctx.currentTime, 0.3);
  }

  // ---------- building blocks ----------
  function tone(freq, dur, type = 'square', vol = 0.15, slideTo = null, at = 0, bus = null) {
    if (!ensure()) return;
    const out = bus || sfxBus;
    if (out === sfxBus && !prefs.sfx) return;
    const t = (at || ctx.currentTime);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.3, cutoff = 900, type = 'lowpass', at = 0, bus = null, q = 0.8) {
    if (!ensure()) return;
    const out = bus || sfxBus;
    if (out === sfxBus && !prefs.sfx) return;
    const t = (at || ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = cutoff;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
  const later = (ms, fn) => setTimeout(fn, ms);

  // ---------- music ----------
  // A small step sequencer. Each mood has its own tempo, scale and parts; the
  // melody is generated from a seed per bar so it varies but stays in key.
  const N = (semi) => 146.83 * Math.pow(2, semi / 12); // semitones above D3
  const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19];   // D freygish: the Middle-Eastern sound
  const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19];
  const MOODS = {
    menu: { bpm: 84, scale: HIJAZ, bass: [0, -5, -2, 0], drums: 'soft', lead: 0.5, pad: true, vol: 1 },
    day: { bpm: 100, scale: HIJAZ, bass: [0, 5, -2, 0], drums: 'darbuka', lead: 0.65, pad: true, vol: 1 },
    night: { bpm: 70, scale: MINOR, bass: [0, -4, -2, -5], drums: 'hat', lead: 0.35, pad: true, vol: 0.8 },
    deploy: { bpm: 118, scale: HIJAZ, bass: [0, 0, -2, 1], drums: 'drive', lead: 0.55, pad: false, vol: 1 },
    tension: { bpm: 128, scale: MINOR, bass: [0, 0, 1, 0], drums: 'pulse', lead: 0, pad: false, vol: 0.7 },
  };
  const Music = {
    mood: null, next: null, step: 0, bar: 0, time: 0, timer: null, seed: 1,
    set(mood) {
      if (mood === this.mood || mood === this.next) return;
      if (!this.mood) { this.mood = mood; return this.start(); }
      this.next = mood; // switch at the next bar
    },
    start() {
      if (!ensure() || this.timer) return;
      this.time = ctx.currentTime + 0.1;
      this.step = 0;
      this.timer = setInterval(() => this.tick(), 60);
    },
    stop() { clearInterval(this.timer); this.timer = null; this.mood = this.next = null; },
    rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; },
    tick() {
      if (!ctx) return;
      while (this.time < ctx.currentTime + 0.25) {
        if (this.step % 16 === 0) {
          if (this.next) { this.mood = this.next; this.next = null; }
          this.bar++;
          this.seed = 7 + (this.bar % 8) * 131; // an 8-bar phrase that repeats
        }
        this.play(MOODS[this.mood], this.step % 16, this.time);
        this.time += 60 / MOODS[this.mood].bpm / 4;
        this.step++;
      }
    },
    play(m, s, t) {
      const bus = musicBus;
      const v = m.vol;
      const root = m.bass[this.bar % 4];
      // Drums.
      const kick = (vol = 0.5) => { tone(110, 0.18, 'sine', vol * v, 40, t, bus); };
      const dum = () => { tone(95, 0.22, 'sine', 0.42 * v, 60, t, bus); noise(0.08, 0.12 * v, 300, 'lowpass', t, bus); };
      const tek = (vol = 0.14) => noise(0.05, vol * v, 3200, 'bandpass', t, bus, 4);
      const hat = (vol = 0.05) => noise(0.03, vol * v, 8000, 'highpass', t, bus);
      if (m.drums === 'darbuka') {
        if (s === 0 || s === 10) dum();
        if (s === 4 || s === 6 || s === 12) tek();
        if (s % 2 === 1 && this.rand() < 0.35) tek(0.06);
      } else if (m.drums === 'soft') {
        if (s === 0) dum();
        if (s === 8) tek(0.08);
      } else if (m.drums === 'hat') {
        if (s % 4 === 2) hat(0.03);
      } else if (m.drums === 'drive') {
        if (s % 4 === 0) kick(0.5);
        if (s === 4 || s === 12) { noise(0.12, 0.16 * v, 1800, 'bandpass', t, bus, 1); }
        if (s % 2 === 1) hat(0.05);
      } else if (m.drums === 'pulse') {
        if (s % 4 === 0) kick(0.4);
      }
      // Bass.
      const bassHits = m.drums === 'pulse' ? [0, 2, 4, 6, 8, 10, 12, 14] : m.drums === 'drive' ? [0, 3, 6, 8, 11, 14] : [0, 6, 10];
      if (bassHits.includes(s)) tone(N(root - 12), m.drums === 'pulse' ? 0.12 : 0.35, 'triangle', 0.32 * v, null, t, bus);
      // Pad: a soft chord held for the bar.
      if (m.pad && s === 0) {
        for (const iv of [0, 7, 12]) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = N(root + iv);
          const len = 60 / m.bpm * 4;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.045 * v, t + len * 0.3);
          g.gain.linearRampToValueAtTime(0.0001, t + len);
          o.connect(g).connect(bus);
          o.start(t);
          o.stop(t + len + 0.05);
        }
      }
      // Lead: plucked notes from the scale, generated per bar.
      if (m.lead && s % 2 === 0 && this.rand() < m.lead) {
        const deg = Math.floor(this.rand() * m.scale.length);
        tone(N(m.scale[deg] + 12), 0.28, 'triangle', 0.12 * v, null, t, bus);
        if (this.rand() < 0.25) tone(N(m.scale[deg] + 24), 0.12, 'sine', 0.04 * v, null, t + 0.06, bus);
      }
    },
  };

  return {
    unlock() {
      const c = ensure();
      if (c && Music.mood && !Music.timer) Music.start();
      return c;
    },
    prefs,
    get muted() { return !prefs.sfx && !prefs.music; },
    setMuted(m) { prefs.sfx = prefs.music = !m; savePrefs(); applyVolumes(); if (m) this.stopSiren(); },
    setSfx(on) { prefs.sfx = on; savePrefs(); applyVolumes(); if (!on) this.stopSiren(); },
    setMusic(on) { prefs.music = on; savePrefs(); applyVolumes(); },
    setVolume(kind, v) { prefs[kind + 'Vol'] = v; savePrefs(); applyVolumes(); },
    music(mood) { if (!ensure()) return; Music.set(mood); },

    // ---------- effects ----------
    click() { tone(880, 0.05, 'square', 0.04); },
    blip() { tone(520 + Math.random() * 80, 0.03, 'square', 0.015); },
    good() { tone(523, 0.12, 'triangle', 0.14); later(90, () => tone(784, 0.18, 'triangle', 0.14)); },
    bad() { tone(220, 0.25, 'sawtooth', 0.1, 140); },
    step() { noise(0.05, 0.05, 500, 'lowpass'); },
    whistle() { tone(2200, 0.18, 'sine', 0.12, 2500); later(200, () => tone(2300, 0.3, 'sine', 0.12, 2700)); },
    shot() { noise(0.2, 0.6, 2200); tone(160, 0.12, 'square', 0.08, 60); },
    launch() { noise(1.1, 0.25, 700); tone(260, 1, 'sawtooth', 0.05, 1100); },
    boom() { noise(0.9, 0.6, 350); tone(70, 0.6, 'sine', 0.3, 35); },
    gate() { tone(330, 0.12, 'square', 0.06); later(120, () => tone(440, 0.12, 'square', 0.06)); },
    pickup() { tone(660, 0.07, 'triangle', 0.1); later(60, () => tone(990, 0.09, 'triangle', 0.1)); },
    sweep() { noise(0.25, 0.12, 2500, 'bandpass'); later(140, () => noise(0.22, 0.1, 2200, 'bandpass')); },
    coin() { tone(988, 0.08, 'square', 0.07); later(80, () => tone(1319, 0.2, 'square', 0.07)); },
    ding() { tone(1568, 0.25, 'sine', 0.1); later(120, () => tone(2093, 0.3, 'sine', 0.08)); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => later(i * 110, () => tone(f, 0.25, 'triangle', 0.12))); },
    horn() { tone(196, 0.35, 'sawtooth', 0.08); tone(247, 0.35, 'sawtooth', 0.06); },
    truck() { noise(1.2, 0.18, 180); tone(55, 1.2, 'sawtooth', 0.05, 70); },
    pop() { tone(700, 0.05, 'sine', 0.05, 1100); },
    travel() { noise(1.5, 0.15, 220); tone(65, 1.5, 'sawtooth', 0.04, 90); },
    startSiren() {
      if (!prefs.sfx || !ensure() || siren) return;
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 800;
      lfo.frequency.value = 0.33;
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain).connect(o.frequency);
      g.gain.value = 0.07;
      o.connect(g).connect(sfxBus);
      o.start();
      lfo.start();
      siren = { o, lfo, g };
    },
    stopSiren() {
      if (!siren) return;
      const s = siren;
      siren = null;
      s.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      setTimeout(() => { s.o.stop(); s.lfo.stop(); }, 800);
    },
  };
})();
