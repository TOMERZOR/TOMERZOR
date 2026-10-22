// A chain that beats the personal best is named on the win sheet; a smaller one is not.
export default async ({ page, wait, shot }) => {
  await wait(600);
  const play = () => page.evaluate(async () => {
    const S = window.__shard;
    for (const deg of S.game.level.proof) { S.game.debugAim(deg * Math.PI / 180); S.game.debugFire(); await new Promise((r) => setTimeout(r, 2600)); if (S.game.sim.st.won) break; }
    await new Promise((r) => setTimeout(r, 2400));
    return { combo: S.game.sim.st.maxCombo, record: document.querySelector('#sheet .record')?.textContent || null };
  });
  await page.evaluate(() => { const S = window.__shard; S.save.d.stats.bestCombo = 0; for (let i = 0; i < 4; i++) S.save.d.stars[S.LEVELS[i].id] = 3; S.startLevel(4); });
  const a = await play();
  await shot('record');
  console.log(`${a.combo >= 4 && a.record ? 'PASS' : a.combo < 4 ? 'SKIP' : 'FAIL'} first big chain named: ${JSON.stringify(a)}`);
  await page.evaluate(() => { const S = window.__shard; S.startLevel(4); });
  await wait(300);
  const b = await play();
  console.log(`${!b.record ? 'PASS' : 'FAIL'} same chain again is not a record: ${JSON.stringify(b)}`);
};
