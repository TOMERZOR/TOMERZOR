// The fight itself: a deterministic simulation with no DOM, no floats that
// matter and no randomness, so two browsers that feed it the same inputs get
// the same fight frame for frame (that is what makes rollback netcode work).
// Units: millimetres and frames (60 per second). Everything stays an integer.

export const FPS = 60;
export const IN = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, P: 16, K: 32, S: 64, B: 128, X: 256 };

const STAGE = 4300;        // half width of the arena
const MAX_GAP = 5600;      // the two fighters can never be further apart than the screen
const BODY = 230;          // half width of a body
const G = 6;               // gravity
const JUMP_VY = 128;
const JUMP_VX = 46;
const WALK_F = 22;
const WALK_B = 17;
const METER_MAX = 1000;
const ROUND_TIME = 99 * FPS;
const BUFFER = 9;          // frames a pressed button waits for its chance

// Moves. s = startup frames, a = active, r = recovery. level: high (whiffs on
// crouchers), mid, low (must be blocked crouching), over (must be blocked standing).
export const MOVES = {
  jab:   { anim: "jab",     s: 5,  a: 3, r: 9,  dmg: 38,  hs: 15, bs: 9,  level: "high", reach: 470, push: 14 },
  jab2:  { anim: "jab2",    s: 5,  a: 3, r: 11, dmg: 42,  hs: 16, bs: 9,  level: "high", reach: 480, push: 16 },
  hook:  { anim: "hook",    s: 8,  a: 3, r: 15, dmg: 70,  hs: 20, bs: 11, level: "mid",  reach: 500, push: 22, lunge: [0, 8, 12] },
  upper: { anim: "upper",   s: 7,  a: 4, r: 22, dmg: 92,  hs: 0,  bs: 13, level: "mid",  reach: 430, push: 10, launch: 112, airReach: 1900 },
  kick:  { anim: "kick",    s: 8,  a: 4, r: 15, dmg: 60,  hs: 18, bs: 10, level: "mid",  reach: 640, push: 20 },
  round: { anim: "round",   s: 12, a: 4, r: 20, dmg: 96,  hs: 0,  bs: 13, level: "high", reach: 660, push: 30, kd: 1 },
  sweep: { anim: "sweep",   s: 9,  a: 4, r: 21, dmg: 62,  hs: 0,  bs: 12, level: "low",  reach: 700, push: 10, kd: 1, crouch: 1 },
  airp:  { anim: "airp",    s: 4,  a: 8, r: 6,  dmg: 52,  hs: 16, bs: 9,  level: "over", reach: 460, push: 12, air: 1 },
  airk:  { anim: "airk",    s: 6,  a: 9, r: 6,  dmg: 70,  hs: 19, bs: 10, level: "over", reach: 600, push: 16, air: 1 },
  grab:  { anim: "grab",    s: 5,  a: 2, r: 26, dmg: 115, level: "throw", reach: 300 },
  toss:  { anim: "toss",    s: 13, a: 1, r: 20, proj: 1 },
  chair: { anim: "chair",   s: 26, a: 1, r: 28, proj: 1, superMove: 1 },
  // signature specials (forward + special)
  spin:  { anim: "spin",    s: 10, a: 12, r: 18, dmg: 58, hs: 18, bs: 10, level: "mid", reach: 620, push: 18, hits: 2, gap: 7, chip: 8 },
  nails: { anim: "nails",   s: 8,  a: 14, r: 18, dmg: 36, hs: 14, bs: 8,  level: "mid", reach: 480, push: 8, hits: 3, gap: 5, chip: 6, lunge: [0, 18, 52] },
  flash: { anim: "flash",   s: 11, a: 4, r: 22, dmg: 22, hs: 0,  bs: 10, level: "high", reach: 900, push: 0, daze: 56 },
  whip:  { anim: "whip",    s: 9,  a: 10, r: 18, dmg: 48, hs: 18, bs: 10, level: "mid", reach: 600, push: 20, hits: 2, gap: 6, chip: 6 },
  fly:   { anim: "fly",     s: 10, a: 10, r: 18, dmg: 100, hs: 0, bs: 14, level: "mid", reach: 520, push: 30, kd: 1, lunge: [2, 22, 64], chip: 10 },
  vape:  { anim: "vape",    s: 14, a: 1, r: 22, proj: 1 },
  scream:{ anim: "scream",  s: 16, a: 6, r: 22, dmg: 52, hs: 0,  bs: 12, level: "low", reach: 1500, push: 40, kd: 1, chip: 8 },
  tiktok:{ anim: "tiktok",  s: 8,  a: 24, r: 16, dmg: 28, hs: 14, bs: 8, level: "mid", reach: 520, push: 6, hits: 4, gap: 6, chip: 5 },
  // the end of the match
  chairality: { anim: "chair", s: 26, a: 1, r: 60, finisher: 1 },
};

// Projectiles. y is the height of the item; spd its speed; g a gravity for arcs.
export const PROJ = {
  phone: { y: 1250, spd: 96, vy: 0,  g: 0, dmg: 72, hs: 18, bs: 10, push: 18, chip: 9, life: 90 },
  bag:   { y: 1050, spd: 62, vy: 0,  g: 0, dmg: 92, hs: 22, bs: 12, push: 26, chip: 12, life: 120 },
  slide: { y: 1300, spd: 74, vy: 34, g: 2, dmg: 66, hs: 18, bs: 10, push: 18, chip: 8, life: 90 },
  heel:  { y: 1350, spd: 80, vy: 30, g: 2, dmg: 74, hs: 19, bs: 10, push: 18, chip: 9, life: 90 },
  blush: { y: 1350, spd: 34, vy: 0,  g: 0, dmg: 30, hs: 0,  bs: 10, push: 0,  chip: 4, life: 110, daze: 60 },
  cloud: { y: 1000, spd: 0,  vy: 0,  g: 0, dmg: 16, hs: 10, bs: 6,  push: 8,  chip: 3, life: 96, at: 820, multi: 12 },
  chair: { y: 1150, spd: 70, vy: 0,  g: 0, dmg: 230, hs: 0, bs: 22, push: 44, chip: 60, life: 120, kd: 1, big: 1 },
};

// What each fighter's buttons do. str: her named combo (P, K with F/B/D before
// it for a held direction). item: what the special button throws. sig: what
// forward + special does.
export const FIGHTERS = [
  { id: "shontal", item: "bag",   sig: "spin",   str: ["P", "P", "FP", "DP"] },
  { id: "revital", item: "blush", sig: "nails",  str: ["P", "K", "FP"] },
  { id: "liel",    item: "phone", sig: "flash",  str: ["P", "P", "K", "FK"] },
  { id: "lian",    item: "slide", sig: "whip",   str: ["K", "FP", "DP"] },
  { id: "shirel",  item: "heel",  sig: "fly",    str: ["P", "FP", "DP"] },
  { id: "agam",    item: "phone", sig: "vape",   str: ["P", "K", "FK"] },
  { id: "maayan",  item: "bag",   sig: "scream", str: ["P", "P", "DK"] },
  { id: "tahel",   item: "phone", sig: "tiktok", str: ["K", "FP", "FK"] },
];

// Which normal can be cancelled into which once it has made contact.
const CHAIN = {
  jab: ["jab2", "hook", "kick", "upper", "sweep"],
  jab2: ["hook", "kick", "round", "upper", "sweep"],
  kick: ["hook", "round", "upper"],
  hook: ["upper", "round"],
  airp: ["airk"],
};
const SPECIALS = ["toss", "chair", "spin", "nails", "flash", "whip", "fly", "vape", "scream", "tiktok"];

const NEUTRAL = { idle: 1, walkf: 1, walkb: 1, crouch: 1, block: 1, cblock: 1 };

function newPlayer(ch, side) {
  return {
    ch, x: side ? 1100 : -1100, y: 0, vx: 0, vy: 0, face: side ? -1 : 1,
    hp: 1000, meter: 0, st: "intro", sf: 0, mv: "", contact: 0, hitN: 0, lastHit: -99,
    stun: 0, bs: 0, combo: 0, comboDmg: 0, juggle: 0, inv: 0, cd: 0, airUsed: 0,
    prevIn: 0, bufTok: "", bufT: 0, chain: [], strDone: 0, wins: 0, dmgTaken: 0,
  };
}

export function createState(ch0, ch1) {
  return {
    f: 0, phase: "intro", pt: 150, round: 1, timer: ROUND_TIME, hs: 0,
    p: [newPlayer(ch0, 0), newPlayer(ch1, 1)],
    pr: [], nextId: 1, winner: -1, roundWinner: -1, ev: [],
  };
}

export function cloneState(s) {
  const p = s.p.map((q) => ({ ...q, chain: q.chain.slice() }));
  return { ...s, p, pr: s.pr.map((q) => ({ ...q })), ev: s.ev.slice() };
}

// Cheap checksum of everything that matters, to spot a desync.
export function checksum(s) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
  mix(s.f); mix(s.timer); mix(s.hs); mix(s.pt); mix(s.round);
  for (const q of s.p) {
    mix(q.x); mix(q.y); mix(q.vx); mix(q.vy); mix(q.hp); mix(q.meter); mix(q.sf); mix(q.stun); mix(q.wins); mix(q.face);
    for (let i = 0; i < q.st.length; i++) mix(q.st.charCodeAt(i));
  }
  for (const q of s.pr) { mix(q.x); mix(q.y); mix(q.o); }
  return h;
}

function tokenFor(p, inp, btn) {
  const fwd = inp & (p.face > 0 ? IN.RIGHT : IN.LEFT);
  const back = inp & (p.face > 0 ? IN.LEFT : IN.RIGHT);
  const d = inp & IN.DOWN ? "D" : fwd ? "F" : back ? "B" : "";
  return d + btn;
}

function moveForToken(p, tok, inp, s) {
  const F = FIGHTERS[p.ch];
  const btn = tok[tok.length - 1];
  const dir = tok.length > 1 ? tok[0] : "";
  if (btn === "X") return p.meter >= METER_MAX ? "chair" : "";
  if (btn === "S") {
    if (dir === "F") return F.sig;
    const own = s.pr.some((q) => q.o === s.p.indexOf(p) && !q.dead);
    return p.cd === 0 && !own ? "toss" : "";
  }
  if (btn === "P") {
    if (inp & IN.B) return "grab";
    if (dir === "D") return "upper";
    if (dir === "F") return "hook";
    if (p.st === "attack" && (p.mv === "jab")) return "jab2";
    return "jab";
  }
  if (btn === "K") {
    if (dir === "D") return "sweep";
    if (dir === "F" || dir === "B") return "round";
    return "kick";
  }
  return "";
}

function startMove(s, i, mv, tok, cancel) {
  const p = s.p[i];
  const m = MOVES[mv];
  p.st = "attack"; p.mv = mv; p.sf = 0; p.contact = 0; p.hitN = 0; p.lastHit = -99;
  if (!m.air && !m.lunge) p.vx = 0;
  if (cancel) p.chain.push(tok); else { p.chain = [tok]; p.strDone = 0; }
  if (mv === "chair") { p.meter = 0; s.ev.push({ k: "super", p: i }); }
  if (mv === "toss") p.cd = 50;
  if (mv === "grab") s.ev.push({ k: "whoosh", p: i, big: 0 });
  s.ev.push({ k: "move", p: i, mv });
}

function canAct(p) {
  return NEUTRAL[p.st] && p.bs === 0;
}

function control(s, i, inp) {
  const p = s.p[i];
  const fwd = inp & (p.face > 0 ? IN.RIGHT : IN.LEFT);
  const back = inp & (p.face > 0 ? IN.LEFT : IN.RIGHT);
  const fight = s.phase === "fight" || (s.phase === "finish" && s.winner === i);

  if (!fight) return;
  if (s.phase === "finish") {
    // only the winner moves, and the chair button ends it
    if (canAct(p) && p.bufT && p.bufTok.endsWith("X")) {
      p.bufT = 0; startMove(s, i, "chairality", "X", 0); return;
    }
  }

  if (p.st === "attack") {
    const m = MOVES[p.mv];
    if (p.bufT && p.contact && s.phase === "fight") {
      const next = moveForToken(p, p.bufTok, inp, s);
      const total = m.s + m.a + m.r;
      const ok = next && next !== "grab" && (
        (CHAIN[p.mv] && CHAIN[p.mv].includes(next)) ||
        (SPECIALS.includes(next) && !SPECIALS.includes(p.mv) && !m.air)
      );
      if (ok && p.sf < total) {
        if (!(m.air) || MOVES[next].air) { p.bufT = 0; startMove(s, i, next, p.bufTok, 1); }
      }
    }
    return;
  }
  if (p.st === "jump") {
    if (p.bufT && !p.airUsed && s.phase === "fight") {
      const btn = p.bufTok[p.bufTok.length - 1];
      if (btn === "P" || btn === "K") {
        p.bufT = 0; p.airUsed = 1; startMove(s, i, btn === "P" ? "airp" : "airk", btn, 0);
      }
    }
    return;
  }
  if (!canAct(p)) return;

  if (p.bufT && s.phase === "fight") {
    const mv = moveForToken(p, p.bufTok, inp, s);
    if (mv) { p.bufT = 0; startMove(s, i, mv, p.bufTok, 0); return; }
  }
  if (inp & IN.B) { p.st = inp & IN.DOWN ? "cblock" : "block"; p.vx = 0; return; }
  if (inp & IN.UP) {
    p.st = "jump"; p.sf = 0; p.vy = JUMP_VY; p.airUsed = 0;
    p.vx = fwd ? JUMP_VX * p.face : back ? -JUMP_VX * p.face : 0;
    s.ev.push({ k: "jump", p: i });
    return;
  }
  if (inp & IN.DOWN) { setSt(p, "crouch"); return; }
  if (fwd) { setSt(p, "walkf"); p.x += WALK_F * p.face; return; }
  if (back) { setSt(p, "walkb"); p.x -= WALK_B * p.face; return; }
  setSt(p, "idle");
}

function setSt(p, st) {
  if (p.st !== st) { p.st = st; p.sf = 0; }
}

function inAir(p) { return p.y > 0 || p.st === "jump" || p.st === "air_hit"; }

function crouching(p) {
  return p.st === "crouch" || p.st === "cblock" || (p.st === "attack" && MOVES[p.mv].crouch) || p.st === "down" || p.st === "getup";
}

function hittable(p) {
  return p.inv === 0 && p.st !== "down" && p.st !== "getup" && p.st !== "ko" && p.st !== "intro" && !(p.st === "air_hit" && p.juggle > 5);
}

function gainMeter(p, n) { p.meter = Math.min(METER_MAX, p.meter + n); }

// Apply one hit (from a move or a projectile) of attacker a on defender d.
function applyHit(s, ai, di, h, dir, src) {
  const a = s.p[ai], d = s.p[di];
  const blocking = (d.st === "block" && h.level !== "low") || (d.st === "cblock" && h.level !== "over");
  if (blocking && h.level !== "throw" && !inAir(d)) {
    const chip = h.chip || 0;
    d.hp = Math.max(1, d.hp - chip);
    d.bs = h.bs || 10;
    d.vx = dir * Math.trunc((h.push || 10) * 7 / 10);
    gainMeter(a, 12); gainMeter(d, 18);
    s.hs = Math.max(s.hs, 4);
    s.ev.push({ k: "block", p: di, x: d.x, y: 1200, src });
    return;
  }
  const scale = Math.max(40, 100 - 9 * d.combo);
  const dmg = Math.max(1, Math.trunc(h.dmg * scale / 100));
  d.hp = Math.max(0, d.hp - dmg);
  d.combo += 1; d.comboDmg += dmg; d.dmgTaken += dmg;
  gainMeter(a, Math.trunc(dmg / 2)); gainMeter(d, Math.trunc(dmg / 4));
  if (d.combo >= 3) gainMeter(a, 40);
  const airborne = inAir(d);
  if (d.hp === 0) {
    d.st = "air_hit"; d.sf = 0; d.vy = 70; d.vx = dir * 34; d.y = Math.max(d.y, 1); d.ko = 1;
    s.hs = 22;
    s.ev.push({ k: "ko", p: di, src });
  } else if (h.launch || h.kd || airborne || h.level === "throw") {
    d.st = "air_hit"; d.sf = 0;
    d.vy = h.launch ? h.launch : airborne ? Math.max(30, 80 - 12 * d.juggle) : h.level === "throw" ? 96 : 50;
    d.vx = dir * (h.level === "throw" ? 34 : airborne ? 18 : 26);
    d.y = Math.max(d.y, 1);
    d.juggle += 1;
    s.hs = Math.max(s.hs, h.big ? 14 : 9);
  } else if (h.daze) {
    d.st = "dazed"; d.sf = 0; d.stun = h.daze; d.vx = 0;
    s.hs = Math.max(s.hs, 6);
  } else {
    d.st = "hit"; d.sf = 0; d.stun = h.hs; d.vx = dir * (h.push || 10);
    s.hs = Math.max(s.hs, dmg >= 80 ? 9 : 6);
  }
  d.bs = 0;
  s.ev.push({ k: "hit", p: di, dmg, x: d.x, y: d.y + (crouching(d) ? 800 : 1300), src, combo: d.combo, big: dmg >= 80 ? 1 : 0 });
  // her named combo
  if (src === "move" && !a.strDone) {
    const want = FIGHTERS[a.ch].str;
    if (a.chain.length === want.length && a.chain.every((t, k) => t === want[k])) {
      a.strDone = 1; gainMeter(a, 320);
      s.ev.push({ k: "string", p: ai });
    }
  }
}

function attackBox(p, m) {
  const near = p.x + p.face * 80;
  const far = p.x + p.face * (BODY + m.reach);
  return [Math.min(near, far), Math.max(near, far)];
}

function overlapsBody(lo, hi, d) {
  return hi >= d.x - BODY && lo <= d.x + BODY;
}

// Which hits land this frame (computed for both before either is applied, so trades happen).
function findHits(s) {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const a = s.p[i], d = s.p[1 - i];
    if (a.st !== "attack") continue;
    const m = MOVES[a.mv];
    if (!m.dmg || m.proj) continue;
    if (a.sf < m.s || a.sf >= m.s + m.a) continue;
    const maxHits = m.hits || 1;
    if (a.hitN >= maxHits) continue;
    if (a.hitN > 0 && a.sf - a.lastHit < (m.gap || 99)) continue;
    if (!hittable(d)) continue;
    const [lo, hi] = attackBox(a, m);
    if (!overlapsBody(lo, hi, d)) continue;
    if (m.level === "throw") {
      if (inAir(d) || d.st === "hit" || d.st === "attack" && MOVES[d.mv].superMove) continue;
    } else {
      // height checks
      const dTop = d.y + (crouching(d) ? 1100 : 1750);
      if (m.level === "high" && crouching(d) && !inAir(d)) continue;
      if (m.air) { if (a.y > dTop + 200) continue; }
      else if (inAir(d) && d.y > (m.airReach || 1100)) continue;
    }
    out.push(i);
  }
  for (const i of out) {
    const a = s.p[i];
    const m = MOVES[a.mv];
    a.hitN += 1; a.lastHit = a.sf; a.contact = 1;
    applyHit(s, i, 1 - i, m, a.face, "move");
  }
}

function spawnProjectile(s, i, type) {
  const p = s.p[i];
  const P = PROJ[type];
  const q = {
    id: s.nextId++, o: i, t: type, x: p.x + p.face * (P.at || 420), y: P.y,
    vx: P.spd * p.face, vy: P.vy, life: P.life, dead: 0, hitN: 0, age: 0,
  };
  s.pr.push(q);
  s.ev.push({ k: "throw", p: i, t: type });
}

function updateProjectiles(s) {
  for (const q of s.pr) {
    if (q.dead) continue;
    const P = PROJ[q.t];
    q.age += 1; q.life -= 1;
    q.x += q.vx; q.y += q.vy; q.vy -= P.g;
    if (q.life <= 0 || q.x < -STAGE - 800 || q.x > STAGE + 800 || q.y < 0) { q.dead = 1; continue; }
    const d = s.p[1 - q.o];
    if (!hittable(d)) continue;
    if (P.multi) { if (q.age % P.multi !== 1) continue; }
    const top = d.y + (crouching(d) ? 1150 : 1800);
    const low = d.y;
    if (q.y > top || q.y + 200 < low) continue;
    if (Math.abs(q.x - d.x) > BODY + (P.big ? 260 : P.multi ? 420 : 120)) continue;
    const dir = q.vx === 0 ? s.p[q.o].face : Math.sign(q.vx);
    applyHit(s, q.o, 1 - q.o, { ...P, level: P.big ? "mid" : q.y < 700 ? "low" : "mid" }, dir, q.t);
    s.p[q.o].contact = 1;
    if (!P.multi) q.dead = 1;
  }
  // two flying items cancel each other out
  const live = s.pr.filter((q) => !q.dead && PROJ[q.t].spd > 0);
  for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
    const A = live[a], B = live[b];
    if (A.o !== B.o && Math.abs(A.x - B.x) < 160 && Math.abs(A.y - B.y) < 400) {
      if (!PROJ[A.t].big) A.dead = 1;
      if (!PROJ[B.t].big) B.dead = 1;
      s.ev.push({ k: "clash", x: (A.x + B.x) >> 1, y: (A.y + B.y) >> 1 });
    }
  }
  s.pr = s.pr.filter((q) => !q.dead);
}

function physics(s, i) {
  const p = s.p[i];
  p.sf += 1;
  if (p.inv > 0) p.inv -= 1;
  if (p.cd > 0) p.cd -= 1;
  if (p.st === "attack") {
    const m = MOVES[p.mv];
    if (m.lunge && p.sf >= m.lunge[0] && p.sf < m.lunge[1]) p.x += p.face * m.lunge[2];
    if (m.proj && p.sf === m.s) {
      if (p.mv === "toss") spawnProjectile(s, i, FIGHTERS[p.ch].item);
      else if (p.mv === "vape") spawnProjectile(s, i, "cloud");
      else spawnProjectile(s, i, "chair");
    }
    if (m.finisher && p.sf === m.s) {
      s.phase = "fatality"; s.pt = 330;
      s.ev.push({ k: "fatality", p: i });
    }
    if (m.level === "throw" && p.sf === m.s + m.a && !p.contact) s.ev.push({ k: "whiff", p: i });
    if (p.sf >= m.s + m.a + m.r) {
      if (m.air && p.y > 0) { p.st = "jump"; p.mv = ""; }
      else { p.st = "idle"; p.mv = ""; p.sf = 0; }
    }
  }
  const airborne = p.y > 0 || p.vy > 0 || p.st === "jump";
  if (airborne) {
    p.vy -= G; p.y += p.vy; p.x += p.vx;
    if (p.y <= 0) {
      p.y = 0; p.vy = 0; p.vx = 0;
      if (p.st === "air_hit") {
        p.st = p.ko ? "ko" : "down"; p.sf = 0; p.juggle = 0;
        s.ev.push({ k: "land", p: i, hard: 1 });
      } else if (p.st === "jump" || (p.st === "attack" && MOVES[p.mv].air)) {
        p.st = "idle"; p.sf = 0; p.mv = "";
        s.ev.push({ k: "land", p: i, hard: 0 });
      }
    }
  } else {
    p.x += p.vx;
    if (p.vx > 0) p.vx = Math.max(0, p.vx - 3); else if (p.vx < 0) p.vx = Math.min(0, p.vx + 3);
  }
  if (p.bs > 0) { p.bs -= 1; }
  if (p.st === "hit" || p.st === "dazed") {
    p.stun -= 1;
    if (p.stun <= 0) { p.st = "idle"; p.sf = 0; }
  }
  if (p.st === "down" && p.sf >= 44) {
    if (p.hp > 0) { p.st = "getup"; p.sf = 0; p.inv = 26; }
  }
  if (p.st === "getup" && p.sf >= 26) { p.st = "idle"; p.sf = 0; }
}

function keepApart(s) {
  const [a, b] = s.p;
  const bothLow = a.y < 900 && b.y < 900;
  const dx = b.x - a.x;
  if (bothLow && Math.abs(dx) < BODY * 2) {
    const need = BODY * 2 - Math.abs(dx);
    const sgn = dx === 0 ? (a.face > 0 ? 1 : -1) : Math.sign(dx);
    const half = need >> 1;
    a.x -= sgn * half; b.x += sgn * (need - half);
  }
  for (const p of s.p) p.x = Math.max(-STAGE, Math.min(STAGE, p.x));
  // the fighters stay on one screen
  const gap = b.x - a.x;
  if (Math.abs(gap) > MAX_GAP) {
    const over = Math.abs(gap) - MAX_GAP;
    const sgn = Math.sign(gap);
    a.x += sgn * (over >> 1); b.x -= sgn * (over - (over >> 1));
  }
  // corner push: re-separate if a wall squeezed them together
  if (bothLow && Math.abs(b.x - a.x) < BODY * 2) {
    const sgn = b.x >= a.x ? 1 : -1;
    if (Math.abs(a.x) >= STAGE) b.x = a.x + sgn * BODY * 2;
    else if (Math.abs(b.x) >= STAGE) a.x = b.x - sgn * BODY * 2;
  }
}

function faceEachOther(s) {
  for (let i = 0; i < 2; i++) {
    const p = s.p[i], o = s.p[1 - i];
    if ((NEUTRAL[p.st] || p.st === "intro") && p.y === 0 && o.x !== p.x) p.face = o.x > p.x ? 1 : -1;
  }
}

function resetCombos(s) {
  for (const p of s.p) {
    if (NEUTRAL[p.st] || p.st === "jump") { p.combo = 0; p.comboDmg = 0; p.juggle = 0; }
  }
}

function resetRound(s) {
  s.round += 1;
  s.timer = ROUND_TIME;
  s.phase = "intro"; s.pt = 120;
  s.pr = [];
  s.roundWinner = -1;
  for (let i = 0; i < 2; i++) {
    const old = s.p[i];
    const p = newPlayer(old.ch, i);
    p.wins = old.wins; p.meter = old.meter; p.prevIn = old.prevIn;
    s.p[i] = p;
  }
  s.ev.push({ k: "round", n: s.round });
}

function endRound(s, w) {
  s.roundWinner = w;
  if (w >= 0) s.p[w].wins += 1;
  else { s.p[0].wins += 1; s.p[1].wins += 1; }
  const done = s.p[0].wins >= 2 || s.p[1].wins >= 2;
  if (done) {
    const w0 = s.p[0].wins >= 2, w1 = s.p[1].wins >= 2;
    s.winner = w0 && w1 ? -1 : w0 ? 0 : 1;
    if (s.winner >= 0 && s.p[1 - s.winner].hp === 0) {
      // FINISH HER: the loser gets up dazed and the winner has a few seconds
      const l = s.p[1 - s.winner];
      l.st = "dazed"; l.sf = 0; l.stun = 9999; l.ko = 0; l.hp = 0;
      const wp = s.p[s.winner]; wp.st = "idle"; wp.sf = 0; wp.mv = "";
      s.phase = "finish"; s.pt = 360;
      s.ev.push({ k: "finish", p: s.winner });
    } else {
      s.phase = "over"; s.pt = 0;
      s.ev.push({ k: "matchover", p: s.winner });
    }
  } else {
    s.phase = "roundend"; s.pt = 170;
    s.ev.push({ k: "roundwin", p: w });
  }
}

// One frame. in0/in1 are the two players' input bitmasks.
export function step(s, in0, in1) {
  s.ev = [];
  s.f += 1;
  const ins = [in0 | 0, in1 | 0];
  for (let i = 0; i < 2; i++) {
    const p = s.p[i];
    const pressed = ins[i] & ~p.prevIn;
    let btn = "";
    if (pressed & IN.X) btn = "X";
    else if (pressed & IN.S) btn = "S";
    else if (pressed & IN.K) btn = "K";
    else if (pressed & IN.P) btn = "P";
    else if ((pressed & IN.B) && (ins[i] & IN.P)) btn = "P";
    if (btn) { p.bufTok = tokenFor(p, ins[i], btn); p.bufT = BUFFER; }
    else if (p.bufT > 0 && s.hs === 0) p.bufT -= 1;
    p.prevIn = ins[i];
  }
  if (s.hs > 0) { s.hs -= 1; return s; }

  if (s.phase === "intro") {
    s.pt -= 1;
    if (s.pt === 60) s.ev.push({ k: "announce", n: s.round });
    if (s.pt <= 0) {
      s.phase = "fight";
      for (const p of s.p) { p.st = "idle"; p.sf = 0; }
      s.ev.push({ k: "fight" });
    }
  } else if (s.phase === "fight") {
    s.timer -= 1;
  } else if (s.phase === "roundend") {
    s.pt -= 1;
    if (s.pt <= 0) { resetRound(s); return s; }
  } else if (s.phase === "finish") {
    s.pt -= 1;
    if (s.pt <= 0) {
      const l = s.p[1 - s.winner]; l.st = "ko"; l.sf = 0;
      s.phase = "over"; s.ev.push({ k: "matchover", p: s.winner });
    }
  } else if (s.phase === "fatality") {
    s.pt -= 1;
    const l = s.p[1 - s.winner];
    if (s.pt === 200) { l.st = "air_hit"; l.vy = 60; l.y = 1; l.ko = 1; l.sf = 0; }
    if (s.pt <= 0) { s.phase = "over"; s.ev.push({ k: "matchover", p: s.winner, fatality: 1 }); }
  }

  for (let i = 0; i < 2; i++) control(s, i, ins[i]);
  for (let i = 0; i < 2; i++) physics(s, i);
  if (s.phase === "fight") {
    updateProjectiles(s);
    findHits(s);
  } else if (s.phase !== "intro") {
    updateProjectiles(s);
  }
  keepApart(s);
  faceEachOther(s);
  resetCombos(s);

  if (s.phase === "fight") {
    const [a, b] = s.p;
    const aDead = a.hp === 0, bDead = b.hp === 0;
    if (aDead || bDead) {
      // wait until the loser hits the floor
      const loser = aDead ? a : b;
      if (loser.st === "ko" || (aDead && bDead)) {
        s.phase = "ko"; s.pt = 80;
      }
    } else if (s.timer <= 0) {
      s.ev.push({ k: "timeup" });
      endRound(s, a.hp > b.hp ? 0 : b.hp > a.hp ? 1 : -1);
    }
  } else if (s.phase === "ko") {
    s.pt -= 1;
    if (s.pt <= 0) {
      const [a, b] = s.p;
      endRound(s, a.hp === 0 && b.hp === 0 ? -1 : a.hp === 0 ? 1 : 0);
    }
  }
  if (s.phase === "roundend" || s.phase === "over") {
    const w = s.phase === "over" ? s.winner : s.roundWinner;
    if (w >= 0) {
      const p = s.p[w];
      if (p.st !== "win" && p.y === 0 && p.st !== "attack") { p.st = "win"; p.sf = 0; p.vx = 0; }
    }
  }
  return s;
}

export const CONST = { STAGE, MAX_GAP, BODY, METER_MAX, ROUND_TIME, WALK_F, WALK_B };
