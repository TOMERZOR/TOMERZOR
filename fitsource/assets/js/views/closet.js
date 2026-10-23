import { html, icon, money, statusChip, toast, timeAgo } from "../ui.js";
import * as store from "../store.js";
import { aAttrs, productImg } from "../components.js";
import { NEW_SHOPS } from "../shop.js";
import { deepScanStatus } from "../scan/engine.js";
import { recheckWatches } from "../watch.js";

let checkNote = ""; // survives re-renders while a check runs

const TABS = [
  ["saved", "Saved", "heart"],
  ["watching", "Restock alerts", "bell"],
  ["scans", "Scans", "clock"],
];

function closetTag(it) {
  const url = it.url || NEW_SHOPS[0].url(it.query);
  return html`<article class="tag" data-key="${it.key}">
    <div class="tag__img">${it.img ? html`<img src="${productImg(it)}" alt="" loading="lazy">` : ""}</div>
    <div class="tag__body">
      <span class="tag__brand">${it.brand || it.shop || "Saved piece"}</span>
      <h3 class="tag__name">${it.name}</h3>
      <div class="tag__meta">
        ${it.price != null ? html`<span class="price">${money(it.price, it.currency || "USD")}</span>` : ""}
        ${it.backInStock ? html`<span class="flag">${icon("bell-ringing-fill")}Back in stock</span>` : statusChip(it.status)}
      </div>
      ${it.watch ? html`<span class="label">${it.checkedAt ? `checked ${timeAgo(it.checkedAt)}` : "not checked yet"}</span>` : ""}
      <div class="tag__actions">
        <a class="btn btn--xs" ${aAttrs(url)}>${icon("arrow-up-right")}${it.url ? (it.shop ? `Shop at ${it.shop}` : "Shop") : "Shop similar"}</a>
        ${it.fitId ? html`<a class="btn btn--xs btn--ghost" href="#/fit/${it.fitId}">View fit</a>` : ""}
        <span class="spacer"></span>
        ${it.url ? html`<button type="button" class="iconbtn" data-act="watch" aria-pressed="${it.watch}" aria-label="${it.watch ? "Stop restock alert" : "Alert me when it's back"}">${icon(it.watch ? "bell-ringing-fill" : "bell")}</button>` : ""}
        <button type="button" class="iconbtn" data-act="remove" aria-label="Remove ${it.name}">${icon("trash")}</button>
      </div>
    </div>
  </article>`;
}

function panel(tab) {
  if (tab === "scans") {
    const list = store.scans();
    if (!list.length) return empty("clock", "No scans yet", "Scans you run are kept here, in this browser, so you can come back to them.");
    return html`<div class="scan-grid">${list.map(
      (s) => html`<div class="card" data-scan="${s.id}">
        <a href="#/scan/${s.id}" class="shot shot--frame" aria-label="Open scan from ${timeAgo(s.createdAt)}"><img src="${s.photo}" alt="" loading="lazy"></a>
        <div class="card__meta">
          <div><div class="card__title">${s.items.length} piece${s.items.length === 1 ? "" : "s"}</div><div class="card__by">${s.engine === "deep" ? "Deep scan" : "Quick scan"}, ${timeAgo(s.createdAt)}</div></div>
          <button type="button" class="iconbtn" data-del-scan="${s.id}" aria-label="Delete this scan">${icon("trash")}</button>
        </div>
      </div>`,
    )}</div>`;
  }
  const items = store.closet().filter((i) => (tab === "watching" ? i.watch : true));
  if (!items.length) {
    return tab === "watching"
      ? empty("bell", "No restock alerts", "When a piece you scan is sold out, tap Alert me. FitSource checks the shop and flags it here when it's back.")
      : empty("heart", "Your closet is empty", "Tap the heart on any piece in the feed or in your scans to keep it here.");
  }
  return html`${tab === "watching" ? html`<div class="toolbar" style="margin-bottom:16px"><button type="button" class="btn btn--sm btn--ghost" data-check>${icon("arrows-clockwise")}Check now</button><span class="muted" data-check-note style="font-size:.88rem">${checkNote}</span></div>` : ""}
    <div class="closet-grid">${items.map(closetTag)}</div>`;
}

function empty(ic, title, text) {
  return html`<div class="empty">${icon(ic)}<h2 class="h3">${title}</h2><p>${text}</p><a class="btn btn--sm" href="#/">${icon("scan")}Scan a fit</a></div>`;
}

function counts() {
  const c = store.closet();
  return { saved: c.length, watching: c.filter((i) => i.watch).length, scans: store.scans().length };
}

function render([tab = "saved"]) {
  const n = counts();
  return html`
  <section class="wrap pagehead">
    <h1 class="display" style="font-size:clamp(2.4rem,5vw,4.2rem)">Your closet</h1>
    <p class="lede">Saved pieces, restock alerts and past scans. Everything stays in this browser.</p>
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
      toast("Scan deleted");
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const key = btn.closest("[data-key]").dataset.key;
    const item = store.closet().find((i) => i.key === key);
    if (!item) return;
    if (btn.dataset.act === "remove") {
      store.removeItem(key);
      toast("Removed", { action: "Undo", onAction: () => store.saveItem(item, { watch: item.watch }) });
    } else if (btn.dataset.act === "watch") {
      store.setWatch(key, !item.watch);
      toast(item.watch ? "Restock alert off" : "Restock alert on");
    }
  });

  function wireCheck() {
    const btn = area.querySelector("[data-check]");
    const note = area.querySelector("[data-check-note]");
    if (!btn) return;
    deepScanStatus().then((on) => {
      if (!on && note) {
        btn.disabled = true;
        note.textContent = "Live stock checks need the FitSource API, which isn't connected on this site.";
      }
    });
    btn.addEventListener("click", async () => {
      const setNote = (t) => {
        checkNote = t;
        const el = area.querySelector("[data-check-note]");
        if (el) el.textContent = t;
      };
      btn.disabled = true;
      setNote("Checking shops...");
      const backs = await recheckWatches({ force: true });
      const flagged = store.closet().filter((i) => i.watch && i.backInStock).length;
      setNote(backs.length ? `${backs.length} back in stock` : flagged ? `${flagged} back in stock` : "Nothing new yet. We'll keep checking.");
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
