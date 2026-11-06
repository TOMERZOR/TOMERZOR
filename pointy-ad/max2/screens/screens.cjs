// Renders the laptop-screen scenes of index.html frame by frame, 24 fps, three sub-frames per frame
// (filmed.py blends them into motion blur), plus where the hand-held camera points on every frame.
//   node screens.cjs <scene> <seconds> <outdir>
// writes <outdir>/f0000_0.png, f0000_1.png, … and <outdir>/cams.json
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const [scene, secs, outdir] = process.argv.slice(2);
const FPS = 24, SUB = 3;
fs.mkdirSync(outdir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(__dirname, "index.html"));
  await page.evaluate(async () => { await document.fonts.ready; });
  const n = Math.ceil(parseFloat(secs) * FPS) + 1, cams = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < SUB; j++) {
      const t = (i + j / (2 * SUB)) / FPS;                         // a 180° shutter: the first half of the frame interval
      const cam = await page.evaluate(([s, t]) => window.__cam(s, t), [scene, t]);
      if (j === 0) cams.push(cam);
      await page.screenshot({ path: path.join(outdir, `f${String(i).padStart(4, "0")}_${j}.png`) });
    }
  }
  fs.writeFileSync(path.join(outdir, "cams.json"), JSON.stringify(cams));
  await browser.close();
  console.log(`${scene}: ${n} frames → ${outdir}`);
})();
