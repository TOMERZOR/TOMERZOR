/* השתול · S2 "three question pairs, rapid fire" (18 s, 1080×1920). See STORYBOARD.md.
 * Three stations side by side in the world (right to left, the way Hebrew reads), one take. At each one the game's
 * question card lands, the plant answers, and on the bar line the card turns over to the plant's own question in the
 * plant's pink. The plants' faces carry the joke. The shared end card closes it (../endcard.js).
 * Every frame is a pure function of t. Positions are station-local game px (one station = a 432×768 frame at zoom 1).
 */
(function () {
  'use strict';
  const { $, $$, mk, put, hide, txt, html, cls, life, lerp, clamp, seg, sstep, spring, pulse, K, M, Pt, center, ev, ease, G, CODES, OM } = KIT;

  // ── the copy: one plain object, so another set of pairs can be swapped in without touching the animation ──
  const DATA = {
    intro: ['שאלה אחת לכולם.', 'ולשתול? אחרת לגמרי.'],
    labels: { all: 'כולם נשאלו', plant: 'אבל השתול נשאל' },
    chip: n => `שאלה <span class="num">${n}</span> מתוך <span class="num">3</span>`,
    caught: 'נתפס!',
    cta: 'תצליחו לתפוס את השתול?',
    stations: [   // bank ids 855, 928, 1997
      { kind: 'number', q: 'כמה שפות אתם יודעים לדבר?', answer: { type: 'number', text: '6' },
        plantQ: 'כמה טסטים עשיתם עד שעברתם?', plant: 'שירה' },
      { kind: 'player', q: 'את מי פה אפשר לזהות מקילומטר?', answer: { type: 'player', name: 'יובל' },
        plantQ: 'למי פה יש את ריח הרגליים הכי קטלני?', plant: 'איתי' },
      { kind: 'choice', q: 'כל כמה זמן אתם מתקשרים לסבתא?', answer: { type: 'choice', text: 'כל יום' },
        plantQ: 'כל כמה זמן אתם בודקים מה האקס העלה לסטורי?', plant: 'דנה' },
    ],
  };

  // ── timeline (s): anchors on the music's grid ──
  const T = {
    stA: 0.0, stB: 0.5,                 // the two intro stickers (A is already there on frame 0)
    foldA: [0.8, 1.0],                  // A folds up into the progress chip as the card lands (the chip is born at 1.0)
    foldB: [1.72, 2.0],                 // B is held past 1.0 so it can be read, then folds into the chip too
    st: [
      { card: 1.0, bubble: 2.0, hold: 3.6, flip: 4.0, whip: 5.7 },
      { card: 6.0, bubble: 7.0, hold: 7.6, flip: 8.0, whip: 9.7 },
      { card: 10.0, bubble: 11.0, hold: 11.6, flip: 12.0 },
    ],
    caught: 13.0,
    end0: 15.0,
  };
  const TURN = 0.22;                    // the turn starts this long before the bar line and lands on it
  const GULP = 0.4;                     // after the flip: shock → the gulp
  const END = KIT.endcard({ t0: T.end0, cta: DATA.cta });
  T.dur = END.dur;                      // 18.0

  const DX = [0, -560, -1120];          // station origins (game px): right to left
  const REST = i => Pt(DX[i] + 216, 382, 1);
  const PUNCH = (i, z = 1.03) => Pt(DX[i] + 216, 381, z);
  const CAP = { number: 'q_number', player: 'q_player', choice: 'q_choice' };

  // ── build ──
  const E = { st: [] };
  let NOW = 0;
  const FACES = {
    calm: { over: { mouth: 'whistle', eyes: 'happy' } },               // innocent, whistling
    smug: { mood: 'smug' },                                                          // pleased with itself
    shock: { mood: 'shock' },                                                        // the flip
    nerv: { over: { eyes: 'wide', mouth: 'wavy', brows: 'worry', sweat: true, gaze: [-2, -4] } },  // looks up at the card
    cry: { mood: 'cry' },                                                            // caught
  };
  function build() {
    DATA.stations.forEach((d, i) => {
      const S = {}, root = mk('div', 's2st'); root.style.left = DX[i] + 'px'; S.root = root;
      // the question card: front = everyone's (cream), back = the plant's (pink); the kind chip on both
      S.card = mk('div', 's2card', root); S.card.__base = 'rotate(-1.3deg)';
      S.flip = mk('div', 's2flip', S.card);
      S.front = mk('div', 's2face s2front', S.flip, window.S2CAP[CAP[d.kind]]);
      S.back = mk('div', 's2face s2back', S.flip, window.S2CAP[CAP[d.kind]]);
      S.back.__base = 'rotateY(180deg)';
      const fq = $('.answer__q-text', S.front), bq = $('.answer__q-text', S.back);
      [fq, bq].forEach(h => h.style.removeProperty('--q'));
      fq.textContent = d.q; bq.textContent = d.plantQ;
      $('.sticker', S.back).classList.add('sticker--yellow');
      S.words = KIT.splitWords(fq);
      // the plant: rays, the full-body figure with its faces, the name plate
      S.fig = mk('div', 's2fig', root);
      S.rays = mk('div', 'result__rays', S.fig);
      S.sq = mk('div', 's2sq', S.fig);
      S.faces = {};
      for (const f in FACES) S.faces[f] = mk('span', '', S.sq, KIT.avatar(CODES[d.plant], { size: 250, variant: 'figure', ...FACES[f] }));
      const pw = mk('div', 's2platewrap', root);
      S.plate = mk('span', 'sticker sticker--yellow s2plate', pw, d.plant); S.plate.style.setProperty('--tilt', (i % 2 ? -2 : 2) + 'deg');
      // the answer bubble (the result card's), by kind
      const bw = mk('div', 's2bubwrap', root);
      let inner;
      if (d.answer.type === 'number') inner = `<span class="s2num num">${d.answer.text}</span>`;
      else if (d.answer.type === 'player') {
        const tmp = document.createElement('div'); tmp.innerHTML = window.S2CAP.ans_player;   // the reveal's player answer
        const a = tmp.firstChild; a.classList.remove('ans--xl'); a.style.removeProperty('--chars');
        $('.avatar', a).outerHTML = KIT.avatar(CODES[d.answer.name], { size: 46 });
        $('.ans__text', a).textContent = d.answer.name;
        inner = a.outerHTML;
      } else inner = `<span class="s2word">${d.answer.text}</span>`;
      S.bub = mk('div', 'result__bubble s2bub', bw, `<b class="result__bubble-text">${inner}</b>`);
      if (i === 2) { const vw = mk('div', 's2verdict', root); S.verdict = mk('span', 'sticker sticker--mint', vw, DATA.caught); S.verdict.style.setProperty('--tilt', '-11deg'); }
      if (i === 0) {
        const iw = mk('div', 's2intro', root);
        const ra = mk('div', 's2introrow', iw), rb = mk('div', 's2introrow', iw); ra.style.top = '292px'; rb.style.top = '362px';
        S.introA = mk('span', 'sticker sticker--white', ra, DATA.intro[0]); S.introA.style.setProperty('--tilt', '-4deg');
        S.introB = mk('span', 'sticker', rb, DATA.intro[1]); S.introB.style.setProperty('--tilt', '3deg');
      }
      E.st.push(S);
    });
    // what rides with the camera from station to station: the progress chip and the label sticker
    E.ride = mk('div', 's2ride');
    const cw = mk('div', 's2chipwrap', E.ride);
    E.chip = mk('span', 'chip chip--yellow s2chip', cw, DATA.chip(1));
    E.label = mk('div', 's2label', E.ride);
    E.labW = mk('span', 'sticker sticker--white', E.label, DATA.labels.all); E.labW.style.setProperty('--tilt', '-3deg');
    E.labP = mk('span', 'sticker', E.label, DATA.labels.plant); E.labP.style.setProperty('--tilt', '-3deg');
  }

  // ── camera ──
  const whipCurve = ease.expoInOut;
  function camera() {
    const s = T.st, keys = [
      { t: 0, ...Pt(246, 454, 1.36) },                                   // frame 0: close on the plant and the stickers
      { t: 0.84, ...Pt(244, 450, 1.34), curve: ease.sineInOut },
      { t: 1.26, ...REST(0), curve: ease.cubicInOut },                   // pull back as the card lands
      { t: s[0].flip, ...REST(0) },
      { t: s[0].flip + 0.32, ...PUNCH(0), curve: ease.expoOut },         // the flip lands: a small push in
      { t: s[0].whip, ...PUNCH(0) },
      { t: s[1].card, ...REST(1), curve: whipCurve },                    // whip, right to left
      { t: s[1].flip, ...REST(1) },
      { t: s[1].flip + 0.32, ...PUNCH(1), curve: ease.expoOut },
      { t: s[1].whip, ...PUNCH(1) },
      { t: s[2].card, ...REST(2), curve: whipCurve },
      { t: s[2].flip, ...REST(2) },
      { t: s[2].flip + 0.32, ...PUNCH(2, 1.035), curve: ease.expoOut },
      { t: T.caught, ...PUNCH(2, 1.035) },
      { t: T.caught + 0.3, ...Pt(DX[2] + 216, 379, 1.04), curve: ease.expoOut },
    ];
    return {
      keys,
      hits: [[s[0].card, 4, 12], [s[1].card, 5, 12], [s[2].card, 5, 12],
        [s[0].flip, 11, 9], [s[1].flip, 12, 9], [s[2].flip, 14, 9], [T.caught, 16, 8]],
      rests: [[0, 1.9], [3.4, s[0].whip - 0.08], [s[1].card + 0.1, s[1].whip - 0.08], [s[2].card + 0.1, T.end0]],
    };
  }

  // ── helpers ──
  function faceAt(i, t) {
    const s = T.st[i];
    if (i === 2 && t >= T.caught) return 'cry';
    if (t >= s.flip + GULP) return 'nerv';
    if (t >= s.flip) return 'shock';
    if (t >= s.bubble) return 'smug';
    return 'calm';
  }
  // the label's turns: to pink as the card turns, back to white in the middle of the whip
  const LSW = [];
  T.st.forEach((s, i) => { LSW.push({ t: s.flip - 0.25, to: 'P' }); if (s.whip) LSW.push({ t: s.whip + 0.06, to: 'W' }); });
  function labelAt(t) {
    let shown = 'W', sx = 1;
    for (const w of LSW) {
      const u = (t - w.t) / 0.22;
      if (u >= 0.5) shown = w.to;
      if (u > 0 && u < 1) sx = Math.max(0.02, Math.abs(Math.cos(Math.PI * u)));
    }
    return { shown, sx };
  }
  const count = t => (t < T.st[0].whip + 0.15 ? 1 : t < T.st[1].whip + 0.15 ? 2 : 3);

  // ── update ──
  function update(t) {
    NOW = t;
    const gone = t >= T.end0 + 0.75;                                     // the whip has carried the scene off by then
    E.st.forEach((S, i) => {
      const s = T.st[i], d = DATA.stations[i];
      put(S.root, { op: gone ? 0 : 1, base: '' });
      if (gone) return;
      // the card drops in and lands on s.card (the game's bouncy entrance)
      const t0 = s.card - 0.11, k = K(t, t0, 'bouncy');
      put(S.card, t < t0 ? { op: 0 } : { y: lerp(-110, 0, k), r: lerp(-7, 0, k), s: lerp(0.88, 1, k) * (1 + pulse(t, s.card + 0.02, 0.025, 12, 30)), op: clamp(k * 2.2) });
      S.words.forEach((w, j) => put(w, life(t, s.card + 0.06 + j * 0.06, { y: 16, s: 0.85 }, 'pop')));
      // the flip: a turn about the vertical axis, faces swapped at 90°, landing on the bar line
      const u = seg(t, s.flip - TURN, s.flip);
      let ry = 180 * u * u;
      if (t >= s.flip) ry = 180 + 10 * pulse(t, s.flip, 1, 7, 24);
      const lift = 1 + 0.07 * Math.sin(Math.PI * u) + (t >= s.flip ? pulse(t, s.flip, 0.04, 9, 26) : 0);
      put(S.flip, { ry, s: lift, base: '' });
      put(S.front, { op: ry < 90 ? 1 : 0, base: '' });
      put(S.back, { op: ry >= 90 ? 1 : 0 });
      // the plant
      const f = faceAt(i, t);
      for (const n in S.faces) put(S.faces[n], { op: n === f ? 1 : 0, base: '' });
      let sx = 1, sy = 1, y = 0, r = 0;
      const breathe = 0.012 * Math.sin(t * 3.4 + i * 1.7);
      sy += breathe; sx -= breathe * 0.6;
      if (t >= s.bubble) { const p = pulse(t, s.bubble, 0.07, 8, 22); sy += p; sx -= p * 0.6; r += 3 * pulse(t, s.bubble, 1, 6, 14); }   // pleased: a little puff
      if (t >= s.flip) { y -= 22 * Math.max(0, Math.sin(Math.min(1, (t - s.flip) / 0.26) * Math.PI)); const p = pulse(t, s.flip, 0.12, 8, 26); sy += p; sx -= p * 0.7; }   // a jump of fright
      if (t >= s.flip + GULP) { const g = Math.exp(-6 * (t - s.flip - GULP)) * Math.sin(Math.min(Math.PI, (t - s.flip - GULP) * 14)); sy -= 0.07 * g; sx += 0.04 * g; }   // the gulp
      if (i === 2 && t >= T.caught) { const p = pulse(t, T.caught, 0.1, 7, 24); sy -= p; sx += p * 0.8; r -= 4 * sstep(T.caught, T.caught + 0.3, t); }
      put(S.sq, { y, r, sx, sy, base: '' });
      KIT.rays(S.rays, t, KIT.rayAngle(t) * 2 + i * 9, 0.85, 1 + 0.08 * (t >= s.flip ? Math.exp(-4 * (t - s.flip)) : 0), '');
      cls(S.rays, 'result__rays--caught', i === 2 && t >= T.caught);
      put(S.plate, { s: 1 + (t >= s.flip ? pulse(t, s.flip + 0.05, 0.08, 9, 26) : 0) });
      // the answer: pops on its beat, does not change at the flip (the joke is that the same answer now sits under another question)
      const bk = K(t, s.bubble, 'bouncy');
      put(S.bub, t < s.bubble ? { op: 0 } : { s: lerp(0.3, 1, bk), r: lerp(10, 0, bk), op: clamp(K(t, s.bubble) * 2), base: '' });
      if (S.verdict) { const vk = K(t, T.caught, 'pop'); put(S.verdict, t < T.caught ? { op: 0 } : { s: lerp(2.4, 1, vk), r: lerp(-20, 0, vk), op: clamp(vk * 3) }); }
      if (S.introA) {
        // frame 0: A is there; B pops on 0.5; both fold into the chip (an arc up to it) and give it to the chip at fold1
        const chip = center(M(E.chip));
        [S.introA, S.introB].forEach((el, j) => {
          const F = j ? T.foldB : T.foldA, c0 = center(M(el)), kf = KIT.cubicIn(seg(t, F[0], F[1]));
          const [x, yy] = KIT.arcPt(c0, chip, kf, 50);
          const born = j === 0 ? {} : life(t, T.stB, { s: 0.4, r: -12 }, 'pop');
          if (j === 1 && t < T.stB) { put(el, { op: 0 }); return; }
          put(el, kf <= 0 ? born : { x: x - c0[0], y: yy - c0[1], s: lerp(1, 0.3, kf), r: lerp(0, j ? 8 : -8, kf), op: 1 - sstep(0.75, 1, kf) });
        });
      }
    });
    // the rider follows the camera's keyed path with a little lag, leaning into the whips
    const c0 = KIT.keyedAt(t - 0.07), c1 = KIT.keyedAt(t - 0.11);
    const vx = (c0.x - c1.x) / G / 0.04;
    put(E.ride, { x: c0.x / G - 216, r: clamp(-vx * 0.0022, -7, 7), op: gone ? 0 : 1, base: '' });
    const n = count(t), tn = n === 1 ? T.foldB[1] : T.st[n - 2].whip + 0.15, tc = T.foldA[1];
    html(E.chip, DATA.chip(n));
    put(E.chip, t < tc ? { op: 0 } : { s: lerp(0.35, 1, K(t, tc, 'pop')) * (1 + pulse(t, tn, 0.18, 8, 26)), op: 1 });
    const L = labelAt(t), lk = K(t, T.st[0].card - 0.04, 'pop');
    put(E.label, t < T.st[0].card - 0.04 ? { op: 0 } : { s: lerp(0.5, 1, lk), r: lerp(-10, 0, lk), op: clamp(lk * 2) });
    put(E.labW, { sx: L.sx, op: L.shown === 'W' ? 1 : 0 });
    put(E.labP, { sx: L.sx, op: L.shown === 'P' ? 1 : 0 });
  }

  // ── sound (kinds: MUSIC.md §4) ──
  function events() {
    const c = el => center(M(el));
    const S = E.st;
    ev(0.02, 'bubble', ...c(S[0].introA), 0.7);           // sound QA: a fuller pop, the first sound
    ev(T.stB, 'bubble', ...c(S[0].introB), 0.75);
    ev(T.foldA[0], 'swish', ...c(S[0].introA), 0.45); ev(T.foldA[1], 'cell', ...c(E.chip), 0.55);
    ev(T.foldB[0], 'swish', ...c(S[0].introB), 0.45); ev(T.foldB[1] - 0.04, 'mini', ...c(E.chip), 0.5);
    T.st.forEach((s, i) => {
      const card = c(S[i].card), fig = c(S[i].fig), bub = c(S[i].bub);
      ev(s.card - (i ? 0.07 : 0.16), 'swish', card[0], card[1], 0.55);
      ev(s.card, 'thud', card[0], card[1], 0.9);
      S[i].words.forEach((w, j) => { if (j % 2 === 0) ev(s.card + 0.06 + j * 0.06, 'word', card[0], card[1], 0.3); });
      ev(s.bubble, 'bubble', bub[0], bub[1], 0.85);           // sound QA: was 'pop', +4 dB over the groove only
      ev(s.flip - TURN, 'flip', card[0], card[1], 0.7);
      ev(s.flip, i === 2 ? 'reveal_big' : 'boom', card[0], card[1], 1);
      ev(s.flip + 0.1, ['crowd_laugh_b', 'crowd_laugh', 'crowd_laugh_c'][i], fig[0], fig[1], [0.75, 0.85, 1][i]);   // sound QA: a fresh take for the last one
      ev(s.flip + GULP, 'gulp', fig[0], fig[1] - 30, 0.8);
      ev(s.flip + GULP + 0.12, 'drip', fig[0] + 40, fig[1] - 40, 0.5);
      if (s.whip) ev(s.whip + 0.02, 'whip', card[0] - 120, card[1], 0.5);   // sound QA: the whips were louder than the flips
    });
    ev(T.st[2].flip + 0.3, 'crowd_laugh_b', ...c(S[2].fig), 0.55);      // the biggest laugh: two takes (1 s each, done before the cheer)
    ev(T.caught, 'stamp', ...c(S[2].verdict), 1);
    ev(T.caught + 0.06, 'crowd_cheer_b', ...c(S[2].fig), 0.85);
  }

  // ── fx parts ──
  KIT.sweat(() => T.st.map((s, i) => { const r = M(E.st[i].fig); return { t0: s.flip + 0.12, t1: s.flip + 1.0, x: r.x + r.w * 0.78, y: r.y + r.h * 0.34, style: 'drip' }; }));
  KIT.emoji(() => {
    const out = [], F = i => M(E.st[i].fig);
    const add = (t0, ch, i, dx, dy) => { const r = F(i); out.push({ t0, ch, from: [r.x + r.w * 0.72 + dx, r.y + r.h * 0.95], to: [r.x + r.w * 0.8 + dx, r.y + r.h * 0.3 + dy] }); };
    add(T.st[0].flip + 0.12, '😂', 0, 0, 0);
    add(T.st[1].flip + 0.12, '💀', 1, 0, 0); add(T.st[1].flip + 0.3, '😂', 1, -26, 20);
    add(T.st[2].flip + 0.12, '😂', 2, 0, 0); add(T.st[2].flip + 0.28, '💀', 2, -28, 22); add(T.caught + 0.1, '🔥', 2, -10, 6);
    return out;
  });

  // music: plan B (MUSIC.md §3) with a breath before every flip
  const music = {
    segments: [{ t0: 0, t1: 12, track: 22.557 }, { t0: 12, t1: 18, track: 35.557 }],
    sections: [[0, 0.72]], gain: 0.26, nudge: 0.03,
    stops: T.st.map(s => [s.hold, s.flip]),
  };

  KIT.run({
    T, build, camera, update, events, music,
    track: box => {
      // only the station the camera is at (the others are off frame on purpose)
      const i = NOW < T.st[0].whip + 0.15 ? 0 : NOW < T.st[1].whip + 0.15 ? 1 : 2, S = E.st[i];
      if (NOW >= T.end0 + 0.1) return;
      box('card', S.card); box('bubble', S.bub); box('plate', S.plate); box('chip', E.chip); box('label', E.label);
      if (S.verdict) box('verdict', S.verdict);
      if (S.introA) { box('introA', S.introA); box('introB', S.introB); }
    },
  });
})();
