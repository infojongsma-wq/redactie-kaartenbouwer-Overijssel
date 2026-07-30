"""
Zet alle kaartlagen om naar voorgeprojecteerde SVG-paden op 1920x1080 en
schrijft ze als een JSON-blok dat de redactietool rechtstreeks inbouwt.

Door hier te projecteren hoeft de tool in de browser geen kaartprojectie te
kennen: hij zet alleen paden neer en kleurt ze.
"""
import json, math, sys
sys.path.insert(0, "/home/claude/work")
import build_kaart as B

WATEREN = json.load(open("/home/claude/work/wateren.json"))
CACHE = json.load(open("/home/claude/work/water_cache.json"))
PLAATSEN = json.load(open("/home/claude/work/plaatsen.json"))
LABEL = {
    "Kampen": (-16, 7, "end", "central"), "Zwolle": (20, 10, "start", "central"),
    "Deventer": (-16, 7, "end", "central"), "Rijssen": (-16, 7, "end", "central"),
    "Almelo": (0, -18, "middle", "auto"), "Hengelo": (-16, 7, "end", "central"),
    "Enschede": (0, 30, "middle", "hanging"), "Oldenzaal": (16, 7, "start", "central"),
}


def d_ringen(ringen):
    return "".join("".join(("M" if i == 0 else "L") + "%.1f %.1f" % B.proj(x, y)
                           for i, (x, y) in enumerate(r)) + "Z" for r in ringen)


def d_lijn(pts):
    return "".join(("M" if i == 0 else "L") + "%.1f %.1f" % B.proj(x, y)
                   for i, (x, y) in enumerate(pts))


# ---------------------------------------------------------- labelpunt per gemeente
def afstand_tot_rand(pt, ringen):
    x, y = pt
    best = 1e18
    for r in ringen:
        for i in range(len(r) - 1):
            ax, ay = r[i]; bx, by = r[i + 1]
            dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy
            t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
            d = math.hypot(x - (ax + t * dx), y - (ay + t * dy))
            if d < best:
                best = d
    return best


def binnen(pt, ringen):
    x, y = pt; c = False
    for r in ringen:
        for i in range(len(r) - 1):
            x1, y1 = r[i]; x2, y2 = r[i + 1]
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                c = not c
    return c


def labelpunt(ringen, masker):
    """Punt dat het verst van elke rand ligt (pool of inaccessibility)."""
    xs = [p[0] for r in ringen for p in r]; ys = [p[1] for r in ringen for p in r]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    beste, bestd = None, -1
    stap = max((x1 - x0), (y1 - y0)) / 24
    for _ronde in range(4):
        gx = [x0 + i * stap for i in range(int((x1 - x0) / stap) + 1)]
        gy = [y0 + i * stap for i in range(int((y1 - y0) / stap) + 1)]
        for x in gx:
            for y in gy:
                if not binnen((x, y), ringen):
                    continue
                if masker and not binnen((x, y), masker):
                    continue          # niet in het water labelen
                d = afstand_tot_rand((x, y), ringen)
                if d > bestd:
                    bestd, beste = d, (x, y)
        if beste is None:
            break
        x0, x1 = beste[0] - stap, beste[0] + stap
        y0, y1 = beste[1] - stap, beste[1] + stap
        stap /= 4
    return beste, bestd


def main():
    data = {"breedte": B.W, "hoogte": B.H, "schaal_m_per_px": round(1 / B.S, 1),
            "kleuren": {k: v for k, v in B.KLEUR.items()},
            "context": {
                "land": d_ringen([r for r, _ in B.context_vlakken]),
                "lijnen": d_ringen(B.context_lijnen),
                "masker": d_ringen(B.landmasker),
            },
            "provinciegrens": d_ringen(B.rand_ringen),
            "gemeenten": {}, "wateren": {}, "plaatsen": {}}

    for code in sorted(B.overijssel):
        ringen = B.topo.rings(code)
        pt, afst = labelpunt(ringen, B.landmasker)
        sx, sy = B.proj(*pt)
        data["gemeenten"][code] = {
            "naam": B.meta[code]["naam"], "d": d_ringen(ringen),
            "labelX": round(sx, 1), "labelY": round(sy, 1),
            "ruimte_px": round(afst * B.S, 1),      # hoeveel plaats er is voor tekst
        }

    bron = {}
    for f in CACHE:
        bron.setdefault(f["naam"], []).append(f)
    for label, namen in WATEREN.items():
        v, ln = [], []
        for n in namen:
            for dd in bron.get(n, []):
                v += [d_ringen(r) for r in dd["vlakken"]]
                ln += [d_lijn(l) for l in dd["lijnen"]]
        data["wateren"][label] = {"vlak": "".join(v), "lijn": "".join(ln)}

    for naam, v in PLAATSEN.items():
        x, y = B.proj(v["x"], v["y"])
        dx, dy, ha, va = LABEL[naam]
        data["plaatsen"][naam] = {"x": round(x, 1), "y": round(y, 1),
                                  "dx": dx, "dy": dy, "anchor": ha, "baseline": va,
                                  "hoofdstad": v.get("hoofdstad", False)}

    json.dump(data, open("/home/claude/work/app_data.json", "w"), separators=(",", ":"))
    print("gemeenten:", len(data["gemeenten"]))
    print("wateren  :", len(data["wateren"]))
    print("plaatsen :", len(data["plaatsen"]))
    krap = [(g["naam"], g["ruimte_px"]) for g in data["gemeenten"].values() if g["ruimte_px"] < 26]
    print("\ngemeenten met weinig ruimte voor een label (<26 px tot de rand):")
    for n, r in sorted(krap, key=lambda t: t[1]):
        print("   %-18s %.0f px" % (n, r))
    import os
    print("\napp_data.json: %.0f KB" % (os.path.getsize("/home/claude/work/app_data.json") / 1024))


if __name__ == "__main__":
    main()
