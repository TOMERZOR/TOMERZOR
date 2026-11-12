// Mabat backtest: how the signals and trade plans would have done on real prices.
//
//   node mabat/backtest/run.mjs [start date, default 2026-08-12]
//
// No look-ahead: on each day the signal engine sees only the bars up to that day (bars.slice(0, i + 1)).
// The bars after it are used only to play the trade out.
//
// Part A: what Mabat said about each stock on the start date, and what happened next.
// Part B: every new entry signal from the start date on, traded by its plan:
//   - bought at the next day's open; skipped if the open is above the plan's most-to-pay or under the stop
//   - the stop counts on an intraday touch (filled at the stop, or at the open after a gap down)
//   - if the stop and a target are touched on the same day, the stop is counted first (the worse case)
//   - target 1: half sold, the stop moves to the entry; target 2: the rest is sold
//   - past 1R the stop trails the highest close by the setup's ATR multiple; early exits and the time
//     stop are checked at the close, as in server/plans.js
//   - a trade still open at the end is valued at the last close
// Fundamentals, 13F holdings and filings are left out: their history isn't point-in-time here, so
// the scores are the chart's alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../server/signals.js';
import { PLAYBOOK } from '../server/plans.js';
import { barDate } from '../server/clock.js';
import { load, tickers, spyBars, regimeByDate, indexAtOrBefore, round, ctxFor, simulate, stats, account } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const START = process.argv[2] || '2026-08-12';

// ---------- Part A: the start date ----------
const partA = [];
for (const t of tickers) {
  const bars = load(t);
  if (!bars) continue;
  const i = indexAtOrBefore(bars, START);
  if (i < 210) { partA.push({ t, error: 'not enough history' }); continue; }
  const a = analyze(bars.slice(0, i + 1), ctxFor(bars.slice(0, i + 1)));
  const fwd = round((bars[bars.length - 1].c / bars[i].c - 1) * 100);
  const row = { t, date: barDate(bars[i].t), price: round(bars[i].c), status: a.status, score: a.score, setup: a.setup, fwdPct: fwd, plan: a.levels };
  if (a.status === 'enter' && i + 1 < bars.length) {
    const o = bars[i + 1].o;
    if (o > a.levels.maxEntry || o <= a.levels.stop) row.trade = { skipped: o > a.levels.maxEntry ? 'opened above the most-to-pay' : 'opened under the stop' };
    else row.trade = simulate(bars, i + 1, o, a.levels);
  } else if (a.status === 'near') {
    // A pending buy above the trigger, for up to 10 trading days.
    let k = i + 1;
    for (; k < bars.length && k <= i + 10; k++) if (bars[k].h >= a.levels.trigger) break;
    if (k < bars.length && k <= i + 10) row.trade = simulate(bars, k, Math.max(bars[k].o, a.levels.trigger), a.levels);
    else row.trade = { skipped: 'the trigger was not reached in 10 days' };
  }
  partA.push(row);
}

// ---------- Part B: every new entry signal since the start date ----------
const partB = [];
for (const t of tickers) {
  const bars = load(t);
  if (!bars) continue;
  const start = indexAtOrBefore(bars, START);
  let busyUntil = -1;
  let prevStatus = null;
  for (let i = start; i < bars.length - 1; i++) {
    const slice = bars.slice(0, i + 1);
    const a = analyze(slice, ctxFor(slice));
    const isNew = a.status === 'enter' && prevStatus !== 'enter';
    prevStatus = a.status;
    if (!isNew || i < busyUntil) continue;
    const o = bars[i + 1].o;
    if (o > a.levels.maxEntry || o <= a.levels.stop) { partB.push({ t, signalDate: barDate(bars[i].t), setup: a.setup, score: a.score, skipped: o > a.levels.maxEntry ? 'gap above the most-to-pay' : 'gap under the stop' }); continue; }
    const tr = simulate(bars, i + 1, o, a.levels);
    partB.push({ t, signalDate: barDate(bars[i].t), setup: a.setup, score: a.score, ...tr });
    busyUntil = i + 1 + tr.days; // one trade per stock at a time
  }
}

// ---------- Summary ----------

const last = barDate(spyBars[spyBars.length - 1].t);
const spyStart = spyBars[indexAtOrBefore(spyBars, START)].c;
const groups = {};
for (const r of partA.filter(r => r.status)) (groups[r.status] ||= []).push(r.fwdPct);
const out = {
  start: START,
  end: last,
  stocks: partA.filter(r => r.status).length,
  spyPct: round((spyBars[spyBars.length - 1].c / spyStart - 1) * 100),
  equalWeightPct: round(partA.filter(r => r.status).reduce((s, r) => s + r.fwdPct, 0) / partA.filter(r => r.status).length),
  partA: { byStatus: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, { n: v.length, avgFwdPct: round(v.reduce((a, b) => a + b, 0) / v.length) }])), trades: stats(partA.filter(r => r.trade).map(r => r.trade)), rows: partA },
  partB: { ...stats(partB), bySetup: Object.fromEntries(Object.keys(PLAYBOOK).map(s => [s, stats(partB.filter(x => x.setup === s))]).filter(([, v]) => v.trades + v.skipped > 0)), trades: partB },
};
out.partB.account = account(partB);
const tradedB = partB.filter(x => !x.skipped);
out.partB.byMarket = Object.fromEntries(['up', 'flat', 'down'].map(m => [m, stats(tradedB.filter(x => regimeByDate.get(x.signalDate) === m))]));
const quarter = d => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
out.partB.byQuarter = Object.fromEntries([...new Set(tradedB.map(x => quarter(x.signalDate)))].sort().map(q => [q, { ...stats(tradedB.filter(x => quarter(x.signalDate) === q)), spyPct: (() => { const inQ = spyBars.filter(b => quarter(barDate(b.t)) === q); return inQ.length ? round((inQ[inQ.length - 1].c / inQ[0].o - 1) * 100) : null; })() }]));
out.partB.byScore = { 'under 70': stats(tradedB.filter(x => x.score < 70)), '70-74': stats(tradedB.filter(x => x.score >= 70 && x.score < 75)), '75+': stats(tradedB.filter(x => x.score >= 75)) };
// The days of each market condition in the window, for context.
out.partB.marketDays = [...regimeByDate.entries()].filter(([d]) => d >= START).reduce((a, [, m]) => ({ ...a, [m]: (a[m] || 0) + 1 }), {});

fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ start: out.start, end: out.end, stocks: out.stocks, spyPct: out.spyPct, equalWeightPct: out.equalWeightPct, partA: { byStatus: out.partA.byStatus, trades: out.partA.trades }, partB: { ...stats(partB), account: out.partB.account, byMarket: out.partB.byMarket, marketDays: out.partB.marketDays, byScore: out.partB.byScore } }, null, 2));
