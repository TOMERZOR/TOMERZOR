// Gameplay: the pro, the van, carrying, customers, jobs, coins, upgrades, days.
import * as THREE from 'three';
import * as M from './models.js';
import { BASE, dashedSquare, ringMarker } from './world.js';
import * as D from './data.js';
import { sfx, vibrate, duckMusic } from './audio.js';
import { runMiniGame } from './minigames.js';

const UP = new THREE.Vector3(0, 1, 0);
const DAY_LEN = 180;
const SAVE_KEY = 'mk_save_v1';
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const ease = t => 1 - Math.pow(1 - t, 3);
const rand = (a, b) => a + Math.random() * (b - a);

function loadAll() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { careers: {} }; } catch { return { careers: {} }; } }
export function careerSummary() { return loadAll(); }
function freshCareer() {
  return { coins: 0, xp: 0, level: 1, up: { belt: 0, ride: 0, helper: 0, skill: 0, van: 0 }, reviews: [5, 5, 4], day: 1, dayT: 0, tut: 0,
    stats: { jobs: 0, earned: 0 }, today: { jobs: 0, earned: 0, excuses: 0, cash: 0, greedy: 0, lost: 0, kicked: 0 } };
}

export class Game {
  constructor(world, ui) {
    this.world = world; this.ui = ui;
    this.scene = world.scene;
    this.running = false;
    this.busy = false;
    world.onCat = p => { if (this.running && Math.random() < 0.6) { sfx.meow(); const q = p.clone().setY(0.8); ui.bubble(() => q, 'מיאו 😾', 1.2, 'emoji'); } };
    document.getElementById('excuseBtn').addEventListener('click', () => this.excuse());
    document.getElementById('menuBtn').addEventListener('click', () => this.menu());
  }

  // ---------- setup ----------
  start(pro) {
    this.cleanup();
    this.all = loadAll();
    this.all.last = pro;
    this.c = this.all.careers[pro] ||= freshCareer();
    const c = this.c; // fields added after the first release
    c.up.ads ??= 0; c.subs ??= []; c.streak ??= 0; c.register ??= 0;
    this.pro = pro; this.P = D.PROS[pro];
    const P = this.P;
    this.world.setVan(P.shirt === 0xe9e4d6 ? 0xe67e22 : P.shirt, `${P.name} ${['מקצוען', 'בע״מ', 'ובניו', 'בע״מ'][D.PRO_ORDER.indexOf(pro) % 4]}`);

    this.player = M.makePerson({ shirt: P.shirt, pants: P.pants, hat: P.hat, hatColor: P.hatColor, tool: P.tool, mustache: true, belt: true, overalls: ['plumber', 'gardener', 'renovator'].includes(pro), skin: 0xf1c27d });
    this.player.position.copy(BASE.spawn); this.player.rotation.y = Math.PI;
    this.scene.add(this.player);
    this.vel = new THREE.Vector3();
    this.scooter = makeScooter(); this.player.add(this.scooter);
    this.stack = []; this.helperStack = [];
    this.stock = []; this.stockT = 0;
    this.jobs = []; this.jobT = 2.5; this.jobSeq = 0;
    this.coins = []; this.flyers = []; this.parts = [];
    this.pickT = 0; this.dropT = 0; this.payT = 0; this.dustT = 0; this.saveT = 0; this.hintT = 0; this.honkT = 0;
    this.pendingFollow = []; this.popIns = []; this.subSigns = new Map(); this.lastTalk = -1;
    this.buildPads();
    this.buildRegister();
    for (const i of c.subs) this.addSubSign(this.world.houses[i], true);
    // the subscriptions kept paying (at half rate) while the game was closed
    if (c.lastSeen && c.subs.length) {
      const away = Math.min(4 * 3600, (Date.now() - c.lastSeen) / 1000);
      const before = c.register;
      c.register = Math.min(this.regCap, c.register + away * this.income * 0.5);
      const got = Math.floor(c.register - before);
      if (got >= 5) setTimeout(() => { sfx.kaching(); this.ui.toast({ icon: '💰', name: 'הקופה', text: `בזמן שלא היית, המנויים שילמו ₪${got}. בוא לאסוף!`, cls: 'review', dur: 5 }); }, 1400);
    }
    this.syncUpgrades();
    this.world.setLocks(this.c.level);
    this.ui.hud(true);
    this.ui.enabled = true;
    this.running = true;
    this.refreshHUD();
    this.world.followCam(this.player.position, 0, true);
    for (let i = 0; i < Math.min(4, D.vanStock(this.c.up.van)); i++) this.addStock(true);
    this.save();
  }

  cleanup() {
    if (!this.running) return;
    const rm = o => o && this.scene.remove(o);
    rm(this.player); rm(this.helper);
    for (const i of [...this.stack, ...this.helperStack, ...this.stock]) rm(i);
    for (const j of this.jobs) { rm(j.cust); rm(j.ring); this.ui.untrack(j.marker); }
    for (const c of this.coins) rm(c.m);
    for (const f of this.flyers) rm(f.obj);
    for (const p of this.parts) rm(p.m);
    for (const p of this.pads || []) rm(p.group);
    if (this.reg) { rm(this.reg.group); rm(this.reg.zone); for (const b of this.reg.bills) rm(b); this.ui.untrack(this.reg.label); this.ui.untrack(this.reg.guide); }
    for (const sgn of this.subSigns?.values() || []) rm(sgn);
    this.ui.untrack(this.guideEl); this.guideEl = null;
    this.helper = null;
    this.running = false;
  }

  save() {
    if (!this.c) return;
    this.c.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.all)); } catch {}
  }

  // ---------- derived ----------
  get cap() { return D.capacity(this.c.up.belt); }
  get hcap() { return D.helperCap(this.c.up.helper); }
  get income() { return this.c.subs.length * D.SUB_RATE * D.subMult(this.c.up.ads); }
  get regCap() { return D.registerCap(this.c.up.ads); }
  get streakMult() { return 1 + 0.1 * Math.min(this.c.streak, 10); }
  get rating() { const r = this.c.reviews; return r.reduce((a, b) => a + b, 0) / r.length; }
  title(l = this.c.level) { return D.TITLES[Math.min(l - 1, D.TITLES.length - 1)].replace('{pro}', this.P.name); }

  refreshHUD() {
    const c = this.c, need = D.xpFor(c.level);
    this.ui.setCoins(c.coins);
    this.ui.setRating(this.rating);
    this.ui.setLevel(c.level, Math.min(1, c.xp / need), this.title());
    this.ui.setDay(c.day, c.dayT / DAY_LEN);
    this.ui.setStreak(c.streak, this.streakMult);
  }

  syncUpgrades() {
    const u = this.c.up;
    this.speed = D.speedOf(u.ride);
    this.scooter.visible = u.ride >= 2;
    this.scooter.userData.turbo.visible = u.ride >= 3;
    const b = this.player.userData.belly; const s = 1 + (this.c.level - 1) * 0.08;
    b.scale.set(0.3 * s, 0.28 * s, 0.26 * s * 1.1); b.position.z = 0.12 + (s - 1) * 0.12;
    if (u.helper > 0 && !this.helper) {
      this.helper = M.makePerson({ shirt: this.P.shirt, pants: this.P.pants, hat: 'cap', hatColor: 0x888888, belt: true, skin: 0xe0ac69 });
      this.helper.scale.setScalar(0.85);
      this.helper.position.copy(this.player.position).add(new THREE.Vector3(1.5, 0, 1));
      this.scene.add(this.helper);
      this.helperBreak = 0; this.helperBreakT = 30 + Math.random() * 20;
      this.poof(this.helper.position, 0xffffff, 14);
      const hp = this.helper; this.ui.bubble(() => tmp2.copy(hp.position).setY(2), 'שלום בוס! מתי הפסקה?', 2.6);
    }
  }

  // ---------- upgrade pads ----------
  buildPads() {
    this.pads = D.UPGRADES.map((u, i) => {
      const group = new THREE.Group();
      const base = M.mesh(M.roundedBox(2.5, 0.14, 2.5, 0.06), 0x3a3550); base.position.y = 0.07; group.add(base);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 384;
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const top = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 2.36), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      top.rotation.x = -Math.PI / 2; top.position.y = 0.15; group.add(top);
      group.position.set(-7.5 + i * 3, 0, BASE.padsZ);
      this.scene.add(group);
      const pad = { u, group, canvas, tex, paid: 0, dwell: 0, pulse: 0 };
      this.drawPad(pad);
      return pad;
    });
  }
  drawPad(pad) {
    const { u, canvas } = pad, x = canvas.getContext('2d'), W = canvas.width;
    const lvl = this.c.up[u.id], maxed = lvl >= u.max, cost = D.upgradeCost(u, lvl);
    const afford = this.c.coins >= cost - pad.paid;
    x.clearRect(0, 0, W, W);
    M.rr(x, 8, 8, W - 16, W - 16, 44); x.fillStyle = maxed ? '#4a8f5c' : '#4b4468'; x.fill();
    x.setLineDash([30, 20]); x.lineWidth = 12; x.strokeStyle = maxed ? '#b6f5c6' : afford ? '#ffe066' : 'rgba(255,255,255,.7)'; M.rr(x, 24, 24, W - 48, W - 48, 34); x.stroke(); x.setLineDash([]);
    if (!maxed && pad.paid > 0) { x.save(); M.rr(x, 24, 24, W - 48, W - 48, 34); x.clip(); x.fillStyle = 'rgba(255,224,102,.35)'; const h = (W - 48) * pad.paid / cost; x.fillRect(24, W - 24 - h, W - 48, h); x.restore(); }
    x.textAlign = 'center'; x.direction = 'rtl'; x.textBaseline = 'middle';
    x.font = '90px sans-serif'; x.fillText(u.icon, W / 2, 112);
    x.fillStyle = '#fff'; x.font = '700 50px Fredoka, Rubik, sans-serif'; x.fillText(u.name, W / 2, 196);
    x.font = '500 32px Fredoka, Rubik, sans-serif'; x.fillStyle = '#d9d2ec';
    x.fillText(maxed ? 'מקסימום!' : u.desc(lvl + 1), W / 2, 244);
    x.font = '700 50px Fredoka, Rubik, sans-serif'; x.fillStyle = maxed ? '#b6f5c6' : '#ffe066';
    x.fillText(maxed ? '★ MAX ★' : `🪙 ${cost - Math.floor(pad.paid)}`, W / 2, 310);
    for (let i = 0; i < u.max; i++) { x.beginPath(); x.arc(W / 2 + (i - (u.max - 1) / 2) * 30, 352, 9, 0, 7); x.fillStyle = i < lvl ? '#ffe066' : 'rgba(255,255,255,.25)'; x.fill(); }
    pad.tex.needsUpdate = true;
  }

  // ---------- register: subscription money piles up here as bills ----------
  buildRegister() {
    const g = new THREE.Group();
    const desk = M.mesh(M.roundedBox(1.8, 0.95, 0.9, 0.08), 0xa9744a); desk.position.y = 0.48; g.add(desk);
    const top = M.mesh(M.roundedBox(1.95, 0.08, 1.0, 0.03), 0xd7b27c); top.position.y = 0.98; g.add(top);
    const body = M.mesh(M.roundedBox(0.8, 0.36, 0.62, 0.08), 0x37474f); body.position.set(-0.3, 1.2, 0); g.add(body);
    const screen = M.mesh(M.roundedBox(0.56, 0.3, 0.06, 0.03), 0x7ee787, { emissive: 0x1f6b2a, emissiveIntensity: 0.8 }); screen.position.set(-0.3, 1.5, -0.12); screen.rotation.x = -0.35; g.add(screen);
    for (let i = 0; i < 6; i++) { const k = M.mesh(M.roundedBox(0.13, 0.05, 0.11, 0.02), 0xeceff1); k.position.set(-0.52 + (i % 3) * 0.17, 1.4, 0.1 + Math.floor(i / 3) * 0.14); g.add(k); }
    const crate = M.mesh(M.roundedBox(1.25, 0.2, 0.9, 0.05), 0xc8a165); crate.position.set(1.65, 0.1, 0.05); g.add(crate);
    g.position.set(-0.6, 0, -6.2);
    this.scene.add(g);
    const zone = dashedSquare(3.2, 0x7ee787);
    zone.position.set(0, 0.05, -4.2); this.scene.add(zone);
    this.world.colliders.push({ minX: -1.6, maxX: 1.7, minZ: -6.75, maxZ: -5.6 });
    const label = document.createElement('div'); label.className = 'reglabel';
    label.innerHTML = '<div><b>💰 ₪0</b><small></small></div>';
    const reg = this.reg = { group: g, zone, bills: [], label: null, guide: null, taking: false, takeT: 0, got: 0, base: new THREE.Vector3(1.05, 0.2, -6.15), shown: -1, pulse: 0 };
    reg.label = this.ui.track(label, () => tmp2.set(0.2, 2.6, -6.2));
  }
  billPos(i) {
    const col = i % 4, lay = Math.floor(i / 4);
    return this.reg.base.clone().add(new THREE.Vector3((col % 2 - 0.5) * 0.6, 0.05 + lay * 0.08, (Math.floor(col / 2) - 0.5) * 0.36));
  }
  makeBill() {
    const g = new THREE.Group();
    const b = M.mesh(M.roundedBox(0.56, 0.07, 0.32, 0.02), 0x43a047); g.add(b);
    const band = M.mesh(new THREE.BoxGeometry(0.12, 0.075, 0.325), 0xfff59d); g.add(band);
    const mark = M.mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.076, 12), 0x2e7d32); g.add(mark); mark.position.x = 0.17;
    return g;
  }
  updateRegister(dt) {
    const reg = this.reg, c = this.c, pp = this.player.position;
    const cap = this.regCap;
    c.register = Math.min(cap, c.register + this.income * dt);
    const per = cap / 48;
    const target = Math.min(48, Math.ceil(c.register / per - 0.001));
    const inZone = !this.busy && Math.abs(pp.x - reg.zone.position.x) < 1.6 && Math.abs(pp.z - reg.zone.position.z) < 1.6;
    if (inZone && reg.bills.length && c.register >= 1) {
      if (!reg.taking) { reg.taking = true; reg.got = 0; reg.n = 0; sfx.kaching(); vibrate(15); c.collected = true; }
      reg.takeT -= dt;
      while (reg.takeT <= 0 && reg.bills.length) {
        reg.takeT += 0.055;
        const n = reg.bills.length;
        const value = n === 1 ? Math.floor(c.register) : Math.floor(c.register / n);
        c.register -= value;
        const bill = reg.bills.pop();
        const k = reg.n++;
        this.fly(bill, bill.position.clone(), () => tmp2.copy(this.player.position).setY(1.3), 0.32, 1.3, () => {
          this.scene.remove(bill); this.c.coins += value; reg.got += value;
          sfx.bill(k); if (k % 2 === 0) sfx.coin();
          this.ui.setCoins(this.c.coins, true);
          if (!reg.bills.length && !this.flyers.some(f => f.bill)) { this.ui.float(this.player.position.clone().setY(3), `+₪${reg.got}`, ''); this.sparkle(this.player.position.clone().setY(1.5), 10); }
        });
        this.flyers[this.flyers.length - 1].bill = n > 1;
      }
    } else {
      reg.taking = false;
      while (reg.bills.length < target) { // a new bill drops onto the pile
        const b = this.makeBill(); const p = this.billPos(reg.bills.length);
        b.position.copy(p); b.rotation.y = (Math.random() - 0.5) * 0.25; b.scale.setScalar(0.01);
        this.scene.add(b); reg.bills.push(b); this.popIns.push({ obj: b, t: 0 });
        if (pp.distanceTo(p) < 9 && !this.busy) sfx.bubble(reg.bills.length % 8, 0.12);
      }
      while (reg.bills.length > target) this.scene.remove(reg.bills.pop());
    }
    // label
    const shown = Math.floor(c.register);
    if (shown !== reg.shown || reg.subs !== c.subs.length) {
      reg.shown = shown; reg.subs = c.subs.length;
      const full = c.register >= cap - 0.5;
      reg.label.el.querySelector('b').textContent = full ? `💰 ₪${shown} · מלא!` : `💰 ₪${shown}`;
      reg.label.el.querySelector('small').textContent = c.subs.length ? `${c.subs.length} מנויים · ₪${Math.round(this.income * 60)}/דקה` : 'אין מנויים עדיין';
      reg.label.el.classList.toggle('full', full);
    }
    const wantGuide = c.register >= cap * 0.35 && !inZone;
    if (wantGuide && !reg.guide) reg.guide = this.ui.guide(() => tmp2.set(0, 3.6, -4.6), '💰');
    if (!wantGuide && reg.guide) { this.ui.untrack(reg.guide); reg.guide = null; }
  }
  addSubSign(h, instant) {
    if (!h || this.subSigns.has(h.i)) return;
    const tex = M.textCanvas(256, 128, (x, W, H) => {
      x.fillStyle = '#2e7d32'; M.rr(x, 4, 4, W - 8, H - 8, 22); x.fill();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
      x.font = '700 50px Fredoka, Rubik, sans-serif'; x.fillText('✓ מנוי', W / 2, H / 2 + 2);
    });
    const g = new THREE.Group();
    const post = M.mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), 0x6d4c2f); post.position.y = 0.55; g.add(post);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); board.position.y = 1.25; g.add(board);
    const side = new THREE.Vector3(Math.cos(h.slot.rot), 0, -Math.sin(h.slot.rot));
    g.position.copy(h.door).addScaledVector(h.facing, 0.6).addScaledVector(side, 1.5);
    this.scene.add(g); this.subSigns.set(h.i, g);
    if (!instant) { g.scale.setScalar(0.01); this.popIns.push({ obj: g, t: 0 }); this.sparkle(g.position.clone().setY(1.3), 16); }
  }
  removeSubSign(h) {
    const g = this.subSigns.get(h.i); if (!g) return;
    this.scene.remove(g); this.subSigns.delete(h.i); this.poof(g.position.clone().setY(1), 0xffffff, 8);
  }
  updatePopIns(dt) {
    for (const p of this.popIns) {
      p.t += dt * 3.2;
      const e = Math.min(1, p.t);
      p.obj.scale.setScalar(Math.max(0.01, 1 + Math.sin(e * Math.PI * 1.5) * (1 - e) * 0.6 - (1 - e) * (1 - e)));
      if (e >= 1) { p.obj.scale.setScalar(1); p.done = true; }
    }
    this.popIns = this.popIns.filter(p => !p.done);
  }

  // ---------- supply ----------
  addStock(instant) {
    const it = M.makeItem(this.pro);
    const i = this.stock.length;
    const layer = Math.floor(i / 6), k = i % 6;
    const p = new THREE.Vector3(BASE.pallet.x + (k % 3 - 1) * 0.6, 0.3 + layer * it.userData.h + it.userData.h / 2, BASE.pallet.z + (Math.floor(k / 3) - 0.5) * 0.7);
    it.userData.home = p;
    this.scene.add(it);
    if (instant) it.position.copy(p);
    else this.fly(it, BASE.van.clone().add(new THREE.Vector3(0, 1.2, 1.6)), () => p, 0.45, 1.2, () => { sfx.pop(); });
    it.traverse(o => { o.castShadow = true; });
    this.stock.push(it);
  }

  // generic arcing flight; target may be a function (moving target)
  fly(obj, from, to, dur, h, done) {
    this.flyers.push({ obj, from: from.clone(), to, t: 0, dur, h, done });
  }

  // ---------- jobs ----------
  spawnJob(o = {}) {
    const busyHouses = new Set(this.jobs.map(j => j.house));
    const free = this.world.houses.filter(h => h.slot.unlock <= this.c.level && !busyHouses.has(h));
    if (!o.house && !free.length) return;
    const house = o.house || D.pick(free);
    const tmpl = o.tmpl || D.pick(this.P.jobs);
    const lv = this.c.level;
    const vip = !o.house && lv >= 2 && this.c.tut >= 2 && Math.random() < 0.15;
    const capTotal = this.cap + this.hcap;
    const need = o.need || Math.max(1, Math.min(capTotal, 1 + Math.floor(Math.random() * Math.min(5, 1 + Math.ceil(lv / 2)))));
    const dist = house.door.distanceTo(BASE.pallet);
    const max = (26 + dist * 1.2 + need * 5) * (1 - Math.min(0.3, (lv - 1) * 0.04)) * (vip ? 0.75 : 1) * (o.follow ? 1.25 : 1) + (this.c.tut < 2 ? 40 : 0);
    const name = o.name || D.pick(D.NAMES);
    const cust = M.makePerson({});
    if (vip) { // a little gold crown
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.16, 5, 1, true), M.mat(0xffc928, { side: THREE.DoubleSide, emissive: 0x6b4a00 }));
      crown.position.y = 0.36; cust.userData.head.add(crown);
    }
    cust.position.copy(house.door).addScaledVector(house.facing, -0.2);
    cust.rotation.y = Math.atan2(house.facing.x, house.facing.z);
    cust.scale.setScalar(0.001);
    this.scene.add(cust);
    const ring = ringMarker(vip ? 0xffb300 : o.follow ? 0x7ee787 : 0xffe066);
    ring.position.copy(house.door).addScaledVector(house.facing, 1.0); ring.position.y = 0.05;
    this.scene.add(ring);
    const job = {
      id: ++this.jobSeq, house, tmpl, need, delivered: 0, time: max, max, name, cust, ring,
      reward: Math.round((30 + need * 14 + lv * 7 + Math.random() * 12) * (vip ? 2.2 : 1) * (o.follow ? 1.4 : 1)),
      xp: Math.round((18 + need * 7 + lv * 2) * (vip ? 1.5 : 1)), state: 'open', excused: false, spot: ring.position.clone(), appear: 0, angry: false,
      vip, follow: !!o.follow, mood: (vip ? -1 : 0) + (o.follow ? 1 : 0), mult: 1, bonusTime: 0,
    };
    job.marker = this.ui.marker(() => tmp.copy(house.door).setY(3.2), vip ? '👑' : o.follow ? '🔁' : this.P.emoji);
    this.jobs.push(job);
    sfx.phone(); vibrate([30, 60, 30]);
    this.ui.toast({ icon: vip ? '👑' : '📱', name: `${vip ? 'לקוח VIP · ' : ''}${name} · ${tmpl.t}`, text: vip ? `${tmpl.m} (משלם כפול, אבל אין לו סבלנות)` : tmpl.m, dur: 5.5, cls: vip ? 'review' : '' });
  }

  updateJobs(dt) {
    const lv = this.c.level;
    const maxOpen = Math.min(4, 1 + Math.floor((lv + 1) / 2));
    const open = this.jobs.filter(j => j.state === 'open').length;
    for (const f of this.pendingFollow) {
      if (this.jobs.some(j => j.house === f.house)) continue;
      f.done = true;
      this.spawnJob({ house: f.house, name: f.name, follow: true, need: 1 + (Math.random() < 0.5 ? 1 : 0), tmpl: { t: `חזרה ל${f.name}`, m: `${f.extra}, כמו שסיכמנו 🙏` } });
    }
    this.pendingFollow = this.pendingFollow.filter(f => !f.done);
    this.jobT -= dt;
    if (this.jobT <= 0 && open < maxOpen && (this.c.tut >= 1 || this.jobs.length === 0)) {
      this.spawnJob();
      const r = this.rating;
      this.jobT = rand(6, 11) * (1.9 - r / 5) * (open === 0 ? 0.5 : 1);
    }
    let excuseJob = null;
    for (const j of this.jobs) {
      j.appear = Math.min(1, j.appear + dt * 3);
      if (j.state === 'open') {
        const s = j.appear < 1 ? ease(j.appear) * (1 + Math.sin(j.appear * Math.PI) * 0.3) : 1;
        j.cust.scale.setScalar(s);
        j.time -= dt;
        const frac = Math.max(0, j.time / j.max);
        this.ui.updateMarker(j.marker, frac, `${j.delivered}/${j.need} ${j.need === 1 ? this.P.itemOne : this.P.item}`, j.delivered >= j.need);
        j.ring.userData.ring.scale.setScalar(1 + Math.sin(performance.now() / 250) * 0.06);
        if (frac < 0.25 && !j.angry) { j.angry = true; const c = j.cust; this.ui.bubble(() => tmp2.copy(c.position).setY(2.3), '😤', 2, 'emoji'); }
        if (frac < 0.35 && !j.excused && (!excuseJob || j.time < excuseJob.time)) excuseJob = j;
        M.animatePerson(j.cust, dt, false);
        if (j.angry) j.cust.userData.body.rotation.y = Math.sin(performance.now() / 90) * 0.12;
        if (j.time <= 0) this.loseJob(j);
      } else if (j.state === 'leaving') {
        j.leaveT += dt;
        M.animatePerson(j.cust, dt, false);
        const u = j.cust.userData;
        if (j.happy) { j.cust.position.y = Math.abs(Math.sin(j.leaveT * 9)) * 0.5 * Math.max(0, 1 - j.leaveT / 1.8); u.arms[0].rotation.z = -2.6; u.arms[1].rotation.z = 2.6; }
        else { u.body.rotation.y = Math.sin(j.leaveT * 25) * 0.2; u.arms[0].rotation.x = u.arms[1].rotation.x = -1.4 + Math.sin(j.leaveT * 20) * 0.4; }
        if (j.leaveT > 2.2) { const k = Math.max(0, 1 - (j.leaveT - 2.2) * 4); j.cust.scale.setScalar(k); if (k === 0) j.dead = true; }
      }
    }
    for (const j of this.jobs) if (j.dead) { this.scene.remove(j.cust); this.scene.remove(j.ring); }
    this.jobs = this.jobs.filter(j => !j.dead);
    this.excuseJob = excuseJob;
    document.getElementById('excuseBtn').hidden = !excuseJob || this.busy;
  }

  loseJob(j) {
    j.state = 'leaving'; j.leaveT = 0; j.happy = false;
    this.ui.untrack(j.marker); this.scene.remove(j.ring);
    this.c.reviews.push(1); this.trimReviews();
    this.c.today.lost++;
    sfx.fail();
    this.ui.toast({ icon: '😡', name: j.name, text: `${j.name} ${D.pick(D.LATE_LINES)}`, cls: 'bad', stars: 1 });
    if (this.c.streak) { this.c.streak = 0; this.ui.float(this.player.position.clone().setY(3), 'הרצף נשבר 💔', 'bad'); }
    const si = this.c.subs.indexOf(j.house.i);
    if (si >= 0) {
      this.c.subs.splice(si, 1); this.removeSubSign(j.house);
      setTimeout(() => this.ui.toast({ icon: '📇', name: j.name, text: `${j.name} ${D.pick(D.UNSUB_LINES)}`, cls: 'bad' }), 1600);
    }
    this.refreshHUD();
  }

  excuse() {
    const j = this.excuseJob; if (!j || this.busy) return;
    sfx.tap(); j.excused = true; j.time += j.max * 0.5; j.max = Math.max(j.max, j.time); j.angry = false;
    j.cust.userData.body.rotation.y = 0;
    this.c.today.excuses++;
    this.ui.toast({ icon: '🧑‍🔧', name: `אתה → ${j.name}`, text: D.pick(D.EXCUSES), cls: 'me', dur: 2.8 });
    setTimeout(() => { sfx.phone(); this.ui.toast({ icon: '📱', name: j.name, text: D.pick(D.EXCUSE_REPLIES), dur: 3 }); }, 1300);
  }

  trimReviews() { while (this.c.reviews.length > 15) this.c.reviews.shift(); }

  async repair(j) {
    this.busy = true; j.state = 'repair';
    this.ui.stopInput(); this.ui.enabled = false;
    this.ui.untrack(j.marker); this.scene.remove(j.ring);
    document.getElementById('excuseBtn').hidden = true;
    this.vel.set(0, 0, 0);
    const c = j.cust;
    // how fast you came sets the opening mood
    const frac = j.time / j.max;
    if (frac > 0.6) j.mood += 1; else if (frac < 0.25) j.mood -= 1;
    this.ui.bubble(() => tmp2.copy(c.position).setY(2.3), frac > 0.6 ? 'איזה מהר! 😮' : frac < 0.25 ? 'סוף סוף!! 😤' : D.pick(D.ARRIVE_LINES), 1.6);
    await wait(800);
    await this.talk(j);
    duckMusic(true);
    const res = await runMiniGame(this.P.game, {
      title: `${this.P.emoji} ${j.tmpl.t}`, customer: `${j.name}: "${j.tmpl.m}"`,
      diff: Math.min(1, (this.c.level - 1) * 0.12 + j.need * 0.06 + (j.vip ? 0.15 : 0)), skill: this.c.up.skill, find: D.pick(this.P.finds), bonusTime: j.bonusTime,
    });
    duckMusic(false);
    const q = res.quality;
    const mood = clampMood(j.mood);
    const stars = Math.max(1, Math.min(5, Math.round(1 + q * 4) + (mood >= 2 ? 1 : mood <= -2 ? -1 : 0)));
    const bonus = 1 + this.c.up.skill * 0.15;
    const doorFee = res.kicked ? 120 : 0;
    const streakMult = this.streakMult;
    const amount = mult => Math.round(j.reward * mult * (0.55 + 0.45 * q) * bonus * j.mult * streakMult) + doorFee;
    const tipFor = id => id === 'greedy' || mood < 1 ? 0 : Math.round(j.reward * 0.15 * mood * (j.vip ? 2 : 1));
    const head = res.kicked ? '🦶 הדלת עפה. אבל נפתחה!' : q > 0.85 ? 'עבודה מושלמת!' : q > 0.55 ? 'העבודה הושלמה!' : q > 0.3 ? 'נו... זה עובד. בערך.' : 'אמ... לפחות ניסית?';
    const chips = [
      `<span class="chip">${D.MOODS[mood + 3]} מצב רוח</span>`,
      j.vip ? '<span class="chip gold">👑 VIP</span>' : '',
      j.mult !== 1 ? `<span class="chip">${j.mult > 1 ? '📈' : '📉'} x${j.mult.toFixed(2)}</span>` : '',
      streakMult > 1 ? `<span class="chip fire">🔥 רצף x${streakMult.toFixed(1)}</span>` : '',
      tipFor('fair') ? `<span class="chip gold">💛 טיפ ₪${tipFor('fair')}</span>` : '',
    ].join('');
    const choice = await this.ui.modal(`
      <h2>${head}</h2>
      <div class="stars">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.09}s">⭐</span>`).join('')}</div>
      <div class="chips">${chips}</div>
      <div class="quote">${esc(j.name)}: "נו, כמה אני חייב לך?"${res.kicked ? ' <br>(+ ₪120 דלת חדשה, כמובן)' : ''}</div>
      <div class="choices">${D.PRICES.map(p => `
        <button class="choice ${p.id}" data-v="${p.id}"><span class="ci">${p.icon}</span><span class="cb"><div class="cl">${p.label}</div><div class="cs">${p.sub}${tipFor(p.id) ? ' · + טיפ' : ''}</div></span><span class="ca">₪${amount(p.mult)}</span></button>`).join('')}
      </div>`);
    const pr = D.PRICES.find(p => p.id === choice);
    const money = amount(pr.mult);
    const tip = tipFor(choice);
    let final = stars;
    if (choice === 'greedy') final = Math.max(1, stars - 3);
    if (res.kicked) final = Math.min(final, 2);
    this.c.reviews.push(final); this.trimReviews();
    const t = this.c.today; t.jobs++; t.earned += money + tip; this.c.stats.jobs++; this.c.stats.earned += money + tip;
    if (choice === 'cash') t.cash++;
    if (choice === 'greedy') t.greedy++;
    if (res.kicked) t.kicked++;
    j.state = 'leaving'; j.leaveT = 0; j.happy = choice !== 'greedy' && final >= 3;
    c.userData.body.rotation.y = 0;
    this.ui.bubble(() => tmp2.copy(c.position).setY(2.3), j.happy ? D.pick(['😍', '🥳', '🙏', '👍']) : D.pick(['😡', '🤬', '😱', '💸']), 2, 'emoji');
    const door = j.house.door.clone().setY(1.2);
    this.burstCoins(door, money);
    sfx.kaching(); vibrate(30);
    this.ui.float(this.player.position.clone().setY(2.6), `+${Math.round(j.xp)} XP`, 'xp');
    if (tip) setTimeout(() => { this.burstCoins(door, tip, true); sfx.tip(); this.ui.float(door.clone().setY(2.6), `💛 טיפ +₪${tip}`, ''); }, 650);
    // streak of happy customers
    const good = final >= 4 && choice !== 'greedy';
    if (good) {
      this.c.streak++;
      if (this.c.streak >= 2) setTimeout(() => { sfx.streak(this.c.streak); this.ui.float(this.player.position.clone().setY(3.2), `🔥 רצף ${this.c.streak}! x${this.streakMult.toFixed(1)}`, ''); }, 900);
    } else if (final <= 2 && this.c.streak) { this.c.streak = 0; this.ui.float(this.player.position.clone().setY(3.2), 'הרצף נשבר 💔', 'bad'); }
    // happy customers may sign a maintenance subscription that pays into the register
    const hi = j.house.i;
    if (good && !this.c.subs.includes(hi) && (this.c.subs.length === 0 || Math.random() < D.subChance(this.c.up.ads) + (j.vip ? 0.25 : 0))) {
      this.c.subs.push(hi);
      setTimeout(() => {
        sfx.sub(); vibrate([20, 40, 20]);
        this.addSubSign(j.house);
        this.ui.toast({ icon: '📇', name: `${j.name} · מנוי אחזקה`, text: `${j.name} ${D.pick(D.SUB_LINES)} (+₪${(D.SUB_RATE * D.subMult(this.c.up.ads) * 60).toFixed(0)} לדקה)`, cls: 'review', dur: 5 });
      }, 2600);
    }
    setTimeout(() => {
      const pool = choice === 'greedy' ? D.REVIEWS.greedy : final >= 4 ? [...D.REVIEWS.great, ...this.P.praise] : final === 3 ? D.REVIEWS.ok : D.REVIEWS.bad;
      sfx.job();
      this.ui.toast({ icon: '⭐', name: `ביקורת מ${j.name}`, text: D.pick(pool), cls: final <= 2 ? 'review bad' : 'review', stars: final });
    }, 1500);
    if (choice === 'cash' && Math.random() < 0.2) {
      setTimeout(() => {
        const fine = Math.min(this.c.coins, Math.round(money * 0.6));
        this.c.coins -= fine; this.refreshHUD();
        sfx.fail(); vibrate([60, 40, 60]);
        this.ui.toast({ icon: '🏛️', name: 'מס הכנסה', text: `שלום! רק בודקים 👀 קנס: ₪${fine}. יום טוב!`, cls: 'bad', dur: 5 });
        this.ui.float(this.player.position.clone().setY(2.8), `-₪${fine}`, 'bad');
      }, 7000);
    }
    this.c.tut = Math.max(this.c.tut, 2);
    this.c.xp += j.xp;
    this.refreshHUD();
    this.ui.enabled = true;
    this.busy = false;
    await this.checkLevel();
    this.save();
  }

  // WhatsApp-style chat on the doorstep. Answers move the customer's mood and the price.
  talk(j) {
    let k; do { k = Math.floor(Math.random() * D.TALKS.length); } while ((k === this.lastTalk || (j.follow && D.TALKS[k].a.some(a => a.follow))) && D.TALKS.length > 2);
    this.lastTalk = k;
    const T = D.TALKS[k], extra = D.pick(D.EXTRAS);
    const fill = x => esc(x.replace('{extra}', extra));
    const face = () => D.MOODS[clampMood(j.mood) + 3];
    const meter = () => D.MOODS.map((m, i) => `<i class="${i === clampMood(j.mood) + 3 ? 'on' : ''}">${m}</i>`).join('');
    return this.ui.modal(`
      <div class="chat-head"><span class="cav">${face()}</span><div class="cn"><b>${esc(j.name)}${j.vip ? ' 👑' : ''}</b><small>${esc(j.tmpl.t)} · מקליד/ה...</small></div></div>
      <div class="moodbar">${meter()}</div>
      <div class="chat"><div class="msg them">${fill(T.q)}</div></div>
      <div class="answers">${T.a.map((a, i) => `<button class="ans" data-c="${i}">${fill(a.t)}</button>`).join('')}</div>`,
    (card, close) => {
      const chat = card.querySelector('.chat');
      sfx.phone();
      card.querySelectorAll('[data-c]').forEach(btn => btn.addEventListener('click', () => {
        card.querySelectorAll('[data-c]').forEach(b => { b.disabled = true; b.classList.toggle('picked', b === btn); });
        const a = T.a[+btn.dataset.c];
        let reply = a.r, dm = a.mood || 0, mult = a.mult || 1, note = a.note;
        if (a.upsell) {
          if (Math.random() < 0.55) { reply = D.pick(D.UPSELL_YES); dm = -1; mult = 1.5; note = 'מכרת לו מערכת חדשה! x1.5'; }
          else { reply = D.pick(D.UPSELL_NO); dm = -2; note = 'הוא לא קנה את זה'; }
        }
        chat.insertAdjacentHTML('beforeend', `<div class="msg me">${fill(a.t)}</div>`);
        sfx.send();
        setTimeout(() => {
          j.mood = clampMood(j.mood + dm); j.mult *= mult; j.bonusTime += a.time || 0;
          if (a.follow) this.pendingFollow.push({ house: j.house, name: j.name, extra });
          chat.insertAdjacentHTML('beforeend', `<div class="msg them">${esc(reply)}</div>${note || dm ? `<div class="fx ${dm > 0 ? 'up' : dm < 0 ? 'down' : ''}">${dm > 0 ? '😊 +' + dm : dm < 0 ? '😠 ' + dm : ''}${note ? ' · ' + esc(note) : ''}</div>` : ''}`);
          card.querySelector('.cav').textContent = face();
          card.querySelector('.cav').classList.add('pop');
          card.querySelector('.moodbar').innerHTML = meter();
          card.querySelector('.cn small').textContent = j.tmpl.t;
          if (dm > 0) sfx.moodUp(); else if (dm < 0) sfx.moodDown(); else sfx.bubble(3);
          setTimeout(() => close(a), 1500);
        }, 650);
      }));
    });
  }

  async checkLevel() {
    while (this.c.xp >= D.xpFor(this.c.level)) {
      this.c.xp -= D.xpFor(this.c.level); this.c.level++;
      this.busy = true; this.ui.stopInput(); this.ui.enabled = false;
      sfx.levelUp(); vibrate([40, 40, 40, 40, 120]);
      this.confetti();
      const unlocked = this.world.houses.filter(h => h.slot.unlock === this.c.level).length;
      await wait(500);
      await this.ui.modal(`
        <div class="lvl-up-badge">${this.c.level}</div>
        <h2>עלית רמה!</h2>
        <p class="sub">התואר החדש שלך:</p>
        <div class="quote" style="font-size:20px;font-weight:700">${esc(this.title())}</div>
        <p class="sub">הכרס גדלה בעוד 2 ס״מ. המקצועיות עולה. 🫃</p>
        ${unlocked ? `<p class="sub"><b>🏠 לקוחות VIP חדשים בשכונה!</b></p>` : ''}
        <button class="bigbtn" data-v="ok">יאללה, לעבודה</button>`);
      this.world.setLocks(this.c.level);
      this.syncUpgrades();
      this.refreshHUD();
      this.busy = false; this.ui.enabled = true;
    }
  }

  async endDay() {
    this.busy = true; this.ui.stopInput(); this.ui.enabled = false;
    const t = this.c.today;
    const lines = [];
    if (t.jobs === 0) lines.push('יום עבודה ישראלי קלאסי: הרבה קפה, אפס עבודה ☕');
    if (t.greedy) lines.push(`הרשות להגנת הצרכן פתחה עליך תיק (${t.greedy} מחירי מוסך) 🐷`);
    if (t.cash) lines.push(`${t.cash} עבודות בלי קבלה. רואה החשבון בוכה 🧾`);
    if (t.excuses > 1) lines.push(`שיא אישי: ${t.excuses} תירוצים ביום אחד! 🏆`);
    if (t.lost) lines.push(`מוטי תיקונים מודה לך על ${t.lost} לקוחות 🙏`);
    if (t.kicked) lines.push(`${t.kicked} דלתות נבעטו. הנגר של השכונה שולח פרחים 💐`);
    if (t.jobs >= 5 && !t.greedy) lines.push('הלקוחות כבר שומרים אותך באנשי קשר כ"אחי" ❤️');
    if (!lines.length) lines.push('יום סביר. אף אחד לא התלונן. עדיין.');
    sfx.success();
    await this.ui.modal(`
      <h2>🌇 סוף יום ${this.c.day}</h2>
      <p class="sub">${esc(D.pick(['הולכים הביתה. מחר עוד יום של "רק 5 דקות".', 'הטנדר חונה. הטלפון על שקט (סתם, אף פעם לא).', 'עוד יום שבו אף אחד לא קיבל קבלה.']))}</p>
      <div class="stats">
        <span>🔧 עבודות</span><b>${t.jobs}</b>
        <span>🪙 הרווחת</span><b>₪${t.earned}</b>
        <span>📱 תירוצים</span><b>${t.excuses}</b>
        <span>😡 לקוחות שברחו</span><b>${t.lost}</b>
        <span>⭐ דירוג</span><b>${this.rating.toFixed(1)}</b>
      </div>
      ${lines.map(l => `<div class="quote">${esc(l)}</div>`).join('')}
      <button class="bigbtn" data-v="ok">☀️ יום ${this.c.day + 1}</button>`);
    this.c.day++; this.c.dayT = 0;
    this.c.today = { jobs: 0, earned: 0, excuses: 0, cash: 0, greedy: 0, lost: 0, kicked: 0 };
    this.save();
    this.refreshHUD();
    this.busy = false; this.ui.enabled = true;
  }

  async menu() {
    if (!this.running || this.busy) return;
    sfx.tap();
    this.busy = true; this.ui.stopInput(); this.ui.enabled = false;
    const v = await this.ui.modal(`
      <h2>☕ הפסקת קפה</h2>
      <p class="sub">${esc(this.P.emoji + ' ' + this.title())} · יום ${this.c.day}</p>
      <div class="stats">
        <span>עבודות בקריירה</span><b>${this.c.stats.jobs}</b>
        <span>סה״כ הרווחת</span><b>₪${this.c.stats.earned}</b>
      </div>
      <button class="bigbtn" data-v="resume">המשך לעבוד</button>
      <button class="bigbtn alt" data-v="switch">🔁 החלף מקצוע</button>
      <button class="bigbtn alt" data-v="sound">${(await import('./audio.js')).isMuted() ? '🔇 צליל כבוי' : '🔊 צליל פועל'}</button>
      <button class="bigbtn warn" data-v="reset">🗑️ התחל קריירה מחדש</button>`);
    const audio = await import('./audio.js');
    if (v === 'sound') { audio.setMuted(!audio.isMuted()); this.busy = false; this.ui.enabled = true; return this.menu(); }
    if (v === 'switch') { this.save(); this.busy = false; this.onSwitch?.(); return; }
    if (v === 'reset') {
      const ok = await this.ui.modal(`<h2>בטוח?</h2><p class="sub">כל הכסף, הרמות והכרס של ה${esc(this.P.name)} ימחקו.</p><button class="bigbtn warn" data-v="y">כן, מחק</button><button class="bigbtn alt" data-v="n">לא, טעות</button>`);
      if (ok === 'y') { delete this.all.careers[this.pro]; this.save(); this.busy = false; this.start(this.pro); return; }
    }
    this.busy = false; this.ui.enabled = true;
  }

  // ---------- coins & effects ----------
  burstCoins(pos, value, gold) {
    const n = Math.max(6, Math.min(26, Math.round(value / 6)));
    let left = value;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.floor(value / n); left -= v;
      const m = M.makeCoin(); m.position.copy(pos); this.scene.add(m);
      if (gold) m.scale.setScalar(1.35);
      const a = Math.random() * Math.PI * 2, s = rand(2, 4.5);
      this.coins.push({ m, v, vel: new THREE.Vector3(Math.cos(a) * s, rand(5, 8), Math.sin(a) * s), t: 0, state: 'air', spin: rand(6, 12) });
    }
  }
  updateCoins(dt) {
    const pp = this.player.position;
    for (const c of this.coins) {
      c.t += dt; c.m.rotation.z += c.spin * dt;
      if (c.state === 'air') {
        c.vel.y -= 22 * dt; c.m.position.addScaledVector(c.vel, dt);
        if (c.m.position.y < 0.2) { if (c.vel.y < -3 && Math.random() < 0.3) sfx.bubble(8 + Math.floor(Math.random() * 4), 0.06); c.m.position.y = 0.2; c.vel.y *= -0.45; c.vel.x *= 0.6; c.vel.z *= 0.6; if (Math.abs(c.vel.y) < 1) c.state = 'ground'; }
        if (c.t > 0.7) c.state = 'mag';
      } else if (c.state === 'ground' || c.state === 'mag') {
        if (c.t > 0.45) c.state = 'mag';
        if (c.state === 'mag') {
          tmp.copy(pp).setY(1.1).sub(c.m.position);
          const d = tmp.length();
          const sp = 8 + c.t * 16;
          c.m.position.addScaledVector(tmp.normalize(), Math.min(d, sp * dt));
          if (d < 0.4) { c.dead = true; this.c.coins += c.v; sfx.coin(); this.ui.setCoins(this.c.coins, true); }
        }
      }
    }
    for (const c of this.coins) if (c.dead) this.scene.remove(c.m);
    this.coins = this.coins.filter(c => !c.dead);
  }

  poof(pos, color = 0xffffff, n = 8, size = 0.25) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(GEO.poof, M.mat(color)); m.userData.base = size;
      m.position.copy(pos).add(new THREE.Vector3(rand(-0.3, 0.3), rand(0.1, 0.5), rand(-0.3, 0.3)));
      const a = Math.random() * 6.28;
      this.scene.add(m);
      this.parts.push({ m, vel: new THREE.Vector3(Math.cos(a) * rand(1, 3), rand(1, 4), Math.sin(a) * rand(1, 3)), life: 0, max: rand(0.4, 0.8), g: 4 });
    }
  }
  sparkle(pos, n = 14) {
    const cols = [0xffe066, 0xffffff, 0x9cf7b8, 0xff9ff3];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(GEO.spark, basic(cols[i % cols.length]));
      m.position.copy(pos); this.scene.add(m);
      const a = Math.random() * 6.28, e = rand(0.3, 1.2);
      this.parts.push({ m, vel: new THREE.Vector3(Math.cos(a) * Math.cos(e) * 5, Math.sin(e) * 6, Math.sin(a) * Math.cos(e) * 5), life: 0, max: rand(0.6, 1.1), g: 9, spin: true });
    }
  }
  confetti() {
    const cols = [0xff5c8a, 0xffd93d, 0x6bcBff, 0x7ee787, 0xb388ff, 0xff8a3d];
    const p = this.player.position;
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(GEO.conf, basic(cols[i % cols.length], THREE.DoubleSide));
      m.position.set(p.x + rand(-1, 1), 1.5, p.z + rand(-1, 1)); this.scene.add(m);
      const a = Math.random() * 6.28;
      this.parts.push({ m, vel: new THREE.Vector3(Math.cos(a) * rand(1, 5), rand(7, 13), Math.sin(a) * rand(1, 5)), life: 0, max: rand(1.6, 2.6), g: 9, spin: true, drag: 1.6 });
    }
  }
  updateParts(dt) {
    for (const p of this.parts) {
      p.life += dt;
      p.vel.y -= p.g * dt;
      if (p.drag) { p.vel.multiplyScalar(Math.exp(-p.drag * dt)); }
      p.m.position.addScaledVector(p.vel, dt);
      if (p.m.position.y < 0.05) { p.m.position.y = 0.05; p.vel.set(0, 0, 0); }
      if (p.spin) { p.m.rotation.x += dt * 8; p.m.rotation.y += dt * 6; }
      const k = 1 - p.life / p.max;
      p.m.scale.setScalar(Math.max(0.001, (p.m.userData.base || 1) * (p.dust ? (0.6 + p.life * 2) * k : Math.min(1, k * 2))));
      if (p.life >= p.max) p.dead = true;
    }
    for (const p of this.parts) if (p.dead) this.scene.remove(p.m);
    this.parts = this.parts.filter(p => !p.dead);
  }
  dust(pos) {
    const m = new THREE.Mesh(GEO.poof, M.mat(0xf5efe4)); m.userData.base = 0.18;
    m.position.copy(pos).add(new THREE.Vector3(rand(-0.2, 0.2), 0.12, rand(-0.2, 0.2)));
    this.scene.add(m);
    this.parts.push({ m, vel: new THREE.Vector3(rand(-0.3, 0.3), 0.6, rand(-0.3, 0.3)), life: 0, max: 0.5, g: 0, dust: true });
  }

  // ---------- frame ----------
  update(dt, t) {
    if (!this.running) return;
    const c = this.c, pl = this.player, pp = pl.position;
    let moving = false;

    if (!this.busy) {
      const inp = this.ui.input();
      const target = tmp.set(inp.x, 0, inp.y).multiplyScalar(this.speed * inp.m);
      this.vel.lerp(target, 1 - Math.exp(-dt * 12));
      moving = this.vel.lengthSq() > 0.3;
      pp.addScaledVector(this.vel, dt);
      this.world.collide(pp, 0.45);
      if (moving) {
        const yaw = Math.atan2(this.vel.x, this.vel.z);
        let d = yaw - pl.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        pl.rotation.y += d * Math.min(1, dt * 14);
        this.dustT -= dt; if (this.dustT < 0) { this.dustT = this.scooter.visible ? 0.05 : 0.14; this.dust(pp); }
      }
      this.interact(dt);
      this.updateJobs(dt);
      c.dayT += dt;
      if (c.dayT >= DAY_LEN && !this.busy) this.endDay();
      this.saveT += dt; if (this.saveT > 8) { this.saveT = 0; this.save(); }
    } else {
      this.vel.multiplyScalar(0.8);
      for (const j of this.jobs) if (j.state === 'open' || j.state === 'repair') M.animatePerson(j.cust, dt, false);
    }

    // supply restock
    this.stockT += dt;
    if (this.stockT > D.vanRate(c.up.van) && this.stock.length < D.vanStock(c.up.van)) { this.stockT = 0; this.addStock(false); }

    const riding = this.scooter.visible;
    M.animatePerson(pl, dt, moving, { riding, carry: this.stack.length > 0 });
    if (riding) { pl.userData.body.position.y += 0.2; pl.userData.body.rotation.x = moving ? -0.12 : 0; this.scooter.userData.turbo.scale.setScalar(moving ? 1 + Math.sin(t * 40) * 0.2 : 0.4); }
    else pl.userData.body.rotation.x = 0;
    this.updateHelper(dt, t);
    this.layoutStack(pl, this.stack, dt, t);
    if (this.helper) this.layoutStack(this.helper, this.helperStack, dt, t);
    this.updateFlyers(dt);
    this.updateCoins(dt);
    this.updateParts(dt);
    this.updatePads(dt);
    this.updateRegister(dt);
    this.updatePopIns(dt);
    this.updateGuide();

    // honking cars
    this.honkT -= dt;
    if (this.honkT < 0) for (const car of this.world.cars) if (car.m.position.distanceTo(pp) < 2.6) {
      this.honkT = 4; sfx.honk(); const cp = car.m.position.clone().setY(2.2); this.ui.bubble(() => cp, D.pick(['צפצוף! 🚗', 'יא חמור! 🙄', 'תזוז, מקצוען!']), 1.4);
      break;
    }
    if (!this.busy) this.ui.setDay(c.day, c.dayT / DAY_LEN);
    this.world.setDayTime(c.dayT / DAY_LEN);
  }

  interact(dt) {
    const pp = this.player.position;
    // pick up at the pallet
    this.pickT -= dt;
    const nearPallet = Math.abs(pp.x - BASE.pallet.x) < 2.1 && Math.abs(pp.z - BASE.pallet.z) < 2.1;
    if (nearPallet && this.pickT <= 0 && this.stock.length) {
      let dest = null;
      if (this.stack.length < this.cap) dest = [this.player, this.stack];
      else if (this.helper && !this.helperBreak && this.helperStack.length < this.hcap && this.helper.position.distanceTo(BASE.pallet) < 5) dest = [this.helper, this.helperStack];
      if (dest) {
        const it = this.stock.pop();
        it.userData.fly = { from: it.position.clone(), t: 0 };
        dest[1].push(it);
        sfx.pick(dest[1].length); vibrate(6);
        this.pickT = 0.12;
        if (this.c.tut === 0) this.c.tut = 1;
        if (dest[1].length === (dest[1] === this.stack ? this.cap : this.hcap)) {
          const owner = dest[0]; this.ui.float(owner.position.clone().setY(3.2), 'מלא!', '');
        }
      }
    }
    // deliver to customers
    this.dropT -= dt;
    for (const j of this.jobs) {
      if (j.state !== 'open' || j.appear < 1) continue;
      const d = Math.hypot(pp.x - j.spot.x, pp.z - j.spot.z);
      if (d > 1.7) { j.near = false; continue; }
      if (j.delivered < j.need) {
        let src = this.stack.length ? this.stack : (this.helper && this.helperStack.length && this.helper.position.distanceTo(j.spot) < 5 ? this.helperStack : null);
        if (!src) {
          if (!j.near) { const cu = j.cust; this.ui.bubble(() => tmp2.copy(cu.position).setY(2.3), D.pick(D.EMPTY_LINES).replace('{item}', this.P.item), 2.2); }
        } else if (this.dropT <= 0) {
          const it = src.pop();
          it.userData.fly = null;
          const door = j.house.door.clone().setY(1.0);
          this.fly(it, it.position, door, 0.35, 1.4, () => { this.scene.remove(it); sfx.drop(); });
          j.delivered++;
          this.dropT = 0.14;
          vibrate(8);
        }
      }
      j.near = true;
      if (j.delivered >= j.need && !this.busy) { this.sparkle(j.house.door.clone().setY(1.2), 10); this.repair(j); break; }
    }
  }

  layoutStack(owner, stack, dt, t) {
    const u = owner.userData;
    u.sway ??= new THREE.Vector3();
    const vel = owner === this.player ? this.vel : (u.vel || tmp2.set(0, 0, 0));
    u.sway.lerp(tmp.copy(vel).multiplyScalar(-0.035), 1 - Math.exp(-dt * 6));
    const yaw = owner.rotation.y, sc = owner.scale.x;
    const base = new THREE.Vector3(0, 0.82 * sc, -0.42 * sc).applyAxisAngle(UP, yaw).add(owner.position);
    base.y += u.body.position.y;
    let y = 0;
    const n = stack.length;
    for (let i = 0; i < n; i++) {
      const it = stack[i], h = it.userData.h;
      const k = Math.pow((i + 1) / Math.max(4, n), 1.3) * (i + 1) * 0.5;
      const target = tmp.set(base.x + u.sway.x * k + Math.sin(t * 3 + i * 0.6) * 0.012 * i, base.y + y + h / 2, base.z + u.sway.z * k);
      y += h;
      const f = it.userData.fly;
      if (f) {
        f.t += dt / 0.28;
        const e = Math.min(1, f.t);
        it.position.lerpVectors(f.from, target, ease(e)); it.position.y += Math.sin(e * Math.PI) * 1.2;
        it.rotation.y = yaw + (1 - e) * 4;
        if (e >= 1) it.userData.fly = null;
      } else {
        it.position.copy(target);
        it.rotation.y = yaw;
      }
    }
  }

  updateFlyers(dt) {
    for (const f of this.flyers) {
      f.t += dt / f.dur;
      const e = Math.min(1, f.t);
      const to = typeof f.to === 'function' ? f.to() : f.to;
      f.obj.position.lerpVectors(f.from, to, ease(e));
      f.obj.position.y += Math.sin(e * Math.PI) * f.h;
      f.obj.rotation.y += dt * 8;
      if (e >= 1) { f.dead = true; f.done?.(); }
    }
    this.flyers = this.flyers.filter(f => !f.dead);
  }

  updatePads(dt) {
    const pp = this.player.position;
    for (const pad of this.pads) {
      const g = pad.group.position, u = pad.u, lvl = this.c.up[u.id];
      const on = Math.abs(pp.x - g.x) < 1.25 && Math.abs(pp.z - g.z) < 1.25 && !this.busy;
      pad.dwell = on ? pad.dwell + dt : 0;
      pad.pulse = Math.max(0, pad.pulse - dt * 3);
      pad.group.scale.setScalar(1 + pad.pulse * 0.12);
      if (on && lvl < u.max && pad.dwell > 0.45 && this.c.coins > 0) {
        this.payT -= dt;
        let flown = 0;
        while (this.payT <= 0 && this.c.coins > 0 && this.c.up[u.id] === lvl) { // several payments per frame on slow devices
          this.payT += 0.045;
          const cost = D.upgradeCost(u, lvl);
          const chunk = Math.min(this.c.coins, Math.max(1, Math.ceil(cost / 28)), cost - pad.paid);
          this.c.coins -= chunk; pad.paid += chunk;
          this.ui.setCoins(this.c.coins);
          if (!flown++) {
            const m = M.makeCoin(); this.scene.add(m);
            this.fly(m, pp.clone().setY(1.4), g.clone().setY(0.3), 0.3, 1, () => this.scene.remove(m));
            sfx.pay();
          }
          if (pad.paid >= cost) {
            pad.paid = 0; this.c.up[u.id]++;
            pad.pulse = 1;
            sfx.upgrade(); vibrate([20, 30, 60]);
            this.sparkle(g.clone().setY(0.5), 22);
            this.ui.float(g.clone().setY(2), `${u.icon} ${u.desc(this.c.up[u.id])}`, '');
            this.syncUpgrades();
            this.drawPads();
            this.save();
          } else this.drawPad(pad);
        }
      }
    }
    // keep pad colours honest about affordability
    this.padRedrawT = (this.padRedrawT || 0) - dt;
    if (this.padRedrawT < 0) { this.padRedrawT = 0.6; this.drawPads(); }
  }
  drawPads() { for (const p of this.pads) this.drawPad(p); }

  updateHelper(dt, t) {
    const h = this.helper; if (!h) return;
    const u = h.userData;
    this.helperBreakT -= dt;
    if (!this.helperBreak && this.helperBreakT < 0 && !this.busy) {
      this.helperBreak = 6; this.helperBreakT = 35 + Math.random() * 25;
      this.ui.bubble(() => tmp2.copy(h.position).setY(2.1), 'השוליה ' + D.pick(D.HELPER_BREAKS), 5);
    }
    let moving = false;
    if (this.helperBreak) {
      this.helperBreak = Math.max(0, this.helperBreak - dt);
      u.vel = new THREE.Vector3();
      if (!this.helperBreak) this.ui.bubble(() => tmp2.copy(h.position).setY(2.1), 'אני פה! אני פה!', 1.4);
    } else {
      const pl = this.player, back = new THREE.Vector3(0, 0, -1.5).applyAxisAngle(UP, pl.rotation.y).add(new THREE.Vector3(0.9, 0, 0).applyAxisAngle(UP, pl.rotation.y));
      const target = pl.position.clone().add(back);
      const d = target.sub(h.position); d.y = 0;
      const dist = d.length();
      const sp = this.speed * (dist > 3 ? 1.25 : 0.95);
      u.vel = dist > 0.35 ? d.normalize().multiplyScalar(Math.min(sp, dist * 4)) : new THREE.Vector3();
      moving = dist > 0.35;
      h.position.addScaledVector(u.vel, dt);
      this.world.collide(h.position, 0.4);
      if (moving) { const yaw = Math.atan2(u.vel.x, u.vel.z); let a = yaw - h.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); h.rotation.y += a * Math.min(1, dt * 10); }
    }
    M.animatePerson(h, dt, moving, { carry: this.helperStack.length > 0 });
    if (this.helperBreak) { u.arms[1].rotation.x = -2.2; u.head.rotation.z = 0.25; } else u.head.rotation.z = 0;
  }

  updateGuide() {
    // point at the van when we need stuff, else nothing (job markers do the rest)
    const wantVan = this.jobs.some(j => j.state === 'open' && j.delivered < j.need) && this.stack.length === 0 && this.helperStack.length === 0;
    if (wantVan && !this.guideEl) this.guideEl = this.ui.guide(() => tmp2.copy(BASE.pallet).setY(2.2), '⬇️');
    if (!wantVan && this.guideEl) { this.ui.untrack(this.guideEl); this.guideEl = null; }
    // ribbon
    let r = null;
    const open = this.jobs.filter(j => j.state === 'open');
    if (this.busy) r = null;
    else if (this.c.tut === 0 && open.length) r = `אסוף ${this.P.item} מהטנדר 🛻`;
    else if (this.c.tut === 1 && open.length) r = 'קדימה ללקוח! עקוב אחרי הסימן ❗';
    else if (this.c.register >= 25 && !this.c.collected) r = 'יש כסף בקופה! לך לאסוף 💰';
    else if (!open.length) r = 'מחכים לטלפון... 📱';
    else if (this.c.stats.jobs < 4 && this.c.coins >= D.upgradeCost(D.UPGRADES[0], this.c.up.belt) && this.c.up.belt === 0) r = 'עמוד על משטח שדרוג כדי לקנות 🎒';
    this.ui.ribbon(r);
  }
}

const GEO = { poof: new THREE.IcosahedronGeometry(1, 0), spark: new THREE.OctahedronGeometry(0.13, 0), conf: new THREE.PlaneGeometry(0.18, 0.28) };
const basicCache = new Map();
function basic(color, side) {
  const k = color + '|' + (side || 0);
  if (!basicCache.has(k)) basicCache.set(k, new THREE.MeshBasicMaterial({ color, side: side || THREE.FrontSide }));
  return basicCache.get(k);
}

function makeScooter() {
  const g = new THREE.Group();
  const deck = M.mesh(M.roundedBox(0.36, 0.08, 1.2, 0.04), 0x1e1e1e); deck.position.set(0, 0.16, 0); g.add(deck);
  const stem = M.mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 8), 0xe53935); stem.position.set(0, 0.68, 0.55); stem.rotation.x = -0.12; g.add(stem);
  const bar = M.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), 0x1e1e1e); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.18, 0.62); g.add(bar);
  for (const z of [-0.55, 0.6]) { const w = M.mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14), 0x333333); w.rotation.z = Math.PI / 2; w.position.set(0, 0.13, z); g.add(w); }
  const turbo = new THREE.Group();
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xff9d00 })); flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0.2, -0.9); turbo.add(flame);
  const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xfff176 })); fl2.rotation.x = -Math.PI / 2; fl2.position.set(0, 0.2, -0.82); turbo.add(fl2);
  g.add(turbo); g.userData.turbo = turbo;
  g.position.y = -0.0;
  return g;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const clampMood = m => Math.max(-3, Math.min(3, m));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
