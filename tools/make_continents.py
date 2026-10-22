#!/usr/bin/env python3
"""Build data/continents.json (simplified land outlines per continent panel).

Input: a Natural Earth 50m land TopoJSON (public domain), passed as argv[1].
Output: data/continents.json. Run only when the map shapes need to change.
Chapter pins are NOT stored here; build.py projects them from data/chapters.json
using the box and scale saved for each continent.
"""
import json, math, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
W = 640  # panel width in SVG units

# id: (name, lon0, lon1, lat0, lat1)
BOXES = {
    "north-america": ("North America", -128.0, -64.0, 23.0, 52.0),
    "latin-america-caribbean": ("Latin America and Caribbean", -92.0, -32.0, -36.0, 24.0),
    "europe": ("Europe", -12.0, 32.0, 35.0, 60.0),
    "africa": ("Africa", -20.0, 52.0, -36.0, 38.0),
    "asia": ("Asia", 60.0, 150.0, 5.0, 55.0),
    "oceania": ("Oceania", 110.0, 180.0, -48.0, -8.0),
    # Chapters page world map (one equirectangular frame, wider canvas)
    "world": ("World", -170.0, 190.0, -56.0, 84.0, 1200),
}

def decode(topo):
    sx, sy = topo["transform"]["scale"]; tx, ty = topo["transform"]["translate"]
    arcs = []
    for a in topo["arcs"]:
        x = y = 0; pts = []
        for dx, dy in a:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    return arcs

def ring(arcs, idx):
    out = []
    for i in idx:
        pts = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(pts if not out else pts[1:])
    return out

def clip(poly, lon0, lon1, lat0, lat1):
    def edge(pts, inside, inter):
        res = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside(b):
                if not inside(a): res.append(inter(a, b))
                res.append(b)
            elif inside(a): res.append(inter(a, b))
        return res
    def ix(v):
        return lambda a, b: (v, a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]))
    def iy(v):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]), v)
    for inside, inter in (
        (lambda p: p[0] >= lon0, ix(lon0)), (lambda p: p[0] <= lon1, ix(lon1)),
        (lambda p: p[1] >= lat0, iy(lat0)), (lambda p: p[1] <= lat1, iy(lat1))):
        if not poly: return []
        poly = edge(poly, inside, inter)
    return poly

def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dmax = 0; k = 0
    dx, dy = b[0] - a[0], b[1] - a[1]; n = math.hypot(dx, dy) or 1e-9
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / n
        if d > dmax: dmax, k = d, i
    if dmax > eps: return dp(pts[:k + 1], eps)[:-1] + dp(pts[k:], eps)
    return [a, b]

def simp_ring(c, eps):
    far = max(range(len(c)), key=lambda i: (c[i][0] - c[0][0]) ** 2 + (c[i][1] - c[0][1]) ** 2)
    a = dp(c[:far + 1], eps); b = dp(c[far:] + [c[0]], eps)
    return a[:-1] + b[:-1]

def area(p):
    return abs(sum(p[i - 1][0] * p[i][1] - p[i][0] * p[i - 1][1] for i in range(len(p)))) / 2

def main(src):
    topo = json.load(open(src)); arcs = decode(topo)
    rings = []
    for g in topo["objects"]["land"]["geometries"]:
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        for poly in polys:
            rings.append(ring(arcs, poly[0]))  # outer ring only; lakes ignored
    out = {}
    for cid, (name, lon0, lon1, lat0, lat1, *wide) in BOXES.items():
        Wc = wide[0] if wide else W
        k = Wc / ((lon1 - lon0) * math.cos(math.radians((lat0 + lat1) / 2)))
        cx = math.cos(math.radians((lat0 + lat1) / 2))
        H = round((lat1 - lat0) * k)
        d = []
        for r in rings:
            if wide and any(abs(r[i][0] - r[i - 1][0]) > 180 for i in range(1, len(r))):
                # world frame: a ring that crosses 180 (Russia, Fiji) is unwrapped east so it never jumps across the map
                r = [(x + 360 if x < -100 else x, y) for x, y in r]
            c = clip(r, lon0, lon1, lat0, lat1)
            if len(c) < 3 or area(c) < 0.6: continue
            c = simp_ring(c, 0.12)
            if len(c) < 3: continue
            pts = [((x - lon0) * cx * k, (lat1 - y) * k) for x, y in c]
            d.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z")
        out[cid] = {"name": name, "box": [lon0, lon1, lat0, lat1], "k": k, "cx": cx,
                    "width": Wc, "height": H, "path": "".join(d)}
    (ROOT / "data" / "continents.json").write_text(json.dumps(out, separators=(",", ":")))
    print({c: len(v["path"]) for c, v in out.items()})

if __name__ == "__main__":
    main(sys.argv[1])
