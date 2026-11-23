// Copies the web app from ../arslate into www/ and adds the iPhone-only layer (native.js):
// haptics, the AI consent sheet, and the daily AI quota with a rewarded ad.
// The offline dictionary engine ships inside the app, so it works with no network at all.
//
// Settings (environment variables, all optional):
//   ARSLATE_API       the AI server       (default: the deployed Cloudflare worker)
//   ADMOB_REWARDED    rewarded ad unit id (default: the real ArsLate unit; with ADMOB_TESTING on, the plugin swaps in Google's test unit)
//   ADMOB_TESTING     "0" for real ads    (default: test ads)
//   FREE_PER_DAY      free AI translations a day (default 5)
//   PER_AD            AI translations a rewarded ad adds (default 10)
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";

const API = process.env.ARSLATE_API ?? "https://arslate-api.moffy-app.workers.dev";
const NATIVE = {
  rewardedId: process.env.ADMOB_REWARDED || "ca-app-pub-4472181066002865/7969355780",
  testing: process.env.ADMOB_TESTING !== "0",
  freePerDay: Number(process.env.FREE_PER_DAY || 5),
  perAd: Number(process.env.PER_AD || 10),
};

rmSync("www", { recursive: true, force: true });
mkdirSync("www");
cpSync("../arslate", "www", { recursive: true, filter: (p) => !/\/(worker|README\.md|privacy\.html)$/.test(p) && !p.includes("/worker/") });
copyFileSync("native.js", "www/native.js");

writeFileSync("www/config.js",
  `window.ARSLATE_CONFIG = ${JSON.stringify({ apiBase: API, shareUrl: "https://tomerzor.github.io/TOMERZOR/arslate/" }, null, 2)};\n` +
  `window.ARSLATE_NATIVE_CONFIG = ${JSON.stringify(NATIVE, null, 2)};\n`);

const html = readFileSync("www/index.html", "utf8");
const marker = '<script src="engine.js"></script>';
if (!html.includes(marker)) throw new Error("index.html changed: can't find the engine.js script tag");
writeFileSync("www/index.html", html
  .replace(marker, `${marker}\n<script src="native.js"></script>`)
  // the app is the install, so no web manifest / PWA prompts inside it
  .replace(/<link rel="manifest"[^>]*>\n?/, ""));

console.log("www/ ready · api =", API || "(offline only)", "· ads =", NATIVE.testing ? "TEST" : "LIVE", NATIVE.rewardedId);
