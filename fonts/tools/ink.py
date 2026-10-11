import numpy as np, cv2, sys
# usage: ink.py <workdir> <photo.heic|png>
S=sys.argv[1]
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener; register_heif_opener()
im=np.asarray(ImageOps.exif_transpose(Image.open(sys.argv[2])).convert('RGB'))[..., ::-1].astype(np.float32)
bg=cv2.GaussianBlur(cv2.dilate(im,np.ones((15,15))),(0,0),25)   # paper brightness
sr=1-np.clip(im/bg,0,1)[...,2]   # blue ink = drop in the red channel
weak=(sr>0.27).astype(np.uint8)
L=301
lines=np.zeros_like(weak)
for ang in np.arange(-5,5.01,0.5):
    k=np.zeros((61,L),np.uint8)
    xs=np.arange(L)-L//2
    ys=np.round(30+xs*np.tan(np.radians(ang))).astype(int)
    k[ys,xs+L//2]=1
    lines|=cv2.morphologyEx(weak,cv2.MORPH_OPEN,k)
for ang in np.arange(-4,4.01,1):  # vertical margin lines
    LV=601; k=np.zeros((LV,61),np.uint8); ys=np.arange(LV)-LV//2
    xs=np.round(30+ys*np.tan(np.radians(ang))).astype(int); k[ys+LV//2,xs]=1
    lines|=cv2.morphologyEx(weak,cv2.MORPH_OPEN,k)
lines=cv2.dilate(lines,np.ones((3,3),np.uint8))
m=(weak&(1-lines)).astype(np.uint8)
m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((9,1),np.uint8))
m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
n,lab,st,_=cv2.connectedComponentsWithStats(m,8)
keep=(st[:,4]>=60); keep[0]=False
out=keep[lab].astype(np.uint8)
cv2.imwrite(f'{S}/ink.png',255-out*255)
cv2.imwrite(f'{S}/ink_small.png',cv2.resize(255-out*255,(1428,1904),interpolation=cv2.INTER_AREA))
