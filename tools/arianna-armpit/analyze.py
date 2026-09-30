import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from glbio import *
from crease import *
src = sys.argv[sys.argv.index('--') + 1]; dst = sys.argv[sys.argv.index('--') + 2]
g, b = read_glb(src); d = read_primitive(g, b); jp = joint_bind_positions(g, b)
wid, rep = weld(d['POSITION']); WP = d['POSITION'][rep]; WT = wid[d['INDICES']]
print('welded', len(WP))
res = {}
for side, pre in ((1, 'Left'), (-1, 'Right')):
    chain = np.array([jp[pre + 'Arm'], jp[pre + 'ForeArm'], jp[pre + 'Hand']])
    def axis(h, chain=chain):
        for i in range(2):
            a, c = chain[i], chain[i + 1]
            if min(a[1], c[1]) <= h <= max(a[1], c[1]):
                f = (h - a[1]) / (c[1] - a[1]); p = a + f * (c - a); return p[0], p[2]
        p = chain[0] if h > chain[0][1] else chain[-1]; return p[0], p[2]
    hs = np.arange(0.44, 0.785, 0.005)
    res[pre] = notches(WP, WT, side, hs, axis)
    for h, f, bk, dep in res[pre]:
        print(pre, round(h, 3), None if f is None else np.round(f, 4).tolist(), None if bk is None else np.round(bk, 4).tolist(), round(dep, 2))
json.dump(res, open(dst, 'w'))
