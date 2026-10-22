export default async ({ page }) => {
  const OUT = '/tmp/claude-0/-home-user-TOMERZOR/6ca015aa-c358-5e4d-be14-3a5969a5568f/scratchpad/qa';
  await page.goto('http://localhost:8080/tools/qa/icon.html?bg=indigo&ball=coral&seed=7');
  await page.waitForFunction(() => document.title === 'ready');
  await (await page.$('#c')).screenshot({ path: `${OUT}/icon-final-1024.png` });
  await page.goto('http://localhost:8080/tools/qa/icon.html?bg=indigo&ball=coral&seed=7&fg=1');
  await page.waitForFunction(() => document.title === 'ready');
  await (await page.$('#c')).screenshot({ path: `${OUT}/icon-final-fg.png`, omitBackground: true });
  console.log('final icons saved');
};
