// Guess The Distance on Cloudflare: the Worker serves the game (static
// assets), the API, and hands duel sockets to one Durable Object that runs
// matchmaking, rooms and every live duel.

import { Hub } from "../core/hub.js";
import { createResolver } from "../core/router.js";
import { handleApi, json } from "./api.js";

// Routes are cached in the edge cache for a week; they don't change often.
function edgeCache() {
  const memory = new Map();
  const keyUrl = (k) => `https://route-cache.guess-the-distance/${encodeURIComponent(k)}`;
  return {
    async get(k) {
      if (memory.has(k)) return memory.get(k);
      try {
        const hit = await caches.default.match(keyUrl(k));
        if (hit) {
          const v = await hit.json();
          memory.set(k, v);
          return v;
        }
      } catch {}
      return null;
    },
    async set(k, v) {
      memory.set(k, v);
      if (memory.size > 5000) memory.delete(memory.keys().next().value);
      try {
        await caches.default.put(keyUrl(k), new Response(JSON.stringify(v), { headers: { "Cache-Control": "public, max-age=604800" } }));
      } catch {}
    },
  };
}

let resolver;
function getResolver() {
  if (!resolver) resolver = createResolver({ cache: edgeCache() });
  return resolver;
}

export class GameHub {
  constructor(state, env) {
    this.state = state;
    this.hub = new Hub({ resolve: getResolver() });
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return json(this.hub.stats());
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const conn = this.hub.connect({
      send: (s) => server.send(s),
      close: (code, reason) => server.close(code, reason),
    });
    server.addEventListener("message", (e) => this.hub.message(conn, e.data));
    server.addEventListener("close", () => this.hub.disconnect(conn));
    server.addEventListener("error", () => this.hub.disconnect(conn));
    return new Response(null, { status: 101, webSocket: client });
  }
}

function hubStub(env) {
  return env.HUB.get(env.HUB.idFromName("global"));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "websocket only" }, 426);
      return hubStub(env).fetch(request);
    }
    const api = await handleApi(request, {
      resolve: getResolver(),
      stats: async () => {
        try {
          return await (await hubStub(env).fetch("https://hub/stats")).json();
        } catch {
          return {};
        }
      },
    });
    if (api) return api;
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: "not-found" }, 404);
  },
};
