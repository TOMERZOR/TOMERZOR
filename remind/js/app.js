// Remind. — the screens: onboarding, today, medicines, history and profile.

import { icon } from './icons.js';
import * as S from './store.js';
import * as Push from './push.js';

const { SLOTS, FORMS, FOOD, COLORS, WEEKDAYS } = S;

let state = S.load();
const view = { tab: 'home', day: S.dateKey(), today: S.dateKey(), month: null, histDay: S.dateKey(), justChecked: new Set(), celebrate: false, ringPrev: {} };
const $view = document.getElementById('view');
const $tabbar = document.getElementById('tabbar');
const $pill = document.getElementById('tab-pill');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const wordmark = (cls = '') => `<span class="wordmark ${cls}">Remind<span class="dot">.</span></span>`;
const appIcon = (cls = '') => `<img class="${cls}" src="img/icon-192.png" alt="" width="192" height="192">`;
const slotClass = (slot, time) => SLOTS[slot] ? slot : S.minutes(time) < 11 * 60 ? 'morning' : S.minutes(time) < 17 * 60 ? 'noon' : 'evening';
const liveMeds = () => state.meds.filter(m => !m.deleted);

// ---------- Saving ----------

let syncTimer;
function commit({ sync = true } = {}) {
  S.save(state);
  Push.writeSnapshot(state);
  if (sync) queueSync();
}

function queueSync(delay = 700) {
  if (!state.device.push) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await Push.sync(state);
    } catch {
      // Offline or the server is away: the next change, or opening the app, tries again.
    }
    S.save(state);
  }, delay);
}

function applyAppearance() {
  const root = document.documentElement;
  root.dataset.size = state.profile.textSize;
  if (state.profile.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = state.profile.theme;
}

// ---------- Tabs ----------

const TABS = [
  { id: 'home', label: 'היום', icon: 'house' },
  { id: 'meds', label: 'תרופות', icon: 'pills' },
  { id: 'history', label: 'היסטוריה', icon: 'history' },
  { id: 'profile', label: 'פרופיל', icon: 'person' },
];

function buildTabbar() {
  $tabbar.insertAdjacentHTML('beforeend', TABS.map(t => `<button class="tab" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<span>${t.label}</span></button>`).join(''));
  $tabbar.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    if (b.dataset.tab === view.tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (view.tab === 'home' && view.day !== S.dateKey()) { view.day = S.dateKey(); render(); }
      return;
    }
    setTab(b.dataset.tab);
  });
  window.addEventListener('resize', movePill);
}

function movePill() {
  const b = $tabbar.querySelector(`.tab[data-tab="${view.tab}"]`);
  if (!b) return;
  $pill.style.width = `${b.offsetWidth}px`;
  $pill.style.transform = `translateX(${b.offsetLeft}px)`;
}

function setTab(id) {
  view.tab = id;
  history.replaceState(null, '', `#${id}`);
  $tabbar.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === id);
    b.setAttribute('aria-current', b.dataset.tab === id ? 'page' : 'false');
  });
  movePill();
  window.scrollTo(0, 0);
  render(true);
}

const SCREENS = { home: renderHome, meds: renderMeds, history: renderHistory, profile: renderProfile };

function render(enter = false) {
  $view.innerHTML = SCREENS[view.tab]();
  [...$view.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12)));
  $view.classList.remove('enter');
  if (enter) {
    void $view.offsetWidth;
    $view.classList.add('enter');
  }
  view.justChecked.clear();
  view.celebrate = false;
}

// ---------- Home ----------

function topbar() {
  const on = state.device.push;
  return `<div class="topbar">${wordmark()}<button class="round-btn" data-act="notif" aria-label="תזכורות">${icon(on ? 'bell' : 'bellOff')}${on ? '' : '<span class="badge"></span>'}</button></div>`;
}

function emptyState() {
  return `<div class="empty">
    <div class="art">${icon('pills')}</div>
    <h3>עוד אין תרופות</h3>
    <p>מוסיפים את התרופות הקבועות, ו־Remind. יזכיר בבוקר, בצהריים ובערב.</p>
    <button class="btn" data-act="add-med">${icon('plus')} הוספת תרופה</button>
  </div>`;
}

function ring(date, sum) {
  const ratio = sum.total ? sum.taken / sum.total : 0;
  const from = 100 - (view.ringPrev[date] ?? 0) * 100;
  const to = 100 - ratio * 100;
  view.ringPrev[date] = ratio;
  const done = sum.total && sum.taken === sum.total;
  let confetti = '';
  if (view.celebrate) {
    const colors = ['#34c759', '#0a84ff', '#ff9f0a', '#ff375f', '#bf5af2', '#ffd60a'];
    confetti = `<span class="confetti">${Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      const r = 55 + Math.random() * 30;
      return `<i style="background:${colors[i % colors.length]};--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r}px;--r:${Math.random() * 360}deg"></i>`;
    }).join('')}</span>`;
  }
  return `<div class="ring ${done ? 'done' : ''}">
    <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42" pathLength="100"/><circle class="bar" cx="50" cy="50" r="42" pathLength="100" style="--from:${from};--to:${to};stroke-dashoffset:${to};${ratio ? '' : 'opacity:0'}"/></svg>
    <span class="num">${done ? icon('check') : `<span>${sum.taken}<small>/${sum.total}</small></span>`}</span>${confetti}
  </div>`;
}

function summaryCard(date) {
  const sum = S.daySummary(state, date);
  const today = S.dateKey();
  let title;
  let line = '';
  let next = '';
  if (!sum.total) {
    title = 'אין תרופות ביום הזה';
    line = S.relativeDay(date);
  } else if (sum.taken === sum.total) {
    title = 'הכל נלקח';
    line = date === today ? 'כל התרופות של היום סומנו. כל הכבוד!' : `כל התרופות של ${S.relativeDay(date) === 'אתמול' ? 'אתמול' : 'היום הזה'} סומנו`;
  } else {
    title = `נלקחו ${sum.taken} מתוך ${sum.total}`;
    line = date === today ? 'מסמנים רק אחרי שלוקחים' : date < today ? `${S.relativeDay(date)} · אפשר לסמן בדיעבד` : `${S.relativeDay(date)} · מתוכנן`;
  }
  if (date === today) {
    const n = S.nextUp(state);
    if (n) {
      const label = SLOTS[n.group.slot] ? SLOTS[n.group.slot].label : `בשעה ${n.group.time}`;
      let when;
      if (n.date === today) {
        const diff = S.minutes(n.group.time) - S.nowMinutes();
        when = diff <= 0 ? 'הגיע הזמן' : S.inMinutes(diff);
      } else {
        when = n.date === S.addDays(today, 1) ? 'מחר' : S.relativeDay(n.date);
      }
      if (!(n.date !== today && sum.taken < sum.total)) next = `<p class="next-line">${icon('clock')} <span>הבא: ${label} · <span dir="ltr">${n.group.time}</span> · ${when}</span></p>`;
    }
  }
  return `<div class="card summary">${ring(date, sum)}<div class="txt"><h3>${title}</h3><p>${line}</p>${next}</div></div>`;
}

function weekStrip(date) {
  const today = S.dateKey();
  const sunday = S.addDays(date, -S.parseDate(date).getDay());
  return `<div class="week">${Array.from({ length: 7 }, (_, i) => {
    const key = S.addDays(sunday, i);
    const sum = S.daySummary(state, key);
    const ratio = sum.total ? sum.taken / sum.total : 0;
    const cls = [key === today && 'today', key === date && 'sel'].filter(Boolean).join(' ');
    return `<button class="day press ${cls}" data-act="day" data-date="${key}" aria-label="${S.prettyDate(key)}">
      <span class="wd">${WEEKDAYS[i]}</span>
      <span class="dn"><svg viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="18" pathLength="100"/>${ratio ? `<circle class="bar ${ratio < 1 ? 'part' : ''}" cx="20" cy="20" r="18" pathLength="100" style="stroke-dashoffset:${100 - ratio * 100}"/>` : ''}</svg>${S.parseDate(key).getDate()}</span>
    </button>`;
  }).join('')}</div>`;
}

function groupChip(date, g) {
  const today = S.dateKey();
  const pending = g.doses.filter(d => !S.takenAt(state, date, d.key));
  if (!pending.length) return `<span class="chip-status done">${icon('check')} הכל נלקח</span>`;
  if (date < today) return `<span class="chip-status missed">לא סומן</span>`;
  if (date > today) return '';
  const st = S.status(state, date, pending[0]);
  if (st === 'due') return `<span class="chip-status now">עכשיו</span>`;
  if (st === 'late') return `<span class="chip-status late">${icon('bell')} הגיע הזמן</span>`;
  if (st === 'missed') return `<span class="chip-status missed">לא סומן</span>`;
  return `<span class="chip-status">${S.inMinutes(S.minutes(g.time) - S.nowMinutes())}</span>`;
}

function doseRow(date, d) {
  const today = S.dateKey();
  const st = S.status(state, date, d);
  const t = S.takenAt(state, date, d.key);
  const med = d.med;
  const extra = [med.food && med.food !== 'any' ? FOOD[med.food] : '', med.note ? (med.note.length > 40 ? `${med.note.slice(0, 40)}…` : med.note) : ''].filter(Boolean);
  const sub = t
    ? `<span>${S.doseText(med)}</span><b>${icon('check')} נלקח <span dir="ltr">${S.clock(t)}</span></b>`
    : `<span>${[S.doseText(med), ...extra.map(esc)].join(' · ')}</span>${st === 'missed' ? '<span class="warn">לא סומן</span>' : ''}`;
  const cls = [st, date > today && 'future', view.justChecked.has(d.key) && 'pop'].filter(Boolean).join(' ');
  return `<button class="dose ${cls}" data-act="toggle" data-date="${date}" data-key="${d.key}" role="checkbox" aria-checked="${t ? 'true' : 'false'}">
    <span class="tile" style="--c:${med.color}">${icon(FORMS[med.form]?.icon || 'tablet')}</span>
    <span class="txt"><span class="name">${esc(med.name)}</span><span class="sub">${sub}</span></span>
    <span class="check">${icon('check')}</span>
  </button>`;
}

function renderHome() {
  const today = S.dateKey();
  const head = `${topbar()}<div class="eyebrow">${S.prettyDate(today)}</div><h1 class="large-title">${S.greeting()}${state.profile.name ? `, ${esc(state.profile.name)}` : ''}</h1>`;
  if (!liveMeds().length) return head + emptyState();

  const date = view.day;
  const plan = S.dayPlan(state, date);
  let out = head + summaryCard(date) + weekStrip(date);

  if (date === today) {
    if (!state.device.push) {
      out += `<button class="card banner press" data-act="notif"><span class="ico" style="background:var(--red)">${icon('bell')}</span><span class="txt"><b>להפעיל תזכורות</b><span>כדי שההתראה תגיע גם כשהאפליקציה סגורה</span></span>${icon('chevron')}</button>`;
    }
    for (const med of liveMeds()) {
      const days = S.stockDays(state, med);
      if (days != null && days <= 7) {
        out += `<button class="card banner press" data-act="edit-med" data-id="${med.id}"><span class="ico" style="background:var(--orange)">${icon('box')}</span><span class="txt"><b>המלאי של ${esc(med.name)} נגמר בקרוב</b><span>${med.stock ? `נשארו ${med.stock} · בערך ${days === 1 ? 'יום אחד' : `${days} ימים`}` : 'נגמר המלאי'}. כדאי לחדש מרשם</span></span>${icon('chevron')}</button>`;
      }
    }
  }

  if (!plan.length) {
    out += `<div class="empty"><p>${date > today ? 'אין תרופות מתוכננות ליום הזה.' : 'לא היו תרופות ביום הזה.'}</p></div>`;
    return out;
  }

  for (const g of plan) {
    const title = SLOTS[g.slot] ? SLOTS[g.slot].label : `בשעה ${g.time}`;
    const pending = g.doses.filter(d => !S.takenAt(state, date, d.key));
    const canAll = pending.length > 1 && date <= today && (date < today || S.minutes(g.time) - S.nowMinutes() <= S.DUE_BEFORE);
    out += `<section class="group" data-time="${g.time}">
      <div class="group-head"><span class="slot-ic ${slotClass(g.slot, g.time)}">${icon(S.slotIcon(g.slot))}</span><h2>${title}</h2>${SLOTS[g.slot] ? `<span class="time">${g.time}</span>` : ''}${groupChip(date, g)}</div>
      <div class="card">${g.doses.map(d => doseRow(date, d)).join('')}</div>
      ${canAll ? `<div class="group-foot"><button class="link-btn" data-act="all" data-date="${date}" data-time="${g.time}">לקחתי את כולן (${pending.length})</button></div>` : ''}
    </section>`;
  }
  return out;
}

function findDose(date, key) {
  for (const g of S.dayPlan(state, date)) for (const d of g.doses) if (d.key === key) return d;
  return null;
}

function mark(date, doses) {
  const now = Date.now();
  state.log[date] ||= {};
  for (const d of doses) {
    state.log[date][d.key] = now;
    if (d.med.stock != null) d.med.stock = Math.max(0, +(d.med.stock - (Number(d.med.amount) || 1)).toFixed(2));
    view.justChecked.add(d.key);
  }
  const sum = S.daySummary(state, date);
  view.celebrate = sum.total > 0 && sum.taken === sum.total;
  commit();
  render();
  navigator.vibrate?.(12);
  toast(doses.length > 1 ? `סומנו ${doses.length} תרופות` : `סומן: ${doses[0].med.name}`, {
    undo: () => {
      unmark(date, doses);
      render();
    },
  });
}

function unmark(date, doses) {
  for (const d of doses) {
    if (!state.log[date]?.[d.key]) continue;
    delete state.log[date][d.key];
    if (d.med.stock != null) d.med.stock = +(d.med.stock + (Number(d.med.amount) || 1)).toFixed(2);
  }
  commit();
}

async function toggleDose(date, key, el) {
  const today = S.dateKey();
  const dose = findDose(date, key);
  if (!dose) return;
  if (S.takenAt(state, date, key)) {
    const ok = await dialog({
      icon: 'alert', red: true, title: 'לבטל את הסימון?', text: `${dose.med.name} יסומן כאילו עוד לא נלקח.`,
      ok: 'ביטול הסימון', cancel: 'השארה', destructive: true,
    });
    if (!ok) return;
    unmark(date, [dose]);
    render();
    toast('הסימון בוטל', { icon: 'x' });
    return;
  }
  if (date > today) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    toast('אפשר לסמן רק ביום עצמו', { icon: 'info' });
    return;
  }
  if (date === today && S.status(state, date, dose) === 'upcoming') {
    const ok = await dialog({
      icon: 'clock', title: 'עוד לא הגיע הזמן', text: `${dose.med.name} מתוכנן לשעה ${dose.time}. לסמן שכבר נלקח?`,
      ok: 'כן, לקחתי', cancel: 'ביטול',
    });
    if (!ok) return;
  }
  mark(date, [dose]);
}

// ---------- Medicines ----------

function medRow(med) {
  const days = S.stockDays(state, med);
  const tag = med.stock != null ? `<span class="pill-tag ${days != null && days <= 7 ? 'low' : ''}">נשארו ${med.stock}</span>` : '';
  return `<button class="row med-row" data-act="edit-med" data-id="${med.id}">
    <span class="tile" style="--c:${med.color}">${icon(FORMS[med.form]?.icon || 'tablet')}</span>
    <span class="txt"><span class="t">${esc(med.name)}</span><span class="s">${S.doseText(med)} · ${S.scheduleText(state, med)}</span></span>
    ${tag}${icon('chevron')}
  </button>`;
}

function renderMeds() {
  const today = S.dateKey();
  const live = liveMeds();
  const active = live.filter(m => !m.until || m.until >= today);
  const ended = live.filter(m => m.until && m.until < today);
  let out = `<div class="topbar"><span></span><button class="round-btn accent" data-act="add-med" aria-label="הוספת תרופה">${icon('plus')}</button></div>
    <h1 class="large-title">התרופות שלי</h1>`;
  if (!live.length) return out + emptyState();
  out += `<div class="card">${active.map(medRow).join('')}</div>`;
  out += `<p class="hint">${active.length === 1 ? 'תרופה אחת' : `${active.length} תרופות`} · לחיצה על תרופה פותחת עריכה</p>`;
  if (ended.length) out += `<div class="section-title">טיפולים שהסתיימו</div><div class="card">${ended.map(medRow).join('')}</div>`;
  out += `<button class="btn soft block" style="margin-top:22px" data-act="add-med">${icon('plus')} הוספת תרופה</button>`;
  return out;
}

function stepFor(form) {
  return form === 'tablet' ? 0.5 : form === 'liquid' ? 2.5 : 1;
}

function medSheet(existing = null, { onSaved } = {}) {
  const isNew = !existing;
  const firstSlot = 'morning';
  const d = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: S.uid(), name: '', form: 'tablet', color: COLORS[liveMeds().length % COLORS.length], amount: 1, times: [firstSlot], days: null, food: 'any', note: '', stock: null, until: null, start: S.dateKey(), created: Date.now() };

  const sections = {
    tile: () => `<span class="tile big" style="--c:${d.color}">${icon(FORMS[d.form].icon)}</span>`,
    form: () => Object.entries(FORMS).map(([k, f]) => `<button class="chip ${d.form === k ? 'on' : ''}" data-f="form" data-v="${k}">${icon(f.icon)}${f.label}</button>`).join(''),
    color: () => COLORS.map(c => `<button class="${d.color === c ? 'on' : ''}" style="--c:${c}" data-f="color" data-v="${c}" aria-label="צבע"></button>`).join(''),
    dose: () => `<button class="round-btn" data-f="dose" data-v="-1" aria-label="פחות">${icon('minus')}</button><span class="txt">${S.doseText(d)}</span><button class="round-btn" data-f="dose" data-v="1" aria-label="יותר">${icon('plus')}</button>`,
    times: () => `<div class="slot-chips">${Object.entries(SLOTS).map(([k, s]) => `<button class="chip ${d.times.includes(k) ? 'on' : ''}" data-f="slot" data-v="${k}">${icon(s.icon)}${s.label}<small>${S.slotTime(state, k)}</small></button>`).join('')}</div>
      ${d.times.filter(t => !SLOTS[t]).map(t => `<div class="card custom-time" style="margin-top:8px">${icon('clock')}<span class="grow">שעה נוספת</span><input type="time" class="time-in" value="${t}" data-f="custom" data-v="${t}"><button class="round-btn" style="width:2rem;height:2rem" data-f="rm-custom" data-v="${t}" aria-label="הסרה">${icon('x')}</button></div>`).join('')}
      <button class="link-btn" data-f="add-custom">${icon('plus', 'inline')} שעה אחרת</button>`,
    days: () => `<div class="seg"><button class="${d.days ? '' : 'on'}" data-f="every">כל יום</button><button class="${d.days ? 'on' : ''}" data-f="some">ימים מסוימים</button></div>
      ${d.days ? `<div class="weekdays">${WEEKDAYS.map((w, i) => `<button class="${d.days.includes(i) ? 'on' : ''}" data-f="wd" data-v="${i}">${w}</button>`).join('')}</div>` : ''}`,
    food: () => Object.entries(FOOD).map(([k, v]) => `<button class="chip ${d.food === k ? 'on' : ''}" data-f="food" data-v="${k}">${v}</button>`).join(''),
    stock: () => `<label class="row plain"><span class="sq" style="--c:var(--orange)">${icon('box')}</span><span class="txt"><span class="t">מעקב אחרי המלאי</span><span class="s">יורד בכל סימון, ומזכיר כשנגמר</span></span><span class="switch"><input type="checkbox" data-f="stock-on" ${d.stock != null ? 'checked' : ''}><span></span></span></label>
      ${d.stock != null ? `<div class="stepper" style="border-top:0.5px solid var(--sep)"><button class="round-btn" data-f="stock" data-v="-1" aria-label="פחות">${icon('minus')}</button><span class="txt">יש בבית <span class="n">${d.stock}</span> ${FORMS[d.form].units}</span><button class="round-btn" data-f="stock" data-v="1" aria-label="יותר">${icon('plus')}</button></div>
      <div class="chips" style="padding:0 16px 14px"><button class="chip" style="background:var(--fill)" data-f="stock" data-v="10">+10</button><button class="chip" style="background:var(--fill)" data-f="stock" data-v="30">+30</button><button class="chip" style="background:var(--fill)" data-f="stock" data-v="0">איפוס</button></div>` : ''}`,
    until: () => `<label class="row plain"><span class="sq" style="--c:var(--indigo)">${icon('calendar')}</span><span class="txt"><span class="t">טיפול לתקופה מוגבלת</span><span class="s">למשל אנטיביוטיקה לשבוע</span></span><span class="switch"><input type="checkbox" data-f="until-on" ${d.until ? 'checked' : ''}><span></span></span></label>
      ${d.until ? `<div class="row plain"><span class="txt t">עד תאריך</span><input type="date" class="field" style="width:auto" value="${d.until}" min="${S.dateKey()}" data-f="until"></div>` : ''}`,
  };

  const body = `
    <div class="med-hero"><div id="f-tile">${sections.tile()}</div><input class="name-in" id="f-name" placeholder="שם התרופה" value="${esc(d.name)}" maxlength="40" autocomplete="off" enterkeyhint="done"></div>
    <div class="section-title">סוג</div><div class="chips scroll" id="f-form">${sections.form()}</div>
    <div class="section-title">צבע</div><div class="colors" id="f-color">${sections.color()}</div>
    <div class="section-title">מינון</div><div class="card stepper" id="f-dose">${sections.dose()}</div>
    <div class="section-title">מתי לוקחים</div><div id="f-times">${sections.times()}</div>
    <div class="section-title">באילו ימים</div><div id="f-days">${sections.days()}</div>
    <div class="section-title">אוכל</div><div class="chips grid2" id="f-food">${sections.food()}</div>
    <div class="section-title">עוד</div><div class="card" id="f-stock">${sections.stock()}</div>
    <div class="card" id="f-until" style="margin-top:10px">${sections.until()}</div>
    <div class="section-title">הערות</div><textarea class="note" id="f-note" placeholder="למשל: לא לקחת עם חלב" maxlength="200">${esc(d.note)}</textarea>
    ${isNew ? '' : `<button class="btn danger block" style="margin-top:26px" data-f="delete">${icon('trash')} מחיקת התרופה</button>`}`;

  const sheet = openSheet({ title: isNew ? 'תרופה חדשה' : 'עריכת תרופה', lead: 'ביטול', trail: isNew ? 'הוספה' : 'שמירה', body });
  const $ = id => sheet.body.querySelector(`#f-${id}`);
  const refresh = (...names) => names.forEach(n => { $(n).innerHTML = sections[n](); });
  const canSave = () => d.name.trim() && d.times.length && (!d.days || d.days.length);
  const updateSave = () => { sheet.trailBtn.disabled = !canSave(); };
  updateSave();

  $('name').addEventListener('input', e => { d.name = e.target.value; updateSave(); });
  $('name').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('note').addEventListener('input', e => { d.note = e.target.value; });
  if (isNew) setTimeout(() => $('name').focus({ preventScroll: true }), 450);

  sheet.body.addEventListener('change', e => {
    const f = e.target.dataset.f;
    if (f === 'custom') {
      const i = d.times.indexOf(e.target.dataset.v);
      if (e.target.value && !d.times.includes(e.target.value)) d.times[i] = e.target.value;
      refresh('times');
    } else if (f === 'stock-on') {
      d.stock = e.target.checked ? 30 : null;
      refresh('stock');
    } else if (f === 'until-on') {
      d.until = e.target.checked ? S.addDays(S.dateKey(), 6) : null;
      refresh('until');
    } else if (f === 'until') {
      d.until = e.target.value || null;
    }
  });

  sheet.body.addEventListener('click', async e => {
    const b = e.target.closest('[data-f]');
    if (!b || b.tagName === 'INPUT') return;
    const { f, v } = b.dataset;
    if (f === 'form') {
      d.form = v;
      const step = stepFor(v);
      d.amount = Math.max(step, Math.round(d.amount / step) * step);
      refresh('form', 'tile', 'dose');
      if (d.stock != null) refresh('stock');
      $('tile').firstElementChild.classList.add('bump');
    } else if (f === 'color') {
      d.color = v;
      refresh('color', 'tile');
      $('tile').firstElementChild.classList.add('bump');
    } else if (f === 'dose') {
      const step = stepFor(d.form);
      d.amount = Math.min(50, Math.max(step, +(d.amount + step * Number(v)).toFixed(2)));
      refresh('dose');
    } else if (f === 'slot') {
      d.times = d.times.includes(v) ? d.times.filter(t => t !== v) : [...d.times, v];
      refresh('times');
      updateSave();
    } else if (f === 'add-custom') {
      let t = '10:00';
      while (d.times.includes(t)) t = `${String((+t.slice(0, 2) + 1) % 24).padStart(2, '0')}:00`;
      d.times.push(t);
      refresh('times');
      updateSave();
    } else if (f === 'rm-custom') {
      d.times = d.times.filter(t => t !== v);
      refresh('times');
      updateSave();
    } else if (f === 'every') {
      d.days = null;
      refresh('days');
      updateSave();
    } else if (f === 'some') {
      d.days ||= [0, 1, 2, 3, 4, 5, 6];
      refresh('days');
    } else if (f === 'wd') {
      const i = Number(v);
      d.days = d.days.includes(i) ? d.days.filter(x => x !== i) : [...d.days, i].sort();
      refresh('days');
      updateSave();
    } else if (f === 'food') {
      d.food = v;
      refresh('food');
    } else if (f === 'stock') {
      const n = Number(v);
      d.stock = n === 0 && v === '0' ? 0 : Math.max(0, (d.stock || 0) + n);
      refresh('stock');
    } else if (f === 'delete') {
      const ok = await dialog({ icon: 'trash', red: true, title: `למחוק את ${d.name}?`, text: 'התזכורות שלה ייפסקו. ההיסטוריה של הימים שעברו נשארת.', ok: 'מחיקה', cancel: 'ביטול', destructive: true });
      if (!ok) return;
      const med = state.meds.find(m => m.id === d.id);
      const hasLog = Object.values(state.log).some(day => Object.keys(day).some(k => k.startsWith(`${d.id}@`)));
      if (hasLog) med.deleted = S.dateKey();
      else state.meds = state.meds.filter(m => m.id !== d.id);
      commit();
      sheet.close();
      render();
      toast(`${d.name} נמחקה`, { icon: 'trash' });
    }
  });

  sheet.onTrail = () => {
    if (!canSave()) return;
    d.name = d.name.trim();
    d.note = d.note.trim();
    d.times = [...new Set(d.times)];
    if (isNew) state.meds.push(d);
    else state.meds = state.meds.map(m => (m.id === d.id ? d : m));
    commit();
    sheet.close();
    render();
    toast(isNew ? `${d.name} נוספה` : 'נשמר');
    onSaved?.(d);
  };
  return sheet;
}

// ---------- History ----------

function renderHistory() {
  const today = S.dateKey();
  const month = view.month || today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const streak = S.streak(state);
  const w = S.adherence(state, 7);
  const mo = S.adherence(state, 30);

  let out = `<div class="topbar"></div><h1 class="large-title">היסטוריה</h1>
    <div class="stats">
      <div class="card stat"><span style="color:var(--orange)">${icon('flame')}</span><b>${streak}</b><span>${streak === 1 ? 'יום מלא ברצף' : 'ימים מלאים ברצף'}</span></div>
      <div class="card stat"><span style="color:var(--green)">${icon('check')}</span><b>${w == null ? '—' : `${w}%`}</b><span>השבוע</span></div>
      <div class="card stat"><span style="color:var(--accent)">${icon('calendar')}</span><b>${mo == null ? '—' : `${mo}%`}</b><span>30 יום</span></div>
    </div>`;

  const first = new Date(y, m - 1, 1);
  const daysIn = new Date(y, m, 0).getDate();
  const isCurrent = month === today.slice(0, 7);
  let cells = WEEKDAYS.map(d => `<span class="wd">${d}</span>`).join('');
  cells += '<span></span>'.repeat(first.getDay());
  for (let i = 1; i <= daysIn; i++) {
    const key = `${month}-${String(i).padStart(2, '0')}`;
    const sum = S.daySummary(state, key);
    const ratio = sum.total ? sum.taken / sum.total : 0;
    const future = key > today;
    const cls = [future && 'future', key === today && 'today', key === view.histDay && 'sel', !future && key !== today && sum.total && !sum.taken && 'none'].filter(Boolean).join(' ');
    cells += `<button class="cal-day ${cls}" data-act="hday" data-date="${key}"><svg viewBox="0 0 40 40">${sum.total && !future ? `<circle class="track" cx="20" cy="20" r="18" pathLength="100"/>` : ''}${ratio ? `<circle class="bar ${ratio < 1 ? 'part' : ''}" cx="20" cy="20" r="18" pathLength="100" style="stroke-dashoffset:${100 - ratio * 100}"/>` : ''}</svg>${i}</button>`;
  }
  out += `<div class="card cal" style="margin-top:14px">
    <div class="cal-head">
      <button class="round-btn" data-act="month" data-v="-1" aria-label="חודש קודם" style="transform:scaleX(-1)">${icon('chevron')}</button>
      <h3>${S.MONTHS[m - 1]} ${y}</h3>
      <button class="round-btn" data-act="month" data-v="1" aria-label="חודש הבא" ${isCurrent ? 'disabled style="opacity:.3"' : ''}>${icon('chevron')}</button>
    </div>
    <div class="cal-grid">${cells}</div>
    <div class="legend"><span><i style="background:var(--green)"></i>הכל נלקח</span><span><i style="background:var(--orange)"></i>חלקי</span><span><i style="background:var(--red)"></i>לא סומן</span></div>
  </div>`;

  const date = view.histDay;
  const plan = S.dayPlan(state, date);
  const sum = S.daySummary(state, date);
  out += `<div class="section-title"><span>${S.prettyDate(date)}</span><span>${sum.total ? `${sum.taken}/${sum.total}` : ''}</span></div>`;
  if (!plan.length) {
    out += `<div class="card" style="padding:18px;text-align:center;color:var(--label-2)">אין תרופות ביום הזה</div>`;
  } else {
    out += `<div class="card">${plan.flatMap(g => g.doses).map(d => {
      const t = S.takenAt(state, date, d.key);
      const st = S.status(state, date, d);
      const badge = t ? `<span class="st ok">${icon('check')} <span dir="ltr">${S.clock(t)}</span></span>`
        : st === 'missed' ? `<span class="st no">${icon('x')} לא סומן</span>`
        : `<span class="st wait">${st === 'upcoming' ? 'מתוכנן' : 'ממתין'}</span>`;
      return `<div class="log-row"><span class="time">${d.time}</span><span class="tile" style="--c:${d.med.color};width:2rem;height:2rem;border-radius:9px">${icon(FORMS[d.med.form]?.icon || 'tablet')}</span><span class="txt">${esc(d.med.name)}</span>${badge}</div>`;
    }).join('')}</div>`;
    if (date <= today) out += `<div class="group-foot"><button class="link-btn" data-act="goto-day" data-date="${date}">לסימון ועריכה של היום הזה</button></div>`;
  }
  return out;
}

// ---------- Profile ----------

const NAGS = [[10, 'כל 10 דקות'], [15, 'כל 15 דקות'], [30, 'כל חצי שעה'], [60, 'כל שעה'], [0, 'בלי תזכורת חוזרת']];
const nagLabel = n => (NAGS.find(x => x[0] === n) || NAGS[1])[1];

function notifStatus() {
  if (state.device.push) return 'פעילות';
  const sup = Push.support();
  if (sup === 'install') return 'דורש התקנה';
  if (sup === 'none') return 'לא נתמך';
  if (Push.permission() === 'denied') return 'חסומות';
  return 'כבויות';
}

function renderProfile() {
  const p = state.profile;
  const since = state.meds.reduce((min, m) => (m.start && m.start < min ? m.start : min), S.dateKey());
  const sd = S.parseDate(since);
  const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="topbar"></div>
  <div class="profile-head">
    <div class="avatar">${p.name ? esc(p.name.trim()[0]) : icon('person')}</div>
    <h2>${p.name ? esc(p.name) : 'הפרופיל שלי'}</h2>
    <p>${liveMeds().length} תרופות · ב־Remind. מאז ${S.MONTHS[sd.getMonth()]} ${sd.getFullYear()}</p>
    <button class="link-btn" data-act="edit-name">עריכת שם</button>
  </div>

  <div class="section-title">תזכורות</div>
  <div class="card">
    <button class="row" data-act="notif"><span class="sq" style="--c:var(--red)">${icon('bell')}</span><span class="txt t">התראות</span><span class="val">${notifStatus()}</span>${icon('chevron')}</button>
    <button class="row" data-act="nag"><span class="sq" style="--c:var(--orange)">${icon('repeat')}</span><span class="txt"><span class="t">תזכורת חוזרת</span><span class="s">עד שמסמנים, עד שעתיים</span></span><span class="val">${nagLabel(p.nag)}</span>${icon('chevron')}</button>
    ${state.device.push ? `<button class="row accent" data-act="test-push"><span class="sq">${icon('sparkle')}</span><span class="txt t">שליחת התראת ניסיון</span></button>` : ''}
  </div>

  <div class="section-title">זמני היום</div>
  <div class="card time-rows">
    ${Object.entries(SLOTS).map(([k, s]) => `<label class="row"><span class="slot-ic ${k}">${icon(s.icon)}</span><span class="txt t">${s.label}</span><input type="time" class="time-in" value="${S.slotTime(state, k)}" data-act="slot-time" data-slot="${k}"></label>`).join('')}
  </div>
  <p class="hint">שינוי שעה מזיז את כל התרופות של אותו זמן.</p>

  <div class="section-title">תצוגה</div>
  <div class="card">
    <div class="row plain"><span class="sq" style="--c:var(--indigo)">${icon('textSize')}</span><span class="txt t">גודל טקסט</span></div>
    <div style="padding:0 16px 14px">${seg('size', p.textSize, [['m', 'רגיל'], ['l', 'גדול'], ['xl', 'גדול מאוד']])}</div>
    <div class="row plain"><span class="sq" style="--c:#636366">${icon('contrast')}</span><span class="txt t">מראה</span></div>
    <div style="padding:0 16px 14px">${seg('theme', p.theme, [['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']])}</div>
  </div>

  <div class="section-title">משפחה</div>
  <div class="card">
    <button class="row" data-act="contact"><span class="sq" style="--c:var(--green)">${icon('phone')}</span><span class="txt"><span class="t">${p.contact.name ? esc(p.contact.name) : 'איש קשר במשפחה'}</span><span class="s">${p.contact.phone ? `<span dir="ltr">${esc(p.contact.phone)}</span>` : 'למי לשלוח עדכון'}</span></span>${icon('chevron')}</button>
    <button class="row" data-act="share-day"><span class="sq" style="--c:#25d366">${icon('message')}</span><span class="txt"><span class="t">שליחת עדכון של היום</span><span class="s">בוואטסאפ: מה נלקח ומה עוד לא</span></span>${icon('chevron')}</button>
  </div>

  <div class="section-title">גיבוי</div>
  <div class="card">
    <button class="row" data-act="export"><span class="sq" style="--c:#8e8e93">${icon('download')}</span><span class="txt t">שמירת גיבוי</span>${icon('chevron')}</button>
    <button class="row" data-act="import"><span class="sq" style="--c:#8e8e93">${icon('upload')}</span><span class="txt t">שחזור מגיבוי</span>${icon('chevron')}</button>
    <button class="row danger" data-act="reset"><span class="sq" style="--c:var(--red)">${icon('trash')}</span><span class="txt t">מחיקת כל הנתונים</span></button>
  </div>

  <div class="foot">${wordmark()}גרסה 1.0 · הכל נשמר בטלפון הזה בלבד</div>`;
}

function nameSheet() {
  const sheet = openSheet({
    title: 'השם שלי', lead: 'ביטול', trail: 'שמירה',
    body: `<input class="big-in" id="nm" value="${esc(state.profile.name)}" placeholder="שם" maxlength="24" autocomplete="given-name" style="margin-top:8px">`,
  });
  const input = sheet.body.querySelector('#nm');
  setTimeout(() => input.focus(), 400);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sheet.onTrail(); });
  sheet.onTrail = () => {
    state.profile.name = input.value.trim();
    commit({ sync: false });
    sheet.close();
    render();
  };
}

function contactSheet() {
  const c = state.profile.contact;
  const sheet = openSheet({
    title: 'איש קשר', lead: 'ביטול', trail: 'שמירה',
    body: `<p class="hint" style="margin:4px 4px 14px">בן או בת משפחה שיקבלו עדכון בוואטסאפ על התרופות של היום.</p>
      <div class="card"><label class="row plain"><span class="txt t" style="flex:none;width:4.5rem">שם</span><input class="field" id="cn" value="${esc(c.name)}" placeholder="למשל: תומר" maxlength="30"></label>
      <label class="row plain"><span class="txt t" style="flex:none;width:4.5rem">טלפון</span><input class="field" id="cp" type="tel" dir="ltr" style="text-align:right" value="${esc(c.phone)}" placeholder="050-0000000" maxlength="20"></label></div>`,
  });
  sheet.onTrail = () => {
    state.profile.contact = { name: sheet.body.querySelector('#cn').value.trim(), phone: sheet.body.querySelector('#cp').value.trim() };
    commit({ sync: false });
    sheet.close();
    render();
  };
}

function nagSheet() {
  const sheet = openSheet({
    title: 'תזכורת חוזרת', trail: 'סיום',
    body: `<p class="hint" style="margin:4px 4px 14px">אם עוד לא סימנת שהתרופה נלקחה, Remind. יזכיר שוב, עד שעתיים אחרי הזמן.</p>
      ${NAGS.map(([v, l]) => `<button class="option ${state.profile.nag === v ? 'on' : ''}" data-v="${v}"><span class="txt">${l}</span><span class="radio"></span></button>`).join('')}`,
  });
  sheet.onTrail = () => sheet.close();
  sheet.body.addEventListener('click', e => {
    const b = e.target.closest('.option');
    if (!b) return;
    state.profile.nag = Number(b.dataset.v);
    sheet.body.querySelectorAll('.option').forEach(o => o.classList.toggle('on', o === b));
    commit();
    render();
    setTimeout(() => sheet.close(), 280);
  });
}

function installSteps() {
  return `<div class="steps">
    <div class="row"><span class="num">1</span><span class="txt t">לוחצים על כפתור השיתוף ב־Safari</span>${icon('share', 'big')}</div>
    <div class="row"><span class="num">2</span><span class="txt t">בוחרים „הוספה למסך הבית”</span>${icon('addSquare', 'big')}</div>
    <div class="row"><span class="num">3</span><span class="txt t">פותחים את Remind. ממסך הבית</span>${appIcon()}</div>
  </div>`;
}

// The notification setup, shared by the profile sheet and onboarding. Calls back after changes.
function notifBody() {
  const sup = Push.support();
  const perm = Push.permission();
  if (sup === 'install') {
    return `<div class="status-card warn">${icon('info')}<div>באייפון התראות עובדות רק מהאפליקציה שבמסך הבית<span>שלושה צעדים, פעם אחת:</span></div></div><div style="height:12px"></div>${installSteps()}`;
  }
  if (sup === 'none') {
    return `<div class="status-card bad">${icon('alert')}<div>הדפדפן הזה לא תומך בהתראות<span>כדאי לפתוח את Remind. ב־Safari באייפון או ב־Chrome באנדרואיד.</span></div></div>`;
  }
  if (perm === 'denied') {
    return `<div class="status-card bad">${icon('bellOff')}<div>ההתראות חסומות<span>${Push.isIOS() ? 'להפעלה: הגדרות ← הודעות ← Remind. ← לאפשר הודעות.' : 'להפעלה: בהגדרות האתר בדפדפן מאפשרים התראות.'}</span></div></div>`;
  }
  if (state.device.push) {
    return `<div class="status-card">${icon('check')}<div>התזכורות פעילות<span>ההתראה תגיע בכל זמן תרופה, גם כשהטלפון נעול.</span></div></div>
      <div style="display:grid;gap:10px;margin-top:14px"><button class="btn soft block" data-n="test">${icon('sparkle')} שליחת התראת ניסיון</button><button class="btn gray block" data-n="off">כיבוי התראות</button></div>`;
  }
  return `<button class="btn block" data-n="on">${icon('bell')} הפעלת התראות</button>`;
}

async function notifAction(kind, btn) {
  if (kind === 'on') {
    btn.disabled = true;
    btn.textContent = 'מפעיל…';
    try {
      await Push.enable(state);
      commit({ sync: false });
      toast('התזכורות הופעלו');
    } catch (e) {
      state.device.push = false;
      commit({ sync: false });
      if (!e.denied) toast('אין חיבור לשרת התזכורות כרגע. כדאי לנסות שוב בעוד רגע', { icon: 'alert', ms: 5000 });
    }
  } else if (kind === 'off') {
    await Push.disable(state);
    commit({ sync: false });
    toast('ההתראות כבויות', { icon: 'bellOff' });
  } else if (kind === 'test') {
    btn.disabled = true;
    try {
      await Push.test(state);
      toast('נשלחה התראת ניסיון');
    } catch {
      toast('השליחה נכשלה. כדאי לבדוק את החיבור לאינטרנט', { icon: 'alert' });
    }
    btn.disabled = false;
  }
}

function notifSheet() {
  const sheet = openSheet({
    title: 'תזכורות', trail: 'סיום',
    body: `<div style="text-align:center;padding:6px 0 18px"><span class="tile big" style="--c:var(--red);margin:0 auto 14px">${icon('bell')}</span>
      <h3 style="margin:0 0 6px;font-size:1.35rem;font-weight:900">תזכורת בכל זמן תרופה</h3>
      <p style="margin:0;color:var(--label-2)">גם כשהאפליקציה סגורה והטלפון נעול. אם עוד לא סימנת, תגיע תזכורת חוזרת.</p></div>
      <div id="nb">${notifBody()}</div>`,
  });
  sheet.onTrail = () => sheet.close();
  sheet.body.addEventListener('click', async e => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    await notifAction(b.dataset.n, b);
    sheet.body.querySelector('#nb').innerHTML = notifBody();
    render();
  });
}

function shareDay() {
  const date = S.dateKey();
  const lines = [`עדכון מ־Remind. · ${S.prettyDate(date)}`];
  for (const g of S.dayPlan(state, date)) {
    for (const d of g.doses) {
      const t = S.takenAt(state, date, d.key);
      lines.push(`${t ? '✅' : '⏳'} ${d.med.name} (${g.time})${t ? ` · נלקח ב־${S.clock(t)}` : ' · עוד לא סומן'}`);
    }
  }
  const sum = S.daySummary(state, date);
  lines.push(sum.total ? `סה״כ ${sum.taken} מתוך ${sum.total}` : 'אין תרופות היום');
  const text = lines.join('\n');
  let phone = state.profile.contact.phone.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = `972${phone.slice(1)}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

async function exportBackup() {
  const data = JSON.stringify({ app: 'remind', version: 1, ...state, device: undefined }, null, 2);
  const file = new File([data], `remind-backup-${S.dateKey()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'גיבוי Remind.' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      if (data.app !== 'remind' || !Array.isArray(data.meds)) throw new Error('not a backup');
      const ok = await dialog({ icon: 'upload', title: 'לשחזר מהגיבוי?', text: `${data.meds.filter(m => !m.deleted).length} תרופות. הנתונים הנוכחיים יוחלפו.`, ok: 'שחזור', cancel: 'ביטול' });
      if (!ok) return;
      const base = S.defaults();
      state = { ...base, ...data, profile: { ...base.profile, ...data.profile }, device: state.device, onboarded: true };
      delete state.app;
      delete state.version;
      applyAppearance();
      commit();
      render();
      toast('הגיבוי שוחזר');
    } catch {
      toast('הקובץ הזה לא נראה כמו גיבוי של Remind.', { icon: 'alert' });
    }
  };
  input.click();
}

async function resetAll() {
  const ok = await dialog({ icon: 'trash', red: true, title: 'למחוק הכל?', text: 'כל התרופות, ההיסטוריה וההגדרות יימחקו מהטלפון. אי אפשר לבטל.', ok: 'מחיקה', cancel: 'ביטול', destructive: true });
  if (!ok) return;
  await Push.disable(state);
  try { localStorage.removeItem('remind.v1'); } catch {}
  await caches.delete('remind-data').catch(() => {});
  location.hash = '';
  location.reload();
}

// ---------- Clicks on the screens ----------

$view.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'INPUT') return;
  const { act, date, key, id, v } = b.dataset;
  switch (act) {
    case 'toggle': toggleDose(date, key, b); break;
    case 'all': {
      const g = S.dayPlan(state, date).find(x => x.time === b.dataset.time);
      const pending = g ? g.doses.filter(d => !S.takenAt(state, date, d.key)) : [];
      if (pending.length) mark(date, pending);
      break;
    }
    case 'day': view.day = date; render(); break;
    case 'add-med': medSheet(); break;
    case 'edit-med': medSheet(state.meds.find(m => m.id === id)); break;
    case 'notif': notifSheet(); break;
    case 'nag': nagSheet(); break;
    case 'test-push': notifAction('test', b); break;
    case 'edit-name': nameSheet(); break;
    case 'contact': contactSheet(); break;
    case 'share-day': shareDay(); break;
    case 'export': exportBackup(); break;
    case 'import': importBackup(); break;
    case 'reset': resetAll(); break;
    case 'hday': view.histDay = date; render(); break;
    case 'month': {
      const [y, m] = (view.month || S.dateKey().slice(0, 7)).split('-').map(Number);
      const d = new Date(y, m - 1 + Number(v), 1);
      view.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      render();
      break;
    }
    case 'goto-day': view.day = date; setTab('home'); break;
    case 'size': state.profile.textSize = v; applyAppearance(); commit({ sync: false }); render(); movePill(); break;
    case 'theme': state.profile.theme = v; applyAppearance(); commit({ sync: false }); render(); break;
  }
});

$view.addEventListener('change', e => {
  if (e.target.dataset.act === 'slot-time' && e.target.value) {
    state.profile.slots[e.target.dataset.slot].time = e.target.value;
    commit();
    toast(`${SLOTS[e.target.dataset.slot].label}: ${e.target.value}`, { icon: 'clock' });
  }
});

// ---------- Sheets, dialogs, toasts ----------

function openSheet({ title, lead, trail, body }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const el = document.createElement('div');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="grabber"><i></i></div>
    <div class="sheet-head"><div class="l">${lead ? `<button data-s="lead">${lead}</button>` : ''}</div><h3>${title}</h3><div class="r">${trail ? `<button class="strong" data-s="trail">${trail}</button>` : ''}</div></div>
    <div class="sheet-body">${body}</div>`;
  document.body.append(backdrop, el);
  const sheet = {
    el,
    body: el.querySelector('.sheet-body'),
    trailBtn: el.querySelector('[data-s="trail"]') || document.createElement('button'),
    onTrail: null,
    close() {
      if (sheet.closed) return;
      sheet.closed = true;
      el.style.transform = '';
      el.classList.remove('open', 'dragging');
      backdrop.classList.remove('open');
      setTimeout(() => { el.remove(); backdrop.remove(); }, 520);
    },
  };
  requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('open'); backdrop.classList.add('open'); }));
  backdrop.addEventListener('click', () => sheet.close());
  el.querySelector('[data-s="lead"]')?.addEventListener('click', () => sheet.close());
  sheet.trailBtn.addEventListener('click', () => sheet.onTrail?.());

  // Drag down to close, from the grabber or the title bar.
  let startY = null;
  let lastY = 0;
  let lastT = 0;
  let speed = 0;
  const handles = [el.querySelector('.grabber'), el.querySelector('.sheet-head')];
  const down = e => {
    if (e.target.closest('button')) return;
    startY = e.clientY;
    lastY = e.clientY;
    lastT = e.timeStamp;
    el.classList.add('dragging');
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = e => {
    if (startY == null) return;
    const dy = Math.max(0, e.clientY - startY);
    speed = (e.clientY - lastY) / Math.max(1, e.timeStamp - lastT);
    lastY = e.clientY;
    lastT = e.timeStamp;
    el.style.transform = `translateY(${dy}px)`;
  };
  const up = e => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    el.classList.remove('dragging');
    if (dy > 140 || speed > 0.6) sheet.close();
    else el.style.transform = '';
  };
  for (const h of handles) {
    h.addEventListener('pointerdown', down);
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  }
  return sheet;
}

function dialog({ title, text, ok = 'אישור', cancel = 'ביטול', destructive = false, icon: ic, red = false }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.innerHTML = `<div class="backdrop"></div><div class="dialog" role="alertdialog" aria-modal="true">
      <div class="body">${ic ? `<div class="dlg-ic ${red ? 'red' : ''}">${icon(ic)}</div>` : ''}<h4>${esc(title)}</h4>${text ? `<p>${esc(text)}</p>` : ''}</div>
      <div class="actions"><button data-v="0">${esc(cancel)}</button><button data-v="1" class="strong ${destructive ? 'destructive' : ''}">${esc(ok)}</button></div>
    </div>`;
    document.body.append(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.querySelector('.backdrop').classList.add('open');
      wrap.querySelector('.dialog').classList.add('open');
    }));
    const done = v => {
      wrap.querySelector('.backdrop').classList.remove('open');
      wrap.querySelector('.dialog').classList.remove('open');
      setTimeout(() => wrap.remove(), 300);
      resolve(v);
    };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (b) done(b.dataset.v === '1');
      else if (e.target.classList.contains('backdrop')) done(false);
    });
  });
}

let toastEl;
let toastTimer;
function toast(text, { undo, icon: ic = 'check', ms = 3500 } = {}) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.append(toastEl);
  }
  clearTimeout(toastTimer);
  toastEl.className = `toast ${undo ? '' : 'no-btn'}`;
  toastEl.innerHTML = `${icon(ic)}<span>${esc(text)}</span>${undo ? '<button>ביטול</button>' : ''}`;
  if (undo) {
    toastEl.querySelector('button').onclick = () => {
      toastEl.classList.remove('open');
      undo();
    };
  }
  requestAnimationFrame(() => toastEl.classList.add('open'));
  toastTimer = setTimeout(() => toastEl.classList.remove('open'), undo ? Math.max(ms, 5000) : ms);
}

// The in-app heads-up when a dose time arrives while Remind. is open.
let bannerEl;
function dueBanner(date, g, pending) {
  bannerEl?.remove();
  bannerEl = document.createElement('button');
  bannerEl.className = 'top-banner';
  const label = SLOTS[g.slot] ? `של ה${SLOTS[g.slot].label}` : `של ${g.time}`;
  bannerEl.innerHTML = `${appIcon()}<span class="txt"><b>הגיע הזמן לתרופות ${label}</b><span>${pending.map(d => esc(d.med.name)).join(', ')}</span></span>`;
  document.body.append(bannerEl);
  const el = bannerEl;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
  const hide = () => { el.classList.remove('open'); setTimeout(() => el.remove(), 600); };
  el.onclick = () => {
    hide();
    openDose(date, g.time);
  };
  setTimeout(hide, 12000);
}

function openDose(date, time) {
  view.day = date || S.dateKey();
  if (view.tab !== 'home') setTab('home');
  else render();
  const sec = $view.querySelector(`.group[data-time="${time}"]`);
  if (sec) {
    sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
    sec.querySelectorAll('.dose:not(.taken)').forEach(d => d.classList.add('flash'));
  }
}

// ---------- Clock ----------

const alerted = new Set(JSON.parse(sessionStorage.getItem('remind.alerted') || '[]'));
let lastMinute = '';

function tick(force = false) {
  const now = new Date();
  const today = S.dateKey(now);
  const stamp = `${today} ${S.nowMinutes(now)}`;
  if (stamp === lastMinute && !force) return;
  lastMinute = stamp;
  if (today !== view.today) {
    if (view.day === view.today) view.day = today;
    view.histDay = today;
    view.today = today;
  }
  if (!state.onboarded) return;

  for (const g of S.dayPlan(state, today)) {
    const diff = S.nowMinutes(now) - S.minutes(g.time);
    const id = `${today} ${g.time}`;
    if (diff < 0 || diff > 2 || alerted.has(id)) continue;
    const pending = g.doses.filter(d => !S.takenAt(state, today, d.key));
    if (!pending.length) continue;
    alerted.add(id);
    sessionStorage.setItem('remind.alerted', JSON.stringify([...alerted]));
    if (document.visibilityState === 'visible') dueBanner(today, g, pending);
    // Without the server, at least notify while the app is open in the background.
    else if (!state.device.push && Push.permission() === 'granted') {
      navigator.serviceWorker?.ready.then(reg => reg.showNotification('הגיע הזמן לתרופות', {
        body: pending.map(d => d.med.name).join(', '), tag: `dose-${id}`, icon: 'img/icon-192.png',
      })).catch(() => {});
    }
  }
  if (view.tab === 'home' || force) render();
}

// ---------- Onboarding ----------

function onboarding() {
  const needsInstall = Push.isIOS() && !Push.isStandalone();
  const steps = ['welcome', ...(needsInstall ? ['install'] : []), 'name', 'times', 'nag', 'size', 'meds', 'notify', 'done'];
  const counted = steps.filter(s => s !== 'welcome' && s !== 'done');
  let at = 0;

  const el = document.createElement('div');
  el.className = 'onboard';
  el.innerHTML = `<div class="ob-top"><button class="round-btn hide" data-o="back" aria-label="חזרה" style="transform:scaleX(-1)">${icon('chevron')}</button><div class="progress">${counted.map(() => '<i></i>').join('')}</div><span style="width:2.3rem"></span></div><div class="ob-stage"></div>`;
  document.body.append(el);
  const stage = el.querySelector('.ob-stage');
  const p = state.profile;

  const actions = (main, { disabled = false, skip = '' } = {}) =>
    `<div class="ob-actions"><button class="btn block" data-o="next" ${disabled ? 'disabled' : ''}>${main}</button>${skip ? `<button class="link-btn" data-o="next">${skip}</button>` : ''}</div>`;

  const views = {
    welcome: () => `<div class="ob-step welcome">
      ${appIcon('app-icon')}
      ${wordmark()}
      <p class="lead">התרופות שלך, בזמן.<br>בלי לשכוח ובלי לנחש.</p>
      <div class="features">
        <div class="feature"><span class="sq" style="--c:var(--red)">${icon('bell')}</span><div><b>תזכורת בכל זמן תרופה</b><span>בוקר, צהריים וערב, גם כשהטלפון נעול</span></div></div>
        <div class="feature"><span class="sq" style="--c:var(--green)">${icon('check')}</span><div><b>מסמנים רק אחרי שלוקחים</b><span>ותמיד יודעים מה כבר נלקח היום</span></div></div>
        <div class="feature"><span class="sq" style="--c:var(--accent)">${icon('history')}</span><div><b>היסטוריה ומלאי</b><span>רואים כל יום, ומקבלים התראה לפני שנגמר</span></div></div>
      </div>
      ${actions('מתחילים')}
    </div>`,
    install: () => `<div class="ob-step">
      <h1>קודם, מוסיפים למסך הבית</h1>
      <p class="lead">כך Remind. עובד כמו אפליקציה, וההתראות מגיעות גם כשהטלפון נעול.</p>
      ${installSteps()}
      <p class="hint">אחרי שפותחים ממסך הבית, ממשיכים את ההגדרה משם.</p>
      ${actions('להמשיך בלי להתקין')}
    </div>`,
    name: () => `<div class="ob-step">
      <h1>איך קוראים לך?</h1>
      <p class="lead">כדי שנדע איך לפנות.</p>
      <input class="big-in" id="ob-name" value="${esc(p.name)}" placeholder="השם שלך" maxlength="24" autocomplete="given-name" enterkeyhint="next">
      ${actions('המשך', { disabled: !p.name.trim(), skip: 'דילוג' })}
    </div>`,
    times: () => `<div class="ob-step">
      <h1>מתי לוקחים תרופות?</h1>
      <p class="lead">השעות הקבועות של היום. אפשר לשנות בכל רגע.</p>
      <div class="card time-rows">${Object.entries(SLOTS).map(([k, s]) => `<label class="row"><span class="slot-ic ${k}">${icon(s.icon)}</span><span class="txt t">${s.label}</span><input type="time" class="time-in" value="${p.slots[k].time}" data-slot="${k}"></label>`).join('')}</div>
      ${actions('המשך')}
    </div>`,
    nag: () => `<div class="ob-step">
      <h1>ואם עוד לא סימנת?</h1>
      <p class="lead">Remind. יזכיר שוב, עד שמסמנים שהתרופה נלקחה.</p>
      ${NAGS.map(([v, l]) => `<button class="option ${p.nag === v ? 'on' : ''}" data-nag="${v}"><span class="txt">${l}${v === 15 ? '<small>מומלץ</small>' : ''}</span><span class="radio"></span></button>`).join('')}
      ${actions('המשך')}
    </div>`,
    size: () => `<div class="ob-step">
      <h1>איזה גודל טקסט נוח?</h1>
      <p class="lead">אפשר לשנות אחר כך בפרופיל.</p>
      ${[['m', 'רגיל', '1.1rem'], ['l', 'גדול', '1.35rem'], ['xl', 'גדול מאוד', '1.65rem']].map(([v, l, fs]) => `<button class="option ${p.textSize === v ? 'on' : ''}" data-size="${v}"><span class="aa" style="font-size:${fs}">אב</span><span class="txt">${l}</span><span class="radio"></span></button>`).join('')}
      ${actions('המשך')}
    </div>`,
    meds: () => {
      const list = liveMeds();
      return `<div class="ob-step">
        <h1>${list.length ? 'מעולה. עוד תרופות?' : 'מה התרופות הקבועות?'}</h1>
        <p class="lead">שם, מינון ומתי לוקחים. לוקח חצי דקה לכל תרופה.</p>
        ${list.length ? `<div class="card" style="margin-bottom:14px">${list.map(m => `<div class="row med-row"><span class="tile" style="--c:${m.color}">${icon(FORMS[m.form].icon)}</span><span class="txt"><span class="t">${esc(m.name)}</span><span class="s">${S.doseText(m)} · ${S.scheduleText(state, m)}</span></span></div>`).join('')}</div>` : ''}
        <button class="btn soft block" data-o="add">${icon('plus')} ${list.length ? 'הוספת תרופה נוספת' : 'הוספת תרופה'}</button>
        ${actions(list.length ? 'המשך' : 'אוסיף אחר כך', {})}
      </div>`;
    },
    notify: () => `<div class="ob-step">
      <h1>שהתזכורת תגיע בזמן</h1>
      <p class="lead">התראה בכל זמן תרופה, גם כשהאפליקציה סגורה והטלפון נעול.</p>
      <div id="ob-nb">${notifBody()}</div>
      ${actions(state.device.push ? 'המשך' : 'המשך בלי התראות')}
    </div>`,
    done: () => `<div class="ob-step welcome">
      <div class="done-mark">${icon('check')}</div>
      <h1>הכל מוכן${p.name ? `, ${esc(p.name)}` : ''}</h1>
      <p class="lead">Remind. יזכיר בזמן. מסמנים ✓ רק אחרי שלוקחים את התרופה.</p>
      ${actions('לעמוד הראשי')}
    </div>`,
  };

  function show(i, dir = 1) {
    const old = stage.querySelector('.ob-step');
    at = i;
    stage.insertAdjacentHTML('beforeend', views[steps[at]]());
    const step = stage.lastElementChild;
    [...step.children].forEach((c, n) => c.style.setProperty('--i', n));
    if (old) {
      step.classList.add(dir > 0 ? 'from-next' : 'from-prev');
      void step.offsetWidth;
      step.classList.remove('from-next', 'from-prev');
      old.classList.add(dir > 0 ? 'from-prev' : 'from-next');
      setTimeout(() => old.remove(), 550);
    }
    const n = counted.indexOf(steps[at]);
    const shown = n === -1 ? (steps[at] === 'done' ? counted.length : 0) : n + 1;
    el.querySelectorAll('.progress i').forEach((b, k) => b.classList.toggle('on', k < shown));
    el.querySelector('[data-o="back"]').classList.toggle('hide', at === 0 || steps[at] === 'done');
    el.querySelector('.ob-top').style.visibility = steps[at] === 'welcome' ? 'hidden' : '';

    const name = step.querySelector('#ob-name');
    if (name) {
      name.addEventListener('input', () => {
        p.name = name.value;
        step.querySelector('.btn[data-o="next"]').disabled = !p.name.trim();
      });
      name.addEventListener('keydown', e => { if (e.key === 'Enter' && p.name.trim()) next(); });
      setTimeout(() => name.focus({ preventScroll: true }), 500);
    }
    step.querySelectorAll('input[data-slot]').forEach(inp => inp.addEventListener('change', () => {
      if (inp.value) p.slots[inp.dataset.slot].time = inp.value;
    }));
  }

  function next() {
    if (steps[at] === 'done') return finish();
    p.name = p.name.trim();
    commit({ sync: false });
    show(at + 1, 1);
  }

  function finish() {
    state.onboarded = true;
    commit();
    el.classList.add('leave');
    setTimeout(() => el.remove(), 600);
    $tabbar.classList.remove('hidden');
    setTab('home');
  }

  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.o === 'next') next();
    else if (b.dataset.o === 'back' && at > 0) show(at - 1, -1);
    else if (b.dataset.o === 'add') {
      medSheet(null, { onSaved: () => setTimeout(() => {
        stage.querySelector('.ob-step').remove();
        show(at, 0);
      }, 350) });
    } else if (b.dataset.nag != null) {
      p.nag = Number(b.dataset.nag);
      el.querySelectorAll('[data-nag]').forEach(o => o.classList.toggle('on', o === b));
    } else if (b.dataset.size) {
      p.textSize = b.dataset.size;
      applyAppearance();
      el.querySelectorAll('[data-size]').forEach(o => o.classList.toggle('on', o === b));
    } else if (b.dataset.n) {
      await notifAction(b.dataset.n, b);
      const nb = el.querySelector('#ob-nb');
      if (nb) nb.innerHTML = notifBody();
      const main = el.querySelector('.ob-step:last-child .btn[data-o="next"]');
      if (main && state.device.push) main.textContent = 'המשך';
    }
  });

  show(0);
}

// ---------- Start ----------

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'open-dose') openDose(e.data.date, e.data.t);
    else if (e.data?.type === 'refresh' && state.onboarded) render();
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  tick(true);
  queueSync(300);
});
setInterval(tick, 10000);

applyAppearance();
buildTabbar();
Push.writeSnapshot(state);
if (state.onboarded) {
  $tabbar.classList.remove('hidden');
  const fromHash = location.hash.slice(1);
  setTab(SCREENS[fromHash] ? fromHash : 'home');
  queueSync(1500);
} else {
  onboarding();
}
lastMinute = `${S.dateKey()} ${S.nowMinutes()}`;
