// The photo being scanned right now (kept in memory, not in the URL).
let pending = null;
let current = null;

/** Start scanning a file: remember it and go to the scan page. */
export function startScan(file) {
  pending = file;
  current = null;
  if (location.hash === "#/scan") {
    window.dispatchEvent(new CustomEvent("fs:newscan"));
  } else {
    location.hash = "#/scan";
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
