// Sound: a plucked-string synth, the metronome scheduler, and pitch detection from the microphone.

const Sound = (() => {
  let ctx = null;
  let master = null;
  const cache = new Map();

  function context() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
  const noteName = (m) => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12];
  const octave = (m) => Math.floor(Math.round(m) / 12) - 1;

  // Karplus-Strong: a burst of noise through a decaying delay line. The buffer is rendered
  // at a whole-sample period and played back at a rate that lands exactly on pitch.
  function pluckBuffer(midi) {
    const key = Math.round(midi);
    if (cache.has(key)) return cache.get(key);
    const c = context();
    const sr = c.sampleRate;
    const f = midiToFreq(key);
    const period = Math.max(2, Math.round(sr / f));
    const dur = 2.6;
    const len = Math.floor(sr * dur);
    const buf = c.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const ring = new Float32Array(period);
    let prev = 0;
    for (let i = 0; i < period; i++) {
      const n = Math.random() * 2 - 1;
      prev = prev * 0.45 + n * 0.55; // a softer pick
      ring[i] = prev;
    }
    const decay = key < 52 ? 0.9965 : key < 64 ? 0.995 : 0.993;
    let idx = 0, last = ring[period - 1];
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const v = decay * 0.5 * (cur + last);
      last = cur;
      ring[idx] = v;
      out[i] = cur;
      idx = idx + 1 === period ? 0 : idx + 1;
    }
    const entry = { buf, rate: f / (sr / period) };
    cache.set(key, entry);
    return entry;
  }

  function pluck(midi, when = 0, gain = 0.5, length = 2.4) {
    const c = context();
    const { buf, rate } = pluckBuffer(midi);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    const t = Math.max(when, c.currentTime);
    g.gain.setValueAtTime(gain, t);
    g.gain.setTargetAtTime(0, t + length, 0.08);
    const tone = c.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 4200;
    src.connect(tone).connect(g).connect(master);
    src.start(t);
    src.stop(t + length + 0.6);
  }

  function chordMidis(id, tuning = TUNING) {
    const ch = CHORDS[id];
    if (!ch) return [];
    return ch.frets.map((f, i) => (f < 0 ? null : tuning[i] + f)).filter((m) => m !== null);
  }

  // dir "D" strums low to high, "U" high to low (top 4 strings only)
  function strum(id, when = 0, dir = "D", gain = 0.32, length = 1.8) {
    let notes = chordMidis(id);
    if (dir === "U") notes = notes.slice(-4).reverse();
    const c = context();
    const t0 = Math.max(when, c.currentTime);
    const gap = dir === "U" ? 0.012 : 0.018;
    notes.forEach((m, i) => pluck(m, t0 + i * gap, gain * (dir === "U" ? 0.75 : 1), length));
  }

  function click(when, accent, gain = 0.6) {
    const c = context();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = accent === 2 ? 1760 : accent === 1 ? 1100 : 800;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain * (accent === 0 ? 0.45 : 1), when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g).connect(master);
    o.start(when);
    o.stop(when + 0.06);
  }

  // Metronome with optional subdivisions, a speed trainer and a per-slot hook for
  // anything that should play in time (strums, backing chords).
  class Metronome {
    constructor() {
      this.bpm = 80;
      this.beats = 4;
      this.sub = 1;
      this.clickOn = true;
      this.subClicks = true;
      this.volume = 0.6;
      this.trainer = null; // { step, everyBars, target }
      this.onTick = null; // (info) => void, called in sync with the sound
      this.onSchedule = null; // (info, time) => void, called ahead of time
      this.onBpm = null;
      this.running = false;
      this._timer = null;
    }
    start() {
      const c = context();
      this.stop();
      this.running = true;
      this.bar = 0;
      this.slot = 0;
      this.next = c.currentTime + 0.12;
      this._loop();
    }
    stop() {
      this.running = false;
      clearTimeout(this._timer);
    }
    _loop() {
      if (!this.running) return;
      const c = context();
      while (this.next < c.currentTime + 0.12) {
        const slotsPerBar = this.beats * this.sub;
        const beat = Math.floor(this.slot / this.sub);
        const subIdx = this.slot % this.sub;
        const info = { bar: this.bar, beat, sub: subIdx, slot: this.slot, slotsPerBar, bpm: this.bpm };
        const time = this.next;
        if (this.clickOn && (subIdx === 0 || this.subClicks)) {
          click(time, subIdx !== 0 ? 0 : beat === 0 ? 2 : 1, this.volume);
        }
        if (this.onSchedule) this.onSchedule(info, time);
        if (this.onTick) {
          const delay = Math.max(0, (time - c.currentTime) * 1000);
          setTimeout(() => this.running && this.onTick && this.onTick(info), delay);
        }
        this.next += 60 / this.bpm / this.sub;
        this.slot++;
        if (this.slot >= slotsPerBar) {
          this.slot = 0;
          this.bar++;
          const t = this.trainer;
          if (t && this.bar % t.everyBars === 0 && this.bpm < t.target) {
            this.bpm = Math.min(t.target, this.bpm + t.step);
            if (this.onBpm) this.onBpm(this.bpm);
          }
        }
      }
      this._timer = setTimeout(() => this._loop(), 25);
    }
  }

  // ---- Pitch detection (YIN) ----
  let micStream = null, analyser = null, micBuf = null, rafId = 0;
  const listeners = new Set();

  function yin(buf, sr) {
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    if (rms < 0.008) return null;
    const tauMin = Math.floor(sr / 1400);
    const tauMax = Math.min(Math.floor(sr / 60), Math.floor(buf.length / 2));
    const W = buf.length - tauMax;
    const d = new Float32Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) {
        const diff = buf[j] - buf[j + tau];
        s += diff * diff;
      }
      d[tau] = s;
    }
    // cumulative mean normalised difference
    let running = 0;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      running += d[tau];
      d[tau] = running ? (d[tau] * tau) / running : 1;
    }
    let tau = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (d[t] < 0.15) {
        while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) {
      let best = 1;
      for (let t = tauMin; t <= tauMax; t++) if (d[t] < best) { best = d[t]; tau = t; }
      if (best > 0.35) return null;
    }
    let better = tau;
    if (tau > 1 && tau < tauMax) {
      const a = d[tau - 1], b = d[tau], c = d[tau + 1];
      const den = a + c - 2 * b;
      if (den) better = tau + (a - c) / (2 * den);
    }
    return { freq: sr / better, clarity: 1 - d[tau], rms };
  }

  async function startMic() {
    if (micStream) return true;
    const c = context();
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = c.createMediaStreamSource(micStream);
    analyser = c.createAnalyser();
    analyser.fftSize = 4096;
    micBuf = new Float32Array(analyser.fftSize);
    src.connect(analyser);
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!listeners.size) return;
      analyser.getFloatTimeDomainData(micBuf);
      const r = yin(micBuf, c.sampleRate);
      listeners.forEach((fn) => fn(r));
    };
    tick();
    return true;
  }

  function stopMic() {
    cancelAnimationFrame(rafId);
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
    analyser = null;
  }

  function listen(fn) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
      if (!listeners.size) stopMic();
    };
  }

  return { context, pluck, strum, chordMidis, click, Metronome, startMic, stopMic, listen, yin, midiToFreq, freqToMidi, noteName, octave };
})();
