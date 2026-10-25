// Plays every level with simulated players and checks the difficulty curve:
// a steady player should clear every level with every character, a jerky one
// should fail the late ones, and nobody survives without touching the phone.
// Also checks how far a steady player gets in endless mode.
// Run: node tightrope/test/balance.mjs
import { LEVELS, endlessRope } from '../js/levels.js';
import { createSim, stepSim, MAX_TILT, LIQUIDS } from '../js/sim.js';

const DT = 1 / 240;

function play(level, seed, player, liquid = LIQUIDS.water, carry) {
  const s = createSim(level, seed, { liquid, carry });
  const hist = [];
  let u = 0, prevU = 0, noise = 0, integral = 0;
  const r = s.r;
  while (s.state === 'walk' && s.t < 400) {
    hist.push([s.theta, s.omega]);
    const lag = Math.round(player.delay / DT);
    const [th, om] = hist[Math.max(0, hist.length - 1 - lag)];
    // A leaky integral: people keep pushing until he is upright again.
    integral = (integral + th * DT) * Math.exp(-DT / 3);
    noise += ((r() - 0.5) * player.noise - noise * 2) * DT * 10;
    // Make room for an ibex that is about to arrive.
    const ibex = s.ibexes.find((b) => b.state === 'come' && b.z - s.z < 2.2);
    const offset = ibex && player.smart ? 0.17 : 0;
    let target = -(player.kp * (th - offset) + player.kd * om + player.ki * integral) + noise;
    target = Math.max(-MAX_TILT, Math.min(MAX_TILT, target));
    // Hands move with a finite speed, which is what keeps uRate realistic.
    const k = 1 - Math.exp(-DT / player.hand);
    u += (target - u) * k;
    const uRate = (u - prevU) / DT;
    prevU = u;
    const hurdle = s.hurdles.find((h) => !h.done && h.z - s.z < s.speed * 0.3 && h.z > s.z);
    const input = { jump: player.smart && !!hurdle, run: false };
    stepSim(s, DT, player.off ? 0 : u, player.off ? 0 : uRate, input);
  }
  return s;
}

const players = {
  steady: { delay: 0.2, kp: 1.2, kd: 0.8, ki: 1.5, noise: 0.15, hand: 0.12, smart: true },
  jerky: { delay: 0.25, kp: 1.8, kd: 0.3, ki: 0, noise: 0.6, hand: 0.04, smart: true },
  off: { off: true, delay: 0, kp: 0, kd: 0, ki: 0, noise: 0, hand: 1 },
};

let ok = true;
console.log('level  player   won/20  avg spilled  limit  falls  avg time  coins');
for (const L of LEVELS) {
  for (const [name, p] of Object.entries(players)) {
    let won = 0, spilled = 0, falls = 0, time = 0, coins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = play(L, seed * 7919 + L.id, p);
      if (s.state === 'won') won++;
      if (s.fail === 'fall') falls++;
      spilled += s.spilled;
      time += s.t;
      coins += s.coins;
    }
    console.log(`${String(L.id).padEnd(6)} ${name.padEnd(8)} ${String(won).padStart(6)}  ${(spilled / 20 * 100).toFixed(1).padStart(10)}%  ${(L.limit * 100).toFixed(0).padStart(4)}%  ${String(falls).padStart(5)}  ${(time / 20).toFixed(1).padStart(7)}s  ${(coins / 20).toFixed(1).padStart(5)}`);
    const need = L.id === 8 ? 10 : L.id >= 5 ? 15 : 18;  // later levels are meant to take a few tries
    if (name === 'steady' && won < need) { ok = false; console.log('  ^ a steady player should clear this level'); }
    if (name === 'off' && won > 0) { ok = false; console.log('  ^ the level is beatable without playing'); }
    if (name === 'jerky' && L.id >= 6 && won > 12) { ok = false; console.log('  ^ late levels should punish jerky play'); }
  }
}

console.log('\ncharacter   steady wins per level (of 10)');
for (const [name, liq] of Object.entries(LIQUIDS)) {
  const wins = LEVELS.map((L) => {
    let w = 0;
    for (let seed = 1; seed <= 10; seed++) if (play(L, seed * 31 + L.id, players.steady, liq).state === 'won') w++;
    return w;
  });
  console.log(`${name.padEnd(11)} ${wins.join(' ')}`);
  if (wins.slice(0, 7).some((w) => w < 6)) { ok = false; console.log('  ^ this character is too hard for a steady player'); }
}

console.log('\nendless: ropes cleared by a steady player');
const runs = [];
for (let seed = 1; seed <= 10; seed++) {
  let carry = { fill: 1, score: 0 };
  let n = 0;
  for (; n < 30; n++) {
    const s = play(endlessRope(n), seed * 101 + n, players.steady, LIQUIDS.water, carry);
    if (s.state !== 'won') break;
    carry = { fill: s.fill, score: s.score };
  }
  runs.push(n);
}
console.log(runs.join(' '));
if (Math.max(...runs) < 4) { ok = false; console.log('  ^ endless mode ends too soon'); }
if (Math.min(...runs) >= 30) { ok = false; console.log('  ^ endless mode never ends'); }

console.log(ok ? '\nbalance OK' : '\nbalance FAILED');
process.exit(ok ? 0 : 1);
