import { FACTS } from "./core/data.js";
import { findFact, factById, needsCare, normalize, stripOpener } from "./core/match.js";
import { compare, plain } from "./core/format.js";
import { QUESTION_POOL } from "./core/questions.js";
import { STR } from "./i18n.js";
import { icon } from "./icons.js";
import { roll, stopRoll } from "./roll.js";
import * as sound from "./sound.js";
import * as motion from "./motion.js";
import { initGame } from "./game-ui.js";

const $ = (id) => document.getElementById(id);
const els = {
  form: $("ask"), q: $("q"), random: $("random"), result: $("result"), thinking: $("r-thinking"),
  body: $("r-body"), odds: $("r-odds"), pre: $("r-pre"), num: $("r-num"), alt: $("r-alt"), after: $("r-after"),
  compare: $("r-compare"), explain: $("r-explain"), source: $("r-source"), share: $("share"), again: $("again"),
  related: $("r-related"), relatedTitle: $("r-related-title"), relatedList: $("r-related-list"),
  lang: $("lang"), sound: $("sound"),
  tabCurious: $("tab-curious"), tabGame: $("tab-game"), viewCurious: $("view-curious"), viewGame: $("view-game"),
  modes: document.querySelector(".modes"), knob: document.querySelector(".modes__knob"),
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const hasHebrew = (s) => /[א-ת]/.test(s);
const reduced = motion.reduced;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ui = store.get("odds:lang") || (/^(he|iw)\b/i.test(navigator.language || "") ? "he" : "en");
let mode = "curious";
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
  els.lang.lang = ui === "he" ? "en" : "he";
  // a question from the list switches language with the page; anything else keeps its own
  const was = typed();
  const known = QUESTION_POOL.find((x) => x.he === was || x.en === was);
  setTyped(known ? known[ui] : was);
  els.q.setAttribute("aria-label", `${s.prefix}...`);
  els.random.innerHTML = icon("dice-five");
  els.random.setAttribute("aria-label", s.random);
  els.random.title = s.random;
  els.share.innerHTML = `${icon("share-network")}<span>${s.share}</span>`;
  els.share._base = null;
  paintSound(false);
  placeKnob(false);
  game.setLang(ui);
  if (current && current.view.kind === "fact") {
    const f = factById(current.view.id);
    setTyped(f[ui].q);
    showFact(f, f[ui].q, ui, current.view.related, { animate: false });
    updateUrl({ q: f[ui].q });
  }
}

// The sound icon crossfades with a blur when it changes.
function paintSound(animate = true) {
  const on = sound.soundOn();
  const html = icon(on ? "speaker-high" : "speaker-slash");
  if (animate) motion.crossfade(els.sound, html);
  else els.sound.innerHTML = html;
  els.sound.setAttribute("aria-pressed", String(on));
  els.sound.setAttribute("aria-label", STR[ui][on ? "soundOn" : "soundOff"]);
}

// ---------- the box: "מה הסיכוי ש" is real text in the field, and it stays ----------
let shownPrefix = els.q.value; // the page starts with the Hebrew opener in the box
function prefixText(t = "") {
  const lang = hasHebrew(t) ? "he" : /[a-z]/i.test(t) ? "en" : ui;
  return STR[lang].prefix + (lang === "en" ? " " : "");
}

function typed() {
  const v = els.q.value;
  if (shownPrefix && v.startsWith(shownPrefix)) return v.slice(shownPrefix.length);
  let i = 0;
  while (shownPrefix && i < v.length && i < shownPrefix.length && v[i] === shownPrefix[i]) i++;
  return v.slice(i);
}

function setTyped(t) {
  shownPrefix = prefixText(t || "");
  els.q.value = shownPrefix + (t || "");
}

function clampCaret() {
  if (document.activeElement !== els.q) return;
  const min = shownPrefix.length;
  const { selectionStart: a, selectionEnd: b } = els.q;
  if (a < min || b < min) els.q.setSelectionRange(Math.max(a, min), Math.max(b, min));
}

// Backspace at the start of what you typed: the opener gives a little and springs back.
function boundaryNudge() {
  const dir = getComputedStyle(els.q).direction === "rtl" ? 4 : -4;
  motion.rubberNudge(els.q, dir);
  sound.haptic(6);
}

els.q.addEventListener("input", () => {
  if (!els.q.value.startsWith(shownPrefix)) {
    setTyped(typed());
    els.q.setSelectionRange(els.q.value.length, els.q.value.length);
  }
});
els.q.addEventListener("keydown", (e) => {
  const min = shownPrefix.length;
  const { selectionStart: a, selectionEnd: b } = els.q;
  if (e.key === "Backspace" && a === b && a <= min) { e.preventDefault(); boundaryNudge(); }
  if ((e.key === "Home" || e.key === "ArrowUp") && !e.shiftKey) { e.preventDefault(); els.q.setSelectionRange(min, min); }
});
els.q.addEventListener("focus", () => requestAnimationFrame(() => {
  if (els.q.selectionStart <= shownPrefix.length) els.q.setSelectionRange(els.q.value.length, els.q.value.length);
}));
document.addEventListener("selectionchange", clampCaret);
els.q.addEventListener("click", clampCaret);
els.q.addEventListener("keyup", clampCaret);

// ---------- modes: the knob moves, stretches 12% on the way, and can be dragged ----------
function tabFor(m) { return m === "game" ? els.tabGame : els.tabCurious; }
function knobX(m) {
  const t = tabFor(m);
  return t.offsetLeft + t.offsetWidth / 2 - els.knob.offsetWidth / 2;
}
let knobAt = null;
function placeKnob(animate = true, x = knobX(mode)) {
  const from = knobAt;
  knobAt = x;
  els.knob.style.transform = `translateX(${x}px)`;
  if (!animate || from == null || from === x || reduced()) return;
  els.knob.animate([
    { transform: `translateX(${from}px) scaleX(1)` },
    { transform: `translateX(${(from + x) / 2}px) scaleX(1.12)`, offset: 0.5 },
    { transform: `translateX(${x}px) scaleX(1)` },
  ], { duration: motion.MOVE, easing: motion.EASE_IN_OUT });
}

function setMode(next, { push = true, animate = true } = {}) {
  if (next === mode && animate) return;
  const prev = mode;
  mode = next;
  const toGame = next === "game";
  els.modes.dataset.mode = next;
  els.tabCurious.setAttribute("aria-selected", String(!toGame));
  els.tabGame.setAttribute("aria-selected", String(toGame));
  placeKnob(animate);
  const show = toGame ? els.viewGame : els.viewCurious;
  const hide = toGame ? els.viewCurious : els.viewGame;
  // the two views overlap: the old one fades out while the new one fades in
  show.hidden = false;
  if (animate && prev !== next && !reduced()) {
    hide.inert = true;
    motion.exitTo(hide, { dy: 0 }).then(() => { if (mode === next) { hide.hidden = true; hide.inert = false; hide.getAnimations().forEach((a) => a.cancel()); } });
    motion.enterFrom(show, { dy: 0 });
  } else {
    hide.hidden = true;
  }
  if (push) {
    const url = new URL(location.href);
    if (toGame) url.searchParams.set("mode", "game");
    else { url.searchParams.delete("mode"); url.searchParams.delete("room"); }
    history.replaceState(null, "", url);
  }
}

// Drag the knob between the two words; past either end it rubber-bands.
(() => {
  let start = null;
  els.modes.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start = { x: e.clientX, knob: knobAt, moved: false, id: e.pointerId };
  });
  els.modes.addEventListener("pointermove", (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    if (!start.moved && Math.abs(dx) < 6) return;
    start.moved = true;
    els.modes.classList.add("is-dragging");
    els.modes.setPointerCapture(e.pointerId);
    const lo = Math.min(knobX("curious"), knobX("game"));
    const hi = Math.max(knobX("curious"), knobX("game"));
    let x = start.knob + dx;
    if (x < lo) x = lo + motion.rubber(x - lo, 60);
    if (x > hi) x = hi + motion.rubber(x - hi, 60);
    knobAt = x;
    els.knob.style.transform = `translateX(${x}px)`;
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const wasDrag = start.moved;
    start = null;
    els.modes.classList.remove("is-dragging");
    if (!wasDrag) return;
    const near = Math.abs(knobAt - knobX("curious")) < Math.abs(knobAt - knobX("game")) ? "curious" : "game";
    if (near !== mode) { sound.tap(); setMode(near); } else placeKnob(true);
  };
  els.modes.addEventListener("pointerup", end);
  els.modes.addEventListener("pointercancel", end);
})();

// ---------- result ----------
export function fullQuestion(text, lang) {
  const t = String(text || "").trim().replace(/[?？!.]+$/, "");
  if (stripOpener(normalize(t)) !== normalize(t)) return t;
  if (lang === "he") return `מה הסיכוי ${t.startsWith("ש") ? t : `ש${t}`}`;
  return /^(that|of|to)\b/i.test(t) ? `What are the odds ${t}` : `What are the odds that ${t}`;
}

function questionLine(text, lang) {
  return `${fullQuestion(text, lang)}?`;
}

function setRelated(ids, lang, title) {
  const facts = (ids || []).map((id) => factById(id)).filter(Boolean).slice(0, 4);
  els.related.hidden = !facts.length;
  els.relatedTitle.textContent = title;
  els.relatedList.replaceChildren(...facts.map((f) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "textbtn";
    b.textContent = questionLine(f[lang].q, lang);
    b.addEventListener("click", () => {
      sound.unlock();
      setTyped(f[lang].q);
      ask(f[lang].q, { factId: f.id });
    });
    return b;
  }));
  if (facts.length) motion.stagger(els.relatedList.children, { delay: 120 });
}

function startCard(lang) {
  stopRoll();
  const firstTime = els.result.hidden;
  els.viewCurious.classList.add("has-result");
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
  els.result.hidden = false;
  els.result.lang = lang;
  els.result.dir = lang === "he" ? "rtl" : "ltr";
  els.result.getAnimations().forEach((a) => a.cancel());
  els.body.querySelectorAll(".care").forEach((n) => n.remove());
  els.after.classList.remove("is-in");
  els.related.hidden = true;
  els.odds.hidden = false;
  els.pre.textContent = "";
  els.num.textContent = "";
  els.num.className = "odds__num";
  els.alt.textContent = "";
  els.alt.classList.remove("is-in");
  [els.compare, els.explain, els.source, els.share].forEach((n) => { n.hidden = false; });
  [els.compare, els.explain, els.source].forEach((n) => { n.textContent = ""; });
  // it enters from the field above it, the thing that asked
  if (firstTime) motion.enterFrom(els.result, { dy: -10 });
}

// Thinking and the answer share one spot: one fades out as the other comes in.
function thinking(on) {
  if (on) {
    els.thinking.hidden = false;
    els.thinking.getAnimations().forEach((a) => a.cancel());
    els.body.hidden = true;
    motion.enterFrom(els.thinking, { dy: -6 });
    return;
  }
  els.body.hidden = false;
  if (els.thinking.hidden) return;
  motion.exitTo(els.thinking, { dy: 6 }).then(() => { els.thinking.hidden = true; els.thinking.getAnimations().forEach((a) => a.cancel()); });
}

// Details settle one after another, 30ms apart, once the number has landed.
function revealAfter() {
  els.after.classList.add("is-in");
  motion.stagger([...els.after.children].filter((c) => !c.hidden && (c.textContent.trim() || c.children.length)));
}

async function showFact(fact, question, lang, related, { animate = true } = {}) {
  const s = STR[lang];
  startCard(lang);
  thinking(false);
  const sameQuestion = stripOpener(normalize(fullQuestion(question, lang))) === stripOpener(normalize(fullQuestion(fact[lang].q, lang)));
  els.compare.textContent = compare(fact.p, lang, fact.id);
  els.explain.textContent = fact[lang].x;
  els.source.textContent = [s.badgeFact, sameQuestion ? "" : `${s.answered}${questionLine(fact[lang].q, lang)}`, s.source + fact.src].filter(Boolean).join(" · ");
  current = { question, lang, view: { kind: "fact", id: fact.id, related } };
  const seq = askSeq;
  await roll(els, fact.p, lang, animate ? { duration: 3000 } : { duration: 0, silent: true });
  if (seq !== askSeq) return;
  revealAfter();
}

async function showAi(view, question, lang) {
  const s = STR[lang];
  startCard(lang);
  thinking(false);
  current = { question, lang, view };
  const bits = [view.kind === "ai" ? `${s.badgeAi}, ${s.conf[view.confidence] || s.conf.low}` : s.badgeUnknown];
  if (view.timeframe) bits.push(view.timeframe);
  if (view.basis) bits.push(s.basis + view.basis);
  els.source.textContent = bits.join(" · ");
  els.explain.textContent = view.explanation;
  const seq = askSeq;
  if (view.kind === "ai") {
    els.compare.textContent = compare(view.p, lang);
    await roll(els, view.p, lang, { duration: 3000 });
    if (seq !== askSeq) return;
  } else {
    els.num.textContent = s.unknownNum;
    els.num.classList.add("is-final");
    els.alt.textContent = s.unknownAlt;
    els.alt.classList.add("is-in");
    motion.enterFrom(els.num, { dy: 8 });
    sound.land();
  }
  revealAfter();
}

function showNone(reason, question, lang, related) {
  const s = STR[lang];
  startCard(lang);
  thinking(false);
  els.odds.hidden = true;
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
  startCard(lang);
  thinking(false);
  els.odds.hidden = true;
  els.share.hidden = true;
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
  motion.stagger(box.children);
  revealAfter();
  current = { question, lang, view: { kind: "care" } };
}

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

// "Another question": the answer leaves back up into the field, 20% faster than it came.
async function clearResult() {
  askSeq++;
  stopRoll();
  if (!els.result.hidden) {
    await motion.exitTo(els.result, { dy: -10 });
    els.result.hidden = true;
    els.result.getAnimations().forEach((a) => a.cancel());
  }
  current = null;
  setTyped("");
  els.q.focus({ preventScroll: true });
  updateUrl({});
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
  if (!q) { els.q.focus(); boundaryNudge(); return; }
  const seq = ++askSeq;
  const lang = hasHebrew(q) ? "he" : /[a-z]/i.test(q) ? "en" : ui;
  const full = fullQuestion(q, lang);
  updateUrl({ q });

  if (needsCare(full)) { showCare(q, lang); return; }

  startCard(lang);
  thinking(true);
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
    setTyped("");
    for (let i = 1; i <= text.length; i++) {
      setTyped(text.slice(0, i));
      if (i % 3 === 0) sound.tap();
      await sleep(i < 4 ? 40 : 16);
      if (seq !== askSeq) return;
    }
  } else {
    setTyped(text);
  }
  ask(text, { factId: pick.id || undefined });
}

// ---------- share: the button itself says "copied", crossfading icon and label ----------
export async function shareLink(url, text, button) {
  if (navigator.share) {
    try { await navigator.share({ title: "What are the odds?", text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    confirmOn(button);
  } catch {
    prompt("", url);
  }
}

function confirmOn(button) {
  if (!button) return;
  if (!button._base) button._base = button.innerHTML;
  const base = button._base;
  motion.crossfade(button, `${icon("check")}<span>${STR[ui].copiedShort}</span>`);
  clearTimeout(button._t);
  button._t = setTimeout(() => { motion.crossfade(button, base); button._base = null; }, 1800);
  sound.tap();
}

function shareCurrent() {
  if (!current) return;
  const { question, lang, view } = current;
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set("q", question);
  let answerText = "";
  if (view.kind === "fact") answerText = plain(factById(view.id).p, lang);
  else if (view.kind === "ai") answerText = plain(view.p, lang);
  shareLink(url.href, `${questionLine(question, lang)} ${answerText}`.trim(), els.share);
}

// ---------- wire up ----------
const game = initGame($("game"), { apiBase: API_BASE, shareLink, lang: ui, onRoom: (code) => updateUrl({ mode: "game", room: code }) });

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  sound.unlock();
  els.q.blur();
  ask(typed());
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
els.again.addEventListener("click", clearResult);
els.tabCurious.addEventListener("click", () => { sound.tap(); setMode("curious"); });
els.tabGame.addEventListener("click", () => { sound.unlock(); sound.tap(); setMode("game"); });
els.modes.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = mode === "curious" ? "game" : "curious";
  setMode(next);
  tabFor(next).focus();
});
addEventListener("resize", () => placeKnob(false));
document.fonts && document.fonts.ready.then(() => placeKnob(false));

applyLang();

const params = new URLSearchParams(location.search);
if (params.get("room") || params.get("mode") === "game") {
  setMode("game", { push: false, animate: false });
  if (params.get("room")) game.openRoom(params.get("room"));
} else if (params.get("id") && factById(params.get("id"))) {
  const f = factById(params.get("id"));
  setTyped(f[ui].q);
  ask(f[ui].q, { factId: f.id });
} else if (params.get("q")) {
  setTyped(params.get("q"));
  ask(params.get("q"));
}
