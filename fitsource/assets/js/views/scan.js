// Scan page: runs the scan with live progress, then shows what was found.
import { html, icon, money, statusChip, toast, reduceMotion } from "../ui.js";
import { shot, shopSearch, updateShopLinks, aAttrs } from "../components.js";
import { takePending, hasPending, getCurrent, setCurrent, startScan } from "../state.js";
import { prepareImage, runScan, runRegion, cropThumb, ImageError } from "../scan/engine.js";
import * as store from "../store.js";
import { openReceipt } from "../share.js";
import { bindTagActions, linkSpotsAndTags } from "./shared.js";

const CATEGORY_NAME = { outerwear: "Outerwear", top: "Top", bottom: "Bottoms", dress: "Dress", footwear: "Shoes", bag: "Bag", headwear: "Hat", eyewear: "Eyewear", jewelry: "Jewellery", accessory: "Accessory" };
const KIND = { original: "Original", exact: "Exact", close: "Close", similar: "Similar", resale: "Resale" };
const CONF = { exact: "Exact product found", likely: "Probably this one", similar: "Lookalikes" };

function render([id]) {
  if (id) {
    if (!store.getScan(id) && !(getCurrent() && getCurrent().id === id)) {
      return html`<section class="wrap pagehead"><h1 class="h2">Scan not found</h1><p class="lede">Scans are kept in this browser only, and older ones are cleared to save space.</p><p><a class="btn" href="#/">Scan a fit</a></p></section>`;
    }
  } else if (!hasPending() && !getCurrent()) {
    return { redirect: "#/" };
  }
  return html`<div class="wrap"><div data-scan-root></div></div>`;
}

// ---------- helpers ----------

const okStock = (m) => m.availability === "in_stock" || m.availability === "low_stock";
const isOriginal = (m) => m.match === "original" || m.match === "exact";

/** The product itself: the original listing when one was found. */
function primaryMatch(item) {
  const m = item.matches || [];
  return m.find((x) => isOriginal(x) && okStock(x)) || m.find(isOriginal) || m[0] || null;
}

/** Where to buy it right now: in stock first, original before resale. */
function bestMatch(item) {
  const m = item.matches || [];
  return m.find((x) => isOriginal(x) && okStock(x)) || m.find(okStock) || primaryMatch(item);
}

/** Where to put each item's dot: the box centre, nudged apart when two collide. */
function spotPositions(items) {
  const out = [];
  for (const it of items) {
    const b = it.box || { x: 400, y: 400, w: 200, h: 200 };
    let x = (b.x + b.w * (it.category === "outerwear" ? 0.24 : 0.5)) / 10;
    let y = (b.y + b.h * 0.5) / 10;
    for (let tries = 0; tries < 6 && out.some((p) => Math.abs(p.x - x) < 7 && Math.abs(p.y - y) < 6); tries++) x = Math.min(92, x + 9);
    out.push({ x: Math.max(6, Math.min(94, x)), y: Math.max(4, Math.min(96, y)) });
  }
  return out;
}

function storeItem(item) {
  const m = primaryMatch(item);
  return {
    name: item.productName || item.name,
    brand: item.brand || (m && m.brand) || null,
    shop: m ? m.shop : null,
    price: m ? m.price : null,
    currency: m ? m.currency : null,
    status: m ? m.availability : "unknown",
    url: m ? m.url : null,
    img: item.thumbSmall || null,
    query: item.query,
  };
}

/** On-device confidence is a probability; say it in words. */
function confidenceText(p) {
  if (typeof p !== "number") return "";
  return p >= 0.8 ? "Clear match" : p >= 0.5 ? "Good guess" : "Best guess";
}

function resultTag(item, i, scan) {
  const m = primaryMatch(item);
  const alt = m && !okStock(m) ? bestMatch(item) : null;
  const elsewhere = alt && alt !== m && okStock(alt) && alt.price != null ? `elsewhere from ${money(alt.price, alt.currency || "USD")}` : "";
  const key = store.itemKey(storeItem(item));
  const saved = store.isSaved(key);
  const watching = store.isWatching(key);
  const deep = scan.engine === "deep";
  const canWatch = deep && m && m.availability === "sold_out" && m.url;
  return html`<article class="tag tag--result" data-item="${item.id}">
    <button type="button" class="iconbtn iconbtn--like tag__like" data-action="save" aria-pressed="${saved}" aria-label="${saved ? "Remove from closet" : "Save to closet"}">${icon(saved ? "heart-fill" : "heart")}</button>
    <div class="tag__img">${item.thumb ? html`<img src="${item.thumb}" alt="">` : ""}<span class="tag__num">${i + 1}</span></div>
    <div class="tag__body">
      <span class="tag__brand">${item.brand || CATEGORY_NAME[item.category] || item.category}</span>
      <h2 class="tag__name">${item.productName || item.name}</h2>
      <div class="tag__meta">
        ${item.color ? html`<span class="swatch">${item.hex ? html`<i style="--c:${item.hex}"></i>` : ""}${item.color}</span>` : ""}
        ${deep && m && m.price != null ? html`<span class="price">${money(m.price, m.currency || "USD")}</span>` : ""}
        ${deep && m ? statusChip(m.availability, elsewhere || (m.verified ? "checked at shop" : "")) : ""}
        <span class="label">${deep ? CONF[item.confidence] || "" : confidenceText(item.confidence)}</span>
      </div>
      ${canWatch ? html`<div class="tag__actions"><button type="button" class="btn btn--xs ${watching ? "" : "btn--ghost"}" data-action="watch" aria-pressed="${watching}" data-on="Watching" data-off="Alert me when it's back">${icon(watching ? "bell-ringing-fill" : "bell")}<span data-label>${watching ? "Watching" : "Alert me when it's back"}</span></button></div>` : ""}
    </div>
    ${deep && item.matches.length
      ? html`<div class="matches">
          ${item.matches.map(
            (x) => html`<a class="match" ${aAttrs(x.url)}>
              <span class="match__shop">${x.shop}<span class="match__kind ${x.match === "original" ? "match__kind--original" : ""}">${KIND[x.match] || x.match}</span><span class="match__title">${x.title}</span></span>
              <span class="price">${x.price != null ? money(x.price, x.currency || "USD") : ""}</span>
              ${statusChip(x.availability)}
            </a>`,
          )}
          <details><summary class="label" style="cursor:pointer;padding:6px 10px">Search other shops</summary>${shopSearch(item.query, item.id)}</details>
        </div>`
      : shopSearch(item.query, item.id)}
  </article>`;
}

function scanningView(photo) {
  return html`<div class="detail">
    <div class="detail__media">
      <div class="shot" data-results-shot>
        <img src="${photo}" alt="Your photo, being scanned" draggable="false">
        <div class="corners" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div class="scanfx" aria-hidden="true"><div class="scanfx__tint"></div><div class="scanfx__grid"></div><div class="scanfx__laser"></div><div class="scanfx__win" hidden></div></div>
      </div>
    </div>
    <div>
      <div class="detail__head">
        <span class="label" data-engine-label>Scanning</span>
        <h1 class="h2" data-phase>Reading the fit</h1>
      </div>
      <div class="progress">
        <div class="progress__bar is-indeterminate" data-bar><span></span></div>
        <div class="tape" data-tape aria-live="polite"></div>
      </div>
      <div class="tags" style="margin-top:18px" aria-hidden="true">
        ${[0, 1, 2].map(() => html`<div class="skeleton"><i class="ph-img"></i><div class="ph-lines"><i style="height:10px;width:40%"></i><i style="height:16px;width:75%"></i><i style="height:10px;width:55%"></i></div></div>`)}
      </div>
    </div>
  </div>`;
}

function errorView(photo, message) {
  return html`<div class="detail">
    <div class="detail__media">${photo ? html`<div class="shot"><img src="${photo}" alt="Your photo"></div>` : ""}</div>
    <div>
      <div class="detail__head"><span class="label">Scan stopped</span><h1 class="h2">That didn't work</h1></div>
      <p class="notice">${icon("warning")}<span>${message}</span></p>
      <div class="toolbar">
        <button type="button" class="btn" data-retry>${icon("arrows-clockwise")}Try again</button>
        <label class="btn btn--ghost">${icon("upload-simple")}Pick another photo<input type="file" accept="image/*" class="sr-only" data-newfile></label>
      </div>
    </div>
  </div>`;
}

function resultView(scan) {
  const items = scan.items;
  const pos = spotPositions(items);
  const deep = scan.engine === "deep";
  const priced = deep ? items.map(bestMatch).filter((m) => m && m.price != null) : [];
  const totals = {};
  for (const m of priced) totals[m.currency || "USD"] = (totals[m.currency || "USD"] || 0) + m.price;
  const soldCount = deep ? items.filter((it) => (primaryMatch(it) || {}).availability === "sold_out").length : 0;
  return html`<div class="detail">
    <div class="detail__media">
      <div data-results-shot>
        ${shot({
          src: scan.photo,
          alt: "Your photo",
          frame: false,
          eager: true,
          spots: items.map((it, i) => ({ ...pos[i], label: it.productName || it.name, sold: deep && (primaryMatch(it) || {}).availability === "sold_out" })),
          boxes: items.map((it) => it.box),
        })}
      </div>
      <div class="toolbar">
        <button type="button" class="btn btn--sm btn--ghost" data-draw aria-pressed="false">${icon("selection-plus")}<span>Draw to search</span></button>
        <button type="button" class="btn btn--sm btn--ghost" data-receipt ${items.length ? "" : "disabled"}>${icon("receipt")}Share receipt</button>
        <span class="spacer"></span>
        <label class="btn btn--sm">${icon("scan")}New scan<input type="file" accept="image/*" class="sr-only" data-newfile></label>
      </div>
      <p class="muted" data-draw-hint hidden style="font-size:.88rem">Drag a box around any piece to look it up.</p>
    </div>
    <div>
      <div class="detail__head">
        <span class="label">${deep ? (scan.cached ? "Deep scan, from recent scans" : "Deep scan") : "Quick scan, on your device"}</span>
        <h1 class="h2" data-count-title>${items.length ? `${items.length} piece${items.length > 1 ? "s" : ""} found` : "No clothes spotted"}</h1>
        ${scan.vibe || scan.summary ? html`<div class="byline">${scan.vibe ? html`<span class="vibe">${scan.vibe}</span>` : ""}<span>${scan.summary}</span></div>` : ""}
        ${soldCount ? html`<div class="byline"><span>${soldCount} sold out. Turn on alerts and we'll tell you when ${soldCount > 1 ? "they're" : "it's"} back.</span></div>` : ""}
      </div>
      ${scan.notice ? html`<p class="notice">${icon("info")}<span>${scan.notice}</span></p>` : ""}
      ${!deep ? html`<p class="notice">${icon("lightning")}<span>Each piece is named from the photo. Tap a shop to see matching products, and edit the search words if the colour or style is off.</span></p>` : ""}
      ${items.length
        ? html`<div class="tags" data-tags>${items.map((it, i) => html`<div style="--i:${i}">${resultTag(it, i, scan)}</div>`)}</div>`
        : html`<div class="empty" style="margin-bottom:0">${icon("t-shirt")}<p>We couldn't make out any clothes. Try a photo where the outfit fills more of the frame, or draw a box around a piece.</p><button type="button" class="btn btn--sm" data-draw-cta>${icon("selection-plus")}Draw a box</button></div>`}
      ${Object.keys(totals).length ? html`<div class="total"><span class="total__label">The whole fit</span><span class="total__value">${Object.entries(totals).map(([c, v]) => money(v, c)).join(" + ")}<small>best price for ${priced.length} of ${items.length} pieces</small></span></div>` : ""}
    </div>
  </div>`;
}

// ---------- persistence ----------

function reencode(src, maxSide, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

async function persist(scan) {
  const photo = await reencode(scan.photo, 720, 0.78);
  const { upload, blob, ...rest } = scan;
  // Keep only the small thumbnails: storage is limited.
  store.saveScan({ ...rest, photo, items: scan.items.map(({ thumb, ...it }) => it) });
}

function waitForImage(img) {
  if (img.complete && img.naturalWidth) return Promise.resolve();
  return new Promise((r) => {
    img.onload = () => r();
    img.onerror = () => r();
  });
}

// ---------- mount ----------

function mount(root, [id]) {
  const host = root.querySelector("[data-scan-root]");
  if (!host) return;
  let alive = true;
  let abort = null;
  const offs = [];
  let prepared = null;
  let scan = null;

  const tape = () => host.querySelector("[data-tape]");
  const addLine = (k, v) => {
    const t = tape();
    if (!t) return null;
    const line = document.createElement("div");
    line.className = "log__line";
    line.innerHTML = html`<span class="k">${k}</span><span>${v}</span>`.s;
    t.appendChild(line);
    while (t.children.length > 9) t.firstElementChild.remove();
    return line;
  };

  const setLaserTravel = () => {
    const s = host.querySelector("[data-results-shot]");
    if (s) s.style.setProperty("--travel", Math.max(40, s.clientHeight - 2) + "px");
  };

  function showResult() {
    host.innerHTML = resultView(scan).s;
    wireResult();
  }

  function addThumbs(imgEl) {
    for (const it of scan.items) {
      if (!it.thumb) it.thumb = cropThumb(imgEl, it.box, 240);
      if (!it.thumbSmall) it.thumbSmall = cropThumb(imgEl, it.box, 120);
    }
  }

  async function start(file) {
    abort && abort.abort();
    abort = new AbortController();
    const myAbort = abort;
    try {
      prepared = await prepareImage(file);
    } catch (err) {
      if (!alive) return;
      host.innerHTML = errorView(null, err instanceof ImageError ? err.message : "That image could not be read.").s;
      wireError(file);
      return;
    }
    if (!alive) return;
    host.innerHTML = scanningView(prepared.photo).s;
    const shotEl = host.querySelector("[data-results-shot]");
    await waitForImage(shotEl.querySelector("img"));
    setLaserTravel();
    const ro = new ResizeObserver(setLaserTravel);
    ro.observe(shotEl);
    offs.push(() => ro.disconnect());

    const phase = host.querySelector("[data-phase]");
    const bar = host.querySelector("[data-bar]");
    const engineLabel = host.querySelector("[data-engine-label]");
    const winEl = host.querySelector(".scanfx__win");
    let loadingLine = null;
    let shownScanning = false;
    addLine("photo", `${prepared.width} x ${prepared.height}`);

    const onProgress = (ev) => {
      if (!alive) return;
      if (ev.engine === "deep") {
        engineLabel.textContent = "Deep scan";
        if (ev.t === "status") {
          phase.textContent = ev.msg;
          addLine("step", ev.msg);
        } else if (ev.t === "search") addLine("search", `"${ev.q}"`);
        else if (ev.t === "fetch") addLine("open", ev.host);
        else if (ev.t === "found") addLine("found", `${ev.n} results`);
      } else if (ev.stage === "loading") {
        engineLabel.textContent = "Quick scan, on your device";
        phase.textContent = "Loading the scanner";
        bar.classList.remove("is-indeterminate");
        bar.style.setProperty("--p", ev.progress.toFixed(3));
        const txt = `downloading ${Math.round(ev.progress * 100)}% (first scan only)`;
        if (!loadingLine) loadingLine = addLine("model", txt);
        else loadingLine.lastElementChild.textContent = txt;
      } else if (ev.stage === "scanning") {
        engineLabel.textContent = "Quick scan, on your device";
        if (!shownScanning) {
          shownScanning = true;
          phase.textContent = "Looking for clothes";
          addLine("scan", "checking every part of the photo");
        }
        bar.classList.remove("is-indeterminate");
        bar.style.setProperty("--p", ev.progress.toFixed(3));
        if (ev.win && !reduceMotion()) {
          winEl.hidden = false;
          Object.assign(winEl.style, { left: ev.win.x * 100 + "%", top: ev.win.y * 100 + "%", width: ev.win.w * 100 + "%", height: ev.win.h * 100 + "%" });
        }
      }
    };

    try {
      const result = await runScan(prepared, { onProgress, signal: myAbort.signal });
      if (!alive || myAbort.signal.aborted) return;
      bar.classList.remove("is-indeterminate");
      bar.style.setProperty("--p", "1");
      addLine("done", `${result.items.length} piece${result.items.length === 1 ? "" : "s"}`);
      scan = { ...result, upload: prepared.upload, blob: prepared.blob };
      addThumbs(shotEl.querySelector("img"));
      setCurrent(scan);
      await new Promise((r) => setTimeout(r, reduceMotion() ? 0 : 450));
      if (!alive) return;
      showResult();
      persist(scan).catch(() => {});
      history.replaceState(null, "", "#/scan/" + scan.id);
      window.dispatchEvent(new Event("fs:pathsync"));
    } catch (err) {
      if (!alive || (err && err.name === "AbortError")) return;
      console.error(err);
      host.innerHTML = errorView(prepared.photo, (err && err.message) || "The scan failed.").s;
      wireError(file);
    }
  }

  function wireError(file) {
    const retry = host.querySelector("[data-retry]");
    retry && retry.addEventListener("click", () => start(file));
    wireNewFile();
  }

  function wireNewFile() {
    const input = host.querySelector("[data-newfile]");
    input &&
      input.addEventListener("change", () => {
        const f = input.files && input.files[0];
        if (f) startScan(f);
      });
  }

  function itemFromTag(el) {
    const it = scan.items.find((x) => x.id === el.dataset.item);
    return it ? storeItem(it) : null;
  }

  function wireResult() {
    wireNewFile();

    // ---- draw a box to look up one piece ----
    const drawBtn = host.querySelector("[data-draw]");
    const hint = host.querySelector("[data-draw-hint]");
    const frame = host.querySelector("[data-results-shot] .shot");
    const img = frame.querySelector("img");
    let drawing = false;
    const setDrawing = (on) => {
      drawing = on;
      frame.classList.toggle("is-drawing", on);
      drawBtn.setAttribute("aria-pressed", String(on));
      drawBtn.querySelector("span").textContent = on ? "Cancel" : "Draw to search";
      hint.hidden = !on;
    };
    drawBtn.addEventListener("click", () => setDrawing(!drawing));
    const cta = host.querySelector("[data-draw-cta]");
    cta && cta.addEventListener("click", () => {
      setDrawing(true);
      frame.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    });

    let startPt = null;
    let box = null;
    const rel = (e) => {
      const r = img.getBoundingClientRect();
      return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
    };
    frame.addEventListener("pointerdown", (e) => {
      if (!drawing || e.target.closest(".hotspot")) return;
      e.preventDefault();
      frame.setPointerCapture(e.pointerId);
      startPt = rel(e);
      box = document.createElement("div");
      box.className = "drawbox";
      frame.appendChild(box);
    });
    frame.addEventListener("pointermove", (e) => {
      if (!startPt || !box) return;
      const p = rel(e);
      Object.assign(box.style, {
        left: Math.min(p.x, startPt.x) * 100 + "%",
        top: Math.min(p.y, startPt.y) * 100 + "%",
        width: Math.abs(p.x - startPt.x) * 100 + "%",
        height: Math.abs(p.y - startPt.y) * 100 + "%",
      });
    });
    const finish = async (e) => {
      if (!startPt) return;
      const p = rel(e);
      const region = { x: Math.min(p.x, startPt.x), y: Math.min(p.y, startPt.y), w: Math.abs(p.x - startPt.x), h: Math.abs(p.y - startPt.y) };
      startPt = null;
      if (region.w < 0.05 || region.h < 0.04) {
        box && box.remove();
        box = null;
        toast("Drag a bigger box around the piece");
        return;
      }
      setDrawing(false);
      const pendingBox = box;
      box = null;
      pendingBox.classList.add("is-pending");
      toast("Looking it up...");
      try {
        const blob = scan.blob || (await (await fetch(scan.photo)).blob());
        const item = await runRegion(scan, region, blob);
        if (!alive) return;
        item.thumb = cropThumb(img, item.box, 240);
        item.thumbSmall = cropThumb(img, item.box, 120);
        scan.items = [item, ...scan.items];
        showResult();
        persist(scan).catch(() => {});
        const firstTag = host.querySelector(".tags .tag");
        firstTag && firstTag.classList.add("is-active");
        toast(`Found: ${item.name}`);
      } catch (err) {
        pendingBox.remove();
        toast((err && err.message) || "Couldn't identify that piece.");
      }
    };
    frame.addEventListener("pointerup", finish);
    frame.addEventListener("pointercancel", () => {
      startPt = null;
      box && box.remove();
      box = null;
    });
  }

  // Listeners on the host survive re-renders, so they are bound once here.
  offs.push(linkSpotsAndTags(host));
  offs.push(bindTagActions(host, itemFromTag));
  host.addEventListener("input", (e) => {
    const input = e.target.closest && e.target.closest("[data-query]");
    if (!input || !scan) return;
    const it = scan.items.find((x) => x.id === input.dataset.query);
    if (it) it.query = input.value;
    updateShopLinks(host, input.dataset.query, input.value);
  });
  host.addEventListener("keydown", (e) => {
    const input = e.target.closest && e.target.closest("[data-query]");
    if (input && e.key === "Enter") {
      const first = host.querySelector(`[data-shops="${CSS.escape(input.dataset.query)}"] a`);
      first && first.click();
    }
  });
  host.addEventListener("click", (e) => {
    if (!e.target.closest("[data-receipt]") || !scan) return;
    const pos = spotPositions(scan.items);
    openReceipt({
      title: scan.vibe || "My fit",
      by: `${scan.items.length} piece${scan.items.length === 1 ? "" : "s"}, sourced`,
      photo: scan.photo,
      items: scan.items.map((it, i) => {
        const m = bestMatch(it);
        return { name: it.productName || it.name, brand: it.brand || (m && m.shop) || it.color, price: m ? m.price : null, currency: m ? m.currency : null, status: m ? m.availability : null, x: pos[i].x, y: pos[i].y };
      }),
    }).catch(() => toast("Couldn't make the receipt. Try again."));
  });

  // ---- decide what to show ----
  const onNew = () => {
    const f = takePending();
    if (f) start(f);
  };
  window.addEventListener("fs:newscan", onNew);
  offs.push(() => window.removeEventListener("fs:newscan", onNew));

  const pendingFile = takePending();
  if (pendingFile) start(pendingFile);
  else if (id) {
    const cur = getCurrent();
    scan = cur && cur.id === id ? cur : store.getScan(id);
    if (scan) {
      scan.items.forEach((it) => (it.thumb = it.thumb || it.thumbSmall));
      showResult();
    }
  } else if (getCurrent()) {
    scan = getCurrent();
    showResult();
  }

  return () => {
    alive = false;
    abort && abort.abort();
    offs.forEach((f) => f && f());
  };
}

export default { render, mount };
