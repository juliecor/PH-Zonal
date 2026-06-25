#!/usr/bin/env python3
"""
Extract PHIVOLCS hazard super-overlay KMZ -> static image tiles + a tiny manifest the
map can render as zoom-aware GroundOverlays.

KMZ here is NOT vector — it's a quadtree of georeferenced image tiles (L1 national
overview -> L5 full detail), each a GroundOverlay with a LatLonBox. We copy the images
into public/hazard/<layer>/ and write public/hazard/<layer>.json describing each tile's
bbox + level, so GMap can show only the on-screen tiles of the right level.

Pure stdlib. Usage:
  python extract_superoverlay.py "C:/path/to/PHIVOCS HAZARD"
"""
import sys, os, json, zipfile, xml.etree.ElementTree as ET, re

NS = "{http://www.opengis.net/kml/2.2}"

# filename prefix -> (layer key, human label)
LAYERS = {
    "aft": ("groundrupture", "Ground Rupture (Active Fault)"),
    "liq": ("liquefaction", "Liquefaction"),
    "tsu": ("tsunami", "Tsunami-Prone"),
}


def detect_layer(fname):
    p = fname.lower()[:3]
    return LAYERS.get(p, (os.path.splitext(fname)[0].lower(), os.path.splitext(fname)[0]))


def extract(kmz_path, out_root):
    fname = os.path.basename(kmz_path)
    key, label = detect_layer(fname)
    img_dir = os.path.join(out_root, key)
    os.makedirs(img_dir, exist_ok=True)

    with zipfile.ZipFile(kmz_path) as z:
        root = ET.fromstring(z.read("doc.kml"))
        tiles = []
        N = S = E = W = None
        for go in root.iter(f"{NS}GroundOverlay"):
            icon = go.find(f"{NS}Icon/{NS}href")
            box = go.find(f"{NS}LatLonBox")
            if icon is None or box is None or not icon.text:
                continue
            href = icon.text.strip()
            m = re.search(r"_L(\d+)_", href)
            lvl = int(m.group(1)) if m else 1
            n = float(box.find(f"{NS}north").text)
            s = float(box.find(f"{NS}south").text)
            e = float(box.find(f"{NS}east").text)
            w = float(box.find(f"{NS}west").text)
            tiles.append({"f": os.path.basename(href), "lvl": lvl,
                          "n": round(n, 6), "s": round(s, 6), "e": round(e, 6), "w": round(w, 6)})
            N = n if N is None else max(N, n); S = s if S is None else min(S, s)
            E = e if E is None else max(E, e); W = w if W is None else min(W, w)

        # copy the referenced images out of the zip
        zip_by_base = {os.path.basename(zn): zn for zn in z.namelist()}
        copied = 0
        for t in tiles:
            zn = zip_by_base.get(t["f"])
            if not zn:
                continue
            dst = os.path.join(img_dir, t["f"])
            if not os.path.exists(dst):
                with z.open(zn) as src, open(dst, "wb") as out:
                    out.write(src.read())
            copied += 1

    manifest = {
        "layer": key, "label": label, "source": fname,
        "attribution": "PHIVOLCS / GeoRiskPH",
        "bbox": {"north": N, "south": S, "east": E, "west": W},
        "maxLevel": max((t["lvl"] for t in tiles), default=1),
        "tiles": tiles,
    }
    with open(os.path.join(out_root, key + ".json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, separators=(",", ":"))
    total_kb = sum(os.path.getsize(os.path.join(img_dir, t["f"])) for t in tiles if os.path.exists(os.path.join(img_dir, t["f"]))) // 1024
    print(f"  {fname} -> {key}: {len(tiles)} tiles ({copied} imgs, {total_kb} KB), maxLevel L{manifest['maxLevel']}")
    return key


def main():
    if len(sys.argv) < 2:
        print("usage: python extract_superoverlay.py <folder-with-kmz>")
        return
    src = sys.argv[1]
    here = os.path.dirname(os.path.abspath(__file__))
    out_root = os.path.join(here, "..", "public", "hazard")
    out_root = os.path.abspath(out_root)
    os.makedirs(out_root, exist_ok=True)
    kmzs = [n for n in os.listdir(src) if n.lower().endswith(".kmz")]
    if not kmzs:
        print(f"No .kmz in {src}")
        return
    keys = []
    for n in sorted(kmzs):
        keys.append(extract(os.path.join(src, n), out_root))
    print(f"\nDone. Layers: {keys}")
    print(f"Output: {out_root}")


if __name__ == "__main__":
    main()
