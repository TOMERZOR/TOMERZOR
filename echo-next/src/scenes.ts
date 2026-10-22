/** Scene stack with crossfade transitions. Every screen is a Scene; one is live. */
import { Application, Container } from "pixi.js";
import gsap from "gsap";
import { W, H } from "./theme";

export abstract class Scene extends Container {
  /** Called after being added; build the display list here. */
  abstract build(): void;
  /** Called on resize and after build. */
  relayout(): void {}
  /** Called every frame with seconds. */
  tick(_dt: number): void {}
  /** Called when becoming the live scene again (after a pop). */
  resume(): void {}
  dispose(): void { killTweensDeep(this); this.destroy({ children: true }); }
}
/** Stop every tween aimed at a display object or its descendants before they are destroyed. */
export function killTweensDeep(c: Container) {
  gsap.killTweensOf(c); gsap.killTweensOf(c.scale); gsap.killTweensOf(c.position); gsap.killTweensOf(c.pivot);
  for (const ch of c.children) killTweensDeep(ch as Container);
}

let root: Container, appRef: Application;
/** Visible bounds in design units; `fit()` in main.ts keeps it current. */
export const layout = { scale: 1, top: 0, bottom: H, left: 0, right: W, safeTop: 0, safeBottom: 0 };
const stack: Scene[] = [];

/**
 * Errors never stop the show: an exception in a frame or a build is shown in
 * a small red strip (plain DOM, so it works even if the canvas is stuck) and
 * the ticker keeps running. `lastError` feeds the debug overlay.
 */
export const errors = { last: "", count: 0 };
let strip: HTMLDivElement | null = null, stripTimer = 0;
export function report(e: unknown) {
  const msg = e instanceof Error ? `${e.message}\n${(e.stack || "").split("\n").slice(1, 3).join(" ")}` : String(e);
  errors.last = msg; errors.count++; console.error(e);
  try {
    if (!strip) { strip = document.createElement("div"); strip.style.cssText = "position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:99;background:#b3203a;color:#fff;font:600 12px/1.35 system-ui;padding:8px 12px;border-radius:10px;white-space:pre-wrap;word-break:break-word;box-shadow:0 6px 20px rgba(0,0,0,.4)"; document.body.appendChild(strip); }
    strip.textContent = "ECHO hit an error (the game keeps running): " + msg; strip.style.display = "block";
    clearTimeout(stripTimer); stripTimer = window.setTimeout(() => { if (strip) strip.style.display = "none"; }, 8000);
  } catch { /* no DOM */ }
}
const guarded = (fn: () => void) => { try { fn(); } catch (e) { report(e); } };

export const Scenes = {
  init(r: Container, app: Application) {
    root = r; appRef = app;
    app.ticker.add((t) => { const dt = Math.min(0.1, t.deltaMS / 1000); const top = stack[stack.length - 1]; if (top) guarded(() => top.tick(dt)); });
  },
  get top() { return stack[stack.length - 1]; },
  /** Replace the whole stack with one scene (tab navigation). */
  /** Replace the whole stack with one scene (tab navigation): the new one fades in over the old. */
  go(scene: Scene) {
    const olds = stack.splice(0, stack.length);
    stack.push(scene); root.addChild(scene); guarded(() => { scene.build(); scene.relayout(); });
    scene.alpha = 0; gsap.to(scene, { alpha: 1, duration: 0.22, ease: "power1.out", onComplete: () => { for (const o of olds) guarded(() => o.dispose()); } });
  },
  push(scene: Scene) {
    const prev = stack[stack.length - 1];
    stack.push(scene); root.addChild(scene); guarded(() => { scene.build(); scene.relayout(); });
    scene.alpha = 0; gsap.to(scene, { alpha: 1, duration: 0.22, ease: "power1.out", onComplete: () => { if (prev) prev.visible = false; } });
  },
  pop() {
    const s = stack.pop(); const top = stack[stack.length - 1];
    if (top) { top.visible = true; top.alpha = 1; guarded(() => { top.resume(); top.relayout(); }); root.addChildAt(top, Math.max(0, root.getChildIndex(s!))); }
    if (s) gsap.to(s, { alpha: 0, duration: 0.2, ease: "power1.in", onComplete: () => guarded(() => s.dispose()) });
  },
  /** Overlay (dialogs) sits on top without a wipe. */
  overlay(scene: Scene) { stack.push(scene); root.addChild(scene); guarded(() => { scene.build(); scene.relayout(); }); },
  closeOverlay() { const s = stack.pop(); if (s) guarded(() => s.dispose()); const top = stack[stack.length - 1]; if (top) guarded(() => top.resume()); },
  relayout() { for (const s of stack) guarded(() => s.relayout()); },
  get app() { return appRef; },
  get root() { return root; },
  get scale() { return layout.scale; },
  get depth() { return stack.length; },
};
