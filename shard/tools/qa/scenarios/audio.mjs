export default async ({ page, wait, aimAt }) => {
  await wait(500);
  const p = await aimAt(88.25, 200); await wait(80); await p.release();
  await wait(2500);
  const st = await page.evaluate(async () => (await import('/js/audio.js')).audioStatus());
  console.log('audio', JSON.stringify(st));
};
