// Once a week the battalion's PT instructor (מדא"גית) comes to Netivot for the platoon's
// fitness test (כש"ג): push-ups, sit-ups, and two laps of the track against the clock.
// The two laps are run on the feet, not the stick: tap left, right, left, right. Every switch
// of foot is a stride that adds speed; the same foot twice is a stumble; stop and you slow
// down fast. Steady state is about stride × taps-per-second / decay; measured on the two laps:
//   lazy  ~3 taps/s   → ~45 s → run score 35 (fails the run)
//   steady ~4 taps/s  → ~33 s → 70
//   phone ~5.5 taps/s → ~26 s → 85 (passes, with effort)
//   fast  ~8 taps/s   → ~19 s → 100
const KASHAG_TAP = {
  stride: 52,     // px/s added by each switch of foot
  decay: 2.4,     // per second: speed × e^(−decay·t) with no taps
  max: 200,       // px/s, a bit over the normal sprint
  stumble: 0.78,  // speed kept after the same foot twice
  window: 1.4,    // seconds of taps the cadence meter averages
  times: [20, 27, 34, 42], // seconds for a run score of 100 / 85 / 70 / 55 (slower: 35)
};
// What {@madag} shouts while you run. Short, in the moment.
const KASHAG_SHOUT = {
  go: ['שמאל־ימין, שמאל־ימין! *פיייי*', 'רגליים, לא תירוצים! יאללה!'],
  stumble: ['שתי פעמים אותה רגל? זה דילוג, לא ריצה!', 'מה זה, ריקוד? שמאל ואז ימין!', 'מעדת על האוויר. כל הכבוד.'],
  slow: ['אני רואה אותך [מהלך/מהלכת]. גם סבתא שלי מהלכת. היא בת 90.', 'זה ריצה או טיול שנתי?!', 'מהר יותר! הצב מהמזנון עקף אותך!'],
  stop: ['הלו?! זה לא תחנת אוטובוס!', 'עצרת? המסלול לא רץ לבד!'],
  fast: ['וואו! מי האכיל אותך?!', '[תעשה/תעשי] לי טובה ותשאיר[/י] משהו לשבוע הבא!', 'זה כש"ג או אולימפיאדה?!'],
  lap: ['הקפה אחת! עוד אחת — ואת[ה/] חופשי[/ה]. עד השבוע הבא.'],
  last: ['ישורת אחרונה! תן[/י] הכל!'],
};

const Kashag = {
  // Days 2, 9, 16...: mid-morning, right after the lineup.
  plan(day) {
    const S = G.state;
    if (day % 7 === 2 && Cast.get('madag')) S.dayFlags.kashagAt = 9 * 60 + 20;
  },
  update(dt = 0) {
    const S = G.state;
    if (this.tap) this.updateTap(dt);
    if (!S.dayFlags.kashagAt || S.dayFlags.kashag || S.clock < S.dayFlags.kashagAt) return;
    if (World.id !== 'netivot' || G.alert || Mini.active || UI.busy || Boss.active || Story.ctl || Story.run || Story.gateShift || !Game.calm()) return;
    this.arrive();
  },
  async arrive() {
    const S = G.state;
    S.dayFlags.kashag = true;
    Game.addVisitor('madag', SPOTS.gate);
    Game.setNpcSpot('madag', SPOTS.track);
    Sound.whistle();
    Story.addTask('kashag');
    UI.toast('⏱️ {@madag} הגיעה מהגדוד — מבחן כש"ג לכל הפלגה!', 'bad');
    await UI.cutscene([{ img: Assets.scene('kashag'), who: '{@madag} · מדא"גית הגדוד', text: '*פיייייייייי!* "בוקר טוב פלגה! מבחן כש"ג: שכיבות סמיכה, כפיפות בטן, ושתי הקפות על המסלול. מי שמתלונן — מתחיל ראשון."' }]);
    await UI.talk([{ who: 'commander', text: '{name}, [רוץ/רוצי] למסלול הכושר. {@madag} מחכה. ובלי "כואבת לי הברך" — היא כבר שמעה את כל התירוצים.' }]);
  },

  async talk(n) {
    if (!Story.has('kashag')) {
      await UI.talk([{ who: 'madag', text: pick(['עוד שבוע, אותה שעה. תתאמן[/י] בינתיים!', 'מי שרץ כל יום — לא מפחד ממני.', 'שתית מים היום? לא קפה. מים.']) }]);
      return;
    }
    if (this.running) { UI.toast('קודם לסיים את ההקפות! 🏃'); return; }
    const go = await UI.talk([
      { who: 'madag', text: 'אז את[ה/] {name}. שלושה תרגילים, בלי הפסקה ביניהם. שכיבות סמיכה: למטה עד שהחזה כמעט נוגע, ולמעלה. מוכן[/ה]?', choices: [{ label: 'כן! 💪', value: 1 }, { label: 'רגע, אני שותה מים', value: 0 }] },
    ]);
    if (!go) return;
    const push = await Mini.open('reps', { kind: 'push' });
    await UI.talk([{ who: 'madag', text: `${push.reps} שכיבות. ${push.reps >= 35 ? 'יפה מאוד!' : push.reps >= 20 ? 'סביר. אפשר יותר.' : 'אוי. נעבוד על זה.'} עכשיו על הגב — כפיפות בטן!` }]);
    const sit = await Mini.open('reps', { kind: 'sit' });
    await UI.talk([{ who: 'madag', text: `${sit.reps} כפיפות. ועכשיו החלק האהוב על כולם: שתי הקפות על המסלול. *פיייי* — יאללה!` }]);
    this.result = { push: push.reps, sit: sit.reps };
    this.running = true;
    Story.startRun({ kashag: true });
    this.startTap();
  },

  // ---------- the tap run ----------
  startTap() {
    const P = G.player;
    this.tap = { x: P.x, y: P.y, v: 0, vs: 0, run: false, last: null, taps: [], cad: 0, stumbles: 0, strides: 0, sayCd: 0, slowT: 0, stopT: 0, said: {}, trip: 0 };
    document.body.classList.add('kashag-tap');
    let el = $('#kashag-tap');
    if (!el) { el = document.createElement('div'); el.id = 'kashag-tap'; document.body.appendChild(el); }
    el.innerHTML = `<div class="kt-say hidden"></div>
      <div class="kt-meter"><div class="kt-bar"><b></b><i class="kt-ok"></i></div><span class="kt-cad">0.0</span><span class="kt-unit">צעדים לשנייה</span></div>
      <button class="kt-foot kt-l" data-side="L"><span class="kt-ic">🦶</span><span>שמאל</span><kbd>← A</kbd></button>
      <button class="kt-foot kt-r" data-side="R"><span>ימין</span><span class="kt-ic">🦶</span><kbd>D →</kbd></button>`;
    el.classList.remove('hidden');
    el.querySelectorAll('.kt-foot').forEach(b => {
      b.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); this.step(b.dataset.side); };
    });
    // The arrows (and A/D) are the feet now: kept from the game, which would turn the camera.
    if (!this.keyFn) {
      this.keyFn = (e) => {
        if (!this.tap || G.alert || UI.busy || Mini.active) return;
        const side = (e.code === 'ArrowLeft' || e.code === 'KeyA') ? 'L' : (e.code === 'ArrowRight' || e.code === 'KeyD') ? 'R' : null;
        if (!side) return;
        e.preventDefault(); e.stopPropagation();
        G.keys.delete(e.code);
        if (e.type === 'keydown' && !e.repeat) this.step(side);
      };
      window.addEventListener('keydown', this.keyFn, true);
      window.addEventListener('keyup', this.keyFn, true);
    }
    this.shout('go');
  },
  stopTap() {
    this.tap = null;
    document.body.classList.remove('kashag-tap');
    const el = $('#kashag-tap');
    if (el) el.classList.add('hidden');
  },
  // One foot down.
  step(side) {
    const R = this.tap, T = KASHAG_TAP;
    if (!R || G.alert || UI.busy) return;
    const btn = $(`#kashag-tap .kt-${side === 'L' ? 'l' : 'r'}`);
    if (btn) { btn.classList.remove('hit', 'bad'); void btn.offsetWidth; }
    if (R.last === side) {
      R.v *= T.stumble;
      R.stumbles++;
      R.trip = 0.35;
      Sound.bump();
      if (btn) btn.classList.add('bad');
      if (R.stumbles === 1 || Math.random() < 0.35) this.shout('stumble');
    } else {
      R.v = Math.min(T.max, R.v + T.stride * (R.last ? 1 : 0.6));
      R.taps.push(performance.now() / 1000);
      R.strides++;
      if (btn) btn.classList.add('hit');
    }
    R.last = side;
  },
  shout(kind, force = false) {
    const R = this.tap;
    if (!R || (!force && R.sayCd > 0)) return;
    R.sayCd = 3.2;
    const text = fmt(pick(KASHAG_SHOUT[kind]));
    const n = Game.npc('madag');
    if (n) n.bubble = { text, t: 2.6 };
    const el = $('#kashag-tap .kt-say');
    if (el) { el.textContent = `📣 ${fmt('{@madag}')}: ${text}`; el.classList.remove('hidden'); clearTimeout(this.sayT); this.sayT = setTimeout(() => el.classList.add('hidden'), 2600); }
  },
  // Every frame of the run (after the game moved the player): the feet decide where you are.
  updateTap(dt) {
    const R = this.tap, T = KASHAG_TAP, run = Story.run, P = G.player;
    if (!run || !run.kashag || !this.running) { this.stopTap(); return; }
    // A siren beats the test: the stick is yours again until it's over.
    if (G.alert) { $('#kashag-tap').classList.add('hidden'); document.body.classList.remove('kashag-tap'); R.x = P.x; R.y = P.y; return; }
    $('#kashag-tap').classList.remove('hidden'); document.body.classList.add('kashag-tap');
    R.v *= Math.exp(-T.decay * dt);
    if (R.v < 3) R.v = 0;
    R.trip = Math.max(0, R.trip - dt);
    R.sayCd -= dt;
    const now = performance.now() / 1000;
    R.taps = R.taps.filter(t => now - t < T.window);
    R.cad = R.taps.length / T.window;
    // Along the track: toward the next yellow point, or the one after once it's in reach.
    let p = run.points[run.idx];
    if (!p) return;
    if (Math.hypot(p.x - R.x, p.y - R.y) < 40 && run.points[run.idx + 1]) p = run.points[run.idx + 1];
    const dx = p.x - R.x, dy = p.y - R.y, d = Math.hypot(dx, dy) || 1;
    const go = Math.min(d, R.v * dt);
    R.x += dx / d * go; R.y += dy / d * go;
    P.x = R.x; P.y = R.y;
    P.vx = dx / d * R.v; P.vy = dy / d * R.v;
    // The legs follow the tap rate: a smoothed speed drives the clip and its stride (each tap
    // is a kick, so the raw speed is a sawtooth). Under a jog it's the walk clip.
    R.vs += (R.v - R.vs) * Math.min(1, dt * 4);
    R.run = R.run ? R.vs > 85 : R.vs > 115;
    P.speed = R.vs;
    P.moving = R.v > 8 || R.vs > 12;
    P.running = R.run;
    if (P.moving) {
      const want = Math.atan2(dy, dx) + (R.trip ? Math.sin(R.trip * 40) * 0.25 : 0);
      P.angle += Math.atan2(Math.sin(want - P.angle), Math.cos(want - P.angle)) * Math.min(1, dt * 10);
      // The camera swings in behind the runner.
      const yaw = Math.atan2(-dx, -dy);
      Scene3D.yaw += Math.atan2(Math.sin(yaw - Scene3D.yaw), Math.cos(yaw - Scene3D.yaw)) * Math.min(1, dt * 1.8);
    }
    // The meter: cadence, with the "passing" pace marked.
    const el = $('#kashag-tap');
    const bar = el.querySelector('.kt-bar b');
    bar.style.width = Math.min(100, R.v / T.max * 100) + '%';
    bar.className = R.v >= 115 ? 'hot' : R.v >= 75 ? 'ok' : '';
    el.querySelector('.kt-ok').style.left = 115 / T.max * 100 + '%';
    el.querySelector('.kt-cad').textContent = R.cad.toFixed(1);
    // What she shouts.
    R.slowT = R.strides > 6 && R.v > 0 && R.vs < 80 ? R.slowT + dt : 0;
    R.stopT = R.v === 0 ? R.stopT + dt : 0;
    if (R.stopT > 1.6 && R.strides) { R.stopT = -3; this.shout('stop'); }
    else if (R.slowT > 3) { R.slowT = -7; this.shout('slow'); }
    else if (R.vs > 160 && !R.said.fast) { R.said.fast = true; this.shout('fast'); }
    const half = Math.floor(run.points.length / 2);
    if (run.idx >= half && !R.said.lap) { R.said.lap = true; this.shout('lap', true); }
    if (run.idx === run.points.length - 1 && !R.said.last) { R.said.last = true; this.shout('last', true); }
  },
  // Called by Story when the two laps are done.
  async runDone(time) {
    this.running = false;
    const stumbles = this.tap ? this.tap.stumbles : 0;
    this.stopTap();
    const r = this.result || { push: 0, sit: 0 };
    const grade = (v, full) => Math.max(0, Math.min(100, Math.round(v / full * 100)));
    const [a, b, c, d] = KASHAG_TAP.times;
    const runScore = time < a ? 100 : time < b ? 85 : time < c ? 70 : time < d ? 55 : 35;
    const total = Math.round((grade(r.push, 40) + grade(r.sit, 50) + runScore) / 3);
    const label = total >= 90 ? 'מצוין' : total >= 75 ? 'טוב' : total >= 60 ? 'עובר' : 'נכשל';
    Story.complete('kashag', total >= 90 ? 12 : total >= 75 ? 8 : total >= 60 ? 4 : -4, `כש"ג: ${label}`);
    Game.addStat('energy', -18);
    if (total >= 90) Game.achieve('kashag');
    const S = G.state;
    S.stats.kashag = Math.max(S.stats.kashag || 0, total);
    await UI.talk([
      { who: 'madag', text: `${time.toFixed(1)} שניות${stumbles >= 3 ? `, ו־${stumbles} מעידות על כלום` : ''}. מסכמת: ${r.push} שכיבות, ${r.sit} כפיפות, וריצה. ציון ${total} — ${label}!` },
      { who: 'madag', text: total >= 90 ? 'וואו. אני רושמת אותך לקבוצת הכושר של הגדוד. סתם. ...או שלא.' : total >= 60 ? 'עברת. בשבוע הבא אני רוצה לראות שיפור, ואני זוכרת מספרים.' : 'נכשלת. לא נורא, בשבוע הבא מבחן חוזר. בינתיים — מסלול כושר כל בוקר.' },
    ]);
    Game.setNpcSpot('madag', SPOTS.gate);
    setTimeout(() => Game.removeVisitor('madag'), 9000);
  },
};

// The rep counters for the test.
Minigames.reps = function (box, opts, done) {
  const push = opts.kind === 'push';
  const time0 = 30;
  let time = time0, reps = 0, miss = 0, finished = false, pos = 0, dir = 1, cool = 0, last = null;
  box.innerHTML = `<h3>${push ? '💪 שכיבות סמיכה' : '🔄 כפיפות בטן'} — 30 שניות</h3>
    <div class="sub">${push ? '[לחץ/לחצי] (רווח / הכפתור) כשהסמן בתוך האזור הירוק — כל לחיצה בזמן היא שכיבה. ככל שמתעייפים הוא זז מהר יותר.' : '[לחץ/לחצי] לסירוגין ← ואז → (או על הכפתורים), כמה שיותר מהר. כל זוג הוא כפיפה.'}</div>
    <div class="stats"><span>זמן: <span class="v" id="rp-t">30</span></span><span>${push ? 'שכיבות' : 'כפיפות'}: <span class="v" id="rp-n">0</span></span>${push ? '<span>לא נספרו: <span class="v" id="rp-m">0</span></span>' : ''}</div>
    <div class="reps-fig" id="rp-fig">${push ? '🙇' : '🧘'}</div>
    ${push ? '<div class="reps-bar"><div class="zone" id="rp-z"></div><div class="needle" id="rp-x"></div></div><div class="actions"><button class="btn" id="rp-go">⬇ למטה!</button></div>'
      : '<div class="actions reps-two"><button class="btn" data-k="ArrowLeft">←</button><button class="btn" data-k="ArrowRight">→</button></div>'}`;
  const $n = box.querySelector('#rp-n'), $t = box.querySelector('#rp-t'), fig = box.querySelector('#rp-fig');
  const bump = () => { fig.classList.remove('up'); void fig.offsetWidth; fig.classList.add('up'); };
  const zone = () => { const w = Math.max(10, 26 - reps * 0.35); return { a: 50 - w / 2, b: 50 + w / 2 }; };
  const press = (k) => {
    if (finished) return;
    if (push) {
      if (cool > 0) return;
      const z = zone();
      if (pos >= z.a && pos <= z.b) { reps++; Sound.click(); bump(); }
      else { miss++; Sound.bad(); box.querySelector('#rp-m').textContent = miss; cool = 0.45; }
    } else {
      if (k === last) return;
      if (last && k !== last) { reps += 0.5; if (reps % 1 === 0) { Sound.click(); bump(); } }
      last = k;
    }
    $n.textContent = Math.floor(reps);
  };
  Mini.onKey(e => {
    if (push && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'ArrowDown')) { e.preventDefault(); press(); }
    if (!push && (e.code === 'ArrowLeft' || e.code === 'KeyA')) { e.preventDefault(); press('ArrowLeft'); }
    if (!push && (e.code === 'ArrowRight' || e.code === 'KeyD')) { e.preventDefault(); press('ArrowRight'); }
  });
  if (push) box.querySelector('#rp-go').onpointerdown = (e) => { e.preventDefault(); press(); };
  else box.querySelectorAll('[data-k]').forEach(b => b.onpointerdown = (e) => { e.preventDefault(); press(b.dataset.k); });
  Mini.loop(dt => {
    if (finished) return;
    time -= dt;
    cool -= dt;
    $t.textContent = Math.max(0, time).toFixed(1);
    if (push) {
      pos += dir * dt * (70 + reps * 3.2);
      if (pos > 100) { pos = 100; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
      const z = zone();
      const zl = box.querySelector('#rp-z');
      zl.style.left = z.a + '%'; zl.style.width = (z.b - z.a) + '%';
      box.querySelector('#rp-x').style.left = pos + '%';
    }
    if (time <= 0) {
      finished = true;
      const n = Math.floor(reps);
      Mini.result(box, { title: push ? 'שכיבות סמיכה' : 'כפיפות בטן', big: n, ok: n >= (push ? 20 : 25), lines: [n >= (push ? 35 : 45) ? 'מעולה! 🔥' : n >= (push ? 20 : 25) ? 'עברת.' : 'צריך עוד אימון...'] }, () => done({ reps: n }));
    }
  });
};
