// A 1v1 duel, run by the server (or by the page itself against a bot when
// there is no server). The server holds the answers until a round ends, so
// neither player can peek.
//
// Rules, after GeoGuessr Duels: both start with 6,000 health. Each round
// both guess; when the first player locks in, the other has 15 seconds
// left. The lower score loses the difference times the round's multiplier.
// First to 0 loses.

import { makeRounds, resolveRound, publicRound } from "./rounds.js";
import { roundScore, DUEL_HP, duelMultiplier } from "./scoring.js";

export const DUEL_TIMING = {
  introMs: 4200, // "Round 1" card and countdown before the first round
  roundMs: 75_000, // time to guess if nobody locks in
  lockMs: 15_000, // time left for the other player once someone locks in
  revealMs: 11_000, // how long the result stays up before the next round
  minRevealMs: 3500, // earliest the next round can start when both are ready
  maxRounds: 20,
};

const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
};

export class Duel {
  constructor({ id, players, map = "israel", measure = "time", seed, resolve, send, onEnd, clock = realClock, timing = {} }) {
    this.id = id;
    this.players = players; // [{ id, name, avatar, bot? }, ...]
    this.map = map;
    this.measure = measure;
    this.seed = seed;
    this.resolve = resolve;
    this.send = send; // (playerId, message)
    this.onEnd = onEnd || (() => {});
    this.clock = clock;
    this.t = { ...DUEL_TIMING, ...timing };
    this.specs = makeRounds({ seed, map, count: this.t.maxRounds });
    this.prepared = new Map();
    this.hp = Object.fromEntries(players.map((p) => [p.id, DUEL_HP]));
    this.n = 0;
    this.phase = "intro";
    this.guesses = {};
    this.ready = new Set();
    this.history = [];
    this.timer = null;
    this.deadline = 0;
    this.revealAt = 0;
    this.lastResult = null;
    this.winner = null;
  }

  other(id) {
    return this.players.find((p) => p.id !== id);
  }

  prepare(n) {
    if (n > this.t.maxRounds) return null;
    if (!this.prepared.has(n)) {
      const p = resolveRound(this.specs[n - 1], this.resolve);
      p.catch(() => {});
      this.prepared.set(n, p);
    }
    return this.prepared.get(n);
  }

  start() {
    this.prepare(1);
    this.prepare(2);
    for (const p of this.players) this.send(p.id, { t: "match", ...this.info(p.id) });
    this.schedule(() => this.startRound(1), this.t.introMs);
  }

  info(id) {
    const opp = this.other(id);
    return {
      matchId: this.id,
      map: this.map,
      measure: this.measure,
      you: this.players.find((p) => p.id === id),
      opponent: { id: opp.id, name: opp.name, avatar: opp.avatar, bot: !!opp.bot },
      hp: { you: this.hp[id], opp: this.hp[opp.id] },
      maxHp: DUEL_HP,
    };
  }

  schedule(fn, ms) {
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.deadline = this.clock.now() + ms;
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  async startRound(n) {
    if (this.phase === "over") return;
    let round;
    try {
      round = await this.prepare(n);
    } catch {
      round = null;
    }
    if (this.phase === "over") return;
    if (!round) return this.finish(null, "error");
    this.prepare(n + 1);
    this.n = n;
    this.round = round;
    this.phase = "guessing";
    this.guesses = {};
    this.ready = new Set();
    this.schedule(() => this.endRound(), this.t.roundMs);
    for (const p of this.players) {
      this.send(p.id, {
        t: "round",
        n,
        round: publicRound(round, n),
        multiplier: duelMultiplier(n),
        timeLeft: this.t.roundMs,
        hp: { you: this.hp[p.id], opp: this.hp[this.other(p.id).id] },
      });
    }
  }

  guess(playerId, n, value) {
    if (this.phase !== "guessing" || n !== this.n) return false;
    if (!this.hp.hasOwnProperty(playerId) || this.guesses.hasOwnProperty(playerId)) return false;
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0 || v > 100000) return false;
    this.guesses[playerId] = this.measure === "time" ? Math.round(v) : Math.round(v * 10) / 10;
    const opp = this.other(playerId);
    this.send(playerId, { t: "locked", n, value: this.guesses[playerId] });
    if (this.guesses.hasOwnProperty(opp.id)) {
      this.endRound();
      return true;
    }
    const left = Math.max(0, this.deadline - this.clock.now());
    const lock = Math.min(left, this.t.lockMs);
    this.schedule(() => this.endRound(), lock);
    this.send(opp.id, { t: "oppLocked", n, timeLeft: lock });
    this.send(playerId, { t: "deadline", n, timeLeft: lock });
    return true;
  }

  endRound() {
    if (this.phase !== "guessing") return;
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.phase = "reveal";
    const { route } = this.round;
    const actual = this.measure === "time" ? route.min : route.km;
    const [a, b] = this.players;
    const score = {};
    for (const p of this.players) score[p.id] = roundScore(this.guesses[p.id], actual, this.measure);
    const mult = duelMultiplier(this.n);
    let loser = null;
    let damage = 0;
    if (score[a.id] !== score[b.id]) {
      loser = score[a.id] < score[b.id] ? a.id : b.id;
      damage = Math.round(Math.abs(score[a.id] - score[b.id]) * mult);
      this.hp[loser] = Math.max(0, this.hp[loser] - damage);
    }
    const entry = { n: this.n, actual, guesses: { ...this.guesses }, score, loser, damage, multiplier: mult, from: this.round.from, to: this.round.to, mode: this.round.mode };
    this.history.push(entry);
    const over = this.hp[a.id] <= 0 || this.hp[b.id] <= 0 || this.n >= this.t.maxRounds;
    this.lastResult = entry;
    this.revealAt = this.clock.now();
    for (const p of this.players) this.send(p.id, this.resultFor(p.id, entry, over));
    if (over) {
      const winner = this.hp[a.id] === this.hp[b.id] ? null : this.hp[a.id] > this.hp[b.id] ? a.id : b.id;
      this.schedule(() => this.finish(winner, "hp"), this.t.revealMs);
    } else {
      this.schedule(() => this.startRound(this.n + 1), this.t.revealMs);
    }
  }

  resultFor(id, entry, over = false) {
    const opp = this.other(id).id;
    const { route } = this.round;
    return {
      t: "result",
      n: entry.n,
      actual: { value: entry.actual, min: route.min, km: route.km, geometry: route.geometry, source: route.source },
      guesses: { you: entry.guesses[id] ?? null, opp: entry.guesses[opp] ?? null },
      scores: { you: entry.score[id], opp: entry.score[opp] },
      damage: { to: entry.loser == null ? null : entry.loser === id ? "you" : "opp", amount: entry.damage },
      multiplier: entry.multiplier,
      hp: { you: this.hp[id], opp: this.hp[opp] },
      last: over,
      timeLeft: Math.max(0, this.deadline - this.clock.now()),
    };
  }

  // Both players pressed "Next": move on early (but give the reveal a moment).
  markReady(playerId, n) {
    if (this.phase !== "reveal" || n !== this.n) return;
    this.ready.add(playerId);
    const humans = this.players.filter((p) => !p.bot);
    if (humans.every((p) => this.ready.has(p.id))) {
      const wait = Math.max(0, this.revealAt + this.t.minRevealMs - this.clock.now());
      const last = this.history.at(-1);
      const over = Object.values(this.hp).some((h) => h <= 0) || this.n >= this.t.maxRounds;
      if (over) {
        const [a, b] = this.players;
        const winner = this.hp[a.id] === this.hp[b.id] ? null : this.hp[a.id] > this.hp[b.id] ? a.id : b.id;
        this.schedule(() => this.finish(winner, "hp"), wait);
      } else if (last) {
        this.schedule(() => this.startRound(this.n + 1), wait);
      }
    }
  }

  forfeit(playerId) {
    if (this.phase === "over") return;
    const opp = this.other(playerId);
    this.finish(opp ? opp.id : null, "forfeit", playerId);
  }

  finish(winner, reason, quitter = null) {
    if (this.phase === "over") return;
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.phase = "over";
    this.winner = winner;
    for (const p of this.players) {
      this.send(p.id, {
        t: "end",
        result: winner == null ? "draw" : winner === p.id ? "win" : "lose",
        reason,
        quitter: quitter == null ? null : quitter === p.id ? "you" : "opp",
        hp: { you: this.hp[p.id], opp: this.hp[this.other(p.id).id] },
        rounds: this.history.map((h) => ({
          n: h.n, mode: h.mode, actual: h.actual,
          from: { he: h.from.he, en: h.from.en }, to: { he: h.to.he, en: h.to.en },
          you: h.guesses[p.id] ?? null, opp: h.guesses[this.other(p.id).id] ?? null,
          scores: { you: h.score[p.id], opp: h.score[this.other(p.id).id] },
          damage: h.damage, loser: h.loser == null ? null : h.loser === p.id ? "you" : "opp",
        })),
      });
    }
    this.onEnd(this);
  }

  // Everything a reconnecting player needs to pick up where they were.
  snapshot(id) {
    const base = { t: "sync", ...this.info(id), phase: this.phase, n: this.n };
    if (this.phase === "guessing") {
      const opp = this.other(id).id;
      return {
        ...base,
        round: publicRound(this.round, this.n),
        multiplier: duelMultiplier(this.n),
        timeLeft: Math.max(0, this.deadline - this.clock.now()),
        myGuess: this.guesses[id] ?? null,
        oppLocked: this.guesses.hasOwnProperty(opp),
      };
    }
    if (this.phase === "reveal" && this.lastResult) {
      return { ...base, round: publicRound(this.round, this.n), result: this.resultFor(id, this.lastResult) };
    }
    return base;
  }

  // For the bot only.
  answer() {
    if (!this.round) return null;
    return this.measure === "time" ? this.round.route.min : this.round.route.km;
  }

  stop() {
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.phase = "over";
  }
}
