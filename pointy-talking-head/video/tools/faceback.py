"""faceback.py orig.mp4 styled.mp4 out.mp4 [--fps 24] [--size 1080x1920] [--debug dbg.mp4]

Put the person's REAL face back into a restyled (Genjutsu) video, so identity, eyes, mouth and lip movement are the
original's while the new light and colour are kept.

Per frame:
  1. the original is resampled to the styled video's frame rate (same timestamps) and both are scaled to --size;
  2. MediaPipe face landmarks on both; a similarity transform (rotation, scale, shift) from stable points maps the
     original face onto the styled head, which the generator may have reframed slightly;
  3. light transfer: detail (high frequencies) from the original, shading and colour (low frequencies, normalized
     inside the face so the background never bleeds in) from the styled frame;
  4. feathered blend inside the styled face oval, grown a little to cover the beard line and hairline.
"""
import argparse, json, subprocess
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

ap = argparse.ArgumentParser()
ap.add_argument("orig"); ap.add_argument("styled"); ap.add_argument("out")
ap.add_argument("--fps", default="24"); ap.add_argument("--size", default="1080x1920")
ap.add_argument("--grow", type=float, default=1.06, help="scale of the face oval used as the paste mask")
ap.add_argument("--feather", type=float, default=0.07, help="mask feather, fraction of face width")
ap.add_argument("--light", type=float, default=0.11, help="low-pass sigma for the light transfer, fraction of face width")
ap.add_argument("--debug", default=None)
a = ap.parse_args()
W, H = map(int, a.size.split("x"))
MODEL = "/tmp/claude-0/-home-user-TOMERZOR/57893ae3-acda-505c-b44d-0e56fba7243b/scratchpad/models/face_landmarker.task"

def reader(path, fps=None):
    vf = (f"fps={fps}," if fps else "") + f"scale={W}:{H}:flags=lanczos"
    return subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
po, ps = reader(a.orig, a.fps), reader(a.styled)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", a.fps, "-i", "-",
                        "-c:v", "libx264", "-crf", "13", "-preset", "medium", "-pix_fmt", "yuv420p", a.out], stdin=subprocess.PIPE)
dbg = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W//2}x{H//2}", "-r", a.fps, "-i", "-",
                        "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", a.debug], stdin=subprocess.PIPE) if a.debug else None

def landmarker():
    return vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=1))
LO, LS = landmarker(), landmarker()
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
STABLE = [33, 133, 362, 263, 168, 6, 197, 1, 4, 98, 327, 234, 454, 10, 152, 61, 291, 0, 17]
fps = float(eval(a.fps)); n = 0; miss = 0
prevM = None

def pts(r, idx):
    L = r.face_landmarks[0]; return np.array([[L[i].x * W, L[i].y * H] for i in idx], np.float32)

def lowpass(img, mask, sigma):
    num = cv2.GaussianBlur(img * mask[..., None], (0, 0), sigma); den = cv2.GaussianBlur(mask, (0, 0), sigma)[..., None]
    return num / np.maximum(den, 1e-4)

while True:
    bo = po.stdout.read(W * H * 3); bs = ps.stdout.read(W * H * 3)
    if len(bo) < W * H * 3 or len(bs) < W * H * 3: break
    o = np.frombuffer(bo, np.uint8).reshape(H, W, 3); s = np.frombuffer(bs, np.uint8).reshape(H, W, 3)
    ts = int(n * 1000 / fps)
    ro = LO.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=o), ts)
    rs = LS.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=s.copy()), ts)
    out = s
    if ro.face_landmarks and rs.face_landmarks:
        M, _ = cv2.estimateAffinePartial2D(pts(ro, STABLE), pts(rs, STABLE), method=cv2.LMEDS)
        if M is not None:
            M = M if prevM is None else 0.6 * M + 0.4 * prevM     # damp landmark jitter between frames
            prevM = M
            ow = cv2.warpAffine(o, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
            ov = pts(rs, OVAL); c = ov.mean(0); fw = ov[:, 0].max() - ov[:, 0].min()
            poly = (c + (ov - c) * a.grow).astype(np.int32)
            core = np.zeros((H, W), np.float32); cv2.fillPoly(core, [(c + (ov - c) * 0.98).astype(np.int32)], 1.0)
            m = np.zeros((H, W), np.float32); cv2.fillPoly(m, [poly], 1.0)
            m = cv2.GaussianBlur(m, (0, 0), max(2.0, a.feather * fw / 2.5))
            sig = a.light * fw
            of, sf = ow.astype(np.float32) / 255, s.astype(np.float32) / 255
            ratio = lowpass(sf, core, sig) / np.maximum(lowpass(of, core, sig), 1e-3)
            face = np.clip(of * np.clip(ratio, 0.25, 4.0), 0, 1)
            out = np.clip((face * m[..., None] + sf * (1 - m[..., None])) * 255, 0, 255).astype(np.uint8)
            if dbg:
                d = np.concatenate([cv2.resize(out, (W // 4, H // 2)), cv2.resize(np.dstack([m * 255] * 3).astype(np.uint8), (W // 4, H // 2))], 1)
                dbg.stdin.write(d.tobytes())
        else: miss += 1
    else:
        miss += 1
        if dbg: dbg.stdin.write(np.zeros((H // 2, W // 2, 3), np.uint8).tobytes())
    enc.stdin.write(np.ascontiguousarray(out).tobytes()); n += 1
enc.stdin.close(); enc.wait()
if dbg: dbg.stdin.close(); dbg.wait()
print(f"frames {n}, face not found in {miss}")
