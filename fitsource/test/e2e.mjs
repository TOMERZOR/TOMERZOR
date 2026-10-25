// End-to-end flows in Chromium:
//  1. quick scan (on-device model) from an uploaded photo, edit search, save, draw a box, receipt, history
//  2. deep scan against the real worker code with a fake Claude API and fake shops, restock alert
//  3. feed and fit page interactions
//   node test/e2e.mjs [outdir] [flow...]
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { startServer, launch, newContext, watch, FITSOURCE } from "./harness.mjs";

const out = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : path.join(FITSOURCE, "test/out/e2e");
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  return cond;
};
const shot = (page, name) => page.screenshot({ path: path.join(out, name + ".png"), fullPage: false });
const run = (name) => !only.length || only.includes(name);
const FIT_PHOTO = path.join(FITSOURCE, "assets/img/fits/shop-floor.jpg");

// ---------- fake Claude + fake shops for the deep scan ----------
const DEEP_RESULTS = {
  vibe: "וורקוור",
  summary: "ז'קט עבודה חום מעל טי לבנה, ג'ינס כהה ומגפיים שחורים.",
  items: [
    { label: "ז'קט עבודה מקנבס", category: "outerwear", color: "חום", brand: "Harrow Supply", product_name: "Chore Jacket", confidence: "exact", box: { x: 150, y: 160, w: 700, h: 330 }, search_query: "ז'קט עבודה חום מקנבס", search_query_en: "brown duck canvas chore jacket",
      matches: [
        { title: "Chore Jacket Duck Canvas", brand: "Harrow Supply", shop: "Harrow Supply", url: "https://harrow.example.com/products/chore-jacket", price: 659, currency: "ILS", availability: "in_stock", sizes_in_stock: [], match: "original", note: null },
        { title: "Chore Jacket, worn", brand: "Harrow Supply", shop: "Grailed", url: "https://www.grailed.example.com/listings/1", price: 449, currency: "ILS", availability: "in_stock", sizes_in_stock: ["M"], match: "resale", note: null },
      ] },
    { label: "ג'ינס סלבג' כהה", category: "bottom", color: "אינדיגו כהה", brand: "Harrow Supply", product_name: "1951 Raw Selvedge", confidence: "likely", box: { x: 300, y: 520, w: 400, h: 380 }, search_query: "ג'ינס סלבג' כהה ישר", search_query_en: "raw selvedge straight jeans",
      matches: [{ title: "1951 Raw Selvedge", brand: "Harrow Supply", shop: "Harrow Supply", url: "https://harrow.example.com/products/1951", price: 590, currency: "ILS", availability: "in_stock", sizes_in_stock: [], match: "original", note: null }] },
  ],
};
function sseMessage(blocks, stop) {
  const ev = [{ type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }];
  blocks.forEach((b, index) => {
    if (b.type === "server_tool_use" || b.type === "tool_use") {
      ev.push({ type: "content_block_start", index, content_block: { ...b, input: {} } });
      ev.push({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
    } else ev.push({ type: "content_block_start", index, content_block: b });
    ev.push({ type: "content_block_stop", index });
  });
  ev.push({ type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 5 } });
  ev.push({ type: "message_stop" });
  return ev.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}
async function startFakeClaude(port) {
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", async () => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      // a little delay so the progress tape is visible
      await new Promise((r) => setTimeout(r, 600));
      res.end(
        sseMessage(
          [
            { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "brown duck canvas chore jacket corduroy collar" } },
            { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: "https://harrow.example.com/products/chore-jacket", title: "Chore Jacket", encrypted_content: "x", page_age: null }] },
            { type: "server_tool_use", id: "s2", name: "web_fetch", input: { url: "https://harrow.example.com/products/chore-jacket" } },
            { type: "tool_use", id: "t1", name: "submit_results", input: DEEP_RESULTS },
          ],
          "tool_use",
        ),
      );
    });
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return server;
}
let jacketInStock = false;
let jeansPrice = 59000;
function installFakeShops() {
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url === "https://harrow.example.com/products/chore-jacket.js") {
      return new Response(JSON.stringify({ available: jacketInStock, price: 65900, variants: [{ title: "S", available: false }, { title: "M", available: jacketInStock }] }), { headers: { "content-type": "application/json" } });
    }
    if (url === "https://harrow.example.com/products/1951.js") {
      return new Response(JSON.stringify({ available: true, price: jeansPrice, variants: [{ title: "30", available: true }, { title: "32", available: false }] }), { headers: { "content-type": "application/json" } });
    }
    if (url.startsWith("https://") && !url.includes("127.0.0.1")) return new Response("blocked", { status: 403 });
    return real(input, init);
  };
}

async function workerHandler() {
  const worker = (await import("../worker/src/index.js")).default;
  return async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request("http://127.0.0.1" + req.url, { method: req.method, headers: req.headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
    const response = await worker.fetch(request, { ANTHROPIC_API_KEY: "test", ANTHROPIC_BASE_URL: "http://127.0.0.1:8743" }, { waitUntil() {} });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) for await (const c of response.body) res.write(c);
    res.end();
    if (process.env.DEBUG) console.log(Date.now() % 100000, "server ended", req.url.slice(0, 40));
  };
}

const browser = await launch();

// ---------- 1. quick scan ----------
if (run("quick")) {
  const server = await startServer(8741);
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  const problems = watch(page);
  await page.goto("http://127.0.0.1:8741/fitsource/");
  await page.setInputFiles("[data-file]", FIT_PHOTO);
  await page.waitForSelector("[data-tape]", { timeout: 10000 });
  await page.waitForTimeout(1200);
  await shot(page, "quick-1-scanning");
  await page.waitForSelector(".tags .tag", { timeout: 240000 });
  await page.waitForTimeout(900);
  await shot(page, "quick-2-results");
  const names = await page.$$eval(".tags .tag__name", (els) => els.map((e) => e.textContent));
  check(names.length >= 3, `quick scan found only ${names.length} pieces: ${names}`);
  check(names.some((n) => /ז'קט|מעיל/.test(n)), `quick scan missed the jacket: ${names}`);
  check(/\/fitsource\/scan\?id=[\w]+$/.test(page.url()), `url not updated to the scan id: ${page.url()}`);
  const spots = await page.$$eval(".detail__media .hotspot", (els) => els.length);
  check(spots === names.length, `hotspots ${spots} != items ${names.length}`);

  // shop links follow the search words
  const input = page.locator("[data-query]").first();
  // before editing: Israeli shops search in Hebrew, English-catalogue shops in English
  const tx0 = await page.locator('.shoprow a[data-shop="terminalx"]').first().getAttribute("href");
  check(tx0 && tx0.startsWith("https://www.terminalx.com/catalogsearch/result/?q=%D7"), `terminal x should get Hebrew words: ${tx0}`);
  const asos0 = await page.locator('.shoprow a[data-shop="asos"]').first().getAttribute("href");
  check(asos0 && /^https:\/\/www\.asos\.com\/search\/\?q=[a-z]/.test(asos0), `asos should get English words: ${asos0}`);
  await input.fill("ז'קט עבודה חום");
  const href = await page.locator('.shoprow a[data-shop="google"]').first().getAttribute("href");
  check(href && href.startsWith("https://www.google.co.il/search?") && decodeURIComponent(href).includes("ז'קט עבודה חום"), `google link not updated: ${href}`);
  const asos = await page.locator('.shoprow a[data-shop="asos"]').first().getAttribute("href");
  check(asos && decodeURIComponent(asos).includes("ז'קט"), `edited words go to every shop: ${asos}`);

  // hotspot -> tag highlight
  await page.locator(".detail__media .hotspot").nth(1).click();
  check(await page.locator(".tags .tag").nth(1).evaluate((e) => e.classList.contains("is-active")), "clicking a dot did not highlight its tag");

  // save to closet
  await page.locator('.tags .tag [data-action="save"]').first().click();
  await page.waitForTimeout(300);
  const badge = await page.locator(".nav [data-closet-count]").textContent();
  check(badge === "1", `closet badge after save: "${badge}"`);

  // draw a box around the shoes
  const before = names.length;
  await page.locator("[data-draw]").click();
  const box = await page.locator(".detail__media .shot img").boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.84);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.9, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.98, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction((n) => document.querySelectorAll(".tags .tag").length > n, before, { timeout: 60000 });
  const drawn = await page.locator(".tags .tag__name").first().textContent();
  check(/נעלי|מגפי|סניקרס|סנדלים/.test(drawn), `drawn box over the shoes found: ${drawn}`);
  await page.waitForTimeout(500);
  await shot(page, "quick-3-drawn");

  // receipt
  await page.locator("[data-receipt]").click();
  await page.waitForSelector(".modal img", { timeout: 15000 });
  const dims = await page.locator(".modal img").evaluate((img) => new Promise((r) => (img.complete ? r([img.naturalWidth, img.naturalHeight]) : (img.onload = () => r([img.naturalWidth, img.naturalHeight])))));
  check(dims[0] === 1080 && dims[1] === 1920, `receipt size ${dims}`);
  await shot(page, "quick-4-receipt");
  const receiptPng = await page.locator(".modal img").evaluate(async (img) => {
    const b = await (await fetch(img.src)).blob();
    const buf = new Uint8Array(await b.arrayBuffer());
    let s = "";
    for (const x of buf) s += String.fromCharCode(x);
    return btoa(s);
  });
  fs.writeFileSync(path.join(out, "receipt.png"), Buffer.from(receiptPng, "base64"));
  await page.keyboard.press("Escape");
  check((await page.locator(".modal").count()) === 0, "Escape did not close the receipt");

  // history survives a reload
  await page.reload();
  await page.waitForSelector(".tags .tag", { timeout: 15000 });
  check((await page.locator(".tags .tag").count()) === before + 1, "scan after reload has a different number of pieces");
  await page.goto("http://127.0.0.1:8741/fitsource/closet?tab=scans");
  await page.waitForSelector(".scan-grid .card");
  check((await page.locator(".scan-grid .card").count()) === 1, "closet scans tab should list 1 scan");
  await page.goto("http://127.0.0.1:8741/fitsource/closet");
  await page.waitForSelector(".closet-grid .tag");
  await shot(page, "quick-5-closet");

  // a second scan from the scan page
  await page.goto("http://127.0.0.1:8741/fitsource/scan?id=" + (await page.evaluate(() => JSON.parse(localStorage.getItem("fs.scans.v1"))[0].id)));
  await page.waitForSelector("[data-newfile]");
  await page.setInputFiles("[data-newfile]", path.join(FITSOURCE, "assets/img/fits/butter-hour.jpg"));
  await page.waitForSelector("[data-tape]");
  await page.waitForSelector(".tags .tag", { timeout: 120000 });
  const names2 = await page.$$eval(".tags .tag__name", (els) => els.map((e) => e.textContent));
  check(names2.some((n) => /חצאית/.test(n)), `second scan should find the skirt: ${names2}`);

  // text printed on a garment is read and searched for: "CreatedBy" on the denim
  await page.setInputFiles("[data-newfile]", path.join(FITSOURCE, "assets/img/fits/created-by-god.jpg"));
  await page.waitForFunction(() => document.querySelector(".tags .tag .printed"), null, { timeout: 120000 }).catch(() => {});
  const printed = await page.$$eval(".tags .tag", (els) =>
    els.filter((e) => e.querySelector(".printed")).map((e) => ({ name: e.querySelector(".tag__name").textContent, text: e.querySelector(".printed").textContent, query: e.querySelector("[data-query]").value, google: e.querySelector('[data-shop="google"]').href })),
  );
  check(printed.length === 1 && /CreatedBy/.test(printed[0].text), `the print should be read once: ${JSON.stringify(printed)}`);
  if (printed[0]) {
    check(/מכנס|שורט|ג'ינס/.test(printed[0].name), `the print belongs to the denim, not ${printed[0].name}`);
    check(/^CreatedBy /.test(printed[0].query), `search words should start with the print: ${printed[0].query}`);
    check(/q=CreatedBy%20[a-z%20-]+$/.test(printed[0].google), `Google should get the English words: ${printed[0].google}`);
  }
  await shot(page, "quick-6-printed");

  // a second photo dropped while the first is still loading wins
  await page.goto("http://127.0.0.1:8741/fitsource/");
  await page.setInputFiles("[data-file]", path.join(FITSOURCE, "assets/img/fits/null-signal.jpg"));
  await page.evaluate(async () => {
    const blob = await (await fetch("assets/img/fits/mall-rat.jpg")).blob();
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "mall-rat.jpg", { type: "image/jpeg" }));
    window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForSelector(".tags .tag", { timeout: 120000 });
  await page.waitForTimeout(1500);
  const raced = await page.$$eval(".tags .tag__name", (els) => els.map((e) => e.textContent));
  check(raced.some((n) => /מתרחב|קרופ/.test(n)) && !raced.some((n) => /דגמ"ח/.test(n)), `dropped photo should win the race: ${raced}`);
  check((await page.locator(".notice:has-text('נעצרה')").count()) === 0, "race left an error view");

  // a non-image file
  await page.goto("http://127.0.0.1:8741/fitsource/");
  await page.setInputFiles("[data-file]", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await page.waitForSelector(".notice", { timeout: 10000 });
  check(/תמונה/.test(await page.locator(".notice").textContent()), "non-image upload should explain what to pick");

  for (const p of problems) failures.push("quick: " + p);
  await ctx.close();
  server.close();
}

// ---------- 2. deep scan through the worker ----------
if (run("deep")) {
  installFakeShops();
  const claude = await startFakeClaude(8743);
  const server = await startServer(8742, { api: await workerHandler() });
  const ctx = await newContext(browser, { cdn: false, viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  // Playwright sometimes reports the streamed scan response as aborted even
  // though Chrome's own network log shows it finishing; the flow below fails
  // anyway if the result never arrives.
  const problems = watch(page, { ignore: [/\/api\/scan$/] });
  if (process.env.DEBUG) {
    page.on("request", (r) => r.url().includes("/api/") && console.log(Date.now() % 100000, "REQ", r.url().slice(22, 80)));
    page.on("requestfinished", (r) => r.url().includes("/api/") && console.log(Date.now() % 100000, "FIN", r.url().slice(22, 80)));
    page.on("console", (m) => console.log("console:", m.text().slice(0, 200)));
    page.on("requestfailed", (r) => console.log(Date.now() % 100000, "FAILED", r.url().slice(22, 80)));
    page.on("framenavigated", (f) => f === page.mainFrame() && console.log(Date.now() % 100000, "NAV", f.url().slice(22)));
  }
  await page.goto("http://127.0.0.1:8742/fitsource/");
  await page.waitForFunction(() => /סריקה מעמיקה פעילה/.test(document.querySelector("[data-engine]").textContent), null, { timeout: 8000 }).catch(() => failures.push("deep: home did not report deep scan"));
  await page.setInputFiles("[data-file]", FIT_PHOTO);
  await page.waitForSelector("[data-tape] .log__line:nth-child(3)", { timeout: 15000 });
  await shot(page, "deep-1-scanning");
  await page.waitForSelector(".tags .tag", { timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, "deep-2-results");
  const tape = await page.evaluate(() => document.querySelectorAll(".match").length);
  check(tape === 3, `deep: expected 3 shop matches, got ${tape}`);
  const label = await page.locator(".detail__head .label").first().textContent();
  check(/סריקה מעמיקה/.test(label), `deep: header label "${label}"`);
  // alerts on both pieces with a shop page: the jacket (the shop says sold out) and the jeans (price)
  const watchBtn = page.locator('.tags .tag [data-action="watch"]');
  check((await watchBtn.count()) === 2, `deep: expected two alert buttons, got ${await watchBtn.count()}`);
  check((await watchBtn.nth(1).textContent()).includes("התראת מחיר"), "deep: the in-stock jeans offer a price alert");
  const firstStatus = await page.locator(".tags .tag").first().locator(".tag__meta .status").textContent();
  check(/אזל/.test(firstStatus), `deep: jacket should be verified sold out, got "${firstStatus}"`);
  const total = await page.locator(".total__value").textContent();
  check(/1,039\s*\u200f?₪/.test(total), `deep: total "${total}" (in-stock resale 449 + jeans 590)`);
  const shopHref = await page.locator(".match").first().getAttribute("href");
  check(shopHref === "https://harrow.example.com/products/chore-jacket", `deep: shop link ${shopHref}`);
  check((await page.locator(".match").first().getAttribute("rel")) === "sponsored noopener noreferrer", "deep: outbound links need rel=sponsored");
  // WhatsApp: the message lists each piece with the shop link FitSource found
  const waSend = decodeURIComponent((await page.locator('.wa-bar [data-wa="send"]').getAttribute("href")).split("text=")[1]);
  check(waSend.includes("https://harrow.example.com/products/chore-jacket") && waSend.includes("1951 Raw Selvedge"), `deep: WhatsApp message ${waSend}`);
  check(/לקנות/.test(decodeURIComponent(await page.locator('.wa-bar [data-wa="ask"]').getAttribute("href"))), "deep: ask-friends message");
  // "יש לי": marking the jeans as owned leaves only the jacket (resale 449) to buy
  await page.locator('.tags .tag [data-action="own"]').nth(1).click();
  const owned = await page.locator("[data-total-slot]").innerText();
  check(/להשלמת הלוק/.test(owned) && /449/.test(owned) && /1,039/.test(owned), `deep: total with owned jeans "${owned}"`);
  await page.locator('.tags .tag [data-action="own"]').nth(1).click();
  // turning an alert on checks the shop at once, which brings its sizes
  const savedItem = (part) => page.evaluate((p) => (JSON.parse(localStorage.getItem("fs.closet.v1") || "[]").find((i) => i.url && i.url.includes(p)) || null), part);
  await watchBtn.first().click();
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("fs.closet.v1") || "[]").find((i) => i.url && i.url.includes("chore-jacket")) || {}).sizes, null, { timeout: 10000 }).catch(() => failures.push("deep: first check did not bring the jacket's sizes"));
  await watchBtn.nth(1).click();
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("fs.closet.v1") || "[]").find((i) => i.url && i.url.includes("1951")) || {}).checkedAt, null, { timeout: 10000 }).catch(() => failures.push("deep: first check of the jeans did not run"));
  // in the closet, watch only size M of the jacket
  await page.goto("http://127.0.0.1:8742/fitsource/closet?tab=watching");
  await page.waitForSelector("[data-check]");
  const jacketTag = page.locator('.closet-grid .tag', { hasText: "Chore Jacket" });
  await jacketTag.locator('[data-act="size"][data-size="M"]').click();
  check((await savedItem("chore-jacket")).watchSize === "M", "deep: size M not saved");
  // the M comes back and the jeans get cheaper; "Check now" reports both
  jacketInStock = true;
  jeansPrice = 49000;
  await page.waitForTimeout(3000); // let the visit's background check (rate-limited) run first
  await page.locator("[data-check]").click();
  await page.waitForFunction(() => /2 עדכונים/.test(document.querySelector("[data-check-note]").textContent), null, { timeout: 15000 }).catch(async () => failures.push("deep: Check now did not report the size and the price drop: " + (await page.locator("[data-check-note]").textContent())));
  check(/מידה M חזרה/.test(await jacketTag.textContent()), "deep: size flag missing on the jacket");
  const jeansTag = page.locator('.closet-grid .tag', { hasText: "1951" });
  check(/ירד מ־/.test(await jeansTag.textContent()) && /490/.test(await jeansTag.textContent()), `deep: price drop not shown: ${await jeansTag.textContent()}`);
  await shot(page, "deep-3-restock");
  for (const p of problems) failures.push("deep: " + p);
  await ctx.close();
  server.close();
  claude.close();
}

// ---------- 3. feed and fit pages ----------
if (run("feed")) {
  const server = await startServer(8744);
  const ctx = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const problems = watch(page);
  await page.goto("http://127.0.0.1:8744/fitsource/feed");
  await page.waitForSelector(".grid .card");
  const all = await page.locator(".grid .card").count();
  await page.locator('[data-vibe="טקוור"]').tap();
  check((await page.locator(".grid .card").count()) === 1, "Techwear filter should show 1 fit");
  await page.locator('[data-vibe="הכל"]').tap();
  check((await page.locator(".grid .card").count()) === all, "All should show every fit again");
  await page.locator('[data-sort="new"]').tap();
  check((await page.locator(".grid .card .card__title").first().textContent()) === "ילדת קניון", "Newest should start with the 3h-old fit");
  await page.locator(".grid .card").first().tap();
  await page.waitForSelector(".detail .tags .tag");
  check(/\/fitsource\/fit-mall-rat$/.test(page.url()), "tapping a card opens its fit");
  check((await page.title()).startsWith("ילדת קניון"), `fit page title: ${await page.title()}`);
  // Back returns to the feed, Forward to the fit, without reloading
  await page.goBack();
  await page.waitForSelector(".grid .card");
  check(/\/fitsource\/feed$/.test(page.url()) && (await page.title()).startsWith("פיד"), `back should show the feed: ${page.url()}`);
  await page.goForward();
  await page.waitForSelector(".detail .tags .tag");
  check(/\/fitsource\/fit-mall-rat$/.test(page.url()), "forward should show the fit again");
  await page.locator(".detail__media .hotspot").nth(2).tap();
  check(await page.locator(".tags .tag").nth(2).evaluate((e) => e.classList.contains("is-active")), "tapping a dot highlights the tag");
  await page.locator("[data-like]").tap();
  check((await page.locator("[data-like]").getAttribute("aria-pressed")) === "true", "like did not toggle");
  await page.locator('.tags .tag [data-action="save"]').first().tap();
  await page.waitForTimeout(200);
  check((await page.locator(".tabbar [data-closet-count]").textContent()) === "1", "tab bar badge should be 1 after saving");
  await page.goto("http://127.0.0.1:8744/fitsource/fit-created-by-god");
  await page.waitForSelector(".tags .tag");
  const dsHref = await page.locator(".tags .tag a.btn").first().getAttribute("href");
  check(dsHref === "../product.html#circle-logo-tee", `Dream Studios link: ${dsHref}`);
  check((await page.locator(".tags .tag a.btn").first().getAttribute("target")) === null, "store link should open in the same tab");
  await page.locator(".tags .tag a.btn").first().tap();
  await page.waitForURL(/product\.html#circle-logo-tee/);
  await page.goto("http://127.0.0.1:8744/fitsource/fit-night-shift");
  await page.waitForSelector("[data-receipt]");
  // WhatsApp: send the fit with its address, or ask friends
  const waFit = decodeURIComponent((await page.locator('[data-wa="send"]').getAttribute("href")).split("text=")[1]);
  check(waFit.startsWith("משמרת לילה") && waFit.endsWith("/fitsource/fit-night-shift") && /359/.test(waFit) && /אזל/.test(waFit), `fit WhatsApp message: ${waFit}`);
  check((await page.locator('[data-wa="send"]').getAttribute("target")) === "_blank", "WhatsApp opens in a new tab");
  // "יש לי": the total turns into what's left to buy, and survives a reload
  await page.locator('.tags .tag [data-action="own"]').first().tap();
  check(/להשלמת הלוק/.test(await page.locator("[data-total-slot]").innerText()), "owned piece should change the total");
  await page.reload();
  await page.waitForSelector("[data-receipt]");
  check((await page.locator(".tag.is-owned").count()) === 1 && (await page.locator('.tags .tag [data-action="own"]').first().getAttribute("aria-pressed")) === "true", "owned piece should be remembered");
  await page.locator("[data-receipt]").tap();
  await page.waitForSelector(".modal img");
  await shot(page, "feed-receipt-phone");
  await page.locator("[data-close]").tap();
  // theme toggle persists
  await page.locator("[data-theme-toggle]").tap();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload();
  check((await page.evaluate(() => document.documentElement.dataset.theme)) === theme, "theme choice should persist");
  for (const p of problems.filter((p) => !/product\.html|\/assets\/(js|css|img)\/[^ ]*\b(404)/.test(p))) failures.push("feed: " + p);
  await ctx.close();
  server.close();
}

await browser.close();
if (failures.length) {
  console.log("FAIL\n" + failures.join("\n"));
  process.exit(1);
}
console.log("ok: e2e flows passed; screenshots in " + out);
