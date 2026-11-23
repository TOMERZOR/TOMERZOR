// Renders the composition: serves this folder, steps render(t) frame by frame
// in Chromium and pipes the frames to ffmpeg.
//   node render.cjs stills out-dir 1.2 4.5 ...    PNG stills at those times
//   node render.cjs video out.mp4 [poster-time]    30 fps H.264 (no audio)
//   node render.cjs cues sfx.json                  the sound cue list
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = __dirname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2" };
const FPS = 30;

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const f = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
      res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(0, () => resolve(srv));
  });
}

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const srv = await serve();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  await p.goto(`http://localhost:${srv.address().port}/index.html?render`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const dur = await p.evaluate(() => window.__dur);
  if (mode === "cues") {
    fs.writeFileSync(out, JSON.stringify(await p.evaluate(() => window.__sfx)));
  } else if (mode === "stills") {
    fs.mkdirSync(out, { recursive: true });
    for (const t of rest.map(Number)) {
      await p.evaluate((t) => window.__render(t), t);
      await p.screenshot({ path: path.join(out, `t${t.toFixed(2)}.png`) });
    }
  } else if (mode === "video") {
    const posterT = rest[0] != null ? Number(rest[0]) : null;
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
      "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
    const n = Math.round(dur * FPS);
    for (let i = 0; i < n; i++) {
      // frame 0 is the poster, so the idle thumbnail everywhere is the best frame
      const t = i === 0 && posterT != null ? posterT : i / FPS;
      await p.evaluate((t) => window.__render(t), t);
      const buf = await p.screenshot({ type: "png" });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % 60 === 0) process.stdout.write(`${i}/${n} `);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    console.log("\ndone", out);
  }
  await b.close();
  srv.close();
})();
