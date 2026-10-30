// Chart indicators over daily bars. Every function returns an array as long as its input, with
// null where there isn't enough history yet.

export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function ema(values, n) {
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

// Wilder's RSI.
export function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d; else loss -= d;
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

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line = closes.map((_, i) => (f[i] == null || s[i] == null ? null : f[i] - s[i]));
  const start = line.findIndex(v => v != null);
  const sig = new Array(closes.length).fill(null);
  if (start >= 0) {
    const tail = ema(line.slice(start), signal);
    tail.forEach((v, i) => { sig[start + i] = v; });
  }
  const hist = line.map((v, i) => (v == null || sig[i] == null ? null : v - sig[i]));
  return { line, signal: sig, hist };
}

// Wilder's average true range.
export function atr(bars, n = 14) {
  const out = new Array(bars.length).fill(null);
  if (bars.length <= n) return out;
  const tr = bars.map((b, i) => (i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c))));
  let prev = tr.slice(1, n + 1).reduce((a, b) => a + b, 0) / n;
  out[n] = prev;
  for (let i = n + 1; i < bars.length; i++) {
    prev = (prev * (n - 1) + tr[i]) / n;
    out[i] = prev;
  }
  return out;
}

export function bollinger(closes, n = 20, k = 2) {
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

// Highest high / lowest low of the n bars before bar i (not including it).
export function priorHigh(bars, i, n) {
  let m = -Infinity;
  for (let j = Math.max(0, i - n); j < i; j++) m = Math.max(m, bars[j].h);
  return Number.isFinite(m) ? m : null;
}

export function priorLow(bars, i, n) {
  let m = Infinity;
  for (let j = Math.max(0, i - n); j < i; j++) m = Math.min(m, bars[j].l);
  return Number.isFinite(m) ? m : null;
}

export const last = arr => arr[arr.length - 1];
export const pct = (a, b) => (b ? (a / b - 1) * 100 : null);
