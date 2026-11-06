// Finishes "This is Max.": the cut picture (build.py) with the titles of overlay.html on top and the
// soundtrack of mix.py, 1920×1080 at 48 fps.
//   node edit.cjs <base.mp4> <out.mp4> [--no-music]
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const [base, out] = args;
const noMusic = args.includes("--no-music");
const work = path.join(__dirname, "work");
const TL = JSON.parse(fs.readFileSync(path.join(work, "timeline.json")));
const FPS = TL.fps, END = TL.end;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => { console.error("overlay error:", e.message); process.exit(1); });
  await page.addInitScript((tl) => { window.TL = tl; }, TL);
  await page.goto("file://" + path.join(__dirname, "overlay.html"));
  await page.waitForFunction(() => window.__ready === true);

  // the sound, on the overlay's clock
  fs.writeFileSync(path.join(work, "cues.json"), JSON.stringify(await page.evaluate(() => window.__cues())));
  const wav = path.join(work, noMusic ? "mix-nomusic.wav" : "mix.wav");
  execFileSync("python3", [path.join(__dirname, "mix.py"), wav, ...(noMusic ? ["--no-music"] : [])], { stdio: "inherit" });

  const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", base, "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-i", wav,
    "-filter_complex", "[1:v]format=rgba[ov];[0:v][ov]overlay=0:0:format=auto,format=yuv420p[v]",
    "-map", "[v]", "-map", "2:a", "-t", String(END), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-c:a", "aac", "-b:a", "256k",
    "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  p.on("exit", (code) => { if (code) { console.error("ffmpeg failed with code", code); process.exit(1); } });
  const frames = Math.round(END * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.__render(t), i / FPS);
    const png = await page.screenshot({ type: "png", omitBackground: true });
    if (!p.stdin.write(png)) await new Promise((r) => p.stdin.once("drain", r));
    if (i % 480 === 0) console.log(`  overlay ${(i / FPS).toFixed(1)}s`);
  }
  p.stdin.end();
  await new Promise((r) => p.on("close", r));
  await browser.close();
  console.log("wrote", out, `${END.toFixed(2)}s`);
})();
