// Dominant garment colour from raw RGBA pixels, named in shopper words.
// Pure functions, no DOM, so they run in the scan worker and in Node tests.

export const PALETTE = [
  ["black", [28, 28, 30]],
  ["charcoal", [64, 64, 68]],
  ["grey", [128, 128, 130]],
  ["light grey", [192, 192, 194]],
  ["white", [243, 243, 240]],
  ["cream", [236, 226, 204]],
  ["beige", [206, 186, 156]],
  ["camel", [188, 145, 96]],
  ["brown", [104, 70, 44]],
  ["olive", [104, 106, 58]],
  ["khaki", [168, 158, 112]],
  ["green", [46, 122, 70]],
  ["forest green", [32, 74, 48]],
  ["navy", [32, 40, 72]],
  ["blue", [44, 86, 168]],
  ["denim blue", [86, 116, 156]],
  ["light blue", [156, 184, 214]],
  ["red", [192, 40, 40]],
  ["burgundy", [112, 28, 42]],
  ["pink", [236, 156, 192]],
  ["purple", [112, 64, 140]],
  ["lavender", [184, 168, 216]],
  ["yellow", [236, 204, 66]],
  ["butter yellow", [240, 222, 142]],
  ["orange", [230, 122, 42]],
];

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const PALETTE_LAB = PALETTE.map(([name, rgb]) => [name, rgbToLab(rgb)]);

export function nameColor(rgb) {
  const lab = rgbToLab(rgb);
  let best = PALETTE_LAB[0][0];
  let bestD = Infinity;
  for (const [name, p] of PALETTE_LAB) {
    // Lightness differences matter less than hue for garments in mixed light.
    const d = 0.6 * (lab[0] - p[0]) ** 2 + (lab[1] - p[1]) ** 2 + (lab[2] - p[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

export function isSkin([r, g, b]) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 50 && cb >= 80 && cb <= 125 && cr >= 136 && cr <= 170 && r > g && r > b;
}

/** Collect pixels from rectangles given as fractions of the image. */
export function samplePixels({ data, width, height }, rects, maxSamples = 2400) {
  let area = 0;
  for (const r of rects) area += r.w * width * r.h * height;
  const step = Math.max(1, Math.floor(Math.sqrt(area / maxSamples)));
  const out = [];
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x * width)), x1 = Math.min(width, Math.ceil((r.x + r.w) * width));
    const y0 = Math.max(0, Math.floor(r.y * height)), y1 = Math.min(height, Math.ceil((r.y + r.h) * height));
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) continue;
        out.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }
  return out;
}

/** Small deterministic k-means. Returns clusters sorted by size. */
export function kmeans(pixels, k = 3, iterations = 8) {
  if (pixels.length === 0) return [];
  const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * (sorted.length - 1))].slice());
  let assign = new Array(pixels.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    for (let p = 0; p < pixels.length; p++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = (pixels[p][0] - centers[c][0]) ** 2 + (pixels[p][1] - centers[c][1]) ** 2 + (pixels[p][2] - centers[c][2]) ** 2;
        if (d < bd) { bd = d; bi = c; }
      }
      assign[p] = bi;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let p = 0; p < pixels.length; p++) {
      const s = sums[assign[p]];
      s[0] += pixels[p][0]; s[1] += pixels[p][1]; s[2] += pixels[p][2]; s[3]++;
    }
    centers = sums.map((s, c) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[c]));
  }
  const counts = centers.map(() => 0);
  for (const a of assign) counts[a]++;
  return centers
    .map((c, i) => ({ rgb: c.map(Math.round), share: counts[i] / pixels.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}

const toHex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

export function deltaE(a, b) {
  const la = rgbToLab(a), lb = rgbToLab(b);
  return Math.sqrt((la[0] - lb[0]) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2);
}

/**
 * Main entry: the garment's colour inside `rects`. `bgRects` (optional) are
 * strips of background beside the garment; clusters that look like them
 * (pavement, grass, walls) are skipped, as is skin.
 */
export function dominantColor(image, rects, bgRects = [], { skinLikely = true } = {}) {
  const clusters = kmeans(samplePixels(image, rects), 3);
  if (!clusters.length) return null;
  const bg = bgRects.length ? kmeans(samplePixels(image, bgRects, 800), 2).filter((c) => c.share >= 0.25) : [];
  // Skin-coloured clusters are usually arms and legs, unless they dominate
  // (then it is a brown, tan or camel garment). Where skin rarely shows
  // (the sides of a jacket, a bag) they always count as fabric.
  const skip = (c) => skinLikely && isSkin(c.rgb) && c.share < 0.45;
  let usable = clusters.filter((c) => c.share >= 0.12 && !skip(c) && !bg.some((b) => deltaE(b.rgb, c.rgb) < 12));
  // Two shades of the same fabric (light and shadow) count together.
  usable = usable.reduce((acc, c) => {
    const twin = acc.find((a) => deltaE(a.rgb, c.rgb) < 16);
    if (twin) {
      const total = twin.share + c.share;
      twin.rgb = twin.rgb.map((v, k) => Math.round((v * twin.share + c.rgb[k] * c.share) / total));
      twin.share = total;
    } else acc.push({ ...c });
    return acc;
  }, []).sort((a, b) => b.share - a.share);
  const pick = usable[0] || clusters.find((c) => !isSkin(c.rgb)) || clusters[0];
  const lab = rgbToLab(pick.rgb);
  return { name: nameColor(pick.rgb), hex: toHex(pick.rgb), lightness: Math.round(lab[0]), blueness: Math.round(-lab[2]), share: +pick.share.toFixed(2) };
}

/** Denim is described by its wash, not as "grey" or "light blue". */
export function denimWash(color) {
  if (!color) return null;
  if (["black", "charcoal"].includes(color.name)) return color.blueness >= 4 ? "dark wash" : "black";
  if (!["grey", "light grey", "blue", "denim blue", "light blue", "navy", "white"].includes(color.name)) return null;
  if (color.lightness >= 60) return "light wash";
  if (color.lightness >= 42) return "mid wash";
  return "dark wash";
}

/** Strips at the image edges, level with the window: what the background looks like there. */
export function backgroundStrips(win) {
  return [{ x: 0, y: win.y, w: 0.1, h: win.h }, { x: 0.9, y: win.y, w: 0.1, h: win.h }];
}

// Where to look for colour inside a detection window, per garment group.
// Jackets are sampled at the sides (the middle is often the shirt underneath).
export const COLOR_REGIONS = {
  outerwear: [{ x: 0.18, y: 0.3, w: 0.2, h: 0.5 }, { x: 0.62, y: 0.3, w: 0.2, h: 0.5 }],
  top: [{ x: 0.38, y: 0.35, w: 0.24, h: 0.4 }],
  dress: [{ x: 0.36, y: 0.3, w: 0.28, h: 0.5 }],
  bottom: [{ x: 0.3, y: 0.2, w: 0.18, h: 0.5 }, { x: 0.52, y: 0.2, w: 0.18, h: 0.5 }],
  footwear: [{ x: 0.25, y: 0.45, w: 0.5, h: 0.45 }],
  default: [{ x: 0.3, y: 0.3, w: 0.4, h: 0.4 }],
};

/** Map regions given relative to a window onto the whole image. */
export function regionsInWindow(win, group) {
  const rel = COLOR_REGIONS[group] || COLOR_REGIONS.default;
  return rel.map((r) => ({ x: win.x + r.x * win.w, y: win.y + r.y * win.h, w: r.w * win.w, h: r.h * win.h }));
}

// Hebrew colour words as [m, f, mp, fp]; one word means it doesn't change.
const HE_COLOR = {
  black: ["שחור", "שחורה", "שחורים", "שחורות"],
  charcoal: ["אפור כהה", "אפורה כהה", "אפורים כהים", "אפורות כהות"],
  grey: ["אפור", "אפורה", "אפורים", "אפורות"],
  "light grey": ["אפור בהיר", "אפורה בהירה", "אפורים בהירים", "אפורות בהירות"],
  white: ["לבן", "לבנה", "לבנים", "לבנות"],
  cream: ["שמנת"],
  beige: ["בז'"],
  camel: ["קאמל"],
  brown: ["חום", "חומה", "חומים", "חומות"],
  olive: ["ירוק זית", "ירוקה זית", "ירוקים זית", "ירוקות זית"],
  khaki: ["חאקי"],
  green: ["ירוק", "ירוקה", "ירוקים", "ירוקות"],
  "forest green": ["ירוק כהה", "ירוקה כהה", "ירוקים כהים", "ירוקות כהות"],
  navy: ["כחול כהה", "כחולה כהה", "כחולים כהים", "כחולות כהות"],
  blue: ["כחול", "כחולה", "כחולים", "כחולות"],
  "denim blue": ["כחול", "כחולה", "כחולים", "כחולות"],
  "light blue": ["תכלת"],
  red: ["אדום", "אדומה", "אדומים", "אדומות"],
  burgundy: ["בורדו"],
  pink: ["ורוד", "ורודה", "ורודים", "ורודות"],
  purple: ["סגול", "סגולה", "סגולים", "סגולות"],
  lavender: ["לבנדר"],
  yellow: ["צהוב", "צהובה", "צהובים", "צהובות"],
  "butter yellow": ["צהוב חמאה", "צהובה חמאה", "צהובים חמאה", "צהובות חמאה"],
  orange: ["כתום", "כתומה", "כתומים", "כתומות"],
  // denim washes
  "light wash": ["בהיר", "בהירה", "בהירים", "בהירות"],
  "mid wash": ["בשטיפה בינונית"],
  "dark wash": ["כהה", "כהה", "כהים", "כהות"],
};
const FORM = { m: 0, f: 1, mp: 2, fp: 3 };

/** A colour name in Hebrew, agreeing with a noun of gender/number `g` (m, f, mp, fp). */
export function colorHe(name, g = "m") {
  const forms = HE_COLOR[name];
  if (!forms) return name;
  return forms[forms.length === 1 ? 0 : FORM[g] || 0];
}
