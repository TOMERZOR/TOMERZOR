/**
 * The map: every chapter's vista stacked up the screen, its chambers as
 * labelled nodes on a thin path of light, and a glass panel with the chamber
 * you are on.
 */
import { Container, Sprite, Texture, Text, Graphics } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout, killTweensDeep } from "../scenes";
import { W, C } from "../theme";
import { panel, button, display, body } from "../ui";
import { TopBar, TabBar, TOP_H, TAB_H, ScrollView, iconSprite, starRow, toast } from "../widgets";
import { glow } from "../fx";
import { state, L } from "../state";
import { audio, buzz } from "../audio";
import { t, chamberTitle, objectiveFor } from "../i18n";
import { LevelScene } from "./level";
import type { Level } from "../logic-types";

const STEP = 210, HEAD = 280, XS = [250, 560, 830, 560], INFO_H = 236;
const pad2 = (n: number | string) => String(n).padStart(2, "0");

export class MapScene extends Scene {
  private top!: TopBar; private tabs!: TabBar; private scroll!: ScrollView; private unsub = () => {}; private currentY = 0;
  private info!: Container; private infoEyebrow!: Text; private infoTitle!: Text; private infoObj!: Text; private infoCap!: Text; private infoSw!: Text; private infoBtn!: Container; private infoLevel: Level | null = null;
  build() {
    const bg = new Graphics(); bg.rect(-W, -2000, W * 3, 8000).fill({ color: C.ink }); this.addChild(bg);
    this.scroll = new ScrollView(W, 1000); this.addChild(this.scroll);
    this.buildInfo();
    this.top = new TopBar(); this.tabs = new TabBar("levels"); this.addChild(this.top, this.tabs);
    this.fill(); this.unsub = state.on(() => { this.top.refresh(); });
  }
  private buildInfo() {
    this.info = new Container(); this.addChild(this.info);
    const w = W - 80;
    this.info.addChild(panel(w, INFO_H, { radius: 22, glow: C.mint }));
    this.infoEyebrow = new Text({ text: "", style: display(22, C.mint, true, false) }); this.infoEyebrow.position.set(36, 24); this.info.addChild(this.infoEyebrow);
    this.infoTitle = new Text({ text: "", style: display(46, C.cream, true, false) }); this.infoTitle.position.set(36, 54); this.info.addChild(this.infoTitle);
    this.infoObj = new Text({ text: "", style: body(24, C.lilac, 500) }); this.infoObj.style.wordWrap = true; this.infoObj.style.wordWrapWidth = 560; this.infoObj.position.set(36, 118); this.info.addChild(this.infoObj);
    const col = (x: number, key: string) => { const l = new Text({ text: t(key).toUpperCase(), style: display(16, C.lilac, true, false) }); l.anchor.set(0, 0); l.position.set(x, 26); this.info.addChild(l); const v = new Text({ text: "", style: display(40, C.cream, false, false) }); v.anchor.set(0, 0); v.position.set(x, 44); this.info.addChild(v); return v; };
    this.infoCap = col(w - 330, "echo_capacity"); this.infoSw = col(w - 130, "switches");
    this.infoBtn = button({ w: 320, h: 92, label: t("resume"), kind: "primary", size: 32, onTap: () => { if (this.infoLevel) { audio.play("tap", 0.6); Scenes.push(new LevelScene(this.infoLevel, this.infoLevel.id)); } } });
    this.infoBtn.position.set(w - 36 - 160, INFO_H - 36 - 46); this.info.addChild(this.infoBtn);
  }
  private setInfo(l: Level | null) {
    this.infoLevel = l;
    const lvl = l ?? L.LEVELS[L.LEVELS.length - 1]!, w = L.WORLDS.find((x) => x.id === lvl.world) ?? L.WORLDS[0]!;
    this.infoEyebrow.text = `${t("chapter_n", { n: pad2(w.id) })} · ${t("world" + w.id)}`.toUpperCase();
    this.infoTitle.text = (l ? chamberTitle(l.id) : t("all_clear")).toUpperCase();
    this.infoObj.text = l ? objectiveFor(l) : t("world_intro" + w.id);
    this.infoCap.text = String(L.MAX_ECHOES);
    this.infoSw.text = String(new Set(lvl.map.join("").split("").filter((c) => "abc".includes(c))).size);
    const lbl = (this.infoBtn.children[1] as Container).children[0] as Text; lbl.text = (l && state.profile.stars[l.id] ? t("retry") : t("resume")).toUpperCase();
    this.infoBtn.visible = !!l;
  }
  private fill() {
    const c = this.scroll.content; c.removeChildren().forEach((x) => { killTweensDeep(x as Container); x.destroy({ children: true }); });
    const p = state.profile, current = state.nextLevel();
    this.setInfo(current);
    const worlds = L.WORLDS.map((w) => ({ w, levels: L.LEVELS.filter((l) => l.world === w.id) }));
    const total = worlds.reduce((n, g) => n + HEAD + g.levels.length * STEP, 0) + 200;
    // Node positions, bottom up; each chapter keeps the span it covers.
    const nodes: { l: Level; x: number; y: number; wi: number }[] = []; let y = total - 160; const heads: { w: (typeof L.WORLDS)[number]; y: number }[] = [];
    const spans: { w: (typeof L.WORLDS)[number]; y0: number; y1: number }[] = [];
    let gi = 0;
    worlds.forEach(({ w, levels }, wi) => { const y1 = y + 160; levels.forEach((l) => { nodes.push({ l, x: XS[gi % XS.length]!, y, wi: w.id - 1 }); y -= STEP; gi++; }); heads.push({ w, y: y - 40 }); y -= HEAD; spans.push({ w, y0: wi === worlds.length - 1 ? -200 : y + 40, y1 }); });
    // Backdrop: every chapter has its own vista, tiled up its own span.
    const TINT: Record<number, [number, number]> = { 1: [C.ink, 0.25], 2: [0x0b1430, 0.3], 3: [0x0e2a30, 0.28], 4: [0x2a1608, 0.3], 5: [0x101a3a, 0.3] };
    for (const sp of spans) {
      const tex = Texture.from("chapter" + sp.w.id); const th = tex.height * (W / tex.width);
      const sec = new Container(); const m = new Graphics(); m.rect(0, sp.y0, W, sp.y1 - sp.y0).fill({ color: 0xffffff }); sec.addChild(m); sec.mask = m;
      for (let yy = sp.y1, k = 0; yy > sp.y0 - th; yy -= th, k++) { const s = new Sprite(tex); s.width = W; s.height = th; s.anchor.set(0, 1); s.y = yy; if (k % 2) { s.scale.x = -s.scale.x; s.x = W; } sec.addChild(s); }
      const [tc, ta] = TINT[sp.w.id] ?? [C.ink, 0.2]; const tint = new Graphics(); tint.rect(0, sp.y0, W, sp.y1 - sp.y0).fill({ color: tc, alpha: ta }); sec.addChild(tint);
      // fog at the seams between tiles and at the chapter border
      for (let yy = sp.y1 - th; yy > sp.y0; yy -= th) for (let i = 0; i < 20; i++) { const a = 0.9 * Math.pow(1 - i / 20, 1.4); tint.rect(0, yy - 140 + i * 7, W, 8).fill({ color: C.ink, alpha: a }); tint.rect(0, yy + 140 - i * 7 - 8, W, 8).fill({ color: C.ink, alpha: a }); }
      for (let i = 0; i < 16; i++) { const a = 0.75 * (1 - i / 16); tint.rect(0, sp.y0 + i * 8, W, 9).fill({ color: C.ink, alpha: a }); }
      c.addChild(sec);
    }
    // The path of light between chambers.
    const path = new Graphics();
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i]!, b = nodes[i + 1]!, open = L.worldUnlocked(p, b.l.world), done = !!p.stars[a.l.id];
      path.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x06121a, width: 10, alpha: 0.35, cap: "round" });
      path.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: C.mint, width: 3, alpha: !open ? 0.15 : done ? 0.8 : 0.35, cap: "round" });
    }
    c.addChild(path);
    // Chapter headers.
    for (const { w, y } of heads) {
      const unlocked = L.worldUnlocked(p, w.id); const hc = new Container(); hc.position.set(W / 2, y);
      const pn = panel(760, 180, { radius: 22, glow: unlocked ? C.mint : undefined }); pn.position.set(-380, -90); hc.addChild(pn);
      const eb = new Text({ text: t("chapter_n", { n: pad2(w.id) }).toUpperCase(), style: display(22, unlocked ? C.mint : C.lilac, true, false) }); eb.anchor.set(0.5); eb.position.set(0, -52); hc.addChild(eb);
      const nm = new Text({ text: t("world" + w.id).toUpperCase(), style: display(46, unlocked ? C.cream : C.lilac, true, false) }); nm.anchor.set(0.5); nm.position.set(0, -10); hc.addChild(nm);
      const sub = new Text({ text: unlocked ? t("world_intro" + w.id) : t("world_locked", { n: L.WORLD_STARS?.[w.id - 1] ?? (w.id - 1) * 7 }), style: body(22, unlocked ? C.lilac : C.coral, 500) }); sub.anchor.set(0.5); sub.position.set(0, 40); hc.addChild(sub);
      if (!unlocked) { const lk = iconSprite("lock", 52); lk.position.set(-320, 0); hc.addChild(lk); }
      c.addChild(hc);
    }
    // Chambers.
    for (const n of nodes) {
      const stars = p.stars[n.l.id] || 0, unlocked = L.worldUnlocked(p, n.l.world), isCur = current?.id === n.l.id, done = stars > 0;
      const d = new Container(); d.position.set(n.x, n.y);
      if (isCur) { const h = glow("#49d7ff", 90, 0.5); d.addChild(h); gsap.to(h, { alpha: 0.25, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" }); }
      const g = new Graphics();
      g.circle(0, 0, 22).fill({ color: C.ink, alpha: 0.75 });
      if (done) { g.circle(0, 0, 14).fill({ color: C.mint }); g.circle(0, 0, 20).stroke({ color: C.mint, alpha: 0.9, width: 2 }); }
      else if (unlocked) { g.circle(0, 0, 20).stroke({ color: C.mint, alpha: 0.9, width: 2 }); g.circle(0, 0, 6).fill({ color: C.cream }); }
      else { g.circle(0, 0, 20).stroke({ color: 0xffffff, alpha: 0.2, width: 2 }); }
      if (isCur) { g.circle(0, 0, 30).stroke({ color: C.gold, alpha: 0.95, width: 3 }); }
      d.addChild(g);
      if (isCur) { const r2 = new Graphics(); r2.circle(0, 0, 30).stroke({ color: C.gold, alpha: 0.6, width: 2 }); d.addChild(r2); gsap.fromTo(r2.scale, { x: 1, y: 1 }, { x: 1.9, y: 1.9, duration: 1.4, repeat: -1, ease: "power1.out" }); gsap.fromTo(r2, { alpha: 0.7 }, { alpha: 0, duration: 1.4, repeat: -1, ease: "power1.out" }); }
      // the label: "01 ARRIVAL" on glass, to the side away from the screen edge
      const lab = new Container(); const lt = new Text({ text: (unlocked ? chamberTitle(n.l.id).replace(" / ", " ") : `${pad2(n.l.id.split("-")[1]!)} ${t("locked_short")}`).toUpperCase(), style: display(26, unlocked ? C.cream : C.lilac, true, false) }); lt.anchor.set(0, 0.5);
      const lw = lt.width + 44, left = n.x > W / 2; const pn = panel(lw, 54, { radius: 10, glow: isCur ? C.mint : undefined }); lab.addChild(pn); lt.position.set(22, 27); lab.addChild(lt);
      if (!unlocked) { const lk = iconSprite("lock", 30); lk.position.set(lw - 22, 27); lab.addChild(lk); lt.x = 16; }
      lab.position.set(left ? -34 - lw : 34, -27); lab.alpha = unlocked ? 1 : 0.7; d.addChild(lab);
      if (stars) { const sr = starRow(stars, 28, 3); sr.position.set(left ? -34 - lw / 2 : 34 + lw / 2, 48); d.addChild(sr); }
      if (isCur) this.currentY = n.y;
      const hit = new Graphics(); hit.rect(left ? -34 - lw : -34, -40, lw + 68, 80).fill({ color: 0xffffff, alpha: 0.001 }); d.addChildAt(hit, 0);
      d.eventMode = "static"; d.cursor = "pointer"; let y0 = 0;
      d.on("pointerdown", (e) => { y0 = e.global.y; buzz("light"); gsap.to(d.scale, { x: 0.96, y: 0.96, duration: 0.08 }); });
      const up = (e: any, fire: boolean) => { gsap.to(d.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(2)" }); if (!fire || Math.abs(e.global.y - y0) > 14) return; if (!unlocked) { toast(t("world_locked", { n: L.WORLD_STARS?.[n.l.world - 1] ?? (n.l.world - 1) * 7 })); return; } audio.play("tap", 0.6); this.setInfo(n.l); Scenes.push(new LevelScene(n.l, n.l.id)); };
      d.on("pointerup", (e) => up(e, true)); d.on("pointerupoutside", (e) => up(e, false));
      c.addChild(d);
    }
    this.scroll.setContentHeight(total);
    this.scroll.scrollTo(Math.max(0, this.currentY - this.scroll.h * 0.5), false);
  }
  relayout() {
    this.top.relayout(layout.safeTop); this.tabs.relayout(layout.bottom, layout.safeBottom);
    this.info.position.set(40, this.tabs.y - 16 - INFO_H);
    const y0 = layout.safeTop + TOP_H, y1 = this.info.y - 12;
    this.scroll.y = y0; this.scroll.resize(W, y1 - y0);
    this.scroll.scrollTo(Math.max(0, this.currentY - this.scroll.h * 0.5), false);
  }
  resume() { this.fill(); }
  dispose() { this.unsub(); super.dispose(); }
}
