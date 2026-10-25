/* A stand-in for the claude.ai viewer runtime, written from the 0.2.47 type
   definitions. Injected before the page loads; configured by window.__MOCK. */
(function () {
  const cfg = Object.assign({ caps: ['db', 'assets', 'sample', 'downloads', 'user'], delay: 80, sample: { mode: 'ok', ms: 1200 }, images: true, imgMax: 5 }, window.__MOCK || {});
  try { Object.assign(cfg, JSON.parse(sessionStorage.getItem('__mockOverride') || '{}')); } catch (e) {}
  if (cfg.noClaude) return;
  const KEY = '__mockdb';
  let store = {};
  try { store = JSON.parse(sessionStorage.getItem(KEY) || 'null') || {}; } catch (e) { store = {}; }
  const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  window.__mockStore = () => JSON.parse(JSON.stringify(store));
  window.__mockErrors = [];
  const later = (fn, ms) => setTimeout(fn, ms == null ? cfg.delay : ms);
  const freeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
  const SEG = /^[A-Za-z0-9_\-.~:@+]+$/;
  function check(path, even) {
    if (typeof path !== 'string') throw new TypeError('path must be a string, got ' + typeof path);
    const s = path.split('/');
    if (s.some((x) => !x || !SEG.test(x) || x === '.' || x === '..')) throw new TypeError('bad path segment in "' + path + '"');
    if ((s.length % 2 === 0) !== even) throw new TypeError('path "' + path + '" has ' + s.length + ' segments');
    if (s.length > 16) throw new TypeError('path too deep');
  }
  function body(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw { code: 'invalid_argument', message: 'body must be an object' };
    const txt = JSON.stringify(data);
    if (txt.length > 256 * 1024) throw { code: 'invalid_argument', message: 'document over 256 KiB' };
    let depth = 0;
    const walk = (o, d) => { depth = Math.max(depth, d); if (o && typeof o === 'object') Object.values(o).forEach((v) => walk(v, d + 1)); };
    walk(data, 0);
    if (depth > 32) throw { code: 'invalid_argument', message: 'too deep' };
    if (Object.keys(store).length >= 5000) throw { code: 'quota_exceeded', message: 'database full' };
    return JSON.parse(txt);
  }
  const listeners = new Set();
  const docSnap = (path) => {
    const d = store[path];
    return freeze({ id: path.split('/').pop(), exists: d !== undefined, data: () => (d === undefined ? undefined : freeze(JSON.parse(JSON.stringify(d)))), metadata: { fromCache: false, hasPendingWrites: false } });
  };
  const inCol = (col, p) => p.startsWith(col + '/') && p.split('/').length === col.split('/').length + 1;
  const OPS = {
    '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
    in: (a, b) => b.includes(a), 'not-in': (a, b) => !b.includes(a), 'array-contains': (a, b) => Array.isArray(a) && a.includes(b),
  };
  function runQuery(q) {
    let paths = Object.keys(store).filter((p) => inCol(q.path, p) && q.filters.every(([f, op, v]) => OPS[op](store[p][f], v)));
    if (q.order) {
      const [f, dir] = q.order;
      paths.sort((a, b) => { const x = store[a][f], y = store[b][f]; if (x === undefined) return 1; if (y === undefined) return -1; return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1); });
    } else paths.sort();
    if (q.lim) paths = paths.slice(0, q.lim);
    const docs = paths.map(docSnap);
    return freeze({ docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i })), metadata: { fromCache: false, hasPendingWrites: false } });
  }
  function notify() { later(() => listeners.forEach((l) => { try { l.fire(); } catch (e) { window.__mockErrors.push(String(e)); } }), 10); }
  let writeCount = 0;
  async function guardWrite() {
    writeCount++;
    if (cfg.denyWrites) throw { code: 'invalid_argument', message: 'below the write level' };
    if (window.__MOCK_FAIL_NEXT) { window.__MOCK_FAIL_NEXT = false; throw { code: window.__MOCK_FAIL_CODE || 'unavailable', message: 'injected failure' }; }
  }
  function docRef(path) {
    check(path, true);
    return Object.freeze({
      id: path.split('/').pop(), path,
      get: () => new Promise((res) => later(() => res(docSnap(path)))),
      set: async (data) => { const b = body(data); await guardWrite(); store[path] = b; persist(); notify(); },
      update: async (data) => {
        const b = body(data);
        await guardWrite();
        if (store[path] === undefined) throw { code: 'invalid_argument', message: 'update requires an existing document' };
        const merge = (t, s) => { for (const k of Object.keys(s)) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) merge(t[k], s[k]); else t[k] = s[k]; } };
        merge(store[path], b);
        persist(); notify();
      },
      delete: async () => { await guardWrite(); delete store[path]; persist(); notify(); },
      onSnapshot: (next, error) => {
        if (typeof next !== 'function') throw new TypeError('next must be a function');
        if (listeners.size >= 64) { later(() => error && error({ code: 'resource_exhausted', message: 'too many subscriptions' })); return () => {}; }
        const l = { fire: () => next(docSnap(path)) };
        listeners.add(l); later(() => listeners.has(l) && l.fire());
        return () => listeners.delete(l);
      },
      collection: (sub) => colRef(path + '/' + sub),
    });
  }
  function query(path, filters, order, lim) {
    const q = { path, filters, order, lim };
    return {
      where: (f, op, v) => { if (!OPS[op]) throw new TypeError('bad operator ' + op); if (filters.length >= 10) throw new TypeError('too many filters'); return query(path, filters.concat([[f, op, v]]), order, lim); },
      orderBy: (f, dir) => query(path, filters, [f, dir || 'asc'], lim),
      limit: (n) => query(path, filters, order, n),
      get: () => new Promise((res) => later(() => res(runQuery(q)))),
      onSnapshot: (next, error) => {
        if (listeners.size >= 64) { later(() => error && error({ code: 'resource_exhausted', message: 'too many subscriptions' })); return () => {}; }
        const l = { fire: () => next(runQuery(q)) };
        listeners.add(l); later(() => listeners.has(l) && l.fire());
        return () => listeners.delete(l);
      },
    };
  }
  function colRef(path) {
    check(path, false);
    const q = query(path, [], null, null);
    return Object.freeze(Object.assign({}, q, {
      path,
      doc: (id) => docRef(path + '/' + (id || Math.random().toString(36).slice(2, 12))),
      add: async (data) => { const r = docRef(path + '/' + Math.random().toString(36).slice(2, 12)); await r.set(data); return r; },
    }));
  }
  const db = Object.freeze({ doc: docRef, collection: colRef });

  const ACCEPT = /^(image\/(png|jpeg|gif|webp|svg\+xml)|video\/(mp4|webm)|application\/pdf|font\/(woff2?|ttf|otf)|text\/(csv|markdown|plain|css|javascript)|application\/json)$/;
  const assets = Object.freeze({
    upload: async (blob, opts) => {
      if (!(blob instanceof Blob) || !blob.size) throw { code: 'invalid_request', message: 'not a blob' };
      const type = (opts && opts.type) || blob.type;
      if (!ACCEPT.test(type)) throw { code: 'unsupported_type', message: type };
      if (blob.size > 20 * 1024 * 1024) throw { code: 'too_large', message: 'over 20 MiB' };
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
      const res = await fetch('/__upload?id=' + id + '&type=' + encodeURIComponent(type), { method: 'POST', body: blob });
      if (!res.ok) throw { code: 'store_unavailable', message: 'upload failed' };
      (window.__uploads = window.__uploads || []).push({ id, type, size: blob.size });
      return { id, url: '/_blob/' + id, sizeBytes: blob.size, contentType: type };
    },
    list: async () => ({ assets: [], usage: { files: 0, bytes: 0, maxFiles: 1000, maxBytes: 1e9 } }),
    delete: async (ref) => { (window.__deletedAssets = window.__deletedAssets || []).push(ref); return { deleted: true }; },
  });

  window.__sampleCalls = [];
  function sampleCall(kind, input, opts) {
    return new Promise((resolve, reject) => {
      opts = opts || {};
      if (typeof input !== 'string' && !Array.isArray(input)) return reject({ code: 'invalid_request', message: 'input' });
      if (!input.length) return reject({ code: 'invalid_request', message: 'empty input' });
      if (Object.getPrototypeOf(opts) !== Object.prototype) return reject({ code: 'invalid_request', message: 'options must be a plain object' });
      if (opts.signal && !(opts.signal instanceof AbortSignal)) return reject({ code: 'invalid_request', message: 'signal' });
      if (opts.modelTier && !['default', 'quick', 'complex'].includes(opts.modelTier)) return reject({ code: 'invalid_request', message: 'modelTier' });
      const imgs = opts.images ? (opts.images instanceof Blob ? [opts.images] : Array.from(opts.images)) : [];
      if (imgs.length && !cfg.images) return reject({ code: 'images_unavailable', message: 'no images here' });
      if (imgs.some((b) => !(b instanceof Blob))) return reject({ code: 'invalid_request', message: 'images must be blobs' });
      if (imgs.length > cfg.imgMax) return reject({ code: 'image_rejected', message: 'too many images' });
      if (imgs.some((b) => !/^image\/(jpeg|png|webp|gif)$/.test(b.type))) return reject({ code: 'image_rejected', message: 'type' });
      const bytes = new TextEncoder().encode(typeof input === 'string' ? input : input.map((t) => t.content).join('')).length;
      if (bytes > 65536) return reject({ code: 'prompt_too_large', message: 'too large' });
      window.__sampleCalls.push({ kind, bytes, images: imgs.map((b) => ({ type: b.type, size: b.size })), modelTier: opts.modelTier || 'default', head: (typeof input === 'string' ? input : '').slice(0, 120) });
      const mode = (cfg.sample && cfg.sample.mode) || 'ok';
      let done = false;
      const onAbort = () => { if (done) return; done = true; reject({ code: 'cancelled', message: 'aborted' }); };
      if (opts.signal) { if (opts.signal.aborted) return onAbort(); opts.signal.addEventListener('abort', onAbort); }
      setTimeout(() => {
        if (done) return;
        if (mode.startsWith('error:')) { done = true; return reject({ code: mode.slice(6), message: 'mock error' }); }
        let value = cfg.sample.answer;
        if (window.__MOCK_ANSWER_NEXT) { value = window.__MOCK_ANSWER_NEXT; window.__MOCK_ANSWER_NEXT = null; }
        const text = kind === 'json' ? JSON.stringify(value) : String(value);
        if (opts.onText) { try { opts.onText({ text, delta: text }); } catch (e) {} }
        done = true;
        resolve(kind === 'json' ? JSON.parse(text) : { text, truncated: false, modelTierApplied: opts.modelTier || 'default' });
      }, (cfg.sample && cfg.sample.ms) || 1200);
    });
  }
  const sample = function (input, opts) { return sampleCall('text', input, opts); };
  sample.json = (input, opts) => sampleCall('json', input, opts);
  sample.limits = async () => Object.assign({ maxPromptBytes: 65536 }, cfg.images ? { images: { maxCount: cfg.imgMax, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } } : {});
  Object.freeze(sample);

  window.__downloads = [];
  const OKEXT = /\.(gif|png|jpg|jpeg|webp|mp4|webm|txt|json|md|docx|pptx|epub|csv|ttf|html|svg|pdf|xlsx|zip)$/i;
  const downloads = Object.freeze({
    save: async (req) => {
      if (!req || typeof req.filename !== 'string') throw { code: 'bad_request', message: 'filename' };
      if (!OKEXT.test(req.filename)) throw { code: 'rejected_extension', message: req.filename };
      if (cfg.declineDownload) throw { code: 'declined', message: 'declined' };
      const data = typeof req.data === 'string' ? req.data : '[binary]';
      window.__downloads.push({ filename: req.filename, data });
      return { status: 'saved' };
    },
  });

  const ME = { id: 'u_owner01', name: 'רונית כהן', avatarUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', color: '#7a6', email: null, isOwner: true, canEdit: true };
  const PEOPLE = { u_owner01: 'רונית כהן', u_member02: 'אבי מנחם' };
  const user = Object.freeze({
    isOwner: async () => !cfg.denyWrites, canEdit: async () => !cfg.denyWrites, can: async (n) => (n === 'data.write' ? (cfg.canWrite === undefined ? true : cfg.canWrite) : null),
    me: async () => ME, id: async () => ME.id, name: async () => ME.name, avatarUrl: async () => ME.avatarUrl, email: async () => null,
    profiles: async (ids) => { const out = {}; for (const id of [].concat(ids)) out[id] = { id, name: PEOPLE[id] || '', avatarUrl: ME.avatarUrl, color: '#888', email: null, isMe: id === ME.id }; return out; },
    search: async () => [],
  });

  const ns = { db, assets, sample, downloads, user };
  const memo = {};
  window.claude = Object.freeze({
    use(name) {
      if (memo[name]) return memo[name];
      const p = new Promise((res) => setTimeout(() => res(cfg.caps.includes(name) ? ns[name] || null : null), cfg.delay));
      if (cfg.caps.includes(name)) memo[name] = p;
      return p;
    },
  });
})();
