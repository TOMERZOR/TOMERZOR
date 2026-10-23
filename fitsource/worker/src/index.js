// FitSource API (Cloudflare Worker). Routes:
//   GET  /api/health          what this deployment can do
//   POST /api/scan            deep scan, streams NDJSON progress then the result
//   GET  /api/stock?url=...   re-check one product page (restock alerts)
//
// Bindings (all optional except the key): ANTHROPIC_API_KEY (secret),
// FITSOURCE_KV (KV namespace for caching and daily limits), ALLOWED_ORIGINS,
// DAILY_SCAN_LIMIT, FITSOURCE_MODEL, FITSOURCE_EFFORT, MAX_SEARCHES, MAX_FETCHES.

import { runScan, verifyStock, ScanError, DEFAULT_MODEL } from "./scan.js";
import { checkStock, isSafePublicUrl } from "./stock.js";

const MAX_IMAGE_BYTES = 4_500_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const SCAN_CACHE_TTL = 60 * 60 * 24; // a viral fit scanned 1,000 times costs one scan
const STOCK_CACHE_TTL = 60 * 20;

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes("*") || allowed.includes(origin);
  return {
    "access-control-allow-origin": ok ? (allowed.includes("*") ? "*" : origin) : "null",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/** Daily per-IP quota kept in KV. Returns false when the visitor is over the limit. */
async function takeQuota(env, request) {
  const limit = parseInt(env.DAILY_SCAN_LIMIT || "0", 10);
  if (!env.FITSOURCE_KV || !limit) return true;
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:${day}:${await sha256(clientIp(request))}`;
  const used = parseInt((await env.FITSOURCE_KV.get(key)) || "0", 10);
  if (used >= limit) return false;
  await env.FITSOURCE_KV.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

export function parseImage(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m || !IMAGE_TYPES.includes(m[1])) return null;
  const data = m[2].replace(/\s+/g, "");
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes < 1000 || bytes > MAX_IMAGE_BYTES) return null;
  return { media_type: m[1], data };
}

export function parseFocus(f) {
  if (!f || typeof f !== "object") return null;
  const vals = ["x", "y", "w", "h"].map((k) => Math.round(Number(f[k])));
  if (vals.some((v) => !Number.isFinite(v) || v < 0 || v > 1000)) return null;
  const [x, y, w, h] = vals;
  if (w < 20 || h < 20) return null;
  return { x, y, w: Math.min(w, 1000 - x), h: Math.min(h, 1000 - y) };
}

async function handleScan(request, env, ctx, cors) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not_configured", message: "Deep scan is not set up on this server." }, 503, cors);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request", message: "Send JSON." }, 400, cors);
  }
  const image = parseImage(body && body.image);
  if (!image) return json({ error: "bad_image", message: "Upload a JPEG, PNG or WebP under 4.5 MB." }, 400, cors);
  const focus = parseFocus(body.focus);
  const hint = typeof body.hint === "string" ? body.hint.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200) || null : null;

  const cacheKey = env.FITSOURCE_KV ? `scan:${await sha256(image.data + JSON.stringify(focus) + (hint || ""))}` : null;
  const cached = cacheKey ? await env.FITSOURCE_KV.get(cacheKey) : null;

  if (!cached && !(await takeQuota(env, request))) {
    return json({ error: "daily_limit", message: "You've used today's free deep scans. Come back tomorrow." }, 429, cors);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  let open = true;
  const emit = (event) => {
    if (!open) return;
    writer.write(enc.encode(JSON.stringify(event) + "\n")).catch(() => {
      open = false; // the visitor closed the tab
    });
  };

  const work = (async () => {
    try {
      if (cached) {
        emit({ t: "status", msg: "Found in recent scans" });
        emit({ t: "result", data: JSON.parse(cached), cached: true });
        return;
      }
      const { results, model, usage } = await runScan({ image, focus, hint, env, emit });
      // One line per scan for cost tracking (wrangler tail / Workers logs).
      console.log(JSON.stringify({ event: "scan", model, items: results.items.length, input_tokens: usage?.input_tokens, output_tokens: usage?.output_tokens, cache_read: usage?.cache_read_input_tokens, searches: usage?.web_search_requests }));
      emit({ t: "status", msg: "Checking stock at each shop" });
      await verifyStock(results);
      const payload = { ...results, model, scanned_at: new Date().toISOString() };
      if (cacheKey && results.items.length) {
        await env.FITSOURCE_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: SCAN_CACHE_TTL });
      }
      emit({ t: "result", data: payload });
    } catch (err) {
      const code = err instanceof ScanError ? err.code : "scan_failed";
      const message = err instanceof ScanError ? err.message : "Something went wrong while scanning. Try again in a minute.";
      console.error("scan failed", code, err && err.message);
      emit({ t: "error", code, message });
    } finally {
      open = false;
      await writer.close().catch(() => {});
    }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(work);

  return new Response(readable, {
    status: 200,
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...cors },
  });
}

async function handleStock(request, env, cors) {
  const url = new URL(request.url).searchParams.get("url") || "";
  if (!isSafePublicUrl(url)) return json({ error: "bad_url" }, 400, cors);
  const key = env.FITSOURCE_KV ? `stock:${await sha256(url)}` : null;
  if (key) {
    const hit = await env.FITSOURCE_KV.get(key);
    if (hit) return json(JSON.parse(hit), 200, cors);
  }
  const result = await checkStock(url);
  if (key && result.availability !== "unknown") {
    await env.FITSOURCE_KV.put(key, JSON.stringify(result), { expirationTtl: STOCK_CACHE_TTL });
  }
  return json(result, 200, cors);
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/api/health" && request.method === "GET") {
        return json(
          {
            ok: true,
            deep_scan: Boolean(env.ANTHROPIC_API_KEY),
            model: env.FITSOURCE_MODEL || DEFAULT_MODEL,
            cache: Boolean(env.FITSOURCE_KV),
            daily_limit: parseInt(env.DAILY_SCAN_LIMIT || "0", 10) || null,
          },
          200,
          cors,
        );
      }
      if (pathname === "/api/scan" && request.method === "POST") return await handleScan(request, env, ctx, cors);
      if (pathname === "/api/stock" && request.method === "GET") return await handleStock(request, env, cors);
      return json({ error: "not_found" }, 404, cors);
    } catch (err) {
      console.error("request failed", err && err.message);
      return json({ error: "server_error" }, 500, cors);
    }
  },
};
