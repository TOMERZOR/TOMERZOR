#!/usr/bin/env python3
# Stamps a new build: js/version.js gets a fresh version, and every local script and stylesheet
# in index.html gets ?v=<version>, so a reload never mixes old and new files from the cache.
# Phones online compare versions (js/multi.js) and ask to refresh when they differ.
# Run before each commit that changes the game: python3 tools/stamp.py
import re, time, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ver = time.strftime('%Y%m%d%H%M', time.gmtime())
open(os.path.join(root, 'js/version.js'), 'w').write(f"// The build, stamped by tools/stamp.py (phones online compare it).\nconst NETIBOT_VER = '{ver}';\n")
p = os.path.join(root, 'index.html')
h = open(p, encoding='utf8').read()
h = re.sub(r'((?:src|href)="(?:js|css)/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"', lambda m: f'{m.group(1)}?v={ver}"', h)
if 'js/version.js' not in h:
    h = h.replace('<script src="vendor/', f'<script src="js/version.js?v={ver}"></script>\n<script src="vendor/', 1)
open(p, 'w', encoding='utf8').write(h)
print('stamped', ver)
