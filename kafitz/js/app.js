import { ANIMATIONS, FONTS, DEFAULT_STYLE, buildPages, drawCaptions, pageAt, ensureFont } from './render.js';
import { ENGINES, LANGUAGES, Transcriber, extractAudio } from './transcribe.js';
import { exportVideo, cancelExport, toSRT, download } from './export.js';
import { mountStyle, renderCaptionList, editWords } from './ui.js';

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

function renderList() {
  $('pageCount').textContent = S.pages.length ? `(${S.pages.length})` : '';
  $('emptyList').hidden = S.pages.length > 0 || S.running;
  renderCaptionList($('captions'), {
    words: S.words, pages: S.pages, fmt,
    onSeek: (pg) => { video.currentTime = pg.start + 0.01; },
    onFocus: (pg) => { video.currentTime = pg.start + 0.01; video.pause(); },
    onCommit: (pg, raw) => { if (editWords(S.words, pg, raw)) setTimeout(rebuild); },
    onDelete: (pg) => { S.words.splice(pg.idx[0], pg.idx.length); rebuild(); },
    onRedo: redoPage,
  });
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

const syncControls = mountStyle($('tab-style'), {
  getStyle: () => S.style,
  setStyle,
  reset: (style) => { S.style = style; store.set('style', S.style); ensureFont(S.style); rebuild(); syncControls(); },
  isVisible: () => !$('tab-style').hidden && !$('editor').hidden,
});
syncControls();
ensureFont(S.style);
document.fonts.ready.then(() => { S.renderState = {}; });

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
