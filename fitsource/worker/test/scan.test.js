// End-to-end tests of the worker with a fake Claude API (local SSE server) and
// fake shop pages. No network or API key needed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import worker, { parseImage, parseFocus } from "../src/index.js";
import { sanitizeResults } from "../src/scan.js";

const TINY_JPEG = "data:image/jpeg;base64," + Buffer.alloc(3000, 7).toString("base64");

// ---- fake Claude ----------------------------------------------------------
let script = []; // one entry per expected /v1/messages call: array of SSE events
const seenBodies = [];

function sse(events) {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

function message(blocks, stopReason) {
  const events = [
    { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } },
  ];
  blocks.forEach((b, index) => {
    if (b.type === "server_tool_use" || b.type === "tool_use") {
      events.push({ type: "content_block_start", index, content_block: { ...b, input: {} } });
      const raw = JSON.stringify(b.input);
      const mid = Math.floor(raw.length / 2);
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: raw.slice(0, mid) } });
      events.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: raw.slice(mid) } });
    } else if (b.type === "text") {
      events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: b.text } });
    } else {
      events.push({ type: "content_block_start", index, content_block: b });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({ type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 50 } });
  events.push({ type: "message_stop" });
  return events;
}

const RESULTS = {
  vibe: "Night shift street",
  summary: "Cropped leather bomber over a white tank with baggy light jeans.",
  items: [
    {
      label: "Cropped leather bomber",
      category: "outerwear",
      color: "black",
      brand: null,
      product_name: null,
      confidence: "similar",
      box: { x: 180, y: 90, w: 600, h: 330 },
      search_query: "cropped black leather bomber jacket women",
      matches: [
        { title: "Cropped Leather Bomber", brand: "Shopbrand", shop: "Shopbrand", url: "https://shop.example.com/products/bomber", price: 199, currency: "usd", availability: "in_stock", sizes_in_stock: ["S"], match: "close", note: null },
        { title: "Bad link", brand: null, shop: "x", url: "javascript:alert(1)", price: 1, currency: "USD", availability: "in_stock", sizes_in_stock: [], match: "close", note: null },
        { title: "Page store", brand: null, shop: "Page", url: "https://page.example.org/item/7", price: null, currency: null, availability: "in_stock", sizes_in_stock: [], match: "similar", note: "Vegan leather" },
      ],
    },
  ],
};

let server;
let baseURL;
const realFetch = globalThis.fetch;

before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seenBodies.push(JSON.parse(body));
      const events = script.shift();
      if (!events) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "script exhausted" } }));
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse(events));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseURL = `http://127.0.0.1:${server.address().port}`;

  // Shop pages for the stock check.
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://shop.example.com/products/bomber.js") {
      return new Response(JSON.stringify({ available: false, price: 18900, variants: [{ title: "S", available: false }] }), { headers: { "content-type": "application/json" } });
    }
    if (url === "https://page.example.org/item/7") {
      return new Response(`<script type="application/ld+json">{"@type":"Product","offers":{"availability":"InStock","price":"75","priceCurrency":"EUR"}}</script>`, { headers: { "content-type": "text/html" } });
    }
    if (url.startsWith("https://")) return new Response("nope", { status: 404 });
    return realFetch(input, init);
  };
});

after(() => {
  globalThis.fetch = realFetch;
  server.close();
});

const env = () => ({ ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: baseURL });

async function scan(body, e = env()) {
  const req = new Request("https://api.example.com/api/scan", { method: "POST", headers: { "content-type": "application/json", origin: "https://site.example" }, body: JSON.stringify(body) });
  const pending = [];
  const res = await worker.fetch(req, e, { waitUntil: (p) => pending.push(p) });
  const text = await res.text();
  await Promise.all(pending);
  return { res, events: text.trim() ? text.trim().split("\n").map((l) => JSON.parse(l)) : [] };
}

test("parseImage and parseFocus validate input", () => {
  assert.ok(parseImage(TINY_JPEG));
  assert.equal(parseImage("data:image/svg+xml;base64,AAAA"), null);
  assert.equal(parseImage("data:image/jpeg;base64,AAAA"), null); // too small
  assert.equal(parseImage(42), null);
  assert.deepEqual(parseFocus({ x: 100, y: 100, w: 950, h: 50 }), { x: 100, y: 100, w: 900, h: 50 });
  assert.equal(parseFocus({ x: 1, y: 1, w: 5, h: 5 }), null);
  assert.equal(parseFocus({ x: "a" }), null);
});

test("sanitizeResults drops unsafe links and normalizes fields", () => {
  const r = sanitizeResults(RESULTS);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].matches.length, 2);
  assert.equal(r.items[0].matches[0].currency, "USD");
  assert.equal(sanitizeResults({ items: "no" }), null);
  const clamped = sanitizeResults({ items: [{ label: "X", category: "hat", box: { x: 990, y: -5, w: 500, h: 2000 }, matches: [] }] });
  assert.equal(clamped.items[0].category, "accessory");
  assert.deepEqual(clamped.items[0].box, { x: 990, y: 0, w: 10, h: 1000 });
});

test("full scan streams progress, then verified results", async () => {
  seenBodies.length = 0;
  script = [
    message(
      [
        { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "cropped black leather bomber" } },
        { type: "web_search_tool_result", tool_use_id: "srv_1", content: [{ type: "web_search_result", url: "https://shop.example.com/products/bomber", title: "Bomber", encrypted_content: "x", page_age: null }] },
        { type: "server_tool_use", id: "srv_2", name: "web_fetch", input: { url: "https://www.page.example.org/item/7" } },
      ],
      "pause_turn",
    ),
    message([{ type: "tool_use", id: "toolu_1", name: "submit_results", input: RESULTS }], "tool_use"),
  ];
  const { res, events } = await scan({ image: TINY_JPEG, hint: "the jacket" });
  assert.equal(res.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
  assert.equal(res.headers.get("access-control-allow-origin"), "*");

  const kinds = events.map((e) => e.t);
  assert.ok(kinds.includes("search"));
  assert.deepEqual(events.find((e) => e.t === "search"), { t: "search", q: "cropped black leather bomber" });
  assert.deepEqual(events.find((e) => e.t === "fetch"), { t: "fetch", host: "page.example.org" });
  assert.deepEqual(events.find((e) => e.t === "found"), { t: "found", n: 1 });
  const result = events.at(-1);
  assert.equal(result.t, "result");
  const [shopify, page] = result.data.items[0].matches;
  assert.equal(shopify.availability, "sold_out"); // shop says sold out, overrides the model
  assert.equal(shopify.verified, true);
  assert.equal(shopify.price, 189);
  assert.equal(page.availability, "in_stock");
  assert.equal(page.currency, "EUR");

  // Request shape sent to Claude
  const first = seenBodies[0];
  assert.equal(first.model, "claude-opus-5-5");
  assert.equal(first.fallbacks, "default");
  assert.deepEqual(first.output_config, { effort: "medium" });
  assert.equal(first.temperature, undefined);
  assert.deepEqual(first.tools.map((t) => t.name), ["web_search", "web_fetch", "submit_results"]);
  assert.ok(first.messages[0].content[1].text.includes("the jacket"));
  // pause_turn resumes by sending the paused assistant turn back, no extra user text
  assert.equal(seenBodies[1].messages.length, 2);
  assert.equal(seenBodies[1].messages[1].role, "assistant");
});

test("a text answer without submit gets one nudge", async () => {
  seenBodies.length = 0;
  script = [message([{ type: "text", text: "Here you go." }], "end_turn"), message([{ type: "tool_use", id: "toolu_2", name: "submit_results", input: { vibe: "x", summary: "y", items: [] } }], "tool_use")];
  const { events } = await scan({ image: TINY_JPEG });
  assert.equal(events.at(-1).t, "result");
  assert.equal(seenBodies[1].messages.at(-1).role, "user");
});

test("refusal and API errors come back as error events", async () => {
  script = [message([], "refusal")];
  let { events } = await scan({ image: TINY_JPEG });
  assert.deepEqual(events.at(-1), { t: "error", code: "refused", message: "This photo could not be scanned." });

  script = []; // fake server answers 500
  ({ events } = await scan({ image: TINY_JPEG }));
  assert.equal(events.at(-1).t, "error");
  assert.equal(events.at(-1).code, "scan_failed");
});

test("bad requests are rejected before calling Claude", async () => {
  let r = await scan({ image: "data:text/plain;base64,AAAA" });
  assert.equal(r.res.status, 400);
  const plain = await worker.fetch(new Request("https://api.example.com/api/scan", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ image: TINY_JPEG }) }), env(), {});
  assert.equal(plain.status, 415);
  r = await scan({ image: TINY_JPEG }, {});
  assert.equal(r.res.status, 503);
});

test("KV cache answers repeat scans and the daily limit applies", async () => {
  const store = new Map();
  const kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) };
  const e = { ...env(), FITSOURCE_KV: kv, DAILY_SCAN_LIMIT: "1" };
  script = [message([{ type: "tool_use", id: "toolu_3", name: "submit_results", input: RESULTS }], "tool_use")];
  const first = await scan({ image: TINY_JPEG }, e);
  assert.equal(first.events.at(-1).t, "result");
  const again = await scan({ image: TINY_JPEG }, e); // cached, no quota used, no Claude call
  assert.equal(again.events.at(-1).cached, true);
  // stock is re-checked on a cache hit, not replayed from the cache
  const jacket = again.events.at(-1).data.items[0].matches[0];
  assert.equal(jacket.availability, "sold_out");
  assert.equal(jacket.verified, true);
  assert.ok(jacket.checked_at);
  const other = await scan({ image: TINY_JPEG, hint: "shoes" }, e); // new scan, over the limit
  assert.equal(other.res.status, 429);
});

test("health, stock and CORS routes", async () => {
  const health = await worker.fetch(new Request("https://api.example.com/api/health"), env(), {});
  assert.deepEqual(await health.json(), { ok: true, deep_scan: true, model: "claude-opus-5-5", cache: false, daily_limit: null });
  const stock = await worker.fetch(new Request("https://api.example.com/api/stock?url=" + encodeURIComponent("https://page.example.org/item/7")), env(), {});
  assert.equal((await stock.json()).availability, "in_stock");
  const bad = await worker.fetch(new Request("https://api.example.com/api/stock?url=http://127.0.0.1/"), env(), {});
  assert.equal(bad.status, 400);
  const pre = await worker.fetch(new Request("https://api.example.com/api/scan", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), { ALLOWED_ORIGINS: "https://good.example" }, {});
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
  const evil = await worker.fetch(new Request("https://api.example.com/api/scan", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" }), { ...env(), ALLOWED_ORIGINS: "https://good.example" }, {});
  assert.equal(evil.status, 403);
  const sandboxed = await worker.fetch(new Request("https://api.example.com/api/stock?url=https://a.example.com/p", { headers: { origin: "null" } }), { ALLOWED_ORIGINS: "https://good.example" }, {});
  assert.equal(sandboxed.status, 403);
  const good = await worker.fetch(new Request("https://api.example.com/api/health", { headers: { origin: "https://good.example" } }), { ALLOWED_ORIGINS: "https://good.example" }, {});
  assert.equal(good.headers.get("access-control-allow-origin"), "https://good.example");
  const nf = await worker.fetch(new Request("https://api.example.com/nope"), env(), {});
  assert.equal(nf.status, 404);
});
