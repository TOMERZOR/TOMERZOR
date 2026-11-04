// Automatic closing schedule. Fills each site up to the number of soldiers it needs each day, from
// the soldiers who are free that day, and never touches what the commander entered by hand.
//
// Who gets a slot, in order of weight:
//   - a soldier with a constraint that day is used only when there's nobody else
//   - nobody closes more than rules.maxStreak days in a row, or starts again before rules.minRest
//     days at home (both bend only when the site would otherwise stay short)
//   - a soldier already closing at that site keeps going (closings come in blocks, not single days)
//   - otherwise, whoever has closed the fewest days lately

import { addDays, dates, diffDays, covers, isMain, needOn, mergeAdjacent, uid } from './store.js';

const LOOKBACK = 21;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// Removes automatic site events from [from, to] (splits the ones that stick out).
function clearAuto(st, from, to) {
  const out = [];
  for (const e of st.events) {
    if (!(e.auto && e.kind === 'site') || e.to < from || e.from > to) { out.push(e); continue; }
    if (e.from < from) out.push({ ...e, to: addDays(from, -1), end: '' });
    if (e.to > to) out.push({ ...e, id: e.from < from ? uid() : e.id, from: addDays(to, 1), start: '' });
  }
  st.events = out;
}

export function clearAutoInPeriod(st) {
  const before = st.events.filter(e => e.auto).length;
  clearAuto(st, st.start, addDays(st.start, st.days - 1));
  return before - st.events.filter(e => e.auto).length;
}

export function autoAssign(st) {
  const from = st.start, n = st.days, to = addDays(from, n - 1);
  const { maxStreak, minRest } = st.rules;
  clearAuto(st, from, to);

  const soldiers = st.soldiers.filter(s => !s.inactive);
  const all = dates(addDays(from, -LOOKBACK), LOOKBACK + n);
  const off = LOOKBACK;

  // occ[sid][i]: { site } closing, { blocked } another full-day event, or null (free)
  const occ = new Map();
  const cons = new Map();
  for (const so of soldiers) {
    const row = all.map(() => null);
    const cset = new Set();
    for (const e of st.events) {
      if (e.soldierId !== so.id) continue;
      if (e.kind === 'constraint') {
        for (let i = off; i < all.length; i++) if (covers(e, all[i])) cset.add(i);
        continue;
      }
      if (!isMain(e.kind)) continue;
      const a = Math.max(0, diffDays(all[0], e.from)), b = Math.min(all.length - 1, diffDays(all[0], e.to));
      for (let i = a; i <= b; i++) row[i] = e.kind === 'site' ? { site: e.siteId } : { blocked: true };
    }
    occ.set(so.id, row);
    cons.set(so.id, cset);
  }

  const streakAt = (row, i) => { let k = 0; while (i - 1 - k >= 0 && row[i - 1 - k]?.site) k++; return k; };
  const restAt = (row, i) => {
    let k = 0;
    while (i - 1 - k >= 0 && !row[i - 1 - k]?.site) k++;
    return i - 1 - k < 0 ? Infinity : k;
  };
  const loadAt = (row, i) => {
    let k = 0;
    for (let j = 0; j < row.length; j++) if (j !== i && row[j]?.site) k++;
    return k;
  };

  let filled = 0, short = 0;
  // Sites that need more soldiers go first, so the big posts aren't left with leftovers.
  const sites = [...st.sites].sort((a, b) => (+b.need || 0) - (+a.need || 0));

  for (let i = off; i < all.length; i++) {
    const date = all[i];
    for (const site of sites) {
      const need = needOn(site, date);
      let have = 0;
      for (const so of soldiers) if (occ.get(so.id)[i]?.site === site.id) have++;
      while (have < need) {
        let best = null, bestScore = Infinity;
        for (const so of soldiers) {
          const row = occ.get(so.id);
          if (row[i]) continue;
          let sc = 0;
          if (cons.get(so.id).has(i)) sc += 10000;
          const streak = streakAt(row, i);
          if (streak > 0) {
            if (streak >= maxStreak) sc += 5000;
            else if (row[i - 1].site === site.id) sc -= 1000;
            else sc += 200;
          } else if (restAt(row, i) < minRest) sc += 3000;
          // a one-day closing right before a day off is a waste of a trip
          if (streak === 0 && row[i + 1]?.blocked) sc += 60;
          sc += loadAt(row, i) * 20;
          sc += hash(so.id + date + site.id);
          if (sc < bestScore) { bestScore = sc; best = so; }
        }
        if (!best) break;
        occ.get(best.id)[i] = { site: site.id, auto: true };
        have++;
        filled++;
      }
      short += Math.max(0, need - have);
    }
  }

  // Turn the auto cells into events, one per run of days at the same site.
  for (const so of soldiers) {
    const row = occ.get(so.id);
    let i = off;
    while (i < all.length) {
      if (!row[i]?.auto) { i++; continue; }
      const site = row[i].site;
      let j = i;
      while (j + 1 < all.length && row[j + 1]?.auto && row[j + 1].site === site) j++;
      st.events.push({ id: uid(), soldierId: so.id, kind: 'site', siteId: site, from: all[i], to: all[j], start: '', end: '', note: '', auto: true });
      i = j + 1;
    }
    mergeAdjacent(st, so.id);
  }

  return { filled, short };
}
