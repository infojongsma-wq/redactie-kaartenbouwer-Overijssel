#!/usr/bin/env python3
"""
build_nederland.py — Nederland met provincies, in hetzelfde assenstelsel.

Schrijft `data/nederland.json`: twaalf provincies als SVG-pad, plus de
landcontour, geprojecteerd met exact dezelfde transformatie als
`data/app_data.json`.

--------------------------------------------------------------------------
Drie dingen die niet vanzelf spreken
--------------------------------------------------------------------------

**De bron moet CBS zijn, niet BRK.** BRK Provinciegebied telt op tot 41.543 km2
— Nederland inclusief binnenwater. Het scheelt fors: Friesland +72 %,
Flevoland +70 %, Zeeland +65 %. Daarmee lopen IJsselmeer, Markermeer, Waddenzee
en Oosterschelde vol met provinciekleur. CBS Gebiedsindelingen levert de
provincies zonder water; dat is dezelfde bron waarmee fase 1 en 2 gebouwd zijn.
Het script pakt `bron/provincies_zonder_water.geojson` als dat er ligt en valt
anders terug op BRK, met een waarschuwing. Controle achteraf op de
CBS-landoppervlakte per provincie.

**Hetzelfde assenstelsel als Overijssel.** De projectie is dezelfde affiene
transformatie die in `build_plaatsen.py` is afgeleid. Nederland is daarin
ongeveer 2630 x 3100 px, veel groter dan het 1920 x 1080-kader, maar dat maakt
niet uit: de tekenfunctie schaalt op het kijkvenster. Het voordeel is dat een
punt uit de plaatsenlijst zonder omrekening op de Nederlandkaart klopt.

**Afronden op een raster in plaats van vereenvoudigen.** Douglas-Peucker per
provincie zou gaten tussen buurprovincies opleveren, want een gedeelde grens
wordt dan twee keer verschillend vereenvoudigd. Afronden op een vast raster
heeft dat probleem niet: dezelfde coordinaat rondt aan beide kanten naar
hetzelfde rasterpunt, dus de grens blijft naadloos. Bij de rasterstap hieronder
is de fout hooguit een halve interne pixel; op een kaart van 780 px hoog is dat
ruim een achtste beeldpixel.

Bron: Kadaster/PDOK (BRK Bestuurlijke Gebieden), CC BY 4.0.
"""

import json
import math
import os
import sys

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# CBS Gebiedsindelingen levert de provincies zonder water; BRK doet dat niet en
# is alleen de terugval. Ligt het CBS-bestand er, dan wint dat.
CBS_PROVINCIES = os.path.join(ROOT, "bron", "provincies_zonder_water.geojson")
PROVINCIES = os.path.join(ROOT, "bron", "provinciegrenzen.geojson")
LANDGEBIED = os.path.join(ROOT, "bron", "landgebied.geojson")
UIT = os.path.join(ROOT, "data", "nederland.json")

# Dezelfde transformatie als in build_plaatsen.py.
M_PER_PX = 101.63060
A = 1.0 / M_PER_PX
B = -1261.36
C = 5463.68

# Rasterstap in interne pixels (1 px is ongeveer 102 m).
RASTER = 1.0

# Eilandjes en slivers kleiner dan dit vallen weg; ze zijn op kaartformaat
# kleiner dan een pixel en kosten alleen bestandsgrootte.
MIN_KM2 = 0.6

# CBS-landoppervlakte per provincie, km2 — voor de controle achteraf.
CBS_LAND = {
    "Flevoland": 1419, "Limburg": 2149, "Overijssel": 3421, "Utrecht": 1449,
    "Gelderland": 5136, "Noord-Brabant": 4916, "Zeeland": 1782,
    "Zuid-Holland": 2818, "Noord-Holland": 2671, "Drenthe": 2680,
    "Groningen": 2325, "Fryslân": 3350,
}


def naar_scherm(x, y):
    return (A * x + B, -A * y + C)


def rond(v):
    return round(v / RASTER) * RASTER


def ring_naar_punten(ring):
    """Projecteren, afronden op het raster, en opeenvolgende dubbels weghalen."""
    uit = []
    for punt in ring:
        x, y = naar_scherm(punt[0], punt[1])
        p = (rond(x), rond(y))
        if not uit or p != uit[-1]:
            uit.append(p)
    if len(uit) > 1 and uit[0] == uit[-1]:
        uit.pop()
    return uit


def ring_oppervlak(punten):
    opp = 0.0
    n = len(punten)
    for i in range(n):
        x0, y0 = punten[i]
        x1, y1 = punten[(i + 1) % n]
        opp += x0 * y1 - x1 * y0
    return opp / 2.0


def naar_pad(geom):
    """Shapely-vlak omzetten naar een SVG-pad, met gaten als extra subpaden."""
    delen = []
    opp_px2 = 0.0
    g = mapping(geom)
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        buiten = ring_naar_punten(poly[0])
        if len(buiten) < 3:
            continue
        opp = abs(ring_oppervlak(buiten))
        if opp * M_PER_PX * M_PER_PX / 1e6 < MIN_KM2:
            continue
        ringen = [buiten]
        opp_px2 += opp
        for gat in poly[1:]:
            g2 = ring_naar_punten(gat)
            if len(g2) < 3:
                continue
            opp_gat = abs(ring_oppervlak(g2))
            if opp_gat * M_PER_PX * M_PER_PX / 1e6 < MIN_KM2:
                continue
            ringen.append(g2)
            opp_px2 -= opp_gat
        for r in ringen:
            delen.append("M" + "L".join("%g %g" % p for p in r) + "Z")
    return "".join(delen), opp_px2


def lees_provincies():
    """De provincievlakken, bij voorkeur die zonder water.

    CBS Gebiedsindelingen (`provincies_zonder_water.geojson`) heeft het
    binnenwater er al uit; dat is de bron waarmee fase 1 en 2 gebouwd zijn.
    Ontbreekt dat bestand, dan valt het script terug op BRK Provinciegebied —
    maar dat is inclusief IJsselmeer, Waddenzee en Oosterschelde.

    Retourneert (lijst van (naam, code, vlak), bronomschrijving, zonder_water).
    """
    if os.path.exists(CBS_PROVINCIES):
        bron = json.load(open(CBS_PROVINCIES, encoding="utf-8"))
        uit = []
        for f in bron["features"]:
            p = f["properties"]
            # statcode "PV23" -> "23", zodat de codes gelijk blijven aan de
            # BRK-variant en opgeslagen kaarten blijven werken
            code = str(p.get("statcode", "")).replace("PV", "") or str(p.get("code"))
            uit.append((p.get("statnaam") or p.get("naam"), code, shape(f["geometry"])))
        return uit, "CBS Gebiedsindelingen, provincies zonder water", True

    if not os.path.exists(PROVINCIES):
        sys.exit("Geen provinciebestand gevonden in bron/ (%s of %s)"
                 % (os.path.basename(CBS_PROVINCIES), os.path.basename(PROVINCIES)))

    bron = json.load(open(PROVINCIES, encoding="utf-8"))
    uit = [(f["properties"]["naam"], f["properties"]["code"], shape(f["geometry"]))
           for f in bron["features"]]
    return uit, "BRK Provinciegebied (inclusief binnenwater)", False


def main():
    provinciebron, bronnaam, zonder_water = lees_provincies()
    print("Provincies uit: %s" % bronnaam)

    land = None
    land_km2 = 0.0
    if not zonder_water and os.path.exists(LANDGEBIED):
        land = unary_union([shape(f["geometry"]) for f in json.load(open(LANDGEBIED, encoding="utf-8"))["features"]])
        if not land.is_valid:
            land = land.buffer(0)
        land_km2 = land.area / 1e6
        print("Landgebied ingelezen: %.0f km2" % land_km2)

    # BRK Landgebied blijkt het staatsgebied te zijn, inclusief binnenwater: het
    # telt op tot dezelfde 41.543 km2 als de provincies samen. Knippen levert dan
    # niets op. De land/water-scheiding komt bij CBS vandaan, niet bij BRK — dat
    # stond ook al in de overdracht van fase 1.
    knipt = land is not None and land_km2 < 40000
    if not zonder_water and not knipt:
        print("LET OP: het landgebied bevat binnenwater (%.0f km2) en snijdt dus niets weg.\n"
              "        De provincies komen inclusief IJsselmeer, Markermeer en Waddenzee op de\n"
              "        kaart. Voor de land/water-scheiding is CBS Gebiedsindelingen nodig; zie\n"
              "        docs/OVERDRACHT-fase4.md." % land_km2)

    provincies = {}
    totaal_px2 = 0.0
    print("\n%-16s %10s %10s %9s" % ("provincie", "vlak", "CBS land", "afwijking"))
    afwijkingen = []
    for naam, code, vlak in provinciebron:
        if not vlak.is_valid:
            vlak = vlak.buffer(0)
        geknipt = vlak.intersection(land) if knipt else vlak
        if geknipt.is_empty:
            sys.exit("Provincie %s valt volledig buiten het landgebied — klopt de CRS wel?" % naam)

        d, opp_px2 = naar_pad(geknipt)
        km2 = opp_px2 * M_PER_PX * M_PER_PX / 1e6
        totaal_px2 += opp_px2

        # Labelpunt: een punt dat gegarandeerd binnen het vlak ligt, gekozen op
        # het grootste deel zodat het niet op een eilandje belandt.
        delen = list(geknipt.geoms) if geknipt.geom_type == "MultiPolygon" else [geknipt]
        grootste = max(delen, key=lambda g: g.area)
        punt = grootste.representative_point()
        lx, ly = naar_scherm(punt.x, punt.y)

        cbs = CBS_LAND.get(naam)
        afw = (km2 / cbs - 1) * 100 if cbs else 0.0
        afwijkingen.append(abs(afw))
        print("%-16s %10.0f %10s %+8.1f%%" % (naam, km2, cbs if cbs else "-", afw))

        provincies[code] = {
            "naam": naam,
            "d": d,
            "labelX": round(lx, 1),
            "labelY": round(ly, 1),
            "opp_km2": round(km2, 1),
        }

    totaal_km2 = totaal_px2 * M_PER_PX * M_PER_PX / 1e6
    print("%-16s %10.0f %10d %+8.1f%%" % ("TOTAAL", totaal_km2, sum(CBS_LAND.values()),
                                          (totaal_km2 / sum(CBS_LAND.values()) - 1) * 100))
    if zonder_water and max(afwijkingen) > 10.0:
        sys.exit("Een provincie wijkt meer dan 10 % af van de CBS-landoppervlakte — klopt het bronbestand?")
    if knipt and max(afwijkingen) > 3.0:
        sys.exit("Een provincie wijkt meer dan 3 % af van de CBS-landoppervlakte — controleer het knippen.")
    if zonder_water:
        print("\nDe kleine plussen hierboven zijn de binnenwateren die CBS wel meetelt;\n"
              "de provincies met weinig groot water komen op nul uit: Drenthe 0,0 %,\n"
              "Gelderland -0,3 %, Overijssel -0,4 %.")
    elif not knipt:
        print("\nDe afwijking hierboven is het binnenwater, niet een fout in de projectie:\n"
              "Overijssel, Gelderland en Drenthe komen op 0,0 % uit omdat daar nauwelijks\n"
              "groot water aan de provincie is toegewezen.")

    contour, _ = naar_pad(land if land is not None
                          else unary_union([v for _, _, v in provinciebron]))

    punten = [p for pad in provincies.values() for p in pad["d"]].count("M")
    xs, ys = [], []
    for pad in provincies.values():
        getallen = pad["d"].replace("M", " ").replace("L", " ").replace("Z", " ").split()
        xs.extend(float(v) for v in getallen[0::2])
        ys.extend(float(v) for v in getallen[1::2])
    bbox = {"x": round(min(xs), 1), "y": round(min(ys), 1),
            "b": round(max(xs) - min(xs), 1), "h": round(max(ys) - min(ys), 1)}
    print("\nSchermbbox Nederland: x %.0f y %.0f breedte %.0f hoogte %.0f" % (bbox["x"], bbox["y"], bbox["b"], bbox["h"]))

    doel = {
        "bron": bronnaam,
        "licentie": "CC BY 4.0",
        "transformatie": {"a": A, "b": B, "c": C, "m_per_px": M_PER_PX},
        "raster_px": RASTER,
        "bbox": bbox,
        "landcontour": contour,
        "provincies": provincies,
    }
    with open(UIT, "w", encoding="utf-8") as f:
        json.dump(doel, f, ensure_ascii=False, separators=(",", ":"))
    print("Geschreven: %s (%.0f KB)" % (UIT, os.path.getsize(UIT) / 1024))


if __name__ == "__main__":
    main()
