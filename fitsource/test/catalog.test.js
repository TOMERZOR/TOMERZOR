// Unit tests for the brand catalogs: crawling helpers, search, and turning a
// found product into a match.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.location = new URL("https://tomerzor.github.io/TOMERZOR/fitsource/");
const { compactProduct, robotsAllows, searchProducts, catalogsFor, toMatch, foldName, words } = await import("../assets/js/catalog.js");

const shopify = {
  handle: "burly-threadds-pig-dyed-tee-indigo",
  title: "Burly Threadds Pig. Dyed Tee",
  product_type: "Tees",
  vendor: "Stüssy",
  options: [{ name: "Color" }, { name: "Size" }],
  variants: [
    { option1: "Indigo", option2: "S", price: "60.00", compare_at_price: null, available: false },
    { option1: "Indigo", option2: "M", price: "60.00", compare_at_price: "75.00", available: true },
    { option1: "Indigo", option2: "L", price: "60.00", compare_at_price: null, available: true },
  ],
  images: [{ src: "https://cdn.shopify.com/s/files/1/tee.jpg?v=1" }],
};

test("a Shopify product becomes a compact catalog entry", () => {
  assert.deepEqual(compactProduct(shopify), {
    h: "burly-threadds-pig-dyed-tee-indigo",
    t: "Burly Threadds Pig. Dyed Tee",
    a: true,
    ty: "Tees",
    v: "Stüssy",
    c: ["Indigo"],
    s: ["M", "L"],
    p: 60,
    cp: 75,
    i: "//cdn.shopify.com/s/files/1/tee.jpg?v=1",
  });
  const soldOut = compactProduct({ ...shopify, variants: shopify.variants.map((v) => ({ ...v, available: false })) });
  assert.equal(soldOut.a, false);
  assert.equal(soldOut.s, undefined);
  assert.equal(compactProduct({ title: "no handle" }), null);
});

test("robots.txt is respected", () => {
  const robots = "User-agent: *\nDisallow: /cart\nDisallow: /search\n\nUser-agent: BadBot\nDisallow: /\n";
  assert.equal(robotsAllows(robots, "/products.json"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /products\n", "/products.json"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nAllow: /products.json\n", "/products.json"), true, "the longer rule wins");
  assert.equal(robotsAllows("", "/products.json"), true);
});

const catalog = [
  compactProduct(shopify),
  { h: "burly-threadds-pig-dyed-tee-olive", t: "Burly Threadds Pig. Dyed Tee", ty: "Tees", c: ["Olive"], a: true, p: 60 },
  { h: "basic-stussy-hoodie", t: "Basic Stüssy Hoodie", ty: "Sweats", c: ["Black", "Ash Heather"], a: true, p: 130 },
  { h: "stock-logo-tee", t: "Stock Logo Tee", ty: "Tees", c: ["Black", "White"], a: false, p: 50 },
  { h: "big-ol-jean", t: "Big Ol' Jean Denim", ty: "Bottoms", c: ["Indigo"], a: true, p: 180 },
];

test("search finds the product through spelling differences and favours rare words", () => {
  const hits = searchProducts(catalog, { name: "Burly Threads Tee", query: "Stussy Burly Threads pigment dyed tee indigo", category: "top" });
  assert.equal(hits[0].product.t, "Burly Threadds Pig. Dyed Tee");
  assert.equal(hits[0].product.c[0], "Indigo", "the colour picks the indigo one");
  assert.equal(hits[0].cover, 1, "every word of the name is there ('threads' ~ 'threadds')");
  // category words help: a hoodie query prefers the hoodie
  assert.equal(searchProducts(catalog, { name: "", query: "stussy black hoodie", category: "top" })[0].product.h, "basic-stussy-hoodie");
  assert.deepEqual(searchProducts(catalog, { name: "cargo pants" }), []);
  assert.deepEqual(words("Stüssy BURLY-threads & the Tee"), ["stussy", "burly", "threads", "tee"]);
  assert.equal(foldName("Carhartt W.I.P."), "carharttwip");
});

const index = {
  brands: [
    { id: "stussy", name: "Stüssy", aliases: ["stussy"], ok: true },
    { id: "carhartt-wip", name: "Carhartt WIP", aliases: ["carhartt"], ok: true },
    { id: "kith", name: "Kith", aliases: [], ok: true },
    { id: "broken", name: "Broken", aliases: [], ok: false },
  ],
  vendors: { timberland: ["kith"], stussy: ["kith"] },
};

test("a brand name finds its store, and stores that stock it", () => {
  assert.deepEqual(catalogsFor(index, "STUSSY"), ["stussy", "kith"]);
  assert.deepEqual(catalogsFor(index, "Carhartt WIP"), ["carhartt-wip"]);
  assert.deepEqual(catalogsFor(index, "Carhartt"), ["carhartt-wip"]);
  assert.deepEqual(catalogsFor(index, "Timberland"), ["kith"], "a retailer that sells the brand");
  assert.deepEqual(catalogsFor(index, "Broken"), [], "a store that failed to crawl is skipped");
  assert.deepEqual(catalogsFor(index, "Zara"), []);
  assert.deepEqual(catalogsFor(null, "Stüssy"), []);
});

test("a found product becomes a match with its page, price and stock", () => {
  const store = { id: "stussy", name: "Stüssy", domain: "www.stussy.com", currency: "USD", updatedAt: "2026-10-25T02:30:00Z" };
  const m = toMatch({ product: catalog[0], store, own: true });
  assert.equal(m.url, "https://www.stussy.com/products/burly-threadds-pig-dyed-tee-indigo");
  assert.equal(m.title, "Burly Threadds Pig. Dyed Tee · Indigo", "the colourway is named");
  assert.equal(toMatch({ product: { ...catalog[0], t: "Indigo Burly Tee" }, store, own: true }).title, "Indigo Burly Tee", "not twice");
  assert.equal(m.shop, "Stüssy, האתר הרשמי");
  assert.deepEqual([m.price, m.currency, m.availability, m.match], [60, "USD", "in_stock", "original"]);
  assert.deepEqual(m.sizes_in_stock, ["M", "L"]);
  assert.match(m.note, /מלאי לפי האתר/);
  assert.equal(m.image, "https://cdn.shopify.com/s/files/1/tee.jpg?v=1");
  const retailer = toMatch({ product: { ...catalog[3], v: "Timberland" }, store: { ...store, name: "Kith", domain: "kith.com" }, own: false }, "similar");
  assert.equal(retailer.shop, "Kith");
  assert.equal(retailer.brand, "Timberland");
  assert.equal(retailer.availability, "sold_out");
});
