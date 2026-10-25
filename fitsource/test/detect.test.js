// Unit tests for the on-device scan's pure parts and the link helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { nameColor, kmeans, dominantColor, denimWash, deltaE, isSkin, colorHe, PALETTE } from "../assets/js/scan/color.js";
import { makeWindows, decodeEmbeddings, scoreEmbedding, pickItems, classifyRegion, THRESHOLD } from "../assets/js/scan/detect.js";
import { allLabels, GROUPS, HE } from "../assets/js/scan/vocab.js";

globalThis.location = new URL("https://tomerzor.github.io/TOMERZOR/fitsource/");
const { outbound, queryFor, NEW_SHOPS, RESALE_SHOPS, isExternal } = await import("../assets/js/shop.js");
const { CONFIG } = await import("../assets/js/config.js");

const b64 = (s) => Buffer.from(s, "base64");
const EMB = JSON.parse(fs.readFileSync(new URL("../assets/js/scan/embeddings.json", import.meta.url)));

test("colour names", () => {
  assert.equal(nameColor([20, 20, 22]), "black");
  assert.equal(nameColor([245, 245, 242]), "white");
  assert.equal(nameColor([40, 48, 82]), "navy");
  assert.equal(nameColor([190, 146, 94]), "camel");
  assert.equal(nameColor([236, 156, 192]), "pink");
  assert.ok(deltaE([10, 10, 10], [12, 12, 12]) < 2);
  assert.equal(isSkin([224, 172, 140]), true);
  assert.equal(isSkin([40, 120, 60]), false);
});

test("kmeans finds the main colour and ignores background", () => {
  // 60x60 image: left 70% olive jacket, right 30% grey wall
  const w = 60, h = 60, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const c = x < 42 ? [104, 106, 58] : [128, 128, 130];
    data.set([...c, 255], i);
  }
  const clusters = kmeans([[1, 1, 1], [2, 2, 2], [250, 250, 250]], 2);
  assert.equal(clusters.length, 2);
  const c = dominantColor({ data, width: w, height: h }, [{ x: 0.2, y: 0.2, w: 0.75, h: 0.6 }], [{ x: 0.9, y: 0, w: 0.1, h: 1 }]);
  assert.equal(c.name, "olive");
});

test("denim is described by wash", () => {
  assert.equal(denimWash({ name: "light blue", lightness: 70, blueness: 15 }), "light wash");
  assert.equal(denimWash({ name: "denim blue", lightness: 48, blueness: 20 }), "mid wash");
  assert.equal(denimWash({ name: "navy", lightness: 25, blueness: 20 }), "dark wash");
  assert.equal(denimWash({ name: "black", lightness: 15, blueness: 6 }), "dark wash");
  assert.equal(denimWash({ name: "black", lightness: 15, blueness: 0 }), "black");
  assert.equal(denimWash({ name: "pink", lightness: 70, blueness: 0 }), null);
});

test("windows stay inside the image", () => {
  for (const w of makeWindows()) {
    assert.ok(w.x >= 0 && w.y >= 0 && w.x + w.w <= 1.0001 && w.y + w.h <= 1.0001, JSON.stringify(w));
  }
});

test("embeddings match the vocabulary", () => {
  const emb = decodeEmbeddings(EMB, b64);
  assert.equal(emb.vecs.length, allLabels().length);
  const norm = Math.hypot(...emb.vecs[0]);
  assert.ok(Math.abs(norm - 1) < 1e-4);
  assert.throws(() => decodeEmbeddings({ ...EMB, labels: EMB.labels.slice(1) }, b64), /out of date/);
});

test("pickItems keeps confident groups, one per group, dress vs separates", () => {
  const emb = decodeEmbeddings(EMB, b64);
  const meta = emb.meta;
  const idx = (label) => meta.findIndex((m) => m.label === label);
  const probsWith = (pairs) => {
    const p = new Array(meta.length).fill(0.001);
    for (const [label, v] of pairs) p[idx(label)] = v;
    return p;
  };
  const windows = [
    { win: { x: 0.15, y: 0.08, w: 0.7, h: 0.33 }, probs: probsWith([["leather jacket", 0.9], ["slip dress", 0.2]]) },
    { win: { x: 0.15, y: 0.48, w: 0.7, h: 0.33 }, probs: probsWith([["baggy jeans", 0.7], ["slip dress", 0.4]]) },
    { win: { x: 0.2, y: 0.86, w: 0.6, h: 0.14 }, probs: probsWith([["chunky sneakers", 0.6], ["jeans", 0.8]]) },
    { win: { x: 0.25, y: 0, w: 0.5, h: 0.16 }, probs: probsWith([["beanie", THRESHOLD - 0.01]]) },
  ];
  const items = pickItems(windows, emb, null);
  assert.deepEqual(items.map((i) => i.group), ["outerwear", "bottom", "footwear"]);
  // bottoms are placed with the full band, not the close-up where "jeans" scored higher
  const bottom = items.find((i) => i.group === "bottom");
  assert.equal(bottom.name, "Jeans");
  assert.equal(bottom.box.y, 480);
  assert.equal(items[0].query, "leather jacket");
  const region = classifyRegion(probsWith([["tote bag", 0.6], ["shoulder bag", 0.3]]), emb, null, { x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  assert.equal(region.name, "Tote bag");
  assert.equal(region.alternatives[0].name, "Shoulder bag");
});

test("scoreEmbedding returns a probability distribution", () => {
  const emb = decodeEmbeddings(EMB, b64);
  const p = scoreEmbedding(emb.vecs[3], emb);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-6);
  assert.equal(p.indexOf(Math.max(...p)), 3);
});

test("shop links and affiliate wrapping", () => {
  assert.equal(NEW_SHOPS[0].url("ג'ינס"), "https://www.google.co.il/search?udm=28&hl=iw&gl=il&q=%D7%92'%D7%99%D7%A0%D7%A1");
  assert.equal(RESALE_SHOPS.find((s) => s.id === "depop").url("x & y"), "https://www.depop.com/search/?q=x%20%26%20y");
  // English-catalogue shops get the English words, Israeli shops the Hebrew ones
  const asos = NEW_SHOPS.find((s) => s.id === "asos");
  const tx = NEW_SHOPS.find((s) => s.id === "terminalx");
  assert.equal(queryFor(asos, "ג'ינס רחב", "baggy jeans"), "baggy jeans");
  assert.equal(queryFor(tx, "ג'ינס רחב", "baggy jeans"), "ג'ינס רחב");
  assert.equal(queryFor(asos, "ג'ינס רחב", ""), "ג'ינס רחב");
  assert.ok(!RESALE_SHOPS.some((s) => s.id === "vinted"), "Vinted doesn't operate in Israel");
  assert.equal(outbound("javascript:alert(1)"), null);
  assert.equal(outbound("../product.html#circle-logo-tee"), "../product.html#circle-logo-tee"); // same site: left as is
  assert.equal(isExternal("../product.html"), false);
  assert.equal(outbound("https://shop.example.com/p/1"), "https://shop.example.com/p/1");
  CONFIG.affiliate.skimlinksId = "123X456";
  assert.equal(outbound("https://shop.example.com/p/1"), "https://go.skimresources.com/?id=123X456&xs=1&url=https%3A%2F%2Fshop.example.com%2Fp%2F1");
  CONFIG.affiliate.amazonTag = "fit-20";
  assert.equal(outbound("https://www.amazon.com/s?k=tee"), "https://www.amazon.com/s?k=tee&tag=fit-20");
  // a per-shop deep link wins over network-wide wrapping
  CONFIG.affiliate.deeplinks = { "aliexpress.com": "https://ad.admitad.com/g/abc/?ulp={url}" };
  assert.equal(outbound("https://www.aliexpress.com/wholesale?SearchText=tee"), "https://ad.admitad.com/g/abc/?ulp=https%3A%2F%2Fwww.aliexpress.com%2Fwholesale%3FSearchText%3Dtee");
  assert.equal(outbound("https://shop.example.com/p/1"), "https://go.skimresources.com/?id=123X456&xs=1&url=https%3A%2F%2Fshop.example.com%2Fp%2F1");
  CONFIG.affiliate.deeplinks = {};
  CONFIG.affiliate.skimlinksId = "";
  CONFIG.affiliate.amazonTag = "";
});

test("Hebrew names and colours agree with the garment", () => {
  assert.equal(colorHe("black", "f"), "שחורה");
  assert.equal(colorHe("black", "mp"), "שחורים");
  assert.equal(colorHe("light wash", "m"), "בהיר");
  assert.equal(colorHe("beige", "fp"), "בז'");
  for (const list of Object.values(GROUPS)) for (const [, name] of list) assert.ok(HE[name], `Hebrew name for ${name}`);
  for (const [name] of PALETTE) assert.notEqual(colorHe(name), name, `Hebrew colour for ${name}`);
});
