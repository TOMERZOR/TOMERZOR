// the Google Play feature graphic and the landing page's share image
export default async ({ page }) => {
  const { writeFileSync } = await import('node:fs');
  for (const [q, out] of [['', '/home/user/TOMERZOR/game-studio/store/feature-graphic-1024x500.png'], ['?w=1200&h=630', '/home/user/TOMERZOR/shard-site/assets/og.png']]) {
    await page.goto('http://localhost:8080/tools/qa/feature.html' + q);
    await page.waitForFunction(() => document.title === 'ready');
    const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    console.log('saved', out);
  }
};
