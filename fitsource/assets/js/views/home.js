import { html, icon, reduceMotion } from "../ui.js";
import { FITS, findFit } from "../data/fits.js";
import { shot, feedTag, card, fitImg } from "../components.js";
import { startScan } from "../state.js";
import { deepScanStatus } from "../scan/engine.js";
import { warmUp } from "../scan/ondevice.js";

const DEMO_FIT = "night-shift";
const SAMPLES = ["slab-day", "butter-hour", "trail-mix"];

function render() {
  const demo = findFit(DEMO_FIT);
  const trending = [...FITS].sort((a, b) => b.scans - a.scans).slice(0, 8);
  const soldItem = demo.items.find((i) => i.status === "sold_out");
  const tm = findFit("trail-mix");
  return html`
  <section class="hero">
    <div class="wrap hero__grid">
      <div>
        <h1 class="display hero__title">
          <span class="line"><span style="--d:0">Find the shop</span></span>
          <span class="line"><span style="--d:1">behind <span class="hl">any fit</span></span></span>
        </h1>
        <p class="lede">Drop a screenshot from anywhere. We name every piece, find where it's sold, and flag what's sold out.</p>
        <div class="drop" data-drop>
          <div class="drop__row">
            <label class="btn btn--accent">
              ${icon("upload-simple")}Choose a photo
              <input type="file" accept="image/*" class="sr-only" data-file>
            </label>
            <span class="drop__hint">or drag it in, or paste with <kbd>Ctrl</kbd> <kbd>V</kbd></span>
          </div>
          <p class="drop__error" role="alert" data-error></p>
          <div class="drop__samples">
            <span>No photo handy? Try one:</span>
            ${SAMPLES.map((id) => {
              const f = findFit(id);
              return html`<button type="button" class="sample" data-sample="${id}" aria-label="Scan the ${f.title} sample photo"><img src="${fitImg(f, true)}" alt="" loading="lazy"></button>`;
            })}
            <span class="engine-note" data-engine>${icon("lock-simple")}<span>Quick scans run on your device. Your photo isn't uploaded.</span></span>
          </div>
        </div>
      </div>
      <div class="demo" data-demo>
        ${shot({
          src: fitImg(demo),
          alt: `${demo.title}: ${demo.items.map((i) => i.name).join(", ")}`,
          spots: demo.items.map((i) => ({ x: i.x, y: i.y, label: i.name, sold: i.status === "sold_out" })),
          eager: true,
          cls: "demo__shot",
        })}
        <div class="demo__tag" data-demo-tag>${feedTag(demo.items[0], 0, { fitId: demo.id, mini: true })}</div>
        <div class="demo__caption"><span>${demo.title} by @${demo.handle}</span><a href="#/fit/${demo.id}">Open fit ${icon("arrow-right")}</a></div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="section__head">
        <h2 class="h2" data-reveal>Trending now</h2>
        <a class="link-arrow" href="#/feed" data-reveal>See the feed ${icon("arrow-right")}</a>
      </div>
      <div class="rail">${trending.map((f, i) => card(f, { delay: i }))}</div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section__head"><h2 class="h2" data-reveal>From screenshot<br>to checkout</h2></div>
      <div class="bento">
        <div class="cell cell--a" data-reveal>
          <h3 class="cell__big">Every piece, sourced</h3>
          <p>FitSource reads the photo, names each piece, and searches shops for the original. Deep scans check the stock at every shop it finds.</p>
          <div class="cell__visual">
            ${shot({ src: fitImg(tm, true), alt: `${tm.title} being scanned`, spots: tm.items.map((i) => ({ x: i.x, y: i.y, label: i.name, sold: i.status === "sold_out" })) })}
            <div class="log" data-demo-log aria-hidden="true"></div>
          </div>
        </div>
        <div class="cell cell--b" data-reveal style="--d:1">
          <h3 class="cell__big">Any screenshot works</h3>
          <p>TikTok, Instagram, Pinterest, a friend's story. If you can see the fit, you can scan it.</p>
          <div class="shots-row" aria-hidden="true">${["varsity-rewind", "linen-season", "shop-floor"].map((id) => html`<img src="${fitImg(findFit(id), true)}" alt="" loading="lazy">`)}</div>
        </div>
        <div class="cell cell--c" data-reveal style="--d:2">
          ${icon("lock-simple")}
          <h3 class="h3">Your photo stays yours</h3>
          <p>Quick scans run right in your browser. Nothing is uploaded, nothing is kept.</p>
          <div class="ledger" aria-hidden="true"><div>photo uploaded<b>never</b></div><div>runs on<b>your device</b></div><div>account needed<b>no</b></div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap split">
      <div class="split__visual" data-reveal>
        ${feedTag(soldItem, 0, { fitId: demo.id, mini: true })}
        ${feedTag({ ...soldItem, id: "demo-resale", brand: "Resale listing", name: soldItem.name + ", worn twice", price: soldItem.resale, status: "in_stock" }, 1, { mini: true })}
        ${feedTag(findFit("null-signal").items[0], 2, { mini: true })}
      </div>
      <div>
        <h2 class="h2" data-reveal>Sold out isn't<br>the end</h2>
        <ul class="points">
          <li data-reveal style="--d:1"><span class="ico">${icon("bell")}</span><div><strong>Restock alerts</strong><span>Watch a sold-out piece. FitSource checks the shop and tells you when it's back.</span></div></li>
          <li data-reveal style="--d:2"><span class="ico">${icon("recycle")}</span><div><strong>Resale, one tap away</strong><span>Jump straight to the same piece on Depop, Vinted, eBay and Grailed.</span></div></li>
          <li data-reveal style="--d:3"><span class="ico">${icon("tag")}</span><div><strong>Lookalikes in stock</strong><span>Close matches at other price points, so the fit is never out of reach.</span></div></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="band" data-reveal>
        <div>
          <h2 class="h2">Free for you.<br>Here's the deal.</h2>
        </div>
        <div>
          <p>Shops pay FitSource a small commission when you buy through some of our links. You pay the same price, and it never changes what we show you. Brands can also claim their products and see what people are hunting for.</p>
          <div class="band__actions">
            <a class="btn btn--accent" href="#/feed">${icon("squares-four")}Browse the feed</a>
            <a class="btn btn--ghost" href="#/brands">For brands</a>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

const LOG_LINES = [
  ["read", "4 pieces in the photo"],
  ["search", "olive 3-layer shell jacket"],
  ["open", "northpine.com"],
  ["stock", "Ridge 3L Shell: in stock"],
  ["search", "beige nylon cargo pant cuffed"],
  ["stock", "Trail Cargo: sold out"],
  ["resale", "found on Grailed from $85"],
];

function mount(root) {
  const timers = [];
  const errorEl = root.querySelector("[data-error]");
  const fileInput = root.querySelector("[data-file]");
  const drop = root.querySelector("[data-drop]");

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) startScan(f);
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("is-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", () => drop.classList.remove("is-over"));
  // The model is fetched only once someone shows intent to scan.
  drop.addEventListener("pointerdown", () => deepScanStatus().then((d) => d || warmUp()), { once: true });

  root.querySelectorAll("[data-sample]").forEach((b) =>
    b.addEventListener("click", async () => {
      errorEl.textContent = "";
      try {
        const fit = findFit(b.dataset.sample);
        const res = await fetch(fitImg(fit));
        const blob = await res.blob();
        startScan(new File([blob], `${fit.id}.jpg`, { type: "image/jpeg" }));
      } catch {
        errorEl.textContent = "Couldn't load that sample. Check your connection and try again.";
      }
    }),
  );

  deepScanStatus().then((deep) => {
    const note = root.querySelector("[data-engine] span");
    if (deep && note) note.textContent = "Deep scan is on: exact shops and live stock.";
  });

  // ---- hero demo: walk through the pieces one by one ----
  const demo = root.querySelector("[data-demo]");
  const fit = findFit(DEMO_FIT);
  const tagBox = root.querySelector("[data-demo-tag]");
  const spots = [...demo.querySelectorAll(".hotspot")];
  let active = 0;
  let paused = false;
  const show = (i) => {
    active = i;
    spots.forEach((s, k) => s.classList.toggle("is-active", k === i));
    tagBox.classList.add("is-swap");
    timers.push(
      setTimeout(() => {
        tagBox.innerHTML = feedTag(fit.items[i], i, { fitId: fit.id, mini: true }).s;
        tagBox.classList.remove("is-swap");
      }, reduceMotion() ? 0 : 260),
    );
  };
  spots.forEach((s, i) =>
    s.addEventListener("click", () => {
      paused = true;
      show(i);
    }),
  );
  demo.addEventListener("pointerenter", () => (paused = true));
  demo.addEventListener("pointerleave", () => (paused = false));
  if (!reduceMotion()) {
    const iv = setInterval(() => {
      if (!paused && !document.hidden) show((active + 1) % spots.length);
    }, 2800);
    timers.push({ iv });
  }
  spots[0] && spots[0].classList.add("is-active");

  // ---- bento log: lines print like a receipt ----
  const log = root.querySelector("[data-demo-log]");
  let n = 0;
  const printLine = () => {
    const [k, v] = LOG_LINES[n % LOG_LINES.length];
    const line = document.createElement("div");
    line.className = "log__line";
    line.innerHTML = html`<span class="k">${k}</span><span>${v}</span>`.s;
    log.appendChild(line);
    while (log.children.length > 6) log.firstElementChild.remove();
    n++;
  };
  if (reduceMotion()) for (let k = 0; k < 6; k++) printLine();
  else {
    printLine();
    const iv2 = setInterval(() => !document.hidden && printLine(), 1400);
    timers.push({ iv: iv2 });
  }

  return () => timers.forEach((t) => (t && t.iv ? clearInterval(t.iv) : clearTimeout(t)));
}

export default { render, mount };
