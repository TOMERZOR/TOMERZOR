"""composite.py orig.mp4 styled.mp4 out.mp4 [--debug-frame N out.png]

The restyled (Genjutsu) video with the person's REAL face, finished so it reads as one photographed image rather than a
cut-out on a background:

  face      the original face, aligned to the styled head (similarity transform from MediaPipe landmarks), softened to the
            styled frame's sharpness, and relit: shading and colour from the styled frame (low-pass inside the face, sigma
            ~7% of face width), detail from the original. Feathered into the styled face oval.
  matte     RobustVideoMatting on the styled frames: where the person ends and the room begins.
  wrap      light wrap: the room's colour, blurred, spills over the person's edges (hair, shoulders, ears).
  grade     one curve for the whole frame: lifted purple blacks, gentle S, warm highlights.
  bloom     the lamps and screens glow a little into their surroundings.
  grain     the same fine film grain on person and room (deterministic per frame).
"""
import argparse, json, subprocess
import numpy as np, cv2, onnxruntime as ort
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

ap = argparse.ArgumentParser()
ap.add_argument("orig"); ap.add_argument("styled"); ap.add_argument("out")
ap.add_argument("--fps", default="24"); ap.add_argument("--light", type=float, default=0.07)
ap.add_argument("--soft", type=float, default=1.15, help="Gaussian sigma (px at 1080) applied to the original face to match the styled sharpness")
ap.add_argument("--wrap", type=float, default=0.5); ap.add_argument("--grain", type=float, default=0.016)
ap.add_argument("--debug-frame", nargs=2, default=None)
a = ap.parse_args()
W, H = 1080, 1920
SCR = "/tmp/claude-0/-home-user-TOMERZOR/57893ae3-acda-505c-b44d-0e56fba7243b/scratchpad"
FACE_MODEL, RVM = f"{SCR}/models/face_landmarker.task", f"{SCR}/models/rvm_mobilenetv3_fp32.onnx"

def reader(path, fps=None):
    vf = (f"fps={fps}," if fps else "") + f"scale={W}:{H}:flags=lanczos"
    return subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
po, ps = reader(a.orig, a.fps), reader(a.styled)
enc = None if a.debug_frame else subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", a.fps, "-i", "-",
                        "-c:v", "libx264", "-crf", "13", "-preset", "medium", "-pix_fmt", "yuv420p", a.out], stdin=subprocess.PIPE)
mk = lambda: vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=FACE_MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=1))
LO, LS = mk(), mk()
so = ort.SessionOptions(); so.intra_op_num_threads = 3
rvm = ort.InferenceSession(RVM, so, providers=["CPUExecutionProvider"]); rec = [np.zeros([1, 1, 1, 1], np.float32)] * 4
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
STABLE = [33, 133, 362, 263, 168, 6, 197, 1, 4, 98, 327, 234, 454, 10, 152, 61, 291, 0, 17]
fps = float(eval(a.fps)); n = 0; miss = 0; prevM = None
dbg_n = int(a.debug_frame[0]) if a.debug_frame else -1

def lm(det, img, ts):
    small = cv2.resize(img, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(small)), ts)
    if not r.face_landmarks: return None
    L = r.face_landmarks[0]; return np.array([[p.x * W, p.y * H] for p in L], np.float32)

def lowpass(img, mask, sigma):
    num = cv2.GaussianBlur(img * mask[..., None], (0, 0), sigma); den = cv2.GaussianBlur(mask, (0, 0), sigma)[..., None]
    return num / np.maximum(den, 1e-4)

def srgb2lin(x): return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
def lin2srgb(x): return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)

# the grade: per-channel curve on [0,1] as a 1D LUT
xs = np.linspace(0, 1, 1024, dtype=np.float32)
def curve(x, lift, gain, gamma, s):
    y = lift + (gain - lift) * np.power(x, gamma)
    return np.clip(y + s * (y - 0.5) * (1 - np.abs(2 * y - 1)), 0, 1)
LUT = np.stack([curve(xs, 0.030, 1.00, 1.02, 0.10), curve(xs, 0.018, 0.975, 1.05, 0.10), curve(xs, 0.045, 0.955, 1.04, 0.08)], 1).astype(np.float32)

while True:
    bo = po.stdout.read(W * H * 3); bs = ps.stdout.read(W * H * 3)
    if len(bo) < W * H * 3 or len(bs) < W * H * 3: break
    if dbg_n >= 0 and n < dbg_n:   # fast-forward to the debug frame (matte state still advances below)
        pass
    o = np.frombuffer(bo, np.uint8).reshape(H, W, 3); s = np.frombuffer(bs, np.uint8).reshape(H, W, 3)
    ts = int(n * 1000 / fps); sf = s.astype(np.float32) / 255
    # ── matte (RVM on 720p) ──
    s720 = cv2.resize(s, (720, 1280), interpolation=cv2.INTER_AREA)
    _, pha, *rec = rvm.run(None, {"src": s720.transpose(2, 0, 1)[None].astype(np.float32) / 255, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": np.array([0.375], np.float32)})
    alpha = cv2.resize(np.clip(pha[0, 0], 0, 1), (W, H), interpolation=cv2.INTER_LINEAR)
    if dbg_n >= 0 and n < dbg_n: n += 1; continue
    out = sf
    # ── face ──
    po_ = lm(LO, o, ts); ps_ = lm(LS, s, ts)
    if po_ is not None and ps_ is not None:
        M, _ = cv2.estimateAffinePartial2D(po_[STABLE], ps_[STABLE], method=cv2.LMEDS)
        if M is not None:
            M = M if prevM is None else 0.6 * M + 0.4 * prevM; prevM = M
            ov = ps_[OVAL]; c = ov.mean(0); fw = ov[:, 0].max() - ov[:, 0].min()
            x0, y0 = np.maximum((ov.min(0) - 0.45 * fw).astype(int), 0); x1, y1 = np.minimum((ov.max(0) + 0.45 * fw).astype(int), [W, H])
            ow = cv2.warpAffine(o, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)[y0:y1, x0:x1].astype(np.float32) / 255
            ow = cv2.GaussianBlur(ow, (0, 0), a.soft)
            sc = sf[y0:y1, x0:x1]; off = np.array([x0, y0], np.float32)
            core = np.zeros(sc.shape[:2], np.float32); cv2.fillPoly(core, [((c + (ov - c) * 0.97) - off).astype(np.int32)], 1.0)
            m = np.zeros(sc.shape[:2], np.float32); cv2.fillPoly(m, [((c + (ov - c) * 1.04) - off).astype(np.int32)], 1.0)
            m = cv2.GaussianBlur(m, (0, 0), max(2.0, 0.035 * fw))
            sig = a.light * fw
            ratio = lowpass(srgb2lin(sc), core, sig) / np.maximum(lowpass(srgb2lin(ow), core, sig), 1e-4)
            face = lin2srgb(np.clip(srgb2lin(ow) * np.clip(ratio, 0.15, 6.0), 0, 1))
            out = sf.copy(); out[y0:y1, x0:x1] = face * m[..., None] + sc * (1 - m[..., None])
        else: miss += 1
    else: miss += 1
    # ── light wrap: the room's light spills over the edges ──
    bgw = 1 - alpha
    small = lambda x: cv2.resize(x, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    bgcol = cv2.GaussianBlur(small(out * bgw[..., None]), (0, 0), 14) / np.maximum(cv2.GaussianBlur(small(bgw), (0, 0), 14), 1e-3)[..., None]
    bgcol = cv2.resize(bgcol, (W, H), interpolation=cv2.INTER_LINEAR)
    edge = np.clip(alpha * (1 - cv2.GaussianBlur(alpha, (0, 0), 16)) * 2.6, 0, 1)[..., None] * a.wrap
    out = 1 - (1 - out) * (1 - edge * bgcol)
    # ── bloom on the practicals ──
    lum = out @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    hi = small(out * np.clip((lum - 0.72) / 0.28, 0, 1)[..., None])
    out = out + 0.22 * cv2.resize(cv2.GaussianBlur(hi, (0, 0), 10), (W, H), interpolation=cv2.INTER_LINEAR)
    # ── grade ──
    idx = np.clip(out * 1023, 0, 1023).astype(np.int32)
    out = np.stack([LUT[idx[..., k], k] for k in range(3)], -1)
    # ── grain (same on everything) ──
    rng = np.random.default_rng(1000 + n)
    gr = cv2.resize(rng.standard_normal((H * 2 // 3, W * 2 // 3)).astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)
    out = out + gr[..., None] * a.grain * (0.6 + 0.8 * out * (1 - out) * 4) * 0.5
    res = np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8)
    if dbg_n >= 0:
        cv2.imwrite(a.debug_frame[1], cv2.cvtColor(res, cv2.COLOR_RGB2BGR)); print("debug frame written"); break
    enc.stdin.write(res.tobytes()); n += 1
if enc: enc.stdin.close(); enc.wait()
print(f"frames {n}, face not found in {miss}")
