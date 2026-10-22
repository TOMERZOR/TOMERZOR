// Set pieces for the level generator. Every piece returns objects plus a bounding box.
// Coordinates: meters, y up, floor top at y=0, walls at x=0 and x=9.

export const W = 9;
const SH = 0.26; // shelf thickness

export function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
}

const r2 = (v) => Math.round(v * 1000) / 1000;

// glass item resting on a surface whose top is at sy
export function glassItem(r, x, sy, kind) {
  kind = kind || r.pick(['jar', 'jar', 'bottle', 'orb', 'box', 'pane']);
  const tint = r.int(0, 2);
  switch (kind) {
    case 'jar': { const w = r2(r.range(0.64, 0.78)), h = r2(r.range(0.76, 0.96)); return { t: 'glass', s: 'jar', x, y: r2(sy + h / 2 + 0.004), w, h, tint }; }
    case 'bottle': { const w = r2(r.range(0.46, 0.56)), h = r2(r.range(1.15, 1.4)); return { t: 'glass', s: 'bottle', x, y: r2(sy + h / 2 + 0.004), w, h, tint }; }
    case 'orb': { const rr = r2(r.range(0.36, 0.44)); return { t: 'glass', s: 'orb', x, y: r2(sy + rr + 0.004), r: rr, tint }; }
    case 'box': { const q = r2(r.range(0.64, 0.78)); return { t: 'glass', s: 'box', x, y: r2(sy + q / 2 + 0.004), w: q, h: q, tint }; }
    case 'pane': default: { const h = r2(r.range(1.15, 1.5)); return { t: 'glass', s: 'pane', x, y: r2(sy + h / 2 + 0.004), w: 0.2, h, tint }; }
  }
}
export function itemWidth(o) { return o.r ? o.r * 2 : o.w; }
export function itemHeight(o) { return o.r ? o.r * 2 : o.h; }

function shelf(x, y, w, extra = {}) { return { t: 'shelf', x, y, w, h: SH, round: true, ...extra }; }

// place n items across a surface [x0,x1] at top sy, returns objects
function rowOn(r, x0, x1, sy, n, kinds) {
  const items = [];
  for (let i = 0; i < n; i++) items.push(glassItem(r, 0, sy, kinds ? r.pick(kinds) : undefined));
  const total = items.reduce((s, o) => s + itemWidth(o), 0);
  const free = x1 - x0 - total;
  if (free < 0.1 * (n + 1)) return null;
  const gap = free / (n + 1);
  let cx = x0 + gap;
  for (const o of items) { o.x = r2(cx + itemWidth(o) / 2); cx += itemWidth(o) + gap; }
  return items;
}

function bbox(objs, pad = 0) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const o of objs) {
    if (o.t === 'rope') { if (o.from != null) continue; x0 = Math.min(x0, o.x); x1 = Math.max(x1, o.x); y1 = Math.max(y1, Math.min(o.y, 13.3)); continue; }
    const hw = o.r ? o.r : Math.max(o.w, o.h) / 2 * (o.a ? 1 : 0) + (o.a ? 0 : o.w / 2);
    const hh = o.r ? o.r : (o.a ? Math.max(o.w, o.h) / 2 : o.h / 2);
    const ex = (o.dx ? Math.abs(o.dx) : 0), ey = (o.dy ? Math.abs(o.dy) : 0);
    x0 = Math.min(x0, o.x - hw - ex); x1 = Math.max(x1, o.x + hw + ex);
    y0 = Math.min(y0, o.y - hh - ey); y1 = Math.max(y1, o.y + hh + ey);
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

// ---------------- pieces ----------------
// each: (r, slot) => objects | null ; slot = {y} suggested base height

export const PIECES = {
  shelfRow(r, s) {
    const w = r.range(2.6, 4.6), x = r.range(w / 2 + 0.3, W - w / 2 - 0.3), y = s.y;
    const n = r.int(3, Math.max(3, Math.floor(w / 0.85)));
    const items = rowOn(r, x - w / 2 + 0.05, x + w / 2 - 0.05, y + SH / 2, n);
    return items && [shelf(r2(x), r2(y), r2(w)), ...items];
  },
  wallLedge(r, s) {
    const w = r.range(2.2, 3.6), left = r.chance(0.5), y = s.y;
    const x = left ? w / 2 : W - w / 2;
    const n = r.int(2, Math.max(2, Math.floor(w / 0.85)));
    const items = rowOn(r, x - w / 2 + 0.05, x + w / 2 - 0.05, y + SH / 2, n);
    return items && [shelf(r2(x), r2(y), r2(w)), ...items];
  },
  pyramid(r, s) {
    const rows = r.int(3, 4), size = r2(r.range(0.6, 0.7)), w = rows * size + 0.8;
    const x = r.range(w / 2 + 0.3, W - w / 2 - 0.3), y = s.y;
    const objs = [shelf(r2(x), r2(y), r2(w))];
    let top = y + SH / 2;
    for (let i = 0; i < rows; i++) {
      const n = rows - i;
      for (let k = 0; k < n; k++) {
        const cx = x + (k - (n - 1) / 2) * (size + 0.02);
        objs.push({ t: 'glass', s: 'box', x: r2(cx), y: r2(top + size / 2 + 0.004), w: size, h: size, tint: r.int(0, 2) });
      }
      top += size + 0.008;
    }
    return objs;
  },
  floorCorner(r) {
    const left = r.chance(0.5), n = r.int(2, 3);
    const x0 = left ? 0.1 : W - 0.1 - n * 0.95, x1 = x0 + n * 0.95;
    const items = rowOn(r, x0, x1, 0, n, ['jar', 'bottle', 'box', 'orb']);
    if (!items) return null;
    const objs = [...items];
    if (r.chance(0.5)) {
      // overhang that blocks steep shots
      const ow = n * 0.95 + 0.6, oy = r.range(2.3, 3.2);
      objs.push(shelf(r2(left ? ow / 2 : W - ow / 2), r2(oy), r2(ow)));
    }
    return objs;
  },
  tower(r, s) {
    const layers = r.int(2, 3), x = r.range(1.8, W - 1.8), y = s.y;
    const objs = [shelf(r2(x), r2(y), 2.3)];
    let top = y + SH / 2;
    for (let i = 0; i < layers; i++) {
      const h = r2(r.range(0.7, 0.86));
      objs.push({ t: 'glass', s: 'jar', x: r2(x - 0.55), y: r2(top + h / 2 + 0.004), w: 0.62, h, tint: r.int(0, 2) });
      objs.push({ t: 'glass', s: 'jar', x: r2(x + 0.55), y: r2(top + h / 2 + 0.004), w: 0.62, h, tint: r.int(0, 2) });
      top += h + 0.008;
      objs.push({ t: 'wood', x: r2(x), y: r2(top + 0.09 + 0.004), w: 1.9, h: 0.18 });
      top += 0.188;
    }
    objs.push(glassItem(r, x, top + 0.004, r.pick(['bottle', 'orb', 'jar'])));
    return objs;
  },
  glassTower(r, s) {
    const x = r.range(1.4, W - 1.4), y = s.y, n = r.int(3, 5);
    const objs = [shelf(r2(x), r2(y), 1.6)];
    let top = y + SH / 2;
    for (let i = 0; i < n; i++) {
      const o = glassItem(r, x, top, i === n - 1 ? r.pick(['bottle', 'orb', 'jar']) : 'box');
      objs.push(o); top += itemHeight(o) + 0.008;
    }
    return objs;
  },
  stoneDrop(r, s) {
    const left = r.chance(0.5), y = s.y;
    const w = r.range(1.6, 2.2);
    const x = left ? r.range(w / 2 + 0.2, 3.5) : r.range(W - 3.5, W - w / 2 - 0.2);
    const st = r2(r.range(0.7, 0.9));
    const edge = left ? x + w / 2 - st / 2 - 0.05 : x - w / 2 + st / 2 + 0.05;
    const objs = [shelf(r2(x), r2(y), r2(w)), { t: 'stone', x: r2(edge), y: r2(y + SH / 2 + st / 2 + 0.004), w: st, h: st }];
    // glass below, in the fall line
    const ly = y - r.range(2.4, 3.4);
    const gx = left ? edge + r.range(0.2, 0.7) : edge - r.range(0.2, 0.7);
    if (ly > 1.2) {
      const lw = r.range(1.8, 2.6);
      objs.push(shelf(r2(gx), r2(ly), r2(lw)));
      const items = rowOn(r, gx - lw / 2 + 0.05, gx + lw / 2 - 0.05, ly + SH / 2, r.int(2, 3));
      if (!items) return null;
      objs.push(...items);
    } else {
      objs.push(glassItem(r, r2(gx), 0));
    }
    // a guard so the glass below is not trivially hit directly
    if (r.chance(0.5)) objs.push({ t: 'shelf', x: r2(gx), y: r2((ly > 1.2 ? ly : 0) - 0.6), w: 1.6, h: SH, round: true });
    return objs;
  },
  domino(r, s) {
    const n = r.int(3, 5), y = s.y, gap = 0.62, w = n * gap + 1.3;
    const left = r.chance(0.5);
    const x = left ? w / 2 : W - w / 2;
    const objs = [shelf(r2(x), r2(y), r2(w))];
    const top = y + SH / 2;
    for (let i = 0; i < n; i++) {
      const px = left ? 0.35 + i * gap : W - 0.35 - i * gap;
      objs.push({ t: 'wood', x: r2(px), y: r2(top + 0.56 + 0.004), w: 0.17, h: 1.12 });
    }
    const ex = left ? 0.35 + n * gap - 0.05 : W - 0.35 - n * gap + 0.05;
    objs.push(glassItem(r, r2(ex + (left ? 0.15 : -0.15)), top, r.pick(['jar', 'bottle', 'orb'])));
    return objs;
  },
  pole(r, s) {
    const n = r.int(1, 3), y = s.y, ph = r2(r.range(1.1, 1.8)), gap = 1.15;
    const x = r.range(0.9 + (n - 1) * gap / 2, W - 0.9 - (n - 1) * gap / 2);
    const top = y + SH / 2;
    const objs = [shelf(r2(x), r2(y), r2(1.2 + (n - 1) * gap))];
    for (let i = 0; i < n; i++) {
      const px = r2(x + (i - (n - 1) / 2) * gap);
      objs.push({ t: 'wood', x: px, y: r2(top + ph / 2 + 0.004), w: 0.24, h: ph }, glassItem(r, px, top + ph + 0.008, r.pick(['jar', 'box', 'orb'])));
    }
    return objs;
  },
  cage(r, s) {
    const x = r.range(1.8, W - 1.8), y = s.y, w = r.range(1.9, 2.6), wh = r.range(1.1, 1.5);
    const objs = [shelf(r2(x), r2(y), r2(w + 0.2))];
    objs.push({ t: 'shelf', x: r2(x - w / 2), y: r2(y + SH / 2 + wh / 2), w: 0.18, h: r2(wh), round: true });
    objs.push({ t: 'shelf', x: r2(x + w / 2), y: r2(y + SH / 2 + wh / 2), w: 0.18, h: r2(wh), round: true });
    const items = rowOn(r, x - w / 2 + 0.1, x + w / 2 - 0.1, y + SH / 2, r.int(2, 3), ['jar', 'orb', 'box', 'bottle']);
    if (!items) return null;
    objs.push(...items);
    if (r.chance(0.45)) {
      // roof with a gap on one side
      const rw = w * 0.62, side = r.chance(0.5) ? -1 : 1;
      objs.push({ t: 'shelf', x: r2(x + side * (w / 2 - rw / 2 + 0.09)), y: r2(y + SH / 2 + wh + 0.4), w: r2(rw), h: SH, round: true });
    }
    return objs;
  },
  shield(r, s) {
    // glass hidden behind a vertical blocker, reachable by banking off a wall
    const left = r.chance(0.5), y = s.y;
    const w = r.range(2.0, 2.8), x = left ? w / 2 : W - w / 2;
    const objs = [shelf(r2(x), r2(y), r2(w))];
    const items = rowOn(r, x - w / 2 + 0.05, x + w / 2 - 0.25, y + SH / 2, r.int(2, 3), ['jar', 'bottle', 'box', 'orb']);
    if (!items) return null;
    if (!left) for (const o of items) o.x = r2(o.x + 0.2);
    objs.push(...items);
    const bx = left ? w + 0.05 : W - w - 0.05, bh = r.range(1.4, 2.0);
    objs.push({ t: 'shelf', x: r2(bx), y: r2(y + SH / 2 + bh / 2 - 0.3), w: 0.2, h: r2(bh + 0.6), round: true });
    return objs;
  },
  pad(r, s) {
    const left = r.chance(0.5), y = s.y;
    const a = (left ? -1 : 1) * r.range(0.35, 0.8);
    const x = left ? r.range(0.8, 2.2) : r.range(W - 2.2, W - 0.8);
    return [{ t: 'pad', x: r2(x), y: r2(y), w: r2(r.range(1.0, 1.5)), h: 0.2, a: r2(a), round: true }];
  },
  bombPack(r, s) {
    const w = r.range(3.2, 4.4), x = r.range(w / 2 + 0.3, W - w / 2 - 0.3), y = s.y;
    const top = y + SH / 2;
    const guard = r.chance(0.5);
    const objs = [shelf(r2(x), r2(y), r2(w)), { t: 'bomb', x: r2(x + r.range(-0.3, 0.3)), y: r2(top + 0.34 + 0.004), r: 0.34 }];
    const l = rowOn(r, x - w / 2 + (guard ? 0.4 : 0.05), x - 0.55, top, r.int(1, 2));
    const rr = rowOn(r, x + 0.55, x + w / 2 - 0.05, top, r.int(2, 3));
    if (!l || !rr) return null;
    objs.push(...l, ...rr);
    // a stone guard on the outside edge
    if (guard) objs.push({ t: 'stone', x: r2(x - w / 2 + 0.17), y: r2(top + 0.354), w: 0.3, h: 0.7 });
    return objs;
  },
  bombChain(r, s) {
    const y = s.y;
    const objs = [];
    const x1 = r.range(1.2, 2.8), x2 = x1 + r.range(2.6, 3.8);
    if (x2 > W - 1.2) return null;
    objs.push(shelf(r2(x1), r2(y), 1.6), { t: 'bomb', x: r2(x1), y: r2(y + SH / 2 + 0.344), r: 0.34 });
    objs.push(shelf(r2(x2), r2(y + r.range(-1.2, 1.2)), 2.4));
    const s2 = objs[2];
    const items = rowOn(r, x2 - 1.15, x2 + 1.15, s2.y + SH / 2, r.int(2, 3));
    if (!items) return null;
    objs.push(...items);
    // bomb between
    objs.push({ t: 'bomb', x: r2((x1 + x2) / 2), y: r2(Math.min(y, s2.y) - 0.2), r: 0.3 });
    objs.push(shelf(r2((x1 + x2) / 2), r2(Math.min(y, s2.y) - 0.2 - 0.3 - SH / 2 - 0.004), 0.9));
    return objs;
  },
  hangRow(r, s) {
    const n = r.int(3, 5), x0 = r.range(0.9, 2.6), x1 = r.range(6.4, 8.1);
    const y0 = s.y, tilt = r.range(-2.2, 2.2);
    const kind = r.pick(['orb', 'jar', 'bottle', 'mix']);
    const objs = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const g = glassItem(r, 0, 0, kind === 'mix' ? r.pick(['orb', 'jar', 'bottle']) : kind);
      g.x = r2(x0 + (x1 - x0) * t);
      g.y = r2(Math.min(12.6, Math.max(3.2, y0 + tilt * (t - 0.5) * 2)));
      objs.push(g, { t: 'rope', x: g.x, y: 14, to: objs.length });
    }
    return objs;
  },
  beads(r, s) {
    // a string of glass hanging from the ceiling, each piece hanging from the one above
    const n = r.int(3, 5), x = r2(r.range(1.0, W - 1.0)), gap = r.range(0.35, 0.65);
    const kind = r.pick(['orb', 'orb', 'jar', 'mix']);
    const objs = [];
    let y = Math.min(13.2, s.y + n * 1.4);
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const g = glassItem(r, x, 0, kind === 'mix' ? r.pick(['orb', 'jar', 'box']) : kind);
      const hh = itemHeight(g) / 2;
      y -= (i === 0 ? r.range(0.6, 1.4) : gap) + hh;
      g.x = x; g.y = r2(y);
      y -= hh;
      const gi = objs.length;
      objs.push(g);
      objs.push(prev < 0 ? { t: 'rope', x, y: 14, to: gi } : { t: 'rope', from: prev, to: gi });
      prev = gi;
    }
    if (y < 2.6) return null;
    return objs;
  },
  pendulum(r, s) {
    // glass swinging under a beam; the beam can carry glass of its own
    const n = r.int(1, 3), gap = r.range(1.1, 1.6);
    const span = (n - 1) * gap;
    const bx = r.range(0.9 + span / 2 + 0.4, W - 0.9 - span / 2 - 0.4);
    const by = s.y + r.range(1.6, 2.4), bw = span + r.range(1.2, 1.8);
    if (by > 12.6) return null;
    const objs = [shelf(r2(bx), r2(by), r2(bw))];
    const item = r.pick(['orb', 'jar', 'bottle']);
    for (let i = 0; i < n; i++) {
      const ax = r2(bx + (i - (n - 1) / 2) * gap), ay = r2(by - SH / 2);
      const len = r.range(0.9, 1.7);
      const g = glassItem(r, ax, 0, item);
      g.y = r2(ay - len - itemHeight(g) / 2);
      objs.push(g, { t: 'rope', x: ax, y: ay, to: objs.length });
    }
    if (r.chance(0.5)) {
      const top = rowOn(r, bx - bw / 2 + 0.05, bx + bw / 2 - 0.05, by + SH / 2, r.int(1, 3));
      if (top) objs.push(...top);
    }
    return objs;
  },
  slider(r, s) {
    const x = r.range(2.6, W - 2.6), y = s.y, w = r.range(1.7, 2.3);
    const dx = r.range(1.0, Math.min(2.0, x - w / 2 - 0.3, W - x - w / 2 - 0.3));
    if (dx < 0.6) return null;
    const objs = [{ t: 'mover', x: r2(x), y: r2(y), w: r2(w), h: SH, dx: r2(dx), period: r2(r.range(3.5, 6)) }];
    const items = rowOn(r, x - w / 2 + 0.1, x + w / 2 - 0.1, y + SH / 2, r.int(2, 3), ['jar', 'box', 'orb']);
    if (!items) return null;
    objs.push(...items);
    return objs;
  },
  spinner(r, s) {
    const x = r.range(2.0, W - 2.0), y = s.y;
    return [{ t: 'mover', x: r2(x), y: r2(y), w: r2(r.range(1.4, 2.2)), h: 0.2, spin: r2((r.chance(0.5) ? 1 : -1) * r.range(0.8, 1.8)) }];
  },
};

// mechanics per world: [piece name, weight]
export const WORLD_PIECES = [
  [['hangRow', 3], ['beads', 3], ['shelfRow', 3], ['wallLedge', 3], ['pyramid', 2], ['floorCorner', 1], ['glassTower', 2], ['cage', 1]],
  [['hangRow', 1], ['stoneDrop', 4], ['tower', 3], ['domino', 3], ['pole', 2], ['shelfRow', 2], ['wallLedge', 1], ['pyramid', 1]],
  [['hangRow', 1], ['shield', 4], ['pad', 3], ['cage', 3], ['stoneDrop', 1], ['tower', 1], ['shelfRow', 1], ['wallLedge', 1]],
  [['hangRow', 1], ['bombPack', 4], ['bombChain', 3], ['shelfRow', 1], ['tower', 1], ['shield', 1], ['pyramid', 1], ['domino', 1]],
  [['pendulum', 4], ['beads', 2], ['slider', 3], ['spinner', 2], ['bombPack', 1], ['shield', 1], ['stoneDrop', 1], ['shelfRow', 1]],
];
// first piece of every level in a world should showcase the world's mechanic
export const WORLD_SIGNATURE = [
  ['hangRow', 'beads', 'shelfRow', 'wallLedge', 'pyramid', 'glassTower'],
  ['stoneDrop', 'tower', 'domino', 'pole'],
  ['shield', 'pad', 'cage'],
  ['bombPack', 'bombChain'],
  ['pendulum', 'slider', 'spinner'],
];

function weighted(r, list) {
  const tot = list.reduce((s, [, w]) => s + w, 0);
  let x = r() * tot;
  for (const [n, w] of list) { x -= w; if (x <= 0) return n; }
  return list[0][0];
}

function overlaps(a, b) { return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1; }

// Compose a level candidate.
export function composeLevel(r, world, nPieces, minGlass = 3, mirror = false) {
  const objs = [];
  const boxes = [];
  const launcherX = mirror || r.chance(0.7) ? 4.5 : r.pick([2.4, 3.3, 5.7, 6.6]);
  if (mirror) nPieces = Math.max(1, Math.ceil(nPieces / 2));
  boxes.push({ x0: launcherX - 1.4, x1: launcherX + 1.4, y0: -1, y1: 2.0 });
  const used = [];
  // stratified heights so pieces spread over the whole room
  const bands = [];
  for (let i = 0; i < 6; i++) bands.push(2.7 + i * 1.6);
  let tries = 0;
  while (used.length < nPieces && tries++ < 60) {
    const name = used.length === 0 ? r.pick(WORLD_SIGNATURE[world]) : weighted(r, WORLD_PIECES[world]);
    const band = bands[(used.length * 2 + r.int(0, 5)) % bands.length];
    const slot = { y: band + r.range(-0.6, 0.6) };
    const p = PIECES[name](r, slot);
    if (!p) continue;
    const bb = bbox(p, 0.3);
    if (bb.x0 < -0.35 || bb.x1 > W + 0.35 || bb.y1 > 13.6 || bb.y0 < -0.35) continue;
    if (mirror && bb.x1 > W / 2 - 0.05) continue;
    if (boxes.some((b) => overlaps(b, bb))) continue;
    boxes.push(bb);
    const base = objs.length;
    for (const o of p) {
      if (o.t === 'rope') { o.to += base; if (o.from != null) o.from += base; }
      objs.push(o);
    }
    used.push(name);
  }
  if (!used.length) return null;
  if (mirror) {
    const n = objs.length;
    for (let i = 0; i < n; i++) {
      const o = { ...objs[i], x: Math.round((W - objs[i].x) * 1000) / 1000 };
      if (o.a) o.a = -o.a;
      if (o.spin) o.spin = -o.spin;
      if (o.t === 'rope') { o.to += n; if (o.from != null) o.from += n; }
      if (o.t === 'glass') o.tint = (o.tint + 1) % 3;
      objs.push(o);
    }
    used.push('mirror');
  }
  const glass = objs.filter((o) => o.t === 'glass').length;
  if (glass < minGlass) return null;
  return { launcher: { x: launcherX }, objects: objs, pieces: used };
}
