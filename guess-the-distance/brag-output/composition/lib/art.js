// The signature: gradient blobs pulled into speed streaks, like a long
// exposure from a moving car. Drawn once per card on a canvas.

import { rngFrom } from "./rng.js";

const cache = new Map();

function blobs(ctx, w, h, colors, rand) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  const spots = [
    [colors[1], 0.55 + rand() * 0.25],
    [colors[2], 0.45 + rand() * 0.25],
    [colors[1], 0.3 + rand() * 0.2],
    [colors[0], 0.35],
  ];
  for (const [c, size] of spots) {
    const x = w * (0.1 + rand() * 0.8), y = h * (0.1 + rand() * 0.8);
    const r = Math.max(w, h) * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(0.55, c + "cc");
    g.addColorStop(1, c + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // a hot core, like the bright center in the reference art
  const x = w * (0.35 + rand() * 0.3), y = h * (0.3 + rand() * 0.4);
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.min(w, h) * 0.42);
  g.addColorStop(0, colors[2] + "ee");
  g.addColorStop(1, colors[2] + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawArt(canvas, colors, { seed = "x", dir = "v", amp = 0.18 } = {}) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(64, Math.round((rect.width || 320) * dpr * 0.6));
  const h = Math.max(48, Math.round((rect.height || 200) * dpr * 0.6));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const key = `${colors.join()}|${seed}|${dir}|${w}x${h}`;
  const hit = cache.get(key);
  if (hit) {
    ctx.drawImage(hit, 0, 0);
    canvas.classList.add("ready");
    return;
  }
  const rand = rngFrom(seed);
  const vertical = dir === "v";
  const pad = Math.round((vertical ? h : w) * amp);
  const base = document.createElement("canvas");
  base.width = vertical ? w : w + pad * 2;
  base.height = vertical ? h + pad * 2 : h;
  blobs(base.getContext("2d"), base.width, base.height, colors, rand);

  // Streaks: every 1-3px slice is shifted along the streak by a noisy amount.
  const len = vertical ? w : h;
  const ph = [rand() * 10, rand() * 10, rand() * 10];
  let i = 0;
  while (i < len) {
    const sw = 1 + Math.floor(rand() * 3);
    const f = i / len;
    let n = Math.sin(f * 7 + ph[0]) * 0.5 + Math.sin(f * 23 + ph[1]) * 0.3 + Math.sin(f * 71 + ph[2]) * 0.2;
    if (rand() < 0.12) n += (rand() - 0.5) * 1.6; // glitchy spikes
    const off = Math.round(pad + n * pad * 0.95);
    if (vertical) ctx.drawImage(base, i, Math.max(0, Math.min(pad * 2, off)), sw, h, i, 0, sw, h);
    else ctx.drawImage(base, Math.max(0, Math.min(pad * 2, off)), i, w, sw, 0, i, w, sw);
    i += sw;
  }
  // fine line texture
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#fff";
  for (let k = 0; k < len; k += 3) {
    if (rand() < 0.5) continue;
    if (vertical) ctx.fillRect(k, 0, 1, h);
    else ctx.fillRect(0, k, w, 1);
  }
  // grain
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let p = 0; p < d.length; p += 4) {
    const g = (rand() - 0.5) * 22;
    d[p] += g; d[p + 1] += g; d[p + 2] += g;
  }
  ctx.putImageData(img, 0, 0);
  const keep = document.createElement("canvas");
  keep.width = w;
  keep.height = h;
  keep.getContext("2d").drawImage(canvas, 0, 0);
  cache.set(key, keep);
  canvas.classList.add("ready");
}

// Paint every canvas.art inside root that hasn't been painted yet, without
// blocking the first frame.
export function paintArt(root = document) {
  const list = [...root.querySelectorAll("canvas.art:not(.ready)")];
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < list.length && performance.now() - t0 < 12) {
      const c = list[i++];
      if (!c.isConnected) continue;
      const colors = (c.dataset.colors || "#00b4ff,#2346ff,#7a2bff").split(",");
      drawArt(c, colors, { seed: c.dataset.seed || colors.join(), dir: c.dataset.dir || "v" });
    }
    if (i < list.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function artCanvas(colors, seed, dir = "v") {
  return `<canvas class="art" data-colors="${colors.join(",")}" data-seed="${seed}" data-dir="${dir}" aria-hidden="true"></canvas>`;
}
