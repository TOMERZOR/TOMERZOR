// Pieces shared by the simulator and the real Instagram inbox.

import { h } from "../dom.js";
import { INTENTS, disclosureLine } from "../../core/defaults.js";
import { activeCampaigns } from "../../core/context.js";
import { store } from "../store.js";

export function campaignName(id) {
  const c = store.state.campaigns.find((x) => x.id === id);
  return c ? c.name || c.product || c.brand || id : id;
}

/** The chips under a reply: campaign, intent, confidence, handoff, note. */
export function metaChips(meta, extra) {
  if (!meta) return null;
  return h(
    "div",
    { class: "meta" },
    meta.handoff && h("span", { class: "chip danger" }, `צריך אותך: ${meta.handoffReason || meta.handoff_reason || "להעביר ליוצר/ת"}`),
    meta.campaignId ? h("span", { class: "chip accent" }, `קמפיין: ${campaignName(meta.campaignId)}`) : h("span", { class: "chip" }, "בלי קמפיין"),
    meta.intent && h("span", { class: "chip" }, INTENTS[meta.intent] || meta.intent),
    meta.confidence !== undefined && h("span", { class: "chip mono", title: "כמה קולי בטוחה בזיהוי הקמפיין" }, `${Math.round(meta.confidence * 100)}%`),
    extra,
    meta.note && h("p", { class: "note" }, `הערה לך: ${meta.note}`),
  );
}

export function metaFromReply(r) {
  return { campaignId: r.campaign_id, intent: r.intent, confidence: r.confidence, handoff: r.handoff, handoffReason: r.handoff_reason, note: r.note, detection: r.detection };
}

/** Stories of the active campaigns, for the "replying to a story" menu. */
export function storyOptions() {
  const out = [];
  for (const c of activeCampaigns(store.state.campaigns)) {
    for (const s of c.stories || []) out.push({ id: s.id, label: `${c.name || c.product}: ${s.text.slice(0, 48)}${s.text.length > 48 ? "…" : ""}`, text: s.text });
  }
  return out;
}

export function findStoryText(id) {
  for (const c of store.state.campaigns) for (const s of c.stories || []) if (s.id === id || (s.storyId && s.storyId === id)) return s.text;
  return "";
}

/** Save an approved or corrected reply as an example the clone learns from. */
export function learn(fan, replyText) {
  const reply = replyText.replace(disclosureLine(store.state), "").trim();
  if (!fan || !reply) return;
  store.update((s) => {
    s.persona.corrections = [...s.persona.corrections, { fan, reply, at: Date.now() }].slice(-50);
  });
}

/** Draft card: editable bubbles plus approve / skip. */
export function draftCard({ draft, onSend, onSkip }) {
  const areas = draft.messages.map((m, i) => h("textarea", { id: `draft-${i}`, rows: Math.min(8, Math.max(2, m.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 48)), 0))), value: m, "aria-label": `בועה ${i + 1}` }));
  const send = h("button", { type: "button", class: "btn" }, "שליחה");
  send.addEventListener("click", () => onSend(areas.map((a) => a.value.trim()).filter(Boolean), send));
  return h(
    "div",
    { class: `draft${draft.meta?.handoff ? " handoff" : ""}` },
    h("p", { class: "label" }, draft.meta?.handoff ? "טיוטה, ולדעת קולי כדאי שתעני בעצמך" : "טיוטה לאישור. אפשר לערוך, וקולי לומדת מכל תיקון."),
    areas,
    h("div", { class: "row" }, send, h("button", { type: "button", class: "btn quiet", onclick: onSkip }, "לא לשלוח")),
  );
}
