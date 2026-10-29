// Seed bundles. Each cell of a piece carries its own colour; the engine picks the colours.
// `hard`: how awkward the shape is (wide shapes need several columns with room).
export const SHAPES = [
  { id: 'pair', cells: [[0, 0], [1, 0]], w: 1.2, hard: 0 },
  { id: 'line3', cells: [[0, 0], [1, 0], [2, 0]], w: 0.8, hard: 0.35 },
  { id: 'bend', cells: [[0, 0], [1, 0], [1, 1]], w: 1, hard: 0.3 },
  { id: 'square', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], w: 0.6, hard: 0.6 },
  { id: 'tee', cells: [[0, 1], [1, 0], [1, 1], [1, 2]], w: 0.35, hard: 0.8 },
];

export const SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.id, s]));

export const makePiece = (shape, colors) => ({ shape: shape.id, cells: shape.cells.map((p) => [...p]), colors });
