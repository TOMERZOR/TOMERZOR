#!/usr/bin/env python3
"""out/s2/cap/*.html (raw captures from the game's ?demo= mode, see capture.py) → shorts/s2/screens.js.
Keeps only the pieces S2 uses: each kind's question card (.answer__q with its kind chip) and the reveal's player answer
(.ans--player, יובל's small avatar + name). Inline opacity/transform from the capture are dropped; ids are made unique."""
import asyncio, json, pathlib, re
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
CAP = ROOT / 'out/s2/cap'
PICK = {
    'q_number': ('answer_number', '.answer__q'),
    'q_player': ('answer_player', '.answer__q'),
    'q_choice': ('answer_choice', '.answer__q'),
    'ans_player': ('reveal_player', '.reveal__cell .ans--player'),
}
async def main():
    out = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page()
        for name, (src, sel) in PICK.items():
            html = (CAP / f'{src}.html').read_text(encoding='utf-8')
            html = re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.S)
            await pg.set_content(html)
            frag = await pg.evaluate("s => document.querySelector(s).outerHTML", sel)
            frag = re.sub(r'\s?(opacity: [\d.]+;|transform: [^;"]+;)', '', frag).replace(' style=""', '')
            for i in sorted(set(re.findall(r'\sid="([^"]+)"', frag)), key=len, reverse=True):
                frag = re.sub(rf'(\sid=")({re.escape(i)})(")', rf'\g<1>s2{name}_\2\3', frag)
                frag = frag.replace(f'url(#{i})', f'url(#s2{name}_{i})')
            out[name] = frag
            print(f'{name:12s} {len(frag):6d}')
        await br.close()
    (ROOT / 'shorts/s2/screens.js').write_text(
        '/* S2: pieces of the game captured from its demo mode (answer-number/-player/-choice, reveal&kind=player; n=6), '
        'built by build_screens.py. */\nwindow.S2CAP = ' + json.dumps(out, ensure_ascii=False, indent=0) + ';\n', encoding='utf-8')
asyncio.run(main())
