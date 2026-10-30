// Reads QR codes from a playing <video>. Uses the browser's BarcodeDetector when it has one,
// otherwise jsQR (vendor/jsQR.js, loaded as a classic script). Everything runs on the device.

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let detector;

async function decode(video) {
  if (detector === undefined) {
    detector = null;
    try {
      if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
        detector = new BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch {}
  }
  if (detector) {
    const codes = await detector.detect(video);
    return codes[0]?.rawValue || null;
  }
  const scale = Math.min(1, 960 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
}

// Calls onCode(text) for each QR code that passes accept(text), until stop() is called.
export function scanVideo(video, { accept = () => true, onCode, interval = 250 }) {
  let stopped = false, timer;
  const loop = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        const text = await decode(video);
        if (text && !stopped && accept(text)) onCode(text);
      }
    } catch {}
    if (!stopped) timer = setTimeout(loop, interval);
  };
  loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
