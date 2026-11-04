// Phone notifications (Web Push): new messages and new followers, even when the app is closed.
// On an iPhone they work only from the app added to the home screen (iOS 16.4 and later).

const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'ok' | 'install' (iPhone in Safari: add to the home screen first) | 'none'
export function support() {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  return isIOS() && !isStandalone() ? 'install' : 'none';
}

export const permission = () => ('Notification' in window ? Notification.permission : 'default');

// Is this phone subscribed right now?
export async function active() {
  if (support() !== 'ok' || permission() !== 'granted') return false;
  try { return !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()); } catch { return false; }
}

// Must run from a tap: the permission prompt needs one.
export async function enable(api, sess) {
  if ((await Notification.requestPermission()) !== 'granted') throw Object.assign(new Error('denied'), { code: 'denied' });
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api.pushKey();
  let sub = await reg.pushManager.getSubscription();
  if (sub && b64u(sub.options?.applicationServerKey || new ArrayBuffer(0)) !== key) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
  await api.subscribe(sess, sub.toJSON());
}

export async function disable(api, sess) {
  try {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) {
      await api.unsubscribe(sess, sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {}
}

// Keeps the server's copy fresh (a phone can renew its subscription on its own).
export async function refresh(api, sess) {
  try {
    if (!(await active())) return;
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    await api.subscribe(sess, sub.toJSON());
  } catch {}
}
