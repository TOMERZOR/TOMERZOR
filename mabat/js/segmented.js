// Segmented controls the iOS way: the selection is a thumb that slides between the options, and a
// finger dragged across the control carries the selection with it. Works on every .segmented in
// the page, including ones rendered later (a MutationObserver picks them up).
//
// A control that is rendered again after a change (the Updates tabs) keeps its key in data-seg, so
// the new thumb starts where the old one was and slides to the new option instead of jumping.

const lastIndex = new Map(); // data-seg -> index the thumb was last shown at
let drag = null; // { el, thumb, down, over } while a finger is on a control

const buttonsOf = el => [...el.children].filter(c => c.tagName === 'BUTTON');
const selectedIndex = el => buttonsOf(el).findIndex(b => b.classList.contains('is-on'));

function place(el, index, animate = true) {
  const thumb = el.querySelector(':scope > .seg-thumb');
  const b = buttonsOf(el)[index];
  if (!thumb || !b || !b.offsetWidth) return;
  thumb.style.transition = animate ? '' : 'none';
  thumb.style.width = `${b.offsetWidth}px`;
  thumb.style.setProperty('--x', `${b.offsetLeft}px`);
  thumb.hidden = false;
  if (!animate) void thumb.offsetWidth; // apply the jump before transitions come back
  if (el.dataset.seg) lastIndex.set(el.dataset.seg, index);
}

const follow = el => { const now = selectedIndex(el); if (now >= 0) place(el, now); };

// When a handler moves .is-on in place (settings, chart range), the thumb follows.
const classWatch = new MutationObserver(list => {
  const els = new Set(list.filter(m => m.target.tagName === 'BUTTON').map(m => m.target.closest('.segmented.has-thumb')).filter(Boolean));
  els.forEach(follow);
});

function enhance(el) {
  if (el.classList.contains('has-thumb')) return;
  el.classList.add('has-thumb');
  const thumb = document.createElement('span');
  thumb.className = 'seg-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  thumb.hidden = true;
  el.prepend(thumb);
  classWatch.observe(el, { subtree: true, attributes: true, attributeFilter: ['class'] });

  const start = el.dataset.seg && lastIndex.has(el.dataset.seg) ? lastIndex.get(el.dataset.seg) : selectedIndex(el);
  requestAnimationFrame(() => {
    if (start >= 0) place(el, start, false);
    requestAnimationFrame(() => follow(el));
  });

  el.addEventListener('pointerdown', e => {
    const b = e.target.closest('button');
    if (!b || b.parentElement !== el || e.button > 0) return;
    const down = buttonsOf(el).indexOf(b);
    drag = { el, thumb, down, over: down };
    // Pressing the selected option grabs the thumb, as on iOS.
    if (b.classList.contains('is-on')) thumb.classList.add('is-pressed');
  });
}

function indexAt(el, x) {
  let best = 0;
  let dist = Infinity;
  buttonsOf(el).forEach((b, k) => {
    const r = b.getBoundingClientRect();
    const d = Math.abs(x - (r.left + r.width / 2));
    if (d < dist) { dist = d; best = k; }
  });
  return best;
}

window.addEventListener('pointermove', e => {
  if (!drag) return;
  const k = indexAt(drag.el, e.clientX);
  if (k === drag.over) return;
  drag.over = k;
  place(drag.el, k);
  navigator.vibrate?.(6);
}, { passive: true });

const end = e => {
  if (!drag) return;
  const { el, thumb, down, over } = drag;
  drag = null;
  thumb.classList.remove('is-pressed');
  if (e.type === 'pointercancel') { follow(el); return; }
  // Released on another option than the one pressed: the browser sends no click there, so we do.
  if (over !== down) buttonsOf(el)[over]?.click();
};
window.addEventListener('pointerup', end);
window.addEventListener('pointercancel', end);
window.addEventListener('resize', () => document.querySelectorAll('.segmented.has-thumb').forEach(el => { const now = selectedIndex(el); if (now >= 0) place(el, now, false); }));

export function initSegmented(root = document.body) {
  const scan = node => {
    if (!(node instanceof Element)) return;
    if (node.matches('.segmented')) enhance(node);
    node.querySelectorAll('.segmented').forEach(enhance);
  };
  scan(root);
  new MutationObserver(list => { for (const m of list) m.addedNodes.forEach(scan); })
    .observe(root, { childList: true, subtree: true });
}
