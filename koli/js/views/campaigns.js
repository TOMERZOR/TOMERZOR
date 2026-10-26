// Campaigns: what's being promoted, the facts Koli may state, the coupon
// and link, and the stories fans reply to. This is how Koli knows what "כמה
// זה עולה?" under a story is about.

import { h, field, toast } from "../dom.js";
import { store, uid } from "../store.js";
import { normalizeCampaign } from "../../core/defaults.js";
import { activeCampaigns, trackedLink } from "../../core/context.js";

let openId = null;

function set(id, patch) {
  store.update((s) => {
    const c = s.campaigns.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
  });
}

export function renderCampaigns(root, rerender) {
  const active = new Set(activeCampaigns(store.state.campaigns).map((c) => c.id));
  const add = h("button", {
    type: "button",
    class: "btn",
    onclick: () => {
      const c = normalizeCampaign({ id: uid("c"), name: "קמפיין חדש", start: new Date().toISOString().slice(0, 10) });
      store.update((s) => s.campaigns.unshift(c));
      openId = c.id;
      rerender();
    },
  }, "+ קמפיין חדש");

  root.append(
    h("p", { class: "intro" }, "כל קמפיין פעיל נכנס להקשר של קולי. כשמישהי מגיבה לסטורי או מזכירה את המוצר, קולי מזהה על מה שואלים, עונה רק מהעובדות שכתבת, ונותנת את הקוד והלינק."),
    h("div", { class: "row" }, add),
    h(
      "div",
      { class: "campaigns" },
      store.state.campaigns.length
        ? store.state.campaigns.map((c) => (openId === c.id ? editor(c, rerender) : summary(c, active.has(c.id), rerender)))
        : h("section", { class: "card" }, h("p", { class: "hint" }, "אין קמפיינים. הוסיפו את המוצר שאת/ה מקדם/ת עכשיו, כדי שקולי תדע לענות עליו.")),
    ),
  );
}

function summary(c, isActive, rerender) {
  const status = isActive ? h("span", { class: "chip accent" }, "פעיל") : c.active === false ? h("span", { class: "chip" }, "כבוי") : h("span", { class: "chip warn" }, "מחוץ לתאריכים");
  return h(
    "section",
    { class: "card camp" },
    h(
      "div",
      { style: "min-width:0;display:grid;gap:4px" },
      h("div", { class: "row" }, h("h3", {}, c.name || c.product || "בלי שם"), status),
      h("p", { class: "facts" }, [c.brand, c.product, c.price, c.coupon && `קוד ${c.coupon}`, c.end && `עד ${c.end}`].filter(Boolean).join(" · ")),
      h("p", { class: "facts" }, `${(c.stories || []).length} סטוריז · ${(c.keywords || []).length} מילות מפתח`),
    ),
    h(
      "div",
      { class: "row" },
      h("label", { class: "switch" }, h("input", { type: "checkbox", id: `act-${c.id}`, checked: c.active !== false, onchange: (e) => { set(c.id, { active: e.target.checked }); rerender(); } }), "פעיל"),
      h("button", { type: "button", class: "btn ghost small", onclick: () => { openId = c.id; rerender(); } }, "עריכה"),
    ),
  );
}

function editor(c, rerender) {
  const input = (key, label, props = {}, hint) =>
    field(label, h("input", { id: `cf-${key}`, value: c[key] || "", ...props, onchange: (e) => set(c.id, { [key]: e.target.value.trim() }) }), hint);
  const area = (key, label, hint, rows = 4) =>
    field(label, h("textarea", { id: `cf-${key}`, rows, value: c[key] || "", onchange: (e) => set(c.id, { [key]: e.target.value.trim() }) }), hint, true);

  const stories = h(
    "div",
    { class: "stories" },
    (c.stories || []).map((s, i) =>
      h(
        "div",
        { class: "story" },
        h("textarea", { id: `st-${s.id}`, rows: 2, value: s.text, "aria-label": "מה רואים ושומעים בסטורי", placeholder: "מה רואים ושומעים בסטורי", onchange: (e) => store.update((st) => (st.campaigns.find((x) => x.id === c.id).stories[i].text = e.target.value.trim())) }),
        h("input", { id: `sid-${s.id}`, dir: "ltr", value: s.storyId || "", placeholder: "Story ID (לא חובה)", "aria-label": "מזהה הסטורי באינסטגרם", onchange: (e) => store.update((st) => (st.campaigns.find((x) => x.id === c.id).stories[i].storyId = e.target.value.trim())) }),
        h("button", { type: "button", class: "btn quiet small", onclick: () => { store.update((st) => st.campaigns.find((x) => x.id === c.id).stories.splice(i, 1)); rerender(); } }, "הסרה"),
      ),
    ),
    h("button", { type: "button", class: "btn ghost small", onclick: () => { store.update((st) => st.campaigns.find((x) => x.id === c.id).stories.push({ id: uid("st"), storyId: "", text: "" })); rerender(); } }, "+ סטורי"),
  );

  const link = trackedLink(c);
  return h(
    "section",
    { class: "card" },
    h("header", {}, h("h2", {}, c.name || "קמפיין"), h("button", { type: "button", class: "btn", onclick: () => { openId = null; toast("נשמר"); rerender(); } }, "סיום")),
    h(
      "div",
      { class: "fields" },
      input("name", "שם הקמפיין"),
      input("brand", "מותג"),
      input("product", "מוצר"),
      input("price", "מחיר", { placeholder: "₪119" }),
      input("coupon", "קוד קופון", { dir: "ltr" }),
      input("couponDetails", "תנאי הקופון", { placeholder: "20% הנחה, פעם אחת" }),
      field("לינק לרכישה", h("input", { id: "cf-link", type: "url", dir: "ltr", value: c.link || "", onchange: (e) => { set(c.id, { link: e.target.value.trim() }); rerender(); } }), link && link !== c.link ? `קולי תשלח עם תיוג למעקב מכירות: ${link}` : null, true),
      input("start", "מתאריך", { type: "date" }),
      input("end", "עד תאריך", { type: "date" }),
      field("איך עוקבים קוראים לזה", h("input", { id: "cf-keywords", value: (c.keywords || []).join(", "), placeholder: "סרום, הסרום הכתום, הקרם מהסטורי", onchange: (e) => set(c.id, { keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }) }), "מופרד בפסיקים. עוזר לזהות את הקמפיין גם בלי תגובה לסטורי.", true),
      area("facts", "עובדות על המוצר", "רק מה שכתוב כאן קולי תגיד. מידות, רכיבים, משלוח, החזרות, וגם מה את/ה באמת חושב/ת עליו."),
      area("faq", "תשובות לשאלות נפוצות", "שאלה ותשובה בכל שורה. אפשר לכתוב ׳להעביר אליי׳ לשאלות רגישות.", 3),
    ),
    h("div", { class: "field" }, h("span", {}, "סטוריז של הקמפיין"), h("small", {}, "תיאור קצר של כל סטורי. כשהשרת מחובר לאינסטגרם, ה-Story ID מקשר תגובה לסטורי ישר לקמפיין."), stories),
    h(
      "div",
      { class: "row" },
      h("label", { class: "switch" }, h("input", { type: "checkbox", id: "cf-active", checked: c.active !== false, onchange: (e) => set(c.id, { active: e.target.checked }) }), "פעיל"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "btn danger small", onclick: () => { store.update((s) => (s.campaigns = s.campaigns.filter((x) => x.id !== c.id))); openId = null; rerender(); } }, "מחיקת הקמפיין"),
    ),
  );
}
