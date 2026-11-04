import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Network, commonGround, cleanProfile, prettyLevel, norm, unitChain } from '../../js/core.js';
import { MemoryStore } from '../../js/local.js';
import { SqlStore, handle, makeLimiter, randomString } from '../worker.js';

// The Durable Object's `ctx.storage.sql`, on Node's built-in SQLite.
function fakeSql() {
  const db = new DatabaseSync(':memory:');
  return {
    exec(q, ...args) {
      if (!args.length && q.trim().split(';').filter(s => s.trim()).length > 1) { db.exec(q); return { toArray: () => [] }; }
      const st = db.prepare(q);
      const rows = /^\s*select/i.test(q) ? st.all(...args) : (st.run(...args), []);
      return { toArray: () => rows.map(r => ({ ...r })) };
    },
  };
}

const stores = { memory: () => new MemoryStore(), sqlite: () => new SqlStore(fakeSql()) };

const person = (name, extra = {}) => ({ name, g: 'm', born: 2003, city: 'רעננה', status: 'active', unit: { corps: 'artillery', path: ['215', '402', 'ב'] }, ...extra });

for (const [kind, make] of Object.entries(stores)) {
  test(`${kind}: register, follow, friends and mutual connections`, () => {
    let t = 1000;
    const net = new Network(make(), { random: randomString, now: () => t++ });
    const a = net.register({ profile: person('אורי') });
    const b = net.register({ profile: person('בר') });
    const c = net.register({ profile: person('גל', { city: 'חיפה', unit: { corps: 'infantry', path: ['גולני'] } }) });
    const ua = () => net.auth(a.id, a.token), ub = () => net.auth(b.id, b.token), uc = () => net.auth(c.id, c.token);

    assert.throws(() => net.auth(a.id, 'wrong'), /auth/);

    // Without the key or a connection only the summary is visible.
    const before = net.view(uc(), a.id);
    assert.equal(before.level, 'summary');
    assert.equal(before.person.profile, undefined);
    // With the QR key: the full path.
    const scanned = net.view(uc(), a.id, a.key);
    assert.equal(scanned.level, 'full');
    assert.equal(scanned.person.profile.unit.path[1], '402');

    // c scans a: follows with met; a gets a "scan" event; c keeps full access.
    assert.deepEqual(net.follow(uc(), a.id, a.key), { following: true, followsMe: false, friends: false, met: true });
    assert.equal(net.view(uc(), a.id).level, 'full');
    assert.equal(net.feed(ua()).events[0].kind, 'scan');
    // a follows back: friends, and c gets a "friend" event.
    assert.equal(net.follow(ua(), c.id).friends, true);
    assert.equal(net.feed(uc()).events[0].kind, 'friend');

    // b follows c, c follows b: c is a mutual connection of a and b.
    net.follow(ub(), c.id);
    net.follow(uc(), b.id);
    const v = net.view(ub(), a.id);
    assert.equal(v.mutualCount, 1);
    assert.equal(v.mutual[0].id, c.id);
    assert.equal(v.common[0].k, 'unit');
    assert.equal(v.common[0].detail, '', 'unit details stay hidden at summary level');
    assert.ok(v.common.some(x => x.k === 'city'));

    // a's suggestions include b (friend of a friend, same unit).
    const sug = net.feed(ua()).suggestions;
    assert.equal(sug[0].id, b.id);

    assert.deepEqual(net.counts(a.id), { friends: 1, followers: 1, following: 1 });
    assert.equal(net.list(ua(), a.id, 'friends')[0].id, c.id);
    assert.throws(() => net.list(ub(), a.id, 'friends'), /private/);

    // A new current role is announced to followers.
    net.update(ua(), { profile: { ...person('אורי'), roles: [{ t: 'מפקד צוות', from: 2024 }] } });
    assert.equal(net.feed(uc()).events[0].kind, 'role');

    // A new key stops the old QR code from opening the full profile.
    net.newKey(ua());
    assert.equal(net.view(ub(), a.id, a.key).level, 'summary');

    // Search by name and by unit.
    assert.equal(net.search(ub(), 'גל')[0].id, c.id);
    assert.ok(net.search(uc(), '215').some(x => x.id === a.id));

    net.remove(ua());
    assert.equal(net.view(ub(), c.id).mutualCount, 0);
    assert.throws(() => net.view(ub(), a.id), /not_found/);
  });
}

test('common ground: deepest shared level, mechina, tironut, draft', () => {
  const a = cleanProfile(person('א', { prep: { kind: 'mechina', name: 'מכינת רבין' }, tironut: 'שיזפון', draft: '2023-08' }));
  const b = cleanProfile(person('ב', { prep: { kind: 'mechina', name: 'רבין' }, tironut: 'שיזפון ', draft: '2023-08', unit: { corps: 'artillery', path: ['215', 'גדוד 402', 'ב׳'] } }));
  const c = commonGround(a, b);
  assert.equal(c[0].k, 'unit');
  assert.equal(c[0].title, 'אותה סוללה!');
  assert.equal(c[0].detail, 'חטיבה 215 · גדוד 402 · סוללה ב׳');
  assert.deepEqual(c.map(x => x.k).sort(), ['city', 'draft', 'prep', 'tironut', 'unit']);
  const d = commonGround(a, cleanProfile(person('ד', { unit: { corps: 'artillery', path: ['282'] } })));
  assert.equal(d.find(x => x.k === 'corps').title, 'שניכם בתותחנים');
});

test('profile cleaning and display helpers', () => {
  const p = cleanProfile({ name: '  דנה\n ', g: 'q', unit: { corps: 'nope', path: ['x'] }, roles: [{ t: '' }, { t: 'לוחמת', from: '2023', to: 'x' }], vis: 'everyone', prep: { kind: 'none', name: 'abc' } });
  assert.equal(p.name, 'דנה');
  assert.equal(p.g, 'm');
  assert.deepEqual(p.unit, { corps: '', path: [] });
  assert.deepEqual(p.roles, [{ t: 'לוחמת', from: 2023, to: '' }]);
  assert.equal(p.vis, 'met');
  assert.equal(p.prep.name, '');
  assert.equal(prettyLevel('גדוד', '13'), 'גדוד 13');
  assert.equal(prettyLevel('סוללה', 'ג'), 'סוללה ג׳');
  assert.equal(prettyLevel('חטיבה', 'גולני'), 'גולני');
  assert.equal(norm('נח"ל'), norm('נח״ל'));
  assert.deepEqual(unitChain(cleanProfile(person('x'))).map(x => x.text), ['חטיבה 215', 'גדוד 402', 'סוללה ב׳']);
});

test('http routes', async () => {
  const net = new Network(new SqlStore(fakeSql()), { random: randomString, photoUrl: (id, v) => (v ? `/p/${id}` : null) });
  const limiter = makeLimiter(2);
  const call = async (method, path, body, s) => {
    const req = new Request(`https://x.dev${path}`, { method, headers: s ? { Authorization: `Bearer ${s.id}.${s.token}` } : {}, body: body ? JSON.stringify(body) : undefined });
    try {
      const res = await handle(req, net, limiter);
      return { status: res.status, data: res.headers.get('Content-Type')?.includes('json') ? await res.json() : await res.arrayBuffer() };
    } catch (e) { return { status: e.status, data: { error: e.code } }; }
  };
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  const a = (await call('POST', '/register', { profile: person('אורי'), photo })).data;
  const b = (await call('POST', '/register', { profile: person('בר') })).data;
  assert.equal((await call('POST', '/register', { profile: person('ג') })).status, 429);
  assert.equal((await call('POST', '/register', { profile: {} })).status, 429);
  assert.equal(a.me.photo, `/p/${a.id}`);
  const img = await call('GET', `/p/${a.id}`);
  assert.equal(img.status, 200);
  assert.equal(new Uint8Array(img.data)[1], 0x50);
  assert.equal((await call('GET', '/me', null, { id: a.id, token: 'x' })).status, 401);
  assert.equal((await call('GET', `/u/${a.id}?k=${a.key}`)).data.level, 'full');
  assert.equal((await call('GET', `/u/${a.id}`)).data.level, 'summary');
  assert.equal((await call('POST', `/u/${a.id}/follow`, { key: a.key }, b)).data.met, true);
  assert.equal((await call('GET', '/me', null, a)).data.unread, 1);
  assert.equal((await call('GET', '/feed', null, a)).data.events[0].actor.id, b.id);
  assert.equal((await call('DELETE', `/u/${b.id}/follower`, null, a)).data.followsMe, false);
  assert.equal((await call('PUT', '/me', { photo: 'data:text/html;base64,AA==' }, a)).status, 400);
  assert.equal((await call('GET', '/nope')).status, 404);
  assert.equal((await call('DELETE', '/me', null, a)).data.ok, true);
});

test('air defense: battalion, battery and פלגה inside the air force', () => {
  const a = cleanProfile(person('א', { unit: { corps: 'airdef', path: ['137', 'ב', 'א'] } }));
  assert.deepEqual(unitChain(a).map(x => x.text), ['גדוד 137', 'סוללה ב׳', 'פלגה א׳']);
  const b = cleanProfile(person('ב', { unit: { corps: 'airdef', path: ['137', 'ב', 'א', '2'] } }));
  assert.equal(commonGround(a, b)[0].title, 'אותה פלגה!');
  const c = cleanProfile(person('ג', { city: 'חיפה', unit: { corps: 'air', path: ['רמת דוד'] } }));
  assert.equal(commonGround(a, c).find(x => x.k === 'corps').title, 'שניכם בחיל האוויר');
});
