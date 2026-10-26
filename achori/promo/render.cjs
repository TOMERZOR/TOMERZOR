// Renders the promo: every frame of compose.html is screenshotted at 1080x1920, the
// soundtrack is rendered offline in the same browser, and ffmpeg muxes them.
//   node achori/promo/render.cjs <workDir> <out.mp4> [from=0] [to=30]
// <workDir> holds clips/<A..E>/NNNN.jpg and game/<shot>/NNNN.jpg (see capture.cjs).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const work = path.resolve(process.argv[2]);
const outFile = path.resolve(process.argv[3]);
const from = Number(process.argv[4] || 0), to = Number(process.argv[5] || 30);
const SRC = __dirname, GAME = path.join(__dirname, '..');
const FPS = 30;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  const manifest = {};
  for (const group of ['clips', 'game']) for (const d of fs.readdirSync(path.join(work, group))) {
    const p = path.join(work, group, d);
    if (fs.statSync(p).isDirectory()) manifest[`${group}/${d}`] = fs.readdirSync(p).filter((f) => f.endsWith('.jpg')).length;
  }
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.route('http://promo.local/**', (route) => {
    const u = new URL(route.request().url());
    let file = null;
    if (u.pathname.startsWith('/src/')) file = path.join(SRC, u.pathname.slice(5));
    else if (u.pathname.startsWith('/game/')) file = path.join(GAME, u.pathname.slice(6));
    else if (u.pathname.startsWith('/frames/')) file = path.join(work, u.pathname.slice(8));
    if (!file || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' } });
  });
  await page.goto('http://promo.local/src/compose.html');
  await page.evaluate((m) => { window.__manifest = m; }, manifest);
  await page.waitForFunction(() => window.render && window.ready);
  await page.evaluate(() => window.ready);

  // ---- soundtrack ----
  const wavB64 = await page.evaluate(async () => {
    const { T, sfxCues } = await import('/src/timeline.js');
    const { renderSoundtrack, wav } = await import('/src/soundtrack.js');
    const buf = await renderSoundtrack(T, sfxCues());
    const bytes = wav(buf);
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const framesDir = path.join(work, 'out');
  const audioOnly = process.env.AUDIO_ONLY === '1'; // remix the sound over frames already rendered
  if (!audioOnly) {
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
  }
  const wavPath = path.join(work, 'soundtrack.wav');
  fs.writeFileSync(wavPath, Buffer.from(wavB64, 'base64'));
  console.log('soundtrack', (fs.statSync(wavPath).size / 1e6).toFixed(1), 'MB');

  // ---- picture ----
  const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
  const t0 = Date.now();
  for (let n = n0; n < n1 && !audioOnly; n++) {
    await page.evaluate((t) => window.render(t), n / FPS);
    await page.screenshot({ path: path.join(framesDir, String(n - n0 + 1).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
    if (n % 60 === 0) console.log('frame', n, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await b.close();

  // ---- master the sound: two-pass EBU R128 to -14 LUFS (what Reels/TikTok play at), true peak under -1.5 dB ----
  const cut = ['-ss', String(from), '-t', String(to - from)];
  const m = JSON.parse(String(execFileSync('sh', ['-c', `ffmpeg -hide_banner -ss ${from} -t ${to - from} -i "${wavPath}" -af loudnorm=I=-14:TP=-3.2:LRA=20:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p'`])));
  const master = path.join(work, 'master.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...cut, '-i', wavPath, '-af',
    `loudnorm=I=-14:TP=-3.2:LRA=20:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,afade=t=out:st=${to - from - 0.4}:d=0.4`,
    '-ar', '48000', master], { stdio: 'inherit' });
  // ---- mux ----
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(framesDir, '%04d.jpg'), '-i', master,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', outFile], { stdio: 'inherit' });
  console.log('wrote', outFile);
})();
