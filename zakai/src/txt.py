"""Turn glyphs into SVG path data (font-independent outlines)."""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FS = os.path.dirname(os.path.abspath(__file__)) + '/node_modules/@fontsource/'
_cache = {}

def font(rel):
    if rel not in _cache:
        _cache[rel] = TTFont(FS + rel)
    return _cache[rel]

def _num(v):
    return ('%.2f' % v).rstrip('0').rstrip('.')

def glyph(f, ch, size, x, y):
    """Glyph `ch` with its LEFT INK EDGE at x and baseline at y.
    Returns (d, (x1, y1, x2, y2), advance_px)."""
    gs = f.getGlyphSet(); gn = f.getBestCmap()[ord(ch)]
    bp = BoundsPen(gs); gs[gn].draw(bp); b = bp.bounds
    k = size / f['head'].unitsPerEm
    ox = x - b[0] * k
    sp = SVGPathPen(gs, ntos=_num)
    gs[gn].draw(TransformPen(sp, (k, 0, 0, -k, ox, y)))
    return sp.getCommands(), (x, y - b[3] * k, ox + b[2] * k, y - b[1] * k), gs[gn].width * k

def run(f, text, size, x, y, track=0.0):
    """Lay out `text` visually left-to-right using advances. Returns (d, bbox)."""
    ds, box = [], [1e9, 1e9, -1e9, -1e9]
    gs = f.getGlyphSet(); k = size / f['head'].unitsPerEm
    for ch in text:
        if ch == ' ':
            x += size * 0.26 + track; continue
        gn = f.getBestCmap()[ord(ch)]
        bp = BoundsPen(gs); gs[gn].draw(bp); b = bp.bounds
        sp = SVGPathPen(gs, ntos=_num)
        gs[gn].draw(TransformPen(sp, (k, 0, 0, -k, x, y)))
        ds.append(sp.getCommands())
        if b:
            box = [min(box[0], x + b[0]*k), min(box[1], y - b[3]*k), max(box[2], x + b[2]*k), max(box[3], y - b[1]*k)]
        x += gs[gn].width * k + track
    return ' '.join(ds), box
