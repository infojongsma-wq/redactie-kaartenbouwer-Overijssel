/* Inloggen met één wachtwoord voor de hele redactie.
   GET     -> hoe staat het ervoor (dit is ook de test of de API er is)
   POST    -> wachtwoord aanbieden, sessie krijgen
   DELETE  -> uitloggen */

const H = require("./_hulp.js");

module.exports = async function (req, res) {
  if (req.method === "GET") {
    return H.stuur(res, 200, { ingericht: H.ingericht(), ingelogd: H.ingelogd(req) });
  }

  if (req.method === "POST") {
    if (!H.ingericht()) {
      return H.stuur(res, 503, {
        fout: "De gedeelde bibliotheek is nog niet ingericht: er ontbreekt een wachtwoord of een database.",
        ingericht: false
      });
    }
    if (H.teVaak(req)) {
      return H.stuur(res, 429, { fout: "Te veel pogingen. Probeer het over tien minuten opnieuw." });
    }
    const body = await H.leesBody(req);
    if (!H.wachtwoordKlopt(body.wachtwoord)) {
      H.misgeslagen(req);
      return H.stuur(res, 401, { fout: "Dat wachtwoord klopt niet." });
    }
    H.gelukt(req);
    H.zetKoekje(res, H.nieuweSessie(), H.DAGEN * 86400);
    return H.stuur(res, 200, { ingelogd: true, dagen: H.DAGEN });
  }

  if (req.method === "DELETE") {
    H.zetKoekje(res, "", 0);
    return H.stuur(res, 200, { ingelogd: false });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return H.stuur(res, 405, { fout: "Methode niet toegestaan." });
};
