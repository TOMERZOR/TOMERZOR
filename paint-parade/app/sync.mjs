// Copies the web game (the parent folder) into www/ for Capacitor.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const src = new URL('../', import.meta.url).pathname;
const out = new URL('./www/', import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const p of ['index.html', 'privacy.html', 'terms.html', 'manifest.webmanifest', 'css', 'js', 'fonts', 'icons', 'img']) {
  try { cpSync(src + p, out + p, { recursive: true }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
console.log('web game copied to www/');
