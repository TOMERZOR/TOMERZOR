#!/usr/bin/env node
// Lists every purple color in the game's own code. The redesign has no purple
// anywhere (REDESIGN-PROMPT.md, section 5.3).
//
// "Purple" is OKLCH hue 268-340 degrees with chroma above 0.02. That covers
// violet, indigo, lavender, plum and magenta, and also the almost-black
// backgrounds with a purple tint. Plain blue (#0000FF is 264), sky blue,
// pink and near-neutral grays stay allowed.
//
// It reads hex colors, rgb(), hsl(), oklch(), purple CSS color names and
// purple emoji in .css .js .mjs .html .svg .json .webmanifest files. It skips
// node_modules, vendor, brag-output, .wrangler and this folder.
//
//   node redesign/tools/check-colors.mjs     # exit code 1 if anything is found

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SELF = fileURLToPath(new URL(".", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", "vendor", "brag-output", ".wrangler", ".git"]);
const SKIP_FILES = new Set(["package.json", "package-lock.json"]);
const EXTS = new Set([".css", ".js", ".mjs", ".html", ".svg", ".json", ".webmanifest"]);

const HUE_MIN = 268, HUE_MAX = 340, CHROMA_MIN = 0.02;

// CSS color names that can be purple; each still goes through the hue test.
const NAMED = {
  purple: "#800080", violet: "#ee82ee", indigo: "#4b0082", lavender: "#e6e6fa",
  magenta: "#ff00ff", fuchsia: "#ff00ff", orchid: "#da70d6", plum: "#dda0dd",
  thistle: "#d8bfd8", mediumpurple: "#9370db", blueviolet: "#8a2be2",
  darkviolet: "#9400d3", darkorchid: "#9932cc", mediumorchid: "#ba55d3",
  rebeccapurple: "#663399", slateblue: "#6a5acd", mediumslateblue: "#7b68ee",
  darkslateblue: "#483d8b", darkmagenta: "#8b008b", mediumvioletred: "#c71585",
};
const EMOJI = ["🟪", "🟣", "💜", "🔮", "🍇", "🍆", "😈", "👿"];

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function oklch([r, g, b]) {
  [r, g, b] = [r, g, b].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function hexRgb(hex) {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((x) => x + x).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function hslRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

const purple = ({ c, h }) => c > CHROMA_MIN && h >= HUE_MIN && h <= HUE_MAX;
const describe = ({ c, h }) => `OKLCH hue ${h.toFixed(0)}, chroma ${c.toFixed(3)}`;

function findings(text) {
  const out = [];
  const add = (index, what, lch) => out.push({ index, what, why: lch ? describe(lch) : "purple emoji" });
  for (const m of text.matchAll(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)) {
    const lch = oklch(hexRgb(m[0]));
    if (purple(lch)) add(m.index, m[0], lch);
  }
  for (const m of text.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g)) {
    const lch = oklch([+m[1], +m[2], +m[3]]);
    if (purple(lch)) add(m.index, m[0] + ")", lch);
  }
  for (const m of text.matchAll(/hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/g)) {
    const lch = oklch(hslRgb(((+m[1] % 360) + 360) % 360, +m[2], +m[3]));
    if (purple(lch)) add(m.index, m[0] + ")", lch);
  }
  for (const m of text.matchAll(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/g)) {
    const lch = { c: +m[2], h: +m[3] };
    if (purple(lch)) add(m.index, m[0] + ")", lch);
  }
  const names = Object.keys(NAMED).join("|");
  for (const m of text.matchAll(new RegExp(`(?<=[:=(,'"\`]\\s*)(${names})\\b`, "gi"))) {
    const lch = oklch(hexRgb(NAMED[m[1].toLowerCase()]));
    if (purple(lch)) add(m.index, m[1], lch);
  }
  for (const e of EMOJI) {
    let i = text.indexOf(e);
    while (i !== -1) {
      add(i, e, null);
      i = text.indexOf(e, i + e.length);
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name) && p + "/" !== SELF && p !== SELF.replace(/\/$/, "")) yield* files(p);
    } else if (EXTS.has(extname(name)) && !SKIP_FILES.has(basename(name))) {
      yield p;
    }
  }
}

let count = 0;
for (const file of files(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const f of findings(text)) {
    const line = text.slice(0, f.index).split("\n").length;
    console.log(`${relative(ROOT, file)}:${line}  ${f.what}  (${f.why})`);
    count++;
  }
}
console.log(count ? `\n${count} purple color(s) found.` : "No purple found.");
process.exit(count ? 1 : 0);
