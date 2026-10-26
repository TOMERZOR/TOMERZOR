// What happens when a DM arrives on Instagram, and when the creator approves
// a draft.

import { normalizeState, disclosureLine } from "../../core/defaults.js";
import { generateReply } from "../../core/reply.js";
import { sendText, fanProfile } from "./instagram.js";

const DEFAULT_PAUSE_HOURS = 12;

function pauseMs(env) {
  return (Number(env.KOLI_PAUSE_HOURS) || DEFAULT_PAUSE_HOURS) * 3600 * 1000;
}

/**
 * Handle one parsed webhook event.
 * @param {object} deps {env, store, ask, fetchImpl, now}
 */
export async function handleEvent(ev, { env, store, ask, fetchImpl = fetch, now = Date.now() }) {
  if (await store.seen(ev.mid)) return { skipped: "duplicate" };
  const raw = await store.getConfig();
  if (!raw) return { skipped: "no_config" };
  const state = normalizeState(raw);
  const conv = await store.getConversation(ev.fanId);

  if (ev.echo) {
    // Koli's own message coming back, or the creator typing in the Instagram app.
    if (await store.wasSent(ev.mid)) return { skipped: "own_echo" };
    conv.messages.push({ from: "creator", text: ev.text, at: ev.at });
    conv.pausedUntil = now + pauseMs(env); // the creator took over: step aside
    conv.needsHuman = false;
    conv.draft = null;
    await store.saveConversation(conv);
    return { paused: true };
  }

  if (!conv.fanName && env.IG_ACCESS_TOKEN) {
    const p = await fanProfile(env, ev.fanId, fetchImpl);
    if (p) Object.assign(conv, { fanName: p.name, username: p.username });
  }
  const history = conv.messages.filter((m) => !m.draft);
  conv.messages.push({ from: "fan", text: ev.text, at: ev.at, storyId: ev.storyId || undefined });
  await store.bump({ incoming: 1 });

  if (conv.pausedUntil > now) {
    await store.saveConversation(conv);
    return { skipped: "paused" };
  }

  const reply = await generateReply({ state, history, text: ev.text, fanName: conv.fanName, storyId: ev.storyId, lastCampaignId: conv.lastCampaignId, ask, now: new Date(now) });
  if (reply.campaign_id) conv.lastCampaignId = reply.campaign_id;
  const meta = { campaignId: reply.campaign_id, intent: reply.intent, confidence: reply.confidence, handoff: reply.handoff, handoffReason: reply.handoff_reason, note: reply.note, detection: reply.detection };
  await store.bump({ [`intent:${reply.intent}`]: 1, ...(reply.campaign_id ? { [`campaign:${reply.campaign_id}`]: 1 } : {}), ...(reply.handoff ? { handoffs: 1 } : {}) });

  if (state.controls.mode !== "auto") {
    conv.draft = { messages: reply.messages, meta, fanText: ev.text, at: now };
    conv.needsHuman = reply.handoff;
    await store.saveConversation(conv);
    return { draft: conv.draft };
  }

  await deliver(conv, reply.messages, meta, { env, store, fetchImpl, now });
  if (reply.handoff) {
    conv.needsHuman = true;
    conv.pausedUntil = now + pauseMs(env);
  }
  await store.saveConversation(conv);
  return { sent: reply.messages, meta };
}

async function deliver(conv, messages, meta, { env, store, fetchImpl, now }) {
  for (const text of messages) {
    const mid = await sendText(env, conv.id, text, fetchImpl);
    await store.markSent(mid);
    conv.messages.push({ from: "bot", text, at: now, mid, meta });
  }
  await store.bump({ replies: 1 });
}

/**
 * The creator approved (and maybe edited) a draft, or wrote a reply in Koli.
 * An edited reply is saved as an example so the clone learns from it.
 */
export async function approveAndSend(convId, { messages, learn }, { env, store, fetchImpl = fetch, now = Date.now() }) {
  const conv = await store.getConversation(convId);
  const clean = (messages || []).map((m) => String(m).trim()).filter(Boolean);
  if (!clean.length) throw Object.assign(new Error("empty"), { status: 400 });
  const meta = conv.draft?.meta || null;
  const fanText = conv.draft?.fanText || [...conv.messages].reverse().find((m) => m.from === "fan")?.text || "";
  await deliver(conv, clean, meta, { env, store, fetchImpl, now });
  const edited = conv.draft && clean.join("\n") !== conv.draft.messages.join("\n");
  conv.draft = null;
  conv.needsHuman = false;
  await store.saveConversation(conv);

  if (learn !== false && edited && fanText) {
    const raw = await store.getConfig();
    if (raw) {
      const state = normalizeState(raw);
      const reply = clean.join(" / ").replace(disclosureLine(state), "").trim();
      state.persona.corrections = [...state.persona.corrections, { fan: fanText, reply, at: now }].slice(-50);
      await store.setConfig(state);
    }
  }
  return { sent: clean, learned: Boolean(edited) };
}
