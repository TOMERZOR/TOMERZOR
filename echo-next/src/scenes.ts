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

export const Scenes = {
  init(r: Container, app: Application) {
    root = r; appRef = app;
    app.ticker.add((t) => { const dt = Math.min(0.1, t.deltaMS / 1000); const top = stack[stack.length - 1]; top?.tick(dt); });
  },
  get top() { return stack[stack.length - 1]; },
  /** Replace the whole stack with one scene (tab navigation). */
  /** Replace the whole stack with one scene (tab navigation): the new one fades in over the old. */
  go(scene: Scene) {
    const olds = stack.splice(0, stack.length);
    stack.push(scene); root.addChild(scene); scene.build(); scene.relayout();
    scene.alpha = 0; gsap.to(scene, { alpha: 1, duration: 0.22, ease: "power1.out", onComplete: () => { for (const o of olds) o.dispose(); } });
  },
  push(scene: Scene) {
    const prev = stack[stack.length - 1];
    stack.push(scene); root.addChild(scene); scene.build(); scene.relayout();
    scene.alpha = 0; gsap.to(scene, { alpha: 1, duration: 0.22, ease: "power1.out", onComplete: () => { if (prev) prev.visible = false; } });
  },
  pop() {
    const s = stack.pop(); const top = stack[stack.length - 1];
    if (top) { top.visible = true; top.alpha = 1; top.resume(); top.relayout(); root.addChildAt(top, Math.max(0, root.getChildIndex(s!) )); }
    if (s) gsap.to(s, { alpha: 0, duration: 0.2, ease: "power1.in", onComplete: () => s.dispose() });
  },
  /** Overlay (dialogs) sits on top without a wipe. */
  overlay(scene: Scene) { stack.push(scene); root.addChild(scene); scene.build(); scene.relayout(); },
  closeOverlay() { const s = stack.pop(); s?.dispose(); const top = stack[stack.length - 1]; top?.resume(); },
  relayout() { for (const s of stack) s.relayout(); },
  get app() { return appRef; },
  get root() { return root; },
  get scale() { return layout.scale; },
  get depth() { return stack.length; },
};
