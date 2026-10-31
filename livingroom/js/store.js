// Everything the user makes stays on the device: items, rooms, 3D model files and thumbnails live
// in IndexedDB, small settings in localStorage.

const DB_NAME = 'livingroom';
const DB_VERSION = 1;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const name of ['items', 'rooms', 'blobs']) {
          if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: name === 'blobs' ? 'key' : 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const uid = (p = 'i') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const items = {
  all: () => tx('items', 'readonly', s => reqP(s.getAll())).then(list => list.sort((a, b) => b.createdAt - a.createdAt)),
  get: id => tx('items', 'readonly', s => reqP(s.get(id))),
  put: item => tx('items', 'readwrite', s => { s.put({ ...item, updatedAt: Date.now() }); }).then(() => item),
  remove: id => tx('items', 'readwrite', s => { s.delete(id); }),
};

export const rooms = {
  all: () => tx('rooms', 'readonly', s => reqP(s.getAll())).then(list => list.sort((a, b) => b.updatedAt - a.updatedAt)),
  get: id => tx('rooms', 'readonly', s => reqP(s.get(id))),
  put: room => { const r = { ...room, updatedAt: Date.now() }; return tx('rooms', 'readwrite', s => { s.put(r); }).then(() => r); },
  remove: id => tx('rooms', 'readwrite', s => { s.delete(id); }),
};

/** Binary files (GLB models, processed images) by key. */
export const blobs = {
  get: key => tx('blobs', 'readonly', s => reqP(s.get(key))).then(r => (r ? r.blob : null)),
  put: (key, blob) => tx('blobs', 'readwrite', s => { s.put({ key, blob }); }),
  remove: key => tx('blobs', 'readwrite', s => { s.delete(key); }),
};

const SETTINGS_KEY = 'livingroom.settings';
const DEFAULTS = { units: 'cm', theme: 'auto', clearance: true, person: false, hints: true };

export const settings = {
  get() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
  },
  set(patch) {
    const next = { ...settings.get(), ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  },
};

export async function clearAll() {
  const d = await db();
  d.close();
  dbPromise = null;
  await new Promise(res => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  localStorage.removeItem(SETTINGS_KEY);
}
