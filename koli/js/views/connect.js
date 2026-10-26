// Connect to the Koli server, push the settings to it, follow the Meta setup,
// and work the real Instagram inbox (drafts to approve, chats handed back).

import { h, field, toast, busy, copyText } from "../dom.js";
import { store } from "../store.js";
import { engine, detectEngine, api } from "../engine.js";
import { metaChips, findStoryText, draftCard } from "./common.js";

let realList = null;
let realOpen = null;

function webhookUrl() {
  const base = (store.settings.apiBase || location.origin).replace(/\/+$/, "");
  return `${base}/webhook/instagram`;
}

export function renderConnect(root, rerender) {
  const hl = engine.health;
  const status = h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "מצב החיבור")),
    h(
      "ul",
      { class: "list", style: "max-height:none" },
      h("li", {}, h("div", {}, h("strong", {}, "Claude: "), engine.kind === "server" ? "דרך השרת של קולי" : engine.kind === "claude" ? "דרך חשבון ה-Claude שלך (כאן ב-claude.ai). מספיק לנסות, אבל כדי לענות באינסטגרם צריך שרת." : "לא מחובר. הריצו את השרת (הוראות למטה) או פתחו את קולי ב-claude.ai.")),
      h("li", {}, h("div", {}, h("strong", {}, "שרת: "), hl ? `${hl.storage === "kv" ? "שומר שיחות לאורך זמן" : "שומר בזיכרון בלבד"} · מודל ${hl.model}` : "לא נמצא")),
      h("li", {}, h("div", {}, h("strong", {}, "אינסטגרם: "), hl?.instagram ? "מחובר. הודעות שמגיעות נענות לפי ההגדרות." : "עוד לא. ראו את שלבי ההגדרה למטה.")),
    ),
  );

  const apiInput = h("input", { id: "api-base", type: "url", dir: "ltr", value: store.settings.apiBase, placeholder: "https://koli-api.<you>.workers.dev" });
  const tokenInput = h("input", { id: "api-token", type: "password", dir: "ltr", value: store.settings.token, placeholder: "KOLI_ADMIN_TOKEN", autocomplete: "off" });
  const testBtn = h("button", { type: "button", class: "btn" }, "שמירה ובדיקה");
  testBtn.addEventListener("click", () =>
    busy(testBtn, "בודקת…", async () => {
      store.settings.apiBase = apiInput.value.trim();
      store.settings.token = tokenInput.value.trim();
      store.saveSettings();
      await detectEngine();
      if (engine.health && store.settings.token) await api("/api/config"); // checks the token too
      toast(engine.health ? "השרת עונה" : "לא הצלחתי להגיע לשרת");
      rerender();
    }),
  );
  const pushBtn = h("button", { type: "button", class: "btn ghost", disabled: !hl }, "שליחת ההגדרות לשרת");
  pushBtn.addEventListener("click", () =>
    busy(pushBtn, "שולחת…", async () => {
      await api("/api/config", { method: "PUT", body: { state: store.state } });
      toast("השרת עונה עכשיו עם הקול, האופי והקמפיינים האלה");
    }),
  );
  const pullBtn = h("button", { type: "button", class: "btn quiet", disabled: !hl }, "טעינה מהשרת");
  pullBtn.addEventListener("click", () =>
    busy(pullBtn, "טוענת…", async () => {
      const { state } = await api("/api/config");
      if (!state) return toast("אין עדיין הגדרות בשרת");
      store.replace(state);
      toast("נטען מהשרת, כולל תיקונים שנלמדו מאישורים באינסטגרם");
      rerender();
    }),
  );

  const server = h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "השרת של קולי"), h("p", {}, "השרת מקבל את ההודעות מאינסטגרם ועונה. בהרצה מקומית (node tools/serve.mjs) השאירו את הכתובת ריקה.")),
    h("div", { class: "fields" }, field("כתובת השרת", apiInput), field("קוד גישה", tokenInput, "KOLI_ADMIN_TOKEN שהגדרתם בשרת")),
    h("div", { class: "row" }, testBtn, pushBtn, pullBtn),
    h("p", { class: "hint" }, "חשוב: אחרי כל שינוי בקול, באופי או בקמפיינים, לחצו ״שליחת ההגדרות לשרת״ כדי שהתשובות באינסטגרם יתעדכנו."),
  );

  const copyBtn = h("button", { type: "button", class: "btn quiet small" }, "העתקה");
  copyBtn.addEventListener("click", () => copyText(webhookUrl(), copyBtn));
  const setup = h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "חיבור לאינסטגרם, צעד אחר צעד"), h("p", {}, "דרך ה-API הרשמי של Meta, בלי סיסמאות ובלי סיכון לחשבון. צריך חשבון Creator או Business.")),
    h(
      "ol",
      { class: "steps" },
      h("li", {}, "ב-developers.facebook.com יוצרים אפליקציה מסוג Business ומוסיפים את המוצר Instagram (״API setup with Instagram login״)."),
      h("li", {}, "מחברים את חשבון האינסטגרם, ומייצרים access token עם ההרשאות instagram_business_basic ו-instagram_business_manage_messages."),
      h("li", {}, "בשרת מגדירים את הסודות: ANTHROPIC_API_KEY, KOLI_ADMIN_TOKEN, IG_APP_SECRET, IG_ACCESS_TOKEN ו-IG_VERIFY_TOKEN (מחרוזת שתבחרו). הפירוט ב-README."),
      h("li", {}, "בהגדרות ה-Webhooks של האפליקציה מדביקים את הכתובת הזו, ואת אותו IG_VERIFY_TOKEN, ונרשמים לשדה messages:", h("div", { class: "copy" }, h("code", {}, webhookUrl()), copyBtn)),
      h("li", {}, "באפליקציית אינסטגרם: הגדרות ← הודעות ← כלים מחוברים ← לאפשר גישה להודעות."),
      h("li", {}, "כל עוד האפליקציה במצב פיתוח, היא עונה רק לחשבונות שהוגדרו כבודקים. כדי לענות לכל העוקבים, מגישים את האפליקציה ל-App Review של Meta עם הרשאת ההודעות."),
    ),
    h("p", { class: "hint" }, "Meta מאפשרת תשובה אוטומטית עד 24 שעות מההודעה האחרונה של העוקב/ת, וזה בדיוק המקרה כאן: הם כותבים ראשונים. כשאת/ה עונה בעצמך מהאפליקציה, קולי מזהה את זה ומפסיקה לענות בשיחה הזו ל-12 שעות."),
  );

  root.append(h("p", { class: "intro" }, "כדי שקולי תענה באמת באינסטגרם, היא רצה על שרת קטן (Cloudflare Workers, חינם עד כמות גדולה) שמחובר ל-Claude ולאינסטגרם."), h("div", { class: "grid2" }, status, server), setup, realInbox(rerender), backup(rerender));
}

function realInbox(rerender) {
  const card = h("section", { class: "card" }, h("header", {}, h("h2", {}, "שיחות אמיתיות מאינסטגרם")));
  if (!engine.health) {
    card.append(h("p", { class: "hint" }, "יופיעו כאן כשהשרת מחובר."));
    return card;
  }
  const load = h("button", { type: "button", class: "btn ghost small" }, realList ? "רענון" : "טעינה");
  load.addEventListener("click", () =>
    busy(load, "טוענת…", async () => {
      realList = (await api("/api/conversations")).conversations;
      if (realOpen) realOpen = (await api(`/api/conversations/${encodeURIComponent(realOpen.id)}`)).conversation;
      rerender();
    }),
  );
  card.querySelector("header").append(load);
  if (!realList) return card;
  if (!realList.length) {
    card.append(h("p", { class: "hint" }, "עוד אין הודעות. שלחו הודעה לחשבון מחשבון בודק כדי לנסות."));
    return card;
  }
  card.append(
    h(
      "div",
      { class: "inbox" },
      h(
        "div",
        { class: "threads" },
        realList.map((r) =>
          h(
            "button",
            {
              type: "button",
              class: "thread",
              "aria-current": realOpen?.id === r.id ? "true" : "false",
              onclick: async () => {
                try {
                  realOpen = (await api(`/api/conversations/${encodeURIComponent(r.id)}`)).conversation;
                  rerender();
                } catch (err) {
                  toast(err.message);
                }
              },
            },
            h("span", { class: "who" }, r.fanName || (r.username ? `@${r.username}` : r.id), r.hasDraft && h("span", { class: "chip accent" }, "טיוטה"), r.needsHuman && h("span", { class: "chip danger" }, "צריך אותך"), r.paused && h("span", { class: "chip" }, "בטיפולך")),
            h("span", { class: "last" }, r.last ? r.last.text : ""),
          ),
        ),
      ),
      realOpen ? realChat(realOpen, rerender) : h("p", { class: "empty" }, "בחרו שיחה"),
    ),
  );
  return card;
}

function realChat(conv, rerender) {
  const msgs = h("div", { class: "messages" });
  for (const m of conv.messages) {
    if (m.storyId) msgs.append(h("div", { class: "story-ref" }, `הגיב/ה לסטורי: ${findStoryText(m.storyId) || m.storyId}`));
    msgs.append(h("div", { class: `msg ${m.from}` }, m.text));
  }
  const lastBot = [...conv.messages].reverse().find((m) => m.from === "bot");
  if (lastBot?.meta && !conv.draft) msgs.append(metaChips(lastBot.meta));
  const refresh = async () => {
    realOpen = (await api(`/api/conversations/${encodeURIComponent(conv.id)}`)).conversation;
    realList = (await api("/api/conversations")).conversations;
    rerender();
  };
  if (conv.draft) {
    msgs.append(metaChips(conv.draft.meta));
    msgs.append(
      draftCard({
        draft: conv.draft,
        onSend: (messages, btn) =>
          busy(btn, "שולחת…", async () => {
            const res = await api(`/api/conversations/${encodeURIComponent(conv.id)}/send`, { method: "POST", body: { messages } });
            toast(res.learned ? "נשלח באינסטגרם. התיקון נשמר בשרת." : "נשלח באינסטגרם");
            await refresh();
          }),
        onSkip: () => toast("הטיוטה נשארת. אפשר לענות מהאפליקציה של אינסטגרם, וקולי תפנה את הדרך."),
      }),
    );
  }
  const resume = h("button", { type: "button", class: "btn quiet small" }, "קולי יכולה לחזור לענות כאן");
  resume.addEventListener("click", () =>
    busy(resume, "…", async () => {
      await api(`/api/conversations/${encodeURIComponent(conv.id)}/resume`, { method: "POST", body: {} });
      await refresh();
    }),
  );
  return h(
    "section",
    { class: "chat" },
    h("div", { class: "chat-head" }, h("span", { class: "avatar" }, (conv.fanName || conv.username || "?").slice(0, 1)), h("strong", {}, conv.fanName || conv.username || conv.id), h("span", { class: "spacer" }), (conv.pausedUntil > Date.now() || conv.needsHuman) && resume),
    msgs,
    h("div", { class: "composer" }, h("p", { class: "as" }, "כדי לענות בעצמך, ענו מהאפליקציה של אינסטגרם. קולי תראה את זה ותפסיק לענות בשיחה הזו.")),
  );
}

function backup(rerender) {
  const exportBtn = h("button", { type: "button", class: "btn ghost" }, "ייצוא לקובץ");
  exportBtn.addEventListener("click", async () => {
    const data = JSON.stringify(store.state, null, 2);
    const filename = `koli-${(store.state.persona.handle || "settings").replace(/[^\w.-]/g, "")}.json`;
    const downloads = window.claude?.use ? await window.claude.use("downloads").catch(() => null) : null;
    if (downloads) {
      try {
        await downloads.save({ filename, data });
      } catch {
        /* the viewer declined */
      }
      return;
    }
    const a = h("a", { href: URL.createObjectURL(new Blob([data], { type: "application/json" })), download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const importInput = h("input", { type: "file", id: "import-json", accept: ".json,application/json", class: "ltr" });
  importInput.addEventListener("change", async () => {
    try {
      const state = JSON.parse(await importInput.files[0].text());
      if (!state.persona) throw new Error();
      store.replace(state);
      toast("ההגדרות נטענו");
      rerender();
    } catch {
      toast("זה לא קובץ הגדרות של קולי");
    }
  });
  return h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "גיבוי"), h("p", {}, "ההגדרות נשמרות בדפדפן הזה. כדאי לייצא לקובץ, או לשלוח לשרת.")),
    h("div", { class: "row" }, exportBtn, field("טעינה מקובץ", importInput), h("span", { class: "spacer" }), h("button", { type: "button", class: "btn quiet small", onclick: () => { store.loadDemo(); toast("נטען חשבון ההדגמה"); rerender(); } }, "טעינת חשבון ההדגמה")),
  );
}
