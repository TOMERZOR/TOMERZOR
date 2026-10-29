// The garden: COLS columns, ROWS rows, row 0 at the top. Everything obeys gravity, so each column
// is a stack packed at the bottom. grid holds 0 (empty), a seed colour 1..6, or WEED.
// spec marks special flowers: BOMB (blasts a 3x3 when it blooms) and RAINBOW (blooms every seed of
// its colour).
export const COLS = 8, ROWS = 10, WEED = 9, MIN_GROUP = 4;
export const BOMB = 1, RAINBOW = 2;
export const BOMB_AT = 6, RAINBOW_AT = 8; // group sizes that leave a special behind

export const emptyBoard = () => ({ grid: new Uint8Array(COLS * ROWS), spec: new Uint8Array(COLS * ROWS) });
export const cloneBoard = (b) => ({ grid: b.grid.slice(), spec: b.spec.slice() });
export const idx = (r, c) => r * COLS + c;

export function heights(b) {
  const h = new Array(COLS).fill(0);
  for (let c = 0; c < COLS; c++) for (let r = ROWS - 1; r >= 0 && b.grid[idx(r, c)]; r--) h[c]++;
  return h;
}

// A piece is { cells: [[r, c], ...], colors: [...] } normalised to start at (0, 0).
// Dropped with its left edge at column `col`, each of its columns stacks onto that column.
export function columnsOf(piece, col) {
  const cols = new Map();
  piece.cells.forEach(([r, c], i) => {
    const x = col + c;
    if (!cols.has(x)) cols.set(x, []);
    cols.get(x).push({ r, color: piece.colors[i] });
  });
  for (const list of cols.values()) list.sort((a, b) => b.r - a.r); // bottom cell lands first
  return cols;
}

export function pieceWidth(piece) { return Math.max(...piece.cells.map((p) => p[1])) + 1; }
export function pieceHeight(piece) { return Math.max(...piece.cells.map((p) => p[0])) + 1; }

export function canDrop(b, piece, col, h = heights(b)) {
  if (col < 0 || col + pieceWidth(piece) > COLS) return false;
  for (const [x, list] of columnsOf(piece, col)) if (h[x] + list.length > ROWS) return false;
  return true;
}

export function anyDrop(b, piece) {
  const h = heights(b);
  for (const p of rotations(piece)) for (let c = 0; c + pieceWidth(p) <= COLS; c++) if (canDrop(b, p, c, h)) return true;
  return false;
}

// Puts the piece's seeds into the board. Returns where each landed and how far it fell (rows).
export function drop(b, piece, col) {
  const h = heights(b);
  const landed = [];
  for (const [x, list] of columnsOf(piece, col)) {
    list.forEach((cell, k) => {
      const r = ROWS - 1 - h[x] - k;
      b.grid[idx(r, x)] = cell.color;
      b.spec[idx(r, x)] = 0;
      landed.push({ r, c: x, from: cell.r - pieceHeight(piece) });
    });
  }
  return landed;
}

export function rotate(piece) {
  // 90° clockwise: (r, c) -> (c, H-1-r), colours travel with their cells
  const H = pieceHeight(piece);
  const cells = piece.cells.map(([r, c]) => [c, H - 1 - r]);
  return { ...piece, cells };
}

export function rotations(piece) {
  const out = [piece];
  const seen = new Set([sig(piece)]);
  let p = piece;
  for (let i = 0; i < 3; i++) {
    p = rotate(p);
    const s = sig(p);
    if (!seen.has(s)) { seen.add(s); out.push(p); }
  }
  return out;
}
const sig = (p) => p.cells.map(([r, c], i) => `${r},${c},${p.colors[i]}`).sort().join(';');

// Same-colour connected groups (4-neighbour). Weeds never match.
export function groups(b, min = MIN_GROUP) {
  const seen = new Uint8Array(COLS * ROWS);
  const out = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const col = b.grid[i];
    if (!col || col === WEED || seen[i]) continue;
    const cells = [i];
    seen[i] = 1;
    for (let k = 0; k < cells.length; k++) {
      const j = cells[k], r = Math.floor(j / COLS), c = j % COLS;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
        const n = idx(nr, nc);
        if (!seen[n] && b.grid[n] === col) { seen[n] = 1; cells.push(n); }
      }
    }
    if (cells.length >= min) out.push({ color: col, cells });
  }
  return out;
}

// Compacts every column to the bottom. Returns the moves [{ c, from, to }] for the animation.
export function settle(b) {
  const moves = [];
  for (let c = 0; c < COLS; c++) {
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = idx(r, c);
      if (!b.grid[i]) continue;
      if (r !== w) {
        const j = idx(w, c);
        b.grid[j] = b.grid[i]; b.spec[j] = b.spec[i];
        b.grid[i] = 0; b.spec[i] = 0;
        moves.push({ c, from: r, to: w });
      }
      w--;
    }
  }
  return moves;
}

// Blooms everything that matches, lets the garden fall, and repeats until nothing matches.
// Returns one step per link of the chain (for scoring and animation). `prefer` lists cells
// (indices) where a new special flower should appear if it can (the seeds just dropped).
export function resolve(b, prefer = []) {
  const steps = [];
  let chain = 0;
  for (;;) {
    const gs = groups(b);
    if (!gs.length) break;
    chain++;
    const clear = new Set();
    const made = [];
    const keep = new Set();
    for (const g of gs) {
      for (const i of g.cells) clear.add(i);
      if (g.cells.length >= BOMB_AT) {
        const pool = g.cells.filter((i) => !b.spec[i]);
        const anchor = pool.find((i) => prefer.includes(i)) ?? pool.sort((a, c) => c - a)[0];
        if (anchor !== undefined) {
          keep.add(anchor);
          made.push({ i: anchor, kind: g.cells.length >= RAINBOW_AT ? RAINBOW : BOMB, color: g.color });
        }
      }
    }
    // specials caught in the bloom go off, and can set each other off
    const blasts = [];
    const queue = [...clear].filter((i) => b.spec[i]);
    const fired = new Set();
    while (queue.length) {
      const i = queue.pop();
      if (fired.has(i) || keep.has(i)) continue;
      fired.add(i);
      const r = Math.floor(i / COLS), c = i % COLS;
      blasts.push({ r, c, kind: b.spec[i], color: b.grid[i] });
      const hit = [];
      if (b.spec[i] === BOMB) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < ROWS && nc < COLS && b.grid[idx(nr, nc)]) hit.push(idx(nr, nc));
        }
      } else {
        for (let j = 0; j < COLS * ROWS; j++) if (b.grid[j] === b.grid[i]) hit.push(j);
      }
      for (const j of hit) {
        if (keep.has(j)) continue;
        clear.add(j);
        if (b.spec[j] && !fired.has(j)) queue.push(j);
      }
    }
    // weeds next to a bloom wither too
    const weeds = new Set();
    for (const i of clear) {
      if (b.grid[i] === WEED) { weeds.add(i); continue; }
      const r = Math.floor(i / COLS), c = i % COLS;
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
        const n = idx(nr, nc);
        if (b.grid[n] === WEED) weeds.add(n);
      }
    }
    for (const i of weeds) clear.add(i);
    for (const i of keep) clear.delete(i);

    const cleared = [...clear].map((i) => ({ r: Math.floor(i / COLS), c: i % COLS, color: b.grid[i], spec: b.spec[i] }));
    for (const i of clear) { b.grid[i] = 0; b.spec[i] = 0; }
    for (const m of made) b.spec[m.i] = m.kind;
    const mid = cloneBoard(b); // after the bloom, before the fall (for the animation)
    const moves = settle(b);
    steps.push({
      chain,
      groups: gs.map((g) => ({ color: g.color, size: g.cells.length })),
      cleared, weeds: weeds.size, blasts,
      made: made.map((m) => ({ r: Math.floor(m.i / COLS), c: m.i % COLS, kind: m.kind, color: m.color })),
      moves, mid, after: cloneBoard(b),
    });
    prefer = [];
  }
  return steps;
}

// Weeds push up from the bottom of the given columns (columns that are full are skipped).
export function growWeeds(b, cols) {
  const moved = [];
  const h = heights(b);
  for (const c of cols) {
    if (h[c] >= ROWS) continue;
    for (let r = 0; r < ROWS - 1; r++) {
      b.grid[idx(r, c)] = b.grid[idx(r + 1, c)];
      b.spec[idx(r, c)] = b.spec[idx(r + 1, c)];
    }
    b.grid[idx(ROWS - 1, c)] = WEED;
    b.spec[idx(ROWS - 1, c)] = 0;
    moved.push(c);
  }
  return moved;
}

export function fillCount(b) {
  let n = 0;
  for (const v of b.grid) if (v) n++;
  return n;
}

// A fresh garden starts with a few planted rows, so there is something to build on from the
// first drop. No group is big enough to bloom; pairs and threes are left as set-ups.
export function seedGarden(b, K, rng = Math.random, rows = 3) {
  for (let r = ROWS - rows; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    for (let tries = 0; tries < 20; tries++) {
      b.grid[idx(r, c)] = 1 + Math.floor(rng() * K);
      if (!groups(b, 3).some((g) => g.cells.includes(idx(r, c)))) break;
    }
  }
  return b;
}
