# Kaartenbouwer Overijssel — RTV Oost

Redactietool om kaarten van Overijssel te maken: gemeenten inkleuren, punten
plaatsen, annoteren, en exporteren als PNG in drie formaten. Fase 3 van het
kaartenproject.

**Het eindproduct is één bestand:** [`dist/kaartenbouwer-overijssel.html`](dist/kaartenbouwer-overijssel.html).
Downloaden, dubbelklikken, klaar. Geen installatie, geen server, geen buildstap,
geen internetverbinding, geen cookies, geen derde partij. Alles wat je invoert
blijft op je eigen computer.

---

## Voor de redactie

### Beginnen

Open het HTML-bestand in Chrome, Edge, Firefox of Safari. Links staan de
instellingen, rechts zie je meteen wat je maakt. Het voorbeeld is precies wat er
uit de export komt — alleen kleiner weergegeven.

### De drie lagen

| Laag | Waarvoor | Hoe |
|---|---|---|
| **Vlaklaag** | thematische kaart: cijfer of categorie per gemeente | Plak twee kolommen uit een spreadsheet, of vul de tabel handmatig in |
| **Puntlaag** | locatie-, overzichts-, symbool-, punten- en bellenkaart | Typ een plaatsnaam, klik in de kaart, of plak een lijst |
| **Tekstlaag** | geannoteerde kaart | Tekstblok toevoegen en in de kaart slepen, met of zonder verbindingslijn naar een plaats. Letterkleur en kaderkleur kies je per blok: wit, donkerblauw of Oost Blauw, en via de staal elke andere kleur |

Punten kun je een **groep** geven (derde kolom bij plakken). Elke groep krijgt een
eigen kleur en komt automatisch in de legenda — zo maak je een symbolenkaart.

Bij de vlaklaag kies je wat er in het vlak komt te staan: niets, alleen de naam,
alleen de waarde, naam plus waarde, of je eigen tekst uit een derde kolom. Dat
label komt **alleen in vlakken met een waarde** — de gemeenten waar het niet over
gaat blijven leeg. Wil je die namen er toch bij, zet dan *Namen op de vlakken* op
*Alle* bij Basiskaart; die vult dan de rest in.

In de tabel heeft elke gemeente ook een **kleurknopje**. Daarmee vul je een vlak in
zonder er een waarde bij te bedenken — handig als je alleen één gemeente wilt
aanzetten. Zo'n eigen kleur wint van de kleurschaal en van de categorie, en gaat
weg met hetzelfde kruisje als de waarde.

### Data plakken

Kopieer uit Excel of Google Sheets en plak. De tool herkent tabs, puntkomma's en
komma's als scheiding, slaat een kopregel over, en leest zowel Nederlandse als
Engelse getalnotatie (`1.234`, `1,5`, `1.234,56` en `1,234.56` komen allemaal goed
door). Gemeentenamen mogen in elke schrijfwijze — hoofdletters, kleine letters,
met of zonder streepje. Wat niet herkend wordt, krijg je te horen; er verdwijnt
nooit stilletjes een regel.

### Twee kaarten

Bij *Basiskaart* kies je **Overijssel** (25 gemeenten) of **Nederland**
(12 provincies, waarvan je er zoveel mag uitlichten als je wilt). Beide kaarten
werken met dezelfde lagen, dezelfde stijlen en dezelfde export, en de opschriften
in de zijbalk veranderen mee: waar het op de ene kaart om gemeenten gaat, gaat het
op de andere om provincies.

Ook zoeken werkt op beide: op de Overijsselkaart doorzoekt de puntlaag de 1143
kernen, wijken en buurtschappen uit TOP10NL, op de Nederlandkaart komen daar de
Nederlandse plaatsen uit GeoNames bij — zo vind je ook Maastricht.

De vlaklaag past zich aan: op de Nederlandkaart plak je data per provincie in
plaats van per gemeente. Ingevulde waarden blijven bewaard als je heen en weer
schakelt — gemeenten en provincies staan naast elkaar in dezelfde tabel.

### De basiskaart

**Stijl** zet vulling en lijnkleur in één klik: *Tint* (blauwe vulling, witte
lijnen), *Lichtblauw* of *Wit* (beide met blauwe lijnen). Onder *Kleuren en lijnen*
kun je die daarna los bijstellen, inclusief lijndikte — op nul zet je een lijn
helemaal uit.

Hoe meer plaatsen, hoe kleiner de namen worden gezet, en labels wijken automatisch
voor elkaar uit. Bij de dichtste variant (57 kernen) worden de namen klein: kijk
dan zeker even met de mobielcheck of het nog leesbaar is.

**Omringend land** tekent alles buiten Overijssel als land: de Nederlandse buren én
Duitsland. Duitsland en België staan standaard blauwgrijs, zodat ze als buitenland
lezen en niet als water; die kleur kun je bij *Kleuren en lijnen* aanpassen. Zet je
de laag uit, dan wordt alles eromheen water.

Op de **Nederlandkaart** heten de lagen naar wat ze daar zijn: *Provinciegrenzen*
voor de lijnen tussen de provincies en *Buitengrens van Nederland* voor de rand om
het land. Dat scheelt zoeken — de contourkleur raakt de binnengrenzen niet, want
die horen bij de andere laag.

**Uitlichten** kan op de Nederlandkaart met meerdere provincies tegelijk: vink aan
welke, en kies één kleur voor de hele selectie. Wil je ze onderling verschillende
kleuren geven, gebruik dan de vlaklaag met categorieën.

**Namen op de vlakken** zet je op *Geen*, *Alle* of *Alleen de uitgelichte* — die
laatste geeft je een kaart van Nederland waarop alleen "Overijssel" staat.

**Plaatsen** op de Nederlandkaart zijn de twaalf provinciehoofdsteden. Op de
Overijsselkaart kies je van vier steden tot alle kernen vanaf 2.500 inwoners.

**Uitlijning** (bij Kaart) zet titel en kaart apart links, in het midden of rechts.
Titel links en kaart rechts kan dus, en op de Nederlandkaart schuif je het land zo
opzij om ruimte voor een legenda te maken.

**Weergave** (bij Kaart) kiest tussen:

- *In kader* — de kaart in een vlak met ruimte voor titel, legenda en bronregel
  eromheen. In 16:9 heeft dat vlak de verhouding **3:2**, dus breder dan Overijssel
  zelf: links en rechts blijft omringend land zichtbaar.
- *Beeldvullend* — de kaart loopt door tot alle vier de beeldranden, zo groot als
  het beeld toelaat. Titel, ondertitel, legenda en bronregel liggen er als laag
  overheen. Een legenda ernaast schuift de kaart opzij — daar is bij 16:9 ruimte
  genoeg voor. Voor tv: kies 16:9. Waar de legenda komt te liggen, kies je bij
  *Legenda*. De achtergrondkeuze zie je in deze weergave niet — de kaart bedekt
  hem; de tool zegt dat er dan ook bij.

**Achtergrond** kan ook *transparant*. Dan komt er een PNG uit zonder ondergrond.
Zet bij de basiskaart ook *Wateroppervlak als achtergrond* uit als je alleen de
provincievorm wilt uitsnijden.

### De legenda

Achter elke regel van de legenda kun je een **eigen tekst** zetten: een aantal, een
eenheid, een toelichting. Bij *Legenda* staat per regel een veldje — welke regels
dat zijn hangt af van de lagen die aanstaan, dus de velden komen en gaan met je
kaart mee. De tekst komt in dezelfde maat achter het label, maar lichter.

Bij *Legenda* kies je waar hij komt: onder de kaart, of links of rechts ernaast,
en dan boven-, midden- of onderaan uitgelijnd. Dezelfde acht keuzes gelden voor
beide weergaven — in het kader ten opzichte van het kaartvlak, beeldvullend ten
opzichte van het beeld. Naast de kaart kan alleen bij 16:9; bij vierkant en staand
valt elke zijkeuze terug op *onder de kaart*.

### Exporteren

PNG in 16:9 (1920×1080), vierkant (1080×1080) en staand (1080×1920). **Die drie
zijn geen uitsnede van elkaar** — elk formaat is opnieuw ingedeeld, met de legenda
onder de kaart in plaats van ernaast en de kaart groter binnen het kader. Met
*Alle drie* download je ze in één keer.

De knop **Mobielcheck** laat de kaart op 540 px zien: de breedte waarop de meeste
lezers van oost.nl hem te zien krijgen. Is het daar niet leesbaar, dan is de kaart
niet af.

### Opslaan

*Opslaan in bibliotheek* bewaart de kaart in de opslag van je browser, op deze
computer. Opgeslagen kaarten blijven bewerkbaar: openen, aanpassen, opnieuw
opslaan. Let op: wis je je browsergegevens, dan is de bibliotheek weg. Voor kaarten
die je wilt bewaren of doorgeven is *Downloaden als bestand* de veilige route — dat
levert een `.kaart.json` op die je later weer kunt openen.

### Lettertype

De kaart gebruikt **Roobert**. Dat lettertype wordt niet meegeleverd en niet
ingebed; het moet lokaal geïnstalleerd staan. Ontbreekt het, dan verschijnt
bovenin een waarschuwing en valt de tool terug op Arial.

### Bronvermelding

De kaartdata komt van het Kadaster via PDOK en staat onder CC BY 4.0. **Bron:
Kadaster/PDOK** staat daarom vast: je kunt het niet wegpoetsen, ook niet door een
oude opgeslagen kaart te openen. Je eigen databron vul je erachter aan; dat wordt
dan `Bron: Kadaster/PDOK / CBS`.

Zet je plaatsen op de kaart die buiten Overijssel liggen — de provinciehoofdsteden,
of een plaats die je op de Nederlandkaart opzoekt — dan komen die uit GeoNames, ook
CC BY 4.0. De tool zet die bron er dan vanzelf bij.

---

## Voor wie eraan verder werkt

### Wat waar staat

```
dist/kaartenbouwer-overijssel.html   het eindproduct — dit geef je aan de redactie
src/index.html · styles.css          schil en huisstijl
src/render.js                        alle tekenwerk op canvas
src/app.js                           toestand, bediening, opslag, export
build/build_plaatsen.py              TOP10NL-plaatsen -> data/plaatsen_overijssel.json
build/build_app.py                   src + data -> dist/kaartenbouwer-overijssel.html
test/                                browsertests; zie test/README.md
data/app_data.json                   kaartlagen uit fase 2, al geprojecteerd
data/plaatsen_overijssel.json        1143 kernen, wijken en buurtschappen
data/nederland.json                  12 provincies, zelfde assenstelsel
build/build_nederland.py             provinciegrenzen -> data/nederland.json
data/plaatsen_nederland.json         1522 plaatsen + 12 hoofdsteden (GeoNames)
build/build_nl_plaatsen.py           GeoNames -> data/plaatsen_nederland.json
data/buitenland.json                 Duitsland en Belgie, zelfde assenstelsel
build/build_buitenland.py            Natural Earth -> data/buitenland.json
bron/top10nl_plaats*.gml.gz          bronbestand(en) Kadaster/PDOK
bron/provincies_zonder_water.geojson CBS Gebiedsindelingen — bron van de NL-kaart
bron/gemeenten_zonder_water.geojson  CBS, 342 gemeenten (nog niet gebruikt)
bron/provinciegrenzen.geojson        BRK Provinciegebied (terugval, mét water)
bron/landgebied.geojson              BRK Landgebied
bron/world-atlas-countries-10m.json  Natural Earth 1:10m - bron van Duitsland
bron/geonames-plaatsen-nl.json       GeoNames, de Nederlandse rijen
docs/OVERDRACHT-fase3.md             de overdracht waarmee deze fase begon
docs/OVERDRACHT-fase4.md             wat er nu ligt en wat nog open staat
```

Na een wijziging in `src/` of `data/`:

```bash
python3 build/build_app.py
```

De data zit ingebed in het HTML-bestand. Dat moet ook: een browser mag vanaf
`file://` geen JSON ophalen, dus een los databestand zou het lokaal openen breken.

### Twee dingen die niet vanzelf spreken

**Alles gaat via canvas, ook het voorbeeld.** Eén `tekenKaart()` bedient het
voorbeeld én de export, op exact dezelfde afmetingen; het voorbeeld wordt alleen
door CSS verkleind. Daarmee is WYSIWYG een eigenschap van de constructie in plaats
van iets wat je erbij moet bewaken. De export tekent rechtstreeks met `Path2D` en
`fillText` — via SVG-rasterisatie zou het lokaal geïnstalleerde Roobert wegvallen
in de PNG.

**Labels wijken uit in plaats van te verdwijnen.** Elk label probeert acht posities
rond zijn punt; de positie met de minste overlap wint, waarbij buiten het kaartvlak
vallen zwaar meetelt. Gemeentelabels, plaatsnamen en de symbolen zelf zijn allemaal
obstakel. Een label weglaten doet de tool nooit — voor een redactietool is een
label dat schuurt beter dan een label dat er stilletjes niet is.

### De transformatie RD → scherm

`app_data.json` bevat geprojecteerde SVG-paden maar niet de transformatie zelf.
Die is teruggerekend om de TOP10NL-plaatsen op dezelfde kaart te kunnen zetten.
De volledige afleiding staat bovenaan `build/build_plaatsen.py`; kort:

- **Schaal** uit de oppervlakte: de 25 gemeentepaden samen zijn 331.181,2 px², en
  Overijssel is 3420,7 km². Dat geeft 101,6306 m/px, precies de `schaal_m_per_px`
  in het bestand. Controle: de zo berekende oppervlakte per gemeente wijkt minder
  dan 0,1 % af van de CBS-cijfers.
- **Verschuiving** uit de geometrie, niet uit de acht plaatspunten in
  `app_data.json`. Die zijn volgens de overdracht "afgeleid, niet officieel" en
  blijken circa 7 px (700 m) naar het zuidoosten te liggen. In plaats daarvan is
  gebruikt dat een bebouwde kom binnen één gemeente ligt: de verschuiving die dat
  voor de meeste van 488 grensnabije kernen waarmaakt, brengt het aandeel van
  92,5 % naar 97,0 %. Onafhankelijke controle op de 25 gelijknamige hoofdkernen:
  volledig binnen de eigen gemeente gaat van 13/25 naar 16/25, en de resterende
  overschrijdingen krimpen van −4 tot −12 px naar −0,4 tot −2 px.

Wordt `app_data.json` ooit vervangen, dan controleert `build_plaatsen.py` de schaal
opnieuw en stopt met een foutmelding als die niet meer klopt.

### Meerdere brondownloads

De PDOK-downloadviewer levert per rechthoek. Past de provincie daar niet in, dan
mogen er gewoon meerdere `top10nl_plaats*.gml(.gz)`-bestanden naast elkaar in
`bron/` staan: `build_plaatsen.py` leest ze allemaal en haalt de overlap eruit op
`lokaalID`. Dat is geen theorie — de eerste download miste het noorden van
Steenwijkerland inclusief Steenwijk, en dat viel pas op door ernaar te zoeken.

Daarom controleert de pijplijn nu zelf op dekking, op twee manieren: elke gemeente
moet kernen hebben gekregen, en de provincie moet binnen de dekking van de
bronbestanden vallen. Rammelt er iets, dan zegt het bouwscript dat, en zetten
`data/plaatsen_overijssel.json` en de uitlegtekst in de tool het er als
waarschuwing bij.

### Duitsland komt uit een andere bron

PDOK houdt op bij de landsgrens, dus ten oosten van Twente stond water waar land
ligt. Duitsland en België komen daarom uit **Natural Earth 1:10m** (public domain),
via het npm-pakket `world-atlas`. Zie `build/build_buitenland.py`.

Dat is generalisatie op wereldschaal: de Duitse westgrens ligt tot 1077 m naast de
Nederlandse oostgrens uit de BRK. Op deze kaart is dat 10 px — zichtbaar, als je het
de naad laat zijn. Dat gebeurt niet. De vorm wordt 4 km opgeblazen, daarna
teruggesneden tot 1,5 km bínnen de Nederlandse grens, en als onderste laag getekend:
de contextlaag en de gemeenten komen eroverheen. De zichtbare naad blijft dus de
BRK-grens, en de onnauwkeurigheid ligt onder Nederland. Waarom 1,5 km: de rand van
de contextlaag ligt zelf al tot 720 m van de BRK-grens af, doordat CBS generaliseert
en fase 2 daarna nog eens met 80 m tolerantie vereenvoudigt.

Het bouwscript controleert dat: het bemonstert de landsgrens met Duitsland en België
— door Natural Earth zelf aangewezen, zodat de Eemsmonding er niet bij zit, want daar
is water aan beide kanten wél juist — en stopt als er ook maar één punt buiten de
vorm valt.

Duitsland is iets donkerder dan de omliggende provincies en duidelijk lichter dan
water, zodat het als land leest zonder de aandacht van Overijssel weg te trekken.

---

## Bronnen en licentie

- **BRK Bestuurlijke Gebieden** (Kadaster, via PDOK) — gemeente-, provincie- en landsgrenzen
- **CBS Gebiedsindelingen, gegeneraliseerd** (via PDOK) — land/water-scheiding
- **BRT TOP10NL, objecttype `waterdeel`** (Kadaster, via PDOK) — rivieren, kanalen, plassen
- **BRT TOP10NL, objecttype `plaats`** (Kadaster, via PDOK) — kernen, wijken en buurtschappen

Die vier zijn **CC BY 4.0**, bronvermelding *Bron: Kadaster/PDOK* verplicht.
CRS overal EPSG:28992 (RD New). Kaartschaal 1 px = 101,63 m.

Plaatsen buiten Overijssel — de twaalf provinciehoofdsteden en de zoeklijst van de
Nederlandkaart — komen uit de **GeoNames Gazetteer** (CC BY 4.0), via het npm-pakket
[`cities.json`](https://www.npmjs.com/package/cities.json). Bronvermelding verplicht;
de tool zet *GeoNames* er vanzelf bij zodra zo'n punt op de kaart staat. Bijwerken
gaat met `npm pack cities.json`; de Nederlandse rijen in `bron/`, dan
`build_nl_plaatsen.py`. Dat script controleert zichzelf tegen TOP10NL: van de 53
Overijsselse kernen die beide bronnen kennen wijkt het punt mediaan 214 m af, in het
uiterste geval 1484 m (Giethoorn, een lintdorp waarvan de twee bronnen een ander
midden kiezen). Loopt dat boven de 2,5 km, dan stopt het script.

Duitsland en Belgie komen uit **Natural Earth 1:10m Admin 0** — public domain, geen
bronvermelding vereist — herverpakt als TopoJSON in het npm-pakket
[`world-atlas`](https://www.npmjs.com/package/world-atlas) (ISC, zie
`bron/world-atlas-LICENSE`). Bijwerken gaat met `npm pack world-atlas@2`; leg
`countries-10m.json` uit het pakket in `bron/` en draai `build_buitenland.py`.
