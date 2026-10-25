// Painted art (generated with Higgsfield, see README) and where things sit in it.
// Coordinates are in the image's own pixels.
export const ART = {
  walker: {
    src: 'img/walker.webp', w: 1344, h: 741,
    feetY: 740.5, bucketTopY: 3, bucketHalfW: 49.5, poleY: 285, legSplitY: 323.5,
    cx: 669, poleL: 10, poleR: 1333.5,
    ppm: 368.75,  // pixels per metre
  },
  birdSit: { src: 'img/bird_sit.webp', w: 203, h: 200, footX: 0.45 },
  birdFly: { src: 'img/bird_fly.webp', w: 192, h: 200 },
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

export function preload(srcs) {
  return Promise.all(srcs.map((s) => new Promise((res) => {
    const im = img(s, res);
    if (im) res(im);
    setTimeout(res, 8000);  // never hang the game on one slow file
  })));
}
