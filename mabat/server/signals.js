// The signal engine: reads a stock's daily chart and the other skills' findings, and says whether
// there's an entry setup right now, how strong it is, and where the stop and target would sit.
// Every verdict comes with the checks behind it, pass or fail, with the numbers.
//
// Status: 'enter'  a setup fired on the latest or the previous bar and the score is high enough
//         'near'   the stock is close to a trigger (the price to watch is in levels.trigger)
//         'hold'   nothing to do yet
//         'avoid'  downtrend or a serious filing

import { sma, rsi, macd, atr, bollinger, priorHigh, priorLow, last, pct } from './indicators.js';

export const SETUPS = {
  breakout: 'פריצה לשיא חדש',
  pullback: 'תיקון במגמת עלייה',
  macd: 'חציית MACD',
  golden: 'צלב זהב',
  reversal: 'היפוך ממכירת יתר',
  squeeze: 'פריצה מכיווץ',
};

export const ENTER_SCORE = 65;
export const NEAR_SCORE = 50;
const SERIOUS_ITEMS = { '1.03': 'פשיטת רגל', '3.01': 'הודעת מחיקה מהמסחר', '4.02': 'דוחות קודמים לא אמינים', '2.06': 'מחיקת נכסים', '1.05': 'אירוע סייבר' };

const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
// Numbers inside Hebrew sentences are wrapped in direction isolates so "+1.9%" doesn't turn into "1.9%+".
export const iso = s => `\u2066${s}\u2069`;
const fmt = (v, d = 1) => (v == null ? '—' : iso(v.toFixed(d)));
const signed = (v, d = 1) => (v == null ? '—' : iso(`${v >= 0 ? '+' : ''}${v.toFixed(d)}%`));

// bars: [{ t, o, h, l, c, v }] oldest first. ctx: { partial (0..1 of today's session done, or 1),
// spy: { ret63, above200 }, fundamentals, holders, congress, filings }
export function analyze(bars, ctx = {}) {
  const n = bars.length;
  if (n < 60) return { status: 'hold', score: 0, insufficient: true, checks: [], setups: [], warnings: ['אין מספיק היסטוריה בגרף'] };

  const closes = bars.map(b => b.c);
  const i = n - 1;
  const c = closes[i];
  const prev = closes[i - 1];
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const r = rsi(closes, 14);
  const m = macd(closes);
  const a = atr(bars, 14);
  const bb = bollinger(closes, 20, 2);
  const vol20 = sma(bars.map(b => b.v || 0), 20);

  const ATR = a[i] || c * 0.02;
  const has200 = s200[i] != null;
  const above200 = has200 ? c > s200[i] : c > s50[i];
  const golden50 = has200 ? s50[i] > s200[i] : null;
  const slope50 = s50[i - 10] ? pct(s50[i], s50[i - 10]) : null;
  const partial = Math.min(1, Math.max(0.1, ctx.partial ?? 1));
  const avgVol = vol20[i - 1] || vol20[i];
  const relVol = avgVol ? (bars[i].v || 0) / (avgVol * partial) : null;
  const green = c >= bars[i].o;
  const ret21 = pct(c, closes[i - 21]);
  const ret63 = n > 63 ? pct(c, closes[i - 63]) : null;
  const rs63 = ret63 != null && ctx.spy?.ret63 != null ? ret63 - ctx.spy.ret63 : null;
  const high52 = Math.max(...bars.slice(-252).map(b => b.h));
  const low52 = Math.min(...bars.slice(-252).map(b => b.l));
  const high20 = priorHigh(bars, i, 20);

  // ---------- Setups, on the latest bar (age 0) or the one before (age 1) ----------
  const fired = [];
  const at = (id, test) => {
    for (const age of [0, 1]) {
      const detail = test(i - age);
      if (detail) { fired.push({ id, name: SETUPS[id], age, detail }); return; }
    }
  };

  at('breakout', j => {
    const hi = priorHigh(bars, j, 20);
    const rv = vol20[j - 1] ? (bars[j].v || 0) / (vol20[j - 1] * (j === i ? partial : 1)) : 0;
    if (hi && closes[j] > hi && rv >= 1.3 && s50[j] && closes[j] > s50[j]) {
      const is52 = closes[j] >= Math.max(...bars.slice(Math.max(0, j - 252), j).map(b => b.h));
      return `סגר מעל שיא 20 הימים (${fmt(hi, 2)}) עם נפח ${iso(`×${rv.toFixed(1)}`)}${is52 ? ', שיא 52 שבועות' : ''}`;
    }
    return null;
  });

  at('pullback', j => {
    if (!(s50[j] && s20[j]) || !(has200 ? closes[j] > s200[j] && s50[j] > s200[j] : closes[j] > s50[j])) return null;
    const lows = bars.slice(j - 5, j);
    const touched = lows.some((b, k) => {
      const idx = j - 5 + k;
      return (s20[idx] && b.l <= s20[idx] * 1.01) || (s50[idx] && b.l <= s50[idx] * 1.01);
    });
    const dipped = Math.min(...r.slice(j - 5, j).filter(v => v != null)) < 50;
    if (touched && dipped && closes[j] > bars[j - 1].h && closes[j] > s50[j]) return `נגע בממוצע הנע, RSI ירד מתחת ל-50 והמחיר סגר מעל השיא של אתמול`;
    return null;
  });

  at('macd', j => {
    if (m.hist[j] > 0 && m.hist[j - 1] != null && m.hist[j - 1] <= 0 && (has200 ? closes[j] > s200[j] : closes[j] > s50[j])) return 'קו ה-MACD חצה את קו האות כלפי מעלה, מעל ממוצע 200';
    return null;
  });

  at('golden', j => {
    if (!has200 || s200[j - 1] == null) return null;
    if (s50[j] > s200[j] && s50[j - 1] <= s200[j - 1]) return 'ממוצע 50 יום חצה את ממוצע 200 יום כלפי מעלה';
    return null;
  });

  at('reversal', j => {
    if (r[j] != null && r[j - 1] != null && r[j - 1] < 30 && r[j] >= 30 && closes[j] >= bars[j].o) return `RSI עלה חזרה מעל 30 (${fmt(r[j - 1])} → ${fmt(r[j])}) עם נר ירוק`;
    return null;
  });

  at('squeeze', j => {
    const widths = bb.width.slice(Math.max(0, j - 120), j).filter(v => v != null);
    if (widths.length < 60 || bb.upper[j] == null) return null;
    const sorted = [...widths].sort((x, y) => x - y);
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const squeezed = bb.width.slice(j - 5, j).some(w => w != null && w <= p10);
    if (squeezed && closes[j] > bb.upper[j]) return 'הרצועות של בולינגר היו בכיווץ הצר ביותר בחצי שנה והמחיר פרץ מעל הרצועה העליונה';
    return null;
  });

  // ---------- Score ----------
  const best = fired.slice().sort((x, y) => x.age - y.age)[0];
  const checks = [];
  const check = (group, label, pass, points = 0) => { checks.push({ group, label, pass }); return pass ? points : 0; };
  let trend = 0;
  trend += check('technical', has200 ? `מעל ממוצע 200 יום (${fmt(s200[i], 2)})` : 'מעל ממוצע 50 יום', above200, 10);
  if (has200) trend += check('technical', 'ממוצע 50 מעל ממוצע 200 (מגמת עלייה)', golden50, 8);
  trend += check('technical', `מעל ממוצע 50 יום (${fmt(s50[i], 2)})`, c > s50[i], 6);
  trend += check('technical', 'מעל ממוצע 20 יום', c > s20[i], 3);
  trend += check('technical', `ממוצע 50 עולה (${signed(slope50)} ב-10 ימים)`, slope50 > 0, 3);

  let momentum = 0;
  const R = r[i];
  // A pullback or a reversal is bought while momentum is still soft, so its RSI zone is lower.
  const dipSetup = best && (best.id === 'pullback' || best.id === 'reversal');
  const rsiOk = dipSetup ? R >= 35 && R <= 60 : R >= 50 && R <= 70;
  momentum += check('technical', `RSI ${fmt(R)} ${R > 70 ? '(קנוי יתר)' : R < 30 ? '(מכירת יתר)' : rsiOk ? (dipSetup ? '(התקרר, מתאים לכניסה בתיקון)' : '(מומנטום בריא)') : '(מומנטום חלש)'}`, rsiOk, 10);
  if (!rsiOk && ((R >= 40 && R < 50) || (R > 70 && R <= 75))) momentum += 5;
  momentum += check('technical', 'MACD חיובי', m.hist[i] > 0, 5);
  if (m.hist[i] > (m.hist[i - 1] ?? Infinity)) momentum += 3;
  if (rs63 != null) momentum += check('technical', `חזקה מה-S&P 500 ב-3 חודשים (${signed(rs63)})`, rs63 > 0, rs63 >= 5 ? 7 : 4);

  let volume = 0;
  if (relVol != null) {
    volume = relVol >= 1.5 && green ? 10 : relVol >= 1.2 ? 6 : relVol >= 0.8 ? 2 : 0;
    checks.push({ group: 'technical', label: `נפח מסחר ${iso(`×${relVol.toFixed(1)}`)} מהממוצע${ctx.partial < 1 ? ' (מותאם לשעת היום)' : ''}`, pass: relVol >= 1.2 });
  }

  let setupPts = best ? (best.age === 0 ? 20 : 14) : 0;

  const warnings = [];
  // Chasing: far above the 20-day average, or RSI deep in overbought.
  const extended = R > 80 || c > s20[i] * 1.12 || (c > s20[i] + 4 * ATR && R > 75);
  if (extended) warnings.push('המחיר מתוח מאוד מעל הממוצע. כניסה עכשיו היא מרדף אחרי המחיר');

  // trader-screener: the fundamentals rules
  let fund = 0;
  const f = ctx.fundamentals;
  if (f?.rules?.length) {
    for (const rule of f.rules) checks.push({ group: 'fundamental', label: rule.label, pass: rule.pass });
    const judged = f.rules.filter(x => x.pass != null);
    const passed = judged.filter(x => x.pass).length;
    if (judged.length) fund = passed === judged.length ? 10 : passed / judged.length >= 0.5 ? 3 : -5;
  }

  // trader-copycat and trader-pelosi: who else holds it
  let smart = 0;
  if (ctx.holders?.length) {
    smart += 3;
    if (ctx.holders.some(h => h.change === 'new' || h.change === 'added')) smart += 2;
    checks.push({ group: 'smart', label: `מוחזקת ע״י ${ctx.holders.map(h => h.fund).join(', ')} (דוח 13F)`, pass: true });
  }
  if (ctx.congress?.length) checks.push({ group: 'smart', label: `דיווחי מסחר של חברי קונגרס: ${ctx.congress.length}`, pass: null });
  smart = Math.min(5, smart);

  // trader-news: serious 8-K items in the last two weeks
  let newsPenalty = 0;
  for (const filing of ctx.filings || []) {
    const serious = (filing.items || []).filter(it => SERIOUS_ITEMS[it]);
    if (serious.length && filing.ageDays <= 14) {
      newsPenalty = 15;
      warnings.push(`דיווח \u20668-K\u2069 מ-${filing.date}: ${serious.map(it => SERIOUS_ITEMS[it]).join(', ')}`);
    }
    if ((filing.items || []).includes('2.02') && filing.ageDays <= 3) checks.push({ group: 'news', label: `דוחות רבעוניים פורסמו ב-${filing.date}`, pass: null });
  }

  let score = trend + momentum + volume + setupPts + fund + smart - newsPenalty - (extended ? 8 : 0);
  if (ctx.spy && ctx.spy.above200 === false) {
    score *= 0.85;
    warnings.push('ה-S&P 500 מתחת לממוצע 200 יום: שוק חלש, הסיכוי לפריצות נמוך יותר');
  }
  score = Math.round(Math.max(0, Math.min(100, score)));

  // ---------- Status and levels ----------
  const downtrend = has200 ? c < s200[i] && s50[i] < s200[i] : c < s50[i] && slope50 < 0;
  const swingLow = priorLow(bars, i + 1, 10);
  const stop = Math.max(c - 2.5 * ATR, Math.min(c - 1.5 * ATR, swingLow - 0.25 * ATR));

  let status = 'hold';
  let levels = null;
  const reversalOnly = best && fired.every(s => s.id === 'reversal');
  if (newsPenalty) status = 'avoid';
  else if (best && score >= ENTER_SCORE && !extended && (!downtrend || reversalOnly)) status = 'enter';
  else if (downtrend && !best) status = 'avoid';

  if (status === 'enter') {
    const entry = round(c);
    const stopAt = round(stop);
    levels = { entry, stop: stopAt, target: round(entry + 2 * (entry - stopAt)), rr: 2, riskPct: round((1 - stopAt / entry) * 100, 1) };
  } else if (status === 'hold' && !downtrend && high20) {
    const trigger = high20 * 1.002;
    const dist = pct(trigger, c);
    if (dist > 0 && dist <= 3 && score + 8 >= NEAR_SCORE) {
      status = 'near';
      setupPts = 8;
      score = Math.min(100, score + 8);
      levels = { trigger: round(trigger), distPct: round(dist, 1), stop: round(Math.max(trigger - 2.5 * ATR, Math.min(trigger - 1.5 * ATR, swingLow - 0.25 * ATR))) };
      levels.target = round(levels.trigger + 2 * (levels.trigger - levels.stop));
    }
  }

  return {
    price: round(c),
    prevClose: round(prev),
    chgPct: round(pct(c, prev), 2),
    score,
    status,
    setup: status === 'enter' ? best.id : null,
    setups: fired,
    levels,
    checks,
    warnings,
    trend: downtrend ? 'down' : above200 && (golden50 ?? true) ? 'up' : 'side',
    ind: {
      sma20: round(s20[i]), sma50: round(s50[i]), sma200: round(s200[i]),
      rsi: round(R, 1), macdHist: round(m.hist[i], 3), atr: round(ATR), relVol: round(relVol, 2),
      high52: round(high52), low52: round(low52), fromHigh: round(pct(c, high52), 1),
      ret21: round(ret21, 1), ret63: round(ret63, 1), rs63: round(rs63, 1),
    },
    parts: { trend, momentum, volume, setup: setupPts, fundamental: fund, smart, news: -newsPenalty },
  };
}

// Indicator series for the chart (same length as bars).
export function chartSeries(bars) {
  const closes = bars.map(b => b.c);
  return { sma20: sma(closes, 20).map(v => round(v)), sma50: sma(closes, 50).map(v => round(v)), sma200: sma(closes, 200).map(v => round(v)), rsi: rsi(closes, 14).map(v => round(v, 1)) };
}

// trader-budget and trader-risk: how many shares a trade can be, inside the user's rules.
// risk: { budget, riskPct (of the budget lost if the stop hits), maxPositionPct, cashBufferPct, fractional }
export function sizePosition(levels, risk) {
  const entry = levels.entry ?? levels.trigger;
  const perShare = entry - levels.stop;
  if (!(entry > 0) || !(perShare > 0) || !(risk?.budget > 0)) return null;
  const investable = risk.budget * (1 - (risk.cashBufferPct ?? 10) / 100);
  const byRisk = (risk.budget * (risk.riskPct ?? 1) / 100) / perShare;
  const byCap = (Math.min(investable, risk.budget * (risk.maxPositionPct ?? 25) / 100)) / entry;
  let shares = Math.min(byRisk, byCap);
  shares = risk.fractional ? Math.floor(shares * 1000) / 1000 : Math.floor(shares);
  if (shares <= 0) return { shares: 0, cost: 0, risk: 0, cappedBy: 'too-small' };
  return { shares, cost: round(shares * entry), risk: round(shares * perShare), cappedBy: byCap < byRisk ? 'position' : 'risk' };
}
