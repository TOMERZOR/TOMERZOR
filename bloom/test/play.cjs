// Plays the game in a phone-sized browser with real taps (to turn bundles) and drags, and saves
// screenshots along the way.
//   npx http-server -p 8093 .   (from the repo root)
//   node bloom/test/play.cjs <outDir> [drops=40]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const out = process.argv[2] || 'shots';
const drops = +(process.argv[3] || 40);
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8093/bloom/?t=' + Date.now());
  await page.waitForTimeout(800);
  await page.click('[data-act="ok"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, '1-home.png') });
  await page.click('#h-play', { force: true });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, '2-start.png') });

  const box = await page.locator('#board').boundingBox();
  let done = 0, shots = 0;
  while (done < drops) {
    // A decent player: the move (bundle, turns, column) with the most points, then the lowest garden.
    const mv = await page.evaluate(async () => {
      const B = window.__bloom, G = B.game;
      if (!G || G.over || G.busy) return null;
      const bd = await import('./js/board.js');
      const { stepPoints } = await import('./js/rules.js');
      let best = null;
      G.tray.forEach((t, i) => {
        if (!t) return;
        let p = t.piece;
        for (let k = 0; k < 4; k++) {
          const w = bd.pieceWidth(p), h = bd.pieceHeight(p);
          for (let c = 0; c + w <= bd.COLS; c++) {
            if (!bd.canDrop(G.board, p, c)) continue;
            const b = bd.cloneBoard(G.board);
            bd.drop(b, p, c);
            const steps = bd.resolve(b);
            const v = steps.reduce((a, s) => a + stepPoints(s), 0) - Math.max(...bd.heights(b)) * 15 + Math.random() * 5;
            if (!best || v > best.v) best = { v, i, k, c, w, h };
          }
          p = bd.rotate(p);
        }
      });
      if (!best) return null;
      const L = B.layout, s = L.slots[best.i], cell = L.cell;
      return { slot: [s.x, s.y], turns: best.k, to: [L.boardX + best.c * cell + best.w * cell / 2, L.boardY + cell * 2] };
    });
    if (!mv) {
      await page.waitForTimeout(300);
      if (await page.locator('#overlay').isVisible()) break;
      continue;
    }
    const sx = box.x + mv.slot[0], sy = box.y + mv.slot[1];
    for (let k = 0; k < mv.turns; k++) { await page.mouse.click(sx, sy); await page.waitForTimeout(60); }
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let s = 1; s <= 6; s++) await page.mouse.move(sx + (box.x + mv.to[0] - sx) * s / 6, sy + (box.y + mv.to[1] - sy) * s / 6);
    if (done === 3) await page.screenshot({ path: path.join(out, '3-drag.png') });
    await page.mouse.up();
    done++;
    // catch a bloom mid-animation
    await page.waitForTimeout(330);
    const chain = await page.evaluate(() => window.__bloom.game?.busy && window.__bloom.game.view !== window.__bloom.game.board);
    if (chain && shots < 3) { shots++; await page.screenshot({ path: path.join(out, `4-bloom-${shots}.png`) }); }
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__bloom.game?.busy)); i++) await page.waitForTimeout(100);
  }
  await page.screenshot({ path: path.join(out, '5-late.png') });
  const st = await page.evaluate(() => { const G = window.__bloom.game; return G && { score: G.score, drops: G.drops, blooms: G.blooms, maxChain: G.maxChain, weeds: G.weeds, specials: G.specials }; });
  console.log('dropped', done, st);
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
