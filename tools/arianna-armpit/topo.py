"""Mesh-graph helpers: guided edge paths and barrier flood fills on the welded mesh."""
import heapq
import numpy as np


def edge_graph(WT, WP):
    adj = {}
    for a, b, c in WT:
        for u, v in ((a, b), (b, c), (c, a)):
            adj.setdefault(u, set()).add(v); adj.setdefault(v, set()).add(u)
    return adj


def dist_to_polyline(p, poly):
    best = np.inf
    for a, b in zip(poly[:-1], poly[1:]):
        ab = b - a
        t = np.clip(np.dot(p - a, ab) / max(np.dot(ab, ab), 1e-12), 0, 1)
        best = min(best, np.linalg.norm(p - (a + t * ab)))
    return best


def guided_path(adj, WP, start, goal, guide, k=300.0, allowed=None):
    """Shortest edge path from start to goal hugging the guide polyline (3D)."""
    cache = {}
    def pen(v):
        if v not in cache: cache[v] = dist_to_polyline(WP[v], guide)
        return cache[v]
    D = {start: 0.0}; prev = {}
    q = [(0.0, start)]
    while q:
        d, u = heapq.heappop(q)
        if u == goal: break
        if d > D.get(u, np.inf): continue
        for v in adj[u]:
            if allowed is not None and v not in allowed: continue
            w = np.linalg.norm(WP[u] - WP[v]) * (1 + k * 0.5 * (pen(u) + pen(v)))
            nd = d + w
            if nd < D.get(v, np.inf):
                D[v] = nd; prev[v] = u; heapq.heappush(q, (nd, v))
    path = [goal]
    while path[-1] != start: path.append(prev[path[-1]])
    return path[::-1]


def nearest(WP, p, mask=None):
    d = np.linalg.norm(WP - p, axis=1)
    if mask is not None: d = np.where(mask, d, np.inf)
    return int(np.argmin(d))


def face_regions(WT, barrier_edges, seed_faces):
    """Flood fill faces from seed faces without crossing barrier edges (welded ids)."""
    edge_faces = {}
    for f, (a, b, c) in enumerate(WT):
        for u, v in ((a, b), (b, c), (c, a)):
            edge_faces.setdefault((min(u, v), max(u, v)), []).append(f)
    region = np.zeros(len(WT), bool)
    stack = list(seed_faces)
    for f in stack: region[f] = True
    while stack:
        f = stack.pop()
        a, b, c = WT[f]
        for u, v in ((a, b), (b, c), (c, a)):
            e = (min(u, v), max(u, v))
            if e in barrier_edges: continue
            for g in edge_faces[e]:
                if not region[g]:
                    region[g] = True; stack.append(g)
    return region


def components(WT, n):
    parent = np.arange(n)
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for a, b, c in WT:
        for u, v in ((a, b), (a, c)):
            ru, rv = find(u), find(v)
            if ru != rv: parent[ru] = rv
    return np.array([find(i) for i in range(n)])
