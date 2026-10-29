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

// ---------- Panels (full-screen sheets for activities) ----------
const panelStack = [];
let ignorePop = 0;
function openPanel(title, build, { onClose } = {}) {
  const el = h(`<section class="panel" role="dialog" aria-label="${title}">
    <header class="panel-head"><button class="icon-btn back" aria-label="חזרה">→</button><h2>${title}</h2></header>
    <div class="panel-body"></div></section>`);
  document.body.appendChild(el);
  const p = { el, body: $(".panel-body", el), cleanups: [], onClose };
  p.cleanup = (fn) => p.cleanups.push(fn);
  p.close = () => closePanel(p);
  $(".back", el).onclick = () => history.back();
  panelStack.push(p);
  activeCount++;
  history.pushState({ panel: panelStack.length }, "");
  requestAnimationFrame(() => el.classList.add("open"));
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
  setTimeout(() => p.el.remove(), 250);
  if (!fromPop) { ignorePop++; history.back(); }
}
window.addEventListener("popstate", () => {
  if (ignorePop) { ignorePop--; return; }
  const top = panelStack[panelStack.length - 1];
  if (top) closePanel(top, true);
});

function toast(msg) {
  const t = h(`<div class="toast">${msg}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not supported */ }
}

// ---------- Metronome control used inside activities ----------
function metroControl(container, metro, { bpm, min = 30, max = 240, onBpm } = {}) {
  metro.bpm = bpm || metro.bpm;
  const el = h(`<div class="metro-ctl">
    <button class="play" aria-label="הפעלה">▶</button>
    <div class="bpm-box" dir="ltr"><button class="step" data-d="-5">−5</button><div class="bpm"><b>${metro.bpm}</b><small>BPM</small></div><button class="step" data-d="5">+5</button></div>
    <div class="beats">${Array.from({ length: metro.beats }, () => "<i></i>").join("")}</div>
  </div>`);
  container.appendChild(el);
  const b = $(".bpm b", el), playBtn = $(".play", el);
  const set = (v) => { metro.bpm = clamp(v, min, max); b.textContent = metro.bpm; if (onBpm) onBpm(metro.bpm); };
  $$(".step", el).forEach((s) => (s.onclick = () => set(metro.bpm + +s.dataset.d)));
  const dots = () => $$(".beats i", el);
  const prevTick = metro.onTick;
  metro.onTick = (info) => {
    if (info.sub === 0) dots().forEach((d, i) => d.classList.toggle("on", i === info.beat));
    if (prevTick) prevTick(info);
  };
  metro.onBpm = (v) => { b.textContent = v; if (onBpm) onBpm(v); };
  const toggle = () => {
    if (metro.running) { metro.stop(); playBtn.textContent = "▶"; playBtn.classList.remove("on"); dots().forEach((d) => d.classList.remove("on")); }
    else { metro.start(); playBtn.textContent = "■"; playBtn.classList.add("on"); }
  };
  playBtn.onclick = toggle;
  return { el, set, toggle, stop: () => metro.running && toggle() };
}

// ---------- Activities ----------
// Each takes (container, params, panel) and returns { bpm() } when it has a tempo.
const Acts = {};

function stepsHTML(u) {
  if (!u.how) return "";
  return `<details class="how" ${u.openHow ? "open" : ""}><summary>איך עושים את זה</summary><ol>${u.how.map((x) => `<li>${x}</li>`).join("")}</ol>${u.goal ? `<p class="goal">🎯 יעד: ${u.goal}</p>` : ""}</details>`;
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
  const opts = h(`<label class="switch"><input type="checkbox" checked> האפליקציה מנגנת איתי</label>`);
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
    toast(isNew && n ? `שיא חדש: ${n} החלפות! 🔥` : `${n} החלפות. השיא: ${best()}`);
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
  const btn = h(`<button class="btn ghost rec">✓ ${label} ב-<span>${metro.bpm}</span> BPM</button>`);
  const best = h(`<p class="hint best-line"></p>`);
  const paint = () => { $("span", btn).textContent = metro.bpm; best.textContent = S.records.bpm[key] ? `השיא שלכם: ${S.records.bpm[key]} BPM` : ""; };
  btn.onclick = () => { if (record("bpm", key, metro.bpm)) toast(`שיא חדש: ${metro.bpm} BPM 🔥`); else toast("נשמר. השיא נשאר " + S.records.bpm[key]); paint(); };
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
  const trainer = h(`<label class="switch"><input type="checkbox"> מאמן מהירות: +2 BPM כל 4 תיבות</label>`);
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
    <button class="btn small lab">${S.settings.labels === "deg" ? "1-2-3" : "C-D-E"}</button>
  </div>`);
  c.appendChild(head);
  const fbWrap = h(`<div></div>`);
  c.appendChild(fbWrap);
  c.appendChild(h(`<p class="hint">עיגול כתום = השורש. ${metro.sub > 1 ? `${metro.sub} תווים לכל פעמה.` : "תו אחד לכל פעמה, עולים ויורדים."}</p>`));
  const play = h(`<button class="btn ghost">🔊 השמע את הסולם</button>`);
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
  const box = h(`<div class="free-timer"><b>0:00</b><button class="btn">▶ טיימר</button></div>`);
  c.appendChild(box);
  let t = 0, iv = 0;
  $("button", box).onclick = (e) => {
    if (iv) { clearInterval(iv); iv = 0; e.target.textContent = "▶ טיימר"; return; }
    e.target.textContent = "■ עצור";
    iv = setInterval(() => { t++; $("b", box).textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }, 1000);
  };
  p.cleanup(() => clearInterval(iv));
  if (/בנד|כיוון/.test(u.title)) {
    const go = h(`<button class="btn ghost">🎚️ פתחו את המכוון</button>`);
    go.onclick = () => openTunerPanel();
    c.appendChild(go);
  }
};

// Find the note: tap it on the neck, or play it into the microphone.
Acts.notes = (c, u, p) => {
  const strings = u.strings || [0, 1, 2, 3, 4, 5];
  const rkey = strings.join("");
  const box = h(`<div class="game">
    <div class="seg mode"><button data-m="tap" class="on">👆 הקשה</button><button data-m="mic">🎤 נגינה</button></div>
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
    q.textContent = isNew && n ? `שיא חדש: ${n}! 🔥` : `${n} נכונות`;
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
    <button class="tap-big">🔊 השמע</button>
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
        if (met && !S.done[u.id]) { S.done[u.id] = today(); save(); toast("עמדתם ביעד! השלב הבא נפתח 🎉"); }
        foot.innerHTML = S.done[u.id] ? `<p class="done-badge">✓ הושלם</p><button class="btn ghost small undo">סמן כלא הושלם</button>` : u.check === "self" ? `<button class="btn primary mark">✓ עמדתי ביעד</button>` : `<p class="hint">היעד ייבדק לבד כשתשברו את השיא.</p><button class="btn ghost small mark">סמן כהושלם בכל זאת</button>`;
        const m = $(".mark", foot);
        if (m) m.onclick = () => { S.done[u.id] = today(); if (api.bpm) S.bpm[keyB] = api.bpm(); save(); toast("כל הכבוד! 🎸"); paint(); renderAll(); };
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

function startSession(minutes) {
  const blocks = buildSession(minutes);
  let i = 0, startedAt = Date.now();
  keepAwake(true);
  const runBlock = () => {
    const b = blocks[i];
    const tempo = ["chords", "strum", "scale", "spider", "jam"].includes(b.kind);
    const p = openUnit(b, { inSession: true, title: `${i + 1}/${blocks.length} · ${b.title}` });
    const bar = h(`<div class="session-bar">
      <div class="prog">${blocks.map((_, j) => `<i class="${j < i ? "done" : j === i ? "now" : ""}"></i>`).join("")}</div>
      <div class="sb-row"><div class="clock"><b>${fmt(b.minutes * 60)}</b><small>${b.focus ? "המשימה של היום" : "זמן לתרגיל"}</small></div><button class="btn primary next">${i === blocks.length - 1 ? "סיום" : "הבא ←"}</button></div>
      ${b.focus ? `<label class="switch goal-check"><input type="checkbox"> עמדתי ביעד: ${b.goal}</label>` : ""}
      <div class="rate" hidden><p>איך היה הקצב?</p><div class="row"><button data-r="-5" class="btn">קשה</button><button data-r="2" class="btn">בדיוק</button><button data-r="5" class="btn">קל מדי</button></div></div>
    </div>`);
    p.body.prepend(bar);
    let left = b.minutes * 60;
    const iv = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      left--;
      $(".clock b", bar).textContent = fmt(Math.max(0, left));
      if (left === 0) { bar.classList.add("timeup"); chime(); }
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
      if (goalBox && goalBox.checked && !S.done[b.id]) { S.done[b.id] = today(); save(); toast("שלב הושלם! 🎉"); }
      p.close();
      i++;
      if (i < blocks.length) setTimeout(runBlock, 280);
      else setTimeout(() => finishSession(Math.round((Date.now() - startedAt) / 60000)), 280);
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
  openPanel("כל הכבוד!", (body) => {
    body.innerHTML = `<div class="finish">
      <div class="big-emoji">🎸</div>
      <h3>אימון הושלם</h3>
      <div class="ch-stats"><div><small>דקות</small><b>${Math.max(1, mins)}</b></div><div><small>רצף ימים</small><b>${st}🔥</b></div><div><small>אימונים</small><b>${S.sessions}</b></div></div>
      <p>המטרונום כבר מכוון לאימון הבא לפי מה שסימנתם. נתראה מחר!</p>
      <button class="btn primary close">סגור</button></div>`;
    $(".close", body).onclick = () => history.back();
    chime();
  }, { onClose: () => renderAll() });
}

// ---------- Views ----------
function renderHome() {
  const v = $("#v-home");
  const lvl = currentLevel();
  const doneN = lvl.units.filter((u) => S.done[u.id]).length;
  const next = lvl.units.find((u) => !S.done[u.id]);
  const st = streak();
  const todayMin = minutesOn(today());
  v.innerHTML = `
    <div class="hero">
      <div class="hero-top"><span class="chip">🔥 ${st} ימים ברצף</span><span class="chip">${todayMin}/${S.goalMin} דק' היום</span></div>
      <h1>האימון של היום</h1>
      <p>רמה ${lvl.id}: ${lvl.name}${next ? ` · עכשיו: <b>${next.title}</b>` : ""}</p>
      <div class="seg dur">${[10, 20, 30, 45].map((m) => `<button data-m="${m}" class="${m === S.goalMin ? "on" : ""}">${m} דק'</button>`).join("")}</div>
      <button class="btn primary huge start">▶ התחילו אימון</button>
      <div class="lvl-bar"><i style="width:${(doneN / lvl.units.length) * 100}%"></i></div>
      <small class="muted">${doneN} מתוך ${lvl.units.length} שלבים ברמה ${lvl.id}</small>
    </div>
    <h3 class="sec">7 הימים האחרונים</h3>
    <div class="week">${lastDays(7).map((d) => `<div class="day ${minutesOn(d) >= S.goalMin ? "full" : minutesOn(d) >= 2 ? "part" : ""}"><i style="height:${Math.min(100, (minutesOn(d) / S.goalMin) * 100)}%"></i><small>${dayName(d)}</small></div>`).join("")}</div>
    <h3 class="sec">קיצורי דרך</h3>
    <div class="quick">
      <button data-go="tuner">🎚️<b>מכוון</b></button>
      <button data-go="metro">⏱️<b>מטרונום</b></button>
      <button data-go="jam">🥁<b>ג'אם</b></button>
      <button data-go="notes">🎯<b>תווים</b></button>
    </div>
    <h3 class="sec">השיאים שלכם</h3>
    <div class="records">${recordsHTML()}</div>
    <p class="muted small-print">הכול נשמר רק בדפדפן הזה. <button class="link reset">איפוס</button></p>`;
  $(".start", v).onclick = () => startSession(S.goalMin);
  $$(".dur button", v).forEach((b) => (b.onclick = () => { S.goalMin = +b.dataset.m; save(); renderHome(); }));
  $$(".quick button", v).forEach((b) => (b.onclick = () => quick(b.dataset.go)));
  $(".reset", v).onclick = () => { if (confirm("למחוק את כל ההתקדמות?")) { S = blank(); save(); location.reload(); } };
}
function recordsHTML() {
  const r = S.records;
  const rows = [];
  Object.entries(r.changes).forEach(([k, v]) => rows.push([`החלפות ${k.split("-").map(chordName).join(" ↔ ")}`, `${v}/דקה`]));
  if (r.bpm.spider) rows.push(["עכביש כרומטי", `${r.bpm.spider} BPM`]);
  Object.entries(r.bpm).filter(([k]) => k.startsWith("scale:")).forEach(([k, v]) => rows.push([SCALES[k.slice(6)].name, `${v} BPM`]));
  Object.entries(r.notes).forEach(([k, v]) => rows.push([`תווים (${k.length === 6 ? "כל המיתרים" : [...k].map((s) => STRING_NAMES[s]).join(", ")})`, `${v}/דקה`]));
  Object.entries(r.ear).forEach(([k, v]) => rows.push([k === "chords" ? "אוזן: אקורדים" : "אוזן: מרווחים", `רצף ${v}`]));
  if (!rows.length) return `<p class="muted">עוד אין שיאים. כל אימון ישבור אחד 💪</p>`;
  return rows.map(([a, b]) => `<div class="rec-row"><span>${a}</span><b>${b}</b></div>`).join("");
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
  if (go === "tuner") { nav("tools"); setToolTab("tuner"); }
  else if (go === "metro") { nav("tools"); setToolTab("metro"); }
  else if (go === "jam") openUnit({ kind: "jam", key: "jam", title: "ג'אם", prog: "pop", bpm: 80 });
  else if (go === "notes") openUnit({ kind: "notes", title: "מצאו את התו", strings: [0, 1, 2, 3, 4, 5] });
}

const KIND_ICON = { chords: "🎵", changes: "🔁", strum: "↕️", scale: "🎼", spider: "🕷️", notes: "🎯", ear: "👂", jam: "🥁", free: "✋" };
function renderPath() {
  const v = $("#v-path");
  const cur = currentLevel().id;
  v.innerHTML = `<h1 class="title">המסלול</h1><p class="muted">8 רמות ממתחילים מוחלטים ועד נגינה מתקדמת. כל שלב עם יעד ברור.</p>` +
    PATH.map((l) => {
      const n = l.units.filter((u) => S.done[u.id]).length;
      const state = n === l.units.length ? "done" : l.id === cur ? "cur" : l.id < cur ? "done" : "lock";
      return `<section class="level ${state}">
        <header><span class="lnum">${state === "done" ? "✓" : l.id}</span><div><h3>${l.name}</h3><p>${l.goal}</p></div></header>
        <div class="units">${l.units.map((u) => `<button class="unit ${S.done[u.id] ? "done" : ""}" data-u="${u.id}"><span>${KIND_ICON[u.kind]}</span><b>${u.title}</b><small>${u.goal}</small><em>${S.done[u.id] ? "✓" : "‹"}</em></button>`).join("")}</div>
      </section>`;
    }).join("");
  $$(".unit", v).forEach((b) => (b.onclick = () => openUnit(unitById(b.dataset.u).unit)));
}

let chordCat = "open";
function renderChords() {
  const v = $("#v-chords");
  const ids = Object.keys(CHORDS).filter((id) => CHORDS[id].cat === chordCat);
  v.innerHTML = `<h1 class="title">אקורדים</h1>
    <div class="chips">${CHORD_CATS.map(([id, name]) => `<button data-c="${id}" class="${id === chordCat ? "on" : ""}">${name}</button>`).join("")}</div>
    <div class="chord-grid">${ids.map((id) => chordCard(id)).join("")}</div>
    <div class="card">
      <h3>מאמן החלפות בדקה</h3>
      <p class="muted">השיטה הכי מהירה ללמוד מעברים: דקה אחת, שני אקורדים, סופרים החלפות.</p>
      <div class="row"><select class="ca">${chordOptions("C")}</select><span>↔</span><select class="cb">${chordOptions("G")}</select><button class="btn primary go">התחל</button></div>
    </div>`;
  $$(".chips button", v).forEach((b) => (b.onclick = () => { chordCat = b.dataset.c; renderChords(); }));
  $$(".chord-grid .chord-card", v).forEach((el) => (el.onclick = () => openChord(el.dataset.chord)));
  $(".go", v).onclick = () => {
    const a = $(".ca", v).value, b = $(".cb", v).value;
    if (a === b) return toast("בחרו שני אקורדים שונים");
    openUnit({ kind: "changes", title: `${chordName(a)} ↔ ${chordName(b)}`, pair: [a, b] });
  };
}
const chordOptions = (sel) => Object.keys(CHORDS).map((id) => `<option value="${id}" ${id === sel ? "selected" : ""}>${chordName(id)}</option>`).join("");

function openChord(id) {
  Sound.strum(id);
  openPanel(chordName(id), (body) => {
    const notes = Sound.chordMidis(id).map((m) => Sound.noteName(m));
    body.innerHTML = `<div class="chord-detail">${chordCard(id, "huge")}
      <p class="muted">תווים: <b dir="ltr">${[...new Set(notes)].join(" · ")}</b></p>
      <p class="muted">המספרים = האצבעות: 1 מורה, 2 אמה, 3 קמיצה, 4 זרת. × = לא מנגנים את המיתר, ○ = מיתר פתוח.</p>
      <div class="row"><button class="btn primary s">🔊 פריטה</button><button class="btn a">🎶 מיתר אחרי מיתר</button></div></div>`;
    $(".s", body).onclick = () => Sound.strum(id);
    $(".a", body).onclick = () => { const t = Sound.context().currentTime; Sound.chordMidis(id).forEach((m, i) => Sound.pluck(m, t + i * 0.32, 0.5, 1.5)); };
    $(".chord-card", body).onclick = () => Sound.strum(id);
  });
}

function renderTrain() {
  const v = $("#v-train");
  const items = [
    ["notes", "🎯", "מצאו את התו", "משחק דקה: מוצאים תווים על הצוואר בהקשה, או מנגנים אותם למיקרופון."],
    ["ear", "👂", "אימון אוזן", "מזהים מרווחים ואקורדים בשמיעה. ככה מנגנים מה ששומעים."],
    ["scale", "🎼", "סולמות על הצוואר", "פנטטונית, בלוז, מז'ור ומודוסים, בכל סולם ובכל תיבה."],
    ["jam", "🥁", "ג'אם עם האפליקציה", "האפליקציה מנגנת אקורדים ובס, אתם מנגנים איתה או מאלתרים סולו."],
    ["spider", "🕷️", "מאמן מהירות", "עכביש כרומטי עם מטרונום שעולה לבד. הדרך לנגינה מהירה ונקייה."],
    ["strum", "↕️", "קצבי פריטה", "7 קצבים, מרבעים פשוטים ועד פאנק בשש-עשריות."],
  ];
  v.innerHTML = `<h1 class="title">אימונים</h1><div class="train-list">${items.map(([k, i, t, d]) => `<button class="train-item" data-k="${k}"><span>${i}</span><div><b>${t}</b><small>${d}</small></div></button>`).join("")}</div>`;
  $$(".train-item", v).forEach((b) => (b.onclick = () => openTrainer(b.dataset.k)));
}
function openTrainer(k) {
  if (k === "notes") openUnit({ kind: "notes", title: "מצאו את התו", strings: [0, 1, 2, 3, 4, 5] });
  else if (k === "ear") openUnit({ kind: "ear", title: "אימון אוזן" });
  else if (k === "scale") openUnit({ kind: "scale", key: "scale", title: "סולמות", scale: "minPent", box: 0, bpm: 70 });
  else if (k === "jam") openUnit({ kind: "jam", key: "jam", title: "ג'אם", prog: "pop", bpm: 80 });
  else if (k === "spider") openUnit({ kind: "spider", key: "spider", title: "מאמן מהירות", bpm: 60, how: PATH[2].units[0].how });
  else if (k === "strum") {
    openPanel("קצבי פריטה", (body, p) => {
      body.innerHTML = `<div class="strum-list">${Object.entries(STRUMS).map(([id, s]) => `<button class="train-item" data-s="${id}"><div><b>${s.name}</b><small dir="ltr">${[...s.slots].map((x) => (x === "D" ? "↓" : x === "U" ? "↑" : "·")).join(" ")}</small></div></button>`).join("")}</div>`;
      $$("[data-s]", body).forEach((b) => (b.onclick = () => openUnit({ kind: "strum", key: "strum:" + b.dataset.s, title: STRUMS[b.dataset.s].name, strum: b.dataset.s, chord: b.dataset.s === "funk" ? "Am7" : "G", bpm: 70 })));
      void p;
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
  v.innerHTML = `<div class="seg tooltabs"><button data-t="tuner" class="${toolTab === "tuner" ? "on" : ""}">🎚️ מכוון</button><button data-t="metro" class="${toolTab === "metro" ? "on" : ""}">⏱️ מטרונום</button></div><div class="tool-body"></div>`;
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
  body.innerHTML = `<div class="tuner">
    <select class="tuning">${Object.entries(TUNINGS).map(([id, t]) => `<option value="${id}" ${id === S.settings.tuning ? "selected" : ""}>${t.name}</option>`).join("")}</select>
    <div class="gauge">
      <svg viewBox="0 0 240 130" dir="ltr"><path d="M20 120 A100 100 0 0 1 220 120" class="arc"/>
        ${[-50, -25, 0, 25, 50].map((c) => { const a = (c / 50) * 70 * Math.PI / 180; return `<line x1="${120 + Math.sin(a) * 92}" y1="${120 - Math.cos(a) * 92}" x2="${120 + Math.sin(a) * 104}" y2="${120 - Math.cos(a) * 104}" class="tick ${c === 0 ? "zero" : ""}"/>`; }).join("")}
        <rect x="102" y="12" width="36" height="10" rx="5" class="ok-zone"/>
        <line x1="120" y1="120" x2="120" y2="28" class="needle"/><circle cx="120" cy="120" r="7" class="hub"/></svg>
      <div class="readout"><b class="note">—</b><small class="cents">נגנו מיתר</small></div>
    </div>
    <div class="strings" dir="ltr">${tun.notes.map((m, i) => `<button data-i="${i}"><b>${Sound.noteName(m)}</b><small>${Sound.octave(m)}</small></button>`).join("")}</div>
    <p class="hint tstatus">לחצו על "הפעל מיקרופון" ונגנו מיתר אחד בכל פעם. לחיצה על מיתר משמיעה צליל ייחוס.</p>
    <button class="btn primary mic">🎤 הפעל מיקרופון</button>
  </div>`;
  $(".tuning", body).onchange = (e) => { if (stop) { stop(); stop = null; } S.settings.tuning = e.target.value; save(); buildTuner(body, registerStop); };
  $$(".strings button", body).forEach((b) => (b.onclick = () => Sound.pluck(tun.notes[+b.dataset.i], 0, 0.6, 2.5)));
  const needle = $(".needle", body), noteEl = $(".note", body), centsEl = $(".cents", body), gauge = $(".gauge", body);
  let hist = [], lastSeen = 0;
  const onPitch = (r) => {
    if (!r || r.clarity < 0.8 || r.freq < 60 || r.freq > 1100) {
      if (Date.now() - lastSeen > 1200) { gauge.classList.remove("in", "near"); }
      return;
    }
    lastSeen = Date.now();
    hist.push(r.freq);
    if (hist.length > 7) hist.shift();
    const f = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];
    const midi = Sound.freqToMidi(f);
    // nearest open string of the tuning, if within a few semitones; else nearest note
    let si = -1, best = 99;
    tun.notes.forEach((m, i) => { const d = Math.abs(midi - m); if (d < best) { best = d; si = i; } });
    const targetMidi = best < 2.5 ? tun.notes[si] : Math.round(midi);
    const cents = clamp(Math.round((midi - targetMidi) * 100), -50, 50);
    noteEl.textContent = Sound.noteName(targetMidi);
    centsEl.textContent = Math.abs(cents) <= 4 ? "מכוון ✓" : cents < 0 ? `נמוך ב-${-cents} סנט · הדקו` : `גבוה ב-${cents} סנט · שחררו`;
    needle.style.transform = `rotate(${(cents / 50) * 70}deg)`;
    gauge.classList.toggle("in", Math.abs(cents) <= 4);
    gauge.classList.toggle("near", Math.abs(cents) > 4 && Math.abs(cents) <= 15);
    $$(".strings button", body).forEach((b, i) => b.classList.toggle("now", best < 2.5 && i === si));
    if (best < 2.5 && Math.abs(cents) <= 4) $$(".strings button", body)[si].classList.add("tuned");
  };
  $(".mic", body).onclick = async (e) => {
    if (stop) { stop(); stop = null; e.target.textContent = "🎤 הפעל מיקרופון"; return; }
    try {
      await Sound.startMic();
      stop = Sound.listen(onPitch);
      activeCount++;
      const s0 = stop;
      stop = () => { s0(); activeCount--; };
      registerStop(() => stop && stop());
      e.target.textContent = "⏹ עצור";
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
    <div class="beat-dots" dir="ltr">${Array.from({ length: m.beats }, (_, i) => `<i class="${i === 0 ? "acc" : ""}"></i>`).join("")}</div>
    <div class="big-bpm" dir="ltr"><button class="step" data-d="-1">−</button><div><b>${m.bpm}</b><small>BPM · ${tempoName(m.bpm)}</small></div><button class="step" data-d="1">+</button></div>
    <input type="range" min="30" max="240" value="${m.bpm}" class="slider" dir="ltr">
    <div class="row"><button class="btn primary huge play">${m.running ? "■ עצור" : "▶ הפעל"}</button><button class="btn tap">👆 טאפ</button></div>
    <label>פעמות בתיבה <div class="seg beats">${[2, 3, 4, 6].map((b) => `<button data-b="${b}" class="${b === m.beats ? "on" : ""}">${b}</button>`).join("")}</div></label>
    <label>חלוקה <div class="seg subs">${[[1, "♩"], [2, "♫"], [3, "3"], [4, "♬"]].map(([s, l]) => `<button data-s="${s}" class="${s === m.sub ? "on" : ""}">${l}</button>`).join("")}</div></label>
    <div class="card trainer">
      <label class="switch"><input type="checkbox" class="tr-on" ${m.trainer ? "checked" : ""}> <b>מאמן מהירות</b></label>
      <p class="muted">המטרונום עולה לבד בהדרגה. מתחילים בקצב נוח ומגיעים ליעד בלי לשים לב.</p>
      <div class="row wrap"><span>+</span><input type="number" class="tr-step" value="${(m.trainer && m.trainer.step) || 2}" min="1" max="10"><span>BPM כל</span><input type="number" class="tr-bars" value="${(m.trainer && m.trainer.everyBars) || 4}" min="1" max="32"><span>תיבות, עד</span><input type="number" class="tr-target" value="${(m.trainer && m.trainer.target) || m.bpm + 30}" min="40" max="240"></div>
    </div>
  </div>`;
  const bEl = $(".big-bpm b", body), small = $(".big-bpm small", body), slider = $(".slider", body);
  const set = (v) => { m.bpm = clamp(Math.round(v), 30, 240); bEl.textContent = m.bpm; small.textContent = `BPM · ${tempoName(m.bpm)}`; slider.value = m.bpm; };
  m.onBpm = set;
  $$(".step", body).forEach((s) => (s.onclick = () => set(m.bpm + +s.dataset.d)));
  slider.oninput = () => set(+slider.value);
  m.onTick = (info) => {
    const dots = $$("#v-tools .beat-dots i");
    if (info.sub === 0) dots.forEach((d, i) => d.classList.toggle("on", i === info.beat));
  };
  $(".play", body).onclick = (e) => {
    if (m.running) { m.stop(); e.target.textContent = "▶ הפעל"; $$(".beat-dots i", body).forEach((d) => d.classList.remove("on")); }
    else { readTrainer(); m.start(); e.target.textContent = "■ עצור"; }
  };
  $(".tap", body).onclick = () => {
    const now = performance.now();
    tapTimes = tapTimes.filter((t) => now - t < 2500);
    tapTimes.push(now);
    if (tapTimes.length >= 2) {
      const gaps = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
      set(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
    }
    Sound.click(Sound.context().currentTime + 0.005, 1);
  };
  $$(".beats button", body).forEach((b) => (b.onclick = () => { m.beats = +b.dataset.b; buildMetronome(body); }));
  $$(".subs button", body).forEach((b) => (b.onclick = () => { m.sub = +b.dataset.s; $$(".subs button", body).forEach((x) => x.classList.toggle("on", x === b)); }));
  const readTrainer = () => {
    m.trainer = $(".tr-on", body).checked ? { step: +$(".tr-step", body).value || 2, everyBars: +$(".tr-bars", body).value || 4, target: +$(".tr-target", body).value || 240 } : null;
  };
  $$(".trainer input", body).forEach((i) => (i.onchange = readTrainer));
}
const tempoName = (b) => (b < 60 ? "לרגו" : b < 76 ? "אדג'ו" : b < 108 ? "אנדנטה" : b < 120 ? "מודרטו" : b < 168 ? "אלגרו" : "פרסטו");

// ---------- Onboarding ----------
function onboarding() {
  const el = h(`<section class="onboard">
    <div class="ob-card">
      <div class="logo-big">🎸</div>
      <h1>פריטה</h1>
      <p>המורה לגיטרה שבכיס. אימון יומי קצר שמתאים את עצמו אליכם, מהאקורד הראשון ועד סולו מהיר.</p>
      <h3>כמה אתם כבר מנגנים?</h3>
      <div class="ob-opts">
        <button data-l="1"><b>אף פעם לא ניגנתי</b><small>מתחילים מהחזקה וכיוון</small></button>
        <button data-l="2"><b>יודע/ת כמה אקורדים</b><small>Em, Am, C, G</small></button>
        <button data-l="4"><b>מנגן/ת שירים</b><small>אקורדים פתוחים וקצבים</small></button>
        <button data-l="6"><b>מנגן/ת סולואים</b><small>מוטים ופנטטונית</small></button>
      </div>
    </div></section>`);
  document.body.appendChild(el);
  $$(".ob-opts button", el).forEach((b) => (b.onclick = () => {
    const lv = +b.dataset.l;
    PATH.filter((l) => l.id < lv).forEach((l) => l.units.forEach((u) => (S.done[u.id] = "skip")));
    S.onboarded = true;
    save();
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
    renderAll();
  }));
}

// ---------- Navigation ----------
let view = "home";
function nav(v) {
  view = v;
  $$(".view").forEach((x) => x.classList.toggle("active", x.id === "v-" + v));
  $$(".tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  if (v !== "tools" && tunerStop) { tunerStop(); tunerStop = null; }
  render(v);
  window.scrollTo(0, 0);
}
function render(v) {
  ({ home: renderHome, path: renderPath, chords: renderChords, train: renderTrain, tools: renderTools })[v]();
}
function renderAll() { render(view); }

$$(".tabbar button").forEach((b) => (b.onclick = () => nav(b.dataset.v)));
// The first tap anywhere unlocks audio on iOS
document.addEventListener("pointerdown", () => Sound.context(), { once: true });
nav("home");
if (!S.onboarded) onboarding();
