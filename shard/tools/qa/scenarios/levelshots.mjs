// Screenshots of campaign levels by index, after the pop-in, as a new player sees them (coach lines included).
// usage: IDX=14,55 node qa/shot.mjs levelshots
export default async ({ page, wait, shot }) => {
  for (const k of (process.env.IDX || '0').split(',').map(Number)) {
    await page.evaluate((k) => window.__shard.startLevel(k), k);
    await wait(1700);
    await shot('level-' + (k + 1));
  }
};
