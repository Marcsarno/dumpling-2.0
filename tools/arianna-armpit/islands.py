import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from glbio import *
from segment import segment
from topo import components
args = sys.argv[sys.argv.index('--') + 1:]
g, b = read_glb(args[0]); d = read_primitive(g, b); jp = joint_bind_positions(g, b)
r = segment(d, jp)
T, P, UV = d['INDICES'], d['POSITION'], d['TEXCOORD_0']
isl = components(T, len(P))[T[:, 0]]
cen = P[T].mean(1)
for pre in ('Left', 'Right'):
    sd = r['sides'][pre]; s = sd['s']
    cutset = set(sd['cut'])
    near = np.array([len(set(r['WT'][f]) & cutset) > 0 for f in range(len(T))])
    band = (cen[:, 1] > 0.46) & (cen[:, 1] < 0.77)
    for name, mask in (('sleeve', sd['sleeve'] & band), ('torso', ~sd['sleeve'] & band & r['shell'][r['WT'][:, 0]] & (cen[:, 0] * s > 0.05))):
        ids, cnt = np.unique(isl[mask], return_counts=True)
        order = np.argsort(-cnt)[:6]
        print(pre, name, 'faces', int(mask.sum()))
        for o in order:
            m = mask & (isl == ids[o])
            uv = UV[T[m]].reshape(-1, 2)
            print('   island', ids[o], 'faces', cnt[o], 'y %.3f-%.3f' % (cen[m, 1].min(), cen[m, 1].max()), 'z %.3f-%.3f' % (cen[m, 2].min(), cen[m, 2].max()), 'uv', uv.min(0).round(3), uv.max(0).round(3), 'nearcut', int((m & near).sum()))
