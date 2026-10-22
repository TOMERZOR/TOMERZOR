export default async ({ page }) => {
  await page.goto('http://localhost:8081/shard-site/index.html');
  await page.waitForTimeout(800);
  await page.screenshot({ path: (process.env.OUT || '/tmp/claude-0/-home-user-TOMERZOR/6ca015aa-c358-5e4d-be14-3a5969a5568f/scratchpad/qa') + '/site-' + (process.env.TAG || 'x') + '.png', fullPage: true });
  console.log('site shot');
};
