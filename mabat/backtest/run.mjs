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
import { PLAYBOOK, MANUAL } from '../server/plans.js';
import { parseChart, parseStooq } from '../server/sources.js';
import { sma, rsi, macd, atr } from '../server/indicators.js';
import { barDate } from '../server/clock.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const START = process.argv[2] || '2026-08-12';
const dataDir = process.env.MABAT_DATA || path.join(here, 'data');

function load(t) {
  // From the Mabat server's /t/<TICKER>: { bars: [[t, o, h, l, c, v], ...] }
  const mabat = path.join(dataDir, `${t}.mabat.json`);
  if (fs.existsSync(mabat)) return JSON.parse(fs.readFileSync(mabat, 'utf8')).bars.map(([t0, o, h, l, c, v]) => ({ t: t0, o, h, l, c, v }));
  const json = path.join(dataDir, `${t}.json`);
  const csv = path.join(dataDir, `${t}.csv`);
  if (fs.existsSync(json)) return parseChart(JSON.parse(fs.readFileSync(json, 'utf8'))).bars;
  if (fs.existsSync(csv)) return parseStooq(fs.readFileSync(csv, 'utf8'), t).bars;
  return null;
}

const tickers = [...new Set(fs.readdirSync(dataDir).map(f => f.replace(/(\.mabat)?\.(json|csv)$/, '')))].filter(t => t !== 'SPY').sort();
const spyBars = load('SPY');
const spyByDate = new Map();
{
  const closes = spyBars.map(b => b.c);
  const s200 = sma(closes, 200);
  spyBars.forEach((b, i) => spyByDate.set(barDate(b.t), {
    ret63: i >= 63 ? (b.c / closes[i - 63] - 1) * 100 : null,
    above200: s200[i] != null ? b.c > s200[i] : null,
  }));
}

const indexAtOrBefore = (bars, date) => { let k = -1; bars.forEach((b, i) => { if (barDate(b.t) <= date) k = i; }); return k; };
const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

// Plays a trade out from bar `from` (the entry bar), entered at `entry`.
function simulate(bars, from, entry, plan) {
  const p = PLAYBOOK[plan.setup] || MANUAL;
  const R = entry - plan.stop;
  const closes = bars.map(b => b.c);
  const A = atr(bars, 14);
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const hist = macd(closes).hist;
  const r14 = rsi(closes, 14);
  let stopNow = plan.stop;
  let stopKind = 'initial';
  let open = 1; // the part of the position still held
  let pnl = 0; // per share of the whole position
  let t1Hit = false;
  let t2Hit = false;
  let highClose = entry;
  let exit = null;
  let exitDate = null;
  const sell = (part, px) => { pnl += part * (px - entry); open -= part; };
  let j = from;
  for (; j < bars.length; j++) {
    const b = bars[j];
    const o = j === from ? entry : b.o;
    if (b.l <= stopNow) {
      sell(open, Math.min(o, stopNow));
      exit = stopKind === 'initial' ? 'stop' : stopKind === 'breakeven' ? 'breakeven' : 'trail';
      break;
    }
    if (!t1Hit && b.h >= plan.t1) {
      t1Hit = true;
      sell(0.5, Math.max(o, plan.t1));
      if (entry > stopNow) { stopNow = entry; stopKind = 'breakeven'; }
    }
    if (t1Hit && b.h >= plan.t2) {
      t2Hit = true;
      sell(open, Math.max(o, plan.t2));
      exit = 't2';
      break;
    }
    // At the close: trailing stop, early exits, time stop.
    highClose = Math.max(highClose, b.c);
    if (highClose >= entry + R) {
      const trail = highClose - p.trail * (A[j] || entry * 0.02);
      if (trail > stopNow) { stopNow = trail; stopKind = 'trail'; }
    }
    const days = j - from;
    let early = null;
    if (days >= 1) {
      const inv = p.invalidate;
      if (inv === 'level' && plan.level && b.c < plan.level && !t1Hit) early = 'failed';
      else if (inv === 'sma20' && !t1Hit && b.c < s20[j]) early = 'failed';
      else if (inv === 'sma50' && b.c < s50[j]) early = 'trend';
      else if (inv === 'sma200' && s200[j] && b.c < s200[j]) early = 'trend';
      else if (inv === 'macd' && hist[j] < 0 && hist[j - 1] < 0) early = 'momentum';
      else if (inv === 'rsi' && r14[j] > 70) early = 'done';
    }
    if (!early && p.days && days >= p.days && !t1Hit) early = 'time';
    if (early) { sell(open, b.c); exit = early; break; }
  }
  const last = Math.min(j, bars.length - 1);
  if (!exit) { sell(open, bars[bars.length - 1].c); exit = 'open'; }
  exitDate = barDate(bars[last].t);
  return {
    entryDate: barDate(bars[from].t), entry: round(entry), stop: plan.stop, t1: plan.t1, t2: plan.t2,
    exit, exitDate, days: last - from, t1Hit, t2Hit,
    r: round(pnl / R), pct: round((pnl / entry) * 100), stoppedBeforeT1: !t1Hit && (exit === 'stop'),
  };
}

const ctxFor = bars => ({ spy: spyByDate.get(barDate(bars[bars.length - 1].t)) || null });

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
function stats(trades) {
  const done = trades.filter(x => !x.skipped);
  const n = done.length;
  const pct = k => (n ? round((done.filter(k).length / n) * 100, 1) : null);
  const avg = f => (n ? round(done.reduce((s, x) => s + f(x), 0) / n, 2) : null);
  const by = {};
  for (const x of done) by[x.exit] = (by[x.exit] || 0) + 1;
  return {
    trades: n, skipped: trades.length - n,
    reachedT1: pct(x => x.t1Hit), reachedT2: pct(x => x.t2Hit), stoppedBeforeT1: pct(x => x.stoppedBeforeT1),
    winRate: pct(x => x.r > 0), avgR: avg(x => x.r), avgPct: avg(x => x.pct), totalR: round(done.reduce((s, x) => s + x.r, 0), 2),
    stillOpen: done.filter(x => x.exit === 'open').length, exits: by,
  };
}

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
fs.writeFileSync(path.join(here, 'results.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ start: out.start, end: out.end, stocks: out.stocks, spyPct: out.spyPct, equalWeightPct: out.equalWeightPct, partA: { byStatus: out.partA.byStatus, trades: out.partA.trades }, partB: { ...stats(partB), bySetup: out.partB.bySetup } }, null, 2));
