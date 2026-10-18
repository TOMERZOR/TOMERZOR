# Pulls the animation clips out of rigged GLBs from Higgsfield (3D Rigging with an animation)
# into assets/models/anims.json, together with the rest pose of the skeleton each was
# recorded on, so the game can move them onto any rig with the same bones (Assets.clipsFor).
# Usage: python3 tools/extract-anims.py walk=a.glb walkF=b.glb run=c.glb idle=d.glb
import json, struct, sys
import numpy as np

CT = {5126: np.float32}
NC = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}

def load(path):
    d = open(path, 'rb').read()
    jl, _ = struct.unpack('<II', d[12:20])
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl, _ = struct.unpack('<II', d[off:off + 8])
    return j, d[off + 8: off + 8 + bl]

def read(j, b, ai):
    a = j['accessors'][ai]
    v = j['bufferViews'][a['bufferView']]
    n = NC[a['type']]
    arr = np.frombuffer(b, dtype=np.float32, count=a['count'] * n, offset=v.get('byteOffset', 0) + a.get('byteOffset', 0))
    return arr.reshape(a['count'], n)

out = {'bones': None, 'parent': None, 'rest': None, 'hipsY': None, 'clips': {}}
for arg in sys.argv[1:]:
    name, path = arg.split('=', 1)
    j, b = load(path)
    nodes = j['nodes']
    names = [n.get('name') for n in nodes]
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    skin = j['skins'][0]
    joints = skin['joints']
    jset = set(joints)
    # Parents before children.
    order, seen = [], set()
    def visit(i):
        if i in seen: return
        if parent.get(i) in jset: visit(parent[i])
        seen.add(i); order.append(i)
    for i in joints: visit(i)
    rest = {names[i]: nodes[i].get('rotation', [0, 0, 0, 1]) for i in joints}
    hipsY = nodes[names.index('Hips')].get('translation', [0, 0, 0])[1]
    if out['bones'] is None:
        out['bones'] = [names[i] for i in order]
        out['parent'] = {names[i]: (names[parent[i]] if parent.get(i) in jset else None) for i in joints}
        out['rest'] = rest
        out['hipsY'] = hipsY
    anim = j['animations'][0]
    master = None
    tracks = {}
    for ch in anim['channels']:
        t = ch['target']
        if t.get('node') not in jset: continue
        smp = anim['samplers'][ch['sampler']]
        times = read(j, b, smp['input'])[:, 0]
        vals = read(j, b, smp['output'])
        tracks[(names[t['node']], t['path'])] = (times, vals)
        if names[t['node']] == 'Hips' and t['path'] == 'rotation': master = times
    if master is None: master = next(iter(tracks.values()))[0]
    # Every track on the same times (nearest key), and the loop starting at zero.
    def at(times, vals, t):
        k = np.clip(np.searchsorted(times, t), 0, len(times) - 1)
        return vals[k]
    q = {}
    for (bn, path), (times, vals) in tracks.items():
        if path != 'rotation': continue
        arr = np.array([at(times, vals, t) for t in master])
        # Keep neighbouring keys on the same hemisphere so interpolation takes the short way.
        for k in range(1, len(arr)):
            if np.dot(arr[k], arr[k - 1]) < 0: arr[k] = -arr[k]
        q[bn] = [round(float(x), 5) for x in arr.reshape(-1)]
    hips = None
    if ('Hips', 'translation') in tracks:
        times, vals = tracks[('Hips', 'translation')]
        hips = [round(float(x), 3) for x in np.array([at(times, vals, t) for t in master]).reshape(-1)]
    t0 = float(master[0])
    out['clips'][name] = {'duration': round(float(master[-1] - t0), 4), 'times': [round(float(t - t0), 4) for t in master], 'q': q, 'hips': hips, 'rest': rest, 'hipsY': hipsY}
    print(name, path, 'frames', len(master), 'duration', out['clips'][name]['duration'], 'bones', len(q))
json.dump(out, open('assets/models/anims.json', 'w'), separators=(',', ':'))
