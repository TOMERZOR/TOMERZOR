# Shrinks a rigged character GLB from Higgsfield for the game: drops tangents and the bundled
# animation (the game plays its own walk cycle on the same skeleton), and re-encodes the
# texture as a 512px JPEG. Usage: python3 tools/pack-person.py in.glb out.glb
import io, json, struct, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
d = open(src, 'rb').read()
jl, _ = struct.unpack('<II', d[12:20])
j = json.loads(d[20:20 + jl])
off = 20 + jl
bl, _ = struct.unpack('<II', d[off:off + 8])
binc = d[off + 8: off + 8 + bl]

j.pop('animations', None)
for m in j['meshes']:
    for p in m['primitives']:
        p['attributes'].pop('TANGENT', None)
        for mat in [j['materials'][p['material']]] if 'material' in p else []:
            mat.pop('normalTexture', None)
            mat.pop('occlusionTexture', None)
            mat.pop('emissiveTexture', None)
            (mat.get('pbrMetallicRoughness') or {}).pop('metallicRoughnessTexture', None)

# Which accessors and images are still in use.
used_acc = set()
for m in j['meshes']:
    for p in m['primitives']:
        used_acc.update(p['attributes'].values())
        if 'indices' in p: used_acc.add(p['indices'])
for s in j.get('skins', []):
    if 'inverseBindMatrices' in s: used_acc.add(s['inverseBindMatrices'])
used_tex = set()
for mat in j.get('materials', []):
    t = (mat.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
    if t: used_tex.add(t['index'])
used_img = {j['textures'][t]['source'] for t in used_tex}

out = bytearray()
views = []
view_map = {}
def add_view(data, extra):
    while len(out) % 4: out.append(0)
    views.append(dict(extra, buffer=0, byteOffset=len(out), byteLength=len(data)))
    out.extend(data)
    return len(views) - 1

acc_map = {}
accessors = []
for i in sorted(used_acc):
    a = dict(j['accessors'][i])
    v = j['bufferViews'][a['bufferView']]
    key = a['bufferView']
    if key not in view_map:
        data = binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
        view_map[key] = add_view(data, {k: v[k] for k in ('byteStride', 'target') if k in v})
    a['bufferView'] = view_map[key]
    acc_map[i] = len(accessors)
    accessors.append(a)

img_map = {}
images = []
for i in sorted(used_img):
    im = j['images'][i]
    v = j['bufferViews'][im['bufferView']]
    pic = Image.open(io.BytesIO(binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']])).convert('RGB')
    pic.thumbnail((512, 512), Image.LANCZOS)
    buf = io.BytesIO()
    pic.save(buf, 'JPEG', quality=86)
    img_map[i] = len(images)
    images.append({'bufferView': add_view(buf.getvalue(), {}), 'mimeType': 'image/jpeg'})

for m in j['meshes']:
    for p in m['primitives']:
        p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = acc_map[p['indices']]
for s in j.get('skins', []):
    if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]
tex_map = {}
textures = []
for t in sorted(used_tex):
    tt = dict(j['textures'][t])
    tt['source'] = img_map[tt['source']]
    tex_map[t] = len(textures)
    textures.append(tt)
for mat in j.get('materials', []):
    t = (mat.get('pbrMetallicRoughness') or {}).get('baseColorTexture')
    if t: t['index'] = tex_map[t['index']]
j['accessors'], j['bufferViews'], j['images'], j['textures'] = accessors, views, images, textures
j['samplers'] = j.get('samplers') or [{}]
j['buffers'] = [{'byteLength': len(out)}]

js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(out) % 4: out.append(0)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb)
print(f'{src}: {len(d) // 1024} KB -> {len(glb) // 1024} KB')
