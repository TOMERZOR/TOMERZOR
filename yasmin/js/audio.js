// Sound: recorded voice lines and effects, plus everything synthesized live with WebAudio:
// the corridor drone, fluorescent hum, drips, heartbeat, breathing, footsteps, stingers and the chase score.
const FILES = ['y_where', 'y_misdar', 'y_hear', 'y_spot', 'y_chase', 'y_lost', 'y_caught', 'y_intro', 'y_locker', 'y_hum',
  'n_laugh', 'n_whisper', 'n_cry', 'n_count', 'sfx_scream', 'sfx_bucket', 'sfx_mop', 'sfx_gate', 'sfx_door', 'sfx_distant', 'sfx_locker', 'sfx_power',
  'r_tape1', 'r_tape2', 'r_tape3', 'r_tape4', 'r_tape5', 'n_ruth', 'y_pa2', 'y_pa3', 'y_pa5', 'y_ruth', 'y_sing', 'sfx_bottle'];

export const SUBS = {
  y_where: 'יסמין: איפה אתה... הרצפה עוד רטובה...',
  y_misdar: 'יסמין: מסדר ניקיון... מי לא סידר את המיטה?',
  y_hear: 'יסמין: אני שומעת אותך...',
  y_spot: 'יסמין: הנה אתה!',
  y_chase: 'יסמין: תחזור לפה! עוד לא סיימנו לנקות!',
  y_lost: 'יסמין: טוב... אני אמצא אותך. אני תמיד מוצאת.',
  y_caught: 'יסמין: מסדר ניקיון!!!',
  y_intro: 'יסמין: לילה טוב... אל תלכלך לי את המסדרון.',
  y_locker: 'יסמין: אתה מתחבא בארון...?',
  y_hum: 'יסמין: (מזמזמת)',
  n_laugh: 'נבו: עוד מסדר! עוד מסדר! הרצפה מבריקה... הרצפה מבריקה!',
  n_whisper: 'נבו: היא באה... שמעת את הדלי? שמעת את הגלגלים?',
  n_cry: 'נבו: תוציאו אותי מפה... אני לא רוצה לראות מגב יותר בחיים...',
  n_count: 'נבו: ארבעים ושבעה מסדרים... ארבעים ושמונה... ארבעים ותשע...',
  n_ruth: 'נבו: רות... רות הייתה פה. היא אמרה שהיא תחזור בשבילי. היא לא חזרה.',
  y_pa2: 'רמקול: הודעה לכל החיילים. כלומר... לחייל. דוח צל״ם עד הבוקר. מי שלא מגיש — נשאר.',
  y_pa3: 'רמקול: מישהו השאיר אור דולק... אז כיביתי הכל.',
  y_pa5: 'רמקול: שמעתי שאתה רוצה הביתה... גם רות רצתה.',
  y_ruth: 'יסמין: גם רות חשבה שהיא תצליח!',
  y_sing: 'יסמין (שרה): נקי, נקי, הכל נקי... מי שמלכלך — הולך לישון...',
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.ready = false;
    this.vol = { master: 0.9, music: 0.8, sfx: 1 };
    this.onSub = null;
    this.fear = 0; this.chase = 0; this.dread = 0;
  }

  async load(base, ver = '0', progress) {
    // decode with a temporary context; buffers are reusable across contexts
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    let done = 0;
    await Promise.all(FILES.map(async n => {
      try {
        const r = await fetch(`${base}${n}.mp3?v=${ver}`);
        const ab = await r.arrayBuffer();
        this.buffers[n] = await new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej));
      } catch (e) { console.warn('audio', n, e); }
      progress && progress(++done / FILES.length);
    }));
    this.setup();
  }

  setup() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.vol.master;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.vol.music; this.music.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0; this.amb.connect(this.master);
    // corridor reverb: metal box, long-ish tail
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(2.4, 2.2);
    this.verbIn = c.createGain(); this.verbIn.gain.value = 0.5;
    this.verbIn.connect(this.verb); this.verb.connect(this.master);
    // a muffled filter that closes when hiding in a locker
    this.muffle = c.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
    this.muffle.connect(this.sfx);
    this.noiseBuf = this.makeNoise(3);
    this.brownBuf = this.makeNoise(4, true);
    this.ready = true;
  }

  impulse(sec, decay) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // early metallic reflections + diffuse tail
        const er = (i % 997 < 3 && t < 0.08) ? 0.7 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + er * (1 - t)) * (0.6 + 0.4 * Math.sin(i * 0.013));
      }
    }
    return b;
  }
  makeNoise(sec, brown = false) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  setListener(cam) {
    if (!this.ready) return;
    const l = this.ctx.listener, p = cam.position;
    const f = cam.getWorldDirection(this._f || (this._f = new cam.position.constructor()));
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02); l.positionY.setTargetAtTime(p.y, t, 0.02); l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(f.x, t, 0.02); l.forwardY.setTargetAtTime(f.y, t, 0.02); l.forwardZ.setTargetAtTime(f.z, t, 0.02);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  }

  panner(pos, ref = 2, rolloff = 1.4) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = 60;
    if (pos) this.setPos(p, pos);
    return p;
  }
  setPos(p, pos) {
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
  }

  // Play a recorded sample. Returns a handle {src, gain, panner, stop()}.
  play(name, { pos = null, volume = 1, rate = 1, loop = false, verb = 0.35, sub = true, ref = 2, offset = 0, muffle = true } = {}) {
    if (!this.ready || !this.buffers[name]) return null;
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.buffers[name]; src.loop = loop; src.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = volume;
    src.connect(g);
    let p = null;
    if (pos) { p = this.panner(pos, ref); g.connect(p); p.connect(muffle ? this.muffle : this.sfx); if (verb) { const s = c.createGain(); s.gain.value = verb; p.connect(s); s.connect(this.verbIn); } }
    else { g.connect(muffle ? this.muffle : this.sfx); if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verbIn); } }
    src.start(c.currentTime, offset);
    if (sub && SUBS[name] && this.onSub) this.onSub(SUBS[name], this.buffers[name].duration / rate + 0.6);
    return { src, gain: g, panner: p, stop: (f = 0.05) => { try { g.gain.setTargetAtTime(0, c.currentTime, f); src.stop(c.currentTime + f * 6); } catch (e) { } } };
  }

  // ---------- Synth helpers ----------
  env(g, t, a, peak, d, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }
  out(node, pos, verb = 0.3) {
    if (pos) { const p = this.panner(pos); node.connect(p); p.connect(this.muffle); if (verb) { const s = this.ctx.createGain(); s.gain.value = verb; p.connect(s); s.connect(this.verbIn); } }
    else { node.connect(this.muffle); if (verb) { const s = this.ctx.createGain(); s.gain.value = verb; node.connect(s); s.connect(this.verbIn); } }
  }
  noise(dur, { type = 'bandpass', f = 1000, q = 1, vol = 0.3, a = 0.005, pos = null, verb = 0.25, f2 = null, brown = false } = {}) {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); this.env(g, t, a, vol, dur);
    s.connect(fl); fl.connect(g); this.out(g, pos, verb);
    s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
  }
  tone(freq, dur, { type = 'sine', vol = 0.2, a = 0.005, pos = null, verb = 0.3, f2 = null, delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); this.env(g, t, a, vol, dur);
    o.connect(g); this.out(g, pos, verb);
    o.start(t); o.stop(t + a + dur + 0.05);
  }

  // Footsteps on linoleum (indoor) or gravel (yard).
  step({ run = false, outdoor = false, pos = null, heavy = false, vol = 1, wet = false } = {}) {
    if (!this.ready) return;
    const v = (run ? 0.42 : 0.24) * vol * (heavy ? 1.4 : 1);
    if (outdoor) {
      this.noise(0.16, { type: 'highpass', f: 1800, vol: v * 0.9, pos, verb: 0.05 });
      this.noise(0.1, { type: 'lowpass', f: 400, vol: v * 0.6, pos, verb: 0.05 });
      return;
    }
    this.noise(0.05, { type: 'bandpass', f: 2600 + Math.random() * 900, q: 1.2, vol: v * 0.7, pos, verb: 0.25 });
    this.noise(0.09, { type: 'lowpass', f: heavy ? 260 : 380, q: 1, vol: v * 1.2, pos, verb: 0.3, a: 0.003 });
    if (run && Math.random() < 0.35) this.noise(0.07, { type: 'bandpass', f: 5200, q: 6, vol: v * 0.25, pos, verb: 0.1 }); // squeak
    if (wet) this.noise(0.12, { type: 'bandpass', f: 1400, q: 2, vol: v * 0.5, pos, verb: 0.2, f2: 600 });
  }

  // ---------- Ambience and score ----------
  startAmbience() {
    if (!this.ready || this.ambOn) return;
    this.ambOn = true;
    const c = this.ctx, t = c.currentTime;
    this.amb.gain.setTargetAtTime(1, t, 2);
    // low drone: detuned saws through a slowly moving lowpass
    const dr = c.createGain(); dr.gain.value = 0.05; dr.connect(this.amb);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 3; lp.connect(dr);
    for (const f of [41.2, 41.6, 61.7, 82.6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05; const lg = c.createGain(); lg.gain.value = 70; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    this.drone = dr;
    // fluorescent hum
    const hum = c.createGain(); hum.gain.value = 0.012; hum.connect(this.amb);
    for (const [f, a] of [[100, 1], [200, 0.5], [300, 0.35], [400, 0.15], [1200, 0.04]]) { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = a; o.connect(g); g.connect(hum); o.start(); }
    this.hum = hum;
    // air: brown noise
    const air = c.createBufferSource(); air.buffer = this.brownBuf; air.loop = true;
    const ag = c.createGain(); ag.gain.value = 0.05; const af = c.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 500;
    air.connect(af); af.connect(ag); ag.connect(this.amb); air.start();
    this.air = ag;
    // tension pad (rises with fear)
    const pad = c.createGain(); pad.gain.value = 0; pad.connect(this.music);
    const pf = c.createBiquadFilter(); pf.type = 'bandpass'; pf.frequency.value = 900; pf.Q.value = 0.7; pf.connect(pad);
    for (const f of [220, 233.1, 311.1, 329.6, 466.2]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const v = c.createOscillator(); v.frequency.value = 4 + Math.random() * 2; const vg = c.createGain(); vg.gain.value = 3; v.connect(vg); vg.connect(o.frequency); v.start();
      const g = c.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(pf); o.start();
    }
    this.pad = pad;
    // chase layer: pulsing sub + high screech, gated by a fast LFO
    const ch = c.createGain(); ch.gain.value = 0; ch.connect(this.music);
    const sub = c.createOscillator(); sub.type = 'square'; sub.frequency.value = 55;
    const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 220;
    const gate = c.createGain(); gate.gain.value = 0;
    const glfo = c.createOscillator(); glfo.type = 'square'; glfo.frequency.value = 4.5; const gg = c.createGain(); gg.gain.value = 0.5; glfo.connect(gg); gg.connect(gate.gain);
    sub.connect(sf); sf.connect(gate); gate.connect(ch); sub.start(); glfo.start();
    const scr = c.createOscillator(); scr.type = 'sawtooth'; scr.frequency.value = 1760;
    const sv = c.createOscillator(); sv.frequency.value = 7; const svg = c.createGain(); svg.gain.value = 60; sv.connect(svg); svg.connect(scr.frequency); sv.start();
    const sg = c.createGain(); sg.gain.value = 0.025; const shp = c.createBiquadFilter(); shp.type = 'highpass'; shp.frequency.value = 1200;
    scr.connect(shp); shp.connect(sg); sg.connect(ch); scr.start();
    this.chaseBus = ch; this.chaseGlfo = glfo;
    this.nextDrip = 2; this.nextCreak = 8; this.nextBeat = 0; this.nextPerc = 0; this.breathT = 0;
  }

  update(dt, { fear = 0, chase = 0, outdoor = false, power = true, stamina = 1, hidden = false, alarm = 0 }) {
    if (!this.ambOn) return;
    const c = this.ctx, t = c.currentTime;
    this.hum.gain.setTargetAtTime(power && !outdoor ? 0.012 : 0, t, 0.3);
    this.drone.gain.setTargetAtTime((outdoor ? 0.03 : 0.05) + fear * 0.05, t, 0.5);
    this.pad.gain.setTargetAtTime(Math.min(1, fear * 0.9) * 0.6, t, 0.8);
    this.chaseBus.gain.setTargetAtTime(chase * 0.9, t, chase ? 0.15 : 1.2);
    this.chaseGlfo.frequency.setTargetAtTime(4.5 + alarm * 2, t, 0.5);
    this.muffle.frequency.setTargetAtTime(hidden ? 900 : 20000, t, 0.1);
    // random drips and creaks
    this.nextDrip -= dt;
    if (this.nextDrip < 0 && !outdoor) {
      this.nextDrip = 1.5 + Math.random() * 5;
      const f = 1400 + Math.random() * 1600;
      this.tone(f, 0.08, { vol: 0.03, f2: f * 0.5, verb: 0.9 });
    }
    this.nextCreak -= dt;
    if (this.nextCreak < 0) {
      this.nextCreak = 10 + Math.random() * 18;
      if (Math.random() < 0.6) this.noise(1.4, { type: 'bandpass', f: 300 + Math.random() * 400, q: 18, vol: 0.06, f2: 180 + Math.random() * 200, verb: 0.8 });
      else this.tone(60 + Math.random() * 30, 1.2, { type: 'triangle', vol: 0.08, verb: 0.9, a: 0.01 }); // distant bang
    }
    // heartbeat when afraid
    this.nextBeat -= dt;
    if (fear > 0.25 && this.nextBeat < 0) {
      const bpm = 70 + fear * 80;
      this.nextBeat = 60 / bpm;
      this.heartbeat(Math.min(1, fear));
    }
    // chase percussion
    if (chase > 0.3) {
      this.nextPerc -= dt;
      if (this.nextPerc < 0) {
        this.nextPerc = 60 / 150 * (Math.random() < 0.2 ? 0.5 : 1);
        this.tone(70, 0.25, { type: 'sine', vol: 0.35 * chase, f2: 35, verb: 0.2 });
        if (Math.random() < 0.5) this.noise(0.12, { type: 'highpass', f: 3000, vol: 0.08 * chase, verb: 0.3 });
      }
    }
    // breathing when out of breath
    this.breathT -= dt;
    if (stamina < 0.45 && this.breathT < 0) {
      this.breathT = 0.55 + stamina * 0.6;
      const v = (0.45 - stamina) * 0.35;
      this.noise(0.28, { type: 'bandpass', f: 900, q: 0.8, vol: v, verb: 0.05, a: 0.04 });
      this.noise(0.22, { type: 'bandpass', f: 1300, q: 0.8, vol: v * 0.7, verb: 0.05, a: 0.03, f2: 700 });
    }
  }

  heartbeat(k) {
    const c = this.ctx;
    for (const [d, v] of [[0, 1], [0.16, 0.7]]) {
      const t = c.currentTime + d;
      const o = c.createOscillator(); o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.15);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * k * v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.25);
    }
  }

  // ---------- One-shots ----------
  stinger(kind = 'discover') {
    if (!this.ready) return;
    if (kind === 'discover') {
      for (const f of [196, 207.7, 293.7, 415.3]) this.tone(f, 2.6, { type: 'sawtooth', vol: 0.035, a: 0.02, verb: 0.9 });
      this.noise(1.8, { type: 'bandpass', f: 4000, q: 3, vol: 0.06, f2: 900, verb: 0.9 });
      this.tone(40, 1.5, { vol: 0.4, a: 0.01, verb: 0.2 });
    } else if (kind === 'peek') {
      this.noise(0.6, { type: 'highpass', f: 2500, vol: 0.25, a: 0.002, f2: 6000, verb: 0.6 });
      for (const f of [880, 932, 1245]) this.tone(f, 1.0, { type: 'sawtooth', vol: 0.05, verb: 0.8, a: 0.002 });
      this.tone(45, 1.0, { vol: 0.6, a: 0.005 });
    } else if (kind === 'riser') {
      this.noise(2.5, { type: 'bandpass', f: 300, q: 2, vol: 0.2, f2: 6000, a: 2.2, verb: 0.6 });
    }
  }
  jumpscare() {
    if (!this.ready) return;
    this.play('sfx_scream', { volume: 1.3, verb: 0.3, muffle: false });
    this.play('y_caught', { volume: 1.4, verb: 0.4, muffle: false, rate: 0.95 });
    this.noise(1.2, { type: 'lowpass', f: 8000, vol: 0.7, a: 0.002, verb: 0.2 });
    this.tone(38, 1.6, { vol: 0.9, a: 0.003, f2: 25 });
    for (const f of [311, 330, 466, 494, 622]) this.tone(f, 1.4, { type: 'sawtooth', vol: 0.09, a: 0.003 });
  }
  pickup() { this.tone(1320, 0.12, { vol: 0.06, verb: 0.4 }); this.tone(1980, 0.18, { vol: 0.04, delay: 0.06, verb: 0.5 }); this.noise(0.08, { type: 'highpass', f: 3000, vol: 0.05 }); }
  keys() { for (let i = 0; i < 6; i++) this.tone(2800 + Math.random() * 2400, 0.09, { type: 'triangle', vol: 0.05, delay: i * 0.05 + Math.random() * 0.03, verb: 0.3 }); }
  paper() { this.noise(0.25, { type: 'highpass', f: 2200, vol: 0.12, a: 0.02, verb: 0.1 }); this.noise(0.18, { type: 'bandpass', f: 4500, vol: 0.08, a: 0.04, verb: 0.1 }); }
  click() { this.noise(0.03, { type: 'highpass', f: 3500, vol: 0.2, verb: 0.05 }); this.tone(2400, 0.03, { vol: 0.05, verb: 0 }); }
  buzz(pos) { this.noise(0.4, { type: 'bandpass', f: 120, q: 4, vol: 0.4, pos }); this.tone(100, 0.4, { type: 'square', vol: 0.05, pos }); }
  bulbPop(pos) { this.noise(0.08, { type: 'highpass', f: 2000, vol: 0.5, pos, a: 0.001, verb: 0.6 }); this.noise(0.6, { type: 'highpass', f: 6000, vol: 0.12, pos, verb: 0.5 }); }
  mopSwish() { this.noise(0.5, { type: 'bandpass', f: 1200, q: 1.5, vol: 0.18, a: 0.08, f2: 500, verb: 0.2 }); }
  grind(dur = 4) { this.noise(dur, { type: 'bandpass', f: 180, q: 10, vol: 0.35, a: 0.3, f2: 420, verb: 0.4 }); this.noise(dur, { type: 'bandpass', f: 2400, q: 14, vol: 0.06, a: 0.5, f2: 1400, verb: 0.4 }); }
  static_(dur = 1.2, vol = 0.12) { this.noise(dur, { type: 'bandpass', f: 2200, q: 0.6, vol, a: 0.01, verb: 0.05 }); }
  lever() { this.noise(0.1, { type: 'lowpass', f: 600, vol: 0.5, a: 0.002 }); this.tone(90, 0.3, { vol: 0.3 }); }
  fanfare() { [0, 0.25, 0.5].forEach((d, i) => this.tone([392, 494, 587][i], 1.6, { type: 'triangle', vol: 0.08, delay: d, verb: 0.8 })); }
}
