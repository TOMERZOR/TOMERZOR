// Koli app shell: tabs, the demo banner, and the engine status pill.

import { store } from "./store.js";
import { engine, detectEngine } from "./engine.js";
import { toast } from "./dom.js";
import { renderInbox } from "./views/inbox.js";
import { renderVoice } from "./views/voice.js";
import { renderPersonality } from "./views/personality.js";
import { renderCampaigns } from "./views/campaigns.js";
import { renderConnect } from "./views/connect.js";

const VIEWS = { inbox: renderInbox, voice: renderVoice, personality: renderPersonality, campaigns: renderCampaigns, connect: renderConnect };
const view = document.getElementById("view");
let tab = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "inbox";

function render() {
  const scroll = window.scrollY;
  for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  document.getElementById("demo-banner").hidden = !store.isDemo;
  const pill = document.getElementById("engine-pill");
  pill.dataset.state = engine.kind === "none" ? "none" : "ready";
  document.getElementById("engine-label").textContent = engine.label;
  view.replaceChildren();
  VIEWS[tab](view, render);
  window.scrollTo(0, scroll);
}

for (const b of document.querySelectorAll(".tabs button")) {
  b.addEventListener("click", () => {
    tab = b.dataset.tab;
    try {
      history.replaceState(null, "", `#${tab}`);
    } catch {
      /* sandboxed frame */
    }
    render();
    window.scrollTo(0, 0);
  });
}
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
