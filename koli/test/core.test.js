import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { normalize, termSet, hasPhrase, fixMojibake, stems } from "../core/text.js";
import { detectCampaign, activeCampaigns, trackedLink } from "../core/context.js";
import { buildSystemPrompt, buildTurnPrompt, parseReply, applyDisclosure, extractJson } from "../core/prompt.js";
import { normalizeState, disclosureLine } from "../core/defaults.js";
import { parseInstagramExport, samplesFromText, isWantedFile } from "../core/igexport.js";
import { generateReply } from "../core/reply.js";
import { listZip, readZipText } from "../core/zip.js";
import { demoState } from "../js/demo.js";

const NOW = new Date("2026-10-26T12:00:00Z");

function state(extra = {}) {
  return normalizeState({
    persona: { name: "נועה", handle: "noa", gender: "female" },
    campaigns: [
      { id: "serum", name: "סרום ויטמין C", brand: "גלואו", product: "סרום הזוהר", price: "₪129", coupon: "NOA20", link: "https://glow.example/serum", keywords: ["סרום", "ויטמין סי"], stories: [{ id: "s1", storyId: "17890", text: "הסרום שאני שמה כל בוקר" }], facts: "מתאים לכל סוגי העור" },
      { id: "shoes", name: "סניקרס", brand: "ראנר", product: "סניקרס לבנות", price: "₪349", coupon: "NOA15", keywords: ["נעליים", "סניקרס"], end: "2026-12-31" },
      { id: "old", name: "קמפיין ישן", product: "שמפו", end: "2026-01-01" },
    ],
    ...extra,
  });
}

test("normalize strips niqqud and unifies final letters", () => {
  assert.equal(normalize("שָׁלוֹם!!"), "שלומ");
  assert.ok(stems("והסרום").includes("סרום"));
});

test("hasPhrase matches words with Hebrew prefixes and multi-word phrases", () => {
  const msg = "כמה עולה והסרום? ראיתי את ויטמין סי";
  assert.ok(hasPhrase(termSet(msg), normalize(msg), "סרום"));
  assert.ok(hasPhrase(termSet(msg), normalize(msg), "ויטמין סי"));
  assert.ok(!hasPhrase(termSet(msg), normalize(msg), "נעליים"));
});

test("fixMojibake repairs Instagram export Hebrew and leaves good text alone", () => {
  const broken = String.fromCharCode(...new TextEncoder().encode("היי מותק"));
  assert.equal(fixMojibake(broken), "היי מותק");
  assert.equal(fixMojibake("היי"), "היי");
  assert.equal(fixMojibake("café"), "café");
});

test("expired campaigns are not active", () => {
  assert.deepEqual(activeCampaigns(state().campaigns, NOW).map((c) => c.id), ["serum", "shoes"]);
});

test("a story reply decides the campaign", () => {
  const d = detectCampaign({ campaigns: state().campaigns, text: "כמה זה עולה?", storyId: "17890", now: NOW });
  assert.equal(d.campaignId, "serum");
  assert.ok(d.confidence > 0.9);
  assert.equal(d.story.text, "הסרום שאני שמה כל בוקר");
  assert.equal(detectCampaign({ campaigns: state().campaigns, text: "כמה?", storyId: "s1", now: NOW }).campaignId, "serum");
});

test("keywords with prefixes pick the right campaign", () => {
  const d = detectCampaign({ campaigns: state().campaigns, text: "יש את הסניקרס במידה 38?", now: NOW });
  assert.equal(d.campaignId, "shoes");
  assert.equal(detectCampaign({ campaigns: state().campaigns, text: "מה עם השמפו?", now: NOW }).campaignId, null);
});

test("the conversation's campaign carries over to a vague follow-up", () => {
  const d = detectCampaign({ campaigns: state().campaigns, text: "ויש משלוח?", lastCampaignId: "shoes", now: NOW });
  assert.equal(d.campaignId, "shoes");
});

test("tracked links get UTM tags once", () => {
  const link = trackedLink({ id: "serum", link: "https://glow.example/serum?x=1" });
  assert.match(link, /utm_source=instagram/);
  assert.match(link, /utm_campaign=koli_serum/);
  assert.equal(trackedLink({ id: "a", link: "https://x.example/?utm_source=me" }), "https://x.example/?utm_source=me");
});

test("system prompt carries voice, dials, active campaigns and rules", () => {
  const s = state();
  s.persona.profile = { summary: "חמה ומצחיקה", signature_phrases: ["מותקקק"] };
  s.persona.corrections = [{ fan: "כמה עולה?", reply: "129 מאמי 💛" }];
  const p = buildSystemPrompt(s, NOW);
  assert.match(p, /נועה/);
  assert.match(p, /מותקקק/);
  assert.match(p, /129 מאמי/);
  assert.match(p, /NOA20/);
  assert.match(p, /utm_campaign=koli_serum/);
  assert.doesNotMatch(p, /שמפו/);
  assert.match(p, /feminine first-person/);
  assert.match(p, /פוליטיקה/);
});

test("system prompt does not change between fans (cacheable)", () => {
  const s = state();
  assert.equal(buildSystemPrompt(s, NOW), buildSystemPrompt(s, NOW));
});

test("turn prompt includes history, story and detector hint", () => {
  const t = buildTurnPrompt({ history: [{ from: "fan", text: "היי" }, { from: "bot", text: "היי מותק" }], text: "כמה עולה?", fanName: "שירה", story: { text: "סטורי" }, detection: { campaignId: "serum", confidence: 0.9, reasons: ["x"] } });
  assert.match(t, /Fan: היי/);
  assert.match(t, /You: היי מותק/);
  assert.match(t, /שירה/);
  assert.match(t, /serum/);
});

test("parseReply validates campaign ids, intents and bubble count", () => {
  const s = state();
  const r = parseReply('```json\n{"campaign_id":"old","intent":"weird","confidence":3,"handoff":0,"handoff_reason":"","messages":["a","b","c"],"note":""}\n```', s, NOW);
  assert.equal(r.campaign_id, null);
  assert.equal(r.intent, "other");
  assert.equal(r.confidence, 1);
  assert.deepEqual(r.messages, ["a", "b"]);
  assert.throws(() => parseReply({ messages: [] }, s, NOW));
  assert.throws(() => extractJson("no json here"));
});

test("disclosure is added to the first reply only, or every reply, or never", () => {
  const s = state();
  const reply = { messages: ["היי מאמי"] };
  const line = disclosureLine(s);
  assert.match(applyDisclosure(reply, s, []).messages[0], new RegExp(line.replace(/[()]/g, "\\$&")));
  assert.equal(applyDisclosure(reply, s, [{ from: "bot", text: "x" }]).messages[0], "היי מאמי");
  s.controls.disclosure = "every";
  assert.ok(applyDisclosure(reply, s, [{ from: "bot", text: "x" }]).messages[0].includes(line));
  s.controls.disclosure = "off";
  assert.equal(applyDisclosure(reply, s, []).messages[0], "היי מאמי");
});

test("generateReply runs the whole pipeline with any backend", async () => {
  let seen;
  const out = await generateReply({
    state: state(),
    text: "יש קוד הנחה לסרום?",
    now: NOW,
    ask: async (req) => {
      seen = req;
      return { campaign_id: "serum", intent: "coupon", confidence: 0.95, handoff: false, handoff_reason: "", messages: ["בטח! NOA20 ✨"], note: "" };
    },
  });
  assert.match(seen.turn, /serum/);
  assert.equal(out.campaign_id, "serum");
  assert.equal(out.detection.campaignId, "serum");
  assert.match(out.messages[0], /NOA20/);
  assert.match(out.messages[0], /העוזרת הדיגיטלית/);
});

function igMessages(threadMessages, participants = ["Noa Cohen", "fan"]) {
  return JSON.stringify({
    participants: participants.map((name) => ({ name: String.fromCharCode(...new TextEncoder().encode(name)) })),
    messages: threadMessages.map(([sender, content, at]) => ({ sender_name: String.fromCharCode(...new TextEncoder().encode(sender)), content: String.fromCharCode(...new TextEncoder().encode(content)), timestamp_ms: at })).reverse(),
  });
}

test("Instagram export: finds the creator, pairs fan messages with replies, skips system lines", () => {
  const files = [
    { path: "your_instagram_activity/messages/inbox/shira_1/message_1.json", text: igMessages([["shira", "היי! איפה קנית את החולצה?", 1], ["shira", "חייבת", 2], ["Noa Cohen", "בזארה מותקקק 💛", 3], ["shira", "liked a message", 4]]) },
    { path: "your_instagram_activity/messages/inbox/dana_2/message_1.json", text: igMessages([["dana", "את מהממת", 1], ["Noa Cohen", "תודה יפה שלי 🥹", 2]]) },
    { path: "your_instagram_activity/content/posts_1.json", text: JSON.stringify([{ media: [{ title: String.fromCharCode(...new TextEncoder().encode("בוקר טוב עולם ☀️")) }] }]) },
    { path: "your_instagram_activity/comments/post_comments_1.json", text: JSON.stringify([{ string_map_data: { Comment: { value: "חחח אהבתי" } } }]) },
    { path: "media/posts/1.jpg", text: "" },
  ];
  const r = parseInstagramExport(files.filter((f) => isWantedFile(f.path)));
  assert.equal(r.owner, "Noa Cohen");
  assert.equal(r.threads, 2);
  assert.deepEqual(r.pairs[0], { fan: "היי! איפה קנית את החולצה? / חייבת", reply: "בזארה מותקקק 💛", source: "instagram" });
  assert.ok(r.samples.some((s) => s.text === "בוקר טוב עולם ☀️" && s.source === "caption"));
  assert.ok(r.samples.some((s) => s.text === "חחח אהבתי" && s.source === "comment"));
  assert.ok(!r.samples.some((s) => /liked/.test(s.text)));
});

test("pasted text splits into samples", () => {
  assert.equal(samplesFromText("היי מאמי\nתודה!!\n\nפסקה ארוכה").length, 3);
});

function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text, deflate] of entries) {
    const nameBuf = Buffer.from(name);
    const raw = Buffer.from(text);
    const data = deflate ? zlib.deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Blob([Buffer.concat([...locals, cd, eocd])]);
}

test("zip reader lists and inflates entries", async () => {
  const blob = makeZip([["a/message_1.json", '{"x":"שלום"}', true], ["b.txt", "plain", false], ["dir/", "", false]]);
  const entries = await listZip(blob);
  assert.deepEqual(entries.map((e) => e.name), ["a/message_1.json", "b.txt"]);
  assert.equal(await readZipText(blob, entries[0]), '{"x":"שלום"}');
  assert.equal(await readZipText(blob, entries[1]), "plain");
});

test("demo state is valid and its story reply detects the campaign", () => {
  const s = normalizeState(demoState());
  const story = s.campaigns[0].stories[0];
  const d = detectCampaign({ campaigns: s.campaigns, text: "כמה זה?", storyId: story.id, now: new Date() });
  assert.equal(d.campaignId, s.campaigns[0].id);
  assert.ok(buildSystemPrompt(s).length > 1000);
});

test("voice quiz: ten questions, gendered wording, answers lead the prompt and the analysis", async () => {
  const { QUIZ, quizPairs, quizQuestion } = await import("../core/quiz.js");
  const { buildAnalyzePrompt } = await import("../core/prompt.js");
  assert.equal(QUIZ.length, 10);
  assert.equal(new Set(QUIZ.map((q) => q.id)).size, 10);
  const boundary = QUIZ.find((q) => q.id === "boundary");
  assert.match(quizQuestion(boundary, "female"), /מתה עלייך/);
  assert.match(quizQuestion(boundary, "male"), /מת עליך/);
  const s = state();
  s.persona.quiz = { answers: { coupon: "בטח מאמי! NOA20 💛", hurt: "   " } };
  const pairs = quizPairs(s.persona);
  assert.deepEqual(pairs, [{ fan: "יש קוד הנחה? 🙏", reply: "בטח מאמי! NOA20 💛", source: "quiz" }]);
  const sys = buildSystemPrompt(s, NOW);
  assert.match(sys, /voice quiz/);
  assert.match(sys, /Fan: יש קוד הנחה\? 🙏\nנועה: בטח מאמי! NOA20 💛/);
  assert.match(buildAnalyzePrompt(s.persona), /בטח מאמי! NOA20/);
  assert.deepEqual(normalizeState({ persona: { name: "x" } }).persona.quiz, { answers: {} });
});
