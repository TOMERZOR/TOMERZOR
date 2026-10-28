// Rollback netcode (GGPO style) for two players over any transport.
// Each side runs the fight right away with a guess for the other player's
// input (her last known one). When her real input for a past frame arrives and
// differs from the guess, the fight is rewound to that frame and replayed with
// the real input, in the same tick, before anything is drawn.

import { createState, cloneState, step, checksum } from "./sim.js";

const DELAY = 2;          // local input delay in frames (hides small latency)
const MAX_AHEAD = 12;     // never run more than this many frames past the last confirmed remote input
const KEEP = 180;         // frames of history kept
const SEND_BACK = 40;     // how many unacknowledged inputs ride on each packet

export class Rollback {
  constructor({ me, ch0, ch1, send, delay = DELAY }) {
    this.me = me;                 // 0 = host (left), 1 = guest (right)
    this.them = 1 - me;
    this.send = send;
    this.delay = delay;
    this.state = createState(ch0, ch1);
    this.states = new Map([[0, cloneState(this.state)]]);
    this.local = new Map();       // frame -> my input
    this.remote = new Map();      // frame -> her confirmed input
    this.used = new Map();        // frame -> the remote input the sim used
    for (let f = 1; f <= delay; f++) { this.local.set(f, 0); this.remote.set(f, 0); }
    this.confirmed = delay;       // every remote input up to here is known
    this.ackedByThem = 0;         // she has all my inputs up to here
    this.remoteFrame = 0;         // her latest reported frame
    this.remoteAdv = 0;
    this.advHist = [];
    this.wait = 0;                // frames to hold back for time sync
    this.rollbackFrom = Infinity;
    this.stalls = 0;
    this.rollbacks = 0;
    this.maxRolled = 0;
    this.desyncs = 0;
    this.checks = new Map();      // frame -> my checksum
    this.pendingRemoteChecks = new Map();
    this.nextCheck = 60;
    this.onEvents = null;         // (events, frame) for every newly simulated frame
  }

  get frame() { return this.state.f; }

  // Called from the transport for every packet she sends.
  receive(msg) {
    if (msg.t === "i") {
      const start = msg.s;
      for (let k = 0; k < msg.d.length; k++) {
        const f = start + k;
        if (f <= this.confirmed || this.remote.has(f)) continue;
        this.remote.set(f, msg.d[k]);
      }
      // advance the confirmed edge over contiguous frames
      while (this.remote.has(this.confirmed + 1)) {
        const f = this.confirmed + 1;
        this.confirmed = f;
        if (this.used.has(f) && this.used.get(f) !== this.remote.get(f)) {
          this.rollbackFrom = Math.min(this.rollbackFrom, f);
        }
      }
      if (msg.a > this.ackedByThem) this.ackedByThem = msg.a;
      if (msg.f > this.remoteFrame) { this.remoteFrame = msg.f; this.remoteAdv = msg.v | 0; }
    } else if (msg.t === "c") {
      this.pendingRemoteChecks.set(msg.f, msg.h >>> 0);
      this.compareChecks();
    } else if (msg.t === "sync" && this.me === 1) {
      // the host's copy of a confirmed frame wins; replay from it
      const f = msg.f;
      if (f <= this.frame && this.states.has(f)) {
        this.states.set(f, cloneState(msg.state));
        this.rollbackFrom = Math.min(this.rollbackFrom, f + 1);
        if (f === this.frame) this.state = cloneState(msg.state);
      }
    }
  }

  compareChecks() {
    for (const [f, h] of this.pendingRemoteChecks) {
      if (!this.checks.has(f)) { if (f < this.frame - KEEP) this.pendingRemoteChecks.delete(f); continue; }
      this.pendingRemoteChecks.delete(f);
      if (this.checks.get(f) !== h) {
        this.desyncs += 1;
        if (this.me === 0 && this.states.has(f)) {
          this.send({ t: "sync", f, state: this.states.get(f) }, true);
        }
      }
    }
  }

  remoteInputFor(f) {
    if (this.remote.has(f)) return this.remote.get(f);
    // guess: she is still holding what she held last
    return this.remote.get(this.confirmed) || 0;
  }

  simulate(f) {
    // f is the frame being produced (state.f goes f-1 -> f)
    const mine = this.local.get(f) || 0;
    const hers = this.remoteInputFor(f);
    this.used.set(f, hers);
    const in0 = this.me === 0 ? mine : hers;
    const in1 = this.me === 0 ? hers : mine;
    step(this.state, in0, in1);
    this.states.set(f, cloneState(this.state));
    return this.state.ev;
  }

  // One tick of the game clock. localInput is my controller right now.
  tick(localInput) {
    // 1. rewind and replay if a guess was wrong
    if (this.rollbackFrom !== Infinity) {
      const from = this.rollbackFrom;
      this.rollbackFrom = Infinity;
      if (from <= this.frame && this.states.has(from - 1)) {
        const to = this.frame;
        this.state = cloneState(this.states.get(from - 1));
        for (let f = from; f <= to; f++) {
          const ev = this.simulate(f);
          if (this.onEvents) this.onEvents(ev, f, true);
        }
        this.rollbacks += 1;
        this.maxRolled = Math.max(this.maxRolled, to - from + 1);
      }
    }

    // 2. time sync: if I am running ahead of her, give her a frame to catch up
    let advance = true;
    const next = this.frame + 1;
    if (next - this.confirmed > MAX_AHEAD) { advance = false; this.stalls += 1; }
    if (advance && this.wait > 0 && this.frame % 3 === 0) { this.wait -= 1; advance = false; }

    if (advance) {
      this.local.set(next + this.delay, localInput | 0);
      const ev = this.simulate(next);
      if (this.onEvents) this.onEvents(ev, next, false);
      const f = next;
      if (f % 30 === 0) this.syncTime();
    }

    // 3. checksums of confirmed frames
    while (this.nextCheck <= Math.min(this.confirmed, this.frame)) {
      const cf = this.nextCheck;
      this.nextCheck += 60;
      if (!this.states.has(cf)) continue;
      const h = checksum(this.states.get(cf));
      this.checks.set(cf, h);
      this.send({ t: "c", f: cf, h });
      this.compareChecks();
    }

    // 4. send my inputs she has not acknowledged yet
    this.sendInputs();
    this.prune();
  }

  sendInputs() {
    const last = this.frame + this.delay;
    const start = Math.max(this.ackedByThem + 1, last - SEND_BACK + 1, 1);
    const d = [];
    for (let f = start; f <= last; f++) d.push(this.local.has(f) ? this.local.get(f) : 0);
    const adv = this.frame - this.remoteFrame;
    this.send({ t: "i", s: start, d, a: this.confirmed, f: this.frame, v: adv });
  }

  syncTime() {
    const localAdv = this.frame - this.remoteFrame;
    this.advHist.push(localAdv - this.remoteAdv);
    if (this.advHist.length > 10) this.advHist.shift();
    const avg = this.advHist.reduce((a, b) => a + b, 0) / this.advHist.length;
    const want = Math.floor(avg / 2);
    if (want >= 1 && this.wait === 0) this.wait = Math.min(want, 6);
  }

  prune() {
    const cut = Math.min(this.frame, this.confirmed) - KEEP;
    if (cut <= 0) return;
    for (const m of [this.states, this.local, this.remote, this.used, this.checks]) {
      for (const k of m.keys()) if (k < cut) m.delete(k);
    }
  }
}
