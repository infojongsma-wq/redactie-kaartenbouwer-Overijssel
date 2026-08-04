const { chromium } = require('playwright');
const fs = require('fs');
const UIT = (process.env.KB_UIT || '/tmp/kb-testbeelden/');
if (!fs.existsSync(UIT)) fs.mkdirSync(UIT, { recursive: true });

/* Wat hier getoetst wordt: de bibliotheek op de server. Het wachtwoord, de
   sessie die een herlaadbeurt overleeft, kaarten en iconen die twee redacteuren
   allebei zien, en — het punt waarvoor er een database is — dat de één het werk
   van de ander niet ongemerkt overschrijft.

   Draait alleen als er een database is; zonder POSTGRES_URL slaat het over.
   test/alles.js zet die zelf klaar. */
(async () => {
  if (!process.env.POSTGRES_URL) {
    console.log('overgeslagen: geen POSTGRES_URL (start een database, zie test/README.md)');
    console.log('--- fouten ---'); console.log('(geen)');
    return;
  }

  const fouten = [];
  const { Pool } = require('pg');
  const db = new Pool({ connectionString: process.env.POSTGRES_URL });
  await db.query('drop table if exists kaarten, iconen');

  const server = await require('./_apiserver.js').start(0);
  const adres = 'http://localhost:' + server.address().port + '/';

  /* 401, 409 en 429 zijn hier geen storingen maar antwoorden: niet ingelogd,
     iemand was je voor, te vaak geprobeerd. De browser schrijft ze toch in de
     console. We toetsen op wat de redacteur te zien krijgt; alle overige
     consolefouten tellen gewoon mee. */
  const verwacht = /status of (401|409|429)/;

  const browser = await chromium.launch();
  const maakTab = async () => {
    const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
    const page = await context.newPage();
    page.on('console', m => { if (m.type() === 'error' && !verwacht.test(m.text())) fouten.push('CONSOLE: ' + m.text()); });
    page.on('pageerror', e => fouten.push('PAGEERROR: ' + e.message));
    page.on('dialog', d => d.accept());
    await page.goto(adres);
    await page.waitForTimeout(900);
    await page.click('.paneel[data-paneel="bibliotheek"] .paneel-kop');
    return { context, page };
  };

  /* ------------------------------------------------ redacteur 1: inloggen */
  const a = await maakTab();
  console.log('inlogblok zichtbaar :', await a.page.isVisible('#inlogblok'));
  console.log('opslaan geblokkeerd :', await a.page.isDisabled('#knop-opslaan'));

  await a.page.fill('#in-wachtwoord', 'fout-wachtwoord');
  await a.page.click('#knop-inloggen');
  await a.page.waitForTimeout(400);
  console.log('bij fout wachtwoord :', JSON.stringify(await a.page.textContent('#bibliotheek-melding')));

  await a.page.fill('#in-wachtwoord', process.env.BIBLIOTHEEK_WACHTWOORD);
  await a.page.click('#knop-inloggen');
  await a.page.waitForTimeout(600);
  console.log('na goed wachtwoord  :', JSON.stringify(await a.page.textContent('#bibliotheek-melding')));
  console.log('inlogblok weg       :', !(await a.page.isVisible('#inlogblok')));
  console.log('uitlogknop          :', await a.page.isVisible('#knop-uitloggen'));

  /* ------------------------------------------------------- kaart opslaan */
  await a.page.fill('#in-titel', 'Stikstof per gemeente');
  await a.page.fill('#in-kaartnaam', 'Stikstof');
  await a.page.click('#knop-opslaan');
  await a.page.waitForTimeout(600);
  console.log('na opslaan          :', JSON.stringify(await a.page.textContent('#bibliotheek-melding')));
  console.log('in de database      :', (await db.query('select naam, versie from kaarten')).rows);

  /* -------------------------------------------- sessie overleeft herladen */
  await a.page.reload();
  await a.page.waitForTimeout(900);
  await a.page.click('.paneel[data-paneel="bibliotheek"] .paneel-kop');
  console.log('na herladen ingelogd:', !(await a.page.isVisible('#inlogblok')));
  console.log('teller in de balk   :', JSON.stringify(await a.page.textContent('#tel-bibliotheek')));

  /* ------------------------------------ redacteur 2 ziet dezelfde kaarten */
  const b = await maakTab();
  await b.page.fill('#in-wachtwoord', process.env.BIBLIOTHEEK_WACHTWOORD);
  await b.page.click('#knop-inloggen');
  await b.page.waitForTimeout(700);
  console.log('collega ziet        :', await b.page.evaluate(() =>
    [...document.querySelectorAll('#bibliotheeklijst .naam')].map(n => n.textContent)));

  /* Allebei dezelfde kaart open, collega slaat als eerste op. */
  await a.page.click('#bibliotheeklijst .bibliotheekrij button:not(.weg)');
  await a.page.waitForTimeout(500);
  await b.page.click('#bibliotheeklijst .bibliotheekrij button:not(.weg)');
  await b.page.waitForTimeout(500);
  await b.page.fill('#in-titel', 'Aangepast door de collega');
  await b.page.click('#knop-opslaan');
  await b.page.waitForTimeout(600);
  console.log('collega slaat op    :', JSON.stringify(await b.page.textContent('#bibliotheek-melding')));

  await a.page.fill('#in-titel', 'Aangepast door mij');
  await a.page.click('#knop-opslaan');
  await a.page.waitForTimeout(600);
  const botsing = await a.page.textContent('#bibliotheek-melding');
  console.log('en dan ik           :', JSON.stringify(botsing));
  if (!/intussen aangepast/.test(botsing)) fouten.push('BOTSING niet gemeld — werk kan verdwijnen');
  console.log('werk collega intact :', (await db.query("select staat->>'titel' as titel from kaarten")).rows);

  /* ------------------------------------- iconen gaan mee naar de collega */
  /* Zonder dit zou een gedeelde kaart met een eigen icoon bij de buurman leeg
     blijven: de kaart staat dan wel op de server, het icoon niet. */
  const punt = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#FF6813"/></svg>');
  await a.page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await a.page.setInputFiles('#in-icoon-bestand', { name: 'stip.svg', mimeType: 'image/svg+xml', buffer: punt });
  await a.page.waitForTimeout(700);
  console.log('icoon in de database:', (await db.query('select naam from iconen')).rows);

  await b.page.reload();
  await b.page.waitForTimeout(900);
  console.log('collega ziet icoon  :', await b.page.evaluate(() =>
    document.querySelectorAll('#iconenbibliotheek .icoon').length));

  /* ----------------------------------------------------------- uitloggen */
  await a.page.click('#knop-uitloggen');
  await a.page.waitForTimeout(500);
  console.log('na uitloggen        :', await a.page.isVisible('#inlogblok'));
  await a.page.reload();
  await a.page.waitForTimeout(900);
  await a.page.click('.paneel[data-paneel="bibliotheek"] .paneel-kop');
  console.log('blijft uitgelogd    :', await a.page.isVisible('#inlogblok'));

  await b.page.screenshot({ path: UIT + 'gedeelde-bibliotheek.png', clip: { x: 0, y: 0, width: 520, height: 900 } });

  console.log('--- fouten ---'); console.log(fouten.length ? fouten.join('\n') : '(geen)');
  await browser.close();
  await db.end();
  server.close();
})();
