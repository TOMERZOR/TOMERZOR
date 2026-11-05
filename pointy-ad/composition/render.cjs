// Renders the composition frame by frame with the preinstalled Playwright and pipes the frames to ffmpeg.
//   node render.cjs                      full render -> ../pointy.mp4 (+ sfx.json, audio.wav, ../pointy.jpg)
//   node render.cjs --snap 1.6,3.2 DIR   PNG snapshots of single moments, for checking
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FPS = 30;
const here = __dirname;
const url = "file://" + path.join(here, "index.html") + "?render";

async function open() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(url);
  // load every weight's Hebrew and Latin subset before the first frame
  await page.evaluate(async () => {
    const loads = [];
    for (const w of [400, 500, 600, 700, 800, 900]) loads.push(document.fonts.load(`${w} 40px Heebo`, "אבג abc 123"));
    await Promise.all(loads);
    await document.fonts.ready;
  });
  return { browser, page };
}

async function shot(page, t, poster = false) {
  await page.evaluate(([x, p]) => window.__render(x, p), [t, poster]);
  return page.screenshot({ type: "png" });
}

(async () => {
  const args = process.argv.slice(2);
  const { browser, page } = await open();
  if (args[0] === "--snap") {
    const dir = args[2] || path.join(here, "snaps");
    fs.mkdirSync(dir, { recursive: true });
    for (const t of args[1].split(",").map(Number)) fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.png`), await shot(page, t));
    await browser.close();
    return;
  }
  const dur = await page.evaluate(() => window.__dur);
  const poster = await page.evaluate(() => window.__poster);
  fs.writeFileSync(path.join(here, "sfx.json"), JSON.stringify(await page.evaluate(() => window.__sfx)));
  execFileSync("python3", [path.join(here, "audio.py"), path.join(here, "sfx.json"), path.join(here, "audio.wav")], { stdio: "inherit" });

  const out = path.join(here, "..", "pointy.mp4");
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-i", path.join(here, "audio.wav"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out], { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(dur * FPS);
  const posterPng = await shot(page, poster, true);
  fs.writeFileSync(path.join(here, "..", "poster.png"), posterPng);
  for (let i = 0; i < frames; i++) {
    // frame 0 is the poster, so the idle thumbnail everywhere is the hook
    const png = i === 0 ? posterPng : await shot(page, i / FPS);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${frames}\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(here, "..", "poster.png"), "-q:v", "2", path.join(here, "..", "pointy.jpg")]);
  fs.unlinkSync(path.join(here, "..", "poster.png"));
  console.log("wrote", out);
})();
