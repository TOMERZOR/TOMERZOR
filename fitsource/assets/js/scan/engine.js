// Picks the scanner (deep scan on the server, or on-device), prepares the
// photo, and turns either engine's output into one result shape for the UI.

import { CONFIG } from "../config.js";
import { fetchHealth, deepScan, ApiError } from "./remote.js";
import { scanOnDevice, classifyOnDevice } from "./ondevice.js";

export const apiBase = () => (CONFIG.apiBase || "").replace(/\/+$/, "");
const isLocal = () => ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
let healthPromise = null;

/** Resolves to the API's health info when deep scan is available, else null. */
export function deepScanStatus() {
  if (!healthPromise) {
    // With no API configured, only a local preview (tools/serve.mjs) can have one.
    healthPromise = !apiBase() && !isLocal() ? Promise.resolve(null) : fetchHealth(apiBase()).then((h) => (h && h.deep_scan ? h : null));
  }
  return healthPromise;
}

// ---------- images ----------

export class ImageError extends Error {}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError("That file could not be opened as an image. Try a JPEG, PNG or WebP screenshot."));
    };
    img.src = url;
  });
}

function drawScaled(source, maxSide, type = "image/jpeg", quality = 0.86) {
  const w0 = source.naturalWidth || source.width;
  const h0 = source.naturalHeight || source.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs become white, not black, as JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL(type, quality), width: w, height: h, canvas };
}

/** Read a file into the sizes the app needs. */
export async function prepareImage(file) {
  if (!file || !/^image\//.test(file.type || "image/")) throw new ImageError("Pick an image file (JPEG, PNG or WebP).");
  if (file.size > 25 * 1024 * 1024) throw new ImageError("That image is over 25 MB. Try a screenshot instead.");
  const { img, url } = await loadImage(file);
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w < 120 || h < 120) throw new ImageError("That image is too small to scan. Use one at least 300 pixels wide.");
    const display = drawScaled(img, 1080, "image/jpeg", 0.82);
    const upload = drawScaled(img, 1568, "image/jpeg", 0.86);
    const blob = await new Promise((r) => display.canvas.toBlob(r, "image/jpeg", 0.9));
    return { photo: display.dataUrl, width: display.width, height: display.height, upload: upload.dataUrl, blob };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Crop a box (0 to 1000 scale) out of the photo as a small square-ish thumbnail. */
export function cropThumb(imgEl, box, size = 240) {
  const W = imgEl.naturalWidth, H = imgEl.naturalHeight;
  let x = (box.x / 1000) * W, y = (box.y / 1000) * H, w = (box.w / 1000) * W, h = (box.h / 1000) * H;
  // pad to 4:5 around the box centre so thumbnails line up
  const cx = x + w / 2, cy = y + h / 2;
  const target = 4 / 5;
  if (w / h > target) h = w / target;
  else w = h * target;
  x = Math.max(0, Math.min(W - w, cx - w / 2));
  y = Math.max(0, Math.min(H - h, cy - h / 2));
  w = Math.min(w, W);
  h = Math.min(h, H);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(size / target);
  canvas.getContext("2d").drawImage(imgEl, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

// ---------- results ----------

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const GROUP_TO_CATEGORY = { outerwear: "outerwear", top: "top", bottom: "bottom", dress: "dress", footwear: "footwear", bag: "bag", headwear: "headwear", eyewear: "eyewear" };

function fromDevice(it) {
  return {
    id: newId(),
    name: it.name,
    category: GROUP_TO_CATEGORY[it.group] || "accessory",
    color: it.color ? it.color.name : "",
    hex: it.color ? it.color.hex : null,
    brand: null,
    confidence: it.confidence,
    box: it.box,
    query: it.query,
    matches: [],
    alternatives: it.alternatives || [],
  };
}

function fromDeep(it) {
  return {
    id: newId(),
    name: it.label,
    category: it.category,
    color: it.color,
    hex: null,
    brand: it.brand,
    productName: it.product_name,
    confidence: it.confidence,
    box: it.box,
    query: it.search_query,
    matches: it.matches || [],
  };
}

/**
 * Scan a prepared image. Tries deep scan first when available; on failure it
 * falls back to the on-device scanner and says why in `result.notice`.
 */
export async function runScan(prepared, { onProgress = () => {}, signal } = {}) {
  const base = {
    id: newId(),
    createdAt: new Date().toISOString(),
    photo: prepared.photo,
    width: prepared.width,
    height: prepared.height,
  };
  const deep = await deepScanStatus();
  let notice = null;
  if (deep) {
    try {
      onProgress({ engine: "deep", t: "status", msg: "Uploading the photo" });
      const data = await deepScan(apiBase(), { image: prepared.upload }, { onEvent: (ev) => onProgress({ engine: "deep", ...ev }), signal });
      return { ...base, engine: "deep", vibe: data.vibe, summary: data.summary, cached: data.cached, items: data.items.map(fromDeep) };
    } catch (err) {
      if (err.name === "AbortError") throw err;
      notice = err instanceof ApiError && err.code === "daily_limit" ? err.message + " This one ran on your device instead." : "Deep scan was unavailable, so this ran on your device.";
    }
  }
  const out = await scanOnDevice(prepared.blob, { onStatus: (s) => onProgress({ engine: "device", ...s }) });
  return { ...base, engine: "device", device: out.device, ms: out.ms, notice, vibe: "", summary: "", items: out.items.map(fromDevice) };
}

/** Identify one region the user drew ({x,y,w,h} as fractions). */
export async function runRegion(scan, region, blob, { onProgress = () => {} } = {}) {
  const box = { x: Math.round(region.x * 1000), y: Math.round(region.y * 1000), w: Math.round(region.w * 1000), h: Math.round(region.h * 1000) };
  if (scan.engine === "deep" && (await deepScanStatus())) {
    try {
      const data = await deepScan(apiBase(), { image: scan.upload || scan.photo, focus: box }, { onEvent: (ev) => onProgress({ engine: "deep", ...ev }) });
      if (data.items.length) return { ...fromDeep(data.items[0]), box };
    } catch {
      // fall through to on-device
    }
  }
  const out = await classifyOnDevice(blob, region, { onStatus: (s) => onProgress({ engine: "device", ...s }) });
  return { ...fromDevice(out.item), box };
}
