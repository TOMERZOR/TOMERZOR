// Shared test setup: a static server for the repo, and a Chromium page whose
// CDN requests (Transformers.js, ONNX runtime) are served from node_modules,
// so the tests do not depend on jsDelivr being reachable.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FITSOURCE = path.resolve(here, "..");
export const ROOT = path.resolve(FITSOURCE, "..");
const NM = path.join(FITSOURCE, "node_modules");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

/** Serve the repository root. `api` (optional) handles /api/* like the worker. */
export function startServer(port, { api } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api/")) {
      if (!api) {
        const health = url.pathname === "/api/health";
        return res.writeHead(health ? 200 : 503, { "content-type": "application/json" }).end(JSON.stringify(health ? { ok: true, deep_scan: false } : { error: "not_configured" }));
      }
      return api(req, res);
    }
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end("not found");
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

export async function launch() {
  const opts = { args: ["--disable-gpu"] };
  if (fs.existsSync("/opt/pw-browsers/chromium")) {
    // Use the preinstalled build when the bundled one is missing.
    try {
      return await chromium.launch(opts);
    } catch {
      const exe = ["/opt/pw-browsers/chromium/chrome-linux/chrome", "/opt/pw-browsers/chromium/chrome"].find((p) => fs.existsSync(p));
      if (exe) return chromium.launch({ ...opts, executablePath: exe });
    }
  }
  return chromium.launch(opts);
}

/** New context with CDN routing and error collection. */
export async function newContext(browser, { cdn = true, ...options } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, ...options });
  // Playwright reports streamed fetches as aborted while routing is on, so
  // flows that don't load the model can turn it off with { cdn: false }.
  if (cdn) await ctx.route("https://cdn.jsdelivr.net/**", async (route) => {
    const p = new URL(route.request().url()).pathname.replace("/npm/", "");
    let file = null;
    if (p.startsWith("@huggingface/transformers@")) file = path.join(NM, "@huggingface/transformers", p.replace(/^@huggingface\/transformers@[^/]+\//, ""));
    else if (p.startsWith("onnxruntime-web@")) file = path.join(NM, "onnxruntime-web", p.replace(/^onnxruntime-web@[^/]+\//, ""));
    if (file && fs.existsSync(file)) {
      return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith(".wasm") ? "application/wasm" : "text/javascript", headers: { "access-control-allow-origin": "*" } });
    }
    return route.abort();
  });
  return ctx;
}

/** Collect console errors, page errors and failed requests on a page. */
export function watch(page, { ignore = [] } = {}) {
  const problems = [];
  const skip = (t) => ignore.some((r) => r.test(t));
  page.on("console", (m) => {
    if (m.type() === "error" && !skip(m.text())) problems.push("console: " + m.text());
  });
  page.on("pageerror", (e) => !skip(e.message) && problems.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (!skip(u) && !u.startsWith("data:")) problems.push(`requestfailed: ${u} ${r.failure() && r.failure().errorText}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !skip(r.url())) problems.push(`http ${r.status()}: ${r.url()}`);
  });
  return problems;
}
