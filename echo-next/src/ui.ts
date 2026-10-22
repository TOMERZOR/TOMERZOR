/**
 * The Sanctuary UI kit: dark glass panels with hairline borders, outlined
 * cyan buttons, thin capitals. Everything is vector so it stays crisp.
 */
import { Container, Graphics, Text, TextStyle, FederatedPointerEvent, CanvasTextMetrics, Circle } from "pixi.js";
import gsap from "gsap";
import { C, FONT_DISPLAY, FONT_BODY, FONT_LOGO } from "./theme";

/** Pointer travel (screen px) beyond which a press is a drag, not a tap. */
export const DRAG_PX = 14;

export const shade = (hex: number, k: number) => {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return (f(r) << 16) | (f(g) << 8) | f(b);
};

/** A glass panel: translucent dark fill, hairline border, a lit top edge; `glow` adds a cyan frame and corner ticks. */
export function panel(w: number, h: number, opts: { color?: number; radius?: number; rivets?: boolean; glow?: number } = {}) {
  const color = opts.color ?? C.glass, r = opts.radius ?? 18;
  const g = new Graphics();
  g.roundRect(0, 0, w, h, r).fill({ color, alpha: 0.78 });
  g.roundRect(0, 0, w, h * 0.5, r).fill({ color: 0xffffff, alpha: 0.025 });
  g.roundRect(1, 1, w - 2, h - 2, r - 1).stroke({ color: 0xffffff, alpha: 0.14, width: 1.5 });
  g.rect(r, 1, w - r * 2, 1).fill({ color: 0xffffff, alpha: 0.2 });
  if (opts.glow) {
    g.roundRect(0.5, 0.5, w - 1, h - 1, r).stroke({ color: opts.glow, alpha: 0.55, width: 2 });
    g.roundRect(-4, -4, w + 8, h + 8, r + 4).stroke({ color: opts.glow, alpha: 0.12, width: 6 });
    const t = 22;
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]] as const) { g.moveTo(x, y + sy * t).lineTo(x, y).lineTo(x + sx * t, y).stroke({ color: opts.glow, alpha: 0.9, width: 3 }); }
  }
  return g;
}

/** A dark glass strip (top and bottom bars) with a cyan hairline on its inner edge. */
export function metalBar(w: number, h: number, radius = 0) {
  const g = new Graphics();
  g.roundRect(0, 0, w, h, radius).fill({ color: C.ink, alpha: 0.82 });
  g.rect(0, h - 2, w, 2).fill({ color: C.line, alpha: 0.35 });
  g.rect(0, 0, w, 1).fill({ color: 0xffffff, alpha: 0.1 });
  return g;
}

type Kind = "primary" | "secondary" | "ghost" | "mint";
/** Button face: outlined cyan glass (primary), filled cyan (mint), blue outline (secondary), faint white outline (ghost). */
function buttonFace(w: number, h: number, kind: Kind, pressed = false) {
  const g = new Graphics(); const r = Math.min(16, h * 0.22);
  const line = kind === "primary" ? C.mint : kind === "secondary" ? C.violet : kind === "ghost" ? 0xffffff : C.mint;
  if (kind === "mint") {
    g.roundRect(0, 0, w, h, r).fill({ color: pressed ? shade(C.mint, -0.2) : C.mint });
    g.roundRect(0, 0, w, h * 0.5, r).fill({ color: 0xffffff, alpha: 0.18 });
    g.roundRect(-3, -3, w + 6, h + 6, r + 3).stroke({ color: C.mint, alpha: 0.25, width: 6 });
    return g;
  }
  g.roundRect(0, 0, w, h, r).fill({ color: line, alpha: kind === "ghost" ? (pressed ? 0.14 : 0.06) : pressed ? 0.28 : 0.1 });
  g.roundRect(0, 0, w, h * 0.5, r).fill({ color: 0xffffff, alpha: 0.03 });
  g.roundRect(1, 1, w - 2, h - 2, r).stroke({ color: line, alpha: kind === "ghost" ? 0.3 : 0.95, width: kind === "ghost" ? 1.5 : 2.5 });
  if (kind !== "ghost") g.roundRect(-4, -4, w + 8, h + 8, r + 4).stroke({ color: line, alpha: pressed ? 0.3 : 0.14, width: 7 });
  return g;
}

export interface ButtonOpts { w: number; h: number; label?: string; sub?: string; kind?: Kind; size?: number; icon?: Container; onTap?: () => void; }
/** A pressable button with a short squash and a callback. */
export function button(o: ButtonOpts) {
  const kind = o.kind ?? "primary", c = new Container();
  const face = buttonFace(o.w, o.h, kind); c.addChild(face);
  const ink = kind === "mint" ? 0x0b1a22 : kind === "primary" ? C.mint : kind === "secondary" ? 0xd7e8ff : C.cream;
  const content = new Container(); c.addChild(content);
  if (o.icon) { o.icon.x = 0; content.addChild(o.icon); }
  if (o.label) {
    const t = new Text({ text: o.label.toUpperCase(), style: display(o.size ?? Math.round(o.h * 0.36), ink, true, false) });
    if (t.width > o.w - 28) t.style.fontSize = Math.max(14, Math.floor(t.style.fontSize * ((o.w - 28) / t.width)));   // a long label shrinks instead of spilling out
    t.anchor.set(0.5); t.x = 0; t.y = o.sub !== undefined ? -o.h * 0.12 : 0; content.addChild(t);
    if (o.sub !== undefined) { const s = new Text({ text: o.sub, style: body(Math.round(o.h * 0.19), ink, 500) }); s.anchor.set(0.5); s.y = o.h * 0.2; s.alpha = 0.8; content.addChild(s); }
  }
  content.x = o.w / 2; content.y = o.h / 2;
  c.eventMode = "static"; c.cursor = "pointer";
  let dx0 = 0, dy0 = 0;
  const down = (e: FederatedPointerEvent) => { dx0 = e.global.x; dy0 = e.global.y; buzzSoft(kind === "primary" || kind === "mint" ? "medium" : "light"); gsap.to(c.scale, { x: 0.97, y: 0.96, duration: 0.08 }); c.removeChild(face); c.addChildAt(buttonFace(o.w, o.h, kind, true), 0); };
  const up = (fire: boolean, e?: FederatedPointerEvent) => { gsap.to(c.scale, { x: 1, y: 1, duration: 0.22, ease: "back.out(2)" }); c.removeChildAt(0); c.addChildAt(buttonFace(o.w, o.h, kind), 0); if (fire && !(e && Math.hypot(e.global.x - dx0, e.global.y - dy0) > DRAG_PX)) o.onTap?.(); };
  c.on("pointerdown", down); c.on("pointerup", (e) => up(true, e)); c.on("pointerupoutside", () => up(false)); c.on("pointercancel", () => up(false));
  c.pivot.set(o.w / 2, o.h / 2); c.position.set(o.w / 2, o.h / 2);
  return c;
}
let buzzSoft: (k: "light" | "medium") => void = () => {};
/** Lets the haptics module plug in without a circular import. */
export const setButtonBuzz = (fn: (k: "light" | "medium") => void) => { buzzSoft = fn; };

/** A round glass key (HUD buttons). */
export function roundKey(d: number, kind: "mint" | "ghost" | "primary", icon?: Container, onTap?: () => void) {
  const c = new Container();
  const line = kind === "mint" ? C.mint : kind === "primary" ? C.gold : 0xffffff;
  const g = new Graphics();
  g.circle(d / 2, d / 2, d / 2).fill({ color: C.glass, alpha: 0.7 });
  g.circle(d / 2, d / 2, d / 2 - 1.5).stroke({ color: line, alpha: kind === "ghost" ? 0.3 : 0.9, width: kind === "ghost" ? 1.5 : 2.5 });
  if (kind !== "ghost") g.circle(d / 2, d / 2, d / 2 + 4).stroke({ color: line, alpha: 0.14, width: 7 });
  g.circle(d / 2, d * 0.38, d * 0.3).fill({ color: 0xffffff, alpha: 0.04 });
  c.addChild(g);
  if (icon) { icon.position.set(d / 2, d / 2); c.addChild(icon); }
  c.eventMode = "static"; c.cursor = "pointer"; c.hitArea = new Circle(d / 2, d / 2, Math.max(d / 2, 62));   // at least a fingertip, whatever the key's size
  let dx0 = 0, dy0 = 0;
  c.on("pointerdown", (e) => { dx0 = e.global.x; dy0 = e.global.y; buzzSoft("light"); gsap.to(c.scale, { x: 0.92, y: 0.92, duration: 0.08 }); });
  const up = (fire: boolean, e?: FederatedPointerEvent) => { gsap.to(c.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(2.2)" }); if (fire && !(e && Math.hypot(e.global.x - dx0, e.global.y - dy0) > DRAG_PX)) onTap?.(); };
  c.on("pointerup", (e) => up(true, e)); c.on("pointerupoutside", () => up(false)); c.on("pointercancel", () => up(false));
  c.pivot.set(d / 2, d / 2); c.position.set(d / 2, d / 2);
  return c;
}

/** Pill counter: a glass capsule with an icon slot on the left and a number. */
export function pill(w: number, h: number, value: string, icon?: Container, onTap?: () => void) {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(0, 0, w, h, h / 2).fill({ color: C.glass, alpha: 0.7 });
  g.roundRect(1, 1, w - 2, h - 2, h / 2).stroke({ color: 0xffffff, alpha: 0.18, width: 1.5 });
  c.addChild(g);
  if (icon) { icon.position.set(h * 0.55, h / 2); c.addChild(icon); }
  const t = new Text({ text: value, style: display(Math.round(h * 0.5), C.cream, false, false) });
  t.anchor.set(0, 0.5); t.position.set(icon ? h * 1.05 : h * 0.4, h / 2); c.addChild(t);
  (c as any).setValue = (v: string) => { t.text = v; };
  if (onTap) tapOnce(c, onTap);
  return c;
}

/** A thin progress line with a cyan fill and glow. */
export function progressBar(w: number, h: number, frac: number, from = C.mint, to = C.violet) {
  const c = new Container();
  const track = new Graphics();
  track.roundRect(0, 0, w, h, h / 2).fill({ color: 0xffffff, alpha: 0.1 });
  c.addChild(track);
  const fill = new Graphics(); c.addChild(fill);
  const set = (f: number) => {
    fill.clear(); const fw = Math.max(h, w * Math.max(0, Math.min(1, f)));
    if (f <= 0) return;
    fill.roundRect(0, 0, fw, h, h / 2).fill({ color: from });
    fill.roundRect(fw * 0.5, 0, fw * 0.5, h, h / 2).fill({ color: to, alpha: 0.5 });
    fill.roundRect(-2, -2, fw + 4, h + 4, h / 2 + 2).stroke({ color: from, alpha: 0.25, width: 4 });
  };
  set(frac); (c as any).set = set;
  return c;
}

/** A thin tag: outlined capsule with small capitals (rarity, FEATURED, state). */
export function ribbon(text: string, color: number, w = 240, h = 48) {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(0, 0, w, h, 8).fill({ color, alpha: 0.16 }); g.roundRect(0.5, 0.5, w - 1, h - 1, 8).stroke({ color, alpha: 0.9, width: 1.5 });
  c.addChild(g);
  const t = new Text({ text: text.toUpperCase(), style: display(Math.round(h * 0.46), 0xffffff, true, false) }); t.anchor.set(0.5); t.position.set(w / 2, h / 2); c.addChild(t);
  return c;
}

/** Spaced capitals are only safe where the canvas spaces letters itself; elsewhere right-to-left text would come out reversed. */
export const spacing = (px: number) => (CanvasTextMetrics.experimentalLetterSpacingSupported ? px : 0);
export function display(size: number, color: number = C.cream, upper = false, shadow = true) {
  return new TextStyle({ fontFamily: FONT_DISPLAY, fontSize: size, fontWeight: "600", fill: color, letterSpacing: spacing(upper ? size * 0.1 : size * 0.02),
    dropShadow: shadow ? { color: 0x000000, alpha: 0.5, blur: 4, distance: 2, angle: Math.PI / 2 } : false });
}
export function logoStyle(size: number, color: number = C.cream) {
  return new TextStyle({ fontFamily: FONT_LOGO, fontSize: size, fontWeight: "400", fill: color, letterSpacing: spacing(size * 0.22) });
}
export function body(size: number, color: number = C.lilac, weight: 400 | 500 | 600 | 700 | 800 = 500) {
  return new TextStyle({ fontFamily: FONT_BODY, fontSize: size, fontWeight: String(Math.min(700, weight)) as "400" | "500" | "600" | "700", fill: color });
}
export function label(text: string, size: number, color: number = C.cream, upper = true) {
  const t = new Text({ text: upper ? text.toUpperCase() : text, style: display(size, color, upper) }); t.anchor.set(0.5); return t;
}

/** Thin line icons, drawn with strokes so they match the HUD. */
export function icon(name: string, size = 40, color: number = C.cream) {
  const g = new Graphics(); const s = size / 2, w = Math.max(2, size * 0.085);
  const st = { color, width: w, cap: "round" as const, join: "round" as const };
  switch (name) {
    case "play": g.poly([-s * 0.5, -s * 0.75, s * 0.8, 0, -s * 0.5, s * 0.75]).fill({ color }); break;
    case "back": g.moveTo(s * 0.4, -s * 0.7).lineTo(-s * 0.4, 0).lineTo(s * 0.4, s * 0.7).stroke(st); break;
    case "gear": { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55).lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95); } g.stroke(st); g.circle(0, 0, s * 0.5).stroke(st); g.circle(0, 0, s * 0.18).stroke(st); break; }
    case "star": case "star_off": { const pts: number[] = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; pts.push(Math.cos(a) * r, Math.sin(a) * r); } if (name === "star") g.poly(pts).fill({ color: C.gold }); else g.poly(pts).stroke({ color, width: w, alpha: 0.35, join: "round" }); break; }
    case "coin": g.circle(0, 0, s * 0.9).stroke({ color: C.gold, width: w }); g.poly([0, -s * 0.5, s * 0.45, -s * 0.25, s * 0.45, s * 0.25, 0, s * 0.5, -s * 0.45, s * 0.25, -s * 0.45, -s * 0.25]).fill({ color: C.gold }); break;
    case "gem": g.poly([0, -s, s * 0.9, -s * 0.3, s * 0.55, s, -s * 0.55, s, -s * 0.9, -s * 0.3]).stroke({ color: C.mint, width: w, join: "round" }); g.moveTo(-s * 0.9, -s * 0.3).lineTo(s * 0.9, -s * 0.3).moveTo(-s * 0.3, -s * 0.3).lineTo(0, s).moveTo(s * 0.3, -s * 0.3).lineTo(0, s).stroke({ color: C.mint, width: w * 0.7, alpha: 0.7 }); break;
    case "undo": g.arc(0, 0, s * 0.7, Math.PI * 0.15, Math.PI * 1.6).stroke(st); g.moveTo(-s * 0.95, -s * 0.15).lineTo(-s * 0.42, -s * 0.35).lineTo(-s * 0.62, -s * 0.85).stroke(st); break;
    case "restart": g.arc(0, 0, s * 0.7, -Math.PI * 0.6, Math.PI * 1.15).stroke(st); g.moveTo(s * 0.05, -s * 0.95).lineTo(s * 0.5, -s * 0.58).lineTo(s * 0.0, -s * 0.2).stroke(st); break;
    case "skip": g.poly([-s * 0.8, -s * 0.7, s * 0.3, 0, -s * 0.8, s * 0.7]).fill({ color }); g.rect(s * 0.5, -s * 0.7, w, s * 1.4).fill({ color }); break;
    case "bulb": g.arc(0, -s * 0.15, s * 0.6, Math.PI * 0.8, Math.PI * 2.2).stroke(st); g.moveTo(-s * 0.3, s * 0.45).lineTo(s * 0.3, s * 0.45).moveTo(-s * 0.22, s * 0.75).lineTo(s * 0.22, s * 0.75).stroke(st); break;
    case "lock": g.roundRect(-s * 0.65, -s * 0.1, s * 1.3, s * 1.0, s * 0.18).stroke(st); g.arc(0, -s * 0.2, s * 0.42, Math.PI, 0).stroke(st); g.circle(0, s * 0.4, s * 0.12).fill({ color }); break;
    case "flame": g.moveTo(0, -s).quadraticCurveTo(s * 0.9, 0, s * 0.45, s * 0.6).quadraticCurveTo(0, s * 1.1, -s * 0.45, s * 0.6).quadraticCurveTo(-s * 0.9, 0, 0, -s).stroke({ color: C.gold, width: w, join: "round" }); break;
    case "cal": g.roundRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.4, s * 0.15).stroke(st); g.moveTo(-s * 0.8, -s * 0.15).lineTo(s * 0.8, -s * 0.15).moveTo(-s * 0.45, -s * 0.95).lineTo(-s * 0.45, -s * 0.4).moveTo(s * 0.45, -s * 0.95).lineTo(s * 0.45, -s * 0.4).stroke(st); break;
    case "bag": g.roundRect(-s * 0.7, -s * 0.3, s * 1.4, s * 1.2, s * 0.15).stroke(st); g.arc(0, -s * 0.3, s * 0.4, Math.PI, 0).stroke(st); break;
    case "home": g.moveTo(-s * 0.9, 0).lineTo(0, -s * 0.9).lineTo(s * 0.9, 0).moveTo(-s * 0.65, -s * 0.2).lineTo(-s * 0.65, s * 0.85).lineTo(s * 0.65, s * 0.85).lineTo(s * 0.65, -s * 0.2).stroke(st); break;
    case "trophy": case "levels": case "map": g.circle(-s * 0.55, s * 0.55, s * 0.22).stroke(st); g.circle(0, -s * 0.1, s * 0.22).stroke(st); g.circle(s * 0.6, -s * 0.7, s * 0.22).stroke(st); g.moveTo(-s * 0.4, s * 0.4).lineTo(-s * 0.15, s * 0.05).moveTo(s * 0.15, -s * 0.25).lineTo(s * 0.45, -s * 0.55).stroke({ color, width: w * 0.8 }); break;
    case "user": case "crown": g.circle(0, -s * 0.35, s * 0.42).stroke(st); g.moveTo(-s * 0.85, s * 0.95).quadraticCurveTo(0, s * 0.1, s * 0.85, s * 0.95).stroke(st); break;
    case "chest": g.roundRect(-s * 0.9, -s * 0.3, s * 1.8, s * 1.1, s * 0.15).stroke(st); g.moveTo(-s * 0.9, -s * 0.3).quadraticCurveTo(0, -s * 1.1, s * 0.9, -s * 0.3).stroke(st); g.rect(-s * 0.15, -s * 0.3, s * 0.3, s * 0.4).fill({ color }); break;
    case "check": g.moveTo(-s * 0.7, 0).lineTo(-s * 0.15, s * 0.55).lineTo(s * 0.75, -s * 0.6).stroke({ color, width: w * 1.3, cap: "round", join: "round" }); break;
    case "cross": g.moveTo(-s * 0.6, -s * 0.6).lineTo(s * 0.6, s * 0.6).moveTo(s * 0.6, -s * 0.6).lineTo(-s * 0.6, s * 0.6).stroke({ color, width: w * 1.3, cap: "round" }); break;
    case "info": g.circle(0, 0, s * 0.9).stroke(st); g.moveTo(0, -s * 0.1).lineTo(0, s * 0.5).stroke(st); g.circle(0, -s * 0.45, w * 0.7).fill({ color }); break;
    case "echo": g.roundRect(-s * 0.62, -s * 0.45, s * 1.24, s * 1.0, s * 0.45).stroke(st); g.circle(-s * 0.22, -s * 0.02, w * 0.9).fill({ color }); g.circle(s * 0.22, -s * 0.02, w * 0.9).fill({ color }); g.arc(0, -s * 0.75, s * 0.5, Math.PI * 1.15, Math.PI * 1.85).stroke({ color, width: w * 0.8 }); break;
    case "switch": g.circle(0, 0, s * 0.9).stroke({ color, width: w, alpha: 0.5 }); g.circle(0, 0, s * 0.55).stroke(st); g.circle(0, 0, s * 0.18).fill({ color }); break;
    case "sound": g.poly([-s * 0.8, -s * 0.35, -s * 0.35, -s * 0.35, s * 0.15, -s * 0.8, s * 0.15, s * 0.8, -s * 0.35, s * 0.35, -s * 0.8, s * 0.35]).stroke(st); g.arc(s * 0.3, 0, s * 0.5, -Math.PI * 0.35, Math.PI * 0.35).stroke(st); break;
    case "music": g.moveTo(-s * 0.3, s * 0.5).lineTo(-s * 0.3, -s * 0.7).lineTo(s * 0.6, -s * 0.9).lineTo(s * 0.6, s * 0.3).stroke(st); g.circle(-s * 0.5, s * 0.5, s * 0.25).fill({ color }); g.circle(s * 0.4, s * 0.3, s * 0.25).fill({ color }); break;
    case "vibrate": g.roundRect(-s * 0.4, -s * 0.8, s * 0.8, s * 1.6, s * 0.15).stroke(st); g.moveTo(-s * 0.8, -s * 0.4).lineTo(-s * 0.8, s * 0.4).moveTo(s * 0.8, -s * 0.4).lineTo(s * 0.8, s * 0.4).stroke(st); break;
    case "globe": g.circle(0, 0, s * 0.9).stroke(st); g.ellipse(0, 0, s * 0.4, s * 0.9).stroke(st); g.moveTo(-s * 0.9, 0).lineTo(s * 0.9, 0).stroke(st); break;
    case "share": g.circle(s * 0.6, -s * 0.6, s * 0.25).stroke(st); g.circle(-s * 0.6, 0, s * 0.25).stroke(st); g.circle(s * 0.6, s * 0.6, s * 0.25).stroke(st); g.moveTo(-s * 0.38, -s * 0.12).lineTo(s * 0.38, -s * 0.48).moveTo(-s * 0.38, s * 0.12).lineTo(s * 0.38, s * 0.48).stroke(st); break;
    case "ticket": g.roundRect(-s * 0.9, -s * 0.5, s * 1.8, s * 1.0, s * 0.15).stroke(st); g.moveTo(-s * 0.2, -s * 0.5).lineTo(-s * 0.2, s * 0.5).stroke({ color, width: w * 0.7, alpha: 0.6 }); break;
    case "replay": g.arc(0, 0, s * 0.75, Math.PI * 0.3, Math.PI * 2.1).stroke(st); g.poly([-s * 0.55, -s * 0.95, -s * 0.1, -s * 0.55, -s * 0.75, -s * 0.35]).fill({ color }); break;
    case "pause": g.rect(-s * 0.55, -s * 0.7, w * 1.4, s * 1.4).fill({ color }); g.rect(s * 0.15, -s * 0.7, w * 1.4, s * 1.4).fill({ color }); break;
    default: g.circle(0, 0, s * 0.6).stroke(st);
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
  c.on("pointerup", (e) => { if (Math.hypot(e.global.x - x0, e.global.y - y0) <= DRAG_PX) { buzzSoft("light"); fn(e); } });
};
