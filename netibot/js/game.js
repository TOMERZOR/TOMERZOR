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
    driver1: [9, 34], driver2: [13, 38], shekemist: [41, 36], officer1: null, officer2: null, officer3: null,
  },
  field: { commander: [33, 31], driver1: [28, 37], driver2: [33, 37], p_nevo: null, p_shalev: null, p_ofek: null, p_miriam: null },
};
// Who sits at the "מרכז אתר" tables on each site (index into World.seats).
const SEATED = { netivot: { p_hila: 0, p_miriam: 1, p_aharon: 6 }, hq: { medic3: 1, driver2: 6 } };
const WANDERERS = new Set(['friend', 'inspector', 'officer1', 'officer2', 'officer3', 'harasar', 'rasap']);
// Who hunts for idle soldiers on each site.
const CHASERS = { netivot: 'inspector', hq: 'rasap' };

const Game = {
  // ---------- boot ----------
  init() {
    Cast.init();
    mergeExtraLines();
    Curious.register();
    Settings.apply();
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
    Scene3D.resize(w, h, Math.min(dpr, Settings.dprCap()));
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
      if (e.target.tagName === 'INPUT' || Settings.isOpen()) return;
      G.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!G.running) return;
      if (Race.active) {
        if (e.code === 'Space' || e.code === 'KeyE') Race.boost();
        if (e.code === 'Escape') Race.exit();
        return;
      }
      if ((e.code === 'Tab' || e.code === 'KeyP') && !Mini.active && !UI.busy && !UI.menuOpen()) UI.togglePhone();
      if (e.code === 'Escape' && !Mini.active) {
        if (!$('#phone').classList.contains('hidden')) UI.togglePhone(false);
        else if (UI.mapOpen()) UI.toggleMap(false);
        else UI.toggleMenu();
      }
      if (e.code === 'KeyM') this.toggleAudio('music');
      if (e.code === 'KeyN') this.toggleAudio('sfx');
      if (e.code === 'KeyF' && !Mini.active && !UI.busy) this.toggleFullscreen();
      if (e.code === 'KeyX' && !Mini.active && !UI.busy && !G.paused) Story.warp();
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
    $('#t-act').addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.unlock(); G.actHeld = true; if (!UI.busy && !Mini.active && !G.paused) this.interact(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#t-act').addEventListener(ev, () => { G.actHeld = false; });
    $('#minimap').addEventListener('pointerdown', (e) => { e.stopPropagation(); Sound.unlock(); UI.toggleMap(true); });
    $('#btn-menu').addEventListener('click', () => { Sound.unlock(); UI.toggleMenu(); });
    $('#btn-fs').addEventListener('click', () => this.toggleFullscreen());
    $('#btn-chat').addEventListener('click', () => { Sound.unlock(); if (UI.chatOpen()) UI.closeChat(); else UI.chat(); });
    document.addEventListener('fullscreenchange', () => this.syncFullscreen());
    document.addEventListener('webkitfullscreenchange', () => this.syncFullscreen());
    this.syncFullscreen();
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
      const k = (e.pointerType === 'touch' ? 0.009 : 0.006) * Settings.v.sens;
      Scene3D.yaw -= (e.clientX - l.x) * k;
      Scene3D.lastLook = performance.now();
      Scene3D.pitch = Math.max(0.12, Math.min(1.3, Scene3D.pitch + (e.clientY - l.y) * k * 0.7 * (Settings.v.invertY ? -1 : 1)));
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

  sitDown(seat) {
    const P = G.player;
    if (seat.by || P.carry) return;
    seat.by = 'player';
    P.sit = seat;
    P.x = seat.x; P.y = seat.y; P.angle = seat.angle; P.vx = P.vy = 0;
    Sound.click();
    UI.toast(G.touch ? '🪑 ישבת. להזיז את הג\'ויסטיק כדי לקום' : '🪑 ישבת. W/A/S/D כדי לקום');
  },
  standUp() {
    const P = G.player, s = P.sit;
    if (!s) return;
    s.by = null;
    P.sit = null;
    P.x = s.exit.x; P.y = s.exit.y;
  },

  interact() {
    if (Race.active) { Race.boost(); return; }
    if (G.alert || UI.mapOpen() || Story.ctl) return;
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
    if (pts < 0) Settings.buzz(90);
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
      look: { id: person.id, skin: person.skin || DATA.skinTones[(person.id.length * 7) % 4], hair: person.hair || DATA.hairColors[(person.id.length * 3) % 3], head: person.head || 'none', female: !!person.female, rank: person.rank, scale: person.scale || 1, flies: !!person.flies },
      barkCd: 8 + Math.random() * 20, chaseCd: 60,
    });
    const map = World.id;
    const layout = LAYOUT[map];
    const regions = WANDER[map];
    G.npcs = [];
    for (const s of World.seats) if (s.by !== 'player') s.by = null;
    let ri = 0;
    const people = [...ROSTER.people, ROSTER.easterEgg, ...DATA.extras];
    const taken = Multi.taken();
    for (const person of people) {
      // Somebody playing as this character replaces them in the world; in multiplayer the
      // playable cast exists only as the players who are connected.
      // The bosses stay, though (unless a friend plays them): talking to one starts a fight for all.
      if (taken.has(person.id) || (Multi.on && Multi.playable(person) && !BOSS_OF[person.id])) continue;
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
      const seat = SEATED[map] && World.seats[SEATED[map][person.id]];
      if (seat && !seat.by) {
        const n = mk(person, { x: seat.x, y: seat.y }, null);
        n.seat = seat;
        seat.by = person.id;
        G.npcs.push(n);
        continue;
      }
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
      look: { id, skin: person.skin || DATA.skinTones[(id.length * 7) % 4], hair: person.hair || DATA.hairColors[(id.length * 3) % 3], head: person.head || 'none', female: !!person.female, rank: person.rank, scale: person.scale || 1 },
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
      if (n.curious) continue;
      const s = World.nearestShelter(n.x, n.y);
      const jitter = { x: s.x + (Math.random() - 0.5) * 14, y: s.y + (Math.random() - 0.5) * 14 };
      n.path = World.path(n.x, n.y, jitter.x, jitter.y) || [];
      n.sheltering = true;
    }
  },
  npcsReturn() {
    for (const n of G.npcs) {
      if (n.curious) continue;
      n.sheltering = false;
      if (n.seat) { n.path = (World.path(n.x, n.y, n.seat.exit.x, n.seat.exit.y) || []).concat([{ x: n.seat.x, y: n.seat.y }]); continue; }
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
      // At the table: sitting, facing across it.
      n.sitting = !!(n.seat && !n.path.length && !G.alert && Math.hypot(n.x - n.seat.x, n.y - n.seat.y) < 4);
      if (n.sitting) { n.angle = n.seat.angle; continue; }
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
    if (G.player.sit) { G.player.sit.by = null; G.player.sit = null; }
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
    // Battery saver: about 30 frames a second.
    if (Settings.v.saver && t - (this.last || 0) < 30) { requestAnimationFrame(tt => this.frame(tt)); return; }
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t;
    if (Settings.v.fps) {
      this.fpsN = (this.fpsN || 0) + 1;
      if (t - (this.fpsT || 0) > 1000) { const f = $('#fps'); if (f) f.textContent = `${Math.round(this.fpsN * 1000 / (t - (this.fpsT || t - 1000)))} FPS`; this.fpsN = 0; this.fpsT = t; }
    }
    // The race is a world of its own: while it's on, only it updates and draws.
    if (G.running && Race.active) {
      Race.frame(dt, t);
      Race.render();
      requestAnimationFrame(tt => this.frame(tt));
      return;
    }
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
    // The clock (and the day's events) wait while the controls tutorial is on.
    if (!Tutorial.active) S.clock += dt * DATA.minutesPerSecond;

    // Movement relative to the camera: W/up = away from the camera.
    let mx = 0, my = 0;
    const k = G.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA')) mx -= 1;
    if (k.has('KeyD')) mx += 1;
    // At the deployment controls the arrows drive the truck / crane, so they don't turn the camera.
    if ((k.has('ArrowLeft') && !Story.ctl) || k.has('KeyQ')) Scene3D.yaw += dt * 2.2;
    if ((k.has('ArrowRight') && !Story.ctl) || k.has('KeyR')) Scene3D.yaw -= dt * 2.2;
    if (G.stick.x || G.stick.y) { mx = G.stick.x; my = G.stick.y; }
    // With the map open the world keeps going, but the player stands still.
    if (UI.mapOpen()) mx = my = 0;
    if (Story.ctl) {
      const key = (...c) => (c.some(x => k.has(x)) ? 1 : 0);
      const clamp = (v) => Math.max(-1, Math.min(1, v));
      const steer = clamp(key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA') + (G.stick.x || 0));
      const throttle = clamp(key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS') - (G.stick.y || 0));
      Story.ctlInput({ steer, throttle, mx: steer, my: -throttle, lower: !!(k.has('Space') || k.has('KeyE') || G.actHeld), raise: !!(k.has('ShiftLeft') || k.has('ShiftRight') || G.touchRun) });
      mx = my = 0;
    }
    if (G.look.x || G.look.y) {
      Scene3D.yaw -= G.look.x * dt * 2.6 * Settings.v.sens;
      Scene3D.pitch = Math.max(0.12, Math.min(1.3, Scene3D.pitch + G.look.y * dt * 1.4 * Settings.v.sens * (Settings.v.invertY ? -1 : 1)));
    }
    // Sitting at a table: any push on the stick gets you up; resting there restores a little.
    if (P.sit) {
      if (Math.hypot(mx, my) > 0.3 || G.alert || Story.ctl) this.standUp();
      else {
        mx = my = 0; P.vx = P.vy = 0;
        P.x = P.sit.x; P.y = P.sit.y; P.angle = P.sit.angle;
        S.energy = Math.min(100, S.energy + dt * 0.25);
        S.morale = Math.min(100, S.morale + dt * 0.08);
      }
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
        const drain = (G.perk && G.perk.key === 'stamina' ? 0.25 : 0.45) * dt * (G.alert ? 0.3 : 1);
        S.energy = Math.max(0, S.energy - drain);
      }
      if (P.carry) speed *= P.carry === 'squeegee' ? 0.8 : 0.62;
      // Tired slows you only when nearly empty, and not by much: walking slowly isn't fun.
      if (S.energy < 8) {
        speed *= 0.85;
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
    S.energy = Math.max(0, S.energy - dt * DATA.minutesPerSecond * 0.025);
    S.morale = Math.max(0, S.morale - dt * DATA.minutesPerSecond * (G.perk && G.perk.key === 'morale' ? 0.004 : 0.008));

    // Gate animation.
    World.gateOpen += (World.gateTarget - World.gateOpen) * Math.min(1, dt * 4);
    if (World.gateTarget === 0 && World.gateOpen > 0.05 && World.blocked(P.x, P.y, P.r) && P.y > 40 * TS) World.gateOpen = 1;

    this.updateNpcs(dt);
    if (!Tutorial.active) Story.update(dt);
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
    if (!t || UI.busy || Mini.active || (!Settings.v.arrow && !G.alert)) return;
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
    const nameHtml = rankIcon(playerRank()) + esc(fmt('{name}'));
    if (nameHtml !== this.nameHtml) { this.nameHtml = nameHtml; $('#hud-name').innerHTML = nameHtml; }
    this.checkRank();
    $('#hud-unit').textContent = fmt('{gdud} · {battery}');
    $('#hud-day').textContent = `יום ${S.day}${S.graduated ? '' : ' בפלג"צ'}`;
    $('#hud-time').textContent = clockText();
    $('#bar-energy').style.width = S.energy + '%';
    $('#bar-morale').style.width = S.morale + '%';
    $('#bar-score').style.width = Math.min(100, S.score / DATA.passScore * 100) + '%';
    $('#bar-shchora').style.width = (S.shchora || 0) + '%';
    const confined = (S.confinedUntil || 0) - S.day;
    // Confinement days are added to the days until going home (homeDay moves with them).
    $('#hud-home').textContent = Events.daysToHome() ? `${confined > 0 ? '🔒' : '🏠'} עוד ${Events.daysToHome()} ימים` : '🏠 היום!';
    $('#hud-money').textContent = `₪${S.money}`;
    UI.objective(Story.objective());
  },

  // ---------- ranks ----------
  // Promotions: sergeant once the young platoon is passed, staff sergeant a week later (or
  // with a high enough score). Playing as a cast member keeps their own rank.
  RANK_ORDER: ['rabat', 'samal', 'samar'],
  checkRank() {
    const S = G.state;
    if (!S || G.profile.as || UI.busy || Mini.active || G.alert || Boss.active || Tutorial.active) return;
    if (S.graduated && !S.gradDay) S.gradDay = S.day;
    const want = !S.graduated ? 'rabat' : (S.day >= S.gradDay + 7 || S.score >= 400) ? 'samar' : 'samal';
    const have = S.rank || 'rabat';
    if (this.RANK_ORDER.indexOf(want) <= this.RANK_ORDER.indexOf(have)) return;
    S.rank = want;
    Sound.fanfare();
    Settings.buzz([80, 60, 80, 60, 200]);
    this.achieve('rank_' + want);
    UI.toast(`🎖️ הועלית לדרגת ${RANKS[want]}!`, 'ach');
    UI.talk([
      { who: 'commander', text: want === 'samal'
        ? '{name}, [בוא/בואי] רגע. ...מהיום את[ה/] סמל. שלושה פסים. אל [תתרגל/תתרגלי], זה רק אומר שמותר לי לצעוק עליך יותר.'
        : '{name}. סמל ראשון. עלה על הפסים. ראית כמה זמן עבר? אני גאה. בשקט. אל תספר[/י] לאף אחד.' },
    ]);
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
    // Everyone serves in battery Ido of battalion 947 (older saves picked one).
    p.gdud = '947';
    p.battery = 'ido';
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
    Tutorial.maybeStart();
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

  // Full screen on/off. iPhones only allow it for videos, so there the game explains how to
  // add it to the home screen, which opens it without the browser bars.
  fsElement() { return document.fullscreenElement || document.webkitFullscreenElement; },
  toggleFullscreen() {
    Sound.unlock();
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (this.fsElement()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (!req) { UI.toast('באייפון: שיתוף ⬆️ ← "הוספה למסך הבית" — ואז המשחק נפתח במסך מלא', ''); return; }
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      const lock = () => { try { if (G.touch && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } };
      if (p && p.then) p.then(lock, () => UI.toast('הדפדפן לא מאפשר מסך מלא כאן', 'bad')); else lock();
    } catch (e) { UI.toast('הדפדפן לא מאפשר מסך מלא כאן', 'bad'); }
  },
  syncFullscreen() {
    const on = !!this.fsElement();
    for (const b of document.querySelectorAll('[data-fs]')) b.textContent = b.dataset.fs === 'icon' ? (on ? '🗗' : '⛶') : (on ? '🗗 יציאה ממסך מלא' : '⛶ מסך מלא');
  },

  // ---------- menus ----------
  title() {
    const story = this.load('story');
    UI.screen(`<div class="shade"></div>
      <div class="corner"><button class="icon-btn" id="m-help" aria-label="איך משחקים" title="איך משחקים">?</button><button class="icon-btn" id="m-sound" aria-label="מוזיקה ואפקטים" title="מוזיקה ואפקטים">${Sound.prefs.music || Sound.prefs.sfx ? '🔊' : '🔇'}</button><button class="icon-btn" id="m-set" aria-label="הגדרות" title="הגדרות">⚙️</button></div>
      <div class="content">
      <div class="logo">נתי<span>בוט</span></div>
      <div class="logo-sub">NETIBOT</div>
      <div class="tagline">הסוללה של נתיבות · משחק עולם פתוח בגוף שלישי</div>
      <div class="menu">
        ${story ? `<button class="btn" id="m-cont">▶ להמשיך (יום ${story.state.day}, ${esc(story.profile.name)})</button>` : ''}
        <button class="btn ${story ? 'ghost' : ''}" id="m-new">${story ? 'משחק חדש מההתחלה' : '▶ משחק חדש'}</button>
        <button class="btn ghost" id="m-multi">🌐 לשחק עם הפלגה</button>
        <div class="menu-row"><button class="btn small ghost" id="m-role">🎭 לשחק בתור מישהו</button></div>
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
    $('#m-help').onclick = () => { Sound.unlock(); Sound.click(); this.help(false); };
    $('#m-sound').onclick = (e) => { Sound.unlock(); Settings.soundCard(e.currentTarget); };
    $('#m-set').onclick = () => { Sound.unlock(); Sound.click(); Settings.open(); };
    $('#m-multi').onclick = () => { Sound.unlock(); this.multiMenu(); };
    $('#m-role').onclick = () => { Sound.unlock(); Roles.menu(); };
    Install.maybeShow();
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
      <p><b>השתגרות:</b> הכפתור ⚡ בחלון המשימה (או X) — קפיצה ישר למקום של המשימה ב־2₪, בלי ללכת ובלי הסעה.</p>
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
        <div class="pick-look">${['m', 'f'].map(g => `<img class="card-face ${p.gender === g ? 'sel' : ''}" src="assets/faces/player_${g}.webp" alt="" data-g="${g}">`).join('')}</div>
        <div class="actions"><button class="btn" id="c-next">המשך ◂</button><button class="btn ghost" id="c-back">חזרה</button></div>
      </div></div>`, 'assets/beret.jpg');
      $('#screen').querySelector('.panel').innerHTML = fmt($('#screen').querySelector('.panel').innerHTML);
      const name = $('#c-name');
      name.oninput = () => p.name = name.value.trim();
      $('#screen').querySelectorAll('[data-g]').forEach(b => b.onclick = () => { p.name = name.value.trim(); p.gender = b.dataset.g; render(); });
      $('#c-back').onclick = () => this.title();
      $('#c-next').onclick = async () => {
        p.name = name.value.trim() || (p.gender === 'f' ? 'חיילת' : 'חייל');
        G.state = this.newState(mode);
        if (mode === 'story') {
          await UI.cutscene([
            { img: 'assets/beret.jpg', text: 'סוף הטירונות. חודשיים של שטח, מטווחים, שמירות ושינה של ארבע שעות. והלילה — טקס סיום.' },
            { img: 'assets/beret.jpg', who: 'מפקד הטירונות', text: '{name}! צעד[/י] קדימה... בשם חיל האוויר — קבל[/י] את הכומתה.' },
            { img: 'assets/beret.jpg', text: 'הכומתה הכחולה-אפורה על הראש. אמא בוכה בקהל. עכשיו מתחיל הדבר האמיתי.' },
            { img: 'assets/reload.jpg', text: 'שובצת למערך ההגנה האווירית — כיפת ברזל: גדוד 947, סוללת אידו.' },
          ]);
        }
        p.gdud = '947';
        p.battery = 'ido';
        this.applyProfile();
        if (mode === 'story') {
          await UI.cutscene([
            { img: 'assets/title.jpg', text: '{gdud}, סוללת {battery}. האתר: גבעה חולית ליד נתיבות. כולם קוראים לו נתיבוט.' },
            { img: 'assets/guard.jpg', text: 'אבל לפני שאת[ה/] באמת חלק מהסוללה — יש פלג"צ: הפלגה הצעירה. חמישה ימים של משימות, שמירות, אזעקות — ומבחן סיום.' },
            { img: 'assets/redalert.jpg', text: `חוק ראשון בנתיבות: כשיש צבע אדום — יש לך ${DATA.redAlertSeconds} שניות להגיע למיגונית. בלי ויכוחים.` },
          ]);
        }
        this.startWorld(true);
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
      const people = ROSTER.people.filter(p => Multi.playable(p));
      UI.screen(`<div class="content"><div class="panel">
        <h2>🌐 מי את[ה/]?</h2>
        ${link ? `<div class="invite"><b>🔗 הזמנה לחברים</b> — שולחים להם את הקישור, הם לוחצים ונכנסים. בלי חשבון ובלי הרשמה.
          ${room.lobby ? '' : '<br><small>כאן ב־claude.ai הלובי לא זמין, אז כדי לשחק עם מי שנכנס מהקישור — [תפתח/תפתחי] גם את[ה/] את הקישור.</small>'}
          <div class="invite-row"><input type="text" readonly id="mm-link" value="${esc(link)}"><button class="btn small" id="mm-share">📤 שלח בוואטסאפ</button><button class="btn small ghost" id="mm-copy">📋 העתק</button></div></div>` : ''}
        <p>מחוברים עכשיו: ${Multi.peers.length ? Multi.peers.map(p => esc(p.name)).join(' · ') : 'רק את[ה/]... בינתיים'}</p>
        <div class="grid">${people.map(p => `<div class="card ${taken.has(p.id) ? 'off' : ''}" data-id="${p.id}">${faceUrl(p.id) ? `<img class="card-face" src="${faceUrl(p.id)}" alt="">` : `<div class="big">${p.emoji}</div>`}<div class="nm">${rankIcon(rankOf(p))} ${p.name}</div><div class="ds">${fmtAs(p, p.title || '')}${taken.has(p.id) ? ' · כבר מחובר[/ת]' : ''}</div></div>`).join('')}</div>
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
        // Online, everyone does the job of who they play (their own duties), not just the gate.
        if (ROLES[person.id]) G.state.role = person.id;
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

};

// Models and textures load first; the title screen shows progress meanwhile.
// No "save image" menu or drag-out for any picture in the game (see img.face in the CSS).
document.addEventListener('contextmenu', (e) => { if (e.target.closest('img, .cutscene')) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG') e.preventDefault(); });

// The game opens only with a valid key (from the current invite link, or remembered from it).
// Any other link, an old one included, gets a locked page and nothing of the game.
window.addEventListener('load', async () => {
  document.body.classList.add('booting');
  await Lobby.unlock();
  if (!Lobby.cryptoKey) {
    Lobby.forgetKey();
    document.body.classList.add('locked');
    UI.screen('<div class="content"><div class="locked-msg"><div class="lk">🔒</div><p>הקישור הזה לא פעיל.</p></div></div>');
    return;
  }
  document.body.classList.remove('booting');
  UI.screen('<div class="content"><div class="logo">נתי<span>בוט</span></div><div class="tagline" id="load-msg">טוען גרפיקה... 0%</div></div>');
  Promise.all([
    Assets.load(p => { const m = document.getElementById('load-msg'); if (m) m.textContent = `טוען גרפיקה... ${Math.round(p * 100)}%`; }),
  ]).then(() => {
    Game.init();
    Assets.loadScenes();
    // The real cast first, then the made-up visitors (curious civilians at the gate).
    Assets.loadPeople().then(() => Object.keys(Assets.publicPeople).reduce((p, id) => p.then(() => Assets.loadPublicPerson(id)), Promise.resolve()));
  });
});
