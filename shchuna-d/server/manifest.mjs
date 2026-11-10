// Writes public/asset-manifest.json: a short hash of every file of the game as deployed. The
// service worker (sw.js) stores each file under its hash, so players download only what changed.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const files = {}, all = createHash('sha1');
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rel = relative(root, p).split(sep).join('/');
    if (rel === 'asset-manifest.json' || rel === 'sw.js') continue;
    const h = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 16);
    files[rel] = h; all.update(rel + h);
  }
};
walk(root);
const m = { build: all.digest('hex').slice(0, 12), at: new Date().toISOString(), files };
writeFileSync(join(root, 'asset-manifest.json'), JSON.stringify(m));
console.log(`asset-manifest.json: ${Object.keys(files).length} files, build ${m.build}`);
