// Dumps every artwork as JSON for the contact-sheet renderer and checks row widths.
import { ART, artToGrid } from '../js/art.js';
const out = [];
for (const a of ART) {
  const widths = new Set(a.rows.map((r) => r.length));
  if (widths.size > 1) console.error('ragged rows:', a.id, [...a.rows.map((r) => r.length)].join(','));
  const g = artToGrid(a);
  out.push({ id: a.id, name: a.name, ...g, ncol: g.keys.length, npx: g.cells.filter((c) => c >= 0).length });
}
process.stdout.write(JSON.stringify(out));
