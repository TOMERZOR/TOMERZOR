/* השתול · shorts kit — the engine of the 41 s film (../film.js), without its story.
 *
 * Load order (see template/comp.html):  ../../motion.js · ../../vendor/chars.js · ../../vendor/screens.js · ../kit.js ·
 * ../endcard.js · film.js.  The page shell must have #stage > #ground, canvas#dots, #cam > #phone, canvas#fxc, #hud.
 *
 * Coordinates: "game px" = the phone's 430×932 CSS px. The world is game px × G (2.5); one camera looks at it and
 * the frame is 1080×1920. Everything you pass to the kit (rects, knots, sound positions) is in game px.
 *
 * Usage (a whole short, minus its update code — template/film.js is the full example):
 *
 *   const { K, put, life, M, Pt, Fr, ev } = KIT;
 *   const T = { flip: 1.2, end0: 4.0 };
 *   const END = KIT.endcard({ t0: T.end0 });          // or { hit: 5.07 } to land the wordmark on a bar line
 *   T.dur = END.dur;                                    // t0 + 4.0
 *   const E = {};
 *   KIT.run({
 *     T,
 *     build()   { const r = KIT.screen('reveal'); E.cells = KIT.$$('.reveal__cell', r); },   // instantiate screens, grab handles
 *     measure() { E.grid = M(KIT.$('.reveal__grid', KIT.S.reveal)); },                     // optional: derive from measured rects
 *     camera()  { return { keys: [{ t: 0, ...Fr(E.grid, 1.0) }], hits: [[T.flip, 14, 9]], rests: [[0, 0.8]] }; },
 *     update(t) { KIT.on(KIT.S.reveal, t < T.end0 + 0.7); E.cells.forEach((c, i) => put(c, life(t, 0.2 + i * 0.06, { s: 0.5 }))); },
 *     events()  { ev(T.flip, 'flip', 215, 400, 0.8); },
 *     track(box){ box('grid', KIT.$('.reveal__grid', KIT.S.reveal)); },                    // optional, for probe/verify
 *   });
 *   KIT.finger(() => ({ knots: [...], taps: [T.tap], windows: [[T.tap - 0.6, T.tap + 0.45]] }));  // after measure
 *
 * API (all on window.KIT):
 *   constants  W H G FPS SAFE NAMES CODES SPR ease(=OM.ease) OM
 *   motion     K(t,t0,kind)  spring(...)  life(t,t0,A,kind,R,t1,dur,X,curve)  mixS  pulse(t,t0,amp,decay,omega)  press(t,tc,dur)
 *              clamp lerp seg sstep cubicIn  toRect(r,v,uniform)  lerpRect(a,b,k)  center(r)  arcPt(a,b,k,h)  fix(v,n)
 *   DOM        $ $$ mk(tag,cls,parent=fx,inner)  put(el,{x,y,r,s,sx,sy,ry,op,base})  hide  txt html cls attr cssv  on(screen,bool)
 *              el.__base = the element's resting transform (appended by put unless o.base is given)
 *   screens    screen(name, src=name) → div.scr (S[name]); ids/clip-paths renamed per instance. S = all screens. fx = the fx layer.
 *              avatar(code,o) svgOf(code,o) swapAvatar(span,code,o) splitWords(el,sel)
 *   measure    M(el) → {x,y,w,h} game px, measured once with an identity camera and every screen on (after build()).
 *   camera     Pt(gx,gy,zoom)  Fr(rect,zoom,ox,oy) → camera keys {x,y,zoom} (+ t, curve).  camAt(t) → {x,y,zoom,rot}
 *              restEnv(t) (0 in rests)  rayAngle(t) (deg, the motion clock)  rays(el,t,a,op,sc,base)  wobble(t,el,from,amp)
 *   fx parts   finger(spec)  sweat(spec)  confetti(spec)  emoji(spec)   — spec = object or () => object (resolved after measure)
 *   sound      ev(t, kind, gx, gy, v)   (pan is computed from the camera at t, like the film)
 *   film       run({T, build, measure, camera, update, events, track})  → installs __meta __ready __seek __track __motion __events
 *              part(obj) registers an extra part with optional build/measured/camera(acc)/events/update(t,mat)/track(box) hooks.
 *   preview    comp.html?play · ?t=3.2&hud · &safe (draws the TikTok/Reels safe zone) · ?render (used by the tools)
 *
 * Every frame is a pure function of t: update(t) must write every property it ever changes, every frame (put/txt/cls…
 * cache, so this is cheap). Nothing may accumulate between seeks.
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, sstep, spring, ease, camera, view, shake, screenTravel } = OM;
  const W = 1080, H = 1920, G = 2.5, FPS = 30;
  const cubicIn = u => u * u * u;
  const Q = new URLSearchParams(location.search);
  // TikTok / Reels: keep anything that matters out of the top 150 px, the bottom 420 px, and the right 130 px of the lower half.
  const SAFE = { top: 150, bottom: 420, right: 130, rightFromY: H / 2 };

  // The game's own springs (framer-motion presets in its bundle) as ζ, ω.
  const SPR = {
    pop: [20 / (2 * Math.sqrt(520 * 0.9)), Math.sqrt(520 / 0.9)],     // ζ .46 ω 24
    soft: [26 / (2 * Math.sqrt(300)), Math.sqrt(300)],                 // ζ .75 ω 17
    bouncy: [14 / (2 * Math.sqrt(380)), Math.sqrt(380)],               // ζ .36 ω 19.5
    firm: [0.82, 20],
    snap: [0.9, 30],
  };
  const K = (t, t0, kind = 'pop') => (t <= t0 ? 0 : spring(t - t0, SPR[kind][0], SPR[kind][1]));
  const NAMES = ['תומר', 'נועה', 'איתי', 'שירה', 'יובל', 'דנה'];
  const CODES = { 'תומר': 'demo-1', 'נועה': 'demo-2', 'איתי': 'demo-3', 'שירה': 'demo-4', 'יובל': 'demo-5', 'דנה': 'demo-6' };

  // ───────────────────────────── small helpers (verbatim from film.js) ─────────────────────────────
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const EV = [];
  const ev = (t, kind, gx = 215, gy = 466, v = 1) => EV.push({ t, kind, gx, gy, v });
  const fix = (v, n = 2) => (Math.abs(v) < 1e-4 ? '0' : v.toFixed(n));
  function put(el, o) {
    if (!el) return;
    o = o || {};
    const s = o.s ?? 1, sx = (o.sx ?? 1) * s, sy = (o.sy ?? 1) * s, op = clamp(o.op ?? 1);
    let tr = '';
    if (o.x || o.y) tr += `translate(${fix(o.x || 0)}px,${fix(o.y || 0)}px) `;
    if (o.r) tr += `rotate(${fix(o.r, 3)}deg) `;
    if (sx !== 1 || sy !== 1) tr += `scale(${fix(sx, 4)},${fix(sy, 4)}) `;
    if (o.ry) tr += `rotateY(${fix(o.ry, 2)}deg) `;
    tr += (o.base ?? el.__base ?? '');
    tr = tr.trim() || 'none';
    if (el.__tr !== tr) { el.style.transform = tr; el.__tr = tr; }
    const ops = op >= 0.999 ? '1' : op <= 0.002 ? '0' : op.toFixed(3);
    if (el.__op !== ops) { el.style.opacity = ops; el.__op = ops; el.style.visibility = ops === '0' ? 'hidden' : ''; }
  }
  const hide = el => put(el, { op: 0 });
  function txt(el, s) { if (el && el.__txt !== s) { el.textContent = s; el.__txt = s; } }
  function html(el, s) { if (el && el.__html !== s) { el.innerHTML = s; el.__html = s; } }
  function cls(el, c, on) { if (el && el.classList.contains(c) !== !!on) el.classList.toggle(c, !!on); }
  function attr(el, a, v) { if (!el) return; const cur = el.getAttribute(a); if (v == null) { if (cur != null) el.removeAttribute(a); } else if (cur !== String(v)) el.setAttribute(a, v); }
  function cssv(el, k, v) { if (el && el['__' + k] !== v) { el.style.setProperty(k, v); el['__' + k] = v; } }
  function on(scr, b) { if (scr.__on !== b) { scr.classList.toggle('on', b); scr.__on = b; } }
  const mixS = (A, B, k) => ({ x: lerp(A.x ?? 0, B.x ?? 0, k), y: lerp(A.y ?? 0, B.y ?? 0, k), s: lerp(A.s ?? 1, B.s ?? 1, k),
    sx: lerp(A.sx ?? 1, B.sx ?? 1, k), sy: lerp(A.sy ?? 1, B.sy ?? 1, k), r: lerp(A.r ?? 0, B.r ?? 0, k), op: lerp(A.op ?? 1, B.op ?? 1, k) });
  // enter from A with a spring, rest at R, leave towards X over [t1, t1+dur]
  function life(t, t0, A, kind = 'pop', R = {}, t1 = 1e9, dur = 0.3, X = { op: 0 }, curve = ease.cubicInOut) {
    if (t < t0) return { ...R, ...A, op: 0 };
    const k = K(t, t0, kind), Afull = { x: 0, y: 0, s: 1, r: 0, op: 0, ...R, ...A };
    const Rfull = { x: 0, y: 0, s: 1, r: 0, op: 1, ...R };
    let S = mixS(Afull, Rfull, k); S.op = lerp(Afull.op, Rfull.op, clamp(k * 1.8));
    const kx = curve(seg(t, t1, t1 + dur));
    if (kx > 0) S = mixS(S, { ...S, ...X }, kx);
    return S;
  }
  // FLIP: where must an element whose own rect is `r` move to look like rect `v`?
  const toRect = (r, v, uniform = false) => {
    const sx = v.w / r.w, sy = v.h / r.h, su = Math.sqrt(sx * sy);
    return { x: v.x + v.w / 2 - (r.x + r.w / 2), y: v.y + v.h / 2 - (r.y + r.h / 2), sx: uniform ? su : sx, sy: uniform ? su : sy };
  };
  const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
  const center = r => [r.x + r.w / 2, r.y + r.h / 2];
  const arcPt = (a, b, k, hgt) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) - Math.sin(Math.PI * k) * hgt];
  const press = (t, tc, dur = 0.12) => t >= tc && t < tc + dur;
  const pulse = (t, t0, amp = 0.16, decay = 9, omega = 26) => (t <= t0 ? 0 : Math.exp(-decay * (t - t0)) * Math.sin(omega * (t - t0)) * amp);

  // ───────────────────────────── screens ─────────────────────────────
  const stage = $('#stage'), cam = $('#cam'), phone = $('#phone'), dotsC = $('#dots'), fxc = $('#fxc');
  const S = {};
  const fx = document.createElement('div'); fx.id = 'fx'; phone.appendChild(fx);    // always the top layer of the phone
  const mk = (tag, cl, parent = fx, inner = '') => { const e = document.createElement(tag); if (cl) e.className = cl; e.innerHTML = inner; parent.appendChild(e); return e; };
  // A captured screen of the game. A second instance of the same capture gets its ids, url(#…) and href="#…" renamed,
  // or two instances share clip paths and draw coloured rectangles.
  function screen(name, src) {
    if (S[name]) throw new Error(`KIT.screen: "${name}" exists already`);
    src = src || name;
    let markup = window.SCREENS[src];
    if (markup == null) throw new Error(`KIT.screen: no captured screen "${src}" (see vendor/screens.js)`);
    if (src !== name) markup = markup.replace(/(\sid=")([^"]+)"/g, `$1${name}__$2"`).replace(/url\(#([^)]+)\)/g, `url(#${name}__$1)`).replace(/href="#([^"]+)"/g, `href="#${name}__$1"`);
    const d = document.createElement('div');
    d.className = 'scr'; d.dataset.s = name;
    d.innerHTML = markup;
    phone.insertBefore(d, fx); S[name] = d; return d;
  }
  const avatar = (code, o) => window.CH.avatar(code, o);
  const svgOf = (code, o) => window.CH.svg(code, o);
  function swapAvatar(span, code, o) { const s = document.createElement('span'); s.innerHTML = avatar(code, o); const n = s.firstChild; span.replaceWith(n); return n; }
  function splitWords(el, sel = null) {             // wrap words in span.w (keeps <b> / <br>)
    const out = [];
    (sel ? $$(sel, el) : [el]).forEach(node => {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) {
          const parts = ch.textContent.split(/(\s+)/).filter(p => p.length);
          const frag = document.createDocumentFragment();
          parts.forEach(p => { if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p)); else { const w = document.createElement('span'); w.className = 'w'; w.textContent = p; frag.appendChild(w); out.push(w); } });
          ch.replaceWith(frag);
        }
      });
    });
    return out;
  }

  // ───────────────────────────── measure (game px, layout as captured, identity camera) ─────────────────────────────
  // Every element of every screen and of the fx layer is measured once, after build() (SVG internals excluded).
  const MR = new Map();
  function measureAll() {
    cam.style.transform = 'none'; phone.style.transform = 'none';
    Object.values(S).forEach(s => s.classList.add('on'));
    const p0 = phone.getBoundingClientRect();
    const els = $$('*', phone).filter(e => !(e.ownerSVGElement));
    for (const el of els) { const r = el.getBoundingClientRect(); MR.set(el, { x: r.left - p0.left, y: r.top - p0.top, w: r.width, h: r.height }); }
    Object.values(S).forEach(s => { s.classList.remove('on'); s.__on = false; });
    phone.style.transform = '';
  }
  const M = el => { const r = MR.get(el); if (!r) throw new Error('KIT.M: element was not measured (create it in build(), not later)'); return r; };

  // ───────────────────────────── camera ─────────────────────────────
  let KEYS = [], HITS = [], RESTS = [], DUR = 10;
  const Fr = (r, zoom, ox = 0, oy = 0) => ({ x: (r.x + r.w / 2 + ox) * G, y: (r.y + r.h / 2 + oy) * G, zoom });
  const Pt = (gx, gy, zoom) => ({ x: gx * G, y: gy * G, zoom });
  // a hand on the camera: a slow two-sine float, zero in the rests; hits shake it
  const restEnv = t => { let e = 1; for (const [a, b] of RESTS) e = Math.min(e, 1 - Math.min(sstep(a - 0.25, a, t), 1 - sstep(b, b + 0.25, t))); return e; };
  function camAt(t) {
    const c = camera(t, KEYS, { W, H });
    const e = restEnv(t) * 3.2;
    let x = c.x + e * (Math.sin(1.7 * t) + 0.6 * Math.sin(2.9 * t + 1)) / c.zoom;
    let y = c.y + e * (Math.sin(1.3 * t + 2) + 0.5 * Math.sin(3.3 * t)) / c.zoom;
    let rot = c.rot + restEnv(t) * 0.0016 * Math.sin(0.9 * t + 0.4);
    for (const [th, amp, decay] of HITS) { const s = shake(t, th, { amp, decay, seed: Math.round(th * 100) }); x += s.x / c.zoom; y += s.y / c.zoom; rot += s.rot; }
    return { x, y, zoom: c.zoom, rot };
  }
  // where the keyed camera (no float, no shake) is at t — what a part that takes over the camera starts from
  const keyedAt = t => camera(t, KEYS, { W, H });

  // rays turn only while the film moves: their angle is the integral of the rest envelope (precomputed)
  let RAYA = null;
  function buildRays() { const n = Math.ceil(DUR * 120) + 2; RAYA = new Float32Array(n); let a = 0; for (let i = 1; i < n; i++) { a += restEnv(i / 120) * 7 / 120; RAYA[i] = a; } }
  const rayAngle = t => RAYA[clamp(Math.round(t * 120), 0, RAYA.length - 1)];
  function rays(el, t, a, op, sc = 1, base = 'translate(-50%,0)') {
    if (!el) return;
    const tr = `${base} rotate(${fix(a, 2)}deg) scale(${fix(sc, 3)})`;
    if (el.__tr !== tr) { el.style.transform = tr; el.__tr = tr; }
    const ops = op >= 0.999 ? '1' : op <= 0.002 ? '0' : op.toFixed(3);
    if (el.__op !== ops) { el.style.opacity = ops; el.__op = ops; }
  }
  function wobble(t, el, from = 0, amp = 3) {        // the game's .wobble: ±3° over 2.6 s, on the motion clock (still in rests)
    const env = sstep(from, from + 0.6, t), mc = (rayAngle(t) - rayAngle(from)) / 7;
    put(el, { r: env * amp * Math.sin(Math.max(0, mc) * 2 * Math.PI / 2.6), base: '' });
  }

  // ───────────────────────────── the dots behind everything ─────────────────────────────
  const dg = dotsC.getContext('2d');
  function drawDots(c) {
    dg.setTransform(1, 0, 0, 1, 0, 0); dg.clearRect(0, 0, W, H);
    const depth = 0.55, M0 = view(c, { W, H, depth }), sp = 26 * G, k = Math.hypot(M0[0], M0[1]);
    const inv = OM.unproject;
    const cs = [[0, 0], [W, 0], [0, H], [W, H]].map(p => inv(M0, p[0], p[1]));
    const x0 = Math.floor(Math.min(...cs.map(p => p[0])) / sp) * sp, x1 = Math.max(...cs.map(p => p[0]));
    const y0 = Math.floor(Math.min(...cs.map(p => p[1])) / sp) * sp, y1 = Math.max(...cs.map(p => p[1]));
    const r = Math.max(1.2, 1.7 * G * k / 2.5 * 0.9);
    dg.fillStyle = 'rgba(255,255,255,0.085)';
    dg.beginPath();
    for (let y = y0; y <= y1 + sp; y += sp) for (let x = x0; x <= x1 + sp; x += sp) {
      const sx = M0[0] * x + M0[2] * y + M0[4], sy = M0[1] * x + M0[3] * y + M0[5];
      if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
      dg.moveTo(sx + r, sy); dg.arc(sx, sy, r, 0, Math.PI * 2);
    }
    dg.fill();
  }
  const fg = fxc.getContext('2d');

  // ───────────────────────────── parts ─────────────────────────────
  // A part hooks into the run: build() · measured() · camera(acc) · events() · update(t, mat) · track(box).
  const PARTS = [];
  const part = p => { PARTS.push(p); return p; };
  const resolve = spec => (typeof spec === 'function' ? spec() : spec);

  // the finger: knots [{t,x,y}] (game px), taps [t], windows [[tIn, tOut]] when it is on screen; a ripple on every tap
  function finger(spec) {
    const P = { HAND: [], TAPS: [], FWIN: [] };
    P.build = () => { P.f = mk('div', 'finger'); P.rp = mk('div', 'ripple'); };
    P.measured = () => { const s = resolve(spec); P.HAND = s.knots; P.TAPS = s.taps || []; P.FWIN = s.windows || []; };
    P.update = t => {
      const f = P.f, rp = P.rp;
      let op = 0;
      for (const [a, b] of P.FWIN) op = Math.max(op, sstep(a, a + 0.14, t) * (1 - sstep(b - 0.18, b, t)));
      if (op <= 0.001) { hide(f); hide(rp); return; }
      const c = OM.cursor(t, P.HAND, P.TAPS, { down: 0.82, hold: 0.12 });
      put(f, { base: `translate(${fix(c.x)}px,${fix(c.y)}px) scale(${fix(c.s, 3)})`, op });
      let last = null; for (const tp of P.TAPS) if (t >= tp && t < tp + 0.4) last = tp;
      if (last == null) { hide(rp); return; }
      const k = seg(t, last, last + 0.4), p = OM.cursor(last, P.HAND, P.TAPS);
      put(rp, { base: `translate(${fix(p.x)}px,${fix(p.y)}px) scale(${fix(1 + 1.6 * ease.cubicOut(k), 3)})`, op: (1 - k) * 0.9 * op });
    };
    P.track = box => box('finger', P.f);
    return part(P);
  }

  // sweat drops: [{t0, t1, x, y}] game px. style 'drip' (the eggplant's close-up: grows, slides 26 px) or 'bead' (יובל's: small, 12 px)
  const SWEAT_SVG = '<svg viewBox="0 0 14 20" width="14" height="20"><path d="M7 1C10 7 12.5 10 12.5 13A5.5 5.5 0 0 1 1.5 13C1.5 10 4 7 7 1Z" fill="#8ADBFF" stroke="#1B0A36" stroke-width="2"/></svg>';
  function sweat(spec) {
    const P = { drops: [] };
    P.build = () => { P.el = mk('div', 'sweatdrop', fx, SWEAT_SVG); };
    P.measured = () => { P.drops = [].concat(resolve(spec)); };
    P.update = t => {
      for (const d of P.drops) {
        if (t < d.t0 || t >= d.t1 + 0.1) continue;
        const k = seg(t, d.t0, d.t1);
        if ((d.style || 'drip') === 'drip') put(P.el, { base: `translate(${fix(d.x)}px,${fix(d.y + 26 * ease.quadOut(k) * k)}px) scale(${fix(lerp(0.2, 0.8, sstep(0, 0.25, k)), 3)})`, op: 1 - sstep(0.8, 1, k) });
        else put(P.el, { base: `translate(${fix(d.x)}px,${fix(d.y + 12 * k)}px) scale(${fix(0.55 * sstep(0, 0.2, k), 3)})`, op: 1 - sstep(0.75, 1, k) });
        return;
      }
      hide(P.el);
    };
    return part(P);
  }

  // emoji fly-ups: [{t0, ch, from:[gx,gy], to:[gx,gy], i}] — the game's reactions floating up (1.05 s each)
  function emoji(spec) {
    const P = { list: [] };
    P.measured = () => { P.list = [].concat(resolve(spec)); P.list.forEach(e => { e.el = mk('div', 'flyemoji', fx, e.ch); }); };
    P.update = t => P.list.forEach((e, n) => {
      const i = e.i ?? n, t0 = e.t0, life_ = 1.05;
      if (t < t0 || t > t0 + life_) { hide(e.el); return; }
      const k = ease.cubicOut(seg(t, t0, t0 + 0.95));
      const [x, y] = arcPt(e.from, e.to, k, 30);
      const s = lerp(0.4, 0.9, K(t, t0, 'pop'));
      put(e.el, { base: `translate(${fix(x)}px,${fix(y)}px) rotate(${fix(Math.sin((t - t0) * 9 + i) * 10, 2)}deg) scale(${fix(s, 3)})`, op: 1 - sstep(t0 + 0.6, t0 + life_, t) });
    });
    return part(P);
  }

  // confetti: {t0, x, y (game px, the burst's origin), seed, n} — the game's celebration, drawn on the fx canvas
  function confetti(spec) {
    const P = {};
    P.measured = () => {
      const s = resolve(spec); P.s = s;
      const r = OM.rng(s.seed ?? 31), a = [], cols = ['#ffd23f', '#ff3d9a', '#43d97b', '#6ad1ff', '#ff6b4a', '#b9a0ff'];
      for (let i = 0; i < (s.n ?? 70); i++) a.push({ x: r(), vx: (r() - 0.5) * 1.6, vy: -0.8 - r() * 1.4, rot: r() * 6, vr: (r() - 0.5) * 14, w: 7 + r() * 9, h: 4 + r() * 5, c: cols[i % cols.length], d: r() * 0.12 });
      P.CONF = a;
    };
    P.update = (t, camM) => {
      const t0 = P.s.t0; if (t < t0 || t > t0 + 1.7) return;
      const ox = P.s.x, oy = P.s.y;
      fg.setTransform(camM[0] * G, camM[1] * G, camM[2] * G, camM[3] * G, camM[4], camM[5]);
      for (const p of P.CONF) {
        const tt = t - t0 - p.d; if (tt <= 0) continue;
        const x = ox + (p.x - 0.5) * 60 + p.vx * 160 * tt, y = oy + p.vy * 260 * tt + 0.5 * 520 * tt * tt;
        const a = 1 - sstep(1.1, 1.6, tt);
        fg.save(); fg.translate(x, y); fg.rotate(p.rot + p.vr * tt); fg.globalAlpha = a; fg.fillStyle = p.c;
        fg.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.vr * tt * 0.7)) + 1); fg.restore();
      }
      fg.setTransform(1, 0, 0, 1, 0, 0);
    };
    return part(P);
  }

  // ───────────────────────────── the run: hooks like the film's ─────────────────────────────
  let CAM = null, MAT = null, FILM = null;
  function seek(t) {
    const T = FILM.T;
    t = clamp(t, 0, T.dur - 1e-6);
    CAM = camAt(t); MAT = view(CAM, { W, H });
    cam.style.transform = `matrix(${MAT.map(v => v.toFixed(5)).join(',')})`;
    drawDots(CAM);
    fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, W, H);
    FILM.update(t, MAT);
    for (const p of PARTS) if (p.update) p.update(t, MAT);
    if (document.body.classList.contains('hud')) $('#hud').textContent = t.toFixed(2) + 's';
  }
  function track() {                                 // screen boxes of what the story is about, for probe/verify
    const out = {}, s0 = stage.getBoundingClientRect();
    const box = (key, el) => { if (!el) return; const r = el.getBoundingClientRect(); const op = +getComputedStyle(el).opacity; if (r.width < 1) return; out[key] = { x: r.left - s0.left, y: r.top - s0.top, w: r.width, h: r.height, op }; };
    if (FILM.track) FILM.track(box);
    for (const p of PARTS) if (p.track) p.track(box);
    return out;
  }
  function travel(a, b) { let d = 0; for (const k in a) if (b[k] && a[k].op > 0.05) d = Math.max(d, Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y), Math.hypot(a[k].x + a[k].w - b[k].x - b[k].w, a[k].y + a[k].h - b[k].y - b[k].h)); return d; }
  // boxes from track() that break SAFE at t (visible ones only) — for the checklist
  function unsafe(t) {
    if (t != null) seek(t);
    const out = [], b = track();
    for (const k in b) {
      const r = b[k]; if (r.op < 0.05 || k === 'finger') continue;
      const why = [];
      if (r.y < SAFE.top) why.push('top');
      if (r.y + r.h > H - SAFE.bottom) why.push('bottom');
      if (r.x + r.w > W - SAFE.right && r.y + r.h > SAFE.rightFromY) why.push('right');
      if (r.x < 0 || r.x + r.w > W) why.push('cropped');
      if (why.length) out.push({ key: k, why, box: r });
    }
    return out;
  }

  function run(film) {
    FILM = film; const T = film.T;
    DUR = T.dur;
    async function ready() {
      const fams = ['300', '400', '500', '600', '700', '800', '900'].map(w => `${w} 40px "Rubik Variable"`);
      await Promise.all([...fams.map(f => document.fonts.load(f, 'אבגדהוזחטיכלמנסעפצקרשת 0123456789 abc')), document.fonts.load('700 40px Karantina', 'אב')]);
      await document.fonts.ready;
      DUR = T.dur;
      film.build && film.build();
      for (const p of PARTS) p.build && p.build();
      measureAll();
      film.measure && film.measure();
      for (const p of PARTS) p.measured && p.measured();
      const c = (film.camera && film.camera()) || {};
      const acc = { keys: (c.keys || []).slice(), hits: (c.hits || []).slice(), rests: (c.rests || []).slice() };
      KEYS = acc.keys; HITS = acc.hits; RESTS = acc.rests;  // parts may read the scene's camera (keyedAt) while adding theirs
      for (const p of PARTS) p.camera && p.camera(acc);
      KEYS = acc.keys.slice().sort((a, b) => a.t - b.t); HITS = acc.hits; RESTS = acc.rests;
      buildRays();
      film.events && film.events();
      for (const p of PARTS) p.events && p.events();
      EV.sort((a, b) => a.t - b.t);
      seek(+(Q.get('t') || 0));
      return true;
    }
    window.__meta = { dur: T.dur, fps: FPS, w: W, h: H, cuts: [], inFrame: film.inFrame || {} };
    window.__ready = ready();
    window.__seek = t => { seek(t); return Promise.resolve(true); };
    window.__track = t => { if (t != null) seek(t); return track(); };
    window.__motion = (t0, t1) => {
      const tm = (t0 + t1) / 2;
      const c0 = camAt(t0), c1 = camAt(t1), cm = camAt(tm);
      let d = screenTravel(c0, c1, cm, { W, H });
      seek(t0); const a = track(); seek(tm); const m = track(); seek(t1); const b = track();
      d = Math.max(d, travel(a, m) + travel(m, b));
      return d;
    };
    window.__events = () => ({ T, events: EV.map(e => { const M0 = view(camAt(e.t), { W, H }); const sx = M0[0] * e.gx * G + M0[2] * e.gy * G + M0[4]; return { t: +e.t.toFixed(4), kind: e.kind, pan: +clamp((sx - W / 2) / (W / 2), -1, 1).toFixed(3), v: e.v }; }) });
    window.__unsafe = unsafe;
    window.__T = T;

    // preview: ?play runs in real time, ?t=…&hud pins a frame, &safe shows the safe zone
    if (Q.has('hud')) document.body.classList.add('hud');
    if (Q.has('safe') && !Q.has('render')) {
      const z = (css) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;z-index:98;pointer-events:none;background:rgba(255,0,60,.22);outline:2px dashed #f04;' + css; stage.appendChild(d); };
      z(`left:0;top:0;width:${W}px;height:${SAFE.top}px`); z(`left:0;bottom:0;width:${W}px;height:${SAFE.bottom}px`);
      z(`right:0;top:${SAFE.rightFromY}px;width:${SAFE.right}px;height:${H - SAFE.rightFromY - SAFE.bottom}px`);
    }
    if (Q.has('play')) window.__ready.then(() => { const t0 = performance.now(); const loop = () => { const t = ((performance.now() - t0) / 1000) % T.dur; seek(t); requestAnimationFrame(loop); }; loop(); });
    if (!Q.has('render')) { const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${s})`; }; addEventListener('resize', fit); fit(); }
    else document.body.classList.add('render');
  }

  window.KIT = {
    OM, W, H, G, FPS, SAFE, SPR, K, NAMES, CODES, Q,
    clamp, lerp, seg, sstep, spring, ease, cubicIn,
    $, $$, mk, fix, put, hide, txt, html, cls, attr, cssv, on, mixS, life, toRect, lerpRect, center, arcPt, press, pulse,
    S, fx, stage, screen, avatar, svgOf, swapAvatar, splitWords,
    M, Fr, Pt, camAt, keyedAt, restEnv, rayAngle, rays, wobble, drawDots,
    ev, EV, part, finger, sweat, emoji, confetti, run, seek: t => seek(t), unsafe,
  };
})();
