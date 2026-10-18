// Tiny WebAudio synth: no audio files needed.
const Sound = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let siren = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'square', vol = 0.15, slideTo = null) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.3, cutoff = 900) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  return {
    unlock: ensure,
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      if (m) this.stopSiren();
    },
    click() { tone(660, 0.06, 'square', 0.06); },
    good() { tone(523, 0.1, 'triangle', 0.15); setTimeout(() => tone(784, 0.16, 'triangle', 0.15), 90); },
    bad() { tone(220, 0.25, 'sawtooth', 0.12, 140); },
    step() { tone(120 + Math.random() * 40, 0.03, 'triangle', 0.03); },
    whistle() { tone(2200, 0.35, 'sine', 0.12, 2600); },
    shot() { noise(0.18, 0.5, 1800); },
    launch() { noise(0.9, 0.25, 600); tone(300, 0.8, 'sawtooth', 0.05, 900); },
    boom() { noise(0.7, 0.55, 400); },
    gate() { tone(330, 0.12, 'square', 0.08); setTimeout(() => tone(440, 0.12, 'square', 0.08), 120); },
    startSiren() {
      if (muted || !ensure() || siren) return;
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
      o.connect(g).connect(master);
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
