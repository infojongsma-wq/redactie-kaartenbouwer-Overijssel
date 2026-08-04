const crypto = require('node:crypto');

/* Wat hier getoetst wordt: de API zelf, zonder browser — dus ook draaibaar in
   GitHub Actions. De nadruk ligt op wat er níet mag kunnen: zonder sessie bij de
   kaarten, met een zelfgemaakt koekje binnenkomen, of het werk van een collega
   overschrijven.

   Slaat zichzelf over zonder POSTGRES_URL. */
(async () => {
  const fouten = [];
  const zegt = (wat, gekregen, verwacht) => {
    const goed = JSON.stringify(gekregen) === JSON.stringify(verwacht);
    console.log((wat + ' ').padEnd(34, '.') + ' ' + JSON.stringify(gekregen) + (goed ? '' : '  <-- verwacht ' + JSON.stringify(verwacht)));
    if (!goed) fouten.push(wat + ': ' + JSON.stringify(gekregen) + ', verwacht ' + JSON.stringify(verwacht));
  };

  if (!process.env.POSTGRES_URL) {
    console.log('overgeslagen: geen POSTGRES_URL (zie test/README.md)');
    console.log('--- fouten ---'); console.log('(geen)');
    return;
  }
  const WACHTWOORD = process.env.BIBLIOTHEEK_WACHTWOORD;

  const { Pool } = require('pg');
  const db = new Pool({ connectionString: process.env.POSTGRES_URL });
  await db.query('drop table if exists kaarten, iconen');

  const server = await require('./_apiserver.js').start(0);
  const basis = 'http://localhost:' + server.address().port;

  let koekje = '';
  async function vraag(pad, opties = {}) {
    const kop = Object.assign({ 'Content-Type': 'application/json' }, opties.headers || {});
    if (koekje && !('Cookie' in kop)) kop.Cookie = koekje;
    const a = await fetch(basis + pad, Object.assign({}, opties, { headers: kop }));
    const zet = a.headers.get('set-cookie');
    if (zet && !opties.headers?.Cookie) koekje = zet.split(';')[0];
    let inhoud = null;
    try { inhoud = await a.json(); } catch (e) { /* leeg */ }
    return { code: a.status, inhoud };
  }

  /* ------------------------------------------------------ zonder sessie */
  zegt('kaarten zonder inloggen', (await vraag('/api/kaarten')).code, 401);
  zegt('iconen zonder inloggen', (await vraag('/api/iconen')).code, 401);
  zegt('opslaan zonder inloggen',
    (await vraag('/api/kaarten', { method: 'PUT', body: '{"naam":"x","staat":{}}' })).code, 401);
  zegt('toestand is wel op te vragen', (await vraag('/api/inloggen')).inhoud, { ingericht: true, ingelogd: false });

  /* --------------------------------------------------- verzonnen koekjes */
  /* De handtekening hangt aan het wachtwoord. Wie het wachtwoord niet heeft,
     kan geen geldige maken — ook niet met een datum ver in de toekomst. */
  const tot = Date.now() + 864e5;
  const verzin = sleutelbron => tot + '.' + crypto.createHmac('sha256',
    crypto.createHash('sha256').update('kaartenbouwer-sessie ' + sleutelbron).digest())
    .update(String(tot)).digest('base64url');

  const metKoekje = w => ({ headers: { Cookie: 'kb_sessie=' + w } });
  zegt('koekje zonder handtekening', (await vraag('/api/kaarten', metKoekje(tot + '.zomaarwat'))).code, 401);
  zegt('koekje met ander wachtwoord', (await vraag('/api/kaarten', metKoekje(verzin('geraden')))).code, 401);
  zegt('koekje van gisteren', (await vraag('/api/kaarten', metKoekje(
    (Date.now() - 1000) + '.' + 'x'.repeat(43)))).code, 401);
  zegt('koekje mét wachtwoord werkt', (await vraag('/api/kaarten', metKoekje(verzin(WACHTWOORD)))).code, 200);

  /* ------------------------------------------------------------ inloggen */
  zegt('fout wachtwoord', (await vraag('/api/inloggen', { method: 'POST', body: '{"wachtwoord":"mis"}' })).code, 401);
  zegt('leeg wachtwoord', (await vraag('/api/inloggen', { method: 'POST', body: '{}' })).code, 401);
  const in1 = await vraag('/api/inloggen', { method: 'POST', body: JSON.stringify({ wachtwoord: WACHTWOORD }) });
  zegt('goed wachtwoord', in1.code, 200);
  zegt('koekje gekregen', koekje.startsWith('kb_sessie='), true);

  /* ------------------------------------------------------------- kaarten */
  const nieuw = await vraag('/api/kaarten', { method: 'PUT', body: JSON.stringify({ naam: 'Proef', staat: { titel: 'een' } }) });
  zegt('nieuwe kaart', [nieuw.code, nieuw.inhoud.versie], [200, 1]);
  const id = nieuw.inhoud.id;

  const lijst = await vraag('/api/kaarten');
  zegt('lijst heeft één kaart', lijst.inhoud.kaarten.length, 1);
  zegt('lijst zonder staat', 'staat' in lijst.inhoud.kaarten[0], false);
  zegt('losse kaart mét staat', (await vraag('/api/kaarten?id=' + id)).inhoud.staat, { titel: 'een' });

  const goed = await vraag('/api/kaarten', { method: 'PUT', body: JSON.stringify({ id, versie: 1, naam: 'Proef', staat: { titel: 'twee' } }) });
  zegt('bijwerken telt op', [goed.code, goed.inhoud.versie], [200, 2]);

  const oud = await vraag('/api/kaarten', { method: 'PUT', body: JSON.stringify({ id, versie: 1, naam: 'Proef', staat: { titel: 'drie' } }) });
  zegt('oude versie botst', oud.code, 409);
  zegt('en verandert niets', (await vraag('/api/kaarten?id=' + id)).inhoud.staat, { titel: 'twee' });

  zegt('kaart zonder staat', (await vraag('/api/kaarten', { method: 'PUT', body: '{"naam":"leeg"}' })).code, 400);
  zegt('te grote kaart', (await vraag('/api/kaarten', {
    method: 'PUT', body: JSON.stringify({ naam: 'groot', staat: { vulling: 'x'.repeat(2.1 * 1024 * 1024) } })
  })).code, 413);

  zegt('onbekende kaart', (await vraag('/api/kaarten?id=bestaatniet')).code, 404);
  zegt('verwijderen', (await vraag('/api/kaarten?id=' + id, { method: 'DELETE' })).code, 200);
  zegt('daarna weg', (await vraag('/api/kaarten?id=' + id)).code, 404);

  /* -------------------------------------------------------------- iconen */
  const icoon = { id: 'i1', naam: 'stip', data: 'data:image/svg+xml;base64,PHN2Zy8+' };
  zegt('icoon bewaren', (await vraag('/api/iconen', { method: 'PUT', body: JSON.stringify(icoon) })).code, 200);
  zegt('icoon terug', (await vraag('/api/iconen')).inhoud.iconen.length, 1);
  zegt('tweemaal hetzelfde id', (await vraag('/api/iconen', { method: 'PUT', body: JSON.stringify(icoon) })).code, 200);
  zegt('blijft één icoon', (await vraag('/api/iconen')).inhoud.iconen.length, 1);
  zegt('geen afbeelding', (await vraag('/api/iconen', { method: 'PUT', body: '{"id":"i2","data":"javascript:kwaad()"}' })).code, 400);

  /* ------------------------------------------------------------ methodes */
  zegt('methode die niet bestaat', (await vraag('/api/kaarten', { method: 'PATCH' })).code, 405);

  /* ------------------------------------------------------------ uitloggen */
  await vraag('/api/inloggen', { method: 'DELETE' });
  koekje = '';
  zegt('na uitloggen weer dicht', (await vraag('/api/kaarten')).code, 401);

  /* -------------------------------------------------------- pogingen remmen */
  /* Als laatste: hierna zit dit adres een tijdje op slot. */
  let laatste = 0;
  for (let i = 0; i < 12; i++) {
    laatste = (await vraag('/api/inloggen', { method: 'POST', body: '{"wachtwoord":"gok' + i + '"}' })).code;
  }
  zegt('na twaalf pogingen', laatste, 429);
  zegt('ook met het goede wachtwoord',
    (await vraag('/api/inloggen', { method: 'POST', body: JSON.stringify({ wachtwoord: WACHTWOORD }) })).code, 429);

  console.log('--- fouten ---'); console.log(fouten.length ? fouten.join('\n') : '(geen)');
  await db.end();
  server.close();
  if (fouten.length) process.exitCode = 1;
})();
