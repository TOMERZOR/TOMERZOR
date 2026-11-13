/* השתול · short template (8 s) — copy this folder to start a short.
 * (a) the game's reveal screen: six answer cards flip one after another under the hand-held camera; the last one,
 *     יובל's 7, is flipped by a finger tap and the camera punches in; (b) the shared end card (../endcard.js).
 * Read ../KIT.md first. Times live in T; every frame is a pure function of t.
 */
(function () {
  'use strict';
  const { $, $$, put, hide, on, life, lerp, clamp, spring, pulse, K, M, Pt, Fr, center, ev, ease } = KIT;

  // ── timeline (s) ──
  const T = {
    title: 0.12, cells0: 0.30,                                     // the title pops, the face-down cards arrive
    flip: { 'שירה': 1.30, 'תומר': 1.62, 'דנה': 1.92, 'נועה': 2.20, 'איתי': 2.48, 'יובל': 3.36 },
    fIn: 2.66, tap: 3.30, fOut: 3.80,                              // the finger flips יובל's card
    laugh: 3.62, rest: 3.92,
    end0: 5.0,                                                     // the end card's whip
  };
  const END = KIT.endcard({ t0: T.end0, cta: 'תצליחו לתפוס את השתול?' });
  T.dur = END.dur;                                                 // 8.0

  // ── build: instantiate captured screens, grab handles (game px, before measuring) ──
  const E = {};
  function build() {
    const r = KIT.screen('reveal');
    E.header = $('header', r); E.foot = [$('.role', r), $('.reveal__reactions', r), $('.screen__foot', r)];
    E.head = $('.reveal__head > div', r); E.head.__base = 'rotate(-2deg)';   // __base: the element's resting transform
    E.q = $('.reveal__q', r); E.q.__base = 'rotate(-0.8deg)';
    E.grid = $('.reveal__grid', r);
    E.cells = $$('.reveal__cell', r);
    E.name = E.cells.map(c => { const n = $('.reveal__name', c); return n ? n.textContent.trim() : 'נועה'; });  // "אתם" is נועה
    E.flips = E.cells.map(c => $('.reveal__flip', c));
    E.figs = E.cells.map(c => $('.ans', c));
    E.y = E.name.indexOf('יובל');
  }

  // ── camera: keys in world px via Pt/Fr (game px in), hits shake, rests kill the hand-held float ──
  function camera() {
    const g = M(E.grid), yc = M(E.cells[E.y]), cy = g.y + g.h / 2;
    return {
      keys: [
        { t: 0, ...Pt(215, cy - 70, 0.92) },
        { t: 1.25, ...Pt(215, cy - 20, 1.0), curve: ease.cubicInOut },
        { t: 2.70, ...Pt(215, cy + 10, 1.04), curve: ease.sineInOut },
        { t: T.flip['יובל'] + 0.04, ...Fr(yc, 1.62), curve: ease.expoOut },
        { t: T.rest, ...Fr(yc, 1.42, 0, -30), curve: ease.cubicInOut },
      ],
      hits: [[T.flip['יובל'] + 0.02, 14, 9]],                      // [t, amp px, decay]
      rests: [[T.rest, T.end0 - 0.3]],
    };
  }

  // ── update: write everything, every frame ──
  function update(t) {
    on(KIT.S.reveal, t < T.end0 + 0.7);                            // the whip carries it off; nothing fades
    hide(E.header); E.foot.forEach(hide);
    const tk = K(t, T.title, 'pop');
    put(E.head, t < T.title ? { op: 0 } : { y: lerp(-34, 0, tk), s: lerp(0.7, 1, tk), op: clamp(tk * 2) });
    put(E.q, life(t, T.title + 0.1, { y: -40, s: 0.9 }, 'soft'));
    E.cells.forEach((c, i) => {
      const n = E.name[i], big = i === E.y, tf = T.flip[n];
      const ck = K(t, T.cells0 + i * 0.06, 'pop');
      const fk = t < tf ? 0 : spring(t - tf, big ? 0.5 : 0.6, big ? 20 : 26);
      put(E.flips[i], { ry: lerp(180, 0, clamp(fk, 0, 1.08)), base: '' });
      let s = lerp(0.5, 1, ck);
      if (t >= tf) s *= 1 + (big ? pulse(t, tf, 0.16, 6, 20) : pulse(t, tf, 0.06, 10, 28));
      if (big && t >= T.tap) s *= 1 - 0.05 * Math.max(0, pulse(t, T.tap, 1, 18, 30));   // the press
      put(c, t < T.cells0 + i * 0.06 ? { op: 0 } : { s, op: clamp(ck * 2) });
      if (big) put(E.figs[i], t < tf ? { base: '' } : { s: 1 + 1.2 * Math.max(0, 1 - spring(t - tf - 0.05, 0.42, 18)), base: '' });
    });
  }

  // ── sound: ev(t, kind, gx, gy, v) in game px; pan comes from the camera. Kinds: see KIT.md ──
  function events() {
    const c = el => center(M(el));
    ev(T.title + 0.05, 'title', 215, 90, 0.7);
    E.cells.forEach((cell, i) => ev(T.cells0 + i * 0.06, 'cell', ...c(cell), 0.5));
    E.name.forEach((n, i) => ev(T.flip[n], n === 'יובל' ? 'reveal_big' : 'flip', ...c(E.cells[i]), 0.6 + i * 0.07));
    ev(T.tap, 'tap', ...c(E.cells[E.y]), 0.9);
    ev(T.flip['יובל'] + 0.1, 'crowd_oooh', 215, 400, 1);
    ev(T.laugh, 'react', ...c(E.cells[E.y]), 0.7);
  }

  // ── fx parts (resolved after measuring, so they can use M) ──
  KIT.finger(() => {
    const p = center(M(E.cells[E.y]));
    return {
      knots: [{ t: T.fIn, x: p[0] + 110, y: p[1] + 300 }, { t: T.tap - 0.14, x: p[0] + 12, y: p[1] + 8 }, { t: T.tap, x: p[0], y: p[1] },
        { t: T.fOut, x: p[0] + 130, y: p[1] + 260 }],
      taps: [T.tap], windows: [[T.fIn, T.fOut]],
    };
  });
  KIT.emoji(() => { const r = M(E.cells[E.y]); return [{ t0: T.laugh, ch: '😂', from: [r.x + r.w * 0.3, r.y + r.h * 0.85], to: [r.x + r.w * 0.18, r.y + r.h * 0.22] }]; });

  KIT.run({ T, build, camera, update, events, track: box => { box('yuvalcell', E.cells[E.y]); box('grid', E.grid); } });
})();
