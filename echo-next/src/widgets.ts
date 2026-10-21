/**
 * Shared widgets: the top bar with currencies, the tab bar, icon and robot
 * sprites, a scroll view, toggles and a toast.
 */
import { Container, Sprite, Texture, Graphics, Text, FederatedPointerEvent } from "pixi.js";
import gsap from "gsap";
import { W, C } from "./theme";
import { Scenes } from "./scenes";
import { state, L } from "./state";
import { metalBar, pill, roundKey, display, body, DRAG_PX, tapOnce } from "./ui";
import { audio } from "./audio";
import { t } from "./i18n";
import { HomeScene } from "./scenes/home";
import { MapScene } from "./scenes/map";
import { ShopScene } from "./scenes/shop";
import { DailyScene } from "./scenes/daily";
import { ProfileScene } from "./scenes/profile";

export const TOP_H = 120;
export const TAB_H = 200;

/** A painted icon from the sliced sheet, centred, `size` tall. */
export function iconSprite(name: string, size = 64) {
  const s = new Sprite(Texture.from("icon_" + name)); s.anchor.set(0.5); s.height = size; s.scale.x = s.scale.y; return s;
}

const skinOf = (skin: string) => L.SKINS[L.skinId(skin)]!;
export function heroSprite(skin: string) {
  const s = new Sprite(Texture.from(skinOf(skin).sprite)); s.anchor.set(0.5, 1); (s as any).skin = skin; return s;
}
const echoCache = new Map<string, Texture>();
/** The hologram version of a robot: desaturated, washed in the skin's light, scanlined. Baked once per skin on a 2D canvas. */
export function echoTexture(skin: string) {
  const id = L.skinId(skin); let tx = echoCache.get(id);
  if (!tx) {
    const src = Texture.from(skinOf(id).sprite), img = src.source.resource as CanvasImageSource, w = src.width, h = src.height;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const ctx = cv.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    ctx.globalCompositeOperation = "saturation"; ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = skinOf(id).color; ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.6; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-in"; ctx.drawImage(img, 0, 0, w, h);
    ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "rgba(0,0,0,0.22)"; for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2);
    ctx.globalCompositeOperation = "source-over";
    tx = Texture.from(cv); echoCache.set(id, tx);
  }
  return tx;
}
export function echoSprite(skin: string) { const s = new Sprite(echoTexture(skin)); s.anchor.set(0.5, 1); s.alpha = 0.82; return s; }

/** Currencies and settings along the top. Pass `back` for a back key instead of the gear. */
export class TopBar extends Container {
  private bar = metalBar(W, TOP_H + 200); private coins: Container; private gems: Container; private stars: Container; private key: Container;
  private safe = 0;
  constructor(private opts: { back?: () => void; title?: string } = {}) {
    super();
    this.bar.y = -200; this.addChild(this.bar);
    this.coins = pill(250, 72, "0", iconSprite("coin", 60), () => Scenes.go(new ShopScene()));
    this.gems = pill(220, 72, "0", iconSprite("gem", 60), () => Scenes.go(new ShopScene()));
    this.stars = pill(230, 72, "0", iconSprite("star", 60), () => Scenes.go(new MapScene()));
    this.key = opts.back ? roundKey(92, "ghost", iconSprite("back", 48), () => { audio.play("tap", 0.5); opts.back!(); }) : roundKey(92, "ghost", iconSprite("gear", 52), () => { audio.play("tap", 0.5); openSettings(); });
    this.addChild(this.coins, this.gems, this.stars, this.key);
    if (opts.title) { const tt = new Text({ text: opts.title, style: display(40, C.cream, true) }); tt.anchor.set(0.5); tt.label = "title"; this.addChild(tt); }
    this.refresh();
  }
  refresh() {
    const p = state.profile; if (!p) return;
    (this.coins as any).setValue(String(p.coins)); (this.gems as any).setValue(String(p.gems));
    (this.stars as any).setValue(`${L.totalStars(p)}/${L.LEVELS.length * 3}`);
  }
  relayout(safeTop: number) {
    this.safe = safeTop; this.y = safeTop; this.bar.height = TOP_H + 200 + safeTop; this.bar.y = -200 - safeTop;
    const y = TOP_H / 2 - 4;
    if (this.opts.back) { this.key.position.set(70, y); } else { this.key.position.set(W - 70, y); }
    const title = this.getChildByLabel("title") as Text | null;
    if (title) { title.position.set(W / 2, y); this.coins.visible = this.gems.visible = this.stars.visible = false; return; }
    const x0 = this.opts.back ? 140 : 24, x1 = this.opts.back ? W - 24 : W - 140, gap = 14;
    const total = 250 + 220 + 230 + gap * 2, start = x0 + (x1 - x0 - total) / 2;
    this.coins.position.set(start, y - 36); this.gems.position.set(start + 250 + gap, y - 36); this.stars.position.set(start + 250 + 220 + gap * 2, y - 36);
  }
}

export type Tab = "home" | "levels" | "shop" | "daily" | "profile";
const TABS: { id: Tab; icon: string; key: string; make: () => any }[] = [
  { id: "home", icon: "home", key: "home", make: () => new HomeScene() },
  { id: "levels", icon: "trophy", key: "levels", make: () => new MapScene() },
  { id: "shop", icon: "bag", key: "shop", make: () => new ShopScene() },
  { id: "daily", icon: "cal", key: "daily_s", make: () => new DailyScene() },
  { id: "profile", icon: "crown", key: "profile", make: () => new ProfileScene() },
];
/** Five plastic keys on a brushed bar; the live one glows mint. */
export class TabBar extends Container {
  private bar = metalBar(W, TAB_H + 300); height_ = TAB_H;
  constructor(active: Tab) {
    super(); this.addChild(this.bar);
    const slot = (W - 40) / TABS.length;
    TABS.forEach((tab, i) => {
      const c = new Container(); c.x = 20 + slot * i; const on = tab.id === active;
      const g = new Graphics();
      g.roundRect(8, 16, slot - 16, TAB_H - 32, 26).fill({ color: on ? C.mint : 0x000000, alpha: on ? 0.9 : 0.28 });
      if (on) { g.roundRect(8, 16, slot - 16, (TAB_H - 32) * 0.45, 26).fill({ color: 0xffffff, alpha: 0.25 }); g.roundRect(8, 16, slot - 16, TAB_H - 32, 26).stroke({ color: 0xffffff, alpha: 0.35, width: 3 }); }
      else g.roundRect(8, 16, slot - 16, TAB_H - 32, 26).stroke({ color: 0xffffff, alpha: 0.08, width: 2 });
      c.addChild(g);
      const ic = iconSprite(tab.icon, 78); ic.position.set(slot / 2, TAB_H / 2 - 22); if (!on) ic.alpha = 0.8; c.addChild(ic);
      const lb = new Text({ text: t(tab.key).toUpperCase(), style: display(26, on ? 0x16302a : C.lilac, true, !on) }); lb.anchor.set(0.5); lb.position.set(slot / 2, TAB_H - 42); c.addChild(lb);
      if (!on) tapOnce(c, () => { audio.play("tap", 0.5); Scenes.go(tab.make()); });
      this.addChild(c);
    });
  }
  relayout(bottom: number, safeBottom: number) { this.y = bottom - TAB_H - safeBottom; this.bar.height = TAB_H + 300 + safeBottom; }
}

/** Vertical scroll view: drag with inertia, clamped to the content. */
export class ScrollView extends Container {
  content = new Container(); private maskG = new Graphics(); private vy = 0; private dragging = false; private lastY = 0; private lastT = 0; private contentH = 0;
  constructor(public w: number, public h: number) {
    super();
    this.maskG.rect(0, 0, w, h).fill({ color: 0xffffff }); this.addChild(this.maskG); this.mask = this.maskG;
    this.addChild(this.content);
    const hit = new Graphics(); hit.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.001 }); this.addChildAt(hit, 0);
    this.eventMode = "static";
    this.on("pointerdown", (e: FederatedPointerEvent) => { this.dragging = true; this.vy = 0; this.lastY = e.global.y; this.lastT = performance.now(); gsap.killTweensOf(this.content); });
    this.on("globalpointermove", (e: FederatedPointerEvent) => {
      if (!this.dragging) return; const now = performance.now(), dy = (e.global.y - this.lastY) / Scenes.scale;
      this.content.y = this.clamp(this.content.y + dy, 120); this.vy = dy / Math.max(1, now - this.lastT) * 16; this.lastY = e.global.y; this.lastT = now;
    });
    const end = () => { if (!this.dragging) return; this.dragging = false; this.fling(); };
    this.on("pointerup", end); this.on("pointerupoutside", end); this.on("pointercancel", end);
    this.addEventListener?.("wheel", (e: any) => { this.content.y = this.clamp(this.content.y - e.deltaY, 0); }, { passive: true } as any);
  }
  private clamp(y: number, give: number) { const min = Math.min(0, this.h - this.contentH); return Math.max(min - give, Math.min(give, y)); }
  private fling() {
    const target = this.clamp(this.content.y + this.vy * 14, 0);
    gsap.to(this.content, { y: target, duration: 0.6, ease: "power3.out" });
  }
  setContentHeight(h: number) { this.contentH = h; this.content.y = this.clamp(this.content.y, 0); }
  resize(w: number, h: number) { this.w = w; this.h = h; this.maskG.clear().rect(0, 0, w, h).fill({ color: 0xffffff }); (this.children[0] as Graphics).clear().rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.001 }); this.setContentHeight(this.contentH); }
  scrollTo(y: number, animate = true) { const target = this.clamp(-y, 0); if (animate) gsap.to(this.content, { y: target, duration: 0.5, ease: "power2.out" }); else this.content.y = target; }
}

/** A plastic on/off switch. */
export function toggle(on: boolean, onChange: (v: boolean) => void) {
  const c = new Container(); const w = 120, h = 64; let v = on;
  const g = new Graphics(); const knob = new Graphics(); c.addChild(g, knob);
  const draw = () => {
    g.clear(); g.roundRect(0, 4, w, h, h / 2).fill({ color: 0x000000, alpha: 0.45 }); g.roundRect(0, 0, w, h, h / 2).fill({ color: v ? C.mint : C.plateLight });
    g.roundRect(2, 2, w - 4, h * 0.5, h / 2).fill({ color: 0xffffff, alpha: 0.15 });
    knob.clear(); knob.circle(0, 3, h / 2 - 6).fill({ color: 0x000000, alpha: 0.3 }); knob.circle(0, 0, h / 2 - 6).fill({ color: C.cream }); knob.circle(-4, -6, h / 4).fill({ color: 0xffffff, alpha: 0.5 });
  };
  draw(); knob.position.set(v ? w - h / 2 : h / 2, h / 2);
  tapOnce(c, () => { v = !v; draw(); gsap.to(knob, { x: v ? w - h / 2 : h / 2, duration: 0.18, ease: "back.out(2)" }); audio.play("tap", 0.5); onChange(v); });
  return c;
}

let toastEl: Container | null = null;
/** A short message that drops in from the top and fades. */
export function toast(msg: string) {
  if (toastEl) { Scenes.root.removeChild(toastEl); toastEl.destroy({ children: true }); }
  const c = new Container(); const txt = new Text({ text: msg, style: body(30, C.cream, 800) }); txt.anchor.set(0.5);
  const g = new Graphics(); g.roundRect(-txt.width / 2 - 40, -40, txt.width + 80, 80, 40).fill({ color: C.ink, alpha: 0.92 }); g.roundRect(-txt.width / 2 - 40, -40, txt.width + 80, 80, 40).stroke({ color: C.mint, alpha: 0.6, width: 3 });
  c.addChild(g, txt); c.position.set(W / 2, 260); c.alpha = 0; Scenes.root.addChild(c); toastEl = c;
  gsap.timeline().to(c, { alpha: 1, y: 300, duration: 0.25, ease: "back.out(2)" }).to(c, { alpha: 0, duration: 0.3, delay: 1.6, onComplete: () => { if (toastEl === c) { Scenes.root.removeChild(c); c.destroy({ children: true }); toastEl = null; } } });
}

/** Three stars, lit up to `n`. */
export function starRow(n: number, size = 40, gap = 6) {
  const c = new Container();
  for (let i = 0; i < 3; i++) { const s = iconSprite(i < n ? "star" : "star_off", size); s.x = (i - 1) * (size + gap); c.addChild(s); }
  return c;
}

function openSettings() { import("./scenes/settings").then((m) => Scenes.overlay(new m.SettingsScene())); }
