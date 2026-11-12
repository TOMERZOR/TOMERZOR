// Slims SEC EDGAR JSON before it is committed (used by .github/workflows/mabat-backtest-sec.yml).
//
//   node mabat/backtest/sec-slim.mjs concept <raw.json> <out.json>
//   node mabat/backtest/sec-slim.mjs submissions <raw.json> <out.json> [older-page.json ...]
//
// concept:     keeps start, end, val, filed, form, fp of each fact, under the same `units` keys.
// submissions: keeps form, filingDate, reportDate, items of filings.recent, plus the same columns of
//              any older pages given (a company with many filings, e.g. a bank's prospectuses, has only
//              its latest ~1000 in `recent`).

import fs from 'node:fs';

const [kind, raw, out, ...pages] = process.argv.slice(2);
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const COLS = ['form', 'filingDate', 'reportDate', 'items'];

function slimConcept(json) {
  const units = {};
  for (const [unit, facts] of Object.entries(json.units || {})) {
    units[unit] = facts.map(f => ({ start: f.start, end: f.end, val: f.val, filed: f.filed, form: f.form, fp: f.fp }));
  }
  return { cik: json.cik, tag: json.tag, units };
}

function slimSubmissions(json, older = []) {
  const recent = Object.fromEntries(COLS.map(c => [c, []]));
  for (const src of [json.filings?.recent || {}, ...older]) {
    const n = (src.form || []).length;
    for (const c of COLS) for (let k = 0; k < n; k++) recent[c].push(src[c]?.[k] ?? '');
  }
  return { cik: json.cik, name: json.name, tickers: json.tickers, filings: { recent } };
}

if (kind === 'concept') fs.writeFileSync(out, JSON.stringify(slimConcept(read(raw))));
else if (kind === 'submissions') fs.writeFileSync(out, JSON.stringify(slimSubmissions(read(raw), pages.map(read))));
else { console.error(`unknown kind: ${kind}`); process.exit(1); }
