/* השתול · Instagram story "עכשיו באוויר!" — 8.0 s, 1080×1920, camera locked off.
 * The end card's pieces (cast, wordmark, pitch, 18+) laid out for a story, plus the game's stickers and chips, and an
 * empty dashed slot where the user drops Instagram's link sticker (centre y 1400, ~780×170 on the frame).
 * Instagram's safe zone: nothing important in the top 260 px or the bottom 340 px. Everything from the chips down
 * holds perfectly still once it has arrived. Music: the track's last bars, crash on 6.0 (MUSIC.md).
 */
(function () {
  'use strict';
  const { $, $$, put, hide, on, life, lerp, clamp, seg, sstep, spring, pulse, K, M, Pt, ev, ease, mk, fix, cssv, G, W, H } = KIT;

  // ── timeline (s): beats every 0.5, bar lines 1.0 / 3.0 / 5.0, the crash on 6.0 ──
  const T = {
    word: 0.45, wordStep: 0.115, hit: 1.0, bar: 1.05, adult: 1.15,
    live: 1.5,
    pitch: 2.0, pitchStep: 0.08, punch: 2.4,
    chips: [3.0, 3.5, 4.0],
    slot0: 5.0, slot1: 5.7, url: 5.3,
    fIn: 5.4, tap: 6.0, fOut: 6.62,
    here: 6.0, bob0: 6.4, bob1: 7.4,
    wink: 7.2, still: 7.6,
    dur: 8.0,
  };
  // the frame: camera locked on the phone's centre at zoom 1 → frame px = (game px − centre) × 2.5 + frame centre
  const CAM = { gx: 215, gy: 466, zoom: 1.0 };
  const gyOf = fy => CAM.gy + (fy - H / 2) / (G * CAM.zoom);       // frame y → game y
  const STORY_SAFE = { top: 260, bottom: 340 };
  // the link slot on the frame (px) and in game px
  const SLOT = { fw: 780, fh: 170, fcy: 1400 };
  SLOT.w = SLOT.fw / G; SLOT.h = SLOT.fh / G; SLOT.cy = gyOf(SLOT.fcy); SLOT.r = 26;

  const E = {};
  // a full-width row at game y `top`, its content centred (measure() turns `top` into the row's centre line)
  const abs = (parent, top, css = '') => {
    const d = mk('div', 'st-row', parent);
    d.style.cssText = `position:absolute;left:0;width:430px;top:${top}px;display:flex;justify-content:center;align-items:center;${css}`;
    return d;
  };

  // ───────────────────────────── build ─────────────────────────────
  function build() {
    const root = KIT.screen('story', 'home'), h = E;
    E.root = root;
    hide($('.screen__foot', root));
    // the hero's pieces leave the game's flow and take absolute places on the story
    const hero = $('.home__hero', root);
    E.rays = $('.home__rays', root); root.appendChild(E.rays);
    E.rays.style.cssText += ';top:auto;left:50%;';
    // a tighter mask than the home screen's (20%→78%): the turning rays fade out by the pitch and never reach the chips
    E.rays.style.webkitMaskImage = E.rays.style.maskImage = 'radial-gradient(closest-side,#000 18%,#0000 60%)';
    E.cast = $('.home__cast', root); E.castEach = $$('.home__cast > div', root);
    E.wordmark = $('.wordmark', root);
    E.pitch = $('.home__pitch', root);
    E.adult = $('.home__adult', root);
    hide(hero);

    // 1 · "עכשיו באוויר!" — the game's pink sticker, tilted
    E.liveRow = abs(root, gyOf(326), 'z-index:3');
    E.live = mk('span', 'sticker', E.liveRow, 'עכשיו באוויר!');
    E.live.style.cssText = 'font-size:19px;padding:4px 17px 7px;box-shadow:0 5px 0 var(--ink)';
    E.live.__base = 'rotate(-3.5deg)';

    // 2 · the cast and the wordmark (the end card's), and the 18+
    E.castRow = abs(root, gyOf(632) - 150, 'height:150px;transform-origin:50% 100%');
    E.castRow.appendChild(E.cast); E.cast.style.margin = '0'; E.castRow.__base = 'scale(0.75)';
    const mole = $('.home__mole .avatar', root);
    mole.innerHTML = `<span>${KIT.svgOf('eggplant.lid.smirk', { variant: 'figure', planted: true })}</span>`;
    $$('span', mole).forEach(s => { s.style.cssText = 'position:absolute;inset:0;display:block'; }); mole.style.position = 'relative';
    E.mole = mole; E.pupils = $$('.pupil', mole); E.moleWob = $('.home__mole .wobble', root);
    E.markRow = abs(root, gyOf(596), 'transform-origin:50% 0');
    E.markRow.appendChild(E.wordmark); E.markRow.__base = 'scale(0.77)';
    E.wordmark.textContent = '';
    E.letters = Array.from('השתול').map(ch => { const s = document.createElement('span'); s.className = 'ltr'; s.textContent = ch; E.wordmark.appendChild(s); return s; });
    E.wordmark.__base = 'rotate(-4deg)';
    E.adultRow = mk('div', '', root); E.adultRow.style.cssText = `position:absolute;left:322px;top:${gyOf(392)}px`;
    E.adultRow.appendChild(E.adult); E.adult.style.cssText = 'position:static';
    E.adultRow.__base = 'scale(0.8)';

    // 3 · the pitch
    E.pitchRow = abs(root, gyOf(925));
    E.pitchRow.appendChild(E.pitch); E.pitch.style.cssText = 'margin:0;text-align:center;line-height:1.22';
    E.pitch.innerHTML = 'כולם עונים על אותה שאלה.<br><b>חוץ מאחד.</b>';
    E.punch = $('b', E.pitch); E.punch.style.display = 'inline-block';
    E.words = KIT.splitWords(E.pitch).filter(w => !E.punch.contains(w));

    // 4 · three chips in the game's chip style, two rows
    const chip = (row, html) => { const c = mk('span', 'chip', row, html); c.style.cssText = 'font-size:18px;height:36px;padding:0 16px;border-width:3px;box-shadow:0 4px 0 var(--ink)'; return c; };
    E.chipRows = [abs(root, gyOf(1045), 'gap:14px'), abs(root, gyOf(1146))];
    E.chips = [chip(E.chipRows[0], '<span class="num">3–12</span> שחקנים'), chip(E.chipRows[0], 'משחקים מהטלפון'), chip(E.chipRows[1], 'בלי להוריד כלום')];
    E.chips[0].__base = 'rotate(-2deg)'; E.chips[1].__base = 'rotate(1.5deg)'; E.chips[2].__base = 'rotate(-1deg)';

    // 6 · THE LINK SLOT: an empty rounded frame drawn like the game's dashed mystery figure (lilac 7/7, round caps)
    const pad = 6, w = SLOT.w, hh = SLOT.h, r = SLOT.r;
    E.slot = mk('div', '', root);
    E.slot.style.cssText = `position:absolute;left:${215 - w / 2 - pad}px;top:${SLOT.cy - hh / 2 - pad}px;width:${w + 2 * pad}px;height:${hh + 2 * pad}px`;
    // two halves from the top centre to the bottom centre, so the dashes run both ways round the frame
    const x0 = pad, y0 = pad, x1 = pad + w, y1 = pad + hh, cx = pad + w / 2;
    const right = `M${cx} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${cx}`;
    const left = `M${cx} ${y0}H${x0 + r}A${r} ${r} 0 0 0 ${x0} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 0 ${x0 + r} ${y1}H${cx}`;
    E.slotHalf = (w - 2 * r) / 2 + (hh - 2 * r) + Math.PI * r + (w - 2 * r) / 2;
    E.slot.innerHTML = `<svg width="${w + 2 * pad}" height="${hh + 2 * pad}" viewBox="0 0 ${w + 2 * pad} ${hh + 2 * pad}" style="overflow:visible;display:block">
      <rect class="tint" x="${x0}" y="${y0}" width="${w}" height="${hh}" rx="${r}" fill="#1a0747" fill-opacity=".42"/>
      <rect class="stripes" x="${x0}" y="${y0}" width="${w}" height="${hh}" rx="${r}" fill="url(#st_stripes)"/>
      <defs><pattern id="st_stripes" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><rect width="5" height="12" fill="#ffffff" fill-opacity=".045"/></pattern></defs>
      <path class="dash" d="${right}" fill="none" stroke="#b9a0ff" stroke-width="3.2" stroke-linecap="round"/>
      <path class="dash" d="${left}" fill="none" stroke="#b9a0ff" stroke-width="3.2" stroke-linecap="round"/>
      <rect class="ghost" x="${x0}" y="${y0}" width="${w}" height="${hh}" rx="${r}" fill="none" stroke="#d9c9ff" stroke-width="3"/>
    </svg>`;
    E.tint = $('.tint', E.slot); E.stripes = $('.stripes', E.slot); E.dashes = $$('.dash', E.slot); E.ghost = $('.ghost', E.slot);
    E.ghost.style.transformBox = 'fill-box'; E.ghost.style.transformOrigin = '50% 50%';

    // 5 · "משחקים מכאן" with a down arrow — the game's yellow sticker, sitting on the slot's top edge like a tab
    E.hereRow = abs(root, gyOf(1266));
    E.here = mk('span', 'sticker sticker--yellow', E.hereRow,
      '<span>משחקים מכאן</span><span class="st-arrow"><svg viewBox="0 0 24 30" width="20" height="25" aria-hidden="true"><path d="M12 3v19M4.5 15.5L12 23l7.5-7.5" fill="none" stroke="#1B0A36" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>');
    E.here.style.cssText = 'font-size:20px;padding:4px 16px 7px;display:inline-flex;align-items:center;gap:8px';
    E.arrow = $('.st-arrow', E.here); E.arrow.style.cssText = 'display:inline-block;line-height:0';
    E.here.__base = 'rotate(-3deg)';

    // 7 · the address under the slot
    E.urlRow = abs(root, gyOf(1530));
    E.url = mk('p', 'num', E.urlRow, 'hashtul.onrender.com');
    E.url.style.cssText = 'margin:0;font-size:19px;font-weight:800;color:var(--v-200);letter-spacing:.01em';
  }

  // centre the rows on their tops: each row's `top` is its centre line
  function measure() {
    const lift = el => { const r = M(el); el.style.top = (parseFloat(el.style.top) - r.h / 2) + 'px'; };
    [E.liveRow, E.hereRow, E.urlRow, E.pitchRow, ...E.chipRows].forEach(lift);
    E.rays.style.top = (gyOf(470) - 645 / 2) + 'px';                // the rays turn round the cast
  }

  // ── the dashes drawing themselves: a 7/7 pattern cut off at the drawn length ──
  function dashArray(len, total) {
    const a = []; let acc = 0;
    while (acc + 14 <= len) { a.push(7, 7); acc += 14; }
    a.push(Math.max(0, Math.min(7, len - acc)), total + 14);
    return a.map(v => fix(v, 2)).join(' ');
  }

  // ───────────────────────────── update ─────────────────────────────
  function update(t) {
    on(E.root, true);
    // the ground's rays turn slowly from frame 0 (their mask is gone by y≈950, above the chips)
    // 4°/s, easing to a stop by 7.6: the angle is the integral of 4·(1 − smoothstep(6.8, 7.6)), in closed form
    const ur = clamp((t - 6.8) / 0.8), tt = t < 6.8 ? t : 6.8 + 0.8 * (ur - (ur * ur * ur - ur * ur * ur * ur / 2));
    KIT.rays(E.rays, t, 4 * tt, 1);
    // the cast stands from frame 0; the eggplant sways a little, then is still from 7.6; the wink at 7.2
    put(E.castRow, {});
    const sway = 2.2 * Math.sin(2 * Math.PI * t / 2.6) * (1 - sstep(6.8, T.still, t));
    put(E.moleWob, { r: sway, base: '' });
    const wink = t > T.wink ? Math.min(1, spring(t - T.wink, 0.7, 26)) * (1 - sstep(T.wink + 0.2, T.wink + 0.38, t)) : 0;
    E.pupils.forEach(p => { const v = `translate(${fix(wink * 3.6)} 0)`; if (p.__g !== v) { p.setAttribute('transform', v); p.__g = v; } });
    // the wordmark: letters drop right to left, the last lands on 1.0; the pink bar swipes in
    E.letters.forEach((l, i) => {
      const d = KIT.OM.letterDrop(t, T.word, i, { stagger: T.wordStep, dist: 64, zeta: 0.45, omega: 24, squash: 0.0042, max: 0.3 });
      put(l, { y: -d.y, sx: d.sx, sy: d.sy, op: d.op, base: '' });
    });
    cssv(E.wordmark, '--bar', fix(ease.expoOut(seg(t, T.bar, T.bar + 0.35)), 3));
    put(E.wordmark, { s: 1 + pulse(t, T.hit - 0.03, 0.05) });
    put(E.markRow, {});
    put(E.adultRow, life(t, T.adult, { s: 0.4, r: -8 }, 'pop'));
    // "עכשיו באוויר!" stamps in
    const kl = K(t, T.live, 'pop');
    put(E.live, t < T.live ? { op: 0 } : { s: lerp(2.0, 1, kl), r: lerp(-16, 0, kl), op: clamp(kl * 3) });
    // the pitch, then the punch
    E.words.forEach((w, i) => { const r = KIT.OM.wordRise(t, T.pitch + i * T.pitchStep, { dist: 22, zeta: 0.55, omega: 24 }); put(w, { y: r.y, s: r.s, op: r.op, base: '' }); });
    const kp = K(t, T.punch, 'pop');
    put(E.punch, t < T.punch ? { op: 0 } : { s: lerp(1.9, 1, kp), r: lerp(-6, 0, kp), op: clamp(kp * 3), base: '' });
    // the chips, one per beat
    E.chips.forEach((c, i) => put(c, life(t, T.chips[i], { s: 0.4, r: -10, y: 10 }, 'pop')));
    // the slot draws itself: the tint fades up, the dashes run round from the top centre to the bottom centre
    const kd = ease.cubicInOut(seg(t, T.slot0, T.slot1));
    const tintOp = 0.42 * sstep(T.slot0, T.slot0 + 0.45, t) + 0.25 * Math.max(0, pulse(t, T.tap, 1, 7, 14));
    KIT.attr(E.tint, 'fill-opacity', fix(tintOp, 3)); KIT.attr(E.stripes, 'opacity', fix(sstep(T.slot0 + 0.2, T.slot0 + 0.7, t), 3));
    E.dashes.forEach(d => { KIT.attr(d, 'stroke-dasharray', dashArray(kd * E.slotHalf, E.slotHalf)); KIT.attr(d, 'visibility', kd > 0 ? 'visible' : 'hidden'); });
    // the tap's pulse: a solid outline leaves the slot and fades (the slot itself never moves)
    const kg = seg(t, T.tap, T.tap + 0.5);
    put(E.ghost, t < T.tap || kg >= 1 ? { op: 0, base: '' } : { s: 1 + 0.16 * ease.cubicOut(kg), op: 0.9 * (1 - kg), base: '' });
    put(E.urlRow, {}); put(E.url, life(t, T.url, { y: 10 }, 'soft'));
    // "משחקים מכאן" lands with the tap; the arrow bobs twice and settles by 7.4
    const kh = K(t, T.here, 'pop');
    put(E.here, t < T.here ? { op: 0 } : { s: lerp(1.7, 1, kh), r: lerp(-12, 0, kh), op: clamp(kh * 3) });
    const u = seg(t, T.bob0, T.bob1), bob = u > 0 && u < 1 ? 6 * Math.pow(Math.sin(2 * Math.PI * u), 2) * (1 - 0.45 * u) : 0;
    put(E.arrow, { y: bob, base: '' });
  }

  // ───────────────────────────── sound (MUSIC.md §4) ─────────────────────────────
  function events() {
    const c = el => { const r = M(el); return [r.x + r.w / 2, r.y + r.h / 2]; };
    const mark = M(E.wordmark), my = mark.y + mark.h / 2;
    E.letters.forEach((l, i) => ev(T.word + i * T.wordStep + 0.09, i === 4 ? 'logo_hit' : 'letter', 215 + (2 - i) * 40, my, i === 4 ? 1 : 0.4));
    ev(T.bar + 0.03, 'swish', 215, my + 30, 0.3);
    ev(T.adult + 0.03, 'pop', 370, gyOf(420), 0.35);
    ev(T.live, 'stamp', ...c(E.liveRow), 0.4);
    ev(T.punch + 0.02, 'punch', ...c(E.pitchRow), 0.32);
    E.chips.forEach((ch, i) => ev(T.chips[i], 'bubble', ...c(ch), 0.3 + 0.04 * i));
    ev(T.slot0, 'swish', 215, SLOT.cy, 0.35);
    ev(T.tap, 'confirm', 215, SLOT.cy, 1);
    ev(T.here + 0.03, 'stamp_soft', ...c(E.hereRow), 0.6);
    ev(T.wink, 'glance', 215, gyOf(470), 0.5);
  }

  // the finger comes in from the lower right and taps the middle of the slot on the crash
  KIT.finger(() => ({
    knots: [{ t: T.fIn, x: 345, y: 830 }, { t: T.tap - 0.16, x: 226, y: SLOT.cy + 8 }, { t: T.tap, x: 215, y: SLOT.cy },
      { t: T.fOut, x: 370, y: 860 }],
    taps: [T.tap], windows: [[T.fIn, T.fOut]],
  }));

  const music = { segments: [{ t0: 0, t1: 8, track: 33.557 }], gain: 0.26, nudge: 0.03, sections: [[0, 0.72], [5.95, 1.3]] };

  KIT.run({
    T, build, measure, update, events, music,
    camera: () => ({ keys: [{ t: 0, ...Pt(CAM.gx, CAM.gy, CAM.zoom) }], hits: [[T.hit - 0.03, 5, 12]], rests: [[-1, 99]] }),
    track: box => {
      box('live', E.live); box('cast', E.cast); box('wordmark', E.wordmark); box('adult', E.adult); box('pitch', E.pitch);
      E.chips.forEach((c, i) => box('chip' + i, c)); box('here', E.here); box('slot', E.slot); box('url', E.url);
    },
  });
  window.__storySafe = (t) => {                                    // boxes outside Instagram's story safe zone at t
    const b = window.__track(t), out = [];
    for (const k in b) { const r = b[k]; if (r.op < 0.05 || k === 'finger') continue; if (r.y < STORY_SAFE.top || r.y + r.h > H - STORY_SAFE.bottom || r.x < 0 || r.x + r.w > W) out.push([k, Math.round(r.y), Math.round(r.y + r.h)]); }
    return out;
  };
})();
