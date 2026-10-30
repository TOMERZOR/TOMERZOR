import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const b64u = bytes => Buffer.from(bytes).toString('base64url');
const send = body => worker.fetch(new Request('https://relay.test/send', { method: 'POST', body: JSON.stringify(body) }));
const valid = {
  endpoint: 'https://web.push.apple.com/QK7abc',
  headers: { Authorization: 'vapid t=x.y.z, k=abc', 'Content-Encoding': 'aes128gcm', TTL: '300', Urgency: 'high', Cookie: 'nope' },
  body: b64u(new Uint8Array([1, 2, 3, 4])),
};

test('forwards to the push service with only the push headers', async t => {
  let seen;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    seen = { url, init };
    return new Response(null, { status: 201 });
  });
  const res = await send(valid);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 201, reason: null });
  assert.equal(seen.url, 'https://web.push.apple.com/QK7abc');
  assert.deepEqual(Object.keys(seen.init.headers).sort(), ['Authorization', 'Content-Encoding', 'TTL', 'Urgency']);
  assert.deepEqual([...seen.init.body], [1, 2, 3, 4]);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
});

test('refuses anything that is not a push service', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 201 }));
  for (const endpoint of ['https://example.com/x', 'http://web.push.apple.com/x', 'https://evilpush.apple.com.example.com/x', 'nonsense']) {
    const res = await send({ ...valid, endpoint });
    assert.equal(res.status, 400, endpoint);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('accepts the other browsers\' push services', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 201 }));
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://api.push.apple.com/x']) {
    assert.equal((await send({ ...valid, endpoint })).status, 200, endpoint);
  }
});

test('rejects bad bodies and missing authorization', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 201 }));
  assert.equal((await send({ ...valid, body: '' })).status, 400);
  assert.equal((await send({ ...valid, body: b64u(new Uint8Array(5000)) })).status, 400);
  assert.equal((await send({ ...valid, headers: { TTL: '60' } })).status, 400);
  const bad = await worker.fetch(new Request('https://relay.test/send', { method: 'POST', body: '{nope' }));
  assert.equal(bad.status, 400);
});

test('passes back a gone subscription', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Unregistered', { status: 410 }));
  const res = await send(valid);
  assert.equal(res.status, 410);
  assert.equal((await res.json()).status, 410);
});

test('health and preflight', async () => {
  assert.deepEqual(await (await worker.fetch(new Request('https://relay.test/health'))).json(), { ok: true, service: 'shomer-push' });
  assert.equal((await worker.fetch(new Request('https://relay.test/send', { method: 'OPTIONS' }))).status, 204);
});
