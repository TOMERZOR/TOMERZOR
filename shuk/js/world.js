// The market street: endless chunks of stalls, facades and overhead decoration,
// plus sky, fog and lighting that change with the zone.
import * as THREE from 'three';
import { Bag, rnd, pick, box, sph, cyl, cone } from './geo.js';
import { ZONES, ZONE_LENGTH } from './config.js';
import { signAtlas, glowTexture, softRectTexture, shaftTexture } from './textures.js';
import { makeContactShadow } from './props.js';
import { shukLit, shukLitTree, SunBake, STATIC_LAYER, SHUK } from './light.js';

export const CHUNK = 30;
const STALL_X = 4.25;   // street edge of the stalls
const FACADE_X = 6.9;   // building line
const N_VARIANTS = 3;
const PROP_CAP = 16;     // generated models of one type per chunk
const LOD_DIST = 75;     // chunks starting further ahead than this use the low-detail stalls

// ---------- themes ----------
// canyon: roofline height the sky occlusion assumes; aoFloor: ambient left at the bottom of the canyon;
// bounce: warm light thrown back by sunlit stone; signShade: how much painted signs darken in the shade
export const THEMES = {
  day:     { skyTop: '#5aa9f0', skyMid: '#a9d4f5', skyBot: '#f3e6cf', fog: '#e6dccb', fogNear: 30, fogFar: 158,
             hemiSky: '#d6e4ff', hemiGround: '#b8996f', hemi: 0.88, sun: '#ffe9c2', sunI: 3.7, sunDir: [-0.55, 1.1, 0.45],
             facade: '#ffffff', glow: 0.0, bulbs: '#fff1c2', exposure: 1.0, playerLight: 0, clouds: 1, stars: 0, rim: 1.2,
             canyon: 13.5, aoFloor: 0.45, bounce: 0.08, signShade: 0.42 },
  covered: { skyTop: '#cfae7c', skyMid: '#e2c495', skyBot: '#e9d2a8', fog: '#c8aa7c', fogNear: 22, fogFar: 124,
             hemiSky: '#ffe4bb', hemiGround: '#8a6a45', hemi: 0.74, sun: '#ffe1b0', sunI: 2.7, sunDir: [-0.4, 0.95, 0.35],
             facade: '#e9d8bd', glow: 0.55, bulbs: '#ffd98a', exposure: 1.05, playerLight: 0.6, clouds: 0.3, stars: 0, rim: 0.9,
             canyon: 9.5, aoFloor: 0.55, bounce: 0.08, signShade: 0.32 },
  sunset:  { skyTop: '#3f4d9a', skyMid: '#ef8a63', skyBot: '#ffd08a', fog: '#e9a07a', fogNear: 28, fogFar: 142,
             hemiSky: '#c2c3ff', hemiGround: '#7a5048', hemi: 0.9, sun: '#ffa65c', sunI: 3.3, sunDir: [0.4, 0.6, 0.9],
             facade: '#ffd2ad', glow: 0.5, bulbs: '#ffcf7a', exposure: 1.02, playerLight: 0.5, clouds: 0.8, stars: 0.15, rim: 2.2,
             canyon: 13.5, aoFloor: 0.5, bounce: 0.09, signShade: 0.38 },
  night:   { skyTop: '#070a22', skyMid: '#1a1f4a', skyBot: '#43305e', fog: '#1d1a36', fogNear: 24, fogFar: 120,
             hemiSky: '#8a96ff', hemiGround: '#3a2a3a', hemi: 0.75, sun: '#9fb2ff', sunI: 0.8, sunDir: [0.4, 1, 0.3],
             facade: '#5a5f8a', glow: 1.0, bulbs: '#ffe2a0', exposure: 1.1, playerLight: 1.6, clouds: 0.15, stars: 1, rim: 1.6,
             canyon: 13.5, aoFloor: 0.62, bounce: 0.03, signShade: 0.0 },
};
const THEME_ORDER = ZONES.map(z => z.theme);

export function zoneAt(d) {
  const i = Math.floor(Math.max(0, d) / ZONE_LENGTH);
  return { index: i, zone: ZONES[i % ZONES.length], loop: Math.floor(i / ZONES.length) };
}

// ---------- stall builders (local frame: u = depth from street edge, v = along street) ----------
// world x = side * (STALL_X + u), z = -(v0 + v)
const PRODUCE = {
  tomato: ['#d62828', '#e63946', '#c1121f'], orange: ['#f77f00', '#fb8b24', '#f4a020'], lemon: ['#ffd23f', '#f6e05e'],
  apple: ['#c1121f', '#9d0208', '#80b918'], cucumber: ['#2d6a4f', '#40916c'], pepper: ['#e63946', '#ffd23f', '#38b000'],
  eggplant: ['#3c096c', '#5a189a'], pomegranate: ['#9d0208', '#ae2012'], potato: ['#b08968', '#9c6644'],
  onion: ['#e9c46a', '#d4a373', '#b5838d'], grape: ['#6a4c93', '#80b918'], peach: ['#ff9f68', '#ffb4a2'],
  lettuce: ['#70e000', '#38b000'], banana: ['#ffd60a', '#ffc300'], avocado: ['#344e41', '#3a5a40'],
};

function addCrate(bag, side, u, y, v0, v, w = 0.5, d = 0.4, fruit = null, tilt = 0) {
  const x = side * (STALL_X + u), z = -(v0 + v);
  bag.add(box(d, 0.16, w), '#a0703c', x, y + 0.08, z, 0, 0, side * tilt, 1, 1, 1, 0.2);
  bag.add(box(d + 0.02, 0.03, w + 0.02), '#7a5230', x, y + 0.165, z, 0, 0, side * tilt);
  if (fruit) {
    const cols = PRODUCE[fruit];
    const r = fruit === 'grape' ? 0.07 : fruit === 'cucumber' || fruit === 'banana' ? 0.06 : 0.088;
    const nx = Math.max(2, Math.floor(d / (r * 2.1))), nz = Math.max(2, Math.floor(w / (r * 2.1)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const lx = (i - (nx - 1) / 2) * r * 2.05, lz = (j - (nz - 1) / 2) * r * 2.05;
      const g = fruit === 'cucumber' || fruit === 'banana' ? sph(r, 6, 4).scale(1, 1, 2.2) : fruit === 'eggplant' ? sph(r, 6, 4).scale(1, 1, 1.5) : sph(r);
      bag.add(g, pick(cols), x + side * lx * Math.cos(tilt), y + 0.2 + r * 0.6 + side * lx * Math.sin(tilt) * 0, z + lz, 0, rnd(0, 3), 0, 1, 1, 1, 0.25);
    }
    // second layer, smaller pyramid
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
      if (Math.random() < 0.55) continue;
      const lx = (i - (nx - 2) / 2) * r * 2.05, lz = (j - (nz - 2) / 2) * r * 2.05;
      bag.add(sph(r), pick(cols), x + side * lx, y + 0.2 + r * 1.95, z + lz, 0, 0, 0, 1, 1, 1, 0.25);
    }
  }
}

function tableBase(bag, side, v0, len, color = '#7a4f2a', cloth = null) {
  const depth = 1.55, h = 0.82;
  const x = side * (STALL_X + depth / 2), z = -(v0 + len / 2);
  bag.add(box(depth, 0.06, len), '#6b4423', x, h, z);
  bag.add(box(0.05, h, len - 0.1), cloth || color, side * (STALL_X + 0.03), h / 2, z, 0, 0, 0, 1, 1, 1, 0.1);
  for (const dv of [0.1, len - 0.1]) bag.add(box(0.06, h, 0.06), '#4a2f18', side * (STALL_X + 0.1), h / 2, -(v0 + dv));
  return h + 0.03;
}

function awning(bag, side, v0, len, colA, colB) {
  const u0 = -0.25, u1 = 2.5, y0 = 2.75, y1 = 3.35;
  const slope = Math.atan2(y1 - y0, u1 - u0);
  const width = Math.hypot(u1 - u0, y1 - y0);
  const stripes = 8, sw = len / stripes;
  const cx = side * (STALL_X + (u0 + u1) / 2), cy = (y0 + y1) / 2;
  for (let i = 0; i < stripes; i++) {
    bag.add(box(width, 0.03, sw + 0.002), i % 2 ? colA : colB, cx, cy, -(v0 + sw * (i + 0.5)), 0, 0, side * slope);
  }
  // scalloped valance
  const n = Math.round(len / 0.32);
  for (let i = 0; i < n; i++) {
    const vz = -(v0 + (i + 0.5) * len / n);
    bag.add(box(0.02, 0.2, len / n * 0.92), i % 2 ? colA : colB, side * (STALL_X + u0), y0 - 0.1, vz);
    bag.add(cone(0.08, 0.12, 4).rotateX(Math.PI), i % 2 ? colA : colB, side * (STALL_X + u0), y0 - 0.25, vz, 0, 0, 0, 0.35, 1, 1.1);
  }
  // poles
  for (const dv of [0.05, len - 0.05]) bag.add(cyl(0.035, 0.035, y0, 6), '#5b5f63', side * (STALL_X + u0 + 0.02), y0 / 2, -(v0 + dv));
}

const STALLS = {
  produce(bag, side, v0, len) {
    const top = tableBase(bag, side, v0, len, '#7a4f2a', pick(['#2d6a4f', '#1d3557', '#9d0208']));
    const kinds = Object.keys(PRODUCE);
    const rows = [[0.25, 0, 0.0], [0.72, 0.16, 0.16], [1.18, 0.34, 0.2]];
    const per = Math.floor(len / 0.55);
    for (const [u, dy, tilt] of rows) {
      if (dy > 0) bag.add(box(0.5, dy, len - 0.1), '#5a3a1e', side * (STALL_X + u), top + dy / 2, -(v0 + len / 2));
      let k = pick(kinds);
      for (let i = 0; i < per; i++) {
        if (i % 2 === 0) k = pick(kinds);
        addCrate(bag, side, u, top + dy, v0, 0.3 + i * 0.55, 0.5, 0.42, k, tilt * 0);
      }
    }
  },
  spices(bag, side, v0, len, { sign, atlas } = {}) {
    const top = tableBase(bag, side, v0, len, '#8a5a2b', '#5e2a14');
    const cols = ['#c0392b', '#f1c40f', '#8e5a2b', '#6b8e23', '#8b1e3f', '#e1a33b', '#d35400', '#a0522d', '#556b2f', '#e74c3c'];
    const per = Math.floor(len / 0.42);
    for (let r = 0; r < 3; r++) for (let i = 0; i < per; i++) {
      const u = 0.25 + r * 0.45, v = 0.25 + i * 0.42, h = top + r * 0.14, ph = rnd(0.22, 0.36);
      if (r) bag.add(box(0.42, 0.14, 0.4), '#6b4423', side * (STALL_X + u), h - 0.07, -(v0 + v));
      bag.add(cyl(0.17, 0.14, 0.1, 10), '#f2efe8', side * (STALL_X + u), h + 0.05, -(v0 + v));
      bag.add(cone(0.16, ph, 10), pick(cols), side * (STALL_X + u), h + 0.1 + ph / 2, -(v0 + v), 0, 0, 0, 1, 1, 1, 0.15);
      // a handwritten price card stuck in every mound of the front rows
      if (sign && r < 2) priceStick(bag, sign, atlas, side * (STALL_X + u - 0.05), h + 0.1 + ph * 0.6, -(v0 + v), side);
    }
    // brass coffee pots and a mortar on the top shelf
    bag.add(box(0.36, 0.04, len - 0.2), '#5a3a1e', side * (STALL_X + 1.45), top + 0.6, -(v0 + len / 2));
    for (let i = 0; i < 4; i++) {
      const z = -(v0 + 0.4 + i * (len - 0.8) / 3);
      if (i === 2) {
        bag.add(cyl(0.11, 0.08, 0.14, 10), '#b8913c', side * (STALL_X + 1.45), top + 0.69, z, 0, 0, 0, 1, 1, 1, 0.1);
        bag.add(cyl(0.018, 0.018, 0.26, 5), '#9c7a30', side * (STALL_X + 1.45), top + 0.8, z, 0, 0, 0.5);
      } else dallah(bag, side * (STALL_X + 1.45), top + 0.62, z, side);
    }
    // hanging garlic / dried peppers strings
    for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++)
      bag.add(sph(0.05, 5, 3), i % 2 ? '#b5121b' : '#f1e3c6', side * (STALL_X - 0.15), 2.55 - k * 0.11, -(v0 + 0.5 + i * (len - 1) / 3));
  },
  halva(bag, side, v0, len, { sign, atlas } = {}) {
    const top = tableBase(bag, side, v0, len, '#c9a227', '#3a2a1a');
    const cols = ['#e8d2a8', '#c89b6d', '#8b5a3c', '#b8c48a', '#e8a0b0', '#f2e2c4', '#d9a066'];
    const per = Math.floor(len / 0.6);
    for (let r = 0; r < 2; r++) for (let i = 0; i < per; i++) {
      const u = 0.35 + r * 0.7, v = 0.35 + i * 0.6, y = top + r * 0.12;
      bag.add(box(0.5, 0.02, 0.5), '#8b5e34', side * (STALL_X + u), y + 0.01, -(v0 + v));
      const h = rnd(0.16, 0.3), col = pick(cols);
      if (Math.random() < 0.55) {
        // a big block of halva with a slab cut off it, the cut face paler and rougher
        bag.add(box(0.42, h, 0.3), col, side * (STALL_X + u), y + h / 2 + 0.02, -(v0 + v - 0.06), 0, 0, 0, 1, 1, 1, 0.1);
        bag.add(box(0.42, h * 0.95, 0.07), new THREE.Color(col).offsetHSL(0, -0.08, 0.06).getStyle(), side * (STALL_X + u), y + h * 0.475 + 0.02, -(v0 + v + 0.16), 0.12, 0, 0);
      } else {
        bag.add(cyl(0.22, 0.24, h, 12), col, side * (STALL_X + u), y + h / 2 + 0.02, -(v0 + v), 0, 0, 0, 1, 1, 1, 0.1);
      }
      if (sign && Math.random() < 0.7) priceStick(bag, sign, atlas, side * (STALL_X + u - 0.12), y + h + 0.04, -(v0 + v), side);
    }
  },
  nuts(bag, side, v0, len, { sign, atlas } = {}) {
    const top = tableBase(bag, side, v0, len, '#6b4423', '#2f3e46');
    const cols = ['#c8a165', '#8b5a2b', '#e8d8b0', '#8fa253', '#f2c14e', '#b5651d', '#d9b38c', '#5c3d2e'];
    const per = Math.floor(len / 0.45);
    for (let r = 0; r < 3; r++) for (let i = 0; i < per; i++) {
      const u = 0.22 + r * 0.45, v = 0.25 + i * 0.45, h = top + r * 0.12;
      bag.add(box(0.42, 0.18, 0.42), '#b0b5b9', side * (STALL_X + u), h + 0.09, -(v0 + v));
      bag.add(sph(0.2, 8, 4).scale(1, 0.35, 1), pick(cols), side * (STALL_X + u), h + 0.19, -(v0 + v), 0, 0, 0, 1, 1, 1, 0.12);
      if (sign && r === 0 && i % 2 === 0) priceStick(bag, sign, atlas, side * (STALL_X + u - 0.1), h + 0.24, -(v0 + v), side);
    }
  },
  fish(bag, side, v0, len) {
    const top = tableBase(bag, side, v0, len, '#dfe7ec', '#1c5d8f');
    bag.add(box(1.4, 0.08, len - 0.2), '#f4fbff', side * (STALL_X + 0.75), top + 0.04, -(v0 + len / 2));
    const n = Math.floor(len / 0.32) * 3;
    for (let i = 0; i < n; i++) {
      const u = 0.2 + (i % 3) * 0.45 + rnd(-0.05, 0.05), v = 0.25 + Math.floor(i / 3) * 0.32;
      bag.add(sph(0.08, 6, 4).scale(3.2, 0.7, 1), pick(['#9fb1bd', '#c3ced6', '#d98c6c', '#7d8f9b']), side * (STALL_X + u), top + 0.12, -(v0 + v), 0, rnd(-0.4, 0.4), 0);
    }
    for (let i = 0; i < 10; i++) bag.add(sph(0.05, 5, 3), '#ffd23f', side * (STALL_X + rnd(0.2, 1.3)), top + 0.12, -(v0 + rnd(0.2, len - 0.2)));
  },
  bakery(bag, side, v0, len) {
    const top = tableBase(bag, side, v0, len, '#c98a2b', '#7a2e12');
    const per = Math.floor(len / 0.5);
    for (let r = 0; r < 3; r++) for (let i = 0; i < per; i++) {
      const u = 0.25 + r * 0.45, v = 0.3 + i * 0.5, h = top + r * 0.1;
      bag.add(box(0.44, 0.04, 0.46), '#a87b4f', side * (STALL_X + u), h + 0.02, -(v0 + v));
      if (r === 1) { // braided challah
        for (let k = 0; k < 3; k++) bag.add(sph(0.08, 6, 4).scale(1, 0.75, 1.1), '#b8641e', side * (STALL_X + u), h + 0.1, -(v0 + v - 0.14 + k * 0.14), 0, 0, 0, 1, 1, 1, 0.12);
      } else if (r === 0) { // pita stack
        bag.add(cyl(0.16, 0.16, 0.12, 10), '#e8c27e', side * (STALL_X + u), h + 0.1, -(v0 + v));
        for (let k = 0; k < 3; k++) bag.add(cyl(0.162, 0.162, 0.006, 10), '#c9a15e', side * (STALL_X + u), h + 0.06 + k * 0.03, -(v0 + v));
      } else { // rugelach & bourekas
        for (let k = 0; k < 5; k++) bag.add(sph(0.055).scale(1.5, 0.8, 1), k % 2 ? '#6b3a1e' : '#d9963a', side * (STALL_X + u + rnd(-0.12, 0.12)), h + 0.07, -(v0 + v + rnd(-0.15, 0.15)));
      }
    }
  },
  flowers(bag, side, v0, len) {
    const cols = ['#e63946', '#ffb703', '#f15bb5', '#ffffff', '#9b5de5', '#fb8500', '#ff006e'];
    const n = Math.floor(len / 0.4);
    for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++) {
      const u = 0.25 + r * 0.42, v = 0.25 + i * 0.4, h = r * 0.2;
      if (r) bag.add(box(0.4, h, 0.4), '#6b4423', side * (STALL_X + u), h / 2, -(v0 + v));
      bag.add(cyl(0.14, 0.11, 0.42, 7), '#3d5a80', side * (STALL_X + u), h + 0.21, -(v0 + v));
      bag.add(cone(0.13, 0.55, 5).rotateX(Math.PI), '#2d6a4f', side * (STALL_X + u), h + 0.62, -(v0 + v));
      const col = pick(cols);
      for (let k = 0; k < 5; k++) {
        const ox = rnd(-0.13, 0.13), oz = rnd(-0.13, 0.13), hh = rnd(0.45, 0.7);
        bag.add(sph(0.075), col, side * (STALL_X + u + ox), h + 0.42 + hh, -(v0 + v + oz), 0, 0, 0, 1, 1, 1, 0.15);
      }
    }
  },
  olives(bag, side, v0, len) {
    const top = tableBase(bag, side, v0, len, '#556b2f', '#283618');
    const per = Math.floor(len / 0.5);
    for (let i = 0; i < per; i++) {
      const v = 0.3 + i * 0.5;
      bag.add(cyl(0.2, 0.18, 0.35, 12), '#8b5e34', side * (STALL_X + 0.35), top + 0.17, -(v0 + v));
      bag.add(cyl(0.19, 0.19, 0.02, 12), pick(['#3a5a40', '#283618', '#606c38', '#1b1b1b', '#7f5539']), side * (STALL_X + 0.35), top + 0.35, -(v0 + v));
      bag.add(cyl(0.2, 0.2, 0.12, 14), pick(['#f6d55c', '#f2c14e', '#ede0c8']), side * (STALL_X + 1.0), top + 0.06 + (i % 2) * 0.12, -(v0 + v));
    }
    // cheese wheels stacked behind
    for (let i = 0; i < 4; i++) bag.add(cyl(0.22, 0.22, 0.14, 14), '#f6d55c', side * (STALL_X + 1.35), top + 0.07 + i * 0.15, -(v0 + len - 0.4));
  },
  juice(bag, side, v0, len) {
    const top = tableBase(bag, side, v0, len, '#b5179e', '#3a0ca3');
    for (let p = 0; p < 3; p++) { // fruit pyramids
      const cu = 0.45 + p * 0.0, cv = 0.6 + p * (len - 1.2) / 2, fr = p === 1 ? 'orange' : 'pomegranate';
      for (let l = 0; l < 4; l++) for (let i = 0; i <= 3 - l; i++) for (let j = 0; j <= 3 - l; j++)
        bag.add(sph(0.08), pick(PRODUCE[fr]), side * (STALL_X + cu + (i - (3 - l) / 2) * 0.16), top + 0.08 + l * 0.13, -(v0 + cv + (j - (3 - l) / 2) * 0.16), 0, 0, 0, 1, 1, 1, 0.2);
    }
    bag.add(box(0.5, 0.5, 0.5), '#c0c7cc', side * (STALL_X + 1.15), top + 0.25, -(v0 + len / 2));
    bag.add(cyl(0.1, 0.1, 0.3, 10), '#e63946', side * (STALL_X + 1.15), top + 0.65, -(v0 + len / 2));
    for (let i = 0; i < 6; i++) bag.add(cyl(0.04, 0.035, 0.14, 8), i % 2 ? '#e63946' : '#f77f00', side * (STALL_X + 0.95), top + 0.07, -(v0 + 0.4 + i * 0.25));
  },
  dried(bag, side, v0, len) {
    const top = tableBase(bag, side, v0, len, '#7f5539', '#582f0e');
    const cols = ['#f4a261', '#7f4f24', '#bc4749', '#e9c46a', '#6a4c93', '#d4a373', '#a7c957'];
    const per = Math.floor(len / 0.5);
    for (let r = 0; r < 3; r++) for (let i = 0; i < per; i++) {
      const u = 0.25 + r * 0.45, v = 0.3 + i * 0.5, h = top + r * 0.13;
      if (r) bag.add(box(0.44, 0.13, 0.46), '#5a3a1e', side * (STALL_X + u), h - 0.065, -(v0 + v));
      bag.add(box(0.42, 0.03, 0.44), '#e9edc9', side * (STALL_X + u), h + 0.015, -(v0 + v));
      bag.add(cone(0.2, 0.22, 8).scale(1, 1, 1.05), pick(cols), side * (STALL_X + u), h + 0.13, -(v0 + v), 0, 0, 0, 1, 1, 1, 0.12);
    }
  },
};
const STALL_TYPES = Object.keys(STALLS);
const AWNINGS = [['#d62828', '#fff3e0'], ['#2a9d8f', '#fff3e0'], ['#f4a261', '#264653'], ['#1d3557', '#f1faee'], ['#e9c46a', '#e76f51'],
  ['#6a994e', '#f2e8cf'], ['#9b2226', '#ee9b00'], ['#3a86ff', '#ffffff'], ['#8338ec', '#ffbe0b']];

// ---------- street furniture from the market's own reference photos ----------
// open sacks out front: burlap, a rolled rim and a heap of whatever the stall sells
const SACK_GOODS = {
  nuts: ['#c8a165', '#8b5a2b', '#e8d8b0', '#8fa253', '#b5651d'], dried: ['#f4a261', '#7f4f24', '#bc4749', '#e9c46a', '#6a4c93'],
  spices: ['#c0392b', '#e1a33b', '#8e5a2b', '#556b2f', '#d35400'], olives: ['#3a5a40', '#283618', '#606c38', '#7f5539'],
};
function sacks(vc, sign, atlas, side, v0, len, goods) {
  const n = Math.min(4, Math.floor(len / 0.5));
  for (let i = 0; i < n; i++) {
    const x = side * (STALL_X - 0.12 + rnd(-0.03, 0.03)), z = -(v0 + (i + 0.5) * len / n), h = rnd(0.34, 0.44);
    vc.add(cyl(0.19, 0.16, h, 9), '#b39b6e', x, 0.14 + h / 2, z, 0, rnd(0, 3), 0, 1, 1, 1, 0.12);
    vc.add(new THREE.TorusGeometry(0.19, 0.045, 4, 10).rotateX(Math.PI / 2), '#a58b5c', x, 0.14 + h, z);
    vc.add(sph(0.17, 8, 4).scale(1, 0.45, 1), pick(goods), x, 0.14 + h - 0.01, z, 0, 0, 0, 1, 1, 1, 0.12);
    if (Math.random() < 0.7) priceStick(vc, sign, atlas, x, 0.14 + h + 0.03, z, side);
  }
}
// a small handwritten price card on a skewer
function priceStick(vc, sign, atlas, x, y, z, side) {
  vc.add(box(0.012, 0.16, 0.012), '#d8c39a', x, y + 0.08, z);
  const g = new THREE.PlaneGeometry(0.2, 0.075);
  const [u0, v0, du, dv] = atlas.uv[atlas.pick('price')];
  setUV(g, [u0 + du * 0.15, v0, du * 0.7, dv]);
  sign.add(g, null, x - side * 0.008, y + 0.19, z, 0, -side * Math.PI / 2, (Math.random() - 0.5) * 0.25);
}
// a cardboard sign facing the street
function addCard(sign, atlas, x, y, z, side, w = 0.48) {
  const g = new THREE.PlaneGeometry(w, w * 0.75);
  setUV(g, atlas.uv[atlas.pick('card')]);
  sign.add(g, null, x, y, z, 0, -side * Math.PI / 2, (Math.random() - 0.5) * 0.2);
}
// a roll of thin plastic bags on a hook, a couple torn off and hanging
function bagRoll(vc, x, z) {
  vc.add(cyl(0.008, 0.008, 0.3, 3), '#555', x, 1.97, z);
  vc.add(cyl(0.075, 0.075, 0.26, 10), '#f3f3ee', x, 1.8, z, Math.PI / 2, 0, 0);
  for (let i = 0; i < 2; i++) vc.add(box(0.006, 0.38 - i * 0.1, 0.22), i ? '#e9eeee' : '#f6f6f2', x + (i - 0.5) * 0.02, 1.58 + i * 0.05, z + 0.02);
}
// brass Arab coffee pot (dallah): a lathed body with a long beak
const DALLAH = new THREE.LatheGeometry([[0, 0], [0.085, 0], [0.095, 0.04], [0.07, 0.13], [0.045, 0.19], [0.055, 0.23], [0.032, 0.29], [0.045, 0.32], [0, 0.34]]
  .map(([x, y]) => new THREE.Vector2(x, y)), 8);
function dallah(vc, x, y, z, side) {
  vc.add(DALLAH.clone(), '#c9a14a', x, y, z, 0, 0, 0, 1, 1, 1, 0.1);
  vc.add(cone(0.022, 0.2, 5), '#b8913c', x, y + 0.22, z + 0.1, 0.9, 0, 0);
  vc.add(new THREE.TorusGeometry(0.06, 0.01, 4, 8, Math.PI), '#a8832f', x, y + 0.18, z - 0.08, 0, Math.PI / 2, -Math.PI / 2);
}

// A bar at the street (Mahane Yehuda after dark): counter, brass foot rail, high stools on the curb, a back bar of
// bottles, a chalkboard menu, plants and bare bulbs.
function barStall({ vc, sign, bulbs, glow, atlas }, side, v0, len) {
  const X = u => side * (STALL_X + u), Z = v => -(v0 + v);
  vc.add(box(0.55, 0.07, len), '#3e2516', X(0.3), 1.06, Z(len / 2));
  vc.add(box(0.05, 1.02, len - 0.04), '#7a4b2b', X(0.06), 0.51, Z(len / 2), 0, 0, 0, 1, 1, 1, 0.1);
  for (let p = 0.3; p < len - 0.1; p += 0.34) vc.add(box(0.012, 0.95, 0.02), '#4f2f1a', X(0.03), 0.5, Z(p));
  vc.add(cyl(0.025, 0.025, len - 0.2, 6), '#b08d57', X(-0.08), 0.24, Z(len / 2), Math.PI / 2, 0, 0);
  // back bar
  vc.add(box(0.35, 1.2, len - 0.2), '#2c1d14', X(2.0), 0.6, Z(len / 2));
  for (let r = 0; r < 3; r++) {
    const y = 1.25 + r * 0.4;
    vc.add(box(0.3, 0.03, len - 0.3), '#5a3a22', X(1.95), y, Z(len / 2));
    for (let p = 0.35; p < len - 0.35; p += rnd(0.12, 0.18)) {
      const h = rnd(0.2, 0.3);
      vc.add(cyl(0.035, 0.04, h, 6), pick(['#2e7d32', '#6d4c41', '#f9a825', '#c62828', '#e0e0e0', '#1565c0', '#8d6e63']), X(1.95), y + h / 2 + 0.015, Z(p), 0, 0, 0, 1, 1, 1, 0.15);
    }
  }
  const g = new THREE.PlaneGeometry(0.66, 0.87);
  setUV(g, atlas.uv[atlas.pick('chalk')]);
  sign.add(g, null, X(1.75), 1.62, Z(len * 0.3), 0, -side * Math.PI / 2, 0);
  // stools
  for (let p = 0.5; p < len - 0.3; p += 0.78) {
    const x = X(-0.3), z = Z(p);
    vc.add(cyl(0.16, 0.16, 0.06, 10), pick(['#8b5a2b', '#2b2b2b', '#a8382a']), x, 0.84, z);
    vc.add(cyl(0.025, 0.025, 0.68, 5), '#6f7275', x, 0.48, z);
    vc.add(new THREE.TorusGeometry(0.11, 0.012, 4, 10).rotateX(Math.PI / 2), '#6f7275', x, 0.42, z);
    vc.add(cyl(0.15, 0.17, 0.03, 10), '#4a4d50', x, 0.155, z);
  }
  // plants on the counter ends
  for (const p of [0.25, len - 0.25]) {
    vc.add(cyl(0.11, 0.08, 0.2, 8), '#b5562e', X(0.32), 1.2, Z(p));
    vc.add(sph(0.2, 7, 5), pick(['#3f7f3a', '#2f6d32', '#4c8a3f']), X(0.32), 1.42, Z(p), 0, 0, 0, 1, 1.15, 1, 0.12);
  }
  for (let i = 0; i < 4; i++) {
    const bx = X(0.45 + (i % 2) * 0.5), bz = Z((i + 0.5) * len / 4), by = rnd(2.25, 2.45);
    vc.add(cyl(0.005, 0.005, 2.72 - by, 3), '#222', bx, (2.72 + by) / 2, bz);
    bulbs.add(sph(0.05, 6, 4).scale(1, 1.3, 1), null, bx, by, bz);
    glow.push(bx, by, bz);
  }
  awning(vc, side, v0, len, '#2f3e46', '#e9d8a6');
}

// A sloping tarp / tin sheet canopy over the stalls in front of one building, on a pipe frame from the curb back to
// the wall (the photos' grey patchwork over the open market). Patches vary in colour, height and material.
// sun-bleached canvas and plastic sheeting: light colours, since what the runner sees is their shaded underside
const TARPS = ['#ebe6da', '#d9d2c1', '#c8d1d6', '#e8dcc2', '#9ec1de', '#dcc9a0', '#c9d3b4', '#dca197', '#f1efe8'];
function canopy(vc, side, b, sign, atlas) {
  const xe = STALL_X - 0.35, xb = FACADE_X - 0.25, ye = 4.36, yb = 4.94;
  const slope = Math.atan2(yb - ye, xb - xe), width = Math.hypot(xb - xe, yb - ye);
  const cx = side * (xe + xb) / 2, cy = (ye + yb) / 2, end = b.z0 + b.w - 0.15;
  let z = b.z0 + 0.15;
  const poles = [z];
  while (z < end - 0.5) {
    const L = Math.min(end - z, rnd(2.6, 4.4)), zc = -(z + L / 2), dy = rnd(-0.05, 0.05);
    if (Math.random() < 0.35) {
      // corrugated sheet: lighter ribs running down the slope
      vc.add(box(width, 0.025, L), '#b3b8bb', cx, cy + dy, zc, 0, 0, side * slope);
      for (let r = 0.07; r < L; r += 0.15) vc.add(box(width, 0.03, 0.045), '#d6dadc', cx, cy + dy + 0.02, -(z + r), 0, 0, side * slope);
    } else {
      const col = pick(TARPS);
      vc.add(box(width, 0.02, L + 0.08), col, cx, cy + dy, zc, 0, 0, side * slope, 1, 1, 1, 0.12);
      if (Math.random() < 0.6) vc.add(box(0.02, 0.3, L), col, side * (xe - 0.01), ye + dy - 0.14, zc);
    }
    z += L;
    poles.push(z);
  }
  for (const pz of poles) {
    vc.add(cyl(0.035, 0.035, ye, 6), '#5d6367', side * (xe + 0.04), ye / 2, -pz);
    vc.add(box(width, 0.05, 0.05), '#5d6367', cx, cy - 0.05, -pz, 0, 0, side * slope);
  }
  vc.add(box(0.06, 0.06, b.w - 0.3), '#5d6367', side * (xe + 0.04), ye - 0.04, -(b.z0 + b.w / 2));
  // shop names hung under the front beam, square to the street so the runner reads them coming
  for (let z = b.z0 + rnd(0.8, 2.5); z < end - 0.6; z += rnd(3.5, 6)) {
    for (const dz of [-0.06, 0.06]) vc.add(box(0.012, 0.3, 0.012), '#3b3b3b', side * (xe + 0.25 + dz * 4), ye - 0.2, -z);
    addBlade(sign, atlas, atlas.pick('shop'), side * (xe + 0.25), ye - 0.55, -z, 1.15, 0.29);
  }
}

// chalkboard A-frame, turned to face the runner
function aFrame(sign, atlas, x, z) {
  const idx = atlas.pick('chalk');
  for (const s of [1, -1]) {
    const g = new THREE.PlaneGeometry(0.52, 0.68);
    setUV(g, atlas.uv[idx]);
    sign.add(g, null, x, 0.33, z + s * 0.1, s * -0.3, s > 0 ? 0 : Math.PI, 0);
  }
}

// ceiling fan on a down-rod from the market roof
function fan(vc, x, y, z, roofY) {
  const top = roofY(x);
  vc.add(cyl(0.018, 0.018, top - y, 5), '#3b3f43', x, (top + y) / 2, z);
  vc.add(cyl(0.15, 0.12, 0.14, 10), '#4a4f54', x, y, z);
  const a0 = rnd(0, 1.5);
  for (let i = 0; i < 4; i++) {
    const a = a0 + i * Math.PI / 2;
    vc.add(box(0.72, 0.015, 0.14), '#7a5534', x + Math.cos(a) * 0.45, y - 0.04, z - Math.sin(a) * 0.45, 0, a, 0.05);
  }
}

// ---------- chunk variant builder ----------
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function propMatrix(x, z, yaw, scale) {
  return new THREE.Matrix4().compose(_p.set(x, 0, z), _q.setFromAxisAngle(_up, yaw), _s.setScalar(scale));
}

// models: generated stall/truck meshes ({ name: { size } }); fronts face +x, the long side runs along z
function buildVariant(theme, atlas, models = {}, decals = true) {
  const vc = new Bag(), sign = new Bag(true), facade = new Bag(true, 0.16), bulbs = new Bag(), roof = new Bag(), decal = new Bag(true), shaft = new Bag(true);
  // building-top trim never casts: the walls under it are flat cards, so its shadow would float alone in the street
  const trim = new Bag();
  // soft baked contact shadows (ground under stalls, foot of the walls) - cheap depth on every quality level
  const blob = new Bag(true);
  const addBlob = (x, z, w, d, rot = 0) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); blob.add(g, null, x, 0.008, z, 0, rot, 0); };
  const glow = [];
  const placed = [];
  if (decals) scatterDecals(decal, theme);
  const stallModels = ['fruit', 'spice', 'sweets'].filter(n => models[n]);
  const lastModel = { [-1]: null, [1]: null };
  const vendorSpots = [];
  const night = theme === 'night', covered = theme === 'covered';

  // ground
  const ground = new THREE.PlaneGeometry(FACADE_X * 2 + 1, CHUNK, 1, 1);
  ground.rotateX(-Math.PI / 2); ground.translate(0, 0, -CHUNK / 2);
  const uv = ground.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (FACADE_X * 2 + 1) / 3.0, uv.getY(i) * CHUNK / 3.0);
  // raised stone curbs in front of the stalls with a darker gutter, and basalt bands between the lanes:
  // long lines converging on the horizon are the strongest depth cue a runner has
  for (const side of [-1, 1]) {
    vc.add(box(0.32, 0.14, CHUNK), '#e0d0ac', side * (STALL_X - 0.31), 0.07, -CHUNK / 2, 0, 0, 0, 1, 1, 1, 0);
    vc.add(box(0.22, 0.01, CHUNK), '#8f7f63', side * (STALL_X - 0.58), 0.005, -CHUNK / 2);
    vc.add(box(0.15, 0.008, CHUNK), '#a3927a', side * 1.2, 0.004, -CHUNK / 2);
  }

  // the buildings above the shops: laid out first so the shop signs can sit on each building's own face
  const blocks = { [-1]: layoutBuildings(covered), [1]: layoutBuildings(covered) };
  const frontAt = (side, d) => (blocks[side].find(b => d >= b.z0 && d < b.z0 + b.w) || blocks[side][0]).front;
  // a shopkeeper's tarp or tin sheet over the stalls in front of some buildings (the covered market has its roof)
  for (const side of [-1, 1]) for (const b of blocks[side]) b.canopy = !covered && Math.random() < 0.42;
  const barChance = night ? 0.3 : covered ? 0.16 : 0.06;
  for (const side of [-1, 1]) {
    let v = 0;
    while (v < CHUNK - 0.5) {
      const len = Math.min(CHUNK - v, pick([4.2, 4.6, 5.0]));
      const nightShut = night && Math.random() < 0.45;
      const gap = Math.random() < 0.18 && !nightShut;
      if (gap && models.truck && Math.random() < 0.4) {
        // a supplier's truck parked between the stalls, cab toward the runner
        const sz = models.truck.size, k = Math.min(2.1 / sz.z, (len - 0.5) / sz.x);
        placed.push(['truck', propMatrix(side * (STALL_X + 0.15 + sz.z * k / 2), -(v + len / 2), Math.PI / 2, k)]);
        addBlob(side * (STALL_X + 0.15 + sz.z * k / 2), -(v + len / 2), sz.z * k + 0.6, sz.x * k + 0.4);
      } else if (gap) {
        // alley / doorway between stalls with crates and sacks
        for (let i = 0; i < 3; i++) addCrate(vc, side, rnd(0.4, 1.4), i * 0.17, v, rnd(0.4, len - 0.4), 0.5, 0.4, pick(Object.keys(PRODUCE)));
        vc.add(sph(0.3, 7, 5).scale(1, 0.8, 0.8), '#b08968', side * (STALL_X + 1.6), 0.25, -(v + len / 2), 0, 0, 0, 1, 1, 1, 0.1);
      } else if (nightShut) {
        // closed shutter with painted mural (drawn on the facade layer), bar tables in front
        const ty = rnd(0, 1);
        for (let i = 0; i < 2; i++) {
          const tz = -(v + 1.2 + i * 2);
          vc.add(cyl(0.38, 0.38, 0.04, 14), '#2b2d42', side * (STALL_X + 0.9), 0.95, tz);
          vc.add(cyl(0.05, 0.05, 0.95, 6), '#8d99ae', side * (STALL_X + 0.9), 0.47, tz);
          for (const o of [-0.55, 0.55]) {
            vc.add(cyl(0.18, 0.18, 0.04, 10), '#d90429', side * (STALL_X + 0.9 + o * 0.3), 0.62, tz + o);
            vc.add(cyl(0.03, 0.03, 0.62, 5), '#8d99ae', side * (STALL_X + 0.9 + o * 0.3), 0.31, tz + o);
          }
          vc.add(cyl(0.04, 0.04, 0.22, 8), ty > 0.5 ? '#f9c74f' : '#90be6d', side * (STALL_X + 0.9), 1.08, tz);
        }
        addMural(facade, side, v, len);
        addSign(sign, atlas, atlas.pick('neon'), side * (FACADE_X - 0.05), 3.0, -(v + len / 2), side, 2.2, 0.55);
      } else if (Math.random() < barChance) {
        // a bar counter at the street with high stools on the curb and a chalkboard menu
        barStall({ vc, sign, bulbs, glow, atlas }, side, v + 0.15, len - 0.3);
        addSign(sign, atlas, atlas.pick(night ? 'neon' : 'shop'), side * (frontAt(side, v + len / 2) - 0.05), 3.75, -(v + len / 2), side, 2.4, 0.6);
      } else if (stallModels.length && Math.random() < 0.85) {
        // generated 3D stall, front facing the street; never the same model twice in a row
        let name = pick(stallModels);
        if (name === lastModel[side] && stallModels.length > 1) name = pick(stallModels.filter(n => n !== name));
        lastModel[side] = name;
        const sz = models[name].size;
        const k = Math.min((len - 0.3) / sz.z, 2.55 / sz.x, 3.3 / sz.y) * rnd(0.94, 1);
        placed.push([name, propMatrix(side * (STALL_X - 0.15 + sz.x * k / 2), -(v + len / 2), side < 0 ? 0 : Math.PI, k)]);
        addBlob(side * (STALL_X - 0.15 + sz.x * k / 2), -(v + len / 2), sz.x * k + 0.7, sz.z * k + 0.5);
        addSign(sign, atlas, atlas.pick('shop'), side * (frontAt(side, v + len / 2) - 0.05), 3.75, -(v + len / 2), side, 2.4, 0.6);
        // the stall keeper hawks from the curb in front of the counter, off to one end of it
        if (Math.random() < 0.22) vendorSpots.push([side * (STALL_X - 0.3), -(v + len * pick([0.22, 0.78])), 0.14]);
        // a cardboard sign taped to the counter front
        else if (Math.random() < 0.4) addCard(sign, atlas, side * (STALL_X - 0.2), rnd(0.5, 0.7), -(v + rnd(0.8, len - 0.8)), side);
      } else {
        const type = pick(STALL_TYPES);
        STALLS[type](vc, side, v + 0.2, len - 0.4, { sign, atlas });
        // open sacks of the dry goods on the pavement in front, each with its price stuck in it
        if (SACK_GOODS[type] && Math.random() < 0.75) sacks(vc, sign, atlas, side, v + 0.4, len - 0.8, SACK_GOODS[type]);
        // a handwritten cardboard sign on a stick in the produce
        if (Math.random() < 0.45) {
          const cz = -(v + rnd(0.9, len - 0.9));
          vc.add(box(0.02, 0.62, 0.02), '#8a6a45', side * (STALL_X + 0.32), 1.15, cz);
          addCard(sign, atlas, side * (STALL_X + 0.3), 1.6, cz, side);
        }
        // a roll of thin plastic bags hanging from the awning pole
        if (Math.random() < 0.5) bagRoll(vc, side * (STALL_X - 0.14), -(v + 0.32));
        const [a, b] = pick(AWNINGS);
        awning(vc, side, v + 0.2, len - 0.4, a, b);
        // shop sign above the awning on the building line
        addSign(sign, atlas, atlas.pick('shop'), side * (frontAt(side, v + len / 2) - 0.05), 3.75, -(v + len / 2), side, 2.4, 0.6);
        // price tags on the counter
        for (let i = 0; i < 2; i++) addPriceTag(sign, atlas, side, v + rnd(0.6, len - 0.6));
        // hanging bulbs under the awning
        for (let i = 0; i < 3; i++) {
          const bx = side * (STALL_X + 0.6 + i * 0.4), bz = -(v + len * (0.25 + i * 0.25)), by = 2.55;
          vc.add(cyl(0.006, 0.006, 0.5, 3), '#222', bx, by + 0.27, bz);
          bulbs.add(sph(0.055, 6, 4), null, bx, by, bz);
          glow.push(bx, by, bz);
        }
        if (Math.random() < 0.55) vendorSpots.push([side * (STALL_X + 1.95), -(v + len / 2)]);
        // perpendicular blade sign facing the runner
        if (Math.random() < 0.35) {
          const si = atlas.pick('shop');
          vc.add(box(0.04, 0.04, 1.0), '#333', side * (STALL_X + 0.1), 4.25, -(v + 0.5));
          addBlade(sign, atlas, si, side * (STALL_X + 0.1), 3.95, -(v + 0.5));
        }
      }
      // shopfront recess behind the stall
      vc.add(box(0.2, 3.4, len), night ? '#2a2233' : '#3b2e25', side * (FACADE_X + 0.1), 1.7, -(v + len / 2));
      vc.add(box(0.5, 0.25, len), '#d9c7a3', side * (FACADE_X - 0.1), 3.45, -(v + len / 2), 0, 0, 0, 1, 1, 1, 0.08);
      if (!nightShut && Math.random() < 0.6) vc.add(cyl(0.18, 0.18, len * 0.95, 10), '#8a9096', side * (FACADE_X - 0.15), 3.15, -(v + len / 2), Math.PI / 2, 0, 0);
      v += len;
    }
    for (const b of blocks[side]) {
      building({ facade, trim, sign, atlas }, side, b, covered);
      if (b.canopy) canopy(vc, side, b, sign, atlas);
    }
    // the blue enamel street-name plate on a corner
    if (Math.random() < 0.6) {
      const b = pick(blocks[side]);
      addSign(sign, atlas, atlas.pick('street'), side * (b.front - 0.04), GROUND_TOP + 0.62, -(b.z0 + 0.95), side, 1.0, 0.25);
    }
    // a chalkboard A-frame out on the pavement
    if (Math.random() < (night ? 0.25 : 0.4)) {
      const x = side * (STALL_X - 0.62), z = -rnd(3, CHUNK - 3);
      aFrame(sign, atlas, x, z);
      addBlob(x, z, 0.75, 0.75);
    }
  }

  // overhead: string lights and bunting zig-zagging across the street
  const crossings = covered ? 4 : 3;
  for (let k = 0; k < crossings; k++) {
    const z0 = -(k + 0.5) * CHUNK / crossings - rnd(-2, 2), z1 = z0 - rnd(2, 5);
    const n = 16, h = covered ? 5.6 : 6.4;
    const flags = !night && Math.random() < 0.5;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = -STALL_X - 1 + t * (STALL_X + 1) * 2, z = z0 + (z1 - z0) * t;
      const y = h - Math.sin(t * Math.PI) * 0.9;
      if (flags) {
        if (i < n) {
          const col = i % 2 ? '#1f5fbf' : '#ffffff';
          vc.add(cone(0.18, 0.4, 3).rotateX(Math.PI), col, x + 0.3, y - 0.25, z, 0, 0, 0, 1, 1, 0.2);
        }
      } else {
        bulbs.add(sph(0.07, 6, 4), null, x, y - 0.1, z);
        glow.push(x, y - 0.1, z);
      }
    }
    // the wire
    const wire = new THREE.CylinderGeometry(0.01, 0.01, (STALL_X + 1) * 2, 3);
    vc.add(wire, '#333', 0, h - 0.6, (z0 + z1) / 2, 0, -Math.atan2(z1 - z0, (STALL_X + 1) * 2), Math.PI / 2);
  }

  if (covered) {
    // steel arches and translucent roof panels of the covered market
    for (let k = 0; k < 5; k++) {
      const z = -(k + 0.5) * CHUNK / 5;
      const arch = new THREE.TorusGeometry(FACADE_X, 0.1, 4, 18, Math.PI);
      vc.add(arch, '#4a5560', 0, 6.4, z, 0, 0, 0, 1, 0.35, 1);
      vc.add(box(0.18, 0.18, CHUNK / 5), '#4a5560', 0, 6.4 + FACADE_X * 0.35, z - CHUNK / 10);
    }
    // sunlight slanting down through the glass in dusty shafts, along this zone's sun direction
    const sd = new THREE.Vector3(...THEMES.covered.sunDir).normalize();
    const tilt = Math.atan2(-sd.x, sd.y);
    for (let k = 0; k < 5; k++) {
      const len = rnd(6.5, 8), w = rnd(1.2, 2.2), x = rnd(-3.2, 3.2), z = -rnd(1, CHUNK - 1);
      const g = new THREE.PlaneGeometry(w, len);
      shaft.add(g, null, x + Math.sin(tilt) * len * 0.5, 8.2 - Math.cos(tilt) * len * 0.5, z, 0, rnd(-0.25, 0.25), tilt);
    }
    const panel = new THREE.CylinderGeometry(FACADE_X, FACADE_X, CHUNK, 16, 1, true, -Math.PI / 2, Math.PI);
    roof.add(panel, '#fff3d0', 0, 6.4, -CHUNK / 2, -Math.PI / 2, 0, 0, 1, 1, 0.35);
    // ceiling fans on long rods and clusters of bare bulbs between the arches
    const roofY = x => 6.4 + 0.35 * Math.sqrt(FACADE_X * FACADE_X - x * x);
    for (let k = 0; k < 3; k++) fan(vc, pick([-1.2, 0, 1.2]), 5.75, -(k * CHUNK / 3 + rnd(2.5, 7.5)), roofY);
    for (let k = 0; k < 9; k++) {
      const x = rnd(-3, 3), y = rnd(5.45, 6.2), z = -rnd(1, CHUNK - 1);
      vc.add(cyl(0.006, 0.006, roofY(x) - y, 3), '#1d1d1d', x, (roofY(x) + y) / 2, z);
      vc.add(cyl(0.025, 0.025, 0.06, 6), '#6b5a3a', x, y + 0.08, z);
      bulbs.add(sph(0.06, 6, 4).scale(1, 1.3, 1), null, x, y, z);
      glow.push(x, y, z);
    }
    // hanging lamps
    for (let k = 0; k < 4; k++) for (const lx of [-2.6, 2.6]) {
      const z = -(k + 0.3) * CHUNK / 4;
      vc.add(cyl(0.01, 0.01, 1.2, 3), '#222', lx, 6.8, z);
      vc.add(cone(0.3, 0.25, 10), '#2f3e46', lx, 6.15, z);
      bulbs.add(sph(0.1, 6, 4), null, lx, 6.0, z);
      glow.push(lx, 6.0, z);
    }
  }

  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(glow), 3));
  glowGeo.computeBoundingSphere();
  return {
    vc: vc.build(), trim: trim.build(), blob: blob.build(), sign: sign.build(), facade: facade.build(), bulbs: bulbs.build(), roof: roof.build(), decal: decal.build(), shaft: shaft.build(),
    ground, glowGeo, vendorSpots, theme, placed,
  };
}

// ground litter from the generated 3x3 decal atlas (img/decals.webp), read left-to-right, top-to-bottom
const DECALS = {
  manhole: [0, 0.95], grate: [1, 1.0], cardboard: [2, 1.15], cabbage: [3, 0.85], tomato: [4, 0.6],
  puddle: [5, 1.5], peels: [6, 0.75], slats: [7, 1.1], seeds: [8, 0.55],
};
function addDecal(bag, name, x, z, rot, scale = 1) {
  const [k, size] = DECALS[name];
  const c = k % 3, r = Math.floor(k / 3), m = 0.006;
  const g = new THREE.PlaneGeometry(size * scale, size * scale);
  setUV(g, [c / 3 + m, 1 - (r + 1) / 3 + m, 1 / 3 - 2 * m, 1 / 3 - 2 * m]);
  g.rotateX(-Math.PI / 2);
  bag.add(g, null, x, 0.004, z, 0, rot, 0);
}
function scatterDecals(bag, theme) {
  // a manhole or drain in a lane now and then, and market debris near the stalls
  if (Math.random() < 0.7) addDecal(bag, 'manhole', pick([-2.4, 0, 2.4]) + rnd(-0.3, 0.3), -rnd(3, CHUNK - 3), rnd(0, 6));
  for (const side of [-1, 1]) if (Math.random() < 0.6) addDecal(bag, 'grate', side * 3.75, -rnd(2, CHUNK - 2), Math.PI / 2);
  const litter = theme === 'night' ? ['cardboard', 'seeds', 'slats', 'puddle', 'peels', 'cabbage'] : ['cabbage', 'tomato', 'peels', 'cardboard', 'slats', 'seeds', 'puddle'];
  const n = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const name = pick(litter);
    const edge = Math.random() < 0.7;
    const x = edge ? pick([-1, 1]) * rnd(3.1, 4.0) : rnd(-3.2, 3.2);
    addDecal(bag, name, x, -rnd(1, CHUNK - 1), rnd(0, 6), rnd(0.85, 1.15));
  }
}

// ---------- buildings ----------
// Each side of a chunk is a row of separate buildings: own width, height (stepped rooflines), setback or
// overhang, stone tint and shutter colour, with real side walls, parapets, rooftop clutter and 3D relief
// lined up with the painted windows (5 columns per texture repeat; sills ~9% and ~63% up the stone).
const WIN_COLS = [0.107, 0.30, 0.50, 0.70, 0.90];
const STONE_TINTS = ['#ffffff', '#fff3df', '#f6e6cc', '#fde8da', '#ece6da', '#fff8ec', '#f2dcc0'];
const SHUTTERS = [null, null, '#3d72b0', '#2e8079', '#7d4a2a', '#a8392b', '#dcd6c8', '#56693d', '#3a4f7a'];
const GROUND_TOP = 3.58;

function layoutBuildings(covered) {
  const list = [];
  let z0 = 0;
  while (z0 < CHUNK - 0.01) {
    let w = rnd(6.5, 12.5);
    if (CHUNK - z0 - w < 4.5) w = CHUNK - z0;              // no slivers at the chunk end
    const fh = covered ? 6.5 : pick([7.8, 9.0, 9.5, 10.6, 11.6]);
    const set = covered ? 0 : pick([0, 0, 0.5, 0.95, -0.32]); // + set back, - overhangs the street
    list.push({ z0, w, fh, set, front: FACADE_X + set, tint: pick(STONE_TINTS), shutter: pick(SHUTTERS), off: Math.random() });
    z0 += w;
  }
  return list;
}

// per-vertex shutter recolour for the facade shader: rgb target, a = strength (0 keeps the painted green)
function shutterAttr(geo, color) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 4);
  if (color) { const c = new THREE.Color(color); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b, 1], i * 4); }
  geo.setAttribute('shutter', new THREE.BufferAttribute(a, 4));
  return geo;
}

function building({ facade, trim, sign, atlas }, side, b, covered) {
  const { z0, w, fh, front, tint, shutter, off } = b;
  const zc = -(z0 + w / 2), top = GROUND_TOP + fh, wx = side * front;
  const repeatW = fh * 1.79;                              // keeps the photo's aspect at any height
  // the face
  const fg = new THREE.PlaneGeometry(w, fh);
  setUV(fg, [off, 0.255, w / repeatW, 0.74]);
  facade.add(shutterAttr(fg, shutter), tint, wx, GROUND_TOP + fh / 2, zc, 0, -side * Math.PI / 2, 0);
  // the side wall facing the runner: shows wherever this building sticks out past, or rises above, the one before
  const sw = new THREE.PlaneGeometry(4.5, fh);
  setUV(sw, [0.004, 0.255, 0.045, 0.74]);
  facade.add(shutterAttr(sw, null), tint, side * (front + 2.25), GROUND_TOP + fh / 2, -z0 - 0.002, 0, 0, 0);
  // overhang soffit, or a first-floor terrace with a railing in front of a set-back building
  if (b.set < 0) trim.add(box(-b.set + 0.1, 0.2, w), '#d9c7a1', side * (FACADE_X + b.set / 2 - 0.05), GROUND_TOP + 0.1, zc);
  else if (b.set > 0.3) {
    trim.add(box(b.set, 0.14, w), '#dccaa4', side * (FACADE_X + b.set / 2), GROUND_TOP + 0.07, zc);
    const rx = side * (FACADE_X + 0.06);
    trim.add(box(0.05, 0.05, w), '#2d2b2e', rx, GROUND_TOP + 1.05, zc);
    for (let z = 0.15; z < w; z += 0.32) trim.add(box(0.03, 0.95, 0.03), '#2d2b2e', rx, GROUND_TOP + 0.55, -(z0 + z));
  }
  // pilaster at the near corner, cornice and parapet along the top
  trim.add(box(0.16, fh, 0.42), '#e4d3ae', side * (front - 0.08), GROUND_TOP + fh / 2, -(z0 + 0.21), 0, 0, 0, 1, 1, 1, 0.05);
  trim.add(box(0.42, 0.28, w + 0.1), '#d8c39a', side * (front - 0.15), top + 0.02, zc);
  trim.add(box(0.26, 0.62, w), '#e2d0a8', side * (front + 0.13), top + 0.45, zc, 0, 0, 0, 1, 1, 1, 0.06);
  if (!covered) rooftop(trim, side, b, top);
  // relief under/around the painted windows
  const rows = [GROUND_TOP + 0.0946 * fh, GROUND_TOP + 0.627 * fh];
  const winZ = [];
  for (let n = -1; n <= Math.ceil(w / repeatW) + 1; n++) for (let k = 0; k < WIN_COLS.length; k++) {
    const u = (WIN_COLS[k] + n - off) * repeatW;          // distance from this face's left edge
    if (u < 0.9 || u > w - 0.9) continue;
    const z = -(z0 + (side < 0 ? u : w - u));
    winZ.push(z);
    rows.forEach((y, row) => {
      if (covered && row === 1) return;                   // hidden behind the market roof
      if (row === 1 && k === 3) return;                   // this window already has a painted balcony
      trim.add(box(0.22, 0.09, 1.7), '#e4d3ae', wx - side * 0.11, y - 0.05, z);   // stone sill
      if (row === 0 && b.canopy) return;                  // the stall canopy sits right under these windows
      const r = Math.random();
      if (r < 0.26) {
        balcony(trim, side, wx, y - 0.12, z, row);
        // the classic hand-painted "for rent" board tied to the railing
        if (sign && Math.random() < 0.16) addSign(sign, atlas, atlas.pick('rent'), wx - side * 0.715, y + 0.62, z, side, 1.05, 0.26);
      } else if (r < 0.36 && row === 0) closedBalcony(trim, side, wx, y - 0.12, z);
      else if (r < 0.46) {
        // AC unit with a dark grille, beside the window
        const az = z + pick([-1, 1]) * 1.25;
        trim.add(box(0.36, 0.5, 0.78), '#eceae4', wx - side * 0.18, y + 0.9, az, 0, 0, 0, 1, 1, 1, 0.05);
        trim.add(box(0.02, 0.36, 0.6), '#5f646b', wx - side * 0.365, y + 0.9, az);
      }
    });
  }
  // a washing line strung between two windows
  if (winZ.length > 1 && Math.random() < 0.35) laundry(trim, side, wx, rows[Math.random() < 0.5 || covered ? 0 : 1] + 2.05, winZ[0], winZ[1]);
}

// solar water heaters (a tank on a frame with a tilted collector) - the Israeli roofline - plus dishes and antennas;
// they stand close to the parapet and tall enough to clear it in the runner's view
function rooftop(bag, side, b, top) {
  const n = b.w > 9 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const z = -(b.z0 + b.w * (n === 1 ? rnd(0.3, 0.7) : i ? rnd(0.6, 0.85) : rnd(0.15, 0.4)));
    const x = side * (b.front + 0.75);
    if (Math.random() < 0.8) {
      for (const dz of [-0.55, 0.55]) bag.add(box(0.06, 1.9, 0.06), '#8d8f92', x, top + 0.95, z + dz);
      bag.add(cyl(0.34, 0.34, 1.5, 10), '#f2f1ec', x, top + 2.15, z, Math.PI / 2, 0, 0);
      bag.add(box(1.0, 0.07, 1.5), '#1f3554', side * (b.front + 1.35), top + 1.45, z, 0, 0, side * 0.55);
    }
    if (Math.random() < 0.45) {
      const dz = z + pick([-1.4, 1.4]);
      bag.add(box(0.05, 1.4, 0.05), '#8d8f92', x, top + 1.3, dz);
      bag.add(cyl(0.42, 0.3, 0.12, 12), '#e9e7e2', x - side * 0.1, top + 2.05, dz, 0, 0, side * 1.05);
    }
    if (Math.random() < 0.4) {
      const dz = z + rnd(-1.8, 1.8);
      bag.add(box(0.04, 2.6, 0.04), '#55585c', x + side * 0.4, top + 1.9, dz);
      for (const h of [2.6, 2.95]) bag.add(box(0.03, 0.03, 0.9), '#55585c', x + side * 0.4, top + h, dz);
    }
  }
}

// an enclosed ("closed") balcony: a glazed box hung on the facade
function closedBalcony(bag, side, wx, y, z) {
  const d = 0.78, L = 2.2, H = 2.35;
  bag.add(box(d, 0.14, L), '#e6d4ab', wx - side * d / 2, y, z, 0, 0, 0, 1, 1, 1, 0.04);
  bag.add(box(d + 0.06, 0.14, L + 0.06), '#e6d4ab', wx - side * d / 2, y + H, z);
  bag.add(box(0.06, 0.9, L), '#efe7d6', wx - side * (d - 0.03), y + 0.5, z);
  bag.add(box(0.03, H - 1.0, L - 0.08), '#4f6f8f', wx - side * (d - 0.05), y + 0.95 + (H - 1.0) / 2, z);
  for (let i = 0; i <= 3; i++) bag.add(box(0.06, H - 0.95, 0.06), '#f4f1ea', wx - side * (d - 0.02), y + 0.95 + (H - 0.95) / 2, z - L / 2 + i * L / 3);
  for (const e of [-L / 2, L / 2]) bag.add(box(d, H, 0.05), '#efe7d6', wx - side * d / 2, y + H / 2, z + e);
}

// clothes pegged on a line between two windows
function laundry(bag, side, wx, y, za, zb) {
  const x = wx - side * 0.45, len = Math.abs(zb - za), zm = (za + zb) / 2;
  bag.add(box(0.015, 0.015, len), '#3b3b3b', x, y, zm);
  for (const z of [za, zb]) bag.add(box(0.45, 0.04, 0.04), '#6b6e72', wx - side * 0.22, y, z);
  const cols = ['#e63946', '#f1faee', '#457b9d', '#ffd23f', '#2a9d8f', '#f4a261', '#ffffff', '#6d597a'];
  for (let t = 0.12; t < 0.9; t += rnd(0.14, 0.22)) {
    const h = rnd(0.35, 0.7), wd = rnd(0.28, 0.5);
    bag.add(box(0.02, h, wd), pick(cols), x, y - h / 2 - 0.02, Math.min(za, zb) + len * t);
  }
}
function balcony(bag, side, wx, y, z, row) {
  const d = 0.72, L = row ? 2.1 : 2.3;
  bag.add(box(d, 0.13, L), '#e6d4ab', wx - side * d / 2, y, z, 0, 0, 0, 1, 1, 1, 0.04);
  for (const o of [-L * 0.32, L * 0.32]) bag.add(box(0.5, 0.22, 0.14), '#cdb68a', wx - side * 0.25, y - 0.17, z + o); // corbels
  const rail = '#2d2b2e', fx = wx - side * (d - 0.03);
  bag.add(box(0.04, 0.05, L), rail, fx, y + 0.95, z);
  for (const e of [-L / 2, L / 2]) bag.add(box(d, 0.05, 0.04), rail, wx - side * d / 2, y + 0.95, z + e);
  for (let i = 0; i <= 8; i++) bag.add(box(0.025, 0.88, 0.025), rail, fx, y + 0.5, z - L / 2 + 0.05 + i * (L - 0.1) / 8);
  if (Math.random() < 0.6) {
    // a geranium in a terracotta pot
    const pz = z + rnd(-0.7, 0.7);
    bag.add(cyl(0.13, 0.1, 0.22, 8), '#b5562e', wx - side * 0.35, y + 0.18, pz);
    bag.add(sph(0.2, 6, 4), pick(['#3f8f3a', '#2f7d32']), wx - side * 0.35, y + 0.42, pz);
    bag.add(sph(0.08, 5, 3), pick(['#e63946', '#f15bb5', '#ffd23f']), wx - side * 0.35, y + 0.55, pz + 0.05);
  }
}

function addSign(bag, atlas, idx, x, y, z, side, w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  setUV(g, atlas.uv[idx]);
  bag.add(g, null, x, y, z, 0, -side * Math.PI / 2, 0);
}
function addBlade(bag, atlas, idx, x, y, z, w = 1.2, h = 0.32) {
  for (const ry of [0, Math.PI]) {
    const g = new THREE.PlaneGeometry(w, h);
    setUV(g, atlas.uv[idx]);
    bag.add(g, null, x, y, z + (ry ? -0.01 : 0.01), 0, ry, 0);
  }
}
function addPriceTag(bag, atlas, side, v) {
  const idx = atlas.pick('price');
  const g = new THREE.PlaneGeometry(0.32, 0.12);
  const [u0, v0, du, dv] = atlas.uv[idx];
  setUV(g, [u0 + du * 0.15, v0, du * 0.7, dv]);
  bag.add(g, null, side * (STALL_X - 0.04), 0.65, -v, 0, -side * Math.PI / 2, 0);
}
function setUV(g, [u0, v0, du, dv]) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
}
// murals live in a separate atlas region of the facade material (bottom strip, see buildFacadeTexture)
function addMural(bag, side, v, len) {
  const g = new THREE.PlaneGeometry(len - 0.4, 3.0);
  const k = Math.floor(Math.random() * 3);
  const uv = g.attributes.uv;
  // facade texture: top 75% stone, bottom 25% three murals side by side
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (k + 0.02 + uv.getX(i) * 0.96) / 3, 0.005 + uv.getY(i) * 0.24);
  shutterAttr(g, null);
  bag.add(g, '#ffffff', side * (FACADE_X - 0.08), 1.6, -(v + len / 2), 0, -side * Math.PI / 2, 0);
}

// Facade material: the photo texture tinted per building (vertex colours), with the painted green shutters
// recoloured per building from the 'shutter' attribute.
function facadeMaterial(map) {
  const m = new THREE.MeshLambertMaterial({ map, vertexColors: true });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 shutter;\nvarying vec4 vShutter;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShutter = shutter;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vShutter;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 tx = sampledDiffuseColor.rgb;
          float gm = smoothstep(0.012, 0.05, tx.g - max(tx.r, tx.b)) * vShutter.a;
          float lum = dot(tx, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * vShutter.rgb * clamp(lum / 0.11, 0.35, 1.6), gm);
        }`);
  };
  return m;
}

// Tileable fractal value noise for the sky's clouds, generated once.
function cloudTexture() {
  const S = 256, data = new Uint8Array(S * S * 4);
  const grid = (n, seed) => { const g = new Float32Array(n * n); let s = seed; for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; } return g; };
  const octaves = [4, 8, 16, 32, 64].map((n, i) => ({ n, g: grid(n, 1234 + i * 77), a: 0.5 / (1 << i) }));
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    for (const { n, g, a } of octaves) {
      const fx = x / S * n, fy = y / S * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const at = (cx, cy) => g[((cy % n) * n) + (cx % n)];
      const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx, bot = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
      v += a * (top + (bot - top) * ty);
    }
    const o = (y * S + x) * 4, b = Math.round(Math.min(1, v / 0.97) * 255);
    data[o] = data[o + 1] = data[o + 2] = b; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// ---------- the World ----------
export class World {
  constructor(scene, renderer, images) {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.atlas = signAtlas(images.signs);
    this.variants = {};
    this.slots = [];
    this.vendorPool = [];
    this.vendorTemplates = [];
    this.propModels = {};

    const facadeTex = buildFacadeTexture(images, renderer.capabilities.getMaxAnisotropy());
    const pave = new THREE.Texture(images.paving); pave.needsUpdate = true;
    // ground litter is optional: without its atlas the street simply has none
    let decalTex = null;
    if (images.decals) {
      decalTex = new THREE.Texture(images.decals); decalTex.needsUpdate = true;
      decalTex.colorSpace = THREE.SRGBColorSpace; decalTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    pave.colorSpace = THREE.SRGBColorSpace; pave.wrapS = pave.wrapT = THREE.RepeatWrapping; pave.anisotropy = renderer.capabilities.getMaxAnisotropy();

    this.mats = {
      vc: shukLit(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })),
      sign: shukLit(new THREE.MeshBasicMaterial({ map: this.atlas.texture, side: THREE.DoubleSide, toneMapped: false })),
      facade: shukLit(facadeMaterial(facadeTex)),
      bulbs: new THREE.MeshBasicMaterial({ color: '#fff1c2', toneMapped: false }),
      roof: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
      ground: shukLit(new THREE.MeshLambertMaterial({ map: pave })),
      decal: shukLit(new THREE.MeshLambertMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
      blob: new THREE.MeshBasicMaterial({ map: softRectTexture(), color: '#1d1408', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
      shaft: new THREE.MeshBasicMaterial({ map: shaftTexture(), color: '#ffe0b0', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      glow: new THREE.PointsMaterial({ size: 1.15, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd28a', opacity: 0, sizeAttenuation: true, toneMapped: false }),
    };

    // sky dome with a 3-colour gradient
    this.skyUniforms = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, clouds: { value: 1 }, stars: { value: 0 }, time: { value: 0 }, cloudTex: { value: cloudTexture() } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 12), new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float clouds; uniform float stars; uniform float time; uniform sampler2D cloudTex; varying vec3 vP;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          float h = vP.y;
          vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.6, h)) : mix(bot, mid, smoothstep(-0.05, 0.08, h));
          vec2 uv = vP.xz / max(0.12, vP.y + 0.25) * 1.6 + vec2(time * 0.01, 0.);
          // precomputed tileable fbm (two lookups) instead of five octaves of procedural noise per pixel
          float n = texture2D(cloudTex, uv * 0.25).r * 0.75 + texture2D(cloudTex, uv * 0.53 + 0.37).r * 0.25;
          float cl = smoothstep(0.52, 0.78, n) * smoothstep(0.02, 0.2, h) * clouds;
          vec3 cloudCol = mix(vec3(1.0, 0.97, 0.92), mid * 1.25, 0.25);
          c = mix(c, cloudCol, cl * 0.85);
          vec2 sp = floor(vP.xz / max(0.05, vP.y) * 90.);
          float st = step(0.996, h21(sp)) * smoothstep(0.15, 0.5, h) * stars * (0.6 + 0.4 * sin(time * 3. + h21(sp + 3.) * 20.));
          c += vec3(st);
          gl_FragColor = vec4(c, 1.);
          // same output transform as built-in materials (a no-op into the High path's linear target)
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    sky.renderOrder = -1;
    this.sky = sky;
    scene.add(sky);

    this.hemi = new THREE.HemisphereLight('#fff', '#b59a75', 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -7; sc.right = 7; sc.top = 12; sc.bottom = -8; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun); scene.add(this.sun.target);
    // warm back light that outlines the runner and the people coming at you
    this.rim = new THREE.DirectionalLight('#ffd9a0', 1.2);
    scene.add(this.rim); scene.add(this.rim.target);
    this.playerLight = new THREE.PointLight('#ffcf8a', 0, 14, 1.6);
    scene.add(this.playerLight);
    // the street's static shadows, baked a chunk at a time (see light.js)
    this.bake = new SunBake(renderer, CHUNK);
    this._bounce = new THREE.Color();

    scene.fog = new THREE.Fog('#e6dccb', 45, 165);
    this.themeCols = {};
    for (const [name, t] of Object.entries(THEMES)) this.themeCols[name] = Object.fromEntries(COLOR_KEYS.map(k => [k, new THREE.Color(t[k])]));
    this.cur = { ...THEMES.day, sunDir: [...THEMES.day.sunDir] };
    for (const k of COLOR_KEYS) this.cur[k] = this.themeCols.day[k].clone();
    this.applyTheme(this.cur);
  }

  // Build the chunk variants. Done in steps so the loading bar can advance.
  *buildSteps() {
    for (const theme of THEME_ORDER) {
      this.variants[theme] = [];
      for (let i = 0; i < N_VARIANTS; i++) { this.variants[theme].push(buildVariant(theme, this.atlas, this.propModels, !!this.mats.decal.map)); yield; }
    }
  }

  setVendorTemplates(list) {
    this.vendorTemplates = list.filter(Boolean);
    for (const t of this.vendorTemplates) if (!t.userData.blob) { t.userData.blob = true; shukLitTree(t); t.add(makeContactShadow(0.95, 0.75)); }
  }
  // call before buildSteps(); missing models simply fall back to the procedural stalls
  setPropModels(map) { this.propModels = map; }

  makeSlot() {
    const g = new THREE.Group();
    const mk = (mat, shadow) => { const m = new THREE.Mesh(undefined, mat); m.receiveShadow = shadow; m.matrixAutoUpdate = false; m.frustumCulled = true; g.add(m); return m; };
    const slot = {
      group: g, startD: 0, variant: null,
      ground: mk(this.mats.ground, true), decal: mk(this.mats.decal, true), blob: mk(this.mats.blob, false), vc: mk(this.mats.vc, !!this.worldShadows), trim: mk(this.mats.vc, false), sign: mk(this.mats.sign, false),
      // vc also catches the runner's shadow on High (set in setShadows)
      facade: mk(this.mats.facade, false), bulbs: mk(this.mats.bulbs, false), roof: mk(this.mats.roof, false), shaft: mk(this.mats.shaft, false),
      glow: new THREE.Points(EMPTY_GEO, this.mats.glow), vendors: [], props: {}, propsLo: {}, far: null,
    };
    slot.glow.frustumCulled = false; slot.glow.matrixAutoUpdate = false;
    g.add(slot.glow);
    // what the baked sun shadows are made of
    for (const k of ['vc', 'trim', 'facade']) slot[k].layers.enable(STATIC_LAYER);
    this.group.add(g);
    return slot;
  }

  assign(slot, startD) {
    const { zone } = zoneAt(startD + 1);
    const list = this.variants[zone.theme];
    const v = list[Math.floor(Math.random() * list.length)];
    slot.startD = startD; slot.variant = v;
    for (const k of ['ground', 'blob', 'decal', 'vc', 'trim', 'sign', 'facade', 'bulbs', 'roof', 'shaft']) {
      const geo = v[k];
      slot[k].geometry = geo || EMPTY_GEO;
      slot[k].visible = !!geo;
    }
    slot.glow.geometry = v.glowGeo;
    // generated stall models: one instanced mesh per model type in each slot, plus a low-detail twin
    // (vertex colours, ~1k triangles) that stands in while the slot is far away
    const counts = {};
    const mk = (geometry, material, shadow) => {
      const im = new THREE.InstancedMesh(geometry, material, PROP_CAP);
      im.receiveShadow = shadow && !!this.worldShadows; im.matrixAutoUpdate = false;
      im.layers.enable(STATIC_LAYER);
      slot.group.add(im);
      return im;
    };
    for (const [name, m] of v.placed) {
      if (!slot.props[name]) {
        const pm = this.propModels[name];
        slot.props[name] = mk(pm.geometry, pm.material, true);
        if (pm.lo) slot.propsLo[name] = mk(pm.lo.geometry, pm.lo.material, false);
      }
      const i = counts[name] || 0;
      if (i >= PROP_CAP) continue;
      slot.props[name].setMatrixAt(i, m);
      if (slot.propsLo[name]) slot.propsLo[name].setMatrixAt(i, m);
      counts[name] = i + 1;
    }
    for (const set of [slot.props, slot.propsLo]) for (const [name, im] of Object.entries(set)) {
      im.count = counts[name] || 0;
      im.instanceMatrix.needsUpdate = true;
      if (im.count) im.computeBoundingSphere();
    }
    slot.far = null; // let update() pick the detail level
    // vendors standing behind some counters
    for (const vd of slot.vendors) { vd.visible = false; this.vendorPool.push(vd); }
    slot.vendors.length = 0;
    if (this.vendorTemplates.length) {
      for (const [x, z, y = 0] of v.vendorSpots) {
        let m = this.vendorPool.pop();
        if (!m) { m = pick(this.vendorTemplates).clone(); m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); }
        m.visible = true;
        m.position.set(x, y, z);
        m.userData.y0 = y;
        m.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        m.userData.phase = Math.random() * 6;
        slot.group.add(m);
        slot.vendors.push(m);
      }
    }
    // re-bake this chunk's sun shadows, and the one before it: low sun throws shadows across the seam
    this.bake.request(slot);
    const prev = this.slots.find(o => o.startD === startD - CHUNK && o.variant);
    if (prev) this.bake.request(prev);
  }

  reset(runD = 0) {
    if (!this.slots.length) for (let i = 0; i < 7; i++) this.slots.push(this.makeSlot());
    this.bake.clear();
    const base = Math.floor((runD - CHUNK) / CHUNK) * CHUNK;
    this.slots.forEach((s, i) => this.assign(s, base + i * CHUNK));
  }

  update(dt, runD, playerPos, time) {
    // recycle chunks that are behind the camera
    for (const s of this.slots) {
      if (s.startD + CHUNK < runD - 12) {
        const maxStart = Math.max(...this.slots.map(o => o.startD));
        this.assign(s, maxStart + CHUNK);
      }
      s.group.position.z = -(s.startD - runD);
      s.group.updateMatrixWorld();
      // distant chunks: low-detail stalls and no stall keepers (they would be a few pixels tall)
      const far = s.startD - runD > LOD_DIST;
      if (far !== s.far) {
        s.far = far;
        for (const [name, im] of Object.entries(s.props)) {
          const lo = s.propsLo[name];
          im.visible = im.count > 0 && !(far && lo);
          if (lo) lo.visible = lo.count > 0 && far;
        }
        for (const m of s.vendors) m.visible = !far;
      }
      if (!far) for (const m of s.vendors) m.position.y = m.userData.y0 + Math.abs(Math.sin(time * 2 + m.userData.phase)) * 0.04;
    }
    // theme blending by distance
    const { zone } = zoneAt(runD);
    const k = 1 - Math.exp(-dt * 1.2);
    this.lerpTheme(zone.theme, k);
    // sun & shadow follow the player
    const sd = this.cur.sunDir;
    this.sun.position.set(playerPos.x + sd[0] * 20, sd[1] * 20, playerPos.z + sd[2] * 20 - 6);
    this.sun.target.position.set(playerPos.x, 0, playerPos.z - 6);
    this.sky.position.set(0, 0, playerPos.z);
    this.skyUniforms.time.value = time;
    this.rim.position.set(playerPos.x - 2, 6, playerPos.z - 14);
    this.rim.target.position.set(playerPos.x, 1, playerPos.z);
    this.playerLight.position.set(playerPos.x, playerPos.y + 3.2, playerPos.z + 1.5);
    // bake waiting shadow tiles now that every chunk sits where it is drawn: all of them after a reset,
    // otherwise one per frame so recycling a chunk never costs a visible hitch
    SHUK.shukRunD.value = runD;
    const q = this.bake.queue.length;
    if (q) this.bake.process(this.scene, runD, s => THEMES[s.variant.theme].sunDir, q > 2 ? q : 1);
  }

  lerpTheme(name, k) {
    const c = this.cur, t = THEMES[name], tc = this.themeCols[name];
    for (const key of COLOR_KEYS) c[key].lerp(tc[key], k);
    for (const key of NUM_KEYS) c[key] += (t[key] - c[key]) * k;
    for (let i = 0; i < 3; i++) c.sunDir[i] += (t.sunDir[i] - c.sunDir[i]) * k;
    this.applyTheme(c);
  }

  // jump straight to a zone's look (used when a run starts)
  snapTheme(name) {
    const t = THEMES[name];
    for (const key of COLOR_KEYS) this.cur[key].copy(this.themeCols[name][key]);
    for (const key of NUM_KEYS) this.cur[key] = t[key];
    this.cur.sunDir = [...t.sunDir];
    this.applyTheme(this.cur);
  }

  applyTheme(c) {
    this.skyUniforms.top.value.copy(c.skyTop); this.skyUniforms.mid.value.copy(c.skyMid); this.skyUniforms.bot.value.copy(c.skyBot);
    this.skyUniforms.clouds.value = c.clouds; this.skyUniforms.stars.value = c.stars;
    this.rim.intensity = c.rim;
    this.scene.fog.color.copy(c.fog); this.scene.fog.near = c.fogNear; this.scene.fog.far = c.fogFar;
    this.hemi.color.copy(c.hemiSky); this.hemi.groundColor.copy(c.hemiGround); this.hemi.intensity = c.hemi;
    this.sun.color.copy(c.sun); this.sun.intensity = c.sunI;
    this.mats.facade.color.copy(c.facade);
    this.mats.bulbs.color.copy(c.bulbs);
    this.mats.glow.opacity = c.glow;
    this.renderer.toneMappingExposure = c.exposure;
    this.playerLight.intensity = c.playerLight * 6;
    const sd = c.sunDir;
    SHUK.shukSunDir.value.set(sd[0], sd[1], sd[2]).normalize();
    SHUK.shukAO.value.x = c.canyon; SHUK.shukAO.value.y = c.aoFloor;
    SHUK.shukBounce.value.copy(c.sun).multiplyScalar(c.sunI * c.bounce).multiply(this._bounce.set('#ecc89a'));
    SHUK.shukSignShade.value = c.signShade;
  }

  // The per-frame shadow map only holds what moves (runner, walkers, obstacles): the street's own shadows are
  // baked. On High the stalls catch those moving shadows too; otherwise just the street does.
  setShadows(on, receive = false, size = 1024) {
    this.sun.castShadow = on;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.worldShadows = on && receive;
    for (const s of this.slots) {
      s.vc.receiveShadow = this.worldShadows;
      for (const im of Object.values(s.props)) im.receiveShadow = this.worldShadows;
    }
  }

  // baked shadow resolution: texels per tile width (0 = off)
  setBake(tileW) {
    if (this.bake.setSize(tileW)) for (const s of this.slots) if (s.variant) this.bake.request(s);
  }
}

const EMPTY_GEO = new THREE.BufferGeometry();
const COLOR_KEYS = ['skyTop', 'skyMid', 'skyBot', 'fog', 'hemiSky', 'hemiGround', 'sun', 'facade', 'bulbs'];
const NUM_KEYS = ['fogNear', 'fogFar', 'hemi', 'sunI', 'glow', 'exposure', 'playerLight', 'clouds', 'stars', 'rim', 'canyon', 'aoFloor', 'bounce', 'signShade'];

// Facade texture: stone photo on top 3/4, three shutter murals across the bottom 1/4.
function buildFacadeTexture(images, maxAniso) {
  const W = 2048, H = 2048;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(images.facade, 0, 0, W, H * 0.75);
  const murals = images.murals || [];
  for (let k = 0; k < 3; k++) {
    const x = k * W / 3, y = H * 0.75, w = W / 3, h = H * 0.25;
    if (murals[k]) {
      const im = murals[k];
      // crop the centre of the mural to the cell aspect
      const ar = w / h, iar = im.width / im.height;
      let sw = im.width, sh = im.height, sx = 0, sy = 0;
      if (iar > ar) { sw = im.height * ar; sx = (im.width - sw) / 2; } else { sh = im.width / ar; sy = (im.height - sh) / 2; }
      g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
    } else {
      g.fillStyle = ['#2a9d8f', '#e76f51', '#9b5de5'][k]; g.fillRect(x, y, w, h);
    }
    g.fillStyle = 'rgba(0,0,0,.18)';
    for (let s = 0; s < h; s += 16) g.fillRect(x, y + s, w, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
  return t;
}
