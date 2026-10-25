// Haptic feedback. Android/Chrome: navigator.vibrate patterns.
// iOS Safari has no vibrate API, but toggling a native <input switch> plays a system haptic tick:
// - every button carries an invisible switch over it, so the finger's own tap toggles it and the click
//   carries on to the button. iOS 26.5+ only ticks for a switch the finger toggles, so this is what
//   gives an iPhone haptics on buttons;
// - game moments (jumps, lane changes, hits...) toggle a hidden switch from script, which iOS 17.4 to
//   26.4 turn into ticks. Newer iOS ignores those, and swipes never toggle a switch.

let enabled = true;
let iosSwitch = null;
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let lastTick = 0;
function iosTick() {
  const n = performance.now();
  if (n - lastTick < 40) return;
  lastTick = n;
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
  tap: 10, lane: 8, coin: 4, jump: 14, roll: 14, land: 10,
  power: [18, 40, 18], stumble: [40, 30, 50], crash: [90, 50, 140],
  shield: [30, 30, 30, 30, 60], buy: [15, 30, 25], level: [20, 40, 20, 40, 60],
};
// iOS can only tick, so a stronger moment is a short run of ticks
const IOS_TICKS = { power: 2, stumble: 2, crash: 3, shield: 3, buy: 2, level: 3 };
let lastCoin = 0;

// with haptics off the buttons' switches are hidden (css: html.no-haptics), so taps go straight to the button
export function setHaptics(on) { enabled = !!on; document.documentElement.classList.toggle('no-haptics', !enabled); }

export function haptic(kind) {
  if (!enabled) return;
  if (kind === 'coin') { const n = performance.now(); if (n - lastCoin < 90) return; lastCoin = n; }
  const p = PATTERNS[kind] ?? 10;
  if (canVibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } return; }
  // a button's own switch already ticked for the tap; coins come too thick and fast for ticks
  if (!isIOS || kind === 'tap' || kind === 'coin') return;
  const n = IOS_TICKS[kind] || 1;
  iosTick();
  for (let i = 1; i < n; i++) setTimeout(iosTick, i * 70);
}

// iOS: lay an invisible native switch over every button, now and as the UI builds more
function arm(btn) {
  if (btn.querySelector(':scope > input.hx')) return;
  const sw = document.createElement('input');
  sw.type = 'checkbox'; sw.setAttribute('switch', '');
  sw.className = 'hx'; sw.tabIndex = -1; sw.setAttribute('aria-hidden', 'true');
  btn.appendChild(sw);
  if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
}
export function armButtonHaptics(root = document.body) {
  if (!isIOS) return;
  const scan = () => { for (const b of root.querySelectorAll('button')) arm(b); };
  scan();
  // buttons get built and rebuilt (innerHTML, textContent) as screens render: re-arm after those changes,
  // ignoring the HUD's constant text updates
  let queued = false;
  const touchesButton = r => (r.target.closest && r.target.closest('button')) ||
    [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches('button') || n.querySelector('button')));
  new MutationObserver(recs => {
    if (queued || !recs.some(touchesButton)) return;
    queued = true;
    queueMicrotask(() => { queued = false; scan(); });
  }).observe(root, { childList: true, subtree: true });
}
