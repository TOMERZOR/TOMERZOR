// Local server: the game, the API and live duels on one port.
//   npm install && npm start      then open http://localhost:8787
// PORT changes the port. Routes come from the public OpenStreetMap routers
// when the machine is online, and from the reference data when it isn't.

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { Hub } from "../core/hub.js";
import { createResolver } from "../core/router.js";
import { handleApi } from "./api.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const PRIVATE = ["server", "test", "node_modules", ".wrangler"];
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg", ".woff2": "font/woff2",
};

// ROUTER_URL points at your own OSRM servers (expects /routed-car, /routed-bike
// and /routed-foot under it, like routing.openstreetmap.de). ROUTER=off uses
// the reference data only.
const R = process.env.ROUTER_URL?.replace(/\/+$/, "");
const endpoints = R ? { car: [`${R}/routed-car`], bike: [`${R}/routed-bike`], foot: [`${R}/routed-foot`] } : undefined;
const resolve = createResolver({
  live: process.env.ROUTER !== "off",
  endpoints,
  headers: { "User-Agent": "GuessTheDistance/1.0 (+https://github.com/TOMERZOR/TOMERZOR)" },
});
const hub = new Hub({ resolve, log: (s) => console.log(new Date().toISOString(), s) });

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(ROOT, path));
  const rel = file.slice(ROOT.length);
  if (!file.startsWith(ROOT) || PRIVATE.some((p) => rel === p || rel.startsWith(p + sep)) || rel.split(sep).some((s) => s.startsWith("."))) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const s = await stat(file);
    if (s.isDirectory()) {
      res.writeHead(301, { Location: url.pathname + "/" }).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const request = new Request(new URL(req.url, `http://${req.headers.host || "localhost"}`), { method: req.method });
    const out = await handleApi(request, { resolve, stats: async () => hub.stats() });
    if (out) {
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
      return;
    }
    await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end("Server error");
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url, "http://x").pathname !== "/ws") return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    const conn = hub.connect({ send: (s) => ws.readyState === 1 && ws.send(s), close: (c, r) => ws.close(c, r) });
    ws.on("message", (data) => hub.message(conn, data.toString()));
    ws.on("close", () => hub.disconnect(conn));
    ws.on("error", () => hub.disconnect(conn));
  });
});

server.listen(PORT, () => console.log(`Guess The Distance on http://localhost:${PORT}`));
