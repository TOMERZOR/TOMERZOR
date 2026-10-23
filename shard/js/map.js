// The level map: each world is a place, and its 24 levels are glass gems on a trail that climbs it.
// SVG draws the scenery and the trail; HTML buttons are the levels (crisp text, real tap targets).
const STEP = 94;      // climb between two levels (CSS px)
const TOP = 300;      // room above the last level for the gate to the next world
const BOTTOM = 250;   // room below the first level for the world's sign
const REST = 51;      // the ball rests this far above the current level's centre, on top of its gem
const HOP = 40;       // and arcs this much higher hopping from gem to gem
const VIEW = 0.6;     // the current level sits this far down the view

const LIGHT = 225 * Math.PI / 180; // light from the top left, as in the game (SVG angles, y down)
const f1 = (v) => Math.round(v * 10) / 10;
const f2 = (v) => Math.round(v * 100) / 100;
const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);

// a gem, faceted the way the game's glass is lit; rgb is the glass tint
export function gemSVG(rgb, { locked = false } = {}) {
  const [r, g, b] = rgb;
  const mix = (k) => `rgb(${Math.round(r + (255 - r) * k)},${Math.round(g + (255 - g) * k)},${Math.round(b + (255 - b) * k)})`;
  const shade = (k) => `rgb(${Math.round(r * (1 - k))},${Math.round(g * (1 - k))},${Math.round(b * (1 - k))})`;
  const V = [], T = [];
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * Math.PI / 4;
    V.push([32 + 29 * Math.cos(a), 32 + 29 * Math.sin(a)]);
    T.push([32 + 15.5 * Math.cos(a), 32 + 15.5 * Math.sin(a)]);
  }
  let facets = '';
  for (let k = 0; k < 8; k++) {
    const n = (k + 1) * Math.PI / 4; // facet faces this way
    const lit = 0.5 + 0.5 * Math.cos(n - LIGHT);
    const fill = lit > 0.45 ? mix(0.12 + 0.62 * lit) : shade(0.16 * (1 - lit));
    const q = [V[k], V[(k + 1) % 8], T[(k + 1) % 8], T[k]].map((p) => p.map(f1).join(',')).join(' ');
    facets += `<polygon points="${q}" fill="${fill}"/>`;
  }
  const outline = V.map((p) => p.map(f1).join(',')).join(' ');
  const table = T.map((p) => p.map(f1).join(',')).join(' ');
  return `<svg class="gem" viewBox="0 0 64 64" aria-hidden="true">
    <polygon points="${outline}" fill="${shade(0.08)}"/>${facets}
    <polygon points="${table}" fill="${mix(0.5)}"/>
    <polygon points="21,24 29,18 32,20 24,27" fill="#fff" opacity=".8"/>
    <polygon points="${outline}" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="1.6" stroke-linejoin="round"/>
    ${locked ? `<polygon points="${outline}" fill="#fff" opacity=".22"/>` : ''}
  </svg>`;
}

// the trail's wander (two waves), different in every world: x at a (fractional) level k
function wander(world, W) {
  const A = Math.min(W * 0.27, 112), B = Math.min(W * 0.07, 30);
  const ph = world * 1.9 + 0.4, ph2 = world * 0.7 + 1.3;
  return (k) => Math.max(56, Math.min(W - 56, W / 2 + A * Math.sin(k * 0.74 + ph) + B * Math.sin(k * 1.83 + ph2)));
}
function layout(world, n, W) {
  const H = TOP + BOTTOM + (n - 1) * STEP, xAt = wander(world, W);
  const pts = [];
  for (let k = 0; k < n; k++) pts.push([xAt(k), H - BOTTOM - k * STEP]);
  return { H, pts, xAt };
}

// Catmull-Rom through the points, as one cubic Bézier segment per gap
function segments(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    out.push(`C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`);
  }
  return out;
}
const pathOf = (pts, segs, from, to) => `M${f1(pts[from][0])},${f1(pts[from][1])} ${segs.slice(from, to).join(' ')}`;

// ---------- scenery, one set per world (low contrast: the trail and the gems lead) ----------
const rnd = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mixRGB = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
// glass things, drawn the way the game draws glass: tinted body, white rim, a streak of light on the lit side
const vessel = (x, y, c, h, kind) => {
  const bw = h * (kind === 'jar' ? 0.7 : 0.44), nw = h * 0.17, L = x - bw / 2, R = x + bw / 2;
  const d = kind === 'bottle'
    ? `M${f1(L)},${f1(y - 4)} V${f1(y - h * 0.52)} Q${f1(L)},${f1(y - h * 0.74)} ${f1(x - nw / 2)},${f1(y - h * 0.78)} V${f1(y - h)} H${f1(x + nw / 2)} V${f1(y - h * 0.78)} Q${f1(R)},${f1(y - h * 0.74)} ${f1(R)},${f1(y - h * 0.52)} V${f1(y - 4)} Q${f1(R)},${f1(y)} ${f1(R - 4)},${f1(y)} H${f1(L + 4)} Q${f1(L)},${f1(y)} ${f1(L)},${f1(y - 4)}z`
    : kind === 'vase'
      ? `M${f1(x - bw * 0.3)},${f1(y)} C${f1(x - bw * 0.75)},${f1(y - h * 0.3)} ${f1(x - bw * 0.7)},${f1(y - h * 0.62)} ${f1(x - bw * 0.22)},${f1(y - h * 0.82)} L${f1(x - bw * 0.32)},${f1(y - h)} H${f1(x + bw * 0.32)} L${f1(x + bw * 0.22)},${f1(y - h * 0.82)} C${f1(x + bw * 0.7)},${f1(y - h * 0.62)} ${f1(x + bw * 0.75)},${f1(y - h * 0.3)} ${f1(x + bw * 0.3)},${f1(y)}z`
      : `M${f1(L)},${f1(y - 5)} V${f1(y - h + 6)} Q${f1(L)},${f1(y - h)} ${f1(L + 6)},${f1(y - h)} H${f1(R - 6)} Q${f1(R)},${f1(y - h)} ${f1(R)},${f1(y - h + 6)} V${f1(y - 5)} Q${f1(R)},${f1(y)} ${f1(R - 5)},${f1(y)} H${f1(L + 5)} Q${f1(L)},${f1(y)} ${f1(L)},${f1(y - 5)}z`;
  const sx = kind === 'vase' ? x - bw * 0.42 : L + 3.5;
  return `<ellipse cx="${f1(x + 3)}" cy="${f1(y + 1)}" rx="${f1(bw * 0.62)}" ry="3.5" fill="#000" opacity=".08"/><path d="${d}" fill="${c}" opacity=".62"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.4" stroke-linejoin="round"/><rect x="${f1(sx)}" y="${f1(y - h * 0.62)}" width="2.6" height="${f1(h * 0.42)}" rx="1.3" fill="#fff" opacity=".8"/>`;
};
const orb = (x, y, R, c) => `<g transform="translate(${f1(x)},${f1(y)})"><circle r="${f1(R)}" fill="${c}" opacity=".5" stroke="#fff" stroke-opacity=".85" stroke-width="1.3"/><circle cx="${f1(-R * 0.36)}" cy="${f1(-R * 0.4)}" r="${f1(Math.max(1.6, R * 0.2))}" fill="#fff" opacity=".9"/></g>`;
const cloud = (x, y, s, o) => `<path transform="translate(${f1(x)},${f1(y)}) scale(${f2(s)})" d="M-48,0 a18,18 0 0 1 12,-24 a26,26 0 0 1 44,-8 a18,18 0 0 1 26,14 a14,14 0 0 1 14,18z" fill="#fff" opacity="${o}"/>`;

function scenery(world, W, H, pts, xAt, w) {
  const far = [], near = [];
  const r = rnd(1000 + world * 77);
  const glass = w.glass.map((c) => `rgb(${c.join(',')})`);
  const trailX = (y) => xAt((H - BOTTOM - y) / STEP);
  // terraces: soft hills the trail climbs over, each crest catching the light
  const spots = [];
  for (let n = 0, y = H - 230 - r() * 20; y > 420; n++, y -= 310 + r() * 80) {
    // a lighter ridge behind each terrace, then the terrace, its crest catching the light
    for (const back of [true, false]) {
      const P = [];
      for (let i = 0; i <= 4; i++) P.push([-30 + (W + 60) * i / 4 + (back ? 36 : 0), y - (back ? 26 : 0) + (r() - 0.5) * (i % 4 ? 56 : 30)]);
      const crest = pathOf(P, segments(P), 0, 4);
      near.push(`<path d="${crest} L${W + 70},${f1(y + 240)} L-30,${f1(y + 240)}z" fill="url(#hill)" opacity="${back ? 0.5 : n % 2 ? 0.8 : 1}"/><path d="${crest}" fill="none" stroke="#fff" stroke-opacity="${w.dark ? 0.14 : back ? 0.35 : 0.6}" stroke-width="${back ? 1.5 : 2}"/>`);
      if (back) continue;
      // something stands on the crest, on the side away from the trail
      for (const i of [1, 3]) {
        const [x, cy] = P[i];
        if (Math.abs(x - trailX(cy)) > 96) spots.push({ x: x + (i === 1 ? -14 : 14), y: cy + 3, side: i === 1 ? -1 : 1 });
      }
    }
  }
  // a few arrangements per world, so no two stops along the trail look alike
  const kit = (p, list) => list.map(([k, dx, h, c]) => vessel(p.x - dx * p.side, p.y, glass[c % 3], h, k)).join('');
  const leaf = (p, s = 1.3) => `<g transform="translate(${f1(p.x)},${f1(p.y)}) scale(${f2(p.side < 0 ? s : -s)},${f2(s)})"><path d="M0,0 C8,-22 26,-30 34,-26 C30,-12 16,-2 0,0z" fill="${w.accent}" opacity=".34"/><path d="M0,0 C-4,-20 2,-38 10,-44 C16,-30 10,-10 0,0z" fill="${w.accent}" opacity=".5"/><path d="M0,0 C-10,-12 -26,-14 -32,-10 C-24,-2 -10,2 0,0z" fill="${w.accent}" opacity=".28"/></g>`;
  const stone = (x, y, s = 1) => `<g transform="translate(${f1(x)},${f1(y)}) scale(${f2(s)})"><path d="M-18,0 C-18,-12 -8,-17 2,-16 C12,-15 19,-9 18,0z" fill="#8E8A98" opacity=".55"/><path d="M-10,-9 C-6,-13 0,-14 4,-13" stroke="#fff" stroke-opacity=".5" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
  const bomb = (x, y, s = 1) => `<g transform="translate(${f1(x)},${f1(y - 13 * s)}) scale(${f2(s)})"><circle r="13" fill="#3A2C34" opacity=".72"/><circle r="5" fill="${w.accent}" opacity=".9"/><path d="M0,-12 q2,-9 10,-10" stroke="#5A4652" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="10" cy="-22" r="3.4" fill="#FFD27A"/></g>`;
  const lamp = (x, y, c, tall = 50) => `<g transform="translate(${f1(x)},${f1(y)})"><circle cy="${-tall - 12}" r="40" fill="url(#halo)"/><path d="M0,0 V${-tall}" stroke="#8E98C2" stroke-opacity=".5" stroke-width="2"/><path d="M-5,0 H5" stroke="#8E98C2" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/><g transform="translate(0,${-tall + 50})"><path d="M-7,-52 H7 L5,-72 H-5z" fill="${c}" opacity=".85" stroke="#fff" stroke-opacity=".85" stroke-width="1.2" stroke-linejoin="round"/><path d="M-8,-73 H8 L4,-78 H-4z" fill="#8E98C2" opacity=".8"/><rect x="-3.6" y="-69" width="2" height="12" rx="1" fill="#fff" opacity=".85"/></g></g>`;
  const props = {
    0: [ // Dawn: glassware set out to catch the morning
      (p, i) => kit(p, [['bottle', -22, 44, i], ['vase', 0, 36, i + 1], ['jar', 22, 24, i + 2]]),
      (p, i) => kit(p, [['vase', -12, 40, i], ['vase', 12, 28, i + 2]]),
      (p, i) => kit(p, [['jar', -26, 22, i + 1], ['bottle', -4, 50, i], ['bottle', 16, 38, i + 2], ['jar', 34, 18, i]]),
      (p, i) => kit(p, [['bottle', 0, 54, i + 1]]),
    ],
    1: [ // Mint: the greenhouse floor, leaves, stone and timber
      (p, i) => leaf(p) + kit(p, [['jar', 26, 30, i]]),
      (p) => leaf(p, 1.6),
      (p, i) => stone(p.x - 10 * p.side, p.y, 1.2) + leaf({ ...p, x: p.x + 18 * p.side }, 0.9),
      (p, i) => kit(p, [['vase', -10, 34, i + 1]]) + stone(p.x + 18 * p.side, p.y, 0.8),
    ],
    2: [ // Lilac: soft glass bubbles come to rest
      (p, i) => [[0, 15], [-21, 9], [16, 7]].map(([dx, R], j) => orb(p.x + dx * p.side, p.y - R, R, glass[(i + j) % 3])).join(''),
      (p, i) => orb(p.x, p.y - 20, 20, glass[i % 3]) + kit(p, [['vase', 34, 34, i + 1]]),
      (p, i) => [[-14, 11], [8, 13], [28, 6]].map(([dx, R], j) => orb(p.x + dx * p.side, p.y - R, R, glass[(i + j + 1) % 3])).join(''),
    ],
    3: [ // Ember: bombs and glass, side by side
      (p) => bomb(p.x, p.y),
      (p, i) => bomb(p.x + 12 * p.side, p.y) + kit(p, [['bottle', 18, 40, i]]),
      (p, i) => bomb(p.x - 14 * p.side, p.y, 0.8) + bomb(p.x + 12 * p.side, p.y, 1.1),
      (p, i) => kit(p, [['jar', -8, 26, i], ['vase', 16, 36, i + 1]]),
    ],
    4: [ // Night: lanterns along the way
      (p, i) => lamp(p.x, p.y, glass[i % 3]),
      (p, i) => lamp(p.x - 10 * p.side, p.y, glass[i % 3], 64) + kit(p, [['jar', -22, 20, i + 1]]),
      (p, i) => lamp(p.x, p.y, glass[(i + 1) % 3], 40),
    ],
  }[world];
  spots.forEach((p, i) => near.push(props[(i + world) % props.length](p, i)));
  switch (world) {
    case 0: // Dawn: the sun rising where the trail begins, cloud drifting across it
      far.push(`<circle cx="${f1(W * 0.74)}" cy="${f1(H - 170)}" r="${f1(Math.min(W * 0.45, 200))}" fill="url(#sun)"/>`);
      break;
    case 1: // Mint: a greenhouse, its glass ribs arching overhead
      for (let i = 0; i < 6; i++) {
        const y = (H * (0.1 + i * 0.16)), rx = W * 0.66;
        far.push(`<path d="M${f1(W / 2 - rx)},${f1(y + 170)} Q${f1(W / 2)},${f1(y - 150)} ${f1(W / 2 + rx)},${f1(y + 170)}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>`);
      }
      break;
    case 2: // Lilac: big glass bubbles drifting up through the haze
      for (let i = 0; i < 9; i++) {
        const R = 10 + r() * 22, x = r() < 0.5 ? r() * W * 0.22 : W - r() * W * 0.22, y = f1(H * (0.06 + i * 0.105));
        far.push(`<g transform="translate(${f1(x)},${y})"><circle r="${f1(R)}" fill="${glass[i % 3]}" opacity=".32" stroke="#fff" stroke-opacity=".7" stroke-width="1.3"/><circle cx="${f1(-R * 0.35)}" cy="${f1(-R * 0.4)}" r="${f1(R * 0.18)}" fill="#fff" opacity=".8"/></g>`);
      }
      break;
    case 3: // Ember: a furnace sunset low behind the start, sparks drifting up
      far.push(`<circle cx="${f1(W * 0.3)}" cy="${f1(H - 190)}" r="${f1(Math.min(W * 0.42, 190))}" fill="url(#sun)"/>`);
      for (let i = 0; i < 26; i++) far.push(`<circle cx="${f1(r() * W)}" cy="${f1(r() * H)}" r="${f1(1 + r() * 1.6)}" fill="#FFB35C" opacity="${f2(0.25 + r() * 0.45)}"/>`);
      break;
    case 4: // Night: a moon and a sky full of stars
      far.push(`<mask id="moon"><circle r="38" fill="#fff"/><circle cx="15" cy="-9" r="33" fill="#000"/></mask><g transform="translate(${f1(W * 0.76)},${f1(H * 0.2)})"><circle r="70" fill="url(#halo2)"/><circle r="38" fill="#F3F1E6" opacity=".92" mask="url(#moon)"/></g>`);
      for (let i = 0; i < 80; i++) far.push(`<circle cx="${f1(r() * W)}" cy="${f1(r() * H)}" r="${f1(0.6 + r() * 1.3)}" fill="#E6EEFF" opacity="${f2(0.25 + r() * 0.6)}"/>`);
      break;
  }
  if (!w.dark) for (let i = 0; i < 7; i++) far.push(cloud(r() < 0.5 ? r() * W * 0.3 : W * 0.7 + r() * W * 0.3, (H * (0.07 + i * 0.135)), 0.7 + r() * 0.6, f2(0.5 + r() * 0.25)));
  return { far: far.join(''), near: near.join('') };
}

/**
 * Builds a world's map into `scroller`.
 * opts: { world, worlds, levels: [{ index, stars, open }], current (index or -1), ball(size) -> canvas,
 *         stars (in this world), nextOpen, calm (reduced motion) }
 * Returns { scrollToCurrent(), travel(fromIndex, { land, done }) }.
 */
export function buildMap(scroller, opts) {
  const { world, worlds, levels, current } = opts;
  const w = worlds[world], nextW = worlds[world + 1];
  const W = scroller.clientWidth || 358, vh = scroller.clientHeight || 600;
  const { H, pts, xAt } = layout(world, levels.length, W);
  // the trail runs from the sign below level 1 to the gate above the last level
  const start = [W / 2, H - 92], gate = [W / 2, 150];
  const all = [start, ...pts, gate];
  const segs = segments(all);
  const curK = levels.findIndex((l) => l.index === current);
  // how far the light has come: to the current level, to the gate if the world is done, nowhere if it isn't open
  const lit = curK >= 0 ? curK + 1 : levels[0].open ? all.length - 1 : 0;
  const sc = scenery(world, W, H, pts, xAt, w);
  const light = `rgb(${w.light.join(',')})`;
  const full = pathOf(all, segs, 0, all.length - 1), litD = lit ? pathOf(all, segs, 0, lit) : '';
  const max = levels.length * 3;
  scroller.innerHTML = `
  <div class="map" style="height:${H}px;--gem-ink:${w.dark ? '#1C2238' : w.ink};--lock-ink:${w.dark ? 'rgba(231,234,246,.72)' : rgba(w.ink, 0.5)};--bed:${w.dark ? 'rgba(170,195,255,.13)' : 'rgba(255,255,255,.55)'}">
    <svg class="map-art" style="width:${W}px;height:${H}px" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs>
        <radialGradient id="sun"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".4" stop-color="${light}" stop-opacity=".6"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
        <radialGradient id="halo"><stop offset="0" stop-color="${light}" stop-opacity=".5"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
        <radialGradient id="halo2"><stop offset="0" stop-color="${light}" stop-opacity=".18"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}" stop-opacity="${w.dark ? 0.14 : 0.55}"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></linearGradient>
        <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w.dark ? w.floorEdge : w.floor}" stop-opacity="${w.dark ? 0.5 : 0.55}"/><stop offset="1" stop-color="${w.dark ? w.floorEdge : w.floor}" stop-opacity="0"/></linearGradient>
      </defs>
      <polygon points="${f1(-W * 0.2)},0 ${f1(W * 0.3)},0 ${f1(W * 1.15)},${f1(H * 0.36)} ${f1(W * 0.55)},${f1(H * 0.36)}" fill="url(#beam)"/>
      ${sc.far}
      ${sc.near}
      <path d="${full}" class="trail-bed"/>
      <path d="${full}" class="trail-dots"/>
    </svg>
    ${lit ? `<svg class="map-lit" style="width:${W}px;height:${H}px" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><linearGradient id="litg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="rgb(${mixRGB(hex(w.accent), [255, 255, 255], 0.4).join(',')})"/><stop offset="1" stop-color="${w.accent}"/></linearGradient></defs>
      <path d="${litD}" class="trail-glow"/><path d="${litD}" class="trail-lit"/><path d="${litD}" class="trail-flow"/>
    </svg>` : ''}
    <div class="sign" style="top:${H - 170}px">
      <small>World ${world + 1}</small><b>${w.name}</b><span>${w.sub}</span>
      <i class="sign-bar" role="progressbar" aria-label="Stars in ${w.name}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${opts.stars}"><i style="width:${(opts.stars / max * 100).toFixed(1)}%"></i></i>
      <em><svg><use href="#i-star"/></svg>${opts.stars} / ${max}</em>
    </div>
    ${nextW ? `<button class="gate ${opts.nextOpen ? 'open' : ''}" data-gate="${world + 1}" style="top:${gate[1] - 118}px;--gate-ink:${nextW.ink}" aria-label="${opts.nextOpen ? `Go to ${nextW.name}` : `${nextW.name}, locked`}">
      <svg viewBox="0 0 160 150" aria-hidden="true">
        <defs><linearGradient id="gateg" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${nextW.sky[0]}"/><stop offset=".55" stop-color="${nextW.sky[1]}"/><stop offset="1" stop-color="${nextW.accent}"/></linearGradient></defs>
        <path d="M18,150 V72 A62,62 0 0 1 142,72 V150" fill="url(#gateg)" opacity="${opts.nextOpen ? 0.95 : 0.6}"/>
        <path d="M40,40 L52,56 M80,22 V42 M120,40 L108,56" stroke="#fff" stroke-width="2.2" stroke-opacity=".6" stroke-linecap="round"/>
        <path d="M18,150 V72 A62,62 0 0 1 142,72 V150" fill="none" stroke="#fff" stroke-width="5" stroke-opacity=".9"/>
        <path d="M34,150 V76 A46,46 0 0 1 126,76 V150" fill="none" stroke="#fff" stroke-width="1.6" stroke-opacity=".55"/>
      </svg>
      <span class="gate-label"><small>${opts.nextOpen ? 'Next world' : `Clear level ${levels[levels.length - 1].index + 1}`}</small><b>${opts.nextOpen ? '' : '<svg><use href="#i-lock"/></svg>'}${nextW.name}</b></span>
    </button>` : `<div class="gate end" style="top:${gate[1] - 120}px"><span class="gate-label"><small>The last world</small><b>More soon</b></span><i class="summit${lit === all.length - 1 ? ' lit' : ''}">${gemSVG(lit === all.length - 1 ? hex(w.accent) : mixRGB(hex(w.accent), hex(w.sky[0]), 0.55))}${lit === all.length - 1 ? SPARK : ''}</i></div>`}
    ${levels.map((l, k) => {
      const [x, y] = pts[k];
      const state = !l.open ? 'locked' : k === curK ? 'current' : l.stars === 3 ? 'perfect' : 'done';
      const tint = state === 'current' ? hex(w.accent) : l.open ? w.glass[l.index % 3] : mixRGB(w.glass[l.index % 3], hex(w.sky[w.dark ? 0 : 1]), w.dark ? 0.6 : 0.5);
      const finale = k === levels.length - 1 ? ' finale' : '';
      const below = state === 'current' ? '<span class="go">Play</span>'
        : l.open ? `<span class="st">${[0, 1, 2].map((j) => `<svg class="${j < l.stars ? 'on' : ''}"><use href="#i-star"/></svg>`).join('')}</span>` : '';
      return `<button class="node ${state}${finale}" data-i="${l.index}" style="left:${f1(x)}px;top:${f1(y)}px"${l.open ? '' : ' aria-disabled="true"'} aria-label="Level ${l.index + 1}${l.open ? (state === 'current' ? ', play' : `, ${l.stars} of 3 stars`) : ', locked'}">
        ${gemSVG(tint, { locked: !l.open })}${state === 'perfect' ? SPARK : ''}<b>${l.index + 1}</b>${below}</button>`;
    }).join('')}
  </div>`;
  const map = scroller.querySelector('.map');
  const bed = scroller.querySelector('.trail-bed');
  const nodeAt = (k) => map.querySelector(`.node[data-i="${levels[k].index}"]`);
  const clampTop = (y) => Math.max(0, Math.min(H - vh, y));
  const viewTop = (y) => clampTop(y - vh * VIEW);

  // the ball you play with waits on the next level
  let ballEl = null, inner = null, shadow = null;
  function place(x, y, arc = 0) {
    ballEl.style.transform = `translate3d(${f1(x - 17)}px,${f1(y - REST - 17)}px,0)`;
    inner.style.transform = arc ? `translate3d(0,${f1(-arc)}px,0)` : '';
    shadow.style.transform = arc ? `scale(${f2(1 - (arc / HOP) * 0.5)})` : '';
    shadow.style.opacity = arc ? f2(1 - (arc / HOP) * 0.6) : '';
  }
  if (curK >= 0) {
    ballEl = document.createElement('div');
    ballEl.className = 'map-ball';
    ballEl.innerHTML = '<i class="sh"></i><div class="in"></div>';
    inner = ballEl.querySelector('.in'); shadow = ballEl.querySelector('.sh');
    inner.appendChild(opts.ball(34));
    place(...pts[curK]);
    map.appendChild(ballEl);
  }


  return {
    width: W,
    // the next level sits a little below the middle of the view; a finished world shows its gate
    scrollToCurrent() {
      scroller.scrollTop = curK >= 0 ? viewTop(pts[curK][1]) : lit === all.length - 1 ? 0 : H - vh;
    },
    // progress since the last visit: the ball hops along the trail, gem to gem, lighting it as it goes
    travel(fromIndex, { land, done } = {}) {
      if (!ballEl || !Number.isInteger(fromIndex) || fromIndex >= current) { done?.(); return false; }
      const node = nodeAt(curK);
      let fromK = levels.findIndex((l) => l.index === fromIndex);
      if (fromK < 0) { // last seen in an earlier world
        if (curK === 0) { // this world has just opened: the ball drops in onto its first level
          ballEl.classList.add('drop');
          setTimeout(() => { if (ballEl.isConnected && scroller.offsetParent) { node.classList.add('arrived'); land?.(0, true); } }, 400);
          setTimeout(() => { ballEl.classList.remove('drop'); done?.(); }, 760);
          return true;
        }
        fromK = 0;
      }
      fromK = Math.max(fromK, curK - 5); // a long absence: the last five hops tell the story
      // arc length of the trail at every gem (all[k + 1] is level k)
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      probe.setAttribute('fill', 'none');
      bed.parentNode.appendChild(probe);
      const at = [];
      for (let k = fromK; k <= curK; k++) { probe.setAttribute('d', pathOf(all, segs, 0, k + 1)); at[k] = probe.getTotalLength(); }
      probe.remove();
      const litEls = [...map.querySelectorAll('.trail-lit, .trail-glow')];
      const flow = map.querySelector('.trail-flow');
      const litLen = at[curK];
      for (const p of litEls) { p.style.strokeDasharray = `${f1(litLen + 2)} ${f1(litLen + 2)}`; p.style.strokeDashoffset = `${f1(litLen - at[fromK])}`; }
      if (flow) flow.style.opacity = '0';
      // the levels cleared since: their stars wait to land as the ball leaves them
      for (let k = fromK; k < curK; k++) nodeAt(k).classList.add('pending');
      node.classList.add('waiting');
      ballEl.classList.add('moving');
      const hops = curK - fromK, hopMs = hops > 2 ? 340 : 440;
      const camFrom = viewTop(pts[fromK][1]), camTo = viewTop(pts[curK][1]);
      let follow = true;
      const stop = () => { follow = false; };
      scroller.addEventListener('touchstart', stop, { once: true, passive: true });
      scroller.addEventListener('wheel', stop, { once: true, passive: true });
      scroller.scrollTop = camFrom;
      place(...pts[fromK]);
      const t0 = performance.now() + 160;
      let hop = -1;
      const finish = (quiet) => {
        scroller.removeEventListener('touchstart', stop);
        scroller.removeEventListener('wheel', stop);
        if (ballEl.isConnected) {
          place(...pts[curK]);
          for (let k = fromK; k < curK; k++) nodeAt(k).classList.replace('pending', 'fresh');
          for (const q of litEls) { q.style.strokeDasharray = ''; q.style.strokeDashoffset = ''; }
          if (flow) flow.style.opacity = '';
          ballEl.classList.remove('moving');
          node.classList.replace('waiting', 'arrived');
          if (!quiet) { squash(); land?.(hops, true); }
        }
        done?.();
      };
      const tick = (t) => {
        // the map was rebuilt or left: settle at once, quietly
        if (!ballEl.isConnected || !scroller.offsetParent) { finish(true); return; }
        const el = Math.max(0, t - t0), h = Math.min(hops - 1, Math.floor(el / hopMs));
        const u = Math.min(1, (el - h * hopMs) / hopMs);
        while (hop < h) { // landing on a gem, then taking off from it: its stars land (a long frame skips none)
          hop++;
          if (hop > 0) { land?.(hop, false); squash(); }
          nodeAt(fromK + hop).classList.replace('pending', 'fresh');
        }
        const k = fromK + h, s = at[k] + (at[k + 1] - at[k]) * ease(u);
        const p = bed.getPointAtLength(s);
        place(p.x, p.y, HOP * 4 * u * (1 - u));
        for (const q of litEls) q.style.strokeDashoffset = `${f1(litLen - s)}`;
        if (follow) scroller.scrollTop = camFrom + (camTo - camFrom) * ease(Math.min(1, el / (hops * hopMs)));
        if (el < hops * hopMs) requestAnimationFrame(tick);
        else finish(false);
      };
      const squash = () => { const c = inner.firstChild; c.classList.remove('squash'); void c.offsetWidth; c.classList.add('squash'); };
      requestAnimationFrame(tick);
      return true;
    },
  };
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
// a four-point glint on a perfect level, twinkling on its own layer
const SPARK = '<i class="spark"><svg viewBox="0 0 16 16"><path d="M8 0l1.9 6.1L16 8l-6.1 1.9L8 16l-1.9-6.1L0 8l6.1-1.9z" fill="#fff"/></svg></i>';
const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
