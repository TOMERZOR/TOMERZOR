// The simulator: play a fan, see what Koli answers, approve or fix it.
// Same pipeline and prompts as the real Instagram inbox.

import { h, toast } from "../dom.js";
import { store, uid } from "../store.js";
import { reply as askReply, engine } from "../engine.js";
import { SAMPLE_MESSAGES } from "../demo.js";
import { metaChips, metaFromReply, storyOptions, findStoryText, learn, draftCard, campaignName } from "./common.js";

const FAN_NAMES = ["שירה", "נוי", "דניאל", "יעל", "אור", "תמר", "עדי", "רוני"];
let currentId = null;
let composerText = "";
let composerStory = "";
let pending = false;
let fixing = null; // index of the bot message being corrected

function current() {
  return store.sims.find((s) => s.id === currentId) || null;
}

function newSim() {
  const sim = { id: uid("sim"), fanName: FAN_NAMES[store.sims.length % FAN_NAMES.length], messages: [], lastCampaignId: null, draft: null, createdAt: Date.now() };
  store.sims.unshift(sim);
  store.saveSims();
  currentId = sim.id;
  return sim;
}

function stats() {
  let answered = 0;
  let handoffs = 0;
  const byCampaign = new Map();
  for (const s of store.sims) {
    for (const m of s.messages) {
      if (m.from !== "bot" || !m.meta) continue;
      answered++;
      if (m.meta.handoff) handoffs++;
      if (m.meta.campaignId) byCampaign.set(m.meta.campaignId, (byCampaign.get(m.meta.campaignId) || 0) + 1);
    }
  }
  const top = [...byCampaign.entries()].sort((a, b) => b[1] - a[1])[0];
  return h(
    "div",
    { class: "stat" },
    h("div", {}, h("b", {}, store.sims.length), h("span", {}, "שיחות בסימולטור")),
    h("div", {}, h("b", {}, answered), h("span", {}, "תשובות של קולי")),
    h("div", {}, h("b", {}, handoffs), h("span", {}, "הועברו אלייך")),
    h("div", {}, h("b", {}, store.state.persona.corrections.length), h("span", {}, "תיקונים שנלמדו")),
    top && h("div", {}, h("b", {}, top[1]), h("span", {}, `על ${campaignName(top[0])}`)),
  );
}

export function renderInbox(root, rerender) {
  // Always open on a conversation ready for a first message.
  if (!store.sims.length) newSim();
  if (!current()) currentId = store.sims[0].id;
  const sim = current();
  const mode = store.state.controls.mode;

  const threadList = h(
    "div",
    { class: "threads" },
    h("button", { type: "button", class: "btn ghost", onclick: () => { newSim(); rerender(); } }, "+ שיחה חדשה עם מעריץ/ה"),
    store.sims.map((s) => {
      const last = s.messages[s.messages.length - 1];
      const needs = s.draft?.meta?.handoff || s.messages.some((m) => m.meta?.handoff);
      return h(
        "button",
        { type: "button", class: "thread", "aria-current": s.id === currentId ? "true" : "false", onclick: () => { currentId = s.id; fixing = null; rerender(); } },
        h("span", { class: "who" }, s.fanName || "מעריץ/ה", s.draft && h("span", { class: "chip accent" }, "טיוטה"), needs && h("span", { class: "chip danger" }, "צריך אותך")),
        h("span", { class: "last" }, last ? `${last.from === "fan" ? "" : "את/ה: "}${last.text}` : "שיחה ריקה"),
      );
    }),
  );

  root.append(
    h("p", { class: "intro" }, "כאן מנסים את קולי לפני שהיא עונה באמת. כתבו כמו מעריץ/ה, אפשר גם כתגובה לסטורי של קמפיין, ותראו מה קולי עונה, על איזה קמפיין היא חושבת ששואלים, ומתי היא מעבירה אלייך."),
    h("section", { class: "card" }, stats()),
    h("div", { class: "inbox" }, threadList, chat(sim, mode, rerender)),
  );
}

function chat(sim, mode, rerender) {
  const nameInput = h("input", { id: "fan-name", value: sim.fanName, "aria-label": "שם המעריץ/ה", oninput: (e) => { sim.fanName = e.target.value; store.saveSims(); } });
  const msgs = h("div", { class: "messages", "aria-live": "polite" });

  sim.messages.forEach((m, i) => {
    if (m.storyId) msgs.append(h("div", { class: "story-ref" }, `הגיב/ה לסטורי: ${findStoryText(m.storyId) || "סטורי"}`));
    if (fixing === i) {
      msgs.append(fixEditor(sim, i, rerender));
      return;
    }
    msgs.append(h("div", { class: `msg ${m.from}` }, m.text));
    const nextIsSameGroup = sim.messages[i + 1]?.from === "bot" && sim.messages[i + 1]?.group === m.group;
    if (m.from === "bot" && m.meta && !nextIsSameGroup) {
      msgs.append(metaChips(m.meta, h("button", { type: "button", class: "fix", onclick: () => { fixing = i; rerender(); } }, "תיקון")));
    }
  });
  if (sim.draft) {
    msgs.append(metaChips(sim.draft.meta));
    msgs.append(
      draftCard({
        draft: sim.draft,
        onSend: (messages) => {
          if (!messages.length) return toast("אין מה לשלוח");
          const edited = messages.join("\n") !== sim.draft.messages.join("\n");
          const group = uid("g");
          messages.forEach((text) => sim.messages.push({ from: "bot", text, meta: sim.draft.meta, group }));
          if (edited) {
            learn(sim.draft.fanText, messages.join(" / "));
            toast("נשלח. קולי שמרה את התיקון ותלמד ממנו.");
          }
          sim.draft = null;
          store.saveSims();
          rerender();
        },
        onSkip: () => {
          sim.draft = null;
          store.saveSims();
          rerender();
        },
      }),
    );
  }
  if (pending) msgs.append(h("div", { class: "typing", "aria-label": "קולי כותבת" }, h("i"), h("i"), h("i")));
  if (!sim.messages.length && !pending) msgs.append(h("div", { class: "empty" }, h("p", {}, "שלחו הודעה כמו מעריץ/ה, או בחרו אחת מהדוגמאות למטה.")));
  if (sim.failed && !pending) {
    msgs.append(h("div", { class: "meta" }, h("span", { class: "chip danger" }, sim.failed), h("button", { type: "button", class: "fix", onclick: () => retry(sim, rerender) }, "לנסות שוב")));
  }

  const stories = storyOptions();
  const storySelect = h(
    "select",
    { id: "story-ref", "aria-label": "מגיב/ה לסטורי", onchange: (e) => (composerStory = e.target.value) },
    h("option", { value: "" }, "הודעה רגילה (לא תגובה לסטורי)"),
    stories.map((s) => h("option", { value: s.id }, `תגובה לסטורי · ${s.label}`)),
  );
  storySelect.value = stories.some((s) => s.id === composerStory) ? composerStory : "";
  const box = h("textarea", { id: "fan-text", rows: 2, placeholder: `כתבו כמו ${sim.fanName || "מעריץ/ה"}…`, value: composerText, oninput: (e) => (composerText = e.target.value) });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(sim, rerender);
    }
  });
  const sendBtn = h("button", { type: "button", class: "btn", disabled: pending || engine.kind === "none", onclick: () => send(sim, rerender) }, "שליחה");

  const head = h(
    "div",
    { class: "chat-head" },
    h("span", { class: "avatar", "aria-hidden": "true" }, (sim.fanName || "?").slice(0, 1)),
    nameInput,
    h("span", { class: "spacer" }),
    h("span", { class: "chip" }, mode === "auto" ? "מצב: עונה לבד" : "מצב: טיוטות לאישור"),
    h("button", { type: "button", class: "btn quiet small", onclick: () => { store.sims = store.sims.filter((s) => s.id !== sim.id); store.saveSims(); currentId = null; rerender(); } }, "מחיקה"),
  );

  const composer = h(
    "div",
    { class: "composer" },
    engine.kind === "none" && h("p", { class: "chip danger" }, "קולי לא מחוברת ל-Claude. ראו בלשונית החיבור."),
    h("div", { class: "samples", "aria-label": "הודעות לדוגמה" }, SAMPLE_MESSAGES.map((s) => h("button", { type: "button", onclick: () => { composerText = s.text; composerStory = stories.some((x) => x.id === s.story) ? s.story : ""; rerender(); document.getElementById("fan-text")?.focus(); } }, s.text))),
    storySelect,
    h("div", { class: "send" }, box, sendBtn),
    h("p", { class: "as" }, `את/ה כותב/ת בתור ${sim.fanName || "מעריץ/ה"}. Enter לשליחה, Shift+Enter לשורה חדשה.`),
  );

  requestAnimationFrame(() => (msgs.scrollTop = msgs.scrollHeight));
  return h("section", { class: "chat" }, head, msgs, composer);
}

function fixEditor(sim, i, rerender) {
  // Correct an answer Koli already sent (auto mode); the fix becomes an example.
  const group = sim.messages[i].group;
  const idxs = sim.messages.map((m, j) => (m.from === "bot" && m.group === group ? j : -1)).filter((j) => j >= 0);
  const fanText = [...sim.messages.slice(0, idxs[0])].reverse().find((m) => m.from === "fan")?.text || "";
  const area = h("textarea", { id: "fix-text", rows: 4, value: idxs.map((j) => sim.messages[j].text).join("\n\n") });
  return h(
    "div",
    { class: "draft" },
    h("p", { class: "label" }, "איך היית עונה? קולי תשמור את זה כדוגמה."),
    area,
    h(
      "div",
      { class: "row" },
      h("button", {
        type: "button",
        class: "btn",
        onclick: () => {
          const parts = area.value.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
          if (!parts.length) return;
          const meta = sim.messages[idxs[0]].meta;
          sim.messages.splice(idxs[0], idxs.length, ...parts.map((text) => ({ from: "bot", text, meta, group })));
          learn(fanText, parts.join(" / "));
          fixing = null;
          store.saveSims();
          toast("נשמר. קולי תלמד מהתיקון.");
          rerender();
        },
      }, "שמירת התיקון"),
      h("button", { type: "button", class: "btn quiet", onclick: () => { fixing = null; rerender(); } }, "ביטול"),
    ),
  );
}

async function send(sim, rerender) {
  const text = composerText.trim();
  if (!text || pending) return;
  sim.messages.push({ from: "fan", text, storyId: composerStory || undefined });
  composerText = "";
  const storyId = composerStory;
  composerStory = "";
  await answer(sim, text, storyId, rerender);
}

function retry(sim, rerender) {
  const last = [...sim.messages].reverse().find((m) => m.from === "fan");
  if (last) answer(sim, last.text, last.storyId, rerender, true);
}

async function answer(sim, text, storyId, rerender, isRetry = false) {
  sim.failed = null;
  sim.draft = null;
  pending = true;
  store.saveSims();
  rerender();
  // History is everything before this fan message.
  const lastFan = sim.messages.length - 1 - [...sim.messages].reverse().findIndex((m) => m.from === "fan");
  const history = sim.messages.slice(0, isRetry ? lastFan : sim.messages.length - 1).map((m) => ({ from: m.from, text: m.text }));
  try {
    const r = await askReply({ history, text, fanName: sim.fanName, storyId, lastCampaignId: sim.lastCampaignId });
    const meta = metaFromReply(r);
    if (r.campaign_id) sim.lastCampaignId = r.campaign_id;
    if (store.state.controls.mode === "auto") {
      const group = uid("g");
      r.messages.forEach((m) => sim.messages.push({ from: "bot", text: m, meta, group }));
    } else {
      sim.draft = { messages: r.messages, meta, fanText: text };
    }
  } catch (err) {
    sim.failed = err.message || "Claude לא ענה";
  } finally {
    pending = false;
    store.saveSims();
    rerender();
  }
}
