export default async ({ page, wait, shot, aimAt }) => {
  await wait(600);
  await shot('01-first-level');
  const p = await aimAt(80);
  await wait(300);
  await shot('02-aiming');
  await p.release();
  await wait(250);
  await shot('03-fired');
  await wait(900);
  await shot('04-after');
  await wait(1800);
  await shot('05-result');
};
