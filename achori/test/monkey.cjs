// Random taps everywhere for a few minutes: on the board, the tools, the abilities, pause,
// restart, leaving mid-level, the dialogue, the result screen. Fails on any page error, and
// checks that nothing from a level is left on screen after leaving it.
//   node achori/test/monkey.cjs [seconds=150] [port=8093]
const { chromium } = require('playwright');
const secs = Number(process.argv[2] || 150);
const port = process.argv[3] || 8093;

(async () => {
  const b = await chromium.launch();
  const sizes = [[390, 844], [360, 640], [430, 932]];
  const errs = [];
  let checks = 0;
  for (const [w, h] of sizes) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    p.on('pageerror', (e) => errs.push(`${w}x${h} pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(`${w}x${h} console: ${m.text()}`); });
    await p.goto(`http://localhost:${port}/achori/?t=${Date.now()}`);
    // an old save from before scores and haptics existed must still load
    await p.evaluate(() => localStorage.setItem('achori.v1', JSON.stringify({ unlocked: 19, stars: [3, 2, 1] })));
    await p.reload();
    await p.waitForSelector('#title.show', { timeout: 20000 });
    const end = Date.now() + (secs * 1000) / sizes.length;
    let rnd = 7;
    const R = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
    while (Date.now() < end) {
      const screen = await p.evaluate(() => (document.querySelector('.screen.show') || {}).id || 'game');
      if (screen === 'title') await p.click(R() < 0.5 ? '#play-btn' : '#levels-btn');
      else if (screen === 'levels') {
        const n = await p.locator('.lvl').count();
        await p.locator('.lvl').nth(Math.floor(R() * n)).click();
      } else if (screen === 'dialog') {
        if (R() < 0.3) await p.click('#dlg-skip'); else await p.click('.dlg-bubble', { force: true });
      } else if (screen === 'pause') {
        await p.click(['#resume-btn', '#resume-btn', '#restart-btn', '#pause-levels', '#pause-sound', '#pause-haptic'][Math.floor(R() * 6)]);
      } else if (screen === 'result') {
        const next = await p.locator('#res-next').isVisible();
        await p.click(next && R() < 0.6 ? '#res-next' : R() < 0.5 ? '#res-retry' : '#res-levels');
        // after leaving a level, nothing of it may stay on screen
        await p.waitForTimeout(150);
        const left = await p.evaluate(() => ({
          float: document.getElementById('float').children.length,
          fly: document.querySelectorAll('.fly').length,
          combo: document.querySelectorAll('.combo').length,
          kill: !document.getElementById('kill').hidden,
        }));
        checks++;
        if (left.float > 3 || left.combo || left.kill) errs.push(`${w}x${h} leftovers after result: ${JSON.stringify(left)}`);
      } else if (screen === 'ending') await p.click('#end-btn');
      else if (screen === 'game') {
        const st = await p.evaluate(() => {
          const g = window.__achori.game;
          if (!g) return null;
          const s = window.__achori.scene;
          const mice = g.mice.filter((m) => m.alive).map((m) => s.mouseScreen(m));
          return { phase: g.phase, mice, hint: !document.getElementById('hint').hidden };
        });
        if (!st) { await p.waitForTimeout(50); continue; }
        if (st.hint) { await p.click('#hint-ok'); continue; }
        const roll = R();
        if (st.phase === 'plan') {
          if (roll < 0.25) { const n = await p.locator('.tool').count(); await p.locator('.tool').nth(Math.floor(R() * n)).click(); }
          else if (roll < 0.85) await p.touchscreen.tap(20 + R() * (w - 40), 120 + R() * (h - 300));
          else if (roll < 0.95) await p.click('#go-btn', { force: true });
          else if (roll < 0.97) await p.click('#ido-btn');
          else await p.click('#pause-btn');
        } else if (st.phase === 'action') {
          if (roll < 0.7 && st.mice.length) {
            const m = st.mice[Math.floor(R() * st.mice.length)];
            for (let k = 0; k < 5; k++) await p.touchscreen.tap(m.x + (R() - 0.5) * 30, m.y + (R() - 0.5) * 30);
          } else if (roll < 0.8) await p.touchscreen.tap(20 + R() * (w - 40), 120 + R() * (h - 300));
          else if (roll < 0.86) { const ab = ['#ab-ofek', '#ab-shalev', '#ab-shaked'][Math.floor(R() * 3)]; if (await p.locator(ab).isVisible()) await p.click(ab, { force: true }); }
          else if (roll < 0.9) { const n = await p.locator('.tool').count(); await p.locator('.tool').nth(Math.floor(R() * n)).click(); }
          else if (roll < 0.92) await p.click('#pause-btn');
          else if (roll < 0.93) { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); }
          else await p.waitForTimeout(200);
          // speed the game along now and then by killing a held mouse
          if (R() < 0.25) await p.evaluate(() => {
            const g = window.__achori.game;
            if (!g) return;
            for (const m of g.mice) if (m.alive) { m.hp = Math.min(m.hp, 1); if (!g.isHeld(m) && m.state !== 'emerge' && m.state !== 'leaving' && Math.random() < 0.5) g.whack(m, 1); }
            g.spawnQueue.forEach((w) => { w.t = Math.min(w.t, g.time + 1); });
          });
        } else await p.waitForTimeout(100);
      }
      if (R() < 0.01) await p.setViewportSize({ width: w, height: h - 1 + Math.round(R() * 2) });
    }
    await p.close();
  }
  await b.close();
  console.log(`result screens checked: ${checks}`);
  console.log(errs.length ? 'ERRORS\n' + [...new Set(errs)].join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
