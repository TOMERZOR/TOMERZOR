// The heist's sneaking: guards who walk their rounds, a vision triangle on the sand for each
// (cut short by walls, green → yellow → red as they grow suspicious), hearing for runners,
// takedowns from behind, and things to pick up or hold E at. The two sneaking preps (the
// tools from our storeroom, the shirts off Johnny's laundry line) are made of it here, and
// the finale (js/heist/finale.js) builds on it.
// Online the host's phone moves the guards and decides who's been seen; each player moves
// themselves and sends what they did as events (Heist.emit).

const HS_GST = ['patrol', 'post', 'inv', 'spot', 'run', 'hunt', 'down', 'sleep', 'off'];
const HS_GREEN = new THREE.Color(0x4fe06a), HS_YELLOW = new THREE.Color(0xffd23a), HS_RED = new THREE.Color(0xff3324);

const HSStealth = {
  // ---------- players ----------
  // Everyone in the crew who walks the map (the platoon bots only if withBots).
  makePlayers(spawn, withBots = false) {
    const H = Heist;
    this.ps = H.crew.filter(c => !c.bot || withBots).map((c, i) => {
      const look = Arcade.look(c.isMe ? null : (Cast.get(c.who) ? c.who : null));
      const m = H.soldier(look, c.isMe ? `⭐ ${c.name}` : c.name, c.isMe ? { bg: 'rgba(242,193,46,.95)', fg: '#1b1b1b' } : {});
      const [x, z] = spawn(i);
      return { ...c, m, x, z, a: -Math.PI / 2, vx: 0, vz: 0, v: 0, run: false, carry: 0, caught: false, down: false, hp: 100 };
    });
    this.mePl = this.ps.find(p => p.isMe);
  },
  humans() { return this.ps.filter(p => !p.bot); },

  // ---------- guards ----------
  // g: { x, z, a, path: [[x, z, wait]], post (stands, sweeping), sleep, look (cast id), R, half, staff, rifle }
  addGuard(o) {
    const H = Heist, i = this.gs.length;
    const look = o.look ? Arcade.look(o.look) : H.gonniLook(i);
    const tag = o.look ? fmt(`{@${o.look}}`) : o.name || null;
    const m = H.soldier(look, tag, { bg: 'rgba(90,20,16,.82)' });
    if (o.rifle) H.arm(m, 'rifle');
    const g = { i, m, x: o.x, z: o.z, a: o.a || 0, base: o.a || 0, hx: o.x, hz: o.z, path: o.path || null, pi: 0, wait: 0, st: o.sleep ? 'sleep' : o.path ? 'patrol' : 'post', sus: 0, R: o.R || 9, half: o.half || 0.62, sweep: o.sweep == null ? 0.7 : o.sweep, staff: !!o.staff, look: o.look, rifle: !!o.rifle, v: 0, line: o.line || null, t: Math.random() * 10 };
    // The triangle: a fan on the ground, cut where it hits a wall.
    const N = 14, pos = new Float32Array((N + 2) * 3), idx = [];
    for (let k = 1; k <= N; k++) idx.push(0, k, k + 1);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    g.cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: HS_GREEN.clone(), transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    g.cone.frustumCulled = false; g.cone.renderOrder = 2; g.N = N;
    H.scene.add(g.cone);
    g.mark = Scene3D.label('?', { bg: 'rgba(255,210,58,.95)', fg: '#3a1a0a', size: 0.55 }); g.mark.position.y = 2.75; g.mark.visible = false; m.root.add(g.mark);
    g.zz = Scene3D.label('💤', { bg: 'rgba(0,0,0,0)', size: 0.6 }); g.zz.position.y = 1.0; g.zz.visible = false; m.root.add(g.zz);
    this.gs.push(g);
    return g;
  },
  // Host: the guards' rounds, eyes and ears. seenMul(g, p) scales how fast p is noticed.
  simGuards(dt) {
    const H = Heist;
    for (const g of this.gs) {
      g.t += dt;
      if (g.st === 'down' || g.st === 'off') continue;
      let saw = null, best = 0;
      for (const p of this.ps) {
        if (p.bot || p.caught || p.down || p.hidden) continue;
        const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz);
        if (d > Math.max(g.R, 7)) continue;
        let da = Math.atan2(dz, dx) - g.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        const R = g.st === 'sleep' ? 0 : g.R;
        let rate = 0;
        if (d < R && Math.abs(da) < g.half && H.los(g.x, g.z, p.x, p.z)) rate = (1.3 - 0.8 * d / R) * (p.run ? 1.8 : 1) * 0.95;
        else if (d < 1.1 && g.st !== 'sleep') rate = 2.5;
        // Running is loud: they hear it (a sleeper wakes up).
        if (p.run && d < (g.st === 'sleep' ? 4 : 6.5)) { rate = Math.max(rate, 0.5); if (g.st === 'sleep') this.wake(g); }
        rate *= this.seenMul ? this.seenMul(g, p) : 1;
        if (rate > best) { best = rate; saw = p; }
      }
      if (saw) {
        g.sus = Math.min(1, g.sus + best * dt);
        g.lx = saw.x; g.lz = saw.z;
        if (g.sus >= 1 && g.st !== 'spot' && g.st !== 'run' && g.st !== 'hunt') { this.spotted(g, saw); continue; }
      } else if (g.st !== 'spot' && g.st !== 'run' && g.st !== 'hunt') g.sus = Math.max(0, g.sus - dt * 0.22);
      if (this.extraSim) this.extraSim(g, dt, saw);
      this.moveGuard(g, dt, saw);
    }
  },
  wake(g) {
    if (g.st !== 'sleep') return;
    g.st = 'post'; g.sus = Math.max(g.sus, 0.4);
    Heist.pop(g.x, g.z, '😳 ?!', { y: 2.4 });
  },
  // Noise (a shot, the drill): those near enough come to look.
  noise(x, z, r, k = 0.55) {
    for (const g of this.gs) {
      if (g.st === 'down' || g.st === 'off' || g.st === 'run' || g.st === 'hunt' || g.st === 'spot') continue;
      if (Math.hypot(g.x - x, g.z - z) > r) continue;
      if (g.st === 'sleep') this.wake(g);
      g.sus = Math.min(0.95, g.sus + k);
      g.st = 'inv'; g.tx = x; g.tz = z; g.invT = 0; g.invAge = 0;
    }
  },
  moveGuard(g, dt, saw) {
    const H = Heist;
    const turn = (want, rate) => { let da = want - g.a; da = Math.atan2(Math.sin(da), Math.cos(da)); g.a += Math.max(-rate * dt, Math.min(rate * dt, da)); };
    const walkTo = (x, z, sp) => {
      const dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz);
      if (d < 0.35) return true;
      turn(Math.atan2(dz, dx), 4);
      g.x += Math.cos(g.a) * sp * dt; g.z += Math.sin(g.a) * sp * dt;
      H.collide(g, 0.3);
      g.v = sp;
      return false;
    };
    g.v = 0;
    // Suspicious: stop and stare at where they saw you.
    if (saw && g.sus > 0.3 && (g.st === 'patrol' || g.st === 'post' || g.st === 'inv')) { turn(Math.atan2(saw.z - g.z, saw.x - g.x), 3.2); if (g.sus > 0.6 && g.st !== 'post') { if (g.st !== 'inv') g.invAge = 0; g.st = 'inv'; g.tx = saw.x; g.tz = saw.z; g.invT = 0; } return; }
    if (g.st === 'patrol') {
      const w = g.path[g.pi];
      if (g.wait > 0) { g.wait -= dt; g.a += Math.sin(g.t * 1.6) * dt * g.sweep * 1.4; if (g.wait <= 0) g.pi = (g.pi + 1) % g.path.length; return; }
      if (walkTo(w[0], w[1], 1.8)) g.wait = w[2] || 0.8;
    } else if (g.st === 'post') {
      if (Math.hypot(g.hx - g.x, g.hz - g.z) > 0.5) { walkTo(g.hx, g.hz, 1.8); return; }
      turn(g.base + Math.sin(g.t * 0.55) * g.sweep, 1.2);
    } else if (g.st === 'inv') {
      // Can't get there (a wall in the way): give up after a while.
      g.invAge = (g.invAge || 0) + dt;
      if (g.invAge > 9 && !g.invT) g.invT = 0.01;
      if (g.invT > 0 || walkTo(g.tx, g.tz, 2.4)) {
        g.invT += dt; g.a += Math.sin(g.t * 2.4) * dt * 2;
        if (g.invT > 3.2) { g.st = g.path ? 'patrol' : 'post'; g.invT = 0; }
      }
    } else if (g.st === 'sleep') {
      g.a = g.base;
    } else if (this.moveSpecial) this.moveSpecial(g, dt, walkTo, turn);
  },
  // The triangle on the ground, and the guard drawn where the host says.
  drawGuards(dt) {
    const H = Heist;
    for (const g of this.gs) {
      if (!H.host && g.tx2 != null) { const k = Math.min(1, dt * 8); g.x += (g.tx2 - g.x) * k; g.z += (g.tz2 - g.z) * k; let da = g.ta2 - g.a; da = Math.atan2(Math.sin(da), Math.cos(da)); g.a += da * k; }
      if (g.st === 'off') { g.m.root.visible = false; g.cone.visible = false; continue; }
      g.m.root.visible = true;
      const down = g.st === 'down', sleep = g.st === 'sleep';
      const m = g.m, L = m.lean || m.root;
      if (down) {
        g.fall = Math.min(1, (g.fall || 0) + dt * 2.5);
        m.root.position.set(g.x, 0, g.z);
        L.rotation.z = -1.45 * g.fall * g.fall; m.root.position.y = 0.12 * g.fall;
        if (m.mixer) m.mixer.update(0);
      } else {
        g.fall = 0; L.rotation.z = 0; m.root.position.y = 0;
        Arcade.pose(m, g.x, g.z, g.a, g.v || 0, dt);
        if (sleep) { Scene3D.animateSoldier(m, { x: g.x / S3, y: g.z / S3, angle: g.a, speed: 0, sit: true }, false, dt); L.rotation.z = 0.18; }
      }
      if (g.rifle && m.gunMount) { m.gunMount.visible = !down; if (!down) H.aim(m, g.a, g.st === 'hunt' ? 0 : 0.75); }
      g.zz.visible = down || sleep;
      g.zz.position.y = down ? 0.9 : 1.9 + Math.sin(performance.now() / 300) * 0.1;
      // ?: getting suspicious; !: seen.
      const hot = g.st === 'spot' || g.st === 'run' || g.st === 'hunt';
      g.mark.visible = !down && !sleep && (g.sus > 0.3 || hot);
      if (g.mark.visible) { const want = hot || g.sus >= 1 ? '!' : '?'; if (g.markT !== want) { g.markT = want; m.root.remove(g.mark); g.mark = Scene3D.label(want, { bg: want === '!' ? 'rgba(255,51,36,.95)' : 'rgba(255,210,58,.95)', fg: want === '!' ? '#fff' : '#3a1a0a', size: 0.55 }); g.mark.position.y = 2.75; m.root.add(g.mark); } }
      this.drawCone(g);
    }
  },
  drawCone(g) {
    const H = Heist, c = g.cone;
    const show = g.st !== 'down';
    c.visible = show;
    if (!show) return;
    const R = g.st === 'sleep' ? 1.2 : g.R, half = g.st === 'sleep' ? 2.8 : g.half;
    const pos = c.geometry.attributes.position.array, N = g.N;
    pos[0] = g.x; pos[1] = 0.05; pos[2] = g.z;
    for (let k = 0; k <= N; k++) {
      const a = g.a - half + (2 * half) * k / N, d = g.st === 'sleep' ? R : H.ray(g.x, g.z, a, R);
      pos[(k + 1) * 3] = g.x + Math.cos(a) * d; pos[(k + 1) * 3 + 1] = 0.05; pos[(k + 1) * 3 + 2] = g.z + Math.sin(a) * d;
    }
    c.geometry.attributes.position.needsUpdate = true;
    c.geometry.computeBoundingSphere();
    const s = (g.st === 'spot' || g.st === 'run' || g.st === 'hunt') ? 1 : g.sus;
    if (s < 0.5) c.material.color.copy(HS_GREEN).lerp(HS_YELLOW, s * 2); else c.material.color.copy(HS_YELLOW).lerp(HS_RED, (s - 0.5) * 2);
    c.material.opacity = 0.2 + s * 0.22 + (s > 0.85 ? Math.sin(performance.now() / 60) * 0.06 : 0);
  },
  guardsOut() { return this.gs.map(g => [Math.round(g.x * 10) / 10, Math.round(g.z * 10) / 10, Math.round(g.a * 100) / 100, Math.round(g.sus * 100), HS_GST.indexOf(g.st), g.v > 3 ? 2 : g.v > 0.2 ? 1 : 0]); },
  guardsIn(list) {
    if (!Array.isArray(list)) return;
    list.forEach((q, i) => {
      const g = this.gs[i];
      if (!g || !Array.isArray(q)) return;
      g.tx2 = +q[0]; g.tz2 = +q[1]; g.ta2 = +q[2]; g.sus = (+q[3] || 0) / 100;
      const st = HS_GST[q[4]] || 'patrol';
      // A takedown I just did stays down even if the host hasn't heard yet.
      if (!(g.myDown && performance.now() - g.myDown < 2500 && st !== 'down')) g.st = st;
      g.v = q[5] === 2 ? 5 : q[5] === 1 ? 1.8 : 0;
    });
  },

  // ---------- me and the others ----------
  moveMe(dt, mul = 1) {
    const H = Heist, p = this.mePl;
    if (!p || p.caught || p.down || p.hidden) { if (p) { p.vx = p.vz = 0; p.v = 0; } return; }
    const inp = this.live ? Arcade.input() : { x: 0, y: 0, run: false };
    p.v = H.walk(p, dt, inp, mul, this.bounds);
  },
  // The others: from their presence (online), and how everyone's drawn.
  movePeers(dt) {
    const H = Heist;
    const others = H.peers();
    for (const p of this.ps) {
      if (p.isMe || p.bot) continue;
      const o = others.find(q => q.who === p.who);
      if (!o) continue;
      const s = o.s;
      H.smooth(p, s, dt);
      p.run = !!s.r; p.carry = s.c || 0; p.hidden = !!s.hd; p.down = !!s.dn;
      p.v = Math.hypot(p.vx, p.vz);
    }
  },
  drawPlayers(dt) {
    for (const p of this.ps) {
      const m = p.m, L = m.lean || m.root;
      m.root.visible = !p.hidden;
      if (p.hidden) continue;
      if (p.caught) {
        // Push-ups by the guard who caught you.
        Arcade.pose(m, p.x, p.z, p.a, 0, dt);
        L.rotation.z = -1.25 - Math.abs(Math.sin(performance.now() / 300)) * 0.2; m.root.position.y = 0.06;
        continue;
      }
      if (p.down) { Arcade.pose(m, p.x, p.z, p.a, 0, 0); L.rotation.z = -1.45; m.root.position.y = 0.12; continue; }
      L.rotation.z = 0; m.root.position.y = 0;
      Arcade.pose(m, p.x, p.z, p.a, p.v || 0, dt);
      if (m.gunMount) { m.gunMount.visible = true; Heist.aim(m, p.a, p.aimT > 0 ? 0 : 0.8); }
      if (this.drawCarry) this.drawCarry(p);
    }
  },

  // ---------- things to use: E, or held E ----------
  // u: { x, z, r, label, hold (s), ok(), on(), key }
  nearUse() {
    const p = this.mePl;
    if (!p || p.caught || p.down || !this.live) return null;
    let best = null, bd = Infinity;
    for (const u of this.uses) {
      if (u.ok && !u.ok()) continue;
      const d = Math.hypot(p.x - u.x(), p.z - u.z());
      if (d < (u.r || 1.4) && d < bd) { bd = d; best = u; }
    }
    return best;
  },
  updateUses(dt) {
    const H = Heist, u = this.nearUse();
    if (u !== this.useNow) { this.useNow = u; this.holdT = u && u.keep ? u.prog || 0 : 0; }
    if (!u) { H.hint(''); H.meter(null); return; }
    const held = Arcade.input().held, label = typeof u.label === 'function' ? u.label() : u.label;
    if (u.hold) {
      if (held) { this.holdT += dt; if (u.tick) u.tick(dt, this.holdT); }
      else if (!u.keep) this.holdT = Math.max(0, this.holdT - dt * 2);
      if (u.keep) u.prog = this.holdT;
      H.meter(this.holdT > 0 ? this.holdT / u.hold : null, u.doing || label);
      H.hint(this.holdT > 0 && held ? '' : `להחזיק E — ${fmt(label)}`);
      if (this.holdT >= u.hold) { this.holdT = 0; u.prog = 0; H.meter(null); u.on(); this.useNow = null; }
    } else { H.meter(null); H.hint(`${G.touch ? '' : 'E — '}${fmt(label)}`); }
  },
  useTap() {
    const u = this.nearUse();
    if (u && !u.hold) { u.on(); return true; }
    return false;
  },
  // A takedown: from behind, or while they haven't noticed you yet.
  takedownTarget() {
    const p = this.mePl;
    if (!p || p.caught || p.down || !this.live) return null;
    let best = null;
    for (const g of this.gs) {
      if (g.st === 'down' || g.st === 'off') continue;
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d > 1.7) continue;
      let da = Math.atan2(p.z - g.z, p.x - g.x) - g.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      const behind = Math.abs(da) > 1.4, unaware = g.sus < 0.6 && g.st !== 'hunt';
      if (behind || unaware || g.st === 'sleep') best = g;
    }
    return best;
  },
  flashUse(g) { void g; },

  // ---------- the stage's intro: a few shots of the map, then play ----------
  intro(seq, then) {
    const H = Heist, n = H.n;
    this.live = false;
    H.play(seq).then(() => { if (H.n !== n) return; this.live = true; if (then) then(); });
  },
};

// ---------- a sneaking prep: pick things up, bring them back, don't get seen ----------
// cfg: { id, intro(), build(), guards(), items: [{ x, z, icon, name }], exit: [x, z], bounds,
//        caughtLine(g), winSeq(), failSeq() }
function hsSneakPrep(cfg) {
  return Object.assign(Object.create(HSStealth), {
    cfg,
    enter() {
      const H = Heist;
      H.world(cfg.world || {});
      this.gs = []; this.uses = []; this.bounds = cfg.bounds; this.live = false; this.over = 0;
      cfg.build.call(this, H);
      this.dress();
      this.makePlayers((i) => [cfg.exit[0] + (i % 2) * 1.4 - 0.7, cfg.exit[1] + Math.floor(i / 2) * 1.4 - 0.4]);
      cfg.guards.call(this, H);
      this.st = { cg: [], it: cfg.items.map(() => 0), done: 0 };
      // The things to take: a glow and a label each.
      this.items = cfg.items.map((it, i) => {
        const g = new THREE.Group();
        let m = it.model && Assets.model(it.model, it.fit || { length: 0.9 });
        if (!m) { m = Scene3D.label(it.icon, { bg: 'rgba(0,0,0,0)', size: 0.8 }); m.position.y = 0.6; }
        g.add(m);
        const glow = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
        glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; g.add(glow);
        g.position.set(it.x, it.y || 0, it.z); H.scene.add(g);
        this.uses.push({ x: () => it.x, z: () => it.z, r: 1.5, hold: it.hold || 1, label: `לקחת ${it.name}`, doing: `${it.icon} לוקח[/ת]...`, ok: () => !this.st.it[i] && !this.over, on: () => this.take(i) });
        return { ...it, g, glow, beam: H.beacon(it.x, it.z, 0xffd34a, 4, 0.35) };
      });
      this.exitB = H.beacon(cfg.exit[0], cfg.exit[1], 0x5adfff, 8);
      this.exitB.visible = false;
      H.cam.position.set(cfg.exit[0], 14, cfg.exit[1] + 10);
      H.cam.lookAt(cfg.exit[0], 0, cfg.exit[1]);
      Sound.music('night');
      this.intro(cfg.intro.call(this, H));
    },
    dress() { if (cfg.dress) cfg.dress.call(this, Heist); },
    take(i) {
      const H = Heist;
      this.st.it[i] = H.me.who; this.mineCarry = (this.mineCarry || 0) + 1;
      Sound.pickup();
      H.pop(this.items[i].x, this.items[i].z, `${this.items[i].icon} ✔`);
      if (!H.host) H.emit('take', i);
      const left = this.st.it.filter(x => !x).length;
      Arcade.say(left ? `${this.items[i].icon} עוד ${left} — ואז חזרה ל${cfg.exitName}` : `✔ יש! עכשיו בשקט חזרה ל${cfg.exitName}`, null, 2600);
    },
    onEv(who, t, a) {
      if (this.over) return;
      if (t === 'take') { const i = a[0] | 0; if (this.st.it[i] === 0) this.st.it[i] = who; }
      if (t === 'exit') this.win();
    },
    // Host: someone's been seen.
    spotted(g, p) {
      const H = Heist;
      if (this.over || p.caught) return;
      g.st = 'spot'; g.spotT = 0;
      p.caught = true;
      if (!this.st.cg.includes(p.who)) this.st.cg.push(p.who);
      // What they carried goes back where it was.
      this.st.it = this.st.it.map(w => (w === p.who ? 0 : w));
      if (p.isMe) this.caughtMe(g);
      else Arcade.say(`🔦 <bdi data-raw>${esc(p.name)}</bdi> נתפס[/ה]!`, null, 2200);
      if (this.humans().every(q => q.caught)) { this.over = 2; this.st.done = 2; setTimeout(() => this.fail(g), 1400); }
    },
    caughtMe(g) {
      const H = Heist, p = this.mePl;
      p.caught = true; this.mineCarry = 0;
      Sound.whistle(); Sound.bad(); G.shake = 0.4;
      Arcade.big('🔦 נתפסת!', 1600);
      p.x = g.x + Math.cos(g.a) * 1.4; p.z = g.z + Math.sin(g.a) * 1.4; p.a = g.a + Math.PI;
      H.pop(g.x, g.z, cfg.caughtLine(g), { bg: 'rgba(255,248,230,.97)', y: 2.5 });
    },
    extraSim(g, dt) {
      if (g.st === 'spot') { g.v = 0; g.spotT = (g.spotT || 0) + dt; if (g.spotT > 4 && !this.over) { g.st = g.path ? 'patrol' : 'post'; g.sus = 0; } }
    },
    win() {
      const H = Heist;
      if (this.over) return;
      this.over = 1; this.st.done = 1;
      if (H.host) H.prepDone(cfg.id, 1);
      this.finished();
    },
    finished() {
      const H = Heist, n = H.n;
      Sound.fanfare();
      Arcade.big('✅ ההכנה הושלמה', 1800);
      H.meter(null); H.hint('');
      setTimeout(() => {
        if (H.n !== n) return;
        H.play(cfg.winSeq.call(this, H)).then(() => { if (H.n === n && H.host) H.go('board'); });
      }, 1600);
    },
    fail(g) {
      const H = Heist, n = H.n;
      if (H.n !== n) return;
      Sound.bad();
      H.play(cfg.failSeq.call(this, H, g)).then(() => { if (H.n === n && H.host) H.go(cfg.id); });
    },
    update(dt, t) {
      const H = Heist, me = this.mePl;
      if (!H.host) {
        const st = H.hostSt();
        if (st) {
          this.guardsIn(st.g);
          if (Array.isArray(st.it)) this.st.it = st.it;
          for (const w of st.cg || []) { const p = this.ps.find(q => q.who === w); if (p && !p.caught) { if (p.isMe) { const g = this.gs.reduce((a, b) => (Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a)); this.caughtMe(g); } else p.caught = true; } }
          if (st.done === 1 && !this.over) { this.over = 1; this.finished(); }
          if (st.done === 2 && !this.over) { this.over = 2; this.fail(this.gs[0]); }
        }
      }
      this.moveMe(dt);
      this.movePeers(dt);
      if (H.host && this.live && !this.over) this.simGuards(dt);
      else if (H.host) for (const g of this.gs) this.extraSim(g, dt);
      // Home with everything: done.
      const allGot = this.st.it.every(Boolean);
      this.exitB.visible = allGot && !this.over;
      if (allGot && !this.over && me && !me.caught && this.mineCarry && Math.hypot(me.x - cfg.exit[0], me.z - cfg.exit[1]) < 2.4) { if (H.host) this.win(); else { H.emit('exit'); this.exitSent = true; } }
      if (this.roof && cfg.room && me) this.roof.visible = !(me.x > cfg.room[0] && me.x < cfg.room[1] && me.z > cfg.room[2] && me.z < cfg.room[3]);
      this.drawGuards(dt);
      this.drawPlayers(dt);
      this.items.forEach((it, i) => { const got = !!this.st.it[i]; it.g.visible = !got; it.beam.visible = !got && !this.over; H.pulse(it.beam, t / 1000); it.g.rotation.y += dt; });
      H.pulse(this.exitB, t / 1000);
      // Staff are staff: no takedowns at our own base.
      const near = !this.over && this.live && me && !me.caught && this.gs.find(g => Math.hypot(g.x - me.x, g.z - me.z) < 1.6);
      this.uses.staff = near;
      if (near) H.hint(`${G.touch ? '' : 'E — '}${cfg.staffHint}`); else this.updateUses(dt);
      const got = this.st.it.filter(Boolean).length, all = this.st.it.length;
      H.obj(this.over === 1 ? '✅ הושלם' : me && me.caught ? '🔦 נתפסת — מחכים לשאר הצוות' : allGot ? `🏃 חזרה ל${cfg.exitName}! (העמוד הכחול)` : `${cfg.items[0].icon} ${cfg.goal} · ${got}/${all}`);
      const hot = this.gs.reduce((m, g) => Math.max(m, g.sus), 0);
      H.stat(hot > 0.3 ? `${hot > 0.75 ? '🔴' : '🟡'} חושדים בך!` : '🟢 שקט');
      if (this.live && !this.over) H.banter(dt, hot > 0.5 ? 'seen' : 'sneak', hot > 0.5 ? 6 : 24);
      H.updatePops(dt);
      H.follow(me && me.caught ? { x: me.x, z: me.z, vx: 0, vz: 0 } : me, dt);
    },
    act() {
      const H = Heist;
      if (!this.live || this.over) return;
      if (this.uses.staff) { const g = this.uses.staff; Arcade.say(fmt(pick(cfg.staffLines)), g.look || null, 2600); return; }
      this.useTap();
      void H;
    },
    mine() { const p = this.mePl; return p ? { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, a: Math.round(p.a * 100) / 100, r: p.run ? 1 : 0, c: this.mineCarry || 0 } : {}; },
    hostOut() { return { g: this.guardsOut(), it: this.st.it, cg: this.st.cg, done: this.st.done }; },
    leave() { Heist.meter(null); Heist.hint(''); },
  });
}

// ---------- prep 1: the tools, from our own battery's storeroom ----------
Heist.stages.tools = hsSneakPrep({
  id: 'tools', exitName: 'הטנדר', room: [-6, 6, -11.5, -4.5], goal: 'לקחת את תיק הפריצה מהמחסן', exit: [-17, 12], bounds: [-22, 22, -16, 16],
  staffHint: 'את הרס"ר לא מפילים. לא אם רוצים לצאת הביתה השבוע.',
  staffLines: ['"מה את[ה/] עושה פה? ...לא משנה. אני לא רוצה לדעת."', '"אני רואה הכל. כמעט הכל. רוב הדברים."', '"למה את[ה/] מחייך[/ת] ככה?"'],
  items: [{ x: 3.6, z: -9.4, icon: '🧰', name: 'את תיק הפריצה', model: 'hs_bag', fit: { length: 1.1 }, hold: 1.4 }],
  build(H) {
    const wall = H.mat(0xc9b48c, { map: Arcade.texture('assets/tex/wall.jpg', 2) });
    // The storeroom: 12 × 7, its door to the south; shelves inside.
    const R = this.room = new THREE.Group(); H.scene.add(R);
    H.box(0, -11.5, 12, 0.3, 3, wall); H.box(-6, -8, 0.3, 7, 3, wall); H.box(6, -8, 0.3, 7, 3, wall);
    H.box(-3.6, -4.5, 4.8, 0.3, 3, wall); H.box(3.6, -4.5, 4.8, 0.3, 3, wall);
    this.roof = H.box(0, -8, 12.4, 7.4, 0.2, H.mat(0x8a8a80), { y: 3, col: false });
    const shelf = H.mat(0x5d6a72, { metalness: 0.4, roughness: 0.6 });
    for (const x of [-4, -0.5, 3]) { H.box(x, -10.7, 2.6, 0.8, 2.2, shelf); for (let k = 0; k < 4; k++) H.box(x + (k - 1.5) * 0.6, -10.7, 0.45, 0.5, 0.4, H.mat([0x6b7a3a, 0x8a6a3a, 0x3a5a6a][k % 3]), { y: 0.5 + (k % 2) * 0.9, col: false }); }
    H.box(-3.5, -7, 0.8, 2.6, 1.8, shelf); H.box(1, -7.5, 0.8, 2.2, 1.8, shelf);
    const lamp = new THREE.PointLight(0xffe0a0, 0.9, 10, 1.5); lamp.position.set(0, 2.6, -8); H.scene.add(lamp);
    const door = new THREE.PointLight(0xffc070, 1.1, 9, 1.5); door.position.set(0, 3.2, -3.6); H.scene.add(door);
    // The yard: a sign, containers, sandbags, our van by the gate.
    this.van = { x: -17.5, z: 14 };
    H.cols.push({ x: -19.5, z: 14.5, hw: 2.6, hd: 1.2, h: 2 });
    this.decor = [];
    H.fence(-22, -16, 22, -16); H.fence(-22, 16, 22, 16, [[-15, -12]]); H.fence(-22, -16, -22, 16); H.fence(22, -16, 22, 16);
    for (const [x, z, w, d] of [[-12, 2, 6.2, 2.6], [12.5, -2, 2.6, 6.2], [-14, -10, 2.6, 6.2], [14, 10, 6.2, 2.6]]) H.col(x, z, w, d, 2.6);
    H.col(-4, 6, 3.2, 1, 1.05); H.col(6, 4, 1, 3.2, 1.05);
    for (const [x, z] of [[-8, 12], [8, -14], [18, 4]]) { const l = new THREE.PointLight(0xffd890, 0.8, 14, 1.6); l.position.set(x, 4.5, z); H.scene.add(l); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 6), H.mat(0x555a50)); pole.position.set(x, 2.3, z); H.scene.add(pole); }
  },
  dress(H) {
    for (const o of this.decor || []) H.scene.remove(o);
    this.decor = [];
    const add = (m) => { if (m) { H.scene.add(m); this.decor.push(m); } return m; };
    const cont = (x, z, ry) => { const m = Assets.model('container', { size: [2.6, 2.6, 6.2] }); if (m) { m.position.set(x, 0, z); m.rotation.y = ry; add(m); } else add(H.box(x, z, ry ? 6.2 : 2.6, ry ? 2.6 : 6.2, 2.6, H.mat(0x5b6b3c), { col: false })); };
    cont(-12, 2, Math.PI / 2); cont(12.5, -2, 0); cont(-14, -10, 0); cont(14, 10, Math.PI / 2);
    const bags = (x, z, ry, L) => { const m = Assets.model('arc_sandbags', { length: L }); if (m) { m.position.set(x, 0, z); m.rotation.y = ry; add(m); } else add(H.box(x, z, ry ? 1 : L, ry ? L : 1, 1, H.mat(0xa08a5a), { col: false })); };
    bags(-4, 6, 0, 3.2); bags(6, 4, Math.PI / 2, 3.2);
    const van = Assets.model('car_hilux', { length: 5.2, rotY: Math.PI / 2 }); if (van) { van.position.set(-19.5, 0, 14.5); add(van); } else add(H.box(-19.5, 14.5, 5.2, 2.4, 1.8, H.mat(0xdedede), { col: false }));
    const l = Assets.model('launcher', { depth: 7 }); if (l) { l.position.set(17, 0, -11); l.rotation.y = -0.5; add(l); }
    const g = Assets.model('generator', { length: 2.4 }); if (g) { g.position.set(8, 0, 12.5); add(g); }
  },
  guards(H) {
    this.addGuard({ look: 'harasar', x: -9, z: -1.5, path: [[-9, -1.5, 1.6], [9, -1.5, 1.2], [9, -14, 1.6], [-9, -14, 1.2]], R: 9, half: 0.6, staff: true });
    this.addGuard({ look: Cast.get('deputy_rasap') ? 'deputy_rasap' : null, x: -1.5, z: 9.5, a: -Math.PI / 2 - 0.4, R: 6.5, half: 0.55, sweep: 1.1, staff: true });
    this.addGuard({ look: Cast.get('sarsap') ? 'sarsap' : null, x: -16, z: 5.5, path: [[-16, 5.5, 2], [16, 5.5, 2]], R: 8, half: 0.55, staff: true });
  },
  intro(H) {
    return [
      { img: 'assets/heist/prep_tools.jpg', who: H.ctx.solo ? 'p_shaked' : '', text: 'המחסן של הסוללה. 01:20. בפנים, על המדף האחורי — תיק עם מקדחה וקאטר. בחוץ — {@harasar}, שלא ישן אף פעם.' },
      { shot: { from: [-12, 16, 22], to: [8, 14, 20], at: [0, 0, -6], dur: 6500 }, text: 'המשולשים על הרצפה זה מה שהם רואים. ירוק — רגוע. צהוב — חושד. אדום — נתפסת. ריצה עושה רעש.', icon: '👀' },
      { shot: { from: [2, 5, 1], to: [3, 3.4, -4], at: [3.6, 0.5, -9.4], dur: 5000 }, who: H.ctx.solo ? 'p_nevo' : '', text: 'אני מחכה בטנדר. עם המנוע דולק. ...והמזגן. ואולי אני אנמנם רגע.' },
    ];
  },
  caughtLine: () => fmt('{@harasar}: "מה את[ה/] עושה פה?! 20 שכיבות!"'),
  winSeq(H) {
    return [
      { img: 'assets/heist/prep_tools.jpg', who: H.ctx.solo ? 'p_liran' : '', text: 'מקדחה, קאטר, ופנס. ו... חבילת וופלים שמישהו החביא בתיק. זה נשאר איתנו.' },
      { who: H.ctx.solo ? 'p_nevo' : '', text: '*מתעורר בטנדר* כבר? יופי. אני הייתי הרכב המילוט הכי טוב שהיה לכם.' },
    ];
  },
  failSeq(H, g) {
    void g;
    return [
      { img: 'assets/heist/fail.jpg', who: 'harasar', text: 'באחת וחצי בלילה. ליד המחסן. עם כפפות. ...אני לא אשאל. כולם לישון, ומחר אני רוצה לראות את המחסן מבריק.' },
      { who: H.ctx.solo ? 'p_shaked' : '', text: 'בסדר. אנחנו מנסים שוב. הפעם — לא בתוך המשולש.' },
    ];
  },
});

// ---------- prep 4 (bonus): Johnny's shirts, off their laundry line at Palmachim ----------
Heist.stages.uni = hsSneakPrep({
  id: 'uni', exitName: 'הג\'יפ', goal: 'לאסוף 4 חולצות של ג׳וני', exit: [-17, 11], bounds: [-20, 20, -14, 14],
  staffHint: 'זה חייל של ג׳וני. כאן לא מפילים — רק גונבים כביסה.',
  staffLines: ['"אתם מג׳וני? ...לא נראה לי שראיתי אתכם."', '"מי לקח לי את החולצה?!"', '"שקט, אני בטלפון עם אמא."'],
  items: [{ x: -5, z: -6, icon: '🎽', name: 'חולצה', hold: 0.8 }, { x: 4.5, z: 0, icon: '🎽', name: 'חולצה', hold: 0.8 }, { x: -2, z: 6, icon: '🎽', name: 'חולצה', hold: 0.8 }, { x: 7, z: -6, icon: '🎽', name: 'חולצה', hold: 0.8 }],
  build(H) {
    // Three clotheslines between posts, shirts flapping on them.
    const post = H.mat(0x6b6f68, { metalness: 0.4 });
    this.shirts = [];
    const cloth = [0x5b6b3c, 0x4f5d32, 0x66763f, 0xb9b39a];
    for (const z of [-6, 0, 6]) {
      for (const x of [-9, 9]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), post); p.position.set(x, 1.2, z); H.scene.add(p); H.col(x, z, 0.2, 0.2, 2.4); }
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 18, 4), H.mat(0xdddddd)); line.rotation.z = Math.PI / 2; line.position.set(0, 2.25, z); H.scene.add(line);
      for (let x = -8; x <= 8; x += 1.6) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), H.mat(cloth[Math.abs(Math.round(x + z)) % 4], { side: THREE.DoubleSide }));
        s.position.set(x, 1.7, z); H.scene.add(s); this.shirts.push(s);
      }
      // A line of washing hides you like a wall (low and soft, but they can't see through).
      H.cols.push({ x: 0, z, hw: 8.4, hd: 0.05, h: 1.25, soft: true });
    }
    H.fence(-20, -14, 20, -14); H.fence(-20, 14, 20, 14, [[-15, -11]]); H.fence(-20, -14, -20, 14); H.fence(20, -14, 20, 14);
    for (const [x, z, w, d] of [[-14, -6, 2.6, 6.2], [14, 4, 2.6, 6.2], [2, -11.5, 6.2, 2.6]]) H.col(x, z, w, d, 2.6);
    for (const [x, z] of [[-10, 10], [12, -10]]) { const l = new THREE.PointLight(0xffd890, 0.9, 15, 1.6); l.position.set(x, 4.5, z); H.scene.add(l); }
    this.decor = [];
  },
  dress(H) {
    for (const o of this.decor || []) H.scene.remove(o);
    this.decor = [];
    const add = (m) => { if (m) { H.scene.add(m); this.decor.push(m); } };
    const cont = (x, z, ry) => { const m = Assets.model('container', { size: [2.6, 2.6, 6.2] }); if (m) { m.position.set(x, 0, z); m.rotation.y = ry; add(m); } else add(H.box(x, z, ry ? 6.2 : 2.6, ry ? 2.6 : 6.2, 2.6, H.mat(0x5b6b3c), { col: false })); };
    cont(-14, -6, 0); cont(14, 4, 0); cont(2, -11.5, Math.PI / 2);
    const j = Assets.model('pickup', { length: 4.6 }) || Assets.model('car_sufa', { length: 4.1, rotY: Math.PI / 2 }); if (j) { j.position.set(-18.2, 0, 7.5); j.rotation.y = Math.PI / 2; add(j); }
    const t = Assets.model('tower', { height: 7 }); if (t) { t.position.set(17, 0, -11); add(t); }
  },
  guards(H) {
    this.addGuard({ x: -10, z: -3, path: [[-10, -3, 1.4], [10, -3, 1.4], [10, 3, 1.4], [-10, 3, 1.4]], R: 8.5, rifle: true, name: 'שומר מג׳וני' });
    this.addGuard({ x: 12, z: -9, a: Math.PI * 0.85, R: 7, half: 0.55, sweep: 1.0, rifle: true, name: 'מעשן מג׳וני' });
    this.addGuard({ x: 16, z: 9.5, path: [[16, 9.5, 2], [-8, 9.5, 2]], R: 8, rifle: true, name: 'שומר מג׳וני' });
  },
  intro(H) {
    return [
      { img: 'assets/heist/prep_uni.jpg', who: H.ctx.solo ? 'p_liran' : '', text: 'פלמחים, 02:10. חבל הכביסה של ג׳וני. ארבע חולצות עם הסמל שלהם — ואנחנו ג׳וני. לפחות לחצי שעה.' },
      { shot: { from: [-14, 13, 18], to: [10, 12, 16], at: [0, 0, 0], dur: 6500 }, text: 'הכביסה מסתירה אותך מהם — אפשר לעבור דרכה. אבל המשולשים... עדיין רואים.', icon: '👀' },
    ];
  },
  caughtLine: () => 'שומר מג׳וני: "היי! זאת החולצה שלי?!"',
  winSeq(H) {
    return [
      { img: 'assets/heist/prep_uni.jpg', who: H.ctx.solo ? 'p_shaked' : '', text: 'ארבע חולצות של ג׳וני. אחת עם כתם חומוס, אחת במידה XXL. מי שמתלונן — מקבל את ה־XXL.' },
    ];
  },
  failSeq(H) {
    return [
      { img: 'assets/heist/fail.jpg', name: 'שומר מג׳וני', icon: '🪖', text: 'מה, גונבים כביסה? מאיזו סוללה אתם? ...לכו מפה לפני שאני קורא לקצין.' },
      { who: H.ctx.solo ? 'p_nevo' : '', text: 'אמרתי לכם ללבוש שחור. אף אחד לא מקשיב לי.' },
    ];
  },
});
