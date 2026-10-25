// Merged-geometry builder with baked vertex colours: lets a whole stall or prop
// render as a single draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Bag {
  constructor(withUV = false, ao = 0.38) { this.parts = []; this.uv = withUV; this.ao = ao; }
  add(geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, jitter = 0) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz);
    _m.compose(_v, _q, _s);
    geo.applyMatrix4(_m);
    if (!this.uv) geo.deleteAttribute('uv');
    if (color !== null) {
      const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
      _c.set(color);
      if (jitter) _c.multiplyScalar(1 + (Math.random() - 0.5) * jitter);
      // baked occlusion: every part gets darker toward its base, which reads as contact shadow
      const pos = geo.attributes.position;
      let y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < n; i++) { const y = pos.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const span = y1 - y0;
      const ao = span > 0.04 ? this.ao : 0;
      for (let i = 0; i < n; i++) {
        const k = ao ? 1 - ao + ao * Math.pow((pos.getY(i) - y0) / span, 0.6) : 1;
        arr[i * 3] = _c.r * k; arr[i * 3 + 1] = _c.g * k; arr[i * 3 + 2] = _c.b * k;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    this.parts.push(geo);
    return geo;
  }
  build() {
    if (!this.parts.length) return null;
    // merging needs all-indexed or all-non-indexed parts (extrusions come without an index)
    if (this.parts.some(p => !p.index) && this.parts.some(p => p.index)) {
      this.parts = this.parts.map(p => { if (!p.index) return p; const n = p.toNonIndexed(); p.dispose(); return n; });
    }
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const sph = (r, ws = 5, hs = 3) => new THREE.SphereGeometry(r, ws, hs);
export const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
export const cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
