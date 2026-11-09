// Motion detection by comparing each frame with a slowly adapting background.
// Works on small grayscale frames (about 160x120), so it is cheap enough for an old phone.

// Sensitivity 1..10 -> share of the frame that has to change.
// 1 = 10% of the frame, 6 = about 0.8%, 10 = about 0.1%.
export function sensitivityToThreshold(level) {
  return 0.1 * Math.pow(0.6, level - 1);
}

export function toGray(rgba, out) {
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  }
  return out;
}

export class MotionDetector {
  constructor({ pixelThreshold = 24, learnRate = 0.04, cell = 8, cellFill = 0.25, warmup = 8, lightChange = 0.5 } = {}) {
    Object.assign(this, { pixelThreshold, learnRate, cell, cellFill, warmup, lightChange });
    this.reset();
  }

  reset() {
    this.bg = null;
    this.frames = 0;
  }

  // gray: one byte per pixel, w*h long.
  // Returns { score, box, warming, lightChange }: score is the share of the frame in motion,
  // box is the moving area in frame pixels (null when nothing moves).
  process(gray, w, h) {
    const n = w * h;
    if (!this.bg || this.bg.length !== n) {
      this.bg = Float32Array.from(gray);
      this.frames = 0;
      return { score: 0, box: null, warming: true, lightChange: false };
    }
    this.frames++;

    const { cell, bg, learnRate, pixelThreshold } = this;
    const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    if (!this.counts || this.counts.length !== cols * rows) this.counts = new Uint16Array(cols * rows);
    const counts = this.counts;
    counts.fill(0);

    let changed = 0;
    for (let y = 0; y < h; y++) {
      const rowCell = ((y / cell) | 0) * cols;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const d = gray[i] - bg[i];
        if (d > pixelThreshold || d < -pixelThreshold) {
          changed++;
          counts[rowCell + ((x / cell) | 0)]++;
        }
        bg[i] += d * learnRate;
      }
    }

    // Most of the picture changed at once: a light was switched on or the camera moved.
    if (changed / n > this.lightChange) {
      bg.set(gray);
      return { score: 0, box: null, warming: false, lightChange: true };
    }
    if (this.frames < this.warmup) return { score: 0, box: null, warming: true, lightChange: false };

    // Only count cells where a real patch moved, so scattered sensor noise is ignored.
    const minCount = cell * cell * this.cellFill;
    let moving = 0, x0 = cols, y0 = rows, x1 = -1, y1 = -1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = counts[r * cols + c];
        if (k < minCount) continue;
        moving += k;
        if (c < x0) x0 = c;
        if (c > x1) x1 = c;
        if (r < y0) y0 = r;
        if (r > y1) y1 = r;
      }
    }
    if (!moving) return { score: 0, box: null, warming: false, lightChange: false };
    const box = {
      x: x0 * cell,
      y: y0 * cell,
      w: Math.min(w, (x1 + 1) * cell) - x0 * cell,
      h: Math.min(h, (y1 + 1) * cell) - y0 * cell,
    };
    return { score: moving / n, box, warming: false, lightChange: false };
  }
}
