"""Minimal GLB reader/writer for Arianna's armpit fix (runs in Blender's Python, numpy only).

Only the skinned primitive's vertex/index data is replaced. Every other buffer view
(the two 2048x2048 PNG textures, inverse bind matrices, animation data) is copied
byte-for-byte, and the JSON is otherwise unchanged apart from offsets and counts.
"""
import json, struct
import numpy as np

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
ATTRS = ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT', 'JOINTS_0', 'WEIGHTS_0']


def read_glb(path):
    b = open(path, 'rb').read()
    assert struct.unpack_from('<I', b, 0)[0] == 0x46546C67
    jl = struct.unpack_from('<I', b, 12)[0]
    gltf = json.loads(b[20:20 + jl])
    bl = struct.unpack_from('<I', b, 20 + jl)[0]
    binary = b[28 + jl:28 + jl + bl]
    return gltf, binary


def accessor(gltf, binary, i):
    a = gltf['accessors'][i]
    v = gltf['bufferViews'][a['bufferView']]
    dt, n = COMP[a['componentType']], NCOMP[a['type']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(binary, dtype=dt, count=a['count'] * n, offset=off)
    return arr.reshape(a['count'], n).copy() if n > 1 else arr.copy()


def read_primitive(gltf, binary):
    p = gltf['meshes'][0]['primitives'][0]
    data = {k: accessor(gltf, binary, p['attributes'][k]) for k in ATTRS}
    data['INDICES'] = accessor(gltf, binary, p['indices']).reshape(-1, 3)
    return data


def joint_bind_positions(gltf, binary):
    """World-space bind position of each skin joint (mesh space), keyed by node name."""
    skin = gltf['skins'][0]
    ibm = accessor(gltf, binary, skin['inverseBindMatrices']).reshape(-1, 4, 4)
    out = {}
    for j, node in enumerate(skin['joints']):
        m = np.linalg.inv(ibm[j].T)  # glTF matrices are column-major
        out[gltf['nodes'][node]['name']] = m[:3, 3].copy()
    return out


def joint_names(gltf):
    return [gltf['nodes'][n]['name'] for n in gltf['skins'][0]['joints']]


def write_glb(path, gltf, binary, data):
    """Rebuild the GLB with new primitive data; all other buffer views keep their bytes."""
    g = json.loads(json.dumps(gltf))
    p = g['meshes'][0]['primitives'][0]
    old_views = {g['accessors'][p['attributes'][k]]['bufferView'] for k in ATTRS} | {g['accessors'][p['indices']]['bufferView']}
    n = len(data['POSITION'])
    assert n < 65536, 'indices are uint16'
    arrays = {
        'POSITION': data['POSITION'].astype(np.float32), 'NORMAL': data['NORMAL'].astype(np.float32),
        'TEXCOORD_0': data['TEXCOORD_0'].astype(np.float32), 'TANGENT': data['TANGENT'].astype(np.float32),
        'JOINTS_0': data['JOINTS_0'].astype(np.uint8), 'WEIGHTS_0': data['WEIGHTS_0'].astype(np.float32),
    }
    idx = data['INDICES'].astype(np.uint16).reshape(-1)
    out = bytearray()
    new_offsets = {}

    def put(raw):
        while len(out) % 4: out.append(0)
        off = len(out); out.extend(raw); return off

    # Mesh views first, in their original order, then every other view unchanged.
    for vi, view in enumerate(g['bufferViews']):
        if vi in old_views:
            acc = next(a for a in g['accessors'] if a.get('bufferView') == vi)
            key = next((k for k in ATTRS if g['accessors'][p['attributes'][k]] is acc), None)
            raw = (arrays[key] if key else idx).tobytes()
        else:
            s = view.get('byteOffset', 0)
            raw = binary[s:s + view['byteLength']]
        view['byteOffset'] = put(raw)
        view['byteLength'] = len(raw)
    while len(out) % 4: out.append(0)
    for k in ATTRS:
        a = g['accessors'][p['attributes'][k]]
        a['count'] = n
        if k == 'POSITION':
            a['min'] = arrays[k].min(0).tolist(); a['max'] = arrays[k].max(0).tolist()
    g['accessors'][p['indices']]['count'] = len(idx)
    g['buffers'][0]['byteLength'] = len(out)
    js = json.dumps(g, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
