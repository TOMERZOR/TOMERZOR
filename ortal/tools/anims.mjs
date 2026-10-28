// Pack the animation clips into one small file of rotation deltas from each rig's rest pose.
import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const dir = process.argv[2], out = process.argv[3];
const FPS = 30;
const io = new NodeIO();
const qmul = (a, b) => [
  a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
  a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
  a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
  a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
function slerp(a, b, t) {
  let d = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]; let bb = b;
  if (d < 0) { d = -d; bb = b.map(v => -v); }
  if (d > 0.9995) { const r = a.map((v,i)=>v+(bb[i]-v)*t); const l=Math.hypot(...r); return r.map(v=>v/l); }
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1-t)*th)/s, wb = Math.sin(t*th)/s;
  return a.map((v,i)=>v*wa+bb[i]*wb);
}
function sample(times, vals, n, t) {
  if (t <= times[0]) return vals.slice(0, n);
  const L = times.length;
  if (t >= times[L-1]) return vals.slice((L-1)*n, L*n);
  let i = 0; while (times[i+1] < t) i++;
  const u = (t - times[i]) / (times[i+1] - times[i]);
  const a = vals.slice(i*n, i*n+n), b = vals.slice((i+1)*n, (i+1)*n+n);
  return n === 4 ? slerp(a, b, u) : a.map((v,k)=>v+(b[k]-v)*u);
}
let bones = null;
const clips = {};
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.glb')).sort()) {
  const name = f.replace('.glb','');
  const doc = await io.read(dir + '/' + f);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  if (!bones) bones = joints.map(j => j.getName());
  const rest = {}; for (const j of joints) rest[j.getName()] = { r: j.getRotation(), t: j.getTranslation() };
  const anim = root.listAnimations()[0];
  let dur = 0;
  const ch = {};
  for (const c of anim.listChannels()) {
    const node = c.getTargetNode(), path = c.getTargetPath(), s = c.getSampler();
    const times = Array.from(s.getInput().getArray()), vals = Array.from(s.getOutput().getArray());
    dur = Math.max(dur, times[times.length-1]);
    ch[node.getName() + '|' + path] = { times, vals };
  }
  const n = Math.max(2, Math.round(dur * FPS) + 1);
  const R = new Int16Array(n * bones.length * 4);
  const H = new Int16Array(n * 3);
  const hipsY = rest['Hips'].t[1];
  for (let k = 0; k < n; k++) {
    const t = Math.min(dur, k / FPS);
    bones.forEach((b, bi) => {
      const c = ch[b + '|rotation'];
      const q = c ? sample(c.times, c.vals, 4, t) : rest[b].r;
      let d = qmul(qinv(rest[b].r), q);
      if (d[3] < 0) d = d.map(v=>-v);
      for (let m = 0; m < 4; m++) R[(k*bones.length + bi)*4 + m] = Math.round(Math.max(-1, Math.min(1, d[m])) * 32767);
    });
    const ct = ch['Hips|translation'];
    const p = ct ? sample(ct.times, ct.vals, 3, t) : rest['Hips'].t;
    for (let m = 0; m < 3; m++) H[k*3+m] = Math.round(Math.max(-4, Math.min(4, (p[m] - rest['Hips'].t[m]) / hipsY)) * 8000);
  }
  clips[name] = { n, dur: +dur.toFixed(3), r: Buffer.from(R.buffer).toString('base64'), h: Buffer.from(H.buffer).toString('base64') };
  console.log(name, 'dur', dur.toFixed(2), 'frames', n);
}
fs.writeFileSync(out, JSON.stringify({ fps: FPS, bones, clips }));
console.log('bones', bones.join(','), 'size', fs.statSync(out).size);
