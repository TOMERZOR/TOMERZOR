// Turns the raw Higgsfield GLBs in assets/raw into the game-ready files in assets/models
// and assets/anim: textures resized and re-encoded as WebP, geometry meshopt-compressed,
// character animations split into skeleton-only clip files that the game retargets at load.
//
//   cd tools && npm i && node build-assets.mjs            (all)
//   node build-assets.mjs c_hero v_sedan                  (some)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, meshopt, weld, simplify, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(here, '../assets/raw');
const OUT = path.join(here, '../assets/models');
const ANIM = path.join(here, '../assets/anim');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(ANIM, { recursive: true });

await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// name -> { src (file in raw), tex (max texture edge), keepAnim }
const MODELS = {
  c_hero: { src: 'c_hero.glb', tex: 1024, char: true },
  c_shimi: { src: 'rig_shimi.glb', tex: 1024, char: true },
  c_rival: { src: 'rival_rig.glb', tex: 1024, char: true },
  c_goon: { src: 'rig_goon.glb', tex: 1024, char: true },
  c_cop: { src: 'rig_cop.glb', tex: 1024, char: true },
  c_savta: { src: 'rig_savta.glb', tex: 1024, char: true },
  c_dod: { src: 'rig_dod.glb', tex: 1024, char: true },
  c_girl: { src: 'rig_girl.glb', tex: 1024, char: true },
  c_boss: { src: 'rig_boss.glb', tex: 1024, char: true },
  c_mom: { src: 'rig_mom.glb', tex: 1024, char: true },
  v_sedan: { src: 'v_sedan.glb', tex: 1024 },
  v_hatch: { src: 'v_hatch.glb', tex: 1024 },
  v_pickup: { src: 'v_pickup.glb', tex: 1024 },
  v_van: { src: 'v_van.glb', tex: 1024 },
  v_police: { src: 'v_police.glb', tex: 1024 },
  v_armored: { src: 'v_armored.glb', tex: 1024 },
  v_truck: { src: 'v_truck.glb', tex: 1024 },
  v_bus: { src: 'v_bus.glb', tex: 1024 },
  v_tractor: { src: 'v_tractor.glb', tex: 1024 },
  v_moped: { src: 'v_moped.glb', tex: 1024 },
  p_dumpster: { src: 'p_dumpster.glb', tex: 512 },
  p_chair: { src: 'p_chair.glb', tex: 256 },
  p_cat: { src: 'p_cat.glb', tex: 512 },
  p_atm: { src: 'p_atm.glb', tex: 512 },
  // the neighbourhood itself: `tris` is the triangle budget each piece is simplified to
  b_blockA: { src: 'env/blockA.glb', tex: 2048, tris: 9000, half: '+x' },
  b_blockB: { src: 'env/blockB.glb', tex: 2048, tris: 9000, half: '+x' },
  b_blockC: { src: 'env/blockC.glb', tex: 2048, tris: 9000, half: '+x' },
  b_shops: { src: 'env/shops.glb', tex: 4096, tris: 30000 },
  b_school: { src: 'env/school.glb', tex: 2048, tris: 30000 },
  b_police: { src: 'env/police.glb', tex: 2048, tris: 30000 },
  b_bituach: { src: 'env/bituach.glb', tex: 2048, tris: 30000 },
  b_city: { src: 'env/city.glb', tex: 2048, tris: 30000 },
  b_wedding: { src: 'env/wedding.glb', tex: 2048, tris: 30000 },
  b_matnas: { src: 'env/matnas.glb', tex: 2048, tris: 30000 },
  b_garage: { src: 'env/garage.glb', tex: 2048, tris: 30000 },
  b_scrap: { src: 'env/scrap.glb', tex: 2048, tris: 30000 },
  b_hangarA: { src: 'env/hangarA.glb', tex: 2048, tris: 18000 },
  b_hangarB: { src: 'env/hangarB.glb', tex: 2048, tris: 18000 },
  b_tower: { src: 'env/tower.glb', tex: 2048, tris: 18000 },
  b_skeleton: { src: 'env/skeleton.glb', tex: 2048, tris: 18000 },
  b_gas: { src: 'env/gas.glb', tex: 2048, tris: 30000 },
  b_station: { src: 'env/station.glb', tex: 2048, tris: 30000 },
  b_shops2: { src: 'env/shops2.glb', tex: 4096, tris: 30000 },
  b_shops3: { src: 'env/shops3.glb', tex: 4096, tris: 30000 },
  b_blockD: { src: 'env/blockD.glb', tex: 2048, tris: 9000, half: '+x' },
  b_blockE: { src: 'env/blockE.glb', tex: 2048, tris: 9000, half: '+x' },
  e_stall: { src: 'env/stall.glb', tex: 1024, tris: 5000 },
  e_bench: { src: 'env/bench.glb', tex: 512, tris: 1500 },
  e_crane: { src: 'env/crane.glb', tex: 1024, tris: 2500 },
  e_lamp: { src: 'env/lamp.glb', tex: 512, tris: 500, half: 'x' },
  e_palm: { src: 'env/palm.glb', tex: 1024, tris: 700 },
  e_ficus: { src: 'env/ficus3.glb', tex: 1024, tris: 7000 },
  e_euc: { src: 'env/euc.glb', tex: 48, tris: 4000, sloppy: 3500 },
  e_bush: { src: 'env/bush.glb', tex: 48, tris: 2500, sloppy: 2200 },
  e_busstop: { src: 'env/busstop.glb', tex: 1024, tris: 2500 },
  e_shelter: { src: 'env/shelter.glb', tex: 1024, tris: 6000 },
};
// clip name -> raw file. The clip is stored without mesh; the game retargets it onto every character.
const CLIPS = {
  idle: 'c_hero.glb', walk: 'hero_walk.glb', run: 'clip_run.glb', jab: 'clip_jab.glb', hook: 'clip_hook.glb',
  kick: 'clip_kick.glb', hit: 'clip_hit.glb', knockdown: 'clip_knockdown.glb', standup: 'clip_standup.glb',
  sit: 'clip_sit.glb', talk: 'clip_talk.glb', jump: 'clip_jump.glb', guard: 'clip_guard.glb', dance: 'clip_dance.glb',
};

const triCount = (root) => root.listMeshes().reduce((n, me) => n + me.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);

// column-major 4x4 helpers (no dependency needed for two functions)
function invert4(a) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d];
}
function quatOf(m) {
  // strip scale, then the usual trace method
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const m00 = m[0] / sx, m10 = m[1] / sx, m20 = m[2] / sx, m01 = m[4] / sy, m11 = m[5] / sy, m21 = m[6] / sy, m02 = m[8] / sz, m12 = m[9] / sz, m22 = m[10] / sz;
  const t = m00 + m11 + m22;
  if (t > 0) { const s = 0.5 / Math.sqrt(t + 1); return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]; }
  if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11); return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

// Remember the true bind pose of every joint (from the inverse bind matrices): node transforms in
// these files are not guaranteed to be the bind pose, and animation retargeting needs it.
function storeBind(root) {
  const skin = root.listSkins()[0]; if (!skin) return;
  const ibm = skin.getInverseBindMatrices(), joints = skin.listJoints();
  joints.forEach((j, i) => {
    const m = invert4(ibm.getElement(i, []));
    j.setExtras({ bq: quatOf(m).map((v) => +v.toFixed(6)), bp: [m[12], m[13], m[14]].map((v) => +v.toFixed(5)) });
  });
}

const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const kb = (f) => Math.round(fs.statSync(f).size / 1024) + 'k';

for (const [name, m] of Object.entries(MODELS)) {
  if (!want(name)) continue;
  const src = path.join(RAW, m.src);
  if (!fs.existsSync(src)) { console.log('skip (missing)', name); continue; }
  const doc = await io.read(src);
  const root = doc.getRoot();
  if (m.char) {
    for (const a of root.listAnimations()) a.dispose();
    storeBind(root);                    // before meshopt rewrites the inverse bind matrices
  }
  for (const mat of root.listMaterials()) {
    if (m.char) {
      // Cloth and skin: fully rough, never metallic, no stray maps.
      mat.setMetallicFactor(0); mat.setRoughnessFactor(0.92);
      mat.setMetallicRoughnessTexture(null); mat.setNormalTexture(null); mat.setOcclusionTexture(null);
    }
    mat.setAlphaMode('OPAQUE');
  }
  const before = triCount(root);
  if (m.half) {
    // the generator sometimes returns the object twice, side by side: keep the copy on one side
    for (const me of root.listMeshes()) for (const p of me.listPrimitives()) {
      const pos = p.getAttribute('POSITION'), idx = p.getIndices().getArray(), ax = { x: 0, y: 1, z: 2 }[m.half.replace('+', '')];
      let lo = Infinity, hi = -Infinity; const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); lo = Math.min(lo, v[ax]); hi = Math.max(hi, v[ax]); }
      const mid = (lo + hi) / 2, keep = [], plus = m.half[0] === '+';
      for (let i = 0; i < idx.length; i += 3) {
        let c = 0; for (let k = 0; k < 3; k++) { pos.getElement(idx[i + k], v); c += v[ax]; }
        if (plus ? c / 3 > mid : c / 3 < mid) keep.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      p.getIndices().setArray(new Uint32Array(keep));
      compactPrimitive(p);
    }
  }
  await doc.transform(
    dedup(), prune({ keepLeaves: true }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [m.tex, m.tex], quality: 82 }),
    ...(m.char ? [] : [weld()]),
    ...(m.tris ? [simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, m.tris / Math.max(1, triCount(root))), error: m.err || 0.01, lockBorder: false })] : []),
  );
  // Foliage is thousands of loose leaves that edge-collapse cannot merge; the grid-based
  // simplifier can, at the price of a rougher silhouette.
  if (m.sloppy && triCount(root) > m.sloppy * 1.3) {
    for (const me of root.listMeshes()) for (const p of me.listPrimitives()) {
      const idx = new Uint32Array(p.getIndices().getArray()), pos = new Float32Array(p.getAttribute('POSITION').getArray());
      const want = Math.max(3, Math.floor((idx.length / 3) * (m.sloppy / triCount(root))) * 3);
      const [out2] = MeshoptSimplifier.simplifySloppy(idx, pos, 3, null, want, 1);
      p.getIndices().setArray(out2);
      compactPrimitive(p);
    }
  }
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = path.join(OUT, name + '.glb');
  await io.write(out, doc);
  console.log('model', name, kb(src), '->', kb(out), m.tris ? `${before} -> ${triCount(root)} tris` : '');
}

for (const [name, file] of Object.entries(CLIPS)) {
  if (!want('anim') && !want('anim_' + name)) continue;
  const src = path.join(RAW, file);
  if (!fs.existsSync(src)) { console.log('skip clip (missing)', name); continue; }
  const doc = await io.read(src);
  const root = doc.getRoot();
  storeBind(root);
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  for (const s of root.listSkins()) s.dispose();
  for (const me of root.listMeshes()) me.dispose();
  for (const ma of root.listMaterials()) ma.dispose();
  for (const t of root.listTextures()) t.dispose();
  const anims = root.listAnimations();
  anims.forEach((a, i) => { if (i < anims.length - 1) a.dispose(); else a.setName(name); });
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }));
  const out = path.join(ANIM, name + '.glb');
  await io.write(out, doc);
  console.log('clip', name, '->', kb(out));
}
