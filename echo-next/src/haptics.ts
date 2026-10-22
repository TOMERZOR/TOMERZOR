/**
 * Haptics with three backends, best first:
 *   1. Capacitor's Haptics plugin (the iOS app): real Taptic impacts.
 *   2. navigator.vibrate (Android browsers).
 *   3. iOS Safari (17.4+): toggling a hidden `<input type="checkbox" switch>`
 *      from a user gesture plays the system switch tick, the only haptic a
 *      web page can ask for on an iPhone.
 * Every call is cheap and never throws; `state.opts.haptics` gates them all.
 */
import { state } from "./state";

export type Buzz = "selection" | "light" | "medium" | "heavy" | "rigid" | "success" | "warning" | "error";

const PATTERNS: Record<Buzz, number | number[]> = {
  selection: 6, light: 10, medium: 18, heavy: 30, rigid: 14,
  success: [12, 40, 24], warning: [18, 50, 18], error: [30, 40, 30, 40, 30],
};

let plugin: any = null, pluginTried = false;
function nativePlugin() {
  if (pluginTried) return plugin; pluginTried = true;
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.() && cap.isPluginAvailable?.("Haptics")) plugin = cap.Plugins?.Haptics ?? cap.registerPlugin("Haptics");
  } catch { plugin = null; }
  return plugin;
}

let sw: HTMLInputElement | null = null, swLabel: HTMLLabelElement | null = null;
function iosSwitch() {
  if (sw) return sw;
  try {
    swLabel = document.createElement("label"); swLabel.style.cssText = "position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none";
    sw = document.createElement("input"); sw.type = "checkbox"; (sw as any).switch = true; sw.setAttribute("switch", ""); sw.tabIndex = -1; sw.setAttribute("aria-hidden", "true"); sw.style.pointerEvents = "none";
    swLabel.appendChild(sw); document.body.appendChild(swLabel);
  } catch { sw = null; }
  return sw;
}
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function buzz(kind: Buzz = "light") {
  if (!state.opts.haptics) return;
  const p = nativePlugin();
  if (p) {
    try {
      if (kind === "selection") p.selectionStart?.().then?.(() => p.selectionChanged?.()).then?.(() => p.selectionEnd?.());
      else if (kind === "success" || kind === "warning" || kind === "error") p.notification?.({ type: kind.toUpperCase() });
      else p.impact?.({ style: kind === "rigid" ? "MEDIUM" : kind.toUpperCase() });
    } catch { /* native call failed; stay quiet */ }
    return;
  }
  if (typeof navigator.vibrate === "function" && !isIOS()) { try { navigator.vibrate(PATTERNS[kind]); } catch { /* blocked */ } return; }
  if (isIOS()) {
    const s = iosSwitch(); if (!s || !swLabel) return;
    const n = kind === "success" || kind === "error" ? 2 : 1;
    try { s.click(); if (n > 1) setTimeout(() => s.click(), 90); } catch { /* not supported */ }
  }
}

/** True when some backend exists, so settings can say what the switch does. */
export const hapticsAvailable = () => !!nativePlugin() || typeof navigator.vibrate === "function" || isIOS();
