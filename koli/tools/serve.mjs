// Local run: serves the Koli app and runs the Koli API in the same process.
//   ANTHROPIC_API_KEY=sk-ant-... node tools/serve.mjs [port]   then open http://localhost:8787
// Instagram works locally too if you expose the port (e.g. `cloudflared tunnel --url http://localhost:8787`)
// and set IG_APP_SECRET, IG_ACCESS_TOKEN and IG_VERIFY_TOKEN.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../server/src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

async function toWebRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/webhook/")) {
    const pending = [];
    const response = await worker.fetch(await toWebRequest(req), process.env, { waitUntil: (p) => pending.push(p) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    await Promise.allSettled(pending);
    return;
  }
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}node_modules${path.sep}`)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) return res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
  res.end(fs.readFileSync(file));
});
server.listen(PORT, () => {
  console.log(`Koli: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log("ANTHROPIC_API_KEY is not set: the app opens, but Koli can't write replies.");
});
