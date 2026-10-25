// Boot: icons, router, nav state, theme, global drop/paste, restock checks.
import { SPRITE } from "./icons.js";
import { html, icon, toast, observeReveals, animateCounts } from "./ui.js";
import { card } from "./components.js";
import * as store from "./store.js";
import { startScan } from "./state.js";
import { recheckWatches, summarize } from "./watch.js";
import home from "./views/home.js";
import feed from "./views/feed.js";
import fit from "./views/fit.js";
import scan from "./views/scan.js";
import closet from "./views/closet.js";
import brands from "./views/brands.js";
import legal from "./views/legal.js";
import { FITS, findFit } from "./data/fits.js";
import { hashMode, href, routeOf, pathRouteOf, currentRoute, go, setAddress } from "./router.js";
import { pageMeta, notFoundMeta, applyMeta } from "./seo.js";

document.body.insertAdjacentHTML("afterbegin", SPRITE);

const ROUTES = [
  { re: /^$/, view: home, nav: "home" },
  { re: /^feed$/, view: feed, nav: "feed" },
  { re: /^fit\/([\w-]+)$/, view: fit, nav: "feed" },
  { re: /^scan(?:\/([\w-]+))?$/, view: scan, nav: "home" },
  { re: /^closet(?:\/(saved|watching|scans))?$/, view: closet, nav: "closet" },
  { re: /^brands$/, view: brands, nav: "brands" },
  { re: /^legal$/, view: legal, nav: "" },
];

const notFound = {
  render: () => html`<section class="wrap pagehead notfound">
      <span class="label">שגיאה 404</span>
      <h1 class="display" style="font-size:clamp(2.4rem,5vw,4.2rem)">אין כאן כלום</h1>
      <p class="lede">העמוד הזה לא קיים, או שהקישור השתנה. אולי תסרקו לוק במקום, או תציצו במה שאחרים סורקים עכשיו.</p>
      <div class="toolbar"><a class="btn btn--accent" href="${href("")}">${icon("scan")}סרקו לוק</a><a class="btn btn--ghost" href="${href("feed")}">${icon("squares-four")}לפיד</a></div>
    </section>
    <section class="section" style="padding-top:8px">
      <div class="wrap">
        <div class="section__head"><h2 class="h2">חם עכשיו</h2></div>
        <div class="rail">${[...FITS].sort((a, b) => b.scans - a.scans).slice(0, 4).map((f, i) => card(f, { delay: i }))}</div>
      </div>
    </section>`,
};

const main = document.getElementById("main");
// Pages arrive already rendered (tools/build-pages.mjs); the first render replaces it without the entrance animation.
let first = main.hasAttribute("data-prerendered");
let cleanup = null;
let lastPath = null;

async function route() {
  // An old "#/feed" link on the real site: move to the page's own address.
  if (!hashMode() && location.hash.startsWith("#/")) setAddress(currentRoute());
  const path = currentRoute();
  if (path === lastPath) return;
  lastPath = path;
  let match = null;
  let entry = ROUTES.find((r) => (match = path.match(r.re)));
  const params = entry && match ? match.slice(1) : [];
  if (entry === ROUTES.find((r) => r.view === fit) && !findFit(params[0])) entry = null;
  if (!entry) entry = { view: notFound, nav: "" };
  if (cleanup) {
    try {
      cleanup();
    } catch {
      // a view failing to clean up must not block navigation
    }
    cleanup = null;
  }
  const out = entry.view.render(params);
  if (out && out.redirect != null) {
    go(out.redirect, { replace: true });
    return;
  }
  main.innerHTML = `<div class="view${first ? " is-static" : ""}">${out}</div>`;
  main.removeAttribute("data-prerendered");
  applyMeta(entry.view === notFound ? notFoundMeta() : pageMeta(path), path);
  setNav(entry.nav);
  if (!first) window.scrollTo(0, 0);
  if (entry.view.mount) cleanup = entry.view.mount(main.firstElementChild, params) || null;
  observeReveals(main);
  animateCounts(main);
  if (!first) main.focus({ preventScroll: true });
  first = false;
}

function setNav(nav) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === nav) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function updateBadges() {
  const n = store.closet().length;
  const backs = store.closet().filter((i) => i.backInStock).length;
  document.querySelectorAll("[data-closet-count]").forEach((b) => {
    b.textContent = backs ? `${backs}!` : n ? String(n) : "";
    b.title = backs ? `${backs} back in stock` : "";
  });
}

// ---------- theme ----------
function applyThemeIcon() {
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll("[data-theme-toggle] use").forEach((u) => u.setAttribute("href", dark ? "#i-sun" : "#i-moon"));
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-label", dark ? "מעבר למצב בהיר" : "מעבר למצב כהה"));
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-theme-toggle]")) return;
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const next = dark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store.setPref("theme", next);
  applyThemeIcon();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyThemeIcon);

// ---------- nav shadow ----------
const nav = document.getElementById("nav");
const sentinel = document.createElement("div");
sentinel.style.cssText = "position:absolute;top:0;height:1px;width:1px;pointer-events:none";
document.body.prepend(sentinel);
new IntersectionObserver(([e]) => nav.classList.toggle("is-scrolled", !e.isIntersecting)).observe(sentinel);

// ---------- drop and paste anywhere ----------
const veil = document.getElementById("dropveil");
let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
window.addEventListener("dragenter", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  veil.classList.add("is-on");
});
window.addEventListener("dragover", (e) => {
  if (hasFiles(e)) e.preventDefault();
});
window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) veil.classList.remove("is-on");
});
window.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  veil.classList.remove("is-on");
  const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
  if (file) startScan(file);
  else toast("זו לא תמונה. אפשר לגרור JPEG, PNG או WebP.");
});
window.addEventListener("paste", (e) => {
  if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) {
    e.preventDefault();
    startScan(file);
  }
});

// ---------- links ----------
// On the real site, links between pages render in place instead of reloading,
// so a photo being scanned and the open view survive. In-page anchors
// ("#main") scroll without changing the page, even under a <base> (404.html).
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target && a.target !== "_self") return;
  if (a.hasAttribute("download")) return;
  const raw = a.getAttribute("href");
  if (raw.startsWith("#") && !raw.startsWith("#/")) {
    const target = document.getElementById(raw.slice(1));
    if (target) {
      e.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView();
    }
    return;
  }
  if (hashMode()) return; // "#/..." links navigate on their own
  const r = routeOf(a.href);
  if (r == null) return;
  e.preventDefault();
  if (r !== currentRoute()) go(r);
});

// In the preview the shell's links are written for the real site; point them at "#/" routes.
if (hashMode()) {
  document.querySelectorAll("header a[href], footer a[href], .tabbar a[href]").forEach((a) => {
    const raw = a.getAttribute("href");
    if (raw.startsWith("#") || raw.startsWith("..")) return;
    const r = pathRouteOf(raw);
    if (r != null) a.setAttribute("href", href(r));
  });
}

store.onChange(updateBadges);
window.addEventListener(hashMode() ? "hashchange" : "popstate", route);
window.addEventListener("fs:navigate", route);
// A view replaced the address without navigating (e.g. scan to scan/<id>).
window.addEventListener("fs:pathsync", () => (lastPath = currentRoute()));
applyThemeIcon();
updateBadges();
route();

// Check watched items once per visit, quietly, a moment after load.
setTimeout(() => {
  recheckWatches().then((events) => {
    if (events.length) toast(summarize(events), { action: "לצפייה", onAction: () => go("closet/watching") });
  });
}, 2500);
