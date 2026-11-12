// Does a fundamentals filter, or the earnings calendar, change how the backtest's trades turned out?
//
//   node mabat/backtest/fundamentals-effect.mjs [results files, default the 2025-04-10 and 2025-11-05 runs]
//
// For every traded entry (Part B, `skipped` left out) the trader-screener rules are taken as of the
// signal date, from SEC facts filed by then, at the entry price (pit.mjs). The trades are grouped:
//   pass     all three rules pass (revenue growth >= 5% YoY, net margin > 0, P/E <= 45)
//   fail     any rule fails
//   missing  no rule fails but at least one has no number (or the stock has no SEC data)
// and, separately, by the earnings calendar (8-Ks with item 2.02):
//   beforeEarnings  the next earnings date is 1-5 trading days after the entry day
//   heldThrough     an earnings date fell on a day from the entry day to the exit day
// Stocks without a filing list are left out of the earnings comparisons (counted as `unknown`).
// The two results files overlap in time, so `combined` counts each trade once
// (same stock, signal date, setup and entry date).
//
// Output: mabat/backtest/fundamentals-effect.json, and a short table.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { barDate } from '../server/clock.js';
import { fundamentalsAsOf, earningsDates, verdict, hasData, secDir } from './pit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.MABAT_DATA || path.join(here, 'data');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['results-2025-04-10.json', 'results-2025-11-05.json'].map(f => path.join(here, f));
const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

// Trading days of a stock, from its bars.
const dayCache = new Map();
function tradingDays(t) {
  if (!dayCache.has(t)) {
    const f = path.join(dataDir, `${t}.mabat.json`);
    dayCache.set(t, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).bars.map(b => barDate(b[0])) : []);
  }
  return dayCache.get(t);
}
// Index of the first trading day on or after `date`.
function dayIndex(days, date) {
  let lo = 0, hi = days.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (days[m] < date) lo = m + 1; else hi = m; }
  return lo;
}

function annotate(x) {
  const screen = fundamentalsAsOf(x.t, x.signalDate, x.entry);
  const rules = Object.fromEntries((screen?.rules || []).map(r => [r.id, r.pass]));
  const out = {
    t: x.t, signalDate: x.signalDate, setup: x.setup, entryDate: x.entryDate, exitDate: x.exitDate, entry: x.entry,
    t1Hit: x.t1Hit, t2Hit: x.t2Hit, stoppedBeforeT1: x.stoppedBeforeT1, r: x.r, pct: x.pct,
    screen: verdict(screen), growth: rules.growth ?? null, profit: rules.profit ?? null, pe: rules.pe ?? null,
    revenueGrowth: screen?.metrics.revenueGrowth ?? null, netMargin: screen?.metrics.netMargin ?? null,
    epsTTM: screen?.metrics.epsTTM ?? null, quarterEnd: screen?.metrics.quarterEnd ?? null,
  };
  const known = hasData(x.t) && fs.existsSync(path.join(secDir(), x.t, 'submissions.json'));
  if (!known) return { ...out, earnings: 'unknown' };
  const dates = earningsDates(x.t);
  const days = tradingDays(x.t);
  const next = dates.find(d => d > x.entryDate) || null;
  const daysToNext = next ? dayIndex(days, next) - dayIndex(days, x.entryDate) : null;
  return {
    ...out,
    earnings: 'known',
    nextEarnings: next,
    tradingDaysToEarnings: daysToNext,
    beforeEarnings: daysToNext != null && daysToNext >= 1 && daysToNext <= 5,
    heldThrough: dates.some(d => d >= x.entryDate && d <= x.exitDate),
  };
}

function stats(trades) {
  const n = trades.length;
  const pct = k => (n ? round((trades.filter(k).length / n) * 100, 1) : null);
  const avg = f => (n ? round(trades.reduce((s, x) => s + f(x), 0) / n, 2) : null);
  return {
    n, reachedT1: pct(x => x.t1Hit), reachedT2: pct(x => x.t2Hit), stoppedBeforeT1: pct(x => x.stoppedBeforeT1),
    winRate: pct(x => x.r > 0), avgR: avg(x => x.r), avgPct: avg(x => x.pct),
  };
}

function analyze(trades) {
  const by = (k, v) => stats(trades.filter(x => x[k] === v));
  const known = trades.filter(x => x.earnings === 'known');
  return {
    all: stats(trades),
    screen: { pass: by('screen', 'pass'), fail: by('screen', 'fail'), missing: by('screen', 'missing') },
    rules: Object.fromEntries(['growth', 'profit', 'pe'].map(id => [id, { pass: by(id, true), fail: by(id, false), missing: by(id, null) }])),
    beforeEarnings: { yes: stats(known.filter(x => x.beforeEarnings)), no: stats(known.filter(x => !x.beforeEarnings)), unknown: trades.length - known.length },
    heldThrough: { yes: stats(known.filter(x => x.heldThrough)), no: stats(known.filter(x => !x.heldThrough)), unknown: trades.length - known.length },
  };
}

const result = { secDir: path.relative(here, secDir()) || '.', files: {}, combined: null };
const seen = new Map();
for (const f of files) {
  const trades = JSON.parse(fs.readFileSync(f, 'utf8')).partB.trades.filter(x => !x.skipped).map(annotate);
  result.files[path.basename(f)] = analyze(trades);
  for (const x of trades) { const key = `${x.t}|${x.signalDate}|${x.setup}|${x.entryDate}`; if (!seen.has(key)) seen.set(key, x); }
}
const unique = [...seen.values()];
result.combined = analyze(unique);
const tickers = [...new Set(unique.map(x => x.t))].sort();
result.tickers = {
  traded: tickers.length,
  withSecData: tickers.filter(hasData).length,
  withoutSecData: tickers.filter(t => !hasData(t)),
  withoutEarningsDates: tickers.filter(t => hasData(t) && !earningsDates(t).length),
};
result.trades = unique;
fs.writeFileSync(path.join(here, 'fundamentals-effect.json'), JSON.stringify(result, null, 1));

// ---------- Table ----------
const cols = ['n', 'reachedT1', 'reachedT2', 'stoppedBeforeT1', 'winRate', 'avgR', 'avgPct'];
const head = ['group', 'n', 'T1 %', 'T2 %', 'stop<T1 %', 'win %', 'avg R', 'avg %'];
const fmt = v => (v == null ? '-' : String(v));
function table(title, rows) {
  console.log(`\n${title}`);
  const lines = [head, ...rows.map(([name, s]) => [name, ...cols.map(c => fmt(s[c]))])];
  const w = head.map((_, i) => Math.max(...lines.map(l => l[i].length)));
  for (const l of lines) console.log(l.map((c, i) => (i ? c.padStart(w[i]) : c.padEnd(w[i]))).join('  '));
}
for (const [name, a] of [...Object.entries(result.files), ['combined (each trade once)', result.combined]]) {
  console.log(`\n=== ${name}`);
  table('Fundamentals screen at the signal date, entry price', [['all', a.all], ['all rules pass', a.screen.pass], ['any rule fails', a.screen.fail], ['data missing', a.screen.missing]]);
  table('Rule by rule (pass / fail / missing)', ['growth', 'profit', 'pe'].flatMap(id => ['pass', 'fail', 'missing'].map(k => [`${id} ${k}`, a.rules[id][k]])));
  table(`Earnings (stocks without a filing list left out: ${a.beforeEarnings.unknown} trades)`, [
    ['entered 1-5 days before', a.beforeEarnings.yes], ['not before earnings', a.beforeEarnings.no],
    ['held through earnings', a.heldThrough.yes], ['not held through', a.heldThrough.no],
  ]);
}
console.log(`\ntraded stocks ${result.tickers.traded}, with SEC data ${result.tickers.withSecData}` +
  (result.tickers.withoutSecData.length ? `, without: ${result.tickers.withoutSecData.join(' ')}` : '') +
  (result.tickers.withoutEarningsDates.length ? `; no 8-K 2.02 dates: ${result.tickers.withoutEarningsDates.join(' ')}` : ''));
