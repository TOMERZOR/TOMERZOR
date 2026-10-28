// Every fighter against every other, computer vs computer, to the end of the match.
//   node ortal/test/bots.mjs
import { createState, step, MOVES } from "../js/sim.js";
import { Bot } from "../js/ai.js";
let total = 0, finishes = 0, wins = new Array(8).fill(0), longest = 0;
const seen = { moves: new Set(), events: new Set(), phases: new Set() };
for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
  const s = createState(a, b);
  const bots = [new Bot(0, 2), new Bot(1, 1 + ((a + b) % 2))];
  let f = 0;
  while (s.phase !== "over" && f < 60 * 60 * 5) {
    step(s, bots[0].think(s), bots[1].think(s));
    for (const e of s.ev) { seen.events.add(e.k); if (e.k === "move") seen.moves.add(e.mv); }
    seen.phases.add(s.phase);
    for (const p of s.p) if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.hp < 0 || p.hp > 1000) throw new Error("bad state " + JSON.stringify(p));
    f++;
  }
  if (s.phase !== "over") throw new Error(`match ${a} v ${b} never ended`);
  total++; longest = Math.max(longest, f);
  if (s.winner >= 0) wins[s.p[s.winner].ch]++;
}
console.log("matches", total, "longest", (longest / 60).toFixed(0) + "s");
console.log("wins by fighter", wins.join(" "));
console.log("phases", [...seen.phases].join(","));
console.log("events", [...seen.events].join(","));
console.log("moves", [...seen.moves].sort().join(","));
const missing = Object.keys(MOVES).filter((m) => !seen.moves.has(m));
console.log("moves never used:", missing.join(",") || "none");
