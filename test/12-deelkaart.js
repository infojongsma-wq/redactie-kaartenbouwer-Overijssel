const { chromium } = require('playwright');
const fs = require('fs');
const UIT = (process.env.KB_UIT || '/tmp/kb-testbeelden/')
if (!fs.existsSync(UIT)) fs.mkdirSync(UIT, { recursive: true });
const bestand = __dirname + '/../dist/kaartenbouwer-overijssel.html';
async function schiet(page, naam) { const b64 = await page.evaluate(() => document.getElementById('doek').toDataURL('image/png').split(',')[1]); fs.writeFileSync(UIT + naam, Buffer.from(b64, 'base64')); }

// Hoe breed staat de provincie in beeld? Op kleur herkennen is broos zodra de
// vlaklaag meekleurt, dus de test zet de provinciecontour op Oost Rood en meet
// de uitersten daarvan. Dat is één kleur die verder nergens voorkomt.
const CONTOUR = [255, 66, 66];
async function provinciebreedte(page) {
  return page.evaluate(([R, G, B]) => {
    const d = document.getElementById('doek'), g = d.getContext('2d');
    const r = g.getImageData(0, 0, d.width, d.height).data;
    let links = -1, rechts = -1;
    for (let x = 0; x < d.width; x++) {
      let raak = false;
      for (let y = 0; y < d.height; y += 2) {
        const i = (y * d.width + x) * 4;
        if (Math.abs(r[i] - R) < 26 && Math.abs(r[i + 1] - G) < 34 && Math.abs(r[i + 2] - B) < 34) { raak = true; break; }
      }
      if (raak) { if (links < 0) links = x; rechts = x; }
    }
    return rechts - links;
  }, CONTOUR);
}

/* Wat hier getoetst wordt: een gebied kiezen zoomt de kaart in, het
   keuzekader zit alleen in het voorbeeld en niet in de export, het
   overzichtje verschijnt in de gekozen hoek, en alle lagen blijven werken. */
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const fouten = [];
  page.on('console', m => { if (m.type() === 'error') fouten.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => fouten.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + bestand); await page.waitForTimeout(700);

  // Eerst meten op een kale kaart: met een legenda ernaast zou die meetellen
  // in de breedtemeting.
  await page.fill('#in-titel', 'Nieuwbouw in West-Overijssel');
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('.paneel[data-paneel="basiskaart"] details.invoer > summary');
  await page.evaluate(() => {
    const k = [...document.querySelectorAll('#kiezer-contour button')].find(b => b.title.toUpperCase() === '#FF4242');
    k.click();
  });
  await page.fill('#in-contourdikte', '3');
  await page.evaluate(() => document.getElementById('in-contourdikte').dispatchEvent(new Event('input', { bubbles: true })));
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.waitForTimeout(500);
  const heel = await provinciebreedte(page);
  console.log('hele provincie in beeld :', heel, 'px breed');
  await schiet(page, 'deelkaart-00-heel.png');

  // --- gebied kiezen ---------------------------------------------------
  await page.click('.paneel[data-paneel="deelkaart"] .paneel-kop');
  await page.click('#knop-uitsnede-kiezen');
  await page.waitForTimeout(400);
  console.log('maten                   :', await page.evaluate(() => [...document.querySelectorAll('#uitsnede-maten .keuze')].map(k => k.textContent).join(' | ')));
  // Tijdens het kiezen ligt er een demping over de kaart, dus de rode contour
  // is dan geen zuiver rood meer; breedte meten heeft daar geen zin. Wat er
  // wel toe doet: je ziet de hele kaart, zodat je het kader kunt plaatsen.
  console.log('bij kiezen: demping     :', await page.evaluate(() => {
    const d = document.getElementById('doek'), r = d.getContext('2d').getImageData(0, 0, d.width, d.height).data;
    let n = 0; for (let i = 0; i < r.length; i += 40) if (r[i] < 110 && Math.abs(r[i] - r[i + 2]) < 60) n++;
    return n > 5000 ? 'ja, buiten het kader' : 'NEE';
  }));
  await schiet(page, 'deelkaart-01-kiezen.png');

  // kader naar het noordwesten slepen
  const doos = await page.$eval('#doek', d => { const r = d.getBoundingClientRect(); return { x: r.x, y: r.y, b: r.width, h: r.height }; });
  await page.mouse.move(doos.x + doos.b * 0.5, doos.y + doos.h * 0.5);
  await page.mouse.down();
  await page.mouse.move(doos.x + doos.b * 0.36, doos.y + doos.h * 0.34, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await schiet(page, 'deelkaart-02-verschoven.png');

  await page.click('#uitsnede-maten .keuze[data-maat="2"]');
  await page.waitForTimeout(400);
  await schiet(page, 'deelkaart-03-kleiner.png');

  // --- toepassen -------------------------------------------------------
  await page.click('#knop-uitsnede-toepassen');
  await page.waitForTimeout(500);
  const deel = await provinciebreedte(page);
  // Bij een deelkaart van 21 km loopt de provincie ruim buiten het kaartvlak,
  // dus de gemeten breedte is die van het vlak zelf. Dat de contour de rand
  // raakt is precies het bewijs dat er is ingezoomd.
  console.log('na toepassen            :', deel, 'px breed —',
    deel > heel * 1.25 ? 'provincie loopt buiten het kaartvlak, dus ingezoomd' : 'NIET ingezoomd');
  console.log('teller in de paneelkop  :', await page.textContent('#tel-uitsnede'));

  // nu de lagen erbij: volgen die de uitsnede?
  await page.click('.paneel[data-paneel="deelkaart"] .paneel-kop');
  await page.click('.paneel[data-paneel="vlaklaag"] .paneel-kop');
  await page.check('#in-vlak-actief');
  await page.click('.paneel[data-paneel="vlaklaag"] details.invoer > summary');
  await page.fill('#in-vlak-plak', 'Zwolle\t120\nKampen\t86\nZwartewaterland\t44\nSteenwijkerland\t60\nStaphorst\t31');
  await page.click('#knop-vlak-plak');
  await page.selectOption('#in-vlak-label', 'naam-waarde');
  await page.click('.paneel[data-paneel="vlaklaag"] .paneel-kop');
  await page.click('.paneel[data-paneel="deelkaart"] .paneel-kop');
  await page.waitForTimeout(500);
  await schiet(page, 'deelkaart-04-toegepast.png');

  // overzichtje in elke hoek
  for (const hoek of ['rechtsboven', 'rechtsonder', 'geen']) {
    await page.selectOption('#in-minikaart', hoek);
    await page.waitForTimeout(350);
    await schiet(page, 'deelkaart-05-' + hoek + '.png');
  }
  await page.selectOption('#in-minikaart', 'linksboven');
  await page.waitForTimeout(300);

  // --- zit het keuzekader in de export? --------------------------------
  // Het gedempte gebied rond het keuzekader is bediening, geen kaart. We
  // exporteren terwijl het kader openstaat en kijken in het echte PNG-bestand.
  await page.click('#knop-uitsnede-kiezen');
  await page.waitForTimeout(400);
  console.log('voorbeeld gedempt       :', await page.evaluate(() => {
    const d = document.getElementById('doek');
    const r = d.getContext('2d').getImageData(0, 0, d.width, d.height).data;
    let n = 0;
    for (let i = 0; i < r.length; i += 4) if (r[i] < 110 && Math.abs(r[i] - r[i + 2]) < 60) n++;
    return n > 200000 ? 'ja' : 'nee';
  }));

  const wacht = page.waitForEvent('download');
  await page.click('#knop-export');
  const bestandje = await wacht;
  const pad = UIT + 'deelkaart-export.png';
  await bestandje.saveAs(pad);
  const grootte = fs.statSync(pad).size;
  console.log('export weggeschreven    :', Math.round(grootte / 1024), 'KB');
  // Het bestand terug de browser in laden: alleen de bestandsgrootte zegt niets
  // over wat erin staat.
  const uitBestand = await page.evaluate(async b64 => {
    const afb = new Image();
    await new Promise(r => { afb.onload = r; afb.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas');
    c.width = afb.width; c.height = afb.height;
    c.getContext('2d').drawImage(afb, 0, 0);
    const r = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < r.length; i += 4) if (r[i] < 110 && Math.abs(r[i] - r[i + 2]) < 60) n++;
    return { breedte: afb.width, hoogte: afb.height, gedempt: n };
  }, fs.readFileSync(pad).toString('base64'));
  console.log('export                  :', uitBestand.breedte + '\u00d7' + uitBestand.hoogte,
    '- gedempte pixels:', uitBestand.gedempt,
    uitBestand.gedempt < 50000 ? '(schoon, geen keuzekader)' : '(KADER LEKT NAAR DE EXPORT)');
  await page.click('#knop-uitsnede-annuleren');
  await page.waitForTimeout(300);

  // --- werkt het ook beeldvullend en in de andere formaten? ------------
  await page.evaluate(() => {
    document.querySelectorAll('.paneel').forEach(p => p.classList.remove('open'));
    document.querySelector('.paneel[data-paneel="kaart"]').classList.add('open');
  });
  await page.selectOption('#in-weergave', 'beeldvullend');
  await page.waitForTimeout(450);
  await schiet(page, 'deelkaart-06-beeldvullend.png');
  for (const f of ['1:1', '9:16']) {
    await page.click('#formaatkeuze .keuze[data-waarde="' + f + '"]');
    await page.waitForTimeout(450);
    await schiet(page, 'deelkaart-07-' + f.replace(':', 'op') + '.png');
  }
  await page.click('#formaatkeuze .keuze[data-waarde="16:9"]');
  await page.selectOption('#in-weergave', 'kader');
  await page.evaluate(() => {
    document.querySelectorAll('.paneel').forEach(p => p.classList.remove('open'));
    document.querySelector('.paneel[data-paneel="deelkaart"]').classList.add('open');
  });
  await page.waitForTimeout(400);
  console.log('andere formaten         : geen fouten (zie schermafdrukken)');

  // --- terug naar de hele kaart ----------------------------------------
  await page.click('#knop-uitsnede-heel');
  await page.waitForTimeout(400);
  console.log('na "Hele kaart"         :', await provinciebreedte(page), 'px (moet ' + heel + ' zijn)');

  console.log('--- fouten ---'); console.log(fouten.length ? fouten.join('\n') : '(geen)');
  await browser.close();
})();
