/* Een kleine server die doet wat Vercel doet: het HTML-bestand serveren op /
   en /api/naam doorgeven aan api/naam.js. Zo is de gedeelde bibliotheek hier te
   testen zonder te hoeven publiceren.

   Vercel geeft de functie een gewone Node-request met drie dingen erbij:
   req.query, res.status() en res.send(). Die plakken we er hier ook op. */

const http = require('http');
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'dist', 'kaartenbouwer-overijssel.html');

function start(poort) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (!url.pathname.startsWith('/api/')) {
      const html = fs.readFileSync(HTML);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    const naam = url.pathname.slice(5).replace(/[^a-z]/g, '');
    const bestand = path.join(__dirname, '..', 'api', naam + '.js');
    if (!naam || !fs.existsSync(bestand)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end('{"fout":"onbekend"}');
    }

    req.query = Object.fromEntries(url.searchParams);
    res.status = code => { res.statusCode = code; return res; };
    res.send = tekst => res.end(tekst);

    try {
      delete require.cache[require.resolve(bestand)];
      await require(bestand)(req, res);
    } catch (fout) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ fout: String(fout && fout.stack || fout) }));
    }
  });
  return new Promise(klaar => server.listen(poort, () => klaar(server)));
}

module.exports = { start };
