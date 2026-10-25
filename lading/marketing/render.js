// Renders each .slide in banners.html to its own PNG in ./png.
// Usage: node lading/marketing/render.js   (needs Playwright with Chromium)
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

(async () => {
  const dir = __dirname;
  const out = path.join(dir, "png");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 2000 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(dir, "banners.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const slides = await page.$$(".slide");
  for (const s of slides) {
    const id = await s.getAttribute("id");
    await s.screenshot({ path: path.join(out, `lading-${id}.png`) });
    console.log("wrote", `png/lading-${id}.png`);
  }
  await browser.close();
})();
