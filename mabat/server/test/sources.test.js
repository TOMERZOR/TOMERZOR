import test from 'node:test';
import assert from 'node:assert/strict';
import * as src from '../sources.js';
import { cleanDevice } from '../worker.js';
import { barsFor, yahooChartJson, conceptFacts, infoTableXml, houseXml, makeZip, rssXml } from './fixtures.js';
import { nyTime } from '../clock.js';

test('Yahoo chart: nulls skipped, the doubled live bar kept once, the live price applied', () => {
  const bars = barsFor('up', '2026-10-29', 1).slice(-30);
  const json = yahooChartJson('AAPL', bars, { name: 'Apple Inc.' });
  const r = json.chart.result[0];
  r.indicators.quote[0].close[5] = null;
  // today's bar twice: at the open and live
  const live = Math.floor(nyTime('2026-10-29', 700) / 1000);
  r.timestamp.splice(r.timestamp.length - 1, 0, Math.floor(nyTime('2026-10-29', 570) / 1000));
  for (const k of ['open', 'high', 'low', 'close', 'volume']) r.indicators.quote[0][k].splice(-1, 0, r.indicators.quote[0][k].at(-1));
  r.timestamp[r.timestamp.length - 1] = live;
  r.meta.regularMarketTime = live;
  r.meta.regularMarketPrice = 999;
  const out = src.parseChart(json);
  assert.equal(out.bars.length, 29);
  assert.equal(out.bars.at(-1).c, 999);
  assert.ok(out.bars.at(-1).h >= 999);
  assert.equal(out.meta.name, 'Apple Inc.');
});

test('Yahoo chart: a new day before its bar appears is added from the live price', () => {
  const bars = barsFor('up', '2026-10-28', 1).slice(-30);
  const json = yahooChartJson('MSFT', bars);
  json.chart.result[0].meta.regularMarketTime = Math.floor(nyTime('2026-10-29', 600) / 1000);
  json.chart.result[0].meta.regularMarketPrice = 123.45;
  const out = src.parseChart(json);
  assert.equal(out.bars.length, 31);
  assert.equal(out.bars.at(-1).c, 123.45);
});

test('Yahoo chart errors become 404s', () => {
  assert.throws(() => src.parseChart({ chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } }), e => e.status === 404);
});

test('bars pack and unpack', () => {
  const bars = barsFor('up').slice(-3);
  const back = src.unpackBars(src.packBars(bars));
  assert.equal(back.length, 3);
  assert.ok(Math.abs(back[2].c - bars[2].c) < 1e-3);
});

test('RSS headlines: CDATA, entities, tags', () => {
  const xml = rssXml('AAPL', [
    { title: 'Apple beats earnings &amp; raises guidance', link: 'https://finance.yahoo.com/news/a.html', at: Date.parse('2026-10-29T12:00:00Z') },
    { title: 'Judge rules in Apple antitrust case', link: 'https://finance.yahoo.com/news/b.html', at: Date.parse('2026-10-28T12:00:00Z') },
  ]);
  const items = src.parseRss(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Apple beats earnings & raises guidance');
  assert.deepEqual(src.tagHeadline(items[0].title), ['earnings']);
  assert.ok(src.tagHeadline(items[1].title).includes('legal'));
  assert.equal(src.decodeXml('&#x05E9;&#1500;'), 'של');
});

test('SEC submissions: newest first with 8-K items', () => {
  const sub = { cik: '320193', filings: { recent: {
    accessionNumber: ['0000320193-26-000001', '0000320193-26-000002', '0000320193-26-000003'],
    filingDate: ['2026-07-30', '2026-10-29', '2026-08-01'],
    reportDate: ['2026-07-30', '2026-10-29', '2026-06-27'],
    form: ['8-K', '8-K', '10-Q'],
    items: ['2.02,9.01', '4.02', ''],
    primaryDocument: ['a.htm', 'b.htm', 'q.htm'],
  } } };
  const list = src.recentFilings(sub, ['8-K']);
  assert.deepEqual(list.map(f => f.date), ['2026-10-29', '2026-07-30']);
  assert.deepEqual(list[1].items, ['2.02', '9.01']);
  assert.equal(list[0].url, 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000002/b.htm');
});

test('fundamentals: the fourth quarter is derived, growth is year over year, TTM sums four quarters', () => {
  const revenue = conceptFacts('revenue', { growth: 0.12, base: 10e9 });
  const netIncome = conceptFacts('net', { growth: 0.12, base: 10e9, margin: 0.2 });
  const opIncome = conceptFacts('op', { growth: 0.12, base: 10e9, margin: 0.3 });
  const eps = conceptFacts('eps', { growth: 0.12, epsBase: 1 });
  const q = src.quarters(revenue);
  assert.ok(q.some(x => x.derived && x.end === '2025-12-31'));
  const f = src.fundamentals({ revenue, netIncome, opIncome, eps }, 100);
  assert.equal(f.metrics.quarterEnd, '2026-09-30');
  assert.ok(Math.abs(f.metrics.revenueGrowth - 12) < 0.2, String(f.metrics.revenueGrowth));
  assert.ok(Math.abs(f.metrics.netMargin - 20) < 0.1);
  assert.ok(f.metrics.epsTTM > 5 && f.metrics.epsTTM < 7);
  assert.deepEqual(f.rules.map(r => r.pass), [true, true, true]);
  const pricey = src.screenRules(f.metrics, 1000);
  assert.equal(pricey.find(r => r.id === 'pe').pass, false);
  const empty = src.fundamentals({}, 100);
  assert.deepEqual(empty.rules.map(r => r.pass), [null, null, null]);
});

test('13F information table: rows summed per issuer, options and bonds dropped', () => {
  const xml = infoTableXml([
    { name: 'APPLE INC', cusip: '037833100', value: 600, shares: 60 },
    { name: 'APPLE INC', cusip: '037833100', value: 400, shares: 40 },
    { name: 'ALPHABET INC', cusip: '02079K305', value: 300, shares: 30 },
    { name: 'ALPHABET INC', cusip: '02079K107', value: 200, shares: 20 },
    { name: 'TESLA INC', cusip: '88160R101', value: 999, shares: 9, putCall: 'Put' },
  ]).replace(/<infoTable>/g, '<ns1:infoTable>').replace(/<\/infoTable>/g, '</ns1:infoTable>');
  const rows = src.parseInfoTable(xml);
  assert.equal(rows.length, 5);
  const h = src.holdingsByIssuer(rows);
  assert.equal(h.length, 2);
  assert.equal(h[0].name, 'APPLE INC');
  assert.equal(h[0].shares, 100);
  assert.ok(Math.abs(h[0].pct - 66.67) < 0.01);
});

test('13F: a company written differently between quarters is still the same holding', () => {
  const before = src.holdingsByIssuer(src.parseInfoTable(infoTableXml([{ name: 'BANK AMER CORP', cusip: '060505104', value: 100, shares: 10 }])));
  const now = src.holdingsByIssuer(src.parseInfoTable(infoTableXml([{ name: 'BANK OF AMER CORP', cusip: '060505104', value: 120, shares: 10 }])));
  assert.equal(src.issuerKey(before[0]), src.issuerKey(now[0]));
});

test('House index: unzipped, PTRs only, dates and links', async () => {
  const xml = houseXml([
    { last: 'Pelosi', first: 'Nancy', district: 'CA11', date: '2026-08-21', docId: '20035143' },
    { last: 'Smith', first: 'Jane', district: 'TX01', date: '2026-10-02', docId: '20035999' },
    { last: 'Doe', first: 'John', district: 'NY03', date: '2026-05-15', docId: '10066666', type: 'O' },
  ]);
  const zip = await makeZip({ '2026FD.txt': 'ignored', '2026FD.xml': xml });
  const files = await src.unzip(zip);
  assert.ok(files['2026FD.xml']);
  const list = src.parseHouseIndex(new TextDecoder().decode(files['2026FD.xml']), 2026);
  assert.equal(list.length, 2);
  assert.equal(list[0].last, 'Smith');
  assert.equal(list[1].date, '2026-08-21');
  assert.equal(list[1].url, 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035143.pdf');
  assert.equal(list[1].name, 'Hon. Nancy Pelosi');
});

test('device settings are checked', () => {
  const d = cleanDevice({
    subscription: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'x', auth: 'y' } },
    prefs: { minScore: 10, scope: 'watch', near: true },
    watch: ['aapl', 'AAPL', 'not a ticker', 'BRK-B'],
    positions: [{ id: 'p1', t: 'msft', entry: '410.5', stop: 390, target: '', t1: '430', setup: 'breakout', date: '2026-10-01' }, { id: 'p2', t: 'AAPL', entry: 100, setup: 'made-up', date: 'yesterday', target: 120 }, { id: '', t: 'X', entry: 1 }],
    sec: 'Jane Doe jane@example.com',
  });
  assert.equal(d.prefs.minScore, 50);
  assert.equal(d.prefs.scope, 'watch');
  assert.deepEqual(d.watch, ['AAPL', 'BRK-B']);
  assert.equal(d.positions.length, 2);
  assert.equal(d.positions[0].entry, 410.5);
  assert.equal(d.positions[0].t1, 430);
  assert.equal(d.positions[0].t2, null);
  assert.equal(d.positions[0].setup, 'breakout');
  assert.equal(d.positions[1].setup, null);
  assert.equal(d.positions[1].date, null);
  assert.equal(d.positions[1].t2, 120); // an older app's single target becomes target 2
  assert.equal(d.sec, 'Jane Doe jane@example.com');
  assert.throws(() => cleanDevice({ subscription: { endpoint: 'https://evil.example.com/x', keys: { p256dh: 'a', auth: 'b' } } }));
  assert.equal(cleanDevice({ sec: 'nope' }).sec, '');
});

test('Stooq CSV as the fallback for daily bars', () => {
  const csv = 'Date,Open,High,Low,Close,Volume\n2026-10-28,10,11,9.5,10.5,1000\n2026-10-29,10.5,12,10,11.8,2500\nbad,row\n';
  const out = src.parseStooq(csv, 'AAPL');
  assert.equal(out.bars.length, 2);
  assert.equal(out.bars[1].c, 11.8);
  assert.throws(() => src.parseStooq('No data', 'X'), e => e.status === 404);
});

test('the chart reader falls back to Stooq when Yahoo refuses', async () => {
  const calls = [];
  const get = async url => {
    calls.push(new URL(url).host);
    if (url.includes('yahoo')) throw new src.SourceError('query answered 429', 429);
    return new Response('Date,Open,High,Low,Close,Volume\n2026-10-29,1,2,0.5,1.5,100\n');
  };
  const out = await src.yahooChart(get, 'AAPL');
  assert.equal(out.source, 'stooq');
  assert.deepEqual(calls, ['query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'stooq.com']);
  const unknown = async () => { throw new src.SourceError('nope', 404); };
  await assert.rejects(src.yahooChart(unknown, 'NOPE'), e => e.status === 404);
});
