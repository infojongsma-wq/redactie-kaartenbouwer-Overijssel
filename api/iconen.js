/* Iconen horen bij de bibliotheek: een gedeelde kaart die een eigen icoon
   gebruikt, moet dat icoon bij de buurman ook kunnen tekenen.
   GET            -> alle iconen
   PUT            -> er een bewaren
   DELETE ?id=..  -> weg */

const H = require("./_hulp.js");

const MAX_ICOON = 512 * 1024;   // een icoon van een halve MB is al royaal

module.exports = async function (req, res) {
  const db = await H.bewaakt(req, res);
  if (!db) return;

  const id = typeof req.query?.id === "string" ? req.query.id : "";

  try {
    if (req.method === "GET") {
      const r = await db.query("select id, naam, data from iconen order by gewijzigd");
      return H.stuur(res, 200, { iconen: r.rows });
    }

    if (req.method === "PUT") {
      const body = await H.leesBody(req);
      const data = String(body.data || "");
      if (!/^data:image\//.test(data)) {
        return H.stuur(res, 400, { fout: "Dat is geen afbeelding." });
      }
      if (data.length > MAX_ICOON) {
        return H.stuur(res, 413, { fout: "Dit icoon is te groot." });
      }
      const r = await db.query(
        `insert into iconen (id, naam, data, gewijzigd) values ($1, $2, $3, now())
         on conflict (id) do update set naam = excluded.naam, data = excluded.data, gewijzigd = now()
         returning id, naam, data`,
        [String(body.id || "i" + Date.now().toString(36)), String(body.naam || "icoon").slice(0, 60), data]);
      return H.stuur(res, 200, r.rows[0]);
    }

    if (req.method === "DELETE") {
      if (!id) return H.stuur(res, 400, { fout: "Geen id opgegeven." });
      await db.query("delete from iconen where id = $1", [id]);
      return H.stuur(res, 200, { verwijderd: id });
    }
  } catch (fout) {
    return H.stuur(res, 500, { fout: "Er ging iets mis in de database: " + fout.message });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return H.stuur(res, 405, { fout: "Methode niet toegestaan." });
};
