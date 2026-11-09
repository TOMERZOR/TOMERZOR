// Premiere Pro panel. Runs inside an iframe served by premiere/server.js; talks to Premiere through the
// parent page (bootstrap.html), which forwards calls to host/kafitz.jsx.
import { DEFAULT_STYLE, buildPages, drawCaptions, pageAt, ensureFont } from '../js/render.js';
import { ENGINES, LANGUAGES, Transcriber, extractAudio } from '../js/transcribe.js';
import { toSRT } from '../js/export.js';
import { mountStyle, renderCaptionList, editWords } from '../js/ui.js';

const $ = (id) => document.getElementById(id);
const TOKEN = new URLSearchParams(location.hash.slice(1)).get('t') || '';
const store = {
  get(k, d) { try { const v = localStorage.getItem('kafitz.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kafitz.' + k, JSON.stringify(v)); } catch {} },
};

// ---------- Premiere bridge ----------
let callId = 0;
const waiting = new Map();
window.addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data) return;
  const done = waiting.get(e.data.id);
  if (done) { waiting.delete(e.data.id); done(e.data.result); }
});
function host(fn, ...args) {
  return new Promise((resolve, reject) => {
    const id = ++callId;
    waiting.set(id, (raw) => {
      let res;
      try { res = JSON.parse(raw); } catch { reject(new Error('HOST')); return; }
      res.ok ? resolve(res.data) : reject(new Error(res.error));
    });
    window.parent.postMessage({ id, fn, args }, '*');
  });
}

// ---------- local server ----------
const mediaURL = (p) => `/api/media?t=${TOKEN}&p=${encodeURIComponent(p)}`;
async function writeFile(p, blob) {
  const r = await fetch(`/api/write?p=${encodeURIComponent(p)}`, { method: 'PUT', headers: { 'x-kafitz-token': TOKEN }, body: blob });
  if (!r.ok) throw new Error('WRITE');
}
let sys = { sep: '/', home: '', outDir: 'Kafitz Captions' };
fetch(`/api/info?t=${TOKEN}`).then((r) => r.json()).then((j) => (sys = j)).catch(() => {});
const join = (...parts) => parts.join(sys.sep).replace(/[\\/]+/g, sys.sep);
const dirname = (p) => p.replace(/[\\/][^\\/]*$/, '');
const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 60) || 'sequence';

// ---------- state ----------
const S = {
  seq: null,
  clips: [],
  words: [],
  pages: [],
  style: { ...DEFAULT_STYLE, ...store.get('style', {}) },
  engine: store.get('engine', 'balanced'),
  language: store.get('language', 'hebrew'),
  key: store.get('key', ''),
  running: false,
  renderState: {},
  t: 0,
  playing: false,
};
const transcriber = new Transcriber();
const audioCache = new Map();
const video = $('video'), overlay = $('overlay'), octx = overlay.getContext('2d');

const fmt = (s) => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
let toastTimer;
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), err ? 7000 : 3500);
}
const ERRORS = {
  NO_SEQUENCE: 'אין סיקוונס פתוח בפרימייר.',
  NO_AUDIO: 'לא נמצא שמע באחד הקליפים.',
  CANT_DECODE: 'לא הצלחתי לפענח את השמע של הקליפ. נסו קובץ MP4 או WAV.',
  NO_KEY: 'כדי לתמלל עם ElevenLabs צריך להדביק מפתח API בלשונית טקסט.',
  BAD_KEY: 'מפתח ה-ElevenLabs לא התקבל.',
  IMPORT_FAILED: 'פרימייר לא הצליח לייבא את הכתוביות.',
  IMPORT_NOT_FOUND: 'הכתוביות יובאו לבין Kafitz אבל לא מצאתי אותן כדי לשים בטיימליין. גררו אותן ידנית.',
  NO_FREE_TRACK: 'אין ערוץ וידאו פנוי מעל הקליפים. הוסיפו ערוץ ריק ונסו שוב.',
  CAPTION_TRACK: 'קובץ ה-SRT יובא לבין Kafitz. גררו אותו לטיימליין כדי ליצור ערוץ כתוביות.',
  WRITE: 'לא הצלחתי לשמור את הקבצים בתיקייה של הפרויקט.',
  HOST: 'פרימייר לא ענה. נסו לסגור ולפתוח את הפאנל.',
};
const errText = (e) => ERRORS[e?.message] || `משהו השתבש: ${e?.message || e}`;

// ---------- sequence ----------
const placedKey = () => 'placed.' + (S.seq?.id || '');
async function refreshSeq() {
  try {
    S.seq = await host('info');
  } catch (e) {
    S.seq = null;
    if (e.message !== 'NO_SEQUENCE') toast(errText(e), true);
  }
  $('noSeq').hidden = !!S.seq;
  $('main').hidden = $('foot').hidden = !S.seq;
  if (!S.seq) { $('seqName').textContent = 'קפיץ'; $('seqMeta').textContent = 'אין סיקוונס פתוח'; return; }
  $('seqName').textContent = S.seq.name;
  $('seqMeta').innerHTML = `<bdi dir="ltr">${S.seq.width}×${S.seq.height}</bdi> · <bdi dir="ltr">${+S.seq.fps.toFixed(3)} fps</bdi>`;
  $('placeLabel').textContent = placedState().items.length ? 'עדכון הכתוביות בטיימליין' : 'הוספה לטיימליין';
  fitStage();
}
$('refresh').onclick = refreshSeq;

function fitStage() {
  if (!S.seq) return;
  const st = $('stage');
  const w = S.seq.width, h = S.seq.height;
  st.style.aspectRatio = `${w} / ${h}`;
  const col = st.parentElement.clientWidth;
  const maxH = window.innerHeight * 0.42;
  st.style.width = Math.min(col, (maxH * w) / h) + 'px';
  st.style.margin = '0 auto';
}
window.addEventListener('resize', fitStage);

// ---------- preview ----------
const clipAt = (t) => S.clips.find((c) => t >= c.start && t < c.end);
function syncVideo(force = false) {
  const c = clipAt(S.t);
  if (!c || c.kind === 'audio') { video.style.opacity = 0; if (!video.paused) video.pause(); return; }
  video.style.opacity = 1;
  if (video.dataset.path !== c.path) { video.dataset.path = c.path; video.src = mediaURL(c.path); }
  const target = c.inPoint + (S.t - c.start);
  if (force || Math.abs(video.currentTime - target) > 0.3) video.currentTime = target;
  if (S.playing && video.paused) video.play().catch(() => {});
  if (!S.playing && !video.paused) video.pause();
}

let playFrom = 0, playAt = 0;
function setPlaying(on) {
  S.playing = on;
  video.muted = !on;
  if (on) { playFrom = S.t; playAt = performance.now(); }
  $('playBtn').innerHTML = `<i class="ph-fill ${on ? 'ph-pause' : 'ph-play'}"></i>`;
  syncVideo(true);
}
$('playBtn').onclick = () => setPlaying(!S.playing);

let lastNow = null;
function tick(now) {
  if (S.seq) {
    if (S.playing) {
      S.t = playFrom + (now - playAt) / 1000;
      const end = S.pages.length ? S.pages[S.pages.length - 1].end + 0.5 : 0;
      if (S.t > end && end) setPlaying(false);
      syncVideo();
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(overlay.clientWidth * dpr), H = Math.round(overlay.clientHeight * dpr);
    if (overlay.width !== W || overlay.height !== H) { overlay.width = W; overlay.height = H; }
    octx.clearRect(0, 0, W, H);
    if (S.pages.length && W && H) drawCaptions(octx, W, H, S.t, S.words, S.pages, S.style, S.renderState);
    $('time').textContent = fmt(S.t);
    const pg = pageAt(S.pages, S.t);
    const n = pg ? S.pages.indexOf(pg) : -1;
    if (n !== lastNow) {
      lastNow = n;
      document.querySelectorAll('.cap.now').forEach((el) => el.classList.remove('now'));
      $('captions').children[n]?.classList.add('now');
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Follow Premiere's playhead while the panel isn't playing.
let lastHead = null, polling = false;
setInterval(async () => {
  if (polling || S.playing || !S.seq || !$('follow').checked || document.hidden) return;
  polling = true;
  try {
    const head = await host('playhead');
    if (head.id !== S.seq.id) await refreshSeq();
    else if (lastHead === null || Math.abs(head.t - lastHead) > 0.001) { lastHead = head.t; S.t = head.t; syncVideo(true); }
  } catch {}
  polling = false;
}, 300);

function seekTo(t) {
  S.t = t;
  lastHead = t;
  syncVideo(true);
  host('seek', t).catch(() => {});
}

// Drag the caption to move it; click to play.
let drag = null;
overlay.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, moved: false }; overlay.setPointerCapture(e.pointerId); });
overlay.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
  if (drag.moved) {
    const r = overlay.getBoundingClientRect();
    setStyle('posY', Math.min(0.95, Math.max(0.08, (e.clientY - r.top) / r.height)));
  }
});
overlay.addEventListener('pointerup', () => { if (drag && !drag.moved) setPlaying(!S.playing); drag = null; });

// ---------- captions ----------
function rebuild() {
  S.pages = buildPages(S.words, S.style);
  S.renderState = {};
  lastNow = null;
  $('pageCount').textContent = S.pages.length ? `(${S.pages.length})` : '';
  $('emptyList').hidden = S.pages.length > 0 || S.running;
  renderCaptionList($('captions'), {
    words: S.words, pages: S.pages, fmt,
    onSeek: (pg) => seekTo(pg.start + 0.01),
    onFocus: (pg) => { setPlaying(false); seekTo(pg.start + 0.01); },
    onCommit: (pg, raw) => { if (editWords(S.words, pg, raw)) setTimeout(rebuild); },
    onDelete: (pg) => { S.words.splice(pg.idx[0], pg.idx.length); rebuild(); },
    onRedo: redoPage,
  });
}

// ---------- transcription ----------
fillSelect($('lang'), LANGUAGES, S.language);
fillSelect($('engine'), ENGINES, S.engine);
$('apiKey').value = S.key;
function fillSelect(sel, items, value) { sel.innerHTML = items.map((i) => `<option value="${i.id}">${i.label}</option>`).join(''); sel.value = value; }
function syncEngineUI() {
  const e = ENGINES.find((x) => x.id === S.engine) || ENGINES[1];
  $('engineNote').textContent = e.note;
  $('keyField').hidden = !e.cloud;
}
syncEngineUI();
$('lang').onchange = (e) => { S.language = e.target.value; store.set('language', S.language); };
$('engine').onchange = (e) => { S.engine = e.target.value; store.set('engine', S.engine); syncEngineUI(); };
$('apiKey').onchange = (e) => { S.key = e.target.value.trim(); store.set('key', S.key); };

function status(text, frac) {
  $('status').hidden = false;
  $('statusText').textContent = text;
  $('statusBar').parentElement.classList.toggle('indeterminate', frac == null);
  $('statusBar').style.width = frac == null ? '' : Math.round(frac * 100) + '%';
}
const hideStatus = () => ($('status').hidden = true);
transcriber.onDownload = (loaded, total) => {
  if (S.running) status(`מוריד את מנוע התמלול (פעם אחת בלבד) ${Math.round(loaded / 1e6)}/${Math.round(total / 1e6)}MB`, loaded / total);
};

async function audioOf(path) {
  if (!audioCache.has(path)) audioCache.set(path, await extractAudio(mediaURL(path)));
  return audioCache.get(path);
}

let runToken = 0;
function stopRun() {
  runToken++;
  if (S.running) transcriber.cancel();
  S.running = false;
  hideStatus();
  $('transcribe').disabled = false;
}
$('cancelRun').onclick = () => { stopRun(); rebuild(); };

// Transcribes each clip's used part and moves the words onto the sequence's timeline.
async function transcribeClip(c, engine, from, to, onWords) {
  const audio = await audioOf(c.path);
  const offset = c.start - c.inPoint;
  return transcriber.run({
    audio, engine, language: S.language, key: S.key, from, to,
    onPiece: (words, done, total) => onWords(words.map((w) => ({ ...w, start: w.start + offset, end: w.end + offset })), done, total),
  });
}

async function transcribeAll() {
  const token = ++runToken;
  const engine = ENGINES.find((e) => e.id === S.engine);
  if (engine.cloud && !S.key) { switchTab('text'); $('apiKey').focus(); toast(ERRORS.NO_KEY, true); return; }
  S.running = true;
  $('transcribe').disabled = true;
  try {
    status('קורא את הקליפים מהטיימליין…');
    const { clips, selected } = await host('clips');
    if (!clips.length) { toast('לא מצאתי קליפים. סמנו קליפים בטיימליין או שימו אותם על A1.', true); return; }
    const count = clips.length === 1 ? 'קליפ אחד' : `${clips.length} קליפים`;
    $('clipNote').textContent = selected ? `מתמלל ${count} מסומנים.` : `מתמלל ${count} מ-A1/V1 (לא היה סימון).`;
    S.clips = clips;
    S.words = [];
    rebuild();
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      if (token !== runToken) return;
      status(`מחלץ שמע (${i + 1}/${clips.length})…`);
      try {
        await transcribeClip(c, engine, c.inPoint, c.inPoint + (c.end - c.start), (words, done, total) => {
          if (token !== runToken) return;
          S.words.push(...words);
          S.words.sort((a, b) => a.start - b.start);
          rebuild();
          status(`מתמלל קליפ ${i + 1}/${clips.length}… ${done}/${total}`, total ? (i + done / total) / clips.length : null);
        });
      } catch (e) {
        if (e.message === 'CANCELED' || e.message === 'NO_KEY' || e.message === 'BAD_KEY') throw e;
        toast(`${c.name}: ${errText(e)}`, true);
      }
    }
    if (token === runToken && !S.words.length) toast('לא נשמע דיבור. אפשר לנסות שפה או מנוע אחר.', true);
  } catch (e) {
    if (token === runToken && e.message !== 'CANCELED') toast(errText(e), true);
  } finally {
    if (token === runToken) { S.running = false; hideStatus(); $('transcribe').disabled = false; rebuild(); }
  }
}
$('transcribe').onclick = () => transcribeAll();

async function redoPage(pg, li) {
  if (S.running) { toast('מחכים שהתמלול הנוכחי יסתיים.'); return; }
  const engine = ENGINES.find((e) => e.id === S.engine);
  if (engine.cloud && !S.key) { $('apiKey').focus(); toast(ERRORS.NO_KEY, true); return; }
  const n = S.pages.indexOf(pg);
  const first = S.words[pg.idx[0]], last = S.words[pg.idx[pg.idx.length - 1]];
  const c = clipAt(first.start) || clipAt(first.start + 0.05);
  if (!c) { toast('הקטע לא נמצא באף קליפ.', true); return; }
  const prevEnd = n > 0 ? S.words[S.pages[n - 1].idx.at(-1)].end : c.start;
  const nextStart = S.pages[n + 1] ? S.words[S.pages[n + 1].idx[0]].start : c.end;
  const t0 = Math.max(prevEnd, first.start - 0.3, c.start), t1 = Math.min(nextStart, last.end + 0.3, c.end);
  const toSrc = (t) => c.inPoint + (t - c.start);
  li.classList.add('busy');
  S.running = true;
  const token = ++runToken;
  try {
    status('מתמלל שוב את הקטע…');
    const words = [];
    await transcribeClip(c, engine, toSrc(t0), toSrc(t1), (w) => words.push(...w));
    if (token !== runToken) return;
    const fresh = words.filter((w) => w.start >= t0 - 0.05 && w.start < t1);
    if (fresh.length) {
      S.words.splice(pg.idx[0], pg.idx.length, ...fresh);
      S.words.sort((a, b) => a.start - b.start);
      toast('הקטע תומלל מחדש.');
    } else toast('לא נשמע דיבור בקטע הזה.');
  } catch (e) {
    if (e.message !== 'CANCELED') toast(errText(e), true);
  } finally {
    if (token === runToken) { S.running = false; hideStatus(); rebuild(); }
  }
}

// ---------- style ----------
function setStyle(k, v) {
  S.style = { ...S.style, [k]: v };
  store.set('style', S.style);
  if (k === 'wordsPerLine' || k === 'lines') rebuild();
  else S.renderState = {};
  if (k === 'font') ensureFont(S.style);
  syncControls();
}
const syncControls = mountStyle($('tab-style'), {
  getStyle: () => S.style,
  setStyle,
  reset: (style) => { S.style = style; store.set('style', S.style); ensureFont(S.style); rebuild(); syncControls(); },
  isVisible: () => !$('tab-style').hidden && !$('main').hidden,
});
syncControls();
ensureFont(S.style);
document.fonts.ready.then(() => { S.renderState = {}; });

function switchTab(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
  $('tab-style').hidden = name !== 'style';
  $('tab-text').hidden = name !== 'text';
}
document.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) switchTab(b.dataset.tab); };

// ---------- to the timeline ----------
function outRoot() {
  const proj = S.seq?.projectPath;
  return proj ? join(dirname(proj), sys.outDir) : join(sys.home, 'Documents', sys.outDir);
}

let cancelRender = false;
$('renderCancel').onclick = () => { cancelRender = true; };

// What's on the timeline for each sequence: the track, and one clip per caption with a signature of
// its words, timing and style. An update re-renders only captions whose signature changed.
function placedState() {
  const v = store.get(placedKey(), null);
  if (typeof v === 'string') return { track: -1, items: [{ sig: '', id: v }] }; // one combined clip from version 1
  return v || { track: -1, items: [] };
}
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const captionName = (pg) => pg.lines.map((line) => line.map((i) => S.words[i].text).join(' ')).join(' / ');

// Draws one caption, every frame from its start to its end, as a transparent PNG sequence.
async function renderCaption(pg, sig, dir, canvas, ctx, onFrame) {
  const { width: W, height: H, fps } = S.seq;
  const startF = Math.round(pg.start * fps);
  const endF = Math.max(startF + 1, Math.round(pg.end * fps));
  const file = (f) => join(dir, `c_${sig}`, `k_${sig}_${String(f - startF).padStart(5, '0')}.png`);
  const state = {};
  const inFlight = new Set();
  for (let f = startF; f < endF; f++) {
    if (cancelRender) throw new Error('CANCELED');
    ctx.clearRect(0, 0, W, H);
    drawCaptions(ctx, W, H, f / fps, S.words, S.pages, S.style, state);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const p = writeFile(file(f), blob).finally(() => inFlight.delete(p));
    inFlight.add(p);
    if (inFlight.size >= 6) await Promise.race(inFlight);
    onFrame();
  }
  await Promise.all(inFlight);
  return { file: file(startF), start: startF / fps, end: endF / fps, name: captionName(pg), frames: endF - startF };
}

async function placeOnTimeline() {
  if (!S.pages.length) { toast('עוד אין כתוביות. קודם מתמללים.', true); return; }
  await refreshSeq();
  if (!S.seq) return;
  setPlaying(false);
  const { width: W, height: H, fps } = S.seq;
  await ensureFont(S.style);
  const styleKey = JSON.stringify(S.style) + `|${W}x${H}@${fps}`;
  const wanted = S.pages.map((pg) => {
    const words = pg.idx.map((i) => S.words[i]);
    return { pg, sig: hash(styleKey + JSON.stringify(pg.lines.map((l) => l.length)) + JSON.stringify(words.map((w) => [w.text, Math.round(w.start * 1000), Math.round(w.end * 1000)])) + pg.start.toFixed(3) + pg.end.toFixed(3)) };
  });
  const prev = placedState();
  // Captions deleted by hand in Premiere get drawn again.
  if (prev.items.length) {
    const alive = new Set(await host('present', prev.items.map((it) => it.id)).catch(() => prev.items.map((it) => it.id)));
    prev.items = prev.items.filter((it) => alive.has(it.id));
  }
  const prevSigs = new Set(prev.items.map((it) => it.sig));
  const wantedSigs = new Set(wanted.map((w) => w.sig));
  const keep = prev.items.filter((it) => wantedSigs.has(it.sig));
  const remove = prev.items.filter((it) => !wantedSigs.has(it.sig)).map((it) => it.id);
  const todo = wanted.filter((w) => !prevSigs.has(w.sig));
  if (!todo.length && !remove.length) { toast('הכתוביות בטיימליין כבר מעודכנות.'); return; }

  const dir = join(outRoot(), safeName(S.seq.name));
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const totalFrames = todo.reduce((n, w) => n + Math.max(1, Math.round(w.pg.end * fps) - Math.round(w.pg.start * fps)), 0);
  let done = 0;
  cancelRender = false;
  $('renderModal').hidden = false;
  $('renderTitle').textContent = todo.length === 1 ? 'מכין כתובית אחת' : `מכין ${todo.length} כתוביות`;
  $('renderBar').style.width = '0%';
  try {
    const items = [];
    for (const w of todo) {
      const item = await renderCaption(w.pg, w.sig, dir, canvas, ctx, () => {
        if (++done % 10 === 0) {
          const k = done / totalFrames;
          $('renderBar').style.width = Math.round(k * 100) + '%';
          $('renderText').textContent = `מצייר… ${Math.round(k * 100)}%`;
        }
      });
      items.push({ ...item, sig: w.sig });
    }
    $('renderTitle').textContent = 'מוסיף לטיימליין';
    $('renderText').textContent = 'פרימייר מייבא את הכתוביות…';
    $('renderBar').style.width = '100%';
    const res = await host('placeCaptions', items.map(({ file, start, end, name }) => ({ file, start, end, name })), fps, remove, prev.track, safeName(S.seq.name));
    const placed = items.map((it, k) => ({ sig: it.sig, id: res.ids[k] }));
    store.set(placedKey(), { track: res.track, items: [...keep, ...placed] });
    $('placeLabel').textContent = 'עדכון הכתוביות בטיימליין';
    const n = (k) => (k === 1 ? 'כתובית אחת' : `${k} כתוביות`);
    if (!keep.length) toast(`נוספו ${n(items.length)} כקליפים נפרדים בערוץ V${res.track + 1}.`);
    else if (!items.length) toast(`הוסרו ${n(remove.length)} מהטיימליין.`);
    else toast(`${items.length === 1 ? 'עודכנה' : 'עודכנו'} ${n(items.length)}. ${keep.length === 1 ? 'השאר' : `${keep.length} האחרות`} נשארו כמו שהן.`);
  } catch (e) {
    if (e.message !== 'CANCELED') toast(errText(e), true);
  } finally {
    $('renderModal').hidden = true;
  }
}
$('place').onclick = placeOnTimeline;

$('srt').onclick = async () => {
  if (!S.pages.length) { toast('עוד אין כתוביות. קודם מתמללים.', true); return; }
  try {
    await refreshSeq();
    const file = join(outRoot(), `${safeName(S.seq.name)}-${Date.now().toString(36)}.srt`);
    await writeFile(file, new Blob(['﻿' + toSRT(S.words, S.pages)], { type: 'text/plain' }));
    await host('captions', file);
    toast('נוסף ערוץ כתוביות של פרימייר.');
  } catch (e) {
    toast(errText(e), true);
  }
};

refreshSeq();
