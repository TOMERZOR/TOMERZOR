/**
 * The chamber. Rules run in logic.js; this scene draws the marble room into a
 * texture shown through a perspective mesh, turns swipes and taps into beats,
 * tweens every hop, shows where sentinels land next, and runs the
 * loop → echo → clear flow under the Sanctuary HUD.
 */
import { Container, Sprite, Texture, Text, Graphics, Rectangle, FederatedPointerEvent, RenderTexture, PerspectiveMesh } from "pixi.js";
import gsap from "gsap";
import { Scene, Scenes, layout, killTweensDeep } from "../scenes";
import { W, C } from "../theme";
import { panel, button, roundKey, pill, display, body, scrim, logoStyle } from "../ui";
import { iconSprite, echoTexture } from "../widgets";
import { Actor } from "../actor";
import { glow, ring, burst as fxBurst, afterimage } from "../fx";
import { state, L, S, ORDER, today } from "../state";
import type { Level, Run } from "../logic-types";
import { audio, buzz } from "../audio";
import { t, chamberTitle, objectiveFor, rtl } from "../i18n";
import { dialog } from "./dialog";
import { MapScene } from "./map";
import { ShopScene } from "./shop";
import { showAd } from "./ads";
import { Tutorial, type TutHost } from "../tutorial";

const REPEAT_MS = 175, REPLAY_MS = 260, BEAT_MS = 150, SWIPE = 20;
/** Padding around the room inside its render texture (frame, wall fronts, glow bleed). */
const BPAD = 40;
const KEYS: Record<string, number> = { ArrowUp: 1, KeyW: 1, ArrowRight: 3, KeyD: 3, ArrowDown: 5, KeyS: 5, ArrowLeft: 7, KeyA: 7 };
const WAIT_KEYS = new Set(["Space", "Period", "KeyX"]);
const fails: Record<string, number> = {};
const easeOut = (k: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
/** A cheap deep-enough copy of a run for look-ahead (structuredClone is slow on some phones). */
const cloneRun = (r: Run): Run => ({ ...r, actors: r.actors.map((a) => ({ ...a })), coins: r.coins.map((c) => ({ ...c })), doors: { ...r.doors }, plates: { ...r.plates }, drones: r.drones.map((d) => ({ ...d })), events: [] });
const pad2 = (n: number) => String(n).padStart(2, "0");

/** The wall block art holds the top face over the front face; split once into two frames. */
let wallFrames: { top: Texture; front: Texture } | null = null;
function wallTex() {
  if (!wallFrames) {
    const src = Texture.from("s_wall_block").source;
    wallFrames = { top: new Texture({ source: src, frame: new Rectangle(0, 0, 308, 230) }), front: new Texture({ source: src, frame: new Rectangle(0, 232, 308, 139) }) };
  }
  return wallFrames;
}
let floorFrame: Texture | null = null;
/** The marble floor tile without its gold frame, so walls (framed, raised) read apart from the floor. */
function floorTex() { if (!floorFrame) floorFrame = new Texture({ source: Texture.from("s_floor").source, frame: new Rectangle(22, 22, 212, 212) }); return floorFrame; }
/** A vertical gradient drawn as thin bands. */
function vgrad(g: Graphics, y0: number, y1: number, a0: number, a1: number, color = C.ink, steps = 24) {
  const h = (y1 - y0) / steps;
  for (let i = 0; i < steps; i++) g.rect(-W, y0 + i * h, W * 3, h + 1).fill({ color, alpha: a0 + (a1 - a0) * (i / (steps - 1)) });
}

interface Snap { actors: { x: number; y: number }[]; drones: { x: number; y: number }[] }
interface Cell { x: number; y: number }

export class LevelScene extends Scene {
  // state
  private logs: string[] = []; private run!: Run; private recording = ""; private playing = false; private gen = 0;
  private beatT0 = -1e9; private prev: Snap | null = null; private queued: number | null = null; private auto: { log: string; i: number; end: boolean } | null = null;
  private danger: { tick: number; gen: number; cells: { x: number; y: number; wait: boolean }[] } | null = null;
  private heldKey: string | null = null; private touch = { id: -1, x0: 0, y0: 0, t0: 0, dir: 0, moved: false };
  private time = 0; private shakeN = 0; private hintUntil = -1; private freeze = 0;
  // display
  private bg!: Sprite; private shade!: Graphics; private board!: Container; private boardRoot!: Container; private frame!: Graphics; private floor!: Container; private lights!: Container; private items!: Container; private actors!: Container; private fx!: Container; private motes!: Container;
  private boardRT: RenderTexture | null = null; private mesh: PerspectiveMesh | null = null; private boardShadow!: Graphics; private brect = { x: 0, y: 0, w: 1, h: 1 }; private corners = [0, 0, 0, 0, 0, 0, 0, 0];
  private par = { x: 0, y: 0 }; private parS = { x: 0, y: 0 }; private zoom = { k: 1, fx: 0.5, fy: 0.5 }; private landed = true; private moteList: { g: Graphics; vx: number; vy: number; ph: number }[] = [];
  private plateGlow = new Map<string, Sprite>(); private doorBeam = new Map<string, Sprite>(); private paths = new Map<string, Graphics>();
  private orient = (e: DeviceOrientationEvent) => { if (!state.opts.tilt) return; const g = e.gamma ?? 0, b = e.beta ?? 45; this.par.x = Math.max(-1, Math.min(1, g / 28)); this.par.y = Math.max(-1, Math.min(1, (b - 45) / 28)); };
  private cs = 100; private flash!: Graphics; private bannerY = 0;
  private heroSp!: Actor; private echoSps: Actor[] = []; private droneSps: Actor[] = []; private ghostSps: Sprite[] = []; private coinSps = new Map<string, Sprite>();
  private plateSps = new Map<string, Sprite>(); private doorSps = new Map<string, { open: Sprite; closed: Sprite }>(); private exitSp!: Sprite; private exitGlow!: Sprite;
  private dangerSps: Container[] = []; private hintSp!: Sprite;
  // hud
  private hud!: Container; private dial!: Container; private dialArc!: Graphics; private dialNum!: Text; private titleT!: Text; private objT!: Text; private syncT!: Text; private coinPill!: Container;
  private strip!: Container; private chips: Container[] = []; private capT!: Text;
  private controls!: Container; private createBtn!: Container; private hintTag!: Container;
  private banner!: Container; private bannerT!: Text; private bannerS!: Text;
  private tut: Tutorial | null = null; private tutLayer = new Container();
  private keyHandler = (e: KeyboardEvent) => this.onKey(e); private keyUp = (e: KeyboardEvent) => { if (e.code === this.heldKey) this.heldKey = null; };

  constructor(private level: Level, private key: string) { super(); }

  build() {
    const world = L.WORLDS.find((w) => w.id === this.level.world) ?? L.WORLDS[0]!;
    const ink = new Graphics(); ink.rect(-W, -2000, W * 3, 8000).fill({ color: C.ink }); this.addChild(ink);
    this.bg = new Sprite(Texture.from(world.bg)); this.bg.anchor.set(0.5); this.addChild(this.bg);
    const dark = new Graphics(); dark.rect(-W, -2000, W * 3, 8000).fill({ color: C.ink, alpha: 0.18 }); this.addChild(dark);
    this.shade = new Graphics(); this.addChild(this.shade);
    // input surface
    const hit = new Graphics(); hit.rect(-W, -2000, W * 3, 8000).fill({ color: 0xffffff, alpha: 0.001 }); this.addChild(hit);
    this.eventMode = "static";
    this.on("pointerdown", (e) => this.onDown(e)); this.on("globalpointermove", (e) => this.onMove(e)); this.on("pointerup", (e) => this.onUp(e)); this.on("pointerupoutside", (e) => this.onUp(e)); this.on("pointercancel", (e) => this.onUp(e));
    window.addEventListener("keydown", this.keyHandler); window.addEventListener("keyup", this.keyUp);

    // The room is drawn into a texture and shown through a perspective mesh,
    // so it floats on the screen like a marble platform instead of a flat grid.
    this.boardShadow = new Graphics(); this.addChild(this.boardShadow);
    this.boardRoot = new Container(); this.board = new Container(); this.board.position.set(BPAD, BPAD); this.boardRoot.addChild(this.board);
    this.frame = new Graphics(); this.board.addChild(this.frame);
    this.floor = new Container(); this.lights = new Container(); this.items = new Container(); this.actors = new Container(); this.fx = new Container(); this.motes = new Container();
    this.board.addChild(this.floor, this.lights, this.items, this.actors, this.fx, this.motes);
    this.on("pointermove", (e) => { if (state.opts.tilt) return; this.par.x = (e.global.x / window.innerWidth - 0.5) * 1.2; this.par.y = (e.global.y / window.innerHeight - 0.5) * 1.2; });
    window.addEventListener("deviceorientation", this.orient);
    this.flash = new Graphics(); this.flash.rect(-W, -2000, W * 3, 8000).fill({ color: C.coral }); this.flash.alpha = 0; this.addChild(this.flash);
    this.buildHud(); this.buildControls(); this.buildBanner();
    this.buildBoard();
    this.addChild(this.tutLayer);
    this.startLevel();
  }
  // ── what the tutorial sees ──
  /** A board cell in scene coordinates. */
  get layer() { return this.tutLayer; }
  cellRect(x: number, y: number) { const a = this.boardToScene(x * this.cs, y * this.cs), b = this.boardToScene((x + 1) * this.cs, (y + 1) * this.cs); return { x: Math.min(a.x, b.x), y: a.y, w: Math.abs(b.x - a.x), h: b.y - a.y }; }
  dialRect() { return { x: this.dial.x - 72, y: this.hud.y + this.dial.y - 72, w: 144, h: 144 }; }
  endKeyRect() { return { x: this.createBtn.x - 220, y: this.controls.y + this.createBtn.y - 52, w: 440, h: 104 }; }
  heroCell() { const h = this.run.actors[this.run.actors.length - 1]!; return { x: h.x, y: h.y }; }
  echoCount() { return this.logs.length; }
  restartRoom() { this.logs = []; this.startLoop(); }
  finishTutorial() { state.setFlag("tut", true); this.tut?.destroy(); this.tut = null; this.tutLayer.removeChildren().forEach((c) => c.destroy({ children: true })); audio.play("tap", 0.5); const first = L.LEVELS[0]!; this.play(first, first.id); }
  skipTutorial() { state.setFlag("tut", true); this.tut?.destroy(); this.tut = null; this.tutLayer.removeChildren().forEach((c) => c.destroy({ children: true })); this.quit(); }

  // ── HUD ──────────────────────────────────────────────────────────────────
  private buildHud() {
    this.hud = new Container(); this.addChild(this.hud);
    const back = roundKey(84, "ghost", iconSprite("back", 44), () => this.quit()); back.position.set(62, 0); this.hud.addChild(back);
    const mark = new Text({ text: "ECHO", style: logoStyle(28, C.cream) }); mark.anchor.set(0, 0.5); mark.position.set(126, 0); this.hud.addChild(mark);
    this.titleT = new Text({ text: "", style: display(46, C.cream, true) }); this.titleT.anchor.set(0, 0.5); this.titleT.position.set(60, 78); this.hud.addChild(this.titleT);
    this.objT = new Text({ text: "", style: body(26, C.lilac, 600) }); this.objT.style.wordWrap = true; this.objT.style.wordWrapWidth = 620; this.objT.style.align = rtl() ? "right" : "left"; this.objT.position.set(60, 110); this.hud.addChild(this.objT);
    // the moves ring
    this.dial = new Container(); this.dial.position.set(W - 100, 60);
    const track = new Graphics(); track.circle(0, 0, 62).fill({ color: C.glass, alpha: 0.6 }); track.circle(0, 0, 58).stroke({ color: 0xffffff, alpha: 0.12, width: 6 }); this.dial.addChild(track);
    this.dialArc = new Graphics(); this.dial.addChild(this.dialArc);
    this.dialNum = new Text({ text: "20", style: display(50, C.cream, false, false) }); this.dialNum.anchor.set(0.5); this.dialNum.y = -6; this.dial.addChild(this.dialNum);
    const ml = new Text({ text: t("moves").toUpperCase(), style: display(14, C.lilac, true, false) }); ml.anchor.set(0.5); ml.y = 28; this.dial.addChild(ml);
    this.hud.addChild(this.dial);
    this.syncT = new Text({ text: "", style: display(24, C.mint, true, false) }); this.syncT.anchor.set(1, 0.5); this.syncT.position.set(W - 40, 150); this.hud.addChild(this.syncT);
    this.coinPill = pill(170, 56, "0", iconSprite("coin", 44)); this.coinPill.position.set(W - 100 - 62 - 24 - 170, 32); this.hud.addChild(this.coinPill);
    // the echo strip: one chip per slot, and the capacity on the right
    this.strip = new Container(); this.addChild(this.strip);
    for (let i = 0; i <= L.MAX_ECHOES; i++) { const c = new Container(); c.x = 60 + i * 108; this.strip.addChild(c); this.chips.push(c); }
    this.capT = new Text({ text: "", style: display(30, C.cream, false, false) }); this.capT.anchor.set(1, 0.5); this.capT.position.set(W - 60, -10); this.strip.addChild(this.capT);
    const cl = new Text({ text: t("echo_capacity").toUpperCase(), style: display(14, C.lilac, true, false) }); cl.anchor.set(1, 0.5); cl.position.set(W - 60, 20); this.strip.addChild(cl);
    this.setTitles();
  }
  private setTitles() {
    this.titleT.text = (this.key === "daily" ? t("daily_name", { d: String(today() % 1000) }) : this.key.startsWith("custom") ? t("custom") : chamberTitle(this.key)).toUpperCase();
    this.objT.text = objectiveFor(this.level);
  }
  private plateLetters() { return [...new Set(this.level.map.join("").split("").filter((c) => "abc".includes(c)))]; }
  private drawChips() {
    const n = this.logs.length;
    this.chips.forEach((c, i) => {
      c.removeChildren().forEach((x) => x.destroy({ children: true }));
      const on = i < n, you = i === n, g = new Graphics(), col = on ? C.mint : you ? C.gold : 0xffffff;
      g.roundRect(0, -20, 100, 40, 8).fill({ color: on ? C.mint : C.glass, alpha: on ? 0.92 : 0.6 });
      g.roundRect(0.5, -19.5, 99, 39, 8).stroke({ color: col, alpha: on ? 1 : you ? 0.95 : 0.14, width: you ? 2 : 1.5 });
      c.addChild(g);
      const lbl = new Text({ text: you ? t("you") : on ? t("echo_n", { n: pad2(i + 1) }) : pad2(i + 1), style: display(18, on ? 0x07202a : you ? C.gold : C.lilac, true, false) });
      lbl.anchor.set(0.5); lbl.position.set(50, 0); lbl.alpha = on || you ? 1 : 0.5; c.addChild(lbl);
    });
    this.capT.text = `${n} / ${L.MAX_ECHOES}`;
  }
  private drawSync() {
    const letters = this.plateLetters();
    if (letters.length) { const held = letters.filter((k) => this.run.plates[k]).length; this.syncT.text = t("synced", { a: held, b: letters.length }).toUpperCase(); this.syncT.style.fill = held === letters.length ? C.mint : C.lilac; }
    else if (this.run.drones.length) { this.syncT.text = `${this.run.drones.length} ${t("sentinels")}`.toUpperCase(); this.syncT.style.fill = C.coral; }
    else this.syncT.text = "";
  }
  private drawDial() {
    const left = Math.max(0, L.LOOP_TICKS - (this.run?.tick ?? 0)), f = left / L.LOOP_TICKS;
    this.dialArc.clear();
    if (f > 0) this.dialArc.arc(0, 0, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f).stroke({ color: left <= 3 ? C.coral : C.mint, width: 6, cap: "round" });
    this.dialNum.text = String(left); this.dialNum.style.fill = left <= 3 ? C.coral : C.cream;
  }
  private buildControls() {
    this.controls = new Container(); this.addChild(this.controls);
    const undo = roundKey(104, "ghost", iconSprite("undo", 50), () => { if (this.canControl() && this.recording.length && this.tutAllows()) this.rewind(1); }); undo.position.set(92, 0); this.controls.addChild(undo);
    const recall = button({ w: 230, h: 104, label: t("recall"), kind: "ghost", size: 28, onTap: () => { if (this.canControl() && this.tutAllows()) { audio.play("tap", 0.5); this.startLoop(); } } }); recall.position.set(275, 0); this.controls.addChild(recall);
    this.createBtn = button({ w: 440, h: 104, label: t("create_echo"), kind: "primary", size: 36, onTap: () => this.endLoopNow() }); this.createBtn.position.set(700, 0); this.controls.addChild(this.createBtn);
    const hint = roundKey(104, "ghost", iconSprite("bulb", 50), () => this.hint()); hint.position.set(W - 92, 0); this.controls.addChild(hint);
    this.hintTag = new Container(); this.hintTag.position.set(W - 92, -74); this.controls.addChild(this.hintTag);
  }
  private freeHelp() { return this.key === "tutorial" || this.key === "1-1" || this.key === "1-2"; }
  private drawHintTag() {
    this.hintTag.removeChildren().forEach((c) => c.destroy({ children: true }));
    const free = this.freeHelp(); const g = new Graphics(); const w = free ? 96 : 116;
    g.roundRect(-w / 2, -20, w, 40, 8).fill({ color: C.glass, alpha: 0.85 }); g.roundRect(-w / 2 + 0.5, -19.5, w - 1, 39, 8).stroke({ color: free ? C.mint : C.gold, alpha: 0.9, width: 1.5 }); this.hintTag.addChild(g);
    if (free) { const tx = new Text({ text: t("free_tag"), style: display(20, C.mint, true, false) }); tx.anchor.set(0.5); this.hintTag.addChild(tx); }
    else { const ic = iconSprite("coin", 32); ic.x = -32; this.hintTag.addChild(ic); const tx = new Text({ text: String(L.PRICES.hint), style: display(24, C.gold, false, false) }); tx.anchor.set(0, 0.5); tx.x = -12; this.hintTag.addChild(tx); }
  }
  private buildBanner() {
    this.banner = new Container(); this.banner.alpha = 0; this.addChild(this.banner);
    const bgG = new Graphics(); bgG.label = "bg"; this.banner.addChild(bgG);
    this.bannerT = new Text({ text: "", style: display(44, C.cream, true, false) }); this.bannerT.anchor.set(0.5); this.banner.addChild(this.bannerT);
    this.bannerS = new Text({ text: "", style: body(24, C.mint, 600) }); this.bannerS.anchor.set(0.5, 0); this.bannerS.style.wordWrap = true; this.bannerS.style.wordWrapWidth = 880; this.bannerS.style.align = "center"; this.banner.addChild(this.bannerS);
  }
  private bannerTl: gsap.core.Timeline | null = null;
  private showBanner(title: string, sub: string, ms: number) {
    this.bannerT.text = title; this.bannerS.text = sub; this.bannerS.y = 28;
    const bgG = this.banner.getChildByLabel("bg") as Graphics; const w = Math.max(this.bannerT.width, sub ? this.bannerS.width : 0) + 100, h = 84 + (sub ? this.bannerS.height + 10 : 0);
    bgG.clear(); bgG.roundRect(-w / 2, -44, w, h, 14).fill({ color: C.glass, alpha: 0.92 }); bgG.roundRect(-w / 2 + 0.5, -43.5, w - 1, h - 1, 14).stroke({ color: C.mint, alpha: 0.6, width: 1.5 });
    this.bannerTl?.kill(); this.banner.scale.set(0.9);
    this.bannerTl = gsap.timeline().to(this.banner, { alpha: 1, duration: 0.15 }).to(this.banner.scale, { x: 1, y: 1, duration: 0.35, ease: "back.out(1.8)" }, 0).to(this.banner, { alpha: 0, duration: 0.3, delay: ms / 1000 });
  }

  // ── board ────────────────────────────────────────────────────────────────
  private findCell(ch: string): Cell | null { for (let y = 0; y < L.ROWS; y++) { const x = this.level.map[y]!.indexOf(ch); if (x >= 0) return { x, y }; } return null; }
  /** Shortest walk over open cells from a to b (walls block; gates count as open). */
  private route(a: Cell, b: Cell): Cell[] | null {
    const m = this.level.map, key = (c: Cell) => c.y * L.COLS + c.x, prev = new Map<number, number>([[key(a), -1]]), q: Cell[] = [a];
    while (q.length) {
      const c = q.shift()!; if (c.x === b.x && c.y === b.y) { const out: Cell[] = []; for (let k = key(c); k >= 0; k = prev.get(k)!) out.push({ x: k % L.COLS, y: Math.floor(k / L.COLS) }); return out.reverse(); }
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) { const n = { x: c.x + dx, y: c.y + dy }; if (n.x < 0 || n.y < 0 || n.x >= L.COLS || n.y >= L.ROWS || m[n.y]![n.x] === "#" || prev.has(key(n))) continue; prev.set(key(n), key(c)); q.push(n); }
    }
    return null;
  }
  private buildBoard() {
    const m = this.level.map, cs = 100; this.cs = cs; // drawn at 100 units per cell, scaled in relayout
    const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const fw = L.COLS * cs, fh = L.ROWS * cs, wt = wallTex();
    // The platform: a white marble slab with a gold hairline, the gaps between tiles dark.
    this.frame.roundRect(-34, -34, fw + 68, fh + 68, 26).fill({ color: 0xe6e9ee });
    this.frame.roundRect(-34, -34, fw + 68, fh + 68, 26).stroke({ color: 0xc9a85c, width: 3, alpha: 0.9 });
    this.frame.roundRect(-24, -24, fw + 48, fh + 48, 18).stroke({ color: 0xffffff, alpha: 0.6, width: 1.5 });
    const base = new Graphics(); base.rect(-4, -4, fw + 8, fh + 8).fill({ color: 0x151b26 }); this.floor.addChild(base);
    const ao = new Graphics();
    for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
      if (m[y]![x] === "#") continue;
      const s = new Sprite(floorTex()); s.anchor.set(0.5); s.width = s.height = cs - 2; s.position.set((x + 0.5) * cs, (y + 0.5) * cs);
      const h = hash(x, y); s.rotation = (h % 4) * Math.PI / 2; s.tint = [0xdce3eb, 0xd4dce5, 0xe3e9f0][h % 3]!;
      this.floor.addChild(s);
      // a soft shadow under the wall to the north, and a hairline between tiles
      if (y > 0 && m[y - 1]![x] === "#") for (let i = 0; i < 6; i++) ao.rect(x * cs, y * cs + i * 5, cs, 5).fill({ color: 0x0b0f16, alpha: 0.2 * (1 - i / 6) });
      ao.rect(x * cs, y * cs, cs, cs).stroke({ color: 0x0b0f16, alpha: 0.12, width: 2 });
    }
    this.floor.addChild(ao);
    for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
      const ch = m[y]![x]!;
      if (ch === "#") {
        const top = new Sprite(wt.top); top.width = cs + 1; top.height = cs + 1; top.position.set(x * cs, y * cs); this.floor.addChild(top);
        // the front face of every wall block with open floor (or the platform edge) below it
        if (y + 1 >= L.ROWS || m[y + 1]![x] !== "#") { const f = new Sprite(wt.front); f.width = cs + 1; f.height = cs * 0.45; f.position.set(x * cs, (y + 1) * cs); this.floor.addChild(f); }
        continue;
      }
      if ("abc".includes(ch)) { const s = new Sprite(Texture.from("s_switch_off")); s.anchor.set(0.5); s.width = s.height = cs * 0.92; s.position.set((x + 0.5) * cs, (y + 0.5) * cs); this.items.addChild(s); this.plateSps.set(ch, s); const pg = glow("#49d7ff", cs * 0.9, 0); pg.position.set((x + 0.5) * cs, (y + 0.5) * cs); this.lights.addChild(pg); this.plateGlow.set(ch, pg); }
      if ("ABC".includes(ch)) {
        const mk = (name: string) => { const s = new Sprite(Texture.from(name)); s.anchor.set(0.5, 1); s.width = cs * 1.04; s.scale.y = s.scale.x; s.position.set((x + 0.5) * cs, (y + 1) * cs - 2); this.items.addChild(s); return s; };
        const closed = mk("s_gate_closed"), open = mk("s_gate_open"); open.alpha = 0; this.doorSps.set(ch, { open, closed });
        const bm = glow("#49d7ff", cs * 1.0, 0); bm.position.set((x + 0.5) * cs, (y + 0.5) * cs); bm.scale.y *= 1.5; this.lights.addChild(bm); this.doorBeam.set(ch, bm);
      }
      if (ch === "E") { this.exitGlow = glow("#ffcf5a", cs * 1.6, 0.5); this.exitGlow.position.set((x + 0.5) * cs, (y + 0.5) * cs); this.lights.addChild(this.exitGlow); this.exitSp = new Sprite(Texture.from("s_portal")); this.exitSp.anchor.set(0.5); this.exitSp.width = this.exitSp.height = cs * 1.12; this.exitSp.position.set((x + 0.5) * cs, (y + 0.5) * cs); this.items.addChild(this.exitSp); }
    }
    // Light paths: a thin line of light from every switch to its gate, lit while the switch is held.
    for (const k of this.plateLetters()) {
      const a = this.findCell(k), b = this.findCell(k.toUpperCase()); if (!a || !b) continue;
      const r = this.route(a, b); if (!r || r.length < 2) continue;
      const g = new Graphics(); const pts = r.map((c) => [(c.x + 0.5) * cs, (c.y + 0.5) * cs] as const);
      for (const w of [[12, 0x0b2a35, 0.35], [4, 0x49d7ff, 1]] as const) { g.moveTo(pts[0]![0], pts[0]![1]); for (const [px, py] of pts.slice(1)) g.lineTo(px, py); g.stroke({ color: w[1], width: w[0], alpha: w[2], cap: "round", join: "round" }); }
      for (const [px, py] of pts.slice(1, -1)) g.circle(px, py, 5).fill({ color: 0xffffff, alpha: 0.8 });
      g.alpha = 0.3; this.lights.addChild(g); this.paths.set(k, g);
    }
    // Sentinel lanes: a faint red trace of every patrol.
    for (const d of this.level.drones ?? []) {
      const g = new Graphics(); g.moveTo((d.x + 0.5) * cs, (d.y + 0.5) * cs).lineTo((d.x + d.dx * d.n + 0.5) * cs, (d.y + d.dy * d.n + 0.5) * cs).stroke({ color: C.coral, width: 3, alpha: 0.28, cap: "round" });
      for (let k = 0; k <= d.n; k++) g.circle((d.x + d.dx * k + 0.5) * cs, (d.y + d.dy * k + 0.5) * cs, 4).fill({ color: C.coral, alpha: 0.35 });
      this.lights.addChild(g);
    }
    this.hintSp = new Sprite(Texture.from("s_arrow")); this.hintSp.anchor.set(0.5); this.hintSp.width = cs * 0.8; this.hintSp.scale.y = this.hintSp.scale.x; this.hintSp.visible = false; this.items.addChild(this.hintSp);
    // light motes drifting over the platform
    this.moteList = [];
    for (let i = 0; i < 16; i++) { const g = new Graphics(); g.circle(0, 0, 2 + Math.random() * 3).fill({ color: 0xbff2ff, alpha: 0.5 }); g.blendMode = "add"; g.position.set(Math.random() * fw, Math.random() * fh); this.motes.addChild(g); this.moteList.push({ g, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 10, ph: Math.random() * 6 }); }
    // the texture the room is drawn into, and the mesh that shows it in perspective
    if (!this.boardRT) {
      this.boardRT = RenderTexture.create({ width: fw + BPAD * 2, height: fh + BPAD + 110, resolution: 1 });
      this.mesh = new PerspectiveMesh({ texture: this.boardRT, verticesX: 12, verticesY: 18 });
      this.addChildAt(this.mesh, this.getChildIndex(this.boardShadow) + 1);
    }
  }
  /** Scene coordinates of a point in room space (bilinear over the mesh corners; the tilt is mild). */
  boardToScene(bx: number, by: number) {
    const c = this.corners, u = (bx + BPAD) / this.boardRT!.width, v = (by + BPAD) / this.boardRT!.height;
    const tx = c[0]! + (c[2]! - c[0]!) * u, ty = c[1]! + (c[3]! - c[1]!) * u, bx2 = c[6]! + (c[4]! - c[6]!) * u, by2 = c[7]! + (c[5]! - c[7]!) * u;
    return { x: tx + (bx2 - tx) * v, y: ty + (by2 - ty) * v };
  }
  /** Corners of the mesh: the board rect, narrowed at the top, nudged by parallax, zoom and shake. */
  private updateCorners() {
    if (!this.mesh) return;
    const { x, y, w, h } = this.brect, ins = w * 0.075, px = this.parS.x, py = this.parS.y, sh = this.shakeN;
    let c = [x + ins - px * ins * 0.6, y + h * 0.025 + py * 10, x + w - ins - px * ins * 0.6, y + h * 0.025 + py * 10, x + w + px * 8, y + h, x + px * 8, y + h];
    const fx = x + w * this.zoom.fx, fy = y + h * this.zoom.fy, k = this.zoom.k;
    c = c.map((v, i) => (i % 2 === 0 ? fx + (v - fx) * k : fy + (v - fy) * k));
    this.corners = c;
    const jx = sh ? (Math.random() - 0.5) * sh * 1.5 : 0, jy = sh ? (Math.random() - 0.5) * sh * 1.5 : 0;
    this.mesh.setCorners(c[0]! + jx, c[1]! + jy, c[2]! + jx, c[3]! + jy, c[4]! + jx, c[5]! + jy, c[6]! + jx, c[7]! + jy);
    // the platform's marble edge and its shadow in the clouds below
    const g = this.boardShadow; g.clear();
    const side = [c[6]!, c[7]! - 30, c[4]!, c[5]! - 30, c[4]! + 3, c[5]! + 22, c[6]! - 3, c[7]! + 22];
    g.poly(side).fill({ color: 0xd3d9e2 });
    g.poly([c[6]!, c[7]! + 2, c[4]!, c[5]! + 2, c[4]! + 3, c[5]! + 22, c[6]! - 3, c[7]! + 22]).fill({ color: 0xaab3c0 });
    g.poly(side).stroke({ color: 0xc9a85c, alpha: 0.7, width: 2 });
    for (let i = 0; i < 4; i++) g.roundRect(c[6]! - 10 - i * 14, c[7]! - 60 + i * 10, c[4]! - c[6]! + 20 + i * 28, 110 + i * 10, 60).fill({ color: 0x000000, alpha: 0.1 });
  }
  private syncActors() {
    this.actors.removeChildren().forEach((c) => { killTweensDeep(c as Container); c.destroy({ children: true }); });
    // Old forecast ghosts and danger marks go first; the new ones are made below.
    for (const g of this.ghostSps) if (!g.destroyed) g.destroy();
    for (const d of this.dangerSps) if (!d.destroyed) d.destroy({ children: true });
    this.dangerSps = []; this.danger = null;
    this.echoSps = []; this.droneSps = []; this.ghostSps = [];
    const skin = state.skin(), cs = this.cs, col = L.SKINS[skin]!.color, colN = parseInt(col.slice(1), 16);
    const start = this.run.actors[0]!;
    for (let i = 0; i < this.run.actors.length - 1; i++) { const e = new Actor(echoTexture(skin), cs, "echo", col); e.position.set((start.x + 0.5) * cs, (start.y + 0.92) * cs); this.actors.addChild(e); this.echoSps.push(e); gsap.delayedCall(0.06 * i, () => { if (!e.destroyed) e.materialize(this.fx, colN); }); }
    for (const _ of this.run.drones) { const g = new Sprite(Texture.from("s_sentinel")); g.anchor.set(0.5, 0.6); g.width = cs * 0.7; g.scale.y = g.scale.x; g.alpha = 0.32; this.items.addChild(g); this.ghostSps.push(g); }
    this.heroSp = new Actor(Texture.from(L.SKINS[skin]!.sprite), cs, "hero", col); this.heroSp.position.set((start.x + 0.5) * cs, (start.y + 0.92) * cs); this.actors.addChild(this.heroSp); this.heroSp.arrive(this.fx);
    this.run.drones.forEach((d) => { const a = new Actor(Texture.from("s_sentinel"), cs, "drone", "#ff5c5c"); a.position.set((d.px + 0.5) * cs, (d.py + 0.5) * cs); if (d.dx) a.setDir(d.dx > 0 ? 3 : 7); this.actors.addChild(a); this.droneSps.push(a); });
    this.landed = true;
    // coins
    for (const s of this.coinSps.values()) { gsap.killTweensOf(s); if (!s.destroyed) s.destroy(); } this.coinSps.clear();
    for (const c of this.run.coins) { const s = new Sprite(Texture.from("s_coin")); s.anchor.set(0.5); s.height = cs * 0.62; s.scale.x = s.scale.y; s.position.set((c.x + 0.5) * cs, (c.y + 0.5) * cs); this.items.addChild(s); this.coinSps.set(`${c.x},${c.y}`, s); gsap.to(s, { y: (c.y + 0.42) * cs, duration: 0.8 + Math.random() * 0.4, yoyo: true, repeat: -1, ease: "sine.inOut" }); }
    this.syncStatic();
  }
  /** Switches, gates, coins to the run's truth (after a rewind or a restart). */
  private syncStatic() {
    for (const [k, s] of this.plateSps) s.texture = Texture.from(this.run.plates[k] ? "s_switch_on" : "s_switch_off");
    for (const [k, d] of this.doorSps) { const open = !!this.run.doors[k]; d.open.alpha = open ? 1 : 0; d.closed.alpha = open ? 0 : 1; }
    for (const c of this.run.coins) { const s = this.coinSps.get(`${c.x},${c.y}`); if (s) s.visible = !c.taken; }
    (this.coinPill as any).setValue(String(this.run.taken));
    this.drawDial(); this.drawChips(); this.drawSync();
  }

  relayout() {
    const top = layout.safeTop, bottom = layout.bottom, sb = layout.safeBottom;
    this.bg.position.set(W / 2, bottom / 2); const s = Math.max(W / this.bg.texture.width, bottom / this.bg.texture.height); this.bg.scale.set(s);
    this.hud.y = top + 70;
    const boardTop = top + 300, ctrlH = 330 + sb;
    this.controls.position.set(0, bottom - sb - 130); this.strip.position.set(0, this.controls.y - 145);
    const availH = bottom - boardTop - ctrlH, cell = Math.min((W - 110) / L.COLS, availH / L.ROWS);
    const k = cell / 100, bx = (W - L.COLS * cell) / 2, by = boardTop + (availH - L.ROWS * cell) / 2; this.bannerY = by + cell * 0.5;
    if (this.boardRT) {
      this.brect = { x: bx - BPAD * k, y: by - BPAD * k, w: this.boardRT.width * k, h: this.boardRT.height * k };
      const res = Math.min(2, Math.max(0.6, k * layout.scale * Scenes.app.renderer.resolution));
      if (Math.abs(this.boardRT.source.resolution - res) > 0.08) { this.boardRT.resize(this.boardRT.width, this.boardRT.height, res); if (this.mesh) this.mesh.texture = this.boardRT; }
      this.updateCorners();
    }
    // dark glass gradients behind the HUD and the controls, never over the room
    this.shade.clear(); vgrad(this.shade, top - 200, boardTop - 20, 0.72, 0); vgrad(this.shade, this.strip.y - 90, bottom + 200, 0, 0.78);
    // The banner sits over the top wall row of the room, never over the HUD or the floor.
    this.banner.position.set(W / 2, this.bannerY);
    this.tut?.relayout();
  }

  // ── flow ─────────────────────────────────────────────────────────────────
  private coach: Container | null = null;
  /** First room only: an arrow that keeps gliding in the direction of the first move until the player makes one. */
  showCoach() {
    if (this.coach || (this.key !== "1-1" && this.key !== "tutorial")) return;
    const c = new Container(); const ar = new Sprite(Texture.from("s_arrow")); ar.anchor.set(0.5); ar.width = this.cs * 0.9; ar.scale.y = ar.scale.x; ar.rotation = Math.PI / 2; c.addChild(ar);
    const ring = new Graphics(); ring.circle(0, 0, this.cs * 0.36).stroke({ color: C.mint, alpha: 0.9, width: 6 }); ring.circle(0, 0, this.cs * 0.14).fill({ color: C.cream, alpha: 0.9 }); c.addChild(ring);
    const start = this.run.actors[this.run.actors.length - 1]!; c.position.set((start.x + 0.5) * this.cs, (start.y + 0.5) * this.cs);
    this.items.addChild(c); this.coach = c;
    gsap.timeline({ repeat: -1, repeatDelay: 0.4 }).set(ring, { y: -this.cs * 0.2, alpha: 1 }).set(ar, { alpha: 0 }).to(ring, { y: this.cs * 1.4, duration: 0.7, ease: "power1.inOut" }).to(ar, { alpha: 1, duration: 0.2 }, 0.2).to(ar, { y: this.cs * 0.9, duration: 0.6, ease: "power1.inOut" }, 0.1).to([ring, ar], { alpha: 0, duration: 0.25 });
  }
  private hideCoach() { if (!this.coach) return; killTweensDeep(this.coach); this.coach.destroy({ children: true }); this.coach = null; }
  private startLevel() {
    this.logs = []; this.playing = true;
    this.drawHintTag();
    this.startLoop();
    if (this.key === "tutorial") { this.relayout(); this.tut = new Tutorial(this as unknown as TutHost); }
    else { this.showCoach(); this.showBanner(t("loop_n", { n: 1 }), this.hintFor(), 3800); }
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
    if (this.logs.length && !this.tut) this.showBanner(t("loop_n", { n: this.logs.length + 1 }), t("loop_sub"), 900);
    audio.play("tick", 0.4, 1 + this.logs.length * 0.08);
    this.tut?.on("loopStart");
  }
  private loopEnded() {
    if (this.tut && !this.tut.acceptLoopEnd()) { this.showBanner(t("retry"), "", 900); this.later(700, () => this.restartRoom()); return; }
    this.tut?.on("loopEnded");
    if (this.logs.length >= L.MAX_ECHOES) {
      this.showBanner(t("out_of_echoes"), t("out_sub"), 1400); audio.play("out"); this.shake(10); buzz("heavy"); setTimeout(() => buzz("error"), 120); this.noteFail();
      this.logs = []; this.drawChips(); this.later(1300, () => this.startLoop()); return;
    }
    this.logs.push(this.recording);
    this.showBanner(t("loop_saved", { n: this.logs.length }), t("loop_sub"), 1300); audio.play("saved", 0.7); buzz("medium");
    // the hero freezes into a hologram
    this.heroSp.freeze(parseInt(L.SKINS[state.skin()]!.color.slice(1), 16)); ring(this.fx, this.heroSp.x, this.heroSp.y, this.cs * 0.2, this.cs * 0.9, C.mint, 5, 0.6);
    this.later(950, () => this.startLoop());
  }
  private endLoopNow() {
    const run = this.run; if (!this.canControl() || run.tick < 1 || run.tick >= L.LOOP_TICKS) return;   // a second tap during the save animation must not save the loop twice
    if (this.tut && !this.tut.allowsEnd()) { buzz("rigid"); return; }
    run.tick = L.LOOP_TICKS; this.drawDial(); audio.play("tap", 0.5); buzz("medium"); this.loopEnded();
  }
  private loopFailed() {
    this.showBanner(t("caught"), t("caught_sub"), 1200); audio.play("caught"); this.shake(14); buzz("error"); this.noteFail();
    this.flash.alpha = 0.45; gsap.to(this.flash, { alpha: 0, duration: 0.5 }); this.freeze = 0.09;
    this.heroSp.zap(this.fx); this.pulseZoom(1.06, this.heroSp.x, this.heroSp.y - this.cs * 0.4, 0.7);
    this.later(800, () => this.offerContinue());
  }
  /** After a sentinel: pick up from the move before (ad, coins, or free without ads) or restart the loop. */
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
    run.events = []; this.run = run; this.recording = rec; this.prev = null; this.queued = null; this.beatT0 = -1e9; this.danger = null; this.auto = null; this.clearPeek(true);
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
    dialog({ title: t("restart_room"), text: t("off_track"), buttons: [{ label: t("cancel"), kind: "ghost" }, { label: t("restart_room"), onTap: () => { this.logs = []; this.startLoop(); this.drawChips(); run(); } }] });
  }
  private peekSps: Container[] = [];
  /** Arrows on the next three cells of the recorded route, numbered. */
  private peek(sol: string[]) {
    for (const p of this.peekSps) { killTweensDeep(p); p.destroy({ children: true }); } this.peekSps = [];
    const { li } = this.track(sol); const log = sol[li]!; const h = this.run.actors[this.run.actors.length - 1]!;
    let x = h.x, y = h.y;
    for (let k = 0; k < 3 && this.recording.length + k < log.length; k++) {
      const d = log.charCodeAt(this.recording.length + k) - 48; const [dx, dy] = L.DIRS[d] ?? [0, 0];
      const c = new Container();
      if (d) { x += dx!; y += dy!; const ar = new Sprite(Texture.from("s_arrow")); ar.anchor.set(0.5); ar.width = this.cs * 0.7; ar.scale.y = ar.scale.x; ar.rotation = d === 1 ? -Math.PI / 2 : d === 3 ? 0 : d === 5 ? Math.PI / 2 : Math.PI; c.addChild(ar); }
      else { const w = new Graphics(); w.circle(0, 0, this.cs * 0.22).stroke({ color: C.mint, width: 6 }); c.addChild(w); }
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
    if (this.tut) {
      audio.play("win"); buzz("success"); this.confetti(); this.exitAnimation();
      this.later(1000, () => this.tut?.on("exit"));
      return;
    }
    const logs = [...this.logs, this.recording], res = L.simulate(this.level, logs), stars = L.starsFor(this.level, res.echoes);
    const day = (this.level as { day?: number }).day ?? today();   // the daily keeps the day it was opened on, even across midnight
    const p = state.profile, bestKey = this.key === "daily" ? `daily-${day}` : this.key, custom = this.key.startsWith("custom");
    const prev = p.best[bestKey], before = p.coins, firstClear = !prev && !custom;
    const newBest = !!prev && (res.echoes < prev.echoes || (res.echoes === prev.echoes && res.exitTick < prev.ticks));
    const action = { t: "complete", level: this.key, logs, day, name: p.name || "" };
    const v = state.act(action); if (this.key === "daily") state.dailyRoom.act(action);
    const reward = v.ok ? state.profile.coins - before : 0;
    audio.play("win"); this.shake(6); buzz("success");
    if (stars === 3 || newBest) setTimeout(() => audio.play("shimmer", 0.6), 420);
    this.exitAnimation();
    if (stars === 3) this.confetti();
    const gen = this.gen;
    setTimeout(() => { if (this.gen !== gen || this.destroyed) return; this.playing = false; audio.musicOn(false); Scenes.overlay(new ResultScene(this, { stars, echoes: res.echoes, moves: res.exitTick, reward, firstClear, newBest, next: this.nextLevel() })); }, 1150);
  }
  /** The hero winds up, leaps in an arc into the portal with a light trail, and the portal answers. */
  private exitAnimation() {
    const A = this.heroSp, cs = this.cs, ex = this.exitSp.x, ey = this.exitSp.y + cs * 0.42, f = A.face;
    killTweensDeep(A);
    const tl = gsap.timeline();
    tl.to(A.body.scale, { x: 1.18 * f, y: 0.78, duration: 0.1, ease: "power2.out" })
      .to(A.body.scale, { x: 0.82 * f, y: 1.3, duration: 0.12 })
      .to(A, { x: ex, y: ey, duration: 0.46, ease: "power2.in" }, 0.2)
      .to(A.body, { y: -cs * 1.5, duration: 0.23, ease: "power2.out" }, 0.2)
      .to(A.body, { y: 0, duration: 0.23, ease: "power2.in" }, 0.43)
      .to(A.body, { rotation: Math.PI * 2 * f, duration: 0.46, ease: "power1.in" }, 0.2)
      .to(A.body.scale, { x: 0.06 * f, y: 0.06, duration: 0.26, ease: "power2.in" }, 0.4)
      .to(A, { alpha: 0, duration: 0.08 }, 0.64);
    const trail = setInterval(() => { if (!A.destroyed && A.alpha > 0) afterimage(this.fx, A.sprite, 0xffcf5a, 0.45, 0.35); }, 40); setTimeout(() => clearInterval(trail), 680);
    this.pulseZoom(1.09, ex, ey - cs * 0.4, 1.1);
    gsap.delayedCall(0.62, () => {
      if (this.destroyed) return;
      const fl = new Graphics(); fl.circle(0, 0, cs * 0.5).fill({ color: 0xffffff, alpha: 0.95 }); fl.blendMode = "add"; fl.position.set(ex, ey - cs * 0.42); this.fx.addChild(fl);
      gsap.to(fl.scale, { x: 3.2, y: 3.2, duration: 0.45, ease: "power2.out" }); gsap.to(fl, { alpha: 0, duration: 0.45, onComplete: () => fl.destroy() });
      ring(this.fx, ex, ey - cs * 0.42, cs * 0.2, cs * 1.9, C.gold, 10, 0.7); ring(this.fx, ex, ey - cs * 0.42, cs * 0.1, cs * 1.2, 0xffffff, 6, 0.5);
      fxBurst(this.fx, ex, ey - cs * 0.42, C.gold, 26, cs * 0.9); fxBurst(this.fx, ex, ey - cs * 0.42, 0xffffff, 10, cs * 0.6);
      gsap.fromTo(this.exitGlow.scale, { x: this.exitGlow.scale.x * 2.4, y: this.exitGlow.scale.y * 2.4 }, { x: this.exitGlow.scale.x, y: this.exitGlow.scale.y, duration: 0.8, ease: "power2.out" });
      this.shake(5);
    });
  }
  /** A brief camera push toward a point in room space. */
  private pulseZoom(k: number, bx: number, by: number, duration: number) {
    if (!this.boardRT) return;
    this.zoom.fx = (bx + BPAD) / this.boardRT.width; this.zoom.fy = (by + BPAD) / this.boardRT.height;
    gsap.killTweensOf(this.zoom); gsap.to(this.zoom, { k, duration: duration * 0.35, ease: "power2.out" }).then(() => gsap.to(this.zoom, { k: 1, duration: duration * 0.65, ease: "power2.inOut" }));
  }
  private nextLevel(): Level | null {
    const i = ORDER.findIndex((l) => l.id === this.key); if (i < 0) return null;
    const n = ORDER[i + 1]; return n && L.worldUnlocked(state.profile, n.world) ? n : null;
  }
  /** Called by the result sheet. */
  play(level: Level, key: string) { this.level = level; this.key = key; this.gen += 1; this.rebuild(); }
  replay() { this.gen += 1; this.rebuild(); }
  private rebuild() {
    for (const c of [this.floor, this.lights, this.items, this.actors, this.fx, this.motes]) c.removeChildren().forEach((x) => { killTweensDeep(x as Container); x.destroy({ children: true }); });
    this.frame.clear(); this.plateSps.clear(); this.doorSps.clear(); this.coinSps.clear(); this.plateGlow.clear(); this.doorBeam.clear(); this.paths.clear(); this.ghostSps = []; this.dangerSps = []; this.coach = null; this.peekSps = []; this.zoom.k = 1;
    const world = L.WORLDS.find((w) => w.id === this.level.world) ?? L.WORLDS[0]!; this.bg.texture = Texture.from(world.bg);
    this.setTitles(); this.buildBoard(); this.addChild(this.tutLayer); this.relayout(); this.startLevel();
  }
  quit() { this.playing = false; audio.musicOn(false); audio.play("tap", 0.5); if (Scenes.depth > 1) Scenes.pop(); else Scenes.go(new MapScene()); }

  // ── input ────────────────────────────────────────────────────────────────
  private canControl() { return this.playing && Scenes.top === this && !!this.run && !this.run.finished && !this.run.dead && this.freeze <= 0; }
  /** Undo and recall are locked while a tutorial step needs the player to stay put. */
  private tutAllows() { if (this.tut && !this.tut.allowsMove()) { buzz("rigid"); return false; } return true; }
  private onKey(e: KeyboardEvent) {
    if (Scenes.top !== this) return;
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); if (!e.repeat) { this.heldKey = e.code; this.beatInput(d); } return; }
    if (WAIT_KEYS.has(e.code)) { e.preventDefault(); if (!e.repeat) this.beatInput(0); return; }
    if (e.repeat) return;
    if (e.code === "KeyR" && this.canControl() && this.tutAllows()) this.startLoop();
    if ((e.code === "KeyZ" || e.code === "Backspace") && this.canControl() && this.recording.length && this.tutAllows()) { this.rewind(1); e.preventDefault(); }
    if ((e.code === "Enter" || e.code === "KeyE" || e.code === "KeyQ") && this.canControl()) this.endLoopNow();
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
    // a plain tap on the platform waits a beat; taps on the keys are theirs
    const gy = e.global.y / layout.scale, inBoard = gy > this.brect.y + 20 && gy < this.brect.y + this.brect.h - 20;
    if (!this.touch.moved && performance.now() - this.touch.t0 < 320 && inBoard) this.beatInput(0);
    this.touch.id = -1; this.touch.dir = 0;
  }
  private beatInput(dir: number) {
    if (!this.canControl() || this.auto) return;   // while the game plays a bought loop, the player watches
    if (this.tut && !this.tut.allowsMove()) { buzz("rigid"); return; }
    if (performance.now() - this.beatT0 < BEAT_MS * 0.55) { this.queued = dir; return; }
    this.doBeat(dir);
  }
  private doBeat(dir: number) {
    const run = this.run; if (!this.canControl() || run.tick >= L.LOOP_TICKS) return;
    if (this.tut && !this.tut.allowsMove()) return;              // every input path ends here, so the lock lives here too
    this.prev = { actors: run.actors.map((a) => ({ x: a.x, y: a.y })), drones: run.drones.map((d) => ({ x: d.px, y: d.py })) };
    this.recording += String(dir); L.stepRun(run, dir); this.beatT0 = performance.now(); this.queued = null; this.hideCoach(); this.landed = false;
    const hero = run.actors[run.actors.length - 1]!;
    if (hero.moved) { audio.play("step", 0.4, 0.96 + Math.random() * 0.08); buzz("light"); } else if (dir) { this.shake(2); audio.play("tick", 0.3, 0.7); buzz("rigid"); } else { audio.play("tick", 0.45); buzz("selection"); }
    if (L.LOOP_TICKS - run.tick <= 3 && L.LOOP_TICKS - run.tick > 0) buzz("warning");
    if (run.tick > this.hintUntil) this.hintSp.visible = false;
    this.clearPeek();
    this.handleEvents(run); this.drawDial(); this.drawSync();
    if (!run.finished) this.tut?.on("beat");
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
      } else if (e.t === "plate") { audio.play("plate", 0.8); buzz("medium"); const s = this.plateSps.get(e.k); if (s) { s.texture = Texture.from("s_switch_on"); gsap.fromTo(s.scale, { x: s.scale.x * 1.1, y: s.scale.y * 1.1 }, { x: s.scale.x, y: s.scale.y, duration: 0.3, ease: "back.out(2)" }); ring(this.fx, s.x, s.y, cs * 0.2, cs * 0.75, C.mint, 5, 0.5); } }
      else if (e.t === "open" || e.t === "close") {
        audio.play(e.t, 0.7); buzz("selection"); const d = this.doorSps.get(e.k); if (d) { gsap.to(d.open, { alpha: e.t === "open" ? 1 : 0, duration: 0.25 }); gsap.to(d.closed, { alpha: e.t === "open" ? 0 : 1, duration: 0.25 }); }
        if (e.t === "open") { const k = this.level.map.findIndex((r) => r.includes(e.k)); const x = this.level.map[k]!.indexOf(e.k); this.burst((x + 0.5) * cs, (k + 0.5) * cs, C.mint, 10); }
      }
    }
    // released switches
    for (const [k, s] of this.plateSps) if (!run.plates[k] && s.texture !== Texture.from("s_switch_off")) s.texture = Texture.from("s_switch_off");
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
    const s = new Sprite(Texture.from("s_coin")); s.anchor.set(0.5); s.height = 64; s.scale.x = s.scale.y; const l = this.boardToScene(x, y); s.position.set(l.x, l.y); this.addChild(s);
    const target = { x: this.coinPill.x + 30, y: this.hud.y + this.coinPill.y + 28 };
    gsap.to(s, { x: target.x, y: target.y, duration: 0.55, ease: "power2.in", onComplete: () => { s.destroy(); (this.coinPill as any).setValue(String(this.run.taken)); gsap.fromTo(this.coinPill.scale, { x: 1.15, y: 1.15 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2)" }); } });
  }
  private confetti() {
    const colors = [C.gold, C.mint, C.violet, 0xffffff, C.cream];
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
    const cs = this.cs, kRaw = (now - this.beatT0) / BEAT_MS, k = easeOut(kRaw), kl = Math.min(1, kRaw);
    const pos = (cur: { x: number; y: number }, prev?: { x: number; y: number }) => prev && k < 1 ? { x: prev.x + (cur.x - prev.x) * k, y: prev.y + (cur.y - prev.y) * k } : cur;
    const last = this.run.actors.length - 1;
    this.run.actors.forEach((a, i) => {
      const A = i === last ? this.heroSp : this.echoSps[i]; if (!A || A.destroyed) return;
      const p = pos(a, this.prev?.actors[i]);
      if (!gsap.isTweening(A)) A.position.set((p.x + 0.5) * cs, (p.y + 0.92) * cs);
      if (a.dir === 3 || a.dir === 7) A.setDir(a.dir); else A.dir = a.dir;
      A.pose(kl, a.moved, dt);
      A.visible = (a.alive && !a.done) || (i === last && this.run.finished);
      A.zIndex = p.y;
    });
    if (!this.landed && kl >= 1) { this.landed = true; const h = this.run.actors[last]!; if (h.moved && this.heroSp && !this.heroSp.destroyed) this.heroSp.dustAt(this.fx); }
    this.run.drones.forEach((d, i) => {
      const A = this.droneSps[i]; if (!A || A.destroyed) return;
      const p = pos({ x: d.px, y: d.py }, this.prev?.drones[i]);
      A.position.set((p.x + 0.5) * cs, (p.y + 0.5) * cs); A.pose(1, false, dt); A.zIndex = p.y + 0.5;
      const g = this.ghostSps[i]; if (g && !g.destroyed) { const n = L.dronePos(d, this.run.tick + 1); g.visible = state.opts.assist && !this.run.finished; g.position.set((n.px + 0.5) * cs, (n.py + 0.5) * cs); g.alpha = 0.25 + Math.sin(this.time * 5) * 0.08; }
    });
    this.actors.sortableChildren = true;
    this.updateDanger();
    // lights follow the rules: switches held, paths lit, gates open, the portal breathing
    for (const [kk, pg] of this.plateGlow) { const on = !!this.run.plates[kk]; pg.alpha += ((on ? 0.6 : 0) - pg.alpha) * Math.min(1, dt * 8); }
    for (const [kk, pt] of this.paths) { const on = !!this.run.plates[kk]; pt.alpha += ((on ? 0.95 + Math.sin(this.time * 6) * 0.05 : 0.3) - pt.alpha) * Math.min(1, dt * 8); }
    for (const [kk, bm] of this.doorBeam) { const on = !!this.run.doors[kk]; bm.alpha += ((on ? 0.5 : 0) - bm.alpha) * Math.min(1, dt * 8); }
    if (this.exitSp && !this.exitSp.destroyed) { this.exitSp.rotation += dt * 0.5; this.exitGlow.alpha = 0.45 + Math.sin(this.time * 3) * 0.12; }
    // motes drift and wrap
    const fw = L.COLS * cs, fh = L.ROWS * cs;
    for (const m of this.moteList) { if (m.g.destroyed) continue; m.g.x += (m.vx + Math.sin(this.time * 0.8 + m.ph) * 6) * dt; m.g.y += m.vy * dt; m.g.alpha = 0.18 + Math.sin(this.time * 1.5 + m.ph) * 0.14; if (m.g.y < -10) { m.g.y = fh + 10; m.g.x = Math.random() * fw; } }
    // parallax, shake, zoom → corners; backdrop drifts the other way
    this.parS.x += (this.par.x - this.parS.x) * Math.min(1, dt * 4); this.parS.y += (this.par.y - this.parS.y) * Math.min(1, dt * 4);
    if (this.shakeN > 0) this.shakeN = Math.max(0, this.shakeN - dt * 40);
    this.updateCorners();
    this.bg.position.set(W / 2 - this.parS.x * 24, layout.bottom / 2 - this.parS.y * 16);
    // draw the room into its texture
    if (this.boardRT) Scenes.app.renderer.render({ container: this.boardRoot, target: this.boardRT, clear: true });
  }
  private updateDanger() {
    const run = this.run, alive = this.canControl() && state.opts.assist && run.drones.length > 0;
    if (alive && (!this.danger || this.danger.tick !== run.tick || this.danger.gen !== this.gen)) {
      const cells: { x: number; y: number; wait: boolean }[] = [];
      for (const dir of [0, 1, 3, 5, 7]) { const c = cloneRun(run); L.stepRun(c, dir); if (c.dead) { const h = c.actors[c.actors.length - 1]!; cells.push({ x: h.x, y: h.y, wait: dir === 0 }); } }
      this.danger = { tick: run.tick, gen: this.gen, cells };
      for (const d of this.dangerSps) d.destroy({ children: true }); this.dangerSps = [];
      for (const c of cells) {
        const m = new Container(); const s = new Sprite(Texture.from("s_danger")); s.anchor.set(0.5); s.width = this.cs * 0.86; s.scale.y = s.scale.x; m.addChild(s);
        m.position.set((c.x + 0.5) * this.cs, (c.y + 0.5) * this.cs); this.items.addChild(m); this.dangerSps.push(m);
      }
    }
    if (!alive && this.dangerSps.length) { for (const d of this.dangerSps) d.destroy({ children: true }); this.dangerSps = []; this.danger = null; }
    for (const d of this.dangerSps) d.alpha = 0.6 + Math.sin(this.time * 6) * 0.25;
  }
  dispose() {
    this.playing = false; this.tut?.destroy(); audio.musicOn(false);
    window.removeEventListener("keydown", this.keyHandler); window.removeEventListener("keyup", this.keyUp); window.removeEventListener("deviceorientation", this.orient); this.bannerTl?.kill();
    gsap.killTweensOf(this.zoom); killTweensDeep(this.boardRoot); this.boardRoot.destroy({ children: true }); this.boardRT?.destroy(true); this.boardRT = null;
    super.dispose();
  }
}

/** The clear sheet: stars pop in, numbers count up, Next / Replay / Map. */
export interface ResultInfo { stars: number; echoes: number; moves: number; reward: number; firstClear: boolean; newBest: boolean; next: Level | null }
export class ResultScene extends Scene {
  private box!: Container;
  constructor(private owner: LevelScene, private r: ResultInfo) { super(); }
  build() {
    const sh = scrim(W * 3, 6000, 0.7); sh.x = -W; sh.y = -1000; this.addChild(sh);
    const w = 920, h = 760, r = this.r; this.box = new Container(); this.box.addChild(panel(w, h, { radius: 28, glow: r.stars === 3 ? C.gold : C.mint }));
    const eyebrow = new Text({ text: (this.owner as any).key === "daily" ? t("daily_s") : chamberTitle((this.owner as any).key), style: display(22, C.mint, true, false) }); eyebrow.anchor.set(0.5); eyebrow.position.set(w / 2, 48); this.box.addChild(eyebrow);
    const title = new Text({ text: r.stars === 3 ? t("perfect") : t("done_title"), style: display(72, C.cream, true) }); title.anchor.set(0.5); title.position.set(w / 2, 110); this.box.addChild(title);
    for (let i = 0; i < 3; i++) {
      const s = iconSprite(i < r.stars ? "star" : "star_off", i === 1 ? 170 : 130); const sc = s.scale.x; s.position.set(w / 2 + (i - 1) * 190, i === 1 ? 250 : 270); s.scale.set(0); this.box.addChild(s);
      gsap.to(s.scale, { x: sc, y: sc, duration: 0.5, delay: 0.25 + i * 0.22, ease: "back.out(2.5)", onStart: () => { if (i < r.stars) { audio.play("star", 0.8, 1 + i * 0.12); buzz("light"); } } });
    }
    const stats: [string, string][] = [[String(r.echoes), t("echoes_used")], [String(r.moves), t("seconds")], ["+0", t("coins")]];
    stats.forEach(([v, l], i) => {
      const x = w / 2 + (i - 1) * 270; const vt = new Text({ text: v, style: display(56, i === 2 ? C.gold : C.cream) }); vt.anchor.set(0.5); vt.position.set(x, 400); this.box.addChild(vt);
      const lt = new Text({ text: l.toUpperCase(), style: display(20, C.lilac, true, false) }); lt.anchor.set(0.5); lt.position.set(x, 450); this.box.addChild(lt);
      if (i === 2) { const o = { n: 0 }; gsap.to(o, { n: r.reward, duration: 0.9, delay: 0.6, ease: "power2.out", onUpdate: () => { vt.text = "+" + Math.round(o.n); } }); }
    });
    const sub = new Text({ text: (r.firstClear ? t("first_clear") + " · " : "") + (r.newBest ? t("new_best") + " · " : "") + `${t("par_label")} ${(this.owner as any).level.par}`, style: body(26, r.newBest ? C.gold : C.lilac, 600) }); sub.anchor.set(0.5); sub.position.set(w / 2, 510); this.box.addChild(sub);
    const bw = r.next ? 270 : 400;
    const map = button({ w: bw, h: 120, label: t("menu"), kind: "ghost", size: 36, onTap: () => { this.closeThen(() => this.owner.quit()); } }); map.position.set(r.next ? 60 + bw / 2 : w / 2 - bw / 2 - 10, 640); this.box.addChild(map);
    const again = button({ w: bw, h: 120, label: t("retry"), kind: "secondary", size: 36, onTap: () => { this.closeThen(() => this.owner.replay()); } }); again.position.set(r.next ? 60 + bw * 1.5 + 20 : w / 2 + bw / 2 + 10, 640); this.box.addChild(again);
    if (r.next) { const nx = button({ w: bw, h: 120, label: t("next"), kind: "primary", size: 36, onTap: () => { this.closeThen(() => this.owner.play(r.next!, r.next!.id)); } }); nx.position.set(60 + bw * 2.5 + 40, 640); this.box.addChild(nx); }
    this.box.pivot.set(w / 2, h / 2); this.addChild(this.box);
    this.box.scale.set(0.7); this.box.alpha = 0; gsap.to(this.box, { alpha: 1, duration: 0.2 }); gsap.to(this.box.scale, { x: 1, y: 1, duration: 0.45, ease: "back.out(1.6)" });
  }
  relayout() { this.box.position.set(W / 2, layout.bottom / 2); }
  private closeThen(fn: () => void) { audio.play("tap", 0.5); Scenes.remove(this); fn(); }
}
