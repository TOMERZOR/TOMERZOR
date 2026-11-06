// Cuts the five Higgsfield shots into the finished ad, draws overlay.html on top and mixes the sound.
//   node edit.cjs            -> ../pointy-live.mp4 and ../pointy-live.jpg
//   node edit.cjs --snap 1,9 -> PNG composites of single moments (footage + overlay), for checking
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FPS = 24;
const here = __dirname, clips = path.join(here, "..", "clips"), work = path.join(here, "work");
fs.mkdirSync(work, { recursive: true });
// [clip, in, out] in seconds of each generated shot; the cut points below follow from these
const CUTS = [["s1", 0, 4.0], ["s2", 0.25, 4.0], ["s3", 0.2, 5.0], ["s4", 0, 4.0], ["s5", 0, 5.0]];
let acc = 0; const starts = CUTS.map(([, a, b]) => { const s = acc; acc += b - a; return s; });
const TL = { s2: starts[1], s3: starts[2], s4: starts[3], s5: starts[4], end: +acc.toFixed(3), press: 2.1 };
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

// 1. footage: trim, conform to 1080×1920 at 24 fps, join with hard cuts, keep the native audio
const footage = path.join(work, "footage.mp4");
const inputs = CUTS.flatMap(([c]) => ["-i", path.join(clips, c + ".mp4")]);
const fc = CUTS.map(([, a, b], i) =>
  `[${i}:v]trim=${a}:${b},setpts=PTS-STARTPTS,scale=1080:1920,fps=${FPS},format=yuv420p,setsar=1[v${i}];` +
  `[${i}:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[a${i}]`).join(";") +
  ";" + CUTS.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${CUTS.length}:v=1:a=1[v][a]`;
ff([...inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "12", "-preset", "fast", "-c:a", "pcm_s16le", footage.replace(".mp4", ".mov")]);

// 2. the score (music bed + UI sweeteners) on the same timeline
fs.writeFileSync(path.join(work, "timeline.json"), JSON.stringify(TL));
execFileSync("python3", [path.join(here, "score.py"), path.join(work, "timeline.json"), path.join(work, "score.wav")], { stdio: "inherit" });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.addInitScript((tl) => { window.TL = tl; }, TL);
  await page.goto("file://" + path.join(here, "overlay.html"));
  await page.evaluate(async () => {
    await Promise.all([500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px Heebo`, "אבג abc 123")));
    await document.fonts.ready;
  });
  const shot = async (t) => { await page.evaluate((x) => window.__render(x), t); return page.screenshot({ type: "png", omitBackground: true }); };

  const args = process.argv.slice(2);
  if (args[0] === "--snap") {
    const dir = path.join(here, "snaps"); fs.mkdirSync(dir, { recursive: true });
    for (const t of args[1].split(",").map(Number)) {
      const ov = path.join(work, "ov.png"); fs.writeFileSync(ov, await shot(t));
      ff(["-ss", String(t), "-i", footage.replace(".mp4", ".mov"), "-i", ov, "-filter_complex", "[0:v][1:v]overlay=0:0", "-frames:v", "1", path.join(dir, `t${t.toFixed(2)}.png`)]);
    }
    await browser.close(); return;
  }

  // 3. composite: footage + overlay frames piped in as PNG with alpha + native audio and score
  const out = path.join(here, "..", "pointy-live.mp4");
  const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", footage.replace(".mp4", ".mov"), "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-i", path.join(work, "score.wav"),
    "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v];[0:a]highpass=f=60,volume=4.5[na];[na][2:a]amix=inputs=2:normalize=0,alimiter=limit=0.89[a]",
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out], { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(TL.end * FPS);
  for (let i = 0; i < frames; i++) {
    const png = await shot(i / FPS);
    if (!p.stdin.write(png)) await new Promise((r) => p.stdin.once("drain", r));
  }
  p.stdin.end();
  await new Promise((r) => p.on("close", r));
  await browser.close();
  ff(["-i", out, "-frames:v", "1", "-q:v", "2", path.join(here, "..", "pointy-live.jpg")]);
  console.log("wrote", out, TL);
})();
