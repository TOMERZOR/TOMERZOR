// Audio extraction and transcription. Whisper runs in a worker on this device; ElevenLabs Scribe runs in the cloud.
export const MEDIABUNNY = 'https://cdn.jsdelivr.net/npm/mediabunny@1.64.0/+esm';
const SR = 16000;

export const ENGINES = [
  {
    id: 'fast', label: 'מהיר', note: 'Whisper Base. הורדה קטנה, דיוק בסיסי',
    model: 'onnx-community/whisper-base_timestamped', words: true, gpu: true,
    dtypeGpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, dtypeCpu: 'q8',
  },
  {
    id: 'balanced', label: 'מאוזן', note: 'Whisper Small. טוב לרוב הסרטונים',
    model: 'onnx-community/whisper-small_timestamped', words: true, gpu: true,
    dtypeGpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, dtypeCpu: 'q8',
  },
  {
    id: 'hebrew', label: 'עברית מדויקת', note: 'ivrit.ai. הכי טוב לעברית במכשיר, הורדה גדולה (כ-700MB)',
    model: 'ivrit-ai/whisper-large-v3-turbo-onnx', words: false, gpu: true,
    dtypeGpu: { encoder_model: 'q4', decoder_model_merged: 'q4' }, dtypeCpu: 'q4',
  },
  { id: 'cloud', label: 'ElevenLabs', note: 'ענן. הכי מדויק, דורש מפתח API משלכם', cloud: true },
];

export const LANGUAGES = [
  { id: 'hebrew', code: 'he', label: 'עברית' },
  { id: 'english', code: 'en', label: 'English' },
  { id: 'arabic', code: 'ar', label: 'العربية' },
  { id: 'russian', code: 'ru', label: 'Русский' },
  { id: 'french', code: 'fr', label: 'Français' },
  { id: 'spanish', code: 'es', label: 'Español' },
];

// Decodes the video's sound to 16 kHz mono, the format Whisper expects.
export async function extractAudio(file) {
  let mono, rate;
  try {
    ({ mono, rate } = await decodeWithMediabunny(file));
  } catch (err) {
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer()).catch(() => { throw new Error('NO_AUDIO'); });
    ctx.close();
    rate = decoded.sampleRate;
    mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / decoded.numberOfChannels;
    }
  }
  if (rate === SR) return mono;
  const off = new OfflineAudioContext(1, Math.ceil((mono.length / rate) * SR), SR);
  const buf = off.createBuffer(1, mono.length, rate);
  buf.copyToChannel(mono, 0);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}

async function decodeWithMediabunny(file) {
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import(MEDIABUNNY);
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryAudioTrack();
  if (!track) throw new Error('NO_AUDIO');
  if (!(await track.canDecode())) throw new Error('CANT_DECODE');
  const duration = await input.computeDuration();
  let mono = null, rate = 0;
  for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
    if (!mono) { rate = buffer.sampleRate; mono = new Float32Array(Math.ceil((duration + 1) * rate)); }
    const at = Math.max(0, Math.round(timestamp * rate));
    const n = buffer.numberOfChannels;
    for (let c = 0; c < n; c++) {
      const ch = buffer.getChannelData(c);
      const len = Math.min(ch.length, mono.length - at);
      for (let i = 0; i < len; i++) mono[at + i] += ch[i] / n;
    }
  }
  if (!mono) throw new Error('NO_AUDIO');
  return { mono, rate };
}

// Splits the audio into pieces of at most ~28 s, cutting in the quietest moment, and skips pieces with no speech.
export function splitAudio(audio, from = 0, to = audio.length / SR) {
  const hop = SR / 50; // 20 ms frames
  const f0 = Math.floor((from * SR) / hop), f1 = Math.floor((to * SR) / hop);
  const rms = new Float32Array(Math.max(0, f1 - f0));
  for (let f = 0; f < rms.length; f++) {
    let s = 0;
    const o = (f0 + f) * hop;
    for (let i = 0; i < hop; i++) { const v = audio[o + i] || 0; s += v * v; }
    rms[f] = Math.sqrt(s / hop);
  }
  const sorted = Float32Array.from(rms).sort();
  const loud = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const floor = Math.max(0.004, loud * 0.08);
  const pieces = [];
  let start = 0;
  while (start < rms.length) {
    let end = rms.length;
    if (end - start > 28 * 50) {
      let best = start + 28 * 50, bestV = Infinity;
      for (let f = start + 15 * 50; f < start + 28 * 50; f++) {
        let v = 0;
        for (let k = -7; k <= 7; k++) v += rms[f + k] || 0;
        if (v < bestV) { bestV = v; best = f; }
      }
      end = best;
    }
    let peak = 0, voiced = 0;
    for (let f = start; f < end; f++) { peak = Math.max(peak, rms[f]); if (rms[f] > floor * 2) voiced++; }
    if (peak > floor * 2 && voiced >= 10) pieces.push({ start: from + (start * hop) / SR, end: from + (end * hop) / SR });
    start = end;
  }
  return pieces;
}

const slice = (audio, s, e) => audio.subarray(Math.max(0, Math.floor(s * SR)), Math.min(audio.length, Math.ceil(e * SR)));

// Turns model output into clean words with absolute times.
function toWords(chunks, offset, pieceEnd, perWord) {
  const out = [];
  for (const c of chunks) {
    const text = (c.text || '').trim();
    if (!text) continue;
    let [s, e] = c.timestamp || [0, null];
    s = (s ?? 0) + offset;
    e = e == null ? pieceEnd : e + offset;
    if (perWord) {
      out.push({ text, start: s, end: Math.max(e, s + 0.08) });
    } else {
      // Segment-level timestamps only: share the segment's time between its words by length.
      const parts = text.split(/\s+/).filter(Boolean);
      const weights = parts.map((p) => p.length + 2);
      const total = weights.reduce((a, b) => a + b, 0);
      let at = s;
      parts.forEach((p, i) => {
        const d = ((e - s) * weights[i]) / total;
        out.push({ text: p, start: at, end: at + d });
        at += d;
      });
    }
  }
  return out.filter((w) => !/^[\s.,!?…-]*$/.test(w.text));
}

export class Transcriber {
  constructor() {
    this.worker = null;
    this.seq = 0;
    this.pending = new Map();
    this.onDownload = null;
  }

  ensureWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }) => {
      if (data.type === 'download') this.onDownload?.(data.loaded, data.total);
      else if (data.type === 'ready') this.device = data.device;
      else if (data.type === 'result') { this.pending.get(data.id)?.resolve(data); this.pending.delete(data.id); }
      else if (data.type === 'error') {
        const p = data.id != null ? this.pending.get(data.id) : null;
        if (p) { p.reject(new Error(data.message)); this.pending.delete(data.id); }
        else for (const [id, q] of this.pending) { q.reject(new Error(data.message)); this.pending.delete(id); }
      }
    };
    this.worker.onerror = (e) => { for (const [, q] of this.pending) q.reject(new Error(e.message || 'worker')); this.pending.clear(); };
  }

  runPiece(engine, language, audio) {
    this.ensureWorker();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'run', id, engine, language, audio });
    });
  }

  cancel() {
    this.worker?.terminate();
    this.worker = null;
    for (const [, q] of this.pending) q.reject(new Error('CANCELED'));
    this.pending.clear();
  }

  // Transcribes [from, to] seconds. Calls onPiece(words, done, total) as each piece finishes.
  async run({ audio, engine, language, from = 0, to, key, onPiece }) {
    to ??= audio.length / SR;
    if (engine.cloud) {
      const words = await elevenlabs(slice(audio, from, to), language, key);
      const shifted = words.map((w) => ({ ...w, start: w.start + from, end: w.end + from }));
      onPiece?.(shifted, 1, 1);
      return shifted;
    }
    const pieces = splitAudio(audio, from, to);
    const all = [];
    onPiece?.([], 0, pieces.length);
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      const res = await this.runPiece(engine, language, slice(audio, p.start, p.end));
      const words = toWords(res.chunks, p.start, p.end, engine.words);
      all.push(...words);
      onPiece?.(words, i + 1, pieces.length);
    }
    return all;
  }
}

function wav(samples) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}

async function elevenlabs(samples, language, key) {
  if (!key) throw new Error('NO_KEY');
  const form = new FormData();
  form.append('model_id', 'scribe_v2');
  form.append('file', wav(samples), 'audio.wav');
  const lang = LANGUAGES.find((l) => l.id === language);
  if (lang) form.append('language_code', lang.code);
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(res.status === 401 ? 'BAD_KEY' : `ElevenLabs ${res.status} ${body.slice(0, 160)}`);
  }
  const json = await res.json();
  return (json.words || []).filter((w) => w.type === 'word' && w.text.trim()).map((w) => ({ text: w.text.trim(), start: w.start, end: Math.max(w.end, w.start + 0.08) }));
}
