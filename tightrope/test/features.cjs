// Plays the new content in a phone-sized browser with fake motion sensors and
// saves screenshots: a late level (hurdles, ibex, coins, rain), the character
// shop, a level with another character, and endless mode across a rope change.
// A bot balances, jumps hurdles and leans out of the ibex's way.
// Run: npx http-server -p 8091 . (from the repo root), then
//      node tightrope/test/features.cjs <outDir>
const { chromium } = require('playwright');
const path = require('path');

const out = process.argv[2] || '.';
const URL = process.env.URL || 'http://localhost:8091/tightrope/';

async function phone(browser, saveData) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.addInitScript((data) => {
    localStorage.setItem('tightrope.v1', JSON.stringify(data));
    const beta = 50 * Math.PI / 180;
    let gamma = 0.05, last = performance.now();
    window.__bot = { on: true };
    setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const tr = window.__tightrope;
      const s = tr && tr.sim;
      let target = 0.05;
      if (s && window.__bot.on && s.state === 'walk') {
        const ibex = s.ibexes.find((b) => b.state === 'come' && b.z - s.z < 2.2);
        const off = ibex ? 0.17 : 0;
        target = 0.05 - (1.2 * (s.theta - off) + 0.8 * s.omega) / Math.cos(beta);
        const h = s.hurdles.find((x) => !x.done && x.z > s.z && x.z - s.z < s.speed * 0.3);
        if (h && !h.asked) { h.asked = true; window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); }
      }
      const g0 = gamma;
      gamma += (target - gamma) * Math.min(1, dt / 0.12);
      const rate = (gamma - g0) / Math.max(dt, 1e-3);
      const up = [-Math.cos(beta) * Math.sin(gamma), Math.sin(beta), Math.cos(beta) * Math.cos(gamma)];
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        accelerationIncludingGravity: { x: up[0] * 9.81, y: up[1] * 9.81, z: up[2] * 9.81 },
        rotationRate: { alpha: 0, beta: 0, gamma: rate * 180 / Math.PI },
        interval: 16,
      }));
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 50, gamma: gamma * 180 / Math.PI }));
    }, 16);
  }, saveData);
  await page.goto(URL);
  await page.waitForTimeout(1000);
  return page;
}

const state = (page) => page.evaluate(() => {
  const s = window.__tightrope.sim;
  return s && { state: s.state, fail: s.fail, z: +s.z.toFixed(1), spilled: +(s.spilled * 100).toFixed(1), score: Math.round(s.score), coins: s.coins, mult: s.mult, rope: window.__tightrope.run.rope };
});

// Waits until fn(sim) is true in the page, or the timeout passes.
async function until(page, fn, ms) {
  try { await page.waitForFunction(fn, null, { timeout: ms, polling: 100 }); return true; } catch { return false; }
}

(async () => {
  const browser = await chromium.launch();
  const report = {};

  // 1. Level 7: hurdles, ibex, rain, coins, knots.
  let page = await phone(browser, { unlocked: 7, tutorialSeen: true, seen: {} });
  await page.click('#play-btn');
  await page.waitForTimeout(1200);
  await page.click('#brief-start');
  await page.waitForTimeout(3600);
  await until(page, () => { const s = window.__tightrope.sim; return s.hurdles.some((h) => !h.done && h.z - s.z < 5); }, 60000);
  await page.screenshot({ path: path.join(out, 'f_hurdle.png') });
  await until(page, () => { const s = window.__tightrope.sim; return s.ibexes.some((b) => b.state === 'come' && b.z - s.z < 7); }, 60000);
  await page.screenshot({ path: path.join(out, 'f_ibex.png') });
  await until(page, () => { const s = window.__tightrope.sim; return s.clouds.some((c) => s.z > c.z0 - 4 && s.z < c.z1); }, 60000);
  await page.screenshot({ path: path.join(out, 'f_rain.png') });
  await until(page, () => window.__tightrope.sim.state !== 'walk', 90000);
  await page.waitForTimeout(1500);
  report.level7 = await state(page);
  await page.screenshot({ path: path.join(out, 'f_result.png') });
  report.level7.errors = page.errors;
  await page.close();

  // 2. Shop: buy the grandma, then play level 2 with her soup.
  page = await phone(browser, { unlocked: 3, coins: 400, tutorialSeen: true, seen: { run: 1, coins: 1, mult: 1, hurdle: 1, ibex: 1, rain: 1, orb: 1 } });
  await page.click('#shop-btn');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, 'f_shop.png') });
  await page.locator('.char').nth(2).locator('button').click();
  await page.waitForTimeout(400);
  report.shop = await page.evaluate(() => ({ coins: window.__tightrope.save.coins, char: window.__tightrope.save.char, owned: window.__tightrope.save.owned }));
  await page.click('#shop [data-back]');
  await page.click('#play-btn');
  await page.waitForTimeout(1200);
  await page.click('#brief-start');
  await page.waitForTimeout(3600 + 9000);
  await page.screenshot({ path: path.join(out, 'f_grandma.png') });
  report.grandma = await state(page);
  report.grandma.errors = page.errors;
  await page.close();

  // 3. Endless: across the first rope change.
  page = await phone(browser, { unlocked: 1, tutorialSeen: true, seen: {} });
  await page.click('#endless-btn');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, 'f_endless_brief.png') });
  await page.click('#brief-start');
  await page.waitForTimeout(3600 + 8000);
  await page.screenshot({ path: path.join(out, 'f_endless.png') });
  await until(page, () => window.__tightrope.run.rope >= 1, 90000);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, 'f_endless_rope2.png') });
  report.endless = await state(page);
  // Let go: the run should end.
  await page.evaluate(() => { window.__bot.on = false; });
  await until(page, () => window.__tightrope.mode === 'over', 30000);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'f_endless_over.png') });
  report.endlessOver = { ...(await state(page)), best: await page.evaluate(() => window.__tightrope.save.endless), errors: page.errors };
  await page.close();

  console.log(JSON.stringify(report, null, 1));
  await browser.close();
  const errs = [report.level7.errors, report.grandma.errors, report.endlessOver.errors].flat();
  process.exit(errs.length ? 1 : 0);
})();
