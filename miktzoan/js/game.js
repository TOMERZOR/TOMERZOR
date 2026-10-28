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
    this.buildPads();
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
    this.ui.untrack(this.guideEl); this.guideEl = null;
    this.helper = null;
    this.running = false;
  }

  save() {
    if (!this.c) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.all)); } catch {}
  }

  // ---------- derived ----------
  get cap() { return D.capacity(this.c.up.belt); }
  get hcap() { return D.helperCap(this.c.up.helper); }
  get rating() { const r = this.c.reviews; return r.reduce((a, b) => a + b, 0) / r.length; }
  title(l = this.c.level) { return D.TITLES[Math.min(l - 1, D.TITLES.length - 1)].replace('{pro}', this.P.name); }

  refreshHUD() {
    const c = this.c, need = D.xpFor(c.level);
    this.ui.setCoins(c.coins);
    this.ui.setRating(this.rating);
    this.ui.setLevel(c.level, Math.min(1, c.xp / need), this.title());
    this.ui.setDay(c.day, c.dayT / DAY_LEN);
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
      group.position.set(-6 + i * 3, 0, BASE.padsZ);
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
  spawnJob() {
    const busyHouses = new Set(this.jobs.map(j => j.house));
    const free = this.world.houses.filter(h => h.slot.unlock <= this.c.level && !busyHouses.has(h));
    if (!free.length) return;
    const house = D.pick(free);
    const tmpl = D.pick(this.P.jobs);
    const lv = this.c.level;
    const capTotal = this.cap + this.hcap;
    const need = Math.max(1, Math.min(capTotal, 1 + Math.floor(Math.random() * Math.min(5, 1 + Math.ceil(lv / 2)))));
    const dist = house.door.distanceTo(BASE.pallet);
    const max = (26 + dist * 1.2 + need * 5) * (1 - Math.min(0.3, (lv - 1) * 0.04)) + (this.c.tut < 2 ? 40 : 0);
    const name = D.pick(D.NAMES);
    const cust = M.makePerson({});
    cust.position.copy(house.door).addScaledVector(house.facing, -0.2);
    cust.rotation.y = Math.atan2(house.facing.x, house.facing.z);
    cust.scale.setScalar(0.001);
    this.scene.add(cust);
    const ring = ringMarker(0xffe066);
    ring.position.copy(house.door).addScaledVector(house.facing, 1.0); ring.position.y = 0.05;
    this.scene.add(ring);
    const job = {
      id: ++this.jobSeq, house, tmpl, need, delivered: 0, time: max, max, name, cust, ring,
      reward: Math.round(30 + need * 14 + lv * 7 + Math.random() * 12),
      xp: 18 + need * 7 + lv * 2, state: 'open', excused: false, spot: ring.position.clone(), appear: 0, angry: false,
    };
    job.marker = this.ui.marker(() => tmp.copy(house.door).setY(3.2), this.P.emoji);
    this.jobs.push(job);
    sfx.phone(); vibrate([30, 60, 30]);
    this.ui.toast({ icon: '📱', name: `${name} · ${tmpl.t}`, text: tmpl.m, dur: 5.5 });
  }

  updateJobs(dt) {
    const lv = this.c.level;
    const maxOpen = Math.min(4, 1 + Math.floor((lv + 1) / 2));
    const open = this.jobs.filter(j => j.state === 'open').length;
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
    this.ui.bubble(() => tmp2.copy(c.position).setY(2.3), D.pick(D.ARRIVE_LINES), 1.6);
    await wait(900);
    duckMusic(true);
    const res = await runMiniGame(this.P.game, {
      title: `${this.P.emoji} ${j.tmpl.t}`, customer: `${j.name}: "${j.tmpl.m}"`,
      diff: Math.min(1, (this.c.level - 1) * 0.12 + j.need * 0.06), skill: this.c.up.skill, find: D.pick(this.P.finds),
    });
    duckMusic(false);
    const q = res.quality;
    const stars = Math.max(1, Math.min(5, Math.round(1 + q * 4)));
    const bonus = 1 + this.c.up.skill * 0.15;
    const doorFee = res.kicked ? 120 : 0;
    const amount = mult => Math.round(j.reward * mult * (0.55 + 0.45 * q) * bonus) + doorFee;
    const head = res.kicked ? '🦶 הדלת עפה. אבל נפתחה!' : q > 0.85 ? 'עבודה מושלמת!' : q > 0.55 ? 'העבודה הושלמה!' : q > 0.3 ? 'נו... זה עובד. בערך.' : 'אמ... לפחות ניסית?';
    const choice = await this.ui.modal(`
      <h2>${head}</h2>
      <div class="stars">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.09}s">⭐</span>`).join('')}</div>
      <div class="quote">${esc(j.name)}: "נו, כמה אני חייב לך?"${res.kicked ? ' <br>(+ ₪120 דלת חדשה, כמובן)' : ''}</div>
      <div class="choices">${D.PRICES.map(p => `
        <button class="choice ${p.id}" data-v="${p.id}"><span class="ci">${p.icon}</span><span class="cb"><div class="cl">${p.label}</div><div class="cs">${p.sub}</div></span><span class="ca">₪${amount(p.mult)}</span></button>`).join('')}
      </div>`);
    const pr = D.PRICES.find(p => p.id === choice);
    let money = amount(pr.mult);
    let final = stars;
    if (choice === 'greedy') final = Math.max(1, stars - 3);
    if (res.kicked) final = Math.min(final, 2);
    this.c.reviews.push(final); this.trimReviews();
    const t = this.c.today; t.jobs++; t.earned += money; this.c.stats.jobs++; this.c.stats.earned += money;
    if (choice === 'cash') t.cash++;
    if (choice === 'greedy') t.greedy++;
    if (res.kicked) t.kicked++;
    j.state = 'leaving'; j.leaveT = 0; j.happy = choice !== 'greedy' && final >= 3;
    c.userData.body.rotation.y = 0;
    this.ui.bubble(() => tmp2.copy(c.position).setY(2.3), j.happy ? D.pick(['😍', '🥳', '🙏', '👍']) : D.pick(['😡', '🤬', '😱', '💸']), 2, 'emoji');
    this.burstCoins(tmp.copy(j.house.door).setY(1.2), money);
    sfx.cash(); vibrate(30);
    this.ui.float(this.player.position.clone().setY(2.6), `+${Math.round(j.xp)} XP`, 'xp');
    // review lands a moment later
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
  burstCoins(pos, value) {
    const n = Math.max(6, Math.min(26, Math.round(value / 6)));
    let left = value;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.floor(value / n); left -= v;
      const m = M.makeCoin(); m.position.copy(pos); this.scene.add(m);
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
        if (c.m.position.y < 0.2) { c.m.position.y = 0.2; c.vel.y *= -0.45; c.vel.x *= 0.6; c.vel.z *= 0.6; if (Math.abs(c.vel.y) < 1) c.state = 'ground'; }
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
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
