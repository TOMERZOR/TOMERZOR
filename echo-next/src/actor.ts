/**
 * An actor on the board: the sprite, its drop shadow and the procedural life
 * on top of it. Squash and stretch on every hop, a lean into the direction of
 * travel, breathing when still, and the entrances and exits.
 */
import { Container, Graphics, Sprite, Texture } from "pixi.js";
import gsap from "gsap";
import { glow, ring, lightning, dust } from "./fx";

export type Kind = "hero" | "echo" | "drone";
const sm = (a: number, b: number, k: number) => a + (b - a) * (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));

/** Tween a sprite's tint per channel; a packed integer would sweep through unrelated colours. */
function tintTo(sprite: Sprite, from: number, to: number, duration: number, extra: gsap.TweenVars = {}) {
  const o = { k: 0 }, ch = (c: number, s: number) => (c >> s) & 255;
  return gsap.to(o, { k: 1, duration, ...extra, onUpdate: () => { if (sprite.destroyed) return; const m = (s: number) => Math.round(ch(from, s) + (ch(to, s) - ch(from, s)) * o.k); sprite.tint = (m(16) << 16) | (m(8) << 8) | m(0); } });
}

export class Actor extends Container {
  body = new Container(); sprite: Sprite; shadow = new Graphics(); lamp: Sprite | null = null;
  face = 1; private idleT = Math.random() * 10; private lastK = 1; moving = false; dir = 0;
  constructor(texture: Texture, public size: number, public kind: Kind, lampColor?: string) {
    super();
    this.shadow.ellipse(0, 0, size * 0.3, size * 0.11).fill({ color: 0x000000, alpha: kind === "echo" ? 0.18 : 0.32 }); this.addChild(this.shadow);
    if (lampColor) { this.lamp = glow(lampColor, size * (kind === "hero" ? 1.3 : 0.9), kind === "hero" ? 0.5 : 0.32); this.lamp.y = -size * 0.35; this.addChild(this.lamp); }
    this.sprite = new Sprite(texture); this.sprite.anchor.set(0.5, 1);
    const tw = this.sprite.texture.width, th = this.sprite.texture.height;
    const sc = kind === "drone" ? (size * 0.84) / tw : Math.min((size * 0.96) / tw, (size * 1.3) / th); this.sprite.scale.set(sc);
    if (kind === "drone") this.sprite.y = size * 0.22;
    this.body.addChild(this.sprite); this.addChild(this.body);
    if (kind === "echo") this.sprite.alpha = 0.84;
  }
  /** Horizontal facing from a move direction (3 right, 7 left). */
  setDir(d: number) { this.dir = d; if (d === 3) this.face = 1; else if (d === 7) this.face = -1; }
  /** Drive the pose from the hop progress k (0 at take-off, 1 landed). */
  pose(k: number, moved: boolean, dt: number) {
    this.idleT += dt;
    let sx = 1, sy = 1, rot = 0, lift = 0;
    if (moved && k < 1) {
      if (k < 0.18) { const u = k / 0.18; sx = sm(1, 1.12, u); sy = sm(1, 0.86, u); }
      else if (k < 0.72) { const u = (k - 0.18) / 0.54; sx = sm(1.12, 0.9, Math.min(1, u * 1.6)); sy = sm(0.86, 1.14, Math.min(1, u * 1.6)); }
      else { const u = (k - 0.72) / 0.28; sx = sm(0.9, 1.1, Math.min(1, u * 2)) - (u > 0.5 ? (u - 0.5) * 0.2 : 0); sy = sm(1.14, 0.88, Math.min(1, u * 2)) + (u > 0.5 ? (u - 0.5) * 0.24 : 0); }
      if (this.dir === 3 || this.dir === 7) rot = this.face * 0.16 * Math.sin(Math.PI * k);
      lift = Math.sin(Math.PI * k) * this.size * 0.18;
    } else if (!moved && k < 1 && this.dir && this.kind !== "drone") {
      // a bump into a wall: a short squash toward the wall
      sx = 1 + 0.14 * Math.sin(Math.PI * k); sy = 1 - 0.1 * Math.sin(Math.PI * k);
    } else {
      // breathing
      const b = Math.sin(this.idleT * 2.6) * 0.018; sy = 1 + b; sx = 1 - b * 0.6;
      if (this.kind === "drone") lift = Math.sin(this.idleT * 4) * this.size * 0.04;
    }
    this.body.scale.set(sx * this.face, sy); this.body.rotation = rot; this.body.y = -lift;
    this.shadow.scale.set(1 - lift / this.size * 0.5, 1 - lift / this.size * 0.5); this.shadow.alpha = 1 - lift / this.size;
    this.lastK = k;
  }
  /** Teleport-in for the live hero: a beam, then a drop with a bounce and a ring. */
  arrive(fxLayer: Container) {
    this.body.scale.set(0.2 * this.face, 1.6); this.body.alpha = 0;
    const beam = new Graphics(); beam.rect(-this.size * 0.12, -this.size * 2.2, this.size * 0.24, this.size * 2.2).fill({ color: 0xffffff, alpha: 0.9 }); beam.blendMode = "add"; this.addChild(beam);
    gsap.to(beam, { alpha: 0, duration: 0.35, delay: 0.1, onComplete: () => { if (!beam.destroyed) beam.destroy(); } });
    gsap.to(this.body, { alpha: 1, duration: 0.15, delay: 0.05 });
    gsap.to(this.body.scale, { x: 1 * this.face, y: 1, duration: 0.45, delay: 0.08, ease: "elastic.out(1, 0.5)" });
    gsap.delayedCall(0.12, () => { if (!this.destroyed) ring(fxLayer, this.x, this.y, this.size * 0.15, this.size * 0.7, 0xffffff, 5, 0.45); });
  }
  /** Hologram materialize for echoes: scanline flicker and a mint ring. */
  materialize(fxLayer: Container, color: number) {
    this.body.alpha = 0; this.body.scale.set(1.3 * this.face, 0.12);
    gsap.timeline().to(this.body, { alpha: 1, duration: 0.08 }).to(this.body.scale, { x: 0.95 * this.face, y: 1.08, duration: 0.22, ease: "power2.out" }, 0).to(this.body.scale, { x: 1 * this.face, y: 1, duration: 0.25, ease: "back.out(2)" }).to(this.body, { alpha: 0.55, duration: 0.05, yoyo: true, repeat: 3 }, 0.1);
    gsap.delayedCall(0.05, () => { if (!this.destroyed) ring(fxLayer, this.x, this.y, this.size * 0.1, this.size * 0.55, color, 4, 0.4); });
  }
  /** Caught by a drone: a zap, a flinch, a desaturated flicker. */
  zap(fxLayer: Container) {
    lightning(fxLayer, this.x, this.y - this.size * 0.1, this.size * 1.2);
    gsap.fromTo(this.body, { x: -this.size * 0.06 }, { x: this.size * 0.06, duration: 0.05, yoyo: true, repeat: 7, onComplete: () => { this.body.x = 0; } });
    tintTo(this.sprite, 0xffffff, 0xff7a7a, 0.08, { yoyo: true, repeat: 5 });
  }
  /** Loop saved: the hero freezes into light. */
  freeze(color: number) {
    tintTo(this.sprite, 0xffffff, color, 0.25); gsap.to(this.body, { alpha: 0.6, duration: 0.3 });
  }
  dustAt(fxLayer: Container) { dust(fxLayer, this.x, this.y, this.size); }
}
