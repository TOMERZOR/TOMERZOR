import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, sizePosition, ENTER_SCORE } from '../signals.js';
import { sma, ema, rsi, atr } from '../indicators.js';
import { barsFor } from './fixtures.js';

const spy = { ret63: 3, above200: true };

test('indicators match hand-worked values', () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.equal(e[2], 2);
  assert.equal(e[3], 3);
  const up = rsi(Array.from({ length: 30 }, (_, i) => i + 1));
  assert.equal(up[29], 100);
  const flat = atr(Array.from({ length: 20 }, () => ({ h: 11, l: 9, c: 10 })), 14);
  assert.equal(flat[19], 2);
});

test('a breakout on volume is an entry with a stop under the price and a 2:1 target', () => {
  for (const seed of [1, 2, 3]) {
    const a = analyze(barsFor('breakout', '2026-10-29', seed), { spy });
    assert.equal(a.status, 'enter', `seed ${seed}`);
    assert.ok(a.setups.some(s => s.id === 'breakout' && s.age === 0));
    assert.ok(a.score >= ENTER_SCORE);
    const { entry, stop, t1, t2, level } = a.levels;
    assert.ok(stop < level && level < entry, 'the stop sits under the breakout level');
    assert.ok(Math.abs((t1 - entry) - 1.5 * (entry - stop)) < 0.006);
    assert.ok(Math.abs((t2 - entry) - 3 * (entry - stop)) < 0.006);
    assert.ok(a.checks.some(c => c.label.includes('נפח מסחר')));
  }
});

test('a pullback that turns up in an uptrend is an entry', () => {
  const a = analyze(barsFor('pullback', '2026-10-29', 3), { spy });
  assert.equal(a.status, 'enter');
  assert.equal(a.setup, 'pullback');
});

test('downtrends are avoided and parabolic runs are not chased', () => {
  assert.equal(analyze(barsFor('downtrend', '2026-10-29', 2), { spy }).status, 'avoid');
  for (const seed of [1, 2, 3]) {
    const a = analyze(barsFor('extended', '2026-10-29', seed), { spy });
    assert.notEqual(a.status, 'enter');
    assert.ok(a.warnings.some(w => w.includes('מתוח')));
  }
});

test('close under the 20-day high is "near" with the trigger price', () => {
  const a = analyze(barsFor('near', '2026-10-29', 3), { spy });
  assert.equal(a.status, 'near');
  assert.ok(a.levels.trigger > a.price);
  assert.ok(a.levels.distPct > 0 && a.levels.distPct <= 3);
});

test('a serious 8-K blocks an entry, a weak market lowers the score', () => {
  const bars = barsFor('breakout', '2026-10-29', 1);
  const base = analyze(bars, { spy });
  const filed = analyze(bars, { spy, filings: [{ date: '2026-10-27', items: ['4.02'], ageDays: 2 }] });
  assert.equal(filed.status, 'avoid');
  assert.ok(filed.warnings.some(w => w.includes('לא אמינים')));
  const weak = analyze(bars, { spy: { ret63: -8, above200: false } });
  assert.ok(weak.score < base.score);
});

test('fundamentals and fund holdings move the score and show up as checks', () => {
  const bars = barsFor('up', '2026-10-29', 2);
  const plain = analyze(bars, { spy });
  const good = analyze(bars, { spy, fundamentals: { rules: [{ label: 'a', pass: true }, { label: 'b', pass: true }] }, holders: [{ fund: 'ברקשייר', change: 'added' }] });
  const bad = analyze(bars, { spy, fundamentals: { rules: [{ label: 'a', pass: false }, { label: 'b', pass: false }] } });
  assert.ok(good.score > plain.score && bad.score < plain.score);
  assert.ok(good.checks.some(c => c.group === 'smart'));
  assert.equal(good.checks.filter(c => c.group === 'fundamental').length, 2);
});

test('the partial-day volume adjustment', () => {
  const bars = barsFor('up', '2026-10-29', 1);
  bars[bars.length - 1].v = 500000;
  const early = analyze(bars, { spy, partial: 0.25 });
  const full = analyze(bars, { spy, partial: 1 });
  assert.ok(early.ind.relVol > full.ind.relVol * 3.9);
});

test('too little history is not analysed', () => {
  const a = analyze(barsFor('up').slice(-30));
  assert.equal(a.insufficient, true);
  assert.equal(a.status, 'hold');
});

test('position sizing keeps to the risk, the cap and the cash buffer (trader-budget, trader-risk)', () => {
  const levels = { entry: 100, stop: 95 };
  const s = sizePosition(levels, { budget: 10000, riskPct: 1, maxPositionPct: 25, cashBufferPct: 10, fractional: false });
  assert.equal(s.shares, 20); // $100 risk / $5 = 20 shares, $2,000 is under the $2,500 cap
  assert.equal(s.risk, 100);
  const capped = sizePosition({ entry: 100, stop: 99.5 }, { budget: 10000, riskPct: 1, maxPositionPct: 25 });
  assert.equal(capped.shares, 25);
  assert.equal(capped.cappedBy, 'position');
  assert.equal(sizePosition({ entry: 100, stop: 101 }, { budget: 1000 }), null);
  assert.equal(sizePosition(levels, { budget: 300, riskPct: 1, maxPositionPct: 25 }).shares, 0);
});
