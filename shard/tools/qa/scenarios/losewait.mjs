// Out of balls: how soon the lose sheet comes after the last shot, and what the replay that runs ahead costs.
// THROTTLE=4 approximates a mid-range phone.
export default async ({ page, wait }) => {
  await wait(600);
  // the replay's price per step, for levels with their proof shots fired (it has no shards to move)
  const cost = await page.evaluate(async () => {
    const planck = await import('./js/vendor/planck.js');
    const { createSim } = await import('./js/engine.js');
    // the replay has no shards: it plays the game's world only
    let n = 0, ms = 0;
    for (let round = 0; round < 2; round++) {
      n = 0; const t0 = performance.now();
      for (const lv of window.__shard.LEVELS.slice(50, 70)) {
        const r = createSim(planck, lv);
        for (const a of lv.proof) { r.fire(a * Math.PI / 180); for (let k = 0; k < 240; k++, n++) r.step(); }
      }
      ms = performance.now() - t0;
    }
    return { steps: n, ms };
  });
  console.log(`replay cost: ${(cost.ms / cost.steps * 1000).toFixed(0)} µs per step (${cost.steps} steps in ${cost.ms.toFixed(0)} ms)`);

  for (const i of [5, 30, 52, 77, 101, 117]) {
    await page.evaluate((i) => { const s = window.__shard.save; s.d.stars = {}; s.d.tipsSeen = ['frost', 'lock']; s.d.worldsSeen = [0, 1, 2, 3, 4]; s.flush(); window.__shard.startLevel(i); }, i);
    await wait(900);
    // a long frame while the replay runs would show as a stutter
    await page.evaluate(() => { window.__frames = []; let last = performance.now(); const f = (t) => { window.__frames.push(t - last); last = t; if (window.__frames.length < 600) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const balls = await page.evaluate(() => window.__shard.game.sim.st.balls);
    for (let b = 0; b < balls; b++) {
      // straight into the floor beside the cannon: a shot that breaks nothing
      await page.evaluate((b) => { const g = window.__shard.game; g.debugAim(b % 2 ? 0.15 : Math.PI - 0.15); g.debugFire(); }, b);
      // live counts balls at the next step: give it one, then wait for the ball to go
      if (b < balls - 1) { await wait(400); await page.waitForFunction(() => window.__shard.game.sim.st.live === 0, null, { timeout: 15000 }); }
    }
    const t0 = Date.now();
    const ok = await page.waitForFunction(() => !document.getElementById('sheet').hidden && document.querySelector('#sheet h2')?.textContent === 'Out of balls', null, { timeout: 20000, polling: 'raf' }).then(() => true, () => false);
    if (!ok) {
      console.log('FAIL no lose sheet:', JSON.stringify(await page.evaluate(() => { const g = window.__shard.game, st = g.sim.st; return { id: g.level.id, balls: st.balls, used: st.used, live: st.live, won: st.won, lost: st.lost, glass: st.glass, busy: g.busy, mode: window.__shard.mode, sheet: document.getElementById('sheet').hidden ? 'hidden' : document.querySelector('#sheet h2')?.textContent }; })));
      await page.evaluate(() => window.__shard.goHome()); await wait(300);
      continue;
    }
    const dt = (Date.now() - t0) / 1000;
    const st = await page.evaluate(() => { const f = window.__frames.slice(5); return { live: window.__shard.game.sim.st.live, worst: Math.max(...f), id: window.__shard.game.level.id }; });
    console.log(`${dt < 2 ? 'PASS' : 'FAIL'} ${st.id}: "Out of balls" ${dt.toFixed(2)} s after the last shot (ball still out: ${st.live}), worst frame ${st.worst.toFixed(0)} ms`);
    await page.evaluate(() => window.__shard.goHome());
    await wait(300);
  }
};
