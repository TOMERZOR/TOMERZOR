// Feel the hits: phone vibration and gamepad rumble.
// Android has the Vibration API. iPhone Safari has none, but since iOS 18
// toggling a hidden <input type="checkbox" switch> plays the system's light tap,
// so on iPhone every pulse becomes one such tap (same trick as achori/js/haptics.js).

const PATTERNS = {
  land: 14,          // your hit connected
  landBig: [22, 25, 18],
  blocked: 6,        // your hit was blocked
  hurt: [28, 20, 12],// you got hit
  hurtBig: [45, 25, 30, 25, 15],
  block: 10,         // you blocked
  chair: [60, 30, 90, 30, 40],
  ko: [120, 60, 200],
};

let enabled = true;
try { enabled = localStorage.getItem("ok_haptics") !== "0"; } catch {}
let ios = null;

const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
const isIOS = typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

function iosTap() {
  if (!ios) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    ios = label;
  }
  ios.click();
}

export function setEnabled(on) { enabled = !!on; try { localStorage.setItem("ok_haptics", on ? "1" : "0"); } catch {} if (!on && canVibrate) navigator.vibrate(0); }
export const isEnabled = () => enabled;

// pad: index of the gamepad that belongs to this player (or -1)
export function buzz(name, pad = 0) {
  if (!enabled) return;
  const p = PATTERNS[name] ?? name;
  rumble(name, pad);
  if (canVibrate) {
    try { navigator.vibrate(p); } catch { /* blocked before the first tap */ }
    return;
  }
  if (isIOS) {
    const pulses = Array.isArray(p) ? p : [p];
    let t = 0;
    for (let i = 0; i < pulses.length; i += 2) {
      if (t === 0) iosTap(); else setTimeout(iosTap, t);
      t += pulses[i] + (pulses[i + 1] || 0);
    }
  }
}

const RUMBLE = {
  land: [70, 0.25, 0.55], landBig: [140, 0.6, 0.9], blocked: [40, 0.1, 0.3], hurt: [120, 0.7, 0.5],
  hurtBig: [220, 1, 0.8], block: [60, 0.2, 0.4], chair: [380, 1, 1], ko: [500, 1, 0.7],
};
function rumble(name, pad) {
  if (pad < 0 || !navigator.getGamepads) return;
  const r = RUMBLE[name];
  if (!r) return;
  const g = navigator.getGamepads()[pad];
  const act = g && g.vibrationActuator;
  if (!act || !act.playEffect) return;
  try { act.playEffect("dual-rumble", { duration: r[0], strongMagnitude: r[1], weakMagnitude: r[2] }); } catch {}
}
