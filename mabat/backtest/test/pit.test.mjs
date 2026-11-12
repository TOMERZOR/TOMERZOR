// node --test mabat/backtest/test/pit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.MABAT_SEC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sec');
const { fundamentalsAsOf, earningsDates, verdict, hasData } = await import('../pit.mjs');

const rule = (s, id) => s.rules.find(r => r.id === id).pass;

test('uses only facts filed by the date, restatements included', () => {
  const s = fundamentalsAsOf('XYZ', '2025-05-01', 90);
  assert.equal(s.metrics.quarterEnd, '2025-03-31');
  assert.equal(s.metrics.revenue, 120);
  assert.equal(s.metrics.revenueGrowth, 14.29); // against the restated 105, filed the same day
  assert.equal(s.metrics.netMargin, -5);
  assert.equal(s.metrics.epsTTM, 4.5); // Q2 + Q3 + derived Q4 (4 - 3) + Q1
  assert.equal(rule(s, 'growth'), true);
  assert.equal(rule(s, 'profit'), false);
  assert.equal(rule(s, 'pe'), true); // 90 / 4.5 = 20
  assert.equal(verdict(s), 'fail');
  assert.equal(rule(fundamentalsAsOf('XYZ', '2025-05-01', 300), 'pe'), false); // P/E 66.7
});

test('a day earlier, the quarter filed that day is not known yet', () => {
  const s = fundamentalsAsOf('XYZ', '2025-04-30', 90);
  assert.equal(s.metrics.quarterEnd, '2024-12-31');
  assert.equal(s.metrics.derived, true);
  assert.equal(s.metrics.revenue, 130); // 460 - (100 + 110 + 120), before the restatement
  assert.equal(s.metrics.revenueGrowth, null); // no year-ago quarter
  assert.equal(s.metrics.netMargin, 7.69); // (43 - 33) / 130
  assert.equal(s.metrics.epsTTM, 4);
  assert.equal(verdict(s), 'missing');
});

test('picks the revenue tag as the server does, with the date as today', () => {
  // In 2024-04 the old tag's 2023-09 quarter is under 200 days old, so it is used.
  assert.equal(fundamentalsAsOf('XYZ', '2024-04-01', 90).metrics.revenue, 999);
  // Later it is stale and the next tag with a newer quarter wins.
  assert.equal(fundamentalsAsOf('XYZ', '2024-08-15', 90).metrics.quarterEnd, '2024-06-30');
});

test('before any filing, everything is missing', () => {
  const s = fundamentalsAsOf('XYZ', '2023-01-01', 90);
  assert.equal(s.metrics.quarterEnd, null);
  assert.ok(s.rules.every(r => r.pass === null));
  assert.equal(verdict(s), 'missing');
});

test('a ticker without SEC data', () => {
  assert.equal(hasData('NOPE'), false);
  assert.equal(fundamentalsAsOf('NOPE', '2025-05-01', 90), null);
  assert.equal(verdict(null), 'missing');
  assert.deepEqual(earningsDates('NOPE'), []);
});

test('earnings dates: 8-Ks with item 2.02, oldest first', () => {
  assert.deepEqual(earningsDates('XYZ'), ['2024-11-01', '2025-02-14', '2025-05-01']);
});
