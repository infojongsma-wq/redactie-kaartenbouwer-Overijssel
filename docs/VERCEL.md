# De kaartenbouwer op Vercel

Doel: als er hier een aanpassing gedaan wordt, staat die vanzelf online.
Geen knop, geen handmatige stap, geen wachten.

## Hoe het werkt

De repo bevat een kant-en-klare `index.html` in de hoofdmap. Dat is
hetzelfde bestand als `dist/kaartenbouwer-overijssel.html`, byte voor byte —
`build/build_app.py` schrijft ze allebei tegelijk.

Vercel hoeft daardoor voor de kaart zelf **niets te bouwen**. Het pakt
`index.html` op en zet die neer. Dat is bewust zo: elke buildstap in de cloud
is iets dat kapot kan gaan, en de kaartenbouwer heeft er geen nodig. De
`package.json` in de hoofdmap staat er alleen voor de API-functies in `api/`;
er zit geen `build`-script in, dus Vercel installeert wel maar bouwt niet.

De keten is dus:

    aanpassing in src/  ->  build/build_app.py  ->  index.html
                        ->  commit + push naar main
                        ->  Vercel ziet de push  ->  live

## Eenmalig importeren

1. Ga naar <https://vercel.com/new> en kies **Import Git Repository**.
2. Kies `infojongsma-wq/redactie-kaartenbouwer-overijssel`.
3. Vercel toont een scherm met projectinstellingen. **Alles kan blijven
   staan zoals het is** — `vercel.json` zet wat nodig is. Framework Preset
   `Other`, Root Directory `./`, Build Command leeg. Stelt Vercel toch een
   framework of een buildcommando voor: zet het uit.
4. Klik **Deploy**.

Na een halve minuut staat de kaartenbouwer op een adres als
`redactie-kaartenbouwer-overijssel.vercel.app`. Hij werkt dan meteen, met de
bibliotheek in de browser.

5. Richt daarna de gedeelde bibliotheek in — de database en het wachtwoord,
   hieronder. Dat is de enige stap waarin je zelf iets moet invullen.

## Daarna

Vercel koppelt zichzelf aan de `main`-branch. Vanaf dat moment geldt:

- **push naar `main`** → nieuwe versie live, meestal binnen een minuut;
- **pull request** → Vercel maakt een preview-adres, zodat een wijziging te
  bekijken is vóór het samenvoegen.

Er hoeft verder niets ingesteld te worden.

## De bewaking

`.github/workflows/controle.yml` draait bij elke push naar `main` en bij elke
pull request:

1. syntaxcontrole van `src/` en `api/`;
2. een controle op NUL-bytes in de broncode;
3. `node test/15-api.js` tegen een echte Postgres — dat is de test die
   probeert zónder wachtwoord bij de kaarten te komen;
4. `python3 build/build_app.py` opnieuw draaien;
5. `git diff --exit-code -- index.html dist/`.

Stap 5 is de belangrijke voor de publicatie. Vercel bouwt niet, dus als iemand
`src/` wijzigt en vergeet het eindbestand mee te committen, zou er een oude
kaart online blijven staan zonder dat iemand het merkt. De controle laat dat
rood worden.

Stap 2 lijkt vergezocht maar staat er met reden: er is één keer een NUL-byte in
de sleutel van de sessie beland. De code werkte — hij was consequent met
zichzelf — maar deed niet wat er stond, en `grep` hield het bestand voor een
binair bestand. Zoiets wil je niet nog eens per ongeluk meenemen.

## Caching

`vercel.json` zet op alles `Cache-Control: public, max-age=0,
must-revalidate`. De browser vraagt dus elke keer even na of er een nieuwe
versie is, en haalt die alleen op als hij veranderd is. Zonder deze regel zou
een redacteur na een aanpassing nog dagen de oude kaartenbouwer kunnen zien
en zelf moeten weten dat een harde ververs nodig is.

De kosten zijn klein: het bestand is ongeveer 880 KB en wordt alleen opnieuw
opgehaald als er echt iets veranderd is.

## Wat er niet meegaat

`.vercelignore` houdt de brondata (`bron/`, 13 MB), de bouwscripts, de tests
en de losse `src/`-bestanden buiten de publicatie. Die horen in de repo thuis,
maar niet op de website.

## De gedeelde bibliotheek

Op Vercel staan de opgeslagen kaarten niet in de browser maar in een database,
zodat de hele redactie bij dezelfde kaarten kan. Dat vraagt twee dingen: een
database en een wachtwoord. Zolang er één van de twee ontbreekt, valt de
website vanzelf terug op de opslag van de browser — de kaartenbouwer werkt dan
gewoon, alleen is de bibliotheek per computer.

### 1. Een database koppelen

In je Vercel-project: **Storage → Create Database → Postgres** (dat is Neon in
de marktplaats van Vercel). Kies hetzelfde project en klik **Connect**. Vercel
zet de verbindingsgegevens dan zelf als omgevingsvariabelen klaar; je hoeft
niets te kopiëren.

De code kijkt naar `POSTGRES_URL`, `DATABASE_URL`, `POSTGRES_PRISMA_URL`,
`POSTGRES_URL_NON_POOLING` en `DATABASE_URL_UNPOOLED`, in die volgorde. Welke
van die namen je aanbieder zet maakt dus niet uit — het werkt ook met Supabase
of een eigen server. Er wordt met gewone `pg` verbonden, zonder iets dat aan
één aanbieder vastzit.

De twee tabellen (`kaarten` en `iconen`) maakt de app zelf aan bij het eerste
gebruik. Er is geen migratiestap.

### 2. Het wachtwoord instellen

**Settings → Environment Variables**, en zet:

| Naam | Waarde |
|---|---|
| `BIBLIOTHEEK_WACHTWOORD` | het wachtwoord voor de hele redactie |

Zet hem aan voor **Production**, **Preview** en **Development**. Na het
opslaan moet er één keer opnieuw gedeployd worden voordat hij meetelt —
Vercel biedt dat zelf aan.

Kies iets langs. Er is één wachtwoord voor iedereen op een openbaar adres; de
lengte is wat het beschermt, niet de ingewikkeldheid. Een zin van vier of vijf
woorden is prima en beter te onthouden.

Wil je het wachtwoord later wijzigen: pas de variabele aan en deploy opnieuw.
Alle bestaande sessies vervallen dan meteen — de sleutel waarmee ze getekend
zijn komt uit het wachtwoord zelf.

### Hoe het inloggen werkt

Eén keer inloggen, daarna dertig dagen ingelogd blijven op die computer. De
sessie zit in een `HttpOnly`-koekje dat ondertekend is met een sleutel uit het
wachtwoord; er staat geen wachtwoord in, en zelf een geldig koekje maken kan
alleen wie het wachtwoord al heeft. Na tien mispogingen vanaf hetzelfde adres
gaat de deur tien minuten op slot.

Dat laatste is een drempel, geen slot: het geheugen zit per serverinstantie, en
Vercel draait er meer dan één. Het echte werk doet de lengte van het wachtwoord.

Het wachtwoord beschermt alleen de bibliotheek. De kaartenbouwer zelf werkt
zonder inloggen gewoon — je kunt een kaart maken en downloaden, alleen niet
opslaan in de gedeelde bibliotheek.

### Twee mensen, dezelfde kaart

Dit is waarom er een database staat en geen bestandsopslag. Elke kaart heeft
een versienummer. Sla je een kaart op die iemand anders intussen heeft
gewijzigd, dan krijg je een melding in plaats van dat je hun werk overschrijft:

> Iemand anders heeft "Stikstof" intussen aangepast. Sla op onder een andere
> naam, of open de kaart opnieuw om met hun versie verder te gaan.

Met losse bestanden zou dat een lees-dan-schrijf-race zijn geweest; in een
tabel is het één regel SQL. Het is getest — zie `test/15-api.js`.

## Het losse bestand blijft

`dist/kaartenbouwer-overijssel.html` downloaden en lokaal openen doet precies
hetzelfde, ook zonder internet. Dat bestand slaat op in de browser, zoals
altijd. Dezelfde `src/` levert beide: welke opslag het wordt, blijkt bij het
opstarten uit `/api/inloggen`. Vanaf `file://` is er niets te vragen en is het
altijd de browser.
