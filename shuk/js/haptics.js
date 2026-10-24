// Haptic feedback. Android/Chrome: navigator.vibrate patterns.
// iOS Safari has no vibrate API; toggling a native <input switch> produces a
// system haptic tick on iOS 18+, so that is used as a fallback for the strong moments.

let enabled = true;
let iosSwitch = null;
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function iosTick() {
  try {
    if (!iosSwitch) {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1;
      label.appendChild(input); document.body.appendChild(label);
      iosSwitch = label;
    }
    iosSwitch.click();
  } catch (e) { /* ignore */ }
}

const PATTERNS = {
  tap: 8, lane: 6, coin: 4, jump: 14, roll: 14, land: 10,
  power: [18, 40, 18], stumble: [40, 30, 50], crash: [90, 50, 140],
  shield: [30, 30, 30, 30, 60], buy: [15, 30, 25], level: [20, 40, 20, 40, 60],
};
let lastCoin = 0;

export function setHaptics(on) { enabled = !!on; }

export function haptic(kind) {
  if (!enabled) return;
  if (kind === 'coin') { const n = performance.now(); if (n - lastCoin < 90) return; lastCoin = n; }
  const p = PATTERNS[kind] ?? 10;
  if (canVibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } return; }
  if (isIOS && kind !== 'coin' && kind !== 'lane') iosTick();
}
