// Burns the yellow subtitles and the end title (subs.html) over the Seedance clip, keeping its native audio.
//   node edit.cjs <clip.mp4> <out.mp4> [--no-subs]
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const path = require("path");

const [clip, out] = process.argv.slice(2);
const probe = (e) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", e, "-of", "csv=p=0", clip]).toString().trim();
const [w, h] = probe("stream=width,height").split(",").map(Number);
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip]).toString());
const FPS = 24;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  // --no-subs keeps only the end title
  if (process.argv.includes("--no-subs")) await page.addInitScript(() => { window.SUBS = []; });
  await page.goto("file://" + path.join(__dirname, "subs.html"));
  await page.evaluate(async () => { await Promise.all([600, 700, 800].map((x) => document.fonts.load(`${x} 40px Heebo`, "אבג abc"))); await document.fonts.ready; });
  const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", clip, "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-filter_complex", `[0:v]fps=${FPS},scale=1920:1080:flags=lanczos,setsar=1[bg];[1:v]format=rgba[ov];[bg][ov]overlay=0:0:format=auto,format=yuv420p[v]`,
    "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out],
    { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(dur * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.__render(t), i / FPS);
    const png = await page.screenshot({ type: "png", omitBackground: true });
    if (!p.stdin.write(png)) await new Promise((r) => p.stdin.once("drain", r));
  }
  p.stdin.end();
  await new Promise((r) => p.on("close", r));
  await browser.close();
  console.log("wrote", out, `${w}x${h} -> 1920x1080`, dur.toFixed(2) + "s");
})();
