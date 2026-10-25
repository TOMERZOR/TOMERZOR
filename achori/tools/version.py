# Stamps a new version on every script and stylesheet URL in index.html so phones
# pick up a release right away (GitHub Pages lets browsers cache files for 10 minutes).
# Usage: python3 tools/version.py [version]   (default: current unix time)
import json, os, re, sys, time

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
v = sys.argv[1] if len(sys.argv) > 1 else str(int(time.time()))
path = os.path.join(root, 'index.html')
html = open(path, encoding='utf-8').read()

imports = {'three': './vendor/three.module.min.js'}
for f in sorted(os.listdir(os.path.join(root, 'js'))):
    if f.endswith('.js'):
        imports[f'./js/{f}'] = f'./js/{f}?v={v}'
importmap = '<script type="importmap">\n' + json.dumps({'imports': imports}, indent=1) + '\n</script>'
html = re.sub(r'<script type="importmap">.*?</script>', lambda m: importmap, html, flags=re.S)
html = re.sub(r'src="js/main\.js(\?v=[^"]*)?"', f'src="js/main.js?v={v}"', html)
html = re.sub(r'href="css/style\.css(\?v=[^"]*)?"', f'href="css/style.css?v={v}"', html)
open(path, 'w', encoding='utf-8').write(html)
print('version', v)
