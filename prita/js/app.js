// פריטה: the app. Views, practice activities, the daily session and saved progress.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const h = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const today = () => new Date().toLocaleDateString("sv");
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Saved progress ----------
const KEY = "prita.v1";
const blank = () => ({
  onboarded: false,
  goalMin: 20,
  done: {},
  bpm: {},
  records: { changes: {}, notes: {}, ear: {}, bpm: {} },
  log: {},
  sessions: 0,
  settings: { tuning: "standard", labels: "name" },
});
let S = blank();
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) S = Object.assign(blank(), saved, { records: Object.assign(blank().records, saved.records || {}), settings: Object.assign(blank().settings, saved.settings || {}) });
} catch (e) { /* keep defaults */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };

function record(type, key, value) {
  const r = S.records[type];
  if (!(r[key] >= value)) { r[key] = value; save(); return true; }
  return false;
}

function currentLevel() {
  return PATH.find((l) => l.units.some((u) => !S.done[u.id])) || PATH[PATH.length - 1];
}
function unitById(id) {
  for (const l of PATH) for (const u of l.units) if (u.id === id) return { unit: u, level: l };
  return null;
}
function goalMet(u) {
  const c = u.check;
  if (!c || c === "self") return false;
  if (c.changes) return (S.records.changes[c.changes.join("-")] || 0) >= c.min;
  if (c.bpm) return (S.records.bpm[c.bpm] || 0) >= c.min;
  if (c.notes) return (S.records.notes[(u.strings || [0, 1, 2, 3, 4, 5]).join("")] || 0) >= c.notes;
  if (c.ear) return (S.records.ear[u.mode || "intervals"] || 0) >= c.ear;
  return false;
}

// ---------- Practice time ----------
let activeCount = 0;
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  if (activeCount > 0 || toolsMetro.running) {
    const d = today();
    S.log[d] = (S.log[d] || 0) + 5;
    save();
  }
}, 5000);

function streak() {
  let n = 0;
  const d = new Date();
  if (!(S.log[today()] >= 120)) d.setDate(d.getDate() - 1); // today still counts until midnight
  for (;;) {
    const k = d.toLocaleDateString("sv");
    if (S.log[k] >= 120) { n++; d.setDate(d.getDate() - 1); } else break;
  }
  return n;
}
const minutesOn = (k) => Math.round((S.log[k] || 0) / 60);

// ---------- Drawing ----------
function chordSVG(id) {
  const ch = CHORDS[id];
  const fr = ch.frets;
  const pressed = fr.filter((f) => f > 0);
  const max = Math.max(0, ...pressed);
  const base = max > 4 ? Math.min(...pressed) : 1;
  const rows = Math.max(4, max - base + 1);
  const W = 120, L = 22, T = 26, sw = 16, fh = 112 / rows;
  const H = T + rows * fh + 8;
  const x = (s) => L + s * sw;
  let g = "";
  for (let s = 0; s < 6; s++) g += `<line x1="${x(s)}" y1="${T}" x2="${x(s)}" y2="${T + rows * fh}" class="str" style="stroke-width:${1.6 - s * 0.15}"/>`;
  for (let r = 0; r <= rows; r++) g += `<line x1="${L}" y1="${T + r * fh}" x2="${x(5)}" y2="${T + r * fh}" class="fret"/>`;
  if (base === 1) g += `<rect x="${L - 1}" y="${T - 4}" width="${5 * sw + 2}" height="5" rx="1.5" class="nut"/>`;
  else g += `<text x="7" y="${T + fh * 0.62}" class="basefret" text-anchor="middle">${base}</text>`;
  fr.forEach((f, s) => {
    if (f < 0) g += `<text x="${x(s)}" y="${T - 10}" class="mx" text-anchor="middle">×</text>`;
    else if (f === 0) g += `<circle cx="${x(s)}" cy="${T - 14}" r="4" class="open"/>`;
  });
  const b = ch.barre;
  if (b) {
    const y = T + (b.fret - base + 0.5) * fh;
    g += `<rect x="${x(b.from) - 7}" y="${y - 7}" width="${x(b.to) - x(b.from) + 14}" height="14" rx="7" class="dot"/>`;
  }
  fr.forEach((f, s) => {
    if (f <= 0) return;
    if (b && f === b.fret && s >= b.from && s <= b.to && ch.fingers[s] === 1) return;
    const y = T + (f - base + 0.5) * fh;
    g += `<circle cx="${x(s)}" cy="${y}" r="7" class="dot"/>`;
    if (ch.fingers[s]) g += `<text x="${x(s)}" y="${y + 3.6}" class="fing" text-anchor="middle">${ch.fingers[s]}</text>`;
  });
  if (b) g += `<text x="${x(b.from) - 0}" y="${T + (b.fret - base + 0.5) * fh + 3.6}" class="fing" text-anchor="middle">1</text>`;
  return `<svg class="chord-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${chordName(id)}">${g}</svg>`;
}

function chordCard(id, extra = "") {
  return `<div class="chord-card ${extra}" data-chord="${id}"><b dir="ltr">${chordName(id)}</b>${chordSVG(id)}</div>`;
}

// Horizontal neck, high e on top. marks: [{ s, f, label, cls }]
function fretboardSVG({ frets = 15, marks = [], tuning = TUNING, hits = false, fit = false, fw = 46, sp = 25 } = {}) {
  const N = 34, T = 16;
  const W = N + frets * fw + 10, H = T * 2 + 5 * sp + 14;
  const y = (s) => T + (5 - s) * sp;
  const cx = (f) => (f === 0 ? N - 17 : N + (f - 0.5) * fw);
  let g = `<rect x="${N}" y="${T - 6}" width="${frets * fw}" height="${5 * sp + 12}" class="wood" rx="3"/>`;
  [3, 5, 7, 9, 15, 17, 19, 21].filter((f) => f <= frets).forEach((f) => (g += `<circle cx="${cx(f)}" cy="${T + 2.5 * sp}" r="5" class="inlay"/>`));
  if (frets >= 12) g += `<circle cx="${cx(12)}" cy="${T + 1.5 * sp}" r="5" class="inlay"/><circle cx="${cx(12)}" cy="${T + 3.5 * sp}" r="5" class="inlay"/>`;
  for (let f = 0; f <= frets; f++) g += `<line x1="${N + f * fw}" y1="${T - 6}" x2="${N + f * fw}" y2="${T + 5 * sp + 6}" class="${f === 0 ? "nutline" : "fretline"}"/>`;
  for (let s = 0; s < 6; s++) {
    g += `<line x1="${N - 26}" y1="${y(s)}" x2="${W - 10}" y2="${y(s)}" class="strline" style="stroke-width:${2.4 - s * 0.32}"/>`;
    g += `<text x="6" y="${y(s) + 4}" class="sname">${Sound.noteName(tuning[s])}</text>`;
  }
  for (let f = 1; f <= frets; f++) g += `<text x="${cx(f)}" y="${H - 3}" class="fnum" text-anchor="middle">${f}</text>`;
  if (hits) for (let s = 0; s < 6; s++) for (let f = 0; f <= frets; f++) g += `<rect class="hit" data-s="${s}" data-f="${f}" x="${f === 0 ? 0 : N + (f - 1) * fw}" y="${y(s) - sp / 2}" width="${f === 0 ? N : fw}" height="${sp}"/>`;
  marks.forEach((m) => {
    g += `<g class="mark ${m.cls || ""}" data-s="${m.s}" data-f="${m.f}"><circle cx="${cx(m.f)}" cy="${y(m.s)}" r="11"/>${m.label != null ? `<text x="${cx(m.f)}" y="${y(m.s) + 4}" text-anchor="middle">${m.label}</text>` : ""}</g>`;
  });
  const size = fit ? `width="100%"` : `width="${W}" height="${H}"`;
  return `<div class="fb-scroll" dir="ltr"><svg class="fb" viewBox="0 0 ${W} ${H}" ${size}>${g}</svg></div>`;
}

function scaleMarks(rootName, scaleId, box = null, frets = 15) {
  const rootPc = NOTE_NAMES.indexOf(rootName);
  const sc = SCALES[scaleId];
  let win = null;
  if (box != null && sc.boxes) {
    const rootFret = (rootPc - 4 + 12) % 12;
    let start = rootFret + sc.steps[box];
    if (start > 12) start -= 12;
    win = [start - 1, start + 3];
  }
  const marks = [];
  for (let s = 0; s < 6; s++) for (let f = 0; f <= frets; f++) {
    if (win && (f < win[0] || f > win[1])) continue;
    const m = TUNING[s] + f;
    const deg = (((m - rootPc) % 12) + 12) % 12;
    const i = sc.steps.indexOf(deg);
    if (i < 0) continue;
    const label = S.settings.labels === "deg" ? degreeLabel(deg) : Sound.noteName(m);
    marks.push({ s, f, label, cls: deg === 0 ? "root" : "", midi: m });
  }
  return marks;
}
const DEG = { 0: "1", 1: "b2", 2: "2", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "b6", 9: "6", 10: "b7", 11: "7" };
const degreeLabel = (d) => DEG[d];

// ---------- Panels: pushed screens and bottom sheets ----------
const panelStack = [];
let ignorePop = 0;
function openPanel(title, build, { onClose, sheet = false, cls = "" } = {}) {
  const el = h(sheet
    ? `<section class="sheet-wrap ${cls}" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="scrim"></div>
        <div class="sheet"><div class="sheet-grip"><i class="grabber"></i><header class="sheet-head"><h2>${title}</h2><button class="icon-btn close" aria-label="סגירה">${icon("close")}</button></header></div>
        <div class="panel-body"></div></div></section>`
    : `<section class="panel ${cls}" role="dialog" aria-label="${title}">
        <header class="panel-head"><button class="icon-btn back" aria-label="חזרה">${icon("back")}</button><h2>${title}</h2><span class="head-slot"></span></header>
        <div class="panel-body"></div><div class="edge"></div></section>`);
  document.body.appendChild(el);
  const p = { el, sheet, body: $(".panel-body", el), cleanups: [], onClose, head: $(".head-slot", el) };
  p.cleanup = (fn) => p.cleanups.push(fn);
  p.close = () => closePanel(p);
  $(".back, .close", el).onclick = () => history.back();
  if (sheet) { $(".scrim", el).onclick = () => history.back(); dragToDismiss(p); }
  else edgeSwipe(p);
  panelStack.push(p);
  activeCount++;
  history.pushState({ panel: panelStack.length }, "");
  stackChanged();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("open")));
  build(p.body, p);
  return p;
}
function closePanel(p, fromPop) {
  const i = panelStack.indexOf(p);
  if (i < 0) return;
  panelStack.splice(i, 1);
  activeCount--;
  p.cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  if (p.onClose) p.onClose();
  p.el.classList.remove("open");
  p.el.classList.add("closing");
  stackChanged();
  setTimeout(() => p.el.remove(), 420);
  if (!fromPop) { ignorePop++; history.back(); }
}
// Screens underneath slide aside and dim, like a native navigation stack.
function stackChanged() {
  const full = panelStack.filter((x) => !x.sheet);
  document.body.classList.toggle("pushed", full.length > 0);
  document.body.classList.toggle("sheeted", panelStack.length > 0 && panelStack[panelStack.length - 1].sheet);
  full.forEach((x, i) => x.el.classList.toggle("behind", i < full.length - 1));
}
window.addEventListener("popstate", () => {
  if (ignorePop) { ignorePop--; return; }
  const top = panelStack[panelStack.length - 1];
  if (top) closePanel(top, true);
});

// Drag from the screen edge to go back (right edge in Hebrew).
function edgeSwipe(p) {
  const edge = $(".edge", p.el), el = p.el;
  let x0 = null, t0 = 0, dx = 0;
  edge.addEventListener("pointerdown", (e) => { x0 = e.clientX; t0 = performance.now(); dx = 0; el.classList.add("dragging"); edge.setPointerCapture(e.pointerId); });
  edge.addEventListener("pointermove", (e) => {
    if (x0 == null) return;
    dx = Math.min(0, e.clientX - x0);
    el.style.transform = `translateX(${dx}px)`;
    document.body.style.setProperty("--back-progress", Math.min(1, -dx / innerWidth));
  });
  const up = () => {
    if (x0 == null) return;
    const v = dx / Math.max(1, performance.now() - t0);
    el.classList.remove("dragging");
    el.style.transform = "";
    document.body.style.removeProperty("--back-progress");
    if (dx < -innerWidth * 0.3 || v < -0.5) { haptic(8); history.back(); }
    x0 = null;
  };
  edge.addEventListener("pointerup", up);
  edge.addEventListener("pointercancel", up);
}

// Pull a sheet down by its grip to close it.
function dragToDismiss(p) {
  const grip = $(".sheet-grip", p.el), sh = $(".sheet", p.el);
  let y0 = null, t0 = 0, dy = 0;
  grip.addEventListener("pointerdown", (e) => { if (e.target.closest(".close")) return; y0 = e.clientY; t0 = performance.now(); dy = 0; sh.classList.add("dragging"); grip.setPointerCapture(e.pointerId); });
  grip.addEventListener("pointermove", (e) => {
    if (y0 == null) return;
    dy = e.clientY - y0;
    sh.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;
  });
  const up = () => {
    if (y0 == null) return;
    const v = dy / Math.max(1, performance.now() - t0);
    sh.classList.remove("dragging");
    sh.style.transform = "";
    if (dy > 110 || v > 0.6) history.back();
    y0 = null;
  };
  grip.addEventListener("pointerup", up);
  grip.addEventListener("pointercancel", up);
}

// A pill that drops in at the top of the screen.
let toastEl = null, toastTimer = 0;
function toast(msg, ic = "check") {
  if (!toastEl) { toastEl = h(`<div class="island" role="status" aria-live="polite"></div>`); document.body.appendChild(toastEl); }
  toastEl.innerHTML = `${icon(ic)}<span>${msg}</span>`;
  toastEl.classList.remove("show");
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not supported */ }
}

// ---------- Transport bar used inside exercises ----------
function metroControl(container, metro, { bpm, min = 30, max = 240, onBpm } = {}) {
  metro.bpm = bpm || metro.bpm;
  const el = h(`<div class="transport">
    <button class="t-play" aria-label="הפעלה">${icon("play")}</button>
    <div class="t-bpm" dir="ltr">
      <button class="t-step" data-d="-5" aria-label="האטה">${icon("minus")}</button>
      <div class="t-num" title="גררו לצדדים"><b>${metro.bpm}</b><small>BPM</small></div>
      <button class="t-step" data-d="5" aria-label="האצה">${icon("plus")}</button>
    </div>
    <div class="t-beats" dir="ltr">${Array.from({ length: metro.beats }, () => "<i></i>").join("")}</div>
  </div>`);
  container.appendChild(el);
  const b = $(".t-num b", el), playBtn = $(".t-play", el);
  const set = (v) => { metro.bpm = clamp(v, min, max); b.textContent = metro.bpm; if (onBpm) onBpm(metro.bpm); };
  $$(".t-step", el).forEach((s) => (s.onclick = () => set(metro.bpm + +s.dataset.d)));
  scrubber($(".t-num", el), () => metro.bpm, set, 0.2);
  const dots = () => $$(".t-beats i", el);
  const prevTick = metro.onTick;
  metro.onTick = (info) => {
    if (info.sub === 0) {
      dots().forEach((d, i) => d.classList.toggle("on", i === info.beat));
      playBtn.classList.remove("pulse"); void playBtn.offsetWidth; playBtn.classList.add("pulse");
    }
    if (prevTick) prevTick(info);
  };
  metro.onBpm = (v) => { b.textContent = v; if (onBpm) onBpm(v); };
  const toggle = () => {
    if (metro.running) { metro.stop(); playBtn.innerHTML = icon("play"); playBtn.classList.remove("on"); dots().forEach((d) => d.classList.remove("on")); }
    else { metro.start(); playBtn.innerHTML = icon("stop"); playBtn.classList.add("on"); }
  };
  playBtn.onclick = toggle;
  return { el, set, toggle, stop: () => metro.running && toggle() };
}

// ---------- Activities ----------
// Each takes (container, params, panel) and returns { bpm() } when it has a tempo.
const Acts = {};

function stepsHTML(u) {
  if (!u.how) return "";
  return `<details class="how" ${u.openHow ? "open" : ""}><summary>איך עושים את זה</summary><ol>${u.how.map((x) => `<li>${x}</li>`).join("")}</ol>${u.goal ? `<p class="goal">${icon("train")}<span>יעד: ${u.goal}</span></p>` : ""}</details>`;
}

Acts.chords = (c, u, p) => {
  const metro = new Sound.Metronome();
  p.cleanup(() => metro.stop());
  const chords = u.chords;
  const barsPer = u.barsPer || (u.bpm <= 60 ? 2 : 1);
  const strum = STRUMS[u.strum || "quarters"];
  metro.sub = strum.sub;
  metro.subClicks = false;
  let withSound = true;
  c.appendChild(h(`<div class="chord-row">${chords.map((id) => chordCard(id)).join("")}</div>`));
  c.appendChild(h(`<div class="strum-line" dir="ltr">${strumCells(strum)}</div>`));
  const opts = h(`<label class="toggle-row"><span>האפליקציה מנגנת איתי</span><input type="checkbox" class="toggle" checked></label>`);
  c.appendChild(opts);
  $("input", opts).onchange = (e) => (withSound = e.target.checked);
  const cards = $$(".chord-row .chord-card", c);
  const cells = $$(".strum-line i", c);
  const cellIdx = (info) => (info.beat * strum.sub + info.sub) % strum.slots.length;
  metro.onSchedule = (info, t) => {
    const idx = Math.floor(info.bar / barsPer) % chords.length;
    const k = strum.slots[(info.slot) % strum.slots.length];
    if (withSound && (k === "D" || k === "U")) Sound.strum(chords[idx], t, k, 0.28, 60 / metro.bpm * 1.6);
  };
  metro.onTick = (info) => {
    const idx = Math.floor(info.bar / barsPer) % chords.length;
    cards.forEach((el, i) => el.classList.toggle("now", i === idx));
    cells.forEach((el, i) => el.classList.toggle("now", i === cellIdx(info)));
  };
  cards.forEach((el) => (el.onclick = () => Sound.strum(el.dataset.chord)));
  metroControl(c, metro, { bpm: u.bpmNow || u.bpm });
  return { bpm: () => metro.bpm };
};

function strumCells(strum) {
  const per = strum.sub;
  const count = per === 4 ? ["1", "e", "&", "a"] : ["1", "&"];
  return [...strum.slots].map((k, i) => {
    const beat = Math.floor(i / per) + 1;
    const lab = i % per === 0 ? beat : count[i % per];
    const arrow = k === "D" ? "↓" : k === "U" ? "↑" : "·";
    return `<i class="${k === "-" ? "rest" : ""}"><b>${arrow}</b><small>${lab}</small></i>`;
  }).join("");
}

Acts.strum = (c, u, p) => {
  const strum = STRUMS[u.strum];
  const api = Acts.chords(c, Object.assign({}, u, { chords: [u.chord], barsPer: 1 }), p);
  const words = [...strum.slots].filter((k) => k !== "-").map((k) => (k === "D" ? "למטה" : "למעלה"));
  $(".chord-row", c).insertAdjacentHTML("afterend", `<p class="hint">${strum.name}: ${words.join(" ")}</p>`);
  return api;
};

Acts.changes = (c, u, p) => {
  const [a, bId] = u.pair;
  const key = u.pair.join("-");
  c.appendChild(h(`<div class="chord-row big">${chordCard(a)}${chordCard(bId)}</div>`));
  const best = () => S.records.changes[key] || 0;
  const box = h(`<div class="changes">
    <div class="ch-stats"><div><small>זמן</small><b class="t">60</b></div><div><small>החלפות</small><b class="n">0</b></div><div><small>שיא</small><b class="best">${best()}</b></div></div>
    <button class="tap-big">התחל דקה</button>
    <p class="hint">החליפו בין האקורדים. בכל פעם שהגעתם לאקורד, הקישו על הכפתור (או על מקש הרווח).</p>
  </div>`);
  c.appendChild(box);
  const tap = $(".tap-big", box), tEl = $(".t", box), nEl = $(".n", box);
  let n = 0, end = 0, timer = 0, running = false;
  const cards = $$(".chord-card", c);
  const finish = () => {
    running = false;
    clearInterval(timer);
    tap.textContent = "עוד דקה";
    tap.classList.remove("live");
    const isNew = record("changes", key, n);
    $(".best", box).textContent = best();
    Sound.click(Sound.context().currentTime + 0.01, 2);
    toast(isNew && n ? `שיא חדש: ${n} החלפות` : `${n} החלפות · השיא ${best()}`, isNew && n ? "flame" : "loop");
  };
  const hit = () => {
    if (!running) {
      n = 0; nEl.textContent = 0; running = true; end = Date.now() + 60000;
      tap.textContent = "החלפתי!"; tap.classList.add("live");
      cards.forEach((el, i) => el.classList.toggle("now", i === 0));
      timer = setInterval(() => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        tEl.textContent = left;
        if (left <= 0) finish();
      }, 200);
      return;
    }
    n++;
    nEl.textContent = n;
    cards.forEach((el, i) => el.classList.toggle("now", i === n % 2));
  };
  tap.onclick = hit;
  const onKey = (e) => { if (e.code === "Space") { e.preventDefault(); hit(); } };
  document.addEventListener("keydown", onKey);
  p.cleanup(() => { clearInterval(timer); document.removeEventListener("keydown", onKey); });
};

function cleanRecordButton(c, metro, key, label = "ניגנתי נקי") {
  const btn = h(`<button class="btn wide rec">${icon("check")}<span>${label} ב-<span class="v">${metro.bpm}</span> BPM</span></button>`);
  const best = h(`<p class="hint best-line"></p>`);
  const paint = () => { $(".v", btn).textContent = metro.bpm; best.textContent = S.records.bpm[key] ? `השיא שלכם: ${S.records.bpm[key]} BPM` : ""; };
  btn.onclick = () => { if (record("bpm", key, metro.bpm)) toast(`שיא חדש: ${metro.bpm} BPM`, "flame"); else toast("נשמר · השיא נשאר " + S.records.bpm[key]); paint(); };
  c.append(btn, best);
  paint();
  return paint;
}

Acts.spider = (c, u, p) => {
  const metro = new Sound.Metronome();
  p.cleanup(() => metro.stop());
  metro.sub = u.sub || 1;
  const pos = u.sub >= 2 ? 5 : 1;
  const nums = [pos, pos + 1, pos + 2, pos + 3];
  const lines = STRING_NAMES.slice().reverse().map((n, ri) => {
    const s = 5 - ri;
    const cells = [];
    for (let k = 0; k < 6; k++) cells.push(k === s ? nums.map((x) => String(x).padStart(2, "-")).join("-") : "-----------");
    return `${n.padEnd(1)}|-${cells.join("-")}-|`;
  });
  c.appendChild(h(`<pre class="tab" dir="ltr">${lines.join("\n")}</pre>`));
  c.appendChild(h(`<p class="hint">עולים מ-E הנמוך ל-e ובחזרה. ${metro.sub === 1 ? "תו אחד לכל קליק." : metro.sub === 2 ? "שני תווים לכל פעמה." : metro.sub === 3 ? "שלושה תווים לכל פעמה." : "ארבעה תווים לכל פעמה."} סריגים ${pos} עד ${pos + 3}.</p>`));
  const trainer = h(`<label class="toggle-row"><span>מאמן מהירות<small>‎+2 BPM כל 4 תיבות</small></span><input type="checkbox" class="toggle"></label>`);
  c.appendChild(trainer);
  let base = u.bpmNow || u.bpm;
  $("input", trainer).onchange = (e) => (metro.trainer = e.target.checked ? { step: 2, everyBars: 4, target: base + 30 } : null);
  let paint = () => {};
  metroControl(c, metro, { bpm: base, onBpm: () => paint() });
  paint = cleanRecordButton(c, metro, "spider");
  return { bpm: () => metro.bpm };
};

Acts.scale = (c, u, p) => {
  const metro = new Sound.Metronome();
  p.cleanup(() => metro.stop());
  metro.sub = u.sub || 1;
  let key = u.root || "A", scale = u.scale || "minPent", box = u.box != null ? u.box : null;
  const head = h(`<div class="row wrap">
    <select class="k">${NOTE_NAMES.map((n) => `<option ${n === key ? "selected" : ""}>${n}</option>`).join("")}</select>
    <select class="sc">${Object.entries(SCALES).map(([id, s]) => `<option value="${id}" ${id === scale ? "selected" : ""}>${s.name}</option>`).join("")}</select>
    <select class="bx"></select>
    <button class="btn small lab" aria-label="שמות תווים או דרגות">${S.settings.labels === "deg" ? "1-2-3" : "C-D-E"}</button>
  </div>`);
  c.appendChild(head);
  const fbWrap = h(`<div></div>`);
  c.appendChild(fbWrap);
  c.appendChild(h(`<p class="hint">עיגול כתום = השורש. ${metro.sub > 1 ? `${metro.sub} תווים לכל פעמה.` : "תו אחד לכל פעמה, עולים ויורדים."}</p>`));
  const play = h(`<button class="btn wide">${icon("speaker")}<span>השמיעו את הסולם</span></button>`);
  c.appendChild(play);
  const draw = () => {
    const sc = SCALES[scale];
    const bx = $(".bx", head);
    bx.hidden = !sc.boxes;
    bx.innerHTML = `<option value="">כל הצוואר</option>` + [0, 1, 2, 3, 4].map((i) => `<option value="${i}" ${box === i ? "selected" : ""}>תיבה ${i + 1}</option>`).join("");
    const marks = scaleMarks(key, scale, sc.boxes ? box : null);
    fbWrap.innerHTML = fretboardSVG({ marks });
    const first = marks.length && Math.min(...marks.map((m) => m.f));
    const sc2 = $(".fb-scroll", fbWrap);
    sc2.scrollLeft = Math.max(0, first * 46 - 40);
    $$(".mark", fbWrap).forEach((g) => (g.onclick = () => Sound.pluck(TUNING[+g.dataset.s] + +g.dataset.f)));
  };
  $(".k", head).onchange = (e) => { key = e.target.value; draw(); };
  $(".sc", head).onchange = (e) => { scale = e.target.value; draw(); };
  $(".bx", head).onchange = (e) => { box = e.target.value === "" ? null : +e.target.value; draw(); };
  $(".lab", head).onclick = (e) => { S.settings.labels = S.settings.labels === "deg" ? "name" : "deg"; save(); e.target.textContent = S.settings.labels === "deg" ? "1-2-3" : "C-D-E"; draw(); };
  play.onclick = () => {
    const sc = SCALES[scale];
    let notes;
    if (sc.boxes && box != null) {
      notes = [...new Set(scaleMarks(key, scale, box).map((m) => m.midi))].sort((a, b) => a - b);
    } else {
      const root = TUNING[0] + ((NOTE_NAMES.indexOf(key) - 4 + 12) % 12);
      notes = [];
      for (let o = 0; o < 2; o++) sc.steps.forEach((st) => notes.push(root + o * 12 + st));
      notes.push(root + 24);
    }
    const seq = notes.concat(notes.slice(0, -1).reverse());
    const t0 = Sound.context().currentTime + 0.05, dt = 60 / metro.bpm / metro.sub;
    seq.forEach((m, i) => Sound.pluck(m, t0 + i * dt, 0.45, dt * 1.6));
  };
  draw();
  let paint = () => {};
  metroControl(c, metro, { bpm: u.bpmNow || u.bpm || 70, onBpm: () => paint() });
  paint = cleanRecordButton(c, metro, "scale:" + scale);
  return { bpm: () => metro.bpm };
};

Acts.jam = (c, u, p) => {
  const metro = new Sound.Metronome();
  p.cleanup(() => metro.stop());
  let prog = PROGRESSIONS.find((x) => x.id === (u.prog || "pop"));
  let strumId = "folk";
  metro.sub = 2;
  metro.subClicks = false;
  metro.volume = 0.35;
  const head = h(`<div class="row wrap">
    <select class="pg">${PROGRESSIONS.map((x) => `<option value="${x.id}" ${x.id === prog.id ? "selected" : ""}>${x.name}</option>`).join("")}</select>
    <select class="st">${Object.entries(STRUMS).filter(([, s]) => s.sub === 2).map(([id, s]) => `<option value="${id}" ${id === strumId ? "selected" : ""}>${s.name}</option>`).join("")}</select>
  </div>`);
  c.appendChild(head);
  const stage = h(`<div class="jam-stage"><div class="now-chord" dir="ltr"></div><div class="next-chord"></div><div class="jam-bars" dir="ltr"></div></div>`);
  c.appendChild(stage);
  const tip = h(`<details class="how"><summary>מה לנגן בסולו?</summary><div class="tip-body"></div></details>`);
  c.appendChild(tip);
  const drawProg = () => {
    $(".jam-bars", stage).innerHTML = prog.chords.map((ch) => `<span>${chordName(ch).replace(/ \(.*\)/, "")}</span>`).join("");
    const [k, sc] = prog.scale;
    $(".tip-body", tip).innerHTML = `<p>סולם מתאים: <b dir="ltr">${k}</b> ${SCALES[sc].name}. הקישו על תו כדי לשמוע.</p>` + fretboardSVG({ marks: scaleMarks(k, sc, SCALES[sc].boxes ? 0 : null), frets: 15 });
    $$(".tip-body .mark", tip).forEach((g) => (g.onclick = () => Sound.pluck(TUNING[+g.dataset.s] + +g.dataset.f)));
    showChord(0);
  };
  const showChord = (i) => {
    const cur = prog.chords[i % prog.chords.length], nxt = prog.chords[(i + 1) % prog.chords.length];
    $(".now-chord", stage).innerHTML = chordCard(cur, "huge");
    $(".next-chord", stage).innerHTML = `<small>הבא</small> <b dir="ltr">${chordName(nxt)}</b>`;
    $$(".jam-bars span", stage).forEach((s, j) => s.classList.toggle("now", j === i % prog.chords.length));
  };
  $(".pg", head).onchange = (e) => { prog = PROGRESSIONS.find((x) => x.id === e.target.value); drawProg(); };
  $(".st", head).onchange = (e) => (strumId = e.target.value);
  metro.onSchedule = (info, t) => {
    const ch = prog.chords[info.bar % prog.chords.length];
    const k = STRUMS[strumId].slots[info.slot % 8];
    if (info.slot === 0) {
      const root = Sound.chordMidis(ch)[0];
      Sound.pluck(root - (root >= 52 ? 12 : 0), t, 0.5, 60 / metro.bpm * 3.6);
    }
    if (k === "D" || k === "U") Sound.strum(ch, t, k, 0.22, 60 / metro.bpm * 1.4);
  };
  metro.onTick = (info) => { if (info.slot === 0) showChord(info.bar); };
  drawProg();
  metroControl(c, metro, { bpm: u.bpmNow || u.bpm || 80 });
  return { bpm: () => metro.bpm };
};

Acts.free = (c, u, p) => {
  const box = h(`<div class="free-timer"><b>0:00</b><button class="btn">${icon("timer")}<span>טיימר</span></button></div>`);
  c.appendChild(box);
  let t = 0, iv = 0;
  $("button", box).onclick = (e) => {
    const btn = e.currentTarget;
    if (iv) { clearInterval(iv); iv = 0; btn.innerHTML = `${icon("timer")}<span>טיימר</span>`; return; }
    btn.innerHTML = `${icon("stop")}<span>עצירה</span>`;
    iv = setInterval(() => { t++; $("b", box).textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }, 1000);
  };
  p.cleanup(() => clearInterval(iv));
  if (/בנד|כיוון/.test(u.title)) {
    const go = h(`<button class="btn wide">${icon("tuner")}<span>פתחו את המכוון</span></button>`);
    go.onclick = () => openTunerPanel();
    c.appendChild(go);
  }
};

// Find the note: tap it on the neck, or play it into the microphone.
Acts.notes = (c, u, p) => {
  const strings = u.strings || [0, 1, 2, 3, 4, 5];
  const rkey = strings.join("");
  const box = h(`<div class="game">
    <div class="seg mode"><button data-m="tap" class="on">${icon("hand")}הקשה</button><button data-m="mic">${icon("mic")}נגינה</button></div>
    <div class="ch-stats"><div><small>זמן</small><b class="t">60</b></div><div><small>נכונות</small><b class="n">0</b></div><div><small>שיא</small><b class="best">${S.records.notes[rkey] || 0}</b></div></div>
    <div class="question">לחצו התחל</div>
    <div class="fbw"></div>
    <button class="tap-big">התחל</button>
  </div>`);
  c.appendChild(box);
  const q = $(".question", box), fbw = $(".fbw", box), go = $(".tap-big", box);
  let mode = "tap", target = null, n = 0, end = 0, iv = 0, running = false, stopMic = null, stable = { m: null, k: 0 };
  const draw = (marks = []) => {
    fbw.innerHTML = fretboardSVG({ frets: 12, hits: mode === "tap", marks, fit: true, fw: 38, sp: 34 });
    $$(".hit", fbw).forEach((r) => (r.onclick = () => answer(+r.dataset.s, +r.dataset.f)));
  };
  const nextQ = () => {
    let s, f, name;
    do { s = rand(strings); f = Math.floor(Math.random() * 13); name = Sound.noteName(TUNING[s] + f); } while (target && target.name === name && target.s === s);
    target = { s, f, name, midi: TUNING[s] + f };
    q.innerHTML = `מצאו <b dir="ltr">${name}</b> <span class="he-note">(${NOTE_HE[name]})</span> על מיתר <b dir="ltr">${STRING_NAMES[s]}</b>`;
    draw();
  };
  const flash = (ok, s, f) => {
    const pos = ok ? [{ s, f, cls: "ok", label: target.name }] : [{ s: target.s, f: target.f, cls: "ok", label: target.name }].concat(s != null ? [{ s, f, cls: "bad" }] : []);
    draw(pos);
  };
  const answer = (s, f, viaMic) => {
    if (!running) return;
    const ok = viaMic ? true : s === target.s && Sound.noteName(TUNING[s] + f) === target.name;
    if (ok) { n++; $(".n", box).textContent = n; if (!viaMic) Sound.pluck(TUNING[s] + f, 0, 0.5, 1); }
    flash(ok, viaMic ? target.s : s, viaMic ? target.f : f);
    running = false;
    setTimeout(() => { if (Date.now() < end) { running = true; nextQ(); } }, ok ? 450 : 1100);
  };
  const finish = () => {
    clearInterval(iv); running = false; go.hidden = false; go.textContent = "שוב";
    if (stopMic) { stopMic(); stopMic = null; }
    const isNew = record("notes", rkey, n);
    $(".best", box).textContent = S.records.notes[rkey] || 0;
    q.textContent = isNew && n ? `שיא חדש: ${n}` : `${n} נכונות`;
    if (isNew && n) toast(`שיא חדש: ${n} תווים בדקה`, "flame");
    keepAwake(false);
  };
  const onPitch = (r) => {
    if (!running || !r || r.clarity < 0.85) { stable.k = 0; return; }
    const m = Math.round(Sound.freqToMidi(r.freq));
    if (m === stable.m) stable.k++; else { stable.m = m; stable.k = 1; }
    if (stable.k >= 4 && Sound.noteName(m) === target.name) { stable.k = 0; answer(null, null, true); }
  };
  $$(".mode button", box).forEach((b) => (b.onclick = () => {
    if (running) return;
    mode = b.dataset.m;
    $$(".mode button", box).forEach((x) => x.classList.toggle("on", x === b));
    draw();
  }));
  go.onclick = async () => {
    if (mode === "mic") {
      try { await Sound.startMic(); stopMic = Sound.listen(onPitch); }
      catch (e) { toast("אין גישה למיקרופון. עוברים להקשה."); mode = "tap"; $$(".mode button", box).forEach((x) => x.classList.toggle("on", x.dataset.m === "tap")); }
    }
    n = 0; $(".n", box).textContent = 0; end = Date.now() + 60000; running = true; go.hidden = true;
    keepAwake(true);
    nextQ();
    iv = setInterval(() => { const left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); $(".t", box).textContent = left; if (left <= 0) finish(); }, 200);
  };
  p.cleanup(() => { clearInterval(iv); if (stopMic) stopMic(); keepAwake(false); });
  draw();
};

const INTERVALS = [
  [1, "חצי טון", "m2"], [2, "טון", "M2"], [3, "טרצה קטנה", "m3"], [4, "טרצה גדולה", "M3"], [5, "קוורטה", "P4"],
  [6, "טריטון", "TT"], [7, "קווינטה", "P5"], [8, "סקסטה קטנה", "m6"], [9, "סקסטה גדולה", "M6"], [10, "ספטימה קטנה", "m7"], [11, "ספטימה גדולה", "M7"], [12, "אוקטבה", "P8"],
];
const CHORD_Q = [["maj", "מז'ור", [0, 4, 7, 12]], ["min", "מינור", [0, 3, 7, 12]], ["dom7", "7 (דומיננט)", [0, 4, 7, 10]], ["maj7", "maj7", [0, 4, 7, 11]], ["m7", "m7", [0, 3, 7, 10]]];

Acts.ear = (c, u, p) => {
  let mode = u.mode || "intervals";
  let level = 0;
  const sets = { intervals: [[4, 7, 12], [3, 4, 5, 7, 12], [2, 3, 4, 5, 7, 9, 12], INTERVALS.map((x) => x[0])], chords: [["maj", "min"], ["maj", "min", "dom7"], CHORD_Q.map((x) => x[0])] };
  const box = h(`<div class="game">
    <div class="seg mode"><button data-m="intervals">מרווחים</button><button data-m="chords">אקורדים</button></div>
    <div class="seg lvl"></div>
    <div class="ch-stats"><div><small>רצף</small><b class="n">0</b></div><div><small>שיא רצף</small><b class="best">0</b></div></div>
    <button class="tap-big">${icon("speaker")}<span>השמיעו</span></button>
    <div class="answers"></div>
  </div>`);
  c.appendChild(box);
  let q = null, streakN = 0, answered = false;
  const paint = () => {
    $$(".mode button", box).forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
    const lv = sets[mode];
    level = Math.min(level, lv.length - 1);
    $(".lvl", box).innerHTML = lv.map((_, i) => `<button data-l="${i}" class="${i === level ? "on" : ""}">רמה ${i + 1}</button>`).join("");
    $$(".lvl button", box).forEach((b) => (b.onclick = () => { level = +b.dataset.l; streakN = 0; $(".n", box).textContent = 0; paint(); newQ(); }));
    $(".best", box).textContent = S.records.ear[mode] || 0;
    const opts = mode === "intervals" ? INTERVALS.filter((x) => lv[level].includes(x[0])).map((x) => [x[0], x[1]]) : CHORD_Q.filter((x) => lv[level].includes(x[0])).map((x) => [x[0], x[1]]);
    $(".answers", box).innerHTML = opts.map(([v, name]) => `<button class="btn ans" data-v="${v}">${name}</button>`).join("");
    $$(".ans", box).forEach((b) => (b.onclick = () => pick(b)));
  };
  const playQ = () => {
    const t = Sound.context().currentTime + 0.05;
    if (mode === "intervals") { Sound.pluck(q.root, t, 0.5, 1.2); Sound.pluck(q.root + q.v, t + 0.8, 0.5, 1.4); }
    else CHORD_Q.find((x) => x[0] === q.v)[2].forEach((st, i) => Sound.pluck(q.root + st, t + i * 0.03, 0.35, 2));
  };
  const newQ = () => {
    const opts = sets[mode][level];
    q = { v: rand(opts), root: 45 + Math.floor(Math.random() * 12) };
    answered = false;
    $$(".ans", box).forEach((b) => b.classList.remove("ok", "bad"));
    playQ();
  };
  const pick = (b) => {
    if (!q || answered) { if (!q) newQ(); return; }
    const v = mode === "intervals" ? +b.dataset.v : b.dataset.v;
    answered = true;
    if (v === q.v) {
      b.classList.add("ok"); streakN++;
      if (record("ear", mode, streakN)) $(".best", box).textContent = streakN;
    } else {
      b.classList.add("bad"); streakN = 0;
      $$(".ans", box).forEach((x) => { if (String(x.dataset.v) === String(q.v)) x.classList.add("ok"); });
      playQ();
    }
    $(".n", box).textContent = streakN;
    setTimeout(newQ, v === q.v ? 700 : 1900);
  };
  $(".tap-big", box).onclick = () => (q ? playQ() : newQ());
  $$(".mode button", box).forEach((b) => (b.onclick = () => { mode = b.dataset.m; level = 0; streakN = 0; $(".n", box).textContent = 0; q = null; paint(); }));
  paint();
};

// Opens one unit or exercise as a panel. done(rating) is set by the session player.
function openUnit(u, { inSession = false, onRate = null, title } = {}) {
  return openPanel(title || u.title, (body, p) => {
    body.insertAdjacentHTML("beforeend", stepsHTML(Object.assign({ openHow: !inSession }, u)));
    const actEl = h(`<div class="act"></div>`);
    body.appendChild(actEl);
    const keyB = bpmKey(u);
    const uu = Object.assign({}, u, { bpmNow: S.bpm[keyB] || u.bpm });
    const api = (Acts[u.kind] || Acts.free)(actEl, uu, p) || {};
    p.api = api;
    if (inSession) return;
    if (u.id && unitById(u.id)) {
      const foot = h(`<div class="unit-foot"></div>`);
      body.appendChild(foot);
      const paint = () => {
        const met = goalMet(u);
        if (met && !S.done[u.id]) { S.done[u.id] = today(); save(); toast("עמדתם ביעד · השלב הבא נפתח", "trophy"); }
        foot.innerHTML = S.done[u.id] ? `<p class="done-badge">${icon("check")}<span>השלב הושלם</span></p><button class="link undo">סמנו כלא הושלם</button>` : u.check === "self" ? `<button class="cta mark">${icon("check")}<span>עמדתי ביעד</span></button>` : `<p class="hint">היעד נבדק לבד כשתשברו את השיא.</p><button class="link mark">סמנו כהושלם בכל זאת</button>`;
        const m = $(".mark", foot);
        if (m) m.onclick = () => { S.done[u.id] = today(); if (api.bpm) S.bpm[keyB] = api.bpm(); save(); toast("כל הכבוד", "trophy"); paint(); renderAll(); };
        const un = $(".undo", foot);
        if (un) un.onclick = () => { delete S.done[u.id]; save(); paint(); renderAll(); };
      };
      paint();
      p.cleanup(() => { if (api.bpm) { S.bpm[keyB] = api.bpm(); save(); } paint(); });
      const iv = setInterval(paint, 2500);
      p.cleanup(() => clearInterval(iv));
    } else {
      p.cleanup(() => { if (api.bpm) { S.bpm[keyB] = api.bpm(); save(); } });
    }
  }, { onClose: () => renderAll() });
}
const bpmKey = (u) => (u.id ? "u:" + u.id : u.key || u.kind);

// ---------- Daily session ----------
function unlockedUnits() {
  const cur = currentLevel().id;
  return PATH.filter((l) => l.id <= cur).flatMap((l) => l.units);
}

function buildSession(minutes) {
  const lvl = currentLevel();
  const undone = lvl.units.filter((u) => !S.done[u.id]);
  const blocks = [];
  if (lvl.id >= 3) blocks.push({ kind: "spider", key: "spider", title: "חימום: עכביש כרומטי", bpm: 60, minutes: 2, sub: lvl.id >= 7 ? 2 : 1, how: PATH[2].units[0].how });
  else blocks.push({ kind: "strum", key: "warm", title: "חימום: פריטה ב-Em", strum: "quarters", chord: "Em", bpm: 60, minutes: 2, how: ["פריטה רגועה למטה בכל פעמה.", "בודקים שכל המיתרים נשמעים נקי.", "כתפיים רפויות, נושמים."] });
  const focus = undone.slice(0, minutes >= 25 ? 2 : 1);
  focus.forEach((u) => blocks.push(Object.assign({}, u, { minutes: u.minutes + 1, focus: true })));
  const unl = unlockedUnits();
  const pairs = unl.filter((u) => u.kind === "changes").map((u) => u.pair);
  if (minutes >= 15 && pairs.length) {
    const pair = pairs.sort((a, b) => (S.records.changes[a.join("-")] || 0) - (S.records.changes[b.join("-")] || 0))[0];
    if (!focus.some((f) => f.kind === "changes" && f.pair.join() === pair.join())) blocks.push({ kind: "changes", key: "chg", title: "החלפות בדקה", pair, minutes: 1.5, how: ["דקה אחת. מחליפים כמה שיותר מהר, הקישו על הכפתור בכל החלפה."] });
  }
  const review = unl.filter((u) => S.done[u.id] && ["chords", "strum", "scale", "notes", "ear"].includes(u.kind));
  if (minutes >= 20 && review.length) {
    const r = rand(review);
    blocks.push(Object.assign({}, r, { title: "חזרה: " + r.title, minutes: 3 }));
  }
  const jams = unl.filter((u) => u.kind === "jam");
  const jam = jams.length ? jams[jams.length - 1] : { prog: "pop", bpm: 70 };
  if (!focus.some((f) => f.kind === "jam")) blocks.push({ kind: "jam", key: "jam", title: "סיום: מנגנים שיר", prog: jam.prog, bpm: jam.bpm, minutes: 4, how: ["נהנים! מנגנים עם האפליקציה בלי לעצור, גם אם יש טעויות.", "אם אתם ברמת סולו, אלתרו מעל עם הסולם המוצע."] });
  const total = blocks.reduce((a, b) => a + b.minutes, 0);
  const f = minutes / total;
  blocks.forEach((b) => (b.minutes = b.kind === "changes" ? b.minutes : Math.max(1, Math.round(b.minutes * f * 2) / 2)));
  return blocks;
}

function startSession(minutes, planned) {
  const blocks = planned || buildSession(minutes);
  let i = 0;
  const startedAt = Date.now();
  keepAwake(true);
  const runBlock = () => {
    const b = blocks[i];
    const tempo = ["chords", "strum", "scale", "spider", "jam"].includes(b.kind);
    const p = openUnit(b, { inSession: true, title: "האימון היומי" });
    const total = b.minutes * 60;
    const bar = h(`<div class="session-bar">
      <div class="prog">${blocks.map((_, j) => `<i class="${j < i ? "done" : j === i ? "now" : ""}"></i>`).join("")}</div>
      <div class="sb-row">
        <div class="sb-clock">${ring(0.01, { size: 64, stroke: 5, cls: "sb-ring" })}<b>${fmt(total)}</b></div>
        <div class="sb-info"><small>${b.focus ? "המשימה של היום" : `תרגיל ${i + 1} מתוך ${blocks.length}`}</small><b>${b.title}</b></div>
        <button class="cta small next">${i === blocks.length - 1 ? "סיום" : "הבא"}</button>
      </div>
      ${b.focus ? `<label class="toggle-row goal-check"><span>עמדתי ביעד<small>${b.goal}</small></span><input type="checkbox" class="toggle"></label>` : ""}
      <div class="rate" hidden><p>איך היה הקצב?</p><div class="rate-opts"><button data-r="-5"><b>קשה</b><small>‎−5 BPM</small></button><button data-r="2"><b>בדיוק</b><small>‎+2 BPM</small></button><button data-r="5"><b>קל מדי</b><small>‎+5 BPM</small></button></div></div>
    </div>`);
    p.body.prepend(bar);
    const ringFill = $(".sb-ring .ring-fill", bar);
    let left = total;
    const iv = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      left--;
      $(".sb-clock b", bar).textContent = fmt(Math.max(0, left));
      ringFill.style.setProperty("--p", 100 - clamp(((total - left) / total) * 100, 0, 100));
      if (left === 0) { bar.classList.add("timeup"); chime(); haptic(30); }
    }, 1000);
    p.cleanup(() => clearInterval(iv));
    let advancing = false;
    p.onClose = () => { if (!advancing) { keepAwake(false); renderAll(); } };
    const goalBox = $(".goal-check input", bar);
    const autoGoal = () => { if (goalBox && goalMet(b)) goalBox.checked = true; };
    const gi = setInterval(autoGoal, 1500);
    p.cleanup(() => clearInterval(gi));
    const go = () => {
      advancing = true;
      autoGoal();
      if (goalBox && goalBox.checked && !S.done[b.id]) { S.done[b.id] = today(); save(); toast("שלב הושלם"); }
      p.close();
      i++;
      if (i < blocks.length) setTimeout(runBlock, 320);
      else setTimeout(() => finishSession(Math.round((Date.now() - startedAt) / 60000)), 320);
    };
    $(".next", bar).onclick = () => {
      if (tempo && $(".rate", bar).hidden) { $(".rate", bar).hidden = false; $(".next", bar).hidden = true; return; }
      go();
    };
    $$(".rate button", bar).forEach((r) => (r.onclick = () => {
      const k = bpmKey(b);
      const cur = (p.api && p.api.bpm && p.api.bpm()) || S.bpm[k] || b.bpm;
      S.bpm[k] = clamp(cur + +r.dataset.r, 40, 220);
      save();
      go();
    }));
  };
  runBlock();
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function chime() {
  const t = Sound.context().currentTime;
  [76, 79, 84].forEach((m, i) => Sound.pluck(m, t + i * 0.12, 0.4, 1.2));
}

function finishSession(mins) {
  S.sessions = (S.sessions || 0) + 1;
  save();
  keepAwake(false);
  const st = streak();
  const goalPct = clamp((minutesOn(today()) / S.goalMin) * 100, 0, 100);
  openPanel("כל הכבוד", (body) => {
    body.innerHTML = `<div class="finish">
      <div class="burst" aria-hidden="true">${Array.from({ length: 18 }, (_, k) => `<i style="--a:${k * 20}deg;--d:${0.4 + (k % 4) * 0.12}s"></i>`).join("")}</div>
      ${ring(goalPct, { size: 150, stroke: 12, cls: "big-ring", label: `${minutesOn(today())}` })}
      <p class="eyebrow">דקות היום מתוך ${S.goalMin}</p>
      <h3 class="display">אימון הושלם</h3>
      <div class="stat-row"><div><b>${Math.max(1, mins)}</b><small>דקות באימון</small></div><div><b>${st}</b><small>ימים ברצף</small></div><div><b>${S.sessions}</b><small>אימונים</small></div></div>
      <p class="muted">המטרונום כבר מכוון לאימון הבא לפי מה שסימנתם.</p>
      <button class="cta close">סיום</button></div>`;
    $(".close", body).onclick = () => history.back();
    chime();
    haptic([20, 60, 20]);
  }, { onClose: () => renderAll(), cls: "celebrate" });
}

// ---------- Views ----------
const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
function greeting() {
  const hr = new Date().getHours();
  return hr < 5 ? "לילה טוב" : hr < 12 ? "בוקר טוב" : hr < 17 ? "צהריים טובים" : hr < 21 ? "ערב טוב" : "לילה טוב";
}
const dateLine = () => { const d = new Date(); return `יום ${HE_DAYS[d.getDay()]}, ${d.getDate()} ב${HE_MONTHS[d.getMonth()]}`; };
function heroChord(u) {
  if (!u) return "G";
  return (u.chords && u.chords[0]) || u.chord || (u.pair && u.pair[0]) || (u.prog && PROGRESSIONS.find((x) => x.id === u.prog).chords[0]) || "G";
}
const chordNotes = (id) => (i) => { const f = CHORDS[id].frets[i]; return f < 0 ? null : TUNING[i] + f; };
const KIND_ICON = { chords: "chords", changes: "loop", strum: "strum", scale: "scale", spider: "speed", notes: "notes", ear: "ear", jam: "jam", free: "hand" };
const SHORT = { spider: "חימום", strum: "פריטה", chords: "אקורדים", changes: "החלפות", scale: "סולם", jam: "שיר", notes: "תווים", ear: "אוזן", free: "טכניקה" };

let homePad = null, homePlan = null;
function renderHome() {
  const v = $("#v-home");
  if (homePad) { homePad.destroy(); homePad = null; }
  const lvl = currentLevel();
  const doneN = lvl.units.filter((u) => S.done[u.id]).length;
  const next = lvl.units.find((u) => !S.done[u.id]);
  const chord = heroChord(next);
  const st = streak();
  homePlan = buildSession(S.goalMin);
  const todayMin = minutesOn(today());
  v.innerHTML = `
    <header class="lt">
      <div><p class="eyebrow">${dateLine()}</p><h1 data-title>${greeting()}</h1></div>
      <div class="streak ${st ? "on" : ""}" aria-label="${st} ימים ברצף">${icon("flame")}<b>${st}</b></div>
    </header>
    <section class="stage">
      <div class="stage-top">
        <div><p class="eyebrow">רמה ${lvl.id} · ${lvl.name}</p><h2>${next ? next.title : "סיימתם את המסלול"}</h2></div>
        ${ring((doneN / lvl.units.length) * 100, { size: 54, label: `${doneN}/${lvl.units.length}` })}
      </div>
      <canvas class="strings" aria-label="מיתרים לפריטה"></canvas>
      <p class="stage-hint">${icon("hand")}<span>החליקו על המיתרים · האקורד <b dir="ltr">${chordName(chord)}</b></span></p>
    </section>
    <section class="today">
      <div class="plan">${homePlan.map((b) => `<span>${icon(KIND_ICON[b.kind])}${SHORT[b.kind]}<small>${b.minutes}′</small></span>`).join("")}</div>
      <div class="seg dur" role="radiogroup" aria-label="אורך האימון">${[10, 20, 30, 45].map((m) => `<button role="radio" aria-checked="${m === S.goalMin}" data-m="${m}" class="${m === S.goalMin ? "on" : ""}">${m} דק'</button>`).join("")}</div>
      <button class="cta start">${icon("play")}<span>התחילו אימון</span></button>
      <p class="today-sub">${todayMin ? `${todayMin} מתוך ${S.goalMin} דקות היום` : "עוד לא ניגנתם היום"}</p>
    </section>
    <section class="group">
      <h3 class="sec">השבוע</h3>
      <div class="week">${lastDays(7).map((d) => `<div class="day ${d === today() ? "is-today" : ""}">${ring((minutesOn(d) / S.goalMin) * 100, { size: 36, stroke: 4 })}<small>${dayName(d)}</small></div>`).join("")}</div>
    </section>
    <section class="group">
      <h3 class="sec">כלים</h3>
      <div class="tiles">
        ${[["tuner", "tuner", "מכוון"], ["metro", "metro", "מטרונום"], ["jam", "jam", "ג'אם"], ["notes", "notes", "תווים"]].map(([go, ic, name]) => `<button class="tile" data-go="${go}"><span class="sq">${icon(ic)}</span><b>${name}</b></button>`).join("")}
      </div>
    </section>
    <section class="group">
      <h3 class="sec">השיאים שלכם</h3>
      ${recordsHTML()}
    </section>
    <p class="small-print">ההתקדמות נשמרת רק במכשיר הזה · <button class="link reset">איפוס</button></p>`;
  homePad = StringsPad($(".stage .strings", v), { notes: chordNotes(chord), height: 150, onStrum: () => $(".stage", v).classList.add("strummed") });
  $(".start", v).onclick = () => startSession(S.goalMin, homePlan);
  $$(".dur button", v).forEach((b) => (b.onclick = () => { S.goalMin = +b.dataset.m; save(); renderHome(); }));
  $$(".tile", v).forEach((b) => (b.onclick = () => quick(b.dataset.go)));
  $(".reset", v).onclick = () => { if (confirm("למחוק את כל ההתקדמות? אי אפשר לבטל את זה.")) { S = blank(); save(); location.reload(); } };
}
function recordsHTML() {
  const r = S.records;
  const rows = [];
  Object.entries(r.changes).forEach(([k, v]) => rows.push([v, "החלפות בדקה", k.split("-").map(chordName).join(" ↔ "), "loop"]));
  if (r.bpm.spider) rows.push([r.bpm.spider, "BPM", "עכביש כרומטי", "speed"]);
  Object.entries(r.bpm).filter(([k]) => k.startsWith("scale:")).forEach(([k, v]) => rows.push([v, "BPM", SCALES[k.slice(6)].name, "scale"]));
  Object.entries(r.notes).forEach(([k, v]) => rows.push([v, "תווים בדקה", k.length === 6 ? "כל המיתרים" : "מיתרים " + [...k].map((s) => STRING_NAMES[s]).join(", "), "notes"]));
  Object.entries(r.ear).forEach(([k, v]) => rows.push([v, "ברצף", k === "chords" ? "אוזן: אקורדים" : "אוזן: מרווחים", "ear"]));
  if (!rows.length) return `<div class="empty">${icon("trophy")}<p><b>השיאים יופיעו כאן</b><small>כל אימון שובר אחד. נתחיל?</small></p></div>`;
  return `<div class="rec-scroll">${rows.map(([n, unit, what, ic]) => `<div class="rcard">${icon(ic)}<b class="num">${n}</b><small>${unit}</small><span dir="auto">${what}</span></div>`).join("")}</div>`;
}
function lastDays(n) {
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) { out.push(d.toLocaleDateString("sv")); d.setDate(d.getDate() + 1); }
  return out;
}
const dayName = (k) => ["א", "ב", "ג", "ד", "ה", "ו", "ש"][new Date(k + "T12:00").getDay()];

function quick(go) {
  if (go === "tuner") { toolTab = "tuner"; nav("tools"); }
  else if (go === "metro") { toolTab = "metro"; nav("tools"); }
  else if (go === "jam") openUnit({ kind: "jam", key: "jam", title: "ג'אם", prog: "pop", bpm: 80 });
  else if (go === "notes") openUnit({ kind: "notes", title: "מצאו את התו", strings: [0, 1, 2, 3, 4, 5] });
}

const openLevels = new Set();
function renderPath() {
  const v = $("#v-path");
  const cur = currentLevel().id;
  if (!openLevels.size) openLevels.add(cur);
  const total = PATH.reduce((a, l) => a + l.units.length, 0);
  const done = PATH.reduce((a, l) => a + l.units.filter((u) => S.done[u.id]).length, 0);
  v.innerHTML = `<header class="lt"><div><p class="eyebrow">${done} מתוך ${total} שלבים</p><h1 data-title>המסלול</h1></div></header>
    <div class="journey">${PATH.map((l) => {
      const n = l.units.filter((u) => S.done[u.id]).length;
      const state = n === l.units.length ? "done" : l.id === cur ? "cur" : l.id < cur ? "done" : "lock";
      const node = state === "done" ? `<span class="node">${icon("check")}</span>` : state === "lock" ? `<span class="node">${icon("lock")}</span>` : ring((n / l.units.length) * 100, { size: 44, stroke: 4, cls: "node-ring", label: l.id });
      return `<section class="lv ${state} ${openLevels.has(l.id) ? "open" : ""}" data-l="${l.id}">
        <button class="lv-head" aria-expanded="${openLevels.has(l.id)}">${node}<div><small>רמה ${l.id}${state === "cur" ? " · אתם כאן" : ""}</small><h3>${l.name}</h3><p>${l.goal}</p></div>${icon("chevron", "chev")}</button>
        <div class="lv-units"><div>${l.units.map((u) => `<button class="unit ${S.done[u.id] ? "done" : ""}" data-u="${u.id}"><span class="sq">${icon(KIND_ICON[u.kind])}</span><span class="u-txt"><b>${u.title}</b><small>${u.goal}</small></span>${S.done[u.id] ? icon("check", "u-state ok") : icon("chevron", "u-state")}</button>`).join("")}</div></div>
      </section>`;
    }).join("")}</div>`;
  $$(".lv-head", v).forEach((b) => (b.onclick = () => {
    const sec = b.closest(".lv"), id = +sec.dataset.l;
    sec.classList.toggle("open");
    b.setAttribute("aria-expanded", sec.classList.contains("open"));
    sec.classList.contains("open") ? openLevels.add(id) : openLevels.delete(id);
  }));
  $$(".unit", v).forEach((b) => (b.onclick = () => openUnit(unitById(b.dataset.u).unit)));
}

let chordCat = "open";
function renderChords() {
  const v = $("#v-chords");
  const ids = Object.keys(CHORDS).filter((id) => CHORDS[id].cat === chordCat);
  v.innerHTML = `<header class="lt"><div><p class="eyebrow">${Object.keys(CHORDS).length} אקורדים · הקישו כדי לנגן</p><h1 data-title>אקורדים</h1></div></header>
    <div class="chips" role="tablist">${CHORD_CATS.map(([id, name]) => `<button role="tab" aria-selected="${id === chordCat}" data-c="${id}" class="${id === chordCat ? "on" : ""}">${name}</button>`).join("")}</div>
    <div class="chord-grid">${ids.map((id) => chordCard(id)).join("")}</div>
    <section class="card trainer-card">
      <div class="tc-head"><span class="sq">${icon("loop")}</span><div><h3>החלפות בדקה</h3><p class="muted">הדרך הכי מהירה ללמוד מעבר: דקה אחת, שני אקורדים, סופרים.</p></div></div>
      <div class="pair" dir="ltr"><select class="ca" aria-label="אקורד ראשון">${chordOptions("C")}</select><span>${icon("loop")}</span><select class="cb" aria-label="אקורד שני">${chordOptions("G")}</select></div>
      <button class="cta go">${icon("play")}<span>התחילו דקה</span></button>
    </section>`;
  $$(".chips button", v).forEach((b) => (b.onclick = () => { chordCat = b.dataset.c; renderChords(); }));
  $$(".chord-grid .chord-card", v).forEach((el) => (el.onclick = () => openChord(el.dataset.chord)));
  $(".go", v).onclick = () => {
    const a = $(".ca", v).value, b = $(".cb", v).value;
    if (a === b) return toast("בחרו שני אקורדים שונים", "chords");
    openUnit({ kind: "changes", title: `${chordName(a)} ↔ ${chordName(b)}`, pair: [a, b] });
  };
}
const chordOptions = (sel) => Object.keys(CHORDS).map((id) => `<option value="${id}" ${id === sel ? "selected" : ""}>${chordName(id)}</option>`).join("");

function openChord(id) {
  Sound.strum(id);
  openPanel(chordName(id), (body, p) => {
    const notes = [...new Set(Sound.chordMidis(id).map((m) => Sound.noteName(m)))];
    body.innerHTML = `<div class="chord-detail">
      <div class="cd-top">${chordSVG(id)}<div class="cd-info"><p class="eyebrow">תווים</p><p class="cd-notes" dir="ltr">${notes.join(" · ")}</p><p class="muted small">1 מורה · 2 אמה · 3 קמיצה · 4 זרת<br>× לא מנגנים · ○ מיתר פתוח</p></div></div>
      <div class="stage mini"><canvas class="strings"></canvas><p class="stage-hint">${icon("hand")}<span>פרטו בעצמכם</span></p></div>
      <div class="btn-row"><button class="cta s">${icon("speaker")}<span>פריטה</span></button><button class="btn a">${icon("strum")}<span>ארפג'ו</span></button></div>
      <button class="btn wide chg">${icon("loop")}<span>תרגלו החלפות עם האקורד הזה</span></button></div>`;
    const pad = StringsPad($(".strings", body), { notes: chordNotes(id), height: 132 });
    p.cleanup(() => pad.destroy());
    $(".s", body).onclick = () => pad.strum("D");
    $(".a", body).onclick = () => [0, 1, 2, 3, 4, 5].forEach((i, k) => setTimeout(() => { if (CHORDS[id].frets[i] >= 0) Sound.pluck(TUNING[i] + CHORDS[id].frets[i], 0, 0.5, 1.5); }, k * 320));
    $(".chg", body).onclick = () => {
      const other = id === "G" ? "C" : "G";
      history.back();
      setTimeout(() => openUnit({ kind: "changes", title: `${chordName(id)} ↔ ${chordName(other)}`, pair: [id, other] }), 380);
    };
  }, { sheet: true });
}

function renderTrain() {
  const v = $("#v-train");
  const r = S.records;
  const bestOf = (o) => Math.max(0, ...Object.values(o));
  const items = [
    ["notes", "notes", "מצאו את התו", "הקישו על התו בצוואר או נגנו אותו למיקרופון.", bestOf(r.notes) ? `שיא ${bestOf(r.notes)} בדקה` : "משחק של דקה"],
    ["ear", "ear", "אימון אוזן", "מרווחים ואקורדים בשמיעה.", bestOf(r.ear) ? `רצף ${bestOf(r.ear)}` : "7 רמות"],
    ["scale", "scale", "סולמות", "8 סולמות, כל מפתח, 5 תיבות.", "על כל הצוואר"],
    ["jam", "jam", "ג'אם", "האפליקציה מלווה, אתם מנגנים.", "7 מהלכים"],
    ["spider", "speed", "מאמן מהירות", "מטרונום שעולה לבד.", r.bpm.spider ? `${r.bpm.spider} BPM` : "עכביש כרומטי"],
    ["strum", "strum", "קצבי פריטה", "מרבעים ועד פאנק.", "7 קצבים"],
  ];
  v.innerHTML = `<header class="lt"><div><p class="eyebrow">אימונים ממוקדים</p><h1 data-title>אימונים</h1></div></header>
    <div class="bento">${items.map(([k, ic, t, d, stat], i) => `<button class="bt ${i === 0 ? "wide" : ""}" data-k="${k}">
      <span class="sq">${icon(ic)}</span>${i === 0 ? `<span class="bt-art" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(() => "<i></i>").join("")}<em style="--x:28%;--y:2"></em><em style="--x:58%;--y:4" class="r"></em></span>` : ""}
      <b>${t}</b><small>${d}</small><span class="stat">${stat}</span></button>`).join("")}</div>`;
  $$(".bt", v).forEach((b) => (b.onclick = () => openTrainer(b.dataset.k)));
}
function openTrainer(k) {
  if (k === "notes") openUnit({ kind: "notes", title: "מצאו את התו", strings: [0, 1, 2, 3, 4, 5] });
  else if (k === "ear") openUnit({ kind: "ear", title: "אימון אוזן" });
  else if (k === "scale") openUnit({ kind: "scale", key: "scale", title: "סולמות", scale: "minPent", box: 0, bpm: 70 });
  else if (k === "jam") openUnit({ kind: "jam", key: "jam", title: "ג'אם", prog: "pop", bpm: 80 });
  else if (k === "spider") openUnit({ kind: "spider", key: "spider", title: "מאמן מהירות", bpm: 60, how: PATH[2].units[0].how });
  else if (k === "strum") {
    openPanel("קצבי פריטה", (body) => {
      body.innerHTML = `<div class="list-group">${Object.entries(STRUMS).map(([id, s]) => `<button class="lg-row nav" data-s="${id}"><span class="lg-main"><b>${s.name}</b><small class="arrows" dir="ltr">${[...s.slots].map((x) => (x === "D" ? "↓" : x === "U" ? "↑" : "·")).join(" ")}</small></span>${icon("chevron", "u-state")}</button>`).join("")}</div>`;
      $$("[data-s]", body).forEach((b) => (b.onclick = () => openUnit({ kind: "strum", key: "strum:" + b.dataset.s, title: STRUMS[b.dataset.s].name, strum: b.dataset.s, chord: b.dataset.s === "funk" ? "Am7" : "G", bpm: 70 })));
    });
  }
}

// ---------- Tools: tuner and metronome ----------
let toolTab = "tuner";
const toolsMetro = new Sound.Metronome();
let tunerStop = null;

function setToolTab(t) { toolTab = t; renderTools(); }

function renderTools() {
  const v = $("#v-tools");
  if (tunerStop) { tunerStop(); tunerStop = null; }
  v.innerHTML = `<header class="lt"><div><p class="eyebrow">${toolTab === "tuner" ? "כוונו לפני כל אימון" : "הקצב הוא הכול"}</p><h1 data-title>${toolTab === "tuner" ? "מכוון" : "מטרונום"}</h1></div></header>
    <div class="seg tooltabs" role="tablist"><button role="tab" data-t="tuner" class="${toolTab === "tuner" ? "on" : ""}">${icon("tuner")}מכוון</button><button role="tab" data-t="metro" class="${toolTab === "metro" ? "on" : ""}">${icon("metro")}מטרונום</button></div>
    <div class="tool-body"></div>`;
  $$(".tooltabs button", v).forEach((b) => (b.onclick = () => setToolTab(b.dataset.t)));
  const body = $(".tool-body", v);
  if (toolTab === "tuner") buildTuner(body, (stop) => (tunerStop = stop));
  else buildMetronome(body);
}

function openTunerPanel() {
  openPanel("מכוון", (body, p) => buildTuner(body, (stop) => p.cleanup(stop)));
}

function buildTuner(body, registerStop) {
  const tun = TUNINGS[S.settings.tuning] || TUNINGS.standard;
  let stop = null;
  const W = 300, c = 150, R = 124;
  const pt = (deg, r) => [c + r * Math.sin((deg * Math.PI) / 180), 160 - r * Math.cos((deg * Math.PI) / 180)];
  let ticks = "";
  for (let k = -50; k <= 50; k += 5) {
    const a = (k / 50) * 60, major = k % 25 === 0;
    const [x0, y0] = pt(a, R), [x1, y1] = pt(a, R - (major ? 16 : 9));
    ticks += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="${k === 0 ? "zero" : major ? "maj" : ""}"/>`;
  }
  const peg = (i) => `<button class="peg" data-i="${i}" aria-label="מיתר ${Sound.noteName(tun.notes[i])}"><b>${Sound.noteName(tun.notes[i])}</b><small>${Sound.octave(tun.notes[i])}</small></button>`;
  body.innerHTML = `<div class="tuner">
    <div class="t-display">
      <svg viewBox="0 0 ${W} 178" dir="ltr" aria-hidden="true">
        <defs><linearGradient id="tz" x1="0" x2="1"><stop offset="0" stop-color="#ff6b5b" stop-opacity=".0"/><stop offset=".42" stop-color="#ffb547" stop-opacity=".5"/><stop offset=".5" stop-color="#5be39a"/><stop offset=".58" stop-color="#ffb547" stop-opacity=".5"/><stop offset="1" stop-color="#ff6b5b" stop-opacity="0"/></linearGradient></defs>
        <path d="M${pt(-60, R + 10).join(" ")} A${R + 10} ${R + 10} 0 0 1 ${pt(60, R + 10).join(" ")}" class="zone" stroke="url(#tz)"/>
        <g class="ticks">${ticks}</g>
        <g class="needle"><line x1="${c}" y1="160" x2="${c}" y2="${160 - R + 4}"/><circle cx="${c}" cy="${160 - R + 4}" r="5"/></g>
      </svg>
      <div class="t-read"><b class="t-note">—</b><span class="t-cents">נגנו מיתר אחד</span></div>
    </div>
    <div class="headstock" dir="ltr">
      <div class="pegs">${peg(2)}${peg(1)}${peg(0)}</div>
      <div class="hs"><span>${icon("practice")}</span></div>
      <div class="pegs">${peg(3)}${peg(4)}${peg(5)}</div>
    </div>
    <label class="pill-select">${icon("tuner")}<select class="tuning" aria-label="כיוון">${Object.entries(TUNINGS).map(([id, t]) => `<option value="${id}" ${id === S.settings.tuning ? "selected" : ""}>${t.name}</option>`).join("")}</select></label>
    <button class="cta mic">${icon("mic")}<span>הפעילו מיקרופון</span></button>
    <p class="hint tstatus">הקישו על יתד כדי לשמוע את הצליל הנכון.</p>
  </div>`;
  $(".tuning", body).onchange = (e) => { if (stop) { stop(); stop = null; } S.settings.tuning = e.target.value; save(); buildTuner(body, registerStop); };
  $$(".peg", body).forEach((b) => (b.onclick = () => Sound.pluck(tun.notes[+b.dataset.i], 0, 0.6, 2.5)));
  const needle = $(".needle", body), noteEl = $(".t-note", body), centsEl = $(".t-cents", body), disp = $(".t-display", body);
  let hist = [], lastSeen = 0, inSince = 0;
  const onPitch = (r) => {
    if (!r || r.clarity < 0.8 || r.freq < 60 || r.freq > 1100) {
      if (Date.now() - lastSeen > 1200) disp.classList.remove("in", "near", "live");
      return;
    }
    lastSeen = Date.now();
    disp.classList.add("live");
    hist.push(r.freq);
    if (hist.length > 7) hist.shift();
    const f = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];
    const midi = Sound.freqToMidi(f);
    let si = -1, best = 99;
    tun.notes.forEach((m, i) => { const d = Math.abs(midi - m); if (d < best) { best = d; si = i; } });
    const targetMidi = best < 2.5 ? tun.notes[si] : Math.round(midi);
    const cents = clamp(Math.round((midi - targetMidi) * 100), -50, 50);
    noteEl.textContent = Sound.noteName(targetMidi);
    const inTune = Math.abs(cents) <= 4;
    centsEl.textContent = inTune ? "מכוון" : cents < 0 ? `נמוך ב-${-cents} סנט · הדקו` : `גבוה ב-${cents} סנט · שחררו`;
    needle.style.transform = `rotate(${(cents / 50) * 60}deg)`;
    disp.classList.toggle("in", inTune);
    disp.classList.toggle("near", !inTune && Math.abs(cents) <= 15);
    $$(".peg", body).forEach((b) => b.classList.toggle("now", best < 2.5 && +b.dataset.i === si));
    if (best < 2.5 && inTune) {
      if (!inSince) inSince = Date.now();
      const pegEl = $(`.peg[data-i="${si}"]`, body);
      if (Date.now() - inSince > 400 && !pegEl.classList.contains("tuned")) { pegEl.classList.add("tuned"); haptic(18); }
    } else inSince = 0;
  };
  $(".mic", body).onclick = async (e) => {
    const btn = e.currentTarget;
    if (stop) { stop(); stop = null; btn.innerHTML = `${icon("mic")}<span>הפעילו מיקרופון</span>`; btn.classList.remove("on"); disp.classList.remove("live", "in", "near"); return; }
    try {
      await Sound.startMic();
      const s0 = Sound.listen(onPitch);
      activeCount++;
      stop = () => { s0(); activeCount--; };
      registerStop(() => stop && stop());
      btn.innerHTML = `${icon("stop")}<span>עצירה</span>`;
      btn.classList.add("on");
      $(".tstatus", body).textContent = "מקשיב… נגנו מיתר אחד ותנו לו לצלצל.";
    } catch (err) {
      $(".tstatus", body).textContent = "אין גישה למיקרופון. אשרו גישה בהגדרות הדפדפן ונסו שוב.";
    }
  };
}

let tapTimes = [];
function buildMetronome(body) {
  const m = toolsMetro;
  body.innerHTML = `<div class="metro">
    <div class="knob-wrap"><div class="knob-el"></div></div>
    <div class="beat-row" dir="ltr">${Array.from({ length: m.beats }, (_, i) => `<i class="${i === 0 ? "acc" : ""}"></i>`).join("")}</div>
    <div class="btn-row"><button class="cta play">${m.running ? icon("stop") + "<span>עצירה</span>" : icon("play") + "<span>הפעלה</span>"}</button><button class="btn tap">${icon("tap")}<span>טאפ</span></button></div>
    <div class="list-group">
      <div class="lg-row"><span>פעמות בתיבה</span><div class="seg mini beats">${[2, 3, 4, 6].map((b) => `<button data-b="${b}" class="${b === m.beats ? "on" : ""}">${b}</button>`).join("")}</div></div>
      <div class="lg-row"><span>חלוקה</span><div class="seg mini subs">${[[1, "♩"], [2, "♫"], [3, "3"], [4, "♬"]].map(([s, l]) => `<button data-s="${s}" class="${s === m.sub ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <label class="lg-row"><span class="lg-main"><b>מאמן מהירות</b><small>הקצב עולה לבד בהדרגה</small></span><input type="checkbox" class="toggle tr-on" ${m.trainer ? "checked" : ""}></label>
      <div class="lg-row tr-opts" ${m.trainer ? "" : "hidden"}><span>‎+<input type="number" class="tr-step" value="${(m.trainer && m.trainer.step) || 2}" min="1" max="10"> כל <input type="number" class="tr-bars" value="${(m.trainer && m.trainer.everyBars) || 4}" min="1" max="32"> תיבות, עד <input type="number" class="tr-target" value="${(m.trainer && m.trainer.target) || m.bpm + 30}" min="40" max="240"></span></div>
    </div>
  </div>`;
  const playBtn = $(".play", body);
  const toggle = () => {
    if (m.running) { m.stop(); playBtn.innerHTML = icon("play") + "<span>הפעלה</span>"; playBtn.classList.remove("on"); $$(".beat-row i", body).forEach((d) => d.classList.remove("on")); }
    else { readTrainer(); m.start(); playBtn.innerHTML = icon("stop") + "<span>עצירה</span>"; playBtn.classList.add("on"); }
  };
  const knob = Knob($(".knob-el", body), { value: m.bpm, onChange: (v) => (m.bpm = v), onTap: toggle });
  m.onBpm = (v) => knob.set(v);
  m.onTick = (info) => {
    if (info.sub !== 0) return;
    $$("#v-tools .beat-row i").forEach((d, i) => d.classList.toggle("on", i === info.beat));
    knob.pulse(info.beat === 0);
  };
  playBtn.onclick = toggle;
  $(".tap", body).onclick = () => {
    const now = performance.now();
    tapTimes = tapTimes.filter((t) => now - t < 2500);
    tapTimes.push(now);
    if (tapTimes.length >= 2) {
      const gaps = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
      m.bpm = clamp(Math.round(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)), 30, 240);
      knob.set(m.bpm);
    }
    Sound.click(Sound.context().currentTime + 0.005, 1);
  };
  $$(".beats button", body).forEach((b) => (b.onclick = () => { m.beats = +b.dataset.b; buildMetronome(body); }));
  $$(".subs button", body).forEach((b) => (b.onclick = () => { m.sub = +b.dataset.s; $$(".subs button", body).forEach((x) => x.classList.toggle("on", x === b)); }));
  const readTrainer = () => {
    m.trainer = $(".tr-on", body).checked ? { step: +$(".tr-step", body).value || 2, everyBars: +$(".tr-bars", body).value || 4, target: +$(".tr-target", body).value || 240 } : null;
  };
  $(".tr-on", body).onchange = (e) => { $(".tr-opts", body).hidden = !e.target.checked; readTrainer(); };
  $$(".tr-opts input", body).forEach((i) => (i.onchange = readTrainer));
}
const tempoName = (b) => (b < 60 ? "לרגו" : b < 76 ? "אדג'ו" : b < 108 ? "אנדנטה" : b < 120 ? "מודרטו" : b < 168 ? "אלגרו" : "פרסטו");

// ---------- Onboarding ----------
function onboarding() {
  const el = h(`<section class="onboard">
    <div class="ob-hero">
      <img class="ob-mark" src="img/icon.png" width="88" height="88" alt="">
      <h1>פריטה</h1>
      <p>המורה לגיטרה שבכיס. אימון קצר כל יום, מהאקורד הראשון ועד סולו מהיר.</p>
    </div>
    <div class="stage ob-stage"><canvas class="strings" aria-label="מיתרים לפריטה"></canvas><p class="stage-hint">${icon("hand")}<span>החליקו אצבע על המיתרים</span></p></div>
    <div class="ob-step2" hidden>
      <h3>כמה אתם כבר מנגנים?</h3>
      <div class="list-group ob-opts">
        <button class="lg-row nav" data-l="1"><span class="lg-main"><b>אף פעם לא ניגנתי</b><small>מתחילים מהחזקה וכיוון</small></span>${icon("chevron", "u-state")}</button>
        <button class="lg-row nav" data-l="2"><span class="lg-main"><b>יודע/ת כמה אקורדים</b><small dir="ltr">Em · Am · C · G</small></span>${icon("chevron", "u-state")}</button>
        <button class="lg-row nav" data-l="4"><span class="lg-main"><b>מנגן/ת שירים</b><small>אקורדים פתוחים וקצבים</small></span>${icon("chevron", "u-state")}</button>
        <button class="lg-row nav" data-l="6"><span class="lg-main"><b>מנגן/ת סולואים</b><small>מוטים ופנטטונית</small></span>${icon("chevron", "u-state")}</button>
      </div>
    </div>
    <button class="btn ghost ob-next">המשך</button>
  </section>`);
  document.body.appendChild(el);
  const reveal = () => {
    if (el.classList.contains("step2")) return;
    el.classList.add("step2");
    $(".ob-step2", el).hidden = false;
    $(".ob-next", el).hidden = true;
    haptic(12);
  };
  const pad = StringsPad($(".strings", el), { notes: chordNotes("E"), height: 170, onStrum: () => setTimeout(reveal, 500) });
  $(".ob-next", el).onclick = reveal;
  $$(".ob-opts button", el).forEach((b) => (b.onclick = () => {
    const lv = +b.dataset.l;
    PATH.filter((l) => l.id < lv).forEach((l) => l.units.forEach((u) => (S.done[u.id] = "skip")));
    S.onboarded = true;
    save();
    pad.destroy();
    el.classList.add("out");
    setTimeout(() => el.remove(), 450);
    renderAll();
  }));
}

// ---------- Navigation ----------
let view = "home";
function nav(v) {
  if (v === view && $("#v-" + v).childElementCount) { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); return; }
  view = v;
  $$(".view").forEach((x) => x.classList.toggle("active", x.id === "v-" + v));
  $$(".tabbar button").forEach((b) => { b.classList.toggle("on", b.dataset.v === v); b.setAttribute("aria-current", b.dataset.v === v ? "page" : "false"); });
  if (v !== "tools" && tunerStop) { tunerStop(); tunerStop = null; }
  if (v !== "home" && homePad) { homePad.destroy(); homePad = null; }
  render(v);
  window.scrollTo(0, 0);
  onScroll();
}
function render(v) {
  ({ home: renderHome, path: renderPath, chords: renderChords, train: renderTrain, tools: renderTools })[v]();
  const t = $(`#v-${v} [data-title]`);
  $(".navbar b").textContent = t ? t.textContent : "";
}
function renderAll() { render(view); }

// The large title folds into a compact bar as the page scrolls.
function onScroll() { document.body.classList.toggle("scrolled", window.scrollY > 48); }
window.addEventListener("scroll", onScroll, { passive: true });

$$(".tabbar button").forEach((b) => (b.onclick = () => nav(b.dataset.v)));
// Light haptic on every button press, on phones that support it
document.addEventListener("pointerdown", (e) => { if (e.target.closest("button, .chord-card, .lg-row")) haptic(5); });
// The first tap anywhere unlocks audio on iOS
document.addEventListener("pointerdown", () => Sound.context(), { once: true });
view = "";
nav("home");
if (!S.onboarded) onboarding();
