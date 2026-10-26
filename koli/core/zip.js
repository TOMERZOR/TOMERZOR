// A small ZIP reader for the Instagram export. Reads only the entries asked
// for, straight from the Blob, so a multi-gigabyte export with photos doesn't
// have to fit in memory. Supports stored and deflated entries and ZIP64.

const EOCD = 0x06054b50;
const EOCD64_LOCATOR = 0x07064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

async function bytes(blob, start, end) {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

function u64(view, offset) {
  return Number(view.getBigUint64(offset, true));
}

/** List the entries of a zip Blob: [{name, method, compressedSize, size, offset}]. */
export async function listZip(blob) {
  const tailSize = Math.min(blob.size, 65557);
  const tail = await bytes(blob, blob.size - tailSize, blob.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not_zip");
  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff || count === 0xffff) {
    const loc = eocd - 20;
    if (loc >= 0 && tail.getUint32(loc, true) === EOCD64_LOCATOR) {
      const rec = await bytes(blob, u64(tail, loc + 8), u64(tail, loc + 8) + 56);
      count = u64(rec, 32);
      cdSize = u64(rec, 40);
      cdOffset = u64(rec, 48);
    }
  }
  const cd = await bytes(blob, cdOffset, cdOffset + cdSize);
  const decoder = new TextDecoder();
  const entries = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== CENTRAL) break;
    const method = cd.getUint16(p + 10, true);
    let compressedSize = cd.getUint32(p + 20, true);
    let size = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let offset = cd.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    // ZIP64 extra field carries the real sizes and offset when they overflow.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = cd.getUint16(e, true);
      const len = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) (size = u64(cd, q)), (q += 8);
        if (compressedSize === 0xffffffff) (compressedSize = u64(cd, q)), (q += 8);
        if (offset === 0xffffffff) offset = u64(cd, q);
      }
      e += 4 + len;
    }
    if (!name.endsWith("/")) entries.push({ name, method, compressedSize, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Read one entry as text. */
export async function readZipText(blob, entry) {
  const head = await bytes(blob, entry.offset, entry.offset + 30);
  if (head.getUint32(0, true) !== LOCAL) throw new Error("bad_entry");
  const start = entry.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
  const data = blob.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return await data.text();
  if (entry.method !== 8) throw new Error("unsupported_compression");
  const stream = data.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}
