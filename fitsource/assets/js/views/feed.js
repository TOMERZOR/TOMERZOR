import { html, icon, observeReveals } from "../ui.js";
import { href } from "../router.js";
import { FITS, VIBES, ALL } from "../data/fits.js";
import { card, breadcrumbs } from "../components.js";
import { pageMeta } from "../seo.js";
import { prefs, setPref } from "../store.js";

const SORTS = [
  ["trending", "פופולרי"],
  ["new", "הכי חדש"],
  ["sold", "הכי הרבה אזל"],
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
  const list = sorted(FITS.filter((f) => vibe === ALL || f.vibe === vibe), sort);
  if (!list.length) return html`<div class="empty">${icon("squares-four")}<p>עוד אין לוקים בסגנון הזה.</p></div>`;
  const cta = html`<a class="card card--cta" href="${href("")}" data-reveal style="--d:3"><span class="cta-tile">${icon("scan")}<span class="cell__big">ראיתם לוק שאהבתם?</span><span>סרקו אותו וקבלו כל פריט.</span><span class="btn btn--sm">${icon("upload-simple")}סרקו לוק</span></span></a>`;
  return html`<div class="grid">${list.map((f, i) => card(f, { feature: i === 0 && vibe === ALL, delay: i % 4 }))}${vibe === ALL ? cta : ""}</div>`;
}

function render() {
  const p = prefs();
  const vibe = VIBES.includes(p.vibe) ? p.vibe : ALL;
  const sort = SORTS.some(([k]) => k === p.sort) ? p.sort : "trending";
  return html`
  <section class="wrap pagehead">
    ${breadcrumbs(pageMeta("feed").breadcrumbs)}
    <h1 class="display" style="font-size:clamp(2.4rem,5vw,4.2rem)">הפיד</h1>
    <p class="lede">הלוקים שסורקים עכשיו, עם המקור של כל פריט ובדיקת מלאי.</p>
    <span class="sample-note">${icon("info")}פיד לדוגמה: לוקים ומותגים להמחשה, ולוק אמיתי אחד של Dream Studios.</span>
  </section>
  <div class="filters">
    <div class="wrap filters__in" role="toolbar" aria-label="סינון הפיד">
      ${VIBES.map((v) => html`<button type="button" class="chip" data-vibe="${v}" aria-pressed="${String(v === vibe)}">${v}</button>`)}
      <span class="filters__sep" aria-hidden="true"></span>
      <span class="filters__sorts">${SORTS.map(([k, label]) => html`<button type="button" class="chip" data-sort="${k}" aria-pressed="${String(k === sort)}">${k === "trending" ? icon("trend-up") : k === "new" ? icon("clock") : icon("fire")}${label}</button>`)}</span>
    </div>
  </div>
  <section class="wrap" data-grid>${grid(vibe, sort)}</section>`;
}

function mount(root) {
  const area = root.querySelector("[data-grid]");
  let { vibe = ALL, sort = "trending" } = prefs();
  if (!VIBES.includes(vibe)) vibe = ALL;
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
