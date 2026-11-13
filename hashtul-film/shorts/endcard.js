/* השתול · the shared end card — the film's (film.js: buildHome(root, true), uHome(t, h, true), T.end0…T.wink, END_DY,
 * the whip keys of buildCamera) as one reusable sequence. Needs ../kit.js.
 *
 *   const END = KIT.endcard({ t0: 10.2 });             // the camera whips up from wherever the scene is at t0
 *   const END = KIT.endcard({ hit: 16.0 });            // …or say when the wordmark must land (a bar line); t0 = hit − 1.0
 *   const END = KIT.endcard({ t0, cta: 'תצליחו לתפוס את השתול?' });   // replaces the facts line
 *   T.dur = END.dur;                                   // t0 + 3.0
 *
 * After KIT.run has started: END.keys (its camera keys), END.events (its sound events), END.T (its absolute times),
 * END.hit (t0 + 1.0, the wordmark lands: the 5th letter's 'logo_hit', with a small shake), END.h (element handles).
 * Grid after t0: whip 0–0.56 · cast .30 · letters .63 → hit 1.0 · pitch 1.5 (punch 1.8) · chip 1.9 · line 2.2 ·
 * still from 2.4 · wink 2.6 · end 3.0.
 * Options: dy (world offset of the card, default −1150 game px: above the scene), frame 'safe' (default: everything that
 * matters inside KIT.SAFE) or 'film' (the film's exact framing, zoom 1.06; its facts line sits in the bottom 420 px).
 * Keep the scene's screens visible until t0 + 0.7 (the whip carries them off frame; nothing fades).
 */
(function () {
  'use strict';
  const { $, $$, mk, put, hide, cssv, on, life, K, pulse, lerp, clamp, sstep, spring, ease, fix, M, Pt, G, W, H, SAFE } = KIT;

  // times after t0 (the director's grid for 18 s shorts: whip at t0, wordmark ON the music's last hit at t0 + 1.0,
  // pitch 1.5, chip 1.9, line 2.2, still by 2.4, wink 2.6, end 3.0). The film's were cast .36, word .74, pitch 1.56,
  // cta 2.28, hold 2.76, wink 3.96, end 4.66: the whip, drops and springs are the film's, the holds are shorter.
  const REL = { whip: 0.56, cast: 0.30, word: 0.63, pitch: 1.50, punch: 1.80, cta: 1.90, line: 2.20, hold: 2.40, wink: 2.60, dur: 3.00 };
  const HIT = REL.word + 4 * 0.07 + 0.09;            // 1.00: the last letter lands (its logo_hit) — put this on the bar line
  const WORD_STEP = 0.065;                           // the pitch's words (film: 0.12) so the punch lands before the chip
  const FACTS = '<span class="num">3–12</span> שחקנים · מזמינים בוואטסאפ';
  const URL = 'hashtul.onrender.com';

  let styled = false;
  function style() {
    if (styled) return; styled = true;
    const s = document.createElement('style');
    s.textContent = `.cta{position:absolute;display:inline-flex;align-items:center;gap:10px;white-space:nowrap}
.facts{position:absolute;white-space:nowrap}
.facts.facts--cta{color:#fff;font-weight:900;font-size:20px}
#phone .wordmark::after{transform:rotate(1.5deg) scaleX(var(--bar,1));transform-origin:100% 50%}
#phone .wordmark .ltr{display:inline-block} #phone .w{display:inline-block;white-space:pre}`;
    document.head.appendChild(s);
  }

  function endcard(o = {}) {
    style();
    const t0 = o.t0 != null ? o.t0 : o.hit - HIT;
  if (o.t0 == null && o.hit == null) throw new Error('KIT.endcard: give t0 or hit');
    const dy = o.dy ?? -1150, frame = o.frame || 'safe', name = o.name || 'end';
    const T = {}; for (const k in REL) T[k] = t0 + REL[k];
    T.end0 = t0;
    const P = { t0, hit: t0 + HIT, dur: t0 + REL.dur, T, keys: [], events: [], h: null, name, adultDy: 0 };

    P.build = () => {
      const root = KIT.screen(name, 'home');
      root.style.transform = `translateY(${dy}px)`;     // the card sits above the scene in the world; the camera whips up to it
      const h = (P.h = { root });
      h.rays = $('.home__rays', root); h.adult = $('.home__adult', root);
      h.cast = $$('.home__cast > div', root);           // tomato, mole, lemon (RTL: tomato on the right)
      h.wordmark = $('.wordmark', root);
      h.wordmark.textContent = '';
      h.letters = Array.from('השתול').map(ch => { const s = document.createElement('span'); s.className = 'ltr'; s.textContent = ch; h.wordmark.appendChild(s); return s; });
      h.pitch = $('.home__pitch', root);
      h.pitch.innerHTML = 'כולם עונים על אותה שאלה.<br><b>חוץ מאחד.</b>';
      h.punch = $('b', h.pitch);
      h.words = KIT.splitWords(h.pitch).filter(w => !h.punch.contains(w));
      h.foot = [...$$('.screen__foot .btn', root), $('.linkbtn', root), $('.legal', root)];
      const mole = $('.home__mole .avatar', root);
      mole.innerHTML = `<span class="moleA">${KIT.svgOf('eggplant.lid.smirk', { variant: 'figure', planted: true })}</span>`;
      $$('span', mole).forEach(s => { s.style.cssText = 'position:absolute;inset:0;display:block'; });
      mole.style.position = 'relative';
      h.moleSpan = mole; h.pupils = $$('.pupil', mole);
      h.moleWobble = $('.home__mole .wobble', root);
      h.wordmark.__base = 'rotate(-4deg)';
      h.cta = mk('div', 'cta', root, `<span class="btn btn--md" style="width:auto;padding:0 26px;font-size:22px"><span class="num">${URL}</span></span>`);
      h.facts = mk('p', 'lead facts' + (o.cta ? ' facts--cta' : ''), root, o.cta ? o.cta : FACTS);
    };

    P.measured = () => {
      const h = P.h, pr = M(h.pitch);
      h.ctaAt = { x: pr.x + pr.w / 2, y: pr.y + pr.h + 30 };   // world game px (the card's offset is in the rect) …
      h.ctaLocal = { x: h.ctaAt.x, y: h.ctaAt.y - dy };        // … and inside the card (subtract it once, not twice)
      h.cta.style.left = h.ctaLocal.x + 'px'; h.cta.style.top = h.ctaLocal.y + 'px';
      h.facts.style.left = h.ctaLocal.x + 'px'; h.facts.style.top = (h.ctaLocal.y + 64) + 'px';
    };

    P.camera = acc => {
      const h = P.h, endTop = M(h.cast[1]).y, endBot = h.ctaAt.y + 120;
      let target = Pt(215, (endTop - 40 + endBot) / 2, 1.06);   // the film's framing
      if (frame === 'safe') {
        // the facts line's bottom (pitch + 30 + 64 + ~32 game px) and the cast's top inside the safe band, a little air either side
        const top = endTop - 6, bot = h.ctaAt.y + 64 + 34;
        const band0 = SAFE.top + 70, band1 = H - SAFE.bottom - 40;
        const zoom = Math.min(1.06, (band1 - band0) / ((bot - top) * G));
        const cy = (top + bot) / 2 + ((H / 2) - (band0 + band1) / 2) / (zoom * G);
        // the chip is the widest thing in the lower half: keep its right end (with its shadow) clear of the right 130 px
        const chipW = M(KIT.$('.btn', h.cta)).w + 8, right = W / 2 + (h.ctaAt.x + chipW / 2 - 215) * zoom * G;
        const cx = 215 + Math.max(0, right - (W - SAFE.right - 12)) / (zoom * G);
        target = Pt(cx, cy, zoom);
        // the 18+ sticker sits far above the cast: bring it down just under the top safe line (the only layout change)
        const ar = M(h.adult), top0 = (ar.y * G - target.y) * zoom + H / 2;
        P.adultDy = Math.max(0, (SAFE.top + 24 - top0) / (zoom * G));
      }
      const from = KIT.keyedAt(t0 + 0.04);                     // wherever the scene's camera is
      acc.keys = acc.keys.filter(k => k.t < t0 + 0.04);
      acc.rests = acc.rests.map(([a, b]) => [a, Math.min(b, t0 - 0.1)]).filter(([a, b]) => b > a);
      P.keys = [
        { t: t0 + 0.04, x: from.x, y: from.y, zoom: from.zoom, curve: ease.sineInOut },
        { t: t0 + REL.whip, ...target, curve: ease.expoInOut },
        { t: P.dur, ...target },
      ];
      acc.keys.push(...P.keys);
      acc.rests.push([T.hold, 99]);                            // still from t0 + 2.4 (the float has died out by then)
      acc.hits.push([P.hit - 0.03, 5, 12]);                    // the film's small logo shake, on the hit
      P.frame = target;
    };

    P.events = () => {
      const e = (t, kind, gx, gy, v) => { KIT.ev(t, kind, gx, gy + dy, v); P.events.push({ t, kind, gx, gy: gy + dy, v }); };
      P.events = [];
      const c = KIT.camAt(t0 + 0.1);                           // the whip starts wherever the camera is: centre it there
      KIT.ev(t0 + 0.1, 'whip', c.x / G, c.y / G, 0.5); P.events.push({ t: t0 + 0.1, kind: 'whip', gx: c.x / G, gy: c.y / G, v: 0.5 });
      for (let i = 0; i < 5; i++) e(T.word + i * 0.07 + 0.09, i === 4 ? 'logo_hit' : 'letter', 215 + (2 - i) * 50, 330, 0.9);
      e(T.punch + 0.02, 'punch', 215, 450, 0.45); e(T.cta + 0.04, 'pop', 215, 520, 0.4);
      e(T.wink, 'glance', 215, 300, 0.5);
    };

    P.update = t => {
      const h = P.h, vis = t >= t0;
      on(h.root, vis); if (!vis) return;
      KIT.rays(h.rays, t, KIT.rayAngle(t), sstep(t0, t0 + 0.5, t));
      h.cast.forEach((c, i) => put(c, life(t, T.cast + [0.08, 0, 0.14][i], { y: 26, s: 0.6 }, 'bouncy')));
      // the wink: pupils slide, then back by t0 + 2.98 (the film held it 0.7 s; here it must close before the end)
      const wink = t > T.wink ? Math.min(1, spring(t - T.wink, 0.7, 26)) * (1 - sstep(T.wink + 0.2, T.wink + 0.38, t)) : 0;
      h.pupils.forEach(p => { const v = `translate(${fix(wink * 3.6)} 0)`; if (p.__g !== v) { p.setAttribute('transform', v); p.__g = v; } });
      KIT.wobble(t, h.moleWobble, T.cast + 0.3);
      // the wordmark: letters drop right to left and squash on landing; the pink bar swipes in
      h.letters.forEach((l, i) => {
        const d = KIT.OM.letterDrop(t, T.word, i, { stagger: 0.07, dist: 64, zeta: 0.45, omega: 24, squash: 0.0042, max: 0.3 });
        put(l, { y: -d.y, sx: d.sx, sy: d.sy, op: d.op, base: '' });
      });
      cssv(h.wordmark, '--bar', fix(ease.expoOut(KIT.seg(t, T.word + 0.42, T.word + 0.77)), 3));
      put(h.wordmark, { s: 1 + pulse(t, T.word + 0.34, 0.05) });
      put(h.adult, life(t, T.word + 0.5, { s: 0.4, r: -8 }, 'pop', { y: P.adultDy }));
      // the pitch: words land, then the punch
      h.words.forEach((w, i) => { const r = KIT.OM.wordRise(t, T.pitch + i * WORD_STEP, { dist: 22, zeta: 0.55, omega: 24 }); put(w, { y: r.y, s: r.s, op: r.op, base: '' }); });
      const kp = K(t, T.punch, 'pop');                         // film: bouncy; pop settles by the 2.4 still
      put(h.punch, t < T.punch ? { op: 0 } : { s: lerp(1.9, 1, kp), r: lerp(-6, 0, kp), op: clamp(kp * 3), base: '' });
      if (h.punch.style.display !== 'inline-block') h.punch.style.display = 'inline-block';
      put(h.pitch, {});
      h.foot.forEach(hide);
      // the link chip, then the facts (or the short's own line)
      const kc = K(t, T.cta, 'pop');                           // film: bouncy (see above)
      put(h.cta, t < T.cta ? { op: 0, base: 'translate(-50%,0)' } : { s: lerp(0.4, 1, kc), r: lerp(-8, -2, kc), op: clamp(kc * 2), base: 'translate(-50%,0)' });
      const rf = KIT.OM.wordRise(t, T.line, { dist: 16 }); put(h.facts, { y: rf.y, op: rf.op, base: 'translate(-50%,0)' });
    };

    P.track = box => { box('endmark', P.h.wordmark); box('endpitch', P.h.pitch); box('cta', P.h.cta); box('facts', P.h.facts); box('endcast', $('.home__cast', P.h.root)); box('adult', P.h.adult); };
    return KIT.part(P);
  }
  endcard.HIT = HIT; endcard.DUR = REL.dur; endcard.REL = REL;
  KIT.endcard = endcard;
})();
