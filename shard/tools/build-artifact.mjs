// Builds the shareable web page: the game's index.html without the document skeleton
// (the host adds its own), plus the list of supporting files to publish next to it.
// --dev builds the developer page instead: every level and world open (a page's address can't carry ?dev).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const DEV = process.argv.includes('--dev');
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--'));
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const title = DEV ? '<title>SHARD Dev Build</title>' : html.match(/<title>.*?<\/title>/)[0];
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
// the flag is set before the game's module runs (modules wait for the page)
const flag = DEV ? '<script>window.__SHARD_DEV = true;</script>\n' : '';
const page = `${title}\n<link rel="stylesheet" href="css/style.css">\n${flag}${body.trim()}\n`;
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
console.log((DEV ? 'dev page + ' : 'page + ') + Object.keys(files).length + ' files');
