import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FACTS } from "../public/js/core/data.js";
import { QUESTION_POOL } from "../public/js/core/questions.js";
import { Match, makeThreshold, isCorrect, rng, thresholdLabel, orderedDeck, WIN_SCORE, TOKENS } from "../public/js/core/game.js";
import { newCode } from "../worker/worker.js";

test("the random pool has at least 360 questions in both languages, no repeats", () => {
  assert.ok(QUESTION_POOL.length >= 360);
  assert.equal(new Set(QUESTION_POOL.map((q) => q.he)).size, QUESTION_POOL.length);
  assert.equal(new Set(QUESTION_POOL.map((q) => q.en)).size, QUESTION_POOL.length);
  assert.ok(QUESTION_POOL.every((q) => q.he && q.en));
});

test("thresholds are never the answer and always readable", () => {
  const r = rng(1);
  for (const f of FACTS) {
    for (let i = 0; i < 40; i++) {
      const t = makeThreshold(f.p, r);
      assert.ok(t > 0 && t < 1, `${f.id}: ${t}`);
      assert.notEqual(t, f.p);
      const label = thresholdLabel(t, "en");
      assert.ok(!/×10\^/.test(label), `${f.id}: unreadable threshold ${label}`);
      if (f.p >= 0.12 && f.p < 1) assert.ok(Math.abs(t - f.p) >= 0.04, `${f.id}: ${t} too close to ${f.p}`);
      else if (f.p > 0 && f.p < 0.12) assert.ok(Math.abs(Math.log10(t / f.p)) >= 0.3, `${f.id}: ${t} too close to ${f.p}`);
    }
  }
});

test("a match: turns alternate, challenges steal points, first to 5 wins", () => {
  const m = new Match({ seed: 3, names: ["Noa", "Dan"] });
  const first = m.turn;
  const p = () => FACTS.find((f) => f.id === m.card.id).p;
  // a right guess scores for the player on turn
  const right = isCorrect(p(), m.card.t, "up") ? "up" : "down";
  m.guessed(right);
  assert.equal(m.phase, "challenge");
  m.challenge(true);
  assert.equal(m.players[first].score, 1);
  assert.equal(m.players[1 - first].tokens, TOKENS - 1);
  m.next();
  assert.equal(m.turn, 1 - first);
  // a wrong guess that's challenged gives the point to the challenger
  const wrong = isCorrect(p(), m.card.t, "up") ? "down" : "up";
  m.guessed(wrong);
  m.challenge(true);
  assert.equal(m.players[first].score, 2);
  m.next();
  // play it out
  let guard = 0;
  while (m.phase !== "over" && guard++ < 500) {
    const ok = isCorrect(p(), m.card.t, "up") ? "up" : "down";
    m.guessed(ok);
    if (m.phase === "challenge") m.challenge(false);
    if (m.phase === "reveal") m.next();
  }
  assert.equal(m.phase, "over");
  assert.equal(m.players[m.winner].score, WIN_SCORE);
  m.rematch();
  assert.equal(m.phase, "guess");
  assert.deepEqual(m.players.map((x) => x.score), [0, 0]);
});

test("room codes", () => {
  for (let i = 0; i < 50; i++) assert.match(newCode(), /^[A-HJ-NP-Z]{4}$/);
});

test("no em or en dashes in anything people read", () => {
  for (const file of ["public/js/core/data.js", "public/js/core/questions.js", "public/js/i18n.js", "public/index.html"]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(!/[–—]/.test(text), `${file} has a long dash`);
  }
});

test("a player never gets a card they've seen until every card has been played", () => {
  const all = FACTS.map((f) => f.id);
  const seen = all.slice(0, 100);
  const deck = orderedDeck(rng(5), seen);
  assert.equal(deck.length, all.length);
  assert.equal(new Set(deck).size, all.length);
  const firstFresh = deck.slice(0, all.length - seen.length);
  assert.ok(firstFresh.every((id) => !seen.includes(id)), "unseen cards come first");
  assert.deepEqual(deck.slice(all.length - seen.length), seen, "then seen ones, oldest first");
});

test("a match deals unseen cards, and a rematch doesn't repeat the cards just played", () => {
  const seen = FACTS.slice(0, 40).map((f) => f.id);
  const m = new Match({ seed: 9, names: ["a", "b"], seen });
  const dealt = [];
  for (let i = 0; i < 30; i++) {
    dealt.push(m.card.id);
    m.guessed("up");
    if (m.phase === "challenge") m.challenge(false);
    if (m.phase === "over") break;
    m.next();
  }
  assert.ok(dealt.every((id) => !seen.includes(id)), "no previously seen card");
  assert.equal(new Set(dealt).size, dealt.length, "no repeats within a match");
  m.rematch();
  assert.ok(!dealt.includes(m.card.id) && !seen.includes(m.card.id), "rematch starts with a fresh card");
});
