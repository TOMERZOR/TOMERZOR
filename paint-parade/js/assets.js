// Image assets: loading, and per-color tinting of the white bucket sprite.
const NAMES = ['bucket', 'rainbow', 'logo', 'coin', 'heart', 'star', 'gift', 'chest', 'grab', 'slot', 'hand', 'lock', 'calendar', 'tv', 'shop', 'gallery', 'home', 'gear', 'bg_play', 'bg_home'];

export const IMG = {};
let ready = false;

export function loadAssets(base = 'img/') {
  return Promise.all(NAMES.map((n) => new Promise((resolve) => {
    const im = new Image();
    im.onload = () => { IMG[n] = im; resolve(); };
    im.onerror = () => resolve(); // the game falls back to vector drawing
    im.src = base + n + '.webp';
  }))).then(() => { ready = !!IMG.bucket; return IMG; });
}

export function assetsReady() { return ready; }
export function src(name) { return 'img/' + name + '.webp'; }

// The bucket sprite is white plastic: multiply it with the paint color, then put
// the silver handle back on top untinted.
const tintCache = new Map();
export function tintedBucket(hex) {
  if (tintCache.has(hex)) return tintCache.get(hex);
  const im = IMG.bucket;
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(im, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, w, h);
  // a touch of the original light keeps dark paints glossy
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.12;
  ctx.drawImage(im, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(im, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h * 0.185);
  ctx.rect(0, h * 0.185, w * 0.075, h * 0.26);
  ctx.rect(w * 0.925, h * 0.185, w * 0.075, h * 0.26);
  ctx.clip();
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(im, 0, 0);
  ctx.restore();
  tintCache.set(hex, c);
  return c;
}
