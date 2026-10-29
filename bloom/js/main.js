import {
  COLS, ROWS, WEED, emptyBoard, cloneBoard, heights, canDrop, drop, resolve, rotate, anyDrop, growWeeds,
  pieceWidth, pieceHeight, fillCount, idx, seedGarden,
} from './board.js';
import { makePieceFor, colorCount } from './engine.js';
import { stepPoints, CLEAR_GARDEN_BONUS } from './rules.js';
import { createRenderer, previewSkin } from './render.js';
import { drawGarden } from './garden.js';
import { sfx, unlock, setSound } from './audio.js';
import {
  meta, save, SKINS, currentSkin, buySkin, selectSkin, checkStreak, missions, missionText, progressMissions,
  addChestBlooms, CHEST_GOAL, addXp, xpForLevel, finishGame,
} from './meta.js';

const $ = (id) => document.getElementById(id);
const M = meta();
setSound(M.sound);
const fmt = (n) => Math.round(n).toLocaleString('he-IL');
const gem = '<svg><use href="#i-gem"/></svg>';
const plus = (n) => `<bdi dir="ltr">+${typeof n === 'number' ? fmt(n) : n}</bdi>`;
const vibrate = (p) => { if (M.haptics && navigator.vibrate) navigator.vibrate(p); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const canvas = $('board');
const R = createRenderer(canvas);
let G = null; // the game in progress
let screen = 'home';

// ---- game state ------------------------------------------------------------------------------
const sized = (p) => ({ ...p, w: pieceWidth(p), h: pieceHeight(p) });

function freshGame() {
  const b = emptyBoard();
  return {
    board: b, view: b, tray: [null, null, null], score: 0, shown: 0, drops: 0, dropsSinceBloom: 0, lastChain: 0,
    blooms: 0, weeds: 0, specials: 0, maxChain: 0, maxGroup: 0, weedTimer: 0, chanceUsed: false, recordShown: false,
    over: false, overT: 0, busy: false, drag: null, think: [], lastAction: performance.now(), engine: null,
  };
}

function saveGame() {
  if (!G) return;
  const { board, tray, score, drops, dropsSinceBloom, lastChain, blooms, weeds, specials, maxChain, maxGroup, weedTimer, chanceUsed, recordShown } = G;
  M.saved = {
    grid: [...board.grid], spec: [...board.spec], tray: tray.map((p) => p && { shape: p.piece.shape, cells: p.piece.cells, colors: p.piece.colors }),
    score, drops, dropsSinceBloom, lastChain, blooms, weeds, specials, maxChain, maxGroup, weedTimer, chanceUsed, recordShown,
  };
  save();
}

function restoreGame(s) {
  const g = freshGame();
  Object.assign(g, s);
  g.board = { grid: Uint8Array.from(s.grid), spec: Uint8Array.from(s.spec) };
  g.view = g.board;
  g.shown = s.score;
  g.tray = s.tray.map((p) => p && { piece: sized(p), t0: performance.now() });
  return g;
}

function engineCtx(extra = {}) {
  const think = G.think.length ? G.think.reduce((a, b) => a + b, 0) / G.think.length : 0;
  return {
    board: G.board, score: G.score, best: M.best, gamesPlayed: M.games, drops: G.drops,
    dropsSinceBloom: G.dropsSinceBloom, lastChain: G.lastChain, thinkMs: think, recentScores: M.recent, ...extra,
  };
}

function newPiece(extra) {
  const t = makePieceFor(engineCtx(extra));
  G.engine = t;
  return { piece: sized(t.piece), t0: performance.now() };
}

function updateFits() { for (const p of G.tray) if (p) p.fits = anyDrop(G.board, p.piece); }

// ---- input -----------------------------------------------------------------------------------
function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function dragTo(d, x, y) {
  const L = R.layout, cell = L.cell, p = d.piece;
  d.x = x - p.w * cell / 2;
  d.y = d.touch ? y - p.h * cell - cell * 0.9 : y - p.h * cell / 2;
  const col = Math.max(0, Math.min(COLS - p.w, Math.round((d.x - L.boardX) / cell)));
  d.w = p.w;
  d.valid = d.y + p.h * cell < L.boardY + L.bh + cell * 0.6 && canDrop(G.board, p, col);
  if (col === d.col && d.landing) return;
  d.col = col;
  d.landing = null; d.preview = null;
  if (!canDrop(G.board, p, col)) return;
  // where the seeds land, and which seeds would bloom
  const t = cloneBoard(G.board);
  const landed = drop(t, p, col);
  d.landing = landed.map((q) => ({ r: q.r, c: q.c, color: t.grid[idx(q.r, q.c)] }));
  const steps = resolve(cloneBoard(t));
  d.preview = steps.length ? steps[0].cleared.map((q) => idx(q.r, q.c)) : null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!G || G.over || G.busy || G.drag || !$('overlay').hidden) return;
  unlock();
  const p = pos(e);
  const i = R.layout.slots.findIndex((s, k) => G.tray[k] && Math.abs(p.x - s.x) < s.w / 2 && Math.abs(p.y - s.y) < s.h / 2 + 10);
  if (i < 0) return;
  G.drag = { slot: i, piece: G.tray[i].piece, touch: e.pointerType !== 'mouse', id: e.pointerId, sx: p.x, sy: p.y, t0: performance.now(), moved: false, col: -1 };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  const d = G?.drag;
  if (!d || d.id !== e.pointerId) return;
  const p = pos(e);
  if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) < 10) return;
  if (!d.moved) { d.moved = true; sfx.pick(); vibrate(5); hint(null); }
  const was = d.valid && d.col;
  dragTo(d, p.x, p.y);
  if (d.valid && d.col !== was) vibrate(2);
});

function endDrag(e) {
  const d = G?.drag;
  if (!d || d.id !== e.pointerId) return;
  G.drag = null;
  const slot = G.tray[d.slot];
  if (!d.moved) {
    // a tap turns the bundle
    slot.piece = sized(rotate(slot.piece));
    slot.rotT = performance.now();
    slot.fits = anyDrop(G.board, slot.piece);
    sfx.tick();
    vibrate(4);
    M.tutRotate = true;
    return;
  }
  if (d.valid) dropAt(d.slot, d.col);
  else { slot.t0 = performance.now() - 220; sfx.nope(); }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---- dropping, blooming, chains --------------------------------------------------------------
const PRAISE = ['יפה!', 'מעולה!', 'מדהים!', 'וואו!', 'פנומנלי!', 'בלתי נתפס!'];

async function dropAt(slot, col) {
  G.busy = true;
  const now = performance.now();
  const piece = G.tray[slot].piece;
  G.tray[slot] = null;
  G.think = [...G.think, now - G.lastAction].slice(-3);
  const landed = drop(G.board, piece, col);
  G.view = cloneBoard(G.board);
  R.fall(landed.map((q) => ({ c: q.c, from: q.from - 1, to: q.r })), now, 200);
  G.drops++;
  await sleep(260);
  sfx.place(landed.length);
  vibrate(8);
  R.pop(landed.map((q) => [q.r, q.c]), performance.now());

  const steps = resolve(G.board, landed.map((q) => idx(q.r, q.c)));
  await playSteps(steps, landed);
  G.dropsSinceBloom = steps.length ? 0 : G.dropsSinceBloom + 1;
  G.lastChain = steps.length;

  // weeds
  G.weedTimer--;
  if (G.weedTimer <= 0) {
    const plan = G.engine.weeds;
    const h = heights(G.board);
    const cols = [...Array(COLS).keys()].filter((c) => h[c] < ROWS).sort(() => Math.random() - 0.5).slice(0, plan.count);
    growWeeds(G.board, cols);
    G.view = cloneBoard(G.board);
    const moves = [];
    for (const c of cols) for (let r = 0; r < ROWS; r++) if (G.board.grid[idx(r, c)]) moves.push({ c, from: r + 1, to: r });
    R.fall(moves, performance.now(), 260);
    R.setShake(5, performance.now());
    sfx.weeds();
    vibrate([10, 30, 10]);
    G.weedTimer = plan.every;
    await sleep(300);
    const more = resolve(G.board);
    if (more.length) await playSteps(more, []);
  }

  G.tray[slot] = newPiece();
  for (const m of progressMissions(totals(false))) missionToast(m);
  G.view = G.board;
  G.lastAction = performance.now();
  G.busy = false;
  updateFits();
  saveGame();
  showDebug();
  tutorial();
  if (!G.tray.some((p) => p && p.fits)) gameOver();
}

async function playSteps(steps, landed) {
  const skin = currentSkin();
  for (const st of steps) {
    const now = performance.now();
    G.view = st.mid;
    const pts = stepPoints(st);
    G.score += pts;
    G.blooms += st.groups.length;
    G.weeds += st.weeds;
    G.specials += st.made.length;
    G.maxChain = Math.max(G.maxChain, st.chain);
    for (const g of st.groups) G.maxGroup = Math.max(G.maxGroup, g.size);
    const power = st.cleared.length / 4 + st.chain;
    R.bloom(st.cleared, skin.colors, now, power);
    const mid = st.cleared[Math.floor(st.cleared.length / 2)];
    const [cx, cy] = R.cellCenter(mid.r, mid.c);
    R.float(`+${fmt(pts)}`, cx, cy, now + 120, { color: st.chain >= 2 ? '#ffd23d' : '#fff', size: 1 + Math.min(0.9, st.chain * 0.15 + st.cleared.length * 0.02) });
    R.setShake(3 + st.chain * 2 + (st.blasts.length ? 8 : 0), now);
    sfx.clear(Math.min(4, st.groups.length + Math.floor(st.cleared.length / 6)), st.chain);
    vibrate(st.chain >= 2 ? [20, 40, 30] : 18);
    if (st.blasts.length) { sfx.big(); R.setFlash(st.blasts.some((b) => b.kind === 2) ? '#ffffff' : '#ffd23d', now); }
    if (st.made.length) setTimeout(() => { sfx.gem(); R.pop(st.made.map((m) => [m.r, m.c]), performance.now()); }, 250);
    if (st.chain >= 2) R.setBanner(`שרשרת x${st.chain}!`, PRAISE[Math.min(PRAISE.length - 1, st.chain - 2)], now, ['#ffd23d', '#ff9ad5', '#7de3ff', '#b6ff6d'][st.chain % 4]);
    else if (st.made.length) R.setBanner(st.made[0].kind === 2 ? 'פרח קשת!' : 'חמנייה!', st.made[0].kind === 2 ? 'מפריח את כל הצבע שלו' : 'מפוצצת 3x3 כשהיא פורחת', now, '#7de3ff');
    else if (st.cleared.length >= 7) R.setBanner(PRAISE[Math.min(PRAISE.length - 1, st.cleared.length - 6)], '', now, '#b6ff6d');
    bumpScore();
    checkRecord();
    await sleep(380);
    G.view = st.after;
    R.fall(st.moves, performance.now(), 200);
    if (st.moves.length) await sleep(230);
  }
  // a clean garden only counts when there was a real garden to clear
  if (steps.length && fillCount(G.board) === 0 && steps.reduce((n, st) => n + st.cleared.length, 0) >= 12) {
    G.score += CLEAR_GARDEN_BONUS;
    const now = performance.now();
    R.setBanner('גן נקי!', `+${fmt(CLEAR_GARDEN_BONUS)}`, now, '#7dffb0');
    R.setFlash('#ffffff', now);
    sfx.allClear();
    await sleep(500);
  }
}

function checkRecord() {
  if (M.best > 0 && !G.recordShown && G.score > M.best) {
    G.recordShown = true;
    setTimeout(() => { const t = performance.now(); R.setBanner('שיא חדש!', '', t, '#ffd23d'); R.setFlash('#ffd23d', t); sfx.record(); vibrate([30, 50, 30, 50, 60]); }, 600);
  }
}

const totals = (finished) => ({ blooms: G.blooms, weeds: G.weeds, specials: G.specials, score: G.score, maxChain: G.maxChain, maxGroup: G.maxGroup, finished });

function bumpScore() {
  const el = $('g-score');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 130);
}

function updateHud() {
  G.shown += Math.ceil((G.score - G.shown) * 0.18);
  if (G.shown > G.score) G.shown = G.score;
  $('g-score').textContent = fmt(G.shown);
  $('g-best').textContent = fmt(Math.max(M.best, G.recordShown ? G.score : 0));
  const chase = $('g-chase');
  let text = '', hot = false;
  if (G.recordShown) { text = 'שיא חדש!'; hot = true; }
  else if (M.best > 0 && G.score >= M.best * 0.7) { text = `עוד ${fmt(M.best - G.score + 1)} לשיא!`; hot = G.score >= M.best * 0.9; }
  if (chase.textContent !== text) chase.textContent = text;
  chase.classList.toggle('hot', hot);
}

// ---- first-game hints ------------------------------------------------------------------------
function hint(text) {
  const el = $('hint');
  if (!text) { el.hidden = true; return; }
  el.textContent = text;
  el.hidden = false;
}
function tutorial() {
  if (M.games > 0 || !G) return hint(null);
  if (G.drops === 0) hint('גררו צרור זרעים מעל הגן ושחררו. הזרעים נופלים');
  else if (G.blooms === 0 && G.drops < 6) hint('4 זרעים באותו צבע שנוגעים זה בזה פורחים!');
  else if (!M.tutRotate && G.drops < 12) hint('הקישו על צרור כדי לסובב אותו');
  else if (G.drops < 14 && G.weedTimer <= 2) hint('עשבים עולים מלמטה. הפריחו לידם כדי לעקור אותם');
  else hint(null);
}

// ---- game over, second chance, results -------------------------------------------------------
function gameOver() {
  if (G.over) return;
  G.over = true;
  G.overT = performance.now();
  sfx.over();
  vibrate([60, 60, 120]);
  saveGame();
  setTimeout(() => (G.chanceUsed ? finish() : offerChance()), 1300);
}

function offerChance() {
  const gap = M.best - G.score;
  const close = M.best > 0 && gap > 0 && G.score >= M.best * 0.6;
  modal(`
    <h2>הגן התמלא!</h2>
    <p>${close ? `אתם רק <b style="color:#ffd23d">${fmt(gap + 1)}</b> נקודות מהשיא` : 'אפשר להמשיך מאיפה שעצרתם'}</p>
    <div class="btns">
      <button class="btn gold" data-act="chance"><svg><use href="#i-gift"/></svg> צ׳אנס נוסף</button>
      <button class="btn quiet" data-act="end">סיום</button>
    </div>
    <p style="font-size:13px">צ׳אנס אחד חינם בכל משחק</p>`, {
    chance: () => { closeModal(); secondChance(); },
    end: () => { closeModal(); finish(); },
  });
}

function secondChance() {
  G.chanceUsed = true;
  G.over = false;
  G.overT = 0;
  const now = performance.now();
  // the top four rows burst into flowers, then fresh kind bundles and a break from the weeds
  const cleared = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(r, c);
    if (G.board.grid[i]) { cleared.push({ r, c, color: G.board.grid[i] }); G.board.grid[i] = 0; G.board.spec[i] = 0; }
  }
  G.view = G.board;
  R.bloom(cleared, currentSkin().colors, now, 3);
  R.setShake(12, now);
  sfx.big();
  R.setBanner('ממשיכים!', '', now, '#7dffb0');
  G.tray = [0, 1, 2].map((i) => { const p = newPiece({ rescue: true }); p.t0 = now + 200 + i * 80; return p; });
  G.weedTimer += 3;
  updateFits();
  saveGame();
}

function finish() {
  const s = G.score, blooms = G.blooms;
  const prevFrac = M.xp / xpForLevel(M.level);
  const { prevBest, record } = finishGame(s);
  const done = progressMissions(totals(true));
  M.totalBlooms += blooms;
  const prevChest = M.chest.n;
  const chests = addChestBlooms(blooms);
  const xpGain = s + 50;
  const ups = addXp(xpGain);
  M.saved = null;
  save();
  G = null;
  hint(null);
  if (record && prevBest > 0) sfx.record();
  showResults({ s, prevBest, record, done, chests, ups, prevFrac, xpGain, prevChest });
}

function showResults(r) {
  const near = !r.record && r.prevBest > 0 && r.s >= r.prevBest * 0.7;
  const title = r.record ? (r.prevBest > 0 ? 'שיא חדש!' : 'משחק ראשון!') : near ? 'כמעט!' : 'סוף המשחק';
  const rows = [];
  const lvl = M.level, frac = M.xp / xpForLevel(M.level);
  rows.push(`<div class="reward"><svg><use href="#i-crown"/></svg><div class="grow">רמה ${lvl} <small>${plus(r.xpGain)} ניסיון · עוד ${fmt(xpForLevel(lvl) - M.xp)} לפרח הבא</small><div class="bar"><i data-to="${(frac * 100).toFixed(1)}" style="width:${r.ups.length ? 0 : (r.prevFrac * 100).toFixed(1)}%"></i></div></div></div>`);
  for (const u of r.ups) rows.push(`<div class="reward"><svg><use href="#i-crown"/></svg><div class="grow">עליתם לרמה ${u.level}! <small>פרח חדש פרח בגן שלכם</small></div><b>${plus(u.gems)}</b>${gem}</div>`);
  for (const c of r.chests) rows.push(`<div class="reward"><svg><use href="#i-gift"/></svg><div class="grow">${c.jackpot ? 'ג׳קפוט! ' : ''}פתחתם תיבת מזל</div><b>${plus(c.gems)}</b>${gem}</div>`);
  for (const m of r.done) rows.push(`<div class="reward">${gem}<div class="grow">${m.bonus ? 'כל משימות היום הושלמו!' : `משימה: ${missionText(m)}`}</div><b>${plus(m.reward)}</b>${gem}</div>`);
  if (!r.chests.length) {
    const left = CHEST_GOAL - M.chest.n;
    rows.push(`<div class="reward"><svg><use href="#i-gift"/></svg><div class="grow">תיבת מזל <small>${left <= 8 ? `רק עוד ${left} פריחות!` : `עוד ${left} פריחות`}</small><div class="bar"><i data-to="${(M.chest.n / CHEST_GOAL * 100).toFixed(1)}" style="width:${(r.prevChest / CHEST_GOAL * 100).toFixed(1)}%"></i></div></div></div>`);
  }
  const open = missions().list.filter((m) => !m.done).sort((a, b) => b.progress / b.goal - a.progress / a.goal)[0];
  if (open && !r.done.length) rows.push(`<div class="reward">${gem}<div class="grow">${missionText(open)} <small>${fmt(open.progress)} / ${fmt(open.goal)}</small><div class="bar"><i style="width:${(open.progress / open.goal * 100).toFixed(1)}%"></i></div></div><b>${plus(open.reward)}</b>${gem}</div>`);

  modal(`
    <h2>${title}</h2>
    ${r.record && r.prevBest > 0 ? '<span class="record">שברתם את השיא!</span>' : ''}
    <div class="big-num" data-count="${r.s}">0</div>
    ${near ? `<p class="near">חסרו רק ${fmt(r.prevBest - r.s + 1)} לשיא!</p>` : `<p>שיא: ${fmt(M.best)}</p>`}
    <div class="rewards">${rows.map((x, i) => x.replace('class="reward"', `class="reward" style="animation-delay:${0.25 + i * 0.12}s"`)).join('')}</div>
    <div class="btns">
      <button class="btn go" data-act="again">שחקו שוב</button>
      <button class="btn quiet" data-act="home">לבית</button>
    </div>`, {
    again: () => { closeModal(); startGame(); },
    home: () => { closeModal(); goHome(); },
  });
  const el = $('modal').querySelector('[data-count]');
  const t0 = performance.now(), dur = Math.min(1400, 400 + r.s / 10);
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / dur);
    el.textContent = fmt(r.s * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
    else if (r.record) sfx.gem();
  };
  requestAnimationFrame(step);
  setTimeout(() => $('modal').querySelectorAll('[data-to]').forEach((b) => { b.style.width = `${b.dataset.to}%`; }), 450);
  if (r.ups.length) setTimeout(() => sfx.level(), 900);
  else if (r.done.length || r.chests.length) setTimeout(() => sfx.gem(), 900);
}

function missionToast(m) {
  toast(`${gem} ${m.bonus ? 'כל המשימות הושלמו!' : missionText(m)} · ${plus(m.reward)}`);
  sfx.gem();
}

// ---- modals and toasts -----------------------------------------------------------------------
function modal(html, actions = {}) {
  const box = $('modal');
  box.innerHTML = html;
  $('overlay').hidden = false;
  box.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    unlock();
    sfx.tick();
    actions[b.dataset.act]?.(b);
  };
}
function closeModal() { $('overlay').hidden = true; $('modal').innerHTML = ''; }

function toast(html) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

// ---- screens ---------------------------------------------------------------------------------
function show(name) {
  screen = name;
  $('home').hidden = name !== 'home';
  $('game').hidden = name !== 'game';
  document.body.classList.toggle('neon', !!currentSkin().dark);
  if (name === 'game') requestAnimationFrame(() => R.resize());
}

function startGame() {
  G = freshGame();
  seedGarden(G.board, colorCount(M.games, 0));
  show('game');
  const now = performance.now();
  G.tray = [0, 1, 2].map((i) => { const p = newPiece(); p.t0 = now + 150 + i * 80; return p; });
  G.weedTimer = G.engine.weeds.every;
  updateFits();
  showDebug();
  tutorial();
}

function resumeGame() {
  G = restoreGame(M.saved);
  show('game');
  updateFits();
  tutorial();
  if (!G.tray.some((p) => p && p.fits)) setTimeout(gameOver, 300);
}

function goHome() {
  if (G && !G.busy) saveGame();
  G = null;
  hint(null);
  renderHome();
  show('home');
}

function renderHome() {
  $('h-gems').querySelector('b').textContent = fmt(M.gems);
  $('h-streak').querySelector('b').textContent = M.streak.count;
  $('h-level').textContent = M.level;
  const need = xpForLevel(M.level);
  $('h-xpbar').style.width = `${(M.xp / need * 100).toFixed(1)}%`;
  $('h-xptext').textContent = `עוד ${fmt(need - M.xp)} ניסיון לפרח הבא`;
  $('h-best').textContent = fmt(M.best);
  $('h-play').textContent = M.saved ? 'המשיכו' : 'שחקו';
  $('h-new').hidden = !M.saved;
  const ms = missions();
  $('h-missions').innerHTML = ms.list.map((m) => `
    <li class="${m.done ? 'done' : ''}"><span>${m.done ? '✓ ' : ''}${missionText(m)}</span><span class="rw">${plus(m.reward)}${gem}</span>
    <div class="bar"><i style="width:${(m.progress / m.goal * 100).toFixed(1)}%"></i></div></li>`).join('') +
    `<li class="bonus"><span>${ms.bonus ? '✓ בונוס היום נאסף' : 'השלימו את שלושתן לבונוס'}</span><span class="rw">${plus(40)}${gem}</span></li>`;
  $('h-chestbar').style.width = `${(M.chest.n / CHEST_GOAL * 100).toFixed(1)}%`;
  $('h-chesttext').textContent = `${M.chest.n} / ${CHEST_GOAL} פריחות · מה יש בפנים? רק מזל יודע`;
}

$('h-play').addEventListener('click', () => { unlock(); sfx.tick(); M.saved ? resumeGame() : startGame(); });
$('h-new').addEventListener('click', () => { unlock(); M.saved = null; save(); startGame(); });
$('g-home').addEventListener('click', () => { sfx.tick(); goHome(); });

$('h-skins').addEventListener('click', () => { unlock(); sfx.tick(); openSkins(); });
function openSkins() {
  modal(`
    <h2>סקינים</h2>
    <p>${gem} ${fmt(M.gems)}</p>
    <div class="skins">${SKINS.map((s) => `
      <button class="skin ${M.skin === s.id ? 'on' : ''}" data-act="skin" data-id="${s.id}">
        <canvas data-skin="${s.id}"></canvas>${s.name}
        <small>${M.skins.includes(s.id) ? (M.skin === s.id ? 'בשימוש' : 'בחרו') : `${s.cost} ${gem}`}</small>
      </button>`).join('')}</div>
    <div class="btns"><button class="btn quiet" data-act="close">סגירה</button></div>`, {
    skin: (b) => {
      const id = b.dataset.id;
      if (M.skins.includes(id)) selectSkin(id);
      else if (!buySkin(id)) { const s = SKINS.find((k) => k.id === id); toast(`חסרים עוד ${s.cost - M.gems} ${gem}`); sfx.nope(); return; }
      else sfx.gem();
      document.body.classList.toggle('neon', !!currentSkin().dark);
      renderHome();
      openSkins();
    },
    close: closeModal,
  });
  requestAnimationFrame(() => $('modal').querySelectorAll('[data-skin]').forEach((cv) => previewSkin(cv, SKINS.find((s) => s.id === cv.dataset.skin))));
}

$('h-settings').addEventListener('click', () => {
  unlock(); sfx.tick();
  modal(`
    <h2>הגדרות</h2>
    <label class="toggle">צלילים <input type="checkbox" data-set="sound" ${M.sound ? 'checked' : ''}></label>
    <label class="toggle">רטט <input type="checkbox" data-set="haptics" ${M.haptics ? 'checked' : ''}></label>
    <label class="toggle">מצב מפתחים (מה המנוע חושב) <input type="checkbox" data-set="debug" ${M.debug ? 'checked' : ''}></label>
    <div class="btns"><button class="btn quiet" data-act="close">סגירה</button></div>`, { close: closeModal });
  $('modal').querySelectorAll('[data-set]').forEach((inp) => inp.addEventListener('change', () => {
    M[inp.dataset.set] = inp.checked;
    setSound(M.sound);
    save();
  }));
});

function showDebug() {
  const el = $('debug');
  el.hidden = !M.debug || !G?.engine;
  if (el.hidden) return;
  const t = G.engine, s = t.stats || {};
  el.textContent = `mercy ${t.mercy.toFixed(2)}  fill ${(fillCount(G.board) / (COLS * ROWS) * 100).toFixed(0)}%  weeds every ${t.weeds.every} x${t.weeds.count}\n` +
    t.reasons.map(([k, v]) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} ${k}`).join('\n') +
    `\nlast: ${t.piece.shape} [${t.piece.colors.join(',')}]  blooms ${s.bloom} · best chain ${s.bestChain} · seeds ${s.bestCleared}`;
}

// ---- loop ------------------------------------------------------------------------------------
function frame(now) {
  if (screen === 'game' && G) {
    const v = G.view;
    const maxH = Math.max(...heights(G.board));
    R.draw({
      grid: v.grid, spec: v.spec, skin: currentSkin(), overT: G.overT, tray: G.tray, drag: G.drag && G.drag.moved ? G.drag : null,
      preview: G.drag?.moved && G.drag.valid ? G.drag.preview : null,
      danger: Math.max(0, (maxH - (ROWS - 3)) / 3), weedIn: G.busy ? null : G.weedTimer,
    }, now);
    updateHud();
  } else if (screen === 'home') {
    drawGarden($('garden'), M.garden, M.xp / xpForLevel(M.level), now);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => { if (screen === 'game') R.resize(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.busy) saveGame(); });

// ---- start -----------------------------------------------------------------------------------
renderHome();
show('home');
requestAnimationFrame(frame);
const streak = checkStreak();
if (streak) {
  renderHome();
  const next = Math.min(50, 5 * (streak.count + 1));
  modal(`
    <svg style="font-size:64px"><use href="#i-fire"/></svg>
    <h2>${streak.count === 1 ? (M.games ? 'ברוכים השבים!' : 'ברוכים הבאים!') : `${streak.count} ימים ברצף!`}</h2>
    ${streak.usedFreeze ? '<p>פספסתם יום, אבל הקפאת הרצף שמרה עליו</p>' : ''}
    <div class="big-num">${plus(streak.gems)} ${gem}</div>
    <p>חזרו מחר וקבלו ${plus(next)}</p>
    <div class="btns"><button class="btn go" data-act="ok">יאללה!</button></div>`, { ok: () => { closeModal(); renderHome(); sfx.gem(); } });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// For tests: a handle on the running game.
window.__bloom = { get game() { return G; }, meta: M, layout: R.layout, dropAt: (...a) => dropAt(...a), startGame, WEED };
