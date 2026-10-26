// Teach Koli the creator's voice: who they are, their real messages and
// captions (from the Instagram export or pasted), and the voice profile
// Claude writes from them.

import { h, field, toast, busy } from "../dom.js";
import { store } from "../store.js";
import { analyze } from "../engine.js";
import { SLIDERS } from "../../core/defaults.js";
import { parseInstagramExport, samplesFromText, isWantedFile, LIMITS } from "../../core/igexport.js";
import { listZip, readZipText } from "../../core/zip.js";

let imported = null; // {files, result} while the creator reviews an import

const PROFILE_FIELDS = [
  ["tone", "טון", "text"],
  ["signature_phrases", "ביטויים שלה/שלו", "list"],
  ["slang", "סלנג", "list"],
  ["favorite_emojis", "אימוג׳ים אהובים", "list"],
  ["emoji_style", "איך משתמשים באימוג׳ים", "text"],
  ["message_length", "אורך הודעה טיפוסי", "text"],
  ["punctuation", "כתיב ופיסוק", "text"],
  ["openers", "פתיחות", "list"],
  ["closers", "סגירות", "list"],
  ["addressing_fans", "פנייה למעריצים", "text"],
  ["language_mix", "שפות", "text"],
  ["humor", "הומור", "text"],
  ["dos", "תמיד", "lines"],
  ["donts", "אף פעם", "lines"],
];

/** Loose JSON files have no folder path; recognise them by their content. */
function sniffPath(name, text) {
  try {
    const data = JSON.parse(text);
    if (data?.messages && data?.participants) return `messages/inbox/${name}/message_1.json`;
    if (Array.isArray(data) && data[0]?.media) return "content/posts_1.json";
    if (data?.ig_reels_media) return "content/reels.json";
    if (data?.ig_stories) return "content/stories.json";
    if (Array.isArray(data) && data[0]?.string_map_data?.Comment) return "comments/post_comments_1.json";
  } catch {
    /* not JSON */
  }
  return name;
}

async function readUploads(fileList) {
  const files = [];
  for (const f of fileList) {
    if (/\.zip$/i.test(f.name)) {
      const entries = (await listZip(f)).filter((e) => isWantedFile(e.name));
      for (const e of entries) files.push({ path: e.name, text: await readZipText(f, e) });
    } else if (/\.json$/i.test(f.name)) {
      const text = await f.text();
      const path = f.webkitRelativePath && isWantedFile(f.webkitRelativePath) ? f.webkitRelativePath : sniffPath(`${f.name}-${files.length}`, text);
      files.push({ path, text });
    }
  }
  return files;
}

function mergeSamples(s, samples, pairs) {
  const seen = new Set(s.persona.samples.map((x) => x.text));
  s.persona.samples = [...s.persona.samples, ...samples.filter((x) => !seen.has(x.text) && seen.add(x.text))].slice(-LIMITS.samples);
  const seenPairs = new Set(s.persona.pairs.map((p) => p.fan + "|" + p.reply));
  s.persona.pairs = [...s.persona.pairs, ...pairs.filter((p) => !seenPairs.has(p.fan + "|" + p.reply) && seenPairs.add(p.fan + "|" + p.reply))].slice(-LIMITS.pairs);
}

export function renderVoice(root, rerender) {
  const p = store.state.persona;

  const who = h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "מי מדבר/ת"), h("p", {}, "הבסיס לכל תשובה. בעברית גם הפעלים תלויים במגדר, אז זה חשוב.")),
    h(
      "div",
      { class: "fields" },
      field("שם", h("input", { id: "p-name", value: p.name, placeholder: "למשל: מאיה", onchange: (e) => store.update((s) => (s.persona.name = e.target.value.trim())) })),
      field("משתמש באינסטגרם", h("input", { id: "p-handle", dir: "ltr", value: p.handle, placeholder: "maya.style", onchange: (e) => store.update((s) => (s.persona.handle = e.target.value.trim().replace(/^@/, ""))) })),
      field(
        "כותב/ת על עצמו/ה בלשון",
        h(
          "div",
          { class: "choices" },
          [["female", "נקבה"], ["male", "זכר"]].map(([v, label]) =>
            h("label", {}, h("input", { type: "radio", name: "p-gender", value: v, checked: p.gender === v, onchange: () => { store.update((s) => (s.persona.gender = v)); rerender(); } }), label),
          ),
        ),
      ),
      field("על היוצר/ת", h("textarea", { id: "p-about", rows: 3, value: p.about, placeholder: "תחום, קהל, מה חשוב לה/לו, איך היא/הוא מדבר/ת עם העוקבים", onchange: (e) => store.update((s) => (s.persona.about = e.target.value.trim())) }), null, true),
    ),
  );

  // --- sources
  const fileInput = h("input", { type: "file", id: "ig-files", accept: ".zip,.json,application/zip,application/json", multiple: true, class: "ltr" });
  const importOut = h("div", { class: "grid" });
  fileInput.addEventListener("change", async () => {
    if (!fileInput.files.length) return;
    importOut.replaceChildren(h("p", { class: "hint" }, "קוראת את הקבצים…"));
    try {
      const files = await readUploads(fileInput.files);
      if (!files.length) throw new Error("לא מצאתי בקבצים הודעות, פוסטים או תגובות. ודאו שהורדתם בפורמט JSON.");
      imported = { files, result: parseInstagramExport(files) };
      rerender();
    } catch (err) {
      importOut.replaceChildren(h("p", { class: "chip danger" }, err.message === "not_zip" ? "זה לא קובץ ZIP תקין." : err.message));
    }
  });
  if (imported) importOut.append(importReview(rerender));

  const paste = h("textarea", { id: "paste", rows: 5, placeholder: "הדביקו כאן הודעות, כיתובים או תמלולים של סטוריז. כל שורה או פסקה תהיה דוגמה." });
  const sources = h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "מאיפה לומדים"), h("p", {}, "ככל שיש יותר הודעות אמיתיות, הקול מדויק יותר. הכי טוב: תשובות אמיתיות שנשלחו למעריצים.")),
    h(
      "div",
      { class: "grid2" },
      h(
        "div",
        { class: "field" },
        h("span", {}, "ייבוא מאינסטגרם"),
        h("small", {}, "באפליקציה: הגדרות ← מרכז החשבונות ← הפרטים וההרשאות שלך ← הורדת המידע שלך. בחרו פורמט JSON, ואת ההודעות, התוכן והתגובות. כשהקובץ מגיע במייל, העלו כאן את ה-ZIP כמו שהוא. הקובץ נקרא רק בדפדפן הזה."),
        fileInput,
        importOut,
      ),
      h(
        "div",
        { class: "field" },
        h("span", {}, "או הדבקה"),
        paste,
        h("button", {
          type: "button",
          class: "btn ghost",
          onclick: () => {
            const samples = samplesFromText(paste.value);
            if (!samples.length) return toast("אין מה להוסיף");
            store.update((s) => mergeSamples(s, samples, []));
            toast(`נוספו ${samples.length} דוגמאות`);
            rerender();
          },
        }, "הוספה לדוגמאות"),
      ),
    ),
    collected(rerender),
  );

  root.append(h("p", { class: "intro" }, "קולי לומדת איך את/ה כותב/ת מההודעות האמיתיות שלך, ואז Claude מנסח פרופיל קול שאפשר לערוך. כל תיקון שתעשו לתשובה בתיבת ההודעות נשמר גם הוא, ומלמד אותה עוד."), who, sources, profileCard(rerender), correctionsCard(rerender));
}

function importReview(rerender) {
  const { result, files } = imported;
  const owner = h(
    "select",
    { id: "ig-owner", onchange: (e) => { imported.result = parseInstagramExport(files, e.target.value); rerender(); } },
    result.candidates.map((c) => h("option", { value: c.name }, `${c.name} (${c.count} שיחות)`)),
  );
  owner.value = result.owner;
  return h(
    "div",
    { class: "card" },
    result.candidates.length > 1 && field("מי מהמשתתפים זה/זו את/ה?", owner),
    h(
      "div",
      { class: "stat" },
      h("div", {}, h("b", {}, result.counts.dms), h("span", {}, "הודעות שלך")),
      h("div", {}, h("b", {}, result.counts.pairs), h("span", {}, "שאלה ותשובה")),
      h("div", {}, h("b", {}, result.counts.captions), h("span", {}, "כיתובים")),
      h("div", {}, h("b", {}, result.counts.comments), h("span", {}, "תגובות")),
    ),
    h(
      "div",
      { class: "row" },
      h("button", {
        type: "button",
        class: "btn",
        onclick: () => {
          store.update((s) => {
            mergeSamples(s, result.samples, result.pairs);
            if (!s.persona.name && result.owner) s.persona.name = result.owner.split(" ")[0];
          });
          imported = null;
          toast("הדוגמאות נוספו. עכשיו אפשר לנתח את הקול.");
          rerender();
        },
      }, "הוספה לדוגמאות"),
      h("button", { type: "button", class: "btn quiet", onclick: () => { imported = null; rerender(); } }, "ביטול"),
    ),
  );
}

function collected(rerender) {
  const p = store.state.persona;
  const remove = (key, i) => store.update((s) => s.persona[key].splice(i, 1));
  return h(
    "details",
    {},
    h("summary", {}, `נאספו ${p.samples.length} דוגמאות כתיבה ו-${p.pairs.length} שיחות אמיתיות`),
    h(
      "div",
      { class: "grid2" },
      h("ul", { class: "list" }, p.pairs.map((x, i) => h("li", { class: "pair" }, h("div", {}, h("b", {}, "מעריץ/ה: "), x.fan, h("br"), h("b", {}, "תשובה: "), x.reply), h("button", { type: "button", class: "x", "aria-label": "מחיקה", onclick: () => { remove("pairs", i); rerender(); } }, "×")))),
      h("ul", { class: "list" }, p.samples.map((x, i) => h("li", {}, h("div", {}, x.text), h("button", { type: "button", class: "x", "aria-label": "מחיקה", onclick: () => { remove("samples", i); rerender(); } }, "×")))),
    ),
    (p.samples.length || p.pairs.length) && h("button", { type: "button", class: "btn danger small", onclick: () => { store.update((s) => { s.persona.samples = []; s.persona.pairs = []; }); rerender(); } }, "מחיקת כל הדוגמאות"),
  );
}

function profileCard(rerender) {
  const p = store.state.persona;
  const prof = p.profile;
  const enough = p.samples.length + p.pairs.length >= 5;
  const runBtn = h("button", { type: "button", class: "btn", disabled: !enough }, prof ? "ניתוח מחדש" : "ניתוח הקול");
  runBtn.addEventListener("click", () =>
    busy(runBtn, "מנתחת… (עד דקה)", async () => {
      const profile = await analyze(store.state.persona);
      store.update((s) => (s.persona.profile = profile));
      toast("פרופיל הקול מוכן");
      rerender();
    }),
  );

  const set = (key, value) => store.update((s) => (s.persona.profile = { ...(s.persona.profile || {}), [key]: value }));
  const body = prof
    ? h(
        "div",
        { class: "profile" },
        field("בשורה אחת", h("textarea", { id: "pr-summary", rows: 2, value: prof.summary || "", onchange: (e) => set("summary", e.target.value) }), null, true),
        h(
          "div",
          { class: "fields" },
          PROFILE_FIELDS.map(([key, label, kind]) => {
            const v = prof[key];
            if (kind === "text") return field(label, h("input", { id: `pr-${key}`, value: v || "", onchange: (e) => set(key, e.target.value) }));
            if (kind === "list") return field(label, h("input", { id: `pr-${key}`, value: (v || []).join(", "), onchange: (e) => set(key, e.target.value.split(",").map((x) => x.trim()).filter(Boolean)) }), "מופרד בפסיקים");
            return field(label, h("textarea", { id: `pr-${key}`, rows: 3, value: (v || []).join("\n"), onchange: (e) => set(key, e.target.value.split("\n").map((x) => x.trim()).filter(Boolean)) }), "כלל בכל שורה");
          }),
        ),
        prof.suggested &&
          h(
            "div",
            { class: "row" },
            h("span", { class: "hint" }, `Claude ממליץ על כיוונון אופי: ${SLIDERS.filter((s) => prof.suggested[s.key]).map((s) => `${s.label} ${prof.suggested[s.key]}`).join(" · ")}`),
            h("button", {
              type: "button",
              class: "btn ghost small",
              onclick: () => {
                store.update((s) => {
                  for (const sl of SLIDERS) if (prof.suggested[sl.key]) s.controls[sl.key] = Math.max(1, Math.min(5, prof.suggested[sl.key]));
                });
                toast("הכיוונון עודכן בלשונית האופי");
              },
            }, "להחיל"),
          ),
      )
    : h("p", { class: "hint" }, enough ? "יש מספיק דוגמאות. לחצו על ניתוח הקול." : "צריך לפחות 5 דוגמאות כדי לנתח. מומלץ 50 ומעלה.");

  return h("section", { class: "card" }, h("header", {}, h("h2", {}, "פרופיל הקול"), runBtn, h("p", {}, "Claude קורא את הדוגמאות ומתאר איך את/ה כותב/ת. אפשר לתקן כל שדה ביד.")), body);
}

function correctionsCard(rerender) {
  const c = store.state.persona.corrections;
  return h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "מה קולי למדה ממך"), h("p", {}, "תשובות שאישרת אחרי עריכה או תיקנת. אלה הדוגמאות החזקות ביותר, וקולי מחקה אותן קודם.")),
    c.length
      ? h("ul", { class: "list" }, c.map((x, i) => h("li", { class: "pair" }, h("div", {}, h("b", {}, "מעריץ/ה: "), x.fan, h("br"), h("b", {}, "את/ה: "), x.reply), h("button", { type: "button", class: "x", "aria-label": "מחיקה", onclick: () => { store.update((s) => s.persona.corrections.splice(i, 1)); rerender(); } }, "×"))))
      : h("p", { class: "hint" }, "עוד אין. בתיבת ההודעות, ערכו טיוטה לפני השליחה או לחצו ״תיקון״ על תשובה."),
  );
}
