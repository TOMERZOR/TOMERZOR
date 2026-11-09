"""cutout.py in.mp4 outdir [--debug N out.png]

The person, cut out of the room and colour-graded, as RGBA WebP frames for the composition.
  matte   RobustVideoMatting (ONNX), recurrent, so the edge doesn't flicker; tightened a touch so no room shows.
  colour  at the edge, RVM's own foreground estimate (the room's white light removed from hair and shoulders);
          inside, the original pixels.
  grade   lift the face a little, warm skin, deeper blacks in the hoodie, a gentle S, slight teal in the shadows to
          sit on the dark screen behind, so he reads as lit by the screen and not by a white window.
"""
import sys, os, json, subprocess, argparse
import numpy as np, cv2, onnxruntime as ort
ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("out"); ap.add_argument("--debug", nargs=2); a = ap.parse_args()
M = "/tmp/claude-0/-home-user-TOMERZOR/57893ae3-acda-505c-b44d-0e56fba7243b/scratchpad/models/rvm_mobilenetv3_fp32.onnx"
W, H = 1080, 1920
os.makedirs(a.out, exist_ok=True)
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", a.src, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
so = ort.SessionOptions(); so.intra_op_num_threads = 4
sess = ort.InferenceSession(M, so, providers=["CPUExecutionProvider"]); rec = [np.zeros([1, 1, 1, 1], np.float32)] * 4
xs = np.linspace(0, 1, 1024, dtype=np.float32)
def curve(x, lift, gain, gamma, s):
    y = lift + (gain - lift) * np.power(x, gamma); return np.clip(y + s * (y - 0.5) * (1 - np.abs(2 * y - 1)), 0, 1)
LUT = np.stack([curve(xs, 0.012, 1.0, 0.91, 0.18), curve(xs, 0.012, 0.965, 0.97, 0.18), curve(xs, 0.024, 0.9, 1.02, 0.15)], 1)
dbg = int(a.debug[0]) if a.debug else -1; n = 0
while True:
    b = dec.stdout.read(W * H * 3)
    if len(b) < W * H * 3: break
    fr = np.frombuffer(b, np.uint8).reshape(H, W, 3)
    x = fr.transpose(2, 0, 1)[None].astype(np.float32) / 255
    fgr, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": np.array([0.3], np.float32)})
    if dbg >= 0 and n < dbg: n += 1; continue
    al = np.clip(pha[0, 0], 0, 1)
    al = np.clip((al - 0.06) / 0.9, 0, 1) ** 1.15                       # tighten: no room at the edge
    al = cv2.GaussianBlur(al, (0, 0), 0.8)
    fg = np.clip(fgr[0].transpose(1, 2, 0), 0, 1); orig = fr.astype(np.float32) / 255
    inner = np.clip((al - 0.9) / 0.1, 0, 1)[..., None]                   # edges take RVM's de-spilled colour
    col = orig * inner + fg * (1 - inner)
    idx = np.clip(col * 1023, 0, 1023).astype(np.int32)
    col = np.stack([LUT[idx[..., k], k] for k in range(3)], -1)
    lum = col @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    col = lum[..., None] + (col - lum[..., None]) * 1.06                  # a touch more colour
    rgba = np.dstack([np.clip(col, 0, 1) * 255, al * 255]).astype(np.uint8)
    bgra = cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA)
    if dbg >= 0: cv2.imwrite(a.debug[1], bgra); print("debug written"); break
    cv2.imwrite(os.path.join(a.out, f"{n + 1:05d}.webp"), bgra, [cv2.IMWRITE_WEBP_QUALITY, 92]); n += 1
print("frames", n)
