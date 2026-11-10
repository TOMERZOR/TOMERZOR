// Real light from the street lamps nearest to the player. The city has hundreds of lamps and
// draws their pools as cheap additive quads; this keeps a small fixed pool of point lights and
// moves them to whichever lamps are closest, so characters and cars are actually lit at night.
// A light only changes lamp while its intensity is zero, so there is no visible pop.
import * as THREE from 'three';

const WARM = new THREE.Color(0xffb866), COOL = new THREE.Color(0xdfeaff);

export class LampLights {
  constructor(scene, lamps) {
    this.scene = scene; this.lamps = lamps; this.pool = []; this.t = 0; this.near = [];
  }

  setCount(n) {
    while (this.pool.length > n) { const l = this.pool.pop(); this.scene.remove(l.light); l.light.dispose(); }
    while (this.pool.length < n) {
      const light = new THREE.PointLight(0xffb866, 0, 30, 1.7);
      this.scene.add(light);
      this.pool.push({ light, lamp: null, k: 0 });
    }
  }

  update(dt, focus, night) {
    const n = this.pool.length;
    if (!n) return;
    if (night < 0.03) { for (const l of this.pool) l.light.intensity = 0; return; }
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.25;
      // nearest n+1 lamps: the extra one gives the distance at which a light must have faded out
      const best = [];
      for (const lamp of this.lamps) {
        const dx = lamp.x - focus.x, dz = lamp.z - focus.z, d = dx * dx + dz * dz;
        if (d > 4900) continue;
        let i = best.length;
        if (i > n && d >= best[i - 1].d) continue;
        best.push({ lamp, d });
        while (i > 0 && best[i - 1].d > d) { best[i] = best[i - 1]; i--; }
        best[i] = { lamp, d };
        if (best.length > n + 1) best.length = n + 1;
      }
      this.edge = best.length > n ? Math.sqrt(best[n].d) : 70;
      this.near = best.slice(0, n);
    }
    const wanted = new Set(this.near.map((b) => b.lamp));
    for (const l of this.pool) if (l.lamp && wanted.has(l.lamp)) wanted.delete(l.lamp);
    for (const l of this.pool) {
      let target = 0;
      if (l.lamp) {
        const d = Math.hypot(l.lamp.x - focus.x, l.lamp.z - focus.z);
        const stay = this.near.some((b) => b.lamp === l.lamp);
        target = stay ? Math.min(1, Math.max(0, (Math.min(this.edge, 70) - d) / 9)) : 0;
      }
      l.k += (target - l.k) * Math.min(1, dt * 5);
      if (l.k < 0.01 && target === 0) {
        l.k = 0;
        const next = wanted.values().next().value;
        if (next) {
          wanted.delete(next); l.lamp = next;
          l.light.position.set(next.x, next.y - 0.4, next.z);
          l.light.color.copy(next.warm ? WARM : COOL);
          l.light.distance = next.y > 8.5 ? 36 : 30;
        } else if (l.lamp && !this.near.some((b) => b.lamp === l.lamp)) l.lamp = null;
      }
      l.light.intensity = l.k * night * (l.lamp && l.lamp.y > 8.5 ? 115 : 80);
    }
  }
}
