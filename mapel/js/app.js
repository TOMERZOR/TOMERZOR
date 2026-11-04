// מפל for you: where every soldier of the company is, on every day of the next weeks.

import * as S from './store.js';
import { icon, KIND_ICON } from './icons.js';
import { openSheet, refreshLive, confirmDialog, toast, bind, h, tick, closeAll } from './ui.js';
import { autoAssign, clearAutoInPeriod } from './schedule.js';
import { workbook, fileName } from './export.js';
import { demoState } from './demo.js';

const APP_VERSION = '1.0.1';
const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

const TABS = [
  { id: 'now', label: 'עכשיו', icon: 'now' },
  { id: 'board', label: 'לוח', icon: 'board' },
  { id: 'sites', label: 'אתרים', icon: 'sites' },
  { id: 'soldiers', label: 'חיילים', icon: 'people' },
];

const ui = {
  tab: TABS.some(t => t.id === location.hash.slice(1)) ? location.hash.slice(1) : 'now',
  at: null,             // null = live; otherwise { date, time }
  platoon: '',          // board filter
  select: false,        // board selection mode
  sel: new Set(),       // "sid|date"
  q: '',                // soldier search
  scroll: {},           // board scroller position
};

const st = () => S.get();
const ALL_PLATOONS = '';

/* ---------- Small pieces ---------- */

const AV_COLORS = ['#007aff', '#34c759', '#5856d6', '#ff2d55', '#ff9500', '#00c7be', '#af52de', '#a2845e'];
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');
function avatar(so, cls = '') {
  let n = 0;
  for (const c of so.id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar ${cls}" style="--c:${AV_COLORS[n % AV_COLORS.length]}" aria-hidden="true">${h(initials(so.name) || '?')}</span>`;
}

function pill(lk, extra = '') {
  if (!lk.label) return '<span class="pill empty">—</span>';
  return `<span class="pill${lk.idle ? ' idle' : ''}" style="--c:${lk.color}">${h(lk.label)}${extra}</span>`;
}

const ltr = t => `<span dir="ltr" class="ltr">${h(t)}</span>`;

function header(title, sub, actions = '') {
  return `<header class="top">
    <div class="top-row">
      <div class="top-titles"><h1>${h(title)}</h1>${sub ? `<p class="top-sub">${sub}</p>` : ''}</div>
      <div class="top-actions">${actions}<button class="icon-btn" data-act="settings" aria-label="הגדרות">${icon('gear')}</button></div>
    </div>
  </header>`;
}

function stepper(name, value, min, max, label) {
  return `<div class="stepper" role="group" aria-label="${h(label)}">
    <button type="button" data-act="step" data-name="${name}" data-d="-1" aria-label="פחות" ${value <= min ? 'disabled' : ''}>${icon('minus')}</button>
    <output>${h(value)}</output>
    <button type="button" data-act="step" data-name="${name}" data-d="1" aria-label="יותר" ${value >= max ? 'disabled' : ''}>${icon('plus')}</button>
  </div>`;
}

const periodText = () => {
  const ds = S.periodDates(st());
  return S.fmtRange(ds[0], ds[ds.length - 1]);
};

/* ---------- Where everyone is ---------- */

const GROUPS = [
  { key: 'gimel', label: 'גימלים', color: S.KINDS.gimel.color },
  { key: 'referral', label: 'בהפניה', color: S.KINDS.referral.color },
  { key: 'leave', label: 'חופשה', color: S.KINDS.leave.color },
  { key: 'course', label: 'קורס', color: S.KINDS.course.color },
  { key: 'other', label: 'אחר', color: S.KINDS.other.color },
  { key: 'home', label: 'בבית', color: S.KINDS.home.color },
];

// time null = the whole day
function whereAll(date, time) {
  const s = st(), idx = S.index(s);
  const bySite = new Map(s.sites.map(x => [x.id, []]));
  const by = Object.fromEntries(GROUPS.map(g => [g.key, []]));
  for (const so of S.sortedSoldiers(s)) {
    const x = S.dayOf(idx, so.id, date);
    let ref = null;
    if (time) ref = x.refs.find(r => S.activeAt(r, date, time));
    const mainOn = x.main && (!time || S.activeAt(x.main, date, time)) ? x.main : null;
    const item = { so, x, ev: mainOn, ref };
    if (ref) by.referral.push(item);
    else if (mainOn?.kind === 'site' && bySite.has(mainOn.siteId)) bySite.get(mainOn.siteId).push(item);
    else if (mainOn && by[mainOn.kind]) by[mainOn.kind].push(item);
    else by.home.push(item);
    if (!time && x.refs.length && !ref) item.dayRefs = x.refs;
  }
  return { bySite, by };
}

function personRow(item, date, extra = '') {
  const { so, x, ev, ref } = item;
  const bits = [];
  if (so.platoon) bits.push(h(so.platoon));
  if (ref) bits.push(`${ltr(S.timeText(ref, date) || 'היום')}${ref.note ? ' · ' + h(ref.note) : ''}`);
  else if (ev) {
    const t = S.timeText(ev, date);
    if (t) bits.push(ltr(t));
    if (ev.note && ev.kind !== 'other') bits.push(h(ev.note));
    if (ev.kind === 'other') bits.push(h(ev.note || 'אחר'));
  }
  const refsToday = x.refs.filter(r => r !== ref);
  if (refsToday.length) bits.push(`<span class="tag" style="--c:${S.KINDS.referral.color}">הפניה ${ltr(refsToday[0].start || '')}</span>`);
  if (x.cons.length) bits.push(`<span class="tag" style="--c:${S.KINDS.constraint.color}">אילוץ</span>`);
  return `<button class="row" data-act="cell" data-sid="${so.id}" data-date="${date}">
    ${avatar(so)}
    <span class="row-main"><span class="row-title">${h(so.name)}</span><span class="row-sub">${bits.join(' · ') || h(so.role || '')}</span></span>
    ${extra}${icon('chevron', 'row-chev')}
  </button>`;
}

function groupsHtml(date, time) {
  const s = st();
  const { bySite, by } = whereAll(date, time);
  const tiles = [];
  const sections = [];
  let i = 0;
  for (const site of s.sites) {
    const list = bySite.get(site.id);
    const need = S.needOn(site, date);
    const short = list.length < need;
    tiles.push(`<button class="tile" data-act="jump" data-to="g-${site.id}" style="--c:${site.color};--i:${i++}">
      <span class="tile-name">${h(site.name)}</span>
      <span class="tile-num">${list.length}${need ? `<small>/${need}</small>` : ''}</span>
      ${need ? `<span class="bar"><span style="width:${Math.min(100, (list.length / need) * 100)}%"></span></span>` : ''}
      ${short ? `<span class="tile-warn">חסרים ${need - list.length}</span>` : ''}
    </button>`);
    sections.push(section(`g-${site.id}`, site.name, site.color, list, date, need ? `${list.length}/${need}` : list.length));
  }
  for (const g of GROUPS) {
    const list = by[g.key];
    if (!list.length && g.key !== 'home') continue;
    tiles.push(`<button class="tile soft" data-act="jump" data-to="g-${g.key}" style="--c:${g.color};--i:${i++}">
      <span class="tile-name">${h(g.key === 'home' && s.unassigned !== 'home' ? 'לא שובצו' : g.label)}</span>
      <span class="tile-num">${list.length}</span>
    </button>`);
    sections.push(section(`g-${g.key}`, g.key === 'home' && s.unassigned !== 'home' ? 'לא שובצו' : g.label, g.color, list, date, list.length));
  }
  return `<div class="tiles">${tiles.join('')}</div>${sections.join('')}`;
}

function section(id, title, color, list, date, count) {
  return `<section class="group" id="${id}">
    <h2 class="group-title"><span class="dot" style="--c:${color}"></span>${h(title)}<span class="count">${count}</span></h2>
    <div class="card list">${list.length ? list.map(it => personRow(it, date)).join('') : '<p class="list-empty">אין אף אחד</p>'}</div>
  </section>`;
}

/* ---------- View: now ---------- */

function renderNow() {
  const s = st();
  const live = !ui.at;
  const date = live ? S.today() : ui.at.date;
  const time = live ? S.nowTime() : ui.at.time;
  const probs = S.problems(s).filter(p => p.date >= S.today());
  const title = live ? 'עכשיו' : 'מבט לרגע';
  let html = header(title, h(s.unit || ''));
  html += `<div class="when">
    <button class="when-btn" data-act="pickTime">${icon('clock')}<span>${h(S.fmtLong(date))} · ${ltr(time)}</span>${icon('chevronDown', 'sm')}</button>
    ${live ? '<span class="live-dot" aria-label="מתעדכן"></span>' : '<button class="link-btn" data-act="liveNow">חזרה לעכשיו</button>'}
  </div>`;

  if (!s.soldiers.length || !s.sites.length) {
    html += `<div class="card steps">
      <h2>מתחילים בארבעה צעדים</h2>
      <ol>
        <li class="${s.sites.length ? 'done' : ''}"><button data-act="addSite">${icon(s.sites.length ? 'check' : 'sites')}<span><b>מוסיפים אתרים לסגירה</b><small>מוצבים, ש.ג, חמ״ל, וכמה חיילים כל אחד צריך</small></span></button></li>
        <li class="${s.soldiers.length ? 'done' : ''}"><button data-act="addSoldier">${icon(s.soldiers.length ? 'check' : 'people')}<span><b>מוסיפים את החיילים</b><small>אחד אחד, או רשימה שלמה בהדבקה</small></span></button></li>
        <li><button data-act="go" data-tab="board">${icon('board')}<span><b>ממלאים אילוצים</b><small>גימלים, הפניות, חופשות, ומי לא יכול מתי</small></span></button></li>
        <li><button data-act="go" data-tab="sites">${icon('wand')}<span><b>משבצים ומייצאים לאקסל</b><small>הלוח מתמלא לבד, ומה שמילאת ביד נשאר</small></span></button></li>
      </ol>
      <button class="link-btn" data-act="loadDemo">או נסו עם פלגה לדוגמה</button>
    </div>`;
  }

  if (probs.length) {
    const items = probs.slice(0, 4).map(p => p.type === 'short'
      ? `<button class="row" data-act="siteDay" data-site="${p.site.id}" data-date="${p.date}">
          <span class="row-ic" style="--c:#ff3b30">${icon('alert')}</span>
          <span class="row-main"><span class="row-title">${h(p.site.name)} · ${h(S.fmtDay(p.date))}</span><span class="row-sub">חסרים ${p.need - p.have} מתוך ${p.need}</span></span>${icon('chevron', 'row-chev')}
        </button>`
      : `<button class="row" data-act="cell" data-sid="${p.soldier.id}" data-date="${p.date}">
          <span class="row-ic" style="--c:${S.KINDS.constraint.color}">${icon('alert')}</span>
          <span class="row-main"><span class="row-title">${h(p.soldier.name)} · ${h(S.fmtDay(p.date))}</span><span class="row-sub">משובץ למרות אילוץ${p.con.note ? ': ' + h(p.con.note) : ''}</span></span>${icon('chevron', 'row-chev')}
        </button>`).join('');
    html += `<section class="group">
      <h2 class="group-title"><span class="dot" style="--c:#ff3b30"></span>לטפל בזה<span class="count">${probs.length}</span></h2>
      <div class="card list">${items}${probs.length > 4 ? `<button class="row more" data-act="go" data-tab="sites"><span class="row-main"><span class="row-title accent">עוד ${probs.length - 4} בלוח האתרים</span></span>${icon('chevron', 'row-chev')}</button>` : ''}</div>
    </section>`;
  }
  if (s.soldiers.length) html += groupsHtml(date, time);
  return html;
}

function pickTimeSheet() {
  const s = st();
  const f = ui.at ? { ...ui.at } : { date: S.today(), time: S.nowTime() };
  const ds = S.dates(S.today(), Math.max(14, s.days));
  openSheet({
    title: 'איפה כולם ב…',
    done: { label: 'הצגה', act: 'show' },
    render: () => `
      <div class="day-chips" role="listbox" aria-label="יום">${ds.map(d => `<button class="day-chip${d === f.date ? ' on' : ''}${S.isWeekend(d) ? ' wknd' : ''}" data-act="day" data-date="${d}" role="option" aria-selected="${d === f.date}"><small>${S.WEEKDAYS[S.wd(d)]}</small><b>${S.parse(d).getDate()}</b></button>`).join('')}</div>
      <div class="card form">
        <label class="field"><span>תאריך</span><input type="date" data-field="date" value="${f.date}"></label>
        <label class="field"><span>שעה</span><input type="time" data-field="time" value="${f.time}"></label>
      </div>
      <div class="quick">${['06:00', '08:00', '12:00', '18:00', '22:00'].map(t => `<button class="chip${t === f.time ? ' on' : ''}" data-act="t" data-t="${t}">${ltr(t)}</button>`).join('')}</div>`,
    on: {
      day: (el, ev, sh) => { f.date = el.dataset.date; sh.update(); },
      t: (el, ev, sh) => { f.time = el.dataset.t; sh.update(); },
      show: (el, ev, sh) => {
        ui.at = (f.date === S.today() && f.time === S.nowTime()) ? null : { ...f };
        sh.close();
        render(true);
      },
    },
    field: (el) => { if (el.value) f[el.dataset.field] = el.value; },
  });
}

/* ---------- View: board ---------- */

function platoons() {
  return [...new Set(st().soldiers.map(s => s.platoon || ''))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'he', { numeric: true }));
}

function boardSoldiers() {
  const list = S.sortedSoldiers(st());
  return ui.platoon ? list.filter(s => (s.platoon || '') === ui.platoon) : list;
}

function renderBoard() {
  const s = st();
  const idx = S.index(s);
  const ds = S.periodDates(s);
  const t = S.today();
  const sold = boardSoldiers();
  const acts = `
    <button class="icon-btn${ui.select ? ' on' : ''}" data-act="toggleSelect" aria-pressed="${ui.select}" aria-label="בחירת כמה תאים">${icon('select')}</button>
    <button class="pill-btn" data-act="export">${icon('table')}<span>אקסל</span></button>`;
  let html = header('לוח', `${periodText()} · ${s.soldiers.length} חיילים`, acts);

  html += `<div class="toolbar">
    <div class="seg-nav">
      <button data-act="shift" data-d="-7" aria-label="שבוע קודם">${icon('chevronR')}</button>
      <button data-act="shift" data-d="0" class="${s.start === t ? 'on' : ''}">היום</button>
      <button data-act="shift" data-d="7" aria-label="שבוע הבא">${icon('chevron')}</button>
    </div>
    ${segmented('days', [[7, 'שבוע'], [14, 'שבועיים'], [28, 'חודש']], s.days)}
  </div>`;

  const pls = platoons();
  if (pls.length > 1) {
    html += `<div class="chips-scroll">${[['', 'כולם'], ...pls.map(p => [p, p])].map(([v, l]) =>
      `<button class="chip${ui.platoon === v ? ' on' : ''}" data-act="platoon" data-v="${h(v)}">${h(l)}</button>`).join('')}</div>`;
  }

  if (!s.soldiers.length) {
    html += empty('board', 'הלוח ריק', 'מוסיפים חיילים, והלוח מראה איפה כל אחד בכל יום.', '<button class="btn primary" data-act="addSoldier">הוספת חיילים</button>');
    return html;
  }

  if (ui.select) {
    html += `<p class="hint">${icon('select', 'sm')} מסמנים תאים, שורה (בלחיצה על שם) או עמודה (בלחיצה על יום), ואז בוחרים מה לשים בהם.</p>`;
  }

  const head = `<tr><th class="corner" scope="col">חייל</th>${ds.map(d =>
    `<th scope="col" class="day${d === t ? ' is-today' : ''}${S.isWeekend(d) ? ' wknd' : ''}"><button data-act="dayHead" data-date="${d}"><small>${S.WEEKDAYS[S.wd(d)]}</small><b>${S.fmtShort(d)}</b></button></th>`).join('')}</tr>`;

  let body = '', group = null;
  for (const so of sold) {
    const g = so.platoon || 'ללא מחלקה';
    if (g !== group) {
      group = g;
      body += `<tr class="grp"><td colspan="${ds.length + 1}"><span>${h(g)}</span></td></tr>`;
    }
    body += `<tr><th scope="row" class="who"><button data-act="who" data-sid="${so.id}">${avatar(so, 'xs')}<span>${h(so.name)}</span></button></th>`;
    for (const d of ds) {
      const x = S.dayOf(idx, so.id, d);
      const lk = S.look(s, x.main);
      const tt = x.main ? S.timeText(x.main, d) : '';
      const key = so.id + '|' + d;
      const sel = ui.sel.has(key);
      const label = [lk.label || 'ריק', tt, x.refs.length ? 'הפניה' : '', x.cons.length ? 'אילוץ' : ''].filter(Boolean).join(', ');
      body += `<td class="${d === t ? 'is-today' : ''}${S.isWeekend(d) ? ' wknd' : ''}"><button class="cell${lk.idle ? ' idle' : ''}${sel ? ' sel' : ''}${x.main?.auto ? ' auto' : ''}" data-act="cell" data-sid="${so.id}" data-date="${d}" style="--c:${lk.color || 'transparent'}" aria-label="${h(so.name)}, ${h(S.fmtDay(d))}: ${h(label)}"${ui.select ? ` aria-pressed="${sel}"` : ''}>
        <span class="cell-label">${h(lk.label)}</span>
        ${tt ? `<span class="cell-time" dir="ltr">${h(tt)}</span>` : ''}
        ${x.refs.length ? `<span class="cell-ref" dir="ltr">${icon('pin', 'xs')}${h(x.refs[0].start || '')}</span>` : ''}
        ${x.cons.length ? '<span class="cell-con" aria-hidden="true">!</span>' : ''}
        ${sel ? `<span class="cell-check">${icon('check')}</span>` : ''}
      </button></td>`;
    }
    body += '</tr>';
  }

  const rosters = ds.map(d => S.siteRoster(s, idx, d));
  const foot = `<tr class="foot"><th scope="row" class="who"><span class="foot-label">סוגרים</span></th>${ds.map((d, i) => {
    let have = 0, need = 0;
    for (const site of s.sites) { have += rosters[i].get(site.id).length; need += S.needOn(site, d); }
    const cls = need ? (have >= need ? 'ok' : 'short') : '';
    return `<td class="${d === t ? 'is-today' : ''}${S.isWeekend(d) ? ' wknd' : ''}"><span class="foot-num ${cls}">${have}${need ? `<small>/${need}</small>` : ''}</span></td>`;
  }).join('')}</tr>`;

  html += `<div class="card grid-card"><div class="grid-scroll" id="grid"><table class="grid"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div></div>`;
  html += legend();
  return html;
}

function legend() {
  const s = st();
  const items = [
    ...s.sites.map(x => [x.name, x.color]),
    ...['home', 'gimel', 'referral', 'leave', 'course', 'constraint'].map(k => [S.KINDS[k].label, S.KINDS[k].color]),
  ];
  return `<div class="legend">${items.map(([l, c]) => `<span><i style="--c:${c}"></i>${h(l)}</span>`).join('')}<span><i class="auto-i"></i>שובץ אוטומטית</span></div>`;
}

function segmented(name, options, value) {
  const i = Math.max(0, options.findIndex(([v]) => String(v) === String(value)));
  return `<div class="seg" role="radiogroup" style="--n:${options.length};--i:${i}">
    <span class="seg-pill" aria-hidden="true"></span>
    ${options.map(([v, l]) => `<button role="radio" aria-checked="${String(v) === String(value)}" data-act="seg" data-name="${name}" data-v="${v}">${h(l)}</button>`).join('')}
  </div>`;
}

function empty(ic, title, text, actions = '') {
  return `<div class="empty">
    <div class="empty-ic">${icon(ic)}</div>
    <h2>${h(title)}</h2><p>${h(text)}</p>
    <div class="empty-acts">${actions}</div>
  </div>`;
}

/* ---------- View: sites ---------- */

function renderSites() {
  const s = st();
  const idx = S.index(s);
  const ds = S.periodDates(s);
  const t = S.today();
  let html = header('אתרים', `מי סוגר איפה · ${periodText()}`, `<button class="icon-btn" data-act="addSite" aria-label="אתר חדש">${icon('plus')}</button>`);

  if (!s.sites.length) {
    html += empty('sites', 'אין עדיין אתרים', 'אתר הוא מקום שסוגרים בו: מוצב, ש.ג, חמ״ל, מטבח. לכל אתר קובעים כמה חיילים הוא צריך ביום.',
      '<button class="btn primary" data-act="addSite">הוספת אתר</button>');
    return html;
  }

  const probs = S.problems(s).filter(p => p.type === 'short');
  const totalShort = probs.reduce((n, p) => n + p.need - p.have, 0);
  html += `<button class="auto-card" data-act="auto">
    <span class="auto-ic">${icon('wand')}</span>
    <span class="auto-text"><b>שיבוץ אוטומטי</b><small>${totalShort ? `חסרים ${totalShort} שיבוצים בתקופה. ממלאים לפי זמינות, אילוצים ואיזון.` : 'כל האתרים מאוישים בתקופה הזו.'}</small></span>
    ${icon('chevron', 'row-chev')}
  </button>`;

  const rosters = ds.map(d => S.siteRoster(s, idx, d));
  const head = `<tr><th class="corner">אתר</th>${ds.map(d => `<th class="day${d === t ? ' is-today' : ''}${S.isWeekend(d) ? ' wknd' : ''}"><span><small>${S.WEEKDAYS[S.wd(d)]}</small><b>${S.fmtShort(d)}</b></span></th>`).join('')}</tr>`;
  const body = s.sites.map(site => `<tr><th scope="row" class="who"><button data-act="editSite" data-id="${site.id}"><span class="dot" style="--c:${site.color}"></span><span>${h(site.name)}</span></button></th>${ds.map((d, i) => {
    const have = rosters[i].get(site.id).length, need = S.needOn(site, d);
    const cls = !need ? (have ? 'ok' : 'none') : have >= need ? 'ok' : have === 0 ? 'zero' : 'short';
    return `<td class="${d === t ? 'is-today' : ''}${S.isWeekend(d) ? ' wknd' : ''}"><button class="cov ${cls}" data-act="siteDay" data-site="${site.id}" data-date="${d}" style="--c:${site.color}" aria-label="${h(site.name)}, ${h(S.fmtDay(d))}: ${have} מתוך ${need}">${have}${need ? `<small>/${need}</small>` : ''}</button></td>`;
  }).join('')}</tr>`).join('');
  html += `<div class="card grid-card"><div class="grid-scroll"><table class="grid cov-grid"><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;

  html += `<h2 class="group-title plain">האתרים</h2><div class="card list">${s.sites.map((site, i) => `
    <button class="row" data-act="editSite" data-id="${site.id}" style="--i:${i}">
      <span class="row-ic" style="--c:${site.color}">${icon('sites')}</span>
      <span class="row-main"><span class="row-title">${h(site.name)}</span><span class="row-sub">${siteNeedText(site)}</span></span>${icon('chevron', 'row-chev')}
    </button>`).join('')}
    <button class="row add" data-act="addSite"><span class="row-ic plain">${icon('plus')}</span><span class="row-main"><span class="row-title accent">הוספת אתר</span></span></button>
  </div>`;
  return html;
}

function siteNeedText(site) {
  const parts = [`${+site.need || 0} ביום`];
  if (site.weekendNeed !== '' && site.weekendNeed != null && +site.weekendNeed !== +site.need) parts.push(`${+site.weekendNeed} בסופ״ש`);
  if (site.start || site.end) parts.push(ltr(`${site.start || '…'}–${site.end || '…'}`));
  return parts.join(' · ');
}

/* ---------- View: soldiers ---------- */

function renderSoldiers() {
  const s = st();
  const idx = S.index(s);
  const t = S.today();
  const pls = platoons();
  let html = header('חיילים', `${s.soldiers.length} חיילים${pls.length ? ` · ${pls.length} מחלקות` : ''}`, `<button class="icon-btn" data-act="addSoldier" aria-label="הוספת חיילים">${icon('plus')}</button>`);
  if (!s.soldiers.length) {
    html += empty('people', 'אין עדיין חיילים', 'מוסיפים חייל אחד, או מדביקים רשימה שלמה של שמות.',
      '<button class="btn primary" data-act="addSoldier">הוספת חיילים</button>');
    return html;
  }
  html += `<label class="search">${icon('search')}<input type="search" placeholder="חיפוש לפי שם, מ.א., תפקיד" value="${h(ui.q)}" data-search aria-label="חיפוש"></label>`;
  html += `<div id="soldier-list">${soldierList(idx, t)}</div>`;
  return html;
}

function soldierList(idx, t) {
  const s = st();
  const q = ui.q.trim();
  const list = S.sortedSoldiers(s).filter(so => !q || [so.name, so.pn, so.role, so.platoon].some(v => (v || '').includes(q)));
  if (!list.length) return `<p class="list-empty big">אין תוצאות ל״${h(q)}״</p>`;
  let html = '', group = null, open = false, i = 0;
  for (const so of list) {
    const g = so.platoon || 'ללא מחלקה';
    if (g !== group) {
      if (open) html += '</div>';
      group = g;
      html += `<h2 class="group-title plain">${h(g)}<span class="count">${list.filter(x => (x.platoon || 'ללא מחלקה') === g).length}</span></h2><div class="card list">`;
      open = true;
    }
    const x = S.dayOf(idx, so.id, t);
    const lk = S.look(s, x.main);
    html += `<button class="row" data-act="who" data-sid="${so.id}" style="--i:${Math.min(i++, 14)}">
      ${avatar(so)}
      <span class="row-main"><span class="row-title">${h(so.name)}</span><span class="row-sub">${[so.role, so.pn].filter(Boolean).map(h).join(' · ')}</span></span>
      ${pill(lk)}${icon('chevron', 'row-chev')}
    </button>`;
  }
  return html + (open ? '</div>' : '');
}

/* ---------- Sheets: a soldier's day ---------- */

function cellSheet(sid, date) {
  openSheet({
    live: true,
    title: S.soldierById(st(), sid)?.name || '',
    sub: S.fmtLong(date),
    render: () => {
      const s = st();
      const so = S.soldierById(s, sid);
      if (!so) return '<p class="list-empty">החייל נמחק</p>';
      const x = S.dayOf(S.index(s), sid, date);
      const lk = S.look(s, x.main);
      const evs = [x.main, ...x.refs, ...x.cons].filter(Boolean);
      const quick = [
        ...s.sites.map(site => ({ act: 'quickSite', id: site.id, label: site.name, color: site.color, ic: 'sites', on: x.main?.kind === 'site' && x.main.siteId === site.id })),
        { act: 'quick', kind: 'home', label: 'בבית', color: S.KINDS.home.color, ic: 'house', on: x.main?.kind === 'home' },
        ...['gimel', 'referral', 'leave', 'course', 'constraint', 'other'].map(k => ({ act: 'quick', kind: k, label: S.KINDS[k].label, color: S.KINDS[k].color, ic: KIND_ICON[k] })),
      ];
      return `
        <div class="status-hero" style="--c:${lk.color || 'var(--label-3)'}">
          <span class="status-ic">${icon(x.main ? KIND_ICON[x.main.kind] : 'house')}</span>
          <div><b>${h(lk.label || 'לא שובץ')}</b><small>${x.main ? h(eventSpan(x.main)) : 'אין שום דבר ביום הזה'}${x.main?.auto ? ' · שובץ אוטומטית' : ''}</small></div>
        </div>
        ${evs.length ? `<div class="card list">${evs.map(e => eventRow(e)).join('')}</div>` : ''}
        <h3 class="sub-title">מה יש לו ביום הזה</h3>
        <div class="kind-grid">${quick.map((q, i) => `<button class="kind-btn${q.on ? ' on' : ''}" data-act="${q.act}" data-kind="${q.kind || ''}" data-id="${q.id || ''}" style="--c:${q.color};--i:${i}">${icon(q.ic)}<span>${h(q.label)}</span></button>`).join('')}</div>
        <div class="sheet-actions">
          <button class="btn" data-act="more">${icon('calendar')}<span>לכמה ימים, או עם שעות</span></button>
          ${x.main ? `<button class="btn danger-soft" data-act="clear">${icon('trash')}<span>ניקוי היום</span></button>` : ''}
          <button class="btn plain" data-act="person">${icon('person')}<span>כל הימים של ${h(so.name.split(' ')[0])}</span></button>
        </div>`;
    },
    on: {
      quickSite: (el, ev, sh) => {
        const site = S.siteById(st(), el.dataset.id);
        S.commit(s => S.addEvent(s, { soldierId: sid, kind: 'site', siteId: el.dataset.id, from: date, to: date }), { undoable: true });
        tick();
        sh.close();
        toast(`${S.soldierById(st(), sid)?.name.split(' ')[0]} ב${site.name} · ${S.fmtDay(date)}`, undoAction());
      },
      quick: (el, ev, sh) => {
        const kind = el.dataset.kind;
        if (kind === 'home') {
          S.commit(s => S.addEvent(s, { soldierId: sid, kind: 'home', from: date, to: date }), { undoable: true });
          tick();
          sh.close();
          toast(`בבית · ${S.fmtDay(date)}`, undoAction());
          return;
        }
        eventEditor({ draft: { soldierId: sid, kind, from: date, to: date }, closeAlso: sh });
      },
      more: (el, ev, sh) => {
        const x = S.dayOf(S.index(st()), sid, date);
        eventEditor({ draft: { soldierId: sid, kind: x.main?.kind || (st().sites[0] ? 'site' : 'home'), siteId: x.main?.siteId || st().sites[0]?.id, from: date, to: date }, closeAlso: sh });
      },
      edit: (el, ev, sh) => eventEditor({ id: el.dataset.id, closeAlso: sh }),
      clear: (el, ev, sh) => {
        S.commit(s => S.clearCells(s, [{ sid, date }]), { undoable: true });
        sh.close();
        toast('היום נוקה', undoAction());
      },
      person: () => soldierSheet(sid),
    },
  });
}

function eventSpan(e) {
  const parts = [];
  if (e.to === '' || e.to == null) parts.push(`מ־${S.fmtShort(e.from)}, בלי סוף`);
  else if (e.from === e.to) parts.push(S.fmtDay(e.from));
  else parts.push(`${S.fmtRange(e.from, e.to)} · ${S.daysWord(S.eventDays(e))}`);
  if (e.weekdays?.length) parts.push(`כל ${e.weekdays.map(w => S.WEEKDAYS[w]).join(', ')}`);
  if (e.start || e.end) parts.push(S.iso2(`${e.start || '…'}–${e.end || '…'}`));
  return parts.join(' · ');
}

function eventRow(e, i = 0) {
  const s = st();
  const color = e.kind === 'site' ? S.siteById(s, e.siteId)?.color : S.KINDS[e.kind].color;
  const title = e.kind === 'site' ? `סגירה · ${S.kindLabel(s, e)}` : e.kind === 'other' ? (e.note || 'אחר') : S.KINDS[e.kind].label;
  const note = e.kind !== 'other' && e.note ? ` · ${h(e.note)}` : '';
  return `<button class="row" data-act="edit" data-id="${e.id}" style="--i:${i}">
    <span class="row-ic" style="--c:${color}">${icon(KIND_ICON[e.kind])}</span>
    <span class="row-main"><span class="row-title">${h(title)}${e.auto ? ' <span class="badge">אוטומטי</span>' : ''}</span><span class="row-sub">${h(eventSpan(e))}${note}</span></span>
    ${icon('pencil', 'row-chev')}
  </button>`;
}

const undoAction = () => ({ action: { label: 'ביטול', fn: () => { if (S.undo()) toast('בוטל'); } } });

/* ---------- Sheet: event editor ---------- */

// { id } edits an existing event; { draft } creates one; { cells } puts it on many cells at once.
function eventEditor({ id, draft, cells, closeAlso }) {
  const s0 = st();
  const existing = id ? s0.events.find(e => e.id === id) : null;
  const base = existing || draft || { kind: s0.sites.length ? 'site' : 'home' };
  const f = {
    kind: base.kind, siteId: base.siteId || s0.sites[0]?.id || '', from: base.from || S.today(), to: base.to ?? base.from ?? S.today(),
    start: base.start || '', end: base.end || '', note: base.note || '', weekdays: [...(base.weekdays || [])],
    ongoing: base.kind === 'constraint' && !base.to && !!existing,
  };
  const multi = !!cells;
  const who = multi ? `${cells.length} תאים` : S.soldierById(s0, base.soldierId)?.name || '';

  const NOTE = {
    site: ['הערה', 'למשל: משמרת לילה'], home: ['הערה', ''], gimel: ['סיבה', 'לא חובה'],
    referral: ['לאן ולמה', 'למשל: אורתופד, תל השומר'], leave: ['סוג החופשה', 'למשל: חופשה מיוחדת'],
    course: ['איזה קורס', 'למשל: קורס מ״כים'], constraint: ['מה האילוץ', 'למשל: מבחן באוניברסיטה'], other: ['מה', 'למשל: יום סיור'],
  };

  const sheet = openSheet({
    title: existing ? 'עריכה' : multi ? 'סימון תאים' : 'הוספה',
    sub: who,
    done: { label: 'שמירה', act: 'save' },
    render: () => {
      const s = st();
      const days = f.to ? S.diffDays(f.from, f.to) + 1 : null;
      const kinds = S.KIND_ORDER.filter(k => k !== 'site' || s.sites.length);
      return `
        <div class="kind-grid compact">${kinds.map(k => `<button class="kind-btn${f.kind === k ? ' on' : ''}" data-act="kind" data-kind="${k}" style="--c:${k === 'site' ? (S.siteById(s, f.siteId)?.color || s.sites[0]?.color) : S.KINDS[k].color}" aria-pressed="${f.kind === k}">${icon(KIND_ICON[k])}<span>${h(S.KINDS[k].label)}</span></button>`).join('')}</div>
        ${f.kind === 'site' ? `<h3 class="sub-title">איפה סוגר</h3><div class="chips-wrap">${s.sites.map(site => `<button class="chip color${f.siteId === site.id ? ' on' : ''}" data-act="site" data-id="${site.id}" style="--c:${site.color}">${h(site.name)}</button>`).join('')}</div>` : ''}
        ${multi ? '' : `
        <h3 class="sub-title">מתי</h3>
        <div class="card form">
          <label class="field"><span>מתאריך</span><input type="date" data-field="from" value="${f.from}"></label>
          ${f.ongoing ? '' : `<label class="field"><span>עד תאריך</span><input type="date" data-field="to" value="${f.to}" min="${f.from}"></label>
          <div class="field"><span>משך</span>${stepper('days', days, 1, 120, 'מספר ימים')}<span class="field-hint">${h(S.daysWord(days))}</span></div>`}
          ${f.kind === 'constraint' ? `<label class="field toggle"><span>בלי תאריך סיום</span><input type="checkbox" role="switch" data-field="ongoing" ${f.ongoing ? 'checked' : ''}><i></i></label>` : ''}
        </div>`}
        ${f.kind === 'constraint' ? `<h3 class="sub-title">רק בימים מסוימים בשבוע</h3><div class="wd-row">${S.WEEKDAYS.map((w, i) => `<button class="wd${f.weekdays.includes(i) ? ' on' : ''}" data-act="wd" data-i="${i}" aria-pressed="${f.weekdays.includes(i)}">${w}</button>`).join('')}</div><p class="field-note">בלי בחירה, האילוץ חל על כל הימים.</p>` : ''}
        <h3 class="sub-title">${f.kind === 'referral' ? 'שעת התור' : 'שעות'}<span class="opt"> · לא חובה</span></h3>
        <div class="card form">
          <label class="field"><span>${multi || f.from === f.to || f.ongoing ? 'משעה' : 'ביום הראשון, משעה'}</span><input type="time" data-field="start" value="${f.start}"></label>
          <label class="field"><span>${multi || f.from === f.to || f.ongoing ? 'עד שעה' : 'ביום האחרון, עד שעה'}</span><input type="time" data-field="end" value="${f.end}"></label>
        </div>
        <h3 class="sub-title">${NOTE[f.kind][0]}</h3>
        <div class="card form"><label class="field full"><input type="text" data-field="note" value="${h(f.note)}" placeholder="${h(NOTE[f.kind][1])}" aria-label="${h(NOTE[f.kind][0])}" maxlength="80"></label></div>
        ${existing ? `<div class="sheet-actions"><button class="btn danger-soft" data-act="del">${icon('trash')}<span>מחיקה</span></button></div>` : ''}`;
    },
    on: {
      kind: (el, ev, sh) => { f.kind = el.dataset.kind; if (f.kind !== 'constraint') { f.ongoing = false; f.weekdays = []; } sh.update(); },
      site: (el, ev, sh) => { f.siteId = el.dataset.id; sh.update(); },
      wd: (el, ev, sh) => { const i = +el.dataset.i; f.weekdays = f.weekdays.includes(i) ? f.weekdays.filter(x => x !== i) : [...f.weekdays, i].sort(); sh.update(); },
      step: (el, ev, sh) => {
        const days = Math.max(1, S.diffDays(f.from, f.to) + 1 + +el.dataset.d);
        f.to = S.addDays(f.from, days - 1);
        sh.update();
      },
      save: (el, ev, sh) => {
        if (f.kind === 'site' && !f.siteId) return toast('בוחרים אתר');
        if (!multi && !f.ongoing && f.to < f.from) return toast('תאריך הסיום לפני תאריך ההתחלה');
        if (f.start && f.end && f.from === f.to && f.end <= f.start) return toast('שעת הסיום לפני שעת ההתחלה');
        const payload = { kind: f.kind, siteId: f.kind === 'site' ? f.siteId : undefined, start: f.start, end: f.end, note: f.note.trim() };
        if (f.kind === 'constraint') payload.weekdays = f.weekdays;
        if (multi) {
          S.commit(s => S.applyCells(s, cells, payload), { undoable: true });
          ui.sel.clear();
          ui.select = false;
          closeAll();
          toast(`סומנו ${cells.length} תאים`, undoAction());
          render();
          return;
        }
        const full = { ...payload, from: f.from, to: f.ongoing ? '' : f.to };
        S.commit(s => existing ? S.updateEvent(s, existing.id, full) : S.addEvent(s, { ...full, soldierId: base.soldierId }), { undoable: true });
        tick();
        sh.close();
        closeAlso?.close();
        toast(existing ? 'נשמר' : 'נוסף', undoAction());
      },
      del: async (el, ev, sh) => {
        S.commit(s => S.removeEvent(s, existing.id), { undoable: true });
        sh.close();
        closeAlso?.close();
        toast('נמחק', undoAction());
      },
    },
    field: (el, ev, sh) => {
      const k = el.dataset.field;
      if (k === 'ongoing') { f.ongoing = el.checked; if (!f.ongoing && !f.to) f.to = f.from; sh.update(); return; }
      if ((k === 'from' || k === 'to') && !el.value) return;
      if (k === 'from') {
        const len = f.to ? S.diffDays(f.from, f.to) : 0;
        f.from = el.value;
        f.to = S.addDays(f.from, Math.max(0, len));
        if (ev.type === 'change') sh.update();
        return;
      }
      if (k === 'to') { f.to = el.value < f.from ? f.from : el.value; if (ev.type === 'change') sh.update(); return; }
      f[k] = el.value;
    },
  });
  return sheet;
}

/* ---------- Sheet: soldier ---------- */

function soldierSheet(sid) {
  openSheet({
    live: true,
    wide: true,
    title: S.soldierById(st(), sid)?.name || '',
    render: sh => {
      const s = st();
      const so = S.soldierById(s, sid);
      if (!so) return '<p class="list-empty">החייל נמחק</p>';
      sh.el.querySelector('.sh-title h2').textContent = so.name;
      const idx = S.index(s);
      const ds = S.periodDates(s);
      const t = S.today();
      const tl = S.tally(s, idx, sid);
      const mine = s.events.filter(e => e.soldierId === sid && (!e.to || e.to >= S.addDays(t, -7))).sort((a, b) => a.from.localeCompare(b.from));
      const cons = mine.filter(e => e.kind === 'constraint');
      const other = mine.filter(e => e.kind !== 'constraint');
      return `
        <div class="person-head">
          ${avatar(so, 'lg')}
          <div><h3>${h(so.name)}</h3><p>${[so.platoon, so.role, so.pn && `מ.א. ${so.pn}`].filter(Boolean).map(h).join(' · ')}</p></div>
        </div>
        <div class="person-acts">
          <button class="act" data-act="add">${icon('plus')}<span>הוספה</span></button>
          ${so.phone ? `<a class="act" href="tel:${h(so.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}<span>שיחה</span></a>` : ''}
          <button class="act" data-act="editSoldier">${icon('pencil')}<span>פרטים</span></button>
        </div>
        <div class="strip" role="list">${ds.map(d => {
          const x = S.dayOf(idx, sid, d);
          const lk = S.look(s, x.main);
          return `<button class="strip-day${d === t ? ' is-today' : ''}${lk.idle ? ' idle' : ''}" role="listitem" data-act="day" data-date="${d}" style="--c:${lk.color || 'transparent'}" aria-label="${h(S.fmtDay(d))}: ${h(lk.label || 'ריק')}">
            <small>${S.WEEKDAYS[S.wd(d)]} ${S.fmtShort(d)}</small><b>${h(lk.label || '—')}</b>
            ${x.refs.length ? `<i class="strip-ref" style="--c:${S.KINDS.referral.color}"></i>` : ''}${x.cons.length ? `<i class="strip-con" style="--c:${S.KINDS.constraint.color}"></i>` : ''}
          </button>`;
        }).join('')}</div>
        <div class="tally">
          <span><b>${tl.site}</b>ימי סגירה</span><span><b>${tl.home + tl.none}</b>בבית</span><span><b>${tl.gimel}</b>גימלים</span><span><b>${tl.referral}</b>הפניות</span>
        </div>
        <h3 class="sub-title">אילוצים</h3>
        <div class="card list">${cons.map((e, i) => eventRow(e, i)).join('') || '<p class="list-empty">אין אילוצים</p>'}
          <button class="row add" data-act="addCon"><span class="row-ic plain">${icon('plus')}</span><span class="row-main"><span class="row-title accent">הוספת אילוץ</span></span></button></div>
        <h3 class="sub-title">שיבוצים, גימלים והפניות</h3>
        <div class="card list">${other.map((e, i) => eventRow(e, i)).join('') || '<p class="list-empty">אין עדיין כלום</p>'}
          <button class="row add" data-act="add"><span class="row-ic plain">${icon('plus')}</span><span class="row-main"><span class="row-title accent">הוספה</span></span></button></div>
        ${so.note ? `<h3 class="sub-title">הערות</h3><div class="card note">${h(so.note)}</div>` : ''}
        <div class="sheet-actions"><button class="btn danger-soft" data-act="delSoldier">${icon('trash')}<span>מחיקת החייל</span></button></div>`;
    },
    on: {
      add: () => eventEditor({ draft: { soldierId: sid, kind: st().sites.length ? 'site' : 'home', from: S.today(), to: S.today() } }),
      addCon: () => eventEditor({ draft: { soldierId: sid, kind: 'constraint', from: S.today(), to: S.today() } }),
      edit: el => eventEditor({ id: el.dataset.id }),
      day: el => cellSheet(sid, el.dataset.date),
      editSoldier: () => soldierForm(sid),
      delSoldier: async (el, ev, sh) => {
        const so = S.soldierById(st(), sid);
        if (!await confirmDialog({ title: `למחוק את ${so.name}?`, message: 'כל השיבוצים, הגימלים וההפניות שלו יימחקו.', ok: 'מחיקה', danger: true })) return;
        S.commit(s => S.removeSoldier(s, sid), { undoable: true });
        sh.close();
        toast(`${so.name} נמחק`, undoAction());
      },
    },
  });
}

/* ---------- Sheet: add / edit soldiers ---------- */

function soldierForm(sid) {
  const s0 = st();
  const so = sid ? S.soldierById(s0, sid) : null;
  const f = so ? { ...so } : { name: '', pn: '', platoon: ui.platoon || '', role: '', phone: '', note: '' };
  const bulk = { on: false, text: '', platoon: f.platoon };
  const pls = platoons();
  const dl = `<datalist id="pl-list">${pls.map(p => `<option value="${h(p)}">`).join('')}</datalist>`;
  openSheet({
    title: so ? 'פרטי החייל' : 'חיילים חדשים',
    done: { label: so ? 'שמירה' : 'הוספה', act: 'save' },
    render: () => `
      ${so ? '' : segmented('mode', [['one', 'חייל אחד'], ['list', 'רשימה']], bulk.on ? 'list' : 'one')}
      ${bulk.on ? `
        <div class="card form">
          <label class="field"><span>מחלקה</span><input type="text" data-field="bplatoon" list="pl-list" value="${h(bulk.platoon)}" placeholder="למשל: מחלקה 1"></label>
        </div>
        <div class="card form"><label class="field full"><textarea data-field="btext" rows="9" placeholder="שם אחד בכל שורה&#10;אפשר גם: שם, מ.א., תפקיד, טלפון" aria-label="רשימת חיילים">${h(bulk.text)}</textarea></label></div>
        <p class="field-note">${bulkParse().length ? `${bulkParse().length} חיילים יתווספו` : 'אפשר להדביק עמודה מאקסל או מוואטסאפ.'}</p>` : `
        <div class="card form">
          <label class="field"><span>שם מלא</span><input type="text" data-field="name" value="${h(f.name)}" autocomplete="off" placeholder="חובה"></label>
          <label class="field"><span>מ.א.</span><input type="text" inputmode="numeric" data-field="pn" value="${h(f.pn)}" autocomplete="off"></label>
          <label class="field"><span>מחלקה</span><input type="text" data-field="platoon" list="pl-list" value="${h(f.platoon)}" placeholder="למשל: מחלקה 1"></label>
          <label class="field"><span>תפקיד</span><input type="text" data-field="role" value="${h(f.role)}" placeholder="למשל: קלע"></label>
          <label class="field"><span>טלפון</span><input type="tel" data-field="phone" value="${h(f.phone)}" dir="ltr"></label>
        </div>
        <div class="card form"><label class="field full"><textarea data-field="note" rows="3" placeholder="הערות" aria-label="הערות">${h(f.note)}</textarea></label></div>`}
      ${dl}`,
    on: {
      seg: (el, ev, sh) => { bulk.on = el.dataset.v === 'list'; sh.update(); },
      save: (el, ev, sh) => {
        if (bulk.on) {
          const list = bulkParse();
          if (!list.length) return toast('אין שמות ברשימה');
          S.commit(s => { for (const x of list) s.soldiers.push({ id: S.uid(), ...x }); });
          sh.close();
          toast(`נוספו ${list.length} חיילים`);
          return;
        }
        if (!f.name.trim()) { toast('צריך שם'); sh.body.querySelector('[data-field=name]')?.focus(); return; }
        const clean = { name: f.name.trim(), pn: f.pn.trim(), platoon: f.platoon.trim(), role: f.role.trim(), phone: f.phone.trim(), note: f.note.trim() };
        if (so) S.commit(s => Object.assign(S.soldierById(s, sid), clean));
        else S.commit(s => { s.soldiers.push({ id: S.uid(), ...clean }); });
        sh.close();
        toast(so ? 'נשמר' : `${clean.name} נוסף`);
      },
    },
    field: (el, ev, sh) => {
      const k = el.dataset.field;
      if (k === 'btext') { bulk.text = el.value; const p = sh.body.querySelector('.field-note'); if (p) p.textContent = bulkParse().length ? `${bulkParse().length} חיילים יתווספו` : 'אפשר להדביק עמודה מאקסל או מוואטסאפ.'; return; }
      if (k === 'bplatoon') { bulk.platoon = el.value; return; }
      f[k] = el.value;
    },
    mounted: sh => { if (!so) setTimeout(() => sh.body.querySelector('input,textarea')?.focus({ preventScroll: true }), 380); },
  });

  function bulkParse() {
    return bulk.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const [name, pn = '', role = '', phone = ''] = l.split(/\t|,|;/).map(x => x.trim());
      return { name: name.replace(/^\d+[.)]\s*/, ''), pn, role, phone, platoon: bulk.platoon.trim(), note: '' };
    }).filter(x => x.name);
  }
}

/* ---------- Sheets: sites ---------- */

function siteForm(id) {
  const s0 = st();
  const site = id ? S.siteById(s0, id) : null;
  const used = new Set(s0.sites.map(x => x.color));
  const f = site ? { ...site, weekend: site.weekendNeed !== '' && site.weekendNeed != null }
    : { name: '', color: S.SITE_COLORS.find(c => !used.has(c)) || S.SITE_COLORS[s0.sites.length % S.SITE_COLORS.length], need: 2, weekendNeed: 2, weekend: false, start: '', end: '' };
  f.need = +f.need || 0;
  f.weekendNeed = f.weekend ? +f.weekendNeed : f.need;
  openSheet({
    title: site ? 'עריכת אתר' : 'אתר חדש',
    done: { label: 'שמירה', act: 'save' },
    render: () => `
      <div class="card form">
        <label class="field"><span>שם האתר</span><input type="text" data-field="name" value="${h(f.name)}" placeholder="למשל: מוצב צפוני" autocomplete="off"></label>
      </div>
      <h3 class="sub-title">צבע</h3>
      <div class="swatches">${S.SITE_COLORS.map(c => `<button class="swatch${f.color === c ? ' on' : ''}" data-act="color" data-c="${c}" style="--c:${c}" aria-label="צבע" aria-pressed="${f.color === c}">${icon('check')}</button>`).join('')}</div>
      <h3 class="sub-title">כמה חיילים צריך</h3>
      <div class="card form">
        <div class="field"><span>ביום רגיל</span>${stepper('need', f.need, 0, 99, 'חיילים ביום רגיל')}</div>
        <label class="field toggle"><span>מספר אחר בסופ״ש</span><input type="checkbox" role="switch" data-field="weekend" ${f.weekend ? 'checked' : ''}><i></i></label>
        ${f.weekend ? `<div class="field"><span>בשישי ושבת</span>${stepper('weekendNeed', f.weekendNeed, 0, 99, 'חיילים בסופ״ש')}</div>` : ''}
      </div>
      <h3 class="sub-title">שעות פעילות<span class="opt"> · לא חובה</span></h3>
      <div class="card form">
        <label class="field"><span>משעה</span><input type="time" data-field="start" value="${f.start || ''}"></label>
        <label class="field"><span>עד שעה</span><input type="time" data-field="end" value="${f.end || ''}"></label>
      </div>
      ${site ? `<div class="sheet-actions"><button class="btn danger-soft" data-act="del">${icon('trash')}<span>מחיקת האתר</span></button></div>` : ''}`,
    on: {
      color: (el, ev, sh) => { f.color = el.dataset.c; sh.update(); },
      step: (el, ev, sh) => { f[el.dataset.name] = Math.max(0, Math.min(99, f[el.dataset.name] + +el.dataset.d)); sh.update(); },
      save: (el, ev, sh) => {
        if (!f.name.trim()) { toast('צריך שם לאתר'); return; }
        const clean = { name: f.name.trim(), color: f.color, need: f.need, weekendNeed: f.weekend ? f.weekendNeed : '', start: f.start, end: f.end };
        if (site) S.commit(s => Object.assign(S.siteById(s, id), clean));
        else S.commit(s => { s.sites.push({ id: S.uid(), ...clean }); });
        sh.close();
        toast(site ? 'נשמר' : `${clean.name} נוסף`);
      },
      del: async (el, ev, sh) => {
        const n = st().events.filter(e => e.kind === 'site' && e.siteId === id).length;
        if (!await confirmDialog({ title: `למחוק את ${site.name}?`, message: n ? `גם ${n} השיבוצים לאתר יימחקו.` : '', ok: 'מחיקה', danger: true })) return;
        S.commit(s => S.removeSite(s, id), { undoable: true });
        sh.close();
        toast('האתר נמחק', undoAction());
      },
    },
    field: (el, ev, sh) => {
      const k = el.dataset.field;
      if (k === 'weekend') { f.weekend = el.checked; sh.update(); return; }
      f[k] = el.value;
    },
    mounted: sh => { if (!site) setTimeout(() => sh.body.querySelector('input')?.focus({ preventScroll: true }), 380); },
  });
}

function siteDaySheet(siteId, date) {
  openSheet({
    live: true,
    title: S.siteById(st(), siteId)?.name || '',
    sub: S.fmtLong(date),
    render: () => {
      const s = st();
      const site = S.siteById(s, siteId);
      if (!site) return '<p class="list-empty">האתר נמחק</p>';
      const idx = S.index(s);
      const here = S.siteRoster(s, idx, date).get(siteId);
      const need = S.needOn(site, date);
      const free = [];
      for (const so of S.sortedSoldiers(s)) {
        const x = S.dayOf(idx, so.id, date);
        if (!x.main || x.main.kind === 'home') free.push({ so, x });
      }
      free.sort((a, b) => a.x.cons.length - b.x.cons.length);
      return `
        <div class="meter" style="--c:${site.color}">
          <b>${here.length}<small>${need ? ` מתוך ${need}` : ''}</small></b>
          ${need ? `<span class="bar big"><span style="width:${Math.min(100, here.length / need * 100)}%"></span></span>` : ''}
          <span>${need ? (here.length >= need ? 'מאויש' : `חסרים ${need - here.length}`) : 'האתר לא צריך חיילים ביום הזה'}</span>
        </div>
        <h3 class="sub-title">סוגרים כאן</h3>
        <div class="card list">${here.map(({ soldier: so, ev }) => `
          <div class="row static">${avatar(so)}
            <span class="row-main"><span class="row-title">${h(so.name)}${ev.auto ? ' <span class="badge">אוטומטי</span>' : ''}</span><span class="row-sub">${[so.platoon, S.timeText(ev, date)].filter(Boolean).map(h).join(' · ')}</span></span>
            <button class="icon-btn sm danger" data-act="remove" data-sid="${so.id}" aria-label="הוצאת ${h(so.name)} מהאתר">${icon('x')}</button>
          </div>`).join('') || '<p class="list-empty">אף אחד עדיין</p>'}</div>
        <h3 class="sub-title">פנויים ביום הזה</h3>
        <div class="card list">${free.map(({ so, x }) => `
          <button class="row" data-act="put" data-sid="${so.id}">${avatar(so)}
            <span class="row-main"><span class="row-title">${h(so.name)}</span><span class="row-sub">${[so.platoon, so.role].filter(Boolean).map(h).join(' · ')}${x.cons.length ? ` · <span class="tag" style="--c:${S.KINDS.constraint.color}">אילוץ${x.cons[0].note ? ': ' + h(x.cons[0].note) : ''}</span>` : ''}</span></span>
            <span class="add-ic">${icon('plus')}</span>
          </button>`).join('') || '<p class="list-empty">אין חיילים פנויים</p>'}</div>`;
    },
    on: {
      put: el => {
        S.commit(s => S.addEvent(s, { soldierId: el.dataset.sid, kind: 'site', siteId, from: date, to: date }), { undoable: true });
        tick();
      },
      remove: el => {
        S.commit(s => S.carve(s, el.dataset.sid, date, date), { undoable: true });
        toast('הוצא מהאתר', undoAction());
      },
    },
  });
}

function autoSheet() {
  const s0 = st();
  const r = { ...s0.rules };
  openSheet({
    title: 'שיבוץ אוטומטי',
    sub: periodText(),
    done: { label: 'שיבוץ', act: 'run' },
    render: () => `
      <div class="explain">
        <span class="explain-ic">${icon('wand')}</span>
        <p>ממלא את המקומות הפנויים בכל אתר, לפי מי שפנוי בכל יום. מי שבגימלים, בחופשה, בקורס או בבית לפי מה שהכנסת לא ישובץ, וחייל עם אילוץ ישובץ רק אם אין אף אחד אחר. <b>מה שהכנסת ביד לא משתנה.</b></p>
      </div>
      <h3 class="sub-title">כללים</h3>
      <div class="card form">
        <div class="field"><span>סוגרים עד</span>${stepper('maxStreak', r.maxStreak, 1, 30, 'ימים ברצף')}<span class="field-hint">ימים ברצף</span></div>
        <div class="field"><span>ואז לפחות</span>${stepper('minRest', r.minRest, 0, 14, 'ימים בבית')}<span class="field-hint">ימים בבית</span></div>
      </div>
      <p class="field-note">השיבוץ הקודם שנעשה אוטומטית בתקופה מתחלף בחדש.</p>
      <div class="sheet-actions"><button class="btn plain" data-act="clearAuto">${icon('trash')}<span>ניקוי השיבוץ האוטומטי</span></button></div>`,
    on: {
      step: (el, ev, sh) => { const k = el.dataset.name; r[k] = Math.max(k === 'minRest' ? 0 : 1, Math.min(k === 'minRest' ? 14 : 30, r[k] + +el.dataset.d)); sh.update(); },
      run: (el, ev, sh) => {
        const res = S.commit(s => { s.rules = { ...r }; return autoAssign(s); }, { undoable: true });
        sh.close();
        tick();
        toast(res.short ? `שובצו ${res.filled} ימי סגירה · חסרים עוד ${res.short}` : `שובצו ${res.filled} ימי סגירה · הכל מאויש`, undoAction());
      },
      clearAuto: (el, ev, sh) => {
        const n = S.commit(s => clearAutoInPeriod(s), { undoable: true });
        sh.close();
        toast(n ? 'השיבוץ האוטומטי נוקה' : 'אין שיבוץ אוטומטי לנקות', n ? undoAction() : {});
      },
    },
  });
}

/* ---------- Sheet: a whole day ---------- */

function daySheet(date) {
  openSheet({
    live: true,
    wide: true,
    title: S.fmtLong(date),
    sub: 'איפה כל אחד ביום הזה',
    render: () => groupsHtml(date, null),
    on: {
      cell: el => cellSheet(el.dataset.sid, el.dataset.date),
      jump: (el, ev, sh) => sh.body.querySelector('#' + el.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
  });
}

/* ---------- Settings ---------- */

function settingsSheet() {
  openSheet({
    live: true,
    title: 'הגדרות',
    render: () => {
      const s = st();
      return `
        <div class="card form">
          <label class="field"><span>שם הפלגה</span><input type="text" data-field="unit" value="${h(s.unit)}" placeholder="למשל: פלגה ב׳"></label>
        </div>
        <h3 class="sub-title">תקופת הלוח</h3>
        <div class="card form">
          <label class="field"><span>מתחיל ב־</span><input type="date" data-field="start" value="${s.start}"></label>
          <div class="field col"><span>אורך</span>${segmented('days', [[7, 'שבוע'], [14, 'שבועיים'], [21, '3 שבועות'], [28, 'חודש']], s.days)}</div>
        </div>
        <h3 class="sub-title">יום בלי שום שיבוץ</h3>
        <div class="card form"><div class="field col">${segmented('unassigned', [['home', 'מוצג כ״בבית״'], ['blank', 'נשאר ריק']], s.unassigned)}</div></div>
        <h3 class="sub-title">ייצוא וגיבוי</h3>
        <div class="card list">
          <button class="row" data-act="export"><span class="row-ic" style="--c:#248a3d">${icon('table')}</span><span class="row-main"><span class="row-title">ייצוא לאקסל</span><span class="row-sub">לוח, מי סוגר איפה, חיילים, הפניות ואילוצים</span></span>${icon('chevron', 'row-chev')}</button>
          <button class="row" data-act="backup"><span class="row-ic" style="--c:#007aff">${icon('download')}</span><span class="row-main"><span class="row-title">גיבוי לקובץ</span><span class="row-sub">כדי להעביר לטלפון אחר או לשמור בצד</span></span>${icon('chevron', 'row-chev')}</button>
          <label class="row"><span class="row-ic" style="--c:#5856d6">${icon('upload')}</span><span class="row-main"><span class="row-title">שחזור מגיבוי</span><span class="row-sub">מחליף את כל מה שיש עכשיו</span></span><input type="file" accept="application/json,.json" data-field="restore" hidden>${icon('chevron', 'row-chev')}</label>
        </div>
        <div class="card list">
          <button class="row" data-act="loadDemo"><span class="row-ic" style="--c:#ff9500">${icon('people')}</span><span class="row-main"><span class="row-title">פלגה לדוגמה</span><span class="row-sub">18 חיילים ו־3 אתרים, כדי לראות איך זה עובד</span></span>${icon('chevron', 'row-chev')}</button>
          <button class="row" data-act="wipe"><span class="row-ic" style="--c:#ff3b30">${icon('trash')}</span><span class="row-main"><span class="row-title danger">מחיקת הכל</span></span></button>
        </div>
        <p class="foot-note">מפל for you · גרסה ${APP_VERSION}<br>הנתונים נשמרים רק בטלפון הזה.</p>`;
    },
    on: {
      export: () => exportXlsx(),
      backup: () => backup(),
      loadDemo: () => loadDemo(),
      wipe: async (el, ev, sh) => {
        if (!await confirmDialog({ title: 'למחוק הכל?', message: 'כל החיילים, האתרים והשיבוצים יימחקו מהטלפון. אי אפשר לבטל.', ok: 'מחיקה', danger: true })) return;
        S.resetAll();
        closeAll();
        render(true);
      },
    },
    field: async (el, ev) => {
      const k = el.dataset.field;
      if (k === 'unit') { S.commit(s => { s.unit = el.value; }); return; }
      if (k === 'start' && el.value && ev.type === 'change') { S.commit(s => { s.start = el.value; }); return; }
      if (k === 'restore' && el.files?.[0]) {
        try {
          const data = JSON.parse(await el.files[0].text());
          if (!Array.isArray(data.soldiers) || !Array.isArray(data.events)) throw new Error();
          if (!await confirmDialog({ title: 'לשחזר מהגיבוי?', message: `${data.soldiers.length} חיילים ו־${(data.sites || []).length} אתרים יחליפו את מה שיש עכשיו.`, ok: 'שחזור' })) return;
          S.replaceAll(data);
          closeAll();
          toast('שוחזר');
        } catch { toast('הקובץ הזה לא גיבוי של מפל for you'); }
        el.value = '';
      }
    },
  });
}

async function loadDemo() {
  const s = st();
  if (s.soldiers.length && !await confirmDialog({ title: 'לטעון פלגה לדוגמה?', message: 'מה שיש עכשיו יוחלף. כדאי לגבות קודם.', ok: 'טעינה' })) return;
  S.replaceAll(demoState());
  closeAll();
  ui.at = null;
  ui.platoon = '';
  toast('נטענה פלגה לדוגמה');
  render(true);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

async function exportXlsx() {
  const s = st();
  if (!s.soldiers.length) return toast('אין עדיין חיילים לייצא');
  const name = fileName(s);
  const blob = new Blob([workbook(s)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const file = new File([blob], name, { type: blob.type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(blob, name);
  toast('קובץ האקסל ירד', { icon: icon('check') });
}

function backup() {
  const s = st();
  download(new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' }), `mapel-backup-${S.today()}.json`);
  toast('הגיבוי ירד');
}

/* ---------- Welcome ---------- */

function renderWelcome() {
  return `<div class="welcome">
    <img class="welcome-icon" src="img/icon.svg" alt="" width="96" height="96">
    <h1>מפל <span class="latin">for you</span></h1>
    <p class="welcome-tag">כל הפלגה, כל יום, במקום אחד.<br>מי סוגר איפה, מי בגימלים, למי יש הפניה, ולוח מוכן לאקסל.</p>
    <div class="card form welcome-form">
      <label class="field"><span>שם הפלגה</span><input type="text" id="w-unit" placeholder="למשל: פלגה ב׳" autocomplete="off"></label>
    </div>
    <button class="btn primary big" data-act="start">מתחילים</button>
    <button class="link-btn" data-act="loadDemo">או נסו עם פלגה לדוגמה</button>
    <p class="welcome-foot">הכל נשמר רק בטלפון שלך.</p>
  </div>`;
}

/* ---------- Render ---------- */

const RENDER = { now: renderNow, board: renderBoard, sites: renderSites, soldiers: renderSoldiers };

function render(animate = false) {
  const s = st();
  const welcome = !s.onboarded;
  tabbar.classList.toggle('hidden', welcome);
  document.documentElement.classList.toggle('selecting', ui.select && ui.tab === 'board');
  const grid = document.getElementById('grid');
  if (grid) ui.scroll = { left: grid.scrollLeft, top: grid.scrollTop };
  const y = scrollY;
  view.innerHTML = welcome ? renderWelcome() : RENDER[ui.tab]();
  if (animate) {
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
  } else view.classList.remove('enter');
  const g2 = document.getElementById('grid');
  if (g2) {
    if (animate && ui.tab === 'board') scrollGridToToday(g2);
    else { g2.scrollLeft = ui.scroll.left || 0; g2.scrollTop = ui.scroll.top || 0; }
  }
  if (!animate) window.scrollTo(0, y);
  paintTabs();
  renderSelBar();
}

function scrollGridToToday(g) {
  const td = g.querySelector('th.day.is-today');
  if (!td) { g.scrollLeft = 0; return; }
  const corner = g.querySelector('.corner').offsetWidth;
  const gr = g.getBoundingClientRect(), tr = td.getBoundingClientRect();
  // RTL: scroll so today's column sits right after the names column
  g.scrollLeft += (tr.right - (gr.right - corner));
}

function paintTabs() {
  if (!tabbar.dataset.ready) {
    tabbar.innerHTML = '<span class="tab-pill" id="tab-pill"></span>' + TABS.map(t =>
      `<button class="tab" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<span>${t.label}</span></button>`).join('');
    tabbar.dataset.ready = '1';
    tabbar.addEventListener('click', ev => {
      const b = ev.target.closest('.tab');
      if (b) go(b.dataset.tab);
    });
  }
  const i = TABS.findIndex(t => t.id === ui.tab);
  tabbar.style.setProperty('--i', i);
  tabbar.style.setProperty('--n', TABS.length);
  tabbar.querySelectorAll('.tab').forEach((b, j) => {
    b.classList.toggle('on', j === i);
    if (j === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function go(tab) {
  if (tab === ui.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  ui.tab = tab;
  if (tab !== 'board') { ui.select = false; ui.sel.clear(); }
  history.replaceState(null, '', '#' + tab);
  tick();
  window.scrollTo(0, 0);
  render(true);
}

/* ---------- Selection bar ---------- */

let selbar = null;
function renderSelBar() {
  const show = ui.select && ui.tab === 'board';
  if (!selbar) {
    selbar = document.createElement('div');
    selbar.className = 'selbar';
    document.body.appendChild(selbar);
    bind(selbar, { on: {
      selApply: () => {
        if (!ui.sel.size) return toast('מסמנים קודם תאים בלוח');
        eventEditor({ cells: [...ui.sel].map(k => { const [sid, date] = k.split('|'); return { sid, date }; }) });
      },
      selClear: () => {
        if (!ui.sel.size) return;
        const cells = [...ui.sel].map(k => { const [sid, date] = k.split('|'); return { sid, date }; });
        S.commit(s => S.clearCells(s, cells), { undoable: true });
        ui.sel.clear();
        render();
        toast(`נוקו ${cells.length} תאים`, undoAction());
      },
      selDone: () => { ui.select = false; ui.sel.clear(); render(); },
    } });
  }
  selbar.classList.toggle('show', show);
  if (show) selbar.innerHTML = `
    <button class="sb-btn" data-act="selDone">סיום</button>
    <span class="sb-count">${ui.sel.size ? `${ui.sel.size} נבחרו` : 'בחרו תאים'}</span>
    <button class="sb-btn" data-act="selClear" ${ui.sel.size ? '' : 'disabled'}>ניקוי</button>
    <button class="sb-btn strong" data-act="selApply" ${ui.sel.size ? '' : 'disabled'}>סימון כ…</button>`;
}

/* ---------- Main view events ---------- */

bind(view, {
  on: {
    settings: () => settingsSheet(),
    go: el => go(el.dataset.tab),
    start: () => {
      const unit = document.getElementById('w-unit')?.value.trim() || '';
      S.commit(s => { s.unit = unit; s.onboarded = true; s.start = S.today(); });
      render(true);
    },
    loadDemo: () => loadDemo(),
    pickTime: () => pickTimeSheet(),
    liveNow: () => { ui.at = null; render(true); },
    jump: el => document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    cell: (el) => {
      const { sid, date } = el.dataset;
      if (ui.select && el.classList.contains('cell')) {
        const k = sid + '|' + date;
        if (ui.sel.has(k)) ui.sel.delete(k); else ui.sel.add(k);
        tick();
        render();
        return;
      }
      cellSheet(sid, date);
    },
    who: el => {
      const sid = el.dataset.sid;
      if (ui.select) {
        const ds = S.periodDates(st());
        const keys = ds.map(d => sid + '|' + d);
        const all = keys.every(k => ui.sel.has(k));
        keys.forEach(k => all ? ui.sel.delete(k) : ui.sel.add(k));
        render();
        return;
      }
      soldierSheet(sid);
    },
    dayHead: el => {
      const d = el.dataset.date;
      if (ui.select) {
        const keys = boardSoldiers().map(so => so.id + '|' + d);
        const all = keys.every(k => ui.sel.has(k));
        keys.forEach(k => all ? ui.sel.delete(k) : ui.sel.add(k));
        render();
        return;
      }
      daySheet(d);
    },
    toggleSelect: () => { ui.select = !ui.select; ui.sel.clear(); tick(); render(); },
    export: () => exportXlsx(),
    shift: el => {
      const d = +el.dataset.d;
      S.commit(s => { s.start = d === 0 ? S.today() : S.addDays(s.start, d); });
      render(true);
    },
    seg: el => setSeg(el.dataset.name, el.dataset.v),
    platoon: el => { ui.platoon = el.dataset.v; render(); },
    addSite: () => siteForm(),
    editSite: el => siteForm(el.dataset.id),
    siteDay: el => siteDaySheet(el.dataset.site, el.dataset.date),
    auto: () => autoSheet(),
    addSoldier: () => soldierForm(),
  },
});

// Segmented controls anywhere (view or sheets)
function setSeg(name, v) {
  if (name === 'days') S.commit(s => { s.days = +v; });
  else if (name === 'unassigned') S.commit(s => { s.unassigned = v; });
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('.sheet [data-act="seg"]');
  if (b && (b.dataset.name === 'days' || b.dataset.name === 'unassigned')) setSeg(b.dataset.name, b.dataset.v);
});

view.addEventListener('input', ev => {
  if (ev.target.matches('[data-search]')) {
    ui.q = ev.target.value;
    const box = document.getElementById('soldier-list');
    if (box) box.innerHTML = soldierList(S.index(st()), S.today());
  }
});

// Long-press on a cell starts selection with it
let lp = 0;
view.addEventListener('pointerdown', ev => {
  const c = ev.target.closest('.cell');
  if (!c || ui.select) return;
  lp = setTimeout(() => {
    ui.select = true;
    ui.sel = new Set([c.dataset.sid + '|' + c.dataset.date]);
    tick();
    render();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 700);
  }, 480);
});
let suppressClick = false;
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => view.addEventListener(t, () => clearTimeout(lp)));
view.addEventListener('scroll', () => clearTimeout(lp), true);
view.addEventListener('click', ev => { if (suppressClick) { suppressClick = false; ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);

/* ---------- Boot ---------- */

S.subscribe(() => { render(); refreshLive(); });
render(true);

setInterval(() => { if (ui.tab === 'now' && !ui.at && !document.hidden) render(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
