// Boot: icons, router, nav state, theme, global drop/paste, restock checks.
import { SPRITE } from "./icons.js";
import { html, toast, observeReveals, animateCounts } from "./ui.js";
import * as store from "./store.js";
import { startScan } from "./state.js";
import { recheckWatches } from "./watch.js";
import home from "./views/home.js";
import feed from "./views/feed.js";
import fit from "./views/fit.js";
import scan from "./views/scan.js";
import closet from "./views/closet.js";
import brands from "./views/brands.js";
import legal from "./views/legal.js";

document.body.insertAdjacentHTML("afterbegin", SPRITE);

const ROUTES = [
  { re: /^\/?$/, view: home, nav: "home", title: "FitSource: מוצאים את החנות מאחורי כל לוק" },
  { re: /^\/feed\/?$/, view: feed, nav: "feed", title: "פיד | FitSource" },
  { re: /^\/fit\/([\w-]+)\/?$/, view: fit, nav: "feed", title: "לוק | FitSource" },
  { re: /^\/scan(?:\/([\w-]+))?\/?$/, view: scan, nav: "home", title: "סריקה | FitSource" },
  { re: /^\/closet(?:\/(saved|watching|scans))?\/?$/, view: closet, nav: "closet", title: "הארון | FitSource" },
  { re: /^\/brands\/?$/, view: brands, nav: "brands", title: "למותגים | FitSource" },
  { re: /^\/legal\/?$/, view: legal, nav: "", title: "פרטיות ונגישות | FitSource" },
];

const notFound = {
  render: () => html`<section class="wrap pagehead view"><h1 class="h2">אין כאן כלום</h1><p class="lede">העמוד הזה לא קיים. אולי תסרקו לוק במקום?</p><p><a class="btn" href="#/">לדף הבית</a></p></section>`,
};

const main = document.getElementById("main");
let cleanup = null;
let lastPath = null;

function currentPath() {
  const h = location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/" + h;
}

async function route() {
  const path = currentPath().split("?")[0];
  if (path === lastPath) return;
  lastPath = path;
  let match = null;
  let entry = ROUTES.find((r) => (match = path.match(r.re)));
  if (!entry) entry = { view: notFound, nav: "", title: "לא נמצא | FitSource" };
  if (cleanup) {
    try {
      cleanup();
    } catch {
      // a view failing to clean up must not block navigation
    }
    cleanup = null;
  }
  const params = match ? match.slice(1) : [];
  const out = entry.view.render(params);
  if (out && out.redirect) {
    location.replace(out.redirect);
    return;
  }
  main.innerHTML = `<div class="view">${out}</div>`;
  document.title = (entry.view.title && entry.view.title(params)) || entry.title;
  setNav(entry.nav);
  window.scrollTo(0, 0);
  if (entry.view.mount) cleanup = entry.view.mount(main.firstElementChild, params) || null;
  observeReveals(main);
  animateCounts(main);
  main.focus({ preventScroll: true });
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

store.onChange(updateBadges);
window.addEventListener("hashchange", route);
// A view replaced the URL without navigating (e.g. #/scan to #/scan/<id>).
window.addEventListener("fs:pathsync", () => (lastPath = currentPath().split("?")[0]));
applyThemeIcon();
updateBadges();
route();

// Check watched items once per visit, quietly, a moment after load.
setTimeout(() => {
  recheckWatches().then((backs) => {
    if (backs.length) toast(backs.length === 1 ? `${backs[0].name} חזר למלאי` : `${backs.length} פריטים שעקבתם אחריהם חזרו למלאי`, { action: "לצפייה", onAction: () => (location.hash = "#/closet/watching") });
  });
}, 2500);
