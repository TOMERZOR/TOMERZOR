#!/usr/bin/env python3
"""Capture the extra game states S2 needs from the game's demo mode → out/s2/cap/<name>.html + .png (raw).
Run once; build_screens.py turns them into shorts/s2/screens.js."""
import asyncio, pathlib
from playwright.async_api import async_playwright
OUT = pathlib.Path(__file__).resolve().parents[2] / 'out/s2/cap'
BASE = 'https://hashtul.onrender.com/'
STATES = {
    'answer_number': '?demo=answer-number&kind=number&n=6&me=p2&at=6000',
    'answer_player': '?demo=answer-player&kind=player&n=6&me=p2&at=6000',
    'answer_choice': '?demo=answer-choice&kind=choice&n=6&me=p2&at=6000',
    'reveal_player': '?demo=reveal&kind=player&n=6&me=p2&at=14000',
}
async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 430, 'height': 932}, device_scale_factor=2)
        for name, q in STATES.items():
            await pg.goto(BASE + q, wait_until='networkidle', timeout=90000)
            await pg.wait_for_timeout(3500)
            html = await pg.evaluate("() => (document.querySelector('.stage')||document.body).outerHTML")
            (OUT / f'{name}.html').write_text(html, encoding='utf-8')
            await pg.screenshot(path=str(OUT / f'{name}.png'))
            print(name, len(html))
        await br.close()
asyncio.run(main())
