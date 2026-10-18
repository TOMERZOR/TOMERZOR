// DOM UI: text formatting, dialogs, cutscenes, toasts, the phone.
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, html = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  if (html) e.innerHTML = html;
  return e;
};

// The cast from js/roster.js (or the public js/roster.example.js).
const Cast = {
  byId: {},
  init() {
    for (const p of [...ROSTER.people, ROSTER.easterEgg]) this.byId[p.id] = p;
  },
  get(id) { return this.byId[id]; },
  short(id) { const p = this.byId[id]; return p ? p.short : id; },
  full(id) { const p = this.byId[id]; return p ? p.name : id; },
};

// "[מוכן/מוכנה]" picks by gender; {name} {battery} {gdud} are filled from the save;
// {@id} / {@@id} are a cast member's short / full name; {platoon} {hq} name the unit and HQ site.
function fmt(text) {
  const p = G.profile || {};
  const female = p.gender === 'f';
  return String(text)
    .replace(/\[([^\/\]]*)\/([^\]]*)\]/g, (_, m, f) => (female ? f : m))
    .replace(/\{@@(\w+)\}/g, (_, id) => Cast.full(id))
    .replace(/\{@(\w+)\}/g, (_, id) => Cast.short(id))
    .replace(/\{platoon\}/g, ROSTER.platoon)
    .replace(/\{hq\}/g, ROSTER.sites.hq)
    .replace(/\{name\}/g, p.name || 'חייל')
    .replace(/\{battery\}/g, p.batteryName || '')
    .replace(/\{gdud\}/g, p.gdudName || '');
}

// Same, plus the speaker's own {first} {short} {full}.
function fmtAs(person, text) {
  if (!person) return fmt(text);
  return fmt(String(text).replace(/\{first\}/g, person.first).replace(/\{short\}/g, person.short).replace(/\{full\}/g, person.name));
}

// For text from other players before it goes into HTML.
const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RANKS = { 1: 'סגן־משנה', 2: 'סגן', 3: 'סרן', leaf: 'רב־סרן' };

function avatarHtml(person) {
  const letter = (person.first || person.short || '?').charAt(0);
  return `<div class="avatar" style="background:${person.color || '#4b5a2a'}"><span class="av-emoji">${person.emoji || '🪖'}</span><span class="av-letter">${letter}</span></div>`;
}

// Gender/name tokens are resolved in any text added to the page, so templates
// in mini-games and screens can use them without calling fmt() themselves.
const TOKEN_RE = /\[[^\/\]]*\/[^\]]*\]|\{(name|battery|gdud|platoon|hq)\}|\{@@?\w+\}/;
function fixTokens(root) {
  if (root.nodeType === 3) { if (TOKEN_RE.test(root.nodeValue)) root.nodeValue = fmt(root.nodeValue); return; }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (TOKEN_RE.test(n.nodeValue)) hits.push(n);
  for (const n of hits) n.nodeValue = fmt(n.nodeValue);
}
new MutationObserver(muts => {
  for (const m of muts) for (const n of m.addedNodes) fixTokens(n);
}).observe(document.documentElement, { childList: true, subtree: true });

const UI = {
  busy: false, // true while a dialog or cutscene owns input

  screen(html, bg) {
    const s = $('#screen');
    s.innerHTML = html;
    s.style.backgroundImage = bg ? `url(${bg})` : '';
    s.style.backgroundColor = bg ? '' : '#11160d';
    return s;
  },
  clearScreen() { this.screen(''); },

  toast(text, kind = '') {
    const t = el('div', { class: `toast ${kind}` }, fmt(text));
    if (String(text).includes('📱')) Sound.ding();
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
  },

  prompt(text) {
    const p = $('#prompt');
    if (!text) { p.classList.add('hidden'); return; }
    const key = G.touch ? '' : '<kbd>E</kbd>';
    p.innerHTML = key + fmt(text);
    p.classList.remove('hidden');
  },

  banner(html) {
    const b = $('#alert-banner');
    if (!html) { b.classList.add('hidden'); return; }
    b.innerHTML = html;
    b.classList.remove('hidden');
  },

  objective(obj) {
    const o = $('#objective');
    if (!obj) { o.innerHTML = ''; return; }
    o.innerHTML = `<div class="obj-title">משימה</div>${fmt(obj.text)}`;
  },

  fade(cb) {
    const f = $('#fade');
    f.classList.add('on');
    setTimeout(() => { cb && cb(); setTimeout(() => f.classList.remove('on'), 80); }, 470);
  },

  // lines: [{who:'commander', text:'...', choices:[{label, value}]}]. Resolves with last choice value.
  // Conversations queue up, so an event can't open a dialog on top of another one.
  talk(lines) {
    const run = () => this.showTalk(lines);
    this.talkQueue = (this.talkQueue || Promise.resolve()).then(run, run);
    return this.talkQueue;
  },
  showTalk(lines) {
    return new Promise(resolve => {
      this.busy = true;
      const d = $('#dialog');
      let i = 0;
      let typing = null;
      let lastChoice = null;
      const show = () => {
        if (i >= lines.length) {
          d.classList.add('hidden');
          d.innerHTML = '';
          this.busy = false;
          document.removeEventListener('keydown', onKey);
          resolve(lastChoice);
          return;
        }
        const line = lines[i];
        const person = Cast.get(line.who);
        const ch = DATA.characters[line.who] || { name: line.who, icon: '💬' };
        const name = line.who === 'player' ? fmt('{name}') : person ? person.name : ch.name;
        const rank = person && person.rank ? `<span class="rank-chip">${RANKS[person.rank]}</span>` : '';
        const title = person ? `${rank}<span class="who-title">${fmtAs(person, person.title || '')}</span>` : '';
        const pic = line.who === 'player'
          ? `<div class="portrait-fallback">🪖</div>`
          : person ? avatarHtml(person) : ch.img ? `<img src="${ch.img}" alt="">` : `<div class="portrait-fallback">${ch.icon}</div>`;
        d.innerHTML = `${pic}<div class="body"><div class="who">${name} ${title}</div><div class="txt"></div>
          <div class="choices"></div><div class="hint">${line.choices ? '' : (G.touch ? 'הקש להמשך' : 'רווח / E / לחיצה להמשך')}</div></div>`;
        d.classList.remove('hidden');
        const full = fmtAs(person, line.text);
        const txt = d.querySelector('.txt');
        let n = 0;
        clearInterval(typing);
        typing = setInterval(() => {
          n += 2;
          if (n % 6 === 0) Sound.blip();
          txt.textContent = full.slice(0, n);
          if (n >= full.length) { clearInterval(typing); typing = null; showChoices(); }
        }, 18);
        function showChoices() {
          if (!line.choices) return;
          const box = d.querySelector('.choices');
          for (const c of line.choices) {
            box.appendChild(el('button', {
              class: 'btn small', onclick: (ev) => { ev.stopPropagation(); Sound.click(); lastChoice = c.value; i++; show(); },
            }, fmt(c.label)));
          }
        }
      };
      const advance = () => {
        const line = lines[i];
        if (!line) return;
        if (typing) {
          clearInterval(typing); typing = null;
          d.querySelector('.txt').textContent = fmtAs(Cast.get(line.who), line.text);
          if (line.choices) {
            const box = d.querySelector('.choices');
            if (!box.children.length) for (const c of line.choices) {
              box.appendChild(el('button', { class: 'btn small', onclick: (ev) => { ev.stopPropagation(); Sound.click(); lastChoice = c.value; i++; show(); } }, fmt(c.label)));
            }
          }
          return;
        }
        if (line.choices) return;
        Sound.click();
        i++;
        show();
      };
      const onKey = (e) => {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); advance(); }
      };
      d.onclick = advance;
      document.addEventListener('keydown', onKey);
      show();
    });
  },

  // Full-screen illustrated scene: [{img, who, text}]
  cutscene(slides) {
    return new Promise(resolve => {
      this.busy = true;
      let i = 0;
      const s = $('#screen');
      const show = () => {
        if (i >= slides.length) {
          document.removeEventListener('keydown', onKey);
          this.busy = false;
          this.clearScreen();
          resolve();
          return;
        }
        const sl = slides[i];
        const who = sl.who ? `<div class="who">${fmt(sl.who)}</div>` : '';
        s.style.backgroundImage = '';
        s.innerHTML = `<div class="cutscene">${sl.img ? `<img src="${sl.img}" alt="">` : ''}
          <div class="cap">${who}<div>${fmt(sl.text)}</div><div class="next">${i + 1}/${slides.length} ◂</div></div></div>`;
        s.querySelector('.cutscene').onclick = next;
      };
      const next = () => { Sound.click(); i++; show(); };
      const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); next(); } };
      document.addEventListener('keydown', onKey);
      show();
    });
  },

  // ---------- side menu (☰): pauses the game ----------
  menuOpen() { return !$('#side').classList.contains('hidden'); },
  toggleMenu(force) {
    const m = $('#side');
    const open = force !== undefined ? force : m.classList.contains('hidden');
    if (!open) { m.classList.add('hidden'); m.innerHTML = ''; G.paused = false; return; }
    if (this.busy || Mini.active || !G.running) return;
    if (this.mapOpen()) this.toggleMap(false);
    if (!$('#phone').classList.contains('hidden')) this.togglePhone(false);
    G.paused = true;
    G.keys.clear();
    m.classList.remove('hidden');
    m.innerHTML = `<div class="scrim"></div><div class="drawer">
      <h2>☰ תפריט</h2><div class="paused">⏸ המשחק בהפסקה</div>
      <button class="btn" data-m="resume">▶ חזרה למשחק</button>
      <button class="btn ghost" data-m="phone">📱 טלפון — משימות, הודעות, הישגים</button>
      ${Multi.on ? '<button class="btn ghost" data-m="chat">💬 הודעה לכולם</button>' : ''}
      <div class="row2"><button class="btn small ghost" data-audio="music"></button><button class="btn small ghost" data-audio="sfx"></button></div>
      <button class="btn small ghost" id="sd-style">🎶 סגנון מוזיקה: ${Sound.STYLES[Sound.style]}</button>
      <label for="sd-mvol">עוצמת מוזיקה</label><input type="range" id="sd-mvol" min="0" max="1" step="0.05" value="${Sound.prefs.musicVol}">
      <label for="sd-svol">עוצמת אפקטים</label><input type="range" id="sd-svol" min="0" max="1" step="0.05" value="${Sound.prefs.sfxVol}">
      <button class="btn ghost" data-m="help">❓ איך משחקים</button>
      <button class="btn ghost" data-m="save">💾 שמור עכשיו</button>
      <button class="btn red" data-m="exit">🚪 שמירה ויציאה לתפריט</button>
    </div>`;
    m.querySelector('.scrim').onclick = () => this.toggleMenu(false);
    m.querySelectorAll('[data-audio]').forEach(b => b.onclick = () => Game.toggleAudio(b.dataset.audio));
    m.querySelector('#sd-style').onclick = (e) => {
      const keys = Object.keys(Sound.STYLES);
      Sound.setStyle(keys[(keys.indexOf(Sound.style) + 1) % keys.length]);
      e.target.textContent = `🎶 סגנון מוזיקה: ${Sound.STYLES[Sound.style]}`;
      if (!Sound.prefs.music) Game.toggleAudio('music');
    };
    m.querySelector('#sd-mvol').oninput = (e) => Sound.setVolume('music', +e.target.value);
    m.querySelector('#sd-svol').oninput = (e) => Sound.setVolume('sfx', +e.target.value);
    Game.syncAudioButtons();
    const act = {
      resume: () => this.toggleMenu(false),
      phone: () => { this.toggleMenu(false); this.togglePhone(true); },
      map: () => { this.toggleMenu(false); this.toggleMap(true); },
      chat: () => { this.toggleMenu(false); this.chat(); },
      help: () => { this.toggleMenu(false); Game.help(true); },
      save: () => { Game.save(); this.toast('נשמר ✔', 'good'); },
      exit: () => { Game.save(); location.reload(); },
    };
    m.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { Sound.click(); act[b.dataset.m](); });
  },

  // ---------- map: where everyone is ----------
  // The world keeps running behind the map (the player just stands still), so everyone
  // on it moves live.
  mapOpen() { return !$('#map').classList.contains('hidden'); },
  toggleMap(force) {
    const m = $('#map');
    const open = force !== undefined ? force : m.classList.contains('hidden');
    if (!open) { m.classList.add('hidden'); cancelAnimationFrame(this.mapRaf); this.mapBase = null; return; }
    if (this.busy || Mini.active || !G.running || G.alert) return;
    m.classList.remove('hidden');
    G.keys.clear();
    m.innerHTML = `<canvas id="map-c"></canvas><div class="who-list"></div><button class="btn small ghost close" id="map-x">✕ סגור</button>`;
    $('#map-x').onclick = () => this.toggleMap(false);
    this.mapBase = null;
    this.mapListT = 0;
    const tick = (t) => {
      if (!this.mapOpen()) return;
      // Anything that needs the player closes the map: a conversation, a mini-game, a siren.
      if (this.busy || Mini.active || G.alert) { this.toggleMap(false); return; }
      this.drawMap(t);
      this.mapRaf = requestAnimationFrame(tick);
    };
    this.mapRaf = requestAnimationFrame(tick);
  },
  drawMap(t = 0) {
    const c = $('#map-c');
    if (!c) return;
    const [fx0, fy0, fx1, fy1] = World.fence;
    const x0 = fx0 - 1, y0 = fy0 - 1, cols = fx1 - fx0 + 3, rows = fy1 - fy0 + 5;
    const s = 22;
    if (c.width !== cols * s) { c.width = cols * s; c.height = rows * s; }
    if (!this.mapBase) {
      this.mapBase = document.createElement('canvas');
      this.mapBase.width = c.width; this.mapBase.height = c.height;
      this.drawMapBase(this.mapBase.getContext('2d'), x0, y0, cols, rows, s);
    }
    const g = c.getContext('2d');
    g.drawImage(this.mapBase, 0, 0);
    this.drawMapPeople(g, x0, y0, s);
    if (t - this.mapListT > 500) { this.mapListT = t; this.drawMapList(); }
  },
  drawMapBase(g, x0, y0, cols, rows, s) {
    const col = { [T.OUT]: World.id === 'hq' ? '#5d7a3a' : '#8f7c55', [T.SAND]: '#b9a57a', [T.WALL]: '#3c3a33', [T.FLOOR]: '#8e8c84', [T.ROAD]: '#3a3a38', [T.FENCE]: '#666', [T.PAD]: '#86847c', [T.GRASS]: '#7f9c55', [T.TRACK]: '#8f5440', [T.GATE]: '#3a3a38' };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { g.fillStyle = col[World.tile(x + x0, y + y0)]; g.fillRect(x * s, y * s, s, s); }
    g.textAlign = 'center';
    g.direction = 'rtl';
    g.font = '700 15px Rubik, Arial';
    for (const b of World.def.buildings) {
      if (b.shelter) { g.fillStyle = '#e63b2e'; g.fillRect((b.x - x0 + 1) * s, (b.y - y0 + 1) * s, s, s); continue; }
      g.fillStyle = 'rgba(0,0,0,.55)';
      const tw = g.measureText(b.name).width + 10;
      g.fillRect((b.x - x0 + b.w / 2) * s - tw / 2, (b.y - y0 + b.h / 2) * s - 11, tw, 20);
      g.fillStyle = '#f4f1e6';
      g.fillText(b.name, (b.x - x0 + b.w / 2) * s, (b.y - y0 + b.h / 2) * s + 5);
    }
  },
  drawMapPeople(g, x0, y0, s) {
    const px = (v) => (v / TS - x0) * s, py = (v) => (v / TS - y0) * s;
    g.textAlign = 'center';
    g.direction = 'rtl';
    const dot = (x, y, color, label, big) => {
      g.fillStyle = color;
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.beginPath(); g.arc(px(x), py(y), big ? 9 : 6, 0, 7); g.fill(); g.stroke();
      if (!label) return;
      g.font = `800 ${big ? 15 : 13}px Rubik, Arial`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,.85)';
      g.strokeText(label, px(x), py(y) - 11);
      g.fillStyle = '#fff';
      g.fillText(label, px(x), py(y) - 11);
    };
    for (const n of G.npcs) dot(n.x, n.y, n.person.color || '#d6dccd', n.short);
    for (const p of Multi.here()) dot(p.dx, p.dy, '#5be0ff', '🌐 ' + p.name, true);
    dot(G.player.x, G.player.y, '#f2c14e', fmt('את[ה/]'), true);
  },
  drawMapList() {
    // Who is where, across all sites.
    const where = (n) => {
      const b = World.def.buildings.find(b => n.x >= b.x * TS && n.x < (b.x + b.w) * TS && n.y >= b.y * TS && n.y < (b.y + b.h) * TS);
      return b ? b.name : 'בחוץ';
    };
    const rows2 = [];
    for (const p of Multi.peers) rows2.push(`<div class="pp"><b>🌐 ${esc(p.name)}</b><i>${fmt(ROSTER.sites[p.site] || '')}</i></div>`);
    const platoon = ROSTER.people.filter(p => p.map === 'netivot');
    const list = platoon.map(p => {
      const n = G.npcs.find(x => x.id === p.id);
      const site = n ? `${fmt(ROSTER.sites[World.id])} · ${where(n)}` : Multi.taken().has(p.id) ? 'משחק[/ת] באונליין' : fmt(ROSTER.sites[p.map]);
      return `<div class="pp"><b>${p.emoji} ${p.short}</b><i>${fmt(site)}</i></div>`;
    }).join('');
    const others = G.npcs.filter(n => !platoon.some(p => p.id === n.id)).map(n => `<div class="pp"><b>${n.person.emoji || ''} ${n.short}</b><i>${where(n)}</i></div>`).join('');
    const wl = $('#map').querySelector('.who-list');
    wl.innerHTML = `${rows2.length ? `<h3>🌐 שחקנים מחוברים</h3>${rows2.join('')}` : ''}<h3>${fmt('{platoon}')}</h3>${list}${others ? `<h3>${fmt(ROSTER.sites[World.id])}</h3>${others}` : ''}`;
  },

  // ---------- multiplayer chat ----------
  chat() {
    if (!Multi.on || $('.chat-box')) return;
    G.paused = true;
    const box = el('div', { class: 'chat-box' }, '<input type="text" maxlength="80" placeholder="מה להגיד לכולם?"><button class="btn small">שלח</button>');
    document.body.appendChild(box);
    const inp = box.querySelector('input');
    const close = () => { box.remove(); G.paused = false; };
    const send = () => { Multi.speak(inp.value); close(); };
    box.querySelector('button').onclick = send;
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); if (e.key === 'Escape') close(); };
    inp.focus();
  },

  // ---------- phone ----------
  phoneTab: 'tasks',
  togglePhone(force) {
    const p = $('#phone');
    const open = force !== undefined ? force : p.classList.contains('hidden');
    if (!open) { p.classList.add('hidden'); G.paused = false; return; }
    if (this.busy || Mini.active) return;
    G.paused = true;
    p.classList.remove('hidden');
    this.renderPhone();
  },
  renderPhone() {
    const p = $('#phone');
    const tabs = [['tasks', 'משימות'], ['msgs', 'הודעות'], ['stats', 'סטטוס'], ['ach', 'הישגים'], ['set', 'הגדרות']];
    p.innerHTML = `<div class="ph-head"><span>${clockText()}</span><span>נתיבוט</span><button class="btn small ghost" id="ph-close">✕</button></div>
      <div class="ph-tabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${this.phoneTab === k ? 'sel' : ''}">${n}</button>`).join('')}</div>
      <div class="ph-body"></div>`;
    p.querySelector('#ph-close').onclick = () => this.togglePhone(false);
    p.querySelectorAll('.ph-tabs button').forEach(b => b.onclick = () => { this.phoneTab = b.dataset.t; this.renderPhone(); });
    const body = p.querySelector('.ph-body');
    const S = G.state;
    if (this.phoneTab === 'tasks') {
      const tasks = Story.taskList();
      body.innerHTML = tasks.length
        ? tasks.map(t => `<div class="ph-item ${t.done ? 'done' : ''}"><div class="t">${t.done ? '✔' : '◻'} ${fmt(t.title)}</div>${t.desc ? fmt(t.desc) : ''}</div>`).join('')
        : '<p>אין משימות פתוחות. אפשר להסתובב בבסיס, להתאמן או לקנות משהו בש.ק.</p>';
    } else if (this.phoneTab === 'msgs') {
      const msgs = S.inbox.slice().reverse();
      body.innerHTML = msgs.length ? msgs.map(m => `<div class="ph-msg"><div class="from">${fmt(m.from)}</div>${fmt(m.text)}</div>`).join('') : '<p>אין הודעות.</p>';
    } else if (this.phoneTab === 'stats') {
      body.innerHTML = `
        <div class="ph-item"><div class="t">${fmt('{name}')}</div>${fmt('{gdud}')} · סוללת ${fmt('{battery}')}</div>
        <div class="ph-item">דרגה: <b>${rankName()}</b></div>
        <div class="ph-item">ציון פלג"צ: <b>${Math.round(S.score)}</b> / ${DATA.passScore} למעבר</div>
        <div class="ph-item">יירוטים שראית: <b>${S.stats.intercepts}</b> · אזעקות: <b>${S.stats.alerts}</b></div>
        <div class="ph-item">מארזים שהוחלפו: <b>${S.stats.reloads}</b> · רכבים בש"ג: <b>${S.stats.cars}</b></div>
        <div class="ph-item">שחורה: <b>${Math.round(S.shchora || 0)}</b>/100 · יציאה הביתה: <b>${Events.daysToHome() ? `עוד ${Events.daysToHome()} ימים` : 'היום!'}</b></div>
        <div class="ph-item">יתרון גדוד: ${G.perk ? G.perk.label : '—'}</div>`;
    } else if (this.phoneTab === 'ach') {
      body.innerHTML = DATA.achievements.map(a => {
        const got = S.achievements.includes(a.id);
        return `<div class="ph-item" style="opacity:${got ? 1 : 0.45}"><div class="t">${got ? '🏅' : '🔒'} ${a.name}</div>${a.desc}</div>`;
      }).join('');
    } else {
      body.innerHTML = `
        <div class="ph-item"><button class="btn small ghost" data-audio="music"></button>
          <label for="ph-mvol">עוצמת מוזיקה</label><input type="range" id="ph-mvol" min="0" max="1" step="0.05" value="${Sound.prefs.musicVol}"></div>
        <div class="ph-item"><button class="btn small ghost" data-audio="sfx"></button>
          <label for="ph-svol">עוצמת אפקטים</label><input type="range" id="ph-svol" min="0" max="1" step="0.05" value="${Sound.prefs.sfxVol}"></div>
        <div class="ph-item"><button class="btn small ghost" id="ph-save">💾 שמור עכשיו</button></div>
        <div class="ph-item"><button class="btn small ghost" id="ph-help">❓ איך משחקים</button></div>
        <div class="ph-item"><button class="btn small red" id="ph-menu">יציאה לתפריט</button></div>`;
      body.querySelectorAll('[data-audio]').forEach(b => b.onclick = () => Game.toggleAudio(b.dataset.audio));
      body.querySelector('#ph-mvol').oninput = (e) => Sound.setVolume('music', +e.target.value);
      body.querySelector('#ph-svol').oninput = (e) => Sound.setVolume('sfx', +e.target.value);
      Game.syncAudioButtons();
      body.querySelector('#ph-save').onclick = () => { Game.save(); this.toast('נשמר ✔', 'good'); };
      body.querySelector('#ph-help').onclick = () => { this.togglePhone(false); Game.help(true); };
      body.querySelector('#ph-menu').onclick = () => { Game.save(); location.reload(); };
    }
  },
};

function clockText(min = G.state ? G.state.clock : 0) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function rankName() {
  const S = G.state;
  if (S.graduated) return S.score >= 400 ? 'סמל' : 'רב"ט';
  return 'טוראי — פלג"צ';
}
