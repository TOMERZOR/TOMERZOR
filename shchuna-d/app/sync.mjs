// Copies the game (../) into www/ for Capacitor. The whole game ships inside the app: no network
// is needed for story mode; online connects to the room server.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), game = join(here, '..'), www = join(here, 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, 'assets'), { recursive: true });
for (const d of ['index.html', 'css', 'js', 'fonts', 'vendor']) cpSync(join(game, d), join(www, d), { recursive: true });
for (const d of ['models', 'anim', 'tex', 'img', 'audio']) { try { cpSync(join(game, 'assets', d), join(www, 'assets', d), { recursive: true }); } catch (e) { /* optional */ } }
console.log('www ready');
