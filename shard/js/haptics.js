// Haptics through Capacitor when running as an app, navigator.vibrate on Android web.
let on = true, last = 0;
const cap = () => window.Capacitor?.Plugins?.Haptics;

export function setHaptics(v) { on = v; }

function fire(style, ms) {
  if (!on) return;
  const now = performance.now();
  if (now - last < 35) return;
  last = now;
  const h = cap();
  if (h) { h.impact({ style }).catch(() => {}); return; }
  if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {}
}
export const light = () => fire('LIGHT', 8);
export const medium = () => fire('MEDIUM', 14);
export const heavy = () => fire('HEAVY', 26);
export function success() {
  if (!on) return;
  const h = cap();
  if (h) { h.notification({ type: 'SUCCESS' }).catch(() => {}); return; }
  if (navigator.vibrate) try { navigator.vibrate([12, 40, 22]); } catch (e) {}
}
export function selection() {
  if (!on) return;
  const h = cap();
  if (h) { h.selectionChanged?.().catch?.(() => {}); }
}
