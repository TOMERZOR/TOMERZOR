import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { verifySignature, parseEvents, sendText } from "../src/instagram.js";
import { Store, resetMemory } from "../src/store.js";
import { handleEvent, approveAndSend } from "../src/inbox.js";
import { makeAsk } from "../src/claude.js";
import { demoState } from "../../js/demo.js";
import { normalizeState } from "../../core/defaults.js";

const SECRET = "app-secret";

async function sign(body, secret = SECRET) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function dm({ fan = "111", text = "כמה עולה?", mid = "m1", story = null, echo = false } = {}) {
  return {
    object: "instagram",
    entry: [
      {
        id: "999",
        time: 1,
        messaging: [
          {
            sender: { id: echo ? "999" : fan },
            recipient: { id: echo ? fan : "999" },
            timestamp: 1000,
            message: { mid, text, ...(echo ? { is_echo: true } : {}), ...(story ? { reply_to: { story: { id: story, url: "https://x" } } } : {}) },
          },
        ],
      },
    ],
  };
}

function fakeAsk(reply) {
  const calls = [];
  const ask = async (req) => {
    calls.push(req);
    return JSON.stringify({ campaign_id: "lumi", intent: "price", confidence: 0.9, handoff: false, handoff_reason: "", messages: ["₪119 מותק 💛"], note: "", ...reply });
  };
  ask.calls = calls;
  return ask;
}

function fakeFetch() {
  const sent = [];
  const f = async (url, init) => {
    if (init?.method === "POST") {
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ message_id: `out${sent.length}` }), { status: 200 });
    }
    return new Response(JSON.stringify({ name: "שירה", username: "shira" }), { status: 200 });
  };
  f.sent = sent;
  return f;
}

const ENV = { IG_ACCESS_TOKEN: "tok", IG_APP_SECRET: SECRET, IG_VERIFY_TOKEN: "verify" };

async function setup(mode = "auto") {
  resetMemory();
  const store = new Store({});
  const state = normalizeState(demoState());
  state.controls.mode = mode;
  state.campaigns[0].stories[0].storyId = "17890";
  await store.setConfig(state);
  return store;
}

test("webhook signature check", async () => {
  const body = JSON.stringify({ a: 1 });
  assert.equal(await verifySignature(body, await sign(body), SECRET), true);
  assert.equal(await verifySignature(body, await sign(body, "other"), SECRET), false);
  assert.equal(await verifySignature(body, null, SECRET), false);
});

test("parseEvents reads text, story replies, echoes and skips the rest", () => {
  const [ev] = parseEvents(dm({ story: "17890" }));
  assert.deepEqual({ fanId: ev.fanId, storyId: ev.storyId, echo: ev.echo, text: ev.text }, { fanId: "111", storyId: "17890", echo: false, text: "כמה עולה?" });
  assert.equal(parseEvents(dm({ echo: true }))[0].fanId, "111");
  assert.equal(parseEvents({ object: "page" }).length, 0);
  const sticker = dm();
  sticker.entry[0].messaging[0].message = { mid: "x", attachments: [{ type: "image" }] };
  assert.equal(parseEvents(sticker).length, 0);
});

test("auto mode: a story reply is answered on Instagram in the creator's voice", async () => {
  const store = await setup("auto");
  const ask = fakeAsk();
  const fetchImpl = fakeFetch();
  const [ev] = parseEvents(dm({ story: "17890" }));
  const out = await handleEvent(ev, { env: ENV, store, ask, fetchImpl });
  assert.match(ask.calls[0].turn, /lumi/);
  assert.match(ask.calls[0].turn, /מאיה מורחת/);
  assert.equal(fetchImpl.sent.length, 1);
  assert.equal(fetchImpl.sent[0].recipient.id, "111");
  assert.match(fetchImpl.sent[0].message.text, /₪119/);
  assert.match(fetchImpl.sent[0].message.text, /העוזרת הדיגיטלית של מאיה/);
  const conv = await store.getConversation("111");
  assert.equal(conv.fanName, "שירה");
  assert.equal(conv.lastCampaignId, "lumi");
  assert.deepEqual(conv.messages.map((m) => m.from), ["fan", "bot"]);
  assert.ok(out.sent);
  // The second reply in the same chat has no AI label again.
  await handleEvent(parseEvents(dm({ mid: "m2", text: "ויש משלוח?" }))[0], { env: ENV, store, ask, fetchImpl });
  assert.doesNotMatch(fetchImpl.sent[1].message.text, /העוזרת הדיגיטלית/);
  assert.match(ask.calls[1].turn, /You: ₪119/);
});

test("duplicate deliveries are ignored", async () => {
  const store = await setup("auto");
  const ask = fakeAsk();
  const fetchImpl = fakeFetch();
  const [ev] = parseEvents(dm());
  await handleEvent(ev, { env: ENV, store, ask, fetchImpl });
  assert.deepEqual(await handleEvent(ev, { env: ENV, store, ask, fetchImpl }), { skipped: "duplicate" });
  assert.equal(fetchImpl.sent.length, 1);
});

test("when the creator replies personally, Koli steps aside in that chat", async () => {
  const store = await setup("auto");
  const ask = fakeAsk();
  const fetchImpl = fakeFetch();
  await handleEvent(parseEvents(dm())[0], { env: ENV, store, ask, fetchImpl });
  // Koli's own echo is ignored
  assert.deepEqual(await handleEvent(parseEvents(dm({ echo: true, mid: "out1", text: "₪119" }))[0], { env: ENV, store, ask, fetchImpl }), { skipped: "own_echo" });
  // the creator types in the Instagram app
  assert.deepEqual(await handleEvent(parseEvents(dm({ echo: true, mid: "human1", text: "אני פה מאמי" }))[0], { env: ENV, store, ask, fetchImpl }), { paused: true });
  const out = await handleEvent(parseEvents(dm({ mid: "m3", text: "תודה!" }))[0], { env: ENV, store, ask, fetchImpl });
  assert.deepEqual(out, { skipped: "paused" });
  assert.equal(fetchImpl.sent.length, 1);
});

test("approve mode keeps a draft; an edited approval is sent and learned", async () => {
  const store = await setup("approve");
  const ask = fakeAsk({ handoff: true, handoff_reason: "תלונה", intent: "complaint", messages: ["אוי לא, אני מעבירה למאיה"] });
  const fetchImpl = fakeFetch();
  const out = await handleEvent(parseEvents(dm({ text: "לא הגיע לי המשלוח" }))[0], { env: ENV, store, ask, fetchImpl });
  assert.ok(out.draft);
  assert.equal(fetchImpl.sent.length, 0);
  const listed = await store.listConversations();
  assert.equal(listed[0].hasDraft, true);
  assert.equal(listed[0].needsHuman, true);
  const res = await approveAndSend("111", { messages: ["מצטערת מותק! שלחי לי מספר הזמנה ואני בודקת 💛"] }, { env: ENV, store, fetchImpl });
  assert.equal(res.learned, true);
  assert.equal(fetchImpl.sent.length, 1);
  const state = await store.getConfig();
  assert.deepEqual(state.persona.corrections.at(-1).fan, "לא הגיע לי המשלוח");
  assert.match(state.persona.corrections.at(-1).reply, /מספר הזמנה/);
  assert.equal((await store.getConversation("111")).draft, null);
});

test("sendText calls the Instagram send API", async () => {
  const fetchImpl = fakeFetch();
  const id = await sendText({ IG_ACCESS_TOKEN: "t" }, "42", "x".repeat(1500), fetchImpl);
  assert.equal(id, "out1");
  assert.equal(fetchImpl.sent[0].message.text.length, 1000);
});

test("makeAsk sends structured output, caching and fallback, and returns the JSON text", async () => {
  let params;
  const client = { beta: { messages: { create: async (p) => ((params = p), { stop_reason: "end_turn", content: [{ type: "text", text: '{"ok":1}' }] }) } } };
  const ask = makeAsk({}, { client });
  assert.equal(await ask({ system: "S", turn: "T", schema: { type: "object" } }), '{"ok":1}');
  assert.equal(params.model, "claude-opus-5-5");
  assert.equal(params.output_config.format.type, "json_schema");
  assert.equal(params.output_config.effort, "low");
  assert.deepEqual(params.system[0].cache_control, { type: "ephemeral" });
  assert.equal(params.fallbacks, "default");
  const refused = makeAsk({}, { client: { beta: { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } } } });
  await assert.rejects(refused({ system: "", turn: "", schema: {} }), (e) => e.code === "refused");
});

test("routes: webhook verification, signature, auth", async () => {
  resetMemory();
  const env = { ...ENV, KOLI_ADMIN_TOKEN: "admin" };
  const ctx = { waitUntil() {} };
  let r = await worker.fetch(new Request("https://k.dev/webhook/instagram?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=abc"), env, ctx);
  assert.equal(await r.text(), "abc");
  r = await worker.fetch(new Request("https://k.dev/webhook/instagram?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=abc"), env, ctx);
  assert.equal(r.status, 403);
  const body = JSON.stringify(dm());
  r = await worker.fetch(new Request("https://k.dev/webhook/instagram", { method: "POST", body, headers: { "x-hub-signature-256": "sha256=00" } }), env, ctx);
  assert.equal(r.status, 401);
  r = await worker.fetch(new Request("https://k.dev/webhook/instagram", { method: "POST", body, headers: { "x-hub-signature-256": await sign(body) } }), env, ctx);
  assert.equal(r.status, 200);
  r = await worker.fetch(new Request("https://k.dev/api/config"), env, ctx);
  assert.equal(r.status, 401);
  r = await worker.fetch(new Request("https://k.dev/api/config", { method: "PUT", body: JSON.stringify({ state: demoState() }), headers: { authorization: "Bearer admin", "content-type": "application/json" } }), env, ctx);
  assert.equal(r.status, 200);
  r = await worker.fetch(new Request("https://k.dev/api/config", { headers: { authorization: "Bearer admin" } }), env, ctx);
  assert.equal((await r.json()).state.persona.name, "מאיה");
  r = await worker.fetch(new Request("https://k.dev/api/health"), env, ctx);
  assert.deepEqual(await r.json(), { ok: true, claude: false, instagram: true, storage: "memory", auth: true, model: "claude-opus-5-5" });
  // Without an admin token only a local run is open.
  r = await worker.fetch(new Request("https://k.dev/api/conversations"), {}, ctx);
  assert.equal(r.status, 401);
  r = await worker.fetch(new Request("http://localhost:8080/api/conversations"), {}, ctx);
  assert.equal(r.status, 200);
  r = await worker.fetch(new Request("http://localhost:8080/api/reply", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }), {}, ctx);
  assert.equal((await r.json()).error, "not_configured");
});
