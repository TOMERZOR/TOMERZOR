import numpy as np, cv2, json, sys
S=sys.argv[1]
spec=json.load(open(sys.argv[2]))
d=json.load(open(f'{S}/comps.json')); st=np.array(d['stats']); lines=d['lines']
lab=np.load(f'{S}/lab.npy')
out={}
tiles=[]
for ch,e in spec.items():
    li=str(e['line']); ids=[lines[li][k] for k in e['comps']]
    x0=min(st[c][0] for c in ids); y0=min(st[c][1] for c in ids)
    x1=max(st[c][0]+st[c][2] for c in ids); y1=max(st[c][1]+st[c][3] for c in ids)
    if 'xcut' in e:  # relative fraction range of bbox to keep
        a,b=e['xcut']; w=x1-x0; x0,x1=x0+int(a*w),x0+int(b*w)
    m=np.isin(lab[y0:y1,x0:x1],ids).astype(np.uint8)
    np.save(f'{S}/glyphs/{ord(ch):04x}.npy',m)
    out[ch]=dict(line=int(li),bbox=[int(x0),int(y0),int(x1),int(y1)])
    t=cv2.copyMakeBorder(255-m*255,10,10,10,10,cv2.BORDER_CONSTANT,value=255)
    sc=150/max(t.shape); t=cv2.resize(t,None,fx=sc,fy=sc,interpolation=cv2.INTER_AREA)
    T=np.full((200,170),255,np.uint8); T[:t.shape[0],:t.shape[1]]=t
    tiles.append((ch,T))
json.dump(out,open(f'{S}/glyph_boxes.json','w'))
cols=10; rows=(len(tiles)+cols-1)//cols
sheet=np.full((rows*200,cols*170),255,np.uint8)
for i,(ch,T) in enumerate(tiles):
    r,c=divmod(i,cols); sheet[r*200:(r+1)*200,c*170:(c+1)*170]=T
    cv2.putText(sheet,f'{i}',(c*170+5,r*200+195),cv2.FONT_HERSHEY_SIMPLEX,0.6,0,1)
cv2.imwrite(f'{S}/sheet.png',sheet)
print(' '.join(f'{i}:{ch}' for i,(ch,_) in enumerate(tiles)))
