"""Writes tokef/assets/demo.json: one example project, clearly flagged as a demo.

Company names, people and insurers are invented. Phone numbers are left empty
and e-mail addresses use the reserved .example domain, so nothing here can
reach a real person."""
import json, os, sys
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

TODAY = date(2026, 10, 23)
NOW = datetime(2026, 10, 23, 7, 40, tzinfo=timezone(timedelta(hours=3)))
PID = 'pdemo1'
CLIENT = 'א.ב. בנייה ופיתוח בע״מ'
CLIENT_ID = '514000001'


def ms(days_ago=0, hour=9, minute=0):
    d = NOW - timedelta(days=days_ago)
    d = d.replace(hour=hour, minute=minute)
    return int(d.timestamp() * 1000)


def iso(d):
    return d.isoformat()


def line(on, mn, codes):
    return {'on': on, 'min': mn, 'codes': codes}


PROFILES = [
    {'id': 'rdemo-exec', 'key': 'exec', 'name': 'קבלני ביצוע', 'cancelDays': 30, 'requester': True, 'order': 0, 'lines': {
        'tpl': line(True, 5000000, [302, 304, 309, 315, 321, 322, 328, 329]), 'el': line(True, 20000000, [304, 309, 319, 328]),
        'car': line(False, 0, [309, 313, 314, 316, 318, 328]), 'pl': line(False, 2000000, [302, 304, 309, 321, 328, 332]),
        'prod': line(False, 2000000, [302, 304, 309, 321, 328, 332]), 'cme': line(False, 1000000, [309, 312, 328])}},
    {'id': 'rdemo-heavy', 'key': 'heavy', 'name': 'עבודות עפר, מנופים וצמ״ה', 'cancelDays': 30, 'requester': True, 'order': 1, 'lines': {
        'tpl': line(True, 5000000, [302, 304, 309, 312, 315, 321, 322, 328, 329]), 'el': line(True, 20000000, [304, 309, 319, 328]),
        'car': line(False, 0, [309, 313, 314, 316, 318, 328]), 'pl': line(False, 2000000, [302, 304, 309, 321, 328, 332]),
        'prod': line(False, 2000000, [302, 304, 309, 321, 328, 332]), 'cme': line(True, 1000000, [309, 312, 328])}},
    {'id': 'rdemo-design', 'key': 'design', 'name': 'מתכננים ויועצים', 'cancelDays': 30, 'requester': True, 'order': 2, 'lines': {
        'tpl': line(True, 2000000, [302, 304, 309, 321, 322, 328]), 'el': line(True, 20000000, [304, 309, 319, 328]),
        'car': line(False, 0, [309, 313, 314, 316, 318, 328]), 'pl': line(True, 2000000, [302, 304, 309, 321, 328, 332]),
        'prod': line(False, 2000000, [302, 304, 309, 321, 328, 332]), 'cme': line(False, 1000000, [309, 312, 328])}},
    {'id': 'rdemo-supply', 'key': 'supply', 'name': 'ספקים והתקנות', 'cancelDays': 30, 'requester': True, 'order': 3, 'lines': {
        'tpl': line(True, 2000000, [302, 304, 309, 321, 322, 328]), 'el': line(True, 20000000, [304, 309, 319, 328]),
        'car': line(False, 0, [309, 313, 314, 316, 318, 328]), 'pl': line(False, 2000000, [302, 304, 309, 321, 328, 332]),
        'prod': line(True, 2000000, [302, 304, 309, 321, 328, 332]), 'cme': line(False, 1000000, [309, 312, 328])}},
]
PROF = {p['id']: p for p in PROFILES}

INSURERS = ['ארז חברה לביטוח בע״מ', 'גליל ביטוח בע״מ', 'שקד חברה לביטוח בע״מ', 'תבור ביטוח בע״מ']
AGENTS = ['סוכנות לוי ביטוחים', 'מ.ד. סוכנות לביטוח', 'אופק סוכנות לביטוח', 'ש.ר. ביטוחים']

# name, company id, trade, profile, contact, agent name, end date, scenario, days since the certificate was checked
SUBS = [
    ('ש.מ. חשמל בע״מ', '515123456', 'חשמל', 'rdemo-exec', 'שמעון מזרחי', 'אבי לוי', date(2026, 10, 22), 'ok', 160),
    ('א.ד. טפסנות בע״מ', '515234561', 'טפסנות', 'rdemo-exec', 'אחמד דיאב', 'דנה מור', date(2027, 2, 28), 'lowlimit', 2),
    ('ר.ג. אינסטלציה', '515345612', 'אינסטלציה', 'rdemo-exec', 'רמי גבאי', 'יוסי אופק', date(2026, 11, 6), 'ok', 120),
    ('מ.ל. שלד ובנייה בע״מ', '515456123', 'שלד', 'rdemo-exec', 'משה לוי', 'אבי לוי', date(2027, 5, 31), 'ok', 40),
    ('ב.ש. פיגומים', '515561234', 'פיגומים', 'rdemo-exec', 'בני שטרן', 'שירה רז', date(2027, 3, 14), 'ok', 33),
    ('י.ח. איטום', '515612345', 'איטום', 'rdemo-exec', 'יעקב חדד', 'דנה מור', date(2027, 1, 9), 'ok', 61),
    ('ע.נ. מעליות בע״מ', '515723456', 'מעליות', 'rdemo-supply', 'עדי נחום', 'יוסי אופק', date(2027, 6, 30), 'ok', 12),
    ('ד.א. ריצוף', '515834567', 'ריצוף', 'rdemo-exec', 'דוד אזולאי', 'שירה רז', date(2027, 4, 19), 'waived', 9),
    ('ק.ב. גבס ותקרות', '515945678', 'גבס ותקרות', 'rdemo-exec', 'קובי ברק', 'אבי לוי', date(2026, 11, 21), 'ok', 95),
    ('ה.ת. מיזוג אוויר', '516056789', 'מיזוג אוויר', 'rdemo-exec', 'הדס תמיר', 'דנה מור', date(2027, 8, 2), 'ok', 18),
    ('נ.ר. אלומיניום', '516167890', 'אלומיניום', 'rdemo-supply', 'ניר רוזן', 'יוסי אופק', date(2027, 2, 15), 'ok', 27),
    ('ג.פ. עבודות עפר בע״מ', '516278901', 'עבודות עפר', 'rdemo-heavy', 'גיא פרץ', 'שירה רז', date(2026, 12, 11), 'ok', 70),
    ('ס.מ. צבע', '516389012', 'צבע', 'rdemo-exec', 'סאמר מנסור', 'אבי לוי', date(2027, 3, 27), 'ok', 22),
    ('ת.א. נגרות', '516490123', 'נגרות', 'rdemo-exec', 'תומר אלון', '', None, 'nocert', 0),
    ('י.ל. הנדסת מבנים', '516501234', 'תכנון', 'rdemo-design', 'יעל לנדאו', 'יוסי אופק', date(2027, 7, 31), 'requester', 4),
]

# The site office, hand-written for a realistic example rather than computed.
TYPE_LABEL = {'tpl': 'ביטוח אחריות כלפי צד שלישי', 'el': 'ביטוח חבות מעבידים', 'pl': 'ביטוח אחריות מקצועית', 'prod': 'ביטוח חבות המוצר', 'cme': 'ביטוח צמ״ה'}


def slug(i):
    return 'sdemo%02d' % (i + 1)


def build():
    subs, certs = [], []
    for i, (name, cid, trade, prof, contact, agent, end, scen, ago) in enumerate(SUBS):
        sid = slug(i)
        latin = ['sm-electric', 'ad-formwork', 'rg-plumbing', 'ml-frame', 'bs-scaffold', 'yh-sealing', 'an-elevators', 'da-tiles', 'kb-drywall', 'ht-hvac', 'nr-aluminum', 'gp-earthworks', 'sm-paint', 'ta-carpentry', 'yl-engineering'][i]
        subs.append({
            'id': sid, 'pid': PID, 'name': name, 'companyId': cid, 'trade': trade, 'profile': prof,
            'contact': contact, 'phone': '', 'email': 'office@' + latin + '.example',
            'agent': agent, 'agentEmail': ('agent@' + latin + '-ins.example') if agent else '', 'agentPhone': '',
            'workFrom': '2026-03-01', 'workTo': '2027-09-30' if prof != 'rdemo-design' else '2027-12-31', 'notes': '',
            'createdAt': ms(220 - i), 'demo': True,
        })
        if scen == 'nocert':
            continue
        p = PROF[prof]
        start = end - timedelta(days=364)
        pols = []
        for t in ('tpl', 'el', 'pl', 'prod', 'cme'):
            ln = p['lines'][t]
            if not ln['on']:
                continue
            pols.append({'type': t, 'label': TYPE_LABEL[t], 'policyNo': '%02d-%07d' % (10 + i, 1000000 + i * 7919 + len(pols) * 31),
                         'start': iso(start), 'end': iso(end), 'limit': ln['min'] if t != 'tpl' else max(ln['min'], 5000000 if prof != 'rdemo-design' else 2000000),
                         'currency': 'ILS', 'codes': list(ln['codes'])})
        requester, requester_id = CLIENT, CLIENT_ID
        exception = None
        if scen == 'lowlimit':
            pols[0]['limit'] = 2000000
            pols[0]['codes'] = [c for c in pols[0]['codes'] if c != 321]
        if scen == 'waived':
            pols[0]['limit'] = 4000000
            exception = {'note': 'אושר על ידי מנהלת הביטוח עד החידוש באפריל', 'by': None, 'at': ms(8, 11, 20)}
        if scen == 'requester':
            requester, requester_id = 'מגדלי הדקלים בע״מ', '516999990'
        certs.append({
            'id': 'cdemo%02d' % (i + 1), 'pid': PID, 'sid': sid, 'createdAt': ms(ago, 8 + i % 9, (i * 7) % 60), 'by': None,
            'source': 'ai' if i % 3 else 'manual', 'file': None, 'exception': exception, 'demo': True,
            'fields': {'insuredName': name, 'insuredId': cid, 'requester': requester, 'requesterId': requester_id,
                       'insurer': INSURERS[i % 4], 'agent': AGENTS[i % 4], 'issueDate': iso(start - timedelta(days=3)),
                       'cancelDays': 30, 'policies': pols},
        })
    project = {'id': PID, 'name': 'מתחם הדקלים, בניין 3', 'client': CLIENT, 'clientId': CLIENT_ID, 'address': 'רחוב הדקל 12, חדרה',
               'warnDays': 30, 'cover': 'day', 'createdAt': ms(230), 'demo': True}
    profiles = [dict(p, pid=PID, createdAt=ms(230)) for p in PROFILES]
    log = [
        {'at': ms(0, 7, 31), 'by': None, 'kind': 'request', 'text': 'הוכנה בקשה בוואטסאפ ל' + SUBS[0][0], 'sid': slug(0)},
        {'at': ms(2, 10, 12), 'by': None, 'kind': 'cert', 'text': 'נבדק אישור של ' + SUBS[1][0] + ': דורש תיקון', 'sid': slug(1)},
        {'at': ms(2, 10, 15), 'by': None, 'kind': 'request', 'text': 'הוכן מייל תיקון לסוכן של ' + SUBS[1][0], 'sid': slug(1)},
        {'at': ms(4, 14, 2), 'by': None, 'kind': 'cert', 'text': 'נבדק אישור של ' + SUBS[14][0] + ': דורש תיקון', 'sid': slug(14)},
        {'at': ms(8, 11, 20), 'by': None, 'kind': 'exception', 'text': 'אושרה חריגה ל' + SUBS[7][0] + ': אושר על ידי מנהלת הביטוח עד החידוש באפריל', 'sid': slug(7)},
        {'at': ms(9, 9, 5), 'by': None, 'kind': 'cert', 'text': 'נבדק אישור של ' + SUBS[7][0] + ': דורש תיקון', 'sid': slug(7)},
        {'at': ms(12, 13, 40), 'by': None, 'kind': 'cert', 'text': 'נבדק אישור של ' + SUBS[6][0] + ': תקין', 'sid': slug(6)},
        {'at': ms(30, 8, 0), 'by': None, 'kind': 'sub', 'text': SUBS[13][0] + ' נוסף לפרויקט', 'sid': slug(13)},
        {'at': ms(230, 9, 0), 'by': None, 'kind': 'project', 'text': 'הפרויקט נוצר', 'sid': None},
    ]
    return {'projects': [project], 'profiles': profiles, 'subs': subs, 'certs': certs,
            'logs': [{'id': PID, 'pid': PID, 'items': log}]}


if __name__ == '__main__':
    data = build()
    out = os.path.join(ROOT, 'assets', 'demo.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print('wrote', out, sum(len(v) for v in data.values()), 'documents')
