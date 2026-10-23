import { html, icon, observeReveals } from "../ui.js";
import { FITS, VIBES } from "../data/fits.js";
import { card } from "../components.js";
import { prefs, setPref } from "../store.js";

const SORTS = [
  ["trending", "Trending"],
  ["new", "Newest"],
  ["sold", "Most sold out"],
];

const hoursAgo = (s) => {
  const n = parseFloat(s);
  return s.endsWith("d") ? n * 24 : s.endsWith("w") ? n * 168 : n;
};

function sorted(list, sort) {
  const out = [...list];
  if (sort === "new") out.sort((a, b) => hoursAgo(a.posted) - hoursAgo(b.posted));
  else if (sort === "sold") out.sort((a, b) => b.items.filter((i) => i.status === "sold_out").length - a.items.filter((i) => i.status === "sold_out").length || b.scans - a.scans);
  else out.sort((a, b) => b.scans - a.scans);
  return out;
}

function grid(vibe, sort) {
  const list = sorted(FITS.filter((f) => vibe === "All" || f.vibe === vibe), sort);
  if (!list.length) return html`<div class="empty">${icon("squares-four")}<p>No fits in this style yet.</p></div>`;
  const cta = html`<a class="card card--cta" href="#/" data-reveal style="--d:3"><span class="cta-tile">${icon("scan")}<span class="cell__big">Seen a fit you love?</span><span>Scan it and get every piece.</span><span class="btn btn--sm">${icon("upload-simple")}Scan a fit</span></span></a>`;
  return html`<div class="grid">${list.map((f, i) => card(f, { feature: i === 0 && vibe === "All", delay: i % 4 }))}${vibe === "All" ? cta : ""}</div>`;
}

function render() {
  const p = prefs();
  const vibe = VIBES.includes(p.vibe) ? p.vibe : "All";
  const sort = SORTS.some(([k]) => k === p.sort) ? p.sort : "trending";
  return html`
  <section class="wrap pagehead">
    <h1 class="display" style="font-size:clamp(2.4rem,5vw,4.2rem)">The feed</h1>
    <p class="lede">Fits people are scanning right now, with every piece sourced and its stock checked.</p>
    <span class="sample-note">${icon("info")}Preview feed: sample fits and brands, plus one real Dream Studios fit.</span>
  </section>
  <div class="filters">
    <div class="wrap filters__in" role="toolbar" aria-label="Filter the feed">
      ${VIBES.map((v) => html`<button type="button" class="chip" data-vibe="${v}" aria-pressed="${v === vibe}">${v}</button>`)}
      <span class="filters__sep" aria-hidden="true"></span>
      ${SORTS.map(([k, label]) => html`<button type="button" class="chip" data-sort="${k}" aria-pressed="${k === sort}">${k === "trending" ? icon("trend-up") : k === "new" ? icon("clock") : icon("fire")}${label}</button>`)}
    </div>
  </div>
  <section class="wrap" data-grid>${grid(vibe, sort)}</section>`;
}

function mount(root) {
  const area = root.querySelector("[data-grid]");
  let { vibe = "All", sort = "trending" } = prefs();
  if (!VIBES.includes(vibe)) vibe = "All";
  const redraw = () => {
    area.innerHTML = grid(vibe, sort).s;
    observeReveals(area);
  };
  root.querySelectorAll("[data-vibe]").forEach((b) =>
    b.addEventListener("click", () => {
      vibe = b.dataset.vibe;
      setPref("vibe", vibe);
      root.querySelectorAll("[data-vibe]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      redraw();
    }),
  );
  root.querySelectorAll("[data-sort]").forEach((b) =>
    b.addEventListener("click", () => {
      sort = b.dataset.sort;
      setPref("sort", sort);
      root.querySelectorAll("[data-sort]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      redraw();
    }),
  );
}

export default { render, mount };
