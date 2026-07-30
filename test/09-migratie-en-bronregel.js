const { chromium } = require('playwright');
const fs = require('fs');
const UIT = (process.env.KB_UIT || '/tmp/kb-testbeelden/')
if (!fs.existsSync(UIT)) fs.mkdirSync(UIT, { recursive: true });
const bestand = __dirname + '/../dist/kaartenbouwer-overijssel.html';
async function schiet(page, naam) { const b64 = await page.evaluate(() => document.getElementById('doek').toDataURL('image/png').split(',')[1]); fs.writeFileSync(UIT + naam, Buffer.from(b64, 'base64')); }

/* Wat hier getoetst wordt: dat een kaart uit een oudere versie zonder verlies
   opengaat, en dat de verplichte bronvermelding er niet af te krijgen is. */
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error') fouten.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => fouten.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + bestand); await page.waitForTimeout(700);

  // --- de bronregel is niet leeg te maken ------------------------------
  await page.fill('#in-bronaanvulling', '');
  await page.waitForTimeout(300);
  const pixels = await page.evaluate(() => {
    const d = document.getElementById('doek'), g = d.getContext('2d');
    const r = g.getImageData(0, d.height - 110, d.width, 100).data;
    let n = 0; for (let i = 0; i < r.length; i += 4) if (r[i] < 250 || r[i + 1] < 250 || r[i + 2] < 250) n++;
    return n;
  });
  console.log('bronregel bij lege aanvulling:', pixels > 200 ? 'getekend (' + pixels + ' px)' : 'ONTBREEKT');

  // --- een kaart uit de vorige versie openen ---------------------------
  const oud = {
    versie: 1, naam: 'Oude kaart', titel: 'Uit een vorige versie', ondertitel: '',
    bron: 'Bron: RVO · kaart: Kadaster/PDOK', achtergrond: 'wit', uitlijning: 'rechts',
    formaat: '16:9', kaartsoort: 'nederland', kaal: true,
    basiskaart: {
      preset: '', stijl: '', context: false, water: false, wateren: false,
      gemeentegrenzen: true, provinciecontour: true, gemeentenamen: true, plaatsen: 'geen',
      vulling: '#1361FF', grenskleur: '#5B8CFF', contourkleur: '#5B8CFF',
      grensdikte: 0.8, contourdikte: 0.8, uitgelicht: '23', uitlichtkleur: '#FFFFFF'
    },
    vlaklaag: { actief: false, modus: 'schaal', waarden: {}, categoriekleuren: {}, schaal: 'blauw', min: null, max: null, autogrens: true, eenheid: '', label: 'geen', leeg: 'grijs' },
    puntlaag: { actief: false, punten: [], weergave: 'stip', kleur: '#FF4242', stipgrootte: 22, belmin: 10, belmax: 48, icoonId: null, icoongrootte: 42, label: 'naam', eenheid: '', legendalabel: 'Locatie', groepkleuren: {} },
    tekstlaag: { actief: false, blokken: [] },
    legenda: { titel: '', categorie: true, schaal: true, stip: true, bel: true, icoon: true, plaats: 'rechts', tvplaats: 'linksonder' }
  };
  await page.evaluate(o => {
    localStorage.setItem('kaartenbouwer.bibliotheek', JSON.stringify([{ id: 'oud1', naam: 'Oude kaart', gewijzigd: 1750000000000, staat: o }]));
    location.reload();
  }, oud);
  await page.waitForTimeout(900);
  await page.click('.paneel[data-paneel="bibliotheek"] .paneel-kop');
  await page.waitForTimeout(200);
  const knop = await page.$('#bibliotheeklijst .bibliotheekrij button');
  if (!knop) { console.log('FOUT: geen openknop in de bibliotheek'); }
  else { await knop.click(); await page.waitForTimeout(700); }

  console.log('na openen:', JSON.stringify(await page.evaluate(() => ({
    weergave: document.getElementById('in-weergave').value,
    titeluitlijning: document.getElementById('in-uitlijning').value,
    kaartuitlijning: document.getElementById('in-kaartuitlijning').value,
    aanvulling: document.getElementById('in-bronaanvulling').value,
    vast: document.getElementById('bron-vast').textContent,
    namen: document.getElementById('in-namen').value,
    legendaplaats: document.getElementById('in-legenda-plaats').value,
    kaartsoort: [...document.querySelectorAll('#kaartsoortkeuze .keuze')].filter(k => k.classList.contains('aan')).map(k => k.dataset.waarde)[0],
    uitgelicht: [...document.querySelectorAll('#uitgelicht-lijst label')].filter(l => l.querySelector('input').checked).map(l => l.textContent.trim())
  }))));
  await schiet(page, 'migratie-oude-kaart.png');

  // --- plaats zoeken buiten Overijssel ---------------------------------
  await page.click('.paneel[data-paneel="bibliotheek"] .paneel-kop');
  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.check('#in-punt-actief');
  await page.fill('#in-punt-zoek', 'Maastri');
  await page.waitForTimeout(400);
  const sug = await page.evaluate(() => [...document.querySelectorAll('#punt-suggesties button')].map(b => b.textContent.trim()).slice(0, 3));
  console.log('op de Nederlandkaart, "Maastri":', JSON.stringify(sug));
  if (sug.length) { await page.click('#punt-suggesties button'); await page.waitForTimeout(500); }
  console.log('bronregel na GeoNames-punt:', await page.textContent('#bron-vast'));

  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('#kaartsoortkeuze .keuze[data-waarde="overijssel"]');
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.fill('#in-punt-zoek', 'Maastri');
  await page.waitForTimeout(400);
  console.log('op de Overijsselkaart, "Maastri":', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#punt-suggesties button')].map(b => b.textContent.trim()))));

  console.log('--- fouten ---'); console.log(fouten.length ? fouten.join('\n') : '(geen)');
  await browser.close();
})();
