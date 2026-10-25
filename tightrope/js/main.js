import { LEVELS } from './levels.js';
import { createSim, stepSim, gustWarning, birdLoad, starsFor, FALL_ANGLE } from './sim.js';
import { tilt, enableSensors, enableFallback, readTilt, rateNow, calibrate, hasMotion } from './sensors.js';
import { Renderer } from './render.js';
import { initAudio, setSound, ambience, sfx, suspendAudio } from './audio.js';
import { setLang, t, lang } from './i18n.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new Renderer(canvas);
const STEP = 1 / 240;

// Progress and settings live in this browser only.
const SAVE_KEY = 'tightrope.v1';
const save = { unlocked: 1, stars: {}, sound: true, invert: false, sens: 1, lang: 'he', tutorialSeen: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch { /* private mode */ }
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

let mode = 'menu';          // menu | brief | countdown | play | paused | over
let levelIdx = Math.min(save.unlocked, LEVELS.length) - 1;
let sim = null;
let sensorState = null;     // null until asked: 'ok' | 'none' | 'denied'
let countdownT = 0;
let overT = 0;
let fall = null;            // fall animation
let acc = 0;
let lastFrame = performance.now();
let wakeLock = null;
let gustAnnounced = null, birdAnnounced = null;
let vibrateAt = 0;

// A bot keeps the walker upright behind the menus.
let demo = null;
let demoI = 0;
function setDemo(theme) {
  demo = createSim({ ...LEVELS[0], theme, length: 60, speed: 0.7 }, 7);
  renderer.setLevel(demo.level);
}
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
    b.addEventListener('click', () => { sfx.click(); levelIdx = i; openBrief(); });
    grid.append(b);
  });
}

function openBrief() {
  const L = LEVELS[levelIdx];
  setDemo(L.theme);
  $('brief-num').textContent = `${t('level')} ${L.id} / ${LEVELS.length}`;
  $('brief-name').textContent = t('names')[levelIdx];
  $('brief-blurb').textContent = t('blurbs')[levelIdx];
  $('brief-limit').textContent = t('spillLimit', Math.round(L.limit * 100));
  $('brief-length').textContent = t('length', L.length);
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

// ---------- a level ----------
function startLevel() {
  const L = LEVELS[levelIdx];
  renderer.setLevel(L);
  sim = createSim(L, (Math.random() * 1e9) | 0);
  fall = null;
  gustAnnounced = birdAnnounced = null;
  hideScreens();
  $('hud').hidden = false;
  $('hud-level').textContent = `${L.id}. ${t('names')[levelIdx]}`;
  mode = 'countdown';
  countdownT = 3.2;
  lastCount = null;
  requestWake();
  if (!save.tutorialSeen || levelIdx === 0) {
    toast(hasMotion() ? t('tutorial') : (matchMedia('(pointer: fine)').matches ? t('tutorialKeys') : t('tutorialTouch')), 5);
    save.tutorialSeen = true;
    persist();
  }
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

function finish() {
  const L = LEVELS[levelIdx];
  mode = 'over';
  releaseWake();
  const title = $('result-title'), sub = $('result-sub'), main = $('result-main'), stars = $('result-stars');
  stars.hidden = true;
  if (sim.state === 'won') {
    const n = starsFor(L, sim.spilled);
    save.stars[L.id] = Math.max(save.stars[L.id] || 0, n);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, L.id + 1));
    persist();
    stars.hidden = false;
    stars.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      if (i < n) s.className = 'on';
      stars.append(s);
    }
    const last = levelIdx === LEVELS.length - 1;
    title.textContent = last ? t('allDone') : t('won');
    sub.textContent = t('wonSub', Math.round(sim.fill * 100)) + (last ? ' ' + t('allDoneSub') : '');
    main.textContent = last ? t('levels') : t('next');
    main.onclick = () => {
      sfx.click();
      if (last) { buildLevelGrid(); show('levels'); mode = 'menu'; $('hud').hidden = true; return; }
      levelIdx++;
      openBrief();
      $('hud').hidden = true;
    };
    sfx.win();
  } else {
    if (sim.fail === 'fall') {
      title.textContent = t('failFall');
      sub.textContent = t('failFallSub');
    } else {
      title.textContent = t('failSpill');
      sub.textContent = t('failSpillSub', Math.round(sim.spilled * 100), Math.round(L.limit * 100));
    }
    main.textContent = t('retry');
    main.onclick = () => { sfx.click(); startLevel(); };
  }
  show('result');
}

function pause() {
  if (mode !== 'play' && mode !== 'countdown') return;
  mode = 'paused';
  $('countdown').hidden = true;
  show('pause');
  releaseWake();
}

function toast(msg, secs) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, secs * 1000);
}

async function requestWake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}
function releaseWake() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

// ---------- HUD ----------
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
  if (sim.spillRate > 0.05 && performance.now() > vibrateAt) {
    vibrateAt = performance.now() + 250;
    try { navigator.vibrate?.(30); } catch { /* ignore */ }
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
    // Attract mode: a simple bot balances him slowly along an endless rope.
    acc += dt;
    while (acc >= STEP) {
      demoI += STEP;
      const bot = -(1.2 * demo.theta + 0.8 * demo.omega) + Math.sin(demoI * 0.7) * 0.06;
      stepSim(demo, STEP, bot, 0);
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
      while (acc >= STEP && sim.state === 'walk') {
        stepSim(sim, STEP, u, ur);
        acc -= STEP;
        events();
      }
      if (sim.state !== 'walk') {
        acc = 0;
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
    view.shake = sim.gust && sim.t > sim.gust.t0 ? Math.min(3, Math.abs(sim.wind) * 2) : 0;
    renderer.draw(sim, view, dt);
    updateHud();
    ambience(sim.wind, mode === 'play' ? sim.spillRate : 0, mode === 'play');
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

// ---------- wiring ----------
$('play-btn').addEventListener('click', async () => {
  initAudio();
  sfx.click();
  await askSensors();
  levelIdx = Math.min(save.unlocked, LEVELS.length) - 1;
  openBrief();
});
$('levels-btn').addEventListener('click', async () => {
  initAudio();
  sfx.click();
  await askSensors();
  buildLevelGrid();
  show('levels');
});
$('settings-btn').addEventListener('click', () => { initAudio(); sfx.click(); show('settings'); });
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { sfx.click(); mode = 'menu'; show('menu'); });
$('brief-back').addEventListener('click', () => { sfx.click(); mode = 'menu'; buildLevelGrid(); show('levels'); });
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
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (mode === 'paused') $('resume-btn').click(); else pause(); }
});
window.addEventListener('resize', () => { renderer.resize(); measureSafe(); });
enableFallback(canvas);

setLang(save.lang);
applySettings();
measureSafe();
requestAnimationFrame(frame);

// For tests: lets a script drive the game without a phone.
window.__tightrope = { get sim() { return sim; }, get mode() { return mode; }, tilt, LEVELS, FALL_ANGLE };
