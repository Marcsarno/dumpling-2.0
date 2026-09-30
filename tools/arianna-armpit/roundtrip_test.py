import sys, os, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbio import *
src = sys.argv[sys.argv.index('--') + 1]; dst = sys.argv[sys.argv.index('--') + 2]
g, b = read_glb(src); d = read_primitive(g, b)
write_glb(dst, g, b, d)
g2, b2 = read_glb(dst); d2 = read_primitive(g2, b2)
for k in d: assert (d[k] == d2[k]).all(), k
def img(g, b, i):
    v = g['bufferViews'][g['images'][i]['bufferView']]; o = v.get('byteOffset', 0); return hashlib.sha256(b[o:o+v['byteLength']]).hexdigest()
for i in range(2): assert img(g, b, i) == img(g2, b2, i)
jp = joint_bind_positions(g, b)
print('ROUNDTRIP_OK', {k: jp[k].round(4).tolist() for k in ['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'Spine', 'Spine01']})
