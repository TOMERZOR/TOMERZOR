// Sound. Effects are synthesised with the Web Audio API so the game needs no sample library;
// music and the two radio stations are streamed files (generated, see tools/asset-jobs.json).
import { RADIO } from '../game/defs.js';
import { clamp } from '../core/util.js';

export class GameAudio {
  constructor(game) {
    this.game = game; this.ctx = null; this.ready = false;
    this.vol = { master: 0.9, music: 0.6, sfx: 0.9 };
    this.radioIdx = 1; this.radioEl = null; this.musicEl = null; this.engine = null; this.sirenOn = false;
    this.stepT = 0; this.ambT = 0;
    const unlock = () => { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); };
    window.addEventListener('pointerdown', unlock, { passive: true }); window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else if (!game.paused) this.ctx.resume(); });
    const b = game.bus;
    b.on('swing', (a) => this.at(a.pos, () => this.whoosh()));
    b.on('impact', (a, atk) => this.at(a.pos, () => this.thud(atk.heavy)));
    b.on('crash', (v, imp) => this.at(v.pos, () => this.crash(clamp(imp / 14, 0.15, 1))));
    b.on('honk', (v) => this.at(v.pos, () => this.horn(v.def.mass > 3 ? 150 : v.def.bike ? 520 : 400)));
    b.on('runover', (v) => this.at(v.pos, () => this.thud(true)));
    b.on('money', (n) => { if (n > 0) this.cash(); });
    b.on('wanted', (lvl, before) => { if (lvl > before) this.blip(880, 0.09, 'square', 0.14, 660); });
    b.on('notify', () => this.blip(1200, 0.05, 'sine', 0.1));
    b.on('enterVehicle', () => { this.door(); this.playRadio(); });
    b.on('leaveVehicle', () => { this.door(); this.stopRadio(); });
    b.on('ko', (v) => this.at(v.pos, () => this.thud(true)));
    b.on('cat', (c) => this.at(c, () => this.meow()));
    b.on('carKick', (v) => this.at(v.pos, () => this.crash(0.2)));
    b.on('objective', () => this.blip(740, 0.07, 'triangle', 0.12, 990));
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.sfx = c.createGain(); this.musicG = c.createGain();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.sfx.connect(this.master); this.musicG.connect(this.master); this.master.connect(comp); comp.connect(c.destination);
    // one second of white noise, reused by every noise-based effect
    const nb = this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolume(); this.ready = true;
    this.startAmbience();
    if (this.wantMenu && !this.game.playing) this.music('assets/audio/menu.m4a');
  }
  applyVolume() { if (!this.ctx) return; this.master.gain.value = this.vol.master; this.sfx.gain.value = this.vol.sfx; this.musicG.gain.value = this.vol.music; if (this.radioEl) this.radioEl.volume = clamp(this.vol.music * this.vol.master * 0.8, 0, 1); if (this.musicEl) this.musicEl.volume = clamp(this.vol.music * this.vol.master * 0.7, 0, 1); }

  // run fn with the output attenuated by distance from the listener
  at(pos, fn) {
    if (!this.ready) return;
    const p = this.game.player.pos, d = Math.hypot((pos.x || 0) - p.x, (pos.z || 0) - p.z);
    if (d > 70) return;
    this._gain = 1 / (1 + (d / 9) ** 2);
    fn(); this._gain = 1;
  }
  out(g = 1) { const n = this.ctx.createGain(); n.gain.value = g * (this._gain === undefined ? 1 : this._gain); n.connect(this.sfx); return n; }
  noise(dur, freq, q, gain, type = 'lowpass', sweep) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = this.out(gain); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  blip(freq, dur, type = 'sine', gain = 0.15, to) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.out(gain); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.05);
    o.connect(g); o.start(t); o.stop(t + dur + 0.08);
  }
  whoosh() { this.noise(0.16, 900, 1.2, 0.16, 'bandpass', 2600); }
  thud(heavy) { this.noise(heavy ? 0.2 : 0.11, heavy ? 520 : 900, 0.8, heavy ? 0.6 : 0.42, 'lowpass', 90); this.blip(heavy ? 95 : 140, 0.09, 'sine', heavy ? 0.5 : 0.3, 45); }
  crash(k) { this.noise(0.25 + k * 0.4, 2400, 0.6, 0.25 + k * 0.5, 'lowpass', 180); this.blip(70, 0.2, 'triangle', 0.3 * k, 35); this.noise(0.12, 5200, 3, 0.12 * k, 'bandpass'); }
  horn(f) { this.blip(f, 0.32, 'sawtooth', 0.11); this.blip(f * 1.26, 0.32, 'sawtooth', 0.09); }
  door() { if (!this.ready) return; this.noise(0.09, 320, 1, 0.4, 'lowpass', 80); }
  cash() { if (!this.ready) return; this.blip(1320, 0.07, 'sine', 0.13); setTimeout(() => this.blip(1760, 0.14, 'sine', 0.13), 70); }
  click() { this.blip(520, 0.03, 'triangle', 0.1); }
  meow() { this.blip(700, 0.25, 'sawtooth', 0.05, 1100); }
  step(run) { this.noise(0.05, run ? 1500 : 1100, 0.9, run ? 0.07 : 0.045, 'bandpass'); }
  // short phrase in a Hijaz-flavoured scale: mission passed / failed
  jingle(kind) {
    if (!this.ready) return;
    const notes = kind === 'pass' ? [293.7, 311.1, 370, 392, 440, 587.3] : kind === 'fail' ? [392, 370, 311.1, 293.7] : [293.7, 370, 440];
    notes.forEach((f, i) => setTimeout(() => { this.blip(f, kind === 'pass' ? 0.2 : 0.3, 'triangle', 0.17); this.blip(f / 2, 0.25, 'sine', 0.1); }, i * (kind === 'pass' ? 95 : 170)));
  }

  startAmbience() {
    const c = this.ctx;
    const mk = (type, freq, q) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfx); s.start(); return { g, f }; };
    this.wind = mk('lowpass', 420, 0.4); this.crickets = mk('bandpass', 4300, 18);
    // engine: two detuned saws through a low-pass that opens with revs
    const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx); o1.start(); o2.start();
    this.engine = { o1, o2, f, g };
    const s1 = c.createOscillator(), sg = c.createGain(); s1.type = 'square'; sg.gain.value = 0; const sf = c.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1100; sf.Q.value = 2;
    s1.connect(sf); sf.connect(sg); sg.connect(this.sfx); s1.start(); this.siren = { o: s1, g: sg };
  }

  // ---- music ------------------------------------------------------------------------
  // The title theme starts as soon as the browser allows sound (first tap or key).
  menuMusic() { this.wantMenu = true; if (this.ready && !this.musicEl) this.music('assets/audio/menu.m4a'); }
  music(file, loop = true) {
    if (!file) this.wantMenu = false;
    if (this.musicEl) { const old = this.musicEl; this.musicEl = null; this.fade(old, 0, 700, () => old.pause()); }
    if (!file) return;
    const a = this.musicEl = new Audio(file); a.loop = loop; a.volume = 0;
    a.play().then(() => this.fade(a, clamp(this.vol.music * this.vol.master * 0.7, 0, 1), 900)).catch(() => {});
  }
  fade(a, to, ms, done) { const from = a.volume, t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = clamp(from + (to - from) * k, 0, 1); if (k < 1) requestAnimationFrame(step); else if (done) done(); }; step(); }
  playRadio() {
    const st = RADIO[this.radioIdx]; this.stopRadio();
    if (!st || !st.file) return;
    const a = this.radioEl = new Audio(st.file); a.loop = true; a.volume = clamp(this.vol.music * this.vol.master * 0.8, 0, 1);
    a.currentTime = 0; a.play().catch(() => {});
  }
  stopRadio() { if (this.radioEl) { this.radioEl.pause(); this.radioEl = null; } }
  nextRadio() {
    this.radioIdx = (this.radioIdx + 1) % RADIO.length; const st = RADIO[this.radioIdx];
    this.noise(0.18, 3000, 4, 0.12, 'bandpass', 900);
    this.playRadio(); this.game.ui.zone(st.name, st.tag || '');
  }
  pause(on) { if (this.radioEl) { if (on) this.radioEl.pause(); else this.radioEl.play().catch(() => {}); } }

  update(dt) {
    if (!this.ready) return;
    const g = this.game, pl = g.player, c = this.ctx, t = c.currentTime, night = g.sky.night;
    const active = g.playing && !g.paused;
    this.wind.g.gain.setTargetAtTime(active ? 0.035 + (pl.vehicle ? clamp(pl.vehicle.speed / 40, 0, 1) * 0.16 : 0) : 0, t, 0.3);
    this.crickets.g.gain.setTargetAtTime(active ? night * 0.03 * (0.6 + 0.4 * Math.sin(g.time * 23)) : 0, t, 0.05);
    const v = pl.vehicle, e = this.engine;
    if (v && active && !v.wreck) {
      const rev = clamp(Math.abs(v.vf) / v.def.top, 0, 1), base = (v.def.bike ? 95 : v.def.mass > 3 ? 42 : 62) + (((rev * 4) % 1) * 0.35 + rev) * (v.def.bike ? 150 : 95) + v.in.throttle * 14;
      e.o1.frequency.setTargetAtTime(base, t, 0.06); e.o2.frequency.setTargetAtTime(base * 0.502, t, 0.06);
      e.f.frequency.setTargetAtTime(260 + rev * 1500 + v.in.throttle * 500, t, 0.08); e.g.gain.setTargetAtTime(0.05 + v.in.throttle * 0.035, t, 0.1);
    } else e.g.gain.setTargetAtTime(0, t, 0.12);
    // nearest siren
    let near = 1e9; for (const o of g.world.vehicles) if (o.siren) { const d = Math.hypot(o.pos.x - pl.pos.x, o.pos.z - pl.pos.z); if (d < near) near = d; }
    if (near < 160 && active) { const ph = (g.time * 0.9) % 1; this.siren.o.frequency.setTargetAtTime(ph < 0.5 ? 640 + ph * 760 : 1400 - ph * 760, t, 0.03); this.siren.g.gain.setTargetAtTime(0.05 / (1 + (near / 30) ** 2), t, 0.1); }
    else this.siren.g.gain.setTargetAtTime(0, t, 0.2);
    // footsteps
    if (!v && active && pl.speed > 0.6 && !pl.actor.air) { this.stepT -= dt * (pl.speed > 4 ? 3.3 : 2.1) * Math.max(0.6, pl.speed / 3.5); if (this.stepT <= 0) { this.stepT = 1; this.step(pl.speed > 4); } }
  }
}
