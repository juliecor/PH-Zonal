#!/usr/bin/env python3
"""
Trace the (already chroma-keyed) raster hazard tiles into clean VECTOR GeoJSON, so the
overlays render as crisp polygons at any zoom (no pixelation, no labels) — the
professional look. Areas only; fault LINES come from the existing GEM vector catalog.

  liquefaction  -> orange susceptible zones      -> public/hazard/liquefaction_vec.geojson
  tsunami       -> red/orange/cyan prone zones    -> public/hazard/tsunami_vec.geojson
  groundrupture -> magenta trenches               -> public/hazard/trenches_vec.geojson

Pipeline per layer: composite the L5 tile masks into one national grid -> rasterio
features.shapes -> shapely simplify + drop specks -> GeoJSON. Needs rasterio + shapely.
"""
import os, json, numpy as np
from PIL import Image
from rasterio import features
from rasterio.transform import from_bounds
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "hazard"))


def hue_sat(rgb):
    a = rgb.astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    dd = np.where(d == 0, 1, d)
    h = np.zeros_like(mx)
    i = (mx == r); h[i] = (((g - b) / dd) % 6)[i]
    i = (mx == g); h[i] = ((b - r) / dd + 2)[i]
    i = (mx == b); h[i] = ((r - g) / dd + 4)[i]
    h *= 60
    s = np.where(mx > 0, d / mx, 0)
    return h, s


def in_hue(h, ranges):
    m = np.zeros(h.shape, dtype=bool)
    for lo, hi in ranges:
        m |= (h >= lo) & (h <= hi)
    return m


def vectorize(layer, hue_ranges, out_name, res=0.004, min_area=8e-5, smin=0.30, simp=1.3):
    man = json.load(open(os.path.join(ROOT, layer + ".json"), encoding="utf-8"))
    bb = man["bbox"]; W, E, S, N = bb["west"], bb["east"], bb["south"], bb["north"]
    width = int((E - W) / res) + 1
    height = int((N - S) / res) + 1
    nat = np.zeros((height, width), dtype=np.uint8)

    for t in man["tiles"]:
        if t["lvl"] != 5:
            continue
        p = os.path.join(ROOT, layer, t["f"])
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGBA")
        a = np.asarray(im)
        h, s = hue_sat(a[..., :3])
        m = in_hue(h, hue_ranges) & (s >= smin) & (a[..., 3] > 0)
        if not m.any():
            continue
        c0 = max(0, int((t["w"] - W) / res)); c1 = min(width, int((t["e"] - W) / res))
        r0 = max(0, int((N - t["n"]) / res)); r1 = min(height, int((N - t["s"]) / res))
        if c1 <= c0 or r1 <= r0:
            continue
        mim = Image.fromarray((m * 255).astype(np.uint8)).resize((c1 - c0, r1 - r0), Image.NEAREST)
        sub = (np.asarray(mim) > 127).astype(np.uint8)
        nat[r0:r1, c0:c1] = np.maximum(nat[r0:r1, c0:c1], sub)

    transform = from_bounds(W, S, E, N, width, height)
    polys = []
    for geom, val in features.shapes(nat, mask=nat > 0, transform=transform, connectivity=8):
        g = shape(geom).buffer(0)
        if g.is_empty or g.area < min_area:
            continue
        polys.append(g)
    feats = []
    if polys:
        merged = unary_union(polys)
        geoms = list(merged.geoms) if merged.geom_type.startswith("Multi") else [merged]
        for g in geoms:
            g = g.simplify(res * simp, preserve_topology=True)
            if g.is_empty or g.area < min_area:
                continue
            # round coords to ~5dp to shrink the file
            feats.append({"type": "Feature", "properties": {}, "geometry": _round(mapping(g))})
    out = {"type": "FeatureCollection", "attribution": man.get("attribution", "PHIVOLCS / GeoRiskPH"), "features": feats}
    path = os.path.join(ROOT, out_name)
    json.dump(out, open(path, "w"), separators=(",", ":"))
    print(f"  {out_name}: {len(feats)} features, {os.path.getsize(path)//1024} KB")


def _round(geom, nd=5):
    def rc(c):
        return [round(c[0], nd), round(c[1], nd)]
    t = geom["type"]
    if t == "Polygon":
        geom["coordinates"] = [[rc(p) for p in ring] for ring in geom["coordinates"]]
    elif t == "MultiPolygon":
        geom["coordinates"] = [[[rc(p) for p in ring] for ring in poly] for poly in geom["coordinates"]]
    return geom


if __name__ == "__main__":
    # liquefaction: orange susceptible only (exclude cyan lakes ~190°)
    vectorize("liquefaction", [(15, 55)], "liquefaction_vec.geojson", min_area=6e-5)
    # tsunami: prone = red/orange (0-60) + cyan (160-210); exclude purple trenches
    vectorize("tsunami", [(0, 60), (160, 210)], "tsunami_vec.geojson", min_area=4e-5)
    # ground rupture trenches: magenta/purple ~270-320° (faults come from GEM vector)
    vectorize("groundrupture", [(265, 320)], "trenches_vec.geojson", min_area=2e-5, simp=1.0)
    print("done")
