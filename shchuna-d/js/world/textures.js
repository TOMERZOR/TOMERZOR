// Textures and shared materials. Surface photos come from assets/tex (generated, then made
// tileable by tools/build-textures.py); everything with Hebrew on it is drawn here into
// canvases so the type is always real type.
import * as THREE from 'three';
import { Atlas } from './geo.js';
import { Rng } from '../core/util.js';

const loader = new THREE.TextureLoader();
function load(url, aniso, srgb = true) {
  return new Promise((res) => {
    loader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }, undefined, () => { console.warn('texture missing', url); res(null); });
  });
}

export const FONT = {
  display: '"Karantina", "Heebo", sans-serif',
  ui: '"Heebo", sans-serif',
  shop: '"Secular One", "Heebo", sans-serif',
  serif: '"Suez One", "Heebo", serif',
  hand: '"Amatic SC", "Heebo", sans-serif',
  dirt: '"Rubik Dirt", "Karantina", sans-serif',
};
export async function loadFonts() {
  const list = ['700 40px Karantina', '400 40px Karantina', '500 20px Heebo', '700 20px Heebo', '900 20px Heebo',
    '400 40px "Secular One"', '400 40px "Suez One"', '700 40px "Amatic SC"', '400 40px "Rubik Dirt"'];
  await Promise.all(list.map((f) => document.fonts.load(f, 'שכונה ד׳ Aa 0123').catch(() => null)));
}

function grime(g, w, h, rng, n = 26, alpha = 0.05, col = '60,48,36') {
  for (let i = 0; i < n; i++) {
    const x = rng.f(w), y = rng.f(h), r = rng.f(w * 0.05, w * 0.3);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${col},${alpha})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function streaks(g, w, h, rng, n = 8, alpha = 0.1) {
  for (let i = 0; i < n; i++) {
    const x = rng.f(w), len = rng.f(h * 0.2, h * 0.9), ww = rng.f(2, 9);
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, `rgba(50,40,30,${alpha})`); gr.addColorStop(1, 'rgba(50,40,30,0)');
    g.fillStyle = gr; g.fillRect(x, 0, ww, len);
  }
}

// ---- Window / door atlas ---------------------------------------------------
// 4×4 cells. WIN.<name> = uv rect. The emissive twin lights the glass at night.
export const WIN = {};
const WIN_NAMES = ['shutClosed', 'shutDirty', 'shutHalf', 'open', 'bars', 'kitchen', 'balcony', 'balconyShut',
  'lattice', 'shopDoor', 'entry', 'roller', 'store', 'garage', 'shelter', 'dark'];

function slats(g, x, y, w, h, base, rng, gap = 9) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  for (let yy = y; yy < y + h; yy += gap) {
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, yy + gap - 2, w, 2);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, yy, w, 1.5);
  }
  if (rng) streaks(g, w + x, h, rng, 5, 0.08);
}
function glass(g, x, y, w, h, lit, rng, curtain = true) {
  if (lit) {
    const warm = rng.pick(['#ffd98a', '#ffe7b0', '#ffc76a', '#d9ecff', '#fff0cf']);
    g.fillStyle = warm; g.fillRect(x, y, w, h);
    if (curtain) {
      g.fillStyle = 'rgba(120,70,30,0.35)';
      const cw = w * rng.f(0.15, 0.4); g.fillRect(x, y, cw, h); g.fillRect(x + w - cw * 0.7, y, cw * 0.7, h);
      g.fillStyle = 'rgba(40,20,10,0.5)';                    // a silhouette of furniture
      g.fillRect(x + w * rng.f(0.3, 0.6), y + h * 0.62, w * 0.25, h * 0.38);
    }
    if (rng.chance(0.3)) { g.fillStyle = 'rgba(120,180,255,0.55)'; g.fillRect(x + w * 0.5, y + h * 0.3, w * 0.3, h * 0.25); }   // TV glow
  } else {
    const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    gr.addColorStop(0, '#5b7186'); gr.addColorStop(0.5, '#2c3a47'); gr.addColorStop(1, '#161d25');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.moveTo(x, y + h * 0.5); g.lineTo(x + w * 0.5, y); g.lineTo(x + w * 0.72, y); g.lineTo(x, y + h * 0.78); g.fill();
    if (curtain && rng.chance(0.7)) {
      g.fillStyle = rng.pick(['rgba(230,225,210,0.5)', 'rgba(200,170,150,0.45)', 'rgba(170,190,200,0.4)']);
      const cw = w * rng.f(0.2, 0.5); g.fillRect(x, y, cw, h);
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x + (cw / 6) * i, y, 2, h); }
    }
  }
}
function frame(g, x, y, w, h, col = '#d9d6cc', t = 7) {
  g.strokeStyle = col; g.lineWidth = t; g.strokeRect(x + t / 2, y + t / 2, w - t, h - t);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.strokeRect(x + t, y + t, w - t * 2, h - t * 2);
}
function drawWin(g, S, name, lit, seed) {
  const rng = new Rng(seed);
  const wall = '#b9b2a2';
  g.fillStyle = lit ? '#000' : wall; g.fillRect(0, 0, S, S);
  const dark = (x, y, w, h) => { g.fillStyle = lit ? '#000' : '#0c0f13'; g.fillRect(x, y, w, h); };
  const m = 6;
  switch (name) {
    case 'shutClosed': case 'shutDirty': {
      if (lit) break;
      slats(g, m, m + 26, S - m * 2, S - m * 2 - 26, name === 'shutClosed' ? '#e7e3d8' : '#cdbf9f', rng);
      g.fillStyle = name === 'shutClosed' ? '#d4d0c4' : '#b3a688'; g.fillRect(m, m, S - m * 2, 26);       // shutter box
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(m, m + 24, S - m * 2, 3);
      if (name === 'shutDirty') grime(g, S, S, rng, 14, 0.12);
      break;
    }
    case 'shutHalf': {
      glass(g, m, m, S - m * 2, S - m * 2, lit, rng);
      if (!lit) { slats(g, m, m, S - m * 2, S * rng.f(0.35, 0.55), '#e2ded2', rng); frame(g, m, m, S - m * 2, S - m * 2); g.fillStyle = '#cfcbc0'; g.fillRect(S / 2 - 3, S * 0.5, 6, S * 0.5 - m); }
      else { g.fillStyle = '#000'; g.fillRect(0, 0, S, S * 0.5); }
      break;
    }
    case 'open': {
      glass(g, m, m, S - m * 2, S - m * 2, lit, rng);
      if (!lit) { frame(g, m, m, S - m * 2, S - m * 2); g.fillStyle = '#d9d6cc'; g.fillRect(S / 2 - 4, m, 8, S - m * 2); }
      break;
    }
    case 'bars': case 'kitchen': {
      const top = name === 'kitchen' ? S * 0.3 : m;
      if (name === 'kitchen' && !lit) { g.fillStyle = wall; g.fillRect(0, 0, S, S); }
      glass(g, m + (name === 'kitchen' ? 40 : 0), top, S - m * 2 - (name === 'kitchen' ? 80 : 0), S - top - m - (name === 'kitchen' ? 50 : 0), lit, rng, name !== 'kitchen');
      if (!lit) {
        const x0 = m + (name === 'kitchen' ? 40 : 0), w = S - m * 2 - (name === 'kitchen' ? 80 : 0), h = S - top - m - (name === 'kitchen' ? 50 : 0);
        frame(g, x0, top, w, h);
        g.strokeStyle = '#3b3f45'; g.lineWidth = 4;
        for (let i = 1; i < 7; i++) { g.beginPath(); g.moveTo(x0 + (w / 7) * i, top); g.lineTo(x0 + (w / 7) * i, top + h); g.stroke(); }
        for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x0, top + (h / 3) * i); g.lineTo(x0 + w, top + (h / 3) * i); g.stroke(); }
      } else if (name === 'kitchen') { /* glass already drawn */ }
      break;
    }
    case 'balcony': {
      // enclosed balcony: opaque lower panel, three sliding panes above
      const ph = S * 0.34;
      for (let i = 0; i < 3; i++) glass(g, m + ((S - m * 2) / 3) * i, m, (S - m * 2) / 3, S - ph - m, lit, new Rng(seed + i), i === 1);
      if (!lit) {
        g.fillStyle = rng.pick(['#c9c3b3', '#9fb4b1', '#d8cfb8', '#b5a995']); g.fillRect(m, S - ph, S - m * 2, ph - m);
        streaks(g, S, S, rng, 6, 0.12);
        frame(g, m, m, S - m * 2, S - ph - m, '#c8cbd0', 6);
        g.fillStyle = '#c8cbd0'; for (let i = 1; i < 3; i++) g.fillRect(m + ((S - m * 2) / 3) * i - 3, m, 6, S - ph - m);
      } else { g.fillStyle = '#000'; g.fillRect(0, S - ph, S, ph); }
      break;
    }
    case 'balconyShut': {
      if (lit) break;
      slats(g, m, m + 22, S - m * 2, S - m * 2 - 22, rng.pick(['#e4e0d4', '#d9cdb0', '#cfd6d4']), rng, 8);
      g.fillStyle = '#c9c5b9'; g.fillRect(m, m, S - m * 2, 22);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(S / 2 - 1, m + 22, 2, S);
      grime(g, S, S, rng, 10, 0.1);
      break;
    }
    case 'lattice': {
      // stairwell ventilation blocks
      if (lit) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); }
      const n = 5, cs = S / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (lit) { g.fillStyle = 'rgba(255,214,140,0.9)'; g.fillRect(i * cs + cs * 0.22, j * cs + cs * 0.22, cs * 0.56, cs * 0.56); }
        else {
          g.fillStyle = '#a9a294'; g.fillRect(i * cs, j * cs, cs, cs);
          g.fillStyle = '#0e1114'; g.fillRect(i * cs + cs * 0.2, j * cs + cs * 0.2, cs * 0.6, cs * 0.6);
          g.fillStyle = '#8f897c'; g.fillRect(i * cs + cs * 0.46, j * cs + cs * 0.2, cs * 0.08, cs * 0.6); g.fillRect(i * cs + cs * 0.2, j * cs + cs * 0.46, cs * 0.6, cs * 0.08);
        }
      }
      break;
    }
    case 'shopDoor': case 'store': {
      glass(g, m, m, S - m * 2, S - m * 2, lit, rng, false);
      if (lit) {
        // shelves seen through the glass
        for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
          g.fillStyle = rng.pick(['#e5412d', '#f5b301', '#2a6bff', '#3aa35b', '#ffffff', '#ff7ab6', '#7a4bd1']);
          g.fillRect(m + 8 + c * ((S - 28) / 9), S * 0.28 + r * S * 0.17, (S - 28) / 9 - 3, S * 0.11);
        }
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(m, m, S - m * 2, S * 0.18);
      } else {
        frame(g, m, m, S - m * 2, S - m * 2, '#8d939a', 8);
        if (name === 'shopDoor') { g.fillStyle = '#8d939a'; g.fillRect(S / 2 - 4, m, 8, S - m * 2); g.fillStyle = '#d7d9dc'; g.fillRect(S / 2 - 22, S * 0.5, 10, 46); g.fillRect(S / 2 + 12, S * 0.5, 10, 46); }
        else { g.fillStyle = '#8d939a'; g.fillRect(m, S * 0.74, S - m * 2, 7); }
      }
      break;
    }
    case 'entry': {
      // stairwell entrance: dark opening, intercom, mailboxes
      dark(m, m, S - m * 2, S - m);
      if (lit) { g.fillStyle = 'rgba(255,225,170,0.55)'; g.fillRect(m + 30, m + 16, S - m * 2 - 60, S * 0.5); break; }
      const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#20262c'); gr.addColorStop(1, '#0a0c0f');
      g.fillStyle = gr; g.fillRect(m, m, S - m * 2, S - m);
      g.fillStyle = '#7b8085'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.fillRect(S * 0.56 + i * 24, S * 0.34 + j * 30, 20, 26);   // mailboxes
      g.fillStyle = '#b9bcc0'; g.fillRect(S * 0.12, S * 0.36, 34, 56); g.fillStyle = '#1a1d21'; g.fillRect(S * 0.12 + 5, S * 0.36 + 6, 24, 16);  // intercom
      g.fillStyle = '#3a3f45'; for (let i = 0; i < 6; i++) g.fillRect(m, S - 12 - i * 14, S - m * 2, 3);                                              // stairs
      frame(g, m, m, S - m * 2, S, '#8f8a7c', 9);
      break;
    }
    case 'roller': {
      if (lit) break;
      slats(g, m, m, S - m * 2, S - m * 2, '#8e949a', rng, 12);
      g.strokeStyle = rng.pick(['rgba(20,20,20,0.6)', 'rgba(190,30,30,0.65)', 'rgba(30,60,170,0.6)']); g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); let px = S * 0.2, py = S * 0.6; g.moveTo(px, py);
      for (let i = 0; i < 7; i++) { px += rng.f(10, 40); py += rng.f(-50, 50); g.quadraticCurveTo(px - 20, py + rng.f(-30, 30), px, py); }
      g.stroke();
      break;
    }
    case 'garage': {
      if (lit) break;
      slats(g, m, m, S - m * 2, S - m * 2, rng.pick(['#3f6a8c', '#496b52', '#7c5a3a']), rng, 22);
      grime(g, S, S, rng, 14, 0.14);
      break;
    }
    case 'shelter': {
      if (lit) break;
      g.fillStyle = '#5d6b60'; g.fillRect(m, m, S - m * 2, S - m);
      g.strokeStyle = '#3d4640'; g.lineWidth = 6; g.strokeRect(m + 14, m + 14, S - m * 2 - 28, S - m - 28);
      g.fillStyle = '#2a2f2c'; g.beginPath(); g.arc(S * 0.5, S * 0.5, 34, 0, 7); g.fill();
      g.strokeStyle = '#8b958e'; g.lineWidth = 8; g.beginPath(); g.arc(S * 0.5, S * 0.5, 34, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(S * 0.5 - 34, S * 0.5); g.lineTo(S * 0.5 + 34, S * 0.5); g.moveTo(S * 0.5, S * 0.5 - 34); g.lineTo(S * 0.5, S * 0.5 + 34); g.stroke();
      streaks(g, S, S, rng, 8, 0.2);
      break;
    }
    default: dark(0, 0, S, S);
  }
  if (!lit) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, S, 5); g.fillRect(0, 0, 4, S); }       // recess shadow
}
function buildWinAtlas(aniso) {
  const S = 256, N = 4;
  const mk = (lit) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = S * N;
    const g = cv.getContext('2d');
    WIN_NAMES.forEach((n, i) => {
      const cx = (i % N) * S, cy = Math.floor(i / N) * S;
      g.save(); g.translate(cx, cy); g.beginPath(); g.rect(0, 0, S, S); g.clip();
      drawWin(g, S, n, lit, 77 + i * 13);
      g.restore();
      const e = 2 / (S * N);
      WIN[n] = [cx / (S * N) + e, 1 - (cy + S) / (S * N) + e, (cx + S) / (S * N) - e, 1 - cy / (S * N) - e];
    });
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    return t;
  };
  return { map: mk(false), emissive: mk(true) };
}

// ---- Signs ------------------------------------------------------------------
export function drawSign(g, w, h, o) {
  const bg = o.bg || '#1b3fa0', fg = o.fg || '#ffffff';
  if (o.style === 'street') {
    g.fillStyle = '#1d3f93'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${h * 0.44}px ${FONT.ui}`; g.fillText(o.text, w / 2, h * 0.38, w - 24);
    g.font = `500 ${h * 0.2}px ${FONT.ui}`; g.fillText(o.sub || '', w / 2, h * 0.76, w - 24);
    return;
  }
  if (o.style === 'notice') {
    g.fillStyle = '#f4f1e6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'top';
    g.font = `400 ${h * 0.2}px ${FONT.serif}`; g.fillText(o.text, w / 2, h * 0.1, w - 20);
    g.font = `500 ${h * 0.1}px ${FONT.ui}`;
    (o.lines || []).forEach((l, i) => g.fillText(l, w / 2, h * 0.38 + i * h * 0.14, w - 24));
    return;
  }
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, bg); gr.addColorStop(1, o.bg2 || bg);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (o.stripe) { g.fillStyle = o.stripe; g.fillRect(0, h * 0.82, w, h * 0.18); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  const font = o.font || FONT.shop;
  let size = h * (o.sub ? 0.5 : 0.62);
  g.font = `${o.weight || 400} ${size}px ${font}`;
  const tw = g.measureText(o.text).width;
  if (tw > w * 0.9) { size *= (w * 0.9) / tw; g.font = `${o.weight || 400} ${size}px ${font}`; }
  if (o.shadow !== false) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(o.text, w / 2 + 2, h * (o.sub ? 0.4 : 0.5) + 3); }
  g.fillStyle = fg; g.fillText(o.text, w / 2, h * (o.sub ? 0.4 : 0.5));
  if (o.sub) {
    g.font = `500 ${h * 0.17}px ${FONT.ui}`; g.fillStyle = o.subFg || fg;
    g.fillText(o.sub, w / 2, h * (o.stripe ? 0.91 : 0.82), w * 0.94);
  }
  if (o.worn) { const r = new Rng(o.worn); grime(g, w, h, r, 10, 0.08); streaks(g, w, h, r, 5, 0.07); }
}

export function drawPoster(g, w, h, o, rng) {
  // Loud Israeli street poster: flat colour, huge type, a slogan.
  g.fillStyle = o.bg; g.fillRect(0, 0, w, h);
  if (o.band) { g.fillStyle = o.band; g.fillRect(0, h * 0.62, w, h * 0.38); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillStyle = o.fg || '#fff';
  let size = h * 0.3; g.font = `700 ${size}px ${FONT.display}`;
  const tw = g.measureText(o.text).width; if (tw > w * 0.9) { size *= (w * 0.9) / tw; g.font = `700 ${size}px ${FONT.display}`; }
  g.fillText(o.text, w / 2, h * 0.33);
  g.fillStyle = o.fg2 || '#111'; g.font = `700 ${h * 0.11}px ${FONT.ui}`;
  (o.lines || []).forEach((l, i) => g.fillText(l, w / 2, h * 0.72 + i * h * 0.14, w * 0.92));
  if (rng) { grime(g, w, h, rng, 8, 0.07); if (rng.chance(0.5)) { g.fillStyle = 'rgba(244,241,230,0.9)'; g.beginPath(); g.moveTo(w, 0); g.lineTo(w - w * 0.2, 0); g.lineTo(w, h * 0.16); g.fill(); } }
}

export function drawGraffiti(g, w, h, text, color, rng) {
  g.clearRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  let size = h * 0.7; const font = rng.pick([FONT.dirt, FONT.hand, FONT.display]);
  g.font = `700 ${size}px ${font}`;
  const tw = g.measureText(text).width; if (tw > w * 0.92) { size *= (w * 0.92) / tw; g.font = `700 ${size}px ${font}`; }
  g.save(); g.translate(w / 2, h / 2); g.rotate(rng.f(-0.06, 0.06));
  g.shadowColor = color; g.shadowBlur = 6; g.fillStyle = color; g.globalAlpha = 0.86; g.fillText(text, 0, 0);
  g.restore();
  for (let i = 0; i < 5; i++) { g.fillStyle = color; g.globalAlpha = 0.5; g.fillRect(rng.f(w * 0.15, w * 0.85), h * 0.6, 2, rng.f(6, h * 0.35)); }   // drips
  g.globalAlpha = 1;
}

// ---- Misc procedural textures ---------------------------------------------------
function canvasTex(w, h, draw, opt = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (opt.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opt.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opt.aniso || 4;
  return t;
}
function corrugated(aniso) {
  return canvasTex(256, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) { const v = 150 + Math.sin((x / w) * Math.PI * 2 * 16) * 38; g.fillStyle = `rgb(${v},${v + 3},${v + 6})`; g.fillRect(x, 0, 1, h); }
    const r = new Rng(5); streaks(g, w, h, r, 30, 0.18); grime(g, w, h, r, 20, 0.12, '120,70,30');
  }, { repeat: true, aniso });
}
function palmFrond() {
  return canvasTex(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#5c6b2a'; g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 8); g.stroke();
    for (let i = 0; i < 46; i++) {
      const t = i / 46, y = h - t * (h - 16), len = (w / 2 - 6) * Math.sin(Math.min(1, t * 1.3 + 0.12) * Math.PI) ** 0.6;
      const gcol = `rgb(${52 + (i % 5) * 7},${92 + (i % 7) * 7},${38 + (i % 3) * 6})`;
      for (const s of [-1, 1]) {
        g.strokeStyle = gcol; g.lineWidth = 5.5; g.beginPath(); g.moveTo(w / 2, y);
        g.quadraticCurveTo(w / 2 + s * len * 0.6, y - 26, w / 2 + s * len, y + 14); g.stroke();
      }
    }
  });
}
function leafBlob() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = new Rng(9);
    g.fillStyle = '#3d5a2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = r.pick(['#31481f', '#4f7036', '#5d7f3f', '#2a3d1c', '#6a8a46']); g.beginPath(); g.ellipse(r.f(w), r.f(h), r.f(2, 6), r.f(1.5, 4), r.f(3), 0, 7); g.fill(); }
  }, { repeat: true });
}
function chainlink() {
  return canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(150,156,160,0.95)'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.moveTo(-w / 2, h / 2); g.lineTo(w / 2, h * 1.5); g.moveTo(w / 2, -h / 2); g.lineTo(w * 1.5, h / 2); g.stroke();
  }, { repeat: true });
}
function lightPool() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function blobShadow() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// ---- Material set ----------------------------------------------------------------
// Sign sheets mounted over generated models (see CityBuilder.boards).
export const SIGN_SHEETS = ['signs_shops', 'signs_shops2', 'signs_shops3', 'signs_wide', 'signs_civic'];

export async function createMaterials(gfx) {
  const aniso = Math.min(gfx.q.aniso, gfx.maxAniso);
  const T = {};
  const names = ['plaster', 'concrete', 'asphalt', 'paving', 'sand', 'grass', 'roof'];
  await Promise.all(names.map(async (n) => {
    T[n] = await load(`assets/tex/${n}.webp`, aniso);
    T[n + 'N'] = gfx.q.shadow ? await load(`assets/tex/${n}_n.webp`, aniso, false) : null;
  }));
  T.weeds = await load('assets/tex/weeds.webp', aniso);
  const sheets = {};
  await Promise.all(SIGN_SHEETS.map(async (n) => { sheets[n] = await load(`assets/tex/${n}.webp`, aniso).catch(() => null); }));
  const win = buildWinAtlas(aniso);
  const signs = new Atlas(2048, 4096, 'sign'), decals = new Atlas(2048, 2048, 'decal');
  // First decal cell is solid white: road paint and plain decals sample it and use vertex colour.
  const whiteRect = decals.add(16, 16, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });

  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.92, metalness: 0 }, o));
  const nrm = (n, s = 1) => (T[n + 'N'] ? { normalMap: T[n + 'N'], normalScale: new THREE.Vector2(s, s) } : {});
  const M = {
    plaster: std(Object.assign({ map: T.plaster }, nrm('plaster', 0.9))),
    weed: std({ map: T.weeds, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1 }),
    concrete: std(Object.assign({ map: T.concrete, roughness: 0.88 }, nrm('concrete', 0.7))),
    asphalt: std(Object.assign({ map: T.asphalt, roughness: 0.86 }, nrm('asphalt', 0.9))),
    paving: std(Object.assign({ map: T.paving, roughness: 0.9 }, nrm('paving', 1.0))),
    sand: std(Object.assign({ map: T.sand, roughness: 1 }, nrm('sand', 0.8))),
    grass: std(Object.assign({ map: T.grass, roughness: 1 }, nrm('grass', 0.9))),
    roof: std({ map: T.roof, roughness: 0.95 }),
    metal: std({ map: corrugated(aniso), roughness: 0.55, metalness: 0.55 }),
    paint: std({ roughness: 0.7 }),                                   // flat painted things, colour from vertices
    gloss: std({ roughness: 0.25, metalness: 0.6 }),
    win: std({ map: win.map, roughness: 0.45, metalness: 0.05 }),
    winLit: std({ map: win.map, roughness: 0.45, emissiveMap: win.emissive, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0 }),
    sign: std({ map: null, roughness: 0.6, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0 }),
    decal: new THREE.MeshStandardMaterial({ map: null, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    leaf: std({ map: leafBlob(), roughness: 1 }),
    frond: new THREE.MeshStandardMaterial({ map: palmFrond(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, vertexColors: true }),
    fence: new THREE.MeshStandardMaterial({ map: chainlink(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5, vertexColors: true }),
    glow: new THREE.MeshBasicMaterial({ map: lightPool(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, opacity: 0, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, fog: true }),
    shadow: new THREE.MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  };
  M.sign.emissiveMap = null;
  const finish = () => {
    const st = signs.texture(aniso), dt = decals.texture(aniso);
    M.sign.map = st; M.sign.emissiveMap = st; M.sign.needsUpdate = true;
    M.decal.map = dt; M.decal.needsUpdate = true;
  };
  // Lamps, windows and signs come on at dusk.
  // Generated buildings have no separate window layer, so at night their own texture is read
  // for glass (dark, cool pixels) and a random share of it is made to glow.
  const homes = [];
  const lightWindows = (mat, share = 0.38) => {
    const img = mat.map && mat.map.image;
    if (!img || mat.userData.lit) return;
    mat.userData.lit = true;
    const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S), p = d.data;
    const cell = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h & 1023) / 1023; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4, r = p[i], gg = p[i + 1], b = p[i + 2], lum = r * 0.3 + gg * 0.59 + b * 0.11;
      const glass = lum < 78 && b > r - 12 && Math.max(r, gg, b) - Math.min(r, gg, b) < 60;
      const c = cell(x >> 5, y >> 5), on = glass && c < share;
      const k = on ? 0.55 + (1 - lum / 78) * 0.45 : 0, tv = on && c < share * 0.18;
      p[i] = (tv ? 150 : 255) * k; p[i + 1] = (tv ? 190 : 196) * k; p[i + 2] = (tv ? 255 : 120) * k;
    }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.flipY = mat.map.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = mat.map.wrapS; t.wrapT = mat.map.wrapT;
    mat.emissiveMap = t; mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = 0; mat.needsUpdate = true;
    homes.push(mat);
  };
  const boards = [];
  for (const n of SIGN_SHEETS) if (sheets[n]) { M['sgn_' + n] = std({ map: sheets[n], roughness: 0.6, emissive: new THREE.Color(0xffffff), emissiveMap: sheets[n], emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); boards.push(M['sgn_' + n]); }
  const setNight = (n) => {
    for (const b of boards) b.emissiveIntensity = n * 0.55;
    for (const h of homes) h.emissiveIntensity = n * 1.1;
    M.winLit.emissiveIntensity = n * 0.6;
    M.sign.emissiveIntensity = 0.04 + n * 0.5;
    M.glow.opacity = n * 0.5;
    M.bulb.color.setScalar(0.25 + n * 2.2);
  };
  return { M, T, signs, decals, whiteRect, finish, setNight, aniso, lightWindows };
}
