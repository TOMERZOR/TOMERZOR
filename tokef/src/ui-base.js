/* Tokef UI: primitives, navigation, toasts, the app shell. */
const { h, render, Fragment } = preact;
const { useState, useEffect, useMemo, useRef, useCallback } = preactHooks;
const html = htm.bind(h);

/* ---------- store hooks ---------- */
/* Subscribes after the first paint, so a change that landed in between is caught by comparing versions. */
function useStore() {
  const [, force] = useState(0);
  const seen = useRef(Store.version);
  seen.current = Store.version;
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    const off = Store.on(fn);
    if (seen.current !== Store.version) fn();
    return off;
  }, []);
  return Store;
}

let derivedMemo = { key: null, val: null };
function derive() {
  const S = Store;
  const today = todayISO();
  const key = [S.subs, S.certs, S.profiles, S.projects, S.pid, today];
  if (derivedMemo.key && key.every((k, i) => k === derivedMemo.key[i])) return derivedMemo.val;
  const project = S.project();
  const byId = new Map(S.profiles.map((p) => [p.id, p]));
  const fallback = S.profiles[0] || null;
  const rows = S.subs.map((sub) => {
    const profile = byId.get(sub.profile) || fallback;
    const cert = latestCert(S.certs, sub.id);
    const ev = evaluate(sub, cert, profile, project, today);
    return { sub, profile, cert, ev, orphan: !byId.has(sub.profile) };
  });
  rows.sort((a, b) => urgency(a.ev) - urgency(b.ev) || a.sub.name.localeCompare(b.sub.name, 'he'));
  const counts = { all: rows.length, in: 0, soon: 0, fix: 0, blocked: 0, ok: 0, attention: 0 };
  for (const r of rows) {
    const s = r.ev.status;
    if (r.ev.gate === 'in') counts.in++;
    if (s === 'soon') counts.soon++;
    if (s === 'fix') counts.fix++;
    if (s === 'expired' || s === 'missing') counts.blocked++;
    if (s === 'ok') counts.ok++;
    if (s !== 'ok' && s !== 'soon') counts.attention++;
  }
  const val = { project, today, rows, counts };
  derivedMemo = { key, val };
  return val;
}
function useDerived() { useStore(); return derive(); }

function toneOf(ev) {
  const s = ev.status;
  return s === 'expired' || s === 'missing' ? 't-block' : s === 'fix' ? 't-bad' : s === 'soon' ? 't-warn' : '';
}

/* ---------- navigation: state lives in the page, the hash names the view ---------- */
const Nav = {
  view: 'home', id: null, listeners: new Set(), version: 0,
  parse(hash) {
    const t = String(hash || '').replace(/^#/, '');
    if (t.startsWith('s-')) return { view: 'sub', id: t.slice(2) };
    if (t.startsWith('u-')) return { view: 'portal', id: t.slice(2) };
    if (t.startsWith('c-')) return { view: 'check', id: t.slice(2) };
    if (['gate', 'rules', 'log', 'check', 'project'].includes(t)) return { view: t, id: null };
    return { view: 'home', id: null };
  },
  token() {
    if (this.view === 'sub') return 's-' + this.id;
    if (this.view === 'portal') return 'u-' + this.id;
    if (this.view === 'check') return this.id ? 'c-' + this.id : 'check';
    return this.view === 'home' ? '' : this.view;
  },
  go(view, id) {
    this.view = view;
    this.id = id || null;
    try { history.replaceState(null, '', this.token() ? '#' + this.token() : location.pathname + location.search); } catch (e) {}
    try { window.scrollTo(0, 0); } catch (e) {}
    this.version++;
    this.listeners.forEach((fn) => fn());
  },
};
function useNav() {
  const [, force] = useState(0);
  const seen = useRef(Nav.version);
  seen.current = Nav.version;
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    Nav.listeners.add(fn);
    if (seen.current !== Nav.version) fn();
    return () => Nav.listeners.delete(fn);
  }, []);
  return Nav;
}
const go = (v, id) => Nav.go(v, id);

/* ---------- toasts ---------- */
const Toasts = {
  list: [], listeners: new Set(), version: 0,
  push(text, tone) {
    const id = uid('t');
    this.list = this.list.concat([{ id, text, tone }]).slice(-3);
    this.emit();
    setTimeout(() => { this.list = this.list.filter((t) => t.id !== id); this.emit(); }, tone === 'bad' ? 6500 : 4200);
  },
  emit() { this.version++; this.listeners.forEach((fn) => fn()); },
};
function toast(text, tone) { Toasts.push(text, tone); }
function ToastHost() {
  const [, force] = useState(0);
  const seen = useRef(Toasts.version);
  seen.current = Toasts.version;
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    Toasts.listeners.add(fn);
    if (seen.current !== Toasts.version) fn();
    return () => Toasts.listeners.delete(fn);
  }, []);
  return html`<div class="toasts" role="status" aria-live="polite">
    ${Toasts.list.map((t) => html`<div key=${t.id} class=${'toast' + (t.tone === 'bad' ? ' bad' : '')}><${Icon} n=${t.tone === 'bad' ? 'error' : 'check_circle'} />${t.text}</div>`)}
  </div>`;
}

function copyText(text, okMsg) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    if (ok) toast(okMsg || 'הועתק');
    else toast('ההעתקה נחסמה כאן. סמנו את הטקסט והעתיקו ידנית.', 'bad');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(okMsg || 'הועתק'), fallback);
    else fallback();
  } catch (e) { fallback(); }
}

/* ---------- primitives ---------- */
function Icon({ n, fill, cls }) {
  return html`<span class=${'ic' + (fill ? ' fill' : '') + (cls ? ' ' + cls : '')} aria-hidden="true">${n}</span>`;
}
function StatusPill({ ev }) {
  return html`<span class=${'pill ' + STATUS[ev.status].tone}>${statusLabel(ev)}</span>${ev.waived ? html` <span class="tag">בחריגה</span>` : null}`;
}
function GateMark({ ev }) {
  return ev.gate === 'in'
    ? html`<span class="gate-ic in"><${Icon} n="check_circle" fill />מורשה</span>`
    : html`<span class="gate-ic out"><${Icon} n="block" />חסום</span>`;
}
function Num({ children }) { return html`<span class="num">${children}</span>`; }
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
function plural(n, one, many) { return n === 1 ? one : n + ' ' + many; }

function Modal({ title, onClose, wide, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const el = ref.current && (ref.current.querySelector('.mb input:not([type=hidden]), .mb textarea, .mb select') || ref.current.querySelector('.mb button'));
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} }
    return () => { window.removeEventListener('keydown', onKey); if (prev && prev.focus) { try { prev.focus({ preventScroll: true }); } catch (e) {} } };
  }, []);
  return html`<div class="overlay" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
      <div class="mh"><h2 class="h2">${title}</h2><button type="button" class="iconbtn" aria-label="סגירה" onClick=${onClose}><${Icon} n="close" /></button></div>
      <div class="mb">${children}</div>
      ${footer ? html`<div class="mf">${footer}</div>` : null}
    </div>
  </div>`;
}

/* A two-step destructive button: the first press arms it, the second acts. */
function ConfirmButton({ label, confirm, onConfirm, cls, icon, disabled, aria }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 5000); return () => clearTimeout(t); }, [armed]);
  return html`<button type="button" class=${'btn ' + (cls || 'danger')} aria-label=${armed ? confirm : (label || aria)} disabled=${disabled || busy} onClick=${async () => {
    if (!armed) { setArmed(true); return; }
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
  }}>${icon ? html`<${Icon} n=${icon} />` : null}${armed ? confirm : label}</button>`;
}

function MoneyInput({ id, value, onChange, placeholder }) {
  const [txt, setTxt] = useState(value ? fmtNum(value) : '');
  useEffect(() => { if ((toNumber(txt) || 0) !== (value || 0)) setTxt(value ? fmtNum(value) : ''); }, [value]);
  return html`<div class="money" style=${{ position: 'relative' }}>
    <input id=${id} class="input mono ltr" inputmode="numeric" placeholder=${placeholder || '0'} value=${txt}
      onInput=${(e) => { const n = toNumber(e.target.value); setTxt(e.target.value); onChange(n); }}
      onBlur=${() => setTxt(value ? fmtNum(value) : '')} />
    <span class="muted" style=${{ position: 'absolute', insetInlineEnd: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>₪</span>
  </div>`;
}

function Field({ id, label, hint, children }) {
  return html`<div class="field"><label for=${id}>${label}</label>${children}${hint ? html`<span class="hint">${hint}</span>` : null}</div>`;
}

function Switch({ id, checked, onChange, label }) {
  return html`<span class="switch"><input id=${id} type="checkbox" role="switch" aria-label=${label} checked=${checked} onChange=${(e) => onChange(e.target.checked)} /><span></span></span>`;
}

function coverSrc(key) { const c = COVERS.find((x) => x.key === key) || COVERS[1]; return c.src; }
function blobUrl(id) { return '/_blob/' + id; }

/* ---------- names of people in the log ---------- */
function useNames(ids) {
  const [names, setNames] = useState({});
  const key = ids.slice().sort().join(',');
  useEffect(() => {
    let live = true;
    if (!Caps.user || !ids.length) return;
    Caps.user.profiles(ids).then((map) => {
      if (!live) return;
      const out = {};
      for (const id of ids) out[id] = (map[id] && map[id].name) || '';
      setNames(out);
    }).catch(() => {});
    return () => { live = false; };
  }, [key, Caps.user]);
  return names;
}

/* ---------- shell ---------- */
const NAV_ITEMS = [
  { view: 'home', label: 'לוח בקרה', icon: 'space_dashboard' },
  { view: 'gate', label: 'בדיקת כניסה', icon: 'badge' },
  { view: 'rules', label: 'דרישות ביטוח', icon: 'tune' },
  { view: 'log', label: 'יומן פעילות', icon: 'receipt_long' },
  { view: 'project', label: 'הגדרות פרויקט', icon: 'settings' },
];
function activeView(v) { return v === 'sub' || v === 'check' ? (v === 'check' ? 'check' : 'home') : v; }

function ProjectSwitcher({ onNew }) {
  const S = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const p = S.project();
  return html`<div class="switcher" ref=${ref}>
    <button type="button" aria-haspopup="true" aria-expanded=${open} onClick=${() => setOpen(!open)}>
      <span class="pname"><span class="plabel">פרויקט</span>${p ? p.name : 'בחירת פרויקט'}</span>
      <${Icon} n="expand_more" />
    </button>
    ${open ? html`<div class="menu" role="menu">
      ${S.projects.map((x) => html`<button key=${x.id} type="button" role="menuitem" aria-current=${x.id === S.pid ? 'true' : 'false'} onClick=${() => { setOpen(false); S.selectProject(x.id); go('home'); }}>
        <${Icon} n="domain" /><span style=${{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${x.name}</span>${x.id === S.pid ? html`<${Icon} n="check" />` : null}
      </button>`)}
      ${S.readOnly ? null : html`<hr />
      <button type="button" role="menuitem" onClick=${() => { setOpen(false); onNew(); }}><${Icon} n="add" />פרויקט חדש</button>`}
    </div>` : null}
  </div>`;
}

function Shell({ children }) {
  const S = useStore();
  const nav = useNav();
  const D = derive();
  const [newOpen, setNewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [hideLocal, setHideLocal] = useState(safeGet('tokef.hideLocal') === '1');
  const cur = activeView(nav.view);
  return html`<div class="shell">
    <aside class="rail" aria-label="ניווט">
      <div class="wordmark">Tokef<b>.</b></div>
      <${ProjectSwitcher} onNew=${() => setNewOpen(true)} />
      <button type="button" class="btn primary cta" onClick=${() => go('check')}><${Icon} n="policy" />בדיקת אישור</button>
      ${NAV_ITEMS.map((it) => html`<button key=${it.view} type="button" class="nav" aria-current=${cur === it.view ? 'page' : undefined} onClick=${() => go(it.view)}>
        <${Icon} n=${it.icon} fill=${cur === it.view} />${it.label}
        ${it.view === 'home' && D.counts.attention ? html`<span class="count" aria-label=${D.counts.attention + ' דורשים טיפול'}>${D.counts.attention}</span>` : null}
      </button>`)}
      <div class="grow"></div>
      <div class="who">
        <span class="avatar">${initials(S.me.name) || html`<${Icon} n="person" />`}</span>
        <span><b>${S.me.name || (S.mode === 'db' ? 'מחובר/ת' : 'מצב מקומי')}</b>${S.mode === 'db' ? 'הנתונים משותפים לצוות' : 'נשמר בדפדפן הזה'}</span>
      </div>
    </aside>

    <header class="topbar">
      <span class="wordmark">Tokef<b>.</b></span>
      <${ProjectSwitcher} onNew=${() => setNewOpen(true)} />
    </header>

    <main class="main" id="main">
      ${S.readOnly && S.mode === 'db' ? html`<div class="banner" style=${{ marginBottom: '16px' }}><${Icon} n="visibility" /><span style=${{ flex: 1 }}>יש לך הרשאת צפייה בלבד. אפשר לראות הכול ולבדוק אישורים, אבל שמירת שינויים דורשת הרשאת עריכה מבעל העמוד.</span></div>` : null}
      ${S.problem ? html`<div class="banner" style=${{ marginBottom: '16px' }}><${Icon} n="warning" /><span style=${{ flex: 1 }}>${S.problem === 'revoked' ? 'הגישה לנתונים הופסקה בעמוד הזה.' : 'החיבור לנתונים נקטע. רעננו את העמוד כדי לראות עדכונים.'}</span><button type="button" class="btn sm" onClick=${() => location.reload()}>רענון</button></div>` : null}
      ${S.mode === 'local' && !hideLocal ? html`<div class="banner" style=${{ marginBottom: '16px' }}><${Icon} n="info" /><span style=${{ flex: 1 }}>גרסת הדגמה: הנתונים נשמרים רק בדפדפן הזה ולא נשלחים לשום מקום.</span><button type="button" class="iconbtn" aria-label="הסתרה" onClick=${() => { safeSet('tokef.hideLocal', '1'); setHideLocal(true); }}><${Icon} n="close" /></button></div>` : null}
      ${children}
    </main>

    <nav class="tabbar" aria-label="ניווט">
      <button type="button" aria-current=${cur === 'home' ? 'page' : undefined} onClick=${() => go('home')}><${Icon} n="space_dashboard" fill=${cur === 'home'} />לוח</button>
      <button type="button" aria-current=${cur === 'gate' ? 'page' : undefined} onClick=${() => go('gate')}><${Icon} n="badge" fill=${cur === 'gate'} />כניסה</button>
      <button type="button" class="mid" aria-current=${cur === 'check' ? 'page' : undefined} onClick=${() => go('check')}><${Icon} n="policy" />בדיקה</button>
      <button type="button" aria-current=${cur === 'rules' ? 'page' : undefined} onClick=${() => go('rules')}><${Icon} n="tune" fill=${cur === 'rules'} />דרישות</button>
      <button type="button" aria-current=${cur === 'log' || cur === 'project' ? 'page' : undefined} onClick=${() => setMoreOpen(true)}><${Icon} n="more_horiz" />עוד</button>
    </nav>

    ${moreOpen ? html`<${Modal} title="עוד" onClose=${() => setMoreOpen(false)}>
      <div class="menu" style=${{ position: 'static', boxShadow: 'none' }}>
        <button type="button" onClick=${() => { setMoreOpen(false); go('log'); }}><${Icon} n="receipt_long" />יומן פעילות</button>
        <button type="button" onClick=${() => { setMoreOpen(false); go('project'); }}><${Icon} n="settings" />הגדרות פרויקט</button>
        ${S.readOnly ? null : html`<button type="button" onClick=${() => { setMoreOpen(false); setNewOpen(true); }}><${Icon} n="add" />פרויקט חדש</button>`}
      </div>
    <//>` : null}
    ${newOpen ? html`<${ProjectModal} onClose=${() => setNewOpen(false)} />` : null}
    <${ToastHost} />
  </div>`;
}

function Loading() {
  return html`<div class="shell">
    <aside class="rail"><div class="wordmark">Tokef<b>.</b></div></aside>
    <header class="topbar"><span class="wordmark">Tokef<b>.</b></span></header>
    <main class="main"><div class="page skeleton" aria-busy="true" aria-label="טוען">
      <div class="sk" style=${{ height: '210px' }}></div>
      <div class="kpis">${[1, 2, 3, 4].map((i) => html`<div key=${i} class="sk" style=${{ height: '92px' }}></div>`)}</div>
      <div class="sk" style=${{ height: '360px' }}></div>
    </div></main>
  </div>`;
}

/* ---------- project form (new and edit share it) ---------- */
function ProjectFields({ draft, set, idp }) {
  return html`
    <div class="grid2">
      <${Field} id=${idp + 'name'} label="שם הפרויקט"><input id=${idp + 'name'} class="input" value=${draft.name} onInput=${(e) => set({ name: e.target.value })} placeholder="מתחם הדקלים, בניין 3" /><//>
      <${Field} id=${idp + 'addr'} label="כתובת או עיר"><input id=${idp + 'addr'} class="input" value=${draft.address} onInput=${(e) => set({ address: e.target.value })} placeholder="רחוב הדקל 12, חדרה" /><//>
    </div>
    <div class="grid2">
      <${Field} id=${idp + 'client'} label="מבקש האישור (החברה שלכם)" hint="השם המשפטי כפי שצריך להופיע באישורי הביטוח"><input id=${idp + 'client'} class="input" value=${draft.client} onInput=${(e) => set({ client: e.target.value })} placeholder="א.ב. בנייה ופיתוח בע״מ" /><//>
      <${Field} id=${idp + 'cid'} label="ח.פ. מבקש האישור"><input id=${idp + 'cid'} class="input mono ltr" inputmode="numeric" value=${draft.clientId} onInput=${(e) => set({ clientId: e.target.value })} placeholder="514000001" /><//>
    </div>
    <div class="field">
      <span class="label">תמונת הפרויקט</span>
      <div class="covers" role="group" aria-label="תמונת הפרויקט">
        ${COVERS.map((c) => html`<button key=${c.key} type="button" class="cover-opt" aria-pressed=${draft.cover === c.key ? 'true' : 'false'} aria-label=${c.label} onClick=${() => set({ cover: c.key })}><img src=${c.src} alt="" loading="lazy" /></button>`)}
      </div>
    </div>`;
}

function ProjectModal({ onClose }) {
  const [draft, setDraft] = useState({ name: '', address: '', client: '', clientId: '', cover: 'day' });
  const [busy, setBusy] = useState(false);
  const set = (p) => setDraft(Object.assign({}, draft, p));
  const ok = draft.name.trim() && draft.client.trim();
  const save = async (e) => {
    if (e) e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    try {
      await Store.createProject({ name: draft.name.trim(), address: draft.address.trim(), client: draft.client.trim(), clientId: draft.clientId.trim(), cover: draft.cover });
      toast('הפרויקט נוצר עם ארבעה פרופילי דרישות לדוגמה');
      onClose();
      go('home');
    } catch (err) { toast(dbErrorText(err), 'bad'); setBusy(false); }
  };
  return html`<${Modal} title="פרויקט חדש" onClose=${onClose} footer=${html`
      <button type="button" class="btn primary" disabled=${!ok || busy} onClick=${save}>${busy ? 'יוצר…' : 'יצירת הפרויקט'}</button>
      <button type="button" class="btn quiet" onClick=${onClose}>ביטול</button>`}>
    <form onSubmit=${save} style=${{ display: 'contents' }}>
      <p class="lede">לכל פרויקט יש דרישות ביטוח משלו, לפי החוזה הראשי. נתחיל עם ארבעה פרופילים נפוצים שאפשר לערוך.</p>
      <${ProjectFields} draft=${draft} set=${set} idp="np-" />
    </form>
  <//>`;
}
