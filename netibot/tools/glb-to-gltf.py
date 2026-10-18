# Split .glb models into <name>.json (glTF with geometry as a data URI) + <name>_N.jpg textures.
# Artifact hosting serves .json and .jpg but not .glb. Usage: python3 tools/glb-to-gltf.py assets/models/*.glb
import base64, io, json, os, struct, sys
from PIL import Image

for path in sys.argv[1:]:
    d = open(path, 'rb').read()
    jl, _ = struct.unpack('<II', d[12:20])
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl, _ = struct.unpack('<II', d[off:off + 8])
    binc = d[off + 8: off + 8 + bl]
    base = os.path.splitext(path)[0]
    name = os.path.basename(base)
    img_views = {}
    for i, im in enumerate(j.get('images', [])):
        v = j['bufferViews'][im['bufferView']]
        data = binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
        pic = Image.open(io.BytesIO(data)).convert('RGB')
        fn = f'{name}_{i}.jpg'
        pic.save(os.path.join(os.path.dirname(path), fn), quality=85)
        img_views[im['bufferView']] = True
        del im['bufferView']
        im.pop('mimeType', None)
        im['uri'] = fn
    # Rebuild the buffer without the image views and remap indices.
    keep = [i for i in range(len(j['bufferViews'])) if i not in img_views]
    remap = {old: new for new, old in enumerate(keep)}
    out = b''
    views = []
    for old in keep:
        v = j['bufferViews'][old]
        data = binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
        while len(out) % 4: out += b'\0'
        v = dict(v, byteOffset=len(out), byteLength=len(data))
        out += data
        views.append(v)
    j['bufferViews'] = views
    for a in j.get('accessors', []):
        if 'bufferView' in a: a['bufferView'] = remap[a['bufferView']]
    j['buffers'] = [{'byteLength': len(out), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(out).decode()}]
    open(base + '.json', 'w').write(json.dumps(j, separators=(',', ':')))
    os.remove(path)
    print(path, '->', base + '.json', os.path.getsize(base + '.json'))
