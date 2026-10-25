// Unit tests for the artifact's Claude engine: what it keeps from Claude's answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanItem, viewerClaude } from "../assets/js/scan/claude.js";

test("Claude's items are checked and tidied", () => {
  const it = cleanItem({ label: "  טישרט  עם הדפס ", category: "top", color: "שמנת", brand: "Stüssy", product_name: "Burly Threads Tee", confidence: "exact", box: { x: 900, y: -5, w: 400, h: 300 }, search_query: "סטוסי טישרט", search_query_en: "Stussy Burly Threads tee" });
  assert.equal(it.label, "טישרט עם הדפס");
  assert.deepEqual(it.box, { x: 900, y: 0, w: 100, h: 300 }, "boxes stay inside the photo");
  assert.equal(it.brand, "Stüssy");
  // unknown values fall back to safe ones
  const odd = cleanItem({ label: "כובע", category: "hat", confidence: "sure", brand: "", box: null });
  assert.equal(odd.category, "accessory");
  assert.equal(odd.confidence, "similar");
  assert.equal(odd.brand, null);
  assert.equal(odd.search_query, "כובע");
  assert.ok(odd.box.w >= 20 && odd.box.h >= 20);
  // nothing to show: dropped
  assert.equal(cleanItem({ label: "" }), null);
  assert.equal(cleanItem("jeans"), null);
});

test("outside a Claude viewer there is no Claude engine", async () => {
  assert.equal(await viewerClaude(), null);
});
