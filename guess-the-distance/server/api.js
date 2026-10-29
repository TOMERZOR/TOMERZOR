// HTTP routes shared by the Cloudflare Worker and the Node server.
//   GET /api/health                          is the server up, how many players
//   GET /api/rounds?seed=&map=&count=&from=  solo rounds with their real routes
// The duel socket (/ws) is handled by each transport.

import { makeRounds, resolveRound } from "../core/rounds.js";
import { MAPS } from "../core/places.js";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
}

export async function handleApi(request, { resolve, stats }) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (url.pathname === "/api/health") {
    return json({ ok: true, game: "guess-the-distance", version: 1, ...(await stats()) });
  }
  if (url.pathname === "/api/rounds") {
    const seed = (url.searchParams.get("seed") || "").slice(0, 40);
    const map = MAPS[url.searchParams.get("map")] ? url.searchParams.get("map") : "israel";
    const count = Math.min(Math.max(parseInt(url.searchParams.get("count") || "5", 10) || 5, 1), 25);
    const from = Math.min(Math.max(parseInt(url.searchParams.get("from") || "0", 10) || 0, 0), 500);
    if (!seed) return json({ error: "seed" }, 400);
    const specs = makeRounds({ seed, map, count: from + count }).slice(from);
    const rounds = await Promise.all(specs.map((s) => resolveRound(s, resolve)));
    return json({ seed, map, from, rounds }, 200, { "Cache-Control": "public, max-age=3600" });
  }
  return json({ error: "not-found" }, 404);
}
