// The map's ball in each special skin (drawn once per skin into a cached image).
export default async ({ page, wait, shot }) => {
  for (const skin of ['prism', 'moon', 'marble', 'aurora', 'gold']) {
    await page.evaluate((skin) => { const L = window.__shard.LEVELS, d = window.__shard.save.d; for (let i = 0; i < 6; i++) d.stars[L[i].id] = 3; d.mapAt = 6; d.skin = skin; window.__shard.save.flush(); window.__shard.goHome(); }, skin);
    await wait(300);
    await page.click('#btn-levels'); await wait(900);
    await shot(`skin-${skin}`);
    await page.click('#levels [data-back]'); await wait(300);
  }
};
