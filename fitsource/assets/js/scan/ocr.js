// Reads text printed on clothes (a brand, a collection name, a slogan) so the
// quick scan can search for it. PaddleOCR (PP-OCRv3 detection, PP-OCRv5
// English recognition) through onnxruntime; `ort` is passed in so the same
// code runs in the browser worker and in Node. Images are { data, width,
// height } RGBA.

const HF = "https://huggingface.co";
export const OCR_MODELS = {
  det: `${HF}/SWHL/RapidOCR/resolve/1cfba2e90fc938db55889873735088de210cc173/PP-OCRv3/ch_PP-OCRv3_det_infer.onnx`,
  rec: `${HF}/monkt/paddleocr-onnx/resolve/7b02d0a30a07ba2b92ad1ff5a8941ae2c633de65/languages/english/rec.onnx`,
  dict: `${HF}/monkt/paddleocr-onnx/resolve/7b02d0a30a07ba2b92ad1ff5a8941ae2c633de65/languages/english/dict.txt`,
};

/** The part of a photo searched for text: the body, leaving out shop signs at the sides. */
export const BODY = { x: 0.12, y: 0, w: 0.76, h: 1 };

const DET_MAX = 960; // longest side fed to the detector
const REC_H = 48;
const MIN_SCORE = 0.85; // recognition confidence a word needs

/** Crop and scale (bilinear) a region of an RGBA image to w x h. */
export function resample(img, sx, sy, sw, sh, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const { data, width, height } = img;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(height - 1, Math.max(0, sy + ((y + 0.5) * sh) / h - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(height - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(width - 1, Math.max(0, sx + ((x + 0.5) * sw) / w - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(width - 1, x0 + 1), tx = fx - x0;
      for (let c = 0; c < 3; c++) {
        const a = data[(y0 * width + x0) * 4 + c] * (1 - tx) + data[(y0 * width + x1) * 4 + c] * tx;
        const b = data[(y1 * width + x0) * 4 + c] * (1 - tx) + data[(y1 * width + x1) * 4 + c] * tx;
        out[(y * w + x) * 4 + c] = a * (1 - ty) + b * ty;
      }
      out[(y * w + x) * 4 + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** RGBA to a planar BGR float tensor, (v / 255 - mean) / std per channel. */
function toTensor(ort, img, mean, std) {
  const { data, width, height } = img;
  const n = width * height;
  const f = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) f[c * n + i] = (data[i * 4 + (2 - c)] / 255 - mean[c]) / std[c]; // PaddleOCR works in BGR
  }
  return new ort.Tensor("float32", f, [1, 3, height, width]);
}

/**
 * Text boxes from the detector's probability map (DB post-processing,
 * axis-aligned): threshold, connected components, keep confident ones and
 * grow each by the unclip distance. Returns boxes in map pixels.
 */
export function boxesFromMap(prob, w, h, { thresh = 0.3, boxThresh = 0.6, unclip = 2.0, minSide = 3 } = {}) {
  const seen = new Uint8Array(w * h);
  const boxes = [];
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || prob[start] <= thresh) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, sum = 0, count = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p - x) / w;
      sum += prob[p];
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || seen[q] || prob[q] <= thresh) continue;
        if ((q === p - 1 || q === p + 1) && Math.floor(q / w) !== y) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (Math.min(bw, bh) < minSide || sum / count < boxThresh) continue;
    const d = (bw * bh * unclip) / (2 * (bw + bh));
    boxes.push({ x: Math.max(0, x0 - d), y: Math.max(0, y0 - d), w: Math.min(w, x1 + 1 + d) - Math.max(0, x0 - d), h: Math.min(h, y1 + 1 + d) - Math.max(0, y0 - d) });
  }
  return boxes;
}

/** Greedy CTC decoding: best class per step, repeats merged, blanks (0) dropped. */
export function ctcDecode(logits, steps, classes, dict) {
  let text = "", prev = -1, conf = 0, n = 0;
  for (let t = 0; t < steps; t++) {
    let best = 0, bp = -Infinity;
    for (let c = 0; c < classes; c++) {
      const v = logits[t * classes + c];
      if (v > bp) (bp = v), (best = c);
    }
    if (best !== 0 && best !== prev) {
      text += dict[best - 1] ?? "";
      conf += bp;
      n++;
    }
    prev = best;
  }
  return { text, score: n ? conf / n : 0 };
}

/** Load the three files. `fetchBytes(url)` returns an ArrayBuffer (browser fetch, or a cache in Node). */
export async function loadOcr(ort, fetchBytes, options = {}) {
  const [det, rec, dict] = await Promise.all([fetchBytes(OCR_MODELS.det), fetchBytes(OCR_MODELS.rec), fetchBytes(OCR_MODELS.dict)]);
  const lines = new TextDecoder().decode(dict).split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return {
    ort,
    det: await ort.InferenceSession.create(new Uint8Array(det), options),
    rec: await ort.InferenceSession.create(new Uint8Array(rec), options),
    dict: [...lines, " "],
  };
}

/**
 * Read the text in a region of an image (fractions 0 to 1). Returns lines,
 * largest lettering first: [{ text, score, size }], `size` being the
 * letter height as a fraction of the region's height.
 */
export async function readText(ocr, img, region = { x: 0, y: 0, w: 1, h: 1 }) {
  const { ort } = ocr;
  const sx = region.x * img.width, sy = region.y * img.height, sw = region.w * img.width, sh = region.h * img.height;
  const scale = Math.min(1, DET_MAX / Math.max(sw, sh));
  const dw = Math.max(32, Math.round((sw * scale) / 32) * 32), dh = Math.max(32, Math.round((sh * scale) / 32) * 32);
  const small = resample(img, sx, sy, sw, sh, dw, dh);
  const detOut = await ocr.det.run({ [ocr.det.inputNames[0]]: toTensor(ort, small, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]) });
  const map = detOut[ocr.det.outputNames[0]].data;
  const lines = [];
  for (const b of boxesFromMap(map, dw, dh)) {
    if (b.h > b.w * 1.5) continue; // vertical or rotated text: not something we can read straight
    // back to source pixels
    const bx = sx + (b.x * sw) / dw, by = sy + (b.y * sh) / dh, bw = (b.w * sw) / dw, bh = (b.h * sh) / dh;
    const rw = Math.min(1600, Math.max(REC_H, Math.round((bw / bh) * REC_H)));
    const crop = resample(img, bx, by, bw, bh, rw, REC_H);
    const recOut = await ocr.rec.run({ [ocr.rec.inputNames[0]]: toTensor(ort, crop, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]) });
    const out = recOut[ocr.rec.outputNames[0]];
    const [, steps, classes] = out.dims;
    const { text, score } = ctcDecode(out.data, steps, classes, ocr.dict);
    if (text.trim()) lines.push({ text: text.trim(), score: +score.toFixed(3), size: +(bh / sh).toFixed(4), x: +((bx - sx) / sw).toFixed(3), y: +((by - sy) / sh).toFixed(3) });
  }
  return lines.sort((a, b) => b.size - a.size);
}

// ---------- from raw lines to search words ----------

// Brands whose name tends to be printed on their clothes. Aliases are matched
// as whole words. Kept short on purpose: a wrong brand is worse than none.
const BRANDS = [
  ["Nude Project", ["nude project", "nude"]],
  ["Nike", ["nike"]],
  ["Jordan", ["jordan", "jumpman"]],
  ["Adidas", ["adidas"]],
  ["Puma", ["puma"]],
  ["New Balance", ["new balance"]],
  ["Carhartt WIP", ["carhartt"]],
  ["Stüssy", ["stussy", "stüssy"]],
  ["Supreme", ["supreme"]],
  ["The North Face", ["the north face", "north face"]],
  ["Champion", ["champion"]],
  ["Tommy Hilfiger", ["tommy hilfiger", "hilfiger"]],
  ["Ralph Lauren", ["ralph lauren", "polo ralph lauren"]],
  ["Lacoste", ["lacoste"]],
  ["Levi's", ["levi's", "levis"]],
  ["Calvin Klein", ["calvin klein"]],
  ["Represent", ["represent"]],
  ["Fear of God Essentials", ["fear of god", "essentials"]],
  ["Corteiz", ["corteiz", "crtz"]],
  ["Trapstar", ["trapstar"]],
  ["Palm Angels", ["palm angels"]],
  ["Off-White", ["off-white", "off white"]],
  ["Stone Island", ["stone island"]],
  ["Moncler", ["moncler"]],
  ["Balenciaga", ["balenciaga"]],
  ["Gucci", ["gucci"]],
  ["Prada", ["prada"]],
  ["Diesel", ["diesel"]],
  ["Guess", ["guess"]],
  ["Vans", ["vans", "off the wall"]],
  ["Converse", ["converse"]],
  ["Kith", ["kith"]],
  ["Aimé Leon Dore", ["aime leon dore"]],
  ["Hellstar", ["hellstar"]],
  ["Sp5der", ["sp5der", "spider worldwide"]],
  ["Gallery Dept.", ["gallery dept"]],
  ["Broken Planet", ["broken planet"]],
  ["Cole Buxton", ["cole buxton"]],
  ["Patagonia", ["patagonia"]],
  ["Arc'teryx", ["arcteryx", "arc'teryx"]],
  ["Columbia", ["columbia"]],
  ["Under Armour", ["under armour"]],
  ["Pull&Bear", ["pull&bear", "pull and bear"]],
  ["Bershka", ["bershka"]],
  ["Castro", ["castro"]],
];

const clean = (s) => s.toLowerCase().replace(/[^a-z0-9&'\s-]/g, " ").replace(/\s+/g, " ").trim();

/**
 * From recognised lines, the words worth searching for: confident lines with
 * real words, the largest lettering first, and a brand when one is named.
 */
export function printedText(lines, { maxWords = 4 } = {}) {
  // Short scraps (often a piece of curved lettering) are only kept when they name a brand.
  const isBrand = (t) => BRANDS.some(([, aliases]) => aliases.includes(clean(t)));
  const letters = (t) => (t.match(/[A-Za-z]/g) || []).length;
  const readable = lines.filter((l) => l.score >= MIN_SCORE && l.size >= 0.012 && (letters(l.text) >= 4 || isBrand(l.text)) && letters(l.text) >= l.text.replace(/\s/g, "").length * 0.7);
  // the headline lettering only: fine print and half-read bits around it are noise
  const top = readable.length ? readable[0].size : 0;
  const good = readable.filter((l) => l.size >= top * 0.6);
  // the biggest lettering, read top to bottom, left to right
  const picked = good.slice(0, 3).sort((a, b) => (Math.abs(a.y - b.y) < 0.5 * Math.min(a.size, b.size) ? a.x - b.x : a.y - b.y));
  const words = [];
  for (const l of picked) {
    for (const w of l.text.split(/\s+/)) {
      const word = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9!&'.]+$/g, "");
      if (word.length >= 2 && /[A-Za-z]/.test(word) && !words.some((x) => x.toLowerCase() === word.toLowerCase())) words.push(word);
    }
  }
  const text = words.slice(0, maxWords).join(" ");
  const all = ` ${clean(good.map((l) => l.text).join(" "))} `;
  const hit = BRANDS.find(([, aliases]) => aliases.some((a) => all.includes(` ${a} `)));
  // where the lettering sits (fraction of the region's height), to tell which garment it is on
  const y = picked.length ? picked.reduce((t, l) => t + l.y + l.size / 2, 0) / picked.length : null;
  return { text, brand: hit ? hit[0] : null, y };
}
