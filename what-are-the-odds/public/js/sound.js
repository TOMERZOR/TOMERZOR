// Every sound is synthesized with Web Audio, nothing to download.
// tick(progress): the click of the rolling odds, rising in pitch as it slows down.
// land(): the soft chime when the number settles. correct() / wrong() for the game.

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let ctx = null;
let master = null;
let noise = null;
let on = store.get("odds:sound") !== "off";

function audio() {
  if (!on) return null;
  // before the first tap or key press (a ?q= link rolling on load) the browser won't play
  // anything, and every attempt logs a warning
  if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    // a gentle limiter so fast ticks never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function soundOn() { return on; }
export function setSound(v) {
  on = Boolean(v);
  store.set("odds:sound", on ? "on" : "off");
  if (on) audio();
}

// Call from a tap or key press: browsers only start audio from a gesture.
export function unlock() { audio(); }

function blip(freq, { at = 0, dur = 0.05, gain = 0.3, type = "sine", glide = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function click(gain = 0.25, freq = 3200) {
  const ac = audio();
  if (!ac) return;
  const s = ac.createBufferSource();
  s.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.4;
  const g = ac.createGain();
  g.gain.value = gain;
  s.connect(f).connect(g).connect(master);
  s.start(ac.currentTime);
}

// progress 0..1 (a little past 1 for the very last steps): low and soft at the
// start, higher and brighter near the answer. Each tick is short (about 20ms of
// tone) so that even at 25 a second they stay separate clicks, not a buzz.
export function tick(progress = 0) {
  const p = Math.max(0, Math.min(1.15, progress));
  const freq = 400 * 2 ** (p * 1.65); // about 400 Hz up to 1250 Hz, a touch more at the very end
  click(0.2 + p * 0.12, 2200 + p * 2400);
  blip(freq, { dur: 0.022, gain: 0.17 + p * 0.09, type: "triangle" });
  haptic(4);
}

export function land() {
  blip(1046.5, { dur: 0.5, gain: 0.16 });
  blip(1568, { at: 0.04, dur: 0.6, gain: 0.1 });
  blip(2093, { at: 0.08, dur: 0.7, gain: 0.05 });
  haptic([10, 40, 14]);
}

export function correct() {
  [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => blip(f, { at: i * 0.075, dur: 0.32, gain: 0.14 }));
  haptic([12, 50, 12, 50, 22]);
}

// "You got it wrong": a game-show buzz, two low notes sliding down, with a soft thud.
export function wrong() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const note = (f0, f1, at, dur) => {
    const o = ac.createOscillator();
    const o2 = ac.createOscillator();
    const lp = ac.createBiquadFilter();
    const g = ac.createGain();
    o.type = "sawtooth";
    o2.type = "square";
    o.frequency.setValueAtTime(f0, t + at);
    o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
    o2.frequency.setValueAtTime(f0 * 0.995, t + at);
    o2.frequency.exponentialRampToValueAtTime(f1 * 0.995, t + at + dur);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1400, t + at);
    lp.frequency.exponentialRampToValueAtTime(500, t + at + dur);
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(0.13, t + at + 0.015);
    g.gain.setValueAtTime(0.13, t + at + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(master);
    o.start(t + at); o2.start(t + at);
    o.stop(t + at + dur + 0.05); o2.stop(t + at + dur + 0.05);
  };
  note(196, 174, 0, 0.26);      // G3 sliding down
  note(147, 104, 0.24, 0.52);   // D3 sliding further down
  blip(70, { at: 0.02, dur: 0.18, gain: 0.22, glide: 0.6 }); // the thud
  haptic([30, 60, 50]);
}

// The other player's challenge just paid off: a short bright two-note rise.
export function steal() {
  blip(784, { dur: 0.14, gain: 0.12 });
  blip(1175, { at: 0.1, dur: 0.3, gain: 0.12 });
  haptic([10, 40, 14]);
}

// Moving on to the next card: a quick airy sweep.
export function whoosh() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const len = 0.32;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(500, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + len * 0.8);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  blip(1318.5, { at: 0.12, dur: 0.16, gain: 0.06 });
  haptic([8, 30, 14]);
}

export function tap() {
  click(0.12, 1800);
  haptic(6);
}

export function turnChange() {
  blip(523.3, { dur: 0.12, gain: 0.08 });
  blip(784, { at: 0.07, dur: 0.16, gain: 0.08 });
}

// Haptics: Android vibrates. iPhones ignore vibrate, but Safari 18+ plays the
// system haptic tick when a native switch toggles, so on iOS we flip a hidden one.
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let iosSwitch = null;
let lastHaptic = 0;
function iosTick() {
  if (!iosSwitch) {
    iosSwitch = document.createElement("label");
    iosSwitch.setAttribute("aria-hidden", "true");
    iosSwitch.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  // clicking the label focuses the switch: give focus back, or the keyboard closes mid-typing
  const had = document.activeElement;
  iosSwitch.click();
  if (had && had !== document.activeElement && had !== document.body && had.focus) had.focus({ preventScroll: true });
}
export function haptic(pattern = 6) {
  if (!on) return;
  const now = performance.now();
  if (now - lastHaptic < 30) return;
  lastHaptic = now;
  // browsers only allow vibration after the person has touched the page
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  if (!isIOS) {
    try { navigator.vibrate && navigator.vibrate(pattern); } catch { /* not allowed */ }
    return;
  }
  const pulses = Array.isArray(pattern) ? pattern : [pattern];
  let at = 0;
  pulses.forEach((ms, i) => {
    if (i % 2 === 0) setTimeout(iosTick, at);
    at += ms;
  });
}
