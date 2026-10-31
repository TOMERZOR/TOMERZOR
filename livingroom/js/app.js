// Living Room: screens, sheets and the flows between them.
import { icon } from './icons.js';
import { items as itemsDb, rooms as roomsDb, blobs, settings, uid, clearAll } from './store.js';
import { CATEGORIES, CATEGORY_ORDER, STARTERS, SWATCHES, starterToItem, guessCategory } from './catalog.js';
import { Studio } from './studio.js';
import { thumbnail } from './thumbs.js';
import { dimsText, len, toField, fromField, price, setUnits, getUnits } from './units.js';
import * as api from './api.js';
import { cutoutImage, dominantColor, loadImage } from './models.js';
import { arSupport, openQuickLook, ARView, isIOS } from './ar.js';
import qrcode from '../vendor/qrcode.mjs';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STARTER_ITEMS = STARTERS.map(starterToItem);

const state = { items: [], rooms: [], studio: null, room: null, hero: null, viewer: null, polling: new Map() };

// ---------- theme & settings ----------
function applySettings() {
  const s = settings.get();
  setUnits(s.units);
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);

// ---------- toast ----------
let toastTimer;
function toast(text, ms = 2600) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 450); }, ms);
}

// ---------- sheet ----------
let sheetClose = null;
function openSheet(html, { onClose, label } = {}) {
  const sheet = $('#sheet'), scrim = $('#scrim');
  const wasOpen = sheet.classList.contains('open');
  if (wasOpen && sheetClose) { const f = sheetClose; sheetClose = null; f(); }
  // a fresh body each time, so listeners from the previous sheet don't linger
  const body = document.createElement('div');
  body.className = 'sheet-body';
  body.id = 'sheet-body';
  body.innerHTML = html;
  $('#sheet-body').replaceWith(body);
  sheet.setAttribute('aria-label', label || '');
  sheet.hidden = false; scrim.hidden = false;
  sheetClose = onClose || null;
  state.hero?.pause();
  if (!wasOpen) {
    void sheet.offsetWidth;
    sheet.classList.add('open'); scrim.classList.add('open');
  } else if (!reduceMotion()) {
    body.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
  setTimeout(() => (body.querySelector('[autofocus]') || sheet).focus?.({ preventScroll: true }), 50);
  return body;
}
function closeSheet() {
  const sheet = $('#sheet'), scrim = $('#scrim');
  if (sheet.hidden) return;
  sheet.classList.remove('open'); scrim.classList.remove('open');
  if (sheetClose) { const f = sheetClose; sheetClose = null; f(); }
  if (!$('#view-home').hidden) state.hero?.resume();
  setTimeout(() => { if (!sheet.classList.contains('open')) { sheet.hidden = true; scrim.hidden = true; $('#sheet-body').innerHTML = ''; } }, 480);
}
$('#scrim').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
// drag the grip down to dismiss
(() => {
  const sheet = $('#sheet'), grip = $('.sheet-grip');
  let y0 = null, dy = 0;
  grip.addEventListener('pointerdown', e => { y0 = e.clientY; dy = 0; sheet.classList.add('dragging'); grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (y0 == null) return; y0 = null; sheet.classList.remove('dragging'); sheet.style.transform = ''; if (dy > 90) closeSheet(); };
  grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
})();

function sheetHead(title, sub) {
  return `<div class="sheet-head"><div><h2 class="sheet-title" id="sheet-title">${title}</h2>${sub ? `<p class="sheet-sub">${sub}</p>` : ''}</div>
    <button class="icon-btn sheet-close" type="button" data-close aria-label="סגירה">${icon('x')}</button></div>`;
}
$('#sheet').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });

/** A segmented control whose thumb slides between options. */
function seg(name, options, value) {
  return `<div class="seg" role="group" data-seg="${name}"><span class="seg-thumb" aria-hidden="true"></span>${options.map(o =>
    `<button type="button" data-v="${o.v}" aria-pressed="${o.v === value}" ${o.disabled ? 'disabled' : ''} ${o.reason ? `class="seg-muted" data-reason="${esc(o.reason)}"` : ''}>${o.icon ? icon(o.icon) : ''}${o.label}</button>`).join('')}</div>`;
}
function layoutSeg(el) {
  const thumb = el.querySelector('.seg-thumb');
  const on = el.querySelector('[aria-pressed="true"]');
  if (!thumb || !on) { if (thumb) thumb.style.width = '0'; return; }
  const r = el.getBoundingClientRect(), b = on.getBoundingClientRect();
  thumb.style.width = `${b.width}px`;
  thumb.style.transform = `translateX(${b.left - r.left - 4}px)`;
  thumb.style.left = '4px';
}
function bindSeg(root, name, onPick) {
  const el = root.querySelector(`[data-seg="${name}"]`);
  if (!el) return;
  requestAnimationFrame(() => layoutSeg(el));
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    // options that can't be used yet say why instead of doing nothing
    if (b.dataset.reason) { toast(b.dataset.reason, 3600); return; }
    const ok = onPick(b.dataset.v);
    if (ok === false) return;
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    layoutSeg(el);
  });
  return { set(v) { el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === v))); layoutSeg(el); }, el };
}

// ---------- data ----------
async function loadData() {
  [state.items, state.rooms] = await Promise.all([itemsDb.all(), roomsDb.all()]);
}
function findItem(id) {
  return state.items.find(i => i.id === id) || STARTER_ITEMS.find(i => i.id === id) || null;
}
async function saveItem(item) {
  item.updatedAt = Date.now();
  await itemsDb.put(item);
  const i = state.items.findIndex(x => x.id === item.id);
  if (i >= 0) state.items[i] = item; else state.items.unshift(item);
  scheduleHome();
  return item;
}
/** A starter (or a shared item) becomes the user's own item the first time it is changed. */
async function ownItem(item) {
  if (!item.starter && !item.shared) return item;
  const own = { ...structuredClone(item), id: uid('i'), starter: false, shared: false, createdAt: Date.now() };
  await saveItem(own);
  return own;
}

// ---------- home ----------
let homeTimer;
function scheduleHome() { clearTimeout(homeTimer); homeTimer = setTimeout(renderHome, 60); }

function badgeFor(item) {
  if (item.model?.task && item.model?.status !== 'failed' && item.model?.kind !== 'glb') return `<span class="badge badge-busy">${icon('sparkle')}${item.model.progress ? `${item.model.progress}%` : 'בונה 3D'}</span>`;
  if (item.model?.kind === 'glb') return `<span class="badge">${icon('cube')}3D</span>`;
  if (item.model?.kind === 'photo') return `<span class="badge">${icon('image')}תמונה</span>`;
  return '';
}

function cardHtml(item, i) {
  return `<button class="card" type="button" data-item="${esc(item.id)}" style="--i:${i}">
    <div class="card-pic"><div class="skeleton"></div><img alt="" hidden></div>
    ${badgeFor(item)}
    <div class="card-text"><span class="card-name">${esc(item.name)}</span><span class="card-dims">${dimsText(item.dims)}</span></div>
  </button>`;
}

function fillThumbs(container) {
  for (const card of container.querySelectorAll('[data-item]')) {
    const item = findItem(card.dataset.item);
    if (!item) continue;
    thumbnail(item).then(url => {
      const img = card.querySelector('img');
      if (!url || !img) return;
      img.src = url; img.hidden = false;
      card.querySelector('.skeleton')?.remove();
    });
  }
}

let lastMine = null, lastRooms = null;
function renderHome() {
  const mine = $('#mine');
  $('#mine-count').textContent = state.items.length ? String(state.items.length) : '';
  const mineHtml = state.items.length
    ? state.items.map(cardHtml).join('')
    : `<div class="empty"><strong>עוד אין כאן פריטים</strong><span>הדביקו קישור למוצר מכל חנות, צלמו מוצר, או התחילו מאחד הפריטים למטה.</span></div>`;
  if (mineHtml !== lastMine) {
    mine.classList.toggle('no-anim', lastMine !== null);
    mine.innerHTML = mineHtml;
    lastMine = mineHtml;
    mine.classList.toggle('cards', state.items.length > 0);
    fillThumbs(mine);
  }

  const roomsEl = $('#rooms');
  const roomsHtml = state.rooms.map((r, i) => {
    const entries = roomEntries(r);
    const total = entries.reduce((s, e) => s + (Number(e.item.source?.price) || 0), 0);
    return `<button class="room-card" type="button" data-room="${esc(r.id)}" style="--i:${i}">
      <div class="room-pic" style="${r.snapshot ? `background-image:url(${r.snapshot})` : ''}">${r.snapshot ? '' : icon('house')}</div>
      <div class="room-text"><div class="room-name">${esc(r.name)}</div><div class="room-meta">${entries.length} פריטים${total ? ` · ${price(total, 'ILS')}` : ''}</div></div>
    </button>`;
  }).join('') + `<button class="room-card room-new" type="button" data-act="new-room" style="--i:${state.rooms.length}">
      <div class="room-pic">${icon('plus')}</div>
      <div class="room-text"><div class="room-name">חדר חדש</div><div class="room-meta">מסדרים פריטים בתלת-ממד ואז רואים את כולם יחד בחדר</div></div>
    </button>`;
  if (roomsHtml !== lastRooms) { roomsEl.classList.toggle('no-anim', lastRooms !== null); roomsEl.innerHTML = roomsHtml; lastRooms = roomsHtml; }

  const st = $('#starters');
  if (!st.childElementCount) { st.innerHTML = STARTER_ITEMS.map(cardHtml).join(''); fillThumbs(st); }
}

function setupStatic() {
  const put = (sel, name, label) => { const el = $(sel); if (el) el.innerHTML = icon(name) + (label ? `<span>${label}</span>` : ''); };
  put('[data-act="settings"]', 'gear');
  $('.paste-icon').innerHTML = icon('link');
  $('.paste-go').innerHTML = icon('arrow-left');
  put('[data-act="add-photo"]', 'camera', 'מתמונה');
  put('[data-act="add-manual"]', 'ruler', 'לפי מידות');
  put('[data-act="back"]', 'arrow-right');
  put('[data-act="room-size"]', 'selection');
  const dock = { 'studio-add': 'plus', 'toggle-dims': 'arrows-horizontal', 'toggle-clearance': 'footprints', 'toggle-person': 'person-simple', 'toggle-night': 'moon', 'studio-ar': 'cube-focus' };
  for (const [act, name] of Object.entries(dock)) { const el = $(`[data-act="${act}"] .dock-ic`); if (el) el.innerHTML = icon(name === 'footprints' ? 'squares-four' : name); }
  const sel = { 'sel-rotl': 'arrow-counter-clockwise', 'sel-rotr': 'arrows-clockwise', 'sel-dup': 'copy', 'sel-info': 'info', 'sel-del': 'trash' };
  for (const [act, name] of Object.entries(sel)) put(`[data-act="${act}"]`, name);
}

/** A small furnished corner, slowly turning, at the top of the home screen. */
async function startHero() {
  const canvas = $('#hero-canvas');
  const studio = state.hero = new Studio(canvas, { preview: true, previewDims: false });
  // the picture only turns by itself; touches pass through so the page scrolls normally
  studio.controls.enabled = false;
  canvas.style.touchAction = 'auto';
  canvas.style.pointerEvents = 'none';
  studio.controls.autoRotateSpeed = 0.7;
  const pick = key => STARTER_ITEMS.find(i => i.id === `starter_${key}`);
  const layout = [
    ['rug-wool', { x: 0, z: 0.15, rot: Math.PI / 2 }],
    ['sofa-oslo', { x: 0, z: -0.95 }],
    ['coffee-round', { x: 0, z: 0.3 }],
    ['arm-boucle', { x: 1.35, z: 0.35, rot: -Math.PI / 2.6 }],
    ['plant-monstera', { x: -1.5, z: -1.05 }],
    ['lamp-arc', { x: 1.45, z: -1.05 }],
  ];
  for (const [key, p] of layout) await studio.addItem(pick(key), p, { animate: !reduceMotion() });
  studio.frameAll();
  studio.camera.position.lerp(studio.controls.target, 0.1);
  new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden && $('#view-home').hidden === false ? studio.resume() : studio.pause())).observe(canvas);
}

// ---------- item sheet ----------
function dimsWarn(item) {
  if (item.dimsSource === 'estimate') return `<p class="hint hint-warn">${icon('warning-circle')}<span>לא מצאנו מידות בעמוד, אלה מידות משוערות. כדאי להזין את המידות האמיתיות של המוצר.</span></p>`;
  if (item.dimsSource === 'partial') return `<p class="hint hint-warn">${icon('warning-circle')}<span>חלק מהמידות לא הופיעו בעמוד. בדקו אותן מול המוצר.</span></p>`;
  if (item.note) return `<p class="hint">${esc(item.note)}</p>`;
  return '';
}

function modelOptions(item) {
  const hasPhoto = Boolean(item.image || item.hasPhoto);
  const hasGlb = Boolean(item.hasGlb || item.model?.kind === 'glb');
  return [
    { v: 'shape', label: 'צורה', icon: 'shapes' },
    { v: 'photo', label: 'תמונה', icon: 'image', reason: hasPhoto ? null : 'לפריט הזה אין תמונה. פריט מקישור או מצילום מוצג גם כתמונה.' },
    { v: 'glb', label: '3D', icon: 'cube', reason: hasGlb ? null : !hasPhoto ? 'מודל תלת-ממדי נבנה מתמונת המוצר. הוסיפו את הפריט מקישור או מצילום.' : !state.models3d ? 'בניית מודלים תלת-ממדיים עוד לא מחוברת בשרת.' : null },
  ];
}

async function openItem(itemArg) {
  let item = itemArg;
  const cat = CATEGORIES[item.category] || CATEGORIES.object;
  const src = item.source || {};
  const storeLink = src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${icon('storefront')}${esc(src.store || 'לעמוד המוצר')}${icon('arrow-up-right')}</a>` : '';
  const body = openSheet(`
    <div class="viewer"><canvas></canvas><span class="badge" id="vbadge" hidden></span><button class="icon-btn viewer-close" type="button" data-close aria-label="סגירה">${icon('x')}</button><span class="viewer-hint">גוררים הצידה כדי לסובב</span></div>
    <div class="sheet-section">
      <input class="field" id="it-name" style="font-size:22px;font-weight:600;height:56px" value="${esc(item.name)}" aria-label="שם הפריט" maxlength="80">
      <div class="source-row" style="margin-top:10px">${storeLink}${src.price ? `<span class="price">${price(src.price, src.currency)}</span>` : ''}${item.starter ? '<span>פריט לדוגמה</span>' : ''}</div>
    </div>
    <div class="sheet-section">
      <span class="label">מידות (${getUnits() === 'in' ? 'אינץ׳' : 'ס״מ'})</span>
      <div class="dims">
        <label class="dim"><span>רוחב</span><input type="number" inputmode="decimal" min="1" max="2000" step="any" data-dim="w" value="${toField(item.dims.w)}"></label>
        <label class="dim"><span>עומק</span><input type="number" inputmode="decimal" min="0.5" max="2000" step="any" data-dim="d" value="${toField(item.dims.d)}"></label>
        <label class="dim"><span>גובה</span><input type="number" inputmode="decimal" min="0.5" max="2000" step="any" data-dim="h" value="${toField(item.dims.h)}"></label>
      </div>
      <div id="dims-warn">${dimsWarn(item)}</div>
    </div>
    <div class="sheet-section">
      <span class="label">איך להציג</span>
      ${seg('kind', modelOptions(item), item.model?.kind || 'shape')}
      <div id="ai-progress"></div>
    </div>
    <div class="sheet-section" id="color-section">
      <span class="label">צבע</span>
      <div class="swatches">${SWATCHES.map(s => `<button class="swatch" type="button" style="background:${s.hex}" data-color="${s.hex}" aria-label="${s.name}" aria-pressed="${s.hex.toLowerCase() === String(item.color).toLowerCase()}"></button>`).join('')}
        <label class="swatch swatch-custom" aria-label="צבע אחר"><input type="color" value="${esc(item.color || '#888888')}"></label></div>
    </div>
    <div class="sheet-section">
      <span class="label">סוג</span>
      <div class="cats">${CATEGORY_ORDER.map(k => `<button class="cat" type="button" data-cat="${k}" aria-pressed="${k === item.category}">${icon(CATEGORIES[k].icon)}${CATEGORIES[k].he}</button>`).join('')}</div>
    </div>
    <div class="sheet-section btn-row" style="margin-top:26px">
      <button class="btn btn-accent" type="button" data-do="ar">${icon('cube-focus')}הצג אצלי בחדר</button>
      <button class="btn btn-primary" type="button" data-do="plan">${icon('house')}הוסף לחדר</button>
    </div>
    <div class="btn-row" style="margin-top:10px">
      <button class="btn btn-ghost btn-small" type="button" data-do="share">${icon('share-network')}שיתוף</button>
      ${item.starter || item.shared ? '' : `<button class="btn btn-ghost btn-small" type="button" data-do="delete" style="color:var(--danger)">${icon('trash')}מחיקה</button>`}
    </div>`, { label: item.name, onClose: () => { state.viewer?.dispose(); state.viewer = null; state.openItemId = null; } });

  state.openItemId = item.id;
  state.viewer?.dispose();
  const viewer = state.viewer = new Studio(body.querySelector('.viewer canvas'), { preview: true });
  viewer.setFlag('dims', true);
  // the preview loads in the background; the sheet's controls work right away
  viewer.addItem(item, { x: 0, z: 0 }, { animate: false })
    .then(() => viewer.frameAll())
    .catch(e => { console.warn('preview failed', e); toast('לא הצלחנו להציג את הפריט'); });
  updateBadge();
  $('#color-section', body).hidden = (item.model?.kind || 'shape') !== 'shape';
  renderAiProgress();

  function updateBadge() {
    const b = $('#vbadge', body);
    if (!b) return;
    const html = badgeFor(item);
    b.hidden = !html;
    if (html) b.outerHTML = html.replace('class="badge', 'id="vbadge" class="badge');
  }

  let rebuildT, owning = null;
  /** A ready-made or shared item becomes the user's own copy once, on the first edit. */
  const ensureOwn = async () => {
    if (!item.starter && !item.shared) return item;
    const fromId = item.id;
    owning ||= ownItem(item);
    item = await owning;
    state.openItemId = item.id;
    // a room showing the original now shows the copy
    if (state.studio?.hasItem(fromId)) { await state.studio.replaceItem(item, fromId); saveRoomSoon(); }
    return item;
  };
  const changed = async (patch, { rebuild = true } = {}) => {
    await ensureOwn();
    Object.assign(item, patch);
    await saveItem(item);
    if (!rebuild) return;
    clearTimeout(rebuildT);
    rebuildT = setTimeout(() => {
      state.viewer?.replaceItem(item);
      if (state.studio?.hasItem(item.id)) state.studio.replaceItem(item).then(saveRoomSoon);
    }, 180);
  };

  $('#it-name', body).addEventListener('change', e => changed({ name: e.target.value.trim() || item.name }, { rebuild: false }));
  for (const input of $$('[data-dim]', body)) {
    input.addEventListener('input', () => {
      const v = fromField(input.value);
      if (!(v > 0.4 && v < 2000)) return;
      changed({ dims: { ...item.dims, [input.dataset.dim]: Math.round(v * 10) / 10 }, dimsSource: 'user', note: null });
      $('#dims-warn', body).innerHTML = '';
    });
  }
  const kindSeg = bindSeg(body, 'kind', v => {
    if (v === 'glb' && !item.hasGlb) { startAiModel(item).then(it => { if (it) { item = it; state.openItemId = it.id; } renderAiProgress(); }); return false; }
    changed({ model: { ...item.model, kind: v } }).then(() => { updateBadge(); });
    $('#color-section', body).hidden = v !== 'shape';
  });
  body.addEventListener('click', async e => {
    const sw = e.target.closest('[data-color]');
    if (sw) { $$('[data-color]', body).forEach(s => s.setAttribute('aria-pressed', String(s === sw))); changed({ color: sw.dataset.color }); return; }
    const c = e.target.closest('[data-cat]');
    if (c) {
      $$('[data-cat]', body).forEach(s => s.setAttribute('aria-pressed', String(s === c)));
      const prev = CATEGORIES[item.category]?.mount, next = CATEGORIES[c.dataset.cat].mount;
      changed({ category: c.dataset.cat, ...(prev !== next ? { dims: { ...CATEGORIES[c.dataset.cat].dims } } : {}) });
      if (prev !== next) $$('[data-dim]', body).forEach(inp => { inp.value = toField(CATEGORIES[c.dataset.cat].dims[inp.dataset.dim]); });
      return;
    }
    const d = e.target.closest('[data-do]');
    if (!d) return;
    if (d.dataset.do === 'ar') launchAR([{ item }]);
    if (d.dataset.do === 'plan') { if (item.shared) await ensureOwn(); pickRoomFor(item); }
    if (d.dataset.do === 'share') shareItem(item);
    if (d.dataset.do === 'delete') deleteItem(item);
  });
  body.addEventListener('change', e => { if (e.target.type === 'color') changed({ color: e.target.value }); });

  function renderAiProgress() {
    const el = $('#ai-progress', body);
    if (!el) return;
    const m = item.model || {};
    if (m.task && m.status !== 'failed' && !item.hasGlb) {
      el.innerHTML = `<div class="progress" style="margin-top:10px"><div class="ring" style="--p:${m.progress || 3}"></div><div><b>בונים מודל תלת-ממדי מהתמונה</b><span>${m.progress ? `${m.progress}%` : 'מתחילים'} · אפשר לסגור, זה ימשיך ברקע</span></div></div>`;
    } else if (m.status === 'failed' && m.error) {
      el.innerHTML = `<p class="hint hint-warn">${icon('warning-circle')}<span>${esc(m.error)}</span></p>`;
    } else el.innerHTML = '';
  }
  state.onModelProgress = (id, done) => {
    if (id !== item.id || state.openItemId !== item.id) return;
    item = findItem(id) || item;
    renderAiProgress();
    updateBadge();
    if (done) { kindSeg?.set('glb'); state.viewer?.replaceItem(item); }
  };
}

async function deleteItem(item) {
  await itemsDb.remove(item.id);
  await blobs.remove(`glb:${item.id}`);
  await blobs.remove(`photo:${item.id}`);
  state.items = state.items.filter(i => i.id !== item.id);
  closeSheet();
  renderHome();
  toast('הפריט נמחק');
}

// ---------- AI 3D models ----------
async function imageForModel(item) {
  const stored = await blobs.get(`photo:${item.id}`);
  if (stored) return { imageData: await blobToDataUrl(await downscale(stored, 1280)) };
  if (item.image) return { imageUrl: item.image };
  return null;
}

async function startAiModel(itemArg) {
  if (!state.models3d) { toast('יצירת מודל 3D לא זמינה כרגע'); return null; }
  let item = await ownItem(itemArg);
  const img = await imageForModel(item);
  if (!img) { toast('צריך תמונה של המוצר כדי לבנות מודל'); return null; }
  item.model = { ...item.model, task: null, status: 'starting', progress: 0, error: null };
  await saveItem(item);
  try {
    const { task } = await api.startModel(img);
    item.model = { ...item.model, task, status: 'running', progress: 2 };
    await saveItem(item);
    pollModel(item.id);
    toast('בונים מודל תלת-ממדי, זה לוקח כדקה');
  } catch (e) {
    const msg = e.code === 'no_credit' ? 'לחשבון יצירת המודלים נגמר הקרדיט' : e.code === 'daily_limit' ? 'הגעתם למספר המודלים היומי, נסו מחר' : 'לא הצלחנו להתחיל לבנות מודל';
    item.model = { ...item.model, task: null, status: 'failed', error: msg };
    await saveItem(item);
    toast(msg);
  }
  return item;
}

function pollModel(id) {
  if (state.polling.has(id)) return;
  state.polling.set(id, true);
  (async () => {
    let fails = 0;
    for (let n = 0; n < 200; n++) {
      await sleep(n < 3 ? 3000 : 4500);
      const item = findItem(id);
      if (!item?.model?.task) break;
      try {
        const st = await api.modelStatus(item.model.task);
        fails = 0;
        if (st.status === 'success' && st.ready) {
          const res = await fetch(api.modelFileUrl(item.model.task));
          if (!res.ok) throw new Error('download');
          await blobs.put(`glb:${id}`, await res.blob());
          Object.assign(item, { hasGlb: true, model: { kind: 'glb', status: 'done', source: 'ai' } });
          await saveItem(item);
          state.studio?.replaceItem(item);
          state.onModelProgress?.(id, true);
          toast(`המודל של ${item.name} מוכן`);
          break;
        }
        if (st.status === 'failed') {
          item.model = { ...item.model, task: null, status: 'failed', error: 'בניית המודל נכשלה. אפשר לנסות שוב, עדיף עם תמונה על רקע לבן.' };
          await saveItem(item);
          state.onModelProgress?.(id, false);
          break;
        }
        if (st.progress !== item.model.progress) { item.model = { ...item.model, progress: st.progress }; await saveItem(item); state.onModelProgress?.(id, false); }
      } catch {
        if (++fails > 6) break;
      }
    }
    state.polling.delete(id);
  })();
}

/** A 3D model linked from the store page itself: download it once and keep it. */
async function fetchPageModel(item, url) {
  try {
    const res = await fetch(api.remoteFileUrl(url));
    if (!res.ok) return;
    const blob = await res.blob();
    if (blob.size < 200) return;
    await blobs.put(`glb:${item.id}`, blob);
    Object.assign(item, { hasGlb: true, model: { kind: 'glb', status: 'done', source: 'page' } });
    await saveItem(item);
    if (state.openItemId === item.id) state.viewer?.replaceItem(item);
    toast('מצאנו מודל תלת-ממדי של המוצר');
  } catch { /* stays as a shape */ }
}

// ---------- add: from a link ----------
async function addFromUrl(raw) {
  let url = raw.trim();
  const found = url.match(/https?:\/\/\S+/);
  if (found) url = found[0];
  else if (/^[\w-]+(\.[\w-]+)+\//.test(url)) url = `https://${url}`;
  try { url = new URL(url).href; } catch { toast('זה לא נראה כמו קישור'); return; }
  if (!api.hasServer()) { noServerSheet(url); return; }
  const form = $('#paste-form');
  form.classList.add('busy');
  const body = openSheet(`${sheetHead('קוראים את עמוד המוצר', esc(new URL(url).hostname.replace(/^www\./, '')))}
    <div class="steps">
      <div class="step active" data-step="0"><i>${icon('check')}</i>פותחים את העמוד</div>
      <div class="step" data-step="1"><i>${icon('check')}</i>מוצאים שם, תמונה ומחיר</div>
      <div class="step" data-step="2"><i>${icon('check')}</i>מוצאים את המידות האמיתיות</div>
      <div class="step" data-step="3"><i>${icon('check')}</i>מכינים את הפריט בגודל אמיתי</div>
    </div>
    <div class="skeleton skel-card"></div>`, { label: 'ייבוא מוצר' });
  let step = 0;
  const advance = () => { if (step >= 3) return; $(`[data-step="${step}"]`, body)?.classList.replace('active', 'done'); step++; $(`[data-step="${step}"]`, body)?.classList.add('active'); };
  const ticker = setInterval(advance, 2600);
  try {
    const { item: got } = await api.importUrl(url);
    clearInterval(ticker);
    while (step < 3) { advance(); await sleep(120); }
    const item = await itemFromImport(got);
    $(`[data-step="3"]`, body)?.classList.replace('active', 'done');
    await sleep(250);
    $('#paste-input').value = '';
    openItem(item);
    if (got.modelUrl) fetchPageModel(item, got.modelUrl);
  } catch (e) {
    clearInterval(ticker);
    const blocked = e.code === 'page_blocked';
    openSheet(`${sheetHead(blocked ? 'החנות לא נותנת לקרוא את העמוד' : 'לא הצלחנו לקרוא את העמוד', blocked ? 'אפשר להוסיף את הפריט מצילום מסך של המוצר, או לפי מידות.' : e.code === 'daily_limit' ? 'הגעתם למספר הייבואים היומי.' : 'בדקו את הקישור ונסו שוב.')}
      <div class="btn-row"><button class="btn btn-primary" type="button" data-pick="photo">${icon('camera')}מתמונה</button><button class="btn btn-ghost" type="button" data-pick="manual">${icon('ruler')}לפי מידות</button></div>`, { label: 'שגיאה' })
      .addEventListener('click', ev => { const p = ev.target.closest('[data-pick]'); if (p) p.dataset.pick === 'photo' ? pickPhoto({ url }) : manualSheet({ url }); });
  } finally {
    form.classList.remove('busy');
  }
}

async function itemFromImport(got) {
  const cat = CATEGORIES[got.category] ? got.category : 'object';
  const def = CATEGORIES[cat].dims;
  const dims = { w: got.dims?.w || def.w, d: got.dims?.d || def.d, h: got.dims?.h || def.h };
  if (cat === 'rug') dims.h = Math.min(dims.h, 3);
  const missing = !got.dims?.w || !got.dims?.d || !got.dims?.h;
  let color = got.color;
  if (!color && got.image) {
    const img = await loadImage(api.proxied(got.image));
    if (img) color = dominantColor(cutoutImage(img).canvas);
  }
  const item = {
    id: uid('i'),
    name: got.name || 'פריט חדש',
    category: cat,
    dims,
    dimsSource: missing && got.dimsSource !== 'estimate' ? (got.dims?.w || got.dims?.h ? 'partial' : 'estimate') : got.dimsSource,
    note: got.note || null,
    color: color || '#A7A39C',
    image: got.image || null,
    model: { kind: cat === 'object' && got.image ? 'photo' : 'shape' },
    source: got.source || {},
    createdAt: Date.now(),
  };
  return saveItem(item);
}

function noServerSheet(url) {
  openSheet(`${sheetHead('קריאת קישורים עוד לא מחוברת', 'השרת של Living Room עוד לא הופעל, אז אי אפשר לקרוא את עמוד המוצר. בינתיים מוסיפים את הפריט מצילום מסך של המוצר או לפי המידות שבעמוד.')}
    <div class="btn-row"><button class="btn btn-primary" type="button" data-pick="photo">${icon('camera')}מתמונה</button><button class="btn btn-ghost" type="button" data-pick="manual">${icon('ruler')}לפי מידות</button></div>`, { label: 'אין שרת' })
    .addEventListener('click', ev => { const p = ev.target.closest('[data-pick]'); if (p) p.dataset.pick === 'photo' ? pickPhoto({ url }) : manualSheet({ url }); });
}

// ---------- add: from a photo ----------
function pickPhoto(ctx = {}) {
  const input = $('#file-input');
  input.value = '';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const blob = await downscale(file, 1600);
    const img = await loadImage(URL.createObjectURL(blob));
    if (!img) { toast('לא הצלחנו לפתוח את התמונה'); return; }
    const cut = cutoutImage(img);
    photoSheet({ blob, img, cut, ctx });
  };
  input.click();
}

function photoSheet({ blob, cut, ctx }) {
  const preview = cut.canvas.toDataURL('image/png');
  const guess = guessCategory(ctx.name || ctx.url || '');
  let cat = guess === 'object' ? 'object' : guess;
  const body = openSheet(`${sheetHead('פריט מתמונה', cut.removed ? 'הסרנו את הרקע. נשאר לבחור סוג ולהזין מידות.' : 'בחרו סוג והזינו מידות. תמונה על רקע לבן נראית הכי טוב.')}
    <div style="display:grid;place-items:center;background:var(--sunken);border-radius:22px;padding:16px;aspect-ratio:16/10"><img src="${preview}" alt="" style="max-width:100%;max-height:100%;object-fit:contain"></div>
    <div class="sheet-section"><label class="label" for="ph-name">שם</label><input class="field" id="ph-name" value="${esc(ctx.name || '')}" placeholder="למשל: כורסה כחולה" maxlength="80"></div>
    <div class="sheet-section"><span class="label">סוג</span><div class="cats">${CATEGORY_ORDER.map(k => `<button class="cat" type="button" data-cat="${k}" aria-pressed="${k === cat}">${icon(CATEGORIES[k].icon)}${CATEGORIES[k].he}</button>`).join('')}</div></div>
    ${dimsFields(CATEGORIES[cat].dims)}
    <div class="sheet-section"><button class="btn btn-primary" type="button" data-save style="width:100%">${icon('check')}שמירה</button></div>`, { label: 'פריט מתמונה' });
  body.addEventListener('click', async e => {
    const c = e.target.closest('[data-cat]');
    if (c) { cat = c.dataset.cat; $$('[data-cat]', body).forEach(s => s.setAttribute('aria-pressed', String(s === c))); setDimsFields(body, CATEGORIES[cat].dims); return; }
    if (!e.target.closest('[data-save]')) return;
    const dims = readDims(body);
    if (!dims) { toast('הזינו רוחב, עומק וגובה'); return; }
    const id = uid('i');
    await blobs.put(`photo:${id}`, blob);
    const item = {
      id, name: $('#ph-name', body).value.trim() || CATEGORIES[cat].he, category: cat, dims, dimsSource: 'user',
      color: dominantColor(cut.canvas) || '#A7A39C', hasPhoto: true,
      model: { kind: ['art', 'rug'].includes(cat) ? 'shape' : 'photo' },
      source: ctx.url ? { url: ctx.url, store: new URL(ctx.url).hostname.replace(/^www\./, '') } : {}, createdAt: Date.now(),
    };
    await saveItem(item);
    afterCreate(item, ctx);
  });
}

/** A new item opens in its sheet, or, when made from inside the planner, goes straight into the room. */
async function afterCreate(item, ctx = {}) {
  if (ctx.toRoom && state.studio) {
    closeSheet();
    await state.studio.addItem(item, {}, { select: true });
    saveRoomSoon();
    toast(`${item.name} נוסף לחדר`);
  } else openItem(item);
}

function dimsFields(d) {
  return `<div class="sheet-section"><span class="label">מידות (${getUnits() === 'in' ? 'אינץ׳' : 'ס״מ'})</span><div class="dims">
    <label class="dim"><span>רוחב</span><input type="number" inputmode="decimal" step="any" data-dim="w" value="${toField(d.w)}"></label>
    <label class="dim"><span>עומק</span><input type="number" inputmode="decimal" step="any" data-dim="d" value="${toField(d.d)}"></label>
    <label class="dim"><span>גובה</span><input type="number" inputmode="decimal" step="any" data-dim="h" value="${toField(d.h)}"></label>
  </div><p class="hint">המידות מופיעות בדרך כלל בעמוד המוצר תחת ״מידות״.</p></div>`;
}
function setDimsFields(root, d) { $$('[data-dim]', root).forEach(i => { i.value = toField(d[i.dataset.dim]); }); }
function readDims(root) {
  const d = {};
  for (const i of $$('[data-dim]', root)) { const v = fromField(i.value); if (!(v > 0.4 && v < 2000)) return null; d[i.dataset.dim] = Math.round(v * 10) / 10; }
  return d;
}

// ---------- add: by hand ----------
function manualSheet(ctx = {}) {
  let cat = 'sofa';
  let color = SWATCHES[1].hex;
  const body = openSheet(`${sheetHead('פריט לפי מידות', 'בוחרים סוג, מזינים מידות, ורואים אותו בגודל אמיתי.')}
    <div class="sheet-section" style="margin-top:0"><span class="label">סוג</span><div class="cats">${CATEGORY_ORDER.filter(k => k !== 'object').map(k => `<button class="cat" type="button" data-cat="${k}" aria-pressed="${k === cat}">${icon(CATEGORIES[k].icon)}${CATEGORIES[k].he}</button>`).join('')}</div></div>
    ${dimsFields(CATEGORIES[cat].dims)}
    <div class="sheet-section"><span class="label">צבע</span><div class="swatches">${SWATCHES.map(s => `<button class="swatch" type="button" style="background:${s.hex}" data-color="${s.hex}" aria-label="${s.name}" aria-pressed="${s.hex === color}"></button>`).join('')}</div></div>
    <div class="sheet-section"><label class="label" for="mn-name">שם (לא חובה)</label><input class="field" id="mn-name" maxlength="80" placeholder="${CATEGORIES[cat].he}"></div>
    <div class="sheet-section"><button class="btn btn-primary" type="button" data-save style="width:100%">${icon('check')}יצירה</button></div>`, { label: 'פריט לפי מידות' });
  body.addEventListener('click', async e => {
    const c = e.target.closest('[data-cat]');
    if (c) { cat = c.dataset.cat; $$('[data-cat]', body).forEach(s => s.setAttribute('aria-pressed', String(s === c))); setDimsFields(body, CATEGORIES[cat].dims); $('#mn-name', body).placeholder = CATEGORIES[cat].he; return; }
    const s = e.target.closest('[data-color]');
    if (s) { color = s.dataset.color; $$('[data-color]', body).forEach(x => x.setAttribute('aria-pressed', String(x === s))); return; }
    if (!e.target.closest('[data-save]')) return;
    const dims = readDims(body);
    if (!dims) { toast('הזינו רוחב, עומק וגובה'); return; }
    const item = { id: uid('i'), name: $('#mn-name', body).value.trim() || CATEGORIES[cat].he, category: cat, dims, dimsSource: 'user', color, model: { kind: 'shape' }, source: ctx.url ? { url: ctx.url, store: new URL(ctx.url).hostname.replace(/^www\./, '') } : {}, createdAt: Date.now() };
    await saveItem(item);
    afterCreate(item, ctx);
  });
}

// ---------- AR ----------
async function launchAR(entries, { asGroup = false } = {}) {
  const mode = await arSupport();
  if (mode === 'webxr') {
    closeSheet();
    state.studio?.pause(); state.hero?.pause();
    const view = new ARView({
      overlay: $('#ar-overlay'), entries, asGroup,
      onExit: () => { state.studio?.resume(); if (!$('#view-home').hidden) state.hero?.resume(); },
    });
    try { await view.start(); } catch (e) {
      console.warn(e);
      view.cleanup();
      toast('לא הצלחנו להפעיל את המצלמה');
    }
    return;
  }
  if (mode === 'quicklook') {
    toast('מכינים את הפריט למציאות רבודה');
    let res;
    try { res = await openQuickLook(entries); } catch (e) {
      console.warn(e);
      toast(`לא הצלחנו לפתוח את התצוגה${e?.message ? ` (${e.message})` : ''}`, 5000);
      return;
    }
    if (res?.url) quickLookSheet(entries, res.url);
    return;
  }
  handoffSheet(entries);
}

/** iPhone Safari: AR Quick Look opens from a tap on a real link around a picture. */
async function quickLookSheet(entries, url) {
  const pic = (await thumbnail(entries[0].item)) || 'img/icon-512.png';
  const body = openSheet(`${sheetHead(entries.length > 1 ? 'החדר מוכן' : 'הפריט מוכן', 'נוגעים בתמונה כדי לראות אותו אצלכם בחדר, בגודל האמיתי.')}
    <a class="ql-link" rel="ar" href="${esc(url)}" download="LivingRoom.usdz"><img src="${pic}" alt="פתיחה במציאות רבודה"></a>
    <a class="btn btn-accent" rel="ar" href="${esc(url)}" download="LivingRoom.usdz" style="width:100%;margin-top:14px"><img src="${pic}" alt="" style="display:none">${icon('cube-focus')}פתיחה בחדר שלי</a>`, { label: 'מציאות רבודה' });
  body.addEventListener('click', e => { if (e.target.closest('a[rel="ar"]')) setTimeout(closeSheet, 600); });
}

/** On a computer: a QR code that opens the same item (or room) on the phone. */
function handoffSheet(entries) {
  const link = entries.length === 1 ? shareLink(entries[0].item) : publicBase();
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  openSheet(`${sheetHead('פותחים בטלפון', 'מציאות רבודה עובדת בטלפון. סרקו את הקוד במצלמה של הטלפון ומשם ממשיכים.')}
    <div class="qr"><div class="qr-box">${svg}</div>
    <p class="hint">${isIOS() ? '' : 'באנדרואיד: Chrome. באייפון: Safari.'}</p>
    <button class="btn btn-ghost btn-small" type="button" data-copy>${icon('copy')}העתקת הקישור</button></div>`, { label: 'פתיחה בטלפון' })
    .addEventListener('click', e => { if (e.target.closest('[data-copy]')) copy(link); });
}

// ---------- share ----------
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
// Inside the iPhone app the page lives at capacitor://localhost, so shared links point to the website.
const PUBLIC_URL = 'https://tomerzor.github.io/TOMERZOR/livingroom/';
const publicBase = () => (location.protocol.startsWith('http') ? location.href.split('#')[0] : PUBLIC_URL);
function shareLink(item) {
  const data = { n: item.name, c: item.category, d: [item.dims.w, item.dims.d, item.dims.h], k: item.color, s: item.shape || undefined, i: item.image && !item.image.startsWith('data:') ? item.image : undefined, u: item.source?.url, p: item.source?.price || undefined, $: item.source?.currency || undefined };
  return `${publicBase()}#i/${b64url(JSON.stringify(data))}`;
}
function itemFromLink(code) {
  try {
    const d = JSON.parse(unb64url(code));
    if (!CATEGORIES[d.c] || !Array.isArray(d.d)) return null;
    return {
      id: `shared_${code.slice(0, 16)}`, shared: true, name: String(d.n || 'פריט').slice(0, 80), category: d.c,
      dims: { w: +d.d[0], d: +d.d[1], h: +d.d[2] }, color: /^#[0-9a-f]{6}$/i.test(d.k) ? d.k : '#A7A39C', shape: d.s || null,
      image: d.i || null, model: { kind: d.c === 'object' && d.i ? 'photo' : 'shape' },
      source: { url: d.u || null, store: d.u ? new URL(d.u).hostname.replace(/^www\./, '') : null, price: d.p || null, currency: d.$ || null }, createdAt: Date.now(),
    };
  } catch { return null; }
}
async function shareItem(item) {
  const url = shareLink(item);
  const text = `${item.name} · ${dimsText(item.dims)}`;
  if (navigator.share) { try { await navigator.share({ title: item.name, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copy(url);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('הקישור הועתק'); } catch { prompt('העתיקו את הקישור', text); }
}

// ---------- rooms & planner ----------
function roomEntries(room) {
  return (room.placements || []).map(p => ({ item: findItem(p.itemId), placement: p })).filter(e => e.item);
}

function pickRoomFor(item) {
  if (!state.rooms.length) { openStudio(null, [item]); return; }
  const body = openSheet(`${sheetHead('לאיזה חדר?')}
    <div class="list">${state.rooms.map(r => `<button class="list-row" type="button" data-room="${esc(r.id)}"><img alt="" src="${r.snapshot || ''}"><span class="grow"><b>${esc(r.name)}</b><small>${roomEntries(r).length} פריטים</small></span>${icon('caret-left')}</button>`).join('')}
    <button class="list-row" type="button" data-room="new"><span style="width:48px;height:48px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${icon('plus')}</span><span class="grow"><b>חדר חדש</b></span>${icon('caret-left')}</button></div>`, { label: 'בחירת חדר' });
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-room]');
    if (!b) return;
    openStudio(b.dataset.room === 'new' ? null : b.dataset.room, [item]);
  });
}

async function openStudio(roomId, addItems = []) {
  closeSheet();
  let room = roomId ? state.rooms.find(r => r.id === roomId) : null;
  if (!room) room = { id: uid('r'), name: `חדר ${state.rooms.length + 1}`, size: { w: 420, l: 380 }, placements: [], createdAt: Date.now() };
  state.room = room;
  showView('studio');
  history.replaceState(null, '', `#room/${room.id}`);
  const canvas = $('#studio-canvas');
  state.studio?.dispose();
  const studio = state.studio = new Studio(canvas, {
    onSelect: root => {
      const bar = $('#selbar');
      bar.hidden = !root;
      if (root) { $('#sel-name').textContent = root.userData.item.name; bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    },
    onChange: () => saveRoomSoon(),
    onConflicts: pairs => {
      const el = $('#conflict');
      el.hidden = !pairs.length;
      if (pairs.length) el.innerHTML = `${icon('warning-circle')}<span>${esc(pairs[0][0].name)} חופף ל${esc(pairs[0][1].name)}</span>`;
    },
  });
  const s = settings.get();
  studio.setFlag('clearance', false);
  studio.setRoom(room.size);
  $('#room-name').value = room.name;
  for (const btn of $$('.dock [aria-pressed]')) btn.setAttribute('aria-pressed', 'false');
  const night = $('[data-act="toggle-night"]');
  night.querySelector('.dock-ic').innerHTML = icon('moon');
  night.lastElementChild.textContent = 'ערב';
  state.roomLoading = true;
  try {
    for (const e of roomEntries(room)) {
      if (state.studio !== studio) return;
      await studio.addItem(e.item, e.placement, { animate: false }).catch(err => console.warn('item failed', err));
    }
  } finally { if (state.studio === studio) state.roomLoading = false; }
  if (state.studio !== studio) return;
  studio.frameAll();
  for (const item of addItems) await studio.addItem(item, {}, { select: true });
  if (addItems.length) { saveRoomSoon(); toast(`${addItems[0].name} נוסף לחדר`); }
  updateRoomMeta();
  if (s.hints && !localStorage.getItem('livingroom.studioHint')) { localStorage.setItem('livingroom.studioHint', '1'); setTimeout(() => toast('גוררים פריט כדי להזיז, שתי אצבעות לסיבוב', 3600), 900); }
}

let roomSaveT;
function saveRoomSoon() {
  clearTimeout(roomSaveT);
  roomSaveT = setTimeout(saveRoom, 400);
  updateRoomMeta();
}
async function saveRoom({ snapshot = false } = {}) {
  const studio = state.studio, room = state.room;
  // while the room is still loading, saving now would drop the items not yet added
  if (!studio || !room || state.roomLoading) return;
  room.placements = studio.placements();
  room.name = $('#room-name').value.trim() || room.name;
  if (snapshot && room.placements.length) {
    studio.frameAll();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    room.snapshot = await downscaleDataUrl(studio.snapshot(), 640);
  }
  const saved = await roomsDb.put(room);
  const i = state.rooms.findIndex(r => r.id === room.id);
  if (i >= 0) state.rooms[i] = saved; else state.rooms.unshift(saved);
}
function updateRoomMeta() {
  const studio = state.studio;
  if (!studio) return;
  const list = studio.items();
  const total = list.reduce((s, i) => s + (Number(i.source?.price) || 0), 0);
  const size = state.room?.size ? `${len(state.room.size.w, { unit: false })} × ${len(state.room.size.l)}` : 'בלי קירות';
  $('#room-meta').textContent = `${size} · ${list.length} פריטים${total ? ` · ${price(total, 'ILS')}` : ''}`;
}

async function leaveStudio() {
  closeSheet();
  if (state.studio && state.room && state.studio.objects.size && !state.roomLoading) await saveRoom({ snapshot: true });
  state.roomLoading = false;
  state.studio?.dispose();
  state.studio = null;
  state.room = null;
  $('#selbar').hidden = true; $('#conflict').hidden = true;
  showView('home');
  history.replaceState(null, '', '#');
  renderHome();
}

function studioAddSheet() {
  const list = [...state.items, ...STARTER_ITEMS];
  const body = openSheet(`${sheetHead('הוספת פריט לחדר')}
    <div class="btn-row" style="margin-bottom:12px"><button class="btn btn-ghost btn-small" type="button" data-new="link">${icon('link')}מקישור</button><button class="btn btn-ghost btn-small" type="button" data-new="photo">${icon('camera')}מתמונה</button><button class="btn btn-ghost btn-small" type="button" data-new="manual">${icon('ruler')}לפי מידות</button></div>
    <div class="list">${list.map(i => `<button class="list-row" type="button" data-item="${esc(i.id)}"><img alt=""><span class="grow"><b>${esc(i.name)}</b><small>${dimsText(i.dims)}</small></span>${icon('plus')}</button>`).join('')}</div>`, { label: 'הוספת פריט' });
  for (const row of $$('[data-item]', body)) thumbnail(findItem(row.dataset.item)).then(u => { const img = row.querySelector('img'); if (u && img) img.src = u; });
  body.addEventListener('click', async e => {
    const n = e.target.closest('[data-new]');
    if (n) {
      if (n.dataset.new === 'link') { await leaveStudio(); $('#paste-input').focus(); toast('הדביקו קישור, ואחר כך ״הוסף לחדר״'); }
      if (n.dataset.new === 'photo') pickPhoto({ toRoom: true });
      if (n.dataset.new === 'manual') manualSheet({ toRoom: true });
      return;
    }
    const r = e.target.closest('[data-item]');
    if (!r || !state.studio) return;
    // ready-made items stay shared; they are copied only when edited
    const item = findItem(r.dataset.item);
    closeSheet();
    await state.studio.addItem(item, {}, { select: true });
    saveRoomSoon();
  });
}

function roomSizeSheet() {
  const size = state.room.size;
  const body = openSheet(`${sheetHead('מידות החדר', 'מודדים את החדר מקיר לקיר. הקירות עוזרים לראות אם הכול נכנס.')}
    <div class="room-size">
      <label class="dim"><span>רוחב</span><input type="number" inputmode="decimal" step="any" data-rs="w" value="${toField(size?.w || 420)}"></label>
      <label class="dim"><span>אורך</span><input type="number" inputmode="decimal" step="any" data-rs="l" value="${toField(size?.l || 380)}"></label>
    </div>
    <div class="btn-row" style="margin-top:18px"><button class="btn btn-primary" type="button" data-rs-save>${icon('check')}עדכון</button><button class="btn btn-ghost" type="button" data-rs-none>בלי קירות</button></div>`, { label: 'מידות החדר' });
  body.addEventListener('click', e => {
    if (e.target.closest('[data-rs-none]')) { state.room.size = null; state.studio.setRoom(null); closeSheet(); saveRoomSoon(); return; }
    if (!e.target.closest('[data-rs-save]')) return;
    const w = fromField($('[data-rs="w"]', body).value), l = fromField($('[data-rs="l"]', body).value);
    if (!(w > 50 && w < 5000 && l > 50 && l < 5000)) { toast('הזינו רוחב ואורך'); return; }
    state.room.size = { w: Math.round(w), l: Math.round(l) };
    state.studio.setRoom(state.room.size);
    for (const r of state.studio.objects.values()) state.studio.clampToRoom(r);
    state.studio.checkConflicts();
    state.studio.frameAll(true);
    closeSheet();
    saveRoomSoon();
  });
}

async function deleteRoom() {
  if (!state.room) return;
  await roomsDb.remove(state.room.id);
  state.rooms = state.rooms.filter(r => r.id !== state.room.id);
  state.room = null;
  state.studio?.clear();
  await leaveStudio();
  toast('החדר נמחק');
}

// ---------- settings ----------
async function settingsSheet() {
  const s = settings.get();
  const describe = h => (!api.hasServer() ? 'לא מחובר: מוסיפים פריטים מתמונה או לפי מידות' : !h ? 'לא עונה כרגע' : `${h.ai ? 'קריאת עמודים עם AI' : 'קריאת עמודים בסיסית'}${h.models3d ? ' · מודלים תלת-ממדיים' : ''}`);
  const status = api.hasServer() ? 'בודקים…' : describe(null);
  const body = openSheet(`${sheetHead('הגדרות')}
    <div class="sheet-section" style="margin-top:0"><span class="label">יחידות</span>${seg('units', [{ v: 'cm', label: 'סנטימטרים' }, { v: 'in', label: 'אינצ׳ים' }], s.units)}</div>
    <div class="sheet-section"><span class="label">מראה</span>${seg('theme', [{ v: 'auto', label: 'אוטומטי' }, { v: 'light', label: 'בהיר' }, { v: 'dark', label: 'כהה' }], s.theme)}</div>
    <div class="sheet-section"><span class="label">שרת</span><p class="hint" style="margin:0" id="server-status">${esc(status)}</p></div>
    <div class="sheet-section"><span class="label">הנתונים שלך</span><p class="hint" style="margin:0 0 10px">${state.items.length} פריטים ו-${state.rooms.length} חדרים שמורים במכשיר הזה בלבד.</p>
      <button class="btn btn-ghost btn-small" type="button" data-wipe style="color:var(--danger)">${icon('trash')}מחיקת הכול</button></div>`, { label: 'הגדרות' });
  if (api.hasServer()) api.health().then(h => { state.models3d = Boolean(h?.models3d); const el = $('#server-status', body); if (el) el.textContent = describe(h); });
  bindSeg(body, 'units', v => { settings.set({ units: v }); applySettings(); lastMine = lastRooms = null; $('#starters').innerHTML = ''; renderHome(); });
  bindSeg(body, 'theme', v => { settings.set({ theme: v }); applySettings(); });
  let armed = false;
  body.addEventListener('click', async e => {
    const w = e.target.closest('[data-wipe]');
    if (!w) return;
    if (!armed) { armed = true; w.innerHTML = `${icon('warning-circle')}לחיצה נוספת מוחקת`; return; }
    await clearAll();
    location.reload();
  });
}

// ---------- views & routing ----------
function showView(name) {
  for (const v of $$('.view')) v.hidden = v.id !== `view-${name}`;
  if (name === 'home') state.hero?.resume(); else state.hero?.pause();
}

async function route() {
  const h = location.hash;
  if (h.startsWith('#i/')) {
    const item = itemFromLink(h.slice(3));
    history.replaceState(null, '', '#');
    if (item) openItem(item);
    return;
  }
  if (h.startsWith('#room/') && !state.studio) { const id = h.slice(6); if (state.rooms.some(r => r.id === id)) openStudio(id); else history.replaceState(null, '', '#'); }
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const card = e.target.closest('#app [data-item]');
  if (card) { const it = findItem(card.dataset.item); if (it) openItem(it); return; }
  const roomCard = e.target.closest('#app [data-room]');
  if (roomCard) { openStudio(roomCard.dataset.room); return; }
  const a = e.target.closest('#app [data-act]');
  if (!a) return;
  const studio = state.studio;
  switch (a.dataset.act) {
    case 'settings': settingsSheet(); break;
    case 'clipboard':
      try { const t = await navigator.clipboard.readText(); if (t) { $('#paste-input').value = t.trim(); addFromUrl(t); } } catch { $('#paste-input').focus(); toast('הדביקו את הקישור בשדה'); }
      break;
    case 'add-photo': pickPhoto(); break;
    case 'add-manual': manualSheet(); break;
    case 'new-room': openStudio(null); break;
    case 'back': leaveStudio(); break;
    case 'room-size': roomSizeSheet(); break;
    case 'studio-add': studioAddSheet(); break;
    case 'toggle-dims': case 'toggle-clearance': case 'toggle-person': {
      const on = a.getAttribute('aria-pressed') !== 'true';
      a.setAttribute('aria-pressed', String(on));
      studio.setFlag(a.dataset.act.slice(7), on);
      break;
    }
    case 'toggle-night': {
      const on = a.getAttribute('aria-pressed') !== 'true';
      a.setAttribute('aria-pressed', String(on));
      a.querySelector('.dock-ic').innerHTML = icon(on ? 'sun' : 'moon');
      a.lastElementChild.textContent = on ? 'יום' : 'ערב';
      const from = on ? 0.45 : 1, to = on ? 1 : 0.45, t0 = performance.now();
      const step = () => { const k = Math.min(1, (performance.now() - t0) / (reduceMotion() ? 1 : 900)); studio.setDaylight(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      step();
      break;
    }
    case 'studio-ar': {
      const entries = studio.placements().map(p => ({ item: findItem(p.itemId), placement: p })).filter(x => x.item);
      if (!entries.length) { toast('הוסיפו פריט לחדר קודם'); break; }
      await saveRoom();
      launchAR(entries, { asGroup: entries.length > 1 });
      break;
    }
    case 'sel-rotl': studio.rotateSelected(15); break;
    case 'sel-rotr': studio.rotateSelected(-15); break;
    case 'sel-dup': studio.duplicateSelected(); break;
    case 'sel-del': studio.removeSelected(); break;
    case 'sel-info': if (studio.selected) openItem(studio.selected.userData.item); break;
  }
});

$('#paste-form').addEventListener('submit', e => { e.preventDefault(); addFromUrl($('#paste-input').value); });
$('#paste-input').addEventListener('paste', e => {
  const t = e.clipboardData?.getData('text');
  if (t && /https?:\/\//.test(t)) { e.preventDefault(); $('#paste-input').value = t.trim(); addFromUrl(t); }
});
$('#room-name').addEventListener('change', () => saveRoomSoon());
document.addEventListener('keydown', e => {
  if (!state.studio || e.target.matches('input, textarea')) return;
  if (e.key === 'Delete' || e.key === 'Backspace') state.studio.removeSelected();
  if (e.key.toLowerCase() === 'r') state.studio.rotateSelected(e.shiftKey ? -15 : 15);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { state.hero?.pause(); if (state.studio && state.room) saveRoom(); } else if (!$('#view-home').hidden) state.hero?.resume(); });
window.addEventListener('hashchange', route);

// ---------- image helpers ----------
async function downscale(blob, max) {
  const img = await loadImage(URL.createObjectURL(blob));
  if (!img) return blob;
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  if (s === 1 && blob.size < 2_500_000) return blob;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const type = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new Promise(r => c.toBlob(b => r(b || blob), type, 0.88));
}
function blobToDataUrl(blob) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); }
async function downscaleDataUrl(url, max) {
  const img = await loadImage(url);
  const s = Math.min(1, max / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

// ---------- start ----------
async function start() {
  applySettings();
  setupStatic();
  await loadData();
  renderHome();
  startHero().catch(e => console.warn('hero', e));
  api.health().then(h => { state.models3d = Boolean(h?.models3d); });
  for (const it of state.items) if (it.model?.task && it.model.status === 'running') pollModel(it.id);
  route();
  // Safari may clear site data after 7 days without a visit unless storage is persistent
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__livingroom = { state, openItem, openStudio, launchAR, findItem };
}
start();
