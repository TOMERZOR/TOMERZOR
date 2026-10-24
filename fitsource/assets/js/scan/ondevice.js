// Main-thread side of the on-device scanner.

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./ondevice.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const msg = e.data;
    const job = pending.get(msg.id);
    if (!job) return;
    if (msg.type === "status") job.onStatus && job.onStatus(msg);
    else if (msg.type === "result" || msg.type === "ready") {
      pending.delete(msg.id);
      job.resolve(msg);
    } else if (msg.type === "error") {
      pending.delete(msg.id);
      job.reject(new Error(msg.message));
    }
  };
  worker.onerror = (e) => {
    e.preventDefault();
    const err = new Error("הסורק לא הצליח לפעול בדפדפן הזה.");
    for (const job of pending.values()) job.reject(err);
    pending.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

function run(message, transfer, onStatus, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new DOMException("Scan cancelled", "AbortError"));
    const id = ++seq;
    pending.set(id, { resolve, reject, onStatus });
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          if (!pending.has(id)) return;
          pending.delete(id);
          worker && worker.postMessage({ type: "cancel", id });
          reject(new DOMException("Scan cancelled", "AbortError"));
        },
        { once: true },
      );
    }
    try {
      getWorker().postMessage({ ...message, id }, transfer);
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}

/** Detect the garments in an image (Blob or ImageBitmap). */
export async function scanOnDevice(source, { onStatus, signal } = {}) {
  const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
  return run({ type: "scan", bitmap }, [bitmap], onStatus, signal);
}

/** Name the single garment inside `region` ({x,y,w,h} as fractions). */
export async function classifyOnDevice(source, region, { onStatus } = {}) {
  const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
  return run({ type: "region", bitmap, region }, [bitmap], onStatus);
}

/** Start downloading the model early (e.g. while the user picks a photo). */
export function warmUp(onStatus) {
  return run({ type: "warmup" }, [], onStatus).catch(() => {});
}
