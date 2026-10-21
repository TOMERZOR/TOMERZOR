/** The world map: a winding golden path up through the lab with a disc per room. */
import { Container, Sprite, Texture, Text, Graphics, Rectangle } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout, killTweensDeep } from "../scenes";
import { W, C } from "../theme";
import { panel, display, body, ribbon } from "../ui";
import { TopBar, TabBar, TOP_H, TAB_H, ScrollView, iconSprite, heroSprite, starRow, toast } from "../widgets";
import { state, L } from "../state";
import { audio } from "../audio";
import { t } from "../i18n";
import { LevelScene } from "./level";

const STEP = 250, HEAD = 260, XS = [300, 560, 790, 520];

export class MapScene extends Scene {
  private top!: TopBar; private tabs!: TabBar; private scroll!: ScrollView; private unsub = () => {}; private currentY = 0;
  build() {
    const bg = new Graphics(); bg.rect(0, 0, W, 4000).fill({ color: C.night }); this.addChild(bg);
    this.scroll = new ScrollView(W, 1000); this.addChild(this.scroll);
    this.top = new TopBar(); this.tabs = new TabBar("levels"); this.addChild(this.top, this.tabs);
    this.fill(); this.unsub = state.on(() => { this.top.refresh(); });
  }
  private fill() {
    const c = this.scroll.content; c.removeChildren().forEach((x) => { killTweensDeep(x as Container); x.destroy({ children: true }); });
    const p = state.profile, current = state.nextLevel();
    const worlds = L.WORLDS.map((w) => ({ w, levels: L.LEVELS.filter((l) => l.world === w.id) }));
    const total = worlds.reduce((n, g) => n + HEAD + g.levels.length * STEP, 0) + 200;
    // Backdrop: the painted hall, tiled up the whole path.
    // only the machinery band of the painting tiles; its smoky sky stays out
    const full = Texture.from("map_bg"); const tex = new Texture({ source: full.source, frame: new Rectangle(0, 700, full.width, full.height - 700) }); const tw = W, th = tex.height * (W / tex.width);
    for (let y = 0, k = 0; y < total + th; y += th, k++) { const s = new Sprite(tex); s.width = tw; s.height = th; s.y = total - y; s.anchor.set(0, 1); if (k % 2) { s.scale.x = -s.scale.x; s.x = W; } c.addChild(s); }
    const fog = new Graphics(); fog.rect(0, 0, W, total).fill({ color: C.ink, alpha: 0.25 }); c.addChild(fog);
    // Node positions, bottom up.
    const nodes: { l: any; x: number; y: number; wi: number }[] = []; let y = total - 160; const heads: { w: any; y: number }[] = [];
    let gi = 0;
    worlds.forEach(({ w, levels }, wi) => { levels.forEach((l) => { nodes.push({ l, x: XS[gi % XS.length]!, y, wi }); y -= STEP; gi++; }); heads.push({ w, y: y - 40 }); y -= HEAD; });
    // Path.
    const path = new Graphics();
    const stroke = (width: number, color: number, alpha = 1) => { path.moveTo(nodes[0]!.x, nodes[0]!.y + 120); for (let i = 0; i < nodes.length; i++) { const a = nodes[i]!, b = nodes[i + 1]; if (b) path.quadraticCurveTo(a.x, (a.y + b.y) / 2 - 40, (a.x + b.x) / 2, (a.y + b.y) / 2), path.quadraticCurveTo(b.x, (a.y + b.y) / 2 + 40, b.x, b.y); else path.lineTo(a.x, a.y - 140); } path.stroke({ width, color, alpha, cap: "round", join: "round" }); };
    stroke(92, 0x2a1b36, 0.9); stroke(72, 0xd9a85c); stroke(56, 0xf1cc7a); stroke(10, 0xffffff, 0.22);
    c.addChild(path);
    // World headers.
    for (const { w, y } of heads) {
      const unlocked = L.worldUnlocked(p, w.id); const hc = new Container(); hc.position.set(W / 2, y);
      const pn = panel(760, 170, { radius: 34, color: unlocked ? C.wall : C.plate }); pn.position.set(-380, -85); hc.addChild(pn);
      const rb = ribbon(`${t("world_n", { n: w.id })}`.toUpperCase(), unlocked ? C.violetDark : C.plateLight, 260, 48); rb.position.set(-130, -110); hc.addChild(rb);
      const nm = new Text({ text: t("world" + w.id), style: display(48, unlocked ? C.cream : C.lilac) }); nm.anchor.set(0.5); nm.position.set(0, -20); hc.addChild(nm);
      const sub = new Text({ text: unlocked ? t("world_intro" + w.id) : t("world_locked", { n: (w.id - 1) * 7 }), style: body(24, unlocked ? C.lilac : C.coral, 800) }); sub.anchor.set(0.5); sub.position.set(0, 36); hc.addChild(sub);
      if (!unlocked) { const lk = iconSprite("lock", 60); lk.position.set(-320, 0); hc.addChild(lk); }
      c.addChild(hc);
    }
    // Discs.
    for (const n of nodes) {
      const stars = p.stars[n.l.id] || 0, unlocked = L.worldUnlocked(p, n.l.world), isCur = current?.id === n.l.id;
      const d = new Container(); d.position.set(n.x, n.y);
      const g = new Graphics(); const base = !unlocked ? C.plate : isCur ? C.mint : C.gold;
      g.ellipse(0, 26, 92, 40).fill({ color: 0x000000, alpha: 0.35 });
      g.ellipse(0, 14, 84, 40).fill({ color: !unlocked ? 0x1a1324 : isCur ? C.mintDark : C.goldDark });
      g.ellipse(0, 0, 84, 40).fill({ color: base });
      g.ellipse(-10, -8, 50, 18).fill({ color: 0xffffff, alpha: unlocked ? 0.3 : 0.08 });
      if (isCur) { g.ellipse(0, 0, 100, 50).stroke({ color: C.orange, alpha: 0.9, width: 6 }); }
      d.addChild(g);
      if (!unlocked) { const lk = iconSprite("lock", 54); lk.y = -6; d.addChild(lk); }
      else { const num = new Text({ text: n.l.id.split("-")[1]!, style: display(54, isCur ? 0x16302a : 0x3a2400, false, false) }); num.anchor.set(0.5); num.y = -4; d.addChild(num); }
      if (stars) { const sr = starRow(stars, 40, 4); sr.position.set(0, 68); d.addChild(sr); }
      if (isCur) {
        const h = heroSprite(p.skin); h.position.set(0, -20); h.width = 170; h.scale.y = h.scale.x; d.addChild(h);
        gsap.to(h, { y: -32, duration: 1.1, yoyo: true, repeat: -1, ease: "sine.inOut" });
        const bub = new Container(); bub.position.set(0, -215);
        const bg = new Graphics(); bg.roundRect(-110, -44, 220, 88, 28).fill({ color: C.orange }); bg.poly([-18, 40, 18, 40, 0, 64]).fill({ color: C.orange }); bg.roundRect(-104, -38, 208, 36, 22).fill({ color: 0xffffff, alpha: 0.25 }); bg.roundRect(-110, -44, 220, 88, 28).stroke({ color: C.goldLight, alpha: 0.8, width: 4 }); bub.addChild(bg);
        const pt = new Text({ text: t("play").toUpperCase(), style: display(44, C.cream, true) }); pt.anchor.set(0.5); pt.y = -2; bub.addChild(pt); d.addChild(bub);
        gsap.to(bub, { y: -228, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" });
        this.currentY = n.y;
      }
      const hit = new Graphics(); hit.circle(0, 0, 110).fill({ color: 0xffffff, alpha: 0.001 }); d.addChildAt(hit, 0);
      d.eventMode = "static"; d.cursor = "pointer"; let y0 = 0;
      d.on("pointerdown", (e) => { y0 = e.global.y; gsap.to(d.scale, { x: 0.94, y: 0.94, duration: 0.08 }); });
      const up = (e: any, fire: boolean) => { gsap.to(d.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(2)" }); if (!fire || Math.abs(e.global.y - y0) > 14) return; if (!unlocked) { toast(t("world_locked", { n: (n.l.world - 1) * 7 })); return; } audio.play("tap", 0.6); Scenes.push(new LevelScene(n.l, n.l.id)); };
      d.on("pointerup", (e) => up(e, true)); d.on("pointerupoutside", (e) => up(e, false));
      c.addChild(d);
    }
    this.scroll.setContentHeight(total);
    this.scroll.scrollTo(Math.max(0, this.currentY - this.scroll.h * 0.55), false);
  }
  relayout() {
    this.top.relayout(layout.safeTop); this.tabs.relayout(layout.bottom, layout.safeBottom);
    const y0 = layout.safeTop + TOP_H, y1 = layout.bottom - TAB_H - layout.safeBottom;
    this.scroll.y = y0; this.scroll.resize(W, y1 - y0);
    this.scroll.scrollTo(Math.max(0, this.currentY - this.scroll.h * 0.55), false);
  }
  resume() { this.fill(); }
  dispose() { this.unsub(); super.dispose(); }
}
