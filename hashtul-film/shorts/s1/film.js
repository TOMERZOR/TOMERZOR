/* השתול · short S1 "מי השתול?" (guess along) — 18.0 s, 1080×1920.
 * The viewer plays one round as a detective: the hook, the real question, six answers flipping, a 3-2-1 to find the
 * odd one, the spotlight, "נתפס!" and the plant's own question. Storyboard: STORYBOARD.md. Engine: ../kit.js.
 * The pair is plain data (PAIR); swap it to make the same short with another question pair.
 */
(function () {
  'use strict';
  const { $, $$, put, hide, txt, html, cls, cssv, attr, on, life, lerp, clamp, seg, sstep, spring, pulse, K, M, Pt, Fr,
    center, arcPt, ev, ease, mk, avatar, svgOf, CODES, NAMES, rays, rayAngle, cubicIn, OM } = KIT;

  // ── the question pair (bank id 573), the cast's answers in the order the game reveals the cells ──
  const PAIR = {
    id: 573,
    q: 'חיה שהייתם רוצים לראות בספארי',                       // everyone's question
    fake: 'חיה שהכי דומה לכם כשאתם רוקדים בחתונה',            // the plant's question
    me: 'נועה',                                                // "אתם"
    mole: 'תומר',                                              // the plant (the host: carrot, crown)
    host: 'תומר',
    cells: [['שירה', "ג'ירפה"], ['תומר', 'פינגווין'], ['דנה', 'אריה'], ['נועה', 'פיל'], ['יובל', 'נמר'], ['איתי', 'זברה']],
    hook: ['אחד מהם קיבל', 'שאלה אחרת'], hook2: 'תמצאו אותו?',  // the pink line, broken in two for the big hook
  };
  const CELLN = PAIR.cells.map(c => c[0]);
  const MI = CELLN.indexOf(PAIR.mole);

  // ── timeline (s): anchors on the music's grid (beats every 0.5, bar lines on even seconds) ──
  const T = {
    hook2: 0.5,
    title: 1.0, q: 1.04, words: 1.14, wordStep: 0.075,
    dock0: 0.86, dock1: 1.22,                                    // the big hook shrinks and docks as the title lands
    tuck0: 1.40, tuckStep: 0.06,                                 // each cell pops around its avatar, which tucks into its corner
    flips: [2.0, 2.5, 3.0, 3.5, 4.0, 4.5],
    pull: 4.6, rest0: 5.2,
    who: 6.0, ring: 6.06, counts: [6.5, 7.0, 7.5], ringOut: 8.0,
    spot0: 8.0, spot1: 9.5,
    exit0: 9.56, leap: 9.62, land: 9.9, verdict: 10.0,
    plate: 10.08, line: 10.6, gain: 10.74,
    card0: 11.5, tag: 11.6, fake: 11.8, bubble: 12.6, laugh: 12.8, real: 13.1, hold: 13.3,
    end0: 15.0,
  };
  const END = KIT.endcard({ t0: T.end0, cta: 'תצליחו לתפוס את השתול?' });
  T.dur = END.dur;                                                  // 18.0

  // the spotlight: hops between the cells, fast then slowing, and lands on the plant at spot1
  const SPOT = (() => {
    const seq = ['איתי', 'נועה', 'שירה', 'יובל', 'דנה', 'תומר', 'איתי', 'שירה', 'נועה', 'יובל', 'דנה', 'שירה', 'נועה', 'דנה', PAIR.mole];
    const n = seq.length, gaps = [];
    for (let i = 0; i < n - 1; i++) gaps.push(0.05 + 0.2 * Math.pow(i / (n - 2), 2.4));
    const sum = gaps.reduce((a, b) => a + b, 0), k = (T.spot1 - T.spot0) / sum;
    const out = []; let tt = T.spot0;
    for (let i = 0; i < n; i++) { out.push([tt, seq[i]]); if (i < n - 1) tt += gaps[i] * k; }
    return out;
  })();
  const spotAt = t => { let s = null; for (const [ts, nm] of SPOT) if (t >= ts - 1e-9) s = nm; return s; };

  const E = {};
  const crownSVG = '<svg viewBox="0 0 26 20" class="crown" aria-hidden="true"><path d="M2.5 16.5L1.8 5.2l6 4.3L13 2l5.2 7.5 6-4.3-.7 11.3z" fill="#FFD23F" stroke="#1B0A36" stroke-width="2.6" stroke-linejoin="round"></path><circle cx="13" cy="12" r="1.8" fill="#FF3D9A" stroke="#1B0A36" stroke-width="1.4"></circle></svg>';
  const ringOf = n => (n === PAIR.me ? '#FFD23F' : undefined);

  // ───────────────────────────── build ─────────────────────────────
  function build() {
    // the reveal (text kind, captured face-down), re-skinned with the pair
    const r = KIT.screen('reveal', 't_reveal_down');
    E.hideR = [$('header', r), $('.role', r), $('.reveal__reactions', r), $('.screen__foot', r)].filter(Boolean);
    E.head = $('.reveal__head', r);
    E.title = $('.reveal__head > div', r); E.title.__base = 'rotate(-2deg)';
    E.q = $('.reveal__q', r); E.q.__base = 'rotate(-0.8deg)';
    E.qp = $('p', E.q); E.qp.textContent = PAIR.q;
    E.qWords = KIT.splitWords(E.qp);
    E.qBadge = $('.reveal__q-badge', r);
    E.grid = $('.reveal__grid', r);
    E.cells = $$('.reveal__cell', r);
    E.slots = E.cells.map(c => $('.reveal__slot', c));
    E.slots.forEach(s => s.classList.remove('is-fresh'));
    E.flips = E.cells.map(c => $('.reveal__flip', c));
    E.flips.forEach(f => { f.style.transform = 'none'; });      // measure every card face-up (the capture had three turned)
    E.cellAv = E.cells.map((c, i) => {
      const [n, a] = PAIR.cells[i];
      const who = $('.reveal__who', c);
      who.innerHTML = n === PAIR.me ? '<span class="reveal__me">אתם</span>' : `<span class="reveal__name">${n}</span>`;
      const ans = $('.ans', c); ans.style.setProperty('--chars', String(Array.from(a).length)); $('.ans__text', ans).textContent = a;
      return KIT.swapAvatar($('.reveal__front .avatar', c), CODES[n], { size: 50, ring: ringOf(n) });
    });
    // "מי השתול?" — the vote screen's own title, set into the reveal's head; the header's timer ring, drawn large
    const tmp = document.createElement('div'); tmp.innerHTML = window.SCREENS.vote;
    E.vt = mk('div', 's1-vt', E.head); E.vt.appendChild($('.vote__head .title', tmp).parentElement);
    E.vtIn = E.vt.firstChild; E.vtIn.style.transform = ''; E.vtIn.__base = 'rotate(-4deg)';
    tmp.innerHTML = window.SCREENS.answer;
    const tm = $('.timer', tmp); tm.style.setProperty('--d', '76px');
    E.ring = mk('div', 's1-ring', E.head); E.ring.appendChild(tm);
    E.timer = tm; E.timerText = $('.timer__text', tm); E.arc = $('.timer__arc', tm);
    E.arcC = 2 * Math.PI * 26;

    // the result (text kind, caught), re-skinned for the plant
    const rs = KIT.screen('result', 't_result_gain');
    E.hideRS = [$('header', rs), $('.result__board', rs), $('.screen__foot', rs)].filter(Boolean);
    const brd = $('.result__board', rs); if (brd && brd.closest('.panel')) E.hideRS.push(brd.closest('.panel'));
    E.figbox = $('.result__figbox', rs);
    E.rays = $('.result__rays', rs); E.fig = $('.result__fig', rs); E.squash = $('.result__squash', rs);
    E.verdict = $('.result__verdict', rs); E.sayin = $('.result__sayin', rs);
    E.plate = $('.result__plate', rs); E.plate.textContent = PAIR.mole;
    E.line = $('.result__line', rs); E.lineGain = $('.result__gain', E.line);
    E.cardwrap = $('.result__cardwrap', rs); E.tag = $('.result__tag', rs); $('.result__tag-name', rs).textContent = PAIR.mole;
    E.fake = $('.result__fake', rs); E.fake.textContent = PAIR.fake;
    E.answerRow = $('.result__answer', rs); E.bubble = $('.result__bubble', rs);
    $('.result__bubble-text span', rs).textContent = PAIR.cells[MI][1];
    KIT.swapAvatar($('.result__answer .avatar', rs), CODES[PAIR.mole], { size: 46 });
    E.real = $('.result__real', rs); E.real.innerHTML = `<b>אתם נשאלתם:</b> ${PAIR.q}`;
    const figAv = $('.result__fig .avatar', rs);
    figAv.innerHTML = `<span class="cA">${svgOf(CODES[PAIR.mole], { variant: 'figure', mood: 'shock' })}</span><span class="cB">${svgOf(CODES[PAIR.mole], { variant: 'figure', mood: 'cry' })}</span>`;
    $$('span', figAv).forEach(s => { s.style.cssText = 'position:absolute;inset:0;display:block'; }); figAv.style.position = 'relative';
    E.cA = $('.cA', figAv); E.cB = $('.cB', figAv); E.figAv = figAv;
    E.wob = $('.result__fig .wobble', rs);
    if (PAIR.mole === PAIR.host) { E.crown = mk('span', 's1-crown', E.squash, crownSVG); E.crown.__base = 'rotate(-12deg)'; }

    // fx: the hook stickers and the row of six (they dive into the cells)
    // the docked (small) hook: one pink line and the yellow one — the layout from 2.0 on
    E.hookA = mk('div', 's1-hook', KIT.fx, `<span class="sticker" style="--tilt:-3deg"><span class="s1-w">${PAIR.hook[0]}</span> <span class="s1-w">${PAIR.hook[1]}</span></span>`);
    E.hookB = mk('div', 's1-hook', KIT.fx, `<span class="sticker sticker--yellow" style="--tilt:3deg">${PAIR.hook2}</span>`);
    E.hookWords = $$('.s1-w', E.hookA);
    // the big hook of the first second: three stickers, settled at frame 0 (the yellow one lands at 0.5)
    E.big = [[PAIR.hook[0], '', -3], [PAIR.hook[1], '', -1], [PAIR.hook2, ' sticker--yellow', 3]].map(([txt_, c, tilt]) => {
      const box = mk('div', 's1-hook s1-big', KIT.fx, `<span class="sticker${c}"><span>${txt_}</span></span>`);
      const st = $('.sticker', box); st.__base = `rotate(${tilt}deg)`; st.__tilt = tilt; st.style.transform = st.__base;
      return { box, st, text: $('span', st), tilt };
    });
    // the six, big, standing where their cells will be
    E.six = CELLN.map(n => mk('div', 's1-p s1-six', KIT.fx, avatar(CODES[n], { size: 115, ring: ringOf(n) }) +
      (n === PAIR.me ? '<span class="s1-me">אתם</span>' : `<span class="s1-tag">${n}</span>`)));
    E.sixAv = E.six.map(p => $('.avatar', p)); E.sixName = E.six.map(p => p.lastChild);
    E.emoji = mk('div', 'flyemoji', KIT.fx, '😂');
  }

  // fixed layout of the fx pieces, game px
  const HOOK_Y = [24, 58];
  const BIG_TOP = [22, 74.5, 139], BIG_DX = [10, -10, 22], BIG_CY = 364, BIG_Z = 0.915;          // the big hook block, game px (top of each sticker box)
  const tuckT = i => T.tuck0 + i * T.tuckStep;
  function layoutFx() {
    E.hookA.style.top = (HOOK_Y[0] - 19) + 'px'; E.hookB.style.top = (HOOK_Y[1] - 19) + 'px';
    E.hookB.style.left = '46px';
    E.big.forEach((b, i) => { b.box.style.top = BIG_TOP[i] + 'px'; b.box.style.left = (BIG_DX[i] - 85) + 'px'; });
  }

  let G = {}; window.__G = G;
  function measure() {
    G.title = M(E.title); G.q = M(E.q); G.grid = M(E.grid);
    G.cells = E.cells.map(M); G.cellAv = E.cellAv.map(M);
    G.six = E.six.map(M); G.sixAv = E.sixAv.map(M);
    G.big = E.big.map(b => ({ st: M(b.st), text: M(b.text) }));
    G.hookWords = E.hookWords.map(M); G.hookB = M($('.sticker', E.hookB));
    G.fig = M(E.figbox); G.card = M(E.cardwrap); G.verdict = M(E.verdict); G.line = M(E.line); G.plate = M(E.plate);
    G.figAv = M(E.figAv); G.bubble = M(E.bubble);
    // the ring sits to the left of the title, at the same height
    const vt = M(E.vtIn);
    E.ring.style.left = (vt.x - G.title.x - 0) + 'px';
  }

  // ───────────────────────────── camera ─────────────────────────────
  function camera() {
    const g = G.grid, q = G.q, fig = G.fig, card = G.card;
    const allTop = G.title.y - 70, allBot = g.y + g.h;              // the hook, the title, the card and all six answers
    const midAll = (allTop + allBot) / 2;
    const resTop = G.verdict.y - 10, resBot = card.y + card.h;
    return {
      keys: [
        { t: 0, ...Pt(222, BIG_CY, BIG_Z) },                            // the big hook and the six where their cells will be
        { t: 1.75, ...Pt(222, BIG_CY, BIG_Z) },
        { t: 2.0, ...Pt(222, 356, 0.90), curve: ease.sineInOut },  // ease back as the card lands; the puzzle frame from here
        { t: T.rest0, ...Pt(222, 356, 0.90) },
        { t: T.spot0, ...Pt(222, 356, 0.90) },
        { t: T.spot1, ...Pt(222, 366, 0.94), curve: ease.sineInOut },
        { t: T.land + 0.04, ...Fr(fig, 1.32, 0, 30), curve: ease.cubicInOut },
        { t: T.line + 0.3, ...Fr(fig, 1.22, 0, 60), curve: ease.cubicInOut },
        { t: T.fake + 0.4, ...Pt(228, 398, 0.97), curve: ease.cubicInOut },
        { t: T.end0, ...Pt(228, 398, 0.97) },
      ],
      hits: [[T.title + 0.02, 4, 12], [T.verdict, 18, 8]],
      rests: [[0, 1.75], [2.0, T.spot1 - 0.15], [T.hold, T.end0]],
    };
  }

  // ───────────────────────────── update ─────────────────────────────
  function update(t) {
    const revealOn = t < T.verdict + 0.3, resultOn = t >= T.exit0 && t < T.end0 + 0.75;
    on(KIT.S.reveal, revealOn); on(KIT.S.result, resultOn);
    uHook(t); uRow(t);
    if (revealOn) uReveal(t);
    if (resultOn) uResult(t);
    uEmoji(t);
  }

  function uHook(t) {
    // big at frame 0 (yellow lands at 0.5); shrinks and docks as the title lands; the docked form leaves at 6.0
    const kd = ease.cubicInOut(seg(t, T.dock0, T.dock1));
    const tgt = [G.hookWords[0], G.hookWords[1], G.hookB];
    E.big.forEach((b, i) => {
      const g = G.big[i], to = tgt[i];
      const su = lerp(1, to.w / g.text.w, kd);
      const bs = center(g.st), bt = center(g.text), st = center(to);
      const dx = st[0] - bs[0] - (bt[0] - bs[0]) * (to.w / g.text.w), dy = st[1] - bs[1] - (bt[1] - bs[1]) * (to.w / g.text.w);
      const pr = { x: dx * kd, y: dy * kd, s: su, r: ((i < 2 ? -3 : 3) - b.tilt) * kd, op: 1 - sstep(0.62, 0.95, kd) };
      if (i === 2) { const kb = K(t, T.hook2, 'pop'); if (t < T.hook2) pr.op = 0; else { pr.s *= lerp(0.3, 1, kb); pr.r += lerp(-14, 0, kb); pr.op *= clamp(kb * 3); } }
      put(b.st, pr);
    });
    const din = sstep(0.55, 0.9, kd);
    const out = cubicIn(seg(t, T.who - 0.1, T.who + 0.2));
    put(E.hookA, { y: 6 * out, s: 1 - 0.3 * out, op: din * (1 - out), r: -4 * out });
    put(E.hookB, { y: 6 * out, s: 1 - 0.3 * out, op: din * (1 - out), r: 4 * out });
  }

  function uRow(t) {
    // the six stand on their cells; each cell pops in around its avatar, which tucks into the cell's avatar corner and
    // rides the face-down card until the flip hands over to the front's own avatar (at 90°, where both are edge-on)
    E.six.forEach((p, i) => {
      const ti = tuckT(i), tf = T.flips[i];
      const fk = t < tf ? 0 : spring(t - tf, 0.6, 26), ry = lerp(180, 0, clamp(fk, 0, 1.08));
      if (ry <= 90) { hide(p); return; }
      const A = G.sixAv[i], P = G.six[i], C = G.cells[i], av = G.cellAv[i];
      const cc = center(C), ac = center(A), pc = center(P);
      const sc = t < ti ? 0 : lerp(0.5, 1, K(t, ti, 'pop'));          // the cell's own pop (uReveal), to follow its corner
      const kt = t < ti ? 0 : K(t, ti, 'soft');
      const corner = [cc[0] + (center(av)[0] - cc[0]) * sc, cc[1] + (center(av)[1] - cc[1]) * sc];
      const home = [cc[0], cc[1] - (pc[1] - ac[1]) - 5];             // the avatar+name block on the cell (5 px high: the names clear the bottom line)
      const cx = lerp(home[0], corner[0], kt), cy = lerp(home[1], corner[1], kt);
      const squash = Math.abs(Math.cos(ry * Math.PI / 180));
      const x = cc[0] + (cx - cc[0]) * squash;
      const s = lerp(1, av.w / A.w, kt);
      put(p, { x: x - ac[0], y: cy - ac[1], sx: squash, s, op: 1 });
      put(E.sixName[i], { op: 1 - clamp((t - ti) / 0.14), base: '' });
    });
  }

  function cellIn(i) { return tuckT(i); }

  function uReveal(t) {
    E.hideR.forEach(hide);
    // the title lands, turns into "מי השתול?" at 6.0
    const tk = K(t, T.title, 'pop'), turn = sstep(T.who - 0.06, T.who + 0.12, t);
    const ex = ease.cubicInOut(seg(t, T.exit0, T.exit0 + 0.22));
    put(E.title, t < T.title ? { op: 0 } : { y: lerp(-40, 0, tk), s: lerp(0.6, 1, tk) * (1 - 0.35 * turn), op: clamp(tk * 2) * (1 - turn) });
    const vk = K(t, T.who, 'bouncy');
    put(E.vtIn, t < T.who ? { op: 0 } : { s: lerp(0.4, 1, vk) * (1 - 0.4 * ex), r: lerp(-14, 0, vk), y: -60 * ex, op: clamp(vk * 2) * (1 - ex) });
    // the ring: appears and fills (6.0–6.5), then drains 3·2·1 (6.5–8.0), and pops away as the spotlight starts
    const rk = K(t, T.ring, 'pop'), rOut = cubicIn(seg(t, T.ringOut, T.ringOut + 0.2));
    put(E.ring, t < T.ring ? { op: 0 } : { s: lerp(0.2, 1, rk) * (1 - 0.6 * rOut) * (1 + pulse(t, T.counts.filter(c => t >= c).slice(-1)[0] ?? 99, 0.12, 10, 26)), r: lerp(30, 0, rk), op: clamp(rk * 3) * (1 - rOut), base: 'translateY(-50%)' });
    const fill = ease.cubicOut(seg(t, T.ring, T.counts[0]));
    const left = t < T.counts[0] ? fill : 1 - seg(t, T.counts[0], T.ringOut);
    attr(E.arc, 'stroke-dashoffset', (E.arcC * (1 - left)).toFixed(2));
    const n = t < T.counts[0] ? '' : t < T.counts[1] ? '3' : t < T.counts[2] ? '2' : t < T.ringOut ? '1' : '0';
    txt(E.timerText, n);
    cls(E.timer, 'timer--urgent', t >= T.counts[2]);
    // the question card and its words
    const qk = K(t, T.q, 'soft');
    put(E.q, t < T.q ? { op: 0 } : { y: lerp(-30, 0, qk) - 40 * ex, s: lerp(0.85, 1, qk) * (1 - 0.3 * ex), op: clamp(qk * 2) * (1 - ex) });
    E.qWords.forEach((w, i) => put(w, life(t, T.words + i * T.wordStep, { y: 16, s: 0.7 }, 'pop')));
    put(E.qBadge, t < T.q + 0.2 ? { op: 0 } : { s: K(t, T.q + 0.2, 'bouncy'), op: 1, base: 'rotate(12deg)' });
    // the cells: pop when their player arrives, flip on the beats; the spotlight; then they clear for the verdict
    const spot = t >= T.spot0 && t < T.verdict ? spotAt(t) : null;
    E.cells.forEach((c, i) => {
      const n = CELLN[i], ta = cellIn(i), tf = T.flips[i];
      const ck = K(t, ta, 'pop');
      const fk = t < tf ? 0 : spring(t - tf, 0.6, 26);
      put(E.flips[i], { ry: lerp(180, 0, clamp(fk, 0, 1.08)), base: '' });
      let s = lerp(0.5, 1, ck) * (1 + pulse(t, tf, 0.06, 10, 28));
      let op = t < ta ? 0 : clamp(ck * 2), y = 0, r = 0;
      const lit = spot === n, isMole = i === MI;
      if (spot) {
        const hop = SPOT.filter(([ts, nm]) => nm === n && t >= ts).slice(-1)[0];
        if (lit) s *= 1.06 + (hop ? pulse(t, hop[0], 0.06, 12, 30) : 0);
        else op *= 0.4;
      }
      if (isMole && t >= T.spot1) s *= 1 + pulse(t, T.spot1, 0.1, 7, 22);
      cls(E.slots[i], 'is-fresh', lit);
      // clearing: the others fall away, the plant's cell lets its player out and folds
      if (!isMole) {
        const kx = ease.cubicInOut(seg(t, T.exit0 + 0.02 * i, T.exit0 + 0.02 * i + 0.24));
        y += 70 * kx; s *= 1 - 0.3 * kx; r += (i % 2 ? 5 : -5) * kx; op *= 1 - kx;
      } else {
        const kx = cubicIn(seg(t, T.leap + 0.08, T.land));
        s *= 1 - 0.5 * kx; op *= 1 - kx; y += 60 * kx;
      }
      put(c, { s, op, y, r });
      put(E.cellAv[i], isMole ? { s: 1 + 0.25 * sstep(T.spot1, T.leap, t), op: t < T.leap ? 1 : 0, base: '' } : { base: '' });
    });
  }

  function uResult(t) {
    E.hideRS.forEach(hide);
    // the plant leaps out of his cell and lands as the figure
    const from = center(G.cellAv[MI]), to = center(G.figAv);
    const k = ease.cubicInOut(seg(t, T.leap, T.land));
    const [x, y] = arcPt(from, to, k, 90);
    const s0 = G.cellAv[MI].w / G.figAv.w * 1.15;
    const flying = t < T.land;
    const im = OM.impact(t, T.land, { decay: 7, omega: 22, sqx: 0.18, sqy: 0.22 });
    put(E.fig, t < T.leap ? { op: 0 } : flying ? { x: x - to[0], y: y - to[1], s: lerp(s0, 1, k), r: lerp(-30, 0, k) * 1, op: clamp((t - T.leap) / 0.06) } : { op: 1 });
    put(E.squash, t < T.land ? { base: '' } : { sx: im.sx, sy: im.sy, base: '' });
    E.squash.style.transformOrigin = '50% 100%';
    KIT.wobble(t, E.wob, T.verdict + 0.4, 3);
    put(E.cA, { op: t < T.verdict ? 1 : 0, base: '' }); put(E.cB, { op: t < T.verdict ? 0 : 1, base: '' });
    if (E.crown) put(E.crown, { y: t < T.verdict ? 0 : -6 * Math.max(0, pulse(t, T.verdict, 1, 6, 18)), base: 'rotate(-12deg)' });
    // the verdict, rays, the name plate and the line
    put(E.rays, t < T.verdict - 0.05 ? { op: 0 } : { s: lerp(0.2, 1, K(t, T.verdict - 0.05, 'soft')), r: rayAngle(t) * 2, op: 1, base: '' });
    const vk = K(t, T.verdict, 'pop');
    put(E.verdict, t < T.verdict ? { op: 0 } : { s: lerp(2.4, 1, vk), r: lerp(-20, 0, vk), op: clamp(vk * 3) });
    put(E.sayin, { op: t < T.plate ? 0 : 1, base: '' });
    put(E.plate, life(t, T.plate, { y: -30, s: 0.5 }, 'pop'));
    put(E.line, life(t, T.line, { y: 16, s: 0.8 }, 'pop'));
    put(E.lineGain, t < T.gain ? { op: 0 } : { s: lerp(0.3, 1, K(t, T.gain, 'bouncy')), op: 1, base: '' });
    // the twist card
    const ck = K(t, T.card0, 'soft');
    put(E.cardwrap, t < T.card0 ? { op: 0 } : { y: lerp(300, 0, ck), r: lerp(4, 0, ck), op: clamp(ck * 2) });
    put(E.tag, t < T.tag ? { op: 0 } : { s: lerp(2, 1, K(t, T.tag)), r: lerp(-14, 0, K(t, T.tag)), op: 1, base: '' });
    put(E.fake, life(t, T.fake, { y: 18 }, 'pop'));
    put(E.answerRow, life(t, T.bubble - 0.1, { y: 10 }, 'soft'));
    put(E.bubble, t < T.bubble ? { op: 0 } : { s: lerp(0.3, 1, K(t, T.bubble, 'bouncy')), op: clamp(K(t, T.bubble) * 2), base: '' });
    put(E.real, life(t, T.real, { y: 10 }, 'soft'));
  }

  function uEmoji(t) {                                             // 😂 floats up from the bubble on the laugh
    const t0 = T.laugh, b = G.bubble;
    if (t < t0 || t > t0 + 1.05) { hide(E.emoji); return; }
    const k = ease.cubicOut(seg(t, t0, t0 + 0.95));
    const [x, y] = arcPt([b.x - 6, b.y + b.h * 0.6], [b.x - 74, b.y + b.h * 0.45], k, 22);
    put(E.emoji, { base: `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${(Math.sin((t - t0) * 9) * 10).toFixed(2)}deg) scale(${lerp(0.4, 0.9, K(t, t0, 'pop')).toFixed(3)})`, op: 1 - sstep(t0 + 0.6, t0 + 1.05, t) });
  }

  // ───────────────────────────── sound ─────────────────────────────
  function events() {
    const c = r => center(r);
    ev(0.0, 'pop', 215, BIG_TOP[0] + 30, 0.6);
    ev(T.hook2, 'pop', 240, BIG_TOP[2] + 30, 0.8);
    ev(T.dock0, 'swish', 215, 80, 0.45);
    ev(T.title, 'thud', ...c(G.title), 0.8);
    ev(T.q, 'swish', ...c(G.q), 0.6);
    CELLN.forEach((n, i) => ev(cellIn(i), 'cell', ...c(G.cells[i]), 0.45));
    T.flips.forEach((tf, i) => ev(tf, 'flip_up', ...c(G.cells[i]), 0.75 + 0.05 * i));   // sound QA: the flips were 7 dB under the body
    ev(T.pull, 'riser', 215, 400, 0.25);
    ev(T.who, 'stamp', ...c(G.title), 0.8);
    T.counts.forEach(tc => ev(tc, 'count', ...c(G.title), 0.8));
    SPOT.forEach(([ts, nm], i) => ev(ts, 'roulette', ...c(G.cells[CELLN.indexOf(nm)]), 1.0 + 0.4 * i / (SPOT.length - 1)));   // sound QA: ticks were buried under the riser
    ev(T.spot1, 'stamp_soft', ...c(G.cells[MI]), 0.8);
    ev(T.exit0, 'drop', 215, 500, 0.5);
    ev(T.leap, 'whoosh', ...c(G.cellAv[MI]), 0.6);
    ev(T.land, 'land', ...c(G.figAv), 0.7);
    ev(T.verdict, 'verdict', ...c(G.figAv), 1);
    ev(T.verdict + 0.05, 'crowd_cheer_b', 215, 300, 0.8);
    ev(T.plate, 'pop', ...c(G.plate), 0.5);
    ev(T.gain, 'coins', ...c(G.line), 1); ev(T.gain, 'reward', ...c(G.line), 1);   // sound QA: was 3 dB under the groove
    ev(T.card0, 'whoosh', ...c(G.card), 0.8);   // sound QA: a swish vanished under groove B
    ev(T.tag, 'stamp_soft', ...c(G.card), 0.5);
    ev(T.fake, 'bubble', ...c(G.card), 0.6);
    ev(T.bubble, 'pop', ...c(G.bubble), 0.8);
    ev(T.laugh, 'crowd_laugh_b', ...c(G.bubble), 0.6);   // sound QA: was louder than "נתפס!"
    ev(T.real, 'pop', ...c(G.card), 0.4);
  }

  const music = {
    segments: [{ t0: 0, t1: 10, track: 6.557 }, { t0: 10, t1: 12, track: 32.557 }, { t0: 12, t1: 18, track: 35.557 }],
    sections: [[9.45, 0.72]], gain: 0.26, nudge: 0.03,
    thin: [[6.0, 8.0]],
    stops: [[9.62, 10.0]],                                       // a breath: keeps the 9.5 pickup, cuts its tail before the drop
  };

  KIT.run({
    T, music,
    build() { build(); layoutFx(); },
    measure, camera, update, events,
    track(box) {                                                   // what must be read, while it is visible
      const b = (key, el, ...owners) => { if (owners.every(o => o.__op !== '0' && (!o.closest('.scr') || o.closest('.scr').classList.contains('on')))) box(key, el); };
      b('hookA', $('.sticker', E.hookA), E.hookA); b('hookB', $('.sticker', E.hookB), E.hookB);
      E.big.forEach((g, i) => b('big' + i, g.st, g.st));
      E.six.forEach((p, i) => b('name' + i, E.sixName[i], p, E.sixName[i]));
      b('title', $('h1', E.title), E.title); b('vtitle', $('h1', E.vtIn), E.vtIn); b('ring', E.timer, E.ring); b('q', E.qp, E.q);
      E.cells.forEach((c, i) => b('cell' + i, $('.ans', c), c));
      b('verdict', $('.sticker', E.verdict), E.verdict); b('plate', E.plate, E.plate, E.sayin); b('line', E.line, E.line, E.sayin);
      b('fake', E.fake, E.fake, E.cardwrap); b('bubble', E.bubble, E.bubble, E.cardwrap); b('real', E.real, E.real, E.cardwrap); b('tag', E.tag, E.tag, E.cardwrap);
    },
  });
})();
