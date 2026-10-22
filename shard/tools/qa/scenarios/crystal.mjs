// Star crystal: filling, ready, shattered; coins granted once.
export default async ({ page, wait, shot }) => {
  await wait(600);
  await page.evaluate(() => { const S = window.__shard; S.save.d.coins = 50; S.save.d.crystals = 0; for (let i = 0; i < 4; i++) S.save.d.stars[S.LEVELS[i].id] = 3; S.save.flush(); S.goHome(); });
  await wait(900);
  await shot('cr-filling');
  await page.click('#btn-crystal', { force: true }); await wait(500);
  await shot('cr-sheet-filling');
  const filling = await page.evaluate(() => ({ title: document.querySelector('#sheet h2').textContent, sub: document.querySelector('#sheet .sub').textContent }));
  console.log(`${filling.title === 'Star crystal' ? 'PASS' : 'FAIL'} not ready: "${filling.title}" / "${filling.sub}"`);
  await page.evaluate(() => { const S = window.__shard; for (let i = 0; i < 5; i++) S.save.d.stars[S.LEVELS[i].id] = 3; S.save.flush(); S.goHome(); });
  await wait(900);
  await shot('cr-ready');
  await page.click('#btn-crystal', { force: true }); await wait(500);
  await shot('cr-sheet-ready');
  await page.click('#sheet [data-act="smash"]'); await wait(200);
  await shot('cr-smash-mid');
  await wait(1300);
  await shot('cr-smash-done');
  const after = await page.evaluate(() => ({ coins: window.__shard.save.d.coins, n: window.__shard.save.d.crystals, loot: document.getElementById('loot-n').textContent, btn: document.querySelector('#sheet [data-act]').textContent }));
  console.log(`${after.coins === 150 && after.n === 1 && after.loot === '+100' ? 'PASS' : 'FAIL'} shattered: ${JSON.stringify(after)}`);
  // a double tap can't pay twice
  await page.click('#sheet [data-act]'); await wait(400);
  const ready2 = await page.evaluate(() => ({ coins: window.__shard.save.d.coins, ready: document.getElementById('btn-crystal').classList.contains('ready') }));
  console.log(`${ready2.coins === 150 && !ready2.ready ? 'PASS' : 'FAIL'} collected once, next crystal filling: ${JSON.stringify(ready2)}`);
};
