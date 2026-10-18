# Packs a rigged character GLB from Higgsfield for the game.
#  - Drops tangents and the bundled animation (the game plays its own walk cycle on the same
#    skeleton) and re-encodes the body texture as a JPEG.
#  - Gives the face its own sharp texture: the image-to-3D texture smears small details, so the
#    front of the head is split into a separate primitive that maps the original full-body
#    illustration straight onto it (the mesh was lifted from that same image, front view).
# Usage: python3 tools/pack-person.py rigged.glb out.glb [fullbody.png]
import io, json, struct, sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
body_png = sys.argv[3] if len(sys.argv) > 3 else None
d = open(src, 'rb').read()
jl, _ = struct.unpack('<II', d[12:20])
j = json.loads(d[20:20 + jl])
off = 20 + jl
bl, _ = struct.unpack('<II', d[off:off + 8])
binc = d[off + 8: off + 8 + bl]

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def read(ai):
    a = j['accessors'][ai]
    v = j['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']])
    n = NC[a['type']]
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', dt.itemsize * n)
    raw = np.frombuffer(binc, dtype=np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * n, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], dt.itemsize * n), strides=(stride, 1))
    return np.ascontiguousarray(rows).view(dt).reshape(a['count'], n)

j.pop('animations', None)
mesh = j['meshes'][0]
prim = mesh['primitives'][0]
prim['attributes'].pop('TANGENT', None)
for mat in j.get('materials', []):
    for k in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
        mat.pop(k, None)
    (mat.get('pbrMetallicRoughness') or {}).pop('metallicRoughnessTexture', None)

# ---- the output buffer ----
out = bytearray()
views, accessors = [], []
def add_view(data, target=None):
    while len(out) % 4: out.append(0)
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
    if target: v['target'] = target
    views.append(v)
    out.extend(data)
    return len(views) - 1
def add_acc(arr, ctype, typ, target=None, minmax=False):
    a = {'bufferView': add_view(arr.tobytes(), target), 'componentType': ctype, 'count': len(arr), 'type': typ}
    if ctype in (5120, 5121, 5122, 5123) and typ != 'SCALAR' and arr.dtype != np.float32:
        pass
    if minmax:
        a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accessors.append(a)
    return len(accessors) - 1
def keep_acc(ai, target=None):
    a = dict(j['accessors'][ai])
    arr = read(ai)
    a.pop('byteOffset', None)
    a['bufferView'] = add_view(arr.tobytes(), target)
    accessors.append(a)
    return len(accessors) - 1
def add_image(pic, quality=86):
    buf = io.BytesIO()
    pic.convert('RGB').save(buf, 'JPEG', quality=quality)
    j.setdefault('images', []).append({'bufferView': add_view(buf.getvalue()), 'mimeType': 'image/jpeg'})
    return len(j['images']) - 1

attrs = prim['attributes']
pos = read(attrs['POSITION']).astype(np.float64)
idx = read(prim['indices']).reshape(-1, 3).astype(np.int64)

# Smooth normals: the rigged mesh has every triangle's corners split apart, which lights it
# as flat facets. Corners at the same position share the average of their faces' normals.
def smooth_normals(pos, idx):
    key = np.round(pos / (np.abs(pos).max() * 1e-5 + 1e-12)).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    p0, p1, p2 = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
    fn = np.cross(p1 - p0, p2 - p0)  # area-weighted
    acc = np.zeros((weld.max() + 1, 3))
    for c in range(3):
        np.add.at(acc, weld[idx[:, c]], fn)
    n = acc[weld]
    return (n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)).astype(np.float32)
# Only for meshes that come split per triangle (SAM); indexed ones keep their own normals.
snorm = smooth_normals(pos, idx) if ('NORMAL' in attrs and len(pos) > 2.5 * len(idx)) else None

face_prim = None
if body_png:
    # Head = the top of the body; in the image, the same fraction of the silhouette height.
    H = pos[:, 1].max() - pos[:, 1].min()
    top = pos[:, 1].max()
    cut = top - H * 0.155
    head_v = pos[:, 1] > cut
    img = Image.open(body_png).convert('RGB')
    a = np.asarray(img).astype(int)
    fg = a.sum(2) < 735
    ys, xs = np.where(fg)
    itop, ibot = ys.min(), ys.max()
    iH = ibot - itop
    band = fg[itop:itop + int(iH * 0.12)]
    by, bx = np.where(band)
    # Fit image x/y to mesh x/y from the top of the head (x: head width, y: body height).
    mx = pos[head_v & (pos[:, 1] > top - H * 0.12)]
    sx = (bx.max() - bx.min()) / (mx[:, 0].max() - mx[:, 0].min())
    ox = bx.min() - mx[:, 0].min() * sx
    sy = iH / H
    to_px = lambda p: np.stack([p[:, 0] * sx + ox, itop + (top - p[:, 1]) * sy], 1)
    # Front-facing triangles of the head (the model faces +z).
    p0, p1, p2 = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
    n = np.cross(p1 - p0, p2 - p0)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    in_head = head_v[idx].all(1)
    front = in_head & (n[:, 2] > 0.4)
    # Never the white background around the head: any triangle that would sample it keeps
    # its original texture.
    px_all = to_px(pos)
    W, Hh = img.size
    from PIL import ImageDraw
    m = Image.fromarray(((a.sum(2) > 690) * 255).astype(np.uint8))
    for c in ((0, 0), (W - 1, 0), (0, Hh - 1), (W - 1, Hh - 1)):
        ImageDraw.floodfill(m, c, 128)
    bgmask = np.asarray(m) == 128  # white that touches the edge = background; eyes and teeth stay
    bgmask = np.asarray(Image.fromarray(bgmask.astype(np.uint8) * 255).filter(__import__('PIL.ImageFilter', fromlist=['x']).MaxFilter(5))) > 0
    bright = a.sum(2) > 660
    brow = itop + (by.max() - itop) * 0.42  # above the eyebrows, white can only be background/shine
    hcx, hw = (bx.min() + bx.max()) / 2, bx.max() - bx.min()
    def bg(pt):
        x = np.clip(pt[:, 0].round().astype(int), 0, W - 1); y = np.clip(pt[:, 1].round().astype(int), 0, Hh - 1)
        inner = (y >= brow) & (np.abs(x - hcx) < hw * 0.3)  # eyes and teeth live here
        return bgmask[y, x] | (bright[y, x] & ~inner)
    cen = (px_all[idx[:, 0]] + px_all[idx[:, 1]] + px_all[idx[:, 2]]) / 3
    for pts in (px_all[idx[:, 0]], px_all[idx[:, 1]], px_all[idx[:, 2]], cen, (px_all[idx[:, 0]] + cen) / 2, (px_all[idx[:, 1]] + cen) / 2, (px_all[idx[:, 2]] + cen) / 2):
        front &= ~bg(pts)
    if front.sum() > 20:
        # The face texture: the head region of the illustration, a little larger, at 2x.
        uv_px = to_px(pos)
        used = np.unique(idx[front])
        x0, y0 = uv_px[used].min(0) - 4
        x1, y1 = uv_px[used].max(0) + 4
        crop = img.crop((int(x0), int(y0), int(np.ceil(x1)), int(np.ceil(y1))))
        crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
        remap = -np.ones(len(pos), np.int64)
        remap[used] = np.arange(len(used))
        fuv = np.stack([(uv_px[used, 0] - int(x0)) / (int(np.ceil(x1)) - int(x0)), (uv_px[used, 1] - int(y0)) / (int(np.ceil(y1)) - int(y0))], 1).astype(np.float32)
        fa = {}
        for k, ai in attrs.items():
            if k == 'TEXCOORD_0': continue
            arr = snorm[used] if (k == 'NORMAL' and snorm is not None) else read(ai)[used]
            base = j['accessors'][ai]
            fa[k] = add_acc(np.ascontiguousarray(arr), base['componentType'], base['type'], 34962, minmax=(k == 'POSITION'))
            if base.get('normalized'): accessors[fa[k]]['normalized'] = True
        fa['TEXCOORD_0'] = add_acc(fuv, 5126, 'VEC2', 34962)
        fidx = remap[idx[front]].astype(np.uint32).reshape(-1)
        mat = json.loads(json.dumps(j['materials'][prim['material']]))
        img_i = add_image(crop, 90)
        j.setdefault('textures', []).append({'source': img_i, 'sampler': 1})
        mat.setdefault('pbrMetallicRoughness', {})['baseColorTexture'] = {'index': len(j['textures']) - 1}
        j['materials'].append(mat)
        face_prim = {'attributes': fa, 'indices': add_acc(fidx, 5125, 'SCALAR', 34963), 'material': len(j['materials']) - 1}
        ftris = idx[front]
        idx = idx[~front]
        print(f'face: {front.sum()} triangles, texture {crop.size}')
        if len(sys.argv) > 4:
            from PIL import ImageDraw as D
            dbg = img.copy(); dr = D.Draw(dbg)
            for t in ftris:
                dr.polygon([tuple(px_all[k]) for k in t], outline=(255, 0, 0))
            dbg.crop((int(x0) - 20, int(y0) - 20, int(x1) + 20, int(y1) + 20)).resize((600, 640)).save(sys.argv[4])

# ---- the body primitive and the rest ----
# Smaller where it doesn't show: skin weights as normalized bytes, joints as bytes, 16-bit indices.
def small_attr(k, ai):
    if k == 'NORMAL' and snorm is not None: return add_acc(snorm, 5126, 'VEC3', 34962)
    arr = read(ai)
    if k.startswith('WEIGHTS_'):
        w = arr.astype(np.float64); w /= w.sum(1, keepdims=True) + 1e-12
        q = np.floor(w * 255).astype(np.int64)
        rest = 255 - q.sum(1)
        order = np.argsort(-(w * 255 - q), axis=1)
        for r in range(4):
            q[np.arange(len(q)), order[:, r]] += (rest > r)
        i = add_acc(q.astype(np.uint8), 5121, 'VEC4', 34962); accessors[i]['normalized'] = True; return i
    if k.startswith('JOINTS_') and arr.max() < 256:
        return add_acc(arr.astype(np.uint8), 5121, 'VEC4', 34962)
    return keep_acc(ai, 34962)
new_attrs = {k: small_attr(k, ai) for k, ai in attrs.items()}
prim['attributes'] = new_attrs
flat = idx.reshape(-1)
prim['indices'] = add_acc(flat.astype(np.uint16), 5123, 'SCALAR', 34963) if len(pos) < 65536 else add_acc(flat.astype(np.uint32), 5125, 'SCALAR', 34963)
for s in j.get('skins', []):
    if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = keep_acc(s['inverseBindMatrices'])
# Body texture.
old_images = j.get('images', [])[:len(j.get('images', [])) - (1 if face_prim else 0)]
body_tex = (j['materials'][prim['material']].get('pbrMetallicRoughness') or {}).get('baseColorTexture')
if body_tex:
    ti = j['textures'][body_tex['index']]
    im = old_images[ti['source']]
    v = j['bufferViews'][im['bufferView']]
    pic = Image.open(io.BytesIO(binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]))
    pic.thumbnail((1024, 1024), Image.LANCZOS)
    buf = io.BytesIO(); pic.convert('RGB').save(buf, 'JPEG', quality=86)
    im['bufferView'] = add_view(buf.getvalue()); im['mimeType'] = 'image/jpeg'
# Drop images and textures nothing uses any more.
used_tex = []
for m in j['materials']:
    t = (m.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
    if t: used_tex.append(t['index'])
tex_map, textures, img_map, images = {}, [], {}, []
for t in sorted(set(used_tex)):
    tt = dict(j['textures'][t])
    s_ = tt['source']
    if s_ not in img_map:
        img_map[s_] = len(images); images.append(j['images'][s_])
    tt['source'] = img_map[s_]; tt['sampler'] = 1 if tt.get('sampler') == 1 else 0
    tex_map[t] = len(textures); textures.append(tt)
for m in j['materials']:
    t = (m.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
    if t: t['index'] = tex_map[t['index']]
if face_prim: mesh['primitives'].append(face_prim)
j['accessors'], j['bufferViews'], j['images'], j['textures'] = accessors, views, images, textures
j['samplers'] = [{'magFilter': 9729, 'minFilter': 9987}, {'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]
j['buffers'] = [{'byteLength': len(out)}]

js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(out) % 4: out.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb)
print(f'{src}: {len(d) // 1024} KB -> {len(glb) // 1024} KB')
