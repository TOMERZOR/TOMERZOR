// Momentum over ten years of prices with dividends (mabat/backtest/long, from Nasdaq's public API).
// Every rule here was fixed before the data was looked at, and every result is reported.
//
//   node mabat/backtest/momentum-long.mjs
//
// Rules of play: monthly; the signal is read at the close of the day before the month's last
// trading day, and the trade is made at the month's last close; 0.1% cost on every buy and sale.
//
// Income, changed after the download and before any result was looked at: Nasdaq has no dividends
// for funds and Yahoo refuses the runners, so
//   - stocks and stock funds are priced without dividends, all alike (Nasdaq's stock dividends
//     aren't adjusted for splits, so they can't be used either);
//   - cash (CASH, in place of BIL) earns the 3-month T-bill rate of each day, from the Treasury;
//   - bonds (BOND, in place of AGG) are a 7-year Treasury bought at par and rolled every day, priced
//     from the Treasury's 7-year yield: coupon plus price change. IEF's price is the check.
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

// Treasury yields by date (percent), from the Treasury's yearly CSVs joined in one file.
const yields = new Map();
{
  let cols = null;
  for (const line of fs.readFileSync(path.join(here, 'long-yields.csv'), 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split(',').map(c => c.replace(/"/g, ''));
    if (cells[0] === 'Date') { cols = cells; continue; }
    const [m, dd, y] = cells[0].split('/');
    const row = {};
    cols.forEach((c, k) => { if (k && cells[k] !== '') row[c] = Number(cells[k]); });
    yields.set(`${y}-${m}-${dd}`, row);
  }
}
const yieldOn = (date, col) => { for (let k = calendar.indexOf(date); k >= 0; k--) { const v = yields.get(calendar[k])?.[col]; if (v != null) return v / 100; } return null; };
// A par bond with coupon c (yearly, paid twice a year) and m years left, priced at yield y.
const parPrice = (c, y, m) => { const n = 2 * m; const v = (1 + y / 2) ** -n; return y ? (c / y) * (1 - v) + v : 1; };
{
  const cash = new Map();
  const bond = new Map();
  let ci = 1;
  let bi = 1;
  for (let k = 0; k < calendar.length; k++) {
    const d = calendar[k];
    if (k) {
      const days = (Date.parse(d) - Date.parse(calendar[k - 1])) / 86400000;
      const r3 = yieldOn(calendar[k - 1], '3 Mo');
      const y0 = yieldOn(calendar[k - 1], '7 Yr');
      const y1 = yieldOn(d, '7 Yr');
      ci *= 1 + r3 * days / 365;
      bi *= parPrice(y0, y1, 7 - days / 365) + y0 * days / 365;
    }
    cash.set(d, ci);
    bond.set(d, bi);
  }
  series.CASH = cash;
  series.BOND = bond;
}
const at = (t, date) => series[t]?.get(date) ?? null;
const STOCKS = Object.keys(raw).filter(t => !SECTORS.includes(t) && !['SPY', 'EFA', 'AGG', 'BIL', 'IEF', 'CASH', 'BOND'].includes(t));

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
  '60/40 SPY/BOND': () => ({ SPY: 0.6, BOND: 0.4 }),
  'sectors equal': () => equal(SECTORS),
  'sectors 12-1 top 3': i => equal(top(SECTORS, 3, t => ret(t, i, 252, 21))),
  'sectors 6-1 top 3': i => equal(top(SECTORS, 3, t => ret(t, i, 126, 21))),
  'sectors 12-1 + cash': i => {
    const cash = ret('CASH', i, 252);
    const picks = top(SECTORS, 3, t => ret(t, i, 252, 21));
    const w = {};
    for (const t of picks) { const k = ret(t, i, 252, 21) > cash ? t : 'CASH'; w[k] = (w[k] || 0) + 1 / 3; }
    return w;
  },
  'dual momentum': i => {
    const spy = ret('SPY', i, 252);
    const efa = ret('EFA', i, 252);
    const cash = ret('CASH', i, 252);
    if (spy > cash) return { [efa > spy ? 'EFA' : 'SPY']: 1 };
    return { BOND: 1 };
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
const bil = measures(run(() => ({ CASH: 1 })));
const pct = v => `${(v * 100).toFixed(1)}%`.padStart(8);

const first = curves.SPY[0][0];
const last = curves.SPY.at(-1)[0];
const report = { from: first, to: last, strategies: {} };
console.log(`${first} .. ${last}   (T-bills ${pct(bil.cagr)} a year)\n`);
// The check on the bond series: its monthly moves against IEF's price (which has no income here).
{
  const ends = calendar.filter((d, k) => d >= START && monthEnd(k));
  const a = [];
  const b = [];
  for (let k = 1; k < ends.length; k++) { a.push(at('BOND', ends[k]) / at('BOND', ends[k - 1]) - 1); b.push(at('IEF', ends[k]) / at('IEF', ends[k - 1]) - 1); }
  const mean = x => x.reduce((s, v) => s + v, 0) / x.length;
  const ma = mean(a);
  const mb = mean(b);
  const corr = a.reduce((s, v, k) => s + (v - ma) * (b[k] - mb), 0) / Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) * b.reduce((s, v) => s + (v - mb) ** 2, 0));
  const yrs = (Date.parse(ends.at(-1)) - Date.parse(ends[0])) / (365.25 * 86400000);
  const cg = t => (at(t, ends.at(-1)) / at(t, ends[0])) ** (1 / yrs) - 1;
  console.log(`bond check: monthly correlation with IEF ${corr.toFixed(3)}; a year: BOND ${pct(cg('BOND'))}, IEF price only ${pct(cg('IEF'))}\n`);
  report.bondCheck = { corr, bond: cg('BOND'), iefPrice: cg('IEF') };
}
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

// ---------- Checks on the stock result, added after the table above was seen ----------
// The 50 were picked in 2026, so they include today's winners. These ask whether ranking by
// momentum adds anything inside that same group, where the hindsight is the same for every choice.
{
  const cagr = curve => measures(curve).cagr;
  const top10 = cagr(curves['stocks 12-1 top 10 (hindsight)']);
  const bottom10 = cagr(run(i => equal(top(STOCKS, 10, t => { const r = ret(t, i, 252, 21); return r == null ? null : -r; }))));
  // 10 random stocks from those with a year of history, drawn again each month; seeded.
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const randomRuns = [];
  for (let k = 0; k < 200; k++) {
    randomRuns.push(cagr(run(i => {
      const pool = STOCKS.filter(t => ret(t, i, 252, 21) != null);
      for (let j = pool.length - 1; j > 0; j--) { const r = Math.floor(rand() * (j + 1)); [pool[j], pool[r]] = [pool[r], pool[j]]; }
      return equal(pool.slice(0, 10));
    })));
  }
  randomRuns.sort((a, b) => a - b);
  const beaten = randomRuns.filter(v => v < top10).length / randomRuns.length;
  // Without the biggest winners of the whole period (the hindsight in its plainest form).
  const whole = t => { const a = [...series[t].values()]; return a.at(-1) / a.find(v => v != null); };
  const winners = [...STOCKS].sort((a, b) => whole(b) - whole(a)).slice(0, 5);
  const rest = STOCKS.filter(t => !winners.includes(t));
  const top10rest = cagr(run(i => equal(top(rest, 10, t => ret(t, i, 252, 21)))));
  const ewRest = cagr(run(i => equal(rest.filter(t => at(t, calendar[i]) != null))));
  console.log('\nchecks on the stocks (a year)');
  console.log(`  top 10 by 12-1 momentum      ${pct(top10)}`);
  console.log(`  bottom 10 by 12-1 momentum   ${pct(bottom10)}`);
  console.log(`  10 random each month (200x)  median ${pct(randomRuns[100])}, 5%-95% ${pct(randomRuns[10])} .. ${pct(randomRuns[190])}; top 10 beat ${(beaten * 100).toFixed(0)}% of them`);
  console.log(`  without ${winners.join(' ')}: top 10 ${pct(top10rest)}, all equal ${pct(ewRest)}`);
  report.stockChecks = { top10, bottom10, random: { median: randomRuns[100], p5: randomRuns[10], p95: randomRuns[190], beaten }, withoutWinners: { removed: winners, top10: top10rest, equal: ewRest } };
  fs.writeFileSync(path.join(here, 'momentum-long.json'), JSON.stringify(report, null, 2));
}
