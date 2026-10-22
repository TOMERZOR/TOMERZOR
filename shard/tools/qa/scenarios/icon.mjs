export default async ({ page }) => {
  const OUT = '/tmp/claude-0/-home-user-TOMERZOR/6ca015aa-c358-5e4d-be14-3a5969a5568f/scratchpad/qa';
  const variants = (process.env.VARIANTS || 'indigo:coral:7,coral:steel:7,ink:coral:7,indigo:gold:7').split(',');
  for (const v of variants) {
    const [bg, ball, seed] = v.split(':');
    await page.goto(`http://localhost:8080/tools/qa/icon.html?bg=${bg}&ball=${ball}&seed=${seed}`);
    await page.waitForFunction(() => document.title === 'ready');
    await (await page.$('#c')).screenshot({ path: `${OUT}/icon-${bg}-${ball}-${seed}.png` });
  }
  console.log('icons saved');
};
