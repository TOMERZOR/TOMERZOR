// היכרות בקליק — the screens: onboarding, home, people, scan, activity, profiles and the story.

import { icon } from './icons.js';
import { api, demo, session, saveSession } from './api.js';
import { qrSvg, startScanner } from './qr.js';
import { CORPS, STATUS, PREP, MONTHS, gen, statusLabel, monthLabel, unitChain, currentRole } from './core.js';

const APP_VERSION = '1.0';

const $ = sel => document.querySelector(sel);
const $view = $('#view');
const $tabbar = $('#tabbar');
const $overlay = $('#overlay');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

let sess = session();
let me = null;
const cache = { feed: null, lists: {}, views: {} };
const ui = { peopleTab: 'friends', query: '', results: null };

// ---------- Suggestions for the free-text fields ----------

const CITIES = ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'ראשון לציון', 'פתח תקווה', 'אשדוד', 'נתניה', 'חולון', 'בני ברק', 'רמת גן', 'אשקלון', 'רחובות', 'בת ים', 'הרצליה', 'כפר סבא', 'רעננה', 'מודיעין', 'חדרה', 'נהריה', 'עפולה', 'טבריה', 'אילת', 'קריית שמונה', 'צפת', 'כרמיאל', 'הוד השרון', 'רמת השרון', 'גבעתיים', 'ראש העין', 'יבנה', 'קריית גת', 'דימונה', 'שדרות', 'אופקים', 'נס ציונה', 'לוד', 'רמלה', 'אור יהודה', 'זכרון יעקב', 'קיסריה', 'מעלה אדומים', 'אריאל', 'בית שמש', 'יקנעם', 'קריית ביאליק', 'קריית מוצקין', 'נוף הגליל', 'מגדל העמק'];
const MECHINOT = ['מכינת רבין', 'בני דוד – עלי', 'עין פרת', 'נחשון', 'בית ישראל', 'יונתן', 'לכיש', 'צהלי', 'אבני איתן', 'מעלות', 'אלישע', 'הר חברון', 'עצם', 'קדם', 'מיתר'];
const YEARS = ['שנת שירות בצופים', 'שנת שירות בתנועה', 'שנת שירות בנוער העובד', 'שנת שירות בבני עקיבא', 'שנת שירות בכנפיים של קרמבו'];
const TIRONUT = ['שיזפון', 'מחנה 80', 'בסיס טירונים גולני', 'בסיס טירונים גבעתי', 'בסיס טירונים צנחנים', 'בה״ד 4', 'מחנה נחשונים', 'בסיס האימונים ביהל״ם'];
const ROLES = ['לוחם', 'לוחמת', 'מפקד כיתה', 'מפקדת צוות', 'מפקד צוות', 'סמל מחלקה', 'מ״מ', 'סמ״פ', 'מ״פ', 'קצין', 'קצינה', 'קורס מ״כים', 'קורס קצינים', 'קורס חובשים', 'חובש', 'קשר', 'נהג', 'צלף', 'נגביסט', 'מאגיסט', 'טנקיסט', 'תותחן', 'מדריכה', 'מש״קית ת״ש', 'מש״קית חינוך', 'תצפיתנית', 'מחקרן', 'מתכנת', 'טכנאי', 'פקיד'];

// ---------- Small UI helpers ----------

const GRADS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');

function avatar(p, size = 'm', { ring = false, cls = '' } = {}) {
  const inner = p?.photo
    ? `<img src="${esc(p.photo)}" alt="" loading="lazy" decoding="async">`
    : `<span class="av-ini ${GRADS[hash(p?.id || p?.name) % GRADS.length]}">${esc(initials(p?.name))}</span>`;
  return `<span class="av av-${size} ${ring ? 'ring' : ''} ${cls}">${inner}</span>`;
}

const ageLine = p => [p.age ? `${gen(p, 'בן', 'בת', 'בן/בת')} ${p.age}` : '', p.city ? `מ${p.city}` : ''].filter(Boolean).join(' · ');
const headline = p => [p.role, p.top || CORPS[p.corps]?.name].filter(Boolean).join(' · ');

function timeAgo(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'עכשיו';
  if (s < 3600) return `לפני ${Math.floor(s / 60)} דק׳`;
  if (s < 86400) return `לפני ${Math.floor(s / 3600)} שע׳`;
  if (s < 172800) return 'אתמול';
  if (s < 604800) return `לפני ${Math.floor(s / 86400)} ימים`;
  return new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function haptic(ms = 8) { try { navigator.vibrate?.(ms); } catch {} }

let toastTimer;
function toast(text, ic = 'check') {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.append(el); }
  el.innerHTML = `${icon(ic)}<span>${esc(text)}</span>`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function errorText(e) {
  if (e?.code === 'offline') return 'אין חיבור לאינטרנט כרגע';
  if (e?.code === 'photo') return 'התמונה גדולה מדי';
  if (e?.code === 'slow_down') return 'יותר מדי ניסיונות. נסו שוב בעוד שעה';
  if (e?.code === 'not_found') return 'הפרופיל הזה לא קיים יותר';
  return 'משהו השתבש. נסו שוב';
}

function confetti() {
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#f3d9a4', '#d9a25f', '#8e9b5a', '#ffffff', '#c7b38a'];
  box.innerHTML = Array.from({ length: 46 }, (_, i) => `<i style="--x:${Math.random() * 100}vw;--d:${0.9 + Math.random() * 1.2}s;--r:${Math.random() * 720 - 360}deg;--c:${colors[i % colors.length]};--s:${0.6 + Math.random() * 0.8}"></i>`).join('');
  document.body.append(box);
  setTimeout(() => box.remove(), 2600);
}

// ---------- Theme ----------

function applyTheme() {
  const t = store.get('hekerut.theme', 'auto');
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

// ---------- Router ----------

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [name, arg = ''] = h.split('/');
  return { name: name || 'home', arg };
}
const go = hash => { if (location.hash === `#${hash}`) render(); else location.hash = hash; };
const TABS = [
  { id: 'home', label: 'בית', icon: 'home' },
  { id: 'people', label: 'אנשים', icon: 'people' },
  { id: 'scan', label: 'קוד', icon: 'qr' },
  { id: 'activity', label: 'פעילות', icon: 'bell' },
  { id: 'me', label: 'פרופיל', icon: 'user' },
];

function buildTabbar() {
  $tabbar.innerHTML = TABS.map(t => t.id === 'scan'
    ? `<button class="tab tab-scan" data-tab="scan" aria-label="הקוד שלי וסריקה"><span class="scan-btn">${icon('qr')}</span></button>`
    : `<button class="tab" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<span class="tab-dot"></span></button>`).join('');
  $tabbar.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    haptic();
    if (b.dataset.tab === 'scan') return openScan();
    if (route().name === b.dataset.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    go(b.dataset.tab);
  });
}

function setTabbar(active) {
  $tabbar.classList.toggle('hidden', !sess || !me);
  $tabbar.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === active));
  $tabbar.querySelector('[data-tab="activity"]')?.classList.toggle('badge', !!me?.unread);
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const r = route();
  closeSheet(true);
  if (r.name === 'login' && r.arg) return loginFromLink(r.arg);
  if (r.name === 'c' && r.arg) return openCode(r.arg);
  if (!sess) return renderOnboarding();
  if (!me) {
    try { me = await api.me(sess); } catch (e) {
      if (e.status === 401) { sess = null; saveSession(null); return renderOnboarding(); }
      if (seq !== renderSeq) return;
      return page(`<div class="empty-state">${icon('refresh')}<h2>אין חיבור</h2><p>${esc(errorText(e))}</p><button class="btn primary" data-act="reload">לנסות שוב</button></div>`, 'none');
    }
  }
  if (seq !== renderSeq) return;
  const views = { home: renderHome, people: renderPeople, activity: renderActivity, me: () => renderProfile(me.id), u: () => renderProfile(r.arg), edit: renderEdit, settings: renderSettings };
  (views[r.name] || renderHome)(seq);
}

function page(html, tab, { cls = '' } = {}) {
  $view.className = `view ${cls}`;
  $view.innerHTML = html;
  $view.classList.remove('enter');
  void $view.offsetWidth;
  $view.classList.add('enter');
  setTabbar(tab);
}

const topbar = (title, { back = false, actions = '' } = {}) => `
  <header class="topbar">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="חזרה">${icon('back')}</button>` : '<span class="tb-gap"></span>'}
    <h1 class="tb-title">${title}</h1>
    <div class="tb-actions">${actions}</div>
  </header>`;

const wordmark = () => `<span class="wordmark"><span class="wm-mark">${icon('sparkle')}</span>היכרות<span class="wm-accent">בקליק</span></span>`;

// ---------- Onboarding ----------

const STEPS = [
  { id: 'basics', title: 'נעים להכיר', sub: 'הבסיס. רק מה שמספרים בדקה הראשונה.' },
  { id: 'prep', title: 'לפני הצבא', sub: 'מכינה, שנת שירות, או ישר לבקו״ם?' },
  { id: 'service', title: 'השירות', sub: 'איפה שירתת, מהחיל ועד הצוות. כל שלב לא חובה.' },
  { id: 'path', title: 'טירונות ותפקידים', sub: 'מהטירונות ועד התפקיד של היום.' },
  { id: 'bio', title: 'משפט אחד עליך', sub: 'שורה שתגיד מי את/ה. אפשר לדלג.' },
];

let draft = null;
let draftPhoto;
let step = 0;

function blankProfile() {
  return { name: '', g: 'm', born: '', city: '', bio: '', prep: { kind: 'none', name: '' }, status: 'active', draft: '', release: '', unit: { corps: '', path: [] }, tironut: '', roles: [], vis: 'met' };
}

function renderOnboarding() {
  const saved = store.get('hekerut.draft');
  if (!draft) { draft = saved?.p || blankProfile(); step = saved?.step || 0; }
  if (!saved && step === 0 && !store.get('hekerut.welcomed')) return renderWelcome();
  const s = STEPS[step];
  page(`
    <div class="onb">
      <div class="onb-top">
        ${step ? `<button class="icon-btn" data-act="onb-back" aria-label="הקודם">${icon('back')}</button>` : '<span class="tb-gap"></span>'}
        <div class="progress"><span style="width:${((step + 1) / STEPS.length) * 100}%"></span></div>
        <span class="onb-count">${step + 1}/${STEPS.length}</span>
      </div>
      <div class="onb-head"><h1>${s.title}</h1><p>${s.sub}</p></div>
      <form class="form" id="pform" autocomplete="off" onsubmit="return false">${sectionHtml(s.id, draft)}</form>
      <div class="onb-foot">
        <button class="btn primary big" data-act="onb-next">${step === STEPS.length - 1 ? 'יצירת הפרופיל' : 'המשך'}</button>
        ${step > 0 && step < STEPS.length - 1 ? '<button class="btn ghost" data-act="onb-skip">דילוג</button>' : ''}
      </div>
    </div>`, 'none', { cls: 'no-tabs' });
}

function renderWelcome() {
  page(`
    <div class="welcome">
      <div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>
      <div class="welcome-cards" aria-hidden="true">
        <div class="wc wc1">${avatar({ name: 'נועה לוי', id: 'a' }, 's')}<div><b>נועה</b><small>תותחנים · 215</small></div></div>
        <div class="wc wc2">${avatar({ name: 'איתי כהן', id: 'b' }, 's')}<div><b>איתי</b><small>גולני · 13</small></div></div>
        <div class="wc wc3"><span class="wc-badge">${icon('people')}</span><div><b>3 מכירים משותפים</b><small>ואותה טירונות</small></div></div>
      </div>
      <div class="welcome-copy">
        ${wordmark()}
        <h1>כל המסלול הצבאי שלך.<br><span class="grad-text">בקליק אחד.</span></h1>
        <p>בונים פרופיל פעם אחת, וכשמכירים מישהו חדש פשוט סורקים. רואים מאיפה הוא, מה עשה בצבא, ומי אתם מכירים במשותף.</p>
        <button class="btn primary big" data-act="start">בואו נתחיל</button>
        <small class="muted">לוקח בערך דקה · בלי מספר אישי ובלי מידע מסווג</small>
      </div>
    </div>`, 'none', { cls: 'no-tabs welcome-page' });
}

function saveDraft() { store.set('hekerut.draft', { p: draft, step }); }

async function onboardingNext(skip = false) {
  const s = STEPS[step];
  if (!skip && s.id === 'basics') {
    if (!draft.name.trim()) return invalid('name', 'איך קוראים לך?');
    if (draft.born && (new Date().getFullYear() - draft.born < 16 || new Date().getFullYear() - draft.born > 80)) return invalid('age', 'הגיל לא נראה נכון');
  }
  if (step < STEPS.length - 1) {
    step++;
    saveDraft();
    window.scrollTo(0, 0);
    return renderOnboarding();
  }
  const btn = $('[data-act="onb-next"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    const out = await api.register({ profile: draft, photo: draftPhoto || undefined });
    sess = { id: out.id, token: out.token };
    saveSession(sess);
    me = out.me;
    store.del('hekerut.draft');
    draft = null;
    draftPhoto = undefined;
    confetti();
    haptic(30);
    const pending = store.get('hekerut.pending');
    if (pending) {
      store.del('hekerut.pending');
      location.hash = `c/${pending.id}.${pending.key}`;
    } else {
      location.hash = 'home';
      setTimeout(() => openScan('mine', true), 700);
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'יצירת הפרופיל';
    toast(errorText(e), 'close');
  }
}

function invalid(field, msg) {
  const el = document.querySelector(`[data-err="${field}"]`);
  if (el) { el.textContent = msg; el.closest('.field')?.classList.add('shake'); setTimeout(() => el.closest('.field')?.classList.remove('shake'), 500); }
  haptic(20);
}

// ---------- Profile form (shared by onboarding and edit) ----------

const datalist = (id, items) => `<datalist id="${id}">${items.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
const field = (label, inner, { err = '', hint = '' } = {}) => `<label class="field"><span class="f-label">${label}</span>${inner}${hint ? `<small class="f-hint">${hint}</small>` : ''}${err ? `<small class="f-err" data-err="${err}"></small>` : ''}</label>`;
const input = (path, value, attrs = '') => `<input class="inp" data-f="${path}" value="${esc(value)}" ${attrs}>`;
const chips = (path, value, options) => `<div class="chips" role="radiogroup">${options.map(([v, l]) => `<button type="button" class="chip ${v === value ? 'on' : ''}" data-chip="${path}" data-v="${v}" role="radio" aria-checked="${v === value}">${l}</button>`).join('')}</div>`;

function monthPicker(path, value) {
  const [y, m] = (value || '').split('-');
  const now = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => now + 1 - i);
  return `<div class="month-pick" data-month="${path}">
    <select class="inp" data-part="m" aria-label="חודש"><option value="">חודש</option>${MONTHS.map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${+m === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <select class="inp" data-part="y" aria-label="שנה"><option value="">שנה</option>${years.map(n => `<option ${+y === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
  </div>`;
}

function sectionHtml(id, p) {
  if (id === 'basics') {
    const photo = draftPhoto === undefined ? (p === draft ? null : me?.photo) : draftPhoto;
    return `
      <div class="photo-pick">
        <label class="photo-btn">${photo ? `<img src="${esc(photo)}" alt="">` : `<span class="photo-empty">${icon('camera')}</span>`}
          <input type="file" accept="image/*" data-photo hidden>
          <span class="photo-plus">${icon(photo ? 'edit' : 'plus')}</span>
        </label>
        <div><b>תמונת פרופיל</b><small>לא חובה, אבל עוזר לזהות אותך</small>${photo ? '<button type="button" class="link-btn" data-act="photo-remove">הסרה</button>' : ''}</div>
      </div>
      ${field('שם', input('name', p.name, 'placeholder="שם פרטי ומשפחה" maxlength="40" autocomplete="name"'), { err: 'name' })}
      ${field('איך לפנות אליך?', chips('g', p.g, [['m', 'אליו'], ['f', 'אליה'], ['x', 'לא משנה']]))}
      <div class="row2">
        ${field('גיל', `<input class="inp" type="number" inputmode="numeric" min="16" max="80" data-age value="${p.born ? new Date().getFullYear() - p.born : ''}" placeholder="21">`, { err: 'age' })}
        ${field('מאיפה?', input('city', p.city, 'list="dl-city" placeholder="עיר / יישוב" maxlength="40"'))}
      </div>
      ${datalist('dl-city', CITIES)}`;
  }
  if (id === 'prep') {
    return `
      ${field('עשית מכינה או שנת שירות?', chips('prep.kind', p.prep.kind, [['none', 'לא'], ['mechina', 'מכינה'], ['year', 'שנת שירות']]))}
      <div class="reveal ${p.prep.kind === 'none' ? '' : 'open'}">
        ${field(p.prep.kind === 'year' ? 'איפה?' : 'איזו מכינה?', input('prep.name', p.prep.name, `list="dl-prep" maxlength="40" placeholder="${p.prep.kind === 'year' ? 'למשל: שנת שירות בצופים' : 'למשל: מכינת רבין'}"`))}
      </div>
      ${datalist('dl-prep', p.prep.kind === 'year' ? YEARS : MECHINOT)}`;
  }
  if (id === 'service') {
    const c = CORPS[p.unit.corps];
    const showRelease = p.status === 'released' || p.status === 'reserve';
    let levels = '';
    if (c) {
      for (let i = 0; i < c.levels.length; i++) {
        const open = i === 0 || p.unit.path[i - 1] || p.unit.path[i];
        const sugg = c.sugg[i] || [];
        levels += `<div class="lvl reveal ${open ? 'open' : ''}" style="--i:${i}">
          ${field(`<span class="lvl-n">${i + 1}</span>${c.levels[i]}`, input(`unit.path.${i}`, p.unit.path[i] || '', `maxlength="40" ${sugg.length ? `list="dl-l${i}"` : ''} placeholder="${i ? 'לא חובה' : ''}"`))}
          ${sugg.length ? datalist(`dl-l${i}`, sugg) : ''}
        </div>`;
      }
    }
    return `
      ${field('איפה את/ה היום?', chips('status', p.status, Object.entries(STATUS).map(([k, v]) => [k, v[p.g] || v.m])))}
      <div class="row2">
        ${field('גיוס', monthPicker('draft', p.draft))}
        ${showRelease ? field('שחרור', monthPicker('release', p.release)) : '<span></span>'}
      </div>
      ${field('חיל / זרוע', `<div class="corps">${Object.entries(CORPS).map(([k, v]) => `<button type="button" class="corps-chip ${k === p.unit.corps ? 'on' : ''}" data-corps="${k}">${v.name}</button>`).join('')}</div>`)}
      ${c ? `<div class="levels"><div class="levels-head">${icon('shield')}<span>היחידה שלך ב${c.name}</span></div>${levels}</div>` : ''}
      <p class="note">${icon('lock')}<span>רק מה שמותר לספר. בלי שמות של יחידות מסווגות, מספר אישי או מיקומים.</span></p>`;
  }
  if (id === 'path') {
    const roles = p.roles.length ? p.roles : [];
    return `
      ${field('איפה עשית טירונות?', input('tironut', p.tironut, 'list="dl-tir" maxlength="40" placeholder="למשל: שיזפון"'))}
      ${datalist('dl-tir', TIRONUT)}
      <div class="field"><span class="f-label">תפקידים וקורסים</span>
        <div class="roles">${roles.map((r, i) => `
          <div class="role-row" style="--i:${i}">
            <span class="role-dot ${r.to ? '' : 'now'}"></span>
            <input class="inp" data-f="roles.${i}.t" value="${esc(r.t)}" list="dl-role" maxlength="40" placeholder="תפקיד או קורס">
            <div class="role-years">
              <input class="inp yr" data-f="roles.${i}.from" value="${esc(r.from)}" inputmode="numeric" maxlength="4" placeholder="משנה">
              <span>–</span>
              <input class="inp yr" data-f="roles.${i}.to" value="${esc(r.to)}" inputmode="numeric" maxlength="4" placeholder="היום">
            </div>
            <button type="button" class="icon-btn sm" data-role-del="${i}" aria-label="מחיקה">${icon('close')}</button>
          </div>`).join('')}
        </div>
        ${roles.length < 12 ? `<button type="button" class="add-row" data-act="role-add">${icon('plus')}<span>${roles.length ? 'עוד תפקיד או קורס' : 'הוספת תפקיד'}</span></button>` : ''}
        <small class="f-hint">השאירו את ״עד״ ריק בתפקיד של היום</small>
      </div>
      ${datalist('dl-role', ROLES)}`;
  }
  if (id === 'bio') {
    return `
      ${field('משפט עליך', `<textarea class="inp" data-f="bio" maxlength="120" rows="3" placeholder="למשל: קפה שחור, טיולים בגולן, ומחלקה 2 לנצח">${esc(p.bio)}</textarea>`, { hint: '<span data-count>' + p.bio.length + '</span>/120' })}
      ${field('מי רואה את כל המסלול?', chips('vis', p.vis, [['met', 'מי שהכרתי'], ['all', 'כולם']]), { hint: p.vis === 'all' ? 'כל מי שבאפליקציה יראה את כל הפרטים.' : 'מי שסורק את הקוד שלך או שאת/ה עוקב/ת אחריו. אחרים רואים רק שם, חיל ותפקיד.' })}`;
  }
  return '';
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function formModel() { return route().name === 'edit' ? editDraft : draft; }
function rerenderSection(id) {
  const form = $('#pform');
  if (!form) return;
  const sec = form.querySelector(`[data-sec="${id}"]`);
  const html = sectionHtml(id, formModel());
  if (sec) sec.innerHTML = html; else form.innerHTML = html;
}
const sectionOf = el => el.closest('[data-sec]')?.dataset.sec || STEPS[step].id;

async function readPhoto(file) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const size = 360;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
  URL.revokeObjectURL(img.src);
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length < 88 * 1024) return url;
  }
  throw Object.assign(new Error('photo'), { code: 'photo' });
}

// ---------- Home ----------

async function renderHome(seq) {
  const draw = feed => {
    const f = feed || { stories: [], suggestions: [], events: [] };
    const friends = me.counts.friends;
    page(`
      <header class="topbar home-top">
        ${wordmark()}
        <div class="tb-actions">
          ${demo ? '<span class="demo-pill">הדגמה</span>' : ''}
          <button class="icon-btn" data-act="search" aria-label="חיפוש">${icon('search')}</button>
        </div>
      </header>
      <section class="stories" aria-label="חברים">
        <button class="story mine" data-act="code">${avatar(me, 'l', { ring: true })}<span class="story-plus">${icon('qr')}</span><small>הקוד שלי</small></button>
        ${feed ? f.stories.map((p, i) => `<button class="story" data-story="${p.id}" style="--i:${i}">${avatar(p, 'l', { ring: true })}<small>${esc(p.name.split(' ')[0])}</small></button>`).join('')
          : '<span class="story sk"></span>'.repeat(4)}
      </section>
      ${friends < 3 ? `
      <section class="hero-card">
        <div class="hc-glow"></div>
        <div class="hc-icons"><span>${icon('qr')}</span><span>${icon('people')}</span></div>
        <h2>הכרת מישהו חדש?</h2>
        <p>במקום להסביר שוב את כל המסלול, תנו לו לסרוק את הקוד. הוא יראה מאיפה אתם, מה עשיתם ומי משותף לכם.</p>
        <div class="hc-btns"><button class="btn primary" data-act="code">${icon('qr')}<span>הקוד שלי</span></button><button class="btn glass" data-act="scan">${icon('scan')}<span>סריקה</span></button></div>
      </section>` : ''}
      <section class="sec">
        <div class="sec-head"><h2>אולי מכירים</h2><span class="muted">לפי יחידה, מכינה וחברים</span></div>
        <div class="sugg-rail">${feed ? (f.suggestions.length ? f.suggestions.map((p, i) => suggestionCard(p, i)).join('') : `<div class="rail-empty">${icon('sparkle')}<span>ככל שתתחברו ליותר אנשים, נמצא לכם עוד מכרים</span></div>`)
          : '<div class="sugg sk"></div>'.repeat(3)}</div>
      </section>
      <section class="sec">
        <div class="sec-head"><h2>הכרטיס שלך</h2><button class="link-btn" data-act="story-me">${icon('play')}<span>כך רואים אותך</span></button></div>
        ${myCard()}
      </section>
      ${feed && f.events.length ? `
      <section class="sec">
        <div class="sec-head"><h2>לאחרונה</h2><button class="link-btn" data-go="activity">הכל</button></div>
        <div class="list">${f.events.slice(0, 3).map(eventRow).join('')}</div>
      </section>` : ''}
      <div class="foot-space"></div>`, 'home');
  };
  draw(cache.feed);
  try {
    const feed = await api.feed(sess);
    if (seq !== renderSeq) return;
    cache.feed = feed;
    if (me.unread) me.unread = 0;
    draw(feed);
  } catch (e) { if (!cache.feed) toast(errorText(e), 'close'); }
}

function suggestionCard(p, i) {
  return `<article class="sugg" style="--i:${i}" data-open="${p.id}">
    ${avatar(p, 'l')}
    <b>${esc(p.name)}</b>
    <small>${esc(headline(p) || ageLine(p))}</small>
    <span class="reason">${icon(p.mutualCount ? 'people' : 'sparkle')}${esc(p.reason)}</span>
    ${followBtn(p, 'sm')}
  </article>`;
}

function myCard() {
  const p = me.profile;
  const chain = unitChain(p);
  return `<article class="mycard" data-act="code">
    <div class="mc-top">${avatar(me, 'm')}<div><b>${esc(p.name)}</b><small>${esc(ageLine(me))}</small></div><span class="status-pill">${esc(statusLabel(p))}</span></div>
    <div class="mc-path">
      ${p.prep.kind !== 'none' ? `<span class="mc-step">${icon('tent')}${esc(p.prep.name || PREP[p.prep.kind])}</span>` : ''}
      ${p.tironut ? `<span class="mc-step">${icon('flag')}${esc(p.tironut)}</span>` : ''}
      ${p.unit.corps ? `<span class="mc-step">${icon('shield')}${esc([CORPS[p.unit.corps].name, ...chain.slice(0, 2).map(x => x.text)].join(' · '))}</span>` : ''}
      ${currentRole(p) ? `<span class="mc-step">${icon('badge')}${esc(currentRole(p).t)}</span>` : ''}
    </div>
    <div class="mc-stats"><span><b>${me.counts.friends}</b> חברים</span><span><b>${me.counts.followers}</b> עוקבים</span><span class="mc-qr">${icon('qr')}</span></div>
  </article>`;
}

// ---------- Follow button ----------

function followBtn(p, size = '') {
  const r = p.rel || {};
  if (r.self) return '';
  let label, cls;
  if (r.friends) { label = `${icon('check')}<span>חברים</span>`; cls = 'soft'; }
  else if (r.following) { label = '<span>במעקב</span>'; cls = 'soft'; }
  else if (r.followsMe) { label = '<span>לעקוב בחזרה</span>'; cls = 'primary'; }
  else { label = '<span>לעקוב</span>'; cls = 'primary'; }
  return `<button class="btn ${cls} ${size} follow" data-follow="${p.id}" data-state="${r.following ? 'on' : 'off'}">${label}</button>`;
}

async function toggleFollow(btn) {
  const id = btn.dataset.follow;
  const on = btn.dataset.state === 'on';
  if (on) {
    const name = btn.closest('[data-name]')?.dataset.name || '';
    const ok = await actionSheet(name ? `להפסיק לעקוב אחרי ${name}?` : 'להפסיק לעקוב?', [{ id: 'yes', label: 'הפסקת מעקב', danger: true }]);
    if (ok !== 'yes') return;
  }
  btn.disabled = true;
  haptic(on ? 8 : 18);
  try {
    const key = btn.dataset.key || '';
    const rel = on ? await api.unfollow(sess, id) : await api.follow(sess, id, key);
    updateRel(id, rel);
    if (!on) { btn.classList.add('pop'); if (rel.friends) toast('אתם חברים עכשיו', 'heart'); }
    me = await api.me(sess).catch(() => me);
  } catch (e) {
    toast(errorText(e), 'close');
  }
  btn.disabled = false;
}

// Refreshes every follow button and cached copy of this person after a change.
function updateRel(id, rel) {
  const fix = list => list?.forEach(p => { if (p.id === id) p.rel = { ...rel }; });
  if (cache.feed) { fix(cache.feed.suggestions); cache.feed.events.forEach(e => { if (e.actor.id === id) e.actor.rel = { ...rel }; }); }
  Object.values(cache.lists).forEach(fix);
  fix(ui.results);
  if (cache.views[id]) cache.views[id].rel = { ...rel };
  document.querySelectorAll(`[data-follow="${id}"]`).forEach(b => {
    const tmp = document.createElement('div');
    tmp.innerHTML = followBtn({ id, rel }, b.classList.contains('sm') ? 'sm' : b.classList.contains('big') ? 'big' : '');
    const nb = tmp.firstElementChild;
    if (b.dataset.key) nb.dataset.key = b.dataset.key;
    b.replaceWith(nb);
  });
}

// ---------- People ----------

async function renderPeople(seq) {
  const kinds = [['friends', 'חברים'], ['followers', 'עוקבים'], ['following', 'במעקב']];
  const draw = () => {
    const list = cache.lists[`${me.id}:${ui.peopleTab}`];
    const searching = ui.query.trim().length >= 2;
    page(`
      ${topbar('אנשים')}
      <div class="search-box">${icon('search')}<input class="inp" id="q" type="search" placeholder="חיפוש לפי שם, יחידה או מכינה" value="${esc(ui.query)}" enterkeyhint="search"></div>
      ${searching ? `<div class="list" id="results">${resultsHtml()}</div>` : `
      <div class="seg" role="tablist">${kinds.map(([k, l]) => `<button role="tab" class="seg-b ${k === ui.peopleTab ? 'on' : ''}" data-ptab="${k}">${l} <span>${me.counts[k]}</span></button>`).join('')}<span class="seg-pill" style="--n:${kinds.findIndex(k => k[0] === ui.peopleTab)}"></span></div>
      <div class="list">${list ? (list.length ? list.map((p, i) => personRow(p, i, ui.peopleTab === 'followers')).join('') : emptyPeople()) : skeletonRows(4)}</div>`}
      <div class="foot-space"></div>`, 'people');
  };
  draw();
  if (ui.query.trim().length >= 2) return;
  try {
    const list = await api.list(sess, me.id, ui.peopleTab);
    if (seq !== renderSeq) return;
    cache.lists[`${me.id}:${ui.peopleTab}`] = list;
    const box = $view.querySelector('.list');
    if (box && ui.query.trim().length < 2) box.innerHTML = list.length ? list.map((p, i) => personRow(p, i, ui.peopleTab === 'followers')).join('') : emptyPeople();
  } catch (e) { toast(errorText(e), 'close'); }
}

const resultsHtml = () => (ui.results === null ? skeletonRows(3) : ui.results.length ? ui.results.map((p, i) => personRow(p, i)).join('') : `<div class="empty-mini">${icon('search')}<span>לא מצאנו. נסו שם אחר, או סרקו את הקוד שלו</span></div>`);

function emptyPeople() {
  const t = { friends: ['עוד אין חברים', 'כשתעקבו אחד אחרי השני, תהיו חברים.'], followers: ['עוד אין עוקבים', 'שתפו את הקוד שלכם עם מי שהכרתם.'], following: ['עוד לא עוקבים אחרי אף אחד', 'סרקו קוד או חפשו לפי שם.'] }[ui.peopleTab];
  return `<div class="empty-state small">${icon('people')}<h2>${t[0]}</h2><p>${t[1]}</p><button class="btn primary" data-act="scan">${icon('scan')}<span>סריקת קוד</span></button></div>`;
}

const skeletonRows = n => '<div class="row sk"><span class="av av-m"></span><div><i></i><i></i></div></div>'.repeat(n);

function personRow(p, i = 0, canRemove = false) {
  return `<div class="row" style="--i:${i}" data-open="${p.id}" data-name="${esc(p.name)}">
    ${avatar(p, 'm')}
    <div class="row-text"><b>${esc(p.name)}</b><small>${esc(headline(p) || ageLine(p))}</small></div>
    ${followBtn(p, 'sm')}
    ${canRemove ? `<button class="icon-btn sm" data-remove-follower="${p.id}" aria-label="הסרת עוקב">${icon('close')}</button>` : ''}
  </div>`;
}

let searchTimer;
function onSearch(value) {
  ui.query = value;
  clearTimeout(searchTimer);
  const searching = value.trim().length >= 2;
  const res = $('#results');
  if (!searching || !res) {
    if (searching) ui.results = null;
    if (!!res !== searching) { renderPeople(renderSeq).then(() => { const q = $('#q'); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }); }
    if (!searching) return;
  }
  searchTimer = setTimeout(async () => {
    try {
      ui.results = await api.search(sess, value);
      const r = $('#results');
      if (r && ui.query === value) r.innerHTML = resultsHtml();
    } catch (e) { toast(errorText(e), 'close'); }
  }, 220);
}

// ---------- Activity ----------

function eventText(e) {
  const a = e.actor;
  const n = `<b>${esc(a.name)}</b>`;
  const you = gen(me.profile, 'אחריך', 'אחרייך', 'אחריך');
  if (e.kind === 'scan') return `${n} ${gen(a, 'סרק', 'סרקה')} את הקוד שלך ${gen(a, 'ועוקב', 'ועוקבת')} ${you}`;
  if (e.kind === 'friend') return `${n} ${gen(a, 'עקב', 'עקבה')} ${you} בחזרה. אתם חברים עכשיו`;
  if (e.kind === 'role') return `${n} ${gen(a, 'התחיל', 'התחילה')} תפקיד חדש: <b>${esc(e.data?.t)}</b>`;
  return `${n} ${gen(a, 'התחיל', 'התחילה')} לעקוב ${you}`;
}
const EVENT_ICON = { scan: 'qr', friend: 'heart', role: 'badge', follow: 'user' };

function eventRow(e, i = 0) {
  return `<div class="row ev ${e.read ? '' : 'unread'}" style="--i:${i}" data-open="${e.actor.id}" data-name="${esc(e.actor.name)}">
    <span class="ev-av">${avatar(e.actor, 'm')}<span class="ev-ic k-${e.kind}">${icon(EVENT_ICON[e.kind] || 'user')}</span></span>
    <div class="row-text"><span>${eventText(e)}</span><small>${timeAgo(e.at)}</small></div>
    ${e.kind !== 'role' && !e.actor.rel?.following ? followBtn(e.actor, 'sm') : ''}
  </div>`;
}

async function renderActivity(seq) {
  const draw = feed => {
    const ev = feed?.events;
    const fresh = ev?.filter(e => Date.now() - e.at < 7 * 86400e3) || [];
    const older = ev?.filter(e => Date.now() - e.at >= 7 * 86400e3) || [];
    page(`
      ${topbar('פעילות')}
      ${!ev ? `<div class="list">${skeletonRows(5)}</div>` : !ev.length ? `<div class="empty-state">${icon('bell')}<h2>שקט כאן בינתיים</h2><p>כשמישהו יסרוק את הקוד שלך, יעקוב אחריך או יתחיל תפקיד חדש, זה יופיע כאן.</p><button class="btn primary" data-act="code">${icon('qr')}<span>הקוד שלי</span></button></div>` : `
        ${fresh.length ? `<h3 class="list-title">השבוע</h3><div class="list">${fresh.map(eventRow).join('')}</div>` : ''}
        ${older.length ? `<h3 class="list-title">קודם</h3><div class="list">${older.map(eventRow).join('')}</div>` : ''}`}
      <div class="foot-space"></div>`, 'activity');
  };
  draw(cache.feed);
  try {
    const feed = await api.feed(sess);
    if (seq !== renderSeq) return;
    cache.feed = feed;
    me.unread = 0;
    draw(feed);
  } catch (e) { toast(errorText(e), 'close'); }
}

// ---------- Profile ----------

async function renderProfile(id, seq = renderSeq) {
  const mine = id === me.id;
  const draw = v => page(profileHtml(v, mine), mine ? 'me' : 'none');
  if (mine) draw({ person: me, level: 'full', rel: { self: true }, counts: me.counts, mutual: [], mutualCount: 0, common: [] });
  else if (cache.views[id]) draw(cache.views[id]);
  else page(`${topbar('', { back: true })}<div class="prof-sk"><span class="av av-xl sk"></span><i></i><i></i><i></i></div>`, 'none');
  try {
    if (mine) {
      me = await api.me(sess);
      if (seq === renderSeq && route().name === 'me') draw({ person: me, level: 'full', rel: { self: true }, counts: me.counts, mutual: [], mutualCount: 0, common: [] });
    } else {
      const v = await api.view(sess, id, keyFor(id));
      cache.views[id] = v;
      if (seq === renderSeq) draw(v);
    }
  } catch (e) {
    if (seq === renderSeq && !mine) page(`${topbar('', { back: true })}<div class="empty-state">${icon('user')}<h2>לא הצלחנו לפתוח</h2><p>${esc(errorText(e))}</p></div>`, 'none');
  }
}

// The QR key of someone scanned in this session, so their full path stays open until following settles.
const keys = new Map();
const keyFor = id => keys.get(id) || '';

function profileHtml(v, mine) {
  const p = v.person;
  const full = v.level === 'full';
  const prof = full ? p.profile : null;
  const firstName = esc(p.name.split(' ')[0]);
  return `
    ${topbar(mine ? esc(p.name) : '', { back: !mine, actions: mine ? `<button class="icon-btn" data-go="settings" aria-label="הגדרות">${icon('gear')}</button>` : `<button class="icon-btn" data-story="${p.id}" aria-label="המסלול כסטורי">${icon('play')}</button>` })}
    <section class="prof" data-name="${esc(p.name)}">
      <div class="prof-head">
        <button class="prof-av" data-story="${p.id}" aria-label="המסלול כסטורי">${avatar(p, 'xl', { ring: true })}</button>
        <div class="stats">
          ${[['friends', 'חברים'], ['followers', 'עוקבים'], ['following', 'במעקב']].map(([k, l]) => `<button class="stat" data-list="${k}" data-of="${p.id}" ${full ? '' : 'disabled'}><b>${v.counts[k]}</b><small>${l}</small></button>`).join('')}
        </div>
      </div>
      <h2 class="prof-name">${esc(p.name)}</h2>
      <div class="prof-meta">${esc(ageLine(p))}${p.status ? `<span class="status-pill">${esc(statusLabel(prof || p))}</span>` : ''}</div>
      ${prof?.bio ? `<p class="bio">${esc(prof.bio)}</p>` : ''}
      <div class="prof-btns">
        ${mine ? `<button class="btn soft" data-go="edit">${icon('edit')}<span>עריכה</span></button><button class="btn primary" data-act="code">${icon('qr')}<span>הקוד שלי</span></button>`
          : `${followBtn(p.rel ? p : { ...p, rel: v.rel }, 'big')}<button class="btn soft big" data-story="${p.id}">${icon('play')}<span>המסלול</span></button>`}
      </div>
      ${!mine && v.mutualCount ? mutualHtml(v) : ''}
      ${!mine && v.common.length ? `
        <div class="common">
          <h3>${icon('sparkle')}מה משותף לכם</h3>
          <div class="common-list">${v.common.map((c, i) => `<div class="cg" style="--i:${i}"><b>${esc(c.title)}</b>${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</div>`).join('')}</div>
        </div>` : ''}
    </section>
    <section class="path">
      <h3 class="path-title">${mine ? 'המסלול שלי' : `המסלול של ${firstName}`}</h3>
      ${full ? pathHtml(prof) : lockedPath(p)}
    </section>
    <div class="foot-space"></div>`;
}

function mutualHtml(v) {
  const names = v.mutual.slice(0, 2).map(m => esc(m.name.split(' ')[0]));
  const rest = v.mutualCount - names.length;
  return `<button class="mutual" data-mutual="${v.person.id}">
    <span class="stack">${v.mutual.slice(0, 3).map(m => avatar(m, 's')).join('')}</span>
    <span>${v.mutualCount === 1 ? 'מכירים משותפים: ' : 'מכירים משותפים: '}<b>${names.join(', ')}</b>${rest > 0 ? ` ועוד <b>${rest}</b>` : ''}</span>
    ${icon('chevron')}
  </button>`;
}

function pathHtml(p) {
  const items = [];
  if (p.prep.kind !== 'none') items.push({ ic: 'tent', k: PREP[p.prep.kind], t: p.prep.name || PREP[p.prep.kind] });
  if (p.draft || p.release) items.push({ ic: 'calendar', k: 'גיוס', t: [monthLabel(p.draft) && `גיוס ${monthLabel(p.draft)}`, monthLabel(p.release) && `שחרור ${monthLabel(p.release)}`].filter(Boolean).join(' · ') });
  if (p.tironut) items.push({ ic: 'flag', k: 'טירונות', t: p.tironut });
  if (p.unit.corps) {
    const chain = unitChain(p);
    items.push({ ic: 'shield', k: 'היחידה', t: CORPS[p.unit.corps].name, html: chain.length ? `<div class="chain">${chain.map((c, i) => `<span class="link" style="--i:${i}"><small>${esc(c.label.split(' /')[0])}</small>${esc(c.text)}</span>`).join('')}</div>` : '' });
  }
  if (p.roles.length) {
    items.push({ ic: 'badge', k: 'תפקידים וקורסים', t: '', html: `<ol class="roles-view">${p.roles.map(r => `<li class="${r.to ? '' : 'now'}"><b>${esc(r.t)}</b><small>${r.from || ''}${r.from || r.to ? '–' : ''}${r.to || (r.from ? 'היום' : '')}</small>${r.to ? '' : '<span class="now-tag">עכשיו</span>'}</li>`).join('')}</ol>` });
  }
  if (!items.length) return `<div class="empty-mini">${icon('edit')}<span>עוד אין פרטים על השירות</span></div>`;
  return `<ol class="timeline">${items.map((it, i) => `
    <li style="--i:${i}">
      <span class="tl-ic">${icon(it.ic)}</span>
      <div class="tl-body"><small>${it.k}</small>${it.t ? `<b>${esc(it.t)}</b>` : ''}${it.html || ''}</div>
    </li>`).join('')}</ol>`;
}

function lockedPath(p) {
  const bits = [CORPS[p.corps]?.name, p.top, p.prep, p.role].filter(Boolean);
  return `${bits.length ? `<div class="summary-chips">${bits.map(b => `<span>${esc(b)}</span>`).join('')}</div>` : ''}
    <div class="locked">${icon('lock')}<b>שאר המסלול נפתח כשנפגשים</b><p>סרקו את הקוד של ${esc(p.name.split(' ')[0])}, או חכו ש${gen(p, 'הוא', 'היא', 'הוא/היא')} ${gen(p, 'יעקוב', 'תעקוב', 'יעקוב/תעקוב')} אחריכם בחזרה.</p></div>`;
}

// ---------- Edit ----------

let editDraft = null;

function renderEdit() {
  editDraft = structuredClone(me.profile);
  draftPhoto = undefined;
  const sections = [['basics', 'פרטים'], ['prep', 'לפני הצבא'], ['service', 'השירות'], ['path', 'טירונות ותפקידים'], ['bio', 'עליי']];
  page(`
    ${topbar('עריכת פרופיל', { back: true, actions: '<button class="btn primary sm" data-act="save">שמירה</button>' })}
    <form class="form edit" id="pform" autocomplete="off" onsubmit="return false">
      ${sections.map(([id, t]) => `<section class="edit-sec"><h3>${t}</h3><div data-sec="${id}">${sectionHtml(id, editDraft)}</div></section>`).join('')}
    </form>
    <div class="foot-space"></div>`, 'none');
}

async function saveEdit() {
  if (!editDraft.name.trim()) { invalid('name', 'איך קוראים לך?'); $('[data-f="name"]')?.focus(); return; }
  const btn = $('[data-act="save"]');
  btn.disabled = true;
  try {
    me = await api.update(sess, { profile: editDraft, photo: draftPhoto });
    draftPhoto = undefined;
    toast('הפרופיל עודכן');
    haptic(15);
    history.length > 1 ? history.back() : go('me');
  } catch (e) { toast(errorText(e), 'close'); btn.disabled = false; }
}

// ---------- Settings ----------

function renderSettings() {
  const theme = store.get('hekerut.theme', 'auto');
  page(`
    ${topbar('הגדרות', { back: true })}
    <div class="settings">
      <div class="group">
        <div class="set-row"><span>${icon('moon')}מראה</span>${chips('theme', theme, [['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']])}</div>
        <div class="set-row"><span>${icon('eye')}מי רואה את כל המסלול</span>${chips('vis-set', me.profile.vis, [['met', 'מי שהכרתי'], ['all', 'כולם']])}</div>
      </div>
      <div class="group">
        <button class="set-row btnrow" data-act="new-key">${icon('refresh')}<span><b>קוד חדש</b><small>הקוד הישן יפסיק לפתוח את המסלול המלא</small></span></button>
        <button class="set-row btnrow" data-act="transfer">${icon('phone')}<span><b>מעבר לטלפון אחר</b><small>קישור כניסה אישי לחשבון שלך</small></span></button>
      </div>
      ${demo ? `<div class="group"><div class="set-row info">${icon('sparkle')}<span><b>מצב הדגמה</b><small>האפליקציה רצה כרגע בדפדפן הזה בלבד, עם כמה אנשים לדוגמה. כשהשרת יעלה, הקוד שלך יעבוד גם בטלפונים של אחרים.</small></span></div><button class="set-row btnrow" data-act="reset-demo">${icon('refresh')}<span><b>איפוס ההדגמה</b></span></button></div>` : ''}
      <div class="group">
        <button class="set-row btnrow danger" data-act="delete">${icon('trash')}<span><b>מחיקת החשבון</b><small>הפרופיל, העוקבים והפעילות יימחקו לתמיד</small></span></button>
      </div>
      <p class="foot">${wordmark()}<br>גרסה ${APP_VERSION}</p>
    </div>`, 'none');
}

// ---------- Sheets ----------

let sheetClose = null;
function openSheet(html, { cls = '', onClose } = {}) {
  closeSheet(true);
  $overlay.innerHTML = `<div class="backdrop" data-act="sheet-close"></div><div class="sheet ${cls}" role="dialog" aria-modal="true"><span class="grabber"></span>${html}</div>`;
  $overlay.classList.add('open');
  document.body.classList.add('locked');
  sheetClose = onClose || null;
  return $overlay.querySelector('.sheet');
}
function closeSheet(instant = false) {
  if (!$overlay.classList.contains('open')) return;
  const fn = sheetClose;
  sheetClose = null;
  fn?.();
  document.body.classList.remove('locked');
  if (instant) { $overlay.classList.remove('open', 'closing'); $overlay.innerHTML = ''; return; }
  $overlay.classList.add('closing');
  setTimeout(() => { $overlay.classList.remove('open', 'closing'); $overlay.innerHTML = ''; }, 260);
}

function actionSheet(title, options) {
  return new Promise(resolve => {
    const sheet = openSheet(`<div class="actions"><p>${esc(title)}</p>${options.map(o => `<button class="act-b ${o.danger ? 'danger' : ''}" data-choice="${o.id}">${esc(o.label)}</button>`).join('')}<button class="act-b cancel" data-choice="">ביטול</button></div>`, { cls: 'action', onClose: () => resolve(null) });
    sheet.addEventListener('click', e => {
      const b = e.target.closest('[data-choice]');
      if (!b) return;
      sheetClose = null;
      resolve(b.dataset.choice || null);
      closeSheet();
    });
  });
}

async function openList(id, kind) {
  const titles = { friends: 'חברים', followers: 'עוקבים', following: 'במעקב', mutual: 'מכירים משותפים' };
  const sheet = openSheet(`<h2 class="sheet-title">${titles[kind]}</h2><div class="list">${skeletonRows(3)}</div>`, { cls: 'tall' });
  try {
    const list = kind === 'mutual' ? (cache.views[id]?.mutual || []) : await api.list(sess, id, kind);
    if (kind === 'mutual' && cache.views[id]?.mutualCount > list.length) sheet.querySelector('.sheet-title').insertAdjacentHTML('beforeend', ` <small class="muted">${cache.views[id].mutualCount}</small>`);
    const box = sheet.querySelector('.list');
    if (box) box.innerHTML = list.length ? list.map((p, i) => personRow(p.rel ? p : { ...p, rel: {} }, i)).join('') : `<div class="empty-mini">${icon('people')}<span>אין כאן אף אחד עדיין</span></div>`;
  } catch (e) { toast(errorText(e), 'close'); }
}

// ---------- My code and scanning ----------

const codeUrl = () => `${location.origin}${location.pathname}#c/${me.id}.${me.key}`;
let stopScan = null;

function openScan(mode = 'mine', fresh = false) {
  if (!me) return;
  const sheet = openSheet(`
    <div class="seg scan-seg"><button class="seg-b ${mode === 'mine' ? 'on' : ''}" data-mode="mine">הקוד שלי</button><button class="seg-b ${mode === 'scan' ? 'on' : ''}" data-mode="scan">סריקה</button><span class="seg-pill" style="--n:${mode === 'mine' ? 0 : 1}"></span></div>
    <div class="scan-body"></div>`, { cls: 'scan-sheet', onClose: () => { stopScan?.(); stopScan = null; } });
  const body = sheet.querySelector('.scan-body');
  const show = m => {
    stopScan?.(); stopScan = null;
    sheet.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    sheet.querySelector('.seg-pill').style.setProperty('--n', m === 'mine' ? 0 : 1);
    if (m === 'mine') body.innerHTML = codeCard(fresh);
    else startScanView(body);
  };
  sheet.addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) { haptic(); show(b.dataset.mode); } });
  show(mode);
}

function codeCard(fresh) {
  const p = me.profile;
  return `
    ${fresh ? `<div class="fresh">${icon('sparkle')}<span>הפרופיל מוכן! זה הקוד שלך</span></div>` : ''}
    <div class="code-card">
      <div class="cc-glow"></div>
      <div class="cc-head">${avatar(me, 'l', { ring: true })}<div><b>${esc(p.name)}</b><small>${esc(headline(me) || ageLine(me))}</small></div></div>
      <div class="qr-box">${qrSvg(codeUrl())}<span class="qr-logo">${icon('sparkle')}</span></div>
      <p>${gen(p, 'מי שסורק', 'מי שסורקת', 'מי שסורק')} רואה את המסלול שלך ואת המכירים המשותפים</p>
    </div>
    <div class="code-btns">
      <button class="btn primary" data-act="share">${icon('share')}<span>שיתוף קישור</span></button>
      <button class="btn soft" data-act="copy">${icon('copy')}<span>העתקה</span></button>
    </div>
    ${demo ? `<p class="demo-note">${icon('sparkle')}<span>מצב הדגמה: הקוד עובד בטלפון הזה בלבד עד שהשרת עולה.</span></p>` : ''}`;
}

async function startScanView(body) {
  body.innerHTML = `
    <div class="viewfinder">
      <video playsinline muted></video>
      <div class="vf-frame"><i></i><i></i><i></i><i></i><span class="vf-line"></span></div>
      <p class="vf-hint">כוונו אל הקוד של מי שהכרתם</p>
    </div>
    ${demo ? `<button class="btn soft wide" data-act="demo-scan">${icon('sparkle')}<span>נסו עם פרופיל לדוגמה</span></button>` : ''}`;
  const video = body.querySelector('video');
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
    stopScan = await startScanner(video, {
      accept: t => /#c\/[a-z0-9-]+\.[A-Za-z0-9]+/.test(t),
      onCode: t => {
        stopScan?.(); stopScan = null;
        haptic(40);
        const m = t.match(/#c\/([a-z0-9-]+\.[A-Za-z0-9]+)/);
        closeSheet(true);
        location.hash = `c/${m[1]}`;
      },
    });
    if (!$overlay.classList.contains('open')) { stopScan?.(); stopScan = null; }
  } catch {
    body.querySelector('.viewfinder').innerHTML = `<div class="nocam">${icon('camera')}<b>אין גישה למצלמה</b><p>אפשר לסרוק עם אפליקציית המצלמה של הטלפון. הקוד פותח את האפליקציה ישר על הפרופיל.</p></div>`;
  }
}

async function shareCode() {
  const url = codeUrl();
  const text = `${me.profile.name} ב־היכרות בקליק: כל המסלול הצבאי שלי בקליק`;
  if (navigator.share) { try { await navigator.share({ title: 'היכרות בקליק', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copyText(url);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('הקישור הועתק', 'link'); } catch { toast('לא הצלחנו להעתיק', 'close'); }
}

// A scanned code (or a shared link): #c/<id>.<key>
async function openCode(arg) {
  const [id, key] = arg.split('.');
  if (sess && id === sess.id) { location.replace('#me'); return; }
  if (!sess) {
    store.set('hekerut.pending', { id, key });
    try {
      const v = await api.view(null, id, key);
      return renderPreview(v);
    } catch (e) {
      store.del('hekerut.pending');
      return page(`<div class="empty-state">${icon('user')}<h2>הקוד לא נפתח</h2><p>${esc(errorText(e))}</p><button class="btn primary" data-act="home">ליצירת פרופיל</button></div>`, 'none', { cls: 'no-tabs' });
    }
  }
  if (!me) { try { me = await api.me(sess); } catch (e) { return toast(errorText(e), 'close'); } }
  keys.set(id, key);
  try {
    const v = await api.view(sess, id, key);
    cache.views[id] = v;
    history.replaceState(null, '', `#u/${id}`);
    await renderProfile(id);
    showReveal(v, key);
  } catch (e) {
    toast(e.code === 'not_found' ? 'הקוד הזה כבר לא פעיל' : errorText(e), 'close');
    location.replace('#home');
  }
}

// The moment after scanning: who they are, who you both know, and what you share.
function showReveal(v, key) {
  const p = v.person;
  const first = esc(p.name.split(' ')[0]);
  const sheet = openSheet(`
    <div class="reveal-sheet">
      <div class="duo">${avatar(me, 'l', { cls: 'duo-a' })}<span class="duo-spark">${icon('sparkle')}</span>${avatar(p, 'l', { cls: 'duo-b' })}</div>
      <h2>${v.rel.following ? `כבר עוקבים אחרי ${first}` : `נעים להכיר, ${first}!`}</h2>
      <p class="muted">${esc([ageLine(p), headline(p)].filter(Boolean).join(' · '))}</p>
      ${v.mutualCount || v.common.length ? '' : `<p class="rv-first">${icon('sparkle')}<span>עוד אין לכם מכירים משותפים. אתם הראשונים!</span></p>`}
      <div class="rv-stats" ${v.mutualCount || v.common.length ? '' : 'hidden'}>
        <div class="rv-big"><b data-countup="${v.mutualCount}">0</b><small>${v.mutualCount === 1 ? 'מכר משותף' : 'מכירים משותפים'}</small></div>
        <div class="rv-big"><b data-countup="${v.common.length}">0</b><small>דברים משותפים</small></div>
      </div>
      ${v.mutualCount ? `<div class="rv-mutual">${v.mutual.slice(0, 5).map((m, i) => `<span style="--i:${i}">${avatar(m, 'm')}<small>${esc(m.name.split(' ')[0])}</small></span>`).join('')}</div>` : ''}
      ${v.common.length ? `<div class="rv-common">${v.common.slice(0, 4).map((c, i) => `<span style="--i:${i}">${icon('check')}<b>${esc(c.title)}</b>${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</span>`).join('')}</div>` : ''}
      <div class="rv-btns">
        ${v.rel.following ? '' : `<button class="btn primary big" data-connect="${p.id}" data-key="${esc(key)}">${icon('plus')}<span>להתחבר</span></button>`}
        <button class="btn soft big" data-story="${p.id}">${icon('play')}<span>המסלול של ${first}</span></button>
      </div>
    </div>`, { cls: 'reveal-wrap' });
  sheet.querySelectorAll('[data-countup]').forEach(el => countUp(el, +el.dataset.countup));
  if (v.mutualCount || v.common.length) setTimeout(confetti, 350);
}

function countUp(el, to) {
  const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / 900);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function connect(btn) {
  const id = btn.dataset.connect;
  btn.disabled = true;
  try {
    const rel = await api.follow(sess, id, btn.dataset.key);
    updateRel(id, rel);
    haptic(30);
    const p = cache.views[id]?.person;
    toast(rel.friends ? 'אתם חברים עכשיו' : `${gen(me.profile, 'אתה עוקב', 'את עוקבת', 'את/ה עוקב/ת')} אחרי ${p?.name?.split(' ')[0] || ''}`, rel.friends ? 'heart' : 'check');
    closeSheet();
    me = await api.me(sess).catch(() => me);
  } catch (e) { btn.disabled = false; toast(errorText(e), 'close'); }
}

// Someone without a profile opened a shared link: show who it is, then invite them in.
function renderPreview(v) {
  const p = v.person;
  page(`
    <div class="preview">
      <div class="orb o1"></div><div class="orb o2"></div>
      <div class="pv-card">
        ${avatar(p, 'xl', { ring: true })}
        <h1>${esc(p.name)}</h1>
        <p class="muted">${esc(ageLine(p))}</p>
        ${v.level === 'full' ? pathHtml(p.profile) : lockedPath(p)}
      </div>
      <div class="pv-cta">
        <b>${esc(p.name.split(' ')[0])} ${gen(p, 'רוצה', 'רוצה')} להכיר!</b>
        <p>צרו פרופיל בדקה, ותראו מה משותף לכם ומי אתם מכירים ביחד.</p>
        <button class="btn primary big" data-act="start">יצירת פרופיל</button>
      </div>
    </div>`, 'none', { cls: 'no-tabs' });
}

// ---------- Story ----------

let storyState = null;

function storySlides(v) {
  const p = v.person;
  const full = v.level === 'full';
  const pr = full ? p.profile : null;
  const self = v.rel?.self;
  const slides = [];
  slides.push({ bg: 's1', html: `${avatar(p, 'xxl', { ring: true })}<small class="eyebrow">נעים מאוד</small><h2>${esc(p.name)}</h2><p>${esc(ageLine(p))}</p>${p.status ? `<span class="status-pill big">${esc(statusLabel(pr || p))}</span>` : ''}${pr?.bio ? `<blockquote>${esc(pr.bio)}</blockquote>` : ''}` });
  const prep = pr ? (pr.prep.kind !== 'none' ? pr.prep.name || PREP[pr.prep.kind] : '') : p.prep;
  if (prep) slides.push({ bg: 's2', html: `<span class="s-ic">${icon('tent')}</span><small class="eyebrow">לפני הצבא</small><h2>${esc(prep)}</h2><p>${pr ? PREP[pr.prep.kind] : ''}</p>` });
  if (pr && (pr.tironut || pr.draft)) slides.push({ bg: 's3', html: `<span class="s-ic">${icon('flag')}</span><small class="eyebrow">ההתחלה</small><h2>${pr.tironut ? `טירונות ב${esc(pr.tironut)}` : `גיוס ${esc(monthLabel(pr.draft))}`}</h2><p>${pr.tironut && pr.draft ? `גיוס ${esc(monthLabel(pr.draft))}` : ''}${pr.release ? ` · שחרור ${esc(monthLabel(pr.release))}` : ''}</p>` });
  const corps = CORPS[pr?.unit.corps || p.corps];
  if (corps) {
    const chain = pr ? unitChain(pr) : p.top ? [{ label: corps.levels[0], text: p.top }] : [];
    slides.push({ bg: 's4', html: `<span class="s-ic">${icon('shield')}</span><small class="eyebrow">היחידה</small><h2>${esc(corps.name)}</h2><div class="s-chain">${chain.map((c, i) => `<span style="--i:${i}"><small>${esc(c.label.split(' /')[0])}</small>${esc(c.text)}</span>`).join('')}</div>` });
  }
  const roles = pr ? pr.roles : p.role ? [{ t: p.role }] : [];
  if (roles.length) slides.push({ bg: 's5', html: `<span class="s-ic">${icon('badge')}</span><small class="eyebrow">התפקידים</small><ol class="s-roles">${roles.map((r, i) => `<li style="--i:${i}" class="${r.to ? '' : 'now'}"><b>${esc(r.t)}</b><small>${r.from ? `${r.from}–${r.to || 'היום'}` : ''}</small></li>`).join('')}</ol>` });
  if (!self && (v.common.length || v.mutualCount)) {
    slides.push({ bg: 's6', html: `<span class="s-ic">${icon('sparkle')}</span><small class="eyebrow">ביניכם</small><h2>${v.common.length ? 'מה משותף לכם' : 'מכירים משותפים'}</h2>
      ${v.common.length ? `<div class="s-common">${v.common.slice(0, 4).map((c, i) => `<span style="--i:${i}"><b>${esc(c.title)}</b>${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</span>`).join('')}</div>` : ''}
      ${v.mutualCount ? `<div class="s-mutual"><span class="stack">${v.mutual.slice(0, 4).map(m => avatar(m, 's')).join('')}</span><span>${v.mutualCount} מכירים משותפים</span></div>` : ''}` });
  }
  if (!self) slides.push({ bg: 's1', html: `${avatar(p, 'xl', { ring: true })}<h2>${v.rel?.following ? 'כבר מחוברים' : 'להתחבר?'}</h2>${!full ? `<p>${icon('lock')} חלק מהפרטים נפתחים רק אחרי שנפגשים</p>` : ''}<div class="s-cta" data-name="${esc(p.name)}">${followBtn({ ...p, rel: v.rel }, 'big')}</div>`, end: true });
  return slides;
}

async function openStory(id) {
  let v;
  if (id === me.id) v = { person: me, level: 'full', rel: { self: true }, counts: me.counts, mutual: [], mutualCount: 0, common: [] };
  else v = cache.views[id] || await api.view(sess, id, keyFor(id)).catch(e => { toast(errorText(e), 'close'); return null; });
  if (!v) return;
  cache.views[id] = cache.views[id] || v;
  const slides = storySlides(v);
  closeSheet(true);
  const el = document.createElement('div');
  el.className = 'story-view';
  el.innerHTML = `
    <div class="sv-bars">${slides.map(() => '<span><i></i></span>').join('')}</div>
    <div class="sv-top">${avatar(v.person, 's')}<b>${esc(v.person.name)}</b><button class="icon-btn" data-sv="close" aria-label="סגירה">${icon('close')}</button></div>
    <div class="sv-stage"></div>
    <button class="sv-tap prev" data-sv="prev" aria-label="הקודם"></button>
    <button class="sv-tap next" data-sv="next" aria-label="הבא"></button>`;
  document.body.append(el);
  document.body.classList.add('locked');
  requestAnimationFrame(() => el.classList.add('open'));
  storyState = { el, slides, i: -1, timer: 0, t0: 0, paused: false, left: 0, id };
  showSlide(0);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-sv]');
    if (b?.dataset.sv === 'close') return closeStory();
    if (e.target.closest('[data-follow]')) return;
    if (b?.dataset.sv === 'next') return showSlide(storyState.i + 1);
    if (b?.dataset.sv === 'prev') return showSlide(storyState.i - 1);
  });
  const hold = on => { if (!storyState) return; on ? pauseStory() : resumeStory(); };
  el.addEventListener('pointerdown', e => { if (e.target.closest('.sv-tap')) storyState.downAt = Date.now(), hold(true); });
  el.addEventListener('pointerup', () => hold(false));
  el.addEventListener('pointercancel', () => hold(false));
}

const SLIDE_MS = 4800;
function showSlide(i) {
  const s = storyState;
  if (!s) return;
  if (s.downAt && Date.now() - s.downAt > 350) { s.downAt = 0; return; }
  s.downAt = 0;
  if (i < 0) i = 0;
  if (i >= s.slides.length) return closeStory();
  s.i = i;
  const slide = s.slides[i];
  const stage = s.el.querySelector('.sv-stage');
  stage.className = `sv-stage ${slide.bg}`;
  stage.innerHTML = `<div class="slide">${slide.html}</div>`;
  s.el.classList.toggle('at-end', !!slide.end);
  s.el.querySelectorAll('.sv-bars span').forEach((b, k) => {
    b.className = k < i ? 'done' : k === i ? 'run' : '';
    b.firstElementChild.style.animationDuration = `${SLIDE_MS}ms`;
  });
  clearTimeout(s.timer);
  s.left = SLIDE_MS;
  s.t0 = Date.now();
  if (!slide.end) s.timer = setTimeout(() => showSlide(s.i + 1), SLIDE_MS);
  else s.el.querySelector('.sv-bars .run')?.classList.replace('run', 'done');
}
function pauseStory() {
  const s = storyState;
  if (!s || s.paused) return;
  s.paused = true;
  clearTimeout(s.timer);
  s.left -= Date.now() - s.t0;
  s.el.classList.add('paused');
}
function resumeStory() {
  const s = storyState;
  if (!s || !s.paused) return;
  s.paused = false;
  s.t0 = Date.now();
  s.el.classList.remove('paused');
  if (!s.slides[s.i].end) s.timer = setTimeout(() => showSlide(s.i + 1), Math.max(200, s.left));
}
function closeStory() {
  const s = storyState;
  if (!s) return;
  clearTimeout(s.timer);
  storyState = null;
  s.el.classList.remove('open');
  document.body.classList.remove('locked');
  setTimeout(() => s.el.remove(), 300);
}

// ---------- Moving to another phone ----------

function showTransfer() {
  const url = `${location.origin}${location.pathname}#login/${sess.id}.${sess.token}`;
  openSheet(`
    <h2 class="sheet-title">מעבר לטלפון אחר</h2>
    <p class="muted center">סרקו את הקוד עם הטלפון החדש. זה קוד כניסה לחשבון שלך, אל תשתפו אותו עם אף אחד.</p>
    <div class="qr-box solo">${qrSvg(url)}</div>
    <button class="btn soft wide" data-copy-login="${esc(url)}">${icon('copy')}<span>העתקת קישור הכניסה</span></button>`);
}

async function loginFromLink(arg) {
  const [id, token] = arg.split('.');
  history.replaceState(null, '', '#home');
  try {
    const m = await api.me({ id, token });
    sess = { id, token };
    saveSession(sess);
    me = m;
    toast(`ברוך הבא, ${m.profile.name.split(' ')[0]}`, 'sparkle');
  } catch { toast('קישור הכניסה לא תקין', 'close'); }
  render();
}

// ---------- Events ----------

document.addEventListener('click', async e => {
  const t = e.target;
  const act = t.closest('[data-act]')?.dataset.act;
  if (act) {
    if (act === 'start') { store.set('hekerut.welcomed', true); draft = draft || blankProfile(); step = 0; saveDraft(); if (route().name === 'c') location.hash = 'home'; else renderOnboarding(); return; }
    if (act === 'onb-next') return onboardingNext();
    if (act === 'onb-skip') return onboardingNext(true);
    if (act === 'onb-back') { step = Math.max(0, step - 1); saveDraft(); return renderOnboarding(); }
    if (act === 'role-add') {
      const m = formModel();
      m.roles.push({ t: '', from: '', to: '' });
      rerenderSection('path');
      const inputs = document.querySelectorAll('[data-f$=".t"]');
      inputs[inputs.length - 1]?.focus();
      return;
    }
    if (act === 'photo-remove') { draftPhoto = null; return rerenderSection('basics'); }
    if (act === 'back') { haptic(); return history.length > 1 ? history.back() : go('home'); }
    if (act === 'reload') return location.reload();
    if (act === 'home') return go('home');
    if (act === 'code') { haptic(); return openScan('mine'); }
    if (act === 'scan') { haptic(); return openScan('scan'); }
    if (act === 'search') { ui.query = ''; go('people'); setTimeout(() => $('#q')?.focus(), 350); return; }
    if (act === 'story-me') return openStory(me.id);
    if (act === 'share') return shareCode();
    if (act === 'copy') return copyText(codeUrl());
    if (act === 'save') return saveEdit();
    if (act === 'sheet-close') return closeSheet();
    if (act === 'demo-scan') { closeSheet(true); location.hash = `c/d-noa.${(await demoKey('d-noa'))}`; return; }
    if (act === 'transfer') return showTransfer();
    if (act === 'new-key') {
      const ok = await actionSheet('ליצור קוד חדש? מי שיסרוק את הקוד הישן יראה רק את התקציר.', [{ id: 'yes', label: 'קוד חדש' }]);
      if (ok !== 'yes') return;
      try { const { key } = await api.newKey(sess); me.key = key; toast('נוצר קוד חדש', 'refresh'); } catch (er) { toast(errorText(er), 'close'); }
      return;
    }
    if (act === 'reset-demo') {
      const ok = await actionSheet('לאפס את ההדגמה? הפרופיל וכל החיבורים יימחקו מהדפדפן הזה.', [{ id: 'yes', label: 'איפוס', danger: true }]);
      if (ok !== 'yes') return;
      api.reset(); saveSession(null); store.del('hekerut.welcomed'); location.hash = ''; location.reload();
      return;
    }
    if (act === 'delete') {
      const ok = await actionSheet('למחוק את החשבון? אי אפשר לבטל את זה.', [{ id: 'yes', label: 'מחיקה לתמיד', danger: true }]);
      if (ok !== 'yes') return;
      try { await api.remove(sess); } catch (er) { if (er.status !== 401) return toast(errorText(er), 'close'); }
      saveSession(null); sess = null; me = null; store.del('hekerut.welcomed'); location.hash = ''; render();
      return;
    }
  }
  const go2 = t.closest('[data-go]');
  if (go2) { haptic(); return go(go2.dataset.go); }
  const chip = t.closest('[data-chip]');
  if (chip) return onChip(chip);
  const corps = t.closest('[data-corps]');
  if (corps) {
    const m = formModel();
    haptic();
    if (m.unit.corps !== corps.dataset.corps) m.unit = { corps: corps.dataset.corps, path: [] };
    else m.unit = { corps: '', path: [] };
    if (route().name !== 'edit') saveDraft();
    rerenderSection('service');
    return;
  }
  const del = t.closest('[data-role-del]');
  if (del) { formModel().roles.splice(+del.dataset.roleDel, 1); return rerenderSection('path'); }
  const follow = t.closest('[data-follow]');
  if (follow) { e.stopPropagation(); return toggleFollow(follow); }
  const conn = t.closest('[data-connect]');
  if (conn) return connect(conn);
  const rm = t.closest('[data-remove-follower]');
  if (rm) {
    e.stopPropagation();
    const ok = await actionSheet('להסיר את העוקב? הוא לא יקבל על זה הודעה.', [{ id: 'yes', label: 'הסרה', danger: true }]);
    if (ok !== 'yes') return;
    try { await api.removeFollower(sess, rm.dataset.removeFollower); cache.lists = {}; me = await api.me(sess); render(); } catch (er) { toast(errorText(er), 'close'); }
    return;
  }
  const story = t.closest('[data-story]');
  if (story) { haptic(); return openStory(story.dataset.story); }
  const list = t.closest('[data-list]');
  if (list) return openList(list.dataset.of, list.dataset.list);
  const mutual = t.closest('[data-mutual]');
  if (mutual) return openList(mutual.dataset.mutual, 'mutual');
  const ptab = t.closest('[data-ptab]');
  if (ptab) { ui.peopleTab = ptab.dataset.ptab; haptic(); return renderPeople(renderSeq); }
  const cl = t.closest('[data-copy-login]');
  if (cl) return copyText(cl.dataset.copyLogin);
  const open = t.closest('[data-open]');
  if (open) { closeSheet(true); haptic(); return go(open.dataset.open === me?.id ? 'me' : `u/${open.dataset.open}`); }
});

async function demoKey(id) { return api.store?.user(id)?.key || ''; }

function onChip(chip) {
  const path = chip.dataset.chip;
  const v = chip.dataset.v;
  haptic();
  if (path === 'theme') { store.set('hekerut.theme', v); applyTheme(); }
  else if (path === 'vis-set') {
    api.update(sess, { profile: { ...me.profile, vis: v } }).then(m => { me = m; toast(v === 'all' ? 'כולם יראו את המסלול המלא' : 'רק מי שהכרת יראה את המסלול המלא', 'eye'); }).catch(e => toast(errorText(e), 'close'));
  } else {
    const m = formModel();
    setPath(m, path, v);
    if (path === 'prep.kind' && v === 'none') m.prep.name = '';
    if (route().name !== 'edit') saveDraft();
    if (['prep.kind', 'status', 'g', 'vis'].includes(path)) {
      rerenderSection(sectionOf(chip));
      if (path === 'g' && route().name === 'edit') rerenderSection('service');
      return;
    }
  }
  chip.parentElement.querySelectorAll('.chip').forEach(c => { c.classList.toggle('on', c === chip); c.setAttribute('aria-checked', c === chip); });
}

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') return onSearch(t.value);
  const m = formModel();
  if (!m) return;
  if (t.dataset.f) {
    const path = t.dataset.f;
    let v = t.value;
    if (/\.(from|to)$/.test(path)) v = v.replace(/\D/g, '').slice(0, 4);
    setPath(m, path, v);
    t.closest('.field')?.querySelector('.f-err')?.replaceChildren();
    if (/^roles\.\d+\.to$/.test(path)) t.closest('.role-row')?.querySelector('.role-dot')?.classList.toggle('now', !v);
    if (path === 'bio') { const c = document.querySelector('[data-count]'); if (c) c.textContent = v.length; }
    // Typing a level opens the next one.
    const lv = path.match(/^unit\.path\.(\d+)$/);
    if (lv) {
      const next = document.querySelectorAll('.lvl')[+lv[1] + 1];
      if (next && v.trim()) next.classList.add('open');
    }
    if (route().name !== 'edit') saveDraft();
  }
  if (t.dataset.age !== undefined) {
    const n = parseInt(t.value, 10);
    m.born = n >= 16 && n <= 80 ? new Date().getFullYear() - n : '';
    if (route().name !== 'edit') saveDraft();
  }
});

document.addEventListener('change', async e => {
  const t = e.target;
  const m = formModel();
  if (t.dataset.photo !== undefined && t.files?.[0]) {
    try { draftPhoto = await readPhoto(t.files[0]); rerenderSection('basics'); } catch (er) { toast(errorText(er), 'close'); }
    return;
  }
  const mp = t.closest('[data-month]');
  if (mp && m) {
    const y = mp.querySelector('[data-part="y"]').value, mo = mp.querySelector('[data-part="m"]').value;
    setPath(m, mp.dataset.month, y && mo ? `${y}-${mo}` : '');
    if (route().name !== 'edit') saveDraft();
  }
});

window.addEventListener('hashchange', () => { closeStory(); render(); });

api.onChange(async () => {
  try { me = await api.me(sess); } catch {}
  cache.lists = {};
  const r = route().name;
  if (r === 'u') { const id = route().arg; delete cache.views[id]; }
  if (!storyState && !$overlay.classList.contains('open')) render();
  else setTabbar(r);
  toast('מישהו עקב אחריך בחזרה', 'heart');
});

// Comes back to the screen: refresh counts and the activity dot.
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !sess || !me) return;
  try { me = await api.me(sess); setTabbar(route().name); } catch {}
  swReg?.update().catch(() => {});
});

// ---------- Start ----------

let swReg;
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { swReg = r; }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled && !document.querySelector('#pform')) location.reload();
    controlled = true;
  });
}

applyTheme();
buildTabbar();
render();
