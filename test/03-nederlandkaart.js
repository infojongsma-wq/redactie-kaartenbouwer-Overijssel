const { chromium } = require('playwright');
const fs=require('fs');
const UIT=(process.env.KB_UIT||'/tmp/kb-testbeelden/')
if(!fs.existsSync(UIT))fs.mkdirSync(UIT,{recursive:true});
const bestand='/home/user/redactie-kaartenbouwer-Overijssel/dist/kaartenbouwer-overijssel.html';
async function schiet(page,naam){const b64=await page.evaluate(()=>document.getElementById('doek').toDataURL('image/png').split(',')[1]);fs.writeFileSync(UIT+naam,Buffer.from(b64,'base64'));}
const PROV = 'Provincie\tWerkloosheid\nGroningen\t4,8\nFryslân\t3,9\nDrenthe\t3,6\nOverijssel\t3,2\nFlevoland\t4,1\nGelderland\t3,0\nUtrecht\t2,9\nNoord-Holland\t3,7\nZuid-Holland\t3,8\nZeeland\t2,7\nNoord-Brabant\t3,1\nLimburg\t3,5';
(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1600,height:950}});
  const fouten=[];
  page.on('console',m=>{if(m.type()==='error')fouten.push('CONSOLE: '+m.text());});
  page.on('pageerror',e=>fouten.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,4).join('\n')));
  await page.goto('file://'+bestand); await page.waitForTimeout(600);

  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('#kaartsoortkeuze .keuze[data-waarde="nederland"]');
  await page.waitForTimeout(500);
  console.log('uitgelicht-vinkjes:', await page.$$eval('#uitgelicht-lijst input', o=>o.length));
  console.log('geselecteerd    :', await page.evaluate(()=>[...document.querySelectorAll('#uitgelicht-lijst label')].filter(l=>l.querySelector('input').checked).map(l=>l.textContent.trim()).join(', ')));
  await page.click('#basiskaart-stijlen .keuze:nth-child(3)');   // wit
  await page.fill('#in-titel','Overijssel in Nederland');
  await page.waitForTimeout(500);
  await schiet(page,'nl-01-uitgelicht.png');

  // data per provincie
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('.paneel[data-paneel="vlaklaag"] .paneel-kop');
  await page.check('#in-vlak-actief');
  await page.click('.paneel[data-paneel="vlaklaag"] details.invoer > summary');
  await page.fill('#in-vlak-plak', PROV);
  await page.click('#knop-vlak-plak'); await page.waitForTimeout(400);
  console.log('plakmelding     :', await page.textContent('#vlak-plak-melding'));
  await page.selectOption('#in-vlak-label','naam-waarde');
  await page.selectOption('#in-vlak-schaal','blauw');
  await page.fill('#in-vlak-eenheid','%');
  await page.fill('#in-titel','Werkloosheid per provincie');
  await page.waitForTimeout(500);
  await schiet(page,'nl-02-data.png');
  console.log('voet            :', await page.textContent('#voorbeeld-voet'));

  // terug naar Overijssel: blijft gemeentedata bewaard?
  await page.fill('#in-vlak-plak','Almelo\t72\nZwolle\t126\nEnschede\t140');
  await page.click('.paneel[data-paneel="vlaklaag"] .paneel-kop');
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('#kaartsoortkeuze .keuze[data-waarde="overijssel"]');
  await page.waitForTimeout(400);
  console.log('na wisselen     :', await page.textContent('#voorbeeld-voet'));
  await page.click('#kaartsoortkeuze .keuze[data-waarde="nederland"]');
  await page.waitForTimeout(400);
  console.log('terug naar NL   :', await page.textContent('#voorbeeld-voet'));

  // tooltip op de NL-kaart
  const vak = await page.locator('#doek').boundingBox();
  await page.mouse.move(vak.x+vak.width*0.52, vak.y+vak.height*0.48);
  await page.waitForTimeout(250);
  console.log('tooltip         :', await page.evaluate(()=>{const t=document.getElementById('tooltip');return t.hidden?null:t.textContent;}));

  console.log('--- fouten ---'); console.log(fouten.length?fouten.join('\n'):'(geen)');
  await browser.close();
})();
