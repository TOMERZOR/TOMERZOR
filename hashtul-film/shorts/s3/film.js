/* השתול · S3 "POV: אתם השתול" (18 s, 1080×1920). Storyboard: STORYBOARD.md. Engine: ../kit.js (read ../KIT.md).
 *
 * The viewer is the plant. (a) You rate yourself on your own phone: the finger slides the game's scale up to 10 and
 * locks it. (b) The question card flips over: everyone else was asked something else. The cards flip, yours last.
 * (c) The room reacts, "מי פה משקר?", you have to improvise, the vote misses: "ברח!", and the card shows both
 * questions and your 10. (d) The shared end card.
 *
 * Every screen is the game's own, captured from its demo mode as the plant with the rate-yourself kind
 * (screens.js, built by capture.py + build_screens.py). Times live in T; every frame is a pure function of t.
 */
(function () {
  'use strict';
  const { $, $$, mk, put, hide, txt, html, cls, cssv, attr, on, life, lerp, clamp, seg, sstep, spring, pulse, press, K, M, Pt, Fr,
    center, ev, ease, toRect, lerpRect, arcPt, fix, G, W, H, OM, CODES, cubicIn } = KIT;

  // ───────────────────────────── the pair: swap a different one in here ─────────────────────────────
  const PAIR = {
    plant: 'יובל',                                            // the plant: you (the demo's p5, the cucumber)
    fake: 'כמה אתם טובים בלשקר לאמא?',                         // your question (the plant's)
    real: 'כמה אתם טובים בחניה ברוורס?',                        // everyone else's
    max: 10, ends: ['אסון', 'אלופים'],                         // the scale 1…max and its two labels
    mine: 10, from: 5,                                        // your answer, and where the finger touches the bars
    answers: { 'שירה': 6, 'תומר': 7, 'דנה': 5, 'נועה': 4, 'איתי': 8 },
    // who voted for whom, in the order the faces fly (three on תומר, two on you: you escape). שירה did not vote.
    votes: [['נועה', 'תומר'], ['תומר', 'יובל'], ['דנה', 'תומר'], ['איתי', 'יובל'], ['יובל', 'תומר']],
    abstain: 'שירה',
    gain: 300,
  };
  const STICK = { pov: 'POV: אתם השתול', notYet: 'ואתם עוד לא יודעים את זה', others: 'כל השאר נשאלו משהו אחר', hurry: 'מהר, תאלתרו תירוץ!' };

  // ───────────────────────────── timeline (s) ─────────────────────────────
  const T = {
    pov: -0.12, notYet: 0.5, stickOut: 1.86,                          // frame 0 already has the sticker landing
    fIn: 1.3, touch: 2.0, slideEnd: 2.86, lift: 2.92, tapLock: 3.5, fOut: 3.95,
    morph: 3.53, stamp: 3.68, tick: 3.6, btnSwap: 3.64,
    twist: 4.0, heroIn: 4.09, title: 4.05, cells0: 4.24, dive0: 4.06, dive1: 4.46,
    others: 4.6, peek: 4.62, peekOut: 5.95, othersOut: 5.85,
    flip: { 'תומר': 5.0, 'שירה': 5.5, 'נועה': 6.0, 'דנה': 6.5, 'איתי': 7.0, 'יובל': 8.0 },
    bar: 8.42, emoji: [8.4, 8.72, 9.06, 9.4], discuss: 9.0,
    hurry: 10.0, hurryOut: 11.22,
    vote0: 10.74, vote1: 11.1, myst: 10.96, say: 11.02, minis0: 11.16, miniStep: 0.12, lit: 11.72, zz: 11.74,
    figDrop: 11.8, verdict: 12.0, plate: 12.1, line: 12.5, gain: 12.62,
    card0: 12.8, tag: 12.95, fake: 13.05, bubble: 13.35, real: 13.6, hold: 13.6,
    end0: 15.0,
  };
  const END = KIT.endcard({ t0: T.end0, cta: 'תצליחו לעבוד על כולם?' });
  T.dur = END.dur;                                                   // 18.0
  const ORDER = Object.keys(T.flip);
  const POVY = 0;                                                    // game y of the POV sticker (frame y ≈ 255 at t = 0)                                 // the flip order (yours last)

  // ───────────────────────────── build ─────────────────────────────
  const E = {};
  const tileOf = (tiles, n) => tiles[tiles.map(t => $('.result__tile-name', t).textContent.trim()).indexOf(n)];
  function build() {
    // A · answer (untouched capture; the picked state is the game's own classes: .is-on up to the value, .is-top on it)
    const a = KIT.screen('answer', 's3_answer'), A = (E.A = {});
    A.header = $('header', a);
    A.play = $('.answer__play', a);
    A.q = $('.answer__q', a); A.qText = $('.answer__q-text', a); txt(A.qText, PAIR.fake);
    A.hint = $('.answer__hint', a);
    A.read = $('.answer__scale-read', a); A.read.__base = 'rotate(-3deg)';
    A.val = $('.answer__scale-value', a);
    A.meter = $('.answer__meter', a);
    A.bars = $$('.answer__bar', a); A.barI = A.bars.map(b => $('i', b));
    A.ends = $$('.answer__scale-ends .chip', a);                     // [אסון, אלופים] in DOM order (RTL: אסון on the right)
    A.ends.forEach((c, i) => txt(c, PAIR.ends[i]));
    A.foot = $('.answer__foot', a); A.who = $$('.answer__who-one', a); A.whoLine = $('.answer__who-line', a);
    A.lock = $('.answer__lock', a);
    const yi = A.who.findIndex(w => w.getAttribute('title') === PAIR.plant); A.me = A.who[yi];
    A.meTick = $('.answer__who-tick', A.who[0]).cloneNode(true); A.me.appendChild(A.meTick);
    // B · answered: the locked card (its header, question, waiting row and note are the answer screen's)
    const lk = KIT.screen('answered', 's3_answered'), LK = (E.LK = {});
    LK.hide = [$('header', lk), $('.answer__q', lk), $('.answer__who', lk), $('.answer__locked > p', lk)].filter(Boolean);
    LK.card = $('.answer__locked-card', lk); LK.card.__base = 'rotate(-3deg)';
    LK.stamp = $('.answer__stamp', lk); LK.stamp.__base = 'rotate(9deg)';
    LK.btn = $('.screen__foot .btn', lk);
    $$('.answer__locked-num b', lk).forEach(b => txt(b, String(PAIR.mine)));
    // C · reveal: the game's hero card carries the real question, in place of the answer's card
    const r = KIT.screen('reveal', 's3_reveal'), R = (E.R = {});
    R.header = $('header', r); R.head = $('.reveal__head > div', r); R.head.__base = 'rotate(-2deg)';
    R.q = $('.reveal__q', r); R.grid = $('.reveal__grid', r);
    R.grid.style.marginTop = '68px';                                // room for the big card (the strip is never shown)
    R.cells = $$('.reveal__cell', r);
    R.name = R.cells.map(c => { const n = $('.reveal__name', c); return n ? n.textContent.trim() : PAIR.plant; });
    R.flips = R.cells.map(c => $('.reveal__flip', c));
    R.ans = R.cells.map(c => $('.ans b', c));
    R.figs = R.cells.map(c => $('.ans', c));
    R.name.forEach((n, i) => txt(R.ans[i], String(n === PAIR.plant ? PAIR.mine : PAIR.answers[n])));
    R.me = R.name.indexOf(PAIR.plant);
    R.foot = [$('.role', r), $('.screen__foot .lead', r)].filter(Boolean);
    R.reacts = $('.reveal__reactions', r); R.reactBtns = $$('.reveal__react', r);
    R.eggplant = R.reactBtns.find(b => b.textContent.includes('🍆'));          // never on screen (TikTok-clean)
    R.reactAt = ch => R.reactBtns.find(b => b.textContent.includes(ch));
    const body = $('.screen__body', r);
    R.hero = mk('div', 'reveal__hero', body, `<div class="card reveal__hero-card"><span class="reveal__hero-badge" aria-hidden="true">?</span><p>${PAIR.real}</p></div>`);
    R.heroCard = $('.reveal__hero-card', R.hero);
    // D · discuss: its title only
    const d = KIT.screen('discuss', 's3_discuss'), D = (E.D = {});
    D.hide = [$('header', d), $('.reveal__q', d), $('.reveal__grid', d), $('.screen__foot', d)].filter(Boolean);
    D.head = $('.reveal__head > div', d) || $('.reveal__head .title', d); D.head.__base = 'rotate(-2deg)';
    // E · result, escaped (the at=8000 capture) + the tally's mystery figure and "השתול הוא" (at=0)
    const rs = KIT.screen('result', 's3_esc'), RS = (E.RS = {});
    RS.header = $('header', rs); RS.foot = $('.screen__foot', rs);
    RS.figbox = $('.result__figbox', rs); RS.figfit = $('.result__figfit', rs);
    RS.rays = $('.result__rays', rs); RS.fig = $('.result__fig', rs); RS.squash = $('.result__squash', rs); RS.wob = $('.result__fig .wobble', rs);
    RS.verdict = $('.result__verdict', rs); RS.say = $('.result__say', rs); RS.sayin = $('.result__sayin', rs);
    RS.plate = $('.result__plate', rs); RS.line = $('.result__line', rs); RS.lineGain = $('.result__gain--inline', rs);
    txt(RS.lineGain, '+' + PAIR.gain);
    RS.cardwrap = $('.result__cardwrap', rs); RS.tag = $('.result__tag', rs); RS.fake = $('.result__fake', rs);
    txt(RS.fake, PAIR.fake);
    RS.answerRow = $('.result__answer', rs); RS.bubble = $('.result__bubble', rs); txt($('.result__bubble-text span', rs), String(PAIR.mine));
    RS.real = $('.result__real', rs); html(RS.real, `<b>כל השאר נשאלו:</b> ${PAIR.real}`);
    RS.board = $('.result__board', rs); RS.tiles = $$('.result__tile', rs);
    // the board takes the reveal's order, so every answer card shrinks into its own tile instead of crossing
    RS.tiles.sort((x, y) => R.name.indexOf($('.result__tile-name', x).textContent.trim()) - R.name.indexOf($('.result__tile-name', y).textContent.trim()))
      .forEach(tl => RS.board.appendChild(tl));
    RS.tileName = RS.tiles.map(tl => $('.result__tile-name', tl).textContent.trim());
    RS.gains = $$('.result__tile .result__gain', rs);
    RS.zz = $('.result__zz', rs);
    if (RS.zz) { const to = tileOf(RS.tiles, PAIR.abstain); if (!to.contains(RS.zz)) $('.result__tile-av', to).appendChild(RS.zz); }
    // minis: one per vote, the voter's own face, in the target tile (the capture's own .result__mini)
    const miniProto = $('.result__mini', rs);
    RS.tiles.forEach(tl => $$('.result__mini', tl).forEach(m => m.remove()));
    RS.minis = PAIR.votes.map(([voter, target]) => {
      const m = miniProto.cloneNode(false); m.innerHTML = KIT.avatar(CODES[voter], { size: 22 });
      $('.result__minis', tileOf(RS.tiles, target)).appendChild(m); return m;
    });
    // vote counts: the tally's own badge (the gains state drops them)
    const targets = [...new Set(PAIR.votes.map(v => v[1]))];
    RS.counts = targets.map(n => { const c = document.createElement('span'); c.className = 'result__count num'; $('.result__tile-av', tileOf(RS.tiles, n)).appendChild(c); return [n, c]; });
    const tmp = document.createElement('div');
    tmp.innerHTML = window.SCREENS.s3_esc0.replace(/(\sid=")([^"]+)"/g, '$1x0__$2"').replace(/url\(#([^)]+)\)/g, 'url(#x0__$1)').replace(/href="#([^"]+)"/g, 'href="#x0__$1"');
    RS.myst = $('.result__fig', tmp); RS.figfit.insertBefore(RS.myst, RS.figfit.firstChild);
    RS.votesSay = $('.result__sayin', tmp); RS.say.appendChild(RS.votesSay);
    RS.votesSay.style.cssText += ';position:absolute;left:0;right:0;top:0';
    RS.dots = $('.dots', RS.votesSay);
    // fx: our four stickers (the game's sticker and chip styles), your face peeking in, the flying reactions
    const F = (E.F = {});
    F.pov = mk('div', 's3ss', KIT.fx, `<span class="sticker s3pov" style="--tilt:-4deg">${STICK.pov}</span>`);
    F.notYet = mk('div', 's3ss', KIT.fx, `<span class="chip s3chip">${STICK.notYet}</span>`);
    F.others = mk('div', 's3ws', KIT.fx, `<span class="sticker sticker--white s3others" style="--tilt:2deg">${STICK.others}</span>`);
    F.hurry = mk('div', 's3ss', KIT.fx, `<span class="sticker sticker--yellow s3hurry" style="--tilt:-5deg">${STICK.hurry}</span>`);
    F.peek = mk('div', 's3ws', KIT.fx, KIT.avatar(CODES[PAIR.plant], { size: 66, mood: 'shock' }));
  }

  // ───────────────────────────── measure: the finger's path and what it lights ─────────────────────────────
  const HAND = { knots: [], taps: [], holds: [], win: [] };
  let STEPS = [];                                                    // STEPS[k] = time the value reaches k+1
  const barX = i => center(M(E.A.bars[i]))[0];
  function measure() {
    const A = E.A, by = M(A.bars[0]).y + 76, lock = center(M(A.lock));
    const x0 = barX(PAIR.from - 1), x1 = barX(PAIR.mine - 1);
    HAND.knots = [
      { t: T.fIn, x: x0 + 150, y: by + 300 },
      { t: T.touch - 0.32, x: x0 + 22, y: by + 22 },
      { t: T.touch - 0.08, x: x0 + 4, y: by + 3 },
      { t: T.touch, x: x0, y: by },
      { t: T.touch + 0.22, x: lerp(x0, x1, 0.2), y: by - 2 },        // a slide that speeds up, then settles on 10
      { t: T.touch + 0.5, x: lerp(x0, x1, 0.6), y: by - 4 },
      { t: T.touch + 0.72, x: lerp(x0, x1, 0.93), y: by - 3 },
      { t: T.slideEnd, x: x1, y: by - 2 },
      { t: T.lift + 0.06, x: x1 + 6, y: by + 8 },
      { t: T.tapLock - 0.3, x: lock[0] + 40, y: lock[1] - 20 },
      { t: T.tapLock - 0.1, x: lock[0] + 26, y: lock[1] - 3 },
      { t: T.tapLock, x: lock[0] + 20, y: lock[1] },
      { t: T.fOut, x: lock[0] + 150, y: lock[1] + 250 },
    ];
    HAND.taps = [T.touch, T.tapLock]; HAND.holds = [[T.touch, T.lift]]; HAND.win = [[T.fIn, T.fOut]];
    // the value under the finger, as it slides (sampled once, so it only ever counts up)
    const xs = M(A.bars[0]), step = barX(0) - barX(1);
    STEPS = []; let v = 0;
    for (let t = T.touch; t <= T.lift + 1e-9; t += 1 / 480) {
      const x = OM.cursor(t, HAND.knots).x;
      const u = clamp(Math.round((barX(0) - x) / step) + 1, 1, PAIR.max);
      while (u > v) { v++; STEPS.push(v <= PAIR.from ? T.touch : t); }
    }
    while (STEPS.length < PAIR.mine) STEPS.push(T.slideEnd);
    void xs;
  }
  const valueAt = t => STEPS.filter(s => t >= s).length;

  // ───────────────────────────── camera ─────────────────────────────
  function camera() {
    const yc = M(E.R.cells[E.R.me]);
    const ex = ease;
    return {
      keys: [
        { t: 0, ...Pt(215, 260, 1.08) },
        { t: 0.95, ...Pt(215, 266, 1.08), curve: ex.sineInOut },
        { t: 1.92, ...Pt(215, 428, 1.0), curve: ex.cubicInOut },
        { t: 2.95, ...Pt(215, 432, 1.0), curve: ex.sineInOut },
        { t: 3.4, ...Pt(215, 640, 1.0), curve: ex.cubicInOut },
        { t: 3.6, ...Pt(215, 642, 1.0), curve: ex.sineInOut },
        { t: 3.96, ...Pt(215, 380, 1.08), curve: ex.cubicInOut },
        { t: 5.6, ...Pt(215, 384, 1.08) },
        { t: 7.08, ...Pt(215, 470, 1.08), curve: ex.sineInOut },
        { t: 7.22, ...Pt(215, 474, 1.08), curve: ex.sineInOut },
        { t: 7.98, ...Fr(yc, 1.55), curve: ex.cubicInOut },
        { t: 8.42, ...Fr(yc, 1.5, 0, -8), curve: ex.sineInOut },
        { t: 8.98, ...Pt(215, 430, 0.9), curve: ex.cubicInOut },
        { t: 10.74, ...Pt(215, 432, 0.9) },
        { t: 11.14, ...Pt(215, 631, 0.95), curve: ex.cubicInOut },
        { t: 11.74, ...Pt(215, 626, 0.95), curve: ex.sineInOut },
        { t: 12.04, ...Pt(215, 240, 1.25), curve: ex.expoOut },
        { t: 12.62, ...Pt(215, 256, 1.2), curve: ex.sineInOut },
        { t: 13.45, ...Pt(215, 410, 1.05), curve: ex.cubicInOut },
        { t: T.end0, ...Pt(215, 410, 1.05) },
      ],
      hits: [[T.tapLock + 0.02, 5, 12], [T.twist + 0.02, 14, 9], [T.flip[PAIR.plant] + 0.02, 14, 9], [T.hurry + 0.02, 6, 11], [T.verdict, 18, 8]],
      rests: [[0, 0.95], [T.touch + 0.05, 2.95], [3.96, 5.6], [8.05, 8.4], [9.05, 10.74], [13.5, T.end0]],
    };
  }

  // a sticker in screen space: centred on frame point (fx, fy), constant size on the frame whatever the camera does
  function screenPut(el, t, fxp, fyp, A) {
    const Mv = OM.view(KIT.camAt(t), { W, H });
    const [wx, wy] = OM.unproject(Mv, fxp, fyp);
    const z = Math.hypot(Mv[0], Mv[1]), rot = Math.atan2(Mv[1], Mv[0]) * 180 / Math.PI;
    put(el, { op: A.op ?? 1, base: `translate(${fix(wx / G)}px,${fix(wy / G)}px) rotate(${fix(-rot, 3)}deg) scale(${fix(1 / z, 4)}) translate(${fix(A.x || 0)}px,${fix(A.y || 0)}px) rotate(${fix(A.r || 0, 2)}deg) scale(${fix(A.s ?? 1, 4)}) translate(-50%,-50%)` });
  }
  // a sticker riding the world: centred on game point (gx, gy)
  function worldPut(el, gx, gy, A) {
    put(el, { op: A.op ?? 1, base: `translate(${fix(gx + (A.x || 0))}px,${fix(gy + (A.y || 0))}px) rotate(${fix(A.r || 0, 2)}deg) scale(${fix(A.s ?? 1, 4)}) translate(-50%,-50%)` });
  }

  // ───────────────────────────── update ─────────────────────────────
  function uAnswer(t) {
    const A = E.A, vis = t < T.twist + 0.5; on(KIT.S.answer, vis); if (!vis) return;
    hide(A.header);
    // the card, then its flip at the twist (the reveal's hero card is its other side)
    const fk = (u => u * u)(seg(t, T.twist, T.heroIn));
    put(A.q, { op: t >= T.heroIn ? 0 : 1, base: `perspective(1100px) rotateY(${fix(90 * fk, 2)}deg) rotate(-1.3deg)` });
    put(A.hint, { base: '' });
    // the scale: the finger lights the bars one by one, the tile counts up
    const v = valueAt(t), vT = v ? STEPS[v - 1] : 0;
    const out = (i) => life(t, -1, {}, 'pop', {}, T.morph + i * 0.03, 0.26, { y: 46, s: 0.94, op: 0 });
    A.bars.forEach((b, i) => {
      const lit = v >= i + 1, top = v === i + 1;
      cls(b, 'is-on', lit); cls(b, 'is-top', top);
      put(A.barI[i], { sy: lit ? 1 + pulse(t, STEPS[i], 0.14, 11, 30) : 0.86, base: '' });
    });
    put(A.meter, out(0));
    A.ends.forEach((c, i) => {
      const champ = i === 1 && v >= PAIR.max;
      cls(c, 'chip--dark', !champ); cls(c, 'chip--yellow', champ);
      const st = out(1);
      put(c, { ...st, s: (st.s ?? 1) * (1 + (champ ? pulse(t, STEPS[PAIR.max - 1], 0.3, 6, 20) : 0)) });
    });
    txt(A.val, v ? String(v) : '?'); cls(A.val, 'is-empty', !v);
    put(A.val, { s: v ? 1 + pulse(t, vT, 0.24, 10, 26) : 1, base: '' });
    put(A.read, t >= T.morph ? { op: 0 } : { s: v ? 1 + pulse(t, vT, 0.05, 10, 26) : 1 });
    // lock: enabled once there is a value, pressed, then the game's foot after locking
    attr(A.lock, 'disabled', v ? null : '');
    cls(A.lock, 'is-pressed', press(t, T.tapLock, 0.14));
    put(A.lock, { op: 1 - sstep(T.btnSwap - 0.02, T.btnSwap + 0.08, t), y: press(t, T.tapLock, 0.14) ? 3 : 0 });
    // the waiting row: your tick lands; then the whole foot drops away at the twist
    const mk_ = K(t, T.tick, 'pop');
    put(A.me, t < T.tick ? { s: 0.88, op: 0.5 } : { s: lerp(0.88, 1, mk_), op: lerp(0.5, 1, clamp(mk_ * 2)) });
    put(A.meTick, { s: t < T.tick ? 0 : mk_, op: t < T.tick ? 0 : 1, base: '' });
    html(A.whoLine, t < T.tick ? 'מחכים <span>לכם</span><span>, לאיתי</span><span> ולדנה</span>' : 'מחכים <span>לאיתי</span><span> ולדנה</span>');
    put(A.foot, life(t, -1, {}, 'pop', {}, T.twist, 0.28, { y: 90, op: 0 }));
  }

  function uLocked(t) {
    const LK = E.LK, vis = t >= T.morph - 0.02 && t < T.dive1 + 0.05; on(KIT.S.answered, vis); if (!vis) return;
    LK.hide.forEach(hide);
    // the yellow tile grows into the locked card, then the card dives into your face-down cell at the twist
    const tile = M(E.A.read), self = M(LK.card), cell = M(E.R.cells[E.R.me]);
    const k = K(t, T.morph, 'pop');
    let v = lerpRect(tile, self, k), op = 1, r = lerp(-3, 0, clamp(k));
    if (t >= T.dive0) { const kd = cubicIn(seg(t, T.dive0, T.dive1)); v = lerpRect(self, cell, kd); op = 1 - sstep(0.8, 1, kd); r = lerp(0, 6, kd); }
    put(LK.card, { ...toRect(self, v, false), r, op });
    put(LK.stamp, t < T.stamp ? { op: 0 } : { s: lerp(2.2, 1, K(t, T.stamp)), r: lerp(-30, 0, K(t, T.stamp)), op: clamp(K(t, T.stamp) * 3) });
    put(LK.btn, t < T.btnSwap ? { op: 0 } : { ...life(t, T.btnSwap, { s: 0.94 }, 'soft', {}, T.twist, 0.25, { y: 90, op: 0 }) });
  }

  function uReveal(t) {
    const R = E.R, vis = t >= T.twist - 0.02 && t < T.vote1 + 0.1; on(KIT.S.reveal, vis); if (!vis) return;
    hide(R.header); hide(R.q); R.foot.forEach(hide); hide(R.eggplant);
    const out = sstep(T.vote0 - 0.05, T.vote0 + 0.2, t);
    // the title: "השאלה האמיתית" gives way to the discussion's "מי פה משקר?"
    const tk = K(t, T.title, 'pop'), dk = sstep(T.discuss - 0.06, T.discuss + 0.14, t);
    put(R.head, t < T.title ? { op: 0 } : { y: lerp(-34, 0, tk), s: lerp(0.7, 1, tk) * (1 - 0.3 * dk), op: clamp(tk * 2) * (1 - dk) });
    // the hero card: the answer card's other side, flipping in where the answer card was, then settling under the title
    const hc = M(R.heroCard), aq = M(E.A.q);
    const R1 = { x: aq.x, y: 133, w: aq.w, h: hc.h * aq.w / hc.w };
    const R0 = { x: aq.x, y: aq.y + aq.h / 2 - R1.h / 2, w: aq.w, h: R1.h };
    const hk = K(t, T.heroIn, 'pop'), mk_ = K(t, T.heroIn + 0.06, 'soft');
    const v = lerpRect(R0, R1, mk_), st = toRect(hc, v, true);
    const ry = t < T.heroIn ? 90 : lerp(-90, 0, clamp(hk, 0, 1.1));
    put(R.heroCard, { op: t < T.heroIn ? 0 : 1 - out, base: `translate(${fix(st.x)}px,${fix(st.y - 30 * out)}px) scale(${fix(st.sx, 4)}) perspective(1100px) rotateY(${fix(ry, 2)}deg) rotate(${fix(lerp(-1.3, -1.6, clamp(mk_)), 3)}deg)` });
    // the cells arrive face down, flip on the beats (yours last), and at the vote shrink into the board's tiles
    R.cells.forEach((c, i) => {
      const n = R.name[i], big = n === PAIR.plant, tf = T.flip[n], ta = T.cells0 + i * 0.05;
      const ck = K(t, ta, 'pop');
      const fk = t < tf ? 0 : spring(t - tf, big ? 0.5 : 0.6, big ? 20 : 26);
      put(R.flips[i], { ry: lerp(180, 0, clamp(fk, 0, 1.08)), base: '' });
      let s = lerp(0.5, 1, ck);
      if (big && t >= T.dive1 - 0.04) s *= 1 + pulse(t, T.dive1 - 0.04, 0.1, 10, 26);        // your answer lands in it
      if (t >= tf) s *= 1 + (big ? pulse(t, tf, 0.16, 6, 20) : pulse(t, tf, 0.06, 10, 28));
      let st = t < ta ? { op: 0 } : { s, op: clamp(ck * 2) };
      if (t >= T.vote0) {
        const self = M(c), tile = M(E.RS.tiles[E.RS.tileName.indexOf(n)]);
        const kv = ease.cubicInOut(seg(t, T.vote0 + i * 0.03, T.vote1 - 0.12 + i * 0.03));
        st = { ...toRect(self, lerpRect(self, tile, kv), false), op: 1 - sstep(0.7, 0.95, kv) };
      }
      put(c, st);
      if (big) put(R.figs[i], t < tf ? { base: '' } : { s: 1 + 1.2 * Math.max(0, 1 - spring(t - tf - 0.05, 0.42, 18)), base: '' });
    });
    // the reactions bar (no 🍆), its buttons kick as the reactions leave
    put(R.reacts, life(t, T.bar, { y: 80 }, 'soft', {}, T.vote0 - 0.05, 0.25, { y: 90, op: 0 }));
    R.reactBtns.forEach(b => {
      const j = EMO.findIndex(e => R.reactAt(e) === b), te = j >= 0 ? T.emoji[j] : null;
      put(b, b === R.eggplant ? { op: 0 } : { y: te != null && t >= te ? 3 * Math.max(0, pulse(t, te, 1, 14, 30)) : 0, s: te != null ? 1 + pulse(t, te, 0.15) : 1 });
    });
  }
  const EMO = ['🤨', '👀', '😂', '💀'];

  function uDiscuss(t) {
    const D = E.D, vis = t >= T.discuss - 0.1 && t < T.vote1; on(KIT.S.discuss, vis); if (!vis) return;
    D.hide.forEach(hide);
    const k = K(t, T.discuss, 'bouncy');
    put(D.head, t < T.discuss ? { op: 0 } : { s: lerp(1.6, 1, k) * (1 - 0.3 * sstep(T.vote0 - 0.05, T.vote0 + 0.2, t)), r: lerp(6, 0, k), op: clamp(k * 3) * (1 - sstep(T.vote0 - 0.05, T.vote0 + 0.15, t)) });
  }

  function uResult(t) {
    const RS = E.RS, vis = t >= T.vote0 && t < T.end0 + 0.75; on(KIT.S.result, vis); if (!vis) return;
    hide(RS.header); hide(RS.foot); RS.gains.forEach(hide);
    // the tally: the mystery figure and "השתול הוא…", until the figure drops
    put(RS.myst, t < T.myst ? { op: 0 } : t < T.figDrop ? { s: lerp(0.5, 1, K(t, T.myst, 'bouncy')), op: 1 } : { s: 1 - 0.6 * seg(t, T.figDrop, T.figDrop + 0.15), op: 1 - seg(t, T.figDrop, T.figDrop + 0.12) });
    put(RS.votesSay, life(t, T.say, { y: 20, s: 0.7 }, 'pop', {}, T.figDrop, 0.15, { op: 0, s: 0.8 }));
    cssv(RS.dots, '--dots', `"${'.'.repeat(t < T.say + 0.2 ? 0 : clamp(1 + Math.floor((t - T.say - 0.2) / 0.22), 1, 3))}"`);
    // you drop in, smug; "ברח!" stamps on; the rays turn
    const fk = spring(t - T.figDrop, 0.5, 16);
    put(RS.fig, t < T.figDrop ? { op: 0 } : { y: lerp(-380, 0, clamp(fk, 0, 1.2)), s: lerp(1.15, 1, clamp(fk)), r: lerp(-16, 0, clamp(fk)), op: 1 });
    const land = T.verdict, im = OM.impact(t, land, { decay: 7, omega: 22, sqx: 0.18, sqy: 0.22 });
    put(RS.squash, t < land ? { base: '' } : { sx: im.sx, sy: im.sy, base: '' });
    KIT.wobble(t, RS.wob, T.verdict + 0.3);
    put(RS.rays, t < T.verdict - 0.05 ? { op: 0 } : { s: lerp(0.2, 1, K(t, T.verdict - 0.05, 'soft')), r: KIT.rayAngle(t) * 2, op: 1, base: '' });
    put(RS.verdict, t < T.verdict ? { op: 0 } : { s: lerp(2.4, 1, K(t, T.verdict, 'pop')), r: lerp(-20, 0, K(t, T.verdict, 'pop')), op: clamp(K(t, T.verdict) * 3) });
    // the plate, then the line and its +300
    put(RS.sayin, { base: '' });
    put(RS.plate, t < T.plate ? { op: 0 } : { s: lerp(0.3, 1, K(t, T.plate, 'bouncy')), r: lerp(-12, 0, K(t, T.plate)), op: clamp(K(t, T.plate) * 3) });
    put(RS.line, life(t, T.line, { y: 18, s: 0.8 }, 'pop'));
    put(RS.lineGain, t < T.gain ? { op: 0 } : { s: lerp(0.2, 1, K(t, T.gain, 'bouncy')), op: 1, base: '' });
    // the card rises: tag, your question, your 10, everyone else's question
    const ck = K(t, T.card0, 'soft');
    put(RS.cardwrap, t < T.card0 ? { op: 0 } : { y: lerp(260, 0, ck), r: lerp(4, 0, ck), op: clamp(ck * 2) });
    put(RS.tag, t < T.tag ? { op: 0 } : { s: lerp(2, 1, K(t, T.tag)), r: lerp(-14, 0, K(t, T.tag)), op: 1, base: '' });
    put(RS.fake, life(t, T.fake, { y: 18 }, 'pop'));
    put(RS.answerRow, life(t, T.bubble - 0.1, { y: 10 }, 'soft'));
    put(RS.bubble, t < T.bubble ? { op: 0 } : { s: lerp(0.3, 1, K(t, T.bubble, 'bouncy')), op: clamp(K(t, T.bubble) * 2), base: '' });
    put(RS.real, life(t, T.real, { y: 12 }, 'soft'));
    // the board: tiles take over from the answer cards, the voters' faces fly in, the counts tick, the pick lights up
    const tileIn = T.vote1 - 0.2;
    const lit = t >= T.lit && t < T.verdict;
    RS.tiles.forEach((tl, i) => {
      const n = RS.tileName[i], ti = tileIn + i * 0.03;
      put(tl, t < ti ? { op: 0 } : { op: sstep(ti, ti + 0.12, t), s: lit && n === 'תומר' ? 1 + 0.06 * K(t, T.lit) : 1 });
      cls(tl, 'is-lit', lit && n === 'תומר'); cls(tl, 'is-dim', lit && n !== 'תומר');
      cls(tl, 'is-mole', n === PAIR.plant && t >= T.verdict);
    });
    put(RS.board, { op: t < tileIn ? 0 : 1, y: t >= T.verdict ? 6 * pulse(t, T.verdict, 1, 9, 30) : 0 });
    RS.minis.forEach((mi, j) => {
      const [voter] = PAIR.votes[j], t0 = T.minis0 + j * T.miniStep, t1 = t0 + 0.34;
      if (t < t0) { put(mi, { op: 0 }); return; }
      const self = M(mi), from = M($('.result__tile-av', RS.tiles[RS.tileName.indexOf(voter)]));
      const k = ease.cubicInOut(seg(t, t0, t1));
      const [x, y] = arcPt(center(from), center(self), k, 60);
      const s = k < 1 ? lerp(50 / 22, 1, k) * lerp(1, 1.25, Math.sin(Math.PI * k)) : 1 + pulse(t, t1, 0.35, 10, 26);
      put(mi, { x: x - center(self)[0], y: y - center(self)[1], s, op: 1, base: '' });
    });
    RS.counts.forEach(([n, c]) => {
      const lands = PAIR.votes.map((v, j) => (v[1] === n ? T.minis0 + j * T.miniStep + 0.34 : null)).filter(x => x != null);
      const got = lands.filter(x => t >= x).length;
      txt(c, String(got));
      put(c, got ? { s: lerp(0.3, 1, K(t, lands[0], 'bouncy')) * (1 + pulse(t, lands[got - 1], 0.3)), op: 1, base: '' } : { op: 0 });
    });
    if (RS.zz) put(RS.zz, t < T.zz ? { op: 0 } : { s: K(t, T.zz, 'bouncy'), op: 1, base: '' });
  }

  function uStickers(t) {
    const F = E.F;
    // "POV: אתם השתול" (frame 0 already has it landing) and the chip under it: they ride the world above the card,
    // so the camera's drift down to the bars carries them off the top of the frame (gone once they are out of it)
    const pk = K(t, T.pov, 'pop'), pOut = cubicIn(seg(t, T.stickOut, T.stickOut + 0.22));
    worldPut(F.pov, 215, POVY, { s: lerp(1.9, 1, pk) * (1 - 0.25 * pOut), r: lerp(-14, 0, pk) - 8 * pOut, y: -70 * pOut, op: clamp(pk * 3) * (1 - pOut) });
    const nk = K(t, T.notYet, 'pop'), nOut = cubicIn(seg(t, T.stickOut - 0.08, T.stickOut + 0.12));
    worldPut(F.notYet, 215, POVY + 45, t < T.notYet ? { op: 0 } : { s: lerp(0.4, 1, nk) * (1 - 0.25 * nOut), r: lerp(8, 2, nk), y: -50 * nOut, op: clamp(nk * 2) * (1 - nOut) });
    // "כל השאר נשאלו משהו אחר": rides the big card's bottom edge, under its text
    const R1y = 133 + M(E.R.heroCard).h * M(E.A.q).w / M(E.R.heroCard).w;
    const ok = K(t, T.others, 'pop'), oOut = cubicIn(seg(t, T.othersOut, T.othersOut + 0.2));
    worldPut(F.others, 215, R1y + 2, t < T.others ? { op: 0 } : { s: lerp(2.0, 1, ok) * (1 - 0.4 * oOut), r: lerp(-10, 0, ok), op: clamp(ok * 3) * (1 - oOut) });
    // your face peeks in at the card's corner, sweating
    const qk = K(t, T.peek, 'soft'), qOut = cubicIn(seg(t, T.peekOut, T.peekOut + 0.3));
    worldPut(F.peek, lerp(-40, 40, qk) - 90 * qOut, R1y - 22, t < T.peek ? { op: 0 } : { r: lerp(40, 16, qk) + 3 * Math.sin((t - T.peek) * 5), op: t > T.peekOut + 0.3 ? 0 : 1 });
    // "מהר, תאלתרו תירוץ!": stamped in the middle of the frame
    const hk = K(t, T.hurry, 'pop'), hOut = cubicIn(seg(t, T.hurryOut, T.hurryOut + 0.2));
    screenPut(F.hurry, t, 540, 900, t < T.hurry ? { op: 0 } : { s: lerp(2.4, 1, hk) * (1 - 0.5 * hOut), r: lerp(-16, 0, hk), op: clamp(hk * 3) * (1 - hOut) });
  }

  function update(t) {
    uAnswer(t); uLocked(t); uReveal(t); uDiscuss(t); uResult(t); uStickers(t);
  }

  // ───────────────────────────── fx parts ─────────────────────────────
  // the film's finger, plus holds (pressed while it slides: no ripple until it lifts)
  const FG = {};
  KIT.part({
    build() { FG.f = mk('div', 'finger'); FG.rp = mk('div', 'ripple'); },
    update(t) {
      let op = 0;
      for (const [a, b] of HAND.win) op = Math.max(op, sstep(a, a + 0.14, t) * (1 - sstep(b - 0.18, b, t)));
      if (op <= 0.001) { hide(FG.f); hide(FG.rp); return; }
      const c = OM.cursor(t, HAND.knots, HAND.taps, { down: 0.82, hold: 0.12 });
      let s = c.s; for (const [a, b] of HAND.holds) if (t >= a && t < b) s = 0.84 + 0.02 * sstep(a, a + 0.1, t);
      put(FG.f, { base: `translate(${fix(c.x)}px,${fix(c.y)}px) scale(${fix(s, 3)})`, op });
      let last = null; for (const tp of HAND.taps) if (t >= tp && t < tp + 0.4) last = tp;
      if (last == null) { hide(FG.rp); return; }
      const k = seg(t, last, last + 0.4), p = OM.cursor(last, HAND.knots);
      put(FG.rp, { base: `translate(${fix(p.x)}px,${fix(p.y)}px) scale(${fix(1 + 1.6 * ease.cubicOut(k), 3)})`, op: (1 - k) * 0.9 * op });
    },
    track(box) { box('finger', FG.f); },
  });
  KIT.sweat(() => { const y = 133 + M(E.R.heroCard).h * M(E.A.q).w / M(E.R.heroCard).w; return [{ t0: T.peek + 0.3, t1: T.peek + 1.1, x: 40, y: y - 52, style: 'bead' }]; });
  KIT.emoji(() => {
    const R = E.R, yc = M(R.cells[R.me]);
    return EMO.map((ch, i) => ({ t0: T.emoji[i], ch, i, from: center(M(R.reactAt(ch))), to: [yc.x + yc.w / 2 + (i - 1.5) * 44, yc.y - 20 - (i % 2) * 34] }));
  });
  KIT.confetti(() => { const f = M(E.RS.figbox); return { t0: T.verdict + 0.02, x: f.x + f.w / 2, y: f.y + 60, seed: 53, n: 80 }; });

  // ───────────────────────────── sound ─────────────────────────────
  function events() {
    const c = el => center(M(el)), A = E.A, R = E.R, RS = E.RS;
    ev(0.0, 'pop', 215, 30, 0.8); ev(0.02, 'shutter', 215, 30, 0.35);
    ev(T.notYet + 0.02, 'pop', 215, 70, 0.5);
    ev(T.fIn + 0.1, 'swish', 300, 700, 0.3);
    ev(T.touch, 'tap', ...c(A.bars[PAIR.from - 1]), 0.8);
    STEPS.forEach((s, i) => { if (i >= PAIR.from) ev(s, 'type', ...c(A.bars[i]), 0.5 + 0.05 * (i - PAIR.from)); });
    ev(STEPS[PAIR.max - 1] + 0.04, 'ding', ...c(A.ends[1]), 0.6);
    ev(T.stickOut, 'swish', 215, 0, 0.3);
    ev(T.tapLock, 'lock', ...c(A.lock), 1);
    ev(T.morph + 0.02, 'swish', 215, 420, 0.5); ev(T.stamp + 0.02, 'stamp_soft', ...c(E.LK.stamp), 0.6);
    ev(T.tick, 'check', ...c(A.me), 0.6);
    ev(T.twist, 'boom', 215, 160, 1); ev(T.twist + 0.02, 'flip', 215, 160, 0.9); ev(T.title + 0.05, 'title', 215, 100, 0.7);
    ev(T.dive0 + 0.05, 'swish', 300, 500, 0.5);
    R.cells.forEach((cell, i) => ev(T.cells0 + i * 0.05, 'cell', ...c(cell), 0.45));
    ev(T.others, 'stamp_soft', 215, 260, 0.7); ev(T.peek + 0.1, 'gulp', 20, 240, 0.9); ev(T.peek + 0.45, 'drip', 30, 220, 0.6);
    ORDER.forEach((n, i) => ev(T.flip[n], n === PAIR.plant ? 'reveal_big' : 'flip', ...c(R.cells[R.name.indexOf(n)]), 0.55 + i * 0.08));
    ev(7.5, 'heartbeat', 215, 600, 0.6);
    ev(T.flip[PAIR.plant] + 0.08, 'crowd_oooh_b', ...c(R.cells[R.me]), 1);
    T.emoji.forEach((te, i) => ev(te, 'react', ...c(R.reactAt(EMO[i])), 0.7));
    ev(T.discuss, 'title', 215, 100, 0.7);
    ev(T.hurry, 'stamp', 215, 430, 1);
    ev(T.vote0 + 0.02, 'whoosh', 215, 600, 0.7); ev(T.say + 0.02, 'title', 215, 440, 0.5);
    PAIR.votes.forEach(([, to], j) => ev(T.minis0 + j * T.miniStep + 0.34, 'mini', ...c(tileOf(RS.tiles, to)), 0.55 + 0.05 * j));
    ev(T.lit, 'roulette', ...c(tileOf(RS.tiles, 'תומר')), 0.8);
    ev(T.figDrop, 'drop', 215, 120, 0.9);
    ev(T.verdict, 'verdict', 130, 120, 1); ev(T.verdict + 0.04, 'crowd_cheer_b', 215, 250, 0.9); ev(T.verdict + 0.03, 'confetti', 215, 200, 0.8);
    ev(T.plate + 0.03, 'pop', 215, 320, 0.5);
    ev(T.gain, 'coins', ...c(RS.lineGain), 0.8);
    ev(T.card0, 'swish', 215, 500, 0.8); ev(T.tag, 'stamp_soft', ...c(RS.tag), 0.6); ev(T.bubble, 'pop', ...c(RS.bubble), 0.7);
    ev(T.bubble + 0.12, 'crowd_laugh_b', 215, 480, 0.9);
    ev(T.real + 0.03, 'pop', 215, 570, 0.35);
  }

  // plan C (MUSIC.md §3) + this short's stops: the hard stop before the twist, a thin 4–7.6, the breath before your
  // card, and a breath before "ברח!"
  const music = {
    segments: [{ t0: 0, t1: 4, track: 0.557 }, { t0: 4, t1: 12, track: 12.557 }, { t0: 12, t1: 18, track: 35.557 }],
    sections: [[7.45, 0.72]], gain: 0.26, nudge: 0.03,
    stops: [[3.7, 4.0], [7.6, 8.0], [11.6, 12.0]],
    thin: [[4.1, 7.6]],
  };

  KIT.run({
    T, build, measure, camera, update, events, music,
    track: box => {
      const F = E.F;
      box('pov', $('.sticker', F.pov)); box('notyet', $('.chip', F.notYet)); box('others', $('.sticker', F.others)); box('hurry', $('.sticker', F.hurry));
      box('question', E.A.q); box('tile', E.A.read); box('ends', E.A.ends[1]); box('herocard', E.R.heroCard); box('title', E.R.head); box('discuss', E.D.head);
      box('yuvalcell', E.R.cells[E.R.me]); box('verdict', E.RS.verdict); box('line', E.RS.line); box('card', E.RS.cardwrap);
    },
  });
})();
