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
        const title = person ? `<span class="who-title">${fmtAs(person, person.title || '')}</span>` : '';
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
        <div class="ph-item">יתרון גדוד: ${G.perk ? G.perk.label : '—'}</div>`;
    } else if (this.phoneTab === 'ach') {
      body.innerHTML = DATA.achievements.map(a => {
        const got = S.achievements.includes(a.id);
        return `<div class="ph-item" style="opacity:${got ? 1 : 0.45}"><div class="t">${got ? '🏅' : '🔒'} ${a.name}</div>${a.desc}</div>`;
      }).join('');
    } else {
      body.innerHTML = `
        <div class="ph-item"><button class="btn small ghost" id="ph-mute">${Sound.muted ? '🔇 הפעל צליל' : '🔊 השתק'}</button></div>
        <div class="ph-item"><button class="btn small ghost" id="ph-save">💾 שמור עכשיו</button></div>
        <div class="ph-item"><button class="btn small ghost" id="ph-help">❓ איך משחקים</button></div>
        <div class="ph-item"><button class="btn small red" id="ph-menu">יציאה לתפריט</button></div>`;
      body.querySelector('#ph-mute').onclick = () => { Sound.setMuted(!Sound.muted); this.renderPhone(); };
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
