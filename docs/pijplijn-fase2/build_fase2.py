"""
Fase 2 - vier afgeleide kaarten, gebouwd op dezelfde bron als de basiskaart.

  A  overijssel-plaatsen        provincie + 8 grootste plaatsen
  B  overijssel-gemeenten       + gemeentegrenzen
  C  overijssel-water           + rivieren, kanalen en plassen
  D  nederland-overijssel       Nederland met Overijssel uitgelicht

Kleuren en lijndiktes komen uit build_kaart.py, zodat alles een familie blijft.
"""
import json, glob, math, os
import matplotlib; matplotlib.use("Agg")
from matplotlib import font_manager as fm
import matplotlib.pyplot as plt
from matplotlib.path import Path
from matplotlib.patches import PathPatch, Circle
import build_kaart as B

for f in glob.glob("/home/claude/work/fonts/*"):
    fm.fontManager.addfont(f)
FONT = "Roobert"
OUT = "/mnt/user-data/outputs/"

PLAATSEN = json.load(open("/home/claude/work/plaatsen.json"))
WATEREN = json.load(open("/home/claude/work/wateren.json"))
CACHE = json.load(open("/home/claude/work/water_cache.json"))

TEKST = "#131720"          # Oost Donkerblauw
HIGHLIGHT = "#FFAF16"      # Oost Geel, voor de Nederlandkaart
VUL, GRENS = B.VARIANTEN[0][1], B.VARIANTEN[0][2]

# labelplaatsing: (dx, dy, horizontale uitlijning, verticale uitlijning)
LABEL = {
    "Kampen":    (-16,  7, "right",  "center"),
    "Zwolle":    ( 20, 10, "left",   "center"),
    "Deventer":  (-16,  7, "right",  "center"),
    "Rijssen":   (-16,  7, "right",  "center"),
    "Almelo":    (  0,-18, "center", "bottom"),
    "Hengelo":   (-16,  7, "right",  "center"),
    "Enschede":  (  0, 30, "center", "top"),
    "Oldenzaal": ( 16,  7, "left",   "center"),
}
PT_HOOFD, PT_GEWOON = 34, 26
WATER_LW = 3.2      # rivieren worden breder getekend dan ze zijn: op 1px=102m
                    # is de IJssel anderhalve pixel. Standaard kaartpraktijk.
DOT_HOOFD, DOT_GEWOON = 9, 6


def _canvas(breedte=1920, hoogte=1080):
    fig = plt.figure(figsize=(breedte / 100, hoogte / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, B.W); ax.set_ylim(B.H, 0); ax.axis("off")
    return fig, ax


def _pad(ringen, proj=None):
    proj = proj or B.proj
    v, c = [], []
    for r in ringen:
        p = [proj(x, y) for x, y in r]
        v.extend(p + [p[0]])
        c.extend([Path.MOVETO] + [Path.LINETO] * (len(p) - 1) + [Path.CLOSEPOLY])
    return Path(v, c)


def teken_ondergrond(ax, gemeentegrenzen=False, sf=1.0):
    """Achtergrond, context en Overijssel. Retourneert het knipvlak."""
    c = B.CONTEXT_STIJL[B.CONTEXT]
    ax.add_patch(plt.Rectangle((0, 0), B.W, B.H, facecolor=B.KLEUR["water"], edgecolor="none"))
    ax.add_patch(PathPatch(_pad([r for r, _ in B.context_vlakken]),
                           facecolor=B.KLEUR["context_land"], edgecolor="none"))
    ax.add_patch(PathPatch(_pad(B.context_lijnen), facecolor="none", edgecolor=c["kleur"],
                           lw=max(c["prov_lw"] * sf, 0.55), alpha=c["prov_op"]))
    knip = PathPatch(_pad(B.landmasker), facecolor="none", edgecolor="none")
    ax.add_patch(knip)

    if gemeentegrenzen:
        for code in sorted(B.overijssel):
            p = PathPatch(_pad(B.topo.rings(code)), facecolor=VUL, edgecolor=GRENS,
                          lw=max(B.LW_GEM * sf, 0.55), joinstyle="round")
            ax.add_patch(p); p.set_clip_path(knip)
    else:
        for code in sorted(B.overijssel):
            p = PathPatch(_pad(B.topo.rings(code)), facecolor=VUL, edgecolor="none")
            ax.add_patch(p); p.set_clip_path(knip)
    p = PathPatch(_pad(B.rand_ringen), facecolor="none", edgecolor=GRENS,
                  lw=max(B.LW_RAND * sf, 0.55), joinstyle="round")
    ax.add_patch(p); p.set_clip_path(knip)
    return knip


def teken_water(ax, knip, sf=1.0):
    bron = {}
    for f in CACHE:
        bron.setdefault(f["naam"], []).append(f)
    for label, namen in WATEREN.items():
        for n in namen:
            for d in bron.get(n, []):
                for ringen in d["vlakken"]:
                    # vulling EN rand in dezelfde kleur: smalle rivieren worden
                    # zo zichtbaar zonder dat brede delen hun vorm verliezen
                    p = PathPatch(_pad(ringen), facecolor=B.KLEUR["water"],
                                  edgecolor=B.KLEUR["water"], lw=WATER_LW * sf,
                                  joinstyle="round")
                    ax.add_patch(p); p.set_clip_path(knip)
                for lijn in d["lijnen"]:
                    pts = [B.proj(x, y) for x, y in lijn]
                    ln, = ax.plot([q[0] for q in pts], [q[1] for q in pts],
                                  color=B.KLEUR["water"], lw=WATER_LW * sf,
                                  solid_capstyle="round", solid_joinstyle="round")
                    ln.set_clip_path(knip)


def teken_plaatsen(ax, sf=1.0):
    """Tekent stippen en labels. Retourneert de labelvakken voor de botsingstest."""
    vakken = {}
    for naam, v in PLAATSEN.items():
        x, y = B.proj(v["x"], v["y"])
        hoofd = v.get("hoofdstad", False)
        ax.add_patch(Circle((x, y), (DOT_HOOFD if hoofd else DOT_GEWOON) * sf,
                            facecolor=TEKST, edgecolor="none", zorder=5))
        dx, dy, ha, va = LABEL[naam]
        t = ax.text(x + dx * sf, y + dy * sf, naam, fontfamily=FONT,
                    fontsize=(PT_HOOFD if hoofd else PT_GEWOON) * sf,
                    fontweight=600 if hoofd else 500,
                    color=TEKST, ha=ha, va=va, zorder=6)
        vakken[naam] = t
    return vakken


def controleer_overlap(fig, vakken):
    fig.canvas.draw()
    bb = {n: t.get_window_extent(fig.canvas.get_renderer()) for n, t in vakken.items()}
    botsingen = []
    ns = list(bb)
    for i in range(len(ns)):
        for j in range(i + 1, len(ns)):
            a, b = bb[ns[i]], bb[ns[j]]
            if a.overlaps(b):
                botsingen.append((ns[i], ns[j]))
    return botsingen


# ------------------------------------------------------------------ kaart D
def nederland_kaart(pad_out, breedte=1920, hoogte=1080):
    import json as _j
    cbs = _j.load(open("/mnt/user-data/uploads/Provincies_zonder_water_v1_0.json"))
    xs = [p[0] for f in cbs["features"] for poly in f["geometry"]["coordinates"]
          for r in poly for p in r]
    ys = [p[1] for f in cbs["features"] for poly in f["geometry"]["coordinates"]
          for r in poly for p in r]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    s = min(hoogte * 0.88 / (maxy - miny), breedte * 0.88 / (maxx - minx))
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2

    def pr(x, y):
        return (breedte / 2 + (x - cx) * s, hoogte / 2 - (y - cy) * s)

    fig = plt.figure(figsize=(breedte / 100, hoogte / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, breedte); ax.set_ylim(hoogte, 0); ax.axis("off")
    ax.add_patch(plt.Rectangle((0, 0), breedte, hoogte, facecolor=B.KLEUR["water"], edgecolor="none"))
    for f in cbs["features"]:
        ov = f["properties"]["statnaam"] == "Overijssel"
        ringen = [r for poly in f["geometry"]["coordinates"] for r in poly]
        ringen = [B.douglas_peucker([(round(x, 1), round(y, 1)) for x, y in r], 150)
                  if False else r for r in ringen]
        ax.add_patch(PathPatch(_pad(ringen, proj=pr),
                               facecolor=HIGHLIGHT if ov else B.KLEUR["context_land"],
                               edgecolor="#FFFFFF" if ov else B.KLEUR["context_lijn"],
                               lw=2.4 if ov else 1.0,
                               alpha=1.0 if ov else 0.95, zorder=3 if ov else 2))
    fig.savefig(pad_out, dpi=100)
    plt.close(fig)


if __name__ == "__main__":
    resultaat = {}

    # A - plaatsnamen zonder gemeentegrenzen
    fig, ax = _canvas(); knip = teken_ondergrond(ax, gemeentegrenzen=False)
    vakken = teken_plaatsen(ax)
    resultaat["A"] = controleer_overlap(fig, vakken)
    fig.savefig(OUT + "overijssel-plaatsen.png", dpi=100); plt.close(fig)

    # B - met gemeentegrenzen
    fig, ax = _canvas(); knip = teken_ondergrond(ax, gemeentegrenzen=True)
    vakken = teken_plaatsen(ax)
    resultaat["B"] = controleer_overlap(fig, vakken)
    fig.savefig(OUT + "overijssel-gemeenten-plaatsen.png", dpi=100); plt.close(fig)

    # C - met water
    fig, ax = _canvas(); knip = teken_ondergrond(ax, gemeentegrenzen=False)
    teken_water(ax, knip)
    vakken = teken_plaatsen(ax)
    resultaat["C"] = controleer_overlap(fig, vakken)
    fig.savefig(OUT + "overijssel-water-plaatsen.png", dpi=100); plt.close(fig)

    # D - Nederland
    nederland_kaart(OUT + "nederland-overijssel.png")
    nederland_kaart(OUT + "nederland-overijssel-vierkant.png", 1080, 1080)

    print("labelbotsingen per kaart:")
    for k, v in resultaat.items():
        print("  %s: %s" % (k, v if v else "geen"))


# ------------------------------------------------------------------ SVG-uitvoer
def svg_kaart2(gemeentegrenzen=False, water=False, plaatsen=True):
    c = B.CONTEXT_STIJL[B.CONTEXT]
    L = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
         % (B.W, B.H, B.W, B.H)]
    L.append("""<style>
svg{
  --oost-water:%s; --context-land:%s; --context-lijn:%s;
  --ov-vulling:%s; --ov-grens:%s; --tekst:%s;
  --lijn-context:%.1f; --lijn-gemeente:%.1f; --lijn-provincie:%.1f; --lijn-water:%.1f;
}
#achtergrond{fill:var(--oost-water)}
#context-land{fill:var(--context-land);fill-rule:evenodd}
#provinciegrenzen{fill:none;stroke:var(--context-lijn);stroke-width:var(--lijn-context);opacity:%.2f}
.gemeente{fill:var(--ov-vulling);stroke:var(--ov-grens);stroke-width:var(--lijn-gemeente);stroke-linejoin:round}
.gemeente.naadloos{stroke:none}
#provinciegrens{fill:none;stroke:var(--ov-grens);stroke-width:var(--lijn-provincie);stroke-linejoin:round;stroke-linecap:round}
.water{fill:var(--oost-water);stroke:var(--oost-water);stroke-width:var(--lijn-water);stroke-linejoin:round;stroke-linecap:round}
.water-lijn{fill:none}
.plaats circle{fill:var(--tekst)}
.plaats text{fill:var(--tekst);font-family:Roobert,Arial,sans-serif;font-weight:500;font-size:26px}
.plaats.hoofdstad text{font-weight:600;font-size:34px}
</style>""" % (B.KLEUR["water"], B.KLEUR["context_land"], c["kleur"], VUL, GRENS, TEKST,
                c["prov_lw"], B.LW_GEM, B.LW_RAND, WATER_LW, c["prov_op"]))
    L.append('<defs><clipPath id="land">%s</clipPath>'
             % "".join('<path d="%s"/>' % B.pad(r) for r in B.landmasker))
    L.append('<clipPath id="kader"><rect x="0" y="0" width="%d" height="%d"/></clipPath></defs>' % (B.W, B.H))
    L.append('<g clip-path="url(#kader)">')
    L.append('<rect id="achtergrond" x="0" y="0" width="%d" height="%d"/>' % (B.W, B.H))
    L.append('<g id="context"><path id="context-land" d="%s"/><path id="provinciegrenzen" d="%s"/></g>'
             % ("".join(B.pad(r) for r, _ in B.context_vlakken),
                "".join(B.pad(r) for r in B.context_lijnen)))
    L.append('<g id="overijssel" clip-path="url(#land)"><g id="gemeenten">')
    kl = "gemeente" if gemeentegrenzen else "gemeente naadloos"
    for code in sorted(B.overijssel):
        L.append('<path class="%s" id="%s" data-naam="%s" d="%s"/>'
                 % (kl, code, B.meta[code]["naam"], "".join(B.pad(r) for r in B.topo.rings(code))))
    L.append('</g><path id="provinciegrens" d="%s"/>' % "".join(B.pad(r) for r in B.rand_ringen))

    if water:
        bron = {}
        for f in CACHE:
            bron.setdefault(f["naam"], []).append(f)
        L.append('<g id="water">')
        for label, namen in WATEREN.items():
            v, ln = [], []
            for n in namen:
                for d in bron.get(n, []):
                    v += ["".join(B.pad(r) for r in ringen) for ringen in d["vlakken"]]
                    ln += ["".join(("M" if i == 0 else "L") + "%.1f %.1f" % B.proj(x, y)
                                   for i, (x, y) in enumerate(l)) for l in d["lijnen"]]
            if v:
                L.append('<path class="water" data-naam="%s" d="%s"/>' % (label, "".join(v)))
            if ln:
                L.append('<path class="water water-lijn" data-naam="%s" d="%s"/>' % (label, "".join(ln)))
        L.append('</g>')
    L.append('</g>')

    if plaatsen:
        ank = {"right": "end", "left": "start", "center": "middle"}
        basis = {"center": "central", "bottom": "auto", "top": "hanging"}
        L.append('<g id="plaatsen">')
        for naam, v in PLAATSEN.items():
            x, y = B.proj(v["x"], v["y"])
            hoofd = v.get("hoofdstad", False)
            dx, dy, ha, va = LABEL[naam]
            L.append('<g class="plaats%s" data-naam="%s">' % (" hoofdstad" if hoofd else "", naam))
            L.append('<circle cx="%.1f" cy="%.1f" r="%d"/>' % (x, y, DOT_HOOFD if hoofd else DOT_GEWOON))
            L.append('<text x="%.1f" y="%.1f" text-anchor="%s" dominant-baseline="%s">%s</text>'
                     % (x + dx, y + dy, ank[ha], basis[va], naam))
            L.append('</g>')
        L.append('</g>')
    L.append('</g></svg>')          # sluit de kader-groep
    return "\n".join(L)


def schrijf_svgs():
    open(OUT + "overijssel-plaatsen.svg", "w").write(svg_kaart2(False, False, True))
    open(OUT + "overijssel-gemeenten-plaatsen.svg", "w").write(svg_kaart2(True, False, True))
    open(OUT + "overijssel-water-plaatsen.svg", "w").write(svg_kaart2(False, True, True))


def nederland_svg(pad_out, breedte=1080, hoogte=1080):
    cbs = json.load(open("/mnt/user-data/uploads/Provincies_zonder_water_v1_0.json"))
    xs = [p[0] for f in cbs["features"] for poly in f["geometry"]["coordinates"] for r in poly for p in r]
    ys = [p[1] for f in cbs["features"] for poly in f["geometry"]["coordinates"] for r in poly for p in r]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    s = min(hoogte * .88 / (maxy - miny), breedte * .88 / (maxx - minx))
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    def pr(x, y): return (breedte / 2 + (x - cx) * s, hoogte / 2 - (y - cy) * s)
    def pd(r):
        return "".join(("M" if i == 0 else "L") + "%.1f %.1f" % pr(x, y)
                       for i, (x, y) in enumerate(r)) + "Z"

    L = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
         % (breedte, hoogte, breedte, hoogte)]
    L.append("""<style>
svg{--oost-water:%s; --provincie:%s; --provincie-lijn:%s; --uitgelicht:%s; --uitgelicht-rand:#FFFFFF;}
#achtergrond{fill:var(--oost-water)}
.provincie{fill:var(--provincie);stroke:var(--provincie-lijn);stroke-width:1;stroke-linejoin:round}
.provincie.uitgelicht{fill:var(--uitgelicht);stroke:var(--uitgelicht-rand);stroke-width:2.4}
</style>""" % (B.KLEUR["water"], B.KLEUR["context_land"],
                B.CONTEXT_STIJL[B.CONTEXT]["kleur"], HIGHLIGHT))
    L.append('<rect id="achtergrond" x="0" y="0" width="%d" height="%d"/>' % (breedte, hoogte))
    uitgelicht = []
    for f in cbs["features"]:
        naam = f["properties"]["statnaam"]
        d = "".join(pd(r) for poly in f["geometry"]["coordinates"] for r in poly)
        rij = '<path class="provincie%s" id="%s" data-naam="%s" d="%s"/>' % (
            " uitgelicht" if naam == "Overijssel" else "",
            f["properties"]["statcode"], naam, d)
        (uitgelicht if naam == "Overijssel" else L).append(rij)
    L += uitgelicht          # Overijssel bovenop, zodat de witte rand niet wegvalt
    L.append('</svg>')
    open(pad_out, "w").write("\n".join(L))


# ------------------------------------------------- Nederlandkaart, drie varianten
NL_VARIANTEN = {
    # canvas          Nederland        Overijssel      scheidingslijn
    "blauw":      dict(canvas="#1361FF", nl="#E7EEF9", ov="#131720", lijn="#AFC4E0"),
    "wit":        dict(canvas="#FFFFFF", nl="#1361FF", ov="#E7EEF9", lijn="#5B8CFF"),
    "lichtblauw": dict(canvas="#E7EEF9", nl="#1361FF", ov="#FFFFFF", lijn="#5B8CFF"),
    # zelfde canvas als hierboven, maar Nederland en Overijssel omgewisseld
    "lichtblauw-omgekeerd": dict(canvas="#E7EEF9", nl="#FFFFFF", ov="#1361FF", lijn="#AFC4E0"),
}
NL_LW = 0.9          # fijne contour, ook rond Overijssel


def _nl_projectie(cbs, breedte, hoogte):
    xs = [p[0] for f in cbs["features"] for poly in f["geometry"]["coordinates"] for r in poly for p in r]
    ys = [p[1] for f in cbs["features"] for poly in f["geometry"]["coordinates"] for r in poly for p in r]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    s = min(hoogte * .88 / (maxy - miny), breedte * .88 / (maxx - minx))
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    return lambda x, y: (breedte / 2 + (x - cx) * s, hoogte / 2 - (y - cy) * s)


def nederland_png(pad_out, variant="blauw", breedte=1080, hoogte=1080):
    v = NL_VARIANTEN[variant]
    cbs = json.load(open("/mnt/user-data/uploads/Provincies_zonder_water_v1_0.json"))
    pr = _nl_projectie(cbs, breedte, hoogte)
    fig = plt.figure(figsize=(breedte / 100, hoogte / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, breedte); ax.set_ylim(hoogte, 0); ax.axis("off")
    ax.add_patch(plt.Rectangle((0, 0), breedte, hoogte, facecolor=v["canvas"], edgecolor="none"))
    sf = breedte / 1080
    for f in cbs["features"]:
        ov = f["properties"]["statnaam"] == "Overijssel"
        ringen = [r for poly in f["geometry"]["coordinates"] for r in poly]
        ax.add_patch(PathPatch(_pad(ringen, proj=pr),
                               facecolor=v["ov"] if ov else v["nl"], edgecolor=v["lijn"],
                               lw=max(NL_LW * sf, 0.5), joinstyle="round", zorder=3 if ov else 2))
    fig.savefig(pad_out, dpi=100); plt.close(fig)


def nederland_svg2(pad_out, variant="blauw", breedte=1080, hoogte=1080):
    v = NL_VARIANTEN[variant]
    cbs = json.load(open("/mnt/user-data/uploads/Provincies_zonder_water_v1_0.json"))
    pr = _nl_projectie(cbs, breedte, hoogte)
    def pd(r):
        return "".join(("M" if i == 0 else "L") + "%.1f %.1f" % pr(x, y)
                       for i, (x, y) in enumerate(r)) + "Z"
    L = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
         % (breedte, hoogte, breedte, hoogte)]
    L.append("""<style>
svg{--canvas:%s; --nederland:%s; --overijssel:%s; --lijn:%s; --lijn-dikte:%.1f;}
#achtergrond{fill:var(--canvas)}
.provincie{fill:var(--nederland);stroke:var(--lijn);stroke-width:var(--lijn-dikte);stroke-linejoin:round}
.provincie.uitgelicht{fill:var(--overijssel)}
</style>""" % (v["canvas"], v["nl"], v["ov"], v["lijn"], NL_LW))
    L.append('<rect id="achtergrond" x="0" y="0" width="%d" height="%d"/>' % (breedte, hoogte))
    top = []
    for f in cbs["features"]:
        naam = f["properties"]["statnaam"]
        rij = '<path class="provincie%s" id="%s" data-naam="%s" d="%s"/>' % (
            " uitgelicht" if naam == "Overijssel" else "", f["properties"]["statcode"], naam,
            "".join(pd(r) for poly in f["geometry"]["coordinates"] for r in poly))
        (top if naam == "Overijssel" else L).append(rij)
    L += top
    L.append('</svg>')
    open(pad_out, "w").write("\n".join(L))
