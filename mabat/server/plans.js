// Ready-made trade plans: for every setup, where to enter, where the stop goes, two targets, and
// the rules for getting out. R is the risk per share (entry minus stop); targets are multiples of it.
//
//   target 1  sell half and move the stop to the entry, so the trade can no longer lose
//   target 2  sell the rest, or keep a part with the trailing stop
//   trailing  once the trade is 1R up, the stop follows N ATR under the highest close since entry
//   failed    the reason for the trade is gone (back under the breakout level, under the average)
//   time      no target 1 after N trading days: the money is better used elsewhere

import { sma, rsi, macd, atr, priorHigh, priorLow } from './indicators.js';
import { barDate } from './clock.js';

export const PLAYBOOK = {
  breakout: { t1R: 1.5, t2R: 3, trail: 3, days: 10, invalidate: 'level' },
  pullback: { t1R: 1.5, t2R: 3, trail: 3, days: 15, invalidate: 'sma50' },
  macd: { t1R: 1.5, t2R: 3, trail: 3, days: 15, invalidate: 'macd' },
  golden: { t1R: 2, t2R: 4, trail: 3.5, days: 30, invalidate: 'sma200' },
  reversal: { t1R: 1.5, t2R: 2.5, trail: 2, days: 7, invalidate: 'rsi' },
  squeeze: { t1R: 1.5, t2R: 3, trail: 3, days: 10, invalidate: 'sma20' },
};
// A position the user added by hand, without a setup.
export const MANUAL = { t1R: 1.5, t2R: 3, trail: 3, days: null, invalidate: null };

const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const iso = s => `⁦${s}⁩`;
const usd = v => iso(`$${v.toFixed(2)}`);

// opts: { entry, atr, sma20, signalIndex (the bar the setup fired on) }
export function tradePlan(setup, bars, { entry, atr: A, sma20, signalIndex } = {}) {
  const p = PLAYBOOK[setup] || MANUAL;
  const i = bars.length - 1;
  const j = Math.min(signalIndex ?? i, bars.length);
  let raw;
  let level = null;
  let why;
  if (setup === 'breakout') {
    level = priorHigh(bars, j, 20);
    raw = level - 0.5 * A;
    why = 'מתחת לרמת הפריצה';
  } else if (setup === 'pullback') {
    raw = priorLow(bars, i + 1, 6) - 0.25 * A;
    why = 'מתחת לשפל של התיקון';
  } else if (setup === 'reversal') {
    raw = priorLow(bars, i + 1, 5) - 0.25 * A;
    why = 'מתחת לשפל של הירידה';
  } else if (setup === 'squeeze') {
    level = sma20;
    raw = sma20 - 0.25 * A;
    why = 'מתחת לאמצע רצועות בולינגר';
  } else if (setup === 'golden') {
    raw = priorLow(bars, i + 1, 20) - 0.25 * A;
    why = 'מתחת לשפל של החודש האחרון';
  } else {
    raw = priorLow(bars, i + 1, 10) - 0.25 * A;
    why = 'מתחת לשפל של השבועיים האחרונים';
  }
  // The risk stays between 1 and 3 ATR, and never more than 12% of the price.
  let stop = Math.min(raw, entry - A);
  if (stop < entry - 3 * A || stop < entry * 0.88) {
    stop = Math.max(entry - 3 * A, entry * 0.88);
    why = 'לפי התנודתיות של המניה (ATR)';
  }
  const E = round(entry);
  const S = round(stop);
  const R = E - S;
  return {
    setup,
    entry: E,
    maxEntry: round(setup === 'breakout' && level ? Math.max(E, level * 1.03) : E + 0.5 * A),
    stop: S,
    stopWhy: why,
    t1: round(E + p.t1R * R),
    t2: round(E + p.t2R * R),
    target: round(E + p.t2R * R),
    t1R: p.t1R,
    t2R: p.t2R,
    riskPct: round((R / E) * 100, 1),
    trailAtr: p.trail,
    timeDays: p.days,
    level: round(level),
  };
}

const EXIT_TEXT = {
  stop: 'הגיעה לסטופ הראשוני',
  breakeven: 'חזרה לנקודת הכניסה אחרי יעד 1',
  trail: 'הגיעה לסטופ הנגרר',
  failed: 'הסיבה לעסקה כבר לא קיימת',
  trend: 'סגרה מתחת לממוצע הנע',
  momentum: 'המומנטום התהפך (MACD מתחת לקו האות)',
  done: 'RSI מעל 70: ההיפוך מוצה',
  time: 'עברו הימים שהוקצו לעסקה בלי יעד 1',
};

// pos: { entry, stop, t1, t2, setup, level, date }. Works only from the bars, so it holds no state:
// the stop moves up as the price makes new highs and never moves down.
export function manage(pos, bars) {
  const p = PLAYBOOK[pos.setup] || MANUAL;
  const i = bars.length - 1;
  const c = bars[i].c;
  const closes = bars.map(b => b.c);
  const A = atr(bars, 14)[i] || c * 0.02;
  const entry = pos.entry;
  const initial = pos.stop > 0 && pos.stop < entry ? pos.stop : round(entry - 2 * A);
  const R = entry - initial;
  const t1 = pos.t1 > entry ? pos.t1 : round(entry + p.t1R * R);
  const t2 = pos.t2 > t1 ? pos.t2 : pos.target > t1 ? pos.target : round(entry + p.t2R * R);

  let k = pos.date ? bars.findIndex(b => barDate(b.t) >= pos.date) : -1;
  if (k < 0) k = i;
  const since = bars.slice(k);
  const days = since.length - 1;
  // The entry day's own high may come before the entry, so targets count from the next bar.
  const after = since.length > 1 ? since.slice(1) : since;
  const highHigh = Math.max(...after.map(b => b.h));
  const highClose = Math.max(...since.map(b => b.c));
  const t1Hit = highHigh >= t1;
  const t2Hit = highHigh >= t2;

  let stopNow = initial;
  let stopKind = 'initial';
  if (t1Hit && entry > stopNow) { stopNow = entry; stopKind = 'breakeven'; }
  let trail = null;
  if (highClose >= entry + R) {
    trail = highClose - p.trail * A;
    if (trail > stopNow) { stopNow = trail; stopKind = 'trail'; }
  }

  let exit = null;
  if (c <= stopNow) exit = stopKind === 'initial' ? 'stop' : stopKind;
  else if (days >= 1) {
    const inv = p.invalidate;
    if (inv === 'level' && pos.level && c < pos.level && !t1Hit) exit = 'failed';
    else if (inv === 'sma20' && !t1Hit && c < sma(closes, 20)[i]) exit = 'failed';
    else if (inv === 'sma50' && c < sma(closes, 50)[i]) exit = 'trend';
    else if (inv === 'sma200' && sma(closes, 200)[i] && c < sma(closes, 200)[i]) exit = 'trend';
    else if (inv === 'macd') { const h = macd(closes).hist; if (h[i] < 0 && h[i - 1] < 0) exit = 'momentum'; }
    else if (inv === 'rsi' && rsi(closes, 14)[i] > 70) exit = 'done';
  }
  if (!exit && p.days && days >= p.days && !t1Hit) exit = 'time';

  const state = exit ? 'exit' : t2Hit ? 't2' : t1Hit ? 't1' : 'hold';
  const next = exit ? `לפי התוכנית יוצאים: ${EXIT_TEXT[exit]}.`
    : t2Hit ? `יעד 2 הושג. מוכרים את השאר, או ממשיכים עם סטופ ב-${usd(stopNow)}.`
    : t1Hit ? `יעד 1 הושג: מוכרים חצי. הסטופ עכשיו ${usd(stopNow)}, היעד הבא ${usd(t2)}.`
    : `מחזיקים. הסטופ ${usd(stopNow)}, יעד 1 ב-${usd(t1)}.`;
  return {
    price: round(c),
    stopNow: round(stopNow),
    stopKind,
    initialStop: round(initial),
    trail: round(trail),
    t1, t2, t1Hit, t2Hit,
    days,
    timeDays: p.days,
    exit,
    exitText: exit ? EXIT_TEXT[exit] : null,
    state,
    r: round((c - entry) / R, 2),
    next,
  };
}
