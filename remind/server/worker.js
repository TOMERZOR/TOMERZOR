// Remind. reminder server (Cloudflare Worker). A web page can't schedule a notification for later,
// so this sends each reminder as a Web Push at the right time, even when the phone is locked and
// the app is closed.
//
// One Durable Object per phone. It keeps the push subscription, the time zone and the dose times,
// and sets an alarm for the next one. What it stores is deliberately thin: times and random ids,
// never medicine names. The phone's service worker turns the ids back into names when the
// notification arrives. When a dose is due and not marked as taken, it sends a push, then repeats
// every few minutes (the user's choice) for up to two hours or until the phone reports it taken.
//
// Routes:
//   GET    /health
//   GET    /d/<id>/key    the phone's VAPID public key (made on first use) to subscribe with
//   PUT    /d/<id>        { subscription, tz, nag, schedule, taken }: save and reschedule
//   POST   /d/<id>/test   send a test notification now
//   DELETE /d/<id>        forget this phone

const NAG_WINDOW = 120; // minutes after the dose time that repeats may still be sent
const LATE_LIMIT = 150 * 60 * 1000; // an alarm that runs this late doesn't send old reminders
const HORIZON = 33; // days to look ahead for the next reminder (covers a monthly one)
const MAX_BODY = 32 * 1024;
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------- Time ----------

const pad = n => String(n).padStart(2, '0');

// Wall-clock parts of an instant in a time zone.
export function localParts(ms, tz) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  }).formatToParts(new Date(ms))) parts[p.type] = p.value;
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, h: +parts.hour, m: +parts.minute, s: +parts.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday) };
}

function offsetAt(ms, tz) {
  const p = localParts(ms, tz);
  const [y, mo, d] = p.date.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, p.h, p.m, p.s) - Math.floor(ms / 1000) * 1000;
}

// The instant when the wall clock in `tz` shows `date` `time` (HH:MM). Handles DST changes.
export function zonedTime(date, time, tz) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, m] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, m);
  const first = guess - offsetAt(guess, tz);
  const second = guess - offsetAt(first, tz);
  return second;
}

export function addDays(date, n) {
  const [y, mo, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const weekday = date => new Date(`${date}T12:00:00Z`).getUTCDay();
const monthDays = date => { const [y, m] = date.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

// The 31st falls on the last day of shorter months.
function isMonthDay(date, day) {
  const d = +date.slice(8);
  return d === day || (day > monthDays(date) && d === monthDays(date));
}

// ---------- Schedule ----------
//
// schedule: [{ t: 'HH:MM', items: [{ k: 'doseKey', d: [0..6] | null, m?: 1..31, o?: 'YYYY-MM-DD', s?: 'YYYY-MM-DD', u?: 'YYYY-MM-DD' }] }]
//   d: weekdays (null: every day), m: day of the month, o: one date only, s/u: start and end dates
// taken:    { 'YYYY-MM-DD': ['doseKey', ...] }

export function dueOn(group, date) {
  const wd = weekday(date);
  return group.items.filter(it => (!it.d || it.d.includes(wd)) && (!it.m || isMonthDay(date, it.m)) && (!it.o || it.o === date)
    && (!it.s || it.s <= date) && (!it.u || it.u >= date)).map(it => it.k);
}

export function pendingOn(state, group, date) {
  const taken = new Set(state.taken?.[date] || []);
  return dueOn(group, date).filter(k => !taken.has(k));
}

// Every moment a reminder could go out, from `from` on, for `days` days: the dose time itself and
// the repeats after it.
export function moments(state, from, days = HORIZON) {
  const out = [];
  const nag = state.nag > 0 ? state.nag : 0;
  const repeats = nag ? Math.floor(NAG_WINDOW / nag) : 0;
  const start = addDays(localParts(from, state.tz).date, -1);
  for (let i = 0; i <= days; i++) {
    const date = addDays(start, i);
    for (const group of state.schedule || []) {
      if (!dueOn(group, date).length) continue;
      const base = zonedTime(date, group.t, state.tz);
      for (let n = 0; n <= repeats; n++) out.push({ at: base + n * nag * 60000, date, t: group.t, n, group });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// What to send now (moments that passed since the last run, the latest one per dose time, only
// if something is still not taken) and when to wake next.
export function plan(state, lastRun, now) {
  const all = moments(state, Math.min(lastRun, now) - 86400000);
  const latest = new Map();
  for (const m of all) {
    if (m.at > lastRun && m.at <= now && now - m.at < LATE_LIMIT) latest.set(`${m.date} ${m.t}`, m);
  }
  const send = [];
  for (const m of latest.values()) {
    const pending = pendingOn(state, m.group, m.date);
    if (pending.length) send.push({ date: m.date, t: m.t, n: m.n, keys: pending });
  }
  const found = all.find(m => m.at > now);
  // Nothing within the horizon (a one-date dose months away): wake up later and look again.
  const later = (state.schedule || []).some(g => g.items.length) ? now + (HORIZON - 3) * 86400000 : null;
  return { send, next: found ? found.at : later };
}

// ---------- Validation ----------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const KEY = /^[A-Za-z0-9_@:-]{1,64}$/;

export function clean(body) {
  const tz = String(body.tz || 'UTC');
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { throw new Error('bad tz'); }
  const nag = [0, 5, 10, 15, 20, 30, 60].includes(+body.nag) ? +body.nag : 15;
  const schedule = (Array.isArray(body.schedule) ? body.schedule : []).slice(0, 48).map(g => {
    if (!TIME.test(g.t)) throw new Error('bad time');
    return {
      t: g.t,
      items: (Array.isArray(g.items) ? g.items : []).slice(0, 64).map(it => {
        if (!KEY.test(it.k)) throw new Error('bad key');
        const item = { k: it.k, d: Array.isArray(it.d) ? it.d.filter(x => Number.isInteger(x) && x >= 0 && x <= 6) : null };
        if (Number.isInteger(it.m) && it.m >= 1 && it.m <= 31) item.m = it.m;
        if (DATE.test(it.o || '')) item.o = it.o;
        if (DATE.test(it.s || '')) item.s = it.s;
        if (DATE.test(it.u || '')) item.u = it.u;
        return item;
      }),
    };
  });
  const taken = {};
  for (const [date, keys] of Object.entries(body.taken || {}).slice(-4)) {
    if (DATE.test(date) && Array.isArray(keys)) taken[date] = keys.filter(k => KEY.test(k)).slice(0, 256);
  }
  let subscription = null;
  if (body.subscription) {
    const s = body.subscription;
    const endpoint = new URL(s.endpoint);
    if (endpoint.protocol !== 'https:' || !PUSH_HOSTS.some(re => re.test(endpoint.hostname))) throw new Error('not a push service');
    if (typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') throw new Error('bad subscription');
    subscription = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  }
  return { tz, nag, schedule, taken, subscription };
}

// ---------- Web Push (RFC 8291 encryption, RFC 8292 VAPID) ----------

const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

export async function encryptPayload(subscription, text) {
  const uaPublic = unb64u(subscription.keys.p256dh);
  const authSecret = unb64u(subscription.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic, cipher);
}

async function vapidKeys(storage) {
  let saved = await storage.get('vapid');
  if (!saved) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    saved = { privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey), publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)) };
    await storage.put('vapid', saved);
  }
  return saved;
}

async function sendPush(subscription, keys, message) {
  const privateKey = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(subscription.endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'https://tomerzor.github.io/TOMERZOR/remind/',
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(`${header}.${claims}`));
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${header}.${claims}.${b64u(sig)}, k=${keys.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
      Topic: `dose${message.t ? message.t.replace(':', '') : 'test'}`,
    },
    body: await encryptPayload(subscription, JSON.stringify(message)),
  });
  return res.status;
}

// ---------- The phone's Durable Object ----------

export class Device {
  constructor(ctx) {
    this.ctx = ctx;
    this.storage = ctx.storage;
  }

  async fetch(request) {
    const action = new URL(request.url).searchParams.get('a');

    if (action === 'key') return json({ key: (await vapidKeys(this.storage)).publicKey });

    if (action === 'delete') {
      await this.storage.deleteAlarm();
      await this.storage.deleteAll();
      return json({ ok: true });
    }

    const state = await this.storage.get('state');

    if (action === 'test') {
      if (!state?.subscription) return json({ error: 'no subscription' }, 409);
      const status = await sendPush(state.subscription, await vapidKeys(this.storage), { type: 'test' });
      return json({ ok: status < 300, status }, status < 300 ? 200 : 502);
    }

    // action === 'sync'
    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: 'too big' }, 413);
      body = clean(JSON.parse(text));
    } catch (e) {
      return json({ error: e.message || 'bad request' }, 400);
    }
    const next = { ...body, subscription: body.subscription || state?.subscription || null };
    await this.storage.put('state', next);
    // Only reminders from now on: a changed schedule mustn't fire one for a time that already passed.
    const now = Date.now();
    await this.storage.put('lastRun', now);
    const { next: at } = plan(next, now, now);
    if (at && next.subscription) await this.storage.setAlarm(at);
    else await this.storage.deleteAlarm();
    return json({ ok: true, next: at });
  }

  async alarm() {
    const state = await this.storage.get('state');
    if (!state?.subscription) return;
    const now = Date.now() + 1000; // alarms can run a moment early
    const lastRun = (await this.storage.get('lastRun')) || now - 60000;
    const { send, next } = plan(state, lastRun, now);
    const keys = await vapidKeys(this.storage);
    for (const message of send.slice(0, 4)) {
      const status = await sendPush(state.subscription, keys, { type: 'dose', ...message }).catch(() => 0);
      if (status === 404 || status === 410) {
        // The phone removed the app or turned notifications off.
        await this.storage.put('state', { ...state, subscription: null });
        return;
      }
    }
    await this.storage.put('lastRun', now);
    if (next) await this.storage.setAlarm(next);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return json({ ok: true, service: 'remind-push' });

    const m = url.pathname.match(/^\/d\/([A-Za-z0-9_-]{22,43})(\/key|\/test)?$/);
    if (!m) return json({ error: 'not found' }, 404);
    const action = m[2] === '/key' && request.method === 'GET' ? 'key'
      : m[2] === '/test' && request.method === 'POST' ? 'test'
      : !m[2] && request.method === 'PUT' ? 'sync'
      : !m[2] && request.method === 'DELETE' ? 'delete'
      : null;
    if (!action) return json({ error: 'not found' }, 404);
    const stub = env.DEVICES.get(env.DEVICES.idFromName(m[1]));
    return stub.fetch(new Request(`https://device/?a=${action}`, { method: request.method === 'GET' ? 'GET' : 'POST', body: request.method === 'GET' ? null : request.body }));
  },
};
