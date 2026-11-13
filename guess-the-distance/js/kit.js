// The component kit: HTML for every control and card, so the screens and the
// component lab (redesign/lab.html) build them the same way. Interaction and
// motion come from juice.js through the data-juice attribute.

import { esc } from "./ui.js";
import { icon, toggleIcon, img3d, mapArt } from "./icons.js";
import { rngFrom } from "../core/rng.js";

const attr = (name, v) => (v == null || v === "" ? "" : ` ${name}="${esc(v)}"`);

// A thick candy button. tone: lime | sun | cloud | coral | mint | sky ...
export function candy({ text = "", html = "", tone = "lime", id, cls = "", ico = "", icoEnd = "", flip = false, attrs = "", kbd = false, label } = {}) {
  const inner = `${ico ? icon(ico) : ""}${text ? `<span>${esc(text)}</span>` : html}${icoEnd ? icon(icoEnd, flip ? "dir-flip" : "") : ""}`;
  return `<button type="button" class="candy c-${tone} ${cls}" data-juice="candy"${attr("id", id)}${attr("aria-label", label)} ${attrs}><span class="face"><span class="lbl">${inner}</span>${kbd ? '<kbd class="kbd" aria-hidden="true">↵</kbd>' : ""}</span></button>`;
}

export function ghost({ text = "", ico = "", id, cls = "", attrs = "" } = {}) {
  return `<button type="button" class="ghost ${cls}" data-juice="ghost"${attr("id", id)} ${attrs}><span class="lbl">${ico ? icon(ico) : ""}<span>${esc(text)}</span></span></button>`;
}

// A round button. hud: night glass for over the map; otherwise a white candy.
export function iconBtn({ ico, label, id, cls = "", hud = false, tone = "cloud", attrs = "" } = {}) {
  return `<button type="button" class="icon-btn ${hud ? "glassy" : `c-${tone}`} ${ico === "close" ? "close" : ""} ${cls}" data-juice="icon"${attr("id", id)}${attr("aria-label", label)}${attr("title", label)} ${attrs}><span class="face">${icon(ico)}</span></button>`;
}

// Music or sound on/off: the icon bounces and a strike line writes itself in.
export function toggleBtn({ ico, label, on, id, cls = "", hud = false } = {}) {
  return `<button type="button" class="icon-btn ${hud ? "glassy" : "c-cloud"} ${cls}" data-juice="toggle"${attr("id", id)} aria-pressed="${on}"${attr("aria-label", label)}${attr("title", label)}><span class="face">${toggleIcon(ico)}</span></button>`;
}

// A map chip: a white pill that fills with lime from the finger.
export function chip({ map, label, on = false, group = "map" } = {}) {
  return `<button type="button" class="chip ${on ? "on" : ""}" role="radio" aria-checked="${on}" data-juice="chip" data-map="${esc(map)}" data-group="${esc(group)}"><span class="chip-fill" aria-hidden="true"></span><span class="chip-ico" aria-hidden="true">${mapArt(map, 30)}</span><span class="chip-lbl">${esc(label)}</span></button>`;
}

// A mode card: a sticker with 3D art breaking out of its frame.
export function modeCard({ mode, title, sub, art, tone, best = "", tilt = 0, label } = {}) {
  return `<button type="button" class="mode-card c-${tone}" data-juice="card" data-mode="${esc(mode)}" style="--tilt:${tilt}deg"${attr("aria-label", label)}>
    <span class="face">
      ${img3d(art, { size: 92, cls: "mc-art art-hop", lazy: false })}
      <span class="mc-title">${esc(title)}</span>
      <span class="mc-sub">${esc(sub)}</span>
      ${best ? `<span class="mc-best num">${esc(best)}</span>` : ""}
    </span>
  </button>`;
}

export function tag(text, { ico = "", cls = "", id } = {}) {
  return `<span class="tag ${cls}"${attr("id", id)}>${ico ? icon(ico) : ""}<span>${esc(text)}</span></span>`;
}

// Little four-point stars for backgrounds and celebrations. Seeded, so the
// same screen always gets the same sky.
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c1 6.2 4.8 10 11 11-6.2 1-10 4.8-11 11-1-6.2-4.8-10-11-11 6.2-1 10-4.8 11-11z" fill="currentColor"/></svg>';
export function sparkles(n = 10, seed = "sky", { colors = ["#FFFFFF", "#C8FF3D", "#FFD43B"], area = [0, 0, 100, 100], size = [6, 14] } = {}) {
  const rand = rngFrom(seed);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = area[0] + rand() * (area[2] - area[0]);
    const y = area[1] + rand() * (area[3] - area[1]);
    const z = size[0] + rand() * (size[1] - size[0]);
    out += `<span class="sparkle" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--z:${z.toFixed(0)}px;--c:${colors[i % colors.length]};--d:${(3 + rand() * 4).toFixed(1)}s;--w:${(-rand() * 6).toFixed(1)}s">${STAR}</span>`;
  }
  return out;
}

// A hexagon medal for the player card.
export function medal({ art, value, label, tone = "sun" } = {}) {
  return `<div class="medal"><div class="hex c-${tone}">${img3d(art, { size: 40 })}<b class="num">${esc(value)}</b></div><span>${esc(label)}</span></div>`;
}
