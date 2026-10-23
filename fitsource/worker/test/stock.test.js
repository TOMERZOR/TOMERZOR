import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAvailability,
  combineAvailability,
  shopifyJsonUrl,
  parseShopifyProduct,
  parseJsonLd,
  parseMeta,
  checkStock,
  isSafePublicUrl,
} from "../src/stock.js";

test("normalizeAvailability handles schema.org, OG and plain spellings", () => {
  assert.equal(normalizeAvailability("https://schema.org/InStock"), "in_stock");
  assert.equal(normalizeAvailability("http://schema.org/OutOfStock"), "sold_out");
  assert.equal(normalizeAvailability("schema:SoldOut"), "sold_out");
  assert.equal(normalizeAvailability("LimitedAvailability"), "low_stock");
  assert.equal(normalizeAvailability("PreOrder"), "preorder");
  assert.equal(normalizeAvailability("oos"), "sold_out");
  assert.equal(normalizeAvailability("in stock"), "in_stock");
  assert.equal(normalizeAvailability("out of stock"), "sold_out");
  assert.equal(normalizeAvailability(undefined), "unknown");
  assert.equal(normalizeAvailability("weird"), "unknown");
});

test("combineAvailability prefers anything buyable", () => {
  assert.equal(combineAvailability(["sold_out", "in_stock"]), "in_stock");
  assert.equal(combineAvailability(["sold_out", "sold_out"]), "sold_out");
  assert.equal(combineAvailability(["unknown"]), "unknown");
  assert.equal(combineAvailability(["sold_out", "preorder"]), "preorder");
});

test("shopifyJsonUrl finds the product handle", () => {
  assert.equal(shopifyJsonUrl("https://shop.example.com/products/boxy-tee?variant=1"), "https://shop.example.com/products/boxy-tee.js");
  assert.equal(shopifyJsonUrl("https://shop.example.com/collections/new/products/boxy-tee"), "https://shop.example.com/collections/new/products/boxy-tee.js");
  assert.equal(shopifyJsonUrl("https://shop.example.com/p/boxy-tee"), null);
  assert.equal(shopifyJsonUrl("not a url"), null);
});

test("parseShopifyProduct reads variants and cents", () => {
  const r = parseShopifyProduct({
    title: "Boxy Tee",
    available: true,
    price: 4500,
    variants: [
      { public_title: "S", available: false },
      { public_title: "M", available: true },
      { public_title: "L", available: false },
      { public_title: "XL", available: false },
    ],
  });
  assert.equal(r.availability, "low_stock");
  assert.equal(r.price, 45);
  assert.deepEqual(r.sizes.filter((s) => s.available).map((s) => s.label), ["M"]);

  const out = parseShopifyProduct({ available: false, price: 1000, variants: [{ title: "Default Title", available: false }] });
  assert.equal(out.availability, "sold_out");
  assert.deepEqual(out.sizes, []);
  assert.equal(parseShopifyProduct({ nope: 1 }), null);
});

test("parseJsonLd handles @graph, offer arrays and AggregateOffer", () => {
  const html = `<html><head>
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"Cargo Pant","offers":[{"@type":"Offer","name":"30","price":"120.00","priceCurrency":"EUR","availability":"https://schema.org/OutOfStock"},{"@type":"Offer","name":"32","price":"120.00","priceCurrency":"EUR","availability":"https://schema.org/InStock"}]}]}</script>
  </head></html>`;
  const r = parseJsonLd(html);
  assert.equal(r.availability, "in_stock");
  assert.equal(r.price, 120);
  assert.equal(r.currency, "EUR");
  assert.equal(r.title, "Cargo Pant");
  assert.deepEqual(r.sizes, [
    { label: "30", available: false },
    { label: "32", available: true },
  ]);

  const agg = parseJsonLd(`<script type="application/ld+json">[{"@type":["Product"],"name":"Bag","offers":{"@type":"AggregateOffer","lowPrice":89,"priceCurrency":"USD","availability":"SoldOut"}}]</script>`);
  assert.equal(agg.availability, "sold_out");
  assert.equal(agg.price, 89);
});

test("parseJsonLd ignores broken blocks and pages without products", () => {
  assert.equal(parseJsonLd(`<script type="application/ld+json">{bad json,}</script>`), null);
  assert.equal(parseJsonLd(`<script type="application/ld+json">{"@type":"Organization"}</script>`), null);
});

test("parseMeta reads Open Graph and microdata", () => {
  const og = parseMeta(`<meta property="product:availability" content="oos"><meta property="product:price:amount" content="59.90"><meta property="product:price:currency" content="GBP">`);
  assert.deepEqual([og.availability, og.price, og.currency], ["sold_out", 59.9, "GBP"]);
  const micro = parseMeta(`<link itemprop="availability" href="https://schema.org/InStock"><meta itemprop="price" content="20">`);
  assert.equal(micro.availability, "in_stock");
  assert.equal(parseMeta("<html></html>"), null);
});

test("isSafePublicUrl blocks local and odd targets", () => {
  assert.equal(isSafePublicUrl("https://www.ssense.com/en-us/men/product/x/123"), true);
  for (const bad of ["http://localhost:8787", "http://localhost./x", "http://metadata.google.internal./x", "http://127.0.0.1.nip.io/x", "https://10-0-0-1.sslip.io/", "https://shop.example.com:8443/x", "http://127.0.0.1/x", "ftp://a.com/x", "https://user:pw@a.com", "https://intranet/x", "javascript:alert(1)", "http://[::1]/", "https://box.internal/x"]) {
    assert.equal(isSafePublicUrl(bad), false, bad);
  }
});

function fakeFetch(routes) {
  return async (url) => {
    const r = routes[url];
    if (!r) return new Response("missing", { status: 404, headers: { "content-type": "text/html" } });
    if (r === "throw") throw new TypeError("network");
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), {
      status: r.status || 200,
      headers: { "content-type": r.type || "text/html" },
    });
  };
}

test("checkStock refuses redirects to private addresses", async () => {
  const fetchImpl = async (url) => {
    if (url === "https://r.example.com/item") return new Response("", { status: 302, headers: { location: "http://localhost./admin" } });
    if (url === "https://ok.example.com/a") return new Response("", { status: 301, headers: { location: "/b" } });
    if (url === "https://ok.example.com/b") return new Response(`<meta property="og:availability" content="instock">`, { headers: { "content-type": "text/html" } });
    return new Response("nope", { status: 404 });
  };
  const r = await checkStock("https://r.example.com/item", { fetchImpl });
  assert.equal(r.availability, "unknown");
  assert.equal(r.error, "fetch_failed");
  const ok = await checkStock("https://ok.example.com/a", { fetchImpl });
  assert.equal(ok.availability, "in_stock");
});

test("checkStock tries Shopify JSON first, then the page", async () => {
  const fetchImpl = fakeFetch({
    "https://s.example.com/products/tee.js": { type: "application/json", body: { available: false, price: 3000, variants: [{ title: "S", available: false }, { title: "M", available: false }] } },
  });
  const r = await checkStock("https://s.example.com/products/tee", { fetchImpl });
  assert.equal(r.availability, "sold_out");
  assert.equal(r.source, "shopify");
  assert.equal(r.price, 30);
});

test("checkStock falls back to JSON-LD and reports failures as unknown", async () => {
  const fetchImpl = fakeFetch({
    "https://b.example.com/item/9": { body: `<script type="application/ld+json">{"@type":"Product","offers":{"availability":"InStock","price":"10","priceCurrency":"USD"}}</script>` },
    "https://c.example.com/item/1": "throw",
    "https://d.example.com/item/2": { status: 403, body: "no" },
  });
  const ok = await checkStock("https://b.example.com/item/9", { fetchImpl });
  assert.equal(ok.availability, "in_stock");
  assert.equal(ok.source, "jsonld");
  const net = await checkStock("https://c.example.com/item/1", { fetchImpl });
  assert.equal(net.availability, "unknown");
  assert.equal(net.error, "fetch_failed");
  const blocked = await checkStock("https://d.example.com/item/2", { fetchImpl });
  assert.equal(blocked.error, "http_403");
  const gone = await checkStock("https://e.example.com/item/3", { fetchImpl });
  assert.equal(gone.availability, "sold_out");
  const bad = await checkStock("http://localhost/x", { fetchImpl });
  assert.equal(bad.error, "invalid_url");
});
