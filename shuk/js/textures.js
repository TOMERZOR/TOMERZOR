// Canvas-drawn textures: coin faces, Hebrew signs, speech bubbles, banners, vehicle art.
import * as THREE from 'three';

export const FONT_HEAD = '"Fredoka", "Arial Hebrew", "Noto Sans Hebrew", Arial, sans-serif';
export const FONT_BODY = FONT_HEAD;

// draw in logical units on a canvas `scale` times larger, so big on-screen text stays sharp on 3x phones
function canvas(w, h, scale = 1) {
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext('2d');
  if (scale !== 1) g.scale(scale, scale);
  return [c, g];
}

function tex(c, { repeat = false, aniso = 4, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function fitText(g, text, maxW, size, font) {
  let s = size;
  g.font = `700 ${s}px ${font}`;
  while (g.measureText(text).width > maxW && s > 8) { s -= 2; g.font = `700 ${s}px ${font}`; }
  return s;
}

// ---- 10 shekel coin: gold centre, silver ring, palm tree ----
export function coinTextures() {
  const S = 256;
  const [c, g] = canvas(S, S);
  const cx = S / 2;
  // silver ring
  let grd = g.createRadialGradient(cx - 30, cx - 40, 10, cx, cx, cx);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.55, '#cfd6dc'); grd.addColorStop(1, '#8c959d');
  g.fillStyle = grd; g.beginPath(); g.arc(cx, cx, cx - 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(80,90,100,.6)'; g.lineWidth = 4; g.stroke();
  // gold centre
  grd = g.createRadialGradient(cx - 26, cx - 30, 6, cx, cx, cx * 0.72);
  grd.addColorStop(0, '#fff3b0'); grd.addColorStop(0.45, '#f2c443'); grd.addColorStop(1, '#b8860b');
  g.fillStyle = grd; g.beginPath(); g.arc(cx, cx, cx * 0.7, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a6508'; g.lineWidth = 3; g.stroke();
  // palm tree with date baskets (stylised)
  g.save(); g.translate(cx, cx + 6);
  g.strokeStyle = '#7a5806'; g.fillStyle = '#7a5806'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 42); g.quadraticCurveTo(-4, 10, 0, -22); g.stroke();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    g.lineWidth = 5; g.beginPath(); g.moveTo(0, -22);
    g.quadraticCurveTo(Math.cos(a) * 30, -22 + Math.sin(a) * 30 - 8, Math.cos(a) * 46, -22 + Math.sin(a) * 34 + 10); g.stroke();
  }
  g.fillRect(-22, 30, 13, 10); g.fillRect(9, 30, 13, 10);
  g.restore();
  // "10" and shekel sign
  g.fillStyle = '#6b4c04';
  g.font = `bold 38px ${FONT_HEAD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('10', cx - 46, cx - 2);
  g.font = `600 30px ${FONT_BODY}`;
  g.fillText('₪', cx + 48, cx - 2);
  // ring text dots
  g.fillStyle = 'rgba(70,80,90,.55)';
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * (cx * 0.86), cx + Math.sin(a) * (cx * 0.86), 2.2, 0, 7); g.fill(); }
  const face = tex(c);

  const [e, eg] = canvas(128, 16);
  for (let x = 0; x < 128; x += 4) { eg.fillStyle = x % 8 ? '#b9c2c9' : '#eef2f5'; eg.fillRect(x, 0, 4, 16); }
  const edge = tex(e, { repeat: true });
  edge.repeat.set(6, 1);
  return { face, edge };
}

// ---- street signs atlas ----
// Sign-painter lettering in real Hebrew faces over generated weathered blanks (img/signs.webp: eight boards,
// no text), so the street reads like the shuk's own hand-painted, taped-up and enamelled signage.
export const FONT_SUEZ = '"Suez One", "Frank Ruhl Libre", serif';
export const FONT_PAINT = 'Karantina, "Secular One", sans-serif';
export const FONT_HAND = '"Amatic SC", Karantina, cursive';
export const FONT_BOX = '"Secular One", Rubik, sans-serif';
export const FONT_STREET = 'Rubik, "Arial Hebrew", sans-serif';

// source rectangles of the blanks (x, y, w, h) and their corner inset
const BOARDS = {
  yellow: [10, 87, 239, 187, 26], cream: [265, 87, 238, 186, 24], green: [520, 86, 239, 188, 22], red: [777, 86, 238, 187, 26],
  chalk: [10, 357, 239, 216, 24], card: [265, 354, 237, 220, 30], blue: [520, 361, 238, 209, 24], light: [777, 361, 238, 212, 26],
};
const BOARD_FALLBACK = { yellow: '#f2c230', cream: '#f1ebdc', green: '#3d5a40', red: '#b8312b', chalk: '#2a2d2b', card: '#b98f5d', blue: '#1f3fa0', light: '#f4f6f4' };
// lettering per board: font, colour, weight
const INK = {
  yellow: [FONT_SUEZ, '#b3141c', 400], cream: [FONT_SUEZ, '#1f4d9c', 400], green: [FONT_PAINT, '#f3ead0', 700], red: [FONT_PAINT, '#fff6e6', 700],
  light: [FONT_BOX, '#1d3550', 400], rent: [FONT_PAINT, '#d0121b', 700],
};

// [name, board, small second line]
export const SHOP_SIGNS = [
  ['פירות וירקות', 'green', 'סיטונאות וקמעונאות'], ['תבלינים ותה', 'yellow', 'מאז 1958'], ['חלבה וממתקים', 'red', 'חלבה טרייה כל בוקר'],
  ['פיצוחים', 'yellow', 'קלוי במקום'], ['מאפיית השוק', 'cream', 'חלות • בורקס • רוגלך'], ['דגים טריים', 'light', 'ישר מהים'],
  ['גבינות וזיתים', 'cream', 'מעדנייה'], ['מיץ טבעי', 'light', 'סחוט מול העיניים'], ['פרחים', 'green', 'לשבת ולחג'],
  ['בורקס', 'yellow', 'של סבתא (לא שלך)'], ['קפה שחור', 'red', 'טחון עם הל'], ['ירקות טריים', 'green', 'ישר מהמושב'],
  ['פירות יבשים', 'yellow', ''], ['חומוס פול', 'cream', 'מאז שזה היה זול'], ['כל הקילו בעשרה!', 'yellow', 'רק היום (כמו אתמול)'],
  ['אגוזים וקלויים', 'red', ''], ['מעדניית השוק', 'light', 'סלטים • כבושים'], ['תה ונענע', 'green', ''],
  ['קונדיטוריה', 'cream', ''], ['סחלב חם', 'red', 'בחורף בלבד'], ['פיצוחי אבו שאול', 'yellow', 'עסק משפחתי'],
  ['הכי זול בשוק', 'red', 'לפי הסקר שלנו'], ['תבליני המלך', 'yellow', 'סיטונאות'], ['משה ובניו', 'green', 'פירות • ירקות'],
  ['כאן לא מתמקחים', 'cream', '(טוב, קצת)'],
];
const RENT_SIGNS = [['להשכרה', 'לפרטים: לצעוק למעלה'], ['דירה להשכרה', '3 חדרים, נוף לשוק'], ['למכירה', 'כולל השכנים']];
export const NEON_SIGNS = [
  ['בירה קרה', '#ff3d7f'], ['השוק בלילה', '#3df2ff'], ['ערק', '#ffe14d'], ['מוזיקה חיה', '#8cff4d'],
  ['פתוח עד מאוחר', '#ff8a3d'], ['בר', '#ff4df2'], ['שווארמה', '#ffd23f'], ['ריקודים', '#4dd2ff'],
];
export const PRICE_TAGS = ['₪10', '3 ב־10', '₪5 לק״ג', '₪12', '₪8', 'מבצע!', '₪20', '2 ב־15'];
const STREETS = [['מחנה יהודה', 'MAHANE YEHUDA ST.'], ['עץ החיים', 'ETS HAYIM ST.'], ['האגס', "HA-AGAS ST."], ['השקד', 'HA-SHAKED ST.'],
  ['התפוח', 'HA-TAPUAH ST.'], ['האפרסק', 'HA-AFARSEK ST.'], ['השזיף', 'HA-SHEZIF ST.'], ['האגוז', 'HA-EGOZ ST.']];
const CHALK = [
  ['היום בבר', 'בירה מהחבית 24', 'ערק לימונענע 15', 'צ׳ייסר על הבית*', '*לא באמת'],
  ['קפה', 'הפוך 12', 'שחור עם הל 9', 'תה נענע 8', 'עצה – חינם'],
  ['מבצע!', '3 אבוקדו', 'בעשר שקל', 'בשלים מחר'],
  ['שקשוקה 38', 'סביח 28', 'מלאווח 25', 'חומוס 30'],
  ['מיץ סחוט', 'תפוז 15', 'רימון 20', 'גזר 12', 'באהבה'],
  ['אוכל של אמא', 'קובה 32', 'מג׳דרה 25', 'אין משלוחים', 'רק חיבוקים'],
];
const CARDS = [['עגבניות', '5 שקל לקילו'], ['אבטיח מתוק', 'או שאני אוכל אותו'], ['לא לגעת!', '(טוב, תגעו)'], ['מנגו', 'מלך הקיץ'],
  ['טעים? תקנה!', ''], ['אין הנחות', 'לנכדים'], ['ישר מהשדה', '(של השכן)'], ['אורגני*', '*כמעט']];

// dirOf: canvas text direction from the text itself, so English lines keep their punctuation where it belongs
export const dirOf = text => /[֐-׿]/.test(text) ? 'rtl' : 'ltr';

// a board scaled into a rectangle with its corners (screws, tape, frame joints) kept undistorted
function board(g, img, name, x, y, w, h) {
  const b = BOARDS[name];
  if (!img || !b) { g.fillStyle = BOARD_FALLBACK[name] || '#ddd'; roundRect(g, x, y, w, h, 4); g.fill(); return; }
  const [sx, sy, sw, sh, c] = b;
  const k = Math.min(w / sw, h / sh) * 1.7, d = Math.min(c * k, h * 0.3, w * 0.3);
  const xs = [sx, sx + c, sx + sw - c, sx + sw], ys = [sy, sy + c, sy + sh - c, sy + sh];
  const xd = [x, x + d, x + w - d, x + w], yd = [y, y + d, y + h - d, y + h];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    // overlap the slices slightly so no seams show
    g.drawImage(img, xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j], xd[i] - 0.3, yd[j] - 0.3, xd[i + 1] - xd[i] + 0.6, yd[j + 1] - yd[j] + 0.6);
  }
}

function letter(g, text, x, y, maxW, size, font, color, weight = 700) {
  g.direction = dirOf(text);
  let s = size;
  g.font = `${weight} ${s}px ${font}`;
  while (g.measureText(text).width > maxW && s > 6) { s -= 1; g.font = `${weight} ${s}px ${font}`; }
  g.fillStyle = color;
  g.fillText(text, x, y);
  return s;
}

export function signAtlas(blanks = null) {
  const W = 1024, CW = 256, CH = 64;
  const H = 1100;
  const [c, g] = canvas(W, H, 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const uv = [], groups = { shop: [], rent: [], neon: [], price: [], street: [], chalk: [], card: [] };
  let cx = 0, cy = 0, rowH = 0;
  // shelf packing, one record per cell (u0, v0, du, dv with v up)
  const cell = (group, w, h) => {
    if (cx + w > W) { cx = 0; cy += rowH; rowH = 0; }
    const at = [cx, cy];
    cx += w; rowH = Math.max(rowH, h);
    groups[group].push(uv.length);
    uv.push([at[0] / W, 1 - (at[1] + h) / H, w / W, h / H]);
    return at;
  };
  for (const [text, b, sub] of SHOP_SIGNS) {
    const [x, y] = cell('shop', CW, CH);
    board(g, blanks, b, x + 2, y + 2, CW - 4, CH - 4);
    const [font, col, wt] = INK[b];
    const top = b === 'light' ? 8 : 0;   // below the lightbox's coloured stripe
    if (sub) {
      letter(g, text, x + CW / 2, y + 26 + top * 0.6, CW - 44, 30 - top * 0.5, font, col, wt);
      letter(g, sub, x + CW / 2, y + 50, CW - 70, 11, b === 'light' ? FONT_BOX : FONT_STREET, col, b === 'light' ? 400 : 700);
    } else {
      letter(g, text, x + CW / 2, y + CH / 2 + 2 + top * 0.5, CW - 44, 36 - top * 0.6, font, col, wt);
    }
  }
  for (const [text, sub] of RENT_SIGNS) {
    const [x, y] = cell('rent', CW, CH);
    board(g, blanks, 'cream', x + 2, y + 2, CW - 4, CH - 4);
    letter(g, text, x + CW / 2, y + 26, CW - 40, 32, FONT_PAINT, '#c8121b', 700);
    letter(g, sub, x + CW / 2, y + 50, CW - 60, 12, FONT_STREET, '#2b2b2b', 700);
  }
  for (const [text, col] of NEON_SIGNS) {
    const [x, y] = cell('neon', CW, CH);
    g.fillStyle = '#120a1c'; roundRect(g, x + 2, y + 2, CW - 4, CH - 4, 10); g.fill();
    g.shadowColor = col; g.shadowBlur = 28; // shadowBlur ignores the canvas scale
    const s = letter(g, text, x + CW / 2, y + CH / 2 + 2, CW - 30, 40, FONT_PAINT, col, 700);
    g.shadowBlur = 0; g.lineWidth = 1; g.strokeStyle = '#fff';
    g.font = `700 ${s}px ${FONT_PAINT}`; g.strokeText(text, x + CW / 2, y + CH / 2 + 2);
  }
  // marker on a white card (the geometry shows the middle 70% of the cell); Karantina has a proper shekel sign
  for (const text of PRICE_TAGS) {
    const [x, y] = cell('price', CW, CH);
    g.save(); g.translate(x + CW / 2, y + CH / 2); g.rotate((Math.random() - 0.5) * 0.06);
    g.fillStyle = '#fbf8ee'; g.fillRect(-CW * 0.34, -CH / 2 + 4, CW * 0.68, CH - 8);
    g.fillStyle = 'rgba(120,90,40,.18)'; g.fillRect(-CW * 0.34, CH / 2 - 10, CW * 0.68, 6);
    letter(g, text, 0, 3, CW * 0.6, 50, FONT_PAINT, Math.random() < 0.6 ? '#141414' : '#c1121f', 700);
    g.restore();
  }
  for (const [he, en] of STREETS) {
    const [x, y] = cell('street', CW, CH);
    board(g, blanks, 'blue', x + 2, y + 2, CW - 4, CH - 4);
    letter(g, 'רח׳ ' + he, x + CW / 2, y + 27, CW - 50, 26, FONT_STREET, '#ffffff', 700);
    letter(g, en, x + CW / 2, y + 49, CW - 70, 12, FONT_STREET, '#ffffff', 700);
  }
  // chalkboards (portrait) and cardboard signs
  for (const lines of CHALK) {
    const [x, y] = cell('chalk', 128, 168);
    board(g, blanks, 'chalk', x + 2, y + 2, 124, 164);
    const head = ['#ffd84d', '#ff9fb2', '#9fe7ff'][Math.floor(Math.random() * 3)];
    g.shadowColor = 'rgba(255,255,255,.5)'; g.shadowBlur = 2;
    lines.forEach((l, i) => letter(g, l, x + 64, y + 30 + i * (110 / Math.max(1, lines.length - 1)), 96, i ? 19 : 25,
      FONT_HAND, i ? 'rgba(240,240,232,.92)' : head, 700));
    g.shadowBlur = 0;
  }
  cx = W; // new row
  for (const [a, b] of CARDS) {
    const [x, y] = cell('card', 128, 96);
    board(g, blanks, 'card', x + 3, y + 3, 122, 90);
    letter(g, a, x + 64, y + (b ? 38 : 49), 96, 28, FONT_HAND, '#151515', 700);
    if (b) letter(g, b, x + 64, y + 66, 100, 20, FONT_HAND, '#a3121b', 700);
  }
  const t = tex(c, { aniso: 8 });
  const pickIn = name => groups[name][Math.floor(Math.random() * groups[name].length)];
  return { texture: t, uv, groups, pick: pickIn };
}

// ---- speech bubble sprite texture ----
// The bubble frame is generated art (img/ui/bubble.webp, 968x514): drawn as five slices so the round caps and
// the tail keep their shape while the straight middle stretches around the text (one or two lines).
let bubbleImg = null;
export function setBubbleImage(img) { bubbleImg = img; }
const BUB = { W: 968, H: 514, cap: 232, tailL: 404, tailR: 564, bodyTop: 6, bodyBot: 420 };

function wrapLines(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return [text];
  const words = text.split(' ');
  let best = [text], bestW = Infinity;
  for (let i = 1; i < words.length; i++) {           // the most balanced two-line split
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const w = Math.max(g.measureText(a).width, g.measureText(b).width);
    if (w < bestW) { bestW = w; best = [a, b]; }
  }
  return best;
}

export function bubbleTexture(text) {
  const Hc = 200, s = Hc / BUB.H, FS = 40;
  const probe = canvas(8, 8)[1];
  probe.font = `700 ${FS}px ${FONT_HEAD}`;
  let lines = wrapLines(probe, text, 470);
  let size = FS;
  const widest = () => Math.max(...lines.map(l => probe.measureText(l).width));
  while (widest() > 520 && size > 22) { size -= 2; probe.font = `700 ${size}px ${FONT_HEAD}`; }
  const tw = widest();
  const capW = BUB.cap * s, tailW = (BUB.tailR - BUB.tailL) * s;
  const Wc = Math.ceil(Math.max(capW * 2 + tailW + 20, tw + 2 * capW * 0.62));
  const [c, g] = canvas(Wc, Hc, 1.25);
  if (bubbleImg) {
    const stretch = (Wc - 2 * capW - tailW) / 2;
    const slices = [
      [0, BUB.cap, 0, capW],
      [BUB.cap, BUB.tailL, capW, stretch],
      [BUB.tailL, BUB.tailR, capW + stretch, tailW],
      [BUB.tailR, BUB.W - BUB.cap, capW + stretch + tailW, stretch],
      [BUB.W - BUB.cap, BUB.W, Wc - capW, capW],
    ];
    // overlap each slice by a pixel so no seams show between them
    for (const [sx0, sx1, dx, dw] of slices) if (dw > 0) g.drawImage(bubbleImg, sx0, 0, sx1 - sx0, BUB.H, dx - 0.5, 0, dw + 1, Hc);
  } else {
    g.fillStyle = '#fff8e8'; roundRect(g, 4, 4, Wc - 8, Hc * 0.78, Hc * 0.38); g.fill();
    g.strokeStyle = '#4a2a16'; g.lineWidth = 8; g.stroke();
  }
  g.direction = dirOf(text); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${size}px ${FONT_HEAD}`;
  g.fillStyle = '#3d2414';
  const cy = (BUB.bodyTop + BUB.bodyBot) / 2 * s + 2, lh = size * 1.08;
  lines.forEach((l, i) => g.fillText(l, Wc / 2, cy + (i - (lines.length - 1) / 2) * lh));
  const t = tex(c); t.anisotropy = 1;
  t.userData.aspect = Wc / Hc;
  return t;
}

// ---- floating text (score popups) ----
export function popupTexture(text, color = '#ffd23f') {
  const [c, g] = canvas(512, 128, 2);
  g.direction = dirOf(text); g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = fitText(g, text, 480, 76, FONT_HEAD);
  g.font = `700 ${size}px ${FONT_HEAD}`;
  g.lineWidth = 12; g.strokeStyle = '#2b1606'; g.lineJoin = 'round'; g.strokeText(text, 256, 66);
  g.fillStyle = color; g.fillText(text, 256, 66);
  return tex(c);
}

// ---- banner for the roll-under obstacle ----
export function bannerTexture(text, bg = '#d62828', fg = '#fff3b0') {
  const [c, g] = canvas(512, 192, 2);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 192);
  for (let x = -40; x < 552; x += 48) { g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, 0); g.lineTo(x - 26, 192); g.lineTo(x - 50, 192); g.fill(); }
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 512, 14); g.fillRect(0, 178, 512, 14);
  g.direction = dirOf(text); g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = fitText(g, text, 470, 92, FONT_HEAD);
  g.font = `700 ${size}px ${FONT_HEAD}`;
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(text, 256, 100);
  g.fillStyle = fg; g.fillText(text, 256, 100);
  return tex(c);
}

// ---- Na Nach van side art ----
export function vanTexture() {
  const [c, g] = canvas(1024, 384, 2);
  g.fillStyle = '#f7f7f2'; g.fillRect(0, 0, 1024, 384);
  const cols = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#9b5de5', '#f15bb5', '#00bbf9', '#fee440'];
  for (let i = 0; i < 26; i++) {
    g.fillStyle = cols[i % cols.length] + 'aa';
    g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 384, 30 + Math.random() * 60, 18 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill();
  }
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const text = 'נ נח נחמ נחמן מאומן';
  g.font = `700 110px ${FONT_HEAD}`;
  fitText(g, text, 960, 120, FONT_HEAD);
  g.lineWidth = 16; g.strokeStyle = '#1d1d1d'; g.strokeText(text, 512, 190);
  const grd = g.createLinearGradient(0, 120, 1024, 260);
  cols.forEach((col, k) => grd.addColorStop(k / (cols.length - 1), col));
  g.fillStyle = grd; g.fillText(text, 512, 190);
  g.font = `700 40px ${FONT_HEAD}`; g.fillStyle = '#1d1d1d'; g.fillText('אין שום ייאוש בעולם כלל!', 512, 320);
  return tex(c);
}

// ---- produce truck side art ----
export function truckTexture() {
  const [c, g] = canvas(1024, 384, 2);
  const grd = g.createLinearGradient(0, 0, 0, 384);
  grd.addColorStop(0, '#fdfdfd'); grd.addColorStop(1, '#e3e6e8');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 384);
  g.fillStyle = '#2f8f3a'; g.fillRect(0, 300, 1024, 84);
  g.fillStyle = '#f4a020'; g.fillRect(0, 286, 1024, 14);
  // painted fruit
  const fruit = [['#e63946', 60], ['#f4a020', 52], ['#ffd23f', 44], ['#2f8f3a', 48], ['#7b2cbf', 40]];
  for (let i = 0; i < 9; i++) { const [col, r] = fruit[i % fruit.length]; g.fillStyle = col; g.beginPath(); g.arc(80 + i * 110, 230, r * 0.7, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(70 + i * 110, 218, r * 0.22, 0, 7); g.fill(); }
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#1f5f2a'; fitText(g, 'פירות וירקות עזרא ובניו', 940, 84, FONT_HEAD); g.fillText('פירות וירקות עזרא ובניו', 512, 96);
  g.fillStyle = '#fff'; g.font = `700 44px ${FONT_HEAD}`; g.fillText('הובלות מחנה יהודה · 02-5555555', 512, 342);
  return tex(c);
}

// Persian rug for the magic carpet: red field, gold borders, a medallion and a scatter of motifs
export function rugTexture() {
  const [c, g] = canvas(256, 160, 2);
  g.fillStyle = '#8f1d1d'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#e2a93b'; g.fillRect(6, 6, 244, 148);
  g.fillStyle = '#b3261e'; g.fillRect(14, 14, 228, 132);
  g.strokeStyle = '#f2cf6a'; g.lineWidth = 3; g.strokeRect(22, 22, 212, 116);
  g.fillStyle = '#f2cf6a';
  g.beginPath(); g.moveTo(128, 46); g.lineTo(170, 80); g.lineTo(128, 114); g.lineTo(86, 80); g.closePath(); g.fill();
  g.fillStyle = '#1d3557'; g.beginPath(); g.moveTo(128, 60); g.lineTo(152, 80); g.lineTo(128, 100); g.lineTo(104, 80); g.closePath(); g.fill();
  g.fillStyle = '#f2cf6a';
  for (const [x, y] of [[48, 44], [208, 44], [48, 116], [208, 116]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
  for (let x = 30; x < 230; x += 16) { g.fillRect(x, 28, 6, 4); g.fillRect(x, 128, 6, 4); }
  return tex(c);
}

// watermelon rind stripes for the rolling melons
export function melonTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1f5f22';
  for (let i = 0; i < 12; i++) {
    const x0 = i * 256 / 12;
    g.beginPath(); g.moveTo(x0, 0);
    for (let y = 0; y <= 128; y += 8) g.lineTo(x0 + 6 + Math.sin(y * 0.22 + i) * 4, y);
    for (let y = 128; y >= 0; y -= 8) g.lineTo(x0 + 13 + Math.sin(y * 0.22 + i + 1) * 4, y);
    g.closePath(); g.fill();
  }
  return tex(c);
}

// round soft blob (white, alpha fades out from the centre) for contact shadows under characters
export function blobTexture() {
  const S = 64, [c, g] = canvas(S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,.75)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return tex(c, { srgb: false });
}

// soft-edged rectangle (white, alpha falls off toward the border) for baked contact shadows
export function softRectTexture() {
  const S = 64, [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  const f = t => { const d = Math.min(t, 1 - t) / 0.32; return d >= 1 ? 1 : d * d * (3 - 2 * d); };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    img.data[o + 3] = Math.round(255 * f((x + 0.5) / S) * f((y + 0.5) / S));
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

// a shaft of sunlight through dusty air: bright where it enters, fading toward the floor, soft at the sides,
// with a few faint streaks along its length
export function shaftTexture() {
  const W = 64, H = 256, [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  const streak = Array.from({ length: W }, (_, x) => 0.75 + 0.25 * Math.sin(x * 0.9) * Math.sin(x * 0.37 + 1.3));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = (x + 0.5) / W, v = (y + 0.5) / H;
    const across = Math.exp(-Math.pow((t - 0.5) / 0.24, 2));
    const along = Math.pow(1 - v, 1.4) * Math.min(1, v * 14);
    const o = (y * W + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    img.data[o + 3] = Math.round(255 * across * along * streak[x]);
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

export function glowTexture() {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,240,200,.6)'); grd.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return tex(c);
}

export function particleTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return tex(c, { srgb: false });
}

export function woodTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#b98a52'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) {
    g.fillStyle = y % 64 ? '#c99a5e' : '#ad7d45'; g.fillRect(0, y + 2, 128, 28);
    g.strokeStyle = 'rgba(80,50,20,.35)'; g.lineWidth = 1;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(0, y + 6 + k * 6); g.bezierCurveTo(40, y + 4 + k * 6 + Math.random() * 4, 80, y + 8 + k * 6, 128, y + 6 + k * 6); g.stroke(); }
  }
  return tex(c);
}

export function skyTexture(top, mid, bottom) {
  const [c, g] = canvas(4, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top); grd.addColorStop(0.55, mid); grd.addColorStop(1, bottom);
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  return tex(c);
}
