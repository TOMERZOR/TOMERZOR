// End-to-end tests of the worker against a fake Claude API (local HTTP server).
// No network or API key needed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import worker, { cleanProfile, cleanCourse } from "../src/index.js";
import { SYSTEM_PROMPT } from "../src/prompt.js";

let reply = null; // what the fake Claude answers next
const seen = []; // request bodies it received
let server, baseURL;

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ path: req.url, headers: req.headers, body: JSON.parse(raw || "{}") });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(reply));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function message(obj, stopReason = "end_turn") {
  return {
    id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5",
    content: obj === null ? [] : [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }],
    stop_reason: stopReason, stop_sequence: null,
    usage: { input_tokens: 40, output_tokens: 300, cache_read_input_tokens: 1800 },
  };
}

const LESSON = {
  title: "שברים", subtitle: "חלק מתוך שלם",
  bites: [
    { title: "מה זה שבר", text: "**שבר** הוא חלק.\nכמו פיצה.", simpler: "חתיכה מהשלם.", example: "משולש פיצה.", check: { question: "", options: [], answer: 0, why: "" } },
    { title: "מונה ומכנה", text: "למטה המכנה.\nלמעלה המונה.", simpler: "למטה: כמה חתכו.", example: "[[3/4]]", check: { question: "מה המכנה ב-[[2/5]]?", options: ["5", "2"], answer: 0, why: "המכנה למטה." } },
  ],
  terms: [{ word: "שבר", meaning: "חלק משלם." }],
  summary: ["שבר הוא חלק משלם."],
};

const PROFILE = { age: 12, grade: "ו׳", gender: "f", laziness: 4, focus_minutes: 10, max_sentences: 2, styles: ["דוגמאות מהחיים"], needs: ["adhd"], interests: ["כדורגל"], tone: "friend", name: "נועה" };

function env(extra = {}) {
  return { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: baseURL, ALLOWED_ORIGINS: "https://tomerzor.github.io", ...extra };
}

function post(path, body, { origin = "https://tomerzor.github.io", type = "application/json" } = {}) {
  return new Request(`https://api.test${path}`, {
    method: "POST",
    headers: { "content-type": type, origin },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(k) { return this.map.has(k) ? this.map.get(k) : null; }
  async put(k, v) { this.map.set(k, v); }
}

test("the system prompt has no em dashes", () => {
  assert.ok(!SYSTEM_PROMPT.includes("—"));
  assert.ok(SYSTEM_PROMPT.length > 2000);
});

test("health reports what is configured", async () => {
  const res = await worker.fetch(new Request("https://api.test/api/health", { headers: { origin: "https://tomerzor.github.io" } }), env({ DAILY_LESSONS: "15" }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ai, true);
  assert.equal(data.daily_lessons, 15);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://tomerzor.github.io");
});

test("a lesson is written with structured output, caching and the refusal fallback", async () => {
  reply = message(LESSON);
  seen.length = 0;
  const res = await worker.fetch(post("/api/lesson", { profile: PROFILE, subject: "מתמטיקה", topic: "שברים", when: "tomorrow" }), env());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.lesson.bites.length, 2);
  const sent = seen[0];
  assert.equal(sent.body.model, "claude-opus-5-5");
  assert.equal(sent.body.fallbacks, "default");
  assert.match(sent.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
  assert.equal(sent.body.output_config.format.type, "json_schema");
  assert.equal(sent.body.output_config.effort, "medium");
  assert.equal(sent.body.system[0].cache_control.type, "ephemeral");
  const user = sent.body.messages[0].content;
  assert.match(user, /<topic>שברים<\/topic>/);
  assert.match(user, /<test_is>tomorrow<\/test_is>/);
  assert.match(user, /<goal>exam<\/goal>/);
  assert.match(user, /<lesson_request>/);
  assert.match(user, /feminine/);
  assert.ok(!user.includes("נועה"), "the learner's name never reaches the API");
});

test("several pages are sent as image blocks, in order", async () => {
  reply = message(PLAN);
  seen.length = 0;
  const pages = ["cGFnZTE=", "cGFnZTI=", "cGFnZTM="].map((data) => ({ media_type: "image/jpeg", data }));
  const res = await worker.fetch(post("/api/plan", { profile: PROFILE, images: pages }), env());
  assert.equal(res.status, 200);
  const content = seen[0].body.messages[0].content;
  assert.deepEqual(content.slice(0, 3).map((b) => b.source.data), ["cGFnZTE=", "cGFnZTI=", "cGFnZTM="]);
  assert.match(content[3].text, /the 3 images \(pages, in order\) above are the learner's study material/);
});

test("a PDF goes first, as a document block, next to photos", async () => {
  reply = message(PLAN);
  seen.length = 0;
  const pdf = { data: "JVBERi0xLjQKJcfsj6IK" };
  const res = await worker.fetch(post("/api/plan", { profile: PROFILE, topic: "פרק 3", pdf, images: [{ media_type: "image/png", data: "iVBORw0K" }] }), env());
  assert.equal(res.status, 200);
  const content = seen[0].body.messages[0].content;
  assert.equal(content[0].type, "document");
  assert.equal(content[0].source.media_type, "application/pdf");
  assert.equal(content[1].type, "image");
  assert.match(content[2].text, /the PDF document and the image above are the learner's study material/);
});

test("a file that is not a PDF, or a huge one, is refused", async () => {
  seen.length = 0;
  const bad = await worker.fetch(post("/api/plan", { pdf: { data: "aGVsbG8=" } }), env());
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, "bad_pdf");
  const big = await worker.fetch(post("/api/plan", { pdf: { data: "JVBER" + "A".repeat(14_000_000) } }), env());
  assert.equal(big.status, 413);
  assert.equal(seen.length, 0);
});

test("more than four pages are refused", async () => {
  const pages = Array.from({ length: 5 }, () => ({ media_type: "image/jpeg", data: "AAAA" }));
  const res = await worker.fetch(post("/api/plan", { images: pages }), env());
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "too_many_images");
});

test("a photo of the material is sent as an image block", async () => {
  reply = message(LESSON);
  seen.length = 0;
  const res = await worker.fetch(post("/api/lesson", { profile: PROFILE, image: { media_type: "image/jpeg", data: "aGVsbG8=" } }), env());
  assert.equal(res.status, 200);
  const content = seen[0].body.messages[0].content;
  assert.equal(content[0].type, "image");
  assert.equal(content[0].source.media_type, "image/jpeg");
  assert.equal(content[1].type, "text");
});

test("lesson input is checked before calling Claude", async () => {
  seen.length = 0;
  assert.equal((await worker.fetch(post("/api/lesson", { profile: PROFILE }), env())).status, 400);
  assert.equal((await worker.fetch(post("/api/lesson", { topic: "x", material: "א".repeat(13000) }), env())).status, 413);
  assert.equal((await worker.fetch(post("/api/lesson", { image: { media_type: "image/svg+xml", data: "AAAA" } }), env())).status, 400);
  assert.equal((await worker.fetch(post("/api/lesson", "topic=x", { type: "text/plain" }), env())).status, 415);
  assert.equal(seen.length, 0);
});

test("help returns an explanation and passes what was already said", async () => {
  reply = message({ text: "שבר זה כמו חתיכת פיצה.", example: "" });
  seen.length = 0;
  const res = await worker.fetch(post("/api/help", { profile: PROFILE, lesson: { title: "שברים", subject: "מתמטיקה" }, bite: { title: "מה זה שבר", text: "שבר הוא חלק." }, kind: "again", previous: ["חתיכה מהשלם."] }), env());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: "שבר זה כמו חתיכת פיצה.", example: "" });
  const user = seen[0].body.messages[0].content;
  assert.match(user, /<kind>again<\/kind>/);
  assert.match(user, /<previous>\n- חתיכה מהשלם\.\n<\/previous>/);
  assert.equal(seen[0].body.output_config.effort, "low");
});

test("help needs a word or a question when the kind asks for one", async () => {
  const base = { profile: PROFILE, lesson: { title: "x" }, bite: { title: "t", text: "טקסט" } };
  assert.equal((await worker.fetch(post("/api/help", { ...base, kind: "word" }), env())).status, 400);
  assert.equal((await worker.fetch(post("/api/help", { ...base, kind: "answer" }), env())).status, 400);
  assert.equal((await worker.fetch(post("/api/help", { ...base, kind: "hack" }), env())).status, 400);
});

test("a refusal becomes a 422 the app can show kindly", async () => {
  reply = message(null, "refusal");
  const res = await worker.fetch(post("/api/lesson", { topic: "x" }), env());
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, "refused");
});

test("a cut-off answer is not passed on as a lesson", async () => {
  reply = message('{"title":"x","bites":[', "max_tokens");
  const res = await worker.fetch(post("/api/lesson", { topic: "x" }), env());
  assert.equal(res.status, 502);
});

test("other sites are refused", async () => {
  const res = await worker.fetch(post("/api/lesson", { topic: "x" }, { origin: "https://evil.example" }), env());
  assert.equal(res.status, 403);
});

test("the daily lesson limit is enforced per visitor", async () => {
  reply = message(LESSON);
  const kv = new MemoryKV();
  const e = env({ E2S_KV: kv, DAILY_LESSONS: "2" });
  assert.equal((await worker.fetch(post("/api/lesson", { topic: "x" }), e)).status, 200);
  assert.equal((await worker.fetch(post("/api/lesson", { topic: "x" }), e)).status, 200);
  const third = await worker.fetch(post("/api/lesson", { topic: "x" }), e);
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error, "daily_limit");
});

test("without a key the API says it is not configured", async () => {
  const res = await worker.fetch(post("/api/lesson", { topic: "x" }), { ALLOWED_ORIGINS: "*" });
  assert.equal(res.status, 503);
});

test("the profile is reduced to known fields", () => {
  const p = cleanProfile({ ...PROFILE, age: "12; drop table", laziness: 9, tone: "evil", extra: "x" });
  assert.equal(p.age, null);
  assert.equal(p.laziness, 3);
  assert.equal(p.tone, "friend");
  assert.equal(p.gender, "feminine");
  assert.ok(!("name" in p) && !("extra" in p));
});

const PLAN = { title: "חורים שחורים", subtitle: "מכוכב ועד חור שחור", chapters: [{ title: "מה זה כוח משיכה", goal: "להבין למה דברים נופלים." }, { title: "איך כוכב מת", goal: "להבין מה קורה בסוף חייו של כוכב." }], notes: "" };

test("a path is planned at low effort from a topic", async () => {
  reply = message(PLAN);
  seen.length = 0;
  const res = await worker.fetch(post("/api/plan", { profile: PROFILE, topic: "חורים שחורים", goal: "curious" }), env());
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.plan.chapters.length, 2);
  const sent = seen[0].body;
  assert.equal(sent.output_config.effort, "low");
  assert.deepEqual(sent.output_config.format.schema.required, ["title", "subtitle", "chapters", "notes"]);
  assert.match(sent.messages[0].content, /<plan_request>/);
  assert.match(sent.messages[0].content, /<goal>curious<\/goal>/);
});

test("a path with no chapters is not passed on", async () => {
  reply = message({ ...PLAN, chapters: [] });
  const res = await worker.fetch(post("/api/plan", { topic: "x" }), env());
  assert.equal(res.status, 502);
});

test("a chapter lesson knows its place in the path", async () => {
  reply = message(LESSON);
  seen.length = 0;
  const course = { title: "חורים שחורים", chapters: ["מה זה כוח משיכה", "איך כוכב מת"], index: 1, goal: "להבין מה קורה בסוף חייו של כוכב.", learned: ["כוח משיכה מושך דברים זה לזה."] };
  const res = await worker.fetch(post("/api/lesson", { profile: PROFILE, topic: "חורים שחורים", material: "הערות מהצילום", goal: "curious", course }), env());
  assert.equal(res.status, 200);
  const user = seen[0].body.messages[0].content;
  assert.match(user, /<chapter>2\. איך כוכב מת: להבין מה קורה בסוף חייו של כוכב\.<\/chapter>/);
  assert.match(user, /<learned>\n- כוח משיכה מושך דברים זה לזה\.\n<\/learned>/);
  assert.match(user, /<notes>\nהערות מהצילום\n<\/notes>/);
  assert.match(user, /Write this chapter's lesson\./);
});

test("a course with a bad index is ignored", () => {
  assert.equal(cleanCourse({ chapters: ["א"], index: 3 }), null);
  assert.equal(cleanCourse({ chapters: [], index: 0 }), null);
  assert.equal(cleanCourse({ chapters: ["א", "ב"], index: 1 }).title, "ב");
});

test("plans have their own daily limit", async () => {
  reply = message(PLAN);
  const e = env({ E2S_KV: new MemoryKV(), DAILY_PLANS: "1", DAILY_LESSONS: "5" });
  assert.equal((await worker.fetch(post("/api/plan", { topic: "x" }), e)).status, 200);
  assert.equal((await worker.fetch(post("/api/plan", { topic: "x" }), e)).status, 429);
  reply = message(LESSON);
  assert.equal((await worker.fetch(post("/api/lesson", { topic: "x" }), e)).status, 200);
});
