// Building blocks used across views: the shoppable photo, swing tags, feed cards.
import { html, icon, money, statusChip, compact, count, esc, CATEGORY_NAME } from "./ui.js";
import { linkAttrs, queryFor, NEW_SHOPS, RESALE_SHOPS } from "./shop.js";
import { itemKey, isSaved, isWatching, likes } from "./store.js";

export const fitImg = (fit, small = false) => `assets/img/fits/${fit.img}${small ? "-sm" : ""}.jpg`;
export const productImg = (item) => (item.img ? (item.img.startsWith("data:") ? item.img : `assets/img/products/${item.img}.jpg`) : null);

/** Anchor attributes as a string. */
export function aAttrs(url) {
  const a = linkAttrs(url);
  if (!a) return null;
  return html`href="${a.href}"${a.target ? html` target="${a.target}" rel="${a.rel}"` : ""}`;
}

/**
 * A photo with numbered dots on each item.
 * spots: [{ x, y (percent), label, sold }]
 */
export function shot({ src, srcset, alt, spots = [], boxes = [], frame = true, eager = false, cls = "" }) {
  return html`<div class="shot ${frame ? "shot--frame" : ""} ${cls}">
    <img src="${src}" ${srcset ? html`srcset="${srcset}" sizes="(max-width: 760px) 50vw, 25vw"` : ""} alt="${alt}" ${eager ? html`fetchpriority="high"` : html`loading="lazy"`} decoding="async" draggable="false">
    ${boxes.map((b, i) => html`<span class="box" data-box="${i}" style="--x:${b.x / 10}%;--y:${b.y / 10}%;--w:${b.w / 10}%;--h:${b.h / 10}%"></span>`)}
    ${spots.map(
      (s, i) => html`<button type="button" class="hotspot ${s.sold ? "hotspot--sold" : ""} ${s.x > 62 ? "hotspot--flip" : ""}" data-spot="${i}" style="--x:${s.x}%;--y:${s.y}%;--i:${i}" aria-label="${i + 1}: ${s.label}">${i + 1}<span class="hotspot__label"><bdi>${s.label}</bdi></span></button>`,
    )}
  </div>`;
}

export function sizesRow(sizes) {
  if (!sizes || !sizes.length) return "";
  return html`<div class="sizes" aria-label="מידות">${sizes.map((z) => html`<span class="size ${z.ok ? "" : "is-out"}" title="${z.ok ? "זמינה" : "אזלה"}">${z.s}</span>`)}</div>`;
}

function stockExtra(item) {
  if (item.status === "low_stock" && item.sizes) {
    const left = item.sizes.filter((z) => z.ok).length;
    return left ? (left === 1 ? "נשארה מידה אחת" : `נשארו ${left} מידות`) : "";
  }
  if (item.status === "sold_out" && item.resale) return `יד שנייה מ־${money(item.resale, item.currency)}`;
  return "";
}

/** Swing tag for a curated feed item. */
export function feedTag(item, i, { fitId, mini = false } = {}) {
  const key = itemKey(item);
  const saved = isSaved(key);
  const watching = isWatching(key);
  const shopUrl = item.url || NEW_SHOPS[0].url(item.query);
  const shopLabel = item.url ? (item.shop ? `לקנייה ב־${item.shop}` : "לקנייה") : "דומים בחנויות";
  const a = aAttrs(shopUrl);
  return html`<article class="tag ${mini ? "tag--mini" : ""}" data-item="${item.id}" data-fit="${fitId || ""}">
    <div class="tag__img">${productImg(item) ? html`<img src="${productImg(item)}" alt="" loading="lazy" decoding="async">` : ""}<span class="tag__num">${i + 1}</span></div>
    <div class="tag__body">
      <span class="tag__brand"><bdi>${item.brand || CATEGORY_NAME[item.category] || item.category}</bdi></span>
      ${mini ? html`<p class="tag__name"><bdi>${item.name}</bdi></p>` : html`<h2 class="tag__name"><bdi>${item.name}</bdi></h2>`}
      <div class="tag__meta">
        ${item.price != null ? html`<span class="price">${money(item.price, item.currency)}</span>` : ""}
        ${statusChip(item.status, stockExtra(item))}
      </div>
      ${mini ? "" : sizesRow(item.sizes)}
      ${mini
        ? ""
        : html`<div class="tag__actions">
            ${a ? html`<a class="btn btn--xs ${item.status === "sold_out" ? "btn--ghost" : ""}" ${a}>${icon("arrow-up-right")}${shopLabel}</a>` : ""}
            ${item.status === "sold_out" ? html`<a class="btn btn--xs btn--ghost" ${aAttrs(RESALE_SHOPS[0].url(item.query))}>${icon("recycle")}יד שנייה</a>` : ""}
            <span class="spacer"></span>
            ${item.status === "sold_out"
              ? html`<button type="button" class="iconbtn" data-action="watch" aria-pressed="${watching}" ${item.url ? "" : html`disabled title="התראת מלאי צריכה קישור לחנות"`} aria-label="${watching ? "ביטול התראת מלאי" : "עדכנו אותי כשיחזור למלאי"}">${icon(watching ? "bell-ringing-fill" : "bell")}</button>`
              : ""}
            <button type="button" class="iconbtn iconbtn--like" data-action="save" aria-pressed="${saved}" aria-label="${saved ? "הסרה מהארון" : "שמירה בארון"}">${icon(saved ? "heart-fill" : "heart")}</button>
          </div>`}
    </div>
  </article>`;
}

/** Search-the-shops block (used when we know what an item is, but not which exact product). */
export function shopSearch(query, id, queryEn = "") {
  return html`<div class="search-shops">
    <label class="query">
      <span class="sr-only">מילות חיפוש</span>
      ${icon("magnifying-glass", "muted")}
      <input type="text" value="${query}" data-query="${id}" autocomplete="off" spellcheck="false" enterkeyhint="search">
    </label>
    <div class="shoprow" data-shops="${id}">
      <span class="label">חדש</span>
      ${NEW_SHOPS.map((s) => html`<a class="shoplink" data-shop="${s.id}" ${aAttrs(s.url(queryFor(s, query, queryEn)))}>${s.name}${icon("arrow-up-right")}</a>`)}
    </div>
    <div class="shoprow" data-shops="${id}">
      <span class="label">יד שנייה</span>
      ${RESALE_SHOPS.map((s) => html`<a class="shoplink" data-shop="${s.id}" ${aAttrs(s.url(queryFor(s, query, queryEn)))}>${s.name}${icon("arrow-up-right")}</a>`)}
    </div>
  </div>`;
}

/** Re-point the shop links in a block after the user edits the search words (their words go to every shop). */
export function updateShopLinks(root, id, query) {
  const all = [...NEW_SHOPS, ...RESALE_SHOPS];
  root.querySelectorAll(`[data-shops="${CSS.escape(id)}"] a[data-shop]`).forEach((a) => {
    const shop = all.find((s) => s.id === a.dataset.shop);
    const attrs = shop && linkAttrs(shop.url(query));
    if (attrs) a.href = attrs.href;
  });
}

/** Price of the whole fit, per currency, ignoring unpriced items. */
export function fitTotal(items) {
  const sums = {};
  for (const it of items) if (it.price != null) sums[it.currency || "ILS"] = (sums[it.currency || "ILS"] || 0) + it.price;
  return sums;
}

/** Feed card. */
export function card(fit, { feature = false, delay = 0 } = {}) {
  const liked = likes().has(fit.id);
  const sold = fit.items.filter((i) => i.status === "sold_out").length;
  return html`<a class="card ${feature ? "card--feature" : ""}" href="#/fit/${fit.id}" data-reveal style="--d:${delay}" aria-label="${fit.title} של ‎@${fit.handle}, ${count(fit.items.length, "פריט אחד", "פריטים")}">
    ${shot({
      src: fitImg(fit, !feature),
      srcset: feature ? null : `${fitImg(fit, true)} 480w, ${fitImg(fit)} 900w`,
      alt: `${fit.title}: ${fit.items.map((i) => i.name).join(", ")}`,
      spots: fit.items.map((i) => ({ x: i.x, y: i.y, label: i.name, sold: i.status === "sold_out" })),
    })}
    <div class="card__meta">
      <div>
        <div class="card__title">${fit.title}</div>
        <div class="card__by"><bdi>@${fit.handle}</bdi>${fit.verified ? icon("seal-check") : ""}</div>
      </div>
      <div class="card__right">
        <div>${liked ? compact(fit.likes + 1) : compact(fit.likes)} לייקים</div>
        <div>${sold ? html`<span class="sold">${sold === 1 ? "פריט אחד אזל" : `${sold} אזלו`}</span>` : count(fit.items.length, "פריט אחד", "פריטים")}</div>
      </div>
    </div>
  </a>`;
}

export const logoSvg = html`<svg class="logo__mark" viewBox="0 0 28 28" aria-hidden="true"><path d="M2 9V4a2 2 0 0 1 2-2h5M19 2h5a2 2 0 0 1 2 2v5M26 19v5a2 2 0 0 1-2 2h-5M9 26H4a2 2 0 0 1-2-2v-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle class="dot" cx="14" cy="14" r="5"/></svg>`;

export { esc };
