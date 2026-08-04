# Tests

Browsertests die het gebouwde bestand echt openen, bedienen en de kaart
uittekenen. Ze controleren de dingen die je niet aan de code ziet: of een label
op de goede plek belandt, of een kleur is wat hij hoort te zijn, of een
opgeslagen kaart uit een oudere versie zonder verlies opengaat.

```bash
python3 build/build_app.py     # eerst bouwen — de tests lezen dist/
node test/alles.js             # alles achter elkaar
node test/06-buitenland.js     # of een enkele
```

De schermafdrukken komen in `/tmp/kb-testbeelden/`; met `KB_UIT=...` zet je ze
ergens anders neer. Ze staan bewust niet in de repo: het zijn hulpmiddelen om
naar te kijken, geen vastgelegde verwachtingen.

**De uitvoer is bedoeld om te lezen, niet om te vergelijken.** Er is geen
`assert`; elk script drukt af wat het gemeten heeft. Wat er hoort te staan
noemt het script in zijn eigen kop. Een lege `--- fouten ---` betekent dat er
geen enkele console- of paginafout is opgetreden; dat is wél een harde eis.

Vereist: `npm install playwright` en Chromium. In deze omgeving staat Chromium
al klaar via `PLAYWRIGHT_BROWSERS_PATH`.

## De twee tests met een database

`14-gedeelde-bibliotheek.js` (met browser) en `15-api.js` (zonder) toetsen de
bibliotheek op de server. Ze slaan zichzelf over als `POSTGRES_URL` niet gezet
is, zodat `node test/alles.js` het ook zonder database doet.

Wil je ze wél draaien, dan heb je een Postgres nodig — elke doet het, ook een
wegwerpexemplaar:

```bash
export PGDATA=/tmp/kbpg
initdb -D $PGDATA -A trust -U kb
pg_ctl -D $PGDATA -o "-p 55432" -w start
psql -h localhost -p 55432 -U kb -d postgres -c "create database kaartenbouwer;"

export POSTGRES_URL="postgresql://kb@localhost:55432/kaartenbouwer"
export BIBLIOTHEEK_WACHTWOORD="proefwachtwoord"
node test/alles.js
```

**Let op:** beide tests beginnen met `drop table if exists kaarten, iconen`.
Richt ze nooit op de database van de redactie.

`15-api.js` is de enige test met echte verwachtingen erin — hij drukt per regel
af wat hij kreeg en wat het had moeten zijn, en valt om als het niet klopt. Dat
is bewust: het gaat daar om wat er *niet* mag kunnen (zonder sessie bij de
kaarten komen, een koekje namaken, het werk van een collega overschrijven), en
zulke uitkomsten wil je niet met het oog beoordelen. Deze test draait ook in
GitHub Actions, tegen een echte Postgres en zonder browser.

Dat het geen overbodige luxe is, bleek meteen: er zat een NUL-byte in de sleutel
van de sessie in `api/_hulp.js`. De code werkte, want hij was consequent met
zichzelf, maar deed niet wat er stond. De test die een koekje namaakt uit het
wachtwoord viel erover. Er staat nu ook een controle op NUL-bytes in de
workflow.
