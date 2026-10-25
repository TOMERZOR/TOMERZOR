import { html, icon, compact, count, postedAgo, toast, reduceMotion } from "../ui.js";
import { href } from "../router.js";
import { FITS, findFit } from "../data/fits.js";
import { pageMeta } from "../seo.js";
import { shot, feedTag, card, fitImg, totalBlock, breadcrumbs } from "../components.js";
import { waBar, fitMessage, askFitMessage } from "../whatsapp.js";
import * as store from "../store.js";
import { openReceipt } from "../share.js";
import { bindTagActions, linkSpotsAndTags } from "./shared.js";

function fitTotalBlock(fit) {
  const priced = fit.items.filter((i) => i.price != null).map((i) => ({ price: i.price, currency: i.currency, owned: store.isOwned(store.ownKey("fit", fit.id, i.id)) }));
  return totalBlock(priced, count(priced.length, "פריט אחד עם מחיר", "פריטים עם מחיר"));
}

function render([id]) {
  const fit = findFit(id);
  if (!fit) return html`<section class="wrap pagehead"><h1 class="h2">הלוק לא נמצא</h1><p class="lede">ייתכן שהוא הוסר.</p><p><a class="btn" href="${href("feed")}">חזרה לפיד</a></p></section>`;
  const liked = store.likes().has(fit.id);
  const more = FITS.filter((f) => f.id !== fit.id).sort((a, b) => (b.vibe === fit.vibe) - (a.vibe === fit.vibe) || b.scans - a.scans).slice(0, 6);
  const sold = fit.items.filter((i) => i.status === "sold_out").length;
  return html`
  <div class="wrap">
    ${breadcrumbs(pageMeta(`fit/${fit.id}`).breadcrumbs)}
    <div class="detail">
      <div class="detail__media">
        ${shot({
          src: fitImg(fit),
          alt: `${fit.title} של ‎@${fit.handle}: ${fit.items.map((i) => i.name).join(", ")}`,
          spots: fit.items.map((i) => ({ x: i.x, y: i.y, label: i.name, sold: i.status === "sold_out" })),
          frame: false,
          eager: true,
        })}
        <div class="toolbar">
          <button type="button" class="btn btn--sm btn--ghost" data-like aria-pressed="${String(liked)}">${icon(liked ? "heart-fill" : "heart")}<span data-like-count>${compact(fit.likes + (liked ? 1 : 0))}</span></button>
          <button type="button" class="btn btn--sm btn--ghost" data-receipt>${icon("receipt")}קבלה לשיתוף</button>
          <span class="spacer"></span>
          <a class="btn btn--sm" href="${href("")}">${icon("scan")}סרקו לוק משלכם</a>
        </div>
        ${waBar(fitMessage(fit), askFitMessage(fit))}
      </div>
      <div>
        <div class="detail__head">
          <div class="byline"><span class="vibe">${fit.vibe}</span><span>${compact(fit.scans)} סריקות</span>${sold ? html`<span>${sold === 1 ? "פריט אחד אזל" : `${sold} אזלו`}</span>` : ""}</div>
          <h1 class="h2">${fit.title}</h1>
          <div class="byline"><strong><bdi>@${fit.handle}</bdi></strong>${fit.verified ? icon("seal-check") : ""}<span>פורסם ${postedAgo(fit.posted)}</span></div>
        </div>
        ${fit.real ? "" : html`<p class="notice">${icon("info")}<span>לוק לדוגמה עם מותגים בדויים. כפתורי הקנייה מחפשים פריטים דומים.</span></p>`}
        <div class="tags">${fit.items.map((it, i) => html`<div style="--i:${i}" class="tag-wrap">${feedTag(it, i, { fitId: fit.id })}</div>`)}</div>
        <div data-total-slot>${fitTotalBlock(fit)}</div>
      </div>
    </div>
    <section class="section" style="padding-top:24px">
      <div class="section__head"><h2 class="h2" data-reveal>עוד בסגנון</h2><a class="link-arrow" href="${href("feed")}">כל הלוקים ${icon("arrow-right")}</a></div>
      <div class="rail">${more.map((f, i) => card(f, { delay: i }))}</div>
    </section>
  </div>`;
}

function mount(root, [id]) {
  const fit = findFit(id);
  if (!fit) return;
  const offs = [];
  offs.push(linkSpotsAndTags(root));
  offs.push(
    bindTagActions(
      root,
      (el) => {
        const it = fit.items.find((x) => x.id === el.dataset.item);
        return it ? { ...it, fitId: fit.id } : null;
      },
      { onOwned: () => (root.querySelector("[data-total-slot]").innerHTML = String(fitTotalBlock(fit))) },
    ),
  );
  const likeBtn = root.querySelector("[data-like]");
  likeBtn.addEventListener("click", () => {
    const on = store.toggleLike(fit.id);
    likeBtn.setAttribute("aria-pressed", String(on));
    likeBtn.querySelector("use").setAttribute("href", on ? "#i-heart-fill" : "#i-heart");
    likeBtn.querySelector("[data-like-count]").textContent = compact(fit.likes + (on ? 1 : 0));
    if (on && !reduceMotion()) likeBtn.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
  });
  root.querySelector("[data-receipt]").addEventListener("click", () =>
    openReceipt({
      title: fit.title,
      by: "@" + fit.handle,
      photo: fitImg(fit),
      items: fit.items.map((i) => ({ name: i.name, brand: i.brand, price: i.price, currency: i.currency, status: i.status, x: i.x, y: i.y })),
    }).catch(() => toast("לא הצלחנו ליצור את הקבלה. נסו שוב.")),
  );
  return () => offs.forEach((f) => f && f());
}

export default { render, mount };
