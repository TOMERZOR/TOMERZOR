// Momentum over ten years of prices with dividends (mabat/backtest/long, from Nasdaq's public API).
// Every rule here was fixed before the data was looked at, and every result is reported.
//
//   node mabat/backtest/momentum-long.mjs
//
// Rules of play: monthly; the signal is read at the close of the day before the month's last
// trading day, and the trade is made at the month's last close; 0.1% cost on every buy and sale;
// total return (dividends reinvested on the ex-date).
//
// Strategies:
//   sectors 12-1 top 3    the 3 of 9 sector funds with the best return from 12 months to 1 month back
//   sectors 6-1 top 3     the same over 6 months to 1 month back
//   sectors 12-1 + cash   12-1 top 3, but a slot whose sector did worse than T-bills (BIL) over 12 months holds BIL
//   dual momentum         if SPY beat BIL over 12 months, the better of SPY and EFA; else AGG (bonds)
//   stocks 12-1 top 10    the 10 of the 50 stocks with the best 12-1 return (the 50 were picked today: hindsight)
// Benchmarks: SPY; the 9 sectors in equal weights; 60% SPY / 40% AGG; the 50 stocks in equal weights.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.MABAT_LONG || path.join(here, 'long');
const COST = 0.001;
const SECTORS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU'];
const START = '2018-01-01';

// ---------- Total return series on one calendar ----------

const raw = {};
for (const f of fs.readdirSync(dir)) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  raw[d.t] = d;
}
const calendar = raw.SPY.bars.map(b => b[0]);
const series = {}; // ticker -> Map(date -> total return index)
for (const [t, d] of Object.entries(raw)) {
  const divs = new Map();
  for (const [date, amt] of d.dividends || []) divs.set(date, (divs.get(date) || 0) + amt);
  const m = new Map();
  let idx = 1;
  let prev = null;
  for (const [date, , , , c] of d.bars) {
    if (prev != null) idx *= (c + (divs.get(date) || 0)) / prev;
    m.set(date, idx);
    prev = c;
  }
  series[t] = m;
}
const at = (t, date) => series[t]?.get(date) ?? null;
const STOCKS = Object.keys(raw).filter(t => !SECTORS.includes(t) && !['SPY', 'EFA', 'AGG', 'BIL', 'IEF'].includes(t));

// Return over trading days [i - from, i - to] on the calendar.
function ret(t, i, from, to = 0) {
  if (i - from < 0) return null;
  const a = at(t, calendar[i - from]);
  const b = at(t, calendar[i - to]);
  return a && b ? b / a - 1 : null;
}

// ---------- Running a monthly portfolio ----------

const monthEnd = i => i < calendar.length - 1 && calendar[i + 1].slice(0, 7) !== calendar[i].slice(0, 7);
const startIdx = calendar.findIndex(d => d >= START);

// pick(signalIdx) -> { ticker: weight } (weights sum to 1)
function run(pick) {
  let value = 10000;
  let weights = {}; // ticker -> money held
  const curve = [];
  for (let i = startIdx; i < calendar.length; i++) {
    // grow the holdings by today's total return
    if (i > startIdx) {
      for (const t of Object.keys(weights)) {
        const a = at(t, calendar[i - 1]);
        const b = at(t, calendar[i]);
        if (a && b) weights[t] *= b / a;
      }
    }
    value = Object.values(weights).reduce((s, v) => s + v, 0) || value;
    if (monthEnd(i) || i === startIdx) {
      const target = pick(i - 1);
      const total = value;
      let traded = 0;
      const next = {};
      for (const [t, w] of Object.entries(target)) next[t] = total * w;
      for (const t of new Set([...Object.keys(weights), ...Object.keys(next)])) traded += Math.abs((next[t] || 0) - (weights[t] || 0));
      const cost = traded * COST;
      weights = Object.fromEntries(Object.entries(next).map(([t, v]) => [t, v - cost * (v / total)]));
      value = total - cost;
    }
    curve.push([calendar[i], value]);
  }
  return curve;
}

const equal = list => Object.fromEntries(list.map(t => [t, 1 / list.length]));
const top = (list, n, score) => list.map(t => [t, score(t)]).filter(([, s]) => s != null).sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);

const STRATEGIES = {
  'SPY': () => ({ SPY: 1 }),
  '60/40 SPY/AGG': () => ({ SPY: 0.6, AGG: 0.4 }),
  'sectors equal': () => equal(SECTORS),
  'sectors 12-1 top 3': i => equal(top(SECTORS, 3, t => ret(t, i, 252, 21))),
  'sectors 6-1 top 3': i => equal(top(SECTORS, 3, t => ret(t, i, 126, 21))),
  'sectors 12-1 + cash': i => {
    const bil = ret('BIL', i, 252);
    const picks = top(SECTORS, 3, t => ret(t, i, 252, 21));
    const w = {};
    for (const t of picks) { const k = ret(t, i, 252, 21) > bil ? t : 'BIL'; w[k] = (w[k] || 0) + 1 / 3; }
    return w;
  },
  'dual momentum': i => {
    const spy = ret('SPY', i, 252);
    const efa = ret('EFA', i, 252);
    const bil = ret('BIL', i, 252);
    if (spy > bil) return { [efa > spy ? 'EFA' : 'SPY']: 1 };
    return { AGG: 1 };
  },
  '50 stocks equal (hindsight)': i => equal(STOCKS.filter(t => at(t, calendar[i]) != null)),
  'stocks 12-1 top 10 (hindsight)': i => equal(top(STOCKS, 10, t => ret(t, i, 252, 21))),
};

// ---------- Measures ----------

function measures(curve, from = curve[0][0], to = curve.at(-1)[0]) {
  const c = curve.filter(([d]) => d >= from && d <= to);
  const years = (Date.parse(c.at(-1)[0]) - Date.parse(c[0][0])) / (365.25 * 86400000);
  const total = c.at(-1)[1] / c[0][1] - 1;
  const cagr = (1 + total) ** (1 / years) - 1;
  const daily = c.slice(1).map(([, v], k) => v / c[k][1] - 1);
  const mean = daily.reduce((s, x) => s + x, 0) / daily.length;
  const vol = Math.sqrt(daily.reduce((s, x) => s + (x - mean) ** 2, 0) / daily.length) * Math.sqrt(252);
  let peak = 0;
  let dd = 0;
  for (const [, v] of c) { peak = Math.max(peak, v); dd = Math.max(dd, 1 - v / peak); }
  return { total, cagr, vol, maxDD: dd };
}

function byYear(curve) {
  const out = {};
  let prevEnd = curve[0][1];
  let year = curve[0][0].slice(0, 4);
  for (let k = 0; k < curve.length; k++) {
    const [d, v] = curve[k];
    const nextYear = curve[k + 1]?.[0].slice(0, 4);
    if (nextYear !== year) {
      out[year] = v / prevEnd - 1;
      prevEnd = v;
      year = nextYear;
    }
  }
  return out;
}

const curves = Object.fromEntries(Object.entries(STRATEGIES).map(([name, pick]) => [name, run(pick)]));
const bil = measures(run(() => ({ BIL: 1 })));
const pct = v => `${(v * 100).toFixed(1)}%`.padStart(8);

const first = curves.SPY[0][0];
const last = curves.SPY.at(-1)[0];
const report = { from: first, to: last, strategies: {} };
console.log(`${first} .. ${last}   (T-bills ${pct(bil.cagr)} a year)\n`);
console.log('strategy'.padEnd(32) + ['a year', 'total', 'swings', 'max drop', 'return/risk'].map(h => h.padStart(12)).join(''));
for (const [name, curve] of Object.entries(curves)) {
  const m = measures(curve);
  const sharpe = (m.cagr - bil.cagr) / m.vol;
  report.strategies[name] = { ...m, sharpe, years: byYear(curve) };
  console.log(name.padEnd(32) + [pct(m.cagr), pct(m.total), pct(m.vol), pct(m.maxDD), sharpe.toFixed(2).padStart(8)].map(s => s.padStart(12)).join(''));
}

const years = Object.keys(report.strategies.SPY.years);
console.log('\nby year'.padEnd(33) + years.map(y => y.padStart(8)).join(''));
for (const [name, r] of Object.entries(report.strategies)) console.log(name.padEnd(32) + years.map(y => pct(r.years[y] ?? NaN)).join(''));

// The two halves: 2018-2021 and 2022 on.
console.log('\nhalves'.padEnd(33) + '   2018-2021 a year / max drop      2022-now a year / max drop');
for (const [name, curve] of Object.entries(curves)) {
  const a = measures(curve, first, '2021-12-31');
  const b = measures(curve, '2022-01-01', last);
  console.log(name.padEnd(32) + `${pct(a.cagr)} / ${pct(a.maxDD)}         ${pct(b.cagr)} / ${pct(b.maxDD)}`);
}
fs.writeFileSync(path.join(here, 'momentum-long.json'), JSON.stringify(report, null, 2));
