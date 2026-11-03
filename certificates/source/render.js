const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2], scale = +process.argv[3] || 1, pdf = process.argv[4];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: scale });
  await p.goto('file://' + dir + '/cert.html');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const pages = await p.$$('.page');
  for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: `${dir}/out_${i + 1}.png` });
  if (pdf) await p.pdf({ path: pdf, width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
