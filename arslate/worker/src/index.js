// ArsLate API (Cloudflare Worker). Routes:
//   GET  /api/health      what this deployment can do
//   POST /api/translate   {text, previous?} -> {text, model}
//
// Bindings (all optional except the key): ANTHROPIC_API_KEY (secret),
// ARSLATE_KV (KV namespace for caching and daily limits), ALLOWED_ORIGINS,
// DAILY_LIMIT, ARSLATE_MODEL, ARSLATE_EFFORT.
// The site falls back to its offline dictionary whenever this API says no.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, userMessage } from "./prompt.js";

export const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_CHARS = 600;
const CACHE_TTL = 60 * 60 * 24;
// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Browsers always send Origin on cross-site requests; a disallowed one is refused outright. */
function originAllowed(request, env) {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins(env);
  if (allowed.includes("*") || origin === null) return true;
  return origin !== "null" && allowed.includes(origin);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = allowedOrigins(env);
  const headers = {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
  if (allowed.includes("*")) headers["access-control-allow-origin"] = "*";
  else if (origin && origin !== "null" && allowed.includes(origin)) headers["access-control-allow-origin"] = origin;
  return headers;
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/** Daily per-IP quota kept in KV. KV is not atomic, so a burst can slip a few past the limit. */
async function takeQuota(env, request) {
  const limit = parseInt(env.DAILY_LIMIT || "0", 10);
  if (!env.ARSLATE_KV || !limit) return true;
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:${day}:${await sha256(clientIp(request))}`;
  const used = parseInt((await env.ARSLATE_KV.get(key)) || "0", 10);
  if (used >= limit) return false;
  await env.ARSLATE_KV.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

export function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFC").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim();
}

export async function translate({ text, previous, env }) {
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    maxRetries: 1,
    timeout: 20_000,
  });
  const model = env.ARSLATE_MODEL || DEFAULT_MODEL;
  const msg = await client.beta.messages.create({
    model,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage(text, previous) }],
    output_config: { effort: env.ARSLATE_EFFORT || "low" },
    ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
  });
  if (msg.stop_reason === "refusal") return { refused: true, model: msg.model, usage: msg.usage };
  const out = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  return { text: out, model: msg.model, usage: msg.usage, truncated: msg.stop_reason === "max_tokens" };
}

async function handleTranslate(request, env, cors) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503, cors);
  // JSON only: a text/plain body would skip the browser's CORS preflight.
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "bad_request" }, 415, cors);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400, cors);
  }
  const text = cleanText(body && body.text);
  if (!text) return json({ error: "empty" }, 400, cors);
  if (text.length > MAX_CHARS) return json({ error: "too_long", max: MAX_CHARS }, 413, cors);
  const previous = cleanText(body.previous).slice(0, MAX_CHARS * 2) || null;

  // Only first versions are cached; "another version" always asks again.
  const cacheKey = env.ARSLATE_KV && !previous ? `tr:${await sha256(text)}` : null;
  if (cacheKey) {
    const hit = await env.ARSLATE_KV.get(cacheKey);
    if (hit) return json({ text: hit, cached: true }, 200, cors);
  }
  if (!(await takeQuota(env, request))) return json({ error: "daily_limit" }, 429, cors);

  const res = await translate({ text, previous, env });
  // One line per translation for cost tracking (wrangler tail / Workers logs).
  const u = res.usage || {};
  console.log(JSON.stringify({ event: "translate", model: res.model, chars: text.length, refused: Boolean(res.refused), input_tokens: u.input_tokens, output_tokens: u.output_tokens, cache_read: u.cache_read_input_tokens }));
  if (res.refused) return json({ error: "refused" }, 422, cors);
  if (!res.text || res.truncated) return json({ error: "no_text" }, 502, cors);
  if (cacheKey) await env.ARSLATE_KV.put(cacheKey, res.text, { expirationTtl: CACHE_TTL });
  return json({ text: res.text, model: res.model }, 200, cors);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!originAllowed(request, env)) return json({ error: "forbidden_origin" }, 403, cors);
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/api/health" && request.method === "GET") {
        return json(
          {
            ok: true,
            ai: Boolean(env.ANTHROPIC_API_KEY),
            model: env.ARSLATE_MODEL || DEFAULT_MODEL,
            cache: Boolean(env.ARSLATE_KV),
            daily_limit: parseInt(env.DAILY_LIMIT || "0", 10) || null,
          },
          200,
          cors,
        );
      }
      if (pathname === "/api/translate" && request.method === "POST") return await handleTranslate(request, env, cors);
      return json({ error: "not_found" }, 404, cors);
    } catch (err) {
      console.error("request failed", err && err.message);
      return json({ error: "server_error" }, 500, cors);
    }
  },
};
