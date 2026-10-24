"""Builds the single-page Tokef artifact into tokef/dist, and the same page as a
standalone web page into tokef/app (served by GitHub Pages).

  python3 tokef/tools/build.py [--icons path/to/tokef-icons.woff2]

The page is one HTML file with its CSS, JS and icon font inline. Photos and
the demo dataset ship beside it as published files. dist/index.html is the
page body the Artifact publish wraps in its own skeleton; app/index.html is a
complete document that runs on the in-browser store."""
import base64, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
WEB = os.path.join(ROOT, 'app')
WEB_HEAD = ('<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="robots" content="noindex">\n'
            '<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
            '</head>\n<body>\n')
JS = ['core.js', 'platform.js', 'ui-base.js', 'views.js', 'flows.js', 'main.js']
LIBS = [
    'https://cdn.jsdelivr.net/npm/preact@10.24.3/dist/preact.min.umd.js',
    'https://cdn.jsdelivr.net/npm/preact@10.24.3/hooks/dist/hooks.umd.js',
    'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js',
]
FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Rubik:wght@300..900&display=swap'


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def main():
    icons = os.path.join(ROOT, 'assets', 'tokef-icons.woff2')
    if '--icons' in sys.argv:
        icons = sys.argv[sys.argv.index('--icons') + 1]
    with open(icons, 'rb') as f:
        font64 = base64.b64encode(f.read()).decode('ascii')
    css = read('app.css')
    js = '\n'.join('/* ---- %s ---- */\n%s' % (n, read(n)) for n in JS)
    if '</script' in js.lower():
        raise SystemExit('script text must not contain </script')
    page = []
    page.append('<title>Tokef</title>')
    page.append('<meta name="claude:viewport-fit-sides" content="cover">')
    page.append('<link rel="stylesheet" href="%s">' % FONTS)
    page.append('<style>')
    page.append("@font-face { font-family: 'Tokef Icons'; font-style: normal; font-weight: 400; font-display: block; src: url(data:font/woff2;base64,%s) format('woff2'); }" % font64)
    page.append(css)
    page.append('.boot { min-height: 100vh; display: grid; place-items: center; text-align: center; padding: 24px; font-family: var(--f-ui); }')
    page.append('.boot .wordmark { font-size: 40px; }')
    page.append('.boot p { color: var(--soft); opacity: 0; animation: bootmsg .3s 9s forwards; max-width: 40ch; margin-top: 10px; }')
    page.append('@keyframes bootmsg { to { opacity: 1; } }')
    page.append('</style>')
    page.append('<div id="app" dir="rtl" lang="he"><div class="boot"><div><span class="wordmark">Tokef<b>.</b></span>'
                '<p>הטעינה לוקחת יותר מהרגיל. בדקו את החיבור לאינטרנט ורעננו את העמוד.</p></div></div></div>')
    for src in LIBS:
        page.append('<script src="%s"></script>' % src)
    page.append('<script>\n"use strict";\n%s\n</script>' % js)
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'index.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(page) + '\n')
    for d in ('img',):
        s = os.path.join(ROOT, 'assets', d)
        if os.path.isdir(s):
            shutil.copytree(s, os.path.join(DIST, d), dirs_exist_ok=True)
    demo = os.path.join(ROOT, 'assets', 'demo.json')
    if os.path.exists(demo):
        shutil.copy(demo, os.path.join(DIST, 'demo.json'))
    print('built', out, os.path.getsize(out), 'bytes')
    shutil.rmtree(WEB, ignore_errors=True)
    shutil.copytree(DIST, WEB)
    web = os.path.join(WEB, 'index.html')
    with open(web, 'w', encoding='utf-8') as f:
        f.write(WEB_HEAD + '\n'.join(page) + '\n</body>\n</html>\n')
    print('built', web, os.path.getsize(web), 'bytes')


if __name__ == '__main__':
    main()
