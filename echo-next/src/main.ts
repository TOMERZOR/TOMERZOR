/**
 * ECHO (rebuild). One WebGL canvas, a 1080×1920 design space scaled to the
 * phone with safe-area aware anchoring, and a scene stack. Rules live in
 * ../../echo/logic.js; this file and the scenes only draw and listen.
 */
import { Application, Container, Assets } from "pixi.js";
import gsap from "gsap";
import { W, H, C } from "./theme";
import { Scenes, layout } from "./scenes";
import { audio } from "./audio";
import { HomeScene } from "./scenes/home";
import { state } from "./state";

const app = new Application();
await app.init({ background: C.ink, resizeTo: window, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, preference: "webgl" });
document.body.appendChild(app.canvas);

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
try { await Promise.all(["700 40px Fredoka", "800 30px Nunito", "700 30px Heebo"].map((f) => document.fonts.load(f))); } catch { /* fallback fonts */ }
const ICONS = ["play", "pause", "back", "gear", "bag", "chest", "coin", "gem", "star", "star_off", "lock", "cal", "flame", "trophy", "crown", "ticket", "undo", "restart", "skip", "bulb", "sound", "music", "vibrate", "globe", "share", "replay", "check", "cross", "info", "home"];
await Assets.load([
  ...ICONS.map((n) => ({ alias: "icon_" + n, src: `assets/icons/${n}.png` })),
  { alias: "bg_lab", src: "assets/bg_lab.jpg" }, { alias: "bg_obs", src: "assets/bg_obs.jpg" }, { alias: "bg_mirror", src: "assets/bg_mirror.jpg" },
  { alias: "bg_title", src: "assets/bg_title.jpg" },
  { alias: "map_bg", src: "assets/map_bg.jpg" },
  ...["hero", "echo", "coin", "gem", "drone", "exit", "plate", "bot_knight", "bot_astro", "bot_mecha", "bot_ninja", "bot_pirate", "bot_samurai", "bot_wizard", "bot_royal"].map((n) => ({ alias: n, src: `assets/${n}.png` })),
  ...["floor_a", "floor_b", "floor_c", "wall_top", "wall_front", "plate_off", "plate_on", "gate_closed", "gate_open", "exit_t", "coin_t", "drone_t", "danger", "pad", "arrow", "void"].map((n) => ({ alias: n, src: `assets/tiles/${n.replace(/_t$/, "")}.png` })),
]);
fit();
audio.preload();
window.addEventListener("pointerdown", () => audio.unlock(), { once: true });
Scenes.push(new HomeScene());
gsap.ticker.lagSmoothing(0);
