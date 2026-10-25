// Builds the brand catalogs a scan links to: for each Shopify store in
// catalog/brands.json, every product's page, title, colours, sizes in stock,
// price and photo, from the store's public /products.json. Runs nightly in
// GitHub Actions (.github/workflows/fitsource-catalog.yml); the output goes to
// the fitsource-catalog branch, which the site reads.
//   node tools/crawl-catalog.mjs --out catalog-out [--only stussy,kith] [--pages 12]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compactProduct, foldName, robotsAllows } from "../assets/js/catalog.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const OUT = path.resolve(opt("out", "catalog-out"));
const ONLY = opt("only", "") ? opt("only", "").split(",") : null;
const MAX_PAGES = Number(opt("pages", 12)); // 250 products a page
const UA = "FitSourceBot/1.0 (+https://tomerzor.github.io/TOMERZOR/fitsource/)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, type = "json") {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: type === "json" ? "application/json" : "text/plain" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return type === "json" ? res.json() : res.text();
}

/** The first domain that answers like a Shopify store, with its currency. */
async function findStore(brand) {
  const errors = [];
  for (const domain of brand.domains) {
    try {
      const robots = await get(`https://${domain}/robots.txt`, "text").catch(() => "");
      if (!robotsAllows(robots, "/products.json")) {
        errors.push(`${domain}: robots.txt disallows /products.json`);
        continue;
      }
      const probe = await get(`https://${domain}/products.json?limit=1`);
      if (!probe || !Array.isArray(probe.products)) throw new Error("not a Shopify catalog");
      const meta = await get(`https://${domain}/meta.json`).catch(() => ({}));
      return { domain, currency: typeof meta.currency === "string" ? meta.currency : null };
    } catch (e) {
      errors.push(`${domain}: ${e.message}`);
    }
    await sleep(500);
  }
  throw new Error(errors.join("; "));
}

async function crawl(brand) {
  const { domain, currency } = await findStore(brand);
  const products = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await get(`https://${domain}/products.json?limit=250&page=${page}`);
    const list = (data && data.products) || [];
    for (const p of list) {
      const c = compactProduct(p);
      if (c) products.push(c);
    }
    if (list.length < 250) break;
    await sleep(1500); // be polite: one page every 1.5 s
  }
  return { id: brand.id, name: brand.name, domain, currency, updatedAt: new Date().toISOString(), products };
}

const { brands } = JSON.parse(fs.readFileSync(path.join(here, "../catalog/brands.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const index = { updatedAt: new Date().toISOString(), brands: [], vendors: {} };
for (const brand of brands) {
  if (ONLY && !ONLY.includes(brand.id)) continue;
  const row = { id: brand.id, name: brand.name, aliases: brand.aliases || [] };
  try {
    const cat = await crawl(brand);
    fs.writeFileSync(path.join(OUT, `${brand.id}.json`), JSON.stringify(cat));
    Object.assign(row, { ok: true, domain: cat.domain, currency: cat.currency, count: cat.products.length });
    // stores that also sell other brands (Kith): remember which catalogs carry which vendor
    const own = foldName(brand.name);
    const counts = {};
    for (const p of cat.products) if (p.v && foldName(p.v) !== own) counts[foldName(p.v)] = (counts[foldName(p.v)] || 0) + 1;
    for (const [v, n] of Object.entries(counts)) if (n >= 3) (index.vendors[v] = index.vendors[v] || []).push(brand.id);
    console.log(`ok   ${brand.id.padEnd(16)} ${String(cat.products.length).padStart(5)} products  ${cat.domain} ${cat.currency || ""}`);
  } catch (e) {
    Object.assign(row, { ok: false, error: String(e.message).slice(0, 300) });
    console.log(`FAIL ${brand.id.padEnd(16)} ${row.error}`);
  }
  index.brands.push(row);
  await sleep(1000);
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
const ok = index.brands.filter((b) => b.ok);
console.log(`\n${ok.length}/${index.brands.length} brands, ${ok.reduce((n, b) => n + b.count, 0)} products`);
if (!ok.length) process.exit(1);
