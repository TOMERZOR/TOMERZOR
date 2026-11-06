// Renders the screen content of every slide in index.html (the laptop screens) at 2× to work/screen-01.png …
// compose.py then places them on the green screen of the MacBook photo.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const work = path.join(__dirname, "work");
  fs.mkdirSync(work, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(__dirname, "index.html"));
  await page.evaluate(async () => {
    await Promise.all([400, 500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px Heebo`, "אבג abc 123")));
    await document.fonts.ready;
  });
  const n = await page.$$eval(".slide", (els) => els.length);
  for (let i = 0; i < n; i++) {
    await page.$$eval(".slide", (els, k) => els.forEach((el, j) => {
      el.style.display = j === k ? "" : "none";
      const mac = el.querySelector(".mac");
      if (mac) { mac.style.transform = "none"; mac.style.left = "40px"; mac.style.top = "40px"; }
    }), i);
    const scr = await page.$(`#s${i + 1} .screen`);
    const file = path.join(work, `screen-${String(i + 1).padStart(2, "0")}.png`);
    await scr.screenshot({ path: file });
    console.log("wrote", file);
  }
  await browser.close();
})();
