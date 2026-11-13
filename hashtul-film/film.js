/* השתול · "סבב אחד, טייק אחד" — one round of the game in one continuous take.
 *
 * Every frame is a pure function of time: window.__seek(t) writes the whole picture for t and nothing accumulates
 * between calls, so the renderer can seek anywhere (and many times per frame, for the shutter).
 *
 * The material is the game itself (vendor/): its stylesheet and fonts, screens captured from its own ?demo= mode,
 * and its character generator. Coordinates: "game px" are the phone's 430×932 CSS px; the world is game px × G and
 * one camera (OM.camera/OM.view) looks at it. Times live in T; sounds are exported from the same times (__events).
 */
(function () {
  'use strict';
  const { clamp, lerp, seg, sstep, spring, ease, camera, view, shake, screenTravel } = OM;
  const W = 1080, H = 1920, G = 2.5, FPS = 30;
  const cubicIn = u => u * u * u;
  const Q = new URLSearchParams(location.search);
  // ?cut=clean: the cut for TikTok / Reels. No sex on screen: Yuval's question is about the ex, and pepper mode stays off.
  const CLEAN = Q.get('cut') === 'clean';
  const CLEAN_FAKE = 'כמה פעמים בשבוע אתם בודקים מה האקס מעלה?';

  // The game's own springs (framer-motion presets in its bundle) as ζ, ω — the film moves like the game.
  const SPR = {
    pop: [20 / (2 * Math.sqrt(520 * 0.9)), Math.sqrt(520 / 0.9)],     // ζ .46 ω 24
    soft: [26 / (2 * Math.sqrt(300)), Math.sqrt(300)],                 // ζ .75 ω 17
    bouncy: [14 / (2 * Math.sqrt(380)), Math.sqrt(380)],               // ζ .36 ω 19.5
    firm: [0.82, 20],
    snap: [0.9, 30],
  };
  const K = (t, t0, kind = 'pop') => (t <= t0 ? 0 : spring(t - t0, SPR[kind][0], SPR[kind][1]));

  // ───────────────────────────── timeline ─────────────────────────────
  const T = {
    // A · the eye, the logo, the pitch
    glance1: 0.62, glance2: 1.02, sweat0: 0.78, sweat1: 1.42, pull0: 1.50, pull1: 2.42,
    word0: 2.08, bar: 2.54, adult: 2.84, pitch0: 3.06, punch: 3.95, rest0: 4.26,
    // B · join with a code
    btns: 4.40, fIn: 4.56, tapCode: 5.04, morph0: 5.10, morph1: 5.62, joinOnion: 5.44, joinTitle: 5.52, joinLead: 5.66,
    dig: [5.86, 6.00, 6.12, 6.24, 6.40], fly0: 6.56, fly1: 6.98,
    // C · the lobby fills
    card: 6.68, head: 6.86, lshare: 6.98, panel: 7.02, joins: [7.18, 7.36, 7.50, 7.68, 7.82, 8.00], lcrown: 7.30, danaOn: 8.40,
    pepper: 8.04, pepperOn: 8.54, settings: [8.66, 8.74], wait: 8.80, start: 9.34,
    // D · round intro
    lobbyOut: 9.40, rays0: 9.52, hdr: 9.56, introWord: 9.86, introNum: 9.98, introOf: 10.20, introLine: 10.36, mole: 10.52, introOut: 11.30,
    // E · the question, dealt
    q: 11.44, hint: 11.74, deal0: 11.98, dealStep: 0.08, dealDur: 0.5, pad0: 12.74,
    // F · answering
    f2In: 13.12, tap3: 13.86, tapLock: 14.44, padOut: 14.52, locked: 14.60, stamp: 14.86,
    check: { 'תומר': 12.94, 'יובל': 13.04, 'שירה': 13.46, 'נועה': 14.44, 'איתי': 14.96, 'דנה': 15.26 },
    // G · the real question, the answers
    rv0: 15.40, rvTitle: 15.56, rvShrink: 16.30, cells0: 16.32,
    flip: { 'שירה': 17.00, 'תומר': 17.40, 'דנה': 17.72, 'נועה': 18.00, 'איתי': 18.26, 'יובל': 18.95 },
    discuss: 19.12, emoji: [19.34, 19.50, 19.68, 19.86], rest1: 19.98, waitLine: 20.50,
    // H · the vote
    vt0: 20.78, vt1: 21.28, f3In: 21.62, tapYuval: 22.40, tapConfirm: 22.96,
    voted: { 'תומר': 21.44, 'איתי': 21.64, 'יובל': 21.90, 'נועה': 22.96, 'דנה': 23.26, 'שירה': 23.48 },
    // I · the result
    rs0: 23.86, rs1: 24.36, minis0: 24.52, miniStep: 0.12, drum: 25.40, spot0: 25.96, spotEnd: 27.30,
    figDrop: 27.53, verdict: 27.95, line: 28.27, card0: 28.84, tag: 29.08, fake: 29.24, bubble: 29.80, real: 30.08,
    hold0: 30.28, hold1: 31.50, gains: 31.66, coins0: 31.90, coins1: 32.36,
    // J · the podium
    fn0: 32.46, fnTitle: 32.58, steps: [32.62, 32.76, 32.90], figs: [33.40, 33.66, 34.02], crown: 34.45, ribbon: 34.63,
    hold2: 35.40, share: 35.86, tapShare: 36.24,
    // K · the end card
    end0: 36.34, endWord: 37.08, endCast: 36.70, endPitch: 37.90, endCta: 38.62, endBtn: 38.76, hold3: 39.10, wink: 40.30,
    dur: 41.0,
  };
  const NAMES = ['תומר', 'נועה', 'איתי', 'שירה', 'יובל', 'דנה'];
  const CODES = { 'תומר': 'demo-1', 'נועה': 'demo-2', 'איתי': 'demo-3', 'שירה': 'demo-4', 'יובל': 'demo-5', 'דנה': 'demo-6' };
  const VOTE_FOR = { 'תומר': 'יובל', 'נועה': 'יובל', 'איתי': 'יובל', 'שירה': 'תומר', 'יובל': 'תומר', 'דנה': 'יובל' };

  // ───────────────────────────── small helpers ─────────────────────────────
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const EV = [];                                   // sound events: {t, kind, gx, gy, v}
  const ev = (t, kind, gx = 215, gy = 466, v = 1) => EV.push({ t, kind, gx, gy, v });
  const fix = (v, n = 2) => (Math.abs(v) < 1e-4 ? '0' : v.toFixed(n));

  // One write per element per frame: translate · rotate · scale · rotateY, then the element's own resting transform.
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

  // ───────────────────────────── build ─────────────────────────────
  const stage = $('#stage'), cam = $('#cam'), phone = $('#phone'), dotsC = $('#dots'), fxc = $('#fxc');
  const S = {};
  function screen(name, src) {
    const d = document.createElement('div');
    d.className = 'scr'; d.dataset.s = name;
    let markup = window.SCREENS[src || name];
    if (src && src !== name) markup = markup.replace(/(\sid=")([^"]+)"/g, `$1${name}__$2"`).replace(/url\(#([^)]+)\)/g, `url(#${name}__$1)`).replace(/href="#([^"]+)"/g, `href="#${name}__$1"`);
    d.innerHTML = markup;
    phone.appendChild(d); S[name] = d; return d;
  }
  const order = [['home'], ['join'], ['lobby'], ['answer'], ['intro'], ['locked', 'answer_locked'], ['reveal'], ['discuss'],
    ['vote', 'vote_pick'], ['result', 'result_gain'], ['final', 'final_crown'], ['home2', 'home']];
  order.forEach(([n, s]) => screen(n, s));
  const END_DY = -1150;
  S.home2.style.transform = `translateY(${END_DY}px)`;           // the end card sits above the podium; the camera whips up to it
  const fx = document.createElement('div'); fx.id = 'fx'; phone.appendChild(fx);
  const mk = (tag, cl, parent = fx, inner = '') => { const e = document.createElement(tag); if (cl) e.className = cl; e.innerHTML = inner; parent.appendChild(e); return e; };

  const E = {};                                     // element handles, per section
  const avatar = (code, o) => window.CH.avatar(code, o);
  const svgOf = (code, o) => window.CH.svg(code, o);
  function swapAvatar(span, code, o) { const s = document.createElement('span'); s.innerHTML = avatar(code, o); const n = s.firstChild; span.replaceWith(n); return n; }
  function splitWords(el, sel = null) {           // wrap words in spans (keeps <b> / <br>)
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

  function buildHome(root, end) {
    const h = {};
    h.rays = $('.home__rays', root); h.adult = $('.home__adult', root);
    h.cast = $$('.home__cast > div', root);        // tomato, mole, lemon (RTL: tomato on the right)
    h.wordmark = $('.wordmark', root);
    const word = h.wordmark.textContent; h.wordmark.textContent = '';
    h.letters = Array.from(word).map(ch => { const s = document.createElement('span'); s.className = 'ltr'; s.textContent = ch; h.wordmark.appendChild(s); return s; });
    h.pitch = $('.home__pitch', root);
    h.punch = $('b', h.pitch);
    h.words = splitWords(h.pitch).filter(w => !h.punch.contains(w));
    h.btnNew = $$('.screen__foot .btn', root)[0]; h.btnCode = $('.screen__foot .btn--white', root);
    h.link = $('.linkbtn', root); h.legal = $('.legal', root);
    // the mole (eggplant): two faces we can switch, pupils we can move, wobble we drive
    const mole = $('.home__mole .avatar', root);
    mole.innerHTML = `<span class="moleA">${svgOf('eggplant.lid.smirk', { variant: 'figure', planted: true })}</span>` +
      `<span class="moleB">${svgOf('eggplant.lid.smirk', { variant: 'figure', planted: true, mood: 'smug' })}</span>`;
    $$('span', mole).forEach(s => { s.style.cssText = 'position:absolute;inset:0;display:block'; });
    mole.style.position = 'relative';
    h.moleA = $('.moleA', mole); h.moleB = $('.moleB', mole); h.moleSpan = mole;
    h.pupils = $$('.pupil', mole);
    h.moleWobble = $('.home__mole .wobble', root);
    h.wordmark.__base = 'rotate(-4deg)';
    if (end) {                                         // the end card: a link and two facts, in the game's own pieces
      h.cta = mk('div', 'cta', root, `<span class="btn btn--md" style="width:auto;padding:0 26px;font-size:22px"><span class="num">hashtul.onrender.com</span></span>`);
      h.facts = mk('p', 'lead facts', root, `<span class="num">3–12</span> שחקנים · מזמינים בוואטסאפ`);
    }
    return h;
  }

  function build() {
    // A · home
    E.home = buildHome(S.home, false);
    E.end = buildHome(S.home2, true);
    // B · join
    const j = S.join; E.join = {};
    E.join.back = $('header .iconbtn', j); E.join.parts = $$('.stack > *', j);   // onion, title, code, lead
    E.join.boxes = $$('.code__box', j); E.join.input = $('.join__input', j);
    E.join.boxes.forEach(b => { b.textContent = ''; });
    // C · lobby
    const l = S.lobby, L = (E.lobby = {});
    L.icons = $$('header .iconbtn', l); L.chip = $('header .chip', l);
    L.card = $('.lobby__code', l); L.card.__base = 'rotate(-1.5deg)'; L.boxes = $$('.lobby__code .code__box', l);
    L.label = $('.lobby__code-label', l);
    L.share = $('.lobby__share', l); L.panel = $('.panel', l);
    L.players = $$('.lobby__players > button', l);
    L.badge = $('.player__badge', L.players[0]); L.badge.__base = 'translateX(50%) rotate(-10deg)';
    L.me = $('.lobby__me', L.players[1]);
    L.danaAv = $('.avatar', L.players[5]); L.danaSmall = $('.small', L.players[5]);
    L.pepper = $('.pepper', l); L.pepperIcon = $('.pepper > svg', l); L.pepperSub = $('.pepper__sub', l); L.switch = $('.switch', l);
    L.settings = $$('.lobby__settings .chip', l);
    L.wait = $('.screen__foot p', l);
    // D/E/F · answer + intro + locked
    const a = S.answer, A = (E.answer = {});
    A.header = $('header', a); A.icons = $$('header .iconbtn', a); A.chip = $('header .chip', a); A.coin = $('header .coin', a);
    A.timer = $('header .timer', a); A.timerText = $('.timer__text', a);
    A.arc = $$('.timer circle', a).find(c => c.getAttribute('stroke-dasharray') || c.classList.contains('timer__arc')) || $$('.timer circle', a).slice(-1)[0];
    A.q = $('.answer__q', a); A.q.__base = 'rotate(-1.3deg)'; A.hint = $('.answer__hint', a);
    A.dial = $('.answer__dial', a); A.pad = $('.answer__pad', a); A.keys = $$('.answer__key', a);
    A.slotVal = $('.answer__slot-value', a); A.slot = $('.answer__slot', a);
    A.who = $$('.answer__who-one', a); A.whoLine = $('.answer__who-line', a); A.lock = $('.answer__lock', a);
    A.whoFaces = A.who.map((w, i) => {                // neutral and happy faces + a tick for everyone
      const code = CODES[NAMES[i]], ring = NAMES[i] === 'נועה' ? '#FFD23F' : undefined;
      Array.from(w.children).forEach(c => c.remove());
      const box = document.createElement('span'); box.style.cssText = 'position:relative;display:inline-block;line-height:0;width:34px;height:35.36px';
      box.innerHTML = `<span class="f0" style="position:absolute;inset:0">${avatar(code, { size: 34, ring })}</span><span class="f1" style="position:absolute;inset:0">${avatar(code, { size: 34, ring, mood: 'happy' })}</span>`;
      w.appendChild(box);
      const tick = document.createElement('span'); tick.className = 'answer__who-tick';
      tick.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"></path></svg>';
      w.appendChild(tick);
      return { f0: $('.f0', box), f1: $('.f1', box), tick, box };
    });
    const ii = S.intro, I = (E.intro = {});
    I.header = $('header', ii); I.foot = $('.screen__foot', ii);
    I.rays = $('.answer__rays', ii); I.word = $('.answer__intro-title > div', ii); I.num = $('.answer__intro-num', ii);
    I.of = $('.answer__intro-of', ii); I.line = $('.answer__intro-line', ii); I.mole = $('.answer__intro-mole', ii); I.moleWob = $('.answer__intro-mole .wobble', ii);
    const lk = S.locked, LK = (E.locked = {});
    LK.hide = [$('header', lk), $('.answer__q', lk), $('.answer__who', lk)];
    LK.card = $('.answer__locked', lk); LK.stamp = $('.answer__stamp', lk); LK.btn = $('.screen__foot .btn', lk);
    // G · reveal + discuss
    const r = S.reveal, R = (E.reveal = {});
    R.header = $('header', r); R.headWrap = $('.reveal__head > div', r); R.headWrap.__base = 'rotate(-2deg)';
    R.q = $('.reveal__q', r); R.q.__base = 'rotate(-0.8deg)';
    R.cells = $$('.reveal__cell', r);
    R.cellName = R.cells.map(c => { const n = $('.reveal__name', c); return n ? n.textContent.trim() : 'נועה'; });
    R.flips = R.cells.map(c => $('.reveal__flip', c));
    R.figs = R.cells.map(c => $('.ans', c));
    R.pill = $('.role__pill', r); R.reacts = $('.reveal__reactions', r); R.reactBtns = $$('.reveal__react', r);
    R.status = $('.reveal__status', r) || $('.screen__foot .lead', r); R.statusP = R.status && ($('p', R.status) || R.status);
    R.statusBtn = R.status && $('.btn', R.status);
    const body = $('.screen__body', r);
    R.hero = mk('div', 'reveal__hero', body, `<div class="card reveal__hero-card"><span class="reveal__hero-badge" aria-hidden="true">?</span><p>כמה פעמים ביום אתם מצחצחים שיניים?</p></div><p class="reveal__hero-note">על זה עניתם. טוב, כמעט כולכם.</p>`);
    R.heroCard = $('.reveal__hero-card', R.hero); R.heroNote = $('.reveal__hero-note', R.hero);
    R.heroCard.__base = 'rotate(-2.5deg)'; R.heroNote.__base = 'rotate(1.5deg)';
    const dd = S.discuss, D = (E.discuss = {});
    D.hide = [$('header', dd), $('.reveal__q', dd), $('.reveal__grid', dd), $('.role', dd), $('.reveal__reactions', dd)].filter(Boolean);
    D.headWrap = $('.reveal__head > div', dd); D.headWrap.__base = 'rotate(-2deg)';
    D.wait = $('.reveal__wait', dd);
    // H · vote
    const v = S.vote, V = (E.vote = {});
    V.header = $('header', v); V.rays = $('.vote__rays', v); V.titleWrap = $('.vote__head .title', v).parentElement; V.titleWrap.__base = 'rotate(-4deg)';
    V.vq = $('.vote__q', v); V.cells = $$('.vote__cell', v);
    // the vote grid and the result board take the reveal's order, so every card grows in place instead of crossing
    const REV = R.cellName.slice();
    const vName = c => { const n = $('.vote__name', c).textContent.trim(); return n === 'אתם' ? 'נועה' : n; };
    V.cells.sort((x, y) => REV.indexOf(vName(x)) - REV.indexOf(vName(y))).forEach(c => c.parentElement.appendChild(c));
    V.cellName = V.cells.map(c => { const n = $('.vote__name', c).textContent.trim(); return n === 'אתם' ? 'נועה' : n; });
    V.marks = V.cells.map(c => $('.mark', c));
    V.count = $('.vote__count', v); V.btn = $('.screen__foot .btn', v);
    const yi = V.cellName.indexOf('יובל'); V.yCell = V.cells[yi]; V.ySus = $('.vote__suspect', V.yCell); V.yStamp = $('.vote__stamp', V.yCell);
    V.yStampSticker = $('.sticker', V.yStamp);
    // יובל's avatar: calm, and the shocked "picked" one the snapshot holds
    const yAv = $('.avatar', V.yCell), yHolder = yAv.parentElement;
    const calm = document.createElement('span'); calm.innerHTML = avatar(CODES['יובל'], { size: 58 }); const calmAv = calm.firstChild;
    calmAv.style.position = 'absolute'; calmAv.style.left = '0'; calmAv.style.top = '0'; yHolder.insertBefore(calmAv, yAv.nextSibling);
    V.yAvPicked = yAv; V.yAvCalm = calmAv;
    // add marks for anyone missing one (copy the snapshot's)
    const mark0 = V.marks.find(Boolean);
    V.cells.forEach((c, i) => {
      if (!V.marks[i] && V.cellName[i] !== 'נועה' && mark0) { const m = mark0.cloneNode(true); $('.avatar', c).parentElement.appendChild(m); V.marks[i] = m; }
    });
    // I · result
    const rs = S.result, RS = (E.result = {});
    RS.header = $('header', rs); RS.root = $('.result', rs);
    RS.figbox = $('.result__figbox', rs); RS.figfit = $('.result__figfit', rs);
    RS.rays = $('.result__rays', rs); RS.fig = $('.result__fig', rs); RS.squash = $('.result__squash', rs);
    RS.verdict = $('.result__verdict', rs); RS.say = $('.result__say', rs); RS.sayin = $('.result__sayin', rs);
    RS.plate = $('.result__plate', rs); RS.line = $('.result__line', rs);
    RS.cardwrap = $('.result__cardwrap', rs); RS.tag = $('.result__tag', rs); RS.fake = $('.result__fake', rs);
    RS.answerRow = $('.result__answer', rs); RS.bubble = $('.result__bubble', rs); RS.real = $('.result__real', rs);
    if (CLEAN) document.querySelectorAll('.result__fake').forEach(el => { el.textContent = CLEAN_FAKE; });
    RS.board = $('.result__board', rs); RS.tiles = $$('.result__tile', rs);
    RS.tiles.sort((x, y) => E.reveal.cellName.indexOf($('.result__tile-name', x).textContent.trim()) - E.reveal.cellName.indexOf($('.result__tile-name', y).textContent.trim())).forEach(tl => RS.board.appendChild(tl));
    RS.tileName = RS.tiles.map(tl => $('.result__tile-name', tl).textContent.trim());
    RS.minis = RS.tiles.map(tl => $$('.result__mini', tl));
    RS.counts = RS.tiles.map((tl, i) => {             // vote counts (the gains state dropped them): the game's own badge
      let c = $('.result__count', tl);
      if (!c && ['תומר', 'יובל'].includes(RS.tileName[i])) { c = document.createElement('span'); c.className = 'result__count num'; $('.result__tile-av', tl).appendChild(c); }
      return c;
    });
    RS.gains = RS.tiles.map(tl => $('.result__gain', tl));
    RS.lineGain = $('.result__gain', RS.line);
    // the cucumber: shocked on the drop, crying once caught
    const figAv = $('.result__fig .avatar', rs);
    figAv.innerHTML = `<span class="cA">${svgOf(CODES['יובל'], { variant: 'figure', mood: 'shock' })}</span><span class="cB">${svgOf(CODES['יובל'], { variant: 'figure', mood: 'cry' })}</span>`;
    $$('span', figAv).forEach(s => { s.style.cssText = 'position:absolute;inset:0;display:block'; }); figAv.style.position = 'relative';
    RS.cA = $('.cA', figAv); RS.cB = $('.cB', figAv);
    // the mystery figure and the two say-lines come from the game's own earlier result states
    const tmp = document.createElement('div');
    tmp.innerHTML = window.SCREENS.result_0; const myst = $('.result__fig', tmp); RS.myst = myst; RS.figfit.insertBefore(myst, RS.figfit.firstChild);
    const votesSay = $('.result__sayin', tmp); RS.votesSay = votesSay; RS.say.appendChild(votesSay);
    tmp.innerHTML = window.SCREENS.result_spot; const drumSay = $('.result__sayin', tmp); RS.drumSay = drumSay; RS.say.appendChild(drumSay);
    RS.drumDots = $('.dots', drumSay);
    [votesSay, drumSay].forEach(e => { e.style.position = 'absolute'; e.style.left = '0'; e.style.right = '0'; e.style.top = '0'; });
    // J · final
    const fnl = S.final, FN = (E.final = {});
    FN.back = $('header .iconbtn', fnl); FN.title = $('header .title', fnl);
    FN.confetti = $('.final__confetti', fnl);
    FN.cols = [1, 2, 3].map(n => $(`.final__col--${n}`, fnl));
    FN.figs = FN.cols.map(c => $('.final__fig', c)); FN.steps = FN.cols.map(c => $('.final__step', c));
    FN.pts = FN.cols.map(c => $('.final__pts', c)); FN.crown = $('.final__crown', fnl); FN.crown.__base = 'rotate(-10deg)';
    FN.ribbon = $('.final__ribbon', fnl); FN.you = $('.final__you', fnl);
    FN.rest = $('.final__rest', fnl); FN.awards = $('.final__awards', fnl);
    FN.footBtn = $('.screen__foot .btn', fnl); FN.footP = $$('.screen__foot p', fnl);
    FN.whos = FN.cols.map(c => $('.final__who', c)); FN.places = FN.cols.map(c => $('.final__place', c));
    // fx: finger, deal cards, flying emoji, coins, sweat, ghost button
    E.fx = {};
    E.fx.finger = mk('div', 'finger'); E.fx.ripple = mk('div', 'ripple');
    E.fx.deal = NAMES.map(n => mk('div', 'dealcard' + (n === 'יובל' ? ' is-pink' : ''), fx, '<i></i><i></i>'));
    E.fx.emoji = ['😂', '🤨', '👀', '💀'].map(e => mk('div', 'flyemoji', fx, e));
    E.fx.coins = [0, 1, 2].map(() => mk('div', 'coinfly'));
    E.fx.sweat = mk('div', 'sweatdrop', fx, '<svg viewBox="0 0 14 20" width="14" height="20"><path d="M7 1C10 7 12.5 10 12.5 13A5.5 5.5 0 0 1 1.5 13C1.5 10 4 7 7 1Z" fill="#8ADBFF" stroke="#1B0A36" stroke-width="2"/></svg>');
    E.fx.ghost = mk('div', 'btn btn--white ghostbtn', fx, '<span>יש לי קוד</span>');
    E.fx.ghostTxt = $('span', E.fx.ghost);
    E.fx.flyBoxes = [0, 1, 2, 3, 4].map(() => mk('span', 'code__box', fx));
    E.fx.flyAv = NAMES.map(n => mk('div', '', fx, avatar(CODES[n], { size: 60, ring: n === 'נועה' ? '#FFD23F' : undefined })));
    E.fx.cellAv = NAMES.map(n => mk('div', '', fx, avatar(CODES[n], { size: 34, ring: n === 'נועה' ? '#FFD23F' : undefined, mood: 'happy' })));
    E.fx.podAv = ['שירה', 'נועה', 'דנה'].map(n => {               // each starts as the board's face and becomes the podium's figure
      const el = mk('div', '', fx, `<span class="pr" style="position:absolute;left:0;top:0">${avatar(CODES[n], { size: 50, ring: n === 'נועה' ? '#FFD23F' : undefined, mood: 'happy' })}</span><span class="pf" style="position:absolute;left:0;top:0">${avatar(CODES[n], { size: 50, variant: 'figure', mood: 'happy' })}</span>`);
      el.__ring = $('.pr', el); el.__fig = $('.pf', el); return el;
    });
    // (no in-page dither: grain is added once at encode — a noise layer made every PNG capture 2.4× slower)
  }

  // ───────────────────────────── measure (game px, layout as captured) ─────────────────────────────
  const MR = new Map();
  function measureAll() {
    cam.style.transform = 'none'; phone.style.transform = 'none';
    Object.values(S).forEach(s => s.classList.add('on'));
    const p0 = phone.getBoundingClientRect();
    const m = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - p0.left, y: r.top - p0.top, w: r.width, h: r.height }; };
    const all = [];
    const add = (...els) => els.flat().forEach(e => e && all.push(e));
    const h = E.home, e = E.end;
    add(h.cast, h.wordmark, h.pitch, h.btnNew, h.btnCode, h.moleSpan, $('.home__hero', S.home), e.cast, e.wordmark, e.pitch, e.btnNew, $('.home__hero', S.home2));
    add(E.join.boxes, E.join.parts);
    add(E.lobby.badge, E.lobby.card, E.lobby.boxes, E.lobby.players.map(p => $('.avatar', p)), E.lobby.panel, E.lobby.pepper, E.lobby.switch, E.lobby.share);
    add(E.answer.q, E.answer.keys, E.answer.lock, E.answer.who, E.answer.whoFaces.map(f => f.box), E.answer.pad, E.answer.dial, E.answer.header);
    add(E.intro.num, E.intro.line, E.intro.mole);
    add(E.locked.card); add(E.reveal.q, E.reveal.cells, E.reveal.heroCard, E.reveal.reactBtns, $('.reveal__grid', S.reveal));
    add(E.vote.cells, E.vote.btn, $('.vote__grid', S.vote), E.vote.titleWrap);
    add(E.result.figbox, E.result.tiles, E.result.tiles.map(tl => $('.result__tile-av', tl)), E.result.cardwrap, E.result.board, E.result.coin, E.answer.coin);
    add(E.final.figs, E.final.steps, E.final.footBtn, $('.final__podium', S.final));
    all.forEach(el => MR.set(el, m(el)));
    // the end card's link and facts sit under the pitch
    const pr = MR.get(E.end.pitch); E.end.ctaAt = { x: pr.x + pr.w / 2, y: pr.y + pr.h + 30 };
    Object.values(S).forEach(s => s.classList.remove('on')); Object.values(S).forEach(s => { s.__on = false; });
    phone.style.transform = '';
  }
  const M = el => MR.get(el);

  // ───────────────────────────── camera ─────────────────────────────
  let KEYS = [], HITS = [], HANDOFF = [];
  const Fr = (r, zoom, ox = 0, oy = 0) => ({ x: (r.x + r.w / 2 + ox) * G, y: (r.y + r.h / 2 + oy) * G, zoom });
  const Pt = (gx, gy, zoom) => ({ x: gx * G, y: gy * G, zoom });
  function buildCamera() {
    const h = E.home, mole = M(h.moleSpan);
    // the eggplant's eyes: face at (48, 75) of its 100×104 box
    const eye = { x: mole.x + mole.w * 0.48, y: mole.y + mole.h * (75 / 104) };
    const hero = M($('.home__hero', S.home));
    const A = E.answer, R = E.reveal, V = E.vote, RS = E.result, FN = E.final;
    const padR = M(A.pad), qR = M(A.q), lockR = M(A.lock);
    const gridR = M($('.reveal__grid', S.reveal)), yCellR = M(R.cells[R.cellName.indexOf('יובל')]);
    const vgrid = M($('.vote__grid', S.vote)), vY = M(V.yCell);
    const fig = M(RS.figbox), card = M(RS.cardwrap), board = M(RS.board);
    const pod = M($('.final__podium', S.final));
    const endHero = M($('.home__hero', S.home2));
    const ex = ease;
    const lcard = M(E.lobby.card), panel = M(E.lobby.panel), pepper = M(E.lobby.pepper);
    const inum = M(E.intro.num), imole = M(E.intro.mole), who = M(E.answer.who[0]), hc = M(R.heroCard);
    const heroTop = M(E.home.cast[1]).y, heroBot = M(E.home.pitch).y + M(E.home.pitch).h;
    const endTop = M(E.end.cast[1]).y, endBot = E.end.ctaAt.y + 120;
    const bodyY = (y0, y1) => (y0 + y1) / 2;
    KEYS = [
      { t: 0, ...Pt(eye.x + 2, eye.y + 2, 6.1) },
      { t: T.pull0, ...Pt(eye.x + 2, eye.y + 2, 6.1) },
      { t: T.pull1, ...Pt(215, bodyY(heroTop, heroBot) - 6, 1.12), curve: ex.expoInOut },
      { t: T.rest0, ...Pt(215, bodyY(heroTop, heroBot) + 6, 1.12), curve: ex.sineInOut },
      { t: T.tapCode - 0.06, ...Pt(215, 545, 0.97), curve: ex.cubicInOut },
      { t: T.morph1, ...Pt(215, 335, 1.2), curve: ex.cubicInOut },
      { t: T.dig[4] + 0.1, ...Pt(215, 338, 1.24), curve: ex.sineInOut },
      { t: T.fly1 + 0.04, ...Fr(lcard, 1.04, 0, 30), curve: ex.cubicInOut },
      { t: T.joins[2], ...Pt(215, bodyY(lcard.y, panel.y + panel.h), 1.06), curve: ex.cubicInOut },
      { t: T.joins[5] + 0.3, ...Pt(215, bodyY(lcard.y + 40, panel.y + panel.h), 1.06), curve: ex.sineInOut },
      { t: T.pepperOn + 0.12, ...Pt(215, bodyY(panel.y, pepper.y + pepper.h), 1.1), curve: ex.cubicInOut },
      { t: T.start, ...Pt(215, bodyY(panel.y, pepper.y + pepper.h) + 10, 1.1), curve: ex.sineInOut },
      { t: T.introLine + 0.15, ...Pt(215, bodyY(inum.y - 10, imole.y + imole.h), 1.04), curve: ex.cubicInOut },
      { t: T.introOut, ...Pt(215, bodyY(inum.y - 10, imole.y + imole.h) + 8, 1.04), curve: ex.sineInOut },
      { t: T.q + 0.3, ...Fr(qR, 1.0, 0, 90), curve: ex.cubicInOut },
      { t: T.deal0 + 0.25, ...Pt(215, bodyY(qR.y, who.y + who.h), 0.84), curve: ex.cubicInOut },
      { t: T.pad0 + 0.3, ...Pt(215, bodyY(qR.y + 40, lockR.y + lockR.h), 0.9), curve: ex.sineInOut },
      { t: T.tap3 - 0.12, ...Fr(padR, 1.3, 0, -24), curve: ex.cubicInOut },
      { t: T.tapLock + 0.02, ...Pt(215, (padR.y + lockR.y + lockR.h) / 2 + 30, 1.12), curve: ex.cubicInOut },
      { t: T.check['דנה'] + 0.05, ...Pt(215, bodyY(qR.y + 60, who.y + who.h + 30), 0.95), curve: ex.cubicInOut },
      { t: T.rv0 + 0.45, ...Fr(hc, 1.0, 0, 30), curve: ex.cubicInOut },
      { t: T.rvShrink, ...Fr(hc, 1.0, 0, 40), curve: ex.sineInOut },
      { t: T.cells0 + 0.55, ...Pt(215, gridR.y + gridR.h / 2 - 30, 1.0), curve: ex.cubicInOut },
      { t: T.flip['איתי'] + 0.25, ...Pt(215, gridR.y + gridR.h / 2, 1.04), curve: ex.sineInOut },
      { t: T.flip['יובל'] + 0.04, ...Fr(yCellR, 1.62), curve: ex.expoOut },
      { t: T.rest1, ...Fr(yCellR, 1.42, 0, -30), curve: ex.cubicInOut },
      { t: T.waitLine + 0.02, ...Fr(yCellR, 1.42, 0, -30) },
      { t: T.vt0 - 0.02, ...Pt(215, vgrid.y + vgrid.h / 2 - 20, 0.98), curve: ex.cubicInOut },
      { t: T.vt1 + 0.1, ...Pt(215, vgrid.y + vgrid.h / 2 - 10, 1.0), curve: ex.sineInOut },
      { t: T.tapYuval - 0.08, ...Pt(215, vgrid.y + vgrid.h * 0.62, 1.0), curve: ex.cubicInOut },
      { t: T.tapConfirm + 0.1, ...Pt(215, vgrid.y + vgrid.h * 0.78, 1.02), curve: ex.cubicInOut },
      { t: T.rs1 + 0.12, ...Pt(215, bodyY(fig.y - 20, board.y + board.h), 0.98), curve: ex.cubicInOut },
      { t: T.spot0, ...Pt(215, bodyY(fig.y + 40, board.y + board.h), 1.08), curve: ex.sineInOut },
      { t: T.spotEnd, ...Pt(215, bodyY(fig.y + 60, board.y + board.h), 1.14), curve: ex.sineInOut },
      { t: T.figDrop + 0.06, ...Fr(fig, 1.55, 0, 20), curve: ex.expoOut },
      { t: T.verdict + 0.3, ...Fr(fig, 1.34, 0, 50), curve: ex.cubicInOut },
      { t: T.card0 + 0.05, ...Fr(fig, 1.2, 0, 90), curve: ex.sineInOut },
      { t: T.fake + 0.32, ...Fr(card, 1.02, 0, 0), curve: ex.cubicInOut },
      { t: T.hold1, ...Fr(card, 1.02, 0, 0) },
      { t: T.coins0 + 0.25, ...Pt(215, bodyY(card.y - 40, board.y + board.h), 0.9), curve: ex.cubicInOut },
      { t: T.fnTitle + 0.25, ...Pt(215, pod.y + pod.h / 2 - 50, 1.12), curve: ex.cubicInOut },
      { t: T.figs[2] + 0.3, ...Pt(215, pod.y + pod.h / 2 - 60, 1.2), curve: ex.sineInOut },
      { t: T.hold2, ...Pt(215, pod.y + pod.h / 2 - 60, 1.2), curve: ex.sineInOut },
      { t: T.tapShare + 0.05, ...Pt(215, (pod.y + M(FN.footBtn).y) / 2 + 60, 0.94), curve: ex.cubicInOut },
      { t: T.end0 + 0.04, ...Pt(215, (pod.y + M(FN.footBtn).y) / 2 + 50, 0.94), curve: ex.sineInOut },
      { t: T.end0 + 0.56, ...Pt(215, bodyY(endTop - 40, endBot), 1.06), curve: ex.expoInOut },
      { t: T.dur, ...Pt(215, bodyY(endTop - 40, endBot), 1.06) },
    ];
    HITS = [[T.word0 + 4 * 0.07 + 0.06, 5, 12], [T.flip['יובל'] + 0.02, 14, 9], [T.tapYuval + 0.06, 5, 12],
      [T.verdict, 18, 8], [T.figs[2] + 0.04, 6, 11]];
  }
  // a hand on the camera: a slow two-sine float, zero in the rests
  const RESTS = [[0, T.pull0 - 0.05], [T.rest0 - 0.1, T.btns - 0.05], [T.rest1, T.waitLine], [T.hold0 + 0.1, T.hold1], [T.hold2, T.share - 0.1], [T.hold3, T.wink - 0.3], [T.wink + 0.8, 99]];
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

  // ───────────────────────────── sections ─────────────────────────────
  function wobble(t, el, from = 0, amp = 3) {      // the game's .wobble: ±3° over 2.6 s, on the motion clock (still in rests)
    const env = sstep(from, from + 0.6, t), mc = (rayAngle(t) - rayAngle(from)) / 7;
    put(el, { r: env * amp * Math.sin(Math.max(0, mc) * 2 * Math.PI / 2.6), base: '' });
  }
  function rays(el, t, a, op, sc = 1, base = 'translate(-50%,0)') {
    if (!el) return;
    const tr = `${base} rotate(${fix(a, 2)}deg) scale(${fix(sc, 3)})`;
    if (el.__tr !== tr) { el.style.transform = tr; el.__tr = tr; }
    const ops = op >= 0.999 ? '1' : op <= 0.002 ? '0' : op.toFixed(3);
    if (el.__op !== ops) { el.style.opacity = ops; el.__op = ops; }
  }
  // rays turn only while the film moves: their angle is the integral of the rest envelope (precomputed)
  let RAYA = null;
  function buildRays() { const n = Math.ceil(T.dur * 120) + 2; RAYA = new Float32Array(n); let a = 0; for (let i = 1; i < n; i++) { a += restEnv(i / 120) * 7 / 120; RAYA[i] = a; } }
  const rayAngle = t => RAYA[clamp(Math.round(t * 120), 0, RAYA.length - 1)];

  function uHome(t, h, end) {
    const scr = end ? S.home2 : S.home;
    const t0 = end ? T.end0 : -1;
    const vis = end ? t >= T.end0 : t < T.morph1 + 0.35;
    on(scr, vis); if (!vis) return;
    const out = end ? 1e9 : T.morph0;               // the hero leaves upwards when the code is asked for
    const kOut = cubicIn(seg(t, out, out + 0.28));
    // rays
    rays(h.rays, t, rayAngle(t), end ? sstep(T.end0, T.end0 + 0.5, t) : 1 - kOut);
    // cast: from the start (the eggplant fills the frame), or popping in for the end
    h.cast.forEach((c, i) => {
      let st;
      if (!end) st = { y: -240 * kOut, op: 1 - kOut, s: 1 + 0.04 * pulse(t, T.word0 + 0.07 * 4 + 0.06, 1, 9, 22) * (i === 1 ? 0.5 : 1) };
      else st = life(t, T.endCast + [0.08, 0, 0.14][i], { y: 26, s: 0.6 }, 'bouncy');
      put(c, st);
    });
    // the eggplant: gaze, mood, wobble
    if (!end) {
      const g = (t < T.glance1 ? 0 : t < T.glance2 ? spring(t - T.glance1, 0.7, 30) : 1 - 2 * spring(t - T.glance2, 0.7, 26));
      const g2 = t > T.glance2 + 0.9 ? lerp(-1, 0, spring(t - T.glance2 - 0.9, 0.8, 14)) : null;
      const gx = g2 != null ? g2 : g;
      h.pupils.forEach(p => { const v = `translate(${fix(gx * 3.3 * 1.1)} 0)`; if (p.__g !== v) { p.setAttribute('transform', v); p.__g = v; } });
      put(h.moleA, { op: t < T.punch ? 1 : 0, base: '' }); put(h.moleB, { op: t < T.punch ? 0 : 1, base: '' });
      wobble(t, h.moleWobble, T.pull1 + 0.1);
    } else {
      put(h.moleA, { op: 1, base: '' }); put(h.moleB, { op: 0, base: '' });
      const wink = t > T.wink ? Math.min(1, spring(t - T.wink, 0.7, 26)) * (1 - sstep(T.wink + 0.7, T.wink + 0.95, t)) : 0;
      h.pupils.forEach(p => { const v = `translate(${fix(wink * 3.6)} 0)`; if (p.__g !== v) { p.setAttribute('transform', v); p.__g = v; } });
      wobble(t, h.moleWobble, T.endCast + 0.3);
    }
    // the wordmark: letters drop right to left and squash on landing; the pink bar swipes in
    const w0 = end ? T.endWord : T.word0;
    h.letters.forEach((l, i) => {
      const d = OM.letterDrop(t, w0, i, { stagger: 0.07, dist: 64, zeta: 0.45, omega: 24, squash: 0.0042, max: 0.3 });
      put(l, { y: -d.y, sx: d.sx, sy: d.sy, op: d.op, base: '' });
    });
    cssv(h.wordmark, '--bar', fix(ease.expoOut(seg(t, end ? T.endWord + 0.42 : T.bar, (end ? T.endWord + 0.42 : T.bar) + 0.35)), 3));
    put(h.wordmark, { y: -230 * kOut, op: 1 - kOut, s: 1 + pulse(t, w0 + 0.34, 0.05) });
    put(h.adult, life(t, end ? T.endWord + 0.5 : T.adult, { s: 0.4, r: -8 }, 'pop', {}, out, 0.3, { y: -120, op: 0 }));
    // the pitch: words land, then the punch
    const p0 = end ? T.endPitch : T.pitch0;
    h.words.forEach((w, i) => { const r = OM.wordRise(t, p0 + i * 0.12, { dist: 22, zeta: 0.55, omega: 24 }); put(w, { y: r.y, s: r.s, op: r.op, base: '' }); });
    const pk = end ? T.endPitch + 0.55 : T.punch;
    const kp = K(t, pk, 'bouncy');
    put(h.punch, t < pk ? { op: 0 } : { s: lerp(1.9, 1, kp), r: lerp(-6, 0, kp), op: clamp(kp * 3), base: '' });
    if (h.punch.style.display !== 'inline-block') h.punch.style.display = 'inline-block';
    put(h.pitch, { y: -200 * kOut, op: 1 - kOut });
    // foot
    if (!end) {
      put(h.btnNew, life(t, T.btns, { y: 70 }, 'soft', {}, T.morph0, 0.25, { y: 60, op: 0 }));
      const pressed = press(t, T.tapCode);
      cls(h.btnCode, 'is-pressed', pressed);
      put(h.btnCode, t >= T.morph0 ? { op: 0 } : life(t, T.btns + 0.07, { y: 70 }, 'soft'));
      put(h.link, life(t, T.btns + 0.14, { y: 40 }, 'soft', {}, T.morph0, 0.2, { y: 40, op: 0 }));
      put(h.legal, life(t, T.btns + 0.18, { y: 40 }, 'soft', {}, T.morph0, 0.2, { y: 40, op: 0 }));
    } else {
      hide(h.btnNew); hide(h.btnCode); hide(h.link); hide(h.legal);
      const c = h.ctaAt;
      const kc = K(t, T.endCta, 'bouncy');
      const dy = END_DY;                               // the link sits inside the end card, which is lifted in the world
      h.cta.style.left = c.x + 'px'; h.cta.style.top = (c.y - dy) + 'px';
      put(h.cta, t < T.endCta ? { op: 0, base: 'translate(-50%,0)' } : { s: lerp(0.4, 1, kc), r: lerp(-8, -2, kc), op: clamp(kc * 2), base: 'translate(-50%,0)' });
      h.facts.style.left = c.x + 'px'; h.facts.style.top = (c.y - dy + 64) + 'px';
      const rf = OM.wordRise(t, T.endCta + 0.22, { dist: 16 }); put(h.facts, { y: rf.y, op: rf.op, base: 'translate(-50%,0)' });
    }
  }

  function uJoin(t) {
    const J = E.join, vis = t >= T.morph0 && t < T.fly1 + 0.15; on(S.join, vis); if (!vis) return;
    hide(J.back); hide(J.input);
    const [onion, title, code, lead] = J.parts;
    const ko = cubicIn(seg(t, T.fly0, T.fly0 + 0.28));
    put(onion, life(t, T.joinOnion, { y: 40, s: 0.5 }, 'bouncy', {}, T.fly0, 0.28, { y: -60, op: 0 }));
    put(title, life(t, T.joinTitle, { y: 30, s: 0.7, r: -6 }, 'pop', {}, T.fly0, 0.28, { y: -60, op: 0 }));
    put(lead, life(t, T.joinLead, { y: 20 }, 'soft', {}, T.fly0, 0.22, { y: 30, op: 0 }));
    put(code, { op: 1 });
    // the boxes: shown once the ghost has become them; digits land one by one
    const shown = t >= T.morph1 - 0.05;
    J.boxes.forEach((b, i) => {
      const td = T.dig[i], typed = t >= td;
      txt(b, typed ? '48213'[i] : '');
      cls(b, 'code__box--empty', !typed);
      const active = !typed && (i === 0 ? true : t >= T.dig[i - 1]);
      cls(b, 'code__box--active', active && t < T.dig[4]);
      const bump = typed ? pulse(t, td, 0.22, 10, 28) : 0;
      put(b, { op: shown && t < T.fly0 ? 1 : 0, s: 1 + bump, y: typed ? -6 * Math.max(0, pulse(t, td, 1, 12, 20)) : 0 });
    });
    void ko;
  }

  function uGhost(t) {                               // "יש לי קוד" becomes the row of code boxes
    const g = E.fx.ghost, vis = t >= T.morph0 - 0.001 && t < T.morph1;
    if (!vis) { hide(g); return; }
    const A = M(E.home.btnCode), B0 = M(E.join.boxes[0]), B4 = M(E.join.boxes[4]);
    const B = { x: Math.min(B0.x, B4.x), y: B0.y, w: Math.abs(B4.x - B0.x) + B4.w, h: B0.h };
    const k = ease.cubicInOut(seg(t, T.morph0 + 0.02, T.morph1));
    const v = lerpRect(A, B, k);
    g.style.width = A.w + 'px'; g.style.height = A.h + 'px';
    put(g, { base: `translate(${fix(v.x + v.w / 2 - A.w / 2)}px,${fix(v.y + v.h / 2 - A.h / 2)}px) scale(${fix(v.w / A.w, 4)},${fix(v.h / A.h, 4)})`, op: 1 - sstep(0.88, 1, k) });
    g.style.borderRadius = lerp(30, 16, k) + 'px';
    put(E.fx.ghostTxt, { op: 1 - sstep(0, 0.25, k), base: '' });
  }

  function uFlyBoxes(t) {                            // join's boxes fly into the lobby's code card
    E.fx.flyBoxes.forEach((b, i) => {
      const t0 = T.fly0 + i * 0.03, t1 = T.fly1 - (4 - i) * 0.0 + i * 0.03 - 0.12;
      const vis = t >= t0 && t < t1;
      if (!vis) { hide(b); return; }
      txt(b, '48213'[i]);
      const A = M(E.join.boxes[i]), B = M(E.lobby.boxes[i]);
      const k = ease.cubicInOut(seg(t, t0, t1));
      const [x, y] = arcPt(center(A), center(B), k, 50 + i * 6);
      b.style.width = A.w + 'px'; b.style.height = A.h + 'px';
      put(b, { base: `translate(${fix(x - A.w / 2)}px,${fix(y - A.h / 2)}px) scale(${fix(lerp(1, B.w / A.w, k), 4)}) rotate(${fix(Math.sin(Math.PI * k) * (i - 2) * 6, 2)}deg)`, op: 1 });
    });
  }

  function uLobby(t) {
    const L = E.lobby, vis = t >= T.fly0 && t < T.lobbyOut + 0.7; on(S.lobby, vis); if (!vis) return;
    const ko = T.lobbyOut;
    const arrived = i => T.fly1 + i * 0.03 - 0.12;
    put(L.card, life(t, T.card, { s: 0.82, r: -6 }, 'pop', {}, ko, 0.35, { y: -260, op: 0, r: -8 }));
    put(L.label, { op: sstep(T.card + 0.15, T.card + 0.35, t) });
    L.boxes.forEach((b, i) => put(b, { op: t >= arrived(i) ? 1 : 0, s: 1 + (t >= arrived(i) ? pulse(t, arrived(i), 0.12, 11, 26) : 0) }));
    L.icons.forEach((ic, i) => put(ic, life(t, T.head + i * 0.05, { y: -40, s: 0.6 }, 'pop', {}, ko, 0.3, { y: -60, op: 0 })));
    const joined = T.joins.filter(j => t >= j).length;
    html(L.chip, `<span class="num">${Math.max(1, joined)}</span> מתוך <span class="num">12</span> בחדר`);
    put(L.chip, life(t, T.head + 0.08, { y: -40, s: 0.6 }, 'pop', {}, ko, 0.3, { y: -60, op: 0 }));
    put(L.share, life(t, T.lshare, { y: 40 }, 'soft', {}, ko, 0.3, { y: -200, op: 0 }));
    put(L.panel, life(t, T.panel, { s: 0.94 }, 'soft', {}, ko, 0.15, { op: 0, s: 0.97 }));
    L.players.forEach((p, i) => {
      const st = life(t, T.joins[i], { s: 0.4, r: -8 }, 'pop');
      put(p, { ...st, op: t >= ko + i * 0.03 ? 0 : st.op });    // each avatar flies on (fx) as the lobby closes
    });
    // the host's crown: drops on, hops while the room waits for him, pops off as he starts the round
    const hopU = clamp((t - (T.wait + 0.12)) / 0.34), hop = hopU > 0 && hopU < 1 ? 4 * hopU * (1 - hopU) : 0;
    const offU = clamp((t - (T.start - 0.10)) / 0.16);
    const offS = offU <= 0 ? 1 : offU < 0.4 ? 1 + 0.18 * ease.quadOut(offU / 0.4) : 1.18 * (1 - cubicIn((offU - 0.4) / 0.6));
    put(L.badge, t < T.lcrown ? { op: 0 } : {
      y: lerp(-26, 0, K(t, T.lcrown, 'bouncy')) - 9 * hop - 10 * offU,
      r: lerp(-30, 0, K(t, T.lcrown, 'bouncy')) + 12 * pulse(t, T.wait + 0.46, 1, 7, 30) + 20 * offU,
      s: offS, op: clamp(K(t, T.lcrown) * 2) * (offU >= 1 ? 0 : 1) });
    put(L.me, t < T.joins[1] + 0.12 ? { op: 0 } : { s: K(t, T.joins[1] + 0.12, 'pop') });
    cls(L.danaAv, 'avatar--dimmed', t < T.danaOn);
    put(L.danaSmall, { op: t < T.danaOn ? 1 : 0 });
    const dn = Math.floor(((t - T.joins[5]) / 0.22) % 4); cssv(L.danaSmall && $('.dots', L.danaSmall), '--dots', `"${'.'.repeat(Math.max(0, dn))}"`);
    // pepper mode switches on (the host's hand, not ours)
    put(L.pepper, life(t, T.pepper, { y: 50 }, 'soft', {}, ko, 0.3, { y: 140, op: 0 }));
    const pk = CLEAN ? 0 : K(t, T.pepperOn, 'pop'), onNow = !CLEAN && t >= T.pepperOn + 0.06;
    cls(L.pepper, 'is-on', onNow); attr(L.switch, 'aria-checked', onNow ? 'true' : 'false'); attr(L.switch, 'disabled', null);
    cssv(L.switch, '--knob', `${fix(-28 * clamp(t < T.pepperOn ? 0 : pk, 0, 1.15))}px`);
    txt(L.pepperSub, onNow ? 'שאלות גסות, סקס וכל מה שלא נעים. 18+' : 'כבוי: שאלות נקיות');
    const still = CLEAN || t < T.pepperOn;
    put(L.pepperIcon, { r: still ? 0 : -14 * pk + 9 * pulse(t, T.pepperOn, 1, 6, 30), s: still ? 1 : 1 + 0.15 * pk, base: '' });
    L.settings.forEach((c, i) => put(c, life(t, T.settings[i], { s: 0.4, r: -8 }, 'pop', {}, ko, 0.3, { y: 120, op: 0 })));
    // "waiting for Tomer to start" — the dots are the game's own
    const dots = t < T.wait ? 0 : 1 + Math.floor((t - T.wait) / 0.18) % 3;
    cssv(L.wait, '--dots', `"${'.'.repeat(dots)}"`);
    put(L.wait, life(t, T.wait, { y: 16 }, 'soft', {}, ko, 0.2, { op: 0 }));
  }

  function uFlyAvatars(t) {                          // the lobby's players fly to the waiting row of the round
    E.fx.flyAv.forEach((el, i) => {
      const t0 = T.lobbyOut + i * 0.03, t1 = t0 + 0.55;
      if (t < t0 || t >= t1) { hide(el); return; }
      const A = M($('.avatar', E.lobby.players[i])), B = M(E.answer.whoFaces[i].box);
      const k = ease.cubicInOut(seg(t, t0, t1));
      const [x, y] = arcPt(center(A), center(B), k, -40);
      put(el, { base: `translate(${fix(x - A.w / 2)}px,${fix(y - A.h / 2)}px) scale(${fix(lerp(1, B.w / A.w, k), 4)})` });
    });
  }

  function whoLine(t) {
    const waiting = NAMES.filter(n => t < T.check[n]);
    if (!waiting.length) return 'כולם ענו';
    const me = waiting.includes('נועה'), others = waiting.filter(n => n !== 'נועה').map(n => 'ל' + n);
    if (me && !others.length) return 'כולם ענו. מחכים רק לכם.';
    let s = me ? ['לכם', ...others] : others;
    if (s.length > 3) s = [...s.slice(0, 2), `לעוד <span class="num">${s.length - 2}</span>`];
    return 'מחכים ' + s.map((e, i) => `<span>${i === 0 ? '' : i === s.length - 1 ? ' ו' : ', '}${e}</span>`).join('');
  }

  function uAnswer(t) {
    const A = E.answer, vis = t >= T.rays0 && t < T.rs1 + 0.2; on(S.answer, vis); if (!vis) return;
    // the header stays on through reveal and vote (the round's own header); the timer belongs to answer/vote
    const hk = (i) => life(t, T.hdr + i * 0.05, { y: -50, s: 0.7 }, 'pop');
    A.icons.forEach((ic, i) => put(ic, hk(i)));
    put(A.chip, hk(2)); put(A.coin, hk(3));
    const timerOn = (t < T.rv0) || (t >= T.vt0 && t < T.rs0);
    put(A.timer, t < T.rv0 ? hk(4) : timerOn ? life(t, T.vt0 + 0.1, { s: 0.5 }, 'pop') : { op: 0 });
    let left = 45;
    if (t >= T.q) left = Math.max(0, 45 - Math.floor(t - T.q + 0.001));
    if (t >= T.vt0) left = Math.max(0, 30 - Math.floor(t - T.vt0 + 0.001));
    txt(A.timerText, String(left));
    if (A.arc) { const tot = t >= T.vt0 ? 30 : 45, frac = t >= T.vt0 ? clamp(1 - (t - T.vt0) / 30) : t >= T.q ? clamp(1 - (t - T.q) / 45) : 1; cssv(A.arc, 'stroke-dashoffset', `${fix((1 - frac) * 100, 3)}`); attr(A.arc, 'pathLength', '100'); cssv(A.arc, 'stroke-dasharray', '100'); void tot; }
    // coins: 580 → 680 at the result
    const cv = Math.round(lerp(580, 680, ease.cubicOut(seg(t, T.coins0, T.coins1))));
    txt(A.coin, String(cv)); put(A.coin, t >= T.coins1 ? { ...hk(3), s: 1 + pulse(t, T.coins1, 0.2) } : hk(3));
    // the question card drops in (the game's own entrance), then flies to the reveal at rv0
    const qs = t < T.q ? { op: 0 } : (() => { const k = K(t, T.q, 'bouncy'); return { y: lerp(-80, 0, k), r: lerp(-9 + 1.3, 0, k), s: lerp(0.9, 1, k), op: clamp(k * 2) }; })();
    put(A.q, t >= T.rv0 ? { op: 0 } : qs);
    put(A.hint, t < T.hint ? { op: 0 } : (() => { const k = K(t, T.hint); return { s: lerp(0.2, 1, k), r: lerp(-24, 0, k), op: clamp(k * 2), base: '' }; })());
    // dial + pad rise in rows; leave when locked
    const padK = (row) => life(t, T.pad0 + row * 0.05, { y: 60, s: 0.96 }, 'soft', {}, T.padOut, 0.24, { y: 40, s: 0.92, op: 0 });
    put(A.dial, padK(0));
    A.keys.forEach((k, i) => {
      const row = 1 + Math.floor(Math.min(i, 9) / 3);
      const st = padK(row);
      const pr = (i === 2 && press(t, T.tap3, 0.13));
      put(k, { ...st, y: st.y + (pr ? 4 : 0) });
      cls(k, 'is-pressed', pr);
    });
    const typed = t >= T.tap3;
    txt(A.slotVal, typed ? '3' : '?'); cls(A.slotVal, 'is-empty', !typed); cls(A.slot, 'is-bumped', false);
    put(A.slotVal, { s: typed ? 1 + pulse(t, T.tap3, 0.3, 9, 24) : 1, base: '' });
    put(A.lock, life(t, T.pad0 + 0.25, { y: 60 }, 'soft', {}, T.locked, 0.12, { op: 0 }));
    attr(A.lock, 'disabled', typed ? null : '');
    cls(A.lock, 'is-pressed', press(t, T.tapLock));
    $$('.answer__key--del', S.answer).forEach(d => attr(d, 'disabled', typed ? null : ''));
    // the waiting row: everyone dims until they answer; a tick and a happy face when they do
    A.who.forEach((w, i) => {
      const n = NAMES[i], tc = T.check[n], done = t >= tc;
      const k = done ? K(t, tc, 'pop') : 0;
      const arrivedAt = T.lobbyOut + i * 0.03 + 0.55;
      const base = t < arrivedAt ? { op: 0 } : { s: done ? lerp(0.88, 1, k) : 0.88, op: done ? lerp(0.5, 1, clamp(k * 2)) : 0.5 };
      // at the reveal each avatar dives into its card
      const dive = t >= T.cells0 + i * 0.06;
      put(w, dive ? { op: 0 } : base);
      put(A.whoFaces[i].f0, { op: done ? 0 : 1, base: '' }); put(A.whoFaces[i].f1, { op: done ? 1 : 0, base: '' });
      put(A.whoFaces[i].tick, { s: done ? k : 0, op: done ? 1 : 0, base: '' });
      // the dealt card lands on the avatar
      const td = T.deal0 + i * T.dealStep + T.dealDur;
      if (t >= td && t < td + 0.5 && !dive) put(w, { ...base, s: (base.s ?? 1) * (1 + pulse(t, td, 0.18, 10, 28)) });
    });
    html(A.whoLine, whoLine(t));
    put(A.whoLine, life(t, T.q + 0.3, { y: 10 }, 'soft', {}, T.rv0, 0.2, { op: 0 }));
  }

  function uIntro(t) {
    const I = E.intro, vis = t >= T.rays0 && t < T.introOut + 0.4; on(S.intro, vis); if (!vis) return;
    hide(I.header); hide(I.foot);
    const ko = cubicIn(seg(t, T.introOut, T.introOut + 0.3));
    rays(I.rays, t, rayAngle(t) * 1.6, sstep(T.rays0, T.rays0 + 0.35, t) * (1 - ko), 1 + 0.12 * sstep(T.rays0, T.rays0 + 1, t), 'translate(-50%,-58%)');
    const wk = K(t, T.introWord, 'bouncy');
    put(I.word, t < T.introWord ? { op: 0 } : { x: lerp(110, 0, wk), r: lerp(12, -4, wk), op: clamp(wk * 2) * (1 - ko), s: 1 - 0.2 * ko, base: '' });
    const nk = K(t, T.introNum, 'bouncy');
    put(I.num, t < T.introNum ? { op: 0 } : { s: lerp(2.8, 1, nk) * (1 - 0.2 * ko), r: lerp(26, 7, nk), op: clamp(nk * 2) * (1 - ko), base: '' });
    put(I.of, t < T.introOf ? { op: 0 } : { s: K(t, T.introOf), op: 1, base: '' });
    put(I.line, life(t, T.introLine, { s: 0.5, r: -8, y: 16 }, 'pop', { r: 2 }, T.introOut, 0.3, { s: 0.8, op: 0 }));
    put(I.mole, life(t, T.mole, { y: 90, r: 10 }, 'bouncy', {}, T.introOut, 0.3, { y: 60, op: 0 }));
    wobble(t, I.moleWob, T.mole + 0.3);
  }

  function uDeal(t) {                                 // the question card deals itself out: five cream, one pink
    E.fx.deal.forEach((d, i) => {
      const t0 = T.deal0 + i * T.dealStep, t1 = t0 + T.dealDur;
      if (t < t0 || t >= t1 + 0.06) { hide(d); return; }
      const qr = M(E.answer.q), to = center(M(E.answer.whoFaces[i].box));
      const from = [qr.x + qr.w / 2 + (i - 2.5) * 8, qr.y + qr.h * 0.6];
      const k = ease.cubicInOut(seg(t, t0, t1));
      const [x, y] = arcPt(from, to, k, 120 + (i % 3) * 30);
      put(d, { base: `translate(${fix(x)}px,${fix(y)}px) rotate(${fix(lerp(-8, 14, k) * (i % 2 ? -1 : 1), 2)}deg) scale(${fix(lerp(1.15, 0.5, k), 3)})`, op: t > t1 ? 0 : 1 });
    });
  }

  function uLocked(t) {
    const LK = E.locked, vis = t >= T.locked - 0.02 && t < T.rv0 + 0.35; on(S.locked, vis); if (!vis) return;
    LK.hide.forEach(hide);
    const k = K(t, T.locked, 'bouncy');
    put(LK.card, t < T.locked ? { op: 0 } : { s: lerp(0.6, 1, k), r: lerp(-8, 0, k), op: clamp(k * 2) * (1 - sstep(T.rv0, T.rv0 + 0.25, t)), y: 40 * sstep(T.rv0, T.rv0 + 0.3, t) });
    if (LK.stamp) put(LK.stamp, t < T.stamp ? { op: 0 } : { s: lerp(2.2, 1, K(t, T.stamp)), r: lerp(-30, 0, K(t, T.stamp)), op: 1, base: '' });
    put(LK.btn, life(t, T.locked + 0.1, { y: 30 }, 'soft', {}, T.rv0, 0.2, { y: 40, op: 0 }));
  }

  function uReveal(t) {
    const R = E.reveal, vis = t >= T.rv0 && t < T.vt1 + 0.25; on(S.reveal, vis); if (!vis) return;
    hide(R.header);
    // title "the real question" (gives way to "who is lying" at discuss)
    const tk = K(t, T.rvTitle, 'pop');
    put(R.headWrap, t < T.rvTitle ? { op: 0 } : { y: lerp(-34, 0, tk), s: lerp(0.7, 1, tk) * (1 - 0.3 * sstep(T.discuss - 0.06, T.discuss + 0.16, t)), op: clamp(tk * 2) * (1 - sstep(T.discuss - 0.04, T.discuss + 0.12, t)) });
    // the big card: the answer's question card flies to the middle and grows, then shrinks into the strip
    const aq = M(E.answer.q), hc = M(R.heroCard), rq = M(R.q);
    const k1 = ease.expoOut(seg(t, T.rv0, T.rv0 + 0.5)), k2 = ease.cubicInOut(seg(t, T.rvShrink, T.rvShrink + 0.42));
    if (t < T.rvShrink) {
      const v = lerpRect(aq, hc, k1);
      put(R.heroCard, { ...toRect(hc, v, true), op: 1 });
      put(R.heroNote, life(t, T.rv0 + 0.32, { y: 14 }, 'soft', {}, T.rvShrink - 0.1, 0.18, { op: 0 }));
      hide(R.q);
    } else {
      const v = lerpRect(hc, rq, k2);
      put(R.heroCard, { ...toRect(hc, v, true), op: 1 - sstep(0.55, 0.85, k2) });
      put(R.q, { ...toRect(rq, v, true), op: sstep(0.5, 0.8, k2) });
      hide(R.heroNote);
    }
    // the cells: each player's avatar dives into a face-down card, then the cards flip
    R.cells.forEach((c, i) => {
      const n = R.cellName[i], wi = NAMES.indexOf(n);
      const tArr = T.cells0 + wi * 0.06 + 0.36;
      const ck = K(t, tArr, 'pop');
      const tf = T.flip[n], big = n === 'יובל';
      const fk = t < tf ? 0 : spring(t - tf, big ? 0.5 : 0.6, big ? 20 : 26);
      put(R.flips[i], { ry: lerp(180, 0, clamp(fk, 0, 1.08)), base: '' });
      let st = t < tArr ? { op: 0 } : { s: lerp(0.5, 1, ck), op: clamp(ck * 2) };
      if (t >= tf) st = { ...st, s: (st.s ?? 1) * (1 + (big ? pulse(t, tf, 0.16, 6, 20) : pulse(t, tf, 0.06, 10, 28))) };
      // vote: the cell gives way to the vote card (FLIP below)
      if (t >= T.vt0) st.op = 0;
      put(c, st);
      if (big) put(R.figs[i], t < tf ? { base: '' } : { s: 1 + 1.2 * Math.max(0, 1 - spring(t - tf - 0.05, 0.42, 18)), base: '' });
    });
    // footer: status line, then the reactions bar (discuss)
    const flips = Object.values(T.flip).filter(f => t >= f + 0.1).length;
    if (R.statusP) { html(R.statusP, flips === 0 ? 'מיד רואים מה כולם ענו' : flips < 6 ? `נחשפו <span class="num">${flips}</span> מתוך <span class="num">6</span>` : 'זהו, הכול על השולחן'); }
    put(R.status, life(t, T.cells0 + 0.3, { y: 16 }, 'soft', {}, T.discuss + 0.3, 0.2, { op: 0 }));
    if (R.statusBtn) hide(R.statusBtn);
    put(R.pill, life(t, T.discuss + 0.05, { y: 30 }, 'soft', {}, T.vt0, 0.25, { y: 40, op: 0 }));
    put(R.reacts, life(t, T.discuss - 0.02, { y: 70 }, 'soft', {}, T.vt0, 0.25, { y: 80, op: 0 }));
    R.reactBtns.forEach((b, i) => {
      const fire = { 0: 0, 1: 1, 6: 2, 3: 3 }[i];
      put(b, { y: fire != null && t >= T.emoji[fire] ? 3 * Math.max(0, pulse(t, T.emoji[fire], 1, 14, 30)) : 0, s: fire != null ? 1 + pulse(t, T.emoji[fire], 0.15) : 1 });
    });
  }

  function uEmoji(t) {                               // the game's own reactions float up from the bar
    const R = E.reveal, yC = M(R.cells[R.cellName.indexOf('יובל')]);
    E.fx.emoji.forEach((el, i) => {
      const t0 = T.emoji[i], life_ = 1.05;
      if (t < t0 || t > t0 + life_) { hide(el); return; }
      const src = center(M(R.reactBtns[[0, 1, 6, 3][i]]));
      const dst = [yC.x + yC.w / 2 + (i - 1.5) * 46, yC.y - 70 - (i % 2) * 30];
      const k = ease.cubicOut(seg(t, t0, t0 + 0.95));
      const [x, y] = arcPt(src, dst, k, 30);
      const s = lerp(0.4, 0.9, K(t, t0, 'pop'));
      put(el, { base: `translate(${fix(x)}px,${fix(y)}px) rotate(${fix(Math.sin((t - t0) * 9 + i) * 10, 2)}deg) scale(${fix(s, 3)})`, op: 1 - sstep(t0 + 0.6, t0 + life_, t) });
    });
  }

  function uCellAvatars(t) {                         // the waiting-row avatars dive into their cards
    E.fx.cellAv.forEach((el, wi) => {
      const n = NAMES[wi], t0 = T.cells0 + wi * 0.06, t1 = t0 + 0.38;
      if (t < t0 || t >= t1) { hide(el); return; }
      const A = M(E.answer.whoFaces[wi].box), ci = E.reveal.cellName.indexOf(n), B = M(E.reveal.cells[ci]);
      const k = cubicIn(seg(t, t0, t1));
      const [x, y] = arcPt(center(A), center(B), k, 80);
      put(el, { base: `translate(${fix(x - A.w / 2)}px,${fix(y - A.h / 2)}px) scale(${fix(lerp(1, 1.4, Math.sin(Math.PI * k)) * (1 - 0.4 * k), 3)})`, op: 1 - sstep(0.85, 1, k) });
    });
  }

  function uDiscuss(t) {
    const D = E.discuss, vis = t >= T.discuss - 0.1 && t < T.vt0 + 0.35; on(S.discuss, vis); if (!vis) return;
    D.hide.forEach(hide);
    const k = K(t, T.discuss, 'bouncy');
    put(D.headWrap, t < T.discuss ? { op: 0 } : { s: lerp(1.6, 1, k), r: lerp(6, 0, k), op: clamp(k * 3) * (1 - sstep(T.vt0, T.vt0 + 0.2, t)) });
    put(D.wait, life(t, T.waitLine, { y: 16 }, 'soft', {}, T.vt0, 0.2, { op: 0 }));
  }

  function uVote(t) {
    const V = E.vote, R = E.reveal, vis = t >= T.vt0 && t < T.rs1 + 0.25; on(S.vote, vis); if (!vis) return;
    hide(V.header);
    // the title and the question
    const tk = K(t, T.vt0 + 0.12, 'bouncy');
    put(V.titleWrap, t < T.vt0 + 0.12 ? { op: 0 } : { s: lerp(0.4, 1, tk) * (1 - 0.3 * sstep(T.rs0 - 0.1, T.rs0 + 0.15, t)), r: lerp(-14, 0, tk), op: clamp(tk * 2) * (1 - sstep(T.rs0 - 0.1, T.rs0 + 0.12, t)), y: -40 * sstep(T.rs0 - 0.1, T.rs0 + 0.15, t) });
    rays(V.rays, t, rayAngle(t) * 1.3, sstep(T.vt0, T.vt0 + 0.4, t) * (1 - sstep(T.rs0, T.rs0 + 0.3, t)));
    put(V.vq, life(t, T.vt0 + 0.25, { y: 12 }, 'soft', {}, T.rs0, 0.2, { op: 0 }));
    // cells: grow out of the answer cards (FLIP), then fold into the result board
    V.cells.forEach((c, i) => {
      const n = V.cellName[i], from = M(R.cells[R.cellName.indexOf(n)]), self = M(c);
      const k = ease.expoOut(seg(t, T.vt0 + i * 0.03, T.vt1 + i * 0.03));
      const tile = M(E.result.tiles[E.result.tileName.indexOf(n)]);
      const k2 = ease.cubicInOut(seg(t, T.rs0 + i * 0.025, T.rs1 + i * 0.025));
      let v = lerpRect(from, self, k);
      if (k2 > 0) v = lerpRect(self, tile, k2);
      const st = toRect(self, v, true);
      const yPick = n === 'יובל' && t >= T.tapYuval;
      put(c, { ...st, op: clamp(k * 3) * (1 - sstep(0.6, 0.9, k2)), r: yPick ? -1.5 * K(t, T.tapYuval) : 0, s: yPick ? 1 + pulse(t, T.tapYuval, 0.06) : 1 });
      const m = V.marks[i];
      if (m) { const tv = T.voted[n]; put(m, t < tv ? { op: 0 } : { s: K(t, tv, 'pop'), op: 1, base: '' }); }
    });
    // יובל: picked (pink, shocked) on the tap; "חשוד!" then "הצבעתם"
    const picked = t >= T.tapYuval;
    cls(V.ySus, 'is-on', picked);
    put(V.yAvPicked, { op: picked ? 1 : 0, base: '' }); put(V.yAvCalm, { op: picked ? 0 : 1, base: '' });
    put(V.yStamp, !picked ? { op: 0 } : { s: lerp(2.2, 1, K(t, T.tapYuval + 0.04)), r: lerp(-30, 0, K(t, T.tapYuval + 0.04)), op: clamp(K(t, T.tapYuval + 0.04) * 3), base: '' });
    txt(V.yStampSticker, t >= T.tapConfirm ? 'הצבעתם' : 'חשוד!');
    // the foot: count, then the button changes with the pick
    const n = NAMES.filter(x => t >= T.voted[x]).length;
    html(V.count, `<span class="num">${n}</span> מתוך <span class="num">6</span> הצביעו`);
    put(V.count, life(t, T.vt1, { y: 14 }, 'soft', {}, T.rs0, 0.2, { op: 0 }));
    const btnState = t < T.tapYuval ? 0 : t < T.tapConfirm + 0.1 ? 1 : 2;
    if (V.btn.__state !== btnState) {
      V.btn.__state = btnState;
      V.btn.className = 'btn' + (btnState === 1 ? ' btn--pink' : btnState === 2 ? ' btn--white' : ' btn--pink');
      V.btn.innerHTML = btnState === 0 ? 'בחרו חשוד' : btnState === 1 ? '<span>זה <bdi>יובל</bdi>!</span>' : 'לשנות הצבעה';
      if (btnState === 0) V.btn.setAttribute('disabled', ''); else V.btn.removeAttribute('disabled');
    }
    cls(V.btn, 'is-pressed', press(t, T.tapConfirm));
    put(V.btn, life(t, T.vt1 + 0.05, { y: 50 }, 'soft', {}, T.rs0, 0.25, { y: 50, op: 0 }));
  }

  // the spotlight jumps from tile to tile, slowing down, and stops on יובל (the game builds the same kind of run)
  const SPOT = (() => {
    const seq = ['איתי', 'נועה', 'תומר', 'שירה', 'יובל', 'דנה', 'איתי', 'נועה', 'תומר', 'שירה', 'דנה', 'יובל'];
    const n = seq.length, out = []; let tt = T.spot0;
    for (let i = 0; i < n; i++) { out.push([tt, seq[i]]); tt += 0.06 + 0.16 * Math.pow(i / (n - 1), 2.2); }
    return out;
  })();
  const spotAt = t => { let s = null; for (const [ts, nm] of SPOT) if (t >= ts) s = nm; return s; };

  function uResult(t) {
    const RS = E.result, vis = t >= T.rs0 && t < T.fn0 + 0.6; on(S.result, vis); if (!vis) return;
    hide(RS.header);
    const ko = T.fn0;
    // hero: the mystery, the drum, the drop
    put(RS.myst, t < T.rs0 + 0.42 ? { op: 0 } : t < T.figDrop ? { s: lerp(0.5, 1, K(t, T.rs0 + 0.42, 'bouncy')) * (1 + 0.04 * Math.sin((t - T.rs0) * 7) * (t > T.drum ? 1 : 0)), op: 1 } : { s: 1 - 0.6 * seg(t, T.figDrop, T.figDrop + 0.15), op: 1 - seg(t, T.figDrop, T.figDrop + 0.12) });
    const fk = spring(t - T.figDrop, 0.5, 16);
    const dropped = t >= T.figDrop;
    put(RS.fig, !dropped ? { op: 0 } : { y: lerp(-380, 0, clamp(fk, 0, 1.2)), s: lerp(1.15, 1, clamp(fk)), r: lerp(-16, 0, clamp(fk)), op: 1 - sstep(ko, ko + 0.2, t) });
    // squash on the landing, like the game's .result--boom
    const land = T.figDrop + 0.2, im = OM.impact(t, land, { decay: 7, omega: 22, sqx: 0.18, sqy: 0.22 });
    put(RS.squash, t < land ? { base: '' } : { sx: im.sx, sy: im.sy, base: '' });
    put(RS.cA, { op: t < T.verdict ? 1 : 0, base: '' }); put(RS.cB, { op: t < T.verdict ? 0 : 1, base: '' });
    put(RS.rays, t < T.verdict - 0.05 ? { op: 0 } : { s: lerp(0.2, 1, K(t, T.verdict - 0.05, 'soft')), r: rayAngle(t) * 2, op: 1 - sstep(ko, ko + 0.25, t), base: '' });
    put(RS.verdict, t < T.verdict ? { op: 0 } : { s: lerp(2.4, 1, K(t, T.verdict, 'pop')), r: lerp(-20, 0, K(t, T.verdict, 'pop')), op: clamp(K(t, T.verdict) * 3) * (1 - sstep(ko, ko + 0.2, t)) });
    // say-lines: the votes, the drum, the plate
    put(RS.votesSay, life(t, T.rs0 + 0.5, { y: 20, s: 0.7 }, 'pop', {}, T.drum - 0.15, 0.15, { op: 0 }));
    put(RS.drumSay, life(t, T.drum, { s: 0.5 }, 'bouncy', {}, T.figDrop - 0.1, 0.12, { op: 0 }));
    cssv(RS.drumDots, '--dots', `"${'.'.repeat(t < T.drum ? 0 : clamp(1 + Math.floor((t - T.drum) / 0.24), 1, 3))}"`);
    put(RS.sayin, life(t, T.line - 0.05, { y: 20, s: 0.7 }, 'pop', {}, ko, 0.2, { op: 0 }));
    if (RS.lineGain) put(RS.lineGain, t < T.line + 0.3 ? { op: 0 } : { s: K(t, T.line + 0.3, 'pop'), op: 1, base: '' });
    // the twist card
    const ck = K(t, T.card0, 'soft');
    put(RS.cardwrap, t < T.card0 ? { op: 0 } : { y: lerp(260, 0, ck), r: lerp(4, 0, ck), op: clamp(ck * 2) * (1 - sstep(ko, ko + 0.25, t)) });
    put(RS.tag, t < T.tag ? { op: 0 } : { s: lerp(2, 1, K(t, T.tag)), r: lerp(-14, 0, K(t, T.tag)), op: 1, base: '' });
    put(RS.fake, life(t, T.fake, { y: 18 }, 'pop'));
    put(RS.answerRow, life(t, T.bubble - 0.1, { y: 10 }, 'soft'));
    put(RS.bubble, t < T.bubble ? { op: 0 } : { s: lerp(0.3, 1, K(t, T.bubble, 'bouncy')), op: clamp(K(t, T.bubble) * 2), base: '' });
    put(RS.real, life(t, T.real, { y: 10 }, 'soft'));
    // the board: tiles arrive from the vote cards (FLIP in uVote), minis fly, the spotlight runs, gains pop
    const spot = t >= T.spot0 && t < T.figDrop ? spotAt(t) : t >= T.figDrop && t < T.figDrop + 0.5 ? 'יובל' : null;
    RS.tiles.forEach((tl, i) => {
      const n = RS.tileName[i];
      const appear = T.rs1 - 0.06;
      put(tl, t < appear ? { op: 0 } : { op: 1 - sstep(ko, ko + 0.25, t), s: spot === n ? 1.06 : 1 });
      cls(tl, 'is-lit', spot === n);
      cls(tl, 'is-dim', spot != null && spot !== n);
      cls(tl, 'is-mole', n === 'יובל' && t >= T.figDrop);
      const minis = RS.minis[i];
      const voters = NAMES.filter(x => VOTE_FOR[x] === n);
      minis.forEach((mi, j) => {
        const voter = voters[j], tv = T.minis0 + NAMES.indexOf(voter) * T.miniStep + 0.32;
        put(mi, t < tv ? { op: 0 } : { s: lerp(1.6, 1, K(t, tv, 'pop')), op: 1, base: '' });
      });
      if (RS.counts[i]) {
        const got = voters.filter(x => t >= T.minis0 + NAMES.indexOf(x) * T.miniStep + 0.32).length;
        txt(RS.counts[i], String(got));
        put(RS.counts[i], got ? { s: 1 + pulse(t, T.minis0 + NAMES.indexOf(voters[got - 1]) * T.miniStep + 0.32, 0.3), op: 1, base: '' } : { op: 0 });
      }
      const g = RS.gains[i];
      if (g) { const tg = T.gains + i * 0.09; put(g, t < tg ? { op: 0 } : { s: lerp(0.3, 1, K(t, tg, 'bouncy')), y: lerp(10, 0, K(t, tg)), op: 1, base: '' }); }
    });
    put(RS.board, { op: t < T.rs1 - 0.06 ? 0 : 1, x: 0, y: t >= T.figDrop + 0.2 ? 6 * pulse(t, T.figDrop + 0.2, 1, 9, 30) : 0 });
  }

  function uMinis(t) {                               // voters' faces fly to who they voted for (drawn by the tiles' own minis)
    void t;
  }

  function uFinal(t) {
    const FN = E.final, vis = t >= T.fn0 && t < T.end0 + 0.7; on(S.final, vis); if (!vis) return;
    const ko = T.end0 + 0.6;                           // off frame by then: the camera whips away, nothing fades
    hide(FN.confetti); hide(FN.rest); hide(FN.awards); FN.footP.forEach(hide);
    put(FN.back, life(t, T.fnTitle, { s: 0.5 }, 'pop', {}, ko, 0.2, { op: 0 }));
    // the title: "ומי לוקח?" then "הכתר של שירה!"
    const crowned = t >= T.crown;
    txt(FN.title, crowned ? 'הכתר של שירה!' : 'ומי לוקח?');
    const tt = crowned ? T.crown : T.fnTitle, kk = K(t, tt, 'bouncy');
    put(FN.title, t < T.fnTitle ? { op: 0 } : { s: lerp(crowned ? 1.5 : 0.4, 1, kk), r: lerp(crowned ? 6 : -10, 0, kk), op: clamp(kk * 3) * (1 - sstep(ko, ko + 0.2, t)), base: 'skew(-4deg)' });
    // steps rise (3rd, 2nd, 1st), figures land, points count
    const colOrder = [2, 1, 0];                       // FN.cols = [col1, col2, col3] → rise 3rd, 2nd, 1st
    const pts = [1280, 1160, 1000];
    FN.cols.forEach((c, ci) => {
      const rank = ci;                                 // 0 → first place
      const ts = T.steps[colOrder.indexOf(ci)];
      const kst = K(t, ts, 'pop');
      const kOut = cubicIn(seg(t, ko, ko + 0.32));
      put(FN.steps[ci], t < ts ? { op: 0 } : { sy: clamp(kst, 0, 1.12), op: 1 - kOut, base: '', y: 0 });
      FN.steps[ci].style.transformOrigin = '50% 100%';
      const tf = T.figs[[2, 1, 0][ci]];
      const im = OM.impact(t, tf, { sqx: 0.2, sqy: 0.24 });
      const pk = K(t, tf - 0.04, 'pop');
      put(FN.figs[ci], t < tf - 0.04 ? { op: 0 } : { s: lerp(0.8, 1, clamp(pk)), sx: im.sx, sy: im.sy, op: clamp(pk * 4) * (1 - kOut), base: '' });
      FN.figs[ci].style.transformOrigin = '50% 100%';
      const cnt = Math.round(pts[rank] * ease.cubicOut(seg(t, tf, tf + 0.6)));
      txt(FN.pts[ci], cnt.toLocaleString('en-US'));
      put(FN.whos[ci], t < tf ? { op: 0 } : { op: 1 - kOut, base: '' });
      put(FN.places[ci], t < ts ? { op: 0 } : { op: 1 - kOut, base: '' });
    });
    put(FN.you, t < T.figs[1] + 0.2 ? { op: 0 } : { s: K(t, T.figs[1] + 0.2), op: 1, base: '' });
    put(FN.crown, t < T.crown ? { op: 0 } : { y: lerp(-120, 0, clamp(spring(t - T.crown, 0.5, 18), 0, 1.15)), r: lerp(-40, 0, K(t, T.crown)), op: 1 });
    put(FN.ribbon, t < T.ribbon ? { op: 0 } : { s: K(t, T.ribbon, 'bouncy'), op: 1, base: '' });
    put(FN.footBtn, life(t, T.share, { y: 60 }, 'soft', {}, ko, 0.15, { op: 0 }));
    cls(FN.footBtn, 'is-pressed', press(t, T.tapShare));
  }

  // ───────────────────────────── the finger ─────────────────────────────
  let HAND = [], TAPS = [], FWIN = [];
  function buildFinger() {
    const c = el => center(M(el));
    const h = E.home, A = E.answer, V = E.vote;
    const code = c(h.btnCode), k2 = c(A.keys[1]), k3 = c(A.keys[2]), lock = c(A.lock);
    const jb = E.join.boxes.map(c);
    const vD = c(V.cells[V.cellName.indexOf('דנה')]), vY = c(V.cells[V.cellName.indexOf('יובל')]), vb = c(V.btn);
    const share = c(E.final.footBtn);
    HAND = [
      { t: T.fIn - 0.01, x: code[0] + 150, y: code[1] + 260 },
      { t: T.tapCode - 0.18, x: code[0] + 12, y: code[1] + 8 },
      { t: T.tapCode, x: code[0], y: code[1] },
      { t: T.morph1, x: jb[0][0] + 20, y: jb[0][1] + 40 },
      ...jb.map((p, i) => ({ t: T.dig[i], x: p[0], y: p[1] + 4 })),
      { t: T.dig[4] + 0.45, x: jb[4][0] - 40, y: jb[4][1] + 220 },
      { t: T.f2In - 0.01, x: k3[0] + 120, y: k3[1] + 300 },
      { t: T.f2In + 0.32, x: k2[0] + 6, y: k2[1] + 10 },
      { t: T.tap3 - 0.12, x: k3[0] + 8, y: k3[1] + 6 },
      { t: T.tap3, x: k3[0], y: k3[1] },
      { t: T.tapLock - 0.14, x: lock[0] + 30, y: lock[1] - 6 },
      { t: T.tapLock, x: lock[0] + 20, y: lock[1] },
      { t: T.tapLock + 0.5, x: lock[0] + 120, y: lock[1] + 200 },
      { t: T.f3In - 0.01, x: vD[0] + 80, y: vD[1] + 330 },
      { t: T.f3In + 0.36, x: vD[0] + 10, y: vD[1] + 10 },
      { t: T.tapYuval - 0.14, x: vY[0] + 10, y: vY[1] + 6 },
      { t: T.tapYuval, x: vY[0], y: vY[1] },
      { t: T.tapConfirm - 0.16, x: vb[0] + 30, y: vb[1] - 4 },
      { t: T.tapConfirm, x: vb[0] + 18, y: vb[1] },
      { t: T.tapConfirm + 0.5, x: vb[0] + 140, y: vb[1] + 220 },
      { t: T.share + 0.06, x: share[0] + 120, y: share[1] + 240 },
      { t: T.tapShare - 0.14, x: share[0] + 30, y: share[1] + 6 },
      { t: T.tapShare, x: share[0] + 20, y: share[1] },
      { t: T.tapShare + 0.5, x: share[0] + 150, y: share[1] + 240 },
    ];
    TAPS = [T.tapCode, ...T.dig, T.tap3, T.tapLock, T.tapYuval, T.tapConfirm, T.tapShare];
    FWIN = [[T.fIn, T.dig[4] + 0.42], [T.f2In, T.tapLock + 0.46], [T.f3In, T.tapConfirm + 0.46], [T.share + 0.06, T.tapShare + 0.46]];
  }
  function uFinger(t) {
    const f = E.fx.finger, rp = E.fx.ripple;
    let op = 0;
    for (const [a, b] of FWIN) op = Math.max(op, sstep(a, a + 0.14, t) * (1 - sstep(b - 0.18, b, t)));
    if (op <= 0.001) { hide(f); hide(rp); return; }
    const c = OM.cursor(t, HAND, TAPS, { down: 0.82, hold: 0.12 });
    put(f, { base: `translate(${fix(c.x)}px,${fix(c.y)}px) scale(${fix(c.s, 3)})`, op });
    let last = null; for (const tp of TAPS) if (t >= tp && t < tp + 0.4) last = tp;
    if (last == null) { hide(rp); return; }
    const k = seg(t, last, last + 0.4), p = OM.cursor(last, HAND, TAPS);
    put(rp, { base: `translate(${fix(p.x)}px,${fix(p.y)}px) scale(${fix(1 + 1.6 * ease.cubicOut(k), 3)})`, op: (1 - k) * 0.9 * op });
  }

  function uSweat(t) {                               // the eggplant sweats in close-up; יובל sweats when dealt the pink card
    const el = E.fx.sweat;
    const mole = M(E.home.moleSpan);
    if (t >= T.sweat0 && t < T.sweat1 + 0.1) {
      const k = seg(t, T.sweat0, T.sweat1);
      const x = mole.x + mole.w * 0.71, y0 = mole.y + mole.h * 0.47;
      put(el, { base: `translate(${fix(x)}px,${fix(y0 + 26 * ease.quadOut(k) * k)}px) scale(${fix(lerp(0.2, 0.8, sstep(0, 0.25, k)), 3)})`, op: 1 - sstep(0.8, 1, k) });
      return;
    }
    const yb = M(E.answer.whoFaces[4].box), ts = T.deal0 + 4 * T.dealStep + T.dealDur + 0.08;
    if (t >= ts && t < ts + 0.8) {
      const k = seg(t, ts, ts + 0.8);
      put(el, { base: `translate(${fix(yb.x + yb.w * 0.92)}px,${fix(yb.y + 4 + 12 * k)}px) scale(${fix(0.55 * sstep(0, 0.2, k), 3)})`, op: 1 - sstep(0.75, 1, k) });
      return;
    }
    hide(el);
  }

  function uPodiumHop(t) {                           // first, second and third leave the board for the podium
    E.fx.podAv.forEach((el, ci) => {
      const n = ['שירה', 'נועה', 'דנה'][ci], land = T.figs[[2, 1, 0][ci]], t0 = T.fn0 + 0.04 + [0.16, 0.08, 0][ci];
      if (t < t0 || t >= land + 0.06) { hide(el); return; }
      const A = M($('.result__tile-av', E.result.tiles[E.result.tileName.indexOf(n)])), B = M(E.final.figs[ci]);
      const k = ease.cubicInOut(seg(t, t0, land));
      const [x, y] = arcPt(center(A), [B.x + B.w / 2, B.y + B.h / 2], k, 150 + ci * 30);
      const s = lerp(1, B.w / 50, ease.cubicInOut(k));
      put(el, { base: `translate(${fix(x - 25)}px,${fix(y - 26)}px) rotate(${fix(Math.sin(Math.PI * k) * (ci - 1) * 14, 2)}deg) scale(${fix(s, 3)})`, op: 1 - sstep(0.9, 1, seg(t, t0, land + 0.06)) });
      put(el.__ring, { op: 1 - sstep(0.3, 0.55, k), base: '' }); put(el.__fig, { op: sstep(0.3, 0.55, k), base: '' });
    });
  }

  function uCoins(t) {                               // three coins from the +100 to the counter
    const from = M(E.result.tiles[E.result.tileName.indexOf('נועה')]), to = M(E.answer.coin);
    E.fx.coins.forEach((c, i) => {
      const t0 = T.coins0 - 0.2 + i * 0.07, t1 = t0 + 0.45;
      if (t < t0 || t >= t1) { hide(c); return; }
      const k = cubicIn(seg(t, t0, t1));
      const [x, y] = arcPt([from.x + from.w / 2, from.y + 10], [to.x + 12, to.y + to.h / 2], k, 90 + i * 20);
      put(c, { base: `translate(${fix(x)}px,${fix(y)}px) scale(${fix(lerp(1.2, 0.8, k), 3)})` });
    });
  }

  // confetti: the game's own celebration at the crown, drawn deterministically on the fx canvas
  const fg = fxc.getContext('2d');
  const CONF = (() => { const r = OM.rng(31), a = []; const cols = ['#ffd23f', '#ff3d9a', '#43d97b', '#6ad1ff', '#ff6b4a', '#b9a0ff'];
    for (let i = 0; i < 70; i++) a.push({ x: r(), vx: (r() - 0.5) * 1.6, vy: -0.8 - r() * 1.4, rot: r() * 6, vr: (r() - 0.5) * 14, w: 7 + r() * 9, h: 4 + r() * 5, c: cols[i % cols.length], d: r() * 0.12 });
    return a; })();
  function drawConfetti(t, camM) {
    fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, W, H);
    const t0 = T.crown + 0.02; if (t < t0 || t > t0 + 1.7) return;
    const pod = M($('.final__podium', S.final));
    const ox = pod.x + pod.w / 2, oy = pod.y + 40;
    fg.setTransform(camM[0] * G, camM[1] * G, camM[2] * G, camM[3] * G, camM[4], camM[5]);
    for (const p of CONF) {
      const tt = t - t0 - p.d; if (tt <= 0) continue;
      const x = ox + (p.x - 0.5) * 60 + p.vx * 160 * tt, y = oy + p.vy * 260 * tt + 0.5 * 520 * tt * tt;
      const a = 1 - sstep(1.1, 1.6, tt);
      fg.save(); fg.translate(x, y); fg.rotate(p.rot + p.vr * tt); fg.globalAlpha = a; fg.fillStyle = p.c;
      fg.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.vr * tt * 0.7)) + 1); fg.restore();
    }
  }

  // ───────────────────────────── seek ─────────────────────────────
  let CAM = null, MAT = null;
  function seek(t) {
    t = clamp(t, 0, T.dur - 1e-6);
    CAM = camAt(t); MAT = view(CAM, { W, H });
    cam.style.transform = `matrix(${MAT.map(v => v.toFixed(5)).join(',')})`;
    drawDots(CAM);
    uHome(t, E.home, false); uGhost(t); uJoin(t); uFlyBoxes(t); uLobby(t); uFlyAvatars(t);
    uAnswer(t); uIntro(t); uDeal(t); uLocked(t); uSweat(t);
    uReveal(t); uCellAvatars(t); uDiscuss(t); uEmoji(t);
    uVote(t); uResult(t); uMinis(t); uCoins(t); uFinal(t); uPodiumHop(t);
    uHome(t, E.end, true);
    uFinger(t);
    drawConfetti(t, MAT);
    if (document.body.classList.contains('hud')) $('#hud').textContent = t.toFixed(2) + 's';
  }

  // ───────────────────────────── sound events ─────────────────────────────
  function buildEvents() {
    const c = el => center(M(el));
    const h = E.home;
    ev(T.glance1, 'glance', 215, 300, 0.5); ev(T.sweat0 + 0.4, 'drip', 250, 300, 0.7);
    ev(T.pull0, 'riser', 215, 300, 1);
    h.letters.forEach((l, i) => ev(T.word0 + i * 0.07 + 0.09, i === 4 ? 'logo_hit' : 'letter', 215 + (2 - i) * 50, 330, 1));
    ev(T.bar + 0.05, 'swish', 215, 360, 0.6); ev(T.adult + 0.03, 'pop', 360, 120, 0.6);
    h.words.forEach((w, i) => ev(T.pitch0 + i * 0.12 + 0.04, 'word', 215, 420, 0.4));
    ev(T.punch + 0.02, 'punch', 215, 450, 1); ev(T.punch + 0.12, 'gulp', 215, 300, 0.8);
    ev(T.tapCode, 'tap', ...c(h.btnCode), 0.9); ev(T.morph0 + 0.02, 'swish', 215, 330, 0.8);
    T.dig.forEach((d, i) => ev(d, 'type', ...c(E.join.boxes[i]), 0.6 + i * 0.08));
    ev(T.fly0 + 0.05, 'whoosh', 215, 250, 0.8);
    ev(T.card, 'thud', 215, 140, 0.6);
    T.joins.forEach((j, i) => ev(j + 0.02, 'join', ...c($('.avatar', E.lobby.players[i])), 0.7 + i * 0.05));
    ev(T.lcrown + 0.12, 'crown', ...c(E.lobby.badge), 0.6); ev(T.danaOn, 'pop', ...c(E.lobby.danaAv), 0.5);
    if (!CLEAN) ev(T.pepperOn, 'on', ...c(E.lobby.switch), 1);
    T.settings.forEach((s, i) => ev(s + 0.02, 'pop', 215 + (i ? -60 : 60), 560, 0.4));
    ev(T.start, 'start', 215, 470, 1);
    ev(T.introNum + 0.06, 'boom_soft', 215, 330, 0.9); ev(T.introOf + 0.1, 'pop', 280, 300, 0.5); ev(T.introLine + 0.05, 'flip', 215, 420, 0.6);
    ev(T.mole + 0.12, 'gulp', 215, 520, 0.5);
    ev(T.introOut, 'whoosh', 215, 400, 0.6); ev(T.q + 0.1, 'card_slap', 215, 150, 0.9); ev(T.hint + 0.04, 'pop', 330, 100, 0.5);
    NAMES.forEach((n, i) => ev(T.deal0 + i * T.dealStep + 0.02, n === 'יובל' ? 'deal_odd' : 'deal', ...c(E.answer.whoFaces[i].box), 0.7));
    ev(T.deal0 + 4 * T.dealStep + T.dealDur + 0.1, 'gulp', ...c(E.answer.whoFaces[4].box), 0.8);
    ev(T.pad0, 'swish', 215, 500, 0.5);
    NAMES.forEach(n => ev(T.check[n], 'check', ...c(E.answer.whoFaces[NAMES.indexOf(n)].box), 0.5));
    ev(T.tap3, 'key', ...c(E.answer.keys[2]), 1); ev(T.tapLock, 'lock', ...c(E.answer.lock), 1); ev(T.stamp, 'stamp_soft', 215, 400, 0.6);
    ev(T.rv0, 'whoosh', 215, 300, 0.8); ev(T.rvTitle + 0.05, 'title', 215, 90, 0.7); ev(T.rvShrink, 'swish', 215, 200, 0.6);
    NAMES.forEach((n, i) => ev(T.cells0 + i * 0.06 + 0.36, 'cell', ...c(E.reveal.cells[E.reveal.cellName.indexOf(n)]), 0.5));
    Object.entries(T.flip).forEach(([n, tf], i) => ev(tf, n === 'יובל' ? 'reveal_big' : 'flip', ...c(E.reveal.cells[E.reveal.cellName.indexOf(n)]), 0.6 + i * 0.07));
    ev(T.flip['יובל'] + 0.1, 'crowd_oooh', 215, 400, 1);
    ev(T.discuss, 'title', 215, 90, 0.7);
    T.emoji.forEach((e, i) => ev(e, 'react', ...c(E.reveal.reactBtns[[0, 1, 6, 3][i]]), 0.7));
    ev(T.vt0 + 0.05, 'whoosh', 215, 400, 0.8); ev(T.vt0 + 0.16, 'title', 215, 90, 0.8);
    Object.entries(T.voted).forEach(([n, tv]) => { if (n !== 'נועה') ev(tv, 'check', ...c(E.vote.cells[E.vote.cellName.indexOf(n)]), 0.45); });
    ev(T.tapYuval, 'tap', ...c(E.vote.yCell), 0.9); ev(T.tapYuval + 0.06, 'stamp', ...c(E.vote.yCell), 1);
    ev(T.tapConfirm, 'confirm', ...c(E.vote.btn), 1);
    ev(T.rs0 + 0.05, 'whoosh', 215, 500, 0.8); ev(T.rs0 + 0.3, 'title', 215, 260, 0.6);
    NAMES.forEach((n, i) => ev(T.minis0 + i * T.miniStep + 0.32, 'mini', ...c(E.result.tiles[E.result.tileName.indexOf(VOTE_FOR[n])]), 0.55));
    ev(T.drum, 'drum', 215, 260, 1);
    SPOT.forEach(([ts, nm], i) => ev(ts, 'roulette', ...c(E.result.tiles[E.result.tileName.indexOf(nm)]), 0.5 + 0.5 * i / SPOT.length));
    ev(T.figDrop, 'drop', 215, 150, 1); ev(T.figDrop + 0.2, 'boom', 215, 150, 1);
    ev(T.verdict, 'verdict', 120, 120, 1); ev(T.verdict + 0.05, 'crowd_cheer', 215, 300, 0.9);
    ev(T.line + 0.3, 'reward', 260, 330, 0.6);
    ev(T.card0, 'swish', 215, 450, 0.8); ev(T.tag, 'stamp_soft', 300, 380, 0.6); ev(T.bubble, 'pop', 250, 520, 0.7);
    ev(T.bubble + 0.15, 'crowd_laugh', 215, 400, 1);
    E.result.tileName.forEach((n, i) => { if (E.result.gains[i]) ev(T.gains + i * 0.09, 'reward', ...c(E.result.tiles[i]), 0.5); });
    ev(T.coins0 + 0.3, 'coins', ...c(E.answer.coin), 0.8);
    ev(T.fn0, 'whoosh', 215, 400, 0.8); ev(T.fnTitle, 'title', 215, 60, 0.8);
    T.steps.forEach((s, i) => ev(s + 0.05, 'step', 215 + [-100, 100, 0][i], 520, 0.6));
    T.figs.forEach((f, i) => ev(f, 'land', 215 + [-100, 100, 0][i], 420, 0.6 + 0.2 * i));
    [0, 1, 2].forEach(i => ev(T.fn0 + 0.06 + [0.16, 0.08, 0][2 - i], 'swish', 215, 600, 0.5));
    ev(T.crown, 'win', 215, 300, 1); ev(T.crown + 0.02, 'confetti', 215, 300, 0.8);
    ev(T.tapShare, 'tap', ...c(E.final.footBtn), 0.9);
    ev(T.end0 + 0.1, 'whip', 215, 400, 1);
    E.end.letters.forEach((l, i) => ev(T.endWord + i * 0.07 + 0.09, i === 4 ? 'logo_hit' : 'letter', 215 + (2 - i) * 50, 330, 0.9));
    ev(T.endPitch + 0.55, 'punch', 215, 450, 0.8); ev(T.endCta + 0.04, 'pop', 215, 520, 0.7);
    ev(T.wink, 'glance', 215, 300, 0.5);
    EV.sort((a, b) => a.t - b.t);
  }

  // ───────────────────────────── hooks ─────────────────────────────
  function track() {                                 // screen boxes of what the story is about, for probe/verify
    const out = {}, s0 = stage.getBoundingClientRect();
    const box = (key, el) => { if (!el) return; const r = el.getBoundingClientRect(); const op = +getComputedStyle(el).opacity; if (r.width < 1) return; out[key] = { x: r.left - s0.left, y: r.top - s0.top, w: r.width, h: r.height, op }; };
    box('finger', E.fx.finger);
    box('mole', E.home.moleSpan); box('wordmark', E.home.wordmark);
    box('codebox', E.join.boxes[2]); box('lobbycard', E.lobby.card); box('question', E.answer.q); box('pad', E.answer.pad);
    box('herocard', E.reveal.heroCard); box('yuvalcell', E.reveal.cells[E.reveal.cellName.indexOf('יובל')]);
    box('votecard', E.vote.yCell); box('fig', E.result.fig); box('twist', E.result.cardwrap);
    box('podium', $('.final__podium', S.final)); box('endmark', E.end.wordmark); box('cta', E.end.cta);
    return out;
  }
  function travel(a, b) { let d = 0; for (const k in a) if (b[k] && a[k].op > 0.05) d = Math.max(d, Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y), Math.hypot(a[k].x + a[k].w - b[k].x - b[k].w, a[k].y + a[k].h - b[k].y - b[k].h)); return d; }

  async function ready() {
    const fams = ['300', '400', '500', '600', '700', '800', '900'].map(w => `${w} 40px "Rubik Variable"`);
    await Promise.all([...fams.map(f => document.fonts.load(f, 'אבגדהוזחטיכלמנסעפצקרשת 0123456789 abc')), document.fonts.load('700 40px Karantina', 'אב')]);
    await document.fonts.ready;
    build();
    measureAll();
    buildCamera(); buildFinger(); buildRays(); buildEvents();
    seek(+(Q.get('t') || 0));
    return true;
  }
  window.__meta = { dur: T.dur, fps: FPS, w: W, h: H, cuts: [],
    inFrame: { } };
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
  window.__T = T;

  // preview: ?play runs in real time, ?t=…&hud pins a frame
  if (Q.has('hud')) document.body.classList.add('hud');
  if (Q.has('play')) window.__ready.then(() => { const t0 = performance.now(); const loop = () => { const t = ((performance.now() - t0) / 1000) % T.dur; seek(t); requestAnimationFrame(loop); }; loop(); });
  // fit the stage to the window when previewing
  if (!Q.has('render')) { const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${s})`; }; addEventListener('resize', fit); fit(); }
  else document.body.classList.add('render');
})();
