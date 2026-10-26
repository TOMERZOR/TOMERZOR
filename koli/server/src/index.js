// Koli API (Cloudflare Worker). Routes:
//   GET  /api/health                     what this deployment can do
//   GET  /api/config  PUT /api/config     the creator's voice, dials and campaigns
//   POST /api/reply                      reply to a test message (the simulator)
//   POST /api/analyze                    learn the voice from samples
//   GET  /api/conversations              real Instagram conversations
//   GET  /api/conversations/:id
//   POST /api/conversations/:id/send     approve a draft or send a reply
//   POST /api/conversations/:id/resume   let Koli answer this fan again
//   GET  /api/stats
//   GET  /webhook/instagram              Meta's subscription check
//   POST /webhook/instagram              incoming DMs
//
// Bindings: ANTHROPIC_API_KEY, KOLI_ADMIN_TOKEN, IG_APP_SECRET,
// IG_ACCESS_TOKEN, IG_VERIFY_TOKEN (secrets); KOLI_KV (KV namespace);
// KOLI_MODEL, KOLI_EFFORT, KOLI_PAUSE_HOURS, IG_GRAPH_VERSION (vars).

import { normalizeState } from "../../core/defaults.js";
import { generateReply } from "../../core/reply.js";
import { buildAnalyzePrompt, PROFILE_SCHEMA, extractJson } from "../../core/prompt.js";
import { makeAsk, KoliError, DEFAULT_MODEL } from "./claude.js";
import { verifySignature, parseEvents } from "./instagram.js";
import { Store } from "./store.js";
import { handleEvent, approveAndSend } from "./inbox.js";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS } });
}

function isLocal(url) {
  return ["localhost", "127.0.0.1"].includes(url.hostname);
}

/** Admin calls need the token. Without one set, only a local run is open. */
function authorized(request, env, url) {
  if (!env.KOLI_ADMIN_TOKEN) return isLocal(url);
  const given = request.headers.get("authorization") || "";
  return given === `Bearer ${env.KOLI_ADMIN_TOKEN}`;
}

async function body(request) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) throw new KoliError("bad_request", "יש לשלוח JSON.", 415);
  try {
    return await request.json();
  } catch {
    throw new KoliError("bad_request", "JSON לא תקין.", 400);
  }
}

function needClaude(env) {
  if (!env.ANTHROPIC_API_KEY) throw new KoliError("not_configured", "חסר ANTHROPIC_API_KEY בשרת.", 503);
}

async function webhook(request, env, ctx, url) {
  if (request.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && env.IG_VERIFY_TOKEN && url.searchParams.get("hub.verify_token") === env.IG_VERIFY_TOKEN;
    return ok ? new Response(url.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  const raw = await request.text();
  if (!(await verifySignature(raw, request.headers.get("x-hub-signature-256"), env.IG_APP_SECRET))) return new Response("bad signature", { status: 401 });
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const events = parseEvents(payload);
  if (events.length && env.ANTHROPIC_API_KEY) {
    const store = new Store(env);
    const ask = makeAsk(env);
    // Answer Meta right away; the replies are written in the background.
    ctx.waitUntil(
      (async () => {
        for (const ev of events) {
          try {
            await handleEvent(ev, { env, store, ask });
          } catch (err) {
            console.error("koli: event failed", ev.mid, err?.message || err);
          }
        }
      })(),
    );
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}

async function api(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const store = new Store(env);

  if (pathname === "/api/health") {
    return json({
      ok: true,
      claude: Boolean(env.ANTHROPIC_API_KEY),
      instagram: Boolean(env.IG_ACCESS_TOKEN && env.IG_APP_SECRET && env.IG_VERIFY_TOKEN),
      storage: env.KOLI_KV ? "kv" : "memory",
      auth: Boolean(env.KOLI_ADMIN_TOKEN),
      model: env.KOLI_MODEL || DEFAULT_MODEL,
    });
  }
  if (!authorized(request, env, url)) return json({ error: "unauthorized", message: "קוד הגישה לשרת שגוי או חסר." }, 401);

  if (pathname === "/api/config" && method === "GET") return json({ state: await store.getConfig() });
  if (pathname === "/api/config" && method === "PUT") {
    const { state } = await body(request);
    await store.setConfig(normalizeState(state));
    return json({ ok: true });
  }
  if (pathname === "/api/reply" && method === "POST") {
    needClaude(env);
    const b = await body(request);
    const state = normalizeState(b.state || (await store.getConfig()));
    const reply = await generateReply({ state, history: b.history || [], text: String(b.text || "").slice(0, 2000), fanName: b.fanName, storyId: b.storyId, lastCampaignId: b.lastCampaignId, ask: makeAsk(env) });
    return json({ reply });
  }
  if (pathname === "/api/analyze" && method === "POST") {
    needClaude(env);
    const { persona } = await body(request);
    const ask = makeAsk(env, { effort: "medium", maxTokens: 16000 });
    const raw = await ask({ system: "You are an expert in voice, tone and Hebrew social-media writing.", turn: buildAnalyzePrompt(persona || {}), schema: PROFILE_SCHEMA });
    return json({ profile: JSON.parse(extractJson(raw)) });
  }
  if (pathname === "/api/conversations" && method === "GET") return json({ conversations: await store.listConversations() });
  if (pathname === "/api/stats" && method === "GET") return json({ stats: await store.stats() });

  const m = pathname.match(/^\/api\/conversations\/([^/]+)(?:\/(send|resume))?$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!m[2] && method === "GET") return json({ conversation: await store.getConversation(id) });
    if (m[2] === "send" && method === "POST") {
      if (!env.IG_ACCESS_TOKEN) throw new KoliError("not_configured", "אינסטגרם לא מחובר לשרת.", 503);
      return json(await approveAndSend(id, await body(request), { env, store }));
    }
    if (m[2] === "resume" && method === "POST") {
      const conv = await store.getConversation(id);
      Object.assign(conv, { pausedUntil: 0, needsHuman: false });
      await store.saveConversation(conv);
      return json({ ok: true });
    }
  }
  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname === "/webhook/instagram") return await webhook(request, env, ctx, url);
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      return json({ error: "not_found" }, 404);
    } catch (err) {
      if (err instanceof KoliError) return json({ error: err.code, message: err.message }, err.status);
      if (err?.status === 400) return json({ error: "bad_request", message: err.message }, 400);
      console.error("koli:", err);
      return json({ error: "server_error", message: "שגיאה בשרת." }, 500);
    }
  },
};
