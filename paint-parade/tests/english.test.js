import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { EN } from '../js/i18n.js';

const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
const shipped = [
  'index.html', 'privacy.html', 'terms.html', 'manifest.webmanifest', 'sw.js', 'landing/index.html',
  ...readdirSync(root + 'js').filter((f) => f.endsWith('.js')).map((f) => 'js/' + f),
  ...readdirSync(root + 'css').map((f) => 'css/' + f),
];

test('the game ships in English only: no Hebrew text anywhere in shipped files', () => {
  for (const p of shipped) {
    const m = read(p).match(/[֐-׿]+/);
    assert.equal(m, null, `${p} contains Hebrew: ${m && m[0]}`);
  }
});

test('no right-to-left layout or language switching is left in the code', () => {
  for (const p of shipped) {
    const s = read(p);
    assert.doesNotMatch(s, /dir\s*=\s*['"]?rtl|\[dir=|direction:\s*rtl/i, `${p} has RTL handling`);
    assert.doesNotMatch(s, /setLang|detectLang|hebrew/i, `${p} still references language switching`);
  }
  assert.ok(!existsSync(root + 'fonts/fredoka-hebrew.woff2'), 'Hebrew font file is gone');
});

test('every UI string the code asks for has English text', () => {
  const keys = new Set();
  for (const p of shipped.filter((f) => f.startsWith('js/'))) {
    for (const m of read(p).matchAll(/\bt\('([A-Za-z0-9_]+)'\)/g)) keys.add(m[1]);
  }
  // keys picked at runtime: tutorial tips (TIP_AT) and shop ribbons (PRODUCTS[].tag)
  for (const m of read('js/main.js').matchAll(/'(tip[A-Z]\w+)'/g)) keys.add(m[1]);
  for (const m of read('js/platform.js').matchAll(/\btag: '(\w+)'/g)) keys.add(m[1]);
  assert.ok(keys.size > 50, 'found the UI strings');
  for (const k of keys) assert.ok(typeof EN[k] === 'string' && EN[k].trim(), `missing English text for "${k}"`);
});

test('every file the stylesheet and offline cache point to exists', () => {
  for (const m of read('css/style.css').matchAll(/url\('\.\.\/([^']+)'\)/g)) assert.ok(existsSync(root + m[1]), 'css → ' + m[1]);
  for (const m of read('sw.js').matchAll(/'\.\/([^']+\.[a-z0-9]+)'/g)) assert.ok(existsSync(root + m[1]), 'sw.js → ' + m[1]);
});
