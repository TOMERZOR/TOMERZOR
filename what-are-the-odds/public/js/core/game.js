// "Higher or lower?": the game. Shared by the page (solo, two players on one phone)
// and the Worker's room (two players on two phones), so both play by the same rules.
//
// A card is a checked fact and a threshold. The player whose turn it is says whether
// the real odds are higher or lower than the threshold. Like Hitster's tokens, the
// other player may then challenge: if the guess was wrong, the challenger takes the
// point. Turns alternate; first to WIN_SCORE wins.

import { FACTS } from "./data.js";
import { describe } from "./format.js";

export const WIN_SCORE = 5;
export const TOKENS = 2;
export const SOLO_LIVES = 3;

// Small seeded random generator so a room's deck is the same for both players.
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffledIds(rand, facts = FACTS) {
  const ids = facts.map((f) => f.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

const PCT_STEPS = [0.01, 0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.98, 0.99];

function nearest(list, v) {
  let best = list[0];
  for (const x of list) if (Math.abs(Math.log(x) - Math.log(v)) < Math.abs(Math.log(best) - Math.log(v))) best = x;
  return best;
}

// 1 in N with N = 1, 2 or 5 × 10^k
function niceOneIn(t) {
  const n = 1 / t;
  const k = Math.floor(Math.log10(n));
  const options = [1, 2, 5, 10].map((m) => m * 10 ** k);
  return 1 / nearest(options, n);
}

function nice(t) {
  if (t >= 0.01) return nearest(PCT_STEPS, t);
  return niceOneIn(t);
}

// Far enough from the truth to be fair, close enough to make you think.
export function makeThreshold(p, rand) {
  if (p <= 0) return nice(10 ** -(2 + Math.floor(rand() * 5))); // 1% .. 1 in a million
  if (p >= 1) return [0.9, 0.95, 0.99][Math.floor(rand() * 3)];
  if (p >= 0.12) {
    // linear: 7 to 30 points away
    let dir = rand() < 0.5 ? -1 : 1;
    const delta = 0.07 + rand() * 0.23;
    if (p + dir * delta > 0.98) dir = -1;
    if (p + dir * delta < 0.01) dir = 1;
    let t = nice(Math.min(0.99, Math.max(0.01, p + dir * delta)));
    if (Math.abs(t - p) < 0.04) t = nice(Math.min(0.99, Math.max(0.01, p + dir * 0.12)));
    if (Math.abs(t - p) < 0.04) t = nice(Math.min(0.99, Math.max(0.01, p - dir * 0.15)));
    return t;
  }
  // astronomically small: compare against numbers people can picture
  if (p < 1e-10) {
    const options = [1e-6, 1e-9, 1e-12].filter((x) => Math.abs(Math.log10(x / p)) >= 0.5);
    return options[Math.floor(rand() * options.length)];
  }
  // log scale: 2.5x to 15x away
  const dir = rand() < 0.5 ? -1 : 1;
  const span = 0.4 + rand() * 0.8;
  let t = nice(Math.min(0.5, p * 10 ** (dir * span)));
  for (let i = 0; i < 6 && Math.abs(Math.log10(t / p)) < 0.3; i++) t = nice(t * 10 ** (dir * 0.3));
  return t;
}

export function isCorrect(p, t, dir) {
  return dir === "up" ? p > t : p < t;
}

export function thresholdLabel(t, lang = "he") {
  const d = describe(t, lang);
  if (d.main.kind === "oneIn") {
    const n = d.main.exp != null ? `${d.main.text}×10^${d.main.exp}` : d.main.text;
    return lang === "he" ? `1 מתוך ${n}` : `1 in ${n}`;
  }
  return d.main.text;
}

export function factFor(id) {
  return FACTS.find((f) => f.id === id) || null;
}

/**
 * A two-player match. Pure state: no timers, no I/O. The page drives it for
 * pass-and-play, the Worker's room drives it for online play.
 * phase: "guess" -> ("challenge") -> "reveal" -> next card ... -> "over"
 */
export class Match {
  constructor({ seed = Date.now() % 2147483647, names = ["", ""] } = {}) {
    this.seed = seed;
    this.players = names.map((name) => ({ name, score: 0, tokens: TOKENS }));
    this.start();
  }

  start() {
    this.rand = rng(this.seed);
    this.deck = shuffledIds(this.rand);
    this.index = -1;
    this.players.forEach((p) => { p.score = 0; p.tokens = TOKENS; });
    this.turn = Math.floor(this.rand() * 2);
    this.winner = null;
    this.round = 0;
    this.dealNext(false);
  }

  dealNext(switchTurn = true) {
    if (switchTurn) this.turn = 1 - this.turn;
    this.index = (this.index + 1) % this.deck.length;
    const id = this.deck[this.index];
    this.card = { id, t: makeThreshold(factFor(id).p, this.rand) };
    this.phase = "guess";
    this.guess = null;
    this.challenged = false;
    this.result = null;
    this.round++;
  }

  guessed(dir) {
    if (this.phase !== "guess" || (dir !== "up" && dir !== "down")) return false;
    this.guess = dir;
    const other = this.players[1 - this.turn];
    if (other.tokens > 0) this.phase = "challenge";
    else this.reveal();
    return true;
  }

  challenge(yes) {
    if (this.phase !== "challenge") return false;
    if (yes) {
      this.challenged = true;
      this.players[1 - this.turn].tokens--;
    }
    this.reveal();
    return true;
  }

  reveal() {
    const p = factFor(this.card.id).p;
    const correct = isCorrect(p, this.card.t, this.guess);
    let scorer = null;
    if (correct) scorer = this.turn;
    else if (this.challenged) scorer = 1 - this.turn;
    if (scorer != null) this.players[scorer].score++;
    this.result = { correct, scorer, p };
    this.phase = "reveal";
    if (scorer != null && this.players[scorer].score >= WIN_SCORE) {
      this.winner = scorer;
      this.phase = "over";
    }
  }

  next() {
    if (this.phase !== "reveal") return false;
    this.dealNext(true);
    return true;
  }

  rematch() {
    this.seed = (this.seed * 48271) % 2147483647 || 7;
    this.start();
  }

  // What the page needs to draw.
  view() {
    return {
      phase: this.phase,
      turn: this.turn,
      round: this.round,
      card: this.card,
      guess: this.guess,
      challenged: this.challenged,
      result: this.result,
      winner: this.winner,
      players: this.players.map((p) => ({ ...p })),
    };
  }
}
