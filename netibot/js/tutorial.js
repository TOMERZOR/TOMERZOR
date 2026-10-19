// First time in the game (on this device): the controls one by one, each with an arrow on
// the button and something to do with it, and a practice task for E. Skippable at any step,
// and never shown again once finished or skipped (Settings has "show again").
const Tutorial = {
  active: false,
  done() { try { return localStorage.getItem('netibot.tutorial') === '1'; } catch (e) { return true; } },
  reset() { try { localStorage.removeItem('netibot.tutorial'); } catch (e) { /* ignore */ } },
  remember() { try { localStorage.setItem('netibot.tutorial', '1'); } catch (e) { /* ignore */ } },

  steps() {
    const touch = G.touch;
    return [
      { id: 'hello', text: 'ברוך הבא[/ה] לנתיבוט! 👋 הדרכה קצרה על הכפתורים — דקה וזהו. אפשר לדלג בכל רגע, בחינם.', next: true },
      touch
        ? { id: 'move', el: '#stick', text: '🕹️ <b>הג\'ויסטיק השמאלי — הליכה.</b> [גרור/גררי] אותו לכל כיוון. [נסה/נסי] ללכת כמה צעדים.', check: (s) => s.walked > 90 }
        : { id: 'move', text: '⌨️ <b>W A S D — הליכה.</b> W קדימה (לכיוון שהמצלמה מסתכלת), S אחורה, A ו־D לצדדים. [נסה/נסי] ללכת כמה צעדים.', check: (s) => s.walked > 90 },
      touch
        ? { id: 'look', el: '#look', text: '👁 <b>הג\'ויסטיק הימני — מצלמה.</b> [סובב/סובבי] אותו כדי להסתכל מסביב. אפשר גם לגרור עם האצבע על המסך.', check: (s) => s.turned > 1.2 }
        : { id: 'look', text: '🖱️ <b>גרירה עם העכבר — מצלמה.</b> [גרור/גררי] כדי להסתכל מסביב, וגלגלת לזום. גם Q ו־R מסובבים.', check: (s) => s.turned > 1.2 },
      touch
        ? { id: 'run', el: '#t-run', text: '🏃 <b>ריצה.</b> לחיצה אחת — רצים. עוד לחיצה — חוזרים ללכת. [לחץ/לחצי] עליו ו[רוץ/רוצי] קצת.', check: (s) => s.ran > 0.4 }
        : { id: 'run', text: '🏃 <b>Shift — ריצה.</b> [החזק/החזיקי] Shift בזמן שהולכים. [נסה/נסי] לרוץ קצת.', check: (s) => s.ran > 0.4 },
      { id: 'act', el: touch ? '#t-act' : '#prompt', text: `✋ <b>${touch ? 'כפתור E' : 'מקש E'} — פעולה.</b> מדברים איתו עם אנשים, מרימים דברים, פותחים ומפעילים. משימת אימון: [לך/לכי] לארגז שהחץ מראה, ו[לחץ/לחצי] E כשכתוב "להרים".`, check: (s) => s.picked, crate: true },
      { id: 'obj', el: '#objective', text: '📋 <b>פאנל המשימה.</b> מה צריך לעשות עכשיו. החץ הצהוב בתחתית מראה לאן ללכת, וכפתור ⚡ מקפיץ ישר לשם ב־2₪. משימה דחופה (כמו מארז אחרי אזעקה) מופיעה פה בכתום.', next: true },
      { id: 'map', el: '#minimap', text: '🗺️ <b>מפה.</b> לחיצה על המפה הקטנה פותחת מפה גדולה וחיה: איפה כל אחד מהפלגה, ואיפה המיגוניות (באדום).', next: true },
      { id: 'menu', el: '#btn-menu', text: '☰ <b>תפריט.</b> עוצר את המשחק. שם יש את הטלפון (משימות, הודעות, הישגים), ⚙️ הגדרות — שמע, שליטה ותצוגה — ושמירה.', next: true },
      { id: 'end', text: '🎖️ זהו, [אתה/את] [מוכן/מוכנה]! עוד דבר אחד: כשיש <b>צבע אדום</b> — 30 שניות להגיע למיגונית. בהצלחה!', next: true, last: true },
    ];
  },

  // Starts when the player is free (after the opening scenes), once per device.
  maybeStart() {
    if (this.done() || this.active) return;
    const go = () => { if (UI.busy || Mini.active || G.alert) { setTimeout(go, 400); return; } this.start(); };
    setTimeout(go, 600);
  },
  start() {
    if (!G.running) return;
    this.active = true;
    this.i = 0;
    this.list = this.steps();
    this.stat = { walked: 0, turned: 0, ran: 0, picked: false };
    this.last = { x: G.player.x, y: G.player.y, yaw: Scene3D.yaw };
    let box = $('#tut');
    if (box) box.remove();
    box = el('div', { id: 'tut', class: 'tut' }, '<div class="tut-hole"></div><div class="tut-arrow">⬇</div><div class="tut-card"></div>');
    document.body.appendChild(box);
    this.show();
    const loop = () => { if (!this.active) return; this.track(); this.place(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },
  step() { return this.list[this.i]; },
  show() {
    const st = this.step();
    const card = $('#tut .tut-card');
    card.innerHTML = `<div class="tut-n">הדרכה · ${this.i + 1}/${this.list.length}</div><div class="tut-t">${fmt(st.text)}</div>
      <div class="tut-row">${st.next ? `<button class="btn small" id="tut-next">${st.last ? 'יאללה, לשחק! ◂' : 'הבנתי ◂'}</button>` : '<span class="tut-wait">⏳ מחכה שת[עשה/עשי] את זה...</span>'}
      ${st.last ? '' : '<button class="btn small ghost" id="tut-skip">דלג על ההדרכה</button>'}</div>`;
    const nx = card.querySelector('#tut-next');
    if (nx) nx.onclick = () => { Sound.click(); this.advance(); };
    const sk = card.querySelector('#tut-skip');
    if (sk) sk.onclick = () => { Sound.click(); this.finish(true); };
    this.stat.ran = 0;
    if (st.crate) this.placeCrate();
    $('#tut').classList.toggle('free', !st.el);
  },
  advance() {
    const st = this.step();
    if (st.last) { this.finish(false); return; }
    this.i++;
    Sound.good();
    this.show();
  },
  finish(skipped) {
    this.active = false;
    cancelAnimationFrame(this.raf);
    const box = $('#tut');
    if (box) box.remove();
    this.crate = null;
    Scene3D.tutorialCrate(null);
    this.remember();
    if (skipped) UI.toast('דילגת על ההדרכה. אפשר לראות אותה שוב בהגדרות ⚙️');
    else { Game.achieve('tutorial'); Game.addScore(2, 'סיימת את ההדרכה'); }
  },

  // What the player did since the last frame.
  track() {
    const st = this.step(), P = G.player, s = this.stat;
    const now = performance.now(), dt = Math.min(0.1, (now - (this.lastT || now)) / 1000);
    this.lastT = now;
    if (!G.paused && !UI.busy) {
      s.walked += Math.hypot(P.x - this.last.x, P.y - this.last.y);
      s.turned += Math.abs(Scene3D.yaw - this.last.yaw);
      if (P.running && Math.hypot(P.x - this.last.x, P.y - this.last.y) > 0.3) s.ran += dt;
    }
    this.last = { x: P.x, y: P.y, yaw: Scene3D.yaw };
    if (st.check && st.check(s)) { st.check = null; setTimeout(() => this.advance(), 350); }
  },
  // The spotlight and the arrow follow the button, wherever the layout puts it.
  place() {
    const st = this.step();
    const hole = $('#tut .tut-hole'), arrow = $('#tut .tut-arrow'), card = $('#tut .tut-card');
    const target = st.el && document.querySelector(st.el);
    const r = target && target.offsetParent !== null ? target.getBoundingClientRect() : null;
    if (!r || !r.width) { hole.style.display = arrow.style.display = 'none'; card.style.top = '18%'; return; }
    hole.style.display = arrow.style.display = '';
    const pad = 8;
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    // Arrow above the button, or below it when the button is at the top of the screen.
    const below = r.top < innerHeight * 0.4;
    arrow.textContent = below ? '⬆' : '⬇';
    arrow.style.left = r.left + r.width / 2 - 22 + 'px';
    arrow.style.top = (below ? r.bottom + pad + 4 : r.top - pad - 56) + 'px';
    // The card sits away from the button.
    card.style.top = below ? Math.min(innerHeight - card.offsetHeight - 10, r.bottom + 70) + 'px' : Math.max(10, Math.min(innerHeight * 0.16, r.top - card.offsetHeight - 80)) + 'px';
  },

  // ---------- the practice task for E: pick up a crate a few steps away ----------
  placeCrate() {
    const P = G.player;
    for (let r = 4; r < 9; r++) {
      for (let k = 0; k < 16; k++) {
        const a = Scene3D.yaw + Math.PI + k / 16 * Math.PI * 2;
        const x = P.x - Math.sin(a) * r * TS * 0.6, y = P.y - Math.cos(a) * r * TS * 0.6;
        if (!World.blocked(x, y, 16) && World.tile(Math.floor(x / TS), Math.floor(y / TS)) !== T.FLOOR) {
          this.crate = { x, y };
          Scene3D.tutorialCrate(this.crate);
          return;
        }
      }
    }
    this.crate = { x: P.x + TS * 2, y: P.y };
    Scene3D.tutorialCrate(this.crate);
  },
  interactables(add) {
    if (!this.active || !this.crate) return;
    add(this.crate.x, this.crate.y, '📦 להרים את ארגז האימון', () => {
      this.crate = null;
      Scene3D.tutorialCrate(null);
      Scene3D.greenPuff(G.player.x, G.player.y, 1);
      UI.toast('כל הכבוד! ככה עובד E 👍', 'good');
      this.stat.picked = true;
    }, 46);
  },
  objective() {
    if (!this.crate) return { text: 'הדרכה: הכפתורים', target: null };
    return { text: 'הדרכה: להרים את ארגז האימון', target: this.crate, urgent: true, how: G.touch ? 'ללכת לארגז וללחוץ על E' : 'ללכת לארגז וללחוץ E' };
  },
};
