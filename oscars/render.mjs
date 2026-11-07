// Renders the video: index.html's render(t) frame by frame, split across several browsers that
// run in parallel, each piping JPEG frames into its own ffmpeg; the parts are then joined.
// Also writes the sound cue list (sfx.json) and music sections (marks.json) for audio.py.
// Serve this folder first: python3 -m http.server 8811 --bind 127.0.0.1
//   node render.mjs [out.mp4] [--workers 4] [--from 0] [--to end] [--fps 30]
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const OUT = args[0] && !args[0].startsWith("--") ? args[0] : "private/out/frames.mp4";
const FPS = +opt("fps", 30);
const WORKERS = +opt("workers", 4);
const URL = process.env.URL || "http://127.0.0.1:8811/index.html?render";
const TMP = path.join(path.dirname(OUT), "parts");
fs.mkdirSync(TMP, { recursive: true });

async function openPage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", (e) => console.error("page error:", String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  const cdp = await page.context().newCDPSession(page);
  return { browser, page, cdp };
}

// first page: timeline info
const first = await openPage();
const info = await first.page.evaluate(() => ({ dur: window.__dur, sfx: window.__sfx, marks: window.__marks, scenes: window.__scenes }));
fs.writeFileSync(path.join(path.dirname(OUT), "sfx.json"), JSON.stringify(info.sfx));
fs.writeFileSync(path.join(path.dirname(OUT), "marks.json"), JSON.stringify({ dur: info.dur, marks: info.marks, scenes: info.scenes }));
const f0 = Math.round(+opt("from", 0) * FPS);
const f1 = Math.min(Math.round(info.dur * FPS), Math.round(+opt("to", info.dur) * FPS));
console.log(`duration ${info.dur.toFixed(2)}s, frames ${f0}..${f1}, ${WORKERS} workers`);

const total = f1 - f0;
const chunk = Math.ceil(total / WORKERS);
const started = Date.now();
let done = 0;
async function worker(k, ctx) {
  const a = f0 + k * chunk, b = Math.min(f1, a + chunk);
  if (a >= b) return null;
  const file = path.join(TMP, `part${k}.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-tune", "film", "-pix_fmt", "yuv420p", "-threads", "2", file], { stdio: ["pipe", "inherit", "inherit"] });
  const { browser, page, cdp } = ctx || (await openPage());
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => window.__render(t), f / FPS);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 93, optimizeForSpeed: true, captureBeyondViewport: false });
    const buf = Buffer.from(data, "base64");
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    done++;
    if (k === 0 && f % 300 === 0) {
      const el = (Date.now() - started) / 1000;
      console.log(`${done}/${total} frames, ${el.toFixed(0)}s elapsed, ~${((el / done) * (total - done)).toFixed(0)}s left`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  return file;
}
const files = (await Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k, k === 0 ? first : null)))).filter(Boolean);
const list = path.join(TMP, "list.txt");
fs.writeFileSync(list, files.map((f) => `file '${path.resolve(f)}'`).join("\n"));
await new Promise((res, rej) => {
  const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", OUT], { stdio: "inherit" });
  p.on("close", (c) => (c ? rej(new Error("concat failed")) : res()));
});
console.log(`wrote ${OUT} (${total} frames) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
