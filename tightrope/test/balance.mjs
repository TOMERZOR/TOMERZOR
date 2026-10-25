// Difficulty checks, judged by simulated ordinary players (see human.mjs):
// - typical people clear the early levels nearly every time and the last one
//   about half the time, and almost never fall off
// - every character is playable on the first levels
// - endless mode lasts a handful of ropes for a typical person
// - doing nothing never wins, and a perfect player can always win
// Run: node tightrope/test/balance.mjs
import { LEVELS, endlessRope } from '../js/levels.js';
import { createSim, stepSim, MAX_TILT, LIQUIDS, TUNE } from '../js/sim.js';
import { survey, makePerson, playHuman } from './human.mjs';

const DT = 1 / 240;
let ok = true;
const fail = (msg) => { ok = false; console.log('  ^ ' + msg); };

// Share of attempts a typical person should win, per level.
const TARGET = { 1: [0.95, 1], 2: [0.93, 1], 3: [0.85, 1], 4: [0.7, 0.95], 5: [0.6, 0.92], 6: [0.6, 0.92], 7: [0.5, 0.85], 8: [0.3, 0.65] };

console.log('ordinary players (40 people, 2 tries each)');
console.log('level   pass   target      falls   avg spilled');
for (const r of survey(LEVELS)) {
  const [lo, hi] = TARGET[r.id];
  console.log(`${String(r.id).padEnd(6)} ${(r.win * 100).toFixed(0).padStart(4)}%   ${Math.round(lo * 100)}-${Math.round(hi * 100)}%   ${(r.fall * 100).toFixed(0).padStart(6)}%  ${(r.spilled * 100).toFixed(1).padStart(10)}%`);
  if (r.win < lo) fail('too hard for ordinary players');
  if (r.win > hi) fail('too easy');
  if (r.fall > 0.05) fail('people fall off too often');
}

console.log('\ncharacters: pass on levels 1-3 (20 people)');
for (const [name, liq] of Object.entries(LIQUIDS)) {
  const rs = survey(LEVELS.slice(0, 3), liq, 20, 1);
  console.log(`${name.padEnd(11)} ${rs.map((x) => String(Math.round(x.win * 100)).padStart(4) + '%').join(' ')}`);
  if (rs.some((x) => x.win < 0.85)) fail('this character is too hard to start with');
}

console.log('\nendless: ropes crossed by 20 people');
const ropes = [];
for (let i = 0; i < 20; i++) {
  const person = makePerson(i + 101);
  let carry = { fill: 1, score: 0 }, n = 0;
  for (; n < 30; n++) {
    const s = playHuman(endlessRope(n), person, 50 * i + n, LIQUIDS.water, carry);
    if (s.state !== 'won') break;
    carry = { fill: s.fill, score: s.score };
  }
  ropes.push(n);
}
ropes.sort((a, b) => a - b);
const median = ropes[ropes.length >> 1];
console.log(`${ropes.join(' ')}   median ${median}`);
if (median < 4 || median > 14) fail('a typical endless run should last about 4-14 ropes');

// Hands off: never wins. A perfect, instant controller: always can.
function machine(L, seed, perfect) {
  const s = createSim(L, seed);
  while (s.state === 'walk' && s.t < 400) {
    let u = 0, jump = false;
    if (perfect) {
      const ibex = s.ibexes.find((b) => b.state === 'come' && b.z - s.z < 2.2);
      const g = TUNE.damp / TUNE.control;
      u = Math.max(-MAX_TILT, Math.min(MAX_TILT, -(1.5 * g * (s.theta - (ibex ? 0.17 : 0)) + 0.3 * g * s.omega)));
      jump = s.hurdles.some((h) => !h.done && h.z - s.z < s.speed * 0.3 && h.z > s.z);
    }
    stepSim(s, DT, u, 0, { jump });
  }
  return s.state === 'won';
}
console.log('\nhands off / perfect player, wins of 10 per level');
const offW = LEVELS.map((L) => [...Array(10)].filter((_, i) => machine(L, i + 1, false)).length);
const perW = LEVELS.map((L) => [...Array(10)].filter((_, i) => machine(L, i + 1, true)).length);
console.log(`hands off  ${offW.join(' ')}`);
console.log(`perfect    ${perW.join(' ')}`);
if (offW.some((w) => w > 0)) fail('a level can be won without playing');
if (perW.some((w) => w < 10)) fail('a level cannot always be won even with perfect play');

console.log(ok ? '\nbalance OK' : '\nbalance FAILED');
process.exit(ok ? 0 : 1);
