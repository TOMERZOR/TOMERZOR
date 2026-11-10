// Static collision world. The city is flat, so collision is 2D oriented boxes with a
// vertical extent (y0..y1), bucketed in a uniform grid. Characters and vehicles are circles.

const CELL = 16;
const key = (cx, cz) => cx * 4096 + cz;

export class Physics {
  constructor() {
    this.grid = new Map();
    this.boxes = [];
    this._seen = 0;
    this._hit = { x: 0, z: 0, nx: 0, nz: 0, depth: 0, box: null };
  }

  // Oriented box: centre, half extents, yaw (radians, about Y). opts: y0, y1, tag, soft.
  addBox(cx, cz, hw, hd, yaw = 0, opts = {}) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const b = {
      cx, cz, hw, hd, c, s, yaw,
      y0: opts.y0 === undefined ? 0 : opts.y0, y1: opts.y1 === undefined ? 50 : opts.y1,
      tag: opts.tag || null, seen: 0, off: false,
    };
    const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    b.minx = cx - ex; b.maxx = cx + ex; b.minz = cz - ez; b.maxz = cz + ez;
    const x0 = Math.floor(b.minx / CELL), x1 = Math.floor(b.maxx / CELL);
    const z0 = Math.floor(b.minz / CELL), z1 = Math.floor(b.maxz / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = key(x + 2048, z + 2048);
      let l = this.grid.get(k);
      if (!l) { l = []; this.grid.set(k, l); }
      l.push(b);
    }
    this.boxes.push(b);
    return b;
  }

  // Push a circle out of everything it overlaps. Mutates pos {x,z}. Returns the deepest contact or null.
  resolveCircle(pos, r, y0 = 0, y1 = 1.8) {
    const hit = this._hit; let any = false; hit.depth = 0;
    for (let iter = 0; iter < 2; iter++) {
      const gx0 = Math.floor((pos.x - r) / CELL), gx1 = Math.floor((pos.x + r) / CELL);
      const gz0 = Math.floor((pos.z - r) / CELL), gz1 = Math.floor((pos.z + r) / CELL);
      const stamp = ++this._seen;
      for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
        const l = this.grid.get(key(gx + 2048, gz + 2048));
        if (!l) continue;
        for (let i = 0; i < l.length; i++) {
          const b = l[i];
          if (b.seen === stamp || b.off) continue; b.seen = stamp;
          if (y1 < b.y0 || y0 > b.y1) continue;
          const dx = pos.x - b.cx, dz = pos.z - b.cz;
          const lx = dx * b.c + dz * b.s, lz = -dx * b.s + dz * b.c;   // into box space
          const qx = lx < -b.hw ? -b.hw : lx > b.hw ? b.hw : lx;
          const qz = lz < -b.hd ? -b.hd : lz > b.hd ? b.hd : lz;
          let nx = lx - qx, nz = lz - qz;
          let d2 = nx * nx + nz * nz;
          let depth;
          if (d2 > r * r) continue;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2); nx /= d; nz /= d; depth = r - d;
          } else {
            // centre is inside the box: leave through the nearest face
            const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz);
            if (px < pz) { nx = lx < 0 ? -1 : 1; nz = 0; depth = px + r; }
            else { nx = 0; nz = lz < 0 ? -1 : 1; depth = pz + r; }
          }
          const wx = nx * b.c - nz * b.s, wz = nx * b.s + nz * b.c;     // back to world
          pos.x += wx * depth; pos.z += wz * depth;
          if (depth > hit.depth) { hit.depth = depth; hit.nx = wx; hit.nz = wz; hit.box = b; hit.x = pos.x - wx * r; hit.z = pos.z - wz * r; }
          any = true;
        }
      }
      if (!any) break;
    }
    return any ? hit : null;
  }

  // Is a circle free of static geometry?
  circleFree(x, z, r, y0 = 0, y1 = 1.8) {
    const gx0 = Math.floor((x - r) / CELL), gx1 = Math.floor((x + r) / CELL);
    const gz0 = Math.floor((z - r) / CELL), gz1 = Math.floor((z + r) / CELL);
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
      const l = this.grid.get(key(gx + 2048, gz + 2048));
      if (!l) continue;
      for (let i = 0; i < l.length; i++) {
        const b = l[i];
        if (b.off || y1 < b.y0 || y0 > b.y1) continue;
        const dx = x - b.cx, dz = z - b.cz;
        const lx = dx * b.c + dz * b.s, lz = -dx * b.s + dz * b.c;
        const qx = lx < -b.hw ? -b.hw : lx > b.hw ? b.hw : lx;
        const qz = lz < -b.hd ? -b.hd : lz > b.hd ? b.hd : lz;
        if ((lx - qx) ** 2 + (lz - qz) ** 2 < r * r) return false;
      }
    }
    return true;
  }

  // Ray against the boxes. Origin (ox,oy,oz), unit direction (dx,dy,dz). Returns distance or max.
  raycast(ox, oy, oz, dx, dy, dz, max) {
    let best = max;
    const steps = Math.ceil(max / CELL) + 1;
    const stamp = ++this._seen;
    let lastK = -1;
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(max, s * CELL);
      const px = ox + dx * t, pz = oz + dz * t;
      const gx = Math.floor(px / CELL), gz = Math.floor(pz / CELL);
      for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) {
        const k = key(gx + ax + 2048, gz + az + 2048);
        if (k === lastK) continue;
        const l = this.grid.get(k);
        if (!l) continue;
        for (let i = 0; i < l.length; i++) {
          const b = l[i];
          if (b.seen === stamp || b.off) continue; b.seen = stamp;
          const rx = ox - b.cx, rz = oz - b.cz;
          const lox = rx * b.c + rz * b.s, loz = -rx * b.s + rz * b.c;
          const ldx = dx * b.c + dz * b.s, ldz = -dx * b.s + dz * b.c;
          let t0 = 0, t1 = best;
          // slab X
          if (Math.abs(ldx) < 1e-9) { if (lox < -b.hw || lox > b.hw) continue; }
          else {
            let a = (-b.hw - lox) / ldx, c = (b.hw - lox) / ldx; if (a > c) { const q = a; a = c; c = q; }
            if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue;
          }
          if (Math.abs(ldz) < 1e-9) { if (loz < -b.hd || loz > b.hd) continue; }
          else {
            let a = (-b.hd - loz) / ldz, c = (b.hd - loz) / ldz; if (a > c) { const q = a; a = c; c = q; }
            if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue;
          }
          if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) continue; }
          else {
            let a = (b.y0 - oy) / dy, c = (b.y1 - oy) / dy; if (a > c) { const q = a; a = c; c = q; }
            if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue;
          }
          if (t0 < best) best = t0;
        }
      }
      if (t >= best) break;
    }
    return best;
  }

  // Line of sight at chest height between two points on the ground plane.
  los(ax, az, bx, bz, y = 1.4) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    return this.raycast(ax, y, az, dx / len, 0, dz / len, len) >= len - 0.05;
  }
}
