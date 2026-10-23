"""Builds a tiny icon font: the Material Symbols Rounded glyphs Tokef uses, FILL axis kept.
Usage: python3 tokef/tools/icons.py <material-symbols-rounded.woff2> <out.woff2> name1 name2 ..."""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

src, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
font = TTFont(src, lazy=False)
axes = {a.axisTag for a in font['fvar'].axes}
pin = {k: v for k, v in {'wght': 400, 'GRAD': 0, 'opsz': 24}.items() if k in axes}
font = instancer.instantiateVariableFont(font, pin)
import io
_b = io.BytesIO()
font.flavor = None
font.save(_b)
_b.seek(0)
font = TTFont(_b, lazy=False)

rev = {}
for code, g in font.getBestCmap().items():
    rev[g] = chr(code)
want = set(names)
found = {}
for lookup in font['GSUB'].table.LookupList.Lookup:
    for st in lookup.SubTable:
        if st.LookupType == 7:
            st = st.ExtSubTable
        if getattr(st, 'LookupType', None) != 4:
            continue
        for first, ligs in st.ligatures.items():
            for lig in ligs:
                seq = [first] + list(lig.Component)
                try:
                    word = ''.join(rev[g] for g in seq)
                except KeyError:
                    continue
                if word in want and word not in found:
                    found[word] = lig.LigGlyph
missing = sorted(want - set(found))
if missing:
    print('MISSING:', missing)
    sys.exit(1)
chars = set(''.join(names))
keep = set(found.values()) | {font.getBestCmap()[ord(c)] for c in chars} | {'.notdef'}
opts = subset.Options()
opts.layout_features = ['liga', 'rlig', 'calt', 'ccmp']
opts.layout_closure = False
opts.flavor = 'woff2'
opts.name_IDs = ['*']
opts.notdef_outline = True
sub = subset.Subsetter(options=opts)
sub.populate(glyphs=sorted(keep), unicodes=[ord(c) for c in chars])
sub.subset(font)
font.flavor = 'woff2'
font.save(out)
import os
print('icons:', len(found), 'bytes:', os.path.getsize(out), 'axes left:', [a.axisTag for a in font['fvar'].axes] if 'fvar' in font else [])
