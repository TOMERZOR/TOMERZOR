import { ANIMATIONS, FONTS, DEFAULT_STYLE, buildPages, drawCaptions, pageAt, ensureFont } from './render.js';
import { ENGINES, LANGUAGES, Transcriber, extractAudio } from './transcribe.js';
import { exportVideo, cancelExport, toSRT, download } from './export.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('kafitz.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kafitz.' + k, JSON.stringify(v)); } catch {} },
};

const S = {
  file: null,
  audio: null,
  words: [],
  pages: [],
  style: { ...DEFAULT_STYLE, ...store.get('style', {}) },
  engine: store.get('engine', 'balanced'),
  language: store.get('language', 'hebrew'),
  key: store.get('key', ''),
  running: false,
  renderState: {},
};
const transcriber = new Transcriber();
const video = $('video'), overlay = $('overlay'), octx = overlay.getContext('2d');

// ---------- helpers ----------
const fmt = (s) => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
let toastTimer;
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), err ? 6000 : 3000);
}
const ERRORS = {
  NO_AUDIO: 'לא נמצא שמע בקובץ הזה.',
  CANT_DECODE: 'הדפדפן לא מצליח לפענח את השמע בקובץ. נסו להמיר ל-MP4.',
  NO_KEY: 'כדי לתמלל עם ElevenLabs צריך להדביק מפתח API.',
  BAD_KEY: 'מפתח ה-ElevenLabs לא התקבל. בדקו אותו ונסו שוב.',
  NO_ENCODER: 'הדפדפן הזה לא יודע לקודד וידאו. נסו Chrome או Edge, או ייצאו קובץ SRT.',
  NO_VIDEO: 'לא נמצא וידאו בקובץ.',
};
const errText = (e) => ERRORS[e?.message] || `משהו השתבש: ${e?.message || e}`;

// ---------- language and engine pickers ----------
function fillSelect(sel, items, value) {
  sel.innerHTML = items.map((i) => `<option value="${i.id}">${i.label}</option>`).join('');
  sel.value = value;
}
fillSelect($('homeLang'), LANGUAGES, S.language);
fillSelect($('lang'), LANGUAGES, S.language);
fillSelect($('engine'), ENGINES, S.engine);
$('apiKey').value = S.key;
function syncEngineUI() {
  const e = ENGINES.find((x) => x.id === S.engine) || ENGINES[1];
  $('engineNote').textContent = e.note;
  $('keyField').hidden = !e.cloud;
}
syncEngineUI();
for (const id of ['homeLang', 'lang']) {
  $(id).onchange = (ev) => { S.language = ev.target.value; $('homeLang').value = $('lang').value = S.language; store.set('language', S.language); };
}
$('engine').onchange = (ev) => { S.engine = ev.target.value; store.set('engine', S.engine); syncEngineUI(); };
$('apiKey').onchange = (ev) => { S.key = ev.target.value.trim(); store.set('key', S.key); };

// ---------- loading a video ----------
const drop = $('drop');
$('fileInput').onchange = (e) => e.target.files[0] && openFile(e.target.files[0]);
drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } };
['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); if (t === 'drop' || !e.relatedTarget) drop.classList.remove('over'); }));
document.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) openFile(f); });

async function openFile(file) {
  if (!/^(video|audio)\//.test(file.type) && !/\.(mp4|mov|webm|mkv|m4v|mp3|wav|m4a)$/i.test(file.name)) { toast('זה לא נראה כמו קובץ וידאו.', true); return; }
  stopRun();
  S.file = file;
  S.audio = null;
  S.words = [];
  rebuild();
  if (video.src) URL.revokeObjectURL(video.src);
  video.src = URL.createObjectURL(file);
  $('home').hidden = true;
  $('editor').hidden = false;
  $('topActions').hidden = false;
  stopDemo();
  await new Promise((r) => { video.onloadedmetadata = r; video.onerror = r; });
  fitStage();
  transcribeAll();
}

$('newVideo').onclick = () => { stopRun(); video.pause(); $('fileInput').value = ''; $('fileInput').click(); };

// ---------- stage sizing and preview ----------
function fitStage() {
  const st = $('stage');
  const w = video.videoWidth || 16, h = video.videoHeight || 9;
  st.style.aspectRatio = `${w} / ${h}`;
  const col = st.parentElement.clientWidth;
  const maxH = Math.max(240, parseFloat(getComputedStyle(st).maxHeight) || window.innerHeight * 0.7);
  st.style.width = Math.min(col, (maxH * w) / h) + 'px';
}
window.addEventListener('resize', () => { if (!$('editor').hidden) fitStage(); });

function drawPreview() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(overlay.clientWidth * dpr), H = Math.round(overlay.clientHeight * dpr);
  if (overlay.width !== W || overlay.height !== H) { overlay.width = W; overlay.height = H; }
  octx.clearRect(0, 0, W, H);
  if (S.pages.length && W && H) drawCaptions(octx, W, H, video.currentTime, S.words, S.pages, S.style, S.renderState);
}

let lastNow = null;
function tick() {
  if (!$('editor').hidden) {
    drawPreview();
    const t = video.currentTime, d = video.duration || 0;
    if (!seeking) $('seek').value = d ? Math.round((t / d) * 1000) : 0;
    $('time').textContent = `${fmt(t)} / ${fmt(d)}`;
    const pg = pageAt(S.pages, t);
    const now = pg ? S.pages.indexOf(pg) : -1;
    if (now !== lastNow) {
      lastNow = now;
      document.querySelectorAll('.cap.now').forEach((el) => el.classList.remove('now'));
      const el = $('captions').children[now];
      if (el) {
        el.classList.add('now');
        if (!video.paused && !el.contains(document.activeElement)) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Transport
const setPlayIcon = () => {
  const icon = video.paused ? 'ph-fill ph-play' : 'ph-fill ph-pause';
  $('playBtn').innerHTML = `<i class="${icon}"></i>`;
  $('playBtn').setAttribute('aria-label', video.paused ? 'ניגון' : 'השהיה');
  $('bigPlay').classList.toggle('gone', !video.paused);
};
const togglePlay = () => (video.paused ? video.play() : video.pause());
video.onplay = video.onpause = setPlayIcon;
$('playBtn').onclick = togglePlay;
let seeking = false;
$('seek').oninput = (e) => { seeking = true; video.currentTime = (e.target.value / 1000) * (video.duration || 0); };
$('seek').onchange = () => { seeking = false; };
document.addEventListener('keydown', (e) => {
  if ($('editor').hidden || e.target.closest('input, select, [contenteditable], textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
});

// Click the video to play or pause; drag to move the caption up or down.
let drag = null;
overlay.addEventListener('pointerdown', (e) => {
  drag = { y: e.clientY, moved: false };
  overlay.setPointerCapture(e.pointerId);
});
overlay.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
  if (drag.moved) {
    overlay.classList.add('dragging');
    const r = overlay.getBoundingClientRect();
    setStyle('posY', Math.min(0.95, Math.max(0.08, (e.clientY - r.top) / r.height)));
  }
});
overlay.addEventListener('pointerup', () => {
  if (drag && !drag.moved) togglePlay();
  drag = null;
  overlay.classList.remove('dragging');
});

// ---------- captions model ----------
function rebuild() {
  S.pages = buildPages(S.words, S.style);
  S.renderState = {};
  lastNow = null;
  renderList();
  renderTimeline();
}

function renderTimeline() {
  const d = video.duration || 1;
  $('tlPages').innerHTML = S.pages.map((p) => `<i style="left:${(p.start / d) * 100}%;width:${((p.end - p.start) / d) * 100}%"></i>`).join('');
}

const pageText = (pg) => pg.idx.map((i) => S.words[i].text).join(' ');

function renderList() {
  const ol = $('captions');
  const active = document.activeElement;
  if (active?.classList?.contains('txt') && ol.contains(active)) return; // don't yank text from under the cursor
  $('pageCount').textContent = S.pages.length ? `(${S.pages.length})` : '';
  $('emptyList').hidden = S.pages.length > 0 || S.running;
  const frag = document.createDocumentFragment();
  S.pages.forEach((pg, n) => {
    const li = document.createElement('li');
    li.className = 'cap';
    li.style.animationDelay = Math.min(n, 12) * 18 + 'ms';
    li.innerHTML = `
      <time title="קפיצה לכאן">${fmt(pg.start)}</time>
      <div class="txt" contenteditable="plaintext-only" spellcheck="false"></div>
      <div class="acts">
        <button class="icon-btn" data-act="redo" title="לתמלל שוב רק את הקטע הזה" aria-label="תמלול מחדש של הקטע"><i class="ph ph-arrows-clockwise"></i></button>
        <button class="icon-btn" data-act="del" title="מחיקת הכתובית" aria-label="מחיקה"><i class="ph ph-trash"></i></button>
      </div>`;
    const txt = li.querySelector('.txt');
    txt.textContent = pageText(pg);
    txt.dir = 'auto';
    li.querySelector('time').onclick = () => { video.currentTime = pg.start + 0.01; };
    txt.onfocus = () => { video.currentTime = pg.start + 0.01; video.pause(); };
    txt.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); txt.blur(); } if (e.key === 'Escape') { txt.textContent = pageText(pg); txt.blur(); } };
    txt.onblur = () => commitEdit(pg, txt.textContent);
    li.querySelector('[data-act=del]').onclick = () => { S.words.splice(pg.idx[0], pg.idx.length); rebuild(); };
    li.querySelector('[data-act=redo]').onclick = () => redoPage(pg, li);
    frag.append(li);
  });
  ol.replaceChildren(frag);
}

// Replaces a caption's words with the edited text. Same word count keeps every word's timing;
// otherwise the caption's time is shared between the new words by length.
function commitEdit(pg, raw) {
  const parts = raw.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (parts.join(' ') === pageText(pg)) return;
  const old = pg.idx.map((i) => S.words[i]);
  let fresh;
  if (parts.length === old.length) {
    fresh = old.map((w, k) => ({ ...w, text: parts[k] }));
  } else {
    const s = old[0].start, e = old[old.length - 1].end;
    const weights = parts.map((p) => p.length + 2), total = weights.reduce((a, b) => a + b, 0);
    let at = s;
    fresh = parts.map((p, k) => { const d = ((e - s) * weights[k]) / total; const w = { text: p, start: at, end: at + d }; at += d; return w; });
  }
  S.words.splice(pg.idx[0], pg.idx.length, ...fresh);
  setTimeout(rebuild);
}

// ---------- transcription ----------
function status(text, frac) {
  $('status').hidden = false;
  $('statusText').textContent = text;
  const bar = $('statusBar').parentElement;
  bar.classList.toggle('indeterminate', frac == null);
  $('statusBar').style.width = frac == null ? '' : Math.round(frac * 100) + '%';
}
const hideStatus = () => ($('status').hidden = true);

transcriber.onDownload = (loaded, total) => {
  if (!S.running) return;
  const mb = (n) => Math.round(n / 1e6);
  status(`מוריד את מנוע התמלול (פעם אחת בלבד) ${mb(loaded)}/${mb(total)}MB`, loaded / total);
};

async function getAudio() {
  if (S.audio) return S.audio;
  status('מחלץ את השמע מהסרטון…');
  S.audio = await extractAudio(S.file);
  return S.audio;
}

let runToken = 0;
function stopRun() {
  runToken++;
  if (S.running) transcriber.cancel();
  S.running = false;
  hideStatus();
  $('redoAll').disabled = false;
}
$('cancelRun').onclick = () => { stopRun(); renderList(); };

async function transcribeAll() {
  const token = ++runToken;
  const engine = ENGINES.find((e) => e.id === S.engine);
  if (engine.cloud && !S.key) { switchTab('text'); $('apiKey').focus(); toast(ERRORS.NO_KEY, true); return; }
  S.running = true;
  $('redoAll').disabled = true;
  S.words = [];
  rebuild();
  try {
    const audio = await getAudio();
    if (token !== runToken) return;
    status(engine.cloud ? 'שולח ל-ElevenLabs…' : 'טוען את מנוע התמלול…');
    await transcriber.run({
      audio, engine, language: S.language, key: S.key,
      onPiece: (words, done, total) => {
        if (token !== runToken) return;
        S.words.push(...words);
        rebuild();
        if (done < total) status(`מתמלל… ${done}/${total}`, total ? done / total : null);
      },
    });
    if (token !== runToken) return;
    if (!S.words.length) toast('לא נשמע דיבור בסרטון. אפשר לנסות שפה או מנוע אחר.', true);
  } catch (e) {
    if (token === runToken && e.message !== 'CANCELED') toast(errText(e), true);
  } finally {
    if (token === runToken) { S.running = false; hideStatus(); $('redoAll').disabled = false; renderList(); }
  }
}
$('redoAll').onclick = () => transcribeAll();

async function redoPage(pg, li) {
  if (S.running) { toast('מחכים שהתמלול הנוכחי יסתיים.'); return; }
  const engine = ENGINES.find((e) => e.id === S.engine);
  if (engine.cloud && !S.key) { $('apiKey').focus(); toast(ERRORS.NO_KEY, true); return; }
  const n = S.pages.indexOf(pg);
  const prevEnd = n > 0 ? S.words[S.pages[n - 1].idx.at(-1)].end : 0;
  const nextStart = S.pages[n + 1] ? S.words[S.pages[n + 1].idx[0]].start : video.duration || pg.end + 1;
  const from = Math.max(prevEnd, pg.start - 0.3), to = Math.min(nextStart, S.words[pg.idx.at(-1)].end + 0.3);
  li.classList.add('busy');
  S.running = true;
  const token = ++runToken;
  try {
    const audio = await getAudio();
    status('מתמלל שוב את הקטע…');
    const words = (await transcriber.run({ audio, engine, language: S.language, key: S.key, from, to })).filter((w) => w.start >= from - 0.05 && w.start < to);
    if (token !== runToken) return;
    if (words.length) {
      S.words.splice(pg.idx[0], pg.idx.length, ...words);
      S.words.sort((a, b) => a.start - b.start);
      toast('הקטע תומלל מחדש.');
    } else toast('לא נשמע דיבור בקטע הזה.');
  } catch (e) {
    if (e.message !== 'CANCELED') toast(errText(e), true);
  } finally {
    if (token === runToken) { S.running = false; hideStatus(); rebuild(); }
  }
}

// ---------- style controls ----------
function setStyle(k, v) {
  S.style = { ...S.style, [k]: v };
  store.set('style', S.style);
  if (k === 'wordsPerLine' || k === 'lines') rebuild();
  else S.pages.length && (S.renderState = {});
  if (k === 'font') ensureFont(S.style);
  syncControls();
}

const ranges = { speed: (v) => `×${(+v).toFixed(1)}`, size: (v) => v, stroke: (v) => v, shadow: (v) => v + '%', shadowBlur: (v) => v, shadowDist: (v) => v, posY: null };
for (const [k, f] of Object.entries(ranges)) {
  $(k).oninput = (e) => setStyle(k, +e.target.value);
}
for (const k of ['strokeColor', 'shadowColor']) $(k).oninput = (e) => setStyle(k, e.target.value);
for (const k of ['bg', 'upper']) $(k).onchange = (e) => setStyle(k, e.target.checked);
$('wplStep').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) setStyle('wordsPerLine', Math.min(8, Math.max(1, S.style.wordsPerLine + +b.dataset.d)));
};
$('linesSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) setStyle('lines', +b.dataset.v); };
$('resetStyle').onclick = () => { S.style = { ...DEFAULT_STYLE }; store.set('style', S.style); ensureFont(S.style); rebuild(); syncControls(); };

// Fonts
$('fonts').innerHTML = FONTS.map((f) => `<button data-font="${f.id}" style="font-family:'${f.id}';font-weight:${f.weight}" title="${f.id}">${f.label}</button>`).join('');
$('fonts').onclick = (e) => { const b = e.target.closest('button'); if (b) setStyle('font', b.dataset.font); };

// Colour swatches
const PALETTE = { color: ['#ffffff', '#ffe14d', '#111111', '#ff5c8a', '#5ce1e6'], hi: ['#ffe14d', '#7cff6b', '#ff5c8a', '#5ce1e6', '#ff8a3d', '#b18cff'] };
document.querySelectorAll('.swatches').forEach((box) => {
  const k = box.dataset.for;
  box.innerHTML = PALETTE[k].map((c) => `<button data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') + `<input type="color" aria-label="צבע אחר">`;
  box.onclick = (e) => { const b = e.target.closest('button'); if (b) setStyle(k, b.dataset.c); };
  box.querySelector('input').oninput = (e) => setStyle(k, e.target.value);
});

// Animation tiles, each with a live preview
const DEMO = (() => {
  const words = [];
  const txt = ['כך', 'זה', 'זז'];
  let t = 0.15;
  for (const w of txt) { words.push({ text: w, start: t, end: t + 0.4 }); t += 0.45; }
  words[2].end = 1.9; // hold the last word so the loop is rarely empty
  return { words, loop: 2.4 };
})();
$('anims').innerHTML = ANIMATIONS.map((a) => `<button class="anim" data-anim="${a.id}"><canvas width="240" height="160"></canvas><span>${a.label}</span></button>`).join('');
$('anims').onclick = (e) => { const b = e.target.closest('.anim'); if (b) setStyle('anim', b.dataset.anim); };
const tileStates = new Map();
function drawTiles(now) {
  if (!$('tab-style').hidden && !$('editor').hidden) {
    const t = (now / 1000) % DEMO.loop;
    for (const b of $('anims').children) {
      const c = b.querySelector('canvas'), ctx = c.getContext('2d');
      const st = { ...S.style, anim: b.dataset.anim, size: 21, posY: 0.5, wordsPerLine: 3, lines: 1 };
      const key = b.dataset.anim;
      if (!tileStates.has(key)) tileStates.set(key, { pages: buildPages(DEMO.words, st), state: {} });
      const ts = tileStates.get(key);
      ctx.clearRect(0, 0, c.width, c.height);
      drawCaptions(ctx, c.width, c.height, t, DEMO.words, ts.pages, st, ts.state);
    }
  }
  requestAnimationFrame(drawTiles);
}
requestAnimationFrame(drawTiles);

function syncControls() {
  const s = S.style;
  for (const [k, f] of Object.entries(ranges)) {
    $(k).value = s[k];
    if (f && $(k + 'Out')) $(k + 'Out').textContent = f(s[k]);
  }
  $('strokeColor').value = s.strokeColor;
  $('shadowColor').value = s.shadowColor;
  $('bg').checked = s.bg;
  $('upper').checked = s.upper;
  $('wplOut').textContent = s.wordsPerLine;
  document.querySelectorAll('#linesSeg button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === s.lines));
  document.querySelectorAll('#fonts button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.font === s.font));
  document.querySelectorAll('#anims .anim').forEach((b) => b.setAttribute('aria-pressed', b.dataset.anim === s.anim));
  document.querySelectorAll('.swatches').forEach((box) => {
    const v = s[box.dataset.for];
    box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c.toLowerCase() === v.toLowerCase()));
    box.querySelector('input').value = v;
  });
}
syncControls();
ensureFont(S.style);
document.fonts.ready.then(() => { S.renderState = {}; tileStates.forEach((v) => (v.state = {})); });

// Tabs
function switchTab(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
  $('tab-style').hidden = name !== 'style';
  $('tab-text').hidden = name !== 'text';
}
document.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); };

// ---------- export ----------
const menu = $('exportMenu');
$('exportBtn').onclick = (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  $('exportBtn').setAttribute('aria-expanded', !menu.hidden);
};
document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.menu-wrap')) { menu.hidden = true; $('exportBtn').setAttribute('aria-expanded', 'false'); } });
const baseName = () => (S.file?.name || 'video').replace(/\.[^.]+$/, '');

menu.onclick = async (e) => {
  const b = e.target.closest('[data-export]');
  if (!b) return;
  menu.hidden = true;
  if (!S.pages.length) { toast('עוד אין כתוביות לייצא.', true); return; }
  if (b.dataset.export === 'srt') {
    download(new Blob(['﻿' + toSRT(S.words, S.pages)], { type: 'text/plain;charset=utf-8' }), `${baseName()}.srt`);
    return;
  }
  if (typeof VideoEncoder === 'undefined') { toast(ERRORS.NO_ENCODER, true); return; }
  video.pause();
  $('exportModal').hidden = false;
  $('exportText').textContent = 'צורב את הכתוביות לתוך הסרטון…';
  $('exportBar').style.width = '0%';
  try {
    const blob = await exportVideo(S.file, video.videoWidth, video.videoHeight, S.words, S.pages, S.style, (p) => {
      $('exportBar').style.width = Math.round(p * 100) + '%';
      $('exportText').textContent = `צורב את הכתוביות לתוך הסרטון… ${Math.round(p * 100)}%`;
    });
    download(blob, `${baseName()}-kafitz.mp4`);
    toast('הסרטון מוכן והורד למחשב.');
  } catch (err) {
    if (err?.name !== 'ConversionCanceledError') toast(errText(err), true);
  } finally {
    $('exportModal').hidden = true;
  }
};
$('exportCancel').onclick = () => cancelExport();

// ---------- home demo ----------
const demoCanvas = $('demoCanvas');
const demoWords = (() => {
  const phrase = ['כתוביות', 'שקופצות', 'בדיוק', 'בקצב', 'של', 'הדיבור', 'שלכם'];
  const out = [];
  let t = 0.2;
  phrase.forEach((w, i) => { out.push({ text: w, start: t, end: t + 0.34 }); t += i === 2 ? 0.75 : 0.42; });
  return out;
})();
const demoAnims = ['pop', 'box', 'bounce', 'karaoke', 'punch', 'glow'];
let demoRaf = 0;
const demoState = {};
function demoFrame(now) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(demoCanvas.clientWidth * dpr), H = Math.round(demoCanvas.clientHeight * dpr);
  if (W && (demoCanvas.width !== W || demoCanvas.height !== H)) { demoCanvas.width = W; demoCanvas.height = H; }
  const loop = 4.2, k = Math.floor(now / 1000 / loop), t = (now / 1000) % loop;
  const anim = demoAnims[k % demoAnims.length];
  const style = { ...DEFAULT_STYLE, anim, size: 11, wordsPerLine: 4, lines: 2, posY: 0.62 };
  if (demoState.anim !== anim) { demoState.anim = anim; demoState.pages = buildPages(demoWords, style); demoState.r = {}; $('demoLabel').textContent = ANIMATIONS.find((a) => a.id === anim).label; }
  const ctx = demoCanvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  drawCaptions(ctx, W, H, t, demoWords, demoState.pages, style, demoState.r);
  demoRaf = requestAnimationFrame(demoFrame);
}
const stopDemo = () => cancelAnimationFrame(demoRaf);
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) demoRaf = requestAnimationFrame(demoFrame);
else { demoState.anim = 'pop'; requestAnimationFrame(() => { demoFrame(1600); stopDemo(); }); }
