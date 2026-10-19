// Once a week the battalion's PT instructor (מדא"גית) comes to Netivot for the platoon's
// fitness test (כש"ג): push-ups, sit-ups, and two laps of the track against the clock.
const Kashag = {
  // Days 2, 9, 16...: mid-morning, right after the lineup.
  plan(day) {
    const S = G.state;
    if (day % 7 === 2 && Cast.get('madag')) S.dayFlags.kashagAt = 9 * 60 + 20;
  },
  update() {
    const S = G.state;
    if (!S.dayFlags.kashagAt || S.dayFlags.kashag || S.clock < S.dayFlags.kashagAt) return;
    if (World.id !== 'netivot' || G.alert || Mini.active || UI.busy || Boss.active || Story.ctl || Story.run || Story.gateShift) return;
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
  },
  // Called by Story when the two laps are done.
  async runDone(time) {
    this.running = false;
    const r = this.result || { push: 0, sit: 0 };
    const grade = (v, full) => Math.max(0, Math.min(100, Math.round(v / full * 100)));
    const runScore = time < 40 ? 100 : time < 55 ? 85 : time < 70 ? 70 : time < 85 ? 55 : 35;
    const total = Math.round((grade(r.push, 40) + grade(r.sit, 50) + runScore) / 3);
    const label = total >= 90 ? 'מצוין' : total >= 75 ? 'טוב' : total >= 60 ? 'עובר' : 'נכשל';
    Story.complete('kashag', total >= 90 ? 12 : total >= 75 ? 8 : total >= 60 ? 4 : -4, `כש"ג: ${label}`);
    Game.addStat('energy', -18);
    if (total >= 90) Game.achieve('kashag');
    const S = G.state;
    S.stats.kashag = Math.max(S.stats.kashag || 0, total);
    await UI.talk([
      { who: 'madag', text: `${time.toFixed(1)} שניות. מסכמת: ${r.push} שכיבות, ${r.sit} כפיפות, וריצה. ציון ${total} — ${label}!` },
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
