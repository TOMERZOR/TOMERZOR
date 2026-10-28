// The piece families. `hard` is how awkward a piece is to fit (0 easy .. 1 hard); the engine
// leans on it to make a tray kinder or tougher. `w` is how often the family is drawn at neutral mood.
const FAMILIES = [
  { id: 'dot', art: ['#'], w: 0.35, hard: 0.0 },
  { id: 'i2', art: ['##'], w: 0.9, hard: 0.05 },
  { id: 'i3', art: ['###'], w: 1, hard: 0.15 },
  { id: 'v3', art: ['#.', '##'], w: 1, hard: 0.15 },
  { id: 'o2', art: ['##', '##'], w: 1, hard: 0.25 },
  { id: 'i4', art: ['####'], w: 0.9, hard: 0.4 },
  { id: 't4', art: ['###', '.#.'], w: 0.8, hard: 0.45 },
  { id: 'l4', art: ['#.', '#.', '##'], w: 0.9, hard: 0.45, mirror: true },
  { id: 'r6', art: ['###', '###'], w: 0.6, hard: 0.55 },
  { id: 's4', art: ['##.', '.##'], w: 0.6, hard: 0.6, mirror: true },
  { id: 'i5', art: ['#####'], w: 0.6, hard: 0.7 },
  { id: 'v5', art: ['#..', '#..', '###'], w: 0.55, hard: 0.75 },
  { id: 'o3', art: ['###', '###', '###'], w: 0.45, hard: 0.9 },
];

function parse(art) {
  const cells = [];
  art.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
  return cells;
}

function normalize(cells) {
  const r0 = Math.min(...cells.map((p) => p[0]));
  const c0 = Math.min(...cells.map((p) => p[1]));
  return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const rotate = (cells) => normalize(cells.map(([r, c]) => [c, -r]));
const flip = (cells) => normalize(cells.map(([r, c]) => [r, -c]));
const key = (cells) => cells.map((p) => p.join(',')).join(';');

export const SHAPES = [];

for (const fam of FAMILIES) {
  const seen = new Map();
  const starts = [normalize(parse(fam.art))];
  if (fam.mirror) starts.push(flip(starts[0]));
  for (let cells of starts) {
    for (let i = 0; i < 4; i++) {
      seen.set(key(cells), cells);
      cells = rotate(cells);
    }
  }
  const orients = [...seen.values()];
  orients.forEach((cells, i) => {
    SHAPES.push({
      id: `${fam.id}.${i}`,
      family: fam.id,
      cells,
      n: cells.length,
      h: Math.max(...cells.map((p) => p[0])) + 1,
      w: Math.max(...cells.map((p) => p[1])) + 1,
      hard: fam.hard,
      weight: fam.w / orients.length,
    });
  });
}

export const SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.id, s]));
