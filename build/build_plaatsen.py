#!/usr/bin/env python3
"""
build_plaatsen.py — TOP10NL objecttype `plaats` omzetten naar schermcoordinaten.

Leest `bron/top10nl_plaats.gml` (Kadaster/PDOK, BRT TOP10NL, objecttype plaats,
gebied Overijssel) en schrijft `data/plaatsen_overijssel.json`: alle kernen,
buurtschappen en wijken van Overijssel met hun positie in hetzelfde
1920x1080-schermassenstelsel als `data/app_data.json`.

--------------------------------------------------------------------------
De transformatie RD (EPSG:28992) -> scherm
--------------------------------------------------------------------------
`app_data.json` bevat al geprojecteerde SVG-paden, maar niet de transformatie
zelf. Die is hier teruggerekend. Het is een zuivere affiene transformatie
(uniforme schaal, y-as gespiegeld, geen rotatie):

    scherm_x =  A * rd_x + B
    scherm_y = -A * rd_y + C

**Schaal A** — de som van de oppervlakten van de 25 gemeentepaden in
`app_data.json` is 331181,2 px2. De gevalideerde oppervlakte van Overijssel is
3420,7 km2 (zie OVERDRACHT-fase3.md). Daaruit volgt 101,6306 m/px, wat exact
overeenkomt met de `schaal_m_per_px: 101.6` in het bestand zelf. Controle: de
zo berekende oppervlakte per gemeente wijkt < 0,1 % af van de CBS-cijfers
(Enschede 142,8 vs 142,75 km2; Zwolle 119,4 vs 119,29; Oldenzaal 22,0 vs 21,98).

**Verschuiving B en C** — niet af te leiden uit de oppervlakte. De acht
plaatspunten in `app_data.json` zijn hiervoor ongeschikt: die zijn volgens de
overdracht "afgeleid, niet officieel" en blijken een systematische afwijking
van circa 7 px (700 m) naar het zuidoosten te hebben. B en C zijn daarom
bepaald op de geometrie zelf, met een eigenschap die voor elke bebouwde kom
geldt: **een bebouwde kom ligt binnen een gemeente en niet over de
gemeentegrens heen.**

Van de 1324 TOP10NL-plaatsen liggen er 818 volledig binnen de provincie; 488
daarvan liggen dicht genoeg bij een gemeentegrens om gevoelig te zijn voor een
verschuiving. De verschuiving die het aandeel plaatsen dat volledig binnen een
enkele gemeente valt maximaliseert, is B = -1261,4 / C = 5463,7. Daarmee stijgt
dat aandeel van 92,5 % naar 97,0 %. Een bootstrap over 12 steekproeven geeft een
spreiding van 0,65 px, dus de uitkomst is ruim significant.

Onafhankelijke controle op de 25 gemeenten met een gelijknamige hoofdkern
(Almelo, Denekamp, Nijverdal, Goor, Hasselt, ...): volledig binnen de eigen
gemeente gaat van 13/25 naar 16/25, en de resterende overschrijdingen krimpen
van -4 tot -12 px naar -0,4 tot -2 px. De enige echte uitschieter die overblijft
is Hengelo (-7,7 px), waar de bebouwde kom feitelijk tegen Borne aan gegroeid is.

--------------------------------------------------------------------------
Bron: Kadaster/PDOK (BRT TOP10NL), CC BY 4.0.
"""

import gzip
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GML = os.path.join(ROOT, "bron", "top10nl_plaats.gml")
APP_DATA = os.path.join(ROOT, "data", "app_data.json")
UIT = os.path.join(ROOT, "data", "plaatsen_overijssel.json")

# Vastgestelde transformatie (zie toelichting bovenaan).
M_PER_PX = 101.63060
A = 1.0 / M_PER_PX
B = -1261.36
C = 5463.68

# Oppervlakte van Overijssel zoals gevalideerd in fase 1/2, in m2.
OPPERVLAKTE_OVERIJSSEL_M2 = 3420.7e6

# Welke TOP10NL-gebiedstypen nemen we mee, en hoe wegen ze in de zoekvolgorde.
# Kernen staan bovenaan, wijken en buurten eronder: een redacteur zoekt meestal
# een dorp of stad, maar moet ook een wijk kunnen aanwijzen.
TYPE_RANG = {
    "woonkern": 0,
    "deelkern": 1,
    "gehucht": 2,
    "buurtschap": 3,
    "industriekern": 4,
    "stadsdeel": 5,
    "wijk": 6,
    "buurt": 7,
}


def lees_gml(pad):
    if os.path.exists(pad):
        with open(pad, encoding="utf-8") as f:
            return f.read()
    if os.path.exists(pad + ".gz"):
        with gzip.open(pad + ".gz", "rt", encoding="utf-8") as f:
            return f.read()
    sys.exit("Bronbestand niet gevonden: %s (of .gz)" % pad)


def subpaden(d):
    """SVG-pad met alleen M/L/Z uit elkaar halen in gesloten ringen."""
    ringen = []
    for deel in d.split("M"):
        deel = deel.strip()
        if not deel:
            continue
        deel = deel.rstrip("Z").rstrip()
        punten = []
        for seg in deel.split("L"):
            seg = seg.strip()
            if not seg:
                continue
            x, y = seg.split()
            punten.append((float(x), float(y)))
        if len(punten) >= 3:
            ringen.append(punten)
    return ringen


def ring_oppervlak(punten):
    opp = 0.0
    n = len(punten)
    for i in range(n):
        x0, y0 = punten[i]
        x1, y1 = punten[(i + 1) % n]
        opp += x0 * y1 - x1 * y0
    return opp / 2.0


def zwaartepunt(ringen):
    """Oppervlakte-gewogen zwaartepunt over alle ringen samen."""
    tot = 0.0
    sx = 0.0
    sy = 0.0
    for punten in ringen:
        opp = 0.0
        cx = 0.0
        cy = 0.0
        n = len(punten)
        for i in range(n):
            x0, y0 = punten[i]
            x1, y1 = punten[(i + 1) % n]
            kruis = x0 * y1 - x1 * y0
            opp += kruis
            cx += (x0 + x1) * kruis
            cy += (y0 + y1) * kruis
        opp /= 2.0
        if abs(opp) < 1e-9:
            continue
        gewicht = abs(opp)
        tot += gewicht
        sx += (cx / (6 * opp)) * gewicht
        sy += (cy / (6 * opp)) * gewicht
    if tot == 0:
        alle = [p for r in ringen for p in r]
        return (sum(p[0] for p in alle) / len(alle), sum(p[1] for p in alle) / len(alle), 0.0)
    return (sx / tot, sy / tot, tot)


def punt_in_ringen(x, y, ringen):
    """Even-odd test over alle ringen samen (gaten tellen dus vanzelf mee)."""
    binnen = False
    for punten in ringen:
        n = len(punten)
        for i in range(n):
            x0, y0 = punten[i]
            x1, y1 = punten[(i + 1) % n]
            if (y0 <= y < y1) or (y1 <= y < y0):
                xs = x0 + (y - y0) * (x1 - x0) / (y1 - y0)
                if x < xs:
                    binnen = not binnen
    return binnen


def controleer_schaal(app):
    """De schaal opnieuw afleiden uit de oppervlakte en vergelijken."""
    totaal = 0.0
    for gem in app["gemeenten"].values():
        totaal += abs(sum(ring_oppervlak(r) for r in subpaden(gem["d"])))
    afgeleid = math.sqrt(OPPERVLAKTE_OVERIJSSEL_M2 / totaal)
    if abs(afgeleid - M_PER_PX) > 0.01:
        sys.exit(
            "Schaal wijkt af: afgeleid %.4f m/px, vastgelegd %.4f m/px.\n"
            "Is app_data.json vervangen? Herzie de transformatie." % (afgeleid, M_PER_PX)
        )
    return totaal, afgeleid


def bepaal_hiaat(tekst, app):
    """Controleren of het bronbestand heel Overijssel dekt.

    De download uit de PDOK-viewer gaat per rechthoek. Dekt die rechthoek de
    provincie niet volledig, dan ontbreken er kernen in de autocomplete zonder
    dat dat ergens zichtbaar is. Die controle hoort in de pijplijn, niet in het
    hoofd van de volgende redacteur.
    """
    xs, ys = [], []
    for lijst in re.findall(r"<gml:posList>(.*?)</gml:posList>", tekst, re.S):
        getallen = [float(v) for v in lijst.split()]
        xs.extend(getallen[0::2])
        ys.extend(getallen[1::2])
    if not xs:
        return ""
    dek = {
        "x0": A * min(xs) + B, "x1": A * max(xs) + B,
        "y0": -A * max(ys) + C, "y1": -A * min(ys) + C,
    }

    punten = [p for ring in subpaden(app["provinciegrens"]) for p in ring]
    prov = {
        "x0": min(p[0] for p in punten), "x1": max(p[0] for p in punten),
        "y0": min(p[1] for p in punten), "y1": max(p[1] for p in punten),
    }

    tekorten = []
    for zijde, px in (
        ("noorden", dek["y0"] - prov["y0"]),
        ("zuiden", prov["y1"] - dek["y1"]),
        ("westen", dek["x0"] - prov["x0"]),
        ("oosten", prov["x1"] - dek["x1"]),
    ):
        # onder een halve kilometer is het ruis: daar liggen simpelweg geen kernen
        if px * M_PER_PX / 1000 > 0.5:
            tekorten.append("%s %.0f km" % (zijde, px * M_PER_PX / 1000))
    if not tekorten:
        return ""

    geraakt = []
    for gem in app["gemeenten"].values():
        punten = [p for ring in subpaden(gem["d"]) for p in ring]
        if (min(p[1] for p in punten) < dek["y0"] or max(p[1] for p in punten) > dek["y1"]
                or min(p[0] for p in punten) < dek["x0"] or max(p[0] for p in punten) > dek["x1"]):
            geraakt.append(gem["naam"])

    return (
        "Het bronbestand TOP10NL-plaats dekt de provincie niet volledig: in het "
        + ", ".join(tekorten)
        + " valt een strook buiten de download"
        + (" (gemeente " + ", ".join(sorted(geraakt)) + ")" if geraakt else "")
        + ". Kernen daar ontbreken in de zoeklijst; punten plaatsen door in de kaart "
        + "te klikken werkt er wel gewoon. Op te lossen door TOP10NL objecttype plaats "
        + "opnieuw te downloaden met een rechthoek die heel Overijssel omsluit."
    )


def main():
    app = json.load(open(APP_DATA, encoding="utf-8"))
    opp_px2, afgeleid = controleer_schaal(app)
    print("Gemeentevlakken samen: %.1f px2 -> %.4f m/px (vastgelegd %.4f)" % (opp_px2, afgeleid, M_PER_PX))

    gemeenten = {}
    for code, gem in app["gemeenten"].items():
        gemeenten[gem["naam"]] = subpaden(gem["d"])

    tekst = lees_gml(GML)
    kenmerken = re.findall(r"<top10nl:Plaats\b.*?</top10nl:Plaats>", tekst, re.S)
    print("TOP10NL-plaatsen in bronbestand: %d" % len(kenmerken))

    uit = []
    buiten = 0
    for blok in kenmerken:
        def veld(naam):
            m = re.search(r"<top10nl:%s>(.*?)</top10nl:%s>" % (naam, naam), blok, re.S)
            return m.group(1).strip() if m else None

        naam = veld("naamNL")
        soort = veld("typeGebied")
        if naam is None or soort not in TYPE_RANG:
            continue

        ringen = []
        for lijst in re.findall(r"<gml:posList>(.*?)</gml:posList>", blok, re.S):
            getallen = [float(v) for v in lijst.split()]
            ringen.append(list(zip(getallen[0::2], getallen[1::2])))
        if not ringen:
            continue

        rd_x, rd_y, opp_m2 = zwaartepunt(ringen)
        x = A * rd_x + B
        y = -A * rd_y + C

        gemeente = None
        for gnaam, gringen in gemeenten.items():
            if punt_in_ringen(x, y, gringen):
                gemeente = gnaam
                break
        if gemeente is None:
            buiten += 1
            continue

        inwoners = veld("aantalinwoners")
        uit.append(
            {
                "naam": naam,
                "soort": soort,
                "gemeente": gemeente,
                "x": round(x, 1),
                "y": round(y, 1),
                "inwoners": int(inwoners) if inwoners and inwoners.isdigit() else 0,
                "opp_ha": round(opp_m2 / 1e4, 1),
            }
        )

    uit.sort(key=lambda p: (TYPE_RANG[p["soort"]], -p["inwoners"], p["naam"]))
    print("Binnen Overijssel: %d   buiten de provincie (overgeslagen): %d" % (len(uit), buiten))

    telling = {}
    for p in uit:
        telling[p["soort"]] = telling.get(p["soort"], 0) + 1
    for soort in sorted(telling, key=lambda s: TYPE_RANG[s]):
        print("   %-14s %4d" % (soort, telling[soort]))

    hiaat = bepaal_hiaat(tekst, app)
    if hiaat:
        print("\nLET OP: " + hiaat)

    doel = {
        "bron": "Kadaster/PDOK, BRT TOP10NL objecttype plaats",
        "licentie": "CC BY 4.0",
        "transformatie": {"a": A, "b": B, "c": C, "m_per_px": M_PER_PX},
        "hiaat": hiaat,
        "plaatsen": uit,
    }
    with open(UIT, "w", encoding="utf-8") as f:
        json.dump(doel, f, ensure_ascii=False, separators=(",", ":"))
    print("Geschreven: %s (%.0f KB)" % (UIT, os.path.getsize(UIT) / 1024))


if __name__ == "__main__":
    main()
