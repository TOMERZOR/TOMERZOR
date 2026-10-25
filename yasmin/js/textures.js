// Loaded photo textures and everything drawn in code: signs, posters, notes, blood, fence, padding.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
export let maxAniso = 8;
export function setAniso(n) { maxAniso = n; }

export function loadTex(url, { srgb = true, repeat = true } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(url, t => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAniso;
      resolve(t);
    }, undefined, reject);
  });
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
}
let seed = 7;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

function grime(g, w, h, n = 40, a = 0.08) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = 5 + rnd() * w * 0.15;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(60,50,30,${a * rnd()})`);
    gr.addColorStop(1, 'rgba(60,50,30,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// Green and white room plates in the army style.
export function signTex(text, { bg = '#1d4d2b', fg = '#f2efe4', w = 512, h = 160, font = 'Heebo' } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${h * 0.42}px ${font}, Arial`;
  g.direction = 'rtl';
  g.fillText(text, w / 2, h / 2 + 4);
  grime(g, w, h, 25, 0.25);
  return tex(c);
}

// A printed notice on the board: title, lines, an optional stamp.
export function posterTex({ title, lines = [], w = 512, h = 700, accent = '#9b1c1c', stamp, crossed = [] }) {
  const [c, g] = canvas(w, h);
  g.fillStyle = '#ece6d6'; g.fillRect(0, 0, w, h);
  g.direction = 'rtl'; g.textAlign = 'right';
  g.fillStyle = accent; g.fillRect(0, 0, w, 90);
  g.fillStyle = '#fff'; g.font = '800 46px Heebo, Arial'; g.textBaseline = 'middle';
  g.fillText(title, w - 30, 47);
  g.fillStyle = '#1b1b1b'; g.font = '500 30px Heebo, Arial'; g.textBaseline = 'alphabetic';
  lines.forEach((l, i) => {
    const y = 150 + i * 52;
    g.fillText(l, w - 30, y);
    if (crossed.includes(i)) {
      g.strokeStyle = '#a40000'; g.lineWidth = 5;
      const tw = g.measureText(l).width;
      g.beginPath(); g.moveTo(w - 25, y - 10); g.lineTo(w - 35 - tw, y - 14 + rnd() * 6); g.stroke();
    }
  });
  if (stamp) {
    g.save(); g.translate(w * 0.3, h * 0.82); g.rotate(-0.25);
    g.strokeStyle = 'rgba(160,20,20,0.8)'; g.lineWidth = 6; g.strokeRect(-120, -40, 240, 80);
    g.fillStyle = 'rgba(160,20,20,0.8)'; g.font = '800 38px Heebo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(stamp, 0, 2); g.restore();
  }
  grime(g, w, h, 60, 0.12);
  // pins
  g.fillStyle = '#c22'; for (const [x, y] of [[20, 20], [w - 20, 20]]) { g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); }
  return tex(c);
}

// Hand-written scrawl on a transparent background (wall writing).
export function scrawlTex(text, { color = 'rgba(120,8,8,0.92)', w = 1024, h = 256, size = 120, font = 'Karantina' } = {}) {
  const [c, g] = canvas(w, h);
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${size}px ${font}, Arial`;
  for (let k = 0; k < 3; k++) {
    g.fillStyle = color; g.globalAlpha = k ? 0.35 : 1;
    g.fillText(text, w / 2 + (k ? (rnd() - 0.5) * 6 : 0), h / 2 + (k ? (rnd() - 0.5) * 6 : 0));
  }
  g.globalAlpha = 1;
  // drips
  const m = g.measureText(text).width;
  for (let i = 0; i < 14; i++) {
    const x = w / 2 - m / 2 + rnd() * m, y = h / 2 + size * 0.25, len = 20 + rnd() * 90;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(120,8,8,0)');
    g.fillStyle = gr; g.fillRect(x, y, 3 + rnd() * 3, len);
    g.beginPath(); g.arc(x + 2.5, y + len * 0.8, 3, 0, 7); g.fill();
  }
  return tex(c);
}

export function bloodTex(kind = 'splat') {
  const [c, g] = canvas(512, 512);
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 512, 512);
  const col = (a) => `rgba(${70 + rnd() * 30 | 0},${4 + rnd() * 6 | 0},${4 + rnd() * 6 | 0},${a})`;
  if (kind === 'splat') {
    for (let i = 0; i < 26; i++) {
      const r = i === 0 ? 120 : 6 + rnd() * 50, a = rnd() * 6.28, d = i === 0 ? 0 : 60 + rnd() * 160;
      g.fillStyle = col(0.85 + rnd() * 0.15);
      g.beginPath(); g.ellipse(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, r, r * (0.6 + rnd() * 0.5), a, 0, 7); g.fill();
    }
  } else if (kind === 'smear') {
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = col(0.15 + rnd() * 0.4); g.lineWidth = 8 + rnd() * 30; g.lineCap = 'round';
      g.beginPath(); g.moveTo(40, 256 + (rnd() - 0.5) * 120); g.bezierCurveTo(200, 200 + rnd() * 100, 320, 220 + rnd() * 100, 470, 256 + (rnd() - 0.5) * 120); g.stroke();
    }
  } else if (kind === 'hand') {
    g.fillStyle = col(0.9);
    g.beginPath(); g.ellipse(256, 320, 80, 95, 0, 0, 7); g.fill();
    for (const [x, y, l, a] of [[175, 250, 120, -0.5], [215, 200, 150, -0.15], [256, 190, 160, 0], [297, 200, 150, 0.15], [340, 280, 100, 0.7]]) {
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, -l / 2, 18, l / 2, 0, 0, 7); g.fill(); g.restore();
    }
    for (let i = 0; i < 8; i++) { g.fillRect(200 + rnd() * 120, 380, 6, 40 + rnd() * 100); }
  }
  return tex(c);
}

// Wet boot prints (alpha) for Yasmin's trail.
export function footprintTex() {
  const [c, g] = canvas(128, 256);
  // one boot print, toe toward the top of the texture
  g.fillStyle = 'rgba(38,14,10,0.8)';
  g.beginPath(); g.ellipse(64, 80, 46, 70, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(64, 200, 36, 44, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 9; i++) g.fillRect(24, 30 + i * 13, 80, 4);
  for (let i = 0; i < 4; i++) g.fillRect(34, 175 + i * 13, 60, 4);
  return tex(c);
}

export function puddleTex(red = false) {
  const [c, g] = canvas(512, 512);
  for (let i = 0; i < 18; i++) {
    const r = 40 + rnd() * 140, a = rnd() * 6.28, d = rnd() * 110;
    const x = 256 + Math.cos(a) * d, y = 256 + Math.sin(a) * d;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const col = red ? '70,0,0' : '30,38,42';
    gr.addColorStop(0, `rgba(${col},${red ? 0.8 : 0.22})`); gr.addColorStop(0.7, `rgba(${col},${red ? 0.5 : 0.14})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.7, a, 0, 7); g.fill();
  }
  return tex(c);
}

export function chainLinkTex() {
  const [c, g] = canvas(256, 256);
  g.strokeStyle = '#9aa0a3'; g.lineWidth = 5;
  const s = 64;
  for (let i = -4; i < 8; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + 256, 256); g.stroke();
    g.beginPath(); g.moveTo(i * s + 256, 0); g.lineTo(i * s, 256); g.stroke();
  }
  const t = tex(c, { srgb: true, repeat: true });
  return t;
}

export function paddedTex() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#d9d4c8'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const gr = g.createRadialGradient(x * 128 + 64, y * 128 + 64, 10, x * 128 + 64, y * 128 + 64, 90);
    gr.addColorStop(0, '#efebe2'); gr.addColorStop(1, '#a9a395');
    g.fillStyle = gr; g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
    g.fillStyle = '#6c665a'; g.beginPath(); g.arc(x * 128, y * 128, 5, 0, 7); g.fill();
  }
  // tally marks scratched in
  g.strokeStyle = 'rgba(40,30,25,0.75)'; g.lineWidth = 3;
  for (let k = 0; k < 40; k++) {
    const x0 = rnd() * 460, y0 = rnd() * 470;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x0 + i * 9, y0); g.lineTo(x0 + i * 9 + 2, y0 + 30); g.stroke(); }
    g.beginPath(); g.moveTo(x0 - 4, y0 + 22); g.lineTo(x0 + 34, y0 + 6); g.stroke();
  }
  grime(g, 512, 512, 50, 0.2);
  return tex(c, { repeat: true });
}

export function lockerTex() {
  const [c, g] = canvas(256, 512);
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, '#6a7068'); gr.addColorStop(0.5, '#7c8279'); gr.addColorStop(1, '#646a62');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#2a2d29';
  for (let i = 0; i < 6; i++) { g.fillRect(70, 40 + i * 16, 116, 7); g.fillRect(70, 400 + i * 14, 116, 6); }
  g.fillStyle = '#3a3d38'; g.fillRect(200, 230, 18, 60);
  g.strokeStyle = '#3d413b'; g.lineWidth = 4; g.strokeRect(6, 6, 244, 500);
  grime(g, 256, 512, 40, 0.3);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(120,70,30,${rnd() * 0.3})`; g.fillRect(rnd() * 256, rnd() * 512, 2 + rnd() * 6, 2 + rnd() * 10); }
  return tex(c);
}

export function doorTex(label) {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#8e9590'; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = '#6f7571'; g.lineWidth = 6; g.strokeRect(14, 14, 228, 484);
  g.fillStyle = '#b5b8b3'; g.fillRect(190, 250, 40, 14);
  if (label) {
    g.fillStyle = '#1d4d2b'; g.fillRect(40, 120, 176, 60);
    g.fillStyle = '#eee'; g.font = '800 30px Heebo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.fillText(label, 128, 152);
  }
  grime(g, 256, 512, 50, 0.3);
  return tex(c);
}

export function fabricTex(base = '#4d5531') {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * 0.06})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1);
  }
  for (let y = 0; y < 256; y += 4) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, y, 256, 1); }
  return tex(c, { repeat: true });
}

export function groundTex() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#3b3a37'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 30 + rnd() * 60 | 0;
    g.fillStyle = `rgba(${v},${v},${v - 4},${0.3 + rnd() * 0.5})`;
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  grime(g, 512, 512, 40, 0.25);
  return tex(c, { repeat: true });
}

// Pages the player reads: lined paper with hand-writing.
export function paperTex() {
  const [c, g] = canvas(256, 340);
  g.fillStyle = '#efe9da'; g.fillRect(0, 0, 256, 340);
  g.strokeStyle = 'rgba(80,110,160,0.35)'; g.lineWidth = 1;
  for (let y = 40; y < 340; y += 18) { g.beginPath(); g.moveTo(10, y); g.lineTo(246, y); g.stroke(); }
  g.strokeStyle = 'rgba(30,30,60,0.75)'; g.lineWidth = 1.6;
  for (let y = 54; y < 300; y += 18) {
    g.beginPath(); let x = 236; g.moveTo(x, y);
    while (x > 30 + rnd() * 40) { x -= 4 + rnd() * 6; g.lineTo(x, y - rnd() * 6); }
    g.stroke();
  }
  grime(g, 256, 340, 20, 0.15);
  return tex(c);
}

// Clipboard form (the צל״ם report).
export function formTex() {
  const [c, g] = canvas(256, 340);
  g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, 256, 340);
  g.fillStyle = '#222'; g.font = '800 22px Heebo, Arial'; g.textAlign = 'center'; g.direction = 'rtl';
  g.fillText('דוח צל״ם', 128, 34);
  g.strokeStyle = '#555'; g.lineWidth = 1;
  for (let i = 0; i < 9; i++) { g.strokeRect(16, 52 + i * 30, 224, 30); g.beginPath(); g.moveTo(170, 52 + i * 30); g.lineTo(170, 82 + i * 30); g.stroke(); }
  return tex(c);
}

export function clockTex() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#222';
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.fillRect(128 + Math.sin(a) * 100 - 3, 128 - Math.cos(a) * 100 - 8, 6, 16); }
  return tex(c);
}

export function exitSignTex() {
  const [c, g] = canvas(512, 192);
  g.fillStyle = '#0d7a3a'; g.fillRect(0, 0, 512, 192);
  g.fillStyle = '#e8ffe9'; g.font = '800 64px Heebo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText('יציאת חירום', 300, 98);
  // running man
  g.save(); g.translate(80, 96); g.fillStyle = '#e8ffe9';
  g.beginPath(); g.arc(10, -46, 12, 0, 7); g.fill();
  g.lineWidth = 12; g.strokeStyle = '#e8ffe9'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(5, -30); g.lineTo(-5, 10); g.lineTo(20, 45); g.moveTo(-5, 10); g.lineTo(-30, 35); g.moveTo(3, -22); g.lineTo(30, -5); g.moveTo(3, -22); g.lineTo(-25, -10); g.stroke();
  g.restore();
  return tex(c);
}

// CCTV label strip for monitors.
export function labelTex(text, w = 256, h = 48) {
  const [c, g] = canvas(w, h);
  g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ddd'; g.font = '600 28px monospace'; g.textBaseline = 'middle'; g.fillText(text, 10, h / 2);
  return tex(c);
}

export function photoFrameTex(img, caption) {
  const [c, g] = canvas(300, 360);
  g.fillStyle = '#f0ece2'; g.fillRect(0, 0, 300, 360);
  const s = Math.min(270 / img.width, 270 / img.height);
  const w = img.width * s, h = img.height * s;
  g.drawImage(img, 15 + (270 - w) / 2, 15 + (270 - h) / 2, w, h);
  if (caption) {
    g.fillStyle = '#222'; g.font = '700 30px "Amatic SC", Karantina, Arial'; g.textAlign = 'center'; g.direction = 'rtl';
    g.fillText(caption, 150, 330);
  }
  grime(g, 300, 360, 20, 0.2);
  return tex(c);
}

// A big X in red marker over a photo (the store's "victims" board).
export function crossOut(texture) {
  const img = texture.image;
  const [c, g] = canvas(img.width, img.height);
  g.drawImage(img, 0, 0);
  g.strokeStyle = 'rgba(170,0,0,0.85)'; g.lineWidth = 16; g.lineCap = 'round';
  g.beginPath(); g.moveTo(30, 30); g.lineTo(img.width - 30, img.height - 70); g.moveTo(img.width - 30, 30); g.lineTo(30, img.height - 70); g.stroke();
  return tex(c);
}
