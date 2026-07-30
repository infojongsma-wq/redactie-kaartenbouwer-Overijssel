const { chromium } = require('playwright');
const fs = require('fs');
const UIT = (process.env.KB_UIT || '/tmp/kb-testbeelden/')
if (!fs.existsSync(UIT)) fs.mkdirSync(UIT, { recursive: true });
const bestand = __dirname + '/../dist/kaartenbouwer-overijssel.html';
async function schiet(page, naam) { const b64 = await page.evaluate(() => document.getElementById('doek').toDataURL('image/png').split(',')[1]); fs.writeFileSync(UIT + naam, Buffer.from(b64, 'base64')); }

/* Wat hier getoetst wordt: de letter- en kaderkleur van een tekstblok zijn te
   kiezen, de titel wordt zonder omlijning gezet, en de uitleg bij de
   achtergrondkeuze verschijnt precies wanneer die keuze onzichtbaar is. */
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error') fouten.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => fouten.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + bestand); await page.waitForTimeout(700);

  // --- achtergrond-hint ------------------------------------------------
  console.log('hint in kader          :', await page.evaluate(() => !document.getElementById('achtergrond-hint').hidden));
  await page.selectOption('#in-weergave', 'beeldvullend'); await page.waitForTimeout(400);
  console.log('hint beeldvullend      :', await page.evaluate(() => !document.getElementById('achtergrond-hint').hidden));
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.uncheck('input[data-laag="water"]'); await page.waitForTimeout(400);
  console.log('hint zonder water      :', await page.evaluate(() => !document.getElementById('achtergrond-hint').hidden));
  await page.check('input[data-laag="water"]');
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.selectOption('#in-weergave', 'kader'); await page.waitForTimeout(300);

  // --- titel zonder omlijning ------------------------------------------
  // Donkerblauwe titel op witte achtergrond: rond de letters mag geen witte
  // rand liggen, dus direct naast donkere pixels horen alleen donker en de
  // achtergrond zelf voor te komen.
  await page.fill('#in-titel', 'HHHH');
  await page.waitForTimeout(400);
  console.log('witte zoom om titel    :', await page.evaluate(() => {
    const d = document.getElementById('doek'), g = d.getContext('2d');
    const r = g.getImageData(0, 40, d.width, 80).data;
    let rand = 0;
    for (let i = 4; i < r.length - 4; i += 4) {
      const donker = r[i] < 60, links = r[i - 4] > 245 && r[i - 3] > 245 && r[i - 2] < 250;
      if (donker && links) rand++;
    }
    return rand > 40 ? 'JA (' + rand + ' overgangspixels wit->donker met kleurzweem)' : 'geen (' + rand + ')';
  }));

  // --- tekstblok: letter- en kaderkleur --------------------------------
  await page.evaluate(() => {
    document.querySelectorAll('.paneel').forEach(p => p.classList.remove('open'));
    document.querySelector('.paneel[data-paneel="tekstlaag"]').classList.add('open');
  });
  await page.check('#in-tekst-actief');
  await page.click('#knop-tekst-nieuw');
  await page.waitForTimeout(300);
  console.log('kleurrijen per blok    :', await page.evaluate(() =>
    [...document.querySelectorAll('#tekstblokken .blokkleuren .rijlabel')].map(s => s.textContent)));

  // wit op Oost Blauw
  await page.evaluate(() => {
    const rijen = document.querySelectorAll('#tekstblokken .blokkleuren');
    rijen[0].querySelectorAll('.staal')[0].click();       // letter: wit
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const rijen = document.querySelectorAll('#tekstblokken .blokkleuren');
    rijen[1].querySelectorAll('.staal')[2].click();       // kader: Oost Blauw
  });
  await page.waitForTimeout(400);
  console.log('blok in staat          :', await page.evaluate(() => {
    const naStaal = [...document.querySelectorAll('#tekstblokken .blokkleuren')].map(r =>
      [...r.querySelectorAll('.staal')].findIndex(s => s.classList.contains('aan')));
    return JSON.stringify(naStaal) + ' (verwacht [0,2])';
  }));
  await schiet(page, 'tekstblok-kleuren.png');

  console.log('--- fouten ---'); console.log(fouten.length ? fouten.join('\n') : '(geen)');
  await browser.close();
})();
