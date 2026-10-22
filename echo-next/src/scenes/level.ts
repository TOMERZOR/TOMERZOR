/**
 * The room. Rules run in logic.js; this scene draws the board in painted
 * tiles, turns swipes and taps into beats, tweens every hop, shows where
 * drones land next, and runs the loop → echo → clear flow.
 */
import { Container, Sprite, Texture, Text, Graphics, FederatedPointerEvent } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout, killTweensDeep } from "../scenes";
import { W, C } from "../theme";
import { panel, button, roundKey, pill, display, body, scrim } from "../ui";
import { iconSprite, heroSprite, echoSprite, starRow, toast } from "../widgets";
import { state, L, S, today } from "../state";
import type { Level, Run } from "../logic-types";
import { audio, buzz } from "../audio";
import { t } from "../i18n";
import { dialog } from "./dialog";
import { MapScene } from "./map";
import { ShopScene } from "./shop";
import { showAd } from "./ads";
import { levelName } from "./home";

const REPEAT_MS = 175, REPLAY_MS = 260, BEAT_MS = 150, SWIPE = 20;
const KEYS: Record<string, number> = { ArrowUp: 1, KeyW: 1, ArrowRight: 3, KeyD: 3, ArrowDown: 5, KeyS: 5, ArrowLeft: 7, KeyA: 7 };
const WAIT_KEYS = new Set(["Space", "Period", "KeyX"]);
const fails: Record<string, number> = {};
const easeOut = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
/** A cheap deep-enough copy of a run for look-ahead (structuredClone is slow on some phones). */
const cloneRun = (r: Run): Run => ({ ...r, actors: r.actors.map((a) => ({ ...a })), coins: r.coins.map((c) => ({ ...c })), doors: { ...r.doors }, plates: { ...r.plates }, drones: r.drones.map((d) => ({ ...d })), events: [] });

interface Snap { actors: { x: number; y: number }[]; drones: { x: number; y: number }[] }

export class LevelScene extends Scene {
  // state
  private logs: string[] = []; private run!: Run; private recording = ""; private playing = false; private gen = 0;
  private beatT0 = -1e9; private prev: Snap | null = null; private queued: number | null = null; private auto: { log: string; i: number; end: boolean } | null = null;
  private danger: { tick: number; gen: number; cells: { x: number; y: number; wait: boolean }[] } | null = null;
  private heldKey: string | null = null; private touch = { id: -1, x0: 0, y0: 0, t0: 0, dir: 0, moved: false };
  private time = 0; private shakeN = 0; private hintUntil = -1; private freeze = 0;
  // display
  private bg!: Sprite; private board!: Container; private frame!: Graphics; private floor!: Container; private items!: Container; private actors!: Container; private fx!: Container; private overlayG!: Graphics;
  private cs = 100; private flash!: Graphics;
  private heroSp!: Sprite; private echoSps: Sprite[] = []; private droneSps: Sprite[] = []; private ghostSps: Sprite[] = []; private coinSps = new Map<string, Sprite>();
  private plateSps = new Map<string, Sprite>(); private doorSps = new Map<string, { open: Sprite; closed: Sprite }>(); private exitSp!: Sprite; private exitGlow!: Graphics;
  private dangerSps: Container[] = []; private hintSp!: Sprite;
  private dial!: Container; private dialArc!: Graphics; private dialNum!: Text; private dots: Graphics[] = []; private coinPill!: Container; private nameT!: Text;
  private banner!: Container; private bannerT!: Text; private bannerS!: Text; private controls!: Container; private hud!: Container;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e); private keyUp = (e: KeyboardEvent) => { if (e.code === this.heldKey) this.heldKey = null; };

  constructor(private level: Level, private key: string) { super(); }

  build() {
    const world = L.WORLDS.find((w) => w.id === this.level.world) ?? L.WORLDS[0]!;
    this.bg = new Sprite(Texture.from(world.bg)); this.bg.anchor.set(0.5); this.addChild(this.bg);
    const dark = new Graphics(); dark.rect(-W, -1000, W * 3, 6000).fill({ color: C.ink, alpha: 0.22 }); this.addChild(dark);
    // input surface
    const hit = new Graphics(); hit.rect(-W, -1000, W * 3, 6000).fill({ color: 0xffffff, alpha: 0.001 }); this.addChild(hit);
    this.eventMode = "static";
    this.on("pointerdown", (e) => this.onDown(e)); this.on("globalpointermove", (e) => this.onMove(e)); this.on("pointerup", (e) => this.onUp(e)); this.on("pointerupoutside", (e) => this.onUp(e)); this.on("pointercancel", (e) => this.onUp(e));
    window.addEventListener("keydown", this.keyHandler); window.addEventListener("keyup", this.keyUp);

    this.board = new Container(); this.addChild(this.board);
    this.frame = new Graphics(); this.board.addChild(this.frame);
    this.floor = new Container(); this.items = new Container(); this.actors = new Container(); this.fx = new Container(); this.overlayG = new Graphics();
    this.board.addChild(this.floor, this.items, this.actors, this.fx);
    this.flash = new Graphics(); this.flash.rect(-W, -1000, W * 3, 6000).fill({ color: C.coral }); this.flash.alpha = 0; this.addChild(this.flash);
    this.buildHud(); this.buildControls(); this.buildBanner();
    this.buildBoard();
    this.startLevel();
  }

  // ── HUD ──────────────────────────────────────────────────────────────────
  private buildHud() {
    this.hud = new Container(); this.addChild(this.hud);
    const back = roundKey(96, "ghost", iconSprite("back", 50), () => this.quit()); back.position.set(80, 0); this.hud.addChild(back);
    this.dial = new Container(); const d = new Graphics();
    d.circle(0, 10, 118).fill({ color: 0x000000, alpha: 0.45 }); d.circle(0, 0, 118).fill({ color: C.metal }); d.circle(0, 0, 108).fill({ color: C.metalDark }); d.circle(0, 0, 96).fill({ color: 0x1b2535 }); d.circle(0, -30, 70).fill({ color: 0xffffff, alpha: 0.05 });
    this.dial.addChild(d); this.dialArc = new Graphics(); this.dial.addChild(this.dialArc);
    this.dialNum = new Text({ text: "20", style: display(84, C.cream, false, false) }); this.dialNum.anchor.set(0.5); this.dial.addChild(this.dialNum);
    this.hud.addChild(this.dial);
    this.coinPill = pill(200, 72, "0", iconSprite("coin", 56)); this.coinPill.position.set(W - 230, -36); this.hud.addChild(this.coinPill);
    this.nameT = new Text({ text: levelName(this.key), style: body(26, C.lilac, 800) }); this.nameT.anchor.set(0.5); this.hud.addChild(this.nameT);
    // echo dots
    const strip = new Graphics(); strip.roundRect(-290, -42, 580, 84, 42).fill({ color: 0x000000, alpha: 0.4 }); strip.roundRect(-290, -42, 580, 84, 42).stroke({ color: 0xffffff, alpha: 0.12, width: 2 }); strip.label = "strip"; this.hud.addChild(strip);
    for (let i = 0; i <= L.MAX_ECHOES; i++) { const g = new Graphics(); g.label = "dot"; this.hud.addChild(g); this.dots.push(g); }
  }
  private drawDots() {
    this.dots.forEach((g, i) => {
      const on = i < this.logs.length, hero = i === this.logs.length;
      g.clear(); g.circle(0, 4, 30).fill({ color: 0x000000, alpha: 0.5 }); g.circle(0, 0, 30).fill({ color: on ? C.mint : hero ? C.orange : 0x2a2140 });
      if (on || hero) g.circle(-6, -8, 12).fill({ color: 0xffffff, alpha: 0.35 }); else g.circle(0, 0, 30).stroke({ color: 0xffffff, alpha: 0.1, width: 2 });
    });
  }
  private drawDial() {
    const left = Math.max(0, L.LOOP_TICKS - (this.run?.tick ?? 0)), f = left / L.LOOP_TICKS;
    this.dialArc.clear(); this.dialArc.circle(0, 0, 90).stroke({ color: 0x000000, alpha: 0.35, width: 14 });
    if (f > 0) this.dialArc.arc(0, 0, 90, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f).stroke({ color: left <= 3 ? C.coral : C.mint, width: 14, cap: "round" });
    this.dialNum.text = String(left); this.dialNum.style.fill = left <= 3 ? C.coral : C.cream;
  }
  private buildControls() {
    this.controls = new Container(); this.addChild(this.controls);
    const mk = (x: number, icon: string, lbl: string, fn: () => void) => { const k = roundKey(130, "mint", iconSprite(icon, 64), fn); k.position.set(x, 0); this.controls.addChild(k); const l = new Text({ text: lbl.toUpperCase(), style: display(26, C.cream, true) }); l.anchor.set(0.5); l.position.set(x, 100); this.controls.addChild(l); };
    mk(120, "undo", t("undo"), () => { if (this.canControl() && this.recording.length) this.rewind(1); });
    mk(290, "restart", t("restart"), () => { if (this.canControl()) { audio.play("tap", 0.5); this.startLoop(); } });
    mk(W - 120, "bulb", t("hint"), () => this.hint());
    this.hintTag = new Container(); this.hintTag.position.set(W - 120, -78); this.controls.addChild(this.hintTag);
    // the big END LOOP key
    const end = new Container(); const d = 270, g = new Graphics();
    g.circle(0, 12, d / 2).fill({ color: C.mintDark }); g.circle(0, 0, d / 2).fill({ color: C.mint }); g.circle(0, -14, d * 0.4).fill({ color: 0xbdfde6, alpha: 0.7 }); g.ellipse(0, -62, 70, 22).fill({ color: 0xffffff, alpha: 0.45 }); g.circle(0, 0, d / 2).stroke({ color: 0x000000, alpha: 0.2, width: 3 });
    end.addChild(g);
    const l1 = new Text({ text: t("end_loop").toUpperCase(), style: display(50, 0x16302a, true, false) }); l1.anchor.set(0.5); l1.style.wordWrap = true; l1.style.wordWrapWidth = 220; l1.style.align = "center"; l1.style.lineHeight = 52; l1.y = -4; end.addChild(l1);
    end.eventMode = "static"; end.cursor = "pointer"; let y0 = 0;
    end.on("pointerdown", (e) => { y0 = e.global.y; gsap.to(end.scale, { x: 0.93, y: 0.93, duration: 0.08 }); });
    const up = (e: FederatedPointerEvent, fire: boolean) => { gsap.to(end.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(2)" }); if (fire && Math.abs(e.global.y - y0) < 20) this.endLoopNow(); };
    end.on("pointerup", (e) => up(e, true)); end.on("pointerupoutside", (e) => up(e, false));
    end.position.set(W / 2, -10); this.controls.addChild(end);
  }
  private hintTag!: Container;
  private freeHelp() { return this.key === "tutorial" || this.key === "1-1" || this.key === "1-2"; }
  private drawHintTag() {
    this.hintTag.removeChildren().forEach((c) => c.destroy({ children: true }));
    const free = this.freeHelp(); const g = new Graphics(); const w = free ? 110 : 120;
    g.roundRect(-w / 2, -24, w, 48, 24).fill({ color: free ? C.mint : C.gold }); g.roundRect(-w / 2, -24, w, 48, 24).stroke({ color: 0x000000, alpha: 0.25, width: 2 }); this.hintTag.addChild(g);
    if (free) { const tx = new Text({ text: t("free_tag"), style: display(24, 0x16302a, true, false) }); tx.anchor.set(0.5); this.hintTag.addChild(tx); }
    else { const ic = iconSprite("coin", 36); ic.x = -30; this.hintTag.addChild(ic); const tx = new Text({ text: String(L.PRICES.hint), style: display(28, 0x3a2400, false, false) }); tx.anchor.set(0, 0.5); tx.x = -8; this.hintTag.addChild(tx); }
  }
  private buildBanner() {
    this.banner = new Container(); this.banner.alpha = 0; this.addChild(this.banner);
    const bgG = new Graphics(); bgG.label = "bg"; this.banner.addChild(bgG);
    this.bannerT = new Text({ text: "", style: display(60, C.cream, true) }); this.bannerT.anchor.set(0.5); this.banner.addChild(this.bannerT);
    this.bannerS = new Text({ text: "", style: body(28, C.mint, 800) }); this.bannerS.anchor.set(0.5, 0); this.bannerS.style.wordWrap = true; this.bannerS.style.wordWrapWidth = 880; this.bannerS.style.align = "center"; this.banner.addChild(this.bannerS);
  }
  private bannerTl: gsap.core.Timeline | null = null;
  private showBanner(title: string, sub: string, ms: number) {
    this.bannerT.text = title; this.bannerS.text = sub; this.bannerS.y = 36;
    const bgG = this.banner.getChildByLabel("bg") as Graphics; const w = Math.max(this.bannerT.width, sub ? this.bannerS.width : 0) + 120, h = 110 + (sub ? this.bannerS.height + 14 : 0);
    bgG.clear(); bgG.roundRect(-w / 2, -58, w, h, 34).fill({ color: C.ink, alpha: 0.9 }); bgG.roundRect(-w / 2, -58, w, h, 34).stroke({ color: C.mint, alpha: 0.5, width: 3 });
    this.bannerTl?.kill(); this.banner.scale.set(0.8);
    this.bannerTl = gsap.timeline().to(this.banner, { alpha: 1, duration: 0.15 }).to(this.banner.scale, { x: 1, y: 1, duration: 0.35, ease: "back.out(1.8)" }, 0).to(this.banner, { alpha: 0, duration: 0.3, delay: ms / 1000 });
  }

  // ── board ────────────────────────────────────────────────────────────────
  private buildBoard() {
    const m = this.level.map, cs = 100; this.cs = cs; // drawn at 100 units per cell, scaled in relayout
    const tile = (name: string, x: number, y: number, parent = this.floor) => { const s = new Sprite(Texture.from(name)); s.width = s.height = cs; s.position.set(x * cs, y * cs); parent.addChild(s); return s; };
    const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    // Floor: beveled plum stone, drawn as vectors so the grid reads crisply at any size.
    const fl = new Graphics(); this.floor.addChild(fl);
    fl.rect(0, 0, L.COLS * cs, L.ROWS * cs).fill({ color: 0x2a1c35 });
    for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
      const ch = m[y]![x]!;
      if (ch === "#") continue;
      const v = (hash(x, y) % 5) * 0.012, base = 0x5c3f68, r = ((base >> 16) & 255), g = ((base >> 8) & 255), bl = base & 255;
      const col = (Math.round(r * (1 - v)) << 16) | (Math.round(g * (1 - v)) << 8) | Math.round(bl * (1 - v));
      fl.roundRect(x * cs + 3, y * cs + 3, cs - 6, cs - 6, 10).fill({ color: col });
      fl.roundRect(x * cs + 3, y * cs + 3, cs - 6, (cs - 6) * 0.5, 10).fill({ color: 0xffffff, alpha: 0.05 });
      fl.roundRect(x * cs + 3, y * cs + 3, cs - 6, cs - 6, 10).stroke({ color: 0xffffff, alpha: 0.07, width: 2 });
      fl.rect(x * cs + 6, y * cs + cs - 8, cs - 12, 4).fill({ color: 0x000000, alpha: 0.18 });
      if (y > 0 && m[y - 1]![x] === "#") fl.rect(x * cs + 3, y * cs + 3, cs - 6, cs * 0.3).fill({ color: 0x000000, alpha: 0.22 });
    }
    for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
      const ch = m[y]![x]!;
      if (ch === "#") { tile("wall_top", x, y); continue; }
      if ("abc".includes(ch)) { const s = tile("plate_off", x, y, this.items); this.plateSps.set(ch, s); }
      if ("ABC".includes(ch)) { const closed = tile("gate_closed", x, y, this.items), open = tile("gate_open", x, y, this.items); open.alpha = 0; this.doorSps.set(ch, { open, closed }); }
      if (ch === "E") { this.exitGlow = new Graphics(); this.exitGlow.circle(0, 0, cs * 0.62).fill({ color: C.gold, alpha: 0.28 }); this.exitGlow.position.set((x + 0.5) * cs, (y + 0.5) * cs); this.items.addChild(this.exitGlow); this.exitSp = tile("exit_t", x, y, this.items); this.exitSp.anchor.set(0.5); this.exitSp.position.set((x + 0.5) * cs, (y + 0.5) * cs); }
    }
    // stone frame around the room
    const fw = L.COLS * cs, fh = L.ROWS * cs;
    this.frame.roundRect(-30, -22, fw + 60, fh + 76, 44).fill({ color: 0x2b1f3a, alpha: 0.9 });
    this.frame.roundRect(-30, -30, fw + 60, fh + 60, 44).fill({ color: 0xa88cb8 });
    this.frame.roundRect(-30, -30, fw + 60, (fh + 60) * 0.5, 44).fill({ color: 0xffffff, alpha: 0.08 });
    this.frame.roundRect(-30, -30, fw + 60, fh + 60, 44).stroke({ color: 0x000000, alpha: 0.25, width: 4 });
    this.hintSp = new Sprite(Texture.from("arrow")); this.hintSp.anchor.set(0.5); this.hintSp.width = this.hintSp.height = cs * 0.8; this.hintSp.visible = false; this.items.addChild(this.hintSp);
  }
  private syncActors() {
    this.actors.removeChildren().forEach((c) => { killTweensDeep(c as Container); c.destroy(); });
    // Old forecast ghosts and danger marks go first; the new ones are made below.
    for (const g of this.ghostSps) if (!g.destroyed) g.destroy();
    for (const d of this.dangerSps) if (!d.destroyed) d.destroy({ children: true });
    this.dangerSps = []; this.danger = null;
    this.echoSps = []; this.droneSps = []; this.ghostSps = [];
    const skin = state.skin(), cs = this.cs;
    for (let i = 0; i < this.run.actors.length - 1; i++) { const e = echoSprite(skin); e.width = cs * 0.92; e.scale.y = e.scale.x; e.anchor.set(0.5, 0.92); this.actors.addChild(e); this.echoSps.push(e); }
    for (const _ of this.run.drones) { const g = new Sprite(Texture.from("drone")); g.anchor.set(0.5, 0.6); g.width = cs * 0.8; g.scale.y = g.scale.x; g.alpha = 0.32; this.items.addChild(g); this.ghostSps.push(g); }
    this.heroSp = heroSprite(skin); this.heroSp.width = cs * 0.96; this.heroSp.scale.y = this.heroSp.scale.x; this.heroSp.anchor.set(0.5, 0.92); this.actors.addChild(this.heroSp);
    for (const _ of this.run.drones) { const d = new Sprite(Texture.from("drone")); d.anchor.set(0.5, 0.6); d.width = cs * 0.86; d.scale.y = d.scale.x; this.actors.addChild(d); this.droneSps.push(d); }
    // coins
    for (const s of this.coinSps.values()) { gsap.killTweensOf(s); if (!s.destroyed) s.destroy(); } this.coinSps.clear();
    for (const c of this.run.coins) { const s = new Sprite(Texture.from("coin_t")); s.anchor.set(0.5); s.width = s.height = cs * 0.62; s.position.set((c.x + 0.5) * cs, (c.y + 0.5) * cs); this.items.addChild(s); this.coinSps.set(`${c.x},${c.y}`, s); gsap.to(s, { y: (c.y + 0.42) * cs, duration: 0.8 + Math.random() * 0.4, yoyo: true, repeat: -1, ease: "sine.inOut" }); }
    this.syncStatic();
  }
  /** Plates, doors, coins to the run's truth (after a rewind or a restart). */
  private syncStatic() {
    for (const [k, s] of this.plateSps) s.texture = Texture.from(this.run.plates[k] ? "plate_on" : "plate_off");
    for (const [k, d] of this.doorSps) { const open = !!this.run.doors[k]; d.open.alpha = open ? 1 : 0; d.closed.alpha = open ? 0 : 1; }
    for (const c of this.run.coins) { const s = this.coinSps.get(`${c.x},${c.y}`); if (s) s.visible = !c.taken; }
    (this.coinPill as any).setValue(String(this.run.taken));
    this.drawDial(); this.drawDots();
  }

  relayout() {
    const top = layout.safeTop, bottom = layout.bottom, sb = layout.safeBottom;
    this.bg.position.set(W / 2, bottom / 2); const s = Math.max(W / this.bg.texture.width, bottom / this.bg.texture.height); this.bg.scale.set(s);
    this.hud.y = top + 130; this.dial.position.set(W / 2, 0); this.nameT.position.set(W / 2, 150);
    const strip = this.hud.getChildByLabel("strip")!; strip.position.set(W / 2, 230); this.dots.forEach((d, i) => d.position.set(W / 2 + (i - 3) * 80, 230));
    const boardTop = top + 420, ctrlH = 300 + sb;
    this.controls.position.set(0, bottom - sb - 190);
    const availH = bottom - boardTop - ctrlH, cell = Math.min((W - 90) / L.COLS, availH / L.ROWS);
    const k = cell / 100; this.board.scale.set(k);
    this.board.position.set((W - L.COLS * cell) / 2, boardTop + (availH - L.ROWS * cell) / 2);
    // The banner sits over the HUD, never over the room.
    this.banner.position.set(W / 2, top + 250);
  }

  // ── flow ─────────────────────────────────────────────────────────────────
  private coach: Container | null = null;
  /** First room only: an arrow that keeps gliding in the direction of the first move until the player makes one. */
  private showCoach() {
    if (this.coach || this.key !== "1-1") return;
    const c = new Container(); const ar = new Sprite(Texture.from("arrow")); ar.anchor.set(0.5); ar.width = ar.height = this.cs * 0.9; ar.rotation = Math.PI / 2; c.addChild(ar);
    const ring = new Graphics(); ring.circle(0, 0, this.cs * 0.36).stroke({ color: C.cream, alpha: 0.9, width: 6 }); ring.circle(0, 0, this.cs * 0.14).fill({ color: C.cream, alpha: 0.9 }); c.addChild(ring);
    const start = this.run.actors[this.run.actors.length - 1]!; c.position.set((start.x + 0.5) * this.cs, (start.y + 0.5) * this.cs);
    this.items.addChild(c); this.coach = c;
    gsap.timeline({ repeat: -1, repeatDelay: 0.4 }).set(ring, { y: -this.cs * 0.2, alpha: 1 }).set(ar, { alpha: 0 }).to(ring, { y: this.cs * 1.4, duration: 0.7, ease: "power1.inOut" }).to(ar, { alpha: 1, duration: 0.2 }, 0.2).to(ar, { y: this.cs * 0.9, duration: 0.6, ease: "power1.inOut" }, 0.1).to([ring, ar], { alpha: 0, duration: 0.25 });
  }
  private hideCoach() { if (!this.coach) return; killTweensDeep(this.coach); this.coach.destroy({ children: true }); this.coach = null; }
  private startLevel() {
    this.logs = []; this.playing = true;
    this.drawHintTag();
    this.startLoop();
    this.showCoach();
    this.showBanner(t("loop_n", { n: 1 }), this.hintFor(), 3800);
    audio.musicOn(true);
  }
  private hintFor() {
    if (this.key === "1-1") return t("hint_move");
    if (this.key === "1-2") return t("hint_plate");
    if (this.key === "2-1") return t("hint_drone");
    if (this.key === "3-1") return t("hint_mirror");
    return t("hint_generic");
  }
  private later(ms: number, fn: () => void) { const g = this.gen; setTimeout(() => { if (this.playing && this.gen === g && !this.destroyed) fn(); }, ms); }
  private startLoop() {
    this.gen += 1; this.recording = ""; this.run = L.createRun(this.level, [...this.logs, ""]);
    this.prev = null; this.queued = null; this.beatT0 = -1e9; this.auto = null; this.danger = null; this.hintUntil = -1; this.hintSp.visible = false; this.clearPeek(true);
    this.syncActors();
    if (this.logs.length) this.showBanner(t("loop_n", { n: this.logs.length + 1 }), t("loop_sub"), 900);
    audio.play("tick", 0.4, 1 + this.logs.length * 0.08);
  }
  private loopEnded() {
    if (this.logs.length >= L.MAX_ECHOES) {
      this.showBanner(t("out_of_echoes"), t("out_sub"), 1400); audio.play("out"); this.shake(10); buzz("heavy"); setTimeout(() => buzz("error"), 120); this.noteFail();
      this.logs = []; this.drawDots(); this.later(1300, () => this.startLoop()); return;
    }
    this.logs.push(this.recording);
    this.showBanner(t("loop_saved", { n: this.logs.length }), t("loop_sub"), 1300); audio.play("saved", 0.7); buzz("medium");
    // the hero freezes into a hologram
    gsap.to(this.heroSp, { alpha: 0.5, duration: 0.4, yoyo: true, repeat: 1 });
    this.later(950, () => this.startLoop());
  }
  private endLoopNow() {
    const run = this.run; if (!this.canControl() || run.tick < 1) return;
    run.tick = L.LOOP_TICKS; this.drawDial(); audio.play("tap", 0.5); buzz("medium"); this.loopEnded();
  }
  private loopFailed() {
    this.showBanner(t("caught"), t("caught_sub"), 1200); audio.play("caught"); this.shake(14); buzz("error"); this.noteFail();
    this.flash.alpha = 0.45; gsap.to(this.flash, { alpha: 0, duration: 0.5 }); this.freeze = 0.09;
    gsap.fromTo(this.heroSp, { tint: 0xff6b6b }, { tint: 0xffffff, duration: 0.7 });
    this.later(800, () => this.offerContinue());
  }
  /** After a drone: pick up from the move before (ad, coins, or free without ads) or restart the loop. */
  private offerContinue() {
    if (!this.playing || !this.run?.dead) return;
    const p = state.profile, price = L.PRICES.continue, free = p.noads || this.key === "tutorial";
    const buttons: { label: string; sub?: string; kind?: "primary" | "secondary" | "ghost" | "mint"; onTap?: () => void }[] = [];
    if (free) buttons.push({ label: t("continue_free"), sub: t("free_tag"), kind: "mint", onTap: () => this.rewind(1) });
    else buttons.push({ label: t("continue_ad"), sub: t("continue_free"), kind: "mint", onTap: () => showAd(() => { if (this.playing && this.run.dead) this.rewind(1); }) });
    buttons.push({ label: t("continue_coins", { n: price }), sub: t("continue_free"), kind: "primary", onTap: () => { const r = state.act({ t: "spend", what: "continue" }); if (!r.ok) { this.notEnough(() => this.offerContinue()); return; } audio.play("buy", 0.6); buzz("success"); this.rewind(1); } });
    buttons.push({ label: t("restart_loop"), kind: "ghost", onTap: () => this.startLoop() });
    dialog({ eyebrow: t("caught"), title: t("continue_q"), text: t("continue_sub"), buttons, dismiss: false });
  }
  private notEnough(back?: () => void) {
    dialog({ title: t("not_enough", { c: t("coins") }), text: t("get_coins_sub"), buttons: [{ label: t("cancel"), kind: "ghost", onTap: back }, { label: t("get_coins"), onTap: () => Scenes.go(new ShopScene()) }] });
  }
  private rewind(n: number) {
    if (!this.playing || !this.run || this.run.finished) return;
    const rec = this.recording.slice(0, Math.max(0, this.recording.length - n));
    const run = L.createRun(this.level, [...this.logs, ""]);
    for (const ch of rec) L.stepRun(run, ch.charCodeAt(0) - 48);
    run.events = []; this.run = run; this.recording = rec; this.prev = null; this.queued = null; this.beatT0 = -1e9; this.danger = null; this.clearPeek(true);
    this.syncStatic(); audio.play("tick", 0.5, 0.8); buzz("light");
  }
  private noteFail() {
    const n = (fails[this.key] = (fails[this.key] || 0) + 1);
    if (n === 3) this.later(1500, () => this.showBanner(t("tip"), t("tip_free"), 5200));
    if (n === 6 && S.SOLUTIONS[this.key]) this.later(1500, () => { if (this.canControl()) this.hint(); });
  }
  /** Hint key: a peek at the next three moves, or the whole loop played for you. Free in the first rooms, coins after. */
  private hint() {
    audio.play("tap", 0.5);
    if (!this.canControl()) return;
    const sol = S.SOLUTIONS[this.key] ? S.logsFor(S.SOLUTIONS[this.key]!) : null;
    if (!sol) { this.showBanner(t("hint_title"), this.hintFor(), 3200); return; }
    const free = this.freeHelp(), p = state.profile;
    dialog({ eyebrow: t("hint_title"), title: t("help_q"), text: free ? this.hintFor() : t("help_coins", { n: p.coins }), buttons: [
      { label: t("hint_peek"), sub: free ? t("free_tag") : t("continue_coins", { n: L.PRICES.hint }), kind: "mint", onTap: () => this.buyHelp("hint", sol) },
      { label: t("hint_auto"), sub: free ? t("free_tag") : t("continue_coins", { n: L.PRICES.loop }), kind: "secondary", onTap: () => this.buyHelp("loop", sol) },
      { label: t("cancel"), kind: "ghost" },
    ] });
  }
  private trimmed = (l: string) => l.replace(/0+$/, "");
  /** Where the player stands relative to the recorded solution. */
  private track(sol: string[]) {
    const li = this.logs.length;
    const loopsOk = li < sol.length && this.logs.every((l, i) => this.trimmed(l) === this.trimmed(sol[i]!));
    const thisOk = loopsOk && sol[li]!.startsWith(this.recording);
    return { li, loopsOk, thisOk };
  }
  private buyHelp(what: "hint" | "loop", sol: string[]) {
    const run = () => {
      if (!this.freeHelp()) { const r = state.act({ t: "spend", what }); if (!r.ok) { this.notEnough(); return; } audio.play("buy", 0.6); buzz("success"); }
      if (what === "hint") this.peek(sol); else this.autoLoop(sol);
    };
    const { loopsOk, thisOk } = this.track(sol);
    if (thisOk) { run(); return; }
    if (loopsOk) { dialog({ title: t("rewind_loop"), text: t("off_track"), buttons: [{ label: t("cancel"), kind: "ghost" }, { label: t("rewind_loop"), onTap: () => { this.startLoop(); run(); } }] }); return; }
    dialog({ title: t("restart_room"), text: t("off_track"), buttons: [{ label: t("cancel"), kind: "ghost" }, { label: t("restart_room"), onTap: () => { this.logs = []; this.startLoop(); this.drawDots(); run(); } }] });
  }
  private peekSps: Container[] = [];
  /** Arrows on the next three cells of the recorded route, numbered. */
  private peek(sol: string[]) {
    for (const p of this.peekSps) p.destroy({ children: true }); this.peekSps = [];
    const { li } = this.track(sol); const log = sol[li]!; const h = this.run.actors[this.run.actors.length - 1]!;
    let x = h.x, y = h.y;
    for (let k = 0; k < 3 && this.recording.length + k < log.length; k++) {
      const d = log.charCodeAt(this.recording.length + k) - 48; const [dx, dy] = L.DIRS[d] ?? [0, 0];
      const c = new Container();
      if (d) { x += dx!; y += dy!; const ar = new Sprite(Texture.from("arrow")); ar.anchor.set(0.5); ar.width = ar.height = this.cs * 0.7; ar.rotation = d === 1 ? -Math.PI / 2 : d === 3 ? 0 : d === 5 ? Math.PI / 2 : Math.PI; c.addChild(ar); }
      else { const w = new Graphics(); w.circle(0, 0, this.cs * 0.22).stroke({ color: C.cream, width: 6 }); c.addChild(w); }
      const n = new Text({ text: String(k + 1), style: display(this.cs * 0.3, C.cream, false, true) }); n.anchor.set(0.5); n.position.set(this.cs * 0.28, -this.cs * 0.28); c.addChild(n);
      c.position.set((x + 0.5) * this.cs, (y + 0.5) * this.cs); c.alpha = 1 - k * 0.22; this.items.addChild(c); this.peekSps.push(c);
      gsap.to(c.scale, { x: 1.08, y: 1.08, duration: 0.5, yoyo: true, repeat: -1, ease: "sine.inOut" });
    }
    this.hintUntil = this.run.tick + 3;
    this.showBanner(t("hint_title"), t("peek_shown"), 1600);
  }
  private clearPeek(all = false) {
    if (!this.peekSps.length) return;
    if (all || this.run.tick > this.hintUntil) { for (const p of this.peekSps) { killTweensDeep(p); p.destroy({ children: true }); } this.peekSps = []; return; }
    const first = this.peekSps.shift()!; killTweensDeep(first); first.destroy({ children: true });
  }
  /** The rest of this loop, played by the game from the recorded route. */
  private autoLoop(sol: string[]) {
    const { li } = this.track(sol); const log = sol[li]!;
    this.auto = { log: log.slice(this.recording.length), i: 0, end: li < sol.length - 1 };
    this.showBanner(t("help_play"), "", 1600);
  }
  private levelDone() {
    const logs = [...this.logs, this.recording], res = L.simulate(this.level, logs), stars = L.starsFor(this.level, res.echoes);
    const p = state.profile, bestKey = this.key === "daily" ? `daily-${today()}` : this.key, custom = this.key.startsWith("custom");
    const prev = p.best[bestKey], before = p.coins, firstClear = !prev && !custom;
    const newBest = !!prev && (res.echoes < prev.echoes || (res.echoes === prev.echoes && res.exitTick < prev.ticks));
    const action = { t: "complete", level: this.key, logs, day: today(), name: p.name || "" };
    const v = state.act(action); if (this.key === "daily") state.dailyRoom.act(action);
    const reward = v.ok ? state.profile.coins - before : 0;
    audio.play("win"); this.shake(6); buzz("success");
    if (stars === 3 || newBest) setTimeout(() => audio.play("shimmer", 0.6), 420);
    // the hero dives into the portal
    gsap.to(this.heroSp, { x: this.exitSp.x, y: this.exitSp.y + this.cs * 0.4, duration: 0.5, ease: "power2.in" });
    gsap.to(this.heroSp.scale, { x: 0, y: 0, duration: 0.6, ease: "power2.in" }); gsap.to(this.heroSp, { rotation: Math.PI * 2, duration: 0.6, ease: "power2.in" });
    gsap.to(this.exitGlow.scale, { x: 2.2, y: 2.2, duration: 0.6, yoyo: true, repeat: 1 });
    if (stars === 3) this.confetti();
    const gen = this.gen;
    setTimeout(() => { if (this.gen !== gen || this.destroyed) return; this.playing = false; audio.musicOn(false); Scenes.overlay(new ResultScene(this, { stars, echoes: res.echoes, moves: res.exitTick, reward, firstClear, newBest, next: this.nextLevel() })); }, 1150);
  }
  private nextLevel(): Level | null {
    const i = L.LEVELS.findIndex((l) => l.id === this.key); if (i < 0) return null;
    const n = L.LEVELS[i + 1]; return n && L.worldUnlocked(state.profile, n.world) ? n : null;
  }
  /** Called by the result sheet. */
  play(level: Level, key: string) { this.level = level; this.key = key; this.gen += 1; this.rebuild(); }
  replay() { this.gen += 1; this.rebuild(); }
  private rebuild() {
    for (const c of [this.floor, this.items, this.actors, this.fx]) c.removeChildren().forEach((x) => { killTweensDeep(x as Container); x.destroy({ children: true }); });
    this.frame.clear(); this.plateSps.clear(); this.doorSps.clear(); this.coinSps.clear(); this.coach = null; this.peekSps = [];
    this.nameT.text = levelName(this.key); this.buildBoard(); this.relayout(); this.startLevel();
  }
  quit() { this.playing = false; audio.musicOn(false); audio.play("tap", 0.5); if (Scenes.depth > 1) Scenes.pop(); else Scenes.go(new MapScene()); }

  // ── input ────────────────────────────────────────────────────────────────
  private canControl() { return this.playing && Scenes.top === this && !!this.run && !this.run.finished && !this.run.dead && this.freeze <= 0; }
  private onKey(e: KeyboardEvent) {
    if (Scenes.top !== this) return;
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); if (!e.repeat) { this.heldKey = e.code; this.beatInput(d); } return; }
    if (WAIT_KEYS.has(e.code)) { e.preventDefault(); if (!e.repeat) this.beatInput(0); return; }
    if (e.code === "KeyR" && this.canControl()) this.startLoop();
    if ((e.code === "KeyZ" || e.code === "Backspace") && this.canControl() && this.recording.length) { this.rewind(1); e.preventDefault(); }
    if ((e.code === "Enter" || e.code === "KeyE") && this.canControl()) this.endLoopNow();
    if (e.code === "Escape") this.quit();
  }
  private onDown(e: FederatedPointerEvent) {
    if (!this.playing || this.touch.id !== -1) return; audio.unlock();
    this.touch = { id: e.pointerId, x0: e.global.x, y0: e.global.y, t0: performance.now(), dir: 0, moved: false };
  }
  private onMove(e: FederatedPointerEvent) {
    if (e.pointerId !== this.touch.id) return;
    const dx = e.global.x - this.touch.x0, dy = e.global.y - this.touch.y0, dist = Math.hypot(dx, dy);
    if (dist < SWIPE * 0.6) { this.touch.dir = 0; return; }
    if (dist < SWIPE && !this.touch.moved) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 7) : dy > 0 ? 5 : 1;
    if (dir !== this.touch.dir) { this.touch.dir = dir; this.touch.moved = true; this.beatInput(dir); }
  }
  private onUp(e: FederatedPointerEvent) {
    if (e.pointerId !== this.touch.id) return;
    // a plain tap on the board waits a beat; taps on the keys are theirs
    const inBoard = e.global.y > this.hud.y * layout.scale + 300 * layout.scale && e.global.y < (this.controls.y - 120) * layout.scale;
    if (!this.touch.moved && performance.now() - this.touch.t0 < 320 && inBoard) this.beatInput(0);
    this.touch.id = -1; this.touch.dir = 0;
  }
  private beatInput(dir: number) {
    if (!this.canControl()) return;
    if (performance.now() - this.beatT0 < BEAT_MS * 0.55) { this.queued = dir; return; }
    this.doBeat(dir);
  }
  private doBeat(dir: number) {
    const run = this.run; if (!this.canControl() || run.tick >= L.LOOP_TICKS) return;
    this.prev = { actors: run.actors.map((a) => ({ x: a.x, y: a.y })), drones: run.drones.map((d) => ({ x: d.px, y: d.py })) };
    this.recording += String(dir); L.stepRun(run, dir); this.beatT0 = performance.now(); this.queued = null; this.hideCoach();
    const hero = run.actors[run.actors.length - 1]!;
    if (hero.moved) { audio.play("step", 0.4, 0.96 + Math.random() * 0.08); buzz("light"); } else if (dir) { this.shake(2); audio.play("tick", 0.3, 0.7); buzz("rigid"); } else { audio.play("tick", 0.45); buzz("selection"); }
    if (L.LOOP_TICKS - run.tick <= 3 && L.LOOP_TICKS - run.tick > 0) buzz("warning");
    if (run.tick > this.hintUntil) this.hintSp.visible = false;
    this.clearPeek();
    this.handleEvents(run); this.drawDial();
    if (run.finished) { this.levelDone(); return; }
    if (run.dead) { this.loopFailed(); return; }
    if (run.tick >= L.LOOP_TICKS) this.loopEnded();
  }
  private handleEvents(run: Run) {
    const cs = this.cs;
    for (const e of run.events) {
      if (e.t === "coin") {
        audio.play("coin", 0.8, 1 + Math.min(6, run.taken - 1) * 0.07);
        const s = this.coinSps.get(`${e.x},${e.y}`); if (s) { s.visible = false; }
        this.burst((e.x + 0.5) * cs, (e.y + 0.5) * cs, C.gold, 14);
        if (e.hero) buzz("light");
        if (e.hero) this.flyCoin((e.x + 0.5) * cs, (e.y + 0.5) * cs); else (this.coinPill as any).setValue(String(run.taken));
      } else if (e.t === "plate") { audio.play("plate", 0.8); buzz("medium"); const s = this.plateSps.get(e.k); if (s) { s.texture = Texture.from("plate_on"); gsap.fromTo(s.scale, { x: s.scale.x * 1.1, y: s.scale.y * 1.1 }, { x: s.scale.x, y: s.scale.y, duration: 0.3, ease: "back.out(2)" }); } }
      else if (e.t === "open" || e.t === "close") {
        audio.play(e.t, 0.7); buzz("selection"); const d = this.doorSps.get(e.k); if (d) { gsap.to(d.open, { alpha: e.t === "open" ? 1 : 0, duration: 0.25 }); gsap.to(d.closed, { alpha: e.t === "open" ? 0 : 1, duration: 0.25 }); }
        if (e.t === "open") { const k = this.level.map.findIndex((r) => r.includes(e.k)); const x = this.level.map[k]!.indexOf(e.k); this.burst((x + 0.5) * cs, (k + 0.5) * cs, C.violet, 10); }
      }
    }
    // released plates
    for (const [k, s] of this.plateSps) if (!run.plates[k] && s.texture !== Texture.from("plate_off")) s.texture = Texture.from("plate_off");
  }

  // ── fx ───────────────────────────────────────────────────────────────────
  private burst(x: number, y: number, color: number, n: number) {
    for (let i = 0; i < n; i++) {
      const p = new Graphics(); p.circle(0, 0, 4 + Math.random() * 5).fill({ color }); p.position.set(x, y); this.fx.addChild(p);
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 60;
      gsap.to(p, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r - 20, alpha: 0, duration: 0.5 + Math.random() * 0.3, ease: "power2.out", onComplete: () => p.destroy() });
    }
  }
  private flyCoin(x: number, y: number) {
    const s = new Sprite(Texture.from("coin_t")); s.anchor.set(0.5); s.width = s.height = 70; const g = this.board.toGlobal({ x, y }); const l = this.toLocal(g); s.position.set(l.x, l.y); this.addChild(s);
    const target = { x: this.coinPill.x + 40, y: this.hud.y + this.coinPill.y + 36 };
    gsap.to(s, { x: target.x, y: target.y, duration: 0.55, ease: "power2.in", onComplete: () => { s.destroy(); (this.coinPill as any).setValue(String(this.run.taken)); gsap.fromTo(this.coinPill.scale, { x: 1.15, y: 1.15 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2)" }); } });
  }
  private confetti() {
    const colors = [C.gold, C.mint, C.violet, 0xffffff, C.orange];
    for (let i = 0; i < 70; i++) {
      const p = new Graphics(); p.rect(-6, -4, 12, 8).fill({ color: colors[i % colors.length]! }); p.position.set(Math.random() * W, -40 - Math.random() * 300); p.rotation = Math.random() * 3; this.addChild(p);
      gsap.to(p, { y: layout.bottom + 60, x: p.x + (Math.random() - 0.5) * 300, rotation: p.rotation + 6, duration: 2 + Math.random(), ease: "power1.in", onComplete: () => p.destroy() });
    }
  }
  private shake(n: number) { this.shakeN = Math.max(this.shakeN, n); }

  // ── frame ────────────────────────────────────────────────────────────────
  tick(dt: number) {
    this.time += dt; const now = performance.now();
    if (this.freeze > 0) this.freeze -= dt;
    else if (this.playing && this.auto && this.canControl()) {
      if (now - this.beatT0 >= REPLAY_MS) { const a = this.auto; if (a.i < a.log.length) this.doBeat(a.log.charCodeAt(a.i++) - 48); else { this.auto = null; if (a.end) this.endLoopNow(); } }
    } else if (this.canControl()) {
      const since = now - this.beatT0;
      if (this.queued !== null && since >= BEAT_MS * 0.55) this.doBeat(this.queued);
      else { const held = this.touch.dir || (this.heldKey ? KEYS[this.heldKey] ?? 0 : 0); if (held && since >= REPEAT_MS) this.doBeat(held); }
    }
    if (!this.run) return;
    const cs = this.cs, k = easeOut((now - this.beatT0) / BEAT_MS), hop = Math.sin(Math.PI * Math.min(1, k)) * cs * 0.16;
    const pos = (cur: { x: number; y: number }, prev?: { x: number; y: number }) => prev && k < 1 ? { x: prev.x + (cur.x - prev.x) * k, y: prev.y + (cur.y - prev.y) * k } : cur;
    this.run.actors.forEach((a, i) => {
      const sp = i === this.run.actors.length - 1 ? this.heroSp : this.echoSps[i]; if (!sp) return;
      const p = pos(a, this.prev?.actors[i]); const moved = a.moved && k < 1;
      sp.position.set((p.x + 0.5) * cs, (p.y + 0.92) * cs - (moved ? hop : 0) - (i === this.run.actors.length - 1 ? 0 : Math.sin(this.time * 3 + i) * 2));
      sp.visible = a.alive && !a.done || (i === this.run.actors.length - 1 && this.run.finished);
      if (a.dir === 3) sp.scale.x = Math.abs(sp.scale.x); else if (a.dir === 7) sp.scale.x = -Math.abs(sp.scale.x);
      sp.zIndex = p.y;
    });
    this.run.drones.forEach((d, i) => {
      const sp = this.droneSps[i]; if (!sp) return;
      const p = pos({ x: d.px, y: d.py }, this.prev?.drones[i]);
      sp.position.set((p.x + 0.5) * cs, (p.y + 0.5) * cs + Math.sin(this.time * 4 + i) * 3); sp.zIndex = p.y + 0.5;
      // forecast ghost
      const g = this.ghostSps[i]; if (g) { const n = L.dronePos(d, this.run.tick + 1); g.visible = state.opts.assist && !this.run.finished; g.position.set((n.px + 0.5) * cs, (n.py + 0.5) * cs); g.alpha = 0.25 + Math.sin(this.time * 5) * 0.08; }
    });
    this.actors.sortableChildren = true;
    this.updateDanger();
    if (this.exitSp) { this.exitSp.rotation += dt * 0.8; this.exitGlow.alpha = 0.8 + Math.sin(this.time * 3) * 0.2; }
    if (this.shakeN > 0) { this.shakeN = Math.max(0, this.shakeN - dt * 40); this.board.pivot.set((Math.random() - 0.5) * this.shakeN * 1.5, (Math.random() - 0.5) * this.shakeN * 1.5); } else this.board.pivot.set(0, 0);
  }
  private updateDanger() {
    const run = this.run, alive = this.canControl() && state.opts.assist && run.drones.length > 0;
    if (alive && (!this.danger || this.danger.tick !== run.tick || this.danger.gen !== this.gen)) {
      const cells: { x: number; y: number; wait: boolean }[] = [];
      for (const dir of [0, 1, 3, 5, 7]) { const c = cloneRun(run); L.stepRun(c, dir); if (c.dead) { const h = c.actors[c.actors.length - 1]!; cells.push({ x: h.x, y: h.y, wait: dir === 0 }); } }
      this.danger = { tick: run.tick, gen: this.gen, cells };
      for (const d of this.dangerSps) d.destroy({ children: true }); this.dangerSps = [];
      for (const c of cells) {
        const m = new Container(); const s = new Sprite(Texture.from("danger")); s.anchor.set(0.5); s.width = s.height = this.cs * 0.86; m.addChild(s);
        m.position.set((c.x + 0.5) * this.cs, (c.y + 0.5) * this.cs); this.items.addChild(m); this.dangerSps.push(m);
      }
    }
    if (!alive && this.dangerSps.length) { for (const d of this.dangerSps) d.destroy({ children: true }); this.dangerSps = []; this.danger = null; }
    for (const d of this.dangerSps) d.alpha = 0.6 + Math.sin(this.time * 6) * 0.25;
  }
  dispose() { this.playing = false; audio.musicOn(false); window.removeEventListener("keydown", this.keyHandler); window.removeEventListener("keyup", this.keyUp); this.bannerTl?.kill(); super.dispose(); }
}

/** The clear sheet: stars pop in, numbers count up, Next / Replay / Map. */
export interface ResultInfo { stars: number; echoes: number; moves: number; reward: number; firstClear: boolean; newBest: boolean; next: Level | null }
export class ResultScene extends Scene {
  private box!: Container;
  constructor(private owner: LevelScene, private r: ResultInfo) { super(); }
  build() {
    const sh = scrim(W * 3, 6000, 0.7); sh.x = -W; sh.y = -1000; this.addChild(sh);
    const w = 920, h = 760, r = this.r; this.box = new Container(); this.box.addChild(panel(w, h, { radius: 40, glow: r.stars === 3 ? C.gold : undefined }));
    const title = new Text({ text: r.stars === 3 ? t("perfect") : t("done_title"), style: display(72, C.cream, true) }); title.anchor.set(0.5); title.position.set(w / 2, 90); this.box.addChild(title);
    const echo = new Text({ text: title.text, style: display(72, C.mint, true, false) }); echo.anchor.set(0.5); echo.position.set(w / 2 - 10, 84); echo.alpha = 0.35; this.box.addChildAt(echo, 1);
    for (let i = 0; i < 3; i++) {
      const s = iconSprite(i < r.stars ? "star" : "star_off", i === 1 ? 170 : 130); const sc = s.scale.x; s.position.set(w / 2 + (i - 1) * 190, i === 1 ? 240 : 260); s.scale.set(0); this.box.addChild(s);
      gsap.to(s.scale, { x: sc, y: sc, duration: 0.5, delay: 0.25 + i * 0.22, ease: "back.out(2.5)", onStart: () => { if (i < r.stars) { audio.play("star", 0.8, 1 + i * 0.12); buzz("light"); } } });
    }
    const stats: [string, string][] = [[String(r.echoes), t("echoes_used")], [String(r.moves), t("seconds")], ["+0", t("coins")]];
    stats.forEach(([v, l], i) => {
      const x = w / 2 + (i - 1) * 270; const vt = new Text({ text: v, style: display(56, i === 2 ? C.gold : C.cream) }); vt.anchor.set(0.5); vt.position.set(x, 400); this.box.addChild(vt);
      const lt = new Text({ text: l, style: body(24, C.lilac, 800) }); lt.anchor.set(0.5); lt.position.set(x, 450); this.box.addChild(lt);
      if (i === 2) { const o = { n: 0 }; gsap.to(o, { n: r.reward, duration: 0.9, delay: 0.6, ease: "power2.out", onUpdate: () => { vt.text = "+" + Math.round(o.n); } }); }
    });
    const sub = new Text({ text: (r.firstClear ? t("first_clear") + " · " : "") + (r.newBest ? t("new_best") + " · " : "") + `${t("par_label")} ${(this.owner as any).level.par}`, style: body(26, r.newBest ? C.gold : C.lilac, 800) }); sub.anchor.set(0.5); sub.position.set(w / 2, 510); this.box.addChild(sub);
    const bw = r.next ? 270 : 400;
    const map = button({ w: bw, h: 120, label: t("menu"), kind: "ghost", size: 36, onTap: () => { this.closeThen(() => this.owner.quit()); } }); map.position.set(r.next ? 60 + bw / 2 : w / 2 - bw / 2 - 10, 640); this.box.addChild(map);
    const again = button({ w: bw, h: 120, label: t("retry"), kind: "secondary", size: 36, onTap: () => { this.closeThen(() => this.owner.replay()); } }); again.position.set(r.next ? 60 + bw * 1.5 + 20 : w / 2 + bw / 2 + 10, 640); this.box.addChild(again);
    if (r.next) { const nx = button({ w: bw, h: 120, label: t("next"), kind: "primary", size: 36, onTap: () => { this.closeThen(() => this.owner.play(r.next!, r.next!.id)); } }); nx.position.set(60 + bw * 2.5 + 40, 640); this.box.addChild(nx); }
    this.box.pivot.set(w / 2, h / 2); this.addChild(this.box);
    this.box.scale.set(0.7); this.box.alpha = 0; gsap.to(this.box, { alpha: 1, duration: 0.2 }); gsap.to(this.box.scale, { x: 1, y: 1, duration: 0.45, ease: "back.out(1.6)" });
  }
  relayout() { this.box.position.set(W / 2, layout.bottom / 2); }
  private closeThen(fn: () => void) { audio.play("tap", 0.5); if (Scenes.top === this) Scenes.closeOverlay(); fn(); }
}
