import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from glbio import *
from segment import segment
import viz
args = sys.argv[sys.argv.index('--') + 1:]
g, b = read_glb(args[0]); d = read_primitive(g, b); jp = joint_bind_positions(g, b)
r = segment(d, jp)
WT, WP = r['WT'], r['WP']
fc = np.tile([0.35, 0.45, 0.9], (len(WT), 1))
fc[~r['shell'][WT[:, 0]]] = [0.6, 0.6, 0.6]
for pre, col in (('Left', [0.9, 0.3, 0.2]), ('Right', [0.2, 0.8, 0.3])):
    sd = r['sides'][pre]
    fc[sd['sleeve']] = col
    print(pre, 'cut', len(sd['cut']), 'loop', len(sd['loop']), 'sleeve faces', int(sd['sleeve'].sum()), 'H', sd['H'][0], sd['H'][-1])
viz.reset()
keep = np.ones(len(WT), bool)
if len(args) > 2: keep = ~(r["sides"]["Left"]["sleeve"] | r["sides"]["Right"]["sleeve"])
viz.add_mesh("m", WP, WT[keep], face_colors=fc[keep])
for pre in ('Left', 'Right'):
    sd = r['sides'][pre]
    viz.add_points(WP[sd['cut']], 0.0018)
viz.render(args[1])
print('DONE')
