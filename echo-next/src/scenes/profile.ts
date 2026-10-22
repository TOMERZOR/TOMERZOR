/** Profile: who you are, your numbers, your robot, settings and the save. */
import { Container, Text, Graphics } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout, killTweensDeep } from "../scenes";
import { W, C } from "../theme";
import { panel, button, display, body } from "../ui";
import { TopBar, TabBar, TOP_H, TAB_H, ScrollView, iconSprite, heroSprite, echoSprite, fitSprite, toast } from "../widgets";
import { state, L } from "../state";
import { audio } from "../audio";
import { t } from "../i18n";
import { dialog } from "./dialog";
import { SettingsScene } from "./settings";
import { ShopScene } from "./shop";
import { LevelScene } from "./level";
import { TUTORIAL_LEVEL } from "../tutorial";

export class ProfileScene extends Scene {
  private top!: TopBar; private tabs!: TabBar; private scroll!: ScrollView; private unsub = () => {};
  build() {
    const bg = new Graphics(); bg.rect(0, 0, W, 4000).fill({ color: C.night }); this.addChild(bg);
    this.scroll = new ScrollView(W, 1000); this.addChild(this.scroll);
    this.top = new TopBar(); this.tabs = new TabBar("profile"); this.addChild(this.top, this.tabs);
    this.fill(); this.unsub = state.on(() => { this.top.refresh(); this.fill(); });
  }
  private fill() {
    const c = this.scroll.content; c.removeChildren().forEach((x) => { killTweensDeep(x as Container); x.destroy({ children: true }); });
    const p = state.profile; let y = 30;
    // Robot on its pad with the name.
    const hero = new Container(); hero.position.set(W / 2, y + 300);
    const pad = new Graphics(); pad.ellipse(0, 0, 200, 60).fill({ color: C.mint, alpha: 0.18 }); pad.ellipse(0, 0, 200, 60).stroke({ color: C.mint, alpha: 0.8, width: 6 }); hero.addChild(pad);
    const e1 = echoSprite(p.skin); e1.position.set(-190, -10); fitSprite(e1, 170, 230); e1.alpha = 0.5; hero.addChild(e1);
    const e2 = echoSprite(p.skin); e2.position.set(190, -10); fitSprite(e2, 170, 230); e2.alpha = 0.5; hero.addChild(e2);
    const h = heroSprite(p.skin); fitSprite(h, 260, 320); hero.addChild(h);
    gsap.to(h, { y: -12, duration: 1.3, yoyo: true, repeat: -1, ease: "sine.inOut" });
    c.addChild(hero); y += 340;
    const name = new Text({ text: p.name || t("unnamed"), style: display(56) }); name.anchor.set(0.5, 0); name.position.set(W / 2, y); c.addChild(name);
    const edit = new Text({ text: "✎", style: display(40, C.mint) }); edit.anchor.set(0, 0.5); edit.position.set(W / 2 + name.width / 2 + 16, y + 34); c.addChild(edit);
    const tapName = new Graphics(); tapName.rect(W / 2 - 300, y - 10, 600, 90).fill({ color: 0xffffff, alpha: 0.001 }); c.addChild(tapName);
    tapName.eventMode = "static"; tapName.cursor = "pointer"; tapName.on("pointertap", () => { const v = window.prompt(t("name"), p.name || ""); if (v !== null) { const r = state.act({ t: "name", name: v.trim().slice(0, 16) }); if (!r.ok) toast(r.error); } });
    y += 80;
    const robot = new Text({ text: `${t("your_robot")}: ${t("sk_" + L.skinId(p.skin))}`, style: body(28, C.lilac, 800) }); robot.anchor.set(0.5, 0); robot.position.set(W / 2, y); c.addChild(robot); y += 70;

    // Stat tiles.
    const stats: [string, string, string][] = [["star", `${L.totalStars(p)}`, t("stars_total", { n: "" }).trim()], ["trophy", `${p.clears}`, t("done_title")], ["flame", `${p.streak}`, t("streak", { n: "" }).replace(/^[-\s]+|[-\s]+$/g, "")], ["coin", `${p.coins}`, t("coins")]];
    const tw = (W - 80 - 3 * 16) / 4;
    stats.forEach(([ic, v, lb], i) => {
      const tile = new Container(); tile.position.set(40 + i * (tw + 16), y); tile.addChild(panel(tw, 190, { radius: 26, rivets: false, color: C.plate }));
      const s = iconSprite(ic, 56); s.position.set(tw / 2, 50); tile.addChild(s);
      const vt = new Text({ text: v, style: display(44) }); vt.anchor.set(0.5); vt.position.set(tw / 2, 110); tile.addChild(vt);
      const lt = new Text({ text: lb, style: body(20, C.lilac, 800) }); lt.anchor.set(0.5); lt.position.set(tw / 2, 155); tile.addChild(lt);
      c.addChild(tile);
    });
    y += 230;

    // Actions.
    const rows: [string, string, () => void][] = [
      ["info", t("how_to_play"), () => Scenes.push(new LevelScene(TUTORIAL_LEVEL, "tutorial"))],
      ["bag", t("robots"), () => Scenes.go(new ShopScene())],
      ["gear", t("settings"), () => Scenes.overlay(new SettingsScene())],
      ["share", t("share"), () => { const txt = `ECHO · ${L.totalStars(p)} ★`; (navigator as any).share?.({ text: txt }).catch(() => {}) ?? navigator.clipboard?.writeText(txt).then(() => toast(t("copied"))); }],
      ["cross", t("reset_save"), () => dialog({ title: t("reset_save"), text: t("reset_q"), buttons: [{ label: t("cancel"), kind: "ghost" }, { label: t("confirm"), kind: "primary", onTap: () => { for (const k of Object.keys(localStorage)) if (k.startsWith("echo2:room:")) localStorage.removeItem(k); location.reload(); } }] })],
    ];
    for (const [ic, lb, fn] of rows) {
      const r = new Container(); r.position.set(40, y); r.addChild(panel(W - 80, 100, { radius: 24, rivets: false }));
      const s = iconSprite(ic, 52); s.position.set(60, 50); r.addChild(s);
      const l = new Text({ text: lb, style: body(32, C.cream, 800) }); l.anchor.set(0, 0.5); l.position.set(110, 50); r.addChild(l);
      const chev = new Text({ text: "›", style: display(44, C.lilac) }); chev.anchor.set(1, 0.5); chev.position.set(W - 120, 48); r.addChild(chev);
      r.eventMode = "static"; r.cursor = "pointer"; let x0 = 0; r.on("pointerdown", (e) => { x0 = e.global.y; }); r.on("pointerup", (e) => { if (Math.abs(e.global.y - x0) < 14) { audio.play("tap", 0.5); fn(); } });
      c.addChild(r); y += 116;
    }
    const ver = new Text({ text: t("version") + (state.opts.debug ? " · debug" : ""), style: body(22, C.lilac) }); ver.anchor.set(0.5, 0); ver.position.set(W / 2, y + 20); c.addChild(ver); y += 90;
    let taps = 0; ver.eventMode = "static"; ver.on("pointertap", () => { if (++taps >= 5) { taps = 0; state.setOpts({ debug: !state.opts.debug }); toast(state.opts.debug ? "debug on" : "debug off"); } });
    this.scroll.setContentHeight(y);
  }
  relayout() {
    this.top.relayout(layout.safeTop); this.tabs.relayout(layout.bottom, layout.safeBottom);
    const y0 = layout.safeTop + TOP_H, y1 = layout.bottom - TAB_H - layout.safeBottom;
    this.scroll.y = y0; this.scroll.resize(W, y1 - y0);
  }
  dispose() { this.unsub(); super.dispose(); }
}
