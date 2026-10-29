"use strict";

// Builds a beat "recipe" from parsed keywords: tempo, key, chords and a 4-bar pattern for every track.
// The same text and variation number always give the same beat, so a link can reproduce it.
window.BG = window.BG || {};

const STEPS = 16;
const BARS = 4;

function hashString(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p) => next() < p,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)]
  };
}

BG.SCALES = {
  aeolian:  { label: "מינור",        steps: [0, 2, 3, 5, 7, 8, 10] },
  dorian:   { label: "דורי",         steps: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { label: "פריגי",        steps: [0, 1, 3, 5, 7, 8, 10] },
  harmonic: { label: "מינור הרמוני", steps: [0, 2, 3, 5, 7, 8, 11] },
  hijaz:    { label: "חיג'אז",       steps: [0, 1, 4, 5, 7, 8, 10] },
  ionian:   { label: "מז'ור",        steps: [0, 2, 4, 5, 7, 9, 11] },
  mixo:     { label: "מיקסולידי",    steps: [0, 2, 4, 5, 7, 9, 10] },
  lydian:   { label: "לידי",         steps: [0, 2, 4, 6, 7, 9, 11] }
};

// Chord progressions as scale degrees (0 = the key's own chord), one chord per bar.
const PROGRESSIONS = {
  aeolian:  [[0, 5, 2, 6], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 6], [0, 0, 5, 5], [0, 3, 0, 5]],
  dorian:   [[0, 3, 0, 3], [0, 6, 3, 0], [0, 3, 4, 3], [0, 1, 3, 0]],
  phrygian: [[0, 1, 0, 1], [0, 1, 6, 0], [0, 6, 1, 0], [0, 0, 1, 6]],
  harmonic: [[0, 5, 4, 4], [0, 3, 4, 0], [0, 5, 3, 4], [0, 1, 4, 0]],
  hijaz:    [[0, 1, 0, 1], [0, 1, 6, 0], [0, 6, 1, 0], [0, 0, 6, 1]],
  ionian:   [[0, 4, 5, 3], [0, 5, 3, 4], [3, 4, 0, 0], [0, 3, 4, 3], [5, 3, 0, 4]],
  mixo:     [[0, 6, 3, 0], [0, 3, 6, 0], [0, 6, 0, 3]],
  lydian:   [[0, 1, 0, 1], [0, 1, 4, 1], [0, 4, 1, 0]]
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const STYLE_BASE = {
  trap:    { bpm: [122, 146], swing: [0, 0.04],   scale: ["aeolian", "harmonic", "phrygian"], chords: ["pad", "piano"], lead: ["glock", "piano", "vibes"], reverb: 0.25 },
  drill:   { bpm: [140, 146], swing: [0, 0],      scale: ["harmonic", "aeolian", "phrygian"], chords: ["strings"], lead: ["piano", "vibes"], reverb: 0.25 },
  boombap: { bpm: [84, 95],   swing: [0.12, 0.24], scale: ["aeolian", "dorian"],              chords: ["piano"], lead: ["piano", "vibes"], reverb: 0.15 },
  lofi:    { bpm: [70, 86],   swing: [0.18, 0.3],  scale: ["dorian", "aeolian", "ionian"],     chords: ["ep"], lead: ["kalimba", "vibes"], reverb: 0.3 },
  dembow:  { bpm: [90, 102],  swing: [0, 0.04],    scale: ["aeolian", "dorian", "mixo"],       chords: ["harp", "ep"], lead: ["kalimba", "harp"], reverb: 0.2 }
};

// What each mood changes. Earlier moods in SCALE_PRIORITY win the scale.
const MOOD_FX = {
  dark:       { scale: ["phrygian", "harmonic"], bpm: 0,   bright: -0.3, reverb: 0.1 },
  sad:        { scale: ["aeolian"],              bpm: -4,  bright: -0.1, chords: "piano", lead: "piano" },
  happy:      { scale: ["ionian", "mixo"],       bpm: 4,   bright: 0.3,  lead: "kalimba" },
  summer:     { scale: ["mixo", "ionian"],       bpm: 4,   bright: 0.3 },
  aggressive: { scale: ["harmonic", "phrygian"], bpm: 6,   dist: 0.55, rolls: 0.25 },
  chill:      { scale: ["dorian"],               bpm: -8,  swing: 0.06, reverb: 0.1, rolls: -0.15 },
  epic:       { scale: ["harmonic"],             bpm: 0,   chords: "strings", lead: "harp", reverb: 0.15 },
  night:      { scale: ["dorian", "aeolian"],    bpm: -2,  bright: -0.15, reverb: 0.15 },
  rain:       { rain: true, reverb: 0.1, bright: -0.1 },
  vinyl:      { vinyl: true, bright: -0.2 },
  oriental:   { scale: ["hijaz"],                lead: "qanun" },
  dreamy:     { scale: ["lydian", "dorian"],     bpm: -4,  reverb: 0.3, chords: "pad", lead: "harp", sevenths: true },
  love:       { scale: ["ionian", "dorian"],     bpm: -2,  chords: "ep", lead: "vibes", sevenths: true },
  fast:       { bpm: 12, rolls: 0.15 },
  slow:       { bpm: -10 }
};
const SCALE_PRIORITY = ["oriental", "dark", "epic", "aggressive", "sad", "love", "happy", "summer", "dreamy", "chill", "night"];

// When no style word is given, moods vote for one.
const STYLE_VOTES = {
  lofi: ["chill", "rain", "vinyl", "dreamy", "love"],
  boombap: ["vinyl", "sad"],
  drill: ["aggressive", "dark", "night"],
  trap: ["dark", "epic", "night", "sad", "aggressive", "fast"],
  dembow: ["happy", "summer", "love", "oriental"]
};

function empty() { return Array.from({ length: BARS }, () => new Array(STEPS).fill(0)); }
function fromSteps(list, v = 1) { const a = new Array(STEPS).fill(0); list.forEach((s) => (a[s] = v)); return a; }

function drums(style, rng, rolls) {
  const kick = empty(), snare = empty(), clap = empty(), hat = empty(), open = empty(), ghost = empty();
  let base;
  for (let b = 0; b < BARS; b++) {
    const fill = b === BARS - 1;
    if (style === "trap") {
      base = base || rng.pick([[0, 3, 10], [0, 7, 10], [0, 6, 10, 11], [0, 10, 13], [0, 3, 7, 10]]);
      let k = base.slice();
      if (b % 2 === 1 && rng.chance(0.5)) k.push(rng.pick([14, 15]));
      if (fill && rng.chance(0.5)) k = k.filter((s) => s < 12);
      kick[b] = fromSteps(k);
      clap[b] = fromSteps([8]);
      snare[b] = fromSteps(fill && rng.chance(0.6) ? [8, 15] : [8]);
      const sixteenths = rng.chance(0.25);
      for (let s = 0; s < STEPS; s++) if (sixteenths || s % 2 === 0) hat[b][s] = s % 4 === 0 ? 1 : 0.7;
      const nRolls = Math.max(0, Math.round((b % 2 ? 2 : 1) + rolls * 6 + (fill ? 1 : 0)));
      for (let i = 0; i < nRolls; i++) hat[b][rng.int(2, 15)] = rng.pick([2, 3, 3, 4]);
      if (rng.chance(0.35)) open[b][rng.pick([6, 14])] = 1;
    } else if (style === "drill") {
      base = base || rng.pick([[0, 10], [0, 11], [0, 6, 10], [0, 3, 11]]);
      kick[b] = fromSteps(base);
      snare[b] = fromSteps(b % 2 === 1 ? [8, 13] : [8]);
      clap[b] = fromSteps([8]);
      [0, 3, 6, 8, 11, 14].forEach((s) => (hat[b][s] = s % 8 === 0 ? 1 : 0.75));
      const nRolls = Math.max(0, Math.round(1 + rolls * 5 + (fill ? 1 : 0)));
      for (let i = 0; i < nRolls; i++) hat[b][rng.pick([3, 6, 11, 14])] = 3;
    } else if (style === "boombap") {
      base = base || rng.pick([[0, 10], [0, 7, 10], [0, 3, 10], [0, 6, 9]]);
      let k = base.slice();
      if (b % 2 === 1 && rng.chance(0.6)) k.push(rng.pick([11, 13, 15]));
      kick[b] = fromSteps(k);
      snare[b] = fromSteps([4, 12]);
      if (rng.chance(0.5)) ghost[b][rng.pick([7, 15])] = 1;
      for (let s = 0; s < STEPS; s += 2) hat[b][s] = s % 4 === 0 ? 0.9 : 0.6;
      if (fill || rng.chance(0.25)) open[b][14] = 1;
    } else if (style === "lofi") {
      base = base || rng.pick([[0, 10], [0, 7, 10], [0, 9], [0, 3, 10]]);
      kick[b] = fromSteps(base, 0.85);
      snare[b] = fromSteps([4, 12], 0.8);
      for (let s = 0; s < STEPS; s += 2) hat[b][s] = s % 4 === 0 ? 0.6 : 0.4;
      if (rng.chance(0.4)) hat[b][rng.pick([7, 11, 15])] = 0.35;
      if (fill && rng.chance(0.5)) ghost[b][15] = 1;
    } else {
      kick[b] = fromSteps([0, 4, 8, 12]);
      snare[b] = fromSteps([3, 6, 11, 14]);
      clap[b] = fromSteps(rng.chance(0.5) ? [6, 14] : []);
      for (let s = 0; s < STEPS; s++) hat[b][s] = s % 2 === 0 ? 0.8 : 0.45;
      if (fill) open[b][15] = 1;
    }
  }
  return { kick, snare, clap, hat, open, ghost };
}

function chordNotes(scaleSteps, rootPc, degree, octaveBase, sevenths) {
  const notes = [];
  const count = sevenths ? 4 : 3;
  for (let i = 0; i < count; i++) {
    const idx = degree + i * 2;
    const st = scaleSteps[idx % 7] + 12 * Math.floor(idx / 7);
    notes.push(octaveBase + rootPc + st);
  }
  // Keep voicings in one register so chord changes don't jump around.
  return notes.map((n) => (n > octaveBase + 19 ? n - 12 : n)).sort((a, b) => a - b);
}

function bassLine(style, kick, degrees, scaleSteps, bassRoot, rng) {
  const bass = empty();
  const slide = empty();
  for (let b = 0; b < BARS; b++) {
    const root = bassRoot + scaleSteps[degrees[b] % 7] - (scaleSteps[degrees[b] % 7] > 7 ? 12 : 0);
    for (let s = 0; s < STEPS; s++) {
      if (style === "dembow") {
        if ([0, 3, 8, 11].includes(s)) bass[b][s] = root;
        continue;
      }
      if (!kick[b][s]) continue;
      let note = root;
      if (s > 0 && rng.chance(style === "drill" ? 0.45 : 0.18)) note = root + rng.pick([12, 7, -5, 3]);
      bass[b][s] = note;
      if (style === "drill" && s > 0 && rng.chance(0.5)) slide[b][s] = 1;
      if (style === "trap" && s > 0 && rng.chance(0.2)) slide[b][s] = 1;
    }
  }
  return { bass, slide };
}

function chordRhythm(type, rng) {
  if (type === "harp") return rng.pick([[0, 3, 6, 10, 12], [0, 3, 6, 8, 11, 14], [0, 6, 10]]);
  if (type === "piano") return rng.pick([[0], [0, 10], [0, 7], [0, 3]]);
  return [0];
}

function melody(lead, degrees, scaleSteps, rootPc, rng, density) {
  const mel = empty();
  if (!lead) return mel;
  const octave = lead === "glock" ? 72 : lead === "qanun" ? 62 : 60;
  // One two-bar motif: rhythm plus scale offsets from each bar's chord, repeated with a changed ending.
  const rhythm = [];
  for (let s = 0; s < STEPS * 2; s++) {
    const strong = s % 4 === 0 ? 0.55 : s % 2 === 0 ? 0.3 : 0.12;
    if (rng.chance(strong * density)) rhythm.push(s);
  }
  if (!rhythm.length) rhythm.push(0, 6, 10);
  let walk = 0;
  const contour = rhythm.map(() => (walk = Math.max(-2, Math.min(7, walk + rng.pick([-2, -1, 0, 1, 1, 2, 4])))));
  const alt = contour.map((c, i) => (i >= contour.length - 2 ? c + rng.pick([-1, 1, 2]) : c));
  for (let half = 0; half < 2; half++) {
    const cont = half === 0 ? contour : alt;
    rhythm.forEach((s, i) => {
      const b = half * 2 + Math.floor(s / STEPS);
      const deg = degrees[b] + cont[i];
      const pc = scaleSteps[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
      mel[b][s % STEPS] = octave + rootPc + pc;
    });
  }
  return mel;
}

BG.makeRecipe = function (parsed, variation = 0) {
  const seedText = parsed.text || "";
  const rng = makeRng(hashString(seedText + "|" + variation));
  const moods = parsed.moods;

  let style = parsed.styles.length ? parsed.styles[variation % parsed.styles.length] : null;
  if (!style) {
    const scores = { trap: 0.5, drill: 0, boombap: 0, lofi: 0, dembow: 0 };
    for (const [st, list] of Object.entries(STYLE_VOTES)) moods.forEach((m) => list.includes(m) && (scores[st] += 1));
    const best = Math.max(...Object.values(scores));
    const top = Object.keys(scores).filter((k) => scores[k] === best);
    style = moods.length ? rng.pick(top) : rng.pick(Object.keys(scores));
  }
  const base = STYLE_BASE[style];

  let scale = rng.pick(base.scale);
  const scaleMood = SCALE_PRIORITY.find((m) => moods.includes(m) && MOOD_FX[m].scale);
  if (scaleMood) scale = rng.pick(MOOD_FX[scaleMood].scale);

  let bpm = rng.int(base.bpm[0], base.bpm[1]);
  let swing = base.swing[0] + rng.next() * (base.swing[1] - base.swing[0]);
  let bright = 0, reverb = base.reverb, dist = style === "drill" || style === "trap" ? 0.2 : 0, rolls = 0;
  let chords = rng.pick(base.chords), lead = rng.pick(base.lead), sevenths = style === "lofi", rain = false, vinyl = style === "boombap" || style === "lofi";
  for (const m of moods) {
    const fx = MOOD_FX[m];
    bpm += fx.bpm || 0;
    swing += fx.swing || 0;
    bright += fx.bright || 0;
    reverb += fx.reverb || 0;
    rolls += fx.rolls || 0;
    if (fx.dist) dist = Math.max(dist, fx.dist);
    if (fx.chords) chords = fx.chords;
    if (fx.lead) lead = fx.lead;
    if (fx.sevenths) sevenths = true;
    if (fx.rain) rain = true;
    if (fx.vinyl) vinyl = true;
  }
  if (moods.includes("oriental")) lead = "qanun";
  bpm = Math.max(60, Math.min(170, bpm));
  if (style === "lofi" && (chords === "pad" || chords === "strings")) chords = "ep";
  if (scale === "hijaz") sevenths = false;

  const rootPc = rng.int(0, 11);
  const steps = BG.SCALES[scale].steps;
  const degrees = rng.pick(PROGRESSIONS[scale]);
  const chordOct = 52;
  const chordList = degrees.map((d) => chordNotes(steps, rootPc, d, chordOct, sevenths));
  const bassRoot = 28 + ((rootPc - 4 + 12) % 12); // E1..D#2, where an 808 sits

  const d = drums(style, rng, rolls);
  const { bass, slide } = bassLine(style, d.kick, degrees, steps, bassRoot, rng);
  const chordHits = empty();
  const rhythm = chordRhythm(chords, rng);
  for (let b = 0; b < BARS; b++) rhythm.forEach((s) => (chordHits[b][s] = 1));
  const density = style === "lofi" ? 0.6 : style === "boombap" ? 0.7 : 1;
  const mel = melody(lead, degrees, steps, rootPc, rng, density);

  return {
    version: 1,
    text: seedText,
    variation,
    style,
    styleLabel: BG.STYLES[style].label,
    moods,
    bpm,
    swing: Math.max(0, Math.min(0.33, swing)),
    rootPc,
    keyLabel: NOTE_NAMES[rootPc] + " " + BG.SCALES[scale].label,
    scale,
    chords: chordList,
    sound: { chords, lead, dist, reverb: Math.min(0.6, reverb), bright: Math.max(-0.6, Math.min(0.5, bright)), rain, vinyl, style },
    patterns: { kick: d.kick, snare: d.snare, clap: d.clap, hat: d.hat, open: d.open, ghost: d.ghost, bass, slide, chord: chordHits, melody: mel }
  };
};

BG.STEPS = STEPS;
BG.BARS = BARS;
