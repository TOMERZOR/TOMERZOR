// Sanity checks on js/levels.js: fields, numbers, ids, ropes, ball budgets.
import { LEVELS, DAILY } from '../js/levels.js';
const problems = [];
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const check = (lv, where) => {
  for (const k of ['id', 'world', 'par', 'balls', 'proof', 'objects']) if (lv[k] === undefined) problems.push(`${where} missing ${k}`);
  if (!(lv.balls > lv.par - 1)) problems.push(`${where} balls ${lv.balls} < par ${lv.par}`);
  if (!Array.isArray(lv.proof) || lv.proof.length !== lv.par || !lv.proof.every(num)) problems.push(`${where} bad proof ${JSON.stringify(lv.proof)}`);
  if (!lv.objects.some((o) => o.t === 'glass')) problems.push(`${where} has no glass`);
  lv.objects.forEach((o, i) => {
    for (const k of ['x', 'y']) if (o.t !== 'rope' || o.from == null) if (!num(o[k])) problems.push(`${where} object ${i} bad ${k}`);
    if (o.t === 'rope') {
      const tgt = lv.objects[o.to];
      if (!tgt || tgt.t !== 'glass') problems.push(`${where} rope ${i} points at ${tgt?.t}`);
      if (o.from != null && lv.objects[o.from]?.t !== 'glass') problems.push(`${where} rope ${i} hangs from ${lv.objects[o.from]?.t}`);
    }
  });
};
LEVELS.forEach((l, i) => check(l, l.id));
DAILY.forEach((l, i) => check(l, l.id));
const ids = new Set(LEVELS.map((l) => l.id));
if (ids.size !== LEVELS.length) problems.push('duplicate campaign ids');
for (let w = 0; w < 5; w++) for (let k = 1; k <= 24; k++) if (!ids.has(`w${w}-${k}`)) problems.push(`missing w${w}-${k}`);
console.log(`${LEVELS.length} campaign + ${DAILY.length} daily: ${problems.length ? problems.length + ' problems\n' + problems.slice(0, 20).join('\n') : 'all checks pass'}`);
