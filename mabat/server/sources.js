// Where the data comes from, one reader per source, the same ones the trader skills use:
//   Yahoo Finance chart JSON (trader-alerts)   daily bars and the live price, one request per ticker
//   Yahoo Finance headline RSS (trader-news)   headlines per ticker
//   SEC EDGAR submissions (trader-news)        8-K filings and their items
//   SEC EDGAR XBRL company concepts (trader-analyst, trader-screener)  revenue, income, EPS
//   SEC EDGAR 13F-HR information tables (trader-copycat)  what well-known funds hold
//   House Clerk disclosure index (trader-pelosi)  Periodic Transaction Reports by members of Congress
//
// SEC asks every program to identify itself with a real name and email, so SEC readers need a
// User-Agent (from the app's settings) and are skipped without one.

import { barDate } from './clock.js';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

export class SourceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// env.UPSTREAM (tests only) sends every request to a local stand-in: https://host/path -> UPSTREAM/host/path
export function makeFetch(env = {}, counter = { n: 0 }) {
  return async (url, init = {}) => {
    counter.n++;
    const target = env.UPSTREAM ? `${env.UPSTREAM}/${url.replace(/^https:\/\//, '')}` : url;
    const res = await fetch(target, { ...init, headers: { 'User-Agent': BROWSER_UA, Accept: '*/*', ...(init.headers || {}) }, cf: { cacheTtl: 0 } });
    if (!res.ok) throw new SourceError(`${new URL(url).host} answered ${res.status}`, res.status);
    return res;
  };
}

// ---------- Yahoo chart ----------

export const TICKER = /^[A-Z][A-Z0-9]{0,5}([.-][A-Z]{1,2})?$/;

export async function yahooChart(get, symbol) {
  let lastError;
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const res = await get(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&includePrePost=false&events=div%2Csplits`);
      return { ...parseChart(await res.json()), source: 'yahoo' };
    } catch (e) {
      lastError = e;
      if (e.status === 404) break;
    }
  }
  // trader-alerts' second source: Stooq's daily CSV.
  if (lastError?.status !== 404) {
    try {
      return { ...(await stooqDaily(get, symbol)), source: 'stooq' };
    } catch {}
  }
  throw lastError;
}

const ymd = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

export async function stooqDaily(get, symbol, now = Date.now()) {
  const s = `${symbol.toLowerCase()}.us`;
  const res = await get(`https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d&d1=${ymd(now - 700 * 86400000)}&d2=${ymd(now)}`);
  return parseStooq(await res.text(), symbol);
}

// Date,Open,High,Low,Close,Volume
export function parseStooq(csv, symbol) {
  const lines = csv.trim().split(/\r?\n/);
  if (!/^Date,Open,High,Low,Close/i.test(lines[0] || '')) throw new SourceError('stooq: no data', 404);
  const bars = [];
  for (const line of lines.slice(1)) {
    const [d, o, h, l, c, v] = line.split(',');
    const close = Number(c);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(close)) continue;
    // 4:00 p.m. New York, as a UTC timestamp (20:00 or 21:00 UTC), is close enough for a daily bar.
    const t = Math.floor(Date.parse(`${d}T20:30:00Z`) / 1000);
    bars.push({ t, o: Number(o) || close, h: Number(h) || close, l: Number(l) || close, c: close, v: Number(v) || 0 });
  }
  if (!bars.length) throw new SourceError('stooq: empty', 404);
  return { meta: { symbol, name: symbol, currency: 'USD', exchange: '', type: 'EQUITY', time: bars[bars.length - 1].t }, bars: bars.slice(-460) };
}

export function parseChart(json) {
  const result = json?.chart?.result?.[0];
  if (!result) throw new SourceError(json?.chart?.error?.description || 'no chart data', 404);
  const meta = result.meta || {};
  const q = result.indicators?.quote?.[0] || {};
  const ts = result.timestamp || [];
  const byDate = new Map();
  for (let k = 0; k < ts.length; k++) {
    const c = q.close?.[k];
    if (c == null || !Number.isFinite(c)) continue;
    const o = q.open?.[k] ?? c;
    const h = q.high?.[k] ?? Math.max(o, c);
    const l = q.low?.[k] ?? Math.min(o, c);
    // Yahoo sometimes sends today's bar twice (at the open and live): keep the later one.
    byDate.set(barDate(ts[k]), { t: ts[k], o, h: Math.max(h, o, c), l: Math.min(l, o, c), c, v: q.volume?.[k] ?? 0 });
  }
  const bars = [...byDate.values()].sort((a, b) => a.t - b.t);
  const price = meta.regularMarketPrice;
  if (Number.isFinite(price) && meta.regularMarketTime && bars.length) {
    const lastBar = bars[bars.length - 1];
    const liveDate = barDate(meta.regularMarketTime);
    const lastDate = barDate(lastBar.t);
    if (liveDate === lastDate) {
      lastBar.c = price;
      lastBar.h = Math.max(lastBar.h, price);
      lastBar.l = Math.min(lastBar.l, price);
      if (meta.regularMarketVolume) lastBar.v = Math.max(lastBar.v, meta.regularMarketVolume);
    } else if (liveDate > lastDate) {
      bars.push({ t: meta.regularMarketTime, o: price, h: meta.regularMarketDayHigh || price, l: meta.regularMarketDayLow || price, c: price, v: meta.regularMarketVolume || 0 });
    }
  }
  if (!bars.length) throw new SourceError('empty chart', 404);
  return {
    meta: {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      currency: meta.currency || 'USD',
      exchange: meta.fullExchangeName || meta.exchangeName || '',
      type: meta.instrumentType || 'EQUITY',
      time: meta.regularMarketTime || bars[bars.length - 1].t,
    },
    bars,
  };
}

// Bars kept compactly in storage: [t, o, h, l, c, v]
const r4 = v => Math.round(v * 10000) / 10000;
export const packBars = bars => bars.map(b => [b.t, r4(b.o), r4(b.h), r4(b.l), r4(b.c), b.v]);
export const unpackBars = rows => rows.map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }));

// ---------- Yahoo search ----------

const US_EXCHANGES = new Set(['NMS', 'NYQ', 'NGM', 'NCM', 'ASE', 'PCX', 'BTS', 'NAS', 'NYS', 'PNK']);

export async function yahooSearch(get, query) {
  const res = await get(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`);
  const json = await res.json();
  return (json.quotes || [])
    .filter(x => (x.quoteType === 'EQUITY' || x.quoteType === 'ETF') && TICKER.test(x.symbol || '') && (!x.exchange || US_EXCHANGES.has(x.exchange)))
    .slice(0, 8)
    .map(x => ({ t: x.symbol, name: x.longname || x.shortname || x.symbol, exchange: x.exchDisp || x.exchange || '', type: x.quoteType }));
}

// ---------- RSS headlines ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeXml(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/<[^>]+>/g, '')
    .trim();
}

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'i'));
  return m ? m[1] : '';
};

export function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = m[1];
    const title = decodeXml(tag(body, 'title'));
    const link = decodeXml(tag(body, 'link'));
    const date = Date.parse(decodeXml(tag(body, 'pubDate')));
    if (!title || !/^https?:\/\//.test(link)) continue;
    items.push({ title, link, at: Number.isFinite(date) ? date : null, source: decodeXml(tag(body, 'source')) || 'Yahoo Finance' });
  }
  return items;
}

export const NEWS_TAGS = [
  ['earnings', /\b(earnings|results|revenue|eps|quarter|guidance|beats?|miss(es)?)\b/i],
  ['analyst', /\b(upgrade[sd]?|downgrade[sd]?|price target|rating|analyst)\b/i],
  ['legal', /\b(lawsuit|sues?|court|judge|probe|investigation|sec charges|antitrust|settle)/i],
  ['deal', /\b(acquir|merger|buyout|deal|takeover|stake)\w*/i],
  ['people', /\b(ceo|cfo|chief|resign|steps down|appoint)\w*/i],
  ['risk', /\b(recall|bankrupt|default|restat|delist|halt|plunge|crash|warning)\w*/i],
];
export const tagHeadline = title => NEWS_TAGS.filter(([, re]) => re.test(title)).map(([id]) => id);

export async function headlines(get, symbol) {
  const res = await get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`);
  return parseRss(await res.text())
    .map(x => ({ ...x, tags: tagHeadline(x.title) }))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, 12);
}

// ---------- SEC EDGAR ----------

const cik10 = cik => String(cik).padStart(10, '0');
const secHeaders = ua => ({ 'User-Agent': ua, Accept: 'application/json, text/xml, */*' });

export async function secTickerMap(get, ua) {
  const res = await get('https://www.sec.gov/files/company_tickers.json', { headers: secHeaders(ua) });
  const json = await res.json();
  const map = {};
  for (const row of Object.values(json)) if (row?.ticker) map[row.ticker.toUpperCase().replace('.', '-')] = row.cik_str;
  return map;
}

export async function secSubmissions(get, ua, cik) {
  const res = await get(`https://data.sec.gov/submissions/CIK${cik10(cik)}.json`, { headers: secHeaders(ua) });
  return res.json();
}

// The filing list in a submissions file, newest first.
export function recentFilings(sub, forms) {
  const r = sub?.filings?.recent || {};
  const out = [];
  for (let k = 0; k < (r.form || []).length; k++) {
    if (forms && !forms.includes(r.form[k])) continue;
    const acc = r.accessionNumber[k];
    out.push({
      form: r.form[k],
      date: r.filingDate[k],
      period: r.reportDate?.[k] || null,
      acc,
      items: (r.items?.[k] || '').split(',').map(s => s.trim()).filter(Boolean),
      doc: r.primaryDocument?.[k] || '',
      url: `https://www.sec.gov/Archives/edgar/data/${Number(sub.cik)}/${acc.replace(/-/g, '')}/${r.primaryDocument?.[k] || ''}`,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export const ITEM_NAMES = {
  '1.01': 'הסכם מהותי', '1.03': 'פשיטת רגל', '1.05': 'אירוע סייבר', '2.01': 'רכישה או מכירה של נכסים', '2.02': 'דוחות רבעוניים',
  '2.05': 'עלויות ארגון מחדש', '2.06': 'מחיקת נכסים', '3.01': 'הודעת מחיקה מהמסחר', '4.02': 'דוחות קודמים לא אמינים',
  '5.02': 'שינוי בהנהלה', '5.07': 'הצבעת בעלי מניות', '7.01': 'גילוי נאות', '8.01': 'אירוע אחר',
};
export const IMPORTANT_ITEMS = new Set(['1.03', '1.05', '2.02', '2.06', '3.01', '4.02', '5.02']);

export async function secConcept(get, ua, cik, concept) {
  const res = await get(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik10(cik)}/us-gaap/${concept}.json`, { headers: secHeaders(ua) });
  const json = await res.json();
  return json.units?.USD || json.units?.['USD/shares'] || [];
}

// ---------- trader-analyst: quarters, the derived fourth quarter, TTM ----------

const DAY = 86400000;
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

function dedupe(facts) {
  const by = new Map();
  for (const f of facts) {
    if (!f.start || !f.end || !Number.isFinite(f.val)) continue;
    const key = `${f.start}|${f.end}`;
    const prev = by.get(key);
    if (!prev || (f.filed || '') > (prev.filed || '')) by.set(key, f);
  }
  return [...by.values()];
}

// Quarter-length facts (with the fourth quarter derived as the year minus its three quarters), oldest first.
export function quarters(facts) {
  const all = dedupe(facts);
  const q = all.filter(f => { const d = days(f.start, f.end); return d >= 80 && d <= 100; });
  const years = all.filter(f => { const d = days(f.start, f.end); return d >= 350 && d <= 380; });
  for (const y of years) {
    if (q.some(x => Math.abs(days(x.end, y.end)) <= 5)) continue;
    const inside = q.filter(x => days(y.start, x.start) >= -5 && days(x.end, y.end) >= -5);
    if (inside.length !== 3) continue;
    const lastEnd = inside.map(x => x.end).sort().pop();
    q.push({ start: lastEnd, end: y.end, val: y.val - inside.reduce((s, x) => s + x.val, 0), derived: true, filed: y.filed });
  }
  const byEnd = new Map();
  for (const f of q) if (!byEnd.has(f.end) || !f.derived) byEnd.set(f.end, f);
  return [...byEnd.values()].sort((a, b) => (a.end < b.end ? -1 : 1));
}

export function ttm(qs) {
  if (qs.length < 4) return null;
  const four = qs.slice(-4);
  const span = days(four[0].start, four[3].end);
  if (span < 350 || span > 380) return null;
  return four.reduce((s, x) => s + x.val, 0);
}

const near = (list, end, tolerance = 12) => list.find(x => Math.abs(days(x.end, end)) <= tolerance);

// concepts: { revenue, netIncome, opIncome, eps } as SEC fact arrays. Returns the metrics and the
// trader-screener rules, each pass / fail / null (missing, skipped) with its number.
export function fundamentals(concepts, price) {
  const rev = quarters(concepts.revenue || []);
  const ni = quarters(concepts.netIncome || []);
  const op = quarters(concepts.opIncome || []);
  const eps = quarters(concepts.eps || []);
  const latest = rev[rev.length - 1];
  const metrics = { quarterEnd: latest?.end || null, derived: !!latest?.derived };
  if (latest) {
    const yearAgo = near(rev, new Date(Date.parse(latest.end) - 364 * DAY).toISOString().slice(0, 10));
    metrics.revenue = latest.val;
    metrics.revenueGrowth = yearAgo?.val > 0 ? (latest.val / yearAgo.val - 1) * 100 : null;
    const n = near(ni, latest.end, 3);
    const o = near(op, latest.end, 3);
    metrics.netMargin = n && latest.val ? (n.val / latest.val) * 100 : null;
    metrics.opMargin = o && latest.val ? (o.val / latest.val) * 100 : null;
    metrics.oneOff = !!(n && o && n.val > o.val && o.val > 0);
  }
  metrics.epsTTM = ttm(eps);
  metrics.revenueTTM = ttm(rev);
  for (const k of ['revenueGrowth', 'netMargin', 'opMargin', 'epsTTM']) metrics[k] = metrics[k] == null ? null : Math.round(metrics[k] * 100) / 100;
  return { metrics, rules: screenRules(metrics, price) };
}

// trader-screener's rules on the metrics, at today's price. Missing numbers are skipped, never guessed.
export function screenRules(metrics, price) {
  const r1 = v => (v == null ? null : `\u2066${Math.round(v * 10) / 10}\u2069`);
  const pe = metrics.epsTTM > 0 && price > 0 ? price / metrics.epsTTM : null;
  const rules = [];
  rules.push(metrics.revenueGrowth == null
    ? { id: 'growth', label: 'צמיחה בהכנסות: אין נתון', pass: null }
    : { id: 'growth', label: `הכנסות \u2066${metrics.revenueGrowth >= 0 ? '+' : ''}${Math.round(metrics.revenueGrowth * 10) / 10}%\u2069 מול הרבעון המקביל (נדרש \u20665%\u2069 ומעלה)`, pass: metrics.revenueGrowth >= 5 });
  rules.push(metrics.netMargin == null
    ? { id: 'profit', label: 'רווחיות: אין נתון', pass: null }
    : { id: 'profit', label: `רווח נקי \u2066${Math.round(metrics.netMargin * 10) / 10}%\u2069 מההכנסות${metrics.oneOff ? ' (כולל רווח חד-פעמי)' : ''}`, pass: metrics.netMargin > 0 });
  if (metrics.epsTTM != null && metrics.epsTTM <= 0) rules.push({ id: 'pe', label: 'הפסד ב-12 החודשים האחרונים', pass: false });
  else if (pe != null) rules.push({ id: 'pe', label: `מכפיל רווח ${r1(pe)} (נדרש עד 45)`, pass: pe <= 45 });
  else rules.push({ id: 'pe', label: 'מכפיל רווח: אין נתון', pass: null });
  return rules;
}

export const REVENUE_TAGS = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenuesNetOfInterestExpense'];

export async function loadFundamentals(get, ua, cik, price) {
  let revenue = [];
  for (const t of REVENUE_TAGS) {
    const facts = await secConcept(get, ua, cik, t).catch(e => { if (e.status === 404) return []; throw e; });
    const q = quarters(facts);
    if (q.length && (!revenue.length || q[q.length - 1].end > quarters(revenue).pop().end)) revenue = facts;
    if (q.length && days(q[q.length - 1].end, new Date().toISOString().slice(0, 10)) < 200) break;
  }
  const safe = t => secConcept(get, ua, cik, t).catch(e => { if (e.status === 404) return []; throw e; });
  const [netIncome, opIncome, eps] = [await safe('NetIncomeLoss'), await safe('OperatingIncomeLoss'), await safe('EarningsPerShareDiluted')];
  return fundamentals({ revenue, netIncome, opIncome, eps }, price);
}

// ---------- trader-copycat: 13F-HR ----------

export async function latest13F(get, ua, cik) {
  const sub = await secSubmissions(get, ua, cik);
  const list = recentFilings(sub, ['13F-HR']);
  return { name: sub.name, filings: list.slice(0, 2) };
}

export async function infoTable(get, ua, cik, acc) {
  const folder = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc.replace(/-/g, '')}`;
  const index = await (await get(`${folder}/index.json`, { headers: secHeaders(ua) })).json();
  const files = (index.directory?.item || []).map(x => x.name).filter(n => /\.xml$/i.test(n) && !/primary_doc/i.test(n));
  if (!files.length) throw new SourceError('no information table in the filing', 404);
  const xml = await (await get(`${folder}/${files[0]}`, { headers: secHeaders(ua) })).text();
  return parseInfoTable(xml);
}

export function parseInfoTable(xml) {
  const rows = [];
  for (const m of xml.matchAll(/<(?:[\w-]+:)?infoTable\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?infoTable>/gi)) {
    const body = m[1];
    rows.push({
      name: decodeXml(tag(body, 'nameOfIssuer')).toUpperCase(),
      cusip: decodeXml(tag(body, 'cusip')),
      value: Number(decodeXml(tag(body, 'value'))) || 0,
      shares: Number(decodeXml(tag(body, 'sshPrnamt'))) || 0,
      type: decodeXml(tag(body, 'sshPrnamtType')),
      putCall: decodeXml(tag(body, 'putCall')),
    });
  }
  return rows;
}

// Sums the rows a holding is split into (Berkshire reports one stock across subsidiaries), drops
// options and bonds, and gives each its share of the fund.
export function holdingsByIssuer(rows) {
  const by = new Map();
  let total = 0;
  for (const r of rows) {
    if (r.putCall || r.type === 'PRN') continue;
    total += r.value;
    const h = by.get(r.cusip.slice(0, 6) + r.name) || { name: r.name, cusip: r.cusip, value: 0, shares: 0 };
    h.value += r.value;
    h.shares += r.shares;
    by.set(r.cusip.slice(0, 6) + r.name, h);
  }
  return [...by.values()].map(h => ({ ...h, pct: total ? (h.value / total) * 100 : 0 })).sort((a, b) => b.value - a.value);
}

// ---------- trader-pelosi: the House Clerk's disclosure index ----------

export async function houseIndex(get, year) {
  const res = await get(`https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${year}FD.zip`);
  const files = await unzip(new Uint8Array(await res.arrayBuffer()));
  const xmlName = Object.keys(files).find(n => /\.xml$/i.test(n));
  if (!xmlName) throw new SourceError('no XML in the House index', 404);
  return parseHouseIndex(new TextDecoder().decode(files[xmlName]), year);
}

export function parseHouseIndex(xml, year) {
  const out = [];
  for (const m of xml.matchAll(/<Member>([\s\S]*?)<\/Member>/gi)) {
    const b = m[1];
    if (decodeXml(tag(b, 'FilingType')) !== 'P') continue;
    const [mo, d, y] = decodeXml(tag(b, 'FilingDate')).split('/').map(Number);
    if (!y) continue;
    const docId = decodeXml(tag(b, 'DocID'));
    const name = [decodeXml(tag(b, 'Prefix')), decodeXml(tag(b, 'First')), decodeXml(tag(b, 'Last')), decodeXml(tag(b, 'Suffix'))].filter(Boolean).join(' ');
    out.push({
      docId,
      name,
      last: decodeXml(tag(b, 'Last')),
      district: decodeXml(tag(b, 'StateDst')),
      date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      url: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${year}/${docId}.pdf`,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// A small ZIP reader (stored and deflated entries), through the central directory.
export async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (view.getUint32(p, true) === 0x06054b50) { eocd = p; break; }
  }
  if (eocd < 0) throw new SourceError('not a zip file', 422);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = {};
  for (let k = 0; k < count; k++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) out[name] = data;
    else if (method === 8) out[name] = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }
  return out;
}
