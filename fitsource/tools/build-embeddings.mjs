// Precomputes MobileCLIP text embeddings for the garment vocabulary, so the
// browser only has to download the (small) vision half of the model.
// Run: node tools/build-embeddings.mjs   (from fitsource/, after npm install)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AutoTokenizer, CLIPTextModelWithProjection, env } from "@huggingface/transformers";
import { allLabels, PROMPT } from "../assets/js/scan/vocab.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const MODEL = "Xenova/mobileclip_s0";
env.cacheDir = path.join(here, "../node_modules/.cache/hf");

const labels = allLabels();
const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: "fp32" });
const inputs = tokenizer(labels.map((l) => PROMPT(l.label)), { padding: "max_length", truncation: true });
const vectors = (await model(inputs)).text_embeds.normalize().tolist();

// int8 with one scale per vector keeps the file small; cosine scores move by <0.002.
const dims = vectors[0].length;
const packed = new Int8Array(labels.length * dims);
const scales = vectors.map((v, i) => {
  const max = Math.max(...v.map(Math.abs)) || 1;
  const scale = max / 127;
  v.forEach((x, j) => (packed[i * dims + j] = Math.round(x / scale)));
  return +scale.toPrecision(6);
});

const out = {
  model: MODEL,
  dims,
  labels: labels.map((l) => l.label),
  scales,
  data: Buffer.from(packed.buffer).toString("base64"),
};
const file = path.join(here, "../assets/js/scan/embeddings.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log(`wrote ${labels.length} embeddings (${dims} dims) to ${path.relative(process.cwd(), file)}`);
