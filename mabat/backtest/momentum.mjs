// Momentum rotation on the backtest's 50 stocks, as decided before the run:
//   at each month's last close, rank by the return from 126 to 21 trading days back (6 months,
//   skipping the latest month), hold the top N in equal weights, trade at the next day's open,
//   0.1% cost on every buy and every sale. N = 10, and N = 5 as the only other version.
// Benchmarks over the same days: SPY, and the same 50 stocks in equal weights (rebalanced monthly,
// same costs), which carries the same hindsight in the choice of stocks.
//
//   node mabat/backtest/momentum.mjs

import { barDate } from '../server/clock.js';
import { load, tickers, round } from './lib.mjs';

const LOOK = 126;
const SKIP = 21;
const COST = 0.001;
const SPLIT = '2026-04-01';

const series = Object.fromEntries(tickers.map(t => [t, load(t)]));
const spy = load('SPY');
const dates = spy.map(b => barDate(b.t));
const byDate = Object.fromEntries(tickers.map(t => [t, new Map(series[t].map((b, i) => [barDate(b.t), i]))]));

// Month ends where every stock has the history to be ranked.
const monthEnds = dates.filter((d, i) => i >= LOOK && i < dates.length - 1 && dates[i + 1].slice(0, 7) !== d.slice(0, 7));

function momentum(t, date) {
  const i = byDate[t].get(date);
  if (i == null || i < LOOK) return null;
  const b = series[t];
  return b[i - SKIP].c / b[i - LOOK].c - 1;
}

// Runs a portfolio from the first month end to the last bar; pick(date) gives the stocks to hold.
function run(pick) {
  const startIdx = dates.indexOf(monthEnds[0]) + 1;
  let cash = 10000;
  let holdings = {}; // ticker -> shares
  const curve = [];
  const priceAt = (t, d, field) => { const i = byDate[t].get(d); return i == null ? null : series[t][i][field]; };
  const value = (d, field = 'c') => cash + Object.entries(holdings).reduce((s, [t, n]) => s + n * (priceAt(t, d, field) ?? 0), 0);
  let turnover = 0;
  for (let i = startIdx; i < dates.length; i++) {
    const d = dates[i];
    const prev = dates[i - 1];
    if (monthEnds.includes(prev)) {
      // rebalance at today's open to the stocks picked at yesterday's close
      const want = pick(prev);
      const total = value(d, 'o');
      const target = total / want.length;
      for (const [t, n] of Object.entries(holdings)) {
        const px = priceAt(t, d, 'o');
        const keep = want.includes(t) ? Math.min(n, target / px) : 0;
        if (n > keep) { cash += (n - keep) * px * (1 - COST); turnover += (n - keep) * px; holdings[t] = keep; }
        if (!holdings[t]) delete holdings[t];
      }
      for (const t of want) {
        const px = priceAt(t, d, 'o');
        const have = (holdings[t] || 0) * px;
        const buy = Math.min(target - have, cash / (1 + COST));
        if (buy > 1) { holdings[t] = (holdings[t] || 0) + buy / px; cash -= buy * (1 + COST); turnover += buy; }
      }
    }
    curve.push([d, value(d)]);
  }
  return { curve, turnover };
}

function perf(curve, from, to) {
  const part = curve.filter(([d]) => d >= from && d <= to);
  let peak = 0;
  let dd = 0;
  for (const [, v] of part) { peak = Math.max(peak, v); dd = Math.max(dd, 1 - v / peak); }
  return { pct: round((part.at(-1)[1] / part[0][1] - 1) * 100, 1), maxDD: round(dd * 100, 1) };
}

const topN = n => date => tickers.map(t => [t, momentum(t, date)]).filter(([, m]) => m != null).sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
const strategies = {
  'momentum top 10': run(topN(10)),
  'momentum top 5': run(topN(5)),
  'all 50, equal weight': run(() => tickers),
};
const spyCurve = (() => { const s = dates.indexOf(monthEnds[0]) + 1; return spy.slice(s).map(b => [barDate(b.t), b.c]); })();

const first = spyCurve[0][0];
const last = spyCurve.at(-1)[0];
const periods = [['whole', first, last], ['until ' + SPLIT, first, SPLIT], ['from ' + SPLIT, SPLIT, last]];
console.log(`${first} .. ${last}, ${monthEnds.length} month ends`);
for (const [label, a, b] of periods) {
  console.log(`\n${label} (${a} .. ${b})`);
  console.log('  S&P 500'.padEnd(26), JSON.stringify(perf(spyCurve, a, b)));
  for (const [name, r] of Object.entries(strategies)) console.log(`  ${name}`.padEnd(26), JSON.stringify(perf(r.curve, a, b)));
}
console.log('\nholdings at the last month end, top 10:', topN(10)(monthEnds.at(-1)).join(' '));
