// Tests changes to Mabat's rules, without fitting them to the past:
// variants are compared on the first period (TRAIN), and the chosen ones are then checked once on
// the later period (TEST), which the choice never saw.
//
//   node mabat/backtest/variants.mjs
//
// Same rules of play as run.mjs (lib.mjs): next day's open, intraday stops, the stop first when a
// day touches both, one trade per stock at a time, nothing known after the signal day.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../server/signals.js';
import { atr, priorLow } from '../server/indicators.js';
import { barDate } from '../server/clock.js';
import { load, tickers, regimeByDate, indexAtOrBefore, round, ctxFor, simulate, stats, account } from './lib.mjs';
import { fundamentalsAsOf } from './pit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const START = '2025-04-10';
const SPLIT = '2026-04-01'; // TRAIN: signals before this date; TEST: from it on

// Every new entry signal, analysed once.
const candidates = {};
for (const t of tickers) {
  const bars = load(t);
  const A = atr(bars, 14);
  const list = [];
  let prev = null;
  for (let i = indexAtOrBefore(bars, START); i < bars.length - 1; i++) {
    const slice = bars.slice(0, i + 1);
    const a = analyze(slice, ctxFor(slice));
    if (a.status === 'enter' && prev !== 'enter') list.push({ i, date: barDate(bars[i].t), score: a.score, setup: a.setup, levels: a.levels, atr: A[i], low10: priorLow(bars, i + 1, 10) });
    prev = a.status;
  }
  candidates[t] = { bars, list };
}

// A breakout's stop under the low of the last two weeks, 1.5 to 3 ATR from the entry; targets at the same R multiples.
function widerBreakoutStop(c) {
  const L = c.levels;
  if (L.setup !== 'breakout') return L;
  const E = L.entry;
  const raw = Math.min(L.level - 0.5 * c.atr, c.low10 - 0.25 * c.atr);
  const stop = round(Math.max(E - 3 * c.atr, E * 0.88, Math.min(raw, E - 1.5 * c.atr)));
  const R = E - stop;
  return { ...L, stop, t1: round(E + L.t1R * R), t2: round(E + L.t2R * R), riskPct: round((R / E) * 100, 1) };
}

function play(v) {
  const trades = [];
  for (const t of tickers) {
    const { bars, list } = candidates[t];
    let busyUntil = -1;
    for (const c of list) {
      if (c.i < busyUntil) continue;
      const market = regimeByDate.get(c.date);
      if (v.markets && !v.markets.includes(market)) continue;
      if (v.minScore && c.score < v.minScore) continue;
      if (v.skipSetups?.includes(c.setup)) continue;
      const plan = v.wideBreakout ? widerBreakoutStop(c) : c.levels;
      const o = bars[c.i + 1].o;
      // trader-screener's P/E rule, with only the reports filed by the signal date: no stock over
      // 45 times earnings or losing money. A stock without the numbers is not skipped.
      if (v.skipExpensive && fundamentalsAsOf(t, c.date, o)?.rules?.find(r => r.id === 'pe')?.pass === false) continue;
      if (o > plan.maxEntry || o <= plan.stop) continue;
      const tr = simulate(bars, c.i + 1, o, plan, { noT2: v.noT2 });
      trades.push({ t, signalDate: c.date, setup: c.setup, score: c.score, market, ...tr });
      busyUntil = c.i + 1 + tr.days;
    }
  }
  return trades;
}

const summary = trades => {
  const s = stats(trades);
  const acc = account(trades);
  return { trades: s.trades, t1: s.reachedT1, t2: s.reachedT2, stopBeforeT1: s.stoppedBeforeT1, win: s.winRate, avgR: s.avgR, avgPct: s.avgPct, totalR: s.totalR, accountPct: acc.returnPct, maxDD: acc.maxDrawdownPct, taken: acc.taken };
};

const VARIANTS = {
  base: {},
  'no flat market': { markets: ['up', 'down'] },
  'up market only': { markets: ['up'] },
  'score 70+': { minScore: 70 },
  'score 75+': { minScore: 75 },
  'wider breakout stop': { wideBreakout: true },
  'let winners run': { noT2: true },
  'no golden cross': { skipSetups: ['golden'] },
  'no flat + 70+': { markets: ['up', 'down'], minScore: 70 },
  'no flat + 70+ + wider stop': { markets: ['up', 'down'], minScore: 70, wideBreakout: true },
  'no flat + 70+ + wider stop + run': { markets: ['up', 'down'], minScore: 70, wideBreakout: true, noT2: true },
  'up only + 70+ + wider stop': { markets: ['up'], minScore: 70, wideBreakout: true },
  'score 70+ + wider stop': { minScore: 70, wideBreakout: true },
  'score 75+ + wider stop': { minScore: 75, wideBreakout: true },
  // Added after the SEC data arrived; chosen because the P/E rule split the training-period trades
  // (fundamentals-effect.mjs), before this variant's test period was printed.
  'skip expensive (P/E)': { skipExpensive: true },
};
// Chosen from the training period before the test period was printed.
const CHOSEN = ['base', 'wider breakout stop', 'score 75+', 'score 70+ + wider stop', 'score 75+ + wider stop'];

const out = { start: START, split: SPLIT, end: barDate(load('SPY').at(-1).t), variants: {} };
for (const [name, v] of Object.entries(VARIANTS)) {
  const all = play(v);
  out.variants[name] = {
    rules: v,
    train: summary(all.filter(x => x.signalDate < SPLIT)),
    test: summary(all.filter(x => x.signalDate >= SPLIT)),
    trades: all,
  };
}
fs.writeFileSync(path.join(here, 'variants.json'), JSON.stringify(out, null, 2));

const cols = ['trades', 't1', 'stopBeforeT1', 'win', 'avgR', 'avgPct', 'accountPct', 'maxDD'];
// The test period is printed only on request, after the variants are chosen from the training period.
for (const period of process.env.SHOW_TEST ? ['train', 'test'] : ['train']) {
  console.log(`\n${period.toUpperCase()} (${period === 'train' ? `${START} .. ${SPLIT}` : `${SPLIT} .. ${out.end}`})`);
  console.log('variant'.padEnd(34) + cols.map(c => c.padStart(13)).join(''));
  for (const [name, v] of Object.entries(out.variants)) console.log(name.padEnd(34) + cols.map(c => String(v[period][c]).padStart(13)).join(''));
}
