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
  // background: deep night with soft violet and pink glows
  c.fillStyle = '#100c26';
  if (full) c.fillRect(0, 0, size, size);
  else { c.beginPath(); c.roundRect(0, 0, size, size, 22 * u); c.fill(); }
  c.save();
  if (!full) { c.beginPath(); c.roundRect(0, 0, size, size, 22 * u); c.clip(); }
  for (const [x, y, r, col] of [[20, 15, 70, 'rgba(110,70,255,0.75)'], [95, 90, 65, 'rgba(236,72,153,0.55)'], [90, 10, 40, 'rgba(14,165,233,0.35)']]) {
    const g = c.createRadialGradient(x * u, y * u, 0, x * u, y * u, r * u);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, size, size);
  }
  c.restore();
  const k = full ? 0.8 : 1; // a maskable icon gets cropped to a circle: keep the art in the safe zone
  c.translate(50 * u, 50 * u); c.scale(k, k); c.translate(-50 * u, -50 * u);

  const path = (shape, cx, cy, R) => {
    c.beginPath();
    if (shape === 'square') { const h = R * 0.8; c.roundRect(cx - h, cy - h, h * 2, h * 2, R * 0.38); }
    else if (shape === 'drop') { c.moveTo(cx, cy - R * 0.98); c.bezierCurveTo(cx + R * 0.3, cy - R * 0.55, cx + R * 0.86, cy - R * 0.1, cx + R * 0.86, cy + R * 0.26); c.arc(cx, cy + R * 0.26, R * 0.86, 0, Math.PI); c.bezierCurveTo(cx - R * 0.86, cy - R * 0.1, cx - R * 0.3, cy - R * 0.55, cx, cy - R * 0.98); }
    else if (shape === 'leaf') { c.moveTo(cx - R * 0.86, cy + R * 0.86); c.quadraticCurveTo(cx - R * 0.95, cy - R * 0.95, cx + R * 0.86, cy - R * 0.86); c.quadraticCurveTo(cx + R * 0.95, cy + R * 0.95, cx - R * 0.86, cy + R * 0.86); }
    else c.arc(cx, cy, R * 0.9, 0, TAU);
  };
  const shadeHex = (hex, amt) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } return `rgb(${r | 0},${g | 0},${b | 0})`; };
  const seed = (shape, cx, cy, R, color) => {
    c.save();
    c.shadowColor = 'rgba(8,4,30,0.55)'; c.shadowBlur = 5 * u; c.shadowOffsetY = 2.5 * u;
    path(shape, cx, cy, R);
    const g = c.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.1, cx, cy, R * 1.25);
    g.addColorStop(0, shadeHex(color, 0.35)); g.addColorStop(0.55, color); g.addColorStop(1, shadeHex(color, -0.3));
    c.fillStyle = g; c.fill();
    c.restore();
    c.save(); path(shape, cx, cy, R); c.clip();
    const hl = c.createRadialGradient(cx - R * 0.35, cy - R * 0.5, 0, cx - R * 0.35, cy - R * 0.5, R * 0.95);
    hl.addColorStop(0, 'rgba(255,255,255,0.45)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.fillRect(0, 0, size, size);
    c.restore();
  };
  const R = 15 * u, d = 17 * u, cx = 50 * u, cy = 52 * u;
  seed('circle', cx - d, cy - d, R, '#ff5a6e');
  seed('drop', cx + d, cy - d, R, '#ffd23f');
  seed('leaf', cx - d, cy + d, R, '#3ddc84');
  seed('square', cx + d, cy + d, R, '#4cc9ff');
  // the flower blooming in the middle
  c.save();
  c.shadowColor = 'rgba(236,72,153,0.8)'; c.shadowBlur = 8 * u;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU - Math.PI / 2;
    c.save(); c.translate(cx, cy); c.rotate(a);
    const g = c.createLinearGradient(0, 0, 14 * u, 0);
    g.addColorStop(0, '#ec4899'); g.addColorStop(1, '#fbcfe8');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(7 * u, 0, 7.5 * u, 4.4 * u, 0, 0, TAU); c.fill();
    c.restore();
  }
  c.restore();
  c.fillStyle = '#fde68a';
  c.beginPath(); c.arc(cx, cy, 4 * u, 0, TAU); c.fill();
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
