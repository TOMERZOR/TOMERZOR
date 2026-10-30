// The NYSE clock (from trader-alerts): regular session 9:30 a.m. to 4:00 p.m. New York time,
// closed on weekends and holidays, 1:00 p.m. early closes. Holidays from nyse.com/markets/hours-calendars.

const TZ = 'America/New_York';

const HOLIDAYS = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);
const EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);
const KNOWN_YEARS = new Set([2026, 2027]);

const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;
const EARLY = 13 * 60;
const PRE = 4 * 60;
const POST = 20 * 60;

const pad = n => String(n).padStart(2, '0');

// Wall-clock parts of an instant in New York.
export function nyParts(ms) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second),
  };
}

// The instant of a New York wall-clock time (handles daylight saving without time zone files).
export function nyTime(date, minutes) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let at = guess;
  for (let i = 0; i < 2; i++) {
    const p = nyParts(at);
    const [py, pm, pd] = p.date.split('-').map(Number);
    const shown = Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60);
    at += guess - shown;
  }
  return at;
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const weekday = date => new Date(`${date}T12:00:00Z`).getUTCDay();

export function isTradingDay(date) {
  const w = weekday(date);
  return w !== 0 && w !== 6 && !HOLIDAYS.has(date);
}

export const closeMinutes = date => (EARLY_CLOSE.has(date) ? EARLY : CLOSE);

// session: 'pre' (4:00 to the open), 'open', 'post' (the close to 8:00 p.m.) or 'closed'.
export function marketState(ms = Date.now()) {
  const { date, minutes } = nyParts(ms);
  const trading = isTradingDay(date);
  const close = closeMinutes(date);
  let session = 'closed';
  if (trading) {
    if (minutes >= OPEN && minutes < close) session = 'open';
    else if (minutes >= PRE && minutes < OPEN) session = 'pre';
    else if (minutes >= close && minutes < POST) session = 'post';
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
    open: session === 'open',
    date,
    tradingDay: trading,
    closesAt: session === 'open' ? nyTime(date, close) : null,
    earlyClose: trading && EARLY_CLOSE.has(date),
    nextOpen,
    holidaysKnown: KNOWN_YEARS.has(Number(date.slice(0, 4))),
  };
}

// The New York trading date a daily bar's timestamp belongs to.
export const barDate = sec => nyParts(sec * 1000).date;
