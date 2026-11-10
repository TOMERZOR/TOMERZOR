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

const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const kb = (f) => Math.round(fs.statSync(f).size / 1024) + 'k';

for (const [name, m] of Object.entries(MODELS)) {
  if (!want(name)) continue;
  const src = path.join(RAW, m.src);
  if (!fs.existsSync(src)) { console.log('skip (missing)', name); continue; }
  const doc = await io.read(src);
  const root = doc.getRoot();
  if (m.char) for (const a of root.listAnimations()) a.dispose();
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
