#!/usr/bin/env python3
"""Builds kafitz/kafitz-premiere.zip: the Premiere Pro panel with the shared caption code.

Run from anywhere: python3 kafitz/premiere/build.py
Layout inside the zip (the folder is the CEP extension root):
  kafitz/CSXS/manifest.xml, kafitz/index.html (bootstrap), kafitz/host/, kafitz/premiere/,
  kafitz/js/, kafitz/css/, kafitz/img/, kafitz/install/, kafitz/README.txt
"""
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'kafitz-premiere.zip')

FILES = {
    'CSXS/manifest.xml': os.path.join(HERE, 'CSXS', 'manifest.xml'),
    'index.html': os.path.join(HERE, 'bootstrap.html'),
    'host/kafitz.jsx': os.path.join(HERE, 'host', 'kafitz.jsx'),
    'premiere/panel.html': os.path.join(HERE, 'panel.html'),
    'premiere/panel.css': os.path.join(HERE, 'panel.css'),
    'premiere/panel.js': os.path.join(HERE, 'panel.js'),
    'premiere/server.js': os.path.join(HERE, 'server.js'),
    'css/style.css': os.path.join(APP, 'css', 'style.css'),
    'img/icon.svg': os.path.join(APP, 'img', 'icon.svg'),
    'img/icon.png': os.path.join(APP, 'img', 'icon.png'),
    'install/install-mac.command': os.path.join(HERE, 'install', 'install-mac.command'),
    'install/install-windows.bat': os.path.join(HERE, 'install', 'install-windows.bat'),
    'README.txt': os.path.join(HERE, 'install', 'README.txt'),
}
for name in ('render.js', 'transcribe.js', 'worker.js', 'export.js', 'ui.js'):
    FILES['js/' + name] = os.path.join(APP, 'js', name)

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for arc, src in sorted(FILES.items()):
        info = zipfile.ZipInfo('kafitz/' + arc, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        mode = 0o755 if arc.endswith('.command') else 0o644
        info.external_attr = (0o100000 | mode) << 16
        with open(src, 'rb') as f:
            z.writestr(info, f.read())
print('wrote', os.path.relpath(OUT), len(FILES), 'files')
