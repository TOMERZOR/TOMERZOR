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
  s.start();
}

// progress 0..1: low and soft at the start, higher and brighter near the answer
export function tick(progress = 0) {
  const p = Math.max(0, Math.min(1, progress));
  const freq = 380 * 2 ** (p * 1.7); // about 380 Hz up to 1240 Hz
  click(0.16 + p * 0.12, 2400 + p * 2600);
  blip(freq, { dur: 0.045, gain: 0.12 + p * 0.1, type: "triangle" });
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

export function wrong() {
  blip(311, { dur: 0.22, gain: 0.16, type: "triangle", glide: 0.8 });
  blip(233, { at: 0.12, dur: 0.34, gain: 0.16, type: "triangle", glide: 0.75 });
  haptic([20, 60, 20]);
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
  iosSwitch.click();
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
