"""
Bouwt de buitenlandlaag: Duitsland en Belgie als land achter de Overijsselkaart.

Het gat dat dit dicht
---------------------
De contextlaag komt uit CBS Gebiedsindelingen en houdt op bij de landsgrens.
Alles daarbuiten viel terug op de waterkleur, dus het gebied ten oosten van
Twente werd blauw water. Op de gewone kaart is dat een strook van ongeveer
26 px; op de beeldvullende tv-kaart beslaat het een kwart van het beeld.

De bron
-------
Natural Earth 1:10m Admin 0 (public domain), zoals herverpakt als TopoJSON in
het npm-pakket `world-atlas` (ISC). Zie bron/world-atlas-LICENSE. Natural Earth
vraagt geen bronvermelding; de regel "Bron: Kadaster/PDOK" in de tool blijft
gaan over de Nederlandse kaartdata, die wel CC BY 4.0 is.

Waarom 1:10m goed genoeg is
---------------------------
Natural Earth is generalisatie op wereldschaal: de Duitse westgrens ligt tot
ruim 1 km naast de Nederlandse oostgrens uit de BRK (gemeten: gemiddeld 97 m,
maximaal 1077 m langs de oostrand van Overijssel). Dat is op deze kaart 10 px
en dus zichtbaar — als je het de naad laat zijn.

Dat gebeurt hier niet. De buitenlandvorm wordt met BUFFER meters opgeblazen en
als onderste laag getekend; de Nederlandse contextlaag en de gemeenten komen er
overheen. De zichtbare naad is daarmee de Nederlandse grens uit de BRK, precies
zoals eerst, en de onnauwkeurigheid van Natural Earth zit onder Nederland waar
niemand hem ziet. Wat er wel van te zien is, is de buitenrand ver van de
provincie: daar valt generalisatie niet op.

Onderaan controleert het script of dat overlappen ook echt overal lukt: geen
enkel punt van de Nederlandse landsgrens met Duitsland of Belgie mag buiten de
opgeblazen vorm vallen. Zo niet, dan stopt het script.

Uitvoer: data/buitenland.json (SVG-pad in hetzelfde assenstelsel als
app_data.json), ingebed door build_app.py.
"""
import json, os, sys

try:
    from pyproj import Transformer
    from shapely.geometry import shape, Polygon, MultiPolygon, box
    from shapely.ops import unary_union, transform as shp_transform
except ImportError:
    sys.exit("pyproj en shapely zijn nodig: pip install pyproj shapely")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRON = os.path.join(ROOT, "bron")
UIT = os.path.join(ROOT, "data", "buitenland.json")

# Dezelfde transformatie als build_plaatsen.py; de afleiding staat daar.
M_PER_PX = 101.63060
A = 1.0 / M_PER_PX
B = -1261.36
C = 5463.68

LANDEN = ["Germany", "Belgium"]
# Nederland zelf wordt niet getekend, maar is nodig voor de naadcontrole.
CONTROLE_LAND = "Netherlands"

# Opblazen tot voorbij de Nederlandse grens, en daarna weer terugsnijden tot
# SCHIL meter binnen die grens. Het opblazen overbrugt de afwijking van Natural
# Earth (gemeten maximaal 1077 m); het terugsnijden houdt het buitenland weg bij
# het Nederlandse binnenwater, waar het anders onder een rivier of plas door zou
# schemeren.
BUFFER = 4000.0

# Hoe ver het buitenland onder Nederland doorloopt. De rand van de contextlaag
# ligt niet precies op de landsgrens uit de BRK — CBS generaliseert, en fase 2
# vereenvoudigt daarna nog eens met 80 m tolerantie. Gemeten langs de oostkant
# van het beeld is dat verschil mediaan 0,9 px en maximaal 7,1 px (720 m). SCHIL
# moet daaroverheen, anders komt er alsnog een streepje water tussen.
SCHIL = 1500.0
NL_TOLERANTIE = 250.0

# Vereenvoudiging in meters, toegepast voor het opblazen zodat de fout van de
# vereenvoudiging ook onder de buffer valt.
TOLERANTIE = 120.0

# Hoe ver buiten de provincie de kaart ooit te zien is. De kale kaart legt de
# provincie op 90 % van de beeldhoogte, waardoor er zo'n 1580 x 889 px in beeld
# past rond een provincie van 864 x 800 px. 700 px (71 km) dekt dat met marge.
VENSTER_PX = 700

# Land, maar verder weg: donkerder dan de omliggende provincies (#4A85FF) en
# lichter dan het water (#1361FF).
KLEUR = "#3C7AFF"


def lees_topojson(pad):
    """Natural Earth als TopoJSON: gekwantiseerde, delta-gecodeerde bogen."""
    topo = json.load(open(pad))
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    bogen = []
    for boog in topo["arcs"]:
        x = y = 0
        punten = []
        for dx, dy in boog:
            x += dx
            y += dy
            punten.append((x * sx + tx, y * sy + ty))
        bogen.append(punten)

    def ring(indexen):
        punten = []
        for i in indexen:
            # negatieve index betekent: deze boog achterstevoren
            boog = bogen[~i][::-1] if i < 0 else bogen[i]
            punten.extend(boog if not punten else boog[1:])
        return punten

    def veelhoek(arcs):
        # Natural Earth heeft een paar eilandjes die na kwantisering tot een
        # lijn inklappen; die kan shapely niet aan en zijn hier ook niet nodig.
        buiten = ring(arcs[0])
        if len(buiten) < 4:
            return None
        binnen = [r for r in (ring(a) for a in arcs[1:]) if len(r) >= 4]
        return Polygon(buiten, binnen)

    uit = {}
    for g in topo["objects"]["countries"]["geometries"]:
        naam = g["properties"]["name"]
        if naam not in LANDEN and naam != CONTROLE_LAND:
            continue
        delen = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        # buffer(0) haalt de zelfdoorsnijdingen eruit die in de bron zitten;
        # zonder dat struikelt de vereniging op de Duits-Luxemburgse hoek.
        vormen = [v.buffer(0) for v in (veelhoek(d) for d in delen) if v is not None]
        uit[naam] = unary_union(vormen)
    return uit


def ringen(vorm):
    if vorm.is_empty:
        return []
    delen = vorm.geoms if vorm.geom_type == "MultiPolygon" else [vorm]
    uit = []
    for deel in delen:
        uit.append(list(deel.exterior.coords))
        uit.extend(list(r.coords) for r in deel.interiors)
    return uit


def pad_van(ringen_lijst):
    stukken = []
    for r in ringen_lijst:
        punten = [(A * x + B, -A * y + C) for x, y in r]
        if punten[0] == punten[-1]:
            punten = punten[:-1]
        if len(punten) < 3:
            continue
        stukken.append("".join(("M" if i == 0 else "L") + "%.1f %.1f" % p
                               for i, p in enumerate(punten)) + "Z")
    return "".join(stukken)


def main():
    kaart = os.path.join(BRON, "world-atlas-countries-10m.json")
    if not os.path.exists(kaart):
        sys.exit("Ontbreekt: %s\nHaal het op met: npm pack world-atlas@2" % kaart)

    landen = lees_topojson(kaart)
    ontbreekt = [n for n in LANDEN if n not in landen]
    if ontbreekt:
        sys.exit("Niet gevonden in de bron: %s" % ", ".join(ontbreekt))

    naar_rd = Transformer.from_crs("EPSG:4326", "EPSG:28992", always_xy=True).transform
    ruw = unary_union([shp_transform(naar_rd, landen[n]) for n in LANDEN])
    print("%s: %.0f km2 in RD New" % (" + ".join(LANDEN), ruw.area / 1e6))

    # Het venster: de provincie plus de marge die de kale kaart kan tonen.
    prov = unary_union([shape(f["geometry"])
                        for f in json.load(open(os.path.join(BRON, "provincies_zonder_water.geojson")))["features"]
                        if f["properties"].get("statnaam") == "Overijssel"])
    x0, y0, x1, y1 = prov.bounds
    marge = VENSTER_PX * M_PER_PX
    venster = box(x0 - marge, y0 - marge, x1 + marge, y1 + marge)
    print("venster: %.0f x %.0f km rond Overijssel" %
          ((x1 - x0 + 2 * marge) / 1000, (y1 - y0 + 2 * marge) / 1000))

    land = unary_union([shape(f["geometry"])
                        for f in json.load(open(os.path.join(BRON, "landgebied.geojson")))["features"]])
    nl_krimp = land.simplify(NL_TOLERANTIE, preserve_topology=True).buffer(-SCHIL)

    # Eerst vereenvoudigen, dan opblazen: de fout van het vereenvoudigen valt
    # daarmee ook binnen de buffer.
    opgeblazen = ruw.simplify(TOLERANTIE, preserve_topology=True).buffer(BUFFER)
    vorm = opgeblazen.difference(nl_krimp).intersection(venster)
    if vorm.is_empty:
        sys.exit("Geen buitenland in het venster — klopt de projectie nog?")

    # -------------------------------------------------- controle op de naad
    # Waar Nederland aan Duitsland of Belgie grenst mag er geen water tussen
    # staan. Waar het aan zee grenst juist wel — de Eemsmonding is water aan
    # beide kanten. Natural Earth wijst zelf aan welke van de twee het is: daar
    # waar zijn Nederland en zijn Duitsland elkaar raken, ligt een landsgrens.
    if CONTROLE_LAND not in landen:
        sys.exit("%s ontbreekt in de bron; de naadcontrole kan niet draaien." % CONTROLE_LAND)
    nl_ne = shp_transform(naar_rd, landen[CONTROLE_LAND])
    landsgrens = nl_ne.boundary.intersection(ruw.buffer(250)).intersection(venster)
    if landsgrens.is_empty:
        sys.exit("Geen landsgrens gevonden in het venster — klopt de projectie nog?")

    stappen = 4000
    # De binnenrand wordt tegen de opgeblazen vorm gehouden en niet tegen het
    # eindresultaat: daar is hij juist weggesneden, dus de afstand zou nul zijn
    # zonder iets te bewijzen.
    for wat, rand, doel in (("landsgrens (BRK)", land.boundary.intersection(venster), vorm),
                            ("binnenrand op %.0f m" % SCHIL, nl_krimp.boundary.intersection(venster), opgeblazen)):
        getoetst, mis, ver = 0, 0, 0.0
        for i in range(stappen + 1):
            p = rand.interpolate(i / stappen, normalized=True)
            # 2,5 km speling: zo ver kan Natural Earth van de BRK-grens af liggen.
            if p.distance(landsgrens) > 2500 + SCHIL:
                continue
            getoetst += 1
            d = p.distance(doel)
            if d > 0:
                mis += 1
                ver = max(ver, d)
        if not getoetst:
            sys.exit("Naadcontrole: geen punten gevonden op de %s." % wat)
        if mis:
            sys.exit("Naadcontrole mislukt op de %s: %d van %d punten vallen buiten het "
                     "buitenland, tot %.0f m. Verhoog BUFFER." % (wat, mis, getoetst, ver))
        print("naadcontrole %s: %d punten getoetst, alle gedekt" % (wat, getoetst))

    lijst = ringen(vorm)
    pad = pad_van(lijst)
    json.dump({
        "bron": "Natural Earth 1:10m Admin 0 (public domain), via npm world-atlas",
        "landen": LANDEN,
        "buffer_m": BUFFER,
        "tolerantie_m": TOLERANTIE,
        "kleur": KLEUR,
        "pad": pad
    }, open(UIT, "w"), ensure_ascii=False)
    print("Geschreven: %s (%d ringen, %d KB)" % (UIT, len(lijst), len(pad) // 1024))


if __name__ == "__main__":
    main()
