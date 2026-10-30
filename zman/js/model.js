// The time model: the slider scale, how the year is written, when each kind
// of thing on the map is estimated to have appeared, and the sea level.
// No DOM and no map here, so it runs in Node for the tests.

export const MIN_YEAR = -10000;
export const NOW_YEAR = new Date().getFullYear();

// Real satellite imagery (Esri World Imagery Wayback) starts in February 2014.
// Everything before that is reconstructed on top of the earliest photo.
export const FIRST_REAL_YEAR = 2014;

// Fallback when the live Wayback list can't be fetched: one release per year
// (the first of 2014, then the last of each year). [release number, date]
export const WAYBACK_FALLBACK = {
  2014: [10, "2014-02-20"],
  2015: [28163, "2015-12-16"],
  2016: [18966, "2016-12-20"],
  2017: [25521, "2017-11-16"],
  2018: [23448, "2018-12-14"],
  2019: [4756, "2019-12-12"],
  2020: [29260, "2020-12-16"],
  2021: [26120, "2021-12-21"],
  2022: [45134, "2022-12-14"],
  2023: [56102, "2023-12-07"],
  2024: [16453, "2024-12-12"],
  2025: [13192, "2025-12-18"],
  2026: [43291, "2026-10-29"],
};

/** Picks one release per year from Esri's waybackconfig.json. */
export function releasesFromConfig(config) {
  const rows = [];
  for (const [num, item] of Object.entries(config || {})) {
    const m = /(\d{4})-(\d{2})-(\d{2})/.exec(item && item.itemTitle);
    if (m) rows.push([m[0], Number(num)]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const byYear = {};
  for (const [date, num] of rows) {
    const year = Number(date.slice(0, 4));
    // The base year keeps its first release (the oldest photo there is);
    // later years show how the place looked at the end of that year.
    if (year === FIRST_REAL_YEAR && byYear[year]) continue;
    byYear[year] = [num, date];
  }
  return byYear;
}

/** The release to show for a year: that year's, or the closest earlier one. */
export function releaseForYear(year, releases) {
  const years = Object.keys(releases).map(Number).sort((a, b) => a - b);
  if (!years.length) return null;
  let pick = years[0];
  for (const y of years) if (y <= year) pick = y;
  const [num, date] = releases[pick];
  return { year: pick, num, date };
}

// ---------- slider scale ----------
// Logarithmic in "years before now", so the last decade of real photos gets
// a quarter of the slider and 12,000 years still fit.

const SPAN = NOW_YEAR - MIN_YEAR;

export function sliderToYear(t) {
  const clamped = Math.min(1, Math.max(0, t));
  const ago = Math.expm1((1 - clamped) * Math.log1p(SPAN));
  return roundYear(NOW_YEAR - ago);
}

export function yearToSlider(year) {
  const ago = Math.min(SPAN, Math.max(0, NOW_YEAR - year));
  return 1 - Math.log1p(ago) / Math.log1p(SPAN);
}

/** Rounds to a step that suits how far back the year is. */
export function roundYear(year) {
  const ago = NOW_YEAR - year;
  const step = ago > 3000 ? 100 : ago > 1000 ? 50 : ago > 300 ? 10 : 1;
  const rounded = step === 1 ? Math.round(year) : Math.round(year / step) * step;
  return Math.min(NOW_YEAR, Math.max(MIN_YEAR, rounded));
}

// ---------- writing the year ----------
// Negative years are BCE (-500 is 500 BCE). There's no year 0; for an
// estimate that spans millennia the one-year offset doesn't matter.

export function formatYear(year) {
  if (year >= 1) return String(year);
  return `${Math.max(1, -year).toLocaleString("en-US")} לפנה״ס`;
}

const MONTHS_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function caption(year, release) {
  if (year >= FIRST_REAL_YEAR && release) {
    const [y, m] = release.date.split("-").map(Number);
    return `צילום לוויין · ${MONTHS_HE[m - 1]} ${y}`;
  }
  return "שחזור משוער";
}

// ---------- when things appeared ----------
// Each kind of feature gets a curve from a per-feature random number h in
// [0, 1) to an estimated build year, so that at year Y the share of today's
// features already standing roughly follows how fast cities grew.
// [h, year] pairs, h ascending.

export const CURVES = {
  // Buildings: few before 1900, half by ~1965, everything mapped by 2014.
  building: [[0, 1650], [0.03, 1850], [0.1, 1900], [0.25, 1935], [0.45, 1960], [0.65, 1980], [0.82, 1997], [0.93, 2007], [1, 2014]],
  // Whole neighborhoods (residential areas) appear a little before their buildings fill in.
  residential: [[0, 1500], [0.08, 1850], [0.2, 1910], [0.4, 1945], [0.65, 1970], [0.85, 1992], [1, 2012]],
  // Industry, shopping, schools, stadiums and other built-up ground.
  builtup: [[0, 1870], [0.2, 1935], [0.5, 1965], [0.8, 1992], [1, 2012]],
  cemetery: [[0, 800], [0.3, 1800], [0.7, 1930], [1, 2010]],
  // Motorways and trunk roads: the motorway age.
  highway: [[0, 1950], [0.3, 1965], [0.7, 1985], [1, 2012]],
  // Main roads follow old routes, paved over the last two centuries.
  mainroad: [[0, 1600], [0.15, 1850], [0.45, 1925], [0.8, 1965], [1, 2008]],
  // Streets and service roads grow with the buildings.
  street: [[0, 1700], [0.05, 1870], [0.2, 1925], [0.45, 1960], [0.7, 1982], [0.9, 2000], [1, 2013]],
  rail: [[0, 1845], [0.5, 1890], [0.85, 1940], [1, 2012]],
  airport: [[0, 1925], [0.35, 1950], [0.75, 1975], [1, 2010]],
  // Fields replace wild land after farming begins.
  farmland: [[0, -8000], [0.15, -4000], [0.35, -1000], [0.6, 1000], [0.85, 1800], [1, 1960]],
};

// Tall buildings can't be old: the earliest year a building this tall (m) appears.
export const HEIGHT_YEAR = [[12, MIN_YEAR], [20, 1880], [40, 1930], [80, 1960], [150, 1980], [300, 1998]];

/** Plain-JS version of a curve, for tests and the legend. */
export function curveYear(curve, h) {
  if (h <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [h1, y1] = curve[i];
    if (h <= h1) {
      const [h0, y0] = curve[i - 1];
      return y0 + ((h - h0) / (h1 - h0)) * (y1 - y0);
    }
  }
  return curve[curve.length - 1][1];
}

// Build years are grouped into slices, one map layer per slice, so moving the
// slider only changes layer opacities and never re-parses map tiles.
export const SLICES = [MIN_YEAR - 1e6, -3000, -1000, 0, 800, 1300, 1600, 1800, 1870, 1910, 1940, 1960, 1975, 1988, 1998, 2006, 2015];

/**
 * How much of a slice is still unbuilt (covered) at `year`:
 * 1 before the slice starts, 0 once it ends, a linear fade in between.
 */
export function sliceCover(year, index) {
  const a = Math.max(SLICES[index], MIN_YEAR);
  const b = SLICES[index + 1];
  if (year >= b) return 0;
  if (year < a) return 1;
  return (b - year) / (b - a);
}

// ---------- sea level ----------
// Global sea level after the last ice age, in meters (approximate, after
// Lambeck et al. 2014). Before ~4000 BCE coasts stood further out.
const SEA = [[MIN_YEAR, -58], [-9000, -45], [-8000, -33], [-7000, -21], [-6000, -11], [-5000, -4], [-4000, -1], [-3000, 0]];

export function seaLevel(year) {
  if (year <= SEA[0][0]) return SEA[0][1];
  for (let i = 1; i < SEA.length; i++) {
    const [y1, l1] = SEA[i];
    if (year <= y1) {
      const [y0, l0] = SEA[i - 1];
      return l0 + ((year - y0) / (y1 - y0)) * (l1 - l0);
    }
  }
  return 0;
}

// ---------- slider ticks ----------
export const TICKS = [
  { year: MIN_YEAR, label: "10,000 לפנה״ס", wide: false },
  { year: 1, label: "שנה 1", wide: true },
  { year: 1000, label: "1000", wide: true },
  { year: 1800, label: "1800", wide: false },
  { year: 1900, label: "1900", wide: true },
  { year: 1950, label: "1950", wide: false },
  { year: 2000, label: "2000", wide: true },
  { year: FIRST_REAL_YEAR, label: "2014", wide: false },
  { year: NOW_YEAR, label: "היום", wide: false },
];
