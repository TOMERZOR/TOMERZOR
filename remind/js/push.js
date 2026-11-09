// Reminders while the app is closed or the phone is locked.
//
// A web page can't schedule a notification for later, so the reminder server (server/) sends each
// one as a Web Push at its time. It gets the dose times, random dose ids and which ones were
// taken, never medicine names: the service worker (sw.js) puts the names back in from a copy of
// the state kept on the phone (writeSnapshot), so the server and Apple's push service only see ids.

import { config } from './config.js';
import { serverSchedule, serverTaken } from './store.js';

const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function deviceId(state) {
  if (!state.device.id) state.device.id = b64u(crypto.getRandomValues(new Uint8Array(16)));
  return state.device.id;
}

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 'ok' | 'install' (iPhone: works only from the home-screen app) | 'none'
export function support() {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  return isIOS() && !isStandalone() ? 'install' : 'none';
}

export const permission = () => ('Notification' in window ? Notification.permission : 'default');

// For the service worker: medicine names and today's marks, so a notification can name the
// medicines and skip ones already taken.
export async function writeSnapshot(state) {
  try {
    const cache = await caches.open('remind-data');
    const snap = { meds: state.meds.map(m => ({ id: m.id, name: m.name, amount: m.amount, form: m.form })), log: state.log, name: state.profile.name, slots: state.profile.slots };
    await cache.put('./__state', new Response(JSON.stringify(snap), { headers: { 'Content-Type': 'application/json' } }));
  } catch {}
}

const api = (path, init) => fetch(`${config.server}${path}`, init).then(async res => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
});

// Must run from a tap (the permission prompt needs one).
export async function enable(state) {
  if (!config.server) throw new Error('no server');
  if ((await Notification.requestPermission()) !== 'granted') throw Object.assign(new Error('denied'), { denied: true });
  const reg = await navigator.serviceWorker.ready;
  const id = deviceId(state);
  const { key } = await api(`/d/${id}/key`);
  let sub = await reg.pushManager.getSubscription();
  if (sub && b64u(sub.options?.applicationServerKey || new ArrayBuffer(0)) !== key) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
  state.device.push = true;
  await sync(state, sub);
}

export async function disable(state) {
  state.device.push = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {}
  if (state.device.id) await api(`/d/${state.device.id}`, { method: 'DELETE' }).catch(() => {});
}

export async function sync(state, sub) {
  if (!state.device.push || !config.server) return;
  if (!sub) {
    const reg = await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
    if (!sub) { state.device.push = false; return; }
  }
  await api(`/d/${deviceId(state)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      nag: state.profile.nag,
      schedule: serverSchedule(state),
      taken: serverTaken(state),
    }),
  });
}

export async function test(state) {
  await api(`/d/${deviceId(state)}/test`, { method: 'POST' });
}
