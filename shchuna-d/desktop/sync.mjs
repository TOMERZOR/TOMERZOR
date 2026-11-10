// Copies the game into desktop/www, the folder the Electron shell serves.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), game = join(here, '..'), www = join(here, 'www');
rmSync(www, { recursive: true, force: true }); mkdirSync(join(www, 'assets'), { recursive: true });
for (const d of ['index.html', 'css', 'js', 'fonts', 'vendor']) cpSync(join(game, d), join(www, d), { recursive: true });
for (const d of ['models', 'anim', 'tex', 'img', 'audio']) cpSync(join(game, 'assets', d), join(www, 'assets', d), { recursive: true });
console.log('synced', www);
