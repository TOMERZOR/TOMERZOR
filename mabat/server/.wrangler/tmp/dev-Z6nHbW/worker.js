var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// clock.js
var TZ = "America/New_York";
var HOLIDAYS = /* @__PURE__ */ new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24"
]);
var EARLY_CLOSE = /* @__PURE__ */ new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);
var KNOWN_YEARS = /* @__PURE__ */ new Set([2026, 2027]);
var OPEN = 9 * 60 + 30;
var CLOSE = 16 * 60;
var EARLY = 13 * 60;
var PRE = 4 * 60;
var POST = 20 * 60;
var pad = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad");
function nyParts(ms) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second)
  };
}
__name(nyParts, "nyParts");
function nyTime(date, minutes) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let at = guess;
  for (let i = 0; i < 2; i++) {
    const p = nyParts(at);
    const [py, pm, pd] = p.date.split("-").map(Number);
    const shown = Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60);
    at += guess - shown;
  }
  return at;
}
__name(nyTime, "nyTime");
function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
__name(addDays, "addDays");
var weekday = /* @__PURE__ */ __name((date) => (/* @__PURE__ */ new Date(`${date}T12:00:00Z`)).getUTCDay(), "weekday");
function isTradingDay(date) {
  const w = weekday(date);
  return w !== 0 && w !== 6 && !HOLIDAYS.has(date);
}
__name(isTradingDay, "isTradingDay");
var closeMinutes = /* @__PURE__ */ __name((date) => EARLY_CLOSE.has(date) ? EARLY : CLOSE, "closeMinutes");
function marketState(ms = Date.now()) {
  const { date, minutes } = nyParts(ms);
  const trading = isTradingDay(date);
  const close = closeMinutes(date);
  let session = "closed";
  if (trading) {
    if (minutes >= OPEN && minutes < close) session = "open";
    else if (minutes >= PRE && minutes < OPEN) session = "pre";
    else if (minutes >= close && minutes < POST) session = "post";
  }
  let nextOpen = null;
  for (let i = 0; i < 14; i++) {
    const d = addDays(date, i);
    if (!isTradingDay(d)) continue;
    if (i === 0 && minutes >= OPEN) continue;
    nextOpen = nyTime(d, OPEN);
    break;
  }
  return {
    session,
    open: session === "open",
    date,
    tradingDay: trading,
    closesAt: session === "open" ? nyTime(date, close) : null,
    earlyClose: trading && EARLY_CLOSE.has(date),
    nextOpen,
    holidaysKnown: KNOWN_YEARS.has(Number(date.slice(0, 4)))
  };
}
__name(marketState, "marketState");
var barDate = /* @__PURE__ */ __name((sec) => nyParts(sec * 1e3).date, "barDate");

// indicators.js
function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}
__name(sma, "sma");
function ema(values, n) {
  const out = new Array(values.length).fill(null);
  if (values.length < n) return out;
  const k = 2 / (n + 1);
  let prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
__name(ema, "ema");
function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}
__name(rsi, "rsi");
function macd(closes, fast = 12, slow = 26, signal = 9) {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line = closes.map((_, i) => f[i] == null || s[i] == null ? null : f[i] - s[i]);
  const start = line.findIndex((v) => v != null);
  const sig = new Array(closes.length).fill(null);
  if (start >= 0) {
    const tail = ema(line.slice(start), signal);
    tail.forEach((v, i) => {
      sig[start + i] = v;
    });
  }
  const hist = line.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]);
  return { line, signal: sig, hist };
}
__name(macd, "macd");
function atr(bars, n = 14) {
  const out = new Array(bars.length).fill(null);
  if (bars.length <= n) return out;
  const tr = bars.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)));
  let prev = tr.slice(1, n + 1).reduce((a, b) => a + b, 0) / n;
  out[n] = prev;
  for (let i = n + 1; i < bars.length; i++) {
    prev = (prev * (n - 1) + tr[i]) / n;
    out[i] = prev;
  }
  return out;
}
__name(atr, "atr");
function bollinger(closes, n = 20, k = 2) {
  const mid = sma(closes, n);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  const width = new Array(closes.length).fill(null);
  for (let i = n - 1; i < closes.length; i++) {
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(v / n);
    upper[i] = mid[i] + k * sd;
    lower[i] = mid[i] - k * sd;
    width[i] = mid[i] ? (upper[i] - lower[i]) / mid[i] : null;
  }
  return { mid, upper, lower, width };
}
__name(bollinger, "bollinger");
function priorHigh(bars, i, n) {
  let m = -Infinity;
  for (let j = Math.max(0, i - n); j < i; j++) m = Math.max(m, bars[j].h);
  return Number.isFinite(m) ? m : null;
}
__name(priorHigh, "priorHigh");
function priorLow(bars, i, n) {
  let m = Infinity;
  for (let j = Math.max(0, i - n); j < i; j++) m = Math.min(m, bars[j].l);
  return Number.isFinite(m) ? m : null;
}
__name(priorLow, "priorLow");
var pct = /* @__PURE__ */ __name((a, b) => b ? (a / b - 1) * 100 : null, "pct");

// signals.js
var SETUPS = {
  breakout: "\u05E4\u05E8\u05D9\u05E6\u05D4 \u05DC\u05E9\u05D9\u05D0 \u05D7\u05D3\u05E9",
  pullback: "\u05EA\u05D9\u05E7\u05D5\u05DF \u05D1\u05DE\u05D2\u05DE\u05EA \u05E2\u05DC\u05D9\u05D9\u05D4",
  macd: "\u05D7\u05E6\u05D9\u05D9\u05EA MACD",
  golden: "\u05E6\u05DC\u05D1 \u05D6\u05D4\u05D1",
  reversal: "\u05D4\u05D9\u05E4\u05D5\u05DA \u05DE\u05DE\u05DB\u05D9\u05E8\u05EA \u05D9\u05EA\u05E8",
  squeeze: "\u05E4\u05E8\u05D9\u05E6\u05D4 \u05DE\u05DB\u05D9\u05D5\u05D5\u05E5"
};
var ENTER_SCORE = 65;
var NEAR_SCORE = 50;
var SERIOUS_ITEMS = { "1.03": "\u05E4\u05E9\u05D9\u05D8\u05EA \u05E8\u05D2\u05DC", "3.01": "\u05D4\u05D5\u05D3\u05E2\u05EA \u05DE\u05D7\u05D9\u05E7\u05D4 \u05DE\u05D4\u05DE\u05E1\u05D7\u05E8", "4.02": "\u05D3\u05D5\u05D7\u05D5\u05EA \u05E7\u05D5\u05D3\u05DE\u05D9\u05DD \u05DC\u05D0 \u05D0\u05DE\u05D9\u05E0\u05D9\u05DD", "2.06": "\u05DE\u05D7\u05D9\u05E7\u05EA \u05E0\u05DB\u05E1\u05D9\u05DD", "1.05": "\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E1\u05D9\u05D9\u05D1\u05E8" };
var round = /* @__PURE__ */ __name((v, d = 2) => v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d, "round");
var iso = /* @__PURE__ */ __name((s) => `\u2066${s}\u2069`, "iso");
var fmt = /* @__PURE__ */ __name((v, d = 1) => v == null ? "\u2014" : iso(v.toFixed(d)), "fmt");
var signed = /* @__PURE__ */ __name((v, d = 1) => v == null ? "\u2014" : iso(`${v >= 0 ? "+" : ""}${v.toFixed(d)}%`), "signed");
function analyze(bars, ctx = {}) {
  const n = bars.length;
  if (n < 60) return { status: "hold", score: 0, insufficient: true, checks: [], setups: [], warnings: ["\u05D0\u05D9\u05DF \u05DE\u05E1\u05E4\u05D9\u05E7 \u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4 \u05D1\u05D2\u05E8\u05E3"] };
  const closes = bars.map((b) => b.c);
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
  const vol20 = sma(bars.map((b) => b.v || 0), 20);
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
  const high52 = Math.max(...bars.slice(-252).map((b) => b.h));
  const low52 = Math.min(...bars.slice(-252).map((b) => b.l));
  const high20 = priorHigh(bars, i, 20);
  const fired = [];
  const at = /* @__PURE__ */ __name((id, test) => {
    for (const age of [0, 1]) {
      const detail = test(i - age);
      if (detail) {
        fired.push({ id, name: SETUPS[id], age, detail });
        return;
      }
    }
  }, "at");
  at("breakout", (j) => {
    const hi = priorHigh(bars, j, 20);
    const rv = vol20[j - 1] ? (bars[j].v || 0) / (vol20[j - 1] * (j === i ? partial : 1)) : 0;
    if (hi && closes[j] > hi && rv >= 1.3 && s50[j] && closes[j] > s50[j]) {
      const is52 = closes[j] >= Math.max(...bars.slice(Math.max(0, j - 252), j).map((b) => b.h));
      return `\u05E1\u05D2\u05E8 \u05DE\u05E2\u05DC \u05E9\u05D9\u05D0 20 \u05D4\u05D9\u05DE\u05D9\u05DD (${fmt(hi, 2)}) \u05E2\u05DD \u05E0\u05E4\u05D7 ${iso(`\xD7${rv.toFixed(1)}`)}${is52 ? ", \u05E9\u05D9\u05D0 52 \u05E9\u05D1\u05D5\u05E2\u05D5\u05EA" : ""}`;
    }
    return null;
  });
  at("pullback", (j) => {
    if (!(s50[j] && s20[j]) || !(has200 ? closes[j] > s200[j] && s50[j] > s200[j] : closes[j] > s50[j])) return null;
    const lows = bars.slice(j - 5, j);
    const touched = lows.some((b, k) => {
      const idx = j - 5 + k;
      return s20[idx] && b.l <= s20[idx] * 1.01 || s50[idx] && b.l <= s50[idx] * 1.01;
    });
    const dipped = Math.min(...r.slice(j - 5, j).filter((v) => v != null)) < 50;
    if (touched && dipped && closes[j] > bars[j - 1].h && closes[j] > s50[j]) return `\u05E0\u05D2\u05E2 \u05D1\u05DE\u05DE\u05D5\u05E6\u05E2 \u05D4\u05E0\u05E2, RSI \u05D9\u05E8\u05D3 \u05DE\u05EA\u05D7\u05EA \u05DC-50 \u05D5\u05D4\u05DE\u05D7\u05D9\u05E8 \u05E1\u05D2\u05E8 \u05DE\u05E2\u05DC \u05D4\u05E9\u05D9\u05D0 \u05E9\u05DC \u05D0\u05EA\u05DE\u05D5\u05DC`;
    return null;
  });
  at("macd", (j) => {
    if (m.hist[j] > 0 && m.hist[j - 1] != null && m.hist[j - 1] <= 0 && (has200 ? closes[j] > s200[j] : closes[j] > s50[j])) return "\u05E7\u05D5 \u05D4-MACD \u05D7\u05E6\u05D4 \u05D0\u05EA \u05E7\u05D5 \u05D4\u05D0\u05D5\u05EA \u05DB\u05DC\u05E4\u05D9 \u05DE\u05E2\u05DC\u05D4, \u05DE\u05E2\u05DC \u05DE\u05DE\u05D5\u05E6\u05E2 200";
    return null;
  });
  at("golden", (j) => {
    if (!has200 || s200[j - 1] == null) return null;
    if (s50[j] > s200[j] && s50[j - 1] <= s200[j - 1]) return "\u05DE\u05DE\u05D5\u05E6\u05E2 50 \u05D9\u05D5\u05DD \u05D7\u05E6\u05D4 \u05D0\u05EA \u05DE\u05DE\u05D5\u05E6\u05E2 200 \u05D9\u05D5\u05DD \u05DB\u05DC\u05E4\u05D9 \u05DE\u05E2\u05DC\u05D4";
    return null;
  });
  at("reversal", (j) => {
    if (r[j] != null && r[j - 1] != null && r[j - 1] < 30 && r[j] >= 30 && closes[j] >= bars[j].o) return `RSI \u05E2\u05DC\u05D4 \u05D7\u05D6\u05E8\u05D4 \u05DE\u05E2\u05DC 30 (${fmt(r[j - 1])} \u2192 ${fmt(r[j])}) \u05E2\u05DD \u05E0\u05E8 \u05D9\u05E8\u05D5\u05E7`;
    return null;
  });
  at("squeeze", (j) => {
    const widths = bb.width.slice(Math.max(0, j - 120), j).filter((v) => v != null);
    if (widths.length < 60 || bb.upper[j] == null) return null;
    const sorted = [...widths].sort((x, y) => x - y);
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const squeezed = bb.width.slice(j - 5, j).some((w) => w != null && w <= p10);
    if (squeezed && closes[j] > bb.upper[j]) return "\u05D4\u05E8\u05E6\u05D5\u05E2\u05D5\u05EA \u05E9\u05DC \u05D1\u05D5\u05DC\u05D9\u05E0\u05D2\u05E8 \u05D4\u05D9\u05D5 \u05D1\u05DB\u05D9\u05D5\u05D5\u05E5 \u05D4\u05E6\u05E8 \u05D1\u05D9\u05D5\u05EA\u05E8 \u05D1\u05D7\u05E6\u05D9 \u05E9\u05E0\u05D4 \u05D5\u05D4\u05DE\u05D7\u05D9\u05E8 \u05E4\u05E8\u05E5 \u05DE\u05E2\u05DC \u05D4\u05E8\u05E6\u05D5\u05E2\u05D4 \u05D4\u05E2\u05DC\u05D9\u05D5\u05E0\u05D4";
    return null;
  });
  const best = fired.slice().sort((x, y) => x.age - y.age)[0];
  const checks = [];
  const check = /* @__PURE__ */ __name((group, label, pass, points = 0) => {
    checks.push({ group, label, pass });
    return pass ? points : 0;
  }, "check");
  let trend = 0;
  trend += check("technical", has200 ? `\u05DE\u05E2\u05DC \u05DE\u05DE\u05D5\u05E6\u05E2 200 \u05D9\u05D5\u05DD (${fmt(s200[i], 2)})` : "\u05DE\u05E2\u05DC \u05DE\u05DE\u05D5\u05E6\u05E2 50 \u05D9\u05D5\u05DD", above200, 10);
  if (has200) trend += check("technical", "\u05DE\u05DE\u05D5\u05E6\u05E2 50 \u05DE\u05E2\u05DC \u05DE\u05DE\u05D5\u05E6\u05E2 200 (\u05DE\u05D2\u05DE\u05EA \u05E2\u05DC\u05D9\u05D9\u05D4)", golden50, 8);
  trend += check("technical", `\u05DE\u05E2\u05DC \u05DE\u05DE\u05D5\u05E6\u05E2 50 \u05D9\u05D5\u05DD (${fmt(s50[i], 2)})`, c > s50[i], 6);
  trend += check("technical", "\u05DE\u05E2\u05DC \u05DE\u05DE\u05D5\u05E6\u05E2 20 \u05D9\u05D5\u05DD", c > s20[i], 3);
  trend += check("technical", `\u05DE\u05DE\u05D5\u05E6\u05E2 50 \u05E2\u05D5\u05DC\u05D4 (${signed(slope50)} \u05D1-10 \u05D9\u05DE\u05D9\u05DD)`, slope50 > 0, 3);
  let momentum = 0;
  const R = r[i];
  const dipSetup = best && (best.id === "pullback" || best.id === "reversal");
  const rsiOk = dipSetup ? R >= 35 && R <= 60 : R >= 50 && R <= 70;
  momentum += check("technical", `RSI ${fmt(R)} ${R > 70 ? "(\u05E7\u05E0\u05D5\u05D9 \u05D9\u05EA\u05E8)" : R < 30 ? "(\u05DE\u05DB\u05D9\u05E8\u05EA \u05D9\u05EA\u05E8)" : rsiOk ? dipSetup ? "(\u05D4\u05EA\u05E7\u05E8\u05E8, \u05DE\u05EA\u05D0\u05D9\u05DD \u05DC\u05DB\u05E0\u05D9\u05E1\u05D4 \u05D1\u05EA\u05D9\u05E7\u05D5\u05DF)" : "(\u05DE\u05D5\u05DE\u05E0\u05D8\u05D5\u05DD \u05D1\u05E8\u05D9\u05D0)" : "(\u05DE\u05D5\u05DE\u05E0\u05D8\u05D5\u05DD \u05D7\u05DC\u05E9)"}`, rsiOk, 10);
  if (!rsiOk && (R >= 40 && R < 50 || R > 70 && R <= 75)) momentum += 5;
  momentum += check("technical", "MACD \u05D7\u05D9\u05D5\u05D1\u05D9", m.hist[i] > 0, 5);
  if (m.hist[i] > (m.hist[i - 1] ?? Infinity)) momentum += 3;
  if (rs63 != null) momentum += check("technical", `\u05D7\u05D6\u05E7\u05D4 \u05DE\u05D4-S&P 500 \u05D1-3 \u05D7\u05D5\u05D3\u05E9\u05D9\u05DD (${signed(rs63)})`, rs63 > 0, rs63 >= 5 ? 7 : 4);
  let volume = 0;
  if (relVol != null) {
    volume = relVol >= 1.5 && green ? 10 : relVol >= 1.2 ? 6 : relVol >= 0.8 ? 2 : 0;
    checks.push({ group: "technical", label: `\u05E0\u05E4\u05D7 \u05DE\u05E1\u05D7\u05E8 ${iso(`\xD7${relVol.toFixed(1)}`)} \u05DE\u05D4\u05DE\u05DE\u05D5\u05E6\u05E2${ctx.partial < 1 ? " (\u05DE\u05D5\u05EA\u05D0\u05DD \u05DC\u05E9\u05E2\u05EA \u05D4\u05D9\u05D5\u05DD)" : ""}`, pass: relVol >= 1.2 });
  }
  let setupPts = best ? best.age === 0 ? 20 : 14 : 0;
  const warnings = [];
  const extended = R > 80 || c > s20[i] * 1.12 || c > s20[i] + 4 * ATR && R > 75;
  if (extended) warnings.push("\u05D4\u05DE\u05D7\u05D9\u05E8 \u05DE\u05EA\u05D5\u05D7 \u05DE\u05D0\u05D5\u05D3 \u05DE\u05E2\u05DC \u05D4\u05DE\u05DE\u05D5\u05E6\u05E2. \u05DB\u05E0\u05D9\u05E1\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5 \u05D4\u05D9\u05D0 \u05DE\u05E8\u05D3\u05E3 \u05D0\u05D7\u05E8\u05D9 \u05D4\u05DE\u05D7\u05D9\u05E8");
  let fund = 0;
  const f = ctx.fundamentals;
  if (f?.rules?.length) {
    for (const rule of f.rules) checks.push({ group: "fundamental", label: rule.label, pass: rule.pass });
    const judged = f.rules.filter((x) => x.pass != null);
    const passed = judged.filter((x) => x.pass).length;
    if (judged.length) fund = passed === judged.length ? 10 : passed / judged.length >= 0.5 ? 3 : -5;
  }
  let smart = 0;
  if (ctx.holders?.length) {
    smart += 3;
    if (ctx.holders.some((h) => h.change === "new" || h.change === "added")) smart += 2;
    checks.push({ group: "smart", label: `\u05DE\u05D5\u05D7\u05D6\u05E7\u05EA \u05E2\u05F4\u05D9 ${ctx.holders.map((h) => h.fund).join(", ")} (\u05D3\u05D5\u05D7 13F)`, pass: true });
  }
  if (ctx.congress?.length) checks.push({ group: "smart", label: `\u05D3\u05D9\u05D5\u05D5\u05D7\u05D9 \u05DE\u05E1\u05D7\u05E8 \u05E9\u05DC \u05D7\u05D1\u05E8\u05D9 \u05E7\u05D5\u05E0\u05D2\u05E8\u05E1: ${ctx.congress.length}`, pass: null });
  smart = Math.min(5, smart);
  let newsPenalty = 0;
  for (const filing of ctx.filings || []) {
    const serious = (filing.items || []).filter((it) => SERIOUS_ITEMS[it]);
    if (serious.length && filing.ageDays <= 14) {
      newsPenalty = 15;
      warnings.push(`\u05D3\u05D9\u05D5\u05D5\u05D7 \u20668-K\u2069 \u05DE-${filing.date}: ${serious.map((it) => SERIOUS_ITEMS[it]).join(", ")}`);
    }
    if ((filing.items || []).includes("2.02") && filing.ageDays <= 3) checks.push({ group: "news", label: `\u05D3\u05D5\u05D7\u05D5\u05EA \u05E8\u05D1\u05E2\u05D5\u05E0\u05D9\u05D9\u05DD \u05E4\u05D5\u05E8\u05E1\u05DE\u05D5 \u05D1-${filing.date}`, pass: null });
  }
  let score = trend + momentum + volume + setupPts + fund + smart - newsPenalty - (extended ? 8 : 0);
  if (ctx.spy && ctx.spy.above200 === false) {
    score *= 0.85;
    warnings.push("\u05D4-S&P 500 \u05DE\u05EA\u05D7\u05EA \u05DC\u05DE\u05DE\u05D5\u05E6\u05E2 200 \u05D9\u05D5\u05DD: \u05E9\u05D5\u05E7 \u05D7\u05DC\u05E9, \u05D4\u05E1\u05D9\u05DB\u05D5\u05D9 \u05DC\u05E4\u05E8\u05D9\u05E6\u05D5\u05EA \u05E0\u05DE\u05D5\u05DA \u05D9\u05D5\u05EA\u05E8");
  }
  score = Math.round(Math.max(0, Math.min(100, score)));
  const downtrend = has200 ? c < s200[i] && s50[i] < s200[i] : c < s50[i] && slope50 < 0;
  const swingLow = priorLow(bars, i + 1, 10);
  const stop = Math.max(c - 2.5 * ATR, Math.min(c - 1.5 * ATR, swingLow - 0.25 * ATR));
  let status = "hold";
  let levels = null;
  const reversalOnly = best && fired.every((s) => s.id === "reversal");
  if (newsPenalty) status = "avoid";
  else if (best && score >= ENTER_SCORE && !extended && (!downtrend || reversalOnly)) status = "enter";
  else if (downtrend && !best) status = "avoid";
  if (status === "enter") {
    const entry = round(c);
    const stopAt = round(stop);
    levels = { entry, stop: stopAt, target: round(entry + 2 * (entry - stopAt)), rr: 2, riskPct: round((1 - stopAt / entry) * 100, 1) };
  } else if (status === "hold" && !downtrend && high20) {
    const trigger = high20 * 1.002;
    const dist = pct(trigger, c);
    if (dist > 0 && dist <= 3 && score + 8 >= NEAR_SCORE) {
      status = "near";
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
    setup: status === "enter" ? best.id : null,
    setups: fired,
    levels,
    checks,
    warnings,
    trend: downtrend ? "down" : above200 && (golden50 ?? true) ? "up" : "side",
    ind: {
      sma20: round(s20[i]),
      sma50: round(s50[i]),
      sma200: round(s200[i]),
      rsi: round(R, 1),
      macdHist: round(m.hist[i], 3),
      atr: round(ATR),
      relVol: round(relVol, 2),
      high52: round(high52),
      low52: round(low52),
      fromHigh: round(pct(c, high52), 1),
      ret21: round(ret21, 1),
      ret63: round(ret63, 1),
      rs63: round(rs63, 1)
    },
    parts: { trend, momentum, volume, setup: setupPts, fundamental: fund, smart, news: -newsPenalty }
  };
}
__name(analyze, "analyze");
function chartSeries(bars) {
  const closes = bars.map((b) => b.c);
  return { sma20: sma(closes, 20).map((v) => round(v)), sma50: sma(closes, 50).map((v) => round(v)), sma200: sma(closes, 200).map((v) => round(v)), rsi: rsi(closes, 14).map((v) => round(v, 1)) };
}
__name(chartSeries, "chartSeries");

// sources.js
var BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
var SourceError = class extends Error {
  static {
    __name(this, "SourceError");
  }
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
function makeFetch(env = {}, counter = { n: 0 }) {
  return async (url, init = {}) => {
    counter.n++;
    const target = env.UPSTREAM ? `${env.UPSTREAM}/${url.replace(/^https:\/\//, "")}` : url;
    const res = await fetch(target, { ...init, headers: { "User-Agent": BROWSER_UA, Accept: "*/*", ...init.headers || {} }, cf: { cacheTtl: 0 } });
    if (!res.ok) throw new SourceError(`${new URL(url).host} answered ${res.status}`, res.status);
    return res;
  };
}
__name(makeFetch, "makeFetch");
var TICKER = /^[A-Z][A-Z0-9]{0,5}([.-][A-Z]{1,2})?$/;
async function yahooChart(get, symbol) {
  let lastError;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const res = await get(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&includePrePost=false&events=div%2Csplits`);
      return { ...parseChart(await res.json()), source: "yahoo" };
    } catch (e) {
      lastError = e;
      if (e.status === 404) break;
    }
  }
  if (lastError?.status !== 404) {
    try {
      return { ...await stooqDaily(get, symbol), source: "stooq" };
    } catch {
    }
  }
  throw lastError;
}
__name(yahooChart, "yahooChart");
var ymd = /* @__PURE__ */ __name((ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, ""), "ymd");
async function stooqDaily(get, symbol, now = Date.now()) {
  const s = `${symbol.toLowerCase()}.us`;
  const res = await get(`https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d&d1=${ymd(now - 700 * 864e5)}&d2=${ymd(now)}`);
  return parseStooq(await res.text(), symbol);
}
__name(stooqDaily, "stooqDaily");
function parseStooq(csv, symbol) {
  const lines = csv.trim().split(/\r?\n/);
  if (!/^Date,Open,High,Low,Close/i.test(lines[0] || "")) throw new SourceError("stooq: no data", 404);
  const bars = [];
  for (const line of lines.slice(1)) {
    const [d, o, h, l, c, v] = line.split(",");
    const close = Number(c);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(close)) continue;
    const t = Math.floor(Date.parse(`${d}T20:30:00Z`) / 1e3);
    bars.push({ t, o: Number(o) || close, h: Number(h) || close, l: Number(l) || close, c: close, v: Number(v) || 0 });
  }
  if (!bars.length) throw new SourceError("stooq: empty", 404);
  return { meta: { symbol, name: symbol, currency: "USD", exchange: "", type: "EQUITY", time: bars[bars.length - 1].t }, bars: bars.slice(-460) };
}
__name(parseStooq, "parseStooq");
function parseChart(json2) {
  const result = json2?.chart?.result?.[0];
  if (!result) throw new SourceError(json2?.chart?.error?.description || "no chart data", 404);
  const meta = result.meta || {};
  const q = result.indicators?.quote?.[0] || {};
  const ts = result.timestamp || [];
  const byDate = /* @__PURE__ */ new Map();
  for (let k = 0; k < ts.length; k++) {
    const c = q.close?.[k];
    if (c == null || !Number.isFinite(c)) continue;
    const o = q.open?.[k] ?? c;
    const h = q.high?.[k] ?? Math.max(o, c);
    const l = q.low?.[k] ?? Math.min(o, c);
    byDate.set(barDate(ts[k]), { t: ts[k], o, h: Math.max(h, o, c), l: Math.min(l, o, c), c, v: q.volume?.[k] ?? 0 });
  }
  const bars = [...byDate.values()].sort((a, b) => a.t - b.t);
  const price = meta.regularMarketPrice;
  if (Number.isFinite(price) && meta.regularMarketTime && bars.length) {
    const lastBar = bars[bars.length - 1];
    const liveDate = barDate(meta.regularMarketTime);
    const lastDate = barDate(lastBar.t);
    if (liveDate === lastDate) {
      lastBar.c = price;
      lastBar.h = Math.max(lastBar.h, price);
      lastBar.l = Math.min(lastBar.l, price);
      if (meta.regularMarketVolume) lastBar.v = Math.max(lastBar.v, meta.regularMarketVolume);
    } else if (liveDate > lastDate) {
      bars.push({ t: meta.regularMarketTime, o: price, h: meta.regularMarketDayHigh || price, l: meta.regularMarketDayLow || price, c: price, v: meta.regularMarketVolume || 0 });
    }
  }
  if (!bars.length) throw new SourceError("empty chart", 404);
  return {
    meta: {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      currency: meta.currency || "USD",
      exchange: meta.fullExchangeName || meta.exchangeName || "",
      type: meta.instrumentType || "EQUITY",
      time: meta.regularMarketTime || bars[bars.length - 1].t
    },
    bars
  };
}
__name(parseChart, "parseChart");
var r4 = /* @__PURE__ */ __name((v) => Math.round(v * 1e4) / 1e4, "r4");
var packBars = /* @__PURE__ */ __name((bars) => bars.map((b) => [b.t, r4(b.o), r4(b.h), r4(b.l), r4(b.c), b.v]), "packBars");
var unpackBars = /* @__PURE__ */ __name((rows) => rows.map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v })), "unpackBars");
var US_EXCHANGES = /* @__PURE__ */ new Set(["NMS", "NYQ", "NGM", "NCM", "ASE", "PCX", "BTS", "NAS", "NYS", "PNK"]);
async function yahooSearch(get, query) {
  const res = await get(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`);
  const json2 = await res.json();
  return (json2.quotes || []).filter((x) => (x.quoteType === "EQUITY" || x.quoteType === "ETF") && TICKER.test(x.symbol || "") && (!x.exchange || US_EXCHANGES.has(x.exchange))).slice(0, 8).map((x) => ({ t: x.symbol, name: x.longname || x.shortname || x.symbol, exchange: x.exchDisp || x.exchange || "", type: x.quoteType }));
}
__name(yahooSearch, "yahooSearch");
var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeXml(s = "") {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  }).replace(/<[^>]+>/g, "").trim();
}
__name(decodeXml, "decodeXml");
var tag = /* @__PURE__ */ __name((xml, name) => {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i"));
  return m ? m[1] : "";
}, "tag");
function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = m[1];
    const title = decodeXml(tag(body, "title"));
    const link = decodeXml(tag(body, "link"));
    const date = Date.parse(decodeXml(tag(body, "pubDate")));
    if (!title || !/^https?:\/\//.test(link)) continue;
    items.push({ title, link, at: Number.isFinite(date) ? date : null, source: decodeXml(tag(body, "source")) || "Yahoo Finance" });
  }
  return items;
}
__name(parseRss, "parseRss");
var NEWS_TAGS = [
  ["earnings", /\b(earnings|results|revenue|eps|quarter|guidance|beats?|miss(es)?)\b/i],
  ["analyst", /\b(upgrade[sd]?|downgrade[sd]?|price target|rating|analyst)\b/i],
  ["legal", /\b(lawsuit|sues?|court|judge|probe|investigation|sec charges|antitrust|settle)/i],
  ["deal", /\b(acquir|merger|buyout|deal|takeover|stake)\w*/i],
  ["people", /\b(ceo|cfo|chief|resign|steps down|appoint)\w*/i],
  ["risk", /\b(recall|bankrupt|default|restat|delist|halt|plunge|crash|warning)\w*/i]
];
var tagHeadline = /* @__PURE__ */ __name((title) => NEWS_TAGS.filter(([, re]) => re.test(title)).map(([id]) => id), "tagHeadline");
async function headlines(get, symbol) {
  const res = await get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`);
  return parseRss(await res.text()).map((x) => ({ ...x, tags: tagHeadline(x.title) })).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12);
}
__name(headlines, "headlines");
var cik10 = /* @__PURE__ */ __name((cik) => String(cik).padStart(10, "0"), "cik10");
var secHeaders = /* @__PURE__ */ __name((ua) => ({ "User-Agent": ua, Accept: "application/json, text/xml, */*" }), "secHeaders");
async function secTickerMap(get, ua) {
  const res = await get("https://www.sec.gov/files/company_tickers.json", { headers: secHeaders(ua) });
  const json2 = await res.json();
  const map = {};
  for (const row of Object.values(json2)) if (row?.ticker) map[row.ticker.toUpperCase().replace(".", "-")] = row.cik_str;
  return map;
}
__name(secTickerMap, "secTickerMap");
async function secSubmissions(get, ua, cik) {
  const res = await get(`https://data.sec.gov/submissions/CIK${cik10(cik)}.json`, { headers: secHeaders(ua) });
  return res.json();
}
__name(secSubmissions, "secSubmissions");
function recentFilings(sub, forms) {
  const r = sub?.filings?.recent || {};
  const out = [];
  for (let k = 0; k < (r.form || []).length; k++) {
    if (forms && !forms.includes(r.form[k])) continue;
    const acc = r.accessionNumber[k];
    out.push({
      form: r.form[k],
      date: r.filingDate[k],
      period: r.reportDate?.[k] || null,
      acc,
      items: (r.items?.[k] || "").split(",").map((s) => s.trim()).filter(Boolean),
      doc: r.primaryDocument?.[k] || "",
      url: `https://www.sec.gov/Archives/edgar/data/${Number(sub.cik)}/${acc.replace(/-/g, "")}/${r.primaryDocument?.[k] || ""}`
    });
  }
  return out.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}
__name(recentFilings, "recentFilings");
var ITEM_NAMES = {
  "1.01": "\u05D4\u05E1\u05DB\u05DD \u05DE\u05D4\u05D5\u05EA\u05D9",
  "1.03": "\u05E4\u05E9\u05D9\u05D8\u05EA \u05E8\u05D2\u05DC",
  "1.05": "\u05D0\u05D9\u05E8\u05D5\u05E2 \u05E1\u05D9\u05D9\u05D1\u05E8",
  "2.01": "\u05E8\u05DB\u05D9\u05E9\u05D4 \u05D0\u05D5 \u05DE\u05DB\u05D9\u05E8\u05D4 \u05E9\u05DC \u05E0\u05DB\u05E1\u05D9\u05DD",
  "2.02": "\u05D3\u05D5\u05D7\u05D5\u05EA \u05E8\u05D1\u05E2\u05D5\u05E0\u05D9\u05D9\u05DD",
  "2.05": "\u05E2\u05DC\u05D5\u05D9\u05D5\u05EA \u05D0\u05E8\u05D2\u05D5\u05DF \u05DE\u05D7\u05D3\u05E9",
  "2.06": "\u05DE\u05D7\u05D9\u05E7\u05EA \u05E0\u05DB\u05E1\u05D9\u05DD",
  "3.01": "\u05D4\u05D5\u05D3\u05E2\u05EA \u05DE\u05D7\u05D9\u05E7\u05D4 \u05DE\u05D4\u05DE\u05E1\u05D7\u05E8",
  "4.02": "\u05D3\u05D5\u05D7\u05D5\u05EA \u05E7\u05D5\u05D3\u05DE\u05D9\u05DD \u05DC\u05D0 \u05D0\u05DE\u05D9\u05E0\u05D9\u05DD",
  "5.02": "\u05E9\u05D9\u05E0\u05D5\u05D9 \u05D1\u05D4\u05E0\u05D4\u05DC\u05D4",
  "5.07": "\u05D4\u05E6\u05D1\u05E2\u05EA \u05D1\u05E2\u05DC\u05D9 \u05DE\u05E0\u05D9\u05D5\u05EA",
  "7.01": "\u05D2\u05D9\u05DC\u05D5\u05D9 \u05E0\u05D0\u05D5\u05EA",
  "8.01": "\u05D0\u05D9\u05E8\u05D5\u05E2 \u05D0\u05D7\u05E8"
};
var IMPORTANT_ITEMS = /* @__PURE__ */ new Set(["1.03", "1.05", "2.02", "2.06", "3.01", "4.02", "5.02"]);
async function secConcept(get, ua, cik, concept) {
  const res = await get(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik10(cik)}/us-gaap/${concept}.json`, { headers: secHeaders(ua) });
  const json2 = await res.json();
  return json2.units?.USD || json2.units?.["USD/shares"] || [];
}
__name(secConcept, "secConcept");
var DAY = 864e5;
var days = /* @__PURE__ */ __name((a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY), "days");
function dedupe(facts) {
  const by = /* @__PURE__ */ new Map();
  for (const f of facts) {
    if (!f.start || !f.end || !Number.isFinite(f.val)) continue;
    const key = `${f.start}|${f.end}`;
    const prev = by.get(key);
    if (!prev || (f.filed || "") > (prev.filed || "")) by.set(key, f);
  }
  return [...by.values()];
}
__name(dedupe, "dedupe");
function quarters(facts) {
  const all = dedupe(facts);
  const q = all.filter((f) => {
    const d = days(f.start, f.end);
    return d >= 80 && d <= 100;
  });
  const years = all.filter((f) => {
    const d = days(f.start, f.end);
    return d >= 350 && d <= 380;
  });
  for (const y of years) {
    if (q.some((x) => Math.abs(days(x.end, y.end)) <= 5)) continue;
    const inside = q.filter((x) => days(y.start, x.start) >= -5 && days(x.end, y.end) >= -5);
    if (inside.length !== 3) continue;
    const lastEnd = inside.map((x) => x.end).sort().pop();
    q.push({ start: lastEnd, end: y.end, val: y.val - inside.reduce((s, x) => s + x.val, 0), derived: true, filed: y.filed });
  }
  const byEnd = /* @__PURE__ */ new Map();
  for (const f of q) if (!byEnd.has(f.end) || !f.derived) byEnd.set(f.end, f);
  return [...byEnd.values()].sort((a, b) => a.end < b.end ? -1 : 1);
}
__name(quarters, "quarters");
function ttm(qs) {
  if (qs.length < 4) return null;
  const four = qs.slice(-4);
  const span = days(four[0].start, four[3].end);
  if (span < 350 || span > 380) return null;
  return four.reduce((s, x) => s + x.val, 0);
}
__name(ttm, "ttm");
var near = /* @__PURE__ */ __name((list, end, tolerance = 12) => list.find((x) => Math.abs(days(x.end, end)) <= tolerance), "near");
function fundamentals(concepts, price) {
  const rev = quarters(concepts.revenue || []);
  const ni = quarters(concepts.netIncome || []);
  const op = quarters(concepts.opIncome || []);
  const eps = quarters(concepts.eps || []);
  const latest = rev[rev.length - 1];
  const metrics = { quarterEnd: latest?.end || null, derived: !!latest?.derived };
  if (latest) {
    const yearAgo = near(rev, new Date(Date.parse(latest.end) - 364 * DAY).toISOString().slice(0, 10));
    metrics.revenue = latest.val;
    metrics.revenueGrowth = yearAgo?.val > 0 ? (latest.val / yearAgo.val - 1) * 100 : null;
    const n = near(ni, latest.end, 3);
    const o = near(op, latest.end, 3);
    metrics.netMargin = n && latest.val ? n.val / latest.val * 100 : null;
    metrics.opMargin = o && latest.val ? o.val / latest.val * 100 : null;
    metrics.oneOff = !!(n && o && n.val > o.val && o.val > 0);
  }
  metrics.epsTTM = ttm(eps);
  metrics.revenueTTM = ttm(rev);
  for (const k of ["revenueGrowth", "netMargin", "opMargin", "epsTTM"]) metrics[k] = metrics[k] == null ? null : Math.round(metrics[k] * 100) / 100;
  return { metrics, rules: screenRules(metrics, price) };
}
__name(fundamentals, "fundamentals");
function screenRules(metrics, price) {
  const r1 = /* @__PURE__ */ __name((v) => v == null ? null : `\u2066${Math.round(v * 10) / 10}\u2069`, "r1");
  const pe = metrics.epsTTM > 0 && price > 0 ? price / metrics.epsTTM : null;
  const rules = [];
  rules.push(metrics.revenueGrowth == null ? { id: "growth", label: "\u05E6\u05DE\u05D9\u05D7\u05D4 \u05D1\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA: \u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05DF", pass: null } : { id: "growth", label: `\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA \u2066${metrics.revenueGrowth >= 0 ? "+" : ""}${Math.round(metrics.revenueGrowth * 10) / 10}%\u2069 \u05DE\u05D5\u05DC \u05D4\u05E8\u05D1\u05E2\u05D5\u05DF \u05D4\u05DE\u05E7\u05D1\u05D9\u05DC (\u05E0\u05D3\u05E8\u05E9 \u20665%\u2069 \u05D5\u05DE\u05E2\u05DC\u05D4)`, pass: metrics.revenueGrowth >= 5 });
  rules.push(metrics.netMargin == null ? { id: "profit", label: "\u05E8\u05D5\u05D5\u05D7\u05D9\u05D5\u05EA: \u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05DF", pass: null } : { id: "profit", label: `\u05E8\u05D5\u05D5\u05D7 \u05E0\u05E7\u05D9 \u2066${Math.round(metrics.netMargin * 10) / 10}%\u2069 \u05DE\u05D4\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA${metrics.oneOff ? " (\u05DB\u05D5\u05DC\u05DC \u05E8\u05D5\u05D5\u05D7 \u05D7\u05D3-\u05E4\u05E2\u05DE\u05D9)" : ""}`, pass: metrics.netMargin > 0 });
  if (metrics.epsTTM != null && metrics.epsTTM <= 0) rules.push({ id: "pe", label: "\u05D4\u05E4\u05E1\u05D3 \u05D1-12 \u05D4\u05D7\u05D5\u05D3\u05E9\u05D9\u05DD \u05D4\u05D0\u05D7\u05E8\u05D5\u05E0\u05D9\u05DD", pass: false });
  else if (pe != null) rules.push({ id: "pe", label: `\u05DE\u05DB\u05E4\u05D9\u05DC \u05E8\u05D5\u05D5\u05D7 ${r1(pe)} (\u05E0\u05D3\u05E8\u05E9 \u05E2\u05D3 45)`, pass: pe <= 45 });
  else rules.push({ id: "pe", label: "\u05DE\u05DB\u05E4\u05D9\u05DC \u05E8\u05D5\u05D5\u05D7: \u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05DF", pass: null });
  return rules;
}
__name(screenRules, "screenRules");
var REVENUE_TAGS = ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenuesNetOfInterestExpense"];
async function loadFundamentals(get, ua, cik, price) {
  let revenue = [];
  for (const t of REVENUE_TAGS) {
    const facts = await secConcept(get, ua, cik, t).catch((e) => {
      if (e.status === 404) return [];
      throw e;
    });
    const q = quarters(facts);
    if (q.length && (!revenue.length || q[q.length - 1].end > quarters(revenue).pop().end)) revenue = facts;
    if (q.length && days(q[q.length - 1].end, (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) < 200) break;
  }
  const safe = /* @__PURE__ */ __name((t) => secConcept(get, ua, cik, t).catch((e) => {
    if (e.status === 404) return [];
    throw e;
  }), "safe");
  const [netIncome, opIncome, eps] = [await safe("NetIncomeLoss"), await safe("OperatingIncomeLoss"), await safe("EarningsPerShareDiluted")];
  return fundamentals({ revenue, netIncome, opIncome, eps }, price);
}
__name(loadFundamentals, "loadFundamentals");
async function latest13F(get, ua, cik) {
  const sub = await secSubmissions(get, ua, cik);
  const list = recentFilings(sub, ["13F-HR"]);
  return { name: sub.name, filings: list.slice(0, 2) };
}
__name(latest13F, "latest13F");
async function infoTable(get, ua, cik, acc) {
  const folder = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc.replace(/-/g, "")}`;
  const index = await (await get(`${folder}/index.json`, { headers: secHeaders(ua) })).json();
  const files = (index.directory?.item || []).map((x) => x.name).filter((n) => /\.xml$/i.test(n) && !/primary_doc/i.test(n));
  if (!files.length) throw new SourceError("no information table in the filing", 404);
  const xml = await (await get(`${folder}/${files[0]}`, { headers: secHeaders(ua) })).text();
  return parseInfoTable(xml);
}
__name(infoTable, "infoTable");
function parseInfoTable(xml) {
  const rows = [];
  for (const m of xml.matchAll(/<(?:[\w-]+:)?infoTable\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?infoTable>/gi)) {
    const body = m[1];
    rows.push({
      name: decodeXml(tag(body, "nameOfIssuer")).toUpperCase(),
      cusip: decodeXml(tag(body, "cusip")),
      value: Number(decodeXml(tag(body, "value"))) || 0,
      shares: Number(decodeXml(tag(body, "sshPrnamt"))) || 0,
      type: decodeXml(tag(body, "sshPrnamtType")),
      putCall: decodeXml(tag(body, "putCall"))
    });
  }
  return rows;
}
__name(parseInfoTable, "parseInfoTable");
function holdingsByIssuer(rows) {
  const by = /* @__PURE__ */ new Map();
  let total = 0;
  for (const r of rows) {
    if (r.putCall || r.type === "PRN") continue;
    total += r.value;
    const h = by.get(r.cusip.slice(0, 6) + r.name) || { name: r.name, cusip: r.cusip, value: 0, shares: 0 };
    h.value += r.value;
    h.shares += r.shares;
    by.set(r.cusip.slice(0, 6) + r.name, h);
  }
  return [...by.values()].map((h) => ({ ...h, pct: total ? h.value / total * 100 : 0 })).sort((a, b) => b.value - a.value);
}
__name(holdingsByIssuer, "holdingsByIssuer");
async function houseIndex(get, year) {
  const res = await get(`https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${year}FD.zip`);
  const files = await unzip(new Uint8Array(await res.arrayBuffer()));
  const xmlName = Object.keys(files).find((n) => /\.xml$/i.test(n));
  if (!xmlName) throw new SourceError("no XML in the House index", 404);
  return parseHouseIndex(new TextDecoder().decode(files[xmlName]), year);
}
__name(houseIndex, "houseIndex");
function parseHouseIndex(xml, year) {
  const out = [];
  for (const m of xml.matchAll(/<Member>([\s\S]*?)<\/Member>/gi)) {
    const b = m[1];
    if (decodeXml(tag(b, "FilingType")) !== "P") continue;
    const [mo, d, y] = decodeXml(tag(b, "FilingDate")).split("/").map(Number);
    if (!y) continue;
    const docId = decodeXml(tag(b, "DocID"));
    const name = [decodeXml(tag(b, "Prefix")), decodeXml(tag(b, "First")), decodeXml(tag(b, "Last")), decodeXml(tag(b, "Suffix"))].filter(Boolean).join(" ");
    out.push({
      docId,
      name,
      last: decodeXml(tag(b, "Last")),
      district: decodeXml(tag(b, "StateDst")),
      date: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      url: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${year}/${docId}.pdf`
    });
  }
  return out.sort((a, b) => a.date < b.date ? 1 : -1);
}
__name(parseHouseIndex, "parseHouseIndex");
async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let p2 = bytes.length - 22; p2 >= Math.max(0, bytes.length - 65557); p2--) {
    if (view.getUint32(p2, true) === 101010256) {
      eocd = p2;
      break;
    }
  }
  if (eocd < 0) throw new SourceError("not a zip file", 422);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = {};
  for (let k = 0; k < count; k++) {
    if (view.getUint32(p, true) !== 33639248) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) out[name] = data;
    else if (method === 8) out[name] = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  }
  return out;
}
__name(unzip, "unzip");

// universe.js
var UNIVERSE = [
  ["SPY", "SPDR S&P 500 ETF", null, "etf"],
  ["QQQ", "Invesco QQQ (Nasdaq 100)", null, "etf"],
  ["IWM", "iShares Russell 2000 ETF", null, "etf"],
  ["AAPL", "Apple", "APPLE INC", "tech"],
  ["MSFT", "Microsoft", "MICROSOFT", "tech"],
  ["NVDA", "NVIDIA", "NVIDIA", "tech"],
  ["AMZN", "Amazon", "AMAZON COM", "consumer"],
  ["GOOGL", "Alphabet", "ALPHABET", "tech"],
  ["META", "Meta Platforms", "META PLATFORMS", "tech"],
  ["TSLA", "Tesla", "TESLA", "consumer"],
  ["AVGO", "Broadcom", "BROADCOM", "tech"],
  ["AMD", "AMD", "ADVANCED MICRO", "tech"],
  ["NFLX", "Netflix", "NETFLIX", "media"],
  ["ORCL", "Oracle", "ORACLE", "tech"],
  ["CRM", "Salesforce", "SALESFORCE", "tech"],
  ["ADBE", "Adobe", "ADOBE", "tech"],
  ["INTC", "Intel", "INTEL CORP", "tech"],
  ["QCOM", "Qualcomm", "QUALCOMM", "tech"],
  ["MU", "Micron", "MICRON TECH", "tech"],
  ["PLTR", "Palantir", "PALANTIR", "tech"],
  ["UBER", "Uber", "UBER TECH", "tech"],
  ["SHOP", "Shopify", "SHOPIFY", "tech"],
  ["COIN", "Coinbase", "COINBASE", "finance"],
  ["JPM", "JPMorgan Chase", "JPMORGAN", "finance"],
  ["BAC", "Bank of America", "BANK AMER", "finance"],
  ["GS", "Goldman Sachs", "GOLDMAN SACHS", "finance"],
  ["V", "Visa", "VISA INC", "finance"],
  ["MA", "Mastercard", "MASTERCARD", "finance"],
  ["AXP", "American Express", "AMERICAN EXPRESS", "finance"],
  ["UNH", "UnitedHealth", "UNITEDHEALTH", "health"],
  ["LLY", "Eli Lilly", "LILLY ELI|ELI LILLY", "health"],
  ["JNJ", "Johnson & Johnson", "JOHNSON & JOHNSON", "health"],
  ["MRK", "Merck", "MERCK & CO|MERCK CO", "health"],
  ["ABBV", "AbbVie", "ABBVIE", "health"],
  ["PFE", "Pfizer", "PFIZER", "health"],
  ["COST", "Costco", "COSTCO", "consumer"],
  ["WMT", "Walmart", "WALMART", "consumer"],
  ["HD", "Home Depot", "HOME DEPOT", "consumer"],
  ["MCD", "McDonald's", "MCDONALDS", "consumer"],
  ["NKE", "Nike", "NIKE", "consumer"],
  ["KO", "Coca-Cola", "COCA COLA", "consumer"],
  ["PEP", "PepsiCo", "PEPSICO", "consumer"],
  ["DIS", "Disney", "DISNEY WALT|WALT DISNEY", "media"],
  ["XOM", "Exxon Mobil", "EXXON MOBIL", "energy"],
  ["CVX", "Chevron", "CHEVRON", "energy"],
  ["CAT", "Caterpillar", "CATERPILLAR", "industrial"],
  ["BA", "Boeing", "BOEING", "industrial"],
  ["GE", "GE Aerospace", "GENERAL ELECTRIC|GE AEROSPACE", "industrial"]
].map(([t, name, issuer, sector]) => ({ t, name, issuer, sector }));
var UNIVERSE_TICKERS = UNIVERSE.map((u) => u.t);
var byTicker = Object.fromEntries(UNIVERSE.map((u) => [u.t, u]));
var FUNDS = [
  { cik: 1067983, name: "Berkshire Hathaway", he: "\u05D1\u05E8\u05E7\u05E9\u05D9\u05D9\u05E8", check: "BERKSHIRE" },
  { cik: 1336528, name: "Pershing Square", he: "\u05E4\u05E8\u05E9\u05D9\u05E0\u05D2 \u05E1\u05E7\u05D5\u05D5\u05E8 (\u05D0\u05E7\u05DE\u05DF)", check: "PERSHING" },
  { cik: 1536411, name: "Duquesne", he: "\u05D3\u05D5\u05E7\u05D9\u05D9\u05DF (\u05D3\u05E8\u05D5\u05E7\u05E0\u05DE\u05D9\u05DC\u05E8)", check: "DUQUESNE" },
  { cik: 1656456, name: "Appaloosa", he: "\u05D0\u05E4\u05DC\u05D5\u05E1\u05D4 (\u05D8\u05E4\u05E8)", check: "APPALOOSA" },
  { cik: 1040273, name: "Third Point", he: "\u05EA\u05F3\u05E8\u05D3 \u05E4\u05D5\u05D9\u05E0\u05D8 (\u05DC\u05D5\u05D1)", check: "THIRD POINT" },
  { cik: 1350694, name: "Bridgewater", he: "\u05D1\u05E8\u05D9\u05D3\u05D2\u05F3\u05D5\u05D5\u05D8\u05E8 (\u05D3\u05DC\u05D9\u05D5)", check: "BRIDGEWATER" }
];
var WATCHED_MEMBERS = ["Pelosi"];
function matchIssuer(name) {
  const n = name.toUpperCase().replace(/[.,]/g, "");
  return UNIVERSE.find((u) => u.issuer && u.issuer.split("|").some((prefix) => n.startsWith(prefix)))?.t || null;
}
__name(matchIssuer, "matchIssuer");

// push.js
var enc = new TextEncoder();
var b64u = /* @__PURE__ */ __name((bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64u");
var unb64u = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), (c) => c.charCodeAt(0)), "unb64u");
var concat = /* @__PURE__ */ __name((...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}, "concat");
var PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}
__name(hkdf, "hkdf");
async function encryptPayload(subscription, text) {
  const uaPublic = unb64u(subscription.keys.p256dh);
  const authSecret = unb64u(subscription.keys.auth);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic, cipher);
}
__name(encryptPayload, "encryptPayload");
async function vapidKeys(storage) {
  let saved = await storage.get("vapid");
  if (!saved) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    saved = { privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey), publicKey: b64u(await crypto.subtle.exportKey("raw", pair.publicKey)) };
    await storage.put("vapid", saved);
  }
  return saved;
}
__name(vapidKeys, "vapidKeys");
async function sendPush(subscription, keys, message, sender = fetch) {
  const privateKey = await crypto.subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(subscription.endpoint).origin,
    exp: Math.floor(Date.now() / 1e3) + 12 * 3600,
    sub: "https://tomerzor.github.io/TOMERZOR/mabat/"
  })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(`${header}.${claims}`));
  const res = await sender(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${header}.${claims}.${b64u(sig)}, k=${keys.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: message.ttl ? String(message.ttl) : "3600",
      Urgency: "high",
      Topic: (message.topic || "mabat").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "mabat"
    },
    body: await encryptPayload(subscription, JSON.stringify(message))
  });
  return res.status;
}
__name(sendPush, "sendPush");

// worker.js
var PER_TICK = 8;
var MAX_TRACKED = 90;
var MAX_WATCH = 30;
var MAX_POSITIONS = 30;
var MAX_BODY = 32 * 1024;
var SUBREQUEST_BUDGET = 38;
var MIN = 6e4;
var HOUR = 60 * MIN;
var DAY2 = 24 * HOUR;
var STALE = { open: 4 * MIN, pre: 15 * MIN, post: 10 * MIN, closed: 3 * HOUR };
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
var json = /* @__PURE__ */ __name((data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } }), "json");
var money = /* @__PURE__ */ __name((v) => v == null ? "" : `$${v >= 1e3 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2)}`, "money");
var ageDays = /* @__PURE__ */ __name((date, now) => Math.floor((now - Date.parse(`${date}T12:00:00Z`)) / DAY2), "ageDays");
var isEtf = /* @__PURE__ */ __name((t) => byTicker[t]?.sector === "etf", "isEtf");
function cleanDevice(body) {
  if (!body || typeof body !== "object") throw new Error("bad body");
  const out = {};
  if (body.subscription) {
    const s = body.subscription;
    let host;
    try {
      host = new URL(s.endpoint).hostname;
    } catch {
      throw new Error("bad endpoint");
    }
    if (!s.endpoint.startsWith("https://") || !PUSH_HOSTS.some((re) => re.test(host))) throw new Error("unknown push service");
    if (typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") throw new Error("bad keys");
    out.subscription = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  }
  const p = body.prefs || {};
  out.prefs = {
    entries: p.entries !== false,
    near: p.near === true,
    scope: p.scope === "watch" ? "watch" : "all",
    minScore: Math.min(95, Math.max(50, Math.round(Number(p.minScore) || 70))),
    bell: p.bell === true,
    news: p.news !== false,
    congress: p.congress !== false,
    positions: p.positions !== false
  };
  out.watch = [...new Set((Array.isArray(body.watch) ? body.watch : []).map((t) => String(t).toUpperCase()).filter((t) => TICKER.test(t)))].slice(0, MAX_WATCH);
  out.positions = (Array.isArray(body.positions) ? body.positions : []).slice(0, MAX_POSITIONS).map((x) => ({
    id: String(x.id || "").slice(0, 24),
    t: String(x.t || "").toUpperCase(),
    entry: Number(x.entry),
    stop: x.stop == null || x.stop === "" ? null : Number(x.stop),
    target: x.target == null || x.target === "" ? null : Number(x.target)
  })).filter((x) => x.id && TICKER.test(x.t) && x.entry > 0);
  const sec = typeof body.sec === "string" ? body.sec.trim().slice(0, 120) : "";
  out.sec = /\S+\s+\S+@\S+\.\S+/.test(sec) ? sec : "";
  return out;
}
__name(cleanDevice, "cleanDevice");
var Market = class {
  static {
    __name(this, "Market");
  }
  constructor(ctx, env) {
    this.ctx = ctx;
    this.storage = ctx.storage;
    this.env = env;
    this.peek = /* @__PURE__ */ new Map();
    this.sender = env.UPSTREAM ? (u, init) => fetch(`${env.UPSTREAM}/${u.replace(/^https:\/\//, "")}`, init) : (u, init) => fetch(u, init);
  }
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/health") return json(await this.health());
      if (path === "/board") return json(await this.board(), 200, { "Cache-Control": "public, max-age=15" });
      if (path === "/tick-cron") return json(await this.tick());
      if (path === "/tick" && request.method === "POST") {
        if (!this.env.DEV) return json({ error: "not found" }, 404);
        return json(await this.tick(Number(url.searchParams.get("now")) || Date.now(), true));
      }
      if (path === "/search") {
        const q = (url.searchParams.get("q") || "").trim().slice(0, 40);
        if (!q) return json({ results: [] });
        return json({ results: await yahooSearch(makeFetch(this.env), q) }, 200, { "Cache-Control": "public, max-age=300" });
      }
      let m = path.match(/^\/t\/([A-Za-z0-9.-]{1,10})$/);
      if (m && request.method === "GET") return json(await this.detail(m[1].toUpperCase()), 200, { "Cache-Control": "public, max-age=20" });
      m = path.match(/^\/d\/([A-Za-z0-9_-]{22,43})(\/key|\/test)?$/);
      if (m) return this.device(request, m[1], m[2]);
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: e.message || "error" }, e.status && e.status < 500 ? e.status : 500);
    }
  }
  // ---------- Devices ----------
  async device(request, id, sub) {
    const key = `dev:${id}`;
    if (sub === "/key" && request.method === "GET") return json({ key: (await vapidKeys(this.storage)).publicKey });
    if (sub === "/test" && request.method === "POST") {
      const dev2 = await this.storage.get(key);
      if (!dev2?.subscription) return json({ error: "no subscription" }, 409);
      const status = await sendPush(dev2.subscription, await vapidKeys(this.storage), {
        type: "test",
        title: "\u05DE\u05D1\u05D8",
        body: "\u05DB\u05DB\u05D4 \u05D9\u05D9\u05E8\u05D0\u05D5 \u05D4\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA. \u05D4\u05DB\u05DC \u05E2\u05D5\u05D1\u05D3 \u2713",
        topic: "test"
      }, this.sender);
      return json({ ok: status < 300, status }, status < 300 ? 200 : 502);
    }
    if (sub) return json({ error: "not found" }, 404);
    if (request.method === "GET") {
      const dev2 = await this.storage.get(key);
      return json({ inbox: dev2?.inbox || [], push: !!dev2?.subscription });
    }
    if (request.method === "DELETE") {
      await this.storage.delete(key);
      const ids2 = await this.storage.get("devices") || [];
      await this.storage.put("devices", ids2.filter((x) => x !== id));
      return json({ ok: true });
    }
    if (request.method !== "PUT") return json({ error: "not found" }, 404);
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "too big" }, 413);
    let body;
    try {
      body = cleanDevice(JSON.parse(text));
    } catch (e) {
      return json({ error: e.message }, 400);
    }
    const prev = await this.storage.get(key) || {};
    const dev = { ...prev, ...body, subscription: body.subscription || prev.subscription || null, inbox: prev.inbox || [], seen: Date.now() };
    await this.storage.put(key, dev);
    const ids = await this.storage.get("devices") || [];
    if (!ids.includes(id)) await this.storage.put("devices", [...ids, id].slice(-50));
    return json({ ok: true, inbox: dev.inbox, push: !!dev.subscription });
  }
  async devices() {
    const ids = await this.storage.get("devices") || [];
    if (!ids.length) return [];
    const map = await this.storage.get(ids.map((id) => `dev:${id}`));
    return ids.map((id) => ({ id, ...map.get(`dev:${id}`) || {} })).filter((d) => d.prefs);
  }
  async secAgent(devices) {
    if (this.env.SEC_USER_AGENT) return this.env.SEC_USER_AGENT;
    return devices.filter((d) => d.sec).sort((a, b) => (b.seen || 0) - (a.seen || 0))[0]?.sec || "";
  }
  tracked(devices) {
    const extra = /* @__PURE__ */ new Set();
    for (const d of devices) {
      for (const t of d.watch || []) extra.add(t);
      for (const p of d.positions || []) extra.add(p.t);
    }
    return [.../* @__PURE__ */ new Set([...UNIVERSE_TICKERS, ...extra])].slice(0, MAX_TRACKED);
  }
  // ---------- The scan ----------
  async tick(now = Date.now(), force = false) {
    const last2 = await this.storage.get("tickAt");
    if (!force && last2 && now - last2 < 4e4 && now >= last2) return { skipped: true };
    await this.storage.put("tickAt", now);
    const mkt = marketState(now);
    const counter = { n: 0 };
    const get = makeFetch(this.env, counter);
    const health = await this.storage.get("health") || {};
    const devices = await this.devices();
    const tickers = this.tracked(devices);
    const scan = await this.storage.get("scan") || {};
    const stale = STALE[mkt.session];
    let due = tickers.filter((t) => now - (scan[t] || 0) >= stale).sort((a, b) => (scan[a] || 0) - (scan[b] || 0));
    if (due.includes("SPY")) due = ["SPY", ...due.filter((t) => t !== "SPY")];
    const batch = due.slice(0, PER_TICK);
    const events = [];
    const ring = await this.storage.get("rang") || {};
    const rang = /* @__PURE__ */ __name((key, within) => ring[key] && now - ring[key] < within, "rang");
    const mark = /* @__PURE__ */ __name((key) => {
      ring[key] = now;
    }, "mark");
    const ctxBase = await this.contextBase(now);
    const prevSigs = batch.length ? await this.storage.get(batch.map((t) => `sig:${t}`)) : /* @__PURE__ */ new Map();
    const fresh = {};
    for (const t of batch) {
      try {
        const chart = await yahooChart(get, t);
        const ctx = await this.contextFor(t, ctxBase, chart.bars, mkt, now);
        const sig = this.summarize(t, chart, analyze(chart.bars, ctx), now);
        if (t === "SPY") ctxBase.spy = spyContext(sig);
        await this.storage.put({ [`bars:${t}`]: { meta: chart.meta, bars: packBars(chart.bars.slice(-460)), at: now }, [`sig:${t}`]: sig });
        fresh[t] = sig;
        scan[t] = now;
        health.yahoo = { ok: true, at: now, source: chart.source };
        const prev = prevSigs.get(`sig:${t}`);
        if (prev && sig.status === "enter" && prev.status !== "enter" && !rang(`enter:${t}:${sig.setup}`, 3 * DAY2)) {
          mark(`enter:${t}:${sig.setup}`);
          events.push({
            type: "enter",
            t,
            score: sig.score,
            title: `\u05DB\u05E0\u05D9\u05E1\u05D4: ${t} ${money(sig.price)}`,
            body: `${SETUPS[sig.setup]} \xB7 \u05E6\u05D9\u05D5\u05DF ${sig.score}
\u05E1\u05D8\u05D5\u05E4 ${money(sig.levels.stop)} \xB7 \u05D9\u05E2\u05D3 ${money(sig.levels.target)}`
          });
        } else if (prev && sig.status === "near" && prev.status === "hold" && !rang(`near:${t}`, 2 * DAY2)) {
          mark(`near:${t}`);
          events.push({ type: "near", t, score: sig.score, title: `\u05E7\u05E8\u05D5\u05D1 \u05DC\u05DB\u05E0\u05D9\u05E1\u05D4: ${t}`, body: `\u05D8\u05E8\u05D9\u05D2\u05E8 \u05DE\u05E2\u05DC ${money(sig.levels.trigger)} (\u05E2\u05D5\u05D3 ${sig.levels.distPct}%)` });
        }
      } catch (e) {
        scan[t] = e.status === 404 ? now + DAY2 - stale : now - stale + MIN;
        health.yahoo = { ok: false, at: now, error: e.message };
      }
    }
    if (mkt.open && await this.storage.get("bell") !== mkt.date) {
      await this.storage.put("bell", mkt.date);
      events.push({ type: "bell", title: "\u05D4\u05E4\u05E2\u05DE\u05D5\u05DF \u05E6\u05DC\u05E6\u05DC: \u05D4\u05D1\u05D5\u05E8\u05E1\u05D4 \u05D1\u05E0\u05D9\u05D5 \u05D9\u05D5\u05E8\u05E7 \u05E0\u05E4\u05EA\u05D7\u05D4", body: mkt.earlyClose ? "\u05D4\u05D9\u05D5\u05DD \u05E0\u05E1\u05D2\u05E8\u05D9\u05DD \u05DE\u05D5\u05E7\u05D3\u05DD, \u05D1-13:00 \u05E9\u05E2\u05D5\u05DF \u05E0\u05D9\u05D5 \u05D9\u05D5\u05E8\u05E7" : "\u05D4\u05DE\u05E1\u05D7\u05E8 \u05E4\u05EA\u05D5\u05D7 \u05E2\u05D3 16:00 \u05E9\u05E2\u05D5\u05DF \u05E0\u05D9\u05D5 \u05D9\u05D5\u05E8\u05E7", quiet: true });
    }
    const ua = await this.secAgent(devices);
    health.sec = ua ? health.sec || { ok: null } : { ok: false, error: "needs-contact" };
    const jobs = ["cik", "filings", "news", "fund", "13f", "congress"];
    let cursor = (await this.storage.get("jobCursor") || 0) % jobs.length;
    let ran = 0;
    for (let k = 0; k < jobs.length && ran < 2 && counter.n < SUBREQUEST_BUDGET - 8; k++) {
      const job = jobs[(cursor + k) % jobs.length];
      try {
        const did = await this.job(job, { get, ua, now, mkt, devices, tickers, events, rang, mark, health });
        if (did) ran++;
      } catch (e) {
        const which = job === "news" ? "news" : job === "congress" ? "house" : "sec";
        health[which] = { ok: false, at: now, error: e.message };
      }
      if (ran) cursor = (cursor + k + 1) % jobs.length;
    }
    await this.storage.put("jobCursor", cursor);
    const personal = [];
    for (const d of devices) {
      if (d.prefs?.positions === false) continue;
      for (const p of d.positions || []) {
        const sig = fresh[p.t];
        if (!sig) continue;
        if (p.stop && sig.price <= p.stop && !rang(`pos:${d.id}:${p.id}:stop`, 30 * DAY2)) {
          mark(`pos:${d.id}:${p.id}:stop`);
          personal.push({ dev: d, ev: { type: "stop", t: p.t, title: `${p.t} \u05D4\u05D2\u05D9\u05E2\u05D4 \u05DC\u05E1\u05D8\u05D5\u05E4 ${money(p.stop)}`, body: `\u05D4\u05DE\u05D7\u05D9\u05E8 \u05E2\u05DB\u05E9\u05D9\u05D5 ${money(sig.price)}. \u05D6\u05D5 \u05D4\u05EA\u05E8\u05D0\u05D4 \u05D1\u05DC\u05D1\u05D3: \u05E9\u05D5\u05DD \u05D3\u05D1\u05E8 \u05DC\u05D0 \u05E0\u05DE\u05DB\u05E8.` } });
        }
        if (p.target && sig.price >= p.target && !rang(`pos:${d.id}:${p.id}:target`, 30 * DAY2)) {
          mark(`pos:${d.id}:${p.id}:target`);
          personal.push({ dev: d, ev: { type: "target", t: p.t, title: `${p.t} \u05D4\u05D2\u05D9\u05E2\u05D4 \u05DC\u05D9\u05E2\u05D3 ${money(p.target)}`, body: `\u05D4\u05DE\u05D7\u05D9\u05E8 \u05E2\u05DB\u05E9\u05D9\u05D5 ${money(sig.price)} (\u05DB\u05E0\u05D9\u05E1\u05D4 \u05D1-${money(p.entry)}).` } });
        }
      }
    }
    for (const key of Object.keys(ring)) if (now - ring[key] > 40 * DAY2) delete ring[key];
    await this.storage.put({ scan, health, rang: ring, lastTick: now });
    const stamped = events.map((e, k) => ({ ...e, id: `${now.toString(36)}${k}`, at: now }));
    if (stamped.some((e) => !e.quiet)) {
      const feed = await this.storage.get("feed") || [];
      await this.storage.put("feed", [...stamped.filter((e) => !e.quiet).reverse(), ...feed].slice(0, 150));
    }
    const pushed = await this.deliver(stamped, personal.map((x) => ({ ...x, ev: { ...x.ev, id: `${now.toString(36)}p`, at: now } })), devices, counter);
    return { session: mkt.session, refreshed: Object.keys(fresh), due: due.length, events: stamped.length + personal.length, pushed, subrequests: counter.n };
  }
  async contextBase(now) {
    const [spy, holders] = [await this.storage.get("sig:SPY"), await this.storage.get("holders")];
    return { spy: spy ? spyContext(spy) : null, holders: holders?.byTicker || {}, now };
  }
  async contextFor(t, base, bars, mkt, now) {
    const [fund, filings] = [await this.storage.get(`fund:${t}`), await this.storage.get(`filings:${t}`)];
    const lastDate = nyParts(bars[bars.length - 1].t * 1e3).date;
    let partial = 1;
    if (mkt.open && lastDate === mkt.date) {
      const minutes = nyParts(now).minutes;
      partial = (minutes - 570) / (closeMinutes(mkt.date) - 570);
    }
    const price = bars[bars.length - 1].c;
    return {
      partial,
      spy: t === "SPY" ? null : base.spy,
      fundamentals: fund?.metrics ? { rules: screenRules(fund.metrics, price) } : null,
      holders: base.holders[t] || [],
      filings: (filings?.list || []).map((f) => ({ ...f, ageDays: ageDays(f.date, now) }))
    };
  }
  summarize(t, chart, a, now) {
    const u = byTicker[t];
    return {
      t,
      name: u?.name || chart.meta.name,
      sector: u?.sector || (chart.meta.type === "ETF" ? "etf" : "other"),
      currency: chart.meta.currency,
      exchange: chart.meta.exchange,
      ...a,
      setupName: a.setup ? SETUPS[a.setup] : null,
      spark: chart.bars.slice(-60).map((b) => Math.round(b.c * 100) / 100),
      barTime: chart.meta.time,
      at: now
    };
  }
  // ---------- The slower jobs ----------
  async job(name, s) {
    const { get, ua, now, mkt, devices, tickers, events, rang, mark, health } = s;
    const watched = new Set(devices.flatMap((d) => [...d.watch || [], ...(d.positions || []).map((p) => p.t)]));
    if (name === "cik") {
      if (!ua) return false;
      const map = await this.storage.get("cik");
      if (map && now - map.at < 7 * DAY2 && tickers.every((t) => isEtf(t) || t in map.ciks || (map.missing || []).includes(t))) return false;
      const all = await secTickerMap(get, ua);
      const ciks = {};
      const missing = [];
      for (const t of tickers) if (!isEtf(t)) {
        if (all[t]) ciks[t] = all[t];
        else missing.push(t);
      }
      await this.storage.put("cik", { ciks, missing, at: now });
      health.sec = { ok: true, at: now };
      return true;
    }
    if (name === "filings" || name === "fund") {
      if (!ua) return false;
      const ciks = (await this.storage.get("cik"))?.ciks || {};
      const candidates = tickers.filter((t) => ciks[t]);
      if (!candidates.length) return false;
      const prefix = name === "filings" ? "filings:" : "fund:";
      const stored = await this.storage.get(candidates.map((t) => prefix + t));
      const sigs = await this.storage.get(candidates.map((t) => `sig:${t}`));
      const hot = /* @__PURE__ */ __name((t) => watched.has(t) || ["enter", "near"].includes(sigs.get(`sig:${t}`)?.status), "hot");
      const maxAge = /* @__PURE__ */ __name((t) => name === "fund" ? 7 * DAY2 : hot(t) ? 6 * HOUR : DAY2, "maxAge");
      const pick = candidates.filter((t) => now - (stored.get(prefix + t)?.at || 0) > maxAge(t)).sort((a, b) => hot(b) - hot(a) || (stored.get(prefix + a)?.at || 0) - (stored.get(prefix + b)?.at || 0))[0];
      if (!pick) return false;
      if (name === "fund") {
        const price = sigs.get(`sig:${pick}`)?.price;
        const f = await loadFundamentals(get, ua, ciks[pick], price);
        await this.storage.put(`fund:${pick}`, { ...f, at: now });
      } else {
        const sub = await secSubmissions(get, ua, ciks[pick]);
        const list = recentFilings(sub, ["8-K", "10-Q", "10-K"]).slice(0, 12).map((f) => ({ form: f.form, date: f.date, items: f.items, url: f.url, acc: f.acc }));
        const prev = stored.get(`filings:${pick}`);
        if (prev && watched.has(pick)) {
          const known = new Set((prev.list || []).map((f) => f.acc));
          for (const f of list) {
            const important = f.items.filter((it) => IMPORTANT_ITEMS.has(it));
            if (known.has(f.acc) || f.form !== "8-K" || !important.length || ageDays(f.date, now) > 3 || rang(`8k:${f.acc}`, 30 * DAY2)) continue;
            mark(`8k:${f.acc}`);
            events.push({ type: "filing", t: pick, title: `${pick}: \u05D3\u05D9\u05D5\u05D5\u05D7 \u20668-K\u2069 \u05D7\u05D3\u05E9`, body: important.map((it) => ITEM_NAMES[it] || it).join(", "), url: f.url });
          }
        }
        await this.storage.put(`filings:${pick}`, { list, at: now });
      }
      health.sec = { ok: true, at: now };
      return true;
    }
    if (name === "news") {
      const sigs = await this.storage.get(tickers.map((t) => `sig:${t}`));
      const hot = tickers.filter((t) => watched.has(t) || ["enter", "near"].includes(sigs.get(`sig:${t}`)?.status));
      const list = [.../* @__PURE__ */ new Set([...hot, ...tickers.filter((t) => !isEtf(t))])];
      const stored = await this.storage.get(list.map((t) => `news:${t}`));
      const maxAge = /* @__PURE__ */ __name((t) => hot.includes(t) ? mkt.open ? 30 * MIN : 2 * HOUR : 12 * HOUR, "maxAge");
      const pick = list.find((t) => now - (stored.get(`news:${t}`)?.at || 0) > maxAge(t));
      if (!pick) return false;
      const items = await headlines(get, pick);
      await this.storage.put(`news:${pick}`, { items, at: now });
      health.news = { ok: true, at: now };
      return true;
    }
    if (name === "13f") {
      if (!ua) return false;
      const stored = await this.storage.get(FUNDS.map((f) => `f13:${f.cik}`));
      const fund = FUNDS.filter((f) => now - (stored.get(`f13:${f.cik}`)?.at || 0) > DAY2).sort((a, b) => (stored.get(`f13:${a.cik}`)?.at || 0) - (stored.get(`f13:${b.cik}`)?.at || 0))[0];
      if (!fund) return false;
      const prev = stored.get(`f13:${fund.cik}`);
      const { name: secName, filings } = await latest13F(get, ua, fund.cik);
      if (!String(secName || "").toUpperCase().includes(fund.check)) {
        await this.storage.put(`f13:${fund.cik}`, { at: now, ok: false, error: `CIK ${fund.cik} is ${secName}` });
        return true;
      }
      if (!filings.length) {
        await this.storage.put(`f13:${fund.cik}`, { at: now, ok: false, error: "no 13F-HR" });
        return true;
      }
      if (prev?.ok && prev.acc === filings[0].acc) {
        await this.storage.put(`f13:${fund.cik}`, { ...prev, at: now });
        return true;
      }
      const nowRows = holdingsByIssuer(await infoTable(get, ua, fund.cik, filings[0].acc));
      const beforeRows = filings[1] ? holdingsByIssuer(await infoTable(get, ua, fund.cik, filings[1].acc)) : [];
      const before = new Map(beforeRows.map((h) => [h.cusip.slice(0, 6) + h.name, h]));
      const holdings = nowRows.slice(0, 60).map((h) => {
        const b = before.get(h.cusip.slice(0, 6) + h.name);
        const change = !beforeRows.length ? null : !b ? "new" : h.shares > b.shares * 1.01 ? "added" : h.shares < b.shares * 0.99 ? "trimmed" : "same";
        return { name: h.name, t: matchIssuer(h.name), pct: Math.round(h.pct * 100) / 100, shares: h.shares, change };
      });
      const sold = beforeRows.length ? beforeRows.filter((b) => !nowRows.some((h) => h.cusip.slice(0, 6) + h.name === b.cusip.slice(0, 6) + b.name)).slice(0, 10).map((b) => ({ name: b.name, t: matchIssuer(b.name) })) : [];
      await this.storage.put(`f13:${fund.cik}`, {
        at: now,
        ok: true,
        acc: filings[0].acc,
        period: filings[0].period,
        filed: filings[0].date,
        url: `https://www.sec.gov/Archives/edgar/data/${fund.cik}/${filings[0].acc.replace(/-/g, "")}/`,
        holdings,
        sold
      });
      await this.rebuildHolders();
      health.sec = { ok: true, at: now };
      return true;
    }
    if (name === "congress") {
      const prev = await this.storage.get("congress");
      if (prev && now - prev.at < HOUR) return false;
      const { date } = mkt;
      const year = Number(date.slice(0, 4));
      let list = await houseIndex(get, year).catch((e) => {
        if (e.status === 404) return [];
        throw e;
      });
      if (date.slice(5, 7) === "01") list = [...list, ...await houseIndex(get, year - 1).catch(() => [])];
      const recent = list.filter((x) => ageDays(x.date, now) <= 60);
      if (prev) {
        const seen = new Set(prev.seen || []);
        for (const x of recent) {
          if (seen.has(x.docId) || !WATCHED_MEMBERS.some((m) => x.last.toLowerCase() === m.toLowerCase())) continue;
          if (rang(`ptr:${x.docId}`, 90 * DAY2)) continue;
          mark(`ptr:${x.docId}`);
          events.push({ type: "congress", title: `\u05D3\u05D9\u05D5\u05D5\u05D7 \u05DE\u05E1\u05D7\u05E8 \u05D7\u05D3\u05E9: ${x.name}`, body: `\u05D4\u05D5\u05D2\u05E9 \u05D1-${x.date}. \u05D3\u05D9\u05D5\u05D5\u05D7 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9, \u05E2\u05D3 45 \u05D9\u05D5\u05DD \u05D0\u05D7\u05E8\u05D9 \u05D4\u05E2\u05E1\u05E7\u05D4 \u05E2\u05E6\u05DE\u05D4.`, url: x.url });
        }
      }
      await this.storage.put("congress", { at: now, list: recent.slice(0, 40), seen: recent.map((x) => x.docId) });
      health.house = { ok: true, at: now };
      return true;
    }
    return false;
  }
  async rebuildHolders() {
    const stored = await this.storage.get(FUNDS.map((f) => `f13:${f.cik}`));
    const byTickerMap = {};
    const funds = [];
    for (const f of FUNDS) {
      const d = stored.get(`f13:${f.cik}`);
      if (!d?.ok) continue;
      funds.push({ cik: f.cik, name: f.name, he: f.he, period: d.period, filed: d.filed, url: d.url, top: d.holdings.slice(0, 10), sold: d.sold });
      for (const h of d.holdings) {
        if (!h.t) continue;
        (byTickerMap[h.t] ||= []).push({ fund: f.he, cik: f.cik, pct: h.pct, change: h.change, period: d.period });
      }
    }
    await this.storage.put("holders", { byTicker: byTickerMap, funds, at: Date.now() });
  }
  // ---------- Push ----------
  async deliver(events, personal, devices, counter) {
    let sent = 0;
    const gone = /* @__PURE__ */ new Set();
    const keys = devices.some((d) => d.subscription) ? await vapidKeys(this.storage) : null;
    const inboxes = /* @__PURE__ */ new Map();
    const send = /* @__PURE__ */ __name(async (d, e) => {
      if (!d.subscription || gone.has(d.id) || sent >= 20 || counter.n >= 48) return;
      const status = await sendPush(d.subscription, keys, { type: e.type, t: e.t, title: e.title, body: e.body, id: e.id, url: e.url, topic: `${e.type}${e.t || ""}`.replace(/[^A-Za-z0-9]/g, "") }, this.sender).catch(() => 0);
      counter.n++;
      sent++;
      if (status === 404 || status === 410) gone.add(d.id);
    }, "send");
    for (const e of events) {
      for (const d of devices) {
        const p = d.prefs || {};
        const inWatch = (d.watch || []).includes(e.t) || (d.positions || []).some((x) => x.t === e.t);
        const wants = e.type === "enter" ? p.entries !== false && (inWatch || p.scope !== "watch" && e.score >= (p.minScore || 70)) : e.type === "near" ? p.near && (inWatch || p.scope !== "watch") : e.type === "bell" ? p.bell : e.type === "filing" ? p.news !== false && inWatch : e.type === "congress" ? p.congress !== false : false;
        if (wants) await send(d, e);
      }
    }
    for (const { dev, ev } of personal) {
      await send(dev, ev);
      const list = inboxes.get(dev.id) || [...dev.inbox || []];
      list.unshift(ev);
      inboxes.set(dev.id, list.slice(0, 40));
    }
    for (const d of devices) {
      if (!gone.has(d.id) && !inboxes.has(d.id)) continue;
      const current = await this.storage.get(`dev:${d.id}`);
      if (!current) continue;
      await this.storage.put(`dev:${d.id}`, { ...current, ...gone.has(d.id) ? { subscription: null } : {}, ...inboxes.has(d.id) ? { inbox: inboxes.get(d.id) } : {} });
    }
    return sent;
  }
  // ---------- Reading ----------
  async health() {
    const [lastTick, health, scan] = [await this.storage.get("lastTick"), await this.storage.get("health"), await this.storage.get("scan")];
    return { ok: true, service: "mabat-market", lastTick: lastTick || null, tracked: Object.keys(scan || {}).length, sources: health || {}, market: marketState() };
  }
  async board() {
    const devices = await this.devices();
    const tickers = this.tracked(devices);
    const sigs = await this.storage.get(tickers.map((t) => `sig:${t}`));
    const [feed, holders, congress, health, lastTick] = [await this.storage.get("feed"), await this.storage.get("holders"), await this.storage.get("congress"), await this.storage.get("health"), await this.storage.get("lastTick")];
    const items = [];
    for (const t of tickers) {
      const s = sigs.get(`sig:${t}`);
      if (!s) continue;
      items.push({
        t,
        name: s.name,
        sector: s.sector,
        price: s.price,
        chgPct: s.chgPct,
        score: s.score,
        status: s.status,
        setup: s.setup,
        setupName: s.setupName,
        levels: s.levels,
        trend: s.trend,
        spark: s.spark,
        at: s.at,
        rsi: s.ind?.rsi,
        relVol: s.ind?.relVol,
        fromHigh: s.ind?.fromHigh,
        warnings: s.warnings?.length || 0,
        universe: !!byTicker[t]
      });
    }
    const spy = sigs.get("sig:SPY");
    const qqq = sigs.get("sig:QQQ");
    const regime = /* @__PURE__ */ __name((m) => m ? { price: m.price, chgPct: m.chgPct, trend: m.trend, above200: m.ind?.sma200 ? m.price > m.ind.sma200 : null, ret63: m.ind?.ret63 } : null, "regime");
    return {
      at: Date.now(),
      lastTick: lastTick || null,
      market: marketState(),
      regime: { spy: regime(spy), qqq: regime(qqq) },
      items,
      feed: (feed || []).slice(0, 80),
      funds: holders?.funds || [],
      congress: congress?.list?.slice(0, 30) || [],
      sources: health || {},
      needsSec: !await this.secAgent(devices)
    };
  }
  async detail(t) {
    if (!TICKER.test(t)) throw Object.assign(new Error("bad ticker"), { status: 400 });
    const [barsRec, sig, fund, news, filings, holders] = [
      await this.storage.get(`bars:${t}`),
      await this.storage.get(`sig:${t}`),
      await this.storage.get(`fund:${t}`),
      await this.storage.get(`news:${t}`),
      await this.storage.get(`filings:${t}`),
      await this.storage.get("holders")
    ];
    let bars;
    let analysis = sig;
    let tracked = !!sig;
    if (barsRec && sig) {
      bars = unpackBars(barsRec.bars);
    } else {
      const cached = this.peek.get(t);
      if (cached && Date.now() - cached.at < 5 * MIN) return cached.data;
      const now = Date.now();
      const chart = await yahooChart(makeFetch(this.env), t);
      const ctx = await this.contextFor(t, await this.contextBase(now), chart.bars, marketState(now), now);
      analysis = this.summarize(t, chart, analyze(chart.bars, ctx), now);
      bars = chart.bars.slice(-460);
      tracked = false;
    }
    const data = {
      t,
      tracked,
      sig: analysis,
      bars: packBars(bars),
      series: chartSeries(bars),
      fundamentals: fund ? { metrics: fund.metrics, rules: screenRules(fund.metrics, analysis.price), at: fund.at } : null,
      news: news?.items || [],
      filings: (filings?.list || []).map((f) => ({ ...f, names: f.items.map((it) => ITEM_NAMES[it]).filter(Boolean) })),
      holders: holders?.byTicker?.[t] || []
    };
    if (!tracked) {
      this.peek.set(t, { at: Date.now(), data });
      if (this.peek.size > 40) this.peek.delete(this.peek.keys().next().value);
    }
    return data;
  }
};
function spyContext(sig) {
  return { ret63: sig.ind?.ret63 ?? null, above200: sig.ind?.sma200 ? sig.price > sig.ind.sma200 : null };
}
__name(spyContext, "spyContext");
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (!/^\/(health|board|tick|search|t\/|d\/)/.test(url.pathname) || url.pathname === "/tick-cron") return json({ error: "not found" }, 404);
    const stub = env.MARKET.get(env.MARKET.idFromName("market"));
    return stub.fetch(request);
  },
  async scheduled(event, env, ctx) {
    const stub = env.MARKET.get(env.MARKET.idFromName("market"));
    ctx.waitUntil(stub.fetch("https://market/tick-cron", { method: "POST" }));
  }
};

// ../../../../../tmp/claude-0/-home-user-TOMERZOR/7313a836-9e39-5693-a1a4-a10eed9d6dda/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../tmp/claude-0/-home-user-TOMERZOR/7313a836-9e39-5693-a1a4-a10eed9d6dda/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-KtYZrf/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../../tmp/claude-0/-home-user-TOMERZOR/7313a836-9e39-5693-a1a4-a10eed9d6dda/scratchpad/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-KtYZrf/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Market,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  cleanDevice,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
