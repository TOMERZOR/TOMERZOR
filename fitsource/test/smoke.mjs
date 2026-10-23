// Visits every page at desktop and phone size, in light and dark, and saves
// screenshots. Fails on any console error, page error or failed request.
//   node test/smoke.mjs [outdir]
import fs from "node:fs";
import path from "node:path";
import { startServer, launch, newContext, watch, FITSOURCE } from "./harness.mjs";

const out = process.argv[2] || path.join(FITSOURCE, "test/out/smoke");
fs.mkdirSync(out, { recursive: true });
const PORT = 8731;
const BASE = `http://127.0.0.1:${PORT}/fitsource/`;
const server = await startServer(PORT);
const browser = await launch();
const failures = [];

const ROUTES = ["", "#/feed", "#/fit/night-shift", "#/fit/created-by-god", "#/closet", "#/closet/scans", "#/brands", "#/legal", "#/nope"];
const VIEWPORTS = [
  ["desktop", { width: 1360, height: 900 }],
  ["phone", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];

for (const [vpName, vp] of VIEWPORTS) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await newContext(browser, { viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, colorScheme: scheme });
    const page = await ctx.newPage();
    const problems = watch(page);
    for (const r of ROUTES) {
      await page.goto(BASE + r);
      await page.waitForSelector("main .view", { timeout: 10000 });
      await page.waitForTimeout(900);
      // reveal everything below the fold for the full-page shot
      await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in")));
      await page.evaluate(() => Promise.all([...document.images].map((i) => (i.loading = "eager", i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))))));
      await page.waitForTimeout(1100);
      // Anything poking out of the viewport that isn't inside its own scroller
      // (body hides horizontal overflow, so scrollWidth alone can't see it).
      const poking = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const clipped = (el) => {
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX;
            if (ox !== "visible") return true;
          }
          return false;
        };
        const out = [];
        for (const el of document.querySelectorAll("main *, header *, footer *")) {
          const r = el.getBoundingClientRect();
          if (r.width && r.right > vw + 1 && !clipped(el) && getComputedStyle(el).position !== "fixed") out.push(el.className || el.tagName);
        }
        return [...new Set(out)].slice(0, 5);
      });
      if (poking.length) failures.push(`${vpName}/${scheme} ${r || "home"}: elements past the right edge: ${poking.join(", ")}`);
      const name = `${vpName}-${scheme}-${(r || "home").replace(/[#/]+/g, "_").replace(/^_/, "")}.png`;
      await page.screenshot({ path: path.join(out, name), fullPage: true });
    }
    for (const p of problems) failures.push(`${vpName}/${scheme}: ${p}`);
    await ctx.close();
  }
}

await browser.close();
server.close();
if (failures.length) {
  console.log("FAIL\n" + [...new Set(failures)].join("\n"));
  process.exit(1);
}
console.log(`ok: ${ROUTES.length} pages x 4 modes, screenshots in ${out}`);
