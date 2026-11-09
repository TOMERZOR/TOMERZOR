// The personal QR code (drawn with vendor/qrcode.js as rounded dots) and the camera scanner
// (the browser's BarcodeDetector when it has one, otherwise vendor/jsQR.js). All on the device.

export function qrSvg(text) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  let dots = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c) && !finder(r, c)) dots += `<rect x="${c + 0.1}" y="${r + 0.1}" width="0.8" height="0.8" rx="0.34"/>`;
  }
  const eye = (x, y) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.9" fill="none" stroke="currentColor" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9"/>`;
  return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" class="qr-svg" role="img" aria-label="קוד QR" fill="currentColor">${dots}${eye(0, 0)}${eye(n - 7, 0)}${eye(0, n - 7)}</svg>`;
}

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
  if (!window.jsQR) return null;
  const scale = Math.min(1, 720 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data || null;
}

// Starts the back camera in `video` and calls onCode(text) for codes that pass accept(text).
// Returns stop().
export async function startScanner(video, { accept = () => true, onCode }) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play().catch(() => {});
  let stopped = false, timer;
  const loop = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        const text = await decode(video);
        if (text && !stopped && accept(text)) onCode(text);
      }
    } catch {}
    if (!stopped) timer = setTimeout(loop, 220);
  };
  loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  };
}
