#!/usr/bin/env python3
"""Drawing generator for the Quest 3 headset and Touch Plus controllers in the hero.

NOT part of the site, and the site still has no build step. This script only produces
the four inline <svg> elements inside <div class="q3"> in index.html.

Needs Python 3 with NumPy and Shapely:  pip install numpy shapely

    python3 tools/quest3.py            # prints the markup to paste into index.html
    python3 tools/quest3.py --sheet F  # also writes a stand-alone preview page to F

How it works: a small 3D model (millimetres) is projected orthographically to 2D. Parts
are painted back to front with opaque fills, which removes hidden lines. Silhouettes are
unions of projected shapes, then fitted with cubic Beziers so curves stay smooth.
Colours and line weights are NOT in here: they come from the `.q` rules in style.css.
"""
import math
import sys
import numpy as np
from shapely.geometry import Polygon, Point, MultiPoint, LineString
from shapely.ops import unary_union

K = 2.0  # view box units per millimetre


# ---------- projection ----------
def rot(yaw, pitch, roll=0):
    a, b, c = map(math.radians, (yaw, pitch, roll))
    Ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(b), -math.sin(b)], [0, math.sin(b), math.cos(b)]])
    Rz = np.array([[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]])
    return Rz @ Rx @ Ry


class View:
    def __init__(s, R, k=K):
        s.R, s.k = R, k
        s.cam = R[2]  # direction toward the viewer, in model space

    def p(s, pts):
        q = (s.R @ np.asarray(pts, float).reshape(-1, 3).T).T
        return np.c_[q[:, 0] * s.k, -q[:, 1] * s.k]

    def depth(s, pt):
        return float(s.R[2] @ np.asarray(pt, float))


# ---------- Bezier fitting (Schneider) ----------
def _unit(v):
    n = math.hypot(*v)
    return v / n if n else v


def _bez(c, t):
    t = np.asarray(t)[:, None]
    return (1 - t) ** 3 * c[0] + 3 * (1 - t) ** 2 * t * c[1] + 3 * (1 - t) * t ** 2 * c[2] + t ** 3 * c[3]


def _gen(P, u, t1, t2):
    b0, b1, b2, b3 = (1 - u) ** 3, 3 * (1 - u) ** 2 * u, 3 * (1 - u) * u ** 2, u ** 3
    A1, A2 = b1[:, None] * t1, b2[:, None] * t2
    T = P - (b0 + b1)[:, None] * P[0] - (b2 + b3)[:, None] * P[-1]
    c11, c12, c22 = (A1 * A1).sum(), (A1 * A2).sum(), (A2 * A2).sum()
    x1, x2 = (A1 * T).sum(), (A2 * T).sum()
    det = c11 * c22 - c12 * c12
    seg = math.hypot(*(P[-1] - P[0]))
    a1 = a2 = 0
    if abs(det) > 1e-12:
        a1, a2 = (x1 * c22 - x2 * c12) / det, (c11 * x2 - c12 * x1) / det
    if a1 < seg * 1e-3 or a2 < seg * 1e-3:
        a1 = a2 = seg / 3
    return np.array([P[0], P[0] + a1 * t1, P[-1] + a2 * t2, P[-1]])


def _fit(P, t1, t2, tol):
    if len(P) == 2:
        d = math.hypot(*(P[1] - P[0])) / 3
        return [np.array([P[0], P[0] + d * t1, P[1] + d * t2, P[1]])]
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
    u = d / d[-1]
    for _ in range(5):
        c = _gen(P, u, t1, t2)
        e = ((_bez(c, u) - P) ** 2).sum(1)
        i = int(e.argmax())
        if e[i] < tol * tol:
            return [c]
        # Newton step on the parameters
        q = _bez(c, u) - P
        d1 = 3 * ((1 - u) ** 2)[:, None] * (c[1] - c[0]) + 6 * ((1 - u) * u)[:, None] * (c[2] - c[1]) + 3 * (u ** 2)[:, None] * (c[3] - c[2])
        d2 = 6 * (1 - u)[:, None] * (c[2] - 2 * c[1] + c[0]) + 6 * u[:, None] * (c[3] - 2 * c[2] + c[1])
        den = (d1 * d1).sum(1) + (q * d2).sum(1)
        u = np.clip(u - np.where(abs(den) > 1e-12, (q * d1).sum(1) / np.where(den == 0, 1, den), 0), 0, 1)
        u[0], u[-1] = 0, 1
        u = np.maximum.accumulate(u)
    i = min(max(i, 1), len(P) - 2)
    tc = _unit(P[i - 1] - P[i + 1])
    return _fit(P[:i + 1], t1, tc, tol) + _fit(P[i:], -tc, t2, tol)


def _tan(P, i, step, closed):
    """Tangent at P[i] looking `step` (+1 forward, -1 back), over about one unit of arc."""
    n, j, acc = len(P), i, 0.0
    while acc < 1.0:
        j2 = j + step
        if closed:
            j2 %= n
        elif j2 < 0 or j2 >= n:
            break
        acc += math.hypot(*(P[j2] - P[j]))
        j = j2
        if j == i:
            break
    return _unit(P[j] - P[i])


def _num(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    if s in ('-0', ''):
        s = '0'
    if s.startswith('0.'):
        s = s[1:]
    elif s.startswith('-0.'):
        s = '-' + s[2:]
    return s


def _join(vals):
    out = ''
    for v in vals:
        s = _num(v)
        out += s if (not out or s[0] == '-') else ' ' + s
    return out


def path(P, closed=True, tol=0.3, corner=24):
    """Fit a dense polyline with lines and cubic Beziers. Returns the `d` string."""
    P = np.asarray(P, float)
    keep = np.r_[True, np.hypot(*np.diff(P, axis=0).T) > 1e-6]
    P = P[keep]
    if closed and math.hypot(*(P[0] - P[-1])) < 1e-6:
        P = P[:-1]
    n = len(P)
    # corners: where the direction turns sharply
    cs = []
    rng = range(n) if closed else range(1, n - 1)
    for i in rng:
        a, b = _tan(P, i, -1, closed), _tan(P, i, 1, closed)
        if math.degrees(math.acos(max(-1, min(1, float(-a @ b))))) > corner:
            cs.append(i)
    # keep only the sharpest vertex of each cluster
    cl = []
    for i in cs:
        if cl and math.hypot(*(P[i] - P[cl[-1]])) < 1.2:
            continue
        cl.append(i)
    cs = cl
    corners = set(cs)
    if closed:
        if not cs:
            cs = [0, n // 3, 2 * n // 3]
        elif len(cs) == 1:
            cs = sorted([cs[0], (cs[0] + n // 2) % n])
        first = cs[0]
        P = np.roll(P, -first, axis=0)
        corners = set((c - first) % n for c in corners)
        cs = [c - first for c in cs] + [n]
        if 0 in corners:
            corners.add(n)
        ring = P
        P = np.vstack([P, P[0]])
    else:
        cs = [0] + cs + [n - 1]
        corners |= {0, n - 1}
        ring = None

    def tangent(i, step):
        if i in corners:
            return _tan(P, i, step, False)
        t = _unit(_tan(ring, i % n, 1, True) - _tan(ring, i % n, -1, True))
        return t * step
    runs = list(zip(cs, cs[1:]))
    cur = np.round(P[0], 1)
    d = 'M' + _join(cur)
    for a, b in runs:
        Q = P[a:b + 1]
        t1, t2 = tangent(a, 1), tangent(b, -1)
        # straight run?
        chord = Q[-1] - Q[0]
        L = math.hypot(*chord) or 1e-9
        off = np.abs(chord[0] * (Q[:, 1] - Q[0, 1]) - chord[1] * (Q[:, 0] - Q[0, 0])) / L
        if off.max() < 0.12:
            segs = [None]
        else:
            segs = _fit(Q, t1, t2, tol)
        for c in segs:
            if c is None:
                e = np.round(Q[-1], 1)
                d += 'l' + _join(e - cur)
                cur = e
                continue
            ch = c[3] - c[0]
            L = math.hypot(*ch) or 1e-9
            dev = max(abs(ch[0] * (c[j][1] - c[0][1]) - ch[1] * (c[j][0] - c[0][0])) / L for j in (1, 2))
            e = np.round(c[3], 1)
            if dev < 0.1:
                d += 'l' + _join(e - cur)
            else:
                d += 'c' + _join(np.r_[np.round(c[1], 1) - cur, np.round(c[2], 1) - cur, e - cur])
            cur = e
    return d + ('z' if closed else '')


# ---------- drawing helpers ----------
class Layer:
    def __init__(s, cls):
        s.cls, s.items, s.pts = cls, [], []

    def poly(s, geom, cls, closed=True, extra=''):
        """geom: shapely polygon, or an array of points."""
        if hasattr(geom, 'exterior'):
            P = np.array(geom.exterior.coords)
        else:
            P = np.asarray(geom, float)
        s.pts += list(P)
        s.items.append((cls, '<path class="%s"%s d="%s"/>' % (cls, extra, path(P, closed))))

    def ellipse(s, V, c, u, v, r, cls):
        p0, pu, pv = V.p([c, np.asarray(c) + u, np.asarray(c) + v])
        M = np.c_[pu - p0, pv - p0] * r
        U, S, _ = np.linalg.svd(M)
        ang = math.degrees(math.atan2(U[1, 0], U[0, 0])) % 180
        if ang > 90:
            ang -= 180
        for t in np.linspace(0, 2 * math.pi, 24):
            s.pts.append(p0 + M @ [math.cos(t), math.sin(t)])
        if abs(S[0] - S[1]) < 0.06:
            s.items.append((cls, '<circle class="%s" cx="%s" cy="%s" r="%s"/>' % (cls, _num(p0[0]), _num(p0[1]), _num(S[0]))))
        else:
            s.items.append((cls, '<ellipse class="%s" cx="%s" cy="%s" rx="%s" ry="%s" transform="rotate(%d %s %s)"/>' % (
                cls, _num(p0[0]), _num(p0[1]), _num(S[0]), _num(S[1]), round(ang), _num(p0[0]), _num(p0[1]))))

    def inner_edge(s, loop, outline, cls, gap, cover=None):
        """Stroke a closed loop only where it is an inner line: clear of the silhouette
        (so the two never run side by side) and not hidden under `cover`."""
        line = LineString(np.vstack([loop, loop[:1]])).difference(outline.exterior.buffer(gap))
        if cover is not None:
            line = line.difference(cover)
        parts = list(line.geoms) if hasattr(line, 'geoms') else [line]
        # a loop cut once comes back as two pieces that share the start point: join them
        if len(parts) > 1 and np.allclose(parts[0].coords[0], parts[-1].coords[-1]):
            parts = [LineString(list(parts[-1].coords) + list(parts[0].coords)[1:])] + parts[1:-1]
        ring = outline.exterior
        for part in parts:
            if part.length <= 6:
                continue
            C = np.array(part.coords)
            # run each loose end on along its own direction until it meets the silhouette
            for end in (0, -1):
                i0, i1 = (0, min(3, len(C) - 1)) if end == 0 else (len(C) - 1, max(0, len(C) - 4))
                t = _unit(C[i0] - C[i1])
                hit = LineString([C[i0], C[i0] + 40 * t]).intersection(ring)
                if hit.is_empty:
                    continue
                pts = [g for g in getattr(hit, 'geoms', [hit]) if g.geom_type == 'Point']
                if not pts:
                    continue
                q = min(pts, key=lambda g: g.distance(Point(*C[i0])))
                q = np.array([q.x, q.y])
                C = np.vstack([q, C]) if end == 0 else np.vstack([C, q])
            s.poly(C, cls, closed=False)

    def glow(s):
        """A wide, faint copy of every Outline path, underneath everything."""
        g = [('n w', i.replace('class="%s"' % c, 'class="n w"')) for c, i in s.items if c == 'f o']
        s.items = g + s.items

    def box(s, pad=6):
        A = np.array(s.pts)
        x0, y0 = np.floor(A.min(0) - pad)
        x1, y1 = np.ceil(A.max(0) + pad)
        return x0, y0, x1 - x0, y1 - y0

    def inner(s):
        return '\n'.join(i for _, i in s.items)


def rrect(w, h, r, z, cx=0, cy=0, n=20):
    pts = []
    for sx, sy, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + sx * (w / 2 - r) + r * math.cos(a), cy + sy * (h / 2 - r) + r * math.sin(a), z))
    return pts


def circ3(c, u, v, r, n=72):
    c, u, v = map(np.asarray, (c, u, v))
    return [tuple(c + r * math.cos(2 * math.pi * i / n) * u + r * math.sin(2 * math.pi * i / n) * v) for i in range(n)]


def hull(V, *loops):
    pts = np.vstack([V.p(o) for o in loops])
    return MultiPoint(pts).convex_hull


def smooth(balls, step=2.0):
    """Resample a list of (centre, radius) finely and round off the joints."""
    C = np.array([np.r_[c, r] for c, r in balls], float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(C[:, :3], axis=0), axis=1))]
    t = np.linspace(0, d[-1], max(8, int(d[-1] / step)))
    F = np.array([np.interp(t, d, C[:, j]) for j in range(4)]).T
    for _ in range(6):
        F[1:-1] = (F[:-2] + 2 * F[1:-1] + F[2:]) / 4
    return [(f[:3], f[3]) for f in F]


def chain(V, balls):
    """Silhouette of spheres strung along a spine: the union of each neighbouring pair's hull."""
    discs = [Point(*V.p([c])[0]).buffer(r * V.k, 32) for c, r in balls]
    return unary_union([unary_union([a, b]).convex_hull for a, b in zip(discs, discs[1:])])


def ribbon(V, top, bot, thick=0.0):
    t, b = V.p(top), V.p(bot)
    quads = []
    for i in range(len(t) - 1):
        q = Polygon([t[i], t[i + 1], b[i + 1], b[i]])
        if q.is_valid and q.area > 1e-6:
            quads.append(q)
        else:
            quads.append(MultiPoint([t[i], t[i + 1], b[i + 1], b[i]]).convex_hull)
    g = unary_union(quads)
    if thick:
        g = g.buffer(thick * V.k, 16)
    return g


# ---------- headset ----------
def headset(V):
    strap, body = Layer('q-strap'), Layer('q-body')
    X, Y, Z = np.eye(3)

    def band(t0, t1, n=48):
        top, bot = [], []
        for i in range(n + 1):
            t = math.radians(t0 + (t1 - t0) * i / n)
            w = max(0.0, math.sin(t)) ** 2  # 0 at the arms, 1 at the back of the head
            x, z = 97 * math.cos(t), -122 - 100 * math.sin(t)
            top.append((x, 19 + 14 * w, z))
            bot.append((x, -7 - 10 * w, z))
        return top, bot

    # The back band shows its outer face only for the first few degrees past the near arm.
    # Find the angle where it turns edge-on to the viewer.
    fold = math.degrees(math.atan2(100 * V.cam[0], 97 * V.cam[2]))
    far = ribbon(V, *band(fold, 180))
    strap.poly(far, 'f s')
    # top strap: visor to the back of the band
    tl, tr = [], []
    for i in range(49):
        u = 0.965 * i / 48
        z = -6 - 214 * u
        y = 47 + 37 * math.sin(math.pi * u ** 0.85) - 14 * u
        tl.append((-11, y, z))
        tr.append((11, y, z))
    strap.poly(ribbon(V, tl, tr, 1.6), 'f s')
    # near piece: straight run under the side arm, then round to the fold
    top, bot = band(0, fold, 16)
    top = [(97, 19, -84)] + top
    bot = [(97, -7, -84)] + bot
    strap.poly(ribbon(V, top, bot), 'f s')

    def arm(x):
        o = [(x, y, z) for (z, y, _) in rrect(122, 28, 12, 0, cx=-66, cy=6)]
        body.poly(V.p(o), 'f s')

    arm(-95)
    body.poly(hull(V, rrect(160, 84, 34, -64), rrect(170, 90, 34, -24)), 'd s')  # face pad
    shell = hull(V, rrect(184, 97, 31, -26), rrect(184, 97, 31, 20), rrect(176, 89, 27, 30))
    plate = V.p(rrect(176, 89, 27, 30))
    body.poly(shell, 'f o')
    body.inner_edge(V.p(rrect(184, 97, 31, 20)), shell, 'n t', 5, Polygon(plate).buffer(2))  # shell edge, where the chamfer starts
    body.poly(plate, 'f2 k')  # front plate
    body.inner_edge(plate, shell, 'n s', 5)
    body.poly(shell, 'n o')  # the plate fill covers half the outline: stroke it again
    # the one lighting cue: a highlight along the top front edge
    hi = [p for p in rrect(184, 97, 31, 2, n=30) if p[1] > 0 and abs(p[0]) < 68]
    hi.sort(key=lambda p: p[0])
    body.poly(V.p(hi), 'n h', closed=False)
    arm(95)
    body.ellipse(V, (95, 6, -22), Y, Z, 6, 'n t')  # arm pivot
    body.poly(V.p([(95, -2, -62), (95, -2, -104)]), 'n t', closed=False)  # speaker slot
    for k, cx in enumerate((-47, 0, 47)):  # three sensor pills
        body.poly(V.p(rrect(15.5, 39, 7.7, 30.3, cx=cx, cy=5, n=16)), 'g a q-p%d' % (k + 1))
        for dy, r in ([(8.5, 4.6), (-8.5, 4.6)] if cx else [(7.5, 3.8), (-8.5, 2.2)]):
            body.ellipse(V, (cx, 5 + dy, 30.4), X, Y, r, 'n l')
    for cx in (-69, 69):  # lower tracking cameras
        body.ellipse(V, (cx, -27, 30.3), X, Y, 4.2, 'g l')
    body.glow()
    return strap, body


# ---------- controller ----------
def controller(V, hand, grip_az=None):
    """hand: +1 right, -1 left. Plate centre at the origin, n the plate normal,
    u toward the outer side of the hand, v away from the wearer."""
    g = Layer('q-c')
    n = np.array([0, 1, 0.0])
    u = np.array([1, 0, 0.0]) * hand
    v = np.array([0, 0, -1.0])

    def at(a, b, h=0):
        return a * u + b * v + h * n

    def stack(c, rings):
        return hull(V, *[circ3(c + h * n, u, v, r) for r, h in rings])

    # handle: leans back from the plate normal, with a waist and a rounded base
    lean = math.radians(17)
    d = -n * math.cos(lean) - v * math.sin(lean)
    top = at(0, -4, -15)
    prof = [(0, 21.5), (10, 20.6), (22, 18.6), (34, 17.2), (46, 17.0), (58, 17.8), (68, 18.3), (76, 17.6), (83, 15.8), (87, 13.5)]
    spine = [(top + s * d, r) for s, r in prof]

    def radius(s):
        return float(np.interp(s, [p[0] for p in prof], [p[1] for p in prof]))

    # trigger: a paddle on the far side of the head, under the front edge of the plate
    trig = chain(V, smooth([(at(0, 22, -11), 11), (at(0, 32, -14), 10.5), (at(0, 38.5, -23), 9), (at(0, 37.5, -33), 7.6), (at(0, 31, -40), 6.4)]))
    g.poly(trig, 'f s')
    g.poly(chain(V, smooth(spine)), 'f o')
    # grip button: a pill lying on the surface of the handle
    if grip_az is not None:
        a = _unit3(np.cross(d, u))
        b = np.cross(d, a)
        if grip_az == 'auto':
            # the most forward-facing angle that still faces the viewer well
            best = max((az for az in range(360) if (math.cos(math.radians(az)) * a + math.sin(math.radians(az)) * b) @ V.cam > 0.72),
                       key=lambda az: (math.cos(math.radians(az)) * a + math.sin(math.radians(az)) * b) @ v)
            grip_az = best
        pts = []
        for s, az in pill_outline(31, 67, math.radians(grip_az - 15), math.radians(grip_az + 15), 5.5):
            r = radius(s) + 0.4
            pts.append(top + s * d + r * (math.cos(az) * a + math.sin(az) * b))
        pill = Polygon(V.p(pts)).buffer(0)
        g.poly(pill, 'd s')
    g.poly(stack(at(0, 0), ((27.5, 0), (29.6, -2.5), (31, -6), (31.5, -10), (31, -14), (29.3, -18.5), (26, -23), (21.5, -26.5))), 'f o')
    g.ellipse(V, at(0, 0), u, v, 27.5, 'f2 s')  # face plate
    g.ellipse(V, at(-4, -16), u, v, 3.4, 'n t')  # Meta / Menu button, flush
    sx, sy = -7, 7
    g.ellipse(V, at(sx, sy), u, v, 11, 'n t')  # stick well
    g.poly(stack(at(sx, sy), ((9.2, 3.5), (9.2, 9))), 'd s')  # cap
    g.ellipse(V, at(sx, sy, 9), u, v, 5.6, 'n t')
    btns = [((12.5, -6), 'q-a'), ((16.5, 8.5), '')]  # A then B (right), X then Y (left)
    btns.sort(key=lambda t: V.depth(at(*t[0])))
    for (a_, b_), cls in btns:
        g.poly(stack(at(a_, b_), ((5.4, 0), (5.4, 1.8))), ('d s ' + cls).strip())
    g.glow()
    return g


def _unit3(v):
    return v / np.linalg.norm(v)


def pill_outline(s0, s1, a0, a1, rs):
    """A rounded rectangle in (distance along the handle, angle round it)."""
    out = []
    ra = (a1 - a0) / 2
    for i in range(33):
        t = math.pi * i / 32
        out.append((s0 + rs - rs * math.sin(t), (a0 + a1) / 2 - ra * math.cos(t)))
    for i in range(33):
        t = math.pi * i / 32
        out.append((s1 - rs + rs * math.sin(t), (a0 + a1) / 2 + ra * math.cos(t)))
    return out


# ---------- output ----------
POSES = {
    'hmd': rot(-36, 15, -2),
    'cl': rot(62, 44, 14),
    'cr': rot(-24, 46, -13),
}


def build():
    strap, body = headset(View(POSES['hmd']))
    # strap and body are separate layers with the same view box, so they overlay exactly
    both = Layer('')
    both.pts = strap.pts + body.pts
    hb = both.box()
    cl = controller(View(POSES['cl']), -1, grip_az=GRIP['cl'])
    cr = controller(View(POSES['cr']), 1, grip_az=GRIP['cr'])
    return [('q-st', hb, strap), ('q-hmd', hb, body), ('q-cl', cl.box(), cl), ('q-cr', cr.box(), cr)]


GRIP = {'cl': 'auto', 'cr': 'auto'}


def markup(layers):
    out = []
    for cls, (x, y, w, h), layer in layers:
        out.append('<svg class="q %s" viewBox="%d %d %d %d" fill="none" stroke="currentColor" focusable="false">\n%s\n</svg>' % (
            cls, x, y, w, h, layer.inner()))
    return '\n'.join(out)


if __name__ == '__main__':
    layers = build()
    m = markup(layers)
    if '--sheet' in sys.argv:
        open(sys.argv[sys.argv.index('--sheet') + 1], 'w').write(m)
    else:
        print(m)
    print('%d bytes; view boxes: %s' % (len(m), ', '.join('%s %dx%d' % (c, b[2], b[3]) for c, b, _ in layers)), file=sys.stderr)
