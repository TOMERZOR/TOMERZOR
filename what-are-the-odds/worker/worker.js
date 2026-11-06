// What are the odds? on Cloudflare Workers.
// Static files (public/) are served by Cloudflare before this runs; the Worker
// only answers the API:
//   GET  /api/health
//   POST /api/odds   { q, lang }  ->  { kind: "fact" | "ai" | "unknown" | "care" | "none", ... }
//
// Checked answers (public/js/core/data.js) come first. Anything else goes to
// Workers AI (free daily allowance on Cloudflare), and the answer is marked as an
// AI estimate so nobody mistakes it for a statistic.

import { findFact, needsCare, normalize, stripOpener } from "../public/js/core/match.js";

const VERSION = 1;
const MAX_Q = 160;
const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DEFAULT_FALLBACK = "@cf/meta/llama-3.1-8b-instruct-fast";

// Per-isolate memory: a small answer cache and a per-IP rate limit.
const cache = new Map(); // key -> { at, body }
const CACHE_MAX = 500;
const CACHE_MS = 7 * 24 * 3600 * 1000;
const hits = new Map(); // ip -> [timestamps]
const RATE_PER_MIN = 10;
const RATE_PER_DAY = 120;

const SCHEMA = {
  type: "object",
  properties: {
    answerable: { type: "boolean" },
    probability: { type: ["number", "null"] },
    timeframe: { type: "string" },
    explanation: { type: "string" },
    basis: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["answerable", "probability", "explanation", "basis", "confidence"],
};

function systemPrompt(lang) {
  const language = lang === "he" ? "Hebrew (modern, natural, everyday Israeli Hebrew)" : "English";
  return `You are the engine of "What are the odds?", a site that tells people the REAL probability of things.
The user finishes the sentence "What are the odds..." and you estimate the probability.

Rules:
- Give your best honest estimate as a probability between 0 and 1 (e.g. 0.25, 0.0001, 6e-8).
- Ground it in real statistics, base rates, physics or exact math. Prefer well-known figures; round them. Never invent precise-sounding studies or numbers. If you are unsure, say it is a rough estimate and set confidence to "low".
- Read the question literally: "tomorrow" means within the next day, "this year" within a year, otherwise assume a typical person over the natural timeframe (one event, one year or one lifetime) and say which in "timeframe".
- Physically impossible: probability 0. Practically certain: close to 1.
- If it depends on private facts nobody can know (someone's feelings, a specific person's future, a coin you haven't flipped is fine though), set answerable to false, probability to null, and in the explanation say kindly what the odds depend on, plus a real base rate if one exists (e.g. how often first dates lead to a second date).
- If the question is about self-harm or suicide, set answerable to false, probability to null, and gently encourage talking to someone (in Israel: ERAN 1201; in the US: 988).
- Medical or legal questions: give population statistics only, and note a doctor can say more about a specific case.
- Be warm and a little playful, but truthful. No moralizing.
- "explanation": 2 to 3 short sentences in ${language}: the number in words and why. Do not repeat the question.
- "basis": the source or method, a few words in ${language} (e.g. a named organization, "exact math", "rough estimate").
- "timeframe": a few words in ${language}, or "".
- Reply with JSON only.`;
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cors(),
      ...extra,
    },
  });
}

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

function rateLimited(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter((t) => now - t < 24 * 3600 * 1000);
  const lastMinute = list.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= RATE_PER_MIN || list.length >= RATE_PER_DAY) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return false;
}

function remember(key, body) {
  cache.set(key, { at: Date.now(), body });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function recall(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) { cache.delete(key); return null; }
  return hit.body;
}

// Pull a JSON object out of whatever the model returned.
export function parseModelOutput(out) {
  let r = out && typeof out === "object" && "response" in out ? out.response : out;
  if (r && typeof r === "object") return r;
  if (typeof r !== "string") return null;
  const start = r.indexOf("{");
  const end = r.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(r.slice(start, end + 1)); } catch { return null; }
}

// Turn the model's object into what the page shows, or null if it's unusable.
export function cleanAnswer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const explanation = text(raw.explanation, 700);
  if (!explanation) return null;
  let p = raw.probability;
  if (typeof p === "string") {
    const s = p.trim();
    const m = s.match(/^1\s*(?:in|:|\/)\s*([\d.,eE+]+)/);
    if (m) p = 1 / parseFloat(m[1].replace(/,/g, ""));
    else if (s.endsWith("%")) p = parseFloat(s) / 100;
    else p = parseFloat(s);
  }
  const answerable = raw.answerable !== false && typeof p === "number" && isFinite(p);
  if (answerable) p = Math.min(1, Math.max(0, p));
  const confidence = ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "low";
  return {
    kind: answerable ? "ai" : "unknown",
    p: answerable ? p : null,
    explanation,
    basis: text(raw.basis, 120),
    timeframe: text(raw.timeframe, 60),
    confidence,
  };
}

async function askModel(env, model, q, lang) {
  const messages = [
    { role: "system", content: systemPrompt(lang) },
    { role: "user", content: (lang === "he" ? "מה הסיכוי " : "What are the odds ") + q },
  ];
  try {
    const out = await env.AI.run(model, {
      messages,
      max_tokens: 400,
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: SCHEMA },
    });
    const ans = cleanAnswer(parseModelOutput(out));
    if (ans) return ans;
  } catch (err) {
    console.warn("json mode failed", model, String(err && err.message || err));
  }
  // Some models don't do JSON mode: ask in plain text and parse
  const out = await env.AI.run(model, { messages, max_tokens: 400, temperature: 0.2 });
  return cleanAnswer(parseModelOutput(out));
}

export async function answer(q, lang, env, ip = "unknown") {
  if (needsCare(q)) return { kind: "care" };
  const { fact, related } = findFact(q);
  const relatedIds = related.map((f) => f.id);
  if (fact) return { kind: "fact", id: fact.id, related: relatedIds };

  if (!env.AI) return { kind: "none", reason: "no-ai", related: relatedIds };

  const key = `${VERSION}:${lang}:${stripOpener(normalize(q))}`;
  const cached = recall(key);
  if (cached) return { ...cached, related: relatedIds, cached: true };

  if (rateLimited(ip)) return { kind: "none", reason: "rate", related: relatedIds };

  const models = [env.AI_MODEL || DEFAULT_MODEL, env.AI_FALLBACK_MODEL || DEFAULT_FALLBACK];
  for (const model of models) {
    try {
      const ans = await askModel(env, model, q, lang);
      if (ans) {
        remember(key, ans);
        return { ...ans, related: relatedIds };
      }
    } catch (err) {
      console.error("model failed", model, String(err && err.message || err));
    }
  }
  return { kind: "none", reason: "ai-failed", related: relatedIds };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

    if (url.pathname === "/api/health") {
      return json({ service: "what-are-the-odds", ok: true, ai: Boolean(env.AI), version: VERSION });
    }

    if (url.pathname === "/api/odds") {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const q = typeof body.q === "string" ? body.q.replace(/\s+/g, " ").trim() : "";
      const lang = body.lang === "en" ? "en" : "he";
      if (q.length < 2) return json({ error: "empty" }, 400);
      if (q.length > MAX_Q) return json({ error: "too long" }, 400);
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const result = await answer(q, lang, env, ip);
      return json(result);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: "not found" }, 404);
  },
};
