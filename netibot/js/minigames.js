// Mini-games run in a modal overlay while the world is paused.
const Mini = {
  active: null,
  cleanup: [],

  open(name, opts = {}) {
    return new Promise(resolve => {
      const root = $('#mini');
      root.innerHTML = '';
      const box = el('div', { class: 'box' });
      root.appendChild(box);
      root.classList.remove('hidden');
      G.paused = true;
      this.active = name;
      this.cleanup = [];
      const done = (result) => {
        this.cleanup.forEach(fn => fn());
        this.cleanup = [];
        root.classList.add('hidden');
        root.innerHTML = '';
        this.active = null;
        G.paused = false;
        resolve(result || {});
      };
      Minigames[name](box, opts, done);
    });
  },

  onKey(fn) {
    const h = (e) => fn(e);
    document.addEventListener('keydown', h);
    this.cleanup.push(() => document.removeEventListener('keydown', h));
  },

  loop(fn) {
    let last = performance.now();
    let id = 0;
    let alive = true;
    const step = (t) => {
      if (!alive) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      fn(dt, t);
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    this.cleanup.push(() => { alive = false; cancelAnimationFrame(id); });
  },

  canvas(box, w = 800, h = 450) {
    const c = el('canvas', { class: 'mg', width: w, height: h });
    box.appendChild(c);
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - r.left) * (w / r.width), y: (p.clientY - r.top) * (h / r.height) };
    };
    return { c, g: c.getContext('2d'), pos };
  },

  // Result screen shared by the mini-games.
  result(box, { title, big, lines = [], ok = true }, onClose) {
    box.innerHTML = `<h3>${title}</h3><div class="result-big" style="color:${ok ? 'var(--gold)' : 'var(--red)'}">${big}</div>
      ${lines.map(l => `<p>${fmt(l)}</p>`).join('')}<div class="actions"><button class="btn" id="mg-ok">המשך</button></div>`;
    (ok ? Sound.good : Sound.bad)();
    box.querySelector('#mg-ok').onclick = onClose;
    this.onKey(e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); onClose(); } });
  },
};

const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const KEYMAP = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight' };

const Minigames = {
  // ---------- quick-time key sequence (beds, lockers, safety lock) ----------
  qte(box, opts, done) {
    const len = opts.length || 5;
    const keys = Object.keys(ARROWS);
    const seq = Array.from({ length: len }, () => keys[Math.floor(Math.random() * 4)]);
    let idx = 0, errors = 0;
    let timeLeft = opts.time || 8;
    box.innerHTML = `<h3>${fmt(opts.title || 'רצף')}</h3><div class="sub">${fmt(opts.sub || '[הקש/הקישי] את החצים לפי הסדר (חצים/WASD או הכפתורים).')}</div>
      <div class="stats"><span>זמן: <span class="v" id="q-t"></span></span><span>טעויות: <span class="v" id="q-e">0</span></span></div>
      <div class="qte">${seq.map((k, i) => `<div class="k" data-i="${i}">${ARROWS[k]}</div>`).join('')}</div>
      <div class="pad"><span></span><button data-k="ArrowUp">↑</button><span></span><button data-k="ArrowLeft">←</button><button data-k="ArrowDown">↓</button><button data-k="ArrowRight">→</button></div>`;
    const render = () => box.querySelectorAll('.qte .k').forEach((k, i) => {
      k.classList.toggle('ok', i < idx);
      k.classList.toggle('cur', i === idx);
    });
    render();
    let finished = false;
    const finish = (success) => {
      if (finished) return;
      finished = true;
      if (opts.silent) { done({ success, errors }); return; }
      Mini.result(box, { title: opts.title, big: success ? '✔' : '✘', ok: success, lines: [success ? 'מצוין!' : 'נגמר הזמן...'] }, () => done({ success, errors }));
    };
    const press = (k) => {
      if (finished) return;
      if (k === seq[idx]) { idx++; Sound.click(); render(); if (idx >= seq.length) finish(true); }
      else { errors++; Sound.bad(); box.querySelector('#q-e').textContent = errors; }
    };
    Mini.onKey(e => {
      const k = KEYMAP[e.code] || e.code;
      if (ARROWS[k]) { e.preventDefault(); press(k); }
    });
    box.querySelectorAll('.pad button').forEach(b => b.onclick = () => press(b.dataset.k));
    Mini.loop(dt => {
      if (finished) return;
      timeLeft -= dt;
      const t = box.querySelector('#q-t');
      if (t) t.textContent = Math.max(0, timeLeft).toFixed(1);
      if (timeLeft <= 0) finish(false);
    });
  },

  // ---------- launcher canister replacement ----------
  reload(box, opts, done) {
    const perkBonus = G.perk && G.perk.key === 'reload' ? 15 : 0;
    let timeLeft = (opts.time || 80) + perkBonus;
    let errors = 0;
    let stepIdx = 0;
    const steps = ['נעילת בטיחות', 'שחרור תפסים', 'הכנסת המארז', 'חיבור כבלים', 'בדיקת תקינות'];
    let over = false;
    box.innerHTML = `<h3>החלפת מארז — ${opts.launcher || 'משגר'}</h3>
      <div class="sub">${opts.exam ? 'מבחן הסמכה: ' : ''}בצע[/י] את כל השלבים לפני שנגמר הזמן. ${perkBonus ? '(יתרון גדוד 947: +15 שניות)' : ''}</div>
      <div class="stats"><span>זמן: <span class="v" id="r-t"></span></span><span>טעויות: <span class="v" id="r-e">0</span></span></div>
      <div class="steps">${steps.map((s, i) => `<div class="step" data-i="${i}">${i + 1}. ${s}</div>`).join('')}</div>
      <div id="r-stage"></div>`;
    const stage = box.querySelector('#r-stage');
    const err = () => { errors++; timeLeft -= 2; Sound.bad(); box.querySelector('#r-e').textContent = errors; };
    const markSteps = () => box.querySelectorAll('.step').forEach((s, i) => {
      s.classList.toggle('done', i < stepIdx);
      s.classList.toggle('cur', i === stepIdx);
    });
    const next = () => { stepIdx++; Sound.good(); markSteps(); runStep(); };

    const runStep = () => {
      if (over) return;
      if (stepIdx >= steps.length) return finish(true);
      stage.innerHTML = '';
      if (stepIdx === 0) {
        // Safety lock: arrow sequence.
        const keys = Object.keys(ARROWS);
        const seq = Array.from({ length: 5 }, () => keys[Math.floor(Math.random() * 4)]);
        let i = 0;
        stage.innerHTML = `<p>[הקש/הקישי] את קוד נעילת הבטיחות:</p><div class="qte">${seq.map(k => `<div class="k">${ARROWS[k]}</div>`).join('')}</div>
          <div class="pad"><span></span><button data-k="ArrowUp">↑</button><span></span><button data-k="ArrowLeft">←</button><button data-k="ArrowDown">↓</button><button data-k="ArrowRight">→</button></div>`;
        const ks = stage.querySelectorAll('.qte .k');
        const render = () => ks.forEach((k, j) => { k.classList.toggle('ok', j < i); k.classList.toggle('cur', j === i); });
        render();
        const press = (k) => {
          if (stepIdx !== 0) return;
          if (k === seq[i]) { i++; Sound.click(); render(); if (i >= seq.length) next(); } else err();
        };
        stage.querySelectorAll('.pad button').forEach(b => b.onclick = () => press(b.dataset.k));
        stage._key = (k) => press(k);
      } else if (stepIdx === 1) {
        // Latches: click in numbered order.
        const order = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
        let want = 1;
        stage.innerHTML = `<p>[שחרר/שחררי] את 4 התפסים לפי הסדר 1→4:</p><div class="row" style="justify-content:center">${order.map(n => `<button class="btn small ghost" data-n="${n}" style="min-width:70px;font-size:22px">🔒${n}</button>`).join('')}</div>`;
        stage.querySelectorAll('button').forEach(b => b.onclick = () => {
          if (+b.dataset.n === want) { want++; b.disabled = true; b.textContent = '🔓'; Sound.click(); if (want > 4) next(); } else err();
        });
      } else if (stepIdx === 2) {
        // Crane alignment: stop the needle inside the zone three times.
        let hits = 0, pos = 0, dir = 1;
        const zoneW = 16;
        let zone = 20 + Math.random() * 60;
        stage.innerHTML = `<p>הנחת המארז עם המנוף — [עצור/עצרי] את המחוג באזור הירוק (רווח / כפתור). <b id="cr-h">0</b>/3</p>
          <div class="timing"><div class="zone" style="left:${zone}%;width:${zoneW}%"></div><div class="needle"></div></div>
          <button class="btn" id="cr-go">עצור!</button>`;
        const needle = stage.querySelector('.needle');
        const zoneEl = stage.querySelector('.zone');
        let speed = 70;
        const stop = () => {
          if (stepIdx !== 2) return;
          if (pos >= zone && pos <= zone + zoneW) {
            hits++; Sound.click();
            stage.querySelector('#cr-h').textContent = hits;
            if (hits >= 3) return next();
            zone = 10 + Math.random() * 70;
            zoneEl.style.left = zone + '%';
            speed += 25;
          } else err();
        };
        stage.querySelector('#cr-go').onclick = stop;
        stage._key = (k, code) => { if (code === 'Space') stop(); };
        stage._tick = (dt) => {
          pos += dir * speed * dt;
          if (pos > 98) { pos = 98; dir = -1; }
          if (pos < 0) { pos = 0; dir = 1; }
          needle.style.left = pos + '%';
        };
      } else if (stepIdx === 3) {
        // Cables: match each cable to the socket of the same colour.
        const colors = [['#e63b2e', 'אדום'], ['#4aa3df', 'כחול'], ['#f2c14e', 'צהוב'], ['#6cc24a', 'ירוק']];
        const sockets = colors.slice().sort(() => Math.random() - 0.5);
        let picked = null, matched = 0;
        stage.innerHTML = `<p>חבר[/י] כל כבל לשקע בצבע שלו: בחר[/י] כבל ואז שקע.</p>
          <div class="two"><div>${colors.map(([c, n]) => `<button class="btn small ghost cab" data-c="${c}" style="display:block;margin:6px 0;border:3px solid ${c}">🔌 כבל ${n}</button>`).join('')}</div>
          <div>${sockets.map(([c]) => `<button class="btn small ghost sock" data-c="${c}" style="display:block;margin:6px 0;min-width:120px"><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${c}"></span> שקע</button>`).join('')}</div></div>`;
        stage.querySelectorAll('.cab').forEach(b => b.onclick = () => {
          stage.querySelectorAll('.cab').forEach(x => x.style.outline = '');
          picked = b; b.style.outline = '3px solid #fff'; Sound.click();
        });
        stage.querySelectorAll('.sock').forEach(b => b.onclick = () => {
          if (!picked) return;
          if (picked.dataset.c === b.dataset.c) {
            picked.disabled = true; b.disabled = true; picked.style.outline = ''; picked = null; matched++; Sound.click();
            if (matched >= colors.length) next();
          } else err();
        });
      } else if (stepIdx === 4) {
        stage.innerHTML = `<p>[הפעל/הפעילי] בדיקת תקינות:</p><button class="btn" id="bit">▶ בדיקה עצמית</button><div class="timing" style="height:16px"><div class="zone" id="bit-p" style="left:0;width:0%"></div></div>`;
        stage.querySelector('#bit').onclick = (e) => {
          e.target.disabled = true;
          let p = 0;
          stage._tick = (dt) => {
            p += dt * 45;
            stage.querySelector('#bit-p').style.width = Math.min(100, p) + '%';
            if (p >= 100) { stage._tick = null; next(); }
          };
        };
      }
    };

    const finish = (success) => {
      if (over) return;
      over = true;
      const score = success ? Math.max(10, Math.round(40 + timeLeft - errors * 4)) : 0;
      Mini.result(box, {
        title: success ? 'המשגר טעון ומוכן!' : 'נגמר הזמן',
        big: success ? `${Math.round(timeLeft)} שנ' נותרו` : '✘',
        ok: success,
        lines: success ? [`טעויות: ${errors}`, errors === 0 ? 'עבודה נקייה. הסמלת מרוצה.' : 'עבד, אבל אפשר חלק יותר.'] : ['המשגר לא מוכן. צריך לנסות שוב.'],
      }, () => done({ success, score, errors, timeLeft }));
    };

    Mini.onKey(e => {
      const k = KEYMAP[e.code] || e.code;
      if (ARROWS[k] || e.code === 'Space') e.preventDefault();
      if (stage._key) stage._key(k, e.code);
    });
    Mini.loop(dt => {
      if (over) return;
      timeLeft -= dt;
      box.querySelector('#r-t').textContent = Math.max(0, timeLeft).toFixed(1);
      if (stage._tick) stage._tick(dt);
      if (timeLeft <= 0) finish(false);
    });
    markSteps();
    runStep();
  },

  // ---------- ש"ג: check a visitor against today's entry list ----------
  gate(box, opts, done) {
    const v = opts.visitor;
    const list = opts.list;
    box.innerHTML = `<h3>ש"ג — בדיקת כניסה</h3><div class="sub">[השווה/השווי] את הנהג והרכב לרשימת הכניסה של היום. שם ומספר רכב חייבים להתאים.</div>
      <div class="two">
        <div class="doc"><b>רשימת כניסה — יום ${G.state.day}</b><br>${list.map(p => `• ${p.name} — <span dir="ltr">${p.car}</span>`).join('<br>')}</div>
        <div class="doc"><b>🚗 בשער:</b><br>שם: <b>${v.name}</b><br>תפקיד: ${v.role}<br>מספר רכב: <b dir="ltr">${v.car}</b><br><i>"${v.line}"</i></div>
      </div>
      <div class="actions"><button class="btn" id="g-yes">✔ אשר כניסה</button><button class="btn red" id="g-no">✘ סרב ודווח</button></div>`;
    box.querySelector('#g-yes').onclick = () => done({ approved: true });
    box.querySelector('#g-no').onclick = () => done({ approved: false });
    Mini.onKey(e => { if (e.code === 'Escape') done({ approved: false }); });
  },

  // ---------- night guard duty ----------
  guard(box, opts, done) {
    const duration = opts.duration || 60;
    const passwords = ['חרוב', 'צבר', 'דקל', 'אלון', 'תאנה', 'רימון'];
    const pw = passwords[Math.floor(Math.random() * passwords.length)];
    box.innerHTML = `<h3>שמירת לילה — עמדה צפונית</h3><div class="sub">הסיסמה הלילה: <b style="color:var(--gold)">${pw}</b>. אל [תירדם/תירדמי]! [לחץ/לחצי] על תנועה חשודה ליד הגדר כדי לדווח. תנים — לא מדווחים.</div>`;
    const { c, g, pos } = Mini.canvas(box, 800, 420);
    box.insertAdjacentHTML('beforeend', `<div class="stats"><span>זמן: <span class="v" id="gd-t"></span></span><span>דיווחים: <span class="v" id="gd-r">0</span></span><span>טעויות: <span class="v" id="gd-e">0</span></span></div>
      <div class="actions"><button class="btn ghost" id="gd-wake">💧 שטיפת פנים (רווח)</button></div><div id="gd-ask"></div>`);
    let t = 0, sleepy = 10, reports = 0, errors = 0, washCd = 0, over = false;
    let events = [];
    let nextEvent = 3;
    let officerDone = false;
    const stars = Array.from({ length: 80 }, () => ({ x: Math.random() * 800, y: Math.random() * 150, s: Math.random() * 1.5 + 0.3 }));
    const wake = () => {
      if (washCd > 0 || over) return;
      sleepy = Math.max(0, sleepy - 35);
      washCd = 5;
      Sound.click();
    };
    box.querySelector('#gd-wake').onclick = wake;
    Mini.onKey(e => { if (e.code === 'Space') { e.preventDefault(); wake(); } });

    const askPassword = () => {
      G._guardAsking = true;
      const opts3 = [pw, ...passwords.filter(p => p !== pw).sort(() => Math.random() - 0.5).slice(0, 2)].sort(() => Math.random() - 0.5);
      const ask = box.querySelector('#gd-ask');
      ask.innerHTML = `<div class="doc" style="margin-top:10px"><b>🔦 קצין תורן:</b> "ערב טוב. מה הסיסמה?"<div class="row">${opts3.map(o => `<button class="btn small" data-p="${o}">${o}</button>`).join('')}</div></div>`;
      ask.querySelectorAll('button').forEach(b => b.onclick = () => {
        if (b.dataset.p === pw) { reports++; Sound.good(); } else { errors++; Sound.bad(); }
        ask.innerHTML = b.dataset.p === pw ? '<p>✔ "יופי, ערני[/ת]. [המשך/המשיכי] כך."</p>' : '<p>✘ "זו לא הסיסמה... זה יירשם."</p>';
        ask.querySelector('p').innerHTML = fmt(ask.querySelector('p').innerHTML);
        G._guardAsking = false;
        events = events.filter(ev => ev.type !== 'officer');
        setTimeout(() => { if (!over) ask.innerHTML = ''; }, 1800);
      });
    };

    c.addEventListener('pointerdown', (e) => {
      if (over) return;
      const p = pos(e);
      for (const ev of events) {
        if (ev.gone || ev.type === 'officer') continue;
        if (Math.hypot(ev.x - p.x, ev.y - p.y) < 34) {
          ev.gone = true;
          if (ev.type === 'figure') { reports++; Sound.good(); }
          else { errors++; Sound.bad(); }
          return;
        }
      }
    });

    const finish = (asleep) => {
      over = true;
      const success = !asleep && errors <= 2;
      const score = asleep ? 0 : Math.max(0, reports * 12 - errors * 8 + 20);
      Mini.result(box, {
        title: asleep ? 'נרדמת בשמירה!' : 'סוף משמרת',
        big: asleep ? '😴' : `${reports} דיווחים`,
        ok: success,
        lines: asleep ? ['הקצין התורן מצא אותך עם עיניים סגורות. זה לא נגמר טוב...'] : [`טעויות: ${errors}`, success ? 'משמרת נקייה. אפשר ללכת לישון.' : 'יותר מדי טעויות במשמרת.'],
      }, () => done({ success, score, asleep, errors }));
    };

    Mini.loop((dt) => {
      if (over) return;
      t += dt;
      washCd = Math.max(0, washCd - dt);
      sleepy += dt * (4 + t / 12);
      if (sleepy >= 100) return finish(true);
      if (t >= duration && !G._guardAsking) return finish(false);
      nextEvent -= dt;
      if (nextEvent <= 0) {
        nextEvent = 3 + Math.random() * 4;
        const r = Math.random();
        if (!officerDone && t > duration * 0.45) {
          officerDone = true;
          events.push({ type: 'officer', x: 820, y: 330, life: 99 });
        } else {
          events.push({ type: r < 0.5 ? 'figure' : 'jackal', x: 80 + Math.random() * 640, y: 215 + Math.random() * 40, life: 5, vx: (Math.random() - 0.5) * 40 });
        }
      }
      for (const ev of events) {
        if (ev.type === 'officer') {
          ev.x -= dt * 120;
          if (ev.x < 520 && !ev.asked) { ev.asked = true; askPassword(); }
          continue;
        }
        ev.life -= dt;
        ev.x += ev.vx * dt;
        if (ev.life <= 0 && !ev.gone) {
          ev.gone = true;
          if (ev.type === 'figure') { errors++; Sound.bad(); }
        }
      }
      events = events.filter(ev => !ev.gone);

      // Draw the scene.
      g.fillStyle = '#060a14';
      g.fillRect(0, 0, 800, 420);
      for (const s of stars) { g.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(t * 2 + s.x) * 0.3})`; g.fillRect(s.x, s.y, s.s, s.s); }
      g.fillStyle = '#1a1712';
      g.beginPath(); g.moveTo(0, 190); for (let x = 0; x <= 800; x += 40) g.lineTo(x, 180 + Math.sin(x / 90) * 14); g.lineTo(800, 420); g.lineTo(0, 420); g.fill();
      // Fence.
      g.strokeStyle = '#3c3c3c';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 270); g.lineTo(800, 270); g.moveTo(0, 230); g.lineTo(800, 230); g.stroke();
      for (let x = 0; x < 800; x += 50) { g.beginPath(); g.moveTo(x, 222); g.lineTo(x, 275); g.stroke(); }
      // Spotlight cone sweeping.
      const sx = 400 + Math.sin(t * 0.7) * 300;
      const grad = g.createRadialGradient(sx, 245, 10, sx, 245, 120);
      grad.addColorStop(0, 'rgba(255,240,180,.35)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = grad;
      g.fillRect(sx - 120, 125, 240, 240);
      for (const ev of events) {
        if (ev.type === 'jackal') {
          g.fillStyle = '#8bff7a';
          g.beginPath(); g.arc(ev.x - 5, ev.y, 3, 0, 7); g.arc(ev.x + 5, ev.y, 3, 0, 7); g.fill();
          g.fillStyle = 'rgba(80,70,50,.7)';
          g.beginPath(); g.ellipse(ev.x + (ev.vx > 0 ? -20 : 20), ev.y + 8, 18, 7, 0, 0, 7); g.fill();
        } else if (ev.type === 'figure') {
          g.fillStyle = 'rgba(30,30,34,.95)';
          g.beginPath(); g.arc(ev.x, ev.y - 22, 8, 0, 7); g.fill();
          g.fillRect(ev.x - 8, ev.y - 14, 16, 30);
          g.strokeStyle = 'rgba(255,255,255,.12)';
          g.strokeRect(ev.x - 9, ev.y - 31, 18, 48);
        } else if (ev.type === 'officer') {
          const lg = g.createRadialGradient(ev.x, ev.y, 2, ev.x, ev.y, 60);
          lg.addColorStop(0, 'rgba(255,255,220,.9)');
          lg.addColorStop(1, 'rgba(255,255,220,0)');
          g.fillStyle = lg;
          g.beginPath(); g.arc(ev.x, ev.y, 60, 0, 7); g.fill();
        }
      }
      // Booth window frame.
      g.strokeStyle = '#2b2b2b';
      g.lineWidth = 18;
      g.strokeRect(0, 0, 800, 420);
      // Eyelids.
      const lid = Math.max(0, (sleepy - 45) / 55) * 210 * (0.85 + Math.sin(t * 3) * 0.15);
      g.fillStyle = '#000';
      g.fillRect(0, 0, 800, lid);
      g.fillRect(0, 420 - lid, 800, lid);
      // Sleep meter.
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(16, 16, 220, 22);
      g.fillStyle = sleepy > 70 ? '#e63b2e' : '#f2c14e';
      g.fillRect(18, 18, 216 * sleepy / 100, 18);
      g.fillStyle = '#fff';
      g.font = '700 13px Rubik';
      g.direction = 'rtl';
      g.textAlign = 'right';
      g.fillText('עייפות', 232, 32);
      box.querySelector('#gd-t').textContent = Math.max(0, duration - t).toFixed(0);
      box.querySelector('#gd-r').textContent = reports;
      box.querySelector('#gd-e').textContent = errors;
      box.querySelector('#gd-wake').disabled = washCd > 0;
    });
  },

  // ---------- control room: decide what to intercept ----------
  radar(box, opts, done) {
    const duration = opts.duration || 45;
    box.innerHTML = `<h3>עמדת בקרה — חמ"ל</h3><div class="sub">כל נקודה אדומה היא איום, והקו מראה איפה הוא ייפול. יירט[/י] (לחיצה) רק איומים שייפלו <b>בשטח מיושב</b>. בשטח פתוח — לא מבזבזים מיירט.</div>`;
    const { c, g, pos } = Mini.canvas(box, 800, 450);
    box.insertAdjacentHTML('beforeend', `<div class="stats"><span>זמן: <span class="v" id="rd-t"></span></span><span>יירוטים נכונים: <span class="v" id="rd-ok">0</span></span><span>בזבוז: <span class="v" id="rd-w">0</span></span><span>פספוס: <span class="v" id="rd-m">0</span></span><span>מיירטים: <span class="v" id="rd-a"></span></span></div>`);
    const zones = [
      { name: 'נתיבות', x: 560, y: 250, r: 70 },
      { name: 'קיבוץ', x: 640, y: 110, r: 32 },
      { name: 'מושב', x: 470, y: 380, r: 30 },
      { name: 'שדרות', x: 360, y: 120, r: 44 },
    ];
    const battery = { x: 600, y: 330 };
    let t = 0, ok = 0, waste = 0, miss = 0, correctIgnore = 0, ammo = 18, over = false;
    let threats = [], interceptors = [], booms = [];
    let next = 1;
    const inZone = (p) => zones.some(z => Math.hypot(z.x - p.x, z.y - p.y) < z.r);
    c.addEventListener('pointerdown', (e) => {
      if (over) return;
      const p = pos(e);
      let best = null, bd = 40;
      for (const th of threats) {
        if (th.targeted) continue;
        const d = Math.hypot(th.x - p.x, th.y - p.y);
        if (d < bd) { bd = d; best = th; }
      }
      if (!best) return;
      if (ammo <= 0) { Sound.bad(); return; }
      ammo--;
      best.targeted = true;
      interceptors.push({ x: battery.x, y: battery.y, target: best });
      Sound.launch();
    });
    const finish = () => {
      over = true;
      const total = ok + miss + waste;
      const acc = total ? Math.round(100 * ok / total) : 100;
      const success = acc >= 70;
      Mini.result(box, {
        title: 'סוף משמרת בקרה', big: `${acc}%`, ok: success,
        lines: [`יירוטים נכונים: ${ok} · מיירטים שבוזבזו: ${waste} · איומים שפספסת: ${miss}`, `לא יירטת נכון ${correctIgnore} איומים לשטח פתוח 👍`, success ? 'בקרה חדה. ככה חוסכים מיירטים ומגינים על הבתים.' : 'צריך לשפר — תסתכל[/י] על נקודת הנפילה.'],
      }, () => done({ success, accuracy: acc, score: Math.round(acc / 4) }));
    };
    Mini.loop((dt) => {
      if (over) return;
      t += dt;
      if (t >= duration && !threats.length && !interceptors.length) return finish();
      next -= dt;
      if (next <= 0 && t < duration) {
        next = 1.2 + Math.random() * 1.6;
        const sx = 0, sy = 80 + Math.random() * 300;
        let impact;
        if (Math.random() < 0.5) { const z = zones[Math.floor(Math.random() * zones.length)]; const a = Math.random() * 7; const rr = Math.random() * z.r * 0.8; impact = { x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr }; }
        else { do { impact = { x: 250 + Math.random() * 520, y: 40 + Math.random() * 380 }; } while (inZone(impact)); }
        const speed = 55 + Math.random() * 35;
        const d = Math.hypot(impact.x - sx, impact.y - sy);
        threats.push({ x: sx, y: sy, sx, sy, ix: impact.x, iy: impact.y, vx: (impact.x - sx) / d * speed, vy: (impact.y - sy) / d * speed, populated: inZone(impact) });
      }
      for (const th of threats) {
        th.x += th.vx * dt; th.y += th.vy * dt;
        if (Math.hypot(th.ix - th.x, th.iy - th.y) < 4) {
          th.dead = true;
          booms.push({ x: th.ix, y: th.iy, r: 0, col: th.populated ? '#e63b2e' : '#9a8f6a' });
          if (th.targeted) continue;
          if (th.populated) { miss++; Sound.bad(); } else correctIgnore++;
        }
      }
      for (const it of interceptors) {
        const tg = it.target;
        const d = Math.hypot(tg.x - it.x, tg.y - it.y);
        const sp = 260 * dt;
        if (d < sp || tg.dead) {
          it.dead = true;
          if (!tg.dead) {
            tg.dead = true;
            booms.push({ x: tg.x, y: tg.y, r: 0, col: '#f2c14e' });
            Sound.boom();
            if (tg.populated) ok++; else waste++;
          }
        } else { it.x += (tg.x - it.x) / d * sp; it.y += (tg.y - it.y) / d * sp; }
      }
      threats = threats.filter(x => !x.dead);
      interceptors = interceptors.filter(x => !x.dead);
      booms.forEach(b => b.r += dt * 60);
      booms = booms.filter(b => b.r < 30);

      g.fillStyle = '#04140a';
      g.fillRect(0, 0, 800, 450);
      g.strokeStyle = 'rgba(70,209,107,.12)';
      g.lineWidth = 1;
      for (let x = 0; x < 800; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 450); g.stroke(); }
      for (let y = 0; y < 450; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(800, y); g.stroke(); }
      const sweep = (t * 1.6) % (Math.PI * 2);
      g.strokeStyle = 'rgba(70,209,107,.35)';
      g.beginPath(); g.moveTo(battery.x, battery.y); g.lineTo(battery.x + Math.cos(sweep) * 700, battery.y + Math.sin(sweep) * 700); g.stroke();
      g.textAlign = 'center';
      g.direction = 'rtl';
      for (const z of zones) {
        g.fillStyle = 'rgba(74,163,223,.18)';
        g.strokeStyle = '#4aa3df';
        g.beginPath(); g.arc(z.x, z.y, z.r, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#9fd3f5';
        g.font = '700 14px Rubik';
        g.fillText(z.name, z.x, z.y + 5);
      }
      g.fillStyle = '#46d16b';
      g.fillRect(battery.x - 8, battery.y - 8, 16, 16);
      g.font = '700 12px Rubik';
      g.fillText('סוללה', battery.x, battery.y + 24);
      for (const th of threats) {
        g.setLineDash([5, 6]);
        g.strokeStyle = 'rgba(230,59,46,.45)';
        g.beginPath(); g.moveTo(th.x, th.y); g.lineTo(th.ix, th.iy); g.stroke();
        g.setLineDash([]);
        g.strokeStyle = '#e63b2e';
        g.beginPath(); g.moveTo(th.ix - 6, th.iy - 6); g.lineTo(th.ix + 6, th.iy + 6); g.moveTo(th.ix + 6, th.iy - 6); g.lineTo(th.ix - 6, th.iy + 6); g.stroke();
        g.fillStyle = th.targeted ? '#f2c14e' : '#ff5a4a';
        g.beginPath(); g.arc(th.x, th.y, 6, 0, 7); g.fill();
      }
      for (const it of interceptors) { g.fillStyle = '#e8fff0'; g.beginPath(); g.arc(it.x, it.y, 3.5, 0, 7); g.fill(); }
      for (const b of booms) { g.strokeStyle = b.col; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.stroke(); }
      g.lineWidth = 1;
      box.querySelector('#rd-t').textContent = Math.max(0, duration - t).toFixed(0);
      box.querySelector('#rd-ok').textContent = ok;
      box.querySelector('#rd-w').textContent = waste;
      box.querySelector('#rd-m').textContent = miss;
      box.querySelector('#rd-a').textContent = ammo;
    });
  },

  // ---------- shooting range ----------
  range(box, opts, done) {
    box.innerHTML = `<h3>מטווח — 10 כדורים</h3><div class="sub">[כוון/כווני] ו[לחץ/לחצי] לירות. [החזק/החזיקי] Shift או את כפתור "עצירת נשימה" כדי לייצב את הכוונת.</div>`;
    const { c, g, pos } = Mini.canvas(box, 800, 420);
    box.insertAdjacentHTML('beforeend', `<div class="stats"><span>כדורים: <span class="v" id="rg-b">10</span></span><span>ניקוד: <span class="v" id="rg-s">0</span></span></div>
      <div class="actions"><button class="btn ghost" id="rg-hold">🫁 עצירת נשימה</button></div>`);
    let aim = { x: 400, y: 210 }, t = 0, bullets = 10, score = 0, holding = false, breath = 2.5, over = false;
    const holes = [];
    let target = { x: 400, y: 200, r: 50, up: true, timer: 3 };
    const newTarget = () => { target = { x: 120 + Math.random() * 560, y: 120 + Math.random() * 180, r: 34 + Math.random() * 20, up: true, timer: 3.2 }; };
    newTarget();
    const holdBtn = box.querySelector('#rg-hold');
    holdBtn.addEventListener('pointerdown', () => holding = true);
    holdBtn.addEventListener('pointerup', () => holding = false);
    holdBtn.addEventListener('pointerleave', () => holding = false);
    Mini.onKey(e => { if (e.key === 'Shift') holding = true; });
    const up = (e) => { if (e.key === 'Shift') holding = false; };
    document.addEventListener('keyup', up);
    Mini.cleanup.push(() => document.removeEventListener('keyup', up));
    c.addEventListener('pointermove', e => { aim = pos(e); });
    c.addEventListener('pointerdown', e => {
      if (over || bullets <= 0) return;
      aim = pos(e);
      const sway = currentSway();
      const hx = aim.x + sway.x, hy = aim.y + sway.y;
      bullets--;
      Sound.shot();
      const d = Math.hypot(hx - target.x, hy - target.y);
      let pts = 0;
      if (target.up && d < target.r) pts = Math.max(1, Math.round(10 * (1 - d / target.r)));
      score += pts;
      holes.push({ x: hx, y: hy, hit: pts > 0, life: 1.4 });
      if (pts > 0) newTarget();
      if (bullets <= 0) setTimeout(finish, 600);
    });
    const currentSway = () => {
      const k = holding && breath > 0 ? 0.15 : 1;
      return { x: Math.sin(t * 1.7) * 22 * k + Math.sin(t * 4.3) * 6 * k, y: Math.cos(t * 1.3) * 16 * k + Math.sin(t * 3.1) * 5 * k };
    };
    const finish = () => {
      if (over) return;
      over = true;
      const pct = score;
      Mini.result(box, { title: 'סיום מטווח', big: `${pct}/100`, ok: pct >= 50, lines: [pct >= 80 ? 'קלע[/ית]! המפקד ראה.' : pct >= 50 ? 'עברת. אפשר לשפר.' : 'צריך עוד אימון.'] }, () => done({ success: pct >= 50, score: pct }));
    };
    Mini.loop(dt => {
      if (over) return;
      t += dt;
      if (holding) breath = Math.max(0, breath - dt); else breath = Math.min(2.5, breath + dt * 0.6);
      target.timer -= dt;
      if (target.timer <= 0) newTarget();
      g.fillStyle = '#9fae6a';
      g.fillRect(0, 0, 800, 420);
      g.fillStyle = '#b89a62';
      g.fillRect(0, 0, 800, 90);
      g.fillStyle = '#7d8a4a';
      for (let i = 0; i < 800; i += 30) g.fillRect(i, 86, 20, 8);
      // Target.
      g.fillStyle = '#e9e4d4';
      g.fillRect(target.x - target.r - 6, target.y - target.r - 6, target.r * 2 + 12, target.r * 2 + 12);
      for (const [f, col] of [[1, '#222'], [0.66, '#e9e4d4'], [0.4, '#222'], [0.15, '#e63b2e']]) {
        g.fillStyle = col; g.beginPath(); g.arc(target.x, target.y, target.r * f, 0, 7); g.fill();
      }
      for (const h of holes) { h.life -= dt; g.fillStyle = h.hit ? '#f2c14e' : '#333'; g.beginPath(); g.arc(h.x, h.y, 4, 0, 7); g.fill(); }
      const sw = currentSway();
      const cx = aim.x + sw.x, cy = aim.y + sw.y;
      g.strokeStyle = '#e63b2e';
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, 18, 0, 7); g.moveTo(cx - 28, cy); g.lineTo(cx - 8, cy); g.moveTo(cx + 8, cy); g.lineTo(cx + 28, cy); g.moveTo(cx, cy - 28); g.lineTo(cx, cy - 8); g.moveTo(cx, cy + 8); g.lineTo(cx, cy + 28); g.stroke();
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.fillRect(16, 390, 120, 12);
      g.fillStyle = '#4aa3df';
      g.fillRect(16, 390, 120 * breath / 2.5, 12);
      box.querySelector('#rg-b').textContent = bullets;
      box.querySelector('#rg-s').textContent = score;
    });
  },

  // ---------- quiz with the commander ----------
  quiz(box, opts, done) {
    const qs = opts.questions.slice().sort(() => Math.random() - 0.5).slice(0, opts.count || 5);
    let i = 0, right = 0;
    const show = () => {
      if (i >= qs.length) {
        const ok = right >= Math.ceil(qs.length * 0.6);
        return Mini.result(box, { title: 'מבחן ידע', big: `${right}/${qs.length}`, ok, lines: [ok ? 'עברת את מבחן הידע.' : 'לא מספיק. [חזור/חזרי] על החומר.'] }, () => done({ success: ok, right, total: qs.length }));
      }
      const q = qs[i];
      box.innerHTML = `<h3>שאלה ${i + 1} מתוך ${qs.length}</h3><p style="font-size:19px">${q.q}</p>${q.a.map((a, j) => `<button class="btn ghost quiz-opt" data-j="${j}">${a}</button>`).join('')}`;
      box.querySelectorAll('.quiz-opt').forEach(b => b.onclick = () => {
        const good = +b.dataset.j === q.ok;
        if (good) right++;
        b.style.background = good ? '#2f5d22' : '#7b1a12';
        (good ? Sound.good : Sound.bad)();
        box.querySelectorAll('.quiz-opt').forEach(x => x.disabled = true);
        setTimeout(() => { i++; show(); }, 700);
      });
    };
    show();
  },

  // ---------- canteen shop ----------
  shop(box, opts, done) {
    const render = () => {
      const S = G.state;
      box.innerHTML = `<h3>ש.ק. — הקנטינה</h3><div class="sub">יתרה: <b style="color:var(--gold)">₪${S.money}</b></div>
        <div class="grid">${DATA.shop.map(it => `<div class="card" data-id="${it.id}"><div class="big">${it.icon}</div><div class="nm">${it.name}</div>
        <div class="ds">₪${it.price} · ${it.energy ? `אנרגיה ${it.energy > 0 ? '+' : ''}${it.energy}` : ''} ${it.morale ? `מורל ${it.morale > 0 ? '+' : ''}${it.morale}` : ''}</div></div>`).join('')}</div>
        <div class="actions"><button class="btn ghost" id="sh-x">יציאה</button></div>`;
      box.querySelectorAll('.card').forEach(cd => cd.onclick = () => {
        const it = DATA.shop.find(x => x.id === cd.dataset.id);
        if (S.money < it.price) { Sound.bad(); UI.toast('אין מספיק כסף', 'bad'); return; }
        S.money -= it.price;
        Game.addStat('energy', it.energy);
        Game.addStat('morale', it.morale);
        S.stats.purchases++;
        if (S.stats.purchases >= 5) Game.achieve('shopper');
        Sound.coin();
        UI.toast(`${it.icon} ${it.name}`, 'good');
        render();
      });
      box.querySelector('#sh-x').onclick = () => done({});
    };
    Mini.onKey(e => { if (e.code === 'Escape') done({}); });
    render();
  },

  // ---------- kitchenette: pick a recipe, then cook it ----------
  cook(box, opts, done) {
    box.innerHTML = `<h3>🍳 מטבחון</h3><div class="sub">מה מבשלים? (אוכל ביתי מוריד שחורה)</div>
      <div class="grid">${DATA.recipes.map(r => `<div class="card" data-id="${r.id}"><div class="big">${r.icon}</div><div class="nm">${fmt(r.name)}</div>
      <div class="ds">${fmt(r.steps)}</div><div class="ds">אנרגיה +${r.energy} · מורל +${r.morale}</div></div>`).join('')}</div>
      <div class="actions"><button class="btn ghost" id="ck-x">לא עכשיו</button></div>`;
    box.querySelector('#ck-x').onclick = () => done({});
    Mini.onKey(e => { if (e.code === 'Escape') done({}); });
    box.querySelectorAll('.card').forEach(cd => cd.onclick = () => {
      const recipe = DATA.recipes.find(r => r.id === cd.dataset.id);
      Sound.click();
      Mini.cleanup.forEach(fn => fn());
      Mini.cleanup = [];
      Minigames.qte(box, { title: `${recipe.icon} ${fmt(recipe.name)}`, sub: fmt(recipe.steps) + ' — [הקש/הקישי] את הרצף לפני שנשרף!', length: recipe.len, time: recipe.len * 1.7 }, (r) => done({ recipe, success: r.success }));
    });
  },

  // ---------- Yasmin's fridge: write down every expiry date ----------
  fridge(box, opts, done) {
    const items = DATA.fridge.slice().sort(() => Math.random() - 0.5).slice(0, opts.count || 6);
    const today = opts.day || 1;
    let i = 0, errors = 0;
    const log = [];
    const show = () => {
      if (i >= items.length) {
        const thrown = items.filter(it => it.off < 0).map(it => `${it.icon} ${fmt(it.name)}`);
        return Mini.result(box, {
          title: 'יומן תוקפים — מקרר המטבחון', big: errors ? `${errors} טעויות` : 'מושלם', ok: errors <= 1,
          lines: [`נרשמו ${items.length} פריטים.`, thrown.length ? `לפח (פג תוקף): ${thrown.join(' · ')}` : 'הכל בתוקף. נס.', errors ? '{@inspector}: "התאריך כתוב על המוצר. בגדול. מה קשה?"' : '{@inspector}: "...אין לי מה להגיד. זה מפחיד אותי."'],
        }, () => done({ success: errors <= 1, errors }));
      }
      const it = items[i];
      const right = gameDate(today, it.off);
      const opts2 = [right];
      for (const d of [it.off + 1, it.off - 3, it.off + 10, it.off - 1, it.off + 30]) { const v = gameDate(today, d); if (!opts2.includes(v)) opts2.push(v); if (opts2.length >= 4) break; }
      opts2.sort(() => Math.random() - 0.5);
      box.innerHTML = `<h3>🧊 המקרר — פריט ${i + 1} מתוך ${items.length}</h3>
        <div class="sub">היום ${gameDate(today)}. [תקרא/תקראי] את התוקף על המוצר ו[תרשום/תרשמי] ביומן.</div>
        <div class="fridge-item"><div class="fi-icon">${it.icon}</div><div><div class="fi-name">${fmt(it.name)}</div><div class="fi-label">בתוקף עד: <b>${right}</b></div></div></div>
        <div class="grid">${opts2.map(d => `<button class="btn ghost quiz-opt" data-d="${d}">📝 ${d}</button>`).join('')}</div>
        <div class="doc">${log.length ? log.map(l => `${l.icon} ${fmt(l.name)} — ${l.d} ${l.exp ? '❌ פג' : '✔'}`).join('<br>') : 'יומן ריק. {@inspector} מסתכלת.'}</div>`;
      box.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
        const good = b.dataset.d === right;
        if (!good) { errors++; Sound.bad(); b.style.background = '#7b1a12'; UI.toast('{@inspector}: "זה לא מה שכתוב!"', 'bad'); return; }
        Sound.good();
        log.push({ icon: it.icon, name: it.name, d: right, exp: it.off < 0 });
        i++;
        show();
      });
    };
    show();
  },

  // ---------- training menu (free mode) ----------
  training(box, opts, done) {
    const items = [
      ['range', '🎯', 'מטווח', 'ירי בכוונת מתנדנדת'],
      ['reload', '🚀', 'החלפת מארז', 'נגד השעון'],
      ['radar', '📡', 'עמדת בקרה', 'מה ליירט ומה לא'],
      ['guard', '🌙', 'שמירת לילה', 'לא להירדם'],
      ['gateDrill', '🚧', 'תרגול ש"ג', '3 רכבים ברצף'],
      ['alertDrill', '🚨', 'תרגיל צבע אדום', 'רוץ למיגונית'],
      ['run', '🏃', 'מסלול כושר', '2 הקפות'],
      ['quiz', '📝', 'מבחן ידע', 'שאלות פלג"צ'],
    ];
    box.innerHTML = `<h3>אימונים</h3><div class="sub">בחר[/י] אימון. כל אימון מוצלח מעלה את ציון הפלג"צ (עד פעמיים ביום לכל אימון).</div>
      <div class="grid">${items.map(([id, ic, n, d]) => `<div class="card" data-id="${id}"><div class="big">${ic}</div><div class="nm">${n}</div><div class="ds">${d}</div></div>`).join('')}</div>
      <div class="actions"><button class="btn ghost" id="tr-x">סגור</button></div>`;
    box.querySelectorAll('.card').forEach(cd => cd.onclick = () => done({ pick: cd.dataset.id }));
    box.querySelector('#tr-x').onclick = () => done({});
    Mini.onKey(e => { if (e.code === 'Escape') done({}); });
  },
};
