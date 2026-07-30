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
