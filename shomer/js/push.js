// Push notifications that reach the phone even when it's locked or Shomer is in the background.
//
// On an iPhone that has to go through Apple's push service, so it needs internet. The content is
// end-to-end encrypted on the camera (Web Push, RFC 8291) and signed with the camera's own key
// (VAPID, RFC 8292): Apple, and the small relay that forwards it (browsers can't post to Apple
// directly), see only that a notification was sent, never what it says. Photos never go this way.
//
// Pairing: over the local link the camera gives the phone its public key, the phone subscribes
// with it and sends the subscription back. The camera keeps it, so pushes keep working after the
// local link drops.

import { config } from './config.js';

const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

// ---------- Camera side ----------

// The camera's signing key, kept on the camera so phones stay subscribed across restarts.
export async function cameraKeys(store) {
  let saved = store.get('vapid', null);
  if (!saved) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    saved = {
      privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
      publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)),
    };
    store.set('vapid', saved);
  }
  const privateKey = await crypto.subtle.importKey('jwk', saved.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { publicKey: saved.publicKey, privateKey };
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// RFC 8291 (aes128gcm): encrypt for the phone's p256dh key and auth secret.
export async function encryptPayload(subscription, text) {
  const uaPublic = unb64u(subscription.keys.p256dh);
  const authSecret = unb64u(subscription.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const record = concat(enc.encode(text), new Uint8Array([2])); // 0x02: last (and only) record
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, record));

  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// RFC 8292: a short-lived token signed with the camera's key, for the push service's origin.
export async function vapidHeader(endpoint, keys) {
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'https://tomerzor.github.io/TOMERZOR/shomer/',
  })));
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${keys.publicKey}`;
}

// Returns true when the push service accepted it.
export async function sendPush(subscription, keys, notification) {
  const body = await encryptPayload(subscription, JSON.stringify(notification));
  const headers = {
    Authorization: await vapidHeader(subscription.endpoint, keys),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: '300', // an alert older than 5 minutes isn't worth delivering
    Urgency: 'high',
  };
  let res;
  if (config.pushRelay) {
    res = await fetch(`${config.pushRelay}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint, headers, body: b64u(body) }),
    });
  } else {
    res = await fetch(subscription.endpoint, { method: 'POST', headers, body });
  }
  if (res.status === 404 || res.status === 410) throw Object.assign(new Error('subscription gone'), { gone: true });
  return res.ok;
}

// ---------- Phone side ----------

export function pushSupport() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iPhone: push works only in the app added to the home screen (iOS 16.4 and later).
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios ? 'ios-browser' : 'none';
  }
  return 'ok';
}

// Must run from a tap. Returns the subscription to hand to the camera.
export async function subscribe(cameraPublicKey) {
  if ((await Notification.requestPermission()) !== 'granted') throw Object.assign(new Error('denied'), { denied: true });
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // A subscription is bound to one signing key; a different camera key needs a new one.
  if (sub && b64u(sub.options?.applicationServerKey || new ArrayBuffer(0)) !== cameraPublicKey) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(cameraPublicKey) });
  return sub.toJSON();
}
