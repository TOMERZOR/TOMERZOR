// Title screen, pause, settings, map, and the in-game phone.
import { el, fmtMoney } from '../core/util.js';
import { QUALITY } from '../engine/renderer.js';
import { POI } from '../world/map.js';
import { RADIO } from '../game/defs.js';

const VERSION = '1.0.0';

export class Menu {
  constructor(game) {
    this.game = game; this.ui = document.getElementById('ui');
    this.screen = null; this.items = []; this.sel = 0; this.kind = '';
    this.dbg = null; this.navT = 0;
    window.addEventListener('keydown', (e) => this.key(e));
  }

  close() { if (this.screen) { this.screen.remove(); this.screen = null; } this.items = []; this.kind = ''; }
  open(kind, cls = 'menu') {
    this.close(); this.kind = kind;
    const s = this.screen = el('div', 'screen ' + cls);
    this.ui.appendChild(s);
    if (document.pointerLockElement) document.exitPointerLock();
    return s;
  }
  // items: [{label, hint, action, disabled}]
  list(parent, items) {
    const box = el('div', 'items'); parent.appendChild(box);
    this.items = [];
    items.forEach((it) => {
      if (!it) return;
      const b = el('button', 'item', `<span>${it.label}</span>` + (it.hint ? `<small>${it.hint}</small>` : ''));
      if (it.disabled) b.setAttribute('disabled', '');
      b.onclick = () => { this.game.audio.click(); it.action(); };
      b.onmouseenter = () => this.select(this.items.indexOf(b));
      box.appendChild(b); if (!it.disabled) this.items.push(b);
    });
    this.select(0);
    return box;
  }
  select(i) { if (!this.items.length) return; this.sel = (i + this.items.length) % this.items.length; this.items.forEach((b, k) => b.classList.toggle('sel', k === this.sel)); }
  key(e) {
    if (!this.screen) return;
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Escape') e.target.blur(); return; }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.select(this.sel + 1); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.select(this.sel - 1); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'Space') { const b = this.items[this.sel]; if (b) b.click(); e.preventDefault(); }
  }
  tick(dt) {
    if (!this.screen) return;
    const inp = this.game.input;
    this.navT -= dt;
    if (inp.lastDevice === 'pad') {
      if (Math.abs(inp.move.y) > 0.6 && this.navT <= 0) { this.select(this.sel + (inp.move.y < 0 ? 1 : -1)); this.navT = 0.22; }
      if (inp.pressed.jump) { const b = this.items[this.sel]; if (b) b.click(); }
    }
  }

  // ---- title ---------------------------------------------------------------------------
  main() {
    const g = this.game, s = this.open('main');
    const side = el('div', 'side', `<div class="title">שכונה ד׳</div><div class="tag">קריית שמש · סיפור מהבלוקים</div>`);
    s.appendChild(side);
    this.panel = el('div', 'panel'); s.appendChild(this.panel);
    this.list(side, [
      g.hasSave() ? { label: 'המשך', hint: 'מהשמירה האחרונה', action: () => g.continueGame() } : null,
      { label: 'סיפור חדש', hint: 'נהוראי חוזר הביתה', action: () => (g.hasSave() ? this.confirmNew() : g.newGame()) },
      { label: 'אונליין', hint: 'שודים עם חברים', action: () => g.net.lobby() },
      { label: 'הגדרות', action: () => this.settings() },
      { label: 'קרדיטים', action: () => this.credits() },
    ]);
    side.appendChild(el('div', 'foot', `יצירה בדיונית וסאטירית. הדמויות, העסקים והאירועים מומצאים; המצוקה אמיתית.<br>גרסה ${VERSION}`));
  }
  confirmNew() {
    const p = this.panel; p.innerHTML = '<h3>להתחיל מחדש?</h3><p class="lead">יש שמירה קיימת. סיפור חדש ימחק אותה.</p>';
    const row = el('div'); row.style.cssText = 'display:flex;gap:.8rem;margin-top:1.2rem'; p.appendChild(row);
    const y = el('button', 'btn', 'כן, מהתחלה'); y.onclick = () => this.game.newGame(); const n = el('button', 'btn ghost', 'ביטול'); n.onclick = () => { p.innerHTML = ''; };
    row.append(y, n);
  }
  credits() {
    this.panel.innerHTML = `<h3>קרדיטים</h3>
      <p class="lead">״שכונה ד׳״ נכתב, תוכנת ועוצב כמשחק עולם פתוח סאטירי על החיים בבלוקים של עיירת פיתוח בדיונית בדרום.</p>
      <dl class="kv" style="margin-top:1rem">
        <dt>דמויות, רכבים ואביזרים</dt><dd>מודלים תלת־ממדיים, שלד ואנימציה — Higgsfield</dd>
        <dt>טקסטורות ואמנות מפתח</dt><dd>Higgsfield, עיבוד והתאמה במשחק</dd>
        <dt>מנוע</dt><dd>three.js · WebGL</dd>
        <dt>גופנים</dt><dd>Karantina · Heebo · Secular One · Suez One (רישיון OFL)</dd>
        <dt>מחקר</dt><dd>דו״ח העוני של הביטוח הלאומי, דו״חות מבקר המדינה על הדיור הציבורי, סיקור עיתונאי של פשיעה ושוק אפור</dd>
      </dl>
      <p class="lead" style="margin-top:1.2rem;font-size:.86rem;color:var(--mute)">כל קשר בין הדמויות לאנשים אמיתיים מקרי. המשחק אינו מעודד אלימות או עבריינות; הוא צוחק על מי שמרוויח מהן.</p>`;
  }

  // ---- settings -------------------------------------------------------------------------
  settings(target) {
    const g = this.game, p = target || this.panel, st = g.settings;
    p.innerHTML = '<h3>הגדרות</h3>';
    const row = (label, opts, cur, set) => {
      const r = el('div', 'row', `<span>${label}</span><div class="opts"></div>`);
      opts.forEach(([v, name]) => { const c = el('button', 'chip' + (v === cur ? ' on' : ''), name); c.onclick = () => { set(v); g.saveSettings(); g.audio.click(); this.settings(p); }; r.querySelector('.opts').appendChild(c); });
      p.appendChild(r);
    };
    row('איכות גרפיקה', [['auto', 'אוטומטי']].concat(Object.keys(QUALITY).map((k) => [k, QUALITY[k].label])), st.quality, (v) => g.applyQuality(v));
    const lv = [[0, 'כבוי'], [0.3, 'נמוך'], [0.6, 'בינוני'], [0.9, 'גבוה']];
    row('עוצמה כללית', lv.slice(1), st.master, (v) => { st.master = v; });
    row('מוזיקה ורדיו', lv, st.music, (v) => { st.music = v; });
    row('אפקטים', lv, st.sfx, (v) => { st.sfx = v; });
    row('רגישות מצלמה', [[0.6, 'איטית'], [1, 'רגילה'], [1.5, 'מהירה'], [2.1, 'מאוד']], st.sens, (v) => { st.sens = v; });
    row('היפוך ציר Y', [[false, 'לא'], [true, 'כן']], st.invertY, (v) => { st.invertY = v; });
    row('רעידות מצלמה', [[true, 'פועל'], [false, 'כבוי']], st.shake, (v) => { st.shake = v; });
    row('מילות מכה (בום! טראח!)', [[true, 'פועל'], [false, 'כבוי']], st.pops, (v) => { st.pops = v; });
    row('דיאלוג מתקדם לבד', [[false, 'לא'], [true, 'כן']], st.autoAdvance, (v) => { st.autoAdvance = v; });
    row('מונה FPS', [[false, 'כבוי'], [true, 'פועל']], st.fps, (v) => { st.fps = v; if (!v && this.dbg) { this.dbg.remove(); this.dbg = null; } });
    const help = el('div', 'lead'); help.style.cssText = 'margin-top:1.2rem;font-size:.86rem;color:var(--mute)';
    help.innerHTML = 'מקלדת: WASD תנועה · Shift ריצה · רווח קפיצה/בלם יד · J או קליק אגרוף · K או קליק ימני בעיטה · F רכב · E פעולה · Q רדיו · T טלפון · M מפה<br>שלט: מקל שמאלי תנועה · RT גז · LT בלם · X אגרוף · B בעיטה · Y רכב · A פעולה';
    p.appendChild(help);
  }

  // ---- pause -----------------------------------------------------------------------------
  pause(tab) {
    const g = this.game;
    if (!g.playing || g.cutscene) return;
    g.paused = true; g.audio.pause(true);
    const s = this.open('pause');
    const side = el('div', 'side', `<div class="title" style="font-size:4.6rem">הפסקה</div><div class="tag">${g.mode === 'online' ? 'אונליין · חדר ' + (g.net.room || '') : 'מצב סיפור'}</div>`);
    s.appendChild(side); this.panel = el('div', 'panel'); s.appendChild(this.panel);
    this.list(side, [
      { label: 'המשך', action: () => this.resume() },
      g.mode === 'online' ? { label: 'לוח שודים', hint: g.net.isHost ? 'אתה המארח' : 'המארח מחליט', action: () => g.net.board() } : null,
      { label: 'מפה', action: () => { g.net.boardOpen = false; this.map(); } },
      { label: 'מצב', action: () => this.status() },
      { label: 'הגדרות', action: () => this.settings() },
      g.missions.active ? { label: 'נטוש משימה', action: () => { g.missions.fail('המשימה ננטשה'); this.resume(); } } : null,
      { label: 'תפריט ראשי', hint: g.mode === 'story' ? 'ההתקדמות נשמרת אחרי כל משימה' : '', action: () => { this.close(); g.paused = false; g.toMenu(); } },
    ]);
    if (tab === 'map') this.map(); else if (g.mode === 'online') g.net.board(); else this.status();
  }
  resume() { const g = this.game; g.net.boardOpen = false; this.close(); g.paused = false; g.audio.pause(false); if (!g.input.touch) { const c = g.gfx.canvas; if (c.requestPointerLock) { try { c.requestPointerLock(); } catch (e) { /* needs a gesture */ } } } }
  map() {
    this.panel.innerHTML = '<h3>קריית שמש</h3>';
    const cv = el('canvas', 'bigmap'); cv.width = cv.height = 900; this.panel.appendChild(cv);
    this.game.ui.drawFull(cv);
    this.panel.appendChild(el('div', 'lead', '<span style="color:var(--amber)">●</span> יעד &nbsp; <span style="color:#8a3fe0">■</span> שטח של ג׳ &nbsp; <span style="color:#f5b301">■</span> שטח של ד׳')).style.cssText = 'margin-top:.7rem;font-size:.86rem';
  }
  status() {
    const g = this.game, pl = g.player, ms = g.missions, n = ms.next();
    const story = g.missions.list.filter((m) => !m.online);
    const done = story.filter((m) => ms.done.has(m.id)).length;
    this.panel.innerHTML = `<h3>${ms.active ? ms.active.title : 'נהוראי'}</h3>
      <p class="lead">${ms.active ? (ms.active.blurb || '') : n ? `הצעד הבא: <b>${n.title}</b> — ${n.where || 'סימון צהוב במפה'}.` : g.mode === 'story' ? 'הסיפור הושלם. העיר שלך.' : 'מצב חופשי.'}</p>
      <dl class="kv" style="margin-top:1.1rem">
        <dt>כסף</dt><dd class="num">${fmtMoney(pl.money)}</dd>
        <dt>התקדמות בסיפור</dt><dd class="num">${done}/${story.length}</dd>
        <dt>נוקאאוטים</dt><dd class="num">${pl.stats.kos}</dd>
        <dt>רכבים ש״הושאלו״</dt><dd class="num">${pl.stats.cars}</dd>
        <dt>קילומטרים</dt><dd class="num">${(pl.stats.dist / 1000).toFixed(1)}</dd>
        <dt>מעצרים · התעלפויות</dt><dd class="num">${pl.stats.busted} · ${pl.stats.wasted}</dd>
        <dt>הרוויח סה״כ</dt><dd class="num">${fmtMoney(pl.stats.earned)}</dd>
      </dl>`;
  }

  // ---- phone -----------------------------------------------------------------------------
  phone() {
    const g = this.game;
    if (!g.playing || g.cutscene || g.paused) return;
    g.paused = true;
    this.close(); this.kind = 'phone';
    const s = this.screen = el('div', 'screen'); s.style.background = 'rgba(13,15,18,.35)';
    s.onclick = (e) => { if (e.target === s) this.resume(); };
    this.ui.appendChild(s);
    if (document.pointerLockElement) document.exitPointerLock();
    const ph = el('div', 'phone', `<div class="bar"><span>${g.sky.clock()}</span><span>ס־לקום ▂▄▆</span></div><h5>שלום, נהוראי</h5><div class="list"></div>`);
    s.appendChild(ph);
    const list = ph.querySelector('.list'); this.items = [];
    const app = (title, sub, fn, disabled) => { const b = el('button', 'app', `<b>${title}</b><span>${sub}</span>`); if (disabled) b.setAttribute('disabled', ''); b.onclick = () => { g.audio.click(); fn(); }; list.appendChild(b); if (!disabled) this.items.push(b); };
    const n = g.missions.next();
    if (g.mode === 'story') app(n ? 'המשימה הבאה: ' + n.title : 'אין משימות כרגע', n ? (n.where || 'הסימון הצהוב במפה') : 'תסתובב, תאכל משהו', () => this.resume(), !n);
    app('מונית', 'נסיעה מהירה · ₪60', () => this.taxi(list), g.wanted.level > 0 || !!g.missions.active || g.player.money < 60);
    app('הבנק שלי', `יתרה ${fmtMoney(g.player.money)}` + (g.mode === 'story' && !g.missions.done.has('shchuna') ? ' · חוב לז׳וז׳ו ₪180,000' : ''), () => {}, true);
    app('רדיו', RADIO[g.audio.radioIdx].name, () => { g.audio.radioIdx = (g.audio.radioIdx + 1) % RADIO.length; if (g.player.vehicle) g.audio.playRadio(); this.resume(); g.ui.zone(RADIO[g.audio.radioIdx].name, RADIO[g.audio.radioIdx].tag || ''); });
    app('שמור', 'נשמר גם אוטומטית', () => { g.save(); g.ui.notify('נשמר', 'ok'); this.resume(); }, g.mode !== 'story' || !!g.missions.active);
    app('סגור', '', () => this.resume());
    this.select(0);
  }
  taxi(list) {
    const g = this.game; list.innerHTML = ''; this.items = [];
    const dest = [['הבית', 'home'], ['המרכז המסחרי', 'plaza'], ['המוסך', 'garageIn'], ['השוק', 'shuk'], ['התחנה המרכזית', 'busArrive'], ['דלק נגב', 'gas']];
    for (const [name, key] of dest) {
      const p = POI[key]; if (!p) continue;
      const b = el('button', 'app', `<b>${name}</b><span>₪60</span>`);
      b.onclick = async () => {
        this.close(); g.paused = false; g.fade(true); await new Promise((r) => setTimeout(r, 500));
        g.player.addMoney(-60, 'taxi'); g.player.teleport(p.x, p.z + 1.5, 0); g.sky.setHour((g.sky.hour + 0.4) % 24);
        g.fade(false); g.ui.notify('הנהג דיבר כל הדרך על פוליטיקה.', '');
      };
      list.appendChild(b); this.items.push(b);
    }
    this.select(0);
  }

  debug(fps) {
    if (!this.dbg) { this.dbg = el('div'); this.dbg.style.cssText = 'position:absolute;left:50%;bottom:.3rem;transform:translateX(-50%);font:700 11px Heebo;color:#f3efe6;background:rgba(0,0,0,.5);padding:2px 8px;direction:ltr;border-radius:2px'; this.ui.appendChild(this.dbg); }
    const i = this.game.gfx.renderer.info.render;
    this.dbg.textContent = `${Math.round(fps)} fps · ${i.calls} calls · ${(i.triangles / 1000).toFixed(0)}k tris · ${this.game.world.actors.length} ppl · ${this.game.world.vehicles.length} cars`;
  }
}
