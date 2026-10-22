// App shell: boot, screens, progression, economy and monetization flows.
import * as Save from './save.js';
import { Game } from './game.js';
import { sfx, unlock as unlockAudio, setSfx, setMusic, suspend, resume } from './audio.js';
import { Ads, IAP, PRODUCTS, initPlatform, track, haptic, isNative } from './platform.js';
import { t, setLang, detectLang, artName, albumName, LANGS, getLang } from './i18n.js';
import { LEVEL_DATA } from './levels-data.js';
import { decodeLevel, levelSpec, makeLevel } from './levels.js';
import { ART, ALBUMS, PALETTE, artToGrid } from './art.js';
import { buildLevel, hashStr } from './levelgen.js';
import { drawBucket, artThumb, mix, laneSlotPos, slotPos } from './render.js';
import { bestMove } from './bot.js';

const VERSION = '1.0.0';
const $ = (s, el = document) => el.querySelector(s);
const LIVES_FROM = 10;
const BOOSTER_UNLOCK = { slot: 7, grab: 12, rainbow: 18 };
const BOOSTER_PRICE = { slot: 150, grab: 200, rainbow: 250 };
const REVIVE_PRICE = 300;
const REFILL_PRICE = 500;
const START_ASSIST = 2; // free waiting spots on a retry after two fails in a row

let S; // save
let game;
let cur = null; // { level, daily, revivedAd, revived, extra }
let failsInRow = 0;

// ------------------------------------------------------------------ helpers
function safeInsets() {
  const p = $('#safeProbe');
  const cs = getComputedStyle(p);
  return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
}
function fmtTime(ms) { const s = Math.ceil(ms / 1000); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }
function fmtLong(ms) { const m = Math.max(0, Math.floor(ms / 60000)); const h = Math.floor(m / 60); return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : fmtTime(ms); }
function fmtNum(n) { return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(n); }
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
const bucketCache = new Map();
function bucketImg(col, n = '', size = 64, opts = {}) {
  const key = col + n + size + JSON.stringify(opts);
  if (bucketCache.has(key)) return bucketCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size * 2;
  const ctx = c.getContext('2d'); ctx.scale(2, 2);
  drawBucket(ctx, size / 2, size / 2 + size * 0.04, size * 0.92, col, n, opts);
  const url = c.toDataURL();
  bucketCache.set(key, url);
  return url;
}
const COIN = '<span class="coin-ico"></span>';
const HEART = '<span class="heart-ico"></span>';

function toast(msg, ms = 1600) {
  const tEl = $('#toast');
  tEl.textContent = msg; tEl.classList.add('show');
  clearTimeout(toast.tm); toast.tm = setTimeout(() => tEl.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ levels
const levelCache = new Map();
function getLevel(i) {
  if (levelCache.has(i)) return levelCache.get(i);
  let lv;
  if (i <= LEVEL_DATA.length) lv = decodeLevel(LEVEL_DATA[i - 1], PALETTE);
  else lv = makeLevel(levelSpec(i), { candidates: 2, games: 6 });
  lv.level = i;
  levelCache.set(i, lv);
  return lv;
}
function rewardFor(lv) { return lv.daily ? 100 : lv.tag === 'super' ? 60 : lv.tag === 'hard' ? 40 : 20; }

function dailyLevel(day) {
  const h = hashStr('daily:' + day);
  const art = ART[h % ART.length];
  const spec = { i: 40 + (h % 30), tag: 'normal', art: art.id, seed: h, lanes: 3, slots: 5, beltCap: 5, noise: 1.6, scale: 2, bg: ['c', 'w', 'l', 'p', 't'][h % 5], hidden: 0.15, coat: h % 3 === 0 ? 0.12 : 0, twins: h % 2, target: 0.6 };
  const lv = makeLevel(spec, { candidates: 2, games: 6 });
  lv.daily = true; lv.level = 0; lv.name = art.name;
  return lv;
}

// ------------------------------------------------------------------ HUD
function showHud(on) { $('#hud').hidden = !on; $('#boosters').hidden = !on; }
function updateHud() {
  if (!cur) return;
  const lv = cur.level;
  $('#hudLevel').textContent = lv.daily ? t('daily') : `${t('level')} ${lv.level}`;
  const tag = $('#hudTag');
  tag.hidden = !(lv.tag === 'hard' || lv.tag === 'super');
  tag.textContent = lv.tag === 'super' ? t('super') : t('hard');
  tag.className = 'tag ' + (lv.tag === 'super' ? 'tag--super' : 'tag--hard');
  $('#hudCoins').innerHTML = COIN + fmtNum(S.coins);
  updateBoosters();
}
function setProgress(p) { $('#hudProg').style.width = (p * 100).toFixed(1) + '%'; }

function updateBoosters() {
  const lvN = cur && cur.level.daily ? 999 : (cur ? cur.level.level : S.level);
  for (const b of ['slot', 'grab', 'rainbow']) {
    const btn = $(`[data-booster="${b}"]`);
    const locked = lvN < BOOSTER_UNLOCK[b];
    btn.classList.toggle('locked', locked);
    btn.classList.toggle('active', b === 'grab' && game && game.grab);
    btn.querySelector('.bcount').textContent = locked ? `${t('lv')} ${BOOSTER_UNLOCK[b]}` : S.boosters[b] > 0 ? S.boosters[b] : '+';
    btn.querySelector('.bcount').classList.toggle('buy', !locked && S.boosters[b] <= 0);
  }
}

// ------------------------------------------------------------------ play flow
function canPlay(lvN) {
  if (lvN < LIVES_FROM) return true;
  Save.tickLives();
  return S.lives > 0 || Save.hasUnlimited();
}

function startLevel(lv, opts = {}) {
  hideAllScreens();
  closeModal();
  cur = { level: lv, revivedAd: false, revived: false, boostersUsed: 0 };
  let extra = opts.extra || 0;
  if (!lv.daily && failsInRow >= 2) extra += START_ASSIST - 1;
  if (!lv.daily && S.streak >= 3) { extra += 1; setTimeout(() => toast('🔥 ' + t('hotStreak') + ' ' + t('hotStreakD'), 2200), 400); }
  const tutorial = !lv.daily && lv.level === 1 ? { pointLane: 0, hint: true } : !lv.daily && lv.level <= 3 ? { hint: true } : null;
  showHud(true);
  updateHud();
  setProgress(0);
  game.start(lv, { extraSlots: extra, tutorial });
  S.stats.played++;
  Save.save();
  track('level_start', { level: lv.level, daily: !!lv.daily, tag: lv.tag });
  levelTips(lv);
  if (!lv.daily) maybeBoosterUnlock(lv.level);
}

const TIP_AT = { 1: 'tipPaints', 9: 'tipMystery', 15: 'tipCoat', 22: 'tipTwins' };
function levelTips(lv) {
  if (lv.daily) return;
  const key = TIP_AT[lv.level];
  if (lv.level === 1) { tip(t('tapBucket'), 'bottom', 0); return; }
  if (key && !S.seen[key]) {
    // only show the tip if the mechanic is actually in this level
    const has = key === 'tipMystery' ? lv.lanes.some((l) => l.some((s) => s.hidden))
      : key === 'tipCoat' ? !!lv.coats : key === 'tipTwins' ? lv.lanes.some((l) => l.some((s) => s.twin)) : true;
    if (has) { S.seen[key] = 1; Save.save(); setTimeout(() => tip(t(key), 'top', 4200), 600); }
  }
}

let tipTimer = 0;
function tip(text, where = 'top', ms = 3500) {
  const tp = $('#tip');
  tp.textContent = text;
  tp.className = 'tip show tip--' + where;
  clearTimeout(tipTimer);
  if (ms) tipTimer = setTimeout(() => tp.classList.remove('show'), ms);
}
function hideTip() { $('#tip').classList.remove('show'); }

function onGameEvent(e) {
  if (e.type === 'launch') {
    if (cur && cur.level.level === 1 && !cur.tippedPaint) { cur.tippedPaint = true; tip(t('tipPaints'), 'top', 3800); }
  } else if (e.type === 'park') {
    if (!S.seen.tipSpots) { S.seen.tipSpots = 1; Save.save(); tip(t('tipSpots'), 'mid', 4200); }
    else if (e.free <= 1 && !S.seen.tipFull) { S.seen.tipFull = 1; Save.save(); tip(t('tipFull'), 'mid', 4200); }
  } else if (e.type === 'blocked') {
    if (e.why === 'twin') toast(t('twinWait'));
  } else if (e.type === 'grabUsed') {
    S.boosters.grab = Math.max(0, S.boosters.grab - 1); Save.save(); hideTip(); updateBoosters();
    track('booster_use', { b: 'grab' });
  }
}

function onWin(st) {
  const lv = cur.level;
  failsInRow = 0;
  const reward = rewardFor(lv);
  S.stats.wins++;
  S.stats.splats += st.total;
  S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
  const firstTime = !S.gallery[lv.art];
  if (firstTime) S.gallery[lv.art] = Date.now();
  if (lv.daily) {
    const day = Save.today();
    const y = Save.today(new Date(Date.now() - 86400000));
    S.daily.days = S.daily.last === y ? S.daily.days + 1 : S.daily.last === day ? S.daily.days : 1;
    S.daily.last = day; S.daily.done[day] = 1;
    track('daily_complete', { days: S.daily.days });
  } else {
    S.level = Math.max(S.level, lv.level + 1);
  }
  Save.save();
  showHud(false);
  hideTip();
  const bonus = lv.daily ? Math.min(100, (S.daily.days - 1) * 20) : 0;
  const total = reward + bonus;
  const thumb = artThumb(lv, 180, true).toDataURL();
  const name = artName(lv.art, lv.name);
  const m = openModal(`
    <div class="card card--win">
      <div class="ribbon">${t('winTitle')}</div>
      <div class="win-art"><img src="${thumb}" alt=""><div class="win-shine"></div></div>
      <div class="win-name">${name}</div>
      <div class="win-sub">${firstTime ? t('winSub') : ''}</div>
      <div class="win-reward">${COIN}<b>+${total}</b>${bonus ? `<small>${t('streakBonus')} +${bonus}</small>` : ''}</div>
      <button class="btn btn--purple btn--big" data-act="x2"><span class="ad-ico"></span>${t('x2')}</button>
      <button class="btn btn--green btn--big" data-act="claim">${t('claim')}</button>
    </div>`, { noClose: true });
  m.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    sfx.tap();
    if (b.dataset.act === 'x2') {
      b.disabled = true;
      const ok = await Ads.rewarded('win_x2');
      if (ok) { finishWin(total * 2, true); } else b.disabled = false;
    } else finishWin(total, false);
  });
}

async function finishWin(coins, fromAd) {
  const lv = cur.level;
  flyCoins(coins);
  Save.addCoins(coins); Save.save();
  await wait(900);
  closeModal();
  const album = ALBUMS.find((a) => a.id === lv.album);
  const done = album && ART.filter((x) => x.album === album.id).every((x) => S.gallery[x.id]);
  if (!fromAd && !cur.revived && !lv.daily) await Ads.interstitial('level_end', lv.level);
  cur = null;
  goHome();
  if (album && done && !S.albumsClaimed[album.id]) setTimeout(() => albumChest(album), 400);
  else if (lv.level === 8 && !S.starterBought && !S.starterSeenAt) setTimeout(starterOffer, 500);
  else if (lv.level === 20 || lv.level === 45) setTimeout(() => window.dispatchEvent(new CustomEvent('pp:review')), 500);
}

function onFail() {
  const lv = cur.level;
  showHud(false);
  hideTip();
  track('level_fail', { level: lv.level, progress: Math.round(game.st ? (1 - game.st.left / game.st.total) * 100 : 0) });
  const pct = Math.round((1 - game.st.left / game.st.total) * 100);
  const m = openModal(`
    <div class="card card--fail">
      <div class="ribbon ribbon--red">${t('failTitle')}</div>
      <div class="fail-prog"><div class="ring" style="--p:${pct}"><span>${pct}%</span></div></div>
      <p class="muted">${t('failSub')}</p>
      ${cur.revivedAd ? '' : `<button class="btn btn--purple btn--big" data-act="ad"><span class="ad-ico"></span>${t('revive')} · ${t('reviveAd')}</button>`}
      <button class="btn btn--green btn--big" data-act="coins">${t('revive')} · ${COIN}${REVIVE_PRICE}</button>
      <button class="btn btn--link" data-act="quit">${t('giveUp')}</button>
    </div>`, { noClose: true });
  m.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    sfx.tap();
    if (b.dataset.act === 'ad') {
      b.disabled = true;
      const ok = await Ads.rewarded('revive');
      if (ok) { cur.revivedAd = true; doRevive(); } else b.disabled = false;
    } else if (b.dataset.act === 'coins') {
      if (Save.spend(REVIVE_PRICE)) { Save.save(); doRevive(); }
      else { toast(t('needCoins')); openShop(); }
    } else confirmQuit();
  });
}

function doRevive() {
  closeModal();
  cur.revived = true;
  S.stats.revives++; Save.save();
  track('revive', { level: cur.level.level });
  game.doRevive();
  showHud(true); updateHud();
}

function confirmQuit() {
  const lv = cur.level;
  const livesOn = !lv.daily && lv.level >= LIVES_FROM && !Save.hasUnlimited();
  if (!livesOn) { endFail(); return; }
  const m = openModal(`
    <div class="card">
      <h2>${t('keepGoing')}</h2>
      <div class="big-heart">${HEART}<b>-1</b></div>
      <p class="muted">${t('loseLife')}</p>
      <button class="btn btn--green btn--big" data-act="back">${t('keepGoing')}</button>
      <button class="btn btn--link" data-act="quit">${t('giveUp')}</button>
    </div>`, { noClose: true });
  m.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    sfx.tap();
    if (b.dataset.act === 'back') { closeModal(); onFail(); } else endFail();
  });
}

function endFail() {
  const lv = cur.level;
  S.stats.fails++;
  S.streak = 0;
  failsInRow++;
  if (!lv.daily && lv.level >= LIVES_FROM) Save.loseLife();
  Save.save();
  closeModal();
  const again = lv;
  cur = null;
  if (again.daily || canPlay(again.level)) {
    // straight back in: retrying is the fastest way to fun
    const m = openModal(`
      <div class="card">
        <h2>${again.daily ? t('daily') : t('level') + ' ' + again.level}</h2>
        ${failsInRow >= 2 && !again.daily ? `<p class="assist">🎁 ${t('bSlotD')}</p>` : ''}
        <button class="btn btn--green btn--big" data-act="retry">${t('retry')}</button>
        <button class="btn btn--link" data-act="home">${t('home')}</button>
      </div>`, { noClose: true });
    m.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]'); if (!b) return;
      sfx.tap();
      if (b.dataset.act === 'retry') startLevel(again);
      else { closeModal(); goHome(); }
    });
  } else { goHome(); outOfLives(); }
}

// ------------------------------------------------------------------ boosters
function onBooster(b) {
  if (!cur || !game.st || game.st.status !== 'play') return;
  const lvN = cur.level.daily ? 999 : cur.level.level;
  if (lvN < BOOSTER_UNLOCK[b]) { toast(`${t('locked')} · ${t('lv')} ${BOOSTER_UNLOCK[b]}`); sfx.blocked(); return; }
  if (b === 'grab' && game.grab) { game.setGrab(false); hideTip(); updateBoosters(); return; }
  if (S.boosters[b] <= 0) { buyBooster(b); return; }
  sfx.tap();
  if (b === 'slot') { S.boosters.slot--; game.useSlot(); toast('+1 🪣'); }
  else if (b === 'rainbow') { S.boosters.rainbow--; game.useRainbow(); }
  else if (b === 'grab') { game.setGrab(true); tip(t('grabTap'), 'mid', 0); }
  if (b !== 'grab') track('booster_use', { b });
  cur.boostersUsed++;
  Save.save(); updateBoosters();
}

function buyBooster(b) {
  game.paused = true;
  const name = { slot: t('bSlot'), grab: t('bGrab'), rainbow: t('bRainbow') }[b];
  const desc = { slot: t('bSlotD'), grab: t('bGrabD'), rainbow: t('bRainbowD') }[b];
  const m = openModal(`
    <div class="card">
      <h2>${name}</h2>
      <div class="booster-big booster-ico--${b}"></div>
      <p class="muted">${desc}</p>
      <button class="btn btn--green btn--big" data-act="buy">${t('buy')} · ${COIN}${BOOSTER_PRICE[b]}</button>
      <button class="btn btn--link" data-act="no">${t('cancel')}</button>
    </div>`, { onClose: () => { game.paused = false; } });
  m.addEventListener('click', (ev) => {
    const x = ev.target.closest('[data-act]'); if (!x) return;
    sfx.tap();
    if (x.dataset.act === 'buy') {
      if (Save.spend(BOOSTER_PRICE[b])) { S.boosters[b]++; Save.save(); closeModal(); game.paused = false; updateHud(); onBooster(b); }
      else { closeModal(); openShop(); }
    } else { closeModal(); game.paused = false; }
  });
}

function maybeBoosterUnlock(lvN) {
  const b = Object.keys(BOOSTER_UNLOCK).find((k) => BOOSTER_UNLOCK[k] === lvN);
  if (!b || S.seen['unlock_' + b]) return;
  S.seen['unlock_' + b] = 1; S.boosters[b] += 2; Save.save();
  game.paused = true;
  sfx.unlock();
  const name = { slot: t('bSlot'), grab: t('bGrab'), rainbow: t('bRainbow') }[b];
  const desc = { slot: t('bSlotD'), grab: t('bGrabD'), rainbow: t('bRainbowD') }[b];
  const m = openModal(`
    <div class="card">
      <div class="ribbon">${t('unlocked')}</div>
      <div class="booster-big booster-ico--${b}"><span class="badge">x2</span></div>
      <h2>${name}</h2>
      <p class="muted">${desc}</p>
      <button class="btn btn--green btn--big" data-act="ok">${t('gotIt')}</button>
    </div>`, { noClose: true });
  m.addEventListener('click', (ev) => { if (!ev.target.closest('[data-act]')) return; sfx.tap(); closeModal(); game.paused = false; updateBoosters(); });
}

// ------------------------------------------------------------------ pause
function openPause() {
  if (!cur) return;
  game.paused = true;
  const lv = cur.level;
  const livesOn = !lv.daily && lv.level >= LIVES_FROM && !Save.hasUnlimited() && game.st.stats.launches > 0;
  const m = openModal(`
    <div class="card">
      <h2>${t('paused')}</h2>
      ${settingsToggles()}
      <button class="btn btn--green btn--big" data-act="resume">${t('resume')}</button>
      <div class="row">
        <button class="btn btn--ghost" data-act="restart">${t('restart')}${livesOn ? ` <small>${HEART}-1</small>` : ''}</button>
        <button class="btn btn--ghost" data-act="home">${t('home')}${livesOn ? ` <small>${HEART}-1</small>` : ''}</button>
      </div>
    </div>`, { onClose: () => { game.paused = false; } });
  bindToggles(m);
  m.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    sfx.tap();
    const a = b.dataset.act;
    if (a === 'resume') { closeModal(); game.paused = false; }
    else {
      if (livesOn) { Save.loseLife(); S.streak = 0; Save.save(); }
      const again = cur.level;
      closeModal(); cur = null; game.stop(); showHud(false); hideTip();
      if (a === 'restart' && (again.daily || canPlay(again.level))) startLevel(again);
      else { goHome(); if (a === 'restart') outOfLives(); }
    }
  });
}

function settingsToggles() {
  const s = S.settings;
  const tg = (k, label) => `<label class="toggle"><span>${label}</span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><i></i></label>`;
  return `<div class="toggles">${tg('sound', t('sound'))}${tg('music', t('music'))}${tg('haptics', t('haptics'))}</div>`;
}
function bindToggles(root) {
  root.querySelectorAll('[data-set]').forEach((inp) => inp.addEventListener('change', () => {
    S.settings[inp.dataset.set] = inp.checked; Save.save(); applySettings(); sfx.tap();
  }));
}
function applySettings() { setSfx(S.settings.sound); setMusic(S.settings.music); }

// ------------------------------------------------------------------ modal
function openModal(html, opts = {}) {
  const md = $('#modal');
  md.innerHTML = '';
  const node = el(html);
  md.appendChild(node);
  md.hidden = false;
  md.classList.remove('out');
  md.onclick = (e) => { if (e.target === md && !opts.noClose) { closeModal(); opts.onClose && opts.onClose(); } };
  md._onClose = opts.onClose || null;
  requestAnimationFrame(() => md.classList.add('in'));
  return node;
}
function closeModal() { const md = $('#modal'); md.hidden = true; md.classList.remove('in'); md.innerHTML = ''; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function flyCoins(n) {
  const target = $('#homeCoins') || $('#hudCoins');
  const k = Math.min(12, 4 + Math.floor(n / 20));
  for (let i = 0; i < k; i++) {
    const c = document.createElement('div');
    c.className = 'fly-coin';
    c.style.left = (window.innerWidth / 2 + (Math.random() - 0.5) * 80) + 'px';
    c.style.top = (window.innerHeight / 2 + (Math.random() - 0.5) * 60) + 'px';
    document.body.appendChild(c);
    const r = target ? target.getBoundingClientRect() : { left: window.innerWidth - 60, top: 20 };
    setTimeout(() => { c.style.transform = `translate(${r.left + 10 - parseFloat(c.style.left)}px, ${r.top + 6 - parseFloat(c.style.top)}px) scale(0.6)`; c.style.opacity = '0.9'; }, 30 + i * 45);
    setTimeout(() => { c.remove(); sfx.coin(i); }, 650 + i * 45);
  }
}

// ------------------------------------------------------------------ screens
function hideAllScreens() { document.querySelectorAll('.screen').forEach((s) => { s.hidden = true; }); }

function goHome() {
  game.stop();
  showHud(false);
  hideAllScreens();
  renderHome();
  $('#home').hidden = false;
}

function renderHome() {
  Save.tickLives();
  const lvN = S.level;
  const lv = getLevel(lvN);
  const preview = artThumb(lv, 200, false).toDataURL();
  const livesOn = lvN >= LIVES_FROM;
  const unlimited = Save.hasUnlimited();
  const lifeTxt = unlimited ? '∞' : S.lives;
  const timer = unlimited ? fmtTime(S.unlimitedUntil - Date.now()) : S.lives >= Save.LIFE_MAX ? t('full') : fmtTime(Save.nextLifeIn());
  const album = ALBUMS.find((a) => a.id === lv.album) || ALBUMS[0];
  const inAlbum = ART.filter((a) => a.album === album.id);
  const got = inAlbum.filter((a) => S.gallery[a.id]).length;
  const day = Save.today();
  const dailyDone = !!S.daily.done[day];
  const starterLeft = S.starterSeenAt && !S.starterBought ? S.starterSeenAt + 48 * 3600e3 - Date.now() : 0;
  const tag = lv.tag === 'super' ? `<span class="tag tag--super">${t('super')}</span>` : lv.tag === 'hard' ? `<span class="tag tag--hard">${t('hard')}</span>` : '';
  const colors = ['#ff4b5c', '#ff9233', '#ffd23f', '#3fcf6b', '#5ccfff', '#9b5cff'];
  const title = 'PAINT PARADE'.split('').map((ch, i) => ch === ' ' ? '<br>' : `<span style="--c:${colors[i % colors.length]};--d:${i * 0.08}s">${ch}</span>`).join('');
  $('#home').innerHTML = `
    <div class="topbar">
      <div class="pill pill--lives ${livesOn ? '' : 'pill--off'}" id="homeLives">${HEART}<b>${lifeTxt}</b><small>${livesOn ? timer : t('full')}</small></div>
      <div class="pill pill--coins" id="homeCoins" data-nav="shop">${COIN}<b>${fmtNum(S.coins)}</b><i class="plus">+</i></div>
      <button class="icon-btn" data-nav="settings" aria-label="${t('settings')}"><span class="gear-ico"></span></button>
    </div>
    <h1 class="logo">${title}</h1>
    <div class="parade">${['#ff4b5c', '#ffd23f', '#3fcf6b', '#5ccfff', '#9b5cff'].map((c, i) => `<img src="${bucketImg(c, '', 56)}" style="--i:${i}" alt="">`).join('')}</div>
    <div class="next-card" data-nav="play">
      <div class="next-art"><img src="${preview}" alt=""><span class="q">?</span></div>
      <div class="album-line"><span>${albumName(album.id, album.name)}</span><span class="bar"><i style="width:${got / inAlbum.length * 100}%"></i></span><b>${got}/${inAlbum.length}</b></div>
    </div>
    <button class="btn btn--play" data-nav="play"><span>${t('level')} ${lvN}</span>${tag}</button>
    <div class="home-row">
      <button class="side-btn" data-nav="daily"><span class="cal-ico"><b>${new Date().getDate()}</b></span><span>${t('daily')}</span>${dailyDone ? '<i class="check">✓</i>' : '<i class="dot"></i>'}</button>
      ${starterLeft > 0 ? `<button class="side-btn side-btn--offer" data-nav="starter"><span class="gift-ico"></span><span>${t('starter')}</span><small>${fmtLong(starterLeft)}</small></button>` : ''}
      ${S.noAds ? '' : `<button class="side-btn" data-nav="noads"><span class="noads-ico"></span><span>${t('noAds')}</span></button>`}
    </div>
    <nav class="tabbar">
      <button data-nav="shop"><span class="tab-ico shop-ico"></span>${t('shop')}</button>
      <button class="on" data-nav="play"><span class="tab-ico play-ico"></span>${t('play')}</button>
      <button data-nav="gallery"><span class="tab-ico gallery-ico"></span>${t('gallery')}</button>
    </nav>`;
}

function onNav(where) {
  sfx.tap();
  if (where === 'play') {
    const lvN = S.level;
    if (!canPlay(lvN)) { outOfLives(); return; }
    startLevel(getLevel(lvN));
  } else if (where === 'shop') openShop();
  else if (where === 'gallery') openGallery();
  else if (where === 'settings') openSettings();
  else if (where === 'daily') openDaily();
  else if (where === 'starter') starterOffer();
  else if (where === 'noads') openShop('noads');
  else if (where === 'back') { hideAllScreens(); renderHome(); $('#home').hidden = false; }
}

// ---------------- shop
function openShop(focus) {
  if (cur) game.paused = true;
  hideAllScreens();
  const sc = $('#shop');
  const free = S.ads.freeCoinsDay === Save.today() ? 3 - S.ads.freeCoinsCount : 3;
  const p = (id) => PRODUCTS.find((x) => x.id === id);
  const starterAvail = !S.starterBought;
  const coinCards = PRODUCTS.filter((x) => x.kind === 'coins').map((x, i) => `
    <button class="shop-item" data-buy="${x.id}">
      ${x.tag ? `<span class="ribbon-s">${x.tag}</span>` : ''}
      <span class="coin-stack s${i}"></span>
      <b>${fmtNum(x.coins)}</b>
      <span class="price">${IAP.price(x.id)}</span>
    </button>`).join('');
  sc.innerHTML = `
    <div class="topbar"><button class="icon-btn" data-nav="${cur ? 'resumeGame' : 'back'}">‹</button><h2>${t('shop')}</h2><div class="pill pill--coins">${COIN}<b>${fmtNum(S.coins)}</b></div></div>
    <div class="scroll">
      ${starterAvail ? `<button class="offer offer--starter" data-buy="pp_starter">
        <div class="offer__l"><span class="offer__tag">${t('starterSub')}</span><h3>${t('starter')}</h3>
          <ul><li>${COIN} 1,000</li><li>🪣 x2 · 🧲 x2 · 🌈 x2</li><li>${HEART} ∞ 60 min</li></ul></div>
        <div class="offer__r"><span class="gift-big"></span><span class="price price--big">${IAP.price('pp_starter')}</span></div></button>` : ''}
      ${S.noAds ? '' : `<button class="offer offer--noads ${focus === 'noads' ? 'pulse' : ''}" data-buy="pp_noads_bundle">
        <div class="offer__l"><span class="offer__tag">${t('bestValue')}</span><h3>${t('noAds')} +</h3>
          <ul><li>🚫 ${t('noAdsSub')}</li><li>${COIN} 1,500</li><li>🪣 x3 · 🧲 x3 · 🌈 x3</li></ul></div>
        <div class="offer__r"><span class="noads-big"></span><span class="price price--big">${IAP.price('pp_noads_bundle')}</span></div></button>
      <button class="offer offer--slim" data-buy="pp_noads"><h3>🚫 ${t('noAds')}</h3><span class="price">${IAP.price('pp_noads')}</span></button>`}
      <h4>${t('coinsTitle')}</h4>
      <div class="grid3">
        <button class="shop-item shop-item--free" data-free="1" ${free <= 0 ? 'disabled' : ''}>
          <span class="coin-stack s0"></span><b>+50</b><span class="price"><span class="ad-ico"></span>${t('free')}</span><small>${free} ${t('freeCoinsLeft')}</small>
        </button>
        ${coinCards}
      </div>
      <h4>${t('boosters')}</h4>
      <div class="grid3">
        ${['slot', 'grab', 'rainbow'].map((b) => `<button class="shop-item" data-bb="${b}"><span class="booster-ico booster-ico--${b}"></span><b>${{ slot: t('bSlot'), grab: t('bGrab'), rainbow: t('bRainbow') }[b]}</b><small>x${S.boosters[b]}</small><span class="price">${COIN}${BOOSTER_PRICE[b]}</span></button>`).join('')}
      </div>
      <button class="btn btn--link" data-restore="1">${t('restore')}</button>
    </div>`;
  sc.hidden = false;
  sc.onclick = async (ev) => {
    const n = ev.target.closest('[data-nav]');
    if (n) { if (n.dataset.nav === 'resumeGame') { sc.hidden = true; game.paused = false; updateHud(); return; } onNav(n.dataset.nav); return; }
    const buy = ev.target.closest('[data-buy]');
    if (buy) { sfx.tap(); const ok = await IAP.buy(buy.dataset.buy); if (ok) { toast('✨ ' + t('purchased')); flyCoins(100); haptic.success(); openShop(); } return; }
    const fr = ev.target.closest('[data-free]');
    if (fr && !fr.disabled) {
      sfx.tap();
      const ok = await Ads.rewarded('shop_free_coins');
      if (ok) {
        if (S.ads.freeCoinsDay !== Save.today()) { S.ads.freeCoinsDay = Save.today(); S.ads.freeCoinsCount = 0; }
        S.ads.freeCoinsCount++; Save.addCoins(50); Save.save(); flyCoins(50); openShop();
      }
      return;
    }
    const bb = ev.target.closest('[data-bb]');
    if (bb) { sfx.tap(); const b = bb.dataset.bb; if (Save.spend(BOOSTER_PRICE[b])) { S.boosters[b]++; Save.save(); haptic.light(); openShop(); } else toast(t('needCoins')); return; }
    if (ev.target.closest('[data-restore]')) { sfx.tap(); const ok = await IAP.restore(); toast(ok ? '✓' : '—'); openShop(); }
  };
}

// ---------------- gallery
function openGallery() {
  hideAllScreens();
  const sc = $('#gallery');
  const total = ART.length, got = ART.filter((a) => S.gallery[a.id]).length;
  sc.innerHTML = `
    <div class="topbar"><button class="icon-btn" data-nav="back">‹</button><h2>${t('gallery')}</h2><div class="pill">🖼️ <b>${got}/${total}</b></div></div>
    <div class="scroll">
      ${ALBUMS.map((al) => {
        const arts = ART.filter((a) => a.album === al.id);
        const n = arts.filter((a) => S.gallery[a.id]).length;
        const claim = n === arts.length && !S.albumsClaimed[al.id];
        return `<section class="album">
          <header><h3>${albumName(al.id, al.name)}</h3><span class="bar"><i style="width:${n / arts.length * 100}%"></i></span><b>${n}/${arts.length}</b></header>
          <div class="album-grid">${arts.map((a) => {
            const g = artToGrid(a);
            const has = !!S.gallery[a.id];
            const img = artThumb(g, 72, has).toDataURL();
            return `<figure class="${has ? 'got' : 'lock'}"><img src="${img}" alt=""><figcaption>${has ? artName(a.id, a.name) : '?'}</figcaption></figure>`;
          }).join('')}</div>
          ${claim ? `<button class="btn btn--green" data-chest="${al.id}">🎁 ${t('openChest')}</button>` : S.albumsClaimed[al.id] ? `<div class="done">✓ ${t('complete')}</div>` : ''}
        </section>`;
      }).join('')}
    </div>`;
  sc.hidden = false;
  sc.onclick = (ev) => {
    const n = ev.target.closest('[data-nav]'); if (n) { onNav(n.dataset.nav); return; }
    const c = ev.target.closest('[data-chest]'); if (c) { sfx.tap(); albumChest(ALBUMS.find((a) => a.id === c.dataset.chest)); }
  };
}

function albumChest(album) {
  if (S.albumsClaimed[album.id]) return;
  sfx.unlock();
  const m = openModal(`
    <div class="card">
      <div class="ribbon">${albumName(album.id, album.name)} · ${t('complete')}</div>
      <div class="chest"></div>
      <div class="win-reward">${COIN}<b>+300</b></div>
      <p>🪣 +1 · 🧲 +1 · 🌈 +1</p>
      <button class="btn btn--green btn--big" data-act="ok">${t('claim')}</button>
    </div>`, { noClose: true });
  m.addEventListener('click', (ev) => {
    if (!ev.target.closest('[data-act]')) return;
    S.albumsClaimed[album.id] = Date.now();
    Save.addCoins(300); S.boosters.slot++; S.boosters.grab++; S.boosters.rainbow++;
    Save.save(); flyCoins(300); haptic.success();
    track('album_complete', { album: album.id });
    setTimeout(() => { closeModal(); if (!$('#gallery').hidden) openGallery(); else renderHome(); }, 700);
  });
}

// ---------------- daily
function openDaily() {
  const day = Save.today();
  const done = !!S.daily.done[day];
  const week = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const k = Save.today(d);
    week.push(`<div class="day ${S.daily.done[k] ? 'done' : ''} ${i === 0 ? 'today' : ''}"><small>${d.toLocaleDateString(getLang() === 'he' ? 'he-IL' : 'en-US', { weekday: 'short' })}</small><b>${d.getDate()}</b></div>`);
  }
  const m = openModal(`
    <div class="card">
      <div class="ribbon">${t('daily')}</div>
      <p class="muted">${t('dailySub')}</p>
      <div class="week">${week.join('')}</div>
      <div class="streak">🔥 <b>${S.daily.days || 0}</b> ${t('streakDays')}</div>
      ${done ? `<p>${t('dailyDone')}</p>` : `<div class="win-reward">${COIN}<b>+${100 + Math.min(100, (S.daily.days || 0) * 20)}</b></div>
      <button class="btn btn--green btn--big" data-act="play">${t('play')}</button>`}
    </div>`);
  m.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    sfx.tap();
    b.disabled = true; b.textContent = '…';
    setTimeout(() => startLevel(dailyLevel(day)), 30);
  });
}

// ---------------- offers
function starterOffer() {
  if (S.starterBought) return;
  if (!S.starterSeenAt) { S.starterSeenAt = Date.now(); Save.save(); }
  const m = openModal(`
    <div class="card card--offer">
      <div class="ribbon ribbon--gold">${t('starter')}</div>
      <div class="gift-big"></div>
      <ul class="offer-list"><li>${COIN}<b>1,000</b></li><li>🪣 x2 · 🧲 x2 · 🌈 x2</li><li>${HEART}<b>∞</b> 60 min</li></ul>
      <button class="btn btn--green btn--big" data-act="buy">${IAP.price('pp_starter')}</button>
      <button class="btn btn--link" data-act="no">${t('cancel')}</button>
    </div>`);
  m.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    sfx.tap();
    if (b.dataset.act === 'buy') { const ok = await IAP.buy('pp_starter'); if (ok) { closeModal(); toast('✨ ' + t('thanks')); flyCoins(1000); renderHome(); } }
    else { closeModal(); renderHome(); }
  });
}

function outOfLives() {
  const m = openModal(`
    <div class="card">
      <div class="ribbon ribbon--red">${t('outOfLives')}</div>
      <div class="big-heart">${HEART}<b>0</b></div>
      <p class="muted">${t('nextLife')} <b id="lifeTimer">${fmtTime(Save.nextLifeIn())}</b></p>
      <button class="btn btn--purple btn--big" data-act="ad"><span class="ad-ico"></span>${t('plusLife')}</button>
      <button class="btn btn--green btn--big" data-act="refill">${t('refill')} · ${COIN}${REFILL_PRICE}</button>
    </div>`);
  const iv = setInterval(() => { const x = $('#lifeTimer'); if (!x) { clearInterval(iv); return; } Save.tickLives(); x.textContent = fmtTime(Save.nextLifeIn()); if (S.lives > 0) { clearInterval(iv); closeModal(); renderHome(); } }, 1000);
  m.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    sfx.tap();
    if (b.dataset.act === 'ad') { b.disabled = true; const ok = await Ads.rewarded('life'); if (ok) { Save.addLives(1); Save.save(); closeModal(); renderHome(); } else b.disabled = false; }
    else if (Save.spend(REFILL_PRICE)) { Save.addLives(Save.LIFE_MAX); Save.save(); closeModal(); renderHome(); }
    else { closeModal(); openShop(); }
  });
}

// ---------------- settings
function openSettings() {
  const m = openModal(`
    <div class="card">
      <h2>${t('settings')}</h2>
      ${settingsToggles()}
      <label class="toggle"><span>${t('language')}</span><select data-lang>${LANGS.map((l) => `<option value="${l.id}" ${getLang() === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label>
      <button class="btn btn--ghost" data-act="restore">${t('restore')}</button>
      <div class="links"><a href="privacy.html" target="_blank" rel="noopener">${t('privacy')}</a> · <a href="terms.html" target="_blank" rel="noopener">${t('terms')}</a> · <a href="mailto:support@paintparade.app">${t('support')}</a></div>
      <small class="muted">${t('version')} ${VERSION}</small>
    </div>`);
  bindToggles(m);
  m.querySelector('[data-lang]').addEventListener('change', (e) => { S.settings.lang = e.target.value; Save.save(); setLang(S.settings.lang); closeModal(); renderHome(); openSettings(); });
  m.addEventListener('click', async (ev) => { const b = ev.target.closest('[data-act]'); if (!b) return; sfx.tap(); const ok = await IAP.restore(); toast(ok ? '✓' : '—'); });
}

// ------------------------------------------------------------------ boot
function boot() {
  S = Save.load();
  S.stats.sessions++;
  setLang(S.settings.lang || detectLang());
  applySettings();
  Save.save();
  game = new Game($('#cv'), {
    onWin, onFail, onEvent: onGameEvent, onProgress: setProgress, t,
    safe: safeInsets,
    hud: () => ({ top: 78, bottom: 92 }),
  });
  window.addEventListener('resize', () => { if (cur) game.resize(); });
  document.addEventListener('pointerdown', unlockAudio, { once: false, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { suspend(); if (cur && !game.paused && game.st && game.st.status === 'play') openPause(); Save.save(); }
    else resume();
  });
  window.addEventListener('pp:pause', () => { if (cur && !game.paused) openPause(); });
  window.addEventListener('pp:back', () => {
    if (!$('#modal').hidden) { const fn = $('#modal')._onClose; closeModal(); fn && fn(); }
    else if (cur) openPause();
    else if (!$('#home').hidden) { /* stay */ } else onNav('back');
  });
  $('#btnPause').addEventListener('click', () => { sfx.tap(); openPause(); });
  $('#hudCoins').addEventListener('click', () => { sfx.tap(); openShop(); });
  document.querySelectorAll('[data-booster]').forEach((b) => b.addEventListener('click', () => onBooster(b.dataset.booster)));
  $('#home').addEventListener('click', (ev) => { const n = ev.target.closest('[data-nav]'); if (n) onNav(n.dataset.nav); });
  setInterval(() => { if (!$('#home').hidden && $('#modal').hidden) { Save.tickLives(); const l = $('#homeLives small'); if (l && S.level >= LIVES_FROM) l.textContent = Save.hasUnlimited() ? fmtTime(S.unlimitedUntil - Date.now()) : S.lives >= Save.LIFE_MAX ? t('full') : fmtTime(Save.nextLifeIn()); const b = $('#homeLives b'); if (b) b.textContent = Save.hasUnlimited() ? '∞' : S.lives; } }, 1000);
  initPlatform();
  $('#boot').classList.add('gone');
  setTimeout(() => $('#boot').remove(), 600);
  // First session: straight into level 1, no menus.
  if (S.level === 1 && S.stats.wins === 0) startLevel(getLevel(1));
  else goHome();
  window.__pp = { S, game, getLevel, startLevel, goHome, Save, openShop, openGallery, bestMove, laneSlotPos, slotPos };
}

if ('serviceWorker' in navigator && location.protocol === 'https:' && !isNative()) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.fonts && document.fonts.load('700 20px Fredoka').finally(boot);
if (!document.fonts) boot();
void mix; void buildLevel;
