// Runs MobileCLIP (vision half) in a module worker so the page stays smooth.
// The model (23 MB) downloads from Hugging Face once and is cached by the
// browser; the photo never leaves the device.

import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js";
import { makeWindows, decodeEmbeddings, scoreEmbedding, pickItems, classifyRegion } from "./detect.js";

const MODEL = "Xenova/mobileclip_s0";
const BATCH = 6;
env.allowLocalModels = false;

let loading = null;

function decodeBase64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pickDevice() {
  try {
    if (self.navigator && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return { device: "webgpu", dtype: "fp16" };
    }
  } catch {
    // no WebGPU, fall through
  }
  // fp16 halves the download (23 MB) and gives the same answers as fp32.
  return { device: "wasm", dtype: "fp16" };
}

function load(post) {
  if (loading) return loading;
  loading = (async () => {
    try {
      return await loadModel(post);
    } catch (err) {
      console.error(err);
      throw new Error("The scanner couldn't be downloaded. Check your connection and try again.");
    }
  })();
  loading.catch(() => {
    loading = null; // allow a retry after a network failure
  });
  return loading;
}

async function loadModel(post) {
  const res = await fetch(new URL("./embeddings.json", import.meta.url));
  if (!res.ok) throw new Error("Could not load the garment list.");
  const emb = decodeEmbeddings(await res.json(), decodeBase64);
  const files = {};
  const progress_callback = (p) => {
    if (p.status !== "progress" || !p.file) return;
    files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
    let loaded = 0, total = 0;
    for (const f of Object.values(files)) { loaded += f.loaded; total += f.total; }
    if (total) post({ type: "status", stage: "loading", progress: loaded / total });
  };
  const processor = await AutoProcessor.from_pretrained(MODEL);
  let { device, dtype } = await pickDevice();
  let model;
  try {
    model = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { device, dtype, progress_callback });
  } catch (err) {
    if (device === "wasm") throw err;
    device = "wasm";
    dtype = "fp16";
    model = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { device, dtype, progress_callback });
  }
  return { processor, model, emb, device };
}

/** Copy a sub-rectangle (fractions) of RGBA pixels into a new RawImage. */
function cropRaw(img, win) {
  const x0 = Math.max(0, Math.round(win.x * img.width));
  const y0 = Math.max(0, Math.round(win.y * img.height));
  const x1 = Math.min(img.width, Math.round((win.x + win.w) * img.width));
  const y1 = Math.min(img.height, Math.round((win.y + win.h) * img.height));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const src = ((y0 + y) * img.width + x0) * 4;
    out.set(img.data.subarray(src, src + w * 4), y * w * 4);
  }
  return new RawImage(out, w, h, 4);
}

function bitmapToPixels(bitmap, maxSide = 768) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  return { data, width: w, height: h };
}

async function embed(state, images) {
  const inputs = await state.processor(images);
  const { image_embeds } = await state.model(inputs);
  const dims = image_embeds.dims[1];
  const flat = image_embeds.data;
  return images.map((_, i) => flat.subarray(i * dims, (i + 1) * dims));
}

async function scan(msg, post) {
  const t0 = performance.now();
  const pixels = bitmapToPixels(msg.bitmap);
  const state = await load(post);
  const raw = new RawImage(pixels.data, pixels.width, pixels.height, 4);
  const wins = makeWindows();
  const scored = [];
  for (let i = 0; i < wins.length; i += BATCH) {
    const chunk = wins.slice(i, i + BATCH);
    post({ type: "status", stage: "scanning", progress: i / wins.length, win: chunk[0] });
    const embeds = await embed(state, chunk.map((w) => cropRaw(raw, w)));
    embeds.forEach((e, j) => scored.push({ win: chunk[j], probs: scoreEmbedding(e, state.emb) }));
  }
  const items = pickItems(scored, state.emb, pixels);
  return { items, device: state.device, ms: Math.round(performance.now() - t0) };
}

async function region(msg, post) {
  const pixels = bitmapToPixels(msg.bitmap);
  const state = await load(post);
  const raw = new RawImage(pixels.data, pixels.width, pixels.height, 4);
  post({ type: "status", stage: "scanning", progress: 0.5, win: msg.region });
  const [e] = await embed(state, [cropRaw(raw, msg.region)]);
  return { item: classifyRegion(scoreEmbedding(e, state.emb), state.emb, pixels, msg.region), device: state.device };
}

self.onmessage = async (event) => {
  const msg = event.data;
  const post = (data) => self.postMessage({ ...data, id: msg.id });
  try {
    if (msg.type === "warmup") {
      await load(post);
      post({ type: "ready" });
    } else if (msg.type === "scan") {
      post({ type: "result", ...(await scan(msg, post)) });
    } else if (msg.type === "region") {
      post({ type: "result", ...(await region(msg, post)) });
    }
  } catch (err) {
    post({ type: "error", message: (err && err.message) || "The on-device scanner failed." });
  }
};
