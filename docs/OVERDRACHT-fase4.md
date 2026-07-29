# Overdracht — Kaartenproject RTV Oost, naar fase 4

Vervolg op `OVERDRACHT-fase3.md`. Dit document beschrijft wat fase 3 heeft
opgeleverd, welke keuzes daarbij zijn gemaakt en waarom, en wat er nog open staat.

---

## 1. Wat er ligt

**`dist/kaartenbouwer-overijssel.html`** — één bestand van 506 KB dat een redacteur
lokaal opent. Geen React, geen buildstap, geen server, geen cookies, geen externe
verzoeken. Dat laatste is gecontroleerd: het bouwscript weigert uitvoer met een
`src` of `href` naar een andere host.

Alles uit de opdracht in §7 van de vorige overdracht zit erin:

| Gevraagd | Status |
|---|---|
| Basiskaart uit de varianten van fase 2 | vier presets plus losse laagschakelaars |
| Vlaklaag: categorie óf kleurschaal, getal/tekst per gemeente | ja, met 7 kleurschalen uit het palet |
| Puntlaag: klikken of plaatsnaam typen; stip, PNG-icoon, bel | ja, met autocomplete over 1143 plaatsen |
| Tekstlaag: tekstblokken met optionele verbindingslijn | ja, sleepbaar in de kaart |
| Legenda per symbooltype apart aan/uit | ja |
| Data plakken uit spreadsheet én handmatig aanpassen | ja |
| PNG-iconen uploaden, optioneel bewaren in bibliotheek | ja |
| RTV Oost-palet plus 32 afgeleide kleuren | ja, plus vrije kleurkiezer |
| Bibliotheek, bewerkbaar na opslaan, downloaden en openen | ja |
| Export 1920×1080, 1080×1080, 1080×1920 als drie layouts | ja |

**Nieuw databestand:** `data/plaatsen_overijssel.json` — 1143 plaatsen (170
woonkernen, 16 deelkernen, 35 gehuchten, 228 buurtschappen, 17 industriekernen,
10 stadsdelen, 448 wijken, 219 buurten), elk met gemeente, inwonertal en positie
in het 1920×1080-assenstelsel.

---

## 2. Vastgestelde feiten (gevalideerd, niet aangenomen)

In de geest van de vorige overdracht: wat hieronder staat is gemeten, niet gegokt.

- De 25 gemeentepaden in `app_data.json` beslaan samen **331.181,2 px²**, exact
  gelijk aan de provinciecontour — er zitten inderdaad geen naden in.
- Met de gevalideerde oppervlakte van 3420,7 km² volgt daaruit **101,6306 m/px**,
  wat de `schaal_m_per_px: 101.6` in het bestand bevestigt. Onafhankelijke
  controle: de zo berekende oppervlakte per gemeente wijkt < 0,1 % af van CBS
  (Enschede 142,8 vs 142,75 km²; Zwolle 119,4 vs 119,29; Oldenzaal 22,0 vs 21,98).
- De **acht plaatspunten in `app_data.json` liggen circa 7 px (700 m) te ver naar
  het zuidoosten.** Dat is geen schatting: de verschuiving is bepaald op 488
  grensnabije bebouwde kommen en onafhankelijk bevestigd op de 25 gelijknamige
  hoofdkernen (volledig binnen de eigen gemeente: 13/25 → 16/25; resterende
  overschrijdingen van −4…−12 px naar −0,4…−2 px). Een bootstrap over 12
  steekproeven geeft een spreiding van 0,65 px, dus de afwijking is ruim
  significant. Dit bevestigt de waarschuwing uit de vorige overdracht dat die
  coördinaten "afgeleid, niet officieel" zijn.
- Van de 1143 plaatsen binnen de provincie is de gemeente-toewijzing gecontroleerd
  op 55 bekende plaats-gemeentecombinaties: **55 goed, 0 fout**.
- De dekking is compleet: elke gemeente heeft kernen, en de provincie valt binnen
  de dekking van het bronbestand. De buitenste plaatsen van de download zijn
  Overdinkel in het oosten en Bantega in het westen — echte plaatsen, geen
  afkapping.

---

## 3. Gemaakte ontwerpkeuzes

- **Eén tekenfunctie voor voorbeeld en export.** Beide draaien op exact dezelfde
  afmetingen; het voorbeeld wordt alleen door CSS verkleind. WYSIWYG is daarmee een
  eigenschap van de constructie, niet iets wat bewaakt moet worden.
- **Rechtstreeks naar canvas** met `Path2D` en `fillText`, zoals de vorige
  overdracht voorschreef: via SVG-rasterisatie valt het lokaal geïnstalleerde
  Roobert weg in de PNG.
- **Het watervlak volgt de kaart, niet het kader.** Een watervlak over het hele
  beschikbare vak levert bij 16:9 een blauwe band van halve beeldbreedte op. Nu
  ligt er een afgerond kaartvlak met 26 px context rondom.
- **Labels wijken uit, verdwijnen nooit.** Acht kandidaatposities per label, de
  positie met de minste overlap wint, buiten het kaartvlak vallen telt vier keer
  zo zwaar. Een label weglaten is voor een redactietool erger dan een label dat
  schuurt — daarom gebeurt dat niet.
- **Gecentreerde compositie als standaard**, conform de datavisual-huisstijl, met
  links uitlijnen als optie.
- **Bij een staand formaat zakt de kaart niet naar het midden.** Overijssel is
  bijna vierkant en vult 9:16 nooit; de overgebleven hoogte gaat voor 32 % naar
  boven en 68 % naar onderen, zodat de kaart onder de titel hangt in plaats van te
  zweven.
- **Bellen schalen op oppervlakte, niet op straal** — anders overdrijft het
  verschil.
- **Getalnotatie wordt afgeleid, niet aangenomen.** `1.234` is Nederlands voor
  1234, `1.5` een Engelse decimaal; bij twee scheidingstekens wint de laatste als
  decimaalteken.
- **Stijl koppelt vulling aan lijnkleur.** De drie vulvarianten uit fase 2
  verschillen niet alleen in vulling maar ook in lijnkleur (tint heeft witte
  grenzen, lichtblauw en wit hebben blauwe). Als losse instellingen kost dat drie
  handelingen; als stijlknop één. De losse regelaars staan er nog onder, in een
  uitklapper, zodat de bovenlaag simpel blijft.
- **Plaatspunten komen uit TOP10NL, niet uit `app_data.json`.** Anders zouden de
  elf hoofdplaatsen de afwijking van 700 m houden terwijl de nieuw toegevoegde
  kernen wel goed liggen. Nu staat alles in hetzelfde gecontroleerde stelsel.
- **Naamgrootte hangt af van het aantal plaatsen.** Bij 57 kernen past de normale
  maat er niet meer op. De factor loopt van 1,12 (tot 5 plaatsen) naar 0,63 (meer
  dan 40).
- **Twee kaartsoorten delen één tekenfunctie.** Nederland is met dezelfde
  affiene transformatie geprojecteerd als Overijssel, dus beide leven in
  hetzelfde assenstelsel; een punt uit de plaatsenlijst klopt op allebei zonder
  omrekening. Alleen het kijkvenster en de beschikbare lagen verschillen.
- **Provinciecodes en gemeentecodes botsen niet** (23 tegenover GM0141), dus de
  ingevulde waarden van beide kaartsoorten kunnen in dezelfde tabel staan.
  Wisselen van kaart gooit je invoer niet weg.
- **Nederland krijgt geen waterachtergrond.** Buiten het land is er geen
  contextlaag, dus alles eromheen zou water worden — en een blauw uitgelicht
  Overijssel loopt dan tegen de oostgrens zo over in de achtergrond. Bij het
  wisselen van kaartsoort gaat het waterveld daarom automatisch uit.
- **Afronden op een raster in plaats van vereenvoudigen.** Douglas-Peucker per
  provincie zou gaten tussen buren opleveren: een gedeelde grens wordt dan twee
  keer verschillend vereenvoudigd. Afronden op een vast raster van 1 interne
  pixel (ongeveer 102 m) heeft dat probleem niet, want dezelfde coordinaat rondt
  aan beide kanten naar hetzelfde punt.
- **Waarden krijgen allemaal evenveel decimalen.** Staat er ergens 3,2 dan wordt
  3 ook 3,0; anders lezen die twee in dezelfde kaart als verschillende soorten
  getallen.
- **Opslag in `localStorage`, niet in cookies.** Lokaal, geen server, geen derde
  partij. De tool zegt er expliciet bij dat de bibliotheek verdwijnt als je je
  browsergegevens wist, en biedt downloaden als bestand als veilige route.

---

## 4. Aandachtspunten en open eindjes

- **Opgelost: het noorden van Steenwijkerland.** De eerste TOP10NL-download liep
  tot RD-y 530.795 en de provincie tot 541.000, waardoor een strook van ongeveer
  10 km erbuiten viel en onder meer **Steenwijk** (20.350 inwoners), Oldemarkt,
  Blokzijl, Kuinre, Ossenzijl en Willemsoord in de autocomplete ontbraken. Een
  tweede download over het noorden heeft dat verholpen: Steenwijkerland ging van 18
  naar 54 kernen en het totaal van 1074 naar 1143 plaatsen. De pijplijn leest nu
  alle `top10nl_plaats*.gml(.gz)`-bestanden in `bron/` en ontdubbelt op `lokaalID`,
  dus meerdere downloadrechthoeken mogen naast elkaar staan.
- **Het binnenwater zit in de provincies van de Nederlandkaart.** BRK
  Provinciegebied telt op tot 41.543 km2, Nederland inclusief binnenwater;
  Friesland +72 %, Flevoland +70 %, Zeeland +65 %. IJsselmeer, Markermeer,
  Waddenzee en Oosterschelde zijn daardoor dichtgevuld. Het meegeleverde
  `landgebied.geojson` lost dat niet op: dat is het staatsgebied en komt op
  dezelfde 41.543 km2 uit, dus knippen levert niets. Nodig is CBS
  Gebiedsindelingen (gegeneraliseerd), dezelfde bron als in fase 1. Zodra dat
  bestand in `bron/` staat, knipt `build_nederland.py` vanzelf en controleert het
  elke provincie tegen de CBS-landoppervlakte; boven 3 % afwijking stopt het.
- **Duitsland staat niet op de kaart.** De contextlaag komt uit CBS
  Gebiedsindelingen en houdt op bij de landsgrens, dus ten oosten van Twente wordt
  water getekend waar land ligt. Met het huidige krappe kaartvlak is dat een strook
  van ongeveer 26 px. Echt oplossen vraagt buitenlandse geometrie, die niet in de
  pijplijn van fase 1/2 zit.
- **`context.land` en `context.lijnen` in `app_data.json` zijn hetzelfde pad.** De
  lijnenlaag voegt dus alleen een contour aan de landvlakken toe. Geen probleem,
  maar goed om te weten voordat iemand naar het verschil zoekt.
- **Oldenzaal en Borne houden krappe labelruimte** (21 px). Het uitwijkmechanisme
  vangt dat op, maar bij vier of meer punten dicht op elkaar in Twente blijft het
  krap.
- **De dekkingscontrole is een waarschuwing, geen bewijs.** Hij kijkt of elke
  gemeente kernen heeft gekregen en of de provincie binnen de dekking valt. Dat had
  het gat bij Steenwijk gevangen, maar een download die een enkel dorp mist midden
  in een verder goed gevulde gemeente glipt er doorheen.
- **De iconenbibliotheek deelt de `localStorage`-ruimte** (meestal 5 MB). Grote
  PNG's kunnen die vol maken; de tool meldt dat dan en laat de rest werken.

---

## 5. Wat er voor fase 4 klaarligt

Uit de vorige overdracht, met wat fase 3 eraan verandert:

- **Vergelijkingskaart** — nog steeds goedkoop. `tekenKaart()` neemt de toestand als
  argument, dus twee of drie kaarten naast elkaar is een kwestie van drie keer
  tekenen in één kader met een aangepaste indeling.
- **Inzoomen op een streek** — de kaarttransformatie zit al op één plek
  (`berekenIndeling`), en lijndiktes schalen daar al tegengesteld mee via
  `lijn(basis, s)`. Een ander kijkvenster is dus een wijziging in één functie.
- **Netwerkkaart** — nog steeds het buitenbeentje; verbindingen en gebogen lijnen
  zijn echt nieuw werk.
- **Interactieve kaarten via iframe** — ongewijzigd, loopt bij RTV Oost via een
  externe partij in verband met cookiebeleid.

Bij een gemeentelijke herindeling (per 1 januari): nieuwe PDOK-bestanden ophalen,
de pijplijn van fase 1/2 opnieuw draaien, daarna `build_plaatsen.py` en
`build_app.py`. `build_plaatsen.py` controleert zelf of de schaal nog klopt en
stopt met een foutmelding als `app_data.json` niet meer past bij de vastgelegde
transformatie.
