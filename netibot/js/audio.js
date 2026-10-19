// WebAudio synth: sound effects and generated background music, no audio files.
// Music and effects have separate on/off switches and volumes, saved per browser.
const Sound = (() => {
  let ctx = null;
  let master = null, sfxBus = null, musicBus = null;
  let siren = null;
  let noiseBuf = null;
  const voiceBufs = {};
  const prefs = { sfx: true, music: true, sfxVol: 0.8, musicVol: 0.5, style: 'lofi' };
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
  // A small generative composer. Each piece has a form (A, A', B, a quiet bridge), a chord
  // progression and a short motif that comes back with variations, so it sounds like a
  // song instead of a loop. Between pieces there is a pause of near-silence.
  // Three styles: Mizrahi (darbuka and oud-like plucks), lo-fi (soft keys, lazy drums,
  // vinyl crackle) and ambient (pads and bells only).
  const N = (semi) => 146.83 * Math.pow(2, semi / 12); // semitones above D3
  const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19];   // D freygish: the Middle-Eastern sound
  const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19];
  const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19];
  // Progressions as chord roots in semitones, one chord per bar.
  const PROGS = {
    mizrahi: [[0, 0, -2, 1], [0, -4, -2, 1], [0, 5, 3, 1], [0, -2, -4, 1]],
    lofi: [[0, 5, -2, 3], [0, -4, 5, -2], [0, 3, 5, -2], [0, -2, -4, -5]],
    ambient: [[0, -4, 5, -2], [0, 3, -2, 5], [0, -5, -2, 0]],
  };
  // Moods set tempo and energy; tension and the boss have their own fixed sound.
  const MOODS = {
    menu: { bpm: 84, energy: 0.5 },
    day: { bpm: 96, energy: 0.8 },
    night: { bpm: 72, energy: 0.45 },
    deploy: { bpm: 116, energy: 1 },
    tension: { bpm: 128, energy: 1, fixed: 'pulse' },
    boss: { bpm: 140, energy: 1, fixed: 'boss' },
  };
  const Music = {
    mood: null, next: null, step: 0, bar: 0, time: 0, timer: null, seed: 1, song: null,
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
    style() { return prefs.style || 'lofi'; },
    // A new piece: progression, transposition, two motifs, and the pause that follows it.
    newSong() {
      this.seed = 1 + Math.floor(Math.random() * 1e6);
      const st = this.style();
      const progs = PROGS[st];
      const motif = () => {
        const m = [];
        for (let i = 0; i < 16; i++) m.push(this.rand() < (st === 'ambient' ? 0.12 : 0.42) ? Math.floor(this.rand() * 5) : null);
        m[0] = 0;
        return m;
      };
      this.song = {
        style: st, prog: progs[Math.floor(this.rand() * progs.length)], shift: [0, -2, 3, 5][Math.floor(this.rand() * 4)],
        motifA: motif(), motifB: motif(), bars: 32, rest: 6 + Math.floor(this.rand() * 6), at: 0,
      };
    },
    tick() {
      if (!ctx) return;
      while (this.time < ctx.currentTime + 0.25) {
        if (this.step % 16 === 0) {
          if (this.next) { this.mood = this.next; this.next = null; if (MOODS[this.mood].fixed) this.song = null; }
          if (!this.song || this.song.style !== this.style() || this.song.at >= this.song.bars + this.song.rest) this.newSong();
          this.bar = this.song.at++;
        }
        if (!this.song) this.newSong();
        const m = MOODS[this.mood];
        if (m.fixed) this.playFixed(m, this.step % 16, this.time);
        else this.play(m, this.step % 16, this.time);
        // Lo-fi swings its off-beats a little.
        const swing = this.style() === 'lofi' && !m.fixed ? (this.step % 2 ? -0.025 : 0.025) : 0;
        this.time += 60 / m.bpm / 4 * (1 + swing);
        this.step++;
      }
    },
    // Tension (red alert) and the boss fight: short, driving, no pauses.
    playFixed(m, s, t) {
      const bus = musicBus;
      const root = m.fixed === 'boss' ? [0, 1, 0, -2][Math.floor(this.step / 16) % 4] : [0, 0, 1, 0][Math.floor(this.step / 16) % 4];
      if (s % 4 === 0) tone(110, 0.18, 'sine', 0.4, 40, t, bus);
      if (m.fixed === 'boss') {
        if (s === 4 || s === 12) noise(0.12, 0.16, 1800, 'bandpass', t, bus, 1);
        if (s % 2 === 1) noise(0.03, 0.05, 8000, 'highpass', t, bus);
        if (s % 2 === 0 && Math.random() < 0.6) tone(N(HIJAZ[Math.floor(Math.random() * 8)] + 12), 0.22, 'square', 0.05, null, t, bus);
      }
      if (s % 2 === 0) tone(N(root - 12), 0.12, 'triangle', 0.3, null, t, bus);
    },
    play(m, s, t) {
      const bus = musicBus;
      const S = this.song;
      const st = S.style;
      const e = m.energy;
      const scale = st === 'mizrahi' ? HIJAZ : st === 'lofi' ? DORIAN : MINOR;
      // The pause between pieces: a soft held note every other bar, then nothing.
      if (S.at > S.bars) {
        if (s === 0 && S.at % 2 === 0 && S.at < S.bars + S.rest - 1) this.pad(N(S.shift), 0.018, 60 / m.bpm * 8, t);
        return;
      }
      const bar = this.bar;
      const section = Math.floor(bar / 8);           // 0 A, 1 A', 2 B, 3 quiet bridge
      const root = S.prog[bar % 4] + S.shift;
      const third = scale.includes(((root - S.shift) % 12 + 12 + 3) % 12) ? 3 : 4;
      const chord = [0, third, 7, st === 'lofi' ? 10 : 12];
      const quiet = section === 3;
      // Drums.
      const kick = (vol) => tone(st === 'lofi' ? 80 : 105, 0.2, 'sine', vol, 42, t, bus);
      const hat = (vol) => noise(0.03, vol, 8000, 'highpass', t, bus);
      if (st === 'mizrahi' && !quiet) {
        if (s === 0 || s === 10) { tone(95, 0.22, 'sine', 0.36 * e, 60, t, bus); noise(0.08, 0.1 * e, 300, 'lowpass', t, bus); }
        if (s === 4 || s === 6 || s === 12) noise(0.05, 0.11 * e, 3200, 'bandpass', t, bus, 4);
        if (section === 2 && s % 2 === 1 && this.rand() < 0.3) noise(0.04, 0.05 * e, 3200, 'bandpass', t, bus, 4);
      } else if (st === 'lofi' && !quiet) {
        if (s === 0 || (s === 10 && this.rand() < 0.6)) kick(0.3 * e);
        if (s === 4 || s === 12) noise(0.14, 0.06 * e, 1600, 'bandpass', t, bus, 0.8);
        if (s % 2 === 0) hat(0.022 * e);
        if (this.rand() < 0.08) noise(0.02, 0.012, 5000, 'highpass', t, bus); // vinyl crackle
      }
      // Bass on the chord root.
      if (st !== 'ambient' && !quiet && (s === 0 || (s === 8 && section !== 0) || (st === 'mizrahi' && s === 6))) tone(N(root - 12), 0.4, 'triangle', 0.26 * e, null, t, bus);
      // Chords: a held pad, or soft keys stabs in lo-fi.
      if (s === 0) {
        if (st === 'lofi') for (const iv of chord) tone(N(root + iv), 1.1, 'sine', 0.035, null, t, bus);
        else this.pad(N(root), st === 'ambient' ? 0.05 : 0.035, 60 / m.bpm * 4, t, chord);
      }
      if (st === 'lofi' && s === 7 && !quiet) for (const iv of chord.slice(1)) tone(N(root + iv), 0.5, 'sine', 0.022, null, t, bus);
      // Melody: the motif of this section, with one note changed now and then.
      if (s % 2 === 0) {
        const motif = section === 2 ? S.motifB : S.motifA;
        let deg = motif[(bar % 2) * 8 + s / 2];
        if (deg === null || (quiet && this.rand() < 0.7) || (section === 0 && bar % 8 < 2)) return;
        if (section === 1 && this.rand() < 0.2) deg = (deg + 1 + Math.floor(this.rand() * 2)) % 5;
        const i = scale.indexOf(((root - S.shift) % 12 + 12) % 12);
        const note = scale[Math.max(0, i) + deg] !== undefined ? scale[Math.max(0, i) + deg] : scale[deg];
        if (st === 'ambient') tone(N(note + S.shift + 24), 1.6, 'sine', 0.05, null, t, bus);
        else if (st === 'lofi') tone(N(note + S.shift + 12), 0.45, 'triangle', 0.06 * e, null, t, bus);
        else {
          tone(N(note + S.shift + 12), 0.26, 'triangle', 0.09 * e, null, t, bus);
          tone(N(note + S.shift + 24), 0.1, 'sine', 0.025 * e, null, t + 0.03, bus);
        }
      }
    },
    pad(freq, vol, len, t, ivs = [0, 7, 12]) {
      for (const iv of ivs) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq * Math.pow(2, iv / 12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + len * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(musicBus);
        o.start(t);
        o.stop(t + len + 0.05);
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
    // Recorded voice lines (mp3). A new line cuts off the one still playing.
    // Voice lines (the boss) play through WebAudio like any other effect. An <audio> element
    // would show up on the phone as media playing (lock screen, Spotify-style controls) and
    // pause the user's own music.
    voice(src) {
      if (!prefs.sfx || (typeof Settings !== 'undefined' && !Settings.v.voices) || !ensure()) return;
      this.stopVoice();
      const token = this._vt;
      voiceBufs[src] = voiceBufs[src] || fetch(src).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)));
      voiceBufs[src].then(buf => {
        if (token !== this._vt) return;
        const s = ctx.createBufferSource();
        const g = ctx.createGain();
        g.gain.value = 1.15;
        s.buffer = buf;
        s.connect(g).connect(sfxBus);
        s.start();
        this._voice = s;
      }).catch(() => { delete voiceBufs[src]; });
    },
    stopVoice() {
      this._vt = (this._vt || 0) + 1;
      if (this._voice) { try { this._voice.stop(); } catch (e) { /* already ended */ } this._voice = null; }
    },
    _music: Music,
    STYLES: { lofi: 'לו-פיי רגוע', mizrahi: 'מזרחית', ambient: 'אווירה שקטה' },
    get style() { return Music.style(); },
    setStyle(st) { prefs.style = st; savePrefs(); if (Music.song) Music.song.at = 1e9; },

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
    fart() {
      // A low, wobbling raspberry.
      if (!ensure() || !prefs.sfx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.7);
      lfo.frequency.value = 28;
      lg.gain.value = 30;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 600;
      o.connect(f).connect(g).connect(sfxBus);
      o.start(t); lfo.start(t);
      o.stop(t + 0.8); lfo.stop(t + 0.8);
      noise(0.5, 0.05, 300, 'lowpass');
    },
    splat() { noise(0.18, 0.35, 900, 'lowpass'); tone(140, 0.12, 'sine', 0.1, 60); },
    whoosh() { noise(0.35, 0.12, 1800, 'bandpass', 0, null, 1.5); },
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
