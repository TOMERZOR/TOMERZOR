/** Modal dialog on a scrim: title, body, up to three buttons. */
import { Container, Text, Graphics } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout } from "../scenes";
import { W, C } from "../theme";
import { panel, button, display, body, scrim } from "../ui";
import { buzz } from "../haptics";

export interface DialogOpts { eyebrow?: string; title: string; text?: string; content?: Container; buttons: { label: string; kind?: "primary" | "secondary" | "ghost" | "mint"; onTap?: () => void }[]; dismiss?: boolean }

export class DialogScene extends Scene {
  private box!: Container; private shade!: Graphics;
  constructor(private o: DialogOpts) { super(); }
  build() {
    this.shade = scrim(W * 3, 4000, 0.72, this.o.dismiss === false ? undefined : () => this.close()); this.shade.x = -W; this.shade.y = -1000; this.addChild(this.shade);
    const w = 900, pad = 56; let y = pad;
    this.box = new Container();
    const items: Container[] = [];
    if (this.o.eyebrow) { const e = new Text({ text: this.o.eyebrow.toUpperCase(), style: body(24, C.mint, 800) }); e.style.letterSpacing = 3; e.anchor.set(0.5, 0); e.position.set(w / 2, y); items.push(e); y += 40; }
    const tt = new Text({ text: this.o.title, style: display(54, C.cream) }); tt.style.wordWrap = true; tt.style.wordWrapWidth = w - pad * 2; tt.style.align = "center"; tt.anchor.set(0.5, 0); tt.position.set(w / 2, y); items.push(tt); y += tt.height + 20;
    if (this.o.text) { const b = new Text({ text: this.o.text, style: body(30, C.lilac, 700) }); b.style.wordWrap = true; b.style.wordWrapWidth = w - pad * 2; b.style.align = "center"; b.anchor.set(0.5, 0); b.position.set(w / 2, y); items.push(b); y += b.height + 24; }
    if (this.o.content) { const c = this.o.content; c.position.set(w / 2, y); items.push(c); y += c.height + 30; }
    y += 10;
    const n = this.o.buttons.length, bw = n === 1 ? 520 : (w - pad * 2 - 20 * (n - 1)) / n;
    this.o.buttons.forEach((b, i) => { const bt = button({ w: bw, h: 120, label: b.label, kind: b.kind ?? (i === n - 1 ? "primary" : "ghost"), size: 40, onTap: () => { this.close(); b.onTap?.(); } }); bt.position.set(n === 1 ? w / 2 : pad + bw / 2 + i * (bw + 20), y + 60); items.push(bt); });
    y += 120 + pad;
    this.box.addChild(panel(w, y, { radius: 36 }), ...items);
    this.box.pivot.set(w / 2, y / 2); this.addChild(this.box);
    this.box.scale.set(0.8); this.box.alpha = 0; gsap.to(this.box, { alpha: 1, duration: 0.18 }); gsap.to(this.box.scale, { x: 1, y: 1, duration: 0.35, ease: "back.out(1.8)" });
    this.shade.alpha = 0; gsap.to(this.shade, { alpha: 1, duration: 0.2 }); buzz("light");
  }
  relayout() { this.box.position.set(W / 2, layout.bottom / 2); }
  close() { if ((this as any).closing) return; (this as any).closing = true; gsap.to(this.box.scale, { x: 0.85, y: 0.85, duration: 0.15 }); gsap.to(this, { alpha: 0, duration: 0.15, onComplete: () => { if (Scenes.top === this) Scenes.closeOverlay(); } }); }
}
export const dialog = (o: DialogOpts) => { const d = new DialogScene(o); Scenes.overlay(d); return d; };
