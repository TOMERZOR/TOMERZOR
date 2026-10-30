// Alerts while the app is closed or the phone is locked. The market server scans all the time and
// sends a Web Push when something happens; the service worker (sw.js) shows it.

import * as api from './api.js';
import { serverPayload } from './store.js';

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

// Must run from a tap (the permission prompt needs one).
export async function enable(state) {
  if (!api.hasServer()) throw new Error('no server');
  if ((await Notification.requestPermission()) !== 'granted') throw Object.assign(new Error('denied'), { denied: true });
  const reg = await navigator.serviceWorker.ready;
  const id = deviceId(state);
  const { key } = await api.deviceKey(id);
  let sub = await reg.pushManager.getSubscription();
  if (sub && b64u(sub.options?.applicationServerKey || new ArrayBuffer(0)) !== key) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
  state.device.push = true;
  await api.devicePut(id, { ...serverPayload(state), subscription: sub.toJSON() });
}

export async function disable(state) {
  state.device.push = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {}
  if (state.device.id) await api.devicePut(state.device.id, serverPayload(state)).catch(() => {});
}

// Sends the settings, watchlist and positions (the server keeps the subscription it has).
let timer = null;
export function sync(state, now = false) {
  if (!api.hasServer()) return Promise.resolve();
  clearTimeout(timer);
  const run = () => api.devicePut(deviceId(state), serverPayload(state)).catch(() => {});
  if (now) return run();
  return new Promise(resolve => { timer = setTimeout(() => run().then(resolve), 800); });
}

export const test = state => api.deviceTest(deviceId(state));
