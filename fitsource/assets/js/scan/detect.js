// On-device garment detection, model-agnostic part. The photo is looked at
// through a set of overlapping windows; each window's MobileCLIP embedding is
// compared with the precomputed label embeddings, and the strongest window per
// garment group becomes a detected item.

import { allLabels, GROUP_ORDER } from "./vocab.js";
import { dominantColor, regionsInWindow, backgroundStrips, denimWash } from "./color.js";

/** Windows as fractions of the image: bands down the body, plus feet and head close-ups. */
export function makeWindows() {
  const wins = [];
  for (const h of [0.22, 0.33, 0.5]) {
    for (let y = 0; y + h <= 1.001; y += 0.08) wins.push({ x: 0.15, y: +y.toFixed(2), w: 0.7, h });
  }
  wins.push({ x: 0.2, y: 0.8, w: 0.6, h: 0.14 });
  wins.push({ x: 0.2, y: 0.86, w: 0.6, h: 0.14 });
  wins.push({ x: 0.25, y: 0, w: 0.5, h: 0.16 });
  return wins;
}

export const THRESHOLD = 0.3;

/** Unpack embeddings.json (int8 + per-vector scale) and check it matches vocab.js. */
export function decodeEmbeddings(json, decodeBase64) {
  const meta = allLabels();
  if (json.labels.length !== meta.length || json.labels.some((l, i) => l !== meta[i].label)) {
    throw new Error("embeddings.json is out of date; run tools/build-embeddings.mjs");
  }
  const bytes = decodeBase64(json.data);
  const int8 = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const vecs = json.labels.map((_, i) => {
    const v = new Float32Array(json.dims);
    let norm = 0;
    for (let j = 0; j < json.dims; j++) {
      v[j] = int8[i * json.dims + j] * json.scales[i];
      norm += v[j] * v[j];
    }
    norm = Math.sqrt(norm) || 1;
    for (let j = 0; j < json.dims; j++) v[j] /= norm;
    return v;
  });
  return { meta, vecs };
}

/** Softmax over every label (garments and negatives) for one image embedding. */
export function scoreEmbedding(embedding, { vecs }) {
  let norm = 0;
  for (let j = 0; j < embedding.length; j++) norm += embedding[j] * embedding[j];
  norm = Math.sqrt(norm) || 1;
  const logits = vecs.map((v) => {
    let dot = 0;
    for (let j = 0; j < v.length; j++) dot += v[j] * embedding[j];
    return (100 * dot) / norm;
  });
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * Turn per-window probabilities into items.
 * `windows` is [{ win, probs }]. `image` (optional) is { data, width, height }
 * RGBA pixels used to name each item's colour.
 */
// Small close-up windows are good at spotting shoes and hats, but for clothes
// they often catch just a hem; place and colour clothes from a full band instead.
const CLOSE_UP_GROUPS = new Set(["footwear", "headwear", "eyewear"]);

export function pickItems(windows, { meta }, image, threshold = THRESHOLD) {
  const best = {};
  const band = {};
  for (const { win, probs } of windows) {
    probs.forEach((p, i) => {
      const group = meta[i].group;
      if (group === "neg") return;
      if (!best[group] || p > best[group].p) best[group] = { p, i, win };
      if (win.h >= 0.22 && (!band[group] || p > band[group].p)) band[group] = { p, i, win };
    });
  }
  let groups = Object.keys(best).filter((g) => best[g].p >= threshold);
  // A dress and separates rarely coexist; keep whichever the model is surer of.
  if (groups.includes("dress")) {
    const rival = Math.max(best.top?.p || 0, best.bottom?.p || 0);
    if (best.dress.p <= rival) groups = groups.filter((g) => g !== "dress");
    else groups = groups.filter((g) => g !== "bottom");
  }
  groups.sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));

  return groups.map((group) => {
    const { p, i } = best[group];
    const win = !CLOSE_UP_GROUPS.has(group) && band[group] ? band[group].win : best[group].win;
    const color = image ? dominantColor(image, regionsInWindow(win, group), backgroundStrips(win), { skinLikely: !["outerwear", "bag", "headwear", "eyewear"].includes(group) }) : null;
    const name = meta[i].name;
    const wash = /jean|denim/i.test(meta[i].label) ? denimWash(color) : null;
    if (color && wash) color.name = wash;
    const colorName = color ? color.name : "";
    return {
      group,
      label: meta[i].label,
      name,
      confidence: +p.toFixed(3),
      color,
      query: `${colorName} ${name}`.trim().toLowerCase(),
      box: {
        x: Math.round(win.x * 1000),
        y: Math.round(win.y * 1000),
        w: Math.round(win.w * 1000),
        h: Math.round(win.h * 1000),
      },
    };
  });
}

/** Best guesses for a single user-drawn region, across every group. */
export function classifyRegion(probs, { meta }, image, region) {
  const ranked = probs
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => meta[i].group !== "neg")
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  const top = ranked[0];
  const group = meta[top.i].group;
  const color = image ? dominantColor(image, [{ x: region.x + region.w * 0.25, y: region.y + region.h * 0.25, w: region.w * 0.5, h: region.h * 0.5 }]) : null;
  const name = meta[top.i].name;
  return {
    group,
    label: meta[top.i].label,
    name,
    confidence: +top.p.toFixed(3),
    alternatives: ranked.slice(1).map(({ p, i }) => ({ name: meta[i].name, confidence: +p.toFixed(3) })),
    color,
    query: `${color ? color.name : ""} ${name}`.trim().toLowerCase(),
    box: { x: Math.round(region.x * 1000), y: Math.round(region.y * 1000), w: Math.round(region.w * 1000), h: Math.round(region.h * 1000) },
  };
}
