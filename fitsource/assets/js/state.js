// The photo being scanned right now (kept in memory, not in the URL).
import { CONFIG } from "./config.js";
import { currentRoute, go } from "./router.js";
import { toast } from "./ui.js";

let pending = null;
let current = null;

/** Start scanning a file: remember it and go to the scan page. */
export function startScan(file) {
  if (CONFIG.scanDisabledMessage) return toast(CONFIG.scanDisabledMessage);
  pending = file;
  current = null;
  if (currentRoute() === "scan") {
    window.dispatchEvent(new CustomEvent("fs:newscan"));
  } else {
    go("scan");
  }
}

export const takePending = () => {
  const f = pending;
  pending = null;
  return f;
};
export const hasPending = () => Boolean(pending);
export const setCurrent = (scan) => (current = scan);
export const getCurrent = () => current;
