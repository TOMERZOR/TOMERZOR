export default async ({ page, wait, shot, aimAt }) => {
  await wait(500);
  const p = await aimAt(88.25, 200);
  await wait(200);
  await shot('l1-aim');
  await p.release();
  for (let i = 0; i < 6; i++) { await wait(i < 3 ? 90 : 350); await shot('l1-f' + i); }
  await wait(1500);
  await shot('l1-win');
};
