// The dials: how warm, funny, short, salesy; how to address fans; when to
// say it's an AI; what to avoid; when to hand a chat back to the creator.

import { h, field, toast, busy } from "../dom.js";
import { store } from "../store.js";
import { reply as askReply } from "../engine.js";
import { SLIDERS, ADDRESS_OPTIONS, DISCLOSURE_OPTIONS, disclosureLine } from "../../core/defaults.js";
import { metaChips, metaFromReply } from "./common.js";

let testText = "היי! ראיתי בסטורי את הסרום, זה שווה את זה?";

function lines(v) {
  return v.split("\n").map((x) => x.trim()).filter(Boolean);
}

export function renderPersonality(root, rerender) {
  const c = store.state.controls;

  const sliders = h(
    "div",
    { class: "sliders" },
    SLIDERS.map((s) => {
      const out = h("output", { class: "mono", for: `sl-${s.key}` }, c[s.key]);
      const input = h("input", { type: "range", id: `sl-${s.key}`, min: 1, max: 5, step: 1, value: c[s.key], "aria-label": s.label });
      input.addEventListener("input", () => {
        if (out.textContent === input.value) return;
        out.textContent = input.value;
        out.classList.remove("bump");
        void out.offsetWidth;
        out.classList.add("bump");
      });
      input.addEventListener("change", () => store.update((st) => (st.controls[s.key] = Number(input.value))));
      return h("div", { class: "slider" }, h("span", { class: "name" }, s.label, " ", out), input, h("div", { class: "ends" }, h("span", {}, s.low), h("span", {}, s.high)));
    }),
  );

  const radios = (name, options, value, onPick) =>
    h("div", { class: "choices" }, options.map((o) => h("label", {}, h("input", { type: "radio", name, value: o.value, checked: value === o.value, onchange: () => onPick(o.value) }), o.label)));

  const behaviour = h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "התנהגות")),
    field("איך לשלוח", radios("mode", [{ value: "approve", label: "טיוטות שאני מאשר/ת (מומלץ להתחלה)" }, { value: "auto", label: "עונה לבד" }], c.mode, (v) => store.update((s) => (s.controls.mode = v))), "בטיוטות, את/ה מאשר/ת כל תשובה לפני שהיא יוצאת, וקולי לומדת מהעריכות."),
    field("פנייה לעוקבים", radios("address", ADDRESS_OPTIONS, c.address, (v) => store.update((s) => (s.controls.address = v)))),
    field("כמה בועות לכל היותר בתשובה", radios("maxm", [1, 2, 3].map((n) => ({ value: n, label: String(n) })), c.maxMessages, (v) => store.update((s) => (s.controls.maxMessages = v)))),
  );

  const disclosurePreview = h("p", { class: "hint" }, `כך זה ייראה: ${disclosureLine(store.state)}`);
  const disclosure = h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "שקיפות"), h("p", {}, "Meta מסמנת בעצמה שיחות עם AI של יוצרים, ובאיחוד האירופי זו חובה בחוק. עוקבים שיודעים שזו העוזרת שלך עדיין קונים, כי מה שהם צריכים זו תשובה מהירה.")),
    radios("disc", DISCLOSURE_OPTIONS, c.disclosure, (v) => { store.update((s) => (s.controls.disclosure = v)); rerender(); }),
    field("נוסח משלך (לא חובה)", h("input", { id: "disc-text", value: c.disclosureText, placeholder: disclosureLine({ ...store.state, controls: { ...c, disclosureText: "" } }), onchange: (e) => { store.update((s) => (s.controls.disclosureText = e.target.value)); rerender(); } })),
    disclosurePreview,
  );

  const limits = h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, "גבולות")),
    h(
      "div",
      { class: "grid2" },
      field("נושאים שלא נוגעים בהם", h("textarea", { id: "avoid", rows: 4, value: c.avoidTopics.join("\n"), onchange: (e) => store.update((s) => (s.controls.avoidTopics = lines(e.target.value))) }), "נושא בכל שורה. קולי תסיט בעדינות."),
      field("מתי להעביר אלייך", h("textarea", { id: "handoff", rows: 4, value: c.handoffTopics.join("\n"), onchange: (e) => store.update((s) => (s.controls.handoffTopics = lines(e.target.value))) }), "קולי תכתוב תשובת המתנה ותסמן את השיחה."),
      field("כללים משלך", h("textarea", { id: "rules", rows: 4, value: c.customRules, placeholder: "למשל: לא לקרוא לעוקבות ׳בנות׳. לא להבטיח הנחות שלא כתובות בקמפיין.", onchange: (e) => store.update((s) => (s.controls.customRules = e.target.value)) }), null, true),
    ),
  );

  // Try the current dials on one message.
  const testBox = h("textarea", { id: "test-text", rows: 2, value: testText, oninput: (e) => (testText = e.target.value) });
  const testOut = h("div", { class: "messages", style: "max-height:none;min-height:0;padding:0" });
  const testBtn = h("button", { type: "button", class: "btn" }, "איך קולי תענה?");
  testBtn.addEventListener("click", () =>
    busy(testBtn, "כותבת…", async () => {
      const r = await askReply({ history: [], text: testText, fanName: "" });
      testOut.replaceChildren(h("div", { class: "msg fan" }, testText), ...r.messages.map((m) => h("div", { class: "msg bot" }, m)), metaChips(metaFromReply(r)));
    }),
  );
  const tester = h("section", { class: "card" }, h("header", {}, h("h2", {}, "ניסיון"), h("p", {}, "שנו כיוונון ובדקו מיד. הניסיון לא נשמר בתיבת ההודעות.")), testBox, h("div", { class: "row" }, testBtn), testOut);

  root.append(
    h("p", { class: "intro" }, "כאן קובעים את האופי של השכפול. הכיוונון גובר על הדוגמאות כשהם לא מסכימים, אז אפשר למשל לשמור על הקול ועדיין לבקש תשובות קצרות יותר."),
    h("div", { class: "grid2" }, h("section", { class: "card" }, h("header", {}, h("h2", {}, "אופי"), h("p", {}, store.state.persona.profile ? "המלצת Claude מהניתוח אפשר להחיל בלשונית הקול." : "")), sliders), h("div", { class: "view" }, tester, behaviour)),
    h("div", { class: "grid2" }, disclosure, limits),
  );
}
