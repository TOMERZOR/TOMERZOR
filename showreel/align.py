import json,re,difflib
W=json.load(open('words.json'))
script="""יש אנשים שנולדו בשכונה.
ויש אנשים שכותבים "ברצוני לברר".
ערסלייט. האפליקציה שמתרגמת עברית... לערסית.
כותבים הודעה רגילה. לוחצים. ומקבלים אותה כמו שהיא הייתה נשמעת, אם הייתם גדלים ליד הקיוסק.
מתאים למוסכניק. לאבא של החברה. ולשכן שמתקן לכם את הדוד.
שני מודלים: ערס 3.5, הכי חזק בשכונה. וערסית 2.5. חדה, מהירה, ושרופה על הכל.
1,500 ביטויים. קללות במינון אחראי. ואפס תכלס. כי ערסים לא אומרים תכלס.
עובד גם בלי אינטרנט. כי גם לערס יש אזורים בלי קליטה.
ערסלייט. כי לא כולם נולדו בשכונה. אבל כולם יכולים להישמע ככה."""
lines=[l for l in script.split('\n')]
def norm(w): 
    w=re.sub(r'[^א-ת0-9]','',w); return w.replace('ע','א').replace('הכול','הכל')
# merge whisper number fragments
ww=[]
for w in W:
    if ww and re.fullmatch(r'[.,]\d+',w['w'] or '') and re.fullmatch(r'\d+',ww[-1]['w']):
        ww[-1]['w']+=w['w']; ww[-1]['e']=w['e']
    else: ww.append(dict(w))
sw=[(li,w) for li,l in enumerate(lines) for w in l.split()]
a=[norm(w) for _,w in sw]; b=[norm(w['w']) for w in ww]
sm=difflib.SequenceMatcher(None,a,b,autojunk=False)
t=[None]*len(sw)
for tag,i1,i2,j1,j2 in sm.get_opcodes():
    if tag=='equal':
        for k in range(i2-i1): t[i1+k]=(ww[j1+k]['s'],ww[j1+k]['e'])
    elif tag=='replace' and (i2-i1)==(j2-j1):
        for k in range(i2-i1): t[i1+k]=(ww[j1+k]['s'],ww[j1+k]['e'])
    elif tag=='replace':
        s0,e0=ww[j1]['s'],ww[j2-1]['e']; n=i2-i1
        for k in range(n): t[i1+k]=(s0+(e0-s0)*k/n, s0+(e0-s0)*(k+1)/n)
# fill gaps
for i in range(len(t)):
    if t[i] is None:
        p=next((t[j] for j in range(i-1,-1,-1) if t[j]),(0,0)); q=next((t[j] for j in range(i+1,len(t)) if t[j]),(p[1]+.3,p[1]+.3))
        t[i]=(p[1],q[0])
out=[{'line':li,'w':w,'s':round(t[i][0],3),'e':round(t[i][1],3)} for i,(li,w) in enumerate(sw)]
json.dump({'lines':lines,'words':out},open('/home/user/TOMERZOR/showreel/vo.json','w'),ensure_ascii=False)
for li,l in enumerate(lines):
    ws=[o for o in out if o['line']==li]; print(f"{ws[0]['s']:6.2f}-{ws[-1]['e']:6.2f}  {l}")
print(sm.ratio())
