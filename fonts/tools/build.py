import numpy as np, cv2, json, sys, potrace
from skimage.morphology import skeletonize
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.reverseContourPen import ReverseContourPen

S, OUT = sys.argv[1], sys.argv[2]
UH = 560          # height of a regular Hebrew letter, font units
PEN = 46          # pen width, font units
SB = 55           # side bearing
DESC_MAX = 300    # deepest descender, font units
spec = json.load(open(f'{S}/spec.json'))
d = json.load(open(f'{S}/comps.json')); st = np.array(d['stats']); lines = d['lines']
lab = np.load(f'{S}/lab.npy')

# --- per-line baseline (linear in x) and letter height
LINE = {}
for li, ids in lines.items():
    b = np.array([st[c] for c in ids if st[c][3] > 30 and st[c][4] > 150 and not (li == '6' and st[c][1] + st[c][3] / 2 > 2850)], float)
    H = np.median(b[:, 3])
    keep = (b[:, 3] > 0.5 * H) & (b[:, 3] < 1.5 * H)
    cx, by = b[keep, 0] + b[keep, 2] / 2, b[keep, 1] + b[keep, 3]
    # robust baseline: slope = median pairwise slope (ruled lines are near-horizontal), clamped
    sl = [(by[j] - by[i]) / (cx[j] - cx[i]) for i in range(len(cx)) for j in range(i + 1, len(cx)) if abs(cx[j] - cx[i]) > 100]
    slope = float(np.clip(np.median(sl) if sl else 0.0, -0.06, 0.06))
    off = by - slope * cx
    c0 = np.median(off)
    for _ in range(3):
        ok = np.abs(off - c0) < 0.2 * H
        c0 = np.median(off[ok])
    p = np.array([slope, c0])
    H = np.median(b[keep, 3][ok]) if ok.sum() > 2 else H
    LINE[li] = (p, H)

def skeleton_pts(ch):
    e = spec[ch]; li = str(e['line'])
    ids = [lines[li][k] for k in e['comps']]
    x0 = min(st[c][0] for c in ids); y0 = min(st[c][1] for c in ids)
    x1 = max(st[c][0] + st[c][2] for c in ids); y1 = max(st[c][1] + st[c][3] for c in ids)
    if 'xcut' in e:
        a, bb = e['xcut']; w = x1 - x0; x0, x1 = x0 + int(a * w), x0 + int(bb * w)
    m = np.isin(lab[y0:y1, x0:x1], ids)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    sk = skeletonize(m)
    ys, xs = np.nonzero(sk)
    p, H = LINE[li]; s = UH / H
    X = xs + x0; Y = ys + y0
    fx = (X - x0) * s
    fy = (np.polyval(p, (x0 + x1) / 2) - Y) * s
    if e.get('align') == 'mid':
        fy = fy - (fy.max() + fy.min()) / 2 + 0.35 * UH
    if fy.min() < -DESC_MAX:  # tame very long descenders
        k = DESC_MAX / -fy.min(); fy = np.where(fy < 0, fy * k, fy)
    k = e.get('scale', 1.0); fx, fy = fx * k, fy * k
    return np.stack([fx, fy], 1), sk, (xs, ys), s

def strokes_from(sk, xy, F):
    """Return list of (P,Q) font-space segments linking 8-neighbour skeleton pixels."""
    xs, ys = xy; idx = {(x, y): i for i, (x, y) in enumerate(zip(xs, ys))}
    segs = []
    for i, (x, y) in enumerate(zip(xs, ys)):
        segs.append((F[i], F[i]))
        for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
            j = idx.get((x + dx, y + dy))
            if j is not None: segs.append((F[i], F[j]))
    return segs

def glyph_segments(ch):
    if ch in SYNTH: return SYNTH[ch]()
    F, sk, xy, s = skeleton_pts(ch)
    return strokes_from(sk, xy, F)

def drop_specks(segs, min_pts=25):
    """Remove tiny disconnected stroke fragments left over after cutting a glyph."""
    key = lambda p: (round(float(p[0]), 3), round(float(p[1]), 3))
    parent = {}
    def find(k):
        while parent.setdefault(k, k) != k: k = parent[k]
        return k
    for a, b in segs: parent[find(key(a))] = find(key(b))
    size = {}
    for a, _ in segs: r = find(key(a)); size[r] = size.get(r, 0) + 1
    return [(a, b) for a, b in segs if size[find(key(a))] >= min_pts]

def with_descender(base, cut_frac, depth=-250, pick='low'):
    segs = glyph_segments(base)
    keep = [(a, b) for a, b in segs if a[1] >= cut_frac * UH and b[1] >= cut_frac * UH]
    keep = drop_specks(keep)
    pts = np.array([a for a, _ in keep])
    lo = pts[np.argmin(pts[:, 1])]
    if pick == 'right':
        band = pts[pts[:, 1] < lo[1] + 40]; lo = band[np.argmax(band[:, 0])]
    n = 40
    t = np.linspace(0, 1, n)
    dxs = lo[0] - 25 * t ** 2; dys = lo[1] + (depth - lo[1]) * t
    line = np.stack([dxs, dys], 1)
    keep += [(line[i], line[i + 1]) for i in range(n - 1)]
    return keep

def bar(x0, y0, x1, y1):
    return lambda: [(np.array([x0, y0], float), np.array([x1, y1], float))]

SYNTH = {
    'ץ': lambda: with_descender('צ', 0.30),
    'ף': lambda: with_descender('פ', 0.40, pick='right'),
    '-': bar(0, 250, 230, 265),
    ':': lambda: [(np.array([0, 0.]), np.array([0, 0.]))] * 1 + [(np.array([0, 330.]), np.array([0, 330.]))],
}
DOT = {'.', ',', ':'}

def render(ch):
    segs = glyph_segments(ch)
    pts = np.array([q for sg in segs for q in sg])
    pen = int(PEN * (1.7 if ch in DOT else 1))
    pad = pen
    minx, miny = pts.min(0) - pad; maxx, maxy = pts.max(0) + pad
    Wc, Hc = int(maxx - minx) + 1, int(maxy - miny) + 1
    SC = 2  # raster super-sampling
    can = np.zeros((Hc * SC, Wc * SC), np.uint8)
    for a, b in segs:
        pa = (int((a[0] - minx) * SC), int((maxy - a[1]) * SC))
        pb = (int((b[0] - minx) * SC), int((maxy - b[1]) * SC))
        cv2.line(can, pa, pb, 255, pen * SC, cv2.LINE_AA)
    can = cv2.GaussianBlur(can, (0, 0), 2.5 * SC)
    bm = potrace.Bitmap(can < 128)  # potracer treats low values as ink
    path = bm.trace(turdsize=1200, alphamax=1.0, opticurve=True, opttolerance=0.3)
    conv = lambda P: (P.x / SC + minx, maxy - P.y / SC) if hasattr(P, 'x') else (P[0] / SC + minx, maxy - P[1] / SC)
    rec = RecordingPen()
    for curve in path:
        rec.moveTo(conv(curve.start_point))
        for seg in curve:
            if seg.is_corner:
                rec.lineTo(conv(seg.c)); rec.lineTo(conv(seg.end_point))
            else:
                rec.curveTo(conv(seg.c1), conv(seg.c2), conv(seg.end_point))
        rec.closePath()
    return rec, (minx + pad, maxx - pad)

CHARS = list(spec.keys()) + list(SYNTH.keys())
names = {'.notdef': '.notdef', ' ': 'space'}
glyph_order = ['.notdef', 'space']; cmap = {32: 'space'}
glyphs = {}; metrics = {}
def emit(name, rec, xl, xr):
    shift = SB - xl
    tt = TTGlyphPen(None)
    ap = AreaPen(); rec.replay(ap)
    target = Cu2QuPen(tt, max_err=1.0, reverse_direction=False)
    from fontTools.pens.transformPen import TransformPen
    tp = TransformPen(target, (1, 0, 0, 1, shift, 0))
    # TrueType wants clockwise outer contours => negative area
    (ReverseContourPen(tp) if ap.value > 0 else tp)
    rec.replay(ReverseContourPen(tp) if ap.value > 0 else tp)
    g = tt.glyph()
    glyphs[name] = g; metrics[name] = (int(round(xr - xl + 2 * SB)), SB)

for ch in CHARS:
    name = f'uni{ord(ch):04X}'
    rec, (xl, xr) = render(ch)
    emit(name, rec, xl, xr)
    glyph_order.append(name); cmap[ord(ch)] = name
    if ch == 'ש': pass

# .notdef box & space
tt = TTGlyphPen(None)
for (a, b, c, e) in [((50, 0), (50, 600), (350, 600), (350, 0))]:
    tt.moveTo(a); tt.lineTo(d := e); tt.lineTo(c); tt.lineTo(b); tt.closePath()
glyphs['.notdef'] = tt.glyph(); metrics['.notdef'] = (400, 50)
glyphs['space'] = TTGlyphPen(None).glyph(); metrics['space'] = (260, 0)
# Map Hebrew maqaf / NBSP
cmap[0xA0] = 'space'; cmap[0x05BE] = 'uni002D'

fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(glyph_order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics(metrics)
ymin = min(getattr(glyphs[n], 'yMin', 0) for n in glyph_order)
ymax = max(getattr(glyphs[n], 'yMax', 0) for n in glyph_order)
asc, desc = max(ymax + 40, 820), min(ymin - 40, -300)
fb.setupHorizontalHeader(ascent=asc, descent=desc, lineGap=120)
fam = 'Tomer Hand'
fb.setupNameTable({'familyName': fam, 'styleName': 'Regular', 'uniqueFontIdentifier': 'TomerHand-Regular-1.0',
                   'fullName': fam + ' Regular', 'psName': 'TomerHand-Regular', 'version': 'Version 1.000'})
fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=120, usWinAscent=asc, usWinDescent=-desc,
            sxHeight=UH, sCapHeight=UH, ulUnicodeRange1=(1 << 0) | (1 << 11), ulCodePageRange1=(1 << 0) | (1 << 5),
            achVendID='TMRZ', fsType=0)
fb.setupPost(); fb.setupDummyDSIG() if hasattr(fb, 'setupDummyDSIG') else None
fb.save(OUT)
print('saved', OUT, len(glyph_order), 'glyphs; asc/desc', asc, desc)
print({k: (round(v[1]), round(v[0][0], 3)) for k, v in LINE.items()})
