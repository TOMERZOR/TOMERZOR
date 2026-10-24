// DOM user interface: screens, HUD and menus. All text is Hebrew, layout is RTL.
import { CHARACTERS, POWERUPS, UPGRADE_COST, MAX_UPGRADE, MISSIONS, MAX_MULT, LEVEL_REWARD } from './config.js';
import * as Save from './save.js';

const $ = id => document.getElementById(id);
const fmt = n => Math.floor(n).toLocaleString('he-IL');
const POWER_ICON = { magnet: '🧲', x2: '🥐', sneakers: '👟', hamsa: '🪬' };
const CAUSES = {
  'npc:grandpa': 'נתקעת בסבא עם העגלה', 'npc:moroccan': 'התנגשת בסבתא עם הצמידים', 'npc:breslov': 'נכנסת בנחמן הרוקד',
  'npc:chabad': 'עצרת להניח תפילין', 'npc:vendor': 'התנגשת במוכר העגבניות', 'npc:jack': 'עלית על הג׳ק של הספק',
  'npc:scooter': 'השליח על הקטנוע הפיל אותך', van: 'הטנדר של הנחמנים עצר אותך', truck: 'נכנסת במשאית הירקות', truckR: 'נכנסת במשאית הירקות',
  caught: 'סבתא תפסה אותך!',
};

export class UI {
  constructor(h) {
    this.h = h;
    this.current = 'loading';
    this.hintShown = null;
    this.hudCache = {};
    this.charIndex = 0;
    this.bind();
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
    click('btn-reset', () => this.confirm('למחוק את כל ההתקדמות?', () => this.h.resetProgress()));
    for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', e => { e.stopPropagation(); this.h.click(); this.closeSheet(); });
    for (const b of $('quality-seg').querySelectorAll('button')) b.addEventListener('click', () => { this.h.click(); this.h.setting('quality', b.dataset.q); this.renderSettings(); });
    // swipe between characters on the picker
    let sx = null;
    const card = document.querySelector('.char-picker');
    card.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) this.stepChar(dx > 0 ? 1 : -1); sx = null; }, { passive: true });
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
    $('load-tip').textContent = 'הכל מוכן. השוק מחכה!';
    const b = $('btn-enter');
    b.classList.remove('hidden');
    b.addEventListener('click', () => cb(), { once: true });
    b.focus({ preventScroll: true });
  }
  loadError(msg) {
    $('load-tip').textContent = msg;
  }

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
    $('menu-mtext').textContent = `${done}/3 משימות לרמה הבאה`;
    const c = CHARACTERS.find(x => x.id === s.selected) || CHARACTERS[0];
    $('menu-char').textContent = c.name;
    $('menu-char-title').textContent = c.title;
    for (const el of document.querySelectorAll('[data-coins]')) el.textContent = fmt(s.coins);
  }

  // ---------- HUD ----------
  showHUD() {
    this.show('hud');
    this.hudCache = {};
    $('powers').innerHTML = '';
    this.powerEls = {};
  }
  updateHUD(r, powers) {
    const c = this.hudCache;
    const score = Math.floor(r.score);
    if (c.score !== score) { $('hud-score').textContent = fmt(score); c.score = score; }
    const coins = r.coins * 10;
    if (c.coins !== coins) { $('hud-coins').textContent = fmt(coins); c.coins = coins; }
    const x2 = r.powers.x2 > 0;
    const mult = r.mult * (x2 ? 2 : 1);
    if (c.mult !== mult) { const el = $('hud-mult'); el.textContent = '×' + mult; el.classList.toggle('x2', x2); c.mult = mult; }
    const dist = Math.floor(r.d);
    if (c.dist !== dist) { $('hud-dist').textContent = fmt(dist); c.dist = dist; }
    // power-up timers
    const box = $('powers');
    const live = new Set(powers.map(p => p.k));
    for (const k of Object.keys(this.powerEls)) if (!live.has(k)) { this.powerEls[k].remove(); delete this.powerEls[k]; }
    for (const p of powers) {
      let el = this.powerEls[p.k];
      if (!el) {
        el = document.createElement('div');
        el.className = 'power';
        el.innerHTML = `<span class="pico" style="background:${POWERUPS[p.k].color}">${POWER_ICON[p.k]}</span><span class="pbar"><i style="background:${POWERUPS[p.k].color}"></i></span>`;
        box.appendChild(el);
        this.powerEls[p.k] = el;
      }
      el.querySelector('.pbar i').style.width = Math.max(0, p.t / p.max * 100) + '%';
      el.classList.toggle('ending', p.t < 2);
    }
  }
  zoneBanner(name, sub) {
    const z = $('zone-banner');
    z.querySelector('b').textContent = name;
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
    const text = { up: 'החליקו למעלה כדי לקפוץ', down: 'החליקו למטה כדי להתגלגל', left: 'החליקו שמאלה', right: 'החליקו ימינה' }[dir];
    h.dataset.dir = dir;
    h.querySelector('b').textContent = text;
    h.classList.add('show');
  }

  // ---------- pause / revive / over ----------
  pause(on) {
    if (on) { this.overlay('pause', true); this.renderToggles(); }
    else this.overlay('pause', false);
  }
  reviveOffer(cost, cb) {
    this.overlay('revive', true);
    $('revive-cost').textContent = fmt(cost);
    const prog = $('revive-prog');
    const total = 5;
    let left = total, done = false;
    const finish = ok => {
      if (done) return; done = true;
      clearInterval(timer);
      this.overlay('revive', false);
      cb(ok);
    };
    $('revive-count').textContent = total;
    prog.style.transition = 'none';
    prog.setAttribute('stroke-dashoffset', '0'); prog.style.strokeDashoffset = '0';
    void prog.getBoundingClientRect();
    prog.style.transition = '';
    const timer = setInterval(() => {
      left--; $('revive-count').textContent = Math.max(0, left);
      prog.style.strokeDashoffset = String(276.5 * (1 - left / total));
      if (left > 0) this.h.tick(); else finish(false);
    }, 1000);
    $('btn-revive').onclick = e => { e.stopPropagation(); this.h.click(); finish(true); };
    $('btn-norevive').onclick = e => { e.stopPropagation(); this.h.click(); finish(false); };
  }
  gameOver(d) {
    this.overlay('over', true);
    $('over-cause').textContent = CAUSES[d.cause] || (d.cause && d.cause.startsWith('ped:') ? 'התנגשת בעובר אורח' : 'אופס!');
    $('over-newbest').classList.toggle('hidden', !d.newBest);
    $('over-dist').textContent = fmt(d.dist) + ' מ׳';
    $('over-earned').textContent = fmt(d.earned);
    $('over-best').textContent = fmt(d.best);
    // count-up score
    const el = $('over-score'), t0 = performance.now(), dur = 900;
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur); el.textContent = fmt(d.score * (1 - Math.pow(1 - k, 3))); if (k < 1 && this.current !== 'menu') requestAnimationFrame(tick); };
    tick();
    const s = Save.get();
    const list = $('over-missions');
    list.innerHTML = '';
    const fresh = new Set(d.missions.completed.map(m => m.i));
    const shown = d.missions.leveled ? d.missions.completed : s.missions;
    for (const m of shown) list.appendChild(this.missionEl(m, fresh.has(m.i)));
    const lu = $('over-levelup');
    if (d.missions.leveled) {
      lu.classList.remove('hidden');
      lu.innerHTML = `עליתם לרמה ${d.missions.leveled.level}! מכפיל ×${Math.min(MAX_MULT, d.missions.leveled.level)}<small>בונוס: ₪${fmt(d.missions.leveled.reward)}</small>`;
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
    el.querySelector('.mtxt > div').textContent = def.text(m.target);
    return el;
  }

  // ---------- sheets ----------
  openSheet(id) {
    for (const s of ['chars', 'upgrades', 'missions', 'settings']) $(s).classList.toggle('show', s === id);
    $('menu').classList.remove('show');
    this.current = id;
    this.h.sheet(id);
  }
  closeSheet() {
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
    this.charIndex = (this.charIndex + d + CHARACTERS.length) % CHARACTERS.length;
    this.renderChar();
  }
  renderChar() {
    const s = Save.get();
    const c = CHARACTERS[this.charIndex];
    $('char-name').textContent = c.name;
    $('char-title').textContent = c.title;
    $('char-bio').textContent = c.bio;
    const owned = s.owned.includes(c.id);
    const btn = $('char-action');
    if (s.selected === c.id) { btn.textContent = 'נבחר ✓'; btn.disabled = true; }
    else if (owned) { btn.textContent = 'בחרו'; btn.disabled = false; }
    else { btn.innerHTML = `קנו ב־<span class="coin-ico"></span>${fmt(c.price)}`; btn.disabled = false; btn.classList.toggle('cant', s.coins < c.price); }
    const dots = $('char-dots'); dots.innerHTML = '';
    CHARACTERS.forEach((ch, i) => { const d = document.createElement('i'); if (s.owned.includes(ch.id)) d.classList.add('owned'); if (i === this.charIndex) d.classList.add('cur'); dots.appendChild(d); });
    for (const el of document.querySelectorAll('[data-coins]')) el.textContent = fmt(s.coins);
    this.h.previewChar(c.id);
  }
  setCharLoading(on) { $('char-loading').classList.toggle('hidden', !on); }
  charAction() {
    const s = Save.get();
    const c = CHARACTERS[this.charIndex];
    if (s.owned.includes(c.id)) { this.h.selectChar(c.id); }
    else if (s.coins >= c.price) { this.h.buyChar(c.id); }
    else { this.h.denied(); this.toastSheet(`חסרים עוד ₪${fmt(c.price - s.coins)}`); }
    this.renderChar();
  }
  toastSheet(text) {
    const b = $('char-action');
    const old = b.innerHTML;
    b.textContent = text; b.disabled = true;
    setTimeout(() => { b.disabled = false; this.renderChar(); }, 1300);
    void old;
  }

  openUpgrades() { this.openSheet('upgrades'); this.renderUpgrades(); }
  renderUpgrades() {
    const s = Save.get();
    const list = $('upgrade-list');
    list.innerHTML = '';
    for (const [k, p] of Object.entries(POWERUPS)) {
      const lvl = s.upgrades[k] || 0;
      const el = document.createElement('div');
      el.className = 'upgrade';
      const dur = (l) => (p.base + p.step * l).toLocaleString('he-IL', { maximumFractionDigits: 1 });
      const maxed = lvl >= MAX_UPGRADE;
      const cost = maxed ? 0 : UPGRADE_COST[lvl];
      el.innerHTML = `<div class="uico" style="background:${p.color}">${POWER_ICON[k]}</div>
        <h3></h3><p class="udesc"></p><p class="udur"></p>
        <div class="pips">${Array.from({ length: MAX_UPGRADE }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        <button class="btn ${maxed ? 'btn-soft' : 'btn-primary'}" ${maxed ? 'disabled' : ''}>${maxed ? 'מקסימום' : `שדרגו<small><span class="coin-ico"></span>${fmt(cost)}</small>`}</button>`;
      el.querySelector('h3').textContent = p.name;
      el.querySelector('.udesc').textContent = p.desc;
      el.querySelector('.udur').textContent = maxed ? `${dur(lvl)} שניות` : `${dur(lvl)} ← ${dur(lvl + 1)} שניות`;
      el.querySelector('.pips').style.gridColumn = '2';
      const btn = el.querySelector('button');
      if (!maxed) btn.addEventListener('click', e => {
        e.stopPropagation();
        if (Save.get().coins >= cost) { this.h.upgrade(k, cost); this.renderUpgrades(); }
        else { this.h.denied(); btn.innerHTML = `חסרים ₪${fmt(cost - Save.get().coins)}`; setTimeout(() => this.renderUpgrades(), 1200); }
      });
      list.appendChild(el);
    }
    for (const el of document.querySelectorAll('[data-coins]')) el.textContent = fmt(s.coins);
  }

  openMissions() { this.openSheet('missions'); this.renderMissions(); }
  renderMissions() {
    const s = Save.get();
    $('mis-level').textContent = s.level;
    const next = Math.min(MAX_MULT, s.level + 1);
    $('mis-explain').textContent = s.level >= MAX_MULT ? 'הגעתם למכפיל המקסימלי! המשיכו להשלים משימות בשביל בונוסים.'
      : `השלימו את שלוש המשימות כדי לעלות לרמה ${s.level + 1}: מכפיל הנקודות יעלה ל־×${next} ותקבלו ₪${fmt(LEVEL_REWARD * s.level)}.`;
    const list = $('mission-list');
    list.innerHTML = '';
    for (const m of s.missions) list.appendChild(this.missionEl(m));
  }

  openSettings() { this.openSheet('settings'); this.renderSettings(); }
  renderSettings() {
    this.renderToggles();
    const q = Save.get().settings.quality;
    for (const b of $('quality-seg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.q === q);
  }
  renderToggles() {
    const s = Save.get().settings;
    const items = [['music', 'מוזיקה'], ['sfx', 'צלילים'], ['haptics', 'רטט']];
    for (const box of document.querySelectorAll('[data-toggles]')) {
      box.innerHTML = '';
      for (const [k, label] of items) {
        const row = document.createElement('div');
        row.className = 'toggle';
        row.innerHTML = `<span></span><button class="switch" role="switch" aria-checked="${!!s[k]}" aria-label="${label}"></button>`;
        row.querySelector('span').textContent = label;
        row.querySelector('button').addEventListener('click', e => { e.stopPropagation(); this.h.setting(k, !Save.get().settings[k]); this.h.click(); this.renderToggles(); });
        box.appendChild(row);
      }
    }
  }

  confirm(text, yes) {
    $('confirm-text').textContent = text;
    this.overlay('confirm', true);
    $('confirm-yes').onclick = e => { e.stopPropagation(); this.overlay('confirm', false); yes(); };
    $('confirm-no').onclick = e => { e.stopPropagation(); this.overlay('confirm', false); };
  }
}
