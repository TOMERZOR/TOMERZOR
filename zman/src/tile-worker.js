// Web Worker: fetches a vector tile and rewrites it (see tiles.js).
// Bundled into js/tile-worker.js with `npm run build`.
import { transformTile } from "./tiles.js";
import { CORES } from "../js/cores.js";

self.onmessage = async (e) => {
  const { id, url, z, x, y } = e.data;
  try {
    const res = await fetch(url);
    if (res.status === 204 || res.status === 404) return self.postMessage({ id, data: new ArrayBuffer(0) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const out = buf.byteLength ? transformTile(buf, z, x, y, CORES) : new Uint8Array(0);
    const data = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    self.postMessage({ id, data }, [data]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
