/**
 * Home: the hall with the portal, the robot you play as on the pad with its
 * holographic echoes, the logo, today's cards, Play, and the tab bar.
 */
import { Container, Sprite, Texture, Graphics, Text } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout } from "../scenes";
import { W, H, C } from "../theme";
import { state, L, today } from "../state";
import { panel, button, pill, progressBar, display, body, label, roundKey } from "../ui";
import { TopBar, TabBar, iconSprite, heroSprite, echoSprite, TOP_H } from "../widgets";
import { audio, buzz } from "../audio";
import { t } from "../i18n";
import { MapScene } from "./map";
import { LevelScene } from "./level";
import { ShopScene } from "./shop";
import { PassScene } from "./pass";
import { DailyScene } from "./daily";
import { ProfileScene } from "./profile";
import { TUTORIAL_LEVEL } from "../tutorial";

export class HomeScene extends Scene {
  private bg!: Sprite; private fog!: Graphics; private stage!: Container; private ui!: Container;
  private tabs!: TabBar; private top!: TopBar; private time = 0;
  private sweep!: Graphics; private portalGlow!: Graphics;

  build() {
    this.bg = new Sprite(Texture.from("bg_title")); this.bg.anchor.set(0.5, 0.35); this.addChild(this.bg);
    this.portalGlow = new Graphics(); this.portalGlow.circle(0, 0, 230).fill({ color: C.gold, alpha: 0.18 }); this.portalGlow.circle(0, 0, 120).fill({ color: C.goldLight, alpha: 0.12 }); this.addChild(this.portalGlow);
    this.fog = new Graphics(); this.addChild(this.fog);
    this.stage = new Container(); this.addChild(this.stage);
    this.sweep = new Graphics(); this.sweep.rect(0, 0, W, 260).fill({ color: C.mint, alpha: 0.12 }); this.sweep.rect(0, 250, W, 10).fill({ color: 0xdcfff0, alpha: 0.55 }); this.sweep.alpha = 0; this.addChild(this.sweep);
    this.ui = new Container(); this.addChild(this.ui);
    this.top = new TopBar(); this.addChild(this.top);
    this.tabs = new TabBar("home"); this.addChild(this.tabs);
    this.buildStage(); this.buildUi();
    this.unsub = state.on(() => this.refresh());
    audio.musicOn(false);
    // the time sweep crosses the hall every few seconds
    gsap.timeline({ repeat: -1, repeatDelay: 4.5 }).set(this.sweep, { y: -300, alpha: 1 }).to(this.sweep, { y: H + 100, duration: 1.4, ease: "power2.in" }).set(this.sweep, { alpha: 0 });
  }
  private unsub = () => {};
  private hero!: Sprite; private echoes: Sprite[] = []; private pads: Graphics[] = [];
  private buildStage() {
    const skin = state.skin();
    for (let i = 0; i < 3; i++) { const p = new Graphics(); p.ellipse(0, 0, 110, 34).stroke({ color: C.mint, alpha: 0.9, width: 5 }); p.ellipse(0, 0, 80, 24).fill({ color: C.mint, alpha: 0.18 }); this.pads.push(p); this.stage.addChild(p); }
    for (let i = 0; i < 2; i++) { const e = echoSprite(skin); e.anchor.set(0.5, 1); e.alpha = 0; this.echoes.push(e); this.stage.addChild(e); }
    this.hero = heroSprite(skin); this.hero.anchor.set(0.5, 1); this.stage.addChild(this.hero);
    gsap.to(this.hero, { y: "-=10", duration: 1.3, yoyo: true, repeat: -1, ease: "sine.inOut" });
    this.echoes.forEach((e, i) => gsap.timeline({ repeat: -1, delay: i * 3 }).to(e, { alpha: 0.78, duration: 0.6 }).to(e, { alpha: 0.5, duration: 0.08, yoyo: true, repeat: 5 }).to(e, { alpha: 0.78, duration: 2.5 }).to(e, { alpha: 0, duration: 0.5 }).to({}, { duration: 2.5 }));
  }
  private howTo!: Container;
  private logo!: Container; private cards!: Container; private play!: Container; private playSub!: Text; private dailySub!: Text; private passSub!: Text; private passBar!: Container; private streak!: Text;
  private buildUi() {
    // Logo: chunky cream letters with an orange lip and mint echo copies behind.
    this.logo = new Container();
    for (const [dx, dy, col, a] of [[-26, 18, C.mint, 0.22], [-14, 10, C.mint, 0.45]] as const) { const g = label("ECHO", 230, col, false); g.style.dropShadow = false; g.position.set(dx, dy); g.alpha = a; this.logo.addChild(g); }
    const lip = label("ECHO", 230, C.orangeDark, false); lip.style.dropShadow = false; lip.y = 10; this.logo.addChild(lip);
    const face = label("ECHO", 230, C.cream, false); face.style.dropShadow = false; this.logo.addChild(face);
    const tag = new Text({ text: t("tagline").toUpperCase(), style: body(26, C.mint, 800) }); tag.anchor.set(0.5); tag.y = 150; tag.style.letterSpacing = 4; this.logo.addChild(tag);
    this.ui.addChild(this.logo);
    gsap.to(this.logo.children[0]!, { x: -34, y: 24, duration: 2.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
    gsap.to(this.logo.children[1]!, { x: -18, y: 13, duration: 2.2, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.3 });

    // Today cards.
    this.cards = new Container(); this.ui.addChild(this.cards);
    const cw = 470, ch = 150;
    const daily = new Container(); daily.addChild(panel(cw, ch, { rivets: false, radius: 24 }));
    const dIcon = iconSprite("cal", 64); dIcon.position.set(56, ch / 2); daily.addChild(dIcon);
    const dTitle = new Text({ text: "", style: display(34, C.cream) }); dTitle.position.set(104, 30); daily.addChild(dTitle); (daily as any).title = dTitle;
    this.dailySub = new Text({ text: "", style: body(22, C.lilac, 800) }); this.dailySub.position.set(104, 74); daily.addChild(this.dailySub);
    this.streak = new Text({ text: "", style: body(22, C.gold, 800) }); this.streak.position.set(104, 104); daily.addChild(this.streak);
    daily.eventMode = "static"; daily.cursor = "pointer"; daily.on("pointertap", () => { audio.play("tap", 0.5); Scenes.push(new DailyScene()); });
    this.cards.addChild(daily); (this.cards as any).daily = daily;
    const pass = new Container(); pass.x = cw + 20; pass.addChild(panel(cw, ch, { rivets: false, radius: 24 }));
    const pIcon = iconSprite("chest", 70); pIcon.position.set(56, ch / 2); pass.addChild(pIcon);
    const pTitle = new Text({ text: t("next_reward"), style: display(34, C.cream) }); pTitle.position.set(104, 30); pass.addChild(pTitle);
    this.passSub = new Text({ text: "", style: body(22, C.lilac, 800) }); this.passSub.position.set(104, 74); pass.addChild(this.passSub);
    this.passBar = progressBar(330, 14, 0); this.passBar.position.set(104, 112); pass.addChild(this.passBar);
    pass.eventMode = "static"; pass.cursor = "pointer"; pass.on("pointertap", () => { audio.play("tap", 0.5); Scenes.push(new PassScene()); });
    this.cards.addChild(pass);

    // Play.
    this.play = button({ w: 960, h: 150, label: t("play"), sub: "", kind: "primary", size: 64, onTap: () => { audio.play("tap", 0.6); buzz("medium"); if (!state.flag("tut")) { Scenes.push(new LevelScene(TUTORIAL_LEVEL, "tutorial")); return; } const n = state.nextLevel(); if (n) Scenes.push(new LevelScene(n, n.id)); else Scenes.go(new MapScene()); } });
    this.howTo = roundKey(92, "ghost", iconSprite("info", 50), () => { audio.play("tap", 0.5); Scenes.push(new LevelScene(TUTORIAL_LEVEL, "tutorial")); }); this.ui.addChild(this.howTo);
    this.playSub = (this.play.children[1] as Container).children[1] as Text;
    this.ui.addChild(this.play);
    gsap.to(this.play.scale, { x: 1.015, y: 1.015, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
    this.refresh();
  }
  refresh() {
    const p = state.profile; if (!p) return;
    this.top.refresh();
    const dk = `daily-${today()}`, best = p.best[dk];
    ((this.cards as any).daily.title as Text).text = t("daily_name", { d: String(today() % 1000) });
    this.dailySub.text = best ? `★${p.stars[dk] || 1} · ${best.echoes} ${t("echoes_used")} · ${best.ticks} ${t("moves")}` : t("daily_open");
    this.streak.text = p.streak ? `🔥 ${t("streak", { n: String(p.streak) })}` : "";
    const next = L.PASS_TIERS[p.claimedTiers];
    this.passSub.text = next ? `${rewardLabel(next)} · ${Math.max(0, next.xp - p.passXp)} XP` : t("all_claimed");
    (this.passBar as any).set(next ? p.passXp / Math.max(1, next.xp) : 1);
    const nl = state.nextLevel(); this.playSub.text = nl ? levelName(nl.id) : t("all_clear");
    // swap the robot if the skin changed
    const skin = state.skin();
    if ((this.hero as any).skin !== skin) { this.hero.texture = heroSprite(skin).texture; (this.hero as any).skin = skin; this.echoes.forEach((e) => { e.texture = echoSprite(skin).texture; }); }
  }
  relayout() {
    const vis = layout.bottom, top = layout.safeTop;
    this.bg.position.set(W / 2, vis * 0.36); const s = Math.max(W / this.bg.texture.width, vis / this.bg.texture.height) * 1.04; this.bg.scale.set(s);
    this.fog.clear(); this.fog.rect(0, 0, W, vis).fill({ color: C.ink, alpha: 0.12 });
    for (let i = 0; i < 24; i++) { const y0 = vis * 0.5 + (vis * 0.5 * i) / 24; this.fog.rect(0, y0, W, vis * 0.5 / 24 + 1).fill({ color: C.ink, alpha: 0.65 * Math.pow(i / 24, 1.6) }); }
    this.portalGlow.position.set(W / 2, vis * 0.43);
    const stageY = vis * 0.6;
    this.pads[0]!.position.set(W / 2, stageY + 6); this.pads[1]!.position.set(W / 2 - 300, stageY + 20); this.pads[2]!.position.set(W / 2 + 300, stageY + 20);
    this.hero.position.set(W / 2, stageY); this.hero.width = 300; this.hero.scale.y = this.hero.scale.x;
    this.echoes[0]!.position.set(W / 2 - 300, stageY + 14); this.echoes[1]!.position.set(W / 2 + 300, stageY + 14);
    for (const e of this.echoes) { e.width = 250; e.scale.y = e.scale.x; }
    this.top.relayout(top); this.tabs.relayout(vis, layout.safeBottom);
    this.logo.position.set(W / 2, top + 330);
    const tabsTop = this.tabs.y;
    this.play.position.set(W / 2, tabsTop - 130);
    this.cards.position.set((W - 960) / 2, tabsTop - 130 - 75 - 24 - 150);
    this.howTo.position.set(70, top + TOP_H + 70);
  }
  tick(dt: number) { this.time += dt; this.portalGlow.scale.set(1 + Math.sin(this.time * 2) * 0.05); this.portalGlow.alpha = 0.85 + Math.sin(this.time * 3) * 0.15; }
  dispose() { this.unsub(); super.dispose(); }
}

export function levelName(key: string) {
  if (key === "daily") return t("daily_name", { d: String(today() % 1000) });
  if (key.startsWith("custom")) return t("custom");
  if (key === "tutorial") return t("tutorial");
  const [w, n] = key.split("-");
  return `${t("world" + w).replace(/^The /, "")} · ${n}`;
}
export function rewardLabel(tier: { coins?: number; gems?: number; skin?: string }) {
  const parts: string[] = [];
  if (tier.coins) parts.push(t("reward_coins", { n: String(tier.coins) }));
  if (tier.gems) parts.push(t("reward_gems", { n: String(tier.gems) }));
  if (tier.skin) parts.push(t("reward_robot", { n: t("sk_" + tier.skin) }));
  return parts.join(" · ");
}
