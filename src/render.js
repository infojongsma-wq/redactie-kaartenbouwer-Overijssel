/* ==================================================================
   render.js — tekent de kaart rechtstreeks op canvas.

   Voorbeeld en export gebruiken exact dezelfde functie op exact dezelfde
   afmetingen; het voorbeeld wordt alleen door CSS verkleind getoond. Wat je
   ziet is dus wat je exporteert.

   Rechtstreeks naar canvas (Path2D + fillText), niet via SVG-rasterisatie:
   bij die tweede route valt een lokaal geinstalleerd lettertype weg in de
   PNG-export.
   ================================================================== */

const Render = (function () {

  const LETTER = "Roobert, Arial, Helvetica, sans-serif";

  /* ---------------------------------------------------------- kleuren */

  const PALET = [
    { naam: "Oost Blauw",       hex: "#1361FF" },
    { naam: "Oost Donkerblauw", hex: "#131720" },
    { naam: "Oost Lichtblauw",  hex: "#E7EEF9" },
    { naam: "Oost Paars",       hex: "#8F00FF" },
    { naam: "Oost Rood",        hex: "#FF4242" },
    { naam: "Oost Oranje",      hex: "#FF6813" },
    { naam: "Oost Geel",        hex: "#FFAF16" },
    { naam: "Oost Groen",       hex: "#ABBF3D" },
    { naam: "Oost Creme",       hex: "#F5F0E8" },
    { naam: "Wit",              hex: "#FFFFFF" }
  ];

  // Acht huisstijlkleuren, elk in vier afgeleide stappen: 32 extra kleuren.
  const AFGELEID_VAN = ["#1361FF", "#8F00FF", "#FF4242", "#FF6813", "#FFAF16", "#ABBF3D", "#131720", "#F5F0E8"];
  const AFGELEID_STAPPEN = [0.72, 0.42, -0.18, -0.42];   // >0 lichter, <0 donkerder

  function hexNaarRgb(hex) {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  function rgbNaarHex(r, g, b) {
    const f = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return "#" + f(r) + f(g) + f(b);
  }
  function meng(hexA, hexB, t) {
    const a = hexNaarRgb(hexA), b = hexNaarRgb(hexB);
    return rgbNaarHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }
  function verschuif(hex, stap) {
    return stap >= 0 ? meng(hex, "#FFFFFF", stap) : meng(hex, "#131720", -stap);
  }

  const AFGELEID = [];
  AFGELEID_VAN.forEach(hex => AFGELEID_STAPPEN.forEach(s => AFGELEID.push(verschuif(hex, s))));

  const ALLE_KLEUREN = PALET.map(k => k.hex).concat(AFGELEID);

  // Relatieve luminantie, voor het automatisch kiezen van tekstkleur.
  function luminantie(hex) {
    const [r, g, b] = hexNaarRgb(hex).map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const la = luminantie(a), lb = luminantie(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function leesbaarOp(achtergrond) {
    return contrast("#131720", achtergrond) >= contrast("#FFFFFF", achtergrond) ? "#131720" : "#FFFFFF";
  }

  /* Kleurschalen: opgebouwd uit het huisstijlpalet, niet uit willekeurige
     verlopen. Elke schaal loopt van licht naar verzadigd. */
  const SCHALEN = [
    { id: "blauw",   naam: "Blauw",            van: "#E7EEF9", tot: "#0B3FA8" },
    { id: "geel",    naam: "Geel naar oranje", van: "#FFF7E7", tot: "#C24A00" },
    { id: "paars",   naam: "Paars",            van: "#F3E6FF", tot: "#5A009E" },
    { id: "groen",   naam: "Groen",            van: "#F5F7EC", tot: "#6C7A20" },
    { id: "rood",    naam: "Rood",             van: "#FFECEC", tot: "#A81919" },
    { id: "blauwgeel", naam: "Blauw–geel (divergerend)", van: "#1361FF", via: "#F5F0E8", tot: "#FFAF16" },
    { id: "roodgroen", naam: "Rood–groen (divergerend)", van: "#FF4242", via: "#F5F0E8", tot: "#ABBF3D" }
  ];

  function schaalKleur(schaal, t) {
    t = Math.max(0, Math.min(1, t));
    if (schaal.via) {
      return t < 0.5 ? meng(schaal.van, schaal.via, t * 2) : meng(schaal.via, schaal.tot, (t - 0.5) * 2);
    }
    return meng(schaal.van, schaal.tot, t);
  }

  // Vaste kleurvolgorde voor categorieen (huisstijlvolgorde, geel eerst op blauw).
  const CATEGORIEKLEUREN = ["#FFAF16", "#FF6813", "#8F00FF", "#ABBF3D", "#FF4242", "#1361FF", "#F5F0E8", "#131720"];

  /* ------------------------------------------------------- achtergrond */

  const ACHTERGRONDEN = {
    wit:          { vlak: "#FFFFFF", tekst: "#131720", zacht: "#5C6577" },
    transparant:  { vlak: null,      tekst: "#131720", zacht: "#5C6577" },
    lichtblauw:   { vlak: "#E7EEF9", tekst: "#131720", zacht: "#4A5568" },
    blauw:        { vlak: "#1361FF", tekst: "#FFFFFF", zacht: "rgba(255,255,255,.82)" },
    donkerblauw:  { vlak: "#131720", tekst: "#FFFFFF", zacht: "rgba(255,255,255,.75)" }
  };

  const VULLINGEN = { tint: "#8FB8FF", wit: "#FFFFFF", lichtblauw: "#E7EEF9" };

  // De vulling is tegenwoordig een hex-kleur. Oudere opgeslagen kaarten hebben
  // er nog een trefwoord staan; die blijven werken.
  function vulKleur(b) {
    const v = b && b.vulling;
    if (typeof v === "string" && v.charAt(0) === "#") return v;
    return VULLINGEN[v] || VULLINGEN.tint;
  }

  /* -------------------------------------------------------- formaten */

  const FORMATEN = {
    "16:9": { breedte: 1920, hoogte: 1080, marge: 72, titelgrootte: 54, ondertitelgrootte: 30, brongrootte: 20 },
    "1:1":  { breedte: 1080, hoogte: 1080, marge: 56, titelgrootte: 46, ondertitelgrootte: 26, brongrootte: 18 },
    "9:16": { breedte: 1080, hoogte: 1920, marge: 60, titelgrootte: 62, ondertitelgrootte: 33, brongrootte: 20 }
  };

  // Vaste verhouding van het kaartvlak. In 16:9 is dat 3:2: het vlak is dan
  // breder dan de provincie zelf, zodat er links en rechts omringend land in
  // beeld komt en de kaart niet als een uitgeknipte vorm oogt. In een vierkant
  // of staand kader is daar geen ruimte voor; daar sluit het vlak om de vorm.
  const VAKVERHOUDING = { "16:9": 3 / 2, "1:1": null, "9:16": null };

  // links = 0, midden = 0,5, rechts = 1.
  function uitlijnGetal(waarde) {
    return waarde === "links" ? 0 : waarde === "rechts" ? 1 : 0.5;
  }

  /* --------------------------------------------------------- bronregel */

  // De kaartdata staat onder CC BY 4.0; deze vermelding is verplicht en dus
  // niet weg te halen. De redactie vult er hoogstens de eigen databron achter.
  const BRON_VAST = "Bron: Kadaster/PDOK";

  function bronTekst(staat) {
    const kaartbronnen = [BRON_VAST];
    // Plaatsen buiten Overijssel komen uit GeoNames, ook CC BY 4.0. Staan die
    // op de kaart — als hoofdsteden of als punt uit de zoeklijst — dan hoort
    // GeoNames er vanzelf bij.
    const punten = (staat.puntlaag && staat.puntlaag.actief && staat.puntlaag.punten) || [];
    if ((staat.basiskaart && staat.basiskaart.plaatsen === "hoofdsteden")
        || punten.some(p => p.herkomst === "GeoNames")) kaartbronnen.push("GeoNames");
    const eigen = String(staat.bronaanvulling || "").trim().replace(/^[\/·,;\s]+/, "");
    return kaartbronnen.join(" · ") + (eigen ? " / " + eigen : "");
  }

  /* --------------------------------------------------- padcache (Path2D) */

  let kaartdata = null;
  let nederlanddata = null;
  let buitenlanddata = null;
  const padcache = new Map();

  function pad(sleutel, d) {
    let p = padcache.get(sleutel);
    if (!p) { p = new Path2D(d); padcache.set(sleutel, p); }
    return p;
  }

  function zetData(data, nederland, buitenland) {
    kaartdata = data;
    nederlanddata = nederland || null;
    buitenlanddata = buitenland && buitenland.pad ? buitenland : null;
    padcache.clear();
    kaartdata._bbox = bepaalBbox(kaartdata.provinciegrens);
  }

  /* Twee kaartsoorten delen dezelfde tekenfunctie. Ze verschillen alleen in
     welke vlakken er liggen, hoe groot het kijkvenster is en of er context- en
     waterlagen bij horen. Nederland is in hetzelfde assenstelsel geprojecteerd,
     dus een punt uit de plaatsenlijst klopt op beide kaarten. */
  function gebiedVan(staat) {
    if (staat.kaartsoort === "nederland" && nederlanddata) {
      return {
        soort: "nederland",
        vlakken: nederlanddata.provincies,
        bbox: nederlanddata.bbox,
        contour: nederlanddata.landcontour,
        sleutel: "p:"
      };
    }
    return {
      soort: "overijssel",
      vlakken: kaartdata.gemeenten,
      bbox: kaartdata._bbox,
      contour: kaartdata.provinciegrens,
      sleutel: "g:"
    };
  }

  function bepaalBbox(d) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const getallen = d.match(/-?\d+(\.\d+)?/g) || [];
    for (let i = 0; i + 1 < getallen.length; i += 2) {
      const x = parseFloat(getallen[i]), y = parseFloat(getallen[i + 1]);
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  }

  /* ------------------------------------------------------- tekstmeting */

  function zetLetter(ctx, gewicht, grootte) { ctx.font = gewicht + " " + grootte + "px " + LETTER; }

  function breekTekst(ctx, tekst, maxBreedte) {
    const woorden = String(tekst).split(/\s+/).filter(Boolean);
    if (!woorden.length) return [];
    const regels = [];
    let regel = woorden[0];
    for (let i = 1; i < woorden.length; i++) {
      const kandidaat = regel + " " + woorden[i];
      if (ctx.measureText(kandidaat).width <= maxBreedte) regel = kandidaat;
      else { regels.push(regel); regel = woorden[i]; }
    }
    regels.push(regel);
    return regels;
  }

  /* ------------------------------------------------------- lijndiktes */

  // Lijndiktes schalen bewust niet lineair mee: bij verkleining verdwijnen
  // contourlijnen anders volledig. Ondergrens 0,55 uitvoerpixel.
  function lijn(basis, s) { return Math.max(0.55, basis * Math.pow(s, 0.75)); }

  const LIJN = { context: 0.9, gemeente: 1.15, provincie: 2.4, water: 0.8 };

  /* ---------------------------------------------------------- legenda */

  function bouwLegenda(staat, hulp) {
    const items = [];
    const L = staat.legenda;

    if (staat.vlaklaag.actief && L.categorie && staat.vlaklaag.modus === "categorie") {
      const cats = hulp.categorieen || [];
      if (cats.length) items.push({ type: "categorie", categorieen: cats });
    }
    if (staat.vlaklaag.actief && L.schaal && staat.vlaklaag.modus === "schaal") {
      const g = hulp.grenzen;
      if (g) items.push({ type: "schaal", schaal: schaalVan(staat.vlaklaag.schaal), min: g.min, max: g.max, eenheid: staat.vlaklaag.eenheid || "" });
    }
    if (staat.puntlaag.actief) {
      const punten = staat.puntlaag.punten;
      if (L.stip && staat.puntlaag.weergave === "stip" && punten.length) {
        const groepen = hulp.puntgroepen || [];
        items.push({
          type: "stip",
          rijen: groepen.length
            ? groepen.map(g => ({ kleur: g.kleur, label: g.naam }))
            : [{ kleur: staat.puntlaag.kleur, label: staat.puntlaag.legendalabel || "Locatie" }]
        });
      }
      if (L.bel && staat.puntlaag.weergave === "bel" && hulp.belgrenzen) {
        items.push({ type: "bel", grenzen: hulp.belgrenzen, kleur: staat.puntlaag.kleur, eenheid: staat.puntlaag.eenheid || "" });
      }
      if (L.icoon && staat.puntlaag.weergave === "icoon") {
        const gebruikt = new Map();
        punten.forEach(p => {
          const id = p.icoonId || staat.puntlaag.icoonId;
          if (id && !gebruikt.has(id)) gebruikt.set(id, p.groep || hulp.icoonnaam(id));
        });
        if (gebruikt.size) items.push({ type: "icoon", rijen: [...gebruikt].map(([id, label]) => ({ id, label })) });
      }
    }
    return items;
  }

  function schaalVan(id) { return SCHALEN.find(s => s.id === id) || SCHALEN[0]; }

  function meetLegenda(ctx, items, richting, maxBreedte, k) {
    if (!items.length) return { breedte: 0, hoogte: 0, blokken: [] };
    const blokken = items.map(item => meetLegendaBlok(ctx, item, richting, maxBreedte, k));
    if (richting === "verticaal") {
      const b = Math.max(...blokken.map(x => x.breedte));
      const h = blokken.reduce((s, x) => s + x.hoogte, 0) + (blokken.length - 1) * k.legendaTussen;
      return { breedte: b, hoogte: h, blokken };
    }
    // horizontaal: blokken naast elkaar, met terugval naar een nieuwe rij
    let x = 0, rijhoogte = 0, hoogte = 0;
    blokken.forEach(blok => {
      if (x > 0 && x + blok.breedte > maxBreedte) { hoogte += rijhoogte + k.legendaTussen; x = 0; rijhoogte = 0; }
      blok._x = x; blok._y = hoogte;
      x += blok.breedte + k.legendaKolomTussen;
      rijhoogte = Math.max(rijhoogte, blok.hoogte);
    });
    hoogte += rijhoogte;
    return { breedte: Math.min(maxBreedte, Math.max(...blokken.map(b => b._x + b.breedte))), hoogte, blokken };
  }

  function meetLegendaBlok(ctx, item, richting, maxBreedte, k) {
    zetLetter(ctx, "500", k.legendaTekst);
    const rijhoogte = k.legendaRij;
    if (item.type === "categorie") {
      const breedtes = item.categorieen.map(c => k.staal + 10 + ctx.measureText(c.naam).width);
      if (richting === "verticaal") {
        return { item, breedte: Math.min(maxBreedte, Math.max(...breedtes)), hoogte: item.categorieen.length * rijhoogte };
      }
      const kolom = Math.max(...breedtes) + k.legendaKolomTussen;
      const perRij = Math.max(1, Math.floor((maxBreedte + k.legendaKolomTussen) / kolom));
      const rijen = Math.ceil(item.categorieen.length / perRij);
      return { item, breedte: Math.min(maxBreedte, kolom * Math.min(perRij, item.categorieen.length) - k.legendaKolomTussen), hoogte: rijen * rijhoogte, perRij };
    }
    if (item.type === "schaal") {
      const b = richting === "verticaal" ? Math.min(maxBreedte, 300) : Math.min(maxBreedte, 360);
      return { item, breedte: b, hoogte: k.schaalbalk + k.legendaTekst + 12 };
    }
    if (item.type === "bel") {
      const d = item.grenzen.maxStraal * 2;
      return { item, breedte: Math.max(d + 130, 190), hoogte: d + k.legendaTekst + 14 };
    }
    if (item.type === "stip" || item.type === "icoon") {
      const hoog = item.type === "icoon" ? k.legendaIcoon : rijhoogte;
      const breedtes = item.rijen.map(r => (item.type === "icoon" ? k.legendaIcoon : k.staal) + 10 + ctx.measureText(r.label || "").width);
      if (richting === "verticaal") {
        return { item, breedte: Math.min(maxBreedte, Math.max(...breedtes)), hoogte: item.rijen.length * hoog };
      }
      const kolom = Math.max(...breedtes) + k.legendaKolomTussen;
      const perRij = Math.max(1, Math.floor((maxBreedte + k.legendaKolomTussen) / kolom));
      return { item, breedte: Math.min(maxBreedte, kolom * Math.min(perRij, item.rijen.length) - k.legendaKolomTussen), hoogte: Math.ceil(item.rijen.length / perRij) * hoog, perRij };
    }
    return { item, breedte: 0, hoogte: 0 };
  }

  function tekenLegenda(ctx, gemeten, x, y, richting, kleur, k, hulp) {
    gemeten.blokken.forEach((blok, i) => {
      let bx = x, by = y;
      if (richting === "verticaal") {
        by = y + gemeten.blokken.slice(0, i).reduce((s, b) => s + b.hoogte + k.legendaTussen, 0);
      } else { bx = x + blok._x; by = y + blok._y; }
      tekenLegendaBlok(ctx, blok, bx, by, richting, kleur, k, hulp);
    });
  }

  function tekenLegendaBlok(ctx, blok, x, y, richting, kleur, k, hulp) {
    const item = blok.item;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    zetLetter(ctx, "500", k.legendaTekst);

    if (item.type === "categorie" || item.type === "stip" || item.type === "icoon") {
      const rijen = item.type === "categorie"
        ? item.categorieen.map(c => ({ kleur: c.kleur, label: c.naam }))
        : item.rijen;
      const hoog = item.type === "icoon" ? k.legendaIcoon : k.legendaRij;
      const perRij = richting === "verticaal" ? 1 : (blok.perRij || 1);
      // De tussenruimte zit in de kolombreedte, anders raakt het langste label
      // van de ene kolom het staal van de volgende.
      const kolommen = Math.min(perRij, Math.max(1, rijen.length));
      const kolombreedte = richting === "verticaal"
        ? blok.breedte
        : (blok.breedte + k.legendaKolomTussen) / kolommen;
      rijen.forEach((r, i) => {
        const kol = i % perRij, rij = Math.floor(i / perRij);
        const rx = x + kol * kolombreedte, ry = y + rij * hoog + hoog / 2;
        if (item.type === "icoon") {
          const afb = hulp.icoon(r.id);
          if (afb) {
            const s = k.legendaIcoon;
            const v = pasIn(afb.width, afb.height, s, s);
            ctx.drawImage(afb, rx + (s - v.b) / 2, ry - v.h / 2, v.b, v.h);
          }
          ctx.fillStyle = kleur;
          ctx.fillText(r.label || "", rx + k.legendaIcoon + 10, ry);
        } else if (item.type === "stip") {
          ctx.fillStyle = r.kleur;
          ctx.beginPath();
          ctx.arc(rx + k.staal / 2, ry, k.staal / 2.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = kleur;
          ctx.fillText(r.label || "", rx + k.staal + 10, ry);
        } else {
          ctx.fillStyle = r.kleur;
          rondeRechthoek(ctx, rx, ry - k.staal / 2, k.staal, k.staal, 4);
          ctx.fill();
          ctx.fillStyle = kleur;
          ctx.fillText(r.label || "", rx + k.staal + 10, ry);
        }
      });
      return;
    }

    if (item.type === "schaal") {
      const b = blok.breedte, hb = k.schaalbalk;
      const verloop = ctx.createLinearGradient(x, 0, x + b, 0);
      for (let t = 0; t <= 1.0001; t += 0.05) verloop.addColorStop(Math.min(1, t), schaalKleur(item.schaal, t));
      ctx.fillStyle = verloop;
      rondeRechthoek(ctx, x, y, b, hb, 4);
      ctx.fill();
      ctx.fillStyle = kleur;
      ctx.textBaseline = "top";
      zetLetter(ctx, "500", k.legendaTekst);
      ctx.textAlign = "left";
      ctx.fillText(formatGetal(item.min) + (item.eenheid ? " " + item.eenheid : ""), x, y + hb + 8);
      ctx.textAlign = "right";
      ctx.fillText(formatGetal(item.max) + (item.eenheid ? " " + item.eenheid : ""), x + b, y + hb + 8);
      ctx.textAlign = "left";
      return;
    }

    if (item.type === "bel") {
      // Genestelde bellen met de grootste onderaan, plus een aanwijslijntje naar
      // het label. De labels worden zo nodig omlaag geduwd zodat ze elkaar niet
      // raken bij bellen die weinig in grootte verschillen.
      const g = item.grenzen;
      const groot = g.maxStraal;
      const tekstgrootte = k.legendaTekst - 2;
      const gesorteerd = [...g.stappen].sort((a, b) => b - a);
      let vorigeY = -Infinity;
      ctx.textBaseline = "middle";
      gesorteerd.forEach(stap => {
        const r = g.straal(stap);
        const cx = x + groot, cy = y + 2 * groot - r;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = item.kleur;
        ctx.globalAlpha = 0.28;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = kleur;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        let ly = cy - r;
        if (ly - vorigeY < tekstgrootte * 1.35) ly = vorigeY + tekstgrootte * 1.35;
        vorigeY = ly;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(x + groot * 2 + 8, ly);
        ctx.strokeStyle = kleur;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = kleur;
        zetLetter(ctx, "500", tekstgrootte);
        ctx.textAlign = "left";
        ctx.fillText(formatGetal(stap) + (item.eenheid ? " " + item.eenheid : ""), x + groot * 2 + 12, ly);
      });
      return;
    }
  }

  function pasIn(bronB, bronH, maxB, maxH) {
    const s = Math.min(maxB / bronB, maxH / bronH);
    return { b: bronB * s, h: bronH * s };
  }

  function rondeRechthoek(ctx, x, y, b, h, r) {
    r = Math.min(r, b / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + b, y, x + b, y + h, r);
    ctx.arcTo(x + b, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + b, y, r);
    ctx.closePath();
  }

  function formatGetal(v) {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v !== "number") return String(v);
    const afgerond = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    return afgerond.toLocaleString("nl-NL");
  }

  /* ------------------------------------------------------- indeling */

  function maatstaf(formaat) {
    const f = FORMATEN[formaat];
    const s = f.breedte / 1920;
    return {
      legendaTekst: formaat === "1:1" ? 21 : 23,
      legendaRij: formaat === "1:1" ? 33 : 36,
      legendaIcoon: 40,
      legendaTussen: 26,
      legendaKolomTussen: 34,
      staal: 26,
      schaalbalk: 18,
      gemeentelabel: formaat === "16:9" ? 19 : 20,
      waardelabel: formaat === "16:9" ? 25 : 26,
      plaatslabel: formaat === "16:9" ? 22 : 23,
      puntlabel: formaat === "16:9" ? 23 : 24,
      tekstblok: formaat === "16:9" ? 26 : 27,
      _s: s
    };
  }

  /* Titel en ondertitel opbreken in regels, met de hoogte die ze innemen.
     Beide indelingen doen dit; alleen de beschikbare breedte verschilt. */
  function meetKop(ctx, staat, f, maxBreedte) {
    let titelRegels = [], onderRegels = [], hoogte = 0;
    if ((staat.titel || "").trim()) {
      zetLetter(ctx, "700", f.titelgrootte);
      titelRegels = breekTekst(ctx, staat.titel, maxBreedte);
      hoogte += titelRegels.length * f.titelgrootte * 1.16;
    }
    if ((staat.ondertitel || "").trim()) {
      zetLetter(ctx, "400", f.ondertitelgrootte);
      onderRegels = breekTekst(ctx, staat.ondertitel, maxBreedte);
      hoogte += (titelRegels.length ? 10 : 0) + onderRegels.length * f.ondertitelgrootte * 1.3;
    }
    return { titelRegels, onderRegels, hoogte };
  }

  function berekenIndeling(ctx, staat, formaat, hulp) {
    const f = FORMATEN[formaat];
    const k = maatstaf(formaat);
    // Beeldvullend: de kaart loopt door tot de beeldrand en titel, legenda en
    // bronregel liggen er als laag overheen. Bedoeld voor tv, maar even goed
    // bruikbaar op het web.
    if (staat.weergave === "beeldvullend") return indelingVol(ctx, staat, formaat, hulp, f, k);
    const m = f.marge;
    // Titel en kaart lijnen los van elkaar uit: soms hoort de kop links en de
    // kaart rechts, met de legenda in de ruimte die dan overblijft.
    const richting = uitlijnGetal(staat.uitlijning);
    const kaartrichting = uitlijnGetal(staat.kaartuitlijning);

    /* --- titelblok --- */
    const kop = meetKop(ctx, staat, f, f.breedte - 2 * m);
    const titelRegels = kop.titelRegels, onderRegels = kop.onderRegels;
    const titelEinde = m + kop.hoogte;
    const kaartTop = titelEinde + (titelRegels.length || onderRegels.length ? Math.round(34 * k._s) : 0);
    const bronHoogte = Math.round(f.brongrootte * 1.6) + 14;
    const bodem = f.hoogte - m - bronHoogte;

    const beschikbaarB = f.breedte - 2 * m;
    const beschikbaarH = bodem - kaartTop;

    // Overijssel is bijna vierkant en vult een staand kader nooit helemaal.
    // De overgebleven hoogte gaat daarom niet half-half maar grotendeels naar
    // onderen: de kaart hangt dan onder de titel in plaats van te zweven.
    const verdeling = formaat === "9:16" ? 0.32 : 0.45;

    /* --- maat van de kaart bepalen --- */
    const bb = gebiedVan(staat).bbox;
    const rand = Math.round(26 * k._s);
    const gat = Math.round(46 * k._s);
    const tussenruimte = Math.round(30 * k._s);

    const items = bouwLegenda(staat, hulp);
    const legendaOnder = formaat !== "16:9" || staat.legenda.plaats === "onder";
    const legendaKop = (staat.legenda.titel || "").trim() ? Math.round(k.legendaTekst + 16) : 0;

    // Eerst de legenda meten: hoeveel die inneemt hangt niet van de schaal van
    // de kaart af, dus wat overblijft is meteen de ruimte voor het kaartvlak.
    let gemeten = null;
    let maxB = beschikbaarB, maxH = beschikbaarH;
    if (items.length && legendaOnder) {
      gemeten = meetLegenda(ctx, items, "horizontaal", beschikbaarB, k);
      maxH = beschikbaarH - gemeten.hoogte - legendaKop - tussenruimte;
    } else if (items.length) {
      gemeten = meetLegenda(ctx, items, "verticaal", Math.round(f.breedte * 0.30), k);
      maxB = beschikbaarB - gemeten.breedte - gat;
    }
    maxB = Math.max(80, maxB);
    maxH = Math.max(80, maxH);

    // Met een vaste verhouding is het kaartvlak het grootste vlak van die vorm
    // dat past, en komt de provincie daar gecentreerd in te liggen. Zonder
    // vaste verhouding sluit het vlak strak om de provincie, zoals eerst.
    const doel = VAKVERHOUDING[formaat];
    let vakB, vakH, s;
    if (doel) {
      vakB = maxB; vakH = maxH;
      if (vakB / vakH > doel) vakB = vakH * doel; else vakH = vakB / doel;
      s = Math.min((vakB - 2 * rand) / bb.b, (vakH - 2 * rand) / bb.h);
    } else {
      s = Math.min((maxB - 2 * rand) / bb.b, (maxH - 2 * rand) / bb.h);
      vakB = bb.b * s + 2 * rand;
      vakH = bb.h * s + 2 * rand;
    }

    /* --- kaart en legenda plaatsen --- */
    let vakX, vakY, legenda = null;
    if (!items.length) {
      vakX = m + (beschikbaarB - vakB) * kaartrichting;
      vakY = kaartTop + (beschikbaarH - vakH) * verdeling;
    } else if (legendaOnder) {
      const totaal = vakH + tussenruimte + legendaKop + gemeten.hoogte;
      vakX = m + (beschikbaarB - vakB) * kaartrichting;
      vakY = kaartTop + Math.max(0, (beschikbaarH - totaal) * verdeling);
      legenda = {
        x: m + (beschikbaarB - gemeten.breedte) * kaartrichting,
        y: vakY + vakH + tussenruimte + legendaKop,
        b: gemeten.breedte, h: gemeten.hoogte, richting: "horizontaal", gemeten
      };
    } else {
      // kaart en legenda blijven als groep bij elkaar staan
      const groepB = vakB + gat + gemeten.breedte;
      const groepX = m + (beschikbaarB - groepB) * kaartrichting;
      vakX = groepX;
      vakY = kaartTop + (beschikbaarH - vakH) * verdeling;
      legenda = {
        x: groepX + vakB + gat,
        y: vakY + Math.max(0, (vakH - gemeten.hoogte - legendaKop) / 2) + legendaKop,
        b: gemeten.breedte, h: gemeten.hoogte, richting: "verticaal", gemeten
      };
    }

    const vak = { x: vakX, y: vakY, b: vakB, h: vakH };
    const tx = vakX + (vakB - bb.b * s) / 2 - bb.x * s;
    const ty = vakY + (vakH - bb.h * s) / 2 - bb.y * s;

    return {
      f, k, m, richting, kaartrichting, vol: false,
      titelRegels, onderRegels, titelEinde,
      titelVak: { x: m, b: beschikbaarB, y: m },
      bronVak: { x: m, b: beschikbaarB, y: f.hoogte - m + f.brongrootte * 0.1 },
      kaart: vak, vak, legenda, items, transform: { s, tx, ty }, bodem, bronHoogte
    };
  }

  /* Beeldvullende indeling: de kaart loopt door tot de beeldrand en alle tekst
     ligt er als laag overheen. Wat die tekst inneemt blijft vrij van de
     provincie zelf — het omringende land en het water lopen er wel onderdoor,
     maar de vorm schuift ervandaan. Anders komt de tekst op de lichte vulling
     terecht en is hij op tv niet te lezen. */
  const TV_LEGENDA = {
    rechts:       { x: 1, y: 0.5 },
    rechtsboven:  { x: 1, y: 0 },
    rechtsonder:  { x: 1, y: 1 },
    linksboven:   { x: 0, y: 0 },
    linksonder:   { x: 0, y: 1 }
  };

  // Waar de tv-legenda op komt te liggen: water, omringend land of, als beide
  // uit staan, de paginakleur zelf.
  function tvOndergrond(staat, thema) {
    const b = staat.basiskaart;
    if (b.water) return kaartdata.kleuren.water;
    if (b.context && gebiedVan(staat).soort === "overijssel") return kaartdata.kleuren.context_land;
    return thema.vlak || "#FFFFFF";
  }

  function indelingVol(ctx, staat, formaat, hulp, f, k) {
    const bb = gebiedVan(staat).bbox;
    const vak = { x: 0, y: 0, b: f.breedte, h: f.hoogte };
    const rand = Math.round(f.breedte * 0.05);
    const gat = Math.round(40 * k._s);
    const richting = uitlijnGetal(staat.uitlijning);

    // vrij = waar de provincie mag liggen. Elk stuk tekst knabbelt eraf.
    let vrij = { x: 0, y: 0, b: f.breedte, h: f.hoogte };
    const knip = (x, y, b, h) => { vrij = { x, y, b: Math.max(1, b), h: Math.max(1, h) }; };

    /* --- titel bovenaan --- */
    const kop = meetKop(ctx, staat, f, f.breedte - 2 * rand);
    if (kop.hoogte) {
      const onder = rand + kop.hoogte + gat;
      knip(vrij.x, onder, vrij.b, f.hoogte - onder);
    }

    /* --- bronregel onderaan --- */
    const bronHoogte = Math.round(f.brongrootte * 1.6) + 14;
    knip(vrij.x, vrij.y, vrij.b, vrij.h - bronHoogte);

    /* --- legenda --- */
    const items = bouwLegenda(staat, hulp);
    const plek = TV_LEGENDA[staat.legenda.tvplaats];
    // In een breed kader past de legenda als kolom naast de kaart; in een
    // vierkant of staand kader is daar geen ruimte voor en wordt het een band
    // boven of onder. De legenda blijft binnen wat de titel heeft overgelaten.
    const kolom = f.breedte / f.hoogte >= 1.3;
    let legenda = null;
    if (items.length && plek) {
      const veld = vrij;
      const legendarichting = kolom ? "verticaal" : "horizontaal";
      const gemeten = meetLegenda(ctx, items, legendarichting,
                                  kolom ? Math.round(f.breedte * 0.30) : f.breedte - 2 * rand, k);
      const legendatitel = (staat.legenda.titel || "").trim();
      let legendakop = 0, kopBreedte = 0;
      if (legendatitel) {
        zetLetter(ctx, "600", k.legendaTekst + 2);
        legendakop = Math.round(k.legendaTekst + 16);
        kopBreedte = ctx.measureText(legendatitel).width;
      }
      // De kop kan breder zijn dan de rijen eronder; anders zou hij bij een
      // legenda rechts buiten beeld doorlopen.
      const blokB = Math.max(gemeten.breedte, kopBreedte);
      const blokH = gemeten.hoogte + legendakop;

      if (kolom) {
        const x = plek.x === 1 ? f.breedte - rand - blokB : rand;
        legenda = {
          x, y: veld.y + legendakop + Math.max(0, veld.h - blokH) * plek.y,
          b: blokB, h: gemeten.hoogte, richting: legendarichting, gemeten
        };
        if (plek.x === 1) knip(veld.x, veld.y, x - gat - veld.x, veld.h);
        else knip(rand + blokB + gat, veld.y, veld.x + veld.b - (rand + blokB + gat), veld.h);
      } else {
        // 0,5 (rechts, midden) heeft in een band geen zinnige hoogte: onder.
        const boven = plek.y === 0;
        const y = boven ? veld.y : veld.y + veld.h - blokH;
        legenda = {
          x: rand + (f.breedte - 2 * rand - blokB) * plek.x, y: y + legendakop,
          b: blokB, h: gemeten.hoogte, richting: legendarichting, gemeten
        };
        if (boven) knip(veld.x, y + blokH + gat, veld.b, veld.y + veld.h - (y + blokH + gat));
        else knip(veld.x, veld.y, veld.b, y - gat - veld.y);
      }
    }

    // De provincie vult de vrije ruimte; het omringende land en het water lopen
    // eromheen door tot de beeldrand.
    const s = Math.min(vrij.b * 0.94 / bb.b, vrij.h * 0.90 / bb.h);
    const tx = vrij.x + vrij.b / 2 - (bb.x + bb.b / 2) * s;
    const ty = vrij.y + vrij.h / 2 - (bb.y + bb.h / 2) * s;

    return {
      f, k, m: rand, richting, kaartrichting: 0.5, vol: true,
      titelRegels: kop.titelRegels, onderRegels: kop.onderRegels, titelEinde: rand + kop.hoogte,
      titelVak: { x: rand, b: f.breedte - 2 * rand, y: rand },
      bronVak: { x: rand, b: f.breedte - 2 * rand, y: f.hoogte - rand + f.brongrootte * 0.1 },
      kaart: vak, vak, vrij, legenda, items,
      transform: { s, tx, ty }, bodem: f.hoogte, bronHoogte
    };
  }

  /* ------------------------------------------------------------ tekenen */

  function tekenKaart(ctx, staat, formaat, hulp) {
    const ind = berekenIndeling(ctx, staat, formaat, hulp);
    const { f, k, m } = ind;
    const thema = ACHTERGRONDEN[staat.achtergrond] || ACHTERGRONDEN.wit;

    ctx.save();
    ctx.clearRect(0, 0, f.breedte, f.hoogte);
    // vlak === null: achtergrond blijft doorzichtig, zodat de PNG over een
    // eigen ondergrond gelegd kan worden
    if (thema.vlak) {
      ctx.fillStyle = thema.vlak;
      ctx.fillRect(0, 0, f.breedte, f.hoogte);
    }

    // Beeldvullend ligt alle tekst op de kaart zelf, niet op de paginakleur.
    // De leesbare kleur volgt dus wat eronder ligt: water, omringend land of
    // de achtergrond.
    const opkaart = ind.vol ? leesbaarOp(tvOndergrond(staat, thema)) : null;

    /* --- kaart --- */
    // Eerst de kaart, dan de tekst: beeldvullend hoort de titel bovenop te
    // liggen. In het kader raken ze elkaar toch niet.
    ctx.save();
    rondeRechthoek(ctx, ind.vak.x, ind.vak.y, ind.vak.b, ind.vak.h,
                   ind.vol ? 0 : Math.round(14 * ind.k._s));
    ctx.clip();
    tekenKaartvlak(ctx, staat, ind, hulp);
    ctx.restore();

    /* --- titel --- */
    const titelX = ind.titelVak.x + ind.titelVak.b * ind.richting;
    ctx.textAlign = ind.richting === 0 ? "left" : ind.richting === 1 ? "right" : "center";
    ctx.textBaseline = "alphabetic";
    let ty = ind.titelVak.y;
    if (ind.titelRegels.length) {
      zetLetter(ctx, "700", f.titelgrootte);
      ctx.fillStyle = opkaart || thema.tekst;
      ind.titelRegels.forEach(regel => {
        ty += f.titelgrootte * 1.16;
        ctx.fillText(regel, titelX, ty - f.titelgrootte * 0.22);
      });
    }
    if (ind.onderRegels.length) {
      zetLetter(ctx, "400", f.ondertitelgrootte);
      ctx.fillStyle = opkaart || thema.zacht;
      if (ind.titelRegels.length) ty += 10;
      ind.onderRegels.forEach(regel => {
        ty += f.ondertitelgrootte * 1.3;
        ctx.fillText(regel, titelX, ty - f.ondertitelgrootte * 0.3);
      });
    }
    ctx.textAlign = "left";

    /* --- legenda --- */
    if (ind.legenda) {
      const legendakleur = opkaart || thema.tekst;
      let ly = ind.legenda.y;
      if ((staat.legenda.titel || "").trim()) {
        zetLetter(ctx, "600", k.legendaTekst + 2);
        ctx.fillStyle = legendakleur;
        ctx.textBaseline = "alphabetic";
        if (ind.legenda.richting === "verticaal") {
          ctx.fillText(staat.legenda.titel, ind.legenda.x, ly - 12);
        } else {
          ctx.fillText(staat.legenda.titel, ind.legenda.x, ly - 12);
        }
      }
      tekenLegenda(ctx, ind.legenda.gemeten, ind.legenda.x, ly, ind.legenda.richting, legendakleur, k, hulp);
    }

    /* --- bronregel --- */
    // Altijd, ook beeldvullend: de vermelding is een licentievoorwaarde en
    // geen opmaakkeuze.
    zetLetter(ctx, "400", f.brongrootte);
    ctx.fillStyle = opkaart || thema.zacht;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(bronTekst(staat), ind.bronVak.x + ind.bronVak.b, ind.bronVak.y);
    ctx.textAlign = "left";

    ctx.restore();
    return ind;
  }

  /* Uitgelichte vlakken. Was ooit een enkele code, is nu een lijst; oudere
     opgeslagen kaarten leveren nog de enkele waarde aan. */
  function uitgelichteSet(b) {
    const v = b && b.uitgelicht;
    if (Array.isArray(v)) return new Set(v.filter(Boolean));
    return new Set(v ? [v] : []);
  }

  function tekenKaartvlak(ctx, staat, ind, hulp) {
    const { s, tx, ty } = ind.transform;
    const b = staat.basiskaart;
    const thema = ACHTERGRONDEN[staat.achtergrond] || ACHTERGRONDEN.wit;

    ctx.save();
    ctx.setTransform(s, 0, 0, s, tx, ty);

    // water als achtergrond binnen het kaartvlak
    if (b.water) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = kaartdata.kleuren.water;
      ctx.fillRect(ind.vak.x, ind.vak.y, ind.vak.b, ind.vak.h);
      ctx.setTransform(s, 0, 0, s, tx, ty);
    }

    const gebied = gebiedVan(staat);

    // Duitsland en Belgie, onder alles wat Nederlands is. De vorm loopt met
    // opzet 1,5 km over de grens heen; de contextlaag en de gemeenten dekken
    // dat af, zodat de zichtbare naad de Nederlandse grens uit de BRK blijft.
    if (b.context && buitenlanddata && gebied.soort === "overijssel") {
      ctx.fillStyle = b.buitenlandkleur || buitenlanddata.kleur;
      ctx.fill(pad("buitenland", buitenlanddata.pad));
    }

    // omringend land — alleen bij de Overijsselkaart; de Nederlandkaart heeft
    // geen contextlaag, daar is het land zelf het onderwerp
    if (b.context && gebied.soort === "overijssel") {
      ctx.save();
      ctx.clip(pad("masker", kaartdata.context.masker));
      ctx.fillStyle = kaartdata.kleuren.context_land;
      ctx.fill(pad("land", kaartdata.context.land));
      ctx.restore();
      ctx.strokeStyle = kaartdata.kleuren.context_lijn;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = lijn(LIJN.context, s) / s;
      ctx.stroke(pad("lijnen", kaartdata.context.lijnen));
      ctx.globalAlpha = 1;
    }

    // de vlakken zelf: gemeenten of provincies
    const vulling = vulKleur(b);
    const kleurVan = hulp.gemeentekleur;
    const uit = uitgelichteSet(b);
    // De uitgelichte vlakken gaan als laatste, zodat hun rand niet door de
    // buren wordt overgetekend — dezelfde volgorde als in de fase 2-pijplijn.
    const volgorde = Object.keys(gebied.vlakken)
      .filter(c => !uit.has(c))
      .concat(Object.keys(gebied.vlakken).filter(c => uit.has(c)));
    volgorde.forEach(code => {
      const p = pad(gebied.sleutel + code, gebied.vlakken[code].d);
      const basis = uit.has(code) ? (b.uitlichtkleur || "#1361FF") : vulling;
      const kleur = kleurVan ? kleurVan(code, basis) : basis;
      if (kleur === "arcering") {
        ctx.fillStyle = vulling;
        ctx.fill(p);
        ctx.save();
        ctx.clip(p);
        tekenArcering(ctx, s, gebied.bbox);
        ctx.restore();
      } else {
        ctx.fillStyle = kleur;
        ctx.fill(p);
      }
    });

    // gemeentegrenzen
    if (b.gemeentegrenzen && (b.grensdikte === undefined || b.grensdikte > 0)) {
      ctx.strokeStyle = b.grenskleur || "#FFFFFF";
      ctx.lineWidth = lijn(LIJN.gemeente * (b.grensdikte || 1), s) / s;
      ctx.lineJoin = "round";
      volgorde.forEach(code => ctx.stroke(pad(gebied.sleutel + code, gebied.vlakken[code].d)));
    }

    // water in de provincie
    if (b.wateren && gebied.soort === "overijssel") {
      ctx.fillStyle = kaartdata.kleuren.water;
      ctx.strokeStyle = kaartdata.kleuren.water;
      ctx.lineWidth = lijn(LIJN.water, s) / s;
      Object.keys(kaartdata.wateren).forEach(naam => {
        const w = kaartdata.wateren[naam];
        if (w.vlak) ctx.fill(pad("w:" + naam, w.vlak));
        if (w.lijn) ctx.stroke(pad("wl:" + naam, w.lijn));
      });
    }

    // provinciecontour
    if (b.provinciecontour && (b.contourdikte === undefined || b.contourdikte > 0)) {
      ctx.strokeStyle = b.contourkleur || "#FFFFFF";
      ctx.lineWidth = lijn(LIJN.provincie * (b.contourdikte || 1), s) / s;
      ctx.lineJoin = "round";
      ctx.stroke(pad(gebied.sleutel + "_contour", gebied.contour));
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const naarScherm = (x, y) => ({ x: x * s + tx, y: y * s + ty });

    // Alle geplaatste tekstvakken, zodat latere labels eromheen kunnen wijken.
    const genomen = [];

    // Welke vlakken hun naam krijgen: geen, allemaal, of alleen de uitgelichte.
    const naamVan = code => {
      if (b.namen === "alle") return true;
      if (b.namen === "uitgelicht") return uit.has(code);
      return false;
    };

    // gemeentelabels en waarden uit de vlaklaag
    if (staat.vlaklaag.actief && staat.vlaklaag.label !== "geen") {
      Object.keys(gebied.vlakken).forEach(code => {
        const g = gebied.vlakken[code];
        let tekst = hulp.gemeentelabel(code);
        // Vlakken zonder waarde krijgen geen label. Staan de namen aan, dan is
        // de naam de terugval — zo sluiten de twee keuzes elkaar niet uit.
        if ((!tekst || !tekst.length) && naamVan(code)) tekst = [{ tekst: g.naam, groot: false }];
        if (!tekst || !tekst.length) return;
        const p = naarScherm(g.labelX, g.labelY);
        const basis = uit.has(code) ? (b.uitlichtkleur || "#1361FF") : vulKleur(b);
        const achter = hulp.gemeentekleur ? hulp.gemeentekleur(code, basis) : basis;
        const tekstkleur = leesbaarOp(achter === "arcering" ? basis : achter);
        tekenGemeenteLabel(ctx, tekst, p.x, p.y, ind.k, tekstkleur, genomen);
      });
    } else if (b.namen && b.namen !== "geen") {
      Object.keys(gebied.vlakken).forEach(code => {
        if (!naamVan(code)) return;
        const g = gebied.vlakken[code];
        const p = naarScherm(g.labelX, g.labelY);
        const achter = uit.has(code) ? (b.uitlichtkleur || "#1361FF") : vulKleur(b);
        tekenGemeenteLabel(ctx, [g.naam], p.x, p.y, ind.k, leesbaarOp(achter), genomen);
      });
    }

    // plaatsen van de basiskaart
    if (b.plaatsen !== "geen") {
      const lijst = hulp.basisplaatsen(b.plaatsen);
      // Hoe meer plaatsen op de kaart, hoe kleiner de naam. Bij 37 kernen vanaf
      // 5.000 inwoners past de normale maat er domweg niet meer op.
      const grootte = Math.round(ind.k.plaatslabel * naamFactor(lijst.length));
      const straal = Math.max(3, Math.round(grootte * 0.24));

      lijst.forEach(pl => {
        const p = naarScherm(pl.x, pl.y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, pl.hoofdstad ? straal * 1.3 : straal, 0, Math.PI * 2);
        ctx.fillStyle = "#131720";
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = Math.max(1.2, straal * 0.4);
        ctx.stroke();
        genomen.push({ x: p.x - straal, y: p.y - straal, b: straal * 2, h: straal * 2 });
      });

      // Namen pas na alle stippen, en met dezelfde uitwijkregels als de punt-
      // laag: grootste plaats eerst, acht kandidaatposities, minste overlap wint.
      const opGrootte = [...lijst].sort((a, c) => (c.inwoners || 0) - (a.inwoners || 0));
      opGrootte.forEach(pl => {
        const p = naarScherm(pl.x, pl.y);
        zetLetter(ctx, pl.hoofdstad ? "600" : "500", grootte);
        plaatsEtiket(ctx, pl.naam, p, straal + Math.round(grootte * 0.35), grootte, genomen, ind.vak, "#131720");
      });
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    // puntlaag
    if (staat.puntlaag.actief) tekenPunten(ctx, staat, ind, hulp, naarScherm, genomen);

    // tekstlaag
    if (staat.tekstlaag.actief) tekenTekstblokken(ctx, staat, ind, hulp, naarScherm);

    ctx.restore();
  }

  function tekenArcering(ctx, s, bb) {
    ctx.strokeStyle = "rgba(19,23,32,.24)";
    ctx.lineWidth = 1.2 / s;
    const stap = 9 / s;
    ctx.beginPath();
    for (let d = bb.x - bb.h; d < bb.x + bb.b + bb.h; d += stap) {
      ctx.moveTo(d, bb.y);
      ctx.lineTo(d + bb.h, bb.y + bb.h);
    }
    ctx.stroke();
  }

  function tekenGemeenteLabel(ctx, regels, x, y, k, kleur, genomen) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const n = regels.length;
    regels.forEach((regel, i) => {
      const groot = regel.groot ? k.waardelabel : k.gemeentelabel;
      zetLetter(ctx, regel.groot ? "700" : "500", groot);
      const tekst = regel.tekst !== undefined ? regel.tekst : regel;
      const dy = (i - (n - 1) / 2) * (groot * 1.15);
      omlijndeTekst(ctx, tekst, x, y + dy, kleur);
      if (genomen) {
        const b = ctx.measureText(tekst).width;
        genomen.push({ x: x - b / 2, y: y + dy - groot / 2, b, h: groot });
      }
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Tekst met een dunne contour in de tegenkleur: houdt labels leesbaar waar
  // ze over een grens of over water heen vallen.
  function omlijndeTekst(ctx, tekst, x, y, kleur) {
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = kleur === "#FFFFFF" ? "rgba(19,23,32,.55)" : "rgba(255,255,255,.85)";
    ctx.strokeText(tekst, x, y);
    ctx.fillStyle = kleur;
    ctx.fillText(tekst, x, y);
  }

  function tekenPunten(ctx, staat, ind, hulp, naarScherm, genomen) {
    const P = staat.puntlaag;
    const k = ind.k;
    const grenzen = hulp.belgrenzen;

    P.punten.forEach(punt => {
      const p = naarScherm(punt.x, punt.y);
      const kleur = hulp.puntkleur(punt);
      if (P.weergave === "icoon") {
        const afb = hulp.icoon(punt.icoonId || P.icoonId);
        if (afb) {
          const v = pasIn(afb.width, afb.height, P.icoongrootte, P.icoongrootte);
          ctx.drawImage(afb, p.x - v.b / 2, p.y - v.h / 2, v.b, v.h);
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = kleur; ctx.fill();
        }
      } else if (P.weergave === "bel" && grenzen) {
        const r = grenzen.straal(Number(punt.waarde) || 0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = kleur;
        ctx.globalAlpha = 0.72;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();
      } else {
        const r = P.stipgrootte / 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = kleur;
        ctx.fill();
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();
      }
    });

    // Labels apart, zodat ze altijd bovenop de symbolen liggen. Per label
    // worden vier posities geprobeerd; de eerste die nergens tegenaan botst
    // wint. Botst alles, dan blijft de voorkeurspositie staan — een label laten
    // verdwijnen is voor een redactietool erger dan een label dat schuurt.
    if (P.label !== "geen") {
      // De symbolen zelf zijn ook obstakels: een label hoort niet over een bel
      // of stip heen te vallen.
      P.punten.forEach(punt => {
        const p = naarScherm(punt.x, punt.y);
        let r = P.stipgrootte / 2;
        if (P.weergave === "bel" && grenzen) r = grenzen.straal(Number(punt.waarde) || 0);
        else if (P.weergave === "icoon") r = P.icoongrootte / 2;
        genomen.push({ x: p.x - r, y: p.y - r, b: r * 2, h: r * 2 });
      });

      // grootste waarden eerst: die verdienen de beste plek
      const opVolgorde = [...P.punten].sort((a, b) => (Number(b.waarde) || 0) - (Number(a.waarde) || 0));
      zetLetter(ctx, "600", k.puntlabel);
      opVolgorde.forEach(punt => {
        const p = naarScherm(punt.x, punt.y);
        const tekst = puntLabel(punt, P);
        if (!tekst) return;
        let afstand;
        if (P.weergave === "bel" && grenzen) afstand = grenzen.straal(Number(punt.waarde) || 0) + 8;
        else if (P.weergave === "icoon") afstand = P.icoongrootte / 2 + 6;
        else afstand = P.stipgrootte / 2 + 8;

        plaatsEtiket(ctx, tekst, p, afstand, k.puntlabel, genomen, ind.vak, "#131720", punt.labelpositie);
      });
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }
  }

  const POSITIES = ["onder", "boven", "rechts", "links", "rechtsonder", "linksonder", "rechtsboven", "linksboven"];

  // Naamgrootte omgekeerd evenredig met het aantal plaatsen op de kaart.
  function naamFactor(aantal) {
    if (aantal <= 5) return 1.12;
    if (aantal <= 12) return 1;
    if (aantal <= 25) return 0.84;
    if (aantal <= 40) return 0.72;
    return 0.63;
  }

  // Eén label plaatsen en tekenen. Geen enkel label wordt weggelaten — dat is
  // voor een redactietool erger dan een label dat schuurt. In plaats daarvan
  // wint de positie met de minste overlap, waarbij buiten het kaartvlak vallen
  // zwaar telt omdat de clip het daar toch afsnijdt.
  function plaatsEtiket(ctx, tekst, p, afstand, hoogte, genomen, kader, kleur, voorkeur) {
    const breedte = ctx.measureText(tekst).width;
    const eerst = voorkeur || "onder";
    const kandidaten = [eerst].concat(POSITIES.filter(v => v !== eerst));
    let beste = null;
    kandidaten.forEach((pos, i) => {
      const vak = puntLabelVak(p, pos, afstand, breedte, hoogte);
      const straf = overlap(vak, genomen) + buitenVak(vak, kader) * 10 + i * 0.5;
      if (!beste || straf < beste.straf) beste = { vak, straf };
    });

    // Steekt het beste vak er nog steeds uit — bij een plaats pal tegen de rand
    // kan dat — dan schuift het label naar binnen. Een label half afgesneden
    // door de clip is erger dan een label dat iets van zijn stip af staat.
    const speling = 4;
    beste.vak.x = Math.max(kader.x + speling, Math.min(beste.vak.x, kader.x + kader.b - breedte - speling));
    beste.vak.y = Math.max(kader.y + speling, Math.min(beste.vak.y, kader.y + kader.h - hoogte - speling));
    genomen.push(beste.vak);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    omlijndeTekst(ctx, tekst, beste.vak.x + breedte / 2, beste.vak.y + hoogte / 2, kleur);
    return beste.vak;
  }

  function puntLabelVak(p, pos, afstand, breedte, hoogte) {
    const schuin = afstand * 0.72 + 4;
    switch (pos) {
      case "boven":       return { x: p.x - breedte / 2, y: p.y - afstand - hoogte * 1.1, b: breedte, h: hoogte };
      case "links":       return { x: p.x - afstand - 6 - breedte, y: p.y - hoogte / 2, b: breedte, h: hoogte };
      case "rechts":      return { x: p.x + afstand + 6, y: p.y - hoogte / 2, b: breedte, h: hoogte };
      case "rechtsonder": return { x: p.x + schuin, y: p.y + schuin, b: breedte, h: hoogte };
      case "linksonder":  return { x: p.x - schuin - breedte, y: p.y + schuin, b: breedte, h: hoogte };
      case "rechtsboven": return { x: p.x + schuin, y: p.y - schuin - hoogte, b: breedte, h: hoogte };
      case "linksboven":  return { x: p.x - schuin - breedte, y: p.y - schuin - hoogte, b: breedte, h: hoogte };
      default:            return { x: p.x - breedte / 2, y: p.y + afstand + hoogte * 0.1, b: breedte, h: hoogte };
    }
  }

  function overlap(vak, lijst) {
    let som = 0;
    for (const a of lijst) {
      const b = Math.min(vak.x + vak.b, a.x + a.b) - Math.max(vak.x, a.x);
      const h = Math.min(vak.y + vak.h, a.y + a.h) - Math.max(vak.y, a.y);
      if (b > 0 && h > 0) som += b * h;
    }
    return som;
  }

  // Hoeveel oppervlak van het label valt buiten het kaartvlak? Daar wordt het
  // toch weggeknipt door de clip, dus dat telt zwaar mee.
  function buitenVak(vak, kader) {
    const b = Math.min(vak.x + vak.b, kader.x + kader.b) - Math.max(vak.x, kader.x);
    const h = Math.min(vak.y + vak.h, kader.y + kader.h) - Math.max(vak.y, kader.y);
    const binnen = b > 0 && h > 0 ? b * h : 0;
    return vak.b * vak.h - binnen;
  }

  function puntLabel(punt, P) {
    const naam = punt.naam || "";
    const waarde = punt.waarde === "" || punt.waarde === null || punt.waarde === undefined
      ? "" : formatGetal(Number(punt.waarde)) + (P.eenheid ? " " + P.eenheid : "");
    if (P.label === "naam") return naam;
    if (P.label === "waarde") return waarde;
    if (P.label === "naam-waarde") return waarde ? naam + " " + waarde : naam;
    return "";
  }

  function tekenTekstblokken(ctx, staat, ind, hulp, naarScherm) {
    const k = ind.k;
    staat.tekstlaag.blokken.forEach(blok => {
      const p = naarScherm(blok.x, blok.y);
      const tekst = (blok.tekst || "").trim();
      if (!tekst) return;
      const maxB = blok.breedte || 340;
      zetLetter(ctx, "500", k.tekstblok);
      const regels = tekst.split("\n").flatMap(r => breekTekst(ctx, r, maxB));
      const regelhoogte = k.tekstblok * 1.32;
      const hoogte = regels.length * regelhoogte;
      let breedte = Math.max(...regels.map(r => ctx.measureText(r).width));

      const vulkleur = blok.vulling || "#FFFFFF";
      const tekstkleur = leesbaarOp(vulkleur);
      const pad2 = 14;

      // verbindingslijn naar het ankerpunt
      if (blok.lijn && blok.ankerX !== null && blok.ankerX !== undefined) {
        const a = naarScherm(blok.ankerX, blok.ankerY);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = blok.lijnkleur || "#131720";
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(a.x, a.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = blok.lijnkleur || "#131720";
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.8; ctx.stroke();
      }

      if (blok.kader !== false) {
        ctx.fillStyle = vulkleur;
        rondeRechthoek(ctx, p.x - pad2, p.y - pad2, breedte + pad2 * 2, hoogte + pad2 * 2, 12);
        ctx.fill();
      }
      ctx.fillStyle = tekstkleur;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      regels.forEach((regel, i) => ctx.fillText(regel, p.x, p.y + i * regelhoogte + (regelhoogte - k.tekstblok) / 2));
      ctx.textBaseline = "alphabetic";

      // alleen in het voorbeeld: bij export zou dit de sleepvakken overschrijven
      if (hulp.interactief) blok._vak = { x: p.x - pad2, y: p.y - pad2, b: breedte + pad2 * 2, h: hoogte + pad2 * 2 };
    });
  }

  /* ------------------------------------------------------------ export */

  return {
    PALET, AFGELEID, ALLE_KLEUREN, SCHALEN, CATEGORIEKLEUREN, ACHTERGRONDEN, VULLINGEN, FORMATEN,
    BRON_VAST, bronTekst, uitgelichteSet,
    zetData, gebiedVan, tekenKaart, berekenIndeling, schaalKleur, schaalVan, meng, verschuif,
    leesbaarOp, contrast, formatGetal, luminantie, hexNaarRgb, rondeRechthoek, pad,
    get data() { return kaartdata; }
  };
})();
