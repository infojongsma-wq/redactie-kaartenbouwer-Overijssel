const { chromium } = require('playwright');
const fs=require('fs');
const UIT=(process.env.KB_UIT||'/tmp/kb-testbeelden/')
if(!fs.existsSync(UIT))fs.mkdirSync(UIT,{recursive:true});
const bestand='/home/user/redactie-kaartenbouwer-Overijssel/dist/kaartenbouwer-overijssel.html';
async function schiet(page,naam){const b64=await page.evaluate(()=>document.getElementById('doek').toDataURL('image/png').split(',')[1]);fs.writeFileSync(UIT+naam,Buffer.from(b64,'base64'));}
(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1600,height:950}});
  const fouten=[];
  page.on('console',m=>{if(m.type()==='error')fouten.push('CONSOLE: '+m.text());});
  page.on('pageerror',e=>fouten.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,4).join('\n')));
  await page.goto('file://'+bestand); await page.waitForTimeout(600);

  // maar vier gemeenten data geven, zodat de rest zichtbaar leeg blijft
  await page.click('.paneel[data-paneel="vlaklaag"] .paneel-kop');
  await page.check('#in-vlak-actief');
  await page.click('.paneel[data-paneel="vlaklaag"] details.invoer > summary');
  await page.fill('#in-vlak-plak','Zwolle\t120\nEnschede\t340\nDeventer\t85\nHardenberg\t210');
  await page.click('#knop-vlak-plak');
  await page.waitForTimeout(300);
  console.log('melding:', await page.textContent('#vlak-melding').catch(()=>'(geen)'));

  for (const modus of ['naam','waarde','naam-waarde','geen']) {
    await page.selectOption('#in-vlak-label', modus);
    await page.waitForTimeout(350);
    await schiet(page,'lb-'+modus+'.png');
  }

  // met de laag Gemeentenamen erbij moeten de overige namen terugkomen
  await page.selectOption('#in-vlak-label','naam-waarde');
  await page.click('.paneel[data-paneel="vlaklaag"] .paneel-kop');
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.selectOption('#in-namen','alle');
  await page.waitForTimeout(400);
  await schiet(page,'lb-naam-waarde-plus-namen.png');

  console.log('--- fouten ---'); console.log(fouten.length?fouten.join('\n'):'(geen)');
  await browser.close();
})();
