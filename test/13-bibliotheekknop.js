const { chromium } = require('playwright');
const fs = require('fs');
const UIT = (process.env.KB_UIT || '/tmp/kb-testbeelden/')
if (!fs.existsSync(UIT)) fs.mkdirSync(UIT, { recursive: true });
const bestand = __dirname + '/../dist/kaartenbouwer-overijssel.html';

/* Wat hier getoetst wordt: de knop in de balk telt de opgeslagen kaarten en
   brengt je er met één klik naartoe, ook als het paneel dicht is. */
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error') fouten.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => fouten.push('PAGEERROR: ' + e.message));
  page.on('dialog', d => d.accept());          // "Nieuwe kaart beginnen?"
  await page.goto('file://' + bestand); await page.waitForTimeout(700);

  console.log('knop in de balk    :', await page.evaluate(() => {
    const k = document.getElementById('knop-bibliotheek');
    if (!k) return 'ONTBREEKT';
    const h1 = document.querySelector('.balk h1');
    return k.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_PRECEDING ? 'ja, naast de titel' : 'ja, maar niet naast de titel';
  }));
  console.log('teller bij nul     :', JSON.stringify(await page.textContent('#tel-bibliotheek')));

  await page.click('.paneel[data-paneel="bibliotheek"] .paneel-kop');
  await page.fill('#in-kaartnaam', 'Eerste kaart');
  await page.click('#knop-opslaan');
  await page.waitForTimeout(300);
  await page.click('#knop-nieuw');
  await page.waitForTimeout(400);
  await page.fill('#in-kaartnaam', 'Tweede kaart');
  await page.click('#knop-opslaan');
  await page.waitForTimeout(300);
  console.log('teller na 2 kaarten:', JSON.stringify(await page.textContent('#tel-bibliotheek')));

  // alles dicht, dan de knop: opent hij het paneel en scrollt hij ernaartoe?
  await page.evaluate(() => document.querySelectorAll('.paneel').forEach(p => p.classList.remove('open')));
  await page.click('#knop-bibliotheek');
  await page.waitForTimeout(600);
  console.log('open na klik       :', await page.evaluate(() => [...document.querySelectorAll('.paneel.open')].map(p => p.dataset.paneel)));
  console.log('in beeld           :', await page.evaluate(() => {
    const r = document.querySelector('.paneel[data-paneel="bibliotheek"]').getBoundingClientRect();
    return r.top >= -5 && r.top < window.innerHeight ? 'ja' : 'NEE (top ' + Math.round(r.top) + ')';
  }));
  console.log('kaarten in de lijst:', await page.evaluate(() => [...document.querySelectorAll('#bibliotheeklijst .naam')].map(n => n.textContent)));

  await page.screenshot({ path: UIT + 'bibliotheekknop.png', clip: { x: 0, y: 0, width: 1500, height: 420 } });
  console.log('--- fouten ---'); console.log(fouten.length ? fouten.join('\n') : '(geen)');
  await browser.close();
})();
