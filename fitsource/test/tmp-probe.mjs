import { startServer, launch, newContext, watch } from "./harness.mjs";
const server = await startServer(8764);
const b = await launch();
// 1) phone scan result
let ctx = await newContext(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
let p = await ctx.newPage();
const probs = watch(p);
await p.goto("http://127.0.0.1:8764/fitsource/");
await p.setInputFiles("[data-file]", "assets/img/fits/linen-season.jpg");
await p.waitForTimeout(2500);
await p.screenshot({ path: "test/out/phone-scanning.png" });
await p.waitForSelector(".tags .tag", { timeout: 200000 });
await p.waitForTimeout(800);
await p.screenshot({ path: "test/out/phone-results.png" });
await p.evaluate(() => window.scrollTo(0, 900));
await p.waitForTimeout(400);
await p.screenshot({ path: "test/out/phone-results2.png" });
console.log("phone problems:", probs);
await ctx.close();
// 2) model download blocked
ctx = await newContext(b);
await ctx.route("https://huggingface.co/**", (r) => r.abort());
p = await ctx.newPage();
await p.goto("http://127.0.0.1:8764/fitsource/");
await p.setInputFiles("[data-file]", "assets/img/fits/linen-season.jpg");
await p.waitForSelector(".notice, .tags .tag", { timeout: 60000 });
console.log("offline:", await p.locator(".detail").innerText());
await p.screenshot({ path: "test/out/offline.png" });
await b.close(); server.close();
