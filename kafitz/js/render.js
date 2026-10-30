// Caption renderer. Draws captions for time t onto a 2D canvas.
// The same code runs for the live preview and for the exported video, so what you see is what you get.
// Every animation is a pure function of t, so seeking and exporting frame by frame give identical results.

export const FONTS = [
  { id: 'Rubik', label: 'רוביק', weight: 900 },
  { id: 'Heebo', label: 'היבו', weight: 900 },
  { id: 'Secular One', label: 'סקולר', weight: 400 },
  { id: 'Suez One', label: 'סואץ', weight: 400 },
  { id: 'Fredoka', label: 'פרדוקה', weight: 700 },
  { id: 'Karantina', label: 'קרנטינה', weight: 700 },
  { id: 'Varela Round', label: 'ורלה', weight: 400 },
  { id: 'Assistant', label: 'אסיסטנט', weight: 800 },
];

export const ANIMATIONS = [
  { id: 'pop', label: 'פופ' },
  { id: 'box', label: 'בועה' },
  { id: 'karaoke', label: 'קריוקי' },
  { id: 'bounce', label: 'קפיצה' },
  { id: 'punch', label: 'זום' },
  { id: 'type', label: 'הקלדה' },
  { id: 'slide', label: 'החלקה' },
  { id: 'glow', label: 'ניאון' },
  { id: 'none', label: 'ללא' },
];

export const DEFAULT_STYLE = {
  anim: 'pop',
  speed: 1,
  font: 'Rubik',
  size: 7,            // percent of the video's shorter side
  color: '#ffffff',
  hi: '#ffe14d',      // highlight colour for the word being spoken
  stroke: 9,          // outline width, percent of font size
  strokeColor: '#111111',
  shadow: 60,         // shadow opacity 0..100
  shadowBlur: 25,     // percent of font size
  shadowDist: 8,      // percent of font size
  shadowColor: '#000000',
  wordsPerLine: 3,
  lines: 1,
  posY: 0.72,         // vertical centre of the caption block, 0 top .. 1 bottom
  upper: false,
  bg: false,          // translucent band behind each line
};

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const SENTENCE_END = /[.!?…؟]["'”’)]*$/;

export const isRTL = (s) => RTL_RE.test(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x, s = 1.70158) => { const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
function easeOutBounce(x) {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
}

// Groups words into on-screen pages of up to wordsPerLine * lines words.
// A new page also starts after a pause or at the end of a sentence, so captions follow speech.
export function buildPages(words, style) {
  const per = Math.max(1, style.wordsPerLine | 0);
  const max = per * Math.max(1, style.lines | 0);
  const pages = [];
  let cur = null;
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const gap = prev ? w.start - prev.end : 0;
    const breakHere = !cur || cur.idx.length >= max || gap > 0.7 || (prev && SENTENCE_END.test(prev.text) && cur.idx.length >= 1);
    if (breakHere) { cur = { idx: [] }; pages.push(cur); }
    cur.idx.push(i);
  });
  for (let p = 0; p < pages.length; p++) {
    const pg = pages[p];
    const first = words[pg.idx[0]], last = words[pg.idx[pg.idx.length - 1]];
    const next = pages[p + 1] ? words[pages[p + 1].idx[0]] : null;
    pg.start = first.start;
    pg.end = Math.max(last.end + 0.35, pg.start + 0.6);
    if (next) pg.end = Math.min(pg.end, next.start);
    pg.lines = [];
    const n = pg.idx.length, nLines = Math.min(style.lines, Math.ceil(n / per));
    const perLine = Math.ceil(n / nLines);
    for (let k = 0; k < n; k += perLine) pg.lines.push(pg.idx.slice(k, k + perLine));
  }
  return pages;
}

export function pageAt(pages, t) {
  let lo = 0, hi = pages.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pages[mid].end <= t) lo = mid + 1;
    else if (pages[mid].start > t) hi = mid - 1;
    else return pages[mid];
  }
  return null;
}

const fontOf = (style) => FONTS.find((f) => f.id === style.font) || FONTS[0];
const fontStr = (style, px) => `${fontOf(style).weight} ${px}px "${style.font}", "Rubik", sans-serif`;
const display = (text, style) => (style.upper ? text.toUpperCase() : text).trim();

// Positions every word of a page. Cached per page, canvas size and style.
function layout(ctx, page, words, style, W, H, cache) {
  const key = W + 'x' + H;
  if (cache && cache.get(page)?.key === key) return cache.get(page);
  let px = (style.size / 100) * Math.min(W, H);
  ctx.font = fontStr(style, px);
  const rtl = page.idx.some((i) => isRTL(words[i].text));
  const measure = () => page.lines.map((line) => {
    const items = line.map((i) => { const text = display(words[i].text, style); return { i, text, w: ctx.measureText(text).width }; });
    const space = ctx.measureText(' ').width + px * (style.anim === 'box' ? 0.36 : 0.14);
    const width = items.reduce((s, it) => s + it.w, 0) + space * (items.length - 1);
    return { items, space, width };
  });
  let lines = measure();
  const widest = Math.max(...lines.map((l) => l.width));
  const maxW = W * 0.88;
  if (widest > maxW) {
    px *= maxW / widest;
    ctx.font = fontStr(style, px);
    lines = measure();
  }
  const lh = px * 1.22;
  const blockH = lh * lines.length;
  const top = clamp(style.posY, 0.08, 0.95) * H - blockH / 2;
  const cx = W / 2;
  const placed = [];
  lines.forEach((ln, li) => {
    const y = top + lh * li + lh / 2;
    let x = rtl ? cx + ln.width / 2 : cx - ln.width / 2;
    for (const it of ln.items) {
      const center = rtl ? x - it.w / 2 : x + it.w / 2;
      placed.push({ ...it, x: center, y, line: li });
      x += rtl ? -(it.w + ln.space) : it.w + ln.space;
    }
    ln.y = y;
  });
  const out = { key, px, lines, words: placed, rtl, lh };
  cache?.set(page, out);
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Draws one word: outline with the shadow, then the fill on top.
function drawWord(ctx, text, x, y, px, style, fill, opts = {}) {
  const sw = (style.stroke / 100) * px;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = isRTL(text) ? 'rtl' : 'ltr';
  const shadowOn = style.shadow > 0;
  const setShadow = () => {
    if (opts.glow) {
      ctx.shadowColor = opts.glow; ctx.shadowBlur = px * 0.55; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    } else if (shadowOn) {
      ctx.shadowColor = hexA(style.shadowColor, style.shadow / 100);
      ctx.shadowBlur = (style.shadowBlur / 100) * px;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = (style.shadowDist / 100) * px;
    }
  };
  const clearShadow = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
  if (sw > 0.5 && !opts.noStroke) {
    setShadow();
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = sw * 2;
    ctx.strokeStyle = style.strokeColor;
    ctx.strokeText(text, x, y);
    clearShadow();
    if (opts.glow) setShadow();
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  } else {
    setShadow();
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }
  clearShadow();
}

// Draws the caption for time t. `state` holds the layout cache; pass the same object on every call.
export function drawCaptions(ctx, W, H, t, words, pages, style, state) {
  const page = pageAt(pages, t);
  if (!page) return;
  state.cache ||= new WeakMap();
  if (state.styleRef !== style || state.W !== W || state.H !== H) { state.cache = new WeakMap(); state.styleRef = style; state.W = W; state.H = H; }
  const L = layout(ctx, page, words, style, W, H, state.cache);
  const sp = Math.max(0.25, style.speed || 1);
  const anim = style.anim;
  const px = L.px;
  ctx.save();
  ctx.font = fontStr(style, px);

  const pIn = clamp((t - page.start) / (0.28 / sp));
  const pOut = clamp((page.end - t) / 0.12);
  let pageAlpha = Math.min(pOut, anim === 'none' ? 1 : clamp(pIn * 3));
  let pageScale = 1, pageDY = 0;
  if (anim === 'punch') { pageScale = lerp(1.35, 1, easeOutBack(pIn, 2.2)); pageAlpha = Math.min(pOut, clamp(pIn * 2.5)); }
  if (anim === 'slide') { pageDY = (1 - easeOutCubic(pIn)) * px * 0.7 - (1 - pOut) * px * 0.3; pageAlpha = Math.min(pOut, easeOutCubic(pIn)); }
  if (anim === 'box') pageScale = lerp(0.85, 1, easeOutBack(pIn, 2));
  const cy = clamp(style.posY, 0.08, 0.95) * H;
  ctx.translate(W / 2, cy + pageDY);
  ctx.scale(pageScale, pageScale);
  ctx.translate(-W / 2, -cy);
  ctx.globalAlpha = pageAlpha;

  if (style.bg) {
    for (const ln of L.lines) {
      const padX = px * 0.35, h = px * 1.25;
      ctx.fillStyle = 'rgba(10,10,12,0.62)';
      roundRect(ctx, W / 2 - ln.width / 2 - padX, ln.y - h / 2, ln.width + padX * 2, h, px * 0.22);
      ctx.fill();
    }
  }

  // Which word is being spoken now: the last one that has started.
  let active = -1;
  L.words.forEach((pw, k) => { if (t >= words[pw.i].start) active = k; });

  if (anim === 'box' && active >= 0) {
    const cur = L.words[active], prev = L.words[active - 1];
    const k = prev ? easeOutCubic(clamp((t - words[cur.i].start) / (0.16 / sp))) : 1;
    const from = prev && prev.line === cur.line ? prev : cur;
    const bx = lerp(from.x, cur.x, k), bw = lerp(from.w, cur.w, k), by = lerp(from.y, cur.y, k);
    const padX = px * 0.16, h = px * 1.16;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = px * 0.3; ctx.shadowOffsetY = px * 0.06;
    ctx.fillStyle = style.hi;
    roundRect(ctx, bx - bw / 2 - padX, by - h / 2, bw + padX * 2, h, px * 0.24);
    ctx.fill();
    ctx.restore();
  }

  L.words.forEach((pw, k) => {
    const w = words[pw.i];
    const spoken = t >= w.start;
    const isActive = k === active && t < Math.max(w.end, w.start + 0.12) + 0.25;
    const a = clamp((t - w.start) / (0.24 / sp));
    let alpha = 1, scale = 1, dy = 0, fill = style.color, text = pw.text, glow = null, noStroke = false;
    const hiFill = isActive ? style.hi : style.color;
    switch (anim) {
      case 'pop':
        if (!spoken) return;
        scale = lerp(0.35, 1, easeOutBack(a, 2.4)) * (isActive ? 1.06 : 1);
        alpha = clamp(a * 2.5);
        dy = (1 - easeOutCubic(a)) * px * 0.22;
        fill = hiFill;
        break;
      case 'bounce':
        if (!spoken) return;
        dy = -(1 - easeOutBounce(clamp((t - w.start) / (0.42 / sp)))) * px * 0.9;
        alpha = clamp(a * 3);
        fill = hiFill;
        break;
      case 'karaoke':
        alpha = spoken ? 1 : 0.5;
        scale = isActive ? 1 + 0.12 * Math.sin(Math.PI * Math.min(1, a)) + 0.04 : 1;
        fill = hiFill;
        break;
      case 'box':
        if (k === active) { fill = boxText(style.hi); noStroke = true; scale = 1 + 0.06 * Math.sin(Math.PI * Math.min(1, a)); }
        break;
      case 'punch':
        fill = hiFill;
        break;
      case 'slide':
        alpha = spoken ? 1 : 0.65;
        fill = hiFill;
        break;
      case 'type': {
        if (!spoken) return;
        const dur = Math.min(Math.max(w.end - w.start, 0.12), 0.45) / sp;
        const chars = [...pw.text];
        const n = Math.max(1, Math.ceil(chars.length * clamp((t - w.start) / dur)));
        text = chars.slice(0, n).join('');
        fill = hiFill;
        // Typed text grows from the word's leading edge.
        const edge = isRTL(pw.text) ? pw.x + pw.w / 2 : pw.x - pw.w / 2;
        ctx.globalAlpha = pageAlpha;
        drawWord(ctx, text, edge, pw.y, px, style, fill, { align: isRTL(pw.text) ? 'right' : 'left' });
        return;
      }
      case 'glow':
        alpha = spoken ? 1 : 0.55;
        if (isActive) { glow = style.hi; fill = style.hi; scale = 1.05; }
        break;
      default:
        break;
    }
    ctx.save();
    ctx.globalAlpha = pageAlpha * alpha;
    ctx.translate(pw.x, pw.y + dy);
    ctx.scale(scale, scale);
    drawWord(ctx, text, 0, 0, px, style, fill, { glow, noStroke });
    ctx.restore();
  });
  ctx.restore();
}

// Dark or light text on the highlight box, whichever reads better.
function boxText(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff';
}

export function ensureFont(style) {
  const f = fontOf(style);
  return document.fonts.load(`${f.weight} 40px "${f.id}"`, 'אבגabc').catch(() => {});
}
