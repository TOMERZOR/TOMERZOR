// Shomer relay. Two jobs, neither of which lets it read anything:
//
// /room/<id>: the link between a camera and its phone(s). Both connect here over a WebSocket and
// the room (a Durable Object) passes each binary message from one side to the other. Messages are
// end-to-end encrypted with a key only the two devices have; the room id is a hash of that key.
// The room also tells each side whether the other is connected.
//
// /send: push notifications. Browsers can't post to Apple's push service themselves (no CORS), so
// the camera hands the message to this Worker, which passes it on unchanged. It is already
// encrypted for the phone and signed by the camera (Web Push), so the relay can't read or alter
// it. It only forwards to known push services.
//
// The relay holds no keys and stores nothing.

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

const MAX_FRAME = 512 * 1024;
const MAX_PHONES = 3;

// One room per camera. Uses the WebSocket Hibernation API: while nothing is being sent the object
// sleeps and costs nothing, and the keep-alive pings are answered without waking it.
export class Room {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const role = new URL(request.url).searchParams.get('role');
    if (role !== 'camera' && role !== 'phone') return new Response('bad role', { status: 400 });
    const [client, server] = Object.values(new WebSocketPair());
    // A camera that reconnects replaces its old connection; a fourth phone replaces the oldest.
    const same = this.ctx.getWebSockets(role);
    if (role === 'camera') same.forEach(ws => ws.close(4000, 'replaced'));
    else if (same.length >= MAX_PHONES) same[0].close(4000, 'replaced');
    this.ctx.acceptWebSocket(server, [role]);
    this.announce();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message === 'string' || message.byteLength > MAX_FRAME) return;
    const [role] = this.ctx.getTags(ws);
    for (const peer of this.ctx.getWebSockets(role === 'camera' ? 'phone' : 'camera')) {
      try { peer.send(message); } catch {}
    }
  }

  webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch {}
    this.announce(ws);
  }

  webSocketError(ws) {
    this.announce(ws);
  }

  // Tells everyone in the room who is connected.
  announce(gone) {
    const live = ws => ws !== gone && ws.readyState === 1;
    const camera = this.ctx.getWebSockets('camera').some(live);
    const phones = this.ctx.getWebSockets('phone').filter(live).length;
    const text = JSON.stringify({ t: 'peers', camera, phones });
    for (const ws of this.ctx.getWebSockets()) {
      if (live(ws)) try { ws.send(text); } catch {}
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return json({ ok: true, service: 'shomer-push' });
    const room = url.pathname.match(/^\/room\/([A-Za-z0-9_-]{22})$/);
    if (room) {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket only' }, 426);
      return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(request);
    }
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
