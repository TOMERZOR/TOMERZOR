export default async ({ page }) => {
  await page.goto('http://localhost:8080/tools/qa/feature.html');
  await page.waitForFunction(() => document.title === 'ready');
  const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  const { writeFileSync } = await import('node:fs');
  writeFileSync('/home/user/TOMERZOR/game-studio/store/feature-graphic-1024x500.png', Buffer.from(data.split(',')[1], 'base64'));
  console.log('feature graphic saved');
};
