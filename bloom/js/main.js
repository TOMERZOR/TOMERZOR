import { N, emptyGrid, fits, place, anyFit, linesWith, fillCount } from './board.js';
import { SHAPE_BY_ID } from './pieces.js';
import { makeTray } from './engine.js';
import { scoreMove } from './rules.js';
import { createRenderer, previewSkin } from './render.js';
import { drawGarden } from './garden.js';
import { sfx, unlock, setSound } from './audio.js';
import {
  meta, save, SKINS, currentSkin, buySkin, selectSkin, checkStreak, missions, missionText, progressMissions,
  addChestLines, CHEST_LINES, addXp, xpForLevel, finishGame,
} from './meta.js';

const $ = (id) => document.getElementById(id);
const M = meta();
setSound(M.sound);
const fmt = (n) => Math.round(n).toLocaleString('he-IL');
const gem = '<svg><use href="#i-gem"/></svg>';
const plus = (n) => `<bdi dir="ltr">+${typeof n === 'number' ? fmt(n) : n}</bdi>`;
const vibrate = (p) => { if (M.haptics && navigator.vibrate) navigator.vibrate(p); };

const canvas = $('board');
const R = createRenderer(canvas);
let G = null; // the game in progress
let screen = 'home';

// ---- game state ------------------------------------------------------------------------------
function freshGame() {
  return {
    grid: emptyGrid(), tray: [null, null, null], score: 0, shown: 0, combo: 0, movesSinceClear: 0,
    placements: 0, trayIndex: 0, lines: 0, maxCombo: 0, maxLines: 0, chanceUsed: false, recordShown: false,
    over: false, overT: 0, drag: null, think: [], lastAction: performance.now(), engine: null,
  };
}

function saveGame() {
  if (!G) return;
  M.saved = {
    grid: [...G.grid], tray: G.tray.map((p) => p && { id: p.shape.id, ci: p.ci }), score: G.score, combo: G.combo,
    movesSinceClear: G.movesSinceClear, placements: G.placements, trayIndex: G.trayIndex, lines: G.lines,
    maxCombo: G.maxCombo, maxLines: G.maxLines, chanceUsed: G.chanceUsed, recordShown: G.recordShown,
  };
  save();
}

function restoreGame(s) {
  const g = freshGame();
  Object.assign(g, { ...s, grid: Uint8Array.from(s.grid), shown: s.score });
  g.tray = s.tray.map((p) => p && SHAPE_BY_ID.get(p.id) ? { shape: SHAPE_BY_ID.get(p.id), ci: p.ci, t0: performance.now() } : null);
  return g;
}

function engineCtx(extra = {}) {
  const think = G.think.length ? G.think.reduce((a, b) => a + b, 0) / G.think.length : 0;
  return {
    grid: G.grid, score: G.score, best: M.best, gamesPlayed: M.games, placements: G.placements,
    movesSinceClear: G.movesSinceClear, combo: G.combo, thinkMs: think, recentScores: M.recent, trayIndex: G.trayIndex, ...extra,
  };
}

function dealTray(rescue = false) {
  const t = makeTray(engineCtx({ rescue }));
  G.engine = t;
  const colors = [1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5);
  const now = performance.now();
  G.tray = t.pieces.map((shape, i) => ({ shape, ci: colors[i], t0: now + i * 70 }));
  G.trayIndex++;
  G.lastAction = now;
  updateFits();
  saveGame();
  showDebug();
  if (!G.tray.some((p) => p.fits)) gameOver();
}

function updateFits() { for (const p of G.tray) if (p) p.fits = anyFit(G.grid, p.shape); }

// ---- input -----------------------------------------------------------------------------------
function pos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function dragTo(d, x, y) {
  const L = R.layout, cell = L.cell;
  const w = d.shape.w * cell, h = d.shape.h * cell;
  d.x = x - w / 2;
  d.y = d.touch ? y - h - cell * 1.1 : y - h / 2;
  const c = Math.round((d.x - L.boardX) / cell), r = Math.round((d.y - L.boardY) / cell);
  d.valid = fits(G.grid, d.shape, r, c);
  d.r = r; d.c = c;
  d.lines = d.valid ? linesWith(G.grid, d.shape, r, c) : null;
  if (d.lines && !d.lines.rows.length && !d.lines.cols.length) d.lines = null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!G || G.over || G.drag || !$('overlay').hidden) return;
  unlock();
  const p = pos(e);
  const i = R.layout.slots.findIndex((s, k) => G.tray[k] && Math.abs(p.x - s.x) < s.w / 2 && Math.abs(p.y - s.y) < s.h / 2 + 10);
  if (i < 0) return;
  const piece = G.tray[i];
  G.drag = { slot: i, shape: piece.shape, ci: piece.ci, touch: e.pointerType !== 'mouse', id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
  dragTo(G.drag, p.x, p.y);
  sfx.pick();
  vibrate(5);
});

canvas.addEventListener('pointermove', (e) => {
  const d = G?.drag;
  if (!d || d.id !== e.pointerId) return;
  const p = pos(e);
  const was = d.valid && `${d.r},${d.c}`;
  dragTo(d, p.x, p.y);
  if (d.valid && `${d.r},${d.c}` !== was) vibrate(2);
});

function endDrag(e) {
  const d = G?.drag;
  if (!d || d.id !== e.pointerId) return;
  G.drag = null;
  if (d.valid) placeAt(d.slot, d.r, d.c);
  else {
    G.tray[d.slot].t0 = performance.now() - 220;
    const p = pos(e);
    if (p.y < R.layout.boardY + R.layout.size) sfx.nope();
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---- placing and scoring ---------------------------------------------------------------------
const PRAISE = ['יפה!', 'מעולה!', 'מדהים!', 'וואו!', 'פנומנלי!', 'בלתי נתפס!'];

function placeAt(slot, r, c) {
  const now = performance.now();
  const p = G.tray[slot];
  const skin = currentSkin();
  const res = place(G.grid, p.shape, r, c, p.ci);
  G.grid = res.grid;
  G.tray[slot] = null;
  G.think = [...G.think, now - G.lastAction].slice(-3);
  G.lastAction = now;
  const allClear = res.lines > 0 && fillCount(G.grid) === 0;
  const st = scoreMove(G, p.shape.n, res.lines, allClear);
  G.combo = st.combo; G.movesSinceClear = st.movesSinceClear;
  G.score += st.points;
  G.placements++;
  G.lines += res.lines;
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.maxLines = Math.max(G.maxLines, res.lines);

  const clearedSet = new Set(res.cleared.map((q) => q.r * N + q.c));
  R.pop(p.shape.cells.map(([dr, dc]) => [r + dr, c + dc]).filter(([y, x]) => !clearedSet.has(y * N + x)), now);
  const [cx, cy] = R.cellCenter(r + (p.shape.h - 1) / 2, c + (p.shape.w - 1) / 2);
  bumpScore();

  if (res.lines) {
    const power = res.lines + G.combo * 0.5;
    R.burst(res.cleared, skin.colors, now, power);
    R.setShake(3 + res.lines * 3 + Math.min(6, G.combo), now);
    R.float(`+${fmt(st.points)}`, cx, cy, now, { color: G.combo >= 3 ? '#ffd23d' : '#fff', size: 1 + Math.min(0.8, res.lines * 0.15 + G.combo * 0.06) });
    sfx.clear(res.lines, G.combo);
    if (res.lines >= 3 || G.combo >= 4) sfx.big();
    vibrate(res.lines >= 2 ? [20, 40, 30] : 18);
    if (allClear) {
      R.setBanner('לוח נקי!', `+${fmt(2000)}`, now, '#7dffb0');
      R.setFlash('#ffffff', now);
      sfx.allClear();
    } else if (res.lines >= 2 || G.combo >= 2) {
      const k = Math.min(PRAISE.length - 1, res.lines - 1 + Math.floor(G.combo / 2));
      R.setBanner(PRAISE[k], G.combo >= 2 ? `קומבו x${G.combo}` : '', now, ['#ffd23d', '#ff9ad5', '#7de3ff', '#b6ff6d'][k % 4]);
    }
  } else {
    sfx.place(p.shape.n);
    vibrate(8);
  }

  if (M.best > 0 && !G.recordShown && G.score > M.best) {
    G.recordShown = true;
    setTimeout(() => { const t = performance.now(); R.setBanner('שיא חדש!', '', t, '#ffd23d'); R.setFlash('#ffd23d', t); sfx.record(); vibrate([30, 50, 30, 50, 60]); }, res.lines ? 700 : 0);
  }

  for (const m of progressMissions(totals(false))) missionToast(m);

  if (G.tray.every((q) => !q)) setTimeout(() => { if (G && !G.over) dealTray(); }, 140);
  else {
    updateFits();
    saveGame();
    if (!G.tray.some((q) => q && q.fits)) gameOver();
  }
  showDebug();
}

const totals = (finished) => ({ lines: G.lines, placements: G.placements, score: G.score, maxCombo: G.maxCombo, maxLines: G.maxLines, finished });

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
  else if (G.combo >= 2) text = `קומבו x${G.combo}`;
  if (chase.textContent !== text) chase.textContent = text;
  chase.classList.toggle('hot', hot);
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
    <h2>אין מקום!</h2>
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
  if (fillCount(G.grid) > N * N * 0.5) {
    // Blast the most crowded 3x3 corner of the board first, so the rescue pieces have room.
    let best = null;
    for (let r = 0; r <= N - 3; r++) for (let c = 0; c <= N - 3; c++) {
      let n = 0;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (G.grid[(r + y) * N + c + x]) n++;
      if (!best || n > best.n) best = { r, c, n };
    }
    const cleared = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const i = (best.r + y) * N + best.c + x;
      if (G.grid[i]) { cleared.push({ r: best.r + y, c: best.c + x, color: G.grid[i] }); G.grid[i] = 0; }
    }
    R.burst(cleared, currentSkin().colors, now, 3);
    R.setShake(12, now);
    sfx.big();
  }
  R.setBanner('ממשיכים!', '', now, '#7dffb0');
  dealTray(true);
}

function finish() {
  const s = G.score, lines = G.lines;
  const prevLevel = M.level;
  const prevFrac = M.xp / xpForLevel(M.level);
  const { prevBest, record } = finishGame(s);
  const done = progressMissions(totals(true));
  M.totalLines += lines;
  const prevChest = M.chest.lines;
  const chests = addChestLines(lines);
  const xpGain = s + 50;
  const ups = addXp(xpGain);
  M.saved = null;
  save();
  G = null;
  if (record && prevBest > 0) sfx.record();
  showResults({ s, prevBest, record, done, chests, ups, prevLevel, prevFrac, xpGain, lines, prevChest });
}

function showResults(r) {
  const near = !r.record && r.prevBest > 0 && r.s >= r.prevBest * 0.7;
  const title = r.record ? (r.prevBest > 0 ? 'שיא חדש!' : 'משחק ראשון!') : near ? 'כמעט!' : 'סוף המשחק';
  const rows = [];
  // XP bar (animated from where it was)
  const lvl = M.level, frac = M.xp / xpForLevel(M.level);
  rows.push(`<div class="reward"><svg><use href="#i-crown"/></svg><div class="grow">רמה ${lvl} <small>${plus(r.xpGain)} ניסיון · עוד ${fmt(xpForLevel(lvl) - M.xp)} לפרח הבא</small><div class="bar"><i data-to="${(frac * 100).toFixed(1)}" style="width:${r.ups.length ? 0 : (r.prevFrac * 100).toFixed(1)}%"></i></div></div></div>`);
  for (const u of r.ups) rows.push(`<div class="reward"><svg><use href="#i-crown"/></svg><div class="grow">עליתם לרמה ${u.level}! <small>פרח חדש פרח בגן שלכם</small></div><b>${plus(u.gems)}</b>${gem}</div>`);
  for (const c of r.chests) rows.push(`<div class="reward"><svg><use href="#i-gift"/></svg><div class="grow">${c.jackpot ? 'ג׳קפוט! ' : ''}פתחתם תיבת מזל</div><b>${plus(c.gems)}</b>${gem}</div>`);
  for (const m of r.done) rows.push(`<div class="reward">${gem}<div class="grow">${m.bonus ? 'כל משימות היום הושלמו!' : `משימה: ${missionText(m)}`}</div><b>${plus(m.reward)}</b>${gem}</div>`);
  if (!r.chests.length) {
    const left = CHEST_LINES - M.chest.lines;
    rows.push(`<div class="reward"><svg><use href="#i-gift"/></svg><div class="grow">תיבת מזל <small>${left <= 10 ? `רק עוד ${left} שורות!` : `עוד ${left} שורות`}</small><div class="bar"><i data-to="${(M.chest.lines / CHEST_LINES * 100).toFixed(1)}" style="width:${(r.prevChest / CHEST_LINES * 100).toFixed(1)}%"></i></div></div></div>`);
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
  // count the score up, then fill the bars
  const el = $('modal').querySelector('[data-count]');
  const t0 = performance.now(), dur = Math.min(1400, 400 + r.s / 10);
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / dur);
    el.textContent = fmt(r.s * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
    else if (r.record) { sfx.gem(); }
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
  show('game');
  requestAnimationFrame(() => dealTray());
}

function resumeGame() {
  G = restoreGame(M.saved);
  show('game');
  updateFits();
  if (!G.tray.some((p) => p)) requestAnimationFrame(() => dealTray());
  else if (!G.tray.some((p) => p && p.fits)) { G.over = false; setTimeout(gameOver, 300); }
}

function goHome() {
  if (G) saveGame();
  G = null;
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
  $('h-chestbar').style.width = `${(M.chest.lines / CHEST_LINES * 100).toFixed(1)}%`;
  $('h-chesttext').textContent = `${M.chest.lines} / ${CHEST_LINES} שורות · מה יש בפנים? רק מזל יודע`;
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
  const t = G.engine;
  const s = t.stats || {};
  el.textContent = `mercy ${t.mercy.toFixed(2)}  fill ${(fillCount(G.grid) / 64 * 100).toFixed(0)}%\n` +
    t.reasons.map(([k, v]) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} ${k}`).join('\n') +
    `\ntray: ${t.pieces.map((p) => p.family).join(' ')}\nsolvable ${s.solvable} · clears now ${s.now} · best lines ${s.lines}${s.allClear ? ' · ALL CLEAR' : ''}`;
}

// ---- loop ------------------------------------------------------------------------------------
function frame(now) {
  if (screen === 'game' && G) {
    const skin = currentSkin();
    const d = G.drag;
    R.draw({
      grid: G.grid, skin, overT: G.overT,
      tray: G.tray.map((p) => p && { ...p, color: skin.colors[p.ci - 1] }),
      drag: d && { ...d, color: skin.colors[d.ci - 1] },
    }, now);
    updateHud();
  } else if (screen === 'home') {
    drawGarden($('garden'), M.garden, M.xp / xpForLevel(M.level), now);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => { if (screen === 'game') R.resize(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G) saveGame(); });

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
window.__bloom = { get game() { return G; }, meta: M, layout: R.layout, placeAt: (...a) => placeAt(...a), startGame };
