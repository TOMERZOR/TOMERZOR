/** Settings sheet: music, sound, haptics, danger hints, language. */
import { Container, Text, Graphics } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout } from "../scenes";
import { W, C } from "../theme";
import { panel, button, display, body, scrim } from "../ui";
import { toggle, iconSprite } from "../widgets";
import { state } from "../state";
import { audio, buzz } from "../audio";
import { t, LANGS } from "../i18n";
import { HomeScene } from "./home";

export class SettingsScene extends Scene {
  private box!: Container;
  build() {
    const sh = scrim(W * 3, 4000, 0.7, () => this.close()); sh.x = -W; sh.y = -1000; this.addChild(sh);
    const w = 900, rows: [string, string, keyof typeof state.opts][] = [["music", "music", "music"], ["sound", "sfx", "sfx"], ["vibrate", "haptics", "haptics"], ["bulb", "assist", "assist"], ["globe", "tilt", "tilt"]];
    const h = 150 + rows.length * 110 + (LANGS.length > 1 ? 130 : 0) + 140;
    this.box = new Container(); this.box.addChild(panel(w, h, { radius: 36 }));
    const tt = new Text({ text: t("settings"), style: display(54) }); tt.anchor.set(0.5, 0); tt.position.set(w / 2, 44); this.box.addChild(tt);
    let y = 150;
    for (const [ic, key, opt] of rows) {
      const row = new Container(); row.y = y;
      const line = new Graphics(); line.roundRect(50, 0, w - 100, 92, 22).fill({ color: 0x000000, alpha: 0.22 }); row.addChild(line);
      const i = iconSprite(ic, 56); i.position.set(100, 46); row.addChild(i);
      const lb = new Text({ text: t(key), style: body(32, C.cream, 800) }); lb.anchor.set(0, 0.5); lb.position.set(150, 46); row.addChild(lb);
      const tg = toggle(!!state.opts[opt], (v) => { state.setOpts({ [opt]: v } as any); if (opt === "music") audio.musicOn(v && !!(Scenes.under as { run?: unknown } | undefined)?.run); if (opt === "haptics" && v) setTimeout(() => buzz("success"), 60); if (opt === "tilt" && v) { const D = (window as any).DeviceOrientationEvent; if (D?.requestPermission) D.requestPermission().catch(() => {}); } }); tg.position.set(w - 50 - 120 - 24, 14); row.addChild(tg);
      this.box.addChild(row); y += 110;
    }
    // Language chips, only when there is a choice.
    if (LANGS.length > 1) {
    const lrow = new Container(); lrow.y = y;
    const i = iconSprite("globe", 56); i.position.set(100, 46); lrow.addChild(i);
    const lb = new Text({ text: t("language"), style: body(32, C.cream, 800) }); lb.anchor.set(0, 0.5); lb.position.set(150, 46); lrow.addChild(lb);
    LANGS.forEach(([code, name], k) => {
      const on = state.opts.lang === code;
      const b = button({ w: 180, h: 76, label: name, kind: on ? "mint" : "ghost", size: 28, onTap: () => { if (on) return; state.setOpts({ lang: code }); Scenes.closeOverlay(); Scenes.go(new HomeScene()); } });
      b.position.set(w - 50 - 90 - k * 200, 46); lrow.addChild(b);
    });
    this.box.addChild(lrow); y += 130;
    }
    const close = button({ w: 420, h: 110, label: t("close"), kind: "primary", size: 40, onTap: () => this.close() }); close.position.set(w / 2, y + 55); this.box.addChild(close);
    this.box.pivot.set(w / 2, h / 2); this.addChild(this.box);
    this.box.scale.set(0.85); this.box.alpha = 0; gsap.to(this.box, { alpha: 1, duration: 0.18 }); gsap.to(this.box.scale, { x: 1, y: 1, duration: 0.3, ease: "back.out(1.6)" });
  }
  relayout() { this.box.position.set(W / 2, layout.bottom / 2); }
  close() { if ((this as any).closing) return; (this as any).closing = true; Scenes.remove(this, 170); gsap.to(this, { alpha: 0, duration: 0.15 }); }
}
