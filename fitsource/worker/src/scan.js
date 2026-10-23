// The deep scan: Claude looks at the fit, searches the web for each piece,
// reads product pages, and hands back structured results. Progress is reported
// through `emit` so the page can show what is happening live.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, SUBMIT_TOOL, CATEGORIES, MATCH_KINDS, userInstruction } from "./prompt.js";
import { AVAILABILITY, checkStock, isSafePublicUrl } from "./stock.js";

export const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_TURNS = 6;

export class ScanError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function cleanText(v, max = 200) {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

/** Validate and tidy whatever came back in submit_results. Never trusts the model blindly. */
export function sanitizeResults(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.items)) return null;
  const items = [];
  for (const raw of input.items.slice(0, 10)) {
    if (!raw || typeof raw !== "object") continue;
    const label = cleanText(raw.label, 80);
    if (!label) continue;
    const box = raw.box && typeof raw.box === "object" ? raw.box : {};
    const x = clampInt(box.x, 0, 1000);
    const y = clampInt(box.y, 0, 1000);
    const matches = [];
    const seen = new Set();
    for (const m of Array.isArray(raw.matches) ? raw.matches.slice(0, 8) : []) {
      if (!m || typeof m !== "object") continue;
      const url = typeof m.url === "string" ? m.url.trim() : "";
      if (!isSafePublicUrl(url) || seen.has(url)) continue;
      seen.add(url);
      const price = typeof m.price === "number" && Number.isFinite(m.price) && m.price >= 0 ? Math.round(m.price * 100) / 100 : null;
      const currency = typeof m.currency === "string" && /^[A-Za-z]{3}$/.test(m.currency.trim()) ? m.currency.trim().toUpperCase() : null;
      matches.push({
        title: cleanText(m.title, 140) || label,
        brand: cleanText(m.brand, 60),
        shop: cleanText(m.shop, 60) || new URL(url).hostname.replace(/^www\./, ""),
        url,
        price,
        currency,
        availability: AVAILABILITY.includes(m.availability) ? m.availability : "unknown",
        sizes_in_stock: Array.isArray(m.sizes_in_stock) ? m.sizes_in_stock.map((s) => cleanText(String(s), 16)).filter(Boolean).slice(0, 16) : [],
        match: MATCH_KINDS.includes(m.match) ? m.match : "similar",
        note: cleanText(m.note, 160),
        verified: false,
      });
    }
    items.push({
      label,
      category: CATEGORIES.includes(raw.category) ? raw.category : "accessory",
      color: cleanText(raw.color, 40) || "",
      brand: cleanText(raw.brand, 60),
      product_name: cleanText(raw.product_name, 120),
      confidence: ["exact", "likely", "similar"].includes(raw.confidence) ? raw.confidence : "similar",
      box: { x, y, w: clampInt(box.w, 10, 1000 - x), h: clampInt(box.h, 10, 1000 - y) },
      search_query: cleanText(raw.search_query, 120) || label,
      matches,
    });
  }
  return {
    vibe: cleanText(input.vibe, 40) || "",
    summary: cleanText(input.summary, 240) || "",
    items,
  };
}

/** Re-check stock on the shops themselves and trust that over the model's reading. */
export async function verifyStock(results, { fetchImpl, limit = 14, timeoutMs = 7000 } = {}) {
  const targets = [];
  for (const item of results.items) for (const m of item.matches) targets.push(m);
  await Promise.all(
    targets.slice(0, limit).map(async (m) => {
      const r = await checkStock(m.url, { fetchImpl, timeoutMs });
      m.checked_at = r.checked_at;
      if (r.availability !== "unknown") {
        m.availability = r.availability;
        m.verified = true;
        if (r.price != null) m.price = r.price;
        if (r.currency) m.currency = r.currency;
        const open = (r.sizes || []).filter((s) => s.available).map((s) => s.label);
        if (open.length) m.sizes_in_stock = open.slice(0, 16);
      }
    }),
  );
  return results;
}

function describeTool(name, input) {
  if (!input || typeof input !== "object") return null;
  if (name === "web_search" && typeof input.query === "string") return { t: "search", q: input.query.slice(0, 160) };
  if (name === "web_fetch" && typeof input.url === "string") {
    try {
      const u = new URL(input.url);
      return { t: "fetch", host: u.hostname.replace(/^www\./, "") };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Run a scan. `image` is { media_type, data } (base64). Returns sanitized results.
 */
export async function runScan({ image, focus = null, hint = null, env = {}, emit = () => {}, fetchImpl, client: injected }) {
  const client =
    injected ||
    new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
      maxRetries: 2,
    });
  const model = env.FITSOURCE_MODEL || DEFAULT_MODEL;
  const effort = env.FITSOURCE_EFFORT || "medium";
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: clampInt(env.MAX_SEARCHES || 10, 1, 30) },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: clampInt(env.MAX_FETCHES || 8, 1, 30), max_content_tokens: 12000 },
    SUBMIT_TOOL,
  ];
  const messages = [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
        { type: "text", text: userInstruction({ focus, hint }) },
      ],
    },
  ];

  emit({ t: "status", msg: "Reading the fit" });
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, web_search_requests: 0 };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
      tools,
      messages,
      output_config: { effort },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    const pending = new Map(); // block index -> { name, json }
    for await (const ev of stream) {
      if (ev.type === "content_block_start") {
        const b = ev.content_block;
        if (b.type === "server_tool_use") pending.set(ev.index, { name: b.name, json: "" });
        else if (b.type === "tool_use" && b.name === SUBMIT_TOOL.name) emit({ t: "status", msg: "Putting the results together" });
        else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) emit({ t: "found", n: b.content.length });
      } else if (ev.type === "content_block_delta" && ev.delta.type === "input_json_delta") {
        const p = pending.get(ev.index);
        if (p) p.json += ev.delta.partial_json;
      } else if (ev.type === "content_block_stop") {
        const p = pending.get(ev.index);
        if (p) {
          pending.delete(ev.index);
          let input = null;
          try {
            input = JSON.parse(p.json || "{}");
          } catch {
            input = null;
          }
          const step = describeTool(p.name, input);
          if (step) emit(step);
        }
      }
    }
    const msg = await stream.finalMessage();
    const u = msg.usage || {};
    usage.input_tokens += u.input_tokens || 0;
    usage.output_tokens += u.output_tokens || 0;
    usage.cache_read_input_tokens += u.cache_read_input_tokens || 0;
    usage.web_search_requests += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;

    if (msg.stop_reason === "refusal") throw new ScanError("refused", "This photo could not be scanned.");

    const submit = msg.content.find((b) => b.type === "tool_use" && b.name === SUBMIT_TOOL.name);
    if (submit) {
      const results = sanitizeResults(submit.input);
      if (results && msg.stop_reason !== "max_tokens") return { results, model: msg.model, usage };
      // Malformed or truncated: tell Claude and let it submit again.
      messages.push({ role: "assistant", content: msg.content });
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: submit.id, is_error: true, content: "The submission was incomplete or not valid JSON. Call submit_results again with the full results." }],
      });
      continue;
    }

    messages.push({ role: "assistant", content: msg.content });
    if (msg.stop_reason === "pause_turn") continue; // server tools hit their loop limit; resume as is
    if (msg.stop_reason === "max_tokens") throw new ScanError("too_long", "The scan ran out of room. Try a tighter crop.");
    // Finished talking without submitting.
    messages.push({ role: "user", content: "Call submit_results now with what you found." });
  }
  throw new ScanError("no_results", "The scan did not finish. Try again.");
}

