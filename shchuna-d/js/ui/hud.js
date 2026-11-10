// Heads-up display: minimap (top-left), health and stamina, money, police beacons, objective,
// subtitles, notifications, speech bubbles, prompts, banners and the touch controls.
import * as THREE from 'three';
import { el, fmtMoney, fmtTime, clamp, dist2 } from '../core/util.js';
import { roads, blocks, XS, ZS, nearestNode, routeNodes, districtAt, streetAt, TURF, POI } from '../world/map.js';
import { FACTION_COLOR } from '../game/defs.js';

const MAP_HALF = 640, SC = 1.25;       // metres covered each way from the origin, pixels per metre
const _v = new THREE.Vector3();
const POPS = ['בום!', 'טראח!', 'פאף!', 'בּוּף!', 'אוי!', 'כאפה!', 'טוּם!', 'זבנג!'];

export class Hud {
  constructor(game) {
    this.game = game;
    const ui = this.ui = document.getElementById('ui');
    const root = this.root = el('div', 'hud off');
    root.innerHTML = `
      <div class="tl">
        <div class="map"><canvas width="372" height="262"></canvas><span class="north">צ</span></div>
        <div class="bars"><div class="bar hp"><i></i></div><div class="bar st"><i></i></div></div>
        <div class="where"><b></b><span></span></div>
        <div class="feed"></div>
      </div>
      <div class="tr"><div class="money num">₪0</div><div class="clock"></div><div class="beacons"><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="goal hidden"><span class="txt"></span><span class="timer num hidden"></span><div class="meter hidden"><i></i></div></div>
      <div class="subs"></div>
      <div class="prompt hidden"></div>
      <div class="br"><div class="zone"></div><div class="speedo hidden"><span class="num">0</span><small>קמ״ש</small></div></div>`;
    ui.appendChild(root);
    const q = (s) => root.querySelector(s);
    this.mapCv = q('.map canvas'); this.mapG = this.mapCv.getContext('2d'); this.north = q('.north');
    this.hpBar = q('.bar.hp'); this.hpFill = q('.bar.hp i'); this.stFill = q('.bar.st i');
    this.whereB = q('.where b'); this.whereS = q('.where span'); this.feed = q('.feed');
    this.moneyEl = q('.money'); this.clockEl = q('.clock'); this.beacons = q('.beacons');
    this.goalEl = q('.goal'); this.goalTxt = q('.goal .txt'); this.timerEl = q('.goal .timer'); this.meterEl = q('.goal .meter'); this.meterFill = q('.goal .meter i');
    this.subsEl = q('.subs'); this.promptEl = q('.prompt'); this.zoneEl = q('.zone'); this.speedo = q('.speedo'); this.speedNum = q('.speedo .num');
    this.layer = el('div'); this.layer.style.cssText = 'position:absolute;inset:0;overflow:hidden'; ui.appendChild(this.layer);
    this.cine = el('div', 'bars-cine'); ui.appendChild(this.cine);
    this.over = el('div'); this.over.style.cssText = 'position:absolute;inset:0'; ui.appendChild(this.over);
    this.barks = []; this.tracks = []; this.blips = [];
    this.moneyShown = 0; this.subT = 0; this.mapT = 0; this.routeT = 0; this.route = null; this.zoneName = ''; this.zoneT = 0; this.whereT = 0;
    this.promptKey = ''; this.lastWanted = -1; this.dlgEl = null;
    this.buildStatic();
    game.bus.on('money', (n) => {
      this.moneyEl.classList.toggle('up', n > 0); this.moneyEl.classList.toggle('dn', n < 0);
      clearTimeout(this._mt); this._mt = setTimeout(() => this.moneyEl.classList.remove('up', 'dn'), 900);
      if (Math.abs(n) >= 1) this.pop(game.player.actor.headPos(_v), (n > 0 ? '+' : '−') + fmtMoney(Math.abs(n)), 'cash');
    });
    game.bus.on('impact', (a, atk) => { if (game.settings.pops && (a.isPlayer || Math.random() < 0.35)) { const t = a.target || a; this.pop(_v.set(t.pos.x, t.pos.y + 1.5, t.pos.z), atk.heavy ? POPS[Math.floor(Math.random() * 3)] : POPS[3 + Math.floor(Math.random() * (POPS.length - 3))], atk.heavy ? 'big' : ''); } });
  }

  show(on) { this.root.classList.toggle('off', !on); if (this.touchEl) this.touchEl.classList.toggle('hidden', !on); }

  // ---- map ------------------------------------------------------------------------
  buildStatic() {
    const size = MAP_HALF * 2 * SC, cv = this.staticMap = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const X = (x) => (x + MAP_HALF) * SC, S = (m) => m * SC;
    g.fillStyle = '#24231f'; g.fillRect(0, 0, size, size);
    const zc = { park: '#243227', court3: '#2a2433', school: '#262a30', center: '#2b2a2c', shuk: '#2e2a25', industrial: '#25272a', site: '#2d2a22', towers: '#22302b', civic: '#252a31', wedding: '#2c2730', gas: '#2a2826', station: '#26292c' };
    for (const b of blocks) {
      g.fillStyle = zc[b.zone] || '#23262a'; g.fillRect(X(b.x0 - 3.6), X(b.z0 - 3.6), S(b.w + 7.2), S(b.d + 7.2));
      const t = TURF[b.zone];
      if (t && !(b.zone === 'shikun' && b.c >= 3)) { g.fillStyle = t === 'gimel' ? 'rgba(138,63,224,.10)' : 'rgba(245,179,1,.07)'; g.fillRect(X(b.x0 - 3.6), X(b.z0 - 3.6), S(b.w + 7.2), S(b.d + 7.2)); }
    }
    g.fillStyle = '#1c2a1f'; g.fillRect(X(380), X(ZS[0] - 110), S(180), S(96));
    for (const r of roads) {
      g.fillStyle = r.boulevard ? '#4a5059' : '#3c4149';
      if (r.vertical) g.fillRect(X(r.x - r.w / 2), X(r.z0 - 5), S(r.w), S(r.z1 - r.z0 + 10)); else g.fillRect(X(r.x0 - 5), X(r.z - r.w / 2), S(r.x1 - r.x0 + 10), S(r.w));
    }
    g.strokeStyle = 'rgba(243,239,230,.22)'; g.lineWidth = 1; g.setLineDash([6, 8]);
    for (const r of roads) { g.beginPath(); if (r.vertical) { g.moveTo(X(r.x), X(r.z0)); g.lineTo(X(r.x), X(r.z1)); } else { g.moveTo(X(r.x0), X(r.z)); g.lineTo(X(r.x1), X(r.z)); } g.stroke(); }
    g.setLineDash([]);
    const fc = { res: '#6b7078', home: '#f5b301', shop: '#5b8f8f', civic: '#7387a0', police: '#4f7fd0', school: '#8a8f7a', ind: '#6a6258', wedding: '#a58bc0', tower: '#9fb7b0', site: '#8a7a55', shelter: '#555a60' };
    for (const f of this.game.city.footprints) {
      g.save(); g.translate(X(f.x), X(f.z)); g.rotate(-f.yaw);
      g.fillStyle = fc[f.kind] || '#6b7078'; g.fillRect(-S(f.hw), -S(f.hd), S(f.hw * 2), S(f.hd * 2));
      g.restore();
    }
  }
  toMap(x) { return (x + MAP_HALF) * SC; }

  drawMini(dt) {
    const game = this.game, g = this.mapG, W = this.mapCv.width, H = this.mapCv.height, pl = game.player;
    const px = pl.pos.x, pz = pl.pos.z, yaw = game.cam.yaw;
    const zoom = this.zoom = this.zoom ? this.zoom + ((pl.vehicle ? clamp(1.25 - pl.speed * 0.012, 0.8, 1.25) : 1.45) - this.zoom) * 0.06 : 1.4;
    const cx = W / 2, cy = H * 0.62;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#24231f'; g.fillRect(0, 0, W, H);
    g.translate(cx, cy); g.rotate(yaw); g.scale(zoom, zoom); g.translate(-this.toMap(px), -this.toMap(pz));
    g.drawImage(this.staticMap, 0, 0);
    // GPS line to the current objective
    const tgt = game.missions ? game.missions.gpsTarget() : null;
    if (tgt) {
      this.routeT -= dt;
      if (this.routeT <= 0 || this.routeFor !== tgt) {
        this.routeT = 0.8; this.routeFor = tgt;
        const a = nearestNode(px, pz), b = nearestNode(tgt.x, tgt.z);
        this.route = dist2(px, pz, tgt.x, tgt.z) < 60 * 60 || a === b ? [] : routeNodes(a, b);
      }
      g.strokeStyle = '#f5b301'; g.lineWidth = 5 / zoom; g.lineJoin = 'round'; g.lineCap = 'round'; g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(this.toMap(px), this.toMap(pz));
      const r = this.route;
      if (r && r.length) {
        // skip the first node if it lies behind us
        let i0 = 0; if (r.length > 1 && dist2(px, pz, r[0].b.x, r[0].b.z) < dist2(r[0].a.x, r[0].a.z, r[0].b.x, r[0].b.z)) i0 = 0; else g.lineTo(this.toMap(r[0].a.x), this.toMap(r[0].a.z));
        for (let i = i0; i < r.length; i++) g.lineTo(this.toMap(r[i].b.x), this.toMap(r[i].b.z));
      }
      g.lineTo(this.toMap(tgt.x), this.toMap(tgt.z)); g.stroke(); g.globalAlpha = 1;
    }
    // blips, drawn upright in screen space
    g.setTransform(1, 0, 0, 1, 0, 0);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const proj = (x, z, edge) => {
      const dx = (x - px) * SC * zoom, dz = (z - pz) * SC * zoom;
      let sx = cx + dx * c - dz * s, sy = cy + dx * s + dz * c, out = false;
      if (edge) { const m = 9; if (sx < m || sx > W - m || sy < m || sy > H - m) { out = true; const k = Math.min((sx < cx ? cx - m : W - m - cx) / Math.abs(sx - cx || 1), (sy < cy ? cy - m : H - m - cy) / Math.abs(sy - cy || 1)); sx = cx + (sx - cx) * k; sy = cy + (sy - cy) * k; } }
      return [sx, sy, out];
    };
    const dot = (x, z, col, r, edge, ring) => {
      const [sx, sy, out] = proj(x, z, edge);
      if (!edge && (sx < -5 || sx > W + 5 || sy < -5 || sy > H + 5)) return;
      g.beginPath(); g.arc(sx, sy, out ? r * 0.75 : r, 0, 6.283); g.fillStyle = col; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = ring || '#0d0f12'; g.stroke();
    };
    const w = game.world, pa = pl.actor;
    for (const v of w.vehicles) { if (v === pl.vehicle) continue; if (v.def.siren && v.siren) dot(v.pos.x, v.pos.z, (game.time * 4 % 1) < 0.5 ? '#2f7bff' : '#e5412d', 4.5, false); }
    for (const a of w.actors) {
      if (a === pa || a.ko || !a.ai) continue;
      if (a.ai.mode === 'fight' && a.ai.target === pa) dot(a.pos.x, a.pos.z, a.faction === 'cop' ? '#2f7bff' : '#e5412d', 3.6, false);
      else if (a.ai.leader === pa || (a.ai.mode === 'fight' && a.faction === 'dalet')) dot(a.pos.x, a.pos.z, '#1f9c9c', 3.2, false);
      else if (a.faction === 'cop' && game.wanted.level > 0) dot(a.pos.x, a.pos.z, '#2f7bff', 3, false);
    }
    for (const b of this.blips) { const p = b.pos(); if (p) { if (b.shape === 'sq') { const [sx, sy] = proj(p.x, p.z, true); g.fillStyle = b.color; g.strokeStyle = '#0d0f12'; g.lineWidth = 1.5; g.save(); g.translate(sx, sy); g.rotate(0.785); g.fillRect(-4.5, -4.5, 9, 9); g.strokeRect(-4.5, -4.5, 9, 9); g.restore(); } else dot(p.x, p.z, b.color, b.r || 5, true); } }
    if (game.net && game.net.peers) for (const p of game.net.peers.values()) if (p.seen) dot(p.actor.pos.x, p.actor.pos.z, '#6fd08c', 4.5, true);
    // the player
    const ang = (pl.vehicle ? pl.vehicle.yaw : pa.heading);
    g.save(); g.translate(cx, cy); g.rotate(yaw + Math.PI - ang);
    g.beginPath(); g.moveTo(0, -8.5); g.lineTo(6, 6.5); g.lineTo(0, 3.2); g.lineTo(-6, 6.5); g.closePath();
    g.fillStyle = '#f3efe6'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#0d0f12'; g.stroke(); g.restore();
    // north marker rides the rim
    const nx = cx + Math.sin(-yaw) * 0 - 0, na = -yaw; void nx;
    const rx = Math.sin(yaw) * -1, ry = -Math.cos(yaw);
    const k = Math.min((W / 2 - 10) / Math.abs(rx || 1e-3), (ry < 0 ? cy - 9 : H - cy - 9) / Math.abs(ry || 1e-3));
    this.north.style.left = ((cx + rx * k) / W) * 100 + '%'; this.north.style.top = ((cy + ry * k) / H) * 100 + '%'; this.north.style.transform = 'translate(-50%,-50%)'; void na;
  }

  drawFull(cv) {
    const g = cv.getContext('2d'), W = cv.width, game = this.game;
    const view = 760, k = W / view, off = (x) => (x + view / 2 - 40) * k;
    g.fillStyle = '#24231f'; g.fillRect(0, 0, W, W);
    g.drawImage(this.staticMap, (MAP_HALF - view / 2 + 40) * SC, (MAP_HALF - view / 2 + 40) * SC, view * SC, view * SC, 0, 0, W, W);
    g.font = `700 ${Math.round(W * 0.019)}px Heebo`; g.textAlign = 'center'; g.fillStyle = 'rgba(243,239,230,.8)';
    const names = { home: 'הבית', kiosk: 'המרכז המסחרי', garage: 'המוסך', police: 'משטרה', wedding: 'אולמי ורסאי', court: 'המגרש', court3: 'שכונה ג׳', shuk: 'השוק', site: 'פינוי־בינוי', gas: 'דלק נגב', busArrive: 'התחנה', bituach: 'ביטוח לאומי', school: 'בית ספר', towers: 'נווה יוקרה', moshav: 'המושב' };
    for (const n in names) { const p = POI[n]; if (!p) continue; g.fillStyle = 'rgba(13,15,18,.75)'; const tw = g.measureText(names[n]).width + 10; g.fillRect(off(p.x) - tw / 2, off(p.z) - W * 0.034, tw, W * 0.026); g.fillStyle = '#f3efe6'; g.fillText(names[n], off(p.x), off(p.z) - W * 0.015); }
    for (const b of this.blips) { const p = b.pos(); if (!p) continue; g.beginPath(); g.arc(off(p.x), off(p.z), W * 0.012, 0, 7); g.fillStyle = b.color; g.fill(); g.lineWidth = 2; g.strokeStyle = '#0d0f12'; g.stroke(); }
    const p = game.player.pos;
    g.save(); g.translate(off(p.x), off(p.z)); g.rotate(Math.PI - game.player.actor.heading); g.beginPath(); g.moveTo(0, -W * 0.02); g.lineTo(W * 0.013, W * 0.014); g.lineTo(-W * 0.013, W * 0.014); g.closePath(); g.fillStyle = '#f3efe6'; g.fill(); g.strokeStyle = '#0d0f12'; g.lineWidth = 2; g.stroke(); g.restore();
  }

  addBlip(pos, color = '#f5b301', opt = {}) { const b = Object.assign({ pos: typeof pos === 'function' ? pos : () => pos, color }, opt); this.blips.push(b); return b; }
  removeBlip(b) { const i = this.blips.indexOf(b); if (i >= 0) this.blips.splice(i, 1); }

  // ---- text ---------------------------------------------------------------------------
  objective(html, opt = {}) {
    if (!html) { this.goalEl.classList.add('hidden'); this.goalHtml = ''; return; }
    if (html !== this.goalHtml) { this.goalHtml = html; this.goalTxt.innerHTML = html; this.goalEl.classList.remove('hidden'); this.game.bus.emit('objective'); }
    this.timerEl.classList.toggle('hidden', opt.timer === undefined); this.meterEl.classList.toggle('hidden', opt.meter === undefined);
    if (opt.timer !== undefined) { this.timerEl.textContent = fmtTime(opt.timer); this.timerEl.classList.toggle('low', opt.timer < 15); }
    if (opt.meter !== undefined) this.meterFill.style.width = clamp(opt.meter, 0, 1) * 100 + '%';
  }
  subtitle(who, text, color, dur) {
    this.subsEl.innerHTML = (who ? `<b style="color:${color || '#f5b301'}">${who}:</b>` : '') + text;
    this.subT = dur || Math.max(2.2, text.length * 0.065);
  }
  notify(text, kind = '', title = '') {
    const n = el('div', 'note ' + kind, (title ? `<small>${title}</small>` : '') + text);
    this.feed.appendChild(n);
    while (this.feed.children.length > 3) this.feed.firstChild.remove();
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 320); }, 5200);
    this.game.bus.emit('notify', kind);
  }
  prompt(key, text) {
    const k = key + '|' + text;
    if (text) this.promptAt = this.game.time;
    if (k === this.promptKey) return;
    this.promptKey = k;
    if (!text) { this.promptEl.classList.add('hidden'); return; }
    this.promptEl.innerHTML = `<span class="key">${key}</span><span>${text}</span>`; this.promptEl.classList.remove('hidden');
  }
  zone(name, sub) {
    this.zoneEl.innerHTML = name + (sub ? `<small>${sub}</small>` : ''); this.zoneEl.classList.add('on'); this.zoneT = 4;
  }
  bark(actor, text) {
    if (!actor || this.barks.length > 4 || this.game.cutscene) return;
    for (const b of this.barks) if (b.actor === actor) return;
    const e = el('div', 'bark', text); this.layer.appendChild(e);
    this.barks.push({ actor, e, t: 2.6 + text.length * 0.04 });
  }
  pop(pos, text, cls = '') {
    const p = this.project(pos); if (!p) return;
    const e = el('div', 'pop ' + cls, text); e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
    this.layer.appendChild(e); setTimeout(() => e.remove(), 600);
  }
  track(getPos, label, cls = '', showDist = true) {
    const e = el('div', 'blipname ' + cls, `<i></i><span></span>`); this.layer.appendChild(e);
    const t = { getPos, label, e, span: e.querySelector('span'), showDist }; this.tracks.push(t); return t;
  }
  untrack(t) { if (!t) return; t.e.remove(); const i = this.tracks.indexOf(t); if (i >= 0) this.tracks.splice(i, 1); }
  project(pos) {
    const cam = this.game.gfx.camera;
    _v.copy(pos).project(cam);
    if (_v.z > 1 || _v.z < -1) return null;
    return { x: (_v.x * 0.5 + 0.5) * window.innerWidth, y: (-_v.y * 0.5 + 0.5) * window.innerHeight };
  }

  banner(kind, title, sub, opt = {}) {
    return new Promise((res) => {
      const b = el('div', 'banner ' + kind);
      let h = `<div><h2>${title}</h2>` + (sub ? `<p>${sub}</p>` : '');
      if (opt.reward) h += `<div class="reward num">+${fmtMoney(opt.reward)}</div>`;
      if (opt.stats) h += '<div class="stats">' + opt.stats.map((s) => `<span>${s[0]}</span><b>${s[1]}</b>`).join('') + '</div>';
      b.innerHTML = h + '</div>'; this.over.appendChild(b);
      setTimeout(() => { b.style.transition = 'opacity .5s'; b.style.opacity = '0'; setTimeout(() => { b.remove(); res(); }, 520); }, opt.hold || 3600);
    });
  }
  card(small, title, sub, hold = 3800) {
    const c = el('div', 'card', `<small>${small}</small><h1>${title}</h1>` + (sub ? `<p>${sub}</p>` : '')); this.over.appendChild(c);
    setTimeout(() => { c.style.transition = 'opacity .6s'; c.style.opacity = '0'; setTimeout(() => c.remove(), 620); }, hold);
  }
  cinema(on) { this.cine.classList.toggle('on', on); this.root.classList.toggle('off', on || !this.game.playing); if (this.touchEl) { this.touchEl.classList.toggle('cine', on); this.game.input.tapAdvances = on; } }
  dialog(face, who, line, color) {
    if (!this.dlgEl) { this.dlgEl = el('div', 'dlg', '<div class="face"></div><div class="body"><div class="who"></div><div class="line"></div></div><span class="more"></span>'); this.over.appendChild(this.dlgEl); }
    const d = this.dlgEl;
    d.querySelector('.face').style.backgroundImage = face ? `url(assets/img/face_${face}.webp)` : 'none';
    d.querySelector('.face').style.display = face ? '' : 'none';
    const w = d.querySelector('.who'); w.textContent = who; w.style.color = color || '#f5b301';
    d.querySelector('.line').textContent = line;
    d.querySelector('.more').textContent = this.game.input.touch ? 'הקש להמשך' : 'רווח · המשך   R · דלג';
  }
  hideDialog() { if (this.dlgEl) { this.dlgEl.remove(); this.dlgEl = null; } }

  // ---- touch controls -------------------------------------------------------------------
  buildTouch() {
    if (this.touchEl) return;
    const t = this.touchEl = el('div', 'touch');
    t.innerHTML = `<div class="stick"><i></i></div>
      <div class="foot">
        <div class="tbtn lg" data-act="punch" style="right:calc(1.6rem + var(--safe-r));bottom:calc(5.4rem + var(--safe-b))">אגרוף</div>
        <div class="tbtn" data-act="kick" style="right:calc(7.8rem + var(--safe-r));bottom:calc(2.2rem + var(--safe-b))">בעיטה</div>
        <div class="tbtn sm" data-act="jump" style="right:calc(8.4rem + var(--safe-r));bottom:calc(8rem + var(--safe-b))">קפיצה</div>
        <div class="tbtn" data-act="sprint" style="right:calc(1.8rem + var(--safe-r));bottom:calc(12rem + var(--safe-b))">ריצה</div>
      </div>
      <div class="car hidden">
        <div class="tbtn lg" data-act="gas" style="right:calc(1.6rem + var(--safe-r));bottom:calc(3rem + var(--safe-b))">גז</div>
        <div class="tbtn" data-act="brakeBtn" style="right:calc(8rem + var(--safe-r));bottom:calc(2rem + var(--safe-b))">ברקס</div>
        <div class="tbtn sm" data-act="hand" style="right:calc(8.6rem + var(--safe-r));bottom:calc(7.6rem + var(--safe-b))">ידני</div>
        <div class="tbtn sm" data-act="horn" style="right:calc(2.2rem + var(--safe-r));bottom:calc(10rem + var(--safe-b))">צפצוף</div>
        <div class="tbtn sm" data-act="radio" style="right:calc(6.4rem + var(--safe-r));bottom:calc(12rem + var(--safe-b))">רדיו</div>
      </div>
      <div class="tbtn sm" data-act="enter" style="right:calc(13.6rem + var(--safe-r));bottom:calc(3rem + var(--safe-b))">רכב</div>
      <div class="tbtn rect" data-act="interact" style="left:50%;transform:translateX(-50%);bottom:calc(31% + var(--safe-b));display:none">אישור</div>
      <div class="tbtn rect" data-act="pause" style="right:50%;transform:translateX(160%);top:calc(.8rem + var(--safe-t))">תפריט</div>
      <div class="tbtn rect" data-act="phone" style="right:50%;transform:translateX(-60%);top:calc(.8rem + var(--safe-t))">טלפון</div>`;
    this.ui.insertBefore(t, this.layer);
    document.body.classList.add('is-touch');
    const btns = {}; t.querySelectorAll('[data-act]').forEach((b) => { btns[b.dataset.act] = b; });
    this.tFoot = t.querySelector('.foot'); this.tCar = t.querySelector('.car'); this.tInteract = btns.interact;
    this.game.input.bindTouch(t, t.querySelector('.stick'), t.querySelector('.stick i'), btns);
    this.goalEl.style.top = 'calc(3.8rem + var(--safe-t))';
  }

  update(dt) {
    const game = this.game, pl = game.player, a = pl.actor;
    this.hpFill.style.transform = `scaleX(${clamp(a.hp / a.maxHp, 0, 1)})`; this.hpBar.classList.toggle('low', a.hp < 30);
    this.stFill.style.transform = `scaleX(${clamp(pl.stamina, 0, 1)})`;
    // money counts up rather than jumping
    if (this.moneyShown !== pl.money) { const d = pl.money - this.moneyShown; this.moneyShown = Math.abs(d) < 2 ? pl.money : this.moneyShown + d * Math.min(1, dt * 7); this.moneyEl.textContent = fmtMoney(this.moneyShown); }
    const lvl = game.wanted.level;
    if (lvl !== this.lastWanted) { this.lastWanted = lvl; [...this.beacons.children].forEach((b, i) => b.classList.toggle('on', i < lvl)); }
    this.beacons.classList.toggle('flash', lvl > 0 && game.wanted.flash);
    this.whereT -= dt;
    if (this.whereT <= 0) {
      this.whereT = 0.5;
      const d = districtAt(pl.pos.x, pl.pos.z), st = streetAt(pl.pos.x, pl.pos.z);
      this.whereB.textContent = d; this.whereS.textContent = st;
      this.clockEl.textContent = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][(game.sky.day + 3) % 7] + ' · ' + game.sky.clock();
      if (d !== this.zoneName) { this.zoneName = d; if (game.playing && !game.cutscene) this.zone(d, st); }
      this.speedo.classList.toggle('hidden', !pl.vehicle);
      if (this.touchEl) { this.tFoot.classList.toggle('hidden', !!pl.vehicle); this.tCar.classList.toggle('hidden', !pl.vehicle); this.tInteract.style.display = this.promptKey && !this.promptEl.classList.contains('hidden') ? '' : 'none'; }
    }
    if (pl.vehicle) this.speedNum.textContent = Math.round(pl.vehicle.speed * 3.6 * 1.15);
    if (this.zoneT > 0) { this.zoneT -= dt; if (this.zoneT <= 0) this.zoneEl.classList.remove('on'); }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.subsEl.innerHTML = ''; }
    this.mapT -= dt; if (this.mapT <= 0) { this.mapT = 0.033; this.drawMini(0.033); }
    for (let i = this.barks.length - 1; i >= 0; i--) {
      const b = this.barks[i]; b.t -= dt;
      const p = b.t > 0 && game.world.actors.includes(b.actor) ? this.project(b.actor.headPos(_v)) : null;
      if (!p || dist2(b.actor.pos.x, b.actor.pos.z, pl.pos.x, pl.pos.z) > 30 * 30) { b.e.remove(); this.barks.splice(i, 1); continue; }
      b.e.style.left = p.x + 'px'; b.e.style.top = p.y + 'px';
    }
    for (const t of this.tracks) {
      const w = t.getPos(); const p = w ? this.project(_v.set(w.x, (w.y || 0) + (w.h || 2.4), w.z)) : null;
      if (!p) { t.e.style.display = 'none'; continue; }
      t.e.style.display = ''; t.e.style.left = clamp(p.x, 40, window.innerWidth - 40) + 'px'; t.e.style.top = clamp(p.y, 60, window.innerHeight - 60) + 'px';
      const d = Math.sqrt(dist2(w.x, w.z, pl.pos.x, pl.pos.z));
      t.span.textContent = (t.label || '') + (t.showDist && d > 12 ? (t.label ? ' · ' : '') + Math.round(d) + ' מ׳' : '');
    }
  }
}
export { FACTION_COLOR };
