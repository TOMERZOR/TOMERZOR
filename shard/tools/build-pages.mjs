// Builds the game for a static host (GitHub Pages): every file but the dev tools, plus a link preview
// (Open Graph tags need an absolute image URL, so the page's public address comes in as an argument).
//   node build-pages.mjs <out folder> <public URL, e.g. https://tomerzor.github.io/TOMERZOR/shard/>
import { cpSync, copyFileSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const [OUT, URL_] = process.argv.slice(2);
if (!OUT || !URL_) { console.error('usage: node build-pages.mjs <out> <public url>'); process.exit(1); }
const base = URL_.endsWith('/') ? URL_ : URL_ + '/';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(ROOT, OUT, { recursive: true, filter: (p) => !/\/(tools|node_modules)(\/|$)/.test(p.slice(ROOT.length - 1)) && !p.endsWith('.map') });
copyFileSync(join(ROOT, '../shard-site/assets/og.png'), join(OUT, 'assets/og.png'));
const title = 'SHARD: Satisfying Glass Smash';
const desc = 'Aim, fire, and watch glass explode. 120 levels and a new puzzle every day. Free, in your browser.';
const tags = [
  ['og:type', 'website'], ['og:title', title], ['og:description', desc], ['og:url', base],
  ['og:image', base + 'assets/og.png'], ['og:image:width', '1200'], ['og:image:height', '630'],
].map(([k, v]) => `  <meta property="${k}" content="${v}">`).join('\n')
  + `\n  <meta name="twitter:card" content="summary_large_image">\n  <meta name="twitter:image" content="${base}assets/og.png">`;
const page = join(OUT, 'index.html');
writeFileSync(page, readFileSync(page, 'utf8').replace('  <title>', tags + '\n  <title>'));
console.log('built', OUT, 'for', base);
