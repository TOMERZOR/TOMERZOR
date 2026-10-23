import { LEVELS, DAILY } from './levels.js';
import { WORLDS, SKINS } from './theme.js';
import { createRenderer } from './render.js';
import { createGame } from './game.js';
import * as planck from './vendor/planck.js';
import { ghostPath, MIN_ANGLE, MAX_ANGLE } from './engine.js';
import { save, totalStars, worldStars } from './save.js';
import { buildMap } from './map.js';
import * as sfx from './audio.js';
import * as hap from './haptics.js';
import { initMonetization, showRewarded, maybeInterstitial, purchase, restore, PRODUCTS, priceOf, isNative } from './monetization.js';
import { track } from './analytics.js';

const $ = (s) => document.querySelector(s);
const calmMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const d = () => save.d;
const PER_WORLD = 24;
const HINT_COST = 40, CONTINUE_COST = 60;
const WORLD_INTRO = [null,
  'Stone and timber never break. Use them to crush the glass',
  'Bounce pads fling the ball. Bank your shots off the walls',
  'Bombs blow up everything nearby',
  'Glass swings on ropes and rides moving platforms'];

// ---------- stage ----------
const canvas = $('#stage');
const renderer = createRenderer(canvas);
let mode = 'home';           // home | play | page
let current = null;          // { level, index, daily, dateKey }
let continued = false;
let demoTimer = 0;
// adaptive quality: a rolling frame-time average picks a tier; resolution and effects step down together
const TIER_DPR = [2.5, 2, 1.5, 1.25];
let perfTier = 0, dprCap = TIER_DPR[0], emaDt = 1 / 60, tierClock = 0;

const game = createGame({
  canvas, renderer,
  getSkin: () => SKINS.find((s) => s.id === d().skin) || SKINS[0],
  onWin, onLose,
  onFirstShot: () => { $('#coach').hidden = true; },
  onBreak: () => updateGlassPips(),
});

function safeInsets() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const r = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return r;
}
let lastSize = '';
function setTier(t) {
  perfTier = t; dprCap = TIER_DPR[t]; emaDt = 1 / 60;
  renderer.setTier(t);
  d().perfTier = t; save.touch();
  resize();
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.resize(window.innerWidth, window.innerHeight, dpr, safeInsets());
  const size = window.innerWidth + 'x' + window.innerHeight;
  if (size !== lastSize && mode === 'home' && game.sim) loadDemo(game.sim.level.world); // refit to the new layout
  if (mode === 'page' && $('#levels').classList.contains('on') && levelMap && levelMap.width !== $('#map-scroll').clientWidth) renderLevels(true); // the trail fits the new width
  lastSize = size;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

const TINTS = { ink: [8, 12, 16, 18, 30, 55, 70, 85], accent: [16, 80], sky0: [30], surface: [60, 72, 78, 80, 82, 86] };
const hexRgb = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const mixHex = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(',')})`; };
let paletteNow = -1;
function applyPalette(w) {
  const p = WORLDS[w];
  if (w === paletteNow) return p; // unchanged: re-setting every token would restyle the whole page
  paletteNow = w;
  const root = document.documentElement.style;
  root.setProperty('--ink', p.ink); root.setProperty('--ink2', p.ink2); root.setProperty('--accent', p.accent);
  root.setProperty('--text', p.text); root.setProperty('--sky0', p.sky[0]); root.setProperty('--sky1', p.sky[1]);
  root.setProperty('--floor', p.floor);
  root.setProperty('--muted', rgba(p.text, 0.66));
  p.glass.forEach((g, i) => root.setProperty(`--g${i}`, `rgb(${g[0]},${g[1]},${g[2]})`));
  // translucent tints (precomputed: color-mix() isn't available on iOS 15)
  const surface = p.dark ? '#232A45' : '#FFFFFF';
  for (const [name, hex] of [['ink', p.ink], ['accent', p.accent], ['sky0', p.sky[0]], ['surface', surface]]) {
    for (const a of TINTS[name]) root.setProperty(`--${name}-a${a}`, rgba(hex, a / 100));
  }
  root.setProperty('--ink-hi', mixHex(p.ink, '#FFFFFF', 0.92));
  root.setProperty('--ink-lo', mixHex(p.ink, '#000000', 0.7));
  document.documentElement.dataset.dark = p.dark ? '1' : '';
  const themeColor = document.querySelector('meta[name="theme-color"]'); // absent when embedded in another page
  if (themeColor) themeColor.content = p.sky[0];
  renderer.setPalette(p);
  game.setPalette(p);
  return p;
}

// ---------- screens ----------
const screens = ['home', 'hud', 'levels', 'shop', 'store', 'settings'];
function show(name) {
  // pages are opaque: the stage behind them leaves the compositor, or it costs every animated frame
  document.body.classList.toggle('paged', !['home', 'hud'].includes(name));
  for (const s of screens) {
    const el = document.getElementById(s);
    const on = s === name;
    if (on && !el.classList.contains('on')) { el.classList.add('on', 'anim'); setTimeout(() => el.classList.remove('anim'), 600); }
    if (!on) el.classList.remove('on');
  }
}

function levelIndexOf(id) { return LEVELS.findIndex((l) => l.id === id); }
function progressIndex() {
  for (let i = 0; i < LEVELS.length; i++) if (!d().stars[LEVELS[i].id]) return i;
  return LEVELS.length - 1;
}
function unlocked(i) { return i <= progressIndex(); }

function goHome() {
  closeSheet(true);
  $('#worldcard').classList.remove('play');
  mode = 'home';
  const idx = progressIndex();
  const w = LEVELS[idx].world;
  applyPalette(w);
  refreshHome();
  show('home');
  loadDemo(w); // after show(): the demo fits itself to the home layout
}

// ---------- star crystal: fills every CRYSTAL_STARS stars, shattered for coins ----------
const CRYSTAL_STARS = 15;
function crystalState() {
  const st = totalStars(), n = d().crystals, from = n * CRYSTAL_STARS;
  return { ready: st >= from + CRYSTAL_STARS, k: Math.max(0, Math.min(1, (st - from) / CRYSTAL_STARS)), need: from + CRYSTAL_STARS - st, reward: Math.min(400, 100 + 25 * n) };
}
function refreshCrystal() {
  const c = crystalState(), b = $('#btn-crystal');
  b.querySelector('.fill').style.strokeDasharray = `${(c.k * 97.4).toFixed(1)} 97.4`;
  b.classList.toggle('ready', c.ready);
  b.setAttribute('aria-label', c.ready ? 'Star crystal ready to shatter' : `Star crystal: ${c.need} more stars`);
}
function crystalSheet() {
  const c = crystalState();
  openSheet(`
    <div class="crystal ${c.ready ? 'ready' : ''}" id="crystal">
      <div class="gem">${'<i></i>'.repeat(8)}</div>
      <div class="loot"><svg><use href="#i-coin"/></svg><b id="loot-n">+0</b></div>
    </div>
    <h2>${c.ready ? 'Crystal ready' : 'Star crystal'}</h2>
    <p class="sub">${c.ready ? 'Shatter it for coins.' : `${c.need} more ${c.need === 1 ? 'star' : 'stars'} and it's full. Every ${CRYSTAL_STARS} stars fills one.`}</p>
    <div class="actions">${c.ready ? '<button class="btn accent big" data-act="smash">Shatter</button>' : '<button class="btn primary big" data-act="play"><svg><use href="#i-play"/></svg>Play</button>'}
      <button class="btn ghost" data-act="close">Not now</button></div>`, (act, el) => {
    if (act === 'close') { closeSheet(); refreshHome(); return; }
    if (act === 'play') { closeSheet(); startLevel(progressIndex()); return; }
    if (act === 'collect') { closeSheet(); refreshHome(); return; }
    if (act !== 'smash' || !crystalState().ready) return;
    el.disabled = true;
    const cr = $('#crystal');
    d().crystals++; d().coins += c.reward; save.flush();
    track('crystal_open', { n: d().crystals, coins: c.reward });
    sfx.resumeAudio(); hap.medium();
    cr.classList.add('shake');
    setTimeout(() => {
      cr.classList.remove('shake', 'ready'); cr.classList.add('open');
      sfx.shatter(0.5, 0.75, 1, 1); sfx.chime(4); hap.heavy();
      if (!calmMotion()) renderer.confetti(30);
      $('#sheet h2').textContent = 'Shattered.';
      $('#sheet .sub').textContent = 'The next one is already filling.';
      setTimeout(() => { countUp($('#loot-n'), 0, c.reward); $('#home-coins span').textContent = d().coins.toLocaleString('en-US'); }, 250);
      el.disabled = false; el.dataset.act = 'collect'; el.textContent = 'Collect';
      $('#sheet [data-act="close"]')?.remove();
    }, calmMotion() ? 0 : 360);
  }, refreshHome);
}
$('#btn-crystal').addEventListener('click', () => { sfx.resumeAudio(); sfx.tap(); hap.light(); crystalSheet(); });

function refreshHome() {
  refreshCrystal();
  $('#home-stars span').textContent = totalStars();
  $('#home-coins span').textContent = d().coins.toLocaleString('en-US');
  const idx = progressIndex();
  const allDone = LEVELS.every((l) => d().stars[l.id]);
  $('#play-label').textContent = allDone ? 'Play again' : `Level ${idx + 1}`;
  const key = todayKey();
  const done = !!d().daily.done[key];
  const badge = $('#daily-badge');
  badge.textContent = done ? 'DONE' : 'NEW';
  badge.classList.toggle('done', done);
  $('#daily-sub').textContent = d().daily.streak > 0 && (done || d().daily.last === yesterdayKey())
    ? `${d().daily.streak}-day streak${done ? ' · back tomorrow' : ' · keep it going'}`
    : 'A new puzzle every day';
}

// ---------- demo (home background) ----------
// Home background: glass that lives between the logo and the buttons, smashed by an unseen cannon.
const DEMO = {
  id: 'demo', world: 0, par: 3, balls: 99, launcher: { x: 4.5 },
  objects: [
    { t: 'shelf', x: 2.0, y: 7.25, w: 2.8, h: 0.26, round: true },
    { t: 'glass', s: 'orb', x: 1.3, y: 6.0, r: 0.4, tint: 0 }, { t: 'rope', x: 1.3, y: 7.12, to: 1 },
    { t: 'glass', s: 'jar', x: 2.7, y: 5.75, w: 0.68, h: 0.86, tint: 1 }, { t: 'rope', x: 2.7, y: 7.12, to: 3 },
    { t: 'shelf', x: 6.9, y: 3.85, w: 3.0, h: 0.26, round: true },
    { t: 'glass', s: 'box', x: 6.2, y: 4.32, w: 0.68, h: 0.68, tint: 1 }, { t: 'glass', s: 'box', x: 6.9, y: 4.32, w: 0.68, h: 0.68, tint: 2 }, { t: 'glass', s: 'box', x: 7.6, y: 4.32, w: 0.68, h: 0.68, tint: 0 },
    { t: 'glass', s: 'box', x: 6.55, y: 5.01, w: 0.68, h: 0.68, tint: 0 }, { t: 'glass', s: 'box', x: 7.25, y: 5.01, w: 0.68, h: 0.68, tint: 1 },
    { t: 'glass', s: 'box', x: 6.9, y: 5.7, w: 0.68, h: 0.68, tint: 2 },
    { t: 'shelf', x: 1.9, y: 3.55, w: 2.6, h: 0.26, round: true },
    { t: 'glass', s: 'bottle', x: 1.0, y: 4.33, w: 0.5, h: 1.3, tint: 2 }, { t: 'glass', s: 'jar', x: 1.9, y: 4.12, w: 0.68, h: 0.86, tint: 0 }, { t: 'glass', s: 'bottle', x: 2.8, y: 4.33, w: 0.5, h: 1.3, tint: 1 },
    { t: 'shelf', x: 6.6, y: 6.6, w: 2.0, h: 0.26, round: true },
    { t: 'glass', s: 'orb', x: 6.1, y: 7.13, r: 0.4, tint: 2 }, { t: 'glass', s: 'jar', x: 7.1, y: 7.17, w: 0.62, h: 0.8, tint: 0 },
  ],
};
const demoExt = (o) => o.r ?? (o.h || 0) / 2;
const DEMO_BOX = DEMO.objects.filter((o) => o.t !== 'rope').reduce(([lo, hi], o) => [Math.min(lo, o.y - demoExt(o)), Math.max(hi, o.y + demoExt(o))], [Infinity, -Infinity]);
// Short phones leave less room between the tagline and the Daily card than tall ones:
// center the scene in that gap, and shrink it when it doesn't fit.
// layout position within #home; the entry animation's transforms make offsetTop relative to the animated parent
const homeTop = (el) => { let y = 0; for (; el && el.id !== 'home'; el = el.offsetParent) y += el.offsetTop; return y; };
function fitDemo() {
  const tag = $('#home .tagline'), daily = $('#btn-daily');
  if (!$('#home').classList.contains('on')) return DEMO.objects;
  const top = renderer.toWorld(0, homeTop(tag) + tag.offsetHeight + 10)[1];
  const bottom = renderer.toWorld(0, homeTop(daily) - 8)[1];
  const [lo, hi] = DEMO_BOX, mid = (lo + hi) / 2;
  const k = Math.max(0.6, Math.min(1, (top - bottom) / (hi - lo)));
  const cy = (top + bottom) / 2;
  return DEMO.objects.map((o) => {
    const n = { ...o, x: 4.5 + (o.x - 4.5) * k, y: cy + (o.y - mid) * k };
    for (const key of ['w', 'h', 'r']) if (o[key] != null) n[key] = o[key] * k;
    return n;
  });
}
function loadDemo(w) {
  game.load({ ...DEMO, world: w, objects: fitDemo() }, { palette: WORLDS[w], quiet: true });
  demoTimer = 1.6;
}
function demoTick(dt) {
  const sim = game.sim;
  if (!sim) return;
  demoTimer -= dt;
  if (sim.st.won || sim.st.used >= 6) { if (demoTimer < -2.2) loadDemo(current?.level?.world ?? LEVELS[progressIndex()].world); return; }
  if (demoTimer <= 0) {
    demoTimer = 1.9 + Math.random() * 1.2;
    // like a player: try a few angles and take one the aim guide says reaches glass
    let a = 0;
    for (let i = 0; i < 6; i++) {
      a = MIN_ANGLE + Math.random() * (MAX_ANGLE - MIN_ANGLE);
      const g = ghostPath(planck, sim, a, 1);
      if (g.hit?.kind === 'glass' || g.hit2?.kind === 'glass') break;
    }
    sim.fire(a);
  }
}

// ---------- play ----------
function startLevel(index, opts = {}) {
  const level = opts.daily ? opts.level : LEVELS[index];
  current = { level, index, daily: !!opts.daily, dateKey: opts.dateKey };
  continued = false;
  closeSheet(true);
  mode = 'play';
  const p = applyPalette(level.world);
  game.load(level, { palette: p, hint: opts.hint });
  $('#hud-level').textContent = `${opts.daily ? 'Daily Smash' : `Level ${index + 1}`} · Par ${level.par}`;
  updateGlassPips(true);
  updateHint();
  // coach: the three tutorial levels, then one line when a world introduces something new
  const fresh = !opts.daily && !d().stars[level.id];
  const intro = fresh && index > 0 && index % PER_WORLD === 0 ? WORLD_INTRO[level.world] : null;
  const tut = fresh && index < 3;
  $('#coach').hidden = !(tut || intro);
  // the coach floats just above the cannon, whatever the screen's shape
  $('#coach').style.bottom = `${Math.round(window.innerHeight - renderer.floorY() + renderer.scale * 1.75)}px`;
  $('#coach').classList.toggle('textonly', !tut);
  $('#coach-text').textContent = intro || (index === 0 ? 'Pull back anywhere, then release' : index === 1 ? 'Line them up. The ball goes straight through glass' : 'Knock it down. Falling glass shatters');
  show('hud');
  // the first time a world opens, it introduces itself
  if (!opts.daily && fresh && index > 0 && index % PER_WORLD === 0 && !d().worldsSeen.includes(level.world)) {
    d().worldsSeen.push(level.world);
    const w = WORLDS[level.world], card = $('#worldcard');
    card.querySelector('small').textContent = `World ${level.world + 1}`;
    card.querySelector('b').textContent = w.name;
    card.querySelector('span').textContent = w.sub;
    card.classList.remove('play'); void card.offsetWidth; card.classList.add('play');
  }
  d().stats.played++;
  save.touch();
  sfx.startMusic();
  track('level_start', { id: level.id });
}

function updateGlassPips(reset) {
  const el = $('#hud-glass');
  const sim = game.sim;
  if (!sim || mode !== 'play') return;
  const total = current.level.objects.filter((o) => o.t === 'glass').length;
  if (reset || el.children.length !== total) {
    el.innerHTML = '';
    for (let i = 0; i < total; i++) el.appendChild(document.createElement('i'));
  }
  const left = sim.st.glass;
  [...el.children].forEach((c, i) => c.classList.toggle('gone', i >= left));
  el.setAttribute('aria-label', `${left} glass left`);
}

function updateHint() {
  const b = $('#hint-badge');
  const w = current?.level?.world ?? 0;
  if (current?.daily) { b.textContent = ''; b.className = 'badge ad'; b.innerHTML = '<svg style="width:12px;height:12px"><use href="#i-video"/></svg>'; return; }
  if (!d().hints[w]) { b.className = 'badge'; b.textContent = '1'; }
  else { b.className = 'badge ad'; b.innerHTML = '<svg style="width:12px;height:12px"><use href="#i-video"/></svg>'; }
}

async function useHint() {
  if (!current || mode !== 'play' || game.busy) return;
  const lv = current.level;
  if (!lv.proof?.length) return;
  const w = lv.world;
  const free = !d().hints[w] && !current.daily;
  const apply = () => {
    const a = lv.proof[0] * Math.PI / 180;
    if (game.fired > 0) startLevel(current.index, { daily: current.daily, level: lv, dateKey: current.dateKey, hint: a });
    else game.showHint(a);
    toast('Aim along the line for the first shot');
    track('hint_used', { id: lv.id });
  };
  if (free) { d().hints[w] = true; save.touch(); updateHint(); apply(); return; }
  game.pause();
  openSheet(`
    <div class="bigicon"><svg><use href="#i-bulb"/></svg></div>
    <h2>Need a hint?</h2>
    <p class="sub">See the first shot of a solution.${game.fired > 0 ? ' The level restarts.' : ''}</p>
    <div class="actions">
      <button class="btn accent" data-act="ad"><svg><use href="#i-video"/></svg>Watch video</button>
      <button class="btn ghost" data-act="coins" ${d().coins < HINT_COST ? 'disabled' : ''}><svg style="color:#F2A83B"><use href="#i-coin"/></svg>${HINT_COST} coins</button>
      <button class="btn ghost" data-act="close">Not now</button>
    </div>`, async (act) => {
    if (act === 'close') { closeSheet(); game.resume(); return; }
    if (act === 'coins') { d().coins -= HINT_COST; save.touch(); closeSheet(); game.resume(); apply(); return; }
    if (act === 'ad') { const ok = await showRewarded('hint'); closeSheet(); game.resume(); if (ok) apply(); }
  });
}

function onWin(res) {
  if (!current || mode !== 'play') return;
  const lv = current.level;
  const stars = continued ? 1 : res.stars;
  const prev = current.daily ? 0 : (d().stars[lv.id] || 0);
  let coins;
  if (current.daily) {
    const key = current.dateKey;
    const first = !d().daily.done[key];
    if (first) {
      d().daily.done[key] = stars;
      // the streak continues from the day before this puzzle's date, even if it ends after midnight
      d().daily.streak = d().daily.last === prevDayKey(key) ? d().daily.streak + 1 : 1;
      d().daily.last = key;
      d().daily.best = Math.max(d().daily.best, d().daily.streak);
    }
    coins = first ? 50 + 10 * Math.min(d().daily.streak, 7) : 5;
  } else {
    coins = prev === 0 ? 10 + 5 * stars : Math.max(5, (stars - prev) * 5);
    if (res.maxCombo >= 3) coins += Math.min(20, res.maxCombo * 2);
    const before = totalStars();
    const wasReady = crystalState().ready;
    d().stars[lv.id] = Math.max(prev, stars);
    if (!wasReady && crystalState().ready) setTimeout(() => toast('Your star crystal is full', true), 1600);
    // star milestones unlock balls on their own
    const after = totalStars();
    for (const sk of SKINS) {
      if (sk.stars && before < sk.stars && after >= sk.stars && !d().owned.includes(sk.id)) {
        d().owned.push(sk.id);
        setTimeout(() => toast(`New ball unlocked: ${sk.name}`, true), 1400);
      }
    }
  }
  const worldDone = !current.daily && prev === 0 && (current.index + 1) % PER_WORLD === 0;
  d().coins += coins;
  d().stats.clears++;
  d().stats.glass += res.broken;
  const bestChain = res.maxCombo >= 4 && res.maxCombo > d().stats.bestCombo; // a personal record worth naming
  d().stats.bestCombo = Math.max(d().stats.bestCombo, res.maxCombo);
  d().stats.shots += res.used;
  save.flush();
  track('level_complete', { id: lv.id, stars, used: res.used, combo: res.maxCombo });
  // ask for a store review once, at a happy moment
  if (!d().reviewAsked && !current.daily && current.index >= 11 && stars === 3 && isNative()) {
    d().reviewAsked = true; save.touch();
    setTimeout(() => { window.Capacitor?.Plugins?.InAppReview?.requestReview?.()?.catch?.(() => {}); }, 2200);
  }

  const isLast = !current.daily && current.index === LEVELS.length - 1;
  const titles = ['Shattered.', 'Clean break.', 'Smashing.', 'Crystal clear.', 'Flawless.'];
  let title = stars === 3 ? (res.used === 1 && lv.par === 1 ? 'One shot.' : titles[Math.floor(Math.random() * titles.length)]) : stars === 2 ? 'Nice.' : 'Cleared.';
  const nextWorld = WORLDS[lv.world + 1];
  if (worldDone) title = `${WORLDS[lv.world].name} complete.`;
  openSheet(`
    <div class="stars">${[0, 1, 2].map((i) => `<svg class="${i < stars ? 'on' : ''}"><use href="#i-star"/></svg>`).join('')}</div>
    <h2>${title}</h2>
    <div class="statline"><span>${res.used} ${res.used === 1 ? 'ball' : 'balls'} · par ${lv.par}</span>${res.maxCombo >= 2 && !bestChain ? `<span>×${res.maxCombo} combo</span>` : ''}</div>
    ${bestChain ? `<div class="record">New best chain · ×${res.maxCombo}</div>` : ''}
    ${worldDone && nextWorld ? `<p class="sub">Next up: <b>${nextWorld.name}</b> · ${nextWorld.sub}</p>` : ''}
    <div class="reward"><svg><use href="#i-coin"/></svg><span id="reward-n">+0</span></div>
    <div class="actions">
      ${current.daily ? '' : `<button class="btn primary big" data-act="next">${isLast ? 'Finish' : 'Next'}<svg><use href="#i-play"/></svg></button>`}
      ${current.daily ? '<button class="btn primary big" data-act="home">Done</button>' : ''}
      <div class="rowbtns">
        <button class="btn ghost" data-act="double"><svg><use href="#i-video"/></svg>×2 coins</button>
        <button class="btn ghost" data-act="${current.daily ? 'retry' : 'retry'}"><svg><use href="#i-restart"/></svg>Replay</button>
      </div>
    </div>`, async (act, el) => {
    if (act === 'next') {
      closeSheet();
      await maybeInterstitial(current.index);
      if (current.index === 7 && !d().starterSeen && !d().noAds) { d().starterSeen = true; save.touch(); starterOffer(() => startLevel(current.index + 1)); return; }
      if (isLast) { goHome(); toast('You cleared every level. New worlds are coming soon.'); return; }
      startLevel(current.index + 1);
    }
    if (act === 'home') {
      closeSheet();
      if (current.daily && isNative() && d().reminders === undefined && LN()) { reminderOffer(goHome); return; }
      if (current.daily) scheduleReminders();
      goHome();
    }
    if (act === 'retry') { startLevel(current.index, { daily: current.daily, level: lv, dateKey: current.dateKey }); }
    if (act === 'double') {
      const ok = await showRewarded('double_coins');
      if (ok) { d().coins += coins; save.flush(); countUp($('#reward-n'), coins, coins * 2); el.disabled = true; el.innerHTML = '<svg><use href="#i-check"/></svg>Doubled'; }
    }
  }, null, true);
  // a shower of glass confetti for a perfect clear; a bigger one when a world is done
  if (!calmMotion()) {
    if (worldDone) { const s = game.sim; renderer.confetti(60); setTimeout(() => { if (game.sim === s) renderer.confetti(40); }, 500); }
    else if (stars === 3) renderer.confetti(26);
  }
  // star + coin animation
  const svgs = document.querySelectorAll('#sheet .stars svg');
  svgs.forEach((s, i) => setTimeout(() => { s.classList.add('show'); if (i < stars) { sfx.star(i); hap.light(); } }, 260 + i * 220));
  setTimeout(() => countUp($('#reward-n'), 0, coins), 900);
}

function countUp(el, from, to) {
  if (!el) return;
  const t0 = performance.now(), dur = 600;
  let lastStep = -1;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    el.textContent = '+' + v;
    const step = Math.floor(k * 8);
    if (step !== lastStep && k < 1) { lastStep = step; sfx.coin(step); }
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function onLose() {
  if (!current || mode !== 'play') return;
  const sim = game.sim;
  const left = sim.st.glass;
  const canContinue = !continued;
  track('level_fail', { id: current.level.id, left });
  openSheet(`
    <div class="bigicon"><svg><use href="#i-ball"/></svg></div>
    <h2>Out of balls</h2>
    <p class="sub">${left} ${left === 1 ? 'piece' : 'pieces'} of glass left. So close.</p>
    <div class="actions">
      ${canContinue ? `<button class="btn accent big" data-act="ad"><svg><use href="#i-video"/></svg>+1 ball</button>
      <button class="btn ghost" data-act="coins" ${d().coins < CONTINUE_COST ? 'disabled' : ''}><svg style="color:#F2A83B"><use href="#i-coin"/></svg>+1 ball for ${CONTINUE_COST}</button>` : ''}
      <button class="btn ${canContinue ? 'ghost' : 'primary big'}" data-act="retry"><svg><use href="#i-restart"/></svg>Try again</button>
    </div>`, async (act) => {
    if (act === 'retry') { startLevel(current.index, { daily: current.daily, level: current.level, dateKey: current.dateKey }); return; }
    if (act === 'coins') { d().coins -= CONTINUE_COST; save.touch(); closeSheet(); doContinue(); return; }
    if (act === 'ad') { const ok = await showRewarded('continue'); if (ok) { closeSheet(); doContinue(); } }
  });
}
function doContinue() { continued = true; game.addBall(); track('continue', { id: current.level.id }); }

function pauseSheet() {
  if (mode !== 'play' || sheetOpen || game.busy) return;
  game.pause();
  const s = d().settings;
  openSheet(`
    <h2>Paused</h2>
    <p class="sub">${current.daily ? 'Daily Smash' : `Level ${current.index + 1} · ${WORLDS[current.level.world].name}`}</p>
    <div class="toggles">
      ${['sfx', 'music', 'haptics'].map((k) => `<button data-act="t-${k}" class="${s[k] ? '' : 'off'}" aria-pressed="${!!s[k]}"><span>${{ sfx: 'Sound', music: 'Music', haptics: 'Haptics' }[k]}</span><small>${s[k] ? 'On' : 'Off'}</small></button>`).join('')}
    </div>
    <div class="actions">
      <button class="btn primary big" data-act="resume"><svg><use href="#i-play"/></svg>Resume</button>
      <div class="rowbtns">
        <button class="btn ghost" data-act="restart"><svg><use href="#i-restart"/></svg>Restart</button>
        <button class="btn ghost" data-act="home"><svg><use href="#i-home"/></svg>Home</button>
      </div>
    </div>`, (act, el) => {
    if (act === 'resume') { closeSheet(); game.resume(); }
    if (act === 'restart') startLevel(current.index, { daily: current.daily, level: current.level, dateKey: current.dateKey });
    if (act === 'home') goHome();
    if (act.startsWith('t-')) {
      const k = act.slice(2); setSetting(k, !d().settings[k]);
      const on = !!d().settings[k];
      el.classList.toggle('off', !on); el.setAttribute('aria-pressed', on); el.querySelector('small').textContent = on ? 'On' : 'Off';
    }
  }, () => game.resume());
}

function starterOffer(after) {
  const p = PRODUCTS.find((x) => x.kind === 'starter');
  openSheet(`
    <button class="iconbtn close" data-act="close" aria-label="Close"><svg><use href="#i-close"/></svg></button>
    <div class="bigicon"><svg><use href="#i-bag"/></svg></div>
    <h2>Starter Pack</h2>
    <p class="sub">No ads, 1,500 coins and the Aurora ball. One time only.</p>
    <div class="actions">
      <button class="btn accent big" data-act="buy">${priceOf(p)}</button>
      <button class="btn ghost" data-act="close">No thanks</button>
    </div>`, async (act) => {
    if (act === 'close') { closeSheet(); after?.(); }
    if (act === 'buy') { const ok = await purchase(p); if (ok) { closeSheet(); toast('Thank you. Enjoy the Aurora ball.'); after?.(); } }
  }, after);
  track('offer_shown', { id: p.id });
}

// ---------- sheets ----------
let sheetOpen = false, sheetHandler = null, sheetDismiss = null;
function openSheet(html, handler, onDismiss, soft = false) {
  const sh = $('#sheet');
  sh.classList.remove('closing');
  sh.innerHTML = html;
  sh.hidden = false; $('#scrim').hidden = false;
  $('#scrim').classList.toggle('soft', soft); // a win keeps the celebration visible behind the sheet
  document.body.classList.add('sheet-open');
  sheetOpen = true; sheetHandler = handler; sheetDismiss = onDismiss || null;
  const first = sh.querySelector('[data-act]');
  first?.focus({ preventScroll: true });
}
function closeSheet(instant) {
  if (!sheetOpen) return;
  sheetOpen = false; sheetHandler = null; sheetDismiss = null;
  document.body.classList.remove('sheet-open');
  const sh = $('#sheet');
  $('#scrim').hidden = true;
  if (instant) { sh.hidden = true; return; }
  sh.classList.add('closing');
  setTimeout(() => { if (!sheetOpen) sh.hidden = true; }, 240);
}
$('#sheet').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !sheetHandler || b.disabled) return;
  sfx.tap(); hap.light();
  sheetHandler(b.dataset.act, b);
});
$('#scrim').addEventListener('click', () => {
  if (!sheetDismiss) return;
  const f = sheetDismiss; closeSheet(); f();
});

// a reply to a tap shows at once; background news (unlocks, a full crystal) queues so both are read
const toastQueue = [];
function toast(msg, queue = false) {
  if (queue && toast.busy) { if (!toastQueue.includes(msg)) toastQueue.push(msg); return; }
  const t = $('#toast');
  toast.busy = true;
  t.hidden = true; void t.offsetWidth;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => {
    t.hidden = true; toast.busy = false;
    if (toastQueue.length) setTimeout(() => toast(toastQueue.shift(), true), 180);
  }, 2500);
}

// ---------- levels page: each world is a map, its levels gems on a trail ----------
let viewWorld = 0, levelMap = null, mapKey = '';
// the level to play next, or -1 once every level is cleared
const nextIndex = () => { const i = progressIndex(); return d().stars[LEVELS[i].id] ? -1 : i; };
function openLevels() {
  mode = 'page';
  const next = nextIndex(), from = d().mapAt;
  viewWorld = LEVELS[progressIndex()].world;
  show('levels'); // first: the map measures its view
  renderLevels();
  if (next < 0) return;
  d().mapAt = next; save.touch();
  // progress since the last visit: the ball hops on from where the map last left it
  if (from !== undefined && from < next && !calmMotion()) {
    // after the screen's entrance, so the first hop isn't lost in the fade
    levelMap.travel(from, { delay: 380, land: (n, last) => { sfx.tink(last ? n + 2 : n); if (last) hap.light(); else hap.selection(); } });
  }
}
function renderLevels(keepScroll) {
  applyPalette(viewWorld);
  $('#levels-stars span').textContent = totalStars();
  const tabs = $('#world-tabs');
  tabs.innerHTML = WORLDS.map((w, i) => {
    const open = unlocked(i * PER_WORLD);
    return `<button class="wtab${open ? '' : ' locked'}" role="tab" aria-selected="${i === viewWorld}" data-w="${i}">${open ? `<i style="background:${w.accent}"></i>` : '<svg><use href="#i-lock"/></svg>'}${w.name}</button>`;
  }).join('');
  // the chosen world's tab stays in view (by hand: scrollIntoView would also move the page)
  const tab = tabs.children[viewWorld];
  tabs.scrollLeft = Math.max(0, tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2);
  const scroller = $('#map-scroll'), y = scroller.scrollTop;
  scroller.setAttribute('aria-label', `${WORLDS[viewWorld].name} map`);
  const first = viewWorld * PER_WORLD;
  const levels = LEVELS.slice(first, first + PER_WORLD).map((lv, k) => ({ index: first + k, stars: d().stars[lv.id] || 0, open: unlocked(first + k) }));
  // the same world, progress, ball and width as last time: the map already on the page is the one to show
  const key = JSON.stringify([viewWorld, levels, nextIndex(), d().skin, scroller.clientWidth, calmMotion()]);
  if (key !== mapKey) {
    mapKey = key;
    levelMap = buildMap(scroller, {
      world: viewWorld, worlds: WORLDS, levels, current: nextIndex(),
      ball: mapBall,
      stars: worldStars(LEVELS, viewWorld), nextOpen: unlocked(first + PER_WORLD), calm: calmMotion(),
    });
  }
  if (keepScroll) scroller.scrollTop = y; else levelMap.scrollToCurrent();
}
// the map's ball: drawn once per skin, then shown as an image (no new canvas to upload on every visit)
const ballImages = {};
function mapBall(size) {
  const skin = SKINS.find((s) => s.id === d().skin) || SKINS[0];
  const key = `${skin.id}/${size}`;
  if (!ballImages[key]) ballImages[key] = skinCanvas(skin, size, 3).toDataURL();
  const img = new Image(size, size);
  img.alt = ''; img.src = ballImages[key];
  return img;
}
function switchWorld(w) {
  if (w === viewWorld) return;
  viewWorld = w;
  renderLevels();
  if (!calmMotion()) { const m = $('#map-scroll .map'); m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter'); }
}
$('#world-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-w]'); if (!b) return;
  sfx.tap(); hap.selection(); switchWorld(+b.dataset.w);
});
$('#map-scroll').addEventListener('click', (e) => {
  if (mode !== 'page') return;
  const g = e.target.closest('[data-gate]');
  if (g) {
    const w = +g.dataset.gate;
    if (!unlocked(w * PER_WORLD)) { hap.warning(); toast(`Clear level ${w * PER_WORLD} to open ${WORLDS[w].name}`); return; }
    sfx.tap(); hap.light(); switchWorld(w);
    return;
  }
  const b = e.target.closest('[data-i]'); if (!b) return;
  const i = +b.dataset.i;
  if (!unlocked(i)) {
    hap.warning(); toast(`Clear level ${progressIndex() + 1} first`);
    // the level to play answers with a hop
    const c = $('#map-scroll .node.current');
    if (c) { c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge'); }
    return;
  }
  sfx.tap(); hap.light();
  startLevel(i);
});

// ---------- shop (balls) ----------
function openShop() {
  mode = 'page';
  renderShop();
  show('shop');
}
function skinCanvas(skin, size, maxDpr = 2) {
  const c = document.createElement('canvas');
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  c.width = c.height = size * dpr;
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  renderer.drawBall(x, size / 2, size / 2, size * 0.36, skin, 0.4);
  return c;
}
function renderShop(previewId) {
  $('#shop-coins span').textContent = d().coins.toLocaleString('en-US');
  const sel = SKINS.find((s) => s.id === (previewId || d().skin)) || SKINS[0];
  const pc = $('#ball-preview');
  const px = pc.getContext('2d');
  px.setTransform(1, 0, 0, 1, 0, 0); px.clearRect(0, 0, 240, 240);
  renderer.drawBall(px, 120, 116, 82, sel, 0.4);
  if (previewId) { pc.classList.remove('pop'); void pc.offsetWidth; pc.classList.add('pop'); }
  $('#ball-name').textContent = sel.name;
  const grid = $('#skin-grid');
  grid.innerHTML = '';
  const stars = totalStars();
  for (const s of SKINS) {
    const owned = d().owned.includes(s.id);
    const b = document.createElement('button');
    b.className = 'skin' + (owned ? ' owned' : '') + (d().skin === s.id ? ' equipped' : '');
    b.dataset.id = s.id;
    b.appendChild(skinCanvas(s, 64));
    const name = document.createElement('span'); name.textContent = s.name; b.appendChild(name);
    const pr = document.createElement('span'); pr.className = 'price';
    if (d().skin === s.id) pr.textContent = 'Equipped';
    else if (owned) pr.textContent = 'Owned';
    else if (s.stars) pr.innerHTML = `<svg style="color:#F5B83D"><use href="#i-star"/></svg>${Math.min(stars, s.stars)} / ${s.stars}`;
    else if (s.iap) pr.textContent = s.iap === 'starter' ? 'Starter Pack' : priceOf(PRODUCTS.find((p) => p.skin === s.id));
    else pr.innerHTML = `<svg><use href="#i-coin"/></svg>${s.price.toLocaleString('en-US')}`;
    b.appendChild(pr);
    grid.appendChild(b);
  }
}
$('#skin-grid').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-id]'); if (!b) return;
  const s = SKINS.find((x) => x.id === b.dataset.id);
  sfx.tap(); hap.light();
  const owned = d().owned.includes(s.id);
  if (owned) { d().skin = s.id; save.flush(); renderShop(); return; }
  if (s.stars) {
    if (totalStars() >= s.stars) { d().owned.push(s.id); d().skin = s.id; save.flush(); sfx.win(); renderShop(); toast(`${s.name} unlocked`); }
    else { renderShop(s.id); toast(`Collect ${s.stars} stars to unlock ${s.name}`); }
    return;
  }
  if (s.iap) {
    const p = s.iap === 'starter' ? PRODUCTS.find((x) => x.kind === 'starter') : PRODUCTS.find((x) => x.skin === s.id);
    renderShop(s.id);
    const ok = await purchase(p);
    if (ok) { renderShop(); toast(`${s.name} is yours`); }
    return;
  }
  if (d().coins >= s.price) {
    d().coins -= s.price; d().owned.push(s.id); d().skin = s.id; save.flush();
    sfx.coin(4); hap.success(); renderShop(); toast(`${s.name} unlocked`);
    track('skin_buy', { id: s.id });
  } else { renderShop(s.id); toast(`You need ${s.price - d().coins} more coins`); }
});

// ---------- store (IAP) ----------
function openStore() {
  mode = 'page';
  renderStore();
  show('store');
}
function renderStore() {
  $('#store-coins span').textContent = d().coins.toLocaleString('en-US');
  const icon = { noads: 'i-noads', starter: 'i-bag', skin: 'i-ball', coins: 'i-coin' };
  $('#store-list').innerHTML = PRODUCTS.map((p) => {
    const owned = (p.kind === 'noads' && d().noAds) || (p.kind === 'starter' && d().owned.includes('aurora') && d().noAds) || (p.kind === 'skin' && d().owned.includes(p.skin));
    return `<div class="offer ${p.best ? 'best' : ''} ${owned ? 'owned' : ''}">
      ${p.best ? '<span class="tag">BEST VALUE</span>' : p.tag ? `<span class="tag">${p.tag}</span>` : ''}
      <div class="art" data-art="${p.kind === 'skin' ? p.skin : ''}"><svg style="${p.kind === 'coins' ? 'color:#F2A83B' : ''}"><use href="#${icon[p.kind]}"/></svg></div>
      <div class="txt"><b>${p.title}</b><small>${p.desc}</small></div>
      <button class="buy" data-p="${p.id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : priceOf(p)}</button>
    </div>`;
  }).join('');
  document.querySelectorAll('#store-list [data-art]').forEach((el) => {
    const sk = SKINS.find((x) => x.id === el.dataset.art);
    if (sk) { el.innerHTML = ''; const cv = skinCanvas(sk, 48); cv.style.width = cv.style.height = '48px'; el.appendChild(cv); }
  });
}
$('#store-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-p]'); if (!b || b.disabled) return;
  sfx.tap();
  const p = PRODUCTS.find((x) => x.id === b.dataset.p);
  const ok = await purchase(p);
  if (ok) { renderStore(); toast('Thank you for supporting SHARD'); sfx.win(); }
});
$('#btn-restore').addEventListener('click', () => restore().then(renderStore));
$('#btn-restore2').addEventListener('click', () => restore());

// ---------- settings ----------
function setSetting(k, v) {
  d().settings[k] = v; save.flush();
  if (k === 'sfx') sfx.setSfx(v);
  if (k === 'music') sfx.setMusic(v);
  if (k === 'haptics') hap.setHaptics(v);
}
function openSettings() {
  mode = 'page';
  $('#row-reminders').hidden = !LN();
  $('#set-reminders').checked = !!d().reminders;
  document.querySelectorAll('[data-setting]').forEach((el) => { el.checked = !!d().settings[el.dataset.setting]; });
  show('settings');
}
document.querySelectorAll('[data-setting]').forEach((el) => el.addEventListener('change', () => { setSetting(el.dataset.setting, el.checked); hap.light(); }));
$('#set-reminders').addEventListener('change', async (e) => {
  if (e.target.checked) { const ok = await enableReminders(); e.target.checked = ok; }
  else { d().reminders = false; save.flush(); try { await LN()?.cancel({ notifications: [101, 102, 103, 104, 105, 106, 107].map((id) => ({ id })) }); } catch (err) {} }
});
$('#btn-reset').addEventListener('click', () => {
  openSheet(`<h2>Reset progress?</h2><p class="sub">Stars, coins and balls you earned with coins will be cleared. Purchases stay.</p>
    <div class="actions"><button class="btn primary big" data-act="cancel">Keep my progress</button><button class="btn ghost danger" data-act="reset">Reset</button></div>`, (act) => {
    if (act === 'reset') {
      const keep = { noAds: d().noAds, owned: d().owned.filter((id) => SKINS.find((s) => s.id === id)?.iap) };
      save.reset(); d().noAds = keep.noAds; d().owned = ['steel', ...keep.owned]; save.flush();
      closeSheet(); toast('Progress reset'); goHome();
    } else closeSheet();
  }, () => {});
});

// ---------- daily ----------
function dayIndex(date = new Date()) { return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 0, 1)) / 86400000); }
function keyOf(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function todayKey() { return keyOf(new Date()); }
function yesterdayKey() { const t = new Date(); t.setDate(t.getDate() - 1); return keyOf(t); }
function prevDayKey(key) { const [y, m, dd] = key.split('-').map(Number); return keyOf(new Date(y, m - 1, dd - 1)); }
function startDaily() {
  const n = ((dayIndex() % DAILY.length) + DAILY.length) % DAILY.length;
  const lv = { ...DAILY[n], id: 'daily-' + todayKey() };
  startLevel(-1, { daily: true, level: lv, dateKey: todayKey() });
}

// ---------- daily reminder (local notification at 18:00, only on days not yet played) ----------
const LN = () => window.Capacitor?.Plugins?.LocalNotifications;
async function scheduleReminders() {
  const ln = LN();
  if (!ln || !d().reminders) return;
  try {
    await ln.cancel({ notifications: [101, 102, 103, 104, 105, 106, 107].map((id) => ({ id })) });
    const now = new Date();
    const streak = d().daily.streak;
    const notes = [];
    for (let i = 0; i < 7; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 18, 0, 0);
      if (i === 0 && (d().daily.done[todayKey()] || at <= now)) continue;
      notes.push({
        id: 101 + i,
        title: 'Your Daily Smash is ready',
        body: streak > 1 && i <= 1 ? `Keep your ${streak}-day streak alive. One fresh puzzle is waiting.` : 'A fresh glass puzzle is waiting. Go break something.',
        schedule: { at, allowWhileIdle: true },
        isExactNotification: false,
      });
    }
    if (notes.length) await ln.schedule({ notifications: notes });
  } catch (e) { /* reminders are a nice-to-have */ }
}
async function enableReminders() {
  const ln = LN();
  if (!ln) return false;
  try {
    const st = await ln.requestPermissions();
    if (st?.display !== 'granted') { toast('Notifications are off in your settings'); return false; }
    d().reminders = true; save.flush();
    await scheduleReminders();
    return true;
  } catch (e) { return false; }
}
function reminderOffer(after) {
  openSheet(`
    <div class="bigicon"><svg><use href="#i-cal"/></svg></div>
    <h2>Never miss a day</h2>
    <p class="sub">Get one gentle reminder at 6 PM, only on days you haven't played.</p>
    <div class="actions">
      <button class="btn primary big" data-act="yes">Remind me</button>
      <button class="btn ghost" data-act="no">Not now</button>
    </div>`, async (act) => {
    closeSheet();
    if (act === 'yes') { const ok = await enableReminders(); if (ok) toast('See you tomorrow'); }
    else { d().reminders = false; save.flush(); }
    after?.();
  }, () => { d().reminders = false; save.flush(); after?.(); });
}

// ---------- fake ads/purchases for the web build ----------
function fakeAd(kind) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fakead';
    let n = kind === 'rewarded' ? 5 : 3;
    el.innerHTML = `<span class="tag">TEST AD · ${kind.toUpperCase()}</span><button class="count" aria-label="Close ad">${n}</button><div style="font-size:42px">SHARD</div><div style="opacity:.7">Your ad could be here</div>`;
    document.body.appendChild(el);
    const btn = el.querySelector('.count');
    const t = setInterval(() => { n--; btn.textContent = n > 0 ? n : '✕'; if (n <= 0) clearInterval(t); }, 1000);
    btn.addEventListener('click', () => {
      if (n > 0 && kind === 'rewarded') return;
      clearInterval(t); el.remove(); resolve(n <= 0);
    });
  });
}
function fakePurchase(p) {
  return new Promise((resolve) => {
    openSheet(`<h2>${p.title}</h2><p class="sub">${p.desc}</p><p class="sub" style="font-size:13px">Test purchase. Nothing is charged in the web build.</p>
      <div class="actions"><button class="btn primary big" data-act="ok">Buy for ${p.price}</button><button class="btn ghost" data-act="no">Cancel</button></div>`,
    (act) => { closeSheet(); resolve(act === 'ok'); }, () => resolve(false));
  });
}

// ---------- wiring ----------
$('#btn-play').addEventListener('click', () => { sfx.resumeAudio(); sfx.tap(); hap.light(); startLevel(LEVELS.every((l) => d().stars[l.id]) ? 0 : progressIndex()); });
$('#btn-levels').addEventListener('click', () => { sfx.resumeAudio(); sfx.tap(); openLevels(); });
$('#btn-shop').addEventListener('click', () => { sfx.resumeAudio(); sfx.tap(); openShop(); });
$('#btn-store').addEventListener('click', () => { sfx.resumeAudio(); sfx.tap(); openStore(); });
$('#btn-settings').addEventListener('click', () => { sfx.resumeAudio(); sfx.tap(); openSettings(); });
$('#btn-daily').addEventListener('click', () => { sfx.resumeAudio(); sfx.tap(); hap.light(); startDaily(); });
$('#btn-pause').addEventListener('click', () => { sfx.tap(); pauseSheet(); });
$('#btn-hint').addEventListener('click', () => { sfx.tap(); useHint(); });
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { sfx.tap(); goHome(); }));
document.addEventListener('pointerdown', () => sfx.resumeAudio(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !sheetOpen && !game.sim?.st.won) pauseSheet(); });

// Android back button
window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => {
  if (sheetOpen) { if (sheetDismiss) { const f = sheetDismiss; closeSheet(); f(); } return; }
  if (mode === 'play') { pauseSheet(); return; }
  if (mode === 'page') { goHome(); return; }
  window.Capacitor.Plugins.App.exitApp?.();
});

// ---------- loop ----------
let last = performance.now();
let manual = false; // trailer capture drives frames by hand
function tick(dt) {
  window.__simClock = (window.__simClock || 0) + dt;
  if (mode === 'home') demoTick(dt);
  game.frame(dt);
}
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (manual) { requestAnimationFrame(loop); return; }
  // a device that can't hold ~50 fps steps down a tier (checked every 1.2 s of play)
  if (!document.hidden && mode === 'play') {
    emaDt += (dt - emaDt) * 0.06;
    tierClock += dt;
    if (tierClock > 1.2) { if (emaDt > 0.0205 && perfTier < 3) setTier(perfTier + 1); tierClock = 0; }
  }
  requestAnimationFrame(loop);
  if (mode === 'page') return; // pages are opaque: the scene behind them holds still
  try {
    if (mode === 'home') demoTick(dt);
    game.frame(dt);
  } catch (e) { console.error(e); }
}

// ---------- boot ----------
window.Capacitor?.Plugins?.StatusBar?.hide?.()?.catch?.(() => {});
// start one tier above the last one measured: a passing hiccup never degrades a device for good
setTier(Math.max(0, (d().perfTier | 0) - 1));
sfx.setSfx(d().settings.sfx); sfx.setMusic(d().settings.music); hap.setHaptics(d().settings.haptics);
document.addEventListener('pointerdown', () => { sfx.initAudio(); sfx.setSfx(d().settings.sfx); sfx.setMusic(d().settings.music); }, { once: true, capture: true });
initMonetization({ fakeAd, fakePurchase, toast });
scheduleReminders();
$('#version').textContent = `SHARD 1.0 · ${LEVELS.length} levels`;
if (!d().stars[LEVELS[0].id]) {
  // first launch goes straight into the first level: no menus before the fun
  startLevel(0);
} else goHome();
requestAnimationFrame(loop);
window.__shard = { game, save, startLevel, goHome, LEVELS, DAILY, get mode() { return mode; }, tick, setManual: (v) => { manual = v; } };
