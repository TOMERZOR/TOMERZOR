// Keeps the app on the phone so it opens instantly and without internet, and shows the reminders
// the server pushes. Bump VERSION whenever a file changes.
const VERSION = 'remind-v3';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'fonts/heebo-hebrew.woff2',
  'fonts/heebo-latin.woff2',
  'fonts/jakarta-latin.woff2',
  'js/app.js',
  'js/store.js',
  'js/icons.js',
  'js/push.js',
  'js/config.js',
  'img/icon.svg',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('remind-v') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // The server address is filled in after deploys, so fetch it fresh when online.
  if (new URL(e.request.url).pathname.endsWith('/js/config.js')) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});

const SLOTS = { morning: 'הבוקר', noon: 'הצהריים', evening: 'הערב' };
const UNITS = {
  tablet: ['כדור אחד', 'כדורים'], capsule: ['קפסולה אחת', 'קפסולות'], liquid: ['1 מ״ל', 'מ״ל'],
  drops: ['טיפה אחת', 'טיפות'], inhaler: ['שאיפה אחת', 'שאיפות'], injection: ['זריקה אחת', 'זריקות'],
};

async function snapshot() {
  try {
    const res = await (await caches.open('remind-data')).match('./__state');
    return res ? await res.json() : null;
  } catch {
    return null;
  }
}

function amount(med) {
  const [one, many] = UNITS[med.form] || UNITS.tablet;
  const n = Number(med.amount) || 1;
  if (med.form === 'liquid') return `${n} מ״ל`;
  return n === 1 ? one : `${n} ${many}`;
}

async function doseNotification(msg) {
  const snap = await snapshot();
  const taken = snap?.log?.[msg.date] || {};
  const keys = (msg.keys || []).filter(k => !taken[k]);
  const slot = (msg.keys?.[0] || '').split('@')[1];
  const when = SLOTS[slot] ? `של ${SLOTS[slot]}` : `של ${msg.t}`;
  const names = keys.map(k => {
    const med = snap?.meds?.find(m => m.id === k.split('@')[0]);
    return med ? `${med.name} · ${amount(med)}` : null;
  }).filter(Boolean);

  // iPhone requires a visible notification for every push, so even if it's all marked already, say so.
  if (!keys.length) return { title: 'Remind.', body: `כל התרופות ${when} סומנו ✓` };
  const title = msg.n > 0 ? `עוד לא סומן: התרופות ${when}` : `הגיע הזמן לתרופות ${when}`;
  const body = (names.length ? names.join('\n') : `${keys.length} תרופות`) + '\nלסמן באפליקציה אחרי שלוקחים';
  return { title, body };
}

self.addEventListener('push', e => {
  let msg;
  try { msg = e.data.json(); } catch { msg = { type: 'test' }; }
  e.waitUntil((async () => {
    const n = msg.type === 'dose'
      ? await doseNotification(msg)
      : { title: 'Remind.', body: 'ככה ייראו התזכורות. הכל עובד ✓' };
    await self.registration.showNotification(n.title, {
      body: n.body,
      tag: msg.type === 'dose' ? `dose-${msg.date}-${msg.t}` : 'test',
      renotify: true,
      icon: 'img/icon-192.png',
      badge: 'img/icon-192.png',
      data: { date: msg.date, t: msg.t },
      requireInteraction: msg.type === 'dose',
    });
    for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'refresh' });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c);
    if (open) {
      open.postMessage({ type: 'open-dose', ...e.notification.data });
      return open.focus();
    }
    return self.clients.openWindow('./#home');
  }));
});
