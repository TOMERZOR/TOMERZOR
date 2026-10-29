"use strict";

// Plays a recipe with Tone.js. Drums, 808 and melodies are real recorded samples (see samples/CREDITS.md);
// only the background pads, the boom bap sub and the vinyl and rain noise are synthesized.
// The same builder runs live and inside Tone.Offline, so the downloaded WAV matches what you hear.
window.BG = window.BG || {};

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const noteName = (m) => ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][m % 12] + (Math.floor(m / 12) - 1);
const noteMidi = (n) => {
  const m = /^([A-G])(s?)(-?\d)$/.exec(n);
  return { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0) + 12 * (Number(m[3]) + 1);
};

// Mix levels in dB, tuned against real freestyle type beats: drums and 808 up front, the loop under them.
BG.LEVELS = { kick: -5, snare: -6, clap: -8, hat: -13, open: -16, ghost: -16, perc: -10, bass808: -20, bassSub: -17, chords: -13, lead: -8, bells: -17, makeup: 9 };
BG.STYLE_LEVELS = {
  lofi: { hat: -14, kick: -4, bassSub: -20, chords: -14, lead: -11, makeup: 10 },
  boombap: { kick: -5, snare: -3, hat: -14, bassSub: -20, lead: -13, chords: -15, makeup: 8.5 }
};

// Song form: a 4-bar intro with just the loop, then a 4-bar breakdown at the end of every 32 bars.
BG.INTRO_BARS = 4;
BG.section = function (absBar) {
  if (absBar < BG.INTRO_BARS) return "intro";
  return (absBar - BG.INTRO_BARS) % 32 >= 28 ? "break" : "main";
};

// Drum kits, by style. Names are files in samples/drums.
BG.KITS = {
  trap:    { kick: "k707a", snare: "s808", clap: "clap808", hat: "hat808", open: "open808", ghost: "rim808", bass: "bass808" },
  drill:   { kick: "k707a", snare: "s707b", clap: "clap808", hat: "hat808", open: "open808", ghost: "rim808", bass: "bass808click" },
  boombap: { kick: "k707a", snare: "snareAcou", clap: "clapAcou", hat: "hatAcou", open: "openAcou", ghost: "snareGhost" },
  lofi:    { kick: "k707b", snare: "sidestick", clap: "clapAcou", hat: "hatAcouSoft", open: "openAcou", ghost: "snareGhost" },
  dembow:  { kick: "k707b", snare: "s808b", clap: "rim808", hat: "shaker", open: "open808", ghost: "rim808", bass: "bass808click" }
};
const DARBUKA = { dum: "darbuka1", tek: "darbuka3", ka: "darbuka5" };
const BASS_808_ROOT = 43; // the tuned 808 samples are a G1

// Pitched instruments: sample folder, the notes as named in the files, and how far the recording sounds above that name.
BG.INSTRUMENTS = {
  piano:   { file: "steinway", notes: ["C2", "Fs2", "C3", "Fs3", "C4", "Fs4", "C5", "Fs5", "C6"], shift: 0, release: 1.2, trim: -3 },
  harp:    { file: "harp", notes: ["C3", "G3", "B3", "F4", "C5", "G5", "B5"], shift: 0, release: 1.2, trim: -4 },
  glock:   { file: "glockenspiel", notes: ["G4", "C5", "G5", "C6", "G6", "C7"], shift: 12, release: 1.2, trim: -7 },
  vibes:   { file: "vibraphone", notes: ["A2", "E3", "B3", "D4", "A4", "E5"], shift: 12, release: 1.2, trim: -3 },
  qanun:   { file: "psaltery_pluck", notes: ["As3", "D4", "C5", "Fs5"], shift: 12, release: 0.8, trim: 0 }
};
// The keys are darkened per style, like a filtered sample.
const KEYS_CUTOFF = { trap: 4200, drill: 3600, boombap: 5000, lofi: 2600, dembow: 6500 };

/* Sample loading. Decoded buffers are shared by live playback and offline rendering. */
const cache = {};
function load(path) {
  if (!cache[path]) cache[path] = Tone.ToneAudioBuffer.fromUrl("samples/" + path).catch((e) => { delete cache[path]; throw e; });
  return cache[path];
}
function samplesFor(recipe) {
  const kit = BG.KITS[recipe.sound.style];
  const files = Object.values(kit).map((n) => `drums/${n}.wav`);
  if (recipe.moods.includes("oriental")) Object.values(DARBUKA).forEach((n) => files.push(`drums/${n}.wav`));
  for (const inst of [recipe.sound.lead, recipe.sound.chords, recipe.sound.bells && "glock"]) {
    const def = BG.INSTRUMENTS[inst];
    if (def) def.notes.forEach((n) => files.push(`keys/${def.file}_${n}.wav`));
  }
  return [...new Set(files)];
}
BG.loadSamples = async function (recipe) {
  const files = samplesFor(recipe);
  const buffers = await Promise.all(files.map(load));
  const out = {};
  files.forEach((f, i) => (out[f] = buffers[i]));
  return out;
};

function sampler(inst, buffers) {
  const def = BG.INSTRUMENTS[inst];
  const urls = {};
  def.notes.forEach((n) => (urls[noteName(noteMidi(n) + def.shift)] = buffers[`keys/${def.file}_${n}.wav`]));
  return new Tone.Sampler({ urls, release: def.release });
}

// Creates every instrument for one recipe and connects it to `out`. `buffers` comes from BG.loadSamples.
BG.buildRig = async function (recipe, out, buffers) {
  const nodes = [];
  const keep = (n) => (nodes.push(n), n);
  const snd = recipe.sound;
  const lofi = snd.style === "lofi";
  const L = Object.assign({}, BG.LEVELS, BG.STYLE_LEVELS[snd.style]);
  const kit = BG.KITS[snd.style];
  const drum = (name) => buffers[`drums/${name}.wav`];

  // Master: glue compression, make-up gain, limiter and a soft clipper so it is as loud as a released beat.
  const comp = keep(new Tone.Compressor({ threshold: -20, ratio: 3.5, attack: 0.006, release: 0.15 }));
  const makeup = keep(new Tone.Gain(Tone.dbToGain(L.makeup)));
  const limiter = keep(new Tone.Limiter(-2));
  const clipper = keep(new Tone.WaveShaper((v) => 0.97 * Math.tanh(1.4 * v) / Math.tanh(1.4), 4096));
  const tone = keep(new Tone.Filter({ type: "lowpass", frequency: lofi ? 9000 : snd.vinyl ? 11000 : 18000, rolloff: -12 }));
  const bus = keep(new Tone.Gain(0.85));
  bus.chain(tone, comp, makeup, limiter, clipper, out);

  const reverb = keep(new Tone.Reverb({ decay: 2.8 + snd.reverb * 4, preDelay: 0.02, wet: 1 }));
  await reverb.ready;
  reverb.connect(bus);

  const channel = (volDb, send = 0, pan = 0) => {
    const ch = keep(new Tone.Channel({ volume: volDb, pan }));
    ch.connect(bus);
    if (send > 0) {
      const s = keep(new Tone.Gain(send));
      ch.connect(s);
      s.connect(reverb);
    }
    return ch;
  };

  // Drums: one buffer per sound, played as one-shots.
  const drumBus = {
    kick: channel(L.kick),
    snare: channel(L.snare, 0.12),
    clap: channel(L.clap, 0.18),
    hat: channel(L.hat, 0, -0.15),
    open: channel(L.open, 0.05, 0.15),
    ghost: channel(L.ghost, 0.08),
    perc: channel(L.perc, 0.1, 0.2)
  };
  if (snd.style === "boombap") {
    // The boom bap snare gets a little grit, like an old sampler.
    const grit = keep(new Tone.Distortion({ distortion: 0.15, wet: 0.35 }));
    grit.connect(drumBus.snare);
    drumBus.snare = grit;
  }

  // 808: the tuned sample, repitched per note, with saturation so phone speakers can hear it.
  let bassOut = null, bassSynth = null;
  if (kit.bass) {
    bassOut = channel(L.bass808);
    const drive = keep(new Tone.Distortion({ distortion: Math.max(0.3, snd.dist), oversample: "2x", wet: 0.3 }));
    const input = keep(new Tone.Gain(1));
    input.chain(drive, bassOut);
    bassOut = input;
  } else {
    bassSynth = keep(new Tone.MonoSynth({
      oscillator: { type: "sine" },
      filter: { type: "lowpass", rolloff: -24, Q: 1 },
      filterEnvelope: { attack: 0.001, decay: 0.2, sustain: 1, release: 0.3, baseFrequency: 400, octaves: 0 },
      envelope: { attack: 0.008, decay: 0.3, sustain: 0.6, release: 0.18 }
    }));
    const drive = keep(new Tone.Distortion({ distortion: 0.3, wet: 0.35 }));
    bassSynth.chain(drive, channel(L.bassSub));
  }

  // Keys: chords and melody are darkened with a filter per style, like a sampled loop, each at its own level.
  const cutoff = KEYS_CUTOFF[snd.style] * Math.pow(2, snd.bright);
  const chords = keep(sampler(snd.chords, buffers));
  const chordLp = keep(new Tone.Filter({ type: "lowpass", frequency: cutoff, rolloff: -24 }));
  const chordHp = keep(new Tone.Filter(160, "highpass"));
  const chordCh = channel(L.chords + BG.INSTRUMENTS[snd.chords].trim, 0.25 + snd.reverb);
  const lead = keep(sampler(snd.lead, buffers));
  const leadLp = keep(new Tone.Filter({ type: "lowpass", frequency: cutoff * 1.3, rolloff: -24 }));
  const delay = keep(new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.2, wet: 0.12 }));
  const leadCh = channel(L.lead + BG.INSTRUMENTS[snd.lead].trim, 0.25 + snd.reverb, 0.1);
  if (lofi) {
    // Lo-fi tape wobble.
    const w1 = keep(new Tone.Vibrato({ frequency: 0.55, depth: 0.08 }));
    const w2 = keep(new Tone.Vibrato({ frequency: 0.55, depth: 0.08 }));
    chords.chain(w1, chordLp, chordHp, chordCh);
    lead.chain(w2, leadLp, delay, leadCh);
  } else {
    chords.chain(chordLp, chordHp, chordCh);
    lead.chain(leadLp, delay, leadCh);
  }

  // Bells: a glockenspiel an octave above the piano melody, quiet, for the dark-bells trap sound.
  let bells = null;
  if (snd.bells) {
    bells = keep(sampler("glock", buffers));
    const bellsLp = keep(new Tone.Filter(7000, "lowpass"));
    bells.chain(bellsLp, channel(L.bells, 0.45 + snd.reverb, -0.2));
  }

  let crackle = null;
  if (snd.vinyl) {
    crackle = keep(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.0005, decay: 0.004, sustain: 0 } }));
    const hp = keep(new Tone.Filter(2500, "highpass"));
    crackle.chain(hp, channel(-26));
    const hiss = keep(new Tone.Noise({ type: "pink", volume: -44 }));
    hiss.connect(bus);
    hiss.sync().start(0);
  }
  if (snd.rain) {
    const rain = keep(new Tone.Noise({ type: "pink", volume: -13 }));
    const lp = keep(new Tone.Filter(2600, "lowpass"));
    const hp = keep(new Tone.Filter(400, "highpass"));
    const sway = keep(new Tone.AutoFilter({ frequency: 0.07, baseFrequency: 900, octaves: 1.5, wet: 0.5 }).start());
    rain.chain(hp, lp, sway, channel(0, 0.2));
    rain.sync().start(0);
  }

  const voices = new Set();
  return {
    recipe,
    mute: {},
    kit, drum, drumBus, bassOut, bassSynth, chords, lead, bells, crackle,
    darbuka: recipe.moods.includes("oriental"),
    voices,
    lastOpen: null,
    lastBass: null,
    dispose() {
      voices.forEach((v) => { try { v.stop(v.src.context.currentTime, 0.05); } catch (e) { /* already stopped */ } });
      nodes.forEach((n) => { try { n.unsync && n.unsync(); n.dispose(); } catch (e) { /* already gone */ } });
    }
  };
};

// Plays a one-shot buffer at `time` on a plain Web Audio source, which Tone connects into the mix.
// (Tone's own one-shot source reports "ended" as soon as a stop is scheduled, which cut sounds off.)
// Returns a voice that can be cut short with a quick fade, for the 808 and open hats.
function hit(rig, buffer, dest, time, gain = 1, rate = 1) {
  if (!buffer) return null;
  const ctx = dest.context.rawContext;
  const src = ctx.createBufferSource();
  src.buffer = buffer.get();
  src.playbackRate.value = rate;
  const amp = ctx.createGain();
  amp.gain.value = gain;
  src.connect(amp);
  Tone.connect(amp, dest);
  src.onended = () => { amp.disconnect(); rig.voices.delete(voice); };
  src.start(time);
  const voice = {
    src,
    stop(at, fade = 0.03) {
      amp.gain.setValueAtTime(gain, at);
      amp.gain.linearRampToValueAtTime(0, at + fade);
      src.stop(at + fade + 0.005);
    }
  };
  rig.voices.add(voice);
  return voice;
}

// Maqsum, the most common Middle Eastern rhythm: dum, tek, ka on the 16th grid.
const MAQSUM = { 0: "dum", 3: "tek", 6: "tek", 8: "dum", 10: "ka", 12: "tek", 14: "ka" };

// Plays one 16th-note step of the recipe at `time`.
function playStep(rig, step, time, stepDur) {
  const r = rig.recipe;
  const P = r.patterns;
  const m = rig.mute;
  const k = rig.kit;
  const B = rig.drumBus;
  const abs = Math.floor(step / BG.STEPS);
  const bar = abs % BG.BARS;
  const s = step % BG.STEPS;
  const t = s % 2 === 1 ? time + r.swing * stepDur : time;
  // Intro: the loop alone. Breakdown: trap and drill drop the drums and 808, the rest drop the hats.
  const sec = BG.section(abs);
  const heavy = r.sound.style === "trap" || r.sound.style === "drill";
  const dropBeat = sec === "intro" || (sec === "break" && heavy);
  const kickOff = m.kick || dropBeat;
  const snareOff = m.snare || dropBeat;
  const hatOff = m.hat || sec === "intro" || (sec === "break" && !heavy);
  const bassOff = m.bass || dropBeat;

  if (!kickOff && P.kick[bar][s]) hit(rig, rig.drum(k.kick), B.kick, t, P.kick[bar][s]);
  if (!snareOff) {
    if (P.snare[bar][s]) hit(rig, rig.drum(k.snare), B.snare, t, P.snare[bar][s]);
    if (P.ghost[bar][s]) hit(rig, rig.drum(k.ghost), B.ghost, t, 0.6);
    if (P.clap[bar][s]) hit(rig, rig.drum(k.clap), B.clap, t, 0.9);
  }
  if (!hatOff) {
    const h = P.hat[bar][s];
    const cutOpen = (at) => { if (rig.lastOpen) { rig.lastOpen.stop(at, 0.02); rig.lastOpen = null; } };
    if (h >= 2) {
      cutOpen(t);
      for (let i = 0; i < h; i++) hit(rig, rig.drum(k.hat), B.hat, t + (i * stepDur) / h, 0.45 + 0.45 * (i / h));
    } else if (h > 0) {
      cutOpen(t);
      hit(rig, rig.drum(k.hat), B.hat, t, h);
    }
    if (P.open[bar][s]) rig.lastOpen = hit(rig, rig.drum(k.open), B.open, t, 0.8);
  }
  if (rig.darbuka && !snareOff && MAQSUM[s]) {
    const kind = MAQSUM[s];
    hit(rig, rig.drum(DARBUKA[kind]), B.perc, t, kind === "ka" ? 0.45 : kind === "tek" ? 0.7 : 0.9);
  }
  if (!bassOff && P.bass[bar][s]) {
    // Hold the note until the next one starts.
    let len = 1;
    while (len < 16) {
      const ns = step + len;
      if (P.bass[Math.floor(ns / BG.STEPS) % BG.BARS][ns % BG.STEPS]) break;
      len++;
    }
    const note = P.bass[bar][s];
    if (rig.bassOut) {
      const rate = Math.pow(2, (note - BASS_808_ROOT) / 12);
      const dur = Math.min(len, 16) * stepDur * 0.97;
      const prev = rig.lastBass;
      const voice = hit(rig, rig.drum(k.bass), rig.bassOut, t, 1, rate);
      if (voice) {
        if (P.slide[bar][s] && prev) {
          // Slide: start at the previous pitch and glide into this one.
          voice.src.playbackRate.setValueAtTime(prev.rate, t);
          voice.src.playbackRate.exponentialRampToValueAtTime(rate, t + 0.08);
        }
        voice.stop(t + dur, 0.04);
        // The 808 is monophonic: a new note cuts the last one.
        if (prev) prev.voice.stop(t, 0.015);
        rig.lastBass = { voice, rate };
      }
    } else {
      rig.bassSynth.triggerAttackRelease(midiHz(note), Math.min(len, 3) * stepDur * 0.95, t, 0.95);
    }
  }
  if (!m.chords && P.chord[bar][s]) {
    rig.chords.triggerAttackRelease(r.chords[bar].map(midiHz), P.chordLen[bar][s] * stepDur, t, P.chord[bar][s]);
  }
  if (!m.melody && P.melody[bar][s]) {
    const note = P.melody[bar][s];
    const dur = P.melLen[bar][s] * stepDur;
    rig.lead.triggerAttackRelease(midiHz(note), dur, t, P.melVel[bar][s]);
    if (rig.bells) rig.bells.triggerAttackRelease(midiHz(note + 12), dur, t, P.melVel[bar][s] * 0.8);
  }
  if (rig.crackle) {
    // Random clicks, kept in order and inside this step so they never land before an earlier one.
    const span = stepDur * (1 - r.swing) * 0.95;
    [Math.random(), Math.random()].sort().forEach((x) => {
      if (Math.random() < 0.35) rig.crackle.triggerAttackRelease("128n", time + x * span, 0.2 + Math.random() * 0.6);
    });
  }
}

// Live playback: one transport, a rig that can be swapped while it plays.
BG.Player = class {
  constructor() {
    this.rig = null;
    this.onStep = null;
    this.out = new Tone.Gain(1).toDestination();
    this.transport = Tone.getTransport();
    this.draw = Tone.getDraw();
    this.eventId = null;
  }

  get playing() { return this._on === true; }

  async load(recipe) {
    const buffers = await BG.loadSamples(recipe);
    const next = await BG.buildRig(recipe, this.out, buffers);
    if (this.rig) next.mute = this.rig.mute;
    const old = this.rig;
    this.rig = next;
    this.transport.bpm.value = recipe.bpm;
    if (old) setTimeout(() => old.dispose(), 2500);
    if (this.eventId === null) {
      const transport = this.transport;
      const draw = this.draw;
      this.eventId = transport.scheduleRepeat((time) => {
        const step = Math.round(transport.getTicksAtTime(time) / (transport.PPQ / 4));
        const stepDur = 15 / transport.bpm.value;
        playStep(this.rig, step, time, stepDur);
        if (this.onStep) draw.schedule(() => this.onStep(step), time);
      }, "16n", 0);
    }
  }

  start() { this._on = true; this.transport.position = 0; this.transport.start("+0.05"); }
  stop() { this._on = false; this.transport.stop(); }
  setBpm(bpm) { this.transport.bpm.value = bpm; if (this.rig) this.rig.recipe.bpm = bpm; }
};

// Renders 4 bars starting at `startBar`, plus a tail so reverb and 808s can ring out.
const TAIL = 3;
async function renderSection(recipe, startBar, buffers) {
  const barSec = 240 / recipe.bpm;
  const seconds = BG.BARS * barSec + TAIL;
  const buffer = await Tone.Offline(async (ctx) => {
    const rig = await BG.buildRig(recipe, ctx.destination, buffers);
    const transport = ctx.transport;
    transport.bpm.value = recipe.bpm;
    const total = BG.BARS * BG.STEPS;
    transport.scheduleRepeat((time) => {
      const step = Math.round(transport.getTicksAtTime(time) / (transport.PPQ / 4));
      if (step < total) playStep(rig, step + startBar * BG.STEPS, time, 15 / recipe.bpm);
    }, "16n", 0);
    transport.start(0);
    transport.stop(BG.BARS * barSec);
  }, seconds, 2, 44100);
  return buffer.get();
}

// A full beat of about `minSeconds`: intro, main loops with a breakdown every 32 bars, ending on a main loop.
// The loop repeats exactly, so each section is rendered once and copied, which keeps the download fast.
BG.renderSong = async function (recipe, minSeconds = 120) {
  const buffers = await BG.loadSamples(recipe);
  const barSec = 240 / recipe.bpm;
  const sections = { intro: 0, main: BG.INTRO_BARS, break: BG.INTRO_BARS + 28 };
  const plan = ["intro"];
  let bars = BG.INTRO_BARS;
  while (bars * barSec < minSeconds || BG.section(bars - 1) !== "main") {
    plan.push(BG.section(bars));
    bars += BG.BARS;
  }
  const rendered = {};
  for (const name of new Set(plan)) rendered[name] = await renderSection(recipe, sections[name], buffers);
  const rate = rendered.intro.sampleRate;
  const segLen = Math.round(BG.BARS * barSec * rate);
  const length = segLen * plan.length + Math.round(TAIL * rate);
  const channels = [new Float32Array(length), new Float32Array(length)];
  plan.forEach((name, i) => {
    const buf = rendered[name];
    for (let c = 0; c < 2; c++) {
      const src = buf.getChannelData(c);
      const dst = channels[c];
      const off = i * segLen;
      for (let j = 0; j < src.length && off + j < length; j++) dst[off + j] += src[j];
    }
  });
  return { numberOfChannels: 2, length, sampleRate: rate, getChannelData: (c) => channels[c], seconds: length / rate };
};

BG.encodeWav = function (audioBuffer) {
  const ch = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const rate = audioBuffer.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); data.setUint32(4, 36 + len * ch * 2, true); str(8, "WAVE");
  str(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, "data"); data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => audioBuffer.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data], { type: "audio/wav" });
};
