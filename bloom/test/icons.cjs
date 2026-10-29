// Draws the app icons into icons/: four big jelly blocks with a flower bursting out of the middle.
//   node bloom/test/icons.cjs [previewDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const draw = (size, full) => {
  const TAU = Math.PI * 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const u = size / 100;
  // background: deep purple with a soft glow and light rays behind the flower
  const bg = c.createRadialGradient(50 * u, 45 * u, 0, 50 * u, 50 * u, 75 * u);
  bg.addColorStop(0, '#7b3cf0'); bg.addColorStop(0.55, '#3a1a96'); bg.addColorStop(1, '#170b42');
  c.fillStyle = bg;
  if (full) c.fillRect(0, 0, size, size);
  else { c.beginPath(); c.roundRect(0, 0, size, size, 22 * u); c.fill(); c.save(); c.clip(); }
  c.save();
  c.translate(50 * u, 50 * u);
  c.globalAlpha = 0.12;
  c.fillStyle = '#fff';
  for (let i = 0; i < 12; i++) {
    c.rotate(TAU / 12);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-5 * u, -80 * u); c.lineTo(5 * u, -80 * u); c.fill();
  }
  c.restore();
  // a maskable icon gets cropped to a circle: keep the artwork inside the safe zone
  const k = full ? 0.8 : 1;
  c.translate(50 * u, 50 * u); c.scale(k, k); c.translate(-50 * u, -50 * u);

  const block = (x, y, s, col, light, dark, tilt) => {
    c.save();
    c.translate(x + s / 2, y + s / 2); c.rotate(tilt); c.translate(-s / 2, -s / 2);
    c.shadowColor = 'rgba(10,0,40,0.45)'; c.shadowBlur = 3 * u; c.shadowOffsetY = 2 * u;
    c.beginPath(); c.roundRect(0, 0, s, s, s * 0.24);
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, light); g.addColorStop(0.55, col); g.addColorStop(1, dark);
    c.fillStyle = g; c.fill();
    c.shadowColor = 'transparent';
    c.lineWidth = s * 0.045; c.strokeStyle = dark; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.beginPath(); c.ellipse(s * 0.4, s * 0.25, s * 0.25, s * 0.1, -0.25, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.arc(s * 0.74, s * 0.22, s * 0.05, 0, TAU); c.fill();
    c.restore();
  };
  const s = 31 * u, gap = 3 * u, x0 = 50 * u - s - gap / 2, y0 = 52 * u - s - gap / 2;
  block(x0, y0, s, '#ff5d73', '#ff9aa8', '#c22c45', -0.05);
  block(x0 + s + gap, y0, s, '#ffb02e', '#ffd27a', '#c97a00', 0.04);
  block(x0, y0 + s + gap, s, '#3bc4ff', '#8fdfff', '#0d7fbd', 0.05);
  block(x0 + s + gap, y0 + s + gap, s, '#58d66b', '#9cf0a6', '#22903a', -0.04);

  // the flower bursting from the middle
  const fx = 50 * u, fy = 52 * u, pr = 15 * u;
  c.shadowColor = 'rgba(60,0,60,0.5)'; c.shadowBlur = 4 * u; c.shadowOffsetY = 2 * u;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU - Math.PI / 2;
    c.save(); c.translate(fx, fy); c.rotate(a);
    const g = c.createLinearGradient(0, 0, pr * 1.3, 0);
    g.addColorStop(0, '#ff3d8b'); g.addColorStop(1, '#ffb3dc');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(pr * 0.62, 0, pr * 0.62, pr * 0.42, 0, 0, TAU); c.fill();
    c.restore();
  }
  c.shadowColor = 'transparent';
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU - Math.PI / 2;
    c.save(); c.translate(fx, fy); c.rotate(a);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath(); c.ellipse(pr * 0.75, -pr * 0.12, pr * 0.28, pr * 0.1, 0, 0, TAU); c.fill();
    c.restore();
  }
  const cg = c.createRadialGradient(fx - 2 * u, fy - 2 * u, 0, fx, fy, 6.5 * u);
  cg.addColorStop(0, '#fff3a0'); cg.addColorStop(0.6, '#ffd23d'); cg.addColorStop(1, '#f08c00');
  c.fillStyle = cg;
  c.beginPath(); c.arc(fx, fy, 6.5 * u, 0, TAU); c.fill();

  // sparkles
  const star = (x, y, r) => {
    c.fillStyle = '#fff';
    c.beginPath();
    for (let j = 0; j < 4; j++) {
      const an = j * Math.PI / 2;
      c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
      c.lineTo(x + Math.cos(an + Math.PI / 4) * r * 0.28, y + Math.sin(an + Math.PI / 4) * r * 0.28);
    }
    c.fill();
  };
  if (size >= 64) { star(83 * u, 17 * u, 6 * u); star(16 * u, 84 * u, 4.5 * u); star(88 * u, 80 * u, 3 * u); }
  return cv.toDataURL('image/png');
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dir = path.join(__dirname, '..', 'icons');
  for (const [name, size, full] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true], ['favicon-32.png', 32, false]]) {
    const url = await page.evaluate(`(${draw})(${size}, ${full})`);
    fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  // preview: the icons at home-screen sizes on a phone-like wallpaper
  const preview = process.argv[2];
  if (preview) {
    const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
    await page.setViewportSize({ width: 460, height: 300 });
    await page.setContent(`<body style="margin:0;background:linear-gradient(135deg,#2b5876,#4e4376);display:flex;gap:28px;align-items:center;justify-content:center;height:300px;font:600 13px system-ui;color:#fff">
      <div style="text-align:center"><img src="${b64('apple-touch-icon.png')}" style="width:120px;border-radius:27px"><div>iPhone</div></div>
      <div style="text-align:center"><img src="${b64('icon-maskable-512.png')}" style="width:120px;border-radius:50%"><div>Android</div></div>
      <div style="text-align:center"><img src="${b64('icon-192.png')}" style="width:60px"><div>small</div><img src="${b64('favicon-32.png')}" style="width:32px;margin-top:12px"></div></body>`);
    await page.screenshot({ path: path.join(preview, 'icons-preview.png') });
  }
  await browser.close();
})();
