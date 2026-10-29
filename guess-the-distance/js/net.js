// Talking to the game server, with graceful fallbacks:
// - Solo rounds come from the server's cached router, or straight from the
//   OpenStreetMap routers when there is no server.
// - Duels use the server's WebSocket. Without a server, the same hub runs in
//   the page so you can still duel the bot.

import { Hub } from "../core/hub.js";
import { createResolver } from "../core/router.js";
import { makeRounds, resolveRound } from "../core/rounds.js";

const cfg = window.GTD_CONFIG || {};
let base = null;
let detecting = null;

export const resolver = createResolver({ timeoutMs: 6500 });

async function fetchJSON(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function detectServer() {
  if (detecting) return detecting;
  detecting = (async () => {
    const list = [];
    if (cfg.server) list.push(cfg.server.replace(/\/+$/, ""));
    if (location.protocol.startsWith("http")) list.push(location.origin);
    for (const url of list) {
      try {
        const h = await fetchJSON(`${url}/api/health`, 3000);
        if (h?.game === "guess-the-distance") {
          base = url;
          return { url, online: h.online ?? 0 };
        }
      } catch {}
    }
    return null;
  })();
  return detecting;
}

export const hasServer = () => !!base;

export async function getRounds({ seed, map, count = 5, from = 0 }) {
  await detectServer();
  if (base) {
    try {
      const data = await fetchJSON(`${base}/api/rounds?seed=${encodeURIComponent(seed)}&map=${map}&count=${count}&from=${from}`, 15000);
      if (Array.isArray(data.rounds) && data.rounds.length) return data.rounds;
    } catch {}
  }
  const specs = makeRounds({ seed, map, count: from + count }).slice(from);
  return Promise.all(specs.map((s) => resolveRound(s, resolver)));
}

// One duel connection: remote WebSocket or the in-page hub.
export class DuelNet {
  constructor(getProfile) {
    this.getProfile = getProfile;
    this.handlers = new Map();
    this.ws = null;
    this.local = null;
    this.want = false;
    this.retry = 0;
    this.state = "idle"; // idle | connecting | open | local
    this.pingTimer = null;
    this.online = 0;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }

  emit(type, data) {
    this.handlers.get(type)?.forEach((fn) => fn(data));
    this.handlers.get("*")?.forEach((fn) => fn(type, data));
  }

  setState(s) {
    this.state = s;
    this.emit("state", s);
  }

  get isLocal() {
    return this.state === "local";
  }

  async connect() {
    this.want = true;
    if (this.state === "open" || this.state === "connecting" || this.state === "local") return;
    this.setState("connecting");
    await detectServer();
    if (!this.want) return;
    if (!base) return this.startLocal();
    this.open();
  }

  open() {
    const url = base.replace(/^http/, "ws") + "/ws";
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      return this.startLocal();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setState("open");
      this.hello();
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: "ping", at: Date.now() }), 15000);
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      this.receive(m);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.want) return this.setState("idle");
      this.setState("connecting");
      this.emit("dropped");
      const wait = Math.min(8000, 400 * 2 ** this.retry++);
      setTimeout(() => this.want && this.state !== "open" && this.open(), wait);
    };
    ws.onerror = () => {};
  }

  startLocal() {
    this.local = new Hub({ resolve: resolver });
    const socket = { send: (s) => queueMicrotask(() => this.receive(JSON.parse(s))), close() {} };
    this.localConn = this.local.connect(socket);
    this.setState("local");
    this.hello();
  }

  hello() {
    const p = this.getProfile();
    this.send({ t: "hello", clientId: p.clientId, name: p.name, avatar: p.avatar });
  }

  receive(m) {
    if (typeof m.online === "number") {
      this.online = m.online;
      this.emit("online", m.online);
    }
    this.emit(m.t, m);
  }

  send(msg) {
    if (this.local) {
      if (msg.t === "queue" || msg.t === "room:create" || msg.t === "room:join") {
        this.emit("error", { t: "error", code: "need-server" });
        return;
      }
      this.local.message(this.localConn, JSON.stringify(msg));
      return;
    }
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.want = false;
    clearInterval(this.pingTimer);
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.close();
    }
    this.setState("idle");
  }
}
