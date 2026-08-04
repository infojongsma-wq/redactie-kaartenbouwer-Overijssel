# De kaartenbouwer op Vercel

Doel: als er hier een aanpassing gedaan wordt, staat die vanzelf online.
Geen knop, geen handmatige stap, geen wachten.

## Hoe het werkt

De repo bevat een kant-en-klare `index.html` in de hoofdmap. Dat is
hetzelfde bestand als `dist/kaartenbouwer-overijssel.html`, byte voor byte —
`build/build_app.py` schrijft ze allebei tegelijk.

Vercel hoeft daardoor **niets te bouwen**. Het pakt `index.html` op en zet
die neer. Dat is bewust zo: elke buildstap in de cloud is iets dat kapot kan
gaan, en de app heeft er geen nodig. Er staat om diezelfde reden ook geen
`package.json` in de hoofdmap — dan zou Vercel denken dat het een
Node-project is en alsnog een build willen draaien.

De keten is dus:

    aanpassing in src/  ->  build/build_app.py  ->  index.html
                        ->  commit + push naar main
                        ->  Vercel ziet de push  ->  live

## Eenmalig importeren

1. Ga naar <https://vercel.com/new> en kies **Import Git Repository**.
2. Kies `infojongsma-wq/redactie-kaartenbouwer-overijssel`.
3. Vercel toont een scherm met projectinstellingen. **Alles kan blijven
   staan zoals het is.** Concreet:
   - Framework Preset: `Other`
   - Root Directory: `./`
   - Build Command: leeg (of "Override" uit laten staan)
   - Output Directory: leeg
   - Install Command: leeg
4. Klik **Deploy**.

Na een halve minuut staat de kaartenbouwer op een adres als
`redactie-kaartenbouwer-overijssel.vercel.app`.

Als Vercel in stap 3 tóch een framework of buildcommando voorstelt: zet het
uit. Er valt niets te bouwen.

## Daarna

Vercel koppelt zichzelf aan de `main`-branch. Vanaf dat moment geldt:

- **push naar `main`** → nieuwe versie live, meestal binnen een minuut;
- **pull request** → Vercel maakt een preview-adres, zodat een wijziging te
  bekijken is vóór het samenvoegen.

Er hoeft verder niets ingesteld te worden.

## De bewaking

`.github/workflows/controle.yml` draait bij elke push naar `main` en bij elke
pull request:

1. syntaxcontrole van `src/render.js` en `src/app.js`;
2. `python3 build/build_app.py` opnieuw draaien;
3. `git diff --exit-code -- index.html dist/`.

Stap 3 is de belangrijke. Vercel bouwt niet, dus als iemand `src/` wijzigt en
vergeet het eindbestand mee te committen, zou er een oude kaart online blijven
staan zonder dat iemand het merkt. De controle laat dat rood worden.

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

## De bibliotheek

De opgeslagen kaarten staan in `localStorage` van de browser — dus per
computer, per browser. Dat blijft ook op Vercel zo werken. Een gedeelde
bibliotheek voor de hele redactie is een aparte stap: die vraagt om opslag
aan de serverkant en om een afspraak over wie wat mag overschrijven.

Het losse bestand blijft daarnaast gewoon bestaan. `dist/kaartenbouwer-
overijssel.html` downloaden en lokaal openen doet precies hetzelfde, ook
zonder internet.
