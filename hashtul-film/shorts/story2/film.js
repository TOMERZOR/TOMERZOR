/* השתול · Instagram story 2: "בקרוב ב־App Store" (8.0 s, 1080×1920). Sibling of shorts/story/ ("the site is live").
 * A calm announcement in the game's look: the camera is locked off (no hand-held float), one tiny shake when the icon
 * lands. The app icon drops in, its "בקרוב" tag stamps on, the wordmark and title land, three chips pop, then a hand of
 * the game's question cards fans out from behind the icon, the pink one on the music's final crash (6.0), with confetti.
 * Every frame is a pure function of t. Positions: game px of one 432×768 frame (zoom 1; 1 game px = 2.5 frame px).
 */
(function () {
  'use strict';
  const { mk, put, life, lerp, clamp, seg, sstep, pulse, K, M, Pt, center, ev, ease, fix, OM } = KIT;

  // ── the copy ──
  const COPY = {
    tag: 'בקרוב',
    word: 'השתול',
    title: 'בקרוב ב־<span dir="ltr">App Store</span>',            // Latin isolated inside the Hebrew line
    chips: ['עוד שאלות', 'שאלות שלא חוזרות', 'שני סגנונות חדשים'],
    line: 'בינתיים? משחקים באתר.',
    url: 'hashtul.onrender.com',
  };

  // ── timeline (s): beats every 0.5; the track's final crash on 6.0 ──
  const T = {
    drop0: 0.5, land: 1.0, tag: 1.5, title: 2.0, chips: [3.0, 3.5, 4.0],   // the wordmark stands from frame 0
    cards: [5.0, 5.3, 5.54, 5.7, 5.8, 5.86, 5.9],                  // faster and faster; the last (pink) snaps out onto the crash
    crash: 6.0, line: 6.4, url: 6.62, still: 7.6, dur: 8.0,
  };

  // ── layout (game px) ──
  const IC = { x: 216, y: 200 };                                     // the icon's centre (144 px: 360 frame px)
  const ROWS = { mark: 280, title: 365, chips: [426, 473, 520], line: 573, url: 604 };
  // the hand of cards: angle from straight up (deg), order of appearance; the pink one is straight up, last
  const FAN = [{ a: 27 }, { a: -27 }, { a: 54 }, { a: -54 }, { a: 80 }, { a: -80 }, { a: 0, pink: true }];
  const FAN_R = 112;

  // ── build ──
  const E = {};
  const CARD = '<div class="answer__q card"><span class="answer__q-mark" aria-hidden="true"><i>?</i></span></div>';
  function build() {
    const root = (E.root = mk('div', '', KIT.fx)); root.id = 'st2';
    E.rays = mk('div', 'st2rays', root); E.rays.style.left = IC.x + 'px'; E.rays.style.top = IC.y + 'px';
    // confetti behind the cards, the icon and every line of text (DOM, so it can sit behind them)
    E.conf = mk('div', 'st2conf', root); E.conf.style.left = IC.x + 'px'; E.conf.style.top = (IC.y - 30) + 'px';
    const rng = OM.rng(61), cols = ['#ffd23f', '#ff3d9a', '#43d97b', '#6ad1ff', '#ff6b4a', '#b9a0ff'];
    E.bits = [];
    for (let i = 0; i < 64; i++) {
      const b = { x: (rng() - 0.5) * 90, vx: (rng() - 0.5) * 2.6, vy: -0.75 - rng() * 0.9, rot: rng() * 6, vr: (rng() - 0.5) * 14,
        w: 6 + rng() * 8, h: 4 + rng() * 4, d: rng() * 0.1 };
      b.el = mk('i', '', E.conf); b.el.style.width = fix(b.w) + 'px'; b.el.style.height = fix(b.h) + 'px'; b.el.style.background = cols[i % cols.length];
      E.bits.push(b);
    }
    E.cards = FAN.map(f => { const c = mk('div', 'st2card' + (f.pink ? ' is-pink' : ''), root, CARD); c.style.left = IC.x + 'px'; c.style.top = IC.y + 'px'; return c; });
    E.slot = mk('div', 'st2slot', root, '?'); E.slot.style.left = IC.x + 'px'; E.slot.style.top = IC.y + 'px';
    E.shadow = mk('div', 'st2shadow', root); E.shadow.style.left = IC.x + 'px'; E.shadow.style.top = (IC.y + 7) + 'px';
    E.icon = mk('div', 'st2icon', root, `<div class="face">${window.ST2_ICON}</div>`); E.icon.style.left = IC.x + 'px'; E.icon.style.top = IC.y + 'px';
    // the tag, pinned to the icon's top-left corner
    const tw = mk('div', 'st2tag', root); tw.style.left = (IC.x - 100) + 'px'; tw.style.top = (IC.y - 82) + 'px';
    E.tag = mk('span', 'sticker sticker--yellow', tw, COPY.tag); E.tag.__base = 'rotate(-13deg)';
    // the wordmark (the end card's), letters as spans so they can drop
    const mw = mk('div', 'st2mark', root); mw.style.top = ROWS.mark + 'px';
    E.mark = mk('div', 'wordmark', mw); E.mark.__base = 'rotate(-4deg) skew(-6deg)';
    E.letters = Array.from(COPY.word).map(ch => mk('span', 'ltr', E.mark, ch));
    const tl = mk('div', 'st2row st2title', root); tl.style.top = ROWS.title + 'px';
    E.title = mk('h1', 'title title--white', tl, COPY.title); E.title.__base = 'rotate(-2deg)';
    const kinds = ['sticker sticker--white', 'sticker sticker--mint', 'sticker'], tilts = [-3, 2.5, -2];
    E.chips = COPY.chips.map((c, i) => {
      const r = mk('div', 'st2row st2chip', root); r.style.top = ROWS.chips[i] + 'px';
      const s = mk('span', kinds[i], r, c); s.style.setProperty('--tilt', tilts[i] + 'deg'); return s;
    });
    const lw = mk('div', 'st2row', root); lw.style.top = ROWS.line + 'px'; E.line = mk('span', 'st2line', lw, COPY.line); E.line.style.display = 'inline-block';
    const uw = mk('div', 'st2row', root); uw.style.top = ROWS.url + 'px'; E.url = mk('span', 'st2url num', uw, COPY.url); E.url.style.display = 'inline-block';
  }

  // ── camera: locked off; one tiny shake as the icon lands ──
  function camera() { return { keys: [{ t: 0, ...Pt(216, 384, 1) }], hits: [[T.land, 4, 12]], rests: [[-1, 99]] }; }

  // the rays turn slowly and come to rest by 7.6 (an integral of a speed that eases to 0; pure)
  function rayAngle(t) {
    const a = 7.0, b = T.still, v = 6;                               // deg/s until a, eased to 0 by b
    if (t <= a) return v * t;
    const u = Math.min(t, b) - a, L = b - a, k = u / L;              // ∫ (1 - smoothstep) over [a, a+u]
    return v * a + v * L * (k - (k * k * k - k * k * k * k / 2));
  }

  // ── update ──
  function update(t) {
    KIT.rays(E.rays, t, rayAngle(t), 1, 1, '');
    // the icon: falls (accelerating) from above the frame, lands on 1.0 with a squash; pulses once on the crash
    const u = seg(t, T.drop0, T.land);
    let iy = t < T.land ? lerp(-330, 0, u * u) : 0, ir = t < T.land ? lerp(-9, 0, u) : 0;
    const im = OM.impact(t, T.land, { decay: 7, omega: 22, sqx: 0.16, sqy: 0.2 });
    let isx = t >= T.land ? im.sx : 1, isy = t >= T.land ? im.sy : 1;
    const crashP = pulse(t, T.crash, 0.07, 7, 24); isx *= 1 + crashP; isy *= 1 + crashP;
    put(E.icon, { y: iy, r: ir, sx: isx, sy: isy, op: t < T.drop0 ? 0 : 1, base: '' });
    // its shadow waits on frame 0 and darkens as the icon comes down
    const near = t < T.land ? sstep(0, 1, u) : 1;
    put(E.shadow, { s: lerp(0.86, 1, near), op: t >= T.land ? 0 : lerp(0.42, 0.62, near), base: '' });
    put(E.slot, { s: 1 + 0.03 * Math.sin(Math.PI * near), op: t >= T.land ? 0 : 1, base: '' });
    // the tag stamps onto the corner; one last wobble on the crash
    const tk = K(t, T.tag, 'pop');
    put(E.tag, t < T.tag ? { op: 0 } : { s: lerp(2.3, 1, tk) * (1 + pulse(t, T.crash + 0.04, 0.06, 6, 20)), r: lerp(-22, 0, tk) + 9 * pulse(t, T.crash + 0.04, 1, 4.2, 13), op: clamp(tk * 3) });
    // the wordmark stands in its place from frame 0 (the cover); it gives a small nod when the icon lands above it
    E.letters.forEach(l => put(l, { base: '' }));
    KIT.cssv(E.mark, '--bar', '1');
    put(E.mark, { s: 1 + pulse(t, T.land + 0.03, 0.035, 8, 24) });
    put(E.title, life(t, T.title, { y: 18, s: 0.6, r: -6 }, 'pop'));
    E.chips.forEach((c, i) => put(c, life(t, T.chips[i], { s: 0.35, r: i % 2 ? 10 : -10 }, 'pop')));
    // the hand of cards: each slides out from behind the icon and turns to its place
    E.cards.forEach((c, i) => {
      const f = FAN[i], t0 = T.cards[i], k = K(t, t0, f.pink ? 'snap' : 'soft');
      if (t < t0) { put(c, { op: 0 }); return; }
      const a = f.a * Math.PI / 180, R = lerp(10, FAN_R, k);
      put(c, { x: Math.sin(a) * R, y: -Math.cos(a) * R, r: f.a * lerp(0.2, 1, k), s: lerp(0.7, 1, k) * (f.pink ? 1 + pulse(t, T.crash, 0.08) : 1), op: clamp(k * 4) });
    });
    // confetti from behind the icon on the crash
    E.bits.forEach(b => {
      const tt = t - T.crash - b.d;
      if (tt <= 0 || tt > 1.6) { put(b.el, { op: 0, base: '' }); return; }
      const x = b.x + b.vx * 150 * tt, y = b.vy * 260 * tt + 0.5 * 520 * tt * tt;
      const flip = Math.abs(Math.cos(b.vr * tt * 0.7));
      put(b.el, { base: `translate(${fix(x)}px,${fix(y)}px) rotate(${fix((b.rot + b.vr * tt) * 57.3, 1)}deg) scale(1,${fix(0.15 + 0.85 * flip, 3)})`, op: 1 - sstep(1.0, 1.55, tt) });
    });
    // the closing line rises, then the address
    const rl = OM.wordRise(t, T.line, { dist: 18 }); put(E.line, { y: rl.y, s: rl.s, op: rl.op });
    const ru = OM.wordRise(t, T.url, { dist: 12 }); put(E.url, { y: ru.y, op: ru.op });
  }

  // ── sound (MUSIC.md §4) ──
  function events() {
    const c = el => center(M(el));
    ev(T.drop0 + 0.05, 'drop', IC.x, IC.y - 120, 0.45);
    ev(T.land, 'logo_hit', IC.x, IC.y, 0.1);                         // the loudest thing before the crash
    ev(T.tag, 'stamp_soft', ...c(E.tag), 0.65);
    ev(T.title, 'title', ...c(E.title), 0.55);
    E.chips.forEach((ch, i) => ev(T.chips[i], 'pop', ...c(ch), 0.55 + i * 0.07));
    T.cards.slice(0, -1).forEach((tc, i) => ev(tc, 'deal', IC.x + Math.sin(FAN[i].a * Math.PI / 180) * 90, IC.y - 60, 0.35 + i * 0.04));
    ev(T.cards[6], 'deal_odd', IC.x, IC.y - 100, 0.7);
    ev(T.crash, 'confetti', IC.x, IC.y - 30, 1);                       // the loudest moment, with the track's crash
    ev(T.crash, 'boom', IC.x, IC.y, 0.9);
    ev(T.line, 'word', ...c(E.line), 0.3);                            // silent: nothing after 6.4 competes with the ring
  }

  const music = { segments: [{ t0: 0, t1: 8, track: 33.557 }], gain: 0.26, nudge: 0.03, sections: [[0, 0.72], [5.95, 1.3]] };

  KIT.run({
    T, build, camera, update, events, music,
    track: box => {
      box('icon', E.icon); box('tag', E.tag); box('wordmark', E.mark); box('title', E.title);
      E.chips.forEach((c, i) => box('chip' + i, c)); box('line', E.line); box('url', E.url);
    },
  });
})();
