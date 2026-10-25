// Plays a level in a phone-sized browser and saves screenshots along the way.
//   node achori/test/play.cjs <outDir> [level=1] [port=8093]
// Needs the repo served locally: npx http-server -p 8093 -c-1 .
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'shots';
const level = Number(process.argv[3] || 1) - 1;
const port = process.argv[4] || 8093;
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') });
  await page.goto(`http://localhost:${port}/achori/?t=${Date.now()}`);
  await page.evaluate((lv) => { localStorage.setItem('achori.v1', JSON.stringify({ unlocked: Math.max(lv, 0), stars: [], hints: {} })); }, level);
  await page.reload();
  await page.waitForSelector('#title.show', { timeout: 20000 });
  await page.waitForTimeout(400);
  await shot('01-title');
  await page.click('#levels-btn');
  await page.waitForTimeout(400);
  await shot('02-levels');
  await page.locator('.lvl').nth(level).click();
  await page.waitForTimeout(500);
  await shot('03-dialog');
  await page.click('#dlg-skip');
  await page.waitForTimeout(500);
  await shot('04-plan');
  // place a snap and a glue on the route the game shows
  const cells = await page.evaluate(() => {
    const g = window.__achori.game;
    const rt = g.previewRoutes()[0].path;
    return rt;
  });
  const tap = async (cellIndex) => {
    const p = await page.evaluate((i) => {
      const s = window.__achori.scene; const c = i % 7, r = Math.floor(i / 7);
      return s.project(c - 3, 0, r - 4);
    }, cellIndex);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(120);
  };
  while (!(await page.locator('#hint').isHidden())) { await page.click('#hint-ok'); await page.waitForTimeout(150); }
  await page.click('.tool[data-tool="snap"]');
  await tap(cells[Math.floor(cells.length * 0.55)]);
  if (await page.locator('.tool[data-tool="glue"]').count()) { await page.click('.tool[data-tool="glue"]'); await tap(cells[Math.floor(cells.length * 0.35)]); }
  await page.waitForTimeout(300);
  while (!(await page.locator('#hint').isHidden())) { await page.click('#hint-ok'); await page.waitForTimeout(150); }
  await shot('05-placed');
  await page.click('#go-btn', { force: true });
  let n = 0, shots = 0, t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const st = await page.evaluate(() => {
      const g = window.__achori.game; if (!g) return { phase: 'none' };
      const s = window.__achori.scene;
      const held = g.mice.filter((m) => m.alive && g.isHeld(m)).map((m) => s.mouseScreen(m));
      return { phase: g.phase, held };
    });
    if (st.phase !== 'action') break;
    if (st.held.length) {
      for (let k = 0; k < 4; k++) await page.touchscreen.tap(st.held[0].x + (Math.random() - 0.5) * 10, st.held[0].y + (Math.random() - 0.5) * 10);
      if (shots < 3 && n++ % 6 === 2) await shot('06-mash-' + shots++);
    } else {
      await page.waitForTimeout(80);
      if (shots === 0 && n++ === 20) await shot('06-run');
    }
  }
  await page.waitForTimeout(3200);
  await shot('07-result');
  console.log('phase', await page.evaluate(() => window.__achori.game && window.__achori.game.phase));
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})();
