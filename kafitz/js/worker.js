// Runs Whisper in the browser (transformers.js). The model is downloaded once and then cached by the browser.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;

let asr = null, loadedKey = '', noGpu = false;

async function hasGpu() {
  if (noGpu || !('gpu' in navigator)) return false;
  return !!(await navigator.gpu.requestAdapter().catch(() => null));
}

async function load(engine) {
  const gpu = engine.gpu && (await hasGpu());
  const key = engine.model + (gpu ? ':gpu' : ':cpu');
  if (asr && loadedKey === key) return;
  if (asr) { await asr.dispose?.().catch(() => {}); asr = null; }
  const files = {};
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.total) {
      files[p.file] = [p.loaded, p.total];
      let loaded = 0, total = 0;
      for (const [l, t] of Object.values(files)) { loaded += l; total += t; }
      postMessage({ type: 'download', loaded, total });
    }
  };
  try {
    asr = await pipeline('automatic-speech-recognition', engine.model, {
      device: gpu ? 'webgpu' : 'wasm', dtype: gpu ? engine.dtypeGpu : engine.dtypeCpu, progress_callback,
    });
  } catch (err) {
    if (!gpu) throw err;
    noGpu = true; // WebGPU failed on this device: fall back to the CPU build.
    return load(engine);
  }
  loadedKey = key;
  postMessage({ type: 'ready', device: gpu ? 'webgpu' : 'wasm' });
}

async function transcribe(data) {
  await load(data.engine);
  return asr(data.audio, {
    language: data.language,
    task: 'transcribe',
    return_timestamps: data.engine.words ? 'word' : true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });
}

onmessage = async ({ data }) => {
  if (data.type !== 'run') return;
  try {
    let out;
    try {
      out = await transcribe(data);
    } catch (err) {
      if (noGpu || !loadedKey.endsWith(':gpu')) throw err;
      noGpu = true;
      out = await transcribe(data);
    }
    postMessage({ type: 'result', id: data.id, chunks: out.chunks || [], text: out.text });
  } catch (err) {
    postMessage({ type: 'error', id: data.id, message: String(err?.message || err) });
  }
};
