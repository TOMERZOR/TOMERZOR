// Painted art (generated with Higgsfield, see README) and where things sit in it.
// Coordinates are in the image's own pixels.

// Playable characters. Each sprite is seen from behind holding the pole, with
// its container on its head. feetY/poleY/cx/poleR place the body; rimY/rimHalfW
// mark where the liquid pours out. overlay: draw the liquid's surface on top
// (open containers) or not (glass ones that already show it). legs: the sprite
// has trousers, so each leg can lift on its step.
export const CHARACTERS = [
  {
    id: 'walker', liquid: 'water', cost: 0, color: '#3a96d8',
    src: 'img/walker.webp', thumb: 'img/thumb_walker.webp', w: 1344, h: 741,
    feetY: 740.5, poleY: 285, cx: 669, poleR: 1333.5,
    rimY: 3, rimHalfW: 49.5, overlay: true, legs: true, legSplitY: 323.5,
  },
  {
    id: 'waiter', liquid: 'champagne', cost: 150, color: '#f0d27a',
    src: 'img/waiter.webp', thumb: 'img/thumb_waiter.webp', w: 1344, h: 746,
    feetY: 745.5, poleY: 288, cx: 664.5, poleR: 1328.5,
    rimY: 82, rimHalfW: 77, overlay: false, legs: true, legSplitY: 330,
  },
  {
    id: 'grandma', liquid: 'soup', cost: 300, color: '#e9a23b',
    src: 'img/grandma.webp', thumb: 'img/thumb_grandma.webp', w: 1344, h: 749,
    feetY: 748.5, poleY: 293.5, cx: 665, poleR: 1337,
    rimY: 14.5, rimHalfW: 86, overlay: true, legs: false,
  },
  {
    id: 'cat', liquid: 'fishbowl', cost: 500, color: '#7cc4ee',
    src: 'img/cat.webp', thumb: 'img/thumb_cat.webp', w: 1344, h: 745,
    feetY: 745, poleY: 285, cx: 669, poleR: 1336,
    rimY: 14.5, rimHalfW: 58, overlay: false, legs: false,
  },
  {
    id: 'bear', liquid: 'honey', cost: 800, color: '#e89a1c',
    src: 'img/bear.webp', thumb: 'img/thumb_bear.webp', w: 1344, h: 751,
    feetY: 750.5, poleY: 298, cx: 669.75, poleR: 1330,
    rimY: 25, rimHalfW: 50, overlay: false, legs: false,
  },
];
// Pixels per metre: every sprite holds the pole 1.235 m above its feet.
for (const c of CHARACTERS) c.ppm = (c.feetY - c.poleY) / 1.235;

export const ART = {
  birdSit: { src: 'img/bird_sit.webp', w: 203, h: 200, footX: 0.45 },
  birdFly: { src: 'img/bird_fly.webp', w: 192, h: 200 },
  ibex: { src: 'img/ibex.webp', w: 264, h: 360 },
  cloud: { src: 'img/cloud.webp', w: 360, h: 200 },
  coin: { src: 'img/coin.webp', w: 125, h: 128 },
  // ledgeY/postX: where the rope's far anchor meets the cliff (scaled to 1280 wide).
  cliffs: {
    green: { src: 'img/cliff_green.webp', w: 1280, h: 956, ledgeY: 288.8, postX: 640.6 },
    snow: { src: 'img/cliff_snow.webp', w: 1280, h: 956, ledgeY: 258.6, postX: 640.2 },
    canyon: { src: 'img/cliff_canyon.webp', w: 1280, h: 956, ledgeY: 292.6, postX: 618.2 },
  },
};

const cache = new Map();

// Returns the image if it has loaded, otherwise starts loading it and returns null.
export function img(src, onload) {
  let e = cache.get(src);
  if (!e) {
    const im = new Image();
    e = { im, ready: false, waiters: [] };
    cache.set(src, e);
    im.onload = () => {
      e.ready = true;
      for (const f of e.waiters) f(im);
      e.waiters.length = 0;
    };
    im.src = src;
  }
  if (e.ready) return e.im;
  if (onload) e.waiters.push(onload);
  return null;
}
