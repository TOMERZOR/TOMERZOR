// Geometry batching for the static city. Everything that never moves is appended to a
// GeoBatch (one per material per city block) and uploaded as a single mesh.
import * as THREE from 'three';

const _c = new THREE.Color();
export function rgb(hex) { _c.set(hex); return [_c.r, _c.g, _c.b]; }
export function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
export function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
const WHITE = [1, 1, 1];

export class GeoBatch {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.count = 0; }

  // Arbitrary quad a→b→c→d (counter-clockwise seen from the front). uv = [u0,v0,u1,v1].
  quad(a, b, c, d, uv, col = WHITE, col2) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const k = this.count, P = this.p, N = this.n, U = this.u, C = this.c;
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
    U.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    const t = col2 || col;                         // col at the bottom edge (a,b), col2 at the top (c,d)
    C.push(col[0], col[1], col[2], col[0], col[1], col[2], t[0], t[1], t[2], t[0], t[1], t[2]);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
    this.count += 4;
  }

  // Box standing on y0. w along local X, d along local Z, rotated by yaw about Y.
  // opt.s: metres per texture tile (world-scaled UVs). opt.rect: fixed uv rect for the sides.
  // opt.c / opt.cTop: bottom and top vertex colour. opt.skip: string of faces to omit, any of "xXyYzZ"
  // (lower case = negative side).
  box(x, y0, z, w, h, d, yaw = 0, opt = {}) {
    const hw = w / 2, hd = d / 2, y1 = y0 + h;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (lx, y, lz) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
    const s = opt.s || 3, skip = opt.skip || '';
    const cb = opt.c || WHITE, ct = opt.cTop || cb;
    const r = opt.rect;
    const uvw = (len, hh) => (r || [0, y0 / s, len / s, (y0 + hh) / s]);
    if (!skip.includes('Z')) this.quad(P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, hd), P(-hw, y1, hd), uvw(w, h), cb, ct);
    if (!skip.includes('z')) this.quad(P(hw, y0, -hd), P(-hw, y0, -hd), P(-hw, y1, -hd), P(hw, y1, -hd), uvw(w, h), cb, ct);
    if (!skip.includes('X')) this.quad(P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), P(hw, y1, hd), uvw(d, h), cb, ct);
    if (!skip.includes('x')) this.quad(P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, hd), P(-hw, y1, -hd), uvw(d, h), cb, ct);
    const tr = opt.topRect || [0, 0, w / s, d / s];
    if (!skip.includes('Y')) this.quad(P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd), tr, opt.cRoof || ct);
    if (!skip.includes('y')) this.quad(P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y0, hd), P(-hw, y0, hd), tr, cb);
  }

  // Vertical panel facing local +Z of a frame at (x,z,yaw); lx is the offset along the wall,
  // out the offset away from it. Used for windows, signs, posters, doors.
  panel(x, z, yaw, lx, y0, w, h, out, uv, col = WHITE, col2) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), hw = w / 2;
    const P = (a, y) => [x + a * cs + out * sn, y, z - a * sn + out * cs];
    this.quad(P(lx - hw, y0), P(lx + hw, y0), P(lx + hw, y0 + h), P(lx - hw, y0 + h), uv, col, col2);
  }

  // Flat rectangle on the ground (or any height), axis aligned unless yaw given.
  floor(x, y, z, w, d, yaw, uv, col = WHITE) {
    const hw = w / 2, hd = d / 2, cs = Math.cos(yaw || 0), sn = Math.sin(yaw || 0);
    const P = (lx, lz) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
    this.quad(P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd), uv, col);
  }

  // Vertical cylinder (pole, trunk, tank). Optionally tapered.
  cyl(x, y0, z, r0, r1, h, seg = 8, col = WHITE, col2, cap = true) {
    const t = col2 || col;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const k = this.count;
      this.p.push(x + c0 * r0, y0, z + s0 * r0, x + c1 * r0, y0, z + s1 * r0, x + c1 * r1, y0 + h, z + s1 * r1, x + c0 * r1, y0 + h, z + s0 * r1);
      this.n.push(c0, 0, s0, c1, 0, s1, c1, 0, s1, c0, 0, s0);
      this.u.push(i / seg, 0, (i + 1) / seg, 0, (i + 1) / seg, 1, i / seg, 1);
      this.c.push(col[0], col[1], col[2], col[0], col[1], col[2], t[0], t[1], t[2], t[0], t[1], t[2]);
      this.i.push(k, k + 2, k + 1, k, k + 3, k + 2);
      this.count += 4;
      if (cap) {
        const m = this.count;
        this.p.push(x, y0 + h, z, x + c0 * r1, y0 + h, z + s0 * r1, x + c1 * r1, y0 + h, z + s1 * r1);
        this.n.push(0, 1, 0, 0, 1, 0, 0, 1, 0); this.u.push(0.5, 0.5, 0, 0, 1, 0);
        this.c.push(t[0], t[1], t[2], t[0], t[1], t[2], t[0], t[1], t[2]);
        this.i.push(m, m + 2, m + 1); this.count += 3;
      }
    }
  }

  // Append an existing BufferGeometry with a transform and a flat tint.
  add(geo, matrix, col = WHITE) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, gc = geo.attributes.color;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const k = this.count;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix); this.p.push(v.x, v.y, v.z);
      if (nor) { v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z); } else this.n.push(0, 1, 0);
      if (uv) this.u.push(uv.getX(i), uv.getY(i)); else this.u.push(0, 0);
      if (gc) this.c.push(gc.getX(i) * col[0], gc.getY(i) * col[1], gc.getZ(i) * col[2]); else this.c.push(col[0], col[1], col[2]);
    }
    if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i++) this.i.push(k + ix.getX(i)); }
    else for (let i = 0; i < pos.count; i++) this.i.push(k + i);
    this.count += pos.count;
  }

  build(material, opts = {}) {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.u), 2));
    const col = new Uint8Array(this.c.length);
    for (let i = 0; i < col.length; i++) col[i] = Math.max(0, Math.min(255, Math.round(this.c[i] * 255)));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setIndex(this.count > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.i), 1) : new THREE.BufferAttribute(new Uint16Array(this.i), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, material);
    m.castShadow = !!opts.cast; m.receiveShadow = opts.receive !== false;
    m.matrixAutoUpdate = false;
    this.p = this.n = this.u = this.c = this.i = null;
    return m;
  }
}

// A set of batches keyed by material name, for one chunk of the city.
export class Chunk {
  constructor(id) { this.id = id; this.b = {}; }
  get(name) { return this.b[name] || (this.b[name] = new GeoBatch()); }
}

// Shelf-packs many small canvases into one big atlas texture.
export class Atlas {
  constructor(w = 2048, h = w, name = 'atlas') {
    this.w = w; this.h = h; this.name = name;
    this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h;
    this.g = this.cv.getContext('2d');
    this.x = 0; this.y = 0; this.rowH = 0; this.pad = 4; this.full = false;
  }
  // Reserve w×h pixels, hand the 2D context to draw(), return the uv rect [u0,v0,u1,v1].
  add(w, h, draw) {
    const pad = this.pad;
    if (this.x + w + pad > this.w) { this.x = 0; this.y += this.rowH + pad; this.rowH = 0; }
    if (this.y + h + pad > this.h) { if (!this.full) console.warn(this.name + ' atlas is full'); this.full = true; return [0, 0, 0.004, 0.004]; }
    const g = this.g, x = this.x + pad / 2, y = this.y + pad / 2;
    g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    draw(g, w, h);
    g.restore();
    this.x += w + pad; this.rowH = Math.max(this.rowH, h);
    return [x / this.w, 1 - (y + h) / this.h, (x + w) / this.w, 1 - y / this.h];
  }
  texture(aniso = 4) {
    const t = new THREE.CanvasTexture(this.cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
}
