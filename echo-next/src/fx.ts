/** Small reusable effects: glow textures, dust, rings, lightning, afterimages. */
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import gsap from "gsap";

const glowCache = new Map<string, Texture>();
/** A soft radial glow baked on a 2D canvas; `blendMode: "add"` makes it light. */
export function glowTexture(color = "#ffffff", size = 256) {
  const key = color + size; let tx = glowCache.get(key);
  if (!tx) {
    const cv = document.createElement("canvas"); cv.width = cv.height = size; const ctx = cv.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color); g.addColorStop(0.35, color + "99"); g.addColorStop(0.7, color + "33"); g.addColorStop(1, color + "00");
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    tx = Texture.from(cv); glowCache.set(key, tx);
  }
  return tx;
}
export function glow(color: string, radius: number, alpha = 0.6) {
  const s = new Sprite(glowTexture(color)); s.anchor.set(0.5); s.width = s.height = radius * 2; s.alpha = alpha; s.blendMode = "add"; return s;
}

/** Dust puffs at the feet after a hop. */
export function dust(layer: Container, x: number, y: number, size: number, color = 0xd9c9e8, n = 5) {
  for (let i = 0; i < n; i++) {
    const p = new Graphics(); const r = size * (0.06 + Math.random() * 0.06); p.circle(0, 0, r).fill({ color, alpha: 0.55 }); p.position.set(x + (Math.random() - 0.5) * size * 0.3, y); layer.addChild(p);
    const a = Math.PI + (Math.random() - 0.5) * 2.4;
    gsap.to(p, { x: p.x + Math.cos(a) * size * 0.45, y: p.y + Math.sin(a) * size * 0.25 - size * 0.1, alpha: 0, duration: 0.35 + Math.random() * 0.2, ease: "power2.out", onComplete: () => p.destroy() });
    gsap.to(p.scale, { x: 1.8, y: 1.8, duration: 0.45 });
  }
}

/** An expanding ring (shockwave, plate press, materialize). */
export function ring(layer: Container, x: number, y: number, r0: number, r1: number, color: number, width = 6, duration = 0.5) {
  const g = new Graphics(); g.circle(0, 0, r0).stroke({ color, width, alpha: 0.9 }); g.position.set(x, y); layer.addChild(g);
  const o = { r: r0 };
  gsap.to(o, { r: r1, duration, ease: "power2.out", onUpdate: () => { g.clear(); g.circle(0, 0, o.r).stroke({ color, width: width * (1 - (o.r - r0) / (r1 - r0) * 0.7), alpha: 0.9 * (1 - (o.r - r0) / (r1 - r0)) }); }, onComplete: () => g.destroy() });
  return g;
}

/** Jagged lightning bolts around a point, flickering for a moment. */
export function lightning(layer: Container, x: number, y: number, size: number, color = 0xdcfff0, duration = 0.5) {
  const g = new Graphics(); g.position.set(x, y); layer.addChild(g); g.blendMode = "add";
  const draw = () => {
    g.clear();
    for (let b = 0; b < 4; b++) {
      const a0 = Math.random() * Math.PI * 2; let px = Math.cos(a0) * size * 0.1, py = Math.sin(a0) * size * 0.1 - size * 0.4;
      g.moveTo(px, py);
      for (let s = 0; s < 5; s++) { px += Math.cos(a0 + (Math.random() - 0.5) * 1.6) * size * 0.16; py += Math.sin(a0 + (Math.random() - 0.5) * 1.6) * size * 0.16; g.lineTo(px, py); }
      g.stroke({ color, width: 2 + Math.random() * 3, alpha: 0.6 + Math.random() * 0.4 });
    }
  };
  draw(); const iv = setInterval(draw, 45);
  gsap.to(g, { alpha: 0, duration, ease: "power1.in", onComplete: () => { clearInterval(iv); g.destroy(); } });
}

/** A fading copy of a sprite's texture left behind it. */
export function afterimage(layer: Container, src: Sprite, tint: number, alpha = 0.45, duration = 0.35) {
  const s = new Sprite(src.texture); s.anchor.copyFrom(src.anchor); const g = src.getGlobalPosition(); const l = layer.toLocal(g);
  s.position.set(l.x, l.y); s.scale.set(src.worldTransform.a, src.worldTransform.d); s.tint = tint; s.alpha = alpha; s.blendMode = "add"; layer.addChild(s);
  gsap.to(s, { alpha: 0, duration, ease: "power1.out", onComplete: () => s.destroy() });
  return s;
}

/** A burst of small coloured bits flying out. */
export function burst(layer: Container, x: number, y: number, color: number, n: number, size = 60) {
  for (let i = 0; i < n; i++) {
    const p = new Graphics(); p.circle(0, 0, 3 + Math.random() * 4).fill({ color }); p.position.set(x, y); layer.addChild(p);
    const a = Math.random() * Math.PI * 2, r = size * (0.5 + Math.random());
    gsap.to(p, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r - size * 0.3, alpha: 0, duration: 0.5 + Math.random() * 0.3, ease: "power2.out", onComplete: () => p.destroy() });
  }
}
