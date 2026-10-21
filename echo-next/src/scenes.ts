/** Scene stack with wipe transitions. Every screen is a Scene; one is live. */
import { Application, Container, Graphics } from "pixi.js";
import gsap from "gsap";
import { W, H, C } from "./theme";

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
let wipe: Graphics | null = null;

export const Scenes = {
  init(r: Container, app: Application) {
    root = r; appRef = app;
    app.ticker.add((t) => { const dt = Math.min(0.1, t.deltaMS / 1000); const top = stack[stack.length - 1]; top?.tick(dt); });
  },
  get top() { return stack[stack.length - 1]; },
  /** Replace the whole stack with one scene (tab navigation). */
  go(scene: Scene) { this.transition(() => { while (stack.length) stack.pop()!.dispose(); stack.push(scene); root.addChild(scene); scene.build(); scene.relayout(); }); },
  push(scene: Scene) { this.transition(() => { const prev = stack[stack.length - 1]; if (prev) prev.visible = false; stack.push(scene); root.addChild(scene); scene.build(); scene.relayout(); }); },
  pop() { this.transition(() => { const s = stack.pop(); s?.dispose(); const top = stack[stack.length - 1]; if (top) { top.visible = true; top.resume(); top.relayout(); } }); },
  /** Overlay (dialogs) sits on top without a wipe. */
  overlay(scene: Scene) { stack.push(scene); root.addChild(scene); scene.build(); scene.relayout(); },
  closeOverlay() { const s = stack.pop(); s?.dispose(); const top = stack[stack.length - 1]; top?.resume(); },
  relayout() { for (const s of stack) s.relayout(); },
  /** A soft mint-edged wipe: cover, swap, reveal. 260 ms each way. */
  transition(swap: () => void) {
    if (!stack.length) { swap(); return; }
    if (!wipe) { wipe = new Graphics(); wipe.rect(-W, 0, W * 3, H * 2).fill({ color: C.ink }); wipe.rect(-W, -40, W * 3, 40).fill({ color: C.mint, alpha: 0.9 }); }
    const w = wipe; w.y = -H * 2; root.addChild(w); w.alpha = 1;
    gsap.timeline()
      .to(w, { y: 0, duration: 0.26, ease: "power2.in" })
      .call(() => { swap(); root.addChild(w); })
      .to(w, { y: H * 2.2, duration: 0.3, ease: "power2.out" })
      .call(() => { root.removeChild(w); });
  },
  get app() { return appRef; },
  get root() { return root; },
  get scale() { return layout.scale; },
  get depth() { return stack.length; },
};
