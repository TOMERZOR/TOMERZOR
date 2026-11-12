// Shared pieces of the Mabat backtest: the data, the market condition, playing a trade out by its
// plan, the statistics and the $10,000 account. Used by run.mjs and variants.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYBOOK, MANUAL } from '../server/plans.js';
import { parseChart, parseStooq } from '../server/sources.js';
import { sma, rsi, macd, atr } from '../server/indicators.js';
import { barDate } from '../server/clock.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.MABAT_DATA || path.join(here, 'data');

export function load(t) {
  // From the Mabat server's /t/<TICKER>: { bars: [[t, o, h, l, c, v], ...] }
  const mabat = path.join(dataDir, `${t}.mabat.json`);
  if (fs.existsSync(mabat)) return JSON.parse(fs.readFileSync(mabat, 'utf8')).bars.map(([t0, o, h, l, c, v]) => ({ t: t0, o, h, l, c, v }));
  const json = path.join(dataDir, `${t}.json`);
  const csv = path.join(dataDir, `${t}.csv`);
  if (fs.existsSync(json)) return parseChart(JSON.parse(fs.readFileSync(json, 'utf8'))).bars;
  if (fs.existsSync(csv)) return parseStooq(fs.readFileSync(csv, 'utf8'), t).bars;
  return null;
}

export const tickers = [...new Set(fs.readdirSync(dataDir).map(f => f.replace(/(\.mabat)?\.(json|csv)$/, '')))].filter(t => t !== 'SPY').sort();
export const spyBars = load('SPY');
export const spyByDate = new Map();
{
  const closes = spyBars.map(b => b.c);
  const s200 = sma(closes, 200);
  spyBars.forEach((b, i) => spyByDate.set(barDate(b.t), {
    ret63: i >= 63 ? (b.c / closes[i - 63] - 1) * 100 : null,
    above200: s200[i] != null ? b.c > s200[i] : null,
  }));
}

// The market on a date: 'up' (SPY over a rising 50-day average), 'down' (under a falling one), else 'flat'.
export const regimeByDate = new Map();
{
  const closes = spyBars.map(b => b.c);
  const s50 = sma(closes, 50);
  spyBars.forEach((b, i) => {
    if (s50[i] == null || s50[i - 10] == null) return;
    const rising = s50[i] > s50[i - 10];
    regimeByDate.set(barDate(b.t), b.c > s50[i] && rising ? 'up' : b.c < s50[i] && !rising ? 'down' : 'flat');
  });
}

export const indexAtOrBefore = (bars, date) => { let k = -1; bars.forEach((b, i) => { if (barDate(b.t) <= date) k = i; }); return k; };
export const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

// Plays a trade out from bar `from` (the entry bar), entered at `entry`.
// opts.noT2: after target 1 the rest rides the trailing stop instead of being sold at target 2.
export function simulate(bars, from, entry, plan, opts = {}) {
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
    if (t1Hit && !opts.noT2 && b.h >= plan.t2) {
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
    exit, exitDate, days: last - from, t1Hit,
    // with noT2, target 2 still counts as reached when the price got there
    t2Hit: t2Hit || (!!opts.noT2 && t1Hit && Math.max(...bars.slice(from, last + 1).map(x => x.h)) >= plan.t2),
    r: round(pnl / R), pct: round((pnl / entry) * 100), stoppedBeforeT1: !t1Hit && (exit === 'stop'),
  };
}

export const ctxFor = bars => ({ spy: spyByDate.get(barDate(bars[bars.length - 1].t)) || null });


export function stats(trades) {
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

// A $10,000 account trading Part B's signals in date order: 1% risk per trade, at most 25% in one
// stock, 10% kept in cash, no new trade without the cash for it (trader-budget, trader-risk).
export function account(trades, budget = 10000) {
  const list = trades.filter(x => !x.skipped).sort((a, b) => (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : 0));
  let cash = budget * 0.9;
  let realized = 0;
  let taken = 0;
  let skipped = 0;
  const open = [];
  let peak = budget;
  let maxDrawdown = 0;
  for (const x of list) {
    for (let k = open.length - 1; k >= 0; k--) {
      if (open[k].exitDate < x.entryDate) {
        cash += open[k].cost + open[k].pnl;
        realized += open[k].pnl;
        open.splice(k, 1);
        peak = Math.max(peak, budget + realized);
        maxDrawdown = Math.max(maxDrawdown, (peak - budget - realized) / peak * 100);
      }
    }
    const R = x.entry - x.stop;
    const shares = Math.min((budget * 0.01) / R, (budget * 0.25) / x.entry, cash / x.entry);
    if (shares * x.entry < 50) { skipped++; continue; }
    const cost = shares * x.entry;
    cash -= cost;
    taken++;
    open.push({ exitDate: x.exitDate, cost, pnl: shares * x.r * R });
  }
  for (const o of open) { realized += o.pnl; }
  return { budget, taken, skippedForCash: skipped, pnl: round(realized), returnPct: round((realized / budget) * 100), maxDrawdownPct: round(maxDrawdown, 1) };
}
