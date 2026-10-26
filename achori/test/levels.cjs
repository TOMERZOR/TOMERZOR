// Opens every level in a phone-sized browser, releases the mice, then forces a win
// to walk through the result screens and the ending. Fails on any page error.
//   node achori/test/levels.cjs [port=8093]
const { chromium } = require('playwright');
const port = process.argv[2] || 8093;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:${port}/achori/?t=${Date.now()}`);
  await p.evaluate(() => localStorage.setItem('achori.v1', JSON.stringify({ unlocked: 0, stars: [], hints: {} })));
  await p.reload();
  await p.waitForSelector('#title.show');
  await p.click('#play-btn');
  const total = await p.evaluate(() => window.__achori.LEVELS.length);
  for (let i = 0; i < total; i++) {
    await p.waitForSelector('#dialog.show');
    for (let k = 0; k < 5 && await p.locator('#dialog.show').count(); k++) { await p.click('#dlg-bubble, .dlg-bubble', { force: true }); await p.waitForTimeout(80); }
    while (!(await p.locator('#hint').isHidden())) { await p.click('#hint-ok'); await p.waitForTimeout(60); }
    await p.click('#go-btn', { force: true });
    await p.waitForTimeout(2500);
    // finish it: kill every mouse that is out, and make the rest arrive already dead
    await p.evaluate(() => {
      const g = window.__achori.game;
      g.spawnQueue.forEach((w) => { w.t = 0; });
      g.update(0.01);
      for (const m of g.mice) { if (m.respawnIn > 0) { m.respawnIn = 0.001; g.update(0.01); } }
      for (const m of g.mice) if (m.alive) { m.state = 'caught'; m.t = 5; m.heldMax = 5; g.damage(m, m.hp, 'whack'); }
      g.update(0.01);
    });
    await p.waitForSelector('#result.show', { timeout: 8000 });
    const title = await p.textContent('#res-title');
    console.log(i + 1, title, errs.length ? errs : '');
    await p.waitForTimeout(300);
    await p.click('#res-next');
  }
  await p.waitForSelector('#ending.show', { timeout: 5000 });
  console.log('ending shown');
  await p.click('#end-btn');
  await p.waitForSelector('#levels.show');
  console.log('takeover:', await p.textContent('#takeover-text'));
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
