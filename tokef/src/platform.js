/* Tokef platform layer: reaches the viewer's capabilities, keeps the shared
   data in memory and writes it back. With the `db` capability the data is
   shared by everyone who opens the page; without it a local store in this
   browser stands in, with the same interface. */

const Caps = { db: null, assets: null, sample: null, downloads: null, user: null, ai: false, aiImages: false, imgMax: 1, imgTypes: [] };

function capUse(name) {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return Promise.resolve(null);
    return Promise.resolve(window.claude.use(name)).catch(() => null);
  } catch (e) {
    return Promise.resolve(null);
  }
}

function safeGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
function safeSet(key, v) { try { window.localStorage.setItem(key, v); return true; } catch (e) { return false; } }

/* ---- a small local store with the subset of the db interface we use ---- */
function makeLocalDB(key) {
  let docs = {};
  try { docs = JSON.parse(safeGet(key) || '{}') || {}; } catch (e) { docs = {}; }
  const listeners = new Set();
  const snap = (path, data) => ({ id: path.split('/').pop(), exists: data !== undefined, data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))), metadata: { fromCache: false, hasPendingWrites: false } });
  const inCol = (col, path) => path.startsWith(col + '/') && path.split('/').length === col.split('/').length + 1;
  function fire(l) {
    if (l.kind === 'doc') l.cb(snap(l.path, docs[l.path]));
    else {
      const list = Object.keys(docs).filter((p) => inCol(l.path, p) && l.filters.every(([f, op, v]) => op === '==' && docs[p][f] === v)).sort().map((p) => snap(p, docs[p]));
      l.cb({ docs: list, size: list.length, empty: !list.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });
    }
  }
  let queued = false;
  function changed() {
    safeSet(key, JSON.stringify(docs));
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; listeners.forEach(fire); }, 0);
  }
  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      get: async () => snap(path, docs[path]),
      set: async (data) => { docs[path] = JSON.parse(JSON.stringify(data)); changed(); },
      update: async (data) => {
        if (!docs[path]) throw { code: 'invalid_argument', message: 'missing document' };
        docs[path] = Object.assign({}, docs[path], JSON.parse(JSON.stringify(data)));
        changed();
      },
      delete: async () => { delete docs[path]; changed(); },
      onSnapshot: (cb) => { const l = { kind: 'doc', path, cb }; listeners.add(l); setTimeout(() => listeners.has(l) && fire(l), 0); return () => listeners.delete(l); },
    };
  }
  function query(path, filters) {
    return {
      path,
      where: (f, op, v) => query(path, filters.concat([[f, op, v]])),
      doc: (id) => docRef(path + '/' + (id || uid())),
      onSnapshot: (cb) => { const l = { kind: 'col', path, filters, cb }; listeners.add(l); setTimeout(() => listeners.has(l) && fire(l), 0); return () => listeners.delete(l); },
      get: async () => new Promise((res) => fire({ kind: 'col', path, filters, cb: res })),
    };
  }
  return { local: true, doc: docRef, collection: (path) => query(path, []) };
}

/* ---- error copy ---- */
function dbErrorText(e) {
  const code = e && e.code;
  if (code === 'read_only') return 'יש לך הרשאת צפייה בלבד בעמוד הזה, ולכן אי אפשר לשמור שינויים.';
  if (code === 'quota_exceeded') return 'מאגר הנתונים מלא. מחקו פרויקטים או אישורים ישנים ונסו שוב.';
  if (code === 'resource_exhausted') return 'יותר מדי פעולות ברגע אחד. חכו כמה שניות ונסו שוב.';
  if (code === 'revoked' || code === 'not_granted') return 'אין כרגע גישה לשמירת נתונים בעמוד הזה.';
  if (code === 'invalid_argument') return 'השמירה נדחתה. ייתכן שהרשומה נמחקה בינתיים.';
  return 'השמירה לא הצליחה. בדקו את החיבור ונסו שוב.';
}

/* ---- the app store ---- */
const Store = {
  mode: 'boot', // boot | db | local
  db: null,
  projects: [], subs: [], certs: [], profiles: [], log: [],
  pid: null,
  readOnly: false,
  canWrite: null, // what user.can("data.write") said: true, false, or null when the platform said nothing
  loaded: { projects: false, project: false },
  problem: null,
  me: { id: null, name: '' },
  listeners: new Set(),
  unsubs: [],
  _pending: {},

  version: 0,
  emit() { this.version++; this.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

  attach(db, mode) {
    this.db = db;
    this.mode = mode;
    if (this._projUnsub) this._projUnsub();
    this._projUnsub = db.collection('projects').onSnapshot(
      (snap) => {
        this.projects = snap.docs.filter((d) => d.exists).map((d) => normProject(d.id, d.data()));
        this.projects.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        this.loaded.projects = true;
        const saved = safeGet('tokef.pid');
        if (!this.pid || !this.projects.some((p) => p.id === this.pid)) {
          const next = this.projects.find((p) => p.id === saved) || this.projects[0];
          this.selectProject(next ? next.id : null);
        }
        this.emit();
      },
      (e) => this.fail(e)
    );
  },

  fail(e) {
    const code = (e && e.code) || 'unavailable';
    this.problem = code === 'revoked' ? 'revoked' : 'lost';
    this.emit();
  },

  selectProject(pid) {
    if (pid === this.pid && this.loaded.project) return;
    this.unsubs.forEach((u) => { try { u(); } catch (e) {} });
    this.unsubs = [];
    this.pid = pid;
    this.subs = []; this.certs = []; this.profiles = []; this.log = [];
    this.loaded.project = false;
    if (pid) safeSet('tokef.pid', pid);
    if (!pid || !this.db) { this.loaded.project = true; this.emit(); return; }
    const got = { subs: false, certs: false, profiles: false, log: false };
    const done = (k) => { got[k] = true; if (got.subs && got.certs && got.profiles && got.log) this.loaded.project = true; this.emit(); };
    const db = this.db;
    const err = (e) => this.fail(e);
    this.unsubs.push(db.collection('subs').where('pid', '==', pid).onSnapshot((s) => { if (this.pid !== pid) return; this.subs = s.docs.filter((d) => d.exists).map((d) => normSub(d.id, d.data())); done('subs'); }, err));
    this.unsubs.push(db.collection('certs').where('pid', '==', pid).onSnapshot((s) => { if (this.pid !== pid) return; this.certs = s.docs.filter((d) => d.exists).map((d) => normCert(d.id, d.data())); done('certs'); }, err));
    this.unsubs.push(db.collection('profiles').where('pid', '==', pid).onSnapshot((s) => { if (this.pid !== pid) return; this.profiles = s.docs.filter((d) => d.exists).map((d) => normProfile(d.id, d.data())).sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0)); done('profiles'); }, err));
    this.unsubs.push(db.doc('logs/' + pid).onSnapshot((d) => { if (this.pid !== pid) return; const x = d.exists ? d.data() : null; this.log = x && Array.isArray(x.items) ? x.items.slice() : []; done('log'); }, err));
    this.emit();
  },

  project() { return this.projects.find((p) => p.id === this.pid) || null; },

  /* A transient failure is retried once; a busy store is given a few seconds to catch up. */
  async retry(fn) {
    for (let attempt = 0; ; attempt++) {
      try { return await fn(); } catch (e) {
        const code = e && e.code;
        const again = (code === 'unavailable' && attempt < 1) || (code === 'resource_exhausted' && attempt < 3);
        if (!again) throw e;
        await new Promise((r) => setTimeout(r, code === 'unavailable' ? 300 + Math.random() * 500 : 1000 * 2 ** attempt));
      }
    }
  },
  /* A refused write on a view the platform said nothing about means this viewer may only read. */
  refused(e) {
    if (e && e.code === 'invalid_argument' && this.mode === 'db' && this.canWrite === null && !this.readOnly) { this.readOnly = true; this.emit(); }
    throw e;
  },
  async write(path, data) {
    if (this.readOnly) throw { code: 'read_only', message: 'read only' };
    const body = stripUndef(data);
    try { await this.retry(() => this.db.doc(path).set(body)); } catch (e) { this.refused(e); }
  },
  async remove(path) {
    if (this.readOnly) throw { code: 'read_only', message: 'read only' };
    try { await this.retry(() => this.db.doc(path).delete()); } catch (e) { this.refused(e); }
  },

  async saveProject(p) { const { id, ...rest } = p; await this.write('projects/' + id, rest); },
  async saveSub(s) { const { id, ...rest } = s; await this.write('subs/' + id, rest); },
  async saveCert(c) { const { id, ...rest } = c; await this.write('certs/' + id, rest); },
  async saveProfile(p) { const { id, ...rest } = p; await this.write('profiles/' + id, rest); },
  async deleteSub(id) {
    const certs = this.certs.filter((c) => c.sid === id);
    for (const c of certs) await this.deleteCert(c.id);
    await this.remove('subs/' + id);
  },
  async deleteCert(id) {
    const c = this.certs.find((x) => x.id === id);
    await this.remove('certs/' + id);
    if (c && c.file && c.file.id && Caps.assets) { try { await Caps.assets.delete(c.file.id); } catch (e) {} }
  },
  async deleteProfile(id) { await this.remove('profiles/' + id); },

  async createProject(fields) {
    const id = uid('p');
    const now = Date.now();
    await this.saveProject(Object.assign({ id, name: '', client: '', clientId: '', address: '', warnDays: 30, cover: 'day', createdAt: now, demo: false }, fields));
    let i = 0;
    for (const d of DEFAULT_PROFILES) {
      await this.saveProfile({ id: uid('r'), pid: id, key: d.key, name: d.name, lines: JSON.parse(JSON.stringify(d.lines)), cancelDays: d.cancelDays, requester: d.requester, order: i++, createdAt: now });
    }
    await this.write('logs/' + id, { pid: id, items: [{ at: now, by: this.me.id, kind: 'project', text: 'הפרויקט נוצר' }] });
    this.selectProject(id);
    return id;
  },

  async deleteProject(pid) {
    const wasCurrent = pid === this.pid;
    const subs = wasCurrent ? this.subs : [];
    const certs = wasCurrent ? this.certs : [];
    const profs = wasCurrent ? this.profiles : [];
    for (const c of certs) await this.deleteCert(c.id);
    for (const s of subs) await this.remove('subs/' + s.id);
    for (const r of profs) await this.remove('profiles/' + r.id);
    await this.remove('logs/' + pid);
    await this.remove('projects/' + pid);
    if (wasCurrent) {
      const next = this.projects.find((p) => p.id !== pid);
      this.selectProject(next ? next.id : null);
    }
  },

  /* The log is one document per project; entries queue up so only one write to it runs at a time. */
  async log_(kind, text, sid) {
    if (!this.pid || this.readOnly) return;
    this.log = [{ at: Date.now(), by: this.me.id, kind, text, sid: sid || null }].concat(this.log).slice(0, 300);
    this.emit();
    this._logPid = this.pid;
    this._logDirty = true;
    if (this._logBusy) return;
    this._logBusy = true;
    try {
      while (this._logDirty) {
        this._logDirty = false;
        const pid = this._logPid;
        if (pid !== this.pid) break;
        try { await this.write('logs/' + pid, { pid, items: this.log }); } catch (e) { /* the log is best effort */ }
      }
    } finally { this._logBusy = false; }
  },

  /* Loads demo.json (published next to the page) into the store. */
  async loadDemo() {
    const res = await fetch('demo.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('demo');
    const data = await res.json();
    const jobs = [];
    for (const col of ['projects', 'profiles', 'subs', 'certs', 'logs']) {
      for (const d of data[col] || []) { const { id, ...rest } = d; jobs.push([col + '/' + id, rest]); }
    }
    for (const [p, d] of jobs) await this.write(p, d);
    const first = (data.projects || [])[0];
    if (first) this.selectProject(first.id);
  },
};

function stripUndef(o) { return JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : v))); }
function str(v, n) { return v == null ? '' : String(v).slice(0, n || 200); }
function normProject(id, d) {
  d = d || {};
  return { id, name: str(d.name, 120) || 'פרויקט ללא שם', client: str(d.client, 120), clientId: str(d.clientId, 20), address: str(d.address, 160), warnDays: Number(d.warnDays) || 30, cover: str(d.cover, 20) || 'day', createdAt: Number(d.createdAt) || 0, demo: !!d.demo };
}
function normSub(id, d) {
  d = d || {};
  return {
    id, pid: str(d.pid, 64), name: str(d.name, 120) || 'ללא שם', companyId: str(d.companyId, 20), trade: str(d.trade, 40), profile: str(d.profile, 64),
    contact: str(d.contact, 80), phone: str(d.phone, 30), email: str(d.email, 120), agent: str(d.agent, 80), agentEmail: str(d.agentEmail, 120), agentPhone: str(d.agentPhone, 30),
    workFrom: isISO(d.workFrom) ? d.workFrom : null, workTo: isISO(d.workTo) ? d.workTo : null, notes: str(d.notes, 1000), createdAt: Number(d.createdAt) || 0, demo: !!d.demo,
  };
}
function normCert(id, d) {
  d = d || {};
  const file = d.file && typeof d.file === 'object' ? { id: str(d.file.id, 64), name: str(d.file.name, 160), type: str(d.file.type, 60), size: Number(d.file.size) || 0 } : null;
  const ex = d.exception && typeof d.exception === 'object' && d.exception.note ? { note: str(d.exception.note, 400), by: d.exception.by || null, at: Number(d.exception.at) || 0 } : null;
  return { id, pid: str(d.pid, 64), sid: str(d.sid, 64), createdAt: Number(d.createdAt) || 0, by: d.by || null, source: d.source === 'ai' ? 'ai' : 'manual', file, fields: cleanFields(d.fields), exception: ex, demo: !!d.demo };
}
function normProfile(id, d) {
  d = d || {};
  const lines = {};
  for (const t of REQ_TYPES) {
    const l = d.lines && d.lines[t];
    lines[t] = { on: !!(l && l.on), min: Number(l && l.min) || 0, codes: parseCodes(l && l.codes) };
  }
  return { id, pid: str(d.pid, 64), key: str(d.key, 20), name: str(d.name, 80) || 'דרישות', lines, cancelDays: Number(d.cancelDays) || 0, requester: d.requester !== false, order: Number(d.order) || 0, createdAt: Number(d.createdAt) || 0 };
}

async function bootPlatform() {
  const viewer = !!(window.claude && typeof window.claude.use === 'function');
  if (!viewer) {
    Store.attach(makeLocalDB('tokef.local.v1'), 'local');
    return;
  }
  capUse('user').then(async (u) => {
    Caps.user = u;
    if (!u) return;
    try { const me = await u.me(); Store.me = { id: me.id || null, name: me.name || '' }; } catch (e) {}
    try {
      const can = await u.can('data.write');
      Store.canWrite = can === true ? true : can === false ? false : null;
      if (can === false) Store.readOnly = true;
    } catch (e) {}
    Store.emit();
  });
  capUse('assets').then((a) => { Caps.assets = a; Store.emit(); });
  capUse('downloads').then((d) => { Caps.downloads = d; Store.emit(); });
  capUse('sample').then(async (s) => {
    Caps.sample = s;
    if (s) {
      Caps.ai = true;
      try {
        const lim = await s.limits();
        if (lim && lim.images) { Caps.aiImages = true; Caps.imgMax = Math.max(1, lim.images.maxCount || 1); Caps.imgTypes = lim.images.mediaTypes || []; }
      } catch (e) {}
    }
    Store.emit();
  });
  const db = await capUse('db');
  if (db) { Caps.db = db; Store.attach(db, 'db'); }
  else Store.attach(makeLocalDB('tokef.local.v1'), 'local');
}
