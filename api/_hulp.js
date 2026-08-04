/* Gedeelde hulp voor de API: database, wachtwoord en sessie.
   Vercel behandelt bestanden die met _ beginnen niet als route. */

const crypto = require("node:crypto");
const { Pool } = require("pg");

/* ----------------------------------------------------------- database */

/* Hoe de verbindingsreeks heet hangt af van welke aanbieder je in Vercel
   koppelt: Neon zet DATABASE_URL, Supabase POSTGRES_URL, en de meeste zetten
   allebei. We nemen de eerste die er is, met de gebundelde ("pooled") reeks
   vooraan — serverless functies openen veel korte verbindingen, en een
   ongebundelde reeks loopt dan tegen de limiet van de database aan. */
const REEKSNAMEN = ["POSTGRES_URL", "DATABASE_URL", "POSTGRES_PRISMA_URL",
                    "POSTGRES_URL_NON_POOLING", "DATABASE_URL_UNPOOLED"];

function reeks() {
  for (const naam of REEKSNAMEN) if (process.env[naam]) return process.env[naam];
  return "";
}

function sslKeuze(r) {
  if (/sslmode=disable/.test(r) || /@(localhost|127\.0\.0\.1)/.test(r)) return false;
  if (/sslmode=no-verify/.test(r)) return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };   // Neon en Supabase hebben een geldig certificaat
}

let pool = null;
function db() {
  const r = reeks();
  if (!r) return null;
  /* Eén verbinding per instantie. Een warme functie hergebruikt hem, een koude
     maakt er een. Meer dan één heeft geen zin: een aanroep doet één query. */
  if (!pool) pool = new Pool({ connectionString: r, max: 1, ssl: sslKeuze(r), idleTimeoutMillis: 10000 });
  return pool;
}

/* De tabellen maken zichzelf bij het eerste gebruik. Voor twee tabellen zonder
   geschiedenis is dat genoeg; er is geen migratiegereedschap voor nodig. */
let tabellen = null;
function zorgVoorTabellen(verbinding) {
  if (!tabellen) {
    tabellen = verbinding.query(`
      create table if not exists kaarten (
        id        text primary key,
        naam      text not null,
        staat     jsonb not null,
        gewijzigd timestamptz not null default now(),
        versie    integer not null default 1,
        auteur    text
      );
      create index if not exists kaarten_gewijzigd on kaarten (gewijzigd desc);
      create table if not exists iconen (
        id        text primary key,
        naam      text not null,
        data      text not null,
        gewijzigd timestamptz not null default now()
      );
    `).catch(fout => { tabellen = null; throw fout; });
  }
  return tabellen;
}

/* ----------------------------------------------------- wachtwoord */

const WACHTWOORD = process.env.BIBLIOTHEEK_WACHTWOORD || "";
const KOEKJE = "kb_sessie";
const DAGEN = 30;

function ingericht() { return Boolean(WACHTWOORD && reeks()); }

/* Vergelijken op de hash, niet op de tekst: dan is de vergelijking altijd even
   lang en verraadt de tijd niets over hoeveel tekens er klopten. */
function wachtwoordKlopt(ingevoerd) {
  if (!WACHTWOORD) return false;
  const a = crypto.createHash("sha256").update(String(ingevoerd == null ? "" : ingevoerd)).digest();
  const b = crypto.createHash("sha256").update(WACHTWOORD).digest();
  return crypto.timingSafeEqual(a, b);
}

/* De ondertekensleutel komt uit het wachtwoord zelf. Zo is er maar één ding in
   te stellen, en vervalt elke sessie zodra het wachtwoord verandert. */
function sleutel() {
  return crypto.createHash("sha256").update("kaartenbouwer-sessie " + WACHTWOORD).digest();
}

function onderteken(tot) {
  return crypto.createHmac("sha256", sleutel()).update(String(tot)).digest("base64url");
}

function nieuweSessie() {
  const tot = Date.now() + DAGEN * 864e5;
  return tot + "." + onderteken(tot);
}

function sessieGeldig(waarde) {
  if (!waarde || !WACHTWOORD) return false;
  const punt = waarde.indexOf(".");
  if (punt < 1) return false;
  const tot = waarde.slice(0, punt), handtekening = waarde.slice(punt + 1);
  if (!/^\d+$/.test(tot) || Number(tot) < Date.now()) return false;
  const verwacht = Buffer.from(onderteken(tot));
  const gekregen = Buffer.from(handtekening);
  return verwacht.length === gekregen.length && crypto.timingSafeEqual(verwacht, gekregen);
}

function leesKoekje(req, naam) {
  const rauw = req.headers.cookie || "";
  for (const deel of rauw.split(";")) {
    const is = deel.indexOf("=");
    if (is > 0 && deel.slice(0, is).trim() === naam) return decodeURIComponent(deel.slice(is + 1).trim());
  }
  return "";
}

function zetKoekje(res, waarde, seconden) {
  res.setHeader("Set-Cookie", [
    KOEKJE + "=" + encodeURIComponent(waarde),
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=" + seconden
  ].join("; "));
}

function ingelogd(req) { return sessieGeldig(leesKoekje(req, KOEKJE)); }

/* ------------------------------------------------------- pogingen remmen */

/* Eén wachtwoord op een openbaar adres wordt vroeg of laat geprobeerd. Dit remt
   dat af. Het geheugen is per instantie, dus wie geduld heeft en geluk heeft met
   de verdeling komt er langs — het is een drempel, geen slot. Het echte werk
   doet de lengte van het wachtwoord. */
const pogingen = new Map();
const MAX = 10, VENSTER = 10 * 60 * 1000;

function teVaak(req) {
  const wie = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "onbekend";
  const nu = Date.now();
  const staat = pogingen.get(wie);
  if (!staat || nu > staat.tot) return false;
  return staat.aantal >= MAX;
}

function misgeslagen(req) {
  const wie = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "onbekend";
  const nu = Date.now();
  const staat = pogingen.get(wie);
  if (!staat || nu > staat.tot) pogingen.set(wie, { aantal: 1, tot: nu + VENSTER });
  else staat.aantal++;
  if (pogingen.size > 500) for (const [k, v] of pogingen) if (nu > v.tot) pogingen.delete(k);
}

function gelukt(req) {
  const wie = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "onbekend";
  pogingen.delete(wie);
}

/* ------------------------------------------------------------ antwoorden */

function stuur(res, code, waarde) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(code).send(JSON.stringify(waarde));
}

/* Elke route begint hiermee: is er een sessie, en staat de database klaar? */
async function bewaakt(req, res) {
  if (!ingericht()) {
    stuur(res, 503, { fout: "De gedeelde bibliotheek is nog niet ingericht.", ingericht: false });
    return null;
  }
  if (!ingelogd(req)) {
    stuur(res, 401, { fout: "Niet ingelogd." });
    return null;
  }
  const verbinding = db();
  try {
    await zorgVoorTabellen(verbinding);
  } catch (fout) {
    stuur(res, 500, { fout: "De database is niet bereikbaar: " + fout.message });
    return null;
  }
  return verbinding;
}

/* Vercel ontleedt JSON zelf, maar niet in elke opzet. Dit vangt beide. */
async function leesBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  const stukken = [];
  for await (const stuk of req) stukken.push(stuk);
  if (!stukken.length) return {};
  try { return JSON.parse(Buffer.concat(stukken).toString("utf8")); } catch (e) { return {}; }
}

module.exports = {
  db, zorgVoorTabellen, ingericht, wachtwoordKlopt, nieuweSessie, ingelogd,
  zetKoekje, stuur, bewaakt, leesBody, teVaak, misgeslagen, gelukt, DAGEN
};
