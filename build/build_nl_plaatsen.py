"""
Bouwt de Nederlandse plaatsenlijst: data/plaatsen_nederland.json.

Waarvoor
--------
Twee dingen die de Overijsselkaart al had en de Nederlandkaart niet:

  1. De twaalf provinciehoofdsteden als punten op de basiskaart.
  2. Zoeken op plaatsnaam in de puntlaag. Tot nu toe kwam die lijst uit
     TOP10NL en ging hij alleen over Overijssel; op de Nederlandkaart vond je
     dus geen Utrecht en geen Maastricht.

De bron
-------
GeoNames Gazetteer (CC BY 4.0), zoals herverpakt in het npm-pakket
`cities.json` (ook CC BY 4.0). Zie bron/geonames-LICENSE. Alleen de
Nederlandse rijen zijn overgenomen, in bron/geonames-plaatsen-nl.json.
Bijwerken: `npm pack cities.json`, de NL-rijen eruit, dit script draaien.

Bronvermelding is verplicht. De tool zet GeoNames daarom vanzelf in de
bronregel zodra deze punten op de kaart staan.

Nauwkeurigheid
--------------
GeoNames geeft één punt per plaats, meestal het centrum. Onderaan controleert
dit script dat tegen TOP10NL, dat we voor Overijssel al hebben: voor elke
Overijsselse kern die in beide bestanden staat wordt het verschil gemeten. Zo
weet je of de projectie klopt en hoe ver de twee bronnen uiteenlopen. Bij een
verschil groter dan MAX_VERSCHIL_M stopt het script.

Waarom TOP10NL de baas blijft
-----------------------------
Voor Overijssel is TOP10NL preciezer en heeft het inwonertallen, die de
kaart gebruikt om plaatsnamen te schalen. GeoNames vult alleen de rest van
Nederland aan. Waar beide een plaats kennen, wint TOP10NL — dat regelt de app.

Uitvoer: data/plaatsen_nederland.json, ingebed door build_app.py.
"""
import json, os, sys

try:
    from pyproj import Transformer
except ImportError:
    sys.exit("pyproj is nodig: pip install pyproj")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRON = os.path.join(ROOT, "bron", "geonames-plaatsen-nl.json")
OVERIJSSEL = os.path.join(ROOT, "data", "plaatsen_overijssel.json")
NEDERLAND = os.path.join(ROOT, "data", "nederland.json")
UIT = os.path.join(ROOT, "data", "plaatsen_nederland.json")

# Dezelfde transformatie als build_plaatsen.py; de afleiding staat daar.
M_PER_PX = 101.63060
A = 1.0 / M_PER_PX
B = -1261.36
C = 5463.68

# GeoNames noemt de provincies in het Engels; de kaart in het Nederlands.
PROVINCIENAAM = {
    "South Holland": "Zuid-Holland",
    "North Holland": "Noord-Holland",
    "North Brabant": "Noord-Brabant",
    "Friesland": "Fryslân"
}

# De twaalf provinciehoofdsteden. Niet af te leiden uit de data — GeoNames zegt
# niet welke plaats hoofdstad is — dus hier vastgelegd. 's-Gravenhage heet bij
# GeoNames "The Hague"; op de kaart schrijven we Den Haag.
HOOFDSTEDEN = [
    ("Drenthe",       "Assen",            None),
    ("Fryslân",       "Leeuwarden",       None),
    ("Flevoland",     "Lelystad",         None),
    ("Gelderland",    "Arnhem",           None),
    ("Groningen",     "Groningen",        None),
    ("Limburg",       "Maastricht",       None),
    ("Noord-Brabant", "'s-Hertogenbosch", None),
    ("Noord-Holland", "Haarlem",          None),
    ("Overijssel",    "Zwolle",           None),
    ("Utrecht",       "Utrecht",          None),
    ("Zeeland",       "Middelburg",       None),
    ("Zuid-Holland",  "The Hague",        "Den Haag")
]

# Hoe ver GeoNames en TOP10NL maximaal uiteen mogen liggen. Twee bronnen die
# allebei "het centrum" van een plaats aanwijzen, mogen best een paar honderd
# meter schelen; loopt het verder uiteen, dan klopt er iets niet.
MAX_VERSCHIL_M = 2500.0


def naar_px(lat, lon, naar_rd):
    x, y = naar_rd(lon, lat)
    return round(A * x + B, 1), round(-A * y + C, 1)


def main():
    if not os.path.exists(BRON):
        sys.exit("Ontbreekt: %s\nMaken met: npm pack cities.json, dan de NL-rijen eruit." % BRON)

    ruw = json.load(open(BRON, encoding="utf-8"))
    provincies = {code: PROVINCIENAAM.get(naam, naam)
                  for code, naam in ruw["provincies_admin1"].items()}
    naar_rd = Transformer.from_crs("EPSG:4326", "EPSG:28992", always_xy=True).transform

    plaatsen = []
    for p in ruw["plaatsen"]:
        x, y = naar_px(p["lat"], p["lon"], naar_rd)
        plaatsen.append({"naam": p["naam"], "x": x, "y": y,
                         "provincie": provincies.get(p["admin1"], "")})

    # ---------------------------------------------------- hoofdsteden erbij
    op_naam = {}
    for p in plaatsen:
        op_naam.setdefault((p["provincie"], p["naam"]), p)

    hoofdsteden = []
    for prov, geonaam, toon in HOOFDSTEDEN:
        p = op_naam.get((prov, geonaam))
        if not p:
            sys.exit("Hoofdstad niet gevonden in de bron: %s (%s)" % (geonaam, prov))
        hoofdsteden.append({"naam": toon or geonaam, "x": p["x"], "y": p["y"], "provincie": prov})
        if toon:
            p["naam"] = toon                    # ook in de zoeklijst onder de Nederlandse naam

    # ----------------------------------------------- controle op de projectie
    # TOP10NL kent Overijssel al. Waar beide bronnen dezelfde kern kennen, moet
    # het punt op vrijwel dezelfde plek uitkomen.
    top10 = json.load(open(OVERIJSSEL, encoding="utf-8"))
    kernen = {}
    for p in top10["plaatsen"]:
        if p.get("soort") == "woonkern":
            eerder = kernen.get(p["naam"])
            if not eerder or p.get("inwoners", 0) > eerder.get("inwoners", 0):
                kernen[p["naam"]] = p

    verschillen = []
    for p in plaatsen:
        if p["provincie"] != "Overijssel":
            continue
        t = kernen.get(p["naam"])
        if not t:
            continue
        d = ((p["x"] - t["x"]) ** 2 + (p["y"] - t["y"]) ** 2) ** 0.5 * M_PER_PX
        verschillen.append((d, p["naam"]))
    if not verschillen:
        sys.exit("Geen enkele Overijsselse kern in beide bronnen — klopt de projectie nog?")
    verschillen.sort()
    mediaan = verschillen[len(verschillen) // 2][0]
    ergste, waar = verschillen[-1]
    print("controle tegen TOP10NL: %d gemeenschappelijke kernen, mediaan %.0f m, "
          "grootste %.0f m (%s)" % (len(verschillen), mediaan, ergste, waar))
    if ergste > MAX_VERSCHIL_M:
        sys.exit("Te groot verschil met TOP10NL (%.0f m bij %s). Klopt de transformatie nog?"
                 % (ergste, waar))

    # ------------------------------------------- controle: binnen de provincie
    # Grof, maar het vangt een omgekeerde projectie: elk punt moet binnen de
    # omhullende van Nederland vallen.
    bb = json.load(open(NEDERLAND, encoding="utf-8"))["bbox"]
    buiten = [p["naam"] for p in plaatsen
              if not (bb["x"] <= p["x"] <= bb["x"] + bb["b"] and bb["y"] <= p["y"] <= bb["y"] + bb["h"])]
    if buiten:
        sys.exit("%d plaatsen vallen buiten de omhullende van Nederland, o.a. %s"
                 % (len(buiten), ", ".join(buiten[:5])))

    plaatsen.sort(key=lambda p: p["naam"])
    json.dump({
        "bron": ruw["bron"],
        "licentie": ruw["licentie"],
        "vermelding": "GeoNames",
        "transformatie": {"a": A, "b": B, "c": C, "m_per_px": M_PER_PX},
        "hoofdsteden": hoofdsteden,
        "plaatsen": plaatsen
    }, open(UIT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("Geschreven: %s (%d plaatsen, %d hoofdsteden, %d KB)"
          % (UIT, len(plaatsen), len(hoofdsteden), os.path.getsize(UIT) // 1024))


if __name__ == "__main__":
    main()
