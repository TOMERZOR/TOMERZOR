// Builds the static city: ground, streets, street furniture and every building.
// Zone-specific content lives in zones.js; this file owns the shared building blocks.
import * as THREE from 'three';
import { Chunk, rgb, shade, mix } from './geo.js';
import { WIN, drawSign, drawPoster, drawGraffiti } from './textures.js';
import { Rng } from '../core/util.js';
import {
  XS, ZS, SIDEWALK, CURB, roads, roadW, blocks, setPOI, WORLD_HALF, onRoad,
} from './map.js';
import { fillZone, buildOutskirts } from './zones.js';

export const FH = 2.95;                       // storey height
const PAL = ['#e9dfc8', '#dccaa4', '#d3d0c7', '#e2c6b6', '#e4d69c', '#c4d6d0', '#ecebe4', '#e3c79e', '#d9d2bd'].map(rgb);
const TRIM = ['#2f7f86', '#b5523a', '#3d5f9e', '#6d7f3c', '#8a6a3a', '#7a7f85', '#c7a23a'].map(rgb);
const CLOTH = ['#e5412d', '#f3efe6', '#2a6bff', '#f5b301', '#1f8a8a', '#ff7ab6', '#222831', '#7a4bd1', '#3aa35b', '#fdfdfd', '#d9d2bd'].map(rgb);
const GRAF = ['שכונה ד׳ לנצח', 'ד׳', 'מוות לחובות', 'אמא אני בסדר', 'פה גרים בכיף', 'נהוראי + ?', 'רק הפועל', 'אין כניסה לפקחים',
  'חאלס', 'ועד בית = מאפיה', 'מי שקורא חייב לי 50', 'עמידר תתקנו', 'אחי', 'ביבי בוז׳י שניהם', 'ג׳ = 0', 'סבתא רואה הכל'];
const GRAF_G = ['שכונה ג׳ שולטת', 'ג׳', 'ד׳ = פארש', 'רק ג׳', 'אזור שלנו'];

// Yaw that turns each generated model's street side to local +Z (found by looking at them).
const CIVIC = { school: 'b_school', police: 'b_police', wedding: 'b_wedding', bituach: 'b_bituach', city: 'b_city', matnas: 'b_matnas' };
const HANGAR = { garage: 'b_garage', scrap: 'b_scrap', depot: 'b_hangarA', moshav: 'b_hangarB' };
const FACE = {};
// name -> sign sheet (assets/tex/<tex>.webp, boards stacked top to bottom) and each board's
// [u0, u1, v0, v1] on the model's front: u along its length left to right, v up its height.
const SIGNS = {
  b_shops: { tex: 'signs_shops', rects: [[0.03, 0.28, 0.555, 0.67], [0.295, 0.5, 0.555, 0.67], [0.52, 0.705, 0.555, 0.67], [0.72, 0.97, 0.555, 0.67]] },
  b_shops2: { tex: 'signs_shops2', rects: [[0.03, 0.277, 0.545, 0.675], [0.29, 0.5, 0.545, 0.675], [0.52, 0.732, 0.545, 0.675], [0.753, 0.97, 0.545, 0.675]] },
  b_garage: { tex: 'signs_wide', n: 8, rects: [[0.17, 0.84, 0.66, 0.84, 0]] },
  b_scrap: { tex: 'signs_wide', n: 8, rects: [[0.17, 0.83, 0.52, 0.74, 1]] },
  b_hangarA: { tex: 'signs_wide', n: 8, rects: [[0.3, 0.72, 0.66, 0.8, 2]] },
  b_hangarB: { tex: 'signs_wide', n: 8, rects: [[0.255, 0.79, 0.7, 0.82, 3]] },
  b_gas: { tex: 'signs_wide', n: 8, rects: [[0.28, 0.72, 0.775, 0.895, 4]] },
  b_wedding: { tex: 'signs_wide', n: 8, rects: [[0.23, 0.77, 0.755, 0.895, 5]] },
  b_matnas: { tex: 'signs_wide', n: 8, rects: [[0.18, 0.51, 0.335, 0.425, 6]] },
  b_bituach: { tex: 'signs_wide', n: 8, rects: [[0.31, 0.68, 0.235, 0.315, 7]] },
  b_police: { tex: 'signs_civic', n: 6, rects: [[0.35, 0.615, 0.265, 0.345, 0]] },
  b_city: { tex: 'signs_civic', n: 6, rects: [[0.27, 0.61, 0.31, 0.41, 1]] },
  b_school: { tex: 'signs_civic', n: 6, rects: [[0.8, 0.97, 0.43, 0.53, 2]] },
  b_tower: { tex: 'signs_civic', n: 6, rects: [[0.3, 0.72, 0.14, 0.17, 3]] },
  b_shops3: { tex: 'signs_shops3', rects: [[0.06, 0.277, 0.5, 0.645], [0.31, 0.497, 0.5, 0.645], [0.52, 0.702, 0.5, 0.645], [0.74, 0.932, 0.5, 0.645]] },
};

export class CityBuilder {
  constructor(gfx, mats, physics, models) {
    this.gfx = gfx; this.mats = mats; this.M = mats.M; this.physics = physics; this.models = models || {};
    this.chunks = [];
    this.parking = [];        // {x,z,yaw,kind}
    this.lamps = [];          // {x,y,z,warm}
    this.footprints = [];     // for the map: {x,z,hw,hd,yaw,kind}
    this.seats = [];          // benches and chairs NPCs can idle at
    this.hang = [];           // places where people stand around: {x,z,r,kind}
    this.cats = [];
    this.props = [];          // knockable street props {type,x,z,yaw}
    this.group = new THREE.Group(); this.group.name = 'city';
    this.rng = new Rng(4120);
    this._m = new THREE.Matrix4();
    this.grafCache = new Map();
    this.stain = mats.decals.add(48, 192, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(70,50,30,0.55)'); gr.addColorStop(1, 'rgba(70,50,30,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.3, 0); g.lineTo(w * 0.7, 0); g.lineTo(w * 0.9, h); g.lineTo(w * 0.1, h); g.fill();
    });
    this.oil = mats.decals.add(96, 96, (g, w, h) => {
      const r = new Rng(3);
      for (let i = 0; i < 9; i++) { const x = r.f(20, w - 20), y = r.f(20, h - 20), q = r.f(8, 26); const gr = g.createRadialGradient(x, y, 0, x, y, q); gr.addColorStop(0, 'rgba(15,15,18,0.6)'); gr.addColorStop(1, 'rgba(15,15,18,0)'); g.fillStyle = gr; g.fillRect(x - q, y - q, q * 2, q * 2); }
    });
  }

  chunk(id) { const c = new Chunk(id); this.chunks.push(c); return c; }
  solid(x, z, hw, hd, yaw = 0, y1 = 40, y0 = 0, tag) { return this.physics.addBox(x, z, hw, hd, yaw, { y0, y1, tag }); }
  foot(x, z, hw, hd, yaw, kind) { this.footprints.push({ x, z, hw, hd, yaw: yaw || 0, kind: kind || 'b' }); }
  // local (lx, lz) of a frame at (x,z,yaw) -> world
  at(x, z, yaw, lx, lz) { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + lx * c + lz * s, z - lx * s + lz * c]; }

  sign(o, w = 384, h = 96) {
    const k = 's' + w + 'x' + h + JSON.stringify(o);
    if (!this.grafCache.has(k)) this.grafCache.set(k, this.mats.signs.add(w, h, (g, ww, hh) => drawSign(g, ww, hh, o)));
    return this.grafCache.get(k);
  }
  poster(o, w = 150, h = 200) {
    const k = 'p' + o.text;
    if (!this.grafCache.has(k)) { const r = new Rng((o.text.length * 131 + w) | 0); this.grafCache.set(k, this.mats.signs.add(w, h, (g, ww, hh) => drawPoster(g, ww, hh, o, r))); }
    return this.grafCache.get(k);
  }
  graffiti(text, color) {
    const k = text + color;
    if (!this.grafCache.has(k)) {
      const r = new Rng(text.length * 77 + color.length);
      this.grafCache.set(k, this.mats.decals.add(Math.min(512, 60 + text.length * 34), 96, (g, w, h) => drawGraffiti(g, w, h, text, color, r)));
    }
    return this.grafCache.get(k);
  }
  tag(ch, x, z, yaw, lx, y, out, rng, gimel) {
    const t = rng.pick(gimel ? GRAF_G : GRAF);
    const col = rng.pick(gimel ? ['#6b2bb8', '#111', '#8a3fe0'] : ['#111318', '#b3261e', '#1b3fa0', '#0f6b5c', '#222']);
    const rect = this.graffiti(t, col);
    const w = Math.min(4.2, 0.5 + t.length * 0.26);
    ch.get('decal').panel(x, z, yaw, lx, y, w, 0.8, out, rect);
  }

  // ---- Street furniture ----------------------------------------------------
  lamp(ch, x, z, yaw, warm = true, tall = 8) {
    if (this.models.e_lamp) {
      const [ax, az] = this.at(x, z, yaw, 0, 1.1);
      this.stand(ch, 'e_lamp', (x + ax) / 2, (z + az) / 2, yaw, tall + 0.25);
      ch.get('glow').floor(ax, CURB + 0.035, az, 17, 17, 0, [0, 0, 1, 1], warm ? [1, 0.62, 0.28] : [0.72, 0.82, 1]);
      this.lamps.push({ x: ax, y: tall - 0.3, z: az, warm });
      this.solid(x, z, 0.14, 0.14, 0, 3);
      return;
    }
    const grey = rgb('#7d8388');
    ch.get('paint').cyl(x, CURB, z, 0.11, 0.07, tall, 6, shade(grey, 0.8), grey, false);
    const [ax, az] = this.at(x, z, yaw, 0, 1.1);
    ch.get('paint').box((x + ax) / 2, tall - 0.08, (z + az) / 2, 0.09, 0.09, 1.3, yaw, { c: grey });
    ch.get('paint').box(ax, tall - 0.2, az, 0.34, 0.14, 0.7, yaw, { c: shade(grey, 0.75) });
    const col = warm ? rgb('#ffb45a') : rgb('#e8f1ff');
    ch.get('bulb').floor(ax, tall - 0.215, az, 0.26, 0.56, yaw, [0, 0, 1, 1], col);
    // the bulb faces down: add it double sided by flipping
    const b = ch.get('bulb'); const k = b.count - 4; b.i.push(k, k + 2, k + 1, k, k + 3, k + 2);
    ch.get('glow').floor(ax, CURB + 0.035, az, 17, 17, 0, [0, 0, 1, 1], warm ? [1, 0.62, 0.28] : [0.72, 0.82, 1]);
    this.lamps.push({ x: ax, y: tall - 0.3, z: az, warm });
    this.solid(x, z, 0.14, 0.14, 0, 3);
  }

  tree(ch, x, z, s = 1, rng = this.rng, kind = 'ficus') {
    if (this.models.e_ficus) {
      const hgt = (kind === 'euc' ? 9.5 : kind === 'bush' ? 3.2 : 6.4) * s * rng.f(0.9, 1.12);
      const mdl = kind === 'euc' && this.models.e_euc ? 'e_euc' : kind === 'bush' && this.models.e_bush ? 'e_bush' : 'e_ficus';
      this.stand(ch, mdl, x, z, rng.f(6.28), hgt);
      this.solid(x, z, 0.3 * s, 0.3 * s, 0, 2.6 * s);
      return;
    }
    const y = CURB;
    const bark = kind === 'euc' ? rgb('#b8ae9a') : rgb('#5b4a3a');
    const th = (kind === 'euc' ? 5.2 : 2.6) * s;
    ch.get('paint').cyl(x, y, z, 0.24 * s, 0.16 * s, th, 6, shade(bark, 0.7), bark, false);
    const n = kind === 'euc' ? 5 : 4;
    const base = kind === 'euc' ? rgb('#7f9a78') : kind === 'bush' ? rgb('#c2307f') : rgb('#6f9150');
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const r = (kind === 'euc' ? 1.5 : 1.9) * s * rng.f(0.75, 1.15);
      const ox = rng.f(-1.3, 1.3) * s, oz = rng.f(-1.3, 1.3) * s, oy = th + rng.f(-0.2, 1.5) * s + (kind === 'euc' ? i * 0.7 : 0);
      m.makeScale(r, r * (kind === 'euc' ? 1.25 : 0.82), r).setPosition(x + ox, y + oy, z + oz);
      ch.get('leaf').add(CityBuilder.blob(), m, shade(base, rng.f(0.72, 1.12)));
    }
    this.solid(x, z, 0.22 * s, 0.22 * s, 0, th);
  }
  static blob() {
    if (!CityBuilder._blob) {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position; const r = new Rng(12);
      // lumpy, and darker underneath
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const k = 1 + (Math.sin(p.getX(i) * 5.1) + Math.sin(p.getY(i) * 4.3 + 1) + Math.sin(p.getZ(i) * 6.7 + 2)) * 0.06;
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
        const sh = 0.62 + 0.38 * Math.max(0, p.getY(i) * 0.5 + 0.5); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = sh;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
      CityBuilder._blob = g;
    }
    return CityBuilder._blob;
  }

  palm(ch, x, z, h = 8, rng = this.rng) {
    if (this.models.e_palm) {
      this.stand(ch, 'e_palm', x, z, rng.f(6.28), h + 2.6);
      this.solid(x, z, 0.3, 0.3, 0, h);
      return;
    }
    const y = CURB, bark = rgb('#7a6650');
    let px = x, pz = z; const lean = rng.f(-0.25, 0.25), la = rng.f(6.28);
    const segs = 4;
    for (let i = 0; i < segs; i++) {
      const r0 = 0.3 - i * 0.03, r1 = r0 - 0.03;
      ch.get('paint').cyl(px, y + (h / segs) * i, pz, r0, r1, h / segs + 0.02, 7, shade(bark, 0.75 + i * 0.05), shade(bark, 0.8 + i * 0.05), false);
      px += Math.cos(la) * lean * (i / segs); pz += Math.sin(la) * lean * (i / segs);
    }
    const top = y + h, fr = ch.get('frond');
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.f(-0.2, 0.2), len = rng.f(3.0, 3.9), droop = rng.f(0.5, 1.7), up = rng.f(0.5, 1.3);
      const dx = Math.cos(a), dz = Math.sin(a), sx = -dz * 0.62, sz = dx * 0.62;
      const m0 = [px, top, pz], m1 = [px + dx * len * 0.5, top + up, pz + dz * len * 0.5], m2 = [px + dx * len, top + up - droop, pz + dz * len];
      const g = shade([1, 1, 1], rng.f(0.75, 1.05));
      fr.quad([m0[0] - sx * 0.3, m0[1], m0[2] - sz * 0.3], [m0[0] + sx * 0.3, m0[1], m0[2] + sz * 0.3], [m1[0] + sx, m1[1], m1[2] + sz], [m1[0] - sx, m1[1], m1[2] - sz], [0, 0, 1, 0.5], g);
      fr.quad([m1[0] - sx, m1[1], m1[2] - sz], [m1[0] + sx, m1[1], m1[2] + sz], [m2[0] + sx * 0.5, m2[1], m2[2] + sz * 0.5], [m2[0] - sx * 0.5, m2[1], m2[2] - sz * 0.5], [0, 0.5, 1, 1], g);
    }
    this.solid(x, z, 0.3, 0.3, 0, h);
  }

  bench(ch, x, z, yaw) {
    const wood = rgb('#8a5f3c'), iron = rgb('#3c4146');
    const P = (this.fit(ch, 'e_bench', x, z, yaw, 1.9, 0.7, 0.95) ? new Chunk('void') : ch).get('paint');
    P.box(x, CURB + 0.42, z, 1.8, 0.06, 0.5, yaw, { c: wood });
    const [bx, bz] = this.at(x, z, yaw, 0, -0.27);
    P.box(bx, CURB + 0.5, bz, 1.8, 0.5, 0.06, yaw, { c: wood });
    for (const s of [-0.75, 0.75]) { const [lx, lz] = this.at(x, z, yaw, s, 0); P.box(lx, CURB, lz, 0.07, 0.44, 0.46, yaw, { c: iron }); }
    this.solid(x, z, 0.9, 0.3, yaw, 0.9);
    const [sx, sz] = this.at(x, z, yaw, 0, 0.1);
    this.seats.push({ x: sx, z: sz, yaw, kind: 'bench' });
  }

  fence(ch, x0, z0, x1, z1, h = 2, solid = true) {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    ch.get('fence').panel(cx, cz, yaw, 0, CURB, len, h, 0, [0, 0, len / 0.5, h / 0.5], [0.9, 0.9, 0.9]);
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) ch.get('paint').cyl(x0 + ((x1 - x0) * i) / n, CURB, z0 + ((z1 - z0) * i) / n, 0.04, 0.04, h + 0.05, 5, rgb('#7b8085'), undefined, false);
    if (solid) this.solid(cx, cz, len / 2, 0.08, yaw, h);
  }

  // Low wall, optionally with a painted colour.
  wall(ch, x0, z0, x1, z1, h = 1, t = 0.2, col = PAL[2], mat = 'plaster') {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    ch.get(mat).box(cx, CURB, cz, len, h, t, yaw, { c: shade(col, 0.82), cTop: col, s: 3 });
    this.solid(cx, cz, len / 2, t / 2, yaw, h);
  }

  // A model baked into the chunk (static props: dumpsters, ATMs, plastic chairs).
  model(ch, name, x, z, yaw, size, y = CURB) {
    const md = this.models[name];
    if (!md) return false;
    const m = new THREE.Matrix4().makeRotationY(yaw + (md.yaw || 0));
    const k = size / md.len;
    m.scale(new THREE.Vector3(k, k, k)); m.setPosition(x, y - md.minY * k, z);
    const key = 'mdl_' + name;
    if (!this.M[key]) { this.M[key] = md.material; }
    ch.get(key).add(md.geometry, m.multiply(md.matrix));
    return true;
  }
  // The generator always returns a model with its photographed front towards +X. Returns the
  // turn that brings that front to local +Z, and the model's extent along and across the street.
  frame(name, md) {
    if (md.size.x > md.size.z * 1.3) return [(FACE[name] || 0), md.size.x, md.size.z];      // lying along X: front is a long side
    return [-Math.PI / 2 + (FACE[name] || 0), md.size.z, md.size.x];
  }
  // A generated model stretched to a box: len along local X, dep along local Z, hgt up.
  // FACE turns each model so its street side looks along local +Z.
  fit(ch, name, x, z, yaw, len, dep, hgt, y = CURB) {
    const md = this.models[name];
    if (!md) return false;
    const [turn, L, D] = this.frame(name, md);
    const pre = new THREE.Matrix4().makeRotationY(turn), ky = hgt / md.size.y;
    const m = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeScale(len / L, ky, dep / D));
    m.setPosition(x, y - md.minY * ky, z);
    const key = 'mdl_' + name;
    if (!this.M[key]) { this.M[key] = md.material; if (/^b_(block|tower|bituach|city|police|school|matnas)/.test(name)) this.mats.lightWindows(md.material, name === 'b_tower' ? 0.5 : 0.38); }
    ch.get(key).add(md.geometry, m.multiply(pre).multiply(md.matrix));
    this.boards(ch, name, md, x, z, yaw, len / L, ky, dep / D, y);
    return true;
  }
  // The 3D generator repaints lettering and gets Hebrew wrong, so each sign on a model is
  // covered by a board carrying the sign as it was designed. SIGNS gives each board's place on
  // the model's front (fractions of its length and height); how far forward that spot sits is
  // measured once per model by casting rays at the mesh.
  boards(ch, name, md, x, z, yaw, kx, ky, kz, y) {
    const def = SIGNS[name];
    if (!def || !this.M['sgn_' + def.tex]) return;
    if (!md.boards) {
      const [turn, L] = this.frame(name, md);
      const probe = new THREE.Mesh(md.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      probe.matrixAutoUpdate = false; probe.matrix.copy(new THREE.Matrix4().makeRotationY(turn).multiply(md.matrix)); probe.matrixWorld.copy(probe.matrix);
      const ray = new THREE.Raycaster(), dir = new THREE.Vector3(0, 0, -1), o = new THREE.Vector3();
      md.boards = def.rects.map(([u0, u1, v0, v1, band], i) => {
        let front = -Infinity;
        for (const fu of [0.03, 0.15, 0.3, 0.5, 0.7, 0.85, 0.97]) for (const fv of [0.1, 0.5, 0.9]) {
          o.set((u0 + (u1 - u0) * fu - 0.5) * L, md.minY + (v0 + (v1 - v0) * fv) * md.size.y, 50);
          ray.set(o, dir); const hit = ray.intersectObject(probe, false)[0];
          if (hit) front = Math.max(front, hit.point.z);
        }
        return { x0: (u0 - 0.5) * L, x1: (u1 - 0.5) * L, y0: v0 * md.size.y, y1: v1 * md.size.y, z: front, i: band === undefined ? i : band };
      }).filter((b) => b.z > -Infinity);
    }
    const B = ch.get('sgn_' + def.tex), n = def.n || def.rects.length;
    for (const b of md.boards) {
      const lz = b.z * kz + 0.06, ya = y + b.y0 * ky, yb = y + b.y1 * ky;
      const [ax, az] = this.at(x, z, yaw, b.x0 * kx, lz), [bx, bz] = this.at(x, z, yaw, b.x1 * kx, lz);
      B.quad([ax, ya, az], [bx, ya, bz], [bx, yb, bz], [ax, yb, az], [0, 1 - (b.i + 1) / n, 1, 1 - b.i / n]);
    }
  }
  // A generated building scaled as a whole so its long side is `len`: proportions stay the architect's.
  // Depth and height may each give by up to `slack` towards the lot they stand on.
  place(ch, name, x, z, yaw, len, dep, hgt, slack = 1.25) {
    const md = this.models[name];
    if (!md) return false;
    const [, L, D] = this.frame(name, md), k = len / L;
    const cl = (v, want) => Math.min(v * slack, Math.max(v / slack, want));
    // a model deeper than its lot grows backwards: the street front stays where the door is
    const dd = cl(D * k, dep), [px, pz] = this.at(x, z, yaw, 0, -(dd - dep) / 2);
    return this.fit(ch, name, px, pz, yaw, len, dd, cl(md.size.y * k, hgt));
  }
  // A generated model scaled uniformly to a height.
  stand(ch, name, x, z, yaw, hgt, y = CURB) {
    const md = this.models[name];
    if (!md) return false;
    const k = hgt / md.size.y;
    const m = new THREE.Matrix4().makeRotationY(yaw - Math.PI / 2 + (FACE[name] || 0)).multiply(new THREE.Matrix4().makeScale(k, k, k));
    m.setPosition(x, y - md.minY * k, z);
    const key = 'mdl_' + name;
    if (!this.M[key]) this.M[key] = md.material;
    ch.get(key).add(md.geometry, m.multiply(md.matrix));
    return true;
  }
  // Dry summer weeds scattered over a rectangle of open ground (thistles, wild oats).
  weeds(ch, x, z, w, d, per = 9) {
    const rng = this.weedRng || (this.weedRng = new Rng(4127));
    const n = Math.min(90, Math.round((w * d) / per));
    for (let i = 0; i < n; i++) {
      const px = x + rng.f(-w / 2 + 0.4, w / 2 - 0.4), pz = z + rng.f(-d / 2 + 0.4, d / 2 - 0.4);
      if (!this.physics.circleFree(px, pz, 0.5, 0, 2) || onRoad(px, pz)) continue;
      // three crossed cards cut from a photograph of the real thing, sunk so the soil clod stays underground
      const h = rng.f(0.5, 1.1), r = h * 0.5, a0 = rng.f(3.14), W = ch.get('weed'), y0 = CURB - h * 0.13, y1 = y0 + h;
      const tone = rng.f(0.82, 1.05), col = [tone, tone * rng.f(0.95, 1), tone * rng.f(0.85, 1)];
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * 1.047, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
        W.quad([px - cx, y0, pz - cz], [px + cx, y0, pz + cz], [px + cx, y1, pz + cz], [px - cx, y1, pz - cz], [0, 0, 1, 1], col);
      }
    }
  }
  dumpster(ch, x, z, yaw) {
    if (!this.model(ch, 'p_dumpster', x, z, yaw, 2.3)) ch.get('paint').box(x, CURB, z, 2.2, 1.4, 1.3, yaw, { c: rgb('#3f6b4a') });
    this.solid(x, z, 1.15, 0.75, yaw, 1.5);
    if (this.rng.chance(0.75)) this.cats.push({ x: x + this.rng.f(-2, 2), z: z + this.rng.f(-2, 2) });
    ch.get('decal').floor(x, CURB + 0.012, z, 3.6, 3.2, yaw, this.oil);
  }
  chair(ch, x, z, yaw) {
    if (!this.model(ch, 'p_chair', x, z, yaw, 0.84)) ch.get('paint').box(x, CURB, z, 0.5, 0.45, 0.5, yaw, { c: rgb('#eceadf') });
    const [sx, sz] = this.at(x, z, yaw, 0, 0.05);
    this.seats.push({ x: sx, z: sz, yaw, kind: 'chair' });
  }
  table(ch, x, z) {
    const w = rgb('#eceadf');
    ch.get('paint').cyl(x, CURB, z, 0.05, 0.05, 0.7, 5, w, w, false);
    ch.get('paint').cyl(x, CURB + 0.7, z, 0.5, 0.5, 0.04, 10, w, w, true);
    this.solid(x, z, 0.3, 0.3, 0, 0.8);
  }
  crate(ch, x, z, yaw, col, h = 0.35) { ch.get('paint').box(x, CURB, z, 0.6, h, 0.4, yaw, { c: shade(col, 0.8), cTop: col }); }

  busStop(ch, x, z, yaw, name) {
    if (this.models.e_busstop) {
      this.stand(ch, 'e_busstop', x, z, yaw, 2.9);
      const [bx, bz] = this.at(x, z, yaw, 0, -0.55);
      this.solid(bx, bz, 1.6, 0.08, yaw, 2.3);
      this.seats.push({ x, z, yaw, kind: 'bench' });
      return;
    }
    const P = ch.get('paint'), fr = rgb('#4d5a63');
    for (const s of [-1.5, 1.5]) for (const d of [-0.5, 0.5]) { const [px, pz] = this.at(x, z, yaw, s, d); P.cyl(px, CURB, pz, 0.05, 0.05, 2.4, 5, fr, fr, false); }
    P.box(x, CURB + 2.4, z, 3.4, 0.08, 1.5, yaw, { c: rgb('#c9ced2') });
    const [bx, bz] = this.at(x, z, yaw, 0, -0.5);
    P.box(bx, CURB + 0.3, bz, 3.1, 1.9, 0.05, yaw, { c: rgb('#aeb9c2') });
    const r = this.poster(this.rng.pick(POSTERS));
    ch.get('sign').panel(x, z, yaw, 0.8, CURB + 0.5, 1.1, 1.5, -0.46, r);
    const s2 = this.sign({ text: name, bg: '#f5b301', fg: '#111', font: '"Heebo"', weight: 700, shadow: false }, 256, 64);
    ch.get('sign').panel(x, z, yaw, -0.9, CURB + 1.75, 1.2, 0.3, -0.46, s2);
    P.box(x, CURB + 0.42, z, 2.4, 0.06, 0.4, yaw, { c: rgb('#6c7880') });
    this.solid(bx, bz, 1.6, 0.08, yaw, 2.3);
    const [hx, hz] = this.at(x, z, yaw, 0, 0.9);
    this.hang.push({ x: hx, z: hz, r: 1.6, kind: 'bus', yaw });
    this.seats.push({ x, z, yaw, kind: 'bench' });
  }

  streetSign(ch, x, z, yaw, name, sub) {
    const P = ch.get('paint'), grey = rgb('#8c9296');
    P.cyl(x, CURB, z, 0.04, 0.04, 2.9, 5, grey, grey, false);
    const r = this.sign({ style: 'street', text: name, sub }, 256, 96);
    const S = ch.get('sign');
    S.panel(x, z, yaw, 0.45, CURB + 2.45, 0.9, 0.34, 0.02, r);
    S.panel(x, z, yaw + Math.PI, -0.45, CURB + 2.45, 0.9, 0.34, 0.02, r);
  }

  // ---- The public-housing block ("רכבת") ------------------------------------------------
  // o: x,z,len,yaw, floors, pilotis, tint, trim, seed, number, gimel, name
  slab(ch, o) {
    const rng = new Rng(o.seed || 1);
    // With a generated building available the procedural pass still runs for its collision,
    // doors and hang-outs, but draws into a chunk that is never built.
    const flat = ['b_blockA', 'b_blockC', 'b_blockD', 'b_blockE'].filter((k) => this.models[k]);
    const pick = o.pilotis ? 'b_blockB' : (flat[(o.seed || 1) % Math.max(1, flat.length)] || 'b_blockA');
    const mdl = this.models[pick] ? pick : null, real = ch;
    if (mdl) ch = new Chunk('void');
    const { x, z, len } = o, yaw = o.yaw || 0, dep = o.dep || 10.4, floors = o.floors || 4;
    const pil = !!o.pilotis, y0 = pil ? 2.95 : CURB;
    const H = floors * FH, top = y0 + H;
    const tint = o.tint || rng.pick(PAL), trim = o.trim || rng.pick(TRIM);
    const PL = ch.get('plaster'), CO = ch.get('concrete'), PA = ch.get('paint'), DE = ch.get('decal');
    const worn = o.gimel ? 0.9 : 1;
    const tb = shade(tint, 0.8 * worn), tt = shade(tint, worn);
    PL.box(x, y0, z, len, H, dep, yaw, { c: tb, cTop: tt, s: 3.4, skip: 'Y' + (pil ? '' : 'y') });
    ch.get('roof').floor(x, top, z, len, dep, yaw, [0, 0, len / 6, dep / 6]);
    // parapet
    for (const [lx, lz, w, d] of [[0, dep / 2 - 0.1, len, 0.2], [0, -dep / 2 + 0.1, len, 0.2], [len / 2 - 0.1, 0, 0.2, dep], [-len / 2 + 0.1, 0, 0.2, dep]]) {
      const [px, pz] = this.at(x, z, yaw, lx, lz); PL.box(px, top, pz, w, 0.55, d, yaw, { c: tt, s: 3.4, skip: 'y' });
    }
    this.foot(x, z, len / 2, dep / 2, yaw, o.home ? 'home' : 'res');

    const nEnt = o.entrances || Math.max(2, Math.round(len / 17));
    const seg = len / nEnt, TW = 2.7;
    const front = dep / 2, FRONT = yaw, BACK = yaw + Math.PI;
    const winKinds = ['shutClosed', 'shutDirty', 'shutHalf', 'open', 'bars', 'kitchen', 'shutHalf', 'open'];
    const litP = 0.42;

    for (let e = 0; e < nEnt; e++) {
      const ex = -len / 2 + seg * (e + 0.5);
      // stair tower, a touch proud of the facade, with ventilation blocks
      const [tx, tz] = this.at(x, z, yaw, ex, front + 0.16);
      const tc = mix(tint, trim, 0.22);
      PL.box(tx, pil ? CURB : y0, tz, TW, (pil ? y0 - CURB : 0) + H + 2.3, 0.34, yaw, { c: shade(tc, 0.8), cTop: tc, s: 3.4 });
      const [rx, rz] = this.at(x, z, yaw, ex, front - 1.6);
      PL.box(rx, top, rz, TW + 0.6, 2.3, 3.4, yaw, { c: tt, s: 3.4, skip: 'y' });
      for (let f = 0; f < floors; f++) ch.get('winLit').panel(x, z, FRONT, ex, y0 + f * FH + 0.75, 1.5, 1.9, front + 0.34, WIN.lattice);
      // door
      ch.get('winLit').panel(x, z, FRONT, ex, CURB, 1.9, 2.35, front + 0.345, WIN.entry);
      const [cx, cz] = this.at(x, z, yaw, ex, front + 0.9);
      CO.box(cx, CURB + 2.45, cz, TW + 0.5, 0.14, 1.5, yaw, { c: rgb('#c9c6bd'), s: 2 });
      if (o.number) {
        const r = this.sign({ text: 'כניסה ' + 'אבגדהוזח'[e], bg: '#f3efe6', fg: '#1d2430', font: '"Heebo"', weight: 700, shadow: false }, 192, 64);
        ch.get('sign').panel(x, z, FRONT, ex + 1.75, CURB + 1.75, 0.6, 0.2, front + 0.02, r);
      }
      if (pil) {
        const [kx, kz] = this.at(x, z, yaw, ex, 0);
        CO.box(kx, CURB, kz, 3.4, y0 - CURB, dep, yaw, { c: rgb('#bdb9ae'), s: 3 });
        this.solid(kx, kz, 1.7, dep / 2, yaw, y0);
        if (rng.chance(0.7)) this.tag(ch, kx, kz, yaw + Math.PI / 2, rng.f(-2, 2), CURB + rng.f(0.6, 1.3), 1.72, rng, o.gimel);
        if (rng.chance(0.7)) this.tag(ch, kx, kz, yaw - Math.PI / 2, rng.f(-2, 2), CURB + rng.f(0.6, 1.3), 1.72, rng, o.gimel);
      }
      // drain pipes beside the tower
      for (const s of [-1, 1]) { const [px, pz] = this.at(x, z, yaw, ex + s * (TW / 2 + 0.12), front + 0.07); PA.box(px, CURB, pz, 0.1, top - CURB, 0.1, yaw, { c: rgb('#8b8478') }); }

      // front bays on both sides of the tower
      const side = (seg - TW) / 2, nb = Math.max(1, Math.round(side / 3.3)), bw = side / nb;
      for (let sgn = -1; sgn <= 1; sgn += 2) for (let b = 0; b < nb; b++) {
        const lx = ex + sgn * (TW / 2 + bw * (b + 0.5));
        for (let f = 0; f < floors; f++) {
          const fy = y0 + f * FH;
          let kind = rng.pick(winKinds);
          if (!pil && f === 0 && rng.chance(0.6)) kind = 'bars';
          const small = kind === 'kitchen';
          const ww = small ? 1.5 : 1.55, wh = small ? 1.5 : 1.35;
          const lit = kind !== 'shutClosed' && kind !== 'shutDirty' && rng.chance(litP);
          ch.get(lit ? 'winLit' : 'win').panel(x, z, FRONT, lx, fy + 1.0, ww, wh, front + 0.02, WIN[kind]);
          const [sx, sz] = this.at(x, z, yaw, lx, front + 0.07);
          PA.box(sx, fy + 0.93, sz, ww + 0.12, 0.07, 0.14, yaw, { c: rgb('#cfcabd') });
          if (rng.chance(0.3)) {
            const ax = lx + rng.sign() * (ww / 2 + 0.55);
            const [qx, qz] = this.at(x, z, yaw, ax, front + 0.17);
            PA.box(qx, fy + 0.5, qz, 0.78, 0.52, 0.3, yaw, { c: rgb('#d8d6cf'), cTop: rgb('#e9e7e0') });
            ch.get('win').panel(x, z, FRONT, ax, fy + 0.55, 0.6, 0.42, front + 0.325, WIN.dark, [0.35, 0.36, 0.38]);
            DE.panel(x, z, FRONT, ax, fy + 0.5 - 1.5, 0.3, 1.5, front + 0.012, this.stain);
          }
        }
      }
    }

    // back facade: balconies, every flat closed it in differently
    const nB = Math.max(2, Math.round(len / 3.4)), bw = len / nB;
    for (let b = 0; b < nB; b++) {
      const lx = -len / 2 + bw * (b + 0.5);
      for (let f = 0; f < floors; f++) {
        const fy = y0 + f * FH;
        const ground = !pil && f === 0;
        const roll = rng.next();
        const lit = rng.chance(litP);
        if (ground || roll < 0.2) {
          const kind = ground ? rng.pick(['bars', 'shutClosed', 'bars', 'shutDirty']) : rng.pick(winKinds);
          ch.get(lit && kind !== 'shutClosed' && kind !== 'shutDirty' ? 'winLit' : 'win').panel(x, z, BACK, -lx, fy + 1.0, 1.55, 1.35, front + 0.02, WIN[kind]);
        } else if (roll < 0.62) {
          // enclosed balcony
          const [bx, bz] = this.at(x, z, yaw, lx, -front - 0.62);
          const bc = shade(rng.chance(0.5) ? tint : rng.pick(PAL), rng.f(0.86, 1.0));
          PL.box(bx, fy + 0.06, bz, bw - 0.24, FH - 0.2, 1.24, yaw, { c: shade(bc, 0.86), cTop: bc, s: 3.4 });
          const kind = rng.chance(0.6) ? 'balcony' : 'balconyShut';
          ch.get(lit && kind === 'balcony' ? 'winLit' : 'win').panel(x, z, BACK, -lx, fy + 0.22, bw - 0.6, FH - 0.55, front + 1.25, WIN[kind]);
        } else {
          // open balcony with a parapet and washing
          const [bx, bz] = this.at(x, z, yaw, lx, -front - 0.62);
          CO.box(bx, fy, bz, bw - 0.24, 0.13, 1.24, yaw, { c: rgb('#bcb8ad'), s: 2 });
          const [px, pz] = this.at(x, z, yaw, lx, -front - 1.19);
          const railing = rng.chance(0.4);
          if (railing) { PA.box(px, fy + 0.95, pz, bw - 0.24, 0.06, 0.06, yaw, { c: trim }); for (let i = 0; i < 7; i++) { const [qx, qz] = this.at(x, z, yaw, lx - (bw - 0.3) / 2 + ((bw - 0.3) / 6) * i, -front - 1.19); PA.box(qx, fy + 0.13, qz, 0.04, 0.84, 0.04, yaw, { c: trim }); } }
          else PL.box(px, fy + 0.13, pz, bw - 0.24, 0.9, 0.1, yaw, { c: shade(tint, 0.78), cTop: shade(tint, 0.95), s: 3.4 });
          ch.get(lit ? 'winLit' : 'win').panel(x, z, BACK, -lx, fy + 0.15, 1.7, 2.15, front + 0.02, WIN[rng.pick(['open', 'shutHalf', 'open', 'shutClosed'])]);
          if (rng.chance(0.75)) {
            const n = rng.i(2, 5); let cxl = -(bw - 0.6) / 2;
            for (let i = 0; i < n; i++) {
              const cw = rng.f(0.3, 0.6), chh = rng.f(0.35, 0.8);
              ch.get('cloth').panel(x, z, BACK, -lx + cxl + cw / 2, fy + 1.0 - chh, cw, chh, front + 1.27, [0, 0, 1, 1], rng.pick(CLOTH));
              cxl += cw + rng.f(0.03, 0.15); if (cxl > (bw - 0.6) / 2 - 0.5) break;
            }
          }
        }
      }
    }

    // roof: one solar heater per flat column, plus a few water tanks
    const nH = Math.round(len / 4.2);
    for (let i = 0; i < nH; i++) {
      const lx = -len / 2 + (len / nH) * (i + 0.5) + rng.f(-0.5, 0.5), lz = rng.f(-dep / 2 + 1.6, dep / 2 - 3.6);
      const [hx, hz] = this.at(x, z, yaw, lx, lz);
      if (Math.abs((((lx + len / 2) % seg) - seg / 2)) < 2.4 && lz > front - 4) continue;       // keep clear of the stair rooms
      const w = rgb('#f1f0ea');
      PA.cyl(hx, top + 0.55, hz, 0.3, 0.3, 1.05, 8, shade(w, 0.85), w, true);
      PA.box(hx, top, hz, 0.5, 0.55, 0.5, yaw, { c: rgb('#8d8f8c') });
      const [gx, gz] = this.at(x, z, yaw, lx + 1.1, lz);
      ch.get('gloss').box(gx, top + 0.25, gz, 1.0, 0.07, 1.7, yaw, { c: rgb('#18233a'), cTop: rgb('#22345a') });
      PA.box(gx, top, gz, 0.9, 0.25, 0.06, yaw, { c: rgb('#8d8f8c') });
    }

    // block number painted on the gable ends, and tags near the ground
    if (o.number) {
      const r = this.graffiti(String(o.number), '#2b3440');
      DE.panel(x, z, yaw + Math.PI / 2, 0, top - 2.6, 2.4, 1.5, len / 2 + 0.012, r);
      DE.panel(x, z, yaw - Math.PI / 2, 0, top - 2.6, 2.4, 1.5, len / 2 + 0.012, r);
    }
    if (!pil) {
      this.solid(x, z, len / 2, dep / 2 + 0.2, yaw, top + 1);
      for (let i = 0; i < 2; i++) if (rng.chance(0.8)) this.tag(ch, x, z, rng.chance(0.5) ? yaw + Math.PI / 2 : yaw - Math.PI / 2, rng.f(-3, 3), CURB + rng.f(0.5, 1.2), len / 2 + 0.014, rng, o.gimel);
    } else {
      // open ground floor on columns; the body only matters to the camera
      this.solid(x, z, len / 2, dep / 2, yaw, top + 1, y0);
      const nc = Math.round(len / 5.2);
      for (let i = 0; i <= nc; i++) for (const s of [-1, 1]) {
        const lx = -len / 2 + 0.3 + ((len - 0.6) / nc) * i;
        if (Math.abs((((lx + len / 2) % seg) - seg / 2)) < 2.2) continue;
        const [qx, qz] = this.at(x, z, yaw, lx, s * (dep / 2 - 0.28));
        CO.box(qx, CURB, qz, 0.42, y0 - CURB, 0.42, yaw, { c: rgb('#b9b5aa'), s: 2 });
        this.solid(qx, qz, 0.22, 0.22, yaw, y0);
      }
      ch.get('concrete').floor(x, CURB + 0.01, z, len, dep, yaw, [0, 0, len / 4, dep / 4], rgb('#aaa69b'));
    }
    if (mdl) {
      const n = Math.max(1, Math.round(len / 34)), piece = len / n;
      for (let i = 0; i < n; i++) {
        const [mx, mz] = this.at(x, z, yaw, -len / 2 + piece * (i + 0.5), 0);
        // generated from one photo, each block has a real street side and a bare back:
        // two half-depth copies back to back give it two fronts
        const d2 = (dep + (pil ? 0.6 : 1.5)) / 2;
        for (const s of [1, -1]) {
          const [hx, hz] = this.at(mx, mz, yaw, 0, s * d2 / 2);
          this.fit(real, mdl, hx, hz, yaw + (s > 0 ? 0 : Math.PI), piece, d2, (top - CURB) * 1.13);
        }
      }
    }
    return { top, y0, front, seg, nEnt };
  }

  // A row of single-storey shops facing local +Z.
  // units: [{name, sub, bg, fg, kind:'store'|'roller'|'open', w}]
  shops(ch, o) {
    const { x, z, len, units } = o, yaw = o.yaw || 0, dep = o.dep || 8, H = o.h || 3.7;
    const real = ch;
    const kinds = ['b_shops', 'b_shops2', 'b_shops3'].filter((k) => this.models[k]);
    const mdl = kinds.length > 0, skin = kinds[Math.abs(Math.round(x * 0.37 + z * 0.11)) % Math.max(1, kinds.length)];
    if (mdl) {
      ch = new Chunk('void');
      const n = Math.max(1, Math.round(len / 16)), piece = len / n;
      for (let i = 0; i < n; i++) {
        const [mx, mz] = this.at(x, z, yaw, -len / 2 + piece * (i + 0.5), 0.7);
        this.fit(real, kinds.length > 1 && n > 1 ? kinds[(i + kinds.indexOf(skin)) % kinds.length] : skin, mx, mz, yaw, piece, dep + 1.6, H * 1.32);
      }
    }
    const tint = o.tint || PAL[2];
    ch.get('plaster').box(x, CURB, z, len, H, dep, yaw, { c: shade(tint, 0.8), cTop: tint, s: 3.4, skip: 'Yy' });
    ch.get('roof').floor(x, CURB + H, z, len, dep, yaw, [0, 0, len / 6, dep / 6]);
    this.solid(x, z, len / 2, dep / 2, yaw, H + 0.5); this.foot(x, z, len / 2, dep / 2, yaw, 'shop');
    const uw = len / units.length;
    units.forEach((u, i) => {
      const lx = -len / 2 + uw * (i + 0.5);
      const closed = u.kind === 'roller';
      ch.get(closed ? 'win' : 'winLit').panel(x, z, yaw, lx - 0.5, CURB + 0.05, uw - 1.9, 2.45, dep / 2 + 0.02, closed ? WIN.roller : WIN.store);
      ch.get(closed ? 'win' : 'winLit').panel(x, z, yaw, lx + uw / 2 - 0.85, CURB + 0.05, 1.3, 2.45, dep / 2 + 0.02, closed ? WIN.roller : WIN.shopDoor);
      const r = this.sign({ text: u.name, sub: u.sub, bg: u.bg, bg2: u.bg2, fg: u.fg, stripe: u.stripe, subFg: u.subFg, font: u.font, worn: 3 + i }, 384, 96);
      const [sx, sz] = this.at(x, z, yaw, lx, dep / 2 + 0.09);
      ch.get('paint').box(sx, CURB + 2.6, sz, uw - 0.3, 0.95, 0.16, yaw, { c: rgb('#2a2d31') });
      ch.get('sign').panel(x, z, yaw, lx, CURB + 2.66, uw - 0.44, 0.83, dep / 2 + 0.175, r);
      if (u.awning) {
        const [ax, az] = this.at(x, z, yaw, lx, dep / 2 + 0.95);
        ch.get('cloth').box(ax, CURB + 2.5, az, uw - 0.4, 0.05, 1.7, yaw, { c: rgb(u.awning) });
      }
      const [dx, dz] = this.at(x, z, yaw, lx + uw / 2 - 0.85, dep / 2 + 1.2);
      if (u.poi) setPOI(u.poi, dx, dz, { yaw, name: u.name });
      if (u.hang) this.hang.push({ x: dx - Math.sin(yaw) * -1.2, z: dz + Math.cos(yaw) * 1.2, r: 2.2, kind: u.hang, yaw });
    });
    if (o.back !== false) this.tag(ch, x, z, yaw + Math.PI, this.rng.f(-len / 3, len / 3), CURB + 0.7, dep / 2 + 0.014, this.rng, o.gimel);
  }

  // Generic institutional building with a grid of windows and a sign over the door.
  civic(ch, o) {
    const { x, z, w, d } = o, yaw = o.yaw || 0, floors = o.floors || 2, H = floors * 3.3 + 0.6;
    const name = o.model || CIVIC[o.poi] || CIVIC[o.kind];
    if (name && this.place(ch, name, x, z, yaw, w + 1, d + 1, H * 1.12)) ch = new Chunk('void');
    const tint = o.tint ? rgb(o.tint) : PAL[2], mat = o.mat || 'plaster';
    ch.get(mat).box(x, CURB, z, w, H, d, yaw, { c: shade(tint, 0.8), cTop: tint, s: 3.4, skip: 'Yy' });
    ch.get('roof').floor(x, CURB + H, z, w, d, yaw, [0, 0, w / 6, d / 6]);
    this.solid(x, z, w / 2, d / 2, yaw, H + 1); this.foot(x, z, w / 2, d / 2, yaw, o.kind || 'civic');
    const rng = new Rng(o.seed || 9);
    const nb = Math.max(2, Math.round(w / 3.6)), bw = w / nb;
    for (let f = 0; f < floors; f++) for (let b = 0; b < nb; b++) {
      const lx = -w / 2 + bw * (b + 0.5);
      for (const side of [0, 1]) {
        if (side === 0 && f === 0 && Math.abs(lx) < 2.2) continue;
        const kind = o.win || rng.pick(['open', 'bars', 'shutHalf', 'open']);
        ch.get(rng.chance(o.lit === undefined ? 0.25 : o.lit) ? 'winLit' : 'win').panel(x, z, yaw + side * Math.PI, side ? -lx : lx, CURB + f * 3.3 + 1.0, Math.min(2.2, bw - 1), 1.5, d / 2 + 0.02, WIN[kind]);
      }
    }
    ch.get('winLit').panel(x, z, yaw, 0, CURB, 3, 2.6, d / 2 + 0.03, WIN.shopDoor);
    if (o.sign) {
      const r = this.sign(o.sign, 576, 96);
      const sw = Math.min(w - 1, o.signW || 9);
      const [sx, sz] = this.at(x, z, yaw, 0, d / 2 + 0.09);
      ch.get('paint').box(sx, CURB + 2.85, sz, sw + 0.3, sw / 6 + 0.3, 0.14, yaw, { c: rgb('#23262b') });
      ch.get('sign').panel(x, z, yaw, 0, CURB + 3.0, sw, sw / 6, d / 2 + 0.165, r);
    }
    const [dx, dz] = this.at(x, z, yaw, 0, d / 2 + 1.6);
    if (o.poi) setPOI(o.poi, dx, dz, { yaw });
    return { H };
  }

  // Corrugated industrial shed with roller doors.
  hangar(ch, o) {
    const { x, z, w, d } = o, yaw = o.yaw || 0, H = o.h || 6.5;
    const name = o.model || HANGAR[o.poi] || (Math.round(x + z) % 2 ? 'b_hangarA' : 'b_hangarB');
    if (this.place(ch, name, x, z, yaw, w + 0.6, d + 0.6, H * 1.12)) ch = new Chunk('void');
    const tint = rgb(o.tint || '#aab4bb');
    ch.get('metal').box(x, CURB, z, w, H, d, yaw, { c: shade(tint, 0.75), cTop: tint, s: 2.2, skip: 'y' });
    this.solid(x, z, w / 2, d / 2, yaw, H + 1); this.foot(x, z, w / 2, d / 2, yaw, 'ind');
    const n = o.doors || 2;
    for (let i = 0; i < n; i++) {
      const lx = -w / 2 + (w / n) * (i + 0.5);
      ch.get('win').panel(x, z, yaw, lx, CURB, Math.min(4.6, w / n - 1.4), 3.8, d / 2 + 0.02, WIN.garage);
    }
    if (o.sign) {
      const r = this.sign(o.sign, 576, 96);
      ch.get('sign').panel(x, z, yaw, 0, CURB + 4.3, Math.min(w - 2, 10), 1.6, d / 2 + 0.03, r);
    }
    const [dx, dz] = this.at(x, z, yaw, 0, d / 2 + 3);
    if (o.poi) setPOI(o.poi, dx, dz, { yaw });
  }

  // Public bomb shelter with a mural.
  shelter(ch, x, z, yaw, idx = 0) {
    const w = 7, d = 5, H = 2.4;
    if (this.fit(ch, 'e_shelter', x, z, yaw, w, d, 3.1)) { this.solid(x, z, w / 2, d / 2, yaw, H); this.foot(x, z, w / 2, d / 2, yaw, 'shelter'); return; }
    ch.get('concrete').box(x, CURB, z, w, H, d, yaw, { c: rgb('#b7b3a8'), cTop: rgb('#cbc7bc'), s: 2.5 });
    this.solid(x, z, w / 2, d / 2, yaw, H); this.foot(x, z, w / 2, d / 2, yaw, 'shelter');
    const mural = this.mats.signs.add(288, 96, (g, ww, hh) => drawMural(g, ww, hh, idx));
    ch.get('sign').panel(x, z, yaw, 0.8, CURB + 0.15, 5, 1.7, d / 2 + 0.015, mural);
    ch.get('win').panel(x, z, yaw, -2.6, CURB, 1.2, 2.0, d / 2 + 0.02, WIN.shelter);
    const r = this.sign({ text: 'מקלט ציבורי', sub: 'מספר ' + (17 + idx * 6), bg: '#f5b301', fg: '#111', font: '"Heebo"', weight: 700, shadow: false }, 256, 96);
    ch.get('sign').panel(x, z, yaw, -2.6, CURB + 2.02, 1.3, 0.34, d / 2 + 0.02, r);
    for (const s of [-1, 1]) ch.get('paint').cyl(...this.at(x, z, yaw, s * 2.6, -1).flatMap((v, i) => (i === 0 ? [v, CURB + H] : [v])), 0.14, 0.14, 0.9, 6, rgb('#7f8a84'), undefined, true);
  }

  // Tarmac car park: rows of bays with painted lines.
  lot(ch, x, z, w, d, yaw = 0, kind = 'res') {
    ch.get('asphalt').floor(x, CURB + 0.005, z, w, d, yaw, [0, 0, w / 6, d / 6], [0.82, 0.82, 0.82]);
    const DE = ch.get('decal'), wr = this.mats.whiteRect, n = Math.floor(w / 2.6);
    for (const side of [-1, 1]) {
      for (let i = 0; i <= n; i++) {
        const lx = -(n * 2.6) / 2 + i * 2.6;
        const [px, pz] = this.at(x, z, yaw, lx, side * (d / 2 - 2.5));
        DE.floor(px, CURB + 0.02, pz, 0.1, 5, yaw, wr, [0.85, 0.85, 0.82]);
        if (i < n) {
          const [sx, sz] = this.at(x, z, yaw, lx + 1.3, side * (d / 2 - 2.5));
          this.parking.push({ x: sx, z: sz, yaw: yaw + (side > 0 ? Math.PI : 0), kind });
        }
      }
    }
    if (this.rng.chance(0.8)) { const [ox, oz] = this.at(x, z, yaw, this.rng.f(-w / 3, w / 3), this.rng.f(-1, 1)); DE.floor(ox, CURB + 0.022, oz, 3, 3, this.rng.f(3), this.oil); }
  }

  // ---- Ground, streets, pavements -------------------------------------------
  ground() {
    const ch = this.chunk('ground');
    const A = ch.get('asphalt');
    const E = XS[5] + 9, W = XS[0] - 9, N = ZS[0] - 9, S = ZS[5] + 9;
    // carriageways: one quad per street so the texture runs along it
    for (const r of roads) {
      if (r.vertical) A.floor(r.x, 0, (r.z0 + r.z1) / 2, r.w, r.z1 - r.z0 + (r.rural ? 0 : 20), 0, [0, 0, r.w / 7, (r.z1 - r.z0) / 7]);
      else A.floor((r.x0 + r.x1) / 2, 0.002, r.z, r.x1 - r.x0 + (r.rural ? 0 : 20), r.w, 0, [0, 0, (r.x1 - r.x0) / 7, r.w / 7]);
    }
    // the desert around town
    const SA = ch.get('sand'), far = WORLD_HALF + 500, k = 9;
    const sandC = [0.92, 0.9, 0.86];
    const strips = [[-far, -far, far, N], [-far, S, far, far], [-far, N, W, S], [E, N, far, S]];
    for (const [x0, z0, x1, z1] of strips) SA.floor((x0 + x1) / 2, -0.03, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, [x0 / k, z0 / k, x1 / k, z1 / k], sandC);
    this.addChunk(ch, false);

    const DE = this.chunk('paint_roads'), D = DE.get('decal'), wr = this.mats.whiteRect;
    const white = [0.88, 0.88, 0.85], yellow = [0.9, 0.7, 0.12];
    const dash = (x0, z0, x1, z1, col = white, on = 3, off = 6, w = 0.14) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, yaw = Math.atan2(ux, uz);
      for (let t = off / 2; t + on <= len; t += on + off) D.floor(x0 + ux * (t + on / 2), 0.02, z0 + uz * (t + on / 2), w, on, yaw, wr, col);
    };
    const line = (x0, z0, x1, z1, col = white, w = 0.14) => {
      const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
      D.floor((x0 + x1) / 2, 0.02, (z0 + z1) / 2, w, len, yaw, wr, col);
    };
    // centre lines and zebra crossings between every pair of junctions
    for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) {
      const wv = roadW.v[i], a = ZS[j] + roadW.h[j] / 2 + 6.5, b = ZS[j + 1] - roadW.h[j + 1] / 2 - 6.5;
      if (wv > 12) { line(XS[i] - 1.2, a, XS[i] - 1.2, b, yellow); line(XS[i] + 1.2, a, XS[i] + 1.2, b, yellow); dash(XS[i] - wv / 4 - 0.6, a, XS[i] - wv / 4 - 0.6, b); dash(XS[i] + wv / 4 + 0.6, a, XS[i] + wv / 4 + 0.6, b); }
      else dash(XS[i], a, XS[i], b);
      for (const zz of [a - 3.4, b + 3.4]) for (let k2 = -Math.floor(wv / 2 / 1.1) + 0.5; k2 < wv / 2 / 1.1; k2++) D.floor(XS[i] + k2 * 1.1, 0.02, zz, 0.55, 3, 0, wr, white);
      line(XS[i] - wv / 4 - (wv > 12 ? 0.6 : 0) - wv / 8, a - 0.6, XS[i] + (wv > 12 ? -1.4 : 0), a - 0.6, white, 0.3);
    }
    for (let j = 0; j < 6; j++) for (let i = 0; i < 5; i++) {
      const wh = roadW.h[j], a = XS[i] + roadW.v[i] / 2 + 6.5, b = XS[i + 1] - roadW.v[i + 1] / 2 - 6.5;
      if (wh > 12) { line(a, ZS[j] - 1.2, b, ZS[j] - 1.2, yellow); line(a, ZS[j] + 1.2, b, ZS[j] + 1.2, yellow); dash(a, ZS[j] - wh / 4 - 0.6, b, ZS[j] - wh / 4 - 0.6); dash(a, ZS[j] + wh / 4 + 0.6, b, ZS[j] + wh / 4 + 0.6); }
      else dash(a, ZS[j], b, ZS[j]);
      for (const xx of [a - 3.4, b + 3.4]) for (let k2 = -Math.floor(wh / 2 / 1.1) + 0.5; k2 < wh / 2 / 1.1; k2++) D.floor(xx, 0.02, ZS[j] + k2 * 1.1, 3, 0.55, 0, wr, white);
    }
    dash(XS[5] + 8, ZS[0], 588, ZS[0]); dash(XS[3] - 4.2, ZS[5] + 8, XS[3] - 4.2, 588); dash(XS[3] + 4.2, ZS[5] + 8, XS[3] + 4.2, 588);
    line(XS[3], ZS[5] + 8, XS[3], 588, yellow, 0.2);
    this.addChunk(DE, false);
  }

  // Pavement ring, painted curbs, lamps, trees and name signs around one city block.
  pavement(ch, b, rng) {
    const P = ch.get('paving'), PA = ch.get('paint');
    const o = SIDEWALK, x0 = b.x0 - o, x1 = b.x1 + o, z0 = b.z0 - o, z1 = b.z1 + o;
    const uv = (w, d) => [0, 0, w / 1.5, d / 1.5];
    P.floor((x0 + x1) / 2, CURB, z0 + o / 2, x1 - x0, o, 0, uv(x1 - x0, o));
    P.floor((x0 + x1) / 2, CURB, z1 - o / 2, x1 - x0, o, 0, uv(x1 - x0, o));
    P.floor(x0 + o / 2, CURB, (b.z0 + b.z1) / 2, o, b.d, 0, uv(o, b.d));
    P.floor(x1 - o / 2, CURB, (b.z0 + b.z1) / 2, o, b.d, 0, uv(o, b.d));
    // curb stones: red-white near the corners, blue-white where parking is paid, grey otherwise
    const grey = rgb('#a9a8a2'), red = rgb('#c23a2c'), white = rgb('#e8e6de'), blue = rgb('#2f5fb3');
    const edge = (ax, az, bx, bz, nx, nz, paid) => {
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, yaw = Math.atan2(ux, uz) - Math.PI / 2;
      const seg = (t0, t1, col) => {
        const cx = ax + ux * (t0 + t1) / 2 + nx * 0.09, cz = az + uz * (t0 + t1) / 2 + nz * 0.09;
        PA.box(cx, 0, cz, t1 - t0, CURB + 0.012, 0.18, yaw, { c: shade(col, 0.8), cTop: col, skip: 'y' });
      };
      const corner = 11;
      for (let t = 0; t < corner; t += 1) { seg(t, t + 1, (t | 0) % 2 ? white : red); seg(len - t - 1, len - t, (t | 0) % 2 ? white : red); }
      if (paid) for (let t = corner; t < len - corner - 1; t += 1) seg(t, Math.min(t + 1, len - corner), ((t - corner) | 0) % 2 ? white : blue);
      else seg(corner, len - corner, grey);
    };
    const paid = b.zone === 'center' || b.zone === 'civic' || b.zone === 'shuk';
    edge(x0, z0, x1, z0, 0, 1, paid); edge(x1, z0, x1, z1, -1, 0, paid); edge(x1, z1, x0, z1, 0, -1, paid); edge(x0, z1, x0, z0, 1, 0, paid);
    // lamps and trees along the four sides
    const sides = [[x0, z0, 1, 0, 0], [x1, z0, 0, 1, -Math.PI / 2], [x1, z1, -1, 0, Math.PI], [x0, z1, 0, -1, Math.PI / 2]];
    sides.forEach(([sx, sz, ux, uz, yawIn], si) => {
      const len = si % 2 ? z1 - z0 : x1 - x0;
      const inx = -uz, inz = ux;                       // pointing into the block
      const boulevard = (si === 0 && b.r === 3) || (si === 2 && b.r === 2) || (si === 3 && b.c === 3) || (si === 1 && b.c === 2);
      for (let t = 16; t < len - 10; t += 34) {
        this.lamp(ch, sx + ux * t + inx * 0.55, sz + uz * t + inz * 0.55, yawIn + Math.PI, !boulevard, boulevard ? 9.5 : 7.6);
      }
      if (b.zone !== 'industrial' && b.zone !== 'site') for (let t = 33; t < len - 14; t += 34) {
        if (rng.chance(0.72)) this.tree(ch, sx + ux * t + inx * 2.6, sz + uz * t + inz * 2.6, rng.f(0.85, 1.25), rng, rng.chance(0.2) ? 'euc' : 'ficus');
      }
    });
  }

  junctionSigns(ch) {
    const names = roads;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const x = XS[i] + roadW.v[i] / 2 + 0.7, z = ZS[j] + roadW.h[j] / 2 + 0.7;
      if (i < 5 && j < 5) {
        this.streetSign(ch, x, z, 0, names[6 + j].name, EN_H[j]);
        this.streetSign(ch, x + 0.25, z + 0.25, Math.PI / 2, names[i].name, EN_V[i]);
      }
    }
  }

  medians(ch) {
    // planted median with palms down the two boulevards
    const P = ch.get('paving'), rng = new Rng(88);
    for (let j = 0; j < 5; j++) {
      const a = ZS[j] + roadW.h[j] / 2 + 12, b = ZS[j + 1] - roadW.h[j + 1] / 2 - 12, x = XS[3];
      P.box(x, 0, (a + b) / 2, 1.9, CURB + 0.03, b - a, 0, { c: rgb('#c9c6bd'), s: 2.6 });
      this.solid(x, (a + b) / 2, 0.95, (b - a) / 2, 0, 0.2);
      for (let z = a + 6; z < b - 4; z += 15) this.palm(ch, x, z, rng.f(7, 10), rng);
    }
    for (let i = 0; i < 5; i++) {
      const a = XS[i] + roadW.v[i] / 2 + 12, b = XS[i + 1] - roadW.v[i + 1] / 2 - 12, z = ZS[3];
      P.box((a + b) / 2, 0, z, b - a, CURB + 0.03, 1.9, 0, { c: rgb('#c9c6bd'), s: 2.6 });
      this.solid((a + b) / 2, z, (b - a) / 2, 0.95, 0, 0.2);
      for (let x = a + 6; x < b - 4; x += 15) this.palm(ch, x, z, rng.f(7, 10), rng);
    }
  }

  addChunk(ch, cast = true) {
    const castSet = { plaster: 1, concrete: 1, metal: 1, leaf: 1, frond: 1, paint: 1, cloth: 1, gloss: 1 };
    for (const name of Object.keys(ch.b)) {
      const mat = this.M[name];
      if (!mat) { console.warn('no material', name); continue; }
      const isCast = cast && (castSet[name] || name.startsWith('mdl_'));
      const mesh = ch.b[name].build(mat, { cast: isCast, receive: name !== 'glow' && name !== 'bulb' });
      if (!mesh) continue;
      mesh.name = ch.id + ':' + name;
      if (name === 'glow' || name === 'decal') mesh.renderOrder = name === 'glow' ? 3 : 2;
      this.group.add(mesh);
    }
  }

  build() {
    const M = this.M;
    if (!M.cloth) M.cloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    this.ground();
    const street = this.chunk('street');
    this.medians(street); this.junctionSigns(street);
    this.addChunk(street);
    for (const b of blocks) {
      const ch = this.chunk(b.id), rng = new Rng(1000 + b.c * 31 + b.r * 977);
      this.pavement(ch, b, rng);
      this.later = [];
      fillZone(this, ch, b, rng);
      for (const fn of this.later) fn();          // ground cover goes in once the block's solids exist
      this.addChunk(ch);
    }
    buildOutskirts(this);
    this.mats.finish();
    return this;
  }
}

const EN_V = ['Derekh HaNegev', 'Herzl St.', 'Jabotinsky St.', 'Yerushalayim Blvd.', 'HaHistadrut St.', 'Derekh HaMifalim'];
const EN_H = ['HaAliya St.', 'Yehuda HaLevi St.', 'HaGefen St.', 'HaAtzmaut Blvd.', 'Mivtza Yonatan St.', 'Derekh HaDarom'];

export const POSTERS = [
  { text: 'הלוואה ברגע', bg: '#f5b301', fg: '#111', band: '#111', fg2: '#f5b301', lines: ['בלי ערבים · בלי שאלות', 'רק 5%*  (*לשבוע)'] },
  { text: 'פינוי־בינוי', bg: '#17324d', fg: '#fff', band: '#e9dfc8', fg2: '#17324d', lines: ['העתיד כבר כאן', '(אתם בדרך החוצה)'] },
  { text: 'שמעון לראשות', bg: '#b3261e', fg: '#fff', band: '#fff', fg2: '#b3261e', lines: ['הבטחתי — אבטיח שוב', 'קריית שמש חזקה'] },
  { text: 'חפלה', bg: '#6b2bb8', fg: '#ffe17a', band: '#111', fg2: '#fff', lines: ['אולמי ורסאי · חמישי', 'הזמר אבי ״הקול״ ביטון'] },
  { text: 'טוטו כפול', bg: '#0f6b5c', fg: '#fff', band: '#f5b301', fg2: '#111', lines: ['הפעם זה בטוח', 'ככה אמרת גם בשבוע שעבר'] },
  { text: 'דרושים', bg: '#f3efe6', fg: '#111', band: '#e5412d', fg2: '#fff', lines: ['שליחים עם קורקינט', 'שכר: תלוי בטיפים'] },
  { text: 'מוכרים לך', bg: '#2a6bff', fg: '#fff', band: '#fff', fg2: '#2a6bff', lines: ['דירה? משקיעים מחכים', 'מזומן · מהיום להיום'] },
  { text: 'אבד חתול', bg: '#f3efe6', fg: '#b3261e', band: '#f3efe6', fg2: '#111', lines: ['ג׳ינג׳י, עצבני, עונה לשם ״מנהל״', 'המוצא יקבל אותו בחזרה'] },
];

function drawMural(g, w, h, idx) {
  const sky = ['#6ec6f0', '#ffd27a', '#8fd3b6'][idx % 3];
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(w * 0.85, h * 0.25, h * 0.2, 0, 7); g.fill();
  g.strokeStyle = '#ffe14d'; g.lineWidth = 4; for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; g.beginPath(); g.moveTo(w * 0.85 + Math.cos(a) * h * 0.25, h * 0.25 + Math.sin(a) * h * 0.25); g.lineTo(w * 0.85 + Math.cos(a) * h * 0.36, h * 0.25 + Math.sin(a) * h * 0.36); g.stroke(); }
  g.fillStyle = '#58a84a'; g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.8); g.quadraticCurveTo(w * 0.8, h * 0.6, w, h * 0.78); g.lineTo(w, h); g.fill();
  const cols = ['#e5412d', '#ff7ab6', '#fff', '#7a4bd1', '#f5b301'];
  for (let i = 0; i < 9; i++) { const x = 20 + i * (w - 40) / 9, y = h * 0.82 + (i % 3) * 6; g.strokeStyle = '#2d6b2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, h); g.lineTo(x, y); g.stroke(); g.fillStyle = cols[i % 5]; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.26) * 6, y + Math.sin(p * 1.26) * 6, 5, 0, 7); g.fill(); } g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  g.fillStyle = '#1d3f93'; g.font = '700 34px "Amatic SC", "Heebo"'; g.textAlign = 'center'; g.direction = 'rtl';
  g.fillText(['שלום על ישראל', 'ילדי שכונה ד׳', 'יחד ננצח את השעמום'][idx % 3], w * 0.4, h * 0.36);
  g.fillStyle = 'rgba(90,80,60,0.18)'; g.fillRect(0, 0, w, h);          // sun-faded
}
