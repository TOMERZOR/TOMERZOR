// Level-flow moments: a new world's title card, and the 3-star confetti on the win sheet.
export default async ({ page, wait, shot }) => {
  await wait(600);
  await page.evaluate(() => { const S = window.__shard; for (let i = 0; i < 24; i++) S.save.d.stars[S.LEVELS[i].id] = 3; S.save.flush(); S.startLevel(24); });
  await wait(700);
  await shot('flow-worldcard');
  // win level 25 with its proof, then catch the sheet with confetti
  await page.evaluate(async () => {
    const S = window.__shard, lv = S.game.level;
    for (const deg of lv.proof) { S.game.debugAim(deg * Math.PI / 180); S.game.debugFire(); await new Promise((r) => setTimeout(r, 2600)); if (S.game.sim.st.won) break; }
  });
  await wait(2200);
  await shot('flow-win');
  const res = await page.evaluate(() => ({ won: window.__shard.game.sim.st.won, sheet: !document.getElementById('sheet').hidden, title: document.querySelector('#sheet h2')?.textContent, reward: document.getElementById('reward-n')?.textContent }));
  console.log(JSON.stringify(res));
};
