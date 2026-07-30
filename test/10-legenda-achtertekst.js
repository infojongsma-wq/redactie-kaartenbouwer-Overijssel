const { chromium } = require('playwright');
const fs = require('fs');
const UIT = (process.env.KB_UIT || '/tmp/kb-testbeelden/')
if (!fs.existsSync(UIT)) fs.mkdirSync(UIT, { recursive: true });
const bestand = __dirname + '/../dist/kaartenbouwer-overijssel.html';
async function schiet(page, naam) { const b64 = await page.evaluate(() => document.getElementById('doek').toDataURL('image/png').split(',')[1]); fs.writeFileSync(UIT + naam, Buffer.from(b64, 'base64')); }

/* Wat hier getoetst wordt: achter elke regel van de legenda kun je een eigen
   tekst zetten, die verschijnt op de kaart, en het veld houdt de cursor vast
   terwijl je typt. */
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error') fouten.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => fouten.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + bestand); await page.waitForTimeout(700);

  // punten met groepen -> drie regels in de legenda
  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.check('#in-punt-actief');
  await page.click('.paneel[data-paneel="puntlaag"] details.invoer > summary');
  await page.fill('#in-punt-plak', 'Zwolle\t\tGeopend\nEnschede\t\tIn aanbouw\nDeventer\t\tGepland');
  await page.click('#knop-punt-plak');
  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.waitForTimeout(400);

  await page.click('.paneel[data-paneel="legenda"] .paneel-kop');
  await page.waitForTimeout(300);
  console.log('velden achter de regels:', JSON.stringify(
    await page.evaluate(() => [...document.querySelectorAll('#legenda-achter .achterveld > span')].map(s => s.textContent))));

  const velden = await page.$$('#legenda-achter .achterveld input');
  if (velden.length >= 3) {
    await velden[0].fill('12 locaties');
    await velden[1].fill('4 in 2027');
    await velden[2].fill('nog niet vergund');
  }
  await page.waitForTimeout(500);
  await schiet(page, 'legenda-achtertekst.png');

  // staat de tekst ook echt op de kaart? tel de donkere pixels in de legendastrook
  console.log('legenda breder geworden:', await page.evaluate(() => {
    const d = document.getElementById('doek'), g = d.getContext('2d');
    const r = g.getImageData(Math.round(d.width * 0.72), 0, Math.round(d.width * 0.28), d.height).data;
    let n = 0; for (let i = 0; i < r.length; i += 4) if (r[i] < 120 && r[i + 1] < 120) n++;
    return n > 500 ? 'ja (' + n + ' donkere px)' : 'NEE (' + n + ')';
  }));

  // typen mag de cursor niet kosten
  if (velden.length) {
    await velden[0].click();
    await page.keyboard.type('XY');
    await page.waitForTimeout(350);
    console.log('cursor blijft in het veld:', await page.evaluate(() => {
      const a = document.activeElement;
      return a && a.closest('#legenda-achter') ? 'ja, waarde "' + a.value + '"' : 'NEE, focus weg';
    }));
  }

  console.log('--- fouten ---'); console.log(fouten.length ? fouten.join('\n') : '(geen)');
  await browser.close();
})();
