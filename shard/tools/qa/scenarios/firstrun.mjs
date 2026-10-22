// A brand-new player: the very first frames, the first aim, the first shatter, the first win.
export default async ({ page, wait, shot, aimAt }) => {
  await wait(250);
  await shot('fr-01-launch');
  await wait(900);
  await shot('fr-02-settled');
  const p = await aimAt(88.25, 180);
  await wait(250);
  await shot('fr-03-aiming');
  await p.release();
  await wait(700);
  await shot('fr-04-shatter');
  await wait(2600);
  await shot('fr-05-win');
  const st = await page.evaluate(() => ({ mode: window.__shard.mode, title: document.querySelector('#sheet h2')?.textContent }));
  console.log(JSON.stringify(st));
  await page.click('#sheet [data-act="next"]');
  await wait(350);
  await shot('fr-06-level2-intro');
  await wait(1200);
  await shot('fr-07-level2');
};
