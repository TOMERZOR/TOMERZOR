"""Downloads WiFiDrop into ~/WiFiDrop-app and starts it.

Paste into a Python prompt:
    import urllib.request as u; exec(u.urlopen("https://raw.githubusercontent.com/TOMERZOR/TOMERZOR/claude/nifty-noether-y5yku0/wifidrop/install.py").read())
or run:  python install.py
"""


def _install_wifidrop():
    import subprocess
    import sys
    import urllib.request
    from pathlib import Path

    base = "https://raw.githubusercontent.com/TOMERZOR/TOMERZOR/claude/nifty-noether-y5yku0/wifidrop/"
    files = [
        "wifidrop.py", "README.md", "start-windows.bat", "start-mac.command",
        "web/index.html", "web/locked.html", "web/app.css", "web/app.js",
        "web/icon.svg", "web/icon.png", "web/vendor/qrcode.js",
    ]
    target = Path.home() / "WiFiDrop-app"
    print(f"Downloading WiFiDrop to {target} ...")
    for name in files:
        dest = target / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(base + name) as res:
            dest.write_bytes(res.read())
        print("  ✓", name)
    if sys.platform != "win32":
        (target / "start-mac.command").chmod(0o755)
    print(f"\nInstalled. Next time, double-click {target / ('start-windows.bat' if sys.platform == 'win32' else 'start-mac.command')}\n")
    subprocess.call([sys.executable, str(target / "wifidrop.py")], cwd=str(target))


_install_wifidrop()
