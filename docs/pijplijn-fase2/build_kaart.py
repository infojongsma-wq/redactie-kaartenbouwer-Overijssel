"""
Bouwt de basiskaart van Overijssel in RTV Oost-huisstijl.

Bronnen:
  BRK Bestuurlijke Gebieden (Kadaster)  -> gemeentegrenzen, precies (15 m tolerantie)
  CBS Gebiedsindelingen, gegeneraliseerd -> land/water-scheiding en omliggende provincies
  Beide CC BY 4.0, via PDOK. CRS: EPSG:28992 (RD New), geen herprojectie.

Uitvoer: SVG (themeable via CSS-variabelen), PNG 1920x1080 en TopoJSON.
Opnieuw draaien na een herindeling: nieuwe bestanden downloaden, dan `python3 build_kaart.py`.
"""
import json, os
from topology import Topology, chain_arcs, douglas_peucker

UP, OUT = "/mnt/user-data/uploads/", "/mnt/user-data/outputs/"
os.makedirs(OUT, exist_ok=True)

KLEUR = {
    "water":        "#1361FF",   # Oost Blauw - achtergrond = water
    "context_land": "#4A85FF",   # omliggende provincies
    "context_lijn": "#7FA9FF",
    "wit": "#FFFFFF", "lichtblauw": "#E7EEF9", "tint": "#8FB8FF",
}
VARIANTEN = [("tint", KLEUR["tint"], KLEUR["wit"]),
             ("lichtblauw", KLEUR["lichtblauw"], KLEUR["water"]),
             ("wit", KLEUR["wit"], KLEUR["water"])]

W, H, OV_HOOGTE = 1920, 1080, 800
TOL_GEM, TOL_CONTEXT = 15, 80
LW_GEM, LW_RAND = 1.6, 3.6
# Sinds de context ingevuld land is, mogen de provincielijnen terughoudender.
CONTEXT_STIJL = {
    "fijn":     {"prov_lw": 1.4, "prov_op": 0.60, "kleur": "#9DBEFF"},
    "fijner":   {"prov_lw": 1.1, "prov_op": 0.45, "kleur": "#ADC9FF"},
    "haarlijn": {"prov_lw": 0.8, "prov_op": 0.35, "kleur": "#BFD4FF"},
    "normaal":  {"prov_lw": 2.0, "prov_op": 0.90, "kleur": "#7FA9FF"},   # oude instelling
}
CONTEXT = "haarlijn"

# ---------------------------------------------------------------- inladen
brk_gem = json.load(open(UP + "Kaart_gemeentegrenzen_v1_0.json"))
cbs_prov = json.load(open(UP + "Provincies_zonder_water_v1_0.json"))

overijssel, meta = {}, {}
for f in brk_gem["features"]:
    p = f["properties"]
    if p.get("ligtInProvincieNaam") != "Overijssel":
        continue
    overijssel[p["identificatie"]] = f["geometry"]["coordinates"]
    meta[p["identificatie"]] = {"naam": p["naam"].replace(" (O)", ""), "code": p["code"]}
assert len(overijssel) == 25, f"verwacht 25 gemeenten, kreeg {len(overijssel)}"

topo = Topology(); topo.add_shapes(overijssel); topo.simplify(TOL_GEM)
rand_ringen = chain_arcs(topo, topo.boundary_arcs())

# ---------------------------------------------------------------- projectie
xs = [x for c in overijssel for r in topo.rings(c) for x, _ in r]
ys = [y for c in overijssel for r in topo.rings(c) for _, y in r]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
S = OV_HOOGTE / (maxy - miny)

def proj(x, y):
    return (W / 2 + (x - cx) * S, H / 2 - (y - cy) * S)

vminx, vmaxx = cx - (W / 2) / S, cx + (W / 2) / S
vminy, vmaxy = cy - (H / 2) / S, cy + (H / 2) / S
def in_beeld(ring, marge=5000):
    rx = [p[0] for p in ring]; ry = [p[1] for p in ring]
    return not (max(rx) < vminx - marge or min(rx) > vmaxx + marge or
                max(ry) < vminy - marge or min(ry) > vmaxy + marge)

def vereenvoudig(ring, tol):
    pts = [(round(x, 3), round(y, 3)) for x, y in ring]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    s = douglas_peucker(pts, tol)
    return s + [s[0]] if len(s) >= 3 else None

# ------------------------------------------- context + landmasker uit CBS
context_vlakken, context_lijnen, landmasker = [], [], []
for f in cbs_prov["features"]:
    is_ov = f["properties"]["statnaam"] == "Overijssel"
    for poly in f["geometry"]["coordinates"]:
        for j, ring in enumerate(poly):
            if not in_beeld(ring):
                continue
            s = vereenvoudig(ring, TOL_CONTEXT)
            if not s:
                continue
            if j == 0:
                landmasker.append(s)          # alleen buitenringen -> veilig masker
            if not is_ov:
                context_vlakken.append((s, j == 0))
                context_lijnen.append(s)

# ---------------------------------------------------------------- SVG
def pad(ring, nd=1):
    return "".join(("M" if i == 0 else "L") + "%.*f %.*f" % (nd, proj(x, y)[0], nd, proj(x, y)[1])
                   for i, (x, y) in enumerate(ring)) + "Z"

def svg_kaart(vul, grens, met_context=True, context=None):
    c = CONTEXT_STIJL[context or CONTEXT]
    if met_context:
        vb, bw, bh = "0 0 %d %d" % (W, H), W, H
    else:
        x0, y0 = proj(minx, maxy); x1, y1 = proj(maxx, miny); m = 12
        vb = "%.0f %.0f %.0f %.0f" % (x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m)
        bw, bh = round(x1 - x0 + 2 * m), round(y1 - y0 + 2 * m)

    L = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" width="%d" height="%d">' % (vb, bw, bh)]
    L.append("""<style>
svg{
  --oost-water:%s;      /* achtergrond = water */
  --context-land:%s;    /* omliggende provincies */
  --context-lijn:%s;
  --ov-vulling:%s;      /* vulling gemeenten - overschrijf voor een andere variant */
  --ov-grens:%s;        /* gemeentegrenzen en provinciecontour */
  --lijn-context:%.1f;  /* op smalle schermen ophogen, bv. naar 2 */
  --lijn-gemeente:%.1f;
  --lijn-provincie:%.1f;
}
#achtergrond{fill:var(--oost-water)}
#context-land{fill:var(--context-land);fill-rule:evenodd}
#provinciegrenzen{fill:none;stroke:var(--context-lijn);stroke-width:var(--lijn-context);opacity:%.2f;stroke-linejoin:round}
.gemeente{fill:var(--ov-vulling);stroke:var(--ov-grens);stroke-width:var(--lijn-gemeente);stroke-linejoin:round}
#provinciegrens{fill:none;stroke:var(--ov-grens);stroke-width:var(--lijn-provincie);stroke-linejoin:round;stroke-linecap:round}
</style>""" % (KLEUR["water"], KLEUR["context_land"], c["kleur"], vul, grens,
                c["prov_lw"], LW_GEM, LW_RAND, c["prov_op"]))

    L.append('<defs>')
    L.append('<clipPath id="land">%s</clipPath>'
             % "".join('<path d="%s"/>' % pad(r) for r in landmasker))
    L.append('<clipPath id="kader"><rect x="0" y="0" width="%d" height="%d"/></clipPath></defs>' % (W, H))
    L.append('<g%s>' % (' clip-path="url(#kader)"' if met_context else ''))
    if met_context:
        L.append('<rect id="achtergrond" x="0" y="0" width="%d" height="%d"/>' % (W, H))
        L.append('<g id="context">')
        L.append('<path id="context-land" d="%s"/>' % "".join(pad(r) for r, _ in context_vlakken))
        L.append('<path id="provinciegrenzen" d="%s"/>' % "".join(pad(r) for r in context_lijnen))
        L.append('</g>')
    L.append('<g id="overijssel" clip-path="url(#land)"><g id="gemeenten">')
    for code in sorted(overijssel):
        L.append('<path class="gemeente" id="%s" data-naam="%s" d="%s"/>'
                 % (code, meta[code]["naam"], "".join(pad(r) for r in topo.rings(code))))
    L.append('</g>')
    L.append('<path id="provinciegrens" d="%s"/>' % "".join(pad(r) for r in rand_ringen))
    L.append('</g></g></svg>')
    return "\n".join(L)

# ---------------------------------------------------------------- PNG
def png_kaart(pad_out, vul, grens, met_context=True, breedte=W, hoogte=H, context=None):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.path import Path
    from matplotlib.patches import PathPatch
    c = CONTEXT_STIJL[context or CONTEXT]
    dpi = 100
    fig = plt.figure(figsize=(breedte / dpi, hoogte / dpi), dpi=dpi)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(H, 0); ax.axis("off")
    sf = breedte / W
    MIN_LW = 0.55                      # ondergrens in uitvoerpixels
    def dik(w):                        # lijndikte schaalt mee, maar verdwijnt niet
        return max(w * sf, MIN_LW)

    def mk(ringen):
        v, cd = [], []
        for r in ringen:
            p = [proj(x, y) for x, y in r]
            v.extend(p + [p[0]]); cd.extend([Path.MOVETO] + [Path.LINETO] * (len(p) - 1) + [Path.CLOSEPOLY])
        return Path(v, cd)

    if met_context:
        ax.add_patch(plt.Rectangle((0, 0), W, H, facecolor=KLEUR["water"], edgecolor="none"))
        ax.add_patch(PathPatch(mk([r for r, _ in context_vlakken]),
                               facecolor=KLEUR["context_land"], edgecolor="none"))
        ax.add_patch(PathPatch(mk(context_lijnen), facecolor="none",
                               edgecolor=c["kleur"], lw=dik(c["prov_lw"]), alpha=c["prov_op"]))
    else:
        fig.patch.set_alpha(0); ax.patch.set_alpha(0)

    knip = PathPatch(mk(landmasker), facecolor="none", edgecolor="none")
    ax.add_patch(knip)
    for code in sorted(overijssel):
        p = PathPatch(mk(topo.rings(code)), facecolor=vul, edgecolor=grens,
                      lw=dik(LW_GEM), joinstyle="round")
        ax.add_patch(p); p.set_clip_path(knip)
    p = PathPatch(mk(rand_ringen), facecolor="none", edgecolor=grens,
                  lw=dik(LW_RAND), joinstyle="round")
    ax.add_patch(p); p.set_clip_path(knip)
    fig.savefig(pad_out, dpi=dpi, transparent=not met_context)
    plt.close(fig)

# ---------------------------------------------------------------- data-export
def schrijf_topojson(pad_out, kwant=1e5):
    axs = [p[0] for a in topo.arcs for p in a]; ays = [p[1] for a in topo.arcs for p in a]
    x0, x1, y0, y1 = min(axs), max(axs), min(ays), max(ays)
    sx, sy = (x1 - x0) / (kwant - 1), (y1 - y0) / (kwant - 1)
    arcs = []
    for a in topo.arcs:
        q = [(round((x - x0) / sx), round((y - y0) / sy)) for x, y in a]
        uit, px, py = [], 0, 0
        for x, y in q:
            uit.append([x - px, y - py]); px, py = x, y
        arcs.append(uit)
    geoms = [{"type": "Polygon",
              "arcs": [[(aid if not rev else ~aid) for aid, rev in ring] for ring in topo.shapes[code]],
              "id": code, "properties": {"naam": meta[code]["naam"], "code": meta[code]["code"]}}
             for code in sorted(overijssel)]
    json.dump({"type": "Topology", "transform": {"scale": [sx, sy], "translate": [x0, y0]},
               "bbox": [x0, y0, x1, y1],
               "objects": {"gemeenten": {"type": "GeometryCollection", "geometries": geoms}},
               "arcs": arcs, "crs": "EPSG:28992",
               "bron": "BRK Bestuurlijke Gebieden + CBS Gebiedsindelingen, PDOK - CC BY 4.0"},
              open(pad_out, "w"), separators=(",", ":"))

def schrijf_geojson(pad_out):
    feats = [{"type": "Feature", "id": code,
              "properties": {"naam": meta[code]["naam"], "code": meta[code]["code"]},
              "geometry": {"type": "Polygon",
                           "coordinates": [[[round(x, 1), round(y, 1)] for x, y in r]
                                           for r in topo.rings(code)]}}
             for code in sorted(overijssel)]
    json.dump({"type": "FeatureCollection",
               "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::28992"}},
               "features": feats}, open(pad_out, "w"), separators=(",", ":"))


if __name__ == "__main__":
    vul, grens = VARIANTEN[0][1], VARIANTEN[0][2]
    open(OUT + "overijssel-basis.svg", "w").write(svg_kaart(vul, grens))
    open(OUT + "overijssel-solo.svg", "w").write(svg_kaart(vul, grens, met_context=False))
    for naam, v, g in VARIANTEN:
        png_kaart(OUT + "overijssel-basis-%s.png" % naam, v, g)
    png_kaart(OUT + "overijssel-solo.png", vul, grens, met_context=False)
    schrijf_topojson(OUT + "overijssel.topojson")
    schrijf_geojson(OUT + "overijssel-gemeenten.geojson")
    print("topologie:", topo.stats(), "| context:", CONTEXT)
    print("context: %d vlakringen, %d maskerringen" % (len(context_vlakken), len(landmasker)))
    print("schaal: 1 px = %.0f m" % (1 / S))
