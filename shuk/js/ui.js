// DOM user interface: screens, HUD and menus. Text comes from i18n.js; Hebrew is RTL, English LTR.
import { CHARACTERS, POWERUPS, UPGRADE_COST, MAX_UPGRADE, MISSIONS, MAX_MULT, LEVEL_REWARD } from './config.js';
import * as Save from './save.js';
import { T, getLang, setLang, isRTL } from './i18n.js';

const $ = id => document.getElementById(id);
const LOCALE = isRTL() ? 'he-IL' : 'en-US';
const fmt = n => Math.floor(n).toLocaleString(LOCALE);
const ICON = k => `img/ui/ico_${k}.webp`;
const COIN = '<img src="img/ui/ico_coin.webp" alt="">';

// gradient title text draws its outline from data-text, so both must change together
function setText(el, text) {
  el.textContent = text;
  if (el.classList.contains('gt')) el.dataset.text = text;
}

export class UI {
  constructor(h) {
    this.h = h;
    this.current = 'loading';
    this.hintShown = null;
    this.hudCache = {};
    this.powerEls = {};
    this.charIndex = 0;
    this.applyText();
    this.bind();
  }

  applyText() {
    const root = document.documentElement;
    root.lang = getLang();
    root.dir = isRTL() ? 'rtl' : 'ltr';
    document.title = `${T.title} · ${T.titleTop}`;
    for (const el of document.querySelectorAll('[data-t]')) {
      const v = T[el.dataset.t];
      if (typeof v === 'string') setText(el, v);
    }
  }

  bind() {
    const click = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); this.h.click(); fn(e); });
    click('btn-play', () => this.h.play());
    click('btn-pause', () => this.h.pause());
    click('btn-resume', () => this.h.resume());
    click('btn-restart', () => this.h.restart());
    click('btn-home', () => this.h.home());
    click('btn-again', () => this.h.restart());
    click('btn-over-home', () => this.h.home());
    click('btn-over-shop', () => { this.h.home(); this.openChars(); });
    click('btn-chars', () => this.openChars());
    click('btn-upgrades', () => this.openUpgrades());
    click('btn-missions', () => this.openMissions());
    click('btn-missions2', () => this.openMissions());
    click('btn-settings', () => this.openSettings());
    click('char-prev', () => this.stepChar(-1));
    click('char-next', () => this.stepChar(1));
    click('char-action', () => this.charAction());
    click('btn-reset', () => this.confirm(T.resetQ, () => this.h.resetProgress()));
    for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', e => { e.stopPropagation(); this.h.click(); this.closeSheet(); });
    for (const b of $('quality-seg').querySelectorAll('button')) b.addEventListener('click', () => { this.h.click(); this.h.setting('quality', b.dataset.q); this.renderSettings(); });
    for (const b of $('lang-seg').querySelectorAll('button')) b.addEventListener('click', () => {
      this.h.click();
      if (b.dataset.l === getLang()) return;
      setLang(b.dataset.l);
      location.reload();
    });
    // swipe between characters on the picker (a swipe toward the start edge shows the next one)
    let sx = null;
    const card = document.querySelector('.char-picker');
    card.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) this.stepChar((dx > 0) === isRTL() ? 1 : -1);
      sx = null;
    }, { passive: true });
  }

  show(id) {
    for (const s of document.querySelectorAll('#ui > .screen')) s.classList.toggle('show', s.id === id);
    this.current = id;
  }
  overlay(id, on) { $(id).classList.toggle('show', on); }

  // ---------- loading ----------
  setLoading(p, tip) {
    $('load-bar').style.width = Math.round(p * 100) + '%';
    if (tip) $('load-tip').textContent = tip;
  }
  showEnter(cb) {
    $('load-tip').textContent = T.ready;
    const b = $('btn-enter');
    b.classList.remove('hidden');
    b.addEventListener('click', () => cb(), { once: true });
    b.focus({ preventScroll: true });
  }
  loadError(msg) { $('load-tip').textContent = msg; }

  // ---------- menu ----------
  menu() {
    const s = Save.get();
    this.show('menu');
    $('menu-coins').textContent = fmt(s.coins);
    $('menu-best').textContent = fmt(s.best);
    $('menu-level').textContent = s.level;
    $('menu-mult').textContent = Math.min(MAX_MULT, s.level);
    const done = s.missions.filter(m => m.done).length;
    $('menu-mprog').style.width = (done / 3 * 100) + '%';
    $('menu-mtext').textContent = T.missionsToNext(done);
    const c = CHARACTERS.find(x => x.id === s.selected) || CHARACTERS[0];
    $('menu-char').textContent = c.name;
    $('menu-char-title').textContent = c.title;
    this.syncCoins();
  }
  syncCoins() {
    const c = fmt(Save.get().coins);
    for (const el of document.querySelectorAll('[data-coins]')) el.textContent = c;
  }

  // ---------- HUD ----------
  showHUD() {
    this.show('hud');
    for (const el of document.querySelectorAll('.fly-coin')) el.remove();
    this.flying = 0;
    this.hudCache = {};
    $('powers').innerHTML = '';
    this.powerEls = {};
  }
  updateHUD(r, powers) {
    const c = this.hudCache;
    // score and distance tick every frame; repainting outlined gradient text that often costs real time on
    // phones, so they refresh ten times a second (coins and the multiplier still update instantly)
    const now = performance.now(), tick = now - (c.t || 0) >= 100;
    if (tick) c.t = now;
    const score = Math.floor(r.score);
    if (tick && c.score !== score) { setText($('hud-score'), fmt(score)); c.score = score; }
    const coins = r.coins * 10;
    if (c.coins !== coins) { $('hud-coins').textContent = fmt(coins); c.coins = coins; }
    const x2 = r.powers.x2 > 0;
    const mult = r.mult * (x2 ? 2 : 1);
    if (c.mult !== mult) { const el = $('hud-mult'); el.textContent = '×' + mult; el.classList.toggle('x2', x2); c.mult = mult; }
    const dist = Math.floor(r.d);
    if (tick && c.dist !== dist) { $('hud-dist').textContent = fmt(dist); c.dist = dist; }
    // power-up timers: a ring that drains around the 3D icon
    const box = $('powers');
    const live = new Set(powers.map(p => p.k));
    for (const k of Object.keys(this.powerEls)) if (!live.has(k)) { this.powerEls[k].remove(); delete this.powerEls[k]; }
    for (const p of powers) {
      let el = this.powerEls[p.k];
      if (!el) {
        el = document.createElement('div');
        el.className = 'power';
        el.style.setProperty('--c', POWERUPS[p.k].color);
        el.innerHTML = `<img src="${ICON(p.k)}" alt="">`;
        box.appendChild(el);
        this.powerEls[p.k] = el;
      }
      const pct = Math.round(Math.max(0, Math.min(100, p.t / p.max * 100)));
      if (el._pct !== pct) { el._pct = pct; el.style.setProperty('--p', pct); }
      const ending = p.t < 2;
      if (el._ending !== ending) { el._ending = ending; el.classList.toggle('ending', ending); }
    }
  }
  flyCoin(sx, sy) {
    if (this.flying >= 10 || document.hidden) return;
    const target = $('hud-coins').parentElement.querySelector('img').getBoundingClientRect();
    const img = document.createElement('img');
    img.src = 'img/ui/ico_coin.webp'; img.alt = ''; img.className = 'fly-coin';
    img.style.left = sx + 'px'; img.style.top = sy + 'px';
    $('hud').appendChild(img);
    this.flying = (this.flying || 0) + 1;
    const dx = target.left + target.width / 2 - sx, dy = target.top + target.height / 2 - sy;
    const anim = img.animate([
      { transform: 'translate(-50%, -50%) scale(.7)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.35}px), calc(-50% + ${dy * 0.2 - 40}px)) scale(1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.55)`, opacity: 0.9 },
    ], { duration: 520, easing: 'cubic-bezier(.4,0,.7,1)' });
    anim.onfinish = anim.oncancel = () => {
      if (!img.isConnected) return; // already swept away by showHUD(), which reset the count
      img.remove(); this.flying--;
      const cap = $('hud-coins').parentElement;
      cap.classList.remove('bump'); void cap.offsetWidth; cap.classList.add('bump');
    };
  }
  zoneBanner(name, sub) {
    const z = $('zone-banner');
    setText(z.querySelector('b'), name);
    z.querySelector('span').textContent = sub;
    z.classList.remove('show'); void z.offsetWidth; z.classList.add('show');
  }
  toast(title, sub) {
    const box = $('toasts');
    while (box.children.length >= 2) box.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<b></b>${sub ? '<span></span>' : ''}`;
    t.querySelector('b').textContent = title;
    if (sub) t.querySelector('span').textContent = sub;
    box.appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }
  hint(dir) {
    const h = $('hint');
    this.hintShown = dir;
    if (!dir) { h.classList.remove('show'); return; }
    h.dataset.dir = dir;
    h.querySelector('b').textContent = T.hints[dir];
    h.classList.add('show');
  }

  // ---------- pause / revive / over ----------
  pause(on) {
    this.overlay('pause', on);
    if (on) this.renderToggles();
  }
  reviveOffer(cost, cb) {
    this.overlay('revive', true);
    $('revive-cost').textContent = fmt(cost);
    const prog = $('revive-prog'), count = $('revive-count');
    const total = 5;
    let left = total, done = false;
    const finish = ok => {
      if (done) return; done = true;
      clearInterval(timer);
      this.overlay('revive', false);
      cb(ok);
    };
    setText(count, String(total));
    prog.style.transition = 'none';
    prog.style.strokeDashoffset = '0';
    void prog.getBoundingClientRect();
    prog.style.transition = '';
    const timer = setInterval(() => {
      if (document.hidden) return; // don't burn the offer while the app is in the background
      left--; setText(count, String(Math.max(0, left)));
      prog.style.strokeDashoffset = String(276.5 * (1 - left / total));
      if (left > 0) this.h.tick(); else finish(false);
    }, 1000);
    $('btn-revive').onclick = e => { e.stopPropagation(); this.h.click(); finish(true); };
    $('btn-norevive').onclick = e => { e.stopPropagation(); this.h.click(); finish(false); };
  }
  gameOver(d) {
    this.overlay('over', true);
    const cause = d.cause || '';
    $('over-cause').textContent = T.causes[cause] || (cause.startsWith('ped:') ? T.causes.ped : T.causes.other);
    $('over-newbest').classList.toggle('hidden', !d.newBest);
    $('over-dist').textContent = `${fmt(d.dist)} ${T.meters}`;
    $('over-earned').textContent = fmt(d.earned);
    $('over-best').textContent = fmt(d.best);
    // count-up score
    const el = $('over-score'), t0 = performance.now(), dur = 900;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      setText(el, fmt(d.score * (1 - Math.pow(1 - k, 3))));
      if (k < 1 && this.current !== 'menu') requestAnimationFrame(tick);
    };
    tick();
    const s = Save.get();
    const list = $('over-missions');
    list.innerHTML = '';
    const fresh = new Set(d.missions.completed.map(m => m.i));
    const shown = d.missions.leveled ? d.missions.completed : s.missions;
    for (const m of shown) list.appendChild(this.missionEl(m, fresh.has(m.i)));
    const lu = $('over-levelup');
    if (d.missions.leveled) {
      const l = d.missions.leveled.level;
      lu.classList.remove('hidden');
      lu.textContent = T.levelUp(l, Math.min(MAX_MULT, l));
      const sm = document.createElement('small');
      sm.textContent = T.bonus(fmt(d.missions.leveled.reward));
      lu.appendChild(sm);
    } else lu.classList.add('hidden');
    setTimeout(() => $('btn-again').focus({ preventScroll: true }), 50);
  }

  missionEl(m, fresh = false) {
    const def = MISSIONS[m.i];
    const el = document.createElement('div');
    const done = m.done || m.progress >= m.target;
    el.className = 'mission' + (done ? ' done' : '') + (fresh ? ' fresh' : '');
    const pct = Math.min(100, m.progress / m.target * 100);
    el.innerHTML = `<span class="check"></span><div class="mtxt"><div></div><div class="mbar"><i style="width:${done ? 100 : pct}%"></i></div></div><span class="mnum">${fmt(Math.min(m.progress, m.target))}/${fmt(m.target)}</span>`;
    el.querySelector('.mtxt > div').textContent = def.text(fmt(m.target));
    return el;
  }

  // ---------- sheets ----------
  openSheet(id) {
    for (const s of ['chars', 'upgrades', 'missions', 'settings']) $(s).classList.toggle('show', s === id);
    $('menu').classList.remove('show');
    this.current = id;
    this.syncCoins();
    this.h.sheet(id);
  }
  closeSheet() {
    clearTimeout(this.sheetTimer);
    if (this.current === 'chars') this.h.previewChar(null);
    this.menu();
    this.h.sheet(null);
  }

  openChars() {
    const s = Save.get();
    this.charIndex = Math.max(0, CHARACTERS.findIndex(c => c.id === s.selected));
    this.openSheet('chars');
    this.renderChar();
  }
  stepChar(d) {
    clearTimeout(this.sheetTimer);
    this.charIndex = (this.charIndex + d + CHARACTERS.length) % CHARACTERS.length;
    this.renderChar();
  }
  renderChar() {
    const s = Save.get();
    const c = CHARACTERS[this.charIndex];
    setText($('char-name'), c.name);
    $('char-title').textContent = c.title;
    $('char-bio').textContent = c.bio;
    const owned = s.owned.includes(c.id);
    const btn = $('char-action');
    btn.style.fontSize = '';
    btn.classList.toggle('teal', owned && s.selected !== c.id);
    if (s.selected === c.id) { btn.textContent = T.selected; btn.disabled = true; }
    else if (owned) { btn.textContent = T.choose; btn.disabled = false; }
    else {
      btn.innerHTML = `<span></span>${COIN.replace('<img', '<img class="ico"')}<b class="num"></b>`;
      btn.querySelector('span').textContent = T.buyFor.trim();
      btn.querySelector('b').textContent = fmt(c.price);
      btn.disabled = false;
    }
    const dots = $('char-dots'); dots.innerHTML = '';
    CHARACTERS.forEach((ch, i) => { const d = document.createElement('i'); if (s.owned.includes(ch.id)) d.classList.add('owned'); if (i === this.charIndex) d.classList.add('cur'); dots.appendChild(d); });
    this.syncCoins();
    this.h.previewChar(c.id);
  }
  setCharLoading(on) { $('char-loading').classList.toggle('hidden', !on); }
  charAction() {
    const s = Save.get();
    const c = CHARACTERS[this.charIndex];
    if (s.owned.includes(c.id)) { this.h.selectChar(c.id); }
    else if (s.coins >= c.price) { this.h.buyChar(c.id); }
    else { this.h.denied(); this.toastSheet(T.missing(fmt(c.price - s.coins))); return; }
    this.renderChar();
  }
  toastSheet(text) {
    const b = $('char-action');
    b.textContent = text; b.disabled = true;
    b.style.fontSize = '20px';
    clearTimeout(this.sheetTimer);
    this.sheetTimer = setTimeout(() => { b.disabled = false; if (this.current === 'chars') this.renderChar(); }, 1300);
  }

  openUpgrades() { this.openSheet('upgrades'); this.renderUpgrades(); }
  renderUpgrades() {
    const s = Save.get();
    const list = $('upgrade-list');
    list.innerHTML = '';
    const dur = (p, l) => (p.base + p.step * l).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
    for (const [k, p] of Object.entries(POWERUPS)) {
      const lvl = s.upgrades[k] || 0;
      const maxed = lvl >= MAX_UPGRADE;
      const cost = maxed ? 0 : UPGRADE_COST[lvl];
      const el = document.createElement('div');
      el.className = 'upgrade';
      el.innerHTML = `<img class="uico" src="${ICON(k)}" alt=""><h3></h3><p class="udesc"></p><p class="udur"></p>
        <div class="pips">${Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        <button class="gbtn ${maxed ? 'teal' : 'yellow'}" ${maxed ? 'disabled' : ''}></button>`;
      el.querySelector('h3').textContent = p.name;
      el.querySelector('.udesc').textContent = p.desc;
      // numbers read left to right in both languages: isolate them so the arrow keeps pointing at the new value
      el.querySelector('.udur').textContent = maxed ? `${dur(p, lvl)} ${T.seconds}` : `\u2066${dur(p, lvl)} → ${dur(p, lvl + 1)}\u2069 ${T.seconds}`;
      const btn = el.querySelector('button');
      const label = () => {
        if (maxed) { btn.textContent = T.max; return; }
        btn.innerHTML = `<span></span><small>${COIN}<b class="num"></b></small>`;
        btn.querySelector('span').textContent = T.upgrade;
        btn.querySelector('b').textContent = fmt(cost);
      };
      label();
      if (!maxed) btn.addEventListener('click', e => {
        e.stopPropagation();
        if (Save.get().coins >= cost) { this.h.upgrade(k, cost); this.renderUpgrades(); return; }
        this.h.denied();
        btn.textContent = T.missing(fmt(cost - Save.get().coins));
        btn.style.fontSize = '13px';
        clearTimeout(btn._t);
        btn._t = setTimeout(() => { btn.style.fontSize = ''; label(); }, 1300);
      });
      list.appendChild(el);
    }
    this.syncCoins();
  }

  openMissions() { this.openSheet('missions'); this.renderMissions(); }
  renderMissions() {
    const s = Save.get();
    $('mis-level').textContent = s.level;
    $('mis-explain').textContent = s.level >= MAX_MULT ? T.levelMax
      : T.levelExplain(s.level + 1, Math.min(MAX_MULT, s.level + 1), fmt(LEVEL_REWARD * s.level));
    const big = document.querySelector('.big-level');
    big.dataset.text = big.textContent;
    const list = $('mission-list');
    list.innerHTML = '';
    for (const m of s.missions) list.appendChild(this.missionEl(m));
  }

  openSettings() { this.openSheet('settings'); this.renderSettings(); }
  renderSettings() {
    this.renderToggles();
    const q = Save.get().settings.quality;
    for (const b of $('quality-seg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.q === q);
    for (const b of $('lang-seg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.l === getLang());
  }
  renderToggles() {
    const s = Save.get().settings;
    for (const box of document.querySelectorAll('[data-toggles]')) {
      box.innerHTML = '';
      for (const k of ['music', 'sfx', 'haptics']) {
        const row = document.createElement('div');
        row.className = 'toggle';
        row.innerHTML = `<span></span><button class="switch" role="switch" aria-checked="${!!s[k]}"></button>`;
        row.querySelector('span').textContent = T[k];
        const sw = row.querySelector('button');
        sw.setAttribute('aria-label', T[k]);
        sw.addEventListener('click', e => { e.stopPropagation(); this.h.setting(k, !Save.get().settings[k]); this.h.click(); this.renderToggles(); });
        box.appendChild(row);
      }
    }
  }

  confirm(text, yes) {
    setText($('confirm-text'), text);
    this.overlay('confirm', true);
    $('confirm-yes').onclick = e => { e.stopPropagation(); this.h.click(); this.overlay('confirm', false); yes(); };
    $('confirm-no').onclick = e => { e.stopPropagation(); this.h.click(); this.overlay('confirm', false); };
  }
}
