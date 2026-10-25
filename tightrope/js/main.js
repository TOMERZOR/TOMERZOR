import { LEVELS, endlessRope } from './levels.js';
import { createSim, stepSim, gustWarning, birdLoad, starsFor, finishBonus, FALL_ANGLE, LIQUIDS } from './sim.js';
import { tilt, enableSensors, enableFallback, readTilt, rateNow, calibrate, hasMotion, consumeJump, requestJump } from './sensors.js';
import { Renderer } from './render.js';
import { CHARACTERS } from './assets.js';
import { initAudio, setSound, ambience, sfx, suspendAudio } from './audio.js';
import { setLang, t, lang } from './i18n.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new Renderer(canvas);
const STEP = 1 / 240;

// Progress and settings live in this browser only.
const SAVE_KEY = 'tightrope.v1';
const save = {
  unlocked: 1, stars: {}, best: {}, coins: 0, owned: ['walker'], char: 'walker',
  endless: { ropes: 0, score: 0 }, seen: {},
  sound: true, invert: false, sens: 1, lang: 'he', tutorialSeen: false,
};
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch { /* private mode */ }
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}
const character = () => CHARACTERS.find((c) => c.id === save.char) || CHARACTERS[0];

let mode = 'menu';          // menu | brief | countdown | play | paused | over
let levelIdx = Math.min(save.unlocked, LEVELS.length) - 1;
let sim = null;
// Endless mode: which rope we are on, what carries over, coins picked up so far.
const run = { endless: false, rope: 0, carry: null, coins: 0 };
let sensorState = null;     // null until asked: 'ok' | 'none' | 'denied'
let countdownT = 0;
let overT = 0;
let fall = null;            // fall animation
let acc = 0;
let lastFrame = performance.now();
let wakeLock = null;
let gustAnnounced = null, birdAnnounced = null;
let vibrateAt = 0;
let runHeld = false, runKey = false;
let shake = 0;

// A bot keeps the walker upright behind the menus.
let demo = null;
let demoI = 0;
function setDemo(theme) {
  demo = createSim({ ...LEVELS[0], theme, length: 60, speed: 0.7 }, 7, { liquid: LIQUIDS[character().liquid] });
  renderer.setLevel(demo.level);
}
renderer.setCharacter(character());
setDemo(LEVELS[levelIdx].theme);

// ---------- screens ----------
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
}
function hideScreens() {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('show');
}

function applySettings() {
  tilt.invert = save.invert;
  tilt.sensitivity = save.sens;
  setSound(save.sound);
  $('set-sound').setAttribute('aria-checked', String(save.sound));
  $('set-invert').setAttribute('aria-checked', String(save.invert));
  $('set-sens').value = String(save.sens);
  $('lang-he').setAttribute('aria-pressed', String(lang === 'he'));
  $('lang-en').setAttribute('aria-pressed', String(lang === 'en'));
  document.title = `${t('title')} · ${lang === 'he' ? 'Full Bucket' : 'על החבל'}`;
}

function buildLevelGrid() {
  const grid = $('level-grid');
  grid.textContent = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lvl' + (i === levelIdx ? ' current' : '');
    const locked = L.id > save.unlocked;
    b.disabled = locked;
    b.setAttribute('aria-label', `${t('level')} ${L.id}${locked ? ', ' + t('locked') : ''}`);
    const num = document.createElement('span');
    num.textContent = locked ? '🔒' : String(L.id);
    b.append(num);
    const st = document.createElement('small');
    const n = save.stars[L.id] || 0;
    st.textContent = locked ? '' : '★'.repeat(n) + '☆'.repeat(3 - n);
    b.append(st);
    b.addEventListener('click', () => { sfx.click(); levelIdx = i; run.endless = false; openBrief(); });
    grid.append(b);
  });
}

// The character shop: coins from every rope buy new carriers with new liquids.
function buildShop() {
  $('shop-wallet').textContent = String(save.coins);
  const list = $('char-list');
  list.textContent = '';
  CHARACTERS.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'char' + (c.id === save.char ? ' current' : '');
    const im = document.createElement('img');
    im.src = c.thumb;
    im.alt = '';
    const body = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = t('charNames')[i];
    const p = document.createElement('p');
    p.textContent = t('charBlurbs')[i];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (c.id === save.char ? '' : ' primary');
    const owned = save.owned.includes(c.id);
    if (c.id === save.char) {
      b.textContent = t('selected');
      b.disabled = true;
    } else if (owned) {
      b.textContent = t('select');
    } else {
      b.textContent = t('buy', c.cost);
      b.disabled = save.coins < c.cost;
    }
    b.addEventListener('click', () => {
      if (!owned) {
        if (save.coins < c.cost) return;
        save.coins -= c.cost;
        save.owned.push(c.id);
        sfx.buy();
      } else {
        sfx.click();
      }
      save.char = c.id;
      persist();
      renderer.setCharacter(c);
      setDemo(demo.level.theme);
      buildShop();
    });
    body.append(h, p, b);
    card.append(im, body);
    list.append(card);
  });
}

function openBrief() {
  const L = run.endless ? endlessRope(0) : LEVELS[levelIdx];
  setDemo(L.theme);
  if (run.endless) {
    $('brief-num').textContent = t('endless');
    $('brief-name').textContent = t('endless');
    $('brief-blurb').textContent = t('endlessBrief');
    $('brief-limit').textContent = t('endlessBest', save.endless.ropes, save.endless.score.toLocaleString());
    $('brief-length').textContent = t('wallet', save.coins);
  } else {
    $('brief-num').textContent = `${t('level')} ${L.id} / ${LEVELS.length}`;
    $('brief-name').textContent = t('names')[levelIdx];
    $('brief-blurb').textContent = t('blurbs')[levelIdx];
    $('brief-limit').textContent = t('spillLimit', Math.round(L.limit * 100));
    $('brief-length').textContent = t('length', L.length);
  }
  $('brief-hold').textContent = hasMotion() ? t('holdPhone') : sensorMessage();
  mode = 'brief';
  show('brief');
}

async function askSensors() {
  if (sensorState) return sensorState;
  sensorState = await enableSensors();
  return sensorState;
}

function sensorMessage() {
  if (sensorState === 'denied') return t('motionDenied');
  if (!window.isSecureContext) return t('needsHttps') + ' ' + t('motionNone');
  return t('motionNone');
}

// ---------- a level, or a rope in endless mode ----------
function currentLevel() {
  return run.endless ? endlessRope(run.rope) : LEVELS[levelIdx];
}

function beginRope() {
  const L = currentLevel();
  renderer.setLevel(L);
  sim = createSim(L, (Math.random() * 1e9) | 0, { liquid: LIQUIDS[character().liquid], carry: run.carry });
  fall = null;
  gustAnnounced = birdAnnounced = null;
  $('hud-level').textContent = run.endless ? t('rope', run.rope + 1) : `${L.id}. ${t('names')[levelIdx]}`;
}

function startLevel() {
  if (run.endless) {
    run.rope = 0;
    run.carry = null;
    run.coins = 0;
  }
  beginRope();
  hideScreens();
  $('hud').hidden = false;
  mode = 'countdown';
  countdownT = 3.2;
  lastCount = null;
  requestWake();
  if (!save.tutorialSeen || (!run.endless && levelIdx === 0)) {
    toast(hasMotion() ? t('tutorial') : (matchMedia('(pointer: fine)').matches ? t('tutorialKeys') : t('tutorialTouch')), 5);
    save.tutorialSeen = true;
    persist();
  }
}

// Endless: straight on to the next rope, keeping the water and the score.
function nextRope() {
  const bonus = finishBonus(sim);
  run.coins += sim.coins;
  run.carry = { fill: sim.fill, score: sim.score + bonus };
  toast(t('ropeDone', run.rope + 1, bonus), 2.2);
  sfx.cheer();
  run.rope++;
  beginRope();
  mode = 'play';
}

let lastCount = null;
function updateCountdown(dt) {
  countdownT -= dt;
  const el = $('countdown');
  el.hidden = false;
  const n = Math.ceil(countdownT - 0.2);
  const label = n > 0 ? String(n) : t('go');
  if (label !== lastCount) {
    lastCount = label;
    el.innerHTML = '';
    const big = document.createElement('div');
    big.textContent = label;
    if (n > 0) {
      const small = document.createElement('small');
      small.textContent = t('steady');
      big.append(small);
      sfx.tick();
    } else {
      sfx.go();
      calibrate();
    }
    el.append(big);
  }
  if (countdownT <= 0) {
    el.hidden = true;
    mode = 'play';
  }
}

function setStars(n) {
  const stars = $('result-stars');
  stars.hidden = n == null;
  stars.innerHTML = '';
  for (let i = 0; i < 3 && n != null; i++) {
    const s = document.createElement('span');
    s.textContent = '★';
    if (i < n) s.className = 'on';
    stars.append(s);
  }
}

function finish() {
  mode = 'over';
  releaseWake();
  runHeld = false;
  const title = $('result-title'), sub = $('result-sub'), main = $('result-main');
  const scoreEl = $('result-score'), bestEl = $('result-best');
  setStars(null);
  bestEl.textContent = '';

  if (run.endless) {
    const coins = run.coins + sim.coins;
    const score = Math.round(sim.score);
    save.coins += coins;
    const isBest = run.rope > save.endless.ropes || (run.rope === save.endless.ropes && score > save.endless.score);
    if (isBest) save.endless = { ropes: run.rope, score };
    persist();
    title.textContent = isBest && run.rope > 0 ? t('newBest') : t('endlessOver');
    sub.textContent = t('endlessOverSub', run.rope);
    scoreEl.textContent = t('scoreLine', score.toLocaleString(), coins);
    bestEl.textContent = t('endlessBest', save.endless.ropes, save.endless.score.toLocaleString());
    main.textContent = t('again');
    main.onclick = () => { sfx.click(); startLevel(); };
    if (isBest && run.rope > 0) sfx.win(); else sfx.fail();
    show('result');
    return;
  }

  const L = LEVELS[levelIdx];
  save.coins += sim.coins;
  if (sim.state === 'won') {
    const score = Math.round(sim.score + finishBonus(sim));
    const n = starsFor(L, sim.spilled);
    save.stars[L.id] = Math.max(save.stars[L.id] || 0, n);
    const isBest = score > (save.best[L.id] || 0);
    save.best[L.id] = Math.max(save.best[L.id] || 0, score);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, L.id + 1));
    persist();
    setStars(n);
    const last = levelIdx === LEVELS.length - 1;
    title.textContent = last ? t('allDone') : t('won');
    sub.textContent = t('wonSub', Math.round(sim.fill * 100)) + (last ? ' ' + t('allDoneSub') : '');
    scoreEl.textContent = t('scoreLine', score.toLocaleString(), sim.coins);
    bestEl.textContent = isBest ? t('newBest') : t('bestLine', save.best[L.id].toLocaleString());
    main.textContent = last ? t('levels') : t('next');
    main.onclick = () => {
      sfx.click();
      $('hud').hidden = true;
      if (last) { buildLevelGrid(); show('levels'); mode = 'menu'; return; }
      levelIdx++;
      openBrief();
    };
    sfx.win();
  } else {
    persist();
    if (sim.fail === 'fall') {
      title.textContent = t('failFall');
      sub.textContent = t('failFallSub');
    } else {
      title.textContent = t('failSpill');
      sub.textContent = t('failSpillSub', Math.round(sim.spilled * 100), Math.round(L.limit * 100));
    }
    scoreEl.textContent = sim.coins ? t('wallet', `+${sim.coins}`) : '';
    main.textContent = t('retry');
    main.onclick = () => { sfx.click(); startLevel(); };
  }
  show('result');
}

function pause() {
  if (mode !== 'play' && mode !== 'countdown') return;
  mode = 'paused';
  runHeld = false;
  $('countdown').hidden = true;
  show('pause');
  releaseWake();
}

function toast(msg, secs) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.until = performance.now() + secs * 1000;
  toast.timer = setTimeout(() => { el.hidden = true; }, secs * 1000);
}

// One-time tips the first time each thing shows up.
function tip(key, msg, secs = 4.5) {
  if (save.seen[key] || performance.now() < (toast.until || 0)) return;
  save.seen[key] = true;
  persist();
  toast(msg, secs);
}
const fine = () => matchMedia('(pointer: fine)').matches;
function checkTips() {
  const s = sim;
  if (s.t > 6 && (run.endless || levelIdx >= 1)) tip('run', hasMotion() ? t('tipRun') : fine() ? t('tipRunKeys') : t('tipRunTouch'));
  if (s.t > 6 && !run.endless && levelIdx === 0) tip('coins', t('tipCoins'));
  if (s.hurdles.some((h) => !h.done && h.z - s.z < 9)) tip('hurdle', fine() && !hasMotion() ? t('tipHurdleKeys') : t('tipHurdle'), 5);
  if (s.ibexes.some((b) => b.state === 'come')) tip('ibex', t('tipIbex'));
  if (s.clouds.some((c) => c.z0 - s.z < 14 && c.z1 > s.z)) tip('rain', t('tipRain'));
  if (s.items.some((it) => it.kind === 'orb' && !it.taken && it.z - s.z < 12 && it.z > s.z)) tip('orb', t('tipOrb'));
}

async function requestWake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}
function releaseWake() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

// ---------- HUD ----------
let shownMult = 1;
function updateHud() {
  const L = sim.level;
  const p = Math.max(0, Math.min(1, sim.z / L.length));
  $('track-fill').style.width = `${p * 100}%`;
  $('track-man').style.insetInlineStart = `${p * 100}%`;
  const sp = $('hud-spill');
  const pct = Math.round(sim.spilled * 100), lim = Math.round(L.limit * 100);
  sp.innerHTML = '';
  const big = document.createElement('b');
  big.textContent = `${pct}%`;
  const small = document.createElement('span');
  small.textContent = t('allowed', lim);
  sp.append(t('spilled'), big, small);
  sp.classList.toggle('danger', sim.spilled > L.limit * 0.75);
  $('hud-points').textContent = Math.round(sim.score).toLocaleString();
  $('hud-coins').textContent = String(sim.coins + (run.endless ? run.coins : 0));
  const m = $('hud-mult');
  m.hidden = sim.mult <= 1;
  m.textContent = `x${sim.mult}`;
  if (sim.mult !== shownMult) {
    m.classList.remove('pop');
    void m.offsetWidth;
    if (sim.mult > shownMult) m.classList.add('pop');
    shownMult = sim.mult;
  }
  $('run-btn').hidden = hasMotion() || mode !== 'play';
}

function vibrate(ms) {
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}

function events() {
  if (sim.stepEvent) sfx.step();
  const w = gustWarning(sim);
  if (w && gustAnnounced !== sim.gust) {
    gustAnnounced = sim.gust;
    sfx.gustWarn(w.side);
  }
  if (sim.bird && birdAnnounced !== sim.bird && birdLoad(sim) > 0) {
    birdAnnounced = sim.bird;
    sfx.bird();
  }
  for (const b of sim.ibexes) {
    if (b.state === 'come' && !b.bleated) { b.bleated = 1; sfx.bleat(); }
    if (b.state === 'come' && b.bleated === 1 && b.z - sim.z < 6) { b.bleated = 2; sfx.bleat(); }
  }
  for (const e of sim.events) {
    renderer.onEvent(e, sim);
    switch (e.type) {
      case 'coin': sfx.coin(); break;
      case 'orb': sfx.orb(); break;
      case 'mult': sfx.mult(e.mult); if (e.mult === 2) tip('mult', t('tipMult')); break;
      case 'multLost': sfx.multLost(); break;
      case 'jump': sfx.jump(); break;
      case 'land': sfx.land(); break;
      case 'knot': sfx.knot(); shake = 0.15; break;
      case 'hurdle': sfx.cheer(); break;
      case 'trip': sfx.trip(); vibrate(80); shake = 0.35; break;
      case 'ibexPass': sfx.cheer(); break;
      case 'ibexBump': sfx.trip(); sfx.bleat(); vibrate(80); shake = 0.35; break;
      case 'fish': sfx.fish(); break;
    }
  }
  sim.events.length = 0;
  if (sim.spillRate > 0.05 && performance.now() > vibrateAt) {
    vibrateAt = performance.now() + 250;
    vibrate(30);
  }
}

// ---------- loop ----------
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const u = readTilt(dt);
  const ur = rateNow();
  const view = { lean: 0, emit: false, drop: 0, shake: 0, hud: false, hudTop: safeTop + 10, safeBottom };

  if (mode === 'menu' || mode === 'brief' || !sim) {
    consumeJump();
    // Attract mode: a simple bot balances him slowly along the rope.
    acc += dt;
    while (acc >= STEP) {
      demoI += STEP;
      const bot = -(1.2 * demo.theta + 0.8 * demo.omega) + Math.sin(demoI * 0.7) * 0.06;
      stepSim(demo, STEP, bot, 0);
      demo.events.length = 0;
      if (demo.state !== 'walk' || demo.z > 40) setDemo(demo.level.theme);
      acc -= STEP;
    }
    view.lean = demo.theta;
    renderer.draw(demo, view, dt);
    ambience(0.1, 0, false);
  } else {
    if (mode === 'countdown') updateCountdown(dt);
    if (mode === 'play') {
      acc += dt;
      let jump = consumeJump();
      while (acc >= STEP && sim.state === 'walk') {
        stepSim(sim, STEP, u, ur, { run: runHeld || runKey, jump });
        jump = false;
        acc -= STEP;
        events();
      }
      checkTips();
      if (sim.state === 'won' && run.endless) {
        acc = 0;
        nextRope();
      } else if (sim.state !== 'walk') {
        acc = 0;
        runHeld = false;
        if (sim.state === 'fallen' && !fall) {
          fall = { t: 0, lean: sim.theta, w: sim.omega + Math.sign(sim.theta) * 0.5, drop: 0, vy: 0 };
          sfx.fall();
        }
        if (sim.state === 'failed' || sim.state === 'won') {
          if (sim.state === 'failed') sfx.fail();
          mode = 'over';
          overT = sim.state === 'won' ? 0.5 : 0.7;
        } else {
          mode = 'over';
          overT = 1.4;
        }
      }
    } else {
      acc = 0;
      consumeJump();
    }
    if (mode === 'over' && overT > 0) {
      overT -= dt;
      if (overT <= 0) finish();
    }
    view.lean = sim.theta;
    view.hud = true;
    view.emit = mode === 'play' || (mode === 'over' && sim.state === 'failed');
    if (fall) {
      fall.t += dt;
      fall.w += Math.sign(fall.lean) * 6 * dt;
      fall.lean = Math.max(-2.2, Math.min(2.2, fall.lean + fall.w * dt));
      if (Math.abs(fall.lean) > 1.2) {
        fall.vy += 9.8 * dt;
        fall.drop += fall.vy * dt;
      }
      view.lean = fall.lean;
      view.drop = fall.drop;
      view.frozenCam = true;
      if (sim.fill > 0) { sim.spillRate = 2; sim.spillSide = Math.sign(fall.lean); sim.fill = Math.max(0, sim.fill - dt); view.emit = true; }
    }
    shake = Math.max(0, shake - dt);
    const gust = sim.gust && sim.t > sim.gust.t0 ? Math.min(3, Math.abs(sim.wind) * 2) : 0;
    view.shake = Math.max(gust, shake * 18);
    renderer.draw(sim, view, dt);
    updateHud();
    ambience(sim.wind, mode === 'play' ? sim.spillRate : 0, mode === 'play', sim.clouds.some((c) => sim.z > c.z0 - 3 && sim.z < c.z1) ? 1 : 0);
  }
  requestAnimationFrame(frame);
}

// Safe-area insets, measured once from CSS.
let safeTop = 0, safeBottom = 0;
function measureSafe() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden';
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  safeTop = parseFloat(cs.paddingTop) || 0;
  safeBottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
}

// ---------- input: hold to run, swipe up to jump ----------
let swipe = null;
canvas.addEventListener('pointerdown', (e) => {
  swipe = { y: e.clientY, t: performance.now(), id: e.pointerId, done: false };
  if (hasMotion()) runHeld = true;
});
canvas.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.id !== e.pointerId || swipe.done) return;
  if (swipe.y - e.clientY > 50 && performance.now() - swipe.t < 400) {
    swipe.done = true;
    requestJump();
  }
});
const pointerEnd = (e) => {
  if (swipe && swipe.id === e.pointerId) swipe = null;
  if (hasMotion()) runHeld = false;
};
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
const runBtn = $('run-btn');
runBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); runHeld = true; runBtn.classList.add('on'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  runBtn.addEventListener(ev, () => { runHeld = false; runBtn.classList.remove('on'); });
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'Shift') runKey = true;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (mode === 'paused') $('resume-btn').click(); else pause(); }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'Shift') runKey = false;
});

// ---------- wiring ----------
$('play-btn').addEventListener('click', async () => {
  initAudio();
  sfx.click();
  await askSensors();
  run.endless = false;
  levelIdx = Math.min(save.unlocked, LEVELS.length) - 1;
  openBrief();
});
$('endless-btn').addEventListener('click', async () => {
  initAudio();
  sfx.click();
  await askSensors();
  run.endless = true;
  openBrief();
});
$('levels-btn').addEventListener('click', async () => {
  initAudio();
  sfx.click();
  await askSensors();
  buildLevelGrid();
  show('levels');
});
$('shop-btn').addEventListener('click', () => { initAudio(); sfx.click(); buildShop(); show('shop'); });
$('settings-btn').addEventListener('click', () => { initAudio(); sfx.click(); show('settings'); });
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { sfx.click(); mode = 'menu'; show('menu'); });
$('brief-back').addEventListener('click', () => {
  sfx.click();
  mode = 'menu';
  if (run.endless) { show('menu'); return; }
  buildLevelGrid();
  show('levels');
});
$('brief-start').addEventListener('click', () => { initAudio(); sfx.click(); startLevel(); });
$('pause-btn').addEventListener('click', () => { sfx.click(); pause(); });
$('resume-btn').addEventListener('click', () => {
  sfx.click();
  hideScreens();
  mode = sim && sim.t > 0 ? 'play' : 'countdown';
  if (mode === 'countdown') { countdownT = 3.2; lastCount = null; }
  requestWake();
});
$('recal-btn').addEventListener('click', () => { sfx.click(); calibrate(); });
$('restart-btn').addEventListener('click', () => { sfx.click(); startLevel(); });
const toMenu = () => { sfx.click(); mode = 'menu'; sim = null; setDemo(LEVELS[levelIdx].theme); $('hud').hidden = true; releaseWake(); show('menu'); };
$('pause-menu-btn').addEventListener('click', toMenu);
$('result-menu').addEventListener('click', toMenu);

$('set-sound').addEventListener('click', () => { save.sound = !save.sound; persist(); applySettings(); sfx.click(); });
$('set-invert').addEventListener('click', () => { save.invert = !save.invert; persist(); applySettings(); sfx.click(); });
$('set-sens').addEventListener('input', (e) => { save.sens = parseFloat(e.target.value); persist(); applySettings(); });
for (const l of ['he', 'en']) {
  $('lang-' + l).addEventListener('click', () => { save.lang = l; persist(); setLang(l); applySettings(); sfx.click(); });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); suspendAudio(true); } else suspendAudio(false);
});
window.addEventListener('resize', () => { renderer.resize(); measureSafe(); });
enableFallback(canvas);

setLang(save.lang);
applySettings();
measureSafe();
requestAnimationFrame(frame);

// For tests: lets a script drive the game without a phone.
window.__tightrope = { get sim() { return sim; }, get mode() { return mode; }, tilt, LEVELS, FALL_ANGLE, run, save };
