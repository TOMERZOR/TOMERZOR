// Picks the scanner (deep scan on the server, or on-device), prepares the
// photo, and turns either engine's output into one result shape for the UI.

import { CONFIG } from "../config.js";
import { fetchHealth, deepScan, ApiError } from "./remote.js";
import { scanOnDevice, classifyOnDevice } from "./ondevice.js";
import { HE } from "./vocab.js";
import { colorHe } from "./color.js";

export const apiBase = () => (CONFIG.apiBase || "").replace(/\/+$/, "");
const isLocal = () => ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
let healthPromise = null;

/** Resolves to the API's health info when deep scan is available, else null. */
export function deepScanStatus() {
  if (!healthPromise) {
    // With no API configured, only a local preview (tools/serve.mjs) can have one.
    if (!apiBase() && !isLocal()) healthPromise = Promise.resolve(null);
    else
      healthPromise = fetchHealth(apiBase()).then((h) => {
        const ok = h && h.deep_scan ? h : null;
        // A blip shouldn't switch deep scan off for the whole visit: ask again in 30 s.
        if (!ok) setTimeout(() => (healthPromise = null), 30000);
        return ok;
      });
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
      reject(new ImageError("לא הצלחנו לפתוח את הקובץ כתמונה. נסו צילום מסך בפורמט JPEG, PNG או WebP."));
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
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff"; // transparent PNGs become white, not black, as JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return { dataUrl: canvas.toDataURL(type, quality), width: w, height: h, canvas };
}

/** Read a file into the sizes the app needs. */
export async function prepareImage(file) {
  if (!file || !/^image\//.test(file.type || "image/")) throw new ImageError("בחרו קובץ תמונה (JPEG, PNG או WebP).");
  if (file.size > 25 * 1024 * 1024) throw new ImageError("התמונה גדולה מ־25MB. נסו צילום מסך במקום.");
  const { img, url } = await loadImage(file);
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w < 120 || h < 120) throw new ImageError("התמונה קטנה מדי לסריקה. השתמשו בתמונה ברוחב 300 פיקסלים לפחות.");
    const display = drawScaled(img, 1080, "image/jpeg", 0.82);
    const upload = drawScaled(img, 1568, "image/jpeg", 0.86);
    const blob = await new Promise((r) => display.canvas.toBlob(r, "image/jpeg", 0.9));
    // Text on clothes is read from the original file, scaled by the browser's best resampler.
    const s = Math.min(1, 1568 / Math.max(w, h));
    const text = { blob: file, width: Math.round(w * s), height: Math.round(h * s) };
    return { photo: display.dataUrl, width: display.width, height: display.height, upload: upload.dataUrl, blob, text };
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

/** Search words: the brand and the print when the photo shows them, else the colour and the garment. */
export function deviceQueries(it, name, colorWord) {
  const printed = [it.brand, it.printed && !(it.brand || "").toLowerCase().includes(it.printed.toLowerCase()) ? it.printed : ""].filter(Boolean).join(" ");
  if (printed) return { query: `${printed} ${name}`, queryEn: `${printed} ${it.name.toLowerCase()}` };
  return { query: colorWord ? `${name} ${colorWord}` : name, queryEn: it.query };
}

function fromDevice(it) {
  // The detector works in English; people see Hebrew. The colour agrees with the garment.
  const [name, g] = HE[it.name] || [it.name, "m"];
  const color = it.color ? it.color.name : "";
  return {
    id: newId(),
    name,
    category: GROUP_TO_CATEGORY[it.group] || "accessory",
    color: color ? colorHe(color) : "",
    hex: it.color ? it.color.hex : null,
    brand: it.brand || null,
    printed: it.printed || "",
    confidence: it.confidence,
    box: it.box,
    ...deviceQueries(it, name, color ? colorHe(color, g) : ""),
    matches: [],
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
    queryEn: it.search_query_en || "",
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
      onProgress({ engine: "deep", t: "status", msg: "מעלים את התמונה" });
      const data = await deepScan(apiBase(), { image: prepared.upload }, { onEvent: (ev) => onProgress({ engine: "deep", ...ev }), signal });
      return { ...base, engine: "deep", vibe: data.vibe, summary: data.summary, cached: data.cached, items: data.items.map(fromDeep) };
    } catch (err) {
      if (err.name === "AbortError") throw err;
      notice = err instanceof ApiError && err.code === "daily_limit" ? err.message + " הפעם הסריקה רצה על המכשיר שלכם." : "הסריקה המעמיקה לא הייתה זמינה, אז הסריקה רצה על המכשיר שלכם.";
    }
  }
  const out = await scanOnDevice(prepared.blob, { onStatus: (s) => onProgress({ engine: "device", ...s }), signal, textSource: prepared.text });
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
