import numpy as np, cv2, json, sys
S=sys.argv[1]
ink=(cv2.imread(f'{S}/ink.png',0)<128).astype(np.uint8)
n,lab,st,cen=cv2.connectedComponentsWithStats(ink,8)
np.save(f'{S}/lab.npy',lab)
# lines in small coords (y0,y1,x0,x1)
L=[(215,300,330,1070),(330,405,680,1090),(410,500,260,1100),(505,610,320,1100),(630,715,60,1110),(730,825,220,1120),
   (850,1015,230,1150),(1100,1230,80,1160),(1245,1360,200,1170),(1355,1445,420,1170),(1450,1545,430,1170)]
info={}
for i,(y0,y1,x0,x1) in enumerate(L):
    Y0,Y1,X0,X1=y0*3,y1*3,x0*3,x1*3
    crop=cv2.cvtColor(255-ink[Y0:Y1,X0:X1]*255,cv2.COLOR_GRAY2BGR)
    ids=[]
    for c in range(1,n):
        x,y,w,h,a=st[c]
        cx,cy=x+w/2,y+h/2
        if X0<=cx<X1 and Y0<=cy<Y1 and a>=60 and w<600:
            ids.append(int(c))
            cv2.rectangle(crop,(x-X0,y-Y0),(x-X0+w,y-Y0+h),(0,0,255),2)
    # number in order right->left
    ids.sort(key=lambda c:-(st[c][0]+st[c][2]/2))
    big=cv2.copyMakeBorder(crop,60,0,0,0,cv2.BORDER_CONSTANT,value=(255,255,255))
    for k,c in enumerate(ids):
        x,y,w,h,a=st[c]
        cv2.putText(big,str(k),(int(x-X0+w/2-15),40 if k%2==0 else 20+40*0+55),cv2.FONT_HERSHEY_SIMPLEX,1.1,(200,0,0),3)
    big=cv2.resize(big,None,fx=0.5,fy=0.5,interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{S}/lines/L{i}.png',big)
    info[i]=ids
json.dump({'lines':info,'stats':st.tolist()},open(f'{S}/comps.json','w'))
