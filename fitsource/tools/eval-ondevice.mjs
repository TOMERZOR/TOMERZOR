// Runs the on-device detector over local photos in Node and prints what it finds.
//   node tools/eval-ondevice.mjs assets/img/fits/*.jpg
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from "@huggingface/transformers";
import { makeWindows, decodeEmbeddings, scoreEmbedding, pickItems } from "../assets/js/scan/detect.js";

const here = path.dirname(fileURLToPath(import.meta.url));
env.cacheDir = path.join(here, "../node_modules/.cache/hf");
const MODEL = "Xenova/mobileclip_s0";
const emb = decodeEmbeddings(JSON.parse(fs.readFileSync(path.join(here, "../assets/js/scan/embeddings.json"))), (s) => Buffer.from(s, "base64"));
const processor = await AutoProcessor.from_pretrained(MODEL);
const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: "fp32" });

for (const file of process.argv.slice(2)) {
  let img = await RawImage.read(file);
  const scale = 768 / Math.max(img.width, img.height);
  if (scale < 1) img = await img.resize(Math.round(img.width * scale), Math.round(img.height * scale));
  img = img.rgba();
  const scored = [];
  for (const win of makeWindows()) {
    const crop = await img.crop([Math.round(win.x * img.width), Math.round(win.y * img.height), Math.round((win.x + win.w) * img.width) - 1, Math.min(img.height, Math.round((win.y + win.h) * img.height)) - 1]);
    const { image_embeds } = await model(await processor(crop));
    scored.push({ win, probs: scoreEmbedding(image_embeds.data, emb) });
  }
  const items = pickItems(scored, emb, { data: img.data, width: img.width, height: img.height });
  console.log(path.basename(file).padEnd(24), items.map((i) => `${i.query} (${i.confidence.toFixed(2)}) y${i.box.y}`).join(" | "));
}
