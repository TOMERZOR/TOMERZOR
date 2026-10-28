// Plays the game in a phone-sized browser with real touch-like drags and saves screenshots.
//   npx http-server -p 8093 .   (from the repo root)
//   node bloom/test/play.cjs <outDir> [moves=40]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const out = process.argv[2] || 'shots';
const moves = +(process.argv[3] || 40);
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8093/bloom/?t=' + Date.now());
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, '1-streak.png') });
  await page.click('[data-act="ok"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, '2-home.png') });
  await page.click('#h-play', { force: true });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, '3-game.png') });

  const box = await page.locator('#board').boundingBox();
  let placed = 0, shot = 0;
  for (let k = 0; k < moves * 3 && placed < moves; k++) {
    // Pick the move that clears the most lines (a decent player), then drag it like a finger.
    const mv = await page.evaluate(() => {
      const B = window.__bloom, G = B.game;
      if (!G || G.over) return null;
      const L = B.layout;
      let best = null;
      G.tray.forEach((p, i) => {
        if (!p) return;
        for (let r = 0; r + p.shape.h <= 8; r++) for (let c = 0; c + p.shape.w <= 8; c++) {
          let ok = true;
          for (const [dr, dc] of p.shape.cells) if (G.grid[(r + dr) * 8 + c + dc]) ok = false;
          if (!ok) continue;
          const g = G.grid.slice();
          for (const [dr, dc] of p.shape.cells) g[(r + dr) * 8 + c + dc] = 1;
          let lines = 0;
          for (let a = 0; a < 8; a++) { let row = true, col = true; for (let b = 0; b < 8; b++) { if (!g[a * 8 + b]) row = false; if (!g[b * 8 + a]) col = false; } lines += row + col; }
          const v = lines * 10 + r * 0.1 + Math.random();
          if (!best || v > best.v) best = { v, i, r, c, w: p.shape.w, h: p.shape.h };
        }
      });
      if (!best) return null;
      const s = L.slots[best.i], cell = L.cell;
      // where the mouse must be so the piece's top-left lands on (r, c): see dragTo() (a mouse holds the piece centred)
      const x = L.boardX + best.c * cell + best.w * cell / 2;
      const y = L.boardY + best.r * cell + best.h * cell / 2;
      return { from: [s.x, s.y], to: [x, y] };
    });
    if (!mv) { await page.waitForTimeout(400); if (await page.locator('#overlay').isVisible()) break; continue; }
    await page.mouse.move(box.x + mv.from[0], box.y + mv.from[1]);
    await page.mouse.down();
    for (let s = 1; s <= 6; s++) await page.mouse.move(box.x + mv.from[0] + (mv.to[0] - mv.from[0]) * s / 6, box.y + mv.from[1] + (mv.to[1] - mv.from[1]) * s / 6);
    if (placed === 5) await page.screenshot({ path: path.join(out, '4-drag.png') });
    await page.mouse.up();
    placed++;
    await page.waitForTimeout(placed % 10 === 0 ? 120 : 260);
    const lines = await page.evaluate(() => window.__bloom.game?.lines || 0);
    if (lines > 0 && shot === 0) { shot = 1; await page.screenshot({ path: path.join(out, '5-clear.png') }); }
  }
  await page.screenshot({ path: path.join(out, '6-late.png') });
  const st = await page.evaluate(() => ({ score: window.__bloom.game?.score, placements: window.__bloom.game?.placements, lines: window.__bloom.game?.lines }));
  console.log('placed', placed, st);
  // the game-over flow: offer of a second chance, then results
  for (let i = 0; i < 30 && !(await page.locator('#overlay').isVisible()); i++) await page.waitForTimeout(300);
  if (await page.locator('#overlay').isVisible()) {
    await page.screenshot({ path: path.join(out, '7-over.png') });
    const end = page.locator('[data-act="end"]');
    if (await end.count()) { await end.click(); await page.waitForTimeout(1600); await page.screenshot({ path: path.join(out, '8-results.png') }); }
  }
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
