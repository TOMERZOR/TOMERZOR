/**
 * ECHO (rebuild). One WebGL canvas, a 1080×1920 design space scaled to the
 * phone with safe-area aware anchoring, and a scene stack. Rules live in
 * ../../echo/logic.js; this file and the scenes only draw and listen.
 */
import { Application, Container, Assets, CanvasTextMetrics } from "pixi.js";
import gsap from "gsap";
import { W, H, C } from "./theme";
import { Scenes, layout, report, errors } from "./scenes";
import { audio } from "./audio";
import { HomeScene } from "./scenes/home";
import { LevelScene } from "./scenes/level";
import { state, L } from "./state";

window.addEventListener("error", (e) => report(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => report((e as PromiseRejectionEvent).reason));

// Letter spacing through the canvas itself keeps right-to-left text (Hebrew) in order; the per-character fallback reverses it.
CanvasTextMetrics.experimentalLetterSpacing = true;

const app = new Application();
try {
  await app.init({ background: C.ink, resizeTo: window, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, preference: "webgl" });
} catch (e) {
  report(e);
  await app.init({ background: C.ink, resizeTo: window, antialias: false, resolution: 1, autoDensity: true });
}
document.body.appendChild(app.canvas);
(window as any).__echo = { app, Scenes, state, layout, errors, play: (id: string) => { const lvl = L.levelById(id); if (lvl) Scenes.push(new LevelScene(lvl, id)); } };

/** Design-space root: scaled uniformly; `layout` exposes the visible bounds. */
const root = new Container();
app.stage.addChild(root);
function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  // Portrait phones are taller than 9:16: fill the width and let the design
  // extend vertically; scenes anchor to layout.top/bottom.
  const scale = vw / W < vh / H ? vw / W : vh / H;
  root.scale.set(scale);
  const visW = vw / scale, visH = vh / scale;
  root.x = (vw - W * scale) / 2; root.y = 0;
  layout.scale = scale;
  layout.left = (W - visW) / 2; layout.right = W - layout.left;
  layout.top = 0; layout.bottom = visH;
  const probe = getComputedStyle(document.documentElement);
  layout.safeTop = (parseFloat(probe.getPropertyValue("--sat")) || 0) / scale;
  layout.safeBottom = (parseFloat(probe.getPropertyValue("--sab")) || 0) / scale;
  Scenes.relayout();
}
document.documentElement.style.setProperty("--sat", "env(safe-area-inset-top, 0px)");
document.documentElement.style.setProperty("--sab", "env(safe-area-inset-bottom, 0px)");
window.addEventListener("resize", fit);

Scenes.init(root, app);
await state.load();
try { await Promise.all(["400 40px Michroma", "600 40px Rajdhani", "500 30px Inter", "500 30px Heebo"].map((f) => document.fonts.load(f))); } catch { /* fallback fonts */ }
const ICONS = ["play", "pause", "back", "gear", "bag", "chest", "coin", "gem", "star", "star_off", "lock", "cal", "flame", "trophy", "crown", "ticket", "undo", "restart", "skip", "bulb", "sound", "music", "vibrate", "globe", "share", "replay", "check", "cross", "info", "home"];
await Assets.load([
  ...ICONS.map((n) => ({ alias: "icon_" + n, src: `assets/icons/${n}.png` })),
  { alias: "bg_title", src: "assets/bg_title.jpg" },
  ...[1, 2, 3, 4, 5].map((i) => ({ alias: "chapter" + i, src: `assets/chapter${i}.jpg` })),
  ...["hero", "echo", "coin", "gem", "drone", "exit", "plate", "bot_knight", "bot_astro", "bot_mecha", "bot_ninja", "bot_pirate", "bot_samurai", "bot_wizard", "bot_royal"].map((n) => ({ alias: n, src: `assets/${n}.png` })),
  ...["halo", "sentinel", "floor", "wall_block", "switch_off", "switch_on", "gate_closed", "gate_open", "portal", "coin", "gem", "danger", "arrow", "pad", "line", "star", "lock"].map((n) => ({ alias: n === "halo" ? "halo" : "s_" + n, src: `assets/sanct/${n}.png` })),
]);
fit();
audio.preload();
// Debug overlay (toggled from the profile screen): fps, renderer, last error.
let dbg: HTMLDivElement | null = null;
setInterval(() => {
  if (!state.opts.debug) { if (dbg) dbg.style.display = "none"; return; }
  if (!dbg) { dbg = document.createElement("div"); dbg.style.cssText = "position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:98;background:rgba(0,0,0,.7);color:#7ef0c6;font:600 11px/1.3 ui-monospace,monospace;padding:6px 8px;border-radius:8px;pointer-events:none;max-width:70vw;white-space:pre-wrap"; document.body.appendChild(dbg); }
  dbg.style.display = "block";
  dbg.textContent = `fps ${app.ticker.FPS.toFixed(0)} · ${app.renderer.name} · ${window.innerWidth}×${window.innerHeight}@${(window.devicePixelRatio || 1).toFixed(1)} · scene ${Scenes.top?.constructor.name ?? "-"}` + (errors.last ? `\nerr(${errors.count}): ${errors.last.slice(0, 160)}` : "");
}, 500);
window.addEventListener("pointerdown", () => audio.unlock(), { once: true });
Scenes.push(new HomeScene());
gsap.ticker.lagSmoothing(0);
