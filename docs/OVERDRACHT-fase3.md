# Overdracht — Kaartenproject RTV Oost, naar fase 3 (redactietool)

Kort document om in een nieuwe chat mee te starten. Bevat wat er ligt, welke
keuzes al gemaakt zijn en waarom, en wat nog open staat.

---

## 1. Wat er ligt

**Kaartdata (dit is het belangrijkste bestand)**

| Bestand | Wat het is |
|---|---|
| `app_data.json` | 264 KB. Alle kaartlagen **al geprojecteerd** naar SVG-paden op 1920×1080. De tool hoeft geen kaartprojectie te kennen — alleen paden neerzetten en kleuren. Bevat: 25 gemeenten (pad + labelpositie + beschikbare labelruimte), context (land, provincielijnen, landmasker), provinciecontour, 13 wateren, 8 plaatsen met labelposities. |
| `overijssel.topojson` | 38 KB. Bronvorm met gedeelde arcs, voor als er ooit hergeprojecteerd of ingezoomd moet worden. |
| `overijssel-gemeenten.geojson` | 99 KB. Zelfde geometrie, plat, in RD (EPSG:28992). |
| `plaatsen.json` / `wateren.json` | Plaatscoördinaten en de vertaaltabel van bronnamen naar labelnamen. |

**Pijplijn (alleen nodig bij een herindeling of nieuwe lagen)**

`topology.py` → naadloze vereenvoudiging · `build_kaart.py` → basiskaart ·
`build_fase2.py` → de vier afgeleide kaarten · `export_app_data.py` → `app_data.json`

**Opgeleverde kaarten:** basiskaart (3 vulvarianten), plaatsen, gemeenten+plaatsen,
water+plaatsen, en Nederland met Overijssel in 4 kleurvarianten — telkens SVG + PNG.

---

## 2. Bronnen en licentie

- **BRK Bestuurlijke Gebieden** (Kadaster, via PDOK) — gemeente-, provincie- en landsgrenzen
- **CBS Gebiedsindelingen, gegeneraliseerd** (via PDOK) — land/water-scheiding
- **BRT TOP10NL, objecttype waterdeel** (Kadaster, via PDOK) — rivieren, kanalen, plassen

Alles **CC BY 4.0**. Bronvermelding vereist: *Bron: Kadaster/PDOK*. Nog te
beslissen of dat in de kaart zelf komt of in het onderschrift.

CRS overal **EPSG:28992 (RD New)**, geen herprojectie. Kaartschaal: **1 px = 102 m**.

---

## 3. Vastgestelde feiten (gevalideerd, niet aangenomen)

- Overijssel heeft **25 gemeenten**; totale oppervlakte **3420,7 km²** (officieel 3421)
- Elke gemeente wijkt **< 0,3 %** af van de CBS-oppervlakte; kleinste Oldenzaal, grootste Steenwijkerland
- Vereenvoudiging op 15 m: **91,8 % minder punten**, oppervlakteafwijking 0,0015 %
- **Geen naden** tussen gemeenten — gedeelde grenzen zijn één arc, één keer vereenvoudigd
- Het CBS-landmasker knipt **exact 12,6 km²** weg: het waterdeel van Kampen en Zwartewaterland, en niets bij de Duitse grens

## 4. Gemaakte ontwerpkeuzes

- **Achtergrond = water.** De BRK bevat binnenwater (41.543 km² = NL inclusief water), dus land/water komt uit CBS. Het masker zit als `clip-path` in de SVG, niet in de geometrie: de onderliggende gemeentevormen zijn compleet, zodat klikken en hoveren straks op de hele gemeente werkt.
- **Kleuren via CSS-variabelen**, niet ingebakken: `--oost-water`, `--context-land`, `--context-lijn`, `--ov-vulling`, `--ov-grens`, `--tekst`, plus lijndiktes `--lijn-context`, `--lijn-gemeente`, `--lijn-provincie`, `--lijn-water`.
- **Lijndiktes schalen niet lineair mee.** Ondergrens 0,55 uitvoerpixel, anders verdwijnen contourlijnen bij verkleining naar mobiel (gemeten: 2602 → 18 pixels).
- **Rivieren worden breder getekend dan ze zijn** (3,2 px extra). Op 1 px = 102 m is de IJssel anderhalve pixel; getrouw getekend is water onzichtbaar. De kaart is op dit punt bewust niet maatvast.
- **Contextlijnen op haarlijn**: 0,8 px, 35 % dekking, `#BFD4FF`.
- **Labels met botsingstest**, niet op gevoel. In Twente liggen Enschede en Hengelo 73 px uit elkaar.

## 5. Huisstijl

| Rol | Hex |
|---|---|
| Oost Blauw / water | `#1361FF` |
| Oost Donkerblauw / tekst | `#131720` |
| Oost Lichtblauw | `#E7EEF9` |
| Contextland | `#4A85FF` |
| Contextlijn | `#BFD4FF` |
| Overijssel-vulling | `#8FB8FF` |
| Oost Geel / accent | `#FFAF16` |
| Oost Oranje / Rood / Paars / Groen | `#FF6813` `#FF4242` `#8F00FF` `#ABBF3D` |

Font **Roobert**, lokaal geïnstalleerd (niet inbedden). Skill: `rtv-oost-huisstijl`.

---

## 6. Aandachtspunten en open eindjes

- **Plaatscoördinaten zijn afgeleid, niet officieel.** Ze zijn getoetst — elk punt ligt in de juiste gemeente en redelijk gecentreerd — en die toets ving twee fouten. Wil je officiële punten: TOP10NL objecttype **plaats** downloaden, dan is het een bestandsvervanging.
- **Bovenwijde, Giethoornsche Meer en Vollenhovermeer bestaan niet in TOP10NL.** Vervangen door Beulakerwijde, Belterwijde, Kleine Belterwijde, Schutsloterwijde en Boschwijde.
- **Oldenzaal en Borne hebben krappe labelruimte** (21 px tot de rand); labels lopen daar over de gemeentegrens heen.
- **PNG-export moet rechtstreeks naar canvas tekenen**, niet via SVG-rasterisatie. Anders valt Roobert weg in de export, ook als het lokaal geïnstalleerd is.
- Bij een gemeentelijke herindeling (per 1 januari): nieuwe PDOK-bestanden ophalen en de pijplijn opnieuw draaien.

## 7. Wat de tool moet worden

### Uitgangspunt

Eén HTML-bestand dat een redacteur lokaal opent. Geen React, geen buildstap, geen
server, geen cookies, geen derde partij. Roobert staat lokaal geïnstalleerd en wordt
**niet** ingebed. Uitvoer is een kant-en-klare PNG die als plaatje het artikel in gaat.

> **Technisch gevolg:** PNG-export moet rechtstreeks naar canvas tekenen (Path2D +
> fillText), niet via SVG-rasterisatie. Bij die tweede route valt een lokaal
> geïnstalleerd font weg in de export.

### Kaartsoorten teruggebracht tot twee lagen

De redactie noemde negen kaartsoorten. Vijf daarvan (locatiekaart, overzichtskaart,
symboolkaart, puntenkaart, bellenkaart) zijn mechanisch identiek: punten op een kaart,
verschillend in weergave en aantal. Vandaar:

| Laag | Dekt | Inhoud |
|---|---|---|
| **Vlaklaag** | thematische vlakkenkaart | 25 gemeenten inkleuren; categorie **of** kleurschaal; per gemeente een getal, tekst of symbool |
| **Puntlaag** | locatie, overzicht, symbool, punten, bellen | punt plaatsen via klik op de kaart **of** door een plaatsnaam te typen; weergave als stip, geüpload PNG-icoon, of bel met grootte naar waarde |
| **Tekstlaag** | geannoteerde kaart | labels bij plaatsnamen, plus vrije tekstblokken gekoppeld aan plaats/streek/gebied, met optionele verbindingslijn |

### Bouwen in fase 3

- Basiskaart kiezen uit de vier varianten van fase 2
- Vlaklaag en puntlaag zoals hierboven
- Legenda: **per symbooltype apart aan/uit**; categorieën, kleurschaal en symbolen
- Data-invoer: **plakken uit een spreadsheet én handmatig invullen/aanpassen**
- Iconen: **PNG uploaden**, met keuze om ze wel of niet in een bibliotheek te bewaren
- Kleuren: RTV Oost-palet plus **32 daarvan afgeleide kleuren** via kleurkiezer
- Opslaan: **bibliotheek** met opgeslagen kaarten die **na opslaan bewerkbaar** blijven, plus downloaden en openen als bestand
- Export: **PNG in 16:9 (1920×1080), vierkant (1080×1080) en staand (1080×1920)**

> **Let op:** vierkant en staand zijn géén uitsnede van 16:9. Die formaten moeten
> opnieuw worden ingedeeld — legenda onder de kaart in plaats van ernaast, kaart
> groter binnen het kader. Reken op drie layouts, niet één.

### Later (fase 4)

- **Vergelijkingskaart** — geen nieuw kaarttype maar een uitvoermodus: dezelfde kaart
  twee of drie keer naast elkaar. Goedkoop toe te voegen zodra één kaart werkt.
- **Netwerkkaart** — het enige echte buitenbeentje: verbindingen, pijlen, gebogen
  lijnen. Serieus extra werk, zelden nodig.
- **Inzoomen op een streek** (bijvoorbeeld een straal van 25 km). Haalbaar zonder
  herprojectie: de paden in `app_data.json` staan al in schermcoördinaten, dus zoomen
  is het kijkvenster (`viewBox`) verschuiven. Lijndiktes en tekstgroottes moeten dan
  tegengesteld meeschalen. De vereenvoudiging op 15 m blijft tot ongeveer 4× inzoomen
  subpixel, dus de geometrie houdt het.
- Interactieve kaarten via iframe. Dat loopt bij RTV Oost via een externe partij in
  verband met cookiebeleid; hoeft niet opgelost te zijn voor fase 3.

### Nog te downloaden vóór fase 3

**TOP10NL, objecttype `plaats`**, gebied Overijssel, via
`https://app.pdok.nl/brt/top10nl/download-viewer/`

Nodig om alle kernen van Overijssel te kunnen intypen met autocomplete. Nu zitten er
alleen de acht grootste plaatsen in `app_data.json`. Zonder dit bestand werkt "plaats
typen" alleen voor Enschede, Zwolle, Hengelo, Deventer, Almelo, Kampen, Oldenzaal en
Rijssen.

---

## 8. Zo start je de nieuwe chat

Upload **`OVERDRACHT-fase3.md`** en **`app_data.json`** (en zodra je het hebt, het
plaatsenbestand). Dat is genoeg om te beginnen. De pijplijnscripts en de GeoJSON-
bestanden zijn alleen nodig bij een gemeentelijke herindeling.
