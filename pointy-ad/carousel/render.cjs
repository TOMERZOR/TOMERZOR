// Screenshots every .slide in layout.html to slides/01.png … 08.png (1080×1350) and writes a preview strip.
//   node render.cjs
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

(async () => {
  const out = path.join(__dirname, "slides");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(__dirname, "layout.html"));
  await page.evaluate(async () => {
    await Promise.all([400, 500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px Heebo`, "אבג abc 123")));
    await document.fonts.ready;
  });
  const n = await page.$$eval(".slide", (els) => els.length);
  for (let i = 0; i < n; i++) {
    // show one slide at a time at the top-left corner, so every slide renders inside the viewport
    await page.$$eval(".slide", (els, k) => els.forEach((el, j) => { el.style.display = j === k ? "" : "none"; }), i);
    const file = path.join(out, `${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    console.log("wrote", file);
  }
  await browser.close();
  // a side-by-side strip, to check how the slides flow into each other
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-pattern_type", "glob", "-i", path.join(out, "0*.png"),
    "-vf", "scale=360:450,tile=8x1", "-frames:v", "1", path.join(__dirname, "strip.png")]);
})();
