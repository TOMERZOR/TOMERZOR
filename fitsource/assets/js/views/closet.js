import { html, icon, money, statusChip, toast, timeAgo, count } from "../ui.js";
import * as store from "../store.js";
import { aAttrs, productImg } from "../components.js";
import { NEW_SHOPS } from "../shop.js";
import { deepScanStatus } from "../scan/engine.js";
import { recheckWatches } from "../watch.js";

let checkNote = ""; // survives re-renders while a check runs
let checking = false;

const TABS = [
  ["saved", "שמורים", "heart"],
  ["watching", "התראות", "bell"],
  ["scans", "סריקות", "clock"],
];

function closetTag(it) {
  const url = it.url || NEW_SHOPS[0].url(it.query);
  return html`<article class="tag" data-key="${it.key}">
    <div class="tag__img">${it.img ? html`<img src="${productImg(it)}" alt="" loading="lazy">` : ""}</div>
    <div class="tag__body">
      <span class="tag__brand"><bdi>${it.brand || it.shop || "פריט שמור"}</bdi></span>
      <h2 class="tag__name"><bdi>${it.name}</bdi></h2>
      <div class="tag__meta">
        ${it.price != null ? html`<span class="price">${money(it.price, it.currency || "ILS")}</span>` : ""}
        ${it.backInStock ? html`<span class="flag">${icon("bell-ringing-fill")}חזר למלאי</span>` : statusChip(it.status)}
      </div>
      ${it.watch ? html`<span class="label">${it.checkedAt ? `נבדק ${timeAgo(it.checkedAt)}` : "עוד לא נבדק"}</span>` : ""}
      <div class="tag__actions">
        <a class="btn btn--xs" ${aAttrs(url)}>${icon("arrow-up-right")}${it.url ? (it.shop ? `לקנייה ב־${it.shop}` : "לקנייה") : "דומים בחנויות"}</a>
        ${it.fitId ? html`<a class="btn btn--xs btn--ghost" href="#/fit/${it.fitId}">ללוק</a>` : ""}
        <span class="spacer"></span>
        ${it.url ? html`<button type="button" class="iconbtn" data-act="watch" aria-pressed="${it.watch}" aria-label="${it.watch ? "ביטול התראת מלאי" : "עדכנו אותי כשיחזור למלאי"}">${icon(it.watch ? "bell-ringing-fill" : "bell")}</button>` : ""}
        <button type="button" class="iconbtn" data-act="remove" aria-label="הסרת ${it.name}">${icon("trash")}</button>
      </div>
    </div>
  </article>`;
}

function panel(tab) {
  if (tab === "scans") {
    const list = store.scans();
    if (!list.length) return empty("clock", "עוד אין סריקות", "הסריקות שלכם נשמרות כאן, בדפדפן הזה, כדי שתוכלו לחזור אליהן.");
    return html`<div class="scan-grid">${list.map(
      (s) => html`<div class="card" data-scan="${s.id}">
        <a href="#/scan/${s.id}" class="shot shot--frame" aria-label="פתיחת הסריקה מ${timeAgo(s.createdAt)}"><img src="${s.photo}" alt="" loading="lazy"></a>
        <div class="card__meta">
          <div><div class="card__title">${count(s.items.length, "פריט אחד", "פריטים")}</div><div class="card__by">${s.engine === "deep" ? "סריקה מעמיקה" : "סריקה מהירה"}, ${timeAgo(s.createdAt)}</div></div>
          <button type="button" class="iconbtn" data-del-scan="${s.id}" aria-label="מחיקת הסריקה">${icon("trash")}</button>
        </div>
      </div>`,
    )}</div>`;
  }
  const items = store.closet().filter((i) => (tab === "watching" ? i.watch : true));
  if (!items.length) {
    return tab === "watching"
      ? empty("bell", "אין התראות מלאי", "כשפריט שסרקתם אזל, לחצו על \"עדכנו אותי\". FitSource בודק את החנות ומסמן אותו כאן כשהוא חוזר.")
      : empty("heart", "הארון ריק", "לחצו על הלב בכל פריט בפיד או בסריקות שלכם כדי לשמור אותו כאן.");
  }
  return html`${tab === "watching" ? html`<div class="toolbar" style="margin-bottom:16px"><button type="button" class="btn btn--sm btn--ghost" data-check ${checking ? "disabled" : ""}>${icon("arrows-clockwise")}בדיקה עכשיו</button><span class="muted" data-check-note style="font-size:.88rem">${checkNote}</span></div>` : ""}
    <div class="closet-grid">${items.map(closetTag)}</div>`;
}

function empty(ic, title, text) {
  return html`<div class="empty">${icon(ic)}<h2 class="h3">${title}</h2><p>${text}</p><a class="btn btn--sm" href="#/">${icon("scan")}סרקו לוק</a></div>`;
}

function counts() {
  const c = store.closet();
  return { saved: c.length, watching: c.filter((i) => i.watch).length, scans: store.scans().length };
}

function render([tab = "saved"]) {
  const n = counts();
  return html`
  <section class="wrap pagehead">
    <h1 class="display" style="font-size:clamp(2.4rem,5vw,4.2rem)">הארון שלכם</h1>
    <p class="lede">פריטים שמורים, התראות מלאי וסריקות קודמות. הכל נשאר בדפדפן הזה.</p>
  </section>
  <div class="wrap">
    <div class="tabs" role="tablist">
      ${TABS.map(([id, label, ic]) => html`<a class="tab" role="tab" href="#/closet/${id}" aria-selected="${id === tab}">${icon(ic)}${label}<span class="count">${n[id]}</span></a>`)}
    </div>
    <div data-panel role="tabpanel">${panel(tab)}</div>
  </div>`;
}

function mount(root, [tab = "saved"]) {
  const area = root.querySelector("[data-panel]");
  const redraw = () => {
    area.innerHTML = panel(tab).s;
    const n = counts();
    root.querySelectorAll(".tab .count").forEach((el, i) => (el.textContent = n[TABS[i][0]]));
    wireCheck();
  };
  const off = store.onChange(redraw);

  area.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-scan]");
    if (del) {
      store.deleteScan(del.dataset.delScan);
      toast("הסריקה נמחקה");
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const key = btn.closest("[data-key]").dataset.key;
    const item = store.closet().find((i) => i.key === key);
    if (!item) return;
    if (btn.dataset.act === "remove") {
      store.removeItem(key);
      toast("הוסר", { action: "ביטול", onAction: () => store.saveItem(item, { watch: item.watch }) });
    } else if (btn.dataset.act === "watch") {
      store.setWatch(key, !item.watch);
      toast(item.watch ? "התראת המלאי בוטלה" : "התראת המלאי הופעלה");
    }
  });

  function wireCheck() {
    const btn = area.querySelector("[data-check]");
    const note = area.querySelector("[data-check-note]");
    if (!btn) return;
    deepScanStatus().then((on) => {
      if (!on && note) {
        btn.disabled = true;
        note.textContent = "בדיקת מלאי חיה צריכה את שרת FitSource, שלא מחובר באתר הזה.";
      }
    });
    btn.addEventListener("click", async () => {
      const setNote = (t) => {
        checkNote = t;
        const el = area.querySelector("[data-check-note]");
        if (el) el.textContent = t;
      };
      if (checking) return;
      checking = true;
      btn.disabled = true;
      setNote("בודקים בחנויות...");
      let backs = [];
      try {
        backs = await recheckWatches({ force: true });
      } finally {
        checking = false;
      }
      const flagged = store.closet().filter((i) => i.watch && i.backInStock).length;
      const back = backs.length || flagged;
      setNote(back ? (back === 1 ? "פריט אחד חזר למלאי" : `${back} פריטים חזרו למלאי`) : "עוד אין חדש. נמשיך לבדוק.");
      const b = area.querySelector("[data-check]");
      if (b) b.disabled = false;
    });
  }
  wireCheck();
  return () => {
    off();
    checkNote = "";
    // Leaving the closet clears the "back in stock" flags you have now seen.
    store.closet().filter((i) => i.backInStock).forEach((i) => store.updateItem(i.key, { backInStock: false }));
  };
}

export default { render, mount };
