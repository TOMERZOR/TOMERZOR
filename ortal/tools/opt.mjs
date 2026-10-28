// optimize a character/prop GLB for the web: drop clips, 1024px webp textures, meshopt
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { textureCompress, prune, dedup, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
const [,, inp, out, size='1024', keepAnim='0'] = process.argv;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(inp);
if (keepAnim !== '1') for (const a of doc.getRoot().listAnimations()) a.dispose();
// Clean the auto-rig's skin weights: a vertex belongs to one limb (plus the
// body where the limb joins it). Stray weights make hands and hair stretch.
const GROUP = (n) => /^Left(Shoulder|Arm|ForeArm|Hand)/.test(n) ? 'armL' : /^Right(Shoulder|Arm|ForeArm|Hand)/.test(n) ? 'armR'
  : /^Left(UpLeg|Leg|Foot|ToeBase)/.test(n) ? 'legL' : /^Right(UpLeg|Leg|Foot|ToeBase)/.test(n) ? 'legR' : 'core';
const DISTAL = (n) => /(ForeArm|Hand|Leg$|Foot|ToeBase)/.test(n) && !/UpLeg/.test(n);
let fixed = 0;
for (const node of doc.getRoot().listNodes()) {
  const skin = node.getSkin(); const mesh = node.getMesh();
  if (!skin || !mesh) continue;
  const names = skin.listJoints().map(j => j.getName());
  for (const prim of mesh.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0'), Wt = prim.getAttribute('WEIGHTS_0');
    const ja = J.getArray(), wa = Wt.getArray();
    const n = J.getCount();
    {
      const jy = {}; for (const j of skin.listJoints()) jy[j.getName()] = j.getWorldTranslation()[1];
      const P0 = prim.getAttribute('POSITION').getArray();
      const BAND = +(process.env.BAND || 0.04);
      for (let v = 0; v < n; v++) {
        for (const side of ['armL', 'armR']) {
          const sh = jy[side === 'armL' ? 'LeftArm' : 'RightArm'];
          if (P0[v*3+1] > sh - BAND) continue;
          let a = 0; for (let k = 0; k < 4; k++) if (GROUP(names[ja[v*4+k]]) === side) a += wa[v*4+k];
          if (a === 0 || a === 1) continue;
          const keepArm = a >= 0.5; let tot = 0;
          for (let k = 0; k < 4; k++) { const inArm = GROUP(names[ja[v*4+k]]) === side; if (inArm !== keepArm) wa[v*4+k] = 0; tot += wa[v*4+k]; }
          if (tot > 0) for (let k = 0; k < 4; k++) wa[v*4+k] /= tot;
        }
      }
    }
    for (let v = 0; v < n; v++) {
      const sums = { core: 0, armL: 0, armR: 0, legL: 0, legR: 0 };
      for (let k = 0; k < 4; k++) sums[GROUP(names[ja[v*4+k]])] += wa[v*4+k];
      let dom = 'core'; for (const g in sums) if (sums[g] > sums[dom]) dom = g;
      let distal = 0; for (let k = 0; k < 4; k++) { const nm = names[ja[v*4+k]]; if (GROUP(nm) === dom && DISTAL(nm)) distal += wa[v*4+k]; }
      let changed = false, total = 0;
      for (let k = 0; k < 4; k++) {
        const nm = names[ja[v*4+k]], g = GROUP(nm), w = wa[v*4+k];
        if (w === 0) continue;
        let drop = false;
        if (dom.startsWith('arm')) drop = g !== dom && !(g === 'core' && distal < 0.5);
        else if (dom.startsWith('leg')) drop = g !== dom && g !== 'core';
        else drop = g !== 'core' && DISTAL(nm);
        if (drop) { wa[v*4+k] = 0; changed = true; } else total += w;
      }
      if (changed) { fixed++; if (total > 0) for (let k = 0; k < 4; k++) wa[v*4+k] /= total; }
    }
    Wt.setArray(wa);
    // cut triangles that weld a forearm or hand onto the body or a leg
    // (image-to-3D fuses hands that touched the hips in the source picture)
    const dom = new Array(n), distalV = new Array(n);
    for (let v = 0; v < n; v++) {
      const sums = {}; let top = '', tw = -1;
      for (let k = 0; k < 4; k++) { const nm = names[ja[v*4+k]], w = wa[v*4+k]; const g = GROUP(nm); sums[g] = (sums[g]||0) + w; if (w > tw) { tw = w; top = nm; } }
      let d = 'core'; for (const g in sums) if (sums[g] > (sums[d]||0)) d = g;
      dom[v] = d; distalV[v] = /(ForeArm|Hand)/.test(top);
    }
    // armpit: the sleeve fused to the side of the torso below the shoulder joint
    const jointY = {};
    for (const j of skin.listJoints()) jointY[j.getName()] = j.getWorldTranslation()[1];
    const pos = prim.getAttribute('POSITION').getArray();
    const ARMPIT = +(process.env.ARMPIT || 0.05);
    const lowArm = (v) => { const d = dom[v]; if (!d.startsWith('arm')) return false; const sh = jointY[d === 'armL' ? 'LeftArm' : 'RightArm']; return pos[v*3+1] < sh - ARMPIT; };
    const ind = prim.getIndices(); const ia = ind.getArray(); const keep = [];
    let cut = 0;
    for (let t = 0; t < ia.length; t += 3) {
      const vs = [ia[t], ia[t+1], ia[t+2]];
      const gs = new Set(vs.map(v => dom[v]));
      const arms = [...gs].filter(g => g.startsWith('arm')), legs = [...gs].filter(g => g.startsWith('leg'));
      let bad = arms.length && legs.length;
      if (!bad && gs.size > 1 && arms.length) bad = vs.some(v => dom[v].startsWith('arm') && (distalV[v] || lowArm(v)));
      if (bad) { cut++; continue; }
      keep.push(...vs);
    }
    ind.setArray(new (ia.constructor)(keep));
    console.log('cut', cut, 'bridge triangles');
  }
}
console.log('weights fixed on', fixed, 'vertices');
await doc.transform(
  prune(), dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+size, +size], quality: 82 }),
  quantize({ quantizeNormal: 10, quantizePosition: 14, quantizeTexcoord: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(out, doc);
console.log(out, (await import('fs')).statSync(out).size);
