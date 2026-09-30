"""Arianna armpit fix: open the fused sleeve seams and rebuild a real armpit.

Owner-approved on 2026-09-29 as a one-off exception to the protected-character rule, for
the armpit and jacket deformation only. The original GLB is archived untouched; this
writes a candidate next to it. Everything outside the seam is preserved:

* every original vertex keeps its position, normal, UV and tangent, so the rest pose
  looks exactly as before and the 2048x2048 colour and normal maps are copied byte for
  byte (no re-encode);
* the 28-joint rig, bone names, inverse bind matrices and all six clips are unchanged;
* only skin weights around the armpits and jacket sides change, the fused seams are
  ripped, and new inner-sleeve and jacket-side panels (hidden inside the body at rest)
  close the openings. Their UVs sample the neighbouring jacket texture.

Run inside Blender's Python:
  blender --background --factory-startup --python tools/arianna-armpit/build.py -- <in.glb> <out.glb> [report.json]
"""
import sys, os, json, heapq
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from glbio import read_glb, read_primitive, write_glb, joint_bind_positions, joint_names
from segment import segment
from topo import components

R_ROWS, M_COLS = 24, 6
SLEEVE_BULGE, SLEEVE_BULGE_MAX = 0.35, 0.022
TORSO_BULGE, TORSO_BULGE_MAX = 0.15, 0.012
TORSO_REACH = (0.10, 0.16)      # geodesic distance (m) over which jacket weights return to the original
HINGE_RADIUS = 0.035            # blend radius around the armpit apex
UV_INSET = 4 / 2048             # texels kept between panel UVs and island edges


def smoothstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def closest_on_tris(q, A, B, C):
    """Closest point to q on each triangle (vectorised Ericson); returns points and barycentrics."""
    ab, ac, ap = B - A, C - A, q - A
    d1, d2 = (ab * ap).sum(1), (ac * ap).sum(1)
    bp = q - B; d3, d4 = (ab * bp).sum(1), (ac * bp).sum(1)
    cp = q - C; d5, d6 = (ab * cp).sum(1), (ac * cp).sum(1)
    va = d3 * d6 - d5 * d4; vb = d5 * d2 - d1 * d6; vc = d1 * d4 - d3 * d2
    n = len(A); bary = np.zeros((n, 3))
    denom = np.where(np.abs(va + vb + vc) < 1e-20, 1e-20, va + vb + vc)
    v = vb / denom; w = vc / denom
    bary[:] = np.stack([1 - v - w, v, w], 1)
    def setm(m, b):
        bary[m] = b[m] if b.ndim == 2 else b
    with np.errstate(divide='ignore', invalid='ignore'):
        # vertex and edge regions
        m = (d1 <= 0) & (d2 <= 0); setm(m, np.array([1., 0, 0]))
        m2 = (d3 >= 0) & (d4 <= d3); setm(m2 & ~m, np.array([0., 1, 0])); m |= m2
        m3 = (d6 >= 0) & (d5 <= d6); setm(m3 & ~m, np.array([0., 0, 1])); m |= m3
        t = d1 / (d1 - d3); m4 = (vc <= 0) & (d1 >= 0) & (d3 <= 0) & ~m
        setm(m4, np.stack([1 - t, t, 0 * t], 1)); m |= m4
        t = d2 / (d2 - d6); m5 = (vb <= 0) & (d2 >= 0) & (d6 <= 0) & ~m
        setm(m5, np.stack([1 - t, 0 * t, t], 1)); m |= m5
        t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); m6 = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0) & ~m
        setm(m6, np.stack([0 * t, 1 - t, t], 1))
    pts = bary[:, :1] * A + bary[:, 1:2] * B + bary[:, 2:] * C
    return pts, bary


def uv_on_island(q, tri_idx, P, T, UV):
    A, B, C = P[T[tri_idx, 0]], P[T[tri_idx, 1]], P[T[tri_idx, 2]]
    pts, bary = closest_on_tris(q, A, B, C)
    k = int(np.argmin(np.linalg.norm(pts - q, axis=1)))
    f = T[tri_idx[k]]
    uv = bary[k] @ UV[f]
    # keep samples a few texels inside the island so the padding never bleeds in
    c = UV[f].mean(0); d = c - uv; n = np.linalg.norm(d)
    return uv + d * min(1.0, UV_INSET / n) if n > 1e-9 else uv


def arc_param(pts):
    d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    return d / max(d[-1], 1e-12)


def interp_curve(pts, vals, t):
    """Interpolate per-point values (rows) along a polyline at normalised arc positions t."""
    s = arc_param(pts)
    return np.stack([np.interp(t, s, vals[:, c]) for c in range(vals.shape[1])], -1)


def project_chain(p, chain):
    """Arm parameter u (0 shoulder joint, 1 elbow, 2 wrist) and the axis point."""
    best = (np.inf, 0, chain[0])
    for i in range(len(chain) - 1):
        a, b = chain[i], chain[i + 1]; ab = b - a
        t = np.clip(np.dot(p - a, ab) / np.dot(ab, ab), 0, 1)
        x = a + t * ab; dd = np.linalg.norm(p - x)
        if dd < best[0]: best = (dd, i + t, x)
    return best[1], best[2]


def geodesic(adj, WP, sources, allowed):
    D = {s: 0.0 for s in sources}; q = [(0.0, s) for s in sources]; heapq.heapify(q)
    while q:
        d, u = heapq.heappop(q)
        if d > D[u]: continue
        for v in adj[u]:
            if v not in allowed: continue
            nd = d + np.linalg.norm(WP[u] - WP[v])
            if nd < D.get(v, np.inf): D[v] = nd; heapq.heappush(q, (nd, v))
    return D


def normalize_top4(Wd):
    out_j = np.zeros((len(Wd), 4), np.uint8); out_w = np.zeros((len(Wd), 4), np.float32)
    order = np.argsort(-Wd, axis=1)[:, :4]
    w = np.take_along_axis(Wd, order, 1); w = np.where(w < 1e-4, 0, w)
    w /= w.sum(1, keepdims=True)
    out_j[:] = order; out_w[:] = w
    out_j[w == 0] = 0
    return out_j, out_w


def build(src, dst, report_path=None):
    gltf, binary = read_glb(src)
    d = read_primitive(gltf, binary)
    jp = joint_bind_positions(gltf, binary)
    names = joint_names(gltf); J = {n: i for i, n in enumerate(names)}
    P, NRM, UV, TAN = d['POSITION'], d['NORMAL'], d['TEXCOORD_0'], d['TANGENT']
    T = d['INDICES'].astype(np.int64)
    n0 = len(P)
    Wd = np.zeros((n0, len(names)))
    np.add.at(Wd, (np.repeat(np.arange(n0), 4), d['JOINTS_0'].reshape(-1)), d['WEIGHTS_0'].reshape(-1))
    Wd /= Wd.sum(1, keepdims=True)
    orig_Wd = Wd.copy()

    seg = segment(d, jp)
    wid, WP, WT = seg['wid'], seg['WP'], seg['WT']
    nw = len(WP)
    adj = {}
    for a, b, c in WT:
        for u, v in ((a, b), (b, c), (c, a)):
            adj.setdefault(u, set()).add(v); adj.setdefault(v, set()).add(u)
    island = components(T, n0)[T[:, 0]]
    cen = P[T].mean(1)

    # ---------- per welded vertex weights (sleeve rule / jacket rule) ----------
    newW = np.array([orig_Wd[np.where(wid == w)[0][0]] for w in range(nw)])  # start from originals
    sleeve_rule_w = {}; torso_rule_w = {}
    face_sleeve = np.zeros(len(T), bool)
    report = {'sides': {}}
    for pre, sd in seg['sides'].items():
        s, chain = sd['s'], sd['chain']
        sl = sd['sleeve']; face_sleeve |= sl
        arm_chain = [J[pre + n] for n in ('Arm', 'ForeArm', 'Hand', 'Hand_End')]
        shoulder = J[pre + 'Shoulder']
        torso_bones = [J[n] for n in ('Hips', 'Spine02', 'Spine01', 'Spine', 'neck')]
        apex_y = max(WP[sd['ftop'], 1], WP[sd['btop'], 1])
        sleeve_v = np.unique(WT[sl]); torso_v = np.unique(WT[~sl])
        torso_v = torso_v[WP[torso_v, 0] * s > 0]  # this side of the jacket only (the other arm is handled there)
        # arm weight profile along the sleeve, from its outer half (clean arm weights)
        u_of = {}; ax_of = {}
        for v in sleeve_v:
            u_of[v], ax_of[v] = project_chain(WP[v], chain)
        bins = np.linspace(0, 2, 41); prof = np.zeros((len(bins), len(names))); cnt = np.zeros(len(bins))
        for v in sleeve_v:
            outward = (WP[v] - ax_of[v]); outward[1] = 0
            if outward[0] * s <= 0.25 * np.linalg.norm(outward) or WP[v, 1] < 0.46: continue
            k = int(round(u_of[v] / 0.05)); prof[k] += newW[v]; cnt[k] += 1
        ok = cnt > 0
        prof[ok] /= cnt[ok, None]
        for c in range(len(names)): prof[:, c] = np.interp(bins, bins[ok], prof[ok, c])
        def profile(u):
            return np.array([np.interp(u, bins, prof[:, c]) for c in range(len(names))])
        # hinge weights at the armpit apex: half arm (at the joint), half upper spine
        spine_top = np.zeros(len(names)); spine_top[J['Spine']] = .6; spine_top[J['Spine01']] = .4
        u_apex, _ = project_chain(0.5 * (WP[sd['ftop']] + WP[sd['btop']]), chain)
        hinge = 0.5 * profile(u_apex) + 0.5 * spine_top; hinge /= hinge.sum()
        a0, a1 = WP[sd['ftop']], WP[sd['btop']]
        def apex_dist(p):
            ab = a1 - a0; t = np.clip(np.dot(p - a0, ab) / np.dot(ab, ab), 0, 1); return np.linalg.norm(p - (a0 + t * ab))
        # sleeve rule: follow the arm profile below the armpit, original on the shoulder cap
        for v in sleeve_v:
            w = profile(u_of[v])
            w = w + (orig_Wd[np.where(wid == v)[0][0]] - w) * smoothstep(apex_y - 0.01, apex_y + 0.03, WP[v, 1])
            w = hinge + (w - hinge) * smoothstep(0, HINGE_RADIUS, apex_dist(WP[v]))
            sleeve_rule_w[v] = w / w.sum()
        # jacket rule: drop this arm's influence from the jacket sides and front/back panels
        torso_set = set(torso_v.tolist())
        geo = geodesic(adj, WP, sd['cut'], torso_set)
        for v in torso_v:
            w = newW[v].copy()
            keep = max(smoothstep(apex_y - 0.04, apex_y + 0.03, WP[v, 1]), smoothstep(*TORSO_REACH, geo.get(v, np.inf)))
            removed = w[arm_chain].sum() * (1 - keep) + w[shoulder] * 0.5 * (1 - keep)
            w[arm_chain] *= keep; w[shoulder] *= 1 - 0.5 * (1 - keep)
            base = w[torso_bones].copy()
            if base.sum() < 1e-6:
                y = WP[v, 1]; base[:] = 0
                base[torso_bones.index(J['Spine'] if y > .7 else J['Spine01'] if y > .62 else J['Spine02'])] = 1
            w[torso_bones] += removed * base / base.sum()
            w = hinge + (w - hinge) * smoothstep(0, HINGE_RADIUS, apex_dist(WP[v]))
            torso_rule_w[v] = w / w.sum()
        sd.update(profile=profile, hinge=hinge, apex_y=apex_y, u_of=u_of)
        report['sides'][pre] = {'apex_y': float(apex_y), 'cut_vertices': len(sd['cut']), 'sleeve_faces': int(sl.sum())}
    # blend by how much of each vertex's surroundings is sleeve vs jacket
    inc_s = np.zeros(nw); inc_t = np.zeros(nw)
    np.add.at(inc_s, WT[face_sleeve].reshape(-1), 1); np.add.at(inc_t, WT[~face_sleeve].reshape(-1), 1)
    for v in range(nw):
        a = sleeve_rule_w.get(v); b = torso_rule_w.get(v)
        if a is not None and b is not None:
            f = inc_s[v] / (inc_s[v] + inc_t[v]); newW[v] = f * a + (1 - f) * b
        elif a is not None: newW[v] = a
        elif b is not None: newW[v] = b

    # ---------- rip the seams ----------
    Wv = newW[wid].copy()                       # per original vertex
    add = {k: [] for k in ('P', 'N', 'UV', 'TAN', 'W')}
    def new_vertex(p, n, uv, tan, w):
        idx = n0 + len(add['P'])
        add['P'].append(p); add['N'].append(n); add['UV'].append(uv); add['TAN'].append(tan); add['W'].append(w)
        return idx
    T = T.copy()
    cut_sets = {}
    for pre, sd in seg['sides'].items():
        ripped = set(sd['cut'][1:-1])            # ftop and btop stay joined (the armpit apex)
        cut_sets[pre] = ripped
        copy_of = {}
        for f in np.where(sd['sleeve'])[0]:
            for k in range(3):
                ov = T[f, k]
                if wid[ov] in ripped:
                    if ov not in copy_of:
                        copy_of[ov] = new_vertex(P[ov], NRM[ov], UV[ov], TAN[ov], sleeve_rule_w[wid[ov]])
                    T[f, k] = copy_of[ov]
        # the jacket side keeps the original vertex, with pure jacket weights
        for ov in np.where(np.isin(wid, list(ripped)))[0]:
            Wv[ov] = torso_rule_w[wid[ov]]
        sd['copy_of'] = copy_of

    # ---------- fill panels ----------
    fill_tris = []
    for pre, sd in seg['sides'].items():
        s, chain, cut = sd['s'], sd['chain'], sd['cut']
        i_fbot, i_bbot = cut.index(sd['fbot']), cut.index(sd['bbot'])
        Fp, Hp, Bp = WP[cut[:i_fbot + 1]], WP[cut[i_fbot:i_bbot + 1]], WP[cut[i_bbot:]][::-1]  # B: top->bottom
        a0, a1 = WP[sd['ftop']], WP[sd['btop']]
        tt = np.linspace(0, 1, R_ROWS + 1); ss = np.linspace(0, 1, M_COLS + 1)
        Ft, Bt = interp_curve(Fp, Fp, tt), interp_curve(Bp, Bp, tt)
        Hs = interp_curve(Hp, Hp, ss)
        As = a0[None] + ss[:, None] * (a1 - a0)[None]
        def coons(i, j, Fv, Bv, Av, Hv):
            t, u = tt[i], ss[j]
            return ((1 - u) * Fv[i] + u * Bv[i] + (1 - t) * Av[j] + t * Hv[j]
                    - ((1 - t) * (1 - u) * Av[0] + (1 - t) * u * Av[-1] + t * (1 - u) * Hv[0] + t * u * Hv[-1]))
        # boundary weights for each panel side
        for panel in ('sleeve', 'torso'):
            rule = sleeve_rule_w if panel == 'sleeve' else torso_rule_w
            apex_w = [sd['hinge']] * (M_COLS + 1)
            def wcurve(pts_ids, t):
                return interp_curve(WP[pts_ids], np.array([rule[v] if v in rule else newW[v] for v in pts_ids]), t)
            Fw = wcurve(cut[:i_fbot + 1], tt); Bw = wcurve(cut[i_bbot:][::-1], tt); Hw = wcurve(cut[i_fbot:i_bbot + 1], ss)
            Fw[0] = Bw[0] = sd['hinge']; Aw = np.array(apex_w)
            # UV islands: front half from the faces along the front crease, back half from the back crease
            side_faces = sd['sleeve'] if panel == 'sleeve' else ~sd['sleeve'] & seg['shell'][WT[:, 0]]
            def crease_island(path):
                pset = set(path)
                adj_f = [f for f in np.where(side_faces)[0] if len(set(WT[f]) & pset) >= 1 and abs(cen[f, 1] - 0.6) < 0.13]
                ids, c = np.unique(island[adj_f], return_counts=True)
                isl = ids[np.argmax(c)]
                return np.where(side_faces & (island == isl))[0]
            isl_front = crease_island(cut[:i_fbot + 1]); isl_back = crease_island(cut[i_bbot:])
            # grid of positions (rows top->bottom, cols front->back)
            grid = np.zeros((R_ROWS + 1, M_COLS + 1, 3))
            for i in range(R_ROWS + 1):
                chord = Bt[i] - Ft[i]; c = np.linalg.norm(chord)
                nh = np.array([-chord[2], 0, chord[0]]); nh /= max(np.linalg.norm(nh), 1e-9)
                mid = 0.5 * (Ft[i] + Bt[i]); _, axp = project_chain(mid, chain)
                if np.dot(axp - mid, nh) < 0: nh = -nh          # nh points from the jacket toward the arm
                amp = (min(SLEEVE_BULGE * c, SLEEVE_BULGE_MAX) * -1) if panel == 'sleeve' else min(TORSO_BULGE * c, TORSO_BULGE_MAX)
                taper = min(1, tt[i] / 0.12) * min(1, (1 - tt[i]) / 0.1)
                for j in range(M_COLS + 1):
                    grid[i, j] = coons(i, j, Ft, Bt, As, Hs) + nh * amp * np.sin(np.pi * ss[j]) * taper
            # vertices: boundary copies (own UVs) + interior grid; a UV seam runs down the middle
            half = M_COLS // 2
            TI = d['INDICES'].astype(np.int64)
            def uv_for(p, hs, i):
                t_i = tt[min(max(i, 0), R_ROWS)]
                path, isl = (Fp, isl_front) if hs == 'f' else (Bp, isl_back)
                anchor = interp_curve(path, path, np.array([t_i]))[0]
                return uv_on_island(2 * anchor - p, isl, P, TI, UV)   # mirror onto the outer surface
            def weight_at(i, j):
                w = coons(i, j, Fw, Bw, Aw, Hw); w = np.clip(w, 0, None); return w / w.sum()
            vid = {}
            def gv(i, j, hs=None):
                """Vertex for grid node (i, j); the middle column exists once per UV half."""
                hs = 'f' if j < half else 'b' if j > half else hs
                key = (i, j, hs)
                if key not in vid:
                    vid[key] = new_vertex(grid[i, j], np.zeros(3), uv_for(grid[i, j], hs, i), np.zeros(4), weight_at(i, j))
                return vid[key]
            tris = []
            # interior quads (rows 1..R-1, cols 1..M-1) and zipper to the true boundary
            for i in range(1, R_ROWS - 1):
                for j in range(1, M_COLS - 1):
                    hs = 'f' if j < half else 'b'
                    a, b, c, e = gv(i, j, hs), gv(i, j + 1, hs), gv(i + 1, j + 1, hs), gv(i + 1, j, hs)
                    tris += [(a, b, c), (a, c, e)]
            # ring (theta 0..4) and boundary (theta 0..4)
            ring = []
            for i in range(1, R_ROWS): ring.append(((i - 1) / (R_ROWS - 2), (i, 1)))
            for j in range(2, M_COLS): ring.append((1 + (j - 1) / (M_COLS - 2), (R_ROWS - 1, j)))
            for i in range(R_ROWS - 2, 0, -1): ring.append((2 + (R_ROWS - 1 - i) / (R_ROWS - 2), (i, M_COLS - 1)))
            for j in range(M_COLS - 2, 1, -1): ring.append((3 + (M_COLS - 1 - j) / (M_COLS - 2), (1, j)))
            bnd = []
            f_ids, h_ids, b_ids = cut[:i_fbot + 1], cut[i_fbot:i_bbot + 1], cut[i_bbot:]
            ft, ht, bt = arc_param(WP[f_ids]), arc_param(WP[h_ids]), arc_param(WP[b_ids])
            for k, v in enumerate(f_ids): bnd.append((ft[k], ('cut', v, 'f')))
            for k, v in enumerate(h_ids[1:], 1): bnd.append((1 + ht[k], ('cut', v, 'f' if ht[k] < .5 else 'b')))
            for k, v in enumerate(b_ids[1:], 1): bnd.append((2 + bt[k], ('cut', v, 'b')))
            for j in range(M_COLS - 1, 0, -1): bnd.append((3 + (M_COLS - j) / M_COLS, ('apex', j, 'f' if j <= half else 'b')))
            def ring_vid(node, halfside):
                return gv(node[0], node[1], halfside)
            def bnd_vid(node):
                kind, v, hs = node
                key = ('B', kind, v, hs)
                if key not in vid:
                    if kind == 'cut':
                        w = sd['hinge'] if v in (sd['ftop'], sd['btop']) else (sleeve_rule_w[v] if panel == 'sleeve' else torso_rule_w[v])
                        p = WP[v]
                        # tie the UV anchor row to the vertex height along its crease
                        i_est = int(round(np.interp(p[1], [WP[sd['fbot'], 1], sd['apex_y']], [R_ROWS, 0])))
                        uv = uv_for(p, hs, i_est)
                    else:
                        p = grid[0, v]; w = sd['hinge']; uv = uv_for(p, hs, 0)
                    vid[key] = new_vertex(p, np.zeros(3), uv, np.zeros(4), w)
                return vid[key]
            ia = ib = 0; na, nb = len(bnd), len(ring)
            while ia < na or ib < nb:
                ta = bnd[ia + 1][0] if ia + 1 < na else 4.0
                tb = ring[ib + 1][0] if ib + 1 < nb else 4.0
                a_cur = bnd_vid(bnd[ia % na][1]); b_cur_node = ring[ib % nb][1]
                hs_a = bnd[ia % na][1][2]
                if (ta <= tb and ia < na) or ib >= nb:
                    a_next = bnd_vid(bnd[(ia + 1) % na][1])
                    tris.append((a_cur, a_next, ring_vid(b_cur_node, hs_a))); ia += 1
                else:
                    b_next_node = ring[(ib + 1) % nb][1]
                    tris.append((a_cur, ring_vid(b_next_node, hs_a), ring_vid(b_cur_node, hs_a))); ib += 1
            fill_tris.append((pre, panel, tris, chain, s))
    # assemble arrays
    NA = len(add['P'])
    P2 = np.concatenate([P, np.array(add['P'])]).astype(np.float64)
    N2 = np.concatenate([NRM, np.array(add['N'])]).astype(np.float64)
    UV2 = np.concatenate([UV, np.array(add['UV'])]).astype(np.float64)
    TAN2 = np.concatenate([TAN, np.array(add['TAN'])]).astype(np.float64)
    W2 = np.concatenate([Wv, np.array(add['W'])])
    new_faces = []
    fill_vert = np.zeros(len(P2), bool); fill_vert[n0:] = True
    for pre, panel, tris, chain, s in fill_tris:
        tris = np.array(tris)
        # orient: sleeve panel faces away from the arm axis, jacket panel faces away from the body
        for k, (a, b, c) in enumerate(tris):
            nrm = np.cross(P2[b] - P2[a], P2[c] - P2[a]); cc = (P2[a] + P2[b] + P2[c]) / 3
            if panel == 'sleeve': _, ref = project_chain(cc, chain)
            else: ref = np.array([0, cc[1], cc[2]])
            want = cc - ref; want[1] = 0 if panel == 'torso' else want[1]
            if np.dot(nrm, want) < 0: tris[k] = (a, c, b)
        new_faces.append(tris)
    FT = np.concatenate(new_faces)
    # drop degenerate triangles
    area = np.linalg.norm(np.cross(P2[FT[:, 1]] - P2[FT[:, 0]], P2[FT[:, 2]] - P2[FT[:, 0]]), axis=1)
    FT = FT[area > 1e-10]
    # normals and tangents for the new panel vertices only
    fn = np.cross(P2[FT[:, 1]] - P2[FT[:, 0]], P2[FT[:, 2]] - P2[FT[:, 0]])
    acc = np.zeros_like(P2); [np.add.at(acc, FT[:, k], fn) for k in range(3)]
    N2[n0:] = acc[n0:] / np.maximum(np.linalg.norm(acc[n0:], axis=1, keepdims=True), 1e-12)
    e1, e2 = P2[FT[:, 1]] - P2[FT[:, 0]], P2[FT[:, 2]] - P2[FT[:, 0]]
    d1, d2 = UV2[FT[:, 1]] - UV2[FT[:, 0]], UV2[FT[:, 2]] - UV2[FT[:, 0]]
    r = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(r) < 1e-14, 1e-14, r)
    tv = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) / r[:, None]
    bv = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) / r[:, None]
    tacc = np.zeros_like(P2); bacc = np.zeros_like(P2)
    for k in range(3): np.add.at(tacc, FT[:, k], tv); np.add.at(bacc, FT[:, k], bv)
    for v in range(n0, len(P2)):
        n = N2[v]; t = tacc[v] - n * np.dot(n, tacc[v])
        if np.linalg.norm(t) < 1e-12:
            t = np.cross(n, [0, 1, 0]) if abs(n[1]) < .9 else np.cross(n, [1, 0, 0])
        t /= np.linalg.norm(t)
        TAN2[v] = [*t, 1.0 if np.dot(np.cross(n, t), bacc[v]) >= 0 else -1.0]
    # glTF convention matches the original file's texcoord orientation (V down); keep sign logic consistent
    joints, weights = normalize_top4(W2)
    out = dict(POSITION=P2, NORMAL=N2, TEXCOORD_0=UV2, TANGENT=TAN2, JOINTS_0=joints, WEIGHTS_0=weights,
               INDICES=np.concatenate([T, FT]))
    write_glb(dst, gltf, binary, out)
    report.update(vertices=int(len(P2)), added_vertices=int(NA), triangles=int(len(out['INDICES'])),
                  added_triangles=int(len(FT)), original_vertices=int(n0))
    if report_path: json.dump(report, open(report_path, 'w'), indent=1)
    print('BUILD_OK', json.dumps(report))


if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:]
    build(a[0], a[1], a[2] if len(a) > 2 else None)
