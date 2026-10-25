// Haptics through Capacitor when running as an app, navigator.vibrate on Android web. An iPhone web page can't
// vibrate: all Safari lets it feel is a finger tapping a switch, so there every button carries an invisible one.
let on = true, last = 0, echo = 0;
const cap = () => window.Capacitor?.Plugins?.Haptics;
const MS = { LIGHT: 10, MEDIUM: 18, HEAVY: 30 }; // Android web: shorter pulses get lost in slow motors

export function setHaptics(v) {
  on = v;
  for (const s of document.querySelectorAll('.hx input')) s.disabled = !v;
}

function fire(style, force) {
  if (!on) return;
  const now = performance.now();
  if (!force && now - last < 35) return;
  last = now;
  clearTimeout(echo); echo = 0; // a new touch replaces a pending echo
  const h = cap();
  if (h) { h.impact({ style }).catch(() => {}); return; }
  if (navigator.vibrate) try { navigator.vibrate(MS[style]); } catch (e) {}
}
export const light = () => fire('LIGHT');
export const medium = () => fire('MEDIUM');
export const heavy = () => fire('HEAVY');
// glass: the hit, then a lighter tick as the pieces fly apart (force: the last piece of a level always lands)
export function crunch(style = 'MEDIUM', force = false) {
  if (!on) return;
  clearTimeout(echo);
  fire(style, force);
  echo = setTimeout(() => { echo = 0; fire('LIGHT'); }, 50);
}
export function success() {
  if (!on) return;
  const h = cap();
  if (h) { h.notification({ type: 'SUCCESS' }).catch(() => {}); return; }
  if (navigator.vibrate) try { navigator.vibrate([14, 50, 26]); } catch (e) {}
}
let selecting = false;
export function selection() {
  if (!on) return;
  const h = cap();
  if (!h) return;
  // Capacitor drops selectionChanged on both platforms until selectionStart has run
  if (!selecting) { selecting = true; h.selectionStart?.()?.catch?.(() => {}); }
  h.selectionChanged?.()?.catch?.(() => {});
}
export function warning() {
  if (!on) return;
  const h = cap();
  if (h) { h.notification({ type: 'WARNING' }).catch(() => {}); return; }
  if (navigator.vibrate) try { navigator.vibrate([14, 70, 14]); } catch (e) {}
}

// iPhone web: since iOS 26.5, WebKit plays a switch's haptic only when a finger itself taps the label holding it
// (a scripted click no longer counts). So every button gets an invisible label with a switch inside: the tap lands
// on the label, bubbles up to the button as usual, and the label passes it on to the switch, which ticks.
export function armTapTicks() {
  if (window.Capacitor?.isNativePlatform?.() || 'vibrate' in navigator || !navigator.maxTouchPoints) return;
  const arm = (b) => {
    if (!b || b.querySelector(':scope > .hx')) return;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    const l = document.createElement('label');
    l.className = 'hx';
    l.setAttribute('aria-hidden', 'true');
    const s = document.createElement('input');
    s.type = 'checkbox';
    s.setAttribute('switch', '');
    s.tabIndex = -1;
    s.disabled = !on;
    // the click the label passes on stops at the switch, so the button's own handlers run once
    s.addEventListener('click', (e) => e.stopPropagation());
    l.append(s);
    b.append(l);
  };
  document.querySelectorAll('button').forEach(arm);
  // the settings toggles are checkboxes already: as switches they tick by themselves
  document.querySelectorAll('input.toggle').forEach((t) => t.setAttribute('switch', ''));
  // sheets, the map and relabelled buttons come and go: arm them as they appear
  new MutationObserver((ms) => {
    for (const m of ms) {
      arm(m.target.closest?.('button'));
      for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches('button')) arm(n); n.querySelectorAll('button').forEach(arm); }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
