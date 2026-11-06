"""Zakai — 'Sana'a window' direction: arched emblem with an old Yemeni sage + condensed wordmark."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from txt import font, glyph, run

BRICK, GYPSUM, INK, AMBER, GLASS_R, GLASS_B = '#8A3B1F', '#FBF3E4', '#2A1A12', '#F0A030', '#C8372D', '#2E6DA4'
KL = font('karantina/files/karantina-latin-700-normal.woff')
KH = font('karantina/files/karantina-hebrew-700-normal.woff')
TAG = font('karantina/files/karantina-hebrew-400-normal.woff')
RASHI = font('noto-rashi-hebrew/files/noto-rashi-hebrew-hebrew-700-normal.woff')


def emblem(bg=BRICK, fg=GYPSUM, cap=AMBER, frame=True):
    """The sage inside a Sana'a arched window, drawn in a 512x512 box."""
    s = []
    if frame:
        s.append(f'<path fill="{fg}" d="M68 500 V240 A188 188 0 0 1 444 240 V500 Z"/>')
    s.append(f'<path fill="{bg}" d="M90 500 V240 A166 166 0 0 1 422 240 V500 Z"/>')
    # qamariya: the stained-glass fan in the top of the arch doubles as his cap
    s.append(f'<path fill="{cap}" d="M168 200 V172 Q168 110 256 110 Q344 110 344 172 V200 Z"/>')
    for i, c in enumerate([GLASS_R, GLASS_B, GLASS_R]):
        x = 212 + i * 44
        s.append(f'<circle cx="{x}" cy="160" r="12" fill="{c}"/>')
    s.append(f'<rect x="160" y="194" width="192" height="14" rx="3" fill="{fg}"/>')
    st = f'fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="{fg}"'
    sb = f'fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="{bg}"'
    # brows, eyes (smiling, half-closed), nose
    s.append(f'<path {st} stroke-width="16" d="M186 234 Q210 220 236 230 M276 230 Q302 220 326 234"/>')
    s.append(f'<path {st} stroke-width="10" d="M202 262 Q215 250 228 262 M284 262 Q297 250 310 262"/>')
    s.append(f'<path {st} stroke-width="10" d="M256 244 L246 286 Q256 292 266 286"/>')
    # sidelocks (simanim)
    s.append(f'<path {st} stroke-width="15" d="M160 208 C146 246 162 270 146 306 C132 338 150 362 170 350 C184 340 172 322 158 330"/>')
    s.append(f'<path {st} stroke-width="15" d="M352 208 C366 246 350 270 366 306 C380 338 362 362 342 350 C328 340 340 322 354 330"/>')
    # beard = speech bubble, tail to the lower left
    s.append(f'<path fill="{fg}" d="M174 286 Q214 316 256 304 Q298 316 338 286 C346 370 326 420 278 440 Q256 446 232 442 L196 486 L206 432 C174 410 166 360 174 286 Z"/>')
    s.append(f'<path {sb} stroke-width="9" d="M238 334 Q256 346 274 334"/>')
    return '\n    '.join(s)


def wordmark(x0, base, size, letter, accent, gap=0.085):
    """i A כ ז laid out left-to-right; the i's tittle is the font's own yod."""
    parts, x, ibox = [], x0, None
    for ch, f in [('ı', KL), ('A', KL), ('כ', KH), ('ז', KH)]:
        d, box, _ = glyph(f, ch, size, x, base)
        if ch == 'ı':
            ibox = box
        parts.append(f'<path fill="{letter}" d="{d}"/>')
        x = box[2] + size * gap
    right = x - size * gap
    # yod over the stem
    ys = size * 0.62
    d0, yb0, _ = glyph(KH, 'י', ys, 0, 0)
    w = yb0[2] - yb0[0]; h = yb0[3] - yb0[1]
    yx = (ibox[0] + ibox[2]) / 2 - w / 2
    ybase = ibox[1] - size * 0.06 - yb0[3]
    d, yb, _ = glyph(KH, 'י', ys, yx, ybase)
    parts.append(f'<path fill="{accent}" d="{d}"/>')
    top = min(yb[1], min(p for p in [ibox[1]]))
    return '\n    '.join(parts), (x0, yb[1], right, base)


def tagline(cx, base, size, color, dot):
    a, b = 'חוכמה של פעם', 'בינה של היום'  # read right-to-left: a ◆ b
    dB, boxB = run(TAG, b[::-1], size, 0, base, size*0.04)
    wB = boxB[2] - boxB[0]
    dA, boxA = run(TAG, a[::-1], size, 0, base, size*0.04)
    wA = boxA[2] - boxA[0]
    sep = size * 1.1
    total = wB + sep + wA
    x = cx - total / 2
    dB, _ = run(TAG, b[::-1], size, x - boxB[0], base, size*0.04)
    dA, _ = run(TAG, a[::-1], size, x + wB + sep - boxA[0], base, size*0.04)
    my = base - size * 0.32; mx = x + wB + sep / 2; r = size * 0.13
    return (f'<path fill="{color}" d="{dB} {dA}"/>\n    '
            f'<path fill="{dot}" d="M{mx:.1f} {my-r:.1f} L{mx+r:.1f} {my:.1f} L{mx:.1f} {my+r:.1f} L{mx-r:.1f} {my:.1f} Z"/>'), total


def svg(w, h, body, bg=None, title='זכiA — Zakai'):
    back = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
            f'  <title>{title}</title>\n  {back}\n  {body}\n</svg>\n')


def lockup(bg, letter, accent, emblem_bg, emblem_fg, tag):
    # wordmark on the left, emblem on the right (Hebrew reading order)
    W, H = 1500, 640
    wm, box = wordmark(0, 0, 400, letter, accent)
    target = 380  # wordmark height incl. yod
    sc = target / (box[3] - box[1])
    ww, wh = (box[2] - box[0]) * sc, target
    em = 440; gap = 90
    x0 = (W - (ww + gap + em)) / 2
    wy = 70
    body = [f'<g transform="translate({x0 - box[0]*sc:.1f},{wy - box[1]*sc:.1f}) scale({sc:.4f})">\n    {wm}\n  </g>']
    ex = x0 + ww + gap; ey = wy + wh - em
    body.append(f'<g transform="translate({ex:.1f},{ey:.1f}) scale({em/512:.4f})">\n    {emblem(emblem_bg, emblem_fg)}\n  </g>')
    t, tw = tagline(W / 2, wy + wh + 112, 76, tag, accent)
    body.append(t)
    return svg(W, H, '\n  '.join(body), bg)


def icon(bg, fg):
    return svg(512, 512, f'<rect width="512" height="512" rx="96" fill="{bg}"/>\n  '
               f'<g transform="translate(36,20) scale(0.86)">\n    {emblem(BRICK, GYPSUM)}\n  </g>', None, 'Zakai icon')


if __name__ == '__main__':
    out = sys.argv[1]
    open(f'{out}/zakai-light.svg', 'w').write(lockup(GYPSUM, INK, AMBER, BRICK, GYPSUM, BRICK))
    open(f'{out}/zakai-dark.svg', 'w').write(lockup(INK, GYPSUM, AMBER, BRICK, GYPSUM, '#E9C9A8'))
    open(f'{out}/zakai-transparent.svg', 'w').write(lockup(None, INK, AMBER, BRICK, GYPSUM, BRICK))
    open(f'{out}/zakai-icon.svg', 'w').write(icon(GYPSUM, BRICK))
    open(f'{out}/zakai-emblem.svg', 'w').write(svg(512, 512, emblem(), None, 'Zakai emblem'))
