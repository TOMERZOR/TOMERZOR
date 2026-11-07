// The video, scene by scene. Built from private/data.json (made by build-data.py), so names and
// numbers come straight from the form. See engine.js for the frame model.
"use strict";

// ---------------------------------------------------------------- fonts
const HEB = "U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F";
const LAT = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2190-2199, U+2212, U+2215, U+FEFF, U+FFFD";
const FONTS = [
  ["Rubik", "rubik-hebrew-wght-normal", "rubik-latin-wght-normal", "300 900"],
  ["Suez One", "suez-one-hebrew-400-normal", "suez-one-latin-400-normal", "400"],
  ["Frank Ruhl Libre", "frank-ruhl-libre-hebrew-700-normal", "frank-ruhl-libre-latin-700-normal", "700"],
  ["Frank Ruhl Libre", "frank-ruhl-libre-hebrew-900-normal", "frank-ruhl-libre-latin-900-normal", "900"],
  ["Secular One", "secular-one-hebrew-400-normal", "secular-one-latin-400-normal", "400"],
  ["Rubik Glitch", "rubik-glitch-hebrew-400-normal", "rubik-glitch-latin-400-normal", "400"],
  ["Rubik Wet Paint", "rubik-wet-paint-hebrew-400-normal", "rubik-wet-paint-latin-400-normal", "400"],
  ["Rubik Bubbles", "rubik-bubbles-hebrew-400-normal", "rubik-bubbles-latin-400-normal", "400"],
  ["Rubik Burned", "rubik-burned-hebrew-400-normal", "rubik-burned-latin-400-normal", "400"],
  ["Rubik Moonrocks", "rubik-moonrocks-hebrew-400-normal", "rubik-moonrocks-latin-400-normal", "400"],
  ["Rubik Doodle Shadow", "rubik-doodle-shadow-hebrew-400-normal", "rubik-doodle-shadow-latin-400-normal", "400"],
  ["Rubik Spray Paint", "rubik-spray-paint-hebrew-400-normal", "rubik-spray-paint-latin-400-normal", "400"],
];
function injectFonts() {
  const st = document.createElement("style");
  st.textContent = FONTS.map(([fam, he, la, wt]) =>
    `@font-face{font-family:"${fam}";src:url(fonts/${he}.woff2) format("woff2");font-weight:${wt};unicode-range:${HEB}}` +
    `@font-face{font-family:"${fam}";src:url(fonts/${la}.woff2) format("woff2");font-weight:${wt};unicode-range:${LAT}}`).join("\n");
  document.head.appendChild(st);
}
async function loadFonts() {
  await Promise.all(FONTS.map(([fam, , , wt]) => document.fonts.load(`${wt.split(" ").pop()} 40px "${fam}"`, "אבגד abc 0123")));
  await document.fonts.ready;
}

// ---------------------------------------------------------------- themes
const THEMES = {
  funny: { color: "#ffb703", rgb: "255,183,3", bg: ["#3a2100", "#0b0600"], font: "Rubik Doodle Shadow", pre: "", main: "המצחיק", post: "של הפלגה",
    icons: ["face-with-tears-of-joy", "rolling-on-the-floor-laughing", "grinning-squinting-face", "zany-face", "face-with-hand-over-mouth"], sfx: "s_laugh", motif: "funny" },
  slacker: { color: "#6fd3f0", rgb: "111,211,240", bg: ["#0b2a3a", "#03090d"], font: "Rubik Spray Paint", pre: "", main: "החפשן", post: "של הפלגה",
    icons: ["sleeping-face", "couch-and-lamp", "zzz", "sloth", "bed"], sfx: "s_yawn", motif: "slacker" },
  mom: { color: "#ff8fab", rgb: "255,143,171", bg: ["#3d1324", "#0d0408"], font: "Suez One", pre: "", main: "המאמא", post: "של הפלגה",
    icons: ["pot-of-food", "red-heart", "smiling-face-with-hearts", "hugging-face", "woman-cook"], sfx: "s_aww", motif: "mom" },
  couple: { color: "#ff4d6d", rgb: "255,77,109", bg: ["#420a1c", "#0e0206"], font: "Secular One", pre: "", main: "הזוג", post: "של הפלגה",
    icons: ["two-hearts", "ring", "kiss-mark", "sparkling-heart", "face-blowing-a-kiss"], sfx: "s_harp", motif: "couple" },
  yellow: { color: "#ffe600", rgb: "255,230,0", bg: ["#363000", "#0b0a00"], font: "Rubik Wet Paint", pre: "", main: "הצהוב", post: "של הפלגה",
    icons: ["yellow-heart", "artist-palette", "high-voltage", "star-struck"], sfx: "s_splash", motif: "yellow" },
  lions: { color: "#ff9f1c", rgb: "255,159,28", bg: ["#361800", "#0b0500"], font: "Suez One", pre: "", main: "מפנק האריות", post: "של הפלגה",
    icons: ["lion", "crown", "hamburger", "pizza", "doughnut", "chocolate-bar", "cookie", "french-fries", "taco", "ice-cream", "hot-dog", "cupcake"], sfx: "s_roar", motif: "lions" },
  burnt: { color: "#ff5a1f", rgb: "255,90,31", bg: ["#241008", "#050202"], font: "Rubik Burned", pre: "", main: "המושחר/ת", post: "של הפלגה",
    icons: ["fire", "black-heart", "skull", "dashing-away", "stopwatch"], sfx: "s_burn", motif: "burnt" },
  staff: { color: "#4cc9f0", rgb: "76,201,240", bg: ["#082847", "#02070e"], font: "Frank Ruhl Libre", weight: 900, pre: "", main: "איש הסגל", post: "המועדף",
    icons: ["saluting-face", "military-medal", "glowing-star", "star", "shield"], sfx: "s_bugle", motif: "staff" },
  moment: { color: "#e9c46a", rgb: "233,196,106", bg: ["#2e2209", "#080602"], font: "Frank Ruhl Libre", weight: 900, pre: "", main: "הרגע המכונן", post: "של הפלגה",
    icons: ["film-projector", "clapper-board", "film-frames", "popcorn"], sfx: "s_projector", motif: "moment" },
  lol: { color: "#ffd60a", rgb: "255,214,10", bg: ["#332900", "#0a0800"], font: "Rubik Doodle Shadow", pre: "", main: "הרגע המצחיק", post: "של הפלגה",
    icons: ["rolling-on-the-floor-laughing", "face-with-tears-of-joy", "face-with-hand-over-mouth", "grinning-squinting-face"], sfx: "s_laugh", motif: "lol" },
  forget: { color: "#b388ff", rgb: "179,136,255", bg: ["#1d0e3a", "#05020c"], font: "Rubik Glitch", pre: "הרגע שהייתי", main: "מעדיף לשכוח", post: "",
    icons: ["see-no-evil-monkey", "face-with-spiral-eyes", "dizzy", "ghost", "exploding-head"], sfx: "s_glitch", motif: "forget" },
  baby: { color: "#9be7ff", rgb: "155,231,255", bg: ["#123447", "#040b10"], font: "Rubik Bubbles", pre: "", main: "התינוקי הפוץ", post: "של הפלגה",
    icons: ["baby", "baby-bottle", "teddy-bear", "balloon"], sfx: "s_baby", motif: "baby" },
  model: { color: "#ff4fa3", rgb: "255,79,163", bg: ["#33052a", "#0a0108"], font: "Frank Ruhl Libre", weight: 900, pre: "הכי", main: "מדוגם", post: "של הפלגה",
    icons: ["camera-with-flash", "smiling-face-with-sunglasses", "sparkles", "lipstick", "high-heeled-shoe"], sfx: "s_runway", motif: "model" },
  weird: { color: "#7dffd4", rgb: "125,255,212", bg: ["#043029", "#010806"], font: "Rubik Moonrocks", pre: "הכי", main: "מוזר", post: "של הפלגה",
    icons: ["alien", "flying-saucer", "upside-down-face", "woozy-face", "red-question-mark", "eyes"], sfx: "s_ufo", motif: "weird" },
};
const GOLD_RGB = "255,205,110";

// ---------------------------------------------------------------- helpers
let DATA, FACES;
const SHORT = new URLSearchParams(location.search).has("short"); // the ~3 minute cut
const LANDSCAPE = new Set();
function P(tag, cls, parent, html) { const e = el(tag, "p " + (cls || ""), parent, html); return e; }
function layer(root) { const L = P("div", "", root); L.style.width = W + "px"; L.style.height = H + "px"; return L; }
function put(e, x, y, s = 1, r = 0, o = 1, extra = "") {
  css(e, { transform: `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(+s).toFixed(4)}) rotate(${r.toFixed(2)}deg)${extra}` });
  vis(e, o);
}
const pop = (t, a, d = 0.5) => E.outBack(seg(t, a, a + d), 2.2);
function shine(e, t, period = 3.2, off = 0) { // sweep a highlight across gold text
  const p = ((t + off) % period) / period;
  css(e, { backgroundPosition: `${(130 - p * 260).toFixed(1)}% 0, 0 0` });
}
function words(e, text) {
  e.innerHTML = "";
  const out = [];
  text.split(" ").forEach((w, i, a) => {
    const s = el("span", "w", e, w + (i < a.length - 1 ? " " : ""));
    out.push(s);
  });
  return out;
}
function chars(e, text) {
  e.innerHTML = "";
  return [...text].map((c) => el("span", "w", e, c));
}
function themeText(e, th, spans) { // spans paint their own gradient (see .gold-spans)
  e.style.fontFamily = `"${th.font}"`;
  if (th.weight) e.style.fontWeight = th.weight;
  e.style.filter = `drop-shadow(0 6px 0 rgba(0,0,0,.75)) drop-shadow(0 0 40px rgba(${th.rgb},.45))`;
  e.style.lineHeight = "1.15";
  e.style.padding = "0 30px";
  for (const s of spans) {
    s.style.backgroundImage = `linear-gradient(180deg, #ffffff 0%, ${th.color} 58%, ${shade(th.color, -0.35)} 100%)`;
    s.style.webkitBackgroundClip = "text";
    s.style.backgroundClip = "text";
    s.style.color = "transparent";
  }
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
const STATUE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 360"><defs>
<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#6e4810"/><stop offset=".22" stop-color="#d9a843"/><stop offset=".42" stop-color="#fff3c4"/><stop offset=".58" stop-color="#e2b14d"/><stop offset=".85" stop-color="#8c5f16"/><stop offset="1" stop-color="#5a3a0b"/></linearGradient>
<linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#120b05"/><stop offset=".5" stop-color="#3d2a14"/><stop offset="1" stop-color="#0e0804"/></linearGradient></defs>
<ellipse cx="60" cy="33" rx="12.5" ry="14.5" fill="url(#g)"/>
<path d="M37 62 Q60 46 83 62 L81 102 Q77 114 75 132 L71 232 Q69 270 67 300 L53 300 Q51 270 49 232 L45 132 Q43 114 39 102 Z" fill="url(#g)"/>
<path d="M39 96 Q60 108 81 96 L80 112 Q60 122 40 112 Z" fill="#a8761f" opacity=".85"/>
<rect x="58.4" y="108" width="3.2" height="186" fill="#7a5212" opacity=".7"/>
<line x1="60" y1="244" x2="60" y2="300" stroke="#6b470f" stroke-width="1.6"/>
<rect x="24" y="300" width="72" height="14" rx="3" fill="url(#g)"/>
<rect x="18" y="314" width="84" height="32" rx="4" fill="url(#b)"/>
<rect x="14" y="344" width="92" height="12" rx="3" fill="url(#g)"/></svg>`;
const STATUE_URL = () => URL.createObjectURL(new Blob([STATUE], { type: "image/svg+xml" }));
let statueURL;
function statue(parent, h) {
  const i = el("img", "p", parent);
  i.src = statueURL;
  i.style.height = h + "px";
  i.style.width = (h / 3) + "px";
  i.style.filter = "drop-shadow(0 0 30px rgba(255,200,90,.55)) drop-shadow(0 20px 30px rgba(0,0,0,.6))";
  PRELOAD.push(i);
  return i;
}
function faceSrc(name) { return FACES.has(name) ? `private/faces/${name}.jpg` : null; }
function personOf(label) { // "לירן" or "לירן וכת מבצעית" -> "לירן"; "שקד יובל" -> none
  if (FACES.has(label)) return label;
  const m = label.match(/^(\S+) ו/);
  return m && FACES.has(m[1]) ? m[1] : null;
}
function splitCouple(label) {
  const m = label.match(/^(\S+) ו(\S+)$/);
  return m ? [m[1], m[2]] : null;
}
// a face in a metal ring; unknown names get their first letter on a gold disc
function faceRing(parent, name, size, metal = "", iconName) {
  const r = P("div", "ring " + metal, parent);
  r.style.width = r.style.height = size + "px";
  const f = el("div", "face", r);
  const src = faceSrc(name);
  if (iconName) {
    f.style.background = "radial-gradient(circle at 40% 35%, #fff4d6, #f1c56b 60%, #a8761f)";
    const ic = icon(iconName, size * 0.66, f);
    ic.style.left = ic.style.top = (size * 0.17 - 10) + "px";
  } else if (src) {
    img(src, "", f);
  } else {
    const d = el("div", "ini", f, name === "?" ? "?" : [...name][0]);
    d.style.fontSize = size * 0.5 + "px";
  }
  return r;
}
// one result entry: a face, a couple (two faces and a heart) or a special case
function entryVisual(parent, label, size, metal) {
  const box = P("div", "", parent);
  box.style.width = size * 1.5 + "px";
  box.style.height = size + "px";
  const couple = splitCouple(label);
  if (label === "אמא של אופק") {
    const r = faceRing(box, label, size, metal, "woman-cook");
    r.style.left = size * 0.25 + "px";
    const b = faceRing(box, "אופק", size * 0.42, metal);
    b.style.left = size * 0.02 + "px";
    b.style.top = size * 0.6 + "px";
  } else if (couple) {
    const a = faceRing(box, couple[0], size * 0.8, metal);
    const b = faceRing(box, couple[1], size * 0.8, metal);
    a.style.left = size * 0.68 + "px"; a.style.top = size * 0.1 + "px";
    b.style.left = size * 0.02 + "px"; b.style.top = size * 0.1 + "px";
    const h = icon("red-heart", size * 0.38, box);
    h.style.left = size * 0.56 + "px"; h.style.top = size * 0.62 + "px";
  } else {
    const r = faceRing(box, personOf(label) || label, size, metal);
    r.style.left = size * 0.25 + "px";
  }
  return box;
}
const votesText = (v) => (v === 1 ? "קול אחד" : `${v} קולות`);
const RANK = ["מקום ראשון", "מקום שני", "מקום שלישי"];
const MEDAL = ["1st-place-medal", "2nd-place-medal", "3rd-place-medal"];
const METAL = ["", "silver", "bronze"];
const METAL_GRAD = [
  "linear-gradient(180deg,#fff8dc,#ffe18a 30%,#d9a33a 55%,#ffe7a0 72%,#b07a1c)",
  "linear-gradient(180deg,#ffffff,#e6ebf2 30%,#9aa4b1 55%,#f4f6fa 72%,#6d7684)",
  "linear-gradient(180deg,#ffe3c8,#f2b27a 30%,#b06a32 55%,#ffd2a8 72%,#7d4418)",
];
function metalText(e, i) {
  e.style.backgroundImage = METAL_GRAD[i];
  e.style.webkitBackgroundClip = "text";
  e.style.backgroundClip = "text";
  e.style.color = "transparent";
  e.style.filter = "drop-shadow(0 4px 0 rgba(0,0,0,.7)) drop-shadow(0 0 24px rgba(0,0,0,.4))";
}
function setThemeEnv(th, k = 1) {
  ENV.tint = th.bg[0];
  ENV.tint2 = th.bg[1];
  ENV.glowColor = th.rgb;
  ENV.bokehColor = th.rgb;
  ENV.glow = 0.7 * k;
}

// ---------------------------------------------------------------- floating icons
// icons scattered around the edges of the frame, each bobbing on its own phase
function floaters(parent, names, n, seed, opts = {}) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < n; i++) {
    let x, y;
    do { x = 90 + r() * (W - 180); y = 90 + r() * (H - 180); } while (x > 380 && x < W - 380 && y > 230 && y < H - 200);
    const size = (opts.min || 90) + r() * ((opts.max || 170) - (opts.min || 90));
    const e = icon(names[i % names.length], size, parent);
    list.push({ e, x, y, ph: r() * 6.28, sp: 0.8 + r() * 0.8, rot: (r() - 0.5) * 30, d: r() * 0.6 });
  }
  return (lt, k = 1, out = 0) => {
    for (const f of list) {
      const s = pop(lt, 0.25 + f.d, 0.55) * (1 - E.inBack(out));
      const bob = Math.sin(lt * 2 * f.sp + f.ph) * 16;
      put(f.e, f.x + Math.cos(lt * f.sp + f.ph) * 10, f.y + bob - out * 120, s, f.rot + Math.sin(lt * f.sp + f.ph) * 8, k * clamp(s * 2));
    }
  };
}

// ---------------------------------------------------------------- category motifs (title cards)
function motif(name, root, th, seed) {
  const L = layer(root);
  const parts = [];
  const add = (f) => parts.push(f);
  const r = rng(seed);
  if (name === "funny" || name === "lol") {
    if (name === "lol") { // halftone comic dots
      const dots = P("div", "", L);
      Object.assign(dots.style, { width: W + "px", height: H + "px", backgroundImage: `radial-gradient(rgba(${th.rgb},.22) 28%, transparent 30%)`, backgroundSize: "34px 34px" });
      add((lt) => put(dots, W / 2, H / 2, 1 + lt * 0.02, 0, clamp(lt * 2) * 0.9));
    }
    const faces = [];
    for (let i = 0; i < 9; i++) {
      let x, y; do { x = 110 + r() * (W - 220); y = 140 + r() * (H - 260); } while ((x > 300 && x < W - 300 && y > 250 && y < H - 200) || (x > 600 && x < W - 600 && y < 250));
      faces.push({ e: icon(th.icons[i % th.icons.length], 100 + r() * 60, L), x, y, ph: r() * 6.28, d: r() * 0.7 });
    }
    add((lt) => faces.forEach((f) => {
      const b = Math.abs(Math.sin(lt * 4.2 + f.ph));
      const sq = 1 + (b < 0.15 ? (0.15 - b) * 1.6 : 0);
      put(f.e, f.x, f.y - b * 46, pop(lt, 0.3 + f.d), Math.sin(lt * 3 + f.ph) * 10, 1, ` scaleX(${sq.toFixed(3)}) scaleY(${(2 - sq).toFixed(3)})`);
    }));
    const has = ["חחחח", "חחחחח!", "LOL", "חח", "חחחחחח"];
    const bubbles = [[360, 260, -12], [1560, 300, 10], [300, 820, 8], [1620, 800, -8], [960, 960, 0]].map(([x, y, rr], i) => {
      const e = P("div", "", L, has[i]);
      Object.assign(e.style, { fontFamily: '"Rubik Doodle Shadow"', fontSize: "78px", color: "#fff", background: th.color, padding: "4px 26px", borderRadius: "40px", boxShadow: "0 10px 0 rgba(0,0,0,.5)", whiteSpace: "nowrap" });
      return { e, x, y, rr, d: 1 + i * 0.45 };
    });
    add((lt) => bubbles.forEach((b) => put(b.e, b.x, b.y, pop(lt, b.d, 0.4) * (1 + Math.sin(lt * 6 + b.d) * 0.04), b.rr, clamp((lt - b.d) * 5))));
  }
  if (name === "slacker") {
    const couch = icon("couch-and-lamp", 330, L), sleep = icon("sleeping-face", 230, L);
    add((lt) => { put(couch, 290, 790, pop(lt, 0.3), -4); put(sleep, 1610, 770, pop(lt, 0.5), Math.sin(lt * 1.4) * 6); });
    const zs = Array.from({ length: 7 }, (_, i) => { const e = P("div", "", L, "Z"); Object.assign(e.style, { fontFamily: '"Suez One"', color: "#bdefff", fontSize: 50 + i * 12 + "px", textShadow: "0 0 20px rgba(111,211,240,.8)" }); return e; });
    add((lt) => zs.forEach((z, i) => { const a = ((lt * 0.55 + i / 7) % 1); put(z, 1660 + a * 160 + Math.sin(a * 9) * 20, 650 - a * 420, 0.6 + a, -12, clamp(lt - 0.6) * Math.sin(a * Math.PI)); }));
    const bar = P("div", "", L); Object.assign(bar.style, { width: "720px", height: "88px", borderRadius: "44px", background: "rgba(0,0,0,.55)", boxShadow: "inset 0 0 0 3px rgba(189,239,255,.6)", overflow: "hidden" });
    const fill = el("div", "", bar); Object.assign(fill.style, { position: "absolute", top: "8px", bottom: "8px", right: "8px", borderRadius: "36px", background: "linear-gradient(90deg,#6fd3f0,#bdefff)" });
    const lab = el("div", "", bar); Object.assign(lab.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", fontWeight: "800", fontSize: "36px", color: "#fff", textShadow: "0 2px 6px #000" });
    add((lt) => {
      const p = lt < 2.6 ? lerp(0, 0.14, E.outC(seg(lt, 1.2, 2.6))) : lerp(0.14, 0.02, E.outBounce(seg(lt, 2.8, 3.6)));
      css(fill, { width: (p * 704).toFixed(1) + "px" });
      lab.textContent = `טוען מוטיבציה… ${Math.round(p * 100)}%`;
      put(bar, W / 2, 965, 1, 0, clamp((lt - 1) * 3));
    });
  }
  if (name === "mom") {
    const pot = icon("pot-of-food", 280, L), cook = icon("woman-cook", 230, L);
    add((lt) => { put(pot, 300, 800, pop(lt, 0.3), Math.sin(lt * 2) * 3); put(cook, 1620, 780, pop(lt, 0.5), Math.sin(lt * 1.6) * 5); });
    const steam = Array.from({ length: 5 }, () => { const e = P("div", "", L); Object.assign(e.style, { width: "46px", height: "90px", borderRadius: "50%", background: "rgba(255,255,255,.22)", filter: "blur(12px)" }); return e; });
    add((lt) => steam.forEach((s, i) => { const a = (lt * 0.45 + i / 5) % 1; put(s, 300 + Math.sin(a * 7 + i) * 30, 690 - a * 190, 0.6 + a * 0.6, 0, Math.sin(a * Math.PI) * clamp(lt - 0.5)); }));
    hearts(L, add, th, 26, seed);
  }
  if (name === "couple") {
    const h1 = icon("red-heart", 260, L), h2 = icon("red-heart", 260, L), ringI = icon("ring", 170, L);
    add((lt) => {
      const p = E.inC(seg(lt, 0.4, 1.25)), hit = lt > 1.25;
      put(h1, lerp(-200, 840, p), 540, hit ? 0 : 1, 10, hit ? 0 : 1);
      put(h2, lerp(W + 200, 1080, p), 540, hit ? 0 : 1, -10, hit ? 0 : 1);
      put(ringI, 1600, 220, pop(lt, 1.4), Math.sin(lt * 2) * 10, 1);
    });
    hearts(L, add, th, 22, seed + 1);
  }
  if (name === "yellow") {
    const splats = Array.from({ length: 7 }, (_, i) => {
      const e = P("div", "", L);
      const s = 240 + r() * 120;
      Object.assign(e.style, { width: s + "px", height: s + "px", background: th.color, borderRadius: `${40 + r() * 30}% ${30 + r() * 40}% ${45 + r() * 30}% ${35 + r() * 30}% / ${35 + r() * 30}% ${40 + r() * 30}% ${30 + r() * 40}% ${45 + r() * 30}%`, boxShadow: "inset -20px -30px 0 rgba(0,0,0,.12)" });
      const [x, y] = [[150, 330], [1770, 300], [230, 900], [1690, 880], [560, 1060], [1330, 1070], [960, -40]][i];
      return { e, x, y, d: 0.3 + i * 0.18, rot: r() * 360 };
    });
    add((lt) => splats.forEach((s) => put(s.e, s.x, s.y, E.outElastic(seg(lt, s.d, s.d + 0.7)), s.rot, 0.92)));
    const tapes = [[-8, 160, 1], [6, 930, -1]].map(([rot, y, dir]) => { const t = P("div", "tape", L); t.style.width = "2600px"; t.innerHTML = "<span>זהירות: צהוב · זהירות: צהוב · זהירות: צהוב · זהירות: צהוב</span>"; return { t, rot, y, dir }; });
    add((lt) => tapes.forEach((tp) => put(tp.t, W / 2 + tp.dir * (lt * 90 - 120), tp.y, 1, tp.rot, clamp((lt - 0.8) * 3))));
  }
  if (name === "lions") {
    const lion = icon("lion", 380, L), crown = icon("crown", 170, L);
    add((lt) => { const b = Math.sin(lt * 2.2) * 10; put(lion, 1590, 720 + b, pop(lt, 1.35, 0.4), -4); put(crown, 1600, 520 + b - (1 - E.outBounce(seg(lt, 1.8, 2.5))) * 500, 1, 12, clamp((lt - 1.8) * 6)); });
    const foods = th.icons.slice(2);
    const rain = Array.from({ length: 30 }, (_, i) => ({ e: icon(foods[i % foods.length], 70 + r() * 70, L), x: r() * W, sp: 260 + r() * 260, ph: r() * 1400, rot: r() * 360, vr: (r() - 0.5) * 200 }));
    add((lt) => rain.forEach((f) => { const y = ((f.ph + lt * f.sp) % 1400) - 160; put(f.e, f.x, y, 1, f.rot + f.vr * lt, clamp((lt - 0.4) * 2) * 0.95); }));
  }
  if (name === "burnt") {
    const fires = Array.from({ length: 11 }, (_, i) => ({ e: icon("fire", 150 + r() * 60, L), x: 80 + i * 176, ph: r() * 6.28 }));
    add((lt) => fires.forEach((f) => put(f.e, f.x, 1010 + Math.sin(lt * 9 + f.ph) * 6, (0.9 + noise1(lt * 6, f.ph) * 0.15) * E.outC(seg(lt, 0.2, 0.8)), noise1(lt * 3, f.ph + 3) * 6, 1)));
    const soot = Array.from({ length: 40 }, () => { const e = P("div", "", L); const s = 6 + r() * 16; Object.assign(e.style, { width: s + "px", height: s + "px", borderRadius: "50%", background: "rgba(20,10,5,.85)", boxShadow: "0 0 8px rgba(255,90,31,.4)" }); return { e, x: r() * W, sp: 60 + r() * 120, ph: r() * 1200 }; });
    add((lt) => soot.forEach((s) => { const y = H - ((s.ph + lt * s.sp) % 1200); put(s.e, s.x + Math.sin(lt + s.ph) * 30, y, 1, 0, clamp(lt - 0.3)); }));
    const grid = shiftGrid(L, ["?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?"], th);
    add((lt) => { put(grid.box, 225, 745, 0.55, -4, clamp((lt - 1) * 3)); grid.update(lt - 1.2, 0.2); });
    const bh = icon("black-heart", 180, L);
    add((lt) => put(bh, 1640, 400, pop(lt, 0.8), Math.sin(lt * 2) * 8));
  }
  if (name === "staff") {
    const burstEl = P("div", "", L);
    Object.assign(burstEl.style, { width: "1700px", height: "1700px", borderRadius: "50%", background: `repeating-conic-gradient(rgba(${th.rgb},.16) 0 7deg, transparent 7deg 15deg)`, maskImage: "radial-gradient(circle, #000 20%, transparent 68%)", webkitMaskImage: "radial-gradient(circle, #000 20%, transparent 68%)" });
    add((lt) => put(burstEl, W / 2, 520, 1, lt * 8, clamp(lt * 2)));
    const med = icon("military-medal", 230, L), sal = icon("saluting-face", 240, L);
    add((lt) => { put(med, 300, 300, pop(lt, 0.4), Math.sin(lt * 2.4) * 14); put(sal, 1610, 760, pop(lt, 0.7), Math.sin(lt * 1.3) * 4); });
    const stars = Array.from({ length: 14 }, (_, i) => { let x, y; do { x = 100 + r() * (W - 200); y = 100 + r() * (H - 200); } while ((x > 420 && x < W - 420 && y > 250 && y < H - 230) || (x > 600 && x < W - 600 && y < 250)); return { e: icon(i % 2 ? "star" : "glowing-star", 60 + r() * 60, L), x, y, ph: r() * 6.28 }; });
    add((lt) => stars.forEach((s) => put(s.e, s.x, s.y, (0.75 + 0.25 * Math.sin(lt * 3 + s.ph)) * pop(lt, 0.3 + s.ph / 10), lt * 20, 1)));
  }
  if (name === "moment") {
    for (const y of [0, H - 120]) {
      const strip = P("div", "", L);
      Object.assign(strip.style, { width: W + 400 + "px", height: "120px", background: "#0b0805", backgroundImage: "repeating-linear-gradient(90deg, transparent 0 22px, rgba(255,240,210,.85) 22px 52px, transparent 52px 80px)", backgroundSize: "80px 34px", backgroundRepeat: "repeat-x", backgroundPosition: "0 14px", boxShadow: "0 0 30px rgba(0,0,0,.8)" });
      const strip2 = el("div", "", strip); Object.assign(strip2.style, { position: "absolute", left: 0, right: 0, bottom: "14px", height: "34px", backgroundImage: "repeating-linear-gradient(90deg, transparent 0 22px, rgba(255,240,210,.85) 22px 52px, transparent 52px 80px)" });
      add((lt) => put(strip, W / 2 - ((lt * 160) % 80), y + 60, 1, 0, clamp(lt * 3)));
    }
    const proj = icon("film-projector", 260, L), clap = icon("clapper-board", 220, L), pop2 = icon("popcorn", 170, L);
    add((lt) => { put(proj, 300, 560, pop(lt, 0.3), Math.sin(lt * 18) * 0.8); put(clap, 1620, 520, pop(lt, 0.6), lt > 1.4 && lt < 1.55 ? -14 : 0); put(pop2, 1500, 800, pop(lt, 0.9), Math.sin(lt * 2) * 6); });
    const cone = P("div", "", L);
    Object.assign(cone.style, { width: "1400px", height: "520px", background: "linear-gradient(90deg, rgba(255,236,190,.35), rgba(255,236,190,0))", clipPath: "polygon(0 46%, 100% 0, 100% 100%, 0 54%)", filter: "blur(8px)" });
    add((lt) => put(cone, 1030, 540, 1, 0, clamp(lt - 0.5) * (0.75 + 0.25 * noise1(lt * 14, 2))));
  }
  if (name === "forget") {
    const scan = P("div", "scan", L); scan.style.width = W + "px"; scan.style.height = H + "px";
    add((lt) => put(scan, W / 2, H / 2, 1, 0, 0.8));
    const rew = P("div", "", L, "◀◀ REW"); Object.assign(rew.style, { fontFamily: '"Secular One"', fontSize: "58px", color: "#fff", textShadow: "3px 0 #ff2a6d, -3px 0 #05d9e8", direction: "ltr" });
    add((lt) => put(rew, 220, 110, 1, 0, Math.floor(lt * 2.4) % 2 ? 1 : 0.2));
    const bar = P("div", "", L); Object.assign(bar.style, { width: "820px", height: "82px", borderRadius: "12px", background: "rgba(0,0,0,.6)", boxShadow: "inset 0 0 0 3px rgba(179,136,255,.7)", overflow: "hidden" });
    const fill = el("div", "", bar); Object.assign(fill.style, { position: "absolute", top: "8px", bottom: "8px", right: "8px", borderRadius: "6px", background: "repeating-linear-gradient(-45deg,#b388ff 0 18px,#7b4dff 18px 36px)" });
    const lab = el("div", "", bar); Object.assign(lab.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", fontWeight: "800", fontSize: "34px", color: "#fff", textShadow: "0 2px 6px #000" });
    add((lt) => { const p = E.ioQ(seg(lt, 1, 5)) * 0.97; css(fill, { width: (p * 804).toFixed(1) + "px" }); lab.textContent = `מוחק זיכרון… ${Math.round(p * 100)}%`; put(bar, W / 2, 960, 1, 0, clamp((lt - 0.9) * 3)); });
    const mon = icon("see-no-evil-monkey", 250, L), spiral = icon("face-with-spiral-eyes", 200, L);
    add((lt) => { put(mon, 1620, 560, pop(lt, 0.5), Math.sin(lt * 2) * 6); put(spiral, 260, 300, pop(lt, 0.8), lt * 40); });
  }
  if (name === "baby") {
    const bubbles = Array.from({ length: 34 }, () => { const e = P("div", "", L); const s = 30 + r() * 110; Object.assign(e.style, { width: s + "px", height: s + "px", borderRadius: "50%", background: "radial-gradient(circle at 32% 30%, rgba(255,255,255,.95) 0 8%, rgba(255,255,255,.18) 14%, rgba(155,231,255,.12) 60%, rgba(255,255,255,.45) 100%)", boxShadow: "inset 0 0 12px rgba(255,255,255,.4)" }); return { e, x: r() * W, sp: 70 + r() * 140, ph: r() * 1300, w: r() * 6.28 }; });
    add((lt) => bubbles.forEach((b) => { const y = H + 80 - ((b.ph + lt * b.sp) % 1300); put(b.e, b.x + Math.sin(lt * 1.5 + b.w) * 30, y, 1, 0, clamp(lt * 1.5)); }));
    const baby = icon("baby", 260, L), bottle = icon("baby-bottle", 210, L), bear = icon("teddy-bear", 200, L);
    add((lt) => { put(baby, 300, 760, pop(lt, 0.4), Math.sin(lt * 3) * 8); put(bottle, 1620, 720, pop(lt, 0.6), -20 + Math.sin(lt * 2.5) * 14); put(bear, 1560, 280, pop(lt, 0.9), Math.sin(lt * 2) * 6); });
  }
  if (name === "model") {
    const runway = P("div", "", L);
    Object.assign(runway.style, { width: "1200px", height: "420px", background: "linear-gradient(180deg, rgba(255,79,163,0), rgba(255,79,163,.28))", clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)" });
    add((lt) => put(runway, W / 2, 880, 1, 0, clamp(lt * 2)));
    const lights = Array.from({ length: 16 }, (_, i) => { const e = P("div", "", L); Object.assign(e.style, { width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 0 18px #ff9ccf" }); return { e, i }; });
    add((lt) => lights.forEach(({ e, i }) => { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2) / 7; put(e, W / 2 + side * lerp(120, 600, k), lerp(680, 1080, k), lerp(0.5, 1.3, k), 0, (Math.floor(lt * 6) + i) % 3 ? 1 : 0.25); }));
    const cam = icon("camera-with-flash", 230, L), glasses = icon("smiling-face-with-sunglasses", 220, L);
    add((lt) => { put(cam, 300, 420, pop(lt, 0.4), Math.sin(lt * 2) * 6); put(glasses, 1610, 420, pop(lt, 0.6), Math.sin(lt * 1.7) * 6); });
    const flashes = Array.from({ length: 14 }, (_, i) => { const e = P("div", "", L); Object.assign(e.style, { width: "260px", height: "260px", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.95), rgba(255,255,255,.4) 25%, transparent 65%)" }); return { e, t: 1.2 + i * 0.31 + r() * 0.12, x: 100 + r() * (W - 200), y: 100 + r() * 500 }; });
    add((lt) => flashes.forEach((f) => { const a = lt - f.t; put(f.e, f.x, f.y, 0.6 + a * 2, 0, a > 0 && a < 0.22 ? 1 - a / 0.22 : 0); }));
  }
  if (name === "weird") {
    const ufo = icon("flying-saucer", 300, L);
    const beam = P("div", "", L);
    Object.assign(beam.style, { width: "520px", height: "760px", background: `linear-gradient(180deg, rgba(${th.rgb},.55), rgba(${th.rgb},0))`, clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)", filter: "blur(4px)" });
    add((lt) => { const x = 1520 + Math.sin(lt * 0.9) * 200, y = 290 + Math.sin(lt * 2.3) * 16; put(ufo, x, y, pop(lt, 0.3), Math.sin(lt * 2) * 8); put(beam, x, y + 430, 1, 0, clamp((lt - 0.8) * 2) * (0.6 + 0.4 * Math.sin(lt * 9))); });
    const alien = icon("alien", 260, L), eyes = icon("eyes", 170, L);
    add((lt) => { put(alien, 300, H - 130 + (1 - E.outBack(seg(lt, 1.2, 1.8))) * 300, 1, Math.sin(lt * 3) * 10); put(eyes, 1600, 820, pop(lt, 1.6), 0, 1, ` translateX(${(Math.sin(lt * 4) * 14).toFixed(1)}px)`); });
    const qs = Array.from({ length: 10 }, () => { let x, y; do { x = 100 + r() * (W - 200); y = 120 + r() * (H - 240); } while ((x > 420 && x < W - 420 && y > 250 && y < H - 230) || (x > 600 && x < W - 600 && y < 250)); return { e: icon("red-question-mark", 70 + r() * 60, L), x, y, ph: r() * 6.28 }; });
    add((lt) => qs.forEach((q) => put(q.e, q.x, q.y + Math.sin(lt * 2 + q.ph) * 20, pop(lt, 0.5 + q.ph / 8), Math.sin(lt * 1.5 + q.ph) * 30)));
  }
  return (lt) => parts.forEach((f) => f(lt));
}
function hearts(L, add, th, n, seed) {
  const r = rng(seed + 33);
  const hs = Array.from({ length: n }, (_, i) => ({ e: icon(i % 3 ? "red-heart" : (th.motif === "mom" ? "smiling-face-with-hearts" : "sparkling-heart"), 40 + r() * 70, L), x: r() * W, sp: 90 + r() * 120, ph: r() * 1300, w: r() * 6.28 }));
  add((lt) => hs.forEach((h) => { const y = H + 80 - ((h.ph + lt * h.sp) % 1300); put(h.e, h.x + Math.sin(lt * 1.8 + h.w) * 34, y, 1, Math.sin(lt * 2 + h.w) * 15, clamp(lt * 1.5) * 0.9); }));
}
// guard-duty schedule: cells fill one by one (used by the "burnt" category)
function shiftGrid(parent, names, th) {
  const box = P("div", "card", parent);
  Object.assign(box.style, { width: "560px", height: "620px", padding: "0" });
  const head = el("div", "", box, "טבלת שמירות");
  Object.assign(head.style, { position: "absolute", top: "26px", left: 0, right: 0, textAlign: "center", fontWeight: "900", fontSize: "44px", color: "#ffd2a6" });
  const hours = ["02-06", "06-10", "10-14", "14-18"];
  const cells = [];
  for (let rI = 0; rI < 4; rI++) {
    const h = el("div", "", box, hours[rI]);
    Object.assign(h.style, { position: "absolute", right: "26px", top: 120 + rI * 118 + "px", width: "120px", height: "96px", display: "grid", placeItems: "center", fontWeight: "700", fontSize: "28px", color: "#bba890" });
    for (let c = 0; c < 3; c++) {
      const cell = el("div", "grid-cell", box);
      Object.assign(cell.style, { left: 30 + c * 130 + "px", top: 120 + rI * 118 + "px", width: "118px", height: "96px", background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.12)", fontSize: "30px", color: "#fff" });
      cells.push(cell);
    }
  }
  return {
    box, update(lt, step) {
      cells.forEach((c, i) => {
        const on = lt > i * step;
        c.textContent = on ? names[i % names.length] : "";
        css(c, { background: on ? `rgba(${th.rgb},.55)` : "rgba(255,255,255,.06)", transform: on ? `scale(${(1 + 0.25 * (1 - E.outC(seg(lt, i * step, i * step + 0.25)))).toFixed(3)})` : "scale(1)" });
      });
    },
  };
}

// ---------------------------------------------------------------- scenes
function introScene() {
  const DUR = 24;
  scene("intro", DUR, (root, t0) => {
    mark("intro", t0);
    mark("drop", t0 + 10);
    const M = DATA.meta;
    const pre = P("div", "eyebrow", root, `${M.group} מציגה`);
    pre.style.fontSize = "44px";
    const curL = P("div", "curtain l", root), curR = P("div", "curtain r", root), val = P("div", "valance", root);
    const ladies = P("div", "", root, "גבירותיי ורבותיי");
    Object.assign(ladies.style, { fontFamily: '"Frank Ruhl Libre"', fontWeight: 900, fontSize: "96px", color: "#fff3d0", textShadow: "0 6px 20px rgba(0,0,0,.8)", whiteSpace: "nowrap" });
    const l1 = P("div", "gold display", root, "ברוכים הבאים"); l1.style.whiteSpace = "nowrap";
    fitLine(l1, 1500, 170);
    const l2 = P("div", "gold-spans display", root);
    const base = chars(l2, "לאוסקרים");
    const extra = [0, 1, 2].map(() => el("span", "w", l2, "ם"));
    fitLine(l2, 1250, 250, 120);
    const l3 = P("div", "gold-spans display", root);
    const w3 = words(l3, M.group);
    l3.style.fontSize = "190px";
    const st1 = statue(root, 560), st2 = statue(root, 560);
    // photo blitz
    const blitz = M.blitz;
    const r = rng(42);
    const pols = blitz.map((f, i) => {
      const land = LANDSCAPE.has(f);
      const p = P("div", "polaroid", root);
      p.style.width = (land ? 640 : 440) + "px";
      p.style.height = (land ? 540 : 640) + "px";
      img("private/photos/" + f, "", p);
      return { p, x: 380 + r() * 1160, y: 330 + r() * 420, rot: (r() - 0.5) * 22, t: 14 + i * 0.5 };
    });
    const by = P("div", "eyebrow", root, "נערך על ידי");
    by.style.fontSize = "40px";
    const tomer = P("div", "gold display", root, M.editor);
    tomer.style.fontSize = "170px"; tomer.style.whiteSpace = "nowrap";
    const king = P("div", "display", root, M.editorTitle);
    Object.assign(king.style, { fontSize: "150px", color: "#fff", textShadow: "0 0 40px rgba(255,200,80,.9), 0 6px 0 #6b470f", whiteSpace: "nowrap" });
    const tf = faceRing(root, M.editorFace, 260);
    const crown = icon("crown", 190, root);

    // sound
    cue("s_riser", t0 + 1.0, 0.7);
    cue("s_boom", t0 + 4.0, 0.6);
    cue("v_intro", t0 + 4.0, 1.25);
    cue("s_boom", t0 + 6.38, 0.9);
    cue("s_whoosh", t0 + 7.45, 0.6);
    extra.forEach((_, i) => cue("pop", t0 + 8.35 + i * 0.25, 0.9));
    cue("s_boom", t0 + 10.15, 1);
    cue("shimmer", t0 + 10.3, 0.8);
    burst(t0 + 10.15, { kind: "spark", x: W / 2, y: 780, n: 90, speed: 1500, gravity: 900, life: 2.2, size: 1.2 });
    burst(t0 + 10.2, { kind: "confetti", x: 0, y: H, angle: -1.0, spread: 0.9, n: 160, speed: 2100 });
    burst(t0 + 10.2, { kind: "confetti", x: W, y: H, angle: -2.14, spread: 0.9, n: 160, speed: 2100 });
    pols.forEach((p, i) => { cue("shutter", p.t, 0.9); if (i % 2 === 0) cue("s_flash", p.t - 0.02, 0.35); });
    cue("s_whoosh", t0 + 17.6, 0.7);
    cue("hit", t0 + 18.6, 0.8);
    cue("s_boom", t0 + 19.55, 0.8);
    cue("s_boing", t0 + 20.05, 0.9);
    cue("shimmer", t0 + 20.1, 0.9);
    burst(t0 + 20.05, { kind: "spark", x: W / 2, y: 300, n: 60, speed: 1100, gravity: 700, life: 1.8 });
    transition(t0 + DUR, "wipe", ["#f2c14e", "#1b1206", "#fff3c4"]);

    return {
      update(lt) {
        ENV.tint = "#160f06"; ENV.tint2 = "#020101"; ENV.glow = lt < 4 ? 0.15 : 0.8;
        ENV.bars = lt < 4.2 ? 1 - seg(lt, 3.8, 4.2) : 0;
        ENV.bokeh = lt < 4 ? seg(lt, 0, 4) * 0.4 : 0.6;
        // spotlights flicker on at the end of the black opening
        ENV.beams = lt < 3.3 ? 0 : lt < 4 ? (Math.floor(lt * 14) % 3 ? 0.9 : 0.1) : lt < 14 ? 0.85 : 0.55;
        if (lt >= 4 && lt < 4.35) ENV.flash = 1 - seg(lt, 4, 4.35);
        if (lt >= 10.15 && lt < 10.45) ENV.flash = 0.7 * (1 - seg(lt, 10.15, 10.45));
        ENV.shake = (lt > 4 && lt < 4.5 ? 1 - seg(lt, 4, 4.5) : 0) + (lt > 6.38 && lt < 6.9 ? 1 - seg(lt, 6.38, 6.9) : 0) + (lt > 10.15 && lt < 10.7 ? 1.2 * (1 - seg(lt, 10.15, 10.7)) : 0);
        put(pre, W / 2, 540, 1 + lt * 0.02, 0, env(lt, 0.6, 3.9, 0.9, 0.5), "");
        css(pre, { letterSpacing: (0.15 + lt * 0.08).toFixed(3) + "em" });
        // curtains: closed 4-7.6, open 7.6-9
        const op = E.ioC(seg(lt, 7.6, 9.0));
        const cv = lt >= 4 && lt < 9.2 ? 1 : 0;
        put(curL, W * 0.26 - op * 1050, H / 2, 1, 0, cv);
        put(curR, W * 0.74 + op * 1050, H / 2, 1, 0, cv);
        put(val, W / 2, 60 - op * 160, 1, 0, cv);
        put(ladies, W / 2, 540, 0.9 + 0.1 * E.outC(seg(lt, 4, 4.6)), 0, env(lt, 4.05, 6.3, 0.35, 0.3));
        // "ברוכים הבאים": slams in on the word, moves up when the curtains open
        const s1 = lt < 6.38 ? 0 : lerp(2.6, 1, E.outExpo(seg(lt, 6.38, 6.62)));
        const y1 = lerp(540, 250, E.ioC(seg(lt, 7.4, 8.4)));
        const out = E.inC(seg(lt, 13.3, 13.9));
        put(l1, W / 2, y1 - out * 60, s1 * (1 - out * 0.2), 0, lt < 6.38 ? 0 : (1 - out) * clamp((lt - 6.38) * 6));
        shine(l1, lt, 2.6);
        // "לאוסקרים" + extra final mems that pop and stretch the word
        put(l2, W / 2, 500 - out * 40, 1 - out * 0.2, 0, lt < 7.75 ? 0 : 1 - out);
        base.forEach((c, i) => { const a = 7.75 + i * 0.05; css(c, { transform: `translateY(${((1 - E.outBack(seg(lt, a, a + 0.35))) * -220).toFixed(1)}px)`, opacity: clamp((lt - a) * 8).toFixed(2) }); });
        extra.forEach((c, i) => { const a = 8.35 + i * 0.25, p = seg(lt, a, a + 0.35); css(c, { transform: `scale(${(lt < a ? 0 : E.outElastic(p)).toFixed(3)}, ${(lt < a ? 0 : 1 + 0.4 * (1 - E.outC(p))).toFixed(3)})`, opacity: lt < a ? "0" : "1" }); });
        [...base, ...extra].forEach((c, i) => shine(c, lt, 2.6, 0.5 + i * 0.05));
        // the group name
        w3.forEach((w, i) => { const a = i ? 10.15 : 9.3; css(w, { transform: `scale(${(lt < a ? 0 : lerp(2.2, 1, E.outExpo(seg(lt, a, a + 0.28)))).toFixed(3)})`, opacity: lt < a ? "0" : "1" }); });
        put(l3, W / 2, 760 - out * 20, 1 - out * 0.2, 0, lt < 9.3 ? 0 : 1 - out);
        w3.forEach((c, i) => shine(c, lt, 2.6, 1.0 + i * 0.2));
        const su = E.outBack(seg(lt, 10.15, 10.9), 1.4);
        const sb = Math.sin(lt * 1.6) * 8;
        put(st1, 165, lerp(1500, 620, su) + sb, 1, -4, lt < 10.15 ? 0 : 1 - out);
        put(st2, W - 165, lerp(1500, 620, su) - sb, 1, 4, lt < 10.15 ? 0 : 1 - out);
        // photo blitz: one polaroid per beat
        pols.forEach((p, i) => {
          const a = lt - (p.t - 0); const outP = E.inBack(seg(lt, 17.5, 18.0));
          const sIn = a < 0 ? 0 : lerp(1.8, 1, E.outExpo(seg(a, 0, 0.25)));
          put(p.p, p.x + outP * (i % 2 ? 1 : -1) * 2400, p.y, sIn, p.rot + (1 - E.outC(seg(a, 0, 0.3))) * 20, a < 0 ? 0 : 1 - seg(lt, 17.7, 18));
          if (a >= 0 && a < 0.1) ENV.flash = Math.max(ENV.flash, 0.38 * (1 - a / 0.1));
        });
        if (lt > 13.9 && lt < 18) ENV.glow = 0.4;
        // credits: edited by ... + title + crown
        const cOut = E.inC(seg(lt, 23.3, 23.9));
        put(tf, W / 2, 300, pop(lt, 18.35, 0.5) * (1 - cOut), 0, lt < 18.35 ? 0 : 1 - cOut);
        put(by, W / 2, 520, 1, 0, env(lt, 18.2, 23.9, 0.4, 0.5));
        put(tomer, W / 2, 650, lt < 18.6 ? 0 : lerp(1.6, 1, E.outExpo(seg(lt, 18.6, 18.9))) * (1 - cOut * 0.3), 0, lt < 18.6 ? 0 : 1 - cOut);
        shine(tomer, lt, 2.2);
        put(king, W / 2, 840, lt < 19.55 ? 0 : lerp(3, 1, E.outExpo(seg(lt, 19.55, 19.8))), Math.sin(lt * 3) * 2, lt < 19.55 ? 0 : 1 - cOut);
        if (lt > 19.55 && lt < 19.95) ENV.shake = 1 - seg(lt, 19.55, 19.95);
        const cd = E.outBounce(seg(lt, 20.05, 20.8));
        put(crown, W / 2 + 6, lerp(-200, 158, cd), 1, -8 + Math.sin(lt * 3) * 4, lt < 20.05 ? 0 : 1 - cOut);
      },
    };
  });
}

function statsScene() {
  const DUR = 7;
  scene("stats", DUR, (root, t0) => {
    mark("groove", t0);
    const vt = 0.4; // voice offset
    cue("v_stats", t0 + vt, 1.2);
    const items = [
      { n: 10, label: "מצביעים", ic: "ballot-box-with-ballot", a: vt + 0.12, x: 1440 },
      { n: 14, label: "קטגוריות", ic: "trophy", a: vt + 1.56, x: 960 },
      { n: 0, label: "רחמים", ic: "smiling-face-with-horns", a: vt + 2.95, x: 480 },
    ].map((it) => {
      const card = P("div", "card", root);
      Object.assign(card.style, { width: "420px", height: "560px" });
      const ic = icon(it.ic, 150, card); ic.style.left = "135px"; ic.style.top = "40px";
      const num = el("div", "gold display", card, "0");
      Object.assign(num.style, { position: "absolute", top: "190px", left: 0, right: 0, textAlign: "center", fontSize: "210px" });
      const lab = el("div", "", card, it.label);
      Object.assign(lab.style, { position: "absolute", top: "430px", left: 0, right: 0, textAlign: "center", fontSize: "64px", fontWeight: 800 });
      cue("hit", t0 + it.a, 0.7);
      return Object.assign(it, { card, num });
    });
    items.forEach((it) => { if (it.n) for (let k = 1; k <= it.n; k += it.n > 10 ? 2 : 1) cue("tick", t0 + it.a + 0.1 + (k / it.n) * 0.6, 0.35); });
    cue("ding", t0 + items[2].a + 0.75, 0.8);
    transition(t0 + DUR, "wipe");
    return {
      update(lt) {
        ENV.beams = 0.4; ENV.bokeh = 0.7;
        items.forEach((it, i) => {
          const s = pop(lt, it.a, 0.5), out = E.inBack(seg(lt, 6.2 + i * 0.08, 6.8 + i * 0.08));
          put(it.card, it.x, 560 - out * 900, s, (1 - s) * 10, clamp(s * 3));
          const p = E.outC(seg(lt, it.a + 0.1, it.a + 0.7));
          it.num.textContent = it.n ? String(Math.round(p * it.n)) : (p < 1 ? String(Math.floor(hash(Math.floor(lt * 20)) * 9) + 1) : "0");
          shine(it.num, lt, 2.4, i);
        });
      },
    };
  });
}

function titleScene(cat, idx, th) {
  const vlen = (DATA.voice || {})["v_c" + (idx + 1)] || 2;
  const DUR = SHORT ? Math.max(2.5, qb(vlen + 0.75)) : 6;
  const kk = SHORT ? 0.45 : 1; // entrance timings
  const sk = SHORT ? 0.55 : 1; // sound timings
  scene("title-" + cat.id, DUR, (root, t0) => {
    mark(idx % 2 ? "groove2" : "groove", t0);
    const mot = motif(th.motif, root, th, 100 + idx * 13);
    const chip = P("div", "pill", root, `קטגוריה ${idx + 1} מתוך 14`);
    chip.style.fontSize = "34px";
    const dots = P("div", "", root);
    Object.assign(dots.style, { display: "flex", gap: "14px", direction: "rtl" });
    for (let i = 0; i < 14; i++) {
      const d = el("div", "", dots);
      Object.assign(d.style, { width: i === idx ? "40px" : "14px", height: "14px", borderRadius: "7px", background: i < idx ? "rgba(255,226,150,.85)" : i === idx ? th.color : "rgba(255,255,255,.22)" });
    }
    const pre = th.pre ? P("div", "", root, th.pre) : null;
    if (pre) Object.assign(pre.style, { fontSize: "74px", fontWeight: 800, color: "#fff", textShadow: "0 4px 18px rgba(0,0,0,.8)", whiteSpace: "nowrap" });
    const main = P("div", "", root);
    const mw = words(main, th.main);
    themeText(main, th, mw);
    fitLine(main, 1180, th.main.length > 8 ? 210 : 280, 90);
    const post = th.post ? P("div", "", root, th.post) : null;
    if (post) Object.assign(post.style, { fontSize: "76px", fontWeight: 800, color: "#fff", textShadow: "0 4px 18px rgba(0,0,0,.8)", whiteSpace: "nowrap" });
    const q = P("div", "", root, "?");
    Object.assign(q.style, { fontFamily: '"Suez One"', fontSize: "200px", color: th.color, textShadow: "0 6px 0 rgba(0,0,0,.6)" });
    cue("v_c" + (idx + 1), t0 + 0.85 * kk, 1.25);
    cue("hit", t0 + 0.55 * kk, 0.6);
    const sfxAt = { couple: 0.95, lions: 1.35, yellow: 0.45, burnt: 0.3, model: 1.15, slacker: 2.4, weird: 0.4 }[th.motif] ?? 2.3;
    // short cut: the category's sound lands right after the announcer, not on top of him
    cue(th.sfx, t0 + (SHORT ? Math.max(sfxAt * sk, 0.85 * kk + vlen - 0.35) : sfxAt), (th.motif === "lions" ? 0.75 : 0.65) * (SHORT ? 0.85 : 1));
    if (th.motif === "slacker") cue("s_scratch", t0 + 2.8 * sk, 0.6);
    if (th.motif === "yellow") cue("s_splash", t0 + 1.1 * sk, 0.4);
    if (th.motif === "model") cue("s_flash", t0 + 1.3 * sk, 0.5);
    if (th.motif === "couple") cue("pop", t0 + 1.25 * sk, 0.9);
    const n = (th.pre ? 1 : 0) + 1 + (th.post ? 1 : 0);
    const ys = n === 3 ? [330, 520, 740] : [460, 700];
    return {
      update(lt) {
        setThemeEnv(th);
        ENV.bokeh = 0.6; ENV.beams = 0.2;
        if (th.motif === "weird") ENV.stars = 1;
        if (th.motif === "moment") { ENV.tint = "#3a2a10"; ENV.vignette = 0.95; }
        mot(lt);
        const out = E.inC(seg(lt, DUR - (SHORT ? 0.35 : 0.55), DUR));
        put(chip, W / 2, 95 - (1 - E.outBack(seg(lt, 0.2 * kk, 0.2 * kk + 0.5))) * 160, 1, 0, 1 - out);
        put(dots, W / 2, 168, 1, 0, clamp((lt - 0.4 * kk) * 3) * (1 - out));
        let k = 0;
        const zoom = 1 + out * 0.5;
        if (pre) { put(pre, W / 2, ys[k++], pop(lt, 0.45 * kk) * zoom, 0, clamp((lt - 0.45 * kk) * 4) * (1 - out)); }
        const glitch = th.motif === "forget" ? (Math.floor(lt * 12) % 5 === 0 ? (hash(Math.floor(lt * 12)) - 0.5) * 30 : 0) : 0;
        const wob = th.motif === "weird" ? ` skewX(${(Math.sin(lt * 3) * 6).toFixed(2)}deg)` : "";
        put(main, W / 2 + glitch, ys[k++], zoom, th.motif === "funny" || th.motif === "lol" ? Math.sin(lt * 5) * 2 : 0, 1 - out, wob);
        mw.forEach((w, i) => { const a = (0.65 + i * 0.16) * kk; css(w, { transform: `scale(${(lt < a ? 0 : E.outBack(seg(lt, a, a + 0.5), 2.4)).toFixed(3)})`, opacity: lt < a ? "0" : "1" }); });
        if (th.motif === "forget") css(main, { textShadow: lt % 0.4 < 0.08 ? "8px 0 #ff2a6d, -8px 0 #05d9e8" : "none" });
        if (post) put(post, W / 2, ys[k++], pop(lt, 1.15 * kk) * zoom, 0, clamp((lt - 1.15 * kk) * 4) * (1 - out));
        const last = post || main;
        put(q, W / 2 - (last.offsetWidth / 2) * zoom - 70, ys[n - 1] - 6, pop(lt, 1.6 * kk, 0.6) * zoom, -12 + Math.sin(lt * 4) * 6, 1 - out);
      },
    };
  });
}

function countdownScene(cat, idx, th) {
  const st = SHORT ? 0.5 : 1, a0 = SHORT ? 0 : 0.5; // seconds per number, first number
  const DUR = a0 + 3 * st;
  scene("count-" + cat.id, DUR, (root, t0) => {
    mark("tension", t0);
    const ring = P("div", "", root);
    ring.innerHTML = `<svg width="760" height="760" viewBox="0 0 760 760"><circle cx="380" cy="380" r="340" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="22"/><circle class="arc" cx="380" cy="380" r="340" fill="none" stroke="${th.color}" stroke-width="22" stroke-linecap="round" transform="rotate(-90 380 380)" stroke-dasharray="2136.3" stroke-dashoffset="0"/></svg>`;
    const arc = ring.querySelector(".arc");
    const lines = P("div", "", root);
    Object.assign(lines.style, { width: "2200px", height: "2200px", borderRadius: "50%", background: `repeating-conic-gradient(rgba(${th.rgb},.14) 0 2deg, transparent 2deg 10deg)` });
    const nums = [3, 2, 1].map((n) => { const e = P("div", "gold display", root, String(n)); e.style.fontSize = "430px"; e.style.lineHeight = "1"; return e; });
    const shock = [0, 1, 2].map(() => { const e = P("div", "", root); Object.assign(e.style, { width: "400px", height: "400px", borderRadius: "50%", border: `10px solid ${th.color}` }); return e; });
    const label = P("div", "", root, THEMES[cat.id].main);
    Object.assign(label.style, { fontSize: "44px", fontWeight: 800, color: "rgba(255,255,255,.8)", whiteSpace: "nowrap", letterSpacing: ".05em" });
    [0, 1, 2].forEach((i) => { cue("tock", t0 + a0 + i * st, 0.9 + i * 0.15); });
    if (SHORT) cue("rise15", t0, 0.7); else cue("s_riser", t0 + 0.55, 0.75);
    transition(t0 + DUR, "flash");
    return {
      update(lt) {
        setThemeEnv(th, 0.5);
        ENV.bokeh = 0.3; ENV.vignette = 0.95;
        ENV.zoom = 1 + lt * 0.012;
        put(lines, W / 2, 540, 1, lt * 25, clamp(lt * 3) * 0.9);
        const k = Math.floor(clamp((lt - a0) / st, 0, 2.999));
        const frac = clamp((lt - a0) / st - k);
        css(arc, { strokeDashoffset: (lt < a0 ? 2136.3 * (1 - E.outC(seg(lt, 0, a0))) : 2136.3 * frac).toFixed(1) });
        put(ring, W / 2, 540, 1 + (lt >= a0 ? 0.04 * (1 - E.outC(clamp(frac * 4))) : 0), 0, 1);
        nums.forEach((nEl, i) => {
          const a = a0 + i * st, p = seg(lt, a, a + 0.32 * st);
          const on = lt >= a && lt < a + st;
          const exit = seg(lt, a + 0.8 * st, a + st);
          put(nEl, W / 2, 520, on ? lerp(2.4, 1, E.outExpo(p)) * (1 + exit * 0.4) : 0, on ? (1 - E.outC(p)) * -14 : 0, on ? 1 - exit : 0);
          shine(nEl, lt * 2, 1);
          const sp = seg(lt, a, a + 0.6 * st);
          put(shock[i], W / 2, 540, 0.8 + sp * 3, 0, lt >= a && sp < 1 ? (1 - sp) * 0.8 : 0);
        });
        if (lt >= a0) ENV.shake = 0.25 * (1 - clamp(frac * 3)) * (k + 1) / 2;
        put(label, W / 2, 1000, 1, 0, clamp(lt * 4) * 0.9);
      },
    };
  });
}

// ---- results for people categories: podium levels, drum roll, winner, every answer
function resultsScene(cat, idx, th, goesVoice) {
  const lvls = cat.podium;
  const lower = lvls.slice(1).map((l, i) => ({ ...l, rank: i + 1 })).reverse(); // third first, then second
  const T = [];
  let t = 0;
  for (const l of lower) { const d = qb(4.2 + Math.max(0, l.names.length - 3) * 0.45); T.push({ kind: "level", l, a: t, b: t + d }); t += d; }
  const vdur = { v_goes1: 2.4, v_goes2: 2.88, v_goes3: 4.08 }[goesVoice];
  const drum = qb(vdur + 0.75);
  T.push({ kind: "drum", a: t, b: t + drum }); t += drum;
  const winner = lvls[0];
  const quotes = cat.results.filter((r) => winner.names.includes(r.label)).flatMap((r) => r.quotes);
  const wd = qb(7.6 + (quotes.length ? 0.8 : 0) + (winner.names.length > 1 ? 1.2 : 0));
  T.push({ kind: "win", a: t, b: t + wd }); t += wd;
  const rows = cat.results;
  const cd = qb(Math.max(6, 2.8 + rows.length * 0.55));
  T.push({ kind: "chart", a: t, b: t + cd }); t += cd;
  const DUR = t;

  scene("results-" + cat.id, DUR, (root, t0) => {
    const parts = [];
    for (const ph of T) {
      if (ph.kind === "level") parts.push(levelPart(root, t0, ph, th, cat));
      if (ph.kind === "drum") parts.push(drumPart(root, t0, ph, th, cat, goesVoice));
      if (ph.kind === "win") parts.push(winPart(root, t0, ph, th, cat, winner, quotes));
      if (ph.kind === "chart") parts.push(chartPart(root, t0, ph, th, cat));
    }
    transition(t0 + DUR, "wipe", [th.color, "#0d0905", "#f2c14e"]);
    return { update(lt) { setThemeEnv(th, 0.8); ENV.bokeh = 0.5; for (const p of parts) p(lt); } };
  });
}

function levelPart(root, t0, ph, th, cat) {
  const L = layer(root);
  const { l } = ph, rank = l.rank;
  mark("level", t0 + ph.a);
  const medal = icon(MEDAL[rank], 250, L);
  const rk = P("div", "display", L, RANK[rank]);
  rk.style.fontSize = "120px"; rk.style.whiteSpace = "nowrap";
  metalText(rk, rank);
  const tie = l.names.length > 1;
  const vt = P("div", "pill", L, votesText(l.votes) + (tie ? " · שוויון!" : ""));
  vt.style.fontSize = "40px";
  const n = l.names.length;
  const isCouple = l.names.some((x) => splitCouple(x));
  const perRow = isCouple ? 3 : 5;
  const nRows = Math.ceil(n / perRow);
  const cols = Math.min(n, perRow);
  const size = nRows > 1 ? (isCouple ? 190 : 170) : n === 1 ? 330 : n === 2 ? 270 : n === 3 ? 230 : n === 4 ? 190 : 165;
  const spacing = Math.min(isCouple ? size * 1.65 : size * 1.25, 940 / Math.max(1, cols - 1 || 1));
  const items = l.names.map((name, i) => {
    const v = entryVisual(L, name, isCouple ? size * 0.8 : size, METAL[rank]);
    const nm = P("div", "name", L, name);
    nm.style.whiteSpace = "nowrap";
    fitLine(nm, isCouple ? spacing - 10 : Math.max(spacing - 10, 200), n > 3 ? 54 : 70, 30);
    const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow), j = i - row * perRow;
    const cx = 560 + (inRow > 1 ? (j - (inRow - 1) / 2) * spacing * -1 : 0);
    const cy = nRows > 1 ? 300 + row * 400 : n > 3 ? 470 : 450;
    cue("pop", t0 + ph.a + 0.75 + i * 0.16, 0.8);
    return { v, nm, cx, cy, d: 0.75 + i * 0.16 };
  });
  cue("s_whoosh", t0 + ph.a + 0.05, 0.5);
  cue(rank === 1 ? "v_second" : "v_third", t0 + ph.a + 0.1, 1.2);
  cue("s_applause", t0 + ph.a + 1.1, rank === 1 ? 0.5 : 0.38);
  const dur = ph.b - ph.a;
  return (lt0) => {
    const lt = lt0 - ph.a;
    if (lt < 0 || lt > dur) { css(L, { display: "none" }); return; }
    css(L, { display: "block" });
    ENV.beams = 0.25;
    const out = E.inBack(seg(lt, dur - 0.45, dur));
    const sp = E.outBack(seg(lt, 0, 0.6));
    put(medal, 1500 + out * 900, 330, sp, Math.sin(lt * 2) * 6, 1, ` scaleX(${Math.cos((1 - E.outC(seg(lt, 0, 0.9))) * 6.28).toFixed(3)})`);
    put(rk, 1500 + out * 900, 570, pop(lt, 0.2), 0, clamp((lt - 0.2) * 4));
    put(vt, 1500 + out * 900, 700, pop(lt, 0.4), 0, clamp((lt - 0.4) * 4));
    items.forEach((it) => {
      const s = pop(lt, it.d, 0.5);
      const y = it.cy;
      put(it.v, it.cx - out * 1400, y + Math.sin(lt * 2 + it.cx) * 6, s, 0, clamp(s * 3));
      put(it.nm, it.cx - out * 1400, y + (isCouple ? size * 0.6 : size * 0.62) + 40, pop(lt, it.d + 0.1, 0.4), 0, clamp((lt - it.d) * 4));
    });
  };
}

function drumPart(root, t0, ph, th, cat, goesVoice, short) {
  const L = layer(root);
  mark("stop", t0 + ph.a);
  const cone = P("div", "", L);
  Object.assign(cone.style, { width: "900px", height: "1100px", background: "linear-gradient(180deg, rgba(255,240,200,.55), rgba(255,240,200,.05))", clipPath: "polygon(45% 0, 55% 0, 100% 100%, 0 100%)", filter: "blur(6px)" });
  const disc = P("div", "ring", L);
  disc.style.width = disc.style.height = "380px";
  const inner = el("div", "face", disc);
  Object.assign(inner.style, { position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", background: "radial-gradient(circle at 40% 35%, #3a2a12, #120b04)" });
  const qm = el("div", "gold display", inner, "?");
  qm.style.fontSize = "250px";
  const cap = P("div", "", L, `והאוסקר ל״${THEMES[cat.id].main}${THEMES[cat.id].post ? " " + THEMES[cat.id].post : ""}״ הולך ל…`);
  Object.assign(cap.style, { fontSize: "58px", fontWeight: 800, color: "#fff", whiteSpace: "nowrap", textShadow: "0 4px 20px #000" });
  fitLine(cap, 1600, 58, 30);
  const dur = ph.b - ph.a;
  if (short) cue("roll1", t0 + ph.a, 0.9);
  else {
    cue(goesVoice, t0 + ph.a + 0.15, 1.3);
    cue("s_drumroll", t0 + ph.a + Math.max(0, dur - 2.05), 0.95);
  }
  return (lt0) => {
    const lt = lt0 - ph.a;
    if (lt < 0 || lt > dur) { css(L, { display: "none" }); return; }
    css(L, { display: "block" });
    ENV.glow = 0.15; ENV.bokeh = 0.15; ENV.vignette = 1; ENV.bars = E.outC(seg(lt, 0, 0.4)) * 0.8;
    ENV.zoom = 1 + lt * 0.02;
    put(cone, W / 2, 470, 1, 0, clamp(lt * 3) * (0.85 + 0.15 * Math.sin(lt * 30)));
    const beat = 1 + 0.05 * Math.abs(Math.sin(lt * 14 * (1 + lt * 0.3)));
    put(disc, W / 2, 560, pop(lt, 0.1) * beat, 0, 1);
    shine(qm, lt * 2, 1.3);
    put(cap, W / 2, 185, 1, 0, clamp((lt - 0.1) * 4));
  };
}

function winPart(root, t0, ph, th, cat, winner, quotes) {
  const L = layer(root);
  const t = t0 + ph.a;
  mark("win", t);
  const names = winner.names;
  const label = names.join(" + ");
  const couple = splitCouple(names[0]);
  const multi = names.length > 1;
  const top = P("div", "eyebrow", L, "הזוכה בקטגוריה");
  top.style.fontSize = "34px";
  const catName = P("div", "", L, cat.title);
  Object.assign(catName.style, { fontSize: "50px", fontWeight: 800, whiteSpace: "nowrap", color: th.color, textShadow: "0 3px 12px #000" });
  const ringSize = multi ? 300 : couple ? 360 : 440;
  const vis_ = names.map((nm) => entryVisual(L, nm, couple ? ringSize * 0.92 : ringSize, ""));
  const name = P("div", "gold display", L, label);
  name.style.whiteSpace = "nowrap";
  fitLine(name, 1350, 160, 60);
  const vp = P("div", "pill", L, `${votesText(winner.votes)} מתוך ${DATA.voters}${multi ? " · שוויון!" : ""}`);
  vp.style.fontSize = "44px";
  const medal = icon("1st-place-medal", 80, vp);
  medal.style.position = "static";
  vp.prepend(medal);
  const st1 = statue(L, 600), st2 = statue(L, 600);
  const deco = winDecor(L, th, cat, label);
  const bubble = quotes.length ? P("div", "bubble", L, `״${quotes[0]}״`) : null;
  if (bubble) bubble.style.fontSize = "46px";
  // sound
  cue("s_boom", t, 1);
  cue("crash", t, 0.8);
  cue("s_fanfare", t + 0.05, 0.85);
  cue("s_cheer", t + 0.1, 0.9);
  if (bubble) cue("pop", t + 1.6, 0.8);
  const lateSfx = { lions: "s_roar", baby: "s_baby", mom: "s_aww", burnt: "s_trombone", weird: "s_ufo", funny: "s_laugh", model: "s_flash", couple: "s_harp", slacker: "s_yawn", yellow: "s_splash", staff: "s_bugle" }[th.motif];
  if (lateSfx) cue(lateSfx, t + 2.6, 0.55);
  burst(t + 0.02, { kind: "confetti", x: 0, y: H, angle: -1.0, spread: 0.8, n: 170, speed: 2200 });
  burst(t + 0.02, { kind: "confetti", x: W, y: H, angle: -2.14, spread: 0.8, n: 170, speed: 2200 });
  burst(t + 0.05, { kind: "spark", x: W / 2, y: 430, n: 80, speed: 1300, gravity: 800, life: 2 });
  burst(t + 1.4, { kind: "confetti", x: W / 2, y: -40, angle: Math.PI / 2, spread: 2.6, n: 120, speed: 500, gravity: 600, life: 5 });
  const dur = ph.b - ph.a;
  const cx = W / 2;
  return (lt0) => {
    const lt = lt0 - ph.a;
    if (lt < 0 || lt > dur) { css(L, { display: "none" }); return; }
    css(L, { display: "block" });
    ENV.rays = clamp(lt * 3); ENV.raysColor = GOLD_RGB; ENV.glow = 1; ENV.glowY = 0.4; ENV.beams = 0.5; ENV.bokeh = 0.8;
    ENV.shake = lt < 0.5 ? 1 - lt / 0.5 : 0;
    if (lt < 0.3) ENV.flash = 0.6 * (1 - lt / 0.3);
    const out = E.inC(seg(lt, dur - 0.45, dur));
    put(top, cx, 70, 1, 0, clamp((lt - 0.3) * 3) * (1 - out));
    put(catName, cx, 128, 1, 0, clamp((lt - 0.4) * 3) * (1 - out));
    vis_.forEach((v, i) => {
      const s = lerp(0.2, 1, E.outBack(seg(lt, 0.02 + i * 0.15, 0.6 + i * 0.15), 1.8));
      const x = multi ? cx + (i - (vis_.length - 1) / 2) * -440 : cx;
      put(v, x, 430 + Math.sin(lt * 1.8 + i) * 8, s * (1 - out * 0.3), 0, (1 - out) * clamp(lt * 8));
    });
    put(name, cx, multi ? 735 : 760, lerp(1.7, 1, E.outExpo(seg(lt, 0.25, 0.6))), 0, clamp((lt - 0.25) * 6) * (1 - out));
    shine(name, lt, 2.4);
    put(vp, cx, multi ? 870 : 900, pop(lt, 0.7), 0, clamp((lt - 0.7) * 4) * (1 - out));
    const su = E.outBack(seg(lt, 0.15, 0.9), 1.3), bob = Math.sin(lt * 1.6) * 8;
    const showLeft = th.motif !== "burnt";
    put(st1, 230, lerp(1400, 590, su) + bob, 1, -4, showLeft ? 1 - out : 0);
    put(st2, W - 230, lerp(1400, 590, su) - bob, 1, 4, 1 - out);
    if (bubble) put(bubble, cx - 520, 215, pop(lt, 1.6), 3 + Math.sin(lt * 2) * 2, clamp((lt - 1.6) * 5) * (1 - out));
    deco(lt, out);
  };
}

// winner decorations: icons orbiting the ring plus a category-specific payoff
function winDecor(L, th, cat, label) {
  const r = rng(7 + label.length);
  const orb = th.icons.slice(0, 5).map((n, i) => ({ e: icon(n, 120, L), a: (i / 5) * 6.28 + 0.5, d: 0.8 + i * 0.12 }));
  const extras = [];
  if (th.motif === "burnt") {
    const g = shiftGrid(L, [label], th);
    extras.push((lt, out) => { put(g.box, 300, 560, 0.85, -3, clamp((lt - 1) * 3) * (1 - out)); g.update(lt - 1.3, 0.22); });
  }
  if (th.motif === "lions") {
    const c = icon("crown", 150, L);
    extras.push((lt, out) => put(c, W / 2 + 10, lerp(-200, 232, E.outBounce(seg(lt, 0.9, 1.6))), 1, -10, clamp((lt - 0.9) * 6) * (1 - out)));
  }
  if (th.motif === "yellow") {
    const s = P("div", "", L);
    Object.assign(s.style, { width: "720px", height: "640px", background: th.color, borderRadius: "46% 54% 40% 60% / 55% 38% 62% 45%", zIndex: "-1" });
    L.prepend(s);
    extras.push((lt, out) => put(s, W / 2, 440, E.outElastic(seg(lt, 0.05, 0.8)), lt * 6, 0.85 * (1 - out)));
  }
  if (th.motif === "weird") {
    const u = icon("flying-saucer", 200, L);
    extras.push((lt, out) => put(u, 1500 + Math.sin(lt * 1.3) * 50, 190 + Math.sin(lt * 3) * 10, pop(lt, 1), Math.sin(lt * 2) * 8, 1 - out));
  }
  if (th.motif === "model") {
    const fl = Array.from({ length: 10 }, (_, i) => { const e = P("div", "", L); Object.assign(e.style, { width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.95), rgba(255,255,255,.35) 25%, transparent 65%)" }); return { e, t: 0.9 + i * 0.45 + r() * 0.2, x: 150 + r() * (W - 300), y: 150 + r() * 600 }; });
    extras.push((lt) => fl.forEach((f) => { const a = lt - f.t; put(f.e, f.x, f.y, 0.6 + a * 2, 0, a > 0 && a < 0.2 ? 1 - a / 0.2 : 0); }));
  }
  return (lt, out) => {
    orb.forEach((o) => {
      const a = o.a + lt * 0.5;
      const side = clamp((Math.abs(Math.cos(a)) - 0.42) / 0.2); // only beside the ring, never over the face or the name
      put(o.e, W / 2 + Math.cos(a) * 560, 420 + Math.sin(a) * 250, pop(lt, o.d) * (0.85 + 0.15 * Math.sin(lt * 3 + o.a)) * (0.6 + 0.4 * side), Math.sin(lt * 2 + o.a) * 12, clamp((lt - o.d) * 4) * (1 - out) * 0.95 * side);
    });
    extras.forEach((f) => f(lt, out));
  };
}

function chartPart(root, t0, ph, th, cat) {
  const L = layer(root);
  mark("chart", t0 + ph.a);
  const head = P("div", "gold display", L, "כל התשובות");
  head.style.fontSize = "96px";
  const sub = P("div", "", L, cat.title);
  Object.assign(sub.style, { fontSize: "46px", fontWeight: 700, color: th.color, whiteSpace: "nowrap" });
  const rows = cat.results;
  const max = rows[0].votes;
  const levelOf = (v) => cat.podium.findIndex((p) => p.votes === v);
  const area = 760, rowH = Math.min(104, area / rows.length);
  const bars = rows.map((r, i) => {
    const row = P("div", "", L);
    Object.assign(row.style, { width: "1640px", height: rowH + "px" });
    const couple = splitCouple(r.label);
    const who = couple ? couple : [personOf(r.label) || (r.label === "אמא של אופק" ? "אופק" : null)].filter(Boolean);
    who.forEach((nm, j) => {
      const f = faceRing(row, nm, rowH * 0.78, "");
      Object.assign(f.style, { position: "absolute", right: 6 + j * rowH * 0.62 + "px", top: rowH * 0.11 + "px", padding: "4px", left: "auto" });
      f.classList.remove("p");
    });
    const lab = el("div", "bar-label", row, r.label === "?" ? "״?״" : r.label);
    Object.assign(lab.style, { right: (who.length ? 18 + rowH * 0.78 + (who.length - 1) * rowH * 0.62 + 12 : 18) + "px", top: "50%", transform: "translateY(-50%)", fontSize: Math.min(46, rowH * 0.5) + "px" });
    const lv = levelOf(r.votes);
    const fill = el("div", "bar-fill", row);
    Object.assign(fill.style, { right: "560px", top: rowH * 0.18 + "px", bottom: rowH * 0.18 + "px", background: lv >= 0 ? METAL_GRAD[lv].replace("180deg", "90deg") : `linear-gradient(90deg, rgba(${th.rgb},.55), rgba(${th.rgb},.9))`, boxShadow: lv === 0 ? "0 0 30px rgba(255,200,90,.5)" : "none" });
    const num = el("div", "bar-num", row, "0");
    Object.assign(num.style, { top: "50%", fontSize: Math.min(54, rowH * 0.6) + "px" });
    cue("blip", t0 + ph.a + 0.6 + i * 0.12, 0.5);
    return { row, fill, num, r, i, w: (r.votes / max) * 940 };
  });
  const dur = ph.b - ph.a;
  return (lt0) => {
    const lt = lt0 - ph.a;
    if (lt < 0 || lt > dur) { css(L, { display: "none" }); return; }
    css(L, { display: "block" });
    ENV.glow = 0.5; ENV.bokeh = 0.4;
    const out = E.inC(seg(lt, dur - 0.4, dur));
    put(head, W / 2, 90, pop(lt, 0), 0, 1 - out);
    shine(head, lt, 2.4);
    put(sub, W / 2, 168, 1, 0, clamp((lt - 0.2) * 3) * (1 - out));
    const y0 = 250 + rowH / 2 + (area - rowH * rows.length) / 2;
    bars.forEach((b) => {
      const a = 0.35 + b.i * 0.12;
      const p = E.outC(seg(lt, a + 0.2, a + 1.0));
      put(b.row, W / 2, y0 + b.i * rowH, 1, 0, clamp((lt - a) * 4) * (1 - out), ` translateX(${((1 - E.outC(seg(lt, a, a + 0.5))) * 300).toFixed(1)}px)`);
      css(b.fill, { width: Math.max(8, b.w * p).toFixed(1) + "px" });
      css(b.num, { right: (560 + Math.max(8, b.w * p) + 18).toFixed(1) + "px", transform: "translateY(-50%)" });
      b.num.textContent = String(Math.round(p * b.r.votes));
    });
  };
}

// ---- free-text categories: nominees one by one, then the most-mentioned theme wins
function textScene(cat, idx, th, goesVoice) {
  const T = [];
  let t = 0;
  T.push({ kind: "head", a: 0, b: 2.8 }); t = 2.8;
  cat.nominees.forEach((q, i) => { const d = qb(clamp(2.7 + q.length * 0.055, 3.4, 8)); T.push({ kind: "nom", q, i, a: t, b: t + d }); t += d; });
  if (cat.empty) { T.push({ kind: "gag", a: t, b: t + 2.5 }); t += 2.5; }
  const groups = cat.groups;
  if (groups.length > 1) { const g = groups[1]; const d = qb(5 + g.quotes.join("").length * 0.03); T.push({ kind: "second", g, a: t, b: t + d }); t += d; }
  const vdur = { v_goes1: 2.4, v_goes2: 2.88, v_goes3: 4.08 }[goesVoice];
  const dd = qb(vdur + 0.75);
  T.push({ kind: "drum", a: t, b: t + dd }); t += dd;
  const win = groups[0];
  const wd = qb(6.5 + win.quotes.join("").length * 0.05);
  T.push({ kind: "twin", g: win, a: t, b: t + wd }); t += wd;
  const DUR = t;
  scene("text-" + cat.id, DUR, (root, t0) => {
    const parts = [];
    for (const ph of T) {
      if (ph.kind === "head") parts.push(nomHead(root, t0, ph, th, cat));
      if (ph.kind === "nom") parts.push(nomCard(root, t0, ph, th, cat));
      if (ph.kind === "gag") parts.push(gagCard(root, t0, ph, th));
      if (ph.kind === "second") parts.push(groupCard(root, t0, ph, th, cat, false));
      if (ph.kind === "drum") parts.push(drumPart(root, t0, ph, th, cat, goesVoice));
      if (ph.kind === "twin") parts.push(groupCard(root, t0, ph, th, cat, true));
    }
    transition(t0 + DUR, "wipe", [th.color, "#0d0905", "#f2c14e"]);
    return { update(lt) { setThemeEnv(th, 0.8); ENV.bokeh = 0.45; if (th.motif === "moment") ENV.tint = "#33240c"; for (const p of parts) p(lt); } };
  });
}
function nomHead(root, t0, ph, th, cat) {
  const L = layer(root);
  mark("light", t0 + ph.a);
  cue("v_nominees", t0 + ph.a + 0.25, 1.25);
  const h = P("div", "gold display", L, "המועמדים");
  h.style.fontSize = "200px";
  const s = P("div", "", L, `${cat.nominees.length + cat.groups.reduce((a, g) => a + g.count, 0)} רגעים, אחד זוכה`);
  Object.assign(s.style, { fontSize: "54px", fontWeight: 800, whiteSpace: "nowrap" });
  const ics = th.icons.slice(0, 3).map((n) => icon(n, 160, L));
  cue("hit", t0 + ph.a + 0.25, 0.7);
  const dur = ph.b - ph.a;
  return (lt0) => {
    const lt = lt0 - ph.a;
    if (lt < 0 || lt > dur) { css(L, { display: "none" }); return; }
    css(L, { display: "block" });
    const out = E.inC(seg(lt, dur - 0.35, dur));
    put(h, W / 2, 470, lerp(1.6, 1, E.outExpo(seg(lt, 0.25, 0.6))) * (1 + out * 0.4), 0, clamp((lt - 0.25) * 6) * (1 - out));
    shine(h, lt, 2);
    put(s, W / 2, 650, pop(lt, 0.8), 0, clamp((lt - 0.8) * 4) * (1 - out));
    ics.forEach((e, i) => put(e, W / 2 + (i - 1) * 520, 230 + (i === 1 ? -20 : 30), pop(lt, 0.5 + i * 0.12), Math.sin(lt * 2 + i) * 10, 1 - out));
  };
}
function nomCard(root, t0, ph, th, cat) {
  const L = layer(root);
  const total = cat.nominees.length;
  const variant = th.motif;
  const card = P("div", "card", L);
  Object.assign(card.style, { width: "1440px", height: "600px" });
  if (variant === "moment") Object.assign(card.style, { background: "linear-gradient(160deg,#3b2b12,#1a1208)", boxShadow: "0 40px 90px rgba(0,0,0,.6), inset 0 0 0 3px rgba(233,196,106,.6)" });
  if (variant === "lol") Object.assign(card.style, { background: "#fff", boxShadow: "0 30px 0 rgba(0,0,0,.35), inset 0 0 0 8px #111" });
  if (variant === "forget") Object.assign(card.style, { background: "linear-gradient(160deg,#21103f,#0b0518)", boxShadow: "0 40px 90px rgba(0,0,0,.6), inset 0 0 0 3px rgba(179,136,255,.7)" });
  if (variant === "moment") ["top", "bottom"].forEach((side) => { const s = el("div", "", card); Object.assign(s.style, { position: "absolute", left: "40px", right: "40px", [side]: "22px", height: "26px", backgroundImage: "repeating-linear-gradient(90deg, rgba(255,240,210,.8) 0 26px, transparent 26px 52px)", borderRadius: "4px" }); });
  if (variant === "forget") { const sc = el("div", "scan", card); sc.style.borderRadius = "34px"; }
  const qm1 = el("div", "qmark", card, "״");
  Object.assign(qm1.style, { right: "50px", top: "-40px", color: variant === "lol" ? "#ffd60a" : th.color });
  const q = el("div", "quote", card, ph.q);
  q.style.color = variant === "lol" ? "#111" : "#fff";
  q.style.left = "120px"; q.style.top = "110px";
  fitBox(q, 1200, 380, 104, 40);
  q.style.top = 110 + (380 - q.scrollHeight) / 2 + "px";
  const num = P("div", "pill", L, `מועמד ${ph.i + 1} מתוך ${total}`);
  num.style.fontSize = "34px";
  const ic = icon(th.icons[ph.i % th.icons.length], 170, L);
  cue("swish", t0 + ph.a, 0.6);
  if (variant === "forget") cue("glitchblip", t0 + ph.a + 0.1, 0.5);
  const dur = ph.b - ph.a;
  const gl = variant === "forget";
  return (lt0) => {
    const lt = lt0 - ph.a;
    if (lt < 0 || lt > dur) { css(L, { display: "none" }); return; }
    css(L, { display: "block" });
    const inP = E.outBack(seg(lt, 0, 0.55), 1.3), out = E.inBack(seg(lt, dur - 0.4, dur), 1.2);
    const jx = gl && (Math.floor(lt0 * 10) % 7 === 0) ? (hash(Math.floor(lt0 * 10)) - 0.5) * 40 : 0;
    put(card, W / 2 + (1 - inP) * 1400 - out * 1600 + jx, 560 + Math.sin(lt * 1.2) * 5, 1, (1 - inP) * 6 - out * 6 + (variant === "lol" ? -1.5 : 0), 1);
    if (gl) css(q, { textShadow: Math.floor(lt0 * 8) % 6 === 0 ? "6px 0 #ff2a6d, -6px 0 #05d9e8" : "none" });
    put(num, W / 2 + (1 - inP) * 1400 - out * 1600, 175, 1, 0, 1);
    put(ic, 290 + (1 - inP) * 1400 - out * 1600, 840, pop(lt, 0.3), Math.sin(lt * 2.4) * 10, 1);
  };
}
function gagCard(root, t0, ph, th) {
  const L = layer(root);
  const card = P("div", "bubble", L, "ומישהו כתב רק ״אין״");
  card.style.fontSize = "80px";
  const e = icon("face-with-hand-over-mouth", 180, L);
  cue("s_boing", t0 + ph.a + 0.1, 0.8);
  cue("s_laugh", t0 + ph.a + 0.4, 0.35);
  const dur = ph.b - ph.a;
  return (lt0) => {
    const lt = lt0 - ph.a;
    if (lt < 0 || lt > dur) { css(L, { display: "none" }); return; }
    css(L, { display: "block" });
    const out = E.inBack(seg(lt, dur - 0.35, dur));
    put(card, W / 2, 520, E.outElastic(seg(lt, 0.05, 0.8)) * (1 - out), -3, 1);
    put(e, W / 2 + 560, 720, pop(lt, 0.4) * (1 - out), Math.sin(lt * 4) * 10, 1);
  };
}
// a group of answers about the same person/place: second place, or the winner
function groupCard(root, t0, ph, th, cat, isWin) {
  const L = layer(root);
  const g = ph.g;
  const t = t0 + ph.a;
  const isPerson = FACES.has(g.label);
  const ring = faceRing(L, g.label, isWin ? 330 : 260, isWin ? "" : "silver", isPerson ? null : "round-pushpin");
  const top = P("div", "eyebrow", L, isWin ? "הזוכה בקטגוריה" : "מקום שני");
  top.style.fontSize = "34px";
  const catName = P("div", "", L, cat.title);
  Object.assign(catName.style, { fontSize: "46px", fontWeight: 800, whiteSpace: "nowrap", color: th.color });
  const name = P("div", isWin ? "gold display" : "display", L, g.label);
  name.style.fontSize = isWin ? "150px" : "110px";
  if (!isWin) metalText(name, 1);
  const cnt = P("div", "pill", L, `${g.count} אזכורים`);
  cnt.style.fontSize = "40px";
  const qs = g.quotes.map((qq) => {
    const c = P("div", "card", L);
    Object.assign(c.style, { padding: "18px 40px", borderRadius: "24px", whiteSpace: "nowrap", fontSize: "40px", fontWeight: 700 });
    c.textContent = `״${qq}״`;
    fitLine(c, 1100, 42, 26);
    return c;
  });
  const n = qs.length;
  const qx = isWin ? 640 : 680; // quotes column center (left side), the hero sits on the right
  if (isWin) {
    mark("win", t);
    cue("s_boom", t, 1);
    cue("crash", t, 0.8);
    cue("s_fanfare", t + 0.05, 0.85);
    cue("s_cheer", t + 0.1, 0.9);
    burst(t + 0.02, { kind: "confetti", x: 0, y: H, angle: -1.0, spread: 0.8, n: 170, speed: 2200 });
    burst(t + 0.02, { kind: "confetti", x: W, y: H, angle: -2.14, spread: 0.8, n: 170, speed: 2200 });
    burst(t + 0.05, { kind: "spark", x: 1420, y: 420, n: 70, speed: 1200, gravity: 800, life: 2 });
  } else {
    mark("level", t);
    cue("s_whoosh", t, 0.5);
    cue("v_second", t + 0.1, 1.2);
    cue("s_applause", t + 1.1, 0.45);
  }
  qs.forEach((_, i) => cue("pop", t + 1.0 + i * 0.35, 0.7));
  const st = isWin ? statue(L, 520) : null;
  const dur = ph.b - ph.a;
  return (lt0) => {
    const lt = lt0 - ph.a;
    if (lt < 0 || lt > dur) { css(L, { display: "none" }); return; }
    css(L, { display: "block" });
    if (isWin) { ENV.rays = clamp(lt * 3); ENV.glow = 1; ENV.glowY = 0.42; ENV.beams = 0.4; ENV.shake = lt < 0.5 ? 1 - lt / 0.5 : 0; if (lt < 0.3) ENV.flash = 0.6 * (1 - lt / 0.3); }
    const out = E.inC(seg(lt, dur - 0.4, dur));
    const hx = 1400;
    put(top, W / 2, 70, 1, 0, clamp((lt - 0.2) * 3) * (1 - out));
    put(catName, W / 2, 125, 1, 0, clamp((lt - 0.3) * 3) * (1 - out));
    put(ring, hx, 420, E.outBack(seg(lt, 0, 0.6), 1.8) * (1 - out * 0.3), 0, 1 - out);
    put(name, hx, 700, lerp(1.6, 1, E.outExpo(seg(lt, 0.2, 0.55))), 0, clamp((lt - 0.2) * 5) * (1 - out));
    if (isWin) shine(name, lt, 2.4);
    put(cnt, hx, 840, pop(lt, 0.6), 0, clamp((lt - 0.6) * 4) * (1 - out));
    qs.forEach((c, i) => {
      const a = 1.0 + i * 0.35;
      const y = 540 + (i - (n - 1) / 2) * 140;
      put(c, qx - (1 - E.outBack(seg(lt, a, a + 0.5))) * 200, y, 1, (i % 2 ? 1.2 : -1.2), clamp((lt - a) * 4) * (1 - out));
    });
    if (st) put(st, 1770, lerp(1400, 640, E.outBack(seg(lt, 0.2, 0.9), 1.3)) + Math.sin(lt * 1.6) * 8, 0.85, 4, 1 - out);
  };
}

function interludeScene(files, title, n) {
  const DUR = 8;
  scene("interlude-" + n, DUR, (root, t0) => {
    mark("break", t0);
    const h = P("div", "gold display", root, title);
    h.style.fontSize = "110px"; h.style.whiteSpace = "nowrap";
    const cam = icon("camera-with-flash", 130, root);
    const pos = [[1440, 600, -6], [960, 590, 4], [480, 610, -3]];
    const pols = files.map((f, i) => {
      const p = P("div", "polaroid", root);
      const land = LANDSCAPE.has(f);
      p.style.width = (land ? 580 : 440) + "px"; p.style.height = (land ? 500 : 640) + "px";
      const im = img("private/photos/" + f, "", p);
      cue("shutter", t0 + 0.7 + i * 1.6, 0.9);
      cue("swish", t0 + 0.45 + i * 1.6, 0.4);
      return { p, im, x: pos[i][0], y: pos[i][1], rot: pos[i][2], a: 0.45 + i * 1.6 };
    });
    cue("hit", t0 + 0.2, 0.5);
    transition(t0 + DUR, "wipe");
    return {
      update(lt) {
        ENV.tint = "#2a1c0c"; ENV.tint2 = "#060402"; ENV.glow = 0.7; ENV.bokeh = 0.9; ENV.beams = 0.25;
        const out = E.inC(seg(lt, DUR - 0.45, DUR));
        put(h, W / 2 + 70, 105, pop(lt, 0.15), 0, 1 - out);
        shine(h, lt, 2.6);
        put(cam, W / 2 + 70 - h.offsetWidth / 2 - 90, 100, pop(lt, 0.35), Math.sin(lt * 2) * 8, 1 - out);
        pols.forEach((p) => {
          const a = lt - p.a, land = E.outBounce(seg(a, 0, 0.6));
          put(p.p, p.x, lerp(-500, p.y, land) - out * 0, 1, p.rot + (1 - land) * 25, a < 0 ? 0 : 1 - out);
          css(p.im, { transform: `scale(${(1.02 + clamp(a / 7) * 0.08).toFixed(4)})` });
          if (a > 0.25 && a < 0.45) ENV.flash = Math.max(ENV.flash, 0.5 * (1 - (a - 0.25) / 0.2));
        });
      },
    };
  });
}

function specialScene() {
  const people = DATA.mentions.filter((m) => FACES.has(m.name));
  const DUR = 21;
  scene("special", DUR, (root, t0) => {
    mark("special", t0);
    cue("v_special", t0 + 0.3, 1.25);
    const now = P("div", "", root, "ועכשיו…");
    Object.assign(now.style, { fontFamily: '"Frank Ruhl Libre"', fontWeight: 900, fontSize: "90px", whiteSpace: "nowrap" });
    const sp = P("div", "eyebrow", root, "פרס מיוחד");
    sp.style.fontSize = "52px";
    const big = P("div", "gold display", root, "פרס מפעל חיים");
    big.style.fontSize = "190px"; big.style.whiteSpace = "nowrap";
    const q = P("div", "", root, "מי הוזכר הכי הרבה בכל הטופס?");
    Object.assign(q.style, { fontSize: "58px", fontWeight: 800, whiteSpace: "nowrap" });
    const stc = statue(root, 520);
    cue("s_boom", t0 + 3.4, 1);
    cue("shimmer", t0 + 3.5, 0.8);
    burst(t0 + 3.4, { kind: "spark", x: W / 2, y: 520, n: 90, speed: 1500, gravity: 900, life: 2.2 });
    // the race
    const race = P("div", "", root);
    race.style.width = W + "px"; race.style.height = H + "px";
    const rh = P("div", "", race, `ספירת אזכורים בכל ${DATA.voters * DATA.categories.length} התשובות`);
    Object.assign(rh.style, { fontSize: "46px", fontWeight: 800, whiteSpace: "nowrap", color: "#ffe08a" });
    const max = people[0].count;
    const rowH = 64;
    const r = rng(17);
    const rows = people.map((m, i) => {
      const row = P("div", "", race);
      Object.assign(row.style, { width: "1640px", height: rowH + "px" });
      const f = faceRing(row, m.name, 56, "");
      Object.assign(f.style, { position: "absolute", right: "4px", top: "4px", left: "auto", padding: "3px" });
      f.classList.remove("p");
      const lab = el("div", "bar-label", row, m.name);
      Object.assign(lab.style, { right: "80px", top: "50%", transform: "translateY(-50%)", fontSize: "40px" });
      const fill = el("div", "bar-fill", row);
      Object.assign(fill.style, { right: "260px", top: "12px", bottom: "12px", background: i === 0 ? METAL_GRAD[0].replace("180deg", "90deg") : "linear-gradient(90deg, rgba(255,205,110,.45), rgba(255,205,110,.85))" });
      const num = el("div", "bar-num", row, "0");
      Object.assign(num.style, { top: "50%", fontSize: "44px" });
      return { row, fill, num, m, d: i * 0.12 + r() * 0.3, sp: 2.4 + r() * 1.4 };
    });
    for (let k = 0; k < 22; k++) cue("tick", t0 + 6.2 + k * 0.2, 0.25);
    // the winner
    const L = people[0];
    const wr = faceRing(root, L.name, 400, "");
    const crown = icon("crown", 200, root);
    const wn = P("div", "gold display", root, L.name);
    wn.style.fontSize = "170px";
    const catsWith = DATA.categories.filter((c) => JSON.stringify(c).includes(L.name)).length;
    const wl = P("div", "pill", root, `${L.count} אזכורים · ב־${catsWith} קטגוריות שונות`);
    wl.style.fontSize = "46px";
    const wt = 13.6;
    cue("s_boom", t0 + wt, 1); cue("crash", t0 + wt, 0.8); cue("s_fanfare", t0 + wt + 0.05, 0.85); cue("s_cheer", t0 + wt + 0.1, 1);
    cue("s_boing", t0 + wt + 1.0, 0.7);
    mark("win", t0 + wt);
    burst(t0 + wt + 0.02, { kind: "confetti", x: 0, y: H, angle: -1.0, spread: 0.8, n: 180, speed: 2200 });
    burst(t0 + wt + 0.02, { kind: "confetti", x: W, y: H, angle: -2.14, spread: 0.8, n: 180, speed: 2200 });
    burst(t0 + wt + 0.05, { kind: "spark", x: W / 2, y: 400, n: 90, speed: 1400, gravity: 800, life: 2.2 });
    transition(t0 + DUR, "wipe");
    const value = (row, lt) => row.m.count * E.ioQ(seg(lt, 6.2 + row.d, 6.2 + row.d + row.sp));
    return {
      update(lt) {
        ENV.tint = "#1a1206"; ENV.tint2 = "#020101"; ENV.glow = 0.8; ENV.bokeh = 0.6; ENV.beams = lt < 5.6 ? 0.7 : 0.3;
        if (lt > 3.4 && lt < 3.9) ENV.shake = 1 - seg(lt, 3.4, 3.9);
        const o1 = E.inC(seg(lt, 5.3, 5.8));
        put(now, W / 2, 300, 1, 0, env(lt, 0.35, 1.6, 0.3, 0.3));
        put(sp, W / 2, 330, pop(lt, 1.6), 0, clamp((lt - 1.6) * 4) * (1 - o1));
        put(big, W / 2, 500, lt < 3.4 ? 0 : lerp(2, 1, E.outExpo(seg(lt, 3.4, 3.7))) * (1 - o1 * 0.3), 0, lt < 3.4 ? 0 : 1 - o1);
        shine(big, lt, 2.2);
        put(q, W / 2, 680, pop(lt, 4.4), 0, clamp((lt - 4.4) * 4) * (1 - o1));
        put(stc, W / 2, lerp(1500, 870, E.outBack(seg(lt, 3.4, 4.2))), 0.75, 0, lt < 3.4 ? 0 : (1 - o1) * 0.9);
        const rOn = env(lt, 5.6, 13.4, 0.4, 0.4);
        css(race, { display: rOn > 0 ? "block" : "none" });
        if (rOn > 0) {
          put(rh, W / 2, 100, 1, 0, rOn);
          const pos = rows.map((_, i) => i); // rows stay in final order; bars grow at their own pace
          rows.forEach((row, i) => {
            const v = value(row, lt), w = (v / max) * 1180;
            put(row.row, W / 2, 175 + pos[i] * rowH + rowH / 2, 1, 0, rOn * clamp((lt - 5.6 - i * 0.04) * 4));
            css(row.fill, { width: Math.max(6, w).toFixed(1) + "px" });
            css(row.num, { right: (260 + Math.max(6, w) + 16).toFixed(1) + "px", transform: "translateY(-50%)" });
            row.num.textContent = String(Math.round(v));
          });
        }
        const wl0 = lt - wt;
        if (wl0 > 0) { ENV.rays = clamp(wl0 * 3); ENV.raysColor = GOLD_RGB; ENV.glow = 1; ENV.shake = wl0 < 0.5 ? 1 - wl0 / 0.5 : 0; if (wl0 < 0.3) ENV.flash = 0.6 * (1 - wl0 / 0.3); }
        const o2 = E.inC(seg(lt, DUR - 0.45, DUR));
        put(wr, W / 2, 420, wl0 < 0 ? 0 : E.outBack(seg(wl0, 0, 0.6), 1.8) * (1 - o2 * 0.3), 0, wl0 < 0 ? 0 : 1 - o2);
        put(crown, W / 2, lerp(-200, 195, E.outBounce(seg(wl0, 1.0, 1.7))), 1, -8, wl0 < 1 ? 0 : 1 - o2);
        put(wn, W / 2, 755, wl0 < 0.25 ? 0 : lerp(1.7, 1, E.outExpo(seg(wl0, 0.25, 0.6))), 0, wl0 < 0.25 ? 0 : 1 - o2);
        shine(wn, lt, 2.2);
        put(wl, W / 2, 900, pop(wl0, 0.8), 0, clamp((wl0 - 0.8) * 4) * (1 - o2));
      },
    };
  });
}

function outroScene() {
  const DUR = 18;
  scene("outro", DUR, (root, t0) => {
    mark("outro", t0);
    cue("v_outro", t0 + 0.6, 1.3);
    const M = DATA.meta;
    const bgp = img("private/photos/" + M.outroPhoto, "photo-full", root);
    bgp.style.filter = "blur(26px) brightness(.45) saturate(1.2)";
    const pol = P("div", "polaroid", root);
    pol.style.width = "600px"; pol.style.height = "820px";
    const pim = img("private/photos/" + M.outroPhoto, "", pol);
    const thanks = P("div", "", root, "תודה שהייתם");
    Object.assign(thanks.style, { fontSize: "80px", fontWeight: 800, whiteSpace: "nowrap", textShadow: "0 4px 18px #000" });
    const pg = P("div", "gold display", root, M.group);
    pg.style.fontSize = "190px"; pg.style.whiteSpace = "nowrap";
    const stamp = P("div", "", root, M.slogan);
    Object.assign(stamp.style, { fontFamily: '"Suez One"', fontSize: "120px", color: "#fff", padding: "10px 60px", borderRadius: "30px", background: "linear-gradient(135deg,#c1121f,#7a0a13)", boxShadow: "0 0 0 8px #f2c14e, 0 30px 60px rgba(0,0,0,.6)", whiteSpace: "nowrap" });
    const st = statue(root, 300);
    cue("s_fireworks", t0 + 3.2, 0.8);
    cue("s_boom", t0 + 3.45, 0.9);
    cue("s_cheer", t0 + 3.5, 0.7);
    [3.5, 4.3, 5.1, 6.0, 6.9, 7.6].forEach((a, i) => burst(t0 + a, { kind: "firework", x: 300 + hash(i + 3) * 1320, y: 200 + hash(i + 7) * 260, n: 110, speed: 900, gravity: 220, life: 2.2, colors: [["#ffd166", "#fff3c4"], ["#ef476f", "#ffb3c6"], ["#06d6a0", "#b8ffe9"], ["#4cc9f0", "#dff7ff"]][i % 4] }));
    // credits
    const by = P("div", "eyebrow", root, "נערך על ידי");
    by.style.fontSize = "40px";
    const tz = P("div", "gold display", root, M.editor);
    tz.style.fontSize = "170px"; tz.style.whiteSpace = "nowrap";
    const king = P("div", "display", root, M.editorTitle);
    Object.assign(king.style, { fontSize: "140px", color: "#fff", textShadow: "0 0 40px rgba(255,200,80,.9), 0 6px 0 #6b470f" });
    const tf = faceRing(root, M.editorFace, 240);
    const crown = icon("crown", 170, root);
    const fin = P("div", "", root, `האוסקרים של ${M.group} · ${M.year}`);
    Object.assign(fin.style, { fontSize: "40px", fontWeight: 600, letterSpacing: ".12em", color: "#d9c08a", whiteSpace: "nowrap" });
    cue("s_whoosh", t0 + 9.2, 0.6);
    cue("hit", t0 + 9.8, 0.8);
    cue("s_boom", t0 + 10.6, 0.8);
    cue("s_boing", t0 + 11.1, 0.8);
    cue("shimmer", t0 + 11.15, 0.9);
    mark("end", t0 + 16);
    return {
      update(lt) {
        ENV.tint = "#120c06"; ENV.tint2 = "#020101"; ENV.glow = 0.6; ENV.bokeh = 0.6;
        const a1 = env(lt, 0, 9.4, 0.6, 0.5);
        put(bgp, W / 2, H / 2, 1.15 - lt * 0.01, 0, a1);
        put(pol, 520, 545, lerp(1.08, 1, E.outC(seg(lt, 0, 1))), -3, a1);
        css(pim, { transform: `scale(${(1.12 - lt * 0.008).toFixed(4)})` });
        put(thanks, 1300, 300, pop(lt, 0.7), 0, clamp((lt - 0.7) * 3) * a1);
        put(pg, 1300, 480, pop(lt, 1.3), 0, clamp((lt - 1.3) * 3) * a1);
        shine(pg, lt, 2.4);
        put(stamp, 1300, 700, lt < 3.42 ? 0 : lerp(3, 1, E.outExpo(seg(lt, 3.42, 3.7))), -6, lt < 3.42 ? 0 : a1);
        put(st, 1300, 930, pop(lt, 4), 0, a1 * 0.9);
        if (lt > 3.42 && lt < 3.9) ENV.shake = 1 - seg(lt, 3.42, 3.9);
        const c1 = env(lt, 9.4, 17.4, 0.4, 1.4);
        put(tf, W / 2, 290, pop(lt, 9.5), 0, c1);
        put(by, W / 2, 500, 1, 0, c1);
        put(tz, W / 2, 630, lt < 9.8 ? 0 : lerp(1.6, 1, E.outExpo(seg(lt, 9.8, 10.1))), 0, lt < 9.8 ? 0 : c1);
        shine(tz, lt, 2.2);
        put(king, W / 2, 810, lt < 10.6 ? 0 : lerp(3, 1, E.outExpo(seg(lt, 10.6, 10.85))), 0, lt < 10.6 ? 0 : c1);
        put(crown, W / 2 + 6, lerp(-200, 160, E.outBounce(seg(lt, 11.1, 11.8))), 1, -8, lt < 11.1 ? 0 : c1);
        put(fin, W / 2, 980, 1, 0, env(lt, 12, 17.4, 0.6, 1.4));
        ENV.fade = seg(lt, 16.8, 18);
      },
    };
  });
}

// ================================================================ the ~3 minute cut (?short)
// Same look, tighter story: per category a short title, a one-beat-per-number countdown, and one
// podium screen where third and second pop up, a one-second drum roll, and the winner lands.

// a pill with a mini face (or two for couples) and the name, for tied places
function nameChip(parent, label, metal) {
  const c = P("div", "", parent);
  Object.assign(c.style, { display: "flex", alignItems: "center", gap: "10px", padding: "6px 22px 6px 8px", borderRadius: "999px", background: "rgba(0,0,0,.55)", boxShadow: "inset 0 0 0 2px rgba(255,220,140,.45)", whiteSpace: "nowrap" });
  const who = splitCouple(label) || [personOf(label) || (label === "אמא של אופק" ? "אופק" : label)];
  who.forEach((nm) => {
    const f = faceRing(c, nm, 50, metal);
    f.classList.remove("p");
    Object.assign(f.style, { position: "relative", padding: "3px", flex: "none" });
  });
  const t = el("div", "", c, label);
  Object.assign(t.style, { fontSize: "32px", fontWeight: 800, color: "#fff" });
  return c;
}

function podiumScene(cat, idx, th) {
  const DUR = 6.5;
  const T3 = 0.5, T2 = 1.1, TD = 1.7, TW = 2.7; // third, second, drum roll, winner
  scene("podium-" + cat.id, DUR, (root, t0) => {
    mark("level", t0); mark("stop", t0 + TD); mark("win", t0 + TW);
    const lv = cat.podium;
    const FLOOR = 1050;
    const PED = [{ x: 960, h: 300, w: 400, face: 290 }, { x: 1450, h: 205, w: 380, face: 210 }, { x: 470, h: 145, w: 380, face: 185 }];
    const winner = lv[0];
    const quotes = cat.results.filter((r) => winner.names.includes(r.label)).flatMap((r) => r.quotes);
    const top = P("div", "eyebrow", root, "האוסקר ל");
    top.style.fontSize = "32px";
    const catName = P("div", "", root, cat.title);
    Object.assign(catName.style, { fontSize: "54px", fontWeight: 900, whiteSpace: "nowrap", color: th.color, textShadow: "0 3px 14px #000" });
    const st1 = statue(root, 420), st2 = statue(root, 420);
    const disc = P("div", "ring", root);
    disc.style.width = disc.style.height = "260px";
    const din = el("div", "face", disc);
    Object.assign(din.style, { position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", background: "radial-gradient(circle at 40% 35%, #3a2a12, #120b04)" });
    const qm = el("div", "gold display", din, "?");
    qm.style.fontSize = "170px";
    const cone = P("div", "", root);
    Object.assign(cone.style, { width: "700px", height: "1100px", background: "linear-gradient(180deg, rgba(255,240,200,.5), rgba(255,240,200,.04))", clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)", filter: "blur(6px)" });
    const peds = PED.map((p, r) => {
      const L = lv[r];
      if (!L) return null;
      const box = P("div", "", root);
      Object.assign(box.style, { width: p.w + "px", height: p.h + "px", borderRadius: "10px 10px 0 0", background: METAL_GRAD[r].replace("180deg", "90deg"), boxShadow: "inset 0 10px 0 rgba(255,255,255,.35), inset 0 -30px 60px rgba(0,0,0,.35), 0 30px 60px rgba(0,0,0,.6)" });
      const num = el("div", "", box, String(r + 1));
      Object.assign(num.style, { position: "absolute", left: 0, right: 0, bottom: "-6px", textAlign: "center", fontFamily: '"Suez One"', fontSize: (r === 0 ? 150 : r === 1 ? 110 : 80) + "px", lineHeight: 1, color: "rgba(0,0,0,.16)" });
      const multi = L.names.length > 1;
      const nm = el("div", "", box, multi ? "שוויון!" : L.names[0]);
      Object.assign(nm.style, { position: "absolute", left: "50%", transform: "translateX(-50%)", top: r === 2 ? "8px" : "16px", fontFamily: '"Suez One"', lineHeight: 1.1, color: "#1b1206", textShadow: "0 2px 0 rgba(255,255,255,.4)", whiteSpace: "nowrap" });
      fitLine(nm, p.w - 36, r === 0 ? 76 : r === 1 ? 60 : 50, 24);
      const vt = el("div", "", box, votesText(L.votes) + (multi ? " לכל אחד" : ""));
      Object.assign(vt.style, { position: "absolute", left: 0, right: 0, top: (r === 0 ? 112 : r === 1 ? 92 : 70) + "px", textAlign: "center", fontWeight: 800, fontSize: (r === 2 ? 26 : 32) + "px", color: "rgba(27,18,6,.8)" });
      const items = multi
        ? L.names.map((n) => nameChip(root, n, METAL[r]))
        : [entryVisual(root, L.names[0], splitCouple(L.names[0]) ? p.face * 0.82 : p.face, METAL[r])];
      const tAt = [TW, T2, T3][r];
      items.forEach((_, i) => cue("pop", t0 + tAt + i * 0.08, r === 0 ? 0 : 0.8));
      if (r > 0) cue("s_applause", t0 + tAt + 0.1, r === 1 ? 0.45 : 0.35);
      return { box, items, multi, p, r, tAt };
    });
    const bubble = quotes.length ? P("div", "bubble", root, `״${quotes[0]}״`) : null;
    if (bubble) bubble.style.fontSize = "42px";
    const t = t0 + TW;
    cue("s_boom", t, 1); cue("crash", t, 0.8); cue("s_fanfare", t + 0.05, 0.85); cue("s_cheer", t + 0.1, 0.9);
    if (bubble) cue("pop", t + 0.8, 0.7);
    burst(t + 0.02, { kind: "confetti", x: 0, y: H, angle: -1.0, spread: 0.8, n: 160, speed: 2200 });
    burst(t + 0.02, { kind: "confetti", x: W, y: H, angle: -2.14, spread: 0.8, n: 160, speed: 2200 });
    burst(t + 0.05, { kind: "spark", x: W / 2, y: 560, n: 80, speed: 1300, gravity: 800, life: 2 });
    cue("s_whoosh", t0, 0.45);
    transition(t0 + DUR, "wipe", [th.color, "#0d0905", "#f2c14e"]);
    return {
      update(lt) {
        setThemeEnv(th, 0.8);
        ENV.bokeh = 0.5; ENV.beams = 0.3; ENV.glowY = 0.53;
        const drum = lt >= TD && lt < TW, won = lt >= TW;
        if (drum) { ENV.glow = 0.2; ENV.vignette = 1; ENV.bokeh = 0.15; ENV.zoom = 1 + (lt - TD) * 0.02; }
        if (won) { const w = lt - TW; ENV.rays = clamp(w * 3); ENV.raysColor = GOLD_RGB; ENV.glow = 1; ENV.shake = w < 0.45 ? 1 - w / 0.45 : 0; if (w < 0.3) ENV.flash = 0.6 * (1 - w / 0.3); }
        const out = E.inC(seg(lt, DUR - 0.35, DUR));
        put(top, W / 2, 62, 1, 0, clamp(lt * 4) * (1 - out));
        put(catName, W / 2, 118, pop(lt, 0.05), 0, clamp(lt * 4) * (1 - out));
        put(cone, W / 2, 520, 1, 0, drum ? clamp((lt - TD) * 4) * (0.85 + 0.15 * Math.sin(lt * 30)) : 0);
        put(disc, W / 2, FLOOR - 300 - 22 - 145, (drum ? pop(lt, TD, 0.35) : 0) * (1 + 0.05 * Math.abs(Math.sin(lt * 18))), 0, drum ? 1 : 0);
        shine(qm, lt * 2, 1.3);
        const order = [2, 1, 0];
        peds.forEach((pd) => {
          if (!pd) return;
          const { p, r } = pd;
          const o = order[r];
          const rise = E.outBack(seg(lt, 0.05 + o * 0.12, 0.55 + o * 0.12), 1.2);
          const topY = FLOOR - p.h;
          put(pd.box, p.x, FLOOR - p.h / 2 + (1 - rise) * (p.h + 120) + out * 400, 1, 0, 1);
          pd.items.forEach((it, i) => {
            const a = pd.tAt + i * 0.08;
            const s = lt < a ? 0 : r === 0 ? lerp(0.2, 1, E.outBack(seg(lt, a, a + 0.5), 1.8)) : pop(lt, a, 0.45);
            const y = pd.multi ? topY - 52 - i * 70 : topY - 22 - p.face / 2;
            put(it, p.x, y + Math.sin(lt * 2 + i + r) * 5 + out * 400, s, 0, clamp(s * 3) * (1 - out));
          });
        });
        const su = E.outBack(seg(lt, TW, TW + 0.7), 1.3), bob = Math.sin(lt * 1.6) * 8;
        put(st1, 130, lerp(1500, 830, su) + bob, 1, -4, won ? 1 - out : 0);
        put(st2, W - 130, lerp(1500, 830, su) - bob, 1, 4, won ? 1 - out : 0);
        if (bubble) put(bubble, W / 2 - 430, 330, pop(lt, TW + 0.8), 3, clamp((lt - TW - 0.8) * 5) * (1 - out));
      },
    };
  });
}

function textShortScene(cat, idx, th) {
  const win = cat.groups[0];
  const wd = qb(5.2 + win.quotes.join("").length * 0.035);
  const T = [{ kind: "drum", a: 0, b: 1.0 }, { kind: "twin", g: win, a: 1.0, b: 1.0 + wd }];
  scene("text-" + cat.id, 1.0 + wd, (root, t0, dur) => {
    const parts = [drumPart(root, t0, T[0], th, cat, null, true), groupCard(root, t0, T[1], th, cat, true)];
    transition(t0 + dur, "wipe", [th.color, "#0d0905", "#f2c14e"]);
    return { update(lt) { setThemeEnv(th, 0.8); ENV.bokeh = 0.45; for (const p of parts) p(lt); } };
  });
}

function introShort() {
  const DUR = 13.5;
  scene("intro", DUR, (root, t0) => {
    const M = DATA.meta;
    mark("intro", t0);
    mark("drop", t0 + 6.5);
    const curL = P("div", "curtain l", root), curR = P("div", "curtain r", root), val = P("div", "valance", root);
    const ladies = P("div", "", root, "גבירותיי ורבותיי");
    Object.assign(ladies.style, { fontFamily: '"Frank Ruhl Libre"', fontWeight: 900, fontSize: "96px", color: "#fff3d0", textShadow: "0 6px 20px rgba(0,0,0,.8)", whiteSpace: "nowrap" });
    const l1 = P("div", "gold display", root, "ברוכים הבאים"); l1.style.whiteSpace = "nowrap";
    fitLine(l1, 1500, 170);
    const l2 = P("div", "gold-spans display", root);
    const base = chars(l2, "לאוסקרים");
    const extra = [0, 1, 2].map(() => el("span", "w", l2, "ם"));
    fitLine(l2, 1250, 250, 120);
    const l3 = P("div", "gold-spans display", root);
    const w3 = words(l3, M.group);
    l3.style.fontSize = "190px";
    const st1 = statue(root, 560), st2 = statue(root, 560);
    const r = rng(42);
    const pols = M.blitz.slice(0, 4).map((f, i) => {
      const land = LANDSCAPE.has(f);
      const p = P("div", "polaroid", root);
      p.style.width = (land ? 640 : 440) + "px";
      p.style.height = (land ? 540 : 640) + "px";
      img("private/photos/" + f, "", p);
      return { p, x: 420 + i * 360 + (r() - 0.5) * 120, y: 380 + r() * 300, rot: (r() - 0.5) * 22, t: 9 + i * 0.5 };
    });
    const by = P("div", "eyebrow", root, "נערך על ידי");
    by.style.fontSize = "40px";
    const ed = P("div", "gold display", root, M.editor);
    ed.style.fontSize = "170px"; ed.style.whiteSpace = "nowrap";
    const king = P("div", "display", root, M.editorTitle);
    Object.assign(king.style, { fontSize: "150px", color: "#fff", textShadow: "0 0 40px rgba(255,200,80,.9), 0 6px 0 #6b470f", whiteSpace: "nowrap" });
    const tf = faceRing(root, M.editorFace, 260);
    const crown = icon("crown", 190, root);
    const V = 0.5; // the announcer starts here; his phrases drive the cuts
    cue("s_boom", t0 + V - 0.05, 0.35);
    cue("v_intro", t0 + V, 1.3);
    cue("s_boom", t0 + V + 2.39, 0.9);
    cue("s_whoosh", t0 + V + 3.3, 0.6);
    extra.forEach((_, i) => cue("pop", t0 + V + 4.35 + i * 0.2, 0.9));
    cue("s_boom", t0 + V + 6.15, 1);
    cue("shimmer", t0 + V + 6.3, 0.8);
    burst(t0 + V + 6.15, { kind: "spark", x: W / 2, y: 780, n: 90, speed: 1500, gravity: 900, life: 2.2, size: 1.2 });
    burst(t0 + V + 6.2, { kind: "confetti", x: 0, y: H, angle: -1.0, spread: 0.9, n: 160, speed: 2100 });
    burst(t0 + V + 6.2, { kind: "confetti", x: W, y: H, angle: -2.14, spread: 0.9, n: 160, speed: 2100 });
    pols.forEach((p, i) => { cue("shutter", t0 + p.t, 0.9); if (i % 2 === 0) cue("s_flash", t0 + p.t - 0.02, 0.35); });
    cue("s_whoosh", t0 + 10.9, 0.7);
    cue("hit", t0 + 11.3, 0.8);
    cue("s_boom", t0 + 11.9, 0.8);
    cue("s_boing", t0 + 12.2, 0.9);
    cue("shimmer", t0 + 12.25, 0.9);
    burst(t0 + 12.2, { kind: "spark", x: W / 2, y: 300, n: 60, speed: 1100, gravity: 700, life: 1.8 });
    transition(t0 + DUR, "wipe", ["#f2c14e", "#1b1206", "#fff3c4"]);
    const A = V + 2.39, OPEN = V + 3.3, L2 = V + 3.81, G1 = V + 5.05, G2 = V + 6.15;
    return {
      update(lt) {
        ENV.tint = "#160f06"; ENV.tint2 = "#020101"; ENV.glow = lt < V ? 0.1 : 0.8;
        ENV.bokeh = 0.6; ENV.beams = lt < V ? 0 : lt < 9 ? 0.85 : 0.55;
        if (lt >= V && lt < V + 0.35) ENV.flash = 1 - seg(lt, V, V + 0.35);
        if (lt >= G2 && lt < G2 + 0.3) ENV.flash = 0.7 * (1 - seg(lt, G2, G2 + 0.3));
        ENV.shake = (lt > V && lt < V + 0.5 ? 1 - seg(lt, V, V + 0.5) : 0) + (lt > A && lt < A + 0.5 ? 1 - seg(lt, A, A + 0.5) : 0) + (lt > G2 && lt < G2 + 0.55 ? 1.2 * (1 - seg(lt, G2, G2 + 0.55)) : 0);
        const op = E.ioC(seg(lt, OPEN, OPEN + 1.2));
        const cv = lt >= V && lt < OPEN + 1.4 ? 1 : 0;
        put(curL, W * 0.26 - op * 1050, H / 2, 1, 0, cv);
        put(curR, W * 0.74 + op * 1050, H / 2, 1, 0, cv);
        put(val, W / 2, 60 - op * 160, 1, 0, cv);
        put(ladies, W / 2, 540, 0.9 + 0.1 * E.outC(seg(lt, V, V + 0.6)), 0, env(lt, V + 0.05, A - 0.1, 0.3, 0.25));
        const s1 = lt < A ? 0 : lerp(2.6, 1, E.outExpo(seg(lt, A, A + 0.24)));
        const y1 = lerp(540, 250, E.ioC(seg(lt, OPEN, OPEN + 1)));
        const out = E.inC(seg(lt, 8.5, 9.0));
        put(l1, W / 2, y1 - out * 60, s1 * (1 - out * 0.2), 0, lt < A ? 0 : (1 - out) * clamp((lt - A) * 6));
        shine(l1, lt, 2.6);
        put(l2, W / 2, 500 - out * 40, 1 - out * 0.2, 0, lt < L2 ? 0 : 1 - out);
        base.forEach((c, i) => { const a = L2 + i * 0.04; css(c, { transform: `translateY(${((1 - E.outBack(seg(lt, a, a + 0.32))) * -220).toFixed(1)}px)`, opacity: clamp((lt - a) * 8).toFixed(2) }); });
        extra.forEach((c, i) => { const a = V + 4.35 + i * 0.2, p = seg(lt, a, a + 0.32); css(c, { transform: `scale(${(lt < a ? 0 : E.outElastic(p)).toFixed(3)}, ${(lt < a ? 0 : 1 + 0.4 * (1 - E.outC(p))).toFixed(3)})`, opacity: lt < a ? "0" : "1" }); });
        [...base, ...extra].forEach((c, i) => shine(c, lt, 2.6, 0.5 + i * 0.05));
        w3.forEach((w, i) => { const a = i ? G2 : G1; css(w, { transform: `scale(${(lt < a ? 0 : lerp(2.2, 1, E.outExpo(seg(lt, a, a + 0.28)))).toFixed(3)})`, opacity: lt < a ? "0" : "1" }); });
        put(l3, W / 2, 760 - out * 20, 1 - out * 0.2, 0, lt < G1 ? 0 : 1 - out);
        w3.forEach((c, i) => shine(c, lt, 2.6, 1.0 + i * 0.2));
        const su = E.outBack(seg(lt, G2, G2 + 0.75), 1.4), sb = Math.sin(lt * 1.6) * 8;
        put(st1, 165, lerp(1500, 620, su) + sb, 1, -4, lt < G2 ? 0 : 1 - out);
        put(st2, W - 165, lerp(1500, 620, su) - sb, 1, 4, lt < G2 ? 0 : 1 - out);
        pols.forEach((p, i) => {
          const a = lt - p.t, outP = E.inBack(seg(lt, 10.8, 11.2));
          const sIn = a < 0 ? 0 : lerp(1.8, 1, E.outExpo(seg(a, 0, 0.25)));
          put(p.p, p.x + outP * (i % 2 ? 1 : -1) * 2400, p.y, sIn, p.rot + (1 - E.outC(seg(a, 0, 0.3))) * 20, a < 0 ? 0 : 1 - seg(lt, 11, 11.2));
          if (a >= 0 && a < 0.1) ENV.flash = Math.max(ENV.flash, 0.38 * (1 - a / 0.1));
        });
        const cOut = E.inC(seg(lt, DUR - 0.45, DUR));
        put(tf, W / 2, 300, pop(lt, 11.1, 0.5) * (1 - cOut), 0, lt < 11.1 ? 0 : 1 - cOut);
        put(by, W / 2, 520, 1, 0, env(lt, 11.0, DUR, 0.35, 0.45));
        put(ed, W / 2, 650, lt < 11.3 ? 0 : lerp(1.6, 1, E.outExpo(seg(lt, 11.3, 11.6))) * (1 - cOut * 0.3), 0, lt < 11.3 ? 0 : 1 - cOut);
        shine(ed, lt, 2.2);
        put(king, W / 2, 840, lt < 11.9 ? 0 : lerp(3, 1, E.outExpo(seg(lt, 11.9, 12.15))), Math.sin(lt * 3) * 2, lt < 11.9 ? 0 : 1 - cOut);
        if (lt > 11.9 && lt < 12.3) ENV.shake = 1 - seg(lt, 11.9, 12.3);
        put(crown, W / 2 + 6, lerp(-200, 158, E.outBounce(seg(lt, 12.2, 12.9))), 1, -8 + Math.sin(lt * 3) * 4, lt < 12.2 ? 0 : 1 - cOut);
      },
    };
  });
}

function specialShort() {
  const people = DATA.mentions.filter((m) => FACES.has(m.name));
  const DUR = 9.5;
  scene("special", DUR, (root, t0) => {
    mark("special", t0);
    cue("v_special_short", t0 + 0.3, 1.25);
    const sp = P("div", "eyebrow", root, "פרס מיוחד");
    sp.style.fontSize = "52px";
    const big = P("div", "gold display", root, "פרס מפעל חיים");
    big.style.fontSize = "190px"; big.style.whiteSpace = "nowrap";
    const q = P("div", "", root, "מי הוזכר הכי הרבה בטופס?");
    Object.assign(q.style, { fontSize: "60px", fontWeight: 800, whiteSpace: "nowrap" });
    cue("s_boom", t0 + 0.3, 0.55);
    cue("shimmer", t0 + 2.0, 0.7);
    burst(t0 + 0.3, { kind: "spark", x: W / 2, y: 520, n: 80, speed: 1400, gravity: 900, life: 2 });
    const race = layer(root);
    const max = people[0].count, rowH = 62;
    const rows = people.map((m, i) => {
      const row = P("div", "", race);
      Object.assign(row.style, { width: "1640px", height: rowH + "px" });
      const f = faceRing(row, m.name, 54, "");
      Object.assign(f.style, { position: "absolute", right: "4px", top: "4px", left: "auto", padding: "3px" });
      f.classList.remove("p");
      const lab = el("div", "bar-label", row, m.name);
      Object.assign(lab.style, { right: "78px", top: "50%", transform: "translateY(-50%)", fontSize: "38px" });
      const fill = el("div", "bar-fill", row);
      Object.assign(fill.style, { right: "250px", top: "12px", bottom: "12px", background: i === 0 ? METAL_GRAD[0].replace("180deg", "90deg") : "linear-gradient(90deg, rgba(255,205,110,.45), rgba(255,205,110,.85))" });
      const num = el("div", "bar-num", row, "0");
      Object.assign(num.style, { top: "50%", fontSize: "42px" });
      return { row, fill, num, m, d: i * 0.06 };
    });
    for (let k = 0; k < 12; k++) cue("tick", t0 + 2.6 + k * 0.15, 0.25);
    const Lw = people[0];
    const wr = faceRing(root, Lw.name, 380, "");
    const crown = icon("crown", 190, root);
    const wn = P("div", "gold display", root, Lw.name);
    wn.style.fontSize = "170px";
    const catsWith = DATA.categories.filter((c) => JSON.stringify(c).includes(Lw.name)).length;
    const wl = P("div", "pill", root, `${Lw.count} אזכורים · ב־${catsWith} קטגוריות שונות`);
    wl.style.fontSize = "46px";
    const wt = 5.5;
    mark("win", t0 + wt);
    cue("s_boom", t0 + wt, 1); cue("crash", t0 + wt, 0.8); cue("s_fanfare", t0 + wt + 0.05, 0.85); cue("s_cheer", t0 + wt + 0.1, 1);
    cue("s_boing", t0 + wt + 0.9, 0.7);
    burst(t0 + wt + 0.02, { kind: "confetti", x: 0, y: H, angle: -1.0, spread: 0.8, n: 170, speed: 2200 });
    burst(t0 + wt + 0.02, { kind: "confetti", x: W, y: H, angle: -2.14, spread: 0.8, n: 170, speed: 2200 });
    transition(t0 + DUR, "wipe");
    return {
      update(lt) {
        ENV.tint = "#1a1206"; ENV.tint2 = "#020101"; ENV.glow = 0.8; ENV.bokeh = 0.6; ENV.beams = lt < 2.4 ? 0.7 : 0.3;
        if (lt > 0.3 && lt < 0.8) ENV.shake = 1 - seg(lt, 0.3, 0.8);
        const o1 = E.inC(seg(lt, 2.1, 2.5));
        put(sp, W / 2, 330, pop(lt, 0.05), 0, clamp(lt * 4) * (1 - o1));
        put(big, W / 2, 500, lt < 0.3 ? 0 : lerp(2, 1, E.outExpo(seg(lt, 0.3, 0.6))) * (1 - o1 * 0.3), 0, lt < 0.3 ? 0 : 1 - o1);
        shine(big, lt, 2.2);
        put(q, W / 2, 690, pop(lt, 1.0), 0, clamp((lt - 1.0) * 4) * (1 - o1));
        const rOn = env(lt, 2.4, 5.45, 0.3, 0.3);
        css(race, { display: rOn > 0 ? "block" : "none" });
        if (rOn > 0) rows.forEach((row, i) => {
          const v = row.m.count * E.outC(seg(lt, 2.6 + row.d, 4.4 + row.d)), w = (v / max) * 1180;
          put(row.row, W / 2, 140 + i * rowH + rowH / 2, 1, 0, rOn * clamp((lt - 2.4 - i * 0.03) * 5));
          css(row.fill, { width: Math.max(6, w).toFixed(1) + "px" });
          css(row.num, { right: (250 + Math.max(6, w) + 16).toFixed(1) + "px", transform: "translateY(-50%)" });
          row.num.textContent = String(Math.round(v));
        });
        const w0 = lt - wt;
        if (w0 > 0) { ENV.rays = clamp(w0 * 3); ENV.raysColor = GOLD_RGB; ENV.glow = 1; ENV.shake = w0 < 0.5 ? 1 - w0 / 0.5 : 0; if (w0 < 0.3) ENV.flash = 0.6 * (1 - w0 / 0.3); }
        const o2 = E.inC(seg(lt, DUR - 0.4, DUR));
        put(wr, W / 2, 410, w0 < 0 ? 0 : E.outBack(seg(w0, 0, 0.6), 1.8) * (1 - o2 * 0.3), 0, w0 < 0 ? 0 : 1 - o2);
        put(crown, W / 2, lerp(-200, 195, E.outBounce(seg(w0, 0.9, 1.6))), 1, -8, w0 < 0.9 ? 0 : 1 - o2);
        put(wn, W / 2, 740, w0 < 0.2 ? 0 : lerp(1.7, 1, E.outExpo(seg(w0, 0.2, 0.55))), 0, w0 < 0.2 ? 0 : 1 - o2);
        shine(wn, lt, 2.2);
        put(wl, W / 2, 890, pop(w0, 0.6), 0, clamp((w0 - 0.6) * 4) * (1 - o2));
      },
    };
  });
}

function outroShort() {
  const DUR = 10;
  scene("outro", DUR, (root, t0) => {
    const M = DATA.meta;
    mark("outro", t0);
    cue("v_outro", t0 + 0.3, 1.3);
    const bgp = img("private/photos/" + M.outroPhoto, "photo-full", root);
    bgp.style.filter = "blur(26px) brightness(.45) saturate(1.2)";
    const pol = P("div", "polaroid", root);
    pol.style.width = "600px"; pol.style.height = "820px";
    const pim = img("private/photos/" + M.outroPhoto, "", pol);
    const thanks = P("div", "", root, "תודה שהייתם");
    Object.assign(thanks.style, { fontSize: "80px", fontWeight: 800, whiteSpace: "nowrap", textShadow: "0 4px 18px #000" });
    const pg = P("div", "gold display", root, M.group);
    pg.style.fontSize = "190px"; pg.style.whiteSpace = "nowrap";
    const stamp = P("div", "", root, M.slogan);
    Object.assign(stamp.style, { fontFamily: '"Suez One"', fontSize: "120px", color: "#fff", padding: "10px 60px", borderRadius: "30px", background: "linear-gradient(135deg,#c1121f,#7a0a13)", boxShadow: "0 0 0 8px #f2c14e, 0 30px 60px rgba(0,0,0,.6)", whiteSpace: "nowrap" });
    const SL = 0.3 + 2.92; // the slogan, on the announcer's word
    cue("s_fireworks", t0 + SL - 0.2, 0.8);
    cue("s_boom", t0 + SL, 0.9);
    cue("s_cheer", t0 + SL + 0.05, 0.7);
    [0, 0.7, 1.4, 2.1].forEach((a, i) => burst(t0 + SL + a, { kind: "firework", x: 300 + hash(i + 3) * 1320, y: 200 + hash(i + 7) * 260, n: 110, speed: 900, gravity: 220, life: 2.2, colors: [["#ffd166", "#fff3c4"], ["#ef476f", "#ffb3c6"], ["#06d6a0", "#b8ffe9"], ["#4cc9f0", "#dff7ff"]][i % 4] }));
    const by = P("div", "eyebrow", root, "נערך על ידי");
    by.style.fontSize = "40px";
    const ed = P("div", "gold display", root, M.editor);
    ed.style.fontSize = "170px"; ed.style.whiteSpace = "nowrap";
    const king = P("div", "display", root, M.editorTitle);
    Object.assign(king.style, { fontSize: "140px", color: "#fff", textShadow: "0 0 40px rgba(255,200,80,.9), 0 6px 0 #6b470f" });
    const tf = faceRing(root, M.editorFace, 240);
    const crown = icon("crown", 170, root);
    const fin = P("div", "", root, `האוסקרים של ${M.group} · ${M.year}`);
    Object.assign(fin.style, { fontSize: "40px", fontWeight: 600, letterSpacing: ".12em", color: "#d9c08a", whiteSpace: "nowrap" });
    const C = 5.6;
    cue("s_whoosh", t0 + C - 0.2, 0.6);
    cue("hit", t0 + C + 0.2, 0.8);
    cue("s_boom", t0 + C + 0.8, 0.8);
    cue("s_boing", t0 + C + 1.1, 0.8);
    cue("shimmer", t0 + C + 1.15, 0.9);
    mark("end", t0 + 8);
    return {
      update(lt) {
        ENV.tint = "#120c06"; ENV.tint2 = "#020101"; ENV.glow = 0.6; ENV.bokeh = 0.6;
        const a1 = env(lt, 0, C, 0.4, 0.4);
        put(bgp, W / 2, H / 2, 1.12 - lt * 0.01, 0, a1);
        put(pol, 520, 545, lerp(1.08, 1, E.outC(seg(lt, 0, 1))), -3, a1);
        css(pim, { transform: `scale(${(1.1 - lt * 0.01).toFixed(4)})` });
        put(thanks, 1300, 300, pop(lt, 0.3), 0, clamp((lt - 0.3) * 3) * a1);
        put(pg, 1300, 480, pop(lt, 0.8), 0, clamp((lt - 0.8) * 3) * a1);
        shine(pg, lt, 2.4);
        put(stamp, 1300, 720, lt < SL ? 0 : lerp(3, 1, E.outExpo(seg(lt, SL, SL + 0.28))), -6, lt < SL ? 0 : a1);
        if (lt > SL && lt < SL + 0.5) ENV.shake = 1 - seg(lt, SL, SL + 0.5);
        const c1 = env(lt, C, DUR, 0.35, 1.2);
        put(tf, W / 2, 290, pop(lt, C + 0.05), 0, c1);
        put(by, W / 2, 500, 1, 0, c1);
        put(ed, W / 2, 630, lt < C + 0.2 ? 0 : lerp(1.6, 1, E.outExpo(seg(lt, C + 0.2, C + 0.5))), 0, lt < C + 0.2 ? 0 : c1);
        shine(ed, lt, 2.2);
        put(king, W / 2, 810, lt < C + 0.8 ? 0 : lerp(3, 1, E.outExpo(seg(lt, C + 0.8, C + 1.05))), 0, lt < C + 0.8 ? 0 : c1);
        put(crown, W / 2 + 6, lerp(-200, 160, E.outBounce(seg(lt, C + 1.1, C + 1.8))), 1, -8, lt < C + 1.1 ? 0 : c1);
        put(fin, W / 2, 980, 1, 0, env(lt, C + 1.2, DUR, 0.5, 1.2));
        ENV.fade = seg(lt, DUR - 1.1, DUR);
      },
    };
  });
}

// ---------------------------------------------------------------- build
function buildTimeline() {
  if (SHORT) {
    introShort();
    DATA.categories.forEach((cat, i) => {
      const th = THEMES[cat.id];
      transition(CURSOR, "wipe", [th.color, "#0d0905", "#f2c14e"]);
      titleScene(cat, i, th);
      countdownScene(cat, i, th);
      if (cat.kind === "text") textShortScene(cat, i, th); else podiumScene(cat, i, th);
    });
    specialShort();
    outroShort();
    return;
  }
  introScene();
  statsScene();
  const goes = ["v_goes1", "v_goes2", "v_goes3"];
  const breaks = { 3: DATA.meta.breaks[0], 7: DATA.meta.breaks[1], 11: DATA.meta.breaks[2] }; // after categories 4, 8, 12
  DATA.categories.forEach((cat, i) => {
    const th = THEMES[cat.id];
    transition(CURSOR, "wipe", [th.color, "#0d0905", "#f2c14e"]);
    titleScene(cat, i, th);
    countdownScene(cat, i, th);
    const gv = goes[i % 3];
    if (cat.kind === "text") textScene(cat, i, th, gv); else resultsScene(cat, i, th, gv);
    if (breaks[i]) interludeScene(breaks[i][0], breaks[i][1], i);
  });
  specialScene();
  outroScene();
}

(async function main() {
  injectFonts();
  await loadFonts();
  DATA = await (await fetch("private/data.json")).json();
  FACES = new Set(DATA.people);
  // photo orientation decides the polaroid shape
  await Promise.all([...new Set([...DATA.meta.blitz, ...DATA.meta.breaks.flatMap((b) => b[0])])].map((f) => new Promise((res) => {
    const i = new Image(); i.onload = () => { if (i.naturalWidth > i.naturalHeight) LANDSCAPE.add(f); res(); }; i.onerror = res; i.src = "private/photos/" + f;
  })));
  statueURL = STATUE_URL();
  buildTimeline();
  await Promise.all(PRELOAD.map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
  setupRender();
  CUES.sort((a, b) => a[1] - b[1]);
  window.__dur = CURSOR;
  window.__sfx = CUES.filter((c) => c[2] > 0.001);
  window.__marks = MARKS;
  window.__scenes = SCENES.map((s) => [s.name, +s.t0.toFixed(2), +s.t1.toFixed(2)]);
  window.__render = render;
  const q = new URLSearchParams(location.search);
  if (q.has("render")) { document.body.classList.add("render"); render(+(q.get("t") || 0)); window.__ready = true; return; }
  const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); document.getElementById("stage").style.transform = `scale(${s})`; };
  fit(); addEventListener("resize", fit);
  window.__ready = true;
  if (q.has("t")) { render(+q.get("t")); return; }
  const start = performance.now() - (+(q.get("from") || 0)) * 1000;
  const loop = () => { render(((performance.now() - start) / 1000) % CURSOR); requestAnimationFrame(loop); };
  loop();
})();
