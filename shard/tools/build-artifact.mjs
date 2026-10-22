// Builds the shareable web page: the game's index.html without the document skeleton
// (the host adds its own), plus the list of supporting files to publish next to it.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = process.argv[2];
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const title = html.match(/<title>.*?<\/title>/)[0];
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const page = `${title}\n<link rel="stylesheet" href="css/style.css">\n${body.trim()}\n`;
writeFileSync(join(OUT, 'index.html'), page);
const files = {};
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    const rel = relative(ROOT, p);
    if (statSync(p).isDirectory()) { if (!['tools', 'node_modules'].includes(f)) walk(p); continue; }
    if (rel === 'index.html' || rel.endsWith('.map') || rel.endsWith('meta.json')) continue;
    files[rel] = rel.endsWith('.mjs') ? { from: p, contentType: 'text/javascript' } : p;
  }
};
walk(ROOT);
writeFileSync(join(OUT, 'files.json'), JSON.stringify(files, null, 1));
console.log('page + ' + Object.keys(files).length + ' files');
