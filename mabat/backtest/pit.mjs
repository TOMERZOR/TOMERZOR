// Point-in-time SEC fundamentals for the backtest: what the screen would have said on a past date,
// from the files .github/workflows/mabat-backtest-sec.yml downloads into mabat/backtest/sec/<TICKER>/.
//
//   fundamentalsAsOf(ticker, date, price) -> { metrics, rules } from the server's fundamentals(), using
//                                            only facts filed on or before `date`; null with no SEC data
//   earningsDates(ticker)                 -> filing dates of 8-Ks with item 2.02 (results), oldest first
//
// The directory is MABAT_SEC, default mabat/backtest/sec (as run.mjs does with MABAT_DATA).
// The revenue tag is chosen as the server's loadFundamentals() does, with `date` in place of today.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quarters, fundamentals, REVENUE_TAGS } from '../server/sources.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const secDir = () => process.env.MABAT_SEC || path.join(here, 'sec');

const cache = new Map();
function readJson(file) {
  if (!cache.has(file)) cache.set(file, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
  return cache.get(file);
}

// The facts of one concept, in the unit the server reads (USD, or USD/shares for EPS).
function concept(ticker, tag) {
  const json = readJson(path.join(secDir(), ticker, `${tag}.json`));
  return json?.units?.USD || json?.units?.['USD/shares'] || [];
}

export const hasData = ticker => fs.existsSync(path.join(secDir(), ticker));

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const asOf = (facts, date) => facts.filter(f => f.filed && f.filed <= date);

export function fundamentalsAsOf(ticker, date, price) {
  if (!hasData(ticker)) return null;
  let revenue = [];
  for (const t of REVENUE_TAGS) {
    const facts = asOf(concept(ticker, t), date);
    const q = quarters(facts);
    if (q.length && (!revenue.length || q[q.length - 1].end > quarters(revenue).pop().end)) revenue = facts;
    if (q.length && days(q[q.length - 1].end, date) < 200) break;
  }
  return fundamentals({
    revenue,
    netIncome: asOf(concept(ticker, 'NetIncomeLoss'), date),
    opIncome: asOf(concept(ticker, 'OperatingIncomeLoss'), date),
    eps: asOf(concept(ticker, 'EarningsPerShareDiluted'), date),
  }, price);
}

export function earningsDates(ticker) {
  const r = readJson(path.join(secDir(), ticker, 'submissions.json'))?.filings?.recent;
  if (!r) return [];
  const out = new Set();
  for (let k = 0; k < (r.form || []).length; k++) {
    if (r.form[k] !== '8-K') continue;
    const items = String(r.items?.[k] || '').split(',').map(s => s.trim());
    if (items.includes('2.02')) out.add(r.filingDate[k]);
  }
  return [...out].sort();
}

// Pass, fail or missing for a screen: any rule failed -> 'fail'; else any rule without data
// (or no SEC data at all) -> 'missing'; else 'pass'.
export function verdict(screen) {
  if (!screen) return 'missing';
  if (screen.rules.some(r => r.pass === false)) return 'fail';
  if (screen.rules.some(r => r.pass == null)) return 'missing';
  return 'pass';
}
