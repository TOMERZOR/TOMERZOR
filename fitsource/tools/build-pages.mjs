// Writes a static HTML file for every page, so search engines and link
// previews (WhatsApp, Instagram, X) see each page's own title, description,
// share image and content without running the app:
//   index.html, feed.html, fit-<id>.html, brands.html, legal.html,
//   closet.html, scan.html, 404.html
// plus sitemap.xml, robots.txt, llms.txt, favicon.ico and the share images
// in assets/img/og/. Run it after changing pages, the feed or siteUrl:
//   node tools/build-pages.mjs
// It renders each page with the app itself in a headless browser.
import fs from "node:fs";
import path from "node:path";
import { startServer, launch, newContext, FITSOURCE } from "../test/harness.mjs";

globalThis.location = new URL("http://127.0.0.1/fitsource/"); // the modules below only read it inside functions
const { CONFIG } = await import("../assets/js/config.js");
const { pageMeta, notFoundMeta, pageRoutes, canonicalUrl } = await import("../assets/js/seo.js");
const { pageFor, href } = await import("../assets/js/router.js");
const { FITS, findFit } = await import("../assets/js/data/fits.js");

const SITE = CONFIG.siteUrl;
if (!/^https:\/\/[^/]+\/(.*\/)?$/.test(SITE)) throw new Error(`CONFIG.siteUrl must be an https address ending in "/": ${SITE}`);
const PORT = 8790;
const LOCAL = `http://127.0.0.1:${PORT}/fitsource/`;
const abs = (p) => new URL(p, SITE).href;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const jsonld = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const write = (name, data) => fs.writeFileSync(path.join(FITSOURCE, name), data);

const ORG = {
  "@type": "OnlineBusiness",
  "@id": `${SITE}#org`,
  name: "FitSource",
  url: SITE,
  logo: abs("assets/img/icon-512.png"),
  description: "FitSource מזהה כל פריט בתמונה של לוק ומוצא איפה קונים אותו בישראל.",
  areaServed: { "@type": "Country", name: "Israel" },
  knowsLanguage: "he",
};
const WEBSITE = { "@type": "WebSite", "@id": `${SITE}#website`, name: "FitSource", url: SITE, inLanguage: "he-IL", publisher: { "@id": `${SITE}#org` } };

/** Structured data for a page: the site and business on the home page, the page and its breadcrumbs elsewhere. */
function structuredData(route, meta) {
  const url = canonicalUrl(route);
  if (route === "") return { "@context": "https://schema.org", "@graph": [ORG, WEBSITE] };
  const page = { "@type": "WebPage", "@id": url, url, name: meta.title, description: meta.description, inLanguage: "he-IL", isPartOf: { "@id": `${SITE}#website` } };
  if (meta.breadcrumbs.length > 1) {
    page.breadcrumb = {
      "@type": "BreadcrumbList",
      itemListElement: meta.breadcrumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: canonicalUrl(c.route) })),
    };
  }
  const fit = route.startsWith("fit/") && findFit(route.slice(4));
  if (fit) page.primaryImageOfPage = { "@type": "ImageObject", contentUrl: abs(`assets/img/fits/${fit.img}.jpg`), caption: meta.imageAlt };
  return { "@context": "https://schema.org", ...page };
}

function headFor(route, meta) {
  const url = canonicalUrl(route);
  const lines = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    `<meta name="robots" content="${meta.index ? "index, follow" : "noindex, follow"}">`,
  ];
  if (meta.index) lines.push(`<link rel="canonical" href="${esc(url)}">`);
  lines.push(
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="FitSource">`,
    `<meta property="og:locale" content="he_IL">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(meta.notFound ? SITE : url)}">`,
    `<meta property="og:image" content="${esc(abs(meta.image))}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(meta.imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(meta.title)}">`,
    `<meta name="twitter:description" content="${esc(meta.description)}">`,
    `<meta name="twitter:image" content="${esc(abs(meta.image))}">`,
  );
  if (meta.index) lines.push(jsonld(structuredData(route, meta)));
  return lines.join("\n");
}

const TEMPLATE = fs.readFileSync(path.join(FITSOURCE, "index.html"), "utf8");
const HEAD_RE = /<!-- page:head[^>]*-->[\s\S]*?<!-- \/page:head -->/;
const MAIN_RE = /<main id="main" tabindex="-1"[^>]*>[\s\S]*?<\/main>/;
if (!HEAD_RE.test(TEMPLATE) || !MAIN_RE.test(TEMPLATE)) throw new Error("index.html is missing the page:head markers or <main id=\"main\">");

function pageHtml(route, meta, body, { base } = {}) {
  let out = TEMPLATE.replace(HEAD_RE, `<!-- page:head (written per page by tools/build-pages.mjs) -->\n${headFor(route, meta)}\n<!-- /page:head -->`);
  out = out.replace(/\n<base href="[^"]*">/, "");
  // 404.html is served for any missing address, at any depth: anchor its relative links at the site root.
  if (base) out = out.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<base href="${esc(base)}">`);
  out = out.replace(MAIN_RE, body ? `<main id="main" tabindex="-1" data-prerendered>${body}</main>` : `<main id="main" tabindex="-1"></main>`);
  return out;
}

// ---------- share images ----------

const FONT_CSS = `
@font-face { font-family: "Archivo"; src: url("${LOCAL}assets/fonts/archivo.woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: "Heebo"; src: url("${LOCAL}assets/fonts/heebo-hebrew.woff2"); font-weight: 100 900; unicode-range: U+0590-05FF, U+20AA, U+FB1D-FB4F; }
@font-face { font-family: "Geist Mono"; src: url("${LOCAL}assets/fonts/geist-mono.woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: #f1f1ee; color: #121214; font-family: "Archivo", "Heebo", sans-serif; direction: rtl; }
.card { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding: 56px 64px; }
.copy { display: flex; flex-direction: column; justify-content: center; gap: 22px; }
.logo { display: flex; align-items: center; gap: 14px; direction: ltr; justify-content: flex-end; font-weight: 850; font-stretch: 125%; font-size: 30px; letter-spacing: -0.02em; }
.logo svg { width: 38px; height: 38px; }
h1 { font-family: "Heebo", "Archivo", sans-serif; font-weight: 850; font-size: 72px; line-height: 1; letter-spacing: -0.015em; }
h1.long { font-size: 58px; }
h1.home { font-size: 62px; }
.hl { background: linear-gradient(transparent 58%, #c9f23a 58%, #c9f23a 92%, transparent 92%); }
p { font-size: 25px; line-height: 1.45; color: #45454b; }
.mono { font-family: "Geist Mono", "Heebo", monospace; font-size: 20px; color: #66666d; }
.pieces { display: grid; gap: 9px; font-size: 22px; }
.pieces div { display: flex; gap: 12px; align-items: center; }
.n { width: 30px; height: 30px; border-radius: 50%; background: #c9f23a; border: 2px solid #121214; display: grid; place-items: center; font: 700 15px "Geist Mono", monospace; flex: none; }
.n.sold { background: #bf3319; border-color: #fff; color: #fff; }
.price { font-weight: 600; color: #45454b; margin-inline-start: auto; }
.stamp { color: #bf3319; font-weight: 800; }
.photos { position: relative; }
.photo { position: absolute; border-radius: 22px; overflow: hidden; box-shadow: 0 30px 60px -24px rgba(0,0,0,.45); background: #ddd; }
.photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dot { position: absolute; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; background: #c9f23a; border: 2px solid #121214; display: grid; place-items: center; font: 700 14px "Geist Mono", monospace; }
.dot.sold { background: #bf3319; border-color: #fff; color: #fff; }
`;
const LOGO = `<div class="logo"><svg viewBox="0 0 28 28"><path d="M2 9V4a2 2 0 0 1 2-2h5M19 2h5a2 2 0 0 1 2 2v5M26 19v5a2 2 0 0 1-2 2h-5M9 26H4a2 2 0 0 1-2-2v-5" fill="none" stroke="#121214" stroke-width="2.4" stroke-linecap="round"/><circle cx="14" cy="14" r="5" fill="#c9f23a" stroke="#121214" stroke-width="1.6"/></svg><span>FITSOURCE</span></div>`;
const shekel = (n) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n).replace(/\u200f/g, "");

function photo(fit, { x, y, w, h, rot = 0, dots = true }) {
  const spots = dots ? fit.items.map((it, i) => `<span class="dot ${it.status === "sold_out" ? "sold" : ""}" style="left:${it.x}%;top:${it.y}%">${i + 1}</span>`).join("") : "";
  return `<div class="photo" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${rot}deg)"><img src="${LOCAL}assets/img/fits/${fit.img}-sm.jpg">${spots}</div>`;
}

function shareCard(route) {
  const [name, arg] = route.split("/");
  if (name === "fit") {
    const fit = findFit(arg);
    const sold = fit.items.filter((i) => i.status === "sold_out").length;
    const pieces = fit.items.slice(0, 4).map((it, i) => `<div><span class="n ${it.status === "sold_out" ? "sold" : ""}">${i + 1}</span><bdi>${esc(it.name)}</bdi><span class="price">${it.status === "sold_out" ? '<span class="stamp">אזל</span>' : it.price != null ? shekel(it.price) : ""}</span></div>`).join("");
    return `<div class="card"><div class="copy">${LOGO}<h1 class="${fit.title.length > 12 ? "long" : ""}"><bdi>${esc(fit.title)}</bdi></h1><span class="mono">‎@${esc(fit.handle)} · ${sold ? (sold === 1 ? "פריט אחד אזל" : `${sold} פריטים אזלו`) : "כל הפריטים במלאי"}</span><div class="pieces">${pieces}</div></div><div class="photos">${photo(fit, { x: 70, y: 0, w: 390, h: 518 })}</div></div>`;
  }
  if (name === "feed") {
    const picks = ["night-shift", "butter-hour", "slab-day", "quiet-money"].map(findFit);
    const imgs = picks.map((f, i) => photo(f, { x: (i % 2) * 238, y: Math.floor(i / 2) * 270 - 10, w: 222, h: 256, dots: false })).join("");
    return `<div class="card"><div class="copy">${LOGO}<h1>הפיד</h1><p>${FITS.length} לוקים שסורקים עכשיו, עם החנות, המחיר והמלאי של כל פריט.</p></div><div class="photos">${imgs}</div></div>`;
  }
  if (name === "brands") {
    const picks = ["created-by-god", "shop-floor"].map(findFit);
    return `<div class="card"><div class="copy">${LOGO}<h1 class="long">כל סריקה היא מישהו שמחפש את המוצר שלכם</h1><p>FitSource למותגים: ביקוש אמיתי לפריטים שלכם.</p></div><div class="photos">${photo(picks[1], { x: 0, y: 40, w: 250, h: 333, rot: -4 })}${photo(picks[0], { x: 210, y: 90, w: 260, h: 346, rot: 3 })}</div></div>`;
  }
  const picks = ["night-shift", "slab-day"].map(findFit);
  return `<div class="card"><div class="copy">${LOGO}<h1 class="home">מוצאים את החנות<br>מאחורי <span class="hl">כל לוק</span></h1><p>מעלים צילום מסך של לוק, ומקבלים כל פריט, את החנות ומה אזל מהמלאי.</p></div><div class="photos">${photo(picks[1], { x: 0, y: 50, w: 255, h: 340, rot: -3 })}${photo(picks[0], { x: 215, y: 110, w: 265, h: 353, rot: 3 })}</div></div>`;
}

// ---------- favicon.ico (16, 32 and 48 px PNGs in one file) ----------

function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size, 0);
    e.writeUInt8(size, 1);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

// ---------- run ----------

const server = await startServer(PORT);
const browser = await launch();
try {
  const ctx = await newContext(browser, { viewport: { width: 1360, height: 900 }, reducedMotion: "reduce", colorScheme: "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/api\/health/.test(m.text()) && errors.push(m.text()));
  await page.goto(LOCAL + "index.html");
  await page.waitForSelector("#main .view");

  const render = async (route) => {
    await page.evaluate((url) => {
      history.pushState(null, "", url);
      window.dispatchEvent(new Event("fs:navigate"));
    }, new URL(href(route), LOCAL).href);
    await page.waitForFunction(() => document.querySelector("#main .view"));
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const main = document.getElementById("main");
      const copy = main.cloneNode(true);
      copy.querySelector(".view")?.classList.add("is-static"); // no entrance animation for content that is already there
      return { body: copy.innerHTML, h1: main.querySelectorAll("h1").length };
    });
  };

  const indexable = [];
  for (const route of pageRoutes()) {
    const meta = pageMeta(route);
    // the scan page shows a photo you picked, so it has nothing to show before the app runs
    const { body, h1 } = route === "scan" ? { body: "", h1: 1 } : await render(route);
    if (h1 !== 1) throw new Error(`${route || "home"}: expected one <h1>, found ${h1}`);
    const file = `${pageFor(route) || "index"}.html`;
    write(file, pageHtml(route, meta, body));
    if (meta.index) indexable.push(route);
    console.log(`${file.padEnd(28)} ${meta.title}`);
  }
  {
    const { body } = await render("404-page-that-does-not-exist");
    write("404.html", pageHtml("", notFoundMeta(), body, { base: new URL(SITE).pathname }));
    console.log("404.html");
  }

  // share images
  fs.mkdirSync(path.join(FITSOURCE, "assets/img/og"), { recursive: true });
  const og = await ctx.newPage();
  await og.setViewportSize({ width: 1200, height: 630 });
  await og.goto(LOCAL + "404.html"); // same origin as the fonts and photos
  const shareRoutes = ["", "feed", "brands", ...FITS.map((f) => `fit/${f.id}`)];
  for (const route of shareRoutes) {
    await og.setContent(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>${FONT_CSS}</style></head><body>${shareCard(route)}</body></html>`, { waitUntil: "networkidle" });
    await og.evaluate(() => document.fonts.ready);
    await og.screenshot({ path: path.join(FITSOURCE, `assets/img/og/${pageFor(route) || "home"}.jpg`), type: "jpeg", quality: 86 });
  }
  console.log(`assets/img/og: ${shareRoutes.length} share images`);
  const stale = fs.readdirSync(path.join(FITSOURCE, "assets/img/og")).filter((f) => !shareRoutes.some((r) => `${pageFor(r) || "home"}.jpg` === f));
  for (const f of stale) fs.unlinkSync(path.join(FITSOURCE, "assets/img/og", f));

  // favicon.ico
  const pngs = [];
  for (const size of [16, 32, 48]) {
    await og.setViewportSize({ width: size, height: size });
    await og.setContent(`<html><body style="margin:0;background:transparent"><img src="${LOCAL}assets/img/favicon.svg" style="width:${size}px;height:${size}px;display:block"></body></html>`, { waitUntil: "networkidle" });
    pngs.push({ size, data: await og.screenshot({ type: "png", omitBackground: true }) });
  }
  write("favicon.ico", ico(pngs));
  console.log("favicon.ico");

  // sitemap, robots, llms
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
      indexable
        .map((r) => {
          const fit = r.startsWith("fit/") && findFit(r.slice(4));
          const image = fit ? `\n    <image:image><image:loc>${esc(abs(`assets/img/fits/${fit.img}.jpg`))}</image:loc></image:image>` : "";
          return `  <url>\n    <loc>${esc(canonicalUrl(r))}</loc>${image}\n  </url>`;
        })
        .join("\n") +
      `\n</urlset>\n`,
  );
  write("robots.txt", `# FitSource\nUser-agent: *\nAllow: /\n\nSitemap: ${abs("sitemap.xml")}\n`);
  write(
    "llms.txt",
    `# FitSource

> FitSource is a free Hebrew website for shoppers in Israel. Upload a photo or screenshot of an outfit (a "fit") and it names every piece, finds the shop that sells it (Israeli shops first, then international ones that ship to Israel), shows the price in shekels and says whether it is sold out. It also offers restock alerts, second-hand options and lookalikes.

The site is in Hebrew (right to left). Quick scans run in the visitor's browser and photos are not uploaded; deep scans use Claude with web search and check stock at each shop. Shop links may be affiliate links; that never changes which results are shown.

## Pages

- [Home](${SITE}): upload a photo of an outfit to find where to buy each piece
- [Feed](${canonicalUrl("feed")}): outfits people are scanning, with the shop, price and stock of every piece (sample content for now)
- [For brands](${canonicalUrl("brands")}): verified product sources, demand data, creator matches and sponsored lookalikes for brands
- [Privacy, disclosure and accessibility](${canonicalUrl("legal")}): what happens to photos, how FitSource earns, and the accessibility statement

## Outfits in the feed

${FITS.map((f) => `- [${f.title}](${canonicalUrl(`fit/${f.id}`)}): ${f.items.map((i) => i.name).join(", ")}`).join("\n")}
`,
  );
  console.log("sitemap.xml, robots.txt, llms.txt");
  if (errors.length) throw new Error("the app logged errors while rendering:\n" + errors.join("\n"));
} finally {
  await browser.close();
  server.close();
}
