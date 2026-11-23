// Icons: thick, round-capped line icons on a 24px grid (stroke 2.5, to suit
// the cartoon look), plus the Fluent 3D art (Microsoft Fluent Emoji 3D, MIT)
// for avatars, travel modes, game modes and celebrations. The 3D art lives in
// img/3d/, with its violet cast taken out (redesign/tools/neutralize-3d.py).

const P = {
  car: '<path d="M5 11.5l1.5-4A2 2 0 0 1 8.4 6h7.2a2 2 0 0 1 1.9 1.5l1.5 4"/><rect x="3" y="11.5" width="18" height="5.5" rx="2"/><path d="M6.5 17v1.5M17.5 17v1.5"/>',
  foot: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2.5-6 2.5 2.5V21"/><path d="M8 12.5l2.5-4.5 3.5 1.5 2 3.5"/><path d="M10.5 8l-1 5.5 3 1.5"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3.5 7H6M14 6h2.5"/>',
  flight: '<path d="M21 15.5v-1.8l-7.5-4.6V4.5a1.5 1.5 0 0 0-3 0v4.6L3 13.7v1.8l7.5-2.3v4.6l-2 1.5v1.4l3.5-1 3.5 1v-1.4l-2-1.5v-4.6z"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  play: '<path d="M8 5.8v12.4a1 1 0 0 0 1.5.86l9.9-6.2a1 1 0 0 0 0-1.72L9.5 4.94A1 1 0 0 0 8 5.8z" fill="currentColor" stroke-linejoin="round"/>',
  arrow: '<path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5"/>',
  back: '<path d="M19 12H5.5M11 6.5L5.5 12l5.5 5.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-3.7 3.6-6 7.5-6s6.9 2.3 7.5 6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.7-7-6.5 0-3.4 2.4-5.6 4-7.5.4 2 1.5 3.3 2.8 3.8C12 7.5 13 5 15.5 3c-.3 3 3.5 6 3.5 11.5 0 3.8-3.1 6.5-7 6.5z"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M10 2.5h4M18.5 6.5l1.5-1.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  share: '<path d="M12 3.5v11M7.5 8L12 3.5 16.5 8"/><path d="M6 11.5H5A1.5 1.5 0 0 0 3.5 13v6A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-1"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  vibrate: '<rect x="7.5" y="3.5" width="9" height="17" rx="2.5"/><path d="M4 8v8M20 8v8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  server: '<rect x="4" y="4" width="16" height="7" rx="2.5"/><rect x="4" y="13" width="16" height="7" rx="2.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/><circle cx="12" cy="3.5" r="1"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M18.5 4.5l1.5 1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-5v6h-4A1.5 1.5 0 0 1 4 19z"/>',
  again: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M17.5 3v4h-4M6.5 21v-4h4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.5 4 2.5 4h-11"/>',
  door: '<path d="M14 4h4.5v16H14M10 8l-4 4 4 4M6 12h10"/>',
  sparkle: '<path d="M12 3c.8 4.6 3.4 7.2 8 8-4.6.8-7.2 3.4-8 8-.8-4.6-3.4-7.2-8-8 4.6-.8 7.2-3.4 8-8z" fill="currentColor"/>',
};

// Icons that point "forward" are mirrored in right-to-left layouts.
const DIRECTIONAL = new Set(["arrow", "back"]);

export function icon(name, cls = "") {
  if (DIRECTIONAL.has(name)) cls += " dir-flip";
  return `<svg class="ic ${cls.trim()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}

// A music or sound icon with a strike line that draws in when it is off.
export function toggleIcon(name) {
  return `<svg class="ic tgl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}<path class="strike" d="M4 4l16 16" pathLength="1"/></svg>`;
}

// A check mark that "writes" itself (stroke-dashoffset).
export const CHECK_SVG = '<svg class="ic chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg>';

// ---------- 3D art ----------
const BASE_3D = new URL("../img/3d/", import.meta.url).href;

// The 18 avatars the game has always had, as emoji (that is what the server
// and the hub send), each with its 3D picture.
export const AVATAR_3D = {
  "🦊": "fox", "🐻": "bear", "🐼": "panda", "🐨": "koala", "🐯": "tiger", "🦁": "lion",
  "🐸": "frog", "🐵": "monkey", "🦉": "owl", "🐙": "octopus", "🦄": "unicorn", "🐳": "whale",
  "🐝": "bee", "🦖": "trex", "👽": "alien", "🤖": "robot", "😎": "sunglasses", "🧭": "compass",
};

export const MODE_3D = { car: "car", foot: "walk", bike: "bike", flight: "plane" };
// One color per way of travel: the route on the map, the trip badge.
export const MODE_TONE = { car: "lime", foot: "mint", bike: "sun", flight: "sky" };
export const MODE_HEX = { car: "#C8FF3D", foot: "#3BE3A0", bike: "#FFD43B", flight: "#6FC8FF" };
export const MAP_3D = { israel: null, world: "globe", walks: "walk", flights: "plane", random: "die" };

export function src3d(name) {
  return `${BASE_3D}${name}.png`;
}

export function img3d(name, { size = 64, cls = "", alt = "", lazy = true, style = "" } = {}) {
  return `<img class="i3d ${cls}" src="${src3d(name)}" width="${size}" height="${size}" alt="${alt}" ${style ? `style="${style}"` : ""} ${lazy ? 'loading="lazy"' : ""} decoding="async" draggable="false">`;
}

const escText = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The picture for an avatar emoji. An emoji without a picture stays text.
export function avatarArt(emoji, opts = {}) {
  const name = AVATAR_3D[emoji];
  return name ? img3d(name, opts) : `<span class="emo" aria-hidden="true">${escText(emoji)}</span>`;
}

// An avatar "coin": the 3D character on a round chip with a white ring.
// size null: the size comes from CSS (--s).
export function coin(emoji, { size = 48, cls = "", lazy = false } = {}) {
  return `<span class="coin ${cls}" ${size ? `style="--s:${size}px"` : ""} aria-hidden="true">${avatarArt(emoji, { size: Math.round((size || 160) * 0.78), lazy })}</span>`;
}

// The art for a map: the flag of Israel is an emoji (there is no 3D flag).
export function mapArt(id, size = 28) {
  const name = MAP_3D[id];
  return name ? img3d(name, { size, cls: "map-i3d", lazy: false }) : `<span class="flag" aria-hidden="true">🇮🇱</span>`;
}
