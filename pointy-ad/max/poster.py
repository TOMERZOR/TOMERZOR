"""Relabels the "Employee of the Month" poster in the last shot of the Max clip in Hebrew ("העובד של החודש").

- finds the last shot (scene cut) and the poster in a clean frame of it (the black frame on the white wall),
- tracks the poster through the shot with multi-scale template matching; frames where Max walks in front
  of it are filled in by interpolating the track,
- paints paper and the Hebrew title over the English one, but only on paper and ink pixels, so Max's fur
  and the mug stay in front of the poster,
- matches the footage: slight blur and grain.
Prints the poster centre at a given time in 1920×1080 coordinates, for the cursor click in edit.cjs.

usage: python3 poster.py <in.mp4> <out.mp4> [click_time]
"""
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

src, dst = sys.argv[1], sys.argv[2]
click_t = float(sys.argv[3]) if len(sys.argv) > 3 else None
FONT = "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"
TITLE = ["העובד", "של החודש"]

cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
H, W = frames[0].shape[:2]
print(f"{len(frames)} frames {W}x{H} @ {fps}")

# 1. the last shot: the last big jump in the frame-to-frame difference
small = [cv2.resize(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (96, 54)).astype(np.float32) for f in frames]
diff = np.array([0] + [np.mean(np.abs(small[i] - small[i - 1])) for i in range(1, len(small))])
start = int(np.argmax(np.where(np.arange(len(diff)) > len(diff) * .6, diff, 0)))
print("last shot starts at frame", start, f"({start / fps:.2f}s)")

# 2. the poster in the clean last frame: the biggest dark, roughly 3:4 component
ref = frames[-1]
gray = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
dark = (gray < 70).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
best = None
for i in range(1, n):
    x, y, w, h, a = stats[i]
    if w > W * .06 and h > H * .15 and .55 < w / h < 1.0 and (best is None or w * h > best[2] * best[3]):
        best = (x, y, w, h)
px, py, pw, ph = best
print("poster in the last frame:", best)
tmpl = cv2.cvtColor(ref[py:py + ph, px:px + pw], cv2.COLOR_BGR2GRAY)

# 3. track it: best match over a range of scales (the camera pushes in)
track = {}
for i in range(start, len(frames)):
    g = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
    top = None
    for s in np.arange(.78, 1.08, .02):
        sw, sh = max(8, int(pw * s)), max(8, int(ph * s))
        # the whole poster, and only its top part (frame + title), which stays visible when Max walks by below it
        for part in (1.0, .42):
            t = cv2.resize(tmpl[:int(ph * part)], (sw, max(8, int(sh * part))))
            if t.shape[0] >= g.shape[0] or t.shape[1] >= g.shape[1]:
                continue
            r = cv2.matchTemplate(g, t, cv2.TM_CCOEFF_NORMED)
            _, v, _, loc = cv2.minMaxLoc(r)
            if top is None or v > top[0]:
                top = (v, loc[0], loc[1], sw, sh)
    track[i] = top
good = [i for i in track if track[i][0] > .62]
print(f"tracked confidently in {len(good)}/{len(track)} frames")
idx = np.array(good)
boxes = {}
for i in track:
    if i in good:
        boxes[i] = np.array(track[i][1:], float)
    else:                                                          # occluded: interpolate the track
        boxes[i] = np.array([np.interp(i, idx, [track[j][k] for j in good]) for k in range(1, 5)])
keys = sorted(boxes)
arr = np.array([boxes[k] for k in keys])
ker = np.ones(5) / 5                                               # light smoothing against jitter
arr = np.stack([np.convolve(np.pad(arr[:, k], 2, mode="edge"), ker, "valid") for k in range(4)], 1)
boxes = {k: arr[j] for j, k in enumerate(keys)}

# 4. the title strip inside the poster (between the top border and the photo), measured on the template
rowmean = tmpl[:, int(pw * .15):int(pw * .85)].mean(1)
paper_lvl = np.percentile(rowmean[int(ph * .03):int(ph * .3)], 90)
r0 = next(r for r in range(int(ph * .01), int(ph * .2)) if rowmean[r] > paper_lvl - 25)          # inside the top border
r1 = next(r for r in range(r0 + int(ph * .08), int(ph * .45)) if rowmean[r] < paper_lvl - 45)    # where the photo starts
TX0, TX1 = .1, .9
TY0, TY1 = (r0 + 1) / ph, (r1 - 2) / ph
print(f"title strip: y {TY0:.3f}-{TY1:.3f} of the poster")


def title_patch(w, h, paper, ink):
    """The Hebrew title on paper, at 4x and scaled down, like the poster's two-line serif title."""
    S = 4
    im = Image.new("RGB", (w * S, h * S), tuple(int(c) for c in paper))
    d = ImageDraw.Draw(im)
    size = int(h * S * .42)
    font = ImageFont.truetype(FONT, size, layout_engine=ImageFont.Layout.RAQM)
    for k, line in enumerate(TITLE):
        bw = d.textlength(line, font=font, direction="rtl")
        while bw > w * S * .92:
            size = int(size * .94)
            font = ImageFont.truetype(FONT, size, layout_engine=ImageFont.Layout.RAQM)
            bw = d.textlength(line, font=font, direction="rtl")
        y = h * S * (.06 + k * .47)
        d.text(((w * S - bw) / 2, y), line, font=font, fill=tuple(int(c) for c in ink), direction="rtl")
    return np.asarray(im.resize((w, h), Image.LANCZOS))


# paper and ink colours, from the clean frame
strip = ref[py + int(ph * TY0):py + int(ph * TY1), px + int(pw * TX0):px + int(pw * TX1)].reshape(-1, 3).astype(float)
lum = strip.mean(1)
paper = np.median(strip[lum > np.percentile(lum, 60)], 0)[::-1]   # BGR -> RGB
ink = np.median(strip[lum < np.percentile(lum, 8)], 0)[::-1]
rng = np.random.default_rng(1)
clean_strip = ref[py + int(round(ph * TY0)):py + int(round(ph * TY1)), px + int(round(pw * TX0)):px + int(round(pw * TX1))]

out = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                        "-i", src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p",
                        "-c:a", "copy", dst], stdin=subprocess.PIPE)
for i, f in enumerate(frames):
    if i in boxes:
        x, y, w, h = boxes[i]
        x0, x1 = int(round(x + w * TX0)), int(round(x + w * TX1))
        y0, y1 = int(round(y + h * TY0)), int(round(y + h * TY1))
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        if x1 - x0 > 6 and y1 - y0 > 4:
            reg = f[y0:y1, x0:x1].astype(np.float32)
            patch = title_patch(x1 - x0, y1 - y0, paper, ink)[..., ::-1].astype(np.float32)
            patch = cv2.GaussianBlur(patch, (0, 0), .55) + rng.normal(0, 2.2, patch.shape)
            # keep whatever doesn't look like the poster there (Max's fur, ear, nose, the mug): compare with the
            # clean poster strip, softened so a pixel of tracking error on the old lettering doesn't count
            expect = cv2.resize(clean_strip, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA).astype(np.float32)
            d = np.abs(cv2.GaussianBlur(reg, (0, 0), 2.2) - cv2.GaussianBlur(expect, (0, 0), 2.2)).mean(2)
            occ = cv2.dilate((d > 32).astype(np.float32), np.ones((5, 5), np.uint8))
            alpha = 1 - cv2.GaussianBlur(occ, (0, 0), 1.5)
            # soft edges so the patch melts into the poster
            ey = np.minimum(1, np.minimum(np.arange(y1 - y0), np.arange(y1 - y0)[::-1]) / 2 + .3)[:, None]
            ex = np.minimum(1, np.minimum(np.arange(x1 - x0), np.arange(x1 - x0)[::-1]) / 2 + .3)[None, :]
            alpha = (alpha * ey * ex)[..., None]
            f = f.copy()
            f[y0:y1, x0:x1] = np.clip(reg * (1 - alpha) + patch * alpha, 0, 255).astype(np.uint8)
    out.stdin.write(f.tobytes())
out.stdin.close()
out.wait()

if click_t is not None:
    k = min(boxes, key=lambda j: abs(j / fps - click_t))
    x, y, w, h = boxes[k]
    print(f"TARGET {round((x + w / 2) * 1920 / W)},{round((y + h * .45) * 1080 / H)}")
print("wrote", dst)
