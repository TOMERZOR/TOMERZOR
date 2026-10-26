// How the app reaches Claude. Two ways, picked automatically:
//  - "claude": opened as a claude.ai artifact, Koli asks the viewer's own
//    Claude through the artifact's `sample` capability (no key, no server).
//  - "server": the Koli API (server/), locally with `node tools/serve.mjs` or
//    deployed to Cloudflare. This is also what answers on Instagram.

import { generateReply } from "../core/reply.js";
import { buildAnalyzePrompt, PROFILE_SCHEMA, asSinglePrompt } from "../core/prompt.js";
import { store } from "./store.js";

export const engine = { kind: "none", health: null, sample: null, label: "לא מחובר ל-Claude" };

function apiBase() {
  return (store.settings.apiBase || "").replace(/\/+$/, "");
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (store.settings.token) headers.authorization = `Bearer ${store.settings.token}`;
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("אין חיבור לשרת של קולי. בדקו את הכתובת בלשונית החיבור.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `השרת החזיר שגיאה ${res.status}.`);
  return data;
}

/** Look for a way to reach Claude. Call again after the server settings change. */
export async function detectEngine() {
  engine.health = null;
  try {
    const health = await api("/api/health");
    if (health?.ok) engine.health = health;
  } catch {
    /* no server here */
  }
  if (engine.health?.claude) {
    Object.assign(engine, { kind: "server", label: apiBase() ? "מחובר לשרת של קולי" : "מחובר לשרת המקומי" });
    return engine;
  }
  if (!engine.sample && window.claude?.use) {
    try {
      engine.sample = await window.claude.use("sample");
    } catch {
      engine.sample = null;
    }
  }
  if (engine.sample) Object.assign(engine, { kind: "claude", label: "עובד עם ה-Claude שלך" });
  else Object.assign(engine, { kind: "none", label: engine.health ? "השרת בלי מפתח Claude" : "לא מחובר ל-Claude" });
  return engine;
}

function sampleError(err) {
  const map = {
    not_granted: "כדי שקולי תענה, צריך לאשר לה להשתמש ב-Claude שלך.",
    rate_limited: "יותר מדי בקשות ברצף. חכו רגע ונסו שוב.",
    cancelled: "הבקשה בוטלה.",
  };
  return new Error(map[err?.code] || err?.message || "Claude לא ענה. נסו שוב.");
}

async function askSample({ system, turn, schema }) {
  try {
    return await engine.sample.json(asSinglePrompt(system, turn, schema), { cache: false, modelTier: "default" });
  } catch (err) {
    throw sampleError(err);
  }
}

function needEngine() {
  if (engine.kind === "none") throw new Error("קולי עוד לא מחוברת ל-Claude. פתחו את לשונית החיבור.");
}

/** Reply to one fan message with the current settings. */
export async function reply({ history, text, fanName, storyId, lastCampaignId, state = store.state }) {
  needEngine();
  if (engine.kind === "server") {
    const { reply } = await api("/api/reply", { method: "POST", body: { state, history, text, fanName, storyId, lastCampaignId } });
    return reply;
  }
  return await generateReply({ state, history, text, fanName, storyId, lastCampaignId, ask: askSample });
}

/** Learn the voice profile from the collected samples. */
export async function analyze(persona) {
  needEngine();
  if (engine.kind === "server") return (await api("/api/analyze", { method: "POST", body: { persona } })).profile;
  return await askSample({ system: "You are an expert in voice, tone and Hebrew social-media writing.", turn: buildAnalyzePrompt(persona), schema: PROFILE_SCHEMA });
}
