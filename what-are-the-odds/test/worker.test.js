import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { cleanAnswer, parseModelOutput } from "../worker/worker.js";

function post(body, ip = "1.1.1.1") {
  return new Request("https://odds.test/api/odds", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

function fakeAI(reply, calls = []) {
  return {
    async run(model, input) {
      calls.push({ model, input });
      return typeof reply === "function" ? reply(model, input) : reply;
    },
  };
}

test("health", async () => {
  const res = await worker.fetch(new Request("https://odds.test/api/health"), { AI: fakeAI({}) });
  const body = await res.json();
  assert.equal(body.service, "what-are-the-odds");
  assert.equal(body.ai, true);
});

test("checked facts never reach the AI", async () => {
  const calls = [];
  const res = await worker.fetch(post({ q: "להיוולד בן", lang: "he" }), { AI: fakeAI({}, calls) });
  const body = await res.json();
  assert.equal(body.kind, "fact");
  assert.equal(body.id, "boy");
  assert.equal(calls.length, 0);
});

test("other questions get an AI estimate, cached", async () => {
  const calls = [];
  const env = { AI: fakeAI({ response: { answerable: true, probability: 0.003, explanation: "בתל אביב ירד שלג ב־1950.", basis: "השירות המטאורולוגי", timeframe: "בשנה", confidence: "low" } }, calls) };
  const a = await (await worker.fetch(post({ q: "שיירד שלג בתל אביב השנה", lang: "he" }, "2.2.2.2"), env)).json();
  assert.equal(a.kind, "ai");
  assert.equal(a.p, 0.003);
  assert.equal(a.confidence, "low");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  assert.match(calls[0].input.messages[1].content, /^מה הסיכוי /);
  const b = await (await worker.fetch(post({ q: "שיירד שלג בתל אביב השנה", lang: "he" }, "2.2.2.2"), env)).json();
  assert.equal(b.cached, true);
  assert.equal(calls.length, 1);
});

test("falls back to the second model, then plain text", async () => {
  const calls = [];
  const env = {
    AI: fakeAI((model, input) => {
      if (model.includes("70b")) throw new Error("capacity");
      if (input.response_format) throw new Error("no json mode");
      return { response: 'Sure! {"answerable": true, "probability": "1 in 2,000", "explanation": "Rare.", "basis": "estimate", "confidence": "medium"}' };
    }, calls),
  };
  const body = await (await worker.fetch(post({ q: "that my flight is delayed by exactly 7 minutes", lang: "en" }, "3.3.3.3"), env)).json();
  assert.equal(body.kind, "ai");
  assert.equal(body.p, 1 / 2000);
  assert.ok(calls.length >= 3);
});

test("unknowable questions", async () => {
  const env = { AI: fakeAI({ response: { answerable: false, probability: null, explanation: "Depends on her.", basis: "", confidence: "low" } }) };
  const body = await (await worker.fetch(post({ q: "that she likes me back", lang: "en" }, "4.4.4.4"), env)).json();
  assert.equal(body.kind, "unknown");
  assert.equal(body.p, null);
});

test("self-harm gets care without calling the AI", async () => {
  const calls = [];
  const body = await (await worker.fetch(post({ q: "שאני אתאבד", lang: "he" }), { AI: fakeAI({}, calls) })).json();
  assert.equal(body.kind, "care");
  assert.equal(calls.length, 0);
});

test("rate limit", async () => {
  const env = { AI: fakeAI({ response: { answerable: true, probability: 0.5, explanation: "x", basis: "y", confidence: "low" } }) };
  let last;
  for (let i = 0; i < 12; i++) last = await (await worker.fetch(post({ q: `random question number ${i} about weather`, lang: "en" }, "9.9.9.9"), env)).json();
  assert.equal(last.kind, "none");
  assert.equal(last.reason, "rate");
});

test("bad input", async () => {
  assert.equal((await worker.fetch(post({ q: "" }), {})).status, 400);
  assert.equal((await worker.fetch(post({ q: "x".repeat(201) }), {})).status, 400);
  assert.equal((await worker.fetch(new Request("https://odds.test/api/odds"), {})).status, 405);
});

test("JSON that isn't an object is a 400, not a crash", async () => {
  for (const body of [null, [], "x", 5]) {
    assert.equal((await worker.fetch(post(body), {})).status, 400);
  }
});

test("the longest question the page sends (140 typed + the English opener) is accepted", async () => {
  const q = `What are the odds that ${"a".repeat(140)}`;
  const res = await worker.fetch(post({ q, lang: "en" }), {});
  assert.equal(res.status, 200);
});

test("no AI binding", async () => {
  const body = await (await worker.fetch(post({ q: "that it rains in Eilat tomorrow", lang: "en" }), {})).json();
  assert.equal(body.kind, "none");
  assert.equal(body.reason, "no-ai");
});

test("model output cleaning", () => {
  assert.equal(cleanAnswer({ answerable: true, probability: 7, explanation: "x" }).p, 1);
  assert.equal(cleanAnswer({ answerable: true, probability: "25%", explanation: "x" }).p, 0.25);
  assert.equal(cleanAnswer({ answerable: true, probability: 0.1 }), null);
  assert.equal(cleanAnswer({ answerable: true, probability: 0.1, explanation: "x", confidence: "huge" }).confidence, "low");
  assert.deepEqual(parseModelOutput({ response: '```json\n{"a":1}\n```' }), { a: 1 });
});
