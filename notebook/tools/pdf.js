// usage: node pdf.js <dir>  -> renders print.html / test.html to PDF at exact A4 size
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const dir = path.resolve(process.argv[2]);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [src, dst] of [['print.html', 'notebook-print.pdf'], ['test.html', 'alignment-test.pdf']]) {
    await page.goto('file://' + path.join(dir, src));
    await page.waitForSelector('body[data-ready="1"]');
    await page.pdf({ path: path.join(dir, dst), width: '210mm', height: '297mm', printBackground: true,
                     margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  }
  await browser.close();
})();
