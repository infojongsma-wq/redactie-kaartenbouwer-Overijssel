#!/usr/bin/env python3
"""
build_app.py — de losse bronbestanden samenvoegen tot een enkel HTML-bestand.

De redacteur krijgt een bestand dat lokaal opengaat: geen server, geen
buildstap, geen externe verzoeken. Dat betekent ook dat de kaartdata in het
bestand zelf moet staan — een browser mag vanaf `file://` geen JSON ophalen.

    python3 build/build_app.py   ->   dist/kaartenbouwer-overijssel.html
                                      index.html   (zelfde inhoud)

Er komen twee bestanden uit, met byte voor byte dezelfde inhoud:

* `dist/kaartenbouwer-overijssel.html` is het bestand om te downloaden en
  lokaal te openen — de naam zegt wat je in handen hebt;
* `index.html` in de hoofdmap is wat Vercel serveert. Vercel heeft geen
  instellingen nodig zolang er een index.html in de hoofdmap staat, en zo
  hoeft er in de cloud dus geen Python te draaien.

Twee gelijke bestanden kosten in Git niets extra's: objecten worden op
inhoud opgeslagen, dus beide verwijzen naar dezelfde blob.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")
UIT = os.path.join(DIST, "kaartenbouwer-overijssel.html")
UIT_WEB = os.path.join(ROOT, "index.html")


def lees(pad):
    with open(pad, encoding="utf-8") as f:
        return f.read()


def veilig_json(pad):
    """JSON inbedden in een <script>-blok.

    `</script>` mag nergens letterlijk in de inhoud voorkomen, anders sluit de
    browser het blok halverwege af. Hetzelfde geldt voor `<!--`.
    """
    data = json.load(open(pad, encoding="utf-8"))
    tekst = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return tekst.replace("</", "<\\/").replace("<!--", "<\\!--")


def main():
    html = lees(os.path.join(SRC, "index.html"))
    stijl = lees(os.path.join(SRC, "styles.css"))
    script = lees(os.path.join(SRC, "render.js")) + "\n\n" + lees(os.path.join(SRC, "app.js"))

    kaartdata = veilig_json(os.path.join(ROOT, "data", "app_data.json"))
    plaatsdata = veilig_json(os.path.join(ROOT, "data", "plaatsen_overijssel.json"))
    nederlanddata = veilig_json(os.path.join(ROOT, "data", "nederland.json"))
    buitenlanddata = veilig_json(os.path.join(ROOT, "data", "buitenland.json"))
    nlplaatsdata = veilig_json(os.path.join(ROOT, "data", "plaatsen_nederland.json"))

    for teken, naam in (("/*__STIJL__*/", "stijl"), ("/*__SCRIPT__*/", "script"),
                        ("/*__KAARTDATA__*/", "kaartdata"), ("/*__PLAATSDATA__*/", "plaatsdata"),
                        ("/*__NEDERLANDDATA__*/", "nederlanddata"),
                        ("/*__BUITENLANDDATA__*/", "buitenlanddata"),
                        ("/*__NLPLAATSDATA__*/", "nlplaatsdata")):
        if teken not in html:
            sys.exit("Plaatshouder %s ontbreekt in src/index.html" % teken)

    # str.replace zou backslash-reeksen in de data als groepsverwijzing kunnen
    # opvatten bij re.sub; daarom hier expliciet met een lambda.
    def zet(bron, teken, waarde):
        return bron.replace(teken, waarde)

    html = zet(html, "/*__STIJL__*/", stijl)
    html = zet(html, "/*__KAARTDATA__*/", kaartdata)
    html = zet(html, "/*__PLAATSDATA__*/", plaatsdata)
    html = zet(html, "/*__NEDERLANDDATA__*/", nederlanddata)
    html = zet(html, "/*__BUITENLANDDATA__*/", buitenlanddata)
    html = zet(html, "/*__NLPLAATSDATA__*/", nlplaatsdata)
    html = zet(html, "/*__SCRIPT__*/", script)

    # controle vóór het schrijven: geen enkel extern verzoek in het eindbestand.
    # Zo blijft er bij een fout geen half product achter dat wél gepubliceerd
    # zou worden.
    extern = re.findall(r'(?:src|href)\s*=\s*["\'](https?:)?//[^"\']+', html)
    if extern:
        sys.exit("Er staan externe verwijzingen in de uitvoer: %s" % extern[:3])

    os.makedirs(DIST, exist_ok=True)
    for pad in (UIT, UIT_WEB):
        with open(pad, "w", encoding="utf-8") as f:
            f.write(html)

    print("Geschreven: %s (%.0f KB)" % (UIT, os.path.getsize(UIT) / 1024))
    print("Geschreven: %s (zelfde inhoud, voor Vercel)" % UIT_WEB)
    print("  kaartdata  %6.0f KB" % (len(kaartdata) / 1024))
    print("  plaatsdata %6.0f KB" % (len(plaatsdata) / 1024))
    print("  nederland  %6.0f KB" % (len(nederlanddata) / 1024))
    print("  buitenland %6.0f KB" % (len(buitenlanddata) / 1024))
    print("  nl-plaatsen%6.0f KB" % (len(nlplaatsdata) / 1024))
    print("  code       %6.0f KB" % ((len(stijl) + len(script)) / 1024))


if __name__ == "__main__":
    main()
