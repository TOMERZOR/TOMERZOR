// Unit tests for reading text on clothes: the OCR post-processing, turning
// read lines into search words, and where those words go.
import { test } from "node:test";
import assert from "node:assert/strict";
import { boxesFromMap, ctcDecode, printedText, resample, OCR_MODELS } from "../assets/js/scan/ocr.js";
import { attachText } from "../assets/js/scan/detect.js";

globalThis.location = new URL("https://tomerzor.github.io/TOMERZOR/fitsource/");
const { deviceQueries } = await import("../assets/js/scan/engine.js");
const { queryFor, NEW_SHOPS } = await import("../assets/js/shop.js");

test("CTC decoding merges repeats and drops blanks", () => {
  const dict = ["N", "U", "D", "E", " "];
  // steps: N N blank U D D blank D E  -> "NUDDE"
  const seq = [1, 1, 0, 2, 3, 3, 0, 3, 4];
  const classes = dict.length + 1;
  const logits = new Float32Array(seq.length * classes);
  seq.forEach((c, t) => (logits[t * classes + c] = 0.9));
  const { text, score } = ctcDecode(logits, seq.length, classes, dict);
  assert.equal(text, "NUDDE");
  assert.ok(Math.abs(score - 0.9) < 1e-6);
});

test("text boxes from the detector's map", () => {
  const w = 40, h = 20;
  const map = new Float32Array(w * h);
  const fill = (x0, y0, x1, y1, v) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) map[y * w + x] = v;
  };
  fill(4, 4, 24, 10, 0.9); // a word
  fill(30, 4, 36, 10, 0.4); // weak: above the pixel threshold, below the box threshold
  fill(30, 14, 31, 15, 0.9); // a speck
  const boxes = boxesFromMap(map, w, h);
  assert.equal(boxes.length, 1);
  const [b] = boxes;
  assert.ok(b.x < 4 && b.y < 4 && b.x + b.w > 24 && b.y + b.h > 10, "the box grows past the shrunk text kernel");
  assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h, "and stays inside the map");
});

test("resampling keeps a flat colour flat", () => {
  const img = { data: new Uint8ClampedArray(8 * 8 * 4).fill(200), width: 8, height: 8 };
  const out = resample(img, 2, 2, 4, 4, 3, 3);
  assert.equal(out.width, 3);
  assert.ok([...out.data].every((v, i) => (i % 4 === 3 ? v === 255 : v === 200)));
});

test("search words from the lettering on a shirt", () => {
  // what the reader returns for a "Nude Mansion" tee (largest first)
  const lines = [
    { text: "ASU", score: 0.99, size: 0.039, x: 0.3, y: 0.3 }, // a scrap of curved lettering
    { text: "MANSION", score: 0.99, size: 0.038, x: 0.4, y: 0.49 },
    { text: "NUDE", score: 0.85, size: 0.034, x: 0.45, y: 0.455 },
    { text: "Teisu", score: 0.96, size: 0.022, x: 0.45, y: 0.42 }, // small script, half read
    { text: "or ho", score: 0.52, size: 0.008, x: 0.4, y: 0.56 },
  ];
  const r = printedText(lines);
  assert.equal(r.text, "NUDE MANSION", "big lettering, in reading order");
  assert.equal(r.brand, "Nude Project");
  assert.ok(r.y > 0.45 && r.y < 0.52);
  // one line, two words side by side, read left to right
  assert.equal(printedText([{ text: "STONE", score: 0.9, size: 0.03, x: 0.5, y: 0.3 }, { text: "ISLAND", score: 0.9, size: 0.03, x: 0.2, y: 0.305 }]).text, "ISLAND STONE");
  assert.equal(printedText([{ text: "ISLAND", score: 0.9, size: 0.03, x: 0.2, y: 0.3 }, { text: "STONE", score: 0.9, size: 0.03, x: 0.5, y: 0.305 }]).brand, null, "a brand needs its whole name");
  assert.equal(printedText([{ text: "stone island", score: 0.9, size: 0.03, x: 0.2, y: 0.3 }]).brand, "Stone Island");
  // short brand names survive the scrap filter, other short words don't
  assert.equal(printedText([{ text: "KITH", score: 0.95, size: 0.04, x: 0.3, y: 0.3 }]).brand, "Kith");
  assert.deepEqual(printedText([{ text: "SU", score: 0.99, size: 0.04, x: 0.3, y: 0.3 }]), { text: "", brand: null, y: null });
  // unsure or mostly-symbol lines are not search words
  assert.equal(printedText([{ text: "DREAM", score: 0.6, size: 0.05, x: 0.3, y: 0.3 }]).text, "");
  assert.equal(printedText([{ text: "№ 12/34", score: 0.95, size: 0.05, x: 0.3, y: 0.3 }]).text, "");
  assert.equal(printedText([]).text, "");
});

test("the text goes to the garment it is printed on", () => {
  const items = () => [
    { group: "top", box: { x: 150, y: 160, w: 700, h: 220 } },
    { group: "bottom", box: { x: 150, y: 320, w: 700, h: 500 } },
    { group: "footwear", box: { x: 200, y: 860, w: 600, h: 140 } },
  ];
  const a = attachText(items(), { text: "CreatedBy", brand: null, y: 0.54 });
  assert.equal(a[1].printed, "CreatedBy");
  assert.ok(!a[0].printed);
  const b = attachText(items(), { text: "NUDE MANSION", brand: "Nude Project", y: 0.25 });
  assert.equal(b[0].printed, "NUDE MANSION");
  assert.equal(b[0].brand, "Nude Project");
  // nothing read: nothing changes
  const c = attachText(items(), { text: "", brand: null, y: null });
  assert.ok(c.every((it) => !("printed" in it)));
  assert.deepEqual(attachText([], { text: "X", brand: null, y: 0.5 }), []);
});

test("search words for a piece with a print", () => {
  assert.deepEqual(deviceQueries({ name: "T-shirt", query: "light grey t-shirt", brand: "Nude Project", printed: "NUDE MANSION" }, "חולצת טי", "אפור בהיר"), {
    query: "Nude Project NUDE MANSION חולצת טי",
    queryEn: "Nude Project NUDE MANSION t-shirt",
  });
  // the print is the brand name: said once
  assert.equal(deviceQueries({ name: "hoodie", query: "black hoodie", brand: "Stone Island", printed: "STONE ISLAND" }, "קפוצ'ון", "שחור").query, "Stone Island קפוצ'ון");
  // nothing read: colour and garment, as before
  assert.deepEqual(deviceQueries({ name: "baggy jeans", query: "light wash baggy jeans", printed: "" }, "ג'ינס רחב", "בהיר"), { query: "ג'ינס רחב בהיר", queryEn: "light wash baggy jeans" });
  // Google searches a named piece in English; Israeli shops keep Hebrew
  const google = NEW_SHOPS.find((s) => s.id === "google");
  const tx = NEW_SHOPS.find((s) => s.id === "terminalx");
  assert.equal(queryFor(google, "Nude Project חולצת טי", "Nude Project t-shirt", true), "Nude Project t-shirt");
  assert.equal(queryFor(google, "חולצת טי", "t-shirt"), "חולצת טי");
  assert.equal(queryFor(tx, "Nude Project חולצת טי", "Nude Project t-shirt", true), "Nude Project חולצת טי");
});

test("OCR models are pinned to a revision", () => {
  for (const url of Object.values(OCR_MODELS)) assert.match(url, /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[0-9a-f]{40}\//);
});
