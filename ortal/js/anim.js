// Turns the packed clips (models/anims.json: rotation deltas from the rest pose
// of the rig they were made on) into three.js clips for any of the fighters.
// All the fighters share the same 24-bone rig layout, so a delta made on one
// fits the others: target = targetRest * delta.

import * as THREE from "three";

function b64(s, Type) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(u8.buffer);
}

export function decodePack(pack) {
  const out = { fps: pack.fps, bones: pack.bones, clips: {} };
  for (const [name, c] of Object.entries(pack.clips)) {
    out.clips[name] = { n: c.n, dur: c.dur, r: b64(c.r, Int16Array), h: b64(c.h, Int16Array) };
  }
  return out;
}

// opts: { inPlace: keep the hips over the feet (default true) }
export function buildClips(pack, root, opts = {}) {
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const restQ = {}, restP = {};
  for (const [n, b] of Object.entries(bones)) { restQ[n] = b.quaternion.clone(); restP[n] = b.position.clone(); }
  const hipsY = restP.Hips ? restP.Hips.y : 1;
  const clips = {};
  const q = new THREE.Quaternion(), d = new THREE.Quaternion();
  for (const [name, c] of Object.entries(pack.clips)) {
    const times = new Float32Array(c.n);
    for (let k = 0; k < c.n; k++) times[k] = k / pack.fps;
    const tracks = [];
    pack.bones.forEach((bn, bi) => {
      const b = bones[bn];
      if (!b) return;
      const vals = new Float32Array(c.n * 4);
      for (let k = 0; k < c.n; k++) {
        const o = (k * pack.bones.length + bi) * 4;
        d.set(c.r[o] / 32767, c.r[o + 1] / 32767, c.r[o + 2] / 32767, c.r[o + 3] / 32767).normalize();
        q.copy(restQ[bn]).multiply(d);
        vals.set([q.x, q.y, q.z, q.w], k * 4);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(b.name + ".quaternion", times, vals));
    });
    if (bones.Hips) {
      const vals = new Float32Array(c.n * 3);
      const keepXZ = opts.inPlace === false;
      for (let k = 0; k < c.n; k++) {
        const x = c.h[k * 3] / 8000, y = c.h[k * 3 + 1] / 8000, z = c.h[k * 3 + 2] / 8000;
        vals[k * 3] = restP.Hips.x + (keepXZ ? x * hipsY : 0);
        vals[k * 3 + 1] = restP.Hips.y + y * hipsY;
        vals[k * 3 + 2] = restP.Hips.z + (keepXZ ? z * hipsY : 0);
      }
      tracks.push(new THREE.VectorKeyframeTrack(bones.Hips.name + ".position", times, vals));
    }
    clips[name] = new THREE.AnimationClip(name, c.dur, tracks);
    clips[name].rootDelta = (k) => [c.h[k * 3] / 8000 * hipsY, c.h[k * 3 + 1] / 8000 * hipsY, c.h[k * 3 + 2] / 8000 * hipsY];
  }
  return clips;
}
