// The journey: the service as a timeline you scrub like the age dial. A ruler of months (years
// marked) slides under one needle, with inertia and snapping to a month; above it the month rolls
// and cards show what was happening then: the mechina, the draft and tironut, every role and
// course with its unit or place, the release. Below the ruler, a colored bar for each of them.

import { icon } from './icons.js';
import { roll, primeNumber } from './dial.js';
import { CORPS, PREP, MONTHS, monthKey, rangeLabel, prettyLevel, corpsName, serviceClock, gen } from './core.js';

const GAP = 22; // px per month
const LANE = 20; // px per lane of bars
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nowKey = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); };

function unitText(u) {
  const c = CORPS[u?.corps];
  if (!c) return '';
  const chain = (u.path || []).map((v, i) => (v ? prettyLevel(c.levels[i], v) : '')).filter(Boolean);
  return [corpsName(u.corps), ...chain].join(' · ');
}

// Everything on the timeline, in months (year * 12 + month - 1).
export function buildJourney(p) {
  const today = nowKey();
  const draft = p.draft ? monthKey(p.draft) : 0;
  const clock = p.draft && (p.status === 'active' || p.status === 'pre') ? serviceClock(p) : null;
  const release = p.release ? monthKey(p.release) : clock ? monthKey(clock.end) : 0;
  const items = [];
  if (draft && p.prep?.kind && p.prep.kind !== 'none') {
    items.push({ id: 'prep', kind: 'prep', from: draft - 9, to: draft - 1, title: p.prep.name || PREP[p.prep.kind], sub: `${PREP[p.prep.kind]} · לפני הצבא`, ic: 'tent', approx: true });
  }
  if (draft) {
    items.push({ id: 'draft', kind: 'draft', at: draft, title: 'גיוס', sub: p.tironut ? `טירונות ב${p.tironut}` : '', ic: 'flag' });
    if (p.tironut) items.push({ id: 'tir', kind: 'tironut', from: draft, to: draft + 3, title: 'טירונות', sub: p.tironut, ic: 'flag', approx: true });
  }
  (p.roles || []).forEach((r, i) => {
    if (!r.from) return;
    const from = monthKey(r.from);
    const to = r.to ? monthKey(r.to) + (r.to.length === 4 ? 11 : 0) : Math.max(from, today);
    const where = [r.place && `ב${r.place}`, unitText(r.unit)].filter(Boolean).join(' · ');
    items.push({ id: `r${i}`, kind: r.kind === 'course' ? 'course' : 'role', from, to, title: r.t, sub: [where, rangeLabel(r)].filter(Boolean).join(' · '), ic: r.kind === 'course' ? 'sparkle' : 'badge', now: !r.to });
  });
  if (release) items.push({ id: 'release', kind: 'release', at: release, title: release > today ? 'שחרור (משוער)' : 'שחרור', sub: '', ic: 'heart' });

  const keys = [today, ...items.flatMap(x => (x.at ? [x.at] : [x.from, x.to]))].filter(Boolean);
  const start = Math.min(...keys) - 2, end = Math.max(...keys) + 3;
  // Bars share lanes when they don't overlap.
  const lanes = [];
  for (const x of items.filter(x => x.from).sort((a, b) => a.from - b.from)) {
    let lane = lanes.findIndex(lastEnd => lastEnd < x.from);
    if (lane < 0) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = x.to;
    x.lane = lane;
  }
  return { items, start, end, today, draft, release, lanes: Math.max(1, lanes.length) };
}

export function journeyHtml(p, { title = '' } = {}) {
  const j = buildJourney(p);
  if (!j.items.length) return '';
  const months = j.end - j.start;
  let ticks = '';
  for (let i = 0; i <= months; i++) {
    const k = j.start + i, m = k % 12;
    ticks += `<span class="jt ${m === 0 ? 'yr' : m === 6 ? 'half' : ''}" style="left:${i * GAP}px">${m === 0 ? `<small>${Math.floor(k / 12)}</small>` : ''}</span>`;
  }
  const bars = j.items.filter(x => x.from).map(x => `<button type="button" class="jbar k-${x.kind} ${x.now ? 'now' : ''} ${x.approx ? 'approx' : ''}" data-jgo="${x.from}" style="left:${(x.from - j.start) * GAP}px;width:${Math.max(1, x.to - x.from + 1) * GAP - 3}px;top:${x.lane * LANE}px"><span>${esc(x.title)}</span></button>`).join('');
  const marks = j.items.filter(x => x.at).map(x => `<button type="button" class="jmark k-${x.kind}" data-jgo="${x.at}" style="left:${(x.at - j.start) * GAP + GAP / 2}px">${icon(x.ic)}</button>`).join('')
    + `<span class="jtoday" style="left:${(j.today - j.start) * GAP + GAP / 2}px"><small>היום</small></span>`;
  return `<section class="journey" data-journey style="--lanes:${j.lanes}">
    <div class="j-top">
      <small class="j-title">${esc(title)}</small>
      <div class="j-date"><span class="j-m" aria-hidden="true"></span><span class="j-y" aria-hidden="true"></span></div>
      <div class="j-ctx"></div>
    </div>
    <div class="j-cards" aria-live="polite"></div>
    <div class="j-ruler" role="slider" tabindex="0" aria-label="ציר הזמן של השירות">
      <div class="j-move" style="width:${(months + 1) * GAP}px">
        <div class="j-bars">${bars}</div>
        <div class="j-marks">${marks}</div>
        <div class="j-ticks">${ticks}</div>
      </div>
      <i class="j-needle"></i>
    </div>
    <small class="j-hint">${icon('back')}גררו כדי לנוע בזמן${icon('chevron')}</small>
  </section>`;
}

// What's going on at month k: the cards, and a line of context (month N of the service…).
function at(j, k, p) {
  const live = j.items.filter(x => (x.at ? x.at === k : x.from <= k && k <= x.to));
  let ctx = '';
  if (j.draft && k < j.draft) ctx = `${j.draft - k === 1 ? 'עוד חודש' : `עוד ${j.draft - k} חודשים`} לגיוס`;
  else if (j.draft && (!j.release || k < j.release)) ctx = k > j.today ? 'בעתיד' : `חודש ${k - j.draft + 1} בשירות`;
  else if (j.release && k >= j.release) ctx = k === j.release ? (k > j.today ? 'השחרור המשוער' : 'השחרור') : `${gen(p, 'משוחרר', 'משוחררת')} ${k - j.release === 1 ? 'חודש' : `${k - j.release} חודשים`}`;
  return { live, ctx };
}

// opts: { at: a month to start on (to keep the place across redraws), sweep: travel to today when first seen, onMove(month) }
export function mountJourney(root, p, { at: startAt = null, sweep = true, onMove = () => {} } = {}) {
  const el = root.querySelector('[data-journey]');
  if (!el) return null;
  const j = buildJourney(p);
  const count = j.end - j.start;
  const ruler = el.querySelector('.j-ruler');
  const move = el.querySelector('.j-move');
  const mBox = el.querySelector('.j-m'), yBox = el.querySelector('.j-y');
  const cards = el.querySelector('.j-cards'), ctxEl = el.querySelector('.j-ctx');
  let pos = clamp((startAt ?? (sweep ? j.draft || j.today : j.today)) - j.start, 0, count);
  let shown = null, shownSet = '', anim = 0;

  function paint() {
    move.style.transform = `translateX(${ruler.clientWidth / 2 - pos * GAP - GAP / 2}px)`;
    const k = j.start + clamp(Math.round(pos), 0, count);
    if (k === shown) return;
    const dir = shown === null ? 0 : k > shown ? 1 : -1;
    const m = MONTHS[k % 12], y = String(Math.floor(k / 12));
    if (shown === null) { primeNumber(mBox, m); primeNumber(yBox, y); } else {
      if (mBox.dataset.last !== m) roll(mBox, m, dir);
      if (yBox.dataset.last !== y) roll(yBox, y, dir);
      try { navigator.vibrate?.(3); } catch {}
    }
    shown = k;
    onMove(k);
    ruler.setAttribute('aria-valuetext', `${m} ${y}`);
    const { live, ctx } = at(j, k, p);
    ctxEl.textContent = ctx;
    const key = live.map(x => x.id).join(',');
    if (key !== shownSet) {
      shownSet = key;
      cards.innerHTML = live.length ? live.map((x, i) => `<div class="j-card k-${x.kind}" style="--i:${i}">
          <span class="jc-ic">${icon(x.ic)}</span>
          <div><small>${{ prep: 'לפני הצבא', draft: 'אבן דרך', tironut: 'טירונות', role: x.now ? 'תפקיד · עכשיו' : 'תפקיד', course: 'קורס', release: 'אבן דרך' }[x.kind]}</small><b>${esc(x.title)}</b>${x.sub ? `<span>${esc(x.sub)}</span>` : ''}</div>
        </div>`).join('')
        : `<div class="j-card empty"><span class="jc-ic">${icon('calendar')}</span><div><b>${esc(ctx || 'חודש שקט')}</b><span>אין כאן תפקיד או קורס</span></div></div>`;
    }
  }

  function animateTo(target, ms = 320) {
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
  function glide(v) {
    cancelAnimationFrame(anim);
    let last = performance.now();
    const tick = t => {
      const dt = Math.min(32, t - last);
      last = t;
      pos = clamp(pos + (v * dt) / GAP, 0, count);
      v *= Math.pow(0.993, dt);
      paint();
      if (Math.abs(v) > 0.02 && pos > 0 && pos < count) anim = requestAnimationFrame(tick);
      else animateTo(Math.round(pos), 240);
    };
    anim = requestAnimationFrame(tick);
  }

  // Drag anywhere on the card, sideways; up and down still scroll the page.
  let drag = null;
  el.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    cancelAnimationFrame(anim);
    drag = { x: e.clientX, y: e.clientY, pos, t: performance.now(), v: 0, lastX: e.clientX, moved: false, id: e.pointerId };
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      el.classList.add('dragging');
      try { el.setPointerCapture(drag.id); } catch {}
    }
    const now = performance.now();
    pos = clamp(drag.pos - dx / GAP, 0, count);
    drag.v = 0.8 * (-(e.clientX - drag.lastX) / Math.max(1, now - drag.t)) + 0.2 * drag.v;
    drag.lastX = e.clientX;
    drag.t = now;
    paint();
  });
  const up = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    el.classList.remove('dragging');
    if (!d.moved) return;
    el.dataset.dragged = '1';
    setTimeout(() => delete el.dataset.dragged, 0);
    const v = performance.now() - d.t > 80 ? 0 : d.v;
    if (Math.abs(v) > 0.25) glide(v); else animateTo(Math.round(pos), 220);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', () => { if (drag) { drag = null; el.classList.remove('dragging'); animateTo(Math.round(pos), 220); } });
  // A tap on a bar or a mark goes to its start.
  el.addEventListener('click', e => {
    if (el.dataset.dragged) return;
    const b = e.target.closest('[data-jgo]');
    if (b) animateTo(clamp(+b.dataset.jgo - j.start, 0, count), 520);
  });
  ruler.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowLeft: -1, PageUp: 12, PageDown: -12 }[e.key];
    if (!k) return;
    e.preventDefault();
    animateTo(clamp(Math.round(pos) + k, 0, count), 200);
  });

  const ro = new ResizeObserver(() => paint());
  ro.observe(ruler);
  paint();
  // The first time it's seen, it travels from the draft to today.
  const io = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    if (sweep && startAt === null) setTimeout(() => animateTo(clamp(j.today - j.start, 0, count), 1300), 250);
  }, { threshold: 0.4 });
  io.observe(el);
  return { destroy() { cancelAnimationFrame(anim); ro.disconnect(); io.disconnect(); } };
}
