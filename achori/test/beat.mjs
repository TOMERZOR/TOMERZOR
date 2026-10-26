// The timing ring's rules, checked one by one.   node achori/test/beat.mjs
import { Game, BEAT } from '../js/game.js';
import { LEVELS } from '../js/levels.js';

let bad = 0;
const ok = (cond, msg) => { if (!cond) { bad++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

function caughtLior() {
  const g = new Game({ ...LEVELS[0], waves: [{ t: 0, type: 'lior', hole: 0 }] });
  g.start();
  g.update(0.01);
  const m = g.mice[0];
  m.state = 'run';
  g.hold(m, 'caught', 3.0, null);
  return { g, m };
}
const toBeat = (g, m, off) => { g.update(Math.max(0, m.beatP + off - m.beatT)); };

{
  const { g, m } = caughtLior();
  const hp = m.hp, t = m.t;
  g.update(0.1);
  ok(g.whack(m, 1) === 'off', 'a tap long before the beat is off the beat');
  ok(m.hp === hp, '...does no damage');
  ok(Math.abs(m.t - (t - 0.1 - BEAT.offPenalty)) < 1e-6, '...and lets her loose sooner');
  ok(g.combo === 0, '...and breaks the combo');
}
{
  const { g, m } = caughtLior();
  const hp = m.hp;
  toBeat(g, m, 0.02);
  ok(g.whack(m, 1) === 'perfect', 'a tap 20 ms after the beat is perfect');
  ok(hp - m.hp === BEAT.perfectDmg, `...and does ${BEAT.perfectDmg} damage`);
  ok(m.beatT === 0, '...and starts the next beat');
}
{
  const { g, m } = caughtLior();
  const hp = m.hp;
  toBeat(g, m, -0.12);
  ok(g.whack(m, 1) === 'good', 'a tap 120 ms early is good');
  ok(hp - m.hp === BEAT.goodDmg, `...and does ${BEAT.goodDmg} damage`);
}
{
  const { g, m } = caughtLior();
  g.update(m.beatP - 0.02);
  ok(g.whack(m, 1, 0.04) === 'perfect', 'the touch moment counts, not the last frame (20 ms early frame + 40 ms later touch)');
}
{
  const { g, m } = caughtLior();
  g.update(m.beatP + BEAT.good + 0.05);
  ok(m.beatT < 0.06, 'a beat nobody tapped starts over');
}
{
  const { g, m } = caughtLior();
  m.hp = m.hpMax = 999;
  m.t = m.heldMax = 99;
  const dmgs = [];
  for (let i = 0; i < 6; i++) { toBeat(g, m, 0); const before = m.hp; g.whack(m, 1); dmgs.push(before - m.hp); }
  ok(dmgs[BEAT.streakAt - 1] === Math.round(BEAT.perfectDmg * BEAT.streakMul), `from the ${BEAT.streakAt}th perfect hit in a row it hits ${BEAT.streakMul}× harder: ${dmgs.join(',')}`);
}
{
  const { g, m } = caughtLior();
  m.hp = m.hpMax = 999;
  const start = m.hp;
  let n = 0;
  while (g.mice[0].state === 'caught' && n < 200) { g.update(1 / 8); g.whack(m, 1); n++; } // 8 taps a second, no timing
  const mashed = start - m.hp, mashTime = n / 8;
  const r = caughtLior();
  r.m.hp = r.m.hpMax = 999;
  let k = 0;
  while (r.m.state === 'caught' && k < 50) { toBeat(r.g, r.m, 0.03 * Math.sin(k)); r.g.whack(r.m, 1); k++; }
  const rhythm = 999 - r.m.hp;
  ok(rhythm > mashed * 2, `tapping on the beat (${rhythm} dmg) beats mashing (${mashed} dmg)`);
  ok(mashTime < 3.0 * 0.6, `mashing lets her go much sooner (${mashTime.toFixed(2)} s of a 3 s trap)`);
}
{
  const { g, m } = caughtLior();
  m.state = 'run'; m.t = 0;
  g.hold(m, 'stunned', 1.5, null);
  ok(m.beatT === 0 && m.beatP > 0, "Ofek's stun gets a ring too");
}
console.log(bad ? `${bad} FAILED` : 'all beat rules hold');
process.exit(bad ? 1 : 0);
