import test from 'node:test';
import assert from 'node:assert/strict';
import { tradePlan, manage, PLAYBOOK } from '../plans.js';
import { analyze } from '../signals.js';
import { barsFor, tradingDates } from './fixtures.js';
import { nyTime, barDate } from '../clock.js';
import { atr } from '../indicators.js';

const spy = { ret63: 3, above200: true };

test('every setup has a plan: stop under the entry within 1 to 3 ATR, two targets in R', () => {
  const bars = barsFor('up', '2026-10-29', 2);
  const i = bars.length - 1;
  const A = atr(bars, 14)[i];
  const c = bars[i].c;
  for (const setup of Object.keys(PLAYBOOK)) {
    const p = tradePlan(setup, bars, { entry: c, atr: A, sma20: c * 0.98 });
    const R = p.entry - p.stop;
    assert.ok(R >= A * 0.99 && R <= Math.max(3 * A, 0) + 0.01, `${setup}: risk ${R} vs ATR ${A}`);
    assert.ok(R <= p.entry * 0.12 + 0.01, `${setup}: risk at most 12%`);
    assert.ok(Math.abs(p.t1 - (p.entry + PLAYBOOK[setup].t1R * R)) < 0.006, `${setup} t1`);
    assert.ok(Math.abs(p.t2 - (p.entry + PLAYBOOK[setup].t2R * R)) < 0.006, `${setup} t2`);
    assert.ok(p.stopWhy && p.timeDays > 0);
  }
});

test('an entry signal carries its setup\'s plan; a near signal is a pending buy above the trigger', () => {
  const a = analyze(barsFor('pullback', '2026-10-29', 2), { spy });
  assert.equal(a.status, 'enter');
  assert.equal(a.levels.setup, 'pullback');
  assert.equal(a.levels.stopWhy, 'מתחת לשפל של התיקון');
  const nearSig = analyze(barsFor('near', '2026-10-29', 3), { spy });
  assert.equal(nearSig.status, 'near');
  assert.equal(nearSig.levels.pending, true);
  assert.equal(nearSig.levels.entry, nearSig.levels.trigger);
  assert.ok(nearSig.levels.stop < nearSig.levels.trigger && nearSig.levels.t1 > nearSig.levels.trigger);
  assert.ok(nearSig.levels.level < nearSig.levels.trigger, 'the breakout level is under the trigger');
});

// A position entered on a given bar, then the price path after it.
function trade(path, { setup = 'breakout', from = 'breakout' } = {}) {
  const base = barsFor(from, '2026-09-30', 1);
  const last = base[base.length - 1];
  const entry = last.c;
  const A = atr(base, 14)[base.length - 1];
  const plan = tradePlan(setup, base, { entry, atr: A, sma20: entry * 0.97 });
  const dates = tradingDates('2026-12-31', 80).filter(d => d > '2026-09-30').slice(0, path.length);
  let p = entry;
  const bars = [...base];
  path.forEach((move, k) => {
    const o = p;
    p = typeof move === 'function' ? move(plan, A) : p * (1 + move);
    bars.push({ t: Math.floor(nyTime(dates[k], 960) / 1000), o, h: Math.max(o, p) * 1.002, l: Math.min(o, p) * 0.998, c: p, v: 1e6 });
  });
  return { bars, pos: { entry, stop: plan.stop, t1: plan.t1, t2: plan.t2, setup, level: plan.level, date: barDate(last.t) }, plan, A };
}

test('holding: the stop stays put until the trade works', () => {
  const { bars, pos } = trade([0.002, -0.001, 0.003], { setup: 'pullback', from: 'up' });
  const m = manage(pos, bars);
  assert.equal(m.state, 'hold');
  assert.equal(m.stopNow, pos.stop);
  assert.equal(m.days, 3);
});

test('target 1 moves the stop to the entry, a new high trails it, target 2 is reported', () => {
  const up = trade([pl => pl.t1 * 1.001]);
  const m1 = manage(up.pos, up.bars);
  assert.equal(m1.state, 't1');
  assert.ok(m1.stopNow >= up.pos.entry);
  assert.match(m1.next, /מוכרים חצי/);
  const more = trade([pl => pl.t1 * 1.001, pl => pl.t2 * 1.01]);
  const m2 = manage(more.pos, more.bars);
  assert.equal(m2.state, 't2');
  assert.equal(m2.stopKind, 'trail');
  assert.ok(m2.stopNow > more.pos.entry);
});

test('exits: the stop, back to the entry after target 1, a failed breakout, the time stop', () => {
  const stopped = trade([pl => pl.stop * 0.99]);
  assert.equal(manage(stopped.pos, stopped.bars).exit, 'stop');
  const back = trade([pl => pl.t1 * 1.001, pl => pl.entry * 0.999]);
  const mb = manage(back.pos, back.bars);
  assert.equal(mb.exit, 'breakeven');
  const failed = trade([0.001, pl => (pl.level + pl.stop) / 2]);
  assert.ok(failed.pos.level > failed.pos.stop && failed.pos.level < failed.pos.entry);
  assert.equal(manage(failed.pos, failed.bars).exit, 'failed');
  const slow = trade(Array(15).fill(0.0004), { setup: 'pullback', from: 'up' });
  const ms = manage(slow.pos, slow.bars);
  assert.equal(ms.exit, 'time');
  assert.match(ms.next, /יוצאים/);
});

test('a hand-entered position without a setup or targets still gets a plan', () => {
  const { bars } = trade([0.01]);
  const entry = bars.at(-2).c;
  const m = manage({ entry, date: barDate(bars.at(-2).t) }, bars);
  assert.ok(m.initialStop < entry && m.t1 > entry && m.t2 > m.t1);
  assert.equal(m.timeDays, null);
});
