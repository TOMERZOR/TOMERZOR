#!/usr/bin/env python3
"""WiFiDrop: AirDrop-style file and text sharing between a PC and an iPhone
on the same Wi-Fi.

The PC runs this server. The iPhone opens the address (scan the QR code on the
PC's page) in Safari, so nothing needs to be installed on the phone. Files
from the phone land in the received folder; files dropped on the PC's page go
to the "To iPhone" folder, where the phone can download them.

The server itself needs only the Python 3 standard library. When `pystray`
and `Pillow` are installed (they are in the Windows .exe) it also shows a tray
icon with notifications.
"""

import argparse
import json
import mimetypes
import os
import re
import secrets
import socket
import struct
import subprocess
import sys
import threading
import time
import unicodedata
import urllib.request
import webbrowser
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

VERSION = "1.1.0"
DEFAULT_PORT = 8765
CHUNK = 1024 * 1024
MAX_TEXT = 100_000
MAX_MESSAGES = 50
OUTBOX_NAME = "To iPhone"
CONFIG_NAME = ".wifidrop.json"
DEFAULT_NAME = "wifidrop"
MDNS_GROUP, MDNS_PORT = "224.0.0.251", 5353
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
WEB_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / "web"

mimetypes.add_type("application/manifest+json", ".webmanifest")

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


class MdnsResponder(threading.Thread):
    """Answers multicast DNS lookups for NAME.local with this PC's address, so the
    iPhone can keep using http://NAME.local:PORT even when the router hands the
    PC a different IP. iOS resolves .local names this way natively."""

    def __init__(self, name):
        super().__init__(daemon=True)
        self.host = f"{name}.local"
        self.labels = [label.encode() for label in self.host.lower().split(".")]
        self.sock = None

    def open(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        # Share the port with the OS's own mDNS service (and Chrome, iTunes, ...).
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        if hasattr(socket, "SO_REUSEPORT"):
            try:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
            except OSError:
                pass
        s.bind(("", MDNS_PORT))
        joined = False
        for ip in [lan_ip()] + all_ips():
            try:
                s.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, socket.inet_aton(MDNS_GROUP) + socket.inet_aton(ip))
                joined = True
            except OSError:
                pass
        if not joined:
            s.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, socket.inet_aton(MDNS_GROUP) + socket.inet_aton("0.0.0.0"))
        s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 255)
        try:
            s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(lan_ip()))
        except OSError:
            pass
        self.sock = s

    def encoded_name(self):
        return b"".join(bytes([len(label)]) + label for label in self.labels) + b"\0"

    def answer(self, ttl, cache_flush=True):
        rclass = 0x8001 if cache_flush else 0x0001
        return self.encoded_name() + struct.pack("!HHIH", 1, rclass, ttl, 4) + socket.inet_aton(lan_ip())

    def announce(self):
        packet = struct.pack("!6H", 0, 0x8400, 0, 1, 0, 0) + self.answer(120)
        self.sock.sendto(packet, (MDNS_GROUP, MDNS_PORT))

    @staticmethod
    def read_name(data, pos):
        labels, jumped, end = [], False, pos
        for _ in range(64):
            length = data[pos]
            if length & 0xC0 == 0xC0:
                if not jumped:
                    end = pos + 2
                pos = ((length & 0x3F) << 8) | data[pos + 1]
                jumped = True
                continue
            if length == 0:
                return labels, (end if jumped else pos + 1)
            labels.append(data[pos + 1:pos + 1 + length].lower())
            pos += 1 + length
        raise ValueError("name too long")

    def handle(self, data, addr):
        qid, flags, qdcount = struct.unpack("!3H", data[:6])
        if flags & 0x8000:
            return  # a response, not a question
        pos = 12
        for _ in range(qdcount):
            labels, pos = self.read_name(data, pos)
            qtype, qclass = struct.unpack("!HH", data[pos:pos + 4])
            pos += 4
            if labels != self.labels or qtype not in (1, 255):
                continue
            if addr[1] != MDNS_PORT:
                # "Legacy" one-shot query: reply straight back, echoing the question.
                question = self.encoded_name() + struct.pack("!HH", qtype, qclass & 0x7FFF)
                packet = struct.pack("!6H", qid, 0x8400, 1, 1, 0, 0) + question + self.answer(10, cache_flush=False)
                self.sock.sendto(packet, addr)
            else:
                packet = struct.pack("!6H", 0, 0x8400, 0, 1, 0, 0) + self.answer(120)
                self.sock.sendto(packet, (MDNS_GROUP, MDNS_PORT))
                if qclass & 0x8000:  # the asker wants a unicast reply too
                    self.sock.sendto(packet, addr)
            return

    def run(self):
        try:
            self.announce()
        except OSError:
            pass
        while True:
            try:
                data, addr = self.sock.recvfrom(9000)
                self.handle(data, addr)
            except (OSError, ValueError, IndexError, struct.error):
                continue


def start_mdns(name):
    responder = MdnsResponder(name)
    try:
        responder.open()
    except OSError as e:
        print(f"  (Can't announce {responder.host}: {e}. Use the IP address instead.)")
        return None
    responder.start()
    return responder


def autostart_command():
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}" --background'
    pythonw = Path(sys.executable).with_name("pythonw.exe")
    exe = pythonw if pythonw.exists() else Path(sys.executable)
    return f'"{exe}" "{Path(__file__).resolve()}" --background'


def get_autostart():
    if not sys.platform.startswith("win"):
        return None
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.QueryValueEx(key, "WiFiDrop")
            return True
    except OSError:
        return False


def set_autostart(enabled):
    """Start WiFiDrop in the background when the user signs in to Windows."""
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
        if enabled:
            winreg.SetValueEx(key, "WiFiDrop", 0, winreg.REG_SZ, autostart_command())
        else:
            try:
                winreg.DeleteValue(key, "WiFiDrop")
            except FileNotFoundError:
                pass


class State:
    """Everything the server shares between requests."""

    def __init__(self, root, config, port, name):
        self.root = root
        self.outbox = root / OUTBOX_NAME
        self.token = config["token"]
        self.instance = config["instance"]
        self.port = port
        self.mdns_host = f"{name}.local"
        self.mdns = None
        self.notify = lambda title, message: None
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

    def stable_url(self):
        return f"http://{self.mdns_host}:{self.port}/?k={self.token}"

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
        if path == "/api/ping":
            # Public, so the phone page can check whether NAME.local reaches this same PC.
            body = json.dumps({"app": "wifidrop", "instance": self.state.instance}).encode()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return self.wfile.write(body)
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
                "instance": self.state.instance,
                "mdnsHost": self.state.mdns_host if self.state.mdns else None,
                "port": self.state.port,
                "stableUrl": self.state.stable_url() if self.state.mdns else None,
                "autostart": get_autostart() if self.is_local else None,
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
        if path == "/api/autostart" and self.is_local:
            body = self.read_small_body(1000) or b"{}"
            try:
                set_autostart(bool(json.loads(body).get("enabled")))
            except (OSError, ImportError, ValueError) as e:
                return self.error(HTTPStatus.INTERNAL_SERVER_ERROR, str(e))
            return self.send_json({"autostart": get_autostart()})
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
            self.state.notify("התקבל מהאייפון", target.name)
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
            self.state.notify("טקסט מהאייפון", text[:200])
        self.send_json({"ok": True})

    def open_folder(self):
        body = self.read_small_body(1000) or b"{}"
        which = json.loads(body).get("folder")
        open_in_os(self.state.outbox if which == "outbox" else self.state.root)
        self.send_json({"ok": True})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # On Windows SO_REUSEADDR lets a second copy bind the same port, so it asks
    # for exclusive use instead; elsewhere it only allows a quick restart.
    allow_reuse_address = not sys.platform.startswith("win")
    stopping = False
    verbose = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def load_config(root, new_key):
    config = root / CONFIG_NAME
    try:
        data = json.loads(config.read_text())
    except (OSError, ValueError):
        data = {}
    changed = False
    if new_key or not data.get("token"):
        data["token"] = secrets.token_urlsafe(9)
        changed = True
    if not data.get("instance"):
        data["instance"] = secrets.token_hex(6)
        changed = True
    if changed:
        save_config(root, data)
    return data


def save_config(root, data):
    root.mkdir(parents=True, exist_ok=True)
    (root / CONFIG_NAME).write_text(json.dumps(data))


def running_instance(port):
    """True when WiFiDrop already answers on this port."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=2) as res:
            return json.load(res).get("app") == "wifidrop"
    except (OSError, ValueError):
        return False


def message_box(text):
    """Without a console window (the .exe), errors have to be shown some other way."""
    if sys.platform.startswith("win") and getattr(sys, "frozen", False):
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, text, "WiFiDrop", 0x10)


def run_tray(state, local_url, on_quit):
    """Tray icon with a menu and notifications. Returns False when it can't be shown."""
    try:
        import pystray  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError:
        return False

    def toggle_autostart(icon, item):
        try:
            set_autostart(not get_autostart())
        except OSError:
            pass

    items = [
        pystray.MenuItem("פתיחה", lambda: webbrowser.open(local_url), default=True),
        pystray.MenuItem("תיקיית הקבצים שהתקבלו", lambda: open_in_os(state.root)),
    ]
    if sys.platform.startswith("win"):
        items.append(pystray.MenuItem("הפעלה עם Windows", toggle_autostart, checked=lambda item: bool(get_autostart())))
    items += [pystray.Menu.SEPARATOR, pystray.MenuItem("יציאה", lambda icon: (on_quit(), icon.stop()))]
    icon = pystray.Icon("WiFiDrop", Image.open(WEB_DIR / "icon.png"), "WiFiDrop", pystray.Menu(*items))

    def notify(title, message):
        try:
            icon.notify(message, title)
        except Exception:  # notifications are a nicety; never let them break a transfer
            pass

    state.notify = notify
    try:
        icon.run()
    except Exception as e:
        print(f"  (No tray icon: {e})")
        state.notify = lambda title, message: None
        return False
    return True


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
    parser.add_argument("-n", "--name", default=DEFAULT_NAME, help=f"permanent address NAME.local for the iPhone (default {DEFAULT_NAME})")
    parser.add_argument("--new-key", action="store_true", help="make a new access key, so phones that connected before must scan again")
    parser.add_argument("--no-browser", action="store_true", help="don't open the PC page in the browser")
    parser.add_argument("--background", action="store_true", help="start quietly (used when starting with Windows)")
    parser.add_argument("--no-tray", action="store_true", help="no tray icon; stop with Ctrl+C")
    parser.add_argument("-v", "--verbose", action="store_true", help="log every request")
    args = parser.parse_args()

    root = args.dir.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    if sys.stdout is None or sys.stderr is None:
        # The windowed .exe has no console, so keep a log next to the files.
        log = open(root / "wifidrop.log", "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = log
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            # Windows consoles can't print every file name; don't crash over it.
            stream.reconfigure(errors="replace")

    local_url = f"http://localhost:{args.port}/"
    config = load_config(root, args.new_key)
    state = State(root, config, args.port, re.sub(r"[^a-z0-9-]", "", args.name.lower()) or DEFAULT_NAME)
    Handler.state = state
    try:
        server = Server(("0.0.0.0", args.port), Handler)
    except OSError as e:
        if running_instance(args.port):
            # Already running (e.g. started with Windows): just bring up its page.
            if not args.background:
                webbrowser.open(local_url)
            return
        msg = f"Can't listen on port {args.port} ({e}). Try --port {args.port + 1}"
        print(msg, file=sys.stderr)
        message_box(msg)
        sys.exit(1)
    server.verbose = args.verbose

    # The .exe starts with Windows from the first run on; the tray menu turns it off.
    if getattr(sys, "frozen", False) and get_autostart() is not None:
        try:
            if not config.get("autostartOffered"):
                config["autostartOffered"] = True
                save_config(root, config)
                set_autostart(True)
            elif get_autostart():
                set_autostart(True)  # refresh the path in case the .exe was moved
        except OSError:
            pass

    state.mdns = start_mdns(state.mdns_host.split(".")[0])
    url = state.url()
    print(f"\nWiFiDrop {VERSION} is running.  {time.strftime('%Y-%m-%d %H:%M')}\n")
    print(f"  On the iPhone, open:  {url}")
    if state.mdns:
        print(f"  Permanent address:    {state.stable_url()}")
    print(f"  Received files go to: {root}")
    print(f"  Files for the iPhone: {state.outbox}\n", flush=True)
    if not args.background:
        terminal_qr(url)
    if not (args.no_browser or args.background):
        threading.Timer(0.5, webbrowser.open, (local_url,)).start()

    def stop():
        server.stopping = True
        state.bump()
        server.shutdown()

    try:
        if args.no_tray:
            print("Keep this window open. Press Ctrl+C to stop.\n", flush=True)
            server.serve_forever()
        else:
            threading.Thread(target=server.serve_forever, daemon=True).start()
            if run_tray(state, local_url, stop):
                return  # "Quit" in the tray menu
            print("Keep this window open. Press Ctrl+C to stop.\n", flush=True)
            while True:
                time.sleep(3600)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.stopping = True
        state.bump()
        server.server_close()


if __name__ == "__main__":
    main()
