"""Locate each fused sleeve seam and split the shell into sleeve and jacket regions."""
import numpy as np
from crease import weld, notches
from topo import edge_graph, guided_path, nearest, face_regions, components

SIDES = ((1, 'Left'), (-1, 'Right'))
H_BOT = 0.48


def arm_axis_fn(jp, pre):
    chain = np.array([jp[pre + 'Arm'], jp[pre + 'ForeArm'], jp[pre + 'Hand']])
    def axis(h):
        for i in range(2):
            a, c = chain[i], chain[i + 1]
            if min(a[1], c[1]) <= h <= max(a[1], c[1]):
                p = a + (h - a[1]) / (c[1] - a[1]) * (c - a); return p[0], p[2]
        p = chain[0] if h > chain[0][1] else chain[-1]; return p[0], p[2]
    return axis, chain


def median_smooth(a, k=5):
    out = a.copy()
    for i in range(len(a)):
        lo, hi = max(0, i - k // 2), min(len(a), i + k // 2 + 1)
        out[i] = np.median(a[lo:hi], axis=0)
    return out


def segment(d, jp):
    P, T = d['POSITION'], d['INDICES']
    wid, rep = weld(P); WP = P[rep]; WT = wid[T]
    adj = edge_graph(WT, WP)
    comp = components(WT, len(WP))
    # the body shell is the component containing the vertex nearest the chest
    shell = comp == comp[nearest(WP, np.array([0.0, 0.62, 0.08]))]
    result = {'wid': wid, 'rep': rep, 'WP': WP, 'WT': WT, 'shell': shell, 'sides': {}}
    for s, pre in SIDES:
        axis, chain = arm_axis_fn(jp, pre)
        hs = np.arange(H_BOT, 0.7601, 0.005)
        rows = notches(WP, WT, s, hs, axis)
        # top of the crease: last height where the fold is still clearly concave
        top = max(i for i, r in enumerate(rows) if r[1] is not None and r[3] >= 0.35 and r[0] <= 0.752)
        rows = rows[:top + 1]
        H = np.array([r[0] for r in rows])
        F = median_smooth(np.array([r[1] for r in rows])); B = median_smooth(np.array([r[2] for r in rows]))
        F3 = np.stack([F[:, 0], H, F[:, 1]], 1); B3 = np.stack([B[:, 0], H, B[:, 1]], 1)
        allowed = set(np.where(shell)[0].tolist())
        ftop, fbot = nearest(WP, F3[-1], shell), nearest(WP, F3[0], shell)
        btop, bbot = nearest(WP, B3[-1], shell), nearest(WP, B3[0], shell)
        fpath = guided_path(adj, WP, ftop, fbot, F3[::-1], allowed=allowed)
        bpath = guided_path(adj, WP, bbot, btop, B3, allowed=allowed)
        # bottom: along the hem where the cuff touches the jacket
        low = set(np.where(shell & (WP[:, 1] < H_BOT + 0.012))[0].tolist()) | {fbot, bbot}
        hpath = guided_path(adj, WP, fbot, bbot, np.array([WP[fbot], WP[bbot]]), allowed=low)
        # shoulder barrier (not cut): over the top of the shoulder joint
        head = jp[pre + 'Arm']
        near_head = shell & (np.hypot(WP[:, 0] - head[0], WP[:, 2] - head[2]) < 0.02)
        stop = int(np.argmax(np.where(near_head, WP[:, 1], -np.inf)))
        spath = guided_path(adj, WP, btop, ftop, np.array([WP[btop], WP[stop], WP[ftop]]), allowed=allowed)
        cut = fpath + hpath[1:] + bpath[1:]  # ftop ... fbot ... bbot ... btop
        loop = cut + spath[1:-1]
        barrier = {(min(u, v), max(u, v)) for u, v in zip(loop, loop[1:] + loop[:1])}
        # seed: outermost sleeve face at mid upper arm
        cen = WP[WT].mean(1)
        mid = (np.abs(cen[:, 1] - 0.6) < 0.01) & shell[WT[:, 0]]
        seed = int(np.argmax(np.where(mid, cen[:, 0] * s, -np.inf)))
        sleeve = face_regions(WT, barrier, [seed])
        result['sides'][pre] = dict(s=s, H=H, F=F3, B=B3, cut=cut, spath=spath, loop=loop, sleeve=sleeve,
                                     ftop=ftop, btop=btop, fbot=fbot, bbot=bbot, stop=stop, chain=chain)
    return result
