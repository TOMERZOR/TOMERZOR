// Easy2Study API (Cloudflare Worker). Routes:
//   GET  /api/health   what this deployment can do
//   POST /api/lesson   {profile, subject?, topic?, material?, image?, when?} -> {lesson}
//   POST /api/help     {profile, lesson, bite, kind, word?, question?, previous?} -> {text, example}
//
// Bindings (all optional except the key): ANTHROPIC_API_KEY (secret),
// E2S_KV (KV namespace for daily limits), ALLOWED_ORIGINS, DAILY_LESSONS,
// DAILY_HELP, E2S_MODEL, LESSON_EFFORT, HELP_EFFORT.
// The site falls back to its built-in lessons and help whenever this API says no.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, LESSON_SCHEMA, HELP_SCHEMA, lessonMessage, helpMessage } from "./prompt.js";

export const DEFAULT_MODEL = "claude-opus-5-5";
// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
const LIMITS = { topic: 200, material: 8000, image: 3_000_000, question: 400, word: 60, bite: 1500 };
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const HELP_KINDS = new Set(["simpler", "again", "example", "word", "answer"]);

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
async function takeQuota(env, request, kind) {
  const limit = parseInt((kind === "lesson" ? env.DAILY_LESSONS : env.DAILY_HELP) || "0", 10);
  if (!env.E2S_KV || !limit) return true;
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:${kind}:${day}:${await sha256(clientIp(request))}`;
  const used = parseInt((await env.E2S_KV.get(key)) || "0", 10);
  if (used >= limit) return false;
  await env.E2S_KV.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

export function cleanText(value, max) {
  if (typeof value !== "string") return "";
  const s = value.normalize("NFC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim();
  return max ? s.slice(0, max) : s;
}

const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
const strList = (v, n, max) => (Array.isArray(v) ? v.map((x) => cleanText(x, max)).filter(Boolean).slice(0, n) : []);

/** Only the fields the tutor needs, in known shapes. */
export function cleanProfile(p) {
  p = p && typeof p === "object" ? p : {};
  const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
  return {
    age: int(p.age, 4, 120, null),
    grade: cleanText(p.grade, 20) || null,
    gender: pick(p.gender, ["m", "f"], "m") === "f" ? "feminine" : "masculine",
    laziness: int(p.laziness, 1, 5, 3),
    focus_minutes: int(p.focus_minutes, 1, 120, 10),
    max_sentences: int(p.max_sentences, 1, 6, 3),
    styles: strList(p.styles, 8, 40),
    needs: strList(p.needs, 8, 20),
    interests: strList(p.interests, 10, 40),
    tone: pick(p.tone, ["friend", "calm", "short"], "friend"),
  };
}

function client(env) {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    maxRetries: 1,
    timeout: 100_000,
  });
}

/** One structured call. Returns {data} or {refused} or {error}. */
export async function ask({ env, content, schema, effort, maxTokens }) {
  const model = env.E2S_MODEL || DEFAULT_MODEL;
  const msg = await client(env).beta.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort, format: { type: "json_schema", schema } },
    ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
  });
  const u = msg.usage || {};
  const usage = { model: msg.model, input_tokens: u.input_tokens, output_tokens: u.output_tokens, cache_read: u.cache_read_input_tokens };
  if (msg.stop_reason === "refusal") return { refused: true, usage };
  if (msg.stop_reason === "max_tokens") return { error: "truncated", usage };
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return { data: JSON.parse(text), usage };
  } catch {
    return { error: "bad_json", usage };
  }
}

async function readJson(request) {
  // JSON only: a text/plain body would skip the browser's CORS preflight.
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return { error: ["bad_request", 415] };
  try {
    return { body: await request.json() };
  } catch {
    return { error: ["bad_request", 400] };
  }
}

async function handleLesson(request, env, cors) {
  const { body, error } = await readJson(request);
  if (error) return json({ error: error[0] }, error[1], cors);
  const topic = cleanText(body.topic, LIMITS.topic);
  const rawMaterial = cleanText(body.material);
  if (rawMaterial.length > LIMITS.material) return json({ error: "too_long", max: LIMITS.material }, 413, cors);
  const material = rawMaterial || null;
  let image = null;
  if (body.image) {
    const { media_type: type, data } = body.image;
    if (!IMAGE_TYPES.has(type) || typeof data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(data)) return json({ error: "bad_image" }, 400, cors);
    if (data.length > LIMITS.image) return json({ error: "image_too_large" }, 413, cors);
    image = { type, data };
  }
  if (!topic && !material && !image) return json({ error: "empty" }, 400, cors);
  if (!(await takeQuota(env, request, "lesson"))) return json({ error: "daily_limit" }, 429, cors);

  const text = lessonMessage({
    profile: cleanProfile(body.profile),
    subject: cleanText(body.subject, 40) || null,
    topic: topic || null,
    material,
    when: pick(body.when, ["today", "tomorrow", "week", "later", "unknown"], null),
  });
  const content = image
    ? [{ type: "image", source: { type: "base64", media_type: image.type, data: image.data } }, { type: "text", text: `<material_photo>The image above is the learner's study material.</material_photo>\n${text}` }]
    : text;
  const res = await ask({ env, content, schema: LESSON_SCHEMA, effort: env.LESSON_EFFORT || "medium", maxTokens: 16000 });
  // One line per request for cost tracking (wrangler tail / Workers logs).
  console.log(JSON.stringify({ event: "lesson", image: Boolean(image), chars: (material || "").length, refused: Boolean(res.refused), error: res.error || null, ...res.usage }));
  if (res.refused) return json({ error: "refused" }, 422, cors);
  if (res.error || !res.data || !Array.isArray(res.data.bites) || !res.data.bites.length) return json({ error: "no_lesson" }, 502, cors);
  return json({ lesson: res.data, model: res.usage.model }, 200, cors);
}

async function handleHelp(request, env, cors) {
  const { body, error } = await readJson(request);
  if (error) return json({ error: error[0] }, error[1], cors);
  const kind = HELP_KINDS.has(body.kind) ? body.kind : null;
  const bite = body.bite || {};
  const biteText = cleanText(bite.text, LIMITS.bite);
  if (!kind || !biteText) return json({ error: "bad_request" }, 400, cors);
  const word = cleanText(body.word, LIMITS.word) || null;
  const question = cleanText(body.question, LIMITS.question) || null;
  if (kind === "word" && !word) return json({ error: "bad_request" }, 400, cors);
  if (kind === "answer" && !question) return json({ error: "bad_request" }, 400, cors);
  if (!(await takeQuota(env, request, "help"))) return json({ error: "daily_limit" }, 429, cors);

  const lesson = body.lesson || {};
  const content = helpMessage({
    profile: cleanProfile(body.profile),
    lesson: { title: cleanText(lesson.title, 120) || "שיעור", subject: cleanText(lesson.subject, 40) || null },
    bite: { title: cleanText(bite.title, 200), text: biteText },
    kind,
    word,
    question,
    previous: strList(body.previous, 3, LIMITS.bite),
  });
  const res = await ask({ env, content, schema: HELP_SCHEMA, effort: env.HELP_EFFORT || "low", maxTokens: 4000 });
  console.log(JSON.stringify({ event: "help", kind, refused: Boolean(res.refused), error: res.error || null, ...res.usage }));
  if (res.refused) return json({ error: "refused" }, 422, cors);
  const text = res.data && cleanText(res.data.text);
  if (res.error || !text) return json({ error: "no_text" }, 502, cors);
  return json({ text, example: cleanText(res.data.example) }, 200, cors);
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
            model: env.E2S_MODEL || DEFAULT_MODEL,
            limits: Boolean(env.E2S_KV),
            daily_lessons: parseInt(env.DAILY_LESSONS || "0", 10) || null,
            daily_help: parseInt(env.DAILY_HELP || "0", 10) || null,
          },
          200,
          cors,
        );
      }
      const route = request.method === "POST" && { "/api/lesson": handleLesson, "/api/help": handleHelp }[pathname];
      if (route) {
        if (!env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503, cors);
        return await route(request, env, cors);
      }
      return json({ error: "not_found" }, 404, cors);
    } catch (err) {
      console.error("request failed", err && err.message);
      return json({ error: "server_error" }, 500, cors);
    }
  },
};
