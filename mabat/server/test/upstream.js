// A local stand-in for Yahoo Finance, SEC EDGAR, the House Clerk and Apple's push service, for
// running the real worker end to end without the internet:
//
//   node test/upstream.js 8799
//   npx wrangler dev --var DEV:1 --var UPSTREAM:http://127.0.0.1:8799
//
// POST /__set {"shapes": {"AAPL": "breakout"}, "pelosi": "20035999", "end": "2026-10-29"} changes the market.
// GET  /__pushes lists the pushes received, decrypted with the test phone's key.

import http from 'node:http';
import { webcrypto as crypto } from 'node:crypto';
import { barsFor, yahooChartJson, conceptFacts, infoTableXml, houseXml, makeZip, rssXml, seedOf } from './fixtures.js';
import { UNIVERSE } from '../universe.js';

const port = Number(process.argv[2] || 8799);
const state = {
  end: process.env.MOCK_END || '2026-10-29',
  shapes: { SPY: 'up', QQQ: 'up', AAPL: 'near', NVDA: 'breakout', MSFT: 'pullback', TSLA: 'downtrend', META: 'extended', AMZN: 'up' },
  pelosi: [],
  pushes: [],
  calls: {},
};
const cikOf = t => 2000 + UNIVERSE.findIndex(u => u.t === t);
const tickerOfCik = cik => UNIVERSE[cik - 2000]?.t;
const FUND_NAMES = { 1067983: 'BERKSHIRE HATHAWAY INC', 1336528: 'Pershing Square Capital Management, L.P.', 1536411: 'Duquesne Family Office LLC', 1656456: 'Appaloosa LP', 1040273: 'THIRD POINT LLC', 1350694: 'Bridgewater Associates, LP' };

// The test phone's push keys (P-256 and a 16-byte auth secret).
const phone = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const phonePublic = new Uint8Array(await crypto.subtle.exportKey('raw', phone.publicKey));
const auth = crypto.getRandomValues(new Uint8Array(16));
const b64u = b => Buffer.from(b).toString('base64url');
export const subscription = { endpoint: 'https://web.push.apple.com/test-phone', keys: { p256dh: b64u(phonePublic), auth: b64u(auth) } };

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
async function decrypt(body) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const cipher = body.subarray(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, phone.privateKey, 256));
  const enc = new TextEncoder();
  const ikm = await hkdf(auth, shared, Buffer.concat([enc.encode('WebPush: info\0'), phonePublic, asPublic]), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  return JSON.parse(new TextDecoder().decode(plain.subarray(0, plain.lastIndexOf(2))));
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type });
  res.end(typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body));
};
const readBody = req => new Promise(resolve => { const parts = []; req.on('data', c => parts.push(c)); req.on('end', () => resolve(Buffer.concat(parts))); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  const host = path.split('/')[1];
  state.calls[host] = (state.calls[host] || 0) + 1;
  try {
    if (path === '/__set' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      if (body.shapes) Object.assign(state.shapes, body.shapes);
      if (body.end) state.end = body.end;
      if (body.pelosi) state.pelosi.push(body.pelosi);
      return send(res, 200, { ok: true });
    }
    if (path === '/__pushes') return send(res, 200, state.pushes);
    if (path === '/__subscription') return send(res, 200, subscription);
    if (path === '/__calls') return send(res, 200, state.calls);

    if (host === 'web.push.apple.com') {
      const body = await readBody(req);
      if (!/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/.test(req.headers.authorization || '')) return send(res, 403, { reason: 'BadJwtToken' });
      state.pushes.push({ headers: { ttl: req.headers.ttl, topic: req.headers.topic, urgency: req.headers.urgency }, message: await decrypt(new Uint8Array(body)) });
      return send(res, 201, '');
    }

    let m = path.match(/^\/query[12]\.finance\.yahoo\.com\/v8\/finance\/chart\/([^/]+)$/);
    if (m) {
      const t = decodeURIComponent(m[1]);
      if (t === 'NOPE') return send(res, 404, { chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } });
      const shape = state.shapes[t] || ['up', 'flat', 'near', 'downtrend', 'up'][seedOf(t) % 5];
      const base = 20 + (seedOf(t) % 400);
      const bars = barsFor(shape, state.end, seedOf(t) % 3 + 1, base);
      const u = UNIVERSE.find(x => x.t === t);
      return send(res, 200, yahooChartJson(t, bars, { name: u ? `${u.name} Inc.` : `${t} Corp`, type: u?.sector === 'etf' ? 'ETF' : 'EQUITY' }));
    }
    if (path.startsWith('/query1.finance.yahoo.com/v1/finance/search')) {
      const q = (url.searchParams.get('q') || '').toUpperCase();
      return send(res, 200, { quotes: [
        { symbol: q.slice(0, 4), shortname: `${q} Corp`, longname: `${q} Corporation`, quoteType: 'EQUITY', exchange: 'NMS', exchDisp: 'NASDAQ' },
        { symbol: `${q.slice(0, 3)}.TA`, shortname: 'Tel Aviv listing', quoteType: 'EQUITY', exchange: 'TLV' },
      ] });
    }
    m = path.match(/^\/feeds\.finance\.yahoo\.com\/rss\/2\.0\/headline$/);
    if (m) {
      const t = url.searchParams.get('s');
      return send(res, 200, rssXml(t, [
        { title: `${t} beats quarterly earnings estimates`, link: `https://finance.yahoo.com/news/${t.toLowerCase()}-earnings.html`, at: Date.now() - 3600e3 },
        { title: `Analyst upgrades ${t} with a new price target`, link: `https://finance.yahoo.com/news/${t.toLowerCase()}-upgrade.html`, at: Date.now() - 7200e3 },
      ]), 'application/rss+xml');
    }
    if (path === '/www.sec.gov/files/company_tickers.json') {
      if (!/@/.test(req.headers['user-agent'] || '')) return send(res, 403, 'Undeclared automated tool');
      const out = {};
      UNIVERSE.filter(u => u.sector !== 'etf').forEach((u, k) => { out[k] = { cik_str: cikOf(u.t), ticker: u.t, title: `${u.name} Inc.` }; });
      return send(res, 200, out);
    }
    m = path.match(/^\/data\.sec\.gov\/submissions\/CIK(\d{10})\.json$/);
    if (m) {
      const cik = Number(m[1]);
      if (FUND_NAMES[cik]) {
        return send(res, 200, { cik: String(cik), name: FUND_NAMES[cik], filings: { recent: {
          accessionNumber: [`0000${cik}-26-000002`, `0000${cik}-26-000001`], filingDate: ['2026-08-14', '2026-05-15'], reportDate: ['2026-06-30', '2026-03-31'],
          form: ['13F-HR', '13F-HR'], items: ['', ''], primaryDocument: ['primary_doc.xml', 'primary_doc.xml'],
        } } });
      }
      const t = tickerOfCik(cik);
      if (!t) return send(res, 404, 'no such company');
      const serious = t === 'TSLA';
      return send(res, 200, { cik: String(cik), name: `${t} Inc.`, filings: { recent: {
        accessionNumber: [`0000${cik}-26-000010`, `0000${cik}-26-000009`], filingDate: [serious ? state.end : '2026-10-23', '2026-08-01'], reportDate: ['', '2026-06-30'],
        form: ['8-K', '10-Q'], items: [serious ? '4.02' : '2.02,9.01', ''], primaryDocument: ['ex99.htm', 'q.htm'],
      } } });
    }
    m = path.match(/^\/data\.sec\.gov\/api\/xbrl\/companyconcept\/CIK(\d{10})\/us-gaap\/(\w+)\.json$/);
    if (m) {
      const [, , tagName] = m;
      const kinds = { RevenueFromContractWithCustomerExcludingAssessedTax: 'revenue', NetIncomeLoss: 'net', OperatingIncomeLoss: 'op', EarningsPerShareDiluted: 'eps' };
      const kind = kinds[tagName];
      if (!kind) return send(res, 404, 'no such concept');
      const facts = conceptFacts(kind, { growth: 0.1, base: 5e9, margin: kind === 'net' ? 0.18 : 0.25, epsBase: 0.9 });
      return send(res, 200, { tag: tagName, units: kind === 'eps' ? { 'USD/shares': facts } : { USD: facts } });
    }
    m = path.match(/^\/www\.sec\.gov\/Archives\/edgar\/data\/(\d+)\/(\d+)\/index\.json$/);
    if (m) return send(res, 200, { directory: { name: path, item: [{ name: 'primary_doc.xml' }, { name: 'infotable.xml' }, { name: 'index.html' }] } });
    m = path.match(/^\/www\.sec\.gov\/Archives\/edgar\/data\/(\d+)\/(\d+)\/infotable\.xml$/);
    if (m) {
      const latest = m[2].endsWith('2');
      return send(res, 200, infoTableXml([
        { name: 'APPLE INC', cusip: '037833100', value: 600000, shares: latest ? 300 : 400 },
        { name: 'AMERICAN EXPRESS CO', cusip: '025816109', value: 300000, shares: 150 },
        { name: 'NVIDIA CORPORATION', cusip: '67066G104', value: 200000, shares: latest ? 120 : 100 },
        ...(latest ? [{ name: 'ALPHABET INC', cusip: '02079K305', value: 100000, shares: 50 }] : [{ name: 'KRAFT HEINZ CO', cusip: '500754106', value: 50000, shares: 500 }]),
      ]), 'text/xml');
    }
    m = path.match(/^\/disclosures-clerk\.house\.gov\/public_disc\/financial-pdfs\/(\d{4})FD\.zip$/);
    if (m) {
      const day = state.end;
      const members = [
        { last: 'Pelosi', first: 'Nancy', district: 'CA11', date: '2026-10-02', docId: '20035553' },
        { last: 'Smith', first: 'Jane', district: 'TX01', date: day, docId: '20036001' },
        ...state.pelosi.map(docId => ({ last: 'Pelosi', first: 'Nancy', district: 'CA11', date: day, docId })),
      ];
      return send(res, 200, await makeZip({ [`${m[1]}FD.txt`]: 'x', [`${m[1]}FD.xml`]: houseXml(members) }), 'application/zip');
    }
    send(res, 404, { error: `no stand-in for ${path}` });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(port, '127.0.0.1', () => console.log(`upstream stand-in on http://127.0.0.1:${port}`));
