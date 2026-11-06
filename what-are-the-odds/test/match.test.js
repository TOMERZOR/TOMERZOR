import { test } from "node:test";
import assert from "node:assert/strict";
import { FACTS, CATEGORIES } from "../public/js/core/data.js";
import { QUESTION_POOL } from "../public/js/core/questions.js";
import { findFact, needsCare, normalize } from "../public/js/core/match.js";
import { describe, compare, bigNumber } from "../public/js/core/format.js";

const expect = {
  "להיוולד בן": "boy",
  "מה הסיכוי להיוולד בלי אוזניים": "no-ears",
  "שהשמש תתפוצץ מחר": "sun-explode",
  "מה הסיכוי שהשמש תתפוצץ מחר?": "sun-explode",
  "שיפגע בי ברק השנה": "lightning-year",
  "לזכות בלוטו": "lotto-israel",
  "ללדת תאומים": "twins",
  "ללדת תאומים זהים": "identical-twins",
  "להיות ג'ינג'י": "red-hair",
  "שהמטבע ייפול על הצד": "coin-edge",
  "שאני אהיה מיליארדר": "billionaire",
  "למות בהתרסקות מטוס": "plane-crash",
  "What are the odds of being born a boy?": "boy",
  "that the sun explodes tomorrow": "sun-explode",
  "of being born without ears": "no-ears",
  "of dying in a plane crash": "plane-crash",
  "to win the lottery": "lotto-israel",
  "a cat lands on its feet": "cat-feet",
  "two people share a birthday in a class of 23": "birthday-23",
  "of rolling double six": "double-six",
  "of rolling a six": "dice-six",
};

for (const [q, id] of Object.entries(expect)) {
  test(`matches: ${q}`, () => {
    const r = findFact(q);
    assert.equal(r.fact && r.fact.id, id);
  });
}

for (const q of ["שהחברה שלי תעזוב אותי", "that my flight is delayed", "שיירד שלג בתל אביב", "that I die tomorrow", "שמכבי תזכה באליפות"]) {
  test(`goes to the AI: ${q}`, () => {
    assert.equal(findFact(q).fact, null);
  });
}

test("every fact answers its own question, in both languages, with and without the opener", () => {
  for (const f of FACTS) {
    for (const q of [f.he.q, `מה הסיכוי ש${f.he.q}`, `מה הסיכויים ש${f.he.q}`, f.en.q, `What are the odds that ${f.en.q}`]) {
      const r = findFact(q);
      assert.equal(r.fact && r.fact.id, f.id, `${f.id}: "${q}" matched ${r.fact && r.fact.id}`);
    }
  }
});

test("open questions in the random pool never borrow a checked fact's answer", () => {
  for (const x of QUESTION_POOL.filter((p) => !p.id)) {
    for (const q of [`מה הסיכוי ש${x.he}`, `מה הסיכויים ש${x.he}`, `What are the odds that ${x.en}`]) {
      const r = findFact(q);
      assert.equal(r.fact, null, `"${q}" matched ${r.fact && r.fact.id}`);
    }
  }
});

test("facts are well formed", () => {
  const ids = new Set();
  const cats = new Set(CATEGORIES.map((c) => c.id));
  for (const f of FACTS) {
    assert.ok(!ids.has(f.id), `duplicate id ${f.id}`);
    ids.add(f.id);
    assert.ok(cats.has(f.cat), `${f.id} has unknown category`);
    assert.ok(f.p >= 0 && f.p <= 1, `${f.id} probability out of range`);
    assert.ok(f.he.q && f.he.x && f.en.q && f.en.x && f.src, `${f.id} is missing text`);
    assert.ok(Array.isArray(f.k) && f.k.length && f.k.every((g) => g.length), `${f.id} has no keywords`);
  }
});

test("self-harm questions get care, not a number", () => {
  assert.ok(needsCare("שאני אתאבד"));
  assert.ok(needsCare("that I kill myself"));
  assert.ok(needsCare("מה הסיכוי שאני ארצה למות"));
  assert.ok(!needsCare("of dying in a plane crash"));
  assert.ok(!needsCare("למות בהתרסקות מטוס"));
});

test("normalize handles final letters, quotes and niqqud", () => {
  assert.equal(normalize("ג'ינג'י"), "גינגי");
  assert.equal(normalize("אוזניים"), normalize("אוזניים"));
  assert.equal(normalize("בֵּן"), "בנ");
});

test("numbers read naturally", () => {
  assert.equal(describe(0.512, "he").main.text, "51%");
  assert.equal(describe(0, "en").main.kind, "zero");
  assert.equal(describe(1 / 16273488, "en").main.text, "16.3 million");
  assert.equal(describe(1 / 16273488, "he").main.text, "16.3 מיליון");
  assert.equal(describe(1 / 7500, "en").main.text, "7,500");
  assert.equal(describe(1 / 649740, "en").main.text, "649,740");
  assert.deepEqual(bigNumber(8.07e67, "en"), { text: "8.1", exp: 67 });
  assert.match(compare(1 / 7500, "en"), /four-leaf clover/);
  assert.equal(compare(0, "he"), "");
});
