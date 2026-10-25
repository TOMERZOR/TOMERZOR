// Reads the text on clothes in local photos, the way the quick scan does.
//   node tools/eval-ocr.mjs photo.jpg [x y w h]   (region as fractions, default: the body column)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ort from "onnxruntime-node";
import { RawImage } from "@huggingface/transformers";
import { OCR_MODELS, BODY, loadOcr, readText, printedText } from "../assets/js/scan/ocr.js";

const cache = path.join(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/.cache/ocr");
fs.mkdirSync(cache, { recursive: true });
const NAMES = { [OCR_MODELS.det]: "det.onnx", [OCR_MODELS.rec]: "rec.onnx", [OCR_MODELS.dict]: "dict.txt" };
async function fetchBytes(url) {
  const file = path.join(cache, NAMES[url]);
  if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  const b = fs.readFileSync(file);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

const ocr = await loadOcr(ort, fetchBytes);
const [file, ...r] = process.argv.slice(2);
const region = r.length === 4 ? { x: +r[0], y: +r[1], w: +r[2], h: +r[3] } : BODY;
for (const f of file ? [file] : []) {
  const img = (await RawImage.read(f)).rgba();
  const t0 = Date.now();
  const lines = await readText(ocr, { data: img.data, width: img.width, height: img.height }, region);
  console.log(path.basename(f), `${Date.now() - t0} ms`);
  for (const l of lines) console.log("  ", l.score.toFixed(2), l.size.toFixed(3), JSON.stringify(l.text));
  console.log("  =>", printedText(lines));
}
