// Bootstrap: renderer, loading, input routing, menus and the main loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHARACTERS, NPC_TYPES, UPGRADE_COST } from './config.js';
import * as Save from './save.js';
import { Assets, loadImage } from './assets.js';
import { World } from './world.js';
import { Track } from './track.js';
import { Player } from './player.js';
import { FX } from './fx.js';
import { Game, VOICE_FILES } from './game.js';
import { UI } from './ui.js';
import { createInput } from './input.js';
import { initAudio, setAudioSettings, startMusic, setMusicMode, duckMusic, sfx, loadVoices } from './audio.js';
import { haptic, setHaptics } from './haptics.js';
import { Look, patchCurvedWorld } from './look.js';
import { T } from './i18n.js';
import { MODEL_PROPS } from './props.js';

patchCurvedWorld();

const save = Save.load();
const canvas = document.getElementById('game');

// ---------- renderer ----------
const dpr = window.devicePixelRatio || 1;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: save.settings.quality !== 'low' && dpr < 2.5, powerPreference: 'high-performance', stencil: false });
} catch (e) {
  document.getElementById('load-tip').textContent = T.noWebGL;
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 260);
const look = new Look(renderer, scene, camera);

const quality = { ratio: 1, shadows: true, frames: [] };
function applyQuality(reset = true) {
  const q = Save.get().settings.quality;
  if (reset) {
    // phones are 2-3x screens: render at (close to) their real resolution or everything looks soft
    quality.ratio = q === 'high' ? Math.min(dpr, 2.5) : q === 'low' ? Math.min(dpr, 1.25) : Math.min(dpr, 2);
    quality.shadows = q !== 'low';
    quality.post = q === 'high' ? 'high' : q === 'low' ? 'low' : 'mid';
  }
  renderer.setPixelRatio(quality.ratio);
  if (world) world.setShadows(quality.shadows, quality.post !== 'low', quality.post === 'low' ? 1024 : 2048);
  look.setMode(quality.post, window.innerWidth, window.innerHeight, quality.ratio);
  resize();
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the three lanes and some stalls in view on narrow portrait screens
  // keep any running FOV kick on top of the new base instead of snapping it away
  const base = camera.aspect < 0.62 ? 70 : camera.aspect < 1 ? 64 : 56;
  camera.fov += base - (camera.userData.baseFov ?? camera.fov);
  camera.userData.baseFov = base;
  camera.updateProjectionMatrix();
  look.resize(w, h, quality.ratio);
  if (fx) fx.setScale(h * quality.ratio);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- systems ----------
const assets = new Assets();
let world = null, track = null, player = null, fx = null, game = null;
let previewId = null;

const ui = new UI({
  click: () => { sfx.click(); haptic('tap'); },
  tick: () => sfx.countdown(false),
  denied: () => { sfx.denied(); haptic('stumble'); },
  play: () => startRun(),
  pause: () => pause(true),
  resume: () => pause(false),
  restart: () => { if (game && game.state === 'paused') game.bankRun(); ui.overlay('pause', false); ui.overlay('over', false); startRun(); },
  home: () => goHome(),
  sheet: id => {
    if (id === 'chars') { player.setMode('dance'); }
    else if (!id) { player.setMode('menu'); }
  },
  previewChar: async id => {
    const want = id || Save.get().selected;
    if (previewId === want) return;
    previewId = want;
    ui.setCharLoading(true);
    try { await player.setCharacter(want); } catch (e) { /* keep the current model */ }
    if (previewId !== want) return; // a newer preview replaced this one
    ui.setCharLoading(false);
    if (game && game.state === 'menu') player.setMode(id && ui.current === 'chars' ? 'dance' : 'menu');
  },
  selectChar: id => {
    const s = Save.get(); s.selected = id; Save.save();
    sfx.mission(); haptic('buy');
    refreshPedestrians();
  },
  buyChar: id => {
    const s = Save.get();
    const c = CHARACTERS.find(x => x.id === id);
    if (!c || s.coins < c.price || s.owned.includes(id)) return;
    s.coins -= c.price; s.owned.push(id); s.selected = id; Save.save();
    sfx.buy(); haptic('buy');
    fx.confetti(player.x, 1.4, 0.6);
    refreshPedestrians();
  },
  upgrade: (k, cost) => {
    const s = Save.get();
    if (s.coins < cost || s.upgrades[k] >= UPGRADE_COST.length) return;
    s.coins -= cost; s.upgrades[k] = (s.upgrades[k] || 0) + 1; Save.save();
    sfx.buy(); haptic('buy');
  },
  setting: (k, v) => {
    const s = Save.get();
    s.settings[k] = v; Save.save();
    setAudioSettings(s.settings); setHaptics(s.settings.haptics);
    if (k === 'quality') applyQuality(true);
  },
  resetProgress: () => { Save.reset(); setAudioSettings(Save.get().settings); setHaptics(true); goHome(); player.setCharacter('tzabar'); },
});

setAudioSettings(save.settings);
setHaptics(save.settings.haptics);

// ---------- loading ----------
const TIPS = T.tips;
const tipOffset = Math.floor(Math.random() * TIPS.length);

async function boot() {
  let done = 0; const steps = 34;
  const tick = (n = 1) => { done += n; ui.setLoading(Math.min(1, done / steps), TIPS[(tipOffset + Math.floor(done / 5)) % TIPS.length]); };
  try {
    await Promise.race([Promise.all([document.fonts.load('700 40px Fredoka', 'אבג abc'), document.fonts.load('600 20px Fredoka', 'אבג abc'), document.fonts.load('500 20px Fredoka', 'אבג abc')]), new Promise(r => setTimeout(r, 2500))]).catch(() => {});
    tick();
    const [facade, paving, m1, m2, m3, decals] = await Promise.all(['img/facade.webp', 'img/paving.webp', 'img/mural1.jpg', 'img/mural2.jpg', 'img/mural3.jpg', 'img/decals.webp'].map(u => loadImage(u).catch(e => { if (u.includes('decals')) return null; throw e; }).finally(() => tick())));
    await assets.loadAnims('models/anims.glb'); tick(2);
    fx = new FX(scene);
    world = new World(scene, renderer, { facade, paving, decals, murals: [m1, m2, m3] });
    player = new Player(scene, assets);
    track = new Track(scene, assets, fx);
    await player.setCharacter(Save.get().selected).catch(() => player.setCharacter('tzabar')); tick(3);
    previewId = Save.get().selected;
    await Promise.all(Object.keys(NPC_TYPES).map(t => assets.npc(t).then(() => tick())));
    world.setVendorTemplates([assets.npcs.vendor?.scene, assets.npcs.chabad?.scene]);
    // generated set pieces and obstacles; anything that fails to load falls back to procedural geometry
    const props = {};
    await Promise.all(['fruit', 'spice', 'sweets', 'truck'].map(n => assets.prop('st_' + n).then(async p => {
      p.lo = await assets.prop(`st_${n}_lo`).catch(() => null); // optional far-distance version
      props[n] = p;
    }, () => {}).finally(() => tick())));
    await Promise.all(['crates', 'melons'].map(n => assets.prop('ob_' + n).then(p => { MODEL_PROPS[n] = p; }, () => {})));
    world.setPropModels(props);
    for (const _ of world.buildSteps()) { tick(0.6); await frame(); }
    game = new Game({ scene, camera, world, track, player, fx, ui, assets });
    window.__shuk = { game, renderer, scene, camera, Save };
    await game.initChaser(); tick();
    world.reset(0);
    track.reset({});
    applyQuality(true);
    await warmup(); tick(3);
    player.setMode('menu');
    ui.setLoading(1);
    ui.showEnter(enter);
    loadOtherCharacters();
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    ui.loadError(T.loadError);
  }
}
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

// compile shaders and upload textures for everything that can appear in a run
async function warmup() {
  const tmp = [];
  const types = ['crates', 'melons', 'sacks', 'barrier', 'tefillin', 'banner', 'rugs', 'bannerWide', 'truck', 'truckR', 'van',
    'pow:magnet', 'pow:x2', 'pow:sneakers', 'pow:hamsa', ...Object.keys(NPC_TYPES).map(t => 'npc:' + t)];
  for (const t of types) { const o = track.acquireSync(t); o.visible = true; o.position.set((tmp.length % 5 - 2) * 2, 0, -6 - Math.floor(tmp.length / 5) * 3); tmp.push([t, o]); }
  camera.position.set(0, 3, 6); camera.lookAt(0, 1, -8);
  // render through the post chain so the programs compiled are the ones real frames use
  look.render(0, 0);
  await frame();
  for (const [t, o] of tmp) track.recycle(t, o);
}

async function loadOtherCharacters() {
  // pedestrians are the playable characters you're not currently using
  for (const c of CHARACTERS) {
    try { await assets.character(c.id); } catch (e) { continue; }
    refreshPedestrians();
    await new Promise(r => setTimeout(r, 120));
  }
}
function refreshPedestrians() {
  if (!track) return;
  track.pedChars = Object.keys(assets.chars).filter(id => id !== 'cat');
}

let entered = false;
function enter() {
  if (entered) return;
  entered = true;
  initAudio();
  setAudioSettings(Save.get().settings);
  loadVoices(VOICE_FILES);
  startMusic('menu');
  haptic('tap');
  ui.menu();
}

// ---------- flow ----------
let starting = false;
function startRun() {
  if (!game || starting) return;
  initAudio();
  previewId = Save.get().selected;
  const startIt = () => {
    starting = false;
    ui.overlay('over', false); ui.overlay('pause', false);
    game.startRun();
    setMusicMode('run'); duckMusic(false);
    startMusic('run');
    quality.samples = 0; quality.slowFrames = 0;
  };
  if (player.charId !== Save.get().selected) {
    starting = true;
    player.setCharacter(Save.get().selected).then(startIt).catch(() => {
      // the selected model failed to load: fall back to the free character
      const s = Save.get(); s.selected = 'tzabar'; Save.save(); previewId = 'tzabar';
      player.setCharacter('tzabar').then(startIt).catch(() => { starting = false; ui.toast(...T.connection); });
    });
  } else startIt();
}

function pause(on) {
  if (!game) return;
  if (on && game.state === 'playing') { game.state = 'paused'; ui.pause(true); duckMusic(true); }
  else if (!on && game.state === 'paused') { game.state = 'playing'; ui.pause(false); duckMusic(false); game.run.acc = 0; }
}

function goHome() {
  if (!game) return;
  if (game.state === 'paused') game.bankRun();
  ui.overlay('over', false); ui.overlay('pause', false); ui.overlay('revive', false);
  game.state = 'menu';
  game.run = null;
  track.reset({});
  world.reset(0);
  world.snapTheme('day');
  fx.clear();
  player.reset();
  player.setMode('menu');
  if (player.charId !== Save.get().selected) { previewId = Save.get().selected; player.setCharacter(Save.get().selected); }
  setMusicMode('menu'); duckMusic(false);
  ui.menu();
}

createInput(canvas, (a, fromKey) => {
  if (!game || !entered) { if (a === 'tap' && !entered && fromKey && document.getElementById('btn-enter').offsetParent) enter(); return; }
  if (game.state === 'playing') {
    if (a === 'pause') pause(true); else game.action(a);
  } else if (game.state === 'paused') {
    if (a === 'pause' || (fromKey && a === 'tap')) pause(false);
  } else if (game.state === 'menu' && ui.current === 'menu') {
    if (a === 'up' || a === 'tap' || a === 'left' || a === 'right' || a === 'down') startRun();
  }
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
// iOS can suspend/interrupt audio (calls, background); any touch brings it back
document.addEventListener('pointerdown', () => { if (entered) initAudio(); }, { passive: true });
window.addEventListener('blur', () => pause(true));

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  if (window.__shuk && window.__shuk.manual) { last = now; return; }
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) return;
  dt = Math.min(dt, 1 / 20);
  if (game.state !== 'paused') { const reps = (window.__shuk && window.__shuk.speedup) || 1; for (let i = 0; i < reps; i++) game.update(dt); }
  else game.updateCamera(0);
  look.setZone(world.cur.glow);
  const sp = game.state === 'playing' && game.run ? THREE.MathUtils.clamp((game.run.speed - 21) / 13, 0, 1) : 0;
  look.render(game.time, sp);
  adaptQuality(dt);
}

// Auto quality: step down only when a device really can't keep up. The first seconds of a run (shader
// compiles, uploads) don't count, and the median frame time is used so a 30 Hz-capped phone (low power
// mode) or the odd hitch doesn't blur the picture for nothing.
const RATIO_FLOOR = Math.min(dpr, dpr >= 2 ? 1.25 : 0.85);
function adaptQuality(dt) {
  if (Save.get().settings.quality !== 'auto' || !game || game.state !== 'playing' || !game.run || game.run.time < 3) { quality.frames.length = 0; return; }
  quality.frames.push(dt);
  if (quality.frames.length < 150) return;
  const median = quality.frames.sort((a, b) => a - b)[75];
  quality.frames.length = 0;
  if (median < 1 / 26) return;
  // resolution first (down to a floor that still looks sharp), then the post chain, then shadows
  if (quality.ratio > RATIO_FLOOR) quality.ratio = Math.max(RATIO_FLOOR, quality.ratio - 0.25);
  else if (quality.post !== 'low') quality.post = 'low';
  else if (quality.shadows) quality.shadows = false;
  else return;
  applyQuality(false);
}

boot();
