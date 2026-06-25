#!/usr/bin/env python3
"""
Turn the PHIVOLCS poster-style hazard tiles into clean transparent overlays.

The tiles are JPG/PNG posters: saturated HAZARD colors (orange/red/cyan/purple) drawn
over GRAY land + WHITE sea, with black text + graticule. We keep the saturated hazard
pixels and make everything low-saturation (sea/land/text/lines) transparent → a crisp
overlay that sits on the base map like the Flood layer.

Updates each layer's manifest to point at the keyed .png tiles.

Usage:
  python chroma_key.py --preview <one-image>     # write <name>.keyed.png to inspect
  python chroma_key.py                            # process all public/hazard/* in place
"""
import sys, os, json
import numpy as np
from PIL import Image

SAT_MIN = 0.30   # keep pixels at least this saturated (hazard fills/lines)
VAL_MIN = 45     # ...and not near-black (drops black text/graticule)


def key_image(path, layer=""):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0.0)
    # Drop the solid-blue title banner + DOST/PHIVOLCS logo (strongly blue-dominant),
    # while keeping cyan tsunami/lake fills (B≈G) and purple trenches (R substantial).
    banner_blue = (b > 110) & (b > r * 1.5) & (b > g * 1.3)

    if layer == "groundrupture":
        # This poster is mostly TAN fault-name labels + a blue graticule over the data.
        # Keep ONLY the real hazard ink: red/orange faults + magenta trenches; drop the rest.
        red_orange = (r >= 60) & (g <= 0.62 * r) & (b <= 0.55 * r) & (r >= g) & (r >= b)  # active + potential fault
        magenta = (b >= 120) & (r >= 80) & (g < 80) & (b > g + 80)                        # trench
        keep = red_orange | magenta
    else:
        keep = (sat >= SAT_MIN) & (mx >= VAL_MIN) & ~banner_blue
        # drop desaturated warm TEXT (e.g. trench-name labels) while keeping vivid orange/red fills
        tan_text = (sat < 0.5) & (r > 120) & (g > 0.5 * r) & (b > 0.15 * r) & (b < 0.8 * r)
        keep = keep & ~tan_text

    if not keep.any():
        # fully transparent 1x1 — empty tiles (open sea) cost almost nothing
        out = Image.new("P", (im.width, im.height))
        out.putpalette([0, 0, 0])
        out.info["transparency"] = 0
        return out

    # Quantize the KEPT hazard pixels to a tiny palette (snaps JPEG speckle to the real
    # hazard color → crisp AND ~10x smaller as PNG-8). Index 15 is reserved transparent.
    rgb = Image.fromarray(np.dstack([r, g, b]).astype(np.uint8), "RGB")
    pal = rgb.quantize(colors=15, method=Image.FASTOCTREE)
    idx = np.asarray(pal).copy()
    idx[~keep] = 15
    out = Image.fromarray(idx.astype(np.uint8), "P")
    palette = list(pal.getpalette() or [])[: 15 * 3]
    palette += [0] * (15 * 3 - len(palette)) + [0, 0, 0]  # pad to 15 colors + transparent idx
    out.putpalette(palette)
    out.info["transparency"] = 15
    return out


def process_layer(root, key):
    mpath = os.path.join(root, key + ".json")
    with open(mpath, encoding="utf-8") as f:
        man = json.load(f)
    img_dir = os.path.join(root, key)
    kept = 0
    for t in man["tiles"]:
        src = os.path.join(img_dir, t["f"])
        if not os.path.exists(src):
            continue
        base = os.path.splitext(t["f"])[0]
        dst_name = base + ".png"
        dst = os.path.join(img_dir, dst_name)
        key_image(src, key).save(dst, "PNG", optimize=True)
        if t["f"] != dst_name and src != dst:
            try: os.remove(src)   # drop the original .jpg (or non-keyed .png)
            except OSError: pass
        t["f"] = dst_name
        kept += 1
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(man, f, separators=(",", ":"))
    total_kb = sum(os.path.getsize(os.path.join(img_dir, t["f"])) for t in man["tiles"] if os.path.exists(os.path.join(img_dir, t["f"]))) // 1024
    print(f"  {key}: keyed {kept} tiles ({total_kb} KB)")


def main():
    if "--preview" in sys.argv:
        rest = [a for a in sys.argv[1:] if a != "--preview"]
        src = rest[0]
        layer = rest[1] if len(rest) > 1 else ("groundrupture" if "_AF_" in src else "tsunami" if "TSU" in src else "liquefaction")
        out = os.path.splitext(src)[0] + ".keyed.png"
        key_image(src, layer).save(out, "PNG")
        print("wrote", out, "(layer:", layer + ")")
        return
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, "..", "public", "hazard"))
    for key in ["liquefaction", "tsunami", "groundrupture"]:
        if os.path.exists(os.path.join(root, key + ".json")):
            process_layer(root, key)
    print("done")


if __name__ == "__main__":
    main()
