// Online play: a room of up to four, everyone simulating their own player and telling the
// others where they are. Heist missions run on the host; their cast is mirrored to the crew.
import { Actor } from '../game/character.js';
import { HEISTS, heistMissions } from '../game/heists.js';
import { VEHICLES } from '../game/defs.js';
import { POI, groundY } from '../world/map.js';
import { el, fmtMoney, dampAngle, clamp } from '../core/util.js';
import { NET } from './config.js';

const PROFILE_KEY = 'shchunaD.online.v1';
const COLORS = [0xffffff, 0xffb070, 0x9ad0ff, 0xb8f0a0];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function wsBase() {
  const h = location.hostname;
  const own = h.endsWith('.workers.dev') || h.endsWith('higgsfield.app') || location.port === '8787';
  const q = new URLSearchParams(location.search).get('server');
  const base = q || (own ? location.origin : NET.server);
  return base.replace(/^http/, 'ws').replace(/\/$/, '');
}

export class Online {
  constructor(game) {
    this.game = game; this.active = false; this.ws = null;
    this.peers = new Map(); this.room = ''; this.hostId = ''; this.isHost = false;
    this.plan = {}; this.sendT = 0; this.entT = 0; this.objT = 0;
    this.ghosts = new Map(); this.ghostCars = new Map();       // mission cast mirrored from the host
    this.remoteObj = null; this.eidSeq = 1; this.status = '';
    const p = game.readJSON(PROFILE_KEY) || {};
    this.profile = { id: p.id || Math.random().toString(36).slice(2, 12), name: p.name || '', money: p.money || 500, done: p.done || 0 };
    game.missions.register(heistMissions(this), null);
    game.bus.on('missionEnd', (m, result) => { if (m.online && this.isHost) this.onMissionEnd(m, result); });
    game.bus.on('wanted', (lvl) => { if (this.active && this.isHost && game.missions.active) this.event({ k: 'want', lvl }); });
    game.bus.on('money', () => { if (this.active) { this.profile.money = game.player.money; this.saveProfile(); } });
  }
  saveProfile() { this.game.writeJSON(PROFILE_KEY, this.profile); }

  // ---- lobby ---------------------------------------------------------------------------
  lobby(msg) {
    const g = this.game, p = g.menu.panel; if (!p) return;
    p.innerHTML = `<h3>אונליין</h3>
      <p class="lead">עד ארבעה שחקנים בעיר אחת. המארח בוחר שוד, כולם עושים הכנות, ואז יוצאים לדבר האמיתי. הכסף מתחלק שווה בשווה.</p>
      <div class="row" style="border:0;padding-bottom:.2rem"><span>איך קוראים לך ברחוב</span></div>
      <input class="field" id="on-name" maxlength="14" placeholder="כינוי" value="${this.profile.name.replace(/"/g, '')}">
      <div class="grid2" style="margin-top:1rem">
        <div><button class="btn" id="on-create" style="width:100%;justify-content:center">פתח חדר</button></div>
        <div style="display:flex;gap:.5rem"><input class="field" id="on-code" maxlength="5" placeholder="קוד" style="direction:ltr;text-transform:uppercase;letter-spacing:.2em;text-align:center"><button class="btn ghost" id="on-join">הצטרף</button></div>
      </div>
      <p class="lead" id="on-msg" style="margin-top:1rem;font-size:.9rem;color:var(--amber)">${msg || ''}</p>
      <dl class="kv" style="margin-top:1rem"><dt>הארנק שלך באונליין</dt><dd class="num">${fmtMoney(this.profile.money)}</dd><dt>שודים שהושלמו</dt><dd class="num">${this.profile.done}</dd></dl>`;
    const name = () => { const n = p.querySelector('#on-name').value.trim() || 'אורח ' + this.profile.id.slice(0, 3); this.profile.name = n; this.saveProfile(); return n; };
    p.querySelector('#on-create').onclick = () => { let c = ''; for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; this.connect(c, name()); };
    p.querySelector('#on-join').onclick = () => { const c = p.querySelector('#on-code').value.trim().toUpperCase(); if (c.length < 3) { p.querySelector('#on-msg').textContent = 'צריך קוד חדר'; return; } this.connect(c, name()); };
  }

  connect(room, name) {
    const g = this.game, msgEl = document.getElementById('on-msg');
    if (msgEl) msgEl.textContent = 'מתחבר לחדר ' + room + '…';
    this.leave(true);
    let ws;
    try { ws = new WebSocket(wsBase() + '/ws/' + room); } catch (e) { this.lobby('אין חיבור לשרת'); return; }
    this.ws = ws; this.room = room; let opened = false;
    ws.onopen = () => { opened = true; ws.send(JSON.stringify({ t: 'join', id: this.profile.id, name })); this.pingT = setInterval(() => { if (ws.readyState === 1) ws.send('__ping'); }, 20000); };
    ws.onmessage = (ev) => { if (ev.data === '__pong') return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.onMessage(m); };
    ws.onclose = (ev) => {
      clearInterval(this.pingT);
      if (this.ws !== ws) return;
      const was = this.active; this.ws = null; this.cleanupWorld(); this.active = false;
      if (was) { g.ui.notify('החיבור לחדר נותק', 'bad'); g.toMenu(); setTimeout(() => this.lobby('החיבור נותק'), 50); }
      else if (g.menu.panel) this.lobby(ev.code === 1006 && !opened ? 'לא הצלחתי להתחבר. בדוק חיבור לאינטרנט.' : 'החדר מלא או לא זמין');
    };
    ws.onerror = () => {};
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  event(o) { o.t = 'e'; this.send(o); }

  onMessage(m) {
    const g = this.game;
    switch (m.t) {
      case 'hello':
        this.hostId = m.host; this.isHost = m.host === this.profile.id; this.plan = m.plan || {};
        for (const p of m.peers) this.addPeer(p.id, p.name);
        this.enterWorld();
        break;
      case 'peer':
        if (m.left) { this.removePeer(m.id); } else { this.addPeer(m.id, m.name); g.ui.notify(m.name + ' נכנס לחדר', 'ok'); }
        break;
      case 'host':
        this.hostId = m.id; { const was = this.isHost; this.isHost = m.id === this.profile.id; if (this.isHost && !was) { g.ui.notify('אתה המארח עכשיו', ''); this.clearGhosts(); this.remoteObj = null; g.ui.objective(''); } }
        break;
      case 'plan': this.plan = m.plan || {}; if (g.menu.kind === 'pause' && this.boardOpen) this.board(); break;
      case 's': { const p = this.peers.get(m.id); if (p) this.onSnapshot(p, m); break; }
      case 'e': this.onEvent(m); break;
      default: break;
    }
  }

  // ---- crew ------------------------------------------------------------------------------
  addPeer(id, name) {
    if (this.peers.has(id) || id === this.profile.id) return;
    const g = this.game, n = this.peers.size;
    const a = new Actor(g, 'hero', { tint: COLORS[(n + 1) % COLORS.length], hp: 100 });
    a.remote = true; a.faction = 'player'; a.peerId = id; a.label = name;
    a.onRemoteHit = (dmg, heavy, dx, dz) => this.event({ k: 'dmg', to: id, dmg: Math.round(dmg), heavy: heavy ? 1 : 0, dx: +dx.toFixed(2), dz: +dz.toFixed(2) });
    const s = POI.plaza || { x: 0, z: 0 };
    a.place(s.x, s.z, 0); a.root.visible = false;
    g.world.addActor(a);
    const p = { id, name, actor: a, x: s.x, z: s.z, tx: s.x, tz: s.z, th: 0, anim: 'idle', seen: false, veh: null, vinfo: null };
    p.track = g.ui.track(() => (p.seen ? { x: a.pos.x, y: a.pos.y, z: a.pos.z, h: 2.15 } : null), name, 'ally', false);
    this.peers.set(id, p);
  }
  removePeer(id) {
    const p = this.peers.get(id); if (!p) return;
    const g = this.game;
    g.ui.untrack(p.track); g.ui.notify(p.name + ' עזב', '');
    if (p.veh) { g.world.removeVehicle(p.veh); p.veh = null; }
    for (const v of g.world.vehicles) if (v.remoteDriver === id) { v.remoteDriver = null; v.wake(); }
    g.world.removeActor(p.actor); this.peers.delete(id);
  }
  crewPositions() { const out = [this.game.player.pos]; for (const p of this.peers.values()) if (p.seen) out.push(p.actor.pos); return out; }
  crewActors() { const out = [this.game.player.actor]; for (const p of this.peers.values()) if (p.seen && !p.vinfo) out.push(p.actor); return out; }

  onSnapshot(p, m) {
    p.tx = m.x; p.tz = m.z; p.th = m.h; p.anim = m.a || 'idle'; p.vinfo = m.v || null; p.ko = !!m.ko;
    if (!p.seen) { p.seen = true; p.actor.place(m.x, m.z, m.h); p.actor.root.visible = true; }
  }

  // ---- world -----------------------------------------------------------------------------
  enterWorld() {
    const g = this.game;
    g.resetWorld(); g.mode = 'online'; this.active = true;
    g.player.money = this.profile.money;
    const s = POI.plaza || { x: 0, z: 0 }, k = this.peers.size;
    g.player.actor.place(s.x + (k % 2 ? 3 : -3) * (1 + (k >> 1)), s.z + 3, 0); g.cam.snap(Math.PI);
    g.sky.setHour(17.2);
    g.enterPlay(); g.missions.refreshStarts();
    g.ui.card('אונליין', 'חדר ' + this.room, this.isHost ? 'אתה המארח. פתח את התפריט ← לוח שודים כדי לבחור עבודה.' : 'תן את הקוד לחברים. המארח בוחר את השוד.', 5200);
    g.ui.notify('קוד החדר: ' + this.room, 'ok', 'אונליין');
  }
  cleanupWorld() {
    for (const id of [...this.peers.keys()]) { const p = this.peers.get(id); this.game.ui.untrack(p.track); if (p.veh) this.game.world.removeVehicle(p.veh); this.game.world.removeActor(p.actor); }
    this.peers.clear(); this.clearGhosts(); this.remoteObj = null;
  }
  leave(quiet) {
    clearInterval(this.pingT);
    if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(1000); } catch (e) { /* closed */ } }
    if (this.active || !quiet) this.cleanupWorld();
    this.active = false; this.room = ''; this.plan = {};
  }
  onDown() { const s = POI.plaza; if (s) this.game.player.actor.place(s.x, s.z + 4, 0); }

  // ---- mission mirror (host -> crew) -------------------------------------------------------
  tag(obj) { if (this.active && this.isHost) obj.eid = this.eidSeq++; return obj; }
  clearGhosts() {
    const w = this.game.world;
    for (const a of this.ghosts.values()) { this.game.ui.untrack(a.track); w.removeActor(a); }
    for (const v of this.ghostCars.values()) { if (this.game.player.vehicle === v) this.game.player.leaveVehicle(true); w.removeVehicle(v); }
    this.ghosts.clear(); this.ghostCars.clear();
  }
  onEvent(m) {
    const g = this.game, pl = g.player;
    switch (m.k) {
      case 'ents': this.applyEnts(m); break;
      case 'obj': this.remoteObj = m; break;
      case 'hit': {                       // a crew member punched one of the host's mission actors
        if (!this.isHost) break;
        const a = g.world.actors.find((o) => o.eid === m.eid); const by = this.peers.get(m.id);
        if (a && by) a.takeHit(m.dmg, by.actor, m.dx, m.dz, !!m.heavy, m.heavy ? 5 : 2);
        break;
      }
      case 'dmg': if (m.to === this.profile.id) pl.actor.takeHit(m.dmg, null, m.dx, m.dz, !!m.heavy, m.heavy ? 5 : 2); break;
      case 'want': if (!this.isHost) { if (m.lvl > 0) g.wanted.set(m.lvl); else g.wanted.clear(); } break;
      case 'pay': pl.addMoney(m.amount, 'heist'); this.profile.done += m.done ? 1 : 0; this.saveProfile(); g.audio.jingle('pass'); g.ui.banner('', m.title, m.sub || '', { reward: m.amount, hold: 3600 }); break;
      case 'end': this.clearGhosts(); this.remoteObj = null; g.ui.objective(''); if (m.result !== 'pass') { g.audio.jingle('fail'); g.ui.banner('bad', 'העבודה נכשלה', m.reason || '', { hold: 2800 }); } break;
      case 'note': g.ui.notify(m.text, m.kind || ''); break;
      case 'say': g.ui.subtitle(m.who, m.text, m.color); break;
      default: break;
    }
  }
  applyEnts(m) {
    if (this.isHost) return;
    const g = this.game, w = g.world, seenA = new Set(), seenV = new Set();
    for (const e of m.l || []) {
      const [eid, kind, x, z, h, anim, ko, foe] = e; seenA.add(eid);
      let a = this.ghosts.get(eid);
      if (!a) {
        a = w.spawnPed(kind, x, z, h, { keep: true }); if (!a) continue;
        a.ai = null; a.remote = true; a.eid = eid; a.gx = x; a.gz = z; a.gh = h;
        a.onRemoteHit = (dmg, heavy, dx, dz) => { this.event({ k: 'hit', eid, dmg: Math.round(dmg), heavy: heavy ? 1 : 0, dx: +dx.toFixed(2), dz: +dz.toFixed(2) }); };
        if (foe) a.track = g.ui.track(() => (a.ko ? null : a.pos), '', 'foe');
        this.ghosts.set(eid, a);
      }
      a.gx = x; a.gz = z; a.gh = h; a.ganim = anim; a.ko = !!ko;
    }
    for (const [eid, a] of this.ghosts) if (!seenA.has(eid)) { g.ui.untrack(a.track); w.removeActor(a); this.ghosts.delete(eid); }
    for (const e of m.v || []) {
      const [eid, type, x, z, yaw, tint, wreck] = e; seenV.add(eid);
      let v = this.ghostCars.get(eid);
      if (!v) { v = w.spawnVehicle(type, x, z, yaw, { parked: true, tint }); v.keep = true; v.eid = eid; v.tagFree = true; v.ghost = true; this.ghostCars.set(eid, v); }
      if (g.player.vehicle === v) continue;                 // we are driving it: we are the authority
      v.gx = x; v.gz = z; v.gyaw = yaw; v.wreck = !!wreck; v.sleep = true;
    }
    for (const [eid, v] of this.ghostCars) if (!seenV.has(eid)) { if (g.player.vehicle === v) g.player.leaveVehicle(true); w.removeVehicle(v); this.ghostCars.delete(eid); }
  }
  onMissionEnd(m, result) {
    this.event({ k: 'end', result, reason: '' });
    if (result === 'pass') {
      const h = m.heist, patch = {};
      if (m.prepKey) { patch.preps = Object.assign({}, this.plan.preps || {}, { [h.id + ':' + m.prepKey]: true }); }
      else { const n = this.peers.size + 1, share = Math.round(h.take / n); this.event({ k: 'pay', amount: share, title: h.title, sub: `חלק שווה: ${n} שותפים`, done: 1 }); this.game.player.addMoney(share, 'heist'); this.profile.done++; this.saveProfile(); patch.preps = {}; patch.heist = null; this.game.ui.banner('', h.title, `חלק שווה: ${n} שותפים`, { reward: share, hold: 3600 }); }
      patch.run = null; this.send({ t: 'plan', patch });
    } else this.send({ t: 'plan', patch: { run: null } });
  }

  // ---- the heist board (in the pause menu) ----------------------------------------------------
  board() {
    const g = this.game, p = g.menu.panel; if (!p) return;
    this.boardOpen = true;
    const host = this.isHost, plan = this.plan, preps = plan.preps || {};
    p.innerHTML = `<h3>לוח שודים</h3><p class="lead" style="font-size:.9rem">${host ? 'בחר עבודה. כל הכנה היא משימה קצרה; אחרי כולן אפשר לצאת לשוד עצמו.' : 'המארח בוחר ומתחיל. אתה רואה כאן את התוכנית.'} חדר <b class="num">${this.room}</b> · ${this.peers.size + 1} בחדר</p>`;
    const cur = HEISTS.find((h) => h.id === plan.heist);
    if (!cur) {
      const grid = el('div', 'grid2'); p.appendChild(grid);
      for (const h of HEISTS) {
        const c = el('button', 'heist', `<h4>${h.title}</h4><p>${h.blurb}</p><p class="take num">${fmtMoney(h.take)}</p>`);
        if (!host) c.setAttribute('disabled', '');
        c.onclick = () => { g.audio.click(); this.send({ t: 'plan', patch: { heist: h.id, preps: {} } }); };
        grid.appendChild(c);
      }
      return;
    }
    const box = el('div', 'heist sel', `<h4>${cur.title}</h4><p>${cur.blurb}</p><p class="take num">${fmtMoney(cur.take)} · ${fmtMoney(Math.round(cur.take / (this.peers.size + 1)))} לכל אחד</p>`); p.appendChild(box);
    const list = el('div', 'preps'); p.appendChild(list);
    let all = true; const busy = !!g.missions.active || !!plan.run;
    for (const pr of cur.preps) {
      const done = !!preps[cur.id + ':' + pr.key]; if (!done) all = false;
      const row = el('div', 'prep' + (done ? ' done' : ''), `<i></i><span style="flex:1">${pr.title}</span>`);
      if (!done && host) { const b = el('button', 'chip', 'התחל'); if (busy) b.setAttribute('disabled', ''); b.onclick = () => this.launch(cur, pr.key); row.appendChild(b); }
      list.appendChild(row);
    }
    const row = el('div'); row.style.cssText = 'display:flex;gap:.7rem;margin-top:.6rem'; p.appendChild(row);
    if (host) {
      const go = el('button', 'btn', 'צא לשוד'); if (!all || busy) go.setAttribute('disabled', ''); go.onclick = () => this.launch(cur, null); row.appendChild(go);
      const back = el('button', 'btn ghost', 'החלף עבודה'); if (busy) back.setAttribute('disabled', ''); back.onclick = () => this.send({ t: 'plan', patch: { heist: null, preps: {} } }); row.appendChild(back);
    }
    if (plan.run) p.appendChild(el('div', 'lead', 'עבודה בתהליך: ' + plan.run)).style.cssText = 'margin-top:.8rem;color:var(--amber)';
  }
  launch(h, prepKey) {
    const g = this.game, id = 'h:' + h.id + ':' + (prepKey || 'finale'), m = g.missions.byId[id];
    if (!m || g.missions.active) return;
    this.send({ t: 'plan', patch: { run: m.title } });
    g.menu.resume();
    this.event({ k: 'note', text: 'המארח התחיל: ' + m.title, kind: 'ok' });
    g.missions.start(m, { quiet: false });
  }

  // ---- per frame ---------------------------------------------------------------------------
  update(dt) {
    if (!this.active) return;
    const g = this.game, pl = g.player, a = pl.actor, w = g.world;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.1;
      const v = pl.vehicle;
      this.send({ t: 's', x: +a.pos.x.toFixed(2), z: +a.pos.z.toFixed(2), h: +a.heading.toFixed(2), a: a.curName, ko: a.ko ? 1 : 0,
        v: v ? { ty: v.type, x: +v.pos.x.toFixed(2), z: +v.pos.z.toFixed(2), y: +v.yaw.toFixed(3), tn: v.mat ? v.mat.color.getHex() : 0xffffff, e: v.eid || 0 } : 0 });
    }
    // crew members move towards their last reported position
    const k = 1 - Math.exp(-12 * dt);
    for (const p of this.peers.values()) {
      if (!p.seen) continue;
      const ac = p.actor, vi = p.vinfo;
      ac.pos.x += (p.tx - ac.pos.x) * k; ac.pos.z += (p.tz - ac.pos.z) * k; ac.pos.y = groundY(ac.pos.x, ac.pos.z);
      ac.heading = dampAngle(ac.heading, p.th, 12, dt); ac.root.rotation.y = ac.heading;
      ac.ko = !!p.ko;
      if (ac.curName !== p.anim) ac.play(p.anim, 0.15, { once: p.anim === 'knockdown' || p.anim === 'jab' || p.anim === 'hook' || p.anim === 'kick' || p.anim === 'hit', speed: p.anim === 'jab' ? 2.9 : p.anim === 'kick' ? 3 : p.anim === 'hook' ? 1.7 : 1 });
      // the car they are in
      if (vi) {
        let veh = vi.e ? (this.isHost ? w.vehicles.find((o) => o.eid === vi.e) : this.ghostCars.get(vi.e)) : p.veh;
        if (!veh && !vi.e && VEHICLES[vi.ty]) { veh = p.veh = w.spawnVehicle(vi.ty, vi.x, vi.z, vi.y, { parked: true, tint: vi.tn }); veh.keep = true; veh.locked = true; }
        if (veh && pl.vehicle !== veh) {
          if (vi.e) veh.remoteDriver = p.id;
          veh.sleep = true; veh.pos.x += (vi.x - veh.pos.x) * k; veh.pos.z += (vi.z - veh.pos.z) * k; veh.pos.y = groundY(veh.pos.x, veh.pos.z);
          veh.yaw = dampAngle(veh.yaw, vi.y, 12, dt); veh.root.rotation.y = veh.yaw;
        }
        ac.root.visible = !!(veh && veh.def.bike);
        if (!vi.e && p.veh && p.veh.type !== vi.ty) { w.removeVehicle(p.veh); p.veh = null; }
      } else {
        ac.root.visible = true;
        if (p.veh) { w.removeVehicle(p.veh); p.veh = null; }
      }
      for (const o of w.vehicles) if (o.remoteDriver === p.id && (!vi || vi.e !== o.eid)) { o.remoteDriver = null; o.wake(); }
    }

    if (this.isHost) {
      const ms = g.missions;
      if (ms.active && ms.active.online && ms.ctx) {
        this.entT -= dt;
        if (this.entT <= 0) {
          this.entT = 0.12;
          const l = [], vs = [];
          for (const o of ms.ctx.peds) if (o.eid && w.actors.includes(o) && !o.vehicle) l.push([o.eid, o.kind, +o.pos.x.toFixed(2), +o.pos.z.toFixed(2), +o.heading.toFixed(2), o.curName, o.ko ? 1 : 0, o.ai && o.ai.mode === 'fight' ? 1 : 0]);
          for (const o of ms.ctx.cars) if (o.eid && w.vehicles.includes(o)) vs.push([o.eid, o.type, +o.pos.x.toFixed(2), +o.pos.z.toFixed(2), +o.yaw.toFixed(3), o.mat ? o.mat.color.getHex() : 0xffffff, o.wreck ? 1 : 0]);
          this.event({ k: 'ents', l, v: vs });
        }
        this.objT -= dt;
        if (this.objT <= 0) {
          this.objT = 0.3;
          const t = ms.gpsTarget();
          this.event({ k: 'obj', html: g.ui.goalHtml || '', x: t ? +t.x.toFixed(1) : null, z: t ? +t.z.toFixed(1) : null, timer: ms.timer ? Math.round(ms.timer.t) : null, meter: g.ui.meterEl.classList.contains('hidden') ? null : parseFloat(g.ui.meterFill.style.width) / 100 });
        }
      }
    } else {
      // show the host's objective and animate the mirrored cast
      const o = this.remoteObj;
      if (o && o.html) { const opt = {}; if (o.timer !== null) opt.timer = o.timer; if (o.meter !== null && !isNaN(o.meter)) opt.meter = o.meter; g.ui.objective(o.html, opt); g.missions.target = o.x !== null ? { x: o.x, z: o.z } : null; }
      else if (o) { g.ui.objective(''); g.missions.target = null; this.remoteObj = null; }
      for (const ac of this.ghosts.values()) {
        ac.pos.x += (ac.gx - ac.pos.x) * k; ac.pos.z += (ac.gz - ac.pos.z) * k; ac.pos.y = groundY(ac.pos.x, ac.pos.z);
        ac.heading = dampAngle(ac.heading, ac.gh, 12, dt); ac.root.rotation.y = ac.heading;
        if (ac.ganim && ac.curName !== ac.ganim) ac.play(ac.ganim, 0.15, { once: ac.ganim === 'knockdown' || ac.ganim === 'hit' || ac.ganim === 'jab' || ac.ganim === 'hook' || ac.ganim === 'kick' || ac.ganim === 'standup', speed: ac.ganim === 'jab' ? 2.9 : ac.ganim === 'kick' ? 3 : ac.ganim === 'standup' ? 4.2 : ac.ganim === 'hit' ? 3.6 : 1.7 });
      }
      for (const v of this.ghostCars.values()) {
        if (pl.vehicle === v || v.gx === undefined) continue;
        v.pos.x += (v.gx - v.pos.x) * k; v.pos.z += (v.gz - v.pos.z) * k; v.pos.y = groundY(v.pos.x, v.pos.z);
        v.yaw = dampAngle(v.yaw, v.gyaw, 12, dt); v.root.rotation.y = v.yaw;
      }
    }
    void clamp;
  }
}
