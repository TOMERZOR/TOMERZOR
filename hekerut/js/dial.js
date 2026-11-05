// The dial: a big number and a ruler you drag across the whole width, with inertia and snapping.
// One accent color (the needle); the digit that changes rolls (up when the value grows), with a
// little motion blur; tabular figures so nothing shifts; a tick of vibration on every step where
// the phone supports it; arrow keys work too. The ruler runs as a number line (bigger to the right).
//
//   const d = mountDial(el, { min, max, value, label, unit, format, step, every, onChange })
//   d.set(value), d.destroy()

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function dialHtml({ title = '', unit = '', compact = false } = {}) {
  return `<div class="dial ${compact ? 'compact' : ''}" tabindex="0" role="slider">
    ${title ? `<div class="dial-title">${title}</div>` : ''}
    <div class="dial-num" aria-hidden="true"></div>
    ${unit ? `<div class="dial-unit">${unit}</div>` : ''}
    <div class="dial-ruler"><div class="dial-track"></div><i class="dial-needle"></i></div>
  </div>`;
}

export function mountDial(root, opts) {
  const o = { step: 1, every: 5, labels: 10, spacing: 12, format: v => String(v), unit: '', onChange() {}, ...opts };
  const el = root.matches('.dial') ? root : root.querySelector('.dial');
  const num = el.querySelector('.dial-num');
  const track = el.querySelector('.dial-track');
  const ruler = el.querySelector('.dial-ruler');
  const count = Math.round((o.max - o.min) / o.step);
  const gap = o.spacing;

  // Ticks: a long one every `every`, a label every `labels`.
  let ticks = '';
  for (let i = 0; i <= count; i++) {
    const v = o.min + i * o.step;
    const long = o.longFor ? o.longFor(v) : (v - o.min) % o.every === 0 || o.every === 1;
    const lab = o.labelFor ? o.labelFor(v) : (v - o.min) % o.labels === 0 ? o.format(v) : '';
    ticks += `<span class="tk ${long ? 'long' : ''}" style="left:${i * gap}px">${lab ? `<small>${lab}</small>` : ''}</span>`;
  }
  track.innerHTML = ticks;
  track.style.width = `${count * gap}px`;

  let pos = clamp((o.value ?? o.min) - o.min, 0, count * o.step) / o.step; // in steps, may be fractional
  let shown = null;
  let anim = 0;
  const valueAt = p => o.min + clamp(Math.round(p), 0, count) * o.step;

  function paint() {
    const w = ruler.clientWidth;
    track.style.transform = `translateX(${w / 2 - pos * gap}px)`;
    const v = valueAt(pos);
    if (v !== shown) {
      const up = shown === null ? 0 : v > shown ? 1 : -1;
      roll(num, o.format(v), up);
      if (shown !== null) { try { navigator.vibrate?.(4); } catch {} o.onChange(v); }
      shown = v;
      el.setAttribute('aria-valuenow', v);
      el.setAttribute('aria-valuetext', o.format(v) + (o.unit ? ` ${o.unit}` : ''));
    }
  }

  function animateTo(target, ms = 260) {
    cancelAnimationFrame(anim);
    const from = pos, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const tick = t => {
      const k = Math.min(1, (t - t0) / ms);
      pos = from + (target - from) * ease(k);
      paint();
      if (k < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }

  // Inertia: keep the flick's speed, slow down, then settle on a whole step.
  function glide(v) {
    cancelAnimationFrame(anim);
    let last = performance.now();
    const tick = t => {
      const dt = Math.min(32, t - last);
      last = t;
      pos = clamp(pos + (v * dt) / gap, 0, count);
      v *= Math.pow(0.992, dt);
      paint();
      if (Math.abs(v) > 0.02 && pos > 0 && pos < count) anim = requestAnimationFrame(tick);
      else animateTo(Math.round(pos), 220);
    };
    anim = requestAnimationFrame(tick);
  }

  let drag = null;
  const down = e => {
    if (e.button > 0) return;
    cancelAnimationFrame(anim);
    drag = { x: e.clientX, pos, t: performance.now(), v: 0, lastX: e.clientX };
    el.classList.add('dragging');
    el.setPointerCapture?.(e.pointerId);
  };
  const move = e => {
    if (!drag) return;
    e.preventDefault();
    const now = performance.now();
    const dx = e.clientX - drag.x;
    pos = clamp(drag.pos - dx / gap, 0, count);
    const dt = Math.max(1, now - drag.t);
    drag.v = 0.8 * (-(e.clientX - drag.lastX) / dt) + 0.2 * drag.v; // px per ms, along the ruler
    drag.lastX = e.clientX;
    drag.t = now;
    paint();
  };
  const up = () => {
    if (!drag) return;
    // A finger that stopped before lifting doesn't fling.
    const v = performance.now() - drag.t > 80 ? 0 : drag.v;
    drag = null;
    el.classList.remove('dragging');
    if (Math.abs(v) > 0.25) glide(v);
    else animateTo(Math.round(pos), 200);
  };
  const key = e => {
    const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
    if (!k) return;
    e.preventDefault();
    animateTo(clamp(Math.round(pos) + k, 0, count), 160);
  };
  const wheel = e => {
    e.preventDefault();
    animateTo(clamp(Math.round(pos) + Math.sign(e.deltaX || e.deltaY), 0, count), 120);
  };

  el.setAttribute('aria-valuemin', o.min);
  el.setAttribute('aria-valuemax', o.max);
  if (o.label) el.setAttribute('aria-label', o.label);
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('keydown', key);
  el.addEventListener('wheel', wheel, { passive: false });
  const ro = new ResizeObserver(() => paint());
  ro.observe(ruler);
  paint();

  return {
    get value() { return valueAt(pos); },
    set(v) { animateTo(clamp((v - o.min) / o.step, 0, count), 240); },
    // Change the range (a month's length for the day dial) and keep the value inside it.
    destroy() { cancelAnimationFrame(anim); ro.disconnect(); },
  };
}

// Replaces the text in `box` one character column at a time; only the columns that changed move.
// Words (a month's name) and a change of length roll as one piece.
export function roll(box, text, dir) {
  const numeric = /^\d+$/.test(text);
  const cols = [...box.children].filter(c => !c.classList.contains('whole'));
  if (!box.children.length || !dir) return primeNumber(box, text);
  if (!numeric || cols.length !== text.length || cols.length !== box.children.length) {
    const last = box.dataset.last || '';
    box.innerHTML = `<span class="col whole"><span class="ch out ${dir > 0 ? 'up' : 'down'}">${last}</span><span class="ch cur in ${dir > 0 ? 'up' : 'down'}">${text}</span></span>`;
    box.dataset.last = text;
    setTimeout(() => { if (box.dataset.last === text) primeNumber(box, text); }, 270);
    return;
  }
  [...text].forEach((c, i) => {
    const col = cols[i];
    const cur = col.querySelector('.ch.cur');
    if (!cur || cur.textContent === c) return;
    cur.classList.remove('cur', 'in', 'up', 'down');
    cur.classList.add('out', dir > 0 ? 'up' : 'down');
    const n = document.createElement('span');
    n.className = `ch cur in ${dir > 0 ? 'up' : 'down'}`;
    n.textContent = c;
    col.append(n);
    setTimeout(() => cur.remove(), 260);
  });
  box.dataset.last = text;
}

// The number at rest: a column per digit (so a change moves only its digit), or one piece for words.
export function primeNumber(box, text) {
  box.innerHTML = /^\d+$/.test(text)
    ? [...text].map(c => `<span class="col"><span class="ch cur">${c}</span></span>`).join('')
    : `<span class="col whole"><span class="ch cur">${text}</span></span>`;
  box.dataset.last = text;
}
