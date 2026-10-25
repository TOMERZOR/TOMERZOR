// Visits every page at desktop and phone size, in light and dark, and saves
// screenshots. Fails on any console error, page error or failed request, on
// anything poking out of the page, and on missing page basics (one <h1>, a
// unique title, a description, a canonical link on pages meant for search).
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

// [address, expected page] — "#/fit/trail-mix" is an old-style link that must land on its page
const ROUTES = [
  ["", "home"], ["feed", "feed"], ["fit-night-shift", "fit"], ["fit-created-by-god", "fit"], ["#/fit/trail-mix", "fit"],
  ["closet", "closet"], ["closet?tab=scans", "closet"], ["brands", "brands"], ["legal", "legal"],
  ["nope", "404"], ["deep/missing/page", "404"],
];
const titles = new Map();
const VIEWPORTS = [
  ["desktop", { width: 1360, height: 900 }],
  ["phone", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];

for (const [vpName, vp] of VIEWPORTS) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await newContext(browser, { viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, colorScheme: scheme });
    const page = await ctx.newPage();
    // the two missing addresses answer 404 on purpose
    const problems = watch(page, { ignore: [/\/fitsource\/(nope|deep\/missing\/page)$/, /status of 404/] });
    for (const [r, kind] of ROUTES) {
      const res = await page.goto(BASE + r);
      if ((kind === "404") !== (res.status() === 404)) failures.push(`${r}: HTTP ${res.status()}`);
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
          if (r.width && (r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== "fixed") out.push(el.className || el.tagName);
        }
        return [...new Set(out)].slice(0, 5);
      });
      if (poking.length) failures.push(`${vpName}/${scheme} ${r || "home"}: elements past the edge: ${poking.join(", ")}`);
      const seo = await page.evaluate(() => ({
        url: location.href,
        h1: document.querySelectorAll("h1").length,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || "",
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
        robots: document.querySelector('meta[name="robots"]')?.content || "",
        brokenImages: [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src),
        missingAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).map((i) => i.src),
      }));
      const label = `${vpName}/${scheme} ${r || "home"}`;
      if (seo.h1 !== 1) failures.push(`${label}: ${seo.h1} <h1> elements`);
      if (!seo.title || !seo.description) failures.push(`${label}: missing title or description`);
      const indexed = ["home", "feed", "fit", "brands", "legal"].includes(kind);
      if (indexed !== Boolean(seo.canonical)) failures.push(`${label}: canonical "${seo.canonical}"`);
      if (indexed !== seo.robots.startsWith("index")) failures.push(`${label}: robots "${seo.robots}"`);
      if (seo.brokenImages.length || seo.missingAlt.length) failures.push(`${label}: images broken ${seo.brokenImages} / without alt ${seo.missingAlt}`);
      if (r.startsWith("#/") && !/\/fit-trail-mix$/.test(seo.url)) failures.push(`${label}: old link stayed at ${seo.url}`);
      if (indexed && titles.has(seo.title) && titles.get(seo.title) !== r) failures.push(`${label}: title also used by ${titles.get(seo.title)}`);
      if (indexed) titles.set(seo.title, titles.get(seo.title) || r);
      const name = `${vpName}-${scheme}-${(r || "home").replace(/[#/?=]+/g, "_").replace(/^_/, "")}.png`;
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
