/**
 * The plastic UI kit, drawn with vector graphics so it is crisp at any size and
 * matches the painted mocks: molded panels with a bevel and riveted corners,
 * chamfered gold buttons with a dark lip, metal bars, pills, progress bars.
 */
import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from "pixi.js";
import gsap from "gsap";
import { C, FONT_DISPLAY, FONT_BODY } from "./theme";

/** Pointer travel (screen px) beyond which a press is a drag, not a tap. */
export const DRAG_PX = 14;

export const shade = (hex: number, k: number) => {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return (f(r) << 16) | (f(g) << 8) | f(b);
};

/** A molded plastic panel: body, top bevel, bottom shadow band, inner frame, rivets. */
export function panel(w: number, h: number, opts: { color?: number; radius?: number; rivets?: boolean; glow?: number } = {}) {
  const color = opts.color ?? C.wall, r = opts.radius ?? 28;
  const g = new Graphics();
  g.roundRect(0, 6, w, h, r).fill({ color: shade(color, -0.55) });            // drop lip
  g.roundRect(0, 0, w, h, r).fill({ color });
  g.roundRect(0, 0, w, h, r).fill({ color: 0xffffff, alpha: 0.0 });
  g.roundRect(3, 3, w - 6, h * 0.42, r - 3).fill({ color: 0xffffff, alpha: 0.08 }); // top sheen
  g.roundRect(0, h * 0.72, w, h * 0.28, r).fill({ color: 0x000000, alpha: 0.14 });   // bottom band
  g.roundRect(1.5, 1.5, w - 3, h - 3, r - 1.5).stroke({ color: 0xffffff, alpha: 0.18, width: 2 });
  g.roundRect(10, 10, w - 20, h - 20, r - 10).stroke({ color: 0xffffff, alpha: 0.06, width: 1.5 });
  if (opts.rivets ?? true) for (const [x, y] of [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]] as const) {
    g.circle(x, y, 5).fill({ color: shade(color, -0.4) }); g.circle(x - 1, y - 1, 3.2).fill({ color: shade(color, 0.35) });
  }
  if (opts.glow) g.roundRect(-4, -4, w + 8, h + 8, r + 4).stroke({ color: opts.glow, alpha: 0.5, width: 3 });
  return g;
}

/** Brushed-metal bar (top bar, tab bar). */
export function metalBar(w: number, h: number, radius = 0) {
  const g = new Graphics();
  g.roundRect(0, 0, w, h, radius).fill({ color: C.metalDark });
  for (let i = 0; i < h; i += 3) g.rect(0, i, w, 1.5).fill({ color: 0xffffff, alpha: 0.03 + 0.03 * Math.sin(i * 0.35) });
  g.rect(0, 0, w, 3).fill({ color: 0xffffff, alpha: 0.22 });
  g.rect(0, h - 4, w, 4).fill({ color: 0x000000, alpha: 0.4 });
  return g;
}

/** Chamfered plastic button face (gold primary, violet secondary, plum ghost). */
function buttonFace(w: number, h: number, kind: "primary" | "secondary" | "ghost" | "mint", pressed = false) {
  const base = kind === "primary" ? C.gold : kind === "secondary" ? C.violet : kind === "mint" ? C.mint : C.wallLight;
  const top = kind === "primary" ? C.goldLight : shade(base, 0.35), bottom = kind === "primary" ? C.orange : shade(base, -0.2);
  const lip = shade(bottom, -0.45), cut = Math.min(18, h * 0.28), lipH = pressed ? 2 : 7;
  const g = new Graphics();
  const shape = (y: number, hh: number) => {
    g.moveTo(cut, y); g.lineTo(w, y); g.lineTo(w, y + hh - cut); g.lineTo(w - cut, y + hh); g.lineTo(0, y + hh); g.lineTo(0, y + cut); g.closePath();
  };
  shape(lipH, h); g.fill({ color: lip });
  shape(0, h); g.fill({ color: bottom });
  shape(0, h * 0.55); g.fill({ color: top, alpha: 0.9 });
  g.rect(cut, 2, w - cut - 4, 3).fill({ color: 0xffffff, alpha: 0.45 });
  shape(0, h); g.stroke({ color: 0x000000, alpha: 0.18, width: 2 });
  return g;
}

export interface ButtonOpts { w: number; h: number; label?: string; sub?: string; kind?: "primary" | "secondary" | "ghost" | "mint"; size?: number; icon?: Container; onTap?: () => void; }
/** A pressable button with squash, lip collapse and a callback. */
export function button(o: ButtonOpts) {
  const kind = o.kind ?? "primary", c = new Container();
  const face = buttonFace(o.w, o.h, kind); c.addChild(face);
  const ink = kind === "primary" || kind === "mint" ? 0x2a1200 : C.cream;
  const content = new Container(); c.addChild(content);
  let cx = o.w / 2;
  if (o.icon) { o.icon.x = 0; content.addChild(o.icon); }
  if (o.label) {
    const t = new Text({ text: o.label, style: display(o.size ?? Math.round(o.h * 0.42), ink, true) });
    t.anchor.set(0.5); t.x = 0; t.y = o.sub !== undefined ? -o.h * 0.1 : 0; content.addChild(t);
    if (o.sub !== undefined) { const s = new Text({ text: o.sub, style: body(Math.round(o.h * 0.2), ink, 800) }); s.anchor.set(0.5); s.y = o.h * 0.22; s.alpha = 0.75; content.addChild(s); }
  }
  content.x = cx; content.y = o.h / 2 - 3;
  c.eventMode = "static"; c.cursor = "pointer";
  let dx0 = 0, dy0 = 0;
  const down = (e: FederatedPointerEvent) => { dx0 = e.global.x; dy0 = e.global.y; gsap.to(c.scale, { x: 0.96, y: 0.94, duration: 0.08 }); c.removeChild(face); c.addChildAt(buttonFace(o.w, o.h, kind, true), 0); };
  const up = (fire: boolean, e?: FederatedPointerEvent) => { gsap.to(c.scale, { x: 1, y: 1, duration: 0.22, ease: "back.out(2)" }); c.removeChildAt(0); c.addChildAt(buttonFace(o.w, o.h, kind), 0); if (fire && !(e && Math.hypot(e.global.x - dx0, e.global.y - dy0) > DRAG_PX)) o.onTap?.(); };
  c.on("pointerdown", down); c.on("pointerup", (e) => up(true, e)); c.on("pointerupoutside", () => up(false)); c.on("pointercancel", () => up(false));
  c.pivot.set(o.w / 2, o.h / 2); c.position.set(o.w / 2, o.h / 2);
  return c;
}

/** A round plastic key (HUD buttons). */
export function roundKey(d: number, kind: "mint" | "ghost" | "primary", icon?: Container, onTap?: () => void) {
  const c = new Container();
  const base = kind === "mint" ? C.mint : kind === "primary" ? C.gold : C.wallLight;
  const g = new Graphics();
  g.circle(d / 2, d / 2 + 6, d / 2).fill({ color: shade(base, -0.5) });
  g.circle(d / 2, d / 2, d / 2).fill({ color: shade(base, -0.1) });
  g.circle(d / 2, d / 2 - d * 0.08, d * 0.42).fill({ color: shade(base, 0.25), alpha: 0.9 });
  g.ellipse(d / 2, d * 0.28, d * 0.3, d * 0.1).fill({ color: 0xffffff, alpha: 0.35 });
  g.circle(d / 2, d / 2, d / 2).stroke({ color: 0x000000, alpha: 0.2, width: 2 });
  c.addChild(g);
  if (icon) { icon.position.set(d / 2, d / 2 - 2); c.addChild(icon); }
  c.eventMode = "static"; c.cursor = "pointer";
  let dx0 = 0, dy0 = 0;
  c.on("pointerdown", (e) => { dx0 = e.global.x; dy0 = e.global.y; gsap.to(c.scale, { x: 0.92, y: 0.92, duration: 0.08 }); });
  const up = (fire: boolean, e?: FederatedPointerEvent) => { gsap.to(c.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(2.2)" }); if (fire && !(e && Math.hypot(e.global.x - dx0, e.global.y - dy0) > DRAG_PX)) onTap?.(); };
  c.on("pointerup", (e) => up(true, e)); c.on("pointerupoutside", () => up(false)); c.on("pointercancel", () => up(false));
  c.pivot.set(d / 2, d / 2); c.position.set(d / 2, d / 2);
  return c;
}

/** Pill counter: dark plastic pill with an icon slot on the left and a number. */
export function pill(w: number, h: number, value: string, icon?: Container, onTap?: () => void) {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(0, 4, w, h, h / 2).fill({ color: 0x000000, alpha: 0.45 });
  g.roundRect(0, 0, w, h, h / 2).fill({ color: C.plate });
  g.roundRect(2, 2, w - 4, h * 0.5, h / 2).fill({ color: 0xffffff, alpha: 0.07 });
  g.roundRect(1, 1, w - 2, h - 2, h / 2).stroke({ color: 0xffffff, alpha: 0.16, width: 2 });
  c.addChild(g);
  if (icon) { icon.position.set(h * 0.55, h / 2); c.addChild(icon); }
  const t = new Text({ text: value, style: display(Math.round(h * 0.5), C.cream, true) });
  t.anchor.set(0, 0.5); t.position.set(icon ? h * 1.05 : h * 0.4, h / 2 - 1); c.addChild(t);
  (c as any).setValue = (v: string) => { t.text = v; };
  if (onTap) tapOnce(c, onTap);
  return c;
}

/** Inset progress bar with a mint→violet fill and a moving highlight. */
export function progressBar(w: number, h: number, frac: number, from = C.mint, to = C.violet) {
  const c = new Container();
  const track = new Graphics();
  track.roundRect(0, 0, w, h, h / 2).fill({ color: 0x000000, alpha: 0.5 });
  track.roundRect(0, 0, w, h, h / 2).stroke({ color: 0xffffff, alpha: 0.12, width: 1.5 });
  c.addChild(track);
  const fill = new Graphics(); c.addChild(fill);
  const set = (f: number) => {
    fill.clear(); const fw = Math.max(h, w * Math.max(0, Math.min(1, f)));
    if (f <= 0) return;
    fill.roundRect(2, 2, fw - 4, h - 4, (h - 4) / 2).fill({ color: from });
    fill.roundRect(2 + (fw - 4) * 0.5, 2, (fw - 4) * 0.5, h - 4, (h - 4) / 2).fill({ color: to, alpha: 0.7 });
    fill.roundRect(4, 3, fw - 8, (h - 4) * 0.4, (h - 4) / 4).fill({ color: 0xffffff, alpha: 0.35 });
  };
  set(frac); (c as any).set = set;
  return c;
}

/** Ribbon label (FEATURED, BEST VALUE, rarity). */
export function ribbon(text: string, color: number, w = 240, h = 48) {
  const c = new Container();
  const g = new Graphics();
  g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w - 14, h / 2); g.lineTo(w, h); g.lineTo(0, h); g.lineTo(14, h / 2); g.closePath(); g.fill({ color });
  g.rect(16, 3, w - 32, 3).fill({ color: 0xffffff, alpha: 0.4 });
  c.addChild(g);
  const t = new Text({ text, style: display(Math.round(h * 0.5), C.cream, true) }); t.anchor.set(0.5); t.position.set(w / 2, h / 2 - 1); c.addChild(t);
  return c;
}

export function display(size: number, color: number = C.cream, upper = false, shadow = true) {
  return new TextStyle({ fontFamily: FONT_DISPLAY, fontSize: size, fontWeight: "700", fill: color, letterSpacing: upper ? size * 0.05 : 0,
    dropShadow: shadow ? { color: 0x130e1b, alpha: 0.85, blur: 0, distance: Math.max(2, size * 0.06), angle: Math.PI / 2 } : false });
}
export function body(size: number, color: number = C.lilac, weight: 700 | 800 = 700) {
  return new TextStyle({ fontFamily: FONT_BODY, fontSize: size, fontWeight: String(weight) as "700" | "800", fill: color });
}
export function label(text: string, size: number, color: number = C.cream, upper = true) {
  const t = new Text({ text: upper ? text.toUpperCase() : text, style: display(size, color, upper) }); t.anchor.set(0.5); return t;
}

/** Simple vector icons until the painted sheet is sliced in. */
export function icon(name: string, size = 40, color = C.cream) {
  const g = new Graphics(); const s = size / 2;
  switch (name) {
    case "play": g.poly([-s * 0.55, -s * 0.7, s * 0.75, 0, -s * 0.55, s * 0.7]).fill({ color }); break;
    case "back": g.poly([s * 0.35, -s * 0.75, -s * 0.5, 0, s * 0.35, s * 0.75, s * 0.55, s * 0.55, 0, 0, s * 0.55, -s * 0.55]).fill({ color }); break;
    case "gear": { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, c0 = Math.cos(a), s0 = Math.sin(a); const pts: number[] = []; for (const [px, py] of [[-s * 0.16, -s], [s * 0.16, -s], [s * 0.16, -s * 0.55], [-s * 0.16, -s * 0.55]] as [number, number][]) pts.push(px * c0 - py * s0, px * s0 + py * c0); g.poly(pts).fill({ color }); } g.circle(0, 0, s * 0.68).fill({ color }); g.circle(0, 0, s * 0.28).fill({ color: C.wall }); break; }
    case "star": { const pts: number[] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.42 : s; const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; pts.push(Math.cos(a) * r, Math.sin(a) * r); } g.poly(pts).fill({ color }); break; }
    case "coin": g.circle(0, 0, s).fill({ color: C.goldDark }); g.circle(0, -1, s * 0.86).fill({ color: C.gold }); g.circle(-s * 0.25, -s * 0.3, s * 0.3).fill({ color: 0xffffff, alpha: 0.4 }); break;
    case "gem": g.poly([0, -s, s * 0.9, -s * 0.3, s * 0.55, s, -s * 0.55, s, -s * 0.9, -s * 0.3]).fill({ color: C.violet }); g.poly([0, -s, s * 0.9, -s * 0.3, 0, -s * 0.2, -s * 0.9, -s * 0.3]).fill({ color: 0xffffff, alpha: 0.35 }); break;
    case "undo": g.arc(0, 0, s * 0.7, Math.PI * 0.2, Math.PI * 1.7).stroke({ color, width: s * 0.3, cap: "round" }); g.poly([-s * 0.95, -s * 0.2, -s * 0.2, -s * 0.2, -s * 0.6, -s * 0.9]).fill({ color }); break;
    case "restart": g.arc(0, 0, s * 0.7, -Math.PI * 0.7, Math.PI * 1.2).stroke({ color, width: s * 0.3, cap: "round" }); g.poly([s * 0.2, -s * 0.95, s * 0.95, -s * 0.2, s * 0.1, -s * 0.2]).fill({ color }); break;
    case "skip": g.poly([-s * 0.8, -s * 0.7, s * 0.3, 0, -s * 0.8, s * 0.7]).fill({ color }); g.rect(s * 0.45, -s * 0.7, s * 0.28, s * 1.4).fill({ color }); break;
    case "bulb": g.circle(0, -s * 0.2, s * 0.6).fill({ color }); g.rect(-s * 0.3, s * 0.35, s * 0.6, s * 0.25).fill({ color }); g.rect(-s * 0.22, s * 0.68, s * 0.44, s * 0.18).fill({ color }); break;
    case "lock": g.roundRect(-s * 0.6, -s * 0.1, s * 1.2, s * 1.0, s * 0.2).fill({ color }); g.arc(0, -s * 0.2, s * 0.42, Math.PI, 0).stroke({ color, width: s * 0.22 }); break;
    case "flame": g.poly([0, -s, s * 0.6, -s * 0.1, s * 0.5, s * 0.6, 0, s, -s * 0.5, s * 0.6, -s * 0.6, -s * 0.1]).fill({ color: C.orange }); g.circle(0, s * 0.3, s * 0.35).fill({ color: C.goldLight }); break;
    case "cal": g.roundRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.4, s * 0.15).fill({ color }); g.rect(-s * 0.8, -s * 0.6, s * 1.6, s * 0.4).fill({ color: C.coral }); g.rect(-s * 0.55, -s * 0.95, s * 0.2, s * 0.5).fill({ color }); g.rect(s * 0.35, -s * 0.95, s * 0.2, s * 0.5).fill({ color }); break;
    case "bag": g.roundRect(-s * 0.7, -s * 0.3, s * 1.4, s * 1.2, s * 0.15).fill({ color }); g.arc(0, -s * 0.3, s * 0.4, Math.PI, 0).stroke({ color, width: s * 0.2 }); break;
    case "home": g.poly([0, -s, s, 0, s * 0.7, 0, s * 0.7, s * 0.9, -s * 0.7, s * 0.9, -s * 0.7, 0, -s, 0]).fill({ color }); break;
    case "levels": g.circle(-s * 0.5, s * 0.5, s * 0.3).fill({ color }); g.circle(0, -s * 0.1, s * 0.3).fill({ color }); g.circle(s * 0.55, -s * 0.7, s * 0.3).fill({ color }); g.moveTo(-s * 0.5, s * 0.5); g.lineTo(0, -s * 0.1); g.lineTo(s * 0.55, -s * 0.7); g.stroke({ color, width: s * 0.16 }); break;
    case "user": g.circle(0, -s * 0.35, s * 0.42).fill({ color }); g.roundRect(-s * 0.8, s * 0.2, s * 1.6, s * 0.8, s * 0.4).fill({ color }); break;
    case "chest": g.roundRect(-s * 0.9, -s * 0.2, s * 1.8, s * 1.1, s * 0.15).fill({ color: C.goldDark }); g.roundRect(-s * 0.9, -s * 0.75, s * 1.8, s * 0.7, s * 0.3).fill({ color: C.gold }); g.rect(-s * 0.15, -s * 0.25, s * 0.3, s * 0.5).fill({ color: C.goldLight }); break;
    case "check": g.moveTo(-s * 0.7, 0); g.lineTo(-s * 0.15, s * 0.55); g.lineTo(s * 0.75, -s * 0.6); g.stroke({ color, width: s * 0.3, cap: "round", join: "round" }); break;
    case "cross": g.moveTo(-s * 0.6, -s * 0.6); g.lineTo(s * 0.6, s * 0.6); g.moveTo(s * 0.6, -s * 0.6); g.lineTo(-s * 0.6, s * 0.6); g.stroke({ color, width: s * 0.3, cap: "round" }); break;
    default: g.circle(0, 0, s * 0.6).fill({ color });
  }
  return g;
}

/** Full-screen scrim that swallows taps. */
export function scrim(w: number, h: number, alpha = 0.7, onTap?: () => void) {
  const g = new Graphics(); g.rect(0, 0, w, h).fill({ color: C.ink, alpha }); g.eventMode = "static"; if (onTap) g.on("pointertap", onTap); return g;
}

/** A tap that is not the start of a scroll: fires on pointerup only if the pointer barely moved. */
export const tapOnce = (c: Container, fn: (e: FederatedPointerEvent) => void) => {
  c.eventMode = "static"; c.cursor = "pointer"; let x0 = 0, y0 = 0;
  c.on("pointerdown", (e) => { x0 = e.global.x; y0 = e.global.y; });
  c.on("pointerup", (e) => { if (Math.hypot(e.global.x - x0, e.global.y - y0) <= DRAG_PX) fn(e); });
};
