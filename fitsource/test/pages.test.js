// The static pages written by tools/build-pages.mjs must match the app: one
// file per page, each with the title, description and canonical address the
// app gives it, valid structured data, and a sitemap listing exactly the pages
// meant for search. If this fails, run: node tools/build-pages.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.location = new URL("https://example.org/fitsource/");
const { pageMeta, pageRoutes, canonicalUrl } = await import("../assets/js/seo.js");
const { pageFor } = await import("../assets/js/router.js");
const { CONFIG } = await import("../assets/js/config.js");

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const attr = (html, re) => (html.match(re) || [])[1];
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

test("every page has its own up-to-date file", () => {
  const titles = new Set();
  for (const route of pageRoutes()) {
    const file = `${pageFor(route) || "index"}.html`;
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is missing`);
    const html = read(file);
    const meta = pageMeta(route);
    assert.equal(unescape(attr(html, /<title>([^<]*)<\/title>/)), meta.title, `${file}: title`);
    assert.equal(unescape(attr(html, /<meta name="description" content="([^"]*)">/)), meta.description, `${file}: description`);
    assert.equal(attr(html, /<link rel="canonical" href="([^"]*)">/), meta.index ? canonicalUrl(route) : undefined, `${file}: canonical`);
    assert.equal(attr(html, /<meta name="robots" content="([^"]*)">/), meta.index ? "index, follow" : "noindex, follow", `${file}: robots`);
    assert.ok(fs.existsSync(path.join(ROOT, new URL(attr(html, /<meta property="og:image" content="([^"]*)">/)).pathname.replace(new URL(CONFIG.siteUrl).pathname, ""))), `${file}: share image file`);
    if (meta.index) {
      assert.ok(!titles.has(meta.title), `${file}: title used twice`);
      titles.add(meta.title);
      const ld = JSON.parse(attr(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/));
      assert.equal(ld["@context"], "https://schema.org", `${file}: structured data`);
    }
    if (route !== "scan") assert.equal((attr(html, /<main id="main" tabindex="-1" data-prerendered>([\s\S]*?)<\/main>/) || "").match(/<h1[\s>]/g)?.length, 1, `${file}: one <h1> in the prerendered page`);
  }
});

test("sitemap, robots.txt, llms.txt and 404.html agree with the site address", () => {
  const listed = [...read("sitemap.xml").matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  const expected = pageRoutes().filter((r) => pageMeta(r).index).map(canonicalUrl);
  assert.deepEqual(listed, expected);
  assert.match(read("robots.txt"), new RegExp(`Sitemap: ${CONFIG.siteUrl.replace(/[.]/g, "\\.")}sitemap\\.xml`));
  assert.ok(read("llms.txt").includes(CONFIG.siteUrl), "llms.txt links to the site");
  const notFound = read("404.html");
  assert.equal(attr(notFound, /<base href="([^"]*)">/), new URL(CONFIG.siteUrl).pathname);
  assert.match(notFound, /<meta name="robots" content="noindex, follow">/);
  assert.ok(!/rel="canonical"/.test(notFound), "404.html has no canonical link");
  const ico = fs.readFileSync(path.join(ROOT, "favicon.ico"));
  assert.equal(ico.readUInt16LE(2), 1, "favicon.ico is an icon file");
  assert.equal(ico.readUInt16LE(4), 3, "favicon.ico holds 16, 32 and 48 px");
});

test("page addresses round-trip", async () => {
  const { href } = await import("../assets/js/router.js");
  globalThis.document = { baseURI: "https://example.org/fitsource/" };
  const { routeOf } = await import("../assets/js/router.js");
  for (const r of ["", "feed", "fit/night-shift", "closet", "closet/watching", "scan", "scan/abc123", "brands", "legal"]) {
    assert.equal(routeOf(new URL(href(r), document.baseURI).href), r, `route ${r || "home"}`);
  }
  assert.equal(routeOf("https://example.org/fitsource/feed.html"), "feed");
  assert.equal(routeOf("https://example.org/fitsource/#/fit/trail-mix"), "fit/trail-mix"); // old links
  assert.equal(routeOf("https://example.org/product.html"), null); // the store next door
  assert.equal(routeOf("https://example.org/fitsource/assets/img/og/home.jpg"), null);
  assert.equal(routeOf("https://example.org/fitsource/a/b"), null);
  delete globalThis.document;
});
