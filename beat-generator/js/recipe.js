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
// Freestyle beats loop few chords, so two-chord vamps are on the list on purpose.
const PROGRESSIONS = {
  aeolian:  [[0, 5, 2, 6], [0, 0, 5, 5], [0, 3, 0, 3], [0, 5, 3, 4], [0, 0, 5, 6], [5, 6, 0, 0]],
  dorian:   [[0, 3, 0, 3], [0, 0, 3, 3], [0, 6, 3, 0]],
  phrygian: [[0, 1, 0, 1], [0, 0, 1, 1], [0, 5, 1, 0]],
  harmonic: [[0, 5, 4, 4], [0, 0, 5, 4], [0, 3, 5, 4]],
  hijaz:    [[0, 1, 0, 1], [0, 1, 6, 0], [0, 6, 1, 0], [0, 0, 6, 1]],
  ionian:   [[0, 4, 5, 3], [0, 5, 3, 4], [3, 4, 0, 0], [0, 3, 4, 3], [5, 3, 0, 4]],
  mixo:     [[0, 6, 3, 0], [0, 3, 6, 0], [0, 6, 0, 3]],
  lydian:   [[0, 1, 0, 1], [0, 1, 4, 1], [0, 4, 1, 0]]
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const STYLE_BASE = {
  trap:    { bpm: [122, 146], swing: [0, 0.04],   scale: ["aeolian", "harmonic", "phrygian"], lead: ["piano"], bells: 0.5, reverb: 0.3 },
  drill:   { bpm: [140, 146], swing: [0, 0],      scale: ["harmonic", "aeolian", "phrygian"], lead: ["piano"], bells: 0.25, reverb: 0.3 },
  boombap: { bpm: [84, 95],   swing: [0.12, 0.24], scale: ["aeolian", "dorian"],              lead: ["piano"], bells: 0, reverb: 0.15 },
  lofi:    { bpm: [70, 86],   swing: [0.18, 0.3],  scale: ["dorian", "aeolian"],               lead: ["piano", "vibes"], bells: 0, reverb: 0.3 },
  dembow:  { bpm: [90, 102],  swing: [0, 0.04],    scale: ["aeolian", "dorian"],               lead: ["piano", "harp"], bells: 0.2, reverb: 0.2 }
};

// What each mood changes. Earlier moods in SCALE_PRIORITY win the scale.
const MOOD_FX = {
  dark:       { scale: ["phrygian", "harmonic"], bpm: 0,   bright: -0.3, reverb: 0.1 },
  sad:        { scale: ["aeolian"],              bpm: -4,  bright: -0.1, lead: "piano" },
  happy:      { scale: ["ionian", "mixo"],       bpm: 4,   bright: 0.3 },
  summer:     { scale: ["mixo", "ionian"],       bpm: 4,   bright: 0.3 },
  aggressive: { scale: ["harmonic", "phrygian"], bpm: 6,   dist: 0.55, rolls: 0.25 },
  chill:      { scale: ["dorian"],               bpm: -8,  swing: 0.06, reverb: 0.1, rolls: -0.15 },
  epic:       { scale: ["harmonic"],             bpm: 0,   bells: 1, reverb: 0.15 },
  night:      { scale: ["dorian", "aeolian"],    bpm: -2,  bright: -0.15, reverb: 0.15 },
  rain:       { rain: true, reverb: 0.1, bright: -0.1 },
  vinyl:      { vinyl: true, bright: -0.2 },
  oriental:   { scale: ["hijaz"],                lead: "qanun" },
  dreamy:     { scale: ["dorian", "lydian"],     bpm: -4,  reverb: 0.3, lead: "harp" },
  love:       { scale: ["dorian", "ionian"],     bpm: -2,  lead: "vibes" },
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

// Chord tones of a scale degree as semitones above the key: root, third, fifth and (with sevenths) the seventh.
function chordTones(scaleSteps, degree, sevenths) {
  const count = sevenths ? 4 : 3;
  const tones = [];
  for (let i = 0; i < count; i++) {
    const idx = degree + i * 2;
    tones.push(scaleSteps[idx % 7] + 12 * Math.floor(idx / 7));
  }
  return tones;
}

// Close voicings in one register, each chord moved to the inversion nearest the last one so the hands barely move.
function voiceChords(tonesList, rootPc) {
  let prev = null;
  return tonesList.map((tones) => {
    const pcs = tones.map((t) => (rootPc + t) % 12);
    let best = null;
    for (let inv = 0; inv < pcs.length; inv++) {
      const order = pcs.slice(inv).concat(pcs.slice(0, inv));
      const notes = [];
      let n = 53 + ((order[0] - 53 % 12 + 12) % 12); // start between F3 and E4
      for (const pc of order) {
        while (n % 12 !== pc) n++;
        notes.push(n);
        n++;
      }
      const centre = notes.reduce((a, b) => a + b, 0) / notes.length;
      const cost = prev ? notes.reduce((a, x, i) => a + Math.abs(x - (prev[i] ?? prev[prev.length - 1])), 0) : Math.abs(centre - 62);
      if (!best || cost < best.cost) best = { notes, cost };
    }
    prev = best.notes;
    return best.notes;
  });
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

// Chord parts: [step, velocity, length in steps]. Sustained and soft under the melody, stabs in boom bap.
const CHORD_PARTS = {
  trap: [[[0, 0.32, 16]], [[0, 0.3, 16]]],
  drill: [[[0, 0.3, 16]], [[0, 0.32, 10], [10, 0.26, 6]]],
  boombap: [[[0, 0.5, 4], [10, 0.4, 3]], [[0, 0.5, 6]], [[0, 0.48, 3], [7, 0.4, 3]]],
  lofi: [[[0, 0.36, 16]], [[0, 0.36, 10], [10, 0.3, 6]]],
  dembow: [[[0, 0.36, 3], [3, 0.3, 3], [6, 0.34, 4], [10, 0.3, 3], [12, 0.3, 4]], [[0, 0.34, 6], [6, 0.3, 4], [10, 0.3, 6]]]
};

// Melody motifs: [step, chord tone, length in steps]. Chord tone 0 is the root, 1 the third, 2 the fifth,
// 3 the seventh (or the octave), and 4 and up repeat an octave higher. Every motif only uses tones of the
// chord under it, the way producers build bell and piano loops, so it always fits the harmony.
const MOTIFS = {
  trap: [
    [[0, 4, 2], [2, 2, 2], [4, 1, 2], [6, 2, 2], [8, 4, 2], [10, 2, 2], [12, 1, 2], [14, 0, 2]],
    [[0, 5, 3], [3, 4, 3], [6, 2, 2], [8, 5, 3], [11, 4, 3], [14, 2, 2]],
    [[0, 4, 3], [3, 3, 3], [6, 2, 6], [12, 1, 2], [14, 2, 2]],
    [[0, 4, 2], [2, 2, 2], [4, 4, 2], [6, 2, 2], [8, 5, 2], [10, 2, 2], [12, 4, 2], [14, 1, 2]],
    [[0, 2, 6], [6, 4, 4], [10, 3, 6]]
  ],
  drill: [
    [[0, 4, 3], [3, 4, 3], [6, 3, 4], [10, 4, 2], [12, 2, 4]],
    [[0, 2, 3], [3, 1, 3], [6, 0, 4], [11, 1, 2], [13, 2, 3]],
    [[0, 4, 3], [3, 2, 3], [6, 4, 3], [9, 3, 3], [12, 1, 4]]
  ],
  boombap: [
    [[0, 4, 3], [3, 3, 3], [7, 2, 5], [12, 1, 2], [14, 2, 2]],
    [[2, 5, 2], [4, 4, 2], [6, 2, 6], [14, 1, 2]],
    [[0, 2, 4], [6, 4, 2], [10, 3, 6]]
  ],
  lofi: [
    [[0, 4, 6], [6, 3, 4], [10, 2, 6]],
    [[2, 2, 2], [4, 4, 4], [8, 5, 4], [12, 4, 4]],
    [[0, 5, 4], [4, 4, 2], [6, 2, 8], [14, 3, 2]]
  ],
  dembow: [
    [[0, 2, 2], [3, 2, 2], [6, 4, 2], [8, 2, 2], [11, 1, 2], [14, 0, 2]],
    [[0, 4, 2], [3, 4, 2], [6, 5, 2], [10, 4, 2], [12, 2, 4]]
  ]
};

// Hijaz phrases for the qanun, in scale degrees of the key: they walk down 5-4-3-2-1 through the scale's
// augmented second, which is what makes it sound Middle Eastern. Two bars, repeated.
const HIJAZ_PHRASES = [
  [[[0, 4, 2], [2, 3, 2], [4, 2, 2], [6, 1, 2], [8, 2, 4], [12, 1, 2], [14, 0, 2]], [[0, 0, 3], [3, 1, 3], [6, 2, 2], [8, 3, 4], [12, 2, 2], [14, 1, 2]]],
  [[[0, 2, 3], [3, 1, 3], [6, 0, 2], [8, 1, 2], [10, 2, 2], [12, 3, 4]], [[0, 4, 3], [3, 3, 3], [6, 2, 2], [8, 1, 4], [12, 0, 4]]]
];

function melody(style, lead, chordTonesList, rootPc, rng, scaleSteps) {
  const mel = empty(), vel = empty(), len = empty();
  const humanize = (b, step, base) => {
    const accent = step % 4 === 0 ? 0.1 : 0;
    vel[b][step] = Math.min(0.95, base + accent + (rng.next() - 0.5) * 0.12);
  };
  if (lead === "qanun") {
    const phrase = rng.pick(HIJAZ_PHRASES);
    const tonic = 60 + rootPc + (rootPc > 6 ? -12 : 0) + 12;
    for (let b = 0; b < BARS; b++) {
      phrase[b % 2].forEach(([step, deg, l]) => {
        mel[b][step] = tonic + scaleSteps[deg] - (deg > 4 ? 12 : 0);
        len[b][step] = l;
        humanize(b, step, 0.62);
      });
    }
    return { mel, vel, len };
  }
  const motif = rng.pick(MOTIFS[style]);
  // Phrase: the motif on bars 1-3, then bar 4 keeps only its first half and holds, leaving space.
  const centre = style === "lofi" ? 64 : 67;
  for (let b = 0; b < BARS; b++) {
    const tones = chordTonesList[b];
    // Put this chord's root as near the centre as possible so the line doesn't leap between chords.
    let root = rootPc + tones[0];
    while (root < centre - 9) root += 12;
    while (root >= centre + 3) root -= 12;
    // The chord's tones over three octaves, low to high.
    const ladder = [...new Set([0, 12, 24].flatMap((o) => tones.map((t) => root + t - tones[0] + o)))].sort((a, b) => a - b);
    const notes = b === BARS - 1 ? motif.filter((n) => n[0] < 8) : motif;
    notes.forEach(([step, tone, l], i) => {
      mel[b][step] = ladder[Math.min(tone, ladder.length - 1)];
      len[b][step] = b === BARS - 1 && i === notes.length - 1 ? 16 - step : l;
      humanize(b, step, 0.58);
    });
  }
  return { mel, vel, len };
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
  let lead = rng.pick(base.lead), bells = rng.chance(base.bells), rain = false, vinyl = style === "boombap" || style === "lofi";
  let sevenths = true;
  for (const m of moods) {
    const fx = MOOD_FX[m];
    bpm += fx.bpm || 0;
    swing += fx.swing || 0;
    bright += fx.bright || 0;
    reverb += fx.reverb || 0;
    rolls += fx.rolls || 0;
    if (fx.dist) dist = Math.max(dist, fx.dist);
    if (fx.lead) lead = fx.lead;
    if (fx.bells) bells = true;
    if (fx.rain) rain = true;
    if (fx.vinyl) vinyl = true;
  }
  if (moods.includes("oriental")) lead = "qanun";
  bpm = Math.max(60, Math.min(170, bpm));
  if (scale === "hijaz" || scale === "phrygian") sevenths = false;
  if (lead !== "piano") bells = false;

  const rootPc = rng.int(0, 11);
  const steps = BG.SCALES[scale].steps;
  const degrees = rng.pick(PROGRESSIONS[scale]);
  const tonesList = degrees.map((d) => chordTones(steps, d, sevenths));
  const chordList = voiceChords(tonesList, rootPc);
  const bassRoot = 28 + ((rootPc - 4 + 12) % 12); // E1..D#2, where an 808 sits

  const d = drums(style, rng, rolls);
  const { bass, slide } = bassLine(style, d.kick, degrees, steps, bassRoot, rng);
  const chordHits = empty(), chordLen = empty();
  const part = rng.pick(CHORD_PARTS[style]);
  for (let b = 0; b < BARS; b++) part.forEach(([s, v, l]) => { chordHits[b][s] = v; chordLen[b][s] = l; });
  const mel = melody(style, lead, tonesList, rootPc, rng, steps);

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
    sound: { chords: "piano", lead, bells, dist, reverb: Math.min(0.6, reverb), bright: Math.max(-0.6, Math.min(0.5, bright)), rain, vinyl, style },
    patterns: { kick: d.kick, snare: d.snare, clap: d.clap, hat: d.hat, open: d.open, ghost: d.ghost, bass, slide, chord: chordHits, chordLen, melody: mel.mel, melVel: mel.vel, melLen: mel.len }
  };
};

BG.STEPS = STEPS;
BG.BARS = BARS;
