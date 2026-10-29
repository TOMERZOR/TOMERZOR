#!/usr/bin/env python3
"""WiFiDrop: AirDrop-style file and text sharing between a PC and an iPhone
on the same Wi-Fi.

The PC runs this server. The iPhone opens the address (scan the QR code on the
PC's page) in Safari, so nothing needs to be installed on the phone. Files
from the phone land in the received folder; files dropped on the PC's page go
to the "To iPhone" folder, where the phone can download them.

Only the Python 3 standard library is used.
"""

import argparse
import json
import mimetypes
import os
import re
import secrets
import socket
import subprocess
import sys
import threading
import time
import unicodedata
import webbrowser
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

VERSION = "1.0.0"
DEFAULT_PORT = 8765
CHUNK = 1024 * 1024
MAX_TEXT = 100_000
MAX_MESSAGES = 50
OUTBOX_NAME = "To iPhone"
CONFIG_NAME = ".wifidrop.json"
WEB_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / "web"

WINDOWS_RESERVED = {"CON", "PRN", "AUX", "NUL"} | {f"{p}{i}" for p in ("COM", "LPT") for i in range(1, 10)}


def default_dir():
    downloads = Path.home() / "Downloads"
    return (downloads if downloads.is_dir() else Path.home()) / "WiFiDrop"


def all_ips():
    """Every IPv4 address of this PC, for when lan_ip() picks a VPN or virtual adapter."""
    ips = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips


def lan_ip():
    """The address other devices on the network reach this PC at."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No packet is sent; this only asks the OS which interface routes out.
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "127.0.0.1"
    finally:
        s.close()


def safe_name(name, content_type=""):
    """Turn whatever the client sent into a file name that is safe on every OS."""
    name = unicodedata.normalize("NFC", name or "")
    name = name.replace("\\", "/").split("/")[-1]
    name = re.sub(r'[<>:"|?*\x00-\x1f]', "_", name).strip(" .")
    stem, ext = os.path.splitext(name)
    if stem.upper() in WINDOWS_RESERVED:
        stem = "_" + stem
    if not stem:
        stem = time.strftime("iPhone %Y-%m-%d %H.%M.%S")
    if not ext and content_type:
        guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
        ext = {".jpe": ".jpg", ".jpeg": ".jpg"}.get(guessed, guessed) or ""
    return stem[:150] + ext[:20]


def unique_path(folder, name):
    path = folder / name
    stem, ext = os.path.splitext(name)
    n = 1
    while path.exists():
        path = folder / f"{stem} ({n}){ext}"
        n += 1
    return path


def human_size(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def open_in_os(path):
    if sys.platform.startswith("win"):
        os.startfile(path)  # noqa: S606 (only reachable from localhost)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


class State:
    """Everything the server shares between requests."""

    def __init__(self, root, token, port):
        self.root = root
        self.outbox = root / OUTBOX_NAME
        self.token = token
        self.port = port
        self.messages = []
        self.recent = []  # files received this session, newest first
        self.version = 0
        self.cond = threading.Condition()
        self.root.mkdir(parents=True, exist_ok=True)
        self.outbox.mkdir(exist_ok=True)

    def bump(self):
        with self.cond:
            self.version += 1
            self.cond.notify_all()

    def wait_change(self, seen, timeout):
        with self.cond:
            self.cond.wait_for(lambda: self.version != seen, timeout=timeout)
            return self.version

    def url(self):
        return f"http://{lan_ip()}:{self.port}/?k={self.token}"

    def outbox_files(self):
        files = []
        for p in self.outbox.iterdir():
            if p.is_file() and not p.name.startswith(".") and not p.name.endswith(".part"):
                st = p.stat()
                files.append({"name": p.name, "size": st.st_size, "mtime": st.st_mtime})
        return sorted(files, key=lambda f: f["mtime"], reverse=True)

    def snapshot(self):
        return {
            "version": self.version,
            "outbox": self.outbox_files(),
            "received": self.recent[:100],
            "messages": self.messages,
        }

    def add_message(self, text, sender):
        with self.cond:
            self.messages.insert(0, {"id": secrets.token_hex(4), "text": text, "from": sender, "time": time.time()})
            del self.messages[MAX_MESSAGES:]
        self.bump()


class Handler(BaseHTTPRequestHandler):
    server_version = f"WiFiDrop/{VERSION}"
    protocol_version = "HTTP/1.1"
    state: State = None

    # -- helpers ---------------------------------------------------------

    def log_message(self, fmt, *args):
        if self.server.verbose:
            super().log_message(fmt, *args)

    @property
    def is_local(self):
        return self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def query(self):
        return {k: v[-1] for k, v in parse_qs(urlparse(self.path).query).items()}

    def authorized(self):
        if self.is_local:
            return True
        key = self.query().get("k") or self.headers.get("X-WiFiDrop-Key")
        if not key:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            key = cookie["wd"].value if "wd" in cookie else None
        return bool(key) and secrets.compare_digest(key, self.state.token)

    def send_json(self, data, status=HTTPStatus.OK):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def error(self, status, message):
        self.send_json({"error": message}, status)

    def read_body(self, out):
        """Copy the request body to `out` in chunks, plain or chunked encoding."""
        total = 0
        if "chunked" in self.headers.get("Transfer-Encoding", "").lower():
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    while self.rfile.readline() not in (b"\r\n", b"\n", b""):
                        pass
                    return total
                remaining = size
                while remaining:
                    data = self.rfile.read(min(CHUNK, remaining))
                    if not data:
                        raise ConnectionError("upload cut off")
                    out.write(data)
                    remaining -= len(data)
                total += size
                self.rfile.readline()
        remaining = int(self.headers.get("Content-Length") or 0)
        while remaining:
            data = self.rfile.read(min(CHUNK, remaining))
            if not data:
                raise ConnectionError("upload cut off")
            out.write(data)
            remaining -= len(data)
            total += len(data)
        return total

    def read_small_body(self, limit):
        length = int(self.headers.get("Content-Length") or 0)
        if length > limit:
            return None
        return self.rfile.read(length)

    # -- routing ---------------------------------------------------------

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            return self.serve_page()
        if path.startswith("/static/"):
            return self.serve_static(path[len("/static/"):])
        if not self.authorized():
            return self.error(HTTPStatus.FORBIDDEN, "Wrong or missing key. Scan the QR code on the PC again.")
        if path == "/api/info":
            return self.send_json({
                "host": self.is_local,
                "url": self.state.url(),
                "otherUrls": [f"http://{ip}:{self.state.port}/?k={self.state.token}" for ip in all_ips() if ip != lan_ip()] if self.is_local else [],
                "folder": str(self.state.root),
                "computer": socket.gethostname(),
                "version": VERSION,
            })
        if path == "/api/state":
            return self.send_json(self.state.snapshot())
        if path == "/api/events":
            return self.stream_events()
        if path.startswith("/files/"):
            return self.serve_file(unquote(path[len("/files/"):]))
        if path == "/api/latest-text":
            text = self.state.messages[0]["text"] if self.state.messages else ""
            body = text.encode()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        self.error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self):
        path = urlparse(self.path).path
        if not self.authorized():
            return self.error(HTTPStatus.FORBIDDEN, "Wrong or missing key. Scan the QR code on the PC again.")
        if path == "/api/upload":
            return self.receive_file()
        if path == "/api/text":
            return self.receive_text()
        if path == "/api/open" and self.is_local:
            return self.open_folder()
        self.error(HTTPStatus.NOT_FOUND, "Not found")

    def do_DELETE(self):
        path = urlparse(self.path).path
        if not self.is_local:
            return self.error(HTTPStatus.FORBIDDEN, "Only the PC can remove shared files")
        if path.startswith("/files/"):
            target = self.outbox_path(unquote(path[len("/files/"):]))
            if not target:
                return self.error(HTTPStatus.NOT_FOUND, "No such file")
            target.unlink()
            self.state.bump()
            return self.send_json({"ok": True})
        if path == "/api/messages":
            with self.state.cond:
                self.state.messages.clear()
            self.state.bump()
            return self.send_json({"ok": True})
        self.error(HTTPStatus.NOT_FOUND, "Not found")

    # -- pages -----------------------------------------------------------

    def serve_page(self):
        if not self.authorized():
            body = (WEB_DIR / "locked.html").read_bytes()
            self.send_response(HTTPStatus.FORBIDDEN)
        else:
            body = (WEB_DIR / "index.html").read_bytes()
            self.send_response(HTTPStatus.OK)
            if not self.is_local:
                # Remember the key so links without it (downloads, events) keep working.
                self.send_header("Set-Cookie", f"wd={self.state.token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax")
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, rel):
        target = (WEB_DIR / rel).resolve()
        if WEB_DIR.resolve() not in target.parents or not target.is_file():
            return self.error(HTTPStatus.NOT_FOUND, "Not found")
        body = target.read_bytes()
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def stream_events(self):
        """Server-sent events: tells pages to refresh whenever something changes."""
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        seen = -1
        try:
            while not self.server.stopping:
                if seen != self.state.version:
                    seen = self.state.version
                    self.wfile.write(f"data: {seen}\n\n".encode())
                else:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
                self.state.wait_change(seen, timeout=15)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    # -- files -----------------------------------------------------------

    def outbox_path(self, name):
        if not name or "/" in name or "\\" in name or name.startswith("."):
            return None
        target = self.state.outbox / name
        return target if target.is_file() else None

    def serve_file(self, name):
        target = self.outbox_path(name)
        if not target:
            return self.error(HTTPStatus.NOT_FOUND, "That file is no longer shared")
        size = target.stat().st_size
        start, end = 0, size - 1
        status = HTTPStatus.OK
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if match and size:
            if match.group(1):
                start = int(match.group(1))
                end = min(int(match.group(2)), size - 1) if match.group(2) else size - 1
            elif match.group(2):
                start = max(0, size - int(match.group(2)))
            if start > end:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                return self.end_headers()
            status = HTTPStatus.PARTIAL_CONTENT
        inline = self.query().get("view") == "1"
        disposition = "inline" if inline else "attachment"
        self.send_response(status)
        self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Disposition", f"{disposition}; filename*=UTF-8''{quote(target.name)}")
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        try:
            with target.open("rb") as f:
                f.seek(start)
                remaining = end - start + 1
                while remaining:
                    data = f.read(min(CHUNK, remaining))
                    if not data:
                        break
                    self.wfile.write(data)
                    remaining -= len(data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def receive_file(self):
        q = self.query()
        raw_name = q.get("name") or unquote(self.headers.get("X-Filename", ""))
        to_outbox = q.get("to") == "iphone" and self.is_local
        folder = self.state.outbox if to_outbox else self.state.root
        name = safe_name(raw_name, self.headers.get("Content-Type", ""))
        with self.state.cond:
            target = unique_path(folder, name)
            target.touch()  # reserve the name against parallel uploads
        part = target.with_name(target.name + ".part")
        try:
            with part.open("wb") as out:
                size = self.read_body(out)
            os.replace(part, target)
        except (ConnectionError, OSError) as e:
            part.unlink(missing_ok=True)
            target.unlink(missing_ok=True)
            self.close_connection = True
            print(f"  ✕ {name} didn't arrive ({e})", flush=True)
            return
        if not to_outbox:
            with self.state.cond:
                self.state.recent.insert(0, {"name": target.name, "size": size, "time": time.time()})
            print(f"  ← received {target.name} ({human_size(size)})", flush=True)
        self.state.bump()
        self.send_json({"ok": True, "name": target.name, "size": size})

    def receive_text(self):
        body = self.read_small_body(MAX_TEXT)
        if body is None:
            self.close_connection = True
            return self.error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Text is too long")
        if "json" in self.headers.get("Content-Type", ""):
            try:
                text = json.loads(body or b"{}").get("text", "")
            except (ValueError, AttributeError):
                return self.error(HTTPStatus.BAD_REQUEST, "Bad JSON")
        else:
            text = body.decode("utf-8", "replace")
        text = text.strip()
        if not text:
            return self.error(HTTPStatus.BAD_REQUEST, "Nothing to send")
        self.state.add_message(text, "pc" if self.is_local else "iphone")
        if not self.is_local:
            print(f"  ← text: {text[:60]}{'…' if len(text) > 60 else ''}", flush=True)
        self.send_json({"ok": True})

    def open_folder(self):
        body = self.read_small_body(1000) or b"{}"
        which = json.loads(body).get("folder")
        open_in_os(self.state.outbox if which == "outbox" else self.state.root)
        self.send_json({"ok": True})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    stopping = False
    verbose = False


def load_token(root, new_key):
    config = root / CONFIG_NAME
    try:
        data = json.loads(config.read_text())
    except (OSError, ValueError):
        data = {}
    if new_key or not data.get("token"):
        data["token"] = secrets.token_urlsafe(9)
        root.mkdir(parents=True, exist_ok=True)
        config.write_text(json.dumps(data))
    return data["token"]


def terminal_qr(text):
    """Print a QR code in the terminal when the optional `qrcode` package is installed."""
    try:
        import qrcode  # type: ignore
    except ImportError:
        return
    qr = qrcode.QRCode(border=1)
    qr.add_data(text)
    qr.print_ascii(invert=True)


def main():
    parser = argparse.ArgumentParser(description="Share files and text between this PC and an iPhone on the same Wi-Fi.")
    parser.add_argument("-p", "--port", type=int, default=DEFAULT_PORT, help=f"port to listen on (default {DEFAULT_PORT})")
    parser.add_argument("-d", "--dir", type=Path, default=default_dir(), help="folder for received files (default ~/Downloads/WiFiDrop)")
    parser.add_argument("--new-key", action="store_true", help="make a new access key, so phones that connected before must scan again")
    parser.add_argument("--no-browser", action="store_true", help="don't open the PC page in the browser")
    parser.add_argument("-v", "--verbose", action="store_true", help="log every request")
    args = parser.parse_args()
    for stream in (sys.stdout, sys.stderr):
        if stream is not None and hasattr(stream, "reconfigure"):
            # Windows consoles can't print every file name; don't crash over it.
            stream.reconfigure(errors="replace")

    root = args.dir.expanduser().resolve()
    state = State(root, load_token(root, args.new_key), args.port)
    Handler.state = state
    try:
        server = Server(("0.0.0.0", args.port), Handler)
    except OSError as e:
        sys.exit(f"Can't listen on port {args.port} ({e}). Is WiFiDrop already running? Try --port {args.port + 1}")
    server.verbose = args.verbose

    url = state.url()
    print(f"\nWiFiDrop {VERSION} is running.\n")
    print(f"  On the iPhone, open:  {url}")
    print(f"  Received files go to: {root}")
    print(f"  Files for the iPhone: {state.outbox}\n")
    terminal_qr(url)
    print("Keep this window open. Press Ctrl+C to stop.\n", flush=True)
    if not args.no_browser:
        threading.Timer(0.5, webbrowser.open, (f"http://localhost:{args.port}/",)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.stopping = True
        state.bump()
        server.server_close()


if __name__ == "__main__":
    main()
