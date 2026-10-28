// The 8x8 board as a flat Uint8Array: 0 is empty, 1..7 is the colour of the block there.
export const N = 8;

export const emptyGrid = () => new Uint8Array(N * N);

export function fits(grid, shape, r, c) {
  if (r < 0 || c < 0 || r + shape.h > N || c + shape.w > N) return false;
  for (const [dr, dc] of shape.cells) if (grid[(r + dr) * N + c + dc]) return false;
  return true;
}

export function placementsOf(grid, shape) {
  const out = [];
  for (let r = 0; r + shape.h <= N; r++) for (let c = 0; c + shape.w <= N; c++) if (fits(grid, shape, r, c)) out.push([r, c]);
  return out;
}

export function anyFit(grid, shape) {
  for (let r = 0; r + shape.h <= N; r++) for (let c = 0; c + shape.w <= N; c++) if (fits(grid, shape, r, c)) return true;
  return false;
}

// Rows and columns that would be full with the shape placed at (r, c), without clearing them.
export function linesWith(grid, shape, r, c) {
  const g = grid.slice();
  for (const [dr, dc] of shape.cells) g[(r + dr) * N + c + dc] = 1;
  return fullLines(g);
}

function fullLines(g) {
  const rows = [], cols = [];
  for (let i = 0; i < N; i++) {
    let row = true, col = true;
    for (let j = 0; j < N && (row || col); j++) {
      if (!g[i * N + j]) row = false;
      if (!g[j * N + i]) col = false;
    }
    if (row) rows.push(i);
    if (col) cols.push(i);
  }
  return { rows, cols };
}

// Places the shape and clears every full row and column. Returns the new grid, the cleared
// lines and the cleared cells with their colours (for the animation).
export function place(grid, shape, r, c, color = 1) {
  const g = grid.slice();
  for (const [dr, dc] of shape.cells) g[(r + dr) * N + c + dc] = color;
  const { rows, cols } = fullLines(g);
  const cleared = [];
  if (rows.length || cols.length) {
    const hit = new Set();
    for (const row of rows) for (let j = 0; j < N; j++) hit.add(row * N + j);
    for (const col of cols) for (let j = 0; j < N; j++) hit.add(j * N + col);
    for (const i of hit) { cleared.push({ r: Math.floor(i / N), c: i % N, color: g[i] }); g[i] = 0; }
  }
  return { grid: g, rows, cols, lines: rows.length + cols.length, cleared };
}

export function fillCount(grid) {
  let n = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i]) n++;
  return n;
}
