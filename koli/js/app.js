// Koli app shell: tabs, the demo banner, and the engine status pill.

import { store } from "./store.js";
import { engine, detectEngine } from "./engine.js";
import { toast } from "./dom.js";
import { renderInbox } from "./views/inbox.js";
import { renderVoice } from "./views/voice.js";
import { renderPersonality } from "./views/personality.js";
import { renderCampaigns } from "./views/campaigns.js";
import { renderConnect } from "./views/connect.js";
import { renderGuide } from "./views/guide.js";

const VIEWS = { inbox: renderInbox, voice: renderVoice, personality: renderPersonality, campaigns: renderCampaigns, connect: renderConnect, guide: renderGuide };
// Screens without their own tab, and the tab they live under.
const PARENT = { guide: "connect" };
const view = document.getElementById("view");
let tab = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "inbox";
let shownTab = null;

// The page is Hebrew, right to left, even when a host wraps it in its own <html>.
document.documentElement.lang = "he";
document.documentElement.dir = "rtl";

/** Slide the tab indicator under the selected tab. */
function moveInk() {
  const ink = document.querySelector(".tabs .ink");
  const sel = document.querySelector('.tabs button[aria-selected="true"]');
  if (!ink || !sel) return;
  ink.style.width = `${sel.offsetWidth}px`;
  ink.style.transform = `translateX(${sel.offsetLeft}px)`;
}
window.addEventListener("resize", moveInk);
document.fonts?.ready.then(moveInk);

function render() {
  const scroll = window.scrollY;
  for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === (PARENT[tab] || tab)));
  document.getElementById("demo-banner").hidden = !store.isDemo;
  const pill = document.getElementById("engine-pill");
  pill.dataset.state = engine.kind === "none" ? "none" : "ready";
  document.getElementById("engine-label").textContent = engine.label;
  view.replaceChildren();
  VIEWS[tab](view, render);
  // Animate the screen in only when it changes, not on every re-render.
  const entering = shownTab !== tab;
  shownTab = tab;
  view.classList.remove("enter");
  if (entering) {
    [...view.children].forEach((el, i) => el.style.setProperty("--i", String(i)));
    void view.offsetWidth;
    view.classList.add("enter");
  }
  moveInk();
  window.scrollTo(0, scroll);
}

function go(next) {
  tab = next;
  try {
    history.replaceState(null, "", `#${tab}`);
  } catch {
    /* sandboxed frame */
  }
  render();
  window.scrollTo(0, 0);
}
for (const b of document.querySelectorAll(".tabs button")) b.addEventListener("click", () => go(b.dataset.tab));
window.addEventListener("koli:tab", (e) => go(e.detail));
document.getElementById("engine-pill").addEventListener("click", () => {
  tab = "connect";
  render();
});
document.getElementById("start-fresh").addEventListener("click", () => {
  store.startFresh();
  tab = "voice";
  render();
  toast("התחלנו מאפס. ספרו לקולי מי את/ה והוסיפו הודעות אמיתיות.");
});

store.warnFull = () => toast("אין מקום בדפדפן. מחקו דוגמאות ישנות או ייצאו לקובץ.");
store.load();
render();
detectEngine().then(render);
