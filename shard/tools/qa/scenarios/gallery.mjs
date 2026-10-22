export default async ({ page, wait }) => {
  const q = process.env.Q || '';
  await page.goto('http://localhost:8080/tools/qa/gallery.html' + q);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 });
  await wait(300);
  await page.screenshot({ path: (process.env.OUT || '/tmp/claude-0/-home-user-TOMERZOR/6ca015aa-c358-5e4d-be14-3a5969a5568f/scratchpad/qa') + '/gallery' + (process.env.TAG || '') + '.png', fullPage: true });
  console.log('gallery saved');
};
