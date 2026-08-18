#!/usr/bin/env python3
"""
Regenerate the COASTLINES data embedded in js/colourflood/geo.js.

Usage:
    python3 tools/process_coast.py path/to/land.geojson [output.js]

The input is a Natural Earth land GeoJSON, e.g. the 10m land polygons:
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson

It clips each polygon to a generous box around the site's geographic view,
simplifies it, and writes a JS array of coastline rings (lon/lat). Splice the
output into geo.js in place of the existing `var COASTLINES = [...]`.
"""

import json
import math
import sys

# The geographic window in view on the site.
LON_MIN, LON_MAX = -11.0, 9.0
LAT_MIN, LAT_MAX = 48.0, 59.5
MIDLAT = (LAT_MIN + LAT_MAX) / 2.0
COS = math.cos(math.radians(MIDLAT))

# Clip polygons to a generous box that comfortably surrounds the view, so that
# clipping "chords" (straight cuts across huge landmass polygons) land well
# outside the viewport and never show up in the rasterised maze.
CLIP_LON_MIN, CLIP_LON_MAX = -14.0, 12.0
CLIP_LAT_MIN, CLIP_LAT_MAX = 45.0, 62.0

# Planar units (1 unit ~= 1 degree of latitude ~ 93px at fitted scale).
TOL = 0.01


def proj(lon, lat):
    return (lon * COS, lat)


def unproj(x, y):
    return (x / COS, y)


def clip_ring_to_rect(ring, x0, y0, x1, y1):
    # Sutherland-Hodgman against each rect edge in turn (keeping the polygon
    # simple), which handles the huge continental polygons correctly.
    def clip_edge(poly, axis, keep_above, limit):
        out = []
        n = len(poly)
        for i in range(n):
            cur = poly[i]
            nxt = poly[(i + 1) % n]
            c_in = (cur[axis] >= limit) if keep_above else (cur[axis] <= limit)
            n_in = (nxt[axis] >= limit) if keep_above else (nxt[axis] <= limit)
            if c_in and n_in:
                out.append(nxt)
            elif c_in and not n_in:
                t = (limit - cur[axis]) / (nxt[axis] - cur[axis])
                out.append((cur[0] + t * (nxt[0] - cur[0]), cur[1] + t * (nxt[1] - cur[1])))
            elif not c_in and n_in:
                t = (limit - cur[axis]) / (nxt[axis] - cur[axis])
                out.append((cur[0] + t * (nxt[0] - cur[0]), cur[1] + t * (nxt[1] - cur[1])))
                out.append(nxt)
        return out

    poly = list(ring)
    poly = clip_edge(poly, 0, True, x0)   # keep x >= x0
    poly = clip_edge(poly, 0, False, x1)  # keep x <= x1
    poly = clip_edge(poly, 1, True, y0)   # keep y >= y0
    poly = clip_edge(poly, 1, False, y1)  # keep y <= y1
    return poly


def dp(points, eps):
    # Iterative Douglas-Peucker on an open polyline.
    if len(points) < 3:
        return points

    def perp_dist(p, a, b):
        ax, ay = a
        bx, by = b
        px, py = p
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

    stack = [(0, len(points) - 1)]
    keep = {0, len(points) - 1}
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        maxd = -1.0
        idx = -1
        for k in range(i + 1, j):
            d = perp_dist(points[k], points[i], points[j])
            if d > maxd:
                maxd = d
                idx = k
        if maxd > eps:
            keep.add(idx)
            stack.append((i, idx))
            stack.append((idx, j))
    return [points[i] for i in sorted(keep)]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "coastlines.js"

    with open(src) as f:
        data = json.load(f)

    rings_out = []
    for feat in data["features"]:
        geom = feat["geometry"]
        if geom is None:
            continue
        gtype = geom["type"]
        if gtype == "Polygon":
            polys = [geom["coordinates"]]
        elif gtype == "MultiPolygon":
            polys = geom["coordinates"]
        else:
            continue
        for poly in polys:
            for ring in poly:
                planar = [proj(p[0], p[1]) for p in ring]
                clipped = clip_ring_to_rect(planar, CLIP_LON_MIN * COS, CLIP_LAT_MIN,
                                            CLIP_LON_MAX * COS, CLIP_LAT_MAX)
                if len(clipped) < 3:
                    continue
                # Simplify the open chain (drop the closing duplicate for DP,
                # re-add after), then round back to lon/lat.
                is_closed = clipped[0] == clipped[-1] or (
                    abs(clipped[0][0] - clipped[-1][0]) < 1e-9
                    and abs(clipped[0][1] - clipped[-1][1]) < 1e-9)
                chain = clipped[:-1] if is_closed else clipped
                chain = dp(chain, TOL)
                if len(chain) < 3:
                    continue
                ring_final = chain + [chain[0]]
                lonlat = [unproj(x, y) for (x, y) in ring_final]
                rounded = [[round(lon, 4), round(lat, 4)] for (lon, lat) in lonlat]
                dedup = []
                for p in rounded:
                    if not dedup or dedup[-1] != p:
                        dedup.append(p)
                if len(dedup) > 3:
                    rings_out.append(dedup)

    rings_out.sort(key=lambda r: -len(r))
    total = sum(len(r) for r in rings_out)
    print("rings:", len(rings_out), "total points:", total)

    js = "// UK + Western Europe coastline rings (lon/lat), simplified from Natural Earth.\n"
    js += "// Used by the colourflood maze to shape the maze walls like the UK map.\n"
    js += "var COASTLINES = [\n"
    for r in rings_out:
        js += "  " + json.dumps(r, separators=(",", ":")) + ",\n"
    js = js.rstrip(",\n") + "\n];\n"

    with open(out, "w") as f:
        f.write(js)
    print("wrote", out)


if __name__ == "__main__":
    main()
