// Lose -> continue with coins (-60, +1 ball) -> win -> coins credited; continued wins give 1 star.
export default async ({ page, wait }) => {
  await wait(600);
  await page.evaluate(() => { const s = window.__shard.save; s.d.coins = 100; s.d.stars = { 'w0-1': 3 }; s.flush(); window.__shard.setManual(true); window.__shard.startLevel(1); });
  const tick = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__shard.tick(1 / 60); }, n);
  // waste every ball into the floor corner
  for (let k = 0; k < 6; k++) {
    const st = await page.evaluate(() => ({ balls: window.__shard.game.sim.st.balls, lost: window.__shard.game.sim.st.lost }));
    if (st.lost || st.balls === 0) break;
    await page.evaluate(() => { window.__shard.game.debugAim(8 * Math.PI / 180); window.__shard.game.debugFire(); });
    await tick(30);
  }
  for (let i = 0; i < 80; i++) { await tick(10); if (await page.evaluate(() => !document.getElementById('sheet').hidden)) break; }
  await wait(400);
  const sheet1 = await page.evaluate(() => document.querySelector('#sheet h2')?.textContent);
  const coins0 = await page.evaluate(() => window.__shard.save.d.coins);
  await page.click('#sheet [data-act="coins"]');
  await wait(300);
  const after = await page.evaluate(() => ({ coins: window.__shard.save.d.coins, balls: window.__shard.game.sim.st.balls }));
  console.log(`${sheet1 === 'Out of balls' ? 'PASS' : 'FAIL'} lose sheet: "${sheet1}"`);
  console.log(`${coins0 - after.coins === 60 && after.balls === 1 ? 'PASS' : 'FAIL'} continue: coins ${coins0} -> ${after.coins}, balls ${after.balls}`);
  // finish with the proof angle
  await page.evaluate(() => { const g = window.__shard.game; g.debugAim(g.level.proof[0] * Math.PI / 180); g.debugFire(); });
  for (let i = 0; i < 120; i++) { await tick(10); if (await page.evaluate(() => window.__shard.game.sim.st.won && !document.getElementById('sheet').hidden)) break; }
  await wait(1500);
  const res = await page.evaluate(() => ({ won: window.__shard.game.sim.st.won, title: document.querySelector('#sheet h2')?.textContent, stars: window.__shard.save.d.stars['w0-2'], coins: window.__shard.save.d.coins }));
  console.log(`${res.won ? 'PASS' : 'INFO'} win after continue: ${JSON.stringify(res)}`);
  if (res.won) console.log(`${res.stars === 1 ? 'PASS' : 'FAIL'} a continued win gives 1 star`);
};
