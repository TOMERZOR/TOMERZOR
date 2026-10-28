// Draws the app icons (jelly blocks around a flower) into icons/.
//   node bloom/test/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const draw = (size, maskable) => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(size / 2, size * 0.3, 0, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, '#5a2bc4'); g.addColorStop(1, '#1d1147');
  c.fillStyle = g;
  if (maskable) c.fillRect(0, 0, size, size);
  else { const r = size * 0.22; c.beginPath(); c.roundRect(0, 0, size, size, r); c.fill(); }
  const k = maskable ? 0.72 : 0.86; // keep inside the maskable safe zone
  c.translate(size / 2, size / 2); c.scale(k, k); c.translate(-size / 2, -size / 2);
  const s = size * 0.25;
  const block = (x, y, col, dark) => {
    c.beginPath(); c.roundRect(x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92, s * 0.2);
    const lg = c.createLinearGradient(0, y, 0, y + s); lg.addColorStop(0, '#fff'); lg.addColorStop(0.08, col); lg.addColorStop(1, dark);
    c.fillStyle = lg; c.fill();
    c.lineWidth = s * 0.05; c.strokeStyle = dark; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(x + s * 0.42, y + s * 0.27, s * 0.26, s * 0.11, -0.25, 0, Math.PI * 2); c.fill();
  };
  const x0 = size * 0.5 - s * 1.5, y0 = size * 0.5 - s * 1.5;
  [[0, 0, '#ff5d73', '#b02840'], [1, 0, '#ffa83a', '#b8650d'], [0, 1, '#ffd93d', '#b8920a'], [0, 2, '#5bd66f', '#22863a'], [1, 2, '#3bc4ff', '#0d76ad'], [2, 2, '#7a6cff', '#3d2fb8'], [2, 0, '#e66bff', '#9a2bb0']]
    .forEach(([cx, cy, col, dark]) => block(x0 + cx * s, y0 + cy * s, col, dark));
  // flower in the middle cell
  const fx = x0 + s * 1.5, fy = y0 + s * 1.5;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    c.fillStyle = i % 2 ? '#ff9ad5' : '#ff5d9e';
    c.beginPath(); c.ellipse(fx + Math.cos(a) * s * 0.3, fy + Math.sin(a) * s * 0.3, s * 0.24, s * 0.15, a, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#ffd23d'; c.beginPath(); c.arc(fx, fy, s * 0.17, 0, Math.PI * 2); c.fill();
  return cv.toDataURL('image/png');
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dir = path.join(__dirname, '..', 'icons');
  for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true], ['favicon-32.png', 32, false]]) {
    const url = await page.evaluate(`(${draw})(${size}, ${mask})`);
    fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
})();
