#!/usr/bin/env python3
"""Shomer for a Raspberry Pi (or any Linux computer) with a camera. Local only.

Watches the camera and, when something moves (or only when a person is seen, --people),
alerts the phone that has the Pi's page open. The Pi serves the page itself: live video,
alerts with a photo, and an alarm if the Pi goes quiet. Nothing leaves the local network,
and nothing is saved to disk.

Run the Pi as its own Wi-Fi hotspot (see README) and open the printed address on your phone:

    python3 shomer.py --name "שיחים מול העמדה"
    python3 shomer.py --people --sensitivity 7
    python3 shomer.py --source clip.mp4                 # test on a video file
"""

import argparse
import json
import secrets
import signal
import sys
import threading
import time
from collections import deque
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import cv2
import numpy as np

SMALL_W = 160
VIEWER = Path(__file__).with_name("viewer.html")


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


class Hub:
    """What the watcher shares with the phone: the latest frame, recent alerts and a heartbeat."""

    def __init__(self, name):
        self.name = name
        self.cond = threading.Condition()
        self.jpeg = None
        self.frame_no = 0
        self.alerts = deque(maxlen=20)  # in memory only
        self.event_no = 0
        self.status = "wait"

    def put_frame(self, jpeg):
        with self.cond:
            self.jpeg = jpeg
            self.frame_no += 1
            self.cond.notify_all()

    def add_alert(self, alert):
        with self.cond:
            self.event_no += 1
            alert["id"] = self.event_no
            self.alerts.append(alert)
            self.cond.notify_all()


def make_handler(hub, key):
    page = VIEWER.read_text(encoding="utf-8")

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *args):
            pass

        def deny(self):
            self.send_response(403)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            url = urlparse(self.path)
            if parse_qs(url.query).get("k", [""])[0] != key:
                return self.deny()
            if url.path == "/":
                body = page.encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif url.path == "/stream":
                self.stream()
            elif url.path == "/events":
                self.events()
            elif url.path.startswith("/photo/"):
                self.photo(url.path.rsplit("/", 1)[-1])
            else:
                self.send_error(404)

        def stream(self):
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            seen = -1
            try:
                while True:
                    with hub.cond:
                        hub.cond.wait_for(lambda: hub.frame_no != seen, timeout=5)
                        seen, jpeg = hub.frame_no, hub.jpeg
                    if jpeg is None:
                        continue
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n" % len(jpeg))
                    self.wfile.write(jpeg + b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                pass

        def events(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            seen = hub.event_no
            try:
                while True:
                    with hub.cond:
                        hub.cond.wait_for(lambda: hub.event_no != seen, timeout=2)
                        new = [a for a in hub.alerts if a["id"] > seen]
                        seen = hub.event_no
                    for a in new:
                        data = {k: v for k, v in a.items() if k != "jpeg"}
                        data["photo"] = f"photo/{a['id']}?k={key}" if a.get("jpeg") else None
                        self.wfile.write(f"event: alert\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode())
                    # Heartbeat: the page sounds an alarm if these stop.
                    hb = {"name": hub.name, "status": hub.status}
                    self.wfile.write(f"event: hb\ndata: {json.dumps(hb, ensure_ascii=False)}\n\n".encode())
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass

        def photo(self, ident):
            with hub.cond:
                jpeg = next((a.get("jpeg") for a in hub.alerts if str(a["id"]) == ident), None)
            if not jpeg:
                return self.send_error(404)
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(jpeg)))
            self.end_headers()
            self.wfile.write(jpeg)

    return Handler


def main():
    p = argparse.ArgumentParser(description="Local motion / person alerts with live view. Nothing leaves your network.")
    p.add_argument("--name", default="המצלמה", help="camera name shown on the phone")
    p.add_argument("--people", action="store_true", help="alert only when a person is detected")
    p.add_argument("--sensitivity", type=int, default=6, choices=range(1, 11), metavar="1-10")
    p.add_argument("--cooldown", type=float, default=15, help="seconds between alerts")
    p.add_argument("--no-photo", action="store_true", help="don't attach a photo to alerts")
    p.add_argument("--source", help="camera index (0) or video file. Default: Pi camera, then camera 0")
    p.add_argument("--fps", type=float, default=8)
    p.add_argument("--host", default="0.0.0.0", help="address to serve the phone page on")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--key", help="access key in the page address (default: a new random one each start)")
    args = p.parse_args()

    key = args.key or secrets.token_urlsafe(9)
    hub = Hub(args.name)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(hub, key))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"Phone page: http://<this device's address>:{args.port}/?k={key}", flush=True)
    print(f"  (on the Pi's own hotspot: http://10.42.0.1:{args.port}/?k={key})", flush=True)

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
    print(f"Watching ({'people' if people else 'any motion'})", flush=True)

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
            s = w / SMALL_W
            motion_box = tuple(int(v * s) for v in box) if box and hot >= 2 else None
            hub.status = "move" if motion_box else "ok"

            alert_box = kind = None
            if hot >= 2 and now - last_alert >= args.cooldown:
                if people is None:
                    kind, alert_box = "motion", motion_box
                elif now - last_check >= 0.5:
                    last_check = now
                    alert_box = people.find(frame)
                    kind = "person" if alert_box else None

            if kind:
                last_alert = now
                stamp = datetime.now().strftime("%H:%M:%S")
                jpeg = None
                if not args.no_photo:
                    shot = frame.copy()
                    if alert_box:
                        x, y, bw, bh = alert_box
                        cv2.rectangle(shot, (x, y), (x + bw, y + bh), (78, 59, 255), max(3, w // 160))
                    jpeg = cv2.imencode(".jpg", shot, [cv2.IMWRITE_JPEG_QUALITY, 75])[1].tobytes()
                hub.add_alert({
                    "title": "זוהה אדם" if kind == "person" else "זוהתה תנועה",
                    "name": args.name,
                    "at": int(now * 1000),
                    "jpeg": jpeg,
                })
                print(f"{stamp} alert: {kind}", flush=True)

            # Live view frame, with the moving area boxed.
            live = frame.copy()
            if motion_box:
                x, y, bw, bh = motion_box
                cv2.rectangle(live, (x, y), (x + bw, y + bh), (3, 183, 255), max(2, w // 200))
            hub.put_frame(cv2.imencode(".jpg", live, [cv2.IMWRITE_JPEG_QUALITY, 60])[1].tobytes())

            time.sleep(max(0.0, 1 / args.fps - (time.monotonic() - started)))
    finally:
        close()
        server.shutdown()


if __name__ == "__main__":
    main()
