/**
 * Home: the Sanctuary key art with the wordmark over the sky, the chamber you
 * are on in a glass card, the daily and the pass as slim rows, RESUME, and
 * the tab bar.
 */
import { Container, Sprite, Texture, Graphics, Text } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout } from "../scenes";
import { W, H, C } from "../theme";
import { state, L, today } from "../state";
import { panel, button, progressBar, display, body, roundKey, logoStyle, tapOnce } from "../ui";
import { TopBar, TabBar, iconSprite, TOP_H } from "../widgets";
import { audio, buzz } from "../audio";
import { t, chamberTitle, objectiveFor } from "../i18n";
import { MapScene } from "./map";
import { LevelScene } from "./level";
import { PassScene } from "./pass";
import { DailyScene } from "./daily";
import { TUTORIAL_LEVEL } from "../tutorial";

/** Where the robot's feet are in the key art (image pixels); the card stack sits just below them. */
const ART_FEET = 1300;

export class HomeScene extends Scene {
  private bg!: Sprite; private fog!: Graphics; private ui!: Container; private tabs!: TabBar; private top!: TopBar; private time = 0; private sweep!: Graphics;
  private logo!: Container; private logoEcho!: Text;
  private card!: Container; private cardEyebrow!: Text; private cardTitle!: Text; private cardObj!: Text; private cardCap!: Text; private cardSw!: Text;
  private rows!: Container; private dailyTitle!: Text; private dailySub!: Text; private passSub!: Text; private passBar!: Container;
  private play!: Container; private playLbl!: Text; private howTo!: Container; private unsub = () => {};

  build() {
    const ink = new Graphics(); ink.rect(-W, -2000, W * 3, 8000).fill({ color: C.ink }); this.addChild(ink);
    this.bg = new Sprite(Texture.from("bg_title")); this.bg.anchor.set(0.5, 0); this.addChild(this.bg);
    this.fog = new Graphics(); this.addChild(this.fog);
    this.sweep = new Graphics(); this.sweep.rect(0, 0, W, 200).fill({ color: C.mint, alpha: 0.08 }); this.sweep.rect(0, 196, W, 4).fill({ color: 0xdcfaff, alpha: 0.5 }); this.sweep.alpha = 0; this.addChild(this.sweep);
    this.ui = new Container(); this.addChild(this.ui);
    this.top = new TopBar(); this.addChild(this.top);
    this.tabs = new TabBar("home"); this.addChild(this.tabs);
    this.buildUi();
    this.unsub = state.on(() => this.refresh());
    audio.musicOn(false);
    // a scan of light crosses the sanctuary every few seconds
    gsap.timeline({ repeat: -1, repeatDelay: 5 }).set(this.sweep, { y: -300, alpha: 1 }).to(this.sweep, { y: H + 100, duration: 1.6, ease: "power2.in" }).set(this.sweep, { alpha: 0 });
  }
  private buildUi() {
    // Wordmark: thin wide capitals, a cyan echo drifting behind.
    this.logo = new Container();
    this.logoEcho = new Text({ text: "ECHO", style: logoStyle(150, C.mint) }); this.logoEcho.anchor.set(0.5); this.logoEcho.alpha = 0.22; this.logoEcho.position.set(-10, 8); this.logo.addChild(this.logoEcho);
    const face = new Text({ text: "ECHO", style: logoStyle(150, C.cream) }); face.anchor.set(0.5); face.style.dropShadow = { color: 0x000000, alpha: 0.45, blur: 14, distance: 6, angle: Math.PI / 2 }; this.logo.addChild(face);
    const tag = new Text({ text: t("tagline").toUpperCase(), style: display(24, C.cream, true, true) }); tag.anchor.set(0.5); tag.y = 118; tag.alpha = 0.9; this.logo.addChild(tag);
    const rule = new Graphics(); rule.rect(-120, 150, 240, 1.5).fill({ color: C.mint, alpha: 0.8 }); this.logo.addChild(rule);
    this.ui.addChild(this.logo);
    gsap.to(this.logoEcho, { x: -22, y: 14, duration: 2.4, yoyo: true, repeat: -1, ease: "sine.inOut" });

    // The chamber card: chapter, chamber, objective, capacity and switches.
    this.card = new Container(); const cw = 960, ch = 200;
    this.card.addChild(panel(cw, ch, { radius: 22, glow: C.mint }));
    this.cardEyebrow = new Text({ text: "", style: display(22, C.mint, true, false) }); this.cardEyebrow.position.set(36, 26); this.card.addChild(this.cardEyebrow);
    this.cardTitle = new Text({ text: "", style: display(50, C.cream, true, false) }); this.cardTitle.position.set(36, 56); this.card.addChild(this.cardTitle);
    this.cardObj = new Text({ text: "", style: body(24, C.lilac, 500) }); this.cardObj.style.wordWrap = true; this.cardObj.style.wordWrapWidth = 600; this.cardObj.position.set(36, 128); this.card.addChild(this.cardObj);
    const col = (y: number, key: string) => { const l = new Text({ text: t(key).toUpperCase(), style: display(16, C.lilac, true, false) }); l.anchor.set(1, 0); l.position.set(cw - 36, y); this.card.addChild(l); const v = new Text({ text: "", style: display(40, C.cream, false, false) }); v.anchor.set(1, 0); v.position.set(cw - 36, y + 18); this.card.addChild(v); return v; };
    this.cardCap = col(28, "echo_capacity"); this.cardSw = col(112, "switches");
    tapOnce(this.card, () => { audio.play("tap", 0.5); Scenes.go(new MapScene()); });
    this.ui.addChild(this.card);

    // Today: the daily chamber and the pass, as two slim rows.
    this.rows = new Container(); this.ui.addChild(this.rows);
    const rw = 470, rh = 96;
    const daily = new Container(); daily.addChild(panel(rw, rh, { radius: 16 }));
    const dIcon = iconSprite("cal", 52); dIcon.position.set(48, rh / 2); daily.addChild(dIcon);
    this.dailyTitle = new Text({ text: "", style: display(26, C.cream, true, false) }); this.dailyTitle.position.set(88, 20); daily.addChild(this.dailyTitle);
    this.dailySub = new Text({ text: "", style: body(20, C.lilac, 500) }); this.dailySub.position.set(88, 54); daily.addChild(this.dailySub);
    tapOnce(daily, () => { audio.play("tap", 0.5); Scenes.push(new DailyScene()); });
    this.rows.addChild(daily);
    const pass = new Container(); pass.x = rw + 20; pass.addChild(panel(rw, rh, { radius: 16 }));
    const pIcon = iconSprite("chest", 56); pIcon.position.set(48, rh / 2); pass.addChild(pIcon);
    const pTitle = new Text({ text: t("next_reward").toUpperCase(), style: display(26, C.cream, true, false) }); pTitle.position.set(88, 20); pass.addChild(pTitle);
    this.passSub = new Text({ text: "", style: body(20, C.lilac, 500) }); this.passSub.position.set(88, 54); pass.addChild(this.passSub);
    this.passBar = progressBar(130, 6, 0); this.passBar.position.set(rw - 160, rh / 2 - 3); pass.addChild(this.passBar);
    tapOnce(pass, () => { audio.play("tap", 0.5); Scenes.push(new PassScene()); });
    this.rows.addChild(pass);

    // Resume.
    this.play = button({ w: 960, h: 136, label: t("play"), kind: "primary", size: 46, onTap: () => { audio.play("tap", 0.6); buzz("medium"); if (!state.flag("tut")) { Scenes.push(new LevelScene(TUTORIAL_LEVEL, "tutorial")); return; } const n = state.nextLevel(); if (n) Scenes.push(new LevelScene(n, n.id)); else Scenes.go(new MapScene()); } });
    this.playLbl = (this.play.children[1] as Container).children[0] as Text;
    this.ui.addChild(this.play);
    const chev = new Text({ text: "›", style: display(60, C.mint, false, false) }); chev.anchor.set(1, 0.5); chev.position.set(440, 2); (this.play.children[1] as Container).addChild(chev);
    this.howTo = roundKey(84, "ghost", iconSprite("info", 44), () => { audio.play("tap", 0.5); Scenes.push(new LevelScene(TUTORIAL_LEVEL, "tutorial")); }); this.ui.addChild(this.howTo);
    this.refresh();
  }
  refresh() {
    const p = state.profile; if (!p) return;
    this.top.refresh();
    const dk = `daily-${today()}`, best = p.best[dk];
    this.dailyTitle.text = t("daily_name", { d: String(today() % 1000) }).toUpperCase();
    this.dailySub.text = best ? `★${p.stars[dk] || 1} · ${best.echoes} ${t("echoes_used")} · ${best.ticks} ${t("moves")}` : p.streak ? t("streak", { n: String(p.streak) }) : t("daily_open");
    const next = L.PASS_TIERS[p.claimedTiers];
    this.passSub.text = next ? `${rewardLabel(next)} · ${Math.max(0, next.xp - p.passXp)} XP` : t("all_claimed");
    (this.passBar as any).set(next ? p.passXp / Math.max(1, next.xp) : 1);
    // the chamber card follows progress
    const nl = state.nextLevel(), lvl = nl ?? L.LEVELS[L.LEVELS.length - 1]!, w = L.WORLDS.find((x) => x.id === lvl.world) ?? L.WORLDS[0]!;
    this.cardEyebrow.text = `${t("chapter_n", { n: String(w.id).padStart(2, "0") })} · ${t("world" + w.id)}`.toUpperCase();
    this.cardTitle.text = (nl ? chamberTitle(nl.id) : t("all_clear")).toUpperCase();
    this.cardObj.text = nl ? objectiveFor(nl) : t("world_intro" + w.id);
    this.cardCap.text = String(L.MAX_ECHOES);
    this.cardSw.text = String(new Set(lvl.map.join("").split("").filter((c) => "abc".includes(c))).size);
    this.playLbl.text = (!state.flag("tut") ? t("play") : L.totalStars(p) > 0 && nl ? t("resume") : t("play")).toUpperCase();
  }
  relayout() {
    const vis = layout.bottom, top = layout.safeTop, sb = layout.safeBottom;
    this.top.relayout(top); this.tabs.relayout(vis, sb);
    const tabsTop = this.tabs.y;
    this.play.position.set(W / 2, tabsTop - 24 - 68);
    const rowsY = tabsTop - 24 - 136 - 20 - 96; this.rows.position.set(60, rowsY);
    const cardY = rowsY - 20 - 200; this.card.position.set(60, cardY);
    // The key art fills the screen; the robot stands just above the card.
    const tw = this.bg.texture.width, th = this.bg.texture.height, s = Math.max(W / tw, (vis / th) * 1.1); this.bg.scale.set(s);
    this.bg.position.set(W / 2, Math.min(0, cardY - 24 - ART_FEET * s));
    this.fog.clear();
    for (let i = 0; i < 20; i++) { const y0 = cardY - 240 + (i * 240) / 20; this.fog.rect(0, y0, W, 240 / 20 + 1).fill({ color: C.ink, alpha: 0.55 * Math.pow(i / 20, 1.5) }); }
    this.fog.rect(0, cardY, W, vis - cardY + 200).fill({ color: C.ink, alpha: 0.55 });
    for (let i = 0; i < 16; i++) this.fog.rect(0, top - 200 + i * 36, W, 37).fill({ color: C.ink, alpha: 0.6 * Math.pow(1 - i / 16, 1.3) });
    this.logo.position.set(W / 2, top + 300);
    this.howTo.position.set(70, top + TOP_H + 70);
  }
  tick(dt: number) { this.time += dt; this.logoEcho.alpha = 0.18 + Math.sin(this.time * 1.7) * 0.08; }
  dispose() { this.unsub(); super.dispose(); }
}

export function levelName(key: string) {
  if (key === "daily") return t("daily_name", { d: String(today() % 1000) });
  if (key.startsWith("custom")) return t("custom");
  if (key === "tutorial") return t("tutorial");
  return chamberTitle(key);
}
export function rewardLabel(tier: { coins?: number; gems?: number; skin?: string }) {
  const parts: string[] = [];
  if (tier.coins) parts.push(t("reward_coins", { n: String(tier.coins) }));
  if (tier.gems) parts.push(t("reward_gems", { n: String(tier.gems) }));
  if (tier.skin) parts.push(t("reward_robot", { n: t("sk_" + tier.skin) }));
  return parts.join(" · ");
}
