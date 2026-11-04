// Photo filters for posts. Each is a short list of the standard CSS filter steps, so the preview
// (CSS `filter` on an <img>) and the saved photo (the same color matrices applied to the pixels,
// clamped after every step as the browser does) look the same.

export const FILTERS = [
  { id: 'normal', name: 'טבעי', ops: [] },
  { id: 'golan', name: 'גולן', ops: [['contrast', 1.18], ['saturate', 1.35]] },
  { id: 'negev', name: 'נגב', ops: [['sepia', 0.25], ['brightness', 1.08], ['contrast', 0.92], ['saturate', 0.85]] },
  { id: 'hermon', name: 'חרמון', ops: [['brightness', 1.1], ['contrast', 0.92], ['saturate', 0.8], ['hue', -10]] },
  { id: 'yam', name: 'ים', ops: [['hue', -12], ['saturate', 1.2], ['contrast', 1.05], ['brightness', 1.04]] },
  { id: 'shetach', name: 'שטח', ops: [['sepia', 0.15], ['saturate', 0.7], ['contrast', 1.15]] },
  { id: 'zricha', name: 'זריחה', ops: [['sepia', 0.12], ['saturate', 1.3], ['brightness', 1.06], ['hue', -6]] },
  { id: 'kaitz', name: 'קיץ', ops: [['brightness', 1.1], ['saturate', 1.25], ['contrast', 0.95]] },
  { id: 'laila', name: 'לילה', ops: [['grayscale', 1], ['contrast', 1.15], ['brightness', 1.05]] },
];

const byId = id => FILTERS.find(f => f.id === id) || FILTERS[0];

export const filterCss = id => byId(id).ops.map(([k, v]) => (k === 'hue' ? `hue-rotate(${v}deg)` : `${k}(${v})`)).join(' ') || 'none';

// [3x3 matrix, offset 0..1] for one step, per the Filter Effects spec.
function matrix(k, v) {
  if (k === 'brightness') return [[v, 0, 0, 0, v, 0, 0, 0, v], 0];
  if (k === 'contrast') return [[v, 0, 0, 0, v, 0, 0, 0, v], 0.5 - 0.5 * v];
  if (k === 'saturate') {
    return [[0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v,
      0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v,
      0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v], 0];
  }
  if (k === 'grayscale') {
    const a = 1 - v;
    return [[0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a,
      0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a,
      0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a], 0];
  }
  if (k === 'sepia') {
    const a = 1 - v;
    return [[0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
      0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
      0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a], 0];
  }
  if (k === 'hue') {
    const r = (v * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    return [[0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072], 0];
  }
  return null;
}

// Applies a filter to ImageData in place. Uint8ClampedArray clamps after every step, like CSS.
export function applyFilter(img, id) {
  const d = img.data;
  for (const [k, v] of byId(id).ops) {
    const mo = matrix(k, v);
    if (!mo) continue;
    const [m, off] = mo;
    const o = off * 255;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = m[0] * r + m[1] * g + m[2] * b + o;
      d[i + 1] = m[3] * r + m[4] * g + m[5] * b + o;
      d[i + 2] = m[6] * r + m[7] * g + m[8] * b + o;
    }
  }
  return img;
}

// A JPEG data URL under `max` characters, lowering quality and then size until it fits.
export function toJpeg(canvas, max = 400 * 1024) {
  let c = canvas;
  for (let round = 0; round < 4; round++) {
    for (const q of [0.86, 0.76, 0.66, 0.56]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length < max) return url;
    }
    const n = document.createElement('canvas');
    n.width = Math.round(c.width * 0.8);
    n.height = Math.round(c.height * 0.8);
    n.getContext('2d').drawImage(c, 0, 0, n.width, n.height);
    c = n;
  }
  throw Object.assign(new Error('photo'), { code: 'photo' });
}
