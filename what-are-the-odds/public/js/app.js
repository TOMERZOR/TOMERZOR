import { FACTS } from "./core/data.js";
import { findFact, factById, needsCare, normalize, stripOpener } from "./core/match.js";
import { compare, plain, LANDMARKS } from "./core/format.js";
import { QUESTION_POOL } from "./core/questions.js";
import { STR, fmt } from "./i18n.js";
import { icon } from "./icons.js";
import { roll, stopRoll } from "./roll.js";
import * as sound from "./sound.js";
import { initGame } from "./game-ui.js";

const $ = (id) => document.getElementById(id);
const els = {
  form: $("ask"), q: $("q"), random: $("random"), result: $("result"), rq: $("r-q"), thinking: $("r-thinking"),
  body: $("r-body"), odds: $("r-odds"), pre: $("r-pre"), num: $("r-num"), alt: $("r-alt"), after: $("r-after"),
  badge: $("r-badge"), meter: $("r-meter"), fill: $("r-fill"), dot: $("r-dot"), marks: $("r-marks"),
  compare: $("r-compare"), explain: $("r-explain"), source: $("r-source"), share: $("share"), again: $("again"),
  related: $("r-related"), relatedTitle: $("r-related-title"), relatedList: $("r-related-list"),
  lang: $("lang"), sound: $("sound"), toast: $("toast"),
  tabCurious: $("tab-curious"), tabGame: $("tab-game"), viewCurious: $("view-curious"), viewGame: $("view-game"),
  modes: document.querySelector(".modes"),
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const hasHebrew = (s) => /[א-ת]/.test(s);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ui = store.get("odds:lang") || (/^(he|iw)\b/i.test(navigator.language || "") ? "he" : "en");
let current = null; // { question, lang, view }
let askSeq = 0;

const cfg = window.ODDS_CONFIG || {};
const sameOrigin = /\.workers\.dev$/.test(location.hostname) || ["localhost", "127.0.0.1"].includes(location.hostname);
export const API_BASE = sameOrigin ? "" : (cfg.server || "");

// ---------- language and chrome ----------
function applyLang() {
  const s = STR[ui];
  document.documentElement.lang = ui;
  document.documentElement.dir = ui === "he" ? "rtl" : "ltr";
  document.querySelectorAll("[data-t]").forEach((el) => {
    const v = s[el.dataset.t];
    if (typeof v === "string") el.textContent = v;
  });
  els.lang.textContent = s.langBtn;
  els.lang.setAttribute("aria-label", s.langLabel);
  els.q.placeholder = s.placeholders[0];
  els.random.innerHTML = icon("dice-five");
  els.random.setAttribute("aria-label", s.random);
  els.random.title = s.random;
  els.share.innerHTML = `${icon("share-network")}<span>${s.share}</span>`;
  paintSound();
  game.setLang(ui);
  if (current && current.view.kind === "fact") {
    const f = factById(current.view.id);
    els.q.value = f[ui].q;
    showFact(f, f[ui].q, ui, current.view.related, { animate: false });
    updateUrl({ q: f[ui].q });
  }
}

function paintSound() {
  const on = sound.soundOn();
  els.sound.innerHTML = icon(on ? "speaker-high" : "speaker-slash");
  els.sound.setAttribute("aria-pressed", String(on));
  els.sound.setAttribute("aria-label", STR[ui][on ? "soundOn" : "soundOff"]);
}

let phIndex = 0;
setInterval(() => {
  if (document.activeElement === els.q || els.q.value || document.hidden) return;
  const list = STR[ui].placeholders;
  phIndex = (phIndex + 1) % list.length;
  els.q.placeholder = list[phIndex];
}, 3200);

// ---------- modes ----------
function setMode(mode, { push = true } = {}) {
  const game = mode === "game";
  els.modes.dataset.mode = mode;
  els.tabCurious.setAttribute("aria-selected", String(!game));
  els.tabGame.setAttribute("aria-selected", String(game));
  els.viewCurious.hidden = game;
  els.viewGame.hidden = !game;
  if (push) {
    const url = new URL(location.href);
    if (game) url.searchParams.set("mode", "game");
    else { url.searchParams.delete("mode"); url.searchParams.delete("room"); }
    history.replaceState(null, "", url);
  }
}

// ---------- result ----------
// What's in the box plus "מה הסיכויים ש" / "What are the odds that", unless they typed it.
export function fullQuestion(text, lang) {
  const t = String(text || "").trim().replace(/[?？!.]+$/, "");
  if (stripOpener(normalize(t)) !== normalize(t)) return t;
  if (lang === "he") return `מה הסיכויים ${t.startsWith("ש") ? t : `ש${t}`}`;
  return /^(that|of|to)\b/i.test(t) ? `What are the odds ${t}` : `What are the odds that ${t}`;
}

function questionLine(text, lang) {
  return `${fullQuestion(text, lang)}?`;
}

function chip(entry, lang) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = entry[lang].q;
  b.addEventListener("click", () => {
    sound.unlock();
    els.q.value = entry[lang].q;
    ask(entry[lang].q, { factId: entry.id });
  });
  return b;
}

function setRelated(ids, lang, title) {
  const facts = (ids || []).map((id) => factById(id)).filter(Boolean).slice(0, 4);
  els.related.hidden = !facts.length;
  els.relatedTitle.textContent = title;
  els.relatedList.replaceChildren(...facts.map((f) => chip(f, lang)));
}

function startCard(question, lang) {
  stopRoll();
  els.result.hidden = false;
  els.result.lang = lang;
  els.result.dir = lang === "he" ? "rtl" : "ltr";
  els.rq.textContent = questionLine(question, lang);
  els.body.querySelectorAll(".care").forEach((n) => n.remove());
  els.after.classList.remove("is-in");
  els.related.hidden = true;
  els.odds.hidden = false;
  els.pre.textContent = "";
  els.num.textContent = "";
  els.num.className = "odds__num";
  els.alt.textContent = "";
  els.alt.classList.remove("is-in");
  [els.badge, els.meter, els.compare, els.explain, els.source, els.share].forEach((n) => { n.hidden = false; });
  [els.compare, els.explain, els.source].forEach((n) => { n.textContent = ""; });
  els.fill.style.transform = "";
  els.dot.style.insetInlineStart = "0%";
}

function thinking(on) {
  els.thinking.hidden = !on;
  els.body.hidden = on;
}

const MIN_LOG = -10;
function paintMeter(p, lang) {
  els.meter.hidden = false;
  const log = p <= 0 ? -Infinity : Math.log10(p);
  const pos = p <= 0 ? 0 : Math.max(0, Math.min(1, (log - MIN_LOG) / -MIN_LOG));
  els.marks.replaceChildren(...LANDMARKS.filter((l) => l.short).map((l) => {
    const m = document.createElement("span");
    m.className = "mark-tick";
    m.style.insetInlineStart = `${((Math.log10(l.p) - MIN_LOG) / -MIN_LOG) * 100}%`;
    m.textContent = l.short[lang];
    return m;
  }));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    els.fill.style.transform = `scaleX(${pos})`;
    els.dot.style.insetInlineStart = `${pos * 100}%`;
  }));
}

function revealAfter() {
  [...els.after.children].forEach((c, i) => c.style.setProperty("--i", i));
  els.after.classList.add("is-in");
}

function setBadge(kind, text) {
  const ic = kind === "fact" ? icon("check") : "";
  els.badge.className = `badge badge--${kind}`;
  els.badge.innerHTML = `${ic}<span></span>`;
  els.badge.lastChild.textContent = text;
}

async function showFact(fact, question, lang, related, { animate = true } = {}) {
  const s = STR[lang];
  startCard(question, lang);
  thinking(false);
  const sameQuestion = stripOpener(normalize(fullQuestion(question, lang))) === stripOpener(normalize(fullQuestion(fact[lang].q, lang)));
  setBadge("fact", s.badgeFact);
  els.compare.textContent = compare(fact.p, lang, fact.id);
  els.explain.textContent = fact[lang].x;
  els.source.textContent = (sameQuestion ? "" : `${s.answered}${fact[lang].q} · `) + s.source + fact.src;
  current = { question, lang, view: { kind: "fact", id: fact.id, related } };
  const seq = askSeq;
  if (animate) await roll(els, fact.p, lang);
  else await roll(els, fact.p, lang, { duration: 0, silent: true });
  if (seq !== askSeq) return;
  paintMeter(fact.p, lang);
  revealAfter();
}

async function showAi(view, question, lang) {
  const s = STR[lang];
  startCard(question, lang);
  thinking(false);
  current = { question, lang, view };
  const bits = [];
  if (view.timeframe) bits.push(view.timeframe);
  if (view.basis) bits.push(s.basis + view.basis);
  els.source.textContent = bits.join(" · ");
  els.explain.textContent = view.explanation;
  const seq = askSeq;
  if (view.kind === "ai") {
    setBadge("ai", `${s.badgeAi} · ${s.conf[view.confidence] || s.conf.low}`);
    els.compare.textContent = compare(view.p, lang);
    await roll(els, view.p, lang);
    if (seq !== askSeq) return;
    paintMeter(view.p, lang);
  } else {
    setBadge("unknown", s.badgeUnknown);
    els.num.textContent = s.unknownNum;
    els.num.classList.add("is-final");
    els.alt.textContent = s.unknownAlt;
    els.alt.classList.add("is-in");
    els.meter.hidden = true;
    sound.land();
  }
  revealAfter();
}

function showNone(reason, question, lang, related) {
  const s = STR[lang];
  startCard(question, lang);
  thinking(false);
  els.odds.hidden = true;
  els.badge.hidden = true;
  els.meter.hidden = true;
  els.share.hidden = true;
  els.compare.textContent = s.noneTitle;
  els.explain.textContent = s.none[reason] || s.none["ai-failed"];
  revealAfter();
  let ids = related || [];
  if (!ids.length) ids = shuffle(FACTS).slice(0, 4).map((f) => f.id);
  setRelated(ids, lang, s.related);
  current = { question, lang, view: { kind: "none", reason, related } };
}

function showCare(question, lang) {
  const s = STR[lang];
  startCard(question, lang);
  thinking(false);
  els.odds.hidden = true;
  [els.badge, els.meter, els.share].forEach((n) => { n.hidden = true; });
  const box = document.createElement("div");
  box.className = "care";
  const h = document.createElement("h3");
  h.textContent = s.careTitle;
  const p = document.createElement("p");
  p.textContent = s.careText;
  box.append(h, p);
  for (const [label, href] of s.careLines) {
    const line = document.createElement("p");
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (href.startsWith("http")) { a.target = "_blank"; a.rel = "noopener"; }
    line.append(a);
    box.append(line);
  }
  els.body.prepend(box);
  revealAfter();
  current = { question, lang, view: { kind: "care" } };
}

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

// ---------- asking ----------
function cacheKey(q, lang) { return `odds:a:${lang}:${stripOpener(normalize(q))}`; }

async function fetchAnswer(q, lang) {
  const key = cacheKey(q, lang);
  const hit = store.get(key);
  if (hit) {
    try {
      const v = JSON.parse(hit);
      if (Date.now() - v.at < 7 * 864e5) return v.body;
    } catch { /* ignore */ }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(`${API_BASE}/api/odds`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q, lang }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.kind === "ai" || body.kind === "unknown") store.set(key, JSON.stringify({ at: Date.now(), body }));
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function updateUrl(params) {
  const url = new URL(location.href);
  ["q", "id", "mode", "room"].forEach((k) => url.searchParams.delete(k));
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  history.replaceState(null, "", url);
}

async function ask(raw, { factId } = {}) {
  const q = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!q) { els.q.focus(); return; }
  const seq = ++askSeq;
  const lang = hasHebrew(q) ? "he" : /[a-z]/i.test(q) ? "en" : ui;
  const full = fullQuestion(q, lang);
  updateUrl({ q });

  if (needsCare(full)) { showCare(q, lang); return; }

  startCard(q, lang);
  thinking(true);
  if (!reduced()) els.result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  const minThink = sleep(reduced() ? 0 : 900);

  const direct = factId ? factById(factId) : null;
  const { fact, related } = direct ? { fact: direct, related: [] } : findFact(full);
  if (fact) {
    await minThink;
    if (seq !== askSeq) return;
    showFact(fact, q, lang, related.map((f) => f.id));
    return;
  }
  try {
    const [body] = await Promise.all([fetchAnswer(full, lang), minThink]);
    if (seq !== askSeq) return;
    if (body.kind === "fact" && factById(body.id)) showFact(factById(body.id), q, lang, body.related);
    else if (body.kind === "ai" || body.kind === "unknown") showAi(body, q, lang);
    else if (body.kind === "care") showCare(q, lang);
    else showNone(body.reason, q, lang, body.related || related.map((f) => f.id));
  } catch (err) {
    if (seq !== askSeq) return;
    console.warn("odds server", err);
    showNone("offline", q, lang, related.map((f) => f.id));
  }
}

// Type the random question into the box, then ask it.
async function randomQuestion() {
  sound.unlock();
  const pick = QUESTION_POOL[Math.floor(Math.random() * QUESTION_POOL.length)];
  const text = pick[ui];
  els.random.classList.remove("is-rolling");
  void els.random.offsetWidth;
  els.random.classList.add("is-rolling");
  const seq = ++askSeq;
  if (!reduced()) {
    els.q.value = "";
    for (let i = 1; i <= text.length; i++) {
      els.q.value = text.slice(0, i);
      if (i % 3 === 0) sound.tap();
      await sleep(i < 4 ? 40 : 16);
      if (seq !== askSeq) return;
    }
  } else {
    els.q.value = text;
  }
  ask(text, { factId: pick.id || undefined });
}

// ---------- share ----------
function toast(text) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { els.toast.hidden = true; }, 2200);
}

export async function shareLink(url, text) {
  if (navigator.share) {
    try { await navigator.share({ title: "What are the odds?", text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast(STR[ui].copied);
  } catch {
    prompt("", url);
  }
}

function shareCurrent() {
  if (!current) return;
  const { question, lang, view } = current;
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set("q", question);
  let answerText = "";
  if (view.kind === "fact") answerText = plain(factById(view.id).p, lang);
  else if (view.kind === "ai") answerText = plain(view.p, lang);
  shareLink(url.href, `${questionLine(question, lang)} ${answerText}`.trim());
}

// ---------- wire up ----------
const game = initGame($("game"), { apiBase: API_BASE, shareLink, lang: ui, onRoom: (code) => updateUrl({ mode: "game", room: code }) });

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  sound.unlock();
  els.q.blur();
  ask(els.q.value);
});
els.random.addEventListener("click", randomQuestion);
els.lang.addEventListener("click", () => {
  ui = ui === "he" ? "en" : "he";
  store.set("odds:lang", ui);
  applyLang();
});
els.sound.addEventListener("click", () => {
  sound.setSound(!sound.soundOn());
  paintSound();
  if (sound.soundOn()) sound.tap();
});
els.share.addEventListener("click", shareCurrent);
els.again.addEventListener("click", () => {
  els.q.value = "";
  els.q.focus({ preventScroll: true });
  els.form.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
});
els.tabCurious.addEventListener("click", () => { sound.tap(); setMode("curious"); });
els.tabGame.addEventListener("click", () => { sound.unlock(); sound.tap(); setMode("game"); });
document.querySelector(".modes").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = els.tabCurious.getAttribute("aria-selected") === "true" ? "game" : "curious";
  setMode(next);
  (next === "game" ? els.tabGame : els.tabCurious).focus();
});

applyLang();

const params = new URLSearchParams(location.search);
if (params.get("room") || params.get("mode") === "game") {
  setMode("game", { push: false });
  if (params.get("room")) game.openRoom(params.get("room"));
} else if (params.get("id") && factById(params.get("id"))) {
  const f = factById(params.get("id"));
  els.q.value = f[ui].q;
  ask(f[ui].q, { factId: f.id });
} else if (params.get("q")) {
  els.q.value = params.get("q");
  ask(params.get("q"));
}
