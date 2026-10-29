"use strict";

// Plays a recipe with Tone.js. Every sound is synthesized, no samples.
// The same builder runs live and inside Tone.Offline, so the downloaded WAV matches what you hear.
window.BG = window.BG || {};

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function chordSynth(type, bright) {
  const cut = 1800 * Math.pow(2, bright * 2);
  let synth, vol, filterFreq = cut;
  if (type === "pad" || type === "strings") {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: type === "strings" ? 28 : 18 },
      envelope: { attack: type === "strings" ? 0.35 : 0.6, decay: 0.4, sustain: 0.7, release: 1.4 }
    });
    vol = type === "strings" ? -20 : -22;
    filterFreq = type === "strings" ? cut * 1.4 : cut;
  } else if (type === "ep") {
    synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1, modulationIndex: 3.2,
      oscillator: { type: "sine" }, modulation: { type: "sine" },
      envelope: { attack: 0.01, decay: 1.6, sustain: 0.35, release: 1.2 },
      modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.15, release: 0.6 }
    });
    vol = -16;
    filterFreq = cut * 1.5;
  } else if (type === "piano") {
    synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3, modulationIndex: 1.4,
      oscillator: { type: "triangle" }, modulation: { type: "sine" },
      envelope: { attack: 0.004, decay: 1.4, sustain: 0.12, release: 0.9 },
      modulationEnvelope: { attack: 0.004, decay: 0.4, sustain: 0, release: 0.4 }
    });
    vol = -15;
    filterFreq = cut * 2;
  } else {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "square4" },
      envelope: { attack: 0.003, decay: 0.22, sustain: 0, release: 0.2 }
    });
    vol = -22;
    filterFreq = cut * 1.6;
  }
  synth.maxPolyphony = 16;
  return { synth, vol, filterFreq };
}

function leadSynth(type) {
  if (type === "bell") {
    return { vol: -20, synth: new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.5, modulationIndex: 9,
      envelope: { attack: 0.001, decay: 1.3, sustain: 0, release: 1.3 },
      modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.5 }
    }) };
  }
  if (type === "oud") return { vol: -8, synth: new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3200, resonance: 0.93 }), mono: true };
  if (type === "pluck") {
    return { vol: -18, synth: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" }, envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.25 }
    }) };
  }
  if (type === "brass") {
    return { vol: -24, synth: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 2, spread: 12 }, envelope: { attack: 0.06, decay: 0.3, sustain: 0.5, release: 0.4 }
    }) };
  }
  if (type === "soft") {
    return { vol: -20, synth: new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" }, envelope: { attack: 0.03, decay: 0.4, sustain: 0.3, release: 0.5 }
    }) };
  }
  return { vol: -17, synth: new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3, modulationIndex: 1.4, oscillator: { type: "triangle" },
    envelope: { attack: 0.004, decay: 1.1, sustain: 0, release: 0.8 },
    modulationEnvelope: { attack: 0.004, decay: 0.3, sustain: 0, release: 0.3 }
  }) };
}

// Creates every instrument for one recipe and connects it to `out`.
BG.buildRig = async function (recipe, out) {
  const nodes = [];
  const keep = (n) => (nodes.push(n), n);
  const snd = recipe.sound;
  const lofi = snd.style === "lofi";

  const comp = keep(new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.01, release: 0.2 }));
  const limiter = keep(new Tone.Limiter(-1));
  const tone = keep(new Tone.Filter({ type: "lowpass", frequency: lofi || snd.vinyl ? 5200 : 18000, rolloff: -12 }));
  const bus = keep(new Tone.Gain(0.85));
  bus.chain(tone, comp, limiter, out);

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

  const kick = keep(new Tone.MembraneSynth({
    pitchDecay: lofi ? 0.03 : 0.045, octaves: lofi ? 4 : 6,
    envelope: { attack: 0.001, decay: lofi ? 0.25 : 0.4, sustain: 0, release: 0.1 }
  }));
  kick.connect(channel(lofi ? -7 : -4));

  const snareCh = channel(lofi ? -14 : -11, 0.12);
  const snareNoise = keep(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: lofi ? 0.12 : 0.17, sustain: 0 } }));
  const snareHp = keep(new Tone.Filter(lofi ? 1200 : 1800, "highpass"));
  snareNoise.chain(snareHp, snareCh);
  const snareBody = keep(new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }));
  snareBody.volume.value = -6;
  snareBody.connect(snareCh);

  const clap = keep(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.11, sustain: 0 } }));
  const clapBp = keep(new Tone.Filter({ type: "bandpass", frequency: 1400, Q: 0.9 }));
  clap.chain(clapBp, channel(-12, 0.15));

  const hat = keep(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }));
  const hatHp = keep(new Tone.Filter(lofi ? 6000 : 7800, "highpass"));
  hat.chain(hatHp, channel(lofi ? -24 : -19, 0, -0.15));
  const openHat = keep(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.24, sustain: 0 } }));
  const openHp = keep(new Tone.Filter(6500, "highpass"));
  openHat.chain(openHp, channel(-24, 0.05, 0.15));

  const is808 = snd.bass === "808";
  const bass = keep(new Tone.MonoSynth({
    oscillator: { type: is808 ? "sine" : "triangle" },
    filter: { type: "lowpass", rolloff: -24, Q: 1 },
    filterEnvelope: { attack: 0.001, decay: 0.2, sustain: 1, release: 0.3, baseFrequency: is808 ? 900 : 380, octaves: 0 },
    envelope: is808 ? { attack: 0.004, decay: 0.5, sustain: 0.75, release: 0.25 } : { attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.15 }
  }));
  const bassCh = channel(is808 ? -6 : -8);
  if (snd.dist > 0) {
    const drive = keep(new Tone.Distortion({ distortion: snd.dist, oversample: "2x", wet: 0.6 }));
    bass.chain(drive, bassCh);
  } else {
    bass.connect(bassCh);
  }

  const ch = chordSynth(snd.chords, snd.bright);
  keep(ch.synth);
  const chordFilter = keep(new Tone.Filter(ch.filterFreq, "lowpass"));
  const chordCh = channel(ch.vol, 0.35 + snd.reverb, 0);
  if (lofi) {
    const wobble = keep(new Tone.Vibrato({ frequency: 0.6, depth: 0.12 }));
    ch.synth.chain(wobble, chordFilter, chordCh);
  } else {
    ch.synth.chain(chordFilter, chordCh);
  }

  let lead = null;
  if (snd.lead) {
    lead = leadSynth(snd.lead);
    keep(lead.synth);
    const delay = keep(new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.25, wet: 0.18 }));
    lead.synth.chain(delay, channel(lead.vol, 0.3 + snd.reverb, 0.1));
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

  return {
    recipe,
    mute: {},
    kick, snareNoise, snareBody, clap, hat, openHat, bass, chords: ch.synth, lead: lead && lead.synth, leadMono: lead && lead.mono, crackle,
    dispose() { nodes.forEach((n) => { try { n.unsync && n.unsync(); n.dispose(); } catch (e) { /* already gone */ } }); }
  };
};

// Plays one 16th-note step of the recipe at `time`.
function playStep(rig, step, time, stepDur) {
  const r = rig.recipe;
  const P = r.patterns;
  const m = rig.mute;
  const bar = Math.floor(step / BG.STEPS) % BG.BARS;
  const s = step % BG.STEPS;
  const t = s % 2 === 1 ? time + r.swing * stepDur : time;

  if (!m.kick && P.kick[bar][s]) rig.kick.triggerAttackRelease(r.sound.style === "lofi" ? 50 : 46, "8n", t, P.kick[bar][s]);
  if (!m.snare) {
    if (P.snare[bar][s]) {
      rig.snareNoise.triggerAttackRelease("16n", t, P.snare[bar][s]);
      rig.snareBody.triggerAttackRelease(185, "16n", t, P.snare[bar][s] * 0.8);
    }
    if (P.ghost[bar][s]) rig.snareNoise.triggerAttackRelease("32n", t, 0.25);
    if (P.clap[bar][s]) {
      rig.clap.triggerAttackRelease("16n", t, 0.9);
      rig.clap.triggerAttackRelease("16n", t + 0.011, 0.7);
      rig.clap.triggerAttackRelease("16n", t + 0.023, 0.8);
    }
  }
  if (!m.hat) {
    const h = P.hat[bar][s];
    if (h >= 2) {
      for (let i = 0; i < h; i++) rig.hat.triggerAttackRelease("64n", t + (i * stepDur) / h, 0.45 + 0.4 * (i / h));
    } else if (h > 0) {
      rig.hat.triggerAttackRelease("32n", t, h);
    }
    if (P.open[bar][s]) rig.openHat.triggerAttackRelease("8n", t, 0.7);
  }
  if (!m.bass && P.bass[bar][s]) {
    // Hold the note until the next one starts.
    let len = 1;
    while (len < 16) {
      const ns = step + len;
      if (P.bass[Math.floor(ns / BG.STEPS) % BG.BARS][ns % BG.STEPS]) break;
      len++;
    }
    const is808 = r.sound.bass === "808";
    const dur = Math.min(len, is808 ? 8 : 3) * stepDur * 0.95;
    rig.bass.portamento = P.slide[bar][s] ? 0.07 : 0;
    rig.bass.triggerAttackRelease(midiHz(P.bass[bar][s]), dur, t, 0.95);
  }
  if (!m.chords && P.chord[bar][s]) {
    const sustain = r.sound.chords === "pluck" ? stepDur * 1.5 : r.sound.chords === "piano" ? stepDur * 6 : stepDur * 15.5;
    rig.chords.triggerAttackRelease(r.chords[bar].map(midiHz), sustain, t, 0.7);
  }
  if (!m.melody && rig.lead && P.melody[bar][s]) {
    rig.lead.triggerAttackRelease(midiHz(P.melody[bar][s]), stepDur * (rig.leadMono ? 2 : 3), t, 0.8);
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
    const next = await BG.buildRig(recipe, this.out);
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

// Renders `bars` bars of the recipe to an AudioBuffer, offline and faster than real time.
BG.renderBuffer = async function (recipe, bars = 8) {
  const seconds = (bars * 4 * 60) / recipe.bpm + 2.5;
  const buffer = await Tone.Offline(async (ctx) => {
    const rig = await BG.buildRig(recipe, ctx.destination);
    const transport = ctx.transport;
    transport.bpm.value = recipe.bpm;
    const total = bars * BG.STEPS;
    transport.scheduleRepeat((time) => {
      const step = Math.round(transport.getTicksAtTime(time) / (transport.PPQ / 4));
      if (step < total) playStep(rig, step, time, 15 / recipe.bpm);
    }, "16n", 0);
    transport.start(0);
    transport.stop(seconds - 2.5 + 0.05);
  }, seconds, 2, 44100);
  return buffer.get();
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
