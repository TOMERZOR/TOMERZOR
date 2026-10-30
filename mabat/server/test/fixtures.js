// Synthetic market data in the sources' real formats, with chart shapes that should (or should not)
// trigger each setup. Deterministic: the same ticker always gives the same chart.

import { isTradingDay, addDays, nyTime } from '../clock.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedOf = s => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

// Trading dates ending at `end` (inclusive), oldest first.
export function tradingDates(end, count) {
  const out = [];
  let d = end;
  while (out.length < count) {
    if (isTradingDay(d)) out.unshift(d);
    d = addDays(d, -1);
  }
  return out;
}

// Closing prices for a shape. All shapes have 460 bars (two years, like the server keeps).
// The noise is drawn from the last bar backwards, so the recent bars are the same whatever the length.
export const N = 460;
const drawn = (seed, count) => { const r = rng(seed); return Array.from({ length: count }, () => r() - 0.5); };

export function closesFor(shape, seed = 1, base = 100) {
  const draws = drawn(seed, N);
  const out = [];
  let p = base;
  let anchor = null;
  for (let i = 0; i < N; i++) {
    const k = N - 1 - i; // bars from the end
    const noise = amp => draws[k] * 2 * amp;
    let drift = 0.0015;
    let amp = 0.009;
    if (shape === 'downtrend') drift = -0.002;
    if (shape === 'flat') drift = 0;
    if (shape === 'extended' && k <= 15) { drift = 0.025; amp = 0.003; }
    if (shape === 'crash' && k <= 20) drift = -0.012;
    if (shape === 'pullback') {
      if (k <= 6 && k > 1) { drift = -0.006; amp = 0.001; }
      if (k === 1) { drift = -0.001; amp = 0; }
      if (k === 0) { drift = 0.02; amp = 0; }
    }
    // breakout and near: 25 days holding a level (not a random walk), then the last bar
    if ((shape === 'breakout' || shape === 'near') && k <= 25) {
      anchor ??= p;
      if (k > 0) { p = anchor * (1 + noise(0.006)); out.push(p); continue; }
      const top = Math.max(...out.slice(-20)) * 1.006;
      p = shape === 'breakout' ? top * 1.02 : top / 1.015;
      out.push(p);
      continue;
    }
    p *= 1 + drift + noise(amp);
    out.push(p);
  }
  return out;
}

export function barsFor(shape, end = '2026-10-29', seed = 1, base = 100) {
  const closes = closesFor(shape, seed, base);
  const dates = tradingDates(end, closes.length);
  const [a, b, c2, d] = [1, 2, 3, 4].map(x => drawn(seed + 99 * x, N));
  return closes.map((c, i) => {
    const k = closes.length - 1 - i;
    const o = i ? closes[i - 1] * (1 + a[k] * 0.004) : c;
    let v = Math.round(1e6 * (1 + b[k] * 0.4));
    if (shape === 'breakout' && k === 0) v = 2.4e6;
    return { t: Math.floor(nyTime(dates[i], 960) / 1000), o, h: Math.max(o, c) * (1 + (c2[k] + 0.5) * 0.004), l: Math.min(o, c) * (1 - (d[k] + 0.5) * 0.004), c, v };
  });
}

// Yahoo chart JSON (v8/finance/chart) for bars.
export function yahooChartJson(symbol, bars, extra = {}) {
  const last = bars[bars.length - 1];
  return {
    chart: {
      result: [{
        meta: {
          currency: 'USD', symbol, exchangeName: 'NMS', fullExchangeName: 'NasdaqGS', instrumentType: extra.type || 'EQUITY',
          regularMarketPrice: last.c, regularMarketTime: last.t, regularMarketDayHigh: last.h, regularMarketDayLow: last.l,
          regularMarketVolume: last.v, longName: extra.name || `${symbol} Inc.`, shortName: extra.name || symbol, chartPreviousClose: bars[0].c,
          dataGranularity: '1d', range: '1y',
        },
        timestamp: bars.map(b => b.t),
        indicators: {
          quote: [{ open: bars.map(b => b.o), high: bars.map(b => b.h), low: bars.map(b => b.l), close: bars.map(b => b.c), volume: bars.map(b => b.v) }],
          adjclose: [{ adjclose: bars.map(b => b.c) }],
        },
      }],
      error: null,
    },
  };
}

// SEC companyconcept units for a company with steady quarterly numbers (fiscal year = calendar year).
export function conceptFacts(kind, { growth = 0.12, base = 10e9, margin = 0.2, epsBase = 1 } = {}) {
  const facts = [];
  for (let y = 2023; y <= 2026; y++) {
    const yearVals = [];
    for (let q = 1; q <= 4; q++) {
      if (y === 2026 && q > 3) break;
      const start = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
      const endMonth = q * 3;
      const end = `${y}-${String(endMonth).padStart(2, '0')}-${[31, 30, 30, 31][q - 1]}`;
      const scale = (1 + growth) ** (y - 2023 + (q - 1) / 4);
      const val = kind === 'eps' ? epsBase * scale : kind === 'revenue' ? base * scale : base * scale * margin;
      yearVals.push(val);
      const filed = `${y}-${String(Math.min(12, endMonth + 1)).padStart(2, '0')}-05`;
      if (q < 4) facts.push({ start, end, val: kind === 'eps' ? Math.round(val * 100) / 100 : Math.round(val), accn: `0000-${y}-${q}`, fy: y, fp: `Q${q}`, form: '10-Q', filed, frame: `CY${y}Q${q}` });
    }
    if (yearVals.length === 4) {
      const total = yearVals.reduce((a, b) => a + b, 0);
      facts.push({ start: `${y}-01-01`, end: `${y}-12-31`, val: kind === 'eps' ? Math.round(total * 100) / 100 : Math.round(total), accn: `0000-${y}-K`, fy: y, fp: 'FY', form: '10-K', filed: `${y + 1}-02-10`, frame: `CY${y}` });
    }
  }
  return facts;
}

export function infoTableXml(rows) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
${rows.map(r => `  <infoTable>
    <nameOfIssuer>${r.name}</nameOfIssuer>
    <titleOfClass>COM</titleOfClass>
    <cusip>${r.cusip}</cusip>
    <value>${r.value}</value>
    <shrsOrPrnAmt><sshPrnamt>${r.shares}</sshPrnamt><sshPrnamtType>${r.type || 'SH'}</sshPrnamtType></shrsOrPrnAmt>
    ${r.putCall ? `<putCall>${r.putCall}</putCall>` : ''}
    <investmentDiscretion>DFND</investmentDiscretion>
    <votingAuthority><Sole>${r.shares}</Sole><Shared>0</Shared><None>0</None></votingAuthority>
  </infoTable>`).join('\n')}
</informationTable>`;
}

export function houseXml(members) {
  return `<?xml version="1.0" encoding="utf-8"?>
<FinancialDisclosure>
${members.map(m => `  <Member>
    <Prefix>Hon.</Prefix>
    <Last>${m.last}</Last>
    <First>${m.first}</First>
    <Suffix />
    <FilingType>${m.type || 'P'}</FilingType>
    <StateDst>${m.district}</StateDst>
    <Year>${m.date.slice(0, 4)}</Year>
    <FilingDate>${Number(m.date.slice(5, 7))}/${Number(m.date.slice(8, 10))}/${m.date.slice(0, 4)}</FilingDate>
    <DocID>${m.docId}</DocID>
  </Member>`).join('\n')}
</FinancialDisclosure>`;
}

// A real ZIP file with deflated entries (what the House Clerk serves).
export async function makeZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const nameBytes = enc.encode(name);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(8, 8, true);
    local.setUint32(14, crc32(raw), true); local.setUint32(18, data.length, true); local.setUint32(22, raw.length, true); local.setUint16(26, nameBytes.length, true);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(10, 8, true);
    cd.setUint32(16, crc32(raw), true); cd.setUint32(20, data.length, true); cd.setUint32(24, raw.length, true); cd.setUint16(28, nameBytes.length, true); cd.setUint32(42, offset, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(8, Object.keys(files).length, true); eocd.setUint16(10, Object.keys(files).length, true);
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

export function rssXml(symbol, items) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Yahoo! Finance: ${symbol} News</title>
${items.map(i => `<item><title><![CDATA[${i.title}]]></title><link>${i.link}</link><pubDate>${new Date(i.at).toUTCString()}</pubDate><guid isPermaLink="false">${i.link}</guid><description>${i.desc || ''}</description></item>`).join('\n')}
</channel></rss>`;
}
