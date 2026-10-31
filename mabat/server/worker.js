// Mabat market server (Cloudflare Worker). Scans the market all the time, so the app can say when
// a stock has an entry setup and ring the phone even when the app is closed.
//
// One Durable Object ("market") holds everything: the daily bars and the latest analysis of every
// tracked stock, the other skills' findings, the event feed and the phones' push subscriptions.
// A cron trigger wakes it every minute. Each minute it refreshes the stocks whose data is oldest
// (about every 6 minutes per stock while the market is open), then does up to two slower jobs:
// SEC filings, fundamentals, fund holdings, Congress reports and headlines.
//
// Routes:
//   GET    /health
//   GET    /board              every tracked stock, the market clock, the feed, funds and Congress
//   GET    /t/<TICKER>         one stock: bars, indicators, the analysis, fundamentals, news, filings
//   GET    /search?q=          find a US stock or ETF by name or ticker
//   GET    /d/<id>/key         the VAPID public key to subscribe with
//   GET    /d/<id>             this phone's alerts inbox (stops and targets of its positions)
//   PUT    /d/<id>             { subscription, prefs, watch, positions, sec }
//   POST   /d/<id>/test        send a test notification
//   DELETE /d/<id>             forget this phone
//   POST   /tick               run one scan now (only with the DEV variable, for tests)

import { marketState, nyParts, closeMinutes } from './clock.js';
import { analyze, chartSeries, SETUPS } from './signals.js';
import { manage, PLAYBOOK } from './plans.js';
import * as src from './sources.js';
import { UNIVERSE, UNIVERSE_TICKERS, byTicker, FUNDS, WATCHED_MEMBERS, matchIssuer } from './universe.js';
import { vapidKeys, sendPush, PUSH_HOSTS } from './push.js';

const PER_TICK = 8;
const MAX_TRACKED = 90;
const MAX_WATCH = 30;
const MAX_POSITIONS = 30;
const MAX_BODY = 32 * 1024;
const SUBREQUEST_BUDGET = 38;
const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const STALE = { open: 4 * MIN, pre: 15 * MIN, post: 10 * MIN, closed: 3 * HOUR };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });

const money = v => (v == null ? '' : `$${v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)}`);
const ageDays = (date, now) => Math.floor((now - Date.parse(`${date}T12:00:00Z`)) / DAY);
const isEtf = t => byTicker[t]?.sector === 'etf';

// ---------- Input checks ----------

const DEVICE_ID = /^[A-Za-z0-9_-]{22,43}$/;

const price = v => (v == null || v === '' || !(Number(v) > 0) ? null : Number(v));

export function cleanDevice(body) {
  if (!body || typeof body !== 'object') throw new Error('bad body');
  const out = {};
  if (body.subscription) {
    const s = body.subscription;
    let host;
    try { host = new URL(s.endpoint).hostname; } catch { throw new Error('bad endpoint'); }
    if (!s.endpoint.startsWith('https://') || !PUSH_HOSTS.some(re => re.test(host))) throw new Error('unknown push service');
    if (typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') throw new Error('bad keys');
    out.subscription = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  }
  const p = body.prefs || {};
  out.prefs = {
    entries: p.entries !== false,
    near: p.near === true,
    scope: p.scope === 'watch' ? 'watch' : 'all',
    minScore: Math.min(95, Math.max(50, Math.round(Number(p.minScore) || 70))),
    bell: p.bell === true,
    news: p.news !== false,
    congress: p.congress !== false,
    positions: p.positions !== false,
  };
  out.watch = [...new Set((Array.isArray(body.watch) ? body.watch : []).map(t => String(t).toUpperCase()).filter(t => src.TICKER.test(t)))].slice(0, MAX_WATCH);
  out.positions = (Array.isArray(body.positions) ? body.positions : []).slice(0, MAX_POSITIONS).map(x => ({
    id: String(x.id || '').slice(0, 24),
    t: String(x.t || '').toUpperCase(),
    entry: Number(x.entry),
    stop: price(x.stop),
    t1: price(x.t1),
    t2: price(x.t2) ?? price(x.target),
    level: price(x.level),
    setup: PLAYBOOK[x.setup] ? x.setup : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : null,
  })).filter(x => x.id && src.TICKER.test(x.t) && x.entry > 0);
  const sec = typeof body.sec === 'string' ? body.sec.trim().slice(0, 120) : '';
  out.sec = /\S+\s+\S+@\S+\.\S+/.test(sec) ? sec : '';
  return out;
}

// ---------- The market Durable Object ----------

export class Market {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.storage = ctx.storage;
    this.env = env;
    this.peek = new Map(); // stocks looked up but not tracked: { at, data }
    // Tests send pushes to the local stand-in too.
    this.sender = env.UPSTREAM ? (u, init) => fetch(`${env.UPSTREAM}/${u.replace(/^https:\/\//, '')}`, init) : (u, init) => fetch(u, init);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/health') return json(await this.health());
      if (path === '/board') return json(await this.board(), 200, { 'Cache-Control': 'public, max-age=15' });
      if (path === '/tick-cron') return json(await this.tick());
      if (path === '/tick' && request.method === 'POST') {
        if (!this.env.DEV) return json({ error: 'not found' }, 404);
        return json(await this.tick(Number(url.searchParams.get('now')) || Date.now(), true));
      }
      if (path === '/search') {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 40);
        if (!q) return json({ results: [] });
        return json({ results: await src.yahooSearch(src.makeFetch(this.env), q) }, 200, { 'Cache-Control': 'public, max-age=300' });
      }
      let m = path.match(/^\/t\/([A-Za-z0-9.-]{1,10})$/);
      if (m && request.method === 'GET') return json(await this.detail(m[1].toUpperCase()), 200, { 'Cache-Control': 'public, max-age=20' });
      m = path.match(/^\/d\/([A-Za-z0-9_-]{22,43})(\/key|\/test)?$/);
      if (m) return this.device(request, m[1], m[2]);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: e.message || 'error' }, e.status && e.status < 500 ? e.status : 500);
    }
  }

  // ---------- Devices ----------

  async device(request, id, sub) {
    const key = `dev:${id}`;
    if (sub === '/key' && request.method === 'GET') return json({ key: (await vapidKeys(this.storage)).publicKey });
    if (sub === '/test' && request.method === 'POST') {
      const dev = await this.storage.get(key);
      if (!dev?.subscription) return json({ error: 'no subscription' }, 409);
      const status = await sendPush(dev.subscription, await vapidKeys(this.storage), {
        type: 'test', title: 'מבט', body: 'ככה ייראו ההתראות. הכל עובד ✓', topic: 'test',
      }, this.sender);
      return json({ ok: status < 300, status }, status < 300 ? 200 : 502);
    }
    if (sub) return json({ error: 'not found' }, 404);
    if (request.method === 'GET') {
      const dev = await this.storage.get(key);
      return json({ inbox: dev?.inbox || [], push: !!dev?.subscription, positions: await this.managed(dev?.positions || []) });
    }
    if (request.method === 'DELETE') {
      await this.storage.delete(key);
      const ids = (await this.storage.get('devices')) || [];
      await this.storage.put('devices', ids.filter(x => x !== id));
      return json({ ok: true });
    }
    if (request.method !== 'PUT') return json({ error: 'not found' }, 404);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: 'too big' }, 413);
    let body;
    try { body = cleanDevice(JSON.parse(text)); } catch (e) { return json({ error: e.message }, 400); }
    const prev = (await this.storage.get(key)) || {};
    const dev = { ...prev, ...body, subscription: body.subscription || prev.subscription || null, inbox: prev.inbox || [], seen: Date.now() };
    await this.storage.put(key, dev);
    const ids = (await this.storage.get('devices')) || [];
    if (!ids.includes(id)) await this.storage.put('devices', [...ids, id].slice(-50));
    return json({ ok: true, inbox: dev.inbox, push: !!dev.subscription });
  }

  // Where each position stands against its plan, from the stored bars.
  async managed(positions) {
    if (!positions.length) return {};
    const tickers = [...new Set(positions.map(p => p.t))];
    const stored = await this.storage.get(tickers.map(t => `bars:${t}`));
    const out = {};
    for (const p of positions) {
      const rec = stored.get(`bars:${p.t}`);
      if (rec?.bars?.length > 20) out[p.id] = manage(p, src.unpackBars(rec.bars));
    }
    return out;
  }

  async devices() {
    const ids = (await this.storage.get('devices')) || [];
    if (!ids.length) return [];
    const map = await this.storage.get(ids.map(id => `dev:${id}`));
    return ids.map(id => ({ id, ...(map.get(`dev:${id}`) || {}) })).filter(d => d.prefs);
  }

  async secAgent(devices) {
    if (this.env.SEC_USER_AGENT) return this.env.SEC_USER_AGENT;
    return devices.filter(d => d.sec).sort((a, b) => (b.seen || 0) - (a.seen || 0))[0]?.sec || '';
  }

  tracked(devices) {
    const extra = new Set();
    for (const d of devices) {
      for (const t of d.watch || []) extra.add(t);
      for (const p of d.positions || []) extra.add(p.t);
    }
    return [...new Set([...UNIVERSE_TICKERS, ...extra])].slice(0, MAX_TRACKED);
  }

  // ---------- The scan ----------

  async tick(now = Date.now(), force = false) {
    const last = await this.storage.get('tickAt');
    if (!force && last && now - last < 40000 && now >= last) return { skipped: true };
    await this.storage.put('tickAt', now);

    const mkt = marketState(now);
    const counter = { n: 0 };
    const get = src.makeFetch(this.env, counter);
    const health = (await this.storage.get('health')) || {};
    const devices = await this.devices();
    const tickers = this.tracked(devices);
    const scan = (await this.storage.get('scan')) || {};
    const stale = STALE[mkt.session];

    let due = tickers.filter(t => now - (scan[t] || 0) >= stale).sort((a, b) => (scan[a] || 0) - (scan[b] || 0));
    if (due.includes('SPY')) due = ['SPY', ...due.filter(t => t !== 'SPY')];
    const batch = due.slice(0, PER_TICK);

    const events = [];
    const ring = (await this.storage.get('rang')) || {};
    const rang = (key, within) => ring[key] && now - ring[key] < within;
    const mark = key => { ring[key] = now; };

    const ctxBase = await this.contextBase(now);
    const prevSigs = batch.length ? await this.storage.get(batch.map(t => `sig:${t}`)) : new Map();
    const fresh = {};
    const freshBars = {};
    for (const t of batch) {
      try {
        const chart = await src.yahooChart(get, t);
        const ctx = await this.contextFor(t, ctxBase, chart.bars, mkt, now);
        const sig = this.summarize(t, chart, analyze(chart.bars, ctx), now);
        if (t === 'SPY') ctxBase.spy = spyContext(sig);
        await this.storage.put({ [`bars:${t}`]: { meta: chart.meta, bars: src.packBars(chart.bars.slice(-460)), at: now }, [`sig:${t}`]: sig });
        fresh[t] = sig;
        freshBars[t] = chart.bars;
        scan[t] = now;
        health.yahoo = { ok: true, at: now, source: chart.source };

        const prev = prevSigs.get(`sig:${t}`);
        if (prev && sig.status === 'enter' && prev.status !== 'enter' && !rang(`enter:${t}:${sig.setup}`, 3 * DAY)) {
          mark(`enter:${t}:${sig.setup}`);
          events.push({
            type: 'enter', t, score: sig.score,
            title: `כניסה: ${t} ${money(sig.price)}`,
            body: `${SETUPS[sig.setup]} · ציון ${sig.score}\nסטופ ${money(sig.levels.stop)} · יעד 1 ${money(sig.levels.t1)} · יעד 2 ${money(sig.levels.t2)}`,
          });
        } else if (prev && sig.status === 'near' && prev.status === 'hold' && !rang(`near:${t}`, 2 * DAY)) {
          mark(`near:${t}`);
          events.push({ type: 'near', t, score: sig.score, title: `קרוב לכניסה: ${t}`, body: `טריגר מעל ${money(sig.levels.trigger)} (עוד ${sig.levels.distPct}%)` });
        }
      } catch (e) {
        // A ticker Yahoo doesn't know waits a day; anything else is retried in a minute.
        scan[t] = e.status === 404 ? now + DAY - stale : now - stale + MIN;
        health.yahoo = { ok: false, at: now, error: e.message };
      }
    }

    // Opening bell (trader-alerts): once per trading day.
    if (mkt.open && (await this.storage.get('bell')) !== mkt.date) {
      await this.storage.put('bell', mkt.date);
      events.push({ type: 'bell', title: 'הפעמון צלצל: הבורסה בניו יורק נפתחה', body: mkt.earlyClose ? 'היום נסגרים מוקדם, ב-13:00 שעון ניו יורק' : 'המסחר פתוח עד 16:00 שעון ניו יורק', quiet: true });
    }

    // Slower jobs, up to two a minute, while the subrequest budget lasts.
    const ua = await this.secAgent(devices);
    health.sec = ua ? health.sec || { ok: null } : { ok: false, error: 'needs-contact' };
    const jobs = ['cik', 'filings', 'news', 'fund', '13f', 'congress'];
    let cursor = ((await this.storage.get('jobCursor')) || 0) % jobs.length;
    let ran = 0;
    for (let k = 0; k < jobs.length && ran < 2 && counter.n < SUBREQUEST_BUDGET - 8; k++) {
      const job = jobs[(cursor + k) % jobs.length];
      try {
        const did = await this.job(job, { get, ua, now, mkt, devices, tickers, events, rang, mark, health });
        if (did) ran++;
      } catch (e) {
        const which = job === 'news' ? 'news' : job === 'congress' ? 'house' : 'sec';
        health[which] = { ok: false, at: now, error: e.message };
      }
      if (ran) cursor = (cursor + k + 1) % jobs.length;
    }
    await this.storage.put('jobCursor', cursor);

    // Each phone's positions, managed by their plan (trader-alerts: each alert rings once):
    // target 1 (sell half, stop to the entry), target 2, and the exit (stop, trailing stop,
    // a failed setup, the time stop).
    const personal = [];
    for (const d of devices) {
      if (d.prefs?.positions === false) continue;
      for (const p of d.positions || []) {
        if (!freshBars[p.t]) continue;
        const m = manage(p, freshBars[p.t]);
        const key = kind => `pos:${d.id}:${p.id}:${kind}`;
        const say = (kind, ev) => { if (!rang(key(kind), 60 * DAY)) { mark(key(kind)); personal.push({ dev: d, ev: { t: p.t, ...ev } }); } };
        if (m.exit) {
          say('exit', {
            type: m.exit === 'stop' ? 'stop' : 'exit',
            title: m.exit === 'stop' ? `${p.t} הגיעה לסטופ ${money(m.stopNow)}` : `סימן יציאה ב-${p.t}`,
            body: `${m.exitText}. המחיר ${money(m.price)}. זו התראה בלבד: שום דבר לא נמכר.`,
          });
        } else if (m.t2Hit) {
          say('t2', { type: 't2', title: `${p.t} הגיעה ליעד 2 ${money(m.t2)}`, body: `מוכרים את השאר, או ממשיכים עם סטופ נגרר ב-${money(m.stopNow)}.` });
        } else if (m.t1Hit) {
          say('t1', { type: 't1', title: `${p.t} הגיעה ליעד 1 ${money(m.t1)}`, body: `לפי התוכנית: מוכרים חצי ומזיזים את הסטופ לנקודת הכניסה (${money(p.entry)}).` });
        }
      }
    }

    for (const key of Object.keys(ring)) if (now - ring[key] > 40 * DAY) delete ring[key];
    await this.storage.put({ scan, health, rang: ring, lastTick: now });

    const stamped = events.map((e, k) => ({ ...e, id: `${now.toString(36)}${k}`, at: now }));
    if (stamped.some(e => !e.quiet)) {
      const feed = (await this.storage.get('feed')) || [];
      await this.storage.put('feed', [...stamped.filter(e => !e.quiet).reverse(), ...feed].slice(0, 150));
    }
    const pushed = await this.deliver(stamped, personal.map((x, k) => ({ ...x, ev: { ...x.ev, id: `${now.toString(36)}p${k}`, at: now } })), devices, counter);
    return { session: mkt.session, refreshed: Object.keys(fresh), due: due.length, events: stamped.length + personal.length, pushed, subrequests: counter.n };
  }

  async contextBase(now) {
    const [spy, holders] = [await this.storage.get('sig:SPY'), await this.storage.get('holders')];
    return { spy: spy ? spyContext(spy) : null, holders: holders?.byTicker || {}, now };
  }

  async contextFor(t, base, bars, mkt, now) {
    const [fund, filings] = [await this.storage.get(`fund:${t}`), await this.storage.get(`filings:${t}`)];
    const lastDate = nyParts(bars[bars.length - 1].t * 1000).date;
    let partial = 1;
    if (mkt.open && lastDate === mkt.date) {
      const minutes = nyParts(now).minutes;
      partial = (minutes - 570) / (closeMinutes(mkt.date) - 570);
    }
    const price = bars[bars.length - 1].c;
    return {
      partial,
      spy: t === 'SPY' ? null : base.spy,
      fundamentals: fund?.metrics ? { rules: src.screenRules(fund.metrics, price) } : null,
      holders: base.holders[t] || [],
      filings: (filings?.list || []).map(f => ({ ...f, ageDays: ageDays(f.date, now) })),
    };
  }

  summarize(t, chart, a, now) {
    const u = byTicker[t];
    return {
      t,
      name: u?.name || chart.meta.name,
      sector: u?.sector || (chart.meta.type === 'ETF' ? 'etf' : 'other'),
      currency: chart.meta.currency,
      exchange: chart.meta.exchange,
      ...a,
      setupName: a.setup ? SETUPS[a.setup] : null,
      spark: chart.bars.slice(-60).map(b => Math.round(b.c * 100) / 100),
      barTime: chart.meta.time,
      at: now,
    };
  }

  // ---------- The slower jobs ----------

  async job(name, s) {
    const { get, ua, now, mkt, devices, tickers, events, rang, mark, health } = s;
    const watched = new Set(devices.flatMap(d => [...(d.watch || []), ...(d.positions || []).map(p => p.t)]));

    if (name === 'cik') {
      if (!ua) return false;
      const map = await this.storage.get('cik');
      if (map && now - map.at < 7 * DAY && tickers.every(t => isEtf(t) || t in map.ciks || (map.missing || []).includes(t))) return false;
      const all = await src.secTickerMap(get, ua);
      const ciks = {};
      const missing = [];
      for (const t of tickers) if (!isEtf(t)) { if (all[t]) ciks[t] = all[t]; else missing.push(t); }
      await this.storage.put('cik', { ciks, missing, at: now });
      health.sec = { ok: true, at: now };
      return true;
    }

    if (name === 'filings' || name === 'fund') {
      if (!ua) return false;
      const ciks = (await this.storage.get('cik'))?.ciks || {};
      const candidates = tickers.filter(t => ciks[t]);
      if (!candidates.length) return false;
      const prefix = name === 'filings' ? 'filings:' : 'fund:';
      const stored = await this.storage.get(candidates.map(t => prefix + t));
      const sigs = await this.storage.get(candidates.map(t => `sig:${t}`));
      const hot = t => watched.has(t) || ['enter', 'near'].includes(sigs.get(`sig:${t}`)?.status);
      const maxAge = t => (name === 'fund' ? 7 * DAY : hot(t) ? 6 * HOUR : DAY);
      const pick = candidates
        .filter(t => now - (stored.get(prefix + t)?.at || 0) > maxAge(t))
        .sort((a, b) => (hot(b) - hot(a)) || ((stored.get(prefix + a)?.at || 0) - (stored.get(prefix + b)?.at || 0)))[0];
      if (!pick) return false;

      if (name === 'fund') {
        const price = sigs.get(`sig:${pick}`)?.price;
        const f = await src.loadFundamentals(get, ua, ciks[pick], price);
        await this.storage.put(`fund:${pick}`, { ...f, at: now });
      } else {
        const sub = await src.secSubmissions(get, ua, ciks[pick]);
        const list = src.recentFilings(sub, ['8-K', '10-Q', '10-K']).slice(0, 12)
          .map(f => ({ form: f.form, date: f.date, items: f.items, url: f.url, acc: f.acc }));
        const prev = stored.get(`filings:${pick}`);
        if (prev && watched.has(pick)) {
          const known = new Set((prev.list || []).map(f => f.acc));
          for (const f of list) {
            const important = f.items.filter(it => src.IMPORTANT_ITEMS.has(it));
            if (known.has(f.acc) || f.form !== '8-K' || !important.length || ageDays(f.date, now) > 3 || rang(`8k:${f.acc}`, 30 * DAY)) continue;
            mark(`8k:${f.acc}`);
            events.push({ type: 'filing', t: pick, title: `${pick}: דיווח \u20668-K\u2069 חדש`, body: important.map(it => src.ITEM_NAMES[it] || it).join(', '), url: f.url });
          }
        }
        await this.storage.put(`filings:${pick}`, { list, at: now });
      }
      health.sec = { ok: true, at: now };
      return true;
    }

    if (name === 'news') {
      const sigs = await this.storage.get(tickers.map(t => `sig:${t}`));
      const hot = tickers.filter(t => watched.has(t) || ['enter', 'near'].includes(sigs.get(`sig:${t}`)?.status));
      const list = [...new Set([...hot, ...tickers.filter(t => !isEtf(t))])];
      const stored = await this.storage.get(list.map(t => `news:${t}`));
      const maxAge = t => (hot.includes(t) ? (mkt.open ? 30 * MIN : 2 * HOUR) : 12 * HOUR);
      const pick = list.find(t => now - (stored.get(`news:${t}`)?.at || 0) > maxAge(t));
      if (!pick) return false;
      const items = await src.headlines(get, pick);
      await this.storage.put(`news:${pick}`, { items, at: now });
      health.news = { ok: true, at: now };
      return true;
    }

    if (name === '13f') {
      if (!ua) return false;
      const stored = await this.storage.get(FUNDS.map(f => `f13:${f.cik}`));
      const fund = FUNDS.filter(f => now - (stored.get(`f13:${f.cik}`)?.at || 0) > DAY)
        .sort((a, b) => (stored.get(`f13:${a.cik}`)?.at || 0) - (stored.get(`f13:${b.cik}`)?.at || 0))[0];
      if (!fund) return false;
      const prev = stored.get(`f13:${fund.cik}`);
      const { name: secName, filings } = await src.latest13F(get, ua, fund.cik);
      if (!String(secName || '').toUpperCase().includes(fund.check)) {
        await this.storage.put(`f13:${fund.cik}`, { at: now, ok: false, error: `CIK ${fund.cik} is ${secName}` });
        return true;
      }
      if (!filings.length) { await this.storage.put(`f13:${fund.cik}`, { at: now, ok: false, error: 'no 13F-HR' }); return true; }
      // v2: holdings matched by CUSIP; older records are read again once.
      if (prev?.ok && prev.v === 2 && prev.acc === filings[0].acc) { await this.storage.put(`f13:${fund.cik}`, { ...prev, at: now }); return true; }
      const nowRows = src.holdingsByIssuer(await src.infoTable(get, ua, fund.cik, filings[0].acc));
      const beforeRows = filings[1] ? src.holdingsByIssuer(await src.infoTable(get, ua, fund.cik, filings[1].acc)) : [];
      const before = new Map(beforeRows.map(h => [src.issuerKey(h), h]));
      const holdings = nowRows.slice(0, 60).map(h => {
        const b = before.get(src.issuerKey(h));
        const change = !beforeRows.length ? null : !b ? 'new' : h.shares > b.shares * 1.01 ? 'added' : h.shares < b.shares * 0.99 ? 'trimmed' : 'same';
        return { name: h.name, t: matchIssuer(h.name), pct: Math.round(h.pct * 100) / 100, shares: h.shares, change };
      });
      const sold = beforeRows.length ? beforeRows.filter(b => !nowRows.some(h => src.issuerKey(h) === src.issuerKey(b))).slice(0, 10).map(b => ({ name: b.name, t: matchIssuer(b.name) })) : [];
      await this.storage.put(`f13:${fund.cik}`, {
        at: now, ok: true, v: 2, acc: filings[0].acc, period: filings[0].period, filed: filings[0].date,
        url: `https://www.sec.gov/Archives/edgar/data/${fund.cik}/${filings[0].acc.replace(/-/g, '')}/`, holdings, sold,
      });
      await this.rebuildHolders();
      health.sec = { ok: true, at: now };
      return true;
    }

    if (name === 'congress') {
      const prev = await this.storage.get('congress');
      if (prev && now - prev.at < HOUR) return false;
      const { date } = mkt;
      const year = Number(date.slice(0, 4));
      let list = await src.houseIndex(get, year).catch(e => { if (e.status === 404) return []; throw e; });
      if (date.slice(5, 7) === '01') list = [...list, ...(await src.houseIndex(get, year - 1).catch(() => []))];
      const recent = list.filter(x => ageDays(x.date, now) <= 60);
      if (prev) {
        const seen = new Set(prev.seen || []);
        for (const x of recent) {
          if (seen.has(x.docId) || !WATCHED_MEMBERS.some(m => x.last.toLowerCase() === m.toLowerCase())) continue;
          if (rang(`ptr:${x.docId}`, 90 * DAY)) continue;
          mark(`ptr:${x.docId}`);
          events.push({ type: 'congress', title: `דיווח מסחר חדש: ${x.name}`, body: `הוגש ב-${x.date}. דיווח ציבורי, עד 45 יום אחרי העסקה עצמה.`, url: x.url });
        }
      }
      await this.storage.put('congress', { at: now, list: recent.slice(0, 40), seen: recent.map(x => x.docId) });
      health.house = { ok: true, at: now };
      return true;
    }
    return false;
  }

  async rebuildHolders() {
    const stored = await this.storage.get(FUNDS.map(f => `f13:${f.cik}`));
    const byTickerMap = {};
    const funds = [];
    for (const f of FUNDS) {
      const d = stored.get(`f13:${f.cik}`);
      if (!d?.ok) continue;
      funds.push({ cik: f.cik, name: f.name, he: f.he, period: d.period, filed: d.filed, url: d.url, top: d.holdings.slice(0, 10), sold: d.sold });
      for (const h of d.holdings) {
        if (!h.t) continue;
        (byTickerMap[h.t] ||= []).push({ fund: f.he, cik: f.cik, pct: h.pct, change: h.change, period: d.period });
      }
    }
    await this.storage.put('holders', { byTicker: byTickerMap, funds, at: Date.now() });
  }

  // ---------- Push ----------

  async deliver(events, personal, devices, counter) {
    let sent = 0;
    const gone = new Set();
    const keys = devices.some(d => d.subscription) ? await vapidKeys(this.storage) : null;
    const inboxes = new Map();
    const send = async (d, e) => {
      if (!d.subscription || gone.has(d.id) || sent >= 20 || counter.n >= 48) return;
      const status = await sendPush(d.subscription, keys, { type: e.type, t: e.t, title: e.title, body: e.body, id: e.id, url: e.url, topic: `${e.type}${e.t || ''}`.replace(/[^A-Za-z0-9]/g, '') }, this.sender).catch(() => 0);
      counter.n++;
      sent++;
      if (status === 404 || status === 410) gone.add(d.id);
    };
    for (const e of events) {
      for (const d of devices) {
        const p = d.prefs || {};
        const inWatch = (d.watch || []).includes(e.t) || (d.positions || []).some(x => x.t === e.t);
        const wants = e.type === 'enter' ? p.entries !== false && (inWatch || (p.scope !== 'watch' && e.score >= (p.minScore || 70)))
          : e.type === 'near' ? p.near && (inWatch || p.scope !== 'watch')
          : e.type === 'bell' ? p.bell
          : e.type === 'filing' ? p.news !== false && inWatch
          : e.type === 'congress' ? p.congress !== false
          : false;
        if (wants) await send(d, e);
      }
    }
    for (const { dev, ev } of personal) {
      await send(dev, ev);
      const list = inboxes.get(dev.id) || [...(dev.inbox || [])];
      list.unshift(ev);
      inboxes.set(dev.id, list.slice(0, 40));
    }
    for (const d of devices) {
      if (!gone.has(d.id) && !inboxes.has(d.id)) continue;
      const current = await this.storage.get(`dev:${d.id}`);
      if (!current) continue;
      await this.storage.put(`dev:${d.id}`, { ...current, ...(gone.has(d.id) ? { subscription: null } : {}), ...(inboxes.has(d.id) ? { inbox: inboxes.get(d.id) } : {}) });
    }
    return sent;
  }

  // ---------- Reading ----------

  async health() {
    const [lastTick, health, scan] = [await this.storage.get('lastTick'), await this.storage.get('health'), await this.storage.get('scan')];
    return { ok: true, service: 'mabat-market', lastTick: lastTick || null, tracked: Object.keys(scan || {}).length, sources: health || {}, market: marketState() };
  }

  async board() {
    const devices = await this.devices();
    const tickers = this.tracked(devices);
    const sigs = await this.storage.get(tickers.map(t => `sig:${t}`));
    const [feed, holders, congress, health, lastTick] = [await this.storage.get('feed'), await this.storage.get('holders'), await this.storage.get('congress'), await this.storage.get('health'), await this.storage.get('lastTick')];
    const items = [];
    for (const t of tickers) {
      const s = sigs.get(`sig:${t}`);
      if (!s) continue;
      items.push({
        t, name: s.name, sector: s.sector, price: s.price, chgPct: s.chgPct, score: s.score, status: s.status,
        setup: s.setup, setupName: s.setupName, levels: s.levels, trend: s.trend, spark: s.spark, at: s.at,
        rsi: s.ind?.rsi, relVol: s.ind?.relVol, fromHigh: s.ind?.fromHigh, warnings: s.warnings?.length || 0,
        universe: !!byTicker[t],
      });
    }
    const spy = sigs.get('sig:SPY');
    const qqq = sigs.get('sig:QQQ');
    const regime = m => (m ? { price: m.price, chgPct: m.chgPct, trend: m.trend, above200: m.ind?.sma200 ? m.price > m.ind.sma200 : null, ret63: m.ind?.ret63 } : null);
    return {
      at: Date.now(),
      lastTick: lastTick || null,
      market: marketState(),
      regime: { spy: regime(spy), qqq: regime(qqq) },
      items,
      feed: (feed || []).slice(0, 80),
      funds: holders?.funds || [],
      congress: congress?.list?.slice(0, 30) || [],
      sources: health || {},
      needsSec: !(await this.secAgent(devices)),
    };
  }

  async detail(t) {
    if (!src.TICKER.test(t)) throw Object.assign(new Error('bad ticker'), { status: 400 });
    const [barsRec, sig, fund, news, filings, holders] = [
      await this.storage.get(`bars:${t}`), await this.storage.get(`sig:${t}`), await this.storage.get(`fund:${t}`),
      await this.storage.get(`news:${t}`), await this.storage.get(`filings:${t}`), await this.storage.get('holders'),
    ];
    let bars;
    let analysis = sig;
    let tracked = !!sig;
    if (barsRec && sig) {
      bars = src.unpackBars(barsRec.bars);
    } else {
      const cached = this.peek.get(t);
      if (cached && Date.now() - cached.at < 5 * MIN) return cached.data;
      const now = Date.now();
      const chart = await src.yahooChart(src.makeFetch(this.env), t);
      const ctx = await this.contextFor(t, await this.contextBase(now), chart.bars, marketState(now), now);
      analysis = this.summarize(t, chart, analyze(chart.bars, ctx), now);
      bars = chart.bars.slice(-460);
      tracked = false;
    }
    const data = {
      t,
      tracked,
      sig: analysis,
      bars: src.packBars(bars),
      series: chartSeries(bars),
      fundamentals: fund ? { metrics: fund.metrics, rules: src.screenRules(fund.metrics, analysis.price), at: fund.at } : null,
      news: news?.items || [],
      filings: (filings?.list || []).map(f => ({ ...f, names: f.items.map(it => src.ITEM_NAMES[it]).filter(Boolean) })),
      holders: holders?.byTicker?.[t] || [],
    };
    if (!tracked) {
      this.peek.set(t, { at: Date.now(), data });
      if (this.peek.size > 40) this.peek.delete(this.peek.keys().next().value);
    }
    return data;
  }
}

function spyContext(sig) {
  return { ret63: sig.ind?.ret63 ?? null, above200: sig.ind?.sma200 ? sig.price > sig.ind.sma200 : null };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (!/^\/(health|board|tick|search|t\/|d\/)/.test(url.pathname) || url.pathname === '/tick-cron') return json({ error: 'not found' }, 404);
    const stub = env.MARKET.get(env.MARKET.idFromName('market'));
    return stub.fetch(request);
  },

  async scheduled(event, env, ctx) {
    const stub = env.MARKET.get(env.MARKET.idFromName('market'));
    ctx.waitUntil(stub.fetch('https://market/tick-cron', { method: 'POST' }));
  },
};

