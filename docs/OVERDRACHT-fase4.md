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
| Puntlaag: klikken of plaatsnaam typen; stip, PNG-icoon, bel | ja, met autocomplete over 1074 plaatsen |
| Tekstlaag: tekstblokken met optionele verbindingslijn | ja, sleepbaar in de kaart |
| Legenda per symbooltype apart aan/uit | ja |
| Data plakken uit spreadsheet én handmatig aanpassen | ja |
| PNG-iconen uploaden, optioneel bewaren in bibliotheek | ja |
| RTV Oost-palet plus 32 afgeleide kleuren | ja, plus vrije kleurkiezer |
| Bibliotheek, bewerkbaar na opslaan, downloaden en openen | ja |
| Export 1920×1080, 1080×1080, 1080×1920 als drie layouts | ja |

**Nieuw databestand:** `data/plaatsen_overijssel.json` — 1074 plaatsen (152
woonkernen, 12 deelkernen, 27 gehuchten, 217 buurtschappen, 16 industriekernen,
10 stadsdelen, 426 wijken, 214 buurten), elk met gemeente, inwonertal en positie
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
- Van de 1074 plaatsen binnen de provincie is de gemeente-toewijzing gecontroleerd
  op 44 bekende plaats-gemeentecombinaties: **44 goed, 0 fout**.
- De TOP10NL-download dekt de provincie **niet volledig** — zie §4.

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
- **Opslag in `localStorage`, niet in cookies.** Lokaal, geen server, geen derde
  partij. De tool zegt er expliciet bij dat de bibliotheek verdwijnt als je je
  browsergegevens wist, en biedt downloaden als bestand als veilige route.

---

## 4. Aandachtspunten en open eindjes

- **Het noorden van Steenwijkerland ontbreekt in de plaatsenlijst.** De aangeleverde
  TOP10NL-download loopt tot RD-y 530.795, de provincie tot 541.000: een strook van
  ongeveer 10 km valt erbuiten, en in mindere mate ook stroken in het westen (2 km)
  en oosten (1 km). Daardoor missen onder meer **Steenwijk**, Steenwijkerwold, Tuk,
  Oldemarkt, Blokzijl, Kuinre, Ossenzijl, Willemsoord, Scheerwolde en Zuidveen in de
  autocomplete. Punten plaatsen door in de kaart te klikken werkt er wel gewoon.
  Oplossing: TOP10NL objecttype `plaats` opnieuw downloaden met een rechthoek die
  heel Overijssel omsluit, dan `build_plaatsen.py` en `build_app.py` draaien. De
  dekkingscontrole zit nu in de pijplijn, dus een volgende download meldt zelf of
  hij compleet is.
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
