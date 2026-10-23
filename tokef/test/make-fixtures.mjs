// Renders the sample certificate to PDF and PNG: node tokef/test/make-fixtures.mjs
import { launch, ROOT } from './harness.mjs';
import path from 'path';
const b = await launch();
const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
await p.goto('file://' + path.join(ROOT, 'test/fixtures/cert.html'));
await p.pdf({ path: path.join(ROOT, 'test/fixtures/cert.pdf'), format: 'A4', printBackground: true });
await p.screenshot({ path: path.join(ROOT, 'test/fixtures/cert.png'), fullPage: false });
await p.screenshot({ path: path.join(ROOT, 'test/fixtures/cert.jpg'), type: 'jpeg', quality: 82, fullPage: false });
await b.close();
console.log('fixtures written');
