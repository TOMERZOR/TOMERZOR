import { FACTS, CATEGORIES } from "./core/data.js";
import { findFact, factById, needsCare, normalize, stripOpener } from "./core/match.js";
import { describe, compare, plain, LANDMARKS } from "./core/format.js";

const STR = {
  he: {
    skip: "דלגו לשאלה", prefix: "מה הסיכוי", go: "בדקו", hint: "כתבו כל שאלה. נתונים בדוקים עונים מיד, וכל השאר מקבל הערכה מבוססת.",
    thinking: "מחשבים סיכויים…", impossible: "בלתי אפשרי", certain: "ודאי", share: "שתפו", again: "שאלה אחרת",
    related: "אולי התכוונתם:", relatedMore: "שאלות קרובות:", browse: "שאלות שכבר בדקנו", surprise: "תפתיעו אותי",
    foot1: "המספרים הם סטטיסטיקה על אוכלוסיות שלמות, לא תחזית עליך. זה לא ייעוץ רפואי, משפטי או כלכלי.",
    foot2: "✓ נתון בדוק: מספר ממקור שמופיע בתשובה, או חישוב מדויק. ✦ הערכת AI: הערכה של מודל שפה, כדאי לבדוק לפני שמסתמכים עליה.",
    oneIn: "1 מתוך", badgeFact: "✓ נתון בדוק", badgeAi: "✦ הערכת AI", badgeUnknown: "? אי אפשר לדעת מראש",
    conf: { high: "ביטחון גבוה", medium: "ביטחון בינוני", low: "הערכה גסה" },
    source: "מקור: ", basis: "בסיס: ", answered: "ענינו על: ", unknownNum: "?", unknownAlt: "תלוי בדברים שאף אחד לא יודע",
    noneTitle: "עוד אין לנו תשובה לזה",
    none: { "no-ai": "השאלה הזו לא ברשימת הנתונים הבדוקים, וכרגע אין חיבור לשרת שמחשב הערכות.", rate: "שאלתם הרבה שאלות בדקה האחרונה. נסו שוב עוד רגע.", "ai-failed": "השרת לא הצליח לחשב הערכה הפעם. נסו לנסח אחרת או שוב עוד רגע.", offline: "אין חיבור לשרת כרגע, אז אפשר לקבל רק תשובות מהנתונים הבדוקים." },
    careTitle: "רגע, בואו נדבר",
    careText: "על שאלה כזו לא נענה במספר. אם עובר עליך משהו קשה, לא צריך להתמודד לבד: אפשר לדבר עם מישהו עכשיו, בחינם ובאנונימיות.",
    careLines: [["ער״ן, עזרה ראשונה נפשית: 1201", "tel:1201"], ["סה״ר, צ׳אט תמיכה", "https://sahar.org.il"]],
    copied: "הקישור הועתק", examples: "דוגמאות", langBtn: "EN", langLabel: "English",
    placeholders: ["שהשמש תתפוצץ מחר", "להיוולד בן", "לזכות בלוטו", "שיפגע בי ברק השנה", "להיוולד בלי אוזניים", "שטוסט ייפול על החמאה"],
    starters: ["boy", "no-ears", "sun-explode"],
  },
  en: {
    skip: "Skip to the question", prefix: "What are the odds", go: "Check", hint: "Ask anything. Checked facts answer instantly; everything else gets a reasoned estimate.",
    thinking: "Crunching the odds…", impossible: "Impossible", certain: "Certain", share: "Share", again: "Ask another",
    related: "Did you mean:", relatedMore: "Related questions:", browse: "Questions we've checked", surprise: "Surprise me",
    foot1: "These numbers are statistics about whole populations, not predictions about you. Not medical, legal or financial advice.",
    foot2: "✓ Checked fact: a number from the source shown, or exact math. ✦ AI estimate: a language model's estimate; double-check before relying on it.",
    oneIn: "1 in", badgeFact: "✓ Checked fact", badgeAi: "✦ AI estimate", badgeUnknown: "? Nobody can know",
    conf: { high: "high confidence", medium: "medium confidence", low: "rough estimate" },
    source: "Source: ", basis: "Based on: ", answered: "Answering: ", unknownNum: "?", unknownAlt: "Depends on things nobody knows",
    noneTitle: "We don't have an answer for that yet",
    none: { "no-ai": "This isn't in our checked list, and the estimate server isn't reachable right now.", rate: "That's a lot of questions in a minute. Try again in a moment.", "ai-failed": "The server couldn't work out an estimate this time. Try rephrasing, or again in a moment.", offline: "No connection to the server right now, so only checked facts can be answered." },
    careTitle: "Hey, let's talk",
    careText: "We won't answer this one with a number. If you're going through something hard, you don't have to face it alone: you can talk to someone right now, free and anonymous.",
    careLines: [["In Israel: ERAN 1201", "tel:1201"], ["In the US: call or text 988", "tel:988"], ["Elsewhere: findahelpline.com", "https://findahelpline.com"]],
    copied: "Link copied", examples: "Examples", langBtn: "עב", langLabel: "עברית",
    placeholders: ["that the sun explodes tomorrow", "of being born a boy", "of winning the lottery", "of being struck by lightning", "of being born without ears", "of toast landing butter-side down"],
    starters: ["boy", "no-ears", "sun-explode"],
  },
};

const $ = (id) => document.getElementById(id);
const els = {
  form: $("ask"), q: $("q"), examples: $("examples"), result: $("result"), rq: $("r-q"), loading: $("r-loading"), body: $("r-body"),
  pre: $("r-pre"), num: $("r-num"), alt: $("r-alt"), badge: $("r-badge"), meter: $("r-meter"), fill: $("r-fill"), pin: $("r-pin"),
  marks: $("r-marks"), compare: $("r-compare"), explain: $("r-explain"), source: $("r-source"), related: $("r-related"),
  relatedTitle: $("r-related-title"), relatedList: $("r-related-list"), share: $("share"), again: $("again"), cats: $("cats"),
  surprise: $("surprise"), lang: $("lang"), toast: $("toast"),
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const hasHebrew = (s) => /[א-ת]/.test(s);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let ui = store.get("odds:lang") || (/^(he|iw)\b/i.test(navigator.language || "") ? "he" : "en");
let current = null; // { question, lang, view } for re-render and sharing
let askSeq = 0;

const cfg = window.ODDS_CONFIG || {};
const sameOrigin = /\.workers\.dev$/.test(location.hostname) || ["localhost", "127.0.0.1"].includes(location.hostname);
const API = (sameOrigin ? "" : (cfg.server || "")) + "/api/odds";

// ---------- language ----------
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
  els.examples.setAttribute("aria-label", s.examples);
  els.q.placeholder = s.placeholders[0];
  renderExamples();
  renderBrowse();
  if (current && current.view.kind === "fact") {
    const f = factById(current.view.id);
    els.q.value = f[ui].q;
    showFact(f, f[ui].q, ui, current.view.related, false);
    updateUrl(f[ui].q);
  }
}

function setLang(l) {
  ui = l;
  store.set("odds:lang", l);
  applyLang();
}

// rotate the placeholder so people see what kind of questions work
let phIndex = 0;
setInterval(() => {
  if (document.activeElement === els.q || els.q.value) return;
  const list = STR[ui].placeholders;
  phIndex = (phIndex + 1) % list.length;
  els.q.placeholder = list[phIndex];
}, 3200);

// ---------- chips ----------
function chip(fact, lang = ui) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = fact[lang].q;
  b.addEventListener("click", () => {
    els.q.value = fact[lang].q;
    ask(fact[lang].q, { factId: fact.id });
  });
  return b;
}

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

let exampleIds = null;
function renderExamples() {
  if (!exampleIds) {
    const starters = STR.he.starters;
    exampleIds = starters.concat(shuffle(FACTS.filter((f) => !starters.includes(f.id))).slice(0, 3).map((f) => f.id));
  }
  els.examples.replaceChildren(...exampleIds.map((id) => chip(factById(id))));
}

function shortValue(p, lang) {
  const d = describe(p, lang);
  if (d.main.kind === "oneIn") return d.main.exp != null ? `1:${d.main.text}e${d.main.exp}` : `1:${d.main.text}`;
  return d.main.text;
}

function renderBrowse() {
  const groups = CATEGORIES.map((c) => {
    const facts = FACTS.filter((f) => f.cat === c.id);
    const d = document.createElement("details");
    d.className = "cat";
    const sum = document.createElement("summary");
    sum.innerHTML = `<span aria-hidden="true"></span><span></span><span class="cat__count"></span>`;
    sum.children[0].textContent = c.icon;
    sum.children[1].textContent = c[ui];
    sum.children[2].textContent = `(${facts.length})`;
    const ul = document.createElement("ul");
    for (const f of facts) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const q = document.createElement("span");
      q.textContent = f[ui].q;
      const v = document.createElement("span");
      v.className = "val";
      v.dir = "auto";
      v.textContent = shortValue(f.p, ui);
      b.append(q, v);
      b.addEventListener("click", () => {
        els.q.value = f[ui].q;
        ask(f[ui].q, { factId: f.id });
        els.form.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      });
      li.append(b);
      ul.append(li);
    }
    d.append(sum, ul);
    return d;
  });
  els.cats.replaceChildren(...groups);
}

// ---------- result rendering ----------
function questionLine(text, lang) {
  const s = STR[lang];
  const opener = stripOpener(normalize(text)) !== normalize(text);
  let t = text.trim().replace(/[?？!.]+$/, "");
  return (opener ? t : `${s.prefix} ${t}`) + "?";
}

function showCard(lang) {
  els.result.hidden = false;
  els.result.lang = lang;
  els.result.dir = lang === "he" ? "rtl" : "ltr";
  els.result.style.animation = "none";
  void els.result.offsetWidth;
  els.result.style.animation = "";
}

function setLoading(on) {
  els.loading.hidden = !on;
  els.body.hidden = on;
  if (on) els.related.hidden = true;
}

let animFrame = 0;
function paintNumber(p, lang) {
  const d = describe(p, lang);
  const s = STR[lang];
  els.num.classList.toggle("is-words", d.main.kind === "oneIn" && /[^\d.,\s]/.test(d.main.text));
  els.num.dir = "auto";
  if (d.main.kind === "oneIn") {
    els.pre.textContent = s.oneIn;
    if (d.main.exp != null) {
      els.num.innerHTML = "";
      els.num.dir = "ltr";
      const sup = document.createElement("sup");
      sup.textContent = d.main.exp;
      const x = document.createElement("span");
      x.className = "x";
      x.textContent = "×";
      els.num.append(d.main.text, x, "10", sup);
    } else {
      els.num.textContent = d.main.text;
    }
  } else {
    els.pre.textContent = "";
    els.num.textContent = d.main.text;
  }
  els.alt.textContent = d.alt;
  return d;
}

function animateNumber(p, lang) {
  cancelAnimationFrame(animFrame);
  const target = p <= 0 ? -12 : Math.log10(p);
  if (reducedMotion || target > -0.02) { paintNumber(p, lang); return; }
  const start = performance.now();
  const dur = Math.min(1100, 500 + Math.abs(target) * 60);
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    if (t < 1) {
      paintNumber(Math.pow(10, target * e), lang);
      animFrame = requestAnimationFrame(step);
    } else {
      paintNumber(p, lang);
    }
  };
  animFrame = requestAnimationFrame(step);
}

const MIN_LOG = -10;
function paintMeter(p, lang) {
  els.meter.hidden = false;
  const log = p <= 0 ? -Infinity : Math.log10(p);
  const off = p > 0 && log < MIN_LOG;
  const pos = p <= 0 ? 0 : Math.max(0, Math.min(1, (log - MIN_LOG) / -MIN_LOG));
  els.pin.classList.toggle("is-off", off);
  els.fill.style.width = "0%";
  els.pin.style.insetInlineStart = "0%";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    els.fill.style.width = `${pos * 100}%`;
    els.pin.style.insetInlineStart = `${pos * 100}%`;
  }));
  const shown = LANDMARKS.filter((l) => l.short);
  els.marks.replaceChildren(...shown.map((l, i) => {
    const m = document.createElement("span");
    m.className = "mark" + (i % 2 ? " mark--low" : "");
    m.style.insetInlineStart = `${((Math.log10(l.p) - MIN_LOG) / -MIN_LOG) * 100}%`;
    m.textContent = l.short[lang];
    return m;
  }));
}

function setBadge(kind, text) {
  els.badge.className = `badge badge--${kind}`;
  els.badge.textContent = text;
  els.badge.hidden = false;
}

function setRelated(ids, lang, title) {
  const facts = (ids || []).map((id) => factById(id)).filter(Boolean).slice(0, 4);
  els.related.hidden = !facts.length;
  els.relatedTitle.textContent = title || STR[lang].related;
  els.relatedList.replaceChildren(...facts.map((f) => chip(f, lang)));
}

function resetBody() {
  els.body.querySelectorAll(".care").forEach((n) => n.remove());
  [els.pre, els.num, els.alt, els.compare, els.explain, els.source].forEach((n) => { n.textContent = ""; n.hidden = false; });
  els.badge.hidden = false;
  els.meter.hidden = false;
  els.share.hidden = false;
  document.getElementById("r-odds").hidden = false;
}

function showFact(fact, question, lang, related, animate = true) {
  const s = STR[lang];
  showCard(lang);
  setLoading(false);
  resetBody();
  const text = question || fact[lang].q;
  els.rq.textContent = questionLine(text, lang);
  const sameQuestion = normalize(stripOpener(normalize(text))) === normalize(fact[lang].q);
  if (animate) animateNumber(fact.p, lang); else paintNumber(fact.p, lang);
  setBadge("fact", s.badgeFact);
  paintMeter(fact.p, lang);
  els.compare.textContent = compare(fact.p, lang, fact.id);
  els.explain.textContent = fact[lang].x;
  els.source.textContent = (sameQuestion ? "" : `${s.answered}${fact[lang].q} · `) + s.source + fact.src;
  setRelated((related || []).filter((id) => id !== fact.id), lang, s.relatedMore);
  current = { question: text, lang, view: { kind: "fact", id: fact.id, related } };
}

function showAi(view, question, lang) {
  const s = STR[lang];
  showCard(lang);
  setLoading(false);
  resetBody();
  els.rq.textContent = questionLine(question, lang);
  if (view.kind === "ai") {
    animateNumber(view.p, lang);
    setBadge("ai", `${s.badgeAi} · ${s.conf[view.confidence] || s.conf.low}`);
    paintMeter(view.p, lang);
    els.compare.textContent = compare(view.p, lang);
  } else {
    els.pre.textContent = "";
    els.num.textContent = s.unknownNum;
    els.num.classList.remove("is-words");
    els.alt.textContent = s.unknownAlt;
    setBadge("unknown", s.badgeUnknown);
    els.meter.hidden = true;
  }
  els.explain.textContent = view.explanation;
  const bits = [];
  if (view.timeframe) bits.push(view.timeframe);
  if (view.basis) bits.push(s.basis + view.basis);
  els.source.textContent = bits.join(" · ");
  setRelated(view.related, lang, s.relatedMore);
  current = { question, lang, view };
}

function showNone(reason, question, lang, related) {
  const s = STR[lang];
  showCard(lang);
  setLoading(false);
  resetBody();
  els.rq.textContent = questionLine(question, lang);
  document.getElementById("r-odds").hidden = true;
  els.badge.hidden = true;
  els.meter.hidden = true;
  els.share.hidden = true;
  els.compare.textContent = s.noneTitle;
  els.explain.textContent = s.none[reason] || s.none["ai-failed"];
  let ids = related || [];
  if (!ids.length) ids = shuffle(FACTS).slice(0, 4).map((f) => f.id);
  setRelated(ids, lang, s.related);
  current = { question, lang, view: { kind: "none", reason, related } };
}

function showCare(question, lang) {
  const s = STR[lang];
  showCard(lang);
  setLoading(false);
  resetBody();
  els.rq.textContent = questionLine(question, lang);
  document.getElementById("r-odds").hidden = true;
  els.badge.hidden = true;
  els.meter.hidden = true;
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
  els.related.hidden = true;
  current = { question, lang, view: { kind: "care" } };
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
    const res = await fetch(API, {
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

function updateUrl(q) {
  const url = new URL(location.href);
  url.searchParams.set("q", q);
  url.searchParams.delete("id");
  history.replaceState(null, "", url);
}

async function ask(raw, { factId } = {}) {
  const q = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (!q) { els.q.focus(); return; }
  const seq = ++askSeq;
  const lang = hasHebrew(q) ? "he" : /[a-z]/i.test(q) ? "en" : ui;
  updateUrl(q);

  if (needsCare(q)) { showCare(q, lang); return; }

  const direct = factId ? factById(factId) : null;
  const { fact, related } = direct ? { fact: direct, related: [] } : findFact(q);
  if (fact) { showFact(fact, q, lang, related.map((f) => f.id)); return; }

  showCard(lang);
  els.rq.textContent = questionLine(q, lang);
  setLoading(true);
  if (!reducedMotion) els.result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  try {
    const body = await fetchAnswer(q, lang);
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

// ---------- share ----------
function toast(text) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { els.toast.hidden = true; }, 2200);
}

async function share() {
  if (!current) return;
  const { question, lang, view } = current;
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("q", question);
  url.hash = "";
  let answerText = "";
  if (view.kind === "fact") answerText = plain(factById(view.id).p, lang);
  else if (view.kind === "ai") answerText = plain(view.p, lang);
  const text = `${questionLine(question, lang)} ${answerText}`.trim();
  if (navigator.share) {
    try { await navigator.share({ title: "What are the odds?", text, url: url.href }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url.href}`);
    toast(STR[ui].copied);
  } catch {
    prompt("", url.href);
  }
}

// ---------- wire up ----------
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  els.q.blur();
  ask(els.q.value);
});
els.lang.addEventListener("click", () => setLang(ui === "he" ? "en" : "he"));
els.share.addEventListener("click", share);
els.again.addEventListener("click", () => {
  els.q.value = "";
  els.q.focus({ preventScroll: true });
  els.form.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});
els.surprise.addEventListener("click", () => {
  const f = FACTS[Math.floor(Math.random() * FACTS.length)];
  els.q.value = f[ui].q;
  ask(f[ui].q, { factId: f.id });
  els.form.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
});

applyLang();

const params = new URLSearchParams(location.search);
if (params.get("id") && factById(params.get("id"))) {
  const f = factById(params.get("id"));
  els.q.value = f[ui].q;
  ask(f[ui].q, { factId: f.id });
} else if (params.get("q")) {
  els.q.value = params.get("q");
  ask(params.get("q"));
}
