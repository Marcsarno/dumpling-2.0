"""Find the fused sleeve/jacket creases on Arianna's single-shell mesh.

The Meshy mesh has no inner sleeve: each sleeve's outer surface meets the jacket side in
a sharp concave fold (front and back) from just under the shoulder down to the hem. On
every horizontal slice those folds are the two strongest concave corners between the arm
and the torso. glTF coordinates: +Y up, +Z front, +X her left.
"""
import numpy as np


def weld(P, tol=1e-5):
    q = np.round(P / tol).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    return inv.reshape(-1), first  # welded id per vertex, representative vertex per id


def slice_loops(WP, WT, h):
    """Closed cross-section polylines at height h: list of (points[n,2] as x,z, edge keys)."""
    y = WP[:, 1] - h
    y = np.where(np.abs(y) < 1e-7, 1e-7, y)
    s = y[WT] > 0
    hit = np.where(s.any(1) & ~s.all(1))[0]
    link = {}
    pts = {}
    for t in hit:
        a, b, c = WT[t]
        es = []
        for u, v in ((a, b), (b, c), (c, a)):
            if (y[u] > 0) != (y[v] > 0):
                k = (min(u, v), max(u, v))
                if k not in pts:
                    f = y[u] / (y[u] - y[v])
                    p = WP[u] + f * (WP[v] - WP[u])
                    pts[k] = (p[0], p[2])
                es.append(k)
        if len(es) == 2:
            link.setdefault(es[0], []).append(es[1]); link.setdefault(es[1], []).append(es[0])
    loops, seen = [], set()
    for start in link:
        if start in seen: continue
        loop, prev, cur = [start], None, start
        seen.add(start)
        while True:
            nxt = [n for n in link[cur] if n != prev and (n not in seen or (n == start and len(loop) > 2))]
            if not nxt: break
            if nxt[0] == start: break
            prev, cur = cur, nxt[0]
            seen.add(cur); loop.append(cur)
        loops.append((np.array([pts[k] for k in loop]), loop))
    return loops


def resample_turn(poly, d=0.004):
    """Signed turning of a closed polyline over +-d arc length at every point (radians)."""
    seg = np.linalg.norm(np.roll(poly, -1, 0) - poly, axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    L = s[-1]
    def at(q):
        q = q % L
        i = np.searchsorted(s, q, side='right') - 1
        i = np.clip(i, 0, len(poly) - 1)
        f = (q - s[i]) / np.maximum(seg[i], 1e-12)
        return poly[i] + f[:, None] * (poly[(i + 1) % len(poly)] - poly[i])
    a, b = at(s[:-1] - d), at(s[:-1] + d)
    u, v = poly - a, b - poly
    cross = u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0]
    dot = (u * v).sum(1)
    return np.arctan2(cross, dot)


def notches(WP, WT, side, heights, arm_axis):
    """Front and back crease points per height for side (+1 left, -1 right).

    arm_axis(h) -> (x, z) of the arm bone at height h. Returns list of (h, front xz, back xz, depth).
    """
    out = []
    for h in heights:
        loops = slice_loops(WP, WT, h)
        best = None
        for poly, _ in loops:
            if len(poly) < 20: continue
            xs = poly[:, 0] * side
            if xs.max() < 0.13 or xs.min() > -0.05: continue  # must span torso and this arm
            if best is None or len(poly) > len(best): best = poly
        if best is None:
            out.append((h, None, None, 0)); continue
        poly = best
        area = 0.5 * np.sum(poly[:, 0] * np.roll(poly[:, 1], -1) - np.roll(poly[:, 0], -1) * poly[:, 1])
        turn = resample_turn(poly) * np.sign(area)  # positive = convex
        ax, az = arm_axis(h)
        xs = poly[:, 0] * side
        zone = (xs > 0.06) & (xs < 0.165) & (poly[:, 1] < 0.095) & (poly[:, 1] > -0.09)
        conc = np.where(zone, -turn, -np.inf)
        # front crease: in front of the arm-to-torso midpoint; back: behind it
        mid = az - 0.02
        f = np.where(poly[:, 1] >= mid, conc, -np.inf); b = np.where(poly[:, 1] < mid, conc, -np.inf)
        fi, bi = int(np.argmax(f)), int(np.argmax(b))
        out.append((h, poly[fi].tolist(), poly[bi].tolist(), float(min(f[fi], b[bi]))))
    return out
