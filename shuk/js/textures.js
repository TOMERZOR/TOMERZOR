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

// ---- shop signs atlas ----
export const SHOP_SIGNS = [
  ['פירות וירקות', '#1f7a3a', '#fff'], ['תבלינים ותה', '#b5401c', '#ffe9b0'], ['חלבה וממתקים', '#6b2b7a', '#fff'],
  ['פיצוחים', '#8a5a14', '#fff6d6'], ['מאפיית השוק', '#c98a2b', '#3a1d00'], ['דגים טריים', '#1c5d8f', '#fff'],
  ['גבינות וזיתים', '#e7c44b', '#3b2a00'], ['מיץ טבעי', '#d1314b', '#fff'], ['פרחים', '#d45d9a', '#fff'],
  ['בורקס', '#e58a1f', '#2b1400'], ['קפה שחור', '#3b2418', '#f5d7a1'], ['ירקות טריים', '#2f8f3a', '#fffbe0'],
  ['פירות יבשים', '#a2482b', '#fff'], ['חומוס פול', '#c7a24a', '#2a1a00'], ['כל הקילו ב־10!', '#ffd23f', '#c1121f'],
  ['אגוזים וקלויים', '#5a3a1a', '#ffd88a'], ['מעדניית השוק', '#264653', '#e9c46a'], ['תה ונענע', '#2a9d8f', '#fff'],
  ['קונדיטוריה', '#f4a6b8', '#5b1530'], ['סחלב חם', '#7d5ba6', '#fff'],
];
export const NEON_SIGNS = [
  ['בירה קרה', '#ff3d7f'], ['השוק בלילה', '#3df2ff'], ['ערק', '#ffe14d'], ['מוזיקה חיה', '#8cff4d'],
  ['פתוח עד מאוחר', '#ff8a3d'], ['בר', '#ff4df2'], ['שווארמה', '#ffd23f'], ['ריקודים', '#4dd2ff'],
];
export const PRICE_TAGS = ['₪10', '3 ב־10', '₪5', '₪12', '₪8', 'מבצע', '₪20', '2 ב־15'];

// canvas text direction from the text itself, so English lines keep their punctuation where it belongs
export const dirOf = text => /[\u0590-\u05FF]/.test(text) ? 'rtl' : 'ltr';

export function signAtlas() {
  const W = 1024, CELL_W = 256, CELL_H = 64, COLS = 4;
  const total = SHOP_SIGNS.length + NEON_SIGNS.length + PRICE_TAGS.length;
  const rows = Math.ceil(total / COLS);
  const H = THREE.MathUtils.ceilPowerOfTwo(rows * CELL_H);
  const [c, g] = canvas(W, H, 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const uv = [];
  let i = 0;
  const cell = () => { const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H; i++; return [x, y]; };
  const rec = (x, y) => uv.push([x / W, 1 - (y + CELL_H) / H, CELL_W / W, CELL_H / H]);
  for (const [text, bg, fg] of SHOP_SIGNS) {
    const [x, y] = cell();
    g.fillStyle = bg; roundRect(g, x + 3, y + 3, CELL_W - 6, CELL_H - 6, 8); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; roundRect(g, x + 8, y + 8, CELL_W - 16, CELL_H - 16, 6); g.stroke();
    g.direction = dirOf(text);
    g.fillStyle = fg; fitText(g, text, CELL_W - 30, 34, FONT_HEAD); g.fillText(text, x + CELL_W / 2, y + CELL_H / 2 + 2);
    rec(x, y);
  }
  for (const [text, col] of NEON_SIGNS) {
    const [x, y] = cell();
    g.fillStyle = '#120a1c'; roundRect(g, x + 2, y + 2, CELL_W - 4, CELL_H - 4, 10); g.fill();
    g.direction = dirOf(text);
    g.shadowColor = col; g.shadowBlur = 28; // shadowBlur ignores the canvas scale g.fillStyle = col; g.strokeStyle = '#fff';
    fitText(g, text, CELL_W - 30, 36, FONT_HEAD); g.fillText(text, x + CELL_W / 2, y + CELL_H / 2 + 2);
    g.shadowBlur = 0; g.lineWidth = 1; g.strokeText(text, x + CELL_W / 2, y + CELL_H / 2 + 2);
    rec(x, y);
  }
  for (const text of PRICE_TAGS) {
    const [x, y] = cell();
    g.fillStyle = '#fffdf3'; roundRect(g, x + 40, y + 4, CELL_W - 80, CELL_H - 8, 6); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 2; g.stroke();
    g.direction = dirOf(text);
    g.fillStyle = '#d0021b'; fitText(g, text, CELL_W - 100, 40, FONT_HEAD); g.fillText(text, x + CELL_W / 2, y + CELL_H / 2 + 2);
    rec(x, y);
  }
  const t = tex(c);
  return { texture: t, uv, shopCount: SHOP_SIGNS.length, neonStart: SHOP_SIGNS.length, priceStart: SHOP_SIGNS.length + NEON_SIGNS.length };
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
