import { html, icon } from "../ui.js";
import { CONFIG } from "../config.js";
import { findFit } from "../data/fits.js";
import { shot, fitImg } from "../components.js";

function render() {
  const contact = CONFIG.contactEmail ? `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent("FitSource partnership")}` : null;
  return html`
  <div class="wrap">
    <section class="brand-hero">
      <div>
        <h1 class="display" style="font-size:clamp(2.2rem,4.4vw,3.9rem)">Every scan is someone asking for your product</h1>
      </div>
      <div>
        <p class="lede" style="margin-bottom:22px">People screenshot fits all day and can't tell where the pieces are from. FitSource sends them to the shop that sells it, and tells brands what people want.</p>
        ${contact ? html`<a class="btn btn--accent" href="${contact}">${icon("megaphone")}Partner with us</a>` : html`<span class="muted">Brand partnerships open with the public launch.</span>`}
      </div>
    </section>

    <section class="brand-strip" aria-label="Fits that send shoppers to brands">
      ${["created-by-god", "shop-floor", "butter-hour"].map((id, i) => {
        const f = findFit(id);
        return html`<a href="#/fit/${id}" class="brand-strip__item" data-reveal style="--d:${i}">${shot({ src: fitImg(f, true), alt: `${f.title}: ${f.items.map((x) => x.name).join(", ")}`, spots: f.items.map((x) => ({ x: x.x, y: x.y, label: x.brand ? `${x.brand}: ${x.name}` : x.name })) })}</a>`;
      })}
    </section>

    <section class="offers" aria-label="What brands get">
      <div class="offer" data-reveal>${icon("seal-check")}<h2 class="h3">Verified source</h2><p>Claim your products and your own store is listed first, with a verified badge, every time one of them is scanned.</p></div>
      <div class="offer" data-reveal style="--d:1">${icon("chart-line-up")}<h2 class="h3">Demand you can see</h2><p>Which pieces get scanned, from which fits, and how many people wanted one while it was sold out. Restock with numbers, not guesses.</p></div>
      <div class="offer" data-reveal style="--d:2">${icon("users-three")}<h2 class="h3">Creator matches</h2><p>See the creators whose fits drive scans of your pieces, and reach them through the creator programme.</p></div>
      <div class="offer" data-reveal style="--d:3">${icon("tag")}<h2 class="h3">Similar-item placements</h2><p>Appear as an in-stock alternative when a lookalike sells out. Always labelled as sponsored, never mixed into exact matches.</p></div>
    </section>

    <section class="section">
      <h2 class="h2" data-reveal style="margin-bottom:28px">How FitSource earns, and stays free</h2>
      <div class="money-flow">
        <div class="flow-step" data-reveal>${icon("scan")}<h3 class="h3">A shopper scans a fit</h3><p>Free, with no account. Quick scans run on their phone.</p></div>
        <div class="flow-step" data-reveal style="--d:1">${icon("storefront")}<h3 class="h3">FitSource finds the shop</h3><p>The original store first, then other stores, resale and lookalikes.</p></div>
        <div class="flow-step" data-reveal style="--d:2">${icon("shopping-bag")}<h3 class="h3">They buy from the shop</h3><p>At the shop's normal price. The shop pays a referral commission through affiliate networks.</p></div>
        <div class="flow-step" data-reveal style="--d:3">${icon("chart-line-up")}<h3 class="h3">Brands get the signal</h3><p>Demand data and placements are paid plans for brands. Creators share in the commission their fits earn.</p></div>
      </div>
    </section>
  </div>`;
}

export default { render };
