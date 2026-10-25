// Builds playable levels from artworks: splits each color into buckets, orders
// them by when their pixels become reachable, then adds controlled chaos.
import { ART, artToGrid, PALETTE } from './art.js';

export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Peel layers: layer k = pixels first visible from outside after layers < k are painted.
export function peelLayers(w, h, cells) {
  const layer = new Int16Array(w * h).fill(-1);
  let remaining = cells.filter((c) => c >= 0).length;
  let k = 0;
  while (remaining > 0 && k < 999) {
    const hit = [];
    const look = (x, y, dx, dy) => {
      while (x >= 0 && y >= 0 && x < w && y < h) {
        const i = y * w + x;
        if (cells[i] >= 0 && layer[i] < 0) { hit.push(i); return; }
        x += dx; y += dy;
      }
    };
    for (let x = 0; x < w; x++) { look(x, h - 1, 0, -1); look(x, 0, 0, 1); }
    for (let y = 0; y < h; y++) { look(w - 1, y, -1, 0); look(0, y, 1, 0); }
    for (const i of hit) if (layer[i] < 0) { layer[i] = k; remaining--; }
    k++;
  }
  return layer;
}

function splitTotal(total, parts, rand, nice) {
  // Splits total into `parts` positive integers, roughly even, optionally rounded to 5s.
  if (parts <= 1) return [total];
  const out = [];
  let left = total;
  for (let i = parts; i > 1; i--) {
    let v = left / i * (0.8 + rand() * 0.4);
    v = nice && v >= 10 ? Math.round(v / 5) * 5 : Math.round(v);
    v = Math.max(1, Math.min(left - (i - 1), v));
    out.push(v); left -= v;
  }
  out.push(left);
  return out;
}

// opts: { art, lanes, slots, beltCap, shooters (target count), noise, hidden, coat, twins, bg, seed }
export function buildLevel(opts) {
  const art = typeof opts.art === 'string' ? ART.find((a) => a.id === opts.art) : opts.art;
  const rand = rng(opts.seed ?? hashStr(art.id));
  let rows = art.rows;
  if (opts.bg) rows = rows.map((r) => r.replace(/\./g, opts.bg));
  if (opts.scale > 1) {
    const k = opts.scale;
    rows = rows.flatMap((r) => { const wide = [...r].map((ch) => ch.repeat(k)).join(''); return Array(k).fill(wide); });
  }
  const g = artToGrid({ ...art, rows });
  const { w, h, cells } = g;
  const n = w * h;
  const coats = new Array(n).fill(1);
  if (opts.coat) {
    // Double-coat one or two colors (never the largest), so stripes read as shapes.
    const counts = g.keys.map((_, k) => cells.filter((c) => c === k).length);
    const order = counts.map((c, k) => [c, k]).sort((a, b) => a[0] - b[0]);
    const pick = new Set();
    let budget = Math.round(cells.filter((c) => c >= 0).length * opts.coat);
    for (const [c, k] of order) { if (budget <= 0) break; if (c <= budget + 4 && c > 1) { pick.add(k); budget -= c; } }
    for (let i = 0; i < n; i++) if (pick.has(cells[i])) coats[i] = 2;
  }
  const layer = peelLayers(w, h, cells);
  const totalCoats = cells.reduce((s, c, i) => s + (c >= 0 ? coats[i] : 0), 0);
  const target = Math.max(g.keys.length, opts.shooters || Math.round(totalCoats / 12));
  const chunks = [];
  g.keys.forEach((_, k) => {
    const idx = [];
    for (let i = 0; i < n; i++) if (cells[i] === k) for (let c = 0; c < coats[i]; c++) idx.push(i);
    idx.sort((a, b) => layer[a] - layer[b] || a - b);
    const parts = Math.max(1, Math.round(target * idx.length / totalCoats));
    const sizes = splitTotal(idx.length, parts, rand, idx.length >= 30);
    let at = 0;
    for (const s of sizes) {
      const part = idx.slice(at, at + s); at += s;
      const mean = part.reduce((q, i) => q + layer[i], 0) / part.length;
      const first = layer[part[0]];
      chunks.push({ c: k, n: s, key: first * 0.6 + mean * 0.4 });
    }
  });
  const noise = opts.noise ?? 0;
  for (const ch of chunks) ch.key += (rand() - 0.5) * 2 * noise;
  chunks.sort((a, b) => a.key - b.key);
  const L = opts.lanes || 2;
  const lanes = Array.from({ length: L }, () => []);
  chunks.forEach((ch, i) => {
    let li = i % L;
    if (noise > 0 && rand() < Math.min(0.5, noise / 6)) li = Math.floor(rand() * L);
    lanes[li].push({ c: ch.c, n: ch.n });
  });
  if (opts.hidden) {
    for (const lane of lanes) for (let i = 1; i < lane.length; i++) if (rand() < opts.hidden) lane[i].hidden = true;
  }
  if (opts.twins && L >= 2) {
    let made = 0, tries = 0;
    while (made < opts.twins && tries++ < 40) {
      const li = Math.floor(rand() * (L - 1));
      const depth = 1 + Math.floor(rand() * 3);
      const a = lanes[li][depth], b = lanes[li + 1][depth];
      if (a && b && !a.twin && !b.twin) { made++; a.twin = b.twin = made; }
    }
  }
  return {
    art: art.id, name: art.name, album: art.album,
    w, h, cells, coats: opts.coat ? coats : undefined,
    keys: g.keys, colors: g.colors,
    lanes, slots: opts.slots ?? 5, beltCap: opts.beltCap ?? 5, spacing: w >= 20 ? 3 : 2,
  };
}

export const COLOR_NAMES = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.name]));
