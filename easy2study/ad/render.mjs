// Renders the ad: every frame from index.html's render(t) into ffmpeg, plus the
// sound cue list for audio.py. Serve the repo root first (npx http-server -p 8790 .).
//   node render.mjs [out.mp4] [fps]   ->  frames.mp4 (no sound) + sfx.json
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";

const OUT = process.argv[2] || "frames.mp4";
const FPS = +(process.argv[3] || 30);
const URL = process.env.AD_URL || "http://localhost:8790/easy2study/ad/?render&t=0";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(URL);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
const dur = await page.evaluate(() => window.__dur);
fs.writeFileSync("sfx.json", JSON.stringify(await page.evaluate(() => window.__sfx)));

const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], { stdio: ["pipe", "inherit", "inherit"] });
const frames = Math.round(dur * FPS);
const started = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => window.__render(t), f / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 95, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 150 === 0) console.log(`frame ${f}/${frames} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log(`wrote ${OUT}: ${frames} frames at ${FPS} fps`);
