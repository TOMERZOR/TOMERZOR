/* Tokef flows: the subcontractor record, the certificate check, requirement profiles and the forms behind them. */

/* ---------- coverage ribbon ---------- */
/* Indexes of tick positions that keep labels apart from each other and from the "today" label. */
function spaced(positions, todayPos) {
  const out = [];
  let last = -100;
  positions.forEach((p, i) => {
    if (p - last >= 24 && Math.abs(p - todayPos) >= 20 && p <= 96) { out.push(i); last = p; }
  });
  return out;
}
function Ribbon({ ev, sub, today }) {
  const lines = ev.lines;
  if (!lines.length) return null;
  const dates = [addDays(today, -45), addDays(today, 300)];
  for (const l of lines) {
    if (l.got && isISO(l.got.end)) dates.push(l.got.end);
    if (l.got && isISO(l.got.start)) dates.push(l.got.start);
  }
  if (isISO(sub.workFrom)) dates.push(sub.workFrom);
  if (isISO(sub.workTo)) dates.push(sub.workTo);
  let from = dates.reduce((a, b) => (a < b ? a : b));
  let to = dates.reduce((a, b) => (a > b ? a : b));
  if (diffDays(to, from) > 1100) { from = addDays(today, -180); to = addDays(today, 900); }
  from = from.slice(0, 8) + '01';
  const span = Math.max(30, diffDays(to, from));
  const pos = (d) => Math.max(0, Math.min(100, (diffDays(d, from) / span) * 100));
  const ticks = [];
  let m = from;
  while (m <= to) {
    const mm = +m.slice(5, 7);
    if ((mm - 1) % 3 === 0) ticks.push(m);
    const y = +m.slice(0, 4), nm = mm === 12 ? 1 : mm + 1, ny = mm === 12 ? y + 1 : y;
    m = ny + '-' + String(nm).padStart(2, '0') + '-01';
  }
  const tPos = pos(today);
  const work = isISO(sub.workFrom) || isISO(sub.workTo) ? [pos(sub.workFrom || from), pos(sub.workTo || to)] : null;
  return html`<div class="ribbon" aria-label="ציר זמן של תקופות הביטוח">
    ${lines.map((l) => {
      const p = l.got;
      const end = p && isISO(p.end) ? p.end : null;
      const start = p && isISO(p.start) ? p.start : end ? addDays(end, -364) : null;
      const cls = l.state === 'expired' ? 'expired' : l.state === 'soon' ? 'soon' : l.state === 'ok' ? '' : 'fix';
      return html`<div key=${l.type} class="rb-row">
        <span title=${COVER[l.type].long}>${COVER[l.type].label}</span>
        <div class="rb-track">
          ${work ? html`<div class="rb-work" style=${{ right: work[0] + '%', width: Math.max(0.5, work[1] - work[0]) + '%' }}></div>` : null}
          ${end ? html`<div class=${'rb-bar ' + cls} style=${{ right: pos(start) + '%', width: Math.max(0.8, pos(end) - pos(start)) + '%' }} title=${fmtDate(start) + ' - ' + fmtDate(end)}></div>` : html`<div class="rb-none">${p ? 'אין תאריכים' : 'חסר באישור'}</div>`}
          <div class="rb-today" style=${{ right: 'calc(' + tPos + '% - 1px)' }}></div>
        </div>
      </div>`;
    })}
    <div class="rb-axis"><span></span><div class="rb-ticks">
      ${spaced(ticks.map(pos), tPos).map((i) => html`<span key=${ticks[i]} style=${{ right: pos(ticks[i]) + '%' }}>${fmtMonth(ticks[i])}</span>`)}
      <span class="today" style=${{ right: tPos + '%' }}>היום</span>
    </div></div>
    <div class="rb-legend">
      <span><i style=${{ background: 'var(--ok)' }}></i>בתוקף</span>
      <span><i style=${{ background: '#D9A441' }}></i>מסתיים בקרוב</span>
      <span><i style=${{ background: 'var(--accent)' }}></i>פג או לא תקין</span>
      ${work ? html`<span><i style=${{ border: '1px dashed var(--mute)', background: 'transparent' }}></i>תקופת העבודה בפרויקט</span>` : null}
    </div>
  </div>`;
}

const LINE_STATE = {
  ok: ['ok', 'תקין'], soon: ['warn', 'מסתיים בקרוב'], expired: ['block', 'פג'], missing: ['bad', 'חסר'],
  low: ['bad', 'גבול נמוך'], codes: ['bad', 'חסרים סעיפים'], fix: ['bad', 'חסר מידע'], future: ['bad', 'טרם בתוקף'],
};

function FindingIcon({ lvl }) {
  const n = lvl === 'block' ? 'block' : lvl === 'fix' ? 'error' : lvl === 'warn' ? 'schedule' : 'info';
  return html`<${Icon} n=${n} />`;
}

/* ---------- subcontractor record ---------- */
function SubView({ id }) {
  const S = useStore();
  const D = derive();
  const [modal, setModal] = useState(null);
  const r = D.rows.find((x) => x.sub.id === id);
  const ids = r ? Array.from(new Set(S.certs.filter((c) => c.sid === id).map((c) => c.by).filter(Boolean))) : [];
  const names = useNames(ids);
  if (!S.loaded.project) return html`<div class="page skeleton"><div class="sk" style=${{ height: '120px' }}></div><div class="sk" style=${{ height: '380px' }}></div></div>`;
  if (!r) return html`<div class="page"><div class="card empty"><${Icon} n="person_off" /><b>קבלן המשנה לא נמצא בפרויקט הזה</b><button type="button" class="btn" onClick=${() => go('home')}>ללוח הבקרה</button></div></div>`;
  const { sub, ev, cert, profile } = r;
  const p = D.project;
  const certs = S.certs.filter((c) => c.sid === sub.id).sort((a, b) => b.createdAt - a.createdAt);
  const open = ev.findings.filter((f) => !f.waived && f.lvl !== 'info');
  const canWaive = ev.status === 'fix' && cert;
  const setProfile = async (pid) => {
    try { await Store.saveSub(Object.assign({}, sub, { profile: pid })); const np = S.profiles.find((x) => x.id === pid); Store.log_('edit', 'הדרישות של ' + sub.name + ' שונו ל״' + (np ? np.name : '') + '״', sub.id); toast('הדרישות עודכנו'); }
    catch (e) { toast(dbErrorText(e), 'bad'); }
  };
  const removeWaiver = async () => {
    try { await Store.saveCert(Object.assign({}, cert, { exception: null })); Store.log_('exception', 'בוטלה החריגה של ' + sub.name, sub.id); toast('החריגה בוטלה'); }
    catch (e) { toast(dbErrorText(e), 'bad'); }
  };
  return html`<div class="page">
    <nav class="crumb" aria-label="מיקום"><button type="button" onClick=${() => go('home')}>לוח בקרה</button><${Icon} n="chevron_left" /><span>${sub.name}</span></nav>
    <div class="rec-head">
      <div class="t">
        <h1 class="h1">${sub.name}</h1>
        <div class="meta">
          ${sub.trade ? html`<span>${sub.trade}</span>` : null}
          ${sub.companyId ? html`<span>ח.פ. <span class="num">${sub.companyId}</span></span>` : null}
          <span>דרישות: ${profile ? profile.name : 'לא הוגדרו'}</span>
          ${sub.workFrom || sub.workTo ? html`<span>עבודה בפרויקט: <span class="num">${fmtDate(sub.workFrom) || '?'}</span> עד <span class="num">${fmtDate(sub.workTo) || '?'}</span></span>` : null}
        </div>
        <div class="row" style=${{ marginTop: '10px' }}>
          <button type="button" class="btn primary" onClick=${() => go('check', sub.id)}><${Icon} n="upload_file" />העלאת אישור</button>
          ${ev.status !== 'ok' ? html`<a class="btn" href=${waLink(r, p)} target="_blank" rel="noopener" onClick=${() => Store.log_('request', 'הוכנה בקשה בוואטסאפ ל' + sub.name, sub.id)}><${Icon} n="chat" />בקשה בוואטסאפ</a>` : null}
          ${ev.status !== 'ok' ? html`<button type="button" class="btn" onClick=${() => setModal('mail')}><${Icon} n="mail" />מייל לסוכן</button>` : null}
          ${canWaive && !S.readOnly ? html`<button type="button" class="btn" onClick=${() => setModal('waive')}><${Icon} n="gpp_maybe" />אישור חריגה</button>` : null}
          ${ev.waived && !S.readOnly ? html`<button type="button" class="btn quiet" onClick=${removeWaiver}>ביטול החריגה</button>` : null}
          <button type="button" class="btn quiet" onClick=${() => go('portal', sub.id)}><${Icon} n="visibility" />תצוגת הקבלן</button>
          ${S.readOnly ? null : html`<button type="button" class="btn quiet" onClick=${() => setModal('edit')}><${Icon} n="edit" />עריכה</button>`}
        </div>
      </div>
      <div class=${'stamp ' + ev.gate} role="status">
        <b>${ev.gate === 'in' ? html`<${Icon} n="check_circle" fill />מורשה כניסה` : html`<${Icon} n="block" />חסום לכניסה`}</b>
        <span>${ev.gate === 'in' ? (ev.until ? 'בתוקף עד ' + fmtDate(ev.until) : 'כל הדרישות התקיימו') : ev.status === 'missing' ? 'לא הועלה אישור' : ev.status === 'expired' ? 'האישור פג ב-' + fmtDate(ev.until) : 'עד לתיקון האישור'}</span>
      </div>
    </div>

    <div class="rec-grid">
      <div>
        <section class="card" aria-labelledby="f-h">
          <div class="head"><h2 class="h2" id="f-h">מה מצאנו</h2><${StatusPill} ev=${ev} />${ev.waived && cert && cert.exception ? html`<span class="muted" style=${{ fontSize: '13px' }}>חריגה: ${cert.exception.note}</span>` : null}</div>
          <ul class="findings">
            ${ev.findings.length ? ev.findings.map((f) => html`<li key=${f.key} class=${'f-' + f.lvl + (f.waived ? ' waived' : '')}>
              <${FindingIcon} lvl=${f.lvl} />
              <div class="tx"><b>${f.title}${f.waived ? ' (אושר בחריגה)' : ''}</b>${f.lvl !== 'info' ? html`<span>${f.ask}</span>` : html`<span>${f.ask}</span>`}</div>
            </li>`) : html`<li class="f-ok"><${Icon} n="verified_user" fill /><div class="tx"><b>כל הדרישות התקיימו</b><span>האישור תואם את דרישות הביטוח של הפרויקט.</span></div></li>`}
          </ul>
        </section>

        <section class="card" aria-labelledby="c-h">
          <div class="head"><h2 class="h2" id="c-h">כיסויים מול הדרישות</h2><span class="muted">${profile ? profile.name : ''}</span></div>
          ${ev.lines.length ? html`<div class="tablewrap cov-wrap"><table class="cov">
            <thead><tr><th scope="col">ביטוח</th><th scope="col">נדרש</th><th scope="col">באישור</th><th scope="col">בתוקף עד</th><th scope="col">סעיפים נדרשים</th></tr></thead>
            <tbody>${ev.lines.map((l) => {
              const st = LINE_STATE[l.state] || LINE_STATE.fix;
              const have = new Set(((l.got && l.got.codes) || []).map(Number));
              return html`<tr key=${l.type}>
                <td><b style=${{ fontWeight: 600 }}>${COVER[l.type].label}</b><div><span class=${'pill ' + st[0]} style=${{ marginTop: '6px', height: '22px', fontSize: '12px' }}>${st[1]}</span></div></td>
                <td>${l.req.min ? html`<span class="num">${money(l.req.min)}</span>` : html`<span class="muted">ללא מינימום</span>`}</td>
                <td>${l.got ? (l.got.limit != null ? html`<span class=${'num' + (l.state === 'low' ? ' miss' : '')}>${money(l.got.limit, l.got.currency)}</span>` : html`<span class="miss">לא צוין</span>`) : html`<span class="miss">חסר</span>`}${l.got && l.got.policyNo ? html`<div class="muted" style=${{ fontSize: '12px' }}>פוליסה <span class="num">${l.got.policyNo}</span></div>` : null}</td>
                <td>${l.got && l.got.end ? html`<span class=${'num' + (l.state === 'expired' ? ' miss' : '')}>${fmtDate(l.got.end)}</span>` : html`<span class="muted">—</span>`}</td>
                <td><div class="codes">${l.req.codes.length ? l.req.codes.map((c) => html`<span key=${c} class=${'code' + (l.got && !have.has(c) ? ' no' : '')} title=${codeLong(c)}><span class="num">${c}</span>${codeShort(c)}</span>`) : html`<span class="muted">—</span>`}</div></td>
              </tr>`;
            })}</tbody>
          </table></div>
          <ul class="cov-cards">${ev.lines.map((l) => {
            const st = LINE_STATE[l.state] || LINE_STATE.fix;
            const have = new Set(((l.got && l.got.codes) || []).map(Number));
            const miss = l.got ? l.req.codes.filter((c) => !have.has(c)) : [];
            return html`<li key=${l.type}>
              <div class="row"><b style=${{ flex: 1 }}>${COVER[l.type].long}</b><span class=${'pill ' + st[0]}>${st[1]}</span></div>
              <dl class="kv">
                <dt>נדרש</dt><dd>${l.req.min ? html`<span class="num">${money(l.req.min)}</span>` : 'ללא מינימום'}</dd>
                <dt>באישור</dt><dd>${l.got ? (l.got.limit != null ? html`<span class=${'num' + (l.state === 'low' ? ' miss' : '')}>${money(l.got.limit, l.got.currency)}</span>` : html`<span class="miss">לא צוין</span>`) : html`<span class="miss">חסר</span>`}</dd>
                <dt>בתוקף עד</dt><dd>${l.got && l.got.end ? html`<span class=${'num' + (l.state === 'expired' ? ' miss' : '')}>${fmtDate(l.got.end)}</span>` : '—'}</dd>
              </dl>
              ${miss.length ? html`<div class="codes">${miss.map((c) => html`<span key=${c} class="code no"><span class="num">${c}</span>${codeShort(c)}</span>`)}</div>` : null}
            </li>`;
          })}</ul>
          <${Ribbon} ev=${ev} sub=${sub} today=${D.today} />` : html`<div class="empty"><b>לא הוגדרו דרישות ביטוח</b><span>בחרו פרופיל דרישות לקבלן המשנה הזה.</span></div>`}
        </section>

        <section class="card" aria-labelledby="h-h">
          <div class="head"><h2 class="h2" id="h-h">אישורים שהועלו</h2><span class="muted">${certs.length ? plural(certs.length, 'אישור אחד', 'אישורים') : ''}</span></div>
          ${certs.length ? html`<ul class="history">${certs.map((c, i) => {
            const isImg = c.file && /^image\//.test(c.file.type);
            const who = c.by ? (c.by === S.me.id ? 'את/ה' : names[c.by] || 'חבר/ת צוות') : '';
            return html`<li key=${c.id}>
              <span class="doc">${c.file && c.file.id && isImg ? html`<img src=${blobUrl(c.file.id)} alt="" loading="lazy" />` : html`<${Icon} n="description" />`}</span>
              <div class="tx"><b style=${{ fontWeight: 600 }}>${i === 0 ? 'האישור הנוכחי' : 'אישור קודם'}${c.fields.insurer ? ' · ' + c.fields.insurer : ''}</b>
                <span>הועלה ${fmtStamp(c.createdAt)}${who ? ' · ' + who : ''} · ${c.source === 'ai' ? 'נקרא אוטומטית ואומת' : 'הוזן ידנית'}${c.file ? '' : ' · ללא קובץ'}</span></div>
              ${c.file && c.file.id ? html`<a class="btn sm" href=${blobUrl(c.file.id)} target="_blank" rel="noopener"><${Icon} n="open_in_new" />הקובץ</a>` : null}
              ${S.readOnly ? null : html`<${ConfirmButton} cls="quiet sm" icon="delete" label="" aria="מחיקת האישור" confirm="מחיקה?" onConfirm=${async () => { try { await Store.deleteCert(c.id); Store.log_('delete', 'נמחק אישור של ' + sub.name, sub.id); toast('האישור נמחק'); } catch (e) { toast(dbErrorText(e), 'bad'); } }} />`}
            </li>`;
          })}</ul>` : html`<div class="empty"><${Icon} n="upload_file" /><b>עדיין לא הועלה אישור</b><button type="button" class="btn primary" onClick=${() => go('check', sub.id)}>העלאת אישור</button></div>`}
        </section>
      </div>

      <div>
        <section class="card"><div class="head"><h2 class="h2">אנשי קשר</h2></div><div class="body">
          <dl class="kv">
            <dt>איש קשר</dt><dd>${sub.contact || html`<span class="muted">—</span>`}</dd>
            <dt>טלפון</dt><dd>${sub.phone ? html`<span class="copyline"><span class="num">${sub.phone}</span><button type="button" class="iconbtn" aria-label="העתקת הטלפון" onClick=${() => copyText(sub.phone, 'הטלפון הועתק')}><${Icon} n="content_copy" /></button></span>` : html`<span class="muted">—</span>`}</dd>
            <dt>אימייל</dt><dd>${sub.email ? html`<span class="copyline"><span class="addr">${sub.email}</span><button type="button" class="iconbtn" aria-label="העתקת האימייל" onClick=${() => copyText(sub.email, 'האימייל הועתק')}><${Icon} n="content_copy" /></button></span>` : html`<span class="muted">—</span>`}</dd>
            <dt>סוכן ביטוח</dt><dd>${sub.agent || html`<span class="muted">—</span>`}</dd>
            <dt>אימייל סוכן</dt><dd>${sub.agentEmail ? html`<span class="copyline"><span class="addr">${sub.agentEmail}</span><button type="button" class="iconbtn" aria-label="העתקת אימייל הסוכן" onClick=${() => copyText(sub.agentEmail, 'האימייל הועתק')}><${Icon} n="content_copy" /></button></span>` : html`<span class="muted">—</span>`}</dd>
            ${sub.agentPhone ? html`<dt>טלפון סוכן</dt><dd><span class="num">${sub.agentPhone}</span></dd>` : null}
          </dl>
        </div></section>
        <section class="card"><div class="head"><h2 class="h2">דרישות ביטוח</h2></div><div class="body" style=${{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label class="sr" for="sv-prof">פרופיל דרישות</label>
          <select id="sv-prof" class="input" disabled=${S.readOnly} value=${profile ? profile.id : ''} onChange=${(e) => setProfile(e.target.value)}>
            ${S.profiles.map((x) => html`<option key=${x.id} value=${x.id}>${x.name}</option>`)}
          </select>
          ${r.orphan && S.profiles.length ? html`<p class="hint" style=${{ fontSize: '12.5px', color: 'var(--warn)' }}>הפרופיל המקורי נמחק, ולכן נבדקות דרישות ״${profile ? profile.name : ''}״.</p>` : null}
          <button type="button" class="btn quiet sm" style=${{ alignSelf: 'flex-start' }} onClick=${() => go('rules')}>עריכת הדרישות<${Icon} n="chevron_left" /></button>
        </div></section>
        ${sub.notes ? html`<section class="card"><div class="head"><h2 class="h2">הערות</h2></div><div class="body soft" style=${{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>${sub.notes}</div></section>` : null}
        ${S.readOnly ? null : html`<div><${ConfirmButton} icon="person_remove" label="הסרת קבלן המשנה" confirm="ללחוץ שוב להסרה" onConfirm=${async () => {
          try { await Store.deleteSub(sub.id); Store.log_('delete', sub.name + ' הוסר מהפרויקט'); toast('קבלן המשנה הוסר'); go('home'); } catch (e) { toast(dbErrorText(e), 'bad'); }
        }} /></div>`}
      </div>
    </div>
    ${modal === 'edit' ? html`<${SubModal} sub=${sub} onClose=${() => setModal(null)} />` : null}
    ${modal === 'mail' ? html`<${MailModal} r=${r} project=${p} onClose=${() => setModal(null)} />` : null}
    ${modal === 'waive' ? html`<${WaiveModal} r=${r} onClose=${() => setModal(null)} />` : null}
  </div>`;
}

function MailModal({ r, project, onClose }) {
  const m = agentEmail(r.sub, r.ev, project, r.profile);
  const all = m.subject + '\n\n' + m.body;
  const to = r.sub.agentEmail || r.sub.email || '';
  return html`<${Modal} title="מייל לסוכן הביטוח" onClose=${onClose} wide footer=${html`
    <button type="button" class="btn primary" onClick=${() => { copyText(all, 'המייל הועתק. אפשר להדביק אותו בתוכנת הדואר.'); Store.log_('request', 'הוכן מייל תיקון לסוכן של ' + r.sub.name, r.sub.id); }}><${Icon} n="content_copy" />העתקת המייל</button>
    ${to ? html`<a class="btn" href=${'mailto:' + to + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body)}><${Icon} n="mail" />פתיחה בתוכנת הדואר</a>` : null}
    <button type="button" class="btn quiet" onClick=${onClose}>סגירה</button>`}>
    <div class="grid2">
      <div class="field"><span class="label">אל</span>${to ? html`<span class="copyline"><span class="addr">${to}</span><button type="button" class="iconbtn" aria-label="העתקת הכתובת" onClick=${() => copyText(to, 'הכתובת הועתקה')}><${Icon} n="content_copy" /></button></span>` : html`<span class="muted">לא נשמר אימייל של הסוכן. אפשר להוסיף אותו בעריכת קבלן המשנה.</span>`}</div>
      <div class="field"><span class="label">נושא</span><span>${m.subject}</span></div>
    </div>
    <div class="field"><label for="mail-body">גוף ההודעה</label><textarea id="mail-body" class="input" readonly style=${{ minHeight: '280px' }} value=${m.body}></textarea></div>
    <p class="muted" style=${{ fontSize: '13px' }}>הקישור לתוכנת הדואר לא עובד בכל מכשיר. אם לא נפתח דבר, העתיקו את המייל.</p>
  <//>`;
}

function WaiveModal({ r, onClose }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fixes = r.ev.findings.filter((f) => f.lvl === 'fix');
  const save = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await Store.saveCert(Object.assign({}, r.cert, { exception: { note: note.trim(), by: Store.me.id, at: Date.now() } }));
      Store.log_('exception', 'אושרה חריגה ל' + r.sub.name + ': ' + note.trim(), r.sub.id);
      toast('החריגה אושרה. הקבלן מורשה להיכנס.');
      onClose();
    } catch (e) { toast(dbErrorText(e), 'bad'); setBusy(false); }
  };
  return html`<${Modal} title="אישור חריגה" onClose=${onClose} footer=${html`
    <button type="button" class="btn primary" disabled=${!note.trim() || busy} onClick=${save}>אישור החריגה</button>
    <button type="button" class="btn quiet" onClick=${onClose}>ביטול</button>`}>
    <p class="lede">חריגה מאפשרת כניסה לאתר למרות הממצאים הבאים. אישור שפג לא ניתן לאשר בחריגה.</p>
    <ul class="findings card" style=${{ background: 'var(--card)' }}>${fixes.map((f) => html`<li key=${f.key} class="f-fix"><${Icon} n="error" /><div class="tx"><b>${f.title}</b></div></li>`)}</ul>
    <div class="field"><label for="waive-note">מי אישר ולמה</label><textarea id="waive-note" class="input" style=${{ minHeight: '96px' }} placeholder="לדוגמה: אושר על ידי מנהל הביטוח, הסוכן הבטיח תיקון עד יום ה׳" value=${note} onInput=${(e) => setNote(e.target.value)}></textarea></div>
  <//>`;
}

/* ---------- add or edit subcontractors ---------- */
function blankSub(profiles) {
  return { name: '', companyId: '', trade: '', profile: profiles[0] ? profiles[0].id : '', contact: '', phone: '', email: '', agent: '', agentEmail: '', agentPhone: '', workFrom: null, workTo: null, notes: '' };
}
function SubModal({ sub, onClose, onCreated }) {
  const S = useStore();
  const editing = !!sub;
  const [tab, setTab] = useState('one');
  const [d, setD] = useState(() => Object.assign(blankSub(S.profiles), sub || {}));
  const [paste, setPaste] = useState('');
  const [pasteProf, setPasteProf] = useState(S.profiles[0] ? S.profiles[0].id : '');
  const [busy, setBusy] = useState(false);
  const set = (x) => setD(Object.assign({}, d, x));
  const parsed = useMemo(() => parseSubList(paste), [paste]);
  const dup = !editing && d.name.trim() && S.subs.some((s) => namesMatch(s.name, d.name) || (digits(d.companyId) && digits(s.companyId) === digits(d.companyId)));
  const saveOne = async (e) => {
    if (e) e.preventDefault();
    if (!d.name.trim() || busy) return;
    setBusy(true);
    try {
      const rec = Object.assign({}, d, { name: d.name.trim(), companyId: d.companyId.trim(), workFrom: isISO(d.workFrom) ? d.workFrom : null, workTo: isISO(d.workTo) ? d.workTo : null });
      if (editing) {
        await Store.saveSub(Object.assign({}, sub, rec));
        Store.log_('edit', 'פרטי ' + rec.name + ' עודכנו', sub.id);
        toast('הפרטים נשמרו');
        onClose();
      } else {
        const id = uid('s');
        await Store.saveSub(Object.assign({ id, pid: Store.pid, createdAt: Date.now() }, rec));
        Store.log_('sub', rec.name + ' נוסף לפרויקט', id);
        toast(rec.name + ' נוסף לפרויקט');
        onClose();
        if (onCreated) onCreated(id); else go('sub', id);
      }
    } catch (err) { toast(dbErrorText(err), 'bad'); setBusy(false); }
  };
  const saveMany = async () => {
    if (!parsed.length || busy) return;
    setBusy(true);
    try {
      const now = Date.now();
      let i = 0;
      for (const x of parsed) await Store.saveSub(Object.assign(blankSub(S.profiles), x, { id: uid('s'), pid: Store.pid, profile: pasteProf, createdAt: now + i++ }));
      Store.log_('sub', plural(parsed.length, 'קבלן משנה אחד נוסף', 'קבלני משנה נוספו') + ' מרשימה');
      toast(plural(parsed.length, 'קבלן משנה אחד נוסף', 'קבלני משנה נוספו') + ' לפרויקט');
      onClose();
    } catch (err) { toast(dbErrorText(err), 'bad'); setBusy(false); }
  };
  const footer = tab === 'one' || editing
    ? html`<button type="button" class="btn primary" disabled=${!d.name.trim() || busy} onClick=${saveOne}>${editing ? 'שמירה' : 'הוספה'}</button><button type="button" class="btn quiet" onClick=${onClose}>ביטול</button>`
    : html`<button type="button" class="btn primary" disabled=${!parsed.length || busy} onClick=${saveMany}>${parsed.length ? 'הוספת ' + plural(parsed.length, 'קבלן אחד', 'קבלנים') : 'הוספה'}</button><button type="button" class="btn quiet" onClick=${onClose}>ביטול</button>`;
  return html`<${Modal} title=${editing ? 'עריכת ' + sub.name : 'הוספת קבלני משנה'} onClose=${onClose} wide footer=${footer}>
    ${!editing ? html`<div class="chips" role="group" aria-label="אופן ההוספה">
      <button type="button" class="chip" aria-pressed=${tab === 'one' ? 'true' : 'false'} onClick=${() => setTab('one')}>קבלן אחד</button>
      <button type="button" class="chip" aria-pressed=${tab === 'many' ? 'true' : 'false'} onClick=${() => setTab('many')}>רשימה מאקסל</button>
    </div>` : null}
    ${tab === 'one' || editing ? html`<form onSubmit=${saveOne} style=${{ display: 'contents' }}>
      <div class="grid2">
        <${Field} id="sm-name" label="שם החברה"><input id="sm-name" class="input" required value=${d.name} onInput=${(e) => set({ name: e.target.value })} placeholder="ש.מ. חשמל בע״מ" /><//>
        <${Field} id="sm-cid" label="ח.פ." hint=${dup ? 'כבר קיים בפרויקט קבלן עם שם או ח.פ. דומים' : 'משמש לוודא שהאישור הונפק לחברה הנכונה'}><input id="sm-cid" class="input mono ltr" inputmode="numeric" value=${d.companyId} onInput=${(e) => set({ companyId: e.target.value })} placeholder="515123456" /><//>
      </div>
      <div class="grid2">
        <${Field} id="sm-trade" label="תחום"><input id="sm-trade" class="input" list="trades" value=${d.trade} onInput=${(e) => set({ trade: e.target.value })} placeholder="חשמל" /><datalist id="trades">${TRADES.map((t) => html`<option key=${t} value=${t}></option>`)}</datalist><//>
        <${Field} id="sm-prof" label="דרישות ביטוח"><select id="sm-prof" class="input" value=${d.profile} onChange=${(e) => set({ profile: e.target.value })}>${S.profiles.map((x) => html`<option key=${x.id} value=${x.id}>${x.name}</option>`)}</select><//>
      </div>
      <div class="grid3">
        <${Field} id="sm-contact" label="איש קשר"><input id="sm-contact" class="input" value=${d.contact} onInput=${(e) => set({ contact: e.target.value })} /><//>
        <${Field} id="sm-phone" label="טלפון נייד" hint="לבקשות בוואטסאפ"><input id="sm-phone" class="input" type="tel" value=${d.phone} onInput=${(e) => set({ phone: e.target.value })} placeholder="050-1234567" /><//>
        <${Field} id="sm-email" label="אימייל"><input id="sm-email" class="input" type="email" value=${d.email} onInput=${(e) => set({ email: e.target.value })} /><//>
      </div>
      <div class="grid3">
        <${Field} id="sm-agent" label="סוכן ביטוח"><input id="sm-agent" class="input" value=${d.agent} onInput=${(e) => set({ agent: e.target.value })} /><//>
        <${Field} id="sm-aemail" label="אימייל הסוכן"><input id="sm-aemail" class="input" type="email" value=${d.agentEmail} onInput=${(e) => set({ agentEmail: e.target.value })} /><//>
        <${Field} id="sm-aphone" label="טלפון הסוכן"><input id="sm-aphone" class="input" type="tel" value=${d.agentPhone} onInput=${(e) => set({ agentPhone: e.target.value })} /><//>
      </div>
      <div class="grid2">
        <${Field} id="sm-from" label="תחילת העבודה בפרויקט"><input id="sm-from" class="input" type="date" value=${d.workFrom || ''} onInput=${(e) => set({ workFrom: e.target.value || null })} /><//>
        <${Field} id="sm-to" label="סיום משוער"><input id="sm-to" class="input" type="date" value=${d.workTo || ''} onInput=${(e) => set({ workTo: e.target.value || null })} /><//>
      </div>
      <${Field} id="sm-notes" label="הערות"><textarea id="sm-notes" class="input" style=${{ minHeight: '72px' }} value=${d.notes} onInput=${(e) => set({ notes: e.target.value })}></textarea><//>
    </form>` : html`
      <p class="lede">העתיקו עמודות מאקסל והדביקו כאן. סדר העמודות: שם, ח.פ., תחום, איש קשר, טלפון. אפשר להשמיט עמודות מהסוף.</p>
      <${Field} id="sm-paste" label="הרשימה"><textarea id="sm-paste" class="input" style=${{ minHeight: '150px' }} value=${paste} onInput=${(e) => setPaste(e.target.value)} placeholder=${'ש.מ. חשמל\t515123456\tחשמל\tשמעון\t050-1234567'}></textarea><//>
      <${Field} id="sm-pprof" label="דרישות ביטוח לכל הרשימה"><select id="sm-pprof" class="input" value=${pasteProf} onChange=${(e) => setPasteProf(e.target.value)}>${S.profiles.map((x) => html`<option key=${x.id} value=${x.id}>${x.name}</option>`)}</select><//>
      ${parsed.length ? html`<div class="card tablewrap"><table class="tbl"><thead><tr><th>שם</th><th>ח.פ.</th><th>תחום</th><th>איש קשר</th><th>טלפון</th></tr></thead>
        <tbody>${parsed.slice(0, 50).map((x, i) => html`<tr key=${i} style=${{ cursor: 'default' }}><td>${x.name}</td><td><span class="num">${x.companyId}</span></td><td>${x.trade}</td><td>${x.contact}</td><td><span class="num">${x.phone}</span></td></tr>`)}</tbody></table>
        ${parsed.length > 50 ? html`<p class="muted" style=${{ padding: '10px 14px', fontSize: '13px' }}>ועוד ${parsed.length - 50}</p>` : null}</div>` : null}
    `}
  <//>`;
}

/* ---------- reading the document ---------- */
const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
let pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PDFJS_URL;
      s.onload = () => {
        if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; res(window.pdfjsLib); }
        else { pdfjsPromise = null; rej(new Error('pdfjs')); }
      };
      s.onerror = () => { pdfjsPromise = null; rej(new Error('pdfjs')); };
      document.head.appendChild(s);
    });
  }
  return pdfjsPromise;
}
function canvasBlob(c, q) { return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', q || 0.88)); }
function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = src; }); }
function drawScaled(src, sx, sy, sw, sh, maxW) {
  const k = Math.min(1, maxW / sw);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
/* Pages become previews; for reading, a tall page is split into overlapping halves so small print stays legible. */
async function preparePages(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const sources = [];
  let text = '';
  let pageCount = 1;
  if (isPdf) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    pageCount = doc.numPages;
    const n = Math.min(doc.numPages, 3);
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(2.4, 1700 / v1.width) });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width);
      c.height = Math.ceil(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      sources.push(c);
      try { const tc = await page.getTextContent(); text += tc.items.map((it) => it.str).join(' ') + '\n'; } catch (e) {}
    }
    try { doc.destroy(); } catch (e) {}
  } else {
    const url = URL.createObjectURL(file);
    try { sources.push(await loadImg(url)); } catch (e) { URL.revokeObjectURL(url); throw e; }
    sources.revoke = url;
  }
  const previews = [];
  const full = [];
  const halves = [];
  for (const src of sources) {
    const w = src.naturalWidth || src.width, hgt = src.naturalHeight || src.height;
    const pc = drawScaled(src, 0, 0, w, hgt, 1400);
    const blob = await canvasBlob(pc, 0.86);
    previews.push(URL.createObjectURL(blob));
    full.push(blob);
    if (hgt > w * 1.15) {
      const cut = Math.round(hgt * 0.56);
      halves.push(await canvasBlob(drawScaled(src, 0, 0, w, cut, 1600), 0.9));
      halves.push(await canvasBlob(drawScaled(src, 0, hgt - cut, w, cut, 1600), 0.9));
    } else halves.push(blob);
  }
  if (sources.revoke) URL.revokeObjectURL(sources.revoke);
  return { previews, full, halves, text: text.trim(), pageCount, isPdf };
}

function aiErrorText(code) {
  switch (code) {
    case 'rate_limited': return 'יותר מדי בקשות קריאה כרגע. נסו שוב בעוד דקה, או הזינו ידנית.';
    case 'image_rejected': return 'הקובץ לא התקבל לקריאה. נסו צילום ברור יותר או PDF.';
    case 'session_expired': return 'צריך להתחבר מחדש ל-Claude כדי להשתמש בקריאה האוטומטית.';
    case 'refused': case 'empty_completion': case 'invalid_json': return 'לא הצלחנו לקרוא את האישור. אפשר לנסות שוב או להזין את הפרטים ידנית.';
    case 'prompt_too_large': return 'המסמך ארוך מדי לקריאה אוטומטית. העלו רק את עמודי האישור.';
    case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled': case 'capability_removed': case 'images_unavailable':
      return 'הקריאה האוטומטית לא זמינה בעמוד הזה. אפשר להזין את הפרטים ידנית.';
    default: return 'הקריאה האוטומטית נכשלה בגלל תקלה זמנית. נסו שוב, או הזינו ידנית.';
  }
}

function startFields(profile) {
  const f = emptyFields();
  if (profile) for (const t of REQ_TYPES) if (profile.lines[t].on) f.policies.push({ type: t, label: COVER[t].long, policyNo: '', start: null, end: null, limit: null, currency: 'ILS', codes: [] });
  return f;
}

/* ---------- certificate check ---------- */
function CheckView({ sid0 }) {
  const S = useStore();
  const D = derive();
  const [sid, setSid] = useState(sid0 || '');
  const [file, setFile] = useState(null);
  const [prep, setPrep] = useState(null);
  const [phase, setPhase] = useState('pick'); // pick | preparing | ready | reading | review | saving
  const [fields, setFields] = useState(null);
  const [source, setSource] = useState('manual');
  const [note, setNote] = useState(null);
  const [over, setOver] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [streamed, setStreamed] = useState(false);
  const ctl = useRef(null);
  const fileSeq = useRef(0);
  useEffect(() => { setSid(sid0 || ''); }, [sid0]);
  useEffect(() => () => { if (ctl.current) ctl.current.abort(); }, []);
  useEffect(() => () => { if (prep) prep.previews.forEach((u) => URL.revokeObjectURL(u)); }, [prep]);
  useEffect(() => {
    if (phase !== 'reading') return;
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  const row = D.rows.find((r) => r.sub.id === sid) || null;
  const profile = row ? row.profile : S.profiles[0] || null;
  const live = fields && row ? evaluate(row.sub, { id: 'draft', fields: cleanFields(fields) }, profile, D.project, D.today) : null;
  const subsSorted = S.subs.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));

  const pick = async (f) => {
    if (!f) return;
    const okType = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(f.type) || /\.(pdf|jpe?g|png|webp)$/i.test(f.name);
    if (!okType) { toast('אפשר להעלות PDF או תמונה (JPG, PNG, WebP). צילומי HEIC של אייפון צריך לשמור קודם כ-JPG.', 'bad'); return; }
    if (f.size > 20 * 1024 * 1024) { toast('הקובץ גדול מ-20MB. נסו לשמור אותו בגודל קטן יותר.', 'bad'); return; }
    const seq = ++fileSeq.current;
    if (ctl.current) ctl.current.abort();
    setFile(f); setPrep(null); setFields(null); setNote(null); setSource('manual'); setPhase('preparing');
    try {
      const p = await preparePages(f);
      if (seq !== fileSeq.current) return;
      setPrep(p);
      setPhase('ready');
      if (!Caps.ai || (!Caps.aiImages && !p.text)) { setFields(startFields(profile)); setPhase('review'); }
    } catch (e) {
      if (seq !== fileSeq.current) return;
      setPrep(null);
      setNote({ tone: 'warn', text: 'לא הצלחנו להציג את הקובץ. אפשר להמשיך ולהזין את הפרטים ידנית, או להעלות צילום של האישור.' });
      setFields(startFields(profile));
      setPhase('review');
    }
  };

  const read = async () => {
    if (!prep || !Caps.sample) return;
    const c = new AbortController();
    ctl.current = c;
    setPhase('reading'); setElapsed(0); setStreamed(false); setNote(null);
    try {
      let imgs = [];
      let prompt = EXTRACT_PROMPT;
      if (Caps.aiImages) {
        const useHalves = prep.halves.length <= Caps.imgMax;
        imgs = useHalves ? prep.halves : prep.full.slice(0, Caps.imgMax);
        if (!useHalves) prompt = prompt.replace('(for each page: the top part, then the bottom part)', '(one image per page)');
      } else {
        prompt = EXTRACT_PROMPT + '\n\nNo images are attached. Below is the text layer extracted from the PDF; Hebrew words may appear in reversed order.\n\n' + prep.text.slice(0, 20000);
      }
      const out = await Caps.sample.json(prompt, Object.assign({ signal: c.signal, modelTier: 'default', onText: () => setStreamed(true) }, imgs.length ? { images: imgs } : {}));
      const clean = cleanFields(out);
      if (!clean.policies.length && !clean.insuredName) {
        setFields(startFields(profile));
        setNote({ tone: 'warn', text: (out && out.notes) || 'לא מצאנו באישור פוליסות לקריאה. בדקו שהעליתם את אישור קיום הביטוחים, או הזינו ידנית.' });
        setSource('manual');
      } else {
        setFields(clean);
        setSource('ai');
        const conf = out && out.confidence;
        setNote({ tone: conf === 'low' ? 'warn' : 'ok', text: (conf === 'low' ? 'חלק מהפרטים לא היו ברורים. ' : 'הפרטים נקראו מהמסמך. ') + 'עברו עליהם מול האישור לפני השמירה.' + (out && out.notes ? ' ' + out.notes : '') });
      }
      setPhase('review');
    } catch (e) {
      if (e && e.code === 'cancelled') { setPhase('ready'); return; }
      if (e && ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e.code)) Caps.ai = false;
      if (e && e.code === 'images_unavailable') Caps.aiImages = false;
      setNote({ tone: 'bad', text: aiErrorText(e && e.code) });
      setFields(fields || startFields(profile));
      setPhase('review');
    } finally { ctl.current = null; }
  };

  const save = async () => {
    if (!row || !fields) return;
    setPhase('saving');
    const certId = uid('c');
    let fileRec = null;
    try {
      if (file && Caps.assets) {
        try {
          const type = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : 'image/jpeg');
          const up = await Caps.assets.upload(file, { type });
          fileRec = { id: up.id, name: file.name.slice(0, 160), type, size: file.size };
        } catch (e) {
          toast('הקובץ לא נשמר (' + (e && e.code === 'too_large' ? 'גדול מדי' : 'תקלה בהעלאה') + '). הפרטים יישמרו בלעדיו.', 'bad');
        }
      }
      const clean = cleanFields(fields);
      await Store.saveCert({ id: certId, pid: Store.pid, sid: row.sub.id, createdAt: Date.now(), by: Store.me.id, source, file: fileRec, fields: clean, exception: null });
      const ev = evaluate(row.sub, { id: certId, fields: clean }, profile, D.project, D.today);
      Store.log_('cert', 'נבדק אישור של ' + row.sub.name + ': ' + statusLabel(ev), row.sub.id);
      toast(ev.gate === 'in' ? 'האישור נשמר. ' + row.sub.name + ' מורשה להיכנס.' : 'האישור נשמר. נמצאו דברים לתקן.');
      go('sub', row.sub.id);
    } catch (e) { toast(dbErrorText(e), 'bad'); setPhase('review'); }
  };

  const setF = (x) => setFields(Object.assign({}, fields, x));
  const setPol = (i, x) => { const pols = fields.policies.slice(); pols[i] = Object.assign({}, pols[i], x); setF({ policies: pols }); };
  const reset = () => { if (ctl.current) ctl.current.abort(); fileSeq.current++; setFile(null); setPrep(null); setFields(null); setNote(null); setPhase('pick'); };

  return html`<div class="page">
    <div><span class="eyebrow">בדיקת אישור קיום ביטוחים</span><h1 class="h1">${row ? row.sub.name : 'בדיקת אישור חדש'}</h1><p class="lede">מעלים את האישור שהתקבל, Tokef קורא אותו ומשווה לדרישות הביטוח של הפרויקט. שום דבר לא נשמר עד שמאשרים.</p></div>
    <div class="check">
      <div>
        <section class=${'card step' + (row ? ' done' : '')}><div class="body step">
          <div class="sh"><span class="sn">1</span><h2 class="h2">קבלן המשנה</h2></div>
          <div class="row">
            <label class="sr" for="ck-sub">קבלן משנה</label>
            <select id="ck-sub" class="input" style=${{ flex: '1 1 240px' }} value=${sid} onChange=${(e) => setSid(e.target.value)}>
              <option value="">בחירת קבלן משנה…</option>
              ${subsSorted.map((s) => html`<option key=${s.id} value=${s.id}>${s.name}</option>`)}
            </select>
            ${S.readOnly ? null : html`<button type="button" class="btn" onClick=${() => setAddOpen(true)}><${Icon} n="person_add" />חדש</button>`}
          </div>
          ${row ? html`<p class="soft" style=${{ fontSize: '13.5px' }}>ייבדק מול ״${profile ? profile.name : 'ללא דרישות'}״${row.ev.status !== 'missing' ? '. האישור הנוכחי: ' + statusLabel(row.ev) : ''}</p>` : null}
        </div></section>

        <section class=${'card step' + (file ? ' done' : '')}><div class="body step">
          <div class="sh"><span class="sn">2</span><h2 class="h2">האישור</h2></div>
          ${!file ? html`<div class=${'drop' + (over ? ' over' : '')} onDragOver=${(e) => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)} onDrop=${(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); }}>
              <${Icon} n="upload_file" />
              <b>גוררים לכאן PDF או צילום של האישור</b>
              <span class="muted" style=${{ fontSize: '13.5px' }}>או לוחצים לבחירת קובץ. בטלפון אפשר גם לצלם.</span>
              <input type="file" aria-label="בחירת קובץ האישור" accept="application/pdf,image/jpeg,image/png,image/webp" onChange=${(e) => { pick(e.target.files && e.target.files[0]); e.target.value = ''; }} />
            </div>
            ${!fields ? html`<button type="button" class="btn quiet sm" style=${{ alignSelf: 'flex-start' }} onClick=${() => { setFields(startFields(profile)); setPhase('review'); setSource('manual'); setFile(null); }}>אין קובץ? הזנה ידנית</button>` : null}`
          : html`<div class="filechip"><${Icon} n=${prep && prep.isPdf ? 'picture_as_pdf' : 'image'} /><div class="tx"><b>${file.name}</b><span><span class="num">${fmtSize(file.size)}</span>${prep && prep.isPdf ? ' · ' + plural(prep.pageCount, 'עמוד אחד', 'עמודים') : ''}</span></div><button type="button" class="btn quiet sm" onClick=${reset}>החלפה</button></div>`}
          ${phase === 'preparing' ? html`<div class="reading-note"><span class="dot-pulse"></span>מכין את המסמך…</div>` : null}
          ${file && prep && Caps.ai && (phase === 'ready' || phase === 'reading' || (phase === 'review' && source === 'manual')) ? html`<div class="row">
            ${phase === 'review' ? html`<button type="button" class="btn" onClick=${read}><${Icon} n="document_scanner" />קריאה אוטומטית</button>`
            : phase === 'ready' ? html`<button type="button" class="btn primary" onClick=${read}><${Icon} n="document_scanner" />קריאה אוטומטית</button><button type="button" class="btn quiet" onClick=${() => { setFields(startFields(profile)); setPhase('review'); }}>הזנה ידנית</button>`
            : html`<div class="reading-note" style=${{ flex: 1 }}><span class="dot-pulse"></span><span style=${{ flex: 1 }}>${streamed ? 'מסיים לקרוא…' : 'קורא את האישור'} <span class="num muted">${elapsed}s</span></span><button type="button" class="btn sm" onClick=${() => ctl.current && ctl.current.abort()}><${Icon} n="stop_circle" />עצירה</button></div>`}
          </div>` : null}
          ${file && phase === 'ready' && Caps.ai ? html`<p class="muted" style=${{ fontSize: '12.5px' }}>הקריאה נעשית בחשבון ה-Claude שלכם ולוקחת בדרך כלל עד דקה. בפעם הראשונה תתבקשו לאשר.</p>` : null}
          ${!Caps.ai && file ? html`<div class="notice"><${Icon} n="info" /><span>בגרסת ההדגמה מזינים את פרטי האישור ידנית, והבדיקה מול הדרישות מתבצעת מיד. קריאה אוטומטית של האישור זמינה בגרסה המלאה.</span></div>` : null}
        </div></section>

        ${fields ? html`<section class="card step"><div class="body step">
          <div class="sh"><span class="sn">3</span><h2 class="h2">הפרטים באישור</h2>${source === 'ai' ? html`<span class="tag accent">נקרא מהמסמך</span>` : null}</div>
          ${note ? html`<div class=${'notice ' + note.tone}><${Icon} n=${note.tone === 'ok' ? 'check_circle' : note.tone === 'bad' ? 'error' : 'info'} /><span>${note.text}</span></div>` : null}
          <div class="grid2">
            <${Field} id="ck-in" label="שם המבוטח"><input id="ck-in" class="input" value=${fields.insuredName} onInput=${(e) => setF({ insuredName: e.target.value })} /><//>
            <${Field} id="ck-iid" label="ח.פ. המבוטח"><input id="ck-iid" class="input mono ltr" value=${fields.insuredId} onInput=${(e) => setF({ insuredId: e.target.value })} /><//>
            <${Field} id="ck-rq" label="מבקש האישור"><input id="ck-rq" class="input" value=${fields.requester} onInput=${(e) => setF({ requester: e.target.value })} /><//>
            <${Field} id="ck-rid" label="ח.פ. מבקש האישור"><input id="ck-rid" class="input mono ltr" value=${fields.requesterId} onInput=${(e) => setF({ requesterId: e.target.value })} /><//>
            <${Field} id="ck-ins" label="חברת הביטוח"><input id="ck-ins" class="input" value=${fields.insurer} onInput=${(e) => setF({ insurer: e.target.value })} /><//>
            <${Field} id="ck-ag" label="סוכן"><input id="ck-ag" class="input" value=${fields.agent} onInput=${(e) => setF({ agent: e.target.value })} /><//>
            <${Field} id="ck-iss" label="תאריך הנפקה"><input id="ck-iss" class="input" type="date" value=${fields.issueDate || ''} onInput=${(e) => setF({ issueDate: e.target.value || null })} /><//>
            <${Field} id="ck-cd" label="הודעה מוקדמת לפני ביטול (ימים)"><input id="ck-cd" class="input mono ltr" inputmode="numeric" value=${fields.cancelDays == null ? '' : String(fields.cancelDays)} onInput=${(e) => { const n = toNumber(e.target.value); setF({ cancelDays: n == null ? null : n }); }} /><//>
          </div>
          <div class="field"><span class="label">פוליסות באישור</span></div>
          ${fields.policies.map((p, i) => html`<div key=${i} class="pol">
            <div class="ph2">
              <label class="sr" for=${'pt-' + i}>סוג הביטוח</label>
              <select id=${'pt-' + i} class="input" style=${{ flex: 1 }} value=${p.type} onChange=${(e) => setPol(i, { type: e.target.value, label: COVER[e.target.value].long })}>${POLICY_TYPES.map((t) => html`<option key=${t} value=${t}>${COVER[t].long}</option>`)}</select>
              <button type="button" class="iconbtn" aria-label="הסרת הפוליסה" onClick=${() => setF({ policies: fields.policies.filter((_, j) => j !== i) })}><${Icon} n="delete" /></button>
            </div>
            <div class="pol-grid">
              <${Field} id=${'pn-' + i} label="מספר פוליסה"><input id=${'pn-' + i} class="input mono ltr" value=${p.policyNo} onInput=${(e) => setPol(i, { policyNo: e.target.value })} /><//>
              <${Field} id=${'ps-' + i} label="מתאריך"><input id=${'ps-' + i} class="input" type="date" value=${p.start || ''} onInput=${(e) => setPol(i, { start: e.target.value || null })} /><//>
              <${Field} id=${'pe-' + i} label="עד תאריך"><input id=${'pe-' + i} class="input" type="date" value=${p.end || ''} onInput=${(e) => setPol(i, { end: e.target.value || null })} /><//>
              <${Field} id=${'pl-' + i} label=${p.currency === 'USD' ? 'גבול אחריות ($)' : 'גבול אחריות'}><${MoneyInput} id=${'pl-' + i} value=${p.limit} onChange=${(n) => setPol(i, { limit: n })} /><//>
            </div>
            <${Field} id=${'pc-' + i} label="קודי כיסוי באישור" hint="המספרים בני 3 הספרות שמופיעים ליד הפוליסה, מופרדים בפסיק"><input id=${'pc-' + i} class="input mono ltr" value=${p.codes.join(', ')} onChange=${(e) => setPol(i, { codes: parseCodes(e.target.value) })} placeholder="302, 309, 328" /><//>
          </div>`)}
          <button type="button" class="btn sm" style=${{ alignSelf: 'flex-start' }} onClick=${() => setF({ policies: fields.policies.concat([{ type: 'tpl', label: COVER.tpl.long, policyNo: '', start: null, end: null, limit: null, currency: 'ILS', codes: [] }]) })}><${Icon} n="add" />הוספת פוליסה</button>
        </div></section>` : null}
      </div>

      <div class="viewer">
        ${prep && prep.previews.length ? prep.previews.map((u, i) => html`<div key=${u} class=${'sheet' + (phase === 'reading' && i === 0 ? ' reading' : '')}><img src=${u} alt=${'עמוד ' + (i + 1) + ' של האישור'} /></div>`)
        : html`<div class="ph">${phase === 'preparing' ? 'מכין תצוגה…' : 'כאן תופיע תצוגה של האישור'}</div>`}
        ${live ? html`<section class="card verdict"><div class="body verdict">
          <div class="vh"><b class="h2" style=${{ flex: 1 }}>תוצאת הבדיקה</b><${StatusPill} ev=${live} /></div>
          <div class=${'verdict-big ' + live.gate}>${live.gate === 'in' ? html`<${Icon} n="check_circle" fill />יהיה מורשה כניסה` : html`<${Icon} n="block" />ייחסם לכניסה`}</div>
          <ul class="findings" style=${{ marginInline: '-20px' }}>${live.findings.filter((f) => f.lvl !== 'info').slice(0, 8).map((f) => html`<li key=${f.key} class=${'f-' + f.lvl}><${FindingIcon} lvl=${f.lvl} /><div class="tx"><b>${f.title}</b></div></li>`)}
            ${!live.findings.filter((f) => f.lvl !== 'info').length ? html`<li class="f-ok"><${Icon} n="verified_user" fill /><div class="tx"><b>כל הדרישות התקיימו</b></div></li>` : null}</ul>
          <button type="button" class="btn primary lg block" disabled=${phase === 'saving' || S.readOnly} onClick=${save}>${phase === 'saving' ? 'שומר…' : 'שמירת האישור'}</button>
          ${S.readOnly ? html`<p class="muted" style=${{ fontSize: '13px' }}>שמירה דורשת הרשאת עריכה. הבדיקה עצמה זמינה גם בצפייה בלבד.</p>` : null}
        </div></section>` : fields && !row ? html`<div class="notice warn"><${Icon} n="info" /><span>בחרו קבלן משנה כדי לראות את תוצאת הבדיקה ולשמור.</span></div>` : null}
      </div>
    </div>
    ${addOpen ? html`<${SubModal} onClose=${() => setAddOpen(false)} onCreated=${(id) => setSid(id)} />` : null}
  </div>`;
}

/* ---------- requirement profiles ---------- */
function Rules() {
  const S = useStore();
  const D = derive();
  const [selId, setSelId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addCode, setAddCode] = useState({});
  const sel = S.profiles.find((p) => p.id === selId) || S.profiles[0] || null;
  useEffect(() => { if (sel) setDraft(JSON.parse(JSON.stringify(sel))); else setDraft(null); }, [sel && sel.id, sel && JSON.stringify(sel)]);
  const usage = (id) => S.subs.filter((s) => s.profile === id).length;
  const dirty = draft && sel && JSON.stringify(draft) !== JSON.stringify(sel);
  const setLine = (t, x) => setDraft(Object.assign({}, draft, { lines: Object.assign({}, draft.lines, { [t]: Object.assign({}, draft.lines[t], x) }) }));
  const toggleCode = (t, c) => { const cur = draft.lines[t].codes; setLine(t, { codes: cur.includes(c) ? cur.filter((x) => x !== c) : cur.concat([c]).sort((a, b) => a - b) }); };
  const save = async () => {
    if (!draft.name.trim()) { toast('לפרופיל צריך שם', 'bad'); return; }
    setBusy(true);
    try { await Store.saveProfile(Object.assign({}, draft, { name: draft.name.trim() })); Store.log_('rules', 'עודכנו הדרישות ״' + draft.name.trim() + '״'); toast('הדרישות נשמרו. כל קבלני המשנה נבדקו מחדש.'); }
    catch (e) { toast(dbErrorText(e), 'bad'); }
    setBusy(false);
  };
  const create = async (base, name, quiet) => {
    const id = uid('r');
    const rec = { id, pid: Store.pid, key: base.key || 'custom', name, lines: JSON.parse(JSON.stringify(base.lines)), cancelDays: base.cancelDays == null ? 30 : base.cancelDays, requester: base.requester !== false, order: Store.profiles.length, createdAt: Date.now() };
    try { await Store.saveProfile(rec); if (!quiet) { Store.log_('rules', 'נוסף פרופיל דרישות ״' + name + '״'); setSelId(id); toast('הפרופיל נוסף'); } }
    catch (e) { toast(dbErrorText(e), 'bad'); }
  };
  const addDefaults = async () => {
    for (const d of DEFAULT_PROFILES) await create(d, d.name, true);
    Store.log_('rules', 'נוספו ארבעת פרופילי הדרישות הנפוצים');
    toast('נוספו ארבעה פרופילים');
  };
  return html`<div class="page">
    <div class="row" style=${{ alignItems: 'flex-end' }}>
      <div style=${{ flex: '1 1 320px' }}><span class="eyebrow">דרישות ביטוח</span><h1 class="h1">מה כל קבלן משנה צריך להציג</h1><p class="lede">הדרישות נלקחות מנספח הביטוח בחוזה. כל קבלן משנה משויך לפרופיל אחד, וכל שינוי כאן בודק מחדש את כל האישורים בפרויקט.</p></div>
      ${S.readOnly ? null : html`<div class="row">
        ${Caps.ai ? html`<button type="button" class="btn" onClick=${() => setImportOpen(true)}><${Icon} n="document_scanner" />ייבוא מנספח החוזה</button>` : null}
        <button type="button" class="btn" onClick=${() => create(sel || DEFAULT_PROFILES[0], 'פרופיל חדש')}><${Icon} n="add" />פרופיל חדש</button>
      </div>`}
    </div>
    ${!S.profiles.length ? html`<div class="card empty"><${Icon} n="tune" /><b>אין עדיין פרופילי דרישות</b>${S.readOnly ? null : html`<button type="button" class="btn primary" onClick=${addDefaults}>הוספת ארבעת הפרופילים הנפוצים</button>`}</div>` : html`
    <div class="profiles" role="group" aria-label="פרופילים">
      ${S.profiles.map((p) => html`<button key=${p.id} type="button" class="prof" aria-pressed=${sel && sel.id === p.id ? 'true' : 'false'} onClick=${() => setSelId(p.id)}>
        <b>${p.name}</b>
        <span class="lines">${REQ_TYPES.filter((t) => p.lines[t].on).map((t) => html`<span key=${t} class="tag">${COVER[t].label}${p.lines[t].min ? ' ' + moneyShort(p.lines[t].min) : ''}</span>`)}</span>
        <span class="muted" style=${{ fontSize: '13px' }}>${usage(p.id) ? 'בשימוש אצל ' + plural(usage(p.id), 'קבלן אחד', 'קבלנים') : 'לא בשימוש'}</span>
      </button>`)}
    </div>
    ${draft ? html`<section class="card" aria-labelledby="ed-h">
      <div class="head">
        <label class="sr" for="pr-name">שם הפרופיל</label>
        <input id="pr-name" class="input" style=${{ flex: '1 1 260px', maxWidth: '420px', fontWeight: 600 }} value=${draft.name} onInput=${(e) => setDraft(Object.assign({}, draft, { name: e.target.value }))} />
        <span class="spacer"></span>
        <h2 class="sr" id="ed-h">עריכת הפרופיל</h2>
        <button type="button" class="btn primary" disabled=${!dirty || busy || S.readOnly} onClick=${save}>${busy ? 'שומר…' : 'שמירה'}</button>
        <button type="button" class="btn quiet" disabled=${!dirty} onClick=${() => setDraft(JSON.parse(JSON.stringify(sel)))}>ביטול שינויים</button>
      </div>
      ${REQ_TYPES.map((t) => {
        const l = draft.lines[t];
        const extra = l.codes.filter((c) => !CODES[c]);
        return html`<div key=${t} class=${'req-line' + (l.on ? '' : ' off')}>
          <${Switch} id=${'sw-' + t} checked=${l.on} label=${'נדרש ' + COVER[t].long} onChange=${(v) => setLine(t, { on: v })} />
          <div class="nm"><b>${COVER[t].long}</b><span>${l.on ? 'נדרש' : 'לא נדרש'}</span></div>
          <${Field} id=${'mn-' + t} label=${COVER[t].unit + ' מינימלי'}><${MoneyInput} id=${'mn-' + t} value=${l.min} onChange=${(n) => setLine(t, { min: n || 0 })} /><//>
          <div class="field"><span class="label">סעיפים שחייבים להופיע</span>
            <div class="codepick">
              ${CODE_LIST.map((c) => html`<button key=${c} type="button" aria-pressed=${l.codes.includes(c) ? 'true' : 'false'} title=${codeLong(c)} onClick=${() => toggleCode(t, c)}><span class="num">${c}</span>${codeShort(c)}</button>`)}
              ${extra.map((c) => html`<button key=${c} type="button" aria-pressed="true" onClick=${() => toggleCode(t, c)}><span class="num">${c}</span>קוד נוסף</button>`)}
              <span class="row" style=${{ gap: '4px' }}>
                <label class="sr" for=${'ac-' + t}>קוד נוסף</label>
                <input id=${'ac-' + t} class="input mono ltr" style=${{ width: '84px', height: '28px', fontSize: '12.5px' }} placeholder="3xx" value=${addCode[t] || ''} onInput=${(e) => setAddCode(Object.assign({}, addCode, { [t]: e.target.value }))} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); const c = parseCodes(addCode[t])[0]; if (c && !l.codes.includes(c)) toggleCode(t, c); setAddCode(Object.assign({}, addCode, { [t]: '' })); } }} />
              </span>
            </div>
          </div>
        </div>`;
      })}
      <div class="body" style=${{ borderTop: '1px solid var(--hair)', display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'flex-end' }}>
        <${Field} id="pr-cd" label="הודעה מוקדמת לפני ביטול"><select id="pr-cd" class="input" style=${{ width: '180px' }} value=${String(draft.cancelDays || 0)} onChange=${(e) => setDraft(Object.assign({}, draft, { cancelDays: Number(e.target.value) }))}>${[0, 30, 60, 90].map((d) => html`<option key=${d} value=${String(d)}>${d ? d + ' ימים' : 'לא נבדק'}</option>`)}</select><//>
        <label class="row" style=${{ gap: '10px', fontSize: '14.5px' }} for="pr-rq"><${Switch} id="pr-rq" checked=${draft.requester} label="מבקש האישור חייב להיות החברה שלנו" onChange=${(v) => setDraft(Object.assign({}, draft, { requester: v }))} />מבקש האישור חייב להיות ${D.project && D.project.client ? D.project.client : 'החברה שלנו'}</label>
        <span class="spacer"></span>
        <${ConfirmButton} icon="delete" label="מחיקת הפרופיל" confirm="ללחוץ שוב למחיקה" disabled=${usage(draft.id) > 0 || S.profiles.length < 2 || S.readOnly} onConfirm=${async () => { try { await Store.deleteProfile(draft.id); Store.log_('rules', 'נמחק פרופיל ״' + draft.name + '״'); setSelId(null); toast('הפרופיל נמחק'); } catch (e) { toast(dbErrorText(e), 'bad'); } }} />
      </div>
      ${usage(draft.id) > 0 ? html`<p class="muted" style=${{ padding: '0 20px 16px', fontSize: '13px' }}>כדי למחוק את הפרופיל, העבירו קודם את קבלני המשנה שמשויכים אליו לפרופיל אחר.</p>` : null}
    </section>` : null}`}
    ${importOpen ? html`<${ContractModal} onClose=${() => setImportOpen(false)} onCreate=${(prof) => create(prof, prof.name)} />` : null}
  </div>`;
}

function ContractModal({ onClose, onCreate }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('input');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const ctl = useRef(null);
  useEffect(() => () => { if (ctl.current) ctl.current.abort(); }, []);
  const run = async () => {
    if (!Caps.sample) return;
    setPhase('reading'); setErr(null);
    const c = new AbortController();
    ctl.current = c;
    try {
      let images = [];
      let body = text.trim().slice(0, 30000);
      if (file) {
        const p = await preparePages(file);
        p.previews.forEach((u) => URL.revokeObjectURL(u));
        if (Caps.aiImages) images = p.full.slice(0, Caps.imgMax);
        else if (p.text) body = (body + '\n' + p.text).slice(0, 30000);
      }
      const prompt = CONTRACT_PROMPT + (body ? '\n\nThe appendix text:\n' + body : '\n\nThe appendix is in the attached images.');
      const out = await Caps.sample.json(prompt, Object.assign({ signal: c.signal, modelTier: 'default' }, images.length ? { images } : {}));
      const clean = cleanContract(out);
      if (!REQ_TYPES.some((t) => clean.lines[t].on)) { setErr('לא מצאנו בטקסט דרישות ביטוח. ודאו שהדבקתם את נספח הביטוח.'); setPhase('input'); return; }
      setResult(clean);
      setPhase('result');
    } catch (e) {
      if (e && e.code === 'cancelled') { setPhase('input'); return; }
      setErr(e && e.code ? aiErrorText(e.code) : 'לא הצלחנו לקרוא את הקובץ.');
      setPhase('input');
    } finally { ctl.current = null; }
  };
  return html`<${Modal} title="ייבוא דרישות מנספח הביטוח" wide onClose=${onClose} footer=${phase === 'result'
    ? html`<button type="button" class="btn primary" onClick=${() => { onCreate(result); onClose(); }}>יצירת הפרופיל</button><button type="button" class="btn quiet" onClick=${() => setPhase('input')}>חזרה</button>`
    : phase === 'reading' ? html`<button type="button" class="btn" onClick=${() => ctl.current && ctl.current.abort()}><${Icon} n="stop_circle" />עצירה</button>`
    : html`<button type="button" class="btn primary" disabled=${!text.trim() && !file} onClick=${run}><${Icon} n="document_scanner" />קריאת הדרישות</button><button type="button" class="btn quiet" onClick=${onClose}>ביטול</button>`}>
    ${phase === 'result' && result ? html`
      <p class="lede">זה מה שמצאנו בנספח. אחרי היצירה אפשר לערוך כל שורה.</p>
      <div class="card"><ul class="reqlist">
        <li><${Icon} n="tune" /><span><b>${result.name}</b><small>הודעה מוקדמת: ${result.cancelDays} ימים · ${result.requester ? 'מבקש האישור: החברה שלנו' : 'בלי בדיקת מבקש האישור'}</small></span></li>
        ${REQ_TYPES.filter((t) => result.lines[t].on).map((t) => html`<li key=${t}><${Icon} n="shield" /><span>${COVER[t].long}<small>${result.lines[t].codes.length ? 'סעיפים: ' + result.lines[t].codes.join(', ') : 'ללא סעיפים'}</small></span>${result.lines[t].min ? html`<span class="v num">${money(result.lines[t].min)}</span>` : null}</li>`)}
      </ul></div>
      ${result.notes ? html`<div class="notice"><${Icon} n="info" /><span>${result.notes}</span></div>` : null}
    ` : html`
      <p class="lede">הדביקו את סעיף הביטוח מהחוזה או מהמכרז, או העלו אותו כקובץ. Tokef יבנה ממנו פרופיל דרישות.</p>
      ${err ? html`<div class="notice bad"><${Icon} n="error" /><span>${err}</span></div>` : null}
      <${Field} id="ct-text" label="טקסט הנספח"><textarea id="ct-text" class="input" style=${{ minHeight: '180px' }} disabled=${phase === 'reading'} value=${text} onInput=${(e) => setText(e.target.value)} placeholder="הקבלן יערוך ויקיים, על חשבונו, ביטוח אחריות כלפי צד שלישי בגבול אחריות של 5,000,000 ₪ לאירוע…"></textarea><//>
      <div class="row">
        <label class="btn" for="ct-file"><${Icon} n="upload_file" />${file ? file.name : 'או העלאת PDF / צילום'}</label>
        <input id="ct-file" type="file" class="sr" accept="application/pdf,image/jpeg,image/png,image/webp" onChange=${(e) => setFile((e.target.files && e.target.files[0]) || null)} />
        ${file ? html`<button type="button" class="btn quiet sm" onClick=${() => setFile(null)}>הסרה</button>` : null}
      </div>
      ${phase === 'reading' ? html`<div class="reading-note"><span class="dot-pulse"></span>קורא את הנספח…</div>` : null}
    `}
  <//>`;
}
