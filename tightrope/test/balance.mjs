// Plays every level with simulated players and checks the difficulty curve:
// a steady player should clear every level, a jerky one should fail the late ones,
// and nobody survives without touching the phone.
// Run: node tightrope/test/balance.mjs
import { LEVELS } from '../js/levels.js';
import { createSim, stepSim, MAX_TILT } from '../js/sim.js';

const DT = 1 / 240;

function play(level, seed, player) {
  const s = createSim(level, seed);
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
    let target = -(player.kp * th + player.kd * om + player.ki * integral) + noise;
    target = Math.max(-MAX_TILT, Math.min(MAX_TILT, target));
    // Hands move with a finite speed, which is what keeps uRate realistic.
    const k = 1 - Math.exp(-DT / player.hand);
    u += (target - u) * k;
    const uRate = (u - prevU) / DT;
    prevU = u;
    stepSim(s, DT, player.off ? 0 : u, player.off ? 0 : uRate);
  }
  return s;
}

const players = {
  steady: { delay: 0.2, kp: 1.2, kd: 0.8, ki: 1.5, noise: 0.15, hand: 0.12 },
  jerky: { delay: 0.25, kp: 1.8, kd: 0.3, ki: 0, noise: 0.6, hand: 0.04 },
  off: { off: true, delay: 0, kp: 0, kd: 0, ki: 0, noise: 0, hand: 1 },
};

let ok = true;
console.log('level  player   won/20  avg spilled  limit  falls  avg time');
for (const L of LEVELS) {
  for (const [name, p] of Object.entries(players)) {
    let won = 0, spilled = 0, falls = 0, time = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = play(L, seed * 7919 + L.id, p);
      if (s.state === 'won') won++;
      if (s.fail === 'fall') falls++;
      spilled += s.spilled;
      time += s.t;
    }
    console.log(`${String(L.id).padEnd(6)} ${name.padEnd(8)} ${String(won).padStart(6)}  ${(spilled / 20 * 100).toFixed(1).padStart(10)}%  ${(L.limit * 100).toFixed(0).padStart(4)}%  ${String(falls).padStart(5)}  ${(time / 20).toFixed(1).padStart(7)}s`);
    const need = L.id === 8 ? 10 : 18;  // the last level is meant to take a few tries
    if (name === 'steady' && won < need) { ok = false; console.log('  ^ a steady player should clear this level'); }
    if (name === 'off' && won > 0) { ok = false; console.log('  ^ the level is beatable without playing'); }
    if (name === 'jerky' && L.id >= 6 && won > 12) { ok = false; console.log('  ^ late levels should punish jerky play'); }
  }
}
console.log(ok ? 'balance OK' : 'balance FAILED');
process.exit(ok ? 0 : 1);
