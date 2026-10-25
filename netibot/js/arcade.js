// The club (מועדון): mini-games (משחקונים) in worlds of their own, alone against bots or online
// with friends. The hub lists them; each game is a module in js/arcade/<id>.js that
// registers itself with Arcade.register(). The driving commanders' race (js/race.js) is
// listed too but runs its own flow.
//
// What the arcade gives a game:
//  - the takeover: while a game is on, only it updates and draws (Game.frame);
//  - the overlay (#arcade): close button, a HUD box the game fills, a center panel, a big
//    countdown, a speech line, results with rematch;
//  - input: Arcade.input() (move + run), and game.act() on E / Space / the action button;
//  - online: invites, a lobby with a synced start, the players in grid order, a shared seed,
//    and each player's small state from their presence (game.presence() → Arcade.others()).
//
// A game module:
//  { id, name, icon, desc, cover, solo: true, online: true, minOnline: 2,
//    enter(ctx)   build the world once / reset for a new round. ctx: { solo, net, players,
//                 me, seed } — players: [{ who, name, isMe, peer }] in the same order everywhere
//    update(dt, t), render(renderer), presence() → small JSON-able object or null,
//    act(), leave() }
const Arcade = {
  games: [],
  active: null,    // the game module being played
  net: null,       // { game, id, host, startAt } when playing online
  phase: null,     // 'lobby' | 'play'
  seenInvites: new Set(),

  register(game) { if (!this.games.some(g => g.id === game.id)) this.games.push(game); },
  game(id) { return this.games.find(g => g.id === id); },

  // ---------- the hub ----------
  // Walking into the club container (E at its door): a fade, the door, and the hub inside.
  enterClub() {
    if (this.active || Race.active || G.alert || Boss.active || Story.ctl || Mini.active) { UI.toast('לא עכשיו', 'bad'); return; }
    Sound.gate();
    UI.fade(() => this.open(true));
  },
  open(club = false) {
    if (this.active || Race.active || G.alert || Boss.active || Story.ctl || Mini.active) { UI.toast('לא עכשיו', 'bad'); return; }
    G.paused = true;
    // The games' models start loading while you choose, so they're in by the time you play.
    this.loadModels(['arc_shelter', 'arc_table', 'arc_arch', 'arc_goal', 'arc_dumpster', 'arc_sandbags', 'arc_rocket', 'car_van', 'car_sufa', 'car_hummer', 'car_hilux', 'car_picanto']);
    const online = Multi.on && Multi.peers.length;
    const card = (g) => `<div class="ar-card" data-g="${g.id}">
        <img src="${g.cover}" alt="">
        <div class="ar-info"><b>${g.icon} ${g.name}</b><i>${fmt(g.desc)}</i>
          <div class="ar-tags">${g.solo ? '<span>🤖 לבד</span>' : ''}${g.online ? `<span>👥 ${g.minOnline > 2 ? g.minOnline + '+' : ''}אונליין</span>` : ''}</div>
          <div class="ar-btns">${g.solo ? `<button class="btn small" data-m="solo">▶ לשחק</button>` : ''}${g.online && online ? `<button class="btn small ${g.solo ? 'ghost' : ''}" data-m="host">👥 להזמין חברים (${Multi.peers.length})</button>` : ''}${g.online && !g.solo && !online ? '<span class="ar-need">צריך חברים מחוברים</span>' : ''}</div>
        </div></div>`;
    const race = { id: 'race', icon: '🏎️', name: 'תחרות מפקדי נסיעה', desc: 'מירוץ במדבר עם 5 מכוניות. מותר להתנגש.', cover: 'assets/race/intro.jpg', solo: true, online: true, minOnline: 2 };
    const box = this.hubBox();
    box.classList.toggle('club', !!club);
    box.innerHTML = `<div class="ar-hub"><div class="ar-head"><h2>🎮 מועדון <small>משחקונים</small></h2><p>${online ? `👥 ${Multi.peers.length} חברים מחוברים — אפשר להזמין את כולם או רק את מי שבוחרים` : 'לבד נגד הפלגה, או אונליין כשחברים מחוברים'}</p>
      <button class="icon-btn ar-close" aria-label="סגירה">✕</button></div>
      <div class="ar-grid">${[race, ...this.games].map(card).join('')}</div></div>`;
    box.querySelector('.ar-close').onclick = () => this.closeHub();
    box.querySelectorAll('.ar-card').forEach(c => c.querySelectorAll('[data-m]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      Sound.click();
      const id = c.dataset.g, mode = b.dataset.m;
      this.closeHub();
      // The race has its own car picker, which also offers racing with friends.
      if (id === 'race') { Race.open(); return; }
      if (mode !== 'host') { this.play(this.game(id), null); return; }
      const g = this.game(id);
      this.pickInvitees(`${g.icon} ${g.name}`, (to) => this.play(g, { id: Date.now(), host: true, startAt: performance.now() + 20000, to }));
    }));
  },
  // Who to invite: everyone online, or only the friends you tick. cb(null) = everyone,
  // cb([cast ids]) = just them; cancelling calls nothing. The race uses it too.
  pickInvitees(title, cb, onCancel = null) {
    const peers = Multi.peers.slice();
    if (!peers.length) { cb(null); return; }
    let box = $('#ar-pick');
    if (box) box.remove();
    box = document.createElement('div');
    box.id = 'ar-pick';
    box.className = 'ar-pick';
    box.innerHTML = `<div class="ar-pick-card"><h3>${title}</h3><p>את מי להזמין?</p>
      <div class="ar-pick-list">${peers.map(p => `<button class="ar-pick-p on" data-w="${esc(p.who)}"><i>✔</i><bdi data-raw>${esc(p.name || 'חבר')}</bdi><small>${esc(siteName(p.site) || '')}</small></button>`).join('')}</div>
      <div class="ar-row"><button class="btn" data-k="all">👥 להזמין את כולם (${peers.length})</button><button class="btn ghost" data-k="some">✉️ רק את מי שסימנתי</button></div>
      <button class="btn ghost small" data-k="no">ביטול</button></div>`;
    document.body.appendChild(box);
    const chosen = () => [...box.querySelectorAll('.ar-pick-p.on')].map(b => b.dataset.w);
    const sync = () => { const n = chosen().length; const b = box.querySelector('[data-k="some"]'); b.disabled = !n; b.textContent = n === peers.length ? '✉️ רק את מי שסימנתי' : `✉️ להזמין ${n} שסימנתי`; };
    box.querySelectorAll('.ar-pick-p').forEach(b => b.onclick = () => { Sound.click(); b.classList.toggle('on'); sync(); });
    box.querySelector('[data-k="all"]').onclick = () => { Sound.click(); box.remove(); cb(null); };
    box.querySelector('[data-k="some"]').onclick = () => { const to = chosen(); if (!to.length) return; Sound.click(); box.remove(); cb(to.length === peers.length ? null : to); };
    box.querySelector('[data-k="no"]').onclick = () => { Sound.click(); box.remove(); if (onCancel) onCancel(); };
    sync();
  },
  hubBox() {
    let b = $('#arcade-hub');
    if (!b) { b = document.createElement('div'); b.id = 'arcade-hub'; b.className = 'arcade-hub'; document.body.appendChild(b); }
    b.classList.remove('hidden');
    return b;
  },
  closeHub() { const b = $('#arcade-hub'); if (b) b.remove(); G.paused = false; },

  // ---------- entering and leaving ----------
  play(game, net = null) {
    if (!game || this.active) return;
    this.active = game;
    this.net = net ? { ...net, game: game.id } : null;
    this.ui();
    $('#hud').classList.add('hidden');
    $('#overlay').classList.add('hidden');
    this.buttons({});
    Sound.music('boss');
    if (this.net) this.lobby();
    else this.begin({ solo: true });
  },
  // Start (or restart) a round.
  begin(opts) {
    this.phase = 'play';
    this.panel('');
    const players = opts.players || [{ who: Multi.as || 'me', name: G.profile.name, isMe: true }];
    this.ctx = { solo: !!opts.solo, net: this.net, players, me: players.find(p => p.isMe), seed: this.net ? this.net.id : Date.now() };
    this.active.enter(this.ctx);
  },
  exit() {
    if (!this.active) return;
    try { this.active.leave(); } catch (e) { console.warn(e); }
    Sound.engine(null);
    Sound.stopVoice();
    this.active = null; this.net = null; this.phase = null;
    this.cdAt = null; this.cdGo = null;
    const u = $('#arcade'); if (u) u.remove();
    $('#hud').classList.remove('hidden');
    $('#overlay').classList.remove('hidden');
    this.buttons(null);
    UI.fade(() => {});
  },

  // ---------- each frame ----------
  frame(dt, t) {
    if (this.phase === 'lobby') this.updateLobby();
    else if (this.active) this.active.update(dt, t);
    if (this.cdAt) this.updateCountdown();
    // In the lobby the game hasn't built its scene and camera yet (that's enter(), when the
    // round starts): only the lobby card shows.
    if (this.active && this.phase !== 'lobby') this.active.render(Scene3D.renderer);
  },
  // Keeps a game's camera in step with the screen.
  fit(camera) {
    if (!camera) return;
    const s = Scene3D.renderer.getSize(new THREE.Vector2()), a = s.x / Math.max(1, s.y);
    if (Math.abs(camera.aspect - a) > 0.001) { camera.aspect = a; camera.fov = a < 1 ? Math.max(camera.fov, 70) : camera.fov; camera.updateProjectionMatrix(); }
  },
  act() { if (this.active && this.phase === 'play' && this.active.act) this.active.act(); },

  // ---------- input ----------
  // x: right +, y: forward +, each −1..1; run: Shift / the run button.
  input() {
    const k = G.keys, st = G.stick;
    const key = (...c) => (c.some(x => k.has(x)) ? 1 : 0);
    let x = key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA') + (st.x || 0);
    let y = key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS') - (st.y || 0);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y, run: !!(k.has('ShiftLeft') || k.has('ShiftRight') || G.touchRun), held: !!(k.has('Space') || k.has('KeyE') || G.actHeld) };
  },
  // The phone's two buttons: labels for this game (null puts the world's back).
  buttons(b) {
    const act = $('#t-act'), run = $('#t-run'), look = $('#look'), jump = $('#t-jump');
    if (jump) jump.classList.toggle('hidden', !!b); // the world's jump; games have their own buttons
    if (!b) { act.textContent = 'E'; run.textContent = 'ריצה'; look.classList.remove('hidden'); run.classList.remove('hidden'); act.classList.remove('hidden'); return; }
    act.textContent = b.act || 'E';
    run.textContent = b.run || 'ריצה';
    act.classList.toggle('hidden', b.act === false);
    run.classList.toggle('hidden', b.run === false);
    look.classList.toggle('hidden', !b.look);
  },

  // ---------- the overlay ----------
  ui() {
    let u = $('#arcade');
    if (u) u.remove();
    u = document.createElement('div');
    u.id = 'arcade';
    u.innerHTML = `<div class="ar-hud"></div><div class="ar-cd hidden"></div><div class="ar-say hidden"></div><div class="ar-panel hidden"></div>
      <button class="ar-x" title="יציאה" aria-label="יציאה מהמשחק">✕</button>`;
    document.body.appendChild(u);
    u.querySelector('.ar-x').addEventListener('click', () => this.exit());
  },
  hud(html) { const h = $('#arcade .ar-hud'); if (h && h.innerHTML !== html) h.innerHTML = html; return h; },
  panel(html) {
    const p = $('#arcade .ar-panel');
    if (!p) return null;
    p.innerHTML = html ? fmt(html) : '';
    p.classList.toggle('hidden', !html);
    return p;
  },
  // A big centered word that pops in (3, 2, 1, "!צא", "🏆").
  big(text, ms = 900) {
    const el = $('#arcade .ar-cd');
    if (!el) return;
    el.textContent = fmt(text);
    el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(this.bigT);
    if (ms) this.bigT = setTimeout(() => el.classList.add('hidden'), ms);
  },
  // A line at the bottom from someone in the cast (who: cast id) or plain.
  say(text, who = null, ms = 2600) {
    const el = $('#arcade .ar-say');
    if (!el) return;
    el.innerHTML = who ? `<b>${fmt(`{@${who}}`)}:</b> ${fmt(text)}` : fmt(text);
    el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(this.sayT);
    this.sayT = setTimeout(() => el.classList.add('hidden'), ms);
  },
  // Countdown to a moment (performance.now() time): beeps and 3-2-1, then onGo once.
  countdown(at, onGo, goText = 'צא!') {
    this.cdAt = at; this.cdGo = onGo; this.cdText = goText; this.cdLast = null;
  },
  updateCountdown() {
    const left = (this.cdAt - performance.now()) / 1000, n = Math.ceil(left);
    if (n !== this.cdLast && n <= 3) {
      this.cdLast = n;
      this.big(n > 0 ? String(n) : this.cdText, n > 0 ? 0 : 800);
      Sound.beep(n <= 0);
    }
    if (left <= 0) { const go = this.cdGo; this.cdAt = null; this.cdGo = null; if (go) go(); }
  },
  // The end of a round: rows [{ name, value, me }] best first, a prize for the local player.
  // opts: { sub, img (a picture on top, e.g. assets/arcade/win_<id>.jpg), prize }.
  results(title, rows, opts = {}) {
    const me = rows.findIndex(r => r.me);
    const prize = opts.prize != null ? opts.prize : me >= 0 ? [10, 5, 2][me] || 1 : 0;
    if (prize) { G.state.money += prize; Sound.coin(); }
    if (me === 0 && rows.length > 1) Game.achieve('arcade_win');
    this.wins = (G.state.arcadeWins = G.state.arcadeWins || {});
    if (me === 0) { this.wins[this.active.id] = true; if (this.games.every(g => this.wins[g.id])) Game.achieve('arcade_all'); }
    const medal = (i) => ['🥇', '🥈', '🥉'][i] || i + 1;
    const p = this.panel(`${opts.img ? `<img class="ar-banner" src="${opts.img}" alt="">` : ''}<h2>${title}</h2>${opts.sub ? `<p class="ar-sub">${opts.sub}</p>` : ''}
      <table class="ar-res">${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${medal(i)}</td><td><bdi data-raw>${esc(r.name)}</bdi></td><td>${r.value == null ? '' : r.value}</td></tr>`).join('')}</table>
      ${prize ? `<p class="ar-sub"><bdi dir="ltr">+${prize}₪</bdi></p>` : ''}
      <div class="ar-row">${this.net ? '' : '<button class="btn" data-m="again">🔁 עוד סיבוב</button>'}<button class="btn ghost" data-m="hub">🎮 למועדון</button><button class="btn ghost" data-m="back">↩ לבסיס</button></div>`);
    const again = p.querySelector('[data-m=again]');
    if (again) again.onclick = () => { Sound.click(); this.begin({ solo: true }); };
    p.querySelector('[data-m=hub]').onclick = () => { Sound.click(); this.exit(); setTimeout(() => this.open(), 500); };
    p.querySelector('[data-m=back]').onclick = () => { Sound.click(); this.exit(); };
  },

  // ---------- online ----------
  // A host's invite: shown once in the world, with a button that brings you into the lobby.
  watch() {
    if (this.active || Race.active || !Multi.on) return;
    this.nudge();
    if (Game.engaged() || UI.busy || $('#invite-card')) return; // busy: the invite waits
    const p = Multi.peers.find(q => q.ar && q.ar.host && q.ar.cd > 3 && !this.seenInvites.has(q.ar.id));
    if (!p) return;
    const game = this.game(p.ar.g);
    this.seenInvites.add(p.ar.id);
    if (p.ar.to && !p.ar.to.includes(Multi.as)) return; // the host invited only others
    if (!game) return;
    if (Multi.verGate(p, `מזמין ל${game.name}`)) return;
    Sound.horn();
    UI.invite(`${game.icon} הזמנה מ${p.name}: ${game.name}! מתחילים בעוד ${Math.round(p.ar.cd)} שניות`, '🎮 להצטרף', () => {
      const q = Multi.peers.find(r => r.ar && r.ar.id === p.ar.id);
      if (!q || q.ar.cd < 2) { UI.toast('המשחק כבר התחיל', 'bad'); return; }
      if (this.active || Race.active || Boss.active || G.alert) return;
      this.play(game, { id: q.ar.id, host: false, startAt: performance.now() + q.ar.cd * 1000 });
    });
  },
  // Now and then, with friends online, someone from the platoon dares you to a game against one
  // of them. The button invites everyone, like the hub does.
  nudge() {
    const now = performance.now();
    if (!Multi.peers.length) { this.nudgeAt = 0; return; }
    if (!this.nudgeAt) { this.nudgeAt = now + (240 + Math.random() * 180) * 1000; return; }
    if (now < this.nudgeAt) return;
    if (G.paused || !Game.calm() || $('#invite-card') || Multi.peers.some(p => p.ar || p.race)) { this.nudgeAt = now + 20000; return; }
    this.nudgeAt = now + (480 + Math.random() * 360) * 1000;
    const games = [...this.games.filter(g => g.online), { id: 'race', icon: '🏎️', name: 'תחרות מפקדי נסיעה' }];
    const g = games[Math.floor(Math.random() * games.length)];
    const peer = Multi.peers[Math.floor(Math.random() * Multi.peers.length)];
    const line = NUDGES[Math.floor(Math.random() * NUDGES.length)];
    const text = fmt(line).replace(/\{peer\}/g, peer.name || 'מישהו').replace(/\{g\}/g, `${g.icon} ${g.name}`);
    Sound.pop();
    UI.invite(text, '🎮 להזמין', () => {
      if (this.active || Race.active || Boss.active || G.alert) return;
      if (g.id === 'race') { Race.open(); return; }
      this.play(this.game(g.id), { id: Date.now(), host: true, startAt: performance.now() + 20000 });
    });
  },
  // The others in this game, with their latest state: [{ who, name, peer, s }].
  others() {
    if (!this.net) return [];
    return Multi.peers.filter(p => p.ar && p.ar.id === this.net.id).map(p => ({ who: p.who, name: p.name, peer: p.peer, s: p.ar.s, host: p.ar.host }));
  },
  // Everyone in grid order (by cast id, the same on every phone).
  players() {
    const all = [...this.others().map(o => ({ who: o.who, name: o.name, peer: o.peer, isMe: false })), { who: Multi.as || 'me', name: G.profile.name, isMe: true }];
    return all.sort((a, b) => (a.who < b.who ? -1 : 1));
  },
  presence() {
    if (!this.active || !this.net) return null;
    let s = null;
    try { s = this.phase === 'play' && this.active.presence ? this.active.presence() : null; } catch (e) { s = null; }
    return { g: this.active.id, id: this.net.id, host: !!this.net.host, cd: this.net.host && this.phase === 'lobby' ? Math.round((this.net.startAt - performance.now()) / 100) / 10 : 0, to: this.net.host && this.net.to ? this.net.to : null, s };
  },
  lobby() {
    this.phase = 'lobby';
    const g = this.active;
    this.panel(`<img class="ar-banner" src="${g.cover}" alt=""><h2>${g.icon} ${g.name}</h2><p class="ar-sub">${g.desc}</p><p class="ar-sub ar-wait"></p><div class="ar-who"></div>`);
  },
  updateLobby() {
    const left = Math.max(0, (this.net.startAt - performance.now()) / 1000);
    if (!this.net.host) {
      const h = this.others().find(o => o.host);
      const peer = h && Multi.peers.find(p => p.peer === h.peer);
      if (peer && peer.ar.cd > 0) this.net.startAt = performance.now() + peer.ar.cd * 1000;
    }
    const w = $('#arcade .ar-wait'), who = $('#arcade .ar-who');
    if (w) w.textContent = `מתחילים בעוד ${Math.ceil(left)} שניות — ${this.net.to ? `הזמנה נשלחה ל${this.net.to.map(id => (Multi.peers.find(q => q.who === id) || {}).name || '').filter(Boolean).join(', ')}` : 'כל מי שמחובר קיבל הזמנה'}`;
    if (who) {
      const html = this.players().map(p => `<span class="${p.isMe ? 'me' : ''}"><bdi data-raw>${esc(p.name)}</bdi></span>`).join('');
      if (who.innerHTML !== html) who.innerHTML = html;
    }
    if (left > 0.05) return;
    const players = this.players(), g = this.active;
    if (players.length < (g.minOnline || 2)) {
      if (g.solo) { UI.toast('אף אחד לא הצטרף — משחקים לבד', 'bad'); this.net = null; this.begin({ solo: true }); }
      else { UI.toast(`צריך לפחות ${g.minOnline || 2} שחקנים`, 'bad'); this.exit(); }
      return;
    }
    this.begin({ solo: false, players });
  },

  // Loads Higgsfield models (assets/models/<name>.json) the first time a game needs them;
  // then Assets.model(name, fit) gives a sized copy. Resolves even if some fail.
  loadModels(names) {
    const loader = new THREE.GLTFLoader();
    return Promise.all(names.map(name => Assets.models[name] ? null : new Promise(ok => {
      loader.load(`assets/models/${name}.json`, (g) => {
        // Shared models are marked keep, so a game's dispose() leaves them alone.
        const keep = (x) => { if (x) (x.userData = x.userData || {}).keep = true; };
        g.scene.traverse(o => { if (o.isMesh) { o.material.metalness = 0.05; o.material.roughness = 0.75; keep(o.geometry); keep(o.material); keep(o.material.map); } });
        Assets.models[name] = g.scene;
        ok();
      }, undefined, () => ok());
    })));
  },
  // A panorama image all the way around (r meters away), its bottom at y0.
  sky(scene, src, { r = 300, h = 160, y0 = -10, repeat = 2 } = {}) {
    const t = new THREE.TextureLoader().load(src);
    t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; t.repeat.set(repeat, 1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false }));
    m.position.y = y0 + h / 2;
    scene.add(m);
    return m;
  },
  texture(src, repeat = 1) {
    const t = new THREE.TextureLoader().load(src);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  },
  // Frees what a game built itself (models shared through Assets are marked keep and
  // skipped). Most games simply build their world once and keep it for the next round.
  dispose(obj) {
    obj.traverse(o => {
      if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) { if (m.userData.keep) continue; if (m.map && !(m.map.userData && m.map.userData.keep)) m.map.dispose(); m.dispose(); }
    });
  },

  // A seeded random number generator, the same sequence on every phone for one seed.
  rng(seed) {
    let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  },
  // Cast members for bots: [{ id, short }] from the platoon, shuffled.
  bots(n, rnd = Math.random) {
    const pool = ROSTER.people.filter(p => p.map === 'netivot' && p.id.startsWith('p_'));
    const out = [...pool].sort(() => rnd() - 0.5).slice(0, n);
    return out.map(p => ({ id: p.id, short: p.short, color: p.color }));
  },
  // A soldier character (the cast's own model when there is one) for a game's scene.
  soldier(scene, look) {
    const m = Scene3D.makeSoldier(look, null);
    if (m.root.parent) m.root.parent.remove(m.root);
    scene.add(m.root);
    return m;
  },
  // Plays a soldier's walk / run / idle at (x, z) meters, facing angle (radians, 0 = +x,
  // growing toward +z), at speed m/s (walking is about 4.5, running 8).
  pose(m, x, z, angle, speed, dt) {
    m.walkPh = (m.walkPh || 0) + dt * speed * 2.2;
    Scene3D.animateSoldier(m, { x: x / S3, y: z / S3, angle, speed: speed / S3, running: speed > 6, walk: m.walkPh }, speed > 0.3, dt);
  },
  // How a cast member looks (cast id), or the player (null), for Arcade.soldier().
  look(id) {
    if (!id) {
      // The player: who they play as online, otherwise the game's own boy or girl soldier.
      const P = G.profile || {}, own = `player_${P.gender === 'f' ? 'f' : 'm'}`;
      const want = ((Multi.on || (G.state && G.state.role)) && P.as) || (Assets.people[own] ? own : null);
      return { id: want, skin: P.skin, hair: P.hair, female: P.gender === 'f', head: 'beret', uniform: 0x5b6b3c };
    }
    const person = Cast.get(id) || {};
    return { id, skin: person.skin || DATA.skinTones[(id.length * 7) % 4], hair: person.hair || DATA.hairColors[(id.length * 3) % 3], head: person.head || 'none', female: !!person.female, rank: person.rank, scale: person.scale || 1 };
  },
};

// Dares from the platoon to play a friend who's online. {peer} is that friend, {g} the game.
const NUDGES = [
  '🎲 {@p_liran}: "פתחתי הימורים: את[ה/] נגד {peer} ב{g}. המפסיד שוטף כלים בחדר האוכל. אוגה בוגה!"',
  '📻 {@commander} בקשר: "{name}, יש לך עשר דקות הפסקה. ראיתי ש{peer} גם בהפסקה. ...לא ראיתי כלום. המועדון פתוח."',
  '🍫 {@p_choco}: "ספרתי את המשחקים בינך לבין {peer} ב{g}. אפס. זה אומר שעוד לא שיחקתם. ...נכון?"',
  '🏋️ {@p_shaked}: "פוצ׳! את[ה/] ו{peer}, סיבוב {g}? מי שמפסיד עושה עשרים שכיבות סמיכה. אני סופרת."',
  '🎶 {@p_shalev}: "בעזרת השם יש {g} במועדון. מי שמנצח את {peer}, אני שר לו. 🎶 שאטי לייק א מלודי... 🎶"',
  '📱 בקבוצה של הפלגה: "מי בא ל{g}? צריך עוד מישהו מול {peer} 👀"',
  '💤 {@p_nevo}: "אני הולך לישון. אבל אם את[ה/] ו{peer} משחקים {g}, תעירו אותי לגמר."',
  '🕷️ {@p_rotem}: "ספיידרמן היה מזמין את {peer} ל{g}. רק אומרת."',
];
