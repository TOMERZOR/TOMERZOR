// The computer opponent. It reads the fight a few frames late (its reaction
// time) and answers with the same buttons a player has.

import { IN, MOVES, FIGHTERS, CONST } from "./sim.js";

export class Bot {
  constructor(me, level = 1) {
    this.me = me;
    this.level = level;            // 0 easy, 1 normal, 2 hard
    this.plan = [];                // queued inputs, one per frame
    this.hold = 0;
    this.cool = 0;
    this.seed = 1234567 + me * 99;
    this.react = [16, 10, 6][level];
    this.history = [];
  }
  rnd() { this.seed = (this.seed * 1103515245 + 12345) >>> 0; return this.seed / 4294967296; }

  dirs(p, fwd) {
    const towards = p.face > 0 ? IN.RIGHT : IN.LEFT;
    const away = p.face > 0 ? IN.LEFT : IN.RIGHT;
    return fwd ? towards : away;
  }

  // queue a button press: hold dir for a frame, press, release
  press(dirBits, btn, frames = 3) {
    for (let i = 0; i < frames; i++) this.plan.push(dirBits | btn);
    this.plan.push(dirBits);
  }

  combo(p) {
    const F = FIGHTERS[p.ch];
    const fwd = this.dirs(p, true);
    for (const tok of F.str) {
      const btn = tok.endsWith("P") ? IN.P : IN.K;
      const d = tok[0] === "F" ? fwd : tok[0] === "D" ? IN.DOWN : 0;
      this.press(d, btn, 2);
      for (let i = 0; i < 6; i++) this.plan.push(d);
    }
  }

  think(s) {
    // see the world as it was a few frames ago
    this.history.push(JSON.stringify({ p: s.p.map((q) => ({ x: q.x, y: q.y, st: q.st, mv: q.mv, sf: q.sf, face: q.face, meter: q.meter, ch: q.ch, hp: q.hp, cd: q.cd })), pr: s.pr.map((q) => ({ o: q.o, x: q.x, vx: q.vx, y: q.y })) }));
    if (this.history.length > this.react) this.history.shift();
    const view = JSON.parse(this.history[0]);
    const p = view.p[this.me], o = view.p[1 - this.me];
    const real = s.p[this.me];
    if (s.phase !== "fight" && s.phase !== "finish") { this.plan = []; return 0; }
    if (s.phase === "finish") {
      if (s.winner === this.me) return (s.f % 20 < 10) ? IN.X : 0;
      return 0;
    }
    if (this.plan.length) return this.plan.shift();
    if (this.cool > 0) { this.cool--; return this.hold; }

    const dist = Math.abs(o.x - p.x);
    const fwd = this.dirs(real, true), back = this.dirs(real, false);
    const r = this.rnd();
    const skill = [0.35, 0.65, 0.88][this.level];

    // incoming item: block it or jump it
    const threat = view.pr.find((q) => q.o !== this.me && Math.sign(q.vx || 0) === Math.sign(p.x - q.x) && Math.abs(q.x - p.x) < 2600);
    if (threat && r < skill) {
      if (this.rnd() < 0.5) { this.hold = IN.B; this.cool = 22; return IN.B; }
      this.plan.push(IN.UP | fwd, IN.UP | fwd, fwd); return IN.UP | fwd;
    }
    // she is attacking up close: block (crouch for lows)
    if (o.st === "attack" && dist < 1300 && r < skill * 0.9) {
      const m = MOVES[o.mv] || {};
      const low = m.level === "low";
      this.hold = IN.B | (low ? IN.DOWN : 0); this.cool = 14;
      return this.hold;
    }
    // the chair is ready
    if (real.meter >= CONST.METER_MAX && dist < 3200 && this.rnd() < 0.08 + this.level * 0.04) { this.press(0, IN.X, 2); return 0; }
    // far away: throw something or close in
    if (dist > 1800) {
      if (real.cd === 0 && this.rnd() < 0.03 + this.level * 0.015) { this.press(0, IN.S, 2); return 0; }
      if (this.rnd() < 0.02) { this.plan.push(IN.UP | fwd); for (let i = 0; i < 6; i++) this.plan.push(fwd); return IN.UP | fwd; }
      this.hold = fwd; this.cool = 6 + Math.floor(this.rnd() * 10); return fwd;
    }
    // mid range: step in, poke, signature move
    if (dist > 950) {
      const x = this.rnd();
      if (x < 0.05 + this.level * 0.03) { this.press(fwd, IN.S, 2); return 0; }
      if (x < 0.12) { this.press(fwd, IN.K, 2); return 0; }
      this.hold = fwd; this.cool = 4; return fwd;
    }
    // close: combos, throws, sweeps, back off
    const x = this.rnd();
    if (x < 0.22 + this.level * 0.12) { this.combo(real); return 0; }
    if (x < 0.32) { this.press(IN.B, IN.P, 2); return 0; }
    if (x < 0.42) { this.press(IN.DOWN, IN.K, 2); return 0; }
    if (x < 0.55) { this.press(IN.DOWN, IN.P, 2); return 0; }
    if (x < 0.68) { this.press(0, IN.P, 2); this.press(0, IN.P, 2); return 0; }
    if (x < 0.78) { this.hold = back; this.cool = 10; return back; }
    this.hold = IN.B; this.cool = 10; return IN.B;
  }
}
