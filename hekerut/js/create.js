// The full-screen maker, Instagram-style.
//   Story: the camera (shutter and gallery) or "Aa" for text on a color. Then text you can
//   drag, recolor, resize, or drag onto the trash; the photo itself can be dragged to frame it.
//   What you see is burned into one image, so the story looks the same for everyone.
//   Post: pick a photo and frame it (1:1, 4:5 or its own shape), pick a filter, write a caption.

import { icon } from './icons.js';
import { FILTERS, filterCss, applyFilter, toJpeg } from './imagefx.js';
import { BERETS, beretOf, serviceClock, CORPS, prettyLevel } from './core.js';

const SW = 720, SH = 1280;
const BGS = [
  ['#f0cf8e', '#d39a54', '#7f8f4a'], ['#2b2a24', '#0c0c0b'], ['#8e9b5a', '#3f4b2a'],
  ['#d97a5a', '#8c3e4c'], ['#7c8aa0', '#2c3548'], ['#c9a6e8', '#6a4fb0'], ['#5ac8fa', '#1d4e89'],
];
const COLORS = ['#ffffff', '#111111', '#f0cf8e', '#d39a54', '#8e9b5a', '#ff5a5f', '#5ac8fa', '#c9a6e8'];
const ASPECTS = [[1, 'ריבוע'], [0.8, '4:5'], ['orig', 'מקורי']];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const light = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; };
const gradCss = i => `linear-gradient(150deg, ${BGS[i].join(', ')})`;

let ctx = null, el = null, s = null;

export const creatorOpen = () => !!el;

// context: { api, sess, me, toast, haptic, avatar, errorText, onPosted(post), onStory() }
export function openCreator(context, mode = 'story', { pick = false, sticker = '' } = {}) {
  closeCreator(true);
  ctx = context;
  el = document.createElement('div');
  el.className = 'creator';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  document.body.append(el);
  document.body.classList.add('no-scroll');
  s = { mode, step: mode === 'post' ? 'pick' : 'camera', facing: 'environment', stream: null, urls: [],
    src: null, srcUrl: '', ox: 0.5, oy: 0.5, bg: 0, texts: [], editing: null,
    pimg: null, purl: '', aspect: 1, pox: 0.5, poy: 0.5, filter: 'normal', caption: '', thumb: '' };
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onChange);
  el.addEventListener('pointerdown', onDown);
  // Opened from a milestone: straight to a story with its sticker on it.
  if (sticker && mode === 'story') { const st = stickers().find(x => x.id === sticker) || stickers()[0]; if (st) Object.assign(s, { step: 'edit', texts: [placed(st)] }); }
  draw();
  requestAnimationFrame(() => el?.classList.add('open'));
  // Opened from "new post": go straight to the photo picker, as the tap still counts as the user's.
  if (mode === 'post' && pick) el.querySelector('[data-cr-file]')?.click();
}

export function closeCreator(instant = false) {
  if (!el) return;
  stopCamera();
  s.urls.forEach(u => URL.revokeObjectURL(u));
  const node = el;
  el = null;
  s = null;
  document.body.classList.remove('no-scroll');
  if (instant) return node.remove();
  node.classList.remove('open');
  setTimeout(() => node.remove(), 320);
}

// ---------- Drawing ----------

function draw() {
  if (!el) return;
  const st = s.step;
  if (st === 'camera') drawCamera();
  else if (st === 'edit') drawEdit();
  else if (st === 'pick') drawPick();
  else if (st === 'filter') drawFilter();
  else if (st === 'caption') drawCaption();
  el.dataset.step = st;
}

const modes = () => `<div class="cr-modes" role="tablist">
  <button role="tab" class="${s.mode === 'post' ? 'on' : ''}" data-cr-mode="post">פוסט</button>
  <button role="tab" class="${s.mode === 'story' ? 'on' : ''}" data-cr-mode="story">סטורי</button>
</div>`;

function drawCamera() {
  el.innerHTML = `
    <div class="cr-stage cam">
      <video class="cr-video ${s.facing === 'user' ? 'mirror' : ''}" playsinline muted autoplay></video>
      <div class="cr-nocam hidden">${icon('camera')}<b>אין גישה למצלמה</b><p>אפשר לבחור תמונה מהגלריה, או ליצור סטורי טקסט עם Aa.</p></div>
      <div class="cr-flash"></div>
    </div>
    <div class="cr-top"><button class="cr-ic" data-cr="close" aria-label="סגירה">${icon('close')}</button></div>
    <div class="cr-side"><button class="cr-tool" data-cr="create"><span class="aa">Aa</span><small>טקסט</small></button></div>
    <div class="cr-bottom">
      <label class="cr-gallery" aria-label="גלריה">${icon('image')}<input type="file" accept="image/*" data-cr-file hidden></label>
      <button class="shutter" data-cr="shoot" aria-label="צילום"><span></span></button>
      <span class="cr-spacer"></span>
    </div>
    ${modes()}`;
  startCamera();
}

function photoStyle(ox, oy) { return `object-position:${(ox * 100).toFixed(2)}% ${(oy * 100).toFixed(2)}%`; }

function textHtml(t) {
  if (t.kind === 'sticker') {
    const st = t.variant === 'patch'
      ? `--bc:${t.color};color:${t.fg}`
      : `background:${t.color};color:${t.fg}`;
    return `<div class="cr-text sticker ${t.variant} ${t.camo ? 'camo' : ''}" data-tid="${t.id}" style="left:${t.x * 100}%;top:${t.y * 100}%;font-size:${(t.size * 100).toFixed(2)}cqw;${st}">${t.variant === 'patch' ? `<b>${esc(t.t)}</b><small>${esc(t.sub || '')}</small>` : esc(t.t)}</div>`;
  }
  const box = t.box ? `background:${t.color};color:${light(t.color) ? '#111' : '#fff'}` : `color:${t.color}`;
  return `<div class="cr-text ${t.box ? 'box' : ''} ${t.id === s.editing ? 'is-editing' : ''}" data-tid="${t.id}" style="left:${t.x * 100}%;top:${t.y * 100}%;font-size:${(t.size * 100).toFixed(2)}cqw;${box}">${esc(t.t).replace(/\n/g, '<br>')}</div>`;
}

function drawEdit() {
  el.innerHTML = `
    <div class="cr-stage edit" data-cr-stage style="${s.src ? '' : `background:${gradCss(s.bg)}`}">
      ${s.src ? `<img class="cr-photo" src="${s.srcUrl}" alt="" style="${photoStyle(s.ox, s.oy)}" draggable="false">` : ''}
      <div class="cr-texts">${s.texts.map(textHtml).join('')}</div>
      <div class="cr-trash">${icon('trash')}</div>
      ${!s.src && !s.texts.length ? '<button class="cr-tap-hint" data-cr="add-text">הקישו כדי לכתוב</button>' : ''}
    </div>
    <div class="cr-top">
      <button class="cr-ic" data-cr="retake" aria-label="חזרה">${icon('back')}</button>
      <div class="cr-tools">
        ${s.src ? '' : `<button class="cr-ic" data-cr="bg" aria-label="רקע"><span class="bg-dot" style="background:${gradCss(s.bg)}"></span></button>`}
        <button class="cr-ic" data-cr="stickers" aria-label="מדבקות">${icon('sparkle')}</button>
        <button class="cr-ic" data-cr="add-text" aria-label="טקסט"><span class="aa">Aa</span></button>
      </div>
    </div>
    <div class="cr-send">
      <button class="cr-share" data-cr="share-story">${ctx.avatar(ctx.me, 's')}<span>הסטורי שלך</span></button>
      <button class="cr-go" data-cr="share-story" aria-label="שיתוף">${icon('back')}</button>
    </div>
    ${s.editing ? textEditorHtml() : ''}
    ${s.picking ? stickerTrayHtml() : ''}`;
  if (s.editing) {
    const ta = el.querySelector('.te-field textarea');
    ta?.focus();
    ta?.setSelectionRange(ta.value.length, ta.value.length);
  }
}

function textEditorHtml() {
  const t = s.texts.find(x => x.id === s.editing);
  const style = t.box ? `background:${t.color};color:${light(t.color) ? '#111' : '#fff'}` : `color:${t.color}`;
  return `<div class="cr-texted">
    <div class="te-top">
      <button class="te-box ${t.box ? 'on' : ''}" data-te="box" aria-label="רקע לטקסט"><span>A</span></button>
      <button class="te-done" data-te="done">סיום</button>
    </div>
    <div class="te-field"><textarea rows="2" dir="auto" maxlength="160" style="font-size:${(t.size * 100).toFixed(2)}cqw;${style}" placeholder="כתבו משהו...">${esc(t.t)}</textarea></div>
    <input class="te-size" type="range" min="0.05" max="0.15" step="0.005" value="${t.size}" aria-label="גודל">
    <div class="te-colors">${COLORS.map(c => `<button class="${c === t.color ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="צבע"></button>`).join('')}</div>
  </div>`;
}

function aspectOf() {
  if (s.aspect !== 'orig' || !s.pimg) return s.aspect === 'orig' ? 1 : s.aspect;
  return clamp(s.pimg.naturalWidth / s.pimg.naturalHeight, 0.8, 1.91);
}

function head(back, title, next, nextLabel, disabled = false) {
  return `<header class="cr-head">
    <button class="cr-ic" data-cr="${back}" aria-label="${back === 'close' ? 'סגירה' : 'חזרה'}">${icon(back === 'close' ? 'close' : 'back')}</button>
    <b>${title}</b>
    <button class="cr-next" data-cr="${next}" ${disabled ? 'disabled' : ''}>${nextLabel}</button>
  </header>`;
}

function frameHtml({ filter = 'normal', pan = true } = {}) {
  return `<div class="pp-frame ${pan ? 'pan' : ''}" style="aspect-ratio:${aspectOf()}" ${pan ? 'data-cr-pan' : ''}>
    <img src="${s.purl}" alt="" draggable="false" style="${photoStyle(s.pox, s.poy)};filter:${filterCss(filter)}">
    ${pan ? '<span class="pp-grid"></span>' : ''}
  </div>`;
}

function drawPick() {
  el.innerHTML = `
    ${head('close', 'פוסט חדש', 'to-filter', 'הבא', !s.pimg)}
    <div class="pp-body">
      ${s.pimg ? `<div class="pp-wrap">${frameHtml()}<button class="pp-aspect" data-cr="aspect">${icon('scan')}<span>${ASPECTS.find(a => a[0] === s.aspect)[1]}</span></button></div>`
        : `<label class="pp-empty">${icon('image')}<b>בחרו תמונה</b><small>מהגלריה או מהמצלמה</small><input type="file" accept="image/*" data-cr-file hidden></label>`}
      <div class="pp-actions">
        <label class="pp-btn">${icon('image')}<span>גלריה</span><input type="file" accept="image/*" data-cr-file hidden></label>
        <label class="pp-btn">${icon('camera')}<span>מצלמה</span><input type="file" accept="image/*" capture="environment" data-cr-file hidden></label>
      </div>
      ${s.pimg ? '<p class="pp-hint">גררו את התמונה כדי למקם אותה</p>' : ''}
    </div>
    ${modes()}`;
}

function drawFilter() {
  el.innerHTML = `
    ${head('to-pick', 'עריכה', 'to-caption', 'הבא')}
    <div class="pp-body">
      <div class="pp-wrap">${frameHtml({ filter: s.filter, pan: false })}</div>
      <div class="filters">${FILTERS.map(f => `<button class="flt ${f.id === s.filter ? 'on' : ''}" data-flt="${f.id}"><small>${f.name}</small><span style="background-image:url(${s.thumb});filter:${filterCss(f.id)}"></span></button>`).join('')}</div>
    </div>`;
  el.querySelector('.flt.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function drawCaption() {
  el.innerHTML = `
    ${head('to-filter', 'פוסט חדש', 'share-post', 'שיתוף')}
    <div class="pc-body">
      <div class="pc-row">
        <div class="pc-thumb" style="aspect-ratio:${aspectOf()}"><img src="${s.purl}" alt="" style="${photoStyle(s.pox, s.poy)};filter:${filterCss(s.filter)}"></div>
        <textarea class="pc-caption" data-cr-caption maxlength="500" rows="5" placeholder="כתבו כיתוב...">${esc(s.caption)}</textarea>
      </div>
      <p class="pc-note">${icon('eye')}<span>יראו את הפוסט מי שאת/ה עוקב/ת אחריו ומי שהכרת (סרקו את הקוד)</span></p>
    </div>`;
  el.querySelector('.pc-caption')?.focus();
}

// ---------- Camera ----------

async function startCamera() {
  const video = el.querySelector('.cr-video');
  stopCamera();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: s.facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
    if (!el || s.step !== 'camera' || !el.contains(video)) { stream.getTracks().forEach(t => t.stop()); return; }
    s.stream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});
  } catch {
    el?.querySelector('.cr-nocam')?.classList.remove('hidden');
    el?.querySelector('.shutter')?.setAttribute('disabled', '');
  }
}

function stopCamera() {
  s?.stream?.getTracks().forEach(t => t.stop());
  if (s) s.stream = null;
}

function shoot() {
  const video = el.querySelector('.cr-video');
  if (!video?.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const g = c.getContext('2d');
  const k = Math.max(SW / video.videoWidth, SH / video.videoHeight);
  const w = video.videoWidth * k, h = video.videoHeight * k;
  if (s.facing === 'user') { g.translate(SW, 0); g.scale(-1, 1); }
  g.drawImage(video, (SW - w) / 2, (SH - h) / 2, w, h);
  el.querySelector('.cr-flash')?.classList.add('go');
  ctx.haptic(20);
  setTimeout(() => {
    if (!el) return;
    stopCamera();
    s.src = c;
    s.srcUrl = c.toDataURL('image/jpeg', 0.92);
    s.ox = s.oy = 0.5;
    s.step = 'edit';
    draw();
  }, 140);
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    s.urls.push(url);
    const i = new Image();
    i.onload = () => res({ img: i, url });
    i.onerror = () => rej(Object.assign(new Error('image'), { code: 'image' }));
    i.src = url;
  });
}

async function onFile(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const { img, url } = await loadImage(file);
    if (!el) return;
    if (s.mode === 'story') {
      stopCamera();
      Object.assign(s, { src: img, srcUrl: url, ox: 0.5, oy: 0.5, step: 'edit' });
    } else {
      const r = img.naturalWidth / img.naturalHeight;
      Object.assign(s, { pimg: img, purl: url, pox: 0.5, poy: 0.5, filter: 'normal', aspect: r < 0.95 ? 0.8 : 1, thumb: '' });
    }
    draw();
  } catch (e) { ctx.toast(ctx.errorText(e), 'close'); }
}

// ---------- Dragging: text, the story photo, the post photo inside its frame ----------

let drag = null;

function onDown(e) {
  if (!el || e.button > 0) return;
  const text = e.target.closest('.cr-text');
  const stage = e.target.closest('[data-cr-stage]');
  const frame = e.target.closest('[data-cr-pan]');
  if (!text && !(stage && s.src) && !frame) return;
  if (e.target.closest('button') && !text) return;
  const box = (frame || stage || el).getBoundingClientRect();
  drag = { kind: text ? 'text' : frame ? 'post' : 'photo', id: text?.dataset.tid, x0: e.clientX, y0: e.clientY, box, moved: false, node: text || (frame || stage).querySelector('img') };
  const t = text && s.texts.find(x => x.id === drag.id);
  if (t) { drag.tx = t.x; drag.ty = t.y; }
  else if (drag.kind === 'photo') { drag.ox = s.ox; drag.oy = s.oy; drag.over = overflow(s.src.naturalWidth || s.src.width, s.src.naturalHeight || s.src.height, box); }
  else { drag.ox = s.pox; drag.oy = s.poy; drag.over = overflow(s.pimg.naturalWidth, s.pimg.naturalHeight, box); frame.classList.add('panning'); }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
  window.addEventListener('pointercancel', onUp, { once: true });
}

// How far a "cover" image sticks out of its box, in pixels.
function overflow(iw, ih, box) {
  const k = Math.max(box.width / iw, box.height / ih);
  return { x: iw * k - box.width, y: ih * k - box.height };
}

function onMove(e) {
  if (!drag || !el) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  e.preventDefault();
  if (drag.kind === 'text') {
    const t = s.texts.find(x => x.id === drag.id);
    t.x = clamp(drag.tx + dx / drag.box.width, 0.04, 0.96);
    t.y = clamp(drag.ty + dy / drag.box.height, 0.04, 0.96);
    drag.node.style.left = `${t.x * 100}%`;
    drag.node.style.top = `${t.y * 100}%`;
    const trash = el.querySelector('.cr-trash');
    trash.classList.add('show');
    const r = trash.getBoundingClientRect();
    drag.overTrash = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < 56;
    trash.classList.toggle('hot', drag.overTrash);
    drag.node.classList.toggle('dying', drag.overTrash);
  } else {
    const ox = drag.over.x > 1 ? clamp(drag.ox - dx / drag.over.x, 0, 1) : 0.5;
    const oy = drag.over.y > 1 ? clamp(drag.oy - dy / drag.over.y, 0, 1) : 0.5;
    if (drag.kind === 'photo') { s.ox = ox; s.oy = oy; } else { s.pox = ox; s.poy = oy; }
    drag.node.style.objectPosition = `${ox * 100}% ${oy * 100}%`;
  }
}

function onUp() {
  window.removeEventListener('pointermove', onMove);
  const d = drag;
  drag = null;
  if (!d || !el) return;
  el.querySelector('.pp-frame.panning')?.classList.remove('panning');
  if (d.kind !== 'text') return;
  el.querySelector('.cr-trash')?.classList.remove('show', 'hot');
  if (d.overTrash) {
    s.texts = s.texts.filter(x => x.id !== d.id);
    ctx.haptic(25);
    draw();
  } else if (!d.moved && s.texts.find(x => x.id === d.id)?.kind !== 'sticker') {
    s.editing = d.id;
    draw();
  }
}

// ---------- Taps and typing ----------

function onClick(e) {
  if (!el) return;
  const b = e.target.closest('[data-cr], [data-cr-mode], [data-te], [data-color], [data-flt]');
  if (!b && s.picking && !e.target.closest('.st-tray')) { s.picking = false; return draw(); }
  if (!b) {
    // A tap on an empty text story starts writing.
    if (s.step === 'edit' && !s.src && !s.editing && e.target.closest('[data-cr-stage]') && !e.target.closest('.cr-text')) addText();
    return;
  }
  ctx.haptic();
  if (b.dataset.crMode) {
    if (b.dataset.crMode === s.mode) return;
    stopCamera();
    s.mode = b.dataset.crMode;
    s.step = s.mode === 'post' ? 'pick' : 'camera';
    return draw();
  }
  if (b.dataset.te === 'done') return finishText();
  if (b.dataset.te === 'box') { const t = cur(); t.box = !t.box; return redrawEditor(); }
  if (b.dataset.color) { cur().color = b.dataset.color; return redrawEditor(); }
  if (b.dataset.flt) { s.filter = b.dataset.flt; return drawFilter(); }
  const k = b.dataset.cr;
  if (k === 'close') return closeCreator();
  if (k === 'shoot') return shoot();
  if (k === 'create') { stopCamera(); Object.assign(s, { src: null, srcUrl: '', step: 'edit', texts: [] }); return addText(); }
  if (k === 'retake') { Object.assign(s, { src: null, srcUrl: '', texts: [], editing: null, step: 'camera' }); return draw(); }
  if (k === 'bg') { s.bg = (s.bg + 1) % BGS.length; return draw(); }
  if (k === 'add-text') return addText();
  if (k === 'stickers') { s.picking = true; return draw(); }
  if (k === 'stickers-close') { s.picking = false; return draw(); }
  if (k === 'sticker') { const st = stickers().find(x => x.id === b.dataset.id); if (st) s.texts.push(placed(st)); s.picking = false; return draw(); }
  if (k === 'share-story') return shareStory(b);
  if (k === 'aspect') { const i = ASPECTS.findIndex(a => a[0] === s.aspect); s.aspect = ASPECTS[(i + 1) % ASPECTS.length][0]; s.pox = s.poy = 0.5; return drawPick(); }
  if (k === 'to-filter') { if (!s.pimg) return; s.thumb = s.thumb || cropTo(160, 'normal').toDataURL('image/jpeg', 0.8); s.step = 'filter'; return draw(); }
  if (k === 'to-pick') { s.step = 'pick'; return draw(); }
  if (k === 'to-caption') { s.step = 'caption'; return draw(); }
  if (k === 'share-post') return sharePost(b);
}

function onInput(e) {
  const t = e.target;
  if (t.closest('.te-field')) { cur().t = t.value; return; }
  if (t.classList.contains('te-size')) {
    cur().size = +t.value;
    const ta = el.querySelector('.te-field textarea');
    if (ta) ta.style.fontSize = `${(+t.value * 100).toFixed(2)}cqw`;
    return;
  }
  if (t.dataset.crCaption !== undefined) s.caption = t.value;
}

function onChange(e) {
  if (e.target.dataset.crFile !== undefined) onFile(e.target);
}

const cur = () => s.texts.find(x => x.id === s.editing);

function addText() {
  const id = Math.random().toString(36).slice(2, 8);
  s.texts.push({ id, t: '', x: 0.5, y: s.src ? 0.42 : 0.5, color: '#ffffff', box: false, size: 0.085 });
  s.editing = id;
  draw();
}

function redrawEditor() {
  const ta = el.querySelector('.te-field textarea');
  if (ta) cur().t = ta.value;
  draw();
}

function finishText() {
  const ta = el.querySelector('.te-field textarea');
  const t = cur();
  if (ta) t.t = ta.value;
  t.t = t.t.trim();
  if (!t.t) s.texts = s.texts.filter(x => x.id !== t.id);
  s.editing = null;
  draw();
}


// ---------- Stickers ----------

// Your פז״ם, the countdown to release, your unit's patch in its beret color, and a few phrases.
function stickers() {
  const p = ctx.me.profile || {};
  const out = [];
  const c = p.status === 'active' ? serviceClock(p) : null;
  if (c && !c.untilDraft) {
    out.push({ id: 'pazam', t: `${c.served} ימים בפז״ם`, color: '#f0cf8e', fg: '#1b1408' });
    if (!c.done) out.push({ id: 'left', t: `עוד ${c.left} ימים לשחרור 🎉`, color: '#ffffff', fg: '#111111' });
  } else if (c?.untilDraft) out.push({ id: 'pazam', t: `עוד ${c.untilDraft} ימים לגיוס`, color: '#f0cf8e', fg: '#1b1408' });
  const bk = BERETS[beretOf(p)];
  const corps = CORPS[p.unit?.corps];
  if (corps) {
    const top = p.unit.path?.[0] ? prettyLevel(corps.levels[0], p.unit.path[0]) : corps.name;
    const sub = p.unit.path?.[1] ? prettyLevel(corps.levels[1], p.unit.path[1]) : (p.unit.path?.[0] ? corps.name : '');
    out.push({ id: 'patch', variant: 'patch', t: top, sub, color: bk?.color || '#6b6b3a', fg: '#fff', camo: !!bk?.camo });
  }
  if (bk) out.push({ id: 'beret', t: `כומתה ${bk.name}`, color: bk.color, fg: '#ffffff' });
  for (const [t, color, fg] of [['שבת שלום 🕯️', '#ffffff', '#111111'], ['בוקר טוב מהבסיס ☀️', '#f0cf8e', '#1b1408'], ['יוצא הביתה 🏠', '#8e9b5a', '#ffffff'],
    ['חוזר לבסיס 🎒', '#111111', '#ffffff'], ['סופ״ש 🙌', '#ff5a7a', '#ffffff'], ['שמירה 🌙', '#1b2a4e', '#ffffff'], ['אחרי שטח 🌲', '#3f4b2a', '#ffffff'], ['מילואים 💪', '#d39a54', '#1b1408']]) {
    out.push({ id: t, t, color, fg });
  }
  return out;
}

function placed(st) {
  return { ...st, id: Math.random().toString(36).slice(2, 8), kind: 'sticker', variant: st.variant || 'pill', x: 0.5, y: 0.36 + Math.random() * 0.1, size: st.variant === 'patch' ? 0.07 : 0.062 };
}

function stickerTrayHtml() {
  return `<div class="st-tray"><div class="st-head"><b>מדבקות</b><button class="cr-ic" data-cr="stickers-close" aria-label="סגירה">${icon('close')}</button></div>
    <div class="st-grid">${stickers().map(st => `<button data-cr="sticker" data-id="${esc(st.id)}" class="st-item">${textHtml({ ...st, kind: 'sticker', variant: st.variant || 'pill', id: 'x', x: 0.5, y: 0.5, size: st.variant === 'patch' ? 0.055 : 0.034 }).replace('class="cr-text', 'class="cr-text preview')}</button>`).join('')}</div>
  </div>`;
}

function drawSticker(g, t) {
  const px = t.size * SW;
  const x = t.x * SW, y = t.y * SH;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  try { g.direction = 'rtl'; } catch {}
  g.shadowColor = 'rgba(0,0,0,0.28)';
  g.shadowBlur = px * 0.5;
  g.shadowOffsetY = px * 0.12;
  if (t.variant === 'patch') {
    const r = px * 2.1;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = t.color; g.fill();
    g.shadowColor = 'transparent';
    if (t.camo) { g.save(); g.clip(); for (const [dx, dy, rr, c] of [[-0.5, -0.4, 0.6, '#3f4b2a'], [0.5, 0.2, 0.55, '#7a6a3f'], [-0.2, 0.6, 0.5, '#2f3a22'], [0.3, -0.7, 0.4, '#8a8f55']]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); g.fillStyle = c; g.fill(); } g.restore(); }
    g.setLineDash([px * 0.22, px * 0.18]);
    g.lineWidth = px * 0.1; g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(x, y, r * 0.86, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = t.fg;
    g.font = `900 ${px * 0.92}px Heebo, sans-serif`;
    g.fillText(t.t, x, y - (t.sub ? px * 0.38 : 0), r * 1.5);
    if (t.sub) { g.font = `700 ${px * 0.56}px Heebo, sans-serif`; g.fillText(t.sub, x, y + px * 0.62, r * 1.5); }
    return;
  }
  g.font = `800 ${px}px Heebo, sans-serif`;
  const w = g.measureText(t.t).width + px * 1.2, h = px * 1.9;
  g.fillStyle = t.color;
  roundRect(g, x - w / 2, y - h / 2, w, h, px * 0.55);
  g.fill();
  g.shadowColor = 'transparent';
  g.fillStyle = t.fg;
  g.fillText(t.t, x, y + px * 0.04);
}

// ---------- Making the images ----------

async function renderStory() {
  try { await document.fonts.load('800 60px Heebo'); } catch {}
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const g = c.getContext('2d');
  if (s.src) {
    const iw = s.src.naturalWidth || s.src.width, ih = s.src.naturalHeight || s.src.height;
    const k = Math.max(SW / iw, SH / ih);
    const w = iw * k, h = ih * k;
    g.drawImage(s.src, (SW - w) * s.ox, (SH - h) * s.oy, w, h);
  } else {
    // 150deg, as in the CSS gradient on screen.
    const a = (150 - 90) * Math.PI / 180, len = Math.abs(SW * Math.cos(a)) + Math.abs(SH * Math.sin(a));
    const cx = SW / 2, cy = SH / 2, dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
    const grad = g.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    BGS[s.bg].forEach((col, i, all) => grad.addColorStop(i / (all.length - 1), col));
    g.fillStyle = grad;
    g.fillRect(0, 0, SW, SH);
  }
  for (const t of s.texts) {
    if (t.kind === 'sticker') { drawSticker(g, t); continue; }
    const px = t.size * SW;
    g.font = `800 ${px}px Heebo, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    try { g.direction = 'rtl'; } catch {}
    const lines = t.t.split('\n');
    const lh = px * 1.25;
    const top = t.y * SH - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      const y = top + i * lh, x = t.x * SW;
      if (t.box) {
        const w = g.measureText(line).width + px * 0.6;
        g.fillStyle = t.color;
        roundRect(g, x - w / 2, y - lh / 2, w, lh, px * 0.22);
        g.fill();
        g.fillStyle = light(t.color) ? '#111' : '#fff';
        g.shadowColor = 'transparent';
      } else {
        g.fillStyle = t.color;
        g.shadowColor = 'rgba(0,0,0,0.35)';
        g.shadowBlur = px * 0.25;
        g.shadowOffsetY = px * 0.04;
      }
      g.fillText(line, x, y);
      g.shadowColor = 'transparent';
    });
  }
  return toJpeg(c, 400 * 1024);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// The post photo cropped to its frame and position, at most `maxW` wide, with the filter applied.
function cropTo(maxW, filter) {
  const img = s.pimg, A = aspectOf();
  const iw = img.naturalWidth, ih = img.naturalHeight;
  let sw, sh;
  if (iw / ih > A) { sh = ih; sw = ih * A; } else { sw = iw; sh = iw / A; }
  const sx = (iw - sw) * s.pox, sy = (ih - sh) * s.poy;
  const w = Math.round(Math.min(maxW, sw)), h = Math.round(w / A);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: filter !== 'normal' });
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  if (filter !== 'normal') g.putImageData(applyFilter(g.getImageData(0, 0, w, h), filter), 0, 0);
  return c;
}

async function busy(btn, fn) {
  btn.disabled = true;
  el.classList.add('busy');
  try { await fn(); } catch (e) {
    if (el) { btn.disabled = false; el.classList.remove('busy'); }
    ctx.toast(ctx.errorText(e), 'close');
  }
}

function shareStory(btn) {
  if (!s.src && !s.texts.length) { addText(); return; }
  return busy(btn, async () => {
    const image = await renderStory();
    await ctx.api.createStory(ctx.sess, { image });
    ctx.haptic(25);
    closeCreator();
    ctx.toast('הסטורי עלה ל־24 שעות', 'sparkle');
    ctx.onStory();
  });
}

function sharePost(btn) {
  return busy(btn, async () => {
    const image = toJpeg(cropTo(1080, s.filter), 400 * 1024);
    const post = await ctx.api.createPost(ctx.sess, { image, caption: s.caption, ratio: aspectOf() });
    ctx.haptic(25);
    closeCreator();
    ctx.toast('הפוסט פורסם', 'check');
    ctx.onPosted(post);
  });
}
