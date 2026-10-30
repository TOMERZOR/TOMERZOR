// Mabat: the market scanner that says when to enter a stock.
// Tabs: Today (entry setups and the ones close to a trigger), Scanner (every stock, search),
// Portfolio (positions, stops and targets, closed trades and tax terms) and Updates (alerts,
// fund holdings from 13F filings, Congress trade reports).

import { load, save, uid, taxTerm, daysHeld, exportData, importData } from './store.js';
import * as api from './api.js';
import * as push from './push.js';
import { icon } from './icons.js';
import { Chart, sparkline, MA_COLORS } from './chart.js';
import { PLAYBOOK, byId as playbookById, COMMON as PLAYBOOK_COMMON } from './playbook.js';

const state = load();
let board = api.cachedBoard();
let boardError = null;
let tab = ['today', 'scan', 'portfolio', 'updates'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
let scanQuery = '';
let searchResults = null;
let updatesView = 'alerts';
let inbox = [];
let inboxLoaded = false;
let managed = {}; // position id -> where it stands against its plan (from the server)
let firstBoard = true;
const sheets = [];

const persist = () => save(state);

// ---------- Formatting ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const fixed = (v, d = 2) => (isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const money = (v, d) => (isNum(v) ? `${v < 0 ? '-' : ''}$${fixed(Math.abs(v), d ?? (Math.abs(v) >= 10000 ? 0 : 2))}` : '—');
const n = s => `<span class="num" dir="ltr">${s}</span>`;
const signed = (v, d = 2) => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), d)}` : '—');
const pctText = (v, d = 2) => (isNum(v) ? `${signed(v, d)}%` : '—');
const signedMoney = v => (isNum(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}$${fixed(Math.abs(v))}` : '—');
const tone = v => (isNum(v) ? (v > 0 ? 'up' : v < 0 ? 'down' : 'flat') : 'flat');
const shares = v => (isNum(v) ? (Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')) : '—');

const heDate = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
const heShort = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' });
const heTime = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });
const heWeekdayTime = new Intl.DateTimeFormat('he-IL', { weekday: 'long', hour: '2-digit', minute: '2-digit' });

function ago(ms) {
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return 'עכשיו';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'לפני דקה' : `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שע׳`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

const dayLabel = ms => {
  const d = new Date(ms);
  const today = new Date();
  const y = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'היום';
  if (d.toDateString() === y.toDateString()) return 'אתמול';
  return heDate.format(d);
};

const STATUS = {
  enter: { label: 'כניסה', cls: 'enter' },
  near: { label: 'קרוב לכניסה', cls: 'near' },
  hold: { label: 'המתן', cls: 'hold' },
  avoid: { label: 'הימנע', cls: 'avoid' },
};
const TREND = { up: 'מגמת עלייה', down: 'מגמת ירידה', side: 'דשדוש' };

function ring(score, size = 44) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, score || 0));
  const cls = v >= 70 ? 'good' : v >= 55 ? 'mid' : 'low';
  return `<span class="ring ring--${cls}" style="--size:${size}px" role="img" aria-label="ציון ${v} מתוך 100">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-value" stroke-dasharray="${(c * v) / 100} ${c}"/></svg>
    <b class="num">${v}</b></span>`;
}

// ---------- Market clock ----------

function marketLine(m) {
  if (!m) return { text: 'מתחבר…', cls: 'muted' };
  const next = m.nextOpen ? heWeekdayTime.format(new Date(m.nextOpen)) : '';
  if (m.session === 'open') {
    const left = Math.max(0, m.closesAt - Date.now());
    const h = Math.floor(left / 3600000);
    const mm = Math.floor((left % 3600000) / 60000);
    return { text: `השוק פתוח · נסגר בעוד ${h ? `${h}:${String(mm).padStart(2, '0')} ש׳` : `${mm} דק׳`}`, cls: 'open' };
  }
  if (m.session === 'pre') return { text: `מסחר מוקדם · נפתח ב-${heTime.format(new Date(m.nextOpen))}`, cls: 'pre' };
  if (m.session === 'post') return { text: `אחרי הסגירה · נפתח ${next}`, cls: 'closed' };
  return { text: `השוק סגור · נפתח ${next}`, cls: 'closed' };
}

// Recompute the session on the phone between board refreshes (the board's clock is a snapshot).
function liveMarket() {
  const m = board?.market;
  if (!m) return null;
  if (m.session === 'open' && m.closesAt && Date.now() >= m.closesAt) return { ...m, session: 'post', open: false };
  if (m.session !== 'open' && m.nextOpen && Date.now() >= m.nextOpen) return { ...m, session: 'open', open: true, closesAt: m.nextOpen + 6.5 * 3600000 };
  return m;
}

// ---------- Shell ----------

const TABS = [
  ['today', 'היום', 'today'],
  ['scan', 'סורק', 'scan'],
  ['portfolio', 'תיק', 'briefcase'],
  ['updates', 'עדכונים', 'bell'],
];

function shell() {
  document.body.innerHTML = `
    <div class="app">
      <div class="offline" id="offline" hidden>${icon('wifiOff')}<span>אין חיבור. מוצגים הנתונים האחרונים</span></div>
      <main id="main" tabindex="-1"></main>
      <nav class="tabbar" aria-label="ניווט">
        ${TABS.map(([id, label, ic]) => `<button class="tab" data-tab="${id}" aria-label="${label}">${icon(ic)}<span>${label}</span><i class="badge" hidden></i></button>`).join('')}
      </nav>
      <div class="banner-host" id="banners" aria-live="polite"></div>
      <div class="toast-host" id="toasts" aria-live="polite"></div>
    </div>`;
  document.querySelector('.tabbar').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (b.dataset.tab === tab) { document.getElementById('main').scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setTab(b.dataset.tab);
  });
  document.getElementById('main').addEventListener('click', onAction);
  document.getElementById('main').addEventListener('input', onInput);
}

function setTab(id) {
  tab = id;
  history.replaceState(history.state, '', `#${id}`);
  if (id === 'updates') {
    state.feedSeenAt = Date.now();
    persist();
  }
  render();
  document.getElementById('main').scrollTop = 0;
}

function render() {
  for (const b of document.querySelectorAll('.tab')) {
    b.classList.toggle('is-active', b.dataset.tab === tab);
    b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
  }
  const unread = (board?.feed || []).filter(e => e.at > (state.feedSeenAt || 0) && relevant(e)).length + inbox.filter(e => e.at > (state.feedSeenAt || 0)).length;
  const badge = document.querySelector('[data-tab="updates"] .badge');
  badge.hidden = !unread || tab === 'updates';
  badge.textContent = unread > 9 ? '9+' : unread;
  const main = document.getElementById('main');
  const keep = main.querySelector('input[data-input="scan"]');
  const hadFocus = keep && document.activeElement === keep;
  const caret = hadFocus ? keep.selectionStart : null;
  main.innerHTML = { today: viewToday, scan: viewScan, portfolio: viewPortfolio, updates: viewUpdates }[tab]();
  if (hadFocus) {
    const input = main.querySelector('input[data-input="scan"]');
    input?.focus();
    input?.setSelectionRange(caret, caret);
  }
  document.getElementById('offline').hidden = !boardError || boardError.noServer;
}

const relevant = e => {
  if (e.type === 'enter') return state.prefs.scope !== 'watch' ? e.score >= state.prefs.minScore || state.watch.includes(e.t) : state.watch.includes(e.t);
  if (e.type === 'near') return state.prefs.near;
  return true;
};

// ---------- Today ----------

function header(title, subtitle = '', actions = '') {
  return `<header class="large-title"><div class="title-row"><h1>${title}</h1><div class="title-actions">${actions}</div></div>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</header>`;
}

function noServerCard() {
  return `<section class="card empty">
    <div class="empty-icon">${icon('clock')}</div>
    <h2>השרת עוד לא פעיל</h2>
    <p>השרת שסורק את השוק יופעל אוטומטית אחרי שהגרסה הזו תעלה לאוויר. אחר כך המסך הזה יתמלא בהזדמנויות כניסה.</p>
  </section>`;
}

function loadingCards() {
  return `<section class="section"><div class="section-head"><h2 class="skeleton-line" style="width:40%"></h2></div>
    ${[0, 1, 2].map(() => `<div class="card skeleton"><div class="skeleton-line" style="width:30%"></div><div class="skeleton-line" style="width:70%"></div><div class="skeleton-line" style="width:55%"></div></div>`).join('')}</section>`;
}

function viewToday() {
  const m = liveMarket();
  const ml = marketLine(m);
  const gear = `<button class="icon-btn" data-action="settings" aria-label="הגדרות">${icon('gear')}</button>`;
  const sub = `<span>${heDate.format(new Date())}</span><span class="pill pill--${ml.cls}"><i></i>${ml.text}</span>`;
  if (!api.hasServer()) return header('היום', sub, gear) + noServerCard();
  if (!board) return header('היום', sub, gear) + (boardError ? errorCard() : loadingCards());

  const items = board.items || [];
  const entries = items.filter(i => i.status === 'enter').sort((a, b) => b.score - a.score);
  const near = items.filter(i => i.status === 'near').sort((a, b) => (a.levels?.distPct ?? 9) - (b.levels?.distPct ?? 9));
  const watched = items.filter(i => state.watch.includes(i.t));
  const spy = board.regime?.spy;
  const qqq = board.regime?.qqq;
  const weak = spy && spy.above200 === false;

  return `${header('היום', sub, gear)}
    ${board.needsSec ? `<button class="notice" data-action="settings" data-focus="sec">${icon('info')}<span><b>חיבור לנתוני SEC</b> כדי לקרוא דוחות כספיים, דיווחי \u20668-K\u2069 ו-13F צריך שם ואימייל אחד. הגדר עכשיו</span>${icon('chevron', 'chev')}</button>` : ''}
    <section class="market-strip" aria-label="מצב השוק">
      ${indexTile('S&P 500', 'SPY', spy, board.items.find(i => i.t === 'SPY'))}
      ${indexTile('נאסד״ק 100', 'QQQ', qqq, board.items.find(i => i.t === 'QQQ'))}
    </section>
    ${sourceWarning()}
    ${weak ? `<div class="callout callout--warn">${icon('warn')}<p><b>שוק חלש.</b> ה-S&P 500 מתחת לממוצע 200 יום. בתקופות כאלה פריצות נכשלות יותר, והציונים מוחלשים בהתאם.</p></div>` : ''}

    <section class="section" aria-labelledby="h-enter">
      <div class="section-head"><h2 id="h-enter">הזדמנויות כניסה</h2>${entries.length ? `<span class="count">${entries.length}</span>` : ''}<button class="link head-link" data-action="playbook">הסטאפים</button></div>
      ${entries.length ? entries.map(entryCard).join('') : `<div class="card empty empty--small"><div class="empty-icon">${icon('scan')}</div><p><b>אין כרגע סימן כניסה.</b><br>מבט סורק ${items.length} מניות כל כמה דקות ויתריע ברגע שיופיע סטאפ.</p></div>`}
    </section>

    ${near.length ? `<section class="section" aria-labelledby="h-near">
      <div class="section-head"><h2 id="h-near">קרובות לכניסה</h2><span class="count">${near.length}</span></div>
      <div class="list">${near.slice(0, 8).map(nearRow).join('')}</div>
      <p class="footnote">אם המחיר יעבור את הטריגר עם נפח מסחר, זה יהפוך לסימן כניסה.</p>
    </section>` : ''}

    ${watched.length ? `<section class="section" aria-labelledby="h-watch">
      <div class="section-head"><h2 id="h-watch">רשימת המעקב שלך</h2></div>
      <div class="list">${watched.map(stockRow).join('')}</div>
    </section>` : ''}

    <footer class="status-foot">
      <p>${icon('clock')} עודכן ${ago(board.lastTick || board.at)} · ${items.length} מניות בסריקה</p>
      <p>המחירים מעוכבים בכ-15 דקות. מבט הוא כלי ניתוח, לא ייעוץ השקעות.</p>
    </footer>`;
}

// Says so when prices stopped arriving, instead of showing old numbers as if they were fresh.
function sourceWarning() {
  const y = board?.sources?.yahoo;
  const stale = board?.lastTick && Date.now() - board.lastTick > 15 * 60000;
  if (y && y.ok === false) return `<div class="callout callout--warn">${icon('wifiOff')}<p><b>אין כרגע גישה לנתוני המחירים.</b> השרת מנסה שוב כל דקה. המחירים כאן מ${ago(Math.max(...(board.items || []).map(i => i.at || 0))) || 'קודם'}.</p></div>`;
  if (stale) return `<div class="callout callout--warn">${icon('clock')}<p><b>הסריקה האחרונה הייתה ${ago(board.lastTick)}.</b> ייתכן שהשרת בהפסקה. ננסה לרענן שוב בעוד דקה.</p></div>`;
  return '';
}

function errorCard() {
  return `<section class="card empty"><div class="empty-icon">${icon('wifiOff')}</div><h2>אין חיבור לשרת</h2><p>ננסה שוב בעוד רגע.</p><button class="btn btn--tinted" data-action="retry">נסה עכשיו</button></section>`;
}

function indexTile(label, t, r, item) {
  if (!r) return `<div class="index-tile"><span class="index-name">${label}</span><span class="index-price">—</span></div>`;
  return `<button class="index-tile" data-action="detail" data-t="${t}">
    <span class="index-name">${label}</span>
    <span class="index-row"><span class="index-price">${n(fixed(r.price))}</span><span class="chg chg--${tone(r.chgPct)}">${n(pctText(r.chgPct))}</span></span>
    ${item?.spark ? sparkline(item.spark.slice(-40), { width: 140, height: 30 }) : ''}
    <span class="index-trend trend--${r.trend}">${TREND[r.trend] || ''}</span>
  </button>`;
}

function entryCard(i) {
  const L = i.levels || {};
  const size = state.risk.budget ? sizeFor(L, i.price) : null;
  return `<article class="card entry" data-action="detail" data-t="${esc(i.t)}" tabindex="0" role="button" aria-label="${esc(i.t)}, סימן כניסה, ציון ${i.score}">
    <div class="entry-top">
      <div class="entry-id">
        <span class="ticker">${esc(i.t)}${state.watch.includes(i.t) ? `<span class="star-mini">${icon('starFill')}</span>` : ''}</span>
        <span class="name">${esc(i.name)}</span>
      </div>
      ${ring(i.score, 46)}
    </div>
    <div class="entry-mid">
      <div class="price-block"><span class="price">${n(money(i.price))}</span><span class="chg chg--${tone(i.chgPct)}">${n(pctText(i.chgPct))}</span></div>
      ${sparkline(i.spark?.slice(-45), { width: 110, height: 36 })}
    </div>
    <div class="setup-tag">${icon('bolt')}${esc(i.setupName || 'סטאפ כניסה')}</div>
    <div class="levels levels--4">
      <div><span>כניסה</span><b>${n(money(L.entry))}</b></div>
      <div><span>סטופ</span><b class="down">${n(money(L.stop))}</b></div>
      <div><span>יעד 1</span><b class="up">${n(money(L.t1))}</b></div>
      <div><span>יעד 2</span><b class="up">${n(money(L.t2))}</b></div>
    </div>
    ${size?.shares ? `<p class="entry-size">לפי התקציב שלך: ${n(shares(size.shares))} מניות · ${n(money(size.cost))} · סיכון ${n(money(size.risk))}</p>` : ''}
  </article>`;
}

function nearRow(i) {
  const L = i.levels || {};
  const progress = Math.max(4, Math.min(100, 100 - (L.distPct / 3) * 100));
  return `<button class="row" data-action="detail" data-t="${esc(i.t)}">
    <div class="row-main">
      <span class="ticker">${esc(i.t)}</span>
      <span class="name">${esc(i.name)}</span>
    </div>
    <div class="row-side">
      <span class="row-line">טריגר ${n(money(L.trigger))}</span>
      <span class="near-bar" aria-hidden="true"><i style="width:${progress}%"></i></span>
      <span class="row-sub">עוד ${n(`${fixed(L.distPct, 1)}%`)}</span>
    </div>
  </button>`;
}

function stockRow(i) {
  const st = STATUS[i.status] || STATUS.hold;
  return `<button class="row" data-action="detail" data-t="${esc(i.t)}">
    <div class="row-main">
      <span class="ticker">${esc(i.t)}${state.watch.includes(i.t) ? `<span class="star-mini">${icon('starFill')}</span>` : ''}</span>
      <span class="name">${esc(i.name)}</span>
      ${i.status !== 'hold' && STATUS[i.status] ? `<span class="row-status row-status--${STATUS[i.status].cls}">${STATUS[i.status].label}</span>` : ''}
    </div>
    ${sparkline(i.spark?.slice(-30), { width: 56, height: 26 })}
    <div class="row-quote">
      <span class="row-price">${n(fixed(i.price))}</span>
      <span class="chip chip--${tone(i.chgPct)}">${n(pctText(i.chgPct))}</span>
    </div>
    <span class="status-dot status--${st.cls}" role="img" aria-label="${st.label}, ציון ${i.score}"><b class="num" aria-hidden="true">${i.score}</b></span>
  </button>`;
}

// ---------- Scanner ----------

const FILTERS = [
  ['all', 'הכל'],
  ['enter', 'כניסה'],
  ['near', 'קרוב'],
  ['watch', 'מעקב'],
  ['up', 'מגמת עלייה'],
  ['avoid', 'הימנע'],
];

function viewScan() {
  const head = header('סורק', board ? `${board.items.length} מניות · ממוינות לפי ציון` : '');
  const field = `<div class="search">${icon('scan')}<input type="search" data-input="scan" placeholder="חיפוש מניה או טיקר" value="${esc(scanQuery)}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" aria-label="חיפוש מניה">${scanQuery ? `<button class="search-clear" data-action="clear-search" aria-label="נקה">${icon('close')}</button>` : ''}</div>`;
  if (!api.hasServer()) return head + field + noServerCard();
  if (!board) return head + field + (boardError ? errorCard() : loadingCards());
  const f = state.scannerFilter;
  const seg = `<div class="chips-scroll" role="tablist">${FILTERS.map(([id, label]) => `<button class="filter ${f === id ? 'is-on' : ''}" data-action="filter" data-f="${id}" role="tab" aria-selected="${f === id}">${label}</button>`).join('')}</div>`;
  const q = scanQuery.trim().toUpperCase();
  let items = board.items.filter(i => !q || i.t.includes(q) || i.name.toUpperCase().includes(q));
  if (!q) {
    items = items.filter(i => f === 'all' || (f === 'watch' ? state.watch.includes(i.t) : f === 'up' ? i.trend === 'up' : i.status === f));
  }
  items.sort((a, b) => b.score - a.score);
  const remote = q && searchResults?.q === q ? searchResults.list.filter(r => !board.items.some(i => i.t === r.t)) : [];
  return `${head}${field}${q ? '' : seg}
    ${items.length ? `<div class="list list--scan">${items.map(stockRow).join('')}</div>` : q ? '' : `<div class="card empty empty--small"><p>${f === 'watch' ? 'עוד לא הוספת מניות למעקב. פתח מניה ולחץ על הכוכב.' : 'אין מניות במסנן הזה כרגע.'}</p></div>`}
    ${q ? `<section class="section"><div class="section-head"><h2>תוצאות חיפוש</h2></div>
      ${searchResults?.q === q && searchResults.loading ? `<p class="footnote">מחפש…</p>` : remote.length ? `<div class="list">${remote.map(r => `<button class="row" data-action="detail" data-t="${esc(r.t)}"><div class="row-main"><span class="ticker">${esc(r.t)}</span><span class="name">${esc(r.name)}</span></div><span class="row-sub">${esc(r.exchange)}</span>${icon('chevron', 'chev')}</button>`).join('')}</div>` : !items.length ? `<p class="footnote">לא נמצאו מניות אמריקאיות בשם הזה.</p>` : ''}
    </section>` : ''}
    <p class="footnote legend"><span class="status-dot status--enter"></span>כניסה <span class="status-dot status--near"></span>קרוב <span class="status-dot status--hold"></span>המתן <span class="status-dot status--avoid"></span>הימנע · המספר הוא הציון (0–100)</p>`;
}

let searchTimer = null;
function onInput(e) {
  const el = e.target;
  if (el.dataset.input === 'scan') {
    scanQuery = el.value;
    const q = scanQuery.trim().toUpperCase();
    clearTimeout(searchTimer);
    if (q.length >= 1 && api.hasServer()) {
      searchResults = { q, loading: true, list: [] };
      searchTimer = setTimeout(async () => {
        try {
          const list = await api.search(q);
          if (scanQuery.trim().toUpperCase() === q) { searchResults = { q, list }; render(); }
        } catch { searchResults = { q, list: [] }; render(); }
      }, 350);
    } else searchResults = null;
    render();
  }
}

// ---------- Portfolio ----------

const priceOf = t => board?.items?.find(i => i.t === t)?.price ?? api.peekDetail(t)?.sig?.price ?? null;

function viewPortfolio() {
  const add = `<button class="icon-btn" data-action="add-position" aria-label="הוספת עסקה">${icon('plus')}</button>`;
  const pos = state.positions.map(p => {
    const price = priceOf(p.t);
    const value = price != null ? price * p.shares : null;
    const cost = p.entry * p.shares;
    return { ...p, price, value, cost, pl: value != null ? value - cost : null, plPct: price != null ? (price / p.entry - 1) * 100 : null };
  });
  const invested = pos.reduce((s, p) => s + p.cost, 0);
  const valued = pos.filter(p => p.value != null);
  const value = valued.reduce((s, p) => s + p.value, 0);
  const pl = valued.reduce((s, p) => s + p.pl, 0);
  const plPct = valued.length ? (pl / valued.reduce((s, p) => s + p.cost, 0)) * 100 : null;
  const budget = state.risk.budget;
  const year = new Date().getFullYear();
  const closedYear = state.closed.filter(c => c.exitDate?.startsWith(String(year)));
  const realized = term => closedYear.filter(c => c.term === term).reduce((s, c) => s + c.pl, 0);

  const capWarnings = budget ? pos.filter(p => (p.value ?? p.cost) / budget * 100 > state.risk.maxPositionPct + 0.01) : [];

  return `${header('תיק', pos.length ? `${pos.length} עסקאות פתוחות` : '', add)}
    ${pos.length ? `<section class="card summary">
      <div class="summary-main">
        <span class="summary-label">שווי נוכחי</span>
        <span class="summary-value">${n(money(value || invested, 2))}</span>
        <span class="chg chg--${tone(pl)} chg--lg">${n(signedMoney(pl))} · ${n(pctText(plPct))}</span>
      </div>
      <div class="summary-grid">
        <div><span>הושקע</span><b>${n(money(invested))}</b></div>
        ${budget ? `<div><span>תקציב</span><b>${n(money(budget, 0))}</b></div><div><span>נשאר פנוי</span><b>${n(money(Math.max(0, budget - invested)))}</b></div>` : `<div><button class="link" data-action="settings" data-focus="risk">הגדר תקציב</button></div>`}
      </div>
    </section>` : ''}
    ${capWarnings.map(p => `<div class="callout callout--warn">${icon('warn')}<p><b>${esc(p.t)}</b> היא ${n(fixed(((p.value ?? p.cost) / budget) * 100, 1) + '%')} מהתקציב, מעל התקרה שלך (${n(state.risk.maxPositionPct + '%')}). שקול להקטין.</p></div>`).join('')}
    ${pos.length ? `<section class="section"><div class="section-head"><h2>עסקאות פתוחות</h2></div><div class="list">${pos.map(positionRow).join('')}</div></section>`
    : `<section class="card empty"><div class="empty-icon">${icon('briefcase')}</div><h2>עוד אין עסקאות</h2><p>כשתיכנס למניה, לחץ <b>״נכנסתי לעסקה״</b> בעמוד שלה. מבט ינהל אותה לפי התוכנית: יזיז את הסטופ, ויתריע ביעד 1, ביעד 2 ובכל סימן יציאה.</p><button class="btn btn--tinted" data-action="add-position">הוספת עסקה ידנית</button></section>`}
    ${state.closed.length ? `<section class="section"><div class="section-head"><h2>עסקאות שנסגרו</h2></div>
      <div class="card tax">
        <div><span>רווח ממומש ${year} · טווח קצר</span><b class="${tone(realized('short'))}">${n(money(realized('short')))}</b></div>
        <div><span>רווח ממומש ${year} · טווח ארוך</span><b class="${tone(realized('long'))}">${n(money(realized('long')))}</b></div>
        <p class="footnote">מעל שנה מחזיקים = טווח ארוך. המס בפועל תלוי במדינה ובמצב האישי שלך.</p>
      </div>
      <div class="list">${state.closed.slice().reverse().slice(0, 30).map(closedRow).join('')}</div></section>` : ''}
    <p class="footnote">הכל נשמר רק בטלפון הזה. גיבוי בהגדרות.</p>`;
}

const POS_STATE = { hold: ['מחזיקים', 'hold'], t1: ['יעד 1: למכור חצי', 'enter'], t2: ['יעד 2: למכור', 'enter'], exit: ['לצאת', 'avoid'] };

// Where the price sits between the stop and target 2, with target 1 and the entry marked.
function rangeBar(price, entry, stop, t1, t2) {
  if (!(isNum(price) && stop && t2 > stop)) return '';
  const at = v => Math.max(0, Math.min(1, (v - stop) / (t2 - stop))) * 100;
  return `<div class="range-bar" aria-hidden="true"><i class="range-entry" style="inset-inline-start:${at(entry)}%"></i>${t1 ? `<i class="range-t1" style="inset-inline-start:${at(t1)}%"></i>` : ''}<b style="inset-inline-start:${at(price)}%"></b></div>
    <div class="range-labels"><span>סטופ ${n(money(stop))}</span>${t1 ? `<span>יעד 1 ${n(money(t1))}</span>` : ''}<span>יעד 2 ${n(money(t2))}</span></div>`;
}

function managedCard(p, m) {
  const [label, cls] = POS_STATE[m.state] || POS_STATE.hold;
  return `<section class="card managed managed--${cls}">
    <div class="managed-head"><span class="managed-state">${label}</span><span class="managed-r">${n(`${signed(m.r, 2)}R`)}</span></div>
    <p>${esc(m.next)}</p>
    <div class="managed-grid">
      <div><span>${m.stopKind === 'trail' ? 'סטופ נגרר' : m.stopKind === 'breakeven' ? 'סטופ בכניסה' : 'סטופ'}</span><b class="down">${n(money(m.stopNow))}</b></div>
      <div><span>יעד 1</span><b class="up">${n(money(m.t1))}</b>${m.t1Hit ? '<small>הושג ✓</small>' : ''}</div>
      <div><span>יעד 2</span><b class="up">${n(money(m.t2))}</b>${m.t2Hit ? '<small>הושג ✓</small>' : ''}</div>
      <div><span>ימים</span><b>${n(String(m.days))}${m.timeDays ? ` <small>מתוך ${n(String(m.timeDays))}</small>` : ''}</b></div>
    </div>
  </section>`;
}

function positionRow(p) {
  const m = managed[p.id];
  // The bar runs from the original stop to target 2, so progress reads the same as the stop trails up.
  const bar = m ? rangeBar(p.price ?? m.price, p.entry, m.initialStop, m.t1, m.t2) : rangeBar(p.price, p.entry, p.stop, p.t1, p.t2 ?? p.target);
  const [stateLabel, stateCls] = m ? POS_STATE[m.state] || POS_STATE.hold : [];
  const term = taxTerm(p.date);
  return `<button class="row row--position" data-action="position" data-id="${esc(p.id)}">
    <div class="row-main">
      <span class="ticker">${esc(p.t)}</span>
      <span class="name">${n(shares(p.shares))} מניות · כניסה ${n(money(p.entry))}</span>
      <span class="row-sub">${daysHeld(p.date)} ימים · ${term === 'long' ? 'טווח ארוך' : 'טווח קצר'}</span>
      ${m ? `<span class="row-status row-status--${stateCls}">${stateLabel}${m.state === 'exit' ? ` · ${esc(m.exitText)}` : ''}</span>` : ''}
    </div>
    <div class="row-quote">
      <span class="row-price">${n(p.price != null ? fixed(p.price) : '—')}</span>
      <span class="chip chip--${tone(p.plPct)}">${n(pctText(p.plPct))}</span>
    </div>
    ${bar ? `<div class="row-wide">${bar}</div>` : ''}
  </button>`;
}

function closedRow(c) {
  return `<div class="row row--static">
    <div class="row-main"><span class="ticker">${esc(c.t)}</span><span class="name">${n(shares(c.shares))} מניות · ${n(money(c.entry))} ← ${n(money(c.exit))}</span><span class="row-sub">${esc(c.exitDate)} · ${c.term === 'long' ? 'טווח ארוך' : 'טווח קצר'}</span></div>
    <div class="row-quote"><span class="row-price ${tone(c.pl)}">${n(money(c.pl))}</span><span class="chip chip--${tone(c.pl)}">${n(pctText((c.exit / c.entry - 1) * 100))}</span></div>
  </div>`;
}

// ---------- Updates ----------

const FEED_ICONS = { enter: ['bolt', 'enter'], near: ['flag', 'near'], filing: ['doc', 'filing'], congress: ['building', 'congress'], stop: ['arrowDown', 'avoid'], exit: ['arrowDown', 'avoid'], target: ['arrowUp', 'enter'], t1: ['arrowUp', 'enter'], t2: ['arrowUp', 'enter'], bell: ['bell', 'hold'] };

function viewUpdates() {
  const seg = `<div class="segmented" role="tablist">
    ${[['alerts', 'התראות'], ['funds', 'כסף חכם'], ['congress', 'קונגרס']].map(([id, label]) => `<button class="${updatesView === id ? 'is-on' : ''}" data-action="updates-view" data-v="${id}" role="tab" aria-selected="${updatesView === id}">${label}</button>`).join('')}
  </div>`;
  if (!api.hasServer()) return header('עדכונים') + seg + noServerCard();
  if (!board) return header('עדכונים') + seg + (boardError ? errorCard() : loadingCards());
  let body = '';
  if (updatesView === 'alerts') {
    const all = [...inbox.map(e => ({ ...e, personal: true })), ...(board.feed || []).filter(relevant)].sort((a, b) => b.at - a.at);
    if (!all.length) body = `<div class="card empty empty--small"><div class="empty-icon">${icon('bell')}</div><p><b>אין עדכונים עדיין.</b><br>כאן יופיעו סימני כניסה, דיווחים חשובים לרשות ני״ע, דיווחי קונגרס, והסטופים והיעדים שלך.</p></div>`;
    else {
      let lastDay = '';
      body = all.slice(0, 80).map(e => {
        const day = dayLabel(e.at);
        const head = day !== lastDay ? `<h3 class="day">${day}</h3>` : '';
        lastDay = day;
        const [ic, cls] = FEED_ICONS[e.type] || ['info', 'hold'];
        const action = e.t ? `data-action="detail" data-t="${esc(e.t)}"` : e.url ? `data-action="open-url" data-url="${esc(e.url)}"` : '';
        return `${head}<button class="feed-item" ${action}><span class="feed-icon feed--${cls}">${icon(ic)}</span><span class="feed-text"><b>${esc(e.title)}</b><span>${esc(e.body).replace(/\n/g, '<br>')}</span></span><time>${heTime.format(new Date(e.at))}</time></button>`;
      }).join('');
      body = `<div class="feed card">${body}</div>`;
    }
  } else if (updatesView === 'funds') {
    const funds = board.funds || [];
    body = `<p class="explain">מה קרנות ידועות מחזיקות, לפי דוח 13F הרבעוני שהן מגישות לרשות ני״ע האמריקאית. הדוח מראה את התיק ביום האחרון של הרבעון ומוגש עד 45 יום אחריו, כך שהוא תמיד באיחור.</p>`
      + (funds.length ? funds.map(fundCard).join('') : `<div class="card empty empty--small"><p>${board.needsSec ? 'צריך להגדיר שם ואימייל ל-SEC בהגדרות כדי לקרוא את הדוחות.' : 'טוען את הדוחות. זה לוקח כמה דקות בפעם הראשונה.'}</p></div>`);
  } else {
    const list = board.congress || [];
    body = `<p class="explain">חברי בית הנבחרים חייבים לדווח על עסקאות במניות (חוק STOCK). הדיווח מוגש עד 45 יום אחרי העסקה, אז זה מהיר אבל לא מוקדם, ואין כאן מידע פנים. ננסי פלוסי מסומנת, ותקבל התראה כשהיא מגישה דיווח.</p>`
      + (list.length ? `<div class="list">${list.map(c => `<button class="row" data-action="open-url" data-url="${esc(c.url)}"><div class="row-main"><span class="ticker ticker--name">${esc(c.name)}${/pelosi/i.test(c.last) ? ' <span class="tag">במעקב</span>' : ''}</span><span class="name">${esc(c.district)} · הוגש ${heShort.format(new Date(`${c.date}T12:00:00`))}</span></div><span class="row-sub">PDF</span>${icon('chevron', 'chev')}</button>`).join('')}</div>`
      : `<div class="card empty empty--small"><p>טוען את רשימת הדיווחים…</p></div>`);
  }
  return `${header('עדכונים')}${seg}${body}`;
}

const CHANGE = { new: ['חדש', 'up'], added: ['הוסיפה', 'up'], trimmed: ['צמצמה', 'down'], same: ['ללא שינוי', 'flat'] };

function fundCard(f) {
  return `<section class="card fund">
    <div class="fund-head"><div><h3>${esc(f.he)}</h3><span class="name">התיק ב-${esc(f.period)} · הוגש ${esc(f.filed)}</span></div><button class="link" data-action="open-url" data-url="${esc(f.url)}">הדוח</button></div>
    <ol class="fund-list">${f.top.map(h => {
      const [label, cls] = CHANGE[h.change] || ['', 'flat'];
      return `<li ${h.t ? `data-action="detail" data-t="${esc(h.t)}" class="tappable"` : ''}><span class="fund-name">${h.t ? `<b>${esc(h.t)}</b>` : ''}<span class="fund-issuer" dir="ltr">${esc(h.name)}</span></span><span class="fund-pct">${n(fixed(h.pct, 1) + '%')}</span>${label ? `<span class="chip chip--${cls}">${label}</span>` : ''}</li>`;
    }).join('')}</ol>
    ${f.sold?.length ? `<p class="footnote">מכרה לגמרי: ${f.sold.map(s => esc(s.t || s.name)).join(', ')}</p>` : ''}
  </section>`;
}

// ---------- Sizing (trader-budget, trader-risk) ----------

function sizeFor(levels, price) {
  const entry = levels.entry ?? levels.trigger ?? price;
  const r = state.risk;
  const perShare = entry - levels.stop;
  if (!(entry > 0) || !(perShare > 0) || !(r.budget > 0)) return null;
  const investable = r.budget * (1 - (r.cashBufferPct ?? 10) / 100);
  const used = state.positions.reduce((s, p) => s + p.entry * p.shares, 0);
  const free = Math.max(0, investable - used);
  const byRisk = (r.budget * (r.riskPct ?? 1) / 100) / perShare;
  const byCap = Math.min(free, r.budget * (r.maxPositionPct ?? 25) / 100) / entry;
  let qty = Math.min(byRisk, byCap);
  qty = r.fractional ? Math.floor(qty * 1000) / 1000 : Math.floor(qty);
  return { shares: Math.max(0, qty), cost: Math.max(0, qty) * entry, risk: Math.max(0, qty) * perShare, cappedBy: byCap < byRisk ? (free < r.budget * (r.maxPositionPct ?? 25) / 100 ? 'cash' : 'position') : 'risk', free };
}

// ---------- Sheets ----------

function openSheet({ html, cls = '', label = '', onMount, onClose }) {
  const id = uid();
  const root = document.createElement('div');
  root.className = 'sheet-root';
  root.innerHTML = `<div class="sheet-backdrop" data-close></div><section class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="grabber" data-drag aria-hidden="true"></div><div class="sheet-body">${html}</div></section>`;
  document.body.append(root);
  const sheet = root.querySelector('.sheet');
  const body = root.querySelector('.sheet-body');
  const prevFocus = document.activeElement;
  let closed = false;
  let detach = () => {};
  const close = (fromPop = false) => {
    if (closed) return;
    closed = true;
    detach();
    root.classList.remove('open');
    sheets.splice(sheets.findIndex(s => s.id === id), 1);
    if (!fromPop && history.state?.sheet === id) history.back();
    setTimeout(() => { root.remove(); onClose?.(); }, 380);
    if (!sheets.length) document.body.classList.remove('has-sheet');
    prevFocus?.focus?.({ preventScroll: true });
  };
  sheets.push({ id, close, root });
  history.pushState({ sheet: id }, '');
  document.body.classList.add('has-sheet');
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
  root.addEventListener('click', e => { if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) close(); });

  // Drag down to dismiss, from the grabber, the sheet header, or anywhere when scrolled to the top.
  let startY = null;
  let dy = 0;
  sheet.addEventListener('pointerdown', e => {
    if (e.target.closest('canvas, input, textarea, select, .no-drag')) return;
    if (!e.target.closest('[data-drag]') && body.scrollTop > 0) return;
    startY = e.clientY;
    dy = 0;
  });
  const onMove = e => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    if (dy > 6) {
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${dy}px)`;
    }
  };
  const release = () => {
    if (startY == null) return;
    startY = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 110) close();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  detach = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
  };

  onMount?.(body, close);
  setTimeout(() => sheet.focus?.({ preventScroll: true }), 50);
  sheet.tabIndex = -1;
  return { root, body, close };
}

function closeAll() {
  const count = sheets.length;
  [...sheets].reverse().forEach(s => s.close(true));
  if (count) history.go(-count);
}

window.addEventListener('popstate', () => {
  const top = sheets[sheets.length - 1];
  if (top && history.state?.sheet !== top.id) top.close(true);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('article[data-action]')) { e.preventDefault(); e.target.click(); }
});

// ---------- Stock detail ----------

const RANGES = [['1M', 22], ['3M', 64], ['6M', 127], ['1Y', 253]];

function openDetail(t) {
  let chart = null;
  let data = null;
  let range = Number(localStorage.getItem('mabat-range')) || 127;
  let show = JSON.parse(localStorage.getItem('mabat-ma') || '{"sma50":true}');
  let timer = null;
  const cached = board?.items?.find(i => i.t === t);

  const sheet = openSheet({
    cls: 'sheet--full',
    label: t,
    html: `<div class="d-head" data-drag>
        <div class="d-title"><h2 class="ticker-xl">${esc(t)}</h2><span class="name" data-name>${esc(cached?.name || '')}</span></div>
        <div class="d-actions">
          <button class="icon-btn" data-act="star" aria-label="רשימת מעקב" aria-pressed="${state.watch.includes(t)}">${icon(state.watch.includes(t) ? 'starFill' : 'star')}</button>
          <button class="icon-btn icon-btn--fill" data-close aria-label="סגירה">${icon('close')}</button>
        </div>
      </div>
      <div class="d-scroll" data-body>${detailSkeleton(cached)}</div>`,
    onClose: () => { chart?.destroy(); clearInterval(timer); },
    onMount: (body) => {
      const load = async fresh => {
        try {
          data = await api.detail(t, fresh);
          draw(body);
        } catch (e) {
          if (!data) body.querySelector('[data-body]').innerHTML = `<div class="card empty"><div class="empty-icon">${icon('warn')}</div><h2>${e.status === 404 ? 'לא מצאנו את המניה' : 'לא הצלחנו לטעון'}</h2><p>${e.status === 404 ? `אין נתוני מסחר עבור ${esc(t)}.` : 'בדוק את החיבור ונסה שוב.'}</p></div>`;
        }
      };
      load(false);
      timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 60000);
      body.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'star') {
          const on = !state.watch.includes(t);
          state.watch = on ? [...state.watch, t] : state.watch.filter(x => x !== t);
          persist();
          push.sync(state);
          b.innerHTML = icon(on ? 'starFill' : 'star');
          b.setAttribute('aria-pressed', on);
          toast(on ? `${t} נוספה לרשימת המעקב` : `${t} הוסרה מרשימת המעקב`);
          if (data) draw(body);
          render();
        } else if (act === 'range') {
          range = Number(b.dataset.days);
          localStorage.setItem('mabat-range', range);
          for (const x of body.querySelectorAll('[data-act="range"]')) x.classList.toggle('is-on', x === b);
          chart?.set(chartData());
          updateRangeChange(body);
        } else if (act === 'ma') {
          show = { ...show, [b.dataset.k]: !show[b.dataset.k] };
          localStorage.setItem('mabat-ma', JSON.stringify(show));
          b.classList.toggle('is-on', !!show[b.dataset.k]);
          chart?.set(chartData());
        } else if (act === 'enter') {
          const L = data.sig.levels || {};
          openPositionEditor({ t, name: data.sig.name, entry: L.pending ? L.trigger : L.entry ?? data.sig.price, stop: L.stop, t1: L.t1, t2: L.t2, setup: L.setup, level: L.level, size: sizeFor(L.stop ? L : { entry: data.sig.price, stop: null }, data.sig.price) });
        } else if (act === 'open-url') {
          window.open(b.dataset.url, '_blank', 'noopener');
        } else if (act === 'risk') {
          openSettings('risk');
        } else if (act === 'playbook') {
          openPlaybook(b.dataset.setup);
        }
      });
    },
  });

  const chartData = () => ({
    bars: data.bars.map(([t0, o, h, l, c, v]) => ({ t: t0, o, h, l, c, v })),
    series: data.series,
    levels: data.sig.levels,
    days: range,
    show,
  });

  function updateRangeChange(body) {
    const bars = data.bars;
    const first = bars[Math.max(0, bars.length - range)];
    const last = bars[bars.length - 1];
    const ch = (last[4] / first[4] - 1) * 100;
    const el = body.querySelector('[data-range-chg]');
    if (el) {
      el.className = `chg chg--${tone(ch)}`;
      el.innerHTML = n(pctText(ch));
    }
  }

  function draw(body) {
    const s = data.sig;
    body.querySelector('[data-name]').textContent = s.name || '';
    const holder = body.querySelector('[data-body]');
    const scroll = holder.scrollTop;
    holder.innerHTML = detailBody(data, range, show);
    holder.scrollTop = scroll;
    const canvas = holder.querySelector('canvas');
    chart?.destroy();
    chart = new Chart(canvas, {
      onScrub: (bar, prev) => {
        const p = holder.querySelector('[data-price]');
        const c = holder.querySelector('[data-chg]');
        const d = holder.querySelector('[data-when]');
        if (!bar) {
          p.innerHTML = n(money(s.price));
          c.className = `chg chg--${tone(s.chgPct)}`;
          c.innerHTML = n(pctText(s.chgPct));
          d.textContent = s.barTime ? `${ago(s.at)} · מעוכב` : '';
          return;
        }
        p.innerHTML = n(money(bar.c));
        const ch = prev ? (bar.c / prev.c - 1) * 100 : null;
        c.className = `chg chg--${tone(ch)}`;
        c.innerHTML = n(pctText(ch));
        d.textContent = heDate.format(new Date(bar.t * 1000));
      },
    });
    chart.set(chartData());
    updateRangeChange(holder);
  }
}

function detailSkeleton(i) {
  return `<div class="d-price">${i ? `<span class="price-xl" data-price>${n(money(i.price))}</span><span class="chg chg--${tone(i.chgPct)}" data-chg>${n(pctText(i.chgPct))}</span>` : '<span class="skeleton-line" style="width:40%;height:34px"></span>'}</div>
    <div class="chart-wrap skeleton"></div>
    <div class="card skeleton"><div class="skeleton-line" style="width:50%"></div><div class="skeleton-line" style="width:80%"></div></div>`;
}

const GROUPS = [
  ['technical', 'הגרף', 'today'],
  ['fundamental', 'הדוחות הכספיים (SEC)', 'doc'],
  ['smart', 'כסף חכם', 'people'],
  ['news', 'חדשות', 'news'],
];

function verdictText(s) {
  const L = s.levels || {};
  if (s.status === 'enter') return s.setups?.find(x => x.id === s.setup)?.detail || 'הסטאפ התקיים בנר האחרון.';
  if (s.status === 'near') return `אם המחיר יסגור מעל ${money(L.trigger)} (עוד ${fixed(L.distPct, 1)}%) עם נפח מסחר, זה יהיה סימן כניסה. ${state.device.push ? 'נתריע לך.' : ''}`;
  if (s.status === 'avoid') return s.warnings?.[0]?.startsWith('דיווח') ? s.warnings[0] : 'המניה במגמת ירידה: מתחת לממוצע 200 יום, והממוצע הקצר מתחת לארוך. עדיף לחכות להיפוך.';
  if (s.warnings?.some(w => w.includes('מתוח'))) return 'המחיר עלה מהר מדי. כניסה עכשיו היא מרדף, ועדיף לחכות לתיקון.';
  return `אין כרגע סטאפ כניסה. ${TREND[s.trend] ? `המניה ב${TREND[s.trend]}.` : ''} נמשיך לסרוק.`;
}

function detailBody(d, range, show) {
  const s = d.sig;
  const st = STATUS[s.status] || STATUS.hold;
  const L = s.levels || {};
  const size = (s.status === 'enter' || s.status === 'near') && L.stop ? sizeFor(L, s.price) : null;
  const ind = s.ind || {};
  const groups = GROUPS.map(([g, title, ic]) => {
    let checks = (s.checks || []).filter(c => c.group === g);
    if (g === 'fundamental' && !checks.length && d.fundamentals?.rules) checks = d.fundamentals.rules.map(r => ({ label: r.label, pass: r.pass }));
    if (!checks.length) {
      if (g === 'fundamental' && s.sector !== 'etf') checks = [{ label: board?.needsSec ? 'צריך להגדיר שם ואימייל ל-SEC כדי לקרוא דוחות' : 'הדוחות נטענים ברקע', pass: null }];
      else return '';
    }
    return `<div class="reason-group"><h4>${icon(ic)}${title}</h4><ul>${checks.map(c => `<li class="check check--${c.pass === true ? 'pass' : c.pass === false ? 'fail' : 'info'}">${icon(c.pass === true ? 'check' : c.pass === false ? 'cross' : 'dot')}<span>${esc(c.label)}</span></li>`).join('')}</ul></div>`;
  }).join('');
  const m = d.fundamentals?.metrics;

  return `
    <div class="d-price">
      <span class="price-xl" data-price>${n(money(s.price))}</span>
      <span class="chg chg--${tone(s.chgPct)}" data-chg>${n(pctText(s.chgPct))}</span>
      <span class="d-when" data-when>${ago(s.at)} · מעוכב</span>
    </div>
    <div class="chart-wrap"><canvas class="chart" aria-label="גרף מחיר של ${esc(d.t)}" role="img"></canvas></div>
    <div class="chart-controls">
      <div class="segmented segmented--sm" role="tablist">${RANGES.map(([label, days]) => `<button data-act="range" data-days="${days}" class="${days === range ? 'is-on' : ''}">${label}</button>`).join('')}</div>
      <span data-range-chg></span>
    </div>
    <div class="ma-chips">${Object.entries({ sma20: 'ממוצע 20', sma50: 'ממוצע 50', sma200: 'ממוצע 200' }).map(([k, label]) => `<button data-act="ma" data-k="${k}" class="ma-chip ${show[k] ? 'is-on' : ''}" style="--c:${MA_COLORS[k]}"><i></i>${label}</button>`).join('')}</div>

    <section class="card verdict verdict--${st.cls}">
      <div class="verdict-head">
        <div><span class="verdict-label">${st.label}</span>${s.setupName ? `<span class="verdict-setup">${icon('bolt')}${esc(s.setupName)}</span>` : ''}</div>
        ${ring(s.score, 58)}
      </div>
      <p class="verdict-text">${esc(verdictText(s))}</p>
      ${s.warnings?.length ? `<ul class="warnings">${s.warnings.map(w => `<li>${icon('warn')}<span>${esc(w)}</span></li>`).join('')}</ul>` : ''}
    </section>

    ${(s.status === 'enter' || s.status === 'near') && L.t1 ? planCard(L) : ''}

    ${s.status === 'enter' || s.status === 'near' ? `<section class="card sizing">
      <h3>${icon('shield')}כמה לקנות</h3>
      ${!state.risk.budget ? `<p>הגדר תקציב וסיכון לעסקה, ומבט יחשב כמה מניות לקנות כך שאם הסטופ יופעל תפסיד רק את מה שהחלטת מראש.</p><button class="btn btn--tinted" data-act="risk">הגדרת תקציב</button>`
      : size?.shares ? `<div class="sizing-grid">
          <div><span>מניות</span><b>${n(shares(size.shares))}</b></div>
          <div><span>עלות</span><b>${n(money(size.cost))}</b></div>
          <div><span>הפסד בסטופ</span><b class="down">${n(money(size.risk))}</b></div>
        </div>
        <p class="footnote">לפי תקציב ${n(money(state.risk.budget, 0))}, סיכון ${n(state.risk.riskPct + '%')} לעסקה${size.cappedBy === 'position' ? ` · הוגבל לתקרה של ${n(state.risk.maxPositionPct + '%')} למניה` : size.cappedBy === 'cash' ? ' · הוגבל לכסף הפנוי' : ''}. <button class="link" data-act="risk">שינוי</button></p>`
      : `<p>${size && size.free <= 0 ? 'אין כסף פנוי בתקציב אחרי העסקאות הפתוחות וכרית המזומן.' : 'הסכום קטן מדי למניה אחת לפי הכללים שלך.'} <button class="link" data-act="risk">שינוי</button></p>`}
    </section>` : ''}

    <section class="card reasons"><h3>למה</h3>${groups}</section>

    <section class="card stats">
      <div><span>RSI</span><b>${n(fixed(ind.rsi, 0))}</b></div>
      <div><span>נפח מהממוצע</span><b>${n(isNum(ind.relVol) ? `×${fixed(ind.relVol, 1)}` : '—')}</b></div>
      <div><span>מהשיא השנתי</span><b>${n(pctText(ind.fromHigh, 1))}</b></div>
      <div><span>3 חודשים</span><b class="${tone(ind.ret63)}">${n(pctText(ind.ret63, 1))}</b></div>
      <div><span>מול S&P 500</span><b class="${tone(ind.rs63)}">${n(pctText(ind.rs63, 1))}</b></div>
      <div><span>תנודה יומית</span><b>${n(isNum(ind.atr) && s.price ? `${fixed((ind.atr / s.price) * 100, 1)}%` : '—')}</b></div>
      ${m ? `<div><span>צמיחה בהכנסות</span><b class="${tone(m.revenueGrowth)}">${n(pctText(m.revenueGrowth, 1))}</b></div>
      <div><span>רווח נקי</span><b>${n(isNum(m.netMargin) ? `${fixed(m.netMargin, 1)}%` : '—')}</b></div>
      <div><span>רווח למניה (12 ח׳)</span><b>${n(money(m.epsTTM))}</b></div>` : ''}
    </section>
    ${m?.quarterEnd ? `<p class="footnote">הדוחות: הרבעון שהסתיים ב-${esc(m.quarterEnd)}${m.derived ? ' (רבעון רביעי מחושב מהדוח השנתי)' : ''}, מתוך הדיווחים לרשות ני״ע.</p>` : ''}

    ${d.holders?.length ? `<section class="card"><h3>${icon('people')}קרנות שמחזיקות</h3><ul class="plain">${d.holders.map(h => `<li><span>${esc(h.fund)}</span><span>${n(fixed(h.pct, 1) + '%')} מהתיק</span>${CHANGE[h.change] ? `<span class="chip chip--${CHANGE[h.change][1]}">${CHANGE[h.change][0]}</span>` : ''}</li>`).join('')}</ul><p class="footnote">לפי דוח 13F, נכון ל-${esc(d.holders[0].period)}. ייתכן שהשתנה מאז.</p></section>` : ''}

    ${d.news?.length ? `<section class="card"><h3>${icon('news')}חדשות</h3><ul class="news">${d.news.slice(0, 6).map(x => `<li><button data-act="open-url" data-url="${esc(x.link)}"><b dir="auto">${esc(x.title)}</b><span>${esc(x.source)}${x.at ? ` · ${ago(x.at)}` : ''}</span></button></li>`).join('')}</ul><p class="footnote">כותרות הן רמז, לא עובדה. כדאי לקרוא את הכתבה עצמה.</p></section>` : ''}

    ${d.filings?.length ? `<section class="card"><h3>${icon('doc')}דיווחים לרשות ני״ע</h3><ul class="news">${d.filings.slice(0, 6).map(f => `<li><button data-act="open-url" data-url="${esc(f.url)}"><b><span dir="ltr">${esc(f.form)}</span>${f.names?.length ? ` · ${esc(f.names.join(', '))}` : ''}</b><span>${esc(f.date)}</span></button></li>`).join('')}</ul></section>` : ''}

    <div class="d-cta">
      <button class="btn btn--primary btn--lg" data-act="enter">${icon('plus')}נכנסתי לעסקה</button>
      <p class="footnote">מבט לא קונה ולא מוכר. הוא מראה מתי התנאים מתקיימים ומתריע. ההחלטה שלך.</p>
    </div>`;
}

// ---------- Trade plans ----------

const pctFrom = (v, base) => (isNum(v) && base ? (v / base - 1) * 100 : null);

// The ready-made plan for a signal: entry, stop, two targets and how to get out.
function planCard(L) {
  const pb = playbookById[L.setup];
  const steps = [
    ['entry', 'כניסה', L.entry, L.pending ? `קונים רק אם המחיר עובר את ${money(L.trigger)}. עד שזה קורה, לא נכנסים.` : `קונים עכשיו. לא רודפים מעל ${money(L.maxEntry)}.`],
    ['stop', 'סטופ', L.stop, `${L.stopWhy || ''}. אם המחיר מגיע לכאן, יוצאים.`],
    ['t1', `יעד 1 · ${fixed(L.t1R, 1)}R`, L.t1, 'מוכרים חצי ומזיזים את הסטופ לנקודת הכניסה.'],
    ['t2', `יעד 2 · ${fixed(L.t2R, 1)}R`, L.t2, 'מוכרים את השאר, או משאירים חלק עם סטופ נגרר.'],
  ];
  return `<section class="card plan">
    <h3>${icon('flag')}תוכנית המסחר${pb ? `<span class="plan-name">${esc(pb.name)}</span>` : ''}</h3>
    <ol class="ladder">${steps.map(([k, label, v, text]) => `<li class="step step--${k}">
      <span class="step-dot" aria-hidden="true"></span>
      <div class="step-body">
        <div class="step-head"><b>${label}</b><span class="step-price">${n(money(v))}${k !== 'entry' ? ` <small>${n(pctText(pctFrom(v, L.entry), 1))}</small>` : ''}</span></div>
        <p>${esc(text)}</p>
      </div>
    </li>`).join('')}</ol>
    <div class="exit-rules"><b>${icon('arrowDown')}מתי יוצאים</b><p>${esc(pb?.exit || '')}</p></div>
    <button class="link" data-act="playbook" data-setup="${esc(L.setup || '')}">איך הסטאפ הזה עובד</button>
  </section>`;
}

function openPlaybook(focus) {
  openSheet({
    label: 'הסטאפים',
    cls: 'sheet--tall',
    html: `<div class="sheet-nav" data-drag><span></span><h2>הסטאפים</h2><button class="link link--bold" data-close>סיום</button></div>
      <div class="playbook">
        <p class="explain">שישה סטאפים מוכנים. לכל אחד יש כלל כניסה, סטופ, שני יעדים וכללי יציאה. מבט מחשב את המחירים לכל מניה, ועוקב אחרי העסקה אחרי שנכנסת.</p>
        ${PLAYBOOK.map(pb => `<section class="card pb" id="pb-${pb.id}">
          <h3>${icon('bolt')}${esc(pb.name)}</h3>
          <p class="pb-idea">${esc(pb.idea)}</p>
          <dl>
            <dt>כניסה</dt><dd>${esc(pb.entry)}</dd>
            <dt>סטופ</dt><dd>${esc(pb.stop)}</dd>
            <dt>יעד 1</dt><dd>${esc(pb.t1)} מוכרים חצי, הסטופ עובר לכניסה.</dd>
            <dt>יעד 2</dt><dd>${esc(pb.t2)} מוכרים את השאר.</dd>
            <dt>יציאה</dt><dd>${esc(pb.exit)}</dd>
          </dl>
        </section>`).join('')}
        <section class="card pb"><h3>${icon('shield')}כללים לכל הסטאפים</h3><dl>${PLAYBOOK_COMMON.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>
        <p class="footnote">כללים, לא הבטחה: גם סטאפ טוב נגמר לפעמים בסטופ. בגלל זה הסיכון קבוע מראש.</p>
      </div>`,
    onMount: body => {
      if (focus) setTimeout(() => body.querySelector(`#pb-${focus}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 420);
    },
  });
}

// ---------- Positions ----------

function openPositionEditor(prefill = {}, existing = null) {
  const p = existing || { id: uid(), t: prefill.t || '', entry: prefill.entry ?? '', shares: prefill.size?.shares || '', stop: prefill.stop ?? '', t1: prefill.t1 ?? '', t2: prefill.t2 ?? '', setup: prefill.setup || null, level: prefill.level ?? null, date: new Date().toISOString().slice(0, 10) };
  const m = existing ? managed[p.id] : null;
  const pb = playbookById[p.setup];
  const field = (name, label, value, attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value ?? '')}" ${attrs}></label>`;
  openSheet({
    label: existing ? 'עריכת עסקה' : 'עסקה חדשה',
    html: `<div class="sheet-nav" data-drag><button class="link" data-close>ביטול</button><h2>${existing ? esc(p.t) : 'עסקה חדשה'}</h2><button class="link link--bold" data-save>שמירה</button></div>
      <form class="form" novalidate>
        ${m ? managedCard(p, m) : ''}
        ${pb ? `<p class="form-plan">${icon('flag', 'inline')} לפי הסטאפ <b>${esc(pb.name)}</b>. ${esc(pb.exit)}</p>` : ''}
        <div class="group">
          ${field('t', 'מניה', p.t, `autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="AAPL" dir="ltr" ${existing || prefill.t ? 'readonly' : ''}`)}
          ${field('entry', 'מחיר כניסה ($)', p.entry, 'inputmode="decimal" dir="ltr" placeholder="0.00"')}
          ${field('shares', 'כמות מניות', p.shares, 'inputmode="decimal" dir="ltr" placeholder="0"')}
          ${field('date', 'תאריך', p.date, 'type="date" dir="ltr"')}
        </div>
        <div class="group">
          ${field('stop', 'סטופ ($)', p.stop, 'inputmode="decimal" dir="ltr" placeholder="אוטומטי"')}
          ${field('t1', 'יעד 1 ($)', p.t1 ?? '', 'inputmode="decimal" dir="ltr" placeholder="אוטומטי"')}
          ${field('t2', 'יעד 2 ($)', p.t2 ?? p.target ?? '', 'inputmode="decimal" dir="ltr" placeholder="אוטומטי"')}
        </div>
        <p class="footnote">שדה ריק מקבל ערך אוטומטי: סטופ לפי התנודתיות, יעד 1 ויעד 2 בפי 1.5 ופי 3 מהסיכון. מבט מתריע ביעד 1 (למכור חצי), ביעד 2 ובכל סימן יציאה. התראה בלבד: שום דבר לא נמכר אוטומטית.</p>
        <p class="form-error" data-error hidden></p>
        ${existing ? `<div class="group group--actions">
          <button type="button" class="action" data-chart>${icon('today')}פתח את הגרף</button>
          <button type="button" class="action" data-sell>${icon('arrowUp')}סגרתי את העסקה (מכרתי)</button>
          <button type="button" class="action action--danger" data-delete>${icon('trash')}מחיקה</button>
        </div>` : ''}
      </form>`,
    onMount: (body, close) => {
      const form = body.querySelector('form');
      const err = body.querySelector('[data-error]');
      const num = v => (v === '' || v == null ? null : Number(String(v).replace(/[$,\s]/g, '')));
      const submit = () => {
        const f = Object.fromEntries(new FormData(form));
        const t = String(f.t || '').trim().toUpperCase();
        const entry = num(f.entry);
        const qty = num(f.shares);
        const stop = num(f.stop);
        const t1 = num(f.t1);
        const t2 = num(f.t2);
        const problem = !/^[A-Z][A-Z0-9]{0,5}([.-][A-Z]{1,2})?$/.test(t) ? 'טיקר לא תקין'
          : !(entry > 0) ? 'צריך מחיר כניסה'
          : !(qty > 0) ? 'צריך כמות מניות'
          : stop != null && !(stop > 0 && stop < entry) ? 'הסטופ צריך להיות מתחת למחיר הכניסה'
          : t1 != null && !(t1 > entry) ? 'יעד 1 צריך להיות מעל מחיר הכניסה'
          : t2 != null && !(t2 > (t1 ?? entry)) ? 'יעד 2 צריך להיות מעל יעד 1'
          : !/^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? 'תאריך לא תקין' : null;
        if (problem) { err.textContent = problem; err.hidden = false; return; }
        const next = { ...p, t, entry, shares: qty, stop, t1, t2, date: f.date };
        delete next.target;
        state.positions = existing ? state.positions.map(x => (x.id === p.id ? next : x)) : [...state.positions, next];
        persist();
        push.sync(state);
        toast(existing ? 'העסקה עודכנה' : `${t} נוספה לתיק`);
        if (existing) { close(); render(); } else { closeAll(); setTab('portfolio'); }
      };
      body.querySelector('[data-save]').addEventListener('click', submit);
      form.addEventListener('submit', e => { e.preventDefault(); submit(); });
      body.querySelector('[data-delete]')?.addEventListener('click', () => {
        if (!confirm(`למחוק את העסקה ב-${p.t}?`)) return;
        state.positions = state.positions.filter(x => x.id !== p.id);
        persist();
        push.sync(state);
        close();
        render();
      });
      body.querySelector('[data-chart]')?.addEventListener('click', () => { close(); setTimeout(() => openDetail(p.t), 50); });
      body.querySelector('[data-sell]')?.addEventListener('click', () => { close(); setTimeout(() => openClose(p), 50); });
    },
  });
}

function openClose(p) {
  const price = priceOf(p.t);
  openSheet({
    label: 'סגירת עסקה',
    html: `<div class="sheet-nav" data-drag><button class="link" data-close>ביטול</button><h2>מכירת ${esc(p.t)}</h2><button class="link link--bold" data-save>שמירה</button></div>
      <form class="form" novalidate>
        <div class="group">
          <label class="field"><span>מחיר מכירה ($)</span><input name="exit" inputmode="decimal" dir="ltr" value="${price != null ? price.toFixed(2) : ''}"></label>
          <label class="field"><span>תאריך</span><input name="date" type="date" dir="ltr" value="${new Date().toISOString().slice(0, 10)}"></label>
        </div>
        <p class="footnote" data-preview></p>
        <p class="form-error" data-error hidden></p>
      </form>`,
    onMount: (body, close) => {
      const form = body.querySelector('form');
      const preview = () => {
        const exit = Number(form.exit.value);
        const term = taxTerm(p.date, Date.parse(`${form.date.value}T12:00:00Z`));
        body.querySelector('[data-preview]').innerHTML = exit > 0 ? `רווח ממומש ${n(money((exit - p.entry) * p.shares))} · ${term === 'long' ? 'טווח ארוך (מעל שנה)' : 'טווח קצר (עד שנה)'}` : '';
      };
      form.addEventListener('input', preview);
      preview();
      const submit = () => {
        const exit = Number(String(form.exit.value).replace(/[$,\s]/g, ''));
        const date = form.date.value;
        if (!(exit > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { const e = body.querySelector('[data-error]'); e.textContent = 'צריך מחיר ותאריך'; e.hidden = false; return; }
        state.closed.push({ id: p.id, t: p.t, shares: p.shares, entry: p.entry, exit, entryDate: p.date, exitDate: date, pl: (exit - p.entry) * p.shares, term: taxTerm(p.date, Date.parse(`${date}T12:00:00Z`)) });
        state.positions = state.positions.filter(x => x.id !== p.id);
        persist();
        push.sync(state);
        close();
        toast('העסקה נסגרה');
        render();
      };
      body.querySelector('[data-save]').addEventListener('click', submit);
      form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    },
  });
}

// ---------- Settings ----------

function toggle(name, label, on, sub = '') {
  return `<label class="cell cell--toggle"><span class="cell-text"><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" role="switch" class="switch" name="${name}" ${on ? 'checked' : ''}></label>`;
}

function pushSection() {
  const sup = push.support();
  if (!api.hasServer()) return `<div class="cell"><span class="cell-text"><span>התראות</span><small>יופעלו כשהשרת יעלה לאוויר</small></span></div>`;
  if (sup === 'install') return `<div class="cell cell--stack"><span class="cell-text"><span>כדי לקבל התראות באייפון</span><small>מוסיפים את מבט למסך הבית: לוחצים על ${icon('share', 'inline')} בספארי ואז ״הוספה למסך הבית״, ופותחים משם.</small></span></div>`;
  if (sup === 'none') return `<div class="cell"><span class="cell-text"><span>התראות</span><small>הדפדפן הזה לא תומך בהתראות</small></span></div>`;
  if (push.permission() === 'denied') return `<div class="cell"><span class="cell-text"><span>ההתראות חסומות</span><small>אפשר לאשר אותן בהגדרות הטלפון, תחת מבט</small></span></div>`;
  return state.device.push
    ? `<div class="cell"><span class="cell-text"><span>${icon('check', 'inline ok')} ההתראות פעילות</span><small>גם כשהאפליקציה סגורה והמסך נעול</small></span><button type="button" class="btn btn--small" data-test>בדיקה</button></div>
       <button type="button" class="cell cell--button cell--danger" data-push-off>כיבוי התראות</button>`
    : `<button type="button" class="cell cell--button" data-push-on>${icon('bell', 'inline')} הפעלת התראות לטלפון</button>`;
}

function openSettings(focus) {
  const r = state.risk;
  const p = state.prefs;
  openSheet({
    label: 'הגדרות',
    cls: 'sheet--tall',
    html: `<div class="sheet-nav" data-drag><span></span><h2>הגדרות</h2><button class="link link--bold" data-close>סיום</button></div>
      <form class="form settings" novalidate>
        <h3 class="group-title">התראות</h3>
        <div class="group" data-push>${pushSection()}</div>
        <div class="group">
          ${toggle('entries', 'סימני כניסה', p.entries)}
          <div class="cell"><span class="cell-text"><span>על אילו מניות</span></span>
            <div class="segmented segmented--sm"><button type="button" data-scope="all" class="${p.scope === 'all' ? 'is-on' : ''}">כל השוק</button><button type="button" data-scope="watch" class="${p.scope === 'watch' ? 'is-on' : ''}">רק המעקב</button></div></div>
          <div class="cell cell--stack" ${p.scope === 'watch' ? 'hidden' : ''} data-minscore><span class="cell-text"><span>ציון מינימלי להתראה: <b class="num" data-score-val>${p.minScore}</b></span><small>ככל שהציון גבוה יותר, פחות התראות ויותר איכות</small></span><input type="range" name="minScore" min="60" max="90" step="5" value="${p.minScore}" class="no-drag"></div>
          ${toggle('near', 'קרוב לכניסה', p.near, 'כשמניה מתקרבת לטריגר')}
          ${toggle('positions', 'סטופ ויעד בתיק', p.positions)}
          ${toggle('news', 'דיווחי \u20668-K\u2069 חשובים', p.news, 'למניות במעקב ובתיק: דוחות, שינוי הנהלה, אזהרות')}
          ${toggle('congress', 'דיווחי מסחר של ננסי פלוסי', p.congress)}
          ${toggle('bell', 'פתיחת המסחר', p.bell, 'כל יום ב-16:30 שעון ישראל (בדרך כלל)')}
        </div>

        <h3 class="group-title" id="risk">תקציב וסיכון</h3>
        <div class="group">
          <label class="field"><span>תקציב למסחר ($)</span><input name="budget" inputmode="decimal" dir="ltr" placeholder="למשל 10000" value="${r.budget ?? ''}"></label>
          <label class="field"><span>סיכון לעסקה (% מהתקציב)</span><input name="riskPct" inputmode="decimal" dir="ltr" value="${r.riskPct}"></label>
          <label class="field"><span>תקרה למניה אחת (%)</span><input name="maxPositionPct" inputmode="decimal" dir="ltr" value="${r.maxPositionPct}"></label>
          <label class="field"><span>כרית מזומן (%)</span><input name="cashBufferPct" inputmode="decimal" dir="ltr" value="${r.cashBufferPct}"></label>
          ${toggle('fractional', 'שברי מניות', r.fractional, 'אם הברוקר שלך מאפשר')}
        </div>
        <p class="footnote">רק כסף שאפשר להרשות לעצמך להפסיד. סיכון של 1% אומר שאם הסטופ יופעל, תפסיד 1% מהתקציב.</p>

        <h3 class="group-title" id="sec">נתונים מרשות ני״ע (SEC)</h3>
        <div class="group">
          <label class="field field--stack"><span>שם ואימייל</span><input name="sec" dir="ltr" placeholder="Israel Israeli you@example.com" value="${esc(state.sec)}" autocomplete="off"></label>
        </div>
        <p class="footnote">ה-SEC מבקשת מכל תוכנה שקוראת את הדיווחים להזדהות בשם ואימייל. הם נשלחים רק ל-SEC, בכותרת של הבקשות.</p>

        <h3 class="group-title">מסחר</h3>
        <div class="group"><button type="button" class="cell cell--button" data-open-playbook>${icon('flag', 'inline')} הסטאפים: כניסה, סטופ, יעדים ויציאה</button></div>

        <h3 class="group-title">גיבוי</h3>
        <div class="group">
          <button type="button" class="cell cell--button" data-export>${icon('share', 'inline')} שמירת גיבוי לקובץ</button>
          <label class="cell cell--button">${icon('doc', 'inline')} שחזור מגיבוי<input type="file" accept="application/json,.json" data-import hidden></label>
        </div>

        <h3 class="group-title">אודות</h3>
        <div class="group about">
          <p><b>איך מבט עובד.</b> שרת סורק כ-50 מניות גדולות ואת רשימת המעקב שלך כל כמה דקות בזמן המסחר. לכל מניה הוא קורא את הגרף היומי (ממוצעים נעים, RSI, MACD, נפח, פריצות), את הדוחות הכספיים מה-SEC, את דוחות 13F של קרנות גדולות, דיווחי \u20668-K\u2069 וכותרות, ונותן ציון 0–100. כשסטאפ כניסה מתקיים עם ציון גבוה, אתה מקבל התראה עם מחיר כניסה, סטופ ויעד.</p>
          <p><b>מקורות.</b> Yahoo Finance (מחירים מעוכבים בכ-15 דקות וכותרות), SEC EDGAR (דוחות, \u20668-K\u2069, 13F), בית הנבחרים האמריקאי (דיווחי STOCK Act).</p>
          <p><b>חשוב.</b> מבט הוא כלי ניתוח וחינוך, לא ייעוץ השקעות. סימן כניסה הוא מצב בגרף, לא הבטחה: חלק מהעסקאות יפגעו בסטופ. אף פעם לא משקיעים כסף שאי אפשר להרשות לעצמך להפסיד.</p>
        </div>
      </form>`,
    onMount: (body) => {
      const form = body.querySelector('form');
      if (focus) setTimeout(() => body.querySelector(`#${focus}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 400);
      const numOr = (v, d, min, max) => { const x = Number(String(v).replace(/[$,\s]/g, '')); return Number.isFinite(x) && x >= min && x <= max ? x : d; };
      const saveAll = () => {
        const f = new FormData(form);
        for (const k of ['entries', 'near', 'positions', 'news', 'congress', 'bell']) state.prefs[k] = form.elements[k].checked;
        state.prefs.minScore = Number(f.get('minScore')) || 70;
        const budget = String(f.get('budget') || '').replace(/[$,\s]/g, '');
        state.risk.budget = budget && Number(budget) > 0 ? Number(budget) : null;
        state.risk.riskPct = numOr(f.get('riskPct'), 1, 0.1, 10);
        state.risk.maxPositionPct = numOr(f.get('maxPositionPct'), 25, 1, 100);
        state.risk.cashBufferPct = numOr(f.get('cashBufferPct'), 10, 0, 90);
        state.risk.fractional = form.elements.fractional.checked;
        const sec = String(f.get('sec') || '').trim();
        state.sec = /\S+\s+\S+@\S+\.\S+/.test(sec) ? sec : sec ? state.sec : '';
        persist();
        push.sync(state);
        render();
      };
      form.addEventListener('change', e => {
        if (e.target.name === 'sec' && e.target.value.trim() && !/\S+\s+\S+@\S+\.\S+/.test(e.target.value.trim())) toast('צריך שם ואימייל, למשל: Israel Israeli you@example.com');
        saveAll();
      });
      form.addEventListener('input', e => { if (e.target.name === 'minScore') body.querySelector('[data-score-val]').textContent = e.target.value; });
      form.addEventListener('submit', e => e.preventDefault());
      body.addEventListener('click', async e => {
        const t = e.target.closest('button, [data-import]');
        if (!t) return;
        if (t.dataset.scope) {
          state.prefs.scope = t.dataset.scope;
          for (const b of body.querySelectorAll('[data-scope]')) b.classList.toggle('is-on', b === t);
          body.querySelector('[data-minscore]').hidden = state.prefs.scope === 'watch';
          saveAll();
        } else if ('openPlaybook' in t.dataset) {
          openPlaybook();
        } else if ('pushOn' in t.dataset) {
          t.disabled = true;
          try {
            await push.enable(state);
            persist();
            toast('ההתראות פעילות ✓');
          } catch (err) {
            toast(err.denied ? 'ההתראות לא אושרו' : 'לא הצלחנו להפעיל התראות. נסה שוב');
          }
          body.querySelector('[data-push]').innerHTML = pushSection();
        } else if ('pushOff' in t.dataset) {
          await push.disable(state);
          persist();
          body.querySelector('[data-push]').innerHTML = pushSection();
        } else if ('test' in t.dataset) {
          t.disabled = true;
          try { await push.test(state); toast('נשלחה התראת בדיקה'); } catch { toast('השליחה נכשלה. נסה לכבות ולהפעיל מחדש'); }
          t.disabled = false;
        } else if ('export' in t.dataset) {
          const blob = new Blob([exportData(state)], { type: 'application/json' });
          const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `mabat-${new Date().toISOString().slice(0, 10)}.json` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }
      });
      body.querySelector('[data-import]').addEventListener('change', async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          importData(state, await file.text());
          persist();
          push.sync(state);
          toast('הגיבוי שוחזר');
          render();
        } catch { toast('הקובץ הזה לא גיבוי של מבט'); }
      });
    },
  });
}

// ---------- Onboarding ----------

function openOnboarding() {
  let step = 0;
  const steps = [
    () => `<div class="ob ob--hero">
        <img src="img/icon.svg" alt="" class="ob-icon" width="88" height="88">
        <h1>מבט</h1>
        <p class="ob-lead">סורק את השוק בשבילך כל הזמן, ואומר לך מתי להיכנס למניה.</p>
        <ul class="ob-list">
          <li>${icon('today')}<span><b>קורא את הגרפים</b>ממוצעים, מומנטום, נפח ופריצות, בכ-50 מניות ובמניות שלך</span></li>
          <li>${icon('bolt')}<span><b>אומר מתי להיכנס</b>עם מחיר כניסה, סטופ ויעד, וכמה לקנות לפי התקציב</span></li>
          <li>${icon('bell')}<span><b>מתריע לטלפון</b>גם כשהאפליקציה סגורה: כניסות, סטופים, דוחות וקונגרס</span></li>
        </ul>
      </div>`,
    () => `<div class="ob">
        <div class="ob-badge">${icon('shield')}</div>
        <h2>כמה כסף מיועד למסחר?</h2>
        <p class="ob-lead">כך מבט יחשב כמה מניות לקנות בכל עסקה, כדי שהפסד בסטופ יהיה קטן ומתוכנן.</p>
        <div class="group"><label class="field"><span>תקציב ($)</span><input name="budget" inputmode="decimal" dir="ltr" placeholder="10000" value="${state.risk.budget ?? ''}"></label></div>
        <p class="group-title">סיכון לעסקה</p>
        <div class="segmented" data-risk>${[0.5, 1, 2].map(v => `<button type="button" data-v="${v}" class="${state.risk.riskPct === v ? 'is-on' : ''}">${v}%</button>`).join('')}</div>
        <p class="footnote">רק כסף שאפשר להרשות לעצמך להפסיד. 1% זו ברירת מחדל שמרנית. אפשר לשנות בהגדרות.</p>
      </div>`,
    () => {
      const sup = push.support();
      return `<div class="ob">
        <div class="ob-badge">${icon('bell')}</div>
        <h2>התראות לטלפון</h2>
        <p class="ob-lead">הכי חשוב במבט: הודעה ברגע שיש סימן כניסה, גם כשהטלפון בכיס.</p>
        ${sup === 'install' ? `<div class="install"><p><b>באייפון, ההתראות עובדות רק מהמסך הבית:</b></p><ol><li>לוחצים על ${icon('share', 'inline')} למטה בספארי</li><li>בוחרים ״הוספה למסך הבית״</li><li>פותחים את מבט מהאייקון ומפעילים כאן</li></ol></div>`
        : sup === 'ok' && api.hasServer() ? `<button type="button" class="btn btn--primary btn--lg" data-ob-push>${icon('bell')}הפעלת התראות</button><p class="footnote" data-ob-push-msg></p>`
        : `<p class="footnote">${api.hasServer() ? 'הדפדפן הזה לא תומך בהתראות. אפשר להמשיך בלעדיהן.' : 'ההתראות יופעלו כשהשרת יעלה לאוויר. אפשר להפעיל אחר כך בהגדרות.'}</p>`}
      </div>`;
    },
    () => `<div class="ob">
        <div class="ob-badge ob-badge--warn">${icon('info')}</div>
        <h2>לפני שמתחילים</h2>
        <ul class="ob-points">
          <li>מבט הוא כלי ניתוח, <b>לא ייעוץ השקעות</b>. סימן כניסה הוא מצב בגרף, לא הבטחה לרווח.</li>
          <li>חלק מהעסקאות יגיעו לסטופ. בגלל זה הסטופ והגודל מחושבים מראש.</li>
          <li>המחירים מעוכבים בכ-15 דקות. המחיר אצל הברוקר הוא הקובע.</li>
          <li>מבט לא קונה ולא מוכר בשבילך. ההחלטה תמיד שלך.</li>
        </ul>
      </div>`,
  ];
  const s = openSheet({
    cls: 'sheet--full sheet--onboarding',
    label: 'ברוכים הבאים',
    html: `<div class="ob-wrap"><div class="ob-step" data-step></div>
      <div class="ob-foot"><div class="dots">${steps.map((_, i) => `<i data-dot="${i}"></i>`).join('')}</div>
      <button type="button" class="btn btn--primary btn--lg" data-next>המשך</button>
      <button type="button" class="link" data-skip>אחר כך</button></div></div>`,
    onClose: () => { state.onboarded = true; persist(); render(); },
    onMount: (body, close) => {
      const show = () => {
        body.querySelector('[data-step]').innerHTML = steps[step]();
        body.querySelector('[data-step]').classList.remove('in');
        void body.offsetWidth;
        body.querySelector('[data-step]').classList.add('in');
        for (const d of body.querySelectorAll('[data-dot]')) d.classList.toggle('on', Number(d.dataset.dot) === step);
        body.querySelector('[data-next]').textContent = step === steps.length - 1 ? 'הבנתי, בוא נתחיל' : 'המשך';
        body.querySelector('[data-skip]').hidden = step === 0 || step === steps.length - 1;
      };
      const collect = () => {
        const b = body.querySelector('input[name="budget"]');
        if (b) {
          const v = Number(String(b.value).replace(/[$,\s]/g, ''));
          state.risk.budget = v > 0 ? v : null;
          persist();
        }
      };
      body.addEventListener('click', async e => {
        const t = e.target.closest('button');
        if (!t) return;
        if ('next' in t.dataset) {
          collect();
          if (step === steps.length - 1) { close(); return; }
          step++;
          show();
        } else if ('skip' in t.dataset) {
          step = Math.min(steps.length - 1, step + 1);
          show();
        } else if (t.closest('[data-risk]')) {
          state.risk.riskPct = Number(t.dataset.v);
          for (const b of body.querySelectorAll('[data-risk] button')) b.classList.toggle('is-on', b === t);
          persist();
        } else if ('obPush' in t.dataset) {
          const msg = body.querySelector('[data-ob-push-msg]');
          try {
            await push.enable(state);
            persist();
            t.outerHTML = `<p class="ok-line">${icon('check')}ההתראות פעילות</p>`;
          } catch (err) {
            msg.textContent = err.denied ? 'ההתראות לא אושרו. אפשר לאשר בהגדרות הטלפון.' : 'לא הצלחנו להפעיל עכשיו. אפשר לנסות שוב בהגדרות.';
          }
        }
      });
      show();
    },
  });
  return s;
}

// ---------- Toasts and banners ----------

function toast(text) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  host.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 2600);
}

function banner(e) {
  const host = document.getElementById('banners');
  const [ic, cls] = FEED_ICONS[e.type] || ['info', 'hold'];
  const el = document.createElement('button');
  el.className = 'banner';
  el.innerHTML = `<span class="feed-icon feed--${cls}">${icon(ic)}</span><span class="feed-text"><b>${esc(e.title)}</b><span>${esc(e.body).replace(/\n/g, ' · ')}</span></span>`;
  el.addEventListener('click', () => { el.remove(); if (e.t) openDetail(e.t); else if (e.url) window.open(e.url, '_blank', 'noopener'); });
  host.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 500); }, 7000);
}

// ---------- Actions ----------

function onAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'detail') openDetail(el.dataset.t);
  else if (a === 'settings') openSettings(el.dataset.focus);
  else if (a === 'filter') { state.scannerFilter = el.dataset.f; persist(); render(); }
  else if (a === 'clear-search') { scanQuery = ''; searchResults = null; render(); }
  else if (a === 'updates-view') { updatesView = el.dataset.v; render(); }
  else if (a === 'open-url') window.open(el.dataset.url, '_blank', 'noopener');
  else if (a === 'add-position') openPositionEditor({});
  else if (a === 'position') { const p = state.positions.find(x => x.id === el.dataset.id); if (p) openPositionEditor({}, p); }
  else if (a === 'retry') refresh(true);
  else if (a === 'playbook') openPlaybook();
}

// ---------- Data ----------

let refreshing = false;
async function refresh(manual = false) {
  if (refreshing || !api.hasServer()) return;
  refreshing = true;
  try {
    const prev = board;
    board = await api.board();
    boardError = null;
    if (!firstBoard && prev) {
      const known = new Set((prev.feed || []).map(x => x.id));
      for (const ev of (board.feed || []).filter(x => !known.has(x.id) && relevant(x)).slice(0, 2)) banner(ev);
    }
    firstBoard = false;
  } catch (err) {
    boardError = err;
    if (manual) toast('אין חיבור לשרת');
  }
  refreshing = false;
  if (state.device.id) {
    try {
      const d = await api.deviceGet(state.device.id);
      const known = new Set(inbox.map(x => x.id));
      const fresh = (d.inbox || []).filter(x => !known.has(x.id));
      if (inboxLoaded && fresh.length && !state.device.push) fresh.slice(0, 2).forEach(banner);
      inbox = d.inbox || [];
      inboxLoaded = true;
      managed = d.positions || {};
    } catch {}
  }
  if (!sheets.some(s => s.root.querySelector('.sheet--onboarding'))) render();
}

// Light and dark follow the phone's setting.
function applyTheme() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#F2F2F7');
}

// ---------- Start ----------

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
shell();
render();
if (!state.onboarded) openOnboarding();
refresh();
setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60000);
setInterval(() => { if (document.visibilityState === 'visible' && tab === 'today') render(); }, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
window.addEventListener('online', () => refresh());
if (api.hasServer() && !state.device.id) { push.deviceId(state); persist(); }
if (api.hasServer()) push.sync(state, true);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'refresh') refresh();
    if (e.data?.type === 'open' && e.data.t) openDetail(e.data.t);
  });
}
const startT = new URLSearchParams(location.search).get('t');
if (startT && /^[A-Z][A-Z0-9.-]{0,9}$/.test(startT)) setTimeout(() => openDetail(startT), 300);
