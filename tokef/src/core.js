/* Tokef core: dictionaries, formatting, the compliance engine and the
   message builders. Pure functions only, no DOM, so it runs in Node tests. */

const COVER = {
  tpl: { label: 'צד שלישי', long: 'ביטוח צד שלישי', unit: 'גבול אחריות לאירוע' },
  el: { label: 'חבות מעבידים', long: 'ביטוח חבות מעבידים', unit: 'גבול אחריות לאירוע' },
  car: { label: 'עבודות קבלניות', long: 'ביטוח עבודות קבלניות', unit: 'סכום ביטוח' },
  pl: { label: 'אחריות מקצועית', long: 'ביטוח אחריות מקצועית', unit: 'גבול אחריות' },
  prod: { label: 'חבות המוצר', long: 'ביטוח חבות המוצר', unit: 'גבול אחריות' },
  cme: { label: 'רכב וצמ״ה', long: 'ביטוח רכב וצמ״ה', unit: 'גבול אחריות צד שלישי' },
  property: { label: 'רכוש', long: 'ביטוח רכוש', unit: 'סכום ביטוח' },
  other: { label: 'אחר', long: 'פוליסה אחרת', unit: 'גבול אחריות' },
};
const REQ_TYPES = ['tpl', 'el', 'car', 'pl', 'prod', 'cme'];
const POLICY_TYPES = ['tpl', 'el', 'car', 'pl', 'prod', 'cme', 'property', 'other'];

/* Additional-coverage codes of the unified certificate form (רשות שוק ההון). */
const CODES = {
  302: { short: 'אחריות צולבת', long: 'אחריות צולבת' },
  304: { short: 'הרחב שיפוי', long: 'הרחב שיפוי' },
  309: { short: 'ויתור על תחלוף', long: 'ויתור על תחלוף לטובת מבקש האישור' },
  312: { short: 'נזק משימוש בצמ״ה', long: 'כיסוי בגין נזק שנגרם משימוש בצמ״ה' },
  313: { short: 'נזקי טבע', long: 'כיסוי בגין נזקי טבע' },
  314: { short: 'גניבה ופריצה', long: 'כיסוי גניבה, פריצה ושוד' },
  315: { short: 'תביעות המל״ל', long: 'כיסוי לתביעות המל״ל' },
  316: { short: 'רעידת אדמה', long: 'כיסוי רעידת אדמה' },
  318: { short: 'מבוטח נוסף', long: 'מבוטח נוסף: מבקש האישור' },
  319: { short: 'מבוטח נוסף כמעביד', long: 'מבוטח נוסף: היה וייחשב כמעבידם של עובדי המבוטח' },
  321: { short: 'מבוטח נוסף בגין המבוטח', long: 'מבוטח נוסף בגין מעשי או מחדלי המבוטח: מבקש האישור' },
  322: { short: 'מבקש האישור כצד ג׳', long: 'מבקש האישור מוגדר כצד ג׳' },
  328: { short: 'ראשוניות', long: 'ראשוניות' },
  329: { short: 'רכוש המבקש כצד ג׳', long: 'רכוש מבקש האישור ייחשב כצד ג׳' },
  332: { short: 'תקופת גילוי', long: 'תקופת גילוי' },
};
const CODE_LIST = Object.keys(CODES).map(Number);

const TRADES = ['שלד', 'טפסנות', 'ברזלנות', 'חשמל', 'אינסטלציה', 'מיזוג אוויר', 'איטום', 'פיגומים', 'עבודות עפר', 'מנופים', 'מעליות', 'אלומיניום', 'גבס ותקרות', 'ריצוף', 'טיח', 'צבע', 'נגרות', 'מסגרות', 'פיתוח ונוף', 'תכנון', 'פיקוח', 'בטיחות', 'אחר'];

const COVERS = [
  { key: 'dusk', src: 'img/cover-dusk.jpg', label: 'מגדלים בשקיעה' },
  { key: 'day', src: 'img/cover-day.jpg', label: 'בניין מגורים' },
  { key: 'cranes', src: 'img/cover-cranes.jpg', label: 'עגורנים בערב' },
  { key: 'scaffold', src: 'img/cover-scaffold.jpg', label: 'פיגומים' },
];

function line(on, min, codes) { return { on, min, codes }; }
const DEFAULT_PROFILES = [
  {
    key: 'exec', name: 'קבלני ביצוע', cancelDays: 30, requester: true,
    lines: {
      tpl: line(true, 5000000, [302, 304, 309, 315, 321, 322, 328, 329]),
      el: line(true, 20000000, [304, 309, 319, 328]),
      car: line(false, 0, [309, 313, 314, 316, 318, 328]),
      pl: line(false, 2000000, [302, 304, 309, 321, 328, 332]),
      prod: line(false, 2000000, [302, 304, 309, 321, 328, 332]),
      cme: line(false, 1000000, [309, 312, 328]),
    },
  },
  {
    key: 'heavy', name: 'עבודות עפר, מנופים וצמ״ה', cancelDays: 30, requester: true,
    lines: {
      tpl: line(true, 5000000, [302, 304, 309, 312, 315, 321, 322, 328, 329]),
      el: line(true, 20000000, [304, 309, 319, 328]),
      car: line(false, 0, [309, 313, 314, 316, 318, 328]),
      pl: line(false, 2000000, [302, 304, 309, 321, 328, 332]),
      prod: line(false, 2000000, [302, 304, 309, 321, 328, 332]),
      cme: line(true, 1000000, [309, 312, 328]),
    },
  },
  {
    key: 'design', name: 'מתכננים ויועצים', cancelDays: 30, requester: true,
    lines: {
      tpl: line(true, 2000000, [302, 304, 309, 321, 322, 328]),
      el: line(true, 20000000, [304, 309, 319, 328]),
      car: line(false, 0, [309, 313, 314, 316, 318, 328]),
      pl: line(true, 2000000, [302, 304, 309, 321, 328, 332]),
      prod: line(false, 2000000, [302, 304, 309, 321, 328, 332]),
      cme: line(false, 1000000, [309, 312, 328]),
    },
  },
  {
    key: 'supply', name: 'ספקים והתקנות', cancelDays: 30, requester: true,
    lines: {
      tpl: line(true, 2000000, [302, 304, 309, 321, 322, 328]),
      el: line(true, 20000000, [304, 309, 319, 328]),
      car: line(false, 0, [309, 313, 314, 316, 318, 328]),
      pl: line(false, 2000000, [302, 304, 309, 321, 328, 332]),
      prod: line(true, 2000000, [302, 304, 309, 321, 328, 332]),
      cme: line(false, 1000000, [309, 312, 328]),
    },
  },
];

/* ---------- ids, dates, numbers ---------- */

function uid(prefix) {
  const r = Math.random().toString(36).slice(2, 8);
  return (prefix || '') + Date.now().toString(36) + r;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function isISO(s) {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
/* Accepts ISO, DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY and two-digit years. */
function toISO(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  if (isISO(s)) return s;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    const out = iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0');
    return isISO(out) ? out : null;
  }
  const m = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/.exec(s);
  if (!m) return null;
  let y = +m[3];
  if (m[3].length === 2) y += 2000;
  const out = y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return isISO(out) ? out : null;
}
function todayISO(now) {
  const d = now || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function isoToUTC(s) { const m = ISO_RE.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); }
function diffDays(a, b) { return Math.round((isoToUTC(a) - isoToUTC(b)) / 86400000); }
function addDays(s, n) {
  const d = new Date(isoToUTC(s) + n * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function fmtDate(s) {
  if (!isISO(s)) return '';
  return s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);
}
function fmtShort(s) {
  if (!isISO(s)) return '';
  return s.slice(8, 10) + '.' + s.slice(5, 7);
}
const HE_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
function fmtMonth(s) { return isISO(s) ? HE_MONTHS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4) : ''; }
function fmtSize(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
function fmtStamp(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear() + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function toNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[₪$,\s]/g, '').replace(/ש["״]?ח/g, '');
  const mult = /מיליון|מ׳|million|m$/i.test(s) ? 1e6 : 1;
  s = s.replace(/מיליון|מ׳|million|m$/gi, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * mult) : null;
}
function fmtNum(n) {
  if (n == null || !Number.isFinite(+n)) return '';
  return Math.round(+n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function money(n, cur) {
  if (n == null || !Number.isFinite(+n)) return '';
  return fmtNum(n) + (cur === 'USD' ? '\u00A0$' : '\u00A0₪');
}
/* Money inside Hebrew running text: isolate it so the currency sign stays put. */
function moneyIn(n, cur) { return '⁦' + money(n, cur) + '⁩'; }
function moneyShort(n) {
  if (n == null) return '';
  if (n >= 1e6) return (Math.round(n / 1e5) / 10).toString().replace(/\.0$/, '') + ' מ׳ ₪';
  if (n >= 1e3) return Math.round(n / 1e3) + ' אלף ₪';
  return fmtNum(n) + ' ₪';
}

function digits(s) { return String(s || '').replace(/\D/g, ''); }
function normName(s) {
  return String(s || '')
    .replace(/בע["״'׳]?מ/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/חברת|חב׳|בע״מ|ltd\.?|inc\.?/gi, '')
    .replace(/["״'׳.,\-–_/\\]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}
function namesMatch(a, b) {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length < y.length ? x : y, long = x.length < y.length ? y : x;
  return short.length >= 4 && long.includes(short);
}
function codeShort(c) { return (CODES[c] && CODES[c].short) || ('קוד ' + c); }
function codeLong(c) { return (CODES[c] && CODES[c].long) || ('קוד ' + c); }
function parseCodes(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[^\d]+/);
  const out = [];
  for (const x of arr) {
    const n = parseInt(x, 10);
    if (n >= 300 && n <= 399 && !out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}
function phoneIntl(p) {
  let d = digits(p);
  if (!d) return '';
  if (d.startsWith('972')) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return d.length >= 8 ? '972' + d : '';
}

/* ---------- normalising what the extractor returns ---------- */

const TYPE_HINTS = [
  ['el', /מעביד/], ['tpl', /צד\s*(ג|שלישי|ג׳|ג')/], ['car', /קבלני|כל הסיכונים|הקמה/],
  ['pl', /מקצועי/], ['prod', /מוצר/], ['cme', /צמ["״]?ה|רכב|ציוד מכני/], ['property', /רכוש/],
];
function guessType(label) {
  const s = String(label || '');
  for (const [t, re] of TYPE_HINTS) if (re.test(s)) return t;
  return 'other';
}
function cleanPolicy(p) {
  if (!p || typeof p !== 'object') return null;
  let type = POLICY_TYPES.includes(p.type) ? p.type : guessType(p.label);
  if (type === 'other' && p.label) type = guessType(p.label);
  const cur = p.currency === 'USD' ? 'USD' : 'ILS';
  return {
    type,
    label: p.label ? String(p.label).slice(0, 80) : COVER[type].long,
    policyNo: p.policyNo ? String(p.policyNo).slice(0, 40) : '',
    start: toISO(p.start),
    end: toISO(p.end),
    limit: toNumber(p.limit),
    currency: cur,
    codes: parseCodes(p.codes),
  };
}
function cleanFields(x) {
  const f = x && typeof x === 'object' ? x : {};
  const s = (v, n) => (v == null ? '' : String(v).trim().slice(0, n || 120));
  const cd = toNumber(f.cancelDays);
  return {
    insuredName: s(f.insuredName),
    insuredId: s(f.insuredId, 20),
    requester: s(f.requester),
    requesterId: s(f.requesterId, 20),
    insurer: s(f.insurer, 80),
    agent: s(f.agent, 80),
    issueDate: toISO(f.issueDate),
    cancelDays: cd != null && cd >= 0 && cd < 400 ? cd : null,
    policies: (Array.isArray(f.policies) ? f.policies : []).map(cleanPolicy).filter(Boolean).slice(0, 12),
  };
}
function emptyFields() {
  return { insuredName: '', insuredId: '', requester: '', requesterId: '', insurer: '', agent: '', issueDate: null, cancelDays: null, policies: [] };
}

/* ---------- the compliance engine ---------- */

const STATUS = {
  ok: { label: 'תקין', tone: 'ok', rank: 4 },
  soon: { label: 'פג בקרוב', tone: 'warn', rank: 3 },
  fix: { label: 'דורש תיקון', tone: 'bad', rank: 2 },
  missing: { label: 'חסר אישור', tone: 'block', rank: 1 },
  expired: { label: 'האישור פג', tone: 'block', rank: 0 },
};

function latestCert(certs, sid) {
  let best = null;
  for (const c of certs) {
    if (c.sid !== sid) continue;
    if (!best || (c.createdAt || 0) > (best.createdAt || 0)) best = c;
  }
  return best;
}

function evaluate(sub, cert, profile, project, today) {
  const warnDays = Number(project && project.warnDays) || 30;
  const prof = profile || { lines: {}, cancelDays: 0, requester: false };
  const req = REQ_TYPES.filter((t) => prof.lines && prof.lines[t] && prof.lines[t].on);
  const out = { status: 'ok', gate: 'in', findings: [], lines: [], until: null, daysLeft: null, waived: false, certId: cert ? cert.id : null };
  const add = (lvl, key, title, ask, extra) => out.findings.push(Object.assign({ lvl, key, title, ask }, extra || {}));

  if (!cert) {
    out.status = 'missing';
    out.gate = 'out';
    add('block', 'nocert', 'לא הועלה אישור קיום ביטוחים', 'נא להעביר אישור קיום ביטוחים חתום, לפי דרישות הביטוח של הפרויקט.');
    out.lines = req.map((t) => ({ type: t, req: prof.lines[t], got: null, state: 'missing', missingCodes: [], daysLeft: null }));
    return out;
  }

  const f = cert.fields || {};
  const pols = Array.isArray(f.policies) ? f.policies : [];
  let block = false, fix = false, soon = false;
  const ends = [];

  for (const t of req) {
    const r = prof.lines[t];
    const C = COVER[t];
    let p = null;
    for (const q of pols) {
      if (!q || q.type !== t) continue;
      if (!p || (q.end || '') > (p.end || '')) p = q;
    }
    const ln = { type: t, req: r, got: p, state: 'ok', missingCodes: [], daysLeft: null };
    out.lines.push(ln);
    if (!p) {
      ln.state = 'missing';
      fix = true;
      add('fix', 'miss-' + t, 'חסר ' + C.long, 'נא להוסיף לאישור ' + C.long + (r.min ? ' בגבול אחריות של ' + money(r.min) + ' לפחות' : '') + '.', { type: t });
      continue;
    }
    const end = isISO(p.end) ? p.end : null;
    const start = isISO(p.start) ? p.start : null;
    if (!end) {
      ln.state = 'fix';
      fix = true;
      add('fix', 'noend-' + t, 'לא צוין תאריך סיום ל' + C.long, 'נא לציין באישור את תקופת הביטוח של ' + C.long + '.', { type: t });
    } else {
      ends.push(end);
      const d = diffDays(end, today);
      ln.daysLeft = d;
      if (d < 0) {
        ln.state = 'expired';
        block = true;
        add('block', 'exp-' + t, C.long + ' פג ב-' + fmtDate(end), 'נא להנפיק אישור מעודכן ל' + C.long + ' לתקופה שמתחילה ב-' + fmtDate(addDays(end, 1)) + '.', { type: t });
      } else if (d <= warnDays) {
        ln.state = 'soon';
        soon = true;
        add('warn', 'soon-' + t, C.long + (d === 0 ? ' פג היום' : d === 1 ? ' פג מחר' : ' פג בעוד ' + d + ' ימים'), 'נא להעביר אישור לתקופה הבאה לפני ' + fmtDate(end) + '.', { type: t });
      }
    }
    if (start && start > today) {
      fix = true;
      if (ln.state === 'ok') ln.state = 'future';
      add('fix', 'start-' + t, C.long + ' נכנס לתוקף רק ב-' + fmtDate(start), 'נא לוודא שהביטוח בתוקף ממועד תחילת העבודה באתר.', { type: t });
    }
    if (r.min > 0) {
      if (p.limit == null || !(p.limit > 0)) {
        fix = true;
        if (ln.state === 'ok') ln.state = 'fix';
        add('fix', 'nolim-' + t, 'לא צוין גבול אחריות ב' + C.long, 'נא לציין באישור את גבול האחריות ב' + C.long + ' (נדרש ' + money(r.min) + ' לפחות).', { type: t });
      } else if (p.currency === 'USD') {
        add('warn', 'usd-' + t, 'גבול האחריות ב' + C.long + ' נקוב בדולרים', 'נא לאשר שגבול האחריות ב' + C.long + ' שווה ל-' + money(r.min) + ' לפחות.', { type: t });
      } else if (p.limit < r.min) {
        fix = true;
        if (ln.state === 'ok') ln.state = 'low';
        add('fix', 'low-' + t, 'גבול האחריות ב' + C.long + ' הוא ' + moneyIn(p.limit) + ', נדרש ' + moneyIn(r.min), 'נא להגדיל את גבול האחריות ב' + C.long + ' ל-' + money(r.min) + ' לפחות.', { type: t });
      }
    }
    const have = new Set((p.codes || []).map(Number));
    const miss = (r.codes || []).filter((c) => !have.has(Number(c)));
    if (miss.length) {
      fix = true;
      ln.missingCodes = miss;
      if (ln.state === 'ok') ln.state = 'codes';
      add('fix', 'codes-' + t, 'ב' + C.long + ' ' + (miss.length === 1 ? 'חסר סעיף: ' : 'חסרים סעיפים: ') + miss.map(codeShort).join(', '),
        'נא להוסיף ל' + C.long + ' את ' + miss.map((c) => 'קוד ' + c + ' (' + codeLong(c) + ')').join(', ') + '.', { type: t, codes: miss });
    }
  }

  const subId = digits(sub && sub.companyId), certId = digits(f.insuredId);
  if (subId && certId && subId !== certId) {
    fix = true;
    add('fix', 'insured-id', 'מספר החברה באישור (' + f.insuredId + ') שונה מהרשום (' + sub.companyId + ')',
      'נא להנפיק את האישור על שם ' + (sub.name || 'החברה שמבצעת את העבודה') + ', ח.פ. ' + sub.companyId + '.');
  } else if (f.insuredName && sub && sub.name && !namesMatch(f.insuredName, sub.name) && !(subId && certId)) {
    add('warn', 'insured-name', 'שם המבוטח באישור הוא "' + f.insuredName + '"', 'נא לוודא שהאישור הונפק על שם ' + sub.name + '.');
  }

  if (prof.requester !== false && project && project.client) {
    const pid = digits(project.clientId), rid = digits(f.requesterId);
    const idOk = pid && rid && pid === rid;
    if (!f.requester && !idOk) {
      fix = true;
      add('fix', 'requester', 'לא צוין מבקש האישור', 'נא לציין את ' + project.client + (project.clientId ? ' (ח.פ. ' + project.clientId + ')' : '') + ' כמבקש האישור.');
    } else if (!idOk && !namesMatch(f.requester, project.client)) {
      fix = true;
      add('fix', 'requester', 'מבקש האישור באישור הוא "' + f.requester + '"', 'נא לציין את ' + project.client + (project.clientId ? ' (ח.פ. ' + project.clientId + ')' : '') + ' כמבקש האישור.');
    }
  }

  const needDays = Number(prof.cancelDays) || 0;
  if (needDays && f.cancelDays != null && Number(f.cancelDays) < needDays) {
    fix = true;
    add('fix', 'cancel', 'הודעה מוקדמת על ביטול: ' + f.cancelDays + ' ימים במקום ' + needDays, 'נא לקבוע הודעה מוקדמת של ' + needDays + ' ימים לפחות לפני ביטול או שינוי לרעה של הביטוח.');
  }

  if (ends.length) {
    out.until = ends.reduce((a, b) => (a < b ? a : b));
    out.daysLeft = diffDays(out.until, today);
    if (sub && isISO(sub.workTo) && out.until < sub.workTo && out.daysLeft >= 0) {
      add('info', 'renew', 'הביטוח מסתיים לפני סוף העבודה בפרויקט', 'יידרש אישור לתקופה הבאה עד ' + fmtDate(out.until) + '.');
    }
  }

  const ex = cert.exception && cert.exception.note ? cert.exception : null;
  if (ex && fix && !block) {
    out.waived = true;
    for (const x of out.findings) if (x.lvl === 'fix') x.waived = true;
    fix = false;
  }

  out.status = block ? 'expired' : fix ? 'fix' : soon ? 'soon' : 'ok';
  out.gate = out.status === 'ok' || out.status === 'soon' ? 'in' : 'out';
  const order = { block: 0, fix: 1, warn: 2, info: 3 };
  out.findings.sort((a, b) => (a.waived ? 1 : 0) - (b.waived ? 1 : 0) || order[a.lvl] - order[b.lvl]);
  return out;
}

/* One line that explains the state, used in tables, the gate and the queue. */
function reason(ev) {
  if (!ev) return '';
  if (ev.status === 'missing') return 'לא הועלה אישור';
  if (ev.status === 'ok') return ev.waived ? 'אושר בחריגה' : 'כל הדרישות התקיימו';
  const first = ev.findings.find((x) => !x.waived && (x.lvl === 'block' || x.lvl === 'fix' || x.lvl === 'warn'));
  if (!first) return '';
  const more = ev.findings.filter((x) => !x.waived && (x.lvl === 'block' || x.lvl === 'fix')).length - (first.lvl === 'warn' ? 0 : 1);
  return first.title + (more > 0 ? ' ועוד ' + (more === 1 ? 'ממצא אחד' : more + ' ממצאים') : '');
}

function statusLabel(ev) {
  if (!ev) return '';
  if (ev.status === 'soon') {
    const d = ev.daysLeft;
    return d === 0 ? 'פג היום' : d === 1 ? 'פג מחר' : 'פג בעוד ' + d + ' ימים';
  }
  return STATUS[ev.status].label;
}

function urgency(ev) {
  const r = STATUS[ev.status].rank;
  return r * 100000 + (ev.status === 'soon' ? Math.max(0, ev.daysLeft || 0) : 0);
}

/* ---------- messages for the subcontractor and the agent ---------- */

function askList(ev) {
  return ev.findings.filter((x) => (x.lvl === 'block' || x.lvl === 'fix' || x.lvl === 'warn') && !x.waived).map((x) => x.ask);
}

function whatsappText(sub, ev, project, profile) {
  const hi = 'שלום' + (sub.contact ? ' ' + sub.contact.split(' ')[0] : '') + ',';
  const where = 'בפרויקט ' + (project.name || '') + (project.client ? ' של ' + project.client : '');
  const lines = [hi];
  if (ev.status === 'missing') {
    lines.push('כדי שצוות ' + sub.name + ' יוכל להמשיך לעבוד ' + where + ', אנחנו צריכים אישור קיום ביטוחים.');
    lines.push('');
    lines.push('מה צריך להופיע באישור:');
    for (const t of REQ_TYPES) {
      const r = profile && profile.lines && profile.lines[t];
      if (!r || !r.on) continue;
      lines.push('• ' + COVER[t].long + (r.min ? ': ' + money(r.min) + ' לפחות' : '') + (r.codes && r.codes.length ? ', כולל קודים ' + r.codes.join(', ') : ''));
    }
    if (project.client) lines.push('• מבקש האישור: ' + project.client + (project.clientId ? ', ח.פ. ' + project.clientId : ''));
  } else if (ev.status === 'soon') {
    lines.push('אישור הביטוח של ' + sub.name + ' ' + where + ' מסתיים ב-' + fmtDate(ev.until) + '.');
    lines.push('נשמח לקבל אישור לתקופה הבאה לפני המועד, כדי שהכניסה לאתר לא תיחסם.');
  } else if (ev.status === 'expired') {
    lines.push('אישור הביטוח של ' + sub.name + ' ' + where + ' פג ב-' + fmtDate(ev.until) + ', ולכן הכניסה לאתר חסומה כרגע.');
    lines.push('כדי לחזור לעבודה צריך אישור מעודכן:');
    for (const a of askList(ev)) lines.push('• ' + a);
  } else {
    lines.push('בדקנו את אישור הביטוח של ' + sub.name + ' ' + where + ' ויש בו כמה דברים לתקן:');
    for (const a of askList(ev)) lines.push('• ' + a);
  }
  lines.push('');
  lines.push('אפשר להעביר את ההודעה הזו לסוכן הביטוח, ולשלוח לנו את האישור המעודכן בתשובה. תודה!');
  return lines.join('\n');
}

function agentEmail(sub, ev, project, profile) {
  const subject = 'בקשה ' + (ev.status === 'soon' || ev.status === 'expired' ? 'לחידוש' : 'לתיקון') + ' אישור קיום ביטוחים: ' + sub.name + ', ' + (project.name || '');
  const L = [];
  L.push('שלום' + (sub.agent ? ' ' + sub.agent : '') + ',');
  L.push('');
  L.push('אני פונה בשם ' + (project.client || 'מבקש האישור') + ' בנוגע לאישור קיום הביטוחים של ' + sub.name + (sub.companyId ? ' (ח.פ. ' + sub.companyId + ')' : '') + ', לצורך עבודה בפרויקט ' + (project.name || '') + '.');
  L.push('');
  if (ev.status === 'missing') {
    L.push('נבקש להנפיק אישור לפי הדרישות הבאות:');
    for (const t of REQ_TYPES) {
      const r = profile && profile.lines && profile.lines[t];
      if (!r || !r.on) continue;
      L.push('• ' + COVER[t].long + (r.min ? ', ' + COVER[t].unit + ': ' + money(r.min) + ' לפחות' : '') + (r.codes && r.codes.length ? '. קודי כיסוי: ' + r.codes.map((c) => c + ' (' + codeLong(c) + ')').join(', ') : ''));
    }
    if (project.client) L.push('• מבקש האישור: ' + project.client + (project.clientId ? ', ח.פ. ' + project.clientId : ''));
    if (profile && profile.cancelDays) L.push('• הודעה מוקדמת של ' + profile.cancelDays + ' ימים לפני ביטול או שינוי לרעה');
  } else {
    L.push('בבדיקת האישור שהתקבל מצאנו את הדברים הבאים:');
    for (const a of askList(ev)) L.push('• ' + a);
  }
  L.push('');
  L.push('נודה לקבלת אישור מעודכן וחתום בהקדם. עד לקבלתו, הכניסה לאתר עלולה להיחסם.');
  L.push('');
  L.push('תודה,');
  L.push(project.client || '');
  return { subject, body: L.join('\n') };
}

/* ---------- export ---------- */

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function reportRows(rows, profiles) {
  const head = ['קבלן משנה', 'ח.פ.', 'תחום', 'דרישות ביטוח', 'סטטוס', 'כניסה לאתר', 'בתוקף עד', 'ימים שנותרו', 'ממצאים', 'איש קשר', 'טלפון'];
  const body = rows.map(({ sub, ev }) => {
    const prof = profiles.find((p) => p.id === sub.profile);
    return [
      sub.name, sub.companyId || '', sub.trade || '', prof ? prof.name : '', statusLabel(ev),
      ev.gate === 'in' ? 'מורשה' : 'חסום', ev.until ? fmtDate(ev.until) : '', ev.daysLeft == null ? '' : ev.daysLeft,
      ev.findings.filter((x) => !x.waived && x.lvl !== 'info').map((x) => x.title.replace(/[⁦-⁩]/g, '')).join(' | '),
      sub.contact || '', sub.phone || '',
    ];
  });
  return [head].concat(body);
}
function toCSV(table) { return '﻿' + table.map((r) => r.map(csvCell).join(',')).join('\r\n'); }
function toTSV(table) { return table.map((r) => r.map((v) => String(v == null ? '' : v).replace(/[\t\n\r]+/g, ' ')).join('\t')).join('\n'); }

/* Paste from Excel: name, company id, trade, contact, phone (any subset, in that order). */
function parseSubList(text) {
  const rows = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const cells = raw.includes('\t') ? raw.split('\t') : raw.split(/\s*[,;]\s*/);
    const c = cells.map((x) => x.trim());
    if (!c[0] || /^(שם|קבלן|name)/i.test(c[0]) && rows.length === 0 && !/\d/.test(c[1] || '')) continue;
    let [name, id, trade, contact, phone] = c;
    if (id && /^0\d{8,9}$/.test(digits(id)) && !trade) { phone = id; id = ''; }
    else if (id && !/\d{5,}/.test(digits(id)) && !phone) { phone = contact; contact = trade; trade = id; id = ''; }
    rows.push({ name: name.slice(0, 80), companyId: digits(id) ? id : '', trade: trade || '', contact: contact || '', phone: phone || '' });
    if (rows.length >= 200) break;
  }
  return rows;
}

/* ---------- prompts ---------- */

const EXTRACT_PROMPT = [
  'You are reading an Israeli insurance certificate ("אישור קיום ביטוחים"), usually the unified form of the Capital Market Authority.',
  'The images are crops of ONE document in reading order (for each page: the top part, then the bottom part). Some text may repeat across crops; count each policy once.',
  '',
  'Reply with only one JSON object in exactly this shape:',
  '{"insuredName": string|null, "insuredId": string|null, "requester": string|null, "requesterId": string|null, "insurer": string|null, "agent": string|null, "issueDate": "YYYY-MM-DD"|null, "cancelDays": number|null,',
  ' "policies": [{"type": "tpl"|"el"|"car"|"pl"|"prod"|"cme"|"property"|"other", "label": string, "policyNo": string|null, "start": "YYYY-MM-DD"|null, "end": "YYYY-MM-DD"|null, "limit": number|null, "currency": "ILS"|"USD"|null, "codes": [number]}],',
  ' "confidence": "high"|"medium"|"low", "notes": string|null}',
  '',
  'Field meanings: insuredName / insuredId = the insured (המבוטח) and its company number (ח.פ. or ת.ז., digits only). requester / requesterId = מבקש האישור and its number. insurer = the insurance company. agent = the insurance agent or agency if printed. issueDate = date the certificate was issued. cancelDays = days of advance notice before cancellation or adverse change (usually stated in the cancellation clause, often 30 or 60).',
  'Policy type mapping: צד שלישי / אחריות כלפי צד ג׳ = "tpl"; חבות מעבידים / אחריות מעבידים = "el"; עבודות קבלניות / כל הסיכונים / הקמה = "car"; אחריות מקצועית = "pl"; חבות המוצר / אחריות המוצר = "prod"; רכב / צמ״ה / ציוד מכני הנדסי = "cme"; רכוש = "property"; anything else = "other".',
  'For each policy: label = its name as written; limit = the liability limit per event (לאירוע), or the sum insured when there is no limit, as a plain number without commas; codes = every 3-digit additional-coverage code listed for that policy (for example 302, 309, 321, 328).',
  'Dates on the form are written DD/MM/YYYY; convert them to YYYY-MM-DD. Use null for anything that is not printed. Never guess or fill in typical values.',
  'notes: one short Hebrew sentence about anything unreadable or unusual, or null.',
  'If the images are not an insurance certificate, reply {"policies": [], "confidence": "low", "notes": "המסמך אינו אישור קיום ביטוחים"}.',
].join('\n');

const CONTRACT_PROMPT = [
  'You are reading the insurance appendix (נספח ביטוח) of an Israeli construction contract or tender. Extract what the subcontractor or supplier must insure.',
  'Reply with only one JSON object in exactly this shape:',
  '{"name": string, "cancelDays": number|null, "requester": boolean, "lines": [{"type": "tpl"|"el"|"car"|"pl"|"prod"|"cme", "min": number|null, "codes": [number]}], "notes": string|null}',
  'name: a short Hebrew name for this requirement set (for example "ביצוע: קבלן משנה"). type mapping: צד שלישי = "tpl"; חבות מעבידים = "el"; עבודות קבלניות / כל הסיכונים = "car"; אחריות מקצועית = "pl"; חבות המוצר = "prod"; רכב / צמ״ה = "cme".',
  'min = the minimum liability limit per event in ILS as a plain number (convert "5 מיליון" to 5000000). codes = the 3-digit additional-coverage codes required for that line. requester = true if the text requires the client to be named as the requester (מבקש האישור). cancelDays = the required notice period before cancellation, if stated.',
  'Use null for anything not stated. notes: one short Hebrew sentence about anything unclear, or null.',
].join('\n');

function cleanContract(x) {
  const o = x && typeof x === 'object' ? x : {};
  const lines = {};
  for (const t of REQ_TYPES) lines[t] = { on: false, min: 0, codes: [] };
  for (const l of Array.isArray(o.lines) ? o.lines : []) {
    if (!l || !REQ_TYPES.includes(l.type)) continue;
    lines[l.type] = { on: true, min: toNumber(l.min) || 0, codes: parseCodes(l.codes) };
  }
  const cd = toNumber(o.cancelDays);
  return {
    name: o.name ? String(o.name).slice(0, 60) : 'דרישות מהחוזה',
    cancelDays: cd != null && cd > 0 && cd < 400 ? cd : 30,
    requester: o.requester !== false,
    lines,
    notes: o.notes ? String(o.notes).slice(0, 200) : '',
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    COVER, REQ_TYPES, POLICY_TYPES, CODES, CODE_LIST, TRADES, COVERS, DEFAULT_PROFILES, STATUS,
    uid, isISO, toISO, todayISO, diffDays, addDays, fmtDate, fmtShort, fmtMonth, fmtSize, fmtStamp, toNumber, fmtNum, money, moneyIn, moneyShort,
    digits, normName, namesMatch, codeShort, codeLong, parseCodes, phoneIntl, guessType, cleanPolicy, cleanFields, emptyFields,
    latestCert, evaluate, reason, statusLabel, urgency, askList, whatsappText, agentEmail, reportRows, toCSV, toTSV, parseSubList,
    EXTRACT_PROMPT, CONTRACT_PROMPT, cleanContract,
  };
}
