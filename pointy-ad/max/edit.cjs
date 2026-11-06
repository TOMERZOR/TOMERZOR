// Finishes the Max short: the clip (optionally with the poster already relabelled in Hebrew by poster.py),
// extended by the Pointy outro from subs.html, with the clip's native audio plus the outro sound (sting.py).
//   node edit.cjs <clip.mp4> <out.mp4> [--subs] [--target X,Y]
//   --subs        also burn the yellow film subtitles
//   --target X,Y  where the cursor clicks, in 1920×1080 coordinates (poster.py prints it)
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const [clip, out] = args;
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip]).toString());
const FPS = 24;
const OUTRO_AT = +(dur - 1.15).toFixed(3);     // the wipe covers the frame just as the clip ends
const END = +(OUTRO_AT + 4.3).toFixed(3);
const TAIL = END - dur;
const target = (opt("--target") || "1050,330").split(",").map(Number);
const SUBS = [
  [0.3, 3.0, "אני עובד פה כבר שלוש שנים."],
  [3.25, 6.15, "אף אחד לא יודע שאני לא מוצא את כפתור הייצוא."],
  [6.45, 8.9, "עד היום."],
  [9.2, 11.65, "<bdi>⌥ + Space</bdi>. והוא פשוט מראה לי איפה."],
  [11.95, 13.5, "עכשיו אני העובד של החודש."],
];
const work = path.join(__dirname, "work");
fs.mkdirSync(work, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.addInitScript((cfg) => Object.assign(window, cfg),
    { OUTRO_AT, END, TARGET_X: target[0], TARGET_Y: target[1], ...(args.includes("--subs") ? { SUBS } : {}) });
  await page.goto("file://" + path.join(__dirname, "subs.html"));
  await page.evaluate(async () => { await Promise.all([600, 700, 800].map((x) => document.fonts.load(`${x} 40px Heebo`, "אבג abc"))); await document.fonts.ready; });

  // the outro sound, on the same clock
  fs.writeFileSync(path.join(work, "cues.json"), JSON.stringify(await page.evaluate(() => window.__cues)));
  execFileSync("python3", [path.join(__dirname, "sting.py"), path.join(work, "cues.json"), String(END), path.join(work, "sting.wav")], { stdio: "inherit" });

  const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", clip, "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-i", path.join(work, "sting.wav"),
    "-filter_complex",
    `[0:v]fps=${FPS},scale=1920:1080:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=${TAIL.toFixed(3)}[bg];[1:v]format=rgba[ov];` +
    `[bg][ov]overlay=0:0:format=auto,format=yuv420p[v];[0:a]apad=whole_dur=${END}[ca];[ca][2:a]amix=inputs=2:normalize=0,alimiter=limit=0.89[a]`,
    "-map", "[v]", "-map", "[a]", "-t", String(END), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out],
    { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(END * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.__render(t), i / FPS);
    const png = await page.screenshot({ type: "png", omitBackground: true });
    if (!p.stdin.write(png)) await new Promise((r) => p.stdin.once("drain", r));
  }
  p.stdin.end();
  await new Promise((r) => p.on("close", r));
  await browser.close();
  console.log("wrote", out, `${END.toFixed(2)}s, outro at ${OUTRO_AT}s, click at ${target}`);
})();
