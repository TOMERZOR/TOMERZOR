// Turns the raw Higgsfield GLBs in assets/raw into the game-ready files in assets/models
// and assets/anim: textures resized and re-encoded as WebP, geometry meshopt-compressed,
// character animations split into skeleton-only clip files that the game retargets at load.
//
//   cd tools && npm i && node build-assets.mjs            (all)
//   node build-assets.mjs c_hero v_sedan                  (some)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(here, '../assets/raw');
const OUT = path.join(here, '../assets/models');
const ANIM = path.join(here, '../assets/anim');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(ANIM, { recursive: true });

await MeshoptEncoder.ready;
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
};
// clip name -> raw file. The clip is stored without mesh; the game retargets it onto every character.
const CLIPS = {
  idle: 'c_hero.glb', walk: 'hero_walk.glb', run: 'clip_run.glb', jab: 'clip_jab.glb', hook: 'clip_hook.glb',
  kick: 'clip_kick.glb', hit: 'clip_hit.glb', knockdown: 'clip_knockdown.glb', standup: 'clip_standup.glb',
  sit: 'clip_sit.glb', talk: 'clip_talk.glb', jump: 'clip_jump.glb', guard: 'clip_guard.glb', dance: 'clip_dance.glb',
};

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
  await doc.transform(
    dedup(), prune({ keepLeaves: true }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [m.tex, m.tex], quality: 82 }),
    ...(m.char ? [] : [weld()]),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const out = path.join(OUT, name + '.glb');
  await io.write(out, doc);
  console.log('model', name, kb(src), '->', kb(out));
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
