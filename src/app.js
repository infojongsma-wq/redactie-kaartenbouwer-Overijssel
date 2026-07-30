/* ==================================================================
   app.js — toestand, bediening en export van de Kaartenbouwer.
   ================================================================== */

(function () {
  "use strict";

  const KAART = JSON.parse(document.getElementById("kaartdata").textContent);
  const PLAATSEN = JSON.parse(document.getElementById("plaatsdata").textContent);
  const NEDERLAND = JSON.parse(document.getElementById("nederlanddata").textContent);
  const BUITENLAND = JSON.parse(document.getElementById("buitenlanddata").textContent);
  const NL_PLAATSEN = JSON.parse(document.getElementById("nlplaatsdata").textContent);
  Render.zetData(KAART, NEDERLAND, BUITENLAND);

  const $ = id => document.getElementById(id);
  const maak = (tag, klasse, tekst) => {
    const el = document.createElement(tag);
    if (klasse) el.className = klasse;
    if (tekst !== undefined) el.textContent = tekst;
    return el;
  };

  /* ------------------------------------------------------- gemeenten */

  // Twee gebiedsindelingen naast elkaar. De codes botsen niet (GM0141 tegenover
  // 23), dus ingevulde waarden voor gemeenten en provincies kunnen tegelijk in
  // dezelfde tabel staan: wisselen van kaartsoort gooit je invoer niet weg.
  const GEBIEDEN = {
    overijssel: Object.keys(KAART.gemeenten)
      .map(code => ({ code, naam: KAART.gemeenten[code].naam }))
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl")),
    nederland: Object.keys(NEDERLAND.provincies)
      .map(code => ({ code, naam: NEDERLAND.provincies[code].naam }))
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl"))
  };

  function vlakken() { return GEBIEDEN[staat.kaartsoort] || GEBIEDEN.overijssel; }
  function vlakNaam(code) {
    const g = vlakken().find(v => v.code === code);
    return g ? g.naam : code;
  }
  function vlakSoortWoord() { return staat.kaartsoort === "nederland" ? "provincies" : "gemeenten"; }

  const normaliseer = s => String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

  // Alternatieve schrijfwijzen die anders niet gevonden worden.
  const ALIASSEN = { "friesland": "Fryslân", "holland": null };

  const INDEXEN = {};
  Object.keys(GEBIEDEN).forEach(soort => {
    const index = new Map();
    GEBIEDEN[soort].forEach(g => {
      index.set(normaliseer(g.naam), g.code);
      index.set(normaliseer(g.code), g.code);
    });
    Object.keys(ALIASSEN).forEach(alias => {
      const naam = ALIASSEN[alias];
      if (!naam) return;
      const g = GEBIEDEN[soort].find(x => x.naam === naam);
      if (g) index.set(normaliseer(alias), g.code);
    });
    INDEXEN[soort] = index;
  });

  function zoekGemeente(tekst) {
    const index = INDEXEN[staat.kaartsoort] || INDEXEN.overijssel;
    const n = normaliseer(tekst);
    if (!n) return null;
    if (index.has(n)) return index.get(n);
    for (const [sleutel, code] of index) {
      if (sleutel.length > 3 && (sleutel.startsWith(n) || n.startsWith(sleutel))) return code;
    }
    return null;
  }

  /* --------------------------------------------------------- toestand */

  function nieuweStaat() {
    return {
      versie: 1,
      naam: "",
      titel: "",
      ondertitel: "",
      // Alleen de aanvulling; "Bron: Kadaster/PDOK" staat vast in render.js en
      // is een licentievoorwaarde, geen instelling.
      bronaanvulling: "",
      achtergrond: "wit",
      uitlijning: "midden",
      kaartuitlijning: "midden",
      formaat: "16:9",
      kaartsoort: "overijssel",
      weergave: "kader",
      basiskaart: {
        preset: "gemeenten", stijl: "tint",
        context: true, water: true, wateren: false,
        gemeentegrenzen: true, provinciecontour: true, namen: "geen",
        plaatsen: "geen",
        vulling: "#8FB8FF", grenskleur: "#FFFFFF", contourkleur: "#FFFFFF",
        grensdikte: 1, contourdikte: 1,
        buitenlandkleur: BUITENLAND.kleur,
        uitgelicht: ["23"], uitlichtkleur: "#1361FF"
      },
      vlaklaag: {
        actief: false, modus: "schaal", waarden: {}, categoriekleuren: {}, kleuren: {},
        schaal: "blauw", min: null, max: null, autogrens: true,
        eenheid: "", label: "geen", leeg: "grijs"
      },
      puntlaag: {
        actief: false, punten: [], weergave: "stip", kleur: "#FF4242",
        stipgrootte: 22, belmin: 10, belmax: 48, icoonId: null, icoongrootte: 42,
        label: "naam", eenheid: "", legendalabel: "Locatie", groepkleuren: {}
      },
      tekstlaag: { actief: false, blokken: [] },
      legenda: { titel: "", categorie: true, schaal: true, stip: true, bel: true, icoon: true, plaats: "rechts" }
    };
  }

  // Een opgeslagen kaart kan uit een oudere versie komen en sleutels missen die
  // inmiddels bestaan. Daarom wordt hij over de standaardtoestand heen gelegd in
  // plaats van die te vervangen — anders valt de tool om op een ontbrekend veld.
  function herstelStaat(geladen) {
    const basis = nieuweStaat();
    if (!geladen || typeof geladen !== "object") return basis;
    Object.keys(basis).forEach(sleutel => {
      const bron = geladen[sleutel];
      if (bron === undefined || bron === null) return;
      const standaard = basis[sleutel];
      if (standaard && typeof standaard === "object" && !Array.isArray(standaard)) {
        basis[sleutel] = Object.assign({}, standaard, bron);
      } else {
        basis[sleutel] = bron;
      }
    });
    // waarden uit oudere versies omzetten
    if (basis.uitlijning === "gecentreerd") basis.uitlijning = "midden";
    // De uitlijning gold vroeger voor titel en kaart samen; nu apart. Een
    // opgeslagen kaart mag daar niet door verschuiven.
    if (geladen.kaartuitlijning === undefined) basis.kaartuitlijning = basis.uitlijning;
    // "kaal" heette de tv-variant; het is nu een gewone weergavekeuze.
    if (geladen.weergave === undefined) basis.weergave = geladen.kaal ? "beeldvullend" : "kader";
    if (basis.weergave !== "beeldvullend") basis.weergave = "kader";
    // De bronregel was een vrij tekstveld. Wat er extra in stond blijft staan,
    // het vaste deel wordt er weer afgehaald — dat zet render.js er zelf voor.
    if (geladen.bronaanvulling === undefined && typeof geladen.bron === "string") {
      basis.bronaanvulling = geladen.bron
        .replace(/bron\s*:/i, "")
        .replace(/kadaster\s*\/?\s*pdok/i, "")
        .replace(/geonames/i, "")
        .replace(/\bkaart\s*:/i, "")
        .replace(/[\s\/·,;-]{2,}/g, " ")
        .replace(/^[\s\/·,;-]+|[\s\/·,;-]+$/g, "");
    }
    delete basis.bron;
    delete basis.kaal;
    if (!GEBIEDEN[basis.kaartsoort]) basis.kaartsoort = "overijssel";
    const b = basis.basiskaart;
    if (typeof b.vulling === "string" && b.vulling.charAt(0) !== "#") {
      const oud = { tint: "#8FB8FF", wit: "#FFFFFF", lichtblauw: "#E7EEF9" };
      b.vulling = oud[b.vulling] || "#8FB8FF";
    }
    // De namen van de vlakken waren een aan/uit-schakelaar; nu een keuze uit
    // drie, zodat "alleen het uitgelichte gebied" ook kan.
    const gb = geladen.basiskaart || {};
    if (gb.namen === undefined) b.namen = gb.gemeentenamen ? "alle" : "geen";
    if (b.namen === true || b.namen === false) b.namen = b.namen ? "alle" : "geen";
    delete b.gemeentenamen;
    // Uitlichten kon er maar een tegelijk; nu meerdere.
    if (!Array.isArray(b.uitgelicht)) b.uitgelicht = b.uitgelicht ? [b.uitgelicht] : [];
    b.uitgelicht = b.uitgelicht.filter(code => GEBIEDEN.nederland.some(v => v.code === code)
                                            || GEBIEDEN.overijssel.some(v => v.code === code));
    if (!b.buitenlandkleur) b.buitenlandkleur = BUITENLAND.kleur;
    // De legenda had twee plaatskeuzes, een voor het kader en een voor de kale
    // kaart. Het is er nu een; welke van de twee gold hangt af van de weergave.
    if (geladen.legenda && geladen.legenda.tvplaats !== undefined) {
      if (basis.weergave === "beeldvullend") basis.legenda.plaats = geladen.legenda.tvplaats;
      delete basis.legenda.tvplaats;
    }
    if (!Render.LEGENDAPLAATSEN.includes(basis.legenda.plaats)) basis.legenda.plaats = "rechts";
    if (!basis.vlaklaag.kleuren || typeof basis.vlaklaag.kleuren !== "object") basis.vlaklaag.kleuren = {};

    // identificaties niet laten botsen met bestaande punten en tekstblokken
    const gebruikt = []
      .concat(basis.puntlaag.punten || [], basis.tekstlaag.blokken || [])
      .map(x => parseInt(String(x.id || "").slice(1), 10))
      .filter(Number.isFinite);
    volgendeId = Math.max(volgendeId, ...gebruikt, 0) + 1;
    return basis;
  }

  let staat = nieuweStaat();
  let actieveKaartId = null;
  let volgendeId = 1;

  /* ---------------------------------------------------------- iconen */

  const ICOON_SLEUTEL = "kaartenbouwer.iconen";
  const BIB_SLEUTEL = "kaartenbouwer.bibliotheek";
  let iconen = [];                 // [{id, naam, data}]
  const icoonCache = new Map();    // id -> HTMLImageElement

  function laadIconen() {
    try { iconen = JSON.parse(localStorage.getItem(ICOON_SLEUTEL) || "[]"); }
    catch (e) { iconen = []; }
    iconen.forEach(i => laadIcoonAfbeelding(i));
  }

  function laadIcoonAfbeelding(icoon) {
    if (icoonCache.has(icoon.id)) return;
    const afb = new Image();
    afb.onload = () => teken();
    afb.src = icoon.data;
    icoonCache.set(icoon.id, afb);
  }

  function bewaarIconen() {
    try { localStorage.setItem(ICOON_SLEUTEL, JSON.stringify(iconen.filter(i => i.bewaard !== false))); }
    catch (e) { meld("bibliotheek-melding", "De opslag zit vol — icoon niet bewaard.", "fout"); }
  }

  /* ------------------------------------------------- afgeleide waarden */

  // alleen de waarden van de kaartsoort die nu getoond wordt
  function vlakWaarden() {
    return vlakken().map(v => staat.vlaklaag.waarden[v.code]).filter(Boolean);
  }

  function numeriekeGrenzen() {
    const getallen = vlakWaarden()
      .map(w => Number(w.waarde))
      .filter(v => Number.isFinite(v));
    if (!getallen.length) return null;
    if (staat.vlaklaag.autogrens || staat.vlaklaag.min === null || staat.vlaklaag.max === null) {
      return { min: Math.min(...getallen), max: Math.max(...getallen) };
    }
    return { min: Number(staat.vlaklaag.min), max: Number(staat.vlaklaag.max) };
  }

  function categorieen() {
    const gezien = [];
    vlakken().forEach(g => {
      const w = staat.vlaklaag.waarden[g.code];
      if (!w) return;
      const naam = String(w.waarde === undefined || w.waarde === null ? "" : w.waarde).trim();
      if (naam && !gezien.includes(naam)) gezien.push(naam);
    });
    return gezien.map((naam, i) => ({
      naam,
      kleur: staat.vlaklaag.categoriekleuren[naam] || Render.CATEGORIEKLEUREN[i % Render.CATEGORIEKLEUREN.length],
      aantal: vlakken().filter(g => {
        const w = staat.vlaklaag.waarden[g.code];
        return w && String(w.waarde).trim() === naam;
      }).length
    }));
  }

  function belGrenzen() {
    const getallen = staat.puntlaag.punten.map(p => Number(p.waarde)).filter(v => Number.isFinite(v) && v > 0);
    if (!getallen.length) return null;
    const min = Math.min(...getallen), max = Math.max(...getallen);
    const rmin = Number(staat.puntlaag.belmin) || 10;
    const rmax = Number(staat.puntlaag.belmax) || 48;
    const straal = v => {
      if (!Number.isFinite(v) || v <= 0) return rmin;
      if (max === min) return rmax;
      const t = (v - min) / (max - min);
      return Math.sqrt(rmin * rmin + t * (rmax * rmax - rmin * rmin));
    };
    const stappen = [max, min + (max - min) * 0.45, min].map(v => netGetal(v));
    return { min, max, straal, maxStraal: rmax, stappen: [...new Set(stappen)].filter(v => v > 0) };
  }

  function netGetal(v) {
    if (!Number.isFinite(v) || v === 0) return 0;
    const orde = Math.pow(10, Math.floor(Math.log10(Math.abs(v))));
    return Math.round(v / (orde / 2)) * (orde / 2);
  }

  // Punten kunnen een groep krijgen (derde kolom bij plakken). Elke groep
  // krijgt een eigen kleur, zodat een symbolenkaart met categorieen werkt.
  function puntgroepen() {
    const gezien = [];
    staat.puntlaag.punten.forEach(p => {
      const g = String(p.groep || "").trim();
      if (g && !gezien.includes(g)) gezien.push(g);
    });
    return gezien.map((naam, i) => ({
      naam,
      kleur: staat.puntlaag.groepkleuren[naam] || Render.CATEGORIEKLEUREN[i % Render.CATEGORIEKLEUREN.length]
    }));
  }

  // De plaatspunten komen uit TOP10NL en niet uit app_data.json: die laatste
  // liggen circa 7 px (700 m) naar het zuidoosten. Zo staan alle varianten in
  // hetzelfde, gecontroleerde assenstelsel.
  const HOOFDPLAATSEN_NAMEN = ["Zwolle", "Enschede", "Hengelo", "Deventer", "Almelo", "Kampen",
    "Oldenzaal", "Rijssen", "Steenwijk", "Raalte", "Hardenberg"];
  const STEDEN_NAMEN = ["Zwolle", "Enschede", "Deventer", "Hardenberg"];

  function kernOpNaam(naam) {
    const kandidaten = PLAATSEN.plaatsen.filter(p => p.naam === naam && p.soort === "woonkern");
    if (!kandidaten.length) return null;
    return kandidaten.reduce((a, b) => (b.inwoners > a.inwoners ? b : a));
  }

  function alsBasisplaats(p) {
    return { naam: p.naam, x: p.x, y: p.y, inwoners: p.inwoners, hoofdstad: p.naam === "Zwolle" };
  }

  function basisplaatsen(modus) {
    if (!modus || modus === "geen") return [];
    // De provinciehoofdsteden komen uit GeoNames en staan al in hetzelfde
    // assenstelsel; ze hebben geen inwonertal, dus krijgen ze de maat van een
    // hoofdplaats.
    if (modus === "hoofdsteden") {
      return NL_PLAATSEN.hoofdsteden.map(p => ({
        naam: p.naam, x: p.x, y: p.y, inwoners: 0, hoofdstad: p.provincie === "Overijssel"
      }));
    }
    if (modus === "hoofd" || modus === "steden") {
      const namen = modus === "hoofd" ? HOOFDPLAATSEN_NAMEN : STEDEN_NAMEN;
      return namen.map(kernOpNaam).filter(Boolean).map(alsBasisplaats);
    }
    const drempel = modus === "groot" ? 10000 : modus === "middel" ? 5000 : 2500;
    return PLAATSEN.plaatsen
      .filter(p => p.soort === "woonkern" && p.inwoners >= drempel)
      .map(alsBasisplaats);
  }

  function hulpObject(interactief) {
    const grenzen = numeriekeGrenzen();
    const cats = categorieen();
    const schaal = Render.schaalVan(staat.vlaklaag.schaal);
    const belg = belGrenzen();
    const groepen = puntgroepen();

    // Alle waarden in dezelfde notatie: staat er ergens een decimaal, dan
    // krijgt 3 ook "3,0". Anders lezen 3,2 en 3 in dezelfde kaart als twee
    // verschillende soorten getallen.
    let decimalen = 0;
    vlakWaarden().forEach(w => {
      const v = Number(w.waarde);
      if (!Number.isFinite(v)) return;
      const s2 = String(w.waarde);
      const punt = s2.indexOf(".");
      if (punt >= 0) decimalen = Math.max(decimalen, Math.min(2, s2.length - punt - 1));
    });

    const toonGetal = v => Number.isFinite(v)
      ? v.toLocaleString("nl-NL", { minimumFractionDigits: decimalen, maximumFractionDigits: decimalen })
      : Render.formatGetal(v);

    return {
      grenzen, categorieen: cats, belgrenzen: belg, puntgroepen: groepen,
      interactief: interactief !== false,
      puntkleur(punt) {
        if (punt.kleur) return punt.kleur;
        const g = String(punt.groep || "").trim();
        if (g) {
          const gevonden = groepen.find(x => x.naam === g);
          if (gevonden) return gevonden.kleur;
        }
        return staat.puntlaag.kleur;
      },
      gemeentekleur(code, basis) {
        if (!staat.vlaklaag.actief) return basis;
        // Een handmatig gekozen kleur wint van alles: zo kun je een vlak vullen
        // zonder er een waarde bij te bedenken.
        const eigen = staat.vlaklaag.kleuren[code];
        if (eigen) return eigen;
        const w = staat.vlaklaag.waarden[code];
        const heeft = w && String(w.waarde !== undefined && w.waarde !== null ? w.waarde : "").trim() !== "";
        if (!heeft) {
          if (staat.vlaklaag.leeg === "basis") return basis;
          if (staat.vlaklaag.leeg === "arcering") return "arcering";
          return "#C9D2DF";
        }
        if (staat.vlaklaag.modus === "categorie") {
          const cat = cats.find(c => c.naam === String(w.waarde).trim());
          return cat ? cat.kleur : basis;
        }
        const v = Number(w.waarde);
        if (!Number.isFinite(v) || !grenzen) return basis;
        const t = grenzen.max === grenzen.min ? 0.5 : (v - grenzen.min) / (grenzen.max - grenzen.min);
        return Render.schaalKleur(schaal, t);
      },
      gemeentelabel(code) {
        const modus = staat.vlaklaag.label;
        const w = staat.vlaklaag.waarden[code] || {};
        const naam = vlakNaam(code);
        const ruwe = w.waarde;
        const heeft = ruwe !== undefined && ruwe !== null && String(ruwe).trim() !== "";
        const getal = Number(ruwe);
        const waardetekst = !heeft ? "" :
          (Number.isFinite(getal) ? toonGetal(getal) : String(ruwe)) +
          (staat.vlaklaag.eenheid && Number.isFinite(getal) ? " " + staat.vlaklaag.eenheid : "");
        // Een label hoort bij een waarde. Zonder waarde geen label, ook niet de
        // kale naam: dan zou de kaart de gemeenten waar het juist niet over gaat
        // net zo hard benoemen. Wie toch alle namen wil, zet de laag
        // Gemeentenamen aan bij Basiskaart; die vult de rest dan in.
        if (modus === "naam") return heeft ? [{ tekst: naam, groot: false }] : [];
        if (modus === "waarde") return heeft ? [{ tekst: waardetekst, groot: true }] : [];
        if (modus === "naam-waarde") {
          return heeft ? [{ tekst: naam, groot: false }, { tekst: waardetekst, groot: true }] : [];
        }
        if (modus === "tekst") return w.tekst ? [{ tekst: w.tekst, groot: false }] : [];
        return [];
      },
      basisplaatsen,
      icoon(id) { return id ? icoonCache.get(id) || null : null; },
      icoonnaam(id) { const i = iconen.find(x => x.id === id); return i ? i.naam : ""; }
    };
  }

  /* ------------------------------------------------------- tekenen */

  const doek = $("doek");
  const ctx = doek.getContext("2d");
  let laatsteIndeling = null;
  let tekenGepland = false;

  function teken() {
    if (tekenGepland) return;
    tekenGepland = true;
    requestAnimationFrame(() => {
      tekenGepland = false;
      const f = Render.FORMATEN[staat.formaat];
      if (doek.width !== f.breedte || doek.height !== f.hoogte) {
        doek.width = f.breedte;
        doek.height = f.hoogte;
      }
      laatsteIndeling = Render.tekenKaart(ctx, staat, staat.formaat, hulpObject());
      // Het vaste deel van de bronregel groeit mee: staan er plaatsen uit
      // GeoNames op de kaart, dan komt die bron erbij.
      $("bron-vast").textContent = Render.bronTekst(Object.assign({}, staat, { bronaanvulling: "" }));
      werkVoetBij();
      if (mobielAan) tekenMobiel();
    });
  }

  function werkVoetBij() {
    const f = Render.FORMATEN[staat.formaat];
    const aantalVlak = vlakWaarden().length;
    const delen = [f.breedte + "×" + f.hoogte + " px"];
    if (staat.vlaklaag.actief) delen.push(vlakWaarden().length + " van " + vlakken().length + " " + vlakSoortWoord() + " met data");
    if (staat.puntlaag.actief) delen.push(staat.puntlaag.punten.length + " punten");
    if (staat.tekstlaag.actief) delen.push(staat.tekstlaag.blokken.length + " tekstblokken");
    $("voorbeeld-voet").textContent = delen.join("  ·  ");
    $("tel-vlak").textContent = staat.vlaklaag.actief && aantalVlak ? aantalVlak : "";
    $("tel-punt").textContent = staat.puntlaag.actief && staat.puntlaag.punten.length ? staat.puntlaag.punten.length : "";
    $("tel-tekst").textContent = staat.tekstlaag.actief && staat.tekstlaag.blokken.length ? staat.tekstlaag.blokken.length : "";
  }

  /* ----------------------------------------------------- mobielcheck */

  let mobielAan = false;
  let mobielVenster = null;

  function tekenMobiel() {
    if (!mobielVenster) {
      mobielVenster = maak("div", "mobielvenster");
      const c = maak("canvas");
      mobielVenster.appendChild(c);
      mobielVenster.appendChild(maak("div", "bijschrift", "540 px — mobiel"));
      $("doek-houder").appendChild(mobielVenster);
    }
    const c = mobielVenster.querySelector("canvas");
    const f = Render.FORMATEN[staat.formaat];
    const b = 540, h = Math.round(540 * f.hoogte / f.breedte);
    c.width = b; c.height = h;
    const k = c.getContext("2d");
    k.imageSmoothingQuality = "high";
    k.clearRect(0, 0, b, h);
    k.drawImage(doek, 0, 0, b, h);
  }

  $("knop-mobiel").addEventListener("click", () => {
    mobielAan = !mobielAan;
    $("knop-mobiel").classList.toggle("aan", mobielAan);
    if (!mobielAan && mobielVenster) { mobielVenster.remove(); mobielVenster = null; }
    else teken();
  });

  /* --------------------------------------------------- panelen open/dicht */

  document.querySelectorAll(".paneel-kop").forEach(kop => {
    kop.addEventListener("click", () => kop.parentElement.classList.toggle("open"));
  });

  /* --------------------------------------------------------- kaartpaneel */

  koppelTekst("in-titel", v => staat.titel = v);
  koppelTekst("in-ondertitel", v => staat.ondertitel = v);
  // Alleen de aanvulling is invoerbaar; het vaste deel staat als tekst naast
  // het veld en zit in render.js.
  koppelTekst("in-bronaanvulling", v => staat.bronaanvulling = v);
  koppelKeuze("in-achtergrond", v => {
    staat.achtergrond = v;
    $("transparant-hint").hidden = v !== "transparant";
  });
  koppelKeuze("in-uitlijning", v => staat.uitlijning = v);
  koppelKeuze("in-kaartuitlijning", v => staat.kaartuitlijning = v);
  $("in-weergave").addEventListener("change", () => {
    staat.weergave = $("in-weergave").value;
    vulAlles(); teken();
  });

  function koppelTekst(id, zet) {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => { zet(el.value); teken(); });
  }
  function koppelKeuze(id, zet) {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => { zet(el.value); teken(); });
  }

  /* ------------------------------------------------------ basiskaart */

  // De drie vulvarianten uit fase 2: vulling en lijnkleur horen bij elkaar.
  const STIJLEN = [
    { id: "tint",       naam: "Tint",       vulling: "#8FB8FF", grenskleur: "#FFFFFF", contourkleur: "#FFFFFF" },
    { id: "lichtblauw", naam: "Lichtblauw", vulling: "#E7EEF9", grenskleur: "#1361FF", contourkleur: "#1361FF" },
    { id: "wit",        naam: "Wit",        vulling: "#FFFFFF", grenskleur: "#1361FF", contourkleur: "#1361FF" }
  ];

  // De vier Nederlandvarianten uit build_fase2.py, letterlijk overgenomen zodat
  // de tool dezelfde kaarten maakt als de pijplijn van fase 2.
  const NL_STIJLEN = [
    { id: "nl-blauw",      naam: "Blauw",       achtergrond: "blauw",      vulling: "#E7EEF9", uitlichtkleur: "#131720", lijn: "#AFC4E0" },
    { id: "nl-wit",        naam: "Wit",         achtergrond: "wit",        vulling: "#1361FF", uitlichtkleur: "#E7EEF9", lijn: "#5B8CFF" },
    { id: "nl-lichtblauw", naam: "Lichtblauw",  achtergrond: "lichtblauw", vulling: "#1361FF", uitlichtkleur: "#FFFFFF", lijn: "#5B8CFF" },
    { id: "nl-omgekeerd",  naam: "Omgekeerd",   achtergrond: "lichtblauw", vulling: "#FFFFFF", uitlichtkleur: "#1361FF", lijn: "#AFC4E0" }
  ];

  const PRESETS = {
    overijssel: [
      { id: "gemeenten", naam: "Gemeenten", lagen: { context: true, water: true, wateren: false, gemeentegrenzen: true, provinciecontour: true, namen: "geen" }, plaatsen: "geen" },
      { id: "gemeenten-plaatsen", naam: "Gemeenten + plaatsen", lagen: { context: true, water: true, wateren: false, gemeentegrenzen: true, provinciecontour: true, namen: "geen" }, plaatsen: "hoofd" },
      { id: "water-plaatsen", naam: "Water + plaatsen", lagen: { context: true, water: true, wateren: true, gemeentegrenzen: false, provinciecontour: true, namen: "geen" }, plaatsen: "hoofd" },
      { id: "overzicht", naam: "Alles", lagen: { context: true, water: true, wateren: true, gemeentegrenzen: true, provinciecontour: true, namen: "alle" }, plaatsen: "hoofd" }
    ],
    nederland: [
      { id: "nl-provincies", naam: "Provincies", lagen: { gemeentegrenzen: true, provinciecontour: true, namen: "geen" }, plaatsen: "geen" },
      { id: "nl-namen", naam: "Met provincienamen", lagen: { gemeentegrenzen: true, provinciecontour: true, namen: "alle" }, plaatsen: "geen" },
      { id: "nl-uitgelicht", naam: "Alleen de uitgelichte naam", lagen: { gemeentegrenzen: true, provinciecontour: true, namen: "uitgelicht" }, plaatsen: "geen" },
      { id: "nl-hoofdsteden", naam: "Met hoofdsteden", lagen: { gemeentegrenzen: true, provinciecontour: true, namen: "geen" }, plaatsen: "hoofdsteden" }
    ]
  };

  function presets() { return PRESETS[staat.kaartsoort] || PRESETS.overijssel; }

  // De lagen heten anders op de twee kaarten: wat op de Overijsselkaart een
  // gemeentegrens is, is op de Nederlandkaart een provinciegrens, en de
  // contour is daar de buitengrens van het land. Zonder dat onderscheid zoek
  // je je suf naar waarom "provinciecontour" de binnengrenzen niet raakt.
  const LAAGNAMEN = {
    overijssel: [
      ["water", "Wateroppervlak als achtergrond"],
      ["context", "Omringend land (Nederland en Duitsland)"],
      ["wateren", "Rivieren, kanalen en plassen"],
      ["gemeentegrenzen", "Gemeentegrenzen"],
      ["provinciecontour", "Provinciecontour"]
    ],
    nederland: [
      ["water", "Wateroppervlak als achtergrond"],
      ["gemeentegrenzen", "Provinciegrenzen"],
      ["provinciecontour", "Buitengrens van Nederland"]
    ]
  };

  // Opschriften die met de kaartsoort meebewegen.
  const WOORDEN = {
    overijssel: {
      "label-namen": "Namen op de gemeenten",
      "label-vulling": "Vulling gemeenten",
      "label-grenskleur": "Kleur gemeentegrenzen",
      "label-contourkleur": "Kleur provinciecontour",
      "label-grensdikte": "Dikte gemeentegrens",
      "label-contourdikte": "Dikte provinciecontour",
      "label-vlak-leeg": "Gemeenten zonder data",
      "kop-vlaklaag": "Vlaklaag — gemeenten inkleuren",
      "hint-vlak-plak": "Plak twee kolommen uit een spreadsheet: gemeentenaam en waarde. Een derde kolom wordt als tekstlabel gebruikt."
    },
    nederland: {
      "label-namen": "Namen op de provincies",
      "label-vulling": "Vulling provincies",
      "label-grenskleur": "Kleur provinciegrenzen",
      "label-contourkleur": "Kleur buitengrens Nederland",
      "label-grensdikte": "Dikte provinciegrens",
      "label-contourdikte": "Dikte buitengrens",
      "label-vlak-leeg": "Provincies zonder data",
      "kop-vlaklaag": "Vlaklaag — provincies inkleuren",
      "hint-vlak-plak": "Plak twee kolommen uit een spreadsheet: provincienaam en waarde. Een derde kolom wordt als tekstlabel gebruikt."
    }
  };

  const PLAATSKEUZES = {
    overijssel: [
      ["geen", "Geen"],
      ["steden", "Vier steden — Zwolle, Enschede, Deventer, Hardenberg"],
      ["hoofd", "Elf grootste plaatsen"],
      ["groot", "Kernen vanaf 10.000 inwoners (22)"],
      ["middel", "Kernen vanaf 5.000 inwoners (37)"],
      ["klein", "Kernen vanaf 2.500 inwoners (57)"]
    ],
    nederland: [
      ["geen", "Geen"],
      ["hoofdsteden", "De twaalf provinciehoofdsteden"]
    ]
  };

  $("kaartsoortkeuze").querySelectorAll(".keuze").forEach(knop => {
    knop.addEventListener("click", () => {
      staat.kaartsoort = knop.dataset.waarde;
      // Elke kaartsoort heeft zijn eigen vanzelfsprekende ondergrond. Bij
      // Overijssel is de achtergrond water met omringend land eromheen. Bij
      // Nederland is er geen context — alles buiten het land zou dan water
      // worden, en een blauw uitgelicht gebied loopt daar tegen de oostgrens
      // in over. Daarom staat het waterveld daar uit.
      const b = staat.basiskaart;
      if (staat.kaartsoort === "nederland") {
        b.context = false; b.wateren = false; b.water = false;
        // De plaatsenlijst gaat alleen over Overijssel; op landschaal wordt dat
        // een kluitje stippen in het oosten. Standaard dus uit, aan te zetten
        // door wie er bewust een plaats bij wil.
        b.plaatsen = "geen";
        const st = NL_STIJLEN[2];        // lichtblauw: dezelfde als de fase 2-kaart
        b.vulling = st.vulling; b.uitlichtkleur = st.uitlichtkleur;
        b.grenskleur = st.lijn; b.contourkleur = st.lijn;
        b.grensdikte = 0.8; b.contourdikte = 0.8;
        staat.achtergrond = st.achtergrond;
        if (!b.uitgelicht.length) b.uitgelicht = ["23"];
      } else {
        b.context = true; b.water = true;
        b.plaatsen = "geen";
        const st = STIJLEN[0];
        b.vulling = st.vulling; b.grenskleur = st.grenskleur; b.contourkleur = st.contourkleur;
        b.grensdikte = 1; b.contourdikte = 1;
        staat.achtergrond = "wit";
      }
      b.preset = "";
      bouwBasiskaart();
      vulAlles(); teken();
    });
  });

  function bouwUitgelicht() {
    const houder = $("uitgelicht-lijst");
    if (!houder) return;
    houder.innerHTML = "";
    vlakken().forEach(v => {
      const l = maak("label", "schakel");
      const inv = maak("input");
      inv.type = "checkbox";
      inv.dataset.code = v.code;
      inv.addEventListener("change", () => {
        const uit = staat.basiskaart.uitgelicht.filter(c => c !== v.code);
        if (inv.checked) uit.push(v.code);
        staat.basiskaart.uitgelicht = uit;
        vulBasiskaart(); teken();
      });
      l.appendChild(inv);
      l.appendChild(maak("span", null, v.naam));
      houder.appendChild(l);
    });
  }

  function vulNederlandOpties() {
    const aan = staat.kaartsoort === "nederland";
    $("nederland-opties").hidden = !aan;
    $("kaartsoortkeuze").querySelectorAll(".keuze").forEach(k => k.classList.toggle("aan", k.dataset.waarde === staat.kaartsoort));
    if (aan) {
      const uit = new Set(staat.basiskaart.uitgelicht);
      $("uitgelicht-lijst").querySelectorAll("input").forEach(inv => { inv.checked = uit.has(inv.dataset.code); });
      bouwKleurkiezer($("kiezer-uitlicht"), staat.basiskaart.uitlichtkleur,
        kleur => { staat.basiskaart.uitlichtkleur = kleur; vulBasiskaart(); teken(); });
    }
    // Duitsland bestaat alleen op de Overijsselkaart
    $("buitenland-kleur").hidden = aan;
    const woorden = WOORDEN[staat.kaartsoort] || WOORDEN.overijssel;
    Object.keys(woorden).forEach(id => { if ($(id)) $(id).textContent = woorden[id]; });
  }

  function bouwStijlrij() {
    const stijlrij = $("basiskaart-stijlen");
    stijlrij.innerHTML = "";
    const lijst = staat.kaartsoort === "nederland" ? NL_STIJLEN : STIJLEN;
    lijst.forEach(st => {
      const knop = maak("button", "keuze", st.naam);
      knop.type = "button";
      knop.dataset.stijl = st.id;
      knop.addEventListener("click", () => {
        const b = staat.basiskaart;
        b.stijl = st.id;
        b.vulling = st.vulling;
        if (st.lijn) {
          // Nederlandvariant: een enkele fijne scheidingslijn, zoals in fase 2
          b.grenskleur = st.lijn;
          b.contourkleur = st.lijn;
          b.uitlichtkleur = st.uitlichtkleur;
          b.grensdikte = 0.8;
          b.contourdikte = 0.8;
          staat.achtergrond = st.achtergrond;
        } else {
          b.grenskleur = st.grenskleur;
          b.contourkleur = st.contourkleur;
        }
        vulAlles(); teken();
      });
      stijlrij.appendChild(knop);
    });
  }

  function bouwBasiskaart() {
    bouwStijlrij();
    bouwUitgelicht();
    const rij = $("basiskaart-presets");
    rij.innerHTML = "";
    presets().forEach(p => {
      const knop = maak("button", "keuze", p.naam);
      knop.type = "button";
      knop.dataset.preset = p.id;
      knop.addEventListener("click", () => {
        Object.assign(staat.basiskaart, p.lagen);
        staat.basiskaart.plaatsen = p.plaatsen;
        staat.basiskaart.preset = p.id;
        vulBasiskaart();
        teken();
      });
      rij.appendChild(knop);
    });

    const lagen = $("basiskaart-lagen");
    lagen.innerHTML = "";
    (LAAGNAMEN[staat.kaartsoort] || LAAGNAMEN.overijssel).forEach(([sleutel, label]) => {
      const l = maak("label", "schakel");
      const inv = maak("input");
      inv.type = "checkbox";
      inv.dataset.laag = sleutel;
      inv.addEventListener("change", () => {
        staat.basiskaart[sleutel] = inv.checked;
        staat.basiskaart.preset = "";
        vulBasiskaart();
        teken();
      });
      l.appendChild(inv);
      l.appendChild(maak("span", null, label));
      lagen.appendChild(l);
    });

    const keuze = $("in-basisplaatsen");
    keuze.innerHTML = "";
    (PLAATSKEUZES[staat.kaartsoort] || PLAATSKEUZES.overijssel).forEach(([waarde, label]) => {
      const o = document.createElement("option");
      o.value = waarde; o.textContent = label;
      keuze.appendChild(o);
    });
    // Een keuze die bij de andere kaartsoort hoort bestaat hier niet.
    if (!keuze.querySelector('option[value="' + staat.basiskaart.plaatsen + '"]')) {
      staat.basiskaart.plaatsen = "geen";
    }
  }

  function vulBasiskaart() {
    const b = staat.basiskaart;
    vulNederlandOpties();
    // de stijlknop licht alleen op zolang de kleuren nog bij de stijl horen
    const passend = staat.kaartsoort === "nederland"
      ? NL_STIJLEN.find(st => st.vulling === b.vulling && st.uitlichtkleur === b.uitlichtkleur
          && st.lijn === b.grenskleur && st.achtergrond === staat.achtergrond)
      : STIJLEN.find(st => st.vulling === b.vulling
          && st.grenskleur === b.grenskleur && st.contourkleur === b.contourkleur);
    b.stijl = passend ? passend.id : "";
    $("basiskaart-stijlen").querySelectorAll(".keuze").forEach(k => k.classList.toggle("aan", k.dataset.stijl === b.stijl));
    $("basiskaart-presets").querySelectorAll(".keuze").forEach(k => k.classList.toggle("aan", k.dataset.preset === b.preset));
    $("basiskaart-lagen").querySelectorAll("input").forEach(inv => { inv.checked = !!b[inv.dataset.laag]; });
    $("in-namen").value = b.namen;
    $("in-basisplaatsen").value = b.plaatsen;
    $("in-grensdikte").value = b.grensdikte;
    $("in-contourdikte").value = b.contourdikte;
    bouwKleurkiezer($("kiezer-vulling"), b.vulling, kleur => { b.vulling = kleur; vulBasiskaart(); teken(); });
    bouwKleurkiezer($("kiezer-grens"), b.grenskleur, kleur => { b.grenskleur = kleur; vulBasiskaart(); teken(); });
    bouwKleurkiezer($("kiezer-contour"), b.contourkleur, kleur => { b.contourkleur = kleur; vulBasiskaart(); teken(); });
    bouwKleurkiezer($("kiezer-buitenland"), b.buitenlandkleur, kleur => { b.buitenlandkleur = kleur; vulBasiskaart(); teken(); });
    const woorden = WOORDEN[staat.kaartsoort] || WOORDEN.overijssel;
    $("dikte-melding").textContent = "Op nul zet je de lijn uit. "
      + (b.grensdikte === 0 ? woorden["label-grenskleur"].replace("Kleur ", "").replace(/^./, c => c.toUpperCase()) + " staan uit. " : "")
      + (b.contourdikte === 0 ? "De buitenlijn staat uit." : "");
  }

  ["in-grensdikte", "in-contourdikte"].forEach(id => $(id).addEventListener("input", () => {
    staat.basiskaart[id === "in-grensdikte" ? "grensdikte" : "contourdikte"] = Number($(id).value);
    vulBasiskaart(); teken();
  }));
  $("in-basisplaatsen").addEventListener("change", () => { staat.basiskaart.plaatsen = $("in-basisplaatsen").value; staat.basiskaart.preset = ""; vulAlles(); teken(); });
  $("in-namen").addEventListener("change", () => { staat.basiskaart.namen = $("in-namen").value; staat.basiskaart.preset = ""; vulBasiskaart(); teken(); });

  /* --------------------------------------------------------- vlaklaag */

  $("in-vlak-actief").addEventListener("change", () => {
    staat.vlaklaag.actief = $("in-vlak-actief").checked;
    vulVlaklaag(); teken();
  });

  $("vlak-modus").querySelectorAll(".keuze").forEach(knop => {
    knop.addEventListener("click", () => {
      staat.vlaklaag.modus = knop.dataset.waarde;
      vulVlaklaag(); teken();
    });
  });

  $("knop-vlak-plak").addEventListener("click", verwerkVlakPlak);
  $("knop-vlak-leeg").addEventListener("click", () => {
    staat.vlaklaag.waarden = {};
    $("in-vlak-plak").value = "";
    meld("vlak-plak-melding", "");
    vulVlaklaag(); teken();
  });

  function splitsRegels(tekst) {
    return String(tekst).split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(regel => {
      const velden = regel.includes("\t") ? regel.split("\t")
        : regel.includes(";") ? regel.split(";")
        : regel.split(/ {2,}|,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      return velden.map(v => v.trim().replace(/^"|"$/g, ""));
    });
  }

  // Getallen komen uit een spreadsheet en kunnen dus in Nederlandse of Engelse
  // notatie staan. Staan er allebei scheidingstekens in, dan is de laatste het
  // decimaalteken. Staat er alleen een punt in, dan is "1.234" een duizendtal
  // (Nederlands) en "1.5" een decimaal — te herkennen aan de groepen van drie.
  function leesGetal(tekst) {
    if (tekst === undefined || tekst === null) return null;
    let t = String(tekst).trim().replace(/[€%\s]/g, "");
    if (!t) return null;
    const heeftKomma = t.includes(","), heeftPunt = t.includes(".");
    if (heeftKomma && heeftPunt) {
      if (t.lastIndexOf(",") > t.lastIndexOf(".")) t = t.replace(/\./g, "").replace(",", ".");
      else t = t.replace(/,/g, "");
    } else if (heeftKomma) {
      t = /^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
    } else if (heeftPunt) {
      if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    }
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  }

  function verwerkVlakPlak() {
    const regels = splitsRegels($("in-vlak-plak").value);
    if (!regels.length) { meld("vlak-plak-melding", "Niets om te verwerken.", "fout"); return; }
    let raak = 0;
    const mis = [];
    regels.forEach((velden, i) => {
      if (velden.length < 2) return;
      const code = zoekGemeente(velden[0]);
      if (!code) {
        // eerste regel is waarschijnlijk een kopregel
        if (i === 0) return;
        mis.push(velden[0]);
        return;
      }
      const getal = leesGetal(velden[1]);
      staat.vlaklaag.waarden[code] = {
        waarde: getal !== null ? getal : velden[1],
        tekst: velden[2] || ""
      };
      raak++;
    });
    const alleGetallen = vlakWaarden().every(w => Number.isFinite(Number(w.waarde)));
    if (raak && !alleGetallen && staat.vlaklaag.modus === "schaal") staat.vlaklaag.modus = "categorie";
    if (raak && !staat.vlaklaag.actief) { staat.vlaklaag.actief = true; }
    let bericht = raak + " van de " + vlakken().length + " " + vlakSoortWoord() + " ingevuld.";
    if (mis.length) bericht += " Niet herkend: " + mis.slice(0, 5).join(", ") + (mis.length > 5 ? " …" : "") + ".";
    meld("vlak-plak-melding", bericht, mis.length ? "fout" : "goed");
    vulVlaklaag(); teken();
  }

  function bouwVlakTabel() {
    const tabel = $("vlak-tabel");
    tabel.innerHTML = "";
    const kop = tabel.insertRow();
    [staat.kaartsoort === "nederland" ? "Provincie" : "Gemeente",
     staat.vlaklaag.modus === "categorie" ? "Categorie" : "Waarde", "Eigen tekst", "Kleur", ""].forEach(t => {
      const th = document.createElement("th");
      th.textContent = t;
      kop.appendChild(th);
    });
    vlakken().forEach(g => {
      const w = staat.vlaklaag.waarden[g.code] || {};
      const heeft = w.waarde !== undefined && String(w.waarde).trim() !== "";
      const rij = tabel.insertRow();
      if (!heeft) rij.className = "zonderdata";
      rij.insertCell().textContent = g.naam;

      const cel = rij.insertCell();
      const inv = maak("input");
      inv.type = "text";
      inv.value = w.waarde === undefined || w.waarde === null ? "" : w.waarde;
      inv.addEventListener("input", () => {
        const getal = leesGetal(inv.value);
        if (inv.value.trim() === "") delete staat.vlaklaag.waarden[g.code];
        else staat.vlaklaag.waarden[g.code] = { waarde: getal !== null ? getal : inv.value.trim(), tekst: (staat.vlaklaag.waarden[g.code] || {}).tekst || "" };
        werkVoetBij(); teken();
      });
      inv.addEventListener("blur", () => { vulVlaklaag(); });
      cel.appendChild(inv);

      const cel2 = rij.insertCell();
      const inv2 = maak("input");
      inv2.type = "text";
      inv2.value = w.tekst || "";
      inv2.addEventListener("input", () => {
        const huidig = staat.vlaklaag.waarden[g.code] || { waarde: "" };
        huidig.tekst = inv2.value;
        staat.vlaklaag.waarden[g.code] = huidig;
        teken();
      });
      cel2.appendChild(inv2);

      // Een eigen kleur mag ook zonder waarde: soms wil je gewoon één gemeente
      // aanzetten zonder dat er een cijfer bij hoort.
      const celK = rij.insertCell();
      const eigen = staat.vlaklaag.kleuren[g.code] || "";
      const knop = maak("button", "kleurknop" + (eigen ? " aan" : ""));
      knop.type = "button";
      knop.title = eigen ? "Eigen kleur — klik om te wijzigen" : "Eigen kleur kiezen";
      if (eigen) knop.style.background = eigen;
      knop.addEventListener("click", () => {
        toonKleurpopup(knop, eigen || staat.basiskaart.vulling, kleur => {
          if (kleur === null) delete staat.vlaklaag.kleuren[g.code];
          else staat.vlaklaag.kleuren[g.code] = kleur;
          vulVlaklaag(); teken();
        }, true);
      });
      celK.appendChild(knop);

      const cel3 = rij.insertCell();
      if (heeft || eigen) {
        const weg = maak("button", "weg", "×");
        weg.type = "button";
        weg.title = "Wissen";
        weg.addEventListener("click", () => {
          delete staat.vlaklaag.waarden[g.code];
          delete staat.vlaklaag.kleuren[g.code];
          vulVlaklaag(); teken();
        });
        cel3.appendChild(weg);
      }
    });
  }

  function bouwCategorielijst() {
    const houder = $("vlak-categorielijst");
    houder.innerHTML = "";
    categorieen().forEach(cat => {
      const rij = maak("div", "categorierij");
      const staal = maak("button", "staal");
      staal.type = "button";
      staal.style.background = cat.kleur;
      staal.addEventListener("click", e => {
        toonKleurpopup(e.currentTarget, cat.kleur, kleur => {
          staat.vlaklaag.categoriekleuren[cat.naam] = kleur;
          bouwCategorielijst(); teken();
        });
      });
      rij.appendChild(staal);
      rij.appendChild(maak("span", "naam", cat.naam));
      rij.appendChild(maak("span", "aantal", cat.aantal + "×"));
      houder.appendChild(rij);
    });
    if (!categorieen().length) houder.appendChild(maak("p", "hint", "Nog geen categorieën — vul waarden in."));
  }

  function vulVlaklaag() {
    $("in-vlak-actief").checked = staat.vlaklaag.actief;
    $("vlak-instellingen").hidden = !staat.vlaklaag.actief;
    $("vlak-modus").querySelectorAll(".keuze").forEach(k => k.classList.toggle("aan", k.dataset.waarde === staat.vlaklaag.modus));
    $("vlak-schaal-opties").hidden = staat.vlaklaag.modus !== "schaal";
    $("vlak-categorie-opties").hidden = staat.vlaklaag.modus !== "categorie";
    const g = numeriekeGrenzen();
    $("in-vlak-autogrens").checked = staat.vlaklaag.autogrens;
    $("in-vlak-min").disabled = staat.vlaklaag.autogrens;
    $("in-vlak-max").disabled = staat.vlaklaag.autogrens;
    if (staat.vlaklaag.autogrens && g) { $("in-vlak-min").value = g.min; $("in-vlak-max").value = g.max; }
    $("in-vlak-eenheid").value = staat.vlaklaag.eenheid;
    $("in-vlak-label").value = staat.vlaklaag.label;
    $("in-vlak-leeg").value = staat.vlaklaag.leeg;
    $("in-vlak-schaal").value = staat.vlaklaag.schaal;
    bouwVlakTabel();
    bouwCategorielijst();
    werkVoetBij();
  }

  (function vulSchaalKeuze() {
    const sel = $("in-vlak-schaal");
    Render.SCHALEN.forEach(s => {
      const o = document.createElement("option");
      o.value = s.id; o.textContent = s.naam;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => { staat.vlaklaag.schaal = sel.value; teken(); });
  })();

  $("in-vlak-autogrens").addEventListener("change", () => {
    staat.vlaklaag.autogrens = $("in-vlak-autogrens").checked;
    vulVlaklaag(); teken();
  });
  ["in-vlak-min", "in-vlak-max"].forEach(id => $(id).addEventListener("input", () => {
    staat.vlaklaag[id === "in-vlak-min" ? "min" : "max"] = $(id).value === "" ? null : Number($(id).value);
    teken();
  }));
  $("in-vlak-eenheid").addEventListener("input", () => { staat.vlaklaag.eenheid = $("in-vlak-eenheid").value; teken(); });
  $("in-vlak-label").addEventListener("change", () => { staat.vlaklaag.label = $("in-vlak-label").value; teken(); });
  $("in-vlak-leeg").addEventListener("change", () => { staat.vlaklaag.leeg = $("in-vlak-leeg").value; teken(); });

  /* --------------------------------------------------------- puntlaag */

  $("in-punt-actief").addEventListener("change", () => {
    staat.puntlaag.actief = $("in-punt-actief").checked;
    vulPuntlaag(); teken();
  });

  // zoeken met suggesties over alle 1074 plaatsen
  const zoekveld = $("in-punt-zoek");
  const suggestieHouder = $("punt-suggesties");
  let suggestieIndex = -1;

  // Waar de puntlaag in zoekt. Op de Overijsselkaart is dat TOP10NL: preciezer,
  // met inwonertallen en tot op buurtniveau. Op de Nederlandkaart komt daar
  // GeoNames bij, want anders vind je Maastricht niet. Overijsselse namen
  // blijven uit TOP10NL komen — dat bestand is voor die provincie beter.
  const GEONAMES_BUITEN_OVERIJSSEL = NL_PLAATSEN.plaatsen
    .filter(p => p.provincie !== "Overijssel")
    .map(p => ({ naam: p.naam, x: p.x, y: p.y, soort: "woonkern", inwoners: 0, provincie: p.provincie }));

  function zoekbron() {
    return staat.kaartsoort === "nederland"
      ? PLAATSEN.plaatsen.concat(GEONAMES_BUITEN_OVERIJSSEL)
      : PLAATSEN.plaatsen;
  }

  function zoekPlaatsen(term) {
    const n = normaliseer(term);
    if (n.length < 2) return [];
    const treffers = [];
    for (const p of zoekbron()) {
      const pn = normaliseer(p.naam);
      let score = -1;
      if (pn === n) score = 0;
      else if (pn.startsWith(n)) score = 1;
      else if (pn.includes(n)) score = 2;
      if (score >= 0) treffers.push({ p, score });
      if (treffers.length > 400) break;
    }
    const RANG = { woonkern: 0, deelkern: 1, gehucht: 2, buurtschap: 3, industriekern: 4, stadsdeel: 5, wijk: 6, buurt: 7 };
    treffers.sort((a, b) => a.score - b.score || RANG[a.p.soort] - RANG[b.p.soort]
                         || b.p.inwoners - a.p.inwoners || a.p.naam.localeCompare(b.p.naam, "nl"));
    return treffers.slice(0, 40).map(t => t.p);
  }

  /* Het zoekveld met suggesties zit op twee plekken: bij de puntlaag en bij het
     anker van een tekstblok. Beide gebruiken dezelfde lijst en dezelfde
     bediening met pijltjes en Enter, dus staat het hier een keer. */
  function koppelPlaatszoeker(veld, houder, kies) {
    let index = -1;

    function toon() {
      const lijst = zoekPlaatsen(veld.value);
      houder.innerHTML = "";
      index = -1;
      if (!lijst.length) { houder.hidden = true; return; }
      lijst.forEach(p => {
        const knop = maak("button");
        knop.type = "button";
        knop.appendChild(maak("span", null, p.naam));
        const bij = p.provincie ? "provincie " + p.provincie
                  : p.soort === "woonkern" ? "gemeente " + p.gemeente
                  : p.soort + " \u00b7 " + p.gemeente;
        knop.appendChild(maak("span", "soort", "  " + bij));
        knop.addEventListener("click", () => { houder.hidden = true; kies(p); });
        houder.appendChild(knop);
      });
      houder.hidden = false;
    }

    veld.addEventListener("input", toon);
    veld.addEventListener("focus", toon);
    veld.addEventListener("keydown", e => {
      const knoppen = [...houder.querySelectorAll("button")];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!knoppen.length) return;
        index = (index + (e.key === "ArrowDown" ? 1 : -1) + knoppen.length) % knoppen.length;
        knoppen.forEach((k, i) => k.classList.toggle("actief", i === index));
        knoppen[index].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        (knoppen[index >= 0 ? index : 0] || {}).click?.();
      } else if (e.key === "Escape") {
        houder.hidden = true;
      }
    });
    document.addEventListener("click", e => {
      if (!houder.contains(e.target) && e.target !== veld) houder.hidden = true;
    });
  }

  koppelPlaatszoeker(zoekveld, suggestieHouder, p => voegPuntToe(p));

  function voegPuntToe(plaats, positie) {
    staat.puntlaag.punten.push({
      id: "p" + (volgendeId++),
      naam: plaats ? plaats.naam : "Nieuw punt",
      // Waar het punt vandaan komt, zodat de bronregel kan kloppen. Zelf
      // aangewezen punten hebben geen herkomst.
      herkomst: (!positie && plaats && plaats.provincie) ? "GeoNames" : "",
      x: positie ? positie.x : plaats.x,
      y: positie ? positie.y : plaats.y,
      waarde: "",
      kleur: null,
      icoonId: null,
      groep: "",
      labelpositie: "onder"
    });
    if (!staat.puntlaag.actief) staat.puntlaag.actief = true;
    zoekveld.value = "";
    suggestieHouder.hidden = true;
    vulPuntlaag(); teken();
  }

  $("knop-punt-plak").addEventListener("click", () => {
    const regels = splitsRegels($("in-punt-plak").value);
    let raak = 0; const mis = [];
    regels.forEach((velden, i) => {
      const naam = velden[0];
      if (!naam) return;
      const gevonden = zoekPlaatsen(naam).find(p => normaliseer(p.naam) === normaliseer(naam)) || zoekPlaatsen(naam)[0];
      if (!gevonden) { if (i > 0 || regels.length === 1) mis.push(naam); return; }
      const getal = leesGetal(velden[1]);
      staat.puntlaag.punten.push({
        id: "p" + (volgendeId++), naam: gevonden.naam, x: gevonden.x, y: gevonden.y,
        herkomst: gevonden.provincie ? "GeoNames" : "",
        waarde: getal !== null ? getal : (velden[1] || ""), kleur: null, icoonId: null,
        groep: velden[2] || "", labelpositie: "onder"
      });
      raak++;
    });
    if (raak && !staat.puntlaag.actief) staat.puntlaag.actief = true;
    let bericht = raak + " punten toegevoegd.";
    if (mis.length) bericht += " Niet gevonden: " + mis.slice(0, 5).join(", ") + (mis.length > 5 ? " …" : "") + ".";
    meld("punt-plak-melding", bericht, mis.length ? "fout" : "goed");
    vulPuntlaag(); teken();
  });

  let klikModus = false;
  $("knop-punt-klik").addEventListener("click", () => zetKlikModus(!klikModus));
  function zetKlikModus(aan) {
    klikModus = aan;
    $("knop-punt-klik").classList.toggle("aan", aan);
    $("punt-klik-hint").hidden = !aan;
    doek.classList.toggle("klikmodus", aan);
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape") zetKlikModus(false); });

  $("in-punt-weergave").addEventListener("change", () => {
    staat.puntlaag.weergave = $("in-punt-weergave").value;
    vulPuntlaag(); teken();
  });
  ["in-bel-min", "in-bel-max", "in-icoon-grootte", "in-stip-grootte"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
      const sleutel = { "in-bel-min": "belmin", "in-bel-max": "belmax", "in-icoon-grootte": "icoongrootte", "in-stip-grootte": "stipgrootte" }[id];
      staat.puntlaag[sleutel] = Number(el.value);
      teken();
    });
  });
  $("in-punt-label").addEventListener("change", () => { staat.puntlaag.label = $("in-punt-label").value; teken(); });
  const puntEenheid = $("in-punt-eenheid");
  if (puntEenheid) puntEenheid.addEventListener("input", () => { staat.puntlaag.eenheid = puntEenheid.value; teken(); });
  const puntLegendalabel = $("in-punt-legendalabel");
  if (puntLegendalabel) puntLegendalabel.addEventListener("input", () => { staat.puntlaag.legendalabel = puntLegendalabel.value; teken(); });

  function bouwPuntTabel() {
    const tabel = $("punt-tabel");
    tabel.innerHTML = "";
    if (!staat.puntlaag.punten.length) return;
    const kop = tabel.insertRow();
    ["Plaats", "Waarde", "Groep", "Label", ""].forEach(t => {
      const th = document.createElement("th");
      th.textContent = t;
      kop.appendChild(th);
    });
    staat.puntlaag.punten.forEach(punt => {
      const rij = tabel.insertRow();
      const c0 = rij.insertCell();
      const naamInv = maak("input"); naamInv.type = "text"; naamInv.value = punt.naam;
      naamInv.addEventListener("input", () => { punt.naam = naamInv.value; teken(); });
      c0.appendChild(naamInv);

      const c1 = rij.insertCell();
      const wInv = maak("input"); wInv.type = "text"; wInv.value = punt.waarde;
      wInv.addEventListener("input", () => {
        const g = leesGetal(wInv.value);
        punt.waarde = g !== null ? g : wInv.value;
        teken();
      });
      c1.appendChild(wInv);

      const cg = rij.insertCell();
      const groepInv = maak("input"); groepInv.type = "text"; groepInv.value = punt.groep || "";
      groepInv.addEventListener("input", () => { punt.groep = groepInv.value; teken(); });
      groepInv.addEventListener("blur", () => { vulPuntlaag(); });
      cg.appendChild(groepInv);

      const c2 = rij.insertCell();
      const sel = maak("select");
      [["onder", "onder"], ["boven", "boven"], ["links", "links"], ["rechts", "rechts"]].forEach(([v, t]) => {
        const o = document.createElement("option"); o.value = v; o.textContent = t;
        sel.appendChild(o);
      });
      sel.value = punt.labelpositie || "onder";
      sel.addEventListener("change", () => { punt.labelpositie = sel.value; teken(); });
      c2.appendChild(sel);

      const c3 = rij.insertCell();
      const weg = maak("button", "weg", "×");
      weg.type = "button";
      weg.addEventListener("click", () => {
        staat.puntlaag.punten = staat.puntlaag.punten.filter(p => p !== punt);
        vulPuntlaag(); teken();
      });
      c3.appendChild(weg);
    });
  }

  function vulPuntlaag() {
    $("in-punt-actief").checked = staat.puntlaag.actief;
    $("punt-instellingen").hidden = !staat.puntlaag.actief;
    $("in-punt-weergave").value = staat.puntlaag.weergave;
    $("punt-bel-opties").hidden = staat.puntlaag.weergave !== "bel";
    $("punt-icoon-opties").hidden = staat.puntlaag.weergave !== "icoon";
    const stipOpties = $("punt-stip-opties");
    if (stipOpties) stipOpties.hidden = staat.puntlaag.weergave !== "stip";
    $("in-punt-label").value = staat.puntlaag.label;
    $("in-bel-min").value = staat.puntlaag.belmin;
    $("in-bel-max").value = staat.puntlaag.belmax;
    $("in-icoon-grootte").value = staat.puntlaag.icoongrootte;
    if ($("in-stip-grootte")) $("in-stip-grootte").value = staat.puntlaag.stipgrootte;
    if (puntEenheid) puntEenheid.value = staat.puntlaag.eenheid;
    if (puntLegendalabel) puntLegendalabel.value = staat.puntlaag.legendalabel;
    bouwPuntTabel();
    bouwPuntGroepen();
    bouwIconenBibliotheek();
    bouwKleurkiezer($("kiezer-punt"), staat.puntlaag.kleur, kleur => { staat.puntlaag.kleur = kleur; vulPuntlaag(); teken(); });
    werkVoetBij();
  }

  function bouwPuntGroepen() {
    const houder = $("punt-groepen");
    if (!houder) return;
    const groepen = puntgroepen();
    houder.innerHTML = "";
    houder.hidden = !groepen.length;
    groepen.forEach(groep => {
      const rij = maak("div", "categorierij");
      const staal = maak("button", "staal");
      staal.type = "button";
      staal.style.background = groep.kleur;
      staal.addEventListener("click", e => toonKleurpopup(e.currentTarget, groep.kleur, kleur => {
        staat.puntlaag.groepkleuren[groep.naam] = kleur;
        vulPuntlaag(); teken();
      }));
      rij.appendChild(staal);
      rij.appendChild(maak("span", "naam", groep.naam));
      rij.appendChild(maak("span", "aantal",
        staat.puntlaag.punten.filter(p => String(p.groep || "").trim() === groep.naam).length + "×"));
      houder.appendChild(rij);
    });
  }

  /* ----------------------------------------------------------- iconen */

  $("in-icoon-bestand").addEventListener("change", e => {
    const bestand = e.target.files[0];
    if (!bestand) return;
    const lezer = new FileReader();
    lezer.onload = () => {
      const id = "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const icoon = { id, naam: bestand.name.replace(/\.[^.]+$/, ""), data: lezer.result, bewaard: $("in-icoon-bewaren").checked };
      iconen.push(icoon);
      laadIcoonAfbeelding(icoon);
      staat.puntlaag.icoonId = id;
      staat.puntlaag.weergave = "icoon";
      bewaarIconen();
      vulPuntlaag(); teken();
    };
    lezer.readAsDataURL(bestand);
    e.target.value = "";
  });

  function bouwIconenBibliotheek() {
    const houder = $("iconenbibliotheek");
    houder.innerHTML = "";
    iconen.forEach(icoon => {
      const vak = maak("div", "icoon");
      const kies = maak("button", "kies");
      kies.type = "button";
      kies.title = icoon.naam;
      kies.classList.toggle("aan", staat.puntlaag.icoonId === icoon.id);
      const afb = maak("img");
      afb.src = icoon.data;
      afb.alt = icoon.naam;
      kies.appendChild(afb);
      kies.addEventListener("click", () => { staat.puntlaag.icoonId = icoon.id; vulPuntlaag(); teken(); });
      const schrap = maak("button", "schrap", "×");
      schrap.type = "button";
      schrap.title = "Verwijderen";
      schrap.addEventListener("click", () => {
        iconen = iconen.filter(i => i.id !== icoon.id);
        if (staat.puntlaag.icoonId === icoon.id) staat.puntlaag.icoonId = null;
        bewaarIconen(); vulPuntlaag(); teken();
      });
      vak.appendChild(kies);
      vak.appendChild(schrap);
      houder.appendChild(vak);
    });
    if (!iconen.length) houder.appendChild(maak("p", "hint", "Nog geen iconen geüpload."));
  }

  /* -------------------------------------------------------- tekstlaag */

  $("in-tekst-actief").addEventListener("change", () => {
    staat.tekstlaag.actief = $("in-tekst-actief").checked;
    vulTekstlaag(); teken();
  });

  $("knop-tekst-nieuw").addEventListener("click", () => {
    const bb = Render.data._bbox;
    staat.tekstlaag.blokken.push({
      id: "t" + (volgendeId++),
      tekst: "Nieuw tekstblok",
      x: bb.x + bb.b * 0.12,
      y: bb.y + bb.h * (0.12 + 0.08 * staat.tekstlaag.blokken.length),
      breedte: 320,
      kader: true,
      vulling: "#FFFFFF",
      lijn: false,
      ankerX: null, ankerY: null,
      lijnkleur: "#131720"
    });
    staat.tekstlaag.actief = true;
    vulTekstlaag(); teken();
  });

  function vulTekstlaag() {
    $("in-tekst-actief").checked = staat.tekstlaag.actief;
    $("tekst-instellingen").hidden = !staat.tekstlaag.actief;
    const houder = $("tekstblokken");
    houder.innerHTML = "";
    staat.tekstlaag.blokken.forEach((blok, i) => {
      const vak = maak("div", "tekstblok");
      const kop = maak("div", "kop");
      kop.appendChild(maak("b", null, "Blok " + (i + 1)));
      const staal = maak("button", "staal");
      staal.type = "button";
      staal.style.cssText = "width:22px;height:22px;border-radius:6px;border:1px solid rgba(19,23,32,.14);cursor:pointer;padding:0;background:" + blok.vulling;
      staal.title = "Achtergrondkleur";
      staal.addEventListener("click", e => toonKleurpopup(e.currentTarget, blok.vulling, kleur => { blok.vulling = kleur; vulTekstlaag(); teken(); }));
      kop.appendChild(staal);
      const weg = maak("button", "weg", "×");
      weg.type = "button";
      weg.style.cssText = "border:0;background:none;cursor:pointer;font-size:17px;color:#5C6577";
      weg.addEventListener("click", () => {
        staat.tekstlaag.blokken.splice(i, 1);
        vulTekstlaag(); teken();
      });
      kop.appendChild(weg);
      vak.appendChild(kop);

      const ta = maak("textarea");
      ta.rows = 2;
      ta.value = blok.tekst;
      ta.addEventListener("input", () => { blok.tekst = ta.value; teken(); });
      vak.appendChild(ta);

      const rij = maak("div", "rij");
      const l1 = maak("label", "schakel");
      const c1 = maak("input"); c1.type = "checkbox"; c1.checked = blok.kader !== false;
      c1.addEventListener("change", () => { blok.kader = c1.checked; teken(); });
      l1.appendChild(c1); l1.appendChild(maak("span", null, "Kader"));
      const l2 = maak("label", "schakel");
      const c2 = maak("input"); c2.type = "checkbox"; c2.checked = !!blok.lijn;
      c2.addEventListener("change", () => {
        blok.lijn = c2.checked;
        if (blok.lijn && blok.ankerX === null) {
          blok.ankerX = blok.x + 120;
          blok.ankerY = blok.y + 90;
        }
        vulTekstlaag(); teken();
      });
      l2.appendChild(c2); l2.appendChild(maak("span", null, "Verbindingslijn"));
      rij.appendChild(l1); rij.appendChild(l2);
      vak.appendChild(rij);

      if (blok.lijn) {
        // Zelfde zoeklijst als bij de puntlaag: typen geeft suggesties, en de
        // gekozen plaats zet het ankerpunt.
        const houder = maak("div", "zoekhouder");
        const zoek = maak("input");
        zoek.type = "text";
        zoek.placeholder = "Anker op plaatsnaam… (of sleep de stip)";
        const lijst = maak("div", "suggesties");
        lijst.hidden = true;
        houder.appendChild(zoek);
        houder.appendChild(lijst);
        koppelPlaatszoeker(zoek, lijst, p => {
          blok.ankerX = p.x; blok.ankerY = p.y;
          zoek.value = p.naam;
          teken();
        });
        vak.appendChild(houder);
      }
      houder.appendChild(vak);
    });
    werkVoetBij();
  }

  /* ---------------------------------------------------------- legenda */

  const LEGENDA_SCHAKELS = [
    ["categorie", "Categorieën"], ["schaal", "Kleurschaal"],
    ["stip", "Stippen"], ["bel", "Bellen"], ["icoon", "Iconen"]
  ];

  function bouwLegendaSchakelaars() {
    const houder = $("legenda-schakelaars");
    houder.innerHTML = "";
    LEGENDA_SCHAKELS.forEach(([sleutel, label]) => {
      const l = maak("label", "schakel");
      const inv = maak("input");
      inv.type = "checkbox";
      inv.checked = staat.legenda[sleutel];
      inv.addEventListener("change", () => { staat.legenda[sleutel] = inv.checked; teken(); });
      l.appendChild(inv);
      l.appendChild(maak("span", null, label));
      houder.appendChild(l);
    });
  }

  $("in-legenda-titel").addEventListener("input", () => { staat.legenda.titel = $("in-legenda-titel").value; teken(); });
  $("in-legenda-plaats").addEventListener("change", () => { staat.legenda.plaats = $("in-legenda-plaats").value; teken(); });

  /* ---------------------------------------------------------- formaat */

  $("formaatkeuze").querySelectorAll(".keuze").forEach(knop => {
    knop.addEventListener("click", () => {
      staat.formaat = knop.dataset.waarde;
      vulFormaat(); teken();
    });
  });
  function vulFormaat() {
    $("formaatkeuze").querySelectorAll(".keuze").forEach(k => k.classList.toggle("aan", k.dataset.waarde === staat.formaat));
  }

  /* ------------------------------------------------------ kleurkiezer */

  function bouwKleurkiezer(houder, huidig, kies) {
    if (!houder) return;
    houder.innerHTML = "";
    Render.ALLE_KLEUREN.forEach(hex => {
      const knop = maak("button");
      knop.type = "button";
      knop.style.background = hex;
      knop.title = hex;
      knop.classList.toggle("aan", hex.toUpperCase() === String(huidig).toUpperCase());
      knop.addEventListener("click", () => kies(hex));
      houder.appendChild(knop);
    });
  }

  let openPopup = null;
  function toonKleurpopup(anker, huidig, kies, metWissen) {
    sluitKleurpopup();
    const popup = maak("div", "kleurpopup");
    if (metWissen) {
      const wis = maak("button", "knop knop-licht", "Geen eigen kleur");
      wis.type = "button";
      wis.style.marginBottom = "10px";
      wis.addEventListener("click", () => { kies(null); sluitKleurpopup(); });
      popup.appendChild(wis);
    }
    popup.appendChild(maak("h4", null, "Huisstijl"));
    const rooster = maak("div", "kleurkiezer");
    popup.appendChild(rooster);
    bouwKleurkiezer(rooster, huidig, hex => { kies(hex); sluitKleurpopup(); });
    const eigen = maak("div", "eigen");
    const inv = maak("input");
    inv.type = "color";
    inv.value = /^#[0-9a-f]{6}$/i.test(huidig) ? huidig : "#1361FF";
    inv.addEventListener("change", () => { kies(inv.value); sluitKleurpopup(); });
    eigen.appendChild(inv);
    eigen.appendChild(maak("span", "hint", "Eigen kleur"));
    popup.appendChild(eigen);
    document.body.appendChild(popup);
    const r = anker.getBoundingClientRect();
    popup.style.left = Math.min(window.innerWidth - 290, r.left) + "px";
    popup.style.top = (window.scrollY + r.bottom + 6) + "px";
    openPopup = popup;
    setTimeout(() => document.addEventListener("click", buitenKlik), 0);
  }
  function buitenKlik(e) { if (openPopup && !openPopup.contains(e.target)) sluitKleurpopup(); }
  function sluitKleurpopup() {
    if (openPopup) { openPopup.remove(); openPopup = null; document.removeEventListener("click", buitenKlik); }
  }

  /* --------------------------------------------- interactie op de kaart */

  const hitDoek = document.createElement("canvas");
  const hitCtx = hitDoek.getContext("2d");

  function doekNaarKaart(e) {
    const r = doek.getBoundingClientRect();
    const px = (e.clientX - r.left) * (doek.width / r.width);
    const py = (e.clientY - r.top) * (doek.height / r.height);
    if (!laatsteIndeling) return null;
    const t = laatsteIndeling.transform;
    return { px, py, x: (px - t.tx) / t.s, y: (py - t.ty) / t.s };
  }

  function gemeenteOp(x, y) {
    const gebied = Render.gebiedVan(staat);
    hitCtx.setTransform(1, 0, 0, 1, 0, 0);
    for (const code of Object.keys(gebied.vlakken)) {
      if (hitCtx.isPointInPath(Render.pad(gebied.sleutel + code, gebied.vlakken[code].d), x, y)) return code;
    }
    return null;
  }

  let sleep = null;

  doek.addEventListener("mousedown", e => {
    const pos = doekNaarKaart(e);
    if (!pos || klikModus) return;
    // tekstblok of ankerpunt oppakken
    if (staat.tekstlaag.actief) {
      for (let i = staat.tekstlaag.blokken.length - 1; i >= 0; i--) {
        const blok = staat.tekstlaag.blokken[i];
        if (blok.lijn && blok.ankerX !== null) {
          const t = laatsteIndeling.transform;
          const ax = blok.ankerX * t.s + t.tx, ay = blok.ankerY * t.s + t.ty;
          if (Math.hypot(pos.px - ax, pos.py - ay) < 14) {
            sleep = { soort: "anker", blok }; doek.style.cursor = "grabbing"; return;
          }
        }
        const vak = blok._vak;
        if (vak && pos.px >= vak.x && pos.px <= vak.x + vak.b && pos.py >= vak.y && pos.py <= vak.y + vak.h) {
          sleep = { soort: "blok", blok, dx: pos.x - blok.x, dy: pos.y - blok.y };
          doek.style.cursor = "grabbing";
          return;
        }
      }
    }
    if (staat.puntlaag.actief) {
      const t = laatsteIndeling.transform;
      for (let i = staat.puntlaag.punten.length - 1; i >= 0; i--) {
        const punt = staat.puntlaag.punten[i];
        const sx = punt.x * t.s + t.tx, sy = punt.y * t.s + t.ty;
        if (Math.hypot(pos.px - sx, pos.py - sy) < 16) {
          sleep = { soort: "punt", punt }; doek.style.cursor = "grabbing"; return;
        }
      }
    }
  });

  window.addEventListener("mousemove", e => {
    if (!sleep) return;
    const pos = doekNaarKaart(e);
    if (!pos) return;
    if (sleep.soort === "blok") { sleep.blok.x = pos.x - sleep.dx; sleep.blok.y = pos.y - sleep.dy; }
    else if (sleep.soort === "anker") { sleep.blok.ankerX = pos.x; sleep.blok.ankerY = pos.y; }
    else if (sleep.soort === "punt") { sleep.punt.x = pos.x; sleep.punt.y = pos.y; }
    teken();
  });

  window.addEventListener("mouseup", () => {
    if (sleep) { sleep = null; doek.style.cursor = ""; }
  });

  doek.addEventListener("click", e => {
    const pos = doekNaarKaart(e);
    if (!pos) return;
    if (klikModus) {
      voegPuntToe(null, { x: pos.x, y: pos.y });
      zetKlikModus(false);
      return;
    }
  });

  const tooltip = $("tooltip");
  doek.addEventListener("mousemove", e => {
    const pos = doekNaarKaart(e);
    if (!pos || sleep) { tooltip.hidden = true; return; }
    const code = gemeenteOp(pos.x, pos.y);
    if (!code) { tooltip.hidden = true; doek.classList.remove("sleepbaar"); return; }
    const w = staat.vlaklaag.waarden[code];
    const naam = vlakNaam(code);
    tooltip.textContent = w && String(w.waarde).trim() !== "" ? naam + ": " + w.waarde : naam;
    const r = doek.getBoundingClientRect();
    const h = $("doek-houder").getBoundingClientRect();
    tooltip.style.left = (e.clientX - h.left) + "px";
    tooltip.style.top = (e.clientY - h.top) + "px";
    tooltip.hidden = false;
  });
  doek.addEventListener("mouseleave", () => { tooltip.hidden = true; });

  /* ----------------------------------------------------------- export */

  function exporteer(formaat) {
    const f = Render.FORMATEN[formaat];
    const c = document.createElement("canvas");
    c.width = f.breedte; c.height = f.hoogte;
    const k = c.getContext("2d");
    Render.tekenKaart(k, staat, formaat, hulpObject(false));
    return new Promise(res => c.toBlob(blob => res(blob), "image/png"));
  }

  function bestandsnaam(formaat) {
    const basis = (staat.naam || staat.titel || "kaart-overijssel")
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "kaart-overijssel";
    const maat = { "16:9": "1920x1080", "1:1": "1080x1080", "9:16": "1080x1920" }[formaat];
    return basis + "-" + maat + ".png";
  }

  function bewaarBlob(blob, naam) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = naam;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  $("knop-export").addEventListener("click", async () => {
    const blob = await exporteer(staat.formaat);
    bewaarBlob(blob, bestandsnaam(staat.formaat));
  });

  $("knop-export-alle").addEventListener("click", async () => {
    for (const formaat of ["16:9", "1:1", "9:16"]) {
      const blob = await exporteer(formaat);
      bewaarBlob(blob, bestandsnaam(formaat));
      await new Promise(r => setTimeout(r, 350));
    }
  });

  /* ------------------------------------------------------ bibliotheek */

  function leesBibliotheek() {
    try { return JSON.parse(localStorage.getItem(BIB_SLEUTEL) || "[]"); }
    catch (e) { return []; }
  }
  function schrijfBibliotheek(lijst) {
    try { localStorage.setItem(BIB_SLEUTEL, JSON.stringify(lijst)); return true; }
    catch (e) { meld("bibliotheek-melding", "De opslag van deze browser zit vol. Download de kaart als bestand.", "fout"); return false; }
  }

  $("knop-opslaan").addEventListener("click", () => {
    staat.naam = $("in-kaartnaam").value.trim() || "Naamloze kaart";
    const lijst = leesBibliotheek();
    const nu = new Date().toISOString();
    const bestaand = actieveKaartId ? lijst.find(k => k.id === actieveKaartId) : null;
    if (bestaand) {
      bestaand.naam = staat.naam;
      bestaand.gewijzigd = nu;
      bestaand.staat = JSON.parse(JSON.stringify(staat));
    } else {
      actieveKaartId = "k" + Date.now().toString(36);
      lijst.unshift({ id: actieveKaartId, naam: staat.naam, gewijzigd: nu, staat: JSON.parse(JSON.stringify(staat)) });
    }
    if (schrijfBibliotheek(lijst)) meld("bibliotheek-melding", "Opgeslagen. De kaart blijft bewerkbaar.", "goed");
    bouwBibliotheek();
  });

  $("knop-nieuw").addEventListener("click", () => {
    if (!confirm("Nieuwe kaart beginnen? Niet-opgeslagen wijzigingen gaan verloren.")) return;
    staat = nieuweStaat();
    actieveKaartId = null;
    vulAlles();
    teken();
  });

  $("knop-download").addEventListener("click", () => {
    staat.naam = $("in-kaartnaam").value.trim() || staat.naam;
    const blob = new Blob([JSON.stringify(staat, null, 2)], { type: "application/json" });
    const basis = bestandsnaam("16:9").replace(/-1920x1080\.png$/, "");
    bewaarBlob(blob, basis + ".kaart.json");
  });

  $("in-open-bestand").addEventListener("change", e => {
    const bestand = e.target.files[0];
    if (!bestand) return;
    const lezer = new FileReader();
    lezer.onload = () => {
      try {
        const geladen = JSON.parse(lezer.result);
        if (!geladen || !geladen.basiskaart) throw new Error("geen kaartbestand");
        staat = herstelStaat(geladen);
        actieveKaartId = null;
        vulAlles(); teken();
        meld("bibliotheek-melding", "Bestand geopend.", "goed");
      } catch (fout) {
        meld("bibliotheek-melding", "Dit bestand is geen kaart van de Kaartenbouwer.", "fout");
      }
    };
    lezer.readAsText(bestand);
    e.target.value = "";
  });

  function bouwBibliotheek() {
    const houder = $("bibliotheeklijst");
    houder.innerHTML = "";
    const lijst = leesBibliotheek();
    if (!lijst.length) { houder.appendChild(maak("p", "hint", "Nog geen opgeslagen kaarten.")); return; }
    lijst.forEach(item => {
      const rij = maak("div", "bibliotheekrij");
      rij.classList.toggle("actief", item.id === actieveKaartId);
      rij.appendChild(maak("span", "naam", item.naam));
      rij.appendChild(maak("span", "datum", new Date(item.gewijzigd).toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })));
      const open = maak("button", null, "Openen");
      open.type = "button";
      open.addEventListener("click", () => {
        staat = herstelStaat(JSON.parse(JSON.stringify(item.staat)));
        actieveKaartId = item.id;
        vulAlles(); teken();
        meld("bibliotheek-melding", "“" + item.naam + "” geopend.", "goed");
      });
      const weg = maak("button", "weg", "Verwijderen");
      weg.type = "button";
      weg.addEventListener("click", () => {
        if (!confirm("“" + item.naam + "” verwijderen?")) return;
        schrijfBibliotheek(leesBibliotheek().filter(k => k.id !== item.id));
        if (actieveKaartId === item.id) actieveKaartId = null;
        bouwBibliotheek();
      });
      rij.appendChild(open);
      rij.appendChild(weg);
      houder.appendChild(rij);
    });
  }

  function meld(id, tekst, soort) {
    const el = $(id);
    if (!el) return;
    el.textContent = tekst;
    el.className = "melding" + (soort ? " " + soort : "");
  }

  /* -------------------------------------------------------------- hulp */

  $("knop-hulp").addEventListener("click", () => { $("hulp-overlay").hidden = false; });
  $("knop-hulp-sluit").addEventListener("click", () => { $("hulp-overlay").hidden = true; });
  $("hulp-overlay").addEventListener("click", e => { if (e.target === $("hulp-overlay")) $("hulp-overlay").hidden = true; });

  /* ------------------------------------------------ lettertypecontrole */

  // document.fonts.check() geeft in Chromium ook true voor een lettertype dat
  // er niet is, dus meten we de breedte tegen twee heel verschillende
  // terugvallettertypes. Wijkt Roobert van geen van beide af, dan is het er niet.
  function controleerLetter() {
    const meet = document.createElement("canvas").getContext("2d");
    const proef = "Overijssel 1234 gemeenten WMil";
    const afwijkt = terugval => {
      meet.font = "40px " + terugval;
      const basis = meet.measureText(proef).width;
      meet.font = "40px Roobert, " + terugval;
      return Math.abs(meet.measureText(proef).width - basis) > 0.5;
    };
    const beschikbaar = afwijkt("monospace") && afwijkt("serif");
    $("fontwaarschuwing").hidden = beschikbaar;
  }

  /* --------------------------------------------------------- opstarten */

  function vulAlles() {
    // De rijen van de basiskaart hangen aan de kaartsoort. Wie een opgeslagen
    // kaart van de andere soort opent, moet ook die rijen krijgen.
    bouwBasiskaart();
    $("in-titel").value = staat.titel;
    $("in-ondertitel").value = staat.ondertitel;
    $("in-bronaanvulling").value = staat.bronaanvulling;
    if ($("in-achtergrond")) {
      $("in-achtergrond").value = staat.achtergrond;
      $("transparant-hint").hidden = staat.achtergrond !== "transparant";
    }
    if ($("in-uitlijning")) $("in-uitlijning").value = staat.uitlijning;
    if ($("in-kaartuitlijning")) $("in-kaartuitlijning").value = staat.kaartuitlijning;
    $("in-weergave").value = staat.weergave;
    $("weergave-hint").hidden = staat.weergave !== "beeldvullend";
    $("in-kaartnaam").value = staat.naam;
    $("in-legenda-titel").value = staat.legenda.titel;
    $("in-legenda-plaats").value = staat.legenda.plaats;
    vulBasiskaart();
    vulVlaklaag();
    vulPuntlaag();
    vulTekstlaag();
    bouwLegendaSchakelaars();
    vulFormaat();
    bouwBibliotheek();
  }

  function toonHiaat() {
    const el = $("hulp-hiaat");
    if (!el) return;
    el.textContent = PLAATSEN.hiaat || "";
    if (!PLAATSEN.hiaat) {
      el.hidden = true;
      const kop = $("hulp-hiaat-kop");
      if (kop) kop.hidden = true;
    }
  }

  bouwBasiskaart();
  laadIconen();
  vulAlles();
  toonHiaat();
  controleerLetter();
  teken();

  window.addEventListener("resize", () => { if (mobielAan) tekenMobiel(); });

})();
