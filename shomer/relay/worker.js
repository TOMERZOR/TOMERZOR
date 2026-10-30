// Shomer push relay. Browsers can't post to Apple's push service themselves (no CORS), so the
// camera hands the message to this Worker, which passes it on unchanged. The message is already
// encrypted for the phone and signed by the camera (Web Push), so the relay can't read or alter
// it, holds no keys and stores nothing. It only forwards to known push services.

const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const PASS_HEADERS = ['authorization', 'content-encoding', 'content-type', 'ttl', 'urgency', 'topic'];
const MAX_BODY = 4096; // the Web Push limit for a message

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function fromB64u(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return json({ ok: true, service: 'shomer-push' });
    if (url.pathname !== '/send' || request.method !== 'POST') return json({ error: 'not found' }, 404);

    let msg;
    try {
      const text = await request.text();
      if (text.length > 16384) return json({ error: 'too big' }, 413);
      msg = JSON.parse(text);
    } catch {
      return json({ error: 'bad json' }, 400);
    }

    let endpoint;
    try {
      endpoint = new URL(msg.endpoint);
    } catch {
      return json({ error: 'bad endpoint' }, 400);
    }
    if (endpoint.protocol !== 'https:' || !PUSH_HOSTS.some(re => re.test(endpoint.hostname))) {
      return json({ error: 'not a push service' }, 400);
    }

    let body;
    try {
      body = fromB64u(String(msg.body || ''));
    } catch {
      return json({ error: 'bad body' }, 400);
    }
    if (!body.length || body.length > MAX_BODY) return json({ error: 'bad body size' }, 400);

    const headers = {};
    for (const [k, v] of Object.entries(msg.headers || {})) {
      if (PASS_HEADERS.includes(k.toLowerCase()) && typeof v === 'string' && v.length < 2048) headers[k] = v;
    }
    if (!headers.Authorization && !headers.authorization) return json({ error: 'missing authorization' }, 400);

    let res;
    try {
      res = await fetch(endpoint.toString(), { method: 'POST', headers, body });
    } catch {
      return json({ error: 'push service unreachable' }, 502);
    }
    // Pass the push service's verdict back (201 ok, 404/410 subscription gone, 4xx bad token...).
    return json({ status: res.status, reason: res.ok ? null : (await res.text()).slice(0, 200) }, res.ok ? 200 : res.status);
  },
};
