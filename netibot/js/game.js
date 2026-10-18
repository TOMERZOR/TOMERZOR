// Main loop, input, player, NPCs, camera, HUD and menus.
const G = {
  profile: null,
  state: null,
  player: { x: 0, y: 0, r: 12, angle: 0, walk: 0, carry: false, running: false },
  npcs: [],
  cam: { x: 0, y: 0, w: 800, h: 600, zoom: 1 },
  keys: new Set(),
  stick: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  touch: false,
  touchRun: false,
  paused: true,
  running: false,
  alert: null,
  perk: null,
  shake: 0,
  lowEnergyWarned: false,
};

const canvas = $('#world');
const overlay = $('#overlay');
const octx = overlay.getContext('2d');
const mini = $('#minimap');
const mctx = mini.getContext('2d');
let miniBase = null;

// Where each cast member stands on each site: a fixed tile, or a wander region.
const WANDER = {
  netivot: [{ x0: 27, y0: 17, x1: 34, y1: 34 }, { x0: 35, y0: 22, x1: 43, y1: 28 }, { x0: 19, y0: 30, x1: 28, y1: 33 }, { x0: 33, y0: 9, x1: 50, y1: 15 }, { x0: 13, y0: 9, x1: 26, y1: 13 }],
  hq: [{ x0: 4, y0: 13, x1: 59, y1: 23 }, { x0: 24, y0: 26, x1: 34, y1: 40 }, { x0: 40, y0: 32, x1: 59, y1: 40 }],
  field: [{ x0: 20, y0: 30, x1: 40, y1: 40 }, { x0: 26, y0: 18, x1: 40, y1: 28 }],
};
const LAYOUT = {
  netivot: {
    commander: () => SPOTS.commander, sergeant: () => SPOTS.sergeantDoor, inspector: () => tc(33, 30), friend: () => tc(27, 31), ruth: () => SPOTS.pullup,
    p_liran: [43, 28], p_shaked: () => TRACK_POINTS[0],
  },
  hq: {
    bc: [26, 7], deputy_bc: [27, 12], harasar: [32, 8], rasap: [45, 8], deputy_rasap: [48, 7], sarsap: [46, 13], interceptors: [55, 9],
    ops: [9, 8], hamalist: [15, 9], medic1: [7, 29], medic2: [10, 27], medic3: [10, 29], tech_comms: [38, 28], tech_ground: [41, 28], tech_launch: [43, 27],
    driver1: [9, 34], driver2: [13, 38], officer1: null, officer2: null, officer3: null,
  },
  field: { commander: [33, 31], driver1: [28, 37], driver2: [33, 37], p_nevo: null, p_shalev: null, p_ofek: null, p_miriam: null },
};
const WANDERERS = new Set(['friend', 'inspector', 'officer1', 'officer2', 'officer3', 'harasar', 'rasap']);
// Who hunts for idle soldiers on each site.
const CHASERS = { netivot: 'inspector', hq: 'rasap' };

const Game = {
  // ---------- boot ----------
  init() {
    Cast.init();
    World.use('netivot');
    G.map = 'netivot';
    Scene3D.init(canvas);
    Scene3D.build();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const saveNow = () => { if (G.running && G.state) this.save(); };
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
    G.touch = matchMedia('(pointer: coarse)').matches;
    document.body.classList.toggle('touch', G.touch);
    this.title();
    requestAnimationFrame(t => this.frame(t));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    Scene3D.resize(w, h, dpr);
    overlay.width = Math.floor(w * dpr);
    overlay.height = Math.floor(h * dpr);
    G.cam.w = w;
    G.cam.h = h;
    G.dpr = dpr;
  },

  // ---------- input ----------
  bindInput() {
    document.addEventListener('keydown', (e) => {
      Sound.unlock();
      if (e.target.tagName === 'INPUT') return;
      G.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!G.running) return;
      if ((e.code === 'Tab' || e.code === 'KeyP') && !Mini.active && !UI.busy && !UI.menuOpen()) UI.togglePhone();
      if (e.code === 'Escape' && !Mini.active) {
        if (!$('#phone').classList.contains('hidden')) UI.togglePhone(false);
        else if (UI.mapOpen()) UI.toggleMap(false);
        else UI.toggleMenu();
      }
      if (e.code === 'KeyM') this.toggleAudio('music');
      if (e.code === 'KeyN') this.toggleAudio('sfx');
      if (e.code === 'KeyG' && !Mini.active && !UI.busy && !UI.menuOpen()) UI.toggleMap();
      if (e.code === 'KeyT' && Multi.on && !Mini.active && !UI.busy) { e.preventDefault(); UI.chat(); }
      if ((e.code === 'KeyE' || e.code === 'Enter') && !UI.busy && !Mini.active && !G.paused && !UI.mapOpen()) this.interact();
    });
    document.addEventListener('keyup', (e) => G.keys.delete(e.code));
    window.addEventListener('blur', () => G.keys.clear());

    // Virtual joystick.
    const stick = $('#stick'), knob = $('#stick-knob');
    let sid = null, cx = 0, cy = 0;
    const moveStick = (x, y) => {
      let dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx, dy), max = 60;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      G.stick.x = dx / max; G.stick.y = dy / max;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener('pointerdown', (e) => {
      Sound.unlock();
      sid = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      stick.setPointerCapture(sid);
      moveStick(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e.clientX, e.clientY); });
    const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; G.stick.x = G.stick.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    // Second joystick on the right: look around.
    const lstick = $('#look'), lknob = $('#look-knob');
    let lid = null, lx = 0, ly = 0;
    const moveLook = (x, y) => {
      let dx = x - lx, dy = y - ly;
      const d = Math.hypot(dx, dy), max = 60;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      G.look.x = dx / max; G.look.y = dy / max;
      lknob.style.transform = `translate(${dx}px, ${dy}px)`;
      Scene3D.lastLook = performance.now();
    };
    lstick.addEventListener('pointerdown', (e) => {
      Sound.unlock();
      lid = e.pointerId;
      const r = lstick.getBoundingClientRect();
      lx = r.left + r.width / 2; ly = r.top + r.height / 2;
      lstick.setPointerCapture(lid);
      moveLook(e.clientX, e.clientY);
    });
    lstick.addEventListener('pointermove', (e) => { if (e.pointerId === lid) moveLook(e.clientX, e.clientY); });
    const endLookStick = (e) => { if (e.pointerId !== lid) return; lid = null; G.look.x = G.look.y = 0; lknob.style.transform = ''; };
    lstick.addEventListener('pointerup', endLookStick);
    lstick.addEventListener('pointercancel', endLookStick);
    $('#t-act').addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.unlock(); if (!UI.busy && !Mini.active && !G.paused) this.interact(); });
    $('#minimap').addEventListener('pointerdown', (e) => { e.stopPropagation(); Sound.unlock(); UI.toggleMap(true); });
    $('#btn-menu').addEventListener('click', () => { Sound.unlock(); UI.toggleMenu(); });
    $('#t-run').addEventListener('pointerdown', (e) => { e.preventDefault(); G.touchRun = !G.touchRun; $('#t-run').classList.toggle('on', G.touchRun); });

    // Camera: drag on the world (mouse or a finger outside the joystick) to look around, wheel to zoom.
    const looks = new Map();
    canvas.addEventListener('pointerdown', (e) => {
      Sound.unlock();
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const l = looks.get(e.pointerId);
      if (!l) return;
      const k = e.pointerType === 'touch' ? 0.009 : 0.006;
      Scene3D.yaw -= (e.clientX - l.x) * k;
      Scene3D.lastLook = performance.now();
      Scene3D.pitch = Math.max(0.12, Math.min(1.3, Scene3D.pitch + (e.clientY - l.y) * k * 0.7));
      l.x = e.clientX; l.y = e.clientY;
    });
    const endLook = (e) => looks.delete(e.pointerId);
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', endLook);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      Scene3D.dist = Math.max(3, Math.min(14, Scene3D.dist + e.deltaY * 0.01));
    }, { passive: false });
    document.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !G.touch) { G.touch = true; document.body.classList.add('touch'); if (G.running) $('#touch').classList.remove('hidden'); } }, true);
  },

  toggleAudio(kind) {
    Sound.unlock();
    if (kind === 'music') Sound.setMusic(!Sound.prefs.music); else Sound.setSfx(!Sound.prefs.sfx);
    this.syncAudioButtons();
    UI.toast(kind === 'music' ? (Sound.prefs.music ? '🎵 מוזיקה פועלת' : '🎵 מוזיקה כבויה') : (Sound.prefs.sfx ? '🔊 אפקטים פועלים' : '🔇 אפקטים כבויים'));
  },
  syncAudioButtons() {
    for (const b of document.querySelectorAll('[data-audio]')) {
      const on = Sound.prefs[b.dataset.audio];
      b.textContent = b.dataset.audio === 'music' ? `🎵 מוזיקה: ${on ? 'פועלת' : 'כבויה'}` : `${on ? '🔊' : '🔇'} אפקטים: ${on ? 'פועלים' : 'כבויים'}`;
    }
  },

  interact() {
    if (G.alert || UI.mapOpen()) return;
    if (Boss.active) { Boss.throw(); return; }
    const it = this.nearestInteractable();
    if (it) { Sound.click(); it.action(); }
  },

  nearestInteractable() {
    const p = G.player;
    let best = null, bd = Infinity;
    for (const it of Story.interactables()) {
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      // Objects win over a passer-by: talking needs you to be clearly closer to the person.
      const score = d + (it.talk ? 28 : 0);
      if (d < it.r + p.r && score < bd) { bd = score; best = it; }
    }
    return best;
  },

  // ---------- stats ----------
  addStat(k, d) {
    const S = G.state;
    S[k] = Math.max(0, Math.min(100, S[k] + d));
  },
  addScore(pts, reason) {
    G.state.score = Math.max(0, G.state.score + pts);
    UI.toast(`${pts > 0 ? '+' : ''}${pts} ${reason}`, pts >= 0 ? 'good' : 'bad');
    (pts >= 0 ? Sound.good : Sound.bad)();
  },
  achieve(id) {
    const S = G.state;
    if (!S || S.achievements.includes(id)) return;
    S.achievements.push(id);
    Sound.fanfare();
    const a = DATA.achievements.find(x => x.id === id);
    if (a) setTimeout(() => UI.toast(`🏅 הישג: ${a.name}`, 'ach'), 400);
  },

  // ---------- NPCs ----------
  npc(id) { return G.npcs.find(n => n.id === id); },
  resetNpcs() {
    const mk = (person, spot, wander) => ({
      id: person.id, person, short: person.short, x: spot.x, y: spot.y, r: 12, angle: Math.PI / 2, walk: 0, path: [], spot: { ...spot }, idle: Math.random() * 4, wander,
      look: { skin: person.skin || DATA.skinTones[(person.id.length * 7) % 4], hair: person.hair || DATA.hairColors[(person.id.length * 3) % 3], head: person.head || 'none', female: !!person.female, rank: person.rank, scale: person.scale || 1, flies: !!person.flies },
      barkCd: 8 + Math.random() * 20, chaseCd: 60,
    });
    const map = World.id;
    const layout = LAYOUT[map];
    const regions = WANDER[map];
    G.npcs = [];
    let ri = 0;
    const people = [...ROSTER.people, ROSTER.easterEgg];
    const taken = Multi.taken();
    for (const person of people) {
      // Somebody playing as this character replaces them in the world.
      if (taken.has(person.id)) continue;
      const onMap = map === 'field' ? person.id in layout : person.map === map || (person.id === 'ruth' && map === 'netivot');
      if (!onMap) continue;
      const fixed = layout[person.id];
      const region = regions[ri++ % regions.length];
      let spot;
      if (typeof fixed === 'function') spot = fixed();
      else if (Array.isArray(fixed)) spot = tc(fixed[0], fixed[1]);
      else spot = this.walkableNear(tc(Math.floor((region.x0 + region.x1) / 2), Math.floor((region.y0 + region.y1) / 2))) || tc(30, 30);
      const wanders = !fixed || WANDERERS.has(person.id);
      const w = person.id === 'inspector' ? { x0: 13, y0: 9, x1: 50, y1: 40 } : person.id === 'friend' ? { x0: 24, y0: 29, x1: 33, y1: 34 } : person.id === 'rasap' ? { x0: 4, y0: 13, x1: 59, y1: 23 } : region;
      G.npcs.push(mk(person, spot, wanders && person.id !== 'ruth' ? w : null));
    }
  },
  walkableNear(p) {
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const tx = Math.floor(p.x / TS) + dx, ty = Math.floor(p.y / TS) + dy;
        const q = tc(tx, ty);
        if (!World.blockedTile(tx, ty) && !World.blocked(q.x, q.y, 13) && World.tile(tx, ty) !== T.FLOOR) return q;
      }
    }
    return null;
  },
  // Someone from another site visiting this one for a while (a technician, the battery commander).
  addVisitor(id, spot) {
    if (this.npc(id)) return this.npc(id);
    const person = Cast.get(id);
    if (!person) return null;
    const n = {
      id, person, short: person.short, x: spot.x, y: spot.y, r: 12, angle: -Math.PI / 2, walk: 0, path: [], spot: { ...spot }, idle: 4, wander: null, visitor: true,
      look: { skin: person.skin || DATA.skinTones[(id.length * 7) % 4], hair: person.hair || DATA.hairColors[(id.length * 3) % 3], head: person.head || 'none', female: !!person.female, rank: person.rank, scale: person.scale || 1 },
      barkCd: 20, chaseCd: 999,
    };
    G.npcs.push(n);
    return n;
  },
  removeVisitor(id) { G.npcs = G.npcs.filter(n => !(n.visitor && n.id === id)); },
  setNpcSpot(id, spot) {
    const n = this.npc(id);
    if (!n) return;
    n.spot = { ...spot };
    n.path = World.path(n.x, n.y, spot.x, spot.y) || [];
  },
  npcsToShelters() {
    for (const n of G.npcs) {
      const s = World.nearestShelter(n.x, n.y);
      const jitter = { x: s.x + (Math.random() - 0.5) * 14, y: s.y + (Math.random() - 0.5) * 14 };
      n.path = World.path(n.x, n.y, jitter.x, jitter.y) || [];
      n.sheltering = true;
    }
  },
  npcsReturn() {
    for (const n of G.npcs) {
      n.sheltering = false;
      n.path = World.path(n.x, n.y, n.spot.x, n.spot.y) || [];
    }
  },
  updateNpcs(dt) {
    const P = G.player;
    for (const n of G.npcs) {
      if (n.id === CHASERS[World.id]) this.updateChase(n, dt);
      if (n.bubble) { n.bubble.t -= dt; if (n.bubble.t <= 0) n.bubble = null; }
      n.barkCd -= dt;
      if (n.barkCd <= 0 && !n.bubble && !G.alert && n.person.barks) {
        n.barkCd = 18 + Math.random() * 25;
        if (Math.hypot(P.x - n.x, P.y - n.y) < 220) {
          const b = n.person.barks;
          n.bubble = { text: fmtAs(n.person, b[Math.floor(Math.random() * b.length)]), t: 3.5 };
          Sound.pop();
        }
      }
      if (n.path.length) {
        const tgt = n.path[0];
        const dx = tgt.x - n.x, dy = tgt.y - n.y;
        const d = Math.hypot(dx, dy);
        const sp = (n.sheltering ? 150 : n.chasing ? 104 : n.running ? 125 : 70) * dt;
        if (d <= sp) { n.x = tgt.x; n.y = tgt.y; n.path.shift(); }
        else { n.x += dx / d * sp; n.y += dy / d * sp; n.angle = Math.atan2(dy, dx); n.walk += dt * (n.sheltering ? 16 : 9); }
        continue;
      }
      // Face the player when close.
      const pd = Math.hypot(P.x - n.x, P.y - n.y);
      if (n.chasing) continue;
      // Shaked never stops training: laps around the track, pausing only to talk.
      if (n.person.runner && World.id === 'netivot' && !G.alert && pd > 70) {
        n.lap = ((n.lap || 0) + 1) % TRACK_POINTS.length;
        const q = TRACK_POINTS[n.lap];
        n.path = World.path(n.x, n.y, q.x, q.y) || [];
        n.running = true;
        continue;
      }
      if (pd < 90) { n.angle = Math.atan2(P.y - n.y, P.x - n.x); continue; }
      if (n.wander && !G.alert) {
        n.idle -= dt;
        if (n.idle <= 0) {
          n.idle = 3 + Math.random() * 6;
          const w = n.wander;
          const tx = w.x0 + Math.floor(Math.random() * (w.x1 - w.x0)), ty = w.y0 + Math.floor(Math.random() * (w.y1 - w.y0));
          if (!World.blockedTile(tx, ty)) {
            const q = tc(tx, ty);
            if (!World.blocked(q.x, q.y, 13)) { n.path = World.path(n.x, n.y, q.x, q.y) || []; n.spot = q; }
          }
        }
      }
    }
  },

  // The inspector hunts for anyone idle. Running gets you away; walking doesn't.
  updateChase(n, dt) {
    const P = G.player;
    const d = Math.hypot(P.x - n.x, P.y - n.y);
    n.chaseCd -= dt;
    const allowed = !G.alert && !Story.run && !Boss.active && (World.id === 'netivot' ? Story.chaseAllowed() : Events.amsalemAllowed());
    if (!n.chasing) {
      if (allowed && n.chaseCd <= 0 && d < 170) {
        n.chasing = true;
        n.repath = 0;
        const c = n.person.chase;
        n.bubble = { text: fmtAs(n.person, c[Math.floor(Math.random() * c.length)]), t: 3 };
        Sound.whistle();
        UI.toast(fmt(`😱 ${n.short} ראתה אותך! לברוח (Shift)!`), 'bad');
      }
      return;
    }
    if (!allowed || d > 330) {
      n.chasing = false;
      n.chaseCd = 75;
      n.path = World.path(n.x, n.y, n.spot.x, n.spot.y) || [];
      if (allowed) { UI.toast(fmt(`😅 ברחת מ${n.short}!`), 'good'); Game.achieve('escape'); }
      return;
    }
    if (d < 28) {
      n.chasing = false;
      n.chaseCd = 90;
      n.path = [];
      if (World.id === 'hq') Events.amsalemCaught(); else Story.caught();
      return;
    }
    n.repath -= dt;
    if (n.repath <= 0) { n.repath = 0.4; n.path = World.path(n.x, n.y, P.x, P.y) || []; }
  },

  // Move to another site (Netivot, HQ, deployment field).
  switchMap(id) {
    Sound.travel();
    World.use(id);
    G.map = id;
    Story.trashVisible = id === 'netivot';
    Scene3D.build();
    this.resetNpcs();
    miniBase = null;
    const a = tc(DATA.travelStop[0] + 1, DATA.travelStop[1] + 1);
    G.player.x = a.x; G.player.y = a.y;
    Scene3D.yaw = 0;
  },

  // ---------- frame ----------
  frame(t) {
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t;
    if (G.running) {
      const live = !G.paused && !UI.busy;
      if (live) this.update(dt);
      Scene3D.update(live ? dt : 0, t);
      Sound.music(Boss.active ? 'boss' : G.alert ? 'tension' : World.id === 'field' && Story.has('deploy') ? 'deploy' : this.darkness() > 0.3 ? 'night' : 'day');
      Scene3D.render();
      this.drawOverlay(t);
      this.drawMinimap();
      if ((this.hudT = (this.hudT || 0) + dt) > 0.2) { this.hudT = 0; this.hud(); }
      // Autosave every few seconds, so story mode always continues where you stopped.
      if ((this.autoT = (this.autoT || 0) + dt) > 10 && !UI.busy && !Mini.active && !G.alert && !Boss.active && Story.tasks.length) { this.autoT = 0; this.save(); }
    }
    requestAnimationFrame(tt => this.frame(tt));
  },

  update(dt) {
    const S = G.state, P = G.player;
    S.clock += dt * DATA.minutesPerSecond;

    // Movement relative to the camera: W/up = away from the camera.
    let mx = 0, my = 0;
    const k = G.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA')) mx -= 1;
    if (k.has('KeyD')) mx += 1;
    if (k.has('ArrowLeft') || k.has('KeyQ')) Scene3D.yaw += dt * 2.2;
    if (k.has('ArrowRight') || k.has('KeyR')) Scene3D.yaw -= dt * 2.2;
    if (G.stick.x || G.stick.y) { mx = G.stick.x; my = G.stick.y; }
    // With the map open the world keeps going, but the player stands still.
    if (UI.mapOpen()) mx = my = 0;
    if (G.look.x || G.look.y) {
      Scene3D.yaw -= G.look.x * dt * 2.6;
      Scene3D.pitch = Math.max(0.12, Math.min(1.3, Scene3D.pitch + G.look.y * dt * 1.4));
    }
    const len = Math.hypot(mx, my);
    const wantsRun = k.has('ShiftLeft') || k.has('ShiftRight') || G.touchRun || !!G.alert;
    if (len > 1) { mx /= len; my /= len; }
    // Target velocity from the input: the stick is analogue, so a light push walks slowly.
    let speed = 0, tvx = 0, tvy = 0;
    P.running = false;
    if (len > 0.1) {
      speed = 90;
      if (wantsRun && S.energy > 3) {
        speed = 165;
        P.running = true;
        const drain = (G.perk && G.perk.key === 'stamina' ? 0.6 : 1.2) * dt * (G.alert ? 0.3 : 1);
        S.energy = Math.max(0, S.energy - drain);
      }
      if (P.carry) speed *= P.carry === 'squeegee' ? 0.8 : 0.62;
      if (S.energy < 15) {
        speed *= 0.7;
        if (!G.lowEnergyWarned) { G.lowEnergyWarned = true; UI.toast('אין כוח... לאכול, לבשל במטבחון או לקנות קפה בש"ק בשו"ב', 'bad'); }
      } else G.lowEnergyWarned = false;
      const B = Scene3D.basis();
      const dx = B.rx * mx - B.fx * my, dy = B.rz * mx - B.fz * my;
      tvx = dx * speed; tvy = dy * speed;
      // Third-person follow: when walking forward the camera swings in behind the soldier.
      if (my < -0.3 && performance.now() - Scene3D.lastLook > 1200) {
        const want = Math.atan2(-dx, -dy);
        const diff = Math.atan2(Math.sin(want - Scene3D.yaw), Math.cos(want - Scene3D.yaw));
        if (Math.abs(diff) < 2.2) Scene3D.yaw += diff * Math.min(1, dt * 1.6);
      }
    }
    // Ease into and out of motion instead of starting and stopping dead.
    P.vx = P.vx || 0; P.vy = P.vy || 0;
    const ease = Math.min(1, dt * (len > 0.1 ? 9 : 11));
    P.vx += (tvx - P.vx) * ease;
    P.vy += (tvy - P.vy) * ease;
    const v = Math.hypot(P.vx, P.vy);
    if (v < 4 && len <= 0.1) P.vx = P.vy = 0;
    P.speed = v;
    P.moving = v > 6;
    if (P.moving) {
      const bx = P.x, by = P.y;
      World.move(P, P.vx * dt, P.vy * dt);
      // Sliding along a wall: keep only the speed that actually moved us.
      if (Math.abs(P.x - bx) < Math.abs(P.vx * dt) * 0.5) P.vx *= 0.5;
      if (Math.abs(P.y - by) < Math.abs(P.vy * dt) * 0.5) P.vy *= 0.5;
      // Turn toward where we are heading, smoothly.
      const want = Math.atan2(P.vy, P.vx);
      const d = Math.atan2(Math.sin(want - P.angle), Math.cos(want - P.angle));
      P.angle += d * Math.min(1, dt * 10);
      const before = P.walk;
      P.walk += dt * v / 90 * 10;
      if (Math.floor(before / Math.PI) !== Math.floor(P.walk / Math.PI)) Sound.step();
    }

    // Needs drift over the day.
    S.energy = Math.max(0, S.energy - dt * DATA.minutesPerSecond * 0.06);
    S.morale = Math.max(0, S.morale - dt * DATA.minutesPerSecond * (G.perk && G.perk.key === 'morale' ? 0.004 : 0.008));

    // Gate animation.
    World.gateOpen += (World.gateTarget - World.gateOpen) * Math.min(1, dt * 4);
    if (World.gateTarget === 0 && World.gateOpen > 0.05 && World.blocked(P.x, P.y, P.r) && P.y > 40 * TS) World.gateOpen = 1;

    this.updateNpcs(dt);
    Story.update(dt);
    Multi.update(dt);
    if (P.bubble) { P.bubble.t -= dt; if (P.bubble.t <= 0) P.bubble = null; }

    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.2);

    const it = this.nearestInteractable();
    UI.prompt(it && !G.alert ? it.label : null);
  },

  darkness() {
    const m = G.state.clock % (24 * 60);
    const h = m / 60;
    if (h < 5) return 0.62;
    if (h < 7) return 0.62 * (1 - (h - 5) / 2);
    if (h < 18.5) return 0;
    if (h < 20.5) return 0.62 * (h - 18.5) / 2;
    return 0.62;
  },

  objectiveTarget() {
    if (G.alert && G.alert.phase === 'run') return World.nearestShelter(G.player.x, G.player.y);
    const o = Story.objective();
    return o && o.target;
  },

  // Screen overlay: red-alert vignette and a compass arrow toward the objective.
  drawOverlay(now) {
    const w = G.cam.w, h = G.cam.h;
    octx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    octx.clearRect(0, 0, w, h);
    if (G.alert && G.alert.phase === 'run') {
      const a = 0.22 + Math.sin(now / 160) * 0.1;
      const grad = octx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
      grad.addColorStop(0, 'rgba(230,59,46,0)');
      grad.addColorStop(1, `rgba(230,59,46,${a})`);
      octx.fillStyle = grad;
      octx.fillRect(0, 0, w, h);
    }
    const t = this.objectiveTarget();
    if (!t || UI.busy || Mini.active) return;
    const P = G.player;
    const vx = t.x - P.x, vy = t.y - P.y;
    const distM = Math.hypot(vx, vy) * S3;
    if (distM < 2.5) return;
    const B = Scene3D.basis();
    const ang = Math.atan2(vx * B.rx + vy * B.rz, vx * B.fx + vy * B.fz);
    const cx = w / 2, cy = h - (G.touch ? 215 : 120);
    octx.save();
    octx.translate(cx, cy);
    octx.rotate(ang);
    octx.fillStyle = G.alert ? '#e63b2e' : '#f2c14e';
    octx.strokeStyle = '#1d1d10';
    octx.lineWidth = 2.5;
    octx.beginPath(); octx.moveTo(0, -24); octx.lineTo(15, 10); octx.lineTo(0, 3); octx.lineTo(-15, 10); octx.closePath();
    octx.fill(); octx.stroke();
    octx.restore();
    octx.font = '800 14px Rubik, Arial';
    octx.textAlign = 'center';
    octx.lineWidth = 3;
    octx.strokeStyle = 'rgba(0,0,0,.8)';
    octx.fillStyle = '#fff';
    const label = `${Math.round(distM)} מ'`;
    octx.strokeText(label, cx, cy + 34);
    octx.fillText(label, cx, cy + 34);
  },

  drawMinimap() {
    // The minimap frames the fenced site plus the road outside the gate.
    const [fx0, fy0, fx1, fy1] = World.fence;
    const ox = fx0 - 1, oy = fy0 - 1, cols = fx1 - fx0 + 3, rows = 45 - fy0;
    const s = Math.min(mini.width / cols, mini.height / rows);
    const mx = (v) => (v / TS - ox) * s, my = (v) => (v / TS - oy) * s;
    if (!miniBase) {
      miniBase = document.createElement('canvas');
      miniBase.width = mini.width;
      miniBase.height = mini.height;
      const g = miniBase.getContext('2d');
      const col = { [T.OUT]: World.id === 'hq' ? '#5d7a3a' : '#8f7c55', [T.SAND]: '#b9a57a', [T.WALL]: '#3c3a33', [T.FLOOR]: '#8e8c84', [T.ROAD]: '#3a3a38', [T.FENCE]: '#555', [T.PAD]: '#86847c', [T.GRASS]: '#7f8c55', [T.TRACK]: '#8f5440', [T.GATE]: '#3a3a38' };
      g.fillStyle = col[T.OUT];
      g.fillRect(0, 0, mini.width, mini.height);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { g.fillStyle = col[World.tile(x + ox, y + oy)]; g.fillRect(Math.floor(x * s), Math.floor(y * s), Math.ceil(s), Math.ceil(s)); }
      g.fillStyle = '#e63b2e';
      for (const sh of World.shelters) g.fillRect(mx(sh.x) - 3, my(sh.y) - 3, 6, 6);
    }
    mctx.clearRect(0, 0, mini.width, mini.height);
    mctx.drawImage(miniBase, 0, 0);
    const t = this.objectiveTarget();
    if (t) { mctx.fillStyle = '#f2c14e'; mctx.beginPath(); mctx.arc(mx(t.x), my(t.y), 4, 0, 7); mctx.fill(); }
    mctx.fillStyle = '#d6dccd';
    for (const n of G.npcs) mctx.fillRect(mx(n.x) - 1, my(n.y) - 1, 2.5, 2.5);
    for (const tr of Story.trash) { mctx.fillStyle = '#4aa3df'; mctx.fillRect(mx(tr.x) - 1, my(tr.y) - 1, 3, 3); }
    mctx.fillStyle = '#5be0ff';
    for (const p of Multi.here()) { mctx.beginPath(); mctx.arc(mx(p.dx), my(p.dy), 3, 0, 7); mctx.fill(); }
    mctx.fillStyle = '#fff';
    mctx.strokeStyle = '#000';
    const px = mx(G.player.x), py = my(G.player.y);
    mctx.beginPath(); mctx.arc(px, py, 3.5, 0, 7); mctx.fill(); mctx.stroke();
    // View direction wedge.
    const B = Scene3D.basis();
    const a = Math.atan2(B.fz, B.fx);
    mctx.fillStyle = 'rgba(255,255,255,.22)';
    mctx.beginPath(); mctx.moveTo(px, py); mctx.arc(px, py, 22, a - 0.5, a + 0.5); mctx.closePath(); mctx.fill();
  },

  hud() {
    const S = G.state;
    $('#hud-name').textContent = fmt('{name}');
    $('#hud-unit').textContent = fmt('{gdud} · {battery}');
    $('#hud-day').textContent = `יום ${S.day}${S.graduated ? '' : ' בפלג"צ'}`;
    $('#hud-time').textContent = clockText();
    $('#bar-energy').style.width = S.energy + '%';
    $('#bar-morale').style.width = S.morale + '%';
    $('#bar-score').style.width = Math.min(100, S.score / DATA.passScore * 100) + '%';
    $('#bar-shchora').style.width = (S.shchora || 0) + '%';
    $('#hud-home').textContent = Events.daysToHome() ? `🏠 עוד ${Events.daysToHome()} ימים` : '🏠 היום!';
    $('#hud-money').textContent = `₪${S.money}`;
    UI.objective(Story.objective());
  },

  // ---------- save ----------
  key(mode) { return 'netibot.' + (mode || G.state.mode); },
  save() {
    if (G.running && G.state && Story.tasks.length) G.state.snap = Story.snapshot();
    try { localStorage.setItem(this.key(), JSON.stringify({ profile: G.profile, state: G.state })); } catch (e) { /* storage may be blocked */ }
  },
  load(mode) {
    try { const raw = localStorage.getItem(this.key(mode)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  },

  newState(mode) {
    return {
      mode, day: 1, clock: 360, score: 0, energy: 100, morale: 75, money: 30,
      inbox: [], achievements: [], graduated: false, examRetry: false,
      myBed: G.profile && G.profile.gender === 'f' ? 10 : 2, myLocker: G.profile && G.profile.gender === 'f' ? 4 : 1, dayFlags: {}, trainCount: {},
      shchora: 45, homeDay: DATA.homeDay, flags: {}, junkDone: [],
      stats: { intercepts: 0, alerts: 0, reloads: 0, cars: 0, purchases: 0, days: 0 },
    };
  },

  applyProfile() {
    const p = G.profile;
    const gd = DATA.gdudim.find(g => g.id === p.gdud);
    G.perk = gd ? gd.perk : null;
    p.gdudName = gd ? gd.name : '';
    const b = gd && gd.batteries.find(x => x.id === p.battery);
    p.batteryName = b ? b.name : '';
  },

  async startWorld(fresh) {
    this.landscape();
    document.body.classList.add('playing');
    UI.clearScreen();
    $('#hud').classList.remove('hidden');
    if (G.touch) $('#touch').classList.remove('hidden');
    G.running = true;
    G.paused = false;
    this.applyProfile();
    if (fresh) this.achieve('beret');
    this.syncAudioButtons();
    const snap = G.state.snap;
    if (!fresh && snap && snap.day === G.state.day && snap.tasks && snap.tasks.length) await Story.resumeDay(snap);
    else await Story.startDay(G.state.day);
  },

  // Phones play sideways: go fullscreen and ask the browser to lock landscape.
  landscape() {
    if (!G.touch) return;
    const el = document.documentElement;
    const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } };
    try {
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock, lock);
      else lock();
    } catch (e) { lock(); }
  },

  // ---------- menus ----------
  title() {
    const story = this.load('story');
    UI.screen(`<div class="shade"></div><div class="content">
      <div class="logo">נתי<span>בוט</span></div>
      <div class="logo-sub">NETIBOT</div>
      <div class="tagline">הסוללה של נתיבות · משחק עולם פתוח בגוף שלישי</div>
      <div class="menu">
        ${story ? `<button class="btn" id="m-cont">▶ מצב סיפור — להמשיך (יום ${story.state.day}, ${esc(story.profile.name)})</button>` : ''}
        <button class="btn ${story ? 'ghost' : ''}" id="m-new">${story ? 'משחק חדש מההתחלה' : 'מצב סיפור — משחק חדש'}</button>
        <button class="btn ghost" id="m-free">אימונים חופשיים</button>
        <button class="btn ghost" id="m-multi">🌐 מולטיפלייר — לשחק עם הפלגה</button>
        <button class="btn ghost" id="m-help">איך משחקים</button>
        <div class="audio-row"><button class="btn small ghost" data-audio="music"></button><button class="btn small ghost" data-audio="sfx"></button></div>
      </div>
      <div class="footnote">משחק בדיוני. כל הדמויות, השמות והאירועים במשחק מומצאים.</div>
    </div>`, 'assets/title.jpg');
    if (story) $('#m-cont').onclick = () => { Sound.unlock(); G.profile = story.profile; G.state = story.state; this.startWorld(false); };
    $('#m-new').onclick = () => {
      Sound.unlock();
      if (!story) { this.createCharacter('story'); return; }
      // A saved story is never thrown away by accident.
      UI.screen(`<div class="content"><div class="panel"><h2>להתחיל מההתחלה?</h2>
        <p>יש לך משחק שמור — יום ${story.state.day} (${esc(story.profile.name)}). משחק חדש ימחק אותו.</p>
        <div class="actions"><button class="btn" id="n-cont">▶ לא, להמשיך מאיפה שעצרתי</button><button class="btn red" id="n-new">כן, משחק חדש</button></div></div></div>`, 'assets/title.jpg');
      $('#n-cont').onclick = () => { G.profile = story.profile; G.state = story.state; this.startWorld(false); };
      $('#n-new').onclick = () => this.createCharacter('story');
    };
    $('#m-free').onclick = () => {
      Sound.unlock();
      const free = this.load('free');
      if (free) { G.profile = free.profile; G.state = free.state; this.startWorld(false).then(() => Story.trainingMenu()); }
      else this.createCharacter('free');
    };
    $('#m-help').onclick = () => this.help(false);
    $('#m-multi').onclick = () => { Sound.unlock(); this.multiMenu(); };
    // Opened from an invite link: straight to choosing who you are.
    if (Lobby.invited() && !this.invitedOnce) { this.invitedOnce = true; this.multiMenu(); }
    for (const b of document.querySelectorAll('[data-audio]')) b.onclick = () => this.toggleAudio(b.dataset.audio);
    this.syncAudioButtons();
    Sound.music('menu');
  },

  help(inGame) {
    const html = `<div class="content"><div class="panel">
      <h2>איך משחקים</h2>
      <p><b>המטרה:</b> לעבור את פלג"צ — חמישה ימים בפלגה הצעירה של סוללת כיפת ברזל ליד נתיבות — ולעבור את מבחן הסיום. צריך ציון פלג"צ של ${DATA.passScore} לפחות ולעבור 3 מתוך 4 חלקי המבחן.</p>
      <p><b>מקלדת:</b> WASD — הליכה (קדימה = לכיוון שהמצלמה מסתכלת) · Shift — ריצה · E — פעולה · רווח — המשך שיחה · Tab — טלפון.</p>
      <p><b>מצלמה:</b> גרירה עם העכבר מסובבת את המצלמה סביב הדמות, גלגלת — זום. אפשר גם חצים ימינה/שמאלה (או Q ו-R).</p>
      <p><b>בטלפון:</b> משחקים לרוחב. ג'ויסטיק שמאלי — הליכה קדימה, אחורה, ימינה ושמאלה. ג'ויסטיק ימני — להסתכל מסביב. כפתור E לפעולה וכפתור "ריצה".</p>
      <p><b>מפה:</b> לחיצה על המפה הקטנה (או G) — מפה גדולה וחיה שמראה איפה כל אחד מהפלגה.</p>
      <p><b>שחורה:</b> המד השחור. עולה מכל משימה ומכל דבר מנפיץ, ויורד ככל שמתקרבים ליציאה הביתה (ומאוכל טוב).</p>
      <p><b>החץ הצהוב</b> בתחתית המסך מצביע על המשימה הבאה, והחץ המרחף מעל המטרה מסמן אותה בעולם.</p>
      <p><b>תחנת הסעות:</b> ליד השער בכל אתר. משם נוסעים בין אתר נתיבות, ה{hq} ואתר הפריסה.</p>
      <p><b>{@inspector}:</b> מסתובבת בבסיס ומחפשת את מי לתפוס למסדר. אם היא רואה אותך — לרוץ (Shift). אם היא תופסת — יש מסדר פתע.</p>
      <p><b>צבע אדום:</b> יש ${DATA.redAlertSeconds} שניות להגיע למיגונית (גג עם פס אדום, ונקודות אדומות במפה). החץ האדום מראה את הקרובה.</p>
      <p><b>מארזים:</b> אחרי יירוטים משגר מתרוקן. לוקחים מארז במחסן, סוחבים למשגר ומבצעים את שלבי ההחלפה.</p>
      <p><b>ש"ג:</b> בודקים שם ומספר רכב מול רשימת הכניסה. מורשה — פותחים, ואחרי שעבר — סוגרים מיד!</p>
      <p><b>אנרגיה ומורל:</b> אוכלים בחדר האוכל, מבשלים במטבחון, קונים בש"ק בשו"ב, ישנים במיטה. בלי אנרגיה זזים לאט.</p>
      <div class="actions"><button class="btn" id="h-ok">${inGame ? 'חזרה למשחק' : 'הבנתי'}</button></div>
    </div></div>`;
    if (inGame) {
      G.paused = true;
      UI.busy = true;
      UI.screen(html);
      $('#screen').style.background = 'rgba(8,10,6,.85)';
      $('#h-ok').onclick = () => { UI.clearScreen(); UI.busy = false; G.paused = false; };
    } else {
      UI.screen(html, 'assets/title.jpg');
      $('#h-ok').onclick = () => this.title();
    }
  },

  createCharacter(mode) {
    const p = { name: '', gender: 'm', skin: DATA.skinTones[1], hair: DATA.hairColors[0], gdud: null, battery: null };
    G.profile = p;
    const render = () => {
      UI.screen(`<div class="content"><div class="panel">
        <h2>סוף הטירונות</h2><p>מי את[ה/]?</p>
        <div class="row"><label>שם</label><input type="text" id="c-name" maxlength="14" placeholder="השם שלך" value="${p.name}"></div>
        <div class="row"><label>אני</label>
          <button class="chip ${p.gender === 'm' ? 'sel' : ''}" data-g="m">חייל</button>
          <button class="chip ${p.gender === 'f' ? 'sel' : ''}" data-g="f">חיילת</button></div>
        <div class="row"><label>גוון עור</label>${DATA.skinTones.map(c => `<span class="swatch ${p.skin === c ? 'sel' : ''}" data-s="${c}" style="background:${c}"></span>`).join('')}</div>
        <div class="row"><label>שיער</label>${DATA.hairColors.map(c => `<span class="swatch ${p.hair === c ? 'sel' : ''}" data-h="${c}" style="background:${c}"></span>`).join('')}</div>
        <div class="actions"><button class="btn" id="c-next">המשך ◂</button><button class="btn ghost" id="c-back">חזרה</button></div>
      </div></div>`, 'assets/beret.jpg');
      $('#screen').querySelector('.panel').innerHTML = fmt($('#screen').querySelector('.panel').innerHTML);
      const name = $('#c-name');
      name.oninput = () => p.name = name.value.trim();
      $('#screen').querySelectorAll('[data-g]').forEach(b => b.onclick = () => { p.name = name.value.trim(); p.gender = b.dataset.g; render(); });
      $('#screen').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { p.name = name.value.trim(); p.skin = b.dataset.s; render(); });
      $('#screen').querySelectorAll('[data-h]').forEach(b => b.onclick = () => { p.name = name.value.trim(); p.hair = b.dataset.h; render(); });
      $('#c-back').onclick = () => this.title();
      $('#c-next').onclick = async () => {
        p.name = name.value.trim() || (p.gender === 'f' ? 'חיילת' : 'חייל');
        G.state = this.newState(mode);
        if (mode === 'story') {
          await UI.cutscene([
            { img: 'assets/beret.jpg', text: 'סוף הטירונות. חודשיים של שטח, מטווחים, שמירות ושינה של ארבע שעות. והלילה — טקס סיום.' },
            { img: 'assets/beret.jpg', who: 'מפקד הטירונות', text: '{name}! צעד[/י] קדימה... בשם חיל האוויר — קבל[/י] את הכומתה.' },
            { img: 'assets/beret.jpg', text: 'הכומתה הכחולה-אפורה על הראש. אמא בוכה בקהל. עכשיו מתחיל הדבר האמיתי.' },
            { img: 'assets/reload.jpg', text: 'שובצת למערך ההגנה האווירית — כיפת ברזל. נשאר רק לבחור: לאיזה גדוד ולאיזו סוללה?' },
          ]);
        }
        this.chooseGdud(mode);
      };
    };
    render();
  },

  // Multiplayer: pick who you are from the cast and join everyone who has the link open.
  async multiMenu() {
    UI.screen('<div class="content"><div class="panel"><h2>🌐 מולטיפלייר</h2><p>מתחבר ללובי...</p></div></div>', 'assets/title.jpg');
    const room = await Multi.init();
    if (!room) {
      UI.screen(`<div class="content"><div class="panel"><h2>🌐 מולטיפלייר</h2>
        <p>לא הצלחתי להתחבר ללובי. כדאי לבדוק את האינטרנט ולנסות שוב.</p>
        <div class="actions"><button class="btn" id="mm-retry">לנסות שוב</button><button class="btn ghost" id="mm-back">חזרה</button></div></div></div>`, 'assets/title.jpg');
      $('#mm-retry').onclick = () => this.multiMenu();
      $('#mm-back').onclick = () => this.title();
      return;
    }
    const link = Lobby.inviteLink();
    const render = () => {
      const taken = new Set(Multi.peers.map(p => p.who));
      const people = ROSTER.people.filter(p => p.map === 'netivot' || ['bc', 'deputy_bc', 'harasar', 'rasap', 'deputy_rasap', 'sarsap', 'interceptors', 'officer1', 'officer2', 'officer3', 'ops', 'hamalist'].includes(p.id));
      UI.screen(`<div class="content"><div class="panel">
        <h2>🌐 מי את[ה/]?</h2>
        ${link ? `<div class="invite"><b>🔗 הזמנה לחברים</b> — שולחים להם את הקישור, הם לוחצים ונכנסים. בלי חשבון ובלי הרשמה.
          ${room.lobby ? '' : '<br><small>כאן ב־claude.ai הלובי לא זמין, אז כדי לשחק עם מי שנכנס מהקישור — [תפתח/תפתחי] גם את[ה/] את הקישור.</small>'}
          <div class="invite-row"><input type="text" readonly id="mm-link" value="${esc(link)}"><button class="btn small" id="mm-share">📤 שלח בוואטסאפ</button><button class="btn small ghost" id="mm-copy">📋 העתק</button></div></div>` : ''}
        <p>מחוברים עכשיו: ${Multi.peers.length ? Multi.peers.map(p => esc(p.name)).join(' · ') : 'רק את[ה/]... בינתיים'}</p>
        <div class="grid">${people.map(p => `<div class="card ${taken.has(p.id) ? 'off' : ''}" data-id="${p.id}"><div class="big">${p.emoji}</div><div class="nm">${p.name}</div><div class="ds">${fmtAs(p, p.title || '')}${taken.has(p.id) ? ' · כבר מחובר[/ת]' : ''}</div></div>`).join('')}</div>
        <div class="actions"><button class="btn ghost" id="mm-back">חזרה</button></div></div></div>`, 'assets/title.jpg');
      $('#mm-back').onclick = () => this.title();
      if (link) {
        $('#mm-share').onclick = () => this.shareInvite();
        $('#mm-copy').onclick = async () => {
          const inp = $('#mm-link');
          try { await navigator.clipboard.writeText(link); } catch (e) { inp.select(); document.execCommand('copy'); }
          UI.toast('הקישור הועתק ✔', 'good');
        };
      }
      $('#screen').querySelectorAll('.card').forEach(c => c.onclick = () => {
        if (c.classList.contains('off')) { UI.toast('מישהו כבר משחק בתור הדמות הזאת'); return; }
        Sound.click();
        const person = Cast.get(c.dataset.id);
        G.profile = { name: person.short, gender: person.female ? 'f' : 'm', skin: person.skin || DATA.skinTones[1], hair: person.hair || DATA.hairColors[0], gdud: '947', battery: 'ido', as: person.id };
        const saved = this.load('multi.' + person.id);
        G.state = saved ? saved.state : this.newState('free');
        G.state.mode = 'multi.' + person.id;
        Multi.start(person.id);
        this.multiRender = null;
        this.startWorld(!saved).then(() => UI.toast('🌐 מחובר[/ת]! T — לכתוב לכולם · לחיצה על המפה הקטנה — איפה כולם'));
      });
    };
    this.multiRender = render;
    render();
    // Keep the "who's online" line fresh while choosing.
    let seen = Multi.peers.map(p => p.who + p.name).sort().join();
    const refresh = setInterval(() => {
      if (this.multiRender !== render || !$('#mm-back')) { clearInterval(refresh); return; }
      const now = Multi.peers.map(p => p.who + p.name).sort().join();
      if (now !== seen) { seen = now; render(); }
    }, 1500);
  },

  // Send the invite link: the phone's share sheet when there is one, WhatsApp otherwise.
  async shareInvite() {
    const link = Lobby.inviteLink();
    const text = fmt('בוא[/י] לשחק איתי בנתיבוט 🛡️ לוחצים על הקישור ובוחרים מי את[ה/]:');
    if (navigator.share) { try { await navigator.share({ title: 'נתיבוט', text, url: link }); return; } catch (e) { /* fall through to WhatsApp */ } }
    window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + link), '_blank');
  },

  chooseGdud(mode) {
    const p = G.profile;
    UI.screen(`<div class="content"><div class="panel">
      <h2>בחירת גדוד</h2><p>כל גדוד נותן יתרון קטן במשחק.</p>
      <div class="grid">${DATA.gdudim.map(g => `<div class="card ${p.gdud === g.id ? 'sel' : ''}" data-id="${g.id}">
        <div class="big" style="color:${g.color}">${g.id}</div><div class="nm">${g.name}</div><div class="ds">${g.perk.label}</div>
        <div class="ds">סוללות: ${g.batteries.map(b => b.name).join(' · ')}</div></div>`).join('')}</div>
      <div class="actions"><button class="btn ghost" id="g-back">חזרה</button></div>
    </div></div>`, 'assets/title.jpg');
    $('#screen').querySelectorAll('.card').forEach(c => c.onclick = () => { Sound.click(); p.gdud = c.dataset.id; this.chooseBattery(mode); });
    $('#g-back').onclick = () => this.createCharacter(mode);
  },

  chooseBattery(mode) {
    const p = G.profile;
    const gd = DATA.gdudim.find(g => g.id === p.gdud);
    UI.screen(`<div class="content"><div class="panel">
      <h2>${gd.name} — בחירת סוללה</h2><p>לאיזו סוללה את[ה/] עולה?</p>
      <div class="grid">${gd.batteries.map(b => `<div class="card" data-id="${b.id}"><div class="big">🛡️</div><div class="nm">סוללת ${b.name}</div><div class="ds">${gd.name}</div></div>`).join('')}</div>
      <div class="actions"><button class="btn ghost" id="b-back">חזרה</button></div>
    </div></div>`, 'assets/title.jpg');
    $('#screen').querySelector('.panel').innerHTML = fmt($('#screen').querySelector('.panel').innerHTML);
    $('#screen').querySelectorAll('.card').forEach(c => c.onclick = async () => {
      Sound.click();
      p.battery = c.dataset.id;
      this.applyProfile();
      if (mode === 'story') {
        await UI.cutscene([
          { img: 'assets/title.jpg', text: '{gdud}, סוללת {battery}. האתר: גבעה חולית ליד נתיבות. כולם קוראים לו נתיבוט.' },
          { img: 'assets/guard.jpg', text: 'אבל לפני שאת[ה/] באמת חלק מהסוללה — יש פלג"צ: הפלגה הצעירה. חמישה ימים של משימות, שמירות, אזעקות — ומבחן סיום.' },
          { img: 'assets/redalert.jpg', text: `חוק ראשון בנתיבות: כשיש צבע אדום — יש לך ${DATA.redAlertSeconds} שניות להגיע למיגונית. בלי ויכוחים.` },
        ]);
      }
      this.startWorld(true).then(() => { if (mode === 'free') { UI.toast('אימונים חופשיים: כל העמדות פתוחות'); Story.trainingMenu(); } });
    });
    $('#b-back').onclick = () => this.chooseGdud(mode);
  },
};

// Models and textures load first; the title screen shows progress meanwhile.
window.addEventListener('load', () => {
  UI.screen('<div class="content"><div class="logo">נתי<span>בוט</span></div><div class="tagline" id="load-msg">טוען גרפיקה... 0%</div></div>');
  Assets.load(p => { const m = document.getElementById('load-msg'); if (m) m.textContent = `טוען גרפיקה... ${Math.round(p * 100)}%`; })
    .then(() => Game.init());
});
