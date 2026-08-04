/* De gedeelde bibliotheek.
   GET            -> lijst (zonder staat, dus licht)
   GET    ?id=..  -> één kaart, mét staat
   PUT            -> opslaan; zonder id een nieuwe, met id een bestaande
   DELETE ?id=..  -> weg */

const H = require("./_hulp.js");

const MAX_STAAT = 2 * 1024 * 1024;   // 2 MB is ruim; alles daarboven is geen kaart meer

function nieuwId() {
  return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = async function (req, res) {
  const db = await H.bewaakt(req, res);
  if (!db) return;

  const id = typeof req.query?.id === "string" ? req.query.id : "";

  try {
    if (req.method === "GET") {
      if (id) {
        const r = await db.query(
          "select id, naam, staat, versie, gewijzigd, auteur from kaarten where id = $1", [id]);
        if (!r.rows.length) return H.stuur(res, 404, { fout: "Die kaart bestaat niet (meer)." });
        return H.stuur(res, 200, r.rows[0]);
      }
      /* Bewust zonder `staat`: de lijst blijft daardoor een paar KB, ook bij
         honderden kaarten. Dat is precies wat een tabel je geeft en een
         bestandsopslag niet. */
      const r = await db.query(
        "select id, naam, versie, gewijzigd, auteur from kaarten order by gewijzigd desc");
      return H.stuur(res, 200, { kaarten: r.rows });
    }

    if (req.method === "PUT") {
      const body = await H.leesBody(req);
      const naam = String(body.naam || "Naamloze kaart").slice(0, 60);
      const auteur = body.auteur ? String(body.auteur).slice(0, 60) : null;
      if (!body.staat || typeof body.staat !== "object") {
        return H.stuur(res, 400, { fout: "Er zat geen kaart in het verzoek." });
      }
      const staat = JSON.stringify(body.staat);
      if (staat.length > MAX_STAAT) {
        return H.stuur(res, 413, { fout: "Deze kaart is te groot om op te slaan." });
      }

      if (!body.id) {
        const r = await db.query(
          `insert into kaarten (id, naam, staat, auteur, gewijzigd, versie)
           values ($1, $2, $3::jsonb, $4, now(), 1)
           returning id, naam, versie, gewijzigd`,
          [nieuwId(), naam, staat, auteur]);
        return H.stuur(res, 200, r.rows[0]);
      }

      /* De hele reden voor een database in plaats van losse bestanden: dit is
         één regel en het voorkomt dat de één het werk van de ander overschrijft
         zonder dat iemand het merkt. Nul geraakte rijen = iemand was je voor. */
      const r = await db.query(
        `update kaarten set naam = $2, staat = $3::jsonb, auteur = coalesce($4, auteur),
                            gewijzigd = now(), versie = versie + 1
         where id = $1 and versie = $5
         returning id, naam, versie, gewijzigd`,
        [String(body.id), naam, staat, auteur, Number(body.versie) || 0]);

      if (r.rows.length) return H.stuur(res, 200, r.rows[0]);

      const nu = await db.query("select naam, versie, gewijzigd, auteur from kaarten where id = $1", [String(body.id)]);
      if (!nu.rows.length) return H.stuur(res, 404, { fout: "Die kaart is intussen verwijderd." });
      return H.stuur(res, 409, { fout: "Iemand anders heeft deze kaart intussen aangepast.", huidig: nu.rows[0] });
    }

    if (req.method === "DELETE") {
      if (!id) return H.stuur(res, 400, { fout: "Geen id opgegeven." });
      await db.query("delete from kaarten where id = $1", [id]);
      return H.stuur(res, 200, { verwijderd: id });
    }
  } catch (fout) {
    return H.stuur(res, 500, { fout: "Er ging iets mis in de database: " + fout.message });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return H.stuur(res, 405, { fout: "Methode niet toegestaan." });
};
