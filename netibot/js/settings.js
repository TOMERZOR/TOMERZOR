// Settings (the gear): sound, controls, display and game options, kept on this device.
// Also the "add to home screen" guide that opens on a phone's first visit.
const Settings = {
  defaults: {
    quality: 'auto', saver: false, fps: false, hudScale: 1, minimap: true, shake: true,
    sens: 1, invertY: false, stickSize: 1, lefty: false, vibrate: true,
    textSpeed: 'normal', arrow: true, voices: true, curious: true,
  },
  v: {},
  HUD_BASE: 0.87,
  load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('netibot.settings') || '{}'); } catch (e) { /* storage may be blocked */ }
    this.v = { ...this.defaults, ...saved };
    this.apply();
  },
  save() { try { localStorage.setItem('netibot.settings', JSON.stringify(this.v)); } catch (e) { /* ignore */ } },
  set(k, val) { this.v[k] = val; this.save(); this.apply(); },

  // Pixel-ratio cap for the 3D view: phones get a lighter default.
  dprCap() {
    const q = this.v.quality;
    if (q === 'low') return 1;
    if (q === 'mid') return 1.5;
    if (q === 'high') return 2;
    return G.touch ? 1.5 : 2;
  },
  shadows() { return this.v.quality !== 'low'; },
  // Characters typed per tick in conversations.
  textStep() { return { slow: 1, normal: 2, fast: 4, instant: 1e6 }[this.v.textSpeed] || 2; },
  buzz(pattern) { try { if (this.v.vibrate && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not supported */ } },

  // The HUD's base size. On a phone 87%, so it leaves the screen to the game. On a computer it
  // grows with the window (a big monitor gets a big HUD), from 115% on a small laptop up to 240%.
  hudBase() {
    const touch = typeof G !== 'undefined' && G.touch;
    if (touch || matchMedia('(pointer: coarse)').matches) return this.HUD_BASE;
    return Math.max(1.15, Math.min(2.4, Math.min(innerWidth / 1050, innerHeight / 580)));
  },
  apply() {
    const v = this.v, root = document.documentElement, body = document.body;
    // The HUD is drawn at 87% by default so it leaves more of the screen to the game; the
    // setting scales that up or down (70%–140%).
    root.style.setProperty('--hud-scale', (this.hudBase() * v.hudScale).toFixed(3));
    if (!this.hudWatch) { this.hudWatch = true; window.addEventListener('resize', () => document.documentElement.style.setProperty('--hud-scale', (this.hudBase() * this.v.hudScale).toFixed(3))); }
    root.style.setProperty('--stick-scale', v.stickSize);
    if (body) {
      body.classList.toggle('lefty', !!v.lefty);
      body.classList.toggle('no-minimap', !v.minimap);
    }
    const fps = document.getElementById('fps');
    if (fps) fps.classList.toggle('hidden', !v.fps);
    if (typeof Scene3D !== 'undefined' && Scene3D.renderer && typeof Game !== 'undefined') Game.resize();
    if (typeof Scene3D !== 'undefined' && Scene3D.sun) {
      const on = this.shadows();
      if (Scene3D.sun.castShadow !== on) Scene3D.sun.castShadow = on;
      const size = v.quality === 'high' || (v.quality === 'auto' && !G.touch) ? 2048 : 1024;
      if (Scene3D.sun.shadow.mapSize.x !== size) {
        Scene3D.sun.shadow.mapSize.set(size, size);
        if (Scene3D.sun.shadow.map) { Scene3D.sun.shadow.map.dispose(); Scene3D.sun.shadow.map = null; }
      }
    }
  },

  // ---------- the panel ----------
  TABS: [['sound', '🔊 שמע'], ['controls', '🎮 שליטה'], ['display', '🖥️ תצוגה'], ['game', '💬 משחק'], ['about', 'ℹ️ אודות']],
  tab: 'sound',
  isOpen() { return !!document.getElementById('settings'); },
  open(tab) {
    if (this.isOpen()) return;
    if (tab) this.tab = tab;
    this.wasPaused = G.paused;
    G.paused = true;
    G.keys.clear();
    const box = el('div', { id: 'settings', class: 'settings' });
    document.body.appendChild(box);
    this.onKey = (e) => { if (e.code === 'Escape') { e.stopPropagation(); this.close(); } };
    window.addEventListener('keydown', this.onKey, true);
    this.render();
  },
  close() {
    const box = document.getElementById('settings');
    if (!box) return;
    box.remove();
    window.removeEventListener('keydown', this.onKey, true);
    G.paused = this.wasPaused;
    if (this.after) { const f = this.after; this.after = null; f(); }
  },

  // Row builders: a switch, a set of choices, a slider, a button.
  sw(key, label, hint = '') {
    return `<div class="set-row"><div class="set-l">${label}${hint ? `<small>${hint}</small>` : ''}</div>
      <button class="switch ${this.v[key] ? 'on' : ''}" data-sw="${key}" role="switch" aria-checked="${!!this.v[key]}" aria-label="${label}"><i></i></button></div>`;
  },
  seg(key, label, opts, hint = '') {
    return `<div class="set-row"><div class="set-l">${label}${hint ? `<small>${hint}</small>` : ''}</div>
      <div class="seg">${opts.map(([val, name]) => `<button data-seg="${key}" data-val="${val}" class="${String(this.v[key]) === String(val) ? 'sel' : ''}">${name}</button>`).join('')}</div></div>`;
  },
  range(id, label, val, min, max, step) {
    return `<div class="set-row"><div class="set-l">${label}</div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
  },
  soundRows() {
    const P = Sound.prefs;
    return `<div class="set-row"><div class="set-l">🎵 מוזיקה</div><button class="switch ${P.music ? 'on' : ''}" data-snd="music" role="switch" aria-label="מוזיקה"><i></i></button></div>
      ${this.range('st-mvol', 'עוצמת מוזיקה', P.musicVol, 0, 1, 0.05)}
      <div class="set-row"><div class="set-l">🔊 אפקטים</div><button class="switch ${P.sfx ? 'on' : ''}" data-snd="sfx" role="switch" aria-label="אפקטים"><i></i></button></div>
      ${this.range('st-svol', 'עוצמת אפקטים', P.sfxVol, 0, 1, 0.05)}
      <div class="set-row"><div class="set-l">🎶 סגנון מוזיקה</div><div class="seg">${Object.entries(Sound.STYLES).map(([k, n]) => `<button data-style="${k}" class="${Sound.style === k ? 'sel' : ''}">${n}</button>`).join('')}</div></div>`;
  },
  bindSound(box) {
    box.querySelectorAll('[data-snd]').forEach(b => b.onclick = () => {
      Sound.unlock();
      if (b.dataset.snd === 'music') Sound.setMusic(!Sound.prefs.music); else Sound.setSfx(!Sound.prefs.sfx);
      b.classList.toggle('on', !!Sound.prefs[b.dataset.snd]);
      Game.syncAudioButtons();
    });
    const mv = box.querySelector('#st-mvol'), sv = box.querySelector('#st-svol');
    if (mv) mv.oninput = (e) => { Sound.unlock(); Sound.setVolume('music', +e.target.value); };
    if (sv) sv.oninput = (e) => { Sound.unlock(); Sound.setVolume('sfx', +e.target.value); };
    if (sv) sv.onchange = () => Sound.click();
    box.querySelectorAll('[data-style]').forEach(b => b.onclick = () => {
      Sound.unlock();
      Sound.setStyle(b.dataset.style);
      if (!Sound.prefs.music) Sound.setMusic(true);
      box.querySelectorAll('[data-style]').forEach(x => x.classList.toggle('sel', x === b));
      const m = box.querySelector('[data-snd="music"]');
      if (m) m.classList.add('on');
    });
  },
  render() {
    const box = document.getElementById('settings');
    if (!box) return;
    const t = this.tab;
    let body = '';
    if (t === 'sound') {
      body = this.soundRows() + this.sw('voices', '🗣️ קולות של דמויות', 'הקריינות בסצנות ובקרבות בוס');
    } else if (t === 'controls') {
      body = this.range('st-sens', '🎯 רגישות מצלמה', this.v.sens, 0.4, 2, 0.1)
        + this.sw('invertY', '↕️ היפוך מצלמה למעלה/למטה')
        + this.seg('stickSize', '🕹️ גודל הג\'ויסטיקים והכפתורים', [[0.8, 'קטן'], [1, 'רגיל'], [1.2, 'גדול']])
        + this.sw('lefty', '🫲 מצב שמאליים', 'הליכה בצד ימין, מצלמה וכפתור E בצד שמאל')
        + this.sw('vibrate', '📳 רטט', 'באזעקות ובטעויות (בטלפונים שתומכים)');
    } else if (t === 'display') {
      body = this.seg('quality', '✨ איכות גרפיקה', [['auto', 'אוטומטי'], ['low', 'נמוכה'], ['mid', 'בינונית'], ['high', 'גבוהה']], 'נמוכה = בלי צללים, הכי חלק בטלפונים חלשים')
        + this.sw('saver', '🔋 חיסכון בסוללה', '30 פריימים בשנייה במקום 60')
        + `<div class="set-row"><div class="set-l">🔠 גודל הממשק<small>הכרטיסים למעלה, המשימה, המפה, השיחות וההודעות</small></div><div class="set-hud"><input type="range" id="st-hud" min="0.7" max="1.4" step="0.05" value="${this.v.hudScale}"><b id="st-hud-v">${Math.round(this.v.hudScale * 100)}%</b><button class="btn small ghost" id="st-hud-reset">איפוס</button></div></div>`
        + this.sw('minimap', '🗺️ מפה קטנה')
        + this.sw('shake', '💥 רעידות מסך', 'ביירוטים ובפיצוצים')
        + this.sw('fps', '⏱️ מונה FPS')
        + `<div class="set-row"><div class="set-l">⛶ מסך מלא</div><button class="btn small ghost" data-fs="text" id="st-fs"></button></div>`;
    } else if (t === 'game') {
      body = this.seg('textSpeed', '💬 מהירות טקסט בשיחות', [['slow', 'איטי'], ['normal', 'רגיל'], ['fast', 'מהיר'], ['instant', 'מיידי']])
        + this.sw('arrow', '🧭 חץ ניווט למשימה', 'החץ הצהוב בתחתית המסך')
        + this.sw('curious', '📸 סקרנים בש"ג', 'אזרחים סקרנים שמגיעים לאתר מדי פעם')
        + `<div class="set-row"><div class="set-l">🎓 הדרכת כפתורים<small>${Tutorial.done() ? 'כבר עברת אותה' : 'עוד לא עברת'}</small></div><button class="btn small ghost" id="st-tut">להציג שוב</button></div>
        <div class="set-row"><div class="set-l">📲 להוריד את המשחק לטלפון</div><button class="btn small ghost" id="st-install">איך עושים את זה?</button></div>
        <div class="set-row"><div class="set-l">↺ לאפס הגדרות</div><button class="btn small ghost" id="st-reset">איפוס</button></div>
        <div class="set-row danger"><div class="set-l">🗑️ למחוק את כל השמירות<small>מצב סיפור, אימונים ותפקידים</small></div><button class="btn small red" id="st-wipe">מחיקה</button></div>`;
    } else {
      body = `<div class="about"><div class="logo small">נתי<span>בוט</span></div>
        <p>משחק עולם פתוח על פלג"צ בסוללת כיפת ברזל ליד נתיבות. משחק בדיוני, וכל הדמויות, השמות והאירועים בו מומצאים.</p>
        <p><b>שמירה:</b> המשחק נשמר לבד כל כמה שניות, וגם כשסוגרים אותו. השמירה נמצאת רק בטלפון או במחשב הזה.</p>
        <p><b>מקשים במחשב:</b> WASD הליכה · Shift ריצה · E פעולה · Tab טלפון · G מפה · X השתגרות · M מוזיקה · N אפקטים · F מסך מלא · Esc תפריט.</p>
        <p class="ver">${Assets.peopleStatus() || ''}</p></div>`;
    }
    box.innerHTML = `<div class="set-scrim"></div><div class="set-panel" role="dialog" aria-label="הגדרות">
      <div class="set-head"><h2>⚙️ הגדרות</h2><button class="icon-btn" id="st-x" aria-label="סגירה">✕</button></div>
      <div class="set-tabs">${this.TABS.map(([k, n]) => `<button data-tab="${k}" class="${t === k ? 'sel' : ''}">${n}</button>`).join('')}</div>
      <div class="set-body">${body}</div></div>`;
    box.querySelector('.set-scrim').onclick = () => this.close();
    box.querySelector('#st-x').onclick = () => { Sound.click(); this.close(); };
    box.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { Sound.click(); this.tab = b.dataset.tab; this.render(); });
    box.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
      Sound.click();
      this.set(b.dataset.sw, !this.v[b.dataset.sw]);
      b.classList.toggle('on', !!this.v[b.dataset.sw]);
      b.setAttribute('aria-checked', !!this.v[b.dataset.sw]);
    });
    box.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => {
      Sound.click();
      const raw = b.dataset.val;
      this.set(b.dataset.seg, isNaN(+raw) ? raw : +raw);
      box.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach(x => x.classList.toggle('sel', x === b));
    });
    this.bindSound(box);
    const hud = box.querySelector('#st-hud');
    if (hud) {
      const show = (val) => { box.querySelector('#st-hud-v').textContent = Math.round(val * 100) + '%'; };
      hud.oninput = (e) => { this.set('hudScale', +e.target.value); show(+e.target.value); if (typeof UI !== 'undefined' && UI.placeObjective) UI.placeObjective(); };
      box.querySelector('#st-hud-reset').onclick = () => { Sound.click(); hud.value = 1; this.set('hudScale', 1); show(1); if (typeof UI !== 'undefined' && UI.placeObjective) UI.placeObjective(); };
    }
    const sens = box.querySelector('#st-sens');
    if (sens) sens.oninput = (e) => this.set('sens', +e.target.value);
    const fs = box.querySelector('#st-fs');
    if (fs) { fs.onclick = () => Game.toggleFullscreen(); Game.syncFullscreen(); }
    const on = (id, fn) => { const b = box.querySelector(id); if (b) b.onclick = () => { Sound.click(); fn(); }; };
    on('#st-tut', () => { Tutorial.reset(); this.close(); if (G.running) Tutorial.start(); else UI.toast('ההדרכה תופיע כשתיכנס[/י] למשחק'); });
    on('#st-install', () => { this.close(); Install.show(true); });
    on('#st-reset', () => { this.v = { ...this.defaults }; this.save(); this.apply(); this.render(); UI.toast('ההגדרות אופסו'); });
    on('#st-wipe', () => {
      if (!confirm('למחוק את כל המשחקים השמורים? אי אפשר לבטל את זה.')) return;
      try { for (const k of Object.keys(localStorage)) if (/^netibot\.(story|free|multi\.|role)/.test(k)) localStorage.removeItem(k); } catch (e) { /* ignore */ }
      location.reload();
    });
  },

  // A small sound card for the title screen's 🔊 button.
  soundCard(anchor) {
    let card = document.getElementById('sound-card');
    if (card) { card.remove(); return; }
    card = el('div', { id: 'sound-card', class: 'sound-card' }, `<div class="set-head"><b>🔊 שמע</b><button class="icon-btn small" aria-label="סגירה">✕</button></div>${this.soundRows()}`);
    document.body.appendChild(card);
    const r = anchor.getBoundingClientRect();
    card.style.top = (r.bottom + 8) + 'px';
    card.style.left = Math.max(8, r.left) + 'px';
    card.querySelector('.icon-btn').onclick = () => card.remove();
    this.bindSound(card);
    const away = (e) => { if (!card.contains(e.target) && e.target !== anchor) { card.remove(); document.removeEventListener('pointerdown', away, true); } };
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
  },
};

// How to put the game on the phone's home screen (it then opens full screen, like an app).
const Install = {
  standalone() { return !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)); },
  platform() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'other';
  },
  seen() { try { return !!localStorage.getItem('netibot.installSeen'); } catch (e) { return true; } },
  // On a phone's first visit, unless it's already running from the home screen.
  maybeShow() {
    if (this.seen() || this.standalone() || !matchMedia('(pointer: coarse)').matches) return;
    setTimeout(() => { if (!document.getElementById('install') && !G.running) this.show(false); }, 900);
  },
  show(fromSettings) {
    try { localStorage.setItem('netibot.installSeen', '1'); } catch (e) { /* ignore */ }
    const plat = this.platform();
    let tab = plat === 'android' ? 'android' : 'ios';
    const box = el('div', { id: 'install', class: 'settings' });
    document.body.appendChild(box);
    const steps = {
      ios: [
        ['⋯', 'לוחצים על <b>שלוש הנקודות</b> ⋯ ליד שורת הכתובת (בספארי, למטה).', 'בגרסאות ישנות של אייפון אין שלוש נקודות — יש ישר כפתור שיתוף ⬆️ בשורה למטה.'],
        ['⬆️', 'לוחצים <b>שיתוף</b> (הריבוע עם החץ למעלה).', ''],
        ['➕', 'גוללים קצת למטה ולוחצים <b>"הוספה למסך הבית"</b>.', 'אם לא רואים את זה — לגלול עד הסוף וללחוץ "עריכת פעולות".'],
        ['✔', 'לוחצים <b>"הוסף"</b> למעלה. זהו!', 'האייקון של נתיבוט מופיע במסך הבית ונפתח במסך מלא, בלי שורת הכתובת.'],
      ],
      android: [
        ['⋮', 'בכרום: לוחצים על <b>שלוש הנקודות</b> ⋮ למעלה בפינה.', 'בסמסונג אינטרנט: על ☰ למטה.'],
        ['📲', 'לוחצים <b>"הוספה למסך הבית"</b> (או "התקנת אפליקציה").', 'בסמסונג אינטרנט: "הוספת דף אל" ← "מסך הבית".'],
        ['✔', 'לוחצים <b>"הוספה"</b> / <b>"התקנה"</b>. זהו!', 'האייקון של נתיבוט מופיע במסך הבית ונפתח במסך מלא.'],
      ],
    };
    const render = () => {
      box.innerHTML = `<div class="set-scrim"></div><div class="set-panel install-panel" role="dialog" aria-label="להוריד את המשחק לטלפון">
        <div class="set-head"><h2>📲 להוריד את נתיבוט לטלפון</h2><button class="icon-btn" id="in-x" aria-label="סגירה">✕</button></div>
        <p class="in-sub">ככה המשחק נפתח כמו אפליקציה: אייקון במסך הבית, מסך מלא, בלי שורת כתובת.</p>
        <div class="set-tabs"><button data-p="ios" class="${tab === 'ios' ? 'sel' : ''}"> אייפון</button><button data-p="android" class="${tab === 'android' ? 'sel' : ''}">🤖 אנדרואיד</button></div>
        <ol class="in-steps">${steps[tab].map(([icon, text, note]) => `<li><span class="in-ico">${icon}</span><div>${text}${note ? `<small>${note}</small>` : ''}</div></li>`).join('')}</ol>
        <p class="in-note">💡 חשוב: לעשות את זה מתוך <b>הקישור שקיבלת</b>, ככה השמות והדמויות נשמרים גם באייקון.</p>
        <div class="actions"><button class="btn" id="in-ok">${fromSettings ? 'סגירה' : 'הבנתי, יאללה לשחק'}</button></div></div>`;
      const close = () => { Sound.click(); box.remove(); };
      box.querySelector('.set-scrim').onclick = close;
      box.querySelector('#in-x').onclick = close;
      box.querySelector('#in-ok').onclick = close;
      box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { tab = b.dataset.p; render(); });
    };
    render();
  },
};

Settings.load();
