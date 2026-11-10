// What stands on each city block, and what lies outside the grid.
import { rgb, shade } from './geo.js';
import { WIN } from './textures.js';
import { Rng } from '../core/util.js';
import { CURB, setPOI, XS, ZS, WORLD_HALF } from './map.js';
import { POSTERS } from './city.js';

const H = Math.PI / 2;
let blockNo = 401;

const BASE_TINT = { sand: [0.8, 0.76, 0.68], paving: [0.86, 0.85, 0.82] };
function base(B, ch, b, mat, k = 5, col) {
  col = col || BASE_TINT[mat];
  ch.get(mat).floor(b.cx, CURB - 0.004, b.cz, b.w, b.d, 0, [b.x0 / k, b.z0 / k, b.x1 / k, b.z1 / k], col);
}
function patch(ch, mat, x, z, w, d, k = 5, col) {
  ch.get(mat).floor(x, CURB + 0.004, z, w, d, 0, [(x - w / 2) / k, (z - d / 2) / k, (x + w / 2) / k, (z + d / 2) / k], col);
}
function sitGroup(B, ch, x, z, rng, kind = 'yard') {
  B.table(ch, x, z);
  const n = rng.i(2, 4);
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rng.f(0.5); B.chair(ch, x + Math.cos(a) * 0.95, z + Math.sin(a) * 0.95, Math.atan2(-Math.cos(a), -Math.sin(a))); }
  B.hang.push({ x, z, r: 1.8, kind });
}
function posterWall(B, ch, x, z, yaw, n, rng) {
  // a low wall plastered with posters
  const w = n * 1.25 + 0.4;
  ch.get('concrete').box(x, CURB, z, w, 2.1, 0.2, yaw, { c: rgb('#b9b5aa'), s: 2 });
  B.solid(x, z, w / 2, 0.12, yaw, 2.1);
  for (let i = 0; i < n; i++) {
    const r = B.poster(rng.pick(POSTERS));
    ch.get('sign').panel(x, z, yaw, -w / 2 + 0.8 + i * 1.25, CURB + 0.45, 1.1, 1.45, 0.105, r);
  }
}

// ---- Residential ---------------------------------------------------------------
function residential(B, ch, b, rng, o = {}) {
  base(B, ch, b, 'sand');
  const alongX = o.alongX !== undefined ? o.alongX : rng.chance(0.5);
  const gimel = !!o.gimel;
  const L = (alongX ? b.w : b.d) - 12, mid = alongX ? b.d : b.w;
  const mk = (lx, lz, len, yaw, extra = {}) => {
    const x = alongX ? b.cx + lx : b.cx + lz, z = alongX ? b.cz + lz : b.cz + lx;
    return B.slab(ch, Object.assign({
      x, z, len, yaw: alongX ? yaw : yaw + H, floors: rng.pick([3, 4, 4, 4]), pilotis: rng.chance(0.45),
      seed: rng.i(1, 99999), number: blockNo++, gimel,
    }, extra));
  };
  // two long blocks facing each other across a car park and a yard
  const off = mid / 2 - 8.5;
  const homeExtra = o.home ? { number: 412, pilotis: false, floors: 4, tint: rgb('#e4d69c'), trim: rgb('#2f7f86'), home: true, entrances: 5 } : {};
  mk(0, -off, L, alongX ? 0 : Math.PI, homeExtra);
  mk(0, off, L, alongX ? Math.PI : 0);
  const toW = (lx, lz) => (alongX ? [b.cx + lx, b.cz + lz] : [b.cx + lz, b.cz + lx]);
  // car park down the middle, a driveway out to the street
  const [px, pz] = toW(-6, 0);
  B.lot(ch, px, pz, alongX ? L - 30 : 15, alongX ? 15 : L - 30, alongX ? 0 : H, gimel ? 'gimel' : 'res');
  const [dx, dz] = toW(-(L - 30) / 2 - 6 - 8, 0);
  patch(ch, 'asphalt', dx, dz, alongX ? 22 : 6, alongX ? 6 : 22, 6, [0.82, 0.82, 0.82]);
  // a shorter block closing the far end
  if (mid > 80) mk(L / 2 - 7, 0, Math.min(38, mid - 46), alongX ? -H : H, { entrances: 2 });
  // yards on both sides of the car park
  for (const s of [-1, 1]) {
    const yz = s * (off - 15.5);
    const [gx, gz] = toW(-6, yz);
    patch(ch, 'grass', gx, gz, alongX ? L - 34 : 9, alongX ? 9 : L - 34, 5, [0.92, 0.9, 0.82]);
    for (let t = -L / 2 + 14; t < L / 2 - 26; t += rng.f(11, 17)) {
      const [tx, tz] = toW(t, yz + rng.f(-3, 3));
      const r = rng.next();
      if (r < 0.4) B.tree(ch, tx, tz, rng.f(0.9, 1.4), rng, rng.pick(['ficus', 'ficus', 'euc']));
      else if (r < 0.55) B.palm(ch, tx, tz, rng.f(6, 9), rng);
      else if (r < 0.7) B.bench(ch, tx, tz, rng.pick([0, H, Math.PI, -H]));
      else if (r < 0.82) sitGroup(B, ch, tx, tz, rng, gimel ? 'gimel' : 'yard');
      else if (r < 0.9) B.tree(ch, tx, tz, 0.55, rng, 'bush');
    }
    const [bx, bz] = toW(L / 2 - 34 + s * 3, s * 9.5);
    B.dumpster(ch, bx, bz, alongX ? 0 : H);
    if (rng.chance(0.6)) { const [b2x, b2z] = toW(L / 2 - 31 + s * 3, s * 9.5); B.dumpster(ch, b2x + (alongX ? 2.6 : 0), b2z + (alongX ? 0 : 2.6), alongX ? 0 : H); }
  }
  const [sx, sz] = toW(-L / 2 + 6, (rng.sign()) * (off - 16));
  B.shelter(ch, sx, sz, alongX ? H : 0, b.c + b.r * 5);
  if (o.home) {
    const [hx, hz] = toW(-L / 2 + L / 5 / 2 + (L / 5) * 2, -off + 5.2 + 2.2);
    setPOI('home', hx, hz, { yaw: alongX ? 0 : H });
    const [yx, yz] = toW(-10, -off + 14);
    setPOI('yard', yx, yz);
    sitGroup(B, ch, yx + 4, yz + 1, rng, 'yard');
    const [mx, mz] = toW(8, -off + 9.5);
    setPOI('mom', mx, mz);
  }
  if (gimel) B.hang.push({ x: b.cx + rng.f(-10, 10), z: b.cz + rng.f(-10, 10), r: 4, kind: 'gimel' });
  else if (rng.chance(0.6)) B.hang.push({ x: px + rng.f(-8, 8), z: pz + rng.f(-3, 3), r: 3, kind: 'yard' });
}

// ---- The commercial centre -------------------------------------------------------
function center(B, ch, b, rng) {
  base(B, ch, b, 'paving', 2.6);
  const n = b.z0 + 5.5;
  B.shops(ch, { x: b.cx, z: n, len: b.w - 26, dep: 9, yaw: 0, tint: rgb('#d9d2bd'), units: [
    { name: 'פיצוציית הנסיך', sub: 'פתוח 24/7 · גם בשבת · אל תגידו', bg: '#b3261e', bg2: '#7d1711', fg: '#ffe17a', poi: 'kiosk', hang: 'kiosk', awning: '#b3261e' },
    { name: 'פלאפל אליהו', sub: 'המקורי. באמת. לא זה ממול', bg: '#f5b301', fg: '#1c1c1c', subFg: '#1c1c1c', poi: 'falafel', hang: 'food', awning: '#f5b301' },
    { name: 'מכולת שושנה', sub: 'אפשר לרשום · עד גבול מסוים', bg: '#1f8a8a', bg2: '#145e5e', fg: '#fff' },
    { name: 'מספרת פייד', sub: 'תספורת + עצה לחיים · 50₪', bg: '#16181d', fg: '#f3efe6', stripe: '#b3261e' },
    { name: 'צ׳יינג׳ הזהב', sub: 'הלוואות · המרות · דיסקרטיות', bg: '#c7a23a', bg2: '#8a6d1c', fg: '#16181d', subFg: '#16181d', poi: 'change' },
    { name: 'לוטו · טוטו', sub: 'היום זה היום (כמו אתמול)', bg: '#0f6b5c', fg: '#fff', stripe: '#f5b301', subFg: '#111' },
  ] });
  B.shops(ch, { x: b.x0 + 5.5, z: b.cz + 6, len: 56, dep: 9, yaw: H, tint: rgb('#cfd0c8'), units: [
    { name: 'דואר קריית שמש', sub: 'זמן המתנה משוער: כן', bg: '#c6261e', fg: '#fff', poi: 'post' },
    { name: 'בית מרקחת', sub: 'אקמול · עצות · רכילות', bg: '#f3efe6', fg: '#0f6b5c', subFg: '#0f6b5c' },
    { name: 'סלולר פיקס', sub: 'מתקנים מסכים · שוברים מחירים', bg: '#2a6bff', bg2: '#1741a8', fg: '#fff' },
    { name: 'בורקס האחים', sub: 'חם מהתנור משנת 1983', bg: '#7c4a1e', fg: '#ffe7b0', awning: '#7c4a1e' },
  ] });
  B.shops(ch, { x: b.x1 - 5.5, z: b.cz + 6, len: 56, dep: 9, yaw: -H, tint: rgb('#d9cdb0'), units: [
    { name: 'שווארמה הכוכב', sub: 'לאפה · פיתה · צ׳יפס בפנים', bg: '#16181d', fg: '#f5b301', poi: 'shawarma', hang: 'food', awning: '#16181d' },
    { name: 'קפה שש־בש', sub: 'קפה שחור · ויכוחים חינם', bg: '#3d2a1d', fg: '#f3efe6', poi: 'cafe', hang: 'cafe' },
    { name: 'הכל ב־5', sub: '(רוב הדברים ב־10)', bg: '#ff7ab6', fg: '#16181d', subFg: '#16181d' },
    { name: 'בנק הדרום', sub: 'כספומט בחוץ · אנשים בפנים, אולי', bg: '#17324d', fg: '#fff', poi: 'bank' },
  ] });
  // cash machine on the bank wall
  const ax = b.x1 - 11.2, az = b.cz + 6 + 24;
  if (!B.model(ch, 'p_atm', ax, az, -H, 2.3)) ch.get('gloss').box(ax, CURB, az, 0.9, 1.9, 0.7, 0, { c: rgb('#3a4a66') });
  B.solid(ax, az, 0.5, 0.6, 0, 2.2); setPOI('atm', ax - 1.4, az, { yaw: H });
  // the plaza: tables, palms, a notice wall
  for (let i = 0; i < 4; i++) sitGroup(B, ch, b.x1 - 15, b.cz - 12 + i * 5.5, rng, 'cafe');
  for (let i = 0; i < 3; i++) sitGroup(B, ch, b.cx - 30 + i * 5.2, n + 8.5, rng, 'kiosk');
  for (const [px, pz] of [[b.cx - 14, b.cz + 4], [b.cx + 14, b.cz + 4], [b.cx - 14, b.cz + 24], [b.cx + 14, b.cz + 24]]) {
    ch.get('concrete').cyl(px, CURB, pz, 1.5, 1.5, 0.5, 10, rgb('#bdb9ae'), rgb('#cfcbc0'), true);
    B.solid(px, pz, 1.3, 1.3, 0.78, 0.6); B.palm(ch, px, pz, rng.f(8, 10.5), rng);
    B.bench(ch, px, pz + 2.6, 0); B.bench(ch, px, pz - 2.6, Math.PI);
  }
  posterWall(B, ch, b.cx, b.cz + 14, 0, 5, rng); posterWall(B, ch, b.cx, b.cz + 14, Math.PI, 5, rng);
  B.lot(ch, b.cx, b.z1 - 8.5, b.w - 34, 15, 0, 'center');
  setPOI('taxi', b.cx - 20, b.z1 - 8.5);
  B.dumpster(ch, b.x0 + 13, b.z0 + 13, H); B.dumpster(ch, b.x1 - 13, b.z0 + 13, H);
  B.hang.push({ x: b.cx, z: b.cz + 6, r: 6, kind: 'plaza' });
  setPOI('plaza', b.cx, b.cz + 8);
}

// ---- The shuk --------------------------------------------------------------------
function shuk(B, ch, b, rng) {
  base(B, ch, b, 'paving', 2.6, [0.9, 0.88, 0.84]);
  const goods = [['עגבניות', '4.90', '#d9301f'], ['מלפפונים', '3.90', '#3d8a3a'], ['תפוזים', '5.90', '#f08a1c'], ['אבטיח', '2.90', '#2f7a44'], ['תבלינים', 'לפי משקל', '#b5651d'],
    ['זיתים', '19.90', '#4b5a2a'], ['גרעינים', '12.90', '#2b2b2b'], ['בננות', '6.90', '#f2cf3a'], ['חצילים', '4.50', '#4a235a'], ['דגים', 'טרי מאתמול', '#6b8ea3'], ['לימונים', '5.50', '#f0dc3a'], ['פיצוחים', '14.90', '#8a5a2b']];
  const tarp = ['#b3261e', '#1f6aa5', '#2d8a4e', '#f5b301', '#d9d2bd', '#e8762c'];
  let gi = 0;
  for (let row = 0; row < 4; row++) {
    const z = b.z0 + 16 + row * 21;
    for (let i = 0; i < 7; i++) {
      const x = b.x0 + 14 + i * 11.6;
      for (const s of [-1, 1]) {
        const sz = z + s * 3.1, col = rgb(rng.pick(tarp)), g = goods[gi++ % goods.length];
        for (const cx of [-2.2, 2.2]) for (const cz of [-1.3, 1.3]) ch.get('paint').cyl(x + cx, CURB, sz + cz, 0.04, 0.04, 2.5, 5, rgb('#7b8085'), undefined, false);
        ch.get('cloth').box(x, CURB + 2.5, sz, 4.9, 0.05, 3.1, 0, { c: shade(col, 0.85), cTop: col });
        ch.get('paint').box(x, CURB, sz, 4, 0.8, 1.5, 0, { c: rgb('#8a7458'), cTop: rgb('#a08a68') });
        const gc = rgb(g[2]);
        for (let k = 0; k < 5; k++) ch.get('paint').box(x - 1.6 + k * 0.8, CURB + 0.8, sz, 0.7, 0.22 + rng.f(0.1), 1.2, 0, { c: shade(gc, 0.75), cTop: gc });
        const r = B.sign({ text: g[0], sub: g[1] + ' ₪ לקילו', bg: '#f3efe6', fg: '#b3261e', subFg: '#111', font: '"Heebo"', weight: 900, shadow: false }, 256, 96);
        ch.get('sign').panel(x, sz, s > 0 ? Math.PI : 0, 0, CURB + 1.75, 1.5, 0.56, 0.76, r);
        B.solid(x, sz, 2, 0.8, 0, 1.1);
        if (rng.chance(0.35)) B.crate(ch, x + rng.f(-2.3, 2.3), sz - s * 1.4, rng.f(3), gc);
      }
      B.hang.push({ x, z, r: 1.2, kind: 'shuk' });
    }
  }
  // the fence's stall at the back, and a butcher row
  B.shops(ch, { x: b.cx, z: b.z1 - 5.5, len: b.w - 30, dep: 8, yaw: Math.PI, tint: rgb('#cfc3a5'), units: [
    { name: 'סחורה טובה', sub: 'קונים · מוכרים · לא שואלים', bg: '#16181d', fg: '#c7a23a', poi: 'fence', hang: 'fence' },
    { name: 'אטליז הבשר הטוב', sub: 'כשר למהדרין · בערך', bg: '#7d1711', fg: '#fff' },
    { name: 'ביגוד מהמכולה', sub: 'מותגים* (*דומים למותגים)', bg: '#2a6bff', fg: '#fff' },
    { name: 'צעצועי יוסי', sub: 'סוללות לא כלולות. אף פעם', bg: '#ff7ab6', fg: '#16181d', subFg: '#16181d' },
    { name: 'מחסן', kind: 'roller', bg: '#555b61', fg: '#c9ced2' },
  ] });
  B.dumpster(ch, b.x0 + 6, b.z1 - 16, 0); B.dumpster(ch, b.x1 - 6, b.z1 - 16, 0); B.dumpster(ch, b.x0 + 6, b.z0 + 8, 0);
  setPOI('shuk', b.cx, b.cz);
}

// ---- Parks and courts ----------------------------------------------------------------
function court(B, ch, b, rng, gimel) {
  base(B, ch, b, 'sand');
  const cx = b.cx + 6, cz = b.cz - 8, W = 44, D = 26;
  ch.get('asphalt').floor(cx, CURB + 0.006, cz, W, D, 0, [0, 0, W / 6, D / 6], gimel ? [0.6, 0.6, 0.66] : [0.56, 0.68, 0.62]);
  const DE = ch.get('decal'), wr = B.mats.whiteRect, wh = [0.92, 0.92, 0.9];
  const ln = (x, z, w, d) => DE.floor(x, CURB + 0.02, z, w, d, 0, wr, wh);
  ln(cx, cz - D / 2 + 0.4, W - 0.8, 0.12); ln(cx, cz + D / 2 - 0.4, W - 0.8, 0.12); ln(cx - W / 2 + 0.4, cz, 0.12, D - 0.8); ln(cx + W / 2 - 0.4, cz, 0.12, D - 0.8); ln(cx, cz, 0.12, D - 0.8);
  for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.28; DE.floor(cx + Math.cos(a) * 4, CURB + 0.02, cz + Math.sin(a) * 4, 0.12, 1.3, -a, wr, wh); }
  for (const s of [-1, 1]) {
    const gx = cx + s * (W / 2 - 0.6), P = ch.get('paint'), w = rgb('#e9e7e0');
    P.box(gx, CURB, cz - 1.8, 0.1, 2.1, 0.1, 0, { c: w }); P.box(gx, CURB, cz + 1.8, 0.1, 2.1, 0.1, 0, { c: w }); P.box(gx, CURB + 2.05, cz, 0.1, 0.1, 3.7, 0, { c: w });
    ch.get('fence').panel(gx + s * 0.9, cz, s > 0 ? -H : H, 0, CURB, 3.6, 2.05, 0, [0, 0, 9, 5], [1, 1, 1]);
    B.solid(gx, cz - 1.8, 0.1, 0.1, 0, 2.2); B.solid(gx, cz + 1.8, 0.1, 0.1, 0, 2.2);
    // hoop above the goal
    P.box(gx - s * 0.1, CURB + 2.1, cz, 0.12, 1.2, 0.12, 0, { c: rgb('#6c7880') });
    P.box(gx - s * 0.5, CURB + 3.0, cz, 0.08, 1.0, 1.7, 0, { c: rgb('#f3efe6') });
  }
  // fence on the long sides, with gaps
  B.fence(ch, cx - W / 2 - 1, cz - D / 2 - 1.5, cx + W / 2 + 1, cz - D / 2 - 1.5, 3.6);
  B.fence(ch, cx - W / 2 - 1, cz + D / 2 + 1.5, cx - 6, cz + D / 2 + 1.5, 3.6); B.fence(ch, cx + 6, cz + D / 2 + 1.5, cx + W / 2 + 1, cz + D / 2 + 1.5, 3.6);
  // concrete bleachers
  for (let i = 0; i < 3; i++) { ch.get('concrete').box(cx, CURB, cz - D / 2 - 4 - i * 0.9, 30, 0.45 * (i + 1), 0.9, 0, { c: rgb('#b7b3a8'), s: 2.5 }); }
  B.solid(cx, cz - D / 2 - 4.9, 15, 1.4, 0, 1.3);
  for (let i = 0; i < 5; i++) B.seats.push({ x: cx - 12 + i * 6, z: cz - D / 2 - 3.6, yaw: 0, kind: 'bench' });
  setPOI(gimel ? 'court3' : 'court', cx, cz);
  B.hang.push({ x: cx, z: cz, r: 9, kind: gimel ? 'gimel' : 'court' });
  // playground, shelter, trees
  const px = b.x0 + 17, pz = b.z1 - 18;
  patch(ch, 'grass', px, pz, 26, 22);
  const P = ch.get('paint');
  P.box(px - 4, CURB, pz, 0.12, 2.4, 0.12, 0, { c: rgb('#e5412d') }); P.box(px + 0, CURB, pz, 0.12, 2.4, 0.12, 0, { c: rgb('#e5412d') }); P.box(px - 2, CURB + 2.35, pz, 4.3, 0.12, 0.12, 0, { c: rgb('#e5412d') });
  P.box(px - 3, CURB + 0.5, pz, 0.5, 0.05, 0.25, 0, { c: rgb('#16181d') }); P.box(px - 1, CURB + 0.5, pz, 0.5, 0.05, 0.25, 0, { c: rgb('#16181d') });
  P.box(px + 6, CURB, pz + 2, 2.2, 1.6, 2.2, 0, { c: rgb('#2a6bff'), cTop: rgb('#f5b301') }); P.box(px + 8.3, CURB, pz + 2, 2.6, 0.9, 0.9, 0, { c: rgb('#f5b301'), cTop: rgb('#ffd24a') });
  B.solid(px + 6, pz + 2, 1.1, 1.1, 0, 1.6);
  B.shelter(ch, b.x1 - 12, b.z1 - 12, Math.PI, gimel ? 5 : 3);
  for (let i = 0; i < 9; i++) { const tx = b.x0 + rng.f(6, b.w - 6), tz = rng.chance(0.5) ? b.z1 - rng.f(4, 30) : b.z0 + rng.f(3, 9); if (Math.abs(tx - px) > 15 || Math.abs(tz - pz) > 12) B.tree(ch, tx, tz, rng.f(0.9, 1.5), rng, rng.pick(['ficus', 'euc', 'ficus'])); }
  for (let i = 0; i < 4; i++) B.bench(ch, b.x0 + 34 + i * 12, b.z1 - 6, Math.PI);
  sitGroup(B, ch, b.x1 - 26, b.z1 - 24, rng, gimel ? 'gimel' : 'yard');
  B.dumpster(ch, b.x1 - 5, b.cz, H);
  if (gimel) for (let i = 0; i < 4; i++) B.tag(ch, cx, cz - D / 2 - 6.25, Math.PI, -12 + i * 8, CURB + 0.2, 0.47, rng, true);
}

// ---- School ------------------------------------------------------------------------
function school(B, ch, b, rng) {
  base(B, ch, b, 'sand');
  B.civic(ch, { x: b.cx, z: b.z0 + 14, w: b.w - 24, d: 14, floors: 2, tint: '#e9dfc8', seed: 4, kind: 'school', poi: 'school',
    sign: { text: 'בית ספר יסודי ״תקווה״', sub: 'חינוך · ערכים · מזגן אחד שעובד', bg: '#1f8a8a', fg: '#fff' } });
  patch(ch, 'asphalt', b.cx, b.cz + 16, b.w - 20, 46, 6, [0.78, 0.78, 0.78]);
  for (const s of [-1, 1]) { const x = b.cx + s * 24; ch.get('paint').box(x, CURB, b.cz + 16, 0.14, 3.0, 0.14, 0, { c: rgb('#6c7880') }); ch.get('paint').box(x - s * 0.5, CURB + 2.6, b.cz + 16, 0.08, 1.0, 1.7, 0, { c: rgb('#f3efe6') }); B.solid(x, b.cz + 16, 0.12, 0.12, 0, 3); }
  const m = 4;
  B.fence(ch, b.x0 + m, b.z1 - m, b.cx - 5, b.z1 - m, 2.4); B.fence(ch, b.cx + 5, b.z1 - m, b.x1 - m, b.z1 - m, 2.4);
  B.fence(ch, b.x0 + m, b.z0 + 24, b.x0 + m, b.z1 - m, 2.4); B.fence(ch, b.x1 - m, b.z0 + 24, b.x1 - m, b.z1 - m, 2.4);
  for (let i = 0; i < 6; i++) B.tree(ch, b.x0 + 9 + i * 16, b.z1 - 9, rng.f(1, 1.4), rng, 'ficus');
  B.shelter(ch, b.x0 + 12, b.cz + 34, 0, 1);
}

// ---- Industrial --------------------------------------------------------------------
function industrial(B, ch, b, rng) {
  base(B, ch, b, 'asphalt', 6, [0.74, 0.73, 0.7]);
  const west = b.c === 2;
  if (west) {
    B.hangar(ch, { x: b.x0 + 24, z: b.z0 + 20, w: 36, d: 24, yaw: 0, tint: '#8fa3b0', doors: 3, poi: 'garage',
      sign: { text: 'מוסך חכם ובניו', sub: 'פחחות · צבע · חלפים ״משומשים״', bg: '#16181d', fg: '#f5b301' } });
    B.hangar(ch, { x: b.x1 - 22, z: b.z0 + 18, w: 30, d: 20, yaw: 0, tint: '#b9a98a', doors: 2,
      sign: { text: 'פנצ׳רייה אבי', sub: 'תיקון תקרים · תקרים חדשים', bg: '#b3261e', fg: '#fff' } });
    B.hangar(ch, { x: b.cx, z: b.z1 - 20, w: 60, d: 22, yaw: Math.PI, tint: '#9aa7a0', doors: 4, poi: 'scrap',
      sign: { text: 'מתכות הנגב', sub: 'קונים ברזל · נחושת · לא שואלים מאיפה', bg: '#3d5f9e', fg: '#fff' } });
    // tyre stacks and wrecks in the yard
    for (let i = 0; i < 9; i++) { const x = b.x0 + rng.f(8, b.w - 8), z = b.cz + rng.f(-8, 8), n = rng.i(2, 5); for (let k = 0; k < n; k++) ch.get('paint').cyl(x, CURB + k * 0.24, z, 0.36, 0.36, 0.22, 9, rgb('#17181a'), rgb('#232528'), true); B.solid(x, z, 0.36, 0.36, 0, n * 0.24); }
    for (let i = 0; i < 4; i++) B.parking.push({ x: b.x0 + 12 + i * 4, z: b.z0 + 37, yaw: 0, kind: 'wreck' });
    setPOI('garageIn', b.x0 + 24, b.z0 + 36, { yaw: Math.PI });
  } else {
    B.hangar(ch, { x: b.x0 + 26, z: b.z0 + 22, w: 40, d: 28, yaw: 0, tint: '#c2b596', doors: 3, poi: 'depot',
      sign: { text: 'שיווק והפצה דרום', sub: 'סיגריות · שתייה · חטיפים', bg: '#17324d', fg: '#fff' } });
    B.hangar(ch, { x: b.x1 - 24, z: b.cz + 4, w: 30, d: 44, yaw: -H, tint: '#a3aab0', doors: 3,
      sign: { text: 'נגריית המלך', sub: 'מטבחים · ארונות · הבטחות', bg: '#7c4a1e', fg: '#ffe7b0' } });
    B.hangar(ch, { x: b.x0 + 30, z: b.z1 - 18, w: 46, d: 20, yaw: Math.PI, tint: '#8b9bab', doors: 3,
      sign: { text: 'קירור השרון', sub: 'מזגנים · מקררים · תירוצים', bg: '#2a6bff', fg: '#fff' } });
    for (let i = 0; i < 3; i++) B.parking.push({ x: b.x0 + 14 + i * 7, z: b.z0 + 42, yaw: 0, kind: 'truck' });
    // shipping containers
    const cc = ['#b3261e', '#1f6aa5', '#2d8a4e', '#c7a23a'];
    for (let i = 0; i < 5; i++) { const x = b.cx - 6 + (i % 3) * 3.2, z = b.cz - 4 + Math.floor(i / 3) * 0; const c = rgb(cc[i % 4]); ch.get('metal').box(x, CURB + Math.floor(i / 3) * 2.6, z + 12, 2.5, 2.6, 6.1, 0, { c: shade(c, 0.7), cTop: c, s: 1.2 }); }
    B.solid(b.cx - 2.8, b.cz + 8, 4.5, 3.1, 0, 5.2);
  }
  const m = 3;
  B.fence(ch, b.x0 + m, b.z0 + m, b.cx - 6, b.z0 + m, 2.6); B.fence(ch, b.cx + 6, b.z0 + m, b.x1 - m, b.z0 + m, 2.6);
  B.fence(ch, b.x0 + m, b.z1 - m, b.cx - 6, b.z1 - m, 2.6); B.fence(ch, b.cx + 6, b.z1 - m, b.x1 - m, b.z1 - m, 2.6);
  B.dumpster(ch, b.x0 + 8, b.cz - 2, H); B.dumpster(ch, b.x1 - 8, b.z1 - 36, H);
  B.hang.push({ x: b.cx, z: b.cz, r: 5, kind: 'work' });
}

// ---- Petrol station at the junction to the moshav -----------------------------------------
function gas(B, ch, b, rng) {
  base(B, ch, b, 'asphalt', 6, [0.8, 0.8, 0.78]);
  const cx = b.cx - 8, cz = b.cz - 14;
  const P = ch.get('paint');
  for (const sx of [-9, 9]) for (const sz of [-5, 5]) { P.box(cx + sx, CURB, cz + sz, 0.5, 5.2, 0.5, 0, { c: rgb('#e9e7e0') }); B.solid(cx + sx, cz + sz, 0.3, 0.3, 0, 5); }
  P.box(cx, CURB + 5.2, cz, 24, 0.9, 14, 0, { c: rgb('#f3efe6'), cTop: rgb('#fdfdfd') });
  const band = B.sign({ text: 'דלק נגב', sub: 'מתדלקים · מתלוננים על המחיר · חוזרים', bg: '#e8762c', fg: '#fff' }, 640, 80);
  for (const [yaw, o] of [[0, 7.02], [Math.PI, 7.02]]) ch.get('sign').panel(cx, cz, yaw, 0, CURB + 5.28, 20, 0.74, o, band);
  ch.get('glow').floor(cx, CURB + 0.03, cz, 30, 20, 0, [0, 0, 1, 1], [0.85, 0.9, 1]);
  for (const sx of [-5, 5]) for (const sz of [-3.2, 3.2]) { ch.get('gloss').box(cx + sx, CURB + 0.15, cz + sz, 0.9, 1.6, 0.5, 0, { c: rgb('#e8762c'), cTop: rgb('#f3efe6') }); P.box(cx + sx, CURB, cz + sz, 2.6, 0.15, 1.1, 0, { c: rgb('#cfcbc0') }); B.solid(cx + sx, cz + sz, 0.6, 0.4, 0, 1.8); }
  B.shops(ch, { x: b.cx - 8, z: b.z1 - 16, len: 30, dep: 9, yaw: Math.PI, tint: rgb('#ecebe4'), units: [
    { name: 'נוחות 24', sub: 'קפה · סנדוויץ׳ עצוב · כספומט', bg: '#e8762c', fg: '#fff', poi: 'gas', hang: 'kiosk' },
    { name: 'שטיפת רכב', sub: 'פנים + חוץ · ואקום רגשי', bg: '#2a6bff', fg: '#fff' },
  ] });
  if (!B.model(ch, 'p_atm', b.cx + 9.6, b.z1 - 21.6, Math.PI, 2.3)) ch.get('gloss').box(b.cx + 9.6, CURB, b.z1 - 21.6, 0.9, 1.9, 0.7, 0, { c: rgb('#3a4a66') });
  B.solid(b.cx + 9.6, b.z1 - 21.6, 0.6, 0.5, 0, 2.2); setPOI('atmGas', b.cx + 9.6, b.z1 - 23.2, { yaw: 0 });
  // price totem
  P.box(b.x1 - 8, CURB, b.z0 + 8, 0.5, 9, 0.5, 0, { c: rgb('#6c7880') });
  const pr = B.sign({ text: '95 · 7.89 ₪', sub: 'שירות מלא: חיוך בתוספת תשלום', bg: '#16181d', fg: '#f5b301', font: '"Heebo"', weight: 900 }, 256, 128);
  ch.get('sign').panel(b.x1 - 8, b.z0 + 8, -H, 0, CURB + 5.5, 4.4, 2.2, 0.3, pr); ch.get('sign').panel(b.x1 - 8, b.z0 + 8, H, 0, CURB + 5.5, 4.4, 2.2, 0.3, pr);
  B.lot(ch, b.x1 - 14, b.cz + 10, 16, 15, H, 'gas');
  for (let i = 0; i < 4; i++) B.palm(ch, b.x0 + 6, b.z0 + 10 + i * 12, rng.f(7, 10), rng);
  B.dumpster(ch, b.x0 + 8, b.z1 - 8, 0);
}

// ---- Wedding hall -------------------------------------------------------------------
function wedding(B, ch, b, rng) {
  base(B, ch, b, 'asphalt', 6, [0.8, 0.8, 0.8]);
  const x = b.cx + 10, z = b.cz - 12, w = 52, d = 34;
  B.civic(ch, { x, z, w, d, floors: 2, yaw: Math.PI, tint: '#f1ead8', seed: 7, kind: 'wedding', win: 'open', lit: 0.9, poi: 'wedding', signW: 14,
    sign: { text: 'אולמי ורסאי', sub: 'אירועים · כנסים · מנה שנייה בתוספת תשלום', bg: '#16181d', fg: '#e0b84a', font: '"Suez One"' } });
  // a portico that tries very hard
  const gold = rgb('#d2ab45'), white = rgb('#f3efe6');
  for (let i = -3; i <= 3; i++) { const cx = x + i * 4.2, cz = z + d / 2 + 4; ch.get('paint').cyl(cx, CURB, cz, 0.42, 0.34, 6.2, 10, shade(white, 0.85), white, false); ch.get('paint').box(cx, CURB + 6.2, cz, 1.1, 0.3, 1.1, 0, { c: gold }); ch.get('paint').box(cx, CURB, cz, 1.0, 0.3, 1.0, 0, { c: gold }); B.solid(cx, cz, 0.4, 0.4, 0, 6); }
  ch.get('paint').box(x, CURB + 6.5, z + d / 2 + 2.6, 28, 0.7, 5.6, 0, { c: white, cTop: rgb('#fdfdfd') });
  ch.get('paint').box(x, CURB + 7.2, z + d / 2 + 2.6, 29, 0.25, 6, 0, { c: gold });
  ch.get('decal').floor(x, CURB + 0.02, z + d / 2 + 8, 4, 16, 0, B.mats.whiteRect, [0.62, 0.05, 0.08]);        // red carpet
  ch.get('glow').floor(x, CURB + 0.04, z + d / 2 + 6, 34, 18, 0, [0, 0, 1, 1], [1, 0.8, 0.45]);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) B.palm(ch, x + s * (17 + i * 6), z + d / 2 + 9, rng.f(6, 8), rng);
  setPOI('weddingBack', x - w / 2 - 2.5, z - 6, { yaw: -H });
  ch.get('win').panel(x, z, -H, 6, CURB, 1.4, 2.3, w / 2 + 0.02, WIN.roller);
  B.lot(ch, b.cx - 6, b.z1 - 12, b.w - 30, 16, 0, 'wedding');
  B.lot(ch, b.x0 + 12, b.cz - 10, 16, 40, H, 'wedding');
  B.dumpster(ch, x - w / 2 - 3, z - 12, H); B.dumpster(ch, x - w / 2 - 3, z - 15, H);
  B.hang.push({ x, z: z + d / 2 + 10, r: 5, kind: 'wedding' });
}

// ---- Government corner: police, national insurance, town hall ---------------------------------
function civic(B, ch, b, rng) {
  base(B, ch, b, 'paving', 2.6);
  B.civic(ch, { x: b.x0 + 26, z: b.z0 + 16, w: 40, d: 18, floors: 3, tint: '#dfe6ee', seed: 3, kind: 'police', poi: 'police', win: 'bars',
    sign: { text: 'משטרת קריית שמש', sub: 'מוקד 100 · נא להמתין על הקו', bg: '#17324d', fg: '#fff' } });
  ch.get('paint').box(b.x0 + 26, CURB + 10.5, b.z0 + 16, 0.12, 6, 0.12, 0, { c: rgb('#c9ced2') });
  B.lot(ch, b.x0 + 26, b.z0 + 37, 36, 14, 0, 'police');
  B.fence(ch, b.x0 + 4, b.z0 + 46, b.x0 + 20, b.z0 + 46, 2.2); B.fence(ch, b.x0 + 32, b.z0 + 46, b.x0 + 48, b.z0 + 46, 2.2);
  B.civic(ch, { x: b.x1 - 22, z: b.z0 + 18, w: 34, d: 20, floors: 3, yaw: 0, tint: '#d9d2bd', seed: 5, kind: 'civic', poi: 'bituach',
    sign: { text: 'הביטוח הלאומי', sub: 'סניף זמני (מאז 1987) · קחו מספר', bg: '#1b3fa0', fg: '#fff' } });
  // the queue that never moves
  const qx = b.x1 - 22, qz = b.z0 + 31;
  for (let i = 0; i < 4; i++) { ch.get('paint').box(qx - 6 + i * 4, CURB + 0.9, qz + 2, 0.06, 0.06, 5, 0, { c: rgb('#8d939a') }); for (const e of [-2.5, 2.5]) ch.get('paint').cyl(qx - 6 + i * 4, CURB, qz + 2 + e, 0.04, 0.04, 0.95, 5, rgb('#8d939a'), undefined, false); }
  for (let i = 0; i < 7; i++) B.hang.push({ x: qx - 4 + (i % 3) * 4, z: qz + i * 0.7, r: 0.5, kind: 'queue', yaw: Math.PI });
  B.civic(ch, { x: b.cx, z: b.z1 - 18, w: 60, d: 20, floors: 3, yaw: Math.PI, tint: '#ecebe4', seed: 6, kind: 'civic', poi: 'city',
    sign: { text: 'עיריית קריית שמש', sub: 'עיר עם עתיד (בקרוב)', bg: '#0f6b5c', fg: '#fff' } });
  for (let i = 0; i < 5; i++) B.palm(ch, b.x0 + 12 + i * 19, b.cz + 8, rng.f(8, 11), rng);
  for (let i = 0; i < 4; i++) B.bench(ch, b.x0 + 21 + i * 19, b.cz + 8, 0);
  posterWall(B, ch, b.x1 - 8, b.cz + 6, -H, 4, rng);
  B.dumpster(ch, b.x1 - 6, b.z1 - 34, H);
}

// ---- Construction site (pinui-binui) ---------------------------------------------------
function site(B, ch, b, rng) {
  base(B, ch, b, 'sand', 5, [0.88, 0.84, 0.78]);
  const m = 3, CO = ch.get('concrete'), P = ch.get('paint');
  B.fence(ch, b.x0 + m, b.z0 + m, b.x1 - m, b.z0 + m, 2.6); B.fence(ch, b.x1 - m, b.z0 + m, b.x1 - m, b.z1 - m, 2.6);
  B.fence(ch, b.x0 + m, b.z1 - m, b.x1 - m, b.z1 - m, 2.6); B.fence(ch, b.x0 + m, b.z0 + m, b.x0 + m, b.cz - 5, 2.6); B.fence(ch, b.x0 + m, b.cz + 5, b.x0 + m, b.z1 - m, 2.6);
  setPOI('site', b.x0 - 1, b.cz, { yaw: H });
  // the skeleton of a tower
  const tx = b.cx + 8, tz = b.cz - 6, tw = 34, td = 24, floors = 7, grey = rgb('#b3afa4');
  for (let f = 0; f <= floors; f++) {
    CO.box(tx, CURB + f * 3.4, tz, tw, 0.3, td, 0, { c: shade(grey, 0.85), cTop: grey, s: 3 });
    if (f < floors) for (let i = 0; i <= 4; i++) for (let j = 0; j <= 3; j++) {
      const cx = tx - tw / 2 + 0.5 + (i * (tw - 1)) / 4, cz = tz - td / 2 + 0.5 + (j * (td - 1)) / 3;
      CO.box(cx, CURB + f * 3.4 + 0.3, cz, 0.6, 3.1, 0.6, 0, { c: grey, s: 2, skip: 'Yy' });
      if (f === 0) B.solid(cx, cz, 0.32, 0.32, 0, 3.4);
    }
  }
  B.solid(tx, tz, tw / 2, td / 2, 0, 40, 3.4); B.foot(tx, tz, tw / 2, td / 2, 0, 'site');
  // crane
  const kx = b.x1 - 16, kz = b.z1 - 18, yel = rgb('#e8b21e');
  P.box(kx, CURB, kz, 1.4, 44, 1.4, 0, { c: shade(yel, 0.8), cTop: yel }); P.box(kx + 10, CURB + 44, kz, 46, 1.1, 1.1, 0, { c: yel }); P.box(kx - 9, CURB + 42.6, kz, 4, 2.4, 2.2, 0, { c: rgb('#8d8f8c') });
  P.box(kx + 22, CURB + 30, kz, 0.06, 14, 0.06, 0, { c: rgb('#222') });
  B.solid(kx, kz, 0.8, 0.8, 0, 44);
  // sand heaps, pallets, site cabins
  for (let i = 0; i < 5; i++) { const x = b.x0 + rng.f(10, 30), z = b.z0 + rng.f(8, b.d - 8), r = rng.f(2.5, 4.5); ch.get('sand').cyl(x, CURB, z, r, 0.2, r * 0.55, 9, [0.9, 0.86, 0.78], [1, 0.97, 0.9], true); B.solid(x, z, r * 0.6, r * 0.6, 0, 1.2); }
  const cab = rgb('#e9e7e0');
  for (let i = 0; i < 2; i++) { ch.get('metal').box(b.x0 + 12, CURB + i * 2.6, b.z0 + 10, 6, 2.6, 2.5, 0, { c: shade(cab, 0.85), cTop: cab, s: 1.5 }); }
  B.solid(b.x0 + 12, b.z0 + 10, 3, 1.25, 0, 5.2);
  ch.get('win').panel(b.x0 + 12, b.z0 + 10, 0, -1.6, CURB + 0.9, 1.4, 1.1, 1.26, WIN.open);
  setPOI('siteOffice', b.x0 + 12, b.z0 + 13.2, { yaw: 0 });
  setPOI('siteTop', tx - tw / 2 - 3, tz);
  // the developer's promise, facing the street
  const bill = B.sign({ text: 'מגדלי שמש פרימיום', sub: 'פינוי־בינוי · 31 קומות של יוקרה · במקום הבלוקים', bg: '#17324d', bg2: '#0c1b2b', fg: '#e0b84a', font: '"Suez One"' }, 768, 192);
  P.box(b.x0 + 2.2, CURB, b.cz - 22, 0.3, 7.5, 0.3, 0, { c: rgb('#6c7880') }); P.box(b.x0 + 2.2, CURB, b.cz - 10, 0.3, 7.5, 0.3, 0, { c: rgb('#6c7880') });
  ch.get('sign').panel(b.x0 + 2.2, b.cz - 16, -H, 0, CURB + 3.6, 14, 3.5, 0.2, bill);
  ch.get('paint').box(b.x0 + 2.3, CURB + 3.5, b.cz - 16, 0.12, 3.7, 14.2, 0, { c: rgb('#23262b') });
  B.parking.push({ x: b.x0 + 26, z: b.z1 - 12, yaw: H, kind: 'tractor' });
  B.hang.push({ x: b.x0 + 16, z: b.z0 + 16, r: 3, kind: 'work' });
}

// ---- New luxury towers --------------------------------------------------------------------
function towers(B, ch, b, rng) {
  base(B, ch, b, 'grass', 5, [0.72, 0.9, 0.62]);
  const glass = rgb('#dfe7ea');
  for (const [tx, tz] of [[b.cx - 20, b.cz - 14], [b.cx + 22, b.cz + 12]]) {
    const w = 22, d = 22, fl = 14, Ht = fl * 3.1;
    ch.get('plaster').box(tx, CURB, tz, w, Ht, d, 0, { c: shade(glass, 0.9), cTop: [1, 1, 1], s: 4, skip: 'y' });
    for (let f = 0; f < fl; f++) for (let s = 0; s < 4; s++) for (let k = -2; k <= 2; k++) {
      ch.get(rng.chance(0.5) ? 'winLit' : 'win').panel(tx, tz, s * H, k * 4.1, CURB + f * 3.1 + 0.5, 3.5, 2.3, w / 2 + 0.02, WIN.open);
      if (k % 2 === 0) { const [bx, bz] = B.at(tx, tz, s * H, k * 4.1, w / 2 + 0.7); ch.get('gloss').box(bx, CURB + f * 3.1 + 0.3, bz, 3.7, 1.0, 1.4, s * H, { c: rgb('#8fb4c2'), cTop: rgb('#cfe3ea') }); }
    }
    B.solid(tx, tz, w / 2 + 0.7, d / 2 + 0.7, 0, Ht + 2); B.foot(tx, tz, w / 2, d / 2, 0, 'tower');
  }
  const m = 3;
  B.wall(ch, b.x0 + m, b.z0 + m, b.x1 - m, b.z0 + m, 1.9, 0.25, rgb('#f3efe6')); B.wall(ch, b.x1 - m, b.z0 + m, b.x1 - m, b.z1 - m, 1.9, 0.25, rgb('#f3efe6'));
  B.wall(ch, b.x0 + m, b.z1 - m, b.x1 - m, b.z1 - m, 1.9, 0.25, rgb('#f3efe6')); B.wall(ch, b.x0 + m, b.z0 + m, b.x0 + m, b.cz - 5, 1.9, 0.25, rgb('#f3efe6')); B.wall(ch, b.x0 + m, b.cz + 5, b.x0 + m, b.z1 - m, 1.9, 0.25, rgb('#f3efe6'));
  ch.get('paint').box(b.x0 + 6, CURB, b.cz - 7.5, 2.6, 2.6, 2.6, 0, { c: rgb('#f3efe6'), cTop: rgb('#17324d') }); B.solid(b.x0 + 6, b.cz - 7.5, 1.3, 1.3, 0, 2.6);
  const r = B.sign({ text: 'נווה יוקרה', sub: 'קהילה סגורה · הכניסה לדיירים (ולשליחים)', bg: '#17324d', fg: '#e0b84a', font: '"Suez One"' }, 512, 128);
  ch.get('sign').panel(b.x0 + m, b.cz - 12, -H, 0, CURB + 0.5, 5, 1.25, 0.14, r);
  setPOI('towers', b.x0 - 1, b.cz, { yaw: H });
  patch(ch, 'paving', b.cx, b.cz, b.w - 12, 7, 2.6);
  B.lot(ch, b.cx + 6, b.z1 - 12, 50, 15, 0, 'lux');
  for (let i = 0; i < 10; i++) B.palm(ch, b.x0 + 10 + i * 9.4, b.cz + (i % 2 ? 5.5 : -5.5), rng.f(7, 9), rng);
}

// ---- Bus station and community centre -----------------------------------------------------
function station(B, ch, b, rng) {
  base(B, ch, b, 'asphalt', 6, [0.78, 0.78, 0.76]);
  const P = ch.get('paint');
  // platforms with canopies
  for (let i = 0; i < 4; i++) {
    const x = b.x0 + 16 + i * 13, z = b.z0 + 24;
    ch.get('paving').box(x, CURB - 0.002, z, 4, 0.14, 26, 0, { c: rgb('#d2cfc5'), s: 2.6 });
    for (const zz of [-10, 0, 10]) { P.cyl(x, CURB + 0.14, z + zz, 0.09, 0.09, 3.3, 6, rgb('#3c6b54'), undefined, false); B.solid(x, z + zz, 0.12, 0.12, 0, 3.3); }
    ch.get('metal').box(x, CURB + 3.4, z, 5.4, 0.12, 27, 0, { c: rgb('#3c6b54'), cTop: rgb('#4f8a6d'), s: 1.5 });
    const r = B.sign({ text: ['רציף 1 · באר שבע', 'רציף 2 · תל אביב', 'רציף 3 · דימונה', 'רציף 4 · אין קו'][i], bg: '#16181d', fg: '#f5b301', font: '"Heebo"', weight: 700 }, 384, 64);
    ch.get('sign').panel(x, z - 13, Math.PI, 0, CURB + 2.7, 3.6, 0.6, 0.1, r); ch.get('sign').panel(x, z - 13, 0, 0, CURB + 2.7, 3.6, 0.6, 26.1, r);
    B.bench(ch, x, z - 5, H); B.bench(ch, x, z + 5, -H);
    B.hang.push({ x: x + 1, z: z + rng.f(-8, 8), r: 1.5, kind: 'bus' });
    B.parking.push({ x: x + 5.6, z: z, yaw: 0, kind: 'bus' });
  }
  setPOI('busArrive', b.x0 + 16 + 2, b.z0 + 20);
  B.shops(ch, { x: b.x0 + 34, z: b.z0 + 5.5, len: 52, dep: 8, yaw: 0, tint: rgb('#d3d0c7'), units: [
    { name: 'קופות', sub: 'סגור. תמיד היה סגור', kind: 'roller', bg: '#3c6b54', fg: '#fff' },
    { name: 'קיוסק התחנה', sub: 'בגט · שתייה · מטען ב־40₪', bg: '#e8762c', fg: '#fff', hang: 'kiosk' },
    { name: 'אבידות ומציאות', sub: 'בעיקר אבידות', bg: '#555b61', fg: '#fff' },
  ] });
  // community centre
  B.civic(ch, { x: b.x1 - 24, z: b.z1 - 22, w: 38, d: 26, floors: 2, yaw: Math.PI, tint: '#e2c6b6', seed: 8, kind: 'civic', poi: 'matnas',
    sign: { text: 'מתנ״ס שכונה ד׳', sub: 'חוגים · קשישים · ג׳ודו בימי שלישי', bg: '#6b2bb8', fg: '#fff' } });
  patch(ch, 'paving', b.x1 - 24, b.z1 - 44, 40, 14, 2.6);
  for (let i = 0; i < 3; i++) B.bench(ch, b.x1 - 36 + i * 12, b.z1 - 40, 0);
  for (let i = 0; i < 4; i++) B.tree(ch, b.x1 - 40 + i * 11, b.z1 - 48, rng.f(1, 1.4), rng, 'ficus');
  B.lot(ch, b.x0 + 26, b.z1 - 12, 44, 15, 0, 'res');
  B.dumpster(ch, b.x1 - 6, b.z0 + 10, H); B.dumpster(ch, b.x0 + 6, b.z1 - 28, H);
  posterWall(B, ch, b.x0 + 66, b.z0 + 30, -H, 4, rng);
}

export function fillZone(B, ch, b, rng) {
  switch (b.zone) {
    case 'gimel': return residential(B, ch, b, rng, { gimel: true });
    case 'home': return residential(B, ch, b, rng, { home: true, alongX: true });
    case 'shikun': return residential(B, ch, b, rng, {});
    case 'center': return center(B, ch, b, rng);
    case 'shuk': return shuk(B, ch, b, rng);
    case 'park': return court(B, ch, b, rng, false);
    case 'court3': return court(B, ch, b, rng, true);
    case 'school': return school(B, ch, b, rng);
    case 'industrial': return industrial(B, ch, b, rng);
    case 'gas': return gas(B, ch, b, rng);
    case 'wedding': return wedding(B, ch, b, rng);
    case 'civic': return civic(B, ch, b, rng);
    case 'site': return site(B, ch, b, rng);
    case 'towers': return towers(B, ch, b, rng);
    case 'station': return station(B, ch, b, rng);
    default: return base(B, ch, b, 'sand');
  }
}

// ---- Outside the grid: the moshav road, the orchard, the highway south, the desert rim ------------
export function buildOutskirts(B) {
  const ch = B.chunk('out'), rng = new Rng(555);
  const E = XS[5] + 9, N = ZS[0];
  // avocado orchard north of the moshav road
  const ox0 = 380, ox1 = 560, oz0 = N - 110, oz1 = N - 14;
  ch.get('sand').floor((ox0 + ox1) / 2, 0.005, (oz0 + oz1) / 2, ox1 - ox0, oz1 - oz0, 0, [0, 0, 30, 16], [0.7, 0.62, 0.5]);
  for (let x = ox0 + 6; x < ox1 - 4; x += 9) for (let z = oz0 + 6; z < oz1 - 22; z += 8) {
    if (rng.chance(0.06)) continue;
    const s = rng.f(0.85, 1.1), m = B.constructor.blob();
    ch.get('paint').cyl(x, 0, z, 0.16, 0.12, 1.4, 5, rgb('#4a3b2c'), undefined, false);
    B._m.makeScale(2.2 * s, 1.7 * s, 2.2 * s).setPosition(x, 2.4 * s, z);
    ch.get('leaf').add(m, B._m, shade(rgb('#3f6a34'), rng.f(0.8, 1.1)));
    B.solid(x, z, 0.3, 0.3, 0, 2);
  }
  B.fence(ch, ox0, oz1, ox0 + 70, oz1, 2); B.fence(ch, ox0 + 82, oz1, ox1, oz1, 2); B.fence(ch, ox0, oz0, ox0, oz1, 2);
  B.hangar(ch, { x: ox0 + 106, z: oz1 - 12, w: 30, d: 16, yaw: 0, tint: '#c2b596', doors: 2, poi: 'moshav',
    sign: { text: 'בית אריזה · מושב תלמים', sub: 'אבוקדו · הדרים · שמירה 24 שעות (בתיאוריה)', bg: '#3d6b2f', fg: '#fff' } });
  B.parking.push({ x: ox0 + 76, z: oz1 - 8, yaw: Math.PI, kind: 'truckMoshav' });
  setPOI('orchard', ox0 + 76, oz1 + 4);
  for (let i = 0; i < 9; i++) { const c = rgb(rng.pick(['#3aa35b', '#2d8a4e', '#49b06a'])); B.crate(ch, ox0 + 92 + (i % 3) * 0.9, oz1 - 2 - Math.floor(i / 3) * 0.6, 0, c, 0.45); }
  // roadside
  for (let x = E + 20; x < 580; x += 40) { B.lamp(ch, x, N + 5.4, Math.PI, true, 8); if (rng.chance(0.5)) B.tree(ch, x + 12, N + 10 + rng.f(8), rng.f(1, 1.6), rng, 'euc'); }
  const S = ZS[5];
  for (let z = S + 24; z < 580; z += 36) { B.lamp(ch, XS[3] - 9.4, z, H, false, 10); B.lamp(ch, XS[3] + 9.4, z, -H, false, 10); }
  const wel = B.sign({ text: 'קריית שמש', sub: 'מברכת את הבאים בשעריה · עיר עם עתיד (בקרוב)', bg: '#0f6b5c', bg2: '#0a4a40', fg: '#fff', font: '"Suez One"' }, 768, 192);
  for (const s of [-1, 1]) ch.get('paint').box(XS[3] + 16 + s * 6, 0, S + 60, 0.35, 8, 0.35, 0, { c: rgb('#6c7880') });
  ch.get('sign').panel(XS[3] + 16, S + 60, 0, 0, 4, 13, 3.3, 0.2, wel); ch.get('sign').panel(XS[3] + 16, S + 60, Math.PI, 0, 4, 13, 3.3, 0.2, B.poster ? B.sign({ text: 'להתראות', sub: 'תחזרו. לאן כבר תלכו?', bg: '#0f6b5c', fg: '#fff', font: '"Suez One"' }, 768, 192) : wel);
  setPOI('exitSouth', XS[3] + 4, S + 190); setPOI('exitEast', 560, N + 2.4);
  setPOI('ambush', XS[3] - 4.2, S + 120);
  // scattered desert scrub and rocks
  for (let i = 0; i < 260; i++) {
    const a = rng.f(6.283), r = rng.f(420, WORLD_HALF + 120), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 340 && Math.abs(z) < 330) continue;
    if (x > ox0 - 10 && x < ox1 + 10 && z > oz0 - 10 && z < oz1 + 20) continue;
    if (Math.abs(z - N) < 12 && x > 300) continue; if (Math.abs(x - XS[3]) < 16 && z > 300) continue;
    if (rng.chance(0.55)) { B._m.makeScale(rng.f(0.7, 1.6), rng.f(0.35, 0.7), rng.f(0.7, 1.6)).setPosition(x, 0.1, z); ch.get('leaf').add(B.constructor.blob(), B._m, shade(rgb('#8f8a5a'), rng.f(0.7, 1.1))); }
    else { B._m.makeScale(rng.f(0.6, 2.4), rng.f(0.4, 1.1), rng.f(0.6, 2)).setPosition(x, 0, z); ch.get('concrete').add(B.constructor.blob(), B._m, shade(rgb('#c9b594'), rng.f(0.8, 1.05))); }
  }
  // the rim of hills that closes the horizon
  const hills = ch.get('sand'), seg = 72, R0 = WORLD_HALF + 160;
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * 6.283, a1 = ((i + 1) / seg) * 6.283, R = R0 + ring * 240;
    const h0 = 26 + ring * 40 + Math.sin(a0 * 5 + ring) * 12 + Math.sin(a0 * 13) * 6, h1 = 26 + ring * 40 + Math.sin(a1 * 5 + ring) * 12 + Math.sin(a1 * 13) * 6;
    const c = ring ? [0.78, 0.72, 0.62] : [0.86, 0.8, 0.68];
    hills.quad([Math.cos(a1) * (R - 170), -1, Math.sin(a1) * (R - 170)], [Math.cos(a0) * (R - 170), -1, Math.sin(a0) * (R - 170)], [Math.cos(a0) * R, h0, Math.sin(a0) * R], [Math.cos(a1) * R, h1, Math.sin(a1) * R], [i / 3, 0, (i + 1) / 3, 6], c, shade(c, 1.06));
    hills.quad([Math.cos(a1) * R, h1, Math.sin(a1) * R], [Math.cos(a0) * R, h0, Math.sin(a0) * R], [Math.cos(a0) * (R + 200), -2, Math.sin(a0) * (R + 200)], [Math.cos(a1) * (R + 200), -2, Math.sin(a1) * (R + 200)], [i / 3, 0, (i + 1) / 3, 6], shade(c, 1.06), c);
  }
  B.addChunk(ch);
}
