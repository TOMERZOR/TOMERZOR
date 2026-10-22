/**
 * The guided first room. A dark veil with a spotlight on the thing that
 * matters, a card that says what to do, and steps that advance on what the
 * player actually does: a first move, the plate, END LOOP, the echo, the exit.
 */
import { Container, Graphics, Text, Sprite, Texture } from "pixi.js";
import gsap from "gsap";
import { W, C } from "./theme";
import { layout, killTweensDeep } from "./scenes";
import { panel, button, display, body } from "./ui";
import { t } from "./i18n";
import type { Level } from "./logic-types";

export const TUTORIAL_LEVEL: Level = {
  id: "tutorial", world: 1, par: 1,
  map: ["#######", "#S....#", "#.....#", "#..a..#", "#.....#", "###A###", "#.....#", "#..o..#", "#.....#", "#..E..#", "#######"],
};

export interface Rect { x: number; y: number; w: number; h: number }
/** What the tutorial needs from the room: where things are on screen, and a few actions. */
export interface TutHost {
  cellRect(x: number, y: number): Rect;
  dialRect(): Rect;
  endKeyRect(): Rect;
  heroCell(): { x: number; y: number };
  echoCount(): number;
  showCoach(): void;
  restartRoom(): void;
  finishTutorial(): void;
  skipTutorial(): void;
  layer: Container;
}

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export class Tutorial {
  step: Step = 0; private pending4 = false; private done = false;
  private veil = new Graphics(); private ring = new Graphics(); private card = new Container(); private pointer!: Sprite; private hole: Rect | null = null; private cardZone: "top" | "bottom" = "bottom";
  private text!: Text; private cardPanel!: Graphics; private skipT!: Text; private nextBtn: Container | null = null;
  private stepTl: gsap.core.Timeline | null = null;

  constructor(private host: TutHost) {
    const L = host.layer; L.addChild(this.veil, this.ring);
    this.pointer = new Sprite(Texture.from("s_arrow")); this.pointer.anchor.set(0.5); this.pointer.width = 110; this.pointer.scale.y = this.pointer.scale.x; this.pointer.rotation = -Math.PI / 2; this.pointer.tint = C.gold; L.addChild(this.pointer);
    this.cardPanel = panel(940, 200, { radius: 34, glow: C.mint }); this.card.addChild(this.cardPanel);
    this.text = new Text({ text: "", style: body(31, C.cream, 800) }); this.text.style.wordWrap = true; this.text.style.wordWrapWidth = 820; this.text.style.align = "center"; this.text.anchor.set(0.5, 0); this.card.addChild(this.text);
    this.skipT = new Text({ text: t("skip"), style: body(24, C.lilac, 800) }); this.skipT.anchor.set(1, 0); this.skipT.eventMode = "static"; this.skipT.cursor = "pointer"; this.skipT.on("pointertap", () => this.host.skipTutorial()); this.card.addChild(this.skipT);
    L.addChild(this.card);
    L.eventMode = "none";                 // the veil never swallows swipes
    this.show(0);
  }

  /** The room reports what happened; the tutorial decides what comes next. */
  on(ev: "beat" | "loopEnded" | "loopStart" | "exit") {
    if (this.done) return;
    if (ev === "beat") {
      if (this.step === 0) { this.show(1); gsap.delayedCall(1.7, () => { if (this.step === 1) this.show(2); }); }
      else if (this.step === 2 && this.onPlate()) this.show(3);
    } else if (ev === "loopEnded") {
      if (this.step === 3) this.pending4 = true;
    } else if (ev === "loopStart") {
      if (this.pending4 && this.host.echoCount() === 1) { this.pending4 = false; this.show(4); }
    } else if (ev === "exit") { this.show(5); }
  }
  /** A loop may end only from step 3; earlier it means the player ran out of moves, so the room restarts. */
  acceptLoopEnd() { return this.step === 3 || this.step === 4; }
  allowsMove() { return this.step !== 3 && this.step !== 5; }
  allowsEnd() { return this.step === 3 || this.step === 4; }
  private onPlate() { const h = this.host.heroCell(); return TUTORIAL_LEVEL.map[h.y]?.[h.x] === "a"; }

  show(step: Step) {
    this.step = step; this.stepTl?.kill();
    const L = this.host.layer;
    switch (step) {
      case 0: { const h = this.host.heroCell(); this.hole = this.host.cellRect(h.x, h.y); this.cardZone = "bottom"; this.setText(t("tut1")); this.host.showCoach(); break; }
      case 1: this.hole = this.host.dialRect(); this.cardZone = "bottom"; this.setText(t("tut2")); break;
      case 2: this.hole = this.host.cellRect(3, 3); this.cardZone = "bottom"; this.setText(t("tut3")); break;
      case 3: this.hole = this.host.endKeyRect(); this.cardZone = "top"; this.setText(t("tut4")); break;
      case 4: { const h = this.host.heroCell(); this.hole = this.host.cellRect(h.x, h.y); this.cardZone = "bottom"; this.setText(t("tut5")); break; }
      case 5: this.hole = null; this.cardZone = "top"; this.setText(t("tutorial_done") + "\n" + t("tutorial_done_sub")); this.done = true; break;
    }
    this.relayout();
    L.alpha = 0; gsap.to(L, { alpha: 1, duration: 0.3 });
    this.card.scale.set(0.92); gsap.to(this.card.scale, { x: 1, y: 1, duration: 0.4, ease: "back.out(1.6)" });
    if (step === 5) {
      this.nextBtn = button({ w: 520, h: 120, label: t("play"), kind: "primary", size: 44, onTap: () => this.host.finishTutorial() });
      this.card.addChild(this.nextBtn); this.skipT.visible = false; this.relayout();
    }
  }
  private setText(s: string) { this.text.text = s; }

  relayout() {
    const bottom = layout.bottom, top = layout.safeTop;
    // veil with a hole
    this.veil.clear(); const a = 0.66;
    if (this.hole) {
      const { x, y, w, h } = this.hole, pad = 18;
      this.veil.rect(-W, -2000, W * 3, y - pad + 2000).fill({ color: C.ink, alpha: a });
      this.veil.rect(-W, y + h + pad, W * 3, 4000).fill({ color: C.ink, alpha: a });
      this.veil.rect(-W, y - pad, W + x - pad, h + pad * 2).fill({ color: C.ink, alpha: a });
      this.veil.rect(x + w + pad, y - pad, W * 2, h + pad * 2).fill({ color: C.ink, alpha: a });
      this.ring.clear(); this.ring.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 26).stroke({ color: C.gold, width: 6, alpha: 0.95 }); this.ring.roundRect(x - pad - 10, y - pad - 10, w + pad * 2 + 20, h + pad * 2 + 20, 32).stroke({ color: C.gold, width: 3, alpha: 0.35 });
      this.pointer.visible = true;
      const below = this.cardZone === "top"; // pointer sits on the side away from the card
      this.pointer.position.set(x + w / 2, below ? y + h + pad + 80 : y - pad - 80); this.pointer.rotation = below ? -Math.PI / 2 : Math.PI / 2;
      killTweensDeep(this.pointer); gsap.to(this.pointer, { y: this.pointer.y + (below ? 18 : -18), duration: 0.5, yoyo: true, repeat: -1, ease: "sine.inOut" });
    } else {
      this.veil.rect(-W, -2000, W * 3, 8000).fill({ color: C.ink, alpha: 0.55 }); this.ring.clear(); this.pointer.visible = false;
    }
    // card
    const pad = 44, w = 940; const textH = this.text.height; const btnH = this.nextBtn ? 150 : 0; const h = pad + 36 + textH + btnH + pad;
    this.cardPanel.destroy(); this.cardPanel = panel(w, h, { radius: 34, glow: C.mint }); this.card.addChildAt(this.cardPanel, 0);
    this.text.position.set(w / 2, pad + 30); this.skipT.position.set(w - 30, 22);
    if (this.nextBtn) this.nextBtn.position.set(w / 2, h - pad - 60);
    this.card.pivot.set(w / 2, 0);
    const y = this.cardZone === "top" ? top + 150 : bottom - layout.safeBottom - 330 - h;
    this.card.position.set(W / 2, Math.max(top + 100, y));
  }
  destroy() { this.stepTl?.kill(); killTweensDeep(this.host.layer); }
}
