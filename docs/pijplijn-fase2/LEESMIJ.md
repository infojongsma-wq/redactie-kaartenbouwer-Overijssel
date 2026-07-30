# Pijplijn van fase 1 en 2 — ter referentie

Deze vier scripts hebben `data/app_data.json` gemaakt. Ze draaien hier niet
(ze verwachten paden en bronbestanden uit die omgeving), maar ze staan erbij
omdat ze vastleggen hoe de kaartlagen tot stand zijn gekomen.

Wat je eruit haalt als je iets wilt narekenen:

- **`build_kaart.py`** — de projectie, de kleuren, de lijndiktes en de
  land/water-scheiding. Hier staat ook welke bronbestanden nodig zijn:
  `Kaart_gemeentegrenzen_v1_0.json` (BRK) en **`Provincies_zonder_water_v1_0.json`**
  (CBS Gebiedsindelingen). Dat tweede bestand is precies wat de Nederlandkaart in
  de tool nu nog mist; zie `../OVERDRACHT-fase4.md`.
- **`topology.py`** — de gedeelde-arc topologie die zorgt dat er geen naden
  tussen buurgemeenten ontstaan. Dezelfde reden waarom `build_nederland.py`
  afrondt op een raster in plaats van per vlak te vereenvoudigen.
- **`build_fase2.py`** — de vier afgeleide kaarten. `NL_VARIANTEN` onderin bevat
  de kleurcombinaties van de Nederlandkaart; die zijn letterlijk overgenomen in
  `NL_STIJLEN` in `src/app.js`.
- **`export_app_data.py`** — hoe `app_data.json` is opgebouwd, inclusief de
  labelpuntberekening (pool of inaccessibility) per gemeente.
