/* Tokef views: welcome, dashboard, site gate, activity log, project settings, subcontractor portal. */

function Welcome() {
  const S = useStore();
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const demo = async () => {
    setBusy(true);
    try { await Store.loadDemo(); toast('פרויקט ההדגמה נטען'); }
    catch (e) { toast(e && e.code ? dbErrorText(e) : 'לא הצלחנו לטעון את פרויקט ההדגמה.', 'bad'); }
    finally { setBusy(false); }
  };
  return html`<div class="welcome">
    <div class="txt">
      <span class="wordmark">Tokef<b>.</b></span>
      <h1>כל אישורי הביטוח של קבלני המשנה, בדוקים מול החוזה.</h1>
      <ul class="pts">
        <li><${Icon} n="check_circle" fill />מעלים אישור קיום ביטוחים, והמערכת קוראת אותו ומשווה לדרישות הפרויקט.</li>
        <li><${Icon} n="check_circle" fill />רואים מי מורשה להיכנס לאתר היום, מה חסר ומה פג בקרוב.</li>
        <li><${Icon} n="check_circle" fill />שולחים לקבלן ולסוכן בקשת תיקון מדויקת, בלחיצה.</li>
      </ul>
      ${S.readOnly ? html`<p class="lede">עדיין אין פרויקטים בעמוד הזה. יש לך הרשאת צפייה בלבד, ולכן בעל העמוד צריך להוסיף את הפרויקט הראשון.</p>` : html`<div class="row">
        <button type="button" class="btn primary lg" onClick=${() => setNewOpen(true)}><${Icon} n="add" />יצירת פרויקט</button>
        <button type="button" class="btn lg" disabled=${busy} onClick=${demo}>${busy ? 'טוען…' : 'פרויקט הדגמה'}</button>
      </div>`}
      ${S.mode === 'local' ? html`<p class="muted" style=${{ fontSize: '13px' }}>העמוד פתוח מחוץ ל-Claude, ולכן הנתונים יישמרו בדפדפן הזה בלבד.</p>` : null}
    </div>
    <div class="pic"><img src="img/office.jpg" alt="שולחן במשרד אתר בנייה עם קסדה, קלסרים ומחשב נייד" /></div>
    ${newOpen ? html`<${ProjectModal} onClose=${() => setNewOpen(false)} />` : null}
    <${ToastHost} />
  </div>`;
}

/* ---------- dashboard ---------- */
const FILTERS = {
  all: { label: 'הכול', test: () => true },
  attention: { label: 'דורשים טיפול', test: (r) => r.ev.status !== 'ok' && r.ev.status !== 'soon' },
  soon: { label: 'פגים בקרוב', test: (r) => r.ev.status === 'soon' },
  ok: { label: 'תקינים', test: (r) => r.ev.status === 'ok' },
  in: { label: 'מורשים לכניסה', test: (r) => r.ev.gate === 'in' },
  fix: { label: 'דורשים תיקון', test: (r) => r.ev.status === 'fix' },
  blocked: { label: 'חסומים', test: (r) => r.ev.status === 'expired' || r.ev.status === 'missing' },
};
function matchQuery(r, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const d = digits(s);
  return r.sub.name.toLowerCase().includes(s) || (r.sub.trade || '').toLowerCase().includes(s) || (r.sub.contact || '').toLowerCase().includes(s) || (d.length >= 3 && digits(r.sub.companyId).includes(d));
}

function waLink(r, project) {
  const msg = whatsappText(r.sub, r.ev, project, r.profile);
  const ph = phoneIntl(r.sub.phone);
  return 'https://wa.me/' + ph + '?text=' + encodeURIComponent(msg);
}

function exportReport(D) {
  const table = reportRows(D.rows, Store.profiles);
  const name = 'tokef-report-' + D.today + '.csv';
  if (Caps.downloads) {
    Caps.downloads.save({ filename: name, data: toCSV(table) }).then(
      () => toast('הדוח נשמר'),
      (e) => { if (e && e.code === 'declined') return; copyText(toTSV(table), 'שמירת קבצים לא זמינה כאן, אז הטבלה הועתקה. אפשר להדביק באקסל.'); }
    );
  } else {
    copyText(toTSV(table), 'הטבלה הועתקה. אפשר להדביק אותה באקסל.');
  }
}

function Dashboard() {
  const S = useStore();
  const D = derive();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const p = D.project;
  if (!p) return null;
  const rows = D.rows.filter((r) => FILTERS[filter].test(r) && matchQuery(r, q));
  const queue = D.rows.filter((r) => r.ev.status !== 'ok').slice(0, 6);
  const upcoming = D.rows.filter((r) => r.ev.until && r.ev.daysLeft != null && r.ev.daysLeft >= 0 && r.ev.daysLeft <= 60).sort((a, b) => a.ev.daysLeft - b.ev.daysLeft).slice(0, 7);
  const tile = (key, cls, value, label) => html`<button type="button" class=${'kpi ' + cls} aria-pressed=${filter === key ? 'true' : 'false'} onClick=${() => { setFilter(filter === key ? 'all' : key); const el = document.getElementById('subs-table'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
    <span class="v">${value}</span><span class="l">${label}</span></button>`;
  const cell = (r, t) => {
    const pol = r.cert && r.cert.fields.policies.filter((x) => x.type === t).sort((a, b) => ((b.end || '') > (a.end || '') ? 1 : -1))[0];
    const ln = r.ev.lines.find((l) => l.type === t);
    if (!pol || pol.limit == null) return ln ? html`<span class="miss">חסר</span>` : html`<span class="muted">—</span>`;
    const bad = ln && (ln.state === 'low' || ln.state === 'missing');
    return html`<span class=${'num' + (bad ? ' miss' : '')}>${money(pol.limit, pol.currency)}</span>`;
  };
  const loading = !S.loaded.project;
  return html`<div class="page">
    <section class="hero">
      <img src=${coverSrc(p.cover)} alt="" />
      <div class="in">
        <div style=${{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span class="eyebrow">${p.demo ? html`<span class="demo-flag">פרויקט הדגמה</span>` : 'פרויקט'}</span>
          <h1 class="h1">${p.name}</h1>
          <span class="meta">${[p.client ? 'מבקש האישור: ' + p.client : '', p.address, D.counts.all ? plural(D.counts.all, 'קבלן משנה אחד', 'קבלני משנה') : ''].filter(Boolean).join(' · ')}</span>
        </div>
        <div class="row acts">
          <button type="button" class="btn" onClick=${() => exportReport(D)} disabled=${!D.rows.length}><${Icon} n="download" />ייצוא דוח</button>
          ${S.readOnly ? null : html`<button type="button" class="btn" onClick=${() => setAddOpen(true)}><${Icon} n="person_add" />קבלן משנה</button>`}
          <button type="button" class="btn primary" onClick=${() => go('check')}><${Icon} n="policy" />בדיקת אישור</button>
        </div>
      </div>
    </section>

    ${loading ? html`<div class="skeleton"><div class="kpis">${[1, 2, 3, 4].map((i) => html`<div key=${i} class="sk" style=${{ height: '92px' }}></div>`)}</div><div class="sk" style=${{ height: '320px' }}></div></div>` : html`
    <section class="kpis" aria-label="סיכום">
      ${tile('in', 'k-ok', D.counts.in, 'מורשים להיכנס לאתר')}
      ${tile('soon', 'k-warn', D.counts.soon, 'פגים ב-' + (p.warnDays || 30) + ' הימים הקרובים')}
      ${tile('fix', 'k-bad', D.counts.fix, 'דורשים תיקון מהסוכן')}
      ${tile('blocked', 'k-block', D.counts.blocked, 'חסומים: אישור פג או חסר')}
    </section>

    ${D.rows.length ? html`<div class="cols">
      <section class="card" aria-labelledby="q-h">
        <div class="head"><h2 class="h2" id="q-h">דורש טיפול</h2><span class="muted">${queue.length ? 'לפי דחיפות' : ''}</span></div>
        ${queue.length ? html`<ul class="qlist">${queue.map((r) => html`<li key=${r.sub.id} class=${toneOf(r.ev)}>
          <button type="button" class="linkrow who" onClick=${() => go('sub', r.sub.id)}><b>${r.sub.name}</b><span>${reason(r.ev)}</span></button>
          <${StatusPill} ev=${r.ev} />
          <a class="btn sm" href=${waLink(r, p)} target="_blank" rel="noopener" aria-label=${'בקשה בוואטסאפ ל' + r.sub.name} onClick=${() => Store.log_('request', 'הוכנה בקשה בוואטסאפ ל' + r.sub.name, r.sub.id)}><${Icon} n="chat" />בקשה</a>
        </li>`)}</ul>` : html`<div class="empty"><${Icon} n="verified_user" /><b>אין מה לטפל כרגע</b><span>כל קבלני המשנה עומדים בדרישות.</span></div>`}
      </section>
      <section class="card" aria-labelledby="u-h">
        <div class="head"><h2 class="h2" id="u-h">פגים ב-60 הימים הקרובים</h2></div>
        ${upcoming.length ? html`<ul class="up">${upcoming.map((r) => html`<li key=${r.sub.id}>
          <button type="button" class="linkrow" onClick=${() => go('sub', r.sub.id)}><b style=${{ fontWeight: 600 }}>${r.sub.name}</b></button>
          <span class="muted" style=${{ fontSize: '13px', whiteSpace: 'nowrap' }}>${r.ev.daysLeft === 0 ? 'היום' : r.ev.daysLeft === 1 ? 'מחר' : 'עוד ' + r.ev.daysLeft + ' ימים'} · <span class="num">${fmtDate(r.ev.until)}</span></span>
          <span class="bar" aria-hidden="true"><i class=${r.ev.daysLeft <= 14 ? 'late' : ''} style=${{ width: Math.max(6, Math.round((1 - r.ev.daysLeft / 60) * 100)) + '%' }}></i></span>
        </li>`)}</ul>` : html`<div class="empty"><${Icon} n="event_available" /><b>אין אישורים שפגים בחודשיים הקרובים</b></div>`}
      </section>
    </div>` : null}

    <section class="card" id="subs-table" aria-labelledby="t-h" style=${{ scrollMarginTop: '80px' }}>
      <div class="head">
        <h2 class="h2" id="t-h">קבלני משנה</h2>
        <div class="search"><${Icon} n="search" /><input class="input" type="search" aria-label="חיפוש קבלן משנה" placeholder="חיפוש לפי שם, תחום או ח.פ." value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
        <div class="spacer"></div>
        <div class="chips" role="group" aria-label="סינון">
          ${['all', 'attention', 'soon', 'ok'].map((k) => html`<button key=${k} type="button" class="chip" aria-pressed=${filter === k ? 'true' : 'false'} onClick=${() => setFilter(k)}>${FILTERS[k].label} <span class="n">${D.rows.filter(FILTERS[k].test).length}</span></button>`)}
          ${['in', 'fix', 'blocked'].includes(filter) ? html`<button type="button" class="chip" aria-pressed="true" onClick=${() => setFilter('all')}>${FILTERS[filter].label}<${Icon} n="close" /></button>` : null}
        </div>
      </div>
      ${!D.rows.length ? html`<div class="empty"><${Icon} n="group_add" /><b>עדיין אין קבלני משנה בפרויקט</b><span>מוסיפים אחד אחד, או מדביקים רשימה מאקסל.</span>${S.readOnly ? null : html`<button type="button" class="btn primary" onClick=${() => setAddOpen(true)}><${Icon} n="person_add" />הוספת קבלני משנה</button>`}</div>`
      : !rows.length ? html`<div class="empty"><${Icon} n="search_off" /><b>אין תוצאות</b><span>נסו חיפוש אחר או סינון אחר.</span></div>`
      : html`
      <div class="tablewrap has-cards">
        <table class="tbl">
          <thead><tr><th scope="col">קבלן משנה</th><th scope="col">דרישות</th><th scope="col">צד שלישי</th><th scope="col">חבות מעבידים</th><th scope="col">בתוקף עד</th><th scope="col">סטטוס</th><th scope="col">כניסה</th></tr></thead>
          <tbody>${rows.map((r) => html`<tr key=${r.sub.id} class=${toneOf(r.ev)} onClick=${() => go('sub', r.sub.id)}>
            <td><button type="button" class="rowlink co" onClick=${(e) => { e.stopPropagation(); go('sub', r.sub.id); }}>${r.sub.name}</button><div class="tr">${r.sub.trade || ' '}</div></td>
            <td class="soft" style=${{ fontSize: '13.5px' }}>${r.profile ? r.profile.name : '—'}</td>
            <td>${cell(r, 'tpl')}</td>
            <td>${cell(r, 'el')}</td>
            <td>${r.ev.until ? html`<span class=${'num' + (r.ev.daysLeft < 0 ? ' miss' : '')}>${fmtDate(r.ev.until)}</span>` : html`<span class="muted">—</span>`}</td>
            <td><${StatusPill} ev=${r.ev} /></td>
            <td><${GateMark} ev=${r.ev} /></td>
          </tr>`)}</tbody>
        </table>
      </div>
      <div class="cards">${rows.map((r) => html`<button key=${r.sub.id} type="button" class=${'subcard ' + toneOf(r.ev)} onClick=${() => go('sub', r.sub.id)}>
        <span class="who"><b>${r.sub.name}</b><span>${r.ev.status === 'ok' && r.ev.until ? 'בתוקף עד ' + fmtDate(r.ev.until) : reason(r.ev)}</span></span>
        <${StatusPill} ev=${r.ev} />
      </button>`)}</div>`}
    </section>`}
    ${addOpen ? html`<${SubModal} onClose=${() => setAddOpen(false)} />` : null}
  </div>`;
}

/* ---------- site gate ---------- */
function Gate() {
  const D = useDerived();
  const [q, setQ] = useState('');
  const list = D.rows.filter((r) => matchQuery(r, q));
  const sorted = q ? list.slice().sort((a, b) => a.sub.name.localeCompare(b.sub.name, 'he')) : list.slice().sort((a, b) => (a.ev.gate === b.ev.gate ? a.sub.name.localeCompare(b.sub.name, 'he') : a.ev.gate === 'out' ? -1 : 1));
  const outN = D.rows.filter((r) => r.ev.gate === 'out').length;
  return html`<div class="page">
    <section class="band">
      <img src="img/gate.jpg" alt="" />
      <div class="in">
        <h1 class="h1">בדיקת כניסה לאתר</h1>
        <p>${D.project ? D.project.name + ' · ' : ''}${fmtDate(D.today)} · ${D.rows.length - outN} מורשים, ${outN} חסומים</p>
      </div>
    </section>
    <div class="bigsearch"><${Icon} n="search" /><input class="input" type="search" aria-label="שם קבלן המשנה" placeholder="שם קבלן המשנה או ח.פ." value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    ${!D.rows.length ? html`<div class="card empty"><${Icon} n="group_add" /><b>עדיין אין קבלני משנה בפרויקט</b></div>`
    : !sorted.length ? html`<div class="card empty"><${Icon} n="search_off" /><b>לא נמצא קבלן משנה בשם הזה</b><span>מי שלא רשום בפרויקט לא מורשה להיכנס.</span></div>`
    : html`<div class="gates">${sorted.map((r) => html`<button key=${r.sub.id} type="button" class=${'gatecard ' + r.ev.gate} onClick=${() => go('sub', r.sub.id)}>
      <div class="top"><div><b>${r.sub.name}</b><span>${[r.sub.trade, r.sub.companyId ? 'ח.פ. ' + r.sub.companyId : ''].filter(Boolean).join(' · ')}</span></div></div>
      <div class=${'verdict-big ' + r.ev.gate}>${r.ev.gate === 'in' ? html`<${Icon} n="check_circle" fill />מורשה כניסה` : html`<${Icon} n="block" />חסום לכניסה`}</div>
      <div class="why">${r.ev.gate === 'in' ? (r.ev.until ? 'האישור בתוקף עד ' + fmtDate(r.ev.until) + (r.ev.status === 'soon' ? ', מתקרב לסיום' : '') : 'כל הדרישות התקיימו') + (r.ev.waived ? '. אושר בחריגה.' : '') : reason(r.ev)}</div>
    </button>`)}</div>`}
  </div>`;
}

/* ---------- activity log ---------- */
const LOG_ICONS = { cert: 'upload_file', sub: 'person_add', edit: 'edit', exception: 'gpp_maybe', request: 'chat', rules: 'tune', project: 'domain', delete: 'delete' };
function Log() {
  const S = useStore();
  const ids = Array.from(new Set(S.log.map((x) => x.by).filter(Boolean)));
  const names = useNames(ids);
  const groups = [];
  for (const it of S.log) {
    const d = new Date(it.at);
    const day = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(it); else groups.push({ day, items: [it] });
  }
  return html`<div class="page">
    <div><span class="eyebrow">יומן פעילות</span><h1 class="h1">מה קרה בפרויקט</h1><p class="lede">כל אישור שנבדק, כל בקשה שהוכנה וכל שינוי בדרישות. 300 הפעולות האחרונות נשמרות.</p></div>
    <section class="card">
      ${!S.log.length ? html`<div class="empty"><${Icon} n="receipt_long" /><b>עדיין אין פעילות</b></div>`
      : groups.map((g) => html`<${Fragment} key=${g.day}>
        <div class="log-day">${g.day}</div>
        <ul class="log">${g.items.map((it, i) => {
          const d = new Date(it.at);
          const who = it.by ? (it.by === S.me.id ? 'את/ה' : names[it.by] || 'חבר/ת צוות') : '';
          const sub = it.sid ? S.subs.find((s) => s.id === it.sid) : null;
          return html`<li key=${it.at + '-' + i}>
            <span class="tm">${String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')}</span>
            <span class="tx">${it.text}${sub ? html` · <button type="button" class="linkrow" style=${{ display: 'inline', width: 'auto', textDecoration: 'underline', textUnderlineOffset: '3px' }} onClick=${() => go('sub', sub.id)}>לכרטיס</button>` : null}${who ? html`<br /><span>${who}</span>` : null}</span>
          </li>`;
        })}</ul>
      <//>`)}
    </section>
  </div>`;
}

/* ---------- project settings ---------- */
function ProjectSettings() {
  const S = useStore();
  const p = S.project();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => { if (p) setDraft({ name: p.name, address: p.address, client: p.client, clientId: p.clientId, cover: p.cover, warnDays: p.warnDays }); }, [p && p.id]);
  if (!p || !draft) return null;
  const set = (x) => setDraft(Object.assign({}, draft, x));
  const dirty = ['name', 'address', 'client', 'clientId', 'cover', 'warnDays'].some((k) => String(draft[k]) !== String(p[k]));
  const save = async () => {
    if (!draft.name.trim()) { toast('לפרויקט צריך שם', 'bad'); return; }
    setBusy(true);
    try {
      await Store.saveProject(Object.assign({}, p, { name: draft.name.trim(), address: draft.address.trim(), client: draft.client.trim(), clientId: draft.clientId.trim(), cover: draft.cover, warnDays: Number(draft.warnDays) || 30 }));
      Store.log_('project', 'פרטי הפרויקט עודכנו');
      toast('הפרטים נשמרו');
    } catch (e) { toast(dbErrorText(e), 'bad'); }
    setBusy(false);
  };
  return html`<div class="page">
    <div><span class="eyebrow">הגדרות פרויקט</span><h1 class="h1">${p.name}</h1></div>
    <section class="card"><div class="body" style=${{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <${ProjectFields} draft=${draft} set=${set} idp="ps-" />
      <div class="grid2">
        <${Field} id="ps-warn" label="התראה לפני תום תוקף" hint="קבלן שהאישור שלו מסתיים בטווח הזה יסומן ״פג בקרוב״">
          <select id="ps-warn" class="input" value=${String(draft.warnDays)} onChange=${(e) => set({ warnDays: Number(e.target.value) })}>
            ${[14, 21, 30, 45, 60].map((d) => html`<option key=${d} value=${String(d)}>${d} ימים</option>`)}
          </select>
        <//>
      </div>
      <div class="row"><button type="button" class="btn primary" disabled=${!dirty || busy || S.readOnly} onClick=${save}>${busy ? 'שומר…' : 'שמירת השינויים'}</button>${dirty && !S.readOnly ? html`<span class="muted" style=${{ fontSize: '13px' }}>יש שינויים שלא נשמרו</span>` : null}</div>
    </div></section>

    <section class="card"><div class="body" style=${{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h2 class="h2">הנתונים</h2>
      <p class="soft">${S.mode === 'db' ? 'הנתונים נשמרים בעמוד הזה ומשותפים לכל מי שיש לו גישה אליו. שינוי שעושה חבר צוות מופיע אצל כולם מיד.' : 'העמוד פתוח מחוץ ל-Claude, ולכן הנתונים נשמרים בדפדפן הזה בלבד ולא משותפים.'}</p>
      ${S.readOnly ? null : html`<div class="row">
        <button type="button" class="btn" onClick=${() => setNewOpen(true)}><${Icon} n="add" />פרויקט חדש</button>
        <span class="spacer"></span>
        <${ConfirmButton} icon="delete" label=${p.demo ? 'מחיקת פרויקט ההדגמה' : 'מחיקת הפרויקט'} confirm="ללחוץ שוב למחיקה סופית" onConfirm=${async () => {
          try { await Store.deleteProject(p.id); toast('הפרויקט נמחק'); go('home'); } catch (e) { toast(dbErrorText(e), 'bad'); }
        }} />
      </div>
      <p class="muted" style=${{ fontSize: '13px' }}>מחיקה מוחקת את קבלני המשנה, האישורים והקבצים של הפרויקט, ואי אפשר לשחזר אותה.</p>`}
    </div></section>
    ${newOpen ? html`<${ProjectModal} onClose=${() => setNewOpen(false)} />` : null}
  </div>`;
}

/* ---------- what the subcontractor sees ---------- */
function Portal({ id }) {
  const S = useStore();
  const D = derive();
  const r = D.rows.find((x) => x.sub.id === id);
  const p = D.project;
  if (!S.loaded.project) return html`<div class="portal"><div class="sk" style=${{ height: '190px' }}></div><div class="sk" style=${{ height: '260px' }}></div></div>`;
  if (!r || !p) return html`<div class="portal"><div class="card empty"><${Icon} n="link_off" /><b>הבקשה לא נמצאה</b><button type="button" class="btn" onClick=${() => go('home')}>ללוח הבקרה</button></div><${ToastHost} /></div>`;
  const { sub, ev, profile } = r;
  const title = ev.status === 'missing' ? 'נדרש אישור קיום ביטוחים' : ev.status === 'ok' ? 'האישור שלכם תקין' : ev.status === 'soon' ? 'האישור שלכם מסתיים בקרוב' : 'האישור שלכם צריך עדכון';
  const asks = askList(ev);
  const mail = agentEmail(sub, ev, p, profile);
  const req = profile ? REQ_TYPES.filter((t) => profile.lines[t].on) : [];
  return html`<div class="portal">
    <div class="pv"><${Icon} n="visibility" /><span style=${{ flex: 1 }}>תצוגה מקדימה: כך ${sub.name} רואה את הבקשה</span><button type="button" class="btn sm" onClick=${() => go('sub', sub.id)}><${Icon} n="arrow_forward" />חזרה</button></div>
    <section class="band">
      <img src="img/foreman.jpg" alt="" />
      <div class="in"><span class="wordmark" style=${{ fontSize: '22px', color: 'var(--on-image)' }}>Tokef<b>.</b></span><p>בקשה מ${p.client || 'הקבלן הראשי'} · ${sub.name}</p><h1 class="h1">${title}</h1></div>
    </section>
    <div class="card"><div class="body row" style=${{ justifyContent: 'space-between' }}>
      <div><b>${p.name}</b><div class="soft" style=${{ fontSize: '13.5px' }}>${p.address || ''}</div></div>
      ${ev.status === 'ok' ? html`<span class="pill ok">בתוקף עד ${fmtDate(ev.until)}</span>` : ev.status === 'soon' ? html`<span class="pill warn">עד ${fmtDate(ev.until)}</span>` : html`<span class="pill bad">לפני הכניסה לאתר</span>`}
    </div></div>
    ${asks.length && ev.status !== 'missing' ? html`<section class="card"><div class="head"><h2 class="h2">מה צריך לתקן</h2></div><ul class="reqlist">${asks.map((a, i) => html`<li key=${i}><${Icon} n="error" />${a}</li>`)}</ul></section>` : null}
    <section class="card"><div class="head"><h2 class="h2">מה צריך להופיע באישור</h2></div>
      <ul class="reqlist">
        ${req.map((t) => html`<li key=${t}><${Icon} n="shield" /><span>${COVER[t].long}${profile.lines[t].codes.length ? html`<small>סעיפים: ${profile.lines[t].codes.map(codeShort).join(', ')}</small>` : null}</span>${profile.lines[t].min ? html`<span class="v num">${money(profile.lines[t].min)}</span>` : null}</li>`)}
        ${p.client ? html`<li><${Icon} n="badge" /><span>מבקש האישור<small>${p.client}${p.clientId ? ', ח.פ. ' + p.clientId : ''}</small></span></li>` : null}
        ${profile && profile.cancelDays ? html`<li><${Icon} n="schedule" /><span>הודעה מוקדמת לפני ביטול<small>${profile.cancelDays} ימים לפחות</small></span></li>` : null}
      </ul>
    </section>
    <button type="button" class="btn primary lg block" onClick=${() => go('check', sub.id)}><${Icon} n="upload_file" />העלאת האישור המעודכן</button>
    <button type="button" class="btn lg block" onClick=${() => copyText(mail.subject + '\n\n' + mail.body, 'הבקשה הועתקה. אפשר להדביק במייל לסוכן.')}><${Icon} n="content_copy" />העתקת הבקשה לסוכן הביטוח</button>
    <p class="muted" style=${{ fontSize: '13px', textAlign: 'center' }}>מעלים צילום או PDF של האישור, ובודקים מיד אם הוא עומד בדרישות.</p>
    <${ToastHost} />
  </div>`;
}
