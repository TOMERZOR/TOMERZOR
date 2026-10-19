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
    for (const p of [...ROSTER.people, ROSTER.easterEgg, ...DATA.extras]) this.byId[p.id] = p;
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

const RANKS = { 1: 'סגן־משנה', 2: 'סגן', 3: 'סרן', leaf: 'רב־סרן', rabat: 'רב"ט', samal: 'סמל', samar: 'סמ"ר' };
// The platoon are corporals, apart from the sergeants; officers carry a rank in the roster.
const RANK_OF = { inspector: 'samal', ruth: 'samar', hamalist: 'samal' };
function rankOf(person) {
  if (!person) return null;
  if (person.rank) return person.rank;
  if (RANK_OF[person.id]) return RANK_OF[person.id];
  if (person.map === 'netivot' && ROSTER.people.includes(person)) return 'rabat';
  return null;
}
// The rank as a small insignia, like the Air Force's: navy slides with light-blue sleeve
// stripes for enlisted ranks (a silver leaf on top for staff sergeant), silver bars or a
// leaf for officers.
function rankIcon(r) {
  if (!r || !RANKS[r]) return '';
  const leaf = (cx, cy, s) => `<path transform="translate(${cx} ${cy}) scale(${s})" d="M0-7 L1.6-3.2 5.5-4.6 3.6-0.8 7 0.6 3.2 2 3.8 5.6 0.8 3.6 0 7-0.8 3.6-3.8 5.6-3.2 2-7 0.6-3.6-0.8-5.5-4.6-1.6-3.2Z" fill="#cfd5dc" stroke="#8a929c" stroke-width="0.6"/>`;
  let body;
  if (r === 'rabat' || r === 'samal' || r === 'samar') {
    const n = r === 'rabat' ? 2 : 3;
    const top = n === 2 ? 6 : 3.5;
    let stripes = '';
    for (let i = 0; i < n; i++) {
      const y = top + i * 5.5;
      stripes += `<polygon points="${9.5 - y * 0.32},${y} ${36 - y * 0.32},${y} ${35 - (y + 3.6) * 0.32},${y + 3.6} ${8.5 - (y + 3.6) * 0.32},${y + 3.6}" fill="url(#rk-s)"/>`;
    }
    body = `<polygon points="8,1 39,1 32,21 1,21" fill="#1c2a4f"/>${stripes}${r === 'samar' ? leaf(20, 11, 0.95) : ''}`;
  } else {
    const bars = { 1: 1, 2: 2, 3: 3 }[r];
    let inner = '';
    if (bars) for (let i = 0; i < bars; i++) inner += `<rect x="${20 - bars * 3.5 + i * 7 + 1}" y="5" width="5" height="12" rx="1" fill="#d5dade" stroke="#8a929c" stroke-width="0.6"/>`;
    else inner = leaf(20, 11, 1.05);
    body = `<rect x="2" y="1" width="36" height="20" rx="3" fill="#1c2a4f"/>${inner}`;
  }
  return `<svg class="rank-ico" viewBox="0 0 40 22" role="img" aria-label="${RANKS[r]}"><title>${RANKS[r]}</title><defs><pattern id="rk-s" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(-60)"><rect width="2" height="2" fill="#e8f1fb"/><rect width="1" height="2" fill="#5f9fe0"/></pattern></defs>${body}</svg>`;
}
// The rank and its name, for next to a name.
function rankBadge(r) { return r && RANKS[r] ? `<span class="rank-badge">${rankIcon(r)}<span>${RANKS[r]}</span></span>` : ''; }

function avatarHtml(person) {
  const letter = (person.first || person.short || '?').charAt(0);
  return `<div class="avatar" style="background:${person.color || '#4b5a2a'}"><span class="av-emoji">${person.emoji || '🪖'}</span><span class="av-letter">${letter}</span></div>`;
}

// A speaker's cartoon portrait: from the cast when it carries one (the real cast's travel
// inside the encrypted roster), else the public ones for the player and made-up characters.
const FACE_RE = /^(assets\/faces\/[\w-]+\.(webp|png|jpg)|data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+\/=]+)$/;
function faceUrl(who) {
  const own = (id) => { const u = (ROSTER.faces && ROSTER.faces[id]) || (DATA.faces && DATA.faces[id]); return u && FACE_RE.test(u) ? u : null; };
  if (who !== 'player') return own(who);
  // Playing as a cast member (multiplayer): their face; otherwise the generic soldier.
  return (G.profile && G.profile.as && own(G.profile.as)) || `assets/faces/player_${G.profile && G.profile.gender === 'f' ? 'f' : 'm'}.webp`;
}

// Gender/name tokens are resolved in any text added to the page, so templates
// in mini-games and screens can use them without calling fmt() themselves.
const TOKEN_RE = /\[[^\/\]]*\/[^\]]*\]|\{(name|battery|gdud|platoon|hq)\}|\{@@?\w+\}/;
// What players type (chat) sits in [data-raw] and is left as written.
const isRaw = (n) => n.parentElement && n.parentElement.closest('[data-raw]');
function fixTokens(root) {
  if (root.nodeType === 3) { if (TOKEN_RE.test(root.nodeValue) && !isRaw(root)) root.nodeValue = fmt(root.nodeValue); return; }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (TOKEN_RE.test(n.nodeValue) && !isRaw(n)) hits.push(n);
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
    const warp = obj && Story.warpTarget();
    const html = !obj ? '' : `<div class="obj-title">${obj.urgent ? '⚡ משימה דחופה' : 'משימה'}</div>${fmt(obj.text)}${obj.how ? `<div class="obj-how">👉 ${fmt(obj.how)}</div>` : ''}${obj.after ? `<div class="obj-after">אחר כך: ${fmt(obj.after)}</div>` : ''}${warp ? `<button class="warp" data-warp>⚡ להשתגר לשם · ${Story.warpPrice(warp)}₪${G.touch ? '' : ' <kbd>X</kbd>'}</button>` : ''}`;
    // Only rebuilt when it changes, so a tap on the teleport button isn't lost.
    if (html === this.objHtml) return;
    this.objHtml = html;
    o.innerHTML = html;
    o.classList.toggle('urgent', !!(obj && obj.urgent));
    if (obj && obj.urgent && !this.wasUrgent) Sound.ding && Sound.ding();
    this.wasUrgent = !!(obj && obj.urgent);
    const b = o.querySelector('[data-warp]');
    if (b) b.addEventListener('click', (e) => { e.stopPropagation(); Story.warp(); });
  },

  // A card at the top with an action button (a friend's invite); it goes away by itself.
  invite(text, label, onYes) {
    let box = $('#invite-card');
    if (box) box.remove();
    box = document.createElement('div');
    box.id = 'invite-card';
    box.className = 'invite-card';
    box.innerHTML = `<div class="ic-text">${esc(text)}</div><div class="ic-row"><button class="btn small" data-y>${esc(label)}</button><button class="btn small ghost" data-n>✕</button></div>`;
    $('#hud').appendChild(box);
    const close = () => { box.remove(); clearTimeout(timer); };
    const timer = setTimeout(close, 25000);
    box.querySelector('[data-y]').onclick = () => { close(); onYes(); };
    box.querySelector('[data-n]').onclick = close;
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
        // A cinematic scene frames whoever is speaking.
        if (this.shotFor) { const sh = this.shotFor(line); if (sh) Scene3D.setShot(sh); }
        const person = Cast.get(line.who);
        const ch = DATA.characters[line.who] || { name: line.who, icon: '💬' };
        const name = line.who === 'player' ? fmt('{name}') : person ? person.name : ch.name;
        const rank = line.who === 'player' ? rankBadge(playerRank()) : rankBadge(rankOf(person));
        const title = person ? `${rank}<span class="who-title">${fmtAs(person, person.title || '')}</span>` : '';
        const face = faceUrl(line.who);
        const pic = face ? `<img class="face" src="${face}" alt="">`
          : line.who === 'player' ? `<div class="portrait-fallback">🪖</div>`
          : person ? avatarHtml(person) : ch.img ? `<img src="${ch.img}" alt="">` : `<div class="portrait-fallback">${ch.icon}</div>`;
        d.innerHTML = `${pic}<div class="body"><div class="who">${name} ${title}</div><div class="txt"></div>
          <div class="choices"></div><div class="hint">${line.choices ? '' : (G.touch ? 'הקש להמשך' : 'רווח / E / לחיצה להמשך')}</div></div>`;
        d.classList.remove('hidden');
        d.classList.toggle('has-face', !!face);
        const full = fmtAs(person, line.text);
        const txt = d.querySelector('.txt');
        let n = 0;
        clearInterval(typing);
        typing = setInterval(() => {
          n += Settings.textStep();
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

  // Film mode: black bars top and bottom, no HUD, and the camera framing each speaker
  // (shotFor(line) returns a Scene3D shot for that line).
  cinema(on, shotFor) {
    document.body.classList.toggle('cinema', !!on);
    let bars = $('#bars');
    if (on && !bars) {
      bars = el('div', { id: 'bars', class: 'bars' }, '<i class="top"></i><i class="bot"></i>');
      document.body.appendChild(bars);
      requestAnimationFrame(() => bars.classList.add('on'));
    }
    if (!on && bars) { bars.classList.remove('on'); setTimeout(() => bars.remove(), 400); }
    this.shotFor = on ? shotFor || null : null;
    if (!on) Scene3D.setShot(null);
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
        if (sl.voice) Sound.voice(sl.voice);
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
      <div class="drawer-head"><h2>☰ תפריט</h2><button class="icon-btn" data-m="settings" aria-label="הגדרות" title="הגדרות">⚙️</button></div><div class="paused">⏸ המשחק בהפסקה</div>${Assets.peopleStatus() ? `<div class="paused">${Assets.peopleStatus()}</div>` : ''}
      <button class="btn" data-m="resume">▶ חזרה למשחק</button>
      <button class="btn ghost" data-m="phone">📱 טלפון — משימות, הודעות, הישגים</button>
      ${Multi.on ? '<button class="btn ghost" data-m="chat">💬 צ\'אט — לכולם או למישהו</button><button class="btn ghost" data-m="invite">📤 להזמין חברים (וואטסאפ)</button><button class="btn" data-m="bossInvite">🍔 להזמין את כולם לקרב בוס ביחד</button>' : ''}
      <button class="btn" data-m="arcade">🎮 מועדון — ${Arcade.games.length + 1} משחקונים${Multi.on && Multi.peers.length ? ', גם עם חברים' : ''}</button>
      <button class="btn ghost" data-m="settings">⚙️ הגדרות — שמע, שליטה, תצוגה</button>
      <button class="btn ghost" data-m="help">❓ איך משחקים</button>
      <button class="btn ghost" data-m="save">💾 שמור עכשיו</button>
      <button class="btn red" data-m="exit">🚪 שמירה ויציאה לתפריט</button>
    </div>`;
    m.querySelector('.scrim').onclick = () => this.toggleMenu(false);
    const act = {
      resume: () => this.toggleMenu(false),
      phone: () => { this.toggleMenu(false); this.togglePhone(true); },
      map: () => { this.toggleMenu(false); this.toggleMap(true); },
      chat: () => { this.toggleMenu(false); this.chat(); },
      invite: () => Game.shareInvite(),
      bossInvite: () => { this.toggleMenu(false); Boss.inviteCoop(); },
      arcade: () => { this.toggleMenu(false); Arcade.open(); },
      settings: () => { this.toggleMenu(false); Settings.open(); },
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
    m.innerHTML = `<div class="map-view" id="map-v"><canvas id="map-c"></canvas>
      <div class="map-zoom"><button class="icon-btn" data-z="1.4" aria-label="זום פנימה">＋</button><button class="icon-btn" data-z="0.7" aria-label="זום החוצה">−</button><button class="icon-btn" data-z="0" aria-label="לראות הכל">⤢</button></div></div>
      <div class="who-list"></div><button class="btn small ghost close" id="map-x">✕ סגור</button>`;
    $('#map-x').onclick = () => this.toggleMap(false);
    this.mapBase = null;
    this.mapZoomSetup();
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
    // Drawn sharper when zoomed in (up to 3x), shown at the zoom the player picked.
    const z = this.mapZ || { z: 1 };
    const s = 22 * Math.max(1, Math.min(3, Math.round(z.z * 2) / 2));
    if (c.width !== cols * s) { c.width = cols * s; c.height = rows * s; this.mapBase = null; }
    this.mapW = cols * 22; this.mapH = rows * 22;
    if (!z.ready) this.mapZoomApply();
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
  // Zoom: pinch or the mouse wheel around a point, + / − buttons, drag to move around.
  mapZoomSetup() {
    const v = $('#map-v');
    this.mapZ = { z: 1, x: 0, y: 0, ready: false };
    const pts = new Map();
    let pinch = null;
    const zoomAt = (k, px, py) => {
      const Z = this.mapZ, ds = this.mapFit() * Z.z;
      const lx = (px - Z.x) / ds, ly = (py - Z.y) / ds;
      Z.z = Math.max(1, Math.min(5, Z.z * k));
      const nd = this.mapFit() * Z.z;
      Z.x = px - lx * nd; Z.y = py - ly * nd;
      this.mapZoomApply();
    };
    v.addEventListener('wheel', (e) => { e.preventDefault(); const r = v.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    v.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      v.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    v.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const r = v.getBoundingClientRect();
      if (pts.size >= 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = d;
        return;
      }
      this.mapZ.x += e.clientX - p.x; this.mapZ.y += e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      this.mapZoomApply();
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    v.addEventListener('pointerup', up);
    v.addEventListener('pointercancel', up);
    v.querySelectorAll('[data-z]').forEach(b => b.onclick = () => {
      Sound.click();
      const k = +b.dataset.z;
      if (!k) { this.mapZ.z = 1; this.mapZ.ready = false; this.mapZoomApply(); return; }
      // Buttons zoom toward the player.
      const ds = this.mapFit() * this.mapZ.z, P = this.mapPlayerPx();
      zoomAt(k, P ? this.mapZ.x + P.x * ds : v.clientWidth / 2, P ? this.mapZ.y + P.y * ds : v.clientHeight / 2);
    });
  },
  mapFit() {
    const v = $('#map-v');
    if (!v || !this.mapW) return 1;
    return Math.min(v.clientWidth / this.mapW, v.clientHeight / this.mapH);
  },
  mapPlayerPx() {
    const [fx0, fy0] = World.fence;
    return { x: (G.player.x / TS - (fx0 - 1)) * 22, y: (G.player.y / TS - (fy0 - 1)) * 22 };
  },
  mapZoomApply() {
    const v = $('#map-v'), c = $('#map-c'), Z = this.mapZ;
    if (!v || !c || !this.mapW) return;
    const ds = this.mapFit() * Z.z, w = this.mapW * ds, h = this.mapH * ds;
    // Fitted: centred. Zoomed: the map always covers the view, no empty edges.
    if (!Z.ready || Z.z <= 1) { Z.x = (v.clientWidth - w) / 2; Z.y = (v.clientHeight - h) / 2; Z.ready = true; }
    if (w > v.clientWidth) Z.x = Math.min(0, Math.max(v.clientWidth - w, Z.x)); else Z.x = (v.clientWidth - w) / 2;
    if (h > v.clientHeight) Z.y = Math.min(0, Math.max(v.clientHeight - h, Z.y)); else Z.y = (v.clientHeight - h) / 2;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c.style.transform = `translate(${Z.x}px, ${Z.y}px)`;
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
    // The bus stop and the race, by the gate.
    const [tx, ty] = DATA.travelStop;
    for (const [x, y, label, bg] of [[tx + 0.6, ty - 0.6, '🚌 הסעות', 'rgba(30,90,140,.9)'], [tx + 0.6, ty - 3.4, '🎮 מועדון', 'rgba(110,40,180,.92)']]) {
      const w = g.measureText(label).width + 12, cx = (x - x0) * s, cy = (y - y0) * s;
      g.fillStyle = bg; g.fillRect(cx - w / 2, cy - 11, w, 20);
      g.fillStyle = '#fff'; g.fillText(label, cx, cy + 5);
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
    for (const p of Multi.peers) rows2.push(`<div class="pp pp-chat" data-chat="${esc(p.who)}"><b>🌐 ${esc(p.name)} 💬</b><i>${fmt(ROSTER.sites[p.site] || '')}</i></div>`);
    const platoon = ROSTER.people.filter(p => p.map === 'netivot');
    const list = platoon.map(p => {
      const n = G.npcs.find(x => x.id === p.id);
      const site = n ? `${fmt(ROSTER.sites[World.id])} · ${where(n)}` : Multi.taken().has(p.id) ? 'משחק[/ת] באונליין' : fmt(ROSTER.sites[p.map]);
      return `<div class="pp"><b>${rankIcon(rankOf(p))} ${p.emoji} ${p.short}</b><i>${fmt(site)}</i></div>`;
    }).join('');
    const others = G.npcs.filter(n => !platoon.some(p => p.id === n.id)).map(n => `<div class="pp"><b>${n.person.emoji || ''} ${n.short}</b><i>${where(n)}</i></div>`).join('');
    const wl = $('#map').querySelector('.who-list');
    wl.onclick = (e) => { const r = e.target.closest('[data-chat]'); if (r) { this.toggleMap(false); this.chat(r.dataset.chat); } };
    wl.innerHTML = `${rows2.length ? `<h3>🌐 שחקנים מחוברים</h3>${rows2.join('')}` : ''}<h3>${fmt('{platoon}')}</h3>${list}${others ? `<h3>${fmt(ROSTER.sites[World.id])}</h3>${others}` : ''}`;
  },

  // ---------- multiplayer chat ----------
  // A side panel: the conversation, who to send to (everyone or one player), and a box.
  chatTo: '',
  chatOpen() { return !!$('#chatp'); },
  chat(to) {
    if (!Multi.on) return;
    if (to !== undefined) this.chatTo = to;
    if (this.chatOpen()) { this.chatRefresh(); $('#chatp input').focus(); return; }
    const box = el('div', { id: 'chatp', class: 'chatp' }, `<div class="cp-head"><b>💬 צ'אט</b><button class="icon-btn small" id="cp-x" aria-label="סגירה">✕</button></div>
      <div class="cp-log"></div><div class="cp-to"></div>
      <div class="cp-row"><input type="text" maxlength="160" placeholder="מה לכתוב?"><button class="btn small" id="cp-send">שלח</button></div>`);
    document.body.appendChild(box);
    const inp = box.querySelector('input');
    const send = () => { const v = inp.value; if (!v.trim()) return; inp.value = ''; Multi.send(v, this.chatTo); };
    box.querySelector('#cp-send').onclick = send;
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); if (e.key === 'Escape') this.closeChat(); };
    box.querySelector('#cp-x').onclick = () => this.closeChat();
    Multi.unread = 0;
    this.chatRefresh();
    if (!G.touch) inp.focus();
  },
  closeChat() { const b = $('#chatp'); if (b) b.remove(); G.keys.clear(); this.chatRefresh(); },
  chatRefresh() {
    const btn = $('#btn-chat');
    if (btn) {
      btn.classList.toggle('hidden', !Multi.on);
      btn.innerHTML = '💬' + (Multi.unread && !this.chatOpen() ? `<i class="badge">${Math.min(9, Multi.unread)}</i>` : '');
    }
    const box = $('#chatp');
    if (!box) return;
    Multi.unread = 0;
    // The person picked earlier may have left.
    if (this.chatTo && !Multi.peers.some(p => p.who === this.chatTo)) this.chatTo = '';
    const to = box.querySelector('.cp-to');
    const opts = [['', '👥 כולם'], ...Multi.peers.map(p => [p.who, p.name])];
    const key = opts.map(o => o.join(':')).join() + '|' + this.chatTo;
    if (to.dataset.k !== key) {
      to.dataset.k = key;
      to.innerHTML = `<span>אל:</span>${opts.map(([id, n]) => `<button data-to="${esc(id)}" class="${this.chatTo === id ? 'sel' : ''}">${id ? '🔒 ' : ''}${esc(n)}</button>`).join('')}`;
      to.querySelectorAll('[data-to]').forEach(b => b.onclick = () => { this.chatTo = b.dataset.to; this.chatRefresh(); box.querySelector('input').focus(); });
    }
    const nameOf = (id) => { const p = Multi.peers.find(q => q.who === id); return p ? p.name : (Cast.get(id) || {}).short || id; };
    const log = box.querySelector('.cp-log');
    log.innerHTML = Multi.chatLog.length ? Multi.chatLog.map(m => `<div class="cp-msg ${m.mine ? 'mine' : ''} ${m.to ? 'dm' : ''}">
      <div class="cp-who">${m.mine ? fmt('את[ה/]') : `<span data-raw>${esc(m.name)}</span>`}${m.to ? (m.mine ? ` ← 🔒 ${esc(nameOf(m.to))}` : ' ← 🔒 רק אליך') : ''} · ${clockText(new Date(m.at).getHours() * 60 + new Date(m.at).getMinutes())}</div><span data-raw>${esc(m.text)}</span></div>`).join('')
      : fmt('<p class="cp-empty">עוד אין הודעות. [בחר/בחרי] למי לכתוב — לכולם או לשחקן מסוים (🔒 רק הוא יראה).</p>');
    log.scrollTop = log.scrollHeight;
    box.querySelector('input').placeholder = this.chatTo ? `הודעה פרטית ל${nameOf(this.chatTo)}...` : 'הודעה לכולם...';
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
        <div class="ph-item">דרגה: ${rankBadge(playerRank())}</div>
        <div class="ph-item">ציון פלג"צ: <b>${Math.round(S.score)}</b> / ${DATA.passScore} למעבר</div>
        <div class="ph-item">יירוטים שראית: <b>${S.stats.intercepts}</b> · אזעקות: <b>${S.stats.alerts}</b></div>
        <div class="ph-item">מארזים שהוחלפו: <b>${S.stats.reloads}</b> · רכבים בש"ג: <b>${S.stats.cars}</b> · סקרנים שהורחקו: <b>${S.stats.curiousOk || 0}</b></div>
        <div class="ph-item">שחורה: <b>${Math.round(S.shchora || 0)}</b>/100 · יציאה הביתה: <b>${Events.daysToHome() ? `עוד ${Events.daysToHome()} ימים` : 'היום!'}</b></div>
        <div class="ph-item">יתרון גדוד: ${G.perk ? G.perk.label : '—'}</div>`;
    } else if (this.phoneTab === 'ach') {
      body.innerHTML = DATA.achievements.map(a => {
        const got = S.achievements.includes(a.id);
        return `<div class="ph-item" style="opacity:${got ? 1 : 0.45}"><div class="t">${got ? '🏅' : '🔒'} ${a.name}</div>${a.desc}</div>`;
      }).join('');
    } else {
      body.innerHTML = `
        <div class="ph-item"><button class="btn small ghost" id="ph-set">⚙️ כל ההגדרות — שמע, שליטה, תצוגה</button></div>
        <div class="ph-item"><button class="btn small ghost" id="ph-save">💾 שמור עכשיו</button></div>
        <div class="ph-item"><button class="btn small ghost" id="ph-help">❓ איך משחקים</button></div>
        <div class="ph-item"><button class="btn small red" id="ph-menu">יציאה לתפריט</button></div>`;
      body.querySelector('#ph-set').onclick = () => { this.togglePhone(false); Settings.open(); };
      body.querySelector('#ph-save').onclick = () => { Game.save(); this.toast('נשמר ✔', 'good'); };
      body.querySelector('#ph-help').onclick = () => { this.togglePhone(false); Game.help(true); };
      body.querySelector('#ph-menu').onclick = () => { Game.save(); location.reload(); };
    }
  },
};

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function clockText(min = G.state ? G.state.clock : 0) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// The player's own rank: a cast member's when playing as one; otherwise it grows with the
// game: corporal in the young platoon, sergeant after passing it, staff sergeant a week on.
function playerRank() {
  const p = G.profile || {};
  if (p.as && Cast.get(p.as)) return rankOf(Cast.get(p.as)) || 'rabat';
  return (G.state && G.state.rank) || 'rabat';
}
function rankName() { return RANKS[playerRank()]; }
