// Screenshots of chosen moments, for checking the composition without a full render.
//   node shots.mjs out_dir 12.5 30 61.2 ...      (times in seconds)
//   node shots.mjs out_dir --scenes               (one frame from the middle of every scene part)
// Serve this folder first: python3 -m http.server 8811 --bind 127.0.0.1
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";

const out = process.argv[2] || "shots";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(process.env.URL || "http://127.0.0.1:8811/index.html?render");
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const info = await page.evaluate(() => ({ dur: window.__dur, scenes: window.__scenes, cues: window.__sfx.length }));
console.log("duration", info.dur.toFixed(1), "s, cues", info.cues);
let times = process.argv.slice(3).map(Number).filter((x) => !Number.isNaN(x));
if (process.argv.includes("--scenes")) {
  times = [];
  for (const [, a, b] of info.scenes) { const d = b - a; for (const f of d > 12 ? [0.15, 0.4, 0.62, 0.85] : [0.5]) times.push(+(a + d * f).toFixed(2)); }
}
if (process.argv.includes("--list")) console.log(info.scenes.map((s) => s.join(" ")).join("\n"));
for (const t of times) {
  await page.evaluate((x) => window.__render(x), t);
  await page.screenshot({ path: `${out}/t${String(t.toFixed(2)).padStart(7, "0")}.jpg`, type: "jpeg", quality: 80 });
}
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
