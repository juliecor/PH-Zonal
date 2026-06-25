#!/usr/bin/env python3
"""
Convert PHIVOLCS hazard KMZ files -> compact GeoJSON for the map overlays.

KMZ is just a ZIP containing a KML (XML). Pure stdlib — no pip installs.

Usage:
  python kmz_to_geojson.py                 # convert every .kmz in ./raw -> ./<name>.geojson
  python kmz_to_geojson.py file.kmz out.geojson
  python kmz_to_geojson.py --inspect file.kmz   # print structure only (no output file)

For each .kmz it prints a diagnostic summary (feature count, geometry types, the
property keys + the distinct values of likely "susceptibility level" fields) so we
can map colors before wiring the layer in.
"""
import sys, os, json, zipfile, xml.etree.ElementTree as ET
from collections import Counter, defaultdict

KML_NS = "{http://www.opengis.net/kml/2.2}"
ROUND = 5  # ~1.1 m — plenty for hazard polygons, shrinks the file a lot


def tag(e):  # strip namespace
    return e.tag.split("}")[-1]


def read_kml_from_kmz(path):
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".kml")]
        if not names:
            raise SystemExit(f"No .kml inside {path}")
        # the main doc is usually doc.kml or the largest kml
        names.sort(key=lambda n: (0 if n.lower().endswith("doc.kml") else 1, -z.getinfo(n).file_size))
        with z.open(names[0]) as f:
            return f.read()


def parse_coords(text):
    pts = []
    for tok in text.replace("\n", " ").split():
        parts = tok.split(",")
        if len(parts) >= 2:
            try:
                lon = round(float(parts[0]), ROUND)
                lat = round(float(parts[1]), ROUND)
                pts.append([lon, lat])
            except ValueError:
                pass
    return pts


def dedupe(seq):  # drop consecutive duplicate points (rounding can create them)
    out = []
    for p in seq:
        if not out or out[-1] != p:
            out.append(p)
    return out


def geom_from(el):
    """Return a GeoJSON geometry (or None) for a Point/LineString/Polygon/MultiGeometry."""
    t = tag(el)
    if t == "Point":
        c = el.find(f"{KML_NS}coordinates")
        pts = parse_coords(c.text) if c is not None and c.text else []
        return {"type": "Point", "coordinates": pts[0]} if pts else None
    if t == "LineString":
        c = el.find(f"{KML_NS}coordinates")
        pts = dedupe(parse_coords(c.text)) if c is not None and c.text else []
        return {"type": "LineString", "coordinates": pts} if len(pts) >= 2 else None
    if t == "Polygon":
        rings = []
        outer = el.find(f"{KML_NS}outerBoundaryIs/{KML_NS}LinearRing/{KML_NS}coordinates")
        if outer is not None and outer.text:
            r = dedupe(parse_coords(outer.text))
            if len(r) >= 4:
                rings.append(r)
        for inner in el.findall(f"{KML_NS}innerBoundaryIs/{KML_NS}LinearRing/{KML_NS}coordinates"):
            if inner.text:
                r = dedupe(parse_coords(inner.text))
                if len(r) >= 4:
                    rings.append(r)
        return {"type": "Polygon", "coordinates": rings} if rings else None
    if t == "MultiGeometry":
        geoms = [g for g in (geom_from(ch) for ch in el) if g]
        if not geoms:
            return None
        # collapse to Multi* when homogeneous, else GeometryCollection
        types = {g["type"] for g in geoms}
        if types == {"Polygon"}:
            return {"type": "MultiPolygon", "coordinates": [g["coordinates"] for g in geoms]}
        if types == {"LineString"}:
            return {"type": "MultiLineString", "coordinates": [g["coordinates"] for g in geoms]}
        if types == {"Point"}:
            return {"type": "MultiPoint", "coordinates": [g["coordinates"] for g in geoms]}
        return {"type": "GeometryCollection", "geometries": geoms}
    return None


def first_geom(placemark):
    for child in placemark:
        if tag(child) in ("Point", "LineString", "Polygon", "MultiGeometry"):
            g = geom_from(child)
            if g:
                return g
    return None


def props_from(placemark, folder):
    props = {}
    if folder:
        props["folder"] = folder
    name = placemark.find(f"{KML_NS}name")
    if name is not None and name.text:
        props["name"] = name.text.strip()
    style = placemark.find(f"{KML_NS}styleUrl")
    if style is not None and style.text:
        props["styleUrl"] = style.text.strip().lstrip("#")
    # ExtendedData / SchemaData SimpleData
    for sd in placemark.iter():
        if tag(sd) == "SimpleData" and sd.get("name") and sd.text:
            props[sd.get("name")] = sd.text.strip()
        if tag(sd) == "Data" and sd.get("name"):
            v = sd.find(f"{KML_NS}value")
            if v is not None and v.text:
                props[sd.get("name")] = v.text.strip()
    return props


def walk(el, folder, out):
    """Recursively collect Placemarks, tracking the enclosing Folder/Document name."""
    cur = folder
    if tag(el) in ("Folder", "Document"):
        nm = el.find(f"{KML_NS}name")
        if nm is not None and nm.text:
            cur = nm.text.strip()
    for child in el:
        if tag(child) == "Placemark":
            g = first_geom(child)
            if g:
                out.append({"type": "Feature", "geometry": g, "properties": props_from(child, cur)})
        elif tag(child) in ("Folder", "Document"):
            walk(child, cur, out)


def convert(kmz_path):
    root = ET.fromstring(read_kml_from_kmz(kmz_path))
    feats = []
    walk(root, "", feats)
    return {"type": "FeatureCollection", "features": feats}


def diagnostics(fc, label):
    feats = fc["features"]
    gtypes = Counter(f["geometry"]["type"] for f in feats)
    keys = Counter()
    distinct = defaultdict(set)
    for f in feats:
        for k, v in f["properties"].items():
            keys[k] += 1
            if k in ("folder", "styleUrl", "name", "DESCRIPTIO", "Susceptibi", "SUSC", "LEVEL", "HAZ", "Hazard", "GRIDCODE"):
                distinct[k].add(str(v)[:40])
    print(f"\n=== {label} ===")
    print(f"  features: {len(feats)}")
    print(f"  geometry: {dict(gtypes)}")
    print(f"  property keys: {dict(keys)}")
    for k, vals in distinct.items():
        sv = sorted(vals)
        print(f"  distinct[{k}] ({len(sv)}): {sv[:25]}")


def main():
    args = sys.argv[1:]
    inspect = "--inspect" in args
    args = [a for a in args if a != "--inspect"]
    here = os.path.dirname(os.path.abspath(__file__))

    if args:
        kmz = args[0]
        fc = convert(kmz)
        diagnostics(fc, os.path.basename(kmz))
        if not inspect:
            out = args[1] if len(args) > 1 else os.path.splitext(kmz)[0] + ".geojson"
            with open(out, "w", encoding="utf-8") as f:
                json.dump(fc, f, separators=(",", ":"))
            print(f"  -> wrote {out} ({os.path.getsize(out)//1024} KB)")
        return

    raw = os.path.join(here, "raw")
    if not os.path.isdir(raw):
        os.makedirs(raw)
        print(f"Created {raw} — drop the PHIVOLCS .kmz files here, then re-run.")
        return
    kmzs = [n for n in os.listdir(raw) if n.lower().endswith(".kmz")]
    if not kmzs:
        print(f"No .kmz files in {raw} yet. Drop them there and re-run.")
        return
    for n in sorted(kmzs):
        fc = convert(os.path.join(raw, n))
        diagnostics(fc, n)
        if not inspect:
            out = os.path.join(here, os.path.splitext(n)[0] + ".geojson")
            with open(out, "w", encoding="utf-8") as f:
                json.dump(fc, f, separators=(",", ":"))
            print(f"  -> wrote {out} ({os.path.getsize(out)//1024} KB)")


if __name__ == "__main__":
    main()
