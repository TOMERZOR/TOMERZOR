// UI shared by the website and the Premiere panel: the style controls and the editable caption list.
import { ANIMATIONS, FONTS, DEFAULT_STYLE, buildPages, drawCaptions } from './render.js';

export function styleControlsHTML() {
  return `
      <h3>אנימציה</h3>
      <div class="anims" id="anims"></div>
      <div class="field">
        <label for="speed">מהירות <output id="speedOut"></output></label>
        <input type="range" id="speed" min="0.5" max="2" step="0.1">
      </div>

      <h3>טקסט</h3>
      <div class="field">
        <label for="size">גודל <output id="sizeOut"></output></label>
        <input type="range" id="size" min="3" max="14" step="0.5">
      </div>
      <div class="field two">
        <div>
          <label>מילים בשורה</label>
          <div class="stepper" id="wplStep">
            <button data-d="-1" aria-label="פחות מילים"><i class="ph ph-minus"></i></button>
            <output id="wplOut">3</output>
            <button data-d="1" aria-label="יותר מילים"><i class="ph ph-plus"></i></button>
          </div>
        </div>
        <div>
          <label>שורות</label>
          <div class="seg" id="linesSeg">
            <button data-v="1">1</button><button data-v="2">2</button>
          </div>
        </div>
      </div>
      <div class="field">
        <label>גופן</label>
        <div class="fonts" id="fonts"></div>
      </div>
      <div class="field two">
        <div>
          <label>צבע טקסט</label>
          <div class="swatches" data-for="color"></div>
        </div>
        <div>
          <label>צבע הדגשה</label>
          <div class="swatches" data-for="hi"></div>
        </div>
      </div>

      <h3>קו מתאר וצל</h3>
      <div class="field">
        <label for="stroke">עובי קו מתאר <output id="strokeOut"></output></label>
        <div class="with-color"><input type="range" id="stroke" min="0" max="20" step="1"><input type="color" id="strokeColor" aria-label="צבע קו המתאר"></div>
      </div>
      <div class="field">
        <label for="shadow">עוצמת צל <output id="shadowOut"></output></label>
        <div class="with-color"><input type="range" id="shadow" min="0" max="100" step="1"><input type="color" id="shadowColor" aria-label="צבע הצל"></div>
      </div>
      <div class="field two">
        <div>
          <label for="shadowBlur">ריכוך <output id="shadowBlurOut"></output></label>
          <input type="range" id="shadowBlur" min="0" max="80" step="1">
        </div>
        <div>
          <label for="shadowDist">מרחק <output id="shadowDistOut"></output></label>
          <input type="range" id="shadowDist" min="0" max="30" step="1">
        </div>
      </div>

      <h3>מיקום ועוד</h3>
      <div class="field">
        <label for="posY">גובה על המסך</label>
        <input type="range" id="posY" min="0.08" max="0.95" step="0.01">
      </div>
      <label class="toggle"><input type="checkbox" id="bg"><span>רקע כהה מאחורי השורה</span></label>
      <label class="toggle"><input type="checkbox" id="upper"><span>אותיות גדולות (English)</span></label>
      <button class="link" id="resetStyle"><i class="ph ph-arrow-u-up-left"></i> חזרה לברירת המחדל</button>`;
}

const RANGES = { speed: (v) => `×${(+v).toFixed(1)}`, size: (v) => v, stroke: (v) => v, shadow: (v) => v + '%', shadowBlur: (v) => v, shadowDist: (v) => v, posY: null };
const PALETTE = { color: ['#ffffff', '#ffe14d', '#111111', '#ff5c8a', '#5ce1e6'], hi: ['#ffe14d', '#7cff6b', '#ff5c8a', '#5ce1e6', '#ff8a3d', '#b18cff'] };

// Three words on a loop for the animation tiles; the last word is held so the loop is rarely empty.
const DEMO = (() => {
  const words = [];
  let t = 0.15;
  for (const w of ['כך', 'זה', 'זז']) { words.push({ text: w, start: t, end: t + 0.4 }); t += 0.45; }
  words[2].end = 1.9;
  return { words, loop: 2.4 };
})();

// Fills `root` with the style controls and wires them. Returns sync(), which redraws the controls from the style.
export function mountStyle(root, { getStyle, setStyle, reset, isVisible }) {
  root.innerHTML = styleControlsHTML();
  const q = (id) => root.querySelector('#' + id);

  for (const k of Object.keys(RANGES)) q(k).oninput = (e) => setStyle(k, +e.target.value);
  for (const k of ['strokeColor', 'shadowColor']) q(k).oninput = (e) => setStyle(k, e.target.value);
  for (const k of ['bg', 'upper']) q(k).onchange = (e) => setStyle(k, e.target.checked);
  q('wplStep').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) setStyle('wordsPerLine', Math.min(8, Math.max(1, getStyle().wordsPerLine + +b.dataset.d)));
  };
  q('linesSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) setStyle('lines', +b.dataset.v); };
  q('resetStyle').onclick = () => reset({ ...DEFAULT_STYLE });

  q('fonts').innerHTML = FONTS.map((f) => `<button data-font="${f.id}" style="font-family:'${f.id}';font-weight:${f.weight}" title="${f.id}">${f.label}</button>`).join('');
  q('fonts').onclick = (e) => { const b = e.target.closest('button'); if (b) setStyle('font', b.dataset.font); };

  root.querySelectorAll('.swatches').forEach((box) => {
    const k = box.dataset.for;
    box.innerHTML = PALETTE[k].map((c) => `<button data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') + `<input type="color" aria-label="צבע אחר">`;
    box.onclick = (e) => { const b = e.target.closest('button'); if (b) setStyle(k, b.dataset.c); };
    box.querySelector('input').oninput = (e) => setStyle(k, e.target.value);
  });

  // Animation tiles, each with a live preview of its animation in the current style.
  const anims = q('anims');
  anims.innerHTML = ANIMATIONS.map((a) => `<button class="anim" data-anim="${a.id}"><canvas width="240" height="160"></canvas><span>${a.label}</span></button>`).join('');
  anims.onclick = (e) => { const b = e.target.closest('.anim'); if (b) setStyle('anim', b.dataset.anim); };
  const tiles = new Map();
  const drawTiles = (now) => {
    if (isVisible()) {
      const t = (now / 1000) % DEMO.loop;
      for (const b of anims.children) {
        const c = b.querySelector('canvas'), ctx = c.getContext('2d');
        const st = { ...getStyle(), anim: b.dataset.anim, size: 21, posY: 0.5, wordsPerLine: 3, lines: 1 };
        if (!tiles.has(b.dataset.anim)) tiles.set(b.dataset.anim, { pages: buildPages(DEMO.words, st), state: {} });
        const ts = tiles.get(b.dataset.anim);
        ctx.clearRect(0, 0, c.width, c.height);
        drawCaptions(ctx, c.width, c.height, t, DEMO.words, ts.pages, st, ts.state);
      }
    }
    requestAnimationFrame(drawTiles);
  };
  requestAnimationFrame(drawTiles);
  document.fonts.ready.then(() => tiles.forEach((v) => (v.state = {})));

  return function sync() {
    const s = getStyle();
    for (const [k, f] of Object.entries(RANGES)) {
      q(k).value = s[k];
      if (f && q(k + 'Out')) q(k + 'Out').textContent = f(s[k]);
    }
    q('strokeColor').value = s.strokeColor;
    q('shadowColor').value = s.shadowColor;
    q('bg').checked = s.bg;
    q('upper').checked = s.upper;
    q('wplOut').textContent = s.wordsPerLine;
    root.querySelectorAll('#linesSeg button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === s.lines));
    root.querySelectorAll('#fonts button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.font === s.font));
    root.querySelectorAll('#anims .anim').forEach((b) => b.setAttribute('aria-pressed', b.dataset.anim === s.anim));
    root.querySelectorAll('.swatches').forEach((box) => {
      const v = s[box.dataset.for];
      box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c.toLowerCase() === v.toLowerCase()));
      box.querySelector('input').value = v;
    });
  };
}

export const pageText = (words, pg) => pg.idx.map((i) => words[i].text).join(' ');

// Replaces a caption's words with edited text, in place. Same word count keeps every word's timing;
// otherwise the caption's time is shared between the new words by length. Returns false if nothing changed.
export function editWords(words, pg, raw) {
  const parts = raw.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (parts.join(' ') === pageText(words, pg)) return false;
  const old = pg.idx.map((i) => words[i]);
  let fresh;
  if (parts.length === old.length) {
    fresh = old.map((w, k) => ({ ...w, text: parts[k] }));
  } else {
    const s = old[0].start, e = old[old.length - 1].end;
    const weights = parts.map((p) => p.length + 2), total = weights.reduce((a, b) => a + b, 0);
    let at = s;
    fresh = parts.map((p, k) => { const d = ((e - s) * weights[k]) / total; const w = { text: p, start: at, end: at + d }; at += d; return w; });
  }
  words.splice(pg.idx[0], pg.idx.length, ...fresh);
  return true;
}

// Renders the editable caption list. Skips the render while a caption is being typed in.
export function renderCaptionList(ol, { words, pages, fmt, onSeek, onFocus, onCommit, onDelete, onRedo }) {
  const active = document.activeElement;
  if (active?.classList?.contains('txt') && ol.contains(active)) return;
  const frag = document.createDocumentFragment();
  pages.forEach((pg, n) => {
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
    txt.textContent = pageText(words, pg);
    txt.dir = 'auto';
    li.querySelector('time').onclick = () => onSeek(pg);
    txt.onfocus = () => onFocus(pg);
    txt.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); txt.blur(); } if (e.key === 'Escape') { txt.textContent = pageText(words, pg); txt.blur(); } };
    txt.onblur = () => onCommit(pg, txt.textContent);
    li.querySelector('[data-act=del]').onclick = () => onDelete(pg);
    li.querySelector('[data-act=redo]').onclick = () => onRedo(pg, li);
    frag.append(li);
  });
  ol.replaceChildren(frag);
}
