// Exports: the video with captions burned in (WebCodecs via Mediabunny), and an SRT file.
import { MEDIABUNNY } from './transcribe.js';
import { drawCaptions, ensureFont } from './render.js';

let current = null;

// width/height: the upright size the browser shows (video.videoWidth/videoHeight).
// Rotation is baked into the frames before process() runs, so frames arrive upright too.
export async function exportVideo(file, width, height, words, pages, style, onProgress) {
  const mb = await import(MEDIABUNNY);
  await ensureFont(style);
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const vtrack = await input.getPrimaryVideoTrack();
  if (!vtrack) throw new Error('NO_VIDEO');
  const W = width - (width % 2), H = height - (height % 2);
  const codec = await mb.getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: W, height: H });
  if (!codec) throw new Error('NO_ENCODER');
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const state = {};
  const conversion = await mb.Conversion.init({
    input,
    output,
    tracks: 'primary',
    video: {
      codec,
      quality: mb.QUALITY_HIGH,
      allowTransformationMetadata: false,
      processedWidth: W,
      processedHeight: H,
      process: (sample) => {
        sample.draw(ctx, 0, 0, W, H);
        drawCaptions(ctx, W, H, sample.timestamp, words, pages, style, state);
        return canvas;
      },
    },
    showWarnings: false,
  });
  if (!conversion.isValid) throw new Error('INVALID');
  conversion.onProgress = (p) => onProgress?.(p);
  current = conversion;
  try {
    await conversion.execute();
  } finally {
    current = null;
  }
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}

export function cancelExport() {
  current?.cancel();
}

const stamp = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

export function toSRT(words, pages) {
  return pages.map((pg, i) => {
    const text = pg.lines.map((line) => line.map((k) => words[k].text).join(' ')).join('\n');
    return `${i + 1}\n${stamp(pg.start)} --> ${stamp(pg.end)}\n${text}\n`;
  }).join('\n');
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
