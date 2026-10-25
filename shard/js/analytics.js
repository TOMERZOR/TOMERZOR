// Minimal funnel analytics. Events queue locally; wire `sink` to Firebase or GameAnalytics
// in the app build. Nothing leaves the device unless a sink is set and consent was given.
const queue = [];
let sink = null, consent = false;

export function setSink(fn) { sink = fn; flush(); }
export function setConsent(v) { consent = v; flush(); }

export function track(name, props = {}) {
  queue.push({ name, props, t: Date.now() });
  if (queue.length > 200) queue.shift();
  flush();
}
function flush() {
  if (!sink || !consent) return;
  while (queue.length) { const e = queue.shift(); try { sink(e); } catch (err) {} }
}
export const debugQueue = () => queue.slice();
