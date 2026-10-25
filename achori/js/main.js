import * as THREE from 'three';
import { Game, TOOLS, cellOf, MICE } from './game.js';
import { LEVELS, AREAS } from './levels.js';
import { Scene, IMAGES, wx, wz } from './scene.js';
import { LINES, pick, WHO, TOOL_INFO, HINTS } from './text.js';
import * as audio from './audio.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 120;

// ---------- saved progress ----------
const SAVE_KEY = 'achori.v1';
const save = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { s = null; }
  return Object.assign({ unlocked: 0, stars: [], muted: false, ido: 0, hints: {} }, s || {});
})();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ } }

// ---------- state ----------
let scene = null;
let game = null;
let levelIndex = 0;
let tool = null;
let paused = false;
let acc = 0;
let last = 0;
let ended = false;
let endTimer = 0;
let hintQueue = [];
const views = new Map(); // mouse id -> floating HTML bits
let particles = [];
let fxCtx = null;
let comboEl = null;
let tickerX = 0, tickerW = 0;

// ---------- screens ----------
const SCREENS = ['loading', 'title', 'levels', 'dialog', 'pause', 'result', 'ending'];
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('show', s === id);
}
function playing(on) {
  $('hud').hidden = !on;
  $('tray').hidden = !on;
  if (on) requestAnimationFrame(layout);
}

// ---------- loading ----------
async function load() {
  const loader = new THREE.TextureLoader();
  const tex = {};
  let done = 0;
  const all = [...IMAGES];
  const extra = ['keyart', 'ofek', 'shalev', 'shaked', 'slipper'];
  const total = all.length + extra.length;
  const tick = () => { done++; $('load-fill').style.width = (100 * done / total) + '%'; };
  await Promise.all([
    ...all.map((name) => new Promise((res, rej) => {
      loader.load(`img/${name}.webp`, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        tex[name] = t; tick(); res();
      }, undefined, () => rej(new Error('missing ' + name)));
    })),
    ...extra.map((name) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = () => { tick(); res(); }; im.src = `img/${name}.webp`; })),
  ]);
  return tex;
}

// ---------- layout ----------
function layout() {
  if (!scene) return;
  const w = window.innerWidth, h = window.innerHeight;
  let top = 70, bottom = 150;
  if (!$('hud').hidden) top = $('hud').getBoundingClientRect().bottom + 4;
  if (!$('tray').hidden) bottom = h - $('tray').getBoundingClientRect().top + 2;
  scene.resize(w, h, { top, bottom });
  const fx = $('fx');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.width = Math.round(w * dpr); fx.height = Math.round(h * dpr);
  fxCtx = fx.getContext('2d');
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------- title & levels ----------
function soundLabel() {
  const t = audio.isMuted() ? 'צליל: כבוי' : 'צליל: פועל';
  $('sound-btn').textContent = t;
  $('pause-sound').textContent = t;
}
function toggleSound() {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  save.muted = audio.isMuted();
  persist();
  soundLabel();
}

function idoCall() {
  audio.unlock();
  audio.sfx.ring();
  save.ido = (save.ido || 0) + 1;
  persist();
  let msg = pick('ido');
  if (save.ido === 10) msg = 'פנית לסוללת אידו 10 פעמים. אף אחד לא ענה. כל הכבוד על ההתמדה.';
  if (save.ido === 50) msg = 'פנייה מס׳ 50! סוללת אידו שלחו לך מגנט למקרר. העכבר אכל אותו.';
  toast(msg, 'ido', 3400);
  const b = $('ido-btn');
  b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring');
}

function renderLevels() {
  const list = $('levels-list');
  list.innerHTML = '';
  let area = -1;
  LEVELS.forEach((lv, i) => {
    if (lv.area !== area) {
      area = lv.area;
      const h = document.createElement('div');
      h.className = 'area-name';
      h.textContent = AREAS[area].name;
      list.appendChild(h);
    }
    const locked = i > save.unlocked;
    const b = document.createElement('button');
    b.type = 'button';
    const won = (save.stars[i] || 0) > 0;
    b.className = 'lvl' + (locked ? ' locked' : '') + (!won && !locked ? ' mice' : '');
    const st = save.stars[i] || 0;
    b.innerHTML = `<div class="num">${locked ? '🔒' : i + 1}</div>
      <div class="info"><div class="name"></div><div class="sub"></div></div>
      <div class="st"><i class="${st > 0 ? 'on' : ''}"></i><i class="${st > 1 ? 'on' : ''}"></i><i class="${st > 2 ? 'on' : ''}"></i></div>`;
    b.querySelector('.name').textContent = lv.name;
    b.querySelector('.sub').textContent = locked ? 'נעול' : won ? 'שוחרר מעכברים' : 'בשליטת העכברים';
    if (locked) b.querySelector('.num').textContent = '×';
    b.addEventListener('click', () => {
      audio.unlock();
      if (locked) { audio.sfx.error(); toast('קודם תשחרר את השלב הקודם', 'bad'); return; }
      audio.sfx.tap();
      openLevel(i);
    });
    list.appendChild(b);
  });
  const freed = LEVELS.filter((_, i) => (save.stars[i] || 0) > 0).length;
  const pct = Math.round(100 * (LEVELS.length - freed) / LEVELS.length);
  $('takeover-text').textContent = pct > 0 ? `העכברים שולטים ב-${pct}% מהאתר` : 'האתר נקי מעכברים!';
  $('take-fill').style.width = pct + '%';
}

// ---------- the story before each level ----------
let dlg = null;
function openLevel(i) {
  levelIndex = i;
  const lv = LEVELS[i];
  playing(false);
  show('dialog');
  $('dlg-title').innerHTML = `<small></small>`;
  $('dlg-title').querySelector('small').textContent = `שלב ${i + 1} · ${AREAS[lv.area].name}`;
  $('dlg-title').appendChild(document.createTextNode(lv.name));
  dlg = { lines: lv.intro || [], n: 0 };
  // the room behind the dialogue
  prepareLevel(i);
  nextLine();
}
function nextLine() {
  if (!dlg) return;
  if (dlg.n >= dlg.lines.length) { dlg = null; beginPlan(); return; }
  const [who, text] = dlg.lines[dlg.n++];
  const panel = $('dlg-panel');
  panel.className = 'dlg-panel' + (who === 'lior' ? ' left' : '');
  const img = $('dlg-who');
  img.src = WHO[who].img;
  $('dlg-name').textContent = WHO[who].name;
  $('dlg-line').textContent = text;
  // restart the entry animations
  for (const el of [img, panel.querySelector('.dlg-bubble')]) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  if (who === 'lior') audio.sfx.squeak(); else audio.sfx.tap();
}

// ---------- a level ----------
function prepareLevel(i) {
  const lv = LEVELS[i];
  ended = false;
  endTimer = 0;
  paused = false;
  game = new Game(lv, { seed: 1000 + i * 17 + Math.floor(Math.random() * 1000) });
  scene.setArea(AREAS[lv.area]);
  scene.buildLevel(game);
  scene.showGrid(true);
  scene.setRoutes(game.previewRoutes());
  clearViews();
  particles = [];
  tool = lv.tools.includes('snap') ? 'snap' : lv.tools[0];
  buildTools();
  $('hud-level').textContent = `${i + 1}. ${lv.name}`;
  $('row-plan').hidden = false;
  $('row-action').hidden = true;
  $('ab-shalev').hidden = !lv.shalev;
  $('ab-ofek').hidden = !lv.ofek;
  $('ab-shaked').hidden = !lv.shaked;
  $('boss').hidden = true;
  renderHud();
  audio.stopMusic();
}

function beginPlan() {
  show(null);
  playing(true);
  const lv = LEVELS[levelIndex];
  hintQueue = [];
  if (lv.tutorial && !save.hints.tutorial) hintQueue.push(...HINTS.tutorial);
  if (lv.hint && !save.hints[lv.hint]) hintQueue.push(HINTS[lv.hint]);
  if (lv.tutorial) save.hints.tutorial = true;
  if (lv.hint) save.hints[lv.hint] = true;
  if (lv.hint2 && !save.hints[lv.hint2]) { hintQueue.push(HINTS[lv.hint2]); save.hints[lv.hint2] = true; }
  persist();
  nextHint();
}

function nextHint() {
  const h = hintQueue.shift();
  if (!h) { $('hint').hidden = true; return; }
  $('hint-text').textContent = h;
  const el = $('hint');
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}

function buildTools() {
  const box = $('tools');
  box.innerHTML = '';
  for (const k of LEVELS[levelIndex].tools) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.dataset.tool = k;
    b.innerHTML = `<img alt="" src="${TOOL_INFO[k].img}"><span></span><b>${TOOLS[k].cost}₪</b>`;
    b.querySelector('span').textContent = TOOL_INFO[k].name;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.unlock();
      audio.sfx.tap();
      tool = tool === k && game.phase === 'action' ? null : k;
      if (game.phase === 'plan') tool = k;
      toast(`${TOOL_INFO[k].name}: ${TOOL_INFO[k].desc}`, '', 1500);
      renderTools();
    });
    box.appendChild(b);
  }
  renderTools();
}

function renderTools() {
  for (const b of $('tools').children) {
    const k = b.dataset.tool;
    b.classList.toggle('on', k === tool);
    b.classList.toggle('poor', TOOLS[k].cost > game.budget);
  }
}

function renderHud() {
  $('money-n').textContent = game.budget;
  const p = $('pitas');
  const carried = game.mice.filter((m) => m.alive && m.carrying).length;
  if (p.children.length !== game.foodMax) {
    p.innerHTML = '';
    for (let i = 0; i < game.foodMax; i++) { const d = document.createElement('i'); d.className = 'pita'; p.appendChild(d); }
  }
  [...p.children].forEach((d, i) => {
    d.classList.toggle('gone', i >= game.food + carried);
    d.classList.toggle('carried', i >= game.food && i < game.food + carried);
  });
  $('ab-ofek-n').textContent = game.abilities.ofek;
  $('ab-shalev-n').textContent = game.abilities.shalev;
  $('ab-ofek').disabled = !(game.abilities.ofek > 0);
  $('ab-shalev').disabled = !(game.abilities.shalev > 0);
  $('ab-shaked-n').textContent = game.abilities.shaked;
  $('ab-shaked').disabled = !(game.abilities.shaked > 0);
  const lior = game.mice.find((m) => m.type === 'lior');
  if (lior) {
    $('boss').hidden = false;
    $('boss-fill').style.width = (100 * lior.hp / lior.hpMax) + '%';
  }
  renderTools();
}

function startAction() {
  if (!game || game.phase !== 'plan') return;
  audio.unlock();
  $('hint').hidden = true;
  hintQueue = [];
  game.start();
  scene.showGrid(false);
  tool = null;
  renderTools();
  $('row-plan').hidden = true;
  $('row-action').hidden = false;
  requestAnimationFrame(layout);
  audio.startMusic();
  pop(window.innerWidth / 2, window.innerHeight * 0.42, 'יאללה!', 'big');
  audio.sfx.whoosh();
}

// ---------- input ----------
function onPointer(e) {
  if (!game || paused || ended) return;
  if (document.querySelector('.screen.show')) return;
  audio.unlock();
  const x = e.clientX, y = e.clientY;
  if (game.phase === 'plan') return planTap(x, y);
  if (game.phase === 'action') return actionTap(x, y);
}

function planTap(x, y) {
  const cell = scene.pickCell(x, y);
  if (cell == null) return;
  const { c, r } = cellOf(cell);
  const it = game.cells[cell];
  if (it && !it.fixed) {
    game.remove(c, r);
    audio.sfx.remove();
    afterChange();
    return;
  }
  if (!tool) { toast('בחר משהו למטה כדי לשים'); return; }
  const why = game.place(tool, c, r);
  if (why) return refuse(why, cell);
  audio.sfx.place();
  burstAt(scene.project(wx(c), 0.1, wz(r)), 10, '#c8b9a0', 3);
  afterChange();
  if (LEVELS[levelIndex].tutorial && tool === 'snap' && hintQueue.length) nextHint();
}

function refuse(why, cell) {
  audio.sfx.error();
  const msg = LINES.errors[why];
  if (msg) toast(msg, 'bad');
  if (why === 'money') { const m = $('money'); m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash'); }
  scene.setHover(cell, false);
  setTimeout(() => scene && scene.setHover(null), 350);
}

function afterChange() {
  scene.syncItems();
  if (game.phase === 'plan') scene.setRoutes(game.previewRoutes());
  renderHud();
}

function actionTap(x, y) {
  const px = scene.cellPixels();
  let best = null, bestK = Infinity;
  for (const m of game.mice) {
    if (!m.alive || m.state === 'emerge' || m.state === 'leaving' || m.state === 'away') continue;
    const s = scene.mouseScreen(m);
    const held = game.isHeld(m);
    const R = px * (held ? 1.15 : 0.85) * (m.type === 'lior' ? 1 : 0.85);
    const d = Math.hypot(s.x - x, s.y - y);
    const k = d / R;
    if (k < bestK) { bestK = k; best = { m, d, R, held }; }
  }
  if (best && bestK < 1) {
    const res = game.whack(best.m, 1 - bestK);
    slap(x, y);
    if (res === 'hit') onHit(best.m, x, y);
    return;
  }
  if (tool) {
    const cell = scene.pickCell(x, y);
    if (cell != null) {
      const { c, r } = cellOf(cell);
      const why = game.place(tool, c, r);
      if (why) { refuse(why, cell); return; }
      audio.sfx.place();
      tool = null;
      afterChange();
      return;
    }
  }
  slap(x, y);
  audio.sfx.whack(0.35);
  if (best && bestK < 1.8) game.miss(best.m);
  else game.miss(null);
}

function onHit(m, x, y) {
  audio.sfx.whack(game.combo >= 12 ? 1.3 : 1);
  scene.hitFlash(m.id);
  scene.shake = Math.min(1, scene.shake + 0.35);
  navigator.vibrate?.(14);
  const words = ['באם!', 'טראח!', 'בום!', 'פאק!', 'בננה!', 'קבום!', 'טוש!'];
  if (Math.random() < 0.5) pop(x + (Math.random() - 0.5) * 60, y - 60, words[Math.floor(Math.random() * words.length)], Math.random() < 0.5 ? 'red' : '');
  burstAt({ x, y }, 7, m.type === 'lior' ? '#9a9aa2' : '#8a5a36', 4, 'fur');
  if (Math.random() < 0.3) burstAt({ x, y }, 3, '#ffd23f', 5, 'star');
}

// ---------- events from the rules ----------
function handleEvents() {
  for (const ev of game.drain()) {
    const m = ev.id ? game.mice.find((q) => q.id === ev.id) : null;
    const at = m ? scene.mouseScreen(m) : null;
    switch (ev.type) {
      case 'spawn':
        audio.sfx.squeak(m && m.type === 'minion' ? 1.3 : 1);
        if (m && m.type === 'lior') say(m, pick(ev.back ? 'liorBack' : 'liorSpawn'));
        renderHud();
        break;
      case 'snap':
        audio.sfx.snap();
        audio.heat(true);
        scene.shake = 1;
        flash();
        navigator.vibrate?.([30, 30, 40]);
        if (at) { pop(at.x, at.y - 70, 'נתפס!', 'big'); burstAt(at, 14, '#e0c08a', 6); }
        if (m && m.type === 'lior') say(m, pick('liorCaught'));
        break;
      case 'glued':
        audio.sfx.glue();
        audio.heat(true);
        if (at) pop(at.x, at.y - 60, 'נדבק!', 'green');
        if (m && m.type === 'lior') say(m, pick('liorGlued'));
        break;
      case 'eat':
        audio.sfx.chomp();
        audio.heat(true);
        if (at) pop(at.x, at.y - 60, 'נעצר לאכול!', '');
        if (m && m.type === 'lior') say(m, pick('liorEat'));
        break;
      case 'hit':
        if (m && at && ev.how === 'whack') floatText(at.x + (Math.random() - 0.5) * 30, at.y - 30, '-' + ev.n);
        if (m && m.type === 'lior') {
          const b = $('boss'); b.classList.remove('hurt'); void b.offsetWidth; b.classList.add('hurt');
          if (m.hp > 0 && m.hp / m.hpMax < 0.25 && !m.saidLow) { m.saidLow = true; say(m, pick('liorLow')); }
        }
        if (ev.combo >= 3 && ev.how === 'whack') audio.sfx.combo(Math.min(ev.combo, 20));
        renderHud();
        break;
      case 'dodge':
        if (m && m.type === 'lior' && Math.random() < 0.5) say(m, pick('liorDodge'));
        audio.sfx.whoosh();
        break;
      case 'free':
        audio.sfx.free();
        if (at) pop(at.x, at.y - 60, 'ברח!', 'red');
        if (m && m.type === 'lior') say(m, pick('liorFree'));
        scene.syncItems();
        break;
      case 'broke':
        scene.syncItems();
        break;
      case 'steal':
        audio.sfx.steal();
        if (m && m.type === 'lior') say(m, pick('liorSteal'));
        if (Math.random() < 0.5 || !game.level.shaked) toast('אופק: ' + pick('ofekPanic'), 'bad', 1600);
        else toast('שקד: ' + pick('shakedRant'), 'bad', 1600);
        renderHud();
        bumpPitas();
        break;
      case 'recovered':
        audio.sfx.recovered();
        if (at) pop(at.x, at.y - 90, 'הפיתה חזרה!', 'green');
        renderHud();
        bumpPitas();
        break;
      case 'escaped':
        if (at) pop(at.x, at.y - 50, 'ברח עם פיתה!', 'red');
        renderHud();
        break;
      case 'left':
        dropView(ev.id);
        renderHud();
        break;
      case 'kill': {
        audio.sfx.kill();
        scene.shake = 1;
        navigator.vibrate?.([40, 40, 80]);
        if (at) {
          pop(at.x, at.y - 80, m && m.type === 'lior' ? 'חוסל!' : 'באומון חוסל!', 'big');
          burstAt(at, 26, '#ffd23f', 8, 'star');
          burstAt(at, 16, '#9a9aa2', 6, 'fur');
        }
        if (m && m.type === 'lior') { toast('אופק: ' + pick('ofekHappy'), '', 1600); }
        dropView(ev.id, true);
        scene.syncItems();
        renderHud();
        break;
      }
      case 'ability':
        if (ev.name === 'ofek') {
          audio.sfx.scream();
          callout('img/ofek.webp', 'אייייייי!');
          flash();
          scene.shake = 1;
          for (const q of game.liveMice()) if (q.type === 'lior') say(q, pick('liorStunned'));
        } else if (ev.name === 'shaked') {
          audio.sfx.ring();
          callout('img/shaked.webp', 'אני מתלוננת!');
          setTimeout(() => { audio.sfx.recovered(); toast('סוללת אידו נשברו מהתלונות של שקד והחזירו ₪3', 'ido', 2600); }, 700);
          const mn = $('money'); mn.classList.remove('flash'); void mn.offsetWidth;
        } else {
          audio.sfx.disconnect();
          callout('img/shalev.webp', 'לא מתחבר.');
          for (const q of game.liveMice()) if (q.type === 'lior') say(q, pick('liorConfused'));
        }
        renderHud();
        break;
      case 'won':
      case 'lost':
        ended = true;
        endTimer = ev.type === 'won' ? 2.4 : 1.4;
        audio.heat(false);
        break;
      default:
    }
  }
}

function bumpPitas() {
  for (const d of $('pitas').children) { d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); }
}

// ---------- floating HTML over the 3D view ----------
function viewFor(m) {
  let v = views.get(m.id);
  if (v) return v;
  const hp = document.createElement('div');
  hp.className = 'hp';
  hp.innerHTML = '<i></i>';
  const mash = document.createElement('div');
  mash.className = 'mash';
  mash.innerHTML = '<svg viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="44"/><circle class="ring" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="100 100"/></svg><div class="label">תכסח אותו!</div>';
  mash.hidden = true;
  $('float').append(hp, mash);
  v = { hp, mash, bubble: null, bubbleT: 0 };
  views.set(m.id, v);
  return v;
}

function dropView(id, keepBubble = false) {
  const v = views.get(id);
  if (!v) return;
  v.hp.remove();
  v.mash.remove();
  if (v.bubble && !keepBubble) v.bubble.remove();
  else if (v.bubble) { const b = v.bubble; setTimeout(() => b.remove(), 900); }
  views.delete(id);
}

function clearViews() {
  $('float').innerHTML = '';
  views.clear();
  if (comboEl) { comboEl.remove(); comboEl = null; }
}

function say(m, text) {
  const v = viewFor(m);
  if (v.bubble) v.bubble.remove();
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = text;
  $('float').appendChild(b);
  v.bubble = b;
  v.bubbleT = 2.0;
  placeBubble(m, v);
}

function placeBubble(m, v) {
  const s = scene.mouseScreen(m);
  const w = v.bubble.offsetWidth || 120;
  const half = w / 2 + 8;
  const x = Math.max(half, Math.min(window.innerWidth - half, s.x));
  v.bubble.style.left = x + 'px';
  v.bubble.style.top = Math.max(130, s.y - scene.cellPixels() * 1.45) + 'px';
}

function updateViews(dt) {
  const px = scene.cellPixels();
  for (const m of game.mice) {
    if (m.state === 'away' || (!m.alive && !views.has(m.id))) continue;
    if (!m.alive) continue;
    const v = viewFor(m);
    const s = scene.mouseScreen(m);
    const show = m.state !== 'emerge' && m.state !== 'leaving';
    v.hp.hidden = !show;
    if (show) {
      v.hp.style.left = s.x + 'px';
      v.hp.style.top = (s.y - px * (m.type === 'lior' ? 1.25 : 0.85)) + 'px';
      v.hp.firstChild.style.width = (100 * m.hp / m.hpMax) + '%';
    }
    const held = game.isHeld(m) && m.heldMax > 0;
    v.mash.hidden = !held;
    if (held) {
      v.mash.style.left = s.x + 'px';
      v.mash.style.top = (s.y + 4) + 'px';
      const size = px * 1.9;
      v.mash.style.width = v.mash.style.height = size + 'px';
      const k = Math.max(0, m.t / m.heldMax);
      v.mash.querySelector('.ring').setAttribute('stroke-dasharray', `${(k * 100).toFixed(1)} 100`);
      v.mash.querySelector('.label').textContent = m.state === 'stunned' ? 'עכשיו!' : 'תכסח אותו!';
    }
    if (v.bubble) {
      v.bubbleT -= dt;
      placeBubble(m, v);
      if (v.bubbleT <= 0) { const b = v.bubble; b.classList.add('out'); setTimeout(() => b.remove(), 300); v.bubble = null; }
    }
  }
  audio.heat(game.mice.some((m) => m.alive && game.isHeld(m)));
  // combo counter
  if (game.combo >= 3) {
    if (!comboEl) { comboEl = document.createElement('div'); comboEl.className = 'combo'; document.body.appendChild(comboEl); }
    comboEl.innerHTML = `x${game.combo}<small>${game.combo >= 12 ? 'נזק כפול!' : 'קומבו'}</small>`;
    comboEl.style.transform = `scale(${1 + Math.min(0.6, game.combo * 0.02) + (game.comboT > 0.65 ? 0.15 : 0)})`;
  } else if (comboEl) { comboEl.remove(); comboEl = null; }
  // the ability buttons glow when the food is in danger
  const g = cellOf(game.goal);
  const danger = game.mice.some((m) => m.alive && !game.isHeld(m) && m.state !== 'away' && (m.carrying || Math.hypot(m.x - g.c, m.z - g.r) < 2.2));
  $('ab-ofek').classList.toggle('ready', danger && game.abilities.ofek > 0);
  $('ab-shalev').classList.toggle('ready', danger && game.abilities.shalev > 0);
}

// ---------- effects ----------
function pop(x, y, text, cls = '') {
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.textContent = text;
  el.style.left = Math.max(70, Math.min(window.innerWidth - 70, x)) + 'px';
  el.style.top = y + 'px';
  $('float').appendChild(el);
  setTimeout(() => el.remove(), 750);
}
function floatText(x, y, text) {
  const el = document.createElement('div');
  el.className = 'pop dmg';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  $('float').appendChild(el);
  setTimeout(() => el.remove(), 650);
}
function slap(x, y) {
  const el = document.createElement('div');
  el.className = 'slap';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  $('float').appendChild(el);
  setTimeout(() => el.remove(), 300);
}
function flash() {
  const f = $('flash');
  f.hidden = false;
  f.style.animation = 'none'; void f.offsetWidth; f.style.animation = '';
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { f.hidden = true; }, 360);
}
function callout(img, text) {
  const c = $('callout');
  $('callout-img').src = img;
  $('callout-text').textContent = text;
  c.hidden = false;
  for (const el of [$('callout-img'), $('callout-text')]) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  clearTimeout(callout.t);
  callout.t = setTimeout(() => { c.hidden = true; }, 1500);
}
let toastT = 0;
function toast(text, cls = '', ms = 2200) {
  const t = $('toast');
  t.textContent = text;
  t.className = 'toast ' + cls;
  t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}

function burstAt(p, n, color, speed, kind = 'dust') {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random()) * 60;
    particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, life: 0.5 + Math.random() * 0.5, t: 0, color, kind, size: kind === 'star' ? 6 + Math.random() * 6 : 3 + Math.random() * 4, rot: Math.random() * 6 });
  }
}

function drawParticles(dt) {
  if (!fxCtx) return;
  const g = fxCtx;
  g.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => (p.t += dt) < p.life);
  for (const p of particles) {
    p.vy += 420 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += dt * 8;
    const k = 1 - p.t / p.life;
    g.globalAlpha = Math.min(1, k * 1.5);
    g.fillStyle = p.color;
    g.strokeStyle = '#1a120c';
    g.lineWidth = 1.5;
    if (p.kind === 'star') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? p.size * 0.45 : p.size; const a = i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke(); g.restore();
    } else if (p.kind === 'fur') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.ellipse(0, 0, p.size * 1.4, p.size * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
    } else {
      g.beginPath(); g.arc(p.x, p.y, p.size * (0.6 + k * 0.4), 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
}

function updateTicker(dt) {
  const box = $('ticker');
  if ($('hud').hidden) return;
  const wrapW = box.parentElement.clientWidth;
  if (!tickerW || tickerX > wrapW + 10) {
    box.textContent = pick('ticker');
    tickerW = box.offsetWidth;
    tickerX = -tickerW;
  }
  tickerX += dt * 46;
  box.style.transform = `translateX(${tickerX}px)`;
  box.style.left = '0';
}

// ---------- end of a level ----------
function finish() {
  audio.stopMusic();
  clearViews();
  const won = game.phase === 'won';
  playing(false);
  show('result');
  const stars = won ? game.stars() : 0;
  if (won) {
    save.stars[levelIndex] = Math.max(save.stars[levelIndex] || 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length - 1, levelIndex + 1));
    persist();
    audio.sfx.win();
  } else {
    audio.sfx.lose();
  }
  $('res-img').src = won ? 'img/lior_ko.webp' : 'img/lior_eat.webp';
  $('res-title').textContent = won ? 'ליאור חוסל!' : 'העכברים ניצחו';
  $('res-line').textContent = won ? pick('win') : pick('lose');
  const st = $('res-stars').children;
  [...st].forEach((s, i) => {
    s.className = '';
    if (i < stars) setTimeout(() => { s.className = 'on show'; audio.sfx.star(i); }, 350 + i * 300);
    else s.className = 'show';
  });
  const s = game.stats;
  $('res-stats').innerHTML = '';
  const add = (t) => { const e = document.createElement('span'); e.textContent = t; $('res-stats').appendChild(e); };
  add(`מכות: ${s.hits}`);
  add(`קומבו שיא: ${s.bestCombo}`);
  add(`פיתות שנשארו: ${game.food}/${game.foodMax}`);
  if (s.kills > 1) add(`חיסולים: ${s.kills}`);
  const last = levelIndex === LEVELS.length - 1;
  $('res-next').hidden = !won;
  $('res-next').textContent = last ? 'לסיום' : 'לשלב הבא';
  $('res-retry').textContent = won ? 'שחק שוב' : 'נסה שוב';
}

// ---------- pause ----------
function pause() {
  if (!game || game.phase === 'won' || game.phase === 'lost' || ended) return;
  if (document.querySelector('.screen.show')) return;
  paused = true;
  audio.stopMusic();
  $('pause-quote').textContent = pick('ticker');
  show('pause');
}
function resume() {
  paused = false;
  show(null);
  last = performance.now();
  if (game && game.phase === 'action') audio.startMusic();
}

// ---------- the loop ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (!scene) return;
  if (game && !paused) {
    if (game.phase === 'action') {
      acc += dt;
      while (acc >= STEP) { game.update(STEP); acc -= STEP; }
    } else acc = 0;
    if (game.events.length) handleEvents();
    scene.syncMice(dt);
    updateViews(dt);
    updateTicker(dt);
    if (ended) {
      endTimer -= dt;
      if (endTimer <= 0) { ended = false; finish(); }
    }
  }
  drawParticles(paused ? 0 : dt);
  scene.render(paused ? 0 : dt);
}

// ---------- wiring ----------
function wire() {
  $('gl').addEventListener('pointerdown', onPointer);
  $('gl').addEventListener('pointermove', (e) => {
    if (!game || game.phase !== 'plan' || e.pointerType !== 'mouse' || !tool) { return; }
    const cell = scene.pickCell(e.clientX, e.clientY);
    if (cell == null) { scene.setHover(null); return; }
    const { c, r } = cellOf(cell);
    const it = game.cells[cell];
    scene.setHover(cell, (it && !it.fixed) || !game.canPlace(tool, c, r));
  });
  $('gl').addEventListener('pointerleave', () => scene && scene.setHover(null));
  $('go-btn').addEventListener('click', startAction);
  $('ido-btn').addEventListener('click', idoCall);
  $('ido-title').addEventListener('click', idoCall);
  $('ab-ofek').addEventListener('click', () => { if (game.useAbility('ofek')) handleEvents(); });
  $('ab-shalev').addEventListener('click', () => { if (game.useAbility('shalev')) handleEvents(); });
  $('ab-shaked').addEventListener('click', () => { if (game.useAbility('shaked')) handleEvents(); });
  $('pause-btn').addEventListener('click', () => { audio.sfx.tap(); pause(); });
  $('resume-btn').addEventListener('click', () => { audio.sfx.tap(); resume(); });
  $('restart-btn').addEventListener('click', () => { audio.sfx.tap(); paused = false; prepareLevel(levelIndex); beginPlan(); });
  $('pause-levels').addEventListener('click', () => { audio.sfx.tap(); paused = false; toLevels(); });
  $('pause-sound').addEventListener('click', toggleSound);
  $('sound-btn').addEventListener('click', toggleSound);
  $('hint-ok').addEventListener('click', (e) => { e.stopPropagation(); audio.sfx.tap(); nextHint(); });
  $('play-btn').addEventListener('click', () => {
    audio.unlock(); audio.sfx.tap();
    const firstOpen = LEVELS.findIndex((_, i) => !(save.stars[i] > 0));
    openLevel(firstOpen < 0 ? LEVELS.length - 1 : Math.min(firstOpen, save.unlocked));
  });
  $('levels-btn').addEventListener('click', () => { audio.unlock(); audio.sfx.tap(); toLevels(); });
  $('levels-back').addEventListener('click', () => { audio.sfx.tap(); toTitle(); });
  $('dialog').addEventListener('click', (e) => { if (e.target.id !== 'dlg-skip') nextLine(); });
  $('dlg-skip').addEventListener('click', (e) => { e.stopPropagation(); audio.sfx.tap(); dlg = null; beginPlan(); });
  $('res-next').addEventListener('click', () => {
    audio.sfx.tap();
    if (levelIndex === LEVELS.length - 1) { show('ending'); audio.sfx.win(); return; }
    openLevel(levelIndex + 1);
  });
  $('res-retry').addEventListener('click', () => { audio.sfx.tap(); prepareLevel(levelIndex); beginPlan(); });
  $('res-levels').addEventListener('click', () => { audio.sfx.tap(); toLevels(); });
  $('end-btn').addEventListener('click', () => { audio.sfx.tap(); toLevels(); });
  window.addEventListener('resize', () => requestAnimationFrame(layout));
  document.addEventListener('visibilitychange', () => { if (document.hidden && game && game.phase === 'action') pause(); });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
}

function toLevels() {
  game = null;
  playing(false);
  audio.stopMusic();
  clearViews();
  if (scene) scene.clearLevel();
  renderLevels();
  show('levels');
}
function toTitle() { show('title'); }

async function boot() {
  audio.setMuted(!!save.muted);
  soundLabel();
  wire();
  try {
    const tex = await load();
    scene = new Scene($('gl'), tex);
    layout();
    $('load-msg').textContent = 'מוכן';
    show('title');
  } catch (err) {
    $('load-msg').textContent = 'משהו השתבש בטעינה. נסה לרענן.';
    console.error(err);
  }
  last = performance.now();
  requestAnimationFrame(frame);
}

boot();

// for tests
window.__achori = { get game() { return game; }, get scene() { return scene; }, LEVELS, save, MICE };
