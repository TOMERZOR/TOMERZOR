// Local preview: serves the repository root so FitSource can link to the
// Dream Studios store next to it. Optionally runs the API in-process when
// ANTHROPIC_API_KEY is set, at /api/*.
//   node tools/serve.mjs [port]      then open http://localhost:8080/fitsource/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".xml": "application/xml; charset=utf-8",
};

let api = null;
if (process.env.ANTHROPIC_API_KEY) {
  const mod = await import(pathToFileURL(path.join(here, "../worker/src/index.js")).href);
  api = mod.default;
  console.log("API enabled at /api (deep scan uses your ANTHROPIC_API_KEY)");
}

async function toWebRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : body });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    if (!api) {
      const health = url.pathname === "/api/health";
      res.writeHead(health ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify(health ? { ok: true, deep_scan: false } : { error: "not_configured" }));
      return;
    }
    const pending = [];
    const response = await api.fetch(await toWebRequest(req), process.env, { waitUntil: (p) => pending.push(p) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) for await (const chunk of response.body) res.write(chunk);
    res.end();
    return;
  }
  // Like the static hosts: /feed serves feed.html, unknown pages get 404.html.
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  else if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    const notFound = path.join(ROOT, "fitsource/404.html");
    if (url.pathname.startsWith("/fitsource/") && fs.existsSync(notFound)) {
      res.writeHead(404, { "content-type": TYPES[".html"] });
      res.end(fs.readFileSync(notFound, "utf8").replace(/<base href="[^"]*">/, '<base href="/fitsource/">'));
    } else res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
  res.end(fs.readFileSync(file));
});
server.listen(PORT, () => console.log(`FitSource preview: http://localhost:${PORT}/fitsource/`));
