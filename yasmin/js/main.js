// 5 לילות אצל יסמין — bootstrap, loading, menus and the main loop.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Yasmin } from './yasmin.js';
import { Audio } from './audio.js';
import { Post } from './post.js';
import { UI } from './ui.js';
import { Story, NIGHTS, overLine } from './story.js';
import { Mechanics } from './mechanics.js';
import { TAPES, loadTapes, saveTapes } from './ruth.js';
import { opaque, roomAt, isOutdoor, lineOfSight, cellsOf, cellCenter } from './map.js';
import * as T from './textures.js';

const $ = (id) => document.getElementById(id);
// release version (from the ?v= on this module's URL) so asset updates bypass the browser cache
const V = new URL(import.meta.url).searchParams.get('v') || '0';
const store = {
  get(k, d) { try { const v = localStorage.getItem('yasmin5.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('yasmin5.' + k, JSON.stringify(v)); } catch (e) { } },
};

const ui = new UI();
const settings = Object.assign({ sens: 1, vol: 0.9, music: 0.8, bright: 1, quality: 'auto', difficulty: 'normal' }, store.get('settings', {}));
const isTouch = ui.isTouch;
const params0 = new URLSearchParams(location.search);
const quality = params0.get('q') || (settings.quality === 'auto' ? (isTouch || (navigator.deviceMemory && navigator.deviceMemory < 4) ? 'low' : 'high') : settings.quality);
const params = new URLSearchParams(location.search);

// ---------- renderer ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05 * settings.bright;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
T.setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020303);
scene.fog = new THREE.FogExp2(0x070909, 0.075);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 220);
scene.add(camera);
const hemi = new THREE.HemisphereLight(0x8a9aa6, 0x15130f, 0.1);
scene.add(hemi);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.18;
const post = new Post(renderer, scene, camera, quality);
let pr = Math.min(devicePixelRatio, quality === 'low' ? 1.25 : 1.75);
function resize() {
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  post.setSize(innerWidth, innerHeight, pr);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- game ----------
const audio = new Audio();
audio.vol.master = settings.vol; audio.vol.music = settings.music;
audio.onSub = (text, dur) => ui.sub(text, dur);
const game = { ui, audio, quality, state: 'loading', night: 1, clockMin: 0, finale: false, settings };
window.__game = game;
game.dbg = {};

const TIPS = ['היא שומעת ריצה מרחוק.', 'עקבות רטובות = היא הייתה פה עכשיו.', 'פנס דולק = רואים אותך מקצה המסדרון.', 'אם היא ראתה אותך נכנס לארון — היא תפתח אותו.', 'כשהאורות מהבהבים — היא קרובה.', 'התכופפות שקטה יותר מהליכה.', 'נבו ספר 47 מסדרים. אל תהיה ה־48.'];

async function load() {
  ui.progress(0.02, TIPS[Math.floor(Math.random() * TIPS.length)]);
  const parts = { tex: 0, models: 0, audio: 0 };
  const upd = () => ui.progress(parts.tex * 0.3 + parts.models * 0.5 + parts.audio * 0.2);
  const texList = ['wall', 'wall_n', 'floor', 'floor_n', 'floor_r', 'ceiling', 'ceiling_n'];
  let tdone = 0;
  const texP = Promise.all([
    ...texList.map(n => T.loadTex(`img/${n}.webp?v=${V}`, { srgb: !/_n|_r/.test(n) }).then(t => { tdone++; parts.tex = tdone / (texList.length + 1); upd(); return [n, t]; })),
    T.loadTex(`img/nevo_cctv.jpg?v=${V}`, { repeat: false }).then(t => ['nevo_cctv', t]),
    T.loadTex(`img/ruth_ghost.webp?v=${V}`, { repeat: false }).then(t => ['ruth_ghost', t]),
  ]).then(list => Object.fromEntries(list));
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const modelList = ['yasmin', 'nevo', 'bucket', 'labubu', 'squash'];
  let mdone = 0;
  const modP = Promise.all(modelList.map(n => new Promise((res, rej) => loader.load(`models/${n}.glb?v=${V}`, g => { mdone++; parts.models = mdone / modelList.length; upd(); res([n, g]); }, undefined, rej)))).then(l => Object.fromEntries(l));
  const audP = audio.load('audio/', V, p => { parts.audio = p; upd(); });
  const [tex, models] = await Promise.all([texP, modP, audP]);
  game.tex = tex; game.models = models;
  ui.progress(1, 'בונה את הבסיס...');
  await new Promise(r => setTimeout(r, 30));
  build();
}

function build() {
  const world = new World(scene, game.tex, game.models, quality);
  world.build();
  world.solidAt = opaque;
  game.world = world;
  const player = new Player(camera, scene, world, audio, quality);
  player.sens = settings.sens;
  game.player = player;
  game.mech = new Mechanics(game);
  game.mech.init();
  const yasmin = new Yasmin(scene, game.models.yasmin, world, audio);
  yasmin.printTex = T.footprintTex();
  game.yasmin = yasmin;
  const story = new Story(game);
  story.setup();
  game.story = story;
  yasmin.onCaught = (fromLocker) => caught(fromLocker);
  yasmin.onSpot = () => { player.shake = Math.max(player.shake, 0.4); audio.stinger('peek'); };
  game.onLostPlayer = () => { };
  // warm up shaders so the first frames don't hitch
  camera.position.set(3, 1.6, 5);
  renderer.compile(scene, camera);
  player.onKey = onKey;
  player.onLockChange = (locked) => {
    if (!locked && game.state === 'play' && !isTouch) pause(true);
    ui.lockHint(false);
  };
  if (isTouch) ui.bindTouch(player, {
    useDown: () => { useHeld = true; useDown(); }, useUp: () => { useHeld = false; },
    setRun: (on) => { player.touch.runLock = on; }, runToggle: () => player.touch.runLock,
    light: () => player.setLight(!player.lightOn), pause: () => pause(true),
    throw: () => throwBottle(),
  });
  $('btn-enter').classList.remove('hidden');
  $('load-tip').textContent = 'מוכן.';
  game.state = 'ready';
  if (params.has('night')) { enter(); startNight(+params.get('night') || 1); }
}

function enter() {
  audio.resume();
  audio.startAmbience();
  menu();
}
function menu() {
  game.state = 'menu';
  ui.only('menu'); ui.hud(false);
  const best = store.get('night', 1);
  $('btn-play').textContent = best > 1 ? `המשך — לילה ${best}` : 'התחל משמרת';
  const nights = $('nights'); nights.innerHTML = '';
  for (let n = 1; n <= 5; n++) {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = `לילה ${n}`; b.disabled = n > best;
    b.onclick = () => startNight(n);
    nights.appendChild(b);
  }
  game.yasmin && game.yasmin.hide();
  if (document.pointerLockElement) document.exitPointerLock();
  stopTape();
  const tapes = loadTapes(), found = store.get('found', []);
  const won = store.get('won', false);
  $('menu-stats').innerHTML = `קלטות של רות: <b>${tapes.size}/5</b> · גילויים: <b>${found.length}/6</b>${won ? ' · <b>ברחת</b>' + (store.get('ruthFree', false) ? ' · <b>רות חופשייה</b>' : '') : ''}`;
}

function startNight(n) {
  game.night = n;
  game.state = 'card';
  game.clockMin = 0;
  stopTape();
  game.mech.clear();
  ui.hud(false);
  game.story.start(n);
  ui.card(`לילה ${n}`, NIGHTS[n].title, NIGHTS[n].text);
  audio.static_(0.4, 0.05);
}

function play() {
  game.state = 'play';
  ui.only(null); ui.hud(true);
  game.player.enabled = true;
  lockPointer();
  if (game.night === 1 && !game.story.flags.introLine) { game.story.flags.introLine = true; ui.sub('לחץ E כדי לקרוא את הפתק על המיטה', 4); }
}
function lockPointer() {
  if (isTouch) return;
  try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => canvas.requestPointerLock()); } catch (e) { canvas.requestPointerLock(); }
}

function pause(on) {
  if (on && game.state === 'play') {
    game.state = 'pause';
    ui.show('pause', true);
    game.player.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    audio.ctx.suspend && audio.ctx.suspend();
  } else if (!on && game.state === 'pause') {
    ui.show('pause', false); ui.show('settings', false);
    audio.resume();
    game.state = 'play'; game.player.enabled = true;
    lockPointer();
  }
}

// ---------- input ----------
let useHeld = false, holdT = 0, holdTarget = null, current = null;
function onKey(code) {
  if (code === 'KeyE') { useHeld = true; useDown(); }
  if (game.state !== 'play') return;
  if (code === 'KeyF') game.player.setLight(!game.player.lightOn);
  if (code === 'Tab') { const o = $('objectives'); o.style.opacity = o.style.opacity === '0' ? 1 : 0; }
  if (code === 'KeyP') pause(true);
  if (code === 'KeyG' || code === 'KeyQ') throwBottle();
  if (code === 'KeyJ') openJournal();
}
function throwBottle() {
  if (game.state !== 'play') return;
  if (!game.mech.throwBottle()) ui.toast(game.player.bottles ? '' : 'אין לך בקבוקים', 1.2);
}
canvas.addEventListener('mousedown', e => { if (e.button === 2 && game.state === 'play') throwBottle(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keyup', e => { if (e.code === 'KeyE') useHeld = false; });
addEventListener('keydown', e => { if (e.code === 'Tab') e.preventDefault(); if (e.code === 'Escape' && game.state === 'note') closeNote(); });
function useDown() {
  if (game.state === 'note') { closeNote(); return; }
  if (game.state !== 'play') return;
  const P = game.player;
  if (P.hidden) { exitLocker(); return; }
  if (current && !current.hold) { current.use(); current = null; }
}
function closeNote() {
  ui.show('note', false);
  game.state = 'play';
  if (!isTouch && !document.pointerLockElement) lockPointer();
}
canvas.addEventListener('click', () => { if (game.state === 'play' && !document.pointerLockElement) lockPointer(); });
$('note').addEventListener('click', () => closeNote());

game.enterLocker = (L) => {
  const P = game.player, Y = game.yasmin;
  L.target = 1;
  audio.play('sfx_locker', { pos: new THREE.Vector3(L.x, 1, L.z), volume: 1 });
  const seen = Y.visible && (Y.sees(P) > 0 || (Y.state === 'chase' && Y.lostT < 0.5));
  P.enabled = false;
  setTimeout(() => {
    P.hidden = L; P.enabled = true;
    P.yaw = L.ry; P.pitch = 0; P.lightOn = false;
    L.target = 0;
    ui.lockerView(true);
    if (seen) Y.sawHide = L; else if (Y.sawHide !== L) Y.sawHide = null;
    Y.noiseAt(L.x, L.z, 7);
  }, 380);
};
function exitLocker() {
  const P = game.player, L = P.hidden;
  if (!L) return;
  L.target = 1;
  audio.play('sfx_locker', { pos: new THREE.Vector3(L.x, 1, L.z), volume: 0.9 });
  game.yasmin.noiseAt(L.x, L.z, 7);
  P.hidden = null;
  P.pos.set(L.x + L.fwd.x * 0.75, 0, L.z + L.fwd.z * 0.75);
  ui.lockerView(false);
  setTimeout(() => L.target = 0, 600);
}

// ---------- Ruth's tapes ----------
let tape = null;
function stopTape() { if (tape) { tape.h && tape.h.stop(0.2); tape.timers.forEach(clearTimeout); tape = null; $('tape').classList.add('hidden'); } }
game.playTape = (n) => {
  stopTape();
  const t = TAPES[n];
  const h = audio.play('r_tape' + n, { volume: 1.15, verb: 0.05, muffle: false, sub: false });
  const dur = audio.buffers['r_tape' + n] ? audio.buffers['r_tape' + n].duration : 12;
  const total = t.lines.reduce((a, l) => a + l.length, 0);
  let at = 0.3;
  const timers = [];
  audio.click();
  for (const line of t.lines) {
    const d = (dur - 0.6) * line.length / total;
    timers.push(setTimeout(() => ui.sub('רות (קלטת): ' + line, d + 0.3), at * 1000));
    at += d;
  }
  timers.push(setTimeout(() => { stopTape(); audio.click(); game.story.onTapeEnd(n); }, (dur + 0.4) * 1000));
  tape = { h, timers, n, start: performance.now(), dur };
  $('tape').classList.remove('hidden'); $('tape-t').textContent = t.title;
  const set = loadTapes(); const isNew = !set.has(n); set.add(n); saveTapes(set);
  if (isNew) ui.toast(`קלטת של רות · ${set.size}/5`, 2.5);
  game.discovered('ruth');
};

function openJournal() {
  if (game.state !== 'play' && game.state !== 'pause') return;
  const S = game.story, P = game.player;
  const tapes = loadTapes();
  const found = new Set(store.get('found', []));
  const keys = ['key1', 'key2', 'key3', 'key4'].filter(k => S.flags[k]).length;
  const disc = [['squash', 'הסקווש של רועי'], ['labubu', 'הלבובו של מאיה'], ['nevo', 'מה קרה לנבו'], ['store', 'המחסן של יסמין'], ['ruth', 'רות'], ['ending', 'הבריחה']];
  let h = `<h3>יומן</h3><p class="type">מפתחות שער: <b>${keys}/4</b> · בקבוקים: <b>${P.bottles || 0}/3</b> · סוללה: <b>${Math.round(P.battery * 100)}%</b></p>`;
  h += `<p class="type"><b>קלטות של רות</b> (${tapes.size}/5)</p><div class="tapes">`;
  for (let i = 1; i <= 5; i++) h += tapes.has(i) ? `<button class="btn tape-btn" data-tape="${i}">▶ קלטת ${i}</button>` : `<button class="btn tape-btn" disabled>קלטת ${i} · לא נמצאה</button>`;
  h += `</div><p class="type"><b>גילויים</b></p><ul class="type">${disc.map(([k, t]) => `<li>${found.has(k) ? '✓ ' + t : '— ???'}</li>`).join('')}</ul>`;
  h += `<p class="type"><b>המשימות הלילה</b></p><ul class="type">${S.objs.filter(o => !o.hidden).map(o => `<li>${o.done ? '✓' : '□'} ${o.text}</li>`).join('')}</ul>`;
  ui.note(h);
  if (game.state === 'play') { game.state = 'note'; if (document.pointerLockElement) document.exitPointerLock(); }
  for (const b of document.querySelectorAll('.tape-btn[data-tape]')) b.onclick = (e) => { e.stopPropagation(); closeNote(); game.playTape(+b.dataset.tape); };
}

// ---------- events from the story ----------
game.discovered = (id) => {
  const t = { squash: 'גילית: הסקווש של רועי', labubu: 'גילית: הלבובו של מאיה', nevo: 'גילית: מה קרה לנבו', store: 'גילית: המחסן של יסמין' }[id];
  if (t) ui.toast(t, 3);
  const found = new Set(store.get('found', [])); found.add(id); store.set('found', [...found]);
};
game.flashBlackout = (dur) => {
  const W = game.world;
  const was = W.power;
  W.power = false; game.player.flicker = dur;
  audio.buzz(camera.position.clone());
  setTimeout(() => { W.power = was || W.power; if (game.night !== 3 || game.story.obj('lever')?.done) W.power = true; }, dur * 1000);
};

let caughtT = 0;
function caught(fromLocker) {
  if (game.state !== 'play') return;
  game.state = 'caught'; caughtT = 0;
  stopTape();
  const P = game.player, Y = game.yasmin;
  P.enabled = false;
  if (P.hidden) { ui.lockerView(false); P.hidden = null; }
  // she is right in your face
  const f = P.forward(new THREE.Vector3()); f.y = 0; f.normalize();
  if (fromLocker) { f.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); }
  Y.position.set(P.pos.x + f.x * 0.7, 0, P.pos.z + f.z * 0.7);
  Y.dir = Math.atan2(-f.x, -f.z); Y.group.rotation.y = Y.dir;
  Y.state = 'caught'; Y.play('scream', 0.05); Y.speed = 0;
  P.lookAt = new THREE.Vector3(Y.position.x, 1.5, Y.position.z);
  P.shake = 2.2;
  audio.jumpscare();
  ui.hud(false);
}
function updateCaught(dt) {
  caughtT += dt;
  const u = post.u;
  const k = caughtT;
  u.warp.value = k < 1.4 ? 0.06 + Math.sin(k * 40) * 0.03 : 0;
  u.vhs.value = Math.min(1, k * 2);
  u.flashColor.value.setRGB(0.6, 0, 0);
  u.flash.value = k < 0.08 ? 0.5 : 0;
  ui.scare('img/scare1.jpg', (k > 0.25 && k < 0.42) || (k > 0.95 && k < 1.08) ? 1 : 0);
  game.yasmin.mixer.update(dt);
  game.player.update(dt, clockT);
  if (k > 1.5) ui.blackout(1);
  if (k > 2.4 && game.state === 'caught') {
    game.state = 'over';
    ui.scare(null, 0);
    u.vhs.value = 0; u.warp.value = 0;
    game.player.lookAt = null;
    $('over-line').textContent = overLine();
    ui.only('over');
    ui.blackout(0);
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

game.endNight = () => {
  const n = game.night;
  game.state = 'sleep';
  game.player.enabled = false;
  ui.hud(false);
  ui.blackout(1);
  audio.fanfare();
  store.set('night', Math.max(store.get('night', 1), n + 1));
  setTimeout(() => {
    ui.blackout(0, true);
    ui.card('06:00', `שרדת את לילה ${n}.`, n === 4 ? 'יש לך את כל המפתחות.\nמחר בלילה — בורחים.' : 'השמש עולה. היא נעלמה.\nבינתיים.');
    game.state = 'between';
  }, 1400);
};

game.escape = () => {
  if (game.state !== 'play') return;
  game.state = 'ending';
  game.player.enabled = false;
  stopTape();
  ui.hud(false);
  game.yasmin.hide();
  audio.fanfare();
  store.set('night', 5); store.set('won', true);
  ui.blackout(1);
  setTimeout(() => credits(), 1800);
};
function credits() {
  ui.only('end'); ui.blackout(0, true);
  const ruth = loadTapes().size >= 5;
  if (ruth) store.set('ruthFree', true);
  game.discovered('ending');
  const lines = [
    '<h2>ברחת.</h2>',
    '<p class="big">06:00. השמש עולה מעל הבסיס.</p>',
    '<p>בבוקר מצאו את המסדרון מבריק.</p>',
    '<p>את נבו העבירו לבית מנוחה. הוא עדיין סופר משבצות.</p>',
    '<p>את הלבובו של מאיה תפרו. בערך.</p>',
    '<p>את הסקווש של רועי — אף אחד לא שתה.</p>',
    ...(ruth ? ['<p class="big">ומישהי יצאה איתך מהשער.</p>', '<p>יחפה. רטובה. אחרי שלושה חודשים.</p>', '<p>רות חזרה הביתה.</p>'] : ['<p>על השער מצאו זוג עקבות יחפות שלא היו שלך.</p>', '<p class="small">(מצא את כל חמש הקלטות של רות כדי לשחרר אותה)</p>']),
    '<p class="big">ויסמין?</p>',
    '<p>יסמין קיבלה צל״ש על ניקיון.</p>',
    '<p class="small" style="margin-top:30px">5 לילות אצל יסמין · בכיכוב יסמין (בתפקיד עצמה) ונבו (בתפקיד נבו)<br>אף מגב לא נפגע במהלך הצילומים.</p>',
  ];
  const body = $('end-body'); body.innerHTML = '';
  lines.forEach((l, i) => setTimeout(() => { const d = document.createElement('div'); d.className = 'line'; d.innerHTML = l; body.appendChild(d); }, 600 + i * 1700));
  setTimeout(() => phone(), 600 + lines.length * 1700 + 1500);
}
function phone() {
  const ph = $('phone'), b = $('ph-body');
  ph.classList.remove('hidden'); b.innerHTML = '';
  const msgs = ['ראיתי שיצאת 🙂', 'שכחת לנגב את הרגליים.', '<img src="img/scare2.jpg" alt="">', 'נתראה במשמרת הבאה 🧽'];
  if (loadTapes().size >= 5) msgs.push('<i>מספר לא מזוהה:</i> תודה. — ר.');
  audio.tone(880, 0.12, { vol: 0.08 });
  msgs.forEach((m, i) => setTimeout(() => {
    const d = document.createElement('div'); d.className = 'msg'; d.innerHTML = m; b.appendChild(d);
    audio.tone(1320, 0.08, { vol: 0.06 }); audio.tone(1760, 0.1, { vol: 0.05, delay: 0.08 });
    if (i === msgs.length - 1) setTimeout(() => {
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = 'לתפריט'; btn.style.margin = '10px auto 0'; btn.style.display = 'block';
      btn.onclick = () => { ph.classList.add('hidden'); menu(); };
      b.appendChild(btn);
    }, 1200);
  }, 1200 + i * 1900));
}

// ---------- random scares between the scripted ones ----------
let scareT = 40;
function director(dt) {
  const Y = game.yasmin, P = game.player, W = game.world;
  scareT -= dt;
  if (scareT > 0 || Y.state === 'chase' || game.finale) return;
  scareT = 35 + Math.random() * 45 - game.night * 4;
  const r = Math.random();
  const far = cellsOf('.').map(([x, z]) => cellCenter(x, z)).filter(c => { const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); return d > 14 && d < 28; });
  const spot = far[Math.floor(Math.random() * far.length)];
  if (r < 0.25 && spot) audio.play('sfx_door', { pos: new THREE.Vector3(spot.x, 1, spot.z), volume: 1.3, rate: 0.85 + Math.random() * 0.3 });
  else if (r < 0.4 && game.night >= 2 && spot) audio.play('sfx_distant', { pos: new THREE.Vector3(spot.x, 1, spot.z), volume: 0.9 });
  else if (r < 0.6) {
    // a tube near you bursts
    const near = W.fixtures.filter(f => f.on && f.mode !== 3 && Math.hypot(f.x - P.pos.x, f.z - P.pos.z) < 7);
    const f = near[Math.floor(Math.random() * near.length)];
    if (f) { audio.bulbPop(new THREE.Vector3(f.x, f.y, f.z)); f.mode = 3; P.shake = 0.3; }
  } else if (r < 0.75) {
    audio.static_(1.4, 0.07);
    setTimeout(() => audio.play(Math.random() < 0.5 ? 'y_hear' : 'y_where', { volume: 0.45, verb: 1, muffle: false }), 500);
  } else if (r < 0.9 && game.night >= 3) {
    // subliminal flash
    ui.scare('img/scare2.jpg', 0.35);
    setTimeout(() => ui.scare(null, 0), 70);
    audio.noise(0.15, { type: 'highpass', f: 3000, vol: 0.3 });
  } else if (Y.visible && Y.state !== 'scripted') {
    game.flashBlackout(0.6);
  }
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let clockT = 0;
let fear = 0, chase = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  clockT += dt;
  const st = game.state;
  if (!game.world) { return; }
  const P = game.player, Y = game.yasmin, W = game.world, S = game.story;
  if (st === 'play') {
    P.update(dt, clockT);
    Y.update(dt, clockT, P, game);
    S.update(dt, clockT);
    director(dt);
    game.clockMin = Math.min(359, game.clockMin + dt * 0.5);
    ui.clock(game.clockMin);
    W.clockMinutes = game.clockMin;
    // interaction
    current = P.hidden ? null : P.pick(S.inter);
    if (P.hidden) ui.prompt('צא מהארון');
    else if (current) {
      if (current.hold) {
        if (useHeld && holdTarget === current) {
          holdT += dt;
          current.onHold && current.onHold();
          if (holdT >= current.hold) { current.use(); holdT = 0; holdTarget = null; useHeld = false; }
        } else if (useHeld) { holdTarget = current; holdT = 0; }
        else { holdT = 0; holdTarget = null; }
        ui.prompt(current.label, 'E', holdTarget === current ? holdT / current.hold : 0);
      } else ui.prompt(current.label);
    } else { ui.prompt(''); holdT = 0; holdTarget = null; }
    // fear
    let f = 0;
    if (Y.visible && Y.state !== 'gone') {
      const d = Math.hypot(Y.position.x - P.pos.x, Y.position.z - P.pos.z);
      const los = lineOfSight(Y.position.x, Y.position.z, P.pos.x, P.pos.z, opaque);
      f = Math.max(0, 1 - d / (los ? 16 : 10)) * (los ? 1 : 0.6);
      if (Y.state === 'chase') f = Math.max(f, 0.75);
    }
    fear += (f - fear) * Math.min(1, dt * 2);
    chase += ((Y.state === 'chase' ? 1 : 0) - chase) * Math.min(1, dt * (Y.state === 'chase' ? 3 : 0.5));
    game.mech.update(dt);
    ui.meters(P.stamina, P.battery, P.hasLight);
    $('bottles').textContent = P.bottles ? `בקבוקים: ${P.bottles}` : '';
    if (tape) $('tape-bar').style.width = Math.min(100, (performance.now() - tape.start) / 10 / tape.dur) + '%';
    ui.eye(Y.awareness, Y.state === 'chase');
    // fog thins outside
    const out = isOutdoor(roomAt(P.pos.x, P.pos.z)) || P.pos.z > 50;
    scene.fog.density += ((out ? 0.032 : 0.058) - scene.fog.density) * Math.min(1, dt * 2);
    scene.fog.color.setHex(out ? 0x0a0d10 : 0x070909);
    hemi.intensity = out ? 0.22 : W.power ? 0.1 : 0.05;
    audio.update(dt, { fear, chase, outdoor: out, power: W.power, stamina: P.stamina, hidden: !!P.hidden, alarm: W.alarm });
    post.u.fear.value = fear;
  } else if (st === 'caught') {
    updateCaught(dt);
  } else {
    // menus: a slow look down the corridor behind the UI
    if (st === 'menu' || st === 'card' || st === 'between' || st === 'ready') {
      camera.position.set(20 + Math.sin(clockT * 0.05) * 2, 1.6, 11);
      camera.rotation.set(0, -Math.PI / 2 + Math.sin(clockT * 0.1) * 0.15, 0);
    }
    audio.update(dt, { fear: 0, chase: 0, outdoor: false, power: true, stamina: 1, hidden: false, alarm: 0 });
  }
  W.update(dt, clockT, st === 'play' || st === 'caught' ? P.pos : camera.position, Y.visible ? Y.group : null);
  if (Y.visible) Y.group.userData.aggro = Y.aggro * (Y.state === 'chase' ? 1.4 : 1);
  audio.setListener(camera);
  ui.update(dt);
  S.renderCCTV(renderer, scene, clockT);
  post.render(clockT);
}

// ---------- buttons ----------
$('btn-enter').onclick = enter;
$('btn-play').onclick = () => startNight(store.get('night', 1));
$('btn-nights').onclick = () => $('nights').classList.toggle('hidden');
$('btn-howto').onclick = () => { ui.show('howto', true); };
$('btn-settings').onclick = () => { ui.show('settings', true); };
for (const b of document.querySelectorAll('.back')) b.onclick = () => { b.closest('.screen').classList.remove('show'); };
$('card').onclick = () => { if (game.state === 'card') play(); else if (game.state === 'between') startNight(Math.min(5, game.night + 1)); };
$('btn-resume').onclick = () => pause(false);
$('btn-restart').onclick = () => { ui.show('pause', false); audio.resume(); startNight(game.night); };
$('btn-pset').onclick = () => ui.show('settings', true);
$('btn-journal').onclick = () => { ui.show('pause', false); audio.resume(); game.state = 'play'; game.player.enabled = true; openJournal(); };
$('btn-quit').onclick = () => { ui.show('pause', false); audio.resume(); menu(); };
$('btn-retry').onclick = () => startNight(game.night);
$('btn-over-menu').onclick = () => menu();
addEventListener('keydown', e => {
  if (e.code === 'Enter' || e.code === 'Space') {
    if (game.state === 'card') play();
    else if (game.state === 'between') startNight(Math.min(5, game.night + 1));
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') pause(true); });
// settings
const bindRange = (id, key, apply) => { const el = $(id); el.value = settings[key]; el.oninput = () => { settings[key] = +el.value; apply(+el.value); store.set('settings', settings); }; };
bindRange('set-sens', 'sens', v => { if (game.player) game.player.sens = v; });
bindRange('set-vol', 'vol', v => { audio.vol.master = v; if (audio.master) audio.master.gain.value = v; });
bindRange('set-music', 'music', v => { audio.vol.music = v; if (audio.music) audio.music.gain.value = v; });
bindRange('set-bright', 'bright', v => { renderer.toneMappingExposure = 1.05 * v; });
$('set-difficulty').value = settings.difficulty;
$('set-difficulty').onchange = () => { settings.difficulty = $('set-difficulty').value; store.set('settings', settings); };
$('set-quality').value = settings.quality;
$('set-quality').onchange = () => { settings.quality = $('set-quality').value; store.set('settings', settings); };

game.dbg = { startNight: (n) => startNight(n), play: () => play(), menu: () => menu(), closeNote: () => closeNote(), caught: (l) => caught(l) };
load().catch(e => { console.error(e); ui.progress(1, 'שגיאה בטעינה: ' + e.message); });
frame();
