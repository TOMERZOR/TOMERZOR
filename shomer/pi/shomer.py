#!/usr/bin/env python3
"""Shomer for a Raspberry Pi (or any Linux computer) with a camera.

Watches the camera and sends a push notification through ntfy when something moves,
or only when a person is seen (--people). Uses the same channel as the web app,
so the phone pairs the same way.

    python3 shomer.py --topic shomer-xxxxxxxx --name "הכניסה"
    python3 shomer.py --topic ... --people --sensitivity 7
    python3 shomer.py --topic ... --source clip.mp4     # test on a video file
"""

import argparse
import secrets
import signal
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime

import cv2
import numpy as np

SMALL_W = 160


def sensitivity_to_threshold(level):
    # Same scale as the web app: 1 = 10% of the frame, 6 = about 0.8%, 10 = about 0.1%.
    return 0.1 * 0.6 ** (level - 1)


class MotionDetector:
    """Compares each small grayscale frame with a slowly adapting background."""

    def __init__(self, pixel_threshold=24, learn_rate=0.04, cell=8, cell_fill=0.25, warmup=8, light_change=0.5):
        self.pixel_threshold = pixel_threshold
        self.learn_rate = learn_rate
        self.cell = cell
        self.cell_fill = cell_fill
        self.warmup = warmup
        self.light_change = light_change
        self.reset()

    def reset(self):
        self.bg = None
        self.frames = 0

    def process(self, gray):
        """Returns (score, box): the share of the frame in motion and (x, y, w, h) or None."""
        h, w = gray.shape
        if self.bg is None or self.bg.shape != gray.shape:
            self.bg = gray.astype(np.float32)
            self.frames = 0
            return 0.0, None
        self.frames += 1

        changed = cv2.absdiff(gray, cv2.convertScaleAbs(self.bg)) > self.pixel_threshold
        cv2.accumulateWeighted(gray, self.bg, self.learn_rate)

        # Most of the picture changed at once: a light was switched on or the camera moved.
        if changed.mean() > self.light_change:
            self.bg = gray.astype(np.float32)
            return 0.0, None
        if self.frames < self.warmup:
            return 0.0, None

        # Only count cells where a real patch moved, so scattered sensor noise is ignored.
        c = self.cell
        rows, cols = -(-h // c), -(-w // c)
        padded = np.zeros((rows * c, cols * c), np.uint16)
        padded[:h, :w] = changed
        counts = padded.reshape(rows, c, cols, c).sum(axis=(1, 3))
        active = counts >= c * c * self.cell_fill
        moving = counts[active].sum()
        if not moving:
            return 0.0, None
        ys, xs = np.nonzero(active)
        x0, y0 = xs.min() * c, ys.min() * c
        x1, y1 = min(w, (xs.max() + 1) * c), min(h, (ys.max() + 1) * c)
        return moving / (w * h), (x0, y0, x1 - x0, y1 - y0)


class PeopleDetector:
    """OpenCV's built-in HOG person detector. No downloads, fine on a Pi 4/5 at a few checks a second."""

    def __init__(self):
        if not hasattr(cv2, "HOGDescriptor"):
            raise RuntimeError("this OpenCV build has no HOGDescriptor (install python3-opencv 4.x)")
        self.hog = cv2.HOGDescriptor()
        self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    def find(self, frame):
        scale = min(1.0, 480 / frame.shape[1])
        small = cv2.resize(frame, None, fx=scale, fy=scale) if scale < 1 else frame
        boxes, weights = self.hog.detectMultiScale(small, winStride=(8, 8), padding=(8, 8), scale=1.05)
        best = None
        for box, weight in zip(boxes, np.ravel(weights)):
            if weight >= 0.5 and (best is None or weight > best[1]):
                best = (box, weight)
        if best is None:
            return None
        x, y, w, h = (int(v / scale) for v in best[0])
        return x, y, w, h


def open_camera(source):
    """A Pi camera module through picamera2 when available, otherwise a USB camera or a video file."""
    if source is None:
        try:
            from picamera2 import Picamera2

            cam = Picamera2()
            cam.configure(cam.create_video_configuration(main={"size": (640, 480), "format": "RGB888"}))
            cam.start()
            return lambda: cam.capture_array(), cam.stop
        except ImportError:
            source = "0"
    cap = cv2.VideoCapture(int(source) if source.isdigit() else source)
    if not cap.isOpened():
        sys.exit(f"Can't open camera/video: {source}")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    def read():
        ok, frame = cap.read()
        return frame if ok else None

    return read, cap.release


def publish(server, topic, title, message, tags, priority, image=None):
    params = {"title": title, "tags": tags, "priority": str(priority)}
    body = message.encode()
    if image is not None:
        params.update(message=message, filename="shomer.jpg")
        body = image
    url = f"{server.rstrip('/')}/{urllib.parse.quote(topic)}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(urllib.request.Request(url, data=body, method="POST"), timeout=15) as res:
        return res.status


def main():
    p = argparse.ArgumentParser(description="Motion / person alerts to your phone through ntfy.")
    p.add_argument("--topic", help="ntfy channel (the same code the web app shows). A new one is made if omitted.")
    p.add_argument("--server", default="https://ntfy.sh")
    p.add_argument("--name", default="המצלמה", help="camera name shown in the alert")
    p.add_argument("--people", action="store_true", help="alert only when a person is detected")
    p.add_argument("--sensitivity", type=int, default=6, choices=range(1, 11), metavar="1-10")
    p.add_argument("--cooldown", type=float, default=30, help="seconds between alerts")
    p.add_argument("--no-photo", action="store_true", help="don't attach a photo")
    p.add_argument("--not-urgent", action="store_true", help="normal priority instead of urgent")
    p.add_argument("--source", help="camera index (0) or video file. Default: Pi camera, then camera 0")
    p.add_argument("--fps", type=float, default=8)
    args = p.parse_args()

    topic = args.topic or "shomer-" + secrets.token_hex(8)
    if not args.topic:
        print(f"New channel: {topic}\nIn the ntfy app on your phone, subscribe to this topic.", flush=True)

    read, close = open_camera(args.source)
    detector = MotionDetector()
    people = PeopleDetector() if args.people else None
    threshold = sensitivity_to_threshold(args.sensitivity)
    hot, last_alert, last_check = 0, 0.0, 0.0
    running = True

    def stop(*_):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    print(f"Watching ({'people' if people else 'any motion'}), channel {topic}", flush=True)

    try:
        while running:
            started = time.monotonic()
            frame = read()
            if frame is None:
                break
            h, w = frame.shape[:2]
            small_h = round(SMALL_W * h / w)
            gray = cv2.cvtColor(cv2.resize(frame, (SMALL_W, small_h), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
            score, box = detector.process(gray)
            hot = hot + 1 if score >= threshold else 0
            now = time.time()

            if hot >= 2 and now - last_alert >= args.cooldown:
                kind = None
                if people is None:
                    kind = "motion"
                    s = w / SMALL_W
                    box = tuple(int(v * s) for v in box) if box else None
                elif now - last_check >= 0.5:
                    last_check = now
                    box = people.find(frame)
                    kind = "person" if box else None

                if kind:
                    last_alert = now
                    stamp = datetime.now().strftime("%H:%M:%S")
                    image = None
                    if not args.no_photo:
                        shot = frame.copy()
                        if box:
                            x, y, bw, bh = box
                            cv2.rectangle(shot, (x, y), (x + bw, y + bh), (78, 59, 255), max(3, w // 160))
                        image = cv2.imencode(".jpg", shot, [cv2.IMWRITE_JPEG_QUALITY, 75])[1].tobytes()
                    title = f"{'זוהה אדם' if kind == 'person' else 'זוהתה תנועה'} · {args.name}"
                    try:
                        publish(args.server, topic, title, f"{args.name} · {stamp}",
                                "bust_in_silhouette,rotating_light" if kind == "person" else "rotating_light",
                                4 if args.not_urgent else 5, image)
                        print(f"{stamp} alert sent: {kind}", flush=True)
                    except Exception as e:  # keep watching even if the network hiccups
                        last_alert = now - args.cooldown + 5
                        print(f"{stamp} send failed: {e}", flush=True)

            time.sleep(max(0.0, 1 / args.fps - (time.monotonic() - started)))
    finally:
        close()


if __name__ == "__main__":
    main()
