import numpy as np, cv2, sys, json
I, S = sys.argv[1], sys.argv[2]
regions = json.loads(sys.argv[3])   # name: [img, x0, y0, x1, y1]
out = {}
for name, (img, x0, y0, x1, y1) in regions.items():
    im = cv2.imread(f'{I}/{img}.jpg').astype(np.float32)
    bg = cv2.GaussianBlur(cv2.dilate(im, np.ones((9, 9))), (0, 0), 12)
    n = np.clip(im / bg, 0, 1)
    ink = (n.max(2) < 0.62).astype(np.uint8)     # dark in every channel => pen, not blue rule
    np.save(f'{S}/lat/ink{img}.npy', ink)
    sub = ink[y0:y1, x0:x1]
    k, lab, st, _ = cv2.connectedComponentsWithStats(sub, 8)
    F = 5
    vis = cv2.cvtColor(cv2.resize(255 - sub * 255, None, fx=F, fy=F, interpolation=cv2.INTER_NEAREST), cv2.COLOR_GRAY2BGR)
    comps = []
    for c in range(1, k):
        x, y, w, h, a = st[c]
        if a < 6: continue
        comps.append([int(x + x0), int(y + y0), int(w), int(h), int(a)])
        cv2.rectangle(vis, (x * F, y * F), ((x + w) * F, (y + h) * F), (0, 0, 255), 1)
        cv2.putText(vis, str(len(comps) - 1), (x * F, y * F + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 0, 0), 1)
    cv2.imwrite(f'{S}/lat/{name}.png', vis)
    out[name] = comps
json.dump(out, open(f'{S}/lat/comps.json', 'w'))
