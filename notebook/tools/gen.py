"""Lay out the transcribed notebook pages on the ruled grid of the Campus A4 notebook.

Paper (measured by the user): A4 210x297 mm, first rule 29 mm from the top edge,
rules 70/9 mm apart (33 rules), margin line 30 mm from the right edge.
"""
import re, sys, html as H
from pathlib import Path

TOP, STEP, NLINES = 29.0, 70 / 9, 33
MARGIN_X = 210 - 30            # margin line, from the left edge
TEXT_R = MARGIN_X - 2          # right edge of body text
ASC, DESC = 0.979, 0.469       # font metrics (em)
LIFT = 0.5                     # baseline sits this far above the rule
INK = '#23232f'
MK = {'p': ('#c48ee6', 'rgba(196,142,230,.55)'), 'g': ('#8fce78', 'rgba(143,206,120,.6)'),
      'k': ('#f19ab6', 'rgba(241,154,182,.6)'), 'y': ('#f0d838', 'rgba(240,216,56,.7)')}

def y(k): return TOP + k * STEP

def chem(s):
    """H2O -> H<sub>2</sub>O (digits after a letter become subscripts)."""
    out = re.sub(r'(?<=[A-Za-z])(\d+)', r'<span class="sb">\1</span>', H.escape(s))
    return f'<bdi dir="ltr">{out}</bdi>'

def ln(k, t, r=TEXT_R, fs=5.6, mx=None, cls='', l=None, ltr=False, center=None):
    return dict(k=k, t=t, r=r, fs=fs, mx=mx, cls=cls, l=l, ltr=ltr, center=center)

def title(k, t, c, r=172, outline=False, fs=17):
    return ln(k, t, r=r, fs=fs, cls=f'ttl ttl-{c}' + (' ttl-out' if outline else ''))

dot = lambda c: f'<span class="dot" style="background:{MK[c][0]}"></span>'
hl = lambda t, c: f'<span class="hl" style="--h:{MK[c][1]}">{t}</span>'
ulm = lambda t, c: f'<span class="ulm" style="--h:{MK[c][1]}">{t}</span>'
ul = lambda t: f'<span class="ul">{t}</span>'
gap = lambda mm: f'<span style="display:inline-block;width:{mm}mm"></span>'

def brace(x, y0, y1):
    m = (y0 + y1) / 2; w = 2.4
    return (f'<path d="M{x},{y0} C{x+w*.6},{y0} {x+w*.6},{y0+1.5} {x+w*.6},{y0+3} L{x+w*.6},{m-2.5} '
            f'C{x+w*.6},{m-.8} {x+w},{m} {x+w*1.15},{m} C{x+w},{m} {x+w*.6},{m+.8} {x+w*.6},{m+2.5} '
            f'L{x+w*.6},{y1-3} C{x+w*.6},{y1-1.5} {x+w*.6},{y1} {x},{y1}" fill="none" stroke="{INK}" stroke-width=".45" stroke-linecap="round"/>')

def arrow(x0, y0, x1, y1):
    import math
    a = math.atan2(y1 - y0, x1 - x0); L = 1.8
    h1 = (x1 - L * math.cos(a - .5), y1 - L * math.sin(a - .5)); h2 = (x1 - L * math.cos(a + .5), y1 - L * math.sin(a + .5))
    return (f'<path d="M{x0},{y0} L{x1},{y1} M{h1[0]:.2f},{h1[1]:.2f} L{x1},{y1} L{h2[0]:.2f},{h2[1]:.2f}" '
            f'fill="none" stroke="{INK}" stroke-width=".4" stroke-linecap="round" stroke-linejoin="round"/>')

import random
_rng = random.Random(7)

def wobble(x0, y0, x1, y1, amp=.42, tilt=1.3, bow=.9):
    """Smooth path that drifts like a line drawn freehand along a ruler-less edge."""
    import math
    L = math.hypot(x1 - x0, y1 - y0); n = max(3, int(L / 5))
    ux, uy = (x1 - x0) / L, (y1 - y0) / L; px, py = -uy, ux
    t0 = _rng.uniform(-tilt, tilt); b = _rng.uniform(-bow, bow)
    noise = [0.0]
    for _ in range(n): noise.append(noise[-1] * .55 + _rng.uniform(-amp, amp))
    pts = []
    for i in range(n + 1):
        t = i / n
        off = t0 * (t - .5) + b * math.sin(math.pi * t) + noise[i]
        pts.append((x0 + (x1 - x0) * t + px * off, y0 + (y1 - y0) * t + py * off))
    d = f'M{pts[0][0]:.2f},{pts[0][1]:.2f}'
    for i in range(1, len(pts) - 1):
        mx, my = (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2
        d += f' Q{pts[i][0]:.2f},{pts[i][1]:.2f} {mx:.2f},{my:.2f}'
    d += f' L{pts[-1][0]:.2f},{pts[-1][1]:.2f}'
    return d

def pen(d, w=.42):  # ballpoint: main stroke plus a faint second pass so the weight varies
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w*.6:.2f}" stroke-opacity=".35" stroke-linecap="round" '
            f'transform="translate({_rng.uniform(-.15,.15):.2f},{_rng.uniform(-.15,.15):.2f})"/>')
def marker(d, c, w):
    return (f'<path d="{d}" fill="none" stroke="{MK[c][1]}" stroke-width="{w}" stroke-linecap="square" style="mix-blend-mode:multiply"/>'
            f'<path d="{d}" fill="none" stroke="{MK[c][1]}" stroke-width="{w*.5:.2f}" stroke-opacity=".5" stroke-linecap="butt" '
            f'transform="translate({_rng.uniform(-.3,.3):.2f},{_rng.uniform(-.25,.25):.2f})" style="mix-blend-mode:multiply"/>')

def hline(x0, x1, yy, w=.42):
    s0 = _rng.uniform(-1.2, 1.5); s1 = _rng.uniform(-1.5, 1.2)
    return pen(wobble(x0 + s0, yy + _rng.uniform(-.3, .3), x1 + s1, yy + _rng.uniform(-.3, .3)), w)
def vline(xx, y0, y1, w=.5):
    return pen(wobble(xx + _rng.uniform(-.4, .4), y0 + _rng.uniform(-.8, .8), xx + _rng.uniform(-.6, .6), y1 + _rng.uniform(-.8, .8), tilt=.9), w)

PAGES = []

# ---------------- 1. סוג תגובות כימיות
P = [title(3, 'סוג תגובות כימיות', 'p', r=168),
     ln(5, hl('תגובה אקסותרמית -', 'p')),
     ln(6, 'פליטה אנרגית חום (גו אוט), ולכן יש עליה בטמפרטורה בתהליך זה. (בעירה, נשימה תאית', mx=166),
     ln(7, 'וכדו...', fs=4.4, l=24, ltr=False),
     ln(8, hl('תגובה אנדותרמית -', 'p')),
     ln(9, 'קליטה של אנרגית חום ' + gap(22) + ', ולכן יש ירידה בטמפרטורה בתהליך זה. (פוטוסינתזה וכו...)', mx=166),
     ln(11, '* באקסותרמי יש יותר פליטה'),
     ln(12, '* באנדותרמי יש יותר קליטה.')]
for i, w in enumerate(['בשניהם', 'פליטת אנרגיה', 'וגם', 'קליטת', 'אנרגיה']):
    P.append(ln(5 + i, w, r=204, fs=4.6, mx=19))
S = [marker(wobble(MARGIN_X + 2.3, y(4) + 2, MARGIN_X + 2.0, y(9) + 2.6, amp=.2), 'p', 1.6),
     brace(MARGIN_X + 1, y(4) + 2.5, y(9) + 2)]
PAGES.append((P, S))

# ---------------- 2. תגובות כימיות (טבלה)
DIV, RC, LC = 103, 172, 100
P = [ln(0, '18.9.26', l=16, ltr=True, fs=5.4),
     title(2.6, 'תגובות כימיות', 'p'),
     ln(4.6, hl('ההבדלים:', 'p')),
     ln(7, hl('תגובה כימית', 'p'), r=RC), ln(7, hl('תגובה פיזיקלית', 'p'), r=LC),
     ln(8, 'תהליך שמתרחש בין', r=RC, mx=66), ln(9, 'חומרים (מגיבים תוצרים)', r=RC, mx=66),
     ln(10, 'בסוף התהליך נוצר', r=RC, mx=66), ln(11, ulm(ul('חומר חדש.'), 'p'), r=RC),
     ln(8, 'לא נוצר חומר חדש.', r=LC, mx=70), ln(9, 'סתם מערבבים בין החומרים', r=LC, mx=70),
     ln(10, 'אין מפרידים ביניהם.', r=LC, mx=70),
     ln(11, dot('p') + ' החומרים שומרים על התכונות המקוריות', r=LC, mx=72), ln(12, 'שלהם.', r=LC),
     ln(14, 'בתגובה כימית נוצרת תרכובת', r=RC, mx=66), ln(15, 'או מתפרקת תרכובת', r=RC, mx=66),
     ln(14, 'בתגובה פיזיקלית נוצרת תערובת או', r=LC, mx=72), ln(15, 'הפרדת תערובות למרכיבים.', r=LC, mx=72),
     ln(17, 'השקעת אנרגיה ותהליך', r=RC, mx=66), ln(18, 'בלתי הפיך', r=RC, mx=66),
     ln(17, 'התהליך הפיך', r=LC),
     ln(20, 'אלקטרוליזה של מים', r=RC, mx=66), ln(21, '(חשמל במים ומרחקים)', r=RC, mx=66),
     ln(22, 'בעירה', r=RC), ln(23, 'חלודה', r=RC),
     ln(20, 'הכנת סלט ירקות', r=LC), ln(21, 'המסה', r=LC), ln(22, 'שינוי במצב צבירה, שינוי צורה', r=LC, mx=72)]
# row separators sit on the empty ruled lines between rows (13, 16, 19)
S = [hline(36, 174, y(7) + 1.6), vline(DIV, y(6) + 1, y(23) + 2.5),
     hline(30, 174, y(13)), hline(30, 174, y(16)), hline(30, 174, y(19))]
PAGES.append((P, S))

# ---------------- 3. משימה
P = [ln(6, 'משימה: כתבו ע״פ כל נוסחה כימית - תרכובת יונית או תרכובת מולקולרית.', mx=166),
     ln(8, chem('CH4') + ' - מולקולרית', r=170, fs=6),
     ln(9, chem('C6H12O6') + ' - מולקולרית', r=170, fs=6),
     ln(10, chem('AlO') + ' - יונית', r=170, fs=6),
     ln(11, chem('MgCl2') + ' -', r=170, fs=6)]
PAGES.append((P, []))

# ---------------- 4. תרכובת מולקולרית / יונית
P = [ln(0, 'יום שני', fs=5.4), ln(0, '14.9.26', l=16, ltr=True, fs=5.4),
     title(3, 'תרכובת מולקולרית', 'g'),
     ln(6, 'לתרכובת מולקולרית יש נוסחה כימית המבטאת סוג היסודות וכמות האטומים', mx=166),
     ln(7, 'שבתרכובת.'),
     ln(8, 'תרכובת מולקולרית בנויה מיסודות אל-מתכתיים.'),
     ln(10, 'יסודות בצד ימין במדרגות בטבלה המחזורית הם אל-מתכתיים + מימן.', mx=166),
     ln(11, 'מולקולרי = מהמילה מולקולה'),
     ln(12, 'כל תרכובת מולקולרית בנויה ממולקולות'),
     ln(15, ulm('דוגמאות לתרכובת מולקולרית:', 'g')),
     ln(16, dot('g') + ' ' + chem('H2O') + ' ' + dot('g'), center=156, fs=6),
     ln(17, dot('g') + ' ' + chem('CO2') + ' ' + dot('g'), center=156, fs=6),
     ln(18, dot('g') + ' ' + chem('H2O2') + ' ' + dot('g'), center=156, fs=6),
     title(21, 'תרכובת יונית', 'y', outline=True),
     ln(23, dot('y') + ' תרכובת יונית בנויה מיסודות מתכתיים ואל-מתכתיים.'),
     ln(25, hl('דוגמה:', 'y')), ln(25, chem('NaCl'), center=140, fs=6.2),
     ln(26, ulm('מלח בישול', 'y'), center=139, fs=4.6),
     ln(27.2, ulm(chem('Na') + ' - מתכת', 'y'), r=173),
     ln(27.2, ulm(chem('Cl') + ' - אל-מתכת', 'y'), r=128),
     ln(29, chem('MgO'), center=140, fs=7),
     ln(30, 'אל', center=156, fs=4.4), ln(31, ulm('מתכת', 'y'), center=156, fs=4.6),
     ln(31, ulm('מתכת', 'y'), center=120, fs=4.6)]
S = [arrow(134.5, y(29) + 1.2, 126.5, y(30) + 4.2), arrow(146, y(29) + .8, 150.5, y(30) + 1.8),
     marker(wobble(112.5, y(31) + 3.4, 171.5, y(31) + 3.0, amp=.25, bow=.7), 'y', 1.4)]
PAGES.append((P, S))

# ---------------- 5. תרגול שפה כימית
NR = 86   # notes column right edge
P = [ln(0, 'יום שני', fs=5.4), ln(0, '7.9.26', l=16, ltr=True, fs=5.4),
     title(3, 'תרגול שפה כימית', 'k'),
     ln(6, '1. תארו במילים את הנוסחאות הכימיות הבאות:'),
     ln(8, chem('He') + ' אטום אחד של יסוד הליום.'),
     ln(9, chem('2H') + ' שני אטומים נפרדים של יסוד מימן.'),
     ln(10, chem('H2') + ' שני אטומים מחוברים של יסוד מימן. (מולקולת מימן).'),
     ln(14, 'יום שלישי:', fs=5.4), ln(14, '8.9.26', l=40, ltr=True, fs=5.4),
     ln(16, hl('שפה כימית:', 'k'), r=162),
     ln(17, chem('H2') + ' - יסוד מימן, שני אטומים', mx=84),
     ln(18, chem('2H') + ' - יסוד מימן, 2 אטומים ' + ul('נפרדים') + '.', mx=84),
     ln(19, chem('H2O') + ' - תרכובת - 2 אטומי מימן, אטום אחד של חמצן.', mx=84),
     ln(20, chem('Co') + ' - יסוד קובלט (אטום אחד)', mx=84),
     ln(21, chem('CO') + ' - תרכובת - יסוד פחמן ויסוד חמצן.', mx=84),
     ln(22, chem('CO2') + ' - תרכובת - אטום של פחמן ושני אטומים של חמצן.', mx=84),
     ln(23, chem('C6H12O6') + ' תרכובת - 6 אטומים של פחמן, 12 אטומים', mx=84),
     ln(24, 'של מימן ו-6 אטומים של חמצן.', mx=84),
     ln(16, ul('הערות:'), r=NR - 22),
     ln(17, '* סמל יסוד מתחיל באות אנגלית', r=NR, mx=64), ln(18, 'גדולה.', r=NR - 4),
     ln(19, 'במקרה ויש אות נוספת היא קטנה.', r=NR, mx=64),
     ln(20, '* מספר קטן אחרי האות - מבטא כמות', r=NR, mx=64), ln(21, 'אטומים מחוברים.', r=NR - 4),
     ln(22, '* מולקולה - אטומים מחוברים.', r=NR, mx=64),
     ln(23, '* אות גדולה / אות גדולה עם קטנה - יסוד.', r=NR, mx=64),
     ln(24, 'מספר גדול לפני האות - מספר מולקולות', r=NR, mx=64),
     ln(26, 'עבודה בספר - 19.'),
     ln(27, '1. 6 אטומים של פחמן, 12 אטומים של מימן ו-6 אטומי חמצן.'),
     ln(28, '2.'), ln(28, chem('Li'), center=140, fs=6), ln(28, chem('H'), center=116, fs=6),
     ln(29, 'ליתיום', center=140, fs=4.4), ln(29, 'מימן', center=116, fs=4.4)]
PAGES.append((P, []))

def page_html(P, S, guides):
    out = ['<section class="page">']
    if guides:
        g = ''.join(f'<line x1="0" y1="{y(k):.3f}" x2="210" y2="{y(k):.3f}" stroke="#8fa8e8" stroke-width=".25"/>' for k in range(NLINES))
        g += f'<line x1="{MARGIN_X}" y1="0" x2="{MARGIN_X}" y2="297" stroke="#8fa8e8" stroke-width=".25"/>'
        out.append(f'<svg class="ov" viewBox="0 0 210 297">{g}</svg>')
    out.append(f'<svg class="ov" viewBox="0 0 210 297">{"".join(S)}</svg>')
    for it in P:
        base = y(it['k']) - LIFT
        attrs = f'data-base="{base:.3f}" data-fs="{it["fs"]}"'
        if it['mx']: attrs += f' data-mx="{it["mx"]}"'
        if it['center'] is not None: attrs += f' data-center="{it["center"]}"'
        pos = (f'left:{it["l"]}mm;' if it['l'] is not None else
               f'left:{it["center"]}mm;' if it['center'] is not None else f'right:{210 - it["r"]}mm;')
        d = 'ltr' if it['ltr'] else 'rtl'
        cls = 'ln ' + it['cls']
        out.append(f'<div class="{cls}" dir="{d}" style="{pos}" {attrs}>{it["t"]}</div>')
        if 'ttl-out' in it['cls']:   # black outline layer under the yellow bubble letters
            out.append(f'<div class="{cls} under" dir="{d}" style="{pos}" {attrs}>{it["t"]}</div>')
    out.append('</section>')
    return '\n'.join(out)

DECO_JS = r'''
// ---- every letter written a little differently
const FAM = ['TH', 'TH1', 'TH2', 'TH3', 'TH4'];
function humanize(el) {
  const last = {};
  let drift = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const tn of nodes) {
    const frag = document.createDocumentFragment();
    for (const ch of tn.textContent) {
      const sp = document.createElement('span');
      sp.textContent = ch;
      if (/\s/.test(ch)) {                                   // uneven gaps between words
        sp.style.fontSize = U(.85, 1.3).toFixed(3) + 'em';
      } else {
        let v; do { v = Math.floor(rnd() * FAM.length); } while (v === last[ch] && FAM.length > 1);
        last[ch] = v;
        drift = Math.max(-.05, Math.min(.05, drift * .8 + U(-.015, .015)));   // baseline wanders slowly
        sp.style.fontFamily = FAM[v];
        sp.style.fontSize = U(.96, 1.04).toFixed(3) + 'em';
        sp.style.position = 'relative';
        sp.style.top = (drift + U(-.018, .018)).toFixed(3) + 'em';
        sp.style.marginInline = U(-.008, .02).toFixed(3) + 'em';
      }
      frag.appendChild(sp);
    }
    tn.replaceWith(frag);
  }
}
function humanizeAll() {
  for (const el of document.querySelectorAll('.ln:not(.under)')) humanize(el);
  for (const el of document.querySelectorAll('.ln.under')) el.innerHTML = el.previousElementSibling.innerHTML;
}

// seeded randomness so every render gives the same "hand"
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const U = (a, b) => a + (b - a) * rnd();
function wob(x0, y0, x1, y1, amp, bow) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(3, Math.round(L / 6));
  const tilt = U(-.5, .5) * Math.min(1, L / 40), b = U(-bow, bow);
  let nz = 0, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; nz = nz * .5 + U(-amp, amp);
    pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + tilt * (t - .5) + b * Math.sin(Math.PI * t) + nz]);
  }
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(2)},${pts[i][1].toFixed(2)} ${mx.toFixed(2)},${my.toFixed(2)}`;
  }
  return d + ` L${pts[n][0].toFixed(2)},${pts[n][1].toFixed(2)}`;
}
function marker(svg, x0, x1, yy, w, col, op = .9) {
  // chisel-tip highlighter: wandering centre line, uneven edges, slanted ends
  const L = x1 - x0, n = Math.max(4, Math.round(L / 3)), sl = w * U(.35, .6);
  const tilt = U(-.6, .6) * Math.min(1, L / 30), bow = U(-.5, .5);
  let nz = 0, top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; nz = nz * .6 + U(-.18, .18);
    const cy = yy + tilt * (t - .5) + bow * Math.sin(Math.PI * t) + nz, x = x0 + L * t;
    const hw = w / 2 * (1 + U(-.12, .12));
    top.push([x + sl / 2, cy - hw]); bot.push([x - sl / 2, cy + hw]);
  }
  const P = top.concat(bot.reverse());
  let d = `M${P[0][0].toFixed(2)},${P[0][1].toFixed(2)}`;
  for (const p of P.slice(1)) d += ` L${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', d + 'Z'); el.setAttribute('fill', col); el.setAttribute('fill-opacity', op);
  el.setAttribute('stroke', col); el.setAttribute('stroke-width', '.25'); el.setAttribute('stroke-linejoin', 'round');
  el.style.mixBlendMode = 'multiply';
  svg.appendChild(el);
}
function drawDeco() {
  const NS = 'http://www.w3.org/2000/svg';
  for (const page of document.querySelectorAll('.page')) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'deco'); svg.setAttribute('viewBox', '0 0 210 297');
    page.insertBefore(svg, page.firstChild);           // under the text
    const P = page.getBoundingClientRect();
    const add = (d, stroke, w, op, cap = 'round') => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', w); p.setAttribute('stroke-linecap', cap); p.setAttribute('stroke-linejoin', 'round');
      if (op) { p.setAttribute('stroke-opacity', op); p.style.mixBlendMode = 'multiply'; }
      svg.appendChild(p);
    };
    for (const sp of page.querySelectorAll('.hl, .ulm, .ul')) {
      const ln = sp.closest('.ln'), fs = parseFloat(ln.style.fontSize), base = +ln.dataset.base;
      const r = sp.getBoundingClientRect();
      const x0 = (r.left - P.left) / MM, x1 = (r.right - P.left) / MM;
      if (sp.classList.contains('ul')) {            // pen underline, a little over/short at the ends
        const yy = base + .2 * fs;
        add(wob(x0 + U(-1.5, .5), yy + U(-.4, .4), x1 + U(-.5, 1.8), yy + U(-.4, .4), .2, .5), '#23232f', .32);
      } else {                                      // highlighter: wide translucent stroke + a streak
        const col = getComputedStyle(sp).getPropertyValue('--h').trim();
        const hl = sp.classList.contains('hl');
        const yy = hl ? base - .17 * fs : base + .3 * fs, w = (hl ? .5 : .26) * fs;
        const xa = x0 + U(-1.4, .2), xb = x1 + U(-.2, 1.6);
        marker(svg, xa, xb, yy, w, col);
        if (rnd() < .5) marker(svg, xa + U(2, 6), xb - U(1, 5), yy + U(-.2, .2) * w, w * U(.5, .8), col, .45); // second pass
      }
    }
  }
}
'''

def build(guides):
    css = f'''
@font-face {{ font-family: TH; src: url("TomerHand-Regular.ttf"); }}
''' + ''.join(f'@font-face {{ font-family: TH{v}; src: url("TomerHand-V{v}.ttf"); }}\n' for v in range(1, 5)) + f'''
@page {{ size: 210mm 297mm; margin: 0; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{ background: #fff; }}
.page {{ position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }}
.ov {{ position: absolute; inset: 0; width: 210mm; height: 297mm; }}
.ln {{ position: absolute; white-space: nowrap; letter-spacing: -.035em; word-spacing: .18em; font-family: TH; color: {INK}; line-height: {ASC + DESC}; }}
.sb {{ font-size: .62em; position: relative; top: .3em; }}
.dot {{ display: inline-block; width: .3em; height: .3em; border-radius: 50%; position: relative; top: -.15em; }}
.hl {{ padding: 0 .15em; }}
.ulm {{ }}
.ul {{ }}
.deco {{ position: absolute; inset: 0; width: 210mm; height: 297mm; }}
.ttl {{ z-index: 2; letter-spacing: 0; }}
''' + ''.join(f'.ttl-{c} {{ color: {v[0]}; -webkit-text-stroke: .085em {v[0]}; }}\n' for c, v in MK.items()) + f'''
.ttl-out {{ -webkit-text-stroke: .07em {MK['y'][0]}; }}
.ttl-out.under {{ z-index: 1; color: {INK}; -webkit-text-stroke: .13em {INK}; }}
'''
    js = f'''
const MM = 96 / 25.4, ASC = {ASC};
async function layout() {{
  await document.fonts.ready;
  humanizeAll();
  await Promise.all(FAM.map(f => document.fonts.load(`20px ${{f}}`, 'אבגH2')));
  await document.fonts.ready;
  for (const el of document.querySelectorAll('.ln')) {{
    let fs = +el.dataset.fs;
    el.style.fontSize = fs + 'mm';
    const mx = +el.dataset.mx || 0;
    const w = el.getBoundingClientRect().width / MM;
    if (mx && w > mx) {{ fs *= Math.max(mx / w, 0.66); el.style.fontSize = fs + 'mm'; }}
    el.style.top = (+el.dataset.base - ASC * fs) + 'mm';
    if (el.dataset.center) el.style.left = (+el.dataset.center - el.getBoundingClientRect().width / MM / 2) + 'mm';
  }}
  drawDeco();
  document.body.dataset.ready = '1';
}}

'''
    body = '\n'.join(page_html(P, S, guides) for P, S in PAGES)
    js += DECO_JS + '\nlayout();\n'
    return f'<!doctype html><html lang="he"><head><meta charset="utf-8"><style>{css}</style></head><body>{body}<script>{js}</script></body></html>'

if __name__ == '__main__':
    out = Path(sys.argv[1])
    (out / 'print.html').write_text(build(False), encoding='utf-8')
    (out / 'test.html').write_text(build(True), encoding='utf-8')
    # every character used must exist in the handwriting font
    from fontTools.ttLib import TTFont
    cmap = TTFont(out / 'TomerHand-Regular.ttf').getBestCmap()
    txt = re.sub(r'<[^>]+>', '', ''.join(it['t'] for P, _ in PAGES for it in P))
    missing = sorted({c for c in H.unescape(txt) if ord(c) not in cmap and not c.isspace()})
    print('missing glyphs:', missing)
