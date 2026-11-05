// Sheets (stacking, swipe down to close), alerts, toasts and menus, with iOS-like motion.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const tick = () => { try { navigator.vibrate?.(6); } catch {} };

export const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const stack = [];

function dispatch(root, ctx, handlers) {
  root.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = handlers.on?.[el.dataset.act];
    if (fn) { ev.preventDefault(); fn(el, ev, ctx); }
  });
  const onField = ev => {
    const el = ev.target.closest('[data-field]');
    if (el && handlers.field) handlers.field(el, ev, ctx);
  };
  root.addEventListener('input', onField);
  root.addEventListener('change', onField);
}

// opts: { title, sub, render(sheet) → html, on: { act(el, ev, sheet) }, field(el, ev, sheet),
//         cancel: label | false, done: { label, act } , live, wide, onClose }
export function openSheet(opts) {
  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  layer.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet${opts.wide ? ' wide' : ''}" role="dialog" aria-modal="true" tabindex="-1">
      <div class="grabber" aria-hidden="true"></div>
      <header class="sheet-head"></header>
      <div class="sheet-body"></div>
    </section>`;
  const el = layer.querySelector('.sheet');
  const head = layer.querySelector('.sheet-head');
  const body = layer.querySelector('.sheet-body');
  const returnFocus = document.activeElement;

  const sheet = {
    el, body, opts, layer, data: opts.data || {},
    close, update,
    setTitle(t, sub) { opts.title = t; if (sub !== undefined) opts.sub = sub; paintHead(); },
  };

  function paintHead() {
    const cancel = opts.cancel === false ? '' : `<button class="sh-btn" data-act="__close">${h(opts.cancel || (opts.done ? 'ביטול' : 'סיום'))}</button>`;
    const done = opts.done ? `<button class="sh-btn strong" data-act="${opts.done.act || '__done'}">${h(opts.done.label)}</button>` : '<span class="sh-btn ghost"></span>';
    head.innerHTML = `${cancel || '<span class="sh-btn ghost"></span>'}<div class="sh-title"><h2>${h(opts.title || '')}</h2>${opts.sub ? `<p>${h(opts.sub)}</p>` : ''}</div>${done}`;
    el.setAttribute('aria-label', opts.title || '');
  }

  function update() {
    const top = body.scrollTop;
    body.innerHTML = opts.render(sheet);
    body.scrollTop = top;
    opts.mounted?.(sheet);
  }

  const on = { ...opts.on, __close: () => close() };
  dispatch(layer, sheet, { on, field: opts.field });
  layer.querySelector('[data-close]').addEventListener('click', () => close());

  paintHead();
  body.innerHTML = opts.render(sheet);
  document.body.appendChild(layer);

  const prev = stack[stack.length - 1];
  prev?.el.classList.add('behind');
  stack.push(sheet);
  document.documentElement.classList.add('has-sheet');
  layer.style.zIndex = 100 + stack.length * 2;

  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
  opts.mounted?.(sheet);
  setTimeout(() => { if (!el.contains(document.activeElement)) el.focus({ preventScroll: true }); }, 60);

  enableDrag(sheet);

  let closed = false;
  function close() {
    if (closed) return Promise.resolve();
    closed = true;
    const i = stack.indexOf(sheet);
    if (i >= 0) stack.splice(i, 1);
    stack[stack.length - 1]?.el.classList.remove('behind');
    if (!stack.length) document.documentElement.classList.remove('has-sheet');
    layer.classList.remove('open');
    layer.classList.add('closing');
    el.style.transform = '';
    opts.onClose?.();
    try { returnFocus?.focus?.({ preventScroll: true }); } catch {}
    return new Promise(res => setTimeout(() => { layer.remove(); res(); }, reduced() ? 10 : 360));
  }

  return sheet;
}

export function refreshLive() {
  for (const s of stack) if (s.opts.live) s.update();
}
export const topSheet = () => stack[stack.length - 1];
export const closeAll = () => Promise.all([...stack].reverse().map(s => s.close()));

function enableDrag(sheet) {
  const { el, layer } = sheet;
  let y0 = null, t0 = 0, dy = 0, fromBody = false;
  const start = ev => {
    if (matchMedia('(min-width: 760px)').matches) return;
    const inBody = sheet.body.contains(ev.target);
    if (ev.target.closest('button, input, select, textarea, a, label') && !ev.target.closest('.grabber')) return;
    if (inBody && sheet.body.scrollTop > 0) return;
    fromBody = inBody;
    y0 = ev.clientY; t0 = performance.now(); dy = 0;
  };
  const move = ev => {
    if (y0 == null) return;
    dy = Math.max(0, ev.clientY - y0);
    if (fromBody && dy < 8) return;
    if (dy > 0) {
      el.classList.add('dragging');
      el.style.transform = `translateY(${dy}px)`;
      layer.style.setProperty('--fade', String(Math.max(0, 1 - dy / 500)));
      if (ev.cancelable) ev.preventDefault();
    }
  };
  const end = () => {
    if (y0 == null) return;
    const v = dy / Math.max(1, performance.now() - t0);
    y0 = null;
    el.classList.remove('dragging');
    layer.style.removeProperty('--fade');
    if (dy > 130 || (v > 0.6 && dy > 30)) sheet.close();
    else el.style.transform = '';
  };
  el.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

addEventListener('keydown', ev => {
  if (ev.key === 'Escape') {
    if (document.querySelector('.alert-layer')) return;
    if (document.querySelector('.menu-layer')) return;
    topSheet()?.close();
  }
});

/* ---------- Alert ---------- */

export function confirmDialog({ title, message = '', ok = 'אישור', cancel = 'ביטול', danger = false }) {
  return new Promise(resolve => {
    const layer = document.createElement('div');
    layer.className = 'alert-layer';
    layer.innerHTML = `
      <div class="alert" role="alertdialog" aria-modal="true" aria-labelledby="al-t">
        <div class="alert-text"><h3 id="al-t">${h(title)}</h3>${message ? `<p>${h(message)}</p>` : ''}</div>
        <div class="alert-btns">
          ${cancel ? `<button data-v="0">${h(cancel)}</button>` : ''}
          <button data-v="1" class="${danger ? 'danger' : 'strong'}">${h(ok)}</button>
        </div>
      </div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
    const btns = layer.querySelectorAll('button');
    setTimeout(() => btns[btns.length - 1].focus(), 50);
    const done = v => {
      layer.classList.remove('open');
      layer.classList.add('closing');
      removeEventListener('keydown', key);
      setTimeout(() => layer.remove(), reduced() ? 10 : 220);
      resolve(v);
    };
    const key = ev => { if (ev.key === 'Escape') done(false); };
    addEventListener('keydown', key);
    layer.addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (b) done(b.dataset.v === '1');
    });
  });
}

/* ---------- Toast ---------- */

let toastEl = null, toastTimer = 0;
export function toast(msg, { action, icon = '' } = {}) {
  if (toastEl) { toastEl.remove(); clearTimeout(toastTimer); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon}<span>${h(msg)}</span>${action ? `<button>${h(action.label)}</button>` : ''}`;
  document.body.appendChild(el);
  toastEl = el;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  const hide = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
    if (toastEl === el) toastEl = null;
  };
  if (action) el.querySelector('button').addEventListener('click', () => { action.fn(); hide(); });
  toastTimer = setTimeout(hide, action ? 5000 : 2600);
}

/* ---------- Menu (popover) ---------- */

export function menu(anchor, items) {
  const layer = document.createElement('div');
  layer.className = 'menu-layer';
  layer.innerHTML = `<div class="menu" role="menu">${items.map((it, i) =>
    `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon || ''}<span>${h(it.label)}</span></button>`).join('')}</div>`;
  document.body.appendChild(layer);
  const m = layer.querySelector('.menu');
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth, hgt = m.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  if (document.dir === 'rtl' || document.documentElement.dir === 'rtl') left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8);
  let top = r.bottom + 8;
  if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 8);
  m.style.left = left + 'px';
  m.style.top = top + 'px';
  m.style.transformOrigin = `${r.left + r.width / 2 - left}px ${top > r.top ? 0 : hgt}px`;
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('open')));
  const close = () => { layer.classList.remove('open'); setTimeout(() => layer.remove(), 200); removeEventListener('keydown', key); };
  const key = ev => { if (ev.key === 'Escape') close(); };
  addEventListener('keydown', key);
  layer.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-i]');
    close();
    if (b) items[+b.dataset.i].act();
  });
  setTimeout(() => m.querySelector('button')?.focus(), 30);
}

/* ---------- Delegation for the main view ---------- */

export function bind(root, handlers) {
  dispatch(root, null, handlers);
}
