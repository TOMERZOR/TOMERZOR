import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonedTime, localParts, addDays, plan, clean, encryptPayload } from '../worker.js';

const TZ = 'Asia/Jerusalem';
const at = (date, time) => zonedTime(date, time, TZ);
const state = (extra = {}) => ({
  tz: TZ,
  nag: 15,
  schedule: [
    { t: '08:00', items: [{ k: 'a@morning', d: null }, { k: 'b@morning', d: null }] },
    { t: '20:00', items: [{ k: 'a@evening', d: [5] }] }, // Fridays only
  ],
  taken: {},
  ...extra,
});

test('wall clock time in a zone, across daylight saving', () => {
  assert.equal(new Date(at('2026-07-01', '08:00')).toISOString(), '2026-07-01T05:00:00.000Z'); // IDT, UTC+3
  assert.equal(new Date(at('2026-12-01', '08:00')).toISOString(), '2026-12-01T06:00:00.000Z'); // IST, UTC+2
  assert.equal(localParts(at('2026-10-30', '20:00'), TZ).date, '2026-10-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('sends at the dose time, then repeats until taken', () => {
  const s = state();
  const t0 = at('2026-11-02', '08:00');
  assert.deepEqual(plan(s, t0 - 60000, t0 - 1000).send, []);
  assert.equal(plan(s, t0 - 60000, t0 - 1000).next, t0);

  const first = plan(s, t0 - 60000, t0 + 500);
  assert.equal(first.send.length, 1);
  assert.deepEqual(first.send[0], { date: '2026-11-02', t: '08:00', n: 0, keys: ['a@morning', 'b@morning'] });
  assert.equal(first.next, t0 + 15 * 60000);

  s.taken = { '2026-11-02': ['a@morning'] };
  const repeat = plan(s, t0 + 500, t0 + 15 * 60000 + 500);
  assert.deepEqual(repeat.send[0].keys, ['b@morning']);
  assert.equal(repeat.send[0].n, 1);

  s.taken = { '2026-11-02': ['a@morning', 'b@morning'] };
  assert.deepEqual(plan(s, t0 + 15 * 60000 + 500, t0 + 30 * 60000 + 500).send, []);
});

test('repeats stop two hours after the dose time', () => {
  const s = state();
  const t0 = at('2026-11-02', '08:00');
  const p = plan(s, t0 + 120 * 60000 - 1000, t0 + 120 * 60000 + 500);
  assert.equal(p.send[0].n, 8);
  assert.equal(p.next, at('2026-11-03', '08:00'));
});

test('no repeats when turned off', () => {
  const s = state({ nag: 0 });
  const t0 = at('2026-11-02', '08:00');
  assert.equal(plan(s, t0 + 500, t0 + 1000).next, at('2026-11-03', '08:00'));
});

test('weekdays, start and end dates', () => {
  const s = state({ schedule: [{ t: '20:00', items: [{ k: 'a@evening', d: [5] }] }], nag: 0 });
  // 2026-11-02 is a Monday; the next Friday is 2026-11-06.
  assert.equal(plan(s, at('2026-11-02', '09:00'), at('2026-11-02', '09:00')).next, at('2026-11-06', '20:00'));
  s.schedule[0].items[0] = { k: 'a@evening', d: null, s: '2026-11-04', u: '2026-11-05' };
  assert.equal(plan(s, at('2026-11-02', '09:00'), at('2026-11-02', '09:00')).next, at('2026-11-04', '20:00'));
  // After the course ends nothing is due; it only wakes up later to look again.
  const now = at('2026-11-05', '21:00');
  assert.equal(plan(s, now, now).next, now + 30 * 86400000);
  assert.equal(plan({ ...s, schedule: [] }, now, now).next, null);
});

test('once a month, on the day of the month', () => {
  const s = state({ nag: 0, schedule: [{ t: '10:30', items: [{ k: 'b@10:30', d: null, m: 15 }] }] });
  assert.equal(plan(s, at('2026-11-02', '09:00'), at('2026-11-02', '09:00')).next, at('2026-11-15', '10:30'));
  assert.equal(plan(s, at('2026-11-15', '11:00'), at('2026-11-15', '11:00')).next, at('2026-12-15', '10:30'));
  const sent = plan(s, at('2026-11-15', '10:29'), at('2026-11-15', '10:30') + 500).send;
  assert.deepEqual(sent, [{ date: '2026-11-15', t: '10:30', n: 0, keys: ['b@10:30'] }]);
  // The 31st falls on the last day of shorter months.
  s.schedule[0].items[0].m = 31;
  assert.equal(plan(s, at('2027-02-01', '09:00'), at('2027-02-01', '09:00')).next, at('2027-02-28', '10:30'));
});

test('one date only', () => {
  const s = state({ nag: 0, schedule: [{ t: '09:00', items: [{ k: 'c@09:00', d: null, o: '2026-11-20' }] }] });
  assert.equal(plan(s, at('2026-11-02', '08:00'), at('2026-11-02', '08:00')).next, at('2026-11-20', '09:00'));
  // Months away: no moment within the horizon, so it wakes in 30 days to look again.
  s.schedule[0].items[0].o = '2027-03-01';
  const now = at('2026-11-02', '08:00');
  assert.equal(plan(s, now, now).next, now + 30 * 86400000);
  assert.equal(plan(s, at('2027-02-20', '08:00'), at('2027-02-20', '08:00')).next, at('2027-03-01', '09:00'));
});

test('a late alarm sends only the latest reminder per dose time', () => {
  const s = state();
  const t0 = at('2026-11-02', '08:00');
  const p = plan(s, t0 - 1000, t0 + 40 * 60000);
  assert.equal(p.send.length, 1);
  assert.equal(p.send[0].n, 2);
});

test('input is checked', () => {
  assert.throws(() => clean({ tz: 'Nowhere/City' }));
  assert.throws(() => clean({ tz: TZ, schedule: [{ t: '25:00', items: [] }] }));
  assert.throws(() => clean({ tz: TZ, subscription: { endpoint: 'https://evil.example/x', keys: { p256dh: 'a', auth: 'b' } } }));
  const ok = clean({ tz: TZ, nag: 7, schedule: [{ t: '08:00', items: [{ k: 'x@morning', d: [1, 9] }, { k: 'y@morning', d: null, m: 40, o: 'soon' }, { k: 'z@morning', d: null, m: 15, o: '2026-12-01' }] }] });
  assert.equal(ok.nag, 15);
  assert.deepEqual(ok.schedule[0].items[0].d, [1]);
  assert.deepEqual(ok.schedule[0].items[1], { k: 'y@morning', d: null });
  assert.deepEqual(ok.schedule[0].items[2], { k: 'z@morning', d: null, m: 15, o: '2026-12-01' });
});

test('push payload is encrypted for the subscription (RFC 8291 layout)', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const b64u = b => Buffer.from(b).toString('base64url');
  const body = await encryptPayload({ keys: { p256dh: b64u(raw), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) } }, '{"type":"test"}');
  assert.equal(body[20], 65); // key id length: an uncompressed P-256 public key
  assert.equal(body.length, 16 + 4 + 1 + 65 + 15 + 1 + 16);
});
