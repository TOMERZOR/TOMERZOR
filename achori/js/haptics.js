// Phone vibration for the moments that matter. Android has the Vibration API.
// iPhone Safari has none, but since iOS 18 toggling a hidden <input type="checkbox" switch>
// plays the system's light tap, so on iPhone every pulse becomes one such tap.
// Either way it only fires from a tap or soon after one, which is when we need it.

const PATTERNS = {
  ui: 8,
  place: 14,
  remove: 8,
  refuse: [18, 50, 18],
  hit: 10,
  hitHard: 20,
  snap: [35, 30, 45],
  glue: 25,
  eat: [10, 60, 10],
  escaping: 6, // ticks while a caught mouse is about to break free
  free: [30, 40, 15],
  steal: [70, 50, 30],
  recovered: [15, 40, 15, 40, 15],
  kill: [40, 30, 70],
  killLior: [60, 40, 60, 40, 140],
  scream: [90, 40, 90, 40, 90],
  disconnect: [15, 30, 15, 30, 15, 30, 40],
  refund: [12, 50, 12, 50, 30],
  start: [20, 60, 40],
  win: [30, 60, 30, 60, 120],
  turboReady: [20, 40, 20, 40, 60],
  turboHit: 12,
  tile: [60, 30, 90],
  spray: [30, 30, 30],
  potion: [15, 40, 15],
  lose: [200],
};

let enabled = true;
let ios = null;

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const isIOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function iosTap() {
  if (!ios) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    ios = label;
  }
  ios.click();
}

export const supported = canVibrate || isIOS;
export function setEnabled(on) { enabled = !!on; if (!on && canVibrate) navigator.vibrate(0); }
export const isEnabled = () => enabled;

export function buzz(name) {
  if (!enabled) return;
  const p = PATTERNS[name] ?? name;
  if (canVibrate) {
    try { navigator.vibrate(p); } catch { /* blocked before the first tap */ }
    return;
  }
  if (isIOS) {
    // one system tap per pulse, spaced like the pattern
    const pulses = Array.isArray(p) ? p : [p];
    let t = 0;
    for (let i = 0; i < pulses.length; i += 2) {
      if (t === 0) iosTap(); else setTimeout(iosTap, t);
      t += pulses[i] + (pulses[i + 1] || 0);
    }
  }
}
